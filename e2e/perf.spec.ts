/**
 * PERF E2E — latence de frappe sur un document de plusieurs pages.
 *
 * Régression du bug signalé : « au bout de quelques pages, de la latence
 * et un peu de coloriage » (2026-09-27). Chaque frappe reconstruisait tout
 * le DOM (writeAtoms O(n)), clonait le préfixe pour la sélection
 * (cloneContents O(n)), relisait tout pour le mot actif et compressait
 * tout le innerHTML en LZ à chaque frontière de mot.
 *
 * Ici on mesure le coût moyen par frappe en milieu de document volumineux
 * (~3 pages de texte, chaque caractère un span stylé, une ligne = un
 * marqueur d'effet, le pire cas de la re-dérivation), puis on vérifie que
 * le document reste conforme à l'invariant.
 */

import { test, expect } from '@playwright/test'
import { EDITOR, watchErrors, checkInvariant } from './helpers'

const CHARS = 5400 // ~3 pages

/** Construit le document volumineux directement dans l'éditeur. */
async function seed(page: import('@playwright/test').Page) {
  await page.evaluate((chars) => {
    const root = document.querySelector('.editor') as HTMLElement
    const line = 'La biéro du Rézal ouvre ses portes ce vendredi soir\u00A0! '
    const lines = Math.ceil(chars / line.length)
    const html: string[] = []
    const sep = '<span style="font-size:18px;font-weight:400;font-style:normal;text-decoration:none">\u00A0</span>'
    for (let l = 0; l < lines; l++) {
      const spans: string[] = []
      for (const ch of line) {
        spans.push(`<span style="font-size:18px;font-weight:400;font-style:normal;text-decoration:none">${ch}</span>`)
      }
      // lignes alternées : jamais deux marqueurs arche adjacents (invariant)
      if (l % 2 === 0) html.push(`<span data-size-effect="arche">${spans.join('')}</span>`)
      else html.push(spans.join(''))
      html.push(sep)
    }
    root.innerHTML = html.join('')
  }, CHARS)
}

/** Place le curseur après le n-ième span feuille du document. */
async function caretAt(page: import('@playwright/test').Page, idx: number) {
  await page.evaluate((i) => {
    const root = document.querySelector('.editor') as HTMLElement
    const leaves = [...root.querySelectorAll('span')].filter(
      (s) => !(s as HTMLElement).dataset.sizeEffect
        && !(s as HTMLElement).classList.contains('line-break')
        && !(s as HTMLElement).querySelector('span'),
    )
    const range = document.createRange()
    range.setStartAfter(leaves[i])
    range.collapse(true)
    const sel = window.getSelection()!
    sel.removeAllRanges()
    sel.addRange(range)
    root.focus()
    // laisse la boucle d'événements tourner : l'app peuple son cache
    // de sélection (comme après un vrai clic) avant la frappe mesurée
  }, idx)
  await page.waitForTimeout(50)
}

test('frapper au milieu de plusieurs pages reste fluide', async ({ page }) => {
  const errors = watchErrors(page)
  await page.goto('/')
  await page.waitForSelector(EDITOR)
  await seed(page)

  const atomCount = await page.evaluate(() => {
    const root = document.querySelector('.editor') as HTMLElement
    return [...root.querySelectorAll('span')].filter(
      (s) => !(s as HTMLElement).dataset.sizeEffect,
    ).length
  })
  expect(atomCount, 'document volumineux seedé').toBeGreaterThan(CHARS * 0.8)

  // Curseur au milieu du document
  await caretAt(page, Math.floor(atomCount / 2))

  // 30 frappes, mesurées côté page
  const keystrokeMs = await page.evaluate(() => {
    const timings: number[] = []
    const editor = document.querySelector('.editor') as HTMLElement
    for (let i = 0; i < 30; i++) {
      const t0 = performance.now()
      editor.dispatchEvent(new InputEvent('beforeinput', {
        inputType: 'insertText', data: 'x', bubbles: true, cancelable: true,
      }))
      timings.push(performance.now() - t0)
    }
    timings.sort((a, b) => a - b)
    return {
      median: timings[Math.floor(timings.length / 2)],
      p90: timings[Math.floor(timings.length * 0.9)],
      max: timings[timings.length - 1],
    }
  })

  console.log('frappe (ms):', JSON.stringify(keystrokeMs), '— spans:', atomCount)

  expect(keystrokeMs.median, `médiane par frappe ${keystrokeMs.median}ms`).toBeLessThan(20)
  expect(keystrokeMs.p90, `p90 par frappe ${keystrokeMs.p90}ms`).toBeLessThan(40)

  // Le document reste conforme à l'invariant après la frappe en masse
  const bad = await checkInvariant(page)
  expect(bad).toEqual([])
  expect(errors).toEqual([])
})

test('un mot à effet reste correct après frappe dans un document volumineux', async ({ page }) => {
  const errors = watchErrors(page)
  await page.goto('/')
  await page.waitForSelector(EDITOR)

  // 2 pages de texte plat + un mot à effet au milieu
  await page.evaluate(() => {
    const root = document.querySelector('.editor') as HTMLElement
    const plain = 'x'.repeat(3600)
    const spans: string[] = []
    for (const ch of plain) {
      spans.push(`<span style="font-size:18px;font-weight:400;font-style:normal;text-decoration:none">${ch}</span>`)
    }
    const wordSpans: string[] = []
    for (const ch of 'Biero') {
      wordSpans.push(`<span style="font-size:18px;font-weight:400;font-style:normal;text-decoration:none">${ch}</span>`)
    }
    root.innerHTML = spans.slice(0, 1800).join('')
      + `<span data-size-effect="arche">${wordSpans.join('')}</span>`
      + spans.slice(1800).join('')
  })

  // Curseur au milieu du mot à effet, puis frappe : l'effet se ré-étale
  await caretAt(page, 1802)

  const sizes = await page.evaluate(() => {
    const root = document.querySelector('.editor') as HTMLElement
    root.dispatchEvent(new InputEvent('beforeinput', {
      inputType: 'insertText', data: 'X', bubbles: true, cancelable: true,
    }))
    // RE-QUÊTE après la mutation : le chemin complet recrée les nœuds
    const marker = root.querySelector('[data-size-effect]') as HTMLElement
    return [...marker.querySelectorAll('span')].map(s => parseInt(s.style.fontSize))
  })

  expect(sizes, 'le mot compte 6 lettres après insertion').toHaveLength(6)
  const maxIdx = sizes.indexOf(Math.max(...sizes))
  expect(maxIdx, `profil arche : max au milieu (${sizes})`).toBeGreaterThan(0)
  expect(maxIdx).toBeLessThan(sizes.length - 1)
  expect(Math.max(...sizes)).toBeGreaterThan(Math.min(...sizes))

  const bad = await checkInvariant(page)
  expect(bad).toEqual([])
  expect(errors).toEqual([])
})
