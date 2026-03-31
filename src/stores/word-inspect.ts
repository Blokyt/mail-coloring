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
  spans: HTMLElement[]
}

// Signal partagé entre Editor et Header — dans un fichier séparé
// pour survivre au HMR de Vite sans être recréé
const [activeWord, setActiveWord] = createSignal<WordInspect | null>(null)

export { activeWord, setActiveWord }
