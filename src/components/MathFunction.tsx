import { createSignal, createEffect, For } from 'solid-js'
import { evaluateMathExprSafe } from '../engine/effects'
import { baseSize } from '../stores/editor'
import { PREVIEW_SHORT } from '../data/preview'

interface Props {
  onApply: (profile: number[], expr: string, params: { a: number; b: number; c: number }) => void
}

const PREVIEW_TEXT = PREVIEW_SHORT

const FUNC_BUTTONS = [
  { label: 'sin', insert: 'sin(' },
  { label: 'cos', insert: 'cos(' },
  { label: 'tan', insert: 'tan(' },
  { label: 'abs', insert: 'abs(' },
  { label: 'sqrt', insert: 'sqrt(' },
  { label: 'log', insert: 'log(' },
  { label: 'exp', insert: 'exp(' },
  { label: 'x²', insert: 'x^2' },
  { label: 'x³', insert: 'x^3' },
  { label: '1/x', insert: '1/x' },
]

const OP_BUTTONS = [
  { label: '+', insert: '+' },
  { label: '-', insert: '-' },
  { label: '*', insert: '*' },
  { label: '/', insert: '/' },
  { label: '^', insert: '^' },
  { label: '(', insert: '(' },
  { label: ')', insert: ')' },
  { label: 'x', insert: 'x' },
]

import { CANVAS_BG, CANVAS_GRID, CANVAS_CURVE, CANVAS_MIDLINE, CANVAS_FILL } from '../data/canvas-theme'

export function MathFunction(props: Props) {
  let inputRef!: HTMLInputElement
  let curveRef!: HTMLCanvasElement

  const [expr, setExpr] = createSignal('sin(x)')
  const [a, setA] = createSignal(40)   // amplitude en px
  const [b, setB] = createSignal(6.3)  // etendue du domaine (x va de c a c+b)
  const [c, setC] = createSignal(0)    // debut du domaine

  /** Calcule la taille de chaque lettre — a = amplitude (maxAdd) */
  const getLetterSizes = (): number[] => {
    const prof = getProfile() // [0, 1] normalisé
    const letters = [...PREVIEW_TEXT].filter(ch => ch !== ' ')
    const n = letters.length
    const amplitude = a() // a controle l'amplitude en px
    return letters.map((_, i) => {
      const t = n === 1 ? 0 : i / (n - 1)
      const pIdx = t * (prof.length - 1)
      const lo = Math.floor(pIdx)
      const hi = Math.min(lo + 1, prof.length - 1)
      const frac = pIdx - lo
      const value = prof[lo] * (1 - frac) + prof[hi] * frac
      return Math.max(8, Math.round(baseSize() + value * amplitude))
    })
  }

  /** Dessine la courbe f(x) sur le canvas */
  const drawCurve = () => {
    const ctx = curveRef?.getContext('2d')
    if (!ctx) return
    const w = curveRef.width
    const h = curveRef.height
    const pad = 6
    const samples = 100

    ctx.clearRect(0, 0, w, h)
    ctx.fillStyle = CANVAS_BG
    ctx.fillRect(0, 0, w, h)

    // Grille
    ctx.strokeStyle = CANVAS_GRID
    ctx.lineWidth = 1
    for (let y = 0; y < h; y += 25) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke()
    }

    // Ligne mediane
    ctx.strokeStyle = CANVAS_MIDLINE
    ctx.globalAlpha = 0.5
    ctx.setLineDash([6, 4])
    ctx.beginPath(); ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2); ctx.stroke()
    ctx.setLineDash([])
    ctx.globalAlpha = 1

    // Calculer les valeurs — meme domaine que getProfile: x ∈ [c, c+b]
    const values: number[] = []
    for (let i = 0; i < samples; i++) {
      const t = i / (samples - 1)
      const x = c() + t * b()
      values.push(evaluateMathExprSafe(expr(), x))
    }

    const minV = Math.min(...values)
    const maxV = Math.max(...values)
    const range = maxV - minV || 1

    // Courbe
    ctx.beginPath()
    ctx.strokeStyle = CANVAS_CURVE
    ctx.lineWidth = 3
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'

    for (let i = 0; i < samples; i++) {
      const x = pad + (i / (samples - 1)) * (w - 2 * pad)
      const norm = (values[i] - minV) / range
      const y = pad + (1 - norm) * (h - 2 * pad)
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()

    // Remplissage sous la courbe
    ctx.lineTo(pad + (w - 2 * pad), h - pad)
    ctx.lineTo(pad, h - pad)
    ctx.closePath()
    ctx.fillStyle = CANVAS_FILL
    ctx.fill()
  }

  createEffect(() => {
    expr(); a(); b(); c()
    drawCurve()
  })

  /** HTML de preview — même format que applySizeProfile */
  const previewHtml = (): string => {
    const sizes = getLetterSizes()
    const chars = [...PREVIEW_TEXT].filter(ch => ch !== ' ')
    return chars.map((ch, i) =>
      `<span style="font-size:${sizes[i]}px">${ch}</span>`
    ).join('')
  }

  /** Genere un profil [0,1] — x parcourt [c, c+b] pour que b = etendue visible */
  const getProfile = (): number[] => {
    const samples = 50
    const raw: number[] = []
    for (let i = 0; i < samples; i++) {
      const t = i / (samples - 1)           // t ∈ [0, 1]
      const x = c() + t * b()               // x ∈ [c, c+b]
      raw.push(evaluateMathExprSafe(expr(), x))
    }
    const min = Math.min(...raw)
    const max = Math.max(...raw)
    const range = max - min || 1
    return raw.map(v => (v - min) / range)
  }

  const insertAtCursor = (text: string) => {
    const input = inputRef
    if (!input) return
    const start = input.selectionStart ?? input.value.length
    const end = input.selectionEnd ?? start
    const newVal = input.value.slice(0, start) + text + input.value.slice(end)
    setExpr(newVal)
    requestAnimationFrame(() => {
      const pos = start + text.length
      input.setSelectionRange(pos, pos)
      input.focus()
    })
  }

  return (
    <div class="math-container">
      {/* Formule */}
      <div class="math-formula">
        <span class="math-formula-f">f</span>
        <span class="math-formula-paren">(x)</span>
        <span class="math-formula-dot">&ensp;x ∈ [</span>
        <span class="math-formula-c">c</span>
        <span class="math-formula-dot">, c+</span>
        <span class="math-formula-b">b</span>
        <span class="math-formula-dot">]&ensp;×&ensp;</span>
        <span class="math-formula-a">a</span>
        <span class="math-formula-dot">px</span>
      </div>

      {/* Preview WYSIWYG — même rendu que les effets de taille */}
      <div class="math-text-preview" innerHTML={previewHtml()} />

      {/* Courbe f(x) */}
      <canvas
        ref={curveRef}
        class="math-curve-canvas"
        width={800}
        height={160}
      />

      {/* Input */}
      <div class="math-input-row">
        <span class="math-input-prefix">f(x) =</span>
        <input
          ref={inputRef}
          class="math-input"
          type="text"
          value={expr()}
          onInput={(e) => setExpr(e.currentTarget.value)}
          placeholder="sin(x), x^2, cos(2*x)..."
        />
      </div>

      {/* Boutons de fonctions */}
      <div class="math-btn-grid">
        <For each={FUNC_BUTTONS}>
          {(btn) => (
            <button class="math-btn math-btn-func" onClick={() => insertAtCursor(btn.insert)}>
              {btn.label}
            </button>
          )}
        </For>
      </div>
      <div class="math-btn-grid">
        <For each={OP_BUTTONS}>
          {(btn) => (
            <button class="math-btn math-btn-op" onClick={() => insertAtCursor(btn.insert)}>
              {btn.label}
            </button>
          )}
        </For>
      </div>

      {/* Sliders a, b, c */}
      <div class="math-params">
        <div class="math-param">
          <span class="math-param-name" title="Amplitude en pixels">a</span>
          <input type="range" min="5" max="80" step="1" value={a()} onInput={(e) => setA(parseFloat(e.currentTarget.value))} />
          <span class="math-param-val">{a().toFixed(0)}px</span>
        </div>
        <div class="math-param">
          <span class="math-param-name" title="Etendue : x va de c a c+b">b</span>
          <input type="range" min="0.5" max="20" step="0.1" value={b()} onInput={(e) => setB(parseFloat(e.currentTarget.value))} />
          <span class="math-param-val">{b().toFixed(1)}</span>
        </div>
        <div class="math-param">
          <span class="math-param-name" title="Debut du domaine">c</span>
          <input type="range" min="-10" max="10" step="0.1" value={c()} onInput={(e) => setC(parseFloat(e.currentTarget.value))} />
          <span class="math-param-val">{c().toFixed(1)}</span>
        </div>
      </div>

      <button class="btn btn-lavender" onClick={() => props.onApply(getProfile(), expr(), { a: a(), b: b(), c: c() })}>
        Enregistrer
      </button>
    </div>
  )
}
