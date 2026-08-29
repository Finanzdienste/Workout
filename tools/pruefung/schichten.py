#!/usr/bin/env python3
"""Prueft die Schichtung der ES-Module unter js/.

    python3 tools/pruefung/schichten.py

Drei Dinge, die alle drei still kaputtgehen:

1. **Kreise.** js/app.js wurde aufgeteilt, damit die Rechnung nicht mehr an der
   Anzeige haengt. Diese Richtung haelt nur, solange sie geprueft wird: Ein
   `import` zurueck nach app.js faellt beim Programmieren nicht auf, weil es im
   Browser funktioniert – bis eine Auswertungsreihenfolge kippt.

2. **Das Buendel.** dist/workout.html haengt alle Module in *einer* Liste
   aneinander (tools/build-single.py). Fehlt dort ein Modul, ist die Ein-Datei-
   Fassung kaputt, waehrend index.html weiterlaeuft. Steht es an der falschen
   Stelle, ist eine Konstante beim Auswerten noch nicht da.

3. **Der Zwischenspeicher.** sw.js listet auf, was fuer den Betrieb ohne Netz
   vorgehalten wird. Ein fehlendes Modul merkt nur, wer offline geht – also
   genau der, dem es am wenigsten hilft.
"""
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
JS = ROOT / 'js'

IMPORT_RE = re.compile(r"^\s*import\s+(?:.+?\s+from\s+)?'\./([\w.-]+)';", re.MULTILINE)

fehler = []


def importe(datei):
    src = (JS / datei).read_text(encoding='utf-8')
    # Kommentare zaehlen nicht: In ihnen stehen Modulnamen als Erklaerung.
    src = re.sub(r'/\*.*?\*/', '', src, flags=re.S)
    return IMPORT_RE.findall(src)


dateien = sorted(p.name for p in JS.glob('*.js'))
graph = {d: importe(d) for d in dateien}

for datei, ziele in graph.items():
    for ziel in ziele:
        if ziel not in graph:
            fehler.append(f'{datei} importiert {ziel} – die Datei gibt es nicht')

# --- 1. Kreise ----------------------------------------------------------
farbe = {}
weg = []


def besuche(d):
    farbe[d] = 'grau'
    weg.append(d)
    for z in graph.get(d, []):
        if farbe.get(z) == 'grau':
            kreis = weg[weg.index(z):] + [z]
            fehler.append('Kreis: ' + ' -> '.join(kreis))
        elif z in graph and farbe.get(z) is None:
            besuche(z)
    weg.pop()
    farbe[d] = 'schwarz'


for d in dateien:
    if farbe.get(d) is None:
        besuche(d)

# --- 2. Das Buendel -----------------------------------------------------
single = (ROOT / 'tools' / 'build-single.py').read_text(encoding='utf-8')
block = re.search(r'MODULES = \[(.*?)\]', single, re.S)
gelistet = re.findall(r"'js/([\w.-]+)'", block.group(1)) if block else []

# Alles, was von app.js aus erreichbar ist, muss ins Buendel.
erreichbar = set()


def sammle(d):
    if d in erreichbar:
        return
    erreichbar.add(d)
    for z in graph.get(d, []):
        sammle(z)


sammle('app.js')
fehlt = sorted(erreichbar - set(gelistet))
if fehlt:
    fehler.append('nicht in MODULES (tools/build-single.py): ' + ', '.join(fehlt))

platz = {name: i for i, name in enumerate(gelistet)}
for datei in gelistet:
    for ziel in graph.get(datei, []):
        if ziel in platz and platz[ziel] > platz[datei]:
            fehler.append(f'MODULES: {ziel} steht hinter {datei}, wird aber davon benutzt')

# --- 3. Der Zwischenspeicher -------------------------------------------
sw = (ROOT / 'sw.js').read_text(encoding='utf-8')
shell = re.search(r'const SHELL = \[(.*?)\];', sw, re.S)
im_cache = set(re.findall(r"'\./js/([\w.-]+)'", shell.group(1))) if shell else set()
# ics.js wird erst beim Kalenderexport geladen, liegt aber trotzdem im Vorrat.
fehlt = sorted(erreichbar - im_cache)
if fehlt:
    fehler.append('nicht in SHELL (sw.js): ' + ', '.join(fehlt))

if fehler:
    print('Schichtung: FEHLER')
    for f in fehler:
        print('  ' + f)
    sys.exit(1)

print(f'{len(dateien)} Module, keine Kreise.')
print(f'Buendel und Zwischenspeicher kennen alle {len(erreichbar)}, die von app.js aus '
      'erreichbar sind.')
