/**
 * Authentification — deux surfaces, un seul compte.
 *
 *  - Web : JWT (Authorization: Bearer), 30 jours.
 *  - Agent/CLI : clé API personnelle (X-API-Key), comme la brique clés du
 *    portail (2026-09-25) : la valeur en clair n'est JAMAIS stockée, seu le
 *    SHA-256 ; le préfixe sert d'affichage ; révocation indépendante.
 *
 * Les mots de passe : scrypt (node:crypto), sel aléatoire par compte.
 * Le champ portal_username prépare la liaison SSO portail (v2).
 */
import crypto from 'node:crypto'
import type { ApiKeyRow, DB, UserRow } from './db.js'
import { now } from './db.js'
import { ensureJwtSecret } from './config.js'

/* ── Mots de passe ── */

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.scryptSync(password, salt, 32).toString('hex')
  return `scrypt$${salt}$${hash}`
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, salt, hash] = stored.split('$')
  if (scheme !== 'scrypt' || !salt || !hash) return false
  const test = crypto.scryptSync(password, salt, 32).toString('hex')
  return crypto.timingSafeEqual(Buffer.from(test, 'hex'), Buffer.from(hash, 'hex'))
}

/* ── Clés API ── */

export function generateApiKey(): { full: string; prefix: string; hash: string } {
  const full = 'mc_' + crypto.randomBytes(32).toString('hex')
  return { full, prefix: full.slice(0, 12), hash: sha256(full) }
}

export function sha256(s: string): string {
  return crypto.createHash('sha256').update(s).digest('hex')
}

export function authenticateKey(db: DB, key: string): ApiKeyRow | null {
  if (!key || key.length < 10) return null
  const row = db.prepare(
    'SELECT * FROM api_keys WHERE key_hash = ? AND revoked_at IS NULL',
  ).get(sha256(key)) as ApiKeyRow | undefined
  if (!row) return null
  db.prepare('UPDATE api_keys SET last_used_at = ? WHERE id = ?').run(now(), row.id)
  return row
}

/* ── JWT (HMAC-SHA256, maison mais standard) ── */

const b64url = (buf: Buffer) => buf.toString('base64url')

export function signJwt(userId: string): string {
  const secret = ensureJwtSecret()
  const header = b64url(Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })))
  const iat = Math.floor(Date.now() / 1000)
  const payload = b64url(Buffer.from(JSON.stringify({ uid: userId, iat, exp: iat + 30 * 86400 })))
  const sig = b64url(crypto.createHmac('sha256', secret).update(`${header}.${payload}`).digest())
  return `${header}.${payload}.${sig}`
}

export function verifyJwt(token: string): string | null {
  const secret = ensureJwtSecret()
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const expect = b64url(crypto.createHmac('sha256', secret).update(`${parts[0]}.${parts[1]}`).digest())
  if (expect !== parts[2]) return null
  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString())
    if (typeof payload.uid !== 'string') return null
    if (typeof payload.exp === 'number' && payload.exp < Date.now() / 1000) return null
    return payload.uid
  } catch {
    return null
  }
}

/* ── Résolution de la requête → utilisateur ── */

export interface Auth {
  user: UserRow
  via: 'jwt' | 'key'
  keyId?: string
}

export function resolveAuth(db: DB, headers: Record<string, unknown>): Auth | null {
  const apiKey = String(headers['x-api-key'] || '')
  if (apiKey) {
    const key = authenticateKey(db, apiKey)
    if (!key) return null
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(key.user_id) as UserRow | undefined
    if (!user) return null
    return { user, via: 'key', keyId: key.id }
  }
  const auth = String(headers['authorization'] || '')
  if (auth.startsWith('Bearer ')) {
    const uid = verifyJwt(auth.slice(7))
    if (!uid) return null
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(uid) as UserRow | undefined
    if (!user) return null
    return { user, via: 'jwt' }
  }
  return null
}
