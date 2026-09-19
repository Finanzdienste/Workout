#!/usr/bin/env python3
"""Alt gegen neu: Was ein Plan-Neulauf an den Zahlen ändert.

    python3 tools/pruefung/plan-vergleich.py

Der Vergleichsstand in befunde.json haelt fest, wie gut die *ausgelieferten*
Plaene sind. Nach einem Neulauf stehen neue Plandateien da, und plan-pruefen.py
sagt dann Zeile fuer Zeile, was schlechter geworden ist – aber nicht, was besser
geworden ist. Wer nur die eine Haelfte sieht, schreibt den Stand entweder blind
neu oder wirft einen besseren Plan weg.

Dieses Skript zeigt beide Haelften nebeneinander, je Variante und Modus:
Frequenz, groesster Abstand, staerkste Woche, ausgefallene Uebungen. Es ist ein Bericht und kein
Tor – es gibt immer 0 zurueck.
"""
import json
import pathlib
import sys

HIER = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HIER))
# plan-pruefen.py hat einen Bindestrich im Namen, laesst sich also nicht
# gewoehnlich importieren.
import importlib.util
spec = importlib.util.spec_from_file_location('planpruefen', HIER / 'plan-pruefen.py')
pp = importlib.util.module_from_spec(spec)
sys.argv = [sys.argv[0]]        # sonst liest das Modul unsere Schalter
spec.loader.exec_module(pp)

stand = json.loads((HIER / 'befunde.json').read_text(encoding='utf-8'))

BESSER, SCHLECHTER = [], []
for variante in pp.VARIANTEN:
    for modus in pp.MODI:
        schluessel = f'{variante}/{modus}'
        alt = stand.get(schluessel)
        if not alt:
            print(f'{schluessel}: kein Vergleichsstand')
            continue
        neu = pp.messen(variante, modus)
        zeilen = []
        for g in neu['gruppen']:
            name = pp.NAMEN.get(g, g)
            af, nf = alt['frequenz'].get(g), round(neu['frequenz'][g], 2)
            if af is not None and abs(af - nf) >= 0.01:
                zeilen.append((nf > af, f'  Frequenz {name}: {af} -> {nf} /Woche'))
            aa, na = alt['abstand_max'].get(g), neu['abstand'][g][1]
            if aa is not None and na is not None and aa != na:
                zeilen.append((na < aa, f'  groesster Abstand {name}: {aa} -> {na} Tage'))
            aw, nw = alt.get('woche_max', {}).get(g), round(neu['woche_max'][g], 2)
            if aw is not None and abs(aw - nw) >= 0.01:
                zeilen.append((nw < aw, f'  staerkste Woche {name}: {aw} -> {nw} Saetze'))
        raus = sorted(set(neu['ohne_saetze']) - set(alt.get('ohne_saetze', [])))
        rein = sorted(set(alt.get('ohne_saetze', [])) - set(neu['ohne_saetze']))
        for i in raus:
            zeilen.append((False, f'  faellt aus dem Plan: {i}'))
        for i in rein:
            zeilen.append((True, f'  kommt neu in den Plan: {i}'))
        print(f'\n=== {schluessel} ===')
        if not zeilen:
            print('  unveraendert')
        for gut, text in sorted(zeilen, key=lambda z: (not z[0], z[1])):
            print(('  + ' if gut else '  - ') + text.strip())
            (BESSER if gut else SCHLECHTER).append(f'{schluessel}{text}')

print(f'\n{len(BESSER)} Verbesserung(en), {len(SCHLECHTER)} Verschlechterung(en).')
