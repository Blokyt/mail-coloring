import { SIZE_EFFECTS, interpolateProfile } from './effects'
import type { WorkshopEffect } from '../stores/workshops'

const DEFAULT_SAMPLES = 20

/**
 * Genere un path SVG sparkline a partir d'une fonction shape(t) → [0,1].
 * Le viewBox attendu est "0 0 100 24".
 */
export function sparklineFromFn(
  getShape: (t: number) => number,
  samples: number = DEFAULT_SAMPLES,
): string {
  const values: number[] = []
  for (let i = 0; i < samples; i++) {
    const t = samples <= 1 ? 0 : i / (samples - 1)
    values.push(getShape(t))
  }
  return valuesToPath(values)
}

/**
 * Genere un path SVG sparkline depuis un WorkshopEffect.
 */
export function sparklineFromEffect(effect: WorkshopEffect): string {
  if (effect.type === 'size' && SIZE_EFFECTS[effect.id]) {
    return sparklineFromFn((t) => SIZE_EFFECTS[effect.id].getShape(t))
  }
  if (effect.type === 'custom-size' && effect.profile) {
    const profile = effect.profile
    return sparklineFromFn((t) => {
      const pIdx = t * (profile.length - 1)
      const lo = Math.floor(pIdx)
      const hi = Math.min(lo + 1, profile.length - 1)
      const frac = pIdx - lo
      return profile[lo] * (1 - frac) + profile[hi] * frac
    })
  }
  return ''
}

/** Normalise un tableau de valeurs en path SVG */
function valuesToPath(values: number[]): string {
  if (values.length === 0) return ''
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1

  return values.map((v, i) => {
    const x = (i / (values.length - 1)) * 100
    const y = 22 - ((v - min) / range) * 20
    return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
}
