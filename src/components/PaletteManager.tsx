import { createSignal, For, Show } from 'solid-js'
import { Portal } from 'solid-js/web'
import { VENETIAN_PALETTE, EXTENDED_PALETTE } from '../data/colors'
import {
  userPalettes, activePaletteId,
  getVisibleBaseColors, getActivePalette, isBaseColorHidden,
  toggleBaseColor, resetBaseColors,
  createPalette, deletePalette, renamePalette, setActivePalette,
  addColorToPalette, removeColorFromPalette,
  type PaletteColor,
} from '../stores/palettes'
import { showToast } from './Toast'

interface Props {
  open: boolean
  onClose: () => void
  anchorPos: { top: number; left: number }
}

type View = 'main' | 'edit-base' | 'edit-palette' | 'new-palette'

export function PaletteManager(props: Props) {
  const [view, setView] = createSignal<View>('main')
  const [editingPaletteId, setEditingPaletteId] = createSignal<string | null>(null)
  const [newName, setNewName] = createSignal('')
  const [renamingId, setRenamingId] = createSignal<string | null>(null)
  const [renameVal, setRenameVal] = createSignal('')

  const editingPalette = () => {
    const id = editingPaletteId()
    return id ? userPalettes().find(p => p.id === id) ?? null : null
  }

  const openEditPalette = (id: string) => {
    setEditingPaletteId(id)
    setView('edit-palette')
  }

  const handleCreatePalette = () => {
    const name = newName().trim()
    if (!name) return
    const id = createPalette(name, getVisibleBaseColors())
    setActivePalette(id)
    setNewName('')
    setView('main')
    showToast(`Palette "${name}" creee`)
  }

  const handleCreateEmpty = () => {
    const name = newName().trim()
    if (!name) return
    const id = createPalette(name)
    setActivePalette(id)
    setNewName('')
    setView('main')
    showToast(`Palette "${name}" creee`)
  }

  const handleDelete = (id: string) => {
    deletePalette(id)
    if (editingPaletteId() === id) setView('main')
    showToast('Palette supprimee')
  }

  const startRename = (id: string, name: string) => {
    setRenamingId(id)
    setRenameVal(name)
  }

  const confirmRename = () => {
    const id = renamingId()
    if (!id) return
    renamePalette(id, renameVal().trim() || 'Sans nom')
    setRenamingId(null)
  }

  const addColor = (hex: string, name: string) => {
    const id = editingPaletteId()
    if (!id) return
    addColorToPalette(id, { hex, name })
  }

  const removeColor = (hex: string) => {
    const id = editingPaletteId()
    if (!id) return
    removeColorFromPalette(id, hex)
  }

  return (
    <Show when={props.open}>
      <Portal>
        <div class="palette-mgr-backdrop" onClick={props.onClose} />
        <div class="palette-mgr" style={{ top: `${props.anchorPos.top}px`, left: `${props.anchorPos.left}px` }}>

          {/* ── Vue principale ── */}
          <Show when={view() === 'main'}>
            <div class="palette-mgr-header">Mes palettes</div>

            {/* Palette de base */}
            <div
              class={`palette-mgr-item ${!activePaletteId() ? 'active' : ''}`}
              onClick={() => setActivePalette(null)}
            >
              <div class="palette-mgr-item-colors">
                <For each={getVisibleBaseColors().slice(0, 8)}>
                  {(c) => <span class="palette-mgr-dot" style={{ background: c.hex }} />}
                </For>
                <Show when={getVisibleBaseColors().length > 8}>
                  <span class="palette-mgr-more">+{getVisibleBaseColors().length - 8}</span>
                </Show>
              </div>
              <span class="palette-mgr-item-name">Venitienne</span>
              <button class="palette-mgr-action" onClick={(e) => { e.stopPropagation(); setView('edit-base') }} title="Personnaliser">✏️</button>
            </div>

            {/* Palettes custom */}
            <For each={userPalettes()}>
              {(palette) => (
                <div
                  class={`palette-mgr-item ${activePaletteId() === palette.id ? 'active' : ''}`}
                  onClick={() => setActivePalette(palette.id)}
                >
                  <div class="palette-mgr-item-colors">
                    <For each={palette.colors.slice(0, 8)}>
                      {(c) => <span class="palette-mgr-dot" style={{ background: c.hex }} />}
                    </For>
                    <Show when={palette.colors.length > 8}>
                      <span class="palette-mgr-more">+{palette.colors.length - 8}</span>
                    </Show>
                    <Show when={palette.colors.length === 0}>
                      <span class="palette-mgr-empty">vide</span>
                    </Show>
                  </div>
                  <Show when={renamingId() === palette.id} fallback={
                    <span class="palette-mgr-item-name">{palette.name}</span>
                  }>
                    <input
                      class="palette-mgr-rename-input"
                      value={renameVal()}
                      onInput={(e) => setRenameVal(e.currentTarget.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') confirmRename(); if (e.key === 'Escape') setRenamingId(null) }}
                      onBlur={confirmRename}
                      autofocus
                      onClick={(e) => e.stopPropagation()}
                    />
                  </Show>
                  <div class="palette-mgr-item-actions" onClick={(e) => e.stopPropagation()}>
                    <button class="palette-mgr-action" onClick={() => openEditPalette(palette.id)} title="Modifier">✏️</button>
                    <button class="palette-mgr-action" onClick={() => startRename(palette.id, palette.name)} title="Renommer">Aa</button>
                    <button class="palette-mgr-action palette-mgr-delete" onClick={() => handleDelete(palette.id)} title="Supprimer">✕</button>
                  </div>
                </div>
              )}
            </For>

            <button class="palette-mgr-new-btn" onClick={() => { setNewName(''); setView('new-palette') }}>
              + Nouvelle palette
            </button>
          </Show>

          {/* ── Créer une palette ── */}
          <Show when={view() === 'new-palette'}>
            <div class="palette-mgr-header">
              <button class="palette-mgr-back" onClick={() => setView('main')}>←</button>
              Nouvelle palette
            </div>
            <div class="palette-mgr-form">
              <input
                class="palette-mgr-name-input"
                value={newName()}
                onInput={(e) => setNewName(e.currentTarget.value)}
                placeholder="Nom de la palette"
                onKeyDown={(e) => { if (e.key === 'Enter') handleCreatePalette() }}
                autofocus
              />
              <button class="btn btn-lavender palette-mgr-create-btn" onClick={handleCreatePalette} disabled={!newName().trim()}>
                Copier la palette actuelle
              </button>
              <button class="btn palette-mgr-create-btn" onClick={handleCreateEmpty} disabled={!newName().trim()}>
                Palette vide
              </button>
            </div>
          </Show>

          {/* ── Editer les couleurs de base ── */}
          <Show when={view() === 'edit-base'}>
            <div class="palette-mgr-header">
              <button class="palette-mgr-back" onClick={() => setView('main')}>←</button>
              Palette Venitienne
            </div>
            <div class="palette-mgr-hint">Cliquez pour masquer/afficher une couleur</div>
            <div class="palette-mgr-color-grid">
              <For each={VENETIAN_PALETTE}>
                {(c) => (
                  <div
                    class={`palette-mgr-color-item ${isBaseColorHidden(c.hex) ? 'hidden' : ''}`}
                    onClick={() => toggleBaseColor(c.hex)}
                    title={c.name}
                  >
                    <span class="palette-mgr-color-dot" style={{ background: c.hex }} />
                    <span class="palette-mgr-color-name">{c.name}</span>
                  </div>
                )}
              </For>
            </div>
            <button class="palette-mgr-reset-btn" onClick={resetBaseColors}>Tout afficher</button>
          </Show>

          {/* ── Editer une palette custom ── */}
          <Show when={view() === 'edit-palette' && editingPalette()}>
            {(() => {
              const palette = editingPalette()!
              return (
                <>
                  <div class="palette-mgr-header">
                    <button class="palette-mgr-back" onClick={() => setView('main')}>←</button>
                    {palette.name}
                  </div>

                  {/* Couleurs actuelles */}
                  <Show when={palette.colors.length > 0}>
                    <div class="palette-mgr-sublabel">Couleurs</div>
                    <div class="palette-mgr-color-grid">
                      <For each={palette.colors}>
                        {(c) => (
                          <div class="palette-mgr-color-item palette-mgr-color-removable">
                            <span class="palette-mgr-color-dot" style={{ background: c.hex }} onClick={() => removeColor(c.hex)} />
                            <span class="palette-mgr-color-name">{c.name}</span>
                            <button class="palette-mgr-color-remove" onClick={() => removeColor(c.hex)}>✕</button>
                          </div>
                        )}
                      </For>
                    </div>
                  </Show>

                  {/* Ajouter depuis Vénitienne */}
                  <div class="palette-mgr-sublabel">Ajouter — Venitienne</div>
                  <div class="palette-mgr-add-row">
                    <For each={VENETIAN_PALETTE}>
                      {(c) => {
                        const inPalette = () => palette.colors.some(pc => pc.hex.toLowerCase() === c.hex.toLowerCase())
                        return (
                          <span
                            class={`palette-mgr-add-dot ${inPalette() ? 'in-palette' : ''}`}
                            style={{ background: c.hex }}
                            title={c.name}
                            onClick={() => !inPalette() && addColor(c.hex, c.name)}
                          />
                        )
                      }}
                    </For>
                  </div>

                  {/* Ajouter depuis étendue */}
                  <div class="palette-mgr-sublabel">Ajouter — Etendue</div>
                  <div class="palette-mgr-add-row">
                    <For each={[...EXTENDED_PALETTE]}>
                      {(hex) => {
                        const inPalette = () => palette.colors.some(pc => pc.hex.toLowerCase() === hex.toLowerCase())
                        return (
                          <span
                            class={`palette-mgr-add-dot ${inPalette() ? 'in-palette' : ''}`}
                            style={{ background: hex }}
                            title={hex}
                            onClick={() => !inPalette() && addColor(hex, hex)}
                          />
                        )
                      }}
                    </For>
                  </div>

                  {/* Color picker libre */}
                  <div class="palette-mgr-sublabel">Couleur libre</div>
                  <div class="palette-mgr-custom-picker">
                    <div class="color-picker-wrapper">
                      <div class="color-picker-visual" />
                      <input type="color" value="#c42b45" onChange={(e) => addColor(e.currentTarget.value, e.currentTarget.value.toUpperCase())} />
                    </div>
                    <span class="palette-mgr-hint">Choisir une couleur</span>
                  </div>
                </>
              )
            })()}
          </Show>

        </div>
      </Portal>
    </Show>
  )
}
