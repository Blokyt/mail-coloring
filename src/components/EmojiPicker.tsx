import { createSignal, For, Show, onCleanup, createEffect } from 'solid-js'
import { Portal } from 'solid-js/web'
import { getBaseEmojis, getPersoEmojis, addPersoEmoji, removePersoEmoji, toggleEmojiFavorite, isEmojiFavorite, type EmojiEntry } from '../stores/emojis'

interface Props {
  onSelect: (emoji: string) => void
  selected?: string
}

export function EmojiPicker(props: Props) {
  const [open, setOpen] = createSignal(false)
  const [adding, setAdding] = createSignal(false)
  const [newEmoji, setNewEmoji] = createSignal('')
  const [newLabel, setNewLabel] = createSignal('')
  const [pos, setPos] = createSignal({ top: 0, left: 0 })
  let triggerRef: HTMLButtonElement | undefined
  let addInputRef: HTMLInputElement | undefined

  const handleSelect = (emoji: string) => {
    props.onSelect(emoji)
    setOpen(false)
  }

  const handleAdd = () => {
    const e = newEmoji().trim()
    const l = newLabel().trim() || e
    if (!e) return
    addPersoEmoji(e, l)
    setNewEmoji('')
    setNewLabel('')
    setAdding(false)
  }

  const toggle = () => {
    if (!open()) {
      if (triggerRef) {
        const rect = triggerRef.getBoundingClientRect()
        setPos({ top: rect.bottom + 6, left: rect.left })
      }
      setOpen(true)
    } else {
      setOpen(false)
    }
  }

  return (
    <div class="emoji-picker-wrap">
      <button
        ref={triggerRef}
        class={`btn emoji-picker-trigger ${props.selected ? 'has-value' : ''}`}
        onClick={toggle}
      >
        {props.selected || 'Emoji'}
      </button>

      <Show when={open()}>
        <Portal>
          <div class="emoji-picker-backdrop" onClick={() => setOpen(false)} />
          <div class="emoji-picker" style={{ position: 'fixed', top: `${pos().top}px`, left: `${pos().left}px` }}>
            <div class="emoji-picker-section">
              <div class="emoji-picker-label">Base</div>
              <div class="emoji-picker-grid">
                <For each={getBaseEmojis()}>
                  {(entry) => (
                    <div class="emoji-picker-item">
                      <button
                        class={`emoji-picker-btn ${props.selected === entry.emoji ? 'active' : ''}`}
                        title={entry.label}
                        onClick={() => handleSelect(entry.emoji)}
                      >
                        {entry.emoji}
                      </button>
                      <button
                        class={`emoji-fav-star ${isEmojiFavorite(entry.emoji) ? 'is-fav' : ''}`}
                        onClick={(e) => { e.stopPropagation(); toggleEmojiFavorite(entry.emoji) }}
                        title={isEmojiFavorite(entry.emoji) ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                      >
                        {isEmojiFavorite(entry.emoji) ? '\u2605' : '\u2606'}
                      </button>
                    </div>
                  )}
                </For>
              </div>
            </div>

            <Show when={getPersoEmojis().length > 0}>
              <div class="emoji-picker-section">
                <div class="emoji-picker-label">Perso</div>
                <div class="emoji-picker-grid">
                  <For each={getPersoEmojis()}>
                    {(entry) => (
                      <button
                        class={`emoji-picker-btn ${props.selected === entry.emoji ? 'active' : ''}`}
                        title={`${entry.label} (double-clic pour retirer)`}
                        onClick={() => handleSelect(entry.emoji)}
                        onDblClick={() => removePersoEmoji(entry.id)}
                      >
                        {entry.emoji}
                      </button>
                    )}
                  </For>
                </div>
              </div>
            </Show>

            <Show when={!adding()}>
              <button class="emoji-picker-add-btn" onClick={() => { setAdding(true); requestAnimationFrame(() => addInputRef?.focus()) }}>
                + Ajouter
              </button>
            </Show>

            <Show when={adding()}>
              <div class="emoji-picker-add-form">
                <input
                  ref={addInputRef}
                  class="emoji-picker-add-input"
                  type="text"
                  value={newEmoji()}
                  onInput={(e) => setNewEmoji(e.currentTarget.value)}
                  placeholder="Coller un emoji..."
                  onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') setAdding(false) }}
                />
                <button class="btn btn-lavender" style={{ padding: '4px 10px', "font-size": 'var(--font-sm)' }} onClick={handleAdd}>OK</button>
              </div>
            </Show>
          </div>
        </Portal>
      </Show>
    </div>
  )
}
