#!/usr/bin/env python3
"""Nachrechnen, was im ausgelieferten Plan tatsächlich steht.

Nicht was der Generator anstrebt, sondern was in tools/plan*.json gelandet ist:
Sätze je Muskel und Woche, direkte Sätze, Frequenz, Abstände, Einheitslänge.
"""
import collections
import datetime
import json
import pathlib
import statistics
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
META = json.load(open(ROOT / 'tools' / 'exercise-meta.json'))

VAR = sys.argv[1] if len(sys.argv) > 1 else 'standard'
MODE = sys.argv[2] if len(sys.argv) > 2 else 'db'
PFAD = ROOT / 'tools' / ('plan.json' if VAR == 'standard' else f'plan-{VAR}.json')
P = json.load(open(PFAD))
PLAN, TARGET, CAP = P['plan'], P['target'], P['cap']
WEEK = 4
SHARE = f'{MODE}Shares'

GRUPPEN = sorted({m for e in META.values() for m in e.get(SHARE, {})})
NAMEN = {
    'chest': 'Brust', 'lats': 'Rücken', 'sideDelts': 'Schulter seitlich',
    'rearDelts': 'Schulter hinten', 'frontDelts': 'Schulter vorn', 'traps': 'Nacken',
    'biceps': 'Bizeps', 'triceps': 'Trizeps', 'abs': 'Bauch', 'glutes': 'Gesäß',
    'quads': 'Oberschenkel vorn', 'hamstringsHip': 'Beinbeuger (Hüfte)',
    'hamstringsKnee': 'Beinbeuger (Knie)', 'calves': 'Waden',
}

print(f'=== {VAR} / {MODE} · {len(PLAN)} Einheiten, {len(PLAN)//WEEK} Wochen à {WEEK} ===\n')

# --- 1. Sätze je Muskel und Woche -----------------------------------------
wochen = [PLAN[i:i + WEEK] for i in range(0, len(PLAN), WEEK)]
proWoche = {m: [] for m in GRUPPEN}
direktProWoche = {m: [] for m in GRUPPEN}
freqProWoche = {m: [] for m in GRUPPEN}
for w in wochen:
    summe = collections.Counter()
    direkt = collections.Counter()
    tage = collections.defaultdict(set)
    for tag, e in enumerate(w):
        for it in e['ex']:
            for m, anteil in META[it['id']].get(SHARE, {}).items():
                summe[m] += it['sets'] * anteil
                if anteil >= 0.5:
                    direkt[m] += it['sets']
                    tage[m].add(tag)
    for m in GRUPPEN:
        proWoche[m].append(round(summe[m], 3))
        direktProWoche[m].append(direkt[m])
        freqProWoche[m].append(len(tage[m]))

print(f'{"Gruppe":<22}{"Ziel":>6}{"Ø":>7}{"min":>6}{"max":>6}{"direkt Ø":>10}{"Freq Ø":>8}  Bewertung')
print('-' * 92)
befunde = []
for m in GRUPPEN:
    ziel = TARGET.get(m)
    v = proWoche[m]
    d = statistics.mean(direktProWoche[m])
    f = statistics.mean(freqProWoche[m])
    mittel = statistics.mean(v)
    zs = f'{ziel:.0f}' if isinstance(ziel, (int, float)) else '–'
    hinweis = ''
    if ziel is not None and abs(mittel - ziel) > 0.05:
        hinweis += f'Ø verfehlt ({mittel - ziel:+.2f}) '
    if max(v) > CAP + 0.001:
        hinweis += f'über CAP in einer Woche ({max(v):.1f}>{CAP}) '
    if f < 1.99 and mittel >= 6:
        hinweis += f'nur {f:.1f}x/Woche '
    if hinweis:
        befunde.append((NAMEN.get(m, m), hinweis.strip()))
    print(f'{NAMEN.get(m, m):<22}{zs:>6}{mittel:>7.2f}{min(v):>6.1f}{max(v):>6.1f}{d:>10.1f}{f:>8.2f}  {hinweis}')

# --- 2. Abstände zwischen direkten Reizen ---------------------------------
print('\n--- Abstand zwischen zwei direkten Reizen derselben Gruppe (Tage) ---')
print(f'{"Gruppe":<22}{"min":>5}{"max":>5}{"Ø":>7}   Verteilung')
tage_von = {}
for m in GRUPPEN:
    tage = []
    for e in PLAN:
        if any(META[it['id']].get(SHARE, {}).get(m, 0) >= 0.5 for it in e['ex']):
            tage.append(datetime.date.fromisoformat(e['date']))
    tage_von[m] = tage
    if len(tage) < 2:
        print(f'{NAMEN.get(m, m):<22}  – nur {len(tage)} Auftritte')
        continue
    ab = [(b - a).days for a, b in zip(tage, tage[1:])]
    vert = collections.Counter(ab)
    zeile = ' '.join(f'{k}d×{v}' for k, v in sorted(vert.items()))
    warn = '  ⚠ <48h' if min(ab) < 2 else ''
    print(f'{NAMEN.get(m, m):<22}{min(ab):>5}{max(ab):>5}{statistics.mean(ab):>7.1f}   {zeile}{warn}')

# --- 3. Einheiten ----------------------------------------------------------
print('\n--- Einheiten ---')
laengen = [sum(it['sets'] for it in e['ex']) for e in PLAN]
uebungen = [len(e['ex']) for e in PLAN]
print(f'Sätze je Einheit: {min(laengen)}–{max(laengen)} (Ø {statistics.mean(laengen):.1f}) · '
      f'Übungen: {min(uebungen)}–{max(uebungen)} (Ø {statistics.mean(uebungen):.1f})')
print(f'Sätze je Woche gesamt: {min(sum(sum(it["sets"] for it in e["ex"]) for e in w) for w in wochen)}'
      f'–{max(sum(sum(it["sets"] for it in e["ex"]) for e in w) for w in wochen)}')

# --- 4. Wie oft kommt jede Übung vor --------------------------------------
print('\n--- Übungen im Plan ---')
zaehl = collections.Counter()
for e in PLAN:
    for it in e['ex']:
        zaehl[it['id']] += it['sets']
print(f'{"Übung":<34}{"Sätze ges.":>11}{"Ø/Woche":>9}{"Auftritte":>11}')
auftritte = collections.Counter(it['id'] for e in PLAN for it in e['ex'])
for i, n in zaehl.most_common():
    print(f'{i:<34}{n:>11}{n / len(wochen):>9.2f}{auftritte[i]:>11}')
fehlend = [i for i in META if i not in zaehl]
if fehlend:
    print('nicht im Plan:', ', '.join(fehlend))

if befunde:
    print('\n--- Auffällig ---')
    for name, h in befunde:
        print(f'  {name}: {h}')
