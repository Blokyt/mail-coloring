import { For, Show, createSignal } from 'solid-js'
import { Portal } from 'solid-js/web'
import { FONTS, FONT_CATEGORIES, type FontEntry } from '../data/fonts'
import { activeFont, setActiveFont } from '../stores/editor'
import { applyInlineStyle } from './Editor'
import { updateBuffer, setPreview } from './Header'

export function FontPicker() {
  const [open, setOpen] = createSignal(false)
  const [menuPos, setMenuPos] = createSignal({ top: 0, left: 0 })
  let triggerRef: HTMLButtonElement | undefined

  const categories = Object.entries(FONT_CATEGORIES) as [FontEntry['category'], string][]

  const currentName = () => {
    const f = FONTS.find(f => f.value === activeFont())
    return f ? f.name : activeFont().split(',')[0]
  }

  const selectFont = (fontValue: string) => {
    setActiveFont(fontValue)
    applyInlineStyle('fontFamily', fontValue)
    updateBuffer({ fontFamily: fontValue })
    setPreview(null)
    setOpen(false)
  }

  const handleOpen = () => {
    if (open()) { setOpen(false); setPreview(null); return }
    if (triggerRef) {
      const rect = triggerRef.getBoundingClientRect()
      setMenuPos({ top: rect.bottom + 4, left: rect.left })
    }
    setOpen(true)
  }

  return (
    <div class="font-picker">
      <button
        ref={triggerRef}
        class="font-picker-trigger"
        style={{ "font-family": activeFont() }}
        onClick={handleOpen}
      >
        {currentName()}
        <span class="font-picker-arrow">{open() ? '▲' : '▼'}</span>
      </button>

      <Show when={open()}>
        <Portal>
          <div class="font-picker-backdrop" onClick={() => { setOpen(false); setPreview(null) }} />
          <div
            class="font-picker-menu"
            style={{ top: `${menuPos().top}px`, left: `${menuPos().left}px` }}
            onMouseLeave={() => setPreview(null)}
          >
            <For each={categories}>
              {([catKey, catLabel]) => (
                <div>
                  <div class="font-picker-category">{catLabel}</div>
                  <For each={FONTS.filter(f => f.category === catKey)}>
                    {(font) => (
                      <button
                        class={`font-picker-item ${activeFont() === font.value ? 'selected' : ''}`}
                        onClick={() => selectFont(font.value)}
                        onMouseEnter={() => setPreview({ fontFamily: font.value })}
                      >
                        <span class="font-picker-item-preview" style={{ "font-family": font.value }}>Aa</span>
                        <span class="font-picker-item-name">{font.name}</span>
                      </button>
                    )}
                  </For>
                </div>
              )}
            </For>
          </div>
        </Portal>
      </Show>
    </div>
  )
}
