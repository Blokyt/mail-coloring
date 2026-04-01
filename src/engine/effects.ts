/**
 * Moteur d'effets — Mail Colorer
 *
 * Un effet est une fonction qui, pour chaque caractère d'un mot,
 * retourne les styles inline à appliquer.
 */

export interface EffectOptions {
  baseSize: number    // px
  amplitude: number   // px — max extra size for the biggest letter
}

export interface CharStyle {
  color?: string
  fontSize?: string
  backgroundColor?: string
}

// ============================================
// TYPES D'EFFETS
// ============================================

export type ColorMode = 'text' | 'bg'

export interface ColorEffect {
  name: string
  icon: string
  colors: string[]
  mode?: ColorMode
  /** Décoration optionnelle (emojis avant/après) */
  decoration?: { before: string; after: string }
}

export interface SizeEffect {
  name: string
  icon: string
  /** Retourne la forme normalisee [0,1] pour t dans [0,1]. fontSize = baseSize + amplitude * getShape(t) */
  getShape: (t: number) => number
}

// ============================================
// TYPES COMPOSES
// ============================================

export type EmojiPosition = 'before' | 'after' | 'both' | 'none'

export interface EmojiDecoration {
  emoji: string
  position: EmojiPosition
}

/** Effet compose : combine taille + couleur + police + emoji */
export interface ComposedEffectData {
  sizeEffectRef?: string | null
  colorEffectRef?: string | null
  flatColor?: string | null
  font?: string | null
  emojiDecoration?: EmojiDecoration | null
}

// ============================================
// EFFETS COULEUR PRÉDÉFINIS
// ============================================

/** Effets couleur par défaut — utilisés UNIQUEMENT comme seed initial pour admin-data.json.
 *  En runtime, toujours lire depuis adminData().colorEffects via le store. */
export const DEFAULT_COLOR_EFFECTS: Record<string, ColorEffect> = {
  arcenciel: {
    name: 'Arc-en-ciel',
    icon: '',
    colors: ['#ff4d6d', '#ff8c42', '#ffd000', '#00c896', '#0096c7', '#7b2cbf', '#c026d3'],
  },
  arlequin: {
    name: 'Arlequin',
    icon: '',
    colors: ['#c42b45', '#c9a84c', '#2456a4', '#e8a525', '#1a8a5c', '#9b2d8e'],
  },
  flamme: {
    name: 'Flamme',
    icon: '',
    colors: ['#ffe066', '#ffb347', '#ff7f50', '#ff5c5c', '#e53935'],
  },
  ocean: {
    name: 'Océan',
    icon: '',
    colors: ['#0077b6', '#00b4d8', '#48cae4', '#90e0ef', '#00b4d8', '#0096c7'],
  },
  foret: {
    name: 'Forêt',
    icon: '',
    colors: ['#1b4332', '#2d6a4f', '#40916c', '#52b788', '#74c69d', '#95d5b2'],
  },
  dore: {
    name: 'Doré',
    icon: '',
    colors: ['#c9a84c', '#e8c870', '#ffd700', '#daa520', '#b8860b'],
  },
  mystere: {
    name: 'Mystère',
    icon: '',
    colors: ['#9b2d8e', '#c42b45', '#c9a84c', '#e8c870'],
  },
  pastel: {
    name: 'Pastel',
    icon: '',
    colors: ['#ffc8dd', '#ffafcc', '#bde0fe', '#a2d2ff', '#cdb4db'],
  },
  nuit: {
    name: 'Nuit',
    icon: '',
    colors: ['#1a1a3e', '#2d2b55', '#4a3f6b', '#7b6ba0', '#a59bc8'],
  },
  // ── Mines assos ──
  feministes: {
    name: 'feMINistes',
    icon: '',
    colors: ['#9b59b6', '#8e44ad', '#c026d3', '#e91e9c', '#ff69b4'],
  },
  candy: {
    name: 'Candy',
    icon: '',
    colors: ['#ff69b4', '#ff1493', '#c026d3', '#9b59b6', '#e91e9c'],
  },
  papimamine: {
    name: 'PapiMamine',
    icon: '',
    colors: ['#1a3aff', '#0066ff', '#008a3e', '#00aa00', '#00cc44'],
  },
  fromage: {
    name: 'Fromage',
    icon: '',
    colors: ['#ff00ff', '#c026d3', '#9b2d8e', '#7b2cbf', '#e91e9c'],
  },
  sapin: {
    name: 'Sapin',
    icon: '',
    colors: ['#ff0000', '#00cc00', '#ff0000', '#00cc00'],
  },
  montagne: {
    name: 'Montagne',
    icon: '',
    colors: ['#00d4ff', '#ff8c00', '#00d4ff', '#ff8c00'],
  },
  ecolo: {
    name: 'Ecolo',
    icon: '',
    colors: ['#ffe600', '#7bcf3c', '#ffe600', '#2db82d'],
  },
  bonbon: {
    name: 'Bonbon',
    icon: '',
    colors: ['#ff69b4', '#ffb6c1', '#ff69b4', '#da70d6', '#ff69b4'],
  },
}

/** Retourne les effets couleur texte depuis adminData (source unique de vérité) */
export function getEffectiveColorEffects(effects: Record<string, { name: string; colors: string[] }>): Record<string, ColorEffect> {
  const result: Record<string, ColorEffect> = {}
  for (const [id, e] of Object.entries(effects)) {
    result[id] = { name: e.name, icon: '', colors: e.colors }
  }
  return result
}

/** Les effets fond sont déduits automatiquement des effets texte */
export function getEffectiveBgEffects(effects: Record<string, { name: string; colors: string[] }>): Record<string, ColorEffect> {
  const textEffects = getEffectiveColorEffects(effects)
  const result: Record<string, ColorEffect> = {}
  for (const [id, effect] of Object.entries(textEffects)) {
    result[`${id}_bg`] = { ...effect, mode: 'bg' }
  }
  return result
}

// ============================================
// EFFETS TAILLE PRÉDÉFINIS
// ============================================

/* Helpers pour normaliser les gaussiennes */
function gaussShape(t: number, center: number, sigma2: number): number {
  const raw = Math.exp(-((t - center) ** 2) / sigma2)
  const edge = Math.min(Math.exp(-(center ** 2) / sigma2), Math.exp(-((1 - center) ** 2) / sigma2))
  return Math.max(0, (raw - edge) / (1 - edge))
}

/** Effets taille par défaut — utilisés UNIQUEMENT comme seed initial pour admin-data.json.
 *  En runtime, toujours lire depuis adminData().sizeEffects via le store. */
export const DEFAULT_SIZE_EFFECTS: Record<string, SizeEffect> = {
  montee: {
    name: 'Montee lineaire',
    icon: '',
    getShape: (t) => t,
  },
  montee_exp: {
    name: 'Montee exponentielle',
    icon: '',
    getShape: (t) => (Math.exp(2.25 * t) - 1) / (Math.exp(2.25) - 1),
  },
  descente: {
    name: 'Descente lineaire',
    icon: '',
    getShape: (t) => 1 - t,
  },
  descente_exp: {
    name: 'Descente exponentielle',
    icon: '',
    getShape: (t) => {
      const k = 2.7, minV = Math.exp(-k)
      return (Math.exp(-k * t) - minV) / (1 - minV)
    },
  },
  arche: {
    name: 'Arche',
    icon: '',
    getShape: (t) => gaussShape(t, 0.5, 0.08),
  },
  impulsion: {
    name: 'Impulsion',
    icon: '',
    getShape: (t) => gaussShape(t, 0.1, 0.02),
  },
  vague: {
    name: 'Vague',
    icon: '',
    getShape: (t) => (Math.sin(7.2 * t) + 1) / 2,
  },
  rebond: {
    name: 'Rebond',
    icon: '',
    getShape: (t) => Math.abs(Math.sin(5.4 * t)),
  },
}

/** Interpole une valeur dans un profil pour t dans [0,1] */
export function sampleProfile(profile: number[], t: number): number {
  const pIdx = t * (profile.length - 1)
  const lo = Math.floor(pIdx)
  const hi = Math.min(lo + 1, profile.length - 1)
  const frac = pIdx - lo
  return profile[lo] * (1 - frac) + profile[hi] * frac
}

// ============================================
// APPLICATION DES EFFETS
// ============================================

/**
 * Applique des effets couleur et/ou taille à un texte.
 * Retourne du HTML avec des <span style="..."> inline (Outlook-safe).
 */
export function applyEffects(
  text: string,
  colorConfig: { colors: string[], mode?: ColorMode } | null,
  sizeProfile: number[] | null,
  options: EffectOptions,
): string {
  const chars = [...text]

  if (!colorConfig && !sizeProfile) return text

  const nonSpaceCount = chars.filter(c => c !== ' ').length
  let charIdx = 0
  const parts: string[] = []

  for (const char of chars) {
    if (char === ' ') {
      parts.push(' ')
      continue
    }

    const styles: string[] = []

    if (colorConfig) {
      const color = colorConfig.colors[charIdx % colorConfig.colors.length]
      const prop = colorConfig.mode === 'bg' ? 'background-color' : 'color'
      styles.push(`${prop}:${color}`)
    }

    if (sizeProfile) {
      const t = nonSpaceCount <= 1 ? 0 : charIdx / (nonSpaceCount - 1)
      const shape = sampleProfile(sizeProfile, t)
      const size = Math.max(8, Math.round(options.baseSize + options.amplitude * shape))
      styles.push(`font-size:${size}px`)
    }

    if (styles.length > 0) {
      parts.push(`<span style="${styles.join(';')}">${char}</span>`)
    } else {
      parts.push(char)
    }

    charIdx++
  }

  return parts.join('')
}

/**
 * Applique un profil de taille personnalisé.
 * Si raw=false (defaut) : profil [0,1], fontSize = baseSize + amplitude * value
 * Si raw=true : profil en offsets px bruts, fontSize = baseSize + value
 */
export function applySizeProfile(
  text: string,
  profile: number[],
  options: EffectOptions,
  colorConfig?: { colors: string[], mode?: ColorMode } | null,
  raw?: boolean,
): string {
  const chars = [...text]
  const nonSpaceChars = chars.filter(c => c !== ' ')
  const total = nonSpaceChars.length

  if (total === 0 || profile.length === 0) return text

  let charIdx = 0
  const parts: string[] = []

  for (const char of chars) {
    if (char === ' ') {
      parts.push(' ')
      continue
    }

    const value = interpolateProfile(profile, charIdx, total)

    const size = Math.max(8, Math.round(options.baseSize + (raw ? value : options.amplitude * value)))
    const styles: string[] = [`font-size:${size}px`]

    if (colorConfig) {
      const color = colorConfig.colors[charIdx % colorConfig.colors.length]
      const prop = colorConfig.mode === 'bg' ? 'background-color' : 'color'
      styles.push(`${prop}:${color}`)
    }

    parts.push(`<span style="${styles.join(';')}">${char}</span>`)
    charIdx++
  }

  return parts.join('')
}

/**
 * Applique un effet compose (taille + couleur + police + emoji) a du texte.
 * `resolvedColors` permet de passer une palette custom-color resolue par l'appelant.
 */
export function applyComposedEffect(
  text: string,
  data: ComposedEffectData,
  options: EffectOptions,
  resolvedColors?: string[] | null,
  colorMode?: ColorMode | null,
  resolvedSizeProfile?: number[] | null,
): string {
  const chars = [...text]
  const colors = resolvedColors ?? (data.flatColor ? [data.flatColor] : null)
  const mode = colorMode ?? 'text'

  const nonSpaceCount = chars.filter(c => c !== ' ').length
  let charIdx = 0
  const inner = chars.map(char => {
    if (char === ' ') return ' '
    const styles: string[] = []
    if (colors) {
      const prop = mode === 'bg' ? 'background-color' : 'color'
      styles.push(`${prop}:${colors[charIdx % colors.length]}`)
    }
    if (resolvedSizeProfile) {
      const t = nonSpaceCount <= 1 ? 0 : charIdx / (nonSpaceCount - 1)
      const size = Math.max(8, Math.round(options.baseSize + options.amplitude * sampleProfile(resolvedSizeProfile, t)))
      styles.push(`font-size:${size}px`)
    }
    if (data.font) styles.push(`font-family:${data.font}`)
    charIdx++
    return styles.length > 0 ? `<span style="${styles.join(';')}">${char}</span>` : char
  }).join('')

  const emoji = data.emojiDecoration
  if (!emoji || emoji.position === 'none') return inner
  const before = (emoji.position === 'before' || emoji.position === 'both') ? emoji.emoji : ''
  const after = (emoji.position === 'after' || emoji.position === 'both') ? emoji.emoji : ''
  return `${before}${inner}${after}`
}

/** Évaluateur safe d'expressions math en x — parseur recursive descent, zéro eval */
export function evaluateMathExprSafe(expr: string, x: number): number {
  try { return parseMathExpr(expr, x) } catch { return 0 }
}

const MATH_FUNCS: Record<string, (v: number) => number> = {
  sin: Math.sin, cos: Math.cos, tan: Math.tan,
  abs: Math.abs, sqrt: Math.sqrt, log: Math.log, exp: Math.exp,
}

const MATH_CONSTS: Record<string, number> = { pi: Math.PI, e: Math.E }

/**
 * Recursive descent parser pour expressions mathématiques.
 * Grammaire :
 *   expr   = term (('+' | '-') term)*
 *   term   = power (('*' | '/') power)*
 *   power  = unary ('^' power)?        (right-associative)
 *   unary  = '-' unary | atom
 *   atom   = number | 'x' | const | func '(' expr ')' | '(' expr ')'
 */
function parseMathExpr(expr: string, x: number): number {
  const tokens = tokenize(expr)
  let pos = 0

  function peek(): string | null { return pos < tokens.length ? tokens[pos] : null }
  function consume(): string { return tokens[pos++] }
  function expect(t: string) { if (consume() !== t) throw new Error(`Expected '${t}'`) }

  function parseExpr(): number {
    let left = parseTerm()
    while (peek() === '+' || peek() === '-') {
      const op = consume()
      const right = parseTerm()
      left = op === '+' ? left + right : left - right
    }
    return left
  }

  function parseTerm(): number {
    let left = parsePower()
    while (peek() === '*' || peek() === '/') {
      const op = consume()
      const right = parsePower()
      left = op === '*' ? left * right : left / right
    }
    return left
  }

  function parsePower(): number {
    const base = parseUnary()
    if (peek() === '^') { consume(); return Math.pow(base, parsePower()) }
    return base
  }

  function parseUnary(): number {
    if (peek() === '-') { consume(); return -parseUnary() }
    if (peek() === '+') { consume(); return parseUnary() }
    return parseAtom()
  }

  function parseAtom(): number {
    const t = peek()
    if (t === null) throw new Error('Unexpected end')

    // Nombre
    if (/^\d/.test(t)) { consume(); return parseFloat(t) }

    // Variable x
    if (t === 'x') { consume(); return x }

    // Constante ou fonction
    if (/^[a-z]/i.test(t)) {
      const name = consume().toLowerCase()
      if (name in MATH_CONSTS) return MATH_CONSTS[name]
      if (name in MATH_FUNCS) {
        expect('(')
        const arg = parseExpr()
        expect(')')
        return MATH_FUNCS[name](arg)
      }
      throw new Error(`Unknown: '${name}'`)
    }

    // Parenthèses
    if (t === '(') { consume(); const v = parseExpr(); expect(')'); return v }

    throw new Error(`Unexpected: '${t}'`)
  }

  // Supporter la multiplication implicite : 2x, 2sin(x), 2(x)
  function tokenize(input: string): string[] {
    const toks: string[] = []
    let i = 0
    const s = input.replace(/\s+/g, '')
    while (i < s.length) {
      const ch = s[i]
      // Nombre (int ou float)
      if (/\d/.test(ch) || (ch === '.' && i + 1 < s.length && /\d/.test(s[i + 1]))) {
        let num = ''
        while (i < s.length && (/\d/.test(s[i]) || s[i] === '.')) num += s[i++]
        toks.push(num)
        // Multiplication implicite : 2x, 2sin, 2(
        if (i < s.length && (/[a-zA-Z]/.test(s[i]) || s[i] === '(')) toks.push('*')
      }
      // Identifiant (fonction, constante, x)
      else if (/[a-zA-Z]/.test(ch)) {
        let id = ''
        while (i < s.length && /[a-zA-Z]/.test(s[i])) id += s[i++]
        toks.push(id)
        // Multiplication implicite après constante/x suivie de nombre ou (
        if (id !== 'x' && !(id.toLowerCase() in MATH_FUNCS)) {
          if (i < s.length && (/\d/.test(s[i]) || s[i] === '(' || /[a-zA-Z]/.test(s[i]))) toks.push('*')
        }
        if (id === 'x' && i < s.length && (/\d/.test(s[i]) || /[a-zA-Z]/.test(s[i]) || s[i] === '(')) toks.push('*')
      }
      // Opérateurs et parenthèses
      else if ('+-*/^()'.includes(ch)) {
        toks.push(ch)
        i++
        // Multiplication implicite : )(, )x, )2
        if (ch === ')' && i < s.length && (/[a-zA-Z\d(]/.test(s[i]))) toks.push('*')
      }
      else { i++ } // skip unknown chars
    }
    return toks
  }

  const result = parseExpr()
  if (pos < tokens.length) throw new Error('Unexpected trailing tokens')
  if (!isFinite(result)) return 0
  return result
}

/** Normalise un profil de taille : min→0, max→amplitude.
 * Garantit que la plus grande lettre = baseSize + amplitude,
 * la plus petite = baseSize. Fonctionne pour tout type de profil
 * (MathFunction brut ou ShapeCanvas [0,1]). */
export function normalizeProfile(values: number[], amplitude: number): number[] {
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min
  if (range < 1e-10) return values.map(() => 0)
  return values.map(v => amplitude * (v - min) / range)
}

/** Interpole une valeur dans un profil normalise [0..1] */
export function interpolateProfile(profile: number[], charIdx: number, total: number): number {
  const t = total === 1 ? 0 : charIdx / (total - 1)
  const pIdx = t * (profile.length - 1)
  const lo = Math.floor(pIdx)
  const hi = Math.min(lo + 1, profile.length - 1)
  const frac = pIdx - lo
  return profile[lo] * (1 - frac) + profile[hi] * frac
}

/** Convertit toute couleur CSS (rgb, rgba, hex, named) en hex 6 digits.
 *  Outlook/Word EXIGE du hex — rgb() ne fonctionne PAS. */
function toHex(color: string): string {
  if (!color) return ''
  // Déjà en hex
  if (color.startsWith('#')) {
    if (color.length === 4) return '#' + color[1]+color[1] + color[2]+color[2] + color[3]+color[3]
    return color
  }
  // rgb(r, g, b) ou rgba(r, g, b, a)
  const m = color.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/)
  if (m) {
    const r = parseInt(m[1]).toString(16).padStart(2, '0')
    const g = parseInt(m[2]).toString(16).padStart(2, '0')
    const b = parseInt(m[3]).toString(16).padStart(2, '0')
    return `#${r}${g}${b}`
  }
  // Fallback : utiliser un canvas pour résoudre les couleurs nommées
  const ctx = document.createElement('canvas').getContext('2d')
  if (ctx) { ctx.fillStyle = color; return ctx.fillStyle }
  return color
}

/**
 * Nettoyage HTML complet pour compatibilité Outlook (moteur Word).
 *
 * Stratégie :
 * - Aplatir le DOM en tokens {text, style} par caractère
 * - Fusionner les caractères adjacents avec le même style
 * - Reconstruire avec <span style="..."> et balises <b>/<i>/<u>/<s>
 * - Toutes les couleurs en HEX (Outlook refuse rgb())
 * - Tailles en px (plus fiable cross-client que pt)
 * - Espaces converties en &nbsp; (Outlook collapse les espaces normales)
 * - Wrapper chaque ligne dans un <p> (Word gère les paragraphes indépendamment)
 */
export function cleanForOutlook(html: string): string {
  const div = document.createElement('div')
  div.innerHTML = html

  // ── Phase 1 : pré-nettoyage du DOM ──
  div.querySelectorAll('.line-break').forEach(el => el.remove())
  div.querySelectorAll('[data-size-effect]').forEach(wrapper => {
    const parent = wrapper.parentNode
    if (!parent) return
    while (wrapper.firstChild) parent.insertBefore(wrapper.firstChild, wrapper)
    wrapper.remove()
  })

  // ── Phase 2 : aplatir en tokens ──
  interface Token {
    type: 'char'
    text: string
    color: string
    bg: string
    fontSize: string
    fontFamily: string
    bold: boolean
    italic: boolean
    underline: boolean
    strike: boolean
    href: string
  }
  interface BrToken { type: 'br' }
  type AnyToken = Token | BrToken

  const tokens: AnyToken[] = []

  function walkNode(node: Node, inherited: Partial<Token>) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent || ''
      if (text === '\u200B') return
      for (const ch of text) {
        tokens.push({
          type: 'char',
          text: ch,
          color: inherited.color || '',
          bg: inherited.bg || '',
          fontSize: inherited.fontSize || '',
          fontFamily: inherited.fontFamily || '',
          bold: inherited.bold || false,
          italic: inherited.italic || false,
          underline: inherited.underline || false,
          strike: inherited.strike || false,
          href: inherited.href || '',
        })
      }
      return
    }

    if (node.nodeName === 'BR') {
      tokens.push({ type: 'br' })
      return
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return
    const el = node as HTMLElement
    const s = el.style
    const next: Partial<Token> = { ...inherited }

    // Couleur texte
    if (s.color && s.color !== 'inherit') next.color = toHex(s.color)
    else if (el.tagName === 'FONT' && el.getAttribute('color')) next.color = toHex(el.getAttribute('color')!)

    // Background
    const bg = s.backgroundColor
    if (bg && bg !== 'transparent' && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'inherit') next.bg = toHex(bg)

    if (s.fontSize) next.fontSize = s.fontSize
    if (s.fontFamily) next.fontFamily = s.fontFamily

    if (s.fontWeight === '700' || s.fontWeight === 'bold' || el.tagName === 'B' || el.tagName === 'STRONG') next.bold = true
    if (s.fontWeight === '400' || s.fontWeight === 'normal') next.bold = false
    if (s.fontStyle === 'italic' || el.tagName === 'I' || el.tagName === 'EM') next.italic = true
    if (s.fontStyle === 'normal') next.italic = false

    const td = s.textDecoration || s.textDecorationLine || ''
    if (td.includes('underline') || el.tagName === 'U') next.underline = true
    if (td.includes('line-through') || el.tagName === 'S' || el.tagName === 'STRIKE') next.strike = true
    if (td === 'none') { next.underline = false; next.strike = false }

    if (el.tagName === 'A') {
      next.href = el.getAttribute('href') || ''
    }

    for (const child of el.childNodes) walkNode(child, next)
  }

  for (const child of div.childNodes) walkNode(child, {})

  // ── Phase 3 : fusionner les tokens adjacents avec le même style ──
  interface MergedRun {
    type: 'run'
    text: string
    color: string
    bg: string
    fontSize: string
    fontFamily: string
    bold: boolean
    italic: boolean
    underline: boolean
    strike: boolean
    href: string
  }
  type AnyRun = MergedRun | BrToken

  const runs: AnyRun[] = []

  // PAS de fusion des runs : chaque caractère garde son propre <span> avec tous ses styles.
  // Quand Outlook (Word) insère un retour à la ligne, il coupe les éléments au curseur.
  // Si chaque span ne contient qu'un seul caractère, Word ne peut pas casser le style.
  // Exception : les espaces consécutives sont fusionnées (pas de style à perdre).
  for (const tok of tokens) {
    if (tok.type === 'br') { runs.push(tok); continue }
    const isSpace = tok.text === ' ' || tok.text === '\u00A0'
    const last = runs[runs.length - 1]
    if (isSpace && last && last.type === 'run' && (last.text === ' ' || last.text === '\u00A0' || /^[\s\u00A0]+$/.test(last.text))) {
      last.text += tok.text
    } else {
      runs.push({ type: 'run', ...tok })
    }
  }

  // ── Phase 4 : générer du HTML compatible Outlook ──
  function escapeHtml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  }

  function fontFamilyClean(ff: string): string {
    if (!ff) return ''
    const clean = ff.split(',')[0].replace(/["']/g, '').trim()
    if (!clean) return ''
    return clean + ', sans-serif'
  }

  function runToHtml(run: MergedRun): string {
    // Espaces (normales + non-breaking) → &nbsp; (Outlook collapse les espaces normales)
    let text = escapeHtml(run.text).replace(/[ \u00A0]/g, '&nbsp;')

    // Tags sémantiques (Word les gère nativement)
    if (run.bold) text = `<b>${text}</b>`
    if (run.italic) text = `<i>${text}</i>`
    if (run.underline) text = `<u>${text}</u>`
    if (run.strike) text = `<s>${text}</s>`

    // Construire le style inline — tout en un seul <span>
    // Note : la couleur texte est aussi en <font color> (Outlook/Word ignore
    // souvent style="color:..." mais respecte toujours <font color>)
    const styles: string[] = []
    if (run.color) styles.push(`color:${run.color}`)
    if (run.bg) styles.push(`background-color:${run.bg}`)
    if (run.fontSize) styles.push(`font-size:${run.fontSize}`)
    const ff = fontFamilyClean(run.fontFamily)
    if (ff) styles.push(`font-family:${ff}`)

    if (styles.length > 0) {
      text = `<span style="${styles.join(';')}">${text}</span>`
    }

    // <font color> en wrapper — Outlook/Word le respecte toujours
    if (run.color) {
      text = `<font color="${run.color}">${text}</font>`
    }

    // Liens
    if (run.href) {
      text = `<a href="${escapeHtml(run.href)}" target="_blank">${text}</a>`
    }

    return text
  }

  // Construire les lignes (split par BR)
  const lines: MergedRun[][] = [[]]
  for (const run of runs) {
    if (run.type === 'br') {
      lines.push([])
    } else {
      lines[lines.length - 1].push(run)
    }
  }

  // "Style breaker" : span invisible sans aucun style à la fin de chaque <p>.
  // Quand l'utilisateur appuie Entrée dans Outlook, Word crée un nouveau paragraphe
  // en héritant du style du DERNIER élément. Sans ce breaker, le background/couleur
  // du dernier caractère se propage au nouveau paragraphe et déforme tout.
  const STYLE_BREAKER = '<span style="font-size:0;line-height:0;mso-hide:all">&#8203;</span>'

  // Chaque ligne → un <p> avec mso-line-height-rule pour un rendu stable
  const paragraphs = lines.map(line => {
    if (line.length === 0) return '<p style="margin:0;padding:0;mso-line-height-rule:exactly">&nbsp;</p>'
    const content = line.map(runToHtml).join('')
    return `<p style="margin:0;padding:0;mso-line-height-rule:exactly">${content}${STYLE_BREAKER}</p>`
  })

  return paragraphs.join('')
}
