/** Emojis par defaut — theme venitien + decorations mail */
export interface EmojiDef {
  id: string
  emoji: string
  label: string
}

export const DEFAULT_EMOJIS: EmojiDef[] = [
  // Venitien
  { id: 'mask', emoji: '🎭', label: 'Masque' },
  { id: 'gondola', emoji: '⛵', label: 'Gondole' },
  { id: 'palette', emoji: '🎨', label: 'Palette' },
  { id: 'feather', emoji: '🪶', label: 'Plume' },
  { id: 'crown', emoji: '👑', label: 'Couronne' },
  // Decoratif
  { id: 'star', emoji: '⭐', label: 'Etoile' },
  { id: 'sparkle', emoji: '✨', label: 'Etincelle' },
  { id: 'fire', emoji: '🔥', label: 'Feu' },
  { id: 'heart', emoji: '❤️', label: 'Coeur' },
  { id: 'diamond', emoji: '💎', label: 'Diamant' },
  { id: 'rainbow', emoji: '🌈', label: 'Arc-en-ciel' },
  { id: 'rose', emoji: '🌹', label: 'Rose' },
  { id: 'butterfly', emoji: '🦋', label: 'Papillon' },
  // Fun
  { id: 'party', emoji: '🎉', label: 'Fete' },
  { id: 'confetti', emoji: '🎊', label: 'Confetti' },
  { id: 'music', emoji: '🎵', label: 'Musique' },
  { id: 'rocket', emoji: '🚀', label: 'Fusee' },
  { id: 'lightning', emoji: '⚡', label: 'Eclair' },
  // Symboles
  { id: 'arrow-r', emoji: '➡️', label: 'Fleche droite' },
  { id: 'arrow-l', emoji: '⬅️', label: 'Fleche gauche' },
  { id: 'check', emoji: '✅', label: 'Valide' },
  { id: 'wave', emoji: '👋', label: 'Salut' },
  { id: 'clap', emoji: '👏', label: 'Bravo' },
  { id: 'point', emoji: '👉', label: 'Pointer' },
  // Mines assos
  { id: 'cheese', emoji: '🧀', label: 'Fromage' },
  { id: 'mountain', emoji: '🏔️', label: 'Montagne' },
  { id: 'yarn', emoji: '🧶', label: 'Pelote' },
  { id: 'herb', emoji: '🌿', label: 'Herbe' },
  { id: 'leaf', emoji: '🍃', label: 'Feuille' },
  { id: 'tree', emoji: '🌳', label: 'Arbre' },
  { id: 'cowboy', emoji: '🤠', label: 'Cowboy' },
  { id: 'fairy', emoji: '🧚', label: 'Fee' },
  { id: 'pin', emoji: '📌', label: 'Epingle' },
  { id: 'pita', emoji: '🫓', label: 'Pita' },
]
