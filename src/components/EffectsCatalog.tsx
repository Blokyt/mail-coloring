import { For, createSignal, createEffect, Show } from 'solid-js'
import { COLOR_EFFECTS, SIZE_EFFECTS, type ComposedEffectData } from '../engine/effects'
import { sparklineFromFn } from '../engine/sparkline'
import { EffectPreview } from './EffectPreview'
import {
  getPersoEffects, toggleFavorite, isFavorite,
  addPersoEffect, removePersoEffect,
} from '../stores/workshops'
import { baseSize } from '../stores/editor'
import { PREVIEW_WORDS } from '../data/preview'
import { MathFunction } from './MathFunction'
import { ShapeCanvas } from './ShapeCanvas'
import { ColorCreator } from './ColorCreator'
import { ComposedCreator } from './ComposedCreator'
import { isAdmin } from '../stores/admin'
import { showToast } from './Toast'
import { Modal } from './Modal'
import '../styles/catalog.css'
import '../styles/effects.css'

export type CatalogTab = 'base' | 'online' | 'perso' | 'creer'

interface Props {
  open: boolean
  onClose: () => void
  initialTab?: CatalogTab
}

const SIZE_ACCENT_COLORS: Record<string, string> = {
  montee: '#86efac', montee_exp: '#2d6a4f', descente: '#f472b6', descente_exp: '#c42b45',
  arche: '#c4b5fd', impulsion: '#fdba74', vague: '#0096c7', rebond: '#a855f7',
}

/** Section pliable reutilisable */
function Section(props: { title: string; defaultOpen?: boolean; children: any }) {
  const [open, setOpen] = createSignal(props.defaultOpen ?? true)
  return (
    <div class="catalog-section">
      <button class="catalog-section-header" onClick={() => setOpen(!open())}>
        <span class={`catalog-section-arrow ${open() ? 'open' : ''}`}>&#9656;</span>
        <span class="catalog-section-title">{props.title}</span>
      </button>
      <Show when={open()}>
        <div class="catalog-section-body">{props.children}</div>
      </Show>
    </div>
  )
}

/** Carte d'effet couleur */
function ColorEffectCard(props: { id: string; name: string }) {
  const fav = () => isFavorite(props.id, 'base')
  return (
    <div class="catalog-card">
      <div class="catalog-card-header">
        <span class="catalog-card-name">
          <EffectPreview text={props.name} colorEffectId={props.id} options={{ baseSize: baseSize() }} />
        </span>
        <button class={`catalog-fav ${fav() ? 'is-fav' : ''}`} onClick={() => toggleFavorite(props.id, 'base')} title={fav() ? 'Retirer des favoris' : 'Ajouter aux favoris'}>
          {fav() ? '\u2605' : '\u2606'}
        </button>
      </div>
      <div class="catalog-card-previews">
        <For each={PREVIEW_WORDS}>
          {(word) => (
            <div class="catalog-preview-item">
              <EffectPreview text={word} colorEffectId={props.id} />
            </div>
          )}
        </For>
      </div>
      <Show when={isAdmin()}>
        <div class="catalog-admin-id">id: {props.id}</div>
      </Show>
    </div>
  )
}

/** Carte d'effet taille — nom plain text + sparkline + previews normalisees */
function SizeEffectCard(props: { id: string; name: string }) {
  const fav = () => isFavorite(props.id, 'base')
  const se = SIZE_EFFECTS[props.id]
  const path = () => se ? sparklineFromFn((i) => se.getOffset(i)) : ''
  const accent = () => SIZE_ACCENT_COLORS[props.id] ?? 'var(--lavender)'

  return (
    <div class="catalog-card">
      <div class="catalog-card-header">
        <span class="catalog-card-name">{props.name}</span>
        <button class={`catalog-fav ${fav() ? 'is-fav' : ''}`} onClick={() => toggleFavorite(props.id, 'base')} title={fav() ? 'Retirer des favoris' : 'Ajouter aux favoris'}>
          {fav() ? '\u2605' : '\u2606'}
        </button>
      </div>
      <svg class="catalog-card-sparkline" viewBox="0 0 100 24" preserveAspectRatio="none">
        <path d={path()} fill="none" stroke={accent()} stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
      <div class="catalog-card-previews">
        <For each={PREVIEW_WORDS}>
          {(word) => (
            <div class="catalog-preview-item">
              <EffectPreview text={word} sizeEffectId={props.id} options={{ baseSize: baseSize() }} />
            </div>
          )}
        </For>
      </div>
      <Show when={isAdmin()}>
        <div class="catalog-admin-id">id: {props.id}</div>
      </Show>
    </div>
  )
}

export function EffectsCatalog(props: Props) {
  const [tab, setTab] = createSignal<CatalogTab>(props.initialTab || 'base')
  const [customCount, setCustomCount] = createSignal(0)

  // Modale de nom generique (taille + couleur)
  const [naming, setNaming] = createSignal(false)
  const [nameValue, setNameValue] = createSignal('')
  const [pendingDefault, setPendingDefault] = createSignal('')
  const [pendingProfile, setPendingProfile] = createSignal<number[] | null>(null)
  const [pendingMathExpr, setPendingMathExpr] = createSignal<string | undefined>()
  const [pendingMathParams, setPendingMathParams] = createSignal<{ a: number; b: number; c: number } | undefined>()
  const [pendingColors, setPendingColors] = createSignal<string[] | null>(null)
  const [pendingComposed, setPendingComposed] = createSignal<ComposedEffectData | null>(null)
  let nameInputRef: HTMLInputElement | undefined

  createEffect(() => {
    if (props.open && props.initialTab) {
      setTab(props.initialTab)
    }
  })

  const openNaming = (defaultName: string) => {
    setPendingDefault(defaultName)
    setNameValue(defaultName)
    setNaming(true)
    requestAnimationFrame(() => { nameInputRef?.focus(); nameInputRef?.select() })
  }

  const askNameForProfile = (profile: number[], defaultName: string, mathExpr?: string, mathParams?: { a: number; b: number; c: number }) => {
    setPendingProfile(profile)
    setPendingColors(null)
    setPendingMathExpr(mathExpr)
    setPendingMathParams(mathParams)
    openNaming(defaultName)
  }

  const askNameForColors = (colors: string[], defaultName: string) => {
    setPendingColors(colors)
    setPendingProfile(null)
    setPendingComposed(null)
    openNaming(defaultName)
  }

  const askNameForComposed = (data: ComposedEffectData, defaultName: string) => {
    setPendingComposed(data)
    setPendingProfile(null)
    setPendingColors(null)
    openNaming(defaultName)
  }

  const confirmName = () => {
    const name = nameValue().trim() || pendingDefault()
    const id = `custom-${Date.now()}`

    if (pendingProfile()) {
      addPersoEffect({
        id,
        type: 'custom-size',
        label: name,
        profile: pendingProfile()!,
        mathExpr: pendingMathExpr(),
        mathParams: pendingMathParams(),
      })
    } else if (pendingColors()) {
      addPersoEffect({
        id,
        type: 'custom-color',
        label: name,
        customColors: pendingColors()!,
      })
    } else if (pendingComposed()) {
      addPersoEffect({
        id,
        type: 'composed',
        label: name,
        composedData: pendingComposed()!,
      })
    } else return

    setCustomCount(c => c + 1)
    setNaming(false)
    setPendingProfile(null)
    setPendingColors(null)
    setPendingComposed(null)
    setPendingMathExpr(undefined)
    setPendingMathParams(undefined)
    showToast('Effet enregistre dans votre atelier')
  }

  const cancelName = () => {
    setNaming(false)
    setPendingProfile(null)
    setPendingColors(null)
    setPendingComposed(null)
  }

  return (
    <Modal
      open={props.open}
      onClose={props.onClose}
      title="Catalogue d'effets"
      description="Cliquez sur l'etoile pour ajouter un effet a vos favoris"
    >
        <div class="catalog-tabs">
          <button class={`catalog-tab ${tab() === 'base' ? 'active' : ''}`} onClick={() => setTab('base')}>Atelier de base</button>
          <button class={`catalog-tab ${tab() === 'online' ? 'active' : ''}`} onClick={() => setTab('online')}>En ligne</button>
          <button class={`catalog-tab ${tab() === 'perso' ? 'active' : ''}`} onClick={() => setTab('perso')}>Mon atelier</button>
          <button class={`catalog-tab ${tab() === 'creer' ? 'active' : ''}`} onClick={() => setTab('creer')}>Creer</button>
        </div>

        <div class="catalog-body">
          {/* ATELIER DE BASE */}
          <Show when={tab() === 'base'}>
            <Section title="Couleur" defaultOpen={true}>
              <div class="catalog-grid">
                <For each={Object.entries(COLOR_EFFECTS)}>
                  {([id, effect]) => (
                    <ColorEffectCard id={id} name={effect.name} />
                  )}
                </For>
              </div>
            </Section>

            <Section title="Taille" defaultOpen={false}>
              <div class="catalog-grid">
                <For each={Object.entries(SIZE_EFFECTS)}>
                  {([id, effect]) => (
                    <SizeEffectCard id={id} name={effect.name} />
                  )}
                </For>
              </div>
            </Section>
          </Show>

          {/* ATELIER EN LIGNE */}
          <Show when={tab() === 'online'}>
            <div class="catalog-empty">
              <span class="catalog-empty-icon">&#127760;</span>
              <span class="catalog-empty-text">Bientot disponible</span>
              <span class="catalog-empty-sub">Les effets partages par la communaute apparaitront ici.</span>
            </div>
          </Show>

          {/* MON ATELIER */}
          <Show when={tab() === 'perso'}>
            <Show when={getPersoEffects().length > 0} fallback={
              <div class="catalog-empty">
                <span class="catalog-empty-icon">&#9997;</span>
                <span class="catalog-empty-text">Votre atelier est vide</span>
                <span class="catalog-empty-sub">Creez votre premier effet via l'onglet <strong>Creer</strong></span>
              </div>
            }>
              <div class="catalog-grid">
                <For each={getPersoEffects()}>
                  {(effect) => {
                    const fav = () => isFavorite(effect.id, 'perso')
                    return (
                      <div class="catalog-card">
                        <div class="catalog-card-header">
                          <span class="catalog-card-name">{effect.label}</span>
                          <button
                            class={`catalog-fav ${fav() ? 'is-fav' : ''}`}
                            onClick={() => toggleFavorite(effect.id, 'perso')}
                            title={fav() ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                          >
                            {fav() ? '\u2605' : '\u2606'}
                          </button>
                          <button
                            class="catalog-delete"
                            onClick={() => { removePersoEffect(effect.id); showToast('Effet supprime') }}
                            title="Supprimer cet effet"
                          >&#10005;</button>
                        </div>
                        <Show when={isAdmin()}>
                          <div class="catalog-admin-id">id: {effect.id} | type: {effect.type}</div>
                        </Show>
                        <div class="catalog-card-previews">
                          <For each={PREVIEW_WORDS}>
                            {(word) => (
                              <div class="catalog-preview-item">
                                <EffectPreview
                                  text={word}
                                  customProfile={effect.profile}
                                  customColors={effect.customColors}
                                  composedData={effect.composedData}
                                  options={{ baseSize: baseSize() }}
                                />
                              </div>
                            )}
                          </For>
                        </div>
                        <Show when={effect.mathExpr}>
                          <div class="catalog-card-expr">f(x) = {effect.mathExpr}</div>
                        </Show>
                      </div>
                    )
                  }}
                </For>
              </div>
            </Show>
          </Show>

          {/* CREER */}
          <Show when={tab() === 'creer'}>
            <Section title="Effet couleur" defaultOpen={true}>
              <p class="catalog-create-hint">Composez une palette de couleurs qui cycleront sur chaque caractere.</p>
              <ColorCreator
                onSave={(colors) => askNameForColors(colors, `Couleur ${customCount() + 1}`)}
              />
            </Section>

            <Section title="Fonction f(x)" defaultOpen={false}>
              <MathFunction
                onApply={(profile, expr, params) => askNameForProfile(profile, `Fonction ${customCount() + 1}`, expr, params)}
              />
            </Section>

            <Section title="Trace libre" defaultOpen={false}>
              <p class="catalog-create-hint">Dessinez une courbe a la souris pour creer votre propre profil de taille.</p>
              <ShapeCanvas
                onApply={(profile) => askNameForProfile(profile, `Trace ${customCount() + 1}`)}
              />
            </Section>

            <Section title="Effet compose" defaultOpen={false}>
              <p class="catalog-create-hint">Combinez taille, couleur, police et emoji en un seul effet.</p>
              <ComposedCreator
                onSave={(data) => askNameForComposed(data, `Compose ${customCount() + 1}`)}
              />
            </Section>
          </Show>
        </div>

        {/* Modale de nom */}
        <Modal open={naming()} onClose={cancelName} title="Nom de votre effet" size="sm" zIndex={300}>
          <div style={{ padding: '0 24px 20px', display: 'flex', "flex-direction": 'column', gap: '12px' }}>
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
        </Modal>
    </Modal>
  )
}
