/**
 * Routes HTTP de l'API — /api/v1.
 *
 * Toutes les routes « métier » acceptent les deux surfaces d'auth (JWT web,
 * X-API-Key agent) via resolveAuth. Les clés ne se gèrent que par JWT :
 * un agent ne crée pas ses propres clés.
 */
import crypto from 'node:crypto'
import Fastify, { type FastifyInstance } from 'fastify'
import type { DB, DraftRow, UserRow } from './db.js'
import { now } from './db.js'
import {
  generateApiKey, hashPassword, resolveAuth, signJwt, verifyPassword,
} from './auth.js'
import { sanitizeDraftHtml, isReasonableDraftHtml } from './sanitize.js'
import { loadCatalog } from './catalog.js'
import { renderSpec, type EffectsCatalog, type RenderSpec } from '../../src/engine/render.js'
import { config } from './config.js'

export interface BuildOptions {
  db: DB
  catalogPath?: string
  corsOrigin?: string
  /** Limite d'essais d'auth par minute et par IP (défaut 10 ; tests: énorme) */
  authRateLimit?: number
}

const uuid = () => crypto.randomUUID()
const DRAFT_STATUSES = new Set(['brouillon', 'pret', 'envoye'])
const MAX_DRAFTS = 200

/* ── Rate limit maison pour les routes d'auth (10 req/min/IP) ── */
const authHits = new Map<string, number[]>()
function makeRateLimiter(limit: number) {
  return (ip: string): boolean => {
    const t = Date.now()
    const win = (authHits.get(ip) ?? []).filter(x => t - x < 60_000)
    win.push(t)
    authHits.set(ip, win)
    return win.length > limit
  }
}

function publicUser(u: UserRow) {
  return { id: u.id, username: u.username, display_name: u.display_name, portal_username: u.portal_username, created_at: u.created_at }
}

function draftOut(d: DraftRow) {
  return {
    id: d.id, title: d.title, status: d.status, html: d.html,
    spec: d.spec ? JSON.parse(d.spec) : null,
    updated_by: d.updated_by, created_at: d.created_at, updated_at: d.updated_at,
  }
}

const draftSummary = (d: DraftRow) => ({
  id: d.id, title: d.title, status: d.status, updated_by: d.updated_by,
  created_at: d.created_at, updated_at: d.updated_at,
})

export function buildApp({ db, catalogPath, corsOrigin, authRateLimit }: BuildOptions): FastifyInstance {
  const app = Fastify({ logger: false, bodyLimit: 1_000_000 })
  const rateLimited = makeRateLimiter(authRateLimit ?? 10)
  const origin = corsOrigin ?? config.corsOrigin

  if (origin) {
    app.addHook('onRequest', async (_req, reply) => {
      reply.header('Access-Control-Allow-Origin', origin)
      reply.header('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS')
      reply.header('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-API-Key')
    })
    app.options('/api/v1/*', async (_req, reply) => reply.status(204).send())
  }

  const catalog: EffectsCatalog = loadCatalog(catalogPath)

  /* ═══════════ Santé & catalogue ═══════════ */

  app.get('/api/v1/health', async () => ({ ok: true, service: 'mailcolorer', time: now() }))

  app.get('/api/v1/effects', async () => ({
    baseSizeDefault: 18,
    colorEffects: catalog.colorEffects,
    bgEffects: Object.fromEntries(Object.entries(catalog.colorEffects).map(([id, e]) => [`${id}_bg`, e])),
    sizeEffects: catalog.sizeEffects,
  }))

  /* ═══════════ Comptes ═══════════ */

  app.post('/api/v1/auth/register', async (req, reply) => {
    if (rateLimited(req.ip)) return reply.status(429).send({ error: 'Trop de requêtes' })
    const b = req.body as { username?: string; password?: string; display_name?: string } ?? {}
    const username = String(b.username || '').trim()
    const password = String(b.password || '')
    if (!/^[a-zA-Z0-9._-]{2,32}$/.test(username)) return reply.status(400).send({ error: 'Nom utilisateur invalide (2-32, alphanumérique)' })
    if (password.length < 8) return reply.status(400).send({ error: 'Mot de passe : 8 caractères minimum' })
    const exists = db.prepare('SELECT id FROM users WHERE username = ?').get(username)
    if (exists) return reply.status(409).send({ error: 'Nom utilisateur déjà pris' })
    const user: UserRow = {
      id: uuid(), username, display_name: b.display_name?.trim() || null, portal_username: null,
      password_hash: hashPassword(password), created_at: now(),
    }
    db.prepare('INSERT INTO users (id, username, display_name, portal_username, password_hash, created_at) VALUES (?,?,?,?,?,?)')
      .run(user.id, user.username, user.display_name, user.portal_username, user.password_hash, user.created_at)
    return { token: signJwt(user.id), user: publicUser(user) }
  })

  app.post('/api/v1/auth/login', async (req, reply) => {
    if (rateLimited(req.ip)) return reply.status(429).send({ error: 'Trop de requêtes' })
    const b = req.body as { username?: string; password?: string } ?? {}
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(String(b.username || '').trim()) as UserRow | undefined
    if (!user || !verifyPassword(String(b.password || ''), user.password_hash)) {
      return reply.status(401).send({ error: 'Identifiants invalides' })
    }
    return { token: signJwt(user.id), user: publicUser(user) }
  })

  app.get('/api/v1/auth/me', async (req, reply) => {
    const auth = resolveAuth(db, req.headers)
    if (!auth) return reply.status(401).send({ error: 'Non authentifié' })
    return { user: publicUser(auth.user), via: auth.via }
  })

  /* ═══════════ Auth commun ═══════════ */

  const requireAuth = async (req: { headers: Record<string, unknown>; ip: string }, reply: any) => {
    const auth = resolveAuth(db, req.headers)
    if (!auth) { await reply.status(401).send({ error: 'Non authentifié' }); return null }
    return auth
  }

  /* ═══════════ Rendu ═══════════ */

  app.post('/api/v1/render', async (req, reply) => {
    const auth = await requireAuth(req, reply)
    if (!auth) return
    let spec: RenderSpec
    try {
      spec = req.body as RenderSpec
    } catch {
      return reply.status(400).send({ error: 'JSON invalide' })
    }
    if (!spec || !Array.isArray(spec.blocks) || spec.blocks.length === 0) {
      return reply.status(400).send({ error: 'spec.blocks requis (voir skill colorier-mail)' })
    }
    if (spec.blocks.length > 200) return reply.status(400).send({ error: '200 blocs maximum' })
    const totalChars = spec.blocks.reduce((n, b) => n + (b.text?.length ?? 0), 0)
    if (totalChars > 50_000) return reply.status(400).send({ error: '50 000 caractères maximum' })
    try {
      const html = renderSpec(spec, catalog)
      return { html, blocks: spec.blocks.length }
    } catch (e) {
      return reply.status(400).send({ error: `Rendu impossible: ${(e as Error).message}` })
    }
  })

  /* ═══════════ Projets (drafts) ═══════════ */

  app.get('/api/v1/drafts', async (req, reply) => {
    const auth = await requireAuth(req, reply)
    if (!auth) return
    const rows = db.prepare('SELECT * FROM drafts WHERE user_id = ? ORDER BY updated_at DESC LIMIT 200').all(auth.user.id) as DraftRow[]
    return { drafts: rows.map(draftSummary) }
  })

  app.post('/api/v1/drafts', async (req, reply) => {
    const auth = await requireAuth(req, reply)
    if (!auth) return
    const b = req.body as { title?: string; html?: string; spec?: unknown; status?: string } ?? {}
    const title = String(b.title || '').trim()
    if (!title || title.length > 120) return reply.status(400).send({ error: 'titre requis (120 max)' })
    if (typeof b.html !== 'string' || !isReasonableDraftHtml(b.html)) {
      return reply.status(400).send({ error: 'html requis (400 ko max)' })
    }
    const count = (db.prepare('SELECT COUNT(*) AS n FROM drafts WHERE user_id = ?').get(auth.user.id) as { n: number }).n
    if (count >= MAX_DRAFTS) return reply.status(409).send({ error: `${MAX_DRAFTS} projets maximum` })
    const status = typeof b.status === 'string' && DRAFT_STATUSES.has(b.status) ? b.status : 'brouillon'
    const id = uuid()
    const t = now()
    const spec = b.spec === undefined || b.spec === null ? null : JSON.stringify(b.spec)
    db.prepare('INSERT INTO drafts (id, user_id, title, status, html, spec, updated_by, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?)')
      .run(id, auth.user.id, title, status, sanitizeDraftHtml(b.html), spec, auth.via === 'key' ? 'agent' : 'web', t, t)
    const row = db.prepare('SELECT * FROM drafts WHERE id = ?').get(id) as DraftRow
    return reply.status(201).send({ draft: draftOut(row) })
  })

  app.get('/api/v1/drafts/:id', async (req, reply) => {
    const auth = await requireAuth(req, reply)
    if (!auth) return
    const row = db.prepare('SELECT * FROM drafts WHERE id = ? AND user_id = ?')
      .get((req.params as { id: string }).id, auth.user.id) as DraftRow | undefined
    if (!row) return reply.status(404).send({ error: 'Projet introuvable' })
    return { draft: draftOut(row) }
  })

  app.patch('/api/v1/drafts/:id', async (req, reply) => {
    const auth = await requireAuth(req, reply)
    if (!auth) return
    const id = (req.params as { id: string }).id
    const row = db.prepare('SELECT * FROM drafts WHERE id = ? AND user_id = ?').get(id, auth.user.id) as DraftRow | undefined
    if (!row) return reply.status(404).send({ error: 'Projet introuvable' })
    const b = req.body as { title?: string; html?: string; spec?: unknown; status?: string } ?? {}
    const title = b.title !== undefined ? String(b.title).trim() : row.title
    if (!title || title.length > 120) return reply.status(400).send({ error: 'titre invalide' })
    const html = b.html !== undefined ? b.html : row.html
    if (typeof html !== 'string' || !isReasonableDraftHtml(html)) {
      return reply.status(400).send({ error: 'html invalide (400 ko max)' })
    }
    const status = b.status !== undefined
      ? (DRAFT_STATUSES.has(String(b.status)) ? String(b.status) : row.status)
      : row.status
    const spec = 'spec' in b ? (b.spec === null ? null : JSON.stringify(b.spec)) : row.spec
    db.prepare('UPDATE drafts SET title=?, status=?, html=?, spec=?, updated_by=?, updated_at=? WHERE id=?')
      .run(title, status, sanitizeDraftHtml(html), spec, auth.via === 'key' ? 'agent' : 'web', now(), id)
    const fresh = db.prepare('SELECT * FROM drafts WHERE id = ?').get(id) as DraftRow
    return { draft: draftOut(fresh) }
  })

  app.delete('/api/v1/drafts/:id', async (req, reply) => {
    const auth = await requireAuth(req, reply)
    if (!auth) return
    const r = db.prepare('DELETE FROM drafts WHERE id = ? AND user_id = ?')
      .run((req.params as { id: string }).id, auth.user.id)
    if (r.changes === 0) return reply.status(404).send({ error: 'Projet introuvable' })
    return { ok: true }
  })

  /* ═══════════ Clés API (JWT uniquement) ═══════════ */

  app.get('/api/v1/keys', async (req, reply) => {
    const auth = await requireAuth(req, reply)
    if (!auth) return
    if (auth.via !== 'jwt') return reply.status(403).send({ error: 'Les clés se gèrent depuis le site' })
    const rows = db.prepare('SELECT id, name, key_prefix, scope, created_at, last_used_at, revoked_at FROM api_keys WHERE user_id = ? AND revoked_at IS NULL ORDER BY created_at DESC').all(auth.user.id)
    return { keys: rows }
  })

  app.post('/api/v1/keys', async (req, reply) => {
    const auth = await requireAuth(req, reply)
    if (!auth) return
    if (auth.via !== 'jwt') return reply.status(403).send({ error: 'Les clés se gèrent depuis le site' })
    const b = req.body as { name?: string } ?? {}
    const name = String(b.name || '').trim() || 'agent'
    if (name.length > 60) return reply.status(400).send({ error: 'nom trop long' })
    const active = (db.prepare('SELECT COUNT(*) AS n FROM api_keys WHERE user_id = ? AND revoked_at IS NULL').get(auth.user.id) as { n: number }).n
    if (active >= 10) return reply.status(409).send({ error: '10 clés actives maximum' })
    const k = generateApiKey()
    const id = uuid()
    db.prepare('INSERT INTO api_keys (id, user_id, name, key_prefix, key_hash, scope, created_at) VALUES (?,?,?,?,?,?,?)')
      .run(id, auth.user.id, name, k.prefix, k.hash, 'drafts rw render', now())
    return reply.status(201).send({ id, name, key: k.full, prefix: k.prefix, scope: 'drafts rw render', warning: 'Conservez cette clé maintenant, elle ne sera plus affichée.' })
  })

  app.delete('/api/v1/keys/:id', async (req, reply) => {
    const auth = await requireAuth(req, reply)
    if (!auth) return
    if (auth.via !== 'jwt') return reply.status(403).send({ error: 'Les clés se gèrent depuis le site' })
    const r = db.prepare('UPDATE api_keys SET revoked_at = ? WHERE id = ? AND user_id = ? AND revoked_at IS NULL')
      .run(now(), (req.params as { id: string }).id, auth.user.id)
    if (r.changes === 0) return reply.status(404).send({ error: 'Clé introuvable' })
    return { ok: true }
  })

  return app
}
