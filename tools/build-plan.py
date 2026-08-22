#!/usr/bin/env python3
"""Verteilt die Übungen so auf die Trainingstage, dass jede Woche für sich
10 Sätze pro Muskelgruppe ergibt.

    python3 tools/build-plan.py             # schreibt tools/plan.json
    python3 tools/build-plan.py --report    # nur rechnen und zeigen
    python3 tools/build-plan.py --alle      # jede Übung in jeder Woche

Eine "Woche" sind hier drei aufeinanderfolgende Einheiten – der Plan aus der
Excel trainiert alle zwei bis drei Tage, drei Einheiten decken also gut sieben
Tage ab.

Warum das überhaupt gerechnet werden muss: die Übungen treffen die
Muskelgruppen nicht sauber getrennt, sondern anteilig. Ein Goblet Squat ist
voll Oberschenkel, gut zur Hälfte Gesäß, ein Drittel Bauch. Wer stur drei Sätze
je Übung verteilt, landet bei manchen Gruppen weit über und bei anderen weit
unter dem Ziel. Also wird die Satzzahl je Übung gesucht statt gesetzt.

Gerechnet wird in drei Schritten:

  1. Eine Woche.  Ganzzahlige Satzzahlen je Übung, so dass die größte
     Abweichung von 10 minimal wird. Weil ganze Sätze auf krumme Anteile
     treffen, ist 10,00 nicht erreichbar – rund 0,3 Sätze bleiben. Länger
     rechnen hilft nicht, mehr Kalender auch nicht: die Grenze steckt in der
     einen Woche.
  2. Viele verschiedene solche Wochen.  Von einem lokalen Optimum aus wird
     immer wieder angestoßen und neu abgestiegen; alles, was das Optimum
     trifft, landet im Vorrat. Daraus werden die Wochen des Plans so gewählt,
     dass sie sich möglichst stark unterscheiden.
  3. Aufteilung auf die drei Einheiten.  Jede Übung kommt ein- bis dreimal pro
     Woche vor, je zwei bis vier Sätze. Gesucht wird die Aufteilung, bei der
     alle drei Einheiten etwa gleich lang sind und keine zur reinen Beinstunde
     wird.

Die Anteile sind Schätzungen aus gängiger Trainingslehre, keine Messwerte: 1,0
heißt "dafür ist die Übung da", 0,5 "arbeitet spürbar mit". Wer sie anders
einschätzt, ändert exercise-meta.json und lässt neu rechnen.

Datum, Wiederholungen und das Bodyweight-Äquivalent kommen unverändert aus der
Excel – hier wird nur bestimmt, welche Übung mit wie vielen Sätzen an welchem
Tag steht.
"""

import itertools
import json
import pathlib
import random
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
META = ROOT / 'tools' / 'exercise-meta.json'
DATA = ROOT / 'js' / 'data.js'
OUT = ROOT / 'tools' / 'plan.json'

TARGET = 10.0            # Sätze je Muskelgruppe und Woche
WEEK = 3                 # Einheiten je Woche
PER_SET = (2, 4)         # Sätze je Auftritt einer Übung
PER_WEEK = 9             # Sätze je Übung und Woche
MAX_EX = 10              # Übungen je Einheit – mehr wird die Einheit zu kleinteilig
RESTARTS, KICKS = 40, 80  # Umfang der Suche nach Wochen
SPLITS = 900             # Versuche je Woche für die Aufteilung

LABEL = {
    'quads': 'Oberschenkel', 'hamstrings': 'Beinbeuger', 'glutes': 'Gesäß',
    'chest': 'Brust', 'lats': 'Rücken', 'delts': 'Schultern',
    'rearDelts': 'hint. Schulter', 'biceps': 'Bizeps', 'triceps': 'Trizeps',
    'abs': 'Bauch', 'calves': 'Waden', 'traps': 'Nacken',
}


def dates():
    """Trainingstage aus dem erzeugten Datensatz. Termine bleiben, wie sie sind."""
    src = DATA.read_text(encoding='utf-8')
    plan = json.loads(re.search(r'export const PLAN = ([\s\S]*?);\n?$', src).group(1))
    return [w['date'] for w in plan]


# ------------------------------------------------------------------ #
# Schritt 1 und 2: Satzzahlen je Übung für eine Woche
# ------------------------------------------------------------------ #

class Week:
    """Bewertet Satzzahlen einer Woche gegen das Ziel."""

    def __init__(self, shares, ids, groups, target, allowed):
        self.shares, self.ids, self.groups = shares, ids, groups
        self.target, self.allowed = target, allowed

    def volume(self, n):
        vol = dict.fromkeys(self.groups, 0.0)
        for ex, sets in zip(self.ids, n):
            if sets:
                for m, share in self.shares[ex].items():
                    vol[m] += sets * share
        return vol

    def score(self, n):
        """Erst die größte Abweichung klein halten, dann alle übrigen."""
        vol = self.volume(n)
        return (round(max(abs(vol[m] - self.target) for m in self.groups), 9),
                round(sum((vol[m] - self.target) ** 2 for m in self.groups), 9))

    def descend(self, n, rnd):
        """Bergab, solange ein einzelner Satz oder ein Tausch etwas bringt."""
        n = list(n)
        base = self.score(n)
        idx = list(range(len(self.ids)))
        moving = True
        while moving:
            moving = False
            rnd.shuffle(idx)
            for i in idx:                       # einen Satz mehr oder weniger
                for d in (-1, 1):
                    if n[i] + d not in self.allowed:
                        continue
                    n[i] += d
                    got = self.score(n)
                    if got < base:
                        base, moving = got, True
                        break
                    n[i] -= d
                if moving:
                    break
            if moving:
                continue
            pairs = list(itertools.permutations(idx, 2))
            rnd.shuffle(pairs)
            for i, j in pairs:                  # einen Satz umhängen
                if n[i] - 1 not in self.allowed or n[j] + 1 not in self.allowed:
                    continue
                n[i] -= 1
                n[j] += 1
                got = self.score(n)
                if got < base:
                    base, moving = got, True
                    break
                n[i] += 1
                n[j] -= 1
        return n, base

    def pool(self, restarts, kicks):
        """Vorrat verschiedener Wochen, die das Optimum treffen."""
        found = {}
        for seed in range(restarts):
            rnd = random.Random(seed)
            cur, sc = self.descend([rnd.choice(self.allowed) for _ in self.ids], rnd)
            for _ in range(kicks):
                found.setdefault(tuple(cur), sc)
                kick = list(cur)
                for _ in range(rnd.randint(2, 4)):
                    kick[rnd.randrange(len(self.ids))] = rnd.choice(self.allowed)
                new, ns = self.descend(kick, rnd)
                found.setdefault(tuple(new), ns)
                # auch mal schlechter weiterlaufen, sonst bleibt die Suche kleben
                if ns <= sc or rnd.random() < 0.3:
                    cur, sc = new, ns
        best = min(found.values())
        return [n for n, sc in found.items() if sc[0] <= best[0] + 1e-9], best


def spread(pool, count, rnd):
    """`count` Wochen aus dem Vorrat, die möglichst weit auseinanderliegen."""
    def dist(a, b):
        return sum(abs(x - y) for x, y in zip(a, b))

    chosen = [max(pool, key=lambda n: (sum(n), n))]
    while len(chosen) < count:
        rest = [n for n in pool if n not in chosen]
        if not rest:
            chosen += rnd.sample(pool, min(count - len(chosen), len(pool)))
            continue
        chosen.append(max(rest, key=lambda n: min(dist(n, c) for c in chosen)))
    rnd.shuffle(chosen)
    return chosen[:count]


# ------------------------------------------------------------------ #
# Schritt 3: eine Woche auf ihre Einheiten aufteilen
# ------------------------------------------------------------------ #

def chunks(sets, rnd, sessions):
    """Sätze einer Übung auf ein bis drei Auftritte à 2–4 Sätze verteilen."""
    lo, hi = PER_SET
    options = []
    for parts in range(1, sessions + 1):
        for combo in itertools.combinations_with_replacement(range(lo, hi + 1), parts):
            if sum(combo) == sets:
                options.append(list(combo))
    if not options:
        return None
    pick = list(rnd.choice(options))
    rnd.shuffle(pick)
    return pick


def split(week, ids, shares, groups, sessions, rnd, tries, used):
    """Aufteilung mit möglichst gleich langen und gleich gemischten Einheiten.

    `used` sind die bereits vergebenen Zusammenstellungen; eine Wiederholung
    wiegt schwerer als jede Unwucht, sonst gleichen sich zwei Wochen an.
    """
    target_sets = sum(week) / sessions
    target_vol = {m: sum(week[k] * shares[ids[k]].get(m, 0) for k in range(len(ids))) / sessions
                  for m in groups}
    best = None
    for _ in range(tries):
        day = [[] for _ in range(sessions)]
        ok = True
        for k in sorted(range(len(ids)), key=lambda x: -week[x]):
            if not week[k]:
                continue
            part = chunks(week[k], rnd, sessions)
            if part is None:
                ok = False
                break
            free = sorted(range(sessions), key=lambda s: (len(day[s]), sum(x[1] for x in day[s]), rnd.random()))
            for slot, sets in zip(free, part):
                day[slot].append((ids[k], sets))
        if not ok:
            continue
        load = [sum(s for _, s in d) for d in day]
        imbalance = max(abs(x - target_sets) for x in load)
        mix = 0.0
        for s, d in enumerate(day):
            vol = dict.fromkeys(groups, 0.0)
            for ex, sets in d:
                for m, share in shares[ex].items():
                    vol[m] += sets * share
            mix += sum((vol[m] - target_vol[m]) ** 2 for m in groups)
        count = max(len(d) for d in day) - min(len(d) for d in day)
        shape = [frozenset(ex for ex, _ in d) for d in day]
        doppelt = sum(1 for s in shape if s in used) + (len(set(shape)) < len(shape))
        zuviel = sum(max(0, len(d) - MAX_EX) for d in day)
        got = (doppelt, zuviel, imbalance, count, round(mix, 6))
        if best is None or got < best[0]:
            best = (got, day)
    if best is None:
        sys.exit('Keine Aufteilung gefunden – PER_SET/PER_WEEK prüfen.')
    used.update(frozenset(ex for ex, _ in d) for d in best[1])
    return best[1]


# ------------------------------------------------------------------ #

def main():
    meta = json.loads(META.read_text(encoding='utf-8'))
    shares = {k: v['dbShares'] for k, v in meta.items()}
    ids = list(shares)
    groups = sorted({m for sh in shares.values() for m in sh})
    # Reihenfolge in der Einheit: erst die großen Übungen, Isolation zum Schluss
    weight = {i: sum(shares[i].values()) for i in ids}

    day = dates()
    blocks = [list(range(k, min(k + WEEK, len(day)))) for k in range(0, len(day), WEEK)]

    alle = '--alle' in sys.argv
    allowed = list(range(2, PER_WEEK + 1)) if alle else [0] + list(range(2, PER_WEEK + 1))

    rnd = random.Random(7)
    solver = Week(shares, ids, groups, TARGET, allowed)
    pool, best = solver.pool(RESTARTS, KICKS)
    print(f'{len(pool)} verschiedene Wochen mit Abweichung {best[0]:.2f}')

    # Kurze Restwoche am Planende: Ziel anteilig, sonst dieselbe Rechnung.
    picks = spread(pool, len(blocks), rnd)
    weeks = []
    for block, pick in zip(blocks, picks):
        if len(block) == WEEK:
            weeks.append(pick)
            continue
        short = Week(shares, ids, groups, TARGET * len(block) / WEEK, allowed)
        start = [min(allowed, key=lambda a, x=x: abs(a - x * len(block) / WEEK)) for x in pick]
        weeks.append(short.descend(start, rnd)[0])

    plan = []
    used = set()
    for block, week in zip(blocks, weeks):
        for slot, sess in zip(block, split(week, ids, shares, groups, len(block), rnd, SPLITS, used)):
            sess.sort(key=lambda x: -weight[x[0]])
            plan.append({'date': day[slot], 'ex': [{'id': e, 'sets': s} for e, s in sess]})

    # ---- Bericht ----
    vols = []
    for week in weeks[:len(blocks)]:
        vol = solver.volume(week)
        vols.append(vol)
    full = [v for v, b in zip(vols, blocks) if len(b) == WEEK]
    print(f'{len(day)} Einheiten in {len(blocks)} Wochen, '
          f'{sum(sum(w) for w in weeks)} Sätze insgesamt')
    uniq = len({frozenset(e['id'] for e in s['ex']) for s in plan})
    print(f'{uniq} von {len(plan)} Einheiten verschieden, '
          f'{min(len(s["ex"]) for s in plan)}–{max(len(s["ex"]) for s in plan)} Übungen je Einheit, '
          f'{min(sum(e["sets"] for e in s["ex"]) for s in plan)}–'
          f'{max(sum(e["sets"] for e in s["ex"]) for s in plan)} Sätze je Einheit\n')

    print(f'{"Muskelgruppe":16s} {"min":>6s} {"max":>6s}   Ziel {TARGET:.0f} je Woche')
    for m in sorted(groups, key=lambda x: LABEL.get(x, x)):
        lo = min(v[m] for v in full)
        hi = max(v[m] for v in full)
        print(f'{LABEL.get(m, m):16s} {lo:6.2f} {hi:6.2f}')
    print(f'\ngrößte Abweichung in einer Woche: {best[0]:.2f} Sätze')

    seen = {i: sum(1 for w in weeks if w[ids.index(i)]) for i in ids}
    fehlt = [i for i in ids if not seen[i]]
    if fehlt:
        print('kommt im Plan nicht vor: ' + ', '.join(fehlt)
              + '\n  (mit --alle erzwingen – kostet Genauigkeit)')

    if '--report' in sys.argv:
        return
    OUT.write_text(json.dumps(plan, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    print(f'\n{OUT.relative_to(ROOT)} geschrieben')


if __name__ == '__main__':
    main()
