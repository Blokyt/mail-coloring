/**
 * Couverture navigateur du reste de l'éditeur.
 *
 * app.spec.ts couvre la commutation et le balayage des boutons.
 * Ce fichier couvre les parcours utilisateur restants : saut de ligne,
 * emoji, collage, copie, lien, police, fond, undo/redo, pagination,
 * et création d'effet au tracé libre.
 */

import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import {
  EDITOR, watchErrors, typeInEditor, selectChars,
  checkInvariant, setSizeViaSlider,
} from './helpers'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.waitForSelector(EDITOR)
})

const charCount = (page: Page) => page.evaluate((sel) => {
  const root = document.querySelector(sel) as HTMLElement
  return [...root.querySelectorAll('span')].filter(
    s => !(s as HTMLElement).dataset.sizeEffect && !s.classList.contains('line-break'),
  ).length
}, EDITOR)

const applyFirstSizeEffect = async (page: Page) => {
  await page.locator('.side-panel-right .side-tag').first().click()
  await page.waitForTimeout(80)
}

/* ══════════════════════════════════════════
   Sauts de ligne
   ══════════════════════════════════════════ */

test('Entrée insère un saut de ligne visible et réversible', async ({ page }) => {
  const errors = watchErrors(page)
  await typeInEditor(page, 'Bonjour')
  await page.keyboard.press('Enter')
  await page.keyboard.type('monde')
  await page.waitForTimeout(100)

  expect(await page.locator(`${EDITOR} .line-break`).count()).toBe(1)
  expect(await page.locator(`${EDITOR} br`).count()).toBe(1)
  expect(await checkInvariant(page)).toEqual([])

  // Backspace juste après le saut le supprime
  await page.evaluate((sel) => {
    const root = document.querySelector(sel) as HTMLElement
    const spans = [...root.querySelectorAll('span')].filter(s => !s.classList.contains('line-break'))
    const r = document.createRange()
    r.setStartBefore(spans[7]); r.collapse(true)
    const s = window.getSelection()!; s.removeAllRanges(); s.addRange(r)
  }, EDITOR)
  await page.keyboard.press('Backspace')
  await page.waitForTimeout(100)

  expect(await page.locator(`${EDITOR} .line-break`).count()).toBe(0)
  expect(await checkInvariant(page)).toEqual([])
  expect(errors).toEqual([])
})

test('un effet de taille ne déborde pas sur la ligne suivante', async ({ page }) => {
  await typeInEditor(page, 'Bonjour')
  await page.keyboard.press('Enter')
  await page.keyboard.type('monde')
  await page.waitForTimeout(100)

  await page.keyboard.press('Control+a')
  await page.waitForTimeout(60)
  await applyFirstSizeEffect(page)

  // Un marqueur par ligne, aucun ne contient le saut
  const spanning = await page.evaluate((sel) => {
    const root = document.querySelector(sel) as HTMLElement
    return [...root.querySelectorAll('[data-size-effect]')]
      .filter(m => m.querySelector('br, .line-break')).length
  }, EDITOR)
  expect(spanning, 'marqueur à cheval sur un saut de ligne').toBe(0)
  expect(await checkInvariant(page)).toEqual([])
})

/* ══════════════════════════════════════════
   Emoji
   ══════════════════════════════════════════ */

test('insérer un emoji depuis le sélecteur', async ({ page }) => {
  const errors = watchErrors(page)
  await typeInEditor(page, 'Bonjour')
  const before = await charCount(page)

  await page.locator('.toolbar-panel button', { hasText: 'Emoji' }).click()
  await page.waitForTimeout(200)
  const firstEmoji = page.locator('.emoji-grid button, .emoji-picker button').first()
  await firstEmoji.click()
  await page.waitForTimeout(150)

  expect(await charCount(page)).toBe(before + 1)
  expect(await checkInvariant(page)).toEqual([])
  expect(errors).toEqual([])
})

test('un emoji dans un mot à effet ne casse ni le marqueur ni le profil', async ({ page }) => {
  await typeInEditor(page, 'Bonjour')
  await selectChars(page, 0, 7)
  await applyFirstSizeEffect(page)
  expect(await page.locator(`${EDITOR} [data-size-effect]`).count()).toBe(1)

  await selectChars(page, 3, 4)
  await page.keyboard.press('ArrowRight')
  await page.locator('.toolbar-panel button', { hasText: 'Emoji' }).click()
  await page.waitForTimeout(200)
  await page.locator('.emoji-grid button, .emoji-picker button').first().click()
  await page.waitForTimeout(150)

  expect(await page.locator(`${EDITOR} [data-size-effect]`).count()).toBe(1)
  expect(await checkInvariant(page)).toEqual([])
})

/* ══════════════════════════════════════════
   Collage et copie
   ══════════════════════════════════════════ */

test('coller du texte multiligne le nettoie et le stylise', async ({ page }) => {
  const errors = watchErrors(page)
  await typeInEditor(page, 'A')

  await page.evaluate((sel) => {
    const dt = new DataTransfer()
    dt.setData('text/plain', 'un\ndeux')
    document.querySelector(sel)!.dispatchEvent(
      new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }),
    )
  }, EDITOR)
  await page.waitForTimeout(150)

  const text = await page.locator(EDITOR).innerText()
  expect(text.replace(/\s+/g, ' ')).toContain('un')
  expect(text.replace(/\s+/g, ' ')).toContain('deux')
  expect(await page.locator(`${EDITOR} .line-break`).count()).toBe(1)
  expect(await checkInvariant(page)).toEqual([])
  expect(errors).toEqual([])
})

test('coller du HTML riche ne fait pas entrer de balises étrangères', async ({ page }) => {
  await typeInEditor(page, 'A')
  await page.evaluate((sel) => {
    const dt = new DataTransfer()
    dt.setData('text/plain', 'texte')
    dt.setData('text/html', '<b style="color:red"><table><tr><td>texte</td></tr></table></b>')
    document.querySelector(sel)!.dispatchEvent(
      new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }),
    )
  }, EDITOR)
  await page.waitForTimeout(150)

  expect(await page.locator(`${EDITOR} table, ${EDITOR} b, ${EDITOR} font`).count()).toBe(0)
  expect(await checkInvariant(page)).toEqual([])
})

test('le bouton Copier produit du HTML sans marqueur interne', async ({ page }) => {
  const errors = watchErrors(page)
  await typeInEditor(page, 'Bonjour le monde')
  await selectChars(page, 0, 7)
  await applyFirstSizeEffect(page)

  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.locator('.btn-peach', { hasText: 'Copier' }).click()
  await page.waitForTimeout(300)

  await expect(page.locator('.toast')).toBeVisible()
  expect(errors).toEqual([])
})

/* ══════════════════════════════════════════
   Lien, police, fond
   ══════════════════════════════════════════ */

test('ajouter un lien sur une sélection', async ({ page }) => {
  const errors = watchErrors(page)
  await typeInEditor(page, 'Bonjour le monde')
  await selectChars(page, 0, 7)

  await page.locator('.toolbar-panel button[title*="lien"]').click()
  await page.waitForTimeout(200)
  await page.locator('.naming-input').fill('https://mines-paris.psl.eu')
  await page.locator('button', { hasText: 'Valider' }).click()
  await page.waitForTimeout(200)

  const link = page.locator(`${EDITOR} a`)
  await expect(link).toHaveCount(1)
  expect(await link.getAttribute('href')).toBe('https://mines-paris.psl.eu')
  expect(await checkInvariant(page)).toEqual([])
  expect(errors).toEqual([])
})

test('changer la police de la sélection', async ({ page }) => {
  await typeInEditor(page, 'Bonjour le monde')
  await selectChars(page, 0, 7)

  await page.locator('.font-picker-btn, .font-picker button').first().click()
  await page.waitForTimeout(200)
  const option = page.locator('.font-option, .font-picker-item').nth(2)
  await option.click()
  await page.waitForTimeout(200)

  const fonts = await page.evaluate((sel) => {
    const root = document.querySelector(sel) as HTMLElement
    return [...root.querySelectorAll('span')].slice(0, 7)
      .map(s => getComputedStyle(s).fontFamily)
  }, EDITOR)
  expect(new Set(fonts).size, 'la police doit être uniforme sur le mot').toBe(1)
  expect(await checkInvariant(page)).toEqual([])
})

test('appliquer une couleur de fond', async ({ page }) => {
  await typeInEditor(page, 'Bonjour le monde')
  await selectChars(page, 0, 7)
  await page.locator('.toggle-btn', { hasText: 'Fond' }).click()
  await page.locator('.swatch').first().click()
  await page.waitForTimeout(150)

  const bgs = await page.evaluate((sel) => {
    const root = document.querySelector(sel) as HTMLElement
    return [...root.querySelectorAll('span')].slice(0, 7)
      .map(s => getComputedStyle(s).backgroundColor)
  }, EDITOR)
  expect(bgs.every(b => b !== 'rgba(0, 0, 0, 0)'), `fonds: ${bgs}`).toBe(true)
  expect(await checkInvariant(page)).toEqual([])
})

/* ══════════════════════════════════════════
   Undo / redo
   ══════════════════════════════════════════ */

test('undo puis redo restaure exactement le document', async ({ page }) => {
  const errors = watchErrors(page)
  await typeInEditor(page, 'Bonjour le monde')
  await selectChars(page, 0, 7)
  await applyFirstSizeEffect(page)
  const withEffect = await page.locator(EDITOR).innerHTML()

  await page.locator('.header .btn-icon[title*="Annuler"]').click()
  await page.waitForTimeout(150)
  const undone = await page.locator(EDITOR).innerHTML()
  expect(undone).not.toBe(withEffect)

  await page.locator('.header .btn-icon[title*="tablir"]').click()
  await page.waitForTimeout(150)
  expect(await page.locator(EDITOR).innerHTML()).toBe(withEffect)
  expect(await checkInvariant(page)).toEqual([])
  expect(errors).toEqual([])
})

test('undo en rafale ne casse rien', async ({ page }) => {
  const errors = watchErrors(page)
  await typeInEditor(page, 'Bonjour le monde')
  await selectChars(page, 0, 7)
  await applyFirstSizeEffect(page)
  await selectChars(page, 0, 7)
  await page.locator('.swatch').first().click()
  await page.waitForTimeout(80)
  await setSizeViaSlider(page, 36)

  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Control+z')
    await page.waitForTimeout(40)
  }
  expect(await checkInvariant(page)).toEqual([])
  expect(errors).toEqual([])
})

/* ══════════════════════════════════════════
   Pagination
   ══════════════════════════════════════════ */

test('les trois dispositions de page fonctionnent', async ({ page }) => {
  const errors = watchErrors(page)
  await typeInEditor(page, 'Bonjour le monde')
  for (const title of ['1 page', '2 pages', '3 pages']) {
    await page.locator(`.layout-btn[title="${title}"]`).click()
    await page.waitForTimeout(150)
    await expect(page.locator('.page-nav-label')).toBeVisible()
  }
  expect(errors).toEqual([])
})

/* ══════════════════════════════════════════
   Création par tracé libre
   ══════════════════════════════════════════ */

test('créer un effet au tracé libre puis l\'appliquer', async ({ page }) => {
  const errors = watchErrors(page)
  await typeInEditor(page, 'Bonjour le monde')

  await page.locator('.btn-compact', { hasText: 'Creer' }).click()
  await page.waitForTimeout(300)
  await page.locator('.catalog-tab', { hasText: 'Creer' }).click()
  await page.waitForTimeout(200)
  await page.locator('.catalog-section-header', { hasText: 'Trace libre' }).click()
  await page.waitForTimeout(200)

  const canvas = page.locator('.shape-canvas canvas, canvas.shape-canvas').first()
  // Le canvas est sous la ligne de flottaison de la modale : sans ce scroll,
  // boundingBox() renvoie des coordonnees hors viewport et les evenements
  // souris n'atteignent jamais le canvas (profil reste plat).
  await canvas.scrollIntoViewIfNeeded()
  await page.waitForTimeout(150)
  const box = (await canvas.boundingBox())!
  // On reste a l'interieur des bords : onMouseLeave termine le trace.
  const x0 = box.x + 4
  const y0 = box.y + box.height - 6
  await page.mouse.move(x0, y0)
  await page.mouse.down()
  for (let i = 1; i <= 20; i++) {
    const x = box.x + 4 + ((box.width - 10) * i) / 20
    const y = y0 - ((box.height - 14) * i) / 20
    await page.mouse.move(x, y)
  }
  await page.mouse.up()
  await page.waitForTimeout(250)

  await page.locator('.shape-canvas-actions button', { hasText: 'Enregistrer' }).click()
  await page.waitForTimeout(250)
  await page.locator('.naming-input').fill('Trace test')
  await page.locator('button', { hasText: 'Valider' }).click()
  await page.waitForTimeout(250)
  await page.locator('.modal-close, .catalog-close').first().click().catch(() => {})
  await page.keyboard.press('Escape')
  await page.waitForTimeout(200)

  const tag = page.locator('.side-panel-right .side-tag', { hasText: 'Trace test' }).first()
  await expect(tag).toBeVisible()

  await selectChars(page, 0, 7)
  await tag.click()
  await page.waitForTimeout(200)

  expect(await page.locator(`${EDITOR} [data-size-effect]`).count()).toBe(1)
  const sizes = await page.evaluate((sel) => {
    const m = document.querySelector(`${sel} [data-size-effect]`)!
    return [...m.querySelectorAll('span')].map(s => parseFloat(getComputedStyle(s).fontSize))
  }, EDITOR)
  expect(new Set(sizes).size, 'un tracé montant doit produire des tailles variées').toBeGreaterThan(1)
  expect(await checkInvariant(page)).toEqual([])
  expect(errors).toEqual([])
})
