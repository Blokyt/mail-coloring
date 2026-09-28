#!/usr/bin/env bash
# Déploiement de Mail Colorer en production (VM Web du Rézal).
#
# Garde : toute écriture ssh/scp/rsync vers le Rézal est refusée sans bail
# rezal_guard (registre 5 TOOLS/Scripts/fleet/rezal.toml). Demander un bail
# borné avant de lancer :
#   python "5 TOOLS/Scripts/fleet/lease.py" request --scope rezal:Web \
#     --ttl 30m --why "deploiement mail-colorer"
set -euo pipefail
cd "$(dirname "$0")/.."

pnpm run build

# --delete retire les anciens bundles (les fichiers hashés changent de nom) ;
# les données (admin-data.json, defaults.json) sont dans public/ et suivent le
# build — vérifier leur diff avant si la prod a été modifiée via le panneau admin.
rsync -av --delete dist/ Web:/home/rezal/mail-colorer/

echo "Déployé. Vérifier : https://mail-colorer.rezal-mdm.com"
