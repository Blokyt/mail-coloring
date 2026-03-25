import { createSignal } from 'solid-js'

/* ── Types ── */

export interface AdminColorEffect {
  name: string
  colors: string[]
}

export interface AdminEmoji {
  id: string
  emoji: string
  label: string
}

export interface AdminData {
  colorEffects: Record<string, AdminColorEffect>   // id -> {name, colors}
  sizeEffectNames: Record<string, string>           // id -> display name
  emojis: AdminEmoji[]                              // custom default emojis added via admin
  tutorialPositions: Record<string, any>            // step id -> position data
  css: Record<string, string | number>              // CSS variable overrides
}

const EMPTY: AdminData = {
  colorEffects: {},
  sizeEffectNames: {},
  emojis: [],
  tutorialPositions: {},
  css: {},
}

/* ── State ── */

const [adminData, setAdminData] = createSignal<AdminData>({ ...EMPTY })
const [loaded, setLoaded] = createSignal(false)

/* ── Load from server ── */

export async function loadAdminData() {
  try {
    const res = await fetch('/admin-data.json?' + Date.now())
    const data = await res.json()
    setAdminData({ ...EMPTY, ...data })
  } catch {
    setAdminData({ ...EMPTY })
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
    return res.ok
  } catch {
    return false
  }
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

/* ── Mutations — Size Effect Names ── */

export function adminRenameSizeEffect(id: string, name: string) {
  if (!name) {
    // Reset : supprimer l'override
    setAdminData(d => {
      const { [id]: _, ...rest } = d.sizeEffectNames
      return { ...d, sizeEffectNames: rest }
    })
  } else {
    setAdminData(d => ({ ...d, sizeEffectNames: { ...d.sizeEffectNames, [id]: name } }))
  }
}

/* ── Mutations — Emojis ── */

export function adminAddEmoji(emoji: AdminEmoji) {
  setAdminData(d => ({ ...d, emojis: [...d.emojis, emoji] }))
}

export function adminRemoveEmoji(id: string) {
  setAdminData(d => ({ ...d, emojis: d.emojis.filter(e => e.id !== id) }))
}

export function adminUpdateEmoji(id: string, updates: Partial<AdminEmoji>) {
  setAdminData(d => ({
    ...d,
    emojis: d.emojis.map(e => e.id === id ? { ...e, ...updates } : e),
  }))
}

/* ── Mutations — Tutorial Positions ── */

export function adminSetTutorialPositions(positions: Record<string, any>) {
  setAdminData(d => ({ ...d, tutorialPositions: positions }))
}

/* ── Mutations — CSS ── */

export function adminSetCss(css: Record<string, string | number>) {
  setAdminData(d => ({ ...d, css }))
}

/* ── Getters ── */

export { adminData, loaded }
