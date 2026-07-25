import { createSignal } from 'solid-js'

export interface WordInspect {
  word: string
  color: string
  bg: string
  size: string
  font: string
  bold: boolean
  italic: boolean
  underline: boolean
  strike: boolean
  link: string | null
  linkEl: HTMLAnchorElement | null
  /** Spans du mot — valides seulement jusqu'à la prochaine mutation.
   *  Ne JAMAIS s'en servir pour muter : utiliser `range`. */
  spans: HTMLElement[]
  /** Position du mot en offsets d'atomes — survit aux reconstructions du DOM
   *  (opérations, undo), contrairement aux références de nœuds. */
  range: { start: number; end: number }
}

// Signal partagé entre Editor et Header — dans un fichier séparé
// pour survivre au HMR de Vite sans être recréé
const [activeWord, setActiveWord] = createSignal<WordInspect | null>(null)

export { activeWord, setActiveWord }
