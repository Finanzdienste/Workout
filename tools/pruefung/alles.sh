#!/bin/sh
# Genau die Schritte aus .github/workflows/pruefung.yml, lokal und in derselben
# Reihenfolge – damit "alles grün" vor dem Push dasselbe heißt wie danach.
set -e
cd "$(git rev-parse --show-toplevel)"
sh tools/pruefung/tore.sh
sh tools/pruefung/erzeugt.sh
npx --no-install eslint js sw.js tests tools schilddruese kalender
echo "✓ Linter"
node tests/lauf.mjs
