import { createSignal } from 'solid-js'

const [toastMsg, setToastMsg] = createSignal('')
const [toastVisible, setToastVisible] = createSignal(false)
const [toastError, setToastError] = createSignal(false)

let toastTimer: ReturnType<typeof setTimeout> | undefined

export function showToast(msg: string, error = false) {
  clearTimeout(toastTimer)
  setToastMsg(msg)
  setToastError(error)
  setToastVisible(true)
  toastTimer = setTimeout(() => setToastVisible(false), 2200)
}

export function Toast() {
  return (
    <div class={`toast ${toastVisible() ? 'visible' : ''} ${toastError() ? 'error' : ''}`}>
      {toastMsg()}
    </div>
  )
}
