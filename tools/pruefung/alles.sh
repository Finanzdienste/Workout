#!/bin/sh
# Genau die Schritte aus .github/workflows/pruefung.yml, lokal und in derselben
# Reihenfolge – damit "alles grün" vor dem Push dasselbe heißt wie danach.
set -e
cd "$(git rev-parse --show-toplevel)"
python3 tools/pruefung/plan-pruefen.py --bericht >/dev/null
python3 tools/pruefung/weg-nach-unten.py >/dev/null
python3 tools/pruefung/geraete.py >/dev/null
python3 tools/pruefung/wochen-cap.py >/dev/null
python3 tools/pruefung/plan-frisch.py >/dev/null
python3 tools/pruefung/schichten.py >/dev/null
echo "✓ Tore"
sh tools/pruefung/erzeugt.sh
npx --no-install eslint js sw.js tests tools
echo "✓ Linter"
node tests/lauf.mjs
