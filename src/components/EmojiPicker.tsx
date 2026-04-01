import { createSignal, For, Show } from 'solid-js'
import { Portal } from 'solid-js/web'

/* ── Emojis intégrés par catégorie ── */

const EMOJI_CATEGORIES: { name: string; emojis: string[] }[] = [
  { name: 'Populaires', emojis: ['😀','😂','🥰','😎','🤩','😭','🔥','✨','❤️','💯','👍','👏','🎉','🎊','💪','🙏'] },
  { name: 'Visages', emojis: ['😊','😁','😅','🤣','😍','😘','😜','🤔','😏','🥺','😤','😱','🤯','🥳','😈','🤡'] },
  { name: 'Gestes', emojis: ['👋','👉','👈','☝️','✌️','🤘','🤙','👌','✋','🫶','💅','🙌','👐','🫡','🤝','💀'] },
  { name: 'Coeurs', emojis: ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','💖','💝','💕','❤️‍🔥','💔','♥️','🫀','💗'] },
  { name: 'Nature', emojis: ['🌸','🌹','🌺','🌻','🌿','🍃','🌳','🍀','🌈','⭐','🌙','☀️','🦋','🐝','🌊','🍂'] },
  { name: 'Nourriture', emojis: ['🧀','🍕','🍔','🌮','🍰','🍩','🍪','☕','🍷','🍺','🫓','🍫','🧁','🥐','🍓','🍉'] },
  { name: 'Fete', emojis: ['🎉','🎊','🎈','🎁','🎄','🎃','🎆','🎇','🪅','🎵','🎶','🎤','🎸','🥂','🍾','🎭'] },
  { name: 'Sport', emojis: ['⚽','🏀','🎾','🏐','🎿','🏔️','⛰️','🏄','🚴','🧗','🏕️','🧶','🎯','🏆','🥇','🎮'] },
  { name: 'Symboles', emojis: ['✅','❌','⚡','💡','📌','🔗','📣','🚀','💎','👑','🪶','🎨','📝','⚠️','♻️','🧚'] },
  { name: 'Animaux', emojis: ['🐱','🐶','🐼','🦊','🐸','🐵','🦄','🐝','🤠','🐷','🐮','🐔','🐙','🦀','🐢','🦋'] },
]

/* ── Stockage local des favoris et récents ── */

const FAVS_KEY = 'artlequin_emoji_favs'
const RECENTS_KEY = 'artlequin_emoji_recents'
const MAX_RECENTS = 16

function loadList(key: string): string[] {
  try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : [] } catch { return [] }
}
function saveList(key: string, list: string[]) { localStorage.setItem(key, JSON.stringify(list)) }

const [favs, setFavs] = createSignal<string[]>(loadList(FAVS_KEY))
const [recents, setRecents] = createSignal<string[]>(loadList(RECENTS_KEY))

function toggleFav(emoji: string) {
  const updated = favs().includes(emoji) ? favs().filter(e => e !== emoji) : [...favs(), emoji]
  setFavs(updated); saveList(FAVS_KEY, updated)
}

function pushRecent(emoji: string) {
  const updated = [emoji, ...recents().filter(e => e !== emoji)].slice(0, MAX_RECENTS)
  setRecents(updated); saveList(RECENTS_KEY, updated)
}

export function getEmojiFavorites(): string[] { return favs() }
export function getEmojiRecents(): string[] { return recents() }

/* ── Composant ── */

interface Props {
  onSelect: (emoji: string) => void
  selected?: string
}

export function EmojiPicker(props: Props) {
  const [open, setOpen] = createSignal(false)
  const [pos, setPos] = createSignal({ top: 0, left: 0 })
  let triggerRef: HTMLButtonElement | undefined

  const handleSelect = (emoji: string) => {
    props.onSelect(emoji)
    pushRecent(emoji)
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

  const isFav = (emoji: string) => favs().includes(emoji)

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
            <Show when={favs().length > 0}>
              <div class="emoji-picker-section">
                <div class="emoji-picker-label">Favoris</div>
                <div class="emoji-picker-grid">
                  <For each={favs()}>
                    {(emoji) => (
                      <div class="emoji-picker-item">
                        <button class="emoji-picker-btn is-fav" onClick={() => handleSelect(emoji)}>{emoji}</button>
                        <button class="emoji-picker-unfav" onClick={() => toggleFav(emoji)}>x</button>
                      </div>
                    )}
                  </For>
                </div>
              </div>
            </Show>

            {/* Récents */}
            <Show when={recents().length > 0}>
              <div class="emoji-picker-section">
                <div class="emoji-picker-label">Recents</div>
                <div class="emoji-picker-grid">
                  <For each={recents()}>
                    {(emoji) => (
                      <div class="emoji-picker-item">
                        <button class="emoji-picker-btn" onClick={() => handleSelect(emoji)}>{emoji}</button>
                        <Show when={!isFav(emoji)}>
                          <button class="emoji-picker-fav-btn" onClick={() => toggleFav(emoji)}>+</button>
                        </Show>
                      </div>
                    )}
                  </For>
                </div>
              </div>
            </Show>

            {/* Catégories */}
            <For each={EMOJI_CATEGORIES}>
              {(cat) => (
                <div class="emoji-picker-section">
                  <div class="emoji-picker-label">{cat.name}</div>
                  <div class="emoji-picker-grid">
                    <For each={cat.emojis}>
                      {(emoji) => (
                        <div class="emoji-picker-item">
                          <button class={`emoji-picker-btn ${isFav(emoji) ? 'is-fav' : ''}`} onClick={() => handleSelect(emoji)}>{emoji}</button>
                          <Show when={!isFav(emoji)}>
                            <button class="emoji-picker-fav-btn" onClick={() => toggleFav(emoji)}>+</button>
                          </Show>
                        </div>
                      )}
                    </For>
                  </div>
                </div>
              )}
            </For>

          </div>
        </Portal>
      </Show>
    </div>
  )
}
