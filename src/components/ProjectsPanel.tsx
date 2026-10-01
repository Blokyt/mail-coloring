/**
 * Panneau « Mes projets » — la gestion de mails multi-sessions.
 *
 * Chaque projet vit sur le serveur (compte requis) : liste, ouverture dans
 * l'éditeur, enregistrement du document courant (création ou mise à jour,
 * jamais d'écrasement d'un autre projet), suppression. Les projets créés
 * par un agent portent le badge « agent ».
 */
import { createSignal, For, Show } from 'solid-js'
import { Modal } from './Modal'
import { showToast } from './Toast'
import { user } from '../stores/account'
import { remote, type DraftSummary } from '../api/remote'
import { getAllEditorHtml, loadEditorHtml } from './Editor'

const STATUS_LABELS: Record<string, string> = {
  brouillon: 'brouillon',
  pret: 'prêt',
  envoye: 'envoyé',
}

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60) return 'à l’instant'
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)} h`
  return `il y a ${Math.floor(diff / 86400)} j`
}

export function ProjectsPanel(props: { open: boolean; onClose: () => void }) {
  const [drafts, setDrafts] = createSignal<DraftSummary[]>([])
  const [title, setTitle] = createSignal('')
  const [busy, setBusy] = createSignal(false)
  const [loaded, setLoaded] = createSignal(false)

  const refresh = async () => {
    if (!user()) return
    setBusy(true)
    try {
      setDrafts((await remote.drafts()).drafts)
      setLoaded(true)
    } catch (err) {
      showToast((err as Error).message, true)
    } finally {
      setBusy(false)
    }
  }

  const openDraft = async (id: string) => {
    try {
      const { draft } = await remote.draft(id)
      if (loadEditorHtml(draft.html)) {
        showToast(`Projet ouvert : ${draft.title} (Ctrl+Z pour revenir en arrière)`)
        props.onClose()
      } else {
        showToast('Éditeur indisponible', true)
      }
    } catch (err) {
      showToast((err as Error).message, true)
    }
  }

  const saveNew = async () => {
    const t = title().trim()
    if (!t) { showToast('Donne un titre au projet', true); return }
    const html = getAllEditorHtml()
    if (!html) { showToast('Rien à enregistrer', true); return }
    try {
      await remote.createDraft(t, html)
      setTitle('')
      showToast('Projet enregistré')
      await refresh()
    } catch (err) {
      showToast((err as Error).message, true)
    }
  }

  const updateDraft = async (id: string, currentTitle: string) => {
    const html = getAllEditorHtml()
    if (!html) { showToast('Rien à enregistrer', true); return }
    try {
      await remote.updateDraft(id, { html })
      showToast(`« ${currentTitle} » mis à jour`)
      await refresh()
    } catch (err) {
      showToast((err as Error).message, true)
    }
  }

  const setStatus = async (id: string, status: string) => {
    try {
      await remote.updateDraft(id, { status })
      await refresh()
    } catch (err) {
      showToast((err as Error).message, true)
    }
  }

  const remove = async (id: string, currentTitle: string) => {
    try {
      await remote.deleteDraft(id)
      showToast(`« ${currentTitle} » supprimé`)
      await refresh()
    } catch (err) {
      showToast((err as Error).message, true)
    }
  }

  return (
    <Modal open={props.open} onClose={props.onClose} title="Mes projets" description="Tes mails en cours, sauvegardés sur le serveur et remplis aussi par tes agents." size="md">
      <Show when={user()} fallback={
        <p class="account-hint">Connecte-toi (bouton 👤) pour retrouver tes projets d'un appareil à l'autre.</p>
      }>
        <div class="account-body">
          <div class="projects-save">
            <input
              class="account-input" placeholder="Titre du nouveau projet"
              value={title()} onInput={(e) => setTitle(e.currentTarget.value)}
            />
            <button class="btn btn-peach" onClick={saveNew} disabled={busy()}>Enregistrer le document courant</button>
          </div>

          <div class="account-section-label">Projets ({drafts().length}) <button class="btn btn-compact" onClick={refresh} disabled={busy()}>↻</button></div>
          <Show when={loaded() && drafts().length === 0}>
            <p class="account-hint">Aucun projet. Rédige un mail ci-dessus, donne-lui un titre, enregistre.</p>
          </Show>
          <div class="projects-list">
            <For each={drafts()}>
              {(d) => (
                <div class="projects-row" classList={{ 'projects-row-agent': d.updated_by === 'agent' }}>
                  <div class="projects-row-main">
                    <span class="projects-title">{d.title}</span>
                    <span class="projects-meta">
                      <span classList={{ 'projects-status': true, [`status-${d.status}`]: true }}>{STATUS_LABELS[d.status] ?? d.status}</span>
                      <Show when={d.updated_by === 'agent'}><span class="projects-badge-agent" title="Dernière écriture par un agent">agent</span></Show>
                      <span class="projects-time">{timeAgo(d.updated_at)}</span>
                    </span>
                  </div>
                  <div class="projects-actions">
                    <button class="btn btn-compact" onClick={() => openDraft(d.id)}>Ouvrir</button>
                    <button class="btn btn-compact" onClick={() => updateDraft(d.id, d.title)} title="Écraser ce projet par le document courant">Mettre à jour</button>
                    <Show when={d.status !== 'envoye'} fallback={
                      <button class="btn btn-compact" onClick={() => setStatus(d.id, 'brouillon')}>Rouvrir</button>
                    }>
                      <button class="btn btn-compact" onClick={() => setStatus(d.id, 'envoye')} title="Marquer envoyé">Envoyé</button>
                    </Show>
                    <button class="btn btn-compact projects-delete" onClick={() => remove(d.id, d.title)}>Supprimer</button>
                  </div>
                </div>
              )}
            </For>
          </div>
        </div>
      </Show>
    </Modal>
  )
}
