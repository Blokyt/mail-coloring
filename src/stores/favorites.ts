import { createSignal } from 'solid-js'

export interface FavoriteEffect {
  id: string
  type: 'color' | 'size' | 'custom-size'
  label: string
  /** Pour custom-size : profil normalisé */
  profile?: number[]
  /** Pour custom-size : expression math d'origine */
  mathExpr?: string
}

const STORAGE_KEY = 'artlequin_favorites'
const HISTORY_KEY = 'artlequin_history'

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch { return fallback }
}

// Favoris
const [favorites, setFavorites] = createSignal<FavoriteEffect[]>(
  loadFromStorage(STORAGE_KEY, [])
)

// Historique (derniers 8 utilisés)
const [history, setHistory] = createSignal<FavoriteEffect[]>(
  loadFromStorage(HISTORY_KEY, [])
)

function saveFavorites(favs: FavoriteEffect[]) {
  setFavorites(favs)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(favs))
}

function saveHistory(hist: FavoriteEffect[]) {
  setHistory(hist)
  localStorage.setItem(HISTORY_KEY, JSON.stringify(hist))
}

export function addFavorite(effect: FavoriteEffect) {
  const current = favorites()
  if (current.some(f => f.id === effect.id && f.type === effect.type)) return
  saveFavorites([...current, effect])
}

export function removeFavorite(id: string, type: string) {
  saveFavorites(favorites().filter(f => !(f.id === id && f.type === type)))
}

export function renameFavorite(id: string, type: string, newLabel: string) {
  saveFavorites(favorites().map(f =>
    f.id === id && f.type === type ? { ...f, label: newLabel } : f
  ))
}

export function isFavorite(id: string, type: string): boolean {
  return favorites().some(f => f.id === id && f.type === type)
}

export function pushHistory(effect: FavoriteEffect) {
  const current = history().filter(f => !(f.id === effect.id && f.type === effect.type))
  saveHistory([effect, ...current].slice(0, 8))
}

// ── Font favorites ──
const FONT_FAVS_KEY = 'artlequin_font_favs'
const [fontFavorites, setFontFavorites] = createSignal<string[]>(
  loadFromStorage(FONT_FAVS_KEY, [])
)

export function addFontFavorite(font: string) {
  const current = fontFavorites()
  if (current.includes(font)) return
  const updated = [...current, font]
  setFontFavorites(updated)
  localStorage.setItem(FONT_FAVS_KEY, JSON.stringify(updated))
}

export function removeFontFavorite(font: string) {
  const updated = fontFavorites().filter(f => f !== font)
  setFontFavorites(updated)
  localStorage.setItem(FONT_FAVS_KEY, JSON.stringify(updated))
}

// ── Size favorites ──
const SIZE_FAVS_KEY = 'artlequin_size_favs'
const [sizeFavorites, setSizeFavorites] = createSignal<number[]>(
  loadFromStorage(SIZE_FAVS_KEY, [])
)

export function addSizeFavorite(size: number) {
  const current = sizeFavorites()
  if (current.includes(size)) return
  const updated = [...current, size]
  setSizeFavorites(updated)
  localStorage.setItem(SIZE_FAVS_KEY, JSON.stringify(updated))
}

export function removeSizeFavorite(size: number) {
  const updated = sizeFavorites().filter(s => s !== size)
  setSizeFavorites(updated)
  localStorage.setItem(SIZE_FAVS_KEY, JSON.stringify(updated))
}

export { favorites, history, fontFavorites, sizeFavorites }
