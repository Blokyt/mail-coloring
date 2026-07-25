import type { Page, ConsoleMessage } from '@playwright/test'

export const EDITOR = '.editor'

/** Collecte les erreurs console et les exceptions non capturées de la page */
export function watchErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('console', (m: ConsoleMessage) => {
    if (m.type() === 'error') errors.push(`console: ${m.text()}`)
  })
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
  return errors
}

/** Vide l'éditeur et saisit du texte comme un humain (déclenche beforeinput) */
export async function typeInEditor(page: Page, text: string) {
  await page.click(EDITOR)
  await page.keyboard.press('Control+A')
  await page.keyboard.press('Backspace')
  await page.keyboard.type(text, { delay: 5 })
}

/** Sélectionne les caractères [start, end) de l'éditeur via les atomes */
export async function selectChars(page: Page, start: number, end: number) {
  await page.evaluate(({ sel, start, end }) => {
    const root = document.querySelector(sel) as HTMLElement
    const spans = [...root.querySelectorAll('span')].filter(
      s => !s.dataset.sizeEffect && !s.classList.contains('line-break') && !s.querySelector('span'),
    )
    const range = document.createRange()
    range.setStartBefore(spans[start])
    range.setEndAfter(spans[end - 1])
    const s = window.getSelection()!
    s.removeAllRanges()
    s.addRange(range)
    document.dispatchEvent(new Event('selectionchange'))
  }, { sel: EDITOR, start, end })
  await page.waitForTimeout(60)
}

/** HTML courant de l'éditeur */
export function editorHtml(page: Page) {
  return page.locator(EDITOR).innerHTML()
}

/**
 * Vérifie l'invariant de document dans le vrai navigateur.
 * Retourne la liste des violations (vide = conforme).
 */
export async function checkInvariant(page: Page): Promise<string[]> {
  return page.evaluate((sel) => {
    const root = document.querySelector(sel) as HTMLElement
    const bad: string[] = []

    if (root.querySelector('b, i, u, s, strong, em, font, strike')) {
      bad.push('balise de formatage legacy (<b>/<i>/<font>...) presente')
    }
    for (const span of root.querySelectorAll('span')) {
      const el = span as HTMLElement
      if (el.dataset.sizeEffect || el.classList.contains('line-break')) continue
      if (el.querySelector('span')) bad.push(`span imbrique: ${el.outerHTML.slice(0, 80)}`)
      const seg = new Intl.Segmenter('fr', { granularity: 'grapheme' })
      const n = [...seg.segment(el.textContent || '')].length
      if (n > 1) bad.push(`span multi-graphemes (${n}): "${el.textContent}"`)
    }
    // Pas deux marqueurs d'effet adjacents de meme id
    const markers = [...root.querySelectorAll('[data-size-effect]')] as HTMLElement[]
    for (const m of markers) {
      const next = m.nextElementSibling as HTMLElement | null
      if (next?.dataset?.sizeEffect === m.dataset.sizeEffect) {
        bad.push(`marqueurs adjacents dupliques: ${m.dataset.sizeEffect}`)
      }
    }
    return bad
  }, EDITOR)
}

/** Tailles de police des caractères d'un mot à effet */
export async function effectSizes(page: Page): Promise<number[]> {
  return page.evaluate((sel) => {
    const root = document.querySelector(sel) as HTMLElement
    const marker = root.querySelector('[data-size-effect]')
    if (!marker) return []
    return [...marker.querySelectorAll('span')].map(
      s => parseFloat(getComputedStyle(s).fontSize),
    )
  }, EDITOR)
}

/* Le slider de taille est LOGARITHMIQUE (voir ToolbarPanel) : sa valeur DOM
   est une position de piste 0-1000, pas des pixels. Un fill('40') reglerait
   donc la taille a 7px, pas a 40. */
const SIZE_MIN = 6
const SIZE_MAX = 200
const SLIDER_STEPS = 1000

export function sizeToSliderPos(px: number): number {
  const clamped = Math.min(SIZE_MAX, Math.max(SIZE_MIN, px))
  return Math.round((Math.log(clamped / SIZE_MIN) / Math.log(SIZE_MAX / SIZE_MIN)) * SLIDER_STEPS)
}

/** Regle la taille de base via le slider, en pixels de police */
export async function setSizeViaSlider(page: Page, px: number) {
  const slider = page.locator('.slider-group input[type=range]')
  await slider.fill(String(sizeToSliderPos(px)))
  await slider.dispatchEvent('change')
  await page.waitForTimeout(60)
}
