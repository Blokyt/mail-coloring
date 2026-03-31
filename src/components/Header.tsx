import { createSignal, Show } from 'solid-js'
import { getEditorEl, getAllEditorHtml, getAllEditorText, setActiveWordLink } from './Editor'
import { activeWord } from '../stores/word-inspect'
import { performUndo, performRedo, canUndo, canRedo, undoLabel, redoLabel } from '../stores/undo-redo'
import { showToast } from './Toast'
import { HistoryPanel } from './HistoryPanel'

/* ══════════════════════════════════════════
   Buffer de style — etat independant du curseur.
   Definit comment le prochain caractere sera ecrit.
   Mis a jour UNIQUEMENT par :
   - les actions utilisateur (toolbar, hotbar)
   - le clic molette (eyedropper)
   ══════════════════════════════════════════ */

export interface StyleBuffer {
  fontFamily: string
  fontSize: number
  foreColor: string
  hiliteColor: string
  bold: boolean
  italic: boolean
  underline: boolean
  strikeThrough: boolean
}

const DEFAULT_BUFFER: StyleBuffer = {
  fontFamily: 'Arial',
  fontSize: 18,
  foreColor: '#374151',
  hiliteColor: '',
  bold: false,
  italic: false,
  underline: false,
  strikeThrough: false,
}

// Signal global pour que la toolbar puisse mettre a jour le buffer
const [styleBuffer, setStyleBuffer] = createSignal<StyleBuffer>({ ...DEFAULT_BUFFER })

// Preview temporaire (hover dropdown, input en cours) — override la status bar sans modifier le buffer
const [previewOverride, setPreviewOverride] = createSignal<Partial<StyleBuffer> | null>(null)

/** Met a jour un champ du buffer */
export function updateBuffer(partial: Partial<StyleBuffer>) {
  setStyleBuffer(prev => ({ ...prev, ...partial }))
}

/** Active/désactive un preview temporaire dans la status bar */
export function setPreview(partial: Partial<StyleBuffer> | null) {
  setPreviewOverride(partial)
}

/** Lit le buffer courant */
export function getBuffer(): StyleBuffer {
  return styleBuffer()
}

/** Convertit une couleur rgb(r,g,b) en hex */
function rgbToHex(rgb: string): string {
  if (!rgb || rgb === 'transparent') return ''
  if (rgb.startsWith('#')) return rgb
  const match = rgb.match(/(\d+)/g)
  if (!match || match.length < 3) return rgb
  const [r, g, b] = match.map(Number)
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')
}

/** Lit le style complet d'un element DOM et le copie dans le buffer (eyedropper) */
export function pickStyleFromElement(el: Element) {
  const cs = window.getComputedStyle(el)
  setStyleBuffer({
    fontFamily: cs.fontFamily.replace(/"/g, ''),
    fontSize: Math.round(parseFloat(cs.fontSize)),
    foreColor: cs.color,
    hiliteColor: cs.backgroundColor === 'rgba(0, 0, 0, 0)' || cs.backgroundColor === 'transparent' ? '' : cs.backgroundColor,
    bold: parseInt(cs.fontWeight) >= 700,
    italic: cs.fontStyle === 'italic',
    underline: cs.textDecorationLine.includes('underline'),
    strikeThrough: cs.textDecorationLine.includes('line-through'),
  })
  showToast('Style copie')
}

/** Indicateur de lien — se "fige" au clic pour ne pas disparaître pendant l'édition */
function LinkIndicator() {
  const [frozen, setFrozen] = createSignal<{ link: string; word: ReturnType<typeof activeWord> } | null>(null)
  const [val, setVal] = createSignal('')
  let ref: HTMLInputElement | undefined

  const editing = () => frozen() !== null
  const displayLink = () => frozen()?.link || activeWord()?.link || null

  const startEdit = () => {
    const w = activeWord()
    if (!w?.link) return
    setFrozen({ link: w.link, word: w })
    setVal(w.link)
    requestAnimationFrame(() => { ref?.focus(); ref?.select() })
  }

  const confirm = () => {
    const url = val().trim()
    setActiveWordLink(url && url !== 'https://' ? url : null)
    setFrozen(null)
  }

  const cancel = () => setFrozen(null)

  const remove = () => {
    setActiveWordLink(null)
    setFrozen(null)
  }

  return (
    <Show when={editing() || activeWord()?.link}>
      <Show when={editing()} fallback={
        <button
          class="link-indicator"
          onMouseDown={(e) => e.preventDefault()}
          onClick={startEdit}
          title={activeWord()?.link || ''}
        >
          🔗 {(activeWord()?.link || '').replace(/^https?:\/\//, '').slice(0, 30)}
        </button>
      }>
        <div class="link-indicator-edit" onMouseDown={(e) => e.preventDefault()}>
          <input
            ref={ref}
            class="link-indicator-input"
            type="url"
            value={val()}
            onInput={(e) => setVal(e.currentTarget.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') confirm(); if (e.key === 'Escape') cancel() }}
            placeholder="https://..."
          />
          <button class="btn btn-lavender link-indicator-btn" onClick={confirm}>OK</button>
          <button class="btn link-indicator-btn link-indicator-del" onClick={remove}>Retirer</button>
        </div>
      </Show>
    </Show>
  )
}

export function Header() {
  // Merge buffer + preview override pour l'affichage
  const s = () => {
    const base = styleBuffer()
    const ov = previewOverride()
    return ov ? { ...base, ...ov } : base
  }
  const isPreviewing = () => previewOverride() !== null

  const fgHex = () => rgbToHex(s().foreColor) || '#374151'
  const bgHex = () => rgbToHex(s().hiliteColor)
  const hasBg = () => {
    const c = s().hiliteColor
    return !!c && c !== 'transparent' && c !== 'rgba(0, 0, 0, 0)' && c !== ''
  }

  const handleUndo = () => {
    if (!performUndo()) showToast('Rien à annuler', true)
  }

  const handleRedo = () => {
    if (!performRedo()) showToast('Rien à rétablir', true)
  }

  const handleCopy = async () => {
    const html = getAllEditorHtml()
    if (!html) { showToast('Rien a copier', true); return }
    const div = document.createElement('div')
    div.innerHTML = html
    div.querySelectorAll('*').forEach(el => { el.removeAttribute('class'); el.removeAttribute('id') })
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': new Blob([div.innerHTML], { type: 'text/html' }),
          'text/plain': new Blob([getAllEditorText()], { type: 'text/plain' }),
        }),
      ])
      showToast('Copie pour Outlook !')
    } catch { showToast('Erreur de copie', true) }
  }

  return (
    <header class="header">
      <span class="brand-pill">
        Mail Colorer
      </span>

      {/* ── Hotbar : aperçu du style du prochain caractère (lecture seule) ── */}
      <div class={`status-bar ${isPreviewing() ? 'status-bar-preview' : ''}`} title="Aperçu du style appliqué au prochain caractère tapé ou double-cliqué">
        <span class="status-hint">{isPreviewing() ? 'Aperçu :' : 'Prochain style :'}</span>

        {/* Preview "Aa" */}
        <span
          class="status-preview"
          style={{
            "font-family": s().fontFamily,
            "font-size": `${Math.min(s().fontSize, 120)}px`,
            "color": s().foreColor,
            "background-color": hasBg() ? s().hiliteColor : 'transparent',
            "font-weight": s().bold ? '700' : '400',
            "font-style": s().italic ? 'italic' : 'normal',
            "text-decoration": `${s().underline ? 'underline' : ''} ${s().strikeThrough ? 'line-through' : ''}`.trim() || 'none',
          }}
        >Aa</span>

        <div class="status-sep" />

        <span class="status-info status-font">{s().fontFamily.split(',')[0]}</span>
        <span class="status-info status-size">{s().fontSize}px</span>

        <div class="status-sep" />

        {/* Couleur texte */}
        <div class="status-color-swatch" style={{ background: fgHex() }} title="Couleur du texte" />
        <Show when={hasBg()}>
          <div class="status-color-swatch" style={{ background: bgHex(), "border-style": "dashed" }} title="Couleur de fond" />
        </Show>

        <div class="status-sep" />

        {/* B I U S — indicateurs lecture seule */}
        <span class={`status-fmt-ro ${s().bold ? 'active' : ''}`}><b>B</b></span>
        <span class={`status-fmt-ro ${s().italic ? 'active' : ''}`}><i>I</i></span>
        <span class={`status-fmt-ro ${s().underline ? 'active' : ''}`}><u>U</u></span>
        <span class={`status-fmt-ro ${s().strikeThrough ? 'active' : ''}`}><s>S</s></span>
      </div>

      {/* ── Indicateur de lien ── */}
      <LinkIndicator />

      <span class="header-spacer" />
      <button class="btn-icon" title={undoLabel() ? `Annuler : ${undoLabel()}` : 'Annuler (Ctrl+Z)'} onClick={handleUndo} disabled={!canUndo()} style={{ opacity: canUndo() ? '1' : '0.4' }}>↩</button>
      <button class="btn-icon" title={redoLabel() ? `Rétablir : ${redoLabel()}` : 'Rétablir (Ctrl+Y)'} onClick={handleRedo} disabled={!canRedo()} style={{ opacity: canRedo() ? '1' : '0.4' }}>↪</button>
      <HistoryPanel />
      <button class="btn btn-peach" style={{ "margin-left": "8px" }} onClick={handleCopy}>Copier</button>
    </header>
  )
}
