import { createSignal, createEffect } from 'solid-js'

// Effet actif courant
const [activeColorEffect, setActiveColorEffect] = createSignal<string | null>(null)
const [activeSizeEffect, setActiveSizeEffect] = createSignal<string | null>(null)

// Contrôles
const [baseSize, setBaseSize] = createSignal(18)
const [sizeAmplitude, setSizeAmplitude] = createSignal(18)

// Amplitude suit automatiquement la taille de base
createEffect(() => setSizeAmplitude(baseSize()))
const [activeFont, setActiveFont] = createSignal('Arial, sans-serif')

// Profil de taille personnalisé (tracé souris ou fonction math)
const [customSizeProfile, setCustomSizeProfile] = createSignal<number[] | null>(null)

export {
  activeColorEffect, setActiveColorEffect,
  activeSizeEffect, setActiveSizeEffect,
  baseSize, setBaseSize,
  sizeAmplitude, setSizeAmplitude,
  activeFont, setActiveFont,
  customSizeProfile, setCustomSizeProfile,
}
