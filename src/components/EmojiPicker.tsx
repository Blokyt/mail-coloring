import { createSignal, For, Show } from 'solid-js'
import { Portal } from 'solid-js/web'
import { getBaseEmojis, getPersoEmojis, addPersoEmoji, removePersoEmoji, toggleEmojiFavorite, isEmojiFavorite, getEmojiFavoritesList, getAllEmojis, type EmojiEntry } from '../stores/emojis'

interface Props {
  onSelect: (emoji: string) => void
  selected?: string
}

function EmojiButton(props: {
  entry: EmojiEntry
  selected?: string
  onSelect: (emoji: string) => void
  showRemove?: boolean
  onRemove?: () => void
}) {
  const fav = () => isEmojiFavorite(props.entry.emoji)

  return (
    <div class={`emoji-picker-item ${props.showRemove ? 'emoji-picker-item-perso' : ''}`}>
      <button
        class={`emoji-picker-btn ${props.selected === props.entry.emoji ? 'active' : ''} ${fav() ? 'is-fav' : ''}`}
        title={props.entry.label}
        onClick={() => props.onSelect(props.entry.emoji)}
      >
        {props.entry.emoji}
      </button>
      <button
        class={`emoji-fav-btn ${fav() ? 'is-fav' : ''}`}
        onClick={(e) => { e.stopPropagation(); toggleEmojiFavorite(props.entry.emoji) }}
        title={fav() ? 'Retirer des favoris' : 'Ajouter aux favoris'}
      >
        ★
      </button>
      <Show when={props.showRemove}>
        <button
          class="emoji-picker-remove"
          onClick={(e) => { e.stopPropagation(); props.onRemove?.() }}
          title="Retirer"
        >✕</button>
      </Show>
    </div>
  )
}

export function EmojiPicker(props: Props) {
  const [open, setOpen] = createSignal(false)
  const [adding, setAdding] = createSignal(false)
  const [newEmoji, setNewEmoji] = createSignal('')
  const [pos, setPos] = createSignal({ top: 0, left: 0 })
  let triggerRef: HTMLButtonElement | undefined
  let addInputRef: HTMLInputElement | undefined

  const handleSelect = (emoji: string) => {
    props.onSelect(emoji)
    setOpen(false)
  }

  const handleAdd = () => {
    const e = newEmoji().trim()
    if (!e) return
    addPersoEmoji(e, e)
    setNewEmoji('')
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

  const favoriteEmojis = () => {
    const favs = getEmojiFavoritesList()
    if (favs.length === 0) return []
    const all = getAllEmojis()
    return favs.map(f => all.find(e => e.emoji === f)).filter(Boolean) as EmojiEntry[]
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

            {/* Favoris */}
            <Show when={favoriteEmojis().length > 0}>
              <div class="emoji-picker-section">
                <div class="emoji-picker-label">★ Favoris</div>
                <div class="emoji-picker-grid">
                  <For each={favoriteEmojis()}>
                    {(entry) => (
                      <button
                        class={`emoji-picker-btn ${props.selected === entry.emoji ? 'active' : ''}`}
                        title={entry.label}
                        onClick={() => handleSelect(entry.emoji)}
                      >
                        {entry.emoji}
                      </button>
                    )}
                  </For>
                </div>
              </div>
            </Show>

            {/* Base */}
            <div class="emoji-picker-section">
              <div class="emoji-picker-label">Base</div>
              <div class="emoji-picker-grid">
                <For each={getBaseEmojis()}>
                  {(entry) => (
                    <EmojiButton entry={entry} selected={props.selected} onSelect={handleSelect} />
                  )}
                </For>
              </div>
            </div>

            {/* Perso */}
            <Show when={getPersoEmojis().length > 0}>
              <div class="emoji-picker-section">
                <div class="emoji-picker-label">Perso</div>
                <div class="emoji-picker-grid">
                  <For each={getPersoEmojis()}>
                    {(entry) => (
                      <EmojiButton
                        entry={entry}
                        selected={props.selected}
                        onSelect={handleSelect}
                        showRemove
                        onRemove={() => removePersoEmoji(entry.id)}
                      />
                    )}
                  </For>
                </div>
              </div>
            </Show>

            {/* Ajouter */}
            <Show when={!adding()}>
              <button class="emoji-picker-add-btn" onClick={() => {
                setAdding(true)
                requestAnimationFrame(() => addInputRef?.focus())
              }}>
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
                  placeholder="😀"
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
