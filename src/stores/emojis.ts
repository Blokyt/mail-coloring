import { createSignal } from 'solid-js'
import { DEFAULT_EMOJIS, type EmojiDef } from '../data/emojis'
import { adminData } from './admin-data'

// ── Types ──

export type EmojiSource = 'base' | 'online' | 'perso'

export interface EmojiEntry extends EmojiDef {
  source: EmojiSource
  likes?: number
}

// ── Storage ──

const PERSO_KEY = 'artlequin_emojis_perso'

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch { return fallback }
}

// ── Signaux ──

const [persoEmojis, setPersoEmojis] = createSignal<EmojiEntry[]>(
  load<EmojiEntry[]>(PERSO_KEY, [])
)

const [onlineEmojis, setOnlineEmojis] = createSignal<EmojiEntry[]>([])

const EMOJI_FAVS_KEY = 'artlequin_emoji_favs'
const [emojiFavorites, setEmojiFavorites] = createSignal<string[]>(
  load<string[]>(EMOJI_FAVS_KEY, [])
)

// ── Persistence ──

function savePerso(entries: EmojiEntry[]) {
  setPersoEmojis(entries)
  localStorage.setItem(PERSO_KEY, JSON.stringify(entries))
}

// ── Getters ──

export function getBaseEmojis(): EmojiEntry[] {
  const data = adminData()
  const base = DEFAULT_EMOJIS
    .filter(e => !data.hiddenEmojis.includes(e.id))
    .map(e => ({
      ...e,
      label: data.emojiOverrides[e.id]?.label ?? e.label,
      source: 'base' as const,
    }))
  const admin = data.emojis
    .filter(e => !data.hiddenEmojis.includes(e.id))
    .map(e => ({ ...e, source: 'base' as const }))
  return [...base, ...admin]
}

export function getPersoEmojis(): EmojiEntry[] {
  return persoEmojis()
}

export function getOnlineEmojis(): EmojiEntry[] {
  return onlineEmojis()
}

export function getAllEmojis(): EmojiEntry[] {
  return [...getBaseEmojis(), ...getOnlineEmojis(), ...getPersoEmojis()]
}

// ── Mutations ──

export function addPersoEmoji(emoji: string, label: string) {
  const id = `emoji-${Date.now()}`
  savePerso([...persoEmojis(), { id, emoji, label, source: 'perso' }])
}

export function removePersoEmoji(id: string) {
  savePerso(persoEmojis().filter(e => e.id !== id))
}

// ── Emoji Favorites ──

export function toggleEmojiFavorite(emojiChar: string) {
  const current = emojiFavorites()
  const updated = current.includes(emojiChar)
    ? current.filter(e => e !== emojiChar)
    : [...current, emojiChar]
  setEmojiFavorites(updated)
  localStorage.setItem(EMOJI_FAVS_KEY, JSON.stringify(updated))
}

export function isEmojiFavorite(emojiChar: string): boolean {
  return emojiFavorites().includes(emojiChar)
}

export function getEmojiFavoritesList(): string[] {
  return emojiFavorites()
}

export { persoEmojis, onlineEmojis, setOnlineEmojis, emojiFavorites }
