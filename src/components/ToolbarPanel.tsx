import { For, Show, createSignal } from 'solid-js'
import { VENETIAN_PALETTE } from '../data/colors'
import { baseSize, setBaseSize, intensity, setIntensity } from '../stores/editor'
// FontPicker handles font selection and favorites
import { sizeFavorites, addSizeFavorite, removeSizeFavorite } from '../stores/favorites'
import { applyInlineStyle, execFormatCommand, applyLink, removeLink, getSelectedText } from './Editor'
import { updateBuffer, getBuffer } from './Header'
import { EffectsCatalog } from './EffectsCatalog'
import type { CatalogTab } from './EffectsCatalog'
import { FontPicker } from './FontPicker'
import { showToast } from './Toast'

const CUSTOM_COLORS_KEY = 'artlequin_custom_colors'

function loadCustomColors(): string[] {
  try {
    const raw = localStorage.getItem(CUSTOM_COLORS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

export function ToolbarPanel() {
  const [colorMode, setColorMode] = createSignal<'text' | 'bg'>('text')
  const [catalogOpen, setCatalogOpen] = createSignal(false)
  const [catalogTab, setCatalogTab] = createSignal<CatalogTab>('couleur')
  const [customColors, setCustomColors] = createSignal<string[]>(loadCustomColors())

  // Modale lien
  const [linkOpen, setLinkOpen] = createSignal(false)
  const [linkUrl, setLinkUrl] = createSignal('')
  let linkInputRef: HTMLInputElement | undefined

  const applyColor = (color: string) => {
    if (colorMode() === 'text') {
      applyInlineStyle('color', color)
      updateBuffer({ foreColor: color })
    } else {
      applyInlineStyle('backgroundColor', color)
      updateBuffer({ hiliteColor: color })
    }
  }

  const addCustomColor = (color: string) => {
    const current = customColors()
    if (current.includes(color)) return
    if (VENETIAN_PALETTE.some(c => c.hex.toLowerCase() === color.toLowerCase())) return
    const updated = [...current, color]
    setCustomColors(updated)
    localStorage.setItem(CUSTOM_COLORS_KEY, JSON.stringify(updated))
  }

  const removeCustomColor = (color: string) => {
    const updated = customColors().filter(c => c !== color)
    setCustomColors(updated)
    localStorage.setItem(CUSTOM_COLORS_KEY, JSON.stringify(updated))
  }

  const openCatalog = (tab: CatalogTab) => {
    setCatalogTab(tab)
    setCatalogOpen(true)
  }

  return (
    <>
      <div class="toolbar-panel">
        {/* Row 1: Format + Colors */}
        <div class="toolbar-row">
          <button class="btn-icon" onClick={() => { execFormatCommand('bold'); updateBuffer({ bold: !getBuffer().bold }) }}><b>B</b></button>
          <button class="btn-icon" onClick={() => { execFormatCommand('italic'); updateBuffer({ italic: !getBuffer().italic }) }}><i>I</i></button>
          <button class="btn-icon" onClick={() => { execFormatCommand('underline'); updateBuffer({ underline: !getBuffer().underline }) }}><u>U</u></button>
          <button class="btn-icon" onClick={() => { execFormatCommand('strikeThrough'); updateBuffer({ strikeThrough: !getBuffer().strikeThrough }) }}><s>S</s></button>
          <button class="btn-icon" style={{ "font-size": "var(--font-sm)" }} onClick={() => updateBuffer({ bold: false, italic: false, underline: false, strikeThrough: false, foreColor: '#374151', hiliteColor: '', fontSize: 18, fontFamily: 'Arial' })} title="Reinitialiser le style">X</button>
          <button
            class="btn-icon"
            style={{ "font-size": "var(--font-sm)" }}
            title="Ajouter un lien (selectionnez du texte)"
            onClick={() => {
              const text = getSelectedText()
              if (!text) { showToast('Selectionnez du texte', true); return }
              setLinkUrl('https://')
              setLinkOpen(true)
              requestAnimationFrame(() => { linkInputRef?.focus(); linkInputRef?.select() })
            }}
          >🔗</button>
          <div class="separator" />
          <div class="toggle-group">
            <button class={`toggle-btn ${colorMode() === 'text' ? 'active' : ''}`} onClick={() => setColorMode('text')}>Texte</button>
            <button class={`toggle-btn ${colorMode() === 'bg' ? 'active' : ''}`} onClick={() => setColorMode('bg')}>Fond</button>
          </div>
          <div class="swatches">
            <For each={VENETIAN_PALETTE}>
              {(c) => <div class="swatch" style={{ background: c.hex }} title={c.name} onClick={() => applyColor(c.hex)} />}
            </For>
            <For each={customColors()}>
              {(color) => (
                <div class="swatch" style={{ background: color }} title="Double-clic pour retirer" onClick={() => applyColor(color)} onDblClick={() => removeCustomColor(color)} />
              )}
            </For>
          </div>
          <div class="color-picker-wrapper">
            <div class="color-picker-visual" />
            <input type="color" value="#c42b45" onChange={(e) => { applyColor(e.currentTarget.value); addCustomColor(e.currentTarget.value) }} />
          </div>
        </div>

        {/* Row 2: Font + Size + Intensity + Catalogue */}
        <div class="toolbar-row">
          <FontPicker />
          <div class="separator" />
          <div class="slider-group">
            <span class="slider-label">Taille</span>
            <input type="range" min="12" max="48" value={baseSize()} onInput={(e) => setBaseSize(parseInt(e.currentTarget.value))} onChange={(e) => { applyInlineStyle('fontSize', `${e.currentTarget.value}px`); updateBuffer({ fontSize: parseInt(e.currentTarget.value) }) }} />
            <span class="slider-value">{baseSize()}</span>
            <button class="fav-add" onClick={() => addSizeFavorite(baseSize())} title="Ajouter la taille aux favoris">+</button>
          </div>
          <Show when={sizeFavorites().length > 0}>
            <div class="fav-pills">
              <For each={sizeFavorites()}>
                {(size) => (
                  <button
                    class="fav-pill"
                    title={`${size}px — double-clic pour retirer`}
                    onClick={() => { setBaseSize(size); applyInlineStyle('fontSize', `${size}px`) }}
                    onDblClick={() => removeSizeFavorite(size)}
                  >
                    {size}
                  </button>
                )}
              </For>
            </div>
          </Show>
          <div class="separator" />
          <div class="slider-group">
            <span class="slider-label">Intensite</span>
            <input type="range" min="1" max="10" value={intensity()} onInput={(e) => setIntensity(parseInt(e.currentTarget.value))} />
            <span class="slider-value">{intensity()}</span>
          </div>
          <div class="separator" />
          <button class="btn-compact" onClick={() => openCatalog('couleur')} title="Parcourir tous les effets">Catalogue</button>
          <button class="btn-compact" onClick={() => openCatalog('fx')} title="Creer un effet par fonction mathematique">f(x)</button>
          <button class="btn-compact" onClick={() => openCatalog('trace')} title="Dessiner un profil de taille a la souris">Trace</button>
        </div>
      </div>

      <EffectsCatalog open={catalogOpen()} onClose={() => setCatalogOpen(false)} initialTab={catalogTab()} />

      {/* Modale lien */}
      <Show when={linkOpen()}>
        <div class="catalog-overlay" onClick={() => setLinkOpen(false)} />
        <div class="naming-modal" style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', "z-index": '301' }}>
          <span class="naming-title">Ajouter un lien</span>
          <input
            ref={linkInputRef}
            class="naming-input"
            type="url"
            value={linkUrl()}
            onInput={(e) => setLinkUrl(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { applyLink(linkUrl()); setLinkOpen(false) }
              if (e.key === 'Escape') setLinkOpen(false)
            }}
            placeholder="https://..."
          />
          <div class="naming-actions">
            <button class="btn btn-lavender" onClick={() => { applyLink(linkUrl()); setLinkOpen(false) }}>Valider</button>
            <button class="btn" onClick={() => setLinkOpen(false)}>Annuler</button>
          </div>
        </div>
      </Show>
    </>
  )
}
