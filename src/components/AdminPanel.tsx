import { createSignal, For, Show, onMount } from 'solid-js'
import { Modal } from './Modal'
import { isAdmin } from '../stores/admin'
import {
  adminData, saveAdminData, loadAdminData,
  adminSetColorEffect, adminRemoveColorEffect, adminHideColorEffect, adminUnhideColorEffect,
  adminRenameSizeEffect,
  adminAddEmoji, adminRemoveEmoji, adminUpdateEmoji,
  adminToggleHideEmoji, adminIsEmojiHidden, adminRenameEmoji,
  adminSetCss, isColorEffectDirty,
  type AdminColorEffect, type AdminEmoji,
} from '../stores/admin-data'
import { COLOR_EFFECTS, SIZE_EFFECTS } from '../engine/effects'
import { sparklineFromFn } from '../engine/sparkline'
import { SIZE_ACCENTS } from '../data/accents'
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

  const handleCssReset = () => { const d = projectDefaults(); setCssValues({ ...d }); applyAllVars(d); localStorage.removeItem(LOCAL_CSS_KEY); showToast('Reinitialise') }

  // ── Color effect editing ──
  const [editingId, setEditingId] = createSignal<string | null>(null)
  const [editName, setEditName] = createSignal('')
  const [editColors, setEditColors] = createSignal<string[]>([])
  const [addingEffect, setAddingEffect] = createSignal(false)

  const allColorEffects = () => {
    const hidden = new Set(adminData().hiddenColorEffects)
    const base = Object.entries(COLOR_EFFECTS).map(([id, e]) => ({
      id, name: adminData().colorEffects[id]?.name ?? e.name,
      colors: adminData().colorEffects[id]?.colors ?? e.colors,
      isDirty: isColorEffectDirty(id), isCustom: false, isHidden: hidden.has(id),
    }))
    const customIds = Object.keys(adminData().colorEffects).filter(id => !COLOR_EFFECTS[id])
    const custom = customIds.map(id => ({
      id, name: adminData().colorEffects[id].name,
      colors: adminData().colorEffects[id].colors,
      isDirty: isColorEffectDirty(id), isCustom: true, isHidden: hidden.has(id),
    }))
    return [...base, ...custom]
  }

  const deleteEffect = (id: string, isCustom: boolean) => {
    if (isCustom) {
      adminRemoveColorEffect(id)
    } else {
      adminHideColorEffect(id)
    }
  }

  const startEdit = (id: string, name: string, colors: string[]) => {
    setEditingId(id); setEditName(name); setEditColors([...colors])
  }
  const confirmEdit = () => {
    const id = editingId()
    if (!id) return
    adminSetColorEffect(id, { name: editName(), colors: editColors() })
    setEditingId(null)
  }

  const startAddEffect = () => {
    setAddingEffect(true); setEditName(''); setEditColors([])
  }
  const confirmAddEffect = () => {
    const name = editName().trim()
    if (!name || editColors().length === 0) return
    adminSetColorEffect(`admin-${Date.now()}`, { name, colors: editColors() })
    setAddingEffect(false)
  }

  // ── Emojis ──
  const [newEmoji, setNewEmoji] = createSignal('')
  const [newEmojiLabel, setNewEmojiLabel] = createSignal('')
  const [editingEmojiId, setEditingEmojiId] = createSignal<string | null>(null)
  const [editEmojiLabel, setEditEmojiLabel] = createSignal('')

  const allEmojis = () => {
    const data = adminData()
    const base = DEFAULT_EMOJIS.map(e => ({
      ...e,
      label: data.emojiOverrides[e.id]?.label ?? e.label,
      source: 'base' as const,
      hidden: data.hiddenEmojis.includes(e.id),
    }))
    const admin = data.emojis.map(e => ({
      ...e,
      source: 'admin' as const,
      hidden: data.hiddenEmojis.includes(e.id),
    }))
    return [...base, ...admin]
  }

  const addAdminEmoji = () => {
    const emoji = newEmoji().trim(), label = newEmojiLabel().trim() || emoji
    if (!emoji) return
    adminAddEmoji({ id: `admin-emoji-${Date.now()}`, emoji, label })
    setNewEmoji(''); setNewEmojiLabel('')
  }

  const startEmojiEdit = (id: string, label: string) => {
    setEditingEmojiId(id)
    setEditEmojiLabel(label)
  }

  const confirmEmojiEdit = () => {
    const id = editingEmojiId()
    if (!id) return
    const label = editEmojiLabel().trim()
    // Base emoji → override, admin emoji → update
    const isBase = DEFAULT_EMOJIS.some(e => e.id === id)
    if (isBase) {
      const original = DEFAULT_EMOJIS.find(e => e.id === id)!
      adminRenameEmoji(id, label === original.label ? '' : label)
    } else {
      adminUpdateEmoji(id, { label })
    }
    setEditingEmojiId(null)
  }

  // ── Global save ──
  const handleSave = async () => {
    setSaving(true)
    // Sync CSS tweaker → adminData avant de sauver
    adminSetCss(cssValues())
    // Sauver aussi les CSS defaults
    try {
      await fetch('/api/save-defaults', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cssValues()) })
    } catch {}
    const ok = await saveAdminData()
    setSaving(false)
    if (ok) showToast('Donnees admin sauvegardees !')
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
                  <div class={`admin-effect-row ${effect.isCustom ? 'admin-custom' : ''} ${effect.isHidden ? 'admin-effect-hidden' : ''}`}>
                    <Show when={editingId() === effect.id} fallback={
                      <>
                        <span class="admin-effect-name">
                          {effect.name}
                          <Show when={effect.isDirty}><span class="admin-modified-badge">non sauve</span></Show>
                          <Show when={effect.isCustom}><span class="admin-custom-badge">admin</span></Show>
                        </span>
                        <div class="admin-color-preview">
                          <For each={effect.colors}>{(c) => <span class="admin-color-dot" style={{ background: c }} />}</For>
                        </div>
                        <div class="admin-effect-actions">
                          <Show when={!effect.isHidden}>
                            <button class="btn admin-btn" onClick={() => startEdit(effect.id, effect.name, effect.colors)}>Modifier</button>
                            <button class="admin-btn-danger" onClick={() => deleteEffect(effect.id, effect.isCustom)}>Supprimer</button>
                          </Show>
                          <Show when={effect.isHidden}>
                            <button class="btn admin-btn" onClick={() => adminUnhideColorEffect(effect.id)}>Restaurer</button>
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
                          <button class="btn btn-lavender admin-btn" onClick={confirmEdit}>OK</button>
                          <button class="btn admin-btn" onClick={() => setEditingId(null)}>Annuler</button>
                        </div>
                      </div>
                    </Show>
                  </div>
                )}
              </For>

              {/* Ajouter un effet — inline, même UI que l'édition */}
              <Show when={!addingEffect()}>
                <button class="admin-add-effect-btn" onClick={startAddEffect}>+ Ajouter un effet couleur</button>
              </Show>
              <Show when={addingEffect()}>
                <div class="admin-effect-row admin-custom">
                  <div class="admin-edit-form">
                      <input class="naming-input" value={editName()} onInput={(e) => setEditName(e.currentTarget.value)} placeholder="Nom de l'effet" autofocus />
                    <div class="admin-edit-colors">
                      <For each={editColors()}>{(c, i) => <span class="admin-color-dot admin-color-dot-edit" style={{ background: c }} onClick={() => setEditColors(prev => prev.filter((_, idx) => idx !== i()))} title="Retirer" />}</For>
                      <div class="admin-add-color-wrap"><input type="color" value="#c42b45" onChange={(e) => setEditColors(prev => [...prev, e.currentTarget.value])} /></div>
                    </div>
                    <div class="admin-palette-quick">
                      <For each={VENETIAN_PALETTE}>{(c) => <span class="admin-color-dot" style={{ background: c.hex }} onClick={() => setEditColors(prev => [...prev, c.hex])} title={c.name} />}</For>
                    </div>
                    <div class="admin-edit-actions">
                      <button class="btn btn-lavender admin-btn" onClick={confirmAddEffect} disabled={!editName().trim() || editColors().length === 0}>Ajouter</button>
                      <button class="btn admin-btn" onClick={() => setAddingEffect(false)}>Annuler</button>
                    </div>
                  </div>
                </div>
              </Show>

              {/* ── Effets taille ── */}
              <div class="admin-section-label" style={{ "margin-top": "20px" }}>Effets de taille</div>
              <For each={Object.entries(SIZE_EFFECTS)}>
                {([id, effect]) => {
                  const [editing, setEditing] = createSignal(false)
                  const [name, setName] = createSignal(adminData().sizeEffectNames[id] ?? effect.name)
                  const path = () => sparklineFromFn((t) => effect.getShape(t))
                  const accent = () => SIZE_ACCENTS[id] ?? 'var(--lavender)'
                  const isRenamed = () => !!adminData().sizeEffectNames[id]
                  return (
                    <div class="admin-effect-row">
                      <Show when={editing()} fallback={
                        <>
                          <span class="admin-effect-name">
                            {adminData().sizeEffectNames[id] ?? effect.name}
                            <Show when={isRenamed()}><span class="admin-modified-badge">renomme</span></Show>
                          </span>
                          <svg class="admin-sparkline" viewBox="0 0 100 24" preserveAspectRatio="none">
                            <path d={path()} fill="none" stroke={accent()} stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
                          </svg>
                          <div class="admin-effect-actions">
                            <button class="btn admin-btn" onClick={() => setEditing(true)}>Renommer</button>
                            <Show when={isRenamed()}>
                              <button class="admin-btn-danger" onClick={() => { adminRenameSizeEffect(id, ''); setName(effect.name) }}>Reset</button>
                            </Show>
                          </div>
                        </>
                      }>
                        <div class="admin-edit-form" style={{ "flex-direction": "row", "align-items": "center", gap: "8px" }}>
                          <input class="naming-input" value={name()} onInput={(e) => setName(e.currentTarget.value)} style={{ flex: "1" }} />
                          <button class="btn btn-lavender admin-btn" onClick={() => { adminRenameSizeEffect(id, name()); setEditing(false) }}>OK</button>
                          <button class="btn admin-btn" onClick={() => { setName(adminData().sizeEffectNames[id] ?? effect.name); setEditing(false) }}>Annuler</button>
                        </div>
                      </Show>
                    </div>
                  )
                }}
              </For>
            </div>
          </Show>

          {/* ── Emojis ── */}
          <Show when={tab() === 'emojis'}>
            <div class="admin-section">
              <div class="admin-emoji-list">
                <For each={allEmojis()}>
                  {(entry) => (
                    <div class={`admin-emoji-row ${entry.hidden ? 'admin-emoji-hidden' : ''}`}>
                      <Show when={editingEmojiId() === entry.id} fallback={
                        <>
                          <span class="admin-emoji-char">{entry.emoji}</span>
                          <span class="admin-emoji-label">
                            {entry.label}
                            <Show when={entry.source === 'admin'}><span class="admin-custom-badge">admin</span></Show>
                            <Show when={entry.source === 'base' && !!adminData().emojiOverrides[entry.id]}><span class="admin-modified-badge">renomme</span></Show>
                          </span>
                          <div class="admin-emoji-actions">
                            <button
                              class="admin-emoji-action-btn"
                              onClick={() => startEmojiEdit(entry.id, entry.label)}
                              title="Renommer"
                            >✏️</button>
                            <button
                              class={`admin-emoji-action-btn ${entry.hidden ? 'admin-emoji-show-btn' : ''}`}
                              onClick={() => adminToggleHideEmoji(entry.id)}
                              title={entry.hidden ? 'Afficher' : 'Masquer'}
                            >{entry.hidden ? '👁️' : '👁️‍🗨️'}</button>
                            <Show when={entry.source === 'admin'}>
                              <button
                                class="admin-emoji-action-btn admin-emoji-delete-btn"
                                onClick={() => adminRemoveEmoji(entry.id)}
                                title="Supprimer"
                              >✕</button>
                            </Show>
                            <Show when={entry.source === 'base' && !!adminData().emojiOverrides[entry.id]}>
                              <button
                                class="admin-emoji-action-btn"
                                onClick={() => adminRenameEmoji(entry.id, '')}
                                title="Reset nom"
                              >↩</button>
                            </Show>
                          </div>
                        </>
                      }>
                        <span class="admin-emoji-char">{entry.emoji}</span>
                        <div class="admin-emoji-edit-form">
                          <input
                            class="naming-input"
                            value={editEmojiLabel()}
                            onInput={(e) => setEditEmojiLabel(e.currentTarget.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') confirmEmojiEdit(); if (e.key === 'Escape') setEditingEmojiId(null) }}
                            placeholder="Nom"
                            autofocus
                          />
                          <button class="btn btn-lavender admin-emoji-action-btn" onClick={confirmEmojiEdit}>OK</button>
                          <button class="btn admin-emoji-action-btn" onClick={() => setEditingEmojiId(null)}>Annuler</button>
                        </div>
                      </Show>
                    </div>
                  )}
                </For>
              </div>
              <div class="admin-new-section">
                <span class="admin-section-label">Ajouter un emoji</span>
                <div class="admin-emoji-add-row">
                  <input class="naming-input" value={newEmoji()} onInput={(e) => setNewEmoji(e.currentTarget.value)} placeholder="😀" style={{ width: '64px', "font-size": '1.4rem', "text-align": 'center' }} />
                  <input class="naming-input" value={newEmojiLabel()} onInput={(e) => setNewEmojiLabel(e.currentTarget.value)} placeholder="Label" style={{ flex: '1' }}
                    onKeyDown={(e) => { if (e.key === 'Enter') addAdminEmoji() }}
                  />
                  <button class="btn btn-lavender admin-btn" onClick={addAdminEmoji} disabled={!newEmoji().trim()}>Ajouter</button>
                </div>
                <span class="admin-emoji-hint">Collez un emoji dans le champ ou utilisez le clavier emoji de votre appareil</span>
              </div>
            </div>
          </Show>

          {/* ── Interface CSS ── */}
          <Show when={tab() === 'css'}>
            <div class="admin-css-actions">
              <button class="btn admin-btn" onClick={handleCssReset}>Reinitialiser les CSS</button>
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
