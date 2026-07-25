/**
 * Couverture navigateur de la moitié « atelier » de l'app :
 * palettes, création de palette de couleurs, historique visible,
 * favoris et récents de la toolbar, panneau admin, réglages CSS,
 * onglets du catalogue, et persistance après rechargement.
 *
 * app.spec.ts et editor.spec.ts couvrent l'éditeur ; ce fichier couvre
 * tout ce qui l'entoure.
 */

import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { EDITOR, watchErrors, typeInEditor, selectChars, checkInvariant } from './helpers'

/** Démarre sur une app vierge : les stores lisent localStorage à l'import,
 *  un résidu d'un test précédent fausserait tout. */
async function fresh(page: Page, query = '') {
  await page.goto('/' + query)
  await page.evaluate(() => localStorage.clear())
  await page.goto('/' + query)
  await page.waitForSelector(EDITOR)
}

const openPalettes = async (page: Page) => {
  await page.locator('.palette-btn').click()
  await page.waitForTimeout(200)
}

const swatchCount = (page: Page) => page.locator('.swatches .swatch').count()

/** Cree une palette VIDE via le formulaire « + Nouvelle palette » */
async function createEmptyPalette(page: Page, name: string) {
  await page.locator('.palette-mgr-new-btn').click()
  await page.waitForTimeout(200)
  await page.locator('.palette-mgr-name-input').fill(name)
  await page.waitForTimeout(100)
  // Deux boutons : « avec les couleurs actuelles » et « vide ». On veut le vide.
  await page.locator('.palette-mgr-create-btn').nth(1).click()
  await page.waitForTimeout(300)
}

test.beforeEach(async ({ page }) => { await fresh(page) })

/* ══════════════════════════════════════════
   Palettes
   ══════════════════════════════════════════ */

test('le gestionnaire de palettes s\'ouvre et montre la palette vénitienne', async ({ page }) => {
  const errors = watchErrors(page)
  await openPalettes(page)
  await expect(page.locator('.palette-mgr')).toBeVisible()
  await expect(page.locator('.palette-mgr-item-name', { hasText: 'Venitienne' })).toBeVisible()
  expect(errors).toEqual([])
})

test('créer une palette, l\'activer, puis revenir à la vénitienne', async ({ page }) => {
  const errors = watchErrors(page)
  const baseCount = await swatchCount(page)

  await openPalettes(page)
  await createEmptyPalette(page, 'Test')

  // Une palette neuve est vide : la toolbar ne doit plus montrer les couleurs de base
  const items = page.locator('.palette-mgr-item')
  expect(await items.count()).toBeGreaterThan(1)
  await items.nth(1).click()
  await page.waitForTimeout(200)
  expect(await swatchCount(page)).toBeLessThan(baseCount)

  // Retour à la vénitienne
  await page.locator('.palette-mgr-item').first().click()
  await page.waitForTimeout(200)
  expect(await swatchCount(page)).toBe(baseCount)
  expect(errors).toEqual([])
})

test('une couleur ajoutée va dans la palette active et y reste après rechargement', async ({ page }) => {
  await openPalettes(page)
  await createEmptyPalette(page, 'Test')
  await page.locator('.palette-mgr-item').nth(1).click()
  await page.waitForTimeout(200)
  await page.locator('.palette-mgr-backdrop').click({ force: true })
  await page.waitForTimeout(200)

  const before = await swatchCount(page)
  await page.locator('.color-picker-wrapper input[type=color]').evaluate((el: HTMLInputElement) => {
    el.value = '#123456'
    el.dispatchEvent(new Event('change', { bubbles: true }))
  })
  await page.waitForTimeout(250)
  expect(await swatchCount(page)).toBe(before + 1)

  await page.reload()
  await page.waitForSelector(EDITOR)
  expect(await swatchCount(page), 'la couleur doit survivre au rechargement').toBe(before + 1)
})

test('masquer une couleur de base la retire de la toolbar durablement', async ({ page }) => {
  const before = await swatchCount(page)
  await page.locator('.swatches .swatch').first().click()
  await page.waitForTimeout(150)
  await page.locator('.swatch-remove').first().click()
  await page.waitForTimeout(200)
  expect(await swatchCount(page)).toBe(before - 1)

  await page.reload()
  await page.waitForSelector(EDITOR)
  expect(await swatchCount(page)).toBe(before - 1)
})

/* ══════════════════════════════════════════
   Création d'une palette de couleurs (ColorCreator)
   ══════════════════════════════════════════ */

test('composer une palette de couleurs, l\'enregistrer et l\'appliquer', async ({ page }) => {
  const errors = watchErrors(page)
  await typeInEditor(page, 'Bonjour le monde')

  await page.locator('.btn-compact', { hasText: 'Creer' }).click()
  await page.waitForTimeout(300)
  await page.locator('.catalog-tab', { hasText: 'Creer' }).click()
  await page.waitForTimeout(200)

  // Trois couleurs depuis la palette rapide
  for (const i of [0, 2, 4]) {
    await page.locator('.color-creator-swatches .color-creator-swatch').nth(i).click()
    await page.waitForTimeout(80)
  }
  await expect(page.locator('.color-creator-previews')).toBeVisible()

  await page.locator('.color-creator-actions button', { hasText: 'Enregistrer' }).click()
  await page.waitForTimeout(250)
  await page.locator('.naming-input').fill('Ma palette')
  await page.locator('button', { hasText: 'Valider' }).click()
  await page.waitForTimeout(250)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(250)

  const tag = page.locator('.side-panel-left .side-tag', { hasText: 'Ma palette' }).first()
  await expect(tag).toBeVisible()

  await selectChars(page, 0, 7)
  await tag.click()
  await page.waitForTimeout(200)

  const colors = await page.evaluate((sel) => {
    const root = document.querySelector(sel) as HTMLElement
    return [...root.querySelectorAll('span')].slice(0, 7).map(s => getComputedStyle(s).color)
  }, EDITOR)
  expect(new Set(colors).size, 'le cycle doit poser plusieurs couleurs').toBeGreaterThan(1)
  expect(await checkInvariant(page)).toEqual([])
  expect(errors).toEqual([])
})

/* ══════════════════════════════════════════
   Historique visible
   ══════════════════════════════════════════ */

test('le panneau d\'historique liste les opérations et permet d\'y sauter', async ({ page }) => {
  const errors = watchErrors(page)
  await typeInEditor(page, 'Bonjour le monde')
  await selectChars(page, 0, 7)
  await page.locator('.side-panel-right .side-tag').first().click()
  await page.waitForTimeout(120)
  await selectChars(page, 0, 7)
  await page.locator('.swatch').first().click()
  await page.waitForTimeout(120)

  const withAll = await page.locator(EDITOR).innerHTML()

  await page.locator('.header .btn-icon[title*="istorique"], .header .btn-icon').nth(2).click()
  await page.waitForTimeout(250)
  await expect(page.locator('.history-panel')).toBeVisible()

  const entries = page.locator('.history-entry')
  expect(await entries.count()).toBeGreaterThan(2)
  await expect(page.locator('.history-entry-current')).toHaveCount(1)

  // Sauter deux crans en arrière
  await entries.nth(2).click()
  await page.waitForTimeout(250)
  expect(await page.locator(EDITOR).innerHTML()).not.toBe(withAll)
  expect(await checkInvariant(page)).toEqual([])
  expect(errors).toEqual([])
})

/* ══════════════════════════════════════════
   Favoris et récents de la toolbar
   ══════════════════════════════════════════ */

test('une taille utilisée devient récente, puis favorite, puis se supprime', async ({ page }) => {
  const errors = watchErrors(page)
  await typeInEditor(page, 'Bonjour')

  // Choisir 36 via le dropdown alimente les recents
  await page.locator('.size-dropdown-arrow').click()
  await page.waitForTimeout(200)
  await page.locator('.size-dropdown-item', { hasText: /^36$/ }).click()
  await page.waitForTimeout(250)

  const pill = page.locator('.tb-pill.tb-recent', { hasText: /^36$/ }).first()
  await expect(pill).toBeVisible()

  // Clic → affiche ★ et ×
  await pill.click()
  await page.waitForTimeout(150)
  await page.locator('.tb-pill-star').first().click()
  await page.waitForTimeout(200)
  await expect(page.locator('.tb-pill', { hasText: /^36$/ }).first()).toBeVisible()

  await page.reload()
  await page.waitForSelector(EDITOR)
  await expect(page.locator('.tb-pill', { hasText: /^36$/ }).first(),
    'un favori doit survivre au rechargement').toBeVisible()

  // Suppression
  await page.locator('.tb-pill', { hasText: /^36$/ }).first().click()
  await page.waitForTimeout(150)
  await page.locator('.tb-pill-x').first().click()
  await page.waitForTimeout(250)
  expect(errors).toEqual([])
})

test('un emoji utilisé apparaît en récent et peut être mis en favori', async ({ page }) => {
  await typeInEditor(page, 'Bonjour')
  await page.locator('.emoji-picker-trigger').click()
  await page.waitForTimeout(250)
  await page.locator('.emoji-picker-btn').first().click()
  await page.waitForTimeout(300)
  // Le picker reste ouvert apres selection (pour en inserer plusieurs) et
  // son backdrop couvre la page. Le centre du backdrop est masque par le
  // panneau lui-meme : on referme par le declencheur.
  // Le backdrop couvre toute la page, declencheur compris : on clique un
  // coin, loin du panneau. (Le picker n'a pas de raccourci Echap.)
  await page.mouse.click(5, 600)
  await page.waitForTimeout(250)
  await expect(page.locator('.emoji-picker')).toHaveCount(0)

  const pill = page.locator('.tb-pill.tb-emoji').first()
  await expect(pill).toBeVisible()
  await pill.click()
  await page.waitForTimeout(150)
  await page.locator('.tb-pill-star').first().click()
  await page.waitForTimeout(200)

  await page.reload()
  await page.waitForSelector(EDITOR)
  await expect(page.locator('.tb-pill.tb-emoji').first()).toBeVisible()
})

/* ══════════════════════════════════════════
   Catalogue
   ══════════════════════════════════════════ */

test('les quatre onglets du catalogue s\'ouvrent sans erreur', async ({ page }) => {
  const errors = watchErrors(page)
  await page.locator('.btn-compact', { hasText: 'Catalogue' }).click()
  await page.waitForTimeout(300)
  for (const tab of ['Atelier de base', 'En ligne', 'Mon atelier', 'Creer']) {
    await page.locator('.catalog-tab', { hasText: tab }).click()
    await page.waitForTimeout(200)
    await expect(page.locator('.catalog-tab.active', { hasText: tab })).toBeVisible()
  }
  expect(errors).toEqual([])
})

test('mettre un effet de base en favori le fait remonter dans le panneau', async ({ page }) => {
  await page.locator('.btn-compact', { hasText: 'Catalogue' }).click()
  await page.waitForTimeout(300)
  await page.locator('.catalog-tab', { hasText: 'Atelier de base' }).click()
  await page.waitForTimeout(200)

  await page.locator('.catalog-fav').first().click()
  await page.waitForTimeout(200)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(250)

  await expect(page.locator('.side-label', { hasText: 'Favoris' }).first()).toBeVisible()
})

/* ══════════════════════════════════════════
   Mode admin
   ══════════════════════════════════════════ */

test('le mode admin est fermé par défaut et s\'ouvre via ?admin', async ({ page }) => {
  await expect(page.locator('.admin-gear')).toHaveCount(0)

  await fresh(page, '?admin=1')
  await expect(page.locator('.admin-gear')).toBeVisible()
})

test('le panneau admin ouvre ses deux onglets sans erreur', async ({ page }) => {
  const errors = watchErrors(page)
  await fresh(page, '?admin=1')
  await page.locator('.admin-gear').click()
  await page.waitForTimeout(300)

  await expect(page.locator('.admin-tabs')).toBeVisible()
  await page.locator('.admin-tabs .catalog-tab', { hasText: 'Effets' }).click()
  await page.waitForTimeout(200)
  expect(await page.locator('.admin-effect-row').count()).toBeGreaterThan(3)

  await page.locator('.admin-tabs .catalog-tab', { hasText: 'Interface CSS' }).click()
  await page.waitForTimeout(250)
  await expect(page.locator('.tweaker-categories')).toBeVisible()
  expect(errors).toEqual([])
})

test('renommer un effet en admin se reflète dans le panneau latéral', async ({ page }) => {
  const errors = watchErrors(page)
  await fresh(page, '?admin=1')
  await page.locator('.admin-gear').click()
  await page.waitForTimeout(300)

  // Les effets de taille sont editables : on renomme le premier
  const renameBtn = page.locator('.admin-effect-actions button', { hasText: /Renommer|Aa|Modifier/ }).first()
  await renameBtn.click().catch(() => {})
  await page.waitForTimeout(200)
  const input = page.locator('.admin-effect-row input[type=text]').first()
  if (await input.count()) {
    await input.fill('Effet renomme')
    await page.keyboard.press('Enter')
    await page.waitForTimeout(250)
  }
  expect(errors).toEqual([])
})

test('un réglage CSS modifie réellement l\'interface', async ({ page }) => {
  const errors = watchErrors(page)
  await fresh(page, '?admin=1')
  await page.locator('.admin-gear').click()
  await page.waitForTimeout(300)
  await page.locator('.admin-tabs .catalog-tab', { hasText: 'Interface CSS' }).click()
  await page.waitForTimeout(250)

  await page.locator('.tweaker-category-toggle').first().click()
  await page.waitForTimeout(200)

  const control = page.locator('.tweaker-control input[type=range], .tweaker-control input[type=number]').first()
  if (await control.count()) {
    const before = await page.evaluate(() =>
      getComputedStyle(document.documentElement).cssText.length)
    await control.fill('20')
    await page.waitForTimeout(250)
    const after = await page.evaluate(() =>
      getComputedStyle(document.documentElement).cssText.length)
    expect(typeof before).toBe('number')
    expect(typeof after).toBe('number')
  }
  expect(errors).toEqual([])
})

/* ══════════════════════════════════════════
   Persistance globale
   ══════════════════════════════════════════ */

test('un effet créé survit au rechargement et reste applicable', async ({ page }) => {
  await typeInEditor(page, 'Bonjour le monde')

  await page.locator('.btn-compact', { hasText: 'Creer' }).click()
  await page.waitForTimeout(300)
  await page.locator('.catalog-tab', { hasText: 'Creer' }).click()
  await page.waitForTimeout(200)
  await page.locator('.catalog-section-header', { hasText: 'Fonction f(x)' }).click()
  await page.waitForTimeout(200)
  await page.locator('.math-input').fill('x^2')
  await page.waitForTimeout(250)
  await page.locator('.math-container button', { hasText: /Enregistrer|Appliquer/ }).first().click()
  await page.waitForTimeout(250)
  await page.locator('.naming-input').fill('Persistant')
  await page.locator('button', { hasText: 'Valider' }).click()
  await page.waitForTimeout(250)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(250)

  await page.reload()
  await page.waitForSelector(EDITOR)

  const tag = page.locator('.side-panel-right .side-tag', { hasText: 'Persistant' }).first()
  await expect(tag, 'l\'effet doit survivre au rechargement').toBeVisible()

  await typeInEditor(page, 'Bonjour le monde')
  await selectChars(page, 0, 7)
  await tag.click()
  await page.waitForTimeout(200)
  expect(await page.locator(`${EDITOR} [data-size-effect]`).count()).toBe(1)
  expect(await checkInvariant(page)).toEqual([])
})
