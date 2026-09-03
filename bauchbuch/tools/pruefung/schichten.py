#!/usr/bin/env python3
"""Prueft die Schichtung der ES-Module unter js/.

    python3 tools/pruefung/schichten.py

Drei Dinge, die alle drei still kaputtgehen:

1. **Kreise.** Die Rechenschicht (auswertung.js, bericht.js) darf nichts von
   der Anzeige wissen. Diese Richtung haelt nur, solange sie geprueft wird: Ein
   `import` zurueck nach app.js faellt beim Programmieren nicht auf, weil es im
   Browser funktioniert - bis eine Auswertungsreihenfolge kippt.

2. **Das Buendel.** dist/bauchbuch.html haengt alle Module in *einer* Liste
   aneinander (tools/build-single.py). Fehlt dort ein Modul, ist die
   Ein-Datei-Fassung kaputt, waehrend index.html weiterlaeuft - und die
   Ein-Datei-Fassung ist bei dieser App der Hauptweg, weil sie ohne Server und
   ohne Adresse auskommt.

3. **Der Zwischenspeicher.** sw.js listet auf, was fuer den Betrieb ohne Netz
   vorgehalten wird. Ein fehlendes Modul merkt nur, wer offline geht - also
   genau der, dem es am wenigsten hilft.
"""
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
JS = ROOT / 'js'

IMPORT_RE = re.compile(r"from\s+'\./([\w.-]+)';", re.MULTILINE)

fehler = []


def importe(datei):
    src = (JS / datei).read_text(encoding='utf-8')
    # Kommentare zaehlen nicht: In ihnen stehen Modulnamen als Erklaerung.
    src = re.sub(r'/\*.*?\*/', '', src, flags=re.S)
    src = re.sub(r'//.*$', '', src, flags=re.M)
    return IMPORT_RE.findall(src)


dateien = sorted(p.name for p in JS.glob('*.js'))
graph = {d: importe(d) for d in dateien}

for datei, ziele in graph.items():
    for ziel in ziele:
        if ziel not in graph:
            fehler.append(f'{datei} importiert {ziel} - die Datei gibt es nicht')

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

# Die Anzeige darf rechnen lassen, aber nicht umgekehrt.
for rechner in ('auswertung.js', 'bericht.js', 'store.js', 'daten.js', 'datum.js',
                'text.js', 'mittel.js', 'zyklus.js', 'bild.js', 'rat.js',
                'atem.js', 'klang.js'):
    if 'app.js' in graph.get(rechner, []):
        fehler.append(f'{rechner} importiert app.js - die Rechnung haengt dann an der Anzeige')

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

uebrig = sorted(set(gelistet) - erreichbar)
if uebrig:
    fehler.append('in MODULES, aber von app.js aus nicht erreichbar: ' + ', '.join(uebrig))

platz = {name: i for i, name in enumerate(gelistet)}
for datei in gelistet:
    for ziel in graph.get(datei, []):
        if ziel in platz and platz[ziel] > platz[datei]:
            fehler.append(f'MODULES: {ziel} steht hinter {datei}, wird aber davon benutzt')

# --- 3. Der Zwischenspeicher -------------------------------------------
sw = (ROOT / 'sw.js').read_text(encoding='utf-8')
shell = re.search(r'const SHELL = \[(.*?)\];', sw, re.S)
im_vorrat = set(re.findall(r"'\./js/([\w.-]+)'", shell.group(1))) if shell else set()
fehlt = sorted(erreichbar - im_vorrat)
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
