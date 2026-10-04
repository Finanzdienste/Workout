#!/usr/bin/env python3
"""Was ein Neulauf an den vier Plänen ändert – als Tabelle fürs README.

    python3 tools/pruefung/vorher-nachher.py              # gegen origin/main
    python3 tools/pruefung/vorher-nachher.py <commit>     # gegen diesen Stand
    python3 tools/pruefung/vorher-nachher.py <commit> --nachher 'pfad/t-{v}.json'

Je Plan und Modus nebeneinander: Rüstvorgänge je Einheit (wie die App zählt,
nur mit Hanteln – ohne Hanteln wird nichts umgebaut), Sätze und Übungen je
Einheit, Auftritte ohne drei Sätze, Wochensätze je Gruppe gegen ihr Ziel (im
Schnitt und in der einzelnen Woche), Termine, größter Abstand, dieselbe
Bewegung zweimal in einer Einheit und die Sätze mit Rucksack. Bis zum 03.10.
standen diese Tabellen von Hand im README, aus Zahlen verschiedener Skripte;
jetzt kommen sie aus einem Lauf, und wer sie nachrechnen will, ruft ihn auf.

Ein Bericht, kein Tor: Rückgabewert immer 0. Die Tore sind plan-pruefen.py,
wochen-cap.py und bewegung.py.
"""
import collections
import importlib.util
import json
import pathlib
import statistics
import subprocess
import tempfile
import sys

HIER = pathlib.Path(__file__).resolve().parent
ROOT = HIER.parent.parent
META = json.loads((ROOT / 'tools' / 'exercise-meta.json').read_text(encoding='utf-8'))
DATEI = {'standard': 'plan.json', 'bbp': 'plan-bbp.json', 'cut': 'plan-cut.json',
         'oberkoerper': 'plan-oberkoerper.json'}
NAME = {'standard': 'Aufbau', 'bbp': 'Bauch, Beine, Po', 'cut': 'Cut', 'oberkoerper': 'Oberkörper'}
WEEK = 4


def lade(name, datei):
    spec = importlib.util.spec_from_file_location(name, HIER / datei)
    m = importlib.util.module_from_spec(spec)
    argv, sys.argv = sys.argv, [sys.argv[0]]       # die Module lesen sonst unsere Schalter
    spec.loader.exec_module(m)
    sys.argv = argv
    return m


pp = lade('planpruefen', 'plan-pruefen.py')
ra = lade('ruestaufwand', 'ruestaufwand.py')
bwm = lade('bewegung', 'bewegung.py')


def lies(rev, v):
    roh = subprocess.run(['git', 'show', f'{rev}:tools/{DATEI[v]}'], cwd=ROOT,
                         capture_output=True, text=True)
    return json.loads(roh.stdout) if roh.returncode == 0 else None


def zahl(x, stellen=2):
    return f'{x:.{stellen}f}'.replace('.', ',')


def kennzahlen(daten, v, modus):
    """Die Zeilen der Tabelle für einen Plan in einem Modus."""
    # plan-pruefen.py misst eine Datei; der Stand von vorher liegt nur in git.
    with tempfile.TemporaryDirectory() as ordner:
        tmp = pathlib.Path(ordner) / f'{v}.json'
        tmp.write_text(json.dumps(daten), encoding='utf-8')
        pp_pfad = pp.pfad
        pp.pfad = lambda _v: tmp
        try:
            m = pp.messen(v, modus)
        finally:
            pp.pfad = pp_pfad
    plan = daten['plan']
    feld = 'bwSets' if modus == 'bw' else 'sets'
    anteile = f'{modus}Shares'
    wochen = len(plan) // WEEK
    laengen = [sum(it.get(feld, it['sets']) for it in e['ex']) for e in plan]
    ziele = {g: t for g, t in m['ziele'].items() if t is not None}
    # Wochenvolumen je Gruppe, um zu zählen, wie oft eine Woche über ihrer
    # Grenze liegt (dieselbe Rechnung wie wochen-cap.py).
    vol = collections.defaultdict(lambda: collections.defaultdict(float))
    for k, e in enumerate(plan):
        for it in e['ex']:
            for g, a in META[it['id']].get(anteile, {}).items():
                vol[k // WEEK][g] += it.get(feld, it['sets']) * a
    ueber = []
    for w in vol.values():
        for g, x in w.items():
            grenze = max(daten['cap'], daten['target'].get(g) or 0)
            if x > grenze + 1e-9:
                ueber.append(x - grenze)
    doppelt = sum(1 for e in plan for a in range(len(e['ex'])) for b in range(a + 1, len(e['ex']))
                  if {x for x in bwm.bewegungen(e['ex'][a]['id']) if x[0] == modus}
                  & {x for x in bwm.bewegungen(e['ex'][b]['id']) if x[0] == modus})
    # Rucksack wie in startpunkt.py: mit Rucksack, aber nicht an der
    # Klimmzugstange – Chin-ups stehen dort nur mit 0 kg „im Rucksack".
    rucksack = sum(it.get(feld, it['sets']) for e in plan for it in e['ex']
                   if META[it['id']].get('equip') == 'backpack'
                   and 'Klimmzugstange' not in META[it['id']].get('dbEquip', '')) / wochen
    # Ohne Hanteln: wie viele Auftritte eine andere Satzzahl haben als mit, und
    # wie viele Übungen dabei mal zwei, mal vier Sätze bekommen.
    je_uebung = collections.defaultdict(set)
    for e in plan:
        for it in e['ex']:
            je_uebung[it['id']].add(it.get('bwSets', it['sets']))
    anders = (sum(1 for e in plan for it in e['ex'] if it.get('bwSets', it['sets']) != it['sets']),
              sum(1 for v in je_uebung.values() if 2 in v and 4 in v)) if modus == 'bw' else None
    # Die einzelne Woche gegen das Ziel, nicht nur der Schnitt: Mit drei Sätzen
    # je Auftritt kommen Brust und Rücken auf 9 oder 12, nie auf 10. Gemessen
    # für „2 bis 4 Sätze – gemessen" im README, in Sätzen je Gruppe und Woche.
    woche_ab = [abs(vol[w][g] - t) for w in range(wochen) for g, t in ziele.items()]
    satzzahlen = collections.defaultdict(set)
    for e in plan:
        for it in e['ex']:
            satzzahlen[it['id']].add(it.get(feld, it['sets']))
    return {
        'woche_ab': (statistics.mean(woche_ab), max(woche_ab)),
        'ohne_drei': (sum(1 for e in plan for it in e['ex'] if it.get(feld, it['sets']) != 3),
                      sum(1 for v in satzzahlen.values() if 2 in v and 4 in v)),
        'uebungen': statistics.mean(len(e['ex']) for e in plan),
        'anders': anders,
        'ruest': (statistics.mean(sum(ra.ruesten(ra.sortiere([it['id'] for it in e['ex']]))[:2])
                                  for e in plan) if modus == 'db' else None),
        'laenge': (min(laengen), max(laengen)),
        'verteilung': sorted(collections.Counter(laengen).items()),
        'ziel': max(abs(m['schnitt'][g] - t) for g, t in ziele.items()),
        'ueber': (max(ueber) if ueber else 0.0, len(ueber)),
        'termine': sum(m['frequenz'].values()),
        'abstand': {g: m['abstand'][g][1] for g in m['gruppen'] if m['abstand'][g][1] is not None},
        'doppelt': doppelt,
        'rucksack': rucksack,
    }


def tabelle(v, alt, neu):
    a = {modus: kennzahlen(alt, v, modus) for modus in ('db', 'bw')}
    n = {modus: kennzahlen(neu, v, modus) for modus in ('db', 'bw')}
    zeilen = []

    def zeile(titel, f):
        zeilen.append(f'| {titel} | ' + ' | '.join(f(x[modus]) for modus in ('db', 'bw') for x in (a, n)) + ' |')

    zeile('Rüstvorgänge je Einheit', lambda k: '–' if k['ruest'] is None else zahl(k['ruest']))
    zeile('Sätze je Einheit', lambda k: f'{k["laenge"][0]}–{k["laenge"][1]} ('
          + ', '.join(f'{c} × {s}' for s, c in k['verteilung']) + ')')
    zeile('Übungen je Einheit', lambda k: zahl(k['uebungen']))
    zeile('Auftritte ohne drei Sätze (Übungen mal mit 2, mal mit 4)',
          lambda k: f'{k["ohne_drei"][0]} ({k["ohne_drei"][1]})')
    zeile('Auftritte mit anderer Satzzahl als mit Hanteln (Übungen mal mit 2, mal mit 4)',
          lambda k: '–' if k['anders'] is None else f'{k["anders"][0]} ({k["anders"][1]})')
    zeile('Wochensätze: größte Abweichung des Schnitts vom Ziel', lambda k: zahl(k['ziel']))
    zeile('Wochensätze: Abweichung der einzelnen Woche vom Ziel, Mittel / größte',
          lambda k: f'{zahl(k["woche_ab"][0])} / {zahl(k["woche_ab"][1])}')
    zeile('stärkste Woche über der Grenze (Gruppenwochen darüber)',
          lambda k: f'+{zahl(k["ueber"][0])} ({k["ueber"][1]})')
    zeile('Termine je Woche, alle Gruppen zusammen', lambda k: zahl(k['termine'], 1))
    zeile('größter Abstand (Tage)', lambda k: str(max(k['abstand'].values())))
    zeile('dieselbe Bewegung zweimal in einer Einheit', lambda k: str(k['doppelt']))
    zeile('Rucksack (Sätze je Woche)', lambda k: zahl(k['rucksack'], 1))
    # Wo sich der größte Abstand einer Gruppe bewegt, in Worten darunter.
    anders = []
    for modus, wort in (('db', 'mit Hanteln'), ('bw', 'ohne Hanteln')):
        for g in sorted(n[modus]['abstand']):
            x, y = a[modus]['abstand'].get(g), n[modus]['abstand'][g]
            if x is not None and x != y:
                anders.append(f'{pp.NAMEN.get(g, g)} {wort} {x} → {y}')
    kopf = ('| | vorher, mit Hanteln | nachher, mit Hanteln | vorher, ohne Hanteln | nachher, ohne Hanteln |\n'
            '| --- | --- | --- | --- | --- |')
    return (f'#### {NAME[v]}\n\n{kopf}\n' + '\n'.join(zeilen) + '\n\n'
            + ('Größter Abstand je Gruppe, wo er sich ändert (Tage): ' + '; '.join(anders) + '.\n'
               if anders else 'Der größte Abstand ändert sich bei keiner Gruppe.\n'))


def main():
    args = sys.argv[1:]
    muster = None
    if '--nachher' in args:
        i = args.index('--nachher')
        muster = args[i + 1]
        del args[i:i + 2]
    rev = args[0] if args else 'origin/main'
    for v in DATEI:
        alt = lies(rev, v)
        neu_pfad = pathlib.Path(muster.format(v=v)) if muster else ROOT / 'tools' / DATEI[v]
        if alt is None or not neu_pfad.exists():
            print(f'{NAME[v]}: kein Vergleich ({rev})\n')
            continue
        print(tabelle(v, alt, json.loads(neu_pfad.read_text(encoding='utf-8'))))
    return 0


if __name__ == '__main__':
    sys.exit(main())
