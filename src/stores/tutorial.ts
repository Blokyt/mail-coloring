import { createSignal } from 'solid-js'

export interface TutorialStep {
  id: string
  title: string
  description: string
  targetSelector: string
  position: 'top' | 'bottom' | 'left' | 'right' | 'bottom-right'
  module: string
}

/* ── Scenario — focus sur ce qui est unique a l'app ── */
export const TUTORIAL_STEPS: TutorialStep[] = [
  // Module A — Comprendre l'interface
  { id: 'welcome', module: 'Interface', title: 'Mail Colorer', description: 'Creez des emails colores compatibles Outlook. Ce guide vous montre les fonctionnalites uniques de l\'app.', targetSelector: '.brand-pill', position: 'bottom' },
  { id: 'editor', module: 'Interface', title: 'L\'editeur 3 colonnes', description: 'L\'editeur se decoupe en 3 pages visibles. Quand vous remplissez la 3e, il glisse automatiquement pour montrer la suite.', targetSelector: '.editor-viewport', position: 'bottom-right' },
  { id: 'panels', module: 'Interface', title: 'Les panneaux d\'effets', description: 'A gauche : les effets de couleur (chaque lettre recoit une couleur du cycle). A droite : les effets de taille (la courbe montre la variation). Ces effets sont le coeur de l\'app.', targetSelector: '.side-panel-left', position: 'right' },

  // Module B — Appliquer un effet (selection)
  { id: 'type-word', module: 'Appliquer', title: 'Ecrivez un mot', description: 'Tapez "Bonjour" dans l\'editeur.', targetSelector: '.editor-viewport', position: 'bottom-right' },
  { id: 'select-word', module: 'Appliquer', title: 'Selectionnez-le', description: 'Faites un cliquer-glisser sur le mot. Important : dans cette app, le double-clic ne selectionne PAS — il applique le formatage (on verra ca juste apres).', targetSelector: '.editor-viewport', position: 'bottom-right' },
  { id: 'apply-color', module: 'Appliquer', title: 'Cliquez un effet', description: 'Avec le mot selectionne, cliquez sur "Arc-en-ciel" a gauche. L\'effet se pose directement sur la selection.', targetSelector: '.side-panel-left', position: 'right' },
  { id: 'apply-size', module: 'Appliquer', title: 'Ajoutez la taille', description: 'Re-selectionnez le mot, puis cliquez sur "Vague" a droite. Couleur et taille sont independants : la couleur ne touche pas la taille et inversement.', targetSelector: '.side-panel-right', position: 'left' },

  // Module C — Le double-clic (concept cle)
  { id: 'deselect', module: 'Double-clic', title: 'Deselectionnez', description: 'Cliquez dans le vide de l\'editeur pour tout deselectionner. On va decouvrir le double-clic.', targetSelector: '.editor-viewport', position: 'bottom-right' },
  { id: 'dblclick-basic', module: 'Double-clic', title: 'Double-cliquez un mot', description: 'Double-cliquez sur un mot : il recoit le style de la barre du haut (police, taille, couleur, gras...). C\'est la facon rapide de formater mot par mot.', targetSelector: '.editor-viewport', position: 'bottom-right' },
  { id: 'arm-effect', module: 'Double-clic', title: 'Armez un effet', description: 'Sans rien selectionner, cliquez sur un effet couleur dans le panneau. Au lieu de l\'appliquer, il s\'arme : une bordure orange apparait.', targetSelector: '.side-panel-left', position: 'right' },
  { id: 'dblclick-armed', module: 'Double-clic', title: 'Double-cliquez a nouveau', description: 'Double-cliquez sur un mot : l\'effet arme s\'ajoute au style de la barre ! C\'est la methode la plus rapide pour colorier mot par mot.', targetSelector: '.editor-viewport', position: 'bottom-right' },
  { id: 'armed-rules', module: 'Double-clic', title: 'Les regles', description: 'Un effet couleur arme colore les lettres sans toucher a la taille. Un effet taille arme change la taille sans toucher aux couleurs. Vous pouvez armer les deux en meme temps. Pour desarmer, recliquez sur l\'effet dans le panneau.', targetSelector: '.side-panel-left', position: 'right' },

  // Module D — Creer ses propres effets
  { id: 'open-catalog', module: 'Creer', title: 'Le catalogue', description: '"Catalogue" montre tous les effets. "Mon atelier" vos creations. "Creer" pour en fabriquer.', targetSelector: '.btn-compact', position: 'bottom' },
  { id: 'create-overview', module: 'Creer', title: 'Quatre facons de creer', description: 'Palette couleur : choisissez vos couleurs. Trace libre : dessinez une courbe de taille a la souris. Fonction f(x) : definissez une courbe mathematique. Compose : combinez taille + couleur + police + emoji en un seul effet.', targetSelector: '.editor-viewport', position: 'bottom-right' },

  // Module E — Export
  { id: 'copy-outlook', module: 'Exporter', title: 'Copier pour Outlook', description: 'Cliquez "Copier" : le HTML est dans votre presse-papier, pret a coller dans Outlook. Tous les styles sont en ligne, compatible partout.', targetSelector: '.btn-peach', position: 'bottom' },
  { id: 'done', module: 'Termine', title: 'C\'est parti !', description: 'Vous savez tout. Ecrivez, coloriez, exportez. Relancez ce guide avec le bouton "?" a tout moment.', targetSelector: '.brand-pill', position: 'bottom' },
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
