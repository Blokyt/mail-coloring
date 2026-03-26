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

export interface ColorEffect {
  name: string
  icon: string
  colors: string[]
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

export const COLOR_EFFECTS: Record<string, ColorEffect> = {
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
}

/** Retourne les effets couleur effectifs (hardcoded + overrides admin) */
export function getEffectiveColorEffects(adminOverrides?: Record<string, { name: string; colors: string[] }>): Record<string, ColorEffect> {
  if (!adminOverrides || Object.keys(adminOverrides).length === 0) return COLOR_EFFECTS
  const result: Record<string, ColorEffect> = {}
  // Base effects, overridden if admin has changes
  for (const [id, effect] of Object.entries(COLOR_EFFECTS)) {
    const ov = adminOverrides[id]
    result[id] = ov ? { ...effect, name: ov.name, colors: ov.colors } : effect
  }
  // Admin-only effects (not in base)
  for (const [id, ov] of Object.entries(adminOverrides)) {
    if (!COLOR_EFFECTS[id]) {
      result[id] = { name: ov.name, icon: '', colors: ov.colors }
    }
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

export const SIZE_EFFECTS: Record<string, SizeEffect> = {
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

// ============================================
// APPLICATION DES EFFETS
// ============================================

/**
 * Applique des effets couleur et/ou taille à un texte.
 * Retourne du HTML avec des <span style="..."> inline (Outlook-safe).
 */
export function applyEffects(
  text: string,
  colorEffectId: string | null,
  sizeEffectId: string | null,
  options: EffectOptions,
): string {
  const chars = [...text]
  const colorEffect = colorEffectId ? COLOR_EFFECTS[colorEffectId] : null
  const sizeEffect = sizeEffectId ? SIZE_EFFECTS[sizeEffectId] : null

  if (!colorEffect && !sizeEffect) return text

  const nonSpaceCount = chars.filter(c => c !== ' ').length
  let charIdx = 0
  const parts: string[] = []

  for (const char of chars) {
    if (char === ' ') {
      parts.push(' ')
      continue
    }

    const styles: string[] = []

    if (colorEffect) {
      const color = colorEffect.colors[charIdx % colorEffect.colors.length]
      styles.push(`color:${color}`)
    }

    if (sizeEffect) {
      const t = nonSpaceCount <= 1 ? 0 : charIdx / (nonSpaceCount - 1)
      const shape = sizeEffect.getShape(t)
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
  colorEffectId?: string | null,
  raw?: boolean,
): string {
  const chars = [...text]
  const colorEffect = colorEffectId ? COLOR_EFFECTS[colorEffectId] : null
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

    if (colorEffect) {
      const color = colorEffect.colors[charIdx % colorEffect.colors.length]
      styles.push(`color:${color}`)
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
): string {
  const chars = [...text]
  const sizeEffect = data.sizeEffectRef ? SIZE_EFFECTS[data.sizeEffectRef] : null
  const colors = resolvedColors
    ?? (data.colorEffectRef ? COLOR_EFFECTS[data.colorEffectRef]?.colors : null)
    ?? (data.flatColor ? [data.flatColor] : null)

  const nonSpaceCount = chars.filter(c => c !== ' ').length
  let charIdx = 0
  const inner = chars.map(char => {
    if (char === ' ') return ' '
    const styles: string[] = []
    if (colors) styles.push(`color:${colors[charIdx % colors.length]}`)
    if (sizeEffect) {
      const t = nonSpaceCount <= 1 ? 0 : charIdx / (nonSpaceCount - 1)
      const size = Math.max(8, Math.round(options.baseSize + options.amplitude * sizeEffect.getShape(t)))
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

/** Évaluateur simple d'expressions math en x (safe: retourne 0 en cas d'erreur) */
export function evaluateMathExprSafe(expr: string, x: number): number {
  try { return evaluateMathExpr(expr, x) } catch { return 0 }
}

function evaluateMathExpr(expr: string, x: number): number {
  const sanitized = expr
    .replace(/\bsin\b/g, 'Math.sin')
    .replace(/\bcos\b/g, 'Math.cos')
    .replace(/\btan\b/g, 'Math.tan')
    .replace(/\babs\b/g, 'Math.abs')
    .replace(/\bsqrt\b/g, 'Math.sqrt')
    .replace(/\blog\b/g, 'Math.log')
    .replace(/\bpi\b/gi, 'Math.PI')
    .replace(/\bexp\b/g, 'Math.exp')
    .replace(/\^/g, '**')
    .replace(/\bx\b/g, `(${x})`)

  // Vérifier que l'expression ne contient que des caractères math sûrs
  if (!/^[\d\s+\-*/().Math,sincotagblqrtexpPI*]+$/.test(sanitized)) {
    return 0
  }

  // eslint-disable-next-line no-eval
  const result = new Function(`return ${sanitized}`)()
  if (typeof result !== 'number' || !isFinite(result)) return 0
  return result
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

/** Nettoyage HTML pour compatibilité Outlook */
export function cleanForOutlook(html: string): string {
  const div = document.createElement('div')
  div.innerHTML = html
  div.querySelectorAll('*').forEach(el => {
    el.removeAttribute('class')
    el.removeAttribute('id')
    el.removeAttribute('data-decoration')
    if (el.innerHTML === '\u200B') el.innerHTML = ''
  })
  return div.innerHTML
}
