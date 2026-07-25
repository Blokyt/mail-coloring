/**
 * Tests des stores : persistance localStorage, migrations, favoris,
 * récents, palettes, historique undo.
 *
 * C'est la moitié de l'app qui n'avait aucun test, et celle qui porte le
 * risque le plus concret pour l'utilisateur : une migration ratée ou une
 * clé de stockage mal lue lui fait perdre ses effets et ses palettes.
 *
 * Les stores sont des singletons qui lisent localStorage AU MOMENT DE
 * L'IMPORT. Chaque test doit donc préparer le localStorage puis
 * réimporter le module via resetModules().
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

/** Vide le stockage et force un réimport propre des stores */
function reset(seed: Record<string, unknown> = {}) {
  localStorage.clear()
  for (const [k, v] of Object.entries(seed)) {
    localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v))
  }
  vi.resetModules()
}

const read = <T>(key: string): T | null => {
  const raw = localStorage.getItem(key)
  return raw ? JSON.parse(raw) as T : null
}

beforeEach(() => reset())

/* ══════════════════════════════════════════
   workshops — effets, favoris, récents
   ══════════════════════════════════════════ */

describe('workshops — migration des profils', () => {
  it('convertit les anciens profils en pixels vers une forme [0,1]', async () => {
    // Ancien format : normalizeProfile(values, amplitude) cuisait l'amplitude
    // du slider dans le tableau. Un effet cree a 18 stockait 0..18.
    reset({
      artlequin_workshop_perso: [{
        id: 'c1', type: 'custom-size', label: 'Vieux', source: 'perso',
        isFavorite: false, rawProfile: true, profile: [0, 4.5, 9, 13.5, 18],
      }],
    })
    const { getPersoEffects } = await import('./workshops')
    const p = getPersoEffects()[0].profile!
    expect(p).toEqual([0, 0.25, 0.5, 0.75, 1])
    expect((getPersoEffects()[0] as unknown as Record<string, unknown>).rawProfile).toBeUndefined()
  })

  it('la migration est persistée, pas seulement en mémoire', async () => {
    reset({
      artlequin_workshop_perso: [{
        id: 'c1', type: 'custom-size', label: 'V', source: 'perso',
        isFavorite: false, rawProfile: true, profile: [0, 20, 40],
      }],
    })
    await import('./workshops')
    const stored = read<Array<{ profile: number[] }>>('artlequin_workshop_perso')!
    expect(stored[0].profile).toEqual([0, 0.5, 1])
  })

  it('un profil déjà en forme [0,1] est laissé intact', async () => {
    const shape = [0, 0.3, 1]
    reset({
      artlequin_workshop_perso: [{
        id: 'c1', type: 'custom-size', label: 'N', source: 'perso',
        isFavorite: false, profile: shape,
      }],
    })
    const { getPersoEffects } = await import('./workshops')
    expect(getPersoEffects()[0].profile).toEqual(shape)
  })

  it('un profil plat ne produit ni NaN ni division par zéro', async () => {
    reset({
      artlequin_workshop_perso: [{
        id: 'c1', type: 'custom-size', label: 'Plat', source: 'perso',
        isFavorite: false, rawProfile: true, profile: [7, 7, 7],
      }],
    })
    const { getPersoEffects } = await import('./workshops')
    expect(getPersoEffects()[0].profile).toEqual([0, 0, 0])
  })

  it('migre aussi l\'historique, pas seulement l\'atelier', async () => {
    reset({
      artlequin_history: [{
        id: 'c1', type: 'custom-size', label: 'H', source: 'perso',
        isFavorite: false, rawProfile: true, profile: [0, 30],
      }],
    })
    await import('./workshops')
    expect(read<Array<{ profile: number[] }>>('artlequin_history')![0].profile).toEqual([0, 1])
  })

  it('un localStorage corrompu ne fait pas planter le chargement', async () => {
    reset({ artlequin_workshop_perso: '{{{ pas du JSON' })
    const { getPersoEffects } = await import('./workshops')
    expect(getPersoEffects()).toEqual([])
  })
})

describe('workshops — migration de l\'ancien format de favoris', () => {
  it('sépare les favoris de base des effets perso', async () => {
    reset({
      artlequin_favorites: [
        { id: 'arcenciel', type: 'color', label: 'Arc-en-ciel' },
        { id: 'c1', type: 'custom-size', label: 'Perso', profile: [0, 1] },
      ],
    })
    await import('./workshops')
    expect(read<string[]>('artlequin_base_favs')).toEqual(['arcenciel'])
    expect(read<Array<{ id: string }>>('artlequin_workshop_perso')![0].id).toBe('c1')
    expect(localStorage.getItem('artlequin_favorites')).toBeNull()
  })
})

describe('workshops — effets perso', () => {
  it('ajoute, renomme et supprime en persistant à chaque fois', async () => {
    const w = await import('./workshops')
    w.addPersoEffect({ id: 'x1', type: 'custom-size', label: 'A', profile: [0, 1] })
    expect(w.getPersoEffects()).toHaveLength(1)
    expect(read<unknown[]>('artlequin_workshop_perso')).toHaveLength(1)

    w.renamePersoEffect('x1', 'B')
    expect(w.getPersoEffects()[0].label).toBe('B')

    w.removePersoEffect('x1')
    expect(w.getPersoEffects()).toEqual([])
    expect(read<unknown[]>('artlequin_workshop_perso')).toEqual([])
  })

  it('un effet ajouté n\'est pas favori et porte une date de création', async () => {
    const w = await import('./workshops')
    w.addPersoEffect({ id: 'x1', type: 'custom-color', label: 'A', customColors: ['#fff'] })
    const e = w.getPersoEffects()[0]
    expect(e.isFavorite).toBe(false)
    expect(e.source).toBe('perso')
    expect(typeof e.createdAt).toBe('number')
  })

  it('toggleFavorite bascule un effet perso et le persiste', async () => {
    const w = await import('./workshops')
    w.addPersoEffect({ id: 'x1', type: 'custom-size', label: 'A', profile: [0, 1] })
    w.toggleFavorite('x1', 'perso')
    expect(w.isFavorite('x1', 'perso')).toBe(true)
    expect(read<Array<{ isFavorite: boolean }>>('artlequin_workshop_perso')![0].isFavorite).toBe(true)
    w.toggleFavorite('x1', 'perso')
    expect(w.isFavorite('x1', 'perso')).toBe(false)
  })

  it('toggleFavorite sur un effet de base ne stocke que son id', async () => {
    const w = await import('./workshops')
    w.toggleFavorite('arcenciel', 'base')
    expect(read<string[]>('artlequin_base_favs')).toEqual(['arcenciel'])
    w.toggleFavorite('arcenciel', 'base')
    expect(read<string[]>('artlequin_base_favs')).toEqual([])
  })
})

describe('workshops — historique', () => {
  it('place le dernier effet en tête, sans doublon, plafonné à 8', async () => {
    const w = await import('./workshops')
    const mk = (id: string) => ({
      id, type: 'color' as const, label: id, source: 'base' as const, isFavorite: false,
    })
    for (let i = 0; i < 10; i++) w.pushHistory(mk(`e${i}`))
    expect(w.history()).toHaveLength(8)
    expect(w.history()[0].id).toBe('e9')

    w.pushHistory(mk('e5'))
    expect(w.history()[0].id).toBe('e5')
    expect(w.history().filter(e => e.id === 'e5')).toHaveLength(1)
  })
})

describe('workshops — favoris et récents de taille et police', () => {
  it('les favoris de taille sont uniques et persistés', async () => {
    const w = await import('./workshops')
    w.addSizeFavorite(24)
    w.addSizeFavorite(24)
    expect(w.sizeFavorites()).toEqual([24])
    w.addSizeFavorite(36)
    expect(read<number[]>('artlequin_size_favs')).toEqual([24, 36])
    w.removeSizeFavorite(24)
    expect(w.sizeFavorites()).toEqual([36])
  })

  it('les récents de taille gardent les 3 derniers, le plus récent en tête', async () => {
    const w = await import('./workshops')
    for (const s of [10, 20, 30, 40]) w.pushSizeRecent(s)
    expect(w.sizeRecents()).toEqual([40, 30, 20])
    w.pushSizeRecent(20)
    expect(w.sizeRecents()).toEqual([20, 40, 30])
    w.removeSizeRecent(40)
    expect(w.sizeRecents()).toEqual([20, 30])
  })

  it('les favoris et récents de police suivent les mêmes règles', async () => {
    const w = await import('./workshops')
    w.addFontFavorite('Arial')
    w.addFontFavorite('Arial')
    expect(w.fontFavorites()).toEqual(['Arial'])
    for (const f of ['A', 'B', 'C', 'D']) w.pushFontRecent(f)
    expect(w.fontRecents()).toEqual(['D', 'C', 'B'])
    w.removeFontFavorite('Arial')
    expect(w.fontFavorites()).toEqual([])
  })
})

/* ══════════════════════════════════════════
   palettes
   ══════════════════════════════════════════ */

describe('palettes', () => {
  it('créer, renommer, activer et supprimer une palette', async () => {
    const p = await import('./palettes')
    const id = p.createPalette('Mines', [{ hex: '#c42b45', name: 'Rouge' }])
    expect(p.userPalettes()).toHaveLength(1)

    p.renamePalette(id, 'BDA')
    expect(p.userPalettes()[0].name).toBe('BDA')

    p.setActivePalette(id)
    expect(p.getActivePalette()?.id).toBe(id)
    expect(p.getToolbarColors()).toEqual([{ hex: '#c42b45', name: 'Rouge' }])

    p.deletePalette(id)
    expect(p.userPalettes()).toEqual([])
    expect(p.activePaletteId(), 'supprimer la palette active doit la désactiver').toBeNull()
  })

  it('sans palette active, la toolbar montre les couleurs de base visibles', async () => {
    const p = await import('./palettes')
    const total = p.getToolbarColors().length
    expect(total).toBeGreaterThan(0)

    const first = p.getToolbarColors()[0].hex
    p.toggleBaseColor(first)
    expect(p.isBaseColorHidden(first)).toBe(true)
    expect(p.getToolbarColors()).toHaveLength(total - 1)

    p.toggleBaseColor(first)
    expect(p.getToolbarColors()).toHaveLength(total)
  })

  it('une couleur ajoutée deux fois n\'apparaît qu\'une fois', async () => {
    const p = await import('./palettes')
    p.addCustomBaseColor({ hex: '#ABCDEF', name: 'X' })
    p.addCustomBaseColor({ hex: '#abcdef', name: 'X bis' })
    expect(p.getToolbarColors().filter(c => c.hex.toLowerCase() === '#abcdef')).toHaveLength(1)
  })

  it('addToolbarColor vise la palette active si elle existe, sinon les couleurs de base', async () => {
    const p = await import('./palettes')
    p.addToolbarColor({ hex: '#111111', name: 'A' })
    expect(read<unknown[]>('artlequin_custom_base_colors')).toHaveLength(1)

    const id = p.createPalette('P', [])
    p.setActivePalette(id)
    p.addToolbarColor({ hex: '#222222', name: 'B' })
    expect(p.getActivePalette()!.colors).toEqual([{ hex: '#222222', name: 'B' }])
    expect(read<unknown[]>('artlequin_custom_base_colors'), 'ne doit pas toucher les couleurs de base').toHaveLength(1)
  })

  it('removeToolbarColor masque une couleur de base mais supprime une couleur custom', async () => {
    const p = await import('./palettes')
    const baseHex = p.getVisibleBaseColors()[0].hex
    p.addCustomBaseColor({ hex: '#999999', name: 'C' })

    p.removeToolbarColor(baseHex)
    expect(p.isBaseColorHidden(baseHex)).toBe(true)

    p.removeToolbarColor('#999999')
    expect(read<unknown[]>('artlequin_custom_base_colors')).toEqual([])
  })

  it('resetBaseColors restaure tout', async () => {
    const p = await import('./palettes')
    const hex = p.getVisibleBaseColors()[0].hex
    p.toggleBaseColor(hex)
    p.addCustomBaseColor({ hex: '#123456', name: 'Z' })
    p.resetBaseColors()
    expect(p.isBaseColorHidden(hex)).toBe(false)
    expect(read<unknown[]>('artlequin_custom_base_colors')).toEqual([])
  })

  it('les palettes survivent à un rechargement', async () => {
    const p1 = await import('./palettes')
    const id = p1.createPalette('Persistante', [{ hex: '#abcdef', name: 'A' }])
    p1.setActivePalette(id)

    vi.resetModules()
    const p2 = await import('./palettes')
    expect(p2.userPalettes()).toHaveLength(1)
    expect(p2.getActivePalette()?.name).toBe('Persistante')
  })
})

/* ══════════════════════════════════════════
   emojis
   ══════════════════════════════════════════ */

describe('emojis', () => {
  it('ajoute et supprime un emoji perso en persistant', async () => {
    const e = await import('./emojis')
    e.addPersoEmoji('🎭', 'Masque')
    expect(e.getPersoEmojis()).toHaveLength(1)
    const id = e.getPersoEmojis()[0].id
    e.removePersoEmoji(id)
    expect(e.getPersoEmojis()).toEqual([])
  })

  it('bascule un favori et le persiste', async () => {
    const e = await import('./emojis')
    e.toggleEmojiFavorite('🎭')
    expect(e.isEmojiFavorite('🎭')).toBe(true)
    expect(read<string[]>('artlequin_emoji_favs')).toEqual(['🎭'])
    e.toggleEmojiFavorite('🎭')
    expect(e.isEmojiFavorite('🎭')).toBe(false)
  })

  it('getBaseEmojis ne plante pas quand admin-data n\'a pas de champ emojis', async () => {
    // Regression : AdminData n'exposait pas `emojis`, .map sur undefined.
    const e = await import('./emojis')
    expect(() => e.getBaseEmojis()).not.toThrow()
    expect(() => e.getAllEmojis()).not.toThrow()
  })
})

/* ══════════════════════════════════════════
   admin
   ══════════════════════════════════════════ */

describe('mode admin', () => {
  it('s\'active, se désactive et survit à un rechargement', async () => {
    const a1 = await import('./admin')
    expect(a1.isAdmin()).toBe(false)
    a1.activateAdmin()
    expect(a1.isAdmin()).toBe(true)

    vi.resetModules()
    const a2 = await import('./admin')
    expect(a2.isAdmin()).toBe(true)

    a2.deactivateAdmin()
    expect(a2.isAdmin()).toBe(false)
    expect(localStorage.getItem('artlequin_admin')).toBeNull()
  })

  it('toggleAdmin retourne le nouvel état', async () => {
    const a = await import('./admin')
    expect(a.toggleAdmin()).toBe(true)
    expect(a.toggleAdmin()).toBe(false)
  })
})

/* ══════════════════════════════════════════
   admin-data
   ══════════════════════════════════════════ */

describe('admin-data', () => {
  it('sème les effets depuis le code quand le serveur est injoignable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    const ad = await import('./admin-data')
    await ad.loadAdminData()
    expect(Object.keys(ad.adminData().colorEffects).length).toBeGreaterThan(5)
    expect(Object.keys(ad.adminData().sizeEffects).length).toBeGreaterThan(5)
    vi.unstubAllGlobals()
  })

  it('les profils semés sont des formes [0,1]', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    const ad = await import('./admin-data')
    await ad.loadAdminData()
    for (const [id, e] of Object.entries(ad.adminData().sizeEffects)) {
      expect(Math.min(...e.profile), id).toBeGreaterThanOrEqual(0)
      expect(Math.max(...e.profile), id).toBeLessThanOrEqual(1)
    }
    vi.unstubAllGlobals()
  })

  it('renommer un effet de taille le marque et conserve son profil', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    const ad = await import('./admin-data')
    await ad.loadAdminData()
    const id = Object.keys(ad.adminData().sizeEffects)[0]
    const profile = ad.adminData().sizeEffects[id].profile
    ad.adminRenameSizeEffect(id, 'Nouveau nom')
    expect(ad.adminData().sizeEffects[id].name).toBe('Nouveau nom')
    expect(ad.adminData().sizeEffects[id].profile).toEqual(profile)
    vi.unstubAllGlobals()
  })

  it('ajouter puis retirer un effet couleur, et le suivi des modifications', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    const ad = await import('./admin-data')
    await ad.loadAdminData()
    ad.adminSetColorEffect('neuf', { name: 'Neuf', colors: ['#fff'] })
    expect(ad.isColorEffectDirty('neuf')).toBe(true)
    ad.adminRemoveColorEffect('neuf')
    expect(ad.adminData().colorEffects.neuf).toBeUndefined()
    vi.unstubAllGlobals()
  })
})

/* ══════════════════════════════════════════
   size-profiles — le registre lu par l'éditeur
   ══════════════════════════════════════════ */

describe('size-profiles', () => {
  it('résout un effet de base et un effet perso par le même chemin', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    const ad = await import('./admin-data')
    await ad.loadAdminData()
    const { addPersoEffect } = await import('./workshops')
    const { resolveSizeProfile } = await import('./size-profiles')

    const baseId = Object.keys(ad.adminData().sizeEffects)[0]
    expect(resolveSizeProfile(baseId)).toEqual(ad.adminData().sizeEffects[baseId].profile)

    addPersoEffect({ id: 'p1', type: 'custom-size', label: 'P', profile: [0, 0.5, 1] })
    expect(resolveSizeProfile('p1')).toEqual([0, 0.5, 1])

    expect(resolveSizeProfile('inconnu')).toBeNull()
    expect(resolveSizeProfile(null)).toBeNull()
    vi.unstubAllGlobals()
  })
})

/* ══════════════════════════════════════════
   undo-redo
   ══════════════════════════════════════════ */

describe('undo-redo', () => {
  const setup = async () => {
    const u = await import('./undo-redo')
    const el = document.createElement('div')
    document.body.appendChild(el)
    el.innerHTML = '<span>a</span>'
    u.initUndoSystem(el)
    return { u, el }
  }

  it('une opération enregistrée est annulable puis rétablissable', async () => {
    const { u, el } = await setup()
    const op = u.recordOperation('Couleur', 'format')
    el.innerHTML = '<span style="color:red">a</span>'
    op.commit()

    expect(u.canUndo()).toBe(true)
    expect(u.undoLabel()).toBe('Couleur')

    u.performUndo()
    expect(el.innerHTML).toBe('<span>a</span>')
    expect(u.canRedo()).toBe(true)

    u.performRedo()
    expect(el.innerHTML).toBe('<span style="color:red">a</span>')
    el.remove()
  })

  it('une nouvelle opération après un undo efface la branche de redo', async () => {
    const { u, el } = await setup()
    const a = u.recordOperation('A', 'format'); el.innerHTML = '<span>b</span>'; a.commit()
    u.performUndo()
    expect(u.canRedo()).toBe(true)

    const c = u.recordOperation('C', 'format'); el.innerHTML = '<span>c</span>'; c.commit()
    expect(u.canRedo(), 'la branche de redo doit être abandonnée').toBe(false)
    el.remove()
  })

  it('la frappe est groupée par mots', async () => {
    const { u, el } = await setup()
    for (const ch of 'abc') { u.recordTypingChar(ch); el.innerHTML += `<span>${ch}</span>` }
    u.recordTypingChar(' ')
    // La frontiere de mot ferme le groupe precedent
    expect(u.undoLabel()).toBe("Frappe 'abc'")
    u.flushTyping()
    // historyEntries() insère un marqueur « État actuel », lui aussi
    // catégorisé 'typing' : on ne compte que les vraies entrées.
    const typed = u.historyEntries().filter(e => e.category === 'typing' && !e.isCurrent)
    expect(typed.map(e => e.label)).toEqual(["Frappe ' '", "Frappe 'abc'"])
    el.remove()
  })

  it('flushTyping avant une opération évite de mélanger frappe et format', async () => {
    const { u, el } = await setup()
    u.recordTypingChar('x')
    const op = u.recordOperation('Gras', 'format')
    el.innerHTML = '<b>x</b>'
    op.commit()
    const labels = u.historyEntries().map(e => e.label)
    expect(labels).toContain('Gras')
    expect(labels.some(l => l.startsWith('Frappe'))).toBe(true)
    el.remove()
  })

  it('jumpToEntry navigue directement dans le passé et le futur', async () => {
    const { u, el } = await setup()
    for (const s of ['b', 'c', 'd']) {
      const op = u.recordOperation(s, 'format')
      el.innerHTML = `<span>${s}</span>`
      op.commit()
    }
    // index 0 = etat actuel quand la pile de redo est vide
    u.jumpToEntry(2)
    expect(el.innerHTML).toBe('<span>b</span>')
    u.jumpToEntry(0)
    expect(el.innerHTML).toBe('<span>d</span>')
    el.remove()
  })

  it('undo sur une pile vide ne fait rien et ne lève pas', async () => {
    const { u, el } = await setup()
    expect(u.performUndo()).toBe(false)
    expect(u.performRedo()).toBe(false)
    el.remove()
  })

  it('l\'historique visible expose un marqueur d\'état actuel unique', async () => {
    const { u, el } = await setup()
    const op = u.recordOperation('A', 'format'); el.innerHTML = '<span>z</span>'; op.commit()
    expect(u.historyEntries().filter(e => e.isCurrent)).toHaveLength(1)
    el.remove()
  })

  it('le curseur est restauré après un undo', async () => {
    const { u, el } = await setup()
    el.innerHTML = '<span>abc</span>'
    const text = el.querySelector('span')!.firstChild!
    const sel = window.getSelection()!
    const r = document.createRange()
    r.setStart(text, 2); r.collapse(true)
    sel.removeAllRanges(); sel.addRange(r)

    const op = u.recordOperation('Op', 'format')
    el.innerHTML = '<span>abcd</span>'
    op.commit()
    u.performUndo()

    const after = window.getSelection()!
    expect(el.contains(after.anchorNode)).toBe(true)
    expect(after.anchorOffset).toBe(2)
    el.remove()
  })
})
