import { For, Show, createSignal, createEffect, on } from 'solid-js'
import { COLOR_EFFECTS, SIZE_EFFECTS, applyEffects, applyComposedEffect } from '../engine/effects'
import { sparklineFromEffect } from '../engine/sparkline'
import { activeColorEffect, setActiveColorEffect, activeSizeEffect, setActiveSizeEffect, baseSize, sizeAmplitude, setCustomSizeProfile } from '../stores/editor'
import { getFavorites, getBaseEffects, getPersoEffects, history, pushHistory, type WorkshopEffect } from '../stores/workshops'
import { getSelectedText, applyColorToSelection, applySizeToSelection, replaceSelectionWithHtml } from './Editor'
import { showToast } from './Toast'
import { COLOR_ACCENTS, SIZE_ACCENTS } from '../data/accents'


// ── Rendu HTML pour effets couleur ──

function renderColorName(effect: WorkshopEffect): string {
  if (effect.type === 'custom-color' && effect.customColors) {
    let idx = 0
    return [...effect.label].map(ch => {
      if (ch === ' ') return ' '
      const c = effect.customColors![idx % effect.customColors!.length]
      idx++
      return `<span style="color:${c}">${ch}</span>`
    }).join('')
  }
  return applyEffects(effect.label, effect.id, null, { baseSize: 11 })
}

// ── Composant ──

export function SidePanel(props: { side: 'left' | 'right' }) {
  const opts = () => ({ baseSize: baseSize(), amplitude: sizeAmplitude() })
  const isLeft = () => props.side === 'left'

  const isColorType = (e: WorkshopEffect) => e.type === 'color' || e.type === 'custom-color'
  const isSizeType = (e: WorkshopEffect) => e.type === 'size' || e.type === 'custom-size'
  const isComposedType = (e: WorkshopEffect) => e.type === 'composed'
  const matchesSide = (e: WorkshopEffect) => isComposedType(e) || (isLeft() ? isColorType(e) : isSizeType(e))

  const baseEffects = () => getBaseEffects().filter(matchesSide)

  const persoEffectsForSide = () => getPersoEffects().filter(matchesSide)

  const favs = () => getFavorites().filter(matchesSide)

  const hist = () => history().filter(matchesSide).slice(0, 3)

  /** Clic sur un effet */
  const handleClick = (effect: WorkshopEffect) => {
    const text = getSelectedText()
    if (text) {
      if (effect.type === 'color') {
        const colorEffect = COLOR_EFFECTS[effect.id]
        if (!colorEffect) return
        pushHistory(effect)
        applyColorToSelection(colorEffect.colors)
      } else if (effect.type === 'custom-color' && effect.customColors) {
        pushHistory(effect)
        applyColorToSelection(effect.customColors)
      } else if (effect.type === 'size') {
        const sizeEffect = SIZE_EFFECTS[effect.id]
        if (!sizeEffect) return
        setCustomSizeProfile(null)
        pushHistory(effect)
        applySizeToSelection(
          (charIdx, total) => {
            const t = total <= 1 ? 0 : charIdx / (total - 1)
            return opts().amplitude * sizeEffect.getShape(t)
          },
          opts().baseSize
        )
      } else if (effect.type === 'custom-size' && effect.profile) {
        pushHistory(effect)
        const profile = effect.profile
        const isRaw = !!effect.rawProfile
        const amp = opts().amplitude
        applySizeToSelection(
          (charIdx, total) => {
            const t = total <= 1 ? 0 : charIdx / (total - 1)
            const pIdx = t * (profile.length - 1)
            const lo = Math.floor(pIdx)
            const hi = Math.min(lo + 1, profile.length - 1)
            const frac = pIdx - lo
            const v = profile[lo] * (1 - frac) + profile[hi] * frac
            return isRaw ? v : v * amp
          },
          opts().baseSize
        )
      } else if (effect.type === 'composed' && effect.composedData) {
        pushHistory(effect)
        // Resoudre les couleurs custom si necessaire
        let resolvedColors: string[] | null = null
        const cRef = effect.composedData.colorEffectRef
        if (cRef) {
          const perso = getPersoEffects().find(e => e.id === cRef)
          if (perso?.customColors) resolvedColors = perso.customColors
        }
        const html = applyComposedEffect(text, effect.composedData, opts(), resolvedColors)
        replaceSelectionWithHtml(html)
      }
      showToast('Effet applique !')
    } else {
      if (effect.type === 'composed' && effect.composedData) {
        // Armer les sous-effets du compose
        if (effect.composedData.colorEffectRef) setActiveColorEffect(effect.composedData.colorEffectRef)
        if (effect.composedData.sizeEffectRef) setActiveSizeEffect(effect.composedData.sizeEffectRef)
      } else if (effect.type === 'color' || effect.type === 'custom-color') {
        setActiveColorEffect(prev => prev === effect.id ? null : effect.id)
      } else {
        if (effect.type === 'custom-size' && effect.profile) {
          setCustomSizeProfile(effect.profile)
        } else {
          setCustomSizeProfile(null)
        }
        setActiveSizeEffect(prev => prev === effect.id ? null : effect.id)
      }
    }
  }

  const isArmed = (id: string) =>
    isLeft() ? activeColorEffect() === id : activeSizeEffect() === id

  // Animation recents
  const [animatingIds, setAnimatingIds] = createSignal<Set<string>>(new Set())
  let prevHistIds: string[] = []

  createEffect(on(hist, (current) => {
    const currentIds = current.map(h => h.id)
    const newIds = currentIds.filter(id => !prevHistIds.includes(id))
    if (newIds.length > 0) {
      setAnimatingIds(new Set(newIds))
      setTimeout(() => setAnimatingIds(new Set()), 350)
    }
    prevHistIds = currentIds
  }))

  // Accent shadow
  const accentShadow = (id: string) => {
    const map = isLeft() ? COLOR_ACCENTS : SIZE_ACCENTS
    const color = map[id]
    if (!color) return {}
    return { "box-shadow": `var(--shadow-x) var(--shadow-y) 0 ${color}` }
  }

  const tagClass = (id: string, extra?: string) => {
    const parts = ['side-tag']
    if (!isLeft()) parts.push('side-tag-size')
    if (extra) parts.push(extra)
    if (isArmed(id)) parts.push('armed')
    return parts.join(' ')
  }

  // ── Tag rendering ──

  const ColorTag = (p: { effect: WorkshopEffect; extra?: string }) => (
    <button
      class={tagClass(p.effect.id, p.extra)}
      style={accentShadow(p.effect.id)}
      innerHTML={renderColorName(p.effect)}
      onClick={() => handleClick(p.effect)}
      title={p.effect.label}
    />
  )

  const SizeTag = (p: { effect: WorkshopEffect; extra?: string }) => (
    <button
      class={tagClass(p.effect.id, p.extra)}
      style={accentShadow(p.effect.id)}
      onClick={() => handleClick(p.effect)}
      title={p.effect.label}
    >
      <span class="side-tag-name">{p.effect.label}</span>
      <svg class="side-tag-sparkline" viewBox="0 0 100 24" preserveAspectRatio="none">
        <path
          d={sparklineFromEffect(p.effect)}
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    </button>
  )

  const EffectTag = (p: { effect: WorkshopEffect; extra?: string }) =>
    p.effect.type === 'color'
      ? <ColorTag effect={p.effect} extra={p.extra} />
      : <SizeTag effect={p.effect} extra={p.extra} />

  return (
    <div class={`side-panel ${isLeft() ? 'side-panel-left' : 'side-panel-right'}`}>
      <div class="side-panel-title">{isLeft() ? 'Couleur' : 'Taille'}</div>

      <Show when={favs().length > 0}>
        <div class="side-label">Favoris</div>
        <For each={favs()}>
          {(effect) => <EffectTag effect={effect} />}
        </For>
        <div class="side-sep" />
      </Show>

      <Show when={hist().length > 0}>
        <div class="side-label">Recents</div>
        <For each={hist()}>
          {(effect) => (
            <EffectTag
              effect={effect}
              extra={`recent ${animatingIds().has(effect.id) ? 'side-tag-enter' : ''}`}
            />
          )}
        </For>
        <div class="side-sep" />
      </Show>

      <div class="side-label">Tous</div>
      <For each={baseEffects()}>
        {(effect) => <EffectTag effect={effect} />}
      </For>

      <Show when={persoEffectsForSide().length > 0}>
        <div class="side-sep" />
        <div class="side-label">Perso</div>
        <For each={persoEffectsForSide()}>
          {(effect) => <EffectTag effect={effect} />}
        </For>
      </Show>
    </div>
  )
}
