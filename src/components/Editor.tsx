import { onMount, onCleanup, createSignal } from 'solid-js'
import { pushUndo, undo, pushRedo, redo, activeColorEffect, activeSizeEffect, intensity, baseSize } from '../stores/editor'
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

export function replaceSelectionWithHtml(html: string) {
  if (!editorEl) return
  pushUndo(editorEl.innerHTML)
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

export function applyInlineStyle(prop: string, value: string) {
  if (!editorEl) return
  restoreSelection()
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) { editorEl.focus(); return }
  pushUndo(editorEl.innerHTML)
  if (prop === 'color') document.execCommand('foreColor', false, value)
  else if (prop === 'backgroundColor') document.execCommand('hiliteColor', false, value)
  else if (prop === 'fontSize') {
    document.execCommand('fontSize', false, '7')
    editorEl.querySelectorAll('font[size="7"]').forEach(el => { (el as HTMLElement).removeAttribute('size'); (el as HTMLElement).style.fontSize = value })
  } else if (prop === 'fontFamily') document.execCommand('fontName', false, value)
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
  pushUndo(editorEl.innerHTML)

  const range = sel.getRangeAt(0)
  const contents = range.extractContents()

  const a = document.createElement('a')
  a.href = url
  a.target = '_blank'
  // Inherit tout le style du texte — pas de changement visuel
  a.style.color = 'inherit'
  a.style.textDecoration = 'inherit'
  a.appendChild(contents)

  range.insertNode(a)

  const newRange = document.createRange()
  newRange.setStartAfter(a)
  newRange.collapse(true)
  sel.removeAllRanges()
  sel.addRange(newRange)
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
  pushUndo(editorEl.innerHTML)

  // Remplacer le <a> par son contenu
  const parent = a.parentNode!
  while (a.firstChild) parent.insertBefore(a.firstChild, a)
  a.remove()
  editorEl.focus()
}

export function execFormatCommand(cmd: string) {
  if (!editorEl) return
  restoreSelection()
  pushUndo(editorEl.innerHTML)
  document.execCommand(cmd, false, undefined)
  editorEl.focus()
  saveSelection()
}

/**
 * Applique un cycle de couleurs sur la selection en preservant le formatage existant.
 * Chaque caractere non-espace recoit sa couleur dans l'ordre du cycle.
 */
export function applyColorToSelection(colors: string[]) {
  if (!editorEl || colors.length === 0) return
  restoreSelection()
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) return
  const range = sel.getRangeAt(0)
  if (range.collapsed || !editorEl.contains(range.commonAncestorContainer)) return

  pushUndo(editorEl.innerHTML)

  // Extraire le contenu selectionne (preserve <b>, <i>, <u>, <font>, etc.)
  const fragment = range.extractContents()

  // Walker tous les text nodes du fragment et wrapper chaque caractere
  const walker = document.createTreeWalker(fragment, NodeFilter.SHOW_TEXT)
  const textNodes: Text[] = []
  while (walker.nextNode()) textNodes.push(walker.currentNode as Text)

  let charIdx = 0
  for (const textNode of textNodes) {
    const text = textNode.textContent || ''
    const charFrag = document.createDocumentFragment()
    for (const char of text) {
      if (char === ' ' || char === '\n' || char === '\t') {
        charFrag.appendChild(document.createTextNode(char))
      } else {
        const span = document.createElement('span')
        span.style.color = colors[charIdx % colors.length]
        span.textContent = char
        charFrag.appendChild(span)
        charIdx++
      }
    }
    textNode.parentNode?.replaceChild(charFrag, textNode)
  }

  // Reinjecter le fragment modifie
  range.insertNode(fragment)
  editorEl.focus()
  saveSelection()
}

/**
 * Applique un effet de taille sur la selection en preservant le formatage existant.
 * Chaque caractere non-espace recoit sa taille selon getOffset().
 */
export function applySizeToSelection(getOffset: (charIdx: number, total: number) => number, baseSize: number) {
  if (!editorEl) return
  restoreSelection()
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) return
  const range = sel.getRangeAt(0)
  if (range.collapsed || !editorEl.contains(range.commonAncestorContainer)) return

  pushUndo(editorEl.innerHTML)

  const fragment = range.extractContents()
  const walker = document.createTreeWalker(fragment, NodeFilter.SHOW_TEXT)
  const textNodes: Text[] = []
  while (walker.nextNode()) textNodes.push(walker.currentNode as Text)

  // Compter le total de caracteres non-espace
  let total = 0
  for (const tn of textNodes) {
    for (const c of (tn.textContent || '')) { if (c !== ' ' && c !== '\n') total++ }
  }

  let charIdx = 0
  for (const textNode of textNodes) {
    const text = textNode.textContent || ''
    const charFrag = document.createDocumentFragment()
    for (const char of text) {
      if (char === ' ' || char === '\n' || char === '\t') {
        charFrag.appendChild(document.createTextNode(char))
      } else {
        const span = document.createElement('span')
        const offset = getOffset(charIdx, total)
        span.style.fontSize = `${Math.max(8, Math.round(baseSize + offset))}px`
        span.textContent = char
        charFrag.appendChild(span)
        charIdx++
      }
    }
    textNode.parentNode?.replaceChild(charFrag, textNode)
  }

  range.insertNode(fragment)
  editorEl.focus()
  saveSelection()
}

/* ── Pagination constants ── */
const COL_GAP = 24
const EDITOR_PAD = 20
const MAX_PAGES = 50

export function Editor() {
  const [pageLabel, setPageLabel] = createSignal('1 – 3')
  const [canGoBack, setCanGoBack] = createSignal(false)

  let pw = 200   // page width (recalculated on resize)
  let ws = 0     // window start: 0-indexed first visible page
  let transitioning = false

  /* Recalculate column sizing when viewport resizes */
  function updateLayout() {
    if (!viewportEl || !editorEl) return
    const vw = viewportEl.clientWidth
    pw = (vw - 2 * EDITOR_PAD - 2 * COL_GAP) / 3
    if (pw < 50) pw = 50

    const contentWidth = MAX_PAGES * pw + (MAX_PAGES - 1) * COL_GAP
    editorEl.style.width = (contentWidth + 2 * EDITOR_PAD) + 'px'
    editorEl.style.columnCount = String(MAX_PAGES)

    // Position the two page separators (pseudo-elements on viewport)
    viewportEl.style.setProperty('--sep-left-1', (EDITOR_PAD + pw + COL_GAP / 2) + 'px')
    viewportEl.style.setProperty('--sep-left-2', (EDITOR_PAD + 2 * pw + COL_GAP + COL_GAP / 2) + 'px')

    applyOffset()
  }

  /* Which column (0-indexed) is the cursor currently in? */
  function getCursorPage(): number {
    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0 || !editorEl) return ws
    const range = sel.getRangeAt(0)
    if (!editorEl.contains(range.commonAncestorContainer)) return ws

    const rect = range.getBoundingClientRect()
    if (rect.x === 0 && rect.y === 0 && rect.width === 0 && rect.height === 0) return ws

    const editorRect = editorEl.getBoundingClientRect()
    const relX = rect.left - editorRect.left - EDITOR_PAD
    if (pw <= 0) return 0
    return Math.max(0, Math.floor(relX / (pw + COL_GAP)))
  }

  /* Map a page number to the correct window-start.
     Pattern: [0,1,2], [2,3,4], [4,5,6], … */
  function getWindowForPage(page: number): number {
    if (page < 3) return 0
    return Math.floor((page - 1) / 2) * 2
  }

  /* Check if cursor left the visible 3-page window → shift */
  function checkCursorPage() {
    if (transitioning) return
    const cp = getCursorPage()
    if (cp < ws || cp >= ws + 3) {
      ws = getWindowForPage(cp)
      applyOffset()
    }
  }

  /* Slide the editor so the right 3 pages are visible */
  function applyOffset() {
    if (!editorEl) return
    transitioning = true
    const offset = ws * (pw + COL_GAP)
    editorEl.style.transform = `translateX(-${offset}px)`
    setPageLabel(`${ws + 1} – ${ws + 3}`)
    setCanGoBack(ws > 0)
    setTimeout(() => {
      transitioning = false
      checkCursorPage() // re-check after animation
    }, 320)
  }

  function goBack() {
    if (ws <= 0 || transitioning) return
    ws = Math.max(0, ws - 2)
    applyOffset()
  }

  function goForward() {
    if (transitioning) return
    ws += 2
    applyOffset()
  }

  onMount(() => {
    document.addEventListener('mousedown', (e) => {
      if (editorEl && !editorEl.contains(e.target as Node)) saveSelection()
    })
    document.addEventListener('keydown', (e) => {
      if (!editorEl) return
      if (e.ctrlKey && e.key === 'z') { e.preventDefault(); const prev = undo(); if (prev !== null) { pushRedo(editorEl.innerHTML); editorEl.innerHTML = prev } }
      if (e.ctrlKey && e.key === 'y') { e.preventDefault(); const next = redo(); if (next !== null) { pushUndo(editorEl.innerHTML); editorEl.innerHTML = next } }
    })

    /* Force le style de la hotbar sur chaque caractere tape.
       Le span est insere comme enfant DIRECT de l'editeur
       (pas a l'interieur d'un parent style) pour eviter
       tout heritage de background/color/etc. */
    if (editorEl) {
      editorEl.addEventListener('beforeinput', (e) => {
        if (e.inputType !== 'insertText' || !e.data) return

        e.preventDefault()
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
      })
    }

    /* ── Double-clic = peindre le mot avec hotbar + effets armes ── */
    if (editorEl) {
      editorEl.addEventListener('dblclick', (e) => {
        // Le double-clic natif selectionne le mot — on utilise cette selection
        const sel = window.getSelection()
        if (!sel || sel.isCollapsed || !sel.rangeCount) return
        const range = sel.getRangeAt(0)
        if (!editorEl!.contains(range.commonAncestorContainer)) return

        const word = sel.toString()
        if (!word.trim()) return

        pushUndo(editorEl!.innerHTML)

        const buf = getBuffer()
        const colorId = activeColorEffect()
        const sizeId = activeSizeEffect()
        const colorEffect = colorId ? COLOR_EFFECTS[colorId] : null
        const sizeEffect = sizeId ? SIZE_EFFECTS[sizeId] : null
        const opts = { intensity: intensity(), baseSize: baseSize() }

        // Extraire le contenu selectionne
        const extracted = range.extractContents()
        const chars = [...(extracted.textContent || '')]
        const nonSpaceCount = chars.filter(c => c !== ' ').length

        const frag = document.createDocumentFragment()
        let charIdx = 0
        for (const char of chars) {
          if (char === ' ' || char === '\n') {
            frag.appendChild(document.createTextNode(char))
            continue
          }

          const deco: string[] = []
          if (buf.underline) deco.push('underline')
          if (buf.strikeThrough) deco.push('line-through')

          const color = colorEffect
            ? colorEffect.colors[charIdx % colorEffect.colors.length]
            : buf.foreColor

          let fontSize = buf.fontSize
          if (sizeEffect) {
            const offset = sizeEffect.getOffset(charIdx, nonSpaceCount, opts)
            fontSize = Math.max(8, Math.round(opts.baseSize + offset))
          }

          const styleParts = [
            `color:${color}`,
            `font-size:${fontSize}px`,
            `font-family:${buf.fontFamily}`,
            `font-weight:${buf.bold ? '700' : '400'}`,
            `font-style:${buf.italic ? 'italic' : 'normal'}`,
            `text-decoration:${deco.length ? deco.join(' ') : 'none'}`,
          ]
          if (buf.hiliteColor) styleParts.push(`background-color:${buf.hiliteColor}`)

          const span = document.createElement('span')
          span.setAttribute('style', styleParts.join(';'))
          span.textContent = char
          frag.appendChild(span)
          charIdx++
        }

        range.insertNode(frag)

        // Nettoyer les elements vides
        editorEl!.querySelectorAll('span:empty, font:empty, b:empty, i:empty, u:empty').forEach(el => el.remove())

        // Deselectionner
        sel.removeAllRanges()
      })
    }

    const ro = new ResizeObserver(updateLayout)
    if (viewportEl) ro.observe(viewportEl)
    updateLayout()

    document.addEventListener('selectionchange', checkCursorPage)

    onCleanup(() => {
      ro.disconnect()
      document.removeEventListener('selectionchange', checkCursorPage)
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
