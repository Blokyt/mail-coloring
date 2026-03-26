import { createSignal } from 'solid-js'
import type { AnchorPosition } from './admin-data'

/* ── Types ── */

export interface TutorialAction {
  type: 'select-text' | 'click-element' | 'dblclick-element'
  targetSelector?: string  // defaut = step.targetSelector
  hint?: string
}

export interface TutorialStep {
  id: string
  title: string
  description: string
  targetSelector: string
  position: AnchorPosition
  module: string
  action?: TutorialAction
}

/* ── Constantes de positionnement ── */

export const BUBBLE_WIDTH = 340
export const BUBBLE_HEIGHT = 200
export const SPOT_PADDING = 8
export const CENTER_BIAS = 0.15
export const VIEWPORT_MARGIN = 16
export const BUBBLE_GAP = 16

/* ── Scenario — informatif + interactif ── */
export const TUTORIAL_STEPS: TutorialStep[] = [
  // Module A — Comprendre l'interface
  { id: 'welcome', module: 'Interface', title: 'Mail Colorer', description: 'Bienvenue ! Cette app permet de creer des emails colores compatibles Outlook. Voici un tour rapide de ses fonctionnalites uniques.', targetSelector: '.brand-pill', position: 'bottom' },
  { id: 'editor', module: 'Interface', title: 'L\'editeur 3 colonnes', description: 'L\'editeur affiche 3 pages a la fois. Quand le texte deborde de la 3e, l\'affichage glisse automatiquement. Les retours a la ligne dans l\'editeur sont visuels (colonnes CSS) — pour un vrai retour a la ligne dans l\'email, utilisez Entree.', targetSelector: '.editor-viewport', position: 'bottom-right' },
  { id: 'panels', module: 'Interface', title: 'Les panneaux d\'effets', description: 'A gauche : les effets couleur — chaque lettre recoit une couleur du cycle. A droite : les effets taille — la courbe montre comment la taille varie lettre par lettre.', targetSelector: '.side-panel-left', position: 'right' },

  // Module B — Appliquer un effet (selection)
  { id: 'apply-select', module: 'Appliquer', title: 'Methode 1 : selection', description: 'Pour appliquer un effet : selectionnez du texte (cliquer-glisser), puis cliquez un effet dans le panneau. Il se pose directement sur la selection. Couleur et taille sont independants.', targetSelector: '.side-panel-left', position: 'right',
    action: { type: 'select-text', targetSelector: '.editor-viewport', hint: 'Selectionnez du texte dans l\'editeur' } },
  { id: 'apply-combine', module: 'Appliquer', title: 'Combiner les effets', description: 'Vous pouvez appliquer couleur et taille separement sur le meme texte. La couleur ne modifie jamais la taille, et inversement.', targetSelector: '.side-panel-right', position: 'left' },

  // Module C — Le double-clic (concept cle)
  { id: 'dblclick-intro', module: 'Double-clic', title: 'Methode 2 : double-clic', description: 'Le double-clic est LA fonctionnalite cle de Mail Colorer. Il applique instantanement le style de la barre du haut (police, taille, couleur, gras...) au mot clique. Attention : dans cette app, le double-clic ne selectionne PAS le mot — il le formate.', targetSelector: '.editor-viewport', position: 'bottom-right' },
  { id: 'arm-effect', module: 'Double-clic', title: 'Armer un effet', description: 'Pour aller plus vite : sans texte selectionne, cliquez un effet dans le panneau. Au lieu de l\'appliquer, il s\'arme — une bordure orange apparait. Ensuite, chaque double-clic appliquera cet effet en plus du style de la barre.', targetSelector: '.side-panel-left', position: 'right',
    action: { type: 'click-element', targetSelector: '.side-panel-left .effect-card', hint: 'Cliquez un effet dans le panneau gauche' } },
  { id: 'armed-rules', module: 'Double-clic', title: 'Les regles du double-clic', description: 'Le double-clic applique toujours la barre (police, gras, couleur...). Si un effet couleur est arme, il remplace la couleur de la barre. Si un effet taille est arme, il remplace la taille. Les deux sont cumulables. Pour desarmer : recliquez l\'effet dans le panneau.', targetSelector: '.editor-viewport', position: 'bottom-right' },

  // Module D — Creer ses propres effets
  { id: 'catalog', module: 'Creer', title: 'Le catalogue', description: 'Les boutons Catalogue / Mon atelier / Creer ouvrent l\'atelier d\'effets. Vous y trouverez tous les effets de base, vos creations personnelles, et les outils pour en fabriquer de nouveaux.', targetSelector: '.toolbar-row:last-child', position: 'bottom',
    action: { type: 'click-element', targetSelector: '.toolbar-row:last-child button', hint: 'Cliquez un bouton de la barre catalogue' } },
  { id: 'create-overview', module: 'Creer', title: 'Creer un effet', description: 'Quatre facons de creer : palette de couleurs personnalisee, trace libre (dessinez une courbe de taille a la souris), fonction mathematique f(x), ou effet compose qui combine taille + couleur + police + emoji.', targetSelector: '.editor-viewport', position: 'bottom-right' },

  // Module E — Export
  { id: 'copy-outlook', module: 'Exporter', title: 'Exporter pour Outlook', description: 'Le bouton "Copier" genere du HTML avec tous les styles en ligne — compatible Outlook, Gmail, et tous les clients mail. Collez directement dans votre email.', targetSelector: '.btn-peach', position: 'bottom',
    action: { type: 'click-element', targetSelector: '.btn-peach', hint: 'Cliquez le bouton Copier' } },
  { id: 'done', module: 'Termine', title: 'C\'est parti !', description: 'Vous connaissez l\'essentiel. Pour selectionner du texte, utilisez le cliquer-glisser. Pour formater mot par mot, utilisez le double-clic. Relancez ce guide avec "?" a tout moment.', targetSelector: '.brand-pill', position: 'bottom' },
]

/** Ensemble des IDs valides pour detecter les orphelins */
export const VALID_STEP_IDS = new Set(TUTORIAL_STEPS.map(s => s.id))

/* ── Positionnement anchor-based ── */

export function computeAnchorPosition(
  anchor: AnchorPosition,
  targetRect: DOMRect,
  bubbleW: number,
  bubbleH: number,
  gap: number,
): { top: number; left: number } {
  const vw = window.innerWidth
  const vh = window.innerHeight

  switch (anchor) {
    case 'bottom':
      return { top: targetRect.bottom + gap, left: targetRect.left + targetRect.width / 2 - bubbleW / 2 }
    case 'top':
      return { top: targetRect.top - gap - bubbleH, left: targetRect.left + targetRect.width / 2 - bubbleW / 2 }
    case 'right':
      return { top: targetRect.top + targetRect.height / 2 - bubbleH / 2, left: targetRect.right + gap }
    case 'left':
      return { top: targetRect.top + targetRect.height / 2 - bubbleH / 2, left: targetRect.left - gap - bubbleW }
    case 'bottom-right':
      return { top: vh - bubbleH - 60, left: vw - bubbleW - 60 }
    case 'bottom-left':
      return { top: vh - bubbleH - 60, left: 60 }
    case 'top-right':
      return { top: 60, left: vw - bubbleW - 60 }
    case 'top-left':
      return { top: 60, left: 60 }
    case 'center':
      return { top: vh / 2 - bubbleH / 2, left: vw / 2 - bubbleW / 2 }
    default:
      return { top: vh / 2 - bubbleH / 2, left: vw / 2 - bubbleW / 2 }
  }
}

/* ── Validation ── */

export interface StepValidation {
  valid: boolean
  error?: string
}

export function validateStep(step: TutorialStep): StepValidation {
  if (!step.id || !step.targetSelector) return { valid: false, error: 'ID ou targetSelector manquant' }
  const el = document.querySelector(step.targetSelector)
  if (!el) return { valid: false, error: `Selecteur "${step.targetSelector}" introuvable` }
  const rect = el.getBoundingClientRect()
  if (rect.width === 0 && rect.height === 0) return { valid: false, error: `Element "${step.targetSelector}" invisible (0x0)` }
  return { valid: true }
}

/* ── State ── */

const STORAGE_KEY = 'artlequin_tutorial_done'

const [tutorialActive, setTutorialActive] = createSignal(false)
const [currentStep, setCurrentStep] = createSignal(0)
const [tutorialCompleted, setTutorialCompleted] = createSignal(
  localStorage.getItem(STORAGE_KEY) === 'true'
)

export function startTutorial() {
  setCurrentStep(0)
  setTutorialActive(true)
}

export function nextStep() {
  const next = currentStep() + 1
  if (next >= TUTORIAL_STEPS.length) {
    completeTutorial()
  } else {
    setCurrentStep(next)
  }
}

export function prevStep() {
  setCurrentStep(Math.max(0, currentStep() - 1))
}

export function skipTutorial() {
  completeTutorial()
}

export function completeTutorial() {
  setTutorialActive(false)
  setTutorialCompleted(true)
  localStorage.setItem(STORAGE_KEY, 'true')
}

export function resetTutorial() {
  setTutorialCompleted(false)
  localStorage.removeItem(STORAGE_KEY)
}

export function shouldShowWelcome(): boolean {
  return !tutorialCompleted()
}

export { tutorialActive, currentStep, tutorialCompleted }
