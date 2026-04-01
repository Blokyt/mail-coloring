import { sampleProfile } from './effects'
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

/** Genere un sparkline depuis un profil stocke */
export function sparklineFromProfile(profile: number[]): string {
  return sparklineFromFn((t) => sampleProfile(profile, t))
}

/**
 * Genere un path SVG sparkline depuis un WorkshopEffect.
 */
export function sparklineFromEffect(effect: WorkshopEffect): string {
  if ((effect.type === 'size' || effect.type === 'custom-size') && effect.profile) {
    return sparklineFromProfile(effect.profile)
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
