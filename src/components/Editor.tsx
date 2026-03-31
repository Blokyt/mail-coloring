import { onMount, onCleanup, createSignal } from 'solid-js'
import { activeColorEffect, activeSizeEffect, baseSize, sizeAmplitude } from '../stores/editor'
import { initUndoSystem, recordOperation, recordTypingChar, flushTyping, performUndo, performRedo } from '../stores/undo-redo'
import { activeWord, setActiveWord } from '../stores/word-inspect'
import { COLOR_EFFECTS, SIZE_EFFECTS } from '../engine/effects'
import { getBuffer } from './Header'

let editorEl: HTMLDivElement | undefined
let viewportEl: HTMLDivElement | undefined
let savedRange: Range | null = null

export function getEditorEl(): HTMLDivElement | undefined { return editorEl }

export function getAllEditorHtml(): string {
  return editorEl?.innerHTML?.trim() || ''
}

export function getAllEditorText(): string {
  return editorEl?.textContent?.trim() || ''
}

export function saveSelection() {
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) return
  const range = sel.getRangeAt(0)
  if (editorEl && editorEl.contains(range.commonAncestorContainer)) {
    savedRange = range.cloneRange()
  }
}

export function restoreSelection(): boolean {
  if (!savedRange) return false
  const sel = window.getSelection()
  if (!sel) return false
  sel.removeAllRanges()
  sel.addRange(savedRange)
  return true
}

export function getSelectedText(): string {
  const sel = window.getSelection()
  if (sel && sel.rangeCount > 0 && editorEl) {
    const range = sel.getRangeAt(0)
    if (editorEl.contains(range.commonAncestorContainer) && !range.collapsed) return range.toString()
  }
  if (savedRange && !savedRange.collapsed) return savedRange.toString()
  return ''
}

/** Version interne — pas de record undo (l'appelant s'en charge) */
function _replaceHtml(html: string) {
  if (!editorEl) return
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) { if (!restoreSelection()) return }
  const currentSel = window.getSelection()
  if (!currentSel || currentSel.rangeCount === 0) return
  const range = currentSel.getRangeAt(0)
  if (!editorEl.contains(range.commonAncestorContainer)) return
  range.deleteContents()
  const temp = document.createElement('div')
  temp.innerHTML = html
  const fragment = document.createDocumentFragment()
  let lastNode: Node | null = null
  while (temp.firstChild) { lastNode = temp.firstChild; fragment.appendChild(temp.firstChild) }
  range.insertNode(fragment)
  if (lastNode) {
    const newRange = document.createRange()
    newRange.setStartAfter(lastNode)
    newRange.collapse(true)
    currentSel.removeAllRanges()
    currentSel.addRange(newRange)
    savedRange = newRange.cloneRange()
  }
  editorEl.focus()
}

export function replaceSelectionWithHtml(html: string, label = 'Insérer') {
  if (!editorEl) return
  const op = recordOperation(label, 'insert')
  _replaceHtml(html)
  op.commit()
}

export function applyInlineStyle(prop: string, value: string) {
  if (!editorEl) return
  restoreSelection()
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) { editorEl.focus(); return }
  const labels: Record<string, string> = { color: `Couleur : ${value}`, backgroundColor: `Fond : ${value}`, fontSize: `Taille : ${value}`, fontFamily: `Police : ${value.split(',')[0]}` }
  const op = recordOperation(labels[prop] || `Style : ${prop}`, 'format')
  if (prop === 'color') document.execCommand('foreColor', false, value)
  else if (prop === 'backgroundColor') document.execCommand('hiliteColor', false, value)
  else if (prop === 'fontSize') {
    document.execCommand('fontSize', false, '7')
    editorEl.querySelectorAll('font[size="7"]').forEach(el => { (el as HTMLElement).removeAttribute('size'); (el as HTMLElement).style.fontSize = value })
  } else if (prop === 'fontFamily') document.execCommand('fontName', false, value)
  op.commit()
  editorEl.focus()
  saveSelection()
}

/**
 * Wrappe la selection dans un <a href="..."> sans changer le visuel.
 * Le lien herite du style existant (color, text-decoration inherit).
 */
export function applyLink(url: string) {
  if (!editorEl || !url) return
  restoreSelection()
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return
  const short = url.replace(/^https?:\/\//, '').slice(0, 30)
  const op = recordOperation(`Lien : ${short}`, 'link')

  const range = sel.getRangeAt(0)
  const contents = range.extractContents()

  const a = document.createElement('a')
  a.href = url
  a.target = '_blank'
  a.style.color = 'inherit'
  a.style.textDecoration = 'inherit'
  a.appendChild(contents)

  range.insertNode(a)

  const newRange = document.createRange()
  newRange.setStartAfter(a)
  newRange.collapse(true)
  sel.removeAllRanges()
  sel.addRange(newRange)
  op.commit()
  editorEl.focus()
  saveSelection()
}

/** Retire le lien du <a> le plus proche du curseur */
export function removeLink() {
  if (!editorEl) return
  restoreSelection()
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) return
  const node = sel.anchorNode
  const a = node?.parentElement?.closest('a') || (node as Element)?.closest?.('a')
  if (!a || !editorEl.contains(a)) return
  const op = recordOperation('Retirer lien', 'link')

  const parent = a.parentNode!
  while (a.firstChild) parent.insertBefore(a.firstChild, a)
  a.remove()
  op.commit()
  editorEl.focus()
}

export function execFormatCommand(cmd: string) {
  if (!editorEl) return
  restoreSelection()
  const labels: Record<string, string> = { bold: 'Gras', italic: 'Italique', underline: 'Souligné', strikeThrough: 'Barré' }
  const op = recordOperation(labels[cmd] || cmd, 'format')
  document.execCommand(cmd, false, undefined)
  op.commit()
  editorEl.focus()
  saveSelection()
}

/**
 * Applique un cycle de couleurs sur la selection en preservant le formatage existant.
 * Chaque caractere non-espace recoit sa couleur dans l'ordre du cycle.
 */
export function applyColorToSelection(colors: string[], mode: 'text' | 'bg' = 'text', effectLabel?: string) {
  if (!editorEl || colors.length === 0) return
  restoreSelection()
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) return
  const range = sel.getRangeAt(0)
  if (range.collapsed || !editorEl.contains(range.commonAncestorContainer)) return

  const label = effectLabel || (mode === 'bg' ? 'Fond couleur' : 'Couleur')
  const op = recordOperation(label, 'effect')

  // Extraire le contenu selectionne (preserve <b>, <i>, <u>, <font>, etc.)
  const fragment = range.extractContents()

  // Walker tous les text nodes du fragment et wrapper chaque caractere
  const walker = document.createTreeWalker(fragment, NodeFilter.SHOW_TEXT)
  const textNodes: Text[] = []
  while (walker.nextNode()) textNodes.push(walker.currentNode as Text)

  let charIdx = 0
  for (const textNode of textNodes) {
    const text = textNode.textContent || ''
    const parent = textNode.parentElement

    // Span single-char existant → modifier directement
    if (parent && parent.tagName === 'SPAN' && parent !== fragment as unknown as Element
        && parent.childNodes.length === 1 && text.length === 1 && text.trim().length === 1) {
      if (mode === 'bg') {
        parent.style.backgroundColor = colors[charIdx % colors.length]
      } else {
        parent.style.color = colors[charIdx % colors.length]
      }
      charIdx++
      continue
    }

    // Cas général
    const charFrag = document.createDocumentFragment()
    for (const char of text) {
      if (char === ' ' || char === '\n' || char === '\t') {
        charFrag.appendChild(document.createTextNode(char))
      } else {
        const span = document.createElement('span')
        if (mode === 'bg') {
          span.style.backgroundColor = colors[charIdx % colors.length]
        } else {
          span.style.color = colors[charIdx % colors.length]
        }
        span.textContent = char
        charFrag.appendChild(span)
        charIdx++
      }
    }
    textNode.parentNode?.replaceChild(charFrag, textNode)
  }

  // Reinjecter le fragment modifie
  range.insertNode(fragment)
  op.commit()
  editorEl.focus()
  saveSelection()
}

/**
 * Applique un effet de taille sur la selection en preservant le formatage existant.
 * Chaque caractere non-espace recoit sa taille selon getOffset().
 */
export function applySizeToSelection(getOffset: (charIdx: number, total: number) => number, baseSize: number, effectLabel?: string) {
  if (!editorEl) return
  restoreSelection()
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) return
  const range = sel.getRangeAt(0)
  if (range.collapsed || !editorEl.contains(range.commonAncestorContainer)) return

  const op = recordOperation(effectLabel || 'Taille', 'effect')

  const fragment = range.extractContents()
  const walker = document.createTreeWalker(fragment, NodeFilter.SHOW_TEXT)
  const textNodes: Text[] = []
  while (walker.nextNode()) textNodes.push(walker.currentNode as Text)

  // Compter le total de non-space chars pour calculer t = charIdx / (total - 1)
  let total = 0
  for (const tn of textNodes) for (const ch of (tn.textContent || '')) if (ch !== ' ' && ch !== '\n' && ch !== '\t') total++

  let charIdx = 0
  for (const textNode of textNodes) {
    const text = textNode.textContent || ''
    const parent = textNode.parentElement

    // Cas simple : le parent est un span avec un seul text node d'un seul char
    // → on ajoute fontSize directement sur le span parent, pas besoin de recréer
    if (parent && parent.tagName === 'SPAN' && parent !== fragment as unknown as Element
        && parent.childNodes.length === 1 && text.length === 1 && text.trim().length === 1) {
      const offset = getOffset(charIdx, total)
      parent.style.fontSize = `${Math.max(8, Math.round(baseSize + offset))}px`
      charIdx++
      continue
    }

    // Cas général : texte brut ou multi-char, on split en spans individuels
    const charFrag = document.createDocumentFragment()
    for (const char of text) {
      if (char === ' ' || char === '\n' || char === '\t') {
        charFrag.appendChild(document.createTextNode(char))
      } else {
        const offset = getOffset(charIdx, total)
        const span = document.createElement('span')
        span.style.fontSize = `${Math.max(8, Math.round(baseSize + offset))}px`
        span.textContent = char
        charFrag.appendChild(span)
        charIdx++
      }
    }
    textNode.parentNode?.replaceChild(charFrag, textNode)
  }

  range.insertNode(fragment)
  op.commit()
  editorEl.focus()
  saveSelection()
}

/* ── Pagination constants ── */
const COL_GAP = 24
const EDITOR_PAD = 20
const MAX_PAGES = 50

function computeWordAtCursor() {
  if (!editorEl) { setActiveWord(null); return }
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) { setActiveWord(null); return }

  const node = sel.focusNode
  if (!node || !editorEl.contains(node)) { setActiveWord(null); return }

  // Trouver l'élément le plus proche
  const el = node.nodeType === Node.ELEMENT_NODE ? node as HTMLElement
    : node.parentElement
  if (!el || el === editorEl) { setActiveWord(null); return }

  const spans = getWordSpans(el, editorEl)
  if (spans.length === 0) { setActiveWord(null); return }

  const first = spans[0]
  const cs = window.getComputedStyle(first)
  // Vérifier le lien depuis l'élément sous le curseur, pas depuis le groupe de spans
  const linkEl = el.closest('a') as HTMLAnchorElement | null
  const bgRaw = cs.backgroundColor
  const hasBg = bgRaw && bgRaw !== 'rgba(0, 0, 0, 0)' && bgRaw !== 'transparent'

  const wordData = {
    word: spans.map(s => s.textContent || '').join(''),
    color: cs.color,
    bg: hasBg ? bgRaw : '',
    size: cs.fontSize,
    font: cs.fontFamily.split(',')[0].replace(/"/g, '').trim(),
    bold: parseInt(cs.fontWeight) >= 700,
    italic: cs.fontStyle === 'italic',
    underline: cs.textDecorationLine.includes('underline'),
    strike: cs.textDecorationLine.includes('line-through'),
    link: linkEl?.getAttribute('href') || null,
    linkEl,
    spans,
  }
  setActiveWord(wordData)
}

/** Applique un style inline à tous les spans du mot actif */
export function applyStyleToActiveWord(prop: string, value: string) {
  const w = activeWord()
  if (!w || !editorEl) return
  const op = recordOperation(`Style mot : ${prop}`, 'style')
  for (const span of w.spans) {
    (span as HTMLElement).style[prop as any] = value
  }
  op.commit()
  computeWordAtCursor()
}

/** Ajoute/modifie/supprime le lien du mot actif */
export function setActiveWordLink(url: string | null) {
  const w = activeWord()
  if (!w || !editorEl) return
  const op = recordOperation(url ? `Lien : ${url.replace(/^https?:\/\//, '').slice(0, 25)}` : 'Retirer lien', 'link')

  if (url) {
    if (w.linkEl) {
      w.linkEl.href = url
    } else {
      const a = document.createElement('a')
      a.href = url
      a.target = '_blank'
      a.style.color = 'inherit'
      a.style.textDecoration = 'inherit'
      const parent = w.spans[0].parentNode!
      parent.insertBefore(a, w.spans[0])
      for (const s of w.spans) a.appendChild(s)
    }
  } else if (w.linkEl) {
    const parent = w.linkEl.parentNode!
    while (w.linkEl.firstChild) parent.insertBefore(w.linkEl.firstChild, w.linkEl)
    w.linkEl.remove()
  }
  op.commit()
  computeWordAtCursor()
}

/** Extrait le "mot" (group de spans adjacents non-espace) sous un element */
function getWordSpans(target: HTMLElement, editor: HTMLElement): HTMLElement[] {
  // Remonter au span direct enfant de l'éditeur ou au span le plus proche
  let span: HTMLElement | null = target
  while (span && span.parentElement !== editor && span.parentElement) {
    span = span.parentElement
  }
  if (!span || span === editor) return [target]

  // Collecter les spans adjacents (même mot = pas de whitespace-only entre eux)
  const spans: HTMLElement[] = [span]

  // Vers la gauche
  let prev = span.previousSibling
  while (prev) {
    if (prev.nodeType === Node.TEXT_NODE && prev.textContent?.trim() === '') break
    if (prev.nodeType === Node.TEXT_NODE && (prev.textContent === ' ' || prev.textContent === '\n')) break
    if (prev.nodeType === Node.ELEMENT_NODE) spans.unshift(prev as HTMLElement)
    else break
    prev = prev.previousSibling
  }

  // Vers la droite
  let next = span.nextSibling
  while (next) {
    if (next.nodeType === Node.TEXT_NODE && next.textContent?.trim() === '') break
    if (next.nodeType === Node.TEXT_NODE && (next.textContent === ' ' || next.textContent === '\n')) break
    if (next.nodeType === Node.ELEMENT_NODE) spans.push(next as HTMLElement)
    else break
    next = next.nextSibling
  }

  return spans
}

export function Editor() {
  const [pageLabel, setPageLabel] = createSignal('1 – 3')
  const [canGoBack, setCanGoBack] = createSignal(false)

  let pw = 200   // page width (recalculated on resize)
  let ws = 0     // window start: 0-indexed first visible page
  let lastVpWidth = 0 // track viewport width to avoid spurious recalcs

  /* Recalculate column sizing — ONLY when viewport actually resizes */
  function updateLayout() {
    if (!viewportEl || !editorEl) return
    const vw = viewportEl.clientWidth
    // Skip if viewport width hasn't actually changed (avoids reflow-triggered recalcs)
    if (vw === lastVpWidth && pw > 50) return
    lastVpWidth = vw

    pw = (vw - 2 * EDITOR_PAD - 2 * COL_GAP) / 3
    if (pw < 50) pw = 50

    const contentWidth = MAX_PAGES * pw + (MAX_PAGES - 1) * COL_GAP
    editorEl.style.width = (contentWidth + 2 * EDITOR_PAD) + 'px'
    editorEl.style.columnCount = String(MAX_PAGES)

    viewportEl.style.setProperty('--sep-left-1', (EDITOR_PAD + pw + COL_GAP / 2) + 'px')
    viewportEl.style.setProperty('--sep-left-2', (EDITOR_PAD + 2 * pw + COL_GAP + COL_GAP / 2) + 'px')

    slideTo(ws)
  }

  /** Get column index from a bounding rect relative to the editor */
  function rectToCol(rect: DOMRect): number {
    if (!editorEl || pw <= 0) return 0
    const editorRect = editorEl.getBoundingClientRect()
    const relX = rect.left - editorRect.left - EDITOR_PAD
    return Math.max(0, Math.min(Math.floor(relX / (pw + COL_GAP)), MAX_PAGES - 1))
  }

  /** Which column is the cursor currently in? */
  function getCursorPage(): number {
    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0 || !editorEl) return ws
    const range = sel.getRangeAt(0)
    if (!editorEl.contains(range.commonAncestorContainer)) return ws

    // Essai 1 : rect direct du range
    const rect = range.getBoundingClientRect()
    if (rect.x || rect.y || rect.width || rect.height) {
      return rectToCol(rect)
    }

    // Essai 2 : noeud voisin (cas classique après frappe — curseur après un span)
    const container = range.startContainer
    const offset = range.startOffset
    if (container === editorEl && offset > 0) {
      const prev = editorEl.childNodes[offset - 1]
      if (prev) {
        const r = prev.nodeType === Node.ELEMENT_NODE
          ? (prev as Element).getBoundingClientRect()
          : (() => { const tr = document.createRange(); tr.selectNode(prev); return tr.getBoundingClientRect() })()
        if (r.x || r.y || r.width || r.height) {
          const editorRect = editorEl.getBoundingClientRect()
          const relX = r.right - editorRect.left - EDITOR_PAD
          return Math.max(0, Math.min(Math.floor(relX / (pw + COL_GAP)), MAX_PAGES - 1))
        }
      }
    }

    // Essai 3 : focusNode
    const node = sel.focusNode
    if (node && node !== editorEl) {
      const el = (node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement) as Element | null
      if (el && editorEl.contains(el)) {
        const r = el.getBoundingClientRect()
        if (r.x || r.y || r.width || r.height) {
          return rectToCol(r)
        }
      }
    }

    return ws
  }

  /** Which column is the last content in? Uses the END of the last child's bounding rect. */
  function getLastUsedPage(): number {
    if (!editorEl || !editorEl.lastChild || pw <= 0) return 0
    const range = document.createRange()
    range.selectNodeContents(editorEl.lastChild)
    const rect = range.getBoundingClientRect()
    const editorRect = editorEl.getBoundingClientRect()
    // Use rect.RIGHT to find the last column (not rect.left which gives the first)
    const relX = rect.right - editorRect.left - EDITOR_PAD
    return Math.max(0, Math.min(Math.floor(relX / (pw + COL_GAP)), MAX_PAGES - 1))
  }

  /* Map a page number to the correct window-start.
     Pattern: [0,1,2], [2,3,4], [4,5,6], … */
  function getWindowForPage(page: number): number {
    if (page < 3) return 0
    return Math.floor((page - 1) / 2) * 2
  }

  let checkTimer = 0
  /** Debounced cursor check — forces reflow then reads cursor position */
  function scheduleCheck() {
    cancelAnimationFrame(checkTimer)
    checkTimer = requestAnimationFrame(() => {
      if (!editorEl) return
      void editorEl.offsetHeight
      const cp = getCursorPage()
      if (cp < ws || cp >= ws + 3) {
        slideTo(getWindowForPage(cp))
      }
      computeWordAtCursor()
    })
  }

  /* Slide the editor so the right 3 pages are visible — NO recursive re-check */
  function slideTo(newWs: number) {
    if (!editorEl) return
    ws = Math.max(0, Math.min(newWs, MAX_PAGES - 3))
    const offset = ws * (pw + COL_GAP)
    editorEl.style.transform = `translateX(-${offset}px)`
    setPageLabel(`${ws + 1} – ${ws + 3}`)
    setCanGoBack(ws > 0)
  }

  function goBack() {
    if (ws <= 0) return
    slideTo(ws - 2)
  }

  function goForward() {
    const lastPage = getLastUsedPage()
    if (ws + 3 > lastPage) return // pas de pages vides au-dela du contenu
    slideTo(ws + 2)
  }

  onMount(() => {
    if (editorEl) initUndoSystem(editorEl)

    document.addEventListener('mousedown', (e) => {
      if (editorEl && !editorEl.contains(e.target as Node)) saveSelection()
    })
    document.addEventListener('keydown', (e) => {
      if (!editorEl) return
      // Undo/redo uniquement si le focus est dans l'éditeur ou si aucun input n'est focus
      const active = document.activeElement
      const inEditor = editorEl.contains(active)
      const inInput = active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement || active instanceof HTMLSelectElement
      if (!inEditor && inInput) return

      if (e.ctrlKey && e.key === 'z') { e.preventDefault(); performUndo() }
      if (e.ctrlKey && e.key === 'y') { e.preventDefault(); performRedo() }
    })

    /* Force le style de la hotbar sur chaque caractere tape.
       Le span est insere comme enfant DIRECT de l'editeur
       (pas a l'interieur d'un parent style) pour eviter
       tout heritage de background/color/etc. */
    if (editorEl) {
      editorEl.addEventListener('beforeinput', (e) => {
        if (e.inputType !== 'insertText' || !e.data) return

        e.preventDefault()
        // Snapshot debounce pour pouvoir undo la frappe
        recordTypingChar(e.data)
        const buf = getBuffer()

        const deco: string[] = []
        if (buf.underline) deco.push('underline')
        if (buf.strikeThrough) deco.push('line-through')

        const styleParts = [
          `color:${buf.foreColor}`,
          `font-size:${buf.fontSize}px`,
          `font-family:${buf.fontFamily}`,
          `font-weight:${buf.bold ? '700' : '400'}`,
          `font-style:${buf.italic ? 'italic' : 'normal'}`,
          `text-decoration:${deco.length ? deco.join(' ') : 'none'}`,
        ]
        if (buf.hiliteColor) styleParts.push(`background-color:${buf.hiliteColor}`)

        const span = document.createElement('span')
        span.setAttribute('style', styleParts.join(';'))
        span.textContent = e.data

        const sel = window.getSelection()
        if (!sel || sel.rangeCount === 0) return
        const range = sel.getRangeAt(0)
        range.deleteContents()

        // Remonter jusqu'a l'editeur en splitant les ancetres
        // pour que le span soit un enfant direct de l'editeur
        let insertionPoint: Node = range.startContainer
        let offset = range.startOffset

        // Si on est dans un text node, le spliter d'abord
        if (insertionPoint.nodeType === Node.TEXT_NODE) {
          const textNode = insertionPoint as Text
          const parent = textNode.parentNode!
          if (parent !== editorEl) {
            // Spliter le text node
            const after = textNode.splitText(offset)
            insertionPoint = parent
            offset = Array.from(parent.childNodes).indexOf(after)
          } else {
            const after = textNode.splitText(offset)
            editorEl.insertBefore(span, after)
            const newRange = document.createRange()
            newRange.setStartAfter(span)
            newRange.collapse(true)
            sel.removeAllRanges()
            sel.addRange(newRange)
            return
          }
        }

        // Remonter et spliter les ancetres jusqu'a l'editeur
        while (insertionPoint !== editorEl && insertionPoint.parentNode !== editorEl) {
          const parent = insertionPoint.parentNode!
          const clone = (insertionPoint as Element).cloneNode(false)
          // Deplacer les enfants apres offset dans le clone
          while (insertionPoint.childNodes[offset]) {
            clone.appendChild(insertionPoint.childNodes[offset])
          }
          parent.insertBefore(clone, insertionPoint.nextSibling)
          insertionPoint = parent
          offset = Array.from(parent.childNodes).indexOf(clone)
        }

        // Inserer le span au bon endroit dans l'editeur
        if (insertionPoint === editorEl) {
          const refNode = editorEl.childNodes[offset] || null
          editorEl.insertBefore(span, refNode)
        } else {
          // insertionPoint est un enfant direct de l'editeur
          const clone = (insertionPoint as Element).cloneNode(false)
          while (insertionPoint.childNodes[offset]) {
            clone.appendChild(insertionPoint.childNodes[offset])
          }
          editorEl.insertBefore(span, insertionPoint.nextSibling)
          if (clone.childNodes.length > 0) {
            editorEl.insertBefore(clone, span.nextSibling)
          }
        }

        // Nettoyer les elements vides
        editorEl.querySelectorAll('span:empty, font:empty, b:empty, i:empty, u:empty').forEach(el => el.remove())

        const newRange = document.createRange()
        newRange.setStartAfter(span)
        newRange.collapse(true)
        sel.removeAllRanges()
        sel.addRange(newRange)

        scheduleCheck()
      })

      // Sanitiser les paste — appliquer les styles de la hotbar a chaque caractere
      editorEl.addEventListener('paste', (e) => {
        e.preventDefault()
        const text = e.clipboardData?.getData('text/plain') || ''
        if (!text) return
        const buf = getBuffer()
        const deco: string[] = []
        if (buf.underline) deco.push('underline')
        if (buf.strikeThrough) deco.push('line-through')
        const style = [
          `color:${buf.foreColor}`,
          `font-size:${buf.fontSize}px`,
          `font-family:${buf.fontFamily}`,
          `font-weight:${buf.bold ? '700' : '400'}`,
          `font-style:${buf.italic ? 'italic' : 'normal'}`,
          `text-decoration:${deco.length ? deco.join(' ') : 'none'}`,
          buf.hiliteColor ? `background-color:${buf.hiliteColor}` : '',
        ].filter(Boolean).join(';')
        const html = [...text].map(ch => {
          if (ch === '\n') return '<br>'
          if (ch === ' ') return ' '
          const safe = ch.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
          return `<span style="${style}">${safe}</span>`
        }).join('')
        replaceSelectionWithHtml(html, 'Coller')
        scheduleCheck()
      })
    }

    /* Double-clic = selection native du mot (comportement navigateur) */

    /* ── Word hotbar — mise à jour au mouvement du curseur ── */
    const wordCheck = () => requestAnimationFrame(computeWordAtCursor)
    if (editorEl) {
      editorEl.addEventListener('click', wordCheck)
      editorEl.addEventListener('keyup', wordCheck)
    }

    const ro = new ResizeObserver(updateLayout)
    if (viewportEl) ro.observe(viewportEl)
    updateLayout()

    document.addEventListener('selectionchange', scheduleCheck)

    onCleanup(() => {
      ro.disconnect()
      document.removeEventListener('selectionchange', scheduleCheck)
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
        <div class="page-nav">
          {canGoBack() && <button class="page-nav-btn" onClick={goBack}>◂</button>}
          <span class="page-nav-label">{pageLabel()}</span>
          <button class="page-nav-btn" onClick={goForward}>▸</button>
        </div>

      </div>
    </div>
  )
}
