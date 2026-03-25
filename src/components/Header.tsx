import { createSignal, onMount, onCleanup, Show } from 'solid-js'
import { getEditorEl, getAllEditorHtml, getAllEditorText, applyInlineStyle, execFormatCommand } from './Editor'
import { undo, pushRedo, redo, pushUndo } from '../stores/editor'
import { isAdmin, toggleAdmin } from '../stores/admin'
import { showToast } from './Toast'
import { startTutorial } from '../stores/tutorial'

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

/** Met a jour un champ du buffer */
export function updateBuffer(partial: Partial<StyleBuffer>) {
  setStyleBuffer(prev => ({ ...prev, ...partial }))
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

export function Header() {
  const s = () => styleBuffer()

  const fgHex = () => rgbToHex(s().foreColor) || '#374151'
  const bgHex = () => rgbToHex(s().hiliteColor)
  const hasBg = () => {
    const c = s().hiliteColor
    return !!c && c !== 'transparent' && c !== 'rgba(0, 0, 0, 0)' && c !== ''
  }

  onMount(() => {})

  // Toggle un format dans le buffer + applique a la selection
  const toggleFormat = (cmd: string, field: keyof StyleBuffer) => {
    execFormatCommand(cmd)
    setStyleBuffer(prev => ({ ...prev, [field]: !prev[field] }))
  }

  const handleUndo = () => {
    const editor = getEditorEl()
    if (!editor) return
    const prev = undo()
    if (prev !== null) { pushRedo(editor.innerHTML); editor.innerHTML = prev }
    else showToast('Rien a annuler', true)
  }

  const handleRedo = () => {
    const editor = getEditorEl()
    if (!editor) return
    const next = redo()
    if (next !== null) { pushUndo(editor.innerHTML); editor.innerHTML = next }
    else showToast('Rien a retablir', true)
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
      <span class="brand-pill" onDblClick={toggleAdmin}>
        Mail Colorer
        <Show when={isAdmin()}>
          <span class="admin-badge">ADMIN</span>
        </Show>
      </span>

      {/* ── Hotbar : buffer de style du prochain caractere ── */}
      <div class="status-bar">
        {/* Preview "Aa" */}
        <span
          class="status-preview"
          style={{
            "font-family": s().fontFamily,
            "font-size": `${Math.min(s().fontSize, 24)}px`,
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
        <div class="status-color-group">
          <div class="status-color-wrapper">
            <div class="status-color-swatch" style={{ background: fgHex() }} />
            <input
              type="color"
              value={fgHex()}
              onChange={(e) => {
                const c = e.currentTarget.value
                applyInlineStyle('color', c)
                updateBuffer({ foreColor: c })
              }}
              title="Couleur du texte"
            />
          </div>
          <span class="status-label">A</span>
        </div>

        {/* Couleur fond */}
        <div class="status-color-group">
          <div class="status-color-wrapper">
            <div class="status-color-swatch" style={{ background: hasBg() ? bgHex() : 'var(--white)', "border-style": hasBg() ? 'solid' : 'dashed' }} />
            <input
              type="color"
              value={hasBg() ? bgHex() : '#ffffff'}
              onChange={(e) => {
                const c = e.currentTarget.value
                applyInlineStyle('backgroundColor', c)
                updateBuffer({ hiliteColor: c })
              }}
              title="Couleur de fond"
            />
          </div>
          {hasBg() && (
            <button
              class="status-clear-bg"
              onClick={() => updateBuffer({ hiliteColor: '' })}
              title="Retirer le fond"
            >x</button>
          )}
        </div>

        <div class="status-sep" />

        {/* B I U S */}
        <button class={`status-fmt ${s().bold ? 'active' : ''}`} onClick={() => toggleFormat('bold', 'bold')} title="Gras"><b>B</b></button>
        <button class={`status-fmt ${s().italic ? 'active' : ''}`} onClick={() => toggleFormat('italic', 'italic')} title="Italique"><i>I</i></button>
        <button class={`status-fmt ${s().underline ? 'active' : ''}`} onClick={() => toggleFormat('underline', 'underline')} title="Souligne"><u>U</u></button>
        <button class={`status-fmt ${s().strikeThrough ? 'active' : ''}`} onClick={() => toggleFormat('strikeThrough', 'strikeThrough')} title="Barre"><s>S</s></button>
      </div>

      <span class="header-spacer" />
      <button class="btn-icon tuto-trigger" title="Lancer le tutoriel" onClick={startTutorial}>?</button>
      <button class="btn-icon" title="Annuler (Ctrl+Z)" onClick={handleUndo}>↩</button>
      <button class="btn-icon" title="Retablir (Ctrl+Y)" onClick={handleRedo}>↪</button>
      <button class="btn btn-peach" style={{ "margin-left": "8px" }} onClick={handleCopy}>Copier</button>
    </header>
  )
}
