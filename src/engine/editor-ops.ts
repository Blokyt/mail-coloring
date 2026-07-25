/**
 * Opérations d'édition — couche PURE, sans Solid, sans événements DOM.
 *
 * Chaque opération est une fonction
 *     (root, range, ctx, ...args) => void
 * qui mute le document puis rétablit l'invariant (voir editor-dom.ts).
 *
 * Cette séparation existe pour une raison précise : elle rend les
 * opérations testables sans navigateur, et permet de VERIFIER
 * automatiquement la propriété centrale du projet —
 *
 *     le document final ne dépend que de l'état final,
 *     jamais du chemin qui y a mené.
 *
 * Voir editor-ops.commutativity.test.ts.
 */

import {
  type Atom,
  type AtomRange,
  type CharStyle,
  type SizeContext,
  EMPTY_STYLE,
  isSpace,
  graphemes,
  readAtoms,
  writeAtoms,
  atomNodes,
  applySizeEffects,
  readCharStyle,
  writeCharStyle,
} from './editor-dom'

/* ══════════════════════════════════════════
   Noyau : toute opération est une transformation de la liste d'atomes
   ══════════════════════════════════════════ */

/**
 * Applique une transformation aux atomes de l'intervalle [start, end),
 * puis reconstruit le document et re-dérive les tailles pilotées.
 *
 * Passer par la liste d'atomes plutôt que par le DOM vivant élimine
 * d'un coup toute une classe de bugs : plus d'extractContents() qui
 * duplique un marqueur en coupant un mot en deux, plus de spans qui
 * s'imbriquent à chaque passe, plus de Range périmé.
 */
export function transformAtoms(
  root: HTMLElement,
  ctx: SizeContext,
  fn: (atoms: Atom[]) => Atom[],
) {
  const next = fn(readAtoms(root))
  writeAtoms(root, next)
  applySizeEffects(root, ctx)
}

/**
 * Que faire des espaces ?
 *
 *  - 'skip'    : inchangées. Correct pour la couleur du TEXTE : une espace
 *                n'a pas de glyphe, la colorer ne se voit pas.
 *  - 'apply'   : même transformation que les lettres. Correct pour un FOND
 *                uniforme : sans ça le surlignage est troué à chaque espace.
 *  - 'inherit' : reprennent le fond de la lettre précédente. Correct pour un
 *                cycle de couleurs de fond : le ruban reste continu sans
 *                introduire une couleur qui n'est pas dans le cycle.
 *
 * Dans tous les cas les espaces ne consomment JAMAIS d'index de cycle :
 * les couleurs restent alignées sur les lettres quel que soit l'espacement.
 */
type SpacePolicy = 'skip' | 'apply' | 'inherit'

/** Applique `fn` au style de chaque atome caractère de l'intervalle */
function mapStyle(
  atoms: Atom[],
  r: AtomRange,
  fn: (style: CharStyle, inkIdx: number, inkTotal: number, atom: Atom) => CharStyle,
  spaces: SpacePolicy = 'skip',
): Atom[] {
  const slice = atoms.slice(r.start, r.end)
  const inkTotal = slice.filter(a => a.kind === 'char' && !isSpace(a.text)).length
  let inkIdx = 0
  let lastInked: CharStyle | null = null

  return atoms.map((atom, i) => {
    if (i < r.start || i >= r.end || atom.kind !== 'char') return atom

    if (isSpace(atom.text)) {
      if (spaces === 'skip') return atom
      if (spaces === 'inherit') {
        if (!lastInked) return atom
        return { ...atom, style: { ...atom.style, backgroundColor: lastInked.backgroundColor } }
      }
      return { ...atom, style: fn({ ...atom.style }, inkIdx, inkTotal, atom) }
    }

    const style = fn({ ...atom.style }, inkIdx, inkTotal, atom)
    lastInked = style
    inkIdx++
    return { ...atom, style }
  })
}

/* ══════════════════════════════════════════
   Opérations de style
   ══════════════════════════════════════════ */

export type ToggleFormat = 'bold' | 'italic' | 'underline' | 'strike'

/** Bascule gras / italique / souligné / barré sur la sélection.
 *  Remplace document.execCommand, qui produisait des <b>/<font> imbriqués
 *  et cassait l'invariant « un span feuille = un graphème ». */
export function toggleFormat(root: HTMLElement, ctx: SizeContext, r: AtomRange, fmt: ToggleFormat) {
  const atoms = readAtoms(root)
  const slice = atoms.slice(r.start, r.end).filter(a => a.kind === 'char' && !isSpace(a.text))
  if (slice.length === 0) return
  // Si tout est déjà actif, on désactive — sinon on active tout.
  const allOn = slice.every(a => a.style[fmt])
  transformAtoms(root, ctx, as => mapStyle(as, r, s => ({ ...s, [fmt]: !allOn })))
}

/** Couleur de texte uniforme */
export function setColor(root: HTMLElement, ctx: SizeContext, r: AtomRange, color: string) {
  transformAtoms(root, ctx, as => mapStyle(as, r, s => ({ ...s, color })))
}

/** Couleur de fond uniforme ('' pour retirer).
 *  Les espaces sont incluses, sinon le surlignage est troué entre les mots. */
export function setBackground(root: HTMLElement, ctx: SizeContext, r: AtomRange, color: string) {
  transformAtoms(root, ctx, as => mapStyle(as, r, s => ({ ...s, backgroundColor: color }), 'apply'))
}

/** Police uniforme */
export function setFontFamily(root: HTMLElement, ctx: SizeContext, r: AtomRange, font: string) {
  transformAtoms(root, ctx, as => mapStyle(as, r, s => ({ ...s, fontFamily: font })))
}

/**
 * Taille uniforme sur la sélection.
 * Retire l'effet de taille éventuel : demander une taille fixe et demander
 * une taille pilotée par un profil sont deux intentions contradictoires,
 * la plus récente gagne. Sans ça le mot restait « piégé » dans son effet.
 */
export function setFontSize(root: HTMLElement, ctx: SizeContext, r: AtomRange, px: number) {
  transformAtoms(root, ctx, as =>
    mapStyle(as, r, s => ({ ...s, fontSize: `${px}px` }))
      .map((a, i) => (i >= r.start && i < r.end ? { ...a, effectId: '' } : a)),
  )
}

/**
 * Réinitialise entièrement le style de la sélection.
 *
 * Retire AUSSI le marqueur d'effet de taille. C'était le bug signalé :
 * l'ancienne version vidait `style.fontSize` mais laissait le marqueur,
 * et comme le slider ciblait `span[style*="font-size"]`, le mot devenait
 * définitivement insensible au changement de taille.
 */
export function clearStyle(root: HTMLElement, ctx: SizeContext, r: AtomRange, base: Partial<CharStyle> = {}) {
  transformAtoms(root, ctx, as =>
    as.map((a, i) => {
      if (i < r.start || i >= r.end || a.kind !== 'char') return a
      return { ...a, style: { ...EMPTY_STYLE, ...base }, effectId: '' }
    }),
  )
}

/* ══════════════════════════════════════════
   Effets
   ══════════════════════════════════════════ */

/**
 * Applique un cycle de couleurs, une couleur par caractère encré.
 * Les espaces sont sautées ET ne consomment pas d'index : le cycle reste
 * aligné sur les lettres quel que soit l'espacement.
 */
export function applyColorCycle(
  root: HTMLElement,
  ctx: SizeContext,
  r: AtomRange,
  colors: string[],
  mode: 'text' | 'bg' = 'text',
) {
  if (colors.length === 0) return
  transformAtoms(root, ctx, as =>
    mapStyle(as, r, (s, i) => {
      const c = colors[i % colors.length]
      return mode === 'bg' ? { ...s, backgroundColor: c } : { ...s, color: c }
    }, mode === 'bg' ? 'inherit' : 'skip'),
  )
}

/**
 * Applique un effet de taille : pose UNIQUEMENT le marqueur.
 *
 * Aucune taille n'est écrite ici. Les tailles sont dérivées par
 * applySizeEffects() à partir de (id, taille de base, rang), et re-dérivées
 * après chaque opération ultérieure. C'est ce qui garantit qu'un mot
 * portant un effet a exactement une apparence possible.
 */
export function applySizeEffect(root: HTMLElement, ctx: SizeContext, r: AtomRange, effectId: string) {
  transformAtoms(root, ctx, as =>
    as.map((a, i) => (i >= r.start && i < r.end && a.kind === 'char' ? { ...a, effectId } : a)),
  )
}

/** Retire l'effet de taille, les caractères retombent à la taille de base */
export function removeSizeEffect(root: HTMLElement, ctx: SizeContext, r: AtomRange) {
  transformAtoms(root, ctx, as =>
    as.map((a, i) => {
      if (i < r.start || i >= r.end || a.kind !== 'char') return a
      return { ...a, effectId: '', style: { ...a.style, fontSize: `${ctx.baseSize}px` } }
    }),
  )
}

/* ══════════════════════════════════════════
   Liens
   ══════════════════════════════════════════ */

export function setLink(root: HTMLElement, ctx: SizeContext, r: AtomRange, href: string) {
  transformAtoms(root, ctx, as =>
    as.map((a, i) => (i >= r.start && i < r.end && a.kind === 'char' ? { ...a, href } : a)),
  )
}

export function removeLink(root: HTMLElement, ctx: SizeContext, r: AtomRange) {
  setLink(root, ctx, r, '')
}

/* ══════════════════════════════════════════
   Contenu
   ══════════════════════════════════════════ */

/**
 * Insère du texte à la position `r`, en remplaçant la sélection.
 *
 * Les caractères héritent de l'effet de taille et du lien des atomes
 * VOISINS quand l'insertion est strictement à l'intérieur du même mot.
 * L'ancienne version clonait le marqueur pour insérer en enfant direct de
 * l'éditeur, ce qui coupait un mot à effet en deux marqueurs de même id,
 * chacun rejouant le profil complet.
 */
export function insertText(
  root: HTMLElement,
  ctx: SizeContext,
  r: AtomRange,
  text: string,
  style: CharStyle,
): AtomRange {
  const atoms = readAtoms(root)
  const before = atoms[r.start - 1]
  const after = atoms[r.end]

  // Hérite du contexte seulement si les deux bords le partagent :
  // on ne prolonge jamais un effet au-delà de son mot.
  const inheritEffect = before?.kind === 'char' && after?.kind === 'char'
    && before.effectId && before.effectId === after.effectId ? before.effectId : ''
  const inheritHref = before?.kind === 'char' && after?.kind === 'char'
    && before.href && before.href === after.href ? before.href : ''

  const inserted: Atom[] = graphemes(text).map(g =>
    g === '\n'
      ? { kind: 'break' as const, text: '\n', style, href: '', effectId: '' }
      : { kind: 'char' as const, text: g, style, href: inheritHref, effectId: inheritEffect },
  )

  const next = [...atoms.slice(0, r.start), ...inserted, ...atoms.slice(r.end)]
  writeAtoms(root, next)
  applySizeEffects(root, ctx)

  const caret = r.start + inserted.length
  return { start: caret, end: caret }
}

/** Supprime les atomes [start, end), ou celui d'avant si l'intervalle est vide */
export function deleteRange(root: HTMLElement, ctx: SizeContext, r: AtomRange): AtomRange {
  const atoms = readAtoms(root)
  const start = r.end > r.start ? r.start : Math.max(0, r.start - 1)
  const end = r.end > r.start ? r.end : r.start
  const next = [...atoms.slice(0, start), ...atoms.slice(end)]
  writeAtoms(root, next)
  applySizeEffects(root, ctx)
  return { start, end: start }
}

/** Insère un saut de ligne */
export function insertBreak(root: HTMLElement, ctx: SizeContext, r: AtomRange, style: CharStyle): AtomRange {
  return insertText(root, ctx, r, '\n', style)
}

/* ══════════════════════════════════════════
   Taille de base
   ══════════════════════════════════════════ */

/**
 * Change la taille de base.
 *
 * Les caractères pilotés par un effet sont re-dérivés (l'effet garde sa
 * forme et son amplitude relative) ; les autres sont réécrits à la taille
 * demandée. Le résultat est identique à « régler la taille PUIS appliquer
 * l'effet » — c'est la propriété de commutation exigée.
 *
 * Si `r` est fourni, seule cette portion est retaillée ; sinon tout le
 * document suit la nouvelle base.
 */
export function setBaseSize(root: HTMLElement, baseSize: number, resolveProfile: SizeContext['resolveProfile'], r?: AtomRange) {
  const ctx: SizeContext = { baseSize, resolveProfile }
  transformAtoms(root, ctx, as =>
    as.map((a, i) => {
      if (a.kind !== 'char' || a.effectId) return a
      if (r && (i < r.start || i >= r.end)) return a
      return { ...a, style: { ...a.style, fontSize: `${baseSize}px` } }
    }),
  )
}

/**
 * Aperçu de la taille de base PENDANT le glissement du slider.
 *
 * Fait le même calcul que setBaseSize() mais modifie les tailles EN PLACE,
 * sans passer par writeAtoms(). C'est indispensable, pas une optimisation :
 * writeAtoms() remplace tous les nœuds de l'éditeur, ce qui détruit la
 * sélection du document. Il fallait donc la réappliquer à chaque événement
 * `input`, or poser une sélection dans un contenteditable y déplace le
 * focus — le slider était donc défocalisé en plein glissement et le drag
 * s'interrompait. D'où le symptôme : avec du texte sélectionné il fallait
 * cliquer point par point, alors que sans sélection (aucune restauration à
 * faire) le glissement fonctionnait.
 *
 * En ne restructurant rien, les nœuds survivent, la sélection reste valide,
 * le focus ne bouge pas, et le glissement est continu.
 *
 * Le résultat est identique à celui de setBaseSize() : mêmes tailles
 * écrites, même re-dérivation des effets. Vérifié par test.
 */
export function previewBaseSize(root: HTMLElement, baseSize: number, resolveProfile: SizeContext['resolveProfile'], r?: AtomRange) {
  const nodes = atomNodes(root)
  const from = r ? Math.max(0, r.start) : 0
  const to = r ? Math.min(r.end, nodes.length) : nodes.length

  for (let i = from; i < to; i++) {
    const el = nodes[i].first as HTMLElement
    if (el?.tagName !== 'SPAN' || el.classList.contains('line-break')) continue
    // Les caractères pilotés par un effet sont re-dérivés juste après
    if (el.closest('[data-size-effect]')) continue
    // Passer par writeCharStyle et non par el.style.fontSize : le CSSOM
    // resérialise l'attribut avec des espaces, ce qui rendrait l'aperçu
    // textuellement différent de la validation alors que le rendu est le
    // même — et ferait diverger les instantanés d'undo.
    const style = readCharStyle(el)
    style.fontSize = `${baseSize}px`
    writeCharStyle(el, style)
  }

  applySizeEffects(root, { baseSize, resolveProfile })
}
