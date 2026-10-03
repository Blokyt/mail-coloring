#!/usr/bin/env node
/**
 * CLI du colorieur de mail — coquille fine sur l'API.
 * La vérité vit dans l'API (server/) ; ce script ne fait que des appels
 * HTTP, sans logique propre : projets, rendu, effets.
 *
 * Usage :
 *   MAILCOLORER_API_KEY=mc_... node bin/cli.mjs drafts list
 *   node bin/cli.mjs --url http://127.0.0.1:8030 --key mc_... drafts list
 *   node bin/cli.mjs drafts save "Titre" --html '<p>…</p>'
 *   node bin/cli.mjs drafts save "Titre" --spec spec.json
 *   node bin/cli.mjs render spec.json > mail.html
 *   node bin/cli.mjs effects
 *   node bin/cli.mjs login vicente   (affiche le token ; les clés se créent sur le site)
 *
 * Environnement : MAILCOLORER_URL (défaut https://mail-colorer-api.apps.rezal-mdm.com),
 * MAILCOLORER_API_KEY.
 */
import fs from 'node:fs'
import process from 'node:process'
import readline from 'node:readline/promises'

const args = process.argv.slice(2)
let url = process.env.MAILCOLORER_URL || 'https://mail-colorer-api.apps.rezal-mdm.com'
let key = process.env.MAILCOLORER_API_KEY || ''
const positional = []
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--url') url = args[++i]
  else if (args[i] === '--key') key = args[++i]
  else positional.push(args[i])
}

const help = () => console.log(fs.readFileSync(new URL('./cli.mjs', import.meta.url), 'utf8').split('*/')[0].replace(/\/\*\*|\n \* ?/g, '\n').replace(/^\n+/, ''))

async function api(path, init = {}, token) {
  const res = await fetch(`${url}/api/v1${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(key ? { 'x-api-key': key } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
  })
  const body = await res.text()
  const data = body ? JSON.parse(body) : {}
  if (!res.ok) {
    console.error(`Erreur ${res.status}: ${data.error || res.statusText}`)
    process.exit(1)
  }
  return data
}

const [cmd, sub, ...rest] = positional

async function main() {
  if (!cmd || cmd === 'help') return help()

  if (cmd === 'login') {
    const rl = readline.createInterface({ input: process.stdin, output: process.stderr })
    const password = await rl.question('mot de passe : ')
    rl.close()
    const r = await api('/auth/login', { method: 'POST', body: JSON.stringify({ username: sub, password }) })
    console.log(`Token (30 jours) : ${r.token}`)
    console.error('Crée plutôt une clé API sur le site (👤 → Créer une clé) pour les agents.')
    return
  }

  if (!key) {
    console.error('Clé API requise : MAILCOLORER_API_KEY=mc_... ou --key mc_... (👤 sur le site → Créer une clé)')
    process.exit(2)
  }

  if (cmd === 'effects') {
    const cat = await api('/effects')
    console.log(JSON.stringify(cat, null, 2))
    return
  }

  if (cmd === 'render') {
    const specRaw = rest[0] && rest[0] !== '-' ? fs.readFileSync(rest[0], 'utf8') : fs.readFileSync(0, 'utf8')
    const r = await api('/render', { method: 'POST', body: JSON.stringify(JSON.parse(specRaw)) })
    process.stdout.write(r.html)
    return
  }

  if (cmd === 'drafts') {
    if (sub === 'list') {
      const { drafts } = await api('/drafts')
      if (!drafts.length) return console.log('Aucun projet.')
      for (const d of drafts) {
        console.log(`${d.id}  [${d.status}]${d.updated_by === 'agent' ? ' [agent]' : ''}  ${d.updated_at.slice(0, 16).replace('T', ' ')}  ${d.title}`)
      }
      return
    }
    if (sub === 'get') {
      const { draft } = await api(`/drafts/${rest[0]}`)
      console.log(JSON.stringify(draft, null, 2))
      return
    }
    if (sub === 'save') {
      const title = rest[0]
      if (!title) { console.error('Titre requis'); process.exit(2) }
      let body = { title }
      const htmlIdx = rest.indexOf('--html')
      const specIdx = rest.indexOf('--spec')
      if (htmlIdx !== -1) body.html = rest[htmlIdx + 1]
      else if (specIdx !== -1) body.spec = JSON.parse(fs.readFileSync(rest[specIdx + 1], 'utf8'))
      else body.html = fs.readFileSync(0, 'utf8')
      const r = await api('/drafts', { method: 'POST', body: JSON.stringify(body) })
      console.log(`Projet créé : ${r.draft.id} — ${r.draft.title}`)
      return
    }
    if (sub === 'delete') {
      await api(`/drafts/${rest[0]}`, { method: 'DELETE' })
      console.log('Supprimé.')
      return
    }
    return help()
  }

  help()
}

main().catch((e) => { console.error(e.message); process.exit(1) })
