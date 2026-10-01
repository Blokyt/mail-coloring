/**
 * Parité rendu pur ↔ éditeur réel.
 *
 * Le contrat de l'API agent : renderSpec() doit produire EXACTEMENT le HTML
 * Outlook qu'un utilisateur obtiendrait en faisant la même chose sur le site
 * (frapper le texte, appliquer les effets, copier). Chaque test construit le
 * document par les opérations réelles de l'éditeur (ops + cleanForOutlook
 * sous happy-dom) et exige l'égalité octet pour octet avec renderSpec().
 *
 * Toute divergence nomme sa cause : cycle, espaces, tailles, échappement,
 * structure de paragraphe.
 */

import { describe, it, expect } from 'vitest'
import { normalizeEditor, type SizeContext } from './editor-dom'
import * as ops from './editor-ops'
import { cleanForOutlook, DEFAULT_SIZE_EFFECTS } from './effects'
import { renderSpec, renderText, type EffectsCatalog, type RenderBlockSpec } from './render'

const SAMPLES = 64

/** Profils échantillonnés comme en prod (cf. editor-ops.test.ts) */
const PROFILES: Record<string, number[]> = Object.fromEntries(
  Object.entries(DEFAULT_SIZE_EFFECTS).map(([id, e]) => [
    id,
    Array.from({ length: SAMPLES }, (_, i) => e.getShape(i / (SAMPLES - 1))),
  ]),
)

const ctxAt = (baseSize: number): SizeContext => ({
  baseSize,
  resolveProfile: (id) => PROFILES[id] ?? null,
})

const CATALOG: EffectsCatalog = {
  colorEffects: {
    arcenciel: { name: 'Arc-en-ciel', colors: ['#ff4d6d', '#ff8c42', '#ffd000', '#00c896', '#0096c7', '#7b2cbf', '#c026d3'] },
    ocean: { name: 'Océan', colors: ['#0077b6', '#00b4d8', '#48cae4', '#90e0ef'] },
  },
  sizeEffects: Object.fromEntries(Object.entries(PROFILES).map(([id, p]) => [id, { name: id, profile: p }])),
}

function makeEditor(text: string): HTMLElement {
  const el = document.createElement('div')
  el.textContent = text
  normalizeEditor(el, ctxAt(18))
  ops.setBaseSize(el, 18, id => PROFILES[id] ?? null)
  return el
}

const ALL = (root: HTMLElement) => {
  const n = root.querySelectorAll('span').length
  return { start: 0, end: n }
}

/** Document éditeur : texte + effets appliqués à tout le document */
function editorHtml(text: string, apply: (el: HTMLElement, ctx: SizeContext) => void): string {
  const el = makeEditor(text)
  const ctx = ctxAt(18)
  apply(el, ctx)
  return cleanForOutlook(el.innerHTML)
}

function specHtml(block: Omit<RenderBlockSpec, 'text'>, text: string): string {
  return renderText(text, block, { baseSize: 18 }, CATALOG)
}

describe('Parité rendu pur ↔ éditeur', () => {
  it('texte brut : tailles explicites de base, aucune couleur', () => {
    const expected = editorHtml('Bonjour le monde', () => {})
    const got = specHtml({}, 'Bonjour le monde')
    expect(got).toBe(expected)
  })

  it('cycle de couleurs : les espaces ne consomment pas d’index', () => {
    const colors = CATALOG.colorEffects.arcenciel.colors
    const expected = editorHtml('Soirée BDA vendredi', (el, ctx) => {
      ops.applyColorCycle(el, ctx, ALL(el), colors, 'text')
    })
    const got = specHtml({ colorEffect: 'arcenciel' }, 'Soirée BDA vendredi')
    expect(got).toBe(expected)
  })

  it('palette libre de couleurs', () => {
    const colors = ['#123456', '#654321', '#abcdef']
    const expected = editorHtml('Un mail coloré', (el, ctx) => {
      ops.applyColorCycle(el, ctx, ALL(el), colors, 'text')
    })
    const got = specHtml({ colors }, 'Un mail coloré')
    expect(got).toBe(expected)
  })

  it('cycle de fond : les espaces héritent du fond précédent', () => {
    const colors = ['#0077b6', '#00b4d8', '#48cae4', '#90e0ef']
    const expected = editorHtml('Salade de fonds', (el, ctx) => {
      ops.applyColorCycle(el, ctx, ALL(el), colors, 'bg')
    })
    const got = specHtml({ bgColors: colors }, 'Salade de fonds')
    expect(got).toBe(expected)
  })

  it('effet de taille seul : courbe dérivée', () => {
    const expected = editorHtml('Montée en puissance', (el, ctx) => {
      ops.applySizeEffect(el, ctx, ALL(el), 'montee')
    })
    const got = specHtml({ sizeEffect: 'montee' }, 'Montée en puissance')
    expect(got).toBe(expected)
  })

  it('taille + couleur commutent (le rendu pur suit le même document final)', () => {
    const colors = CATALOG.colorEffects.ocean.colors
    const expected = editorHtml('Vague océanique', (el, ctx) => {
      ops.applySizeEffect(el, ctx, ALL(el), 'vague')
      ops.applyColorCycle(el, ctx, ALL(el), colors, 'text')
    })
    const got = specHtml({ colorEffect: 'ocean', sizeEffect: 'vague' }, 'Vague océanique')
    expect(got).toBe(expected)
  })

  it('gras + souligné + taille + couleur', () => {
    const colors = CATALOG.colorEffects.arcenciel.colors
    const expected = editorHtml('Très important', (el, ctx) => {
      ops.applySizeEffect(el, ctx, ALL(el), 'arche')
      ops.applyColorCycle(el, ctx, ALL(el), colors, 'text')
      ops.toggleFormat(el, ctx, ALL(el), 'bold')
      ops.toggleFormat(el, ctx, ALL(el), 'underline')
    })
    const got = specHtml({ colorEffect: 'arcenciel', sizeEffect: 'arche', bold: true, underline: true }, 'Très important')
    expect(got).toBe(expected)
  })

  it('police posée sur le bloc', () => {
    const expected = editorHtml('Comic sans', (el, ctx) => {
      ops.setFontFamily(el, ctx, ALL(el), 'Comic Sans MS, cursive')
    })
    const got = specHtml({ font: 'Comic Sans MS, cursive' }, 'Comic sans')
    expect(got).toBe(expected)
  })

  it('emoji composé : un seul graphème par span', () => {
    const colors = ['#ff4d6d', '#ffd000']
    const expected = editorHtml('Fête 🎉 maintenant', (el, ctx) => {
      ops.applyColorCycle(el, ctx, ALL(el), colors, 'text')
    })
    const got = specHtml({ colors }, 'Fête 🎉 maintenant')
    expect(got).toBe(expected)
  })

  it('espaces multiples fusionnées, échappement HTML', () => {
    const colors = ['#ff4d6d', '#ffd000']
    const expected = editorHtml('A  <b> & voilà', (el, ctx) => {
      ops.applyColorCycle(el, ctx, ALL(el), colors, 'text')
    })
    const got = specHtml({ colors }, 'A  <b> & voilà')
    expect(got).toBe(expected)
  })
})

describe('Structure multi-blocs', () => {
  it('chaque bloc = une ligne <p> indépendante', () => {
    const html = renderSpec({
      baseSize: 18,
      blocks: [
        { text: 'Titre coloré', colorEffect: 'arcenciel', sizeEffect: 'montee', bold: true },
        { text: 'Corps du message, plus sobre.' },
        { text: '' },
        { text: 'À vendredi !', colors: ['#00b4d8'] },
      ],
    }, CATALOG)
    const lines = html.match(/<p /g)?.length ?? 0
    expect(lines).toBe(4)
    const text = html.replace(/<[^>]+>/g, '')
    expect(text).toContain('Corp')
    expect(text).toContain('vendredi')
    // un <p> vide vaut une ligne vide visible
    expect(html).toMatch(/<p style="margin:0;padding:0;mso-line-height-rule:exactly">&nbsp;<\/p>/)
  })

  it('bloc html brut servi tel quel', () => {
    const html = renderSpec({ blocks: [{ html: '<span style="color:#ff0000">rouge</span>' }] }, CATALOG)
    expect(html).toContain('<span style="color:#ff0000">rouge</span>')
    expect(html.match(/<p /g)?.length).toBe(1)
  })
})
