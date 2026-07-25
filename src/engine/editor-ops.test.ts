/**
 * Tests de COMMUTATION.
 *
 * Exigence du projet : « il doit y avoir unicité du résultat indépendamment
 * du chemin ». Un mot portant un effet de taille, à une taille de base
 * donnée, n'a qu'une apparence possible, quel que soit l'ordre dans lequel
 * on a appliqué couleur, gras, lien, frappe, effet et taille.
 *
 * Ces tests énumèrent TOUTES les permutations d'un jeu d'opérations
 * indépendantes et exigent un document identique caractère par caractère.
 * Si une seule permutation diverge, le test nomme laquelle.
 */

import { describe, it, expect } from 'vitest'
import { normalizeEditor, readAtoms, type SizeContext, type AtomRange } from './editor-dom'
import * as ops from './editor-ops'
import { normalizeProfile, evaluateMathExprSafe, DEFAULT_SIZE_EFFECTS } from './effects'

/* ── Contexte de test ── */

const SAMPLES = 64

/** Profils de test : les effets de base réels, échantillonnés comme en prod */
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

function makeEditor(text = 'Bonjour le monde'): HTMLElement {
  const el = document.createElement('div')
  el.textContent = text
  normalizeEditor(el, ctxAt(18))
  // La frappe écrit toujours une taille explicite : on part du même état.
  ops.setBaseSize(el, 18, id => PROFILES[id] ?? null)
  return el
}

/** Sélectionne les atomes du n-ième mot (séparé par des espaces) */
function wordRange(root: HTMLElement, wordIdx: number): AtomRange {
  const atoms = readAtoms(root)
  let idx = 0
  let start = -1
  for (let i = 0; i <= atoms.length; i++) {
    const isEnd = i === atoms.length
    const isSep = isEnd || atoms[i].text === ' ' || atoms[i].text === ' ' || atoms[i].kind === 'break'
    if (!isSep && start === -1) start = i
    if (isSep && start !== -1) {
      if (idx === wordIdx) return { start, end: i }
      idx++
      start = -1
    }
  }
  return { start: 0, end: atoms.length }
}

/* ── Moteur de permutations ── */

/** L'appli lit toujours la taille de base COURANTE (un signal Solid).
 *  Le harnais doit faire pareil, sinon il teste un scénario impossible. */
interface OpState { base: number }

interface Op {
  name: string
  run: (root: HTMLElement, r: AtomRange, st: OpState) => void
}

const resolve = (id: string) => PROFILES[id] ?? null
const live = (st: OpState): SizeContext => ({ baseSize: st.base, resolveProfile: resolve })

function permutations<T>(items: T[]): T[][] {
  if (items.length <= 1) return [items]
  const out: T[][] = []
  for (let i = 0; i < items.length; i++) {
    const rest = [...items.slice(0, i), ...items.slice(i + 1)]
    for (const p of permutations(rest)) out.push([items[i], ...p])
  }
  return out
}

/**
 * Exécute toutes les permutations de `list` et exige un HTML identique.
 * Retourne l'HTML canonique.
 */
function expectCommutes(list: Op[], text = 'Bonjour le monde', wordIdx = 0): string {
  const results = new Map<string, string[]>()

  for (const perm of permutations(list)) {
    const root = makeEditor(text)
    const st: OpState = { base: 18 }
    for (const op of perm) op.run(root, wordRange(root, wordIdx), st)
    const html = root.innerHTML
    const label = perm.map(o => o.name).join(' → ')
    if (!results.has(html)) results.set(html, [])
    results.get(html)!.push(label)
  }

  if (results.size > 1) {
    const groups = [...results.entries()]
      .map(([html, labels]) => `\n  ${labels.length} chemin(s) : ${labels[0]}\n    ${html.slice(0, 320)}`)
      .join('\n')
    throw new Error(`${results.size} résultats différents selon l'ordre :\n${groups}`)
  }
  return [...results.keys()][0]
}

/* ══════════════════════════════════════════
   1. Invariant de document
   ══════════════════════════════════════════ */

describe('invariant de document', () => {
  it('normalizeEditor est idempotente', () => {
    const root = makeEditor()
    ops.applyColorCycle(root, ctxAt(18), wordRange(root, 0), ['#f00', '#0f0'])
    ops.applySizeEffect(root, ctxAt(18), wordRange(root, 1), 'arche')
    const once = root.innerHTML
    normalizeEditor(root, ctxAt(18))
    expect(root.innerHTML).toBe(once)
  })

  it('aplatit les <b>/<i>/<font> et les spans imbriqués en spans feuilles', () => {
    const root = document.createElement('div')
    root.innerHTML = '<b><span style="color:red"><span style="font-size:30px">Hi</span></span></b>'
    normalizeEditor(root, ctxAt(18))
    expect(root.querySelectorAll('b, font, i, u, s')).toHaveLength(0)
    expect(root.querySelectorAll('span span')).toHaveLength(0)
    const spans = [...root.querySelectorAll('span')]
    expect(spans).toHaveLength(2)
    expect(spans.map(s => s.textContent)).toEqual(['H', 'i'])
    for (const s of spans) {
      expect(s.style.fontWeight).toBe('700')
      expect(s.style.color).toBe('red')
      expect(s.style.fontSize).toBe('30px')
    }
  })

  it('un graphème composé (emoji) reste un seul span', () => {
    const root = document.createElement('div')
    root.textContent = 'a👨‍👩‍👧b'
    normalizeEditor(root, ctxAt(18))
    const spans = [...root.querySelectorAll('span')]
    expect(spans.map(s => s.textContent)).toEqual(['a', '👨‍👩‍👧', 'b'])
  })
})

/* ══════════════════════════════════════════
   2. Commutation — le cœur de l'exigence
   ══════════════════════════════════════════ */

describe('commutation des opérations', () => {
  it('couleur, gras, effet de taille et taille de base commutent', () => {
    expectCommutes([
      { name: 'couleur', run: (r, s, st) => ops.applyColorCycle(r, live(st), s, ['#c42b45', '#2456a4']) },
      { name: 'gras', run: (r, s, st) => ops.toggleFormat(r, live(st), s, 'bold') },
      { name: 'effet:arche', run: (r, s, st) => ops.applySizeEffect(r, live(st), s, 'arche') },
      { name: 'base:32', run: (r, _s, st) => { st.base = 32; ops.setBaseSize(r, 32, resolve) } },
    ])
  })

  it('appliquer un effet à la taille N == régler N puis appliquer l\'effet', () => {
    for (const effectId of Object.keys(PROFILES)) {
      const a = makeEditor()
      ops.applySizeEffect(a, ctxAt(18), wordRange(a, 0), effectId)
      ops.setBaseSize(a, 40, id => PROFILES[id] ?? null)

      const b = makeEditor()
      ops.setBaseSize(b, 40, id => PROFILES[id] ?? null)
      ops.applySizeEffect(b, ctxAt(40), wordRange(b, 0), effectId)

      expect(a.innerHTML, `effet ${effectId}`).toBe(b.innerHTML)
    }
  })

  it('un aller-retour de taille de base revient à l\'identique', () => {
    const root = makeEditor()
    ops.applySizeEffect(root, ctxAt(18), wordRange(root, 0), 'vague')
    const before = root.innerHTML
    for (const s of [40, 8, 120, 26, 18]) ops.setBaseSize(root, s, id => PROFILES[id] ?? null)
    expect(root.innerHTML).toBe(before)
  })

  it('lien, fond et effet de taille commutent', () => {
    expectCommutes([
      { name: 'lien', run: (r, s, st) => ops.setLink(r, live(st), s, 'https://mines.fr') },
      { name: 'fond', run: (r, s, st) => ops.setBackground(r, live(st), s, '#ffe066') },
      { name: 'effet:rebond', run: (r, s, st) => ops.applySizeEffect(r, live(st), s, 'rebond') },
      { name: 'italique', run: (r, s, st) => ops.toggleFormat(r, live(st), s, 'italic') },
    ])
  })

  it('deux effets de taille : le dernier gagne, sans trace du premier', () => {
    const a = makeEditor()
    ops.applySizeEffect(a, ctxAt(18), wordRange(a, 0), 'montee')
    ops.applySizeEffect(a, ctxAt(18), wordRange(a, 0), 'arche')

    const b = makeEditor()
    ops.applySizeEffect(b, ctxAt(18), wordRange(b, 0), 'arche')

    expect(a.innerHTML).toBe(b.innerHTML)
    expect(a.querySelectorAll('[data-size-effect]')).toHaveLength(1)
  })

  it('appliquer deux fois le même effet ne change rien', () => {
    const root = makeEditor()
    ops.applySizeEffect(root, ctxAt(18), wordRange(root, 0), 'impulsion')
    const once = root.innerHTML
    ops.applySizeEffect(root, ctxAt(18), wordRange(root, 0), 'impulsion')
    expect(root.innerHTML).toBe(once)
  })
})

/* ══════════════════════════════════════════
   3. Régressions signalées
   ══════════════════════════════════════════ */

describe('régressions', () => {
  it('après réinitialisation du style, la taille redevient modifiable', () => {
    const root = makeEditor()
    const w = wordRange(root, 0)
    ops.applySizeEffect(root, ctxAt(18), w, 'montee')
    ops.clearStyle(root, ctxAt(18), w)

    expect(root.querySelectorAll('[data-size-effect]')).toHaveLength(0)

    ops.setBaseSize(root, 44, id => PROFILES[id] ?? null)
    const spans = [...root.querySelectorAll('span')].slice(0, w.end - w.start)
    for (const s of spans) expect(s.style.fontSize).toBe('44px')
  })

  it('taper dans un mot à effet ne duplique pas le marqueur', () => {
    const root = makeEditor()
    ops.applySizeEffect(root, ctxAt(18), wordRange(root, 0), 'arche')
    expect(root.querySelectorAll('[data-size-effect]')).toHaveLength(1)

    // insertion au milieu du mot
    ops.insertText(root, ctxAt(18), { start: 3, end: 3 }, 'X', {
      color: '', backgroundColor: '', fontSize: '18px', fontFamily: 'Arial',
      bold: false, italic: false, underline: false, strike: false,
    })

    expect(root.querySelectorAll('[data-size-effect]')).toHaveLength(1)
    // le profil se réétale sur le mot élargi, il reste monotone en cloche
    const sizes = [...root.querySelector('[data-size-effect]')!.querySelectorAll('span')]
      .map(s => parseInt(s.style.fontSize))
    expect(sizes).toHaveLength(8)
    expect(Math.max(...sizes)).toBeGreaterThan(Math.min(...sizes))
  })

  it('les espaces ne décalent pas le cycle de couleurs', () => {
    const root = makeEditor('ab cd')
    const atoms = readAtoms(root)
    ops.applyColorCycle(root, ctxAt(18), { start: 0, end: atoms.length }, ['#111111', '#222222'])
    const colors = [...root.querySelectorAll('span')]
      .filter(s => s.textContent !== ' ' && s.textContent !== ' ')
      .map(s => s.style.color)
    expect(colors.map(c => c.replace(/\s/g, ''))).toEqual(['#111111', '#222222', '#111111', '#222222'])
  })

  it('demander une taille fixe libère le mot de son effet', () => {
    const root = makeEditor()
    const w = wordRange(root, 0)
    ops.applySizeEffect(root, ctxAt(18), w, 'vague')
    ops.setFontSize(root, ctxAt(18), w, 50)
    expect(root.querySelectorAll('[data-size-effect]')).toHaveLength(0)
    const spans = [...root.querySelectorAll('span')].slice(0, w.end - w.start)
    for (const s of spans) expect(s.style.fontSize).toBe('50px')
  })
})

/* ══════════════════════════════════════════
   4. Création d'effets — toutes les fonctions
   ══════════════════════════════════════════ */

describe('création d\'effets par fonction mathématique', () => {
  const EXPRS = [
    'sin(x)', 'cos(x)', 'tan(x)', 'abs(x)', 'sqrt(x)', 'log(x)', 'exp(x)',
    'x^2', 'x^3', '1/x', 'sin(x)*cos(x)', 'abs(sin(x))', 'x', '-x', 'exp(-x)*sin(x)',
  ]

  /** Reproduit exactement le calcul de MathFunction.getProfile() */
  const buildProfile = (expr: string, b = 6.3, c = 0) => {
    const n = 9
    const samples = 50
    const raw = Array.from({ length: samples }, (_, s) => {
      const i = (s / (samples - 1)) * (n - 1)
      return evaluateMathExprSafe(expr, b * (i - c))
    })
    return normalizeProfile(raw)
  }

  it('tout profil créé est une forme [0,1] finie', () => {
    for (const expr of EXPRS) {
      const p = buildProfile(expr)
      expect(p.every(Number.isFinite), `${expr} produit des non-finis`).toBe(true)
      expect(Math.min(...p), expr).toBeGreaterThanOrEqual(0)
      expect(Math.max(...p), expr).toBeLessThanOrEqual(1)
    }
  })

  it('le rendu dans l\'éditeur suit la formule annoncée par le créateur', () => {
    for (const expr of EXPRS) {
      const profile = buildProfile(expr)
      const resolve = () => profile
      const base = 24

      const root = makeEditor('abcdefghi')
      ops.applySizeEffect(root, { baseSize: base, resolveProfile: resolve }, wordRange(root, 0), 'custom')

      const spans = [...root.querySelectorAll('[data-size-effect] span')]
      expect(spans, expr).toHaveLength(9)

      spans.forEach((s, i) => {
        // Formule affichée dans le créateur : base + amplitude · f(t), amplitude = base
        const t = i / 8
        const idx = t * (profile.length - 1)
        const lo = Math.floor(idx)
        const hi = Math.min(lo + 1, profile.length - 1)
        const frac = idx - lo
        const shape = profile[lo] * (1 - frac) + profile[hi] * frac
        const expected = Math.max(8, Math.round(base + base * shape))
        expect(parseInt((s as HTMLElement).style.fontSize), `${expr} lettre ${i}`).toBe(expected)
      })
    }
  })

  it('un effet créé est indépendant de la taille au moment de la création', () => {
    // Régression : normalizeProfile() cuisait l'amplitude du slider dans le
    // tableau, donc le même dessin donnait deux effets différents selon la
    // taille affichée à la création.
    const p18 = buildProfile('sin(x)')
    const p40 = buildProfile('sin(x)')
    expect(p18).toEqual(p40)
  })

  it('les profils créés commutent comme les effets de base', () => {
    const profile = buildProfile('sin(x)*cos(x)')
    const resolve = () => profile
    const a = makeEditor()
    ops.applySizeEffect(a, { baseSize: 18, resolveProfile: resolve }, wordRange(a, 0), 'custom')
    ops.setBaseSize(a, 36, resolve)

    const b = makeEditor()
    ops.setBaseSize(b, 36, resolve)
    ops.applySizeEffect(b, { baseSize: 36, resolveProfile: resolve }, wordRange(b, 0), 'custom')

    expect(a.innerHTML).toBe(b.innerHTML)
  })
})
