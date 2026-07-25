import { createSignal } from 'solid-js'
import { getEffectiveColorEffects, getEffectiveBgEffects } from '../engine/effects'
import { adminData } from './admin-data'

// ── Types ──

export type WorkshopSource = 'base' | 'online' | 'perso'

export type EffectType = 'color' | 'size' | 'custom-size' | 'custom-color'

export interface WorkshopEffect {
  id: string
  type: EffectType
  label: string
  source: WorkshopSource
  colors?: string[]
  /** Forme normalisée [0,1] — JAMAIS des pixels. Voir normalizeProfile(). */
  profile?: number[]
  mathExpr?: string
  mathParams?: { a: number; b: number; c: number }
  /** Pour custom-color : palette definie par l'utilisateur */
  customColors?: string[]
  colorMode?: 'text' | 'bg'
  isFavorite: boolean
  createdAt?: number
}

// ── Storage keys ──

const BASE_FAVS_KEY = 'artlequin_base_favs'
const PERSO_KEY = 'artlequin_workshop_perso'
const HISTORY_KEY = 'artlequin_history'
const OLD_FAVORITES_KEY = 'artlequin_favorites'

// ── Helpers ──

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch { return fallback }
}

// ── Migration depuis l'ancien format ──

function migrateOldFavorites() {
  const raw = localStorage.getItem(OLD_FAVORITES_KEY)
  if (!raw) return
  try {
    const old: Array<{ id: string; type: string; label: string; profile?: number[]; mathExpr?: string }> = JSON.parse(raw)
    const baseIds: string[] = []
    const perso: WorkshopEffect[] = []

    for (const f of old) {
      if (f.type === 'custom-size') {
        perso.push({
          id: f.id,
          type: 'custom-size',
          label: f.label,
          source: 'perso',
          profile: f.profile,
          mathExpr: f.mathExpr,
          isFavorite: true,
          createdAt: Date.now(),
        })
      } else {
        baseIds.push(f.id)
      }
    }

    localStorage.setItem(BASE_FAVS_KEY, JSON.stringify(baseIds))
    if (perso.length > 0) {
      localStorage.setItem(PERSO_KEY, JSON.stringify(perso))
    }
    localStorage.removeItem(OLD_FAVORITES_KEY)
  } catch { /* ignore */ }
}

/**
 * Migration des profils "offsets px" vers la forme [0,1].
 *
 * Avant, normalizeProfile(values, amplitude) cuisait l'amplitude du slider
 * dans le tableau au moment de la création : un effet dessiné avec le slider
 * à 18 stockait 0..18, le même dessiné à 40 stockait 0..40. Deux effets
 * différents pour un même dessin, et une double multiplication par
 * l'amplitude selon le chemin de rendu.
 *
 * Ces profils avaient toujours min=0 et max=amplitude : diviser par le max
 * restitue exactement la forme d'origine.
 */
function migrateProfilesToShape() {
  const keys = [PERSO_KEY, HISTORY_KEY]
  for (const key of keys) {
    const list = load<Array<WorkshopEffect & { rawProfile?: boolean }>>(key, [])
    if (list.length === 0) continue
    let changed = false
    const migrated = list.map(e => {
      if (!e.profile || e.profile.length === 0) return e
      const max = Math.max(...e.profile)
      const min = Math.min(...e.profile)
      // Déjà une forme [0,1] et pas de drapeau legacy → rien à faire
      if (!e.rawProfile && max <= 1.0001 && min >= -0.0001) return e
      changed = true
      const range = max - min
      const { rawProfile: _drop, ...rest } = e
      return {
        ...rest,
        profile: range < 1e-10 ? e.profile.map(() => 0) : e.profile.map(v => (v - min) / range),
      }
    })
    if (changed) localStorage.setItem(key, JSON.stringify(migrated))
  }
}

// Run migrations
migrateOldFavorites()
migrateProfilesToShape()

// ── Signaux ──

const [baseFavIds, setBaseFavIds] = createSignal<Set<string>>(
  new Set(load<string[]>(BASE_FAVS_KEY, []))
)

const [persoEffects, setPersoEffects] = createSignal<WorkshopEffect[]>(
  load<WorkshopEffect[]>(PERSO_KEY, [])
)

const [onlineEffects, setOnlineEffects] = createSignal<WorkshopEffect[]>([])

const [history, setHistory] = createSignal<WorkshopEffect[]>(
  load<WorkshopEffect[]>(HISTORY_KEY, [])
)

// ── Persistence helpers ──

function saveBaseFavs(ids: Set<string>) {
  setBaseFavIds(ids)
  localStorage.setItem(BASE_FAVS_KEY, JSON.stringify([...ids]))
}

function savePerso(effects: WorkshopEffect[]) {
  setPersoEffects(effects)
  localStorage.setItem(PERSO_KEY, JSON.stringify(effects))
}

function saveHistory(hist: WorkshopEffect[]) {
  setHistory(hist)
  localStorage.setItem(HISTORY_KEY, JSON.stringify(hist))
}

// ── Getters ──

export function getBaseEffects(): WorkshopEffect[] {
  const favs = baseFavIds()
  const ad = adminData()
  // Effets couleur texte
  const effectiveColors = getEffectiveColorEffects(ad.colorEffects)
  const colors: WorkshopEffect[] = Object.entries(effectiveColors).map(([id, e]) => ({
    id,
    type: 'color' as const,
    label: e.name,
    source: 'base' as const,
    colors: e.colors,
    colorMode: 'text' as const,
    isFavorite: favs.has(id),
  }))
  // Effets couleur fond (auto-générés)
  const bgEffects = getEffectiveBgEffects(ad.colorEffects)
  const bgColors: WorkshopEffect[] = Object.entries(bgEffects).map(([id, e]) => ({
    id,
    type: 'color' as const,
    label: e.name,
    source: 'base' as const,
    colors: e.colors,
    colorMode: 'bg' as const,
    isFavorite: favs.has(id),
  }))
  // Effets taille depuis admin data (profils + noms)
  const sizes: WorkshopEffect[] = Object.entries(ad.sizeEffects ?? {}).map(([id, e]) => ({
    id,
    type: 'size' as const,
    label: e.name,
    source: 'base' as const,
    profile: e.profile,
    isFavorite: favs.has(id),
  }))
  return [...colors, ...bgColors, ...sizes]
}

export function getPersoEffects(): WorkshopEffect[] {
  return persoEffects()
}

export function getOnlineEffects(): WorkshopEffect[] {
  return onlineEffects()
}

export function getAllEffects(): WorkshopEffect[] {
  return [...getBaseEffects(), ...getOnlineEffects(), ...getPersoEffects()]
}

export function getFavorites(): WorkshopEffect[] {
  return getAllEffects().filter(e => e.isFavorite)
}

// ── Mutations ──

export function toggleFavorite(id: string, source: WorkshopSource) {
  if (source === 'base') {
    const next = new Set(baseFavIds())
    if (next.has(id)) next.delete(id)
    else next.add(id)
    saveBaseFavs(next)
  } else if (source === 'perso') {
    savePerso(persoEffects().map(e =>
      e.id === id ? { ...e, isFavorite: !e.isFavorite } : e
    ))
  }
  // online: TODO quand Supabase sera connecte
}

export function isFavorite(id: string, source: WorkshopSource): boolean {
  if (source === 'base') return baseFavIds().has(id)
  if (source === 'perso') return persoEffects().some(e => e.id === id && e.isFavorite)
  return false
}

export function addPersoEffect(effect: Omit<WorkshopEffect, 'source' | 'isFavorite' | 'createdAt'>) {
  const full: WorkshopEffect = {
    ...effect,
    source: 'perso',
    isFavorite: false,
    createdAt: Date.now(),
  }
  savePerso([...persoEffects(), full])
}

export function removePersoEffect(id: string) {
  savePerso(persoEffects().filter(e => e.id !== id))
}

export function renamePersoEffect(id: string, newLabel: string) {
  savePerso(persoEffects().map(e =>
    e.id === id ? { ...e, label: newLabel } : e
  ))
}

export function pushHistory(effect: WorkshopEffect) {
  const current = history().filter(e => e.id !== effect.id)
  saveHistory([effect, ...current].slice(0, 8))
}

// ── Font & Size favorites (inchanges) ──

const FONT_FAVS_KEY = 'artlequin_font_favs'
const [fontFavorites, setFontFavorites] = createSignal<string[]>(
  load(FONT_FAVS_KEY, [])
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

const SIZE_FAVS_KEY = 'artlequin_size_favs'
const [sizeFavorites, setSizeFavorites] = createSignal<number[]>(
  load(SIZE_FAVS_KEY, [])
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

// ── Recents taille & police ──

const SIZE_RECENTS_KEY = 'artlequin_size_recents'
const [sizeRecents, setSizeRecents] = createSignal<number[]>(
  load(SIZE_RECENTS_KEY, [])
)

export function pushSizeRecent(size: number) {
  const updated = [size, ...sizeRecents().filter(s => s !== size)].slice(0, 3)
  setSizeRecents(updated)
  localStorage.setItem(SIZE_RECENTS_KEY, JSON.stringify(updated))
}

export function removeSizeRecent(size: number) {
  const updated = sizeRecents().filter(s => s !== size)
  setSizeRecents(updated)
  localStorage.setItem(SIZE_RECENTS_KEY, JSON.stringify(updated))
}

const FONT_RECENTS_KEY = 'artlequin_font_recents'
const [fontRecents, setFontRecents] = createSignal<string[]>(
  load(FONT_RECENTS_KEY, [])
)

export function pushFontRecent(font: string) {
  const updated = [font, ...fontRecents().filter(f => f !== font)].slice(0, 3)
  setFontRecents(updated)
  localStorage.setItem(FONT_RECENTS_KEY, JSON.stringify(updated))
}

export function removeFontRecent(font: string) {
  const updated = fontRecents().filter(f => f !== font)
  setFontRecents(updated)
  localStorage.setItem(FONT_RECENTS_KEY, JSON.stringify(updated))
}

export { history, fontFavorites, sizeFavorites, sizeRecents, fontRecents }
export { setOnlineEffects }
