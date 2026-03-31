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

export default function App() {
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
