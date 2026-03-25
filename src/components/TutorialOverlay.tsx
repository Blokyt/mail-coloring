import { Show, createEffect, createSignal, onCleanup } from 'solid-js'
import { Portal } from 'solid-js/web'
import {
  tutorialActive, currentStep, TUTORIAL_STEPS,
  nextStep, prevStep, skipTutorial,
} from '../stores/tutorial'
import { isAdmin } from '../stores/admin'
import { adminData, adminSetTutorialPositions, adminSetTutorialText, saveAdminData } from '../stores/admin-data'
import '../styles/tutorial.css'

/* ── Positions sauvegardees (admin-data.json) ── */

type SavedPos = { bubbleTop: number; bubbleLeft: number; spotTop: number; spotLeft: number; spotW: number; spotH: number }

function loadPositions(): Record<string, SavedPos> {
  return (adminData().tutorialPositions ?? {}) as Record<string, SavedPos>
}

export function TutorialOverlay() {
  const [spotRect, setSpotRect] = createSignal({ top: 0, left: 0, width: 0, height: 0 })
  const [bubblePos, setBubblePos] = createSignal({ top: 0, left: 0 })
  const [dragging, setDragging] = createSignal<'bubble' | 'spot' | null>(null)
  const [dragOffset, setDragOffset] = createSignal({ x: 0, y: 0 })
  const [dirty, setDirty] = createSignal(false)

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
  const [editingText, setEditingText] = createSignal(false)
  const [editTitle, setEditTitle] = createSignal('')
  const [editDesc, setEditDesc] = createSignal('')

  function measure() {
    const s = step()
    if (!s) return

    // Verifier si on a une position sauvegardee
    const saved = loadPositions()[s.id]
    if (saved) {
      setSpotRect({ top: saved.spotTop, left: saved.spotLeft, width: saved.spotW, height: saved.spotH })
      setBubblePos({ top: saved.bubbleTop, left: saved.bubbleLeft })
      setDirty(false)
      return
    }

    const el = document.querySelector(s.targetSelector)
    if (!el) {
      const vw = window.innerWidth, vh = window.innerHeight
      setSpotRect({ top: 0, left: 0, width: vw, height: vh })
      setBubblePos({ top: vh / 2 - 100, left: vw / 2 - 170 })
      setDirty(false)
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

    // Positionner la bulle — naturellement proche de la cible, biais vers le centre
    const pos = s.position
    const gap = 16
    const bw = 340
    const bh = 200
    const margin = 16
    const vw = window.innerWidth
    const vh = window.innerHeight
    const cx = vw / 2, cy = vh / 2 // centre viewport

    let t = 0, l = 0

    if (pos === 'bottom') {
      t = rect.bottom + gap
      l = rect.left + rect.width / 2 - bw / 2
    } else if (pos === 'top') {
      t = rect.top - gap - bh
      l = rect.left + rect.width / 2 - bw / 2
    } else if (pos === 'right') {
      t = rect.top + rect.height / 2 - bh / 2
      l = rect.right + gap
    } else if (pos === 'left') {
      t = rect.top + rect.height / 2 - bh / 2
      l = rect.left - gap - bw
    } else if (pos === 'bottom-right') {
      // Grands elements : bulle en bas a droite mais pas collee au bord
      t = vh - bh - 60
      l = vw - bw - 60
    }

    // Biais vers le centre (30%) pour un rendu plus naturel
    t = t + (cy - t) * 0.15
    l = l + (cx - l) * 0.15

    // Clamper dans le viewport
    t = Math.max(margin, Math.min(t, vh - bh - margin))
    l = Math.max(margin, Math.min(l, vw - bw - margin))

    setBubblePos({ top: Math.round(t), left: Math.round(l) })
    setDirty(false)

    if (rect.top < 0 || rect.bottom > vh) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }

  createEffect(() => {
    if (!tutorialActive()) return
    void currentStep()
    const t = setTimeout(measure, 100)
    onCleanup(() => clearTimeout(t))
  })

  createEffect(() => {
    if (!tutorialActive()) return
    const handler = () => measure()
    window.addEventListener('resize', handler)
    onCleanup(() => window.removeEventListener('resize', handler))
  })

  // ── Drag handlers ──
  function onMouseDown(target: 'bubble' | 'spot', e: MouseEvent) {
    if (!isAdmin()) return
    e.preventDefault()
    e.stopPropagation()
    setDragging(target)
    if (target === 'bubble') {
      setDragOffset({ x: e.clientX - bubblePos().left, y: e.clientY - bubblePos().top })
    } else {
      setDragOffset({ x: e.clientX - spotRect().left, y: e.clientY - spotRect().top })
    }
  }

  createEffect(() => {
    if (!dragging()) return

    const onMove = (e: MouseEvent) => {
      const d = dragging()
      if (!d) return
      setDirty(true)
      if (d === 'bubble') {
        setBubblePos({ top: e.clientY - dragOffset().y, left: e.clientX - dragOffset().x })
      } else {
        const sr = spotRect()
        setSpotRect({ ...sr, top: e.clientY - dragOffset().y, left: e.clientX - dragOffset().x })
      }
    }

    const onUp = () => setDragging(null)

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    onCleanup(() => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    })
  })

  async function saveCurrentPos() {
    const s = step()
    if (!s) return
    const positions = { ...loadPositions() }
    const sr = spotRect()
    const bp = bubblePos()
    positions[s.id] = {
      bubbleTop: bp.top, bubbleLeft: bp.left,
      spotTop: sr.top, spotLeft: sr.left, spotW: sr.width, spotH: sr.height,
    }
    adminSetTutorialPositions(positions)
    await saveAdminData()
    setDirty(false)
  }

  async function resetCurrentPos() {
    const s = step()
    if (!s) return
    const positions = { ...loadPositions() }
    delete positions[s.id]
    adminSetTutorialPositions(positions)
    await saveAdminData()
    measure()
  }

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
          class={`tuto-spotlight ${isAdmin() ? 'tuto-draggable' : ''}`}
          style={{
            top: `${r().top}px`,
            left: `${r().left}px`,
            width: `${r().width}px`,
            height: `${r().height}px`,
          }}
          onMouseDown={(e) => onMouseDown('spot', e)}
        />
        <div
          class={`tuto-bubble ${isAdmin() ? 'tuto-draggable' : ''}`}
          style={{ top: `${bubblePos().top}px`, left: `${bubblePos().left}px` }}
          onMouseDown={(e) => {
            // Ne pas drag si on clique sur un bouton
            if ((e.target as HTMLElement).closest('button')) return
            onMouseDown('bubble', e)
          }}
        >
          <div class="tuto-module">{module()}</div>
          <Show when={!editingText()}>
            <div class="tuto-title">{stepTitle()}</div>
            <div class="tuto-desc">{stepDesc()}</div>
          </Show>
          <Show when={editingText()}>
            <input class="naming-input tuto-edit-input" value={editTitle()} onInput={(e) => setEditTitle(e.currentTarget.value)} placeholder="Titre" />
            <textarea class="naming-input tuto-edit-textarea" value={editDesc()} onInput={(e) => setEditDesc(e.currentTarget.value)} placeholder="Description" rows={3} />
            <div style={{ display: 'flex', gap: '6px', "margin-bottom": '8px' }}>
              <button class="btn btn-lavender tuto-btn" onClick={async () => {
                const s = step(); if (!s) return
                adminSetTutorialText(s.id, { title: editTitle(), description: editDesc() })
                await saveAdminData()
                setEditingText(false)
                setDirty(true)
              }}>OK</button>
              <button class="btn tuto-btn" onClick={() => setEditingText(false)}>Annuler</button>
            </div>
          </Show>
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
          <Show when={isAdmin()}>
            <div class="tuto-admin-bar">
              <span class="tuto-admin-hint">Drag bulle/spot</span>
              <button class="btn tuto-btn" onClick={() => { setEditTitle(stepTitle()); setEditDesc(stepDesc()); setEditingText(true) }}>Editer texte</button>
              <Show when={dirty()}>
                <button class="btn tuto-btn" onClick={saveCurrentPos}>Sauver pos</button>
              </Show>
              <button class="tuto-skip" onClick={resetCurrentPos}>Reset</button>
            </div>
          </Show>
        </div>
      </Portal>
    </Show>
  )
}
