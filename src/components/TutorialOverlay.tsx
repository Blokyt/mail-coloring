import { Show, createEffect, createSignal, onCleanup } from 'solid-js'
import { Portal } from 'solid-js/web'
import {
  tutorialActive, currentStep, TUTORIAL_STEPS,
  nextStep, prevStep, skipTutorial,
} from '../stores/tutorial'
import '../styles/tutorial.css'

export function TutorialOverlay() {
  const [spotRect, setSpotRect] = createSignal({ top: 0, left: 0, width: 0, height: 0 })
  const [bubbleStyle, setBubbleStyle] = createSignal<Record<string, string>>({})

  const step = () => TUTORIAL_STEPS[currentStep()]
  const total = TUTORIAL_STEPS.length
  const progress = () => `${currentStep() + 1} / ${total}`
  const module = () => step()?.module ?? ''

  function measure() {
    const s = step()
    if (!s) return
    const el = document.querySelector(s.targetSelector)
    if (!el) {
      // Element absent (ex: modal fermee) — centrer la bulle
      setSpotRect({ top: 0, left: 0, width: window.innerWidth, height: window.innerHeight })
      setBubbleStyle({ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' })
      return
    }

    const rect = el.getBoundingClientRect()
    const pad = 8
    setSpotRect({
      top: rect.top - pad,
      left: rect.left - pad,
      width: rect.width + pad * 2,
      height: rect.height + pad * 2,
    })

    // Positionner la bulle — toujours en top/left avec clamping viewport
    const pos = s.position
    const gap = 16
    const bw = 340 // largeur de la bulle (CSS width)
    const bh = 200 // hauteur estimee de la bulle
    const margin = 16
    const vw = window.innerWidth
    const vh = window.innerHeight

    let t = 0, l = 0

    if (pos === 'bottom') {
      t = rect.bottom + gap
      l = rect.left
    } else if (pos === 'top') {
      t = rect.top - gap - bh
      l = rect.left
    } else if (pos === 'right') {
      t = rect.top
      l = rect.right + gap
    } else if (pos === 'left') {
      t = rect.top
      l = rect.left - gap - bw
    }

    // Clamper dans le viewport
    t = Math.max(margin, Math.min(t, vh - bh - margin))
    l = Math.max(margin, Math.min(l, vw - bw - margin))

    setBubbleStyle({ top: `${t}px`, left: `${l}px` })

    // Scroll si hors vue
    if (rect.top < 0 || rect.bottom > window.innerHeight) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }

  createEffect(() => {
    if (!tutorialActive()) return
    // Re-mesurer a chaque changement d'etape
    void currentStep()
    // Petit delai pour laisser le DOM se stabiliser (ex: ouverture de modal)
    const t = setTimeout(measure, 100)
    onCleanup(() => clearTimeout(t))
  })

  // Re-mesurer au resize
  createEffect(() => {
    if (!tutorialActive()) return
    const handler = () => measure()
    window.addEventListener('resize', handler)
    onCleanup(() => window.removeEventListener('resize', handler))
  })

  const r = () => spotRect()
  const clipPath = () => {
    const s = r()
    return `polygon(
      0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 0%,
      ${s.left}px ${s.top}px,
      ${s.left}px ${s.top + s.height}px,
      ${s.left + s.width}px ${s.top + s.height}px,
      ${s.left + s.width}px ${s.top}px,
      ${s.left}px ${s.top}px
    )`
  }

  return (
    <Show when={tutorialActive()}>
      <Portal>
        <div class="tuto-overlay" style={{ "clip-path": clipPath() }} />
        <div class="tuto-spotlight" style={{
          top: `${r().top}px`,
          left: `${r().left}px`,
          width: `${r().width}px`,
          height: `${r().height}px`,
        }} />
        <div class="tuto-bubble" style={bubbleStyle()}>
          <div class="tuto-module">{module()}</div>
          <div class="tuto-title">{step()?.title}</div>
          <div class="tuto-desc">{step()?.description}</div>
          <div class="tuto-footer">
            <span class="tuto-progress">{progress()}</span>
            <div class="tuto-actions">
              <Show when={currentStep() > 0}>
                <button class="btn tuto-btn" onClick={prevStep}>&#9666; Precedent</button>
              </Show>
              <button class="btn btn-lavender tuto-btn" onClick={nextStep}>
                {currentStep() < total - 1 ? 'Suivant \u25B8' : 'Terminer'}
              </button>
              <button class="tuto-skip" onClick={skipTutorial}>Passer</button>
            </div>
          </div>
        </div>
      </Portal>
    </Show>
  )
}
