import { For, Show, createSignal } from 'solid-js'
import { FONTS, FONT_CATEGORIES, type FontEntry } from '../data/fonts'
import { activeFont, setActiveFont } from '../stores/editor'
import { fontFavorites, addFontFavorite, removeFontFavorite } from '../stores/workshops'
import { applyInlineStyle } from './Editor'
import { updateBuffer } from './Header'

export function FontPicker() {
  const [open, setOpen] = createSignal(false)
  const categories = Object.entries(FONT_CATEGORIES) as [FontEntry['category'], string][]

  const isFav = (font: string) => fontFavorites().includes(font)

  const selectFont = (fontValue: string) => {
    setActiveFont(fontValue)
    applyInlineStyle('fontFamily', fontValue)
    updateBuffer({ fontFamily: fontValue })
  }

  const toggleFav = (e: Event, fontValue: string) => {
    e.stopPropagation()
    if (isFav(fontValue)) removeFontFavorite(fontValue)
    else addFontFavorite(fontValue)
  }

  let triggerRef: HTMLButtonElement | undefined
  const [menuPos, setMenuPos] = createSignal({ top: 0, left: 0 })

  const currentName = () => {
    const f = FONTS.find(f => f.value === activeFont())
    return f ? f.name : activeFont().split(',')[0]
  }

  const handleOpen = () => {
    if (triggerRef) {
      const rect = triggerRef.getBoundingClientRect()
      setMenuPos({ top: rect.bottom + 4, left: rect.left })
    }
    setOpen(!open())
  }

  return (
    <div class="font-picker">
      {/* Trigger button */}
      <button
        ref={triggerRef}
        class="font-picker-trigger"
        style={{ "font-family": activeFont() }}
        onClick={handleOpen}
      >
        {currentName()}
        <span class="font-picker-arrow">{open() ? '▲' : '▼'}</span>
      </button>

      {/* Favoris pills inline */}
      <Show when={fontFavorites().length > 0}>
        <div class="fav-pills">
          <For each={fontFavorites()}>
            {(font) => (
              <button
                class="fav-pill"
                title="Double-clic pour retirer"
                onClick={() => selectFont(font)}
                onDblClick={() => removeFontFavorite(font)}
                style={{ "font-family": font }}
              >
                {font.split(',')[0].replace(/'/g, '')}
              </button>
            )}
          </For>
        </div>
      </Show>

      {/* Dropdown menu */}
      <Show when={open()}>
        <div class="font-picker-backdrop" onClick={() => setOpen(false)} />
        <div class="font-picker-menu" style={{ top: `${menuPos().top}px`, left: `${menuPos().left}px` }}>
          <For each={categories}>
            {([catKey, catLabel]) => (
              <div>
                <div class="font-picker-category">{catLabel}</div>
                <For each={FONTS.filter(f => f.category === catKey)}>
                  {(font) => (
                    <div
                      class={`font-picker-item ${activeFont() === font.value ? 'selected' : ''}`}
                      onClick={() => { selectFont(font.value); setOpen(false) }}
                    >
                      <span
                        class="font-picker-item-name"
                        style={{ "font-family": font.value }}
                      >
                        {font.name}
                      </span>
                      <span
                        class={`font-picker-star ${isFav(font.value) ? 'is-fav' : ''}`}
                        onClick={(e) => toggleFav(e, font.value)}
                      >
                        {isFav(font.value) ? '★' : '☆'}
                      </span>
                    </div>
                  )}
                </For>
              </div>
            )}
          </For>
        </div>
      </Show>
    </div>
  )
}
