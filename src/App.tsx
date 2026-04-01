import { createEffect, onCleanup, onMount } from 'solid-js'
import { Header } from './components/Header'
import { loadAdminData } from './stores/admin-data'
import { toggleAdmin, activateAdmin } from './stores/admin'
import { SidePanel } from './components/SidePanel'
import { ToolbarPanel } from './components/ToolbarPanel'
import { Editor } from './components/Editor'
import { Toast, showToast } from './components/Toast'
import { AdminPanel } from './components/AdminPanel'
import './styles/app.css'

// Charger les donnees admin au demarrage
loadAdminData()

const BTN_SELECTORS = '.btn,.btn-icon,.btn-compact,.side-tag,.fav-pill,.toggle-btn,.size-dropdown-item,.size-fav-value,.size-fav-remove,.fav-add,.palette-btn,.swatch-remove,.link-indicator,.link-indicator-btn'

export default function App() {
  // Listener global pour animer les boutons au clic malgre les preventDefault() sur les parents
  // (preventDefault sur mousedown empeche le pseudo-state :active du navigateur)
  onMount(() => {
    let pressed: Element | null = null

    const onDown = (e: PointerEvent) => {
      const btn = (e.target as Element).closest(BTN_SELECTORS)
      if (!btn) return
      pressed = btn
      btn.classList.add('btn-pressed')
    }

    const onUp = () => {
      if (pressed) { pressed.classList.remove('btn-pressed'); pressed = null }
    }

    document.addEventListener('pointerdown', onDown)
    document.addEventListener('pointerup', onUp)
    document.addEventListener('pointercancel', onUp)

    onCleanup(() => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('pointerup', onUp)
      document.removeEventListener('pointercancel', onUp)
    })
  })

  // Ctrl+Shift+A pour toggle admin
  createEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'A') {
        e.preventDefault()
        const now = toggleAdmin()
        showToast(now ? 'Mode admin active' : 'Mode admin desactive')
      }
    }
    document.addEventListener('keydown', handler)
    onCleanup(() => document.removeEventListener('keydown', handler))
  })

  // ?admin=1 dans l'URL active le mode admin
  onMount(() => {
    if (new URL(location.href).searchParams.has('admin')) activateAdmin()
  })

  return (
    <>
      <div class="shape shape-1" />
      <div class="shape shape-2" />
      <div class="shape shape-3" />
      <div class="shape shape-4" />
      <div class="shape shape-5" />

      <Header />
      <div class="main-layout">
        <SidePanel side="left" />
        <div class="center-area">
          <ToolbarPanel />
          <Editor />
        </div>
        <SidePanel side="right" />
      </div>
      <Toast />
      <AdminPanel />
    </>
  )
}
