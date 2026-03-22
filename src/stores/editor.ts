import { createSignal } from 'solid-js'

// Effet actif courant
const [activeColorEffect, setActiveColorEffect] = createSignal<string | null>(null)
const [activeSizeEffect, setActiveSizeEffect] = createSignal<string | null>(null)

// Contrôles
const [intensity, setIntensity] = createSignal(5)
const [baseSize, setBaseSize] = createSignal(18)
const [activeFont, setActiveFont] = createSignal('Arial, sans-serif')

// Profil de taille personnalisé (tracé souris ou fonction math)
const [customSizeProfile, setCustomSizeProfile] = createSignal<number[] | null>(null)

// Historique d'undo (stocke les états HTML de l'éditeur)
const [undoStack, setUndoStack] = createSignal<string[]>([])
const [redoStack, setRedoStack] = createSignal<string[]>([])

export function pushUndo(html: string) {
  setUndoStack(prev => [...prev.slice(-50), html])
  setRedoStack([])
}

export function undo(): string | null {
  const stack = undoStack()
  if (stack.length === 0) return null
  const last = stack[stack.length - 1]
  setUndoStack(prev => prev.slice(0, -1))
  return last ?? null
}

export function redo(): string | null {
  const stack = redoStack()
  if (stack.length === 0) return null
  const last = stack[stack.length - 1]
  setRedoStack(prev => prev.slice(0, -1))
  return last ?? null
}

export function pushRedo(html: string) {
  setRedoStack(prev => [...prev, html])
}

export {
  activeColorEffect, setActiveColorEffect,
  activeSizeEffect, setActiveSizeEffect,
  intensity, setIntensity,
  baseSize, setBaseSize,
  activeFont, setActiveFont,
  customSizeProfile, setCustomSizeProfile,
}
