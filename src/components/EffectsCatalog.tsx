import { For, createSignal, createEffect, Show } from 'solid-js'
import { COLOR_EFFECTS, SIZE_EFFECTS } from '../engine/effects'
import { EffectPreview } from './EffectPreview'
import { addFavorite, removeFavorite, isFavorite } from '../stores/favorites'
import { MathFunction } from './MathFunction'
import { ShapeCanvas } from './ShapeCanvas'
import '../styles/catalog.css'
import '../styles/effects.css'

export type CatalogTab = 'couleur' | 'taille' | 'fx' | 'trace'

interface Props {
  open: boolean
  onClose: () => void
  initialTab?: CatalogTab
}

const SAMPLE_WORDS = ['Bonjour', 'Artlequin', 'Bureau des Arts']

export function EffectsCatalog(props: Props) {
  const [tab, setTab] = createSignal<CatalogTab>(props.initialTab || 'couleur')
  const [customCount, setCustomCount] = createSignal(0)
  const [previewIntensity, setPreviewIntensity] = createSignal(7)

  // Modale de nom — remplace le prompt() natif
  const [naming, setNaming] = createSignal(false)
  const [nameValue, setNameValue] = createSignal('')
  const [pendingProfile, setPendingProfile] = createSignal<number[] | null>(null)
  const [pendingDefault, setPendingDefault] = createSignal('')
  let nameInputRef: HTMLInputElement | undefined

  createEffect(() => {
    if (props.open && props.initialTab) {
      setTab(props.initialTab)
    }
  })

  const handleSaveCustomProfile = (profile: number[], label: string) => {
    const id = `custom-${Date.now()}`
    addFavorite({ id, type: 'custom-size', label, profile })
    setCustomCount(c => c + 1)
  }

  const askName = (profile: number[], defaultName: string) => {
    setPendingProfile(profile)
    setPendingDefault(defaultName)
    setNameValue(defaultName)
    setNaming(true)
    requestAnimationFrame(() => {
      nameInputRef?.focus()
      nameInputRef?.select()
    })
  }

  const confirmName = () => {
    const profile = pendingProfile()
    if (!profile) return
    const name = nameValue().trim() || pendingDefault()
    handleSaveCustomProfile(profile, name)
    setNaming(false)
    setPendingProfile(null)
  }

  const cancelName = () => {
    setNaming(false)
    setPendingProfile(null)
  }

  return (
    <Show when={props.open}>
      <div class="catalog-overlay" onClick={props.onClose} />
      <div class="catalog">
        <div class="catalog-header">
          <h2 class="catalog-title">Catalogue d'effets</h2>
          <p class="catalog-desc">Cliquez sur l'étoile pour ajouter un effet à vos favoris</p>
          <button class="catalog-close" onClick={props.onClose}>X</button>
        </div>

        <div class="catalog-tabs">
          <button class={`catalog-tab ${tab() === 'couleur' ? 'active' : ''}`} onClick={() => setTab('couleur')}>Couleur</button>
          <button class={`catalog-tab ${tab() === 'taille' ? 'active' : ''}`} onClick={() => setTab('taille')}>Taille</button>
          <button class={`catalog-tab ${tab() === 'fx' ? 'active' : ''}`} onClick={() => setTab('fx')}>f(x)</button>
          <button class={`catalog-tab ${tab() === 'trace' ? 'active' : ''}`} onClick={() => setTab('trace')}>Tracé libre</button>
        </div>

        <div class="catalog-body">
          {/* COULEUR */}
          <Show when={tab() === 'couleur'}>
            <div class="catalog-intensity">
              <span class="catalog-intensity-label">Intensité de prévisualisation</span>
              <input type="range" min="1" max="10" value={previewIntensity()} onInput={(e) => setPreviewIntensity(parseInt(e.currentTarget.value))} />
              <span class="catalog-intensity-value">{previewIntensity()}</span>
            </div>
            <div class="catalog-grid">
              <For each={Object.entries(COLOR_EFFECTS)}>
                {([id, effect]) => {
                  const fav = () => isFavorite(id, 'color')
                  return (
                    <div class="catalog-card">
                      <div class="catalog-card-header">
                        <span class="catalog-card-name">
                          <EffectPreview text={effect.name} colorEffectId={id} options={{ intensity: previewIntensity(), baseSize: 16 }} />
                        </span>
                        <button
                          class={`catalog-fav ${fav() ? 'is-fav' : ''}`}
                          onClick={() => {
                            if (fav()) removeFavorite(id, 'color')
                            else addFavorite({ id, type: 'color', label: effect.name })
                          }}
                          title={fav() ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                        >
                          {fav() ? '★' : '☆'}
                        </button>
                      </div>
                      <div class="catalog-card-previews">
                        <For each={SAMPLE_WORDS}>
                          {(word) => (
                            <div class="catalog-preview-item">
                              <EffectPreview text={word} colorEffectId={id} options={{ intensity: previewIntensity() }} />
                            </div>
                          )}
                        </For>
                      </div>
                    </div>
                  )
                }}
              </For>
            </div>
          </Show>

          {/* TAILLE */}
          <Show when={tab() === 'taille'}>
            <div class="catalog-intensity">
              <span class="catalog-intensity-label">Intensité de prévisualisation</span>
              <input type="range" min="1" max="10" value={previewIntensity()} onInput={(e) => setPreviewIntensity(parseInt(e.currentTarget.value))} />
              <span class="catalog-intensity-value">{previewIntensity()}</span>
            </div>
            <div class="catalog-grid">
              <For each={Object.entries(SIZE_EFFECTS)}>
                {([id, effect]) => {
                  const fav = () => isFavorite(id, 'size')
                  return (
                    <div class="catalog-card">
                      <div class="catalog-card-header">
                        <span class="catalog-card-name">
                          <EffectPreview text={effect.name} sizeEffectId={id} options={{ intensity: previewIntensity(), baseSize: 15 }} />
                        </span>
                        <button
                          class={`catalog-fav ${fav() ? 'is-fav' : ''}`}
                          onClick={() => {
                            if (fav()) removeFavorite(id, 'size')
                            else addFavorite({ id, type: 'size', label: effect.name })
                          }}
                          title={fav() ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                        >
                          {fav() ? '★' : '☆'}
                        </button>
                      </div>
                      <div class="catalog-card-previews">
                        <For each={SAMPLE_WORDS}>
                          {(word) => (
                            <div class="catalog-preview-item">
                              <EffectPreview text={word} sizeEffectId={id} options={{ intensity: previewIntensity() }} />
                            </div>
                          )}
                        </For>
                      </div>
                    </div>
                  )
                }}
              </For>
            </div>
          </Show>

          {/* f(x) */}
          <Show when={tab() === 'fx'}>
            <MathFunction
              onApply={(profile) => askName(profile, `Fonction ${customCount() + 1}`)}
            />
          </Show>

          {/* TRACÉ LIBRE */}
          <Show when={tab() === 'trace'}>
            <p class="catalog-create-hint">Dessinez une courbe à la souris pour créer votre propre profil de taille.</p>
            <ShapeCanvas
              onApply={(profile) => askName(profile, `Tracé ${customCount() + 1}`)}
            />
          </Show>
        </div>

        {/* Modale de nom — dans la DA */}
        <Show when={naming()}>
          <div class="naming-overlay" onClick={cancelName} />
          <div class="naming-modal">
            <span class="naming-title">Nom de votre effet</span>
            <input
              ref={nameInputRef}
              class="naming-input"
              type="text"
              value={nameValue()}
              onInput={(e) => setNameValue(e.currentTarget.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') confirmName(); if (e.key === 'Escape') cancelName() }}
              placeholder="Mon effet..."
            />
            <div class="naming-actions">
              <button class="btn btn-lavender" onClick={confirmName}>Valider</button>
              <button class="btn" onClick={cancelName}>Annuler</button>
            </div>
          </div>
        </Show>
      </div>
    </Show>
  )
}
