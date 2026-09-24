#!/bin/sh
# Sind js/data.js und dist/workout.html aus den jetzigen Quellen gebaut?
#
# Dieselbe Frage wie der CI-Schritt "Erzeugte Dateien sind aktuell", nur vor
# dem Commit statt nach dem Push. Anlass waren drei Fälle an einem Tag, alle
# gleicher Bauart: Nach dem Bauen wurde noch eine Quelle geändert (einmal nur
# ein Kommentar umbrochen), oder der Bau scheiterte am Bündel und ließ die alte
# Datei liegen. CI merkte es jedes Mal erst nach dem Push.
#
# Zwei Fehlerarten, beide mit eigenem Text:
#   - Der Bau selbst scheitert (Namenskollision im Bündel, umbenannter Import).
#     Dann ist *jede* weitere Aussage über die erzeugten Dateien wertlos – ein
#     Vergleich vorher/nachher meldete in dem Fall "unverändert", weil beide
#     Läufe am selben Fehler scheiterten.
#   - Der Bau ändert etwas. Dann waren die Dateien veraltet; sie sind jetzt neu
#     gebaut und müssen nur noch mit in den Commit.
cd "$(git rev-parse --show-toplevel)" || exit 1
vorher=$(cat js/data.js dist/workout.html | sha256sum)
if ! python3 tools/build-data.py >/dev/null; then
  echo "✗ tools/build-data.py ist gescheitert (Ausgabe oben)." >&2; exit 1
fi
if ! python3 tools/build-single.py >/dev/null; then
  echo "✗ tools/build-single.py ist gescheitert (Ausgabe oben) – dist/workout.html ist NICHT neu gebaut." >&2; exit 1
fi
nachher=$(cat js/data.js dist/workout.html | sha256sum)
if [ "$vorher" != "$nachher" ]; then
  echo "✗ js/data.js oder dist/workout.html waren nicht aus den jetzigen Quellen gebaut." >&2
  echo "  Sie sind jetzt neu gebaut: git add js/data.js dist/workout.html und noch einmal." >&2
  exit 1
fi
echo "✓ erzeugte Dateien sind aktuell"
