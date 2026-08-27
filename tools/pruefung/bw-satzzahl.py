#!/usr/bin/env python3
"""Die Bodyweight-Satzzahl für die vorhandenen Pläne rechnen.

Der Hantel-Plan ändert sich dabei nicht – Termine, Übungen und Satzzahlen
bleiben, wie sie sind. Dazu kommt je Auftritt nur ein `bwSets`. Deshalb muss
auch niemand sechsmal zehn Minuten Generatorlauf abwarten, um es einzuführen:
Die Rechnung hängt allein am fertigen Plan.

    python3 tools/pruefung/bw-satzzahl.py            # nur zeigen
    python3 tools/pruefung/bw-satzzahl.py --schreiben # in die Plandateien

Ein voller Generatorlauf kommt zum selben Ergebnis; bw_saetze() ist
deterministisch und bekommt dieselbe Eingabe.
"""
import collections
import importlib.util
import json
import pathlib
import sys

WURZEL = pathlib.Path(__file__).resolve().parent.parent
ROOT = WURZEL.parent
ARGV = sys.argv[1:]
VARIANTEN = ['standard', 'bbp', 'oberkoerper', 'kurz', 'beine', 'cut']
LABEL = {
    'chest': 'Brust', 'lats': 'Rücken', 'sideDelts': 'Schulter seitlich',
    'rearDelts': 'Schulter hinten', 'frontDelts': 'Schulter vorn', 'traps': 'Nacken',
    'biceps': 'Bizeps', 'triceps': 'Trizeps', 'abs': 'Bauch', 'glutes': 'Gesäß',
    'quads': 'Oberschenkel vorn', 'hamstringsHip': 'Beinbeuger (Hüfte)',
    'hamstringsKnee': 'Beinbeuger (Knie)', 'calves': 'Waden',
}


def lade(variante):
    """build-plan.py mit den Zielen dieser Variante laden."""
    sys.argv = ['build-plan.py', variante]
    spec = importlib.util.spec_from_file_location(f'bp_{variante}', str(WURZEL / 'build-plan.py'))
    bp = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(bp)
    meta = json.loads(bp.META.read_text(encoding='utf-8'))
    bp.BW_SHARES.update({k: v['bwShares'] for k, v in meta.items()})
    return bp


def pfad(variante):
    return ROOT / 'tools' / ('plan.json' if variante == 'standard' else f'plan-{variante}.json')


def abweichung(bp, plan, feld, weeks):
    """Wie weit liegt der Bodyweight-Modus je Zielgruppe daneben?"""
    got = collections.Counter()
    for e in plan:
        for it in e['ex']:
            for m, a in bp.BW_SHARES.get(it['id'], {}).items():
                got[m] += it[feld] * a
    return sorted(((got[m] / weeks - bp.TARGET[m], m) for m in bp.TARGET
                   if bp.TARGET.get(m) is not None), key=lambda x: -abs(x[0]))


schreiben = '--schreiben' in ARGV
gesamt_gut = True
for v in [a for a in ARGV if not a.startswith('-')] or VARIANTEN:
    bp = lade(v)
    daten = json.loads(pfad(v).read_text(encoding='utf-8'))
    plan = daten['plan']
    weeks = len(plan) // 4

    vorher = abweichung(bp, plan, 'sets', weeks)
    total, rest, ganz = bp.bw_saetze(plan, weeks)
    bp.bw_verteilen(plan, total)
    nachher = abweichung(bp, plan, 'bwSets', weeks)

    auftritte = sum(len(e['ex']) for e in plan)
    anders = sum(1 for e in plan for it in e['ex'] if it['bwSets'] != it['sets'])
    spanne = collections.Counter(it['bwSets'] for e in plan for it in e['ex'])
    q_vor = sum(d * d for d, _ in vorher)
    q_nach = sum(d * d for d, _ in nachher)
    gut = rest < 1e-9

    print(f'\n=== {v} · {weeks} Wochen ===')
    print(f'  Auftritte {auftritte}, davon {anders} nicht bei drei Sätzen '
          f'({", ".join(f"{n}×{k} Sätze" for k, n in sorted(spanne.items()))})')
    print(f'  Sätze gesamt: Hantel {sum(it["sets"] for e in plan for it in e["ex"])}, '
          f'Bodyweight {sum(it["bwSets"] for e in plan for it in e["ex"])}')
    print(f'  Summe der Quadrate: {q_vor:.3f} → {q_nach:.3f}'
          + ('  (jedes Ziel exakt)' if gut else ''))
    if not gut:
        gesamt_gut = False
        print('  bleibt: ' + ', '.join(f'{LABEL.get(m, m)} {d:+.2f}'
                                       for d, m in nachher[:4] if abs(d) > 0.005))
        print('          ' + ('Suchraum vollständig abgesucht – es gibt hier keine exakte '
                              'Lösung mit zwei bis vier Sätzen.' if ganz else
                              'Suche am Knotenbudget abgebrochen.'))
    if schreiben:
        pfad(v).write_text(json.dumps(daten, ensure_ascii=False, indent=1) + '\n',
                           encoding='utf-8')
        print(f'  {pfad(v).relative_to(ROOT)} geschrieben')

print('\nAlle Varianten exakt.' if gesamt_gut
      else '\nNicht überall exakt – siehe oben. Die verbleibende Abweichung ist '
           'kleiner als vorher, aber nicht null.')
