import { createSignal, onMount } from 'solid-js'
import { baseSize } from '../stores/editor'
import { PREVIEW_SHORT } from '../data/preview'

interface Props {
  onApply: (profile: number[]) => void
}

const PREVIEW_TEXT = PREVIEW_SHORT
const N_COLS = 50  // résolution du profil

import { CANVAS_BG as BG, CANVAS_GRID as GRID, CANVAS_CURVE as CURVE, CANVAS_MIDLINE as MIDLINE } from '../data/canvas-theme'

export function ShapeCanvas(props: Props) {
  let canvasRef!: HTMLCanvasElement

  // Profil = tableau de N_COLS valeurs ∈ [0, 1] (0 = bas = petites lettres, 1 = haut = grandes)
  const [profile, setProfile] = createSignal<number[]>(new Array(N_COLS).fill(0.5))
  const [isDrawing, setIsDrawing] = createSignal(false)
  const [history, setHistory] = createSignal<number[][]>([])

  onMount(() => drawCanvas())

  const drawCanvas = () => {
    const ctx = canvasRef?.getContext('2d')
    if (!ctx) return
    const w = canvasRef.width
    const h = canvasRef.height
    const prof = profile()
    const pad = 4

    ctx.clearRect(0, 0, w, h)
    ctx.fillStyle = BG
    ctx.fillRect(0, 0, w, h)

    // Grille horizontale (--separator)
    ctx.strokeStyle = GRID
    ctx.lineWidth = 1
    for (let y = 0; y < h; y += 30) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(w, y)
      ctx.stroke()
    }

    // Ligne médiane (--muted, pointillée) = baseSize
    ctx.strokeStyle = MIDLINE
    ctx.globalAlpha = 0.5
    ctx.setLineDash([6, 4])
    ctx.beginPath()
    ctx.moveTo(0, h / 2)
    ctx.lineTo(w, h / 2)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.globalAlpha = 1

    // Séparateurs de lettres (traits verticaux subtils)
    const letters = [...PREVIEW_TEXT].filter(ch => ch !== ' ')
    ctx.strokeStyle = GRID
    ctx.lineWidth = 1
    ctx.globalAlpha = 0.4
    for (let i = 1; i < letters.length; i++) {
      const x = (i / letters.length) * w
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, h)
      ctx.stroke()
    }
    ctx.globalAlpha = 1

    // Labels lettres en bas
    ctx.fillStyle = MIDLINE
    ctx.font = '600 11px Fredoka, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'bottom'
    for (let i = 0; i < letters.length; i++) {
      const x = ((i + 0.5) / letters.length) * w
      ctx.fillText(letters[i], x, h - 2)
    }

    // Courbe du profil (--lavender)
    if (prof.length < 2) return
    ctx.beginPath()
    ctx.strokeStyle = CURVE
    ctx.lineWidth = 3
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'

    for (let i = 0; i < prof.length; i++) {
      const x = pad + (i / (prof.length - 1)) * (w - 2 * pad)
      const y = pad + (1 - prof[i]) * (h - 2 * pad - 16) // -16 pour les labels
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()

    // Point sous le curseur — remplissage
    ctx.lineTo(pad + (prof.length - 1) / (prof.length - 1) * (w - 2 * pad), h - pad - 16)
    ctx.lineTo(pad, h - pad - 16)
    ctx.closePath()
    ctx.fillStyle = 'rgba(196, 181, 253, 0.12)'
    ctx.fill()
  }

  /** Convertit une position souris en index de colonne et valeur Y */
  const getColAndVal = (e: MouseEvent): { col: number; val: number } => {
    const rect = canvasRef.getBoundingClientRect()
    const rx = (e.clientX - rect.left) / rect.width
    const ry = (e.clientY - rect.top) / rect.height
    const col = Math.max(0, Math.min(N_COLS - 1, Math.round(rx * (N_COLS - 1))))
    const val = Math.max(0, Math.min(1, 1 - ry))
    return { col, val }
  }

  /** Met à jour les colonnes entre deux positions (interpolation) */
  const updateProfile = (fromCol: number, fromVal: number, toCol: number, toVal: number) => {
    const prof = [...profile()]
    const minCol = Math.min(fromCol, toCol)
    const maxCol = Math.max(fromCol, toCol)
    for (let c = minCol; c <= maxCol; c++) {
      if (minCol === maxCol) {
        prof[c] = toVal
      } else {
        const t = (c - fromCol) / (toCol - fromCol)
        prof[c] = fromVal + t * (toVal - fromVal)
      }
    }
    setProfile(prof)
    drawCanvas()
  }

  let lastCol = 0
  let lastVal = 0.5

  const handleStart = (e: MouseEvent) => {
    // Sauvegarder l'état pour undo
    setHistory(prev => [...prev, [...profile()]])
    setIsDrawing(true)
    const { col, val } = getColAndVal(e)
    lastCol = col
    lastVal = val
    updateProfile(col, val, col, val)
  }

  const handleMove = (e: MouseEvent) => {
    if (!isDrawing()) return
    const { col, val } = getColAndVal(e)
    updateProfile(lastCol, lastVal, col, val)
    lastCol = col
    lastVal = val
  }

  const handleEnd = () => {
    setIsDrawing(false)
  }

  const handleUndo = () => {
    const hist = history()
    if (hist.length === 0) return
    const prev = hist[hist.length - 1]
    setHistory(hist.slice(0, -1))
    setProfile(prev)
    drawCanvas()
  }

  const handleClear = () => {
    setHistory(prev => [...prev, [...profile()]])
    setProfile(new Array(N_COLS).fill(0.5))
    drawCanvas()
  }

  /** HTML de preview — même format que applySizeProfile */
  const previewHtml = (): string => {
    const prof = profile()
    const chars = [...PREVIEW_TEXT].filter(ch => ch !== ' ')
    const n = chars.length
    const maxAdd = 40 // amplitude max en px

    return chars.map((ch, i) => {
      // Interpoler le profil pour cette lettre
      const t = n === 1 ? 0 : i / (n - 1)
      const pIdx = t * (prof.length - 1)
      const lo = Math.floor(pIdx)
      const hi = Math.min(lo + 1, prof.length - 1)
      const frac = pIdx - lo
      const value = prof[lo] * (1 - frac) + prof[hi] * frac

      const size = Math.max(10, Math.min(36, Math.round(baseSize() + (value - 0.5) * maxAdd * 2)))
      return `<span style="font-size:${size}px">${ch}</span>`
    }).join('')
  }

  const handleApply = () => {
    props.onApply([...profile()])
  }

  return (
    <div class="shape-canvas-container">
      {/* Preview texte temps réel */}
      <div class="math-text-preview" innerHTML={previewHtml()} />

      {/* Canvas de dessin */}
      <canvas
        ref={canvasRef}
        class="shape-canvas"
        width={800}
        height={280}
        onMouseDown={handleStart}
        onMouseMove={handleMove}
        onMouseUp={handleEnd}
        onMouseLeave={handleEnd}
      />

      <div class="shape-canvas-actions">
        <button class="btn btn-lavender" onClick={handleApply}>Enregistrer</button>
        <button class="btn" onClick={handleUndo}>Annuler</button>
        <button class="btn" onClick={handleClear}>Effacer</button>
      </div>
    </div>
  )
}
