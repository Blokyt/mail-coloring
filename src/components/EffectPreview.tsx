import { applyEffects, applySizeProfile, applyComposedEffect, type EffectOptions, type ComposedEffectData } from '../engine/effects'

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

export function EffectPreview(props: Props) {
  const opts = () => ({ ...DEFAULT_OPTS, ...props.options })

  const html = () => {
    // Composed effect
    if (props.composedData) {
      return applyComposedEffect(props.text, props.composedData, opts())
    }
    // Custom colors (palette cycling)
    if (props.customColors && props.customColors.length > 0) {
      return applyCustomColors(props.text, props.customColors)
    }
    // Custom size profile
    const profile = props.sizeProfile ?? props.customProfile
    if (profile && profile.length > 0) {
      return applySizeProfile(props.text, profile, opts(), props.colorEffectId ?? null, props.rawProfile)
    }
    // Predefined effects
    return applyEffects(
      props.text,
      props.colorEffectId ?? null,
      props.sizeEffectId ?? null,
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
