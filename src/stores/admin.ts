import { createSignal } from 'solid-js'

const ADMIN_KEY = 'artlequin_admin'

function loadAdmin(): boolean {
  try {
    return localStorage.getItem(ADMIN_KEY) === 'true'
  } catch { return false }
}

const [isAdmin, setIsAdmin] = createSignal(loadAdmin())

export function toggleAdmin() {
  const next = !isAdmin()
  setIsAdmin(next)
  localStorage.setItem(ADMIN_KEY, String(next))
}

export { isAdmin }
