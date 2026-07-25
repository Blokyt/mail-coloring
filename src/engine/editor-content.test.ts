/**
 * Couverture du reste de l'éditeur : contenu, sauts de ligne, emojis,
 * collage, suppression, liens, et export Outlook.
 *
 * Complète editor-ops.test.ts (qui porte sur la commutation) pour couvrir
 * tout ce qu'un utilisateur peut réellement faire dans l'éditeur.
 */

import { describe, it, expect } from 'vitest'
import {
  normalizeEditor, readAtoms, atomNodes, getAtomRange, applyAtomRange,
  rangeFromAtoms, isSpace, NBSP,
  type SizeContext, type AtomRange, type CharStyle,
} from './editor-dom'
import * as ops from './editor-ops'
import { cleanForOutlook, DEFAULT_SIZE_EFFECTS } from './effects'

const SAMPLES = 64
const PROFILES: Record<string, number[]> = Object.fromEntries(
  Object.entries(DEFAULT_SIZE_EFFECTS).map(([id, e]) => [
    id, Array.from({ length: SAMPLES }, (_, i) => e.getShape(i / (SAMPLES - 1))),
  ]),
)
const resolve = (id: string) => PROFILES[id] ?? null
const ctxAt = (baseSize: number): SizeContext => ({ baseSize, resolveProfile: resolve })

const STYLE: CharStyle = {
  color: '#374151', backgroundColor: '', fontSize: '18px', fontFamily: 'Arial',
  bold: false, italic: false, underline: false, strike: false,
}

function makeEditor(text = 'Bonjour le monde'): HTMLElement {
  const el = document.createElement('div')
  el.textContent = text
  normalizeEditor(el, ctxAt(18))
  ops.setBaseSize(el, 18, resolve)
  return el
}

const all = (root: HTMLElement): AtomRange => ({ start: 0, end: readAtoms(root).length })
const markerCount = (root: HTMLElement) => root.querySelectorAll('[data-size-effect]').length
const sizesIn = (root: HTMLElement, sel = '[data-size-effect] span') =>
  [...root.querySelectorAll<HTMLElement>(sel)].map(s => parseInt(s.style.fontSize))

/* ══════════════════════════════════════════
   Sauts de ligne
   ══════════════════════════════════════════ */

describe('sauts de ligne', () => {
  it('un saut de ligne survit à la normalisation et reste un seul atome', () => {
    const root = makeEditor('ab')
    ops.insertBreak(root, ctxAt(18), { start: 1, end: 1 }, STYLE)

    const atoms = readAtoms(root)
    expect(atoms.map(a => a.kind)).toEqual(['char', 'break', 'char'])
    expect(atomNodes(root)).toHaveLength(3)

    const before = root.innerHTML
    normalizeEditor(root, ctxAt(18))
    expect(root.innerHTML).toBe(before)
  })

  it('le marqueur ↵ est accompagné de son <br> et non éditable', () => {
    const root = makeEditor('ab')
    ops.insertBreak(root, ctxAt(18), { start: 1, end: 1 }, STYLE)
    const marker = root.querySelector('.line-break')!
    expect(marker.getAttribute('contenteditable')).toBe('false')
    expect(marker.nextSibling?.nodeName).toBe('BR')
  })

  it('un effet de taille ne traverse jamais un saut de ligne', () => {
    const root = makeEditor('ab')
    ops.insertBreak(root, ctxAt(18), { start: 1, end: 1 }, STYLE)
    // On applique l'effet sur TOUT, saut de ligne compris
    ops.applySizeEffect(root, ctxAt(18), all(root), 'montee')

    // Deux marqueurs distincts, un par ligne — pas un seul à cheval
    expect(markerCount(root)).toBe(2)
    for (const m of root.querySelectorAll('[data-size-effect]')) {
      expect(m.querySelector('.line-break')).toBeNull()
      expect(m.querySelector('br')).toBeNull()
    }
  })

  it('supprimer un saut de ligne recolle les deux lignes', () => {
    const root = makeEditor('ab')
    ops.insertBreak(root, ctxAt(18), { start: 1, end: 1 }, STYLE)
    expect(readAtoms(root)).toHaveLength(3)
    ops.deleteRange(root, ctxAt(18), { start: 1, end: 2 })
    expect(readAtoms(root).map(a => a.text).join('')).toBe('ab')
    expect(root.querySelector('.line-break')).toBeNull()
    expect(root.querySelector('br')).toBeNull()
  })
})

/* ══════════════════════════════════════════
   Emojis et graphèmes composés
   ══════════════════════════════════════════ */

describe('emojis', () => {
  const EMOJIS = ['😀', '👨‍👩‍👧‍👦', '🇫🇷', '👍🏽', 'é', 'é']

  it('chaque emoji reste un seul span, quelle que soit sa composition', () => {
    for (const e of EMOJIS) {
      const root = makeEditor(`a${e}b`)
      const texts = [...root.querySelectorAll('span')].map(s => s.textContent)
      expect(texts, `emoji ${e}`).toEqual(['a', e, 'b'])
    }
  })

  it('un emoji dans un mot à effet compte pour un caractère du profil', () => {
    const root = makeEditor('ab😀cd')
    ops.applySizeEffect(root, ctxAt(20), all(root), 'montee')
    const sizes = sizesIn(root)
    expect(sizes).toHaveLength(5)
    // Montée linéaire sur 5 caractères : 20 → 40, strictement croissante
    expect(sizes).toEqual([...sizes].sort((a, b) => a - b))
    expect(sizes[0]).toBe(20)
    expect(sizes[4]).toBe(40)
  })

  it('insérer un emoji dans un mot à effet ne casse ni le marqueur ni le profil', () => {
    const root = makeEditor('abcd')
    ops.applySizeEffect(root, ctxAt(20), all(root), 'montee')
    ops.insertText(root, ctxAt(20), { start: 2, end: 2 }, '👍🏽', STYLE)
    expect(markerCount(root)).toBe(1)
    const sizes = sizesIn(root)
    expect(sizes).toHaveLength(5)
    expect(sizes).toEqual([...sizes].sort((a, b) => a - b))
  })
})

/* ══════════════════════════════════════════
   Collage et suppression
   ══════════════════════════════════════════ */

describe('collage et suppression', () => {
  it('coller du texte multiligne produit des sauts de ligne réels', () => {
    const root = makeEditor('ab')
    ops.insertText(root, ctxAt(18), { start: 2, end: 2 }, '\ncd\nef', STYLE)
    const atoms = readAtoms(root)
    expect(atoms.map(a => a.text).join('')).toBe('ab\ncd\nef')
    expect(root.querySelectorAll('.line-break')).toHaveLength(2)
  })

  it('coller par-dessus une sélection la remplace', () => {
    const root = makeEditor('abcdef')
    ops.insertText(root, ctxAt(18), { start: 1, end: 4 }, 'XY', STYLE)
    expect(readAtoms(root).map(a => a.text).join('')).toBe('aXYef')
  })

  it('supprimer au milieu d\'un mot à effet re-étale le profil sans dupliquer', () => {
    const root = makeEditor('abcdef')
    ops.applySizeEffect(root, ctxAt(20), { start: 0, end: 6 }, 'montee')
    expect(sizesIn(root)).toHaveLength(6)
    ops.deleteRange(root, ctxAt(20), { start: 2, end: 3 })
    expect(markerCount(root)).toBe(1)
    const sizes = sizesIn(root)
    expect(sizes).toHaveLength(5)
    expect(sizes[0]).toBe(20)
    expect(sizes[4]).toBe(40)
  })

  it('tout supprimer laisse un éditeur vide et normalisable', () => {
    const root = makeEditor('abc')
    ops.deleteRange(root, ctxAt(18), all(root))
    expect(readAtoms(root)).toHaveLength(0)
    expect(root.innerHTML).toBe('')
    normalizeEditor(root, ctxAt(18))
    expect(root.innerHTML).toBe('')
  })

  it('les espaces insécables tapées ne sont pas comptées dans le profil', () => {
    const root = makeEditor(`ab${NBSP}cd`)
    expect(isSpace(NBSP)).toBe(true)
    ops.applySizeEffect(root, ctxAt(20), all(root), 'montee')
    const spans = [...root.querySelectorAll<HTMLElement>('[data-size-effect] span')]
    const space = spans.find(s => isSpace(s.textContent || ''))!
    expect(space.style.fontSize).toBe('20px')      // reste à la taille de base
    const inked = spans.filter(s => !isSpace(s.textContent || ''))
    expect(inked.map(s => parseInt(s.style.fontSize))).toEqual([20, 27, 33, 40])
  })
})

/* ══════════════════════════════════════════
   Liens
   ══════════════════════════════════════════ */

describe('liens', () => {
  it('un lien regroupe les caractères dans un seul <a>', () => {
    const root = makeEditor('Bonjour le monde')
    ops.setLink(root, ctxAt(18), { start: 0, end: 7 }, 'https://mines.fr')
    const links = root.querySelectorAll('a')
    expect(links).toHaveLength(1)
    expect(links[0].getAttribute('href')).toBe('https://mines.fr')
    expect(links[0].querySelectorAll('span')).toHaveLength(7)
  })

  it('retirer le lien conserve exactement le style des caractères', () => {
    const root = makeEditor('Bonjour')
    ops.setColor(root, ctxAt(18), all(root), '#c42b45')
    const before = root.innerHTML
    ops.setLink(root, ctxAt(18), all(root), 'https://mines.fr')
    ops.removeLink(root, ctxAt(18), all(root))
    expect(root.innerHTML).toBe(before)
  })

  it('lien et effet de taille coexistent sans s\'imbriquer de travers', () => {
    const root = makeEditor('Bonjour')
    ops.applySizeEffect(root, ctxAt(18), all(root), 'arche')
    ops.setLink(root, ctxAt(18), all(root), 'https://mines.fr')
    expect(markerCount(root)).toBe(1)
    expect(root.querySelectorAll('a')).toHaveLength(1)
    // L'invariant interdit qu'un span FEUILLE en contienne un autre.
    // Le marqueur d'effet est un conteneur légitime, comme le <a>.
    const leaves = [...root.querySelectorAll<HTMLElement>('span')]
      .filter(s => !s.dataset.sizeEffect)
    expect(leaves.filter(s => s.querySelector('span'))).toHaveLength(0)
    expect(sizesIn(root, '[data-size-effect] a span')).toHaveLength(7)
  })
})

/* ══════════════════════════════════════════
   Sélection par offsets
   ══════════════════════════════════════════ */

describe('sélection par offsets', () => {
  it('lire puis réappliquer une sélection est fidèle', () => {
    const root = document.body.appendChild(document.createElement('div'))
    root.textContent = 'Bonjour le monde'
    normalizeEditor(root, ctxAt(18))

    for (const r of [{ start: 0, end: 7 }, { start: 3, end: 4 }, { start: 8, end: 16 }, { start: 5, end: 5 }]) {
      applyAtomRange(root, r)
      expect(getAtomRange(root), `plage ${r.start}-${r.end}`).toEqual(r)
    }
    root.remove()
  })

  it('les offsets survivent à une reconstruction complète du DOM', () => {
    const root = makeEditor('Bonjour le monde')
    const sel = { start: 0, end: 7 }
    const html = root.innerHTML
    // Simule un undo : innerHTML remplacé, tous les nœuds sont neufs
    root.innerHTML = html
    const spans = [...root.querySelectorAll('span')]
    const range = rangeFromAtoms(root, sel)!
    expect(range.startContainer.contains?.(spans[0]) || range.startContainer === root).toBe(true)
    expect(readAtoms(root).slice(sel.start, sel.end).map(a => a.text).join('')).toBe('Bonjour')
  })

  it('une plage hors bornes est ramenée dans le document sans lever', () => {
    const root = makeEditor('abc')
    expect(() => rangeFromAtoms(root, { start: 99, end: 200 })).not.toThrow()
    expect(() => ops.setColor(root, ctxAt(18), { start: 99, end: 200 }, '#f00')).not.toThrow()
  })
})

/* ══════════════════════════════════════════
   Export Outlook
   ══════════════════════════════════════════ */

describe('export Outlook', () => {
  const exportOf = (root: HTMLElement) => cleanForOutlook(root.innerHTML)

  it('les marqueurs internes n\'apparaissent jamais dans la sortie', () => {
    const root = makeEditor('Bonjour le monde')
    ops.applySizeEffect(root, ctxAt(18), { start: 0, end: 7 }, 'arche')
    ops.insertBreak(root, ctxAt(18), { start: 7, end: 7 }, STYLE)
    const html = exportOf(root)
    expect(html).not.toContain('data-size-effect')
    expect(html).not.toContain('line-break')
    expect(html).not.toContain('↵')
  })

  it('les couleurs sont converties en hexadécimal (Outlook refuse rgb())', () => {
    const root = makeEditor('abc')
    ops.setColor(root, ctxAt(18), all(root), 'rgb(196, 43, 69)')
    const html = exportOf(root)
    expect(html).not.toMatch(/rgb\(/)
    expect(html.toLowerCase()).toContain('#c42b45')
  })

  it('les tailles de l\'effet sont préservées caractère par caractère', () => {
    const root = makeEditor('abcde')
    ops.applySizeEffect(root, ctxAt(20), all(root), 'montee')
    const expected = sizesIn(root)
    const html = exportOf(root)
    for (const px of expected) expect(html, `taille ${px}px absente`).toContain(`font-size:${px}px`)
  })

  it('gras/italique/souligné/barré ressortent en balises sémantiques', () => {
    const root = makeEditor('abc')
    for (const f of ['bold', 'italic', 'underline', 'strike'] as const) {
      ops.toggleFormat(root, ctxAt(18), all(root), f)
    }
    const html = exportOf(root)
    for (const tag of ['<b>', '<i>', '<u>', '<s>']) expect(html, tag).toContain(tag)
  })

  it('les espaces deviennent des &nbsp; et les sauts de ligne des <p>', () => {
    const root = makeEditor('ab cd')
    ops.insertBreak(root, ctxAt(18), { start: 5, end: 5 }, STYLE)
    ops.insertText(root, ctxAt(18), { start: 6, end: 6 }, 'ef', STYLE)
    const html = exportOf(root)
    expect(html).toContain('&nbsp;')
    expect((html.match(/<p /g) || []).length).toBeGreaterThanOrEqual(2)
  })

  it('un lien est exporté en <a href> cliquable', () => {
    const root = makeEditor('Bonjour')
    ops.setLink(root, ctxAt(18), all(root), 'https://mines.fr')
    expect(exportOf(root)).toContain('href="https://mines.fr"')
  })

  it('le texte visible est intégralement conservé', () => {
    const root = makeEditor('Bonjour le monde')
    ops.applySizeEffect(root, ctxAt(18), { start: 0, end: 7 }, 'vague')
    ops.applyColorCycle(root, ctxAt(18), { start: 8, end: 16 }, ['#f00', '#0f0'])
    const div = document.createElement('div')
    div.innerHTML = exportOf(root)
    expect((div.textContent || '').replace(/[ ​]/g, ' ').trim()).toBe('Bonjour le monde')
  })

  it('le HTML injecté dans le texte est échappé, pas exécuté', () => {
    const root = makeEditor('')
    ops.insertText(root, ctxAt(18), { start: 0, end: 0 }, '<script>x</script>', STYLE)
    const html = exportOf(root)
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;')
  })
})
