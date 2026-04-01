import { createSignal, For, Show } from 'solid-js'
import { getToolbarColors } from '../stores/palettes'
import { PREVIEW_WORDS } from '../data/preview'

interface Props {
  onSave: (colors: string[], label: string) => void
}

export function ColorCreator(props: Props) {
  const [palette, setPalette] = createSignal<string[]>([])
  const [selectedIdx, setSelectedIdx] = createSignal<number | null>(null)

  const addColor = (hex: string) => {
    setPalette(prev => [...prev, hex])
    setSelectedIdx(null)
  }

  const removeColor = (index: number) => {
    setPalette(prev => prev.filter((_, i) => i !== index))
    setSelectedIdx(null)
  }

  const editColor = (index: number, hex: string) => {
    setPalette(prev => prev.map((c, i) => i === index ? hex : c))
  }

  const clear = () => { setPalette([]); setSelectedIdx(null) }

  const previewHtml = (text: string): string => {
    const colors = palette()
    if (colors.length === 0) return text
    const chars = [...text]
    let idx = 0
    return chars.map(ch => {
      if (ch === ' ') return ' '
      const color = colors[idx % colors.length]
      idx++
      return `<span style="color:${color}">${ch}</span>`
    }).join('')
  }

  return (
    <div class="color-creator">
      <div class="color-creator-label">Vos couleurs :</div>
      <div class="color-creator-palette">
        <For each={palette()}>
          {(color, i) => {
            const isSelected = () => selectedIdx() === i()
            return (
              <div class="swatch-wrap">
                <div
                  class={`swatch ${isSelected() ? 'swatch-active' : ''}`}
                  style={{ background: color }}
                  title={color}
                  onClick={() => setSelectedIdx(prev => prev === i() ? null : i())}
                />
                <Show when={isSelected()}>
                  <button
                    class="swatch-remove"
                    onClick={(e) => { e.stopPropagation(); removeColor(i()) }}
                  >x</button>
                </Show>
              </div>
            )
          }}
        </For>
        <div class="color-picker-wrapper">
          <div class="color-picker-visual" />
          <input
            type="color"
            value={selectedIdx() !== null ? palette()[selectedIdx()!] : '#c42b45'}
            onInput={(e) => {
              const idx = selectedIdx()
              if (idx !== null) {
                editColor(idx, e.currentTarget.value)
              }
            }}
            onChange={(e) => {
              if (selectedIdx() === null) {
                addColor(e.currentTarget.value)
              }
            }}
          />
        </div>
      </div>

      <div class="color-creator-label">Palette rapide :</div>
      <div class="color-creator-swatches">
        <For each={getToolbarColors()}>
          {(c) => (
            <div
              class="color-creator-swatch"
              style={{ background: c.hex }}
              title={c.name}
              onClick={() => {
                const idx = selectedIdx()
                if (idx !== null) {
                  editColor(idx, c.hex)
                  setSelectedIdx(null)
                } else {
                  addColor(c.hex)
                }
              }}
            />
          )}
        </For>
      </div>

      <Show when={palette().length > 0}>
        <div class="color-creator-label">Apercu :</div>
        <div class="color-creator-previews">
          <For each={PREVIEW_WORDS}>
            {(word) => (
              <div class="catalog-preview-item" innerHTML={previewHtml(word)} />
            )}
          </For>
        </div>

        <div class="color-creator-actions">
          <button class="btn btn-lavender" onClick={() => { props.onSave([...palette()], ''); clear() }}>
            Enregistrer
          </button>
          <button class="btn" onClick={clear}>Effacer</button>
        </div>
      </Show>
    </div>
  )
}
