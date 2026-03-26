import { createSignal } from 'solid-js'

export interface TutorialStep {
  id: string
  title: string
  description: string
  targetSelector: string
  position: 'top' | 'bottom' | 'left' | 'right' | 'bottom-right'
  module: string
}

/* ── Scenario — informatif, focus app, formulations explicatives ── */
export const TUTORIAL_STEPS: TutorialStep[] = [
  // Module A — Comprendre l'interface
  { id: 'welcome', module: 'Interface', title: 'Mail Colorer', description: 'Bienvenue ! Cette app permet de creer des emails colores compatibles Outlook. Voici un tour rapide de ses fonctionnalites uniques.', targetSelector: '.brand-pill', position: 'bottom' },
  { id: 'editor', module: 'Interface', title: 'L\'editeur 3 colonnes', description: 'L\'editeur affiche 3 pages a la fois. Quand le texte deborde de la 3e, l\'affichage glisse automatiquement. Les retours a la ligne dans l\'editeur sont visuels (colonnes CSS) — pour un vrai retour a la ligne dans l\'email, utilisez Entree.', targetSelector: '.editor-viewport', position: 'bottom-right' },
  { id: 'panels', module: 'Interface', title: 'Les panneaux d\'effets', description: 'A gauche : les effets couleur — chaque lettre recoit une couleur du cycle. A droite : les effets taille — la courbe montre comment la taille varie lettre par lettre.', targetSelector: '.side-panel-left', position: 'right' },

  // Module B — Appliquer un effet (selection)
  { id: 'apply-select', module: 'Appliquer', title: 'Methode 1 : selection', description: 'Pour appliquer un effet : selectionnez du texte (cliquer-glisser), puis cliquez un effet dans le panneau. Il se pose directement sur la selection. Couleur et taille sont independants.', targetSelector: '.side-panel-left', position: 'right' },
  { id: 'apply-combine', module: 'Appliquer', title: 'Combiner les effets', description: 'Vous pouvez appliquer couleur et taille separement sur le meme texte. La couleur ne modifie jamais la taille, et inversement.', targetSelector: '.side-panel-right', position: 'left' },

  // Module C — Le double-clic (concept cle)
  { id: 'dblclick-intro', module: 'Double-clic', title: 'Methode 2 : double-clic', description: 'Le double-clic est LA fonctionnalite cle de Mail Colorer. Il applique instantanement le style de la barre du haut (police, taille, couleur, gras...) au mot clique. Attention : dans cette app, le double-clic ne selectionne PAS le mot — il le formate.', targetSelector: '.editor-viewport', position: 'bottom-right' },
  { id: 'arm-effect', module: 'Double-clic', title: 'Armer un effet', description: 'Pour aller plus vite : sans texte selectionne, cliquez un effet dans le panneau. Au lieu de l\'appliquer, il s\'arme — une bordure orange apparait. Ensuite, chaque double-clic appliquera cet effet en plus du style de la barre.', targetSelector: '.side-panel-left', position: 'right' },
  { id: 'armed-rules', module: 'Double-clic', title: 'Les regles du double-clic', description: 'Le double-clic applique toujours la barre (police, gras, couleur...). Si un effet couleur est arme, il remplace la couleur de la barre. Si un effet taille est arme, il remplace la taille. Les deux sont cumulables. Pour desarmer : recliquez l\'effet dans le panneau.', targetSelector: '.editor-viewport', position: 'bottom-right' },

  // Module D — Creer ses propres effets
  { id: 'catalog', module: 'Creer', title: 'Le catalogue', description: 'Les boutons Catalogue / Mon atelier / Creer ouvrent l\'atelier d\'effets. Vous y trouverez tous les effets de base, vos creations personnelles, et les outils pour en fabriquer de nouveaux.', targetSelector: '.toolbar-row:last-child', position: 'bottom' },
  { id: 'create-overview', module: 'Creer', title: 'Creer un effet', description: 'Quatre facons de creer : palette de couleurs personnalisee, trace libre (dessinez une courbe de taille a la souris), fonction mathematique f(x), ou effet compose qui combine taille + couleur + police + emoji.', targetSelector: '.editor-viewport', position: 'bottom-right' },

  // Module E — Export
  { id: 'copy-outlook', module: 'Exporter', title: 'Exporter pour Outlook', description: 'Le bouton "Copier" genere du HTML avec tous les styles en ligne — compatible Outlook, Gmail, et tous les clients mail. Collez directement dans votre email.', targetSelector: '.btn-peach', position: 'bottom' },
  { id: 'done', module: 'Termine', title: 'C\'est parti !', description: 'Vous connaissez l\'essentiel. Pour selectionner du texte, utilisez le cliquer-glisser. Pour formater mot par mot, utilisez le double-clic. Relancez ce guide avec "?" a tout moment.', targetSelector: '.brand-pill', position: 'bottom' },
]

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

function completeTutorial() {
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
