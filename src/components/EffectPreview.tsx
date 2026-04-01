import { applyEffects, applySizeProfile, applyComposedEffect, type EffectOptions, type ComposedEffectData, type ColorMode } from '../engine/effects'
import { adminData } from '../stores/admin-data'

interface Props {
  text: string
  colorEffectId?: string | null
  sizeEffectId?: string | null
  sizeProfile?: number[] | null
  customProfile?: number[] | null
  customColors?: string[] | null
  composedData?: ComposedEffectData | null
  rawProfile?: boolean
  options?: Partial<EffectOptions>
}

const DEFAULT_OPTS: EffectOptions = { baseSize: 18, amplitude: 20 }

/** Applique une palette cycling sur du texte */
function applyCustomColors(text: string, colors: string[]): string {
  let idx = 0
  return [...text].map(ch => {
    if (ch === ' ') return ' '
    const color = colors[idx % colors.length]
    idx++
    return `<span style="color:${color}">${ch}</span>`
  }).join('')
}

/** Résout un ID d'effet couleur depuis adminData (source unique de vérité) */
function resolveColorConfig(id: string | null | undefined): { colors: string[], mode?: ColorMode } | null {
  if (!id) return null
  const e = adminData().colorEffects[id]
  return e ? { colors: e.colors } : null
}

/** Résout un ID d'effet taille depuis adminData (source unique de vérité) */
function resolveSizeProfile(id: string | null | undefined): number[] | null {
  if (!id) return null
  return adminData().sizeEffects?.[id]?.profile ?? null
}

export function EffectPreview(props: Props) {
  const opts = () => ({ ...DEFAULT_OPTS, ...props.options })

  const html = () => {
    // Composed effect
    if (props.composedData) {
      let resolvedColors: string[] | null = null
      if (props.composedData.colorEffectRef) {
        resolvedColors = adminData().colorEffects[props.composedData.colorEffectRef]?.colors ?? null
      }
      const resolvedSize = resolveSizeProfile(props.composedData.sizeEffectRef)
      return applyComposedEffect(props.text, props.composedData, opts(), resolvedColors, null, resolvedSize)
    }
    // Custom colors (palette cycling)
    if (props.customColors && props.customColors.length > 0) {
      return applyCustomColors(props.text, props.customColors)
    }
    // Custom size profile
    const profile = props.sizeProfile ?? props.customProfile
    if (profile && profile.length > 0) {
      return applySizeProfile(props.text, profile, opts(), resolveColorConfig(props.colorEffectId), props.rawProfile)
    }
    // Predefined effects
    return applyEffects(
      props.text,
      resolveColorConfig(props.colorEffectId),
      resolveSizeProfile(props.sizeEffectId),
      opts(),
    )
  }

  return (
    <div
      class="effect-preview"
      innerHTML={html()}
    />
  )
}
