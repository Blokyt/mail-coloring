import { createSignal, createEffect, For } from 'solid-js'
import { evaluateMathExprSafe, normalizeProfile } from '../engine/effects'
import { baseSize, sizeAmplitude } from '../stores/editor'
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
  const [b, setB] = createSignal(6.3)  // etendue visible (6.3 ≈ 2π pour sin)
  const [c, setC] = createSignal(0)    // debut du domaine

  /**
   * Formule : fontSize(i) = baseSize + offset(i)
   * offset normalisé via normalizeProfile : min→0, max→amplitude.
   * Params utilisateur : amplitude (toolbar), b, c.
   */

  /** Profil = offsets normalisés pour 50 samples sur [0, n-1] */
  const getProfile = (): number[] => {
    const n = [...PREVIEW_TEXT].filter(ch => ch !== ' ').length
    const samples = 50
    const raw = Array.from({ length: samples }, (_, s) => {
      const i = (s / (samples - 1)) * (n - 1)
      return evaluateMathExprSafe(expr(), b() * (i - c()))
    })
    return normalizeProfile(raw, sizeAmplitude())
  }

  /** Preview normalisée : la plus grande lettre = baseSize + amplitude */
  const previewHtml = (): string => {
    const chars = [...PREVIEW_TEXT].filter(ch => ch !== ' ')
    const raw = chars.map((_, i) => evaluateMathExprSafe(expr(), b() * (i - c())))
    const offsets = normalizeProfile(raw, sizeAmplitude())
    return chars.map((ch, i) => {
      const size = Math.max(8, Math.round(baseSize() + offsets[i]))
      return `<span style="font-size:${size}px">${ch}</span>`
    }).join('')
  }

  /** Dessine la courbe — axe x = lettres du mot */
  const drawCurve = () => {
    const ctx = curveRef?.getContext('2d')
    if (!ctx) return
    const w = curveRef.width, h = curveRef.height, pad = 6
    const n = [...PREVIEW_TEXT].filter(ch => ch !== ' ').length
    const samples = Math.max(n * 10, 100)

    ctx.clearRect(0, 0, w, h)
    ctx.fillStyle = CANVAS_BG
    ctx.fillRect(0, 0, w, h)

    // Grille
    ctx.strokeStyle = CANVAS_GRID; ctx.lineWidth = 1
    for (let y = 0; y < h; y += 25) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke() }

    // Valeurs normalisées : min→0, max→amplitude
    const amp = sizeAmplitude()
    const rawValues: number[] = []
    for (let i = 0; i < samples; i++) {
      const idx = (i / (samples - 1)) * (n - 1)
      rawValues.push(evaluateMathExprSafe(expr(), b() * (idx - c())))
    }
    const values = normalizeProfile(rawValues, amp)
    const minV = Math.min(...values, 0), maxV = Math.max(...values, 0)
    const range = maxV - minV || 1

    // Ligne zero
    const zeroY = pad + ((maxV - 0) / range) * (h - 2 * pad)
    ctx.strokeStyle = CANVAS_MIDLINE; ctx.globalAlpha = 0.5
    ctx.setLineDash([6, 4])
    ctx.beginPath(); ctx.moveTo(0, zeroY); ctx.lineTo(w, zeroY); ctx.stroke()
    ctx.setLineDash([]); ctx.globalAlpha = 1

    // Graduations lettres
    const letters = [...PREVIEW_TEXT].filter(ch => ch !== ' ')
    ctx.fillStyle = CANVAS_MIDLINE; ctx.font = '10px Fredoka, sans-serif'; ctx.textAlign = 'center'
    for (let i = 0; i < letters.length; i++) {
      const lx = pad + (i / (n - 1)) * (w - 2 * pad)
      ctx.fillText(letters[i], lx, h - 1)
      ctx.strokeStyle = CANVAS_GRID; ctx.lineWidth = 1; ctx.globalAlpha = 0.3
      ctx.beginPath(); ctx.moveTo(lx, 0); ctx.lineTo(lx, h - 12); ctx.stroke()
      ctx.globalAlpha = 1
    }

    // Courbe
    ctx.beginPath(); ctx.strokeStyle = CANVAS_CURVE; ctx.lineWidth = 3; ctx.lineJoin = 'round'; ctx.lineCap = 'round'
    for (let i = 0; i < samples; i++) {
      const x = pad + (i / (samples - 1)) * (w - 2 * pad)
      const y = pad + ((maxV - values[i]) / range) * (h - 2 * pad)
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y)
    }
    ctx.stroke()

    // Remplissage
    ctx.lineTo(pad + (w - 2 * pad), zeroY); ctx.lineTo(pad, zeroY); ctx.closePath()
    ctx.fillStyle = CANVAS_FILL; ctx.fill()
  }

  createEffect(() => { expr(); b(); c(); sizeAmplitude(); drawCurve() })

  const insertAtCursor = (text: string) => {
    const input = inputRef
    if (!input) return
    const start = input.selectionStart ?? input.value.length
    const end = input.selectionEnd ?? start
    const newVal = input.value.slice(0, start) + text + input.value.slice(end)
    setExpr(newVal)
    requestAnimationFrame(() => { const pos = start + text.length; input.setSelectionRange(pos, pos); input.focus() })
  }

  return (
    <div class="math-container">
      <div class="math-formula">
        <span class="math-formula-a">{sizeAmplitude().toFixed(0)}</span>
        <span class="math-formula-dot"> · </span>
        <span class="math-formula-f">f</span>
        <span class="math-formula-paren">(</span>
        <span class="math-formula-b">{b().toFixed(1)}</span>
        <span class="math-formula-dot"> · (x − </span>
        <span class="math-formula-c">{c().toFixed(1)}</span>
        <span class="math-formula-paren">)</span>
        <span class="math-formula-paren">)</span>
        <span class="math-formula-dot" style={{ "margin-left": "12px", color: "var(--muted)", "font-size": "var(--font-sm)" }}>x = 0, 1, ..., {[...PREVIEW_TEXT].filter(ch => ch !== ' ').length - 1}</span>
      </div>

      <div class="math-text-preview" innerHTML={previewHtml()} />

      <canvas ref={curveRef} class="math-curve-canvas" width={800} height={160} />

      <div class="math-input-row">
        <span class="math-input-prefix">f(x) =</span>
        <input ref={inputRef} class="math-input" type="text" value={expr()} onInput={(e) => setExpr(e.currentTarget.value)} placeholder="sin(x), x^2, cos(2*x)..." />
      </div>

      <div class="math-btn-grid">
        <For each={FUNC_BUTTONS}>{(btn) => <button class="math-btn math-btn-func" onMouseDown={(e) => e.preventDefault()} onClick={() => insertAtCursor(btn.insert)}>{btn.label}</button>}</For>
      </div>
      <div class="math-btn-grid">
        <For each={OP_BUTTONS}>{(btn) => <button class="math-btn math-btn-op" onMouseDown={(e) => e.preventDefault()} onClick={() => insertAtCursor(btn.insert)}>{btn.label}</button>}</For>
      </div>

      <div class="math-params">
        <div class="math-param">
          <span class="math-param-name" title="Etendue visible du domaine">b</span>
          <input type="range" min="0.5" max="20" step="0.1" value={b()} onInput={(e) => setB(parseFloat(e.currentTarget.value))} />
          <span class="math-param-val">{b().toFixed(1)}</span>
        </div>
        <div class="math-param">
          <span class="math-param-name" title="Debut du domaine">c</span>
          <input type="range" min="-10" max="10" step="0.1" value={c()} onInput={(e) => setC(parseFloat(e.currentTarget.value))} />
          <span class="math-param-val">{c().toFixed(1)}</span>
        </div>
      </div>

      <button class="btn btn-lavender" onClick={() => props.onApply(getProfile(), expr(), { a: sizeAmplitude(), b: b(), c: c() })}>
        Enregistrer
      </button>
    </div>
  )
}
