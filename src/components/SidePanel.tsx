import { For, Show, createSignal, createEffect, on } from 'solid-js'
import { COLOR_EFFECTS, SIZE_EFFECTS, applyEffects } from '../engine/effects'
import { activeColorEffect, setActiveColorEffect, activeSizeEffect, setActiveSizeEffect, intensity, baseSize, setCustomSizeProfile } from '../stores/editor'
import { favorites, history, pushHistory } from '../stores/favorites'
import { getSelectedText, applyColorToSelection, applySizeToSelection } from './Editor'
import { showToast } from './Toast'

const COLOR_ACCENTS: Record<string, string> = {
  arcenciel: '#ff4d6d', arlequin: '#c42b45', flamme: '#ffe066',
  ocean: '#0077b6', foret: '#2d6a4f', dore: '#c9a84c',
  mystere: '#a855f7', pastel: '#f472b6', nuit: '#6366f1',
}

function renderEffectName(id: string, name: string, type: 'color' | 'size'): string {
  if (type === 'color') {
    return applyEffects(name, id, null, { intensity: 7, baseSize: 11 })
  }
  return applyEffects('Artlequin', null, id, { intensity: 2, baseSize: 9 })
}

export function SidePanel(props: { side: 'left' | 'right' }) {
  const opts = () => ({ intensity: intensity(), baseSize: baseSize() })
  const isLeft = () => props.side === 'left'
  const effects = () => isLeft() ? Object.entries(COLOR_EFFECTS) : Object.entries(SIZE_EFFECTS)
  const accents = () => isLeft() ? COLOR_ACCENTS : {} as Record<string, string>
  const type = () => (isLeft() ? 'color' : 'size') as 'color' | 'size'

  /** Clic sur un effet : si selection → applique. Sinon → toggle arme. */
  const handleClick = (id: string) => {
    const text = getSelectedText()
    if (text) {
      // Selection active → appliquer directement
      const allEffects = isLeft() ? COLOR_EFFECTS : SIZE_EFFECTS
      const effect = allEffects[id]
      if (isLeft()) {
        const colorEffect = COLOR_EFFECTS[id]
        if (!colorEffect) return
        pushHistory({ id, type: 'color', label: effect?.name || id })
        applyColorToSelection(colorEffect.colors)
      } else {
        const sizeEffect = SIZE_EFFECTS[id]
        if (!sizeEffect) return
        setCustomSizeProfile(null)
        pushHistory({ id, type: 'size', label: effect?.name || id })
        applySizeToSelection(
          (charIdx, total) => sizeEffect.getOffset(charIdx, total, opts()),
          opts().baseSize
        )
      }
      showToast('Effet applique !')
    } else {
      // Pas de selection → toggle l'effet arme
      if (isLeft()) {
        setActiveColorEffect(prev => prev === id ? null : id)
      } else {
        setActiveSizeEffect(prev => prev === id ? null : id)
      }
    }
  }

  const isArmed = (id: string) => {
    return isLeft() ? activeColorEffect() === id : activeSizeEffect() === id
  }

  const favs = () => favorites().filter(f => f.type === type())
  const hist = () => history().filter(f => f.type === type()).slice(0, 3)

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

  const colorShadow = (id: string) => {
    if (!isLeft()) return {}
    const color = accents()[id]
    if (!color) return {}
    return { "box-shadow": `var(--shadow-x) var(--shadow-y) 0 ${color}` }
  }

  const tagClass = (id: string, extra?: string) => {
    const parts = ['side-tag']
    if (extra) parts.push(extra)
    if (isArmed(id)) parts.push('armed')
    return parts.join(' ')
  }

  return (
    <div class={`side-panel ${isLeft() ? 'side-panel-left' : 'side-panel-right'}`}>
      <div class="side-panel-title">{isLeft() ? 'Couleur' : 'Taille'}</div>

      <Show when={favs().length > 0}>
        <div class="side-label">Favoris</div>
        <For each={favs()}>
          {(fav) => (
            <button
              class={tagClass(fav.id)}
              style={colorShadow(fav.id)}
              innerHTML={renderEffectName(fav.id, fav.label, type())}
              onClick={() => handleClick(fav.id)}
            />
          )}
        </For>
        <div class="side-sep" />
      </Show>

      <Show when={hist().length > 0}>
        <div class="side-label">Recents</div>
        <For each={hist()}>
          {(item) => (
            <button
              class={tagClass(item.id, `recent ${animatingIds().has(item.id) ? 'side-tag-enter' : ''}`)}
              style={colorShadow(item.id)}
              innerHTML={renderEffectName(item.id, item.label, type())}
              onClick={() => handleClick(item.id)}
            />
          )}
        </For>
        <div class="side-sep" />
      </Show>

      <div class="side-label">Tous</div>
      <For each={effects()}>
        {([id, effect]) => (
          <button
            class={tagClass(id)}
            style={colorShadow(id)}
            innerHTML={renderEffectName(id, effect.name, type())}
            onClick={() => handleClick(id)}
            title={effect.name}
          />
        )}
      </For>
    </div>
  )
}
