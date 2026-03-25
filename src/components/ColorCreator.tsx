import { createSignal, For, Show } from 'solid-js'
import { VENETIAN_PALETTE } from '../data/colors'
import { PREVIEW_WORDS } from '../data/preview'

interface Props {
  onSave: (colors: string[], label: string) => void
}

export function ColorCreator(props: Props) {
  const [palette, setPalette] = createSignal<string[]>([])
  const [pickerColor, setPickerColor] = createSignal('#c42b45')

  const addColor = (hex: string) => {
    setPalette(prev => [...prev, hex])
  }

  const removeColor = (index: number) => {
    setPalette(prev => prev.filter((_, i) => i !== index))
  }

  const clear = () => setPalette([])

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
          {(color, i) => (
            <div
              class="color-creator-swatch"
              style={{ background: color }}
              title="Cliquer pour retirer"
              onClick={() => removeColor(i())}
            />
          )}
        </For>
        <div class="color-creator-picker-wrap">
          <div class="color-creator-picker-visual" style={{ background: pickerColor() }} />
          <input
            type="color"
            value={pickerColor()}
            onChange={(e) => { setPickerColor(e.currentTarget.value); addColor(e.currentTarget.value) }}
          />
        </div>
      </div>

      <div class="color-creator-label">Palette rapide :</div>
      <div class="color-creator-swatches">
        <For each={VENETIAN_PALETTE}>
          {(c) => (
            <div
              class="color-creator-swatch"
              style={{ background: c.hex }}
              title={c.name}
              onClick={() => addColor(c.hex)}
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
          <button class="btn btn-lavender" onClick={() => props.onSave([...palette()], '')}>
            Enregistrer
          </button>
          <button class="btn" onClick={clear}>Effacer</button>
        </div>
      </Show>
    </div>
  )
}
