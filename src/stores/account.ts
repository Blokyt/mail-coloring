/**
 * État du compte distant — un signal partagé entre les panneaux (compte,
 * projets, header). Au boot, si un token existe, on vérifie qu'il vit
 * encore ; sinon mode anonyme comme avant.
 */
import { createSignal } from 'solid-js'
import { getToken, remote, setToken, type RemoteUser } from '../api/remote'

const [user, setUser] = createSignal<RemoteUser | null>(null)
const [checked, setChecked] = createSignal(false)

/** Vérifie le token au démarrage (une fois) */
export async function restoreSession() {
  if (checked() || !getToken()) { setChecked(true); return }
  try {
    const { user: u } = await remote.me()
    setUser(u)
  } catch {
    setToken(null)
  }
  setChecked(true)
}

export async function login(username: string, password: string) {
  const r = await remote.login(username, password)
  setToken(r.token)
  setUser(r.user)
}

export async function register(username: string, password: string, display_name?: string) {
  const r = await remote.register(username, password, display_name)
  setToken(r.token)
  setUser(r.user)
}

export function logout() {
  setToken(null)
  setUser(null)
}

export { user }
