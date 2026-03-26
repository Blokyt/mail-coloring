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
  return next
}

export function activateAdmin() {
  setIsAdmin(true)
  localStorage.setItem(ADMIN_KEY, 'true')
}

export function deactivateAdmin() {
  setIsAdmin(false)
  localStorage.removeItem(ADMIN_KEY)
}

export { isAdmin }
