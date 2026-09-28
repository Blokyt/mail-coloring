/**
 * PARITÉ DES CHEMINS RAPIDES — la propriété centrale du projet :
 *
 *     le document final ne dépend que de l'état final,
 *     jamais du chemin qui y a mené.
 *
 * insertTextInPlace / deleteRangeInPlace sont les chemins de la frappe :
 * ils mutent le DOM en place et splice le cache au lieu de reconstruire
 * tout le document. S'ils divergeaient d'un iota du chemin complet
 * (insertText / deleteRange), la frappe produirait un document différent
 * d'un collage ou d'une opération de style — exactement la classe de bug
 * que l'invariant interdit. Chaque test exécute les DEUX chemins sur des
 * documents jumeaux et exige le même innerHTML.
 */

import { describe, it, expect } from 'vitest'
import {
  normalizeEditor, readAtoms, atomNodes, invalidateDocCache,
  type SizeContext, type AtomRange, type CharStyle,
} from './editor-dom'
import * as ops from './editor-ops'
import { DEFAULT_SIZE_EFFECTS } from './effects'

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

/** Exécute le même scénario sur deux documents jumeaux : l'un par le
 *  chemin complet, l'autre par le chemin rapide. Exige le même HTML. */
function parity(
  build: () => HTMLElement,
  run: (root: HTMLElement, fast: boolean) => AtomRange | null,
) {
  const slow = build()
  const fast = build()
  const rSlow = run(slow, false)
  const rFast = run(fast, true)
  expect(rFast, 'le chemin rapide doit aboutir').not.toBeNull()
  expect(rSlow).toEqual(rFast)
  expect(fast.innerHTML, 'innerHTML identique au chemin complet').toBe(slow.innerHTML)
  // Le cache doit refléter le document vivant
  expect(readAtoms(fast).map(a => a.text).join('')).toBe(readAtoms(slow).map(a => a.text).join(''))
  expect(atomNodes(fast).length).toBe(readAtoms(fast).length)
  return fast
}

const insert = (root: HTMLElement, r: AtomRange, text: string, fast: boolean) =>
  fast
    ? ops.insertTextInPlace(root, ctxAt(18), r, text, STYLE)
    : ops.insertText(root, ctxAt(18), r, text, STYLE)

const del = (root: HTMLElement, r: AtomRange, fast: boolean) =>
  fast
    ? ops.deleteRangeInPlace(root, ctxAt(18), r)
    : ops.deleteRange(root, ctxAt(18), r)

describe('parité insertion en place', () => {
  it('frappe au milieu d\'un mot simple', () => {
    parity(
      () => makeEditor('Bonjour le monde'),
      (root, fast) => insert(root, { start: 3, end: 3 }, 'x', fast),
    )
  })

  it('frappe en fin de document', () => {
    parity(
      () => makeEditor('abc'),
      (root, fast) => insert(root, { start: 3, end: 3 }, 'de', fast),
    )
  })

  it('frappe en début de document', () => {
    parity(
      () => makeEditor('abc'),
      (root, fast) => insert(root, { start: 0, end: 0 }, 'X', fast),
    )
  })

  it('frappe dans un mot portant un effet de taille (rangs re-dérivés)', () => {
    const build = () => {
      const root = makeEditor('hello world')
      ops.applySizeEffect(root, ctxAt(18), { start: 0, end: 5 }, 'arche')
      return root
    }
    parity(build, (root, fast) => insert(root, { start: 2, end: 2 }, 'X', fast))
    // Vérification spécifique : les tailles dérivées sont identiques
    const slow = build()
    ops.insertText(slow, ctxAt(18), { start: 2, end: 2 }, 'X', STYLE)
    const fast = build()
    ops.insertTextInPlace(fast, ctxAt(18), { start: 2, end: 2 }, 'X', STYLE)
    expect(
      [...fast.querySelectorAll<HTMLElement>('[data-size-effect] span')].map(s => s.style.fontSize),
    ).toEqual(
      [...slow.querySelectorAll<HTMLElement>('[data-size-effect] span')].map(s => s.style.fontSize),
    )
  })

  it('frappe au bord d\'un marqueur ne prolonge pas l\'effet', () => {
    const build = () => {
      const root = makeEditor('hello world')
      ops.applySizeEffect(root, ctxAt(18), { start: 0, end: 5 }, 'arche')
      return root
    }
    // juste après le mot à effet (atome 5 = l'espace)
    parity(build, (root, fast) => insert(root, { start: 5, end: 5 }, 'Z', fast))
  })

  it('frappe dans un mot lié prolonge le lien', () => {
    const build = () => {
      const root = makeEditor('voir le site ici')
      ops.setLink(root, ctxAt(18), { start: 9, end: 13 }, 'https://example.com')
      return root
    }
    parity(build, (root, fast) => insert(root, { start: 11, end: 11 }, 'X', fast))
    const fast = build()
    ops.insertTextInPlace(fast, ctxAt(18), { start: 11, end: 11 }, 'X', STYLE)
    expect(fast.querySelectorAll('a').length).toBe(1)
  })

  it('remplacement d\'une sélection (coller par-dessus)', () => {
    parity(
      () => makeEditor('Bonjour le monde'),
      (root, fast) => insert(root, { start: 0, end: 7 }, 'Salut', fast),
    )
  })

  it('saut de ligne (Entrée)', () => {
    parity(
      () => makeEditor('ab'),
      (root, fast) => insert(root, { start: 1, end: 1 }, '\n', fast),
    )
  })

  it('suppression d\'un marqueur entier vide le conteneur', () => {
    const build = () => {
      const root = makeEditor('ab')
      ops.applySizeEffect(root, ctxAt(18), { start: 0, end: 2 }, 'arche')
      return root
    }
    parity(build, (root, fast) => del(root, { start: 0, end: 2 }, fast))
    // après suppression totale du mot à effet, plus aucun marqueur
    const fast = build()
    ops.deleteRangeInPlace(fast, ctxAt(18), { start: 0, end: 2 })
    expect(fast.querySelectorAll('[data-size-effect]').length).toBe(0)
    expect(fast.textContent).toBe('')
  })
})

describe('parité suppression en place', () => {
  it('retour arrière au milieu d\'un mot', () => {
    parity(
      () => makeEditor('Bonjour le monde'),
      (root, fast) => del(root, { start: 7, end: 7 }, fast),
    )
  })

  it('suppression d\'une sélection', () => {
    parity(
      () => makeEditor('Bonjour le monde'),
      (root, fast) => del(root, { start: 0, end: 7 }, fast),
    )
  })

  it('suppression d\'un mot à effet re-dérive les rangs restants', () => {
    const build = () => {
      const root = makeEditor('hello')
      ops.applySizeEffect(root, ctxAt(18), { start: 0, end: 5 }, 'arche')
      return root
    }
    parity(build, (root, fast) => del(root, { start: 1, end: 1 }, fast))
  })

  it('suppression d\'un saut de ligne', () => {
    const build = () => {
      const root = makeEditor('ab')
      ops.insertBreak(root, ctxAt(18), { start: 1, end: 1 }, STYLE)
      return root
    }
    parity(build, (root, fast) => del(root, { start: 2, end: 2 }, fast))
  })
})

describe('cohérence du cache', () => {
  it('une réécriture innerHTML externe (undo) invalide le cache', () => {
    const root = makeEditor('Bonjour le monde')
    // le cache est peuplé
    readAtoms(root)
    atomNodes(root)
    // undo simulé : même contenu, nœufs neufs
    root.innerHTML = root.innerHTML
    // le cache doit se rendre compte et relire le DOM vivant
    const spans = [...root.querySelectorAll('span')]
    expect(spans.length).toBeGreaterThan(0)
    expect(atomNodes(root).map(n => n.first)).toEqual(spans)
  })

  it('invalidateDocCache force la relecture', () => {
    const root = makeEditor('abc')
    readAtoms(root)
    invalidateDocCache(root)
    root.textContent = 'xyz'
    normalizeEditor(root, ctxAt(18))
    expect(readAtoms(root).map(a => a.text).join('')).toBe('xyz')
  })

  it('le chemin rapide reste rapide : le cache survit à la frappe', () => {
    const root = makeEditor('Bonjour le monde')  // 16 atomes
    expect(ops.insertTextInPlace(root, ctxAt(18), { start: 16, end: 16 }, ' ', STYLE)).not.toBeNull()
    // la 2e frappe doit encore trouver le cache (pas de repli)
    expect(ops.insertTextInPlace(root, ctxAt(18), { start: 17, end: 17 }, 'X', STYLE)).not.toBeNull()
    expect(readAtoms(root).map(a => a.text).join('')).toBe('Bonjour le monde X')
  })
})
