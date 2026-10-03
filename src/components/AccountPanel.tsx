/**
 * Panneau Compte — connexion / inscription, gestion des clés API.
 *
 * Une clé se crée ici (affichée UNE fois, copiable), se révoque ici.
 * C'est la clé que l'agent utilise (MCP X-API-Key ou CLI) : un compte =
 * des projets, une clé = un agent révocable.
 */
import { createSignal, For, Show } from 'solid-js'
import { Modal } from './Modal'
import { showToast } from './Toast'
import { login, logout, register, user } from '../stores/account'
import { remote, type ApiKeyInfo } from '../api/remote'

type Tab = 'login' | 'register'

export function AccountPanel(props: { open: boolean; onClose: () => void }) {
  const [tab, setTab] = createSignal<Tab>('login')
  const [username, setUsername] = createSignal('')
  const [password, setPassword] = createSignal('')
  const [displayName, setDisplayName] = createSignal('')
  const [keys, setKeys] = createSignal<ApiKeyInfo[]>([])
  const [freshKey, setFreshKey] = createSignal('')
  const [keyName, setKeyName] = createSignal('')
  const [busy, setBusy] = createSignal(false)
  const [pwCurrent, setPwCurrent] = createSignal('')
  const [pwNext, setPwNext] = createSignal('')

  const changePassword = async () => {
    try {
      await remote.changePassword(pwCurrent(), pwNext())
      setPwCurrent(''); setPwNext('')
      showToast('Mot de passe changé')
    } catch (err) {
      showToast((err as Error).message, true)
    }
  }

  const submit = async (e: Event) => {
    e.preventDefault()
    if (busy()) return
    setBusy(true)
    try {
      if (tab() === 'login') await login(username(), password())
      else await register(username(), password(), displayName())
      showToast(`Connecté : ${username()}`)
      setPassword('')
      await refreshKeys()
    } catch (err) {
      showToast((err as Error).message, true)
    } finally {
      setBusy(false)
    }
  }

  const refreshKeys = async () => {
    if (!user()) { setKeys([]); return }
    try { setKeys((await remote.keys()).keys) } catch { /* token expiré */ }
  }

  const createKey = async () => {
    try {
      const k = await remote.createKey(keyName() || 'agent')
      setFreshKey(k.key)
      setKeyName('')
      await refreshKeys()
    } catch (err) {
      showToast((err as Error).message, true)
    }
  }

  const revokeKey = async (id: string) => {
    try {
      await remote.revokeKey(id)
      await refreshKeys()
      showToast('Clé révoquée')
    } catch (err) {
      showToast((err as Error).message, true)
    }
  }

  const copyKey = async () => {
    try {
      await navigator.clipboard.writeText(freshKey())
      showToast('Clé copiée')
    } catch { showToast('Copie impossible, sélectionne-la à la main', true) }
  }

  const close = () => {
    setFreshKey('')
    props.onClose()
  }

  return (
    <Modal open={props.open} onClose={close} title={user() ? 'Mon compte' : 'Mes projets en ligne'} size="md">
      <Show when={!user()} fallback={
        <div class="account-body">
          <div class="account-hello">
            Connecté : <strong>{user()?.display_name || user()?.username}</strong>
          </div>

          <div class="account-section-label">Clés API (pour un agent)</div>
          <p class="account-hint">
            Une clé donne à un agent l'accès à tes projets et au rendu d'effets
            (MCP <code>/api/v1/mcp</code>). Elle n'est plus affichée après création.
          </p>
          <div class="account-key-create">
            <input
              class="account-input" placeholder="Nom de l'agent (ex. mac)"
              value={keyName()} onInput={(e) => setKeyName(e.currentTarget.value)}
            />
            <button class="btn btn-lavender" onClick={createKey}>Créer une clé</button>
          </div>

          <Show when={freshKey()}>
            <div class="account-fresh-key">
              <div class="account-fresh-key-label">Nouvelle clé — copie-la maintenant :</div>
              <div class="account-fresh-key-value" onClick={copyKey} title="Cliquer pour copier">
                {freshKey()}
              </div>
            </div>
          </Show>

          <div class="account-section-label">Clés actives</div>
          <Show when={keys().length === 0} fallback={
            <div class="account-key-list">
              <For each={keys()}>
                {(k) => (
                  <div class="account-key-row">
                    <span class="account-key-name">{k.name}</span>
                    <code class="account-key-prefix">{k.key_prefix}…</code>
                    <Show when={k.last_used_at} fallback={<span class="account-key-used">jamais utilisée</span>}>
                      <span class="account-key-used">utilisée</span>
                    </Show>
                    <button class="btn btn-compact" onClick={() => revokeKey(k.id)}>Révoquer</button>
                  </div>
                )}
              </For>
            </div>
          }>
            <p class="account-hint">Aucune clé active.</p>
          </Show>

          <div class="account-section-label">Changer de mot de passe</div>
          <div class="account-key-create">
            <input class="account-input" type="password" placeholder="Actuel" value={pwCurrent()} onInput={(e) => setPwCurrent(e.currentTarget.value)} />
            <input class="account-input" type="password" placeholder="Nouveau (8+)" value={pwNext()} onInput={(e) => setPwNext(e.currentTarget.value)} />
            <button class="btn" onClick={changePassword} disabled={!pwCurrent() || !pwNext()}>Changer</button>
          </div>

          <div class="account-footer">
            <button class="btn" onClick={async () => { logout(); showToast('Déconnecté') }}>Se déconnecter</button>
          </div>
        </div>
      }>
        <div class="account-body">
          <div class="account-tabs">
            <button classList={{ 'account-tab': true, active: tab() === 'login' }} onClick={() => setTab('login')}>Connexion</button>
            <button classList={{ 'account-tab': true, active: tab() === 'register' }} onClick={() => setTab('register')}>Créer un compte</button>
          </div>
          <form class="account-form" onSubmit={submit}>
            <input
              class="account-input" placeholder="Nom utilisateur" autocomplete="username"
              value={username()} onInput={(e) => setUsername(e.currentTarget.value)}
            />
            <Show when={tab() === 'register'}>
              <input
                class="account-input" placeholder="Nom affiché (optionnel)"
                value={displayName()} onInput={(e) => setDisplayName(e.currentTarget.value)}
              />
            </Show>
            <input
              class="account-input" type="password" placeholder="Mot de passe" autocomplete="current-password"
              value={password()} onInput={(e) => setPassword(e.currentTarget.value)}
            />
            <button class="btn btn-peach" type="submit" disabled={busy()}>
              {tab() === 'login' ? 'Se connecter' : 'Créer mon compte'}
            </button>
          </form>
          <p class="account-hint">
            Un compte donne accès à « Mes projets » : tes mails en cours, suivis
            d'un appareil à l'autre, et remplis par tes agents.
          </p>
        </div>
      </Show>
    </Modal>
  )
}
