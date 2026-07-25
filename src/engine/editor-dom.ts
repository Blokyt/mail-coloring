/**
 * Invariant de document de l'éditeur.
 *
 * PROBLEME RESOLU ICI : avant, le style était encodé de trois façons
 * concurrentes (spans inline posés à la frappe, <font>/<b> produits par
 * document.execCommand, wrappers [data-size-effect]), et chaque opération
 * supposait une forme du DOM que la précédente avait le droit de casser.
 * D'où la non-commutativité (couleur puis taille ≠ taille puis couleur),
 * les spans qui s'imbriquaient à chaque passe, et les marqueurs d'effet
 * dupliqués dès qu'on tapait dans un mot.
 *
 * L'INVARIANT, garanti par normalizeEditor() après chaque opération :
 *
 *   1. Chaque caractère visible est un <span> FEUILLE contenant exactement
 *      un graphème, et portant TOUT son style en inline.
 *   2. Aucun span n'est imbriqué dans un autre span. Pas de <b>, <i>, <u>,
 *      <s>, <font> : gras/italique/souligné/barré sont du style inline.
 *   3. Les seuls conteneurs autorisés sont <a href> (lien) et
 *      <span data-size-effect="id"> (marqueur d'effet de taille), qui ne
 *      portent aucun style visuel propre.
 *   4. Un saut de ligne est le groupe indivisible
 *      <span class="line-break">↵</span><br><zws>.
 *   5. Deux marqueurs d'effet adjacents de même id sont fusionnés.
 *
 * Une fois cet invariant tenu, toute opération devient un simple
 * « pour chaque span feuille de la sélection, modifier son style »,
 * et l'ordre des opérations n'a plus aucune importance.
 */

/* ══════════════════════════════════════════
   Graphèmes
   ══════════════════════════════════════════ */

const SEGMENTER = typeof Intl !== 'undefined' && Intl.Segmenter
  ? new Intl.Segmenter('fr', { granularity: 'grapheme' })
  : null

/** Découpe en graphèmes (gère emojis composés, accents combinants, drapeaux) */
export function graphemes(s: string): string[] {
  if (SEGMENTER) return [...SEGMENTER.segment(s)].map(g => g.segment)
  return [...s]
}

/** Espace insécable — la frappe insère celui-ci, pas U+0020 */
export const NBSP = ' '
const ZWS = '​'

/** Un graphème compte-t-il comme de l'espace ?
 *  Inclut le NBSP, que l'ancien code oubliait — d'où les cycles de couleur
 *  décalés et les fonds qui bavaient sur les espaces tapées. */
export function isSpace(ch: string): boolean {
  return ch === ' ' || ch === NBSP || ch === '\t' || ch === '\n' || ch === ZWS
}

/* ══════════════════════════════════════════
   Style d'un caractère
   ══════════════════════════════════════════ */

export interface CharStyle {
  color: string
  backgroundColor: string
  fontSize: string
  fontFamily: string
  bold: boolean
  italic: boolean
  underline: boolean
  strike: boolean
}

export const EMPTY_STYLE: CharStyle = {
  color: '', backgroundColor: '', fontSize: '', fontFamily: '',
  bold: false, italic: false, underline: false, strike: false,
}

/** Tailles de l'attribut <font size> legacy */
const FONT_SIZE_ATTR: Record<string, string> = {
  '1': '10px', '2': '13px', '3': '16px', '4': '18px', '5': '24px', '6': '32px', '7': '48px',
}

/** Style effectif d'un élément, fusionné par-dessus le style hérité */
function mergeElementStyle(el: HTMLElement, inherited: CharStyle): CharStyle {
  const out = { ...inherited }
  const tag = el.tagName

  if (tag === 'B' || tag === 'STRONG') out.bold = true
  if (tag === 'I' || tag === 'EM') out.italic = true
  if (tag === 'U' || tag === 'INS') out.underline = true
  if (tag === 'S' || tag === 'STRIKE' || tag === 'DEL') out.strike = true
  if (tag === 'FONT') {
    const c = el.getAttribute('color'); if (c) out.color = c
    const f = el.getAttribute('face'); if (f) out.fontFamily = f
    const z = el.getAttribute('size'); if (z && FONT_SIZE_ATTR[z]) out.fontSize = FONT_SIZE_ATTR[z]
  }

  // `inherit` est structurel (les <a> qu'on pose portent color/text-decoration
  // à inherit pour ne pas colorer le lien) : ce n'est pas un style de
  // caractère et le propager casserait la commutation — poser le lien avant
  // ou après la couleur donnerait deux documents différents.
  const st = el.style
  const val = (v: string) => (v && v !== 'inherit' && v !== 'initial' && v !== 'unset' ? v : '')

  if (val(st.color)) out.color = st.color
  if (val(st.backgroundColor)) out.backgroundColor = st.backgroundColor
  if (val(st.fontSize)) out.fontSize = st.fontSize
  if (val(st.fontFamily)) out.fontFamily = st.fontFamily
  if (val(st.fontWeight)) out.bold = st.fontWeight === 'bold' || parseInt(st.fontWeight) >= 700
  if (val(st.fontStyle)) out.italic = st.fontStyle === 'italic'
  const deco = val(st.textDecorationLine) || val(st.textDecoration)
  if (deco) {
    out.underline = deco.includes('underline')
    out.strike = deco.includes('line-through')
  }

  return out
}

/** Sérialise un style de caractère en attribut style inline */
export function styleToCss(s: CharStyle): string {
  const parts: string[] = []
  if (s.color) parts.push(`color:${s.color}`)
  if (s.backgroundColor) parts.push(`background-color:${s.backgroundColor}`)
  if (s.fontSize) parts.push(`font-size:${s.fontSize}`)
  if (s.fontFamily) parts.push(`font-family:${s.fontFamily}`)
  parts.push(`font-weight:${s.bold ? '700' : '400'}`)
  parts.push(`font-style:${s.italic ? 'italic' : 'normal'}`)
  const deco: string[] = []
  if (s.underline) deco.push('underline')
  if (s.strike) deco.push('line-through')
  parts.push(`text-decoration:${deco.length ? deco.join(' ') : 'none'}`)
  return parts.join(';')
}

/** Relit le style d'un span feuille déjà normalisé */
export function readCharStyle(span: HTMLElement): CharStyle {
  return mergeElementStyle(span, EMPTY_STYLE)
}

/** Applique un style de caractère sur un span feuille */
export function writeCharStyle(span: HTMLElement, s: CharStyle) {
  span.setAttribute('style', styleToCss(s))
}

/* ══════════════════════════════════════════
   Atomes — l'unité d'adressage du document
   ══════════════════════════════════════════ */

export type AtomKind = 'char' | 'break'

export interface Atom {
  kind: AtomKind
  /** Graphème pour 'char', '\n' pour 'break' */
  text: string
  style: CharStyle
  /** href du <a> englobant, '' sinon */
  href: string
  /** id du marqueur [data-size-effect] englobant, '' sinon */
  effectId: string
}

/** Le nœud à créer pour un atome, et le nœud après lequel poser le curseur */
export interface AtomNodes {
  first: Node
  last: Node
}

/**
 * Lit le document en une liste plate d'atomes.
 * C'est la seule lecture du DOM : tout le reste du système travaille
 * sur des index dans ce tableau, ce qui rend les positions stables même
 * quand le DOM est entièrement reconstruit (undo, normalisation).
 */
export function readAtoms(root: HTMLElement): Atom[] {
  const atoms: Atom[] = []

  function walk(node: Node, style: CharStyle, href: string, effectId: string) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent || ''
      for (const g of graphemes(text)) {
        if (g === ZWS) continue          // marqueur de rendu, pas du contenu
        atoms.push({ kind: 'char', text: g, style, href, effectId })
      }
      return
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return

    const el = node as HTMLElement

    if (el.tagName === 'BR') {
      // Un <br> précédé de son marqueur ↵ a déjà été émis par celui-ci
      const prev = el.previousSibling
      if (prev && (prev as HTMLElement).classList?.contains('line-break')) return
      atoms.push({ kind: 'break', text: '\n', style, href, effectId })
      return
    }

    if (el.classList.contains('line-break')) {
      atoms.push({ kind: 'break', text: '\n', style, href, effectId })
      return
    }

    const nextHref = el.tagName === 'A' ? (el.getAttribute('href') || href) : href
    const nextEffect = el.dataset?.sizeEffect || effectId
    const nextStyle = mergeElementStyle(el, style)

    for (const child of Array.from(el.childNodes)) {
      walk(child, nextStyle, nextHref, nextEffect)
    }
  }

  for (const child of Array.from(root.childNodes)) {
    walk(child, EMPTY_STYLE, '', '')
  }

  return atoms
}

/**
 * Reconstruit le DOM depuis une liste d'atomes, en respectant l'invariant.
 * Retourne, pour chaque atome, les nœuds créés — ce qui permet de replacer
 * le curseur exactement.
 */
export function writeAtoms(root: HTMLElement, atoms: Atom[]): AtomNodes[] {
  const frag = document.createDocumentFragment()
  const nodes: AtomNodes[] = []

  // Conteneurs ouverts — regroupent les atomes consécutifs qui les partagent
  let linkEl: HTMLAnchorElement | null = null
  let linkHref = ''
  let markerEl: HTMLSpanElement | null = null
  let markerId = ''

  const container = (): Node => linkEl ?? markerEl ?? frag

  for (const atom of atoms) {
    // Un marqueur d'effet ne traverse jamais un saut de ligne
    const effectId = atom.kind === 'break' ? '' : atom.effectId
    const href = atom.kind === 'break' ? '' : atom.href

    if (effectId !== markerId) {
      markerEl = null
      markerId = effectId
      if (effectId) {
        markerEl = document.createElement('span')
        markerEl.dataset.sizeEffect = effectId
        // Le marqueur ne stocke QUE l'id : l'amplitude et la taille de base
        // sont relues du store au rendu, jamais figées ici.
        frag.appendChild(markerEl)
      }
    }
    if (href !== linkHref) {
      linkEl = null
      linkHref = href
      if (href) {
        linkEl = document.createElement('a')
        linkEl.href = href
        linkEl.target = '_blank'
        linkEl.style.color = 'inherit'
        linkEl.style.textDecoration = 'inherit'
        ;(markerEl ?? frag).appendChild(linkEl)
      }
    }

    if (atom.kind === 'break') {
      const marker = document.createElement('span')
      marker.className = 'line-break'
      marker.setAttribute('contenteditable', 'false')
      marker.textContent = '↵'
      const br = document.createElement('br')
      const zws = document.createTextNode(ZWS)
      const target = container()
      target.appendChild(marker)
      target.appendChild(br)
      target.appendChild(zws)
      nodes.push({ first: marker, last: zws })
      continue
    }

    const span = document.createElement('span')
    span.setAttribute('style', styleToCss(atom.style))
    span.textContent = atom.text
    container().appendChild(span)
    nodes.push({ first: span, last: span })
  }

  root.replaceChildren(frag)
  return nodes
}

/* ══════════════════════════════════════════
   Effets de taille — état DERIVE, jamais stocké
   ══════════════════════════════════════════ */

export interface SizeContext {
  baseSize: number
  /** Résout un id d'effet en profil forme [0,1] */
  resolveProfile: (id: string) => number[] | null
}

/**
 * Recalcule la taille de CHAQUE caractère situé dans un marqueur d'effet.
 *
 * C'est ici que se joue l'unicité du résultat : la taille n'est pas une
 * donnée qu'on écrit une fois puis qu'on retouche, c'est une fonction pure
 *
 *     taille(i) = baseSize + amplitude · profil(t_i)
 *
 * de (id de l'effet, taille de base, rang du caractère). Elle est
 * intégralement re-dérivée après chaque opération. Conséquence :
 * appliquer l'effet puis changer la taille, ou changer la taille puis
 * appliquer l'effet, donnent le MEME document — de même pour la couleur,
 * le gras, la frappe ou le collage intercalés. C'est aussi exactement la
 * formule affichée dans le créateur d'effets (a · f(b·(x−c))).
 *
 * L'amplitude vaut la taille de base : la plus grande lettre fait le double
 * de la plus petite, à toute échelle.
 */
export function applySizeEffects(root: HTMLElement, ctx: SizeContext) {
  const markers = root.querySelectorAll<HTMLElement>('[data-size-effect]')

  for (const marker of markers) {
    const profile = ctx.resolveProfile(marker.dataset.sizeEffect || '')
    if (!profile || profile.length === 0) continue

    // Seuls les caractères non-espace portent le profil ; les espaces
    // gardent la taille de base pour ne pas décaler la courbe.
    const spans: HTMLElement[] = []
    for (const el of marker.querySelectorAll<HTMLElement>('span')) {
      if (el.dataset.sizeEffect || el.classList.contains('line-break')) continue
      if (el.querySelector('span')) continue          // pas une feuille
      spans.push(el)
    }

    const inked = spans.filter(s => !isSpace(s.textContent || ''))
    const total = inked.length

    for (const span of spans) {
      const style = readCharStyle(span)
      if (isSpace(span.textContent || '')) {
        style.fontSize = `${ctx.baseSize}px`
      } else {
        const t = total <= 1 ? 0 : inked.indexOf(span) / (total - 1)
        const size = Math.max(
          MIN_SIZE,
          Math.round(ctx.baseSize + ctx.baseSize * sample(profile, t)),
        )
        style.fontSize = `${size}px`
      }
      writeCharStyle(span, style)
    }
  }
}

const MIN_SIZE = 8

/** Interpolation linéaire dans un profil forme [0,1] pour t ∈ [0,1] */
function sample(profile: number[], t: number): number {
  const idx = t * (profile.length - 1)
  const lo = Math.floor(idx)
  const hi = Math.min(lo + 1, profile.length - 1)
  const frac = idx - lo
  return profile[lo] * (1 - frac) + profile[hi] * frac
}

/**
 * Rétablit l'invariant sur tout le document, puis re-dérive les tailles
 * pilotées par un effet.
 *
 * Idempotente, et surtout : le résultat ne dépend QUE du contenu textuel,
 * des styles non pilotés par un effet, des ids d'effet et de la taille de
 * base. Deux chemins d'opérations menant au même triplet donnent le même
 * DOM, caractère par caractère.
 */
export function normalizeEditor(root: HTMLElement, ctx?: SizeContext): AtomNodes[] {
  const nodes = writeAtoms(root, readAtoms(root))
  if (ctx) applySizeEffects(root, ctx)
  return nodes
}

/* ══════════════════════════════════════════
   Sélection par offsets d'atomes
   ══════════════════════════════════════════ */

export interface AtomRange {
  /** index du premier atome sélectionné */
  start: number
  /** index APRES le dernier atome sélectionné (exclusif) */
  end: number
}

/** Liste ordonnée des nœuds d'atomes présents dans le DOM courant */
export function atomNodes(root: HTMLElement): AtomNodes[] {
  const out: AtomNodes[] = []

  function walk(node: Node) {
    if (node.nodeType !== Node.ELEMENT_NODE) return
    const el = node as HTMLElement

    if (el.classList.contains('line-break')) {
      // Groupe ↵ + <br> + zws : un seul atome
      let last: Node = el
      let n = el.nextSibling
      if (n && n.nodeName === 'BR') { last = n; n = n.nextSibling }
      if (n && n.nodeType === Node.TEXT_NODE && n.textContent === ZWS) last = n
      out.push({ first: el, last })
      return
    }
    if (el.tagName === 'BR') {
      const prev = el.previousSibling
      if (prev && (prev as HTMLElement).classList?.contains('line-break')) return
      out.push({ first: el, last: el })
      return
    }
    if (el.tagName === 'SPAN' && !el.dataset.sizeEffect) {
      out.push({ first: el, last: el })
      return
    }
    for (const child of Array.from(el.childNodes)) walk(child)
  }

  for (const child of Array.from(root.childNodes)) walk(child)
  return out
}

/** Position d'un nœud du DOM dans la liste des atomes */
function atomIndexOf(nodes: AtomNodes[], target: Node): number {
  for (let i = 0; i < nodes.length; i++) {
    const a = nodes[i]
    if (a.first === target || a.last === target) return i
    if (a.first.contains?.(target) || (a.first as Element).contains?.(target as Node)) return i
  }
  return -1
}

/** Lit la sélection courante en offsets d'atomes. null si hors éditeur. */
export function getAtomRange(root: HTMLElement): AtomRange | null {
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) return null
  const range = sel.getRangeAt(0)
  if (!root.contains(range.commonAncestorContainer)) return null

  const nodes = atomNodes(root)
  if (nodes.length === 0) return { start: 0, end: 0 }

  let start = -1
  let end = -1
  for (let i = 0; i < nodes.length; i++) {
    const probe = document.createRange()
    probe.selectNode(nodes[i].first)
    // L'atome i est-il dans la sélection ?
    if (range.intersectsNode(nodes[i].first)) {
      // intersectsNode est vrai pour un range collapsé posé au bord :
      // on exige un recouvrement strict
      const startsBefore = range.compareBoundaryPoints(Range.END_TO_START, probe) < 0
      const endsAfter = range.compareBoundaryPoints(Range.START_TO_END, probe) > 0
      if (startsBefore && endsAfter) {
        if (start === -1) start = i
        end = i + 1
      }
    }
  }

  if (start === -1) {
    // Sélection vide : position du curseur entre deux atomes
    const caret = caretAtomIndex(root, nodes, range)
    return { start: caret, end: caret }
  }
  return { start, end }
}

/** Index d'insertion du curseur (0 = avant le premier atome) */
function caretAtomIndex(root: HTMLElement, nodes: AtomNodes[], range: Range): number {
  for (let i = 0; i < nodes.length; i++) {
    const probe = document.createRange()
    probe.setStartBefore(nodes[i].first)
    probe.collapse(true)
    if (range.compareBoundaryPoints(Range.START_TO_START, probe) <= 0) return i
  }
  return nodes.length
}

/** Construit un Range DOM depuis des offsets d'atomes */
export function rangeFromAtoms(root: HTMLElement, r: AtomRange): Range | null {
  const nodes = atomNodes(root)
  const range = document.createRange()
  const start = Math.max(0, Math.min(r.start, nodes.length))
  const end = Math.max(start, Math.min(r.end, nodes.length))

  if (nodes.length === 0) {
    range.selectNodeContents(root)
    range.collapse(true)
    return range
  }
  if (start >= nodes.length) {
    range.setStartAfter(nodes[nodes.length - 1].last)
  } else {
    range.setStartBefore(nodes[start].first)
  }
  if (end === start) {
    range.collapse(true)
  } else {
    range.setEndAfter(nodes[end - 1].last)
  }
  return range
}

/** Applique des offsets d'atomes à la sélection du navigateur */
export function applyAtomRange(root: HTMLElement, r: AtomRange): boolean {
  const range = rangeFromAtoms(root, r)
  if (!range) return false
  const sel = window.getSelection()
  if (!sel) return false
  sel.removeAllRanges()
  sel.addRange(range)
  return true
}

/** Les spans feuilles des atomes [start, end) actuellement dans le DOM */
export function leafSpansInRange(root: HTMLElement, r: AtomRange): HTMLElement[] {
  const nodes = atomNodes(root)
  const out: HTMLElement[] = []
  for (let i = r.start; i < Math.min(r.end, nodes.length); i++) {
    const el = nodes[i].first as HTMLElement
    if (el.tagName === 'SPAN' && !el.classList.contains('line-break')) out.push(el)
  }
  return out
}
