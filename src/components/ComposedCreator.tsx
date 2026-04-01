import { createSignal, For, Show, createMemo } from 'solid-js'
import { sampleProfile, type ComposedEffectData, type EmojiPosition } from '../engine/effects'
import { adminData } from '../stores/admin-data'
import { sparklineFromProfile } from '../engine/sparkline'
import { getPersoEffects } from '../stores/workshops'
import { baseSize, sizeAmplitude } from '../stores/editor'
import { FONTS } from '../data/fonts'
import { PREVIEW_SHORT } from '../data/preview'
import { EffectPreview } from './EffectPreview'
import { EmojiPicker } from './EmojiPicker'

interface Props {
  onSave: (data: ComposedEffectData) => void
}

const SIZE_ACCENT_COLORS: Record<string, string> = {
  montee: '#86efac', montee_exp: '#2d6a4f', descente: '#f472b6', descente_exp: '#c42b45',
  arche: '#c4b5fd', impulsion: '#fdba74', vague: '#0096c7', rebond: '#a855f7',
}

export function ComposedCreator(props: Props) {
  const [selectedSizeRef, setSelectedSizeRef] = createSignal<string | null>(null)
  const [colorMode, setColorMode] = createSignal<'effect' | 'flat' | 'none'>('none')
  const [selectedColorRef, setSelectedColorRef] = createSignal<string | null>(null)
  const [flatColor, setFlatColor] = createSignal('#c42b45')
  const [selectedFont, setSelectedFont] = createSignal<string | null>(null)
  const [selectedEmoji, setSelectedEmoji] = createSignal<string | null>(null)
  const [emojiPosition, setEmojiPosition] = createSignal<EmojiPosition>('both')

  // Effets perso disponibles
  const persoSizeEffects = () => getPersoEffects().filter(e => e.type === 'custom-size')
  const persoColorEffects = () => getPersoEffects().filter(e => e.type === 'custom-color')

  // Donnees composees reactives
  const composedData = createMemo((): ComposedEffectData => ({
    sizeEffectRef: selectedSizeRef(),
    colorEffectRef: colorMode() === 'effect' ? selectedColorRef() : null,
    flatColor: colorMode() === 'flat' ? flatColor() : null,
    font: selectedFont(),
    emojiDecoration: selectedEmoji() ? { emoji: selectedEmoji()!, position: emojiPosition() } : null,
  }))

  const hasAnything = () =>
    selectedSizeRef() || colorMode() !== 'none' || selectedFont() || selectedEmoji()

  const toggleSize = (id: string) => setSelectedSizeRef(prev => prev === id ? null : id)
  const toggleColor = (id: string) => setSelectedColorRef(prev => prev === id ? null : id)

  return (
    <div class="composed-creator">
      {/* TAILLE */}
      <div class="composed-section-label">Taille (optionnel)</div>
      <div class="composed-tag-grid">
        <For each={Object.entries(adminData().sizeEffects ?? {})}>
          {([id, effect]) => {
            const path = () => sparklineFromProfile(effect.profile)
            const accent = () => SIZE_ACCENT_COLORS[id] ?? 'var(--lavender)'
            return (
              <button
                class={`side-tag side-tag-size ${selectedSizeRef() === id ? 'armed' : ''}`}
                style={{ width: 'auto', "min-width": '90px', "box-shadow": `var(--shadow-x) var(--shadow-y) 0 ${accent()}` }}
                onClick={() => toggleSize(id)}
              >
                <span class="side-tag-name">{effect.name}</span>
                <svg class="side-tag-sparkline" viewBox="0 0 100 24" preserveAspectRatio="none">
                  <path d={path()} fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
              </button>
            )
          }}
        </For>
      </div>

      {/* COULEUR */}
      <div class="composed-section-label">Couleur (optionnel)</div>
      <div class="composed-radio-group">
        <label class="composed-radio">
          <input type="radio" name="colorMode" checked={colorMode() === 'effect'} onChange={() => setColorMode('effect')} />
          Effet couleur
        </label>
        <label class="composed-radio">
          <input type="radio" name="colorMode" checked={colorMode() === 'flat'} onChange={() => setColorMode('flat')} />
          Couleur unie
        </label>
        <label class="composed-radio">
          <input type="radio" name="colorMode" checked={colorMode() === 'none'} onChange={() => setColorMode('none')} />
          Aucune
        </label>
      </div>

      <Show when={colorMode() === 'effect'}>
        <div class="composed-tag-grid">
          <For each={Object.entries(adminData().colorEffects)}>
            {([id, effect]) => (
              <button
                class={`side-tag ${selectedColorRef() === id ? 'armed' : ''}`}
                style={{ width: 'auto', "min-width": '70px' }}
                innerHTML={(() => {
                  let idx = 0
                  return [...effect.name].map(ch => {
                    if (ch === ' ') return ' '
                    const c = effect.colors[idx % effect.colors.length]
                    idx++
                    return `<span style="color:${c}">${ch}</span>`
                  }).join('')
                })()}
                onClick={() => toggleColor(id)}
              />
            )}
          </For>
          <For each={persoColorEffects()}>
            {(effect) => (
              <button
                class={`side-tag ${selectedColorRef() === effect.id ? 'armed' : ''}`}
                style={{ width: 'auto', "min-width": '70px' }}
                innerHTML={(() => {
                  const colors = effect.customColors || []
                  let idx = 0
                  return [...effect.label].map(ch => {
                    if (ch === ' ') return ' '
                    const c = colors[idx % colors.length]
                    idx++
                    return `<span style="color:${c}">${ch}</span>`
                  }).join('')
                })()}
                onClick={() => toggleColor(effect.id)}
              />
            )}
          </For>
        </div>
      </Show>

      <Show when={colorMode() === 'flat'}>
        <div style={{ display: 'flex', "align-items": 'center', gap: '10px' }}>
          <div class="color-creator-picker-wrap">
            <div class="color-creator-picker-visual" style={{ background: flatColor() }} />
            <input type="color" value={flatColor()} onInput={(e) => setFlatColor(e.currentTarget.value)} />
          </div>
          <span style={{ "font-family": "'Fredoka',sans-serif", "font-weight": '600', color: flatColor() }}>{flatColor()}</span>
        </div>
      </Show>

      {/* POLICE */}
      <div class="composed-section-label">Police (optionnel)</div>
      <select
        class="composed-font-select"
        value={selectedFont() ?? ''}
        onChange={(e) => setSelectedFont(e.currentTarget.value || null)}
      >
        <option value="">Aucune</option>
        <For each={FONTS}>
          {(font) => (
            <option value={font.value} style={{ "font-family": font.value }}>{font.name}</option>
          )}
        </For>
      </select>

      {/* EMOJI */}
      <div class="composed-section-label">Emoji (optionnel)</div>
      <div style={{ display: 'flex', "align-items": 'center', gap: '12px', "flex-wrap": 'wrap' }}>
        <EmojiPicker
          onSelect={(emoji) => setSelectedEmoji(prev => prev === emoji ? null : emoji)}
          selected={selectedEmoji() ?? undefined}
        />
        <Show when={selectedEmoji()}>
          <div class="composed-radio-group">
            <label class="composed-radio">
              <input type="radio" name="emojiPos" checked={emojiPosition() === 'before'} onChange={() => setEmojiPosition('before')} />
              Avant
            </label>
            <label class="composed-radio">
              <input type="radio" name="emojiPos" checked={emojiPosition() === 'after'} onChange={() => setEmojiPosition('after')} />
              Apres
            </label>
            <label class="composed-radio">
              <input type="radio" name="emojiPos" checked={emojiPosition() === 'both'} onChange={() => setEmojiPosition('both')} />
              Les deux
            </label>
          </div>
          <button class="btn" style={{ padding: '4px 10px', "font-size": 'var(--font-sm)' }} onClick={() => setSelectedEmoji(null)}>Retirer</button>
        </Show>
      </div>

      {/* APERCU */}
      <Show when={hasAnything()}>
        <div class="composed-section-label">Apercu</div>
        <div class="math-text-preview">
          <EffectPreview text={PREVIEW_SHORT} composedData={composedData()} options={{ baseSize: baseSize(), amplitude: sizeAmplitude() }} />
        </div>

        <button class="btn btn-lavender" onClick={() => props.onSave(composedData())}>
          Enregistrer
        </button>
      </Show>
    </div>
  )
}
