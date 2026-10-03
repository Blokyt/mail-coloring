/**
 * Facade MCP — le protocole est du plumbing, la logique vit dans l'API.
 *
 * Endpoint streamable HTTP (stateless) : POST /api/v1/mcp, authentifié par
 * X-API-Key (jamais par JWT : un agent n'a pas de session). Chaque requête
 * crée son transport ; les outils délèguent aux mêmes fonctions que les
 * routes REST (une seule vérité).
 *
 * Les outils sont préfixés mailcolorer_ : dans une liste de dizaines d'outils,
 * le domaine doit se lire dans le nom.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { z } from 'zod'
import crypto from 'node:crypto'
import type { FastifyInstance } from 'fastify'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { DB, DraftRow, UserRow } from './db.js'
import { now } from './db.js'
import { resolveAuth } from './auth.js'
import { sanitizeDraftHtml, isReasonableDraftHtml } from './sanitize.js'
import { loadCatalog } from './catalog.js'
import { renderSpec, type EffectsCatalog, type RenderSpec } from '../../src/engine/render.js'

const DRAFT_STATUSES = ['brouillon', 'pret', 'envoye'] as const

const blockSchema = z.object({
  text: z.string().optional(),
  html: z.string().optional(),
  colorEffect: z.string().optional(),
  colors: z.array(z.string()).optional(),
  bgEffect: z.string().optional(),
  bgColors: z.array(z.string()).optional(),
  sizeEffect: z.string().optional(),
  profile: z.array(z.number()).optional(),
  mathExpr: z.string().optional(),
  bold: z.boolean().optional(),
  italic: z.boolean().optional(),
  underline: z.boolean().optional(),
  strike: z.boolean().optional(),
  font: z.string().optional(),
  baseSize: z.number().optional(),
  link: z.string().optional(),
  decoration: z.object({ before: z.string().optional(), after: z.string().optional() }).optional(),
})

const specSchema = z.object({
  baseSize: z.number().optional(),
  font: z.string().optional(),
  blocks: z.array(blockSchema).min(1),
})

function draftSummary(d: DraftRow) {
  return { id: d.id, title: d.title, status: d.status, updated_by: d.updated_by, created_at: d.created_at, updated_at: d.updated_at }
}

function buildMcpServer(db: DB, user: UserRow, catalog: EffectsCatalog): McpServer {
  const server = new McpServer({ name: 'mailcolorer', version: '0.1.0' })

  server.registerTool('mailcolorer_effects_catalog', {
    title: 'Catalogue d’effets du colorieur',
    description: 'Liste les effets de couleurs (texte), de fonds (id + suffixe _bg) et de tailles disponibles, avec leurs palettes et profils. À consulter avant de rendre un mail.',
    inputSchema: {},
  }, async () => ({
    content: [{
      type: 'text',
      text: JSON.stringify({
        baseSizeDefault: 18,
        colorEffects: catalog.colorEffects,
        bgEffects: Object.fromEntries(Object.entries(catalog.colorEffects).map(([id, e]) => [`${id}_bg`, e])),
        sizeEffects: catalog.sizeEffects,
      }),
    }],
  }))

  server.registerTool('mailcolorer_render', {
    title: 'Rendre un mail coloré',
    description: 'Rend une spec en HTML Outlook (un graphème = un span, mêmes effets que le site). Retourne le HTML final, prêt à coller dans Outlook, et l’enregistre optionnellement comme projet.',
    inputSchema: {
      spec: specSchema,
      save_as: z.string().optional().describe('Titre du projet à créer ou mettre à jour avec ce HTML'),
    },
  }, async ({ spec, save_as }) => {
    const html = renderSpec(spec as RenderSpec, catalog)
    let saved: string | undefined
    if (save_as) {
      const existing = db.prepare('SELECT * FROM drafts WHERE user_id = ? AND title = ?').get(user.id, save_as) as DraftRow | undefined
      const t = now()
      if (existing) {
        db.prepare('UPDATE drafts SET html=?, spec=?, status=?, updated_by=?, updated_at=? WHERE id=?')
          .run(sanitizeDraftHtml(html), JSON.stringify(spec), 'pret', 'agent', t, existing.id)
        saved = existing.id
      } else {
        const id = crypto.randomUUID()
        db.prepare('INSERT INTO drafts (id, user_id, title, status, html, spec, updated_by, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?)')
          .run(id, user.id, save_as, 'pret', sanitizeDraftHtml(html), JSON.stringify(spec), 'agent', t, t)
        saved = id
      }
    }
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({ html, saved_draft_id: saved ?? null, note: saved ? 'Projet enregistré : ouvre mail-colorer.rezal-mdm.com → Mes projets pour le relire, l’ajuster et le copier vers Outlook.' : null }),
      }],
    }
  })

  server.registerTool('mailcolorer_drafts_list', {
    title: 'Lister mes projets',
    description: 'Projets de mails de l’utilisateur (titre, statut, date), du plus récent au plus ancien.',
    inputSchema: {},
  }, async () => {
    const rows = db.prepare('SELECT * FROM drafts WHERE user_id = ? ORDER BY updated_at DESC LIMIT 200').all(user.id) as DraftRow[]
    return { content: [{ type: 'text', text: JSON.stringify({ drafts: rows.map(draftSummary) }) }] }
  })

  server.registerTool('mailcolorer_draft_get', {
    title: 'Lire un projet',
    description: 'Retourne un projet complet (HTML + spec).',
    inputSchema: { id: z.string() },
  }, async ({ id }) => {
    const row = db.prepare('SELECT * FROM drafts WHERE id = ? AND user_id = ?').get(id, user.id) as DraftRow | undefined
    if (!row) return { content: [{ type: 'text', text: JSON.stringify({ error: 'Projet introuvable' }) }], isError: true }
    return { content: [{ type: 'text', text: JSON.stringify({ draft: { ...draftSummary(row), html: row.html, spec: row.spec ? JSON.parse(row.spec) : null } }) }] }
  })

  server.registerTool('mailcolorer_draft_save', {
    title: 'Enregistrer un projet',
    description: 'Crée ou met à jour un projet par titre (id optionnel). Ne touche jamais aux autres projets.',
    inputSchema: {
      title: z.string(),
      html: z.string().optional(),
      spec: specSchema.optional(),
      status: z.enum(DRAFT_STATUSES).optional(),
      id: z.string().optional().describe('Id du projet à mettre à jour ; sinon, mise à jour par titre, création si nouveau'),
    },
  }, async ({ title, html, spec, status, id }) => {
    const effectiveHtml = html ?? (spec ? renderSpec(spec as RenderSpec, catalog) : undefined)
    if (!effectiveHtml || !isReasonableDraftHtml(effectiveHtml)) {
      return { content: [{ type: 'text', text: JSON.stringify({ error: 'html ou spec requis' }) }], isError: true }
    }
    const clean = sanitizeDraftHtml(effectiveHtml)
    const t = now()
    let target = id
      ? (db.prepare('SELECT id FROM drafts WHERE id = ? AND user_id = ?').get(id, user.id) as { id: string } | undefined)?.id
      : (db.prepare('SELECT id FROM drafts WHERE user_id = ? AND title = ?').get(user.id, title) as { id: string } | undefined)?.id
    if (target) {
      db.prepare('UPDATE drafts SET title=?, status=COALESCE(?,status), html=?, spec=?, updated_by=?, updated_at=? WHERE id=?')
        .run(title, status ?? null, clean, spec ? JSON.stringify(spec) : null, 'agent', t, target)
    } else {
      target = crypto.randomUUID()
      db.prepare('INSERT INTO drafts (id, user_id, title, status, html, spec, updated_by, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?)')
        .run(target, user.id, title, status ?? 'brouillon', clean, spec ? JSON.stringify(spec) : null, 'agent', t, t)
    }
    return { content: [{ type: 'text', text: JSON.stringify({ id: target, ok: true }) }] }
  })

  server.registerTool('mailcolorer_draft_delete', {
    title: 'Supprimer un projet',
    description: 'Supprime un projet par id. Irréversible.',
    inputSchema: { id: z.string() },
  }, async ({ id }) => {
    const r = db.prepare('DELETE FROM drafts WHERE id = ? AND user_id = ?').run(id, user.id)
    return { content: [{ type: 'text', text: JSON.stringify({ ok: r.changes > 0 }) }] }
  })

  return server
}

/**
 * Monte les routes MCP (stateless) avec auth X-API-Key — aux deux chemins,
 * comme les routes REST (cf. routes.ts : Traefik strippe le PathPrefix).
 */
export function registerMcpRoutes(app: FastifyInstance, db: DB, catalogPath?: string) {
  const catalog = loadCatalog(catalogPath)

  const handle = async (req: { raw: IncomingMessage; headers: Record<string, unknown>; body: unknown }, reply: { raw: ServerResponse; hijack: () => void; status: (c: number) => void }) => {
    const auth = resolveAuth(db, req.headers)
    if (!auth || auth.via !== 'key') {
      reply.hijack()
      reply.raw.writeHead(401, { 'content-type': 'application/json' })
      reply.raw.end(JSON.stringify({ jsonrpc: '2.0', error: { code: -32001, message: 'X-API-Key requis' }, id: null }))
      return
    }
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined })
    const server = buildMcpServer(db, auth.user, catalog)
    await server.connect(transport)
    transport.onclose = () => { void server.close() }
    reply.hijack()
    await transport.handleRequest(req.raw, reply.raw, req.body)
  }

  const mount = (scoped: FastifyInstance) => {
    scoped.post('/mcp', async (req, reply) => { await handle(req as never, reply as never) })
    scoped.delete('/mcp', async (_req, reply) => reply.status(405).send({ error: 'Stateless: pas de session' }))
    scoped.get('/mcp', async (_req, reply) => reply.status(405).send({ error: 'Stateless: pas de flux SSE' }))
  }
  void app.register(mount, { prefix: '/api/v1' })
  void app.register(mount)
}
