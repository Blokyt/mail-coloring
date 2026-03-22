import { applyEffects, applySizeProfile, type EffectOptions } from '../engine/effects'

interface Props {
  text: string
  colorEffectId?: string | null
  sizeEffectId?: string | null
  sizeProfile?: number[] | null
  options?: Partial<EffectOptions>
}

const DEFAULT_OPTS: EffectOptions = { intensity: 7, baseSize: 18 }

/**
 * Rendu inline d'un aperçu d'effet sur du texte.
 * Affiche le HTML directement via innerHTML.
 */
export function EffectPreview(props: Props) {
  const opts = () => ({ ...DEFAULT_OPTS, ...props.options })

  const html = () => {
    const profile = props.sizeProfile
    if (profile && profile.length > 0) {
      return applySizeProfile(props.text, profile, opts(), props.colorEffectId ?? null)
    }
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
