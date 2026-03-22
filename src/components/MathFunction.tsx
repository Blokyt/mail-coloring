import { createSignal, For } from 'solid-js'
import { evaluateMathExprSafe, mathToProfile } from '../engine/effects'
import { baseSize } from '../stores/editor'

interface Props {
  onApply: (profile: number[]) => void
}

const PREVIEW_TEXT = 'Artlequin'

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

export function MathFunction(props: Props) {
  let inputRef!: HTMLInputElement

  const [expr, setExpr] = createSignal('sin(x)')
  const [a, setA] = createSignal(10)
  const [b, setB] = createSignal(6.3)
  const [c, setC] = createSignal(0)

  /** Calcule la taille de chaque lettre : baseSize + a·f(b·x+c) */
  const getLetterSizes = (): number[] => {
    const letters = [...PREVIEW_TEXT].filter(ch => ch !== ' ')
    const n = letters.length
    return letters.map((_, i) => {
      const x = n === 1 ? 0 : i / (n - 1) // x ∈ [0, 1]
      const y = a() * evaluateMathExprSafe(expr(), b() * x + c())
      return Math.max(8, Math.round(baseSize() + y))
    })
  }

  /** HTML de preview — même format que applySizeProfile */
  const previewHtml = (): string => {
    const sizes = getLetterSizes()
    const chars = [...PREVIEW_TEXT].filter(ch => ch !== ' ')
    return chars.map((ch, i) =>
      `<span style="font-size:${sizes[i]}px">${ch}</span>`
    ).join('')
  }

  /** Pour sauvegarder en favori : normalise les tailles en profil [0,1] */
  const getProfile = () => mathToProfile(expr(), 50, b())

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
        <span class="math-formula-a">a</span>
        <span class="math-formula-dot"> · </span>
        <span class="math-formula-f">f</span>
        <span class="math-formula-paren">(</span>
        <span class="math-formula-b">b</span>
        <span class="math-formula-dot"> · x + </span>
        <span class="math-formula-c">c</span>
        <span class="math-formula-paren">)</span>
      </div>

      {/* Preview WYSIWYG — même rendu que les effets de taille */}
      <div class="math-text-preview" innerHTML={previewHtml()} />

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
          <span class="math-param-name">a</span>
          <input type="range" min="-30" max="30" step="0.5" value={a()} onInput={(e) => setA(parseFloat(e.currentTarget.value))} />
          <span class="math-param-val">{a().toFixed(1)}</span>
        </div>
        <div class="math-param">
          <span class="math-param-name">b</span>
          <input type="range" min="0" max="20" step="0.1" value={b()} onInput={(e) => setB(parseFloat(e.currentTarget.value))} />
          <span class="math-param-val">{b().toFixed(1)}</span>
        </div>
        <div class="math-param">
          <span class="math-param-name">c</span>
          <input type="range" min="-10" max="10" step="0.1" value={c()} onInput={(e) => setC(parseFloat(e.currentTarget.value))} />
          <span class="math-param-val">{c().toFixed(1)}</span>
        </div>
      </div>

      <button class="btn btn-lavender" onClick={() => props.onApply(getProfile())}>
        Appliquer f(x)
      </button>
    </div>
  )
}
