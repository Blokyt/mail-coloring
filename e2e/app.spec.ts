/**
 * Tests de comportement RÉELS, dans un vrai navigateur.
 *
 * Complètent les tests unitaires de commutation (src/engine/editor-ops.test.ts) :
 * ceux-ci vérifient les fonctions pures, ceux-là vérifient que l'application
 * câblée autour se comporte pareil quand on clique vraiment sur les boutons.
 *
 * Trois familles :
 *   1. balayage de TOUS les boutons, en surveillant les erreurs console et
 *      l'invariant de document après chaque clic ;
 *   2. ordres d'exécution : les mêmes actions dans des ordres différents
 *      doivent produire exactement le même document ;
 *   3. création d'effets avec différentes fonctions mathématiques.
 */

import { test, expect } from '@playwright/test'
import {
  EDITOR, watchErrors, typeInEditor, selectChars,
  editorHtml, checkInvariant, effectSizes,
} from './helpers'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.waitForSelector(EDITOR)
})

/* ══════════════════════════════════════════
   1. Balayage de tous les boutons
   ══════════════════════════════════════════ */

test('tous les boutons de la toolbar restent sans erreur et tiennent l\'invariant', async ({ page }) => {
  const errors = watchErrors(page)
  await typeInEditor(page, 'Bonjour le monde')

  const buttons = await page.locator('.toolbar-panel button').all()
  expect(buttons.length).toBeGreaterThan(5)

  const failures: string[] = []
  for (let i = 0; i < buttons.length; i++) {
    const btn = buttons[i]
    if (!(await btn.isVisible())) continue
    const label = (await btn.getAttribute('title')) || (await btn.innerText()).trim() || `btn#${i}`

    await selectChars(page, 0, 7)
    await btn.click({ force: true }).catch(() => {})
    await page.waitForTimeout(40)
    await page.keyboard.press('Escape').catch(() => {})

    const bad = await checkInvariant(page)
    if (bad.length) failures.push(`« ${label} » → ${bad.join(' | ')}`)
  }

  expect(failures, 'boutons qui cassent l\'invariant de document').toEqual([])
  expect(errors, 'erreurs console pendant le balayage').toEqual([])
})

test('tous les effets des panneaux latéraux s\'appliquent sans erreur', async ({ page }) => {
  const errors = watchErrors(page)
  await typeInEditor(page, 'Bonjour le monde')

  const tags = await page.locator('.side-panel .side-tag').all()
  expect(tags.length).toBeGreaterThan(5)

  const failures: string[] = []
  for (const tag of tags.slice(0, 40)) {
    if (!(await tag.isVisible())) continue
    const label = (await tag.getAttribute('title')) || 'effet'
    await selectChars(page, 0, 7)
    await tag.click({ force: true })
    await page.waitForTimeout(40)
    const bad = await checkInvariant(page)
    if (bad.length) failures.push(`« ${label} » → ${bad.join(' | ')}`)
  }

  expect(failures).toEqual([])
  expect(errors).toEqual([])
})

/* ══════════════════════════════════════════
   2. Indépendance à l'ordre d'exécution
   ══════════════════════════════════════════ */

/** Actions atomiques nommées, jouées dans l'app réelle */
const ACTIONS: Record<string, (page: import('@playwright/test').Page) => Promise<void>> = {
  gras: async (p) => { await p.locator('.toolbar-panel button', { hasText: 'B' }).first().click() },
  italique: async (p) => { await p.locator('.toolbar-panel button', { hasText: 'I' }).first().click() },
  couleur: async (p) => { await p.locator('.swatch').first().click() },
  effet: async (p) => { await p.locator('.side-panel-right .side-tag').first().click() },
  taille40: async (p) => {
    await p.locator('.slider-group input[type=range]').fill('40')
    await p.locator('.slider-group input[type=range]').dispatchEvent('change')
    await p.waitForTimeout(60)
  },
}

/** Rejoue une séquence depuis une app VIERGE.
 *  Le rechargement est indispensable : le buffer de style de la hotbar et
 *  l'état « pill sélectionnée » des panneaux survivent sinon d'une séquence
 *  à l'autre, et on ne compare plus les mêmes scénarios. */
async function playSequence(page: import('@playwright/test').Page, order: string[]) {
  await page.reload()
  await page.waitForSelector(EDITOR)
  await typeInEditor(page, 'Bonjour le monde')
  for (const name of order) {
    await selectChars(page, 0, 7)
    await ACTIONS[name](page)
    await page.waitForTimeout(60)
  }
  return editorHtml(page)
}

test('le document final ne dépend pas de l\'ordre des actions', async ({ page }) => {
  const base = ['gras', 'couleur', 'effet', 'taille40']

  // Quelques permutations représentatives, dont celles qui cassaient avant
  const orders = [
    ['gras', 'couleur', 'effet', 'taille40'],
    ['taille40', 'effet', 'couleur', 'gras'],
    ['effet', 'taille40', 'gras', 'couleur'],
    ['couleur', 'taille40', 'effet', 'gras'],
    ['effet', 'gras', 'couleur', 'taille40'],
  ]

  const results = new Map<string, string[]>()
  for (const order of orders) {
    const html = await playSequence(page, order)
    const key = order.join(' → ')
    if (!results.has(html)) results.set(html, [])
    results.get(html)!.push(key)
  }

  const report = [...results.values()].map(v => v.join('\n    ')).join('\n  ---\n    ')
  expect(results.size, `ordres donnant des documents différents :\n    ${report}`).toBe(1)
  expect(base.length).toBe(4)
})

test('appliquer un effet puis changer la taille == changer la taille puis appliquer', async ({ page }) => {
  const a = await playSequence(page, ['effet', 'taille40'])
  const b = await playSequence(page, ['taille40', 'effet'])
  expect(a).toBe(b)
})

test('taper dans un mot à effet ne le coupe pas en deux effets', async ({ page }) => {
  await typeInEditor(page, 'Bonjour le monde')
  await selectChars(page, 0, 7)
  await page.locator('.side-panel-right .side-tag').first().click()
  await page.waitForTimeout(80)

  expect(await page.locator(`${EDITOR} [data-size-effect]`).count()).toBe(1)
  const before = (await effectSizes(page)).length

  // curseur au milieu du mot, puis frappe
  await selectChars(page, 3, 4)
  await page.keyboard.press('ArrowRight')
  await page.keyboard.type('X')
  await page.waitForTimeout(80)

  expect(await page.locator(`${EDITOR} [data-size-effect]`).count(), 'marqueur dupliqué').toBe(1)
  expect((await effectSizes(page)).length).toBe(before + 1)
  expect(await checkInvariant(page)).toEqual([])
})

test('après réinitialisation du style, la taille redevient modifiable', async ({ page }) => {
  await typeInEditor(page, 'Bonjour le monde')
  await selectChars(page, 0, 7)
  await page.locator('.side-panel-right .side-tag').first().click()
  await page.waitForTimeout(80)

  await selectChars(page, 0, 7)
  await page.locator('.toolbar-panel button[title*="initialiser"]').click()
  await page.waitForTimeout(80)
  expect(await page.locator(`${EDITOR} [data-size-effect]`).count()).toBe(0)

  await selectChars(page, 0, 7)
  await page.locator('.slider-group input[type=range]').fill('44')
  await page.locator('.slider-group input[type=range]').dispatchEvent('change')
  await page.waitForTimeout(80)

  const sizes = await page.evaluate((sel) => {
    const root = document.querySelector(sel) as HTMLElement
    return [...root.querySelectorAll('span')].slice(0, 7)
      .map(s => parseFloat(getComputedStyle(s).fontSize))
  }, EDITOR)
  expect(sizes.every(s => s === 44), `tailles obtenues: ${sizes}`).toBe(true)
})

test('undo puis nouvelle opération ne casse pas la sélection', async ({ page }) => {
  const errors = watchErrors(page)
  await typeInEditor(page, 'Bonjour le monde')
  await selectChars(page, 0, 7)
  await page.locator('.side-panel-right .side-tag').first().click()
  await page.waitForTimeout(80)

  await page.keyboard.press('Control+z')
  await page.waitForTimeout(80)

  await selectChars(page, 0, 7)
  await page.locator('.swatch').first().click()
  await page.waitForTimeout(80)

  expect(await checkInvariant(page)).toEqual([])
  expect(errors).toEqual([])
})

/* ══════════════════════════════════════════
   3. Création d'effets
   ══════════════════════════════════════════ */

const EXPRS = ['sin(x)', 'cos(x)', 'x^2', 'exp(x)', '1/x', 'abs(sin(x))', 'sqrt(x)']

test('création d\'effets par fonction : chaque expression produit un effet appliquable', async ({ page }) => {
  const errors = watchErrors(page)
  await typeInEditor(page, 'Bonjour le monde')

  await page.locator('.btn-compact', { hasText: 'Creer' }).click()
  await page.waitForTimeout(300)
  await page.locator('.catalog-tab', { hasText: 'Creer' }).click()
  await page.waitForTimeout(200)
  // La section « Fonction f(x) » est repliee par defaut
  await page.locator('.catalog-section-header', { hasText: 'Fonction f(x)' }).click()
  await page.waitForTimeout(200)

  for (const expr of EXPRS) {
    const input = page.locator('.math-input')
    await input.fill(expr)
    await page.waitForTimeout(250)

    // La preview doit rendre des tailles variées et finies
    const sizes = await page.locator('.math-text-preview span').evaluateAll(
      els => els.map(e => parseFloat(getComputedStyle(e).fontSize)),
    )
    expect(sizes.length, `preview vide pour ${expr}`).toBeGreaterThan(0)
    expect(sizes.every(Number.isFinite), `taille non finie pour ${expr}`).toBe(true)
    expect(Math.min(...sizes), `taille < 8 pour ${expr}`).toBeGreaterThanOrEqual(8)
  }

  expect(errors).toEqual([])
})
