import { onMount, onCleanup, createSignal, createEffect } from 'solid-js'
import { baseSize, pagesPerView, setPagesPerView } from '../stores/editor'
import { initUndoSystem, recordOperation, recordTypingChar, flushTyping, performUndo, performRedo } from '../stores/undo-redo'
import { setActiveWord } from '../stores/word-inspect'
import { cleanForOutlook } from '../engine/effects'
import { resolveSizeProfile } from '../stores/size-profiles'
import {
  type AtomRange,
  type CharStyle,
  type SizeContext,
  normalizeEditor,
  readAtoms,
  atomNodes,
  getAtomRange,
  applyAtomRange,
  isSpace,
  NBSP,
} from '../engine/editor-dom'
import * as ops from '../engine/editor-ops'
import { getBuffer } from './Header'

let editorEl: HTMLDivElement | undefined
let viewportEl: HTMLDivElement | undefined

/**
 * Sélection mémorisée, en OFFSETS D'ATOMES et non en Range DOM.
 *
 * L'ancien `savedRange` gardait des références de nœuds. Or chaque opération
 * remplaçait ces nœuds (extractContents/insertNode), et un undo recréait tout
 * le DOM via innerHTML : la sélection sauvée pointait alors dans le vide sans
 * que rien ne l'invalide. C'est ce qui produisait le « selon l'ordre
 * d'exécution ça casse ». Un couple d'entiers survit à toutes ces
 * reconstructions.
 */
let savedSel: AtomRange | null = null

export function getEditorEl(): HTMLDivElement | undefined { return editorEl }

/** Contexte de rendu des effets — toujours lu à l'instant T, jamais figé */
function ctx(): SizeContext {
  return { baseSize: baseSize(), resolveProfile: resolveSizeProfile }
}

export function getAllEditorHtml(): string {
  return editorEl?.innerHTML?.trim() || ''
}

export function getAllEditorText(): string {
  return (editorEl?.textContent?.trim() || '').replace(/ /g, ' ')
}

/* ══════════════════════════════════════════
   Sélection
   ══════════════════════════════════════════ */

export function saveSelection() {
  if (!editorEl) return
  const r = getAtomRange(editorEl)
  if (r) savedSel = r
}

/** Sélection à utiliser pour une opération : la vivante si elle est dans
 *  l'éditeur, sinon la dernière mémorisée. */
function currentSel(): AtomRange | null {
  if (!editorEl) return null
  return getAtomRange(editorEl) ?? savedSel
}

/**
 * Sélection non vide requise par les opérations de style.
 *
 * Le repli sur `savedSel` doit se déclencher aussi quand la sélection vivante
 * existe mais est VIDE, pas seulement quand elle est absente : cliquer un
 * contrôle de la toolbar peut collapser la sélection du document sans la
 * faire sortir de l'éditeur. Avec un simple `?? savedSel`, l'opération
 * recevait alors « rien de sélectionné » et retombait sur « tout le
 * document » — ce qui faisait diverger le résultat selon l'action précédente.
 */
function activeSel(): AtomRange | null {
  const live = editorEl ? getAtomRange(editorEl) : null
  if (live && live.end > live.start) return live
  if (savedSel && savedSel.end > savedSel.start) return savedSel
  return null
}

export function restoreSelection(): boolean {
  if (!editorEl) return false
  editorEl.focus()
  if (savedSel) return applyAtomRange(editorEl, savedSel)
  const n = atomNodes(editorEl).length
  return applyAtomRange(editorEl, { start: n, end: n })
}

export function getSelectedText(): string {
  if (!editorEl) return ''
  const r = activeSel()
  if (!r) return ''
  return readAtoms(editorEl).slice(r.start, r.end).map(a => a.text).join('').replace(/ /g, ' ')
}

/**
 * Exécute une opération : sélection → undo → mutation → restauration.
 * Toute mutation de l'éditeur passe par ici, ce qui garantit qu'aucune ne
 * peut échapper à l'historique ni laisser la sélection dans un état invalide.
 */
function runOp(label: string, category: Parameters<typeof recordOperation>[1], sel: AtomRange | null, fn: (r: AtomRange) => AtomRange | void): boolean {
  if (!editorEl || !sel) return false
  const op = recordOperation(label, category)
  const next = fn(sel) ?? sel
  savedSel = next
  applyAtomRange(editorEl, next)
  op.commit()
  editorEl.focus()
  return true
}

/* ══════════════════════════════════════════
   Style de la sélection
   ══════════════════════════════════════════ */

const STYLE_LABELS: Record<string, (v: string) => string> = {
  color: v => `Couleur : ${v}`,
  backgroundColor: v => `Fond : ${v}`,
  fontSize: v => `Taille : ${v}`,
  fontFamily: v => `Police : ${v.split(',')[0]}`,
}

export function applyInlineStyle(prop: string, value: string) {
  const sel = activeSel()
  const label = STYLE_LABELS[prop]?.(value) ?? `Style : ${prop}`
  runOp(label, 'format', sel, r => {
    switch (prop) {
      case 'color': ops.setColor(editorEl!, ctx(), r, value); break
      case 'backgroundColor': ops.setBackground(editorEl!, ctx(), r, value); break
      case 'fontFamily': ops.setFontFamily(editorEl!, ctx(), r, value); break
      case 'fontSize': ops.setFontSize(editorEl!, ctx(), r, parseInt(value)); break
    }
  })
}

const FORMAT_LABELS: Record<string, string> = {
  bold: 'Gras', italic: 'Italique', underline: 'Souligné', strikeThrough: 'Barré',
}

/** Gras / italique / souligné / barré.
 *  Remplace document.execCommand, qui produisait des <b>/<font> imbriqués
 *  incompatibles avec l'invariant et alimentait une pile d'undo parallèle. */
export function execFormatCommand(cmd: string) {
  const sel = activeSel()
  const fmt = cmd === 'strikeThrough' ? 'strike' : cmd
  runOp(FORMAT_LABELS[cmd] || cmd, 'format', sel, r => {
    ops.toggleFormat(editorEl!, ctx(), r, fmt as ops.ToggleFormat)
  })
}

/** Réinitialise le style de la sélection, effet de taille compris. */
export function clearSelectionStyle() {
  const sel = activeSel()
  runOp('Réinitialiser le style', 'format', sel, r => {
    ops.clearStyle(editorEl!, ctx(), r, { fontSize: `${baseSize()}px`, fontFamily: 'Arial' })
  })
}

/* ══════════════════════════════════════════
   Liens
   ══════════════════════════════════════════ */

export function applyLink(url: string) {
  if (!url) return
  const sel = activeSel()
  runOp(`Lien : ${url.replace(/^https?:\/\//, '').slice(0, 30)}`, 'link', sel, r => {
    ops.setLink(editorEl!, ctx(), r, url)
  })
}

export function removeLink() {
  const sel = currentSel()
  if (!editorEl || !sel) return
  // Étendre au lien entier sous le curseur
  const atoms = readAtoms(editorEl)
  const probe = atoms[Math.min(sel.start, atoms.length - 1)]
  if (!probe?.href) return
  let start = sel.start
  let end = Math.max(sel.end, sel.start + 1)
  while (start > 0 && atoms[start - 1]?.href === probe.href) start--
  while (end < atoms.length && atoms[end]?.href === probe.href) end++
  runOp('Retirer lien', 'link', { start, end }, r => {
    ops.removeLink(editorEl!, ctx(), r)
  })
}

/* ══════════════════════════════════════════
   Effets
   ══════════════════════════════════════════ */

export function applyColorToSelection(colors: string[], mode: 'text' | 'bg' = 'text', effectLabel?: string) {
  if (colors.length === 0) return
  const sel = activeSel()
  runOp(effectLabel || (mode === 'bg' ? 'Fond couleur' : 'Couleur'), 'effect', sel, r => {
    ops.applyColorCycle(editorEl!, ctx(), r, colors, mode)
  })
}

/**
 * Applique un effet de taille : pose le marqueur, rien d'autre.
 * Les tailles sont dérivées de (id, taille de base, rang) et re-dérivées
 * après chaque opération ultérieure — c'est ce qui rend le résultat unique
 * quel que soit l'ordre des actions.
 */
export function applySizeEffectToSelection(effectId: string, effectLabel?: string) {
  const sel = activeSel()
  runOp(effectLabel || 'Taille', 'effect', sel, r => {
    ops.applySizeEffect(editorEl!, ctx(), r, effectId)
  })
}

/* ══════════════════════════════════════════
   Taille de base
   ══════════════════════════════════════════ */

/**
 * Aperçu pendant le glissement du slider : pas d'entrée d'undo, mais un
 * résultat rigoureusement identique à celui de commitBaseSize().
 */
export function previewBaseSize(newSize: number) {
  if (!editorEl) return
  const sel = activeSel()
  if (sel) savedSel = sel
  // Aperçu EN PLACE : ne reconstruit pas le DOM, donc ne détruit pas la
  // sélection et n'a rien à restaurer. Restaurer volait le focus au slider
  // et interrompait le glissement dès qu'un texte était sélectionné.
  ops.previewBaseSize(editorEl, newSize, resolveSizeProfile, sel ?? undefined)
}

/** Fin de geste : même effet, mais annulable en une fois. */
export function commitBaseSize(newSize: number) {
  applyBase(newSize, `Taille : ${newSize}px`)
}

/**
 * Coeur commun de l'aperçu et de la validation, pour qu'ils ne puissent pas
 * diverger.
 *
 * La sélection est calculée UNE fois, utilisée, mémorisée, puis restaurée.
 * L'aperçu restaurait auparavant `savedSel` au lieu de la sélection qu'il
 * venait d'utiliser : le glissement collapsait donc la sélection vivante, et
 * la validation qui suivait ne voyait plus rien à retailler et repartait sur
 * le document entier. D'où un résultat qui dépendait de l'action précédente.
 */
function applyBase(newSize: number, label: string | null) {
  if (!editorEl) return
  const sel = activeSel()
  const op = label ? recordOperation(label, 'format') : null
  ops.setBaseSize(editorEl, newSize, resolveSizeProfile, sel ?? undefined)
  if (sel) {
    savedSel = sel
    applyAtomRange(editorEl, sel)
  }
  op?.commit()
}

/* ══════════════════════════════════════════
   Insertion
   ══════════════════════════════════════════ */

/** Style du prochain caractère, d'après la hotbar */
function bufferStyle(): CharStyle {
  const b = getBuffer()
  return {
    color: b.foreColor,
    backgroundColor: b.hiliteColor || '',
    fontSize: `${b.fontSize}px`,
    fontFamily: b.fontFamily,
    bold: b.bold,
    italic: b.italic,
    underline: b.underline,
    strike: b.strikeThrough,
  }
}

export function replaceSelectionWithHtml(html: string, label = 'Insérer') {
  if (!editorEl) return
  const tmp = document.createElement('div')
  tmp.innerHTML = html
  insertPlainText(tmp.textContent || '', label)
}

/** Insère du texte brut au style de la hotbar */
export function insertPlainText(text: string, label = 'Insérer') {
  if (!text || !editorEl) return
  const sel = currentSel() ?? { start: 0, end: 0 }
  runOp(label, 'insert', sel, r => ops.insertText(editorEl!, ctx(), r, text, bufferStyle()))
}

/* ══════════════════════════════════════════
   Mot sous le curseur
   ══════════════════════════════════════════ */

/**
 * Le mot actif est décrit par des OFFSETS, pas par des HTMLElement.
 * L'ancienne version stockait les nœuds dans un signal : après un undo (qui
 * remplace innerHTML) ou après n'importe quelle opération, ces références
 * étaient orphelines et la hotbar écrivait dans des nœuds détachés.
 */
function computeWordAtCursor() {
  if (!editorEl) { setActiveWord(null); return }
  const sel = getAtomRange(editorEl)
  if (!sel) { setActiveWord(null); return }

  const atoms = readAtoms(editorEl)
  if (atoms.length === 0) { setActiveWord(null); return }

  const probe = Math.min(sel.start, atoms.length - 1)
  if (atoms[probe]?.kind !== 'char' || isSpace(atoms[probe].text)) {
    // Curseur sur une espace : tenter le caractère précédent
    if (probe === 0 || atoms[probe - 1]?.kind !== 'char' || isSpace(atoms[probe - 1].text)) {
      setActiveWord(null); return
    }
  }

  const at = (i: number) => atoms[i]?.kind === 'char' && !isSpace(atoms[i].text)
  let start = at(probe) ? probe : probe - 1
  let end = start + 1
  while (start > 0 && at(start - 1)) start--
  while (end < atoms.length && at(end)) end++

  const nodes = atomNodes(editorEl)
  const spans = nodes.slice(start, end).map(n => n.first as HTMLElement).filter(el => el?.tagName === 'SPAN')
  if (spans.length === 0) { setActiveWord(null); return }

  const s = atoms[start].style
  const linkEl = (spans[0].closest('a') as HTMLAnchorElement | null)

  setActiveWord({
    word: atoms.slice(start, end).map(a => a.text).join(''),
    color: s.color,
    bg: s.backgroundColor,
    size: s.fontSize,
    font: s.fontFamily.split(',')[0].replace(/"/g, '').trim(),
    bold: s.bold,
    italic: s.italic,
    underline: s.underline,
    strike: s.strike,
    link: atoms[start].href || null,
    linkEl,
    spans,
    range: { start, end },
  })
}

/** Applique un style inline à tout le mot actif */
export function applyStyleToActiveWord(prop: string, value: string) {
  const w = activeWordRange()
  if (!w) return
  runOp(`Style mot : ${prop}`, 'style', w, r => {
    switch (prop) {
      case 'color': ops.setColor(editorEl!, ctx(), r, value); break
      case 'backgroundColor': ops.setBackground(editorEl!, ctx(), r, value); break
      case 'fontFamily': ops.setFontFamily(editorEl!, ctx(), r, value); break
      case 'fontSize': ops.setFontSize(editorEl!, ctx(), r, parseInt(value)); break
    }
  })
  computeWordAtCursor()
}

/** Ajoute / modifie / supprime le lien du mot actif */
export function setActiveWordLink(url: string | null, overrideWord?: { range?: AtomRange }) {
  const w = overrideWord?.range ?? activeWordRange()
  if (!w) return
  runOp(url ? `Lien : ${url.replace(/^https?:\/\//, '').slice(0, 25)}` : 'Retirer lien', 'link', w, r => {
    ops.setLink(editorEl!, ctx(), r, url || '')
  })
  computeWordAtCursor()
}

function activeWordRange(): AtomRange | null {
  const w = activeWord()
  return w?.range ?? null
}

import { activeWord } from '../stores/word-inspect'

/* ── Pagination constants ── */
const COL_GAP = 24
const EDITOR_PAD = 20
const MAX_PAGES = 50

export function Editor() {
  const [pageLabel, setPageLabel] = createSignal('1 – 3')
  const [canGoBack, setCanGoBack] = createSignal(false)

  let pw = 200   // page width (recalculated on resize)
  let ws = 0     // window start: 0-indexed first visible page
  let lastVpWidth = 0

  function updateLayout(force?: boolean) {
    if (!viewportEl || !editorEl) return
    const vw = viewportEl.clientWidth
    const ppv = pagesPerView()
    if (!force && vw === lastVpWidth && pw > 50) return
    lastVpWidth = vw

    const gaps = ppv > 1 ? ppv - 1 : 0
    pw = (vw - 2 * EDITOR_PAD - gaps * COL_GAP) / ppv
    if (pw < 50) pw = 50

    const contentWidth = MAX_PAGES * pw + (MAX_PAGES - 1) * COL_GAP
    editorEl.style.width = (contentWidth + 2 * EDITOR_PAD) + 'px'
    editorEl.style.columnCount = String(MAX_PAGES)

    if (ppv >= 2) {
      viewportEl.style.setProperty('--sep-left-1', (EDITOR_PAD + pw + COL_GAP / 2) + 'px')
    } else {
      viewportEl.style.setProperty('--sep-left-1', '-10px')
    }
    if (ppv >= 3) {
      viewportEl.style.setProperty('--sep-left-2', (EDITOR_PAD + 2 * pw + COL_GAP + COL_GAP / 2) + 'px')
    } else {
      viewportEl.style.setProperty('--sep-left-2', '-10px')
    }

    slideTo(ws)
  }

  function rectToCol(rect: DOMRect): number {
    if (!editorEl || pw <= 0) return 0
    const editorRect = editorEl.getBoundingClientRect()
    const relX = rect.left - editorRect.left - EDITOR_PAD
    return Math.max(0, Math.min(Math.floor(relX / (pw + COL_GAP)), MAX_PAGES - 1))
  }

  function getCursorPage(): number {
    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0 || !editorEl) return ws
    const range = sel.getRangeAt(0)
    if (!editorEl.contains(range.commonAncestorContainer)) return ws

    const rect = range.getBoundingClientRect()
    if (rect.x || rect.y || rect.width || rect.height) return rectToCol(rect)

    const node = sel.focusNode
    if (node && node !== editorEl) {
      const el = (node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement) as Element | null
      if (el && editorEl.contains(el)) {
        const r = el.getBoundingClientRect()
        if (r.x || r.y || r.width || r.height) return rectToCol(r)
      }
    }
    return ws
  }

  function getLastUsedPage(): number {
    if (!editorEl || !editorEl.lastChild || pw <= 0) return 0
    const range = document.createRange()
    range.selectNodeContents(editorEl.lastChild)
    const rect = range.getBoundingClientRect()
    const editorRect = editorEl.getBoundingClientRect()
    const relX = rect.right - editorRect.left - EDITOR_PAD
    return Math.max(0, Math.min(Math.floor(relX / (pw + COL_GAP)), MAX_PAGES - 1))
  }

  function getWindowForPage(page: number): number {
    const ppv = pagesPerView()
    if (ppv === 1) return page
    if (ppv === 2) return Math.max(0, page <= 1 ? 0 : page - 1)
    if (page < 3) return 0
    return Math.floor((page - 1) / 2) * 2
  }

  let checkTimer = 0
  function scheduleCheck() {
    cancelAnimationFrame(checkTimer)
    checkTimer = requestAnimationFrame(() => {
      if (!editorEl) return
      void editorEl.offsetHeight
      const cp = getCursorPage()
      const ppv = pagesPerView()
      if (cp < ws || cp >= ws + ppv) slideTo(getWindowForPage(cp))
      computeWordAtCursor()
    })
  }

  function slideTo(newWs: number) {
    if (!editorEl) return
    const ppv = pagesPerView()
    ws = Math.max(0, Math.min(newWs, MAX_PAGES - ppv))
    const offset = ws * (pw + COL_GAP)
    editorEl.style.transform = `translateX(-${offset}px)`
    setPageLabel(ppv === 1 ? `${ws + 1}` : `${ws + 1} – ${ws + ppv}`)
    setCanGoBack(ws > 0)
  }

  function goBack() {
    if (ws <= 0) return
    slideTo(ws - (pagesPerView() === 3 ? 2 : 1))
  }

  function goForward() {
    const ppv = pagesPerView()
    if (ws + ppv > getLastUsedPage()) return
    slideTo(ws + (ppv === 3 ? 2 : 1))
  }

  createEffect(() => {
    pagesPerView()
    lastVpWidth = 0
    updateLayout(true)
  })

  onMount(() => {
    if (!editorEl) return
    initUndoSystem(editorEl)

    const onDocMouseDown = (e: MouseEvent) => {
      if (editorEl && !editorEl.contains(e.target as Node)) saveSelection()
    }
    document.addEventListener('mousedown', onDocMouseDown)

    const onKeyDown = (e: KeyboardEvent) => {
      if (!editorEl) return
      const active = document.activeElement
      const inEditor = editorEl.contains(active)
      const inInput = active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement || active instanceof HTMLSelectElement
      if (!inEditor && inInput) return
      if (e.ctrlKey && e.key === 'z') { e.preventDefault(); performUndo(); afterExternalChange() }
      if (e.ctrlKey && e.key === 'y') { e.preventDefault(); performRedo(); afterExternalChange() }
    }
    document.addEventListener('keydown', onKeyDown)

    /**
     * Toute saisie passe par les opérations pures.
     *
     * L'ancienne version remontait en clonant les ancêtres pour insérer le
     * span en enfant direct de l'éditeur. Sur un mot portant un effet, ce
     * clone recopiait `data-size-effect` : le mot se retrouvait coupé en deux
     * marqueurs de même id, chacun rejouant le profil complet. Ici on insère
     * dans la liste d'atomes, et le profil se réétale sur le mot élargi.
     */
    editorEl.addEventListener('beforeinput', (e) => {
      if (!editorEl) return
      const sel = getAtomRange(editorEl)
      if (!sel) return

      if (e.inputType === 'deleteContentBackward' || e.inputType === 'deleteContentForward') {
        e.preventDefault()
        flushTyping()
        const op = recordOperation('Supprimer', 'format')
        const forward = e.inputType === 'deleteContentForward'
        const target: AtomRange = sel.end > sel.start ? sel
          : forward ? { start: sel.start, end: sel.start + 1 }
          : { start: Math.max(0, sel.start - 1), end: sel.start }
        const next = ops.deleteRange(editorEl, ctx(), target)
        savedSel = next
        applyAtomRange(editorEl, next)
        op.commit()
        scheduleCheck()
        return
      }

      if (e.inputType === 'insertParagraph' || e.inputType === 'insertLineBreak') {
        e.preventDefault()
        flushTyping()
        const op = recordOperation('Retour ligne', 'format')
        const next = ops.insertBreak(editorEl, ctx(), sel, bufferStyle())
        savedSel = next
        applyAtomRange(editorEl, next)
        op.commit()
        scheduleCheck()
        return
      }

      if (e.inputType !== 'insertText' || !e.data) return

      e.preventDefault()
      const char = e.data === ' ' ? NBSP : e.data
      recordTypingChar(char)
      const next = ops.insertText(editorEl, ctx(), sel, char, bufferStyle())
      savedSel = next
      applyAtomRange(editorEl, next)
      scheduleCheck()
    })

    editorEl.addEventListener('paste', (e) => {
      e.preventDefault()
      const text = e.clipboardData?.getData('text/plain') || ''
      if (!text) return
      insertPlainText(text.replace(/ /g, NBSP), 'Coller')
      scheduleCheck()
    })

    editorEl.addEventListener('copy', (e) => {
      const sel = window.getSelection()
      if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return
      e.preventDefault()
      const tmp = document.createElement('div')
      tmp.appendChild(sel.getRangeAt(0).cloneContents())
      const cleanHtml = cleanForOutlook(tmp.innerHTML)
      const plainDiv = document.createElement('div')
      plainDiv.innerHTML = cleanHtml
      e.clipboardData?.setData('text/html', cleanHtml)
      e.clipboardData?.setData('text/plain', (plainDiv.textContent || '').replace(/ /g, ' '))
    })

    /** Après un undo/redo : le DOM est recréé, on remet l'invariant et on
     *  invalide la sélection mémorisée qui ne veut plus rien dire. */
    function afterExternalChange() {
      if (!editorEl) return
      normalizeEditor(editorEl, ctx())
      savedSel = null
      computeWordAtCursor()
      scheduleCheck()
    }

    const wordCheck = () => requestAnimationFrame(computeWordAtCursor)
    editorEl.addEventListener('click', wordCheck)
    editorEl.addEventListener('keyup', wordCheck)

    const ro = new ResizeObserver(() => updateLayout())
    if (viewportEl) ro.observe(viewportEl)
    updateLayout()

    document.addEventListener('selectionchange', scheduleCheck)

    onCleanup(() => {
      ro.disconnect()
      document.removeEventListener('selectionchange', scheduleCheck)
      document.removeEventListener('mousedown', onDocMouseDown)
      document.removeEventListener('keydown', onKeyDown)
      if (editorEl) {
        editorEl.removeEventListener('click', wordCheck)
        editorEl.removeEventListener('keyup', wordCheck)
      }
    })
  })

  return (
    <div class="editor-wrapper">
      <div class="editor-viewport" ref={viewportEl}>
        <img src="/logo.png" alt="" class="editor-logo" />
        <div
          ref={editorEl}
          class="editor"
          contentEditable={true}
          spellcheck={false}
        />
        <div class="layout-switcher">
          <button
            class={`layout-btn${pagesPerView() === 1 ? ' layout-btn-active' : ''}`}
            title="1 page"
            onClick={() => setPagesPerView(1)}
          >
            <svg width="14" height="10" viewBox="0 0 14 10"><rect x="4" y="0" width="6" height="10" rx="1" fill="currentColor" /></svg>
          </button>
          <button
            class={`layout-btn${pagesPerView() === 2 ? ' layout-btn-active' : ''}`}
            title="2 pages"
            onClick={() => setPagesPerView(2)}
          >
            <svg width="14" height="10" viewBox="0 0 14 10"><rect x="0" y="0" width="6" height="10" rx="1" fill="currentColor" /><rect x="8" y="0" width="6" height="10" rx="1" fill="currentColor" /></svg>
          </button>
          <button
            class={`layout-btn${pagesPerView() === 3 ? ' layout-btn-active' : ''}`}
            title="3 pages"
            onClick={() => setPagesPerView(3)}
          >
            <svg width="14" height="10" viewBox="0 0 14 10"><rect x="0" y="0" width="3.5" height="10" rx="1" fill="currentColor" /><rect x="5.25" y="0" width="3.5" height="10" rx="1" fill="currentColor" /><rect x="10.5" y="0" width="3.5" height="10" rx="1" fill="currentColor" /></svg>
          </button>
        </div>
        <div class="page-nav">
          {canGoBack() && <button class="page-nav-btn" onClick={goBack}>◂</button>}
          <span class="page-nav-label">{pageLabel()}</span>
          <button class="page-nav-btn" onClick={goForward}>▸</button>
        </div>
      </div>
    </div>
  )
}
