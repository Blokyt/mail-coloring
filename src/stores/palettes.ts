import { createSignal } from 'solid-js'
import { VENETIAN_PALETTE } from '../data/colors'

/* ── Types ── */

export interface PaletteColor {
  hex: string
  name: string
}

export interface UserPalette {
  id: string
  name: string
  colors: PaletteColor[]
}

/* ── Storage keys ── */

const PALETTES_KEY = 'artlequin_palettes'
const ACTIVE_KEY = 'artlequin_active_palette'
const HIDDEN_BASE_KEY = 'artlequin_hidden_base_colors'

/* ── Helpers ── */

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch { return fallback }
}

function save(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value))
}

/* ── Signals ── */

const [userPalettes, setUserPalettes] = createSignal<UserPalette[]>(
  load<UserPalette[]>(PALETTES_KEY, [])
)

const [activePaletteId, setActivePaletteId] = createSignal<string | null>(
  load<string | null>(ACTIVE_KEY, null)
)

const [hiddenBaseColors, setHiddenBaseColors] = createSignal<string[]>(
  load<string[]>(HIDDEN_BASE_KEY, [])
)

/* ── Persistence wrappers ── */

function persistPalettes(palettes: UserPalette[]) {
  setUserPalettes(palettes)
  save(PALETTES_KEY, palettes)
}

function persistActive(id: string | null) {
  setActivePaletteId(id)
  save(ACTIVE_KEY, id)
}

function persistHidden(hidden: string[]) {
  setHiddenBaseColors(hidden)
  save(HIDDEN_BASE_KEY, hidden)
}

/* ── Getters ── */

/** Couleurs de base visibles (après masquage) */
export function getVisibleBaseColors(): PaletteColor[] {
  const hidden = hiddenBaseColors()
  return VENETIAN_PALETTE
    .filter(c => !hidden.includes(c.hex))
    .map(c => ({ hex: c.hex, name: c.name }))
}

/** Palette active (null = pas de palette perso active) */
export function getActivePalette(): UserPalette | null {
  const id = activePaletteId()
  if (!id) return null
  return userPalettes().find(p => p.id === id) ?? null
}

/** Toutes les couleurs affichées dans la toolbar */
export function getToolbarColors(): PaletteColor[] {
  const active = getActivePalette()
  if (active) return active.colors
  return getVisibleBaseColors()
}

/* ── Mutations — Base colors ── */

export function toggleBaseColor(hex: string) {
  const hidden = hiddenBaseColors()
  const updated = hidden.includes(hex)
    ? hidden.filter(h => h !== hex)
    : [...hidden, hex]
  persistHidden(updated)
}

export function isBaseColorHidden(hex: string): boolean {
  return hiddenBaseColors().includes(hex)
}

export function resetBaseColors() {
  persistHidden([])
}

/* ── Mutations — Palettes ── */

export function createPalette(name: string, colors: PaletteColor[] = []): string {
  const id = `palette-${Date.now()}`
  const palette: UserPalette = { id, name, colors }
  persistPalettes([...userPalettes(), palette])
  return id
}

export function deletePalette(id: string) {
  persistPalettes(userPalettes().filter(p => p.id !== id))
  if (activePaletteId() === id) persistActive(null)
}

export function renamePalette(id: string, name: string) {
  persistPalettes(userPalettes().map(p => p.id === id ? { ...p, name } : p))
}

export function setActivePalette(id: string | null) {
  persistActive(id)
}

/* ── Mutations — Palette colors ── */

export function addColorToPalette(paletteId: string, color: PaletteColor) {
  persistPalettes(userPalettes().map(p => {
    if (p.id !== paletteId) return p
    if (p.colors.some(c => c.hex.toLowerCase() === color.hex.toLowerCase())) return p
    return { ...p, colors: [...p.colors, color] }
  }))
}

export function removeColorFromPalette(paletteId: string, hex: string) {
  persistPalettes(userPalettes().map(p => {
    if (p.id !== paletteId) return p
    return { ...p, colors: p.colors.filter(c => c.hex !== hex) }
  }))
}

/* ── Exports ── */

export { userPalettes, activePaletteId, hiddenBaseColors }
