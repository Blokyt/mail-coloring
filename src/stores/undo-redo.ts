/**
 * Système undo/redo professionnel par opérations
 * - Snapshots innerHTML compressés LZ-string (5-10× compression)
 * - Curseur sérialisé par chemin DOM (restauré après undo/redo)
 * - Groupage de frappe par frontières de mots
 * - Labels nommés + catégories pour l'historique visible
 * - Navigation par saut (jumpToEntry)
 * - 500 entrées max (~7-9MB compressé)
 */

import { createSignal, type Accessor } from 'solid-js'
import { compressToUTF16, decompressFromUTF16 } from 'lz-string'

/* ══════════════════════════════════════════
   Types
   ══════════════════════════════════════════ */

export interface CursorState {
  anchorPath: number[]
  anchorOffset: number
  focusPath: number[]
  focusOffset: number
}

export type OpCategory = 'typing' | 'format' | 'effect' | 'link' | 'insert' | 'style'

export interface UndoEntry {
  label: string
  category: OpCategory
  html: string           // compressé LZ-string (UTF16)
  cursorBefore: CursorState | null
  cursorAfter: CursorState | null
  timestamp: number
}

export interface HistoryItem {
  label: string
  category: OpCategory
  timestamp: number
  isCurrent: boolean
}

/* ══════════════════════════════════════════
   Cursor serialization
   ══════════════════════════════════════════ */

function nodeToPath(node: Node, root: HTMLElement): number[] | null {
  const path: number[] = []
  let current: Node | null = node
  while (current && current !== root) {
    const parent = current.parentNode
    if (!parent) return null
    const idx = Array.from(parent.childNodes).indexOf(current as ChildNode)
    if (idx === -1) return null
    path.unshift(idx)
    current = parent
  }
  return current === root ? path : null
}

function pathToNode(path: number[], root: HTMLElement): Node | null {
  let current: Node = root
  for (const idx of path) {
    if (idx < 0 || idx >= current.childNodes.length) return null
    current = current.childNodes[idx]
  }
  return current
}

function serializeCursor(editorEl: HTMLElement): CursorState | null {
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) return null
  const { anchorNode, focusNode } = sel
  if (!anchorNode || !focusNode || !editorEl.contains(anchorNode)) return null
  const anchorPath = nodeToPath(anchorNode, editorEl)
  const focusPath = nodeToPath(focusNode, editorEl)
  if (!anchorPath || !focusPath) return null
  return {
    anchorPath,
    anchorOffset: sel.anchorOffset,
    focusPath,
    focusOffset: sel.focusOffset,
  }
}

function restoreCursor(state: CursorState, editorEl: HTMLElement): boolean {
  const anchor = pathToNode(state.anchorPath, editorEl)
  const focus = pathToNode(state.focusPath, editorEl)
  if (!anchor || !focus) return false
  const sel = window.getSelection()
  if (!sel) return false
  try {
    const maxA = anchor.nodeType === Node.TEXT_NODE ? (anchor.textContent?.length ?? 0) : anchor.childNodes.length
    const maxF = focus.nodeType === Node.TEXT_NODE ? (focus.textContent?.length ?? 0) : focus.childNodes.length
    sel.setBaseAndExtent(anchor, Math.min(state.anchorOffset, maxA), focus, Math.min(state.focusOffset, maxF))
    return true
  } catch {
    return false
  }
}

/* ══════════════════════════════════════════
   State
   ══════════════════════════════════════════ */

const MAX_ENTRIES = 500

let editorRef: HTMLDivElement | null = null

// Undo stack = opérations passées (index 0 = plus ancien)
// Redo stack = opérations annulées (index 0 = plus ancien)
const [undoStack, setUndoStack] = createSignal<UndoEntry[]>([])
const [redoStack, setRedoStack] = createSignal<UndoEntry[]>([])

// Signaux dérivés
export const canUndo: Accessor<boolean> = () => undoStack().length > 0
export const canRedo: Accessor<boolean> = () => redoStack().length > 0
export const undoLabel: Accessor<string | null> = () => {
  const stack = undoStack()
  return stack.length > 0 ? stack[stack.length - 1].label : null
}
export const redoLabel: Accessor<string | null> = () => {
  const stack = redoStack()
  return stack.length > 0 ? stack[stack.length - 1].label : null
}

/** Liste des entrées pour le panneau d'historique (plus récent en haut) */
export const historyEntries: Accessor<HistoryItem[]> = () => {
  const undo = undoStack()
  const redo = redoStack()
  const items: HistoryItem[] = []

  // Redo entries (futures, du plus récent au plus ancien)
  for (let i = redo.length - 1; i >= 0; i--) {
    items.push({ label: redo[i].label, category: redo[i].category, timestamp: redo[i].timestamp, isCurrent: false })
  }

  // Marqueur "état actuel"
  items.push({ label: 'État actuel', category: 'typing', timestamp: Date.now(), isCurrent: true })

  // Undo entries (passées, du plus récent au plus ancien)
  for (let i = undo.length - 1; i >= 0; i--) {
    items.push({ label: undo[i].label, category: undo[i].category, timestamp: undo[i].timestamp, isCurrent: false })
  }

  return items
}

/* ══════════════════════════════════════════
   Core operations
   ══════════════════════════════════════════ */

function pushEntry(entry: UndoEntry) {
  setUndoStack(prev => [...prev.slice(-(MAX_ENTRIES - 1)), entry])
  setRedoStack([]) // nouvelle branche
}

export function initUndoSystem(el: HTMLDivElement) {
  editorRef = el
}

/**
 * Enregistre une opération nommée. Appeler AVANT la mutation DOM.
 * Retourne un objet { commit } à appeler APRÈS la mutation.
 */
export function recordOperation(label: string, category: OpCategory): { commit: () => void } {
  flushTyping()
  if (!editorRef) return { commit: () => {} }

  const htmlBefore = editorRef.innerHTML
  const cursorBefore = serializeCursor(editorRef)

  return {
    commit() {
      if (!editorRef) return
      const cursorAfter = serializeCursor(editorRef)
      pushEntry({
        label,
        category,
        html: compressToUTF16(htmlBefore),
        cursorBefore,
        cursorAfter,
        timestamp: Date.now(),
      })
    },
  }
}

/* ══════════════════════════════════════════
   Typing groups (frontières de mots)
   ══════════════════════════════════════════ */

interface TypingGroup {
  htmlCompressed: string
  cursorBefore: CursorState | null
  chars: string
  lastChar: string
}

let activeGroup: TypingGroup | null = null

const WORD_BREAK = /[\s.,;:!?(){}[\]"'`\-\/\\@#$%^&*+=<>~|]/

function commitGroup() {
  if (!activeGroup || !editorRef) return
  const text = activeGroup.chars
  const label = text === '\n' ? 'Retour à la ligne'
    : text.length <= 20 ? `Frappe '${text}'`
    : `Frappe '${text.slice(0, 17)}...'`

  pushEntry({
    label,
    category: 'typing',
    html: activeGroup.htmlCompressed,
    cursorBefore: activeGroup.cursorBefore,
    cursorAfter: serializeCursor(editorRef),
    timestamp: Date.now(),
  })
  activeGroup = null
}

/**
 * Appeler depuis le handler beforeinput pour chaque caractère tapé.
 * Groupe par mots (espace/ponctuation = frontière).
 */
export function recordTypingChar(char: string) {
  if (!editorRef) return

  const isBreak = WORD_BREAK.test(char) || char === '\n'
  const prevWasBreak = activeGroup ? WORD_BREAK.test(activeGroup.lastChar) || activeGroup.lastChar === '\n' : true

  // Commit le groupe précédent si frontière de mot
  const shouldCommit = activeGroup && (
    // Transition lettre → ponctuation/espace
    (!prevWasBreak && isBreak) ||
    // Transition ponctuation/espace → lettre
    (prevWasBreak && !isBreak && activeGroup.chars.length > 0) ||
    // Enter toujours seul
    char === '\n' ||
    activeGroup.lastChar === '\n'
  )

  if (shouldCommit) commitGroup()

  if (!activeGroup) {
    activeGroup = {
      htmlCompressed: compressToUTF16(editorRef.innerHTML),
      cursorBefore: serializeCursor(editorRef),
      chars: '',
      lastChar: '',
    }
  }

  activeGroup.chars += char
  activeGroup.lastChar = char
}

/** Flush le groupe de frappe en cours (avant une opération non-typing) */
export function flushTyping() {
  if (activeGroup) commitGroup()
}

/* ══════════════════════════════════════════
   Undo / Redo
   ══════════════════════════════════════════ */

export function performUndo(): boolean {
  flushTyping()
  if (!editorRef) return false
  const stack = undoStack()
  if (stack.length === 0) return false

  const entry = stack[stack.length - 1]
  const currentHtml = editorRef.innerHTML
  const currentCursor = serializeCursor(editorRef)

  // Restaurer l'état
  const restored = decompressFromUTF16(entry.html)
  if (!restored) return false
  editorRef.innerHTML = restored

  // Pousser l'état actuel dans redo
  setRedoStack(prev => [...prev, {
    label: entry.label,
    category: entry.category,
    html: compressToUTF16(currentHtml),
    cursorBefore: entry.cursorAfter, // inversé pour redo
    cursorAfter: currentCursor,
    timestamp: entry.timestamp,
  }])
  setUndoStack(s => s.slice(0, -1))

  // Restaurer le curseur
  if (entry.cursorBefore) {
    restoreCursor(entry.cursorBefore, editorRef)
  }
  editorRef.focus()
  return true
}

export function performRedo(): boolean {
  if (!editorRef) return false
  const stack = redoStack()
  if (stack.length === 0) return false

  const entry = stack[stack.length - 1]
  const currentHtml = editorRef.innerHTML
  const currentCursor = serializeCursor(editorRef)

  // Restaurer l'état
  const restored = decompressFromUTF16(entry.html)
  if (!restored) return false
  editorRef.innerHTML = restored

  // Pousser l'état actuel dans undo
  setUndoStack(prev => [...prev.slice(-(MAX_ENTRIES - 1)), {
    label: entry.label,
    category: entry.category,
    html: compressToUTF16(currentHtml),
    cursorBefore: currentCursor,
    cursorAfter: entry.cursorAfter,
    timestamp: entry.timestamp,
  }])
  setRedoStack(s => s.slice(0, -1))

  // Restaurer le curseur
  if (entry.cursorAfter) {
    restoreCursor(entry.cursorAfter, editorRef)
  }
  editorRef.focus()
  return true
}

/**
 * Navigation directe : sauter à une entrée de l'historique.
 * index 0 = haut de la liste (redo le plus récent ou état actuel)
 */
export function jumpToEntry(index: number): boolean {
  const redo = redoStack()
  const currentIdx = redo.length // l'index de "état actuel"

  if (index === currentIdx) return false // déjà là

  if (index < currentIdx) {
    // Aller vers le futur (redo N fois)
    const steps = currentIdx - index
    for (let i = 0; i < steps; i++) {
      if (!performRedo()) return false
    }
  } else {
    // Aller vers le passé (undo N fois)
    const steps = index - currentIdx
    for (let i = 0; i < steps; i++) {
      if (!performUndo()) return false
    }
  }
  return true
}
