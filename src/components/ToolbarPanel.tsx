import { For, Show, createSignal } from 'solid-js'
import { Portal } from 'solid-js/web'
import { baseSize, setBaseSize, activeFont, setActiveFont } from '../stores/editor'
import { sizeFavorites, addSizeFavorite, removeSizeFavorite, fontFavorites, removeFontFavorite, addFontFavorite, sizeRecents, fontRecents, pushSizeRecent, pushFontRecent, removeSizeRecent, removeFontRecent } from '../stores/workshops'
import { getEmojiFavorites, getEmojiRecents, addEmojiFavorite, removeEmojiFavorite, removeEmojiRecent } from './EmojiPicker'
import { getToolbarColors, getActivePalette, activePaletteId, removeToolbarColor, addToolbarColor } from '../stores/palettes'
import { applyInlineStyle, execFormatCommand, clearSelectionStyle, applyLink, getSelectedText, replaceSelectionWithHtml, refreshSizeEffects, resizeLiveSelection } from './Editor'
import { updateBuffer, getBuffer, setPreview } from './Header'
import { EffectsCatalog } from './EffectsCatalog'
import type { CatalogTab } from './EffectsCatalog'
import { FontPicker } from './FontPicker'
import { FONTS } from '../data/fonts'
import { EmojiPicker } from './EmojiPicker'
import { PaletteManager } from './PaletteManager'
import { Modal } from './Modal'
import { showToast } from './Toast'

/* ── SizeControl — slider + dropdown Word + input manuel ── */

const WORD_SIZES = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 20, 22, 24, 26, 28, 30, 32, 36, 40, 44, 48, 54, 60, 66, 72, 80, 90, 100, 120]

function SizeControl(props: { value: number; onChange: (v: number) => void; onDrag: (v: number) => void; onAddFav: () => void }) {
  const [editing, setEditing] = createSignal(false)
  const [dropdownOpen, setDropdownOpen] = createSignal(false)
  const [editVal, setEditVal] = createSignal('')
  const [dropdownPos, setDropdownPos] = createSignal({ top: 0, left: 0 })
  let inputRef: HTMLInputElement | undefined
  let dropdownRef: HTMLDivElement | undefined
  let wrapRef: HTMLDivElement | undefined

  const startEdit = () => {
    setEditVal(String(props.value))
    setDropdownOpen(false)
    setEditing(true)
    requestAnimationFrame(() => { inputRef?.focus(); inputRef?.select() })
  }

  const confirm = () => {
    const v = parseInt(editVal())
    if (v && v >= 6 && v <= 200) props.onChange(v)
    setEditing(false)
    setPreview(null)
  }

  const selectSize = (size: number) => {
    props.onChange(size)
    setDropdownOpen(false)
  }

  const toggleDropdown = () => {
    if (dropdownOpen()) { setDropdownOpen(false); return }
    // Calculer la position fixed du dropdown
    if (wrapRef) {
      const rect = wrapRef.getBoundingClientRect()
      setDropdownPos({ top: rect.bottom + 4, left: rect.left })
    }
    setDropdownOpen(true)
    requestAnimationFrame(() => {
      if (dropdownRef) {
        const active = dropdownRef.querySelector('.size-dropdown-item.active')
        if (active) active.scrollIntoView({ block: 'center' })
      }
    })
  }

  return (
    <div class="slider-group">
      <span class="slider-label">Taille</span>
      <input
        type="range"
        min="8"
        max="72"
        value={Math.min(72, Math.max(8, props.value))}
        onInput={(e) => props.onDrag(parseInt(e.currentTarget.value))}
        onChange={(e) => props.onChange(parseInt(e.currentTarget.value))}
      />

      <div class="size-control-wrap" ref={wrapRef}>
        <Show when={editing()} fallback={
          <div class="size-value-row">
            <button class="slider-value slider-value-clickable" onClick={startEdit} title="Saisir une taille exacte">
              {props.value}
            </button>
            <button class="size-dropdown-arrow" onClick={toggleDropdown} title="Tailles prédéfinies">&#9662;</button>
          </div>
        }>
          <input
            ref={inputRef}
            class="slider-value-input"
            type="text"
            inputmode="numeric"
            value={editVal()}
            onInput={(e) => {
              const val = e.currentTarget.value.replace(/[^\d]/g, '')
              setEditVal(val)
              const v = parseInt(val)
              if (v && v >= 6 && v <= 200) setPreview({ fontSize: v })
            }}
            onKeyDown={(e) => { if (e.key === 'Enter') confirm(); if (e.key === 'Escape') { setEditing(false); setPreview(null) } }}
            onBlur={() => { confirm(); setPreview(null) }}
          />
        </Show>

        <Show when={dropdownOpen()}>
          <Portal>
            <div class="size-dropdown-backdrop" onClick={() => { setDropdownOpen(false); setPreview(null) }} />
            <div
              class="size-dropdown"
              ref={dropdownRef}
              style={{ top: `${dropdownPos().top}px`, left: `${dropdownPos().left}px` }}
              onMouseLeave={() => setPreview(null)}
            >
              <For each={WORD_SIZES}>
                {(size) => (
                  <button
                    class={`size-dropdown-item ${size === props.value ? 'active' : ''}`}
                    onClick={() => { selectSize(size); setPreview(null) }}
                    onMouseEnter={() => setPreview({ fontSize: size })}
                  >
                    {size}
                  </button>
                )}
              </For>
            </div>
          </Portal>
        </Show>
      </div>

    </div>
  )
}

export function ToolbarPanel() {
  const [colorMode, setColorMode] = createSignal<'text' | 'bg'>('text')
  const [selectedSwatch, setSelectedSwatch] = createSignal<string | null>(null)
  const [catalogOpen, setCatalogOpen] = createSignal(false)
  const [catalogTab, setCatalogTab] = createSignal<CatalogTab>('base')
  const [paletteOpen, setPaletteOpen] = createSignal(false)
  const [palettePos, setPalettePos] = createSignal({ top: 0, left: 0 })
  let paletteRef: HTMLButtonElement | undefined

  // Pill sélectionnée (montre croix/étoile)
  const [selectedPill, setSelectedPill] = createSignal<string | null>(null)

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

  const togglePaletteManager = () => {
    if (paletteOpen()) { setPaletteOpen(false); return }
    if (paletteRef) {
      const rect = paletteRef.getBoundingClientRect()
      setPalettePos({ top: rect.bottom + 6, left: Math.max(8, rect.left - 100) })
    }
    setPaletteOpen(true)
  }

  const openCatalog = (tab: CatalogTab) => {
    setCatalogTab(tab)
    setCatalogOpen(true)
  }

  return (
    <>
      <div class="toolbar-panel" onMouseDown={(e) => { if ((e.target as HTMLElement).tagName !== 'INPUT') e.preventDefault() }}>
        {/* Row 1: Format + Colors */}
        <div class="toolbar-row">
          <button class="btn-icon" onClick={() => { execFormatCommand('bold'); updateBuffer({ bold: !getBuffer().bold }) }}><b>B</b></button>
          <button class="btn-icon" onClick={() => { execFormatCommand('italic'); updateBuffer({ italic: !getBuffer().italic }) }}><i>I</i></button>
          <button class="btn-icon" onClick={() => { execFormatCommand('underline'); updateBuffer({ underline: !getBuffer().underline }) }}><u>U</u></button>
          <button class="btn-icon" onClick={() => { execFormatCommand('strikeThrough'); updateBuffer({ strikeThrough: !getBuffer().strikeThrough }) }}><s>S</s></button>
          <button class="btn-icon" style={{ "font-size": "var(--font-sm)" }} onClick={() => { clearSelectionStyle(); updateBuffer({ bold: false, italic: false, underline: false, strikeThrough: false, foreColor: '#374151', hiliteColor: '', fontSize: 18, fontFamily: 'Arial' }) }} title="Reinitialiser le style">X</button>
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
          <EmojiPicker onSelect={(emoji) => {
            const size = getBuffer().fontSize || baseSize()
            replaceSelectionWithHtml(`<span style="font-size:${size}px">${emoji}</span>`)
          }} />
          <Show when={getEmojiFavorites().length > 0 || getEmojiRecents().length > 0}>
            <div class="tb-pills">
              <For each={getEmojiFavorites()}>
                {(emoji) => {
                  const id = `emoji-fav-${emoji}`
                  const insert = () => { const s = getBuffer().fontSize || baseSize(); replaceSelectionWithHtml(`<span style="font-size:${s}px">${emoji}</span>`) }
                  return (
                    <div class="tb-pill-wrap">
                      <button class="tb-pill tb-emoji" title={emoji} onClick={() => { insert(); setSelectedPill(p => p === id ? null : id) }}>{emoji}</button>
                      <Show when={selectedPill() === id}>
                        <button class="tb-pill-x" onClick={(e) => { e.stopPropagation(); removeEmojiFavorite(emoji); setSelectedPill(null) }}>×</button>
                      </Show>
                    </div>
                  )
                }}
              </For>
              <For each={getEmojiRecents().filter(e => !getEmojiFavorites().includes(e)).slice(0, 3)}>
                {(emoji) => {
                  const id = `emoji-rec-${emoji}`
                  const insert = () => { const s = getBuffer().fontSize || baseSize(); replaceSelectionWithHtml(`<span style="font-size:${s}px">${emoji}</span>`) }
                  return (
                    <div class="tb-pill-wrap">
                      <button class="tb-pill tb-emoji tb-recent" title={emoji} onClick={() => { insert(); setSelectedPill(p => p === id ? null : id) }}>{emoji}</button>
                      <Show when={selectedPill() === id}>
                        <button class="tb-pill-x" onClick={(e) => { e.stopPropagation(); removeEmojiRecent(emoji); setSelectedPill(null) }}>×</button>
                        <button class="tb-pill-star" onClick={(e) => { e.stopPropagation(); addEmojiFavorite(emoji); setSelectedPill(null) }}>★</button>
                      </Show>
                    </div>
                  )
                }}
              </For>
            </div>
          </Show>
          <div class="separator" />
          <div class="toggle-group">
            <button class={`toggle-btn ${colorMode() === 'text' ? 'active' : ''}`} onClick={() => setColorMode('text')}>Texte</button>
            <button class={`toggle-btn ${colorMode() === 'bg' ? 'active' : ''}`} onClick={() => setColorMode('bg')}>Fond</button>
          </div>
          <div class="swatches">
            <For each={getToolbarColors()}>
              {(c) => {
                const isSelected = () => selectedSwatch() === c.hex
                return (
                  <div class={`swatch-wrap ${isSelected() ? 'swatch-selected' : ''}`}>
                    <div
                      class={`swatch ${isSelected() ? 'swatch-active' : ''}`}
                      style={{ background: c.hex }}
                      title={c.name}
                      onClick={() => {
                        applyColor(c.hex)
                        setSelectedSwatch(prev => prev === c.hex ? null : c.hex)
                      }}
                    />
                    <Show when={isSelected()}>
                      <button class="swatch-remove" onClick={(e) => { e.stopPropagation(); removeToolbarColor(c.hex); setSelectedSwatch(null) }}>
x
                      </button>
                    </Show>
                  </div>
                )
              }}
            </For>
            <div class="color-picker-wrapper">
              <div class="color-picker-visual" />
              <input type="color" value="#c42b45" onChange={(e) => addToolbarColor({ hex: e.currentTarget.value, name: e.currentTarget.value.toUpperCase() })} />
            </div>
          </div>
          <button
            ref={paletteRef}
            class="palette-btn"
            onClick={togglePaletteManager}
            title="Palettes"
          >
            <div class="palette-btn-icon" />
          </button>
        </div>

        {/* Row 2: Font + Size + Intensity + Catalogue */}
        <div class="toolbar-row">
          <FontPicker />
          <Show when={fontFavorites().length > 0 || fontRecents().filter(f => !fontFavorites().includes(f)).length > 0}>
            <div class="tb-pills">
              <For each={fontFavorites()}>
                {(fontVal) => {
                  const id = `font-fav-${fontVal}`
                  const entry = () => FONTS.find(f => f.value === fontVal)
                  const label = () => entry()?.name ?? fontVal.split(',')[0]
                  const apply = () => { setActiveFont(fontVal); applyInlineStyle('fontFamily', fontVal); updateBuffer({ fontFamily: fontVal }) }
                  return (
                    <div class="tb-pill-wrap">
                      <button
                        class="tb-pill"
                        style={{ "font-family": fontVal }}
                        title={label()}
                        onClick={() => { apply(); setSelectedPill(p => p === id ? null : id) }}
                        onMouseEnter={() => setPreview({ fontFamily: fontVal })}
                        onMouseLeave={() => setPreview(null)}
                      >{label()}</button>
                      <Show when={selectedPill() === id}>
                        <button class="tb-pill-x" onClick={(e) => { e.stopPropagation(); removeFontFavorite(fontVal); setSelectedPill(null) }}>×</button>
                      </Show>
                    </div>
                  )
                }}
              </For>
              <For each={fontRecents().filter(f => !fontFavorites().includes(f)).slice(0, 3)}>
                {(fontVal) => {
                  const id = `font-rec-${fontVal}`
                  const entry = () => FONTS.find(f => f.value === fontVal)
                  const label = () => entry()?.name ?? fontVal.split(',')[0]
                  const apply = () => { setActiveFont(fontVal); applyInlineStyle('fontFamily', fontVal); updateBuffer({ fontFamily: fontVal }) }
                  return (
                    <div class="tb-pill-wrap">
                      <button
                        class="tb-pill tb-recent"
                        style={{ "font-family": fontVal }}
                        title={label()}
                        onClick={() => { apply(); setSelectedPill(p => p === id ? null : id) }}
                        onMouseEnter={() => setPreview({ fontFamily: fontVal })}
                        onMouseLeave={() => setPreview(null)}
                      >{label()}</button>
                      <Show when={selectedPill() === id}>
                        <button class="tb-pill-x" onClick={(e) => { e.stopPropagation(); removeFontRecent(fontVal); setSelectedPill(null) }}>×</button>
                        <button class="tb-pill-star" onClick={(e) => { e.stopPropagation(); addFontFavorite(fontVal); setSelectedPill(null) }}>★</button>
                      </Show>
                    </div>
                  )
                }}
              </For>
            </div>
          </Show>
          <div class="separator" />
          <SizeControl
            value={baseSize()}
            onDrag={(v) => { setBaseSize(v); updateBuffer({ fontSize: v }); resizeLiveSelection(v); refreshSizeEffects(v) }}
            onChange={(v) => { setBaseSize(v); updateBuffer({ fontSize: v }); resizeLiveSelection(v); refreshSizeEffects(v); pushSizeRecent(v) }}
            onAddFav={() => addSizeFavorite(baseSize())}
          />
          <Show when={sizeFavorites().length > 0 || sizeRecents().filter(s => !sizeFavorites().includes(s)).length > 0}>
            <div class="tb-pills">
              <For each={sizeFavorites()}>
                {(size) => {
                  const id = `size-fav-${size}`
                  const apply = () => { setBaseSize(size); updateBuffer({ fontSize: size }); resizeLiveSelection(size); refreshSizeEffects(size) }
                  return (
                    <div class="tb-pill-wrap">
                      <button
                        class="tb-pill"
                        title={`${size}px`}
                        onClick={() => { apply(); setSelectedPill(p => p === id ? null : id) }}
                        onMouseEnter={() => setPreview({ fontSize: size })}
                        onMouseLeave={() => setPreview(null)}
                      >{size}</button>
                      <Show when={selectedPill() === id}>
                        <button class="tb-pill-x" onClick={(e) => { e.stopPropagation(); removeSizeFavorite(size); setSelectedPill(null) }}>×</button>
                      </Show>
                    </div>
                  )
                }}
              </For>
              <For each={sizeRecents().filter(s => !sizeFavorites().includes(s)).slice(0, 3)}>
                {(size) => {
                  const id = `size-rec-${size}`
                  const apply = () => { setBaseSize(size); updateBuffer({ fontSize: size }); resizeLiveSelection(size); refreshSizeEffects(size) }
                  return (
                    <div class="tb-pill-wrap">
                      <button
                        class="tb-pill tb-recent"
                        title={`${size}px`}
                        onClick={() => { apply(); setSelectedPill(p => p === id ? null : id) }}
                        onMouseEnter={() => setPreview({ fontSize: size })}
                        onMouseLeave={() => setPreview(null)}
                      >{size}</button>
                      <Show when={selectedPill() === id}>
                        <button class="tb-pill-x" onClick={(e) => { e.stopPropagation(); removeSizeRecent(size); setSelectedPill(null) }}>×</button>
                        <button class="tb-pill-star" onClick={(e) => { e.stopPropagation(); addSizeFavorite(size); setSelectedPill(null) }}>★</button>
                      </Show>
                    </div>
                  )
                }}
              </For>
            </div>
          </Show>
          <div class="separator" />
          <button class="btn-compact" onClick={() => openCatalog('base')} title="Parcourir tous les effets">Catalogue</button>
          <button class="btn-compact" onClick={() => openCatalog('perso')} title="Votre collection d'effets">Mon atelier</button>
          <button class="btn-compact" onClick={() => openCatalog('creer')} title="Creer un effet par f(x) ou trace">Creer</button>
        </div>
      </div>

      <EffectsCatalog open={catalogOpen()} onClose={() => setCatalogOpen(false)} initialTab={catalogTab()} />
      <PaletteManager open={paletteOpen()} onClose={() => setPaletteOpen(false)} anchorPos={palettePos()} />

      {/* Modale lien */}
      <Modal open={linkOpen()} onClose={() => setLinkOpen(false)} title="Ajouter un lien" size="sm" zIndex={300}>
        <div style={{ padding: '0 24px 20px', display: 'flex', "flex-direction": 'column', gap: '12px' }}>
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
      </Modal>
    </>
  )
}
