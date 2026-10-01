# Mail Colorer — colorieur de mail du Rézal

Outil web (SolidJS + Vite) qui colore et met en forme du texte pour les
mails Outlook (un graphème = un span stylé, couleurs en hex, tailles px,
effets de taille pilotés par profil). En production sur
`mail-colorer.rezal-mdm.com` (statique, servi par la VM Web du Rézal).

Propriété centrale : le document final ne dépend que de l'état final,
jamais du chemin qui y a mené (commutation des opérations, testée).
La frappe passe par des chemins rapides en place (`insertTextInPlace`,
`deleteRangeInPlace`) qui doivent produire EXACTEMENT le même document
que le chemin complet — c'est ce que vérifient les tests de parité
(`src/engine/editor-fastpath.test.ts`).

## Dev

```bash
pnpm install
pnpm exec vite --port 8020 --strictPort   # ou via Bravent (MailColorer/web)
```

Le serveur de dev est déclaré comme service Bravent `MailColorer/web`
(port 8020) dans le workingset de la cap Associatif : il se lance par
Bravent, jamais depuis le shell.

## Tests

```bash
pnpm test                       # unitaires (vitest, happy-dom)
E2E_PORT=8020 pnpm test:e2e     # navigateur réel (playwright, réutilise le serveur Bravent)
```

`e2e/perf.spec.ts` est le garde-fou de régression de la latence de
frappe : à 3 pages de texte (~5500 spans), médiane < 20 ms, p90 < 40 ms.

## Déploiement

```bash
scripts/deploy-rezal.sh
```

Build + rsync de `dist/` vers la VM Web (`/home/rezal/mail-colorer/`).
Toute écriture SSH vers le Rézal exige un bail `rezal_guard` (approbation
au téléphone) : voir `5 TOOLS/Scripts/fleet/lease.py` dans le second
cerveau. Les fichiers de données (`admin-data.json`, `defaults.json`)
vivent dans `public/` et sont servis tels quels ; le certificat est
renouvelé côté ReverseProxy, rien à faire ici.

## API, projets et agents (2026-10-01)

`server/` porte l'API (Fastify + SQLite) : comptes, **projets** (les mails
en cours, multi-sessions, jamais perdus), **clés API** (pour un agent),
rendu d'effets sans navigateur et **MCP** (`/api/v1/mcp`, auth X-API-Key).
Le moteur de rendu pur (`src/engine/render.ts`) reprend exactement le HTML
Outlook de l'éditeur — parité prouvée par `src/engine/render.test.ts`.

```bash
cd server && pnpm install && pnpm build && pnpm start   # API sur :8030
pnpm vitest run --config server/vitest.config.ts          # tests API
node bin/cli.mjs help                                     # CLI (projets, rendu)
```

- Panneaux du site : 🗂 **Mes projets** (liste, ouvrir, mettre à jour,
  supprimer — badge « agent » sur les écritures d'agent), 👤 **compte**
  (connexion, création/révocation de clés).
- Un agent utilise l'API avec `X-API-Key` (clé créée sur le site), ou le
  MCP (`mailcolorer_render`, `mailcolorer_draft_*`…), ou le CLI.
- Dev : le serveur Vite proxifie `/api/v1` vers :8030 ; `/api/save-*`
  reste au plugin admin local.

## Déploiement

- **Coolify (VM deploy du Rézal)** : deux apps sur ce dépôt —
  `Dockerfile.api` (API, volume `/data` pour SQLite) et `Dockerfile.front`
  (statique nginx). Domaines : `http://mail-colorer.rezal-mdm.com` pour le
  front (vhost ReverseProxy → Traefik, cf. rezal-deploy/docs/) et
  `http://mail-colorer-api.apps.rezal-mdm.com` (ou un chemin `/api/v1`
  sous le même domaine) pour l'API. Runbook : `rezal-deploy/docs/deployer-une-app.md`.
- **VM Web (héritée)** : `scripts/deploy-rezal.sh` (build + rsync) reste
  valable tant que le front n'a pas migré ; le retirer après bascule.
