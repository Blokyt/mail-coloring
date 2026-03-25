import { Header } from './components/Header'
import { loadAdminData } from './stores/admin-data'
import { isAdmin, toggleAdmin } from './stores/admin'
import { SidePanel } from './components/SidePanel'
import { ToolbarPanel } from './components/ToolbarPanel'
import { Editor } from './components/Editor'
import { Toast } from './components/Toast'
import { TutorialOverlay } from './components/TutorialOverlay'
import { WelcomeModal } from './components/WelcomeModal'
import { AdminPanel } from './components/AdminPanel'
import './styles/app.css'

// Charger les donnees admin au demarrage
loadAdminData()

export default function App() {
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
      <TutorialOverlay />
      <WelcomeModal />
      <AdminPanel />

      {/* Slider admin fixe en bas a gauche */}
      <div class="admin-slider-wrap" onClick={toggleAdmin}>
        <div class={`admin-slider-track ${isAdmin() ? 'active' : ''}`}>
          <div class="admin-slider-thumb" />
        </div>
        <span class="admin-slider-label">{isAdmin() ? 'Admin' : 'User'}</span>
      </div>
    </>
  )
}
