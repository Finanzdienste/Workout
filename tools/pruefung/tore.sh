#!/bin/sh
# Die schnellen Tore aus .github/workflows/pruefung.yml (Job „Pläne und
# erzeugte Dateien"), zusammen unter einer Sekunde. Der Commit-Haken und
# `npm run pruefen` rufen beide diese eine Liste auf.
#
# Bis v253 hatte der Haken nur drei davon. Das Beckenheben mit Langhantel
# (v252) steht in keinem Plan, wie gewollt – plan-pruefen.py meldete es
# trotzdem als „fällt neuerdings ganz aus dem Plan", weil der Vergleichsstand
# in befunde.json die Übung noch nicht kannte. Gesehen hat das erst CI, zwei
# Fassungen später.
#
# Ausgabe nur, wenn ein Tor anschlägt – dann vollständig.
set -e
cd "$(git rev-parse --show-toplevel)"
for tor in plan-pruefen weg-nach-unten geraete wochen-cap plan-frisch schichten bewegung versionspflicht plan-vorher; do
  if ! ausgabe=$(python3 "tools/pruefung/$tor.py" 2>&1); then
    printf '%s\n' "$ausgabe" >&2
    echo "✗ tools/pruefung/$tor.py" >&2
    exit 1
  fi
done
echo "✓ Tore"
