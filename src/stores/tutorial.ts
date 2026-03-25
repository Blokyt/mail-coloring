import { createSignal } from 'solid-js'

export interface TutorialStep {
  id: string
  title: string
  description: string
  targetSelector: string
  position: 'top' | 'bottom' | 'left' | 'right' | 'bottom-right'
  action?: 'click' | 'type' | 'select' | 'dblclick' | 'none'
  module: string
}

/* ── Scenario complet ── */
export const TUTORIAL_STEPS: TutorialStep[] = [
  // Module A — Decouverte
  { id: 'welcome', module: 'Decouverte', title: 'Bienvenue !', description: 'Mail Colorer vous permet de creer des emails colores directement compatibles Outlook. Suivez ce guide pour decouvrir toutes les possibilites !', targetSelector: '.brand-pill', position: 'bottom', action: 'none' },
  { id: 'editor', module: 'Decouverte', title: 'L\'editeur', description: 'C\'est ici que vous ecrivez votre email. Le texte se repartit sur 3 colonnes visibles et defilera automatiquement.', targetSelector: '.editor-viewport', position: 'bottom-right', action: 'none' },
  { id: 'hotbar', module: 'Decouverte', title: 'La barre de style', description: 'Cette barre montre le style du prochain caractere que vous taperez : police, taille, couleur, gras, italique...', targetSelector: '.status-bar', position: 'bottom', action: 'none' },
  { id: 'panel-left', module: 'Decouverte', title: 'Effets de couleur', description: 'Les effets de couleur sont a gauche. Chaque tag represente un cycle de couleurs different.', targetSelector: '.side-panel-left', position: 'right', action: 'none' },
  { id: 'panel-right', module: 'Decouverte', title: 'Effets de taille', description: 'Les effets de taille sont a droite. La courbe montre comment la taille varie sur chaque caractere.', targetSelector: '.side-panel-right', position: 'left', action: 'none' },

  // Module B — Colorier
  { id: 'type-word', module: 'Colorier', title: 'Ecrivez un mot', description: 'Cliquez dans l\'editeur et tapez "Bonjour" pour commencer.', targetSelector: '.editor-viewport', position: 'bottom-right', action: 'type' },
  { id: 'select-word', module: 'Colorier', title: 'Selectionnez le mot', description: 'Faites un cliquer-glisser sur "Bonjour" pour le selectionner. Attention : le double-clic applique les effets armes, il ne sert pas a selectionner !', targetSelector: '.editor-viewport', position: 'bottom-right', action: 'select' },
  { id: 'apply-color', module: 'Colorier', title: 'Appliquer un effet couleur', description: 'Avec votre mot selectionne, cliquez sur un effet dans le panneau de gauche (ex: "Arc-en-ciel"). L\'effet s\'applique directement sur la selection !', targetSelector: '.side-panel-left', position: 'right', action: 'click' },
  { id: 'see-result', module: 'Colorier', title: 'Resultat !', description: 'Chaque lettre a maintenant sa propre couleur ! Selectionnez a nouveau le mot pour continuer.', targetSelector: '.editor-viewport', position: 'bottom-right', action: 'none' },
  { id: 'apply-size', module: 'Colorier', title: 'Effet de taille', description: 'Re-selectionnez le mot (cliquer-glisser), puis cliquez sur un effet de taille a droite (ex: "Vague").', targetSelector: '.side-panel-right', position: 'left', action: 'click' },
  { id: 'combine', module: 'Colorier', title: 'Combiner !', description: 'Vous pouvez combiner couleur ET taille sur le meme texte. Les deux effets s\'appliquent independamment.', targetSelector: '.editor-viewport', position: 'bottom-right', action: 'none' },

  // Module C — Mode arme (toggle)
  { id: 'deselect', module: 'Mode arme', title: 'Deselectionnez d\'abord', description: 'Cliquez dans une zone vide de l\'editeur pour deselectionner le texte. Le mode arme ne fonctionne que quand RIEN n\'est selectionne.', targetSelector: '.editor-viewport', position: 'bottom-right', action: 'click' },
  { id: 'arm-effect', module: 'Mode arme', title: 'Armer un effet', description: 'Sans texte selectionne, cliquez sur un effet couleur dans le panneau. Au lieu de l\'appliquer, il s\'arme (bordure orange).', targetSelector: '.side-panel-left', position: 'right', action: 'click' },
  { id: 'armed-state', module: 'Mode arme', title: 'Effet arme', description: 'L\'effet est maintenant "arme" — la bordure orange le signale. Il sera applique automatiquement a chaque double-clic sur un mot.', targetSelector: '.side-panel-left', position: 'right', action: 'none' },
  { id: 'dblclick', module: 'Mode arme', title: 'Double-cliquez !', description: 'Double-cliquez sur un mot dans l\'editeur : l\'effet arme s\'applique instantanement ! C\'est la methode la plus rapide pour colorier mot par mot.', targetSelector: '.editor-viewport', position: 'bottom-right', action: 'dblclick' },
  { id: 'armed-explain', module: 'Mode arme', title: 'Comment ca marche', description: 'Le double-clic applique toujours le style de la hotbar (police, taille, gras...). Si un effet couleur est arme, il colore les lettres — sans toucher a la taille. Si un effet taille est arme, il change la taille — sans toucher aux couleurs. Les deux sont independants et cumulables !', targetSelector: '.editor-viewport', position: 'bottom-right', action: 'none' },
  { id: 'disarm', module: 'Mode arme', title: 'Desarmer', description: 'Pour desarmer un effet, recliquez dessus dans le panneau (la bordure orange disparait). Essayez maintenant !', targetSelector: '.side-panel-left', position: 'right', action: 'click' },

  // Module D — Toolbar
  { id: 'toolbar-format', module: 'Toolbar', title: 'La barre de formatage', description: 'B, I, U, S changent le style du buffer. Le double-clic sur un mot applique TOUJOURS le style du buffer (police, taille, couleur, gras...) meme sans effet arme. Les effets armes s\'ajoutent EN PLUS du buffer.', targetSelector: '.toolbar-row', position: 'bottom', action: 'none' },
  { id: 'toolbar-colors', module: 'Toolbar', title: 'Palette de couleurs', description: 'Cliquez sur une couleur pour l\'appliquer au texte selectionne. Le toggle Texte/Fond change entre couleur du texte et surlignage.', targetSelector: '.swatches', position: 'bottom', action: 'none' },
  { id: 'toolbar-font', module: 'Toolbar', title: 'Choix de police', description: 'Selectionnez une police parmi les categories. Cliquez sur l\'etoile pour la mettre en favori.', targetSelector: '.font-picker', position: 'bottom', action: 'none' },
  { id: 'toolbar-size', module: 'Toolbar', title: 'Taille du texte', description: 'Le slider ajuste la taille de base. Le bouton "+" ajoute la taille actuelle a vos favoris.', targetSelector: '.slider-group', position: 'bottom', action: 'none' },

  // Module E — Creer des effets
  { id: 'open-catalog', module: 'Creer', title: 'Ouvrir le catalogue', description: 'Cliquez sur "Catalogue" pour explorer tous les effets disponibles et en creer de nouveaux.', targetSelector: '.btn-compact', position: 'bottom', action: 'click' },
  { id: 'catalog-tabs', module: 'Creer', title: 'Onglets du catalogue', description: '"Atelier de base" montre les effets integres. "Mon atelier" vos creations. "Creer" pour en fabriquer de nouveaux.', targetSelector: '.catalog-tabs', position: 'bottom', action: 'none' },
  { id: 'create-color', module: 'Creer', title: 'Creer une palette', description: 'Dans l\'onglet Creer > Couleur, composez votre palette en selectionnant des couleurs. Cliquez "Enregistrer" pour sauvegarder.', targetSelector: '.catalog-body', position: 'top', action: 'none' },
  { id: 'create-shape', module: 'Creer', title: 'Trace libre', description: 'Dessinez une courbe a la souris pour creer un profil de taille unique. Chaque lettre suivra votre trace !', targetSelector: '.catalog-body', position: 'top', action: 'none' },
  { id: 'create-math', module: 'Creer', title: 'Fonction f(x)', description: 'Pour les amateurs de maths : ecrivez une fonction comme sin(x) et ajustez les parametres a, b, c.', targetSelector: '.catalog-body', position: 'top', action: 'none' },
  { id: 'create-composed', module: 'Creer', title: 'Effet compose', description: 'Combinez taille + couleur + police + emoji en un seul effet. Le plus puissant !', targetSelector: '.catalog-body', position: 'top', action: 'none' },

  // Module F — Export
  { id: 'copy-outlook', module: 'Exporter', title: 'Copier pour Outlook', description: 'Quand votre email est pret, cliquez "Copier" pour copier le HTML compatible Outlook dans votre presse-papier.', targetSelector: '.btn-peach', position: 'bottom', action: 'none' },
  { id: 'done', module: 'Termine', title: 'Bravo !', description: 'Vous connaissez maintenant toutes les fonctionnalites de Mail Colorer. Amusez-vous bien ! Vous pouvez relancer ce tutoriel a tout moment avec le bouton "?" dans le header.', targetSelector: '.brand-pill', position: 'bottom', action: 'none' },
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
