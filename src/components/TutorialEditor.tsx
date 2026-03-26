import { Show, For, createSignal, createEffect, createMemo, onCleanup, untrack } from 'solid-js'
import { Portal } from 'solid-js/web'
import {
  TUTORIAL_STEPS, VALID_STEP_IDS, validateStep,
  computeAnchorPosition,
  BUBBLE_WIDTH, BUBBLE_HEIGHT, SPOT_PADDING, BUBBLE_GAP,
} from '../stores/tutorial'
import type { TutorialStep, StepValidation } from '../stores/tutorial'
import { isAdmin } from '../stores/admin'
import {
  adminData, saveAdminData,
  adminSetTutorialPosition, adminRemoveTutorialPosition,
  adminSetTutorialText, adminResetTutorialTexts,
  adminSetTutorialAction, adminResetTutorialActions,
  adminCleanOrphanPositions, adminSetTutorialPositions,
} from '../stores/admin-data'
import type { TutorialPosition, AnchorPosition, TutorialActionOverride } from '../stores/admin-data'
import { showToast } from './Toast'
import '../styles/tutorial.css'

/* ── Signal global pour ouvrir l'editeur depuis AdminPanel ── */
const [editorOpen, setEditorOpen] = createSignal(false)
export { editorOpen, setEditorOpen }

const ANCHOR_OPTIONS: AnchorPosition[] = ['top', 'bottom', 'left', 'right', 'bottom-right', 'bottom-left', 'top-left', 'top-right', 'center']
const ACTION_TYPES = ['none', 'select-text', 'click-element', 'dblclick-element'] as const

export function TutorialEditor() {
  const [selectedIdx, setSelectedIdx] = createSignal(0)
  const [previewMode, setPreviewMode] = createSignal(false) // false=edit leger, true=preview user
  const [testingAction, setTestingAction] = createSignal(false)
  const [testActionDone, setTestActionDone] = createSignal(false)

  // Drag state
  const [dragging, setDragging] = createSignal<'bubble' | 'spot' | null>(null)
  const [dragOffset, setDragOffset] = createSignal({ x: 0, y: 0 })
  const [dirty, setDirty] = createSignal(false)

  // Spot & bubble positions
  const [spotRect, setSpotRect] = createSignal({ top: 0, left: 0, width: 0, height: 0 })
  const [bubblePos, setBubblePos] = createSignal({ top: 0, left: 0 })

  // Edit fields
  const [editTitle, setEditTitle] = createSignal('')
  const [editDesc, setEditDesc] = createSignal('')
  const [editAnchor, setEditAnchor] = createSignal<AnchorPosition>('bottom')
  const [editOffsetX, setEditOffsetX] = createSignal(0)
  const [editOffsetY, setEditOffsetY] = createSignal(0)
  const [editSpotPad, setEditSpotPad] = createSignal(SPOT_PADDING)
  const [editActionType, setEditActionType] = createSignal<string>('none')
  const [editActionSelector, setEditActionSelector] = createSignal('')
  const [editActionHint, setEditActionHint] = createSignal('')
  const [editActionEnabled, setEditActionEnabled] = createSignal(true)

  const step = () => TUTORIAL_STEPS[selectedIdx()]
  const modules = createMemo(() => {
    const seen = new Map<string, TutorialStep[]>()
    for (const s of TUTORIAL_STEPS) {
      if (!seen.has(s.module)) seen.set(s.module, [])
      seen.get(s.module)!.push(s)
    }
    return [...seen.entries()]
  })

  // Validation de chaque step
  const validations = createMemo((): Record<string, StepValidation> => {
    const result: Record<string, StepValidation> = {}
    for (const s of TUTORIAL_STEPS) result[s.id] = validateStep(s)
    return result
  })

  // Nombre de positions orphelines
  const orphanCount = createMemo(() => {
    const positions = adminData().tutorialPositions
    return Object.keys(positions).filter(id => !VALID_STEP_IDS.has(id)).length
  })

  // Stats
  const posCount = () => Object.keys(adminData().tutorialPositions).length
  const textCount = () => Object.keys(adminData().tutorialTexts).length
  const actionCount = () => Object.keys(adminData().tutorialActions).length

  /* ── Auto-commit des edits dans adminData (en memoire) avant de changer de step ── */

  function commitCurrentEdits() {
    const s = untrack(step)
    if (!s) return

    // Sauver position en memoire
    adminSetTutorialPosition(s.id, {
      bubbleAnchor: editAnchor(),
      bubbleOffsetX: editOffsetX(),
      bubbleOffsetY: editOffsetY(),
      spotPadding: editSpotPad(),
    })

    // Sauver texte en memoire
    adminSetTutorialText(s.id, { title: editTitle(), description: editDesc() })

    // Sauver action en memoire
    const actionType = editActionType()
    if (actionType !== 'none') {
      adminSetTutorialAction(s.id, {
        type: actionType as TutorialActionOverride['type'],
        targetSelector: editActionSelector(),
        hint: editActionHint(),
        enabled: editActionEnabled(),
      })
    }
  }

  /* ── Charger les valeurs du step selectionne (untrack pour eviter le re-fire) ── */

  function loadStepValues() {
    const s = step()
    if (!s) return
    // untrack: on lit adminData sans creer de dependance reactive
    const data = untrack(adminData)
    const pos: TutorialPosition | undefined = data.tutorialPositions[s.id]
    const text = data.tutorialTexts[s.id]
    const action: TutorialActionOverride | undefined = data.tutorialActions[s.id]

    setEditTitle(text?.title ?? s.title)
    setEditDesc(text?.description ?? s.description)
    setEditAnchor(pos?.bubbleAnchor ?? s.position)
    setEditOffsetX(pos?.bubbleOffsetX ?? 0)
    setEditOffsetY(pos?.bubbleOffsetY ?? 0)
    setEditSpotPad(pos?.spotPadding ?? SPOT_PADDING)

    const codeAction = s.action
    setEditActionType(action?.type ?? codeAction?.type ?? 'none')
    setEditActionSelector(action?.targetSelector ?? codeAction?.targetSelector ?? s.targetSelector)
    setEditActionHint(action?.hint ?? codeAction?.hint ?? '')
    setEditActionEnabled(action?.enabled !== false)

    setDirty(false)
  }

  /* ── Mesurer position bulle et spotlight ── */

  function measure() {
    const s = step()
    if (!s) return

    const el = document.querySelector(s.targetSelector)
    const pad = editSpotPad()

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

    const anchor = editAnchor()
    const base = computeAnchorPosition(anchor, rect, BUBBLE_WIDTH, BUBBLE_HEIGHT, BUBBLE_GAP)
    setBubblePos({
      top: Math.round(base.top + editOffsetY()),
      left: Math.round(base.left + editOffsetX()),
    })

    if (rect.top < 0 || rect.bottom > window.innerHeight) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }

  // Charger + mesurer quand la step change
  let editorInitialized = false
  createEffect(() => {
    if (!editorOpen()) { editorInitialized = false; return }
    void selectedIdx() // track seulement selectedIdx et editorOpen
    // Auto-commit les edits de la step precedente avant de charger la nouvelle
    if (editorInitialized) commitCurrentEdits()
    editorInitialized = true
    loadStepValues()
    const t = setTimeout(measure, 100)
    onCleanup(() => clearTimeout(t))
  })

  // Resize
  createEffect(() => {
    if (!editorOpen()) return
    const handler = () => measure()
    window.addEventListener('resize', handler)
    onCleanup(() => window.removeEventListener('resize', handler))
  })

  /* ── Drag handlers ── */

  function onMouseDown(target: 'bubble' | 'spot', e: MouseEvent) {
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

  /* ── Actions ── */

  async function saveStep() {
    const s = step()
    if (!s) return
    commitCurrentEdits()
    const ok = await saveAdminData()
    setDirty(false)
    showToast(ok ? `Step "${s.id}" sauvegardee` : 'Erreur de sauvegarde', !ok)
  }

  async function resetStepPos() {
    const s = step()
    if (!s) return
    adminRemoveTutorialPosition(s.id)
    await saveAdminData()
    setDirty(false)
    loadStepValues()
    setTimeout(measure, 50)
    showToast('Position reinitalisee')
  }

  async function cleanOrphans() {
    adminCleanOrphanPositions(VALID_STEP_IDS)
    const ok = await saveAdminData()
    showToast(ok ? 'Positions orphelines nettoyees' : 'Erreur', !ok)
  }

  async function resetAllPositions() {
    adminSetTutorialPositions({})
    const ok = await saveAdminData()
    if (ok) { loadStepValues(); setTimeout(measure, 50) }
    showToast(ok ? 'Toutes les positions reinitalisees' : 'Erreur', !ok)
  }

  async function resetAllTexts() {
    adminResetTutorialTexts()
    const ok = await saveAdminData()
    if (ok) loadStepValues()
    showToast(ok ? 'Tous les textes reinitalises' : 'Erreur', !ok)
  }

  async function resetAllActions() {
    adminResetTutorialActions()
    const ok = await saveAdminData()
    if (ok) loadStepValues()
    showToast(ok ? 'Toutes les actions reinitalisees' : 'Erreur', !ok)
  }

  /* ── Test action ── */

  function startTestAction() {
    setTestingAction(true)
    setTestActionDone(false)
    const action = effectiveActionForTest()
    if (!action) { setTestActionDone(true); return }

    const selector = action.targetSelector
    if (!selector) { setTestActionDone(true); return }

    const handler = (e: Event) => {
      const target = document.querySelector(selector)
      if (!target) return
      if (action.type === 'select-text') {
        const sel = window.getSelection()
        if (sel && sel.toString().length > 0 && sel.anchorNode && target.contains(sel.anchorNode)) {
          setTestActionDone(true)
          cleanup()
        }
      } else if (target.contains(e.target as Node)) {
        setTestActionDone(true)
        cleanup()
      }
    }

    const eventType = action.type === 'select-text' ? 'selectionchange' : action.type === 'dblclick-element' ? 'dblclick' : 'click'
    document.addEventListener(eventType, handler, true)

    const cleanup = () => {
      document.removeEventListener(eventType, handler, true)
    }

    // Auto-stop apres 15s
    const timeout = setTimeout(() => { cleanup(); setTestingAction(false); showToast('Test expire (15s)') }, 15000)
    onCleanup(() => { cleanup(); clearTimeout(timeout) })
  }

  function effectiveActionForTest() {
    const s = step()
    if (!s) return null
    const actionType = editActionType()
    if (actionType === 'none') return null
    return {
      type: actionType,
      targetSelector: editActionSelector() || s.targetSelector,
      hint: editActionHint(),
    }
  }

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

  const overlayOpacity = () => previewMode() || testingAction() ? 0.5 : 0.15

  return (
    <Show when={editorOpen() && isAdmin()}>
      <Portal>
        {/* Overlay */}
        <div
          class="tuto-editor-overlay"
          style={{ "clip-path": clipPath(), background: `rgba(55,65,81,${overlayOpacity()})` }}
        />

        {/* Spotlight */}
        <div
          class="tuto-spotlight tuto-draggable"
          style={{
            top: `${r().top}px`, left: `${r().left}px`,
            width: `${r().width}px`, height: `${r().height}px`,
            "box-shadow": '0 0 0 3px var(--peach), 0 0 20px rgba(253,186,116,0.4)',
          }}
          onMouseDown={(e) => onMouseDown('spot', e)}
        />

        {/* Bulle draggable */}
        <div
          class="tuto-bubble tuto-draggable"
          style={{ top: `${bubblePos().top}px`, left: `${bubblePos().left}px`, "z-index": 9503 }}
          onMouseDown={(e) => {
            if ((e.target as HTMLElement).closest('button, input, textarea, select')) return
            onMouseDown('bubble', e)
          }}
        >
          <div class="tuto-module">{step()?.module}</div>
          <div class="tuto-title">{editTitle()}</div>
          <div class="tuto-desc">{editDesc()}</div>
          <Show when={editActionType() !== 'none' && editActionHint()}>
            <div class="tuto-action-hint">{editActionHint()}</div>
          </Show>
        </div>

        {/* ── Sidebar gauche ── */}
        <div class="tuto-editor-sidebar">
          <div class="tuto-editor-header">
            <span>Editeur Tutoriel</span>
            <button class="btn tuto-btn" onClick={() => setEditorOpen(false)}>Fermer</button>
          </div>

          <div class="tuto-editor-steps">
            <For each={modules()}>
              {([moduleName, steps]) => (
                <div class="tuto-editor-module-group">
                  <div class="tuto-editor-module-name">{moduleName}</div>
                  <For each={steps}>
                    {(s) => {
                      const idx = TUTORIAL_STEPS.indexOf(s)
                      const v = () => validations()[s.id]
                      const isActive = () => selectedIdx() === idx
                      const hasOverride = () => !!(adminData().tutorialPositions[s.id] || adminData().tutorialTexts[s.id])
                      return (
                        <div
                          class={`tuto-editor-step-item ${isActive() ? 'tuto-editor-step-active' : ''}`}
                          onClick={() => setSelectedIdx(idx)}
                        >
                          <span class={`tuto-editor-step-dot ${v()?.valid ? 'tuto-editor-step-valid' : 'tuto-editor-step-error'}`} />
                          <span class="tuto-editor-step-title">{s.title}</span>
                          <Show when={hasOverride()}>
                            <span class="tuto-editor-step-badge">*</span>
                          </Show>
                        </div>
                      )
                    }}
                  </For>
                </div>
              )}
            </For>
          </div>

          <div class="tuto-editor-sidebar-footer">
            <div class="tuto-editor-stats">
              {posCount()} pos · {textCount()} txt · {actionCount()} act
            </div>
            <Show when={orphanCount() > 0}>
              <button class="btn tuto-btn" style={{ background: 'var(--peach)' }} onClick={cleanOrphans}>
                Nettoyer {orphanCount()} orpheline{orphanCount() > 1 ? 's' : ''}
              </button>
            </Show>
            <button class="tuto-skip" onClick={resetAllPositions}>Reset positions</button>
            <button class="tuto-skip" onClick={resetAllTexts}>Reset textes</button>
            <button class="tuto-skip" onClick={resetAllActions}>Reset actions</button>
          </div>
        </div>

        {/* ── Barre de controles en bas ── */}
        <div class="tuto-editor-controls">
          {/* Texte */}
          <div class="tuto-editor-field-group">
            <label class="tuto-editor-label">Titre</label>
            <input
              class="naming-input tuto-editor-input"
              value={editTitle()}
              onInput={(e) => { setEditTitle(e.currentTarget.value); setDirty(true) }}
            />
          </div>
          <div class="tuto-editor-field-group tuto-editor-field-wide">
            <label class="tuto-editor-label">Description</label>
            <textarea
              class="naming-input tuto-editor-textarea"
              value={editDesc()}
              onInput={(e) => { setEditDesc(e.currentTarget.value); setDirty(true) }}
              rows={2}
            />
          </div>

          {/* Position */}
          <div class="tuto-editor-field-group">
            <label class="tuto-editor-label">Anchor</label>
            <select
              class="naming-input tuto-editor-select"
              value={editAnchor()}
              onChange={(e) => { setEditAnchor(e.currentTarget.value as AnchorPosition); setDirty(true); setTimeout(measure, 50) }}
            >
              <For each={ANCHOR_OPTIONS}>{(a) => <option value={a}>{a}</option>}</For>
            </select>
          </div>
          <div class="tuto-editor-field-group tuto-editor-field-narrow">
            <label class="tuto-editor-label">dX</label>
            <input
              type="number" class="naming-input tuto-editor-input"
              value={editOffsetX()}
              onInput={(e) => { setEditOffsetX(parseInt(e.currentTarget.value) || 0); setDirty(true); setTimeout(measure, 50) }}
            />
          </div>
          <div class="tuto-editor-field-group tuto-editor-field-narrow">
            <label class="tuto-editor-label">dY</label>
            <input
              type="number" class="naming-input tuto-editor-input"
              value={editOffsetY()}
              onInput={(e) => { setEditOffsetY(parseInt(e.currentTarget.value) || 0); setDirty(true); setTimeout(measure, 50) }}
            />
          </div>
          <div class="tuto-editor-field-group tuto-editor-field-narrow">
            <label class="tuto-editor-label">Pad</label>
            <input
              type="number" class="naming-input tuto-editor-input"
              value={editSpotPad()}
              onInput={(e) => { setEditSpotPad(parseInt(e.currentTarget.value) || SPOT_PADDING); setDirty(true); setTimeout(measure, 50) }}
            />
          </div>

          {/* Action */}
          <div class="tuto-editor-field-group">
            <label class="tuto-editor-label">Action</label>
            <select
              class="naming-input tuto-editor-select"
              value={editActionType()}
              onChange={(e) => { setEditActionType(e.currentTarget.value); setDirty(true) }}
            >
              <For each={ACTION_TYPES}>{(t) => <option value={t}>{t}</option>}</For>
            </select>
          </div>
          <Show when={editActionType() !== 'none'}>
            <div class="tuto-editor-field-group">
              <label class="tuto-editor-label">Selecteur</label>
              <input
                class="naming-input tuto-editor-input"
                value={editActionSelector()}
                onInput={(e) => { setEditActionSelector(e.currentTarget.value); setDirty(true) }}
                placeholder={step()?.targetSelector}
              />
            </div>
            <div class="tuto-editor-field-group">
              <label class="tuto-editor-label">Hint</label>
              <input
                class="naming-input tuto-editor-input"
                value={editActionHint()}
                onInput={(e) => { setEditActionHint(e.currentTarget.value); setDirty(true) }}
                placeholder="Texte d'aide"
              />
            </div>
            <div class="tuto-editor-field-group tuto-editor-field-narrow">
              <label class="tuto-editor-label">Actif</label>
              <input
                type="checkbox"
                checked={editActionEnabled()}
                onChange={(e) => { setEditActionEnabled(e.currentTarget.checked); setDirty(true) }}
              />
            </div>
          </Show>

          {/* Boutons */}
          <div class="tuto-editor-buttons">
            <button class="btn btn-lavender tuto-btn" onClick={saveStep}>Sauver</button>
            <button class="btn tuto-btn" onClick={resetStepPos}>Reset pos</button>
            <button
              class={`btn tuto-btn ${previewMode() ? 'btn-active' : ''}`}
              style={{ background: previewMode() ? 'var(--peach)' : undefined }}
              onClick={() => setPreviewMode(!previewMode())}
            >
              {previewMode() ? 'Mode edit' : 'Preview user'}
            </button>
            <Show when={editActionType() !== 'none'}>
              <button
                class="btn tuto-btn"
                style={{ background: testingAction() ? 'var(--mint)' : 'var(--peach)' }}
                onClick={() => {
                  if (testingAction()) { setTestingAction(false) }
                  else startTestAction()
                }}
              >
                {testingAction() ? (testActionDone() ? 'OK !' : 'En test...') : 'Tester action'}
              </button>
            </Show>
          </div>
        </div>
      </Portal>
    </Show>
  )
}
