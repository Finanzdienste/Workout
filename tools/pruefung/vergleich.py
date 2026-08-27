#!/usr/bin/env python3
"""Zwei Varianten nebeneinander – und was der Bodyweight-Modus daraus macht."""
import collections
import datetime
import json
import pathlib
import statistics
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
META = json.load(open(ROOT / 'tools' / 'exercise-meta.json'))
NAMEN = {
    'chest': 'Brust', 'lats': 'Rücken', 'sideDelts': 'Schulter seitl.',
    'rearDelts': 'Schulter hint.', 'frontDelts': 'Schulter vorn', 'traps': 'Nacken',
    'biceps': 'Bizeps', 'triceps': 'Trizeps', 'abs': 'Bauch', 'glutes': 'Gesäß',
    'quads': 'Oberschenkel', 'hamstringsHip': 'Beinb. Hüfte',
    'hamstringsKnee': 'Beinb. Knie', 'calves': 'Waden',
}


def lies(var):
    p = ROOT / 'tools' / ('plan.json' if var == 'standard' else f'plan-{var}.json')
    return json.load(open(p))


def werte(P, mode):
    """Schnitt, Spanne, direkte Frequenz und Abstände je Gruppe."""
    plan, WEEK = P['plan'], 4
    sh = f'{mode}Shares'
    wochen = [plan[i:i + WEEK] for i in range(0, len(plan), WEEK)]
    pro, freq = collections.defaultdict(list), collections.defaultdict(list)
    for w in wochen:
        summe, tage = collections.Counter(), collections.defaultdict(set)
        for t, e in enumerate(w):
            for it in e['ex']:
                for m, a in META[it['id']].get(sh, {}).items():
                    summe[m] += it['sets'] * a
                    if a >= 0.5:
                        tage[m].add(t)
        for m in NAMEN:
            pro[m].append(summe[m])
            freq[m].append(len(tage[m]))
    luecke = {}
    for m in NAMEN:
        tage = [datetime.date.fromisoformat(e['date']) for e in plan
                if any(META[it['id']].get(sh, {}).get(m, 0) >= 0.5 for it in e['ex'])]
        luecke[m] = max((b - a).days for a, b in zip(tage, tage[1:])) if len(tage) > 1 else None
    return pro, freq, luecke


def zeige(var):
    P = lies(var)
    plan = P['plan']
    pro, freq, luecke = werte(P, 'db')
    probw, _, _ = werte(P, 'bw')
    saetze = [sum(it['sets'] for it in e['ex']) for e in plan]
    wochen = [sum(sum(it['sets'] for it in e['ex']) for e in plan[i:i + 4])
              for i in range(0, len(plan), 4)]
    print(f'=== {var} · "{P.get("name", var)}" · {len(plan)} Einheiten')
    print(f'    {min(saetze)}–{max(saetze)} Sätze je Einheit (Ø {statistics.mean(saetze):.1f}), '
          f'{statistics.mean(wochen):.0f} je Woche')
    print(f'    {"Gruppe":<17}{"Ziel":>5}{"Ø db":>7}{"Ø bw":>7}{"bw−Ziel":>9}{"Freq":>6}{"Lücke":>7}')
    for m in NAMEN:
        z = P['target'].get(m)
        zt = f'{z:g}' if z is not None and m not in P['derived'] else '–'
        d, b = statistics.mean(pro[m]), statistics.mean(probw[m])
        ab = b - z if (z is not None and m not in P['derived']) else None
        print(f'    {NAMEN[m]:<17}{zt:>5}{d:>7.2f}{b:>7.2f}'
              f'{("%+.2f" % ab) if ab is not None else "–":>9}'
              f'{statistics.mean(freq[m]):>6.1f}{(luecke[m] if luecke[m] is not None else "–"):>7}')
    # Fällt eine Übung ganz heraus?
    drin = collections.Counter(it['id'] for e in plan for it in e['ex'])
    fehlt = [i for i in META if i not in drin]
    print(f'    Übungen im Plan: {len(drin)} von {len(META)}'
          + (f' – fehlt: {", ".join(fehlt)}' if fehlt else ''))
    fehler = sum((statistics.mean(probw[m]) - P['target'][m]) ** 2
                 for m in NAMEN if P['target'].get(m) is not None and m not in P['derived'])
    print(f'    Bodyweight-Fehler (Summe der Quadrate): {fehler:.3f}\n')


for v in sys.argv[1:] or ['standard']:
    zeige(v)
