export interface FontEntry {
  name: string
  value: string
  category: 'classique' | 'moderne' | 'fantaisie' | 'elegant' | 'manuscrit'
}

export const FONTS: FontEntry[] = [
  // Classiques
  { name: 'Arial', value: 'Arial, sans-serif', category: 'classique' },
  { name: 'Times New Roman', value: 'Times New Roman, serif', category: 'classique' },
  { name: 'Georgia', value: 'Georgia, serif', category: 'classique' },
  { name: 'Verdana', value: 'Verdana, sans-serif', category: 'classique' },
  { name: 'Courier New', value: 'Courier New, monospace', category: 'classique' },
  { name: 'Garamond', value: 'Garamond, serif', category: 'classique' },
  { name: 'Palatino', value: 'Palatino Linotype, serif', category: 'classique' },
  { name: 'Book Antiqua', value: 'Book Antiqua, serif', category: 'classique' },

  // Modernes
  { name: 'Segoe UI', value: 'Segoe UI, sans-serif', category: 'moderne' },
  { name: 'Calibri', value: 'Calibri, sans-serif', category: 'moderne' },
  { name: 'Trebuchet MS', value: 'Trebuchet MS, sans-serif', category: 'moderne' },
  { name: 'Tahoma', value: 'Tahoma, sans-serif', category: 'moderne' },
  { name: 'Lucida Sans', value: 'Lucida Sans, sans-serif', category: 'moderne' },
  { name: 'Century Gothic', value: 'Century Gothic, sans-serif', category: 'moderne' },
  { name: 'Candara', value: 'Candara, sans-serif', category: 'moderne' },

  // Fantaisie
  { name: 'Comic Sans MS', value: 'Comic Sans MS, cursive', category: 'fantaisie' },
  { name: 'Impact', value: 'Impact, sans-serif', category: 'fantaisie' },
  { name: 'Papyrus', value: 'Papyrus, fantasy', category: 'fantaisie' },
  { name: 'Copperplate', value: 'Copperplate, fantasy', category: 'fantaisie' },

  // Élégant (Google Fonts)
  { name: 'Cinzel', value: 'Cinzel, serif', category: 'elegant' },
  { name: 'Cormorant Garamond', value: 'Cormorant Garamond, serif', category: 'elegant' },
  { name: 'Playfair Display', value: 'Playfair Display, serif', category: 'elegant' },

  // Manuscrit (Google Fonts)
  { name: 'Tangerine', value: 'Tangerine, cursive', category: 'manuscrit' },
  { name: 'Great Vibes', value: 'Great Vibes, cursive', category: 'manuscrit' },
  { name: 'Dancing Script', value: 'Dancing Script, cursive', category: 'manuscrit' },
]

export const FONT_CATEGORIES: Record<FontEntry['category'], string> = {
  classique: 'Classiques',
  moderne: 'Modernes',
  fantaisie: 'Fantaisie',
  elegant: 'Élégant',
  manuscrit: 'Manuscrit',
}
