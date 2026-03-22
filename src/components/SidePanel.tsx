import { For, Show, createSignal, createEffect, on } from 'solid-js'
import { COLOR_EFFECTS, SIZE_EFFECTS, applyEffects } from '../engine/effects'
import { activeColorEffect, activeSizeEffect, intensity, baseSize, setCustomSizeProfile } from '../stores/editor'
import { favorites, history, pushHistory } from '../stores/favorites'
import { getSelectedText, replaceSelectionWithHtml, applyColorToSelection, applySizeToSelection } from './Editor'
import { showToast } from './Toast'

const COLOR_ACCENTS: Record<string, string> = {
  arcenciel: '#ff4d6d', arlequin: '#c42b45', flamme: '#ffe066',
  ocean: '#0077b6', foret: '#2d6a4f', dore: '#c9a84c',
  mystere: '#a855f7', pastel: '#f472b6', nuit: '#6366f1',
}

/** Génère le HTML d'un nom d'effet avec l'effet appliqué sur lui-même */
function renderEffectName(id: string, name: string, type: 'color' | 'size'): string {
  if (type === 'color') {
    return applyEffects(name, id, null, { intensity: 7, baseSize: 11 })
  }
  // Size effects: on utilise "Artlequin" pour avoir assez de lettres pour voir l'effet
  return applyEffects('Artlequin', null, id, { intensity: 2, baseSize: 9 })
}

export function SidePanel(props: { side: 'left' | 'right' }) {
  const opts = () => ({ intensity: intensity(), baseSize: baseSize() })
  const isLeft = () => props.side === 'left'
  const effects = () => isLeft() ? Object.entries(COLOR_EFFECTS) : Object.entries(SIZE_EFFECTS)
  const accents = () => isLeft() ? COLOR_ACCENTS : {} as Record<string, string>
  const type = () => (isLeft() ? 'color' : 'size') as 'color' | 'size'

  const handleApply = (id: string) => {
    const text = getSelectedText()
    if (!text) { showToast('Sélectionnez du texte', true); return }
    const allEffects = isLeft() ? COLOR_EFFECTS : SIZE_EFFECTS
    const effect = allEffects[id]
    if (isLeft()) {
      // Couleur : appliquer sur la selection en preservant le formatage
      const colorEffect = COLOR_EFFECTS[id]
      if (!colorEffect) return
      pushHistory({ id, type: 'color', label: effect?.name || id })
      applyColorToSelection(colorEffect.colors)
    } else {
      // Taille : appliquer sur la selection en preservant le formatage
      const sizeEffect = SIZE_EFFECTS[id]
      if (!sizeEffect) return
      setCustomSizeProfile(null)
      pushHistory({ id, type: 'size', label: effect?.name || id })
      applySizeToSelection(
        (charIdx, total) => sizeEffect.getOffset(charIdx, total, opts()),
        opts().baseSize
      )
    }
    showToast('Effet appliqué !')
  }

  const favs = () => favorites().filter(f => f.type === type())
  const hist = () => history().filter(f => f.type === type()).slice(0, 3)

  // Track which recent item IDs are newly added for animation
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

  /** Ombre colorée pour les effets couleur (utilise les variables CSS shadow) */
  const colorShadow = (id: string) => {
    if (!isLeft()) return {}
    const color = accents()[id]
    if (!color) return {}
    return { "box-shadow": `var(--shadow-x) var(--shadow-y) 0 ${color}` }
  }

  return (
    <div class={`side-panel ${isLeft() ? 'side-panel-left' : 'side-panel-right'}`}>
      <div class="side-panel-title">{isLeft() ? 'Couleur' : 'Taille'}</div>

      <Show when={favs().length > 0}>
        <div class="side-label">Favoris</div>
        <For each={favs()}>
          {(fav) => (
            <button
              class="side-tag"
              style={colorShadow(fav.id)}
              innerHTML={renderEffectName(fav.id, fav.label, type())}
              onClick={() => handleApply(fav.id)}
            />
          )}
        </For>
        <div class="side-sep" />
      </Show>

      <Show when={hist().length > 0}>
        <div class="side-label">Récents</div>
        <For each={hist()}>
          {(item) => (
            <button
              class={`side-tag recent ${animatingIds().has(item.id) ? 'side-tag-enter' : ''}`}
              style={colorShadow(item.id)}
              innerHTML={renderEffectName(item.id, item.label, type())}
              onClick={() => handleApply(item.id)}
            />
          )}
        </For>
        <div class="side-sep" />
      </Show>

      <div class="side-label">Tous</div>
      <For each={effects()}>
        {([id, effect]) => (
          <button
            class="side-tag"
            style={colorShadow(id)}
            innerHTML={renderEffectName(id, effect.name, type())}
            onClick={() => handleApply(id)}
            title={effect.name}
          />
        )}
      </For>
    </div>
  )
}
