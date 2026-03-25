import { onMount } from 'solid-js'
import { Header } from './components/Header'
import { SidePanel } from './components/SidePanel'
import { ToolbarPanel } from './components/ToolbarPanel'
import { Editor } from './components/Editor'
import { CssTweaker } from './components/CssTweaker'
import { Toast } from './components/Toast'
import { TutorialOverlay } from './components/TutorialOverlay'
import { WelcomeModal } from './components/WelcomeModal'
import './styles/app.css'

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
      <CssTweaker />
      <Toast />
      <TutorialOverlay />
      <WelcomeModal />
    </>
  )
}
