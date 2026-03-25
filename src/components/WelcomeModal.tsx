import { createSignal, onMount, Show } from 'solid-js'
import { Modal } from './Modal'
import { shouldShowWelcome, startTutorial } from '../stores/tutorial'

export function WelcomeModal() {
  const [open, setOpen] = createSignal(false)

  onMount(() => {
    if (shouldShowWelcome()) {
      // Petit delai pour laisser l'app se charger
      setTimeout(() => setOpen(true), 600)
    }
  })

  const handleStart = () => {
    setOpen(false)
    startTutorial()
  }

  const handleSkip = () => {
    setOpen(false)
    localStorage.setItem('artlequin_tutorial_done', 'true')
  }

  return (
    <Modal open={open()} onClose={handleSkip} size="sm" zIndex={500}>
      <div class="welcome-content">
        <div class="welcome-icon">&#127912;</div>
        <h2 class="welcome-title">Bienvenue dans Mail Colorer !</h2>
        <p class="welcome-text">
          Creez des emails colores et expressifs, directement compatibles Outlook.
          Decouvrez toutes les possibilites avec un petit tutoriel ?
        </p>
        <div class="welcome-actions">
          <button class="btn btn-lavender" onClick={handleStart}>Commencer le tutoriel</button>
          <button class="btn" onClick={handleSkip}>Je connais deja</button>
        </div>
      </div>
    </Modal>
  )
}
