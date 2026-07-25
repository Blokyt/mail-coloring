/**
 * Registre unique des profils de taille.
 *
 * Un marqueur [data-size-effect="<id>"] dans l'éditeur ne stocke QUE l'id.
 * Ni l'amplitude ni la taille de base ne sont figées dans le DOM : elles sont
 * relues du store au moment du rendu, ce qui garantit que
 *   « appliquer l'effet à la taille N »  ==  « appliquer à 18 puis glisser à N ».
 *
 * Tous les profils rendus ici sont des FORMES [0,1] (voir normalizeProfile).
 */

import { adminData } from './admin-data'
import { getPersoEffects } from './workshops'

/** Résout un id d'effet taille en profil forme [0,1], quelle que soit sa source. */
export function resolveSizeProfile(id: string | null | undefined): number[] | null {
  if (!id) return null

  // Effets de base (admin-data.json)
  const base = adminData().sizeEffects?.[id]?.profile
  if (base && base.length > 0) return base

  // Effets perso (atelier, localStorage)
  const perso = getPersoEffects().find(e => e.id === id)
  if (perso?.profile && perso.profile.length > 0) return perso.profile

  return null
}
