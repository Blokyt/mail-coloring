/**
 * Configuration du serveur — tout vient de l'environnement, avec des
 * défauts sûrs pour le dev local. Aucun secret n'est codé ici.
 */
import fs from 'node:fs'
import crypto from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))

export const config = {
  port: Number(process.env.PORT || 8030),
  host: process.env.HOST || '127.0.0.1',
  dataDir: process.env.DATA_DIR || path.resolve(here, '../../../data'),
  /** Catalogue d'effets : admin-data.json du front (une seule vérité).
   *  Compilé vers dist/server/src/ → le repo est à quatre niveaux au-dessus. */
  catalogPath: process.env.CATALOG_PATH || path.resolve(here, '../../../../public/admin-data.json'),
  /** Origine autorisée pour l'API navigateur (CORS) ; vide = même origine */
  corsOrigin: process.env.CORS_ORIGIN || '',
  jwtSecret: '' as string,
}

/** Le secret JWT vit dans le data dir (généré au premier boot, 0600) */
export function ensureJwtSecret(): string {
  if (config.jwtSecret) return config.jwtSecret
  fs.mkdirSync(config.dataDir, { recursive: true })
  const f = path.join(config.dataDir, 'jwt.secret')
  if (!fs.existsSync(f)) {
    // crypto.randomBytes : jamais readFileSync('/dev/urandom'), qui ne se
    // termine jamais (flux infini) — le boot y pendait tout entier.
    const secret = crypto.randomBytes(32).toString('hex')
    fs.writeFileSync(f, secret, { mode: 0o600 })
  }
  config.jwtSecret = fs.readFileSync(f, 'utf8').trim()
  return config.jwtSecret
}
