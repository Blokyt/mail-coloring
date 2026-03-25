import { Show, onCleanup, createEffect, type JSX } from 'solid-js'
import { Portal } from 'solid-js/web'

interface Props {
  open: boolean
  onClose: () => void
  title?: string
  description?: string
  size?: 'sm' | 'md' | 'lg' | 'full'
  zIndex?: number
  children: JSX.Element
}

const SIZE_MAP = { sm: '420px', md: '640px', lg: '920px', full: '94vw' }

export function Modal(props: Props) {
  const z = () => props.zIndex ?? 200

  createEffect(() => {
    if (!props.open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); props.onClose() }
    }
    document.addEventListener('keydown', handler, true)
    onCleanup(() => document.removeEventListener('keydown', handler, true))
  })

  return (
    <Show when={props.open}>
      <Portal>
        <div class="modal-backdrop" style={{ "z-index": z() }} onClick={props.onClose} />
        <div
          class={`modal-container modal-${props.size ?? 'lg'}`}
          style={{ "z-index": z() + 1, "max-width": SIZE_MAP[props.size ?? 'lg'] }}
        >
          <Show when={props.title}>
            <div class="modal-header">
              <div>
                <h2 class="modal-title">{props.title}</h2>
                <Show when={props.description}>
                  <p class="modal-desc">{props.description}</p>
                </Show>
              </div>
              <button class="modal-close" onClick={props.onClose} aria-label="Fermer" />
            </div>
          </Show>
          {props.children}
        </div>
      </Portal>
    </Show>
  )
}
