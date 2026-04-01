import { For, Show, createSignal, createEffect, on } from 'solid-js'
import { sampleProfile, applyComposedEffect } from '../engine/effects'
import { adminData } from '../stores/admin-data'
import { sparklineFromEffect } from '../engine/sparkline'
import { baseSize, sizeAmplitude, setCustomSizeProfile } from '../stores/editor'
import { getFavorites, getBaseEffects, getPersoEffects, history, pushHistory, type WorkshopEffect } from '../stores/workshops'
import { getSelectedText, applyColorToSelection, applySizeToSelection, replaceSelectionWithHtml } from './Editor'
import { showToast } from './Toast'
import { COLOR_ACCENTS, SIZE_ACCENTS } from '../data/accents'


// ── Rendu HTML pour effets couleur ──

function renderColorName(effect: WorkshopEffect): string {
  const colors = effect.customColors ?? effect.colors
  if (colors && colors.length > 0) {
    const isBg = effect.colorMode === 'bg'
    const prop = isBg ? 'background-color' : 'color'
    let idx = 0
    return [...effect.label].map(ch => {
      if (ch === ' ') return ' '
      const c = colors[idx % colors.length]
      idx++
      return `<span style="${prop}:${c}">${ch}</span>`
    }).join('')
  }
  return effect.label
}

// ── Composant ──

export function SidePanel(props: { side: 'left' | 'right' }) {
  const opts = () => ({ baseSize: baseSize(), amplitude: sizeAmplitude() })
  const isLeft = () => props.side === 'left'

  const isColorType = (e: WorkshopEffect) => e.type === 'color' || e.type === 'custom-color'
  const isColorText = (e: WorkshopEffect) => isColorType(e) && (e.colorMode ?? 'text') === 'text'
  const isColorBg = (e: WorkshopEffect) => isColorType(e) && e.colorMode === 'bg'
  const isSizeType = (e: WorkshopEffect) => e.type === 'size' || e.type === 'custom-size'
  const isComposedType = (e: WorkshopEffect) => e.type === 'composed'
  const matchesSide = (e: WorkshopEffect) => isComposedType(e) || (isLeft() ? isColorType(e) : isSizeType(e))

  // ── Effets couleur : tous (base + perso fusionnés) ──
  const allTextEffects = () => [
    ...getBaseEffects().filter(isColorText),
    ...getPersoEffects().filter(e => e.type === 'custom-color').map(e => ({ ...e, colorMode: 'text' as const })),
  ]
  const allBgEffects = () => [
    ...getBaseEffects().filter(isColorBg),
    ...getPersoEffects().filter(e => e.type === 'custom-color').map(e => ({ ...e, colorMode: 'bg' as const })),
  ]

  // ── Favoris et récents par colonne ──
  const textFavs = () => {
    const baseFavs = getFavorites().filter(e => isColorType(e) && (e.colorMode ?? 'text') === 'text' && e.type !== 'custom-color')
    const persoFavs = getFavorites().filter(e => e.type === 'custom-color').map(e => ({ ...e, colorMode: 'text' as const }))
    return [...baseFavs, ...persoFavs]
  }
  const bgFavs = () => {
    const baseFavs = getFavorites().filter(e => isColorType(e) && e.colorMode === 'bg')
    const persoFavs = getFavorites().filter(e => e.type === 'custom-color').map(e => ({ ...e, colorMode: 'bg' as const }))
    return [...baseFavs, ...persoFavs]
  }

  const textHist = () => history().filter(e => isColorType(e) && (e.colorMode ?? 'text') === 'text').slice(0, 3)
  const bgHist = () => history().filter(e => isColorType(e) && e.colorMode === 'bg').slice(0, 3)

  // Alignement colonnes : afficher sections si l'une des deux colonnes a du contenu
  const hasFavs = () => textFavs().length > 0 || bgFavs().length > 0
  const hasHist = () => textHist().length > 0 || bgHist().length > 0
  const maxFavs = () => Math.max(textFavs().length, bgFavs().length)
  const maxHist = () => Math.max(textHist().length, bgHist().length)

  // ── Effets taille : tous (base + perso fusionnés) ──
  const allSizeEffects = () => [
    ...getBaseEffects().filter(isSizeType),
    ...getPersoEffects().filter(isSizeType),
  ]
  /** Enrichit un effet taille avec le profil d'adminData si manquant (historique ancien) */
  const enrichSizeProfile = (e: WorkshopEffect): WorkshopEffect => {
    if (e.profile) return e
    if (e.type === 'size') {
      const profile = adminData().sizeEffects?.[e.id]?.profile
      if (profile) return { ...e, profile }
    }
    return e
  }
  const sizeFavs = () => getFavorites().filter(isSizeType).map(enrichSizeProfile)
  const sizeHist = () => history().filter(isSizeType).slice(0, 3).map(enrichSizeProfile)

  /** Clic sur un effet */
  const handleClick = (effect: WorkshopEffect) => {
    const text = getSelectedText()
    if (text) {
      if (effect.type === 'color') {
        const colors = effect.colors
        if (!colors) return
        pushHistory(effect)
        const modeLabel = (effect.colorMode ?? 'text') === 'bg' ? 'Fond' : 'Couleur'
        applyColorToSelection(colors, effect.colorMode ?? 'text', `${modeLabel} : ${effect.label}`)
      } else if (effect.type === 'custom-color' && effect.customColors) {
        pushHistory(effect)
        const modeLabel2 = (effect.colorMode ?? 'text') === 'bg' ? 'Fond' : 'Couleur'
        applyColorToSelection(effect.customColors, effect.colorMode ?? 'text', `${modeLabel2} : ${effect.label}`)
      } else if (effect.type === 'size') {
        const profile = effect.profile
        if (!profile) return
        setCustomSizeProfile(null)
        pushHistory(effect)
        applySizeToSelection(
          (charIdx, total) => {
            const t = total <= 1 ? 0 : charIdx / (total - 1)
            return opts().amplitude * sampleProfile(profile, t)
          },
          opts().baseSize,
          `Taille : ${effect.label}`,
          effect.id,
          opts().amplitude
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
          opts().baseSize,
          `Taille : ${effect.label}`
        )
      } else if (effect.type === 'composed' && effect.composedData) {
        pushHistory(effect)
        let resolvedColors: string[] | null = null
        const cRef = effect.composedData.colorEffectRef
        if (cRef) {
          const perso = getPersoEffects().find(e => e.id === cRef)
          if (perso?.customColors) {
            resolvedColors = perso.customColors
          } else {
            resolvedColors = adminData().colorEffects[cRef]?.colors ?? null
          }
        }
        const resolvedSize = effect.composedData.sizeEffectRef
          ? adminData().sizeEffects?.[effect.composedData.sizeEffectRef]?.profile ?? null
          : null
        const html = applyComposedEffect(text, effect.composedData, opts(), resolvedColors, null, resolvedSize)
        replaceSelectionWithHtml(html, `Composé : ${effect.label}`)
      }
      showToast('Effet applique !')
    } else {
      showToast('Selectionnez du texte d\'abord', true)
    }
  }

  // Animation recents
  const [animatingIds, setAnimatingIds] = createSignal<Set<string>>(new Set())
  let prevHistIds: string[] = []

  createEffect(on(() => history().filter(matchesSide).slice(0, 3), (current) => {
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
    isColorType(p.effect)
      ? <ColorTag effect={p.effect} extra={p.extra} />
      : <SizeTag effect={p.effect} extra={p.extra} />

  /** Colonne de couleur (texte ou fond) avec favoris, récents, tous */
  const ColorColumn = (colProps: {
    title: string
    favs: () => WorkshopEffect[]
    hist: () => WorkshopEffect[]
    all: () => WorkshopEffect[]
    reserveFavs: () => number
    reserveHist: () => number
  }) => (
    <div class="side-col">
      <div class="side-panel-title">{colProps.title}</div>
      <div class="side-col-scroll">
        <Show when={hasFavs()}>
          <div class="side-label">Favoris</div>
          <For each={colProps.favs()}>
            {(effect) => <EffectTag effect={effect} />}
          </For>
          <For each={Array(colProps.reserveFavs() - colProps.favs().length).fill(0)}>
            {() => <div class="side-tag-placeholder" />}
          </For>
          <div class="side-sep" />
        </Show>

        <Show when={hasHist()}>
          <div class="side-label">Recents</div>
          <For each={colProps.hist()}>
            {(effect) => (
              <EffectTag
                effect={effect}
                extra={`recent ${animatingIds().has(effect.id) ? 'side-tag-enter' : ''}`}
              />
            )}
          </For>
          <For each={Array(colProps.reserveHist() - colProps.hist().length).fill(0)}>
            {() => <div class="side-tag-placeholder" />}
          </For>
          <div class="side-sep" />
        </Show>

        <For each={colProps.all()}>
          {(effect) => <EffectTag effect={effect} />}
        </For>
      </div>
    </div>
  )

  // ── Panneau gauche : deux colonnes Texte / Fond ──
  if (isLeft()) {
    return (
      <div class="side-panel side-panel-left" onMouseDown={(e) => e.preventDefault()}>
        <div class="side-dual-cols">
          <ColorColumn title="Texte" favs={textFavs} hist={textHist} all={allTextEffects} reserveFavs={maxFavs} reserveHist={maxHist} />
          <ColorColumn title="Fond" favs={bgFavs} hist={bgHist} all={allBgEffects} reserveFavs={maxFavs} reserveHist={maxHist} />
        </div>
      </div>
    )
  }

  // ── Panneau droit : colonne unique Taille ──
  return (
    <div class="side-panel side-panel-right" onMouseDown={(e) => e.preventDefault()}>
      <div class="side-panel-title">Taille</div>

      <Show when={sizeFavs().length > 0}>
        <div class="side-label">Favoris</div>
        <For each={sizeFavs()}>
          {(effect) => <EffectTag effect={effect} />}
        </For>
        <div class="side-sep" />
      </Show>

      <Show when={sizeHist().length > 0}>
        <div class="side-label">Recents</div>
        <For each={sizeHist()}>
          {(effect) => (
            <EffectTag
              effect={effect}
              extra={`recent ${animatingIds().has(effect.id) ? 'side-tag-enter' : ''}`}
            />
          )}
        </For>
        <div class="side-sep" />
      </Show>

      <For each={allSizeEffects()}>
        {(effect) => <EffectTag effect={effect} />}
      </For>
    </div>
  )
}
