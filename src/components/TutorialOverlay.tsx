import { Show, createEffect, createSignal, createMemo, onCleanup } from 'solid-js'
import { Portal } from 'solid-js/web'
import {
  tutorialActive, currentStep, TUTORIAL_STEPS,
  nextStep, prevStep, skipTutorial,
  computeAnchorPosition,
  BUBBLE_WIDTH, BUBBLE_HEIGHT, SPOT_PADDING, CENTER_BIAS, VIEWPORT_MARGIN, BUBBLE_GAP,
} from '../stores/tutorial'
import type { TutorialAction } from '../stores/tutorial'
import { adminData } from '../stores/admin-data'
import type { TutorialPosition, TutorialActionOverride } from '../stores/admin-data'
import '../styles/tutorial.css'

export function TutorialOverlay() {
  const [spotRect, setSpotRect] = createSignal({ top: 0, left: 0, width: 0, height: 0 })
  const [bubblePos, setBubblePos] = createSignal({ top: 0, left: 0 })
  const [actionCompleted, setActionCompleted] = createSignal(false)

  const step = () => TUTORIAL_STEPS[currentStep()]
  const total = TUTORIAL_STEPS.length
  const progress = () => `${currentStep() + 1} / ${total}`
  const module = () => step()?.module ?? ''

  // Textes avec overrides admin
  const stepTitle = () => {
    const s = step(); if (!s) return ''
    return adminData().tutorialTexts?.[s.id]?.title ?? s.title
  }
  const stepDesc = () => {
    const s = step(); if (!s) return ''
    return adminData().tutorialTexts?.[s.id]?.description ?? s.description
  }

  // Action effective (code + override admin)
  const effectiveAction = createMemo((): (TutorialAction & { enabled: boolean }) | null => {
    const s = step()
    if (!s) return null
    const codeAction = s.action
    const override: TutorialActionOverride | undefined = adminData().tutorialActions?.[s.id]

    // Si pas d'action dans le code et pas d'override, pas d'action
    if (!codeAction && !override) return null
    // Si override dit explicitement 'none' ou enabled=false
    if (override?.type === 'none' || override?.enabled === false) return null

    const type = override?.type ?? codeAction?.type
    if (!type || type === 'none') return null

    return {
      type,
      targetSelector: override?.targetSelector ?? codeAction?.targetSelector ?? s.targetSelector,
      hint: override?.hint ?? codeAction?.hint,
      enabled: override?.enabled !== false,
    }
  })

  // La step necessite-t-elle une action ?
  const needsAction = () => !!effectiveAction()
  const canAdvance = () => !needsAction() || actionCompleted()

  /* ── Positionnement ── */

  function measure() {
    const s = step()
    if (!s) return

    const saved: TutorialPosition | undefined = adminData().tutorialPositions?.[s.id]

    // Spotlight : toujours calcule depuis le DOM
    const spotSelector = saved?.spotSelector ?? s.targetSelector
    const el = document.querySelector(spotSelector)
    const pad = saved?.spotPadding ?? SPOT_PADDING

    if (!el) {
      const vw = window.innerWidth, vh = window.innerHeight
      setSpotRect({ top: 0, left: 0, width: vw, height: vh })
      setBubblePos({ top: vh / 2 - BUBBLE_HEIGHT / 2, left: vw / 2 - BUBBLE_WIDTH / 2 })
      return
    }

    const rect = el.getBoundingClientRect()
    setSpotRect({
      top: rect.top - pad,
      left: rect.left - pad,
      width: rect.width + pad * 2,
      height: rect.height + pad * 2,
    })

    // Bulle : anchor-based
    const anchor = saved?.bubbleAnchor ?? s.position
    const base = computeAnchorPosition(anchor, rect, BUBBLE_WIDTH, BUBBLE_HEIGHT, BUBBLE_GAP)
    let t = base.top + (saved?.bubbleOffsetY ?? 0)
    let l = base.left + (saved?.bubbleOffsetX ?? 0)

    // Biais vers le centre
    const vw = window.innerWidth, vh = window.innerHeight
    const cx = vw / 2, cy = vh / 2
    t = t + (cy - t) * CENTER_BIAS
    l = l + (cx - l) * CENTER_BIAS

    // Clamper dans le viewport
    t = Math.max(VIEWPORT_MARGIN, Math.min(t, vh - BUBBLE_HEIGHT - VIEWPORT_MARGIN))
    l = Math.max(VIEWPORT_MARGIN, Math.min(l, vw - BUBBLE_WIDTH - VIEWPORT_MARGIN))

    setBubblePos({ top: Math.round(t), left: Math.round(l) })

    if (rect.top < 0 || rect.bottom > vh) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }

  // Re-mesurer quand step change
  createEffect(() => {
    if (!tutorialActive()) return
    void currentStep()
    setActionCompleted(false)
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

  /* ── Validation d'actions interactives ── */

  createEffect(() => {
    if (!tutorialActive()) return
    const action = effectiveAction()
    if (!action) { setActionCompleted(true); return }

    const selector = action.targetSelector
    if (!selector) { setActionCompleted(true); return }

    if (action.type === 'select-text') {
      const handler = () => {
        const sel = window.getSelection()
        if (!sel || sel.toString().length === 0) return
        // Verifier que la selection est dans le target
        const target = document.querySelector(selector)
        if (target && sel.anchorNode && target.contains(sel.anchorNode)) {
          setActionCompleted(true)
        }
      }
      document.addEventListener('selectionchange', handler)
      onCleanup(() => document.removeEventListener('selectionchange', handler))
    } else if (action.type === 'click-element') {
      const handler = (e: Event) => {
        const target = document.querySelector(selector)
        if (target && target.contains(e.target as Node)) {
          setActionCompleted(true)
        }
      }
      // Ecouter sur document en capture pour ne pas bloquer le click
      document.addEventListener('click', handler, true)
      onCleanup(() => document.removeEventListener('click', handler, true))
    } else if (action.type === 'dblclick-element') {
      const handler = (e: Event) => {
        const target = document.querySelector(selector)
        if (target && target.contains(e.target as Node)) {
          setActionCompleted(true)
        }
      }
      document.addEventListener('dblclick', handler, true)
      onCleanup(() => document.removeEventListener('dblclick', handler, true))
    }
  })

  /* ── Rendu ── */

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
        <div
          class="tuto-spotlight"
          style={{
            top: `${r().top}px`,
            left: `${r().left}px`,
            width: `${r().width}px`,
            height: `${r().height}px`,
          }}
        />
        <div
          class="tuto-bubble"
          style={{ top: `${bubblePos().top}px`, left: `${bubblePos().left}px` }}
        >
          <div class="tuto-module">{module()}</div>
          <div class="tuto-title">{stepTitle()}</div>
          <div class="tuto-desc">{stepDesc()}</div>
          <Show when={needsAction() && !actionCompleted()}>
            <div class="tuto-action-hint">
              {effectiveAction()?.hint ?? 'Effectuez l\'action pour continuer'}
            </div>
          </Show>
          <div class="tuto-footer">
            <span class="tuto-progress">{progress()}</span>
            <div class="tuto-actions">
              <Show when={currentStep() > 0}>
                <button class="btn tuto-btn" onClick={prevStep}>&#9666; Precedent</button>
              </Show>
              <button
                class={`btn btn-lavender tuto-btn ${!canAdvance() ? 'tuto-btn-disabled' : ''}`}
                onClick={() => canAdvance() && nextStep()}
                disabled={!canAdvance()}
              >
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
