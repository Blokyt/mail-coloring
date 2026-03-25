import { createSignal, For, Show } from 'solid-js'
import { Modal } from './Modal'
import { isAdmin } from '../stores/admin'
import {
  adminData, saveAdminData, loadAdminData,
  adminSetColorEffect, adminRemoveColorEffect,
  adminAddEmoji, adminRemoveEmoji, adminUpdateEmoji,
  type AdminColorEffect, type AdminEmoji,
} from '../stores/admin-data'
import { COLOR_EFFECTS } from '../engine/effects'
import { DEFAULT_EMOJIS } from '../data/emojis'
import { VENETIAN_PALETTE } from '../data/colors'
import { showToast } from './Toast'

type Tab = 'colors' | 'emojis'

export function AdminPanel() {
  const [open, setOpen] = createSignal(false)
  const [tab, setTab] = createSignal<Tab>('colors')
  const [saving, setSaving] = createSignal(false)

  // Color effect editing
  const [editingId, setEditingId] = createSignal<string | null>(null)
  const [editName, setEditName] = createSignal('')
  const [editColors, setEditColors] = createSignal<string[]>([])

  // New color effect
  const [newName, setNewName] = createSignal('')
  const [newColors, setNewColors] = createSignal<string[]>([])

  // New emoji
  const [newEmoji, setNewEmoji] = createSignal('')
  const [newEmojiLabel, setNewEmojiLabel] = createSignal('')

  const handleSave = async () => {
    setSaving(true)
    const ok = await saveAdminData()
    setSaving(false)
    if (ok) {
      showToast('Donnees admin sauvegardees !')
      await loadAdminData()
    } else {
      showToast('Erreur de sauvegarde', true)
    }
  }

  /* ── Color effects: merge hardcoded + admin overrides ── */
  const allColorEffects = () => {
    const base = Object.entries(COLOR_EFFECTS).map(([id, e]) => ({
      id,
      name: adminData().colorEffects[id]?.name ?? e.name,
      colors: adminData().colorEffects[id]?.colors ?? e.colors,
      isOverride: !!adminData().colorEffects[id],
      isCustom: false,
    }))
    // Admin-only effects (IDs not in COLOR_EFFECTS)
    const customIds = Object.keys(adminData().colorEffects).filter(id => !COLOR_EFFECTS[id])
    const custom = customIds.map(id => ({
      id,
      name: adminData().colorEffects[id].name,
      colors: adminData().colorEffects[id].colors,
      isOverride: false,
      isCustom: true,
    }))
    return [...base, ...custom]
  }

  const startEdit = (id: string, name: string, colors: string[]) => {
    setEditingId(id)
    setEditName(name)
    setEditColors([...colors])
  }

  const confirmEdit = () => {
    const id = editingId()
    if (!id) return
    adminSetColorEffect(id, { name: editName(), colors: editColors() })
    setEditingId(null)
  }

  const addColorToEdit = (color: string) => {
    setEditColors(prev => [...prev, color])
  }

  const removeColorFromEdit = (index: number) => {
    setEditColors(prev => prev.filter((_, i) => i !== index))
  }

  const addNewEffect = () => {
    const name = newName().trim()
    if (!name || newColors().length === 0) return
    const id = `admin-${Date.now()}`
    adminSetColorEffect(id, { name, colors: newColors() })
    setNewName('')
    setNewColors([])
  }

  /* ── Emojis: merge hardcoded + admin ── */
  const allEmojis = () => {
    const base = DEFAULT_EMOJIS.map(e => ({ ...e, source: 'base' as const }))
    const admin = adminData().emojis.map(e => ({ ...e, source: 'admin' as const }))
    return [...base, ...admin]
  }

  const addAdminEmoji = () => {
    const emoji = newEmoji().trim()
    const label = newEmojiLabel().trim() || emoji
    if (!emoji) return
    adminAddEmoji({ id: `admin-emoji-${Date.now()}`, emoji, label })
    setNewEmoji('')
    setNewEmojiLabel('')
  }

  return (
    <>
      <Show when={isAdmin()}>
        <button class="admin-panel-trigger" onClick={() => setOpen(true)} title="Panneau admin">
          Admin
        </button>
      </Show>

      <Modal open={open()} onClose={() => setOpen(false)} title="Panneau Admin" description="Modifier les effets, emojis et parametres par defaut" size="lg" zIndex={250}>
        <div class="admin-tabs">
          <button class={`catalog-tab ${tab() === 'colors' ? 'active' : ''}`} onClick={() => setTab('colors')}>Effets couleur</button>
          <button class={`catalog-tab ${tab() === 'emojis' ? 'active' : ''}`} onClick={() => setTab('emojis')}>Emojis</button>
        </div>

        <div class="admin-body">
          {/* ── Effets couleur ── */}
          <Show when={tab() === 'colors'}>
            <div class="admin-section">
              <For each={allColorEffects()}>
                {(effect) => (
                  <div class={`admin-effect-row ${effect.isCustom ? 'admin-custom' : ''}`}>
                    <Show when={editingId() === effect.id} fallback={
                      <>
                        <span class="admin-effect-name">
                          {effect.name}
                          <Show when={effect.isOverride}><span class="admin-modified-badge">modifie</span></Show>
                          <Show when={effect.isCustom}><span class="admin-custom-badge">admin</span></Show>
                        </span>
                        <div class="admin-color-preview">
                          <For each={effect.colors}>
                            {(c) => <span class="admin-color-dot" style={{ background: c }} />}
                          </For>
                        </div>
                        <div class="admin-effect-actions">
                          <button class="btn tuto-btn" onClick={() => startEdit(effect.id, effect.name, effect.colors)}>Modifier</button>
                          <Show when={effect.isCustom || effect.isOverride}>
                            <button class="tuto-skip" onClick={() => adminRemoveColorEffect(effect.id)}>
                              {effect.isCustom ? 'Supprimer' : 'Reset'}
                            </button>
                          </Show>
                        </div>
                      </>
                    }>
                      {/* Mode edition */}
                      <div class="admin-edit-form">
                        <input
                          class="naming-input"
                          value={editName()}
                          onInput={(e) => setEditName(e.currentTarget.value)}
                          placeholder="Nom de l'effet"
                        />
                        <div class="admin-edit-colors">
                          <For each={editColors()}>
                            {(c, i) => (
                              <span
                                class="admin-color-dot admin-color-dot-edit"
                                style={{ background: c }}
                                onClick={() => removeColorFromEdit(i())}
                                title="Cliquer pour retirer"
                              />
                            )}
                          </For>
                          <div class="admin-add-color-wrap">
                            <input type="color" value="#c42b45" onChange={(e) => addColorToEdit(e.currentTarget.value)} />
                          </div>
                        </div>
                        <div class="admin-palette-quick">
                          <For each={VENETIAN_PALETTE}>
                            {(c) => (
                              <span
                                class="admin-color-dot"
                                style={{ background: c.hex }}
                                onClick={() => addColorToEdit(c.hex)}
                                title={c.name}
                              />
                            )}
                          </For>
                        </div>
                        <div class="admin-edit-actions">
                          <button class="btn btn-lavender tuto-btn" onClick={confirmEdit}>OK</button>
                          <button class="btn tuto-btn" onClick={() => setEditingId(null)}>Annuler</button>
                        </div>
                      </div>
                    </Show>
                  </div>
                )}
              </For>

              {/* Ajouter un nouvel effet */}
              <div class="admin-new-section">
                <span class="admin-section-label">Ajouter un effet couleur</span>
                <div class="admin-edit-form">
                  <input
                    class="naming-input"
                    value={newName()}
                    onInput={(e) => setNewName(e.currentTarget.value)}
                    placeholder="Nom du nouvel effet"
                  />
                  <div class="admin-edit-colors">
                    <For each={newColors()}>
                      {(c, i) => (
                        <span
                          class="admin-color-dot admin-color-dot-edit"
                          style={{ background: c }}
                          onClick={() => setNewColors(prev => prev.filter((_, idx) => idx !== i()))}
                          title="Cliquer pour retirer"
                        />
                      )}
                    </For>
                    <div class="admin-add-color-wrap">
                      <input type="color" value="#c42b45" onChange={(e) => setNewColors(prev => [...prev, e.currentTarget.value])} />
                    </div>
                  </div>
                  <div class="admin-palette-quick">
                    <For each={VENETIAN_PALETTE}>
                      {(c) => (
                        <span class="admin-color-dot" style={{ background: c.hex }} onClick={() => setNewColors(prev => [...prev, c.hex])} title={c.name} />
                      )}
                    </For>
                  </div>
                  <button class="btn btn-lavender tuto-btn" onClick={addNewEffect} disabled={!newName().trim() || newColors().length === 0}>Ajouter</button>
                </div>
              </div>
            </div>
          </Show>

          {/* ── Emojis ── */}
          <Show when={tab() === 'emojis'}>
            <div class="admin-section">
              <div class="admin-emoji-grid">
                <For each={allEmojis()}>
                  {(entry) => (
                    <div class="admin-emoji-item">
                      <span class="admin-emoji-char">{entry.emoji}</span>
                      <span class="admin-emoji-label">{entry.label}</span>
                      <Show when={entry.source === 'admin'}>
                        <button class="admin-emoji-remove" onClick={() => adminRemoveEmoji(entry.id)} title="Supprimer">x</button>
                      </Show>
                    </div>
                  )}
                </For>
              </div>

              <div class="admin-new-section">
                <span class="admin-section-label">Ajouter un emoji par defaut</span>
                <div class="admin-emoji-add-row">
                  <input class="naming-input" value={newEmoji()} onInput={(e) => setNewEmoji(e.currentTarget.value)} placeholder="Emoji..." style={{ width: '80px' }} />
                  <input class="naming-input" value={newEmojiLabel()} onInput={(e) => setNewEmojiLabel(e.currentTarget.value)} placeholder="Label" style={{ flex: '1' }} />
                  <button class="btn btn-lavender tuto-btn" onClick={addAdminEmoji} disabled={!newEmoji().trim()}>Ajouter</button>
                </div>
              </div>
            </div>
          </Show>
        </div>

        {/* Footer save */}
        <div class="admin-footer">
          <button class="btn btn-lavender" onClick={handleSave} disabled={saving()}>
            {saving() ? 'Sauvegarde...' : 'Sauvegarder sur le serveur'}
          </button>
          <span class="admin-footer-hint">Les modifications sont ecrites dans public/admin-data.json</span>
        </div>
      </Modal>
    </>
  )
}
