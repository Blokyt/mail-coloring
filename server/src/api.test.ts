/**
 * Tests d'intégration de l'API — fastify.inject + SQLite temporaire.
 * Le parcours complet d'un agent y est rejoué : compte, clé, rendu,
 * projets multi-sessions, sanitize, MCP.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { openDb, type DB } from './db.js'
import { buildApp } from './routes.js'
import { registerMcpRoutes } from './mcp.js'
import { generateApiKey, hashPassword } from './auth.js'
import type { FastifyInstance } from 'fastify'

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

let app: FastifyInstance
let db: DB
let dataDir: string

beforeAll(() => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mailcolorer-test-'))
  db = openDb(dataDir)
  app = buildApp({ db, catalogPath: path.join(REPO, 'public/admin-data.json'), authRateLimit: 1000 })
  registerMcpRoutes(app, db, path.join(REPO, 'public/admin-data.json'))
})

afterAll(() => {
  db.close()
  fs.rmSync(dataDir, { recursive: true, force: true })
})

async function register(username = 'vicente', password = 'motdepasse-long') {
  const r = await app.inject({ method: 'POST', url: '/api/v1/auth/register', payload: { username, password } })
  expect(r.statusCode).toBe(200)
  return r.json() as { token: string; user: { id: string; username: string } }
}

const authHeaders = (token: string) => ({ authorization: `Bearer ${token}` })

describe('Santé & catalogue', () => {
  it('health répond', async () => {
    const r = await app.inject({ method: 'GET', url: '/api/v1/health' })
    expect(r.statusCode).toBe(200)
    expect(r.json().ok).toBe(true)
  })

  it('catalogue public : effets du site', async () => {
    const r = await app.inject({ method: 'GET', url: '/api/v1/effects' })
    expect(r.statusCode).toBe(200)
    const cat = r.json()
    expect(cat.colorEffects.arcenciel.colors.length).toBeGreaterThan(3)
    expect(cat.sizeEffects.montee.profile.length).toBeGreaterThan(10)
    expect(cat.bgEffects.arcenciel_bg).toBeDefined()
  })
})

describe('Comptes', () => {
  it('inscription puis login, mot de passe vérifié', async () => {
    const { token, user } = await register('alice')
    expect(user.username).toBe('alice')
    const me = await app.inject({ method: 'GET', url: '/api/v1/auth/me', headers: authHeaders(token) })
    expect(me.json().user.username).toBe('alice')

    const bad = await app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { username: 'alice', password: 'faux' } })
    expect(bad.statusCode).toBe(401)

    const good = await app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { username: 'alice', password: 'motdepasse-long' } })
    expect(good.statusCode).toBe(200)
  })

  it('username dupliqué refusé, mot de passe trop court refusé', async () => {
    const dup = await app.inject({ method: 'POST', url: '/api/v1/auth/register', payload: { username: 'alice', password: 'motdepasse-long' } })
    expect(dup.statusCode).toBe(409)
    const short = await app.inject({ method: 'POST', url: '/api/v1/auth/register', payload: { username: 'bob', password: 'court' } })
    expect(short.statusCode).toBe(400)
  })
})

describe('Clés API', () => {
  it('création par JWT, usage par clé, révocation', async () => {
    const { token, user } = await register('carole')
    const created = await app.inject({ method: 'POST', url: '/api/v1/keys', headers: authHeaders(token), payload: { name: 'agent mac' } })
    expect(created.statusCode).toBe(201)
    const key = created.json().key as string
    expect(key.startsWith('mc_')).toBe(true)

    // La clé s'utilise pour /render
    const render = await app.inject({
      method: 'POST', url: '/api/v1/render', headers: { 'x-api-key': key },
      payload: { blocks: [{ text: 'Salut', colorEffect: 'arcenciel' }] },
    })
    expect(render.statusCode).toBe(200)
    expect(render.json().html).toContain('<span')

    // last_used_at tracé
    const keys = await app.inject({ method: 'GET', url: '/api/v1/keys', headers: authHeaders(token) })
    expect(keys.json().keys[0].last_used_at).toBeTruthy()

    // Une clé ne crée pas de clé
    const forbidden = await app.inject({ method: 'POST', url: '/api/v1/keys', headers: { 'x-api-key': key }, payload: {} })
    expect(forbidden.statusCode).toBe(403)

    // Révocation
    const revoked = await app.inject({ method: 'DELETE', url: `/api/v1/keys/${created.json().id}`, headers: authHeaders(token) })
    expect(revoked.statusCode).toBe(200)
    const after = await app.inject({
      method: 'POST', url: '/api/v1/render', headers: { 'x-api-key': key },
      payload: { blocks: [{ text: 'Salut' }] },
    })
    expect(after.statusCode).toBe(401)
    expect(user.id).toBeTruthy()
  })
})

describe('Projets (drafts)', () => {
  it('cycle de vie complet, isolation par compte, sans écraser les autres', async () => {
    const a = await register('hugo')
    const b = await register('ines')
    const hA = authHeaders(a.token)
    const hB = authHeaders(b.token)

    const c1 = await app.inject({ method: 'POST', url: '/api/v1/drafts', headers: hA, payload: { title: 'Soirée BDA', html: '<p>premier</p>' } })
    expect(c1.statusCode).toBe(201)
    const c2 = await app.inject({ method: 'POST', url: '/api/v1/drafts', headers: hA, payload: { title: 'Bilan asso', html: '<p>deuxieme</p>' } })
    expect(c2.statusCode).toBe(201)
    const id1 = c1.json().draft.id

    // Le compte B ne voit pas les projets de A
    const listB = await app.inject({ method: 'GET', url: '/api/v1/drafts', headers: hB })
    expect(listB.json().drafts.length).toBe(0)
    const readB = await app.inject({ method: 'GET', url: `/api/v1/drafts/${id1}`, headers: hB })
    expect(readB.statusCode).toBe(404)

    // Mise à jour : le projet 1 change, le projet 2 reste intact
    await app.inject({ method: 'PATCH', url: `/api/v1/drafts/${id1}`, headers: hA, payload: { html: '<p>modifie</p>', status: 'pret' } })
    const listA = await app.inject({ method: 'GET', url: '/api/v1/drafts', headers: hA })
    const drafts = listA.json().drafts
    expect(drafts.length).toBe(2)
    expect(drafts.find((d: { id: string }) => d.id === id1).status).toBe('pret')
    expect(drafts.find((d: { id: string }) => d.id === id1).updated_by).toBe('web')

    const d2 = await app.inject({ method: 'GET', url: `/api/v1/drafts/${c2.json().draft.id}`, headers: hA })
    expect(d2.json().draft.html).toBe('<p>deuxieme</p>')

    // Suppression
    const del = await app.inject({ method: 'DELETE', url: `/api/v1/drafts/${c2.json().draft.id}`, headers: hA })
    expect(del.statusCode).toBe(200)
    const listA2 = await app.inject({ method: 'GET', url: '/api/v1/drafts', headers: hA })
    expect(listA2.json().drafts.length).toBe(1)
  })

  it('updated_by = agent quand la clé API écrit', async () => {
    const a = await register('jacques')
    const key = (await app.inject({ method: 'POST', url: '/api/v1/keys', headers: authHeaders(a.token), payload: { name: 'k' } })).json().key
    const created = await app.inject({ method: 'POST', url: '/api/v1/drafts', headers: { 'x-api-key': key }, payload: { title: 'Par agent', html: '<p>x</p>' } })
    expect(created.json().draft.updated_by).toBe('agent')
  })

  it('HTML dangereux assaini', async () => {
    const a = await register('kevin')
    const created = await app.inject({
      method: 'POST', url: '/api/v1/drafts', headers: authHeaders(a.token),
      payload: { title: 'Piège', html: '<p onclick="boom()">ok</p><script>alert(1)</script><p>fin</p>' },
    })
    expect(created.statusCode).toBe(201)
    const html = created.json().draft.html
    expect(html).toContain('<p>ok</p>')
    expect(html).toContain('<p>fin</p>')
    expect(html).not.toContain('script')
    expect(html).not.toContain('onclick')
  })
})

describe('Rendu', () => {
  it('spec complète → HTML Outlook', async () => {
    const a = await register('lea')
    const r = await app.inject({
      method: 'POST', url: '/api/v1/render', headers: authHeaders(a.token),
      payload: {
        baseSize: 18,
        blocks: [
          { text: 'SOIRÉE', colorEffect: 'flamme', sizeEffect: 'montee', bold: true, decoration: { before: '🔥', after: '🔥' } },
          { text: 'Vendredi 20h, au sous-sol' },
          { text: '', colors: ['#000'] },
        ],
      },
    })
    expect(r.statusCode).toBe(200)
    const html = r.json().html
    expect((html.match(/<p /g) ?? []).length).toBe(3)
    expect(html).toContain('🔥')
    expect(html).toContain('font color=')
  })

  it('sans auth : refusé', async () => {
    const r = await app.inject({ method: 'POST', url: '/api/v1/render', payload: { blocks: [{ text: 'x' }] } })
    expect(r.statusCode).toBe(401)
  })

  it('spec invalide : refusée', async () => {
    const a = await register('margot')
    const r = await app.inject({ method: 'POST', url: '/api/v1/render', headers: authHeaders(a.token), payload: { blocks: [] } })
    expect(r.statusCode).toBe(400)
  })
})

describe('MCP (streamable HTTP, X-API-Key)', () => {
  it('initialize + tools/list + tools/call render', async () => {
    // Un utilisateur + une clé directements en base (pas de dépendance aux routes)
    const userId = '11111111-1111-1111-1111-111111111111'
    db.prepare('INSERT INTO users (id, username, display_name, portal_username, password_hash, created_at) VALUES (?,?,?,?,?,?)')
      .run(userId, 'agenttest', null, null, hashPassword('xxxxxxxx'), new Date().toISOString())
    const k = generateApiKey()
    db.prepare('INSERT INTO api_keys (id, user_id, name, key_prefix, key_hash, scope, created_at) VALUES (?,?,?,?,?,?,?)')
      .run('22222222-2222-2222-2222-222222222222', userId, 'test', k.prefix, k.hash, 'drafts rw render', new Date().toISOString())
    // Le protocole exige d'accepter les deux formats ; la réponse est du SSE
    // (event: message + data: {jsonrpc}) — comme avec les vrais clients.
    const headers = { 'x-api-key': k.full, 'content-type': 'application/json', accept: 'application/json, text/event-stream' }
    const parseSse = (body: string) => JSON.parse(body.replace(/^event: message\ndata: /, '').split('\n\n')[0])

    // initialize
    const init = await app.inject({ method: 'POST', url: '/api/v1/mcp', headers, payload: {
      jsonrpc: '2.0', id: 1, method: 'initialize',
      params: { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'test', version: '0' } },
    } })
    expect(init.statusCode).toBe(200)
    expect(parseSse(init.body).result.serverInfo.name).toBe('mailcolorer')

    // tools/list
    const tools = await app.inject({ method: 'POST', url: '/api/v1/mcp', headers, payload: { jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} } })
    const names = parseSse(tools.body).result.tools.map((t: { name: string }) => t.name)
    expect(names).toContain('mailcolorer_render')
    expect(names).toContain('mailcolorer_drafts_list')

    // tools/call render
    const call = await app.inject({ method: 'POST', url: '/api/v1/mcp', headers, payload: {
      jsonrpc: '2.0', id: 3, method: 'tools/call',
      params: { name: 'mailcolorer_render', arguments: { spec: { blocks: [{ text: 'Test MCP', colorEffect: 'ocean' }] } } },
    } })
    expect(call.statusCode).toBe(200)
    const result = JSON.parse(parseSse(call.body).result.content[0].text)
    expect(result.html).toContain('<span')
  })

  it('sans clé : 401', async () => {
    const r = await app.inject({ method: 'POST', url: '/api/v1/mcp', payload: { jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} } })
    expect(r.statusCode).toBe(401)
  })
})
