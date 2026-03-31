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
  colorEffects: Record<string, AdminColorEffect>
  hiddenColorEffects: string[]
  sizeEffectNames: Record<string, string>
  emojis: AdminEmoji[]
  hiddenEmojis: string[]
  emojiOverrides: Record<string, { label: string }>
  css: Record<string, string | number>
}

const EMPTY: AdminData = {
  colorEffects: {},
  hiddenColorEffects: [],
  sizeEffectNames: {},
  emojis: [],
  hiddenEmojis: [],
  emojiOverrides: {},
  css: {},
}

/* ── State ── */

const [adminData, setAdminData] = createSignal<AdminData>({ ...EMPTY })
const [savedAdminData, setSavedAdminData] = createSignal<AdminData>({ ...EMPTY })
const [loaded, setLoaded] = createSignal(false)

/* ── Load from server ── */

export async function loadAdminData() {
  try {
    const res = await fetch('/admin-data.json?' + Date.now())
    const data = await res.json()
    console.log('[admin-data] loaded from server:', JSON.stringify(data).slice(0, 200))
    const merged = { ...EMPTY, ...data }
    setAdminData(merged)
    setSavedAdminData(JSON.parse(JSON.stringify(merged)))
  } catch (err) {
    console.error('[admin-data] load failed:', err)
    setAdminData({ ...EMPTY })
    setSavedAdminData({ ...EMPTY })
  }
  setLoaded(true)
}

/* ── Save to server ── */

export async function saveAdminData(): Promise<boolean> {
  try {
    const payload = JSON.stringify(adminData())
    console.log('[admin-data] saving:', payload.slice(0, 200))
    const res = await fetch('/api/save-admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
    })
    console.log('[admin-data] save response:', res.status)
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

export function adminHideColorEffect(id: string) {
  setAdminData(d => ({
    ...d,
    hiddenColorEffects: d.hiddenColorEffects.includes(id)
      ? d.hiddenColorEffects
      : [...d.hiddenColorEffects, id],
  }))
}

export function adminUnhideColorEffect(id: string) {
  setAdminData(d => ({
    ...d,
    hiddenColorEffects: d.hiddenColorEffects.filter(h => h !== id),
  }))
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

export function adminToggleHideEmoji(id: string) {
  setAdminData(d => {
    const hidden = d.hiddenEmojis.includes(id)
      ? d.hiddenEmojis.filter(h => h !== id)
      : [...d.hiddenEmojis, id]
    return { ...d, hiddenEmojis: hidden }
  })
}

export function adminIsEmojiHidden(id: string): boolean {
  return adminData().hiddenEmojis.includes(id)
}

export function adminRenameEmoji(id: string, label: string) {
  if (!label) {
    setAdminData(d => {
      const { [id]: _, ...rest } = d.emojiOverrides
      return { ...d, emojiOverrides: rest }
    })
  } else {
    setAdminData(d => ({ ...d, emojiOverrides: { ...d.emojiOverrides, [id]: { label } } }))
  }
}

/* ── Mutations — CSS ── */

export function adminSetCss(css: Record<string, string | number>) {
  setAdminData(d => ({ ...d, css }))
}

/* ── Getters ── */

export { adminData, loaded }
