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
