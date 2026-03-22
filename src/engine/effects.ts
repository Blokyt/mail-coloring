/**
 * Moteur d'effets — Mail Colorer
 *
 * Un effet est une fonction qui, pour chaque caractère d'un mot,
 * retourne les styles inline à appliquer.
 */

export interface EffectOptions {
  intensity: number   // 1-10
  baseSize: number    // px
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
  getOffset: (index: number, total: number, opts: EffectOptions) => number
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

// ============================================
// EFFETS TAILLE PRÉDÉFINIS
// ============================================

export const SIZE_EFFECTS: Record<string, SizeEffect> = {
  arche: {
    name: 'Arche',
    icon: '',
    getOffset: (i, total, opts) => {
      // Arche douce : monte au milieu, redescend
      const t = i / Math.max(1, total - 1)
      const amp = 6 + opts.intensity * 6
      return Math.sin(t * Math.PI) * amp
    },
  },
  montee: {
    name: 'Montée',
    icon: '',
    getOffset: (i, total, opts) => {
      // Croissant : petit → très grand
      const progress = i / Math.max(1, total - 1)
      return progress * opts.intensity * 8
    },
  },
  vague: {
    name: 'Vague',
    icon: '',
    getOffset: (i, _total, opts) => {
      // Vague sinusoïdale rapide
      const amp = 5 + opts.intensity * 5
      return Math.sin(i * 0.6) * amp
    },
  },
  rebond: {
    name: 'Rebond',
    icon: '',
    getOffset: (i, _total, opts) => {
      // Rebond dynamique
      const amp = 4 + opts.intensity * 5
      return Math.abs(Math.sin(i * 0.8)) * amp
    },
  },
  descente: {
    name: 'Descente',
    icon: '',
    getOffset: (i, total, opts) => {
      // Décroissant : très grand → petit
      const progress = i / Math.max(1, total - 1)
      const maxAdd = opts.intensity * 8
      return maxAdd * (1 - progress)
    },
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
      const offset = sizeEffect.getOffset(charIdx, nonSpaceCount, options)
      const size = Math.max(8, Math.round(options.baseSize + offset))
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
 * Applique un profil de taille personnalisé (depuis tracé souris ou fonction math).
 * `profile` est un tableau de valeurs normalisées [0..1] de longueur quelconque,
 * interpolé sur la longueur du texte.
 */
export function applySizeProfile(
  text: string,
  profile: number[],
  options: EffectOptions,
  colorEffectId?: string | null,
): string {
  const chars = [...text]
  const colorEffect = colorEffectId ? COLOR_EFFECTS[colorEffectId] : null
  const nonSpaceChars = chars.filter(c => c !== ' ')
  const total = nonSpaceChars.length

  if (total === 0 || profile.length === 0) return text

  let charIdx = 0
  const parts: string[] = []
  const maxAdd = options.intensity * 8

  for (const char of chars) {
    if (char === ' ') {
      parts.push(' ')
      continue
    }

    // Interpolation linéaire du profil
    const t = total === 1 ? 0 : charIdx / (total - 1)
    const profileIdx = t * (profile.length - 1)
    const lo = Math.floor(profileIdx)
    const hi = Math.min(lo + 1, profile.length - 1)
    const frac = profileIdx - lo
    const value = profile[lo] * (1 - frac) + profile[hi] * frac

    const size = Math.max(8, Math.round(options.baseSize + value * maxAdd))
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
 * Évalue une fonction mathématique et retourne un profil normalisé.
 * `expr` est une expression en x (ex: "sin(x)", "x^2").
 */
export function mathToProfile(
  expr: string,
  samples: number = 50,
  hStretch: number = 1,
): number[] {
  const raw: number[] = []

  for (let i = 0; i < samples; i++) {
    // x centré sur 0 : va de -π·b à +π·b (milieu du mot = x=0)
    const t = (i / (samples - 1)) * 2 - 1  // t ∈ [-1, +1]
    const rawX = t * Math.PI * hStretch
    try {
      raw.push(evaluateMathExpr(expr, rawX))
    } catch {
      raw.push(0)
    }
  }

  // Normaliser la forme à [0..1] — profil pur de la courbe
  const min = Math.min(...raw)
  const max = Math.max(...raw)
  const range = max - min || 1
  return raw.map(v => (v - min) / range)
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
