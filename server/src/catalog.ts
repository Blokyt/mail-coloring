/**
 * Catalogue d'effets — lu de public/admin-data.json (la seule vérité du
 * colorieur, partagée front/API). bgEffects : chaque effet texte décline
 * son double en fond (id_bg), comme le site (getEffectiveBgEffects).
 */
import fs from 'node:fs'
import { config } from './config.js'
import type { EffectsCatalog } from '../../src/engine/render.js'

export interface CatalogFile {
  colorEffects?: Record<string, { name: string; colors: string[] }>
  sizeEffects?: Record<string, { name: string; profile: number[] }>
}

export function loadCatalog(path = config.catalogPath): EffectsCatalog {
  const raw = JSON.parse(fs.readFileSync(path, 'utf8')) as CatalogFile
  return {
    colorEffects: raw.colorEffects ?? {},
    sizeEffects: raw.sizeEffects ?? {},
  }
}
