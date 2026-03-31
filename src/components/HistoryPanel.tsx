import { For, Show, createSignal } from 'solid-js'
import { Portal } from 'solid-js/web'
import { historyEntries, jumpToEntry, type OpCategory } from '../stores/undo-redo'

const CATEGORY_ICONS: Record<OpCategory, string> = {
  typing: 'T',
  format: 'A',
  effect: '★',
  link: '🔗',
  insert: '+',
  style: '◆',
}

function timeAgo(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000)
  if (diff < 5) return 'maintenant'
  if (diff < 60) return `${diff}s`
  if (diff < 3600) return `${Math.floor(diff / 60)}min`
  return `${Math.floor(diff / 3600)}h`
}

export function HistoryPanel() {
  const [open, setOpen] = createSignal(false)
  const [pos, setPos] = createSignal({ top: 0, right: 0 })
  let triggerRef: HTMLButtonElement | undefined

  const toggle = () => {
    if (open()) { setOpen(false); return }
    if (triggerRef) {
      const rect = triggerRef.getBoundingClientRect()
      setPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right })
    }
    setOpen(true)
  }

  return (
    <>
      <button
        ref={triggerRef}
        class="btn-icon"
        title="Historique des opérations"
        onClick={toggle}
        style={{ "font-size": "14px" }}
      >⏱</button>

      <Show when={open()}>
        <Portal>
          <div class="history-backdrop" onClick={() => setOpen(false)} />
          <div class="history-panel" style={{ top: `${pos().top}px`, right: `${pos().right}px` }}>
            <div class="history-header">Historique</div>
            <div class="history-list">
              <For each={historyEntries()}>
                {(entry, i) => (
                  <button
                    class={`history-entry ${entry.isCurrent ? 'history-entry-current' : ''}`}
                    onClick={() => { jumpToEntry(i()); setOpen(false) }}
                    disabled={entry.isCurrent}
                  >
                    <span class="history-entry-icon">{entry.isCurrent ? '►' : CATEGORY_ICONS[entry.category]}</span>
                    <span class="history-entry-label">{entry.label}</span>
                    <Show when={!entry.isCurrent}>
                      <span class="history-entry-time">{timeAgo(entry.timestamp)}</span>
                    </Show>
                  </button>
                )}
              </For>
            </div>
          </div>
        </Portal>
      </Show>
    </>
  )
}
