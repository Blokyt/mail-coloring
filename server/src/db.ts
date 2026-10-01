/**
 * SQLite — stockage des projets, comptes et clés.
 *
 * Un seul fichier, mode WAL (lectures concurrentes sûres), dans le data dir
 * (volume persistant en prod). Schéma versionné par migrations simples,
 * rejouées idempotemment au boot.
 */
import Database from 'better-sqlite3'
import fs from 'node:fs'
import path from 'node:path'
import { config } from './config.js'

export interface UserRow {
  id: string
  username: string
  display_name: string | null
  portal_username: string | null
  password_hash: string
  created_at: string
}

export interface ApiKeyRow {
  id: string
  user_id: string
  name: string
  key_prefix: string
  key_hash: string
  scope: string
  created_at: string
  last_used_at: string | null
  revoked_at: string | null
}

export interface DraftRow {
  id: string
  user_id: string
  title: string
  status: string
  html: string
  spec: string | null
  updated_by: string
  created_at: string
  updated_at: string
}

export type DB = Database.Database

export function openDb(dataDir = config.dataDir): DB {
  fs.mkdirSync(dataDir, { recursive: true })
  const db = new Database(path.join(dataDir, 'mailcolorer.db'))
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  migrate(db)
  return db
}

function migrate(db: DB) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id              TEXT PRIMARY KEY,
      username        TEXT UNIQUE NOT NULL COLLATE NOCASE,
      display_name    TEXT,
      portal_username TEXT,
      password_hash   TEXT NOT NULL,
      created_at      TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS api_keys (
      id          TEXT PRIMARY KEY,
      user_id     TEXT NOT NULL REFERENCES users(id),
      name        TEXT NOT NULL,
      key_prefix  TEXT NOT NULL,
      key_hash    TEXT UNIQUE NOT NULL,
      scope       TEXT NOT NULL DEFAULT 'drafts rw render',
      created_at  TEXT NOT NULL,
      last_used_at TEXT,
      revoked_at  TEXT
    );
    CREATE TABLE IF NOT EXISTS drafts (
      id         TEXT PRIMARY KEY,
      user_id    TEXT NOT NULL REFERENCES users(id),
      title      TEXT NOT NULL,
      status     TEXT NOT NULL DEFAULT 'brouillon',
      html       TEXT NOT NULL DEFAULT '',
      spec       TEXT,
      updated_by TEXT NOT NULL DEFAULT 'web',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_drafts_user ON drafts(user_id, updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_keys_hash ON api_keys(key_hash);
  `)
}

export const now = () => new Date().toISOString()
