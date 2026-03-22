import { createSignal, For, onMount } from 'solid-js'
import { showToast } from './Toast'

/* ══════════════════════════════════════════
   Types
   ══════════════════════════════════════════ */

interface RangeControl {
  type: 'range'
  label: string
  variable: string
  min: number
  max: number
  step?: number
  value: number
  unit: string
  divisor?: number
}

interface ColorControl {
  type: 'color'
  label: string
  variable: string
  value: string
}

type TweakControl = RangeControl | ColorControl

interface Category {
  name: string
  controls: TweakControl[]
}

/* ══════════════════════════════════════════
   Catégories de contrôles
   Organisées par domaine, factorisées au max
   ══════════════════════════════════════════ */

const CATEGORIES: Category[] = [
  {
    name: 'Couleurs — Accents',
    controls: [
      { type: 'color', label: 'Lavande', variable: '--lavender', value: '#c4b5fd' },
      { type: 'color', label: 'Pêche', variable: '--peach', value: '#fdba74' },
      { type: 'color', label: 'Menthe', variable: '--mint', value: '#86efac' },
      { type: 'color', label: 'Ombre', variable: '--shadow-color', value: '#c4b5fd' },
    ],
  },
  {
    name: 'Couleurs — Base',
    controls: [
      { type: 'color', label: 'Texte', variable: '--soft-black', value: '#374151' },
      { type: 'color', label: 'Fond page', variable: '--bg', value: '#faf9f7' },
      { type: 'color', label: 'Fond blanc', variable: '--white', value: '#ffffff' },
      { type: 'color', label: 'Atténué', variable: '--muted', value: '#9ca3af' },
      { type: 'color', label: 'Séparateur', variable: '--separator', value: '#e5e7eb' },
    ],
  },
  {
    name: 'Typographie',
    controls: [
      { type: 'range', label: 'XS', variable: '--font-xs', min: 6, max: 16, value: 9, unit: 'px' },
      { type: 'range', label: 'SM', variable: '--font-sm', min: 8, max: 18, value: 12, unit: 'px' },
      { type: 'range', label: 'MD', variable: '--font-md', min: 10, max: 22, value: 14, unit: 'px' },
      { type: 'range', label: 'LG', variable: '--font-lg', min: 12, max: 30, value: 18, unit: 'px' },
      { type: 'range', label: 'Éditeur', variable: '--font-editor', min: 12, max: 36, value: 18, unit: 'px' },
    ],
  },
  {
    name: 'Bordures & Rayons',
    controls: [
      { type: 'range', label: 'Épaisseur', variable: '--border', min: 1, max: 8, value: 3, unit: 'px' },
      { type: 'range', label: 'Rayon S', variable: '--radius-sm', min: 0, max: 24, value: 8, unit: 'px' },
      { type: 'range', label: 'Rayon M', variable: '--radius-md', min: 0, max: 32, value: 12, unit: 'px' },
      { type: 'range', label: 'Rayon L', variable: '--radius-lg', min: 0, max: 48, value: 20, unit: 'px' },
    ],
  },
  {
    name: 'Ombres',
    controls: [
      { type: 'range', label: 'Décalage X', variable: '--shadow-x', min: 0, max: 16, value: 5, unit: 'px' },
      { type: 'range', label: 'Décalage Y', variable: '--shadow-y', min: 0, max: 16, value: 5, unit: 'px' },
    ],
  },
  {
    name: 'Tailles elements',
    controls: [
      { type: 'range', label: 'Boutons', variable: '--btn-size', min: 24, max: 56, value: 38, unit: 'px' },
      { type: 'range', label: 'Pastilles', variable: '--swatch-size', min: 16, max: 48, value: 28, unit: 'px' },
    ],
  },
  {
    name: 'Layout',
    controls: [
      { type: 'range', label: 'Panel gauche', variable: '--side-width-left', min: 40, max: 300, value: 120, unit: 'px' },
      { type: 'range', label: 'Panel droit', variable: '--side-width-right', min: 40, max: 300, value: 120, unit: 'px' },
      { type: 'range', label: 'Pad toolbar', variable: '--toolbar-pad', min: 2, max: 20, value: 6, unit: 'px' },
      { type: 'range', label: 'Pad header', variable: '--header-pad', min: 2, max: 20, value: 8, unit: 'px' },
    ],
  },
  {
    name: 'Logo',
    controls: [
      { type: 'range', label: 'Taille', variable: '--logo-size', min: 100, max: 1000, step: 10, value: 500, unit: 'px' },
      { type: 'range', label: 'Opacité', variable: '--logo-opacity', min: 1, max: 20, value: 6, unit: '', divisor: 100 },
    ],
  },
]

/* ══════════════════════════════════════════
   Helpers
   ══════════════════════════════════════════ */

const ALL_CONTROLS = CATEGORIES.flatMap(c => c.controls)
const LOCAL_KEY = 'artlequin_css_personal'

type ValuesMap = Record<string, number | string>

function getDefaults(): ValuesMap {
  const m: ValuesMap = {}
  for (const ctrl of ALL_CONTROLS) {
    m[ctrl.variable] = ctrl.value
  }
  return m
}

function applyAllVars(vals: ValuesMap) {
  for (const ctrl of ALL_CONTROLS) {
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
   Composant
   ══════════════════════════════════════════ */

export function CssTweaker() {
  const [open, setOpen] = createSignal(false)
  const [values, setValues] = createSignal<ValuesMap>(getDefaults())
  const [projectDefaults, setProjectDefaults] = createSignal<ValuesMap>(getDefaults())

  onMount(async () => {
    // Charger defaults projet
    try {
      const res = await fetch('/defaults.json')
      if (res.ok) {
        const json = await res.json() as ValuesMap
        if (typeof json === 'object' && json !== null) {
          setProjectDefaults(prev => ({ ...prev, ...json }))
        }
      }
    } catch { /* ignore */ }

    // Charger préférences perso (priorité sur defaults)
    let finalValues = { ...projectDefaults() }
    try {
      const raw = localStorage.getItem(LOCAL_KEY)
      if (raw) {
        const personal = JSON.parse(raw) as ValuesMap
        if (typeof personal === 'object' && personal !== null) {
          finalValues = { ...finalValues, ...personal }
        }
      }
    } catch { /* ignore */ }

    setValues(finalValues)
    applyAllVars(finalValues)
  })

  const updateVar = (ctrl: TweakControl, raw: number | string) => {
    if (ctrl.type === 'color') {
      document.documentElement.style.setProperty(ctrl.variable, raw as string)
    } else {
      const rc = ctrl as RangeControl
      const css = rc.divisor ? String((raw as number) / rc.divisor) : `${raw}${rc.unit}`
      document.documentElement.style.setProperty(ctrl.variable, css)
    }
    setValues(prev => ({ ...prev, [ctrl.variable]: raw }))
  }

  const displayValue = (ctrl: TweakControl) => {
    const raw = values()[ctrl.variable]
    if (ctrl.type === 'color') return raw as string
    const rc = ctrl as RangeControl
    return rc.divisor ? ((raw as number) / rc.divisor).toFixed(2) : String(raw)
  }

  const handleSavePersonal = () => {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(values()))
    showToast('Préférences perso sauvegardées')
  }

  const handleReset = () => {
    const defs = projectDefaults()
    setValues({ ...defs })
    applyAllVars(defs)
    localStorage.removeItem(LOCAL_KEY)
    showToast('Réinitialisé aux valeurs du projet')
  }

  const handleSaveForAll = async () => {
    try {
      const res = await fetch('/api/save-defaults', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values()),
      })
      if (res.ok) {
        showToast('Défauts sauvegardés pour tous !')
      } else {
        const blob = new Blob([JSON.stringify(values(), null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url; a.download = 'defaults.json'; a.click()
        URL.revokeObjectURL(url)
        showToast('Fichier téléchargé (remplacez public/defaults.json)')
      }
    } catch {
      showToast('Erreur de sauvegarde', true)
    }
  }

  return (
    <>
      <button class={`tweaker-gear ${open() ? 'open' : ''}`} onClick={() => setOpen(!open())} title="Réglages CSS">⚙</button>

      <div class={`tweaker-panel ${open() ? 'open' : ''}`}>
        <div class="tweaker-header">
          <span class="tweaker-title">Réglages d'interface</span>
          <div style={{ display: 'flex', gap: '6px', "flex-wrap": 'wrap' }}>
            <button class="btn" style={{ "font-size": "var(--font-sm)", padding: "4px 12px", background: "var(--mint)" }} onClick={handleSaveForAll}>
              Appliquer pour tous
            </button>
            <button class="btn" style={{ "font-size": "var(--font-sm)", padding: "4px 12px", background: "var(--lavender)" }} onClick={handleSavePersonal}>
              Sauver perso
            </button>
            <button class="btn" style={{ "font-size": "var(--font-sm)", padding: "4px 12px" }} onClick={handleReset}>
              Réinitialiser
            </button>
            <button class="btn" style={{ "font-size": "var(--font-sm)", padding: "4px 12px" }} onClick={() => setOpen(false)}>
              Fermer
            </button>
          </div>
        </div>

        <div class="tweaker-categories">
          <For each={CATEGORIES}>
            {(cat) => (
              <div class="tweaker-category">
                <div class="tweaker-category-title">{cat.name}</div>
                <div class="tweaker-category-grid">
                  <For each={cat.controls}>
                    {(ctrl) => (
                      <div class="tweaker-control">
                        <label>{ctrl.label}</label>
                        {ctrl.type === 'color' ? (
                          <div class="tweak-row tweak-row-color">
                            <div class="tweak-color-wrapper">
                              <div class="tweak-color-swatch" style={{ background: values()[ctrl.variable] as string }} />
                              <input
                                type="color"
                                value={values()[ctrl.variable] as string}
                                onInput={(e) => updateVar(ctrl, e.currentTarget.value)}
                              />
                            </div>
                            <span class="tweak-val tweak-val-color">{(values()[ctrl.variable] as string).toUpperCase()}</span>
                          </div>
                        ) : (
                          <div class="tweak-row">
                            <input
                              type="range"
                              min={(ctrl as RangeControl).min}
                              max={(ctrl as RangeControl).max}
                              step={(ctrl as RangeControl).step ?? 1}
                              value={values()[ctrl.variable] as number}
                              onInput={(e) => updateVar(ctrl, parseFloat(e.currentTarget.value))}
                            />
                            <span class="tweak-val">{displayValue(ctrl)}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </For>
                </div>
              </div>
            )}
          </For>
        </div>
      </div>
    </>
  )
}
