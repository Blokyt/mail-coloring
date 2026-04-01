import { createSignal } from 'solid-js'
import { DEFAULT_COLOR_EFFECTS, DEFAULT_SIZE_EFFECTS } from '../engine/effects'

/* ── Types ── */

export interface AdminColorEffect {
  name: string
  colors: string[]
}

export interface AdminSizeEffect {
  name: string
  profile: number[]
}

export interface AdminEmoji {
  id: string
  emoji: string
  label: string
}

export interface AdminData {
  effectsInitialized: boolean
  colorEffects: Record<string, AdminColorEffect>
  sizeEffects: Record<string, AdminSizeEffect>
  css: Record<string, string | number>
}

const EMPTY: AdminData = {
  effectsInitialized: false,
  colorEffects: {},
  sizeEffects: {},
  css: {},
}

/* ── State ── */

const [adminData, setAdminData] = createSignal<AdminData>({ ...EMPTY })
const [savedAdminData, setSavedAdminData] = createSignal<AdminData>({ ...EMPTY })
const [loaded, setLoaded] = createSignal(false)

const SIZE_SAMPLES = 64

/** Seed les effets couleur depuis les defaults hardcodés */
function seedColorEffects(): Record<string, AdminColorEffect> {
  const result: Record<string, AdminColorEffect> = {}
  for (const [id, e] of Object.entries(DEFAULT_COLOR_EFFECTS)) {
    result[id] = { name: e.name, colors: [...e.colors] }
  }
  return result
}

/** Seed les effets taille en échantillonnant les fonctions getShape en profils */
function seedSizeEffects(nameOverrides: Record<string, string> = {}): Record<string, AdminSizeEffect> {
  const result: Record<string, AdminSizeEffect> = {}
  for (const [id, e] of Object.entries(DEFAULT_SIZE_EFFECTS)) {
    const profile = Array.from({ length: SIZE_SAMPLES }, (_, i) =>
      e.getShape(i / (SIZE_SAMPLES - 1))
    )
    result[id] = { name: nameOverrides[id] ?? e.name, profile }
  }
  return result
}

/* ── Load from server ── */

export async function loadAdminData() {
  try {
    const res = await fetch('/admin-data.json?' + Date.now())
    const data = await res.json()
    const merged = { ...EMPTY, ...data }
    // Premier lancement : seed les effets depuis le code
    if (!merged.effectsInitialized) {
      merged.colorEffects = { ...seedColorEffects(), ...merged.colorEffects }
      merged.effectsInitialized = true
    }
    // Migration : si sizeEffects absent, seed depuis le code + migrer sizeEffectNames
    if (!merged.sizeEffects || Object.keys(merged.sizeEffects).length === 0) {
      merged.sizeEffects = seedSizeEffects(merged.sizeEffectNames ?? {})
    }
    // Nettoyer l'ancien champ sizeEffectNames (absorbé dans sizeEffects)
    delete merged.sizeEffectNames
    setAdminData(merged)
    setSavedAdminData(JSON.parse(JSON.stringify(merged)))
  } catch {
    const seeded = {
      ...EMPTY,
      effectsInitialized: true,
      colorEffects: seedColorEffects(),
      sizeEffects: seedSizeEffects(),
    }
    setAdminData(seeded)
    setSavedAdminData(JSON.parse(JSON.stringify(seeded)))
  }
  setLoaded(true)
}

/* ── Save to server ── */

export async function saveAdminData(): Promise<boolean> {
  try {
    const res = await fetch('/api/save-admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(adminData()),
    })
    if (res.ok) {
      setSavedAdminData(JSON.parse(JSON.stringify(adminData())))
    }
    return res.ok
  } catch {
    return false
  }
}

/** Vérifie si un effet couleur a des changements non sauvés */
export function isColorEffectDirty(id: string): boolean {
  const current = adminData().colorEffects[id]
  const saved = savedAdminData().colorEffects[id]
  if (!current && !saved) return false
  if (!current || !saved) return true
  return current.name !== saved.name || JSON.stringify(current.colors) !== JSON.stringify(saved.colors)
}

/* ── Mutations — Color Effects ── */

export function adminSetColorEffect(id: string, effect: AdminColorEffect) {
  setAdminData(d => ({ ...d, colorEffects: { ...d.colorEffects, [id]: effect } }))
}

export function adminRemoveColorEffect(id: string) {
  setAdminData(d => {
    const { [id]: _, ...rest } = d.colorEffects
    return { ...d, colorEffects: rest }
  })
}

/* ── Mutations — Size Effects ── */

export function adminRenameSizeEffect(id: string, name: string) {
  setAdminData(d => {
    const existing = d.sizeEffects[id]
    if (!existing) return d
    return { ...d, sizeEffects: { ...d.sizeEffects, [id]: { ...existing, name } } }
  })
}

/* ── Mutations — CSS ── */

export function adminSetCss(css: Record<string, string | number>) {
  setAdminData(d => ({ ...d, css }))
}

/* ── Getters ── */

export { adminData, loaded }
