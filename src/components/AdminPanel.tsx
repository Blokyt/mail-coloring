import { createSignal, For, Show, onMount } from 'solid-js'
import { Modal } from './Modal'
import { isAdmin } from '../stores/admin'
import {
  adminData, saveAdminData, loadAdminData,
  adminSetColorEffect, adminRemoveColorEffect,
  adminAddEmoji, adminRemoveEmoji,
  adminSetCss,
  type AdminColorEffect, type AdminEmoji,
} from '../stores/admin-data'
import { COLOR_EFFECTS } from '../engine/effects'
import { DEFAULT_EMOJIS } from '../data/emojis'
import { VENETIAN_PALETTE } from '../data/colors'
import { showToast } from './Toast'

type Tab = 'css' | 'colors' | 'emojis'

/* ══════════════════════════════════════════
   CSS Tweaker — types & data (ex CssTweaker.tsx)
   ══════════════════════════════════════════ */

interface RangeControl { type: 'range'; label: string; variable: string; min: number; max: number; step?: number; value: number; unit: string; divisor?: number }
interface ColorControl { type: 'color'; label: string; variable: string; value: string }
type TweakControl = RangeControl | ColorControl
interface Category { name: string; controls: TweakControl[] }

const CSS_CATEGORIES: Category[] = [
  { name: 'Couleurs — Accents', controls: [
    { type: 'color', label: 'Lavande', variable: '--lavender', value: '#c4b5fd' },
    { type: 'color', label: 'Peche', variable: '--peach', value: '#fdba74' },
    { type: 'color', label: 'Menthe', variable: '--mint', value: '#86efac' },
    { type: 'color', label: 'Ombre', variable: '--shadow-color', value: '#c4b5fd' },
  ]},
  { name: 'Couleurs — Base', controls: [
    { type: 'color', label: 'Texte', variable: '--soft-black', value: '#374151' },
    { type: 'color', label: 'Fond page', variable: '--bg', value: '#faf9f7' },
    { type: 'color', label: 'Fond blanc', variable: '--white', value: '#ffffff' },
    { type: 'color', label: 'Attenue', variable: '--muted', value: '#9ca3af' },
    { type: 'color', label: 'Separateur', variable: '--separator', value: '#e5e7eb' },
  ]},
  { name: 'Typographie', controls: [
    { type: 'range', label: 'XS', variable: '--font-xs', min: 6, max: 16, value: 9, unit: 'px' },
    { type: 'range', label: 'SM', variable: '--font-sm', min: 8, max: 18, value: 12, unit: 'px' },
    { type: 'range', label: 'MD', variable: '--font-md', min: 10, max: 22, value: 14, unit: 'px' },
    { type: 'range', label: 'LG', variable: '--font-lg', min: 12, max: 30, value: 18, unit: 'px' },
    { type: 'range', label: 'Editeur', variable: '--font-editor', min: 12, max: 36, value: 18, unit: 'px' },
  ]},
  { name: 'Bordures & Rayons', controls: [
    { type: 'range', label: 'Epaisseur', variable: '--border', min: 1, max: 8, value: 3, unit: 'px' },
    { type: 'range', label: 'Rayon S', variable: '--radius-sm', min: 0, max: 24, value: 8, unit: 'px' },
    { type: 'range', label: 'Rayon M', variable: '--radius-md', min: 0, max: 32, value: 12, unit: 'px' },
    { type: 'range', label: 'Rayon L', variable: '--radius-lg', min: 0, max: 48, value: 20, unit: 'px' },
  ]},
  { name: 'Ombres', controls: [
    { type: 'range', label: 'Decalage X', variable: '--shadow-x', min: 0, max: 16, value: 5, unit: 'px' },
    { type: 'range', label: 'Decalage Y', variable: '--shadow-y', min: 0, max: 16, value: 5, unit: 'px' },
  ]},
  { name: 'Tailles elements', controls: [
    { type: 'range', label: 'Boutons', variable: '--btn-size', min: 24, max: 56, value: 38, unit: 'px' },
    { type: 'range', label: 'Pastilles', variable: '--swatch-size', min: 16, max: 48, value: 28, unit: 'px' },
  ]},
  { name: 'Layout', controls: [
    { type: 'range', label: 'Panel gauche', variable: '--side-width-left', min: 40, max: 300, value: 120, unit: 'px' },
    { type: 'range', label: 'Panel droit', variable: '--side-width-right', min: 40, max: 300, value: 120, unit: 'px' },
    { type: 'range', label: 'Pad toolbar', variable: '--toolbar-pad', min: 2, max: 20, value: 6, unit: 'px' },
    { type: 'range', label: 'Pad header', variable: '--header-pad', min: 2, max: 20, value: 8, unit: 'px' },
  ]},
  { name: 'Logo', controls: [
    { type: 'range', label: 'Taille', variable: '--logo-size', min: 100, max: 1000, step: 10, value: 500, unit: 'px' },
    { type: 'range', label: 'Opacite', variable: '--logo-opacity', min: 1, max: 20, value: 6, unit: '', divisor: 100 },
  ]},
]

const ALL_CSS_CONTROLS = CSS_CATEGORIES.flatMap(c => c.controls)
const LOCAL_CSS_KEY = 'artlequin_css_personal'
type ValuesMap = Record<string, number | string>

function getCssDefaults(): ValuesMap {
  const m: ValuesMap = {}
  for (const ctrl of ALL_CSS_CONTROLS) m[ctrl.variable] = ctrl.value
  return m
}

function applyAllVars(vals: ValuesMap) {
  for (const ctrl of ALL_CSS_CONTROLS) {
    const raw = vals[ctrl.variable]
    if (ctrl.type === 'color') {
      document.documentElement.style.setProperty(ctrl.variable, raw as string)
    } else {
      const num = raw as number
      const css = ctrl.divisor ? String(num / ctrl.divisor) : `${num}${ctrl.unit}`
      document.documentElement.style.setProperty(ctrl.variable, css)
    }
  }
}

/* ══════════════════════════════════════════
   Composant unifie
   ══════════════════════════════════════════ */

export function AdminPanel() {
  const [open, setOpen] = createSignal(false)
  const [tab, setTab] = createSignal<Tab>('colors')
  const [saving, setSaving] = createSignal(false)

  // ── CSS state ──
  const [cssValues, setCssValues] = createSignal<ValuesMap>(getCssDefaults())
  const [projectDefaults, setProjectDefaults] = createSignal<ValuesMap>(getCssDefaults())

  onMount(async () => {
    try {
      const res = await fetch('/defaults.json')
      if (res.ok) {
        const json = await res.json() as ValuesMap
        if (typeof json === 'object' && json !== null) setProjectDefaults(prev => ({ ...prev, ...json }))
      }
    } catch {}
    let finalValues = { ...projectDefaults() }
    const adminCss = adminData().css
    if (adminCss && Object.keys(adminCss).length > 0) finalValues = { ...finalValues, ...adminCss }
    try {
      const raw = localStorage.getItem(LOCAL_CSS_KEY)
      if (raw) {
        const personal = JSON.parse(raw) as ValuesMap
        if (typeof personal === 'object' && personal !== null) finalValues = { ...finalValues, ...personal }
      }
    } catch {}
    setCssValues(finalValues)
    applyAllVars(finalValues)
  })

  const updateCssVar = (ctrl: TweakControl, raw: number | string) => {
    if (ctrl.type === 'color') document.documentElement.style.setProperty(ctrl.variable, raw as string)
    else {
      const rc = ctrl as RangeControl
      document.documentElement.style.setProperty(ctrl.variable, rc.divisor ? String((raw as number) / rc.divisor) : `${raw}${rc.unit}`)
    }
    setCssValues(prev => ({ ...prev, [ctrl.variable]: raw }))
  }

  const displayCssValue = (ctrl: TweakControl) => {
    const raw = cssValues()[ctrl.variable]
    if (ctrl.type === 'color') return raw as string
    const rc = ctrl as RangeControl
    return rc.divisor ? ((raw as number) / rc.divisor).toFixed(2) : String(raw)
  }

  const handleCssSaveForAll = async () => {
    try {
      const res = await fetch('/api/save-defaults', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cssValues()) })
      adminSetCss(cssValues())
      await saveAdminData()
      if (res.ok) showToast('CSS sauvegarde pour tous !')
      else showToast('Erreur serveur — telecharge le fichier', true)
    } catch { showToast('Erreur de sauvegarde', true) }
  }

  const handleCssSavePerso = () => { localStorage.setItem(LOCAL_CSS_KEY, JSON.stringify(cssValues())); showToast('Preferences perso sauvegardees') }

  const handleCssReset = () => { const d = projectDefaults(); setCssValues({ ...d }); applyAllVars(d); localStorage.removeItem(LOCAL_CSS_KEY); showToast('Reinitialise') }

  // ── Color effect editing ──
  const [editingId, setEditingId] = createSignal<string | null>(null)
  const [editName, setEditName] = createSignal('')
  const [editColors, setEditColors] = createSignal<string[]>([])
  const [newName, setNewName] = createSignal('')
  const [newColors, setNewColors] = createSignal<string[]>([])

  const allColorEffects = () => {
    const base = Object.entries(COLOR_EFFECTS).map(([id, e]) => ({
      id, name: adminData().colorEffects[id]?.name ?? e.name,
      colors: adminData().colorEffects[id]?.colors ?? e.colors,
      isOverride: !!adminData().colorEffects[id], isCustom: false,
    }))
    const customIds = Object.keys(adminData().colorEffects).filter(id => !COLOR_EFFECTS[id])
    const custom = customIds.map(id => ({
      id, name: adminData().colorEffects[id].name,
      colors: adminData().colorEffects[id].colors,
      isOverride: false, isCustom: true,
    }))
    return [...base, ...custom]
  }

  const startEdit = (id: string, name: string, colors: string[]) => { setEditingId(id); setEditName(name); setEditColors([...colors]) }
  const confirmEdit = () => { const id = editingId(); if (!id) return; adminSetColorEffect(id, { name: editName(), colors: editColors() }); setEditingId(null) }

  const addNewEffect = () => {
    const name = newName().trim()
    if (!name || newColors().length === 0) return
    adminSetColorEffect(`admin-${Date.now()}`, { name, colors: newColors() })
    setNewName(''); setNewColors([])
  }

  // ── Emojis ──
  const [newEmoji, setNewEmoji] = createSignal('')
  const [newEmojiLabel, setNewEmojiLabel] = createSignal('')

  const allEmojis = () => {
    const base = DEFAULT_EMOJIS.map(e => ({ ...e, source: 'base' as const }))
    const admin = adminData().emojis.map(e => ({ ...e, source: 'admin' as const }))
    return [...base, ...admin]
  }

  const addAdminEmoji = () => {
    const emoji = newEmoji().trim(), label = newEmojiLabel().trim() || emoji
    if (!emoji) return
    adminAddEmoji({ id: `admin-emoji-${Date.now()}`, emoji, label })
    setNewEmoji(''); setNewEmojiLabel('')
  }

  // ── Global save ──
  const handleSave = async () => {
    setSaving(true)
    const ok = await saveAdminData()
    setSaving(false)
    if (ok) { showToast('Donnees admin sauvegardees !'); await loadAdminData() }
    else showToast('Erreur de sauvegarde', true)
  }

  return (
    <>
      {/* Roue ⚙ visible uniquement en admin */}
      <Show when={isAdmin()}>
        <button class={`admin-gear ${open() ? 'open' : ''}`} onClick={() => setOpen(!open())} title="Panneau admin">⚙</button>
      </Show>

      <Modal open={open()} onClose={() => setOpen(false)} title="Administration" description="Effets, emojis et interface" size="lg" zIndex={250}>
        <div class="admin-tabs">
          <button class={`catalog-tab ${tab() === 'colors' ? 'active' : ''}`} onClick={() => setTab('colors')}>Effets</button>
          <button class={`catalog-tab ${tab() === 'emojis' ? 'active' : ''}`} onClick={() => setTab('emojis')}>Emojis</button>
          <button class={`catalog-tab ${tab() === 'css' ? 'active' : ''}`} onClick={() => setTab('css')}>Interface CSS</button>
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
                          <For each={effect.colors}>{(c) => <span class="admin-color-dot" style={{ background: c }} />}</For>
                        </div>
                        <div class="admin-effect-actions">
                          <button class="btn tuto-btn" onClick={() => startEdit(effect.id, effect.name, effect.colors)}>Modifier</button>
                          <Show when={effect.isCustom || effect.isOverride}>
                            <button class="tuto-skip" onClick={() => adminRemoveColorEffect(effect.id)}>{effect.isCustom ? 'Supprimer' : 'Reset'}</button>
                          </Show>
                        </div>
                      </>
                    }>
                      <div class="admin-edit-form">
                        <input class="naming-input" value={editName()} onInput={(e) => setEditName(e.currentTarget.value)} placeholder="Nom" />
                        <div class="admin-edit-colors">
                          <For each={editColors()}>{(c, i) => <span class="admin-color-dot admin-color-dot-edit" style={{ background: c }} onClick={() => setEditColors(prev => prev.filter((_, idx) => idx !== i()))} title="Retirer" />}</For>
                          <div class="admin-add-color-wrap"><input type="color" value="#c42b45" onChange={(e) => setEditColors(prev => [...prev, e.currentTarget.value])} /></div>
                        </div>
                        <div class="admin-palette-quick">
                          <For each={VENETIAN_PALETTE}>{(c) => <span class="admin-color-dot" style={{ background: c.hex }} onClick={() => setEditColors(prev => [...prev, c.hex])} title={c.name} />}</For>
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
              <div class="admin-new-section">
                <span class="admin-section-label">Ajouter un effet couleur</span>
                <div class="admin-edit-form">
                  <input class="naming-input" value={newName()} onInput={(e) => setNewName(e.currentTarget.value)} placeholder="Nom du nouvel effet" />
                  <div class="admin-edit-colors">
                    <For each={newColors()}>{(c, i) => <span class="admin-color-dot admin-color-dot-edit" style={{ background: c }} onClick={() => setNewColors(prev => prev.filter((_, idx) => idx !== i()))} />}</For>
                    <div class="admin-add-color-wrap"><input type="color" value="#c42b45" onChange={(e) => setNewColors(prev => [...prev, e.currentTarget.value])} /></div>
                  </div>
                  <div class="admin-palette-quick">
                    <For each={VENETIAN_PALETTE}>{(c) => <span class="admin-color-dot" style={{ background: c.hex }} onClick={() => setNewColors(prev => [...prev, c.hex])} title={c.name} />}</For>
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
                        <button class="admin-emoji-remove" onClick={() => adminRemoveEmoji(entry.id)}>x</button>
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

          {/* ── Interface CSS ── */}
          <Show when={tab() === 'css'}>
            <div class="admin-css-actions">
              <button class="btn" style={{ "font-size": "var(--font-sm)", padding: "4px 12px", background: "var(--mint)" }} onClick={handleCssSaveForAll}>Appliquer pour tous</button>
              <button class="btn" style={{ "font-size": "var(--font-sm)", padding: "4px 12px", background: "var(--lavender)" }} onClick={handleCssSavePerso}>Sauver perso</button>
              <button class="btn" style={{ "font-size": "var(--font-sm)", padding: "4px 12px" }} onClick={handleCssReset}>Reinitialiser</button>
            </div>
            <div class="tweaker-categories">
              <For each={CSS_CATEGORIES}>
                {(cat, catIdx) => {
                  const [catOpen, setCatOpen] = createSignal(catIdx() === 0)
                  return (
                    <div>
                      <button class="tweaker-category-toggle" onClick={() => setCatOpen(!catOpen())}>
                        <span class={`tweaker-arrow ${catOpen() ? 'open' : ''}`}>&#9656;</span>
                        <span class="tweaker-category-title">{cat.name}</span>
                      </button>
                      <Show when={catOpen()}>
                        <div class="tweaker-category-grid">
                          <For each={cat.controls}>
                            {(ctrl) => (
                              <div class="tweaker-control">
                                <label>{ctrl.label}</label>
                                {ctrl.type === 'color' ? (
                                  <div class="tweak-row">
                                    <div class="tweak-color-wrapper">
                                      <div class="tweak-color-swatch" style={{ background: cssValues()[ctrl.variable] as string }} />
                                      <input type="color" value={cssValues()[ctrl.variable] as string} onInput={(e) => updateCssVar(ctrl, e.currentTarget.value)} />
                                    </div>
                                    <span class="tweak-val tweak-val-color">{(cssValues()[ctrl.variable] as string).toUpperCase()}</span>
                                  </div>
                                ) : (
                                  <div class="tweak-row">
                                    <input type="range" min={(ctrl as RangeControl).min} max={(ctrl as RangeControl).max} step={(ctrl as RangeControl).step ?? 1} value={cssValues()[ctrl.variable] as number} onInput={(e) => updateCssVar(ctrl, parseFloat(e.currentTarget.value))} />
                                    <span class="tweak-val">{displayCssValue(ctrl)}</span>
                                  </div>
                                )}
                              </div>
                            )}
                          </For>
                        </div>
                      </Show>
                    </div>
                  )
                }}
              </For>
            </div>
          </Show>
        </div>

        <div class="admin-footer">
          <button class="btn btn-lavender" onClick={handleSave} disabled={saving()}>{saving() ? 'Sauvegarde...' : 'Sauvegarder tout'}</button>
          <span class="admin-footer-hint">Persiste dans public/admin-data.json</span>
        </div>
      </Modal>
    </>
  )
}
