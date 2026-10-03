/**
 * Client API distante (compte, projets, clés) — consommé par les panneaux
 * du site. L'API vit derrière /api/v1 (proxy Vite en dev, nginx en prod) ;
 * l'agent, lui, passe par l'API ou le MCP avec sa clé, jamais par ici.
 */

const TOKEN_KEY = 'artlequin_token'

export interface RemoteUser {
  id: string
  username: string
  display_name: string | null
  portal_username: string | null
}

export interface DraftSummary {
  id: string
  title: string
  status: string
  updated_by: string
  created_at: string
  updated_at: string
}

export interface DraftFull extends DraftSummary {
  html: string
  spec: unknown
}

export interface ApiKeyInfo {
  id: string
  name: string
  key_prefix: string
  scope: string
  created_at: string
  last_used_at: string | null
  revoked_at: string | null
}

export class RemoteError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export function getToken(): string | null {
  try { return localStorage.getItem(TOKEN_KEY) } catch { return null }
}

export function setToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch { /* stockage indisponible : mode anonyme */ }
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  const token = getToken()
  if (token) headers['authorization'] = `Bearer ${token}`
  const res = await fetch(`/api/v1${path}`, { ...init, headers })
  if (!res.ok) {
    let msg = `Erreur ${res.status}`
    try { msg = (await res.json()).error || msg } catch { /* corps vide */ }
    throw new RemoteError(res.status, msg)
  }
  return res.json() as Promise<T>
}

export const remote = {
  register(username: string, password: string, display_name?: string) {
    return api<{ token: string; user: RemoteUser }>('/auth/register', {
      method: 'POST', body: JSON.stringify({ username, password, display_name }),
    })
  },
  login(username: string, password: string) {
    return api<{ token: string; user: RemoteUser }>('/auth/login', {
      method: 'POST', body: JSON.stringify({ username, password }),
    })
  },
  me() {
    return api<{ user: RemoteUser; via: string }>('/auth/me')
  },
  changePassword(current: string, next: string) {
    return api<{ ok: boolean }>('/auth/password', {
      method: 'PATCH', body: JSON.stringify({ current, next }),
    })
  },
  keys() {
    return api<{ keys: ApiKeyInfo[] }>('/keys')
  },
  createKey(name: string) {
    return api<{ id: string; name: string; key: string; prefix: string }>('/keys', {
      method: 'POST', body: JSON.stringify({ name }),
    })
  },
  revokeKey(id: string) {
    return api<{ ok: boolean }>(`/keys/${id}`, { method: 'DELETE' })
  },
  drafts() {
    return api<{ drafts: DraftSummary[] }>('/drafts')
  },
  draft(id: string) {
    return api<{ draft: DraftFull }>(`/drafts/${id}`)
  },
  createDraft(title: string, html: string, status?: string) {
    return api<{ draft: DraftFull }>('/drafts', {
      method: 'POST', body: JSON.stringify({ title, html, status }),
    })
  },
  updateDraft(id: string, patch: { title?: string; html?: string; status?: string }) {
    return api<{ draft: DraftFull }>(`/drafts/${id}`, {
      method: 'PATCH', body: JSON.stringify(patch),
    })
  },
  deleteDraft(id: string) {
    return api<{ ok: boolean }>(`/drafts/${id}`, { method: 'DELETE' })
  },
}
