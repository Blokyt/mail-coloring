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

export interface TutorialTextOverride {
  title?: string
  description?: string
}

export type AnchorPosition = 'top' | 'bottom' | 'left' | 'right' | 'bottom-right' | 'bottom-left' | 'top-left' | 'top-right' | 'center'

export interface TutorialPosition {
  bubbleAnchor: AnchorPosition
  bubbleOffsetX: number
  bubbleOffsetY: number
  spotPadding?: number
  spotSelector?: string
}

export interface TutorialActionOverride {
  type?: 'select-text' | 'click-element' | 'dblclick-element' | 'none'
  targetSelector?: string
  hint?: string
  enabled?: boolean
}

export interface AdminData {
  colorEffects: Record<string, AdminColorEffect>
  sizeEffectNames: Record<string, string>
  emojis: AdminEmoji[]
  tutorialPositions: Record<string, TutorialPosition>
  tutorialTexts: Record<string, TutorialTextOverride>
  tutorialActions: Record<string, TutorialActionOverride>
  css: Record<string, string | number>
}

const EMPTY: AdminData = {
  colorEffects: {},
  sizeEffectNames: {},
  emojis: [],
  tutorialPositions: {},
  tutorialTexts: {},
  tutorialActions: {},
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

export function adminSetTutorialPositions(positions: Record<string, TutorialPosition>) {
  setAdminData(d => ({ ...d, tutorialPositions: positions }))
}

export function adminSetTutorialPosition(stepId: string, pos: TutorialPosition) {
  setAdminData(d => ({ ...d, tutorialPositions: { ...d.tutorialPositions, [stepId]: pos } }))
}

export function adminRemoveTutorialPosition(stepId: string) {
  setAdminData(d => {
    const { [stepId]: _, ...rest } = d.tutorialPositions
    return { ...d, tutorialPositions: rest }
  })
}

/* ── Mutations — Tutorial Texts ── */

export function adminSetTutorialText(stepId: string, text: TutorialTextOverride) {
  setAdminData(d => ({ ...d, tutorialTexts: { ...d.tutorialTexts, [stepId]: text } }))
}

export function adminResetTutorialTexts() {
  setAdminData(d => ({ ...d, tutorialTexts: {} }))
}

/* ── Mutations — Tutorial Actions ── */

export function adminSetTutorialAction(stepId: string, action: TutorialActionOverride) {
  setAdminData(d => ({ ...d, tutorialActions: { ...d.tutorialActions, [stepId]: action } }))
}

export function adminResetTutorialActions() {
  setAdminData(d => ({ ...d, tutorialActions: {} }))
}

/** Supprime les positions dont l'ID n'est pas dans validIds */
export function adminCleanOrphanPositions(validIds: Set<string>) {
  setAdminData(d => {
    const cleaned: Record<string, TutorialPosition> = {}
    for (const [id, pos] of Object.entries(d.tutorialPositions)) {
      if (validIds.has(id)) cleaned[id] = pos
    }
    return { ...d, tutorialPositions: cleaned }
  })
}

/* ── Mutations — CSS ── */

export function adminSetCss(css: Record<string, string | number>) {
  setAdminData(d => ({ ...d, css }))
}

/* ── Getters ── */

export { adminData, loaded }
