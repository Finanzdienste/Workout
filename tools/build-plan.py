#!/usr/bin/env python3
"""Verteilt die Übungen so auf die Trainingstage, dass jede Muskelgruppe über
den ganzen Plan im Schnitt exakt 10 Sätze pro Woche bekommt.

    python3 tools/build-plan.py             # schreibt tools/plan.json
    python3 tools/build-plan.py --report    # nur rechnen und zeigen

Eine "Woche" sind hier drei aufeinanderfolgende Einheiten – der Plan aus der
Excel trainiert alle zwei bis drei Tage, drei Einheiten decken also gut sieben
Tage ab.

Warum das überhaupt gerechnet werden muss: die Übungen treffen die
Muskelgruppen nicht sauber getrennt, sondern anteilig. Ein Goblet Squat ist
voll Oberschenkel, gut zur Hälfte Gesäß, ein Drittel Bauch. Wer stur drei Sätze
je Übung verteilt, landet bei manchen Gruppen weit über und bei anderen weit
unter dem Ziel. Also wird die Satzzahl je Übung gesucht statt gesetzt.

**Die Zahl der Wochen muss gerade sein.** Sonst ist "exakt 10" nicht knapp
verfehlt, sondern grundsätzlich unerreichbar. Der Rücken kommt nur aus Rudern
und Chin-ups, beide mit Anteil 1,0 – seine Plansumme ist also eine ganze Zahl
und trifft 10·W genau. Die hintere Schulter hängt an denselben zwei Übungen
(0,35 und 0,15) plus Reverse Fly:

    hintere Schulter = 1,5·W + 0,2·Rudern + ReverseFly

Für 10·W bräuchte es ReverseFly = 8,5·W − 0,2·Rudern. Bei ungeradem W endet
8,5·W auf ,5, und 0,2·Rudern kann nur auf ,0 ,2 ,4 ,6 oder ,8 enden – das geht
nie auf. Bei geradem W schon, sobald Rudern durch 20 teilbar ist. Der Kalender
wird deshalb nötigenfalls um ein paar Einheiten verlängert; die Zusatztermine
setzen den Rhythmus der Excel fort.

Gerechnet wird in drei Schritten:

  1. Plansummen.  Wie viele Sätze bekommt jede Übung über den ganzen Plan?
     Gesucht wird eine Lösung, die alle zwölf Gleichungen exakt trifft – von
     vielen gefundenen die ausgewogenste, damit keine Übung fast verschwindet.
  2. Verteilung auf die Wochen.  Die Summen stehen fest; verschoben werden nur
     einzelne Sätze zwischen Wochen. Der Schnitt bleibt dabei zwangsläufig
     exakt, und gesucht wird die Verteilung, bei der die schlechteste einzelne
     Woche am nächsten an der 10 liegt.
  3. Aufteilung auf die drei Einheiten.  Jede Übung kommt ein- bis dreimal pro
     Woche vor, je zwei bis vier Sätze; alle drei Einheiten etwa gleich lang.

Die Anteile sind Schätzungen aus gängiger Trainingslehre, keine Messwerte: 1,0
heißt "dafür ist die Übung da", 0,5 "arbeitet spürbar mit". Wer sie anders
einschätzt, ändert exercise-meta.json und lässt neu rechnen.

Namen, Wiederholungen und das Bodyweight-Äquivalent kommen unverändert aus der
Excel – hier wird nur bestimmt, welche Übung mit wie vielen Sätzen an welchem
Tag steht.
"""

import datetime
import itertools
import json
import math
import pathlib
import random
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
META = ROOT / 'tools' / 'exercise-meta.json'
DATA = ROOT / 'js' / 'data.js'
OUT = ROOT / 'tools' / 'plan.json'

TARGET = 10              # Sätze je Muskelgruppe und Woche
WEEK = 3                 # Einheiten je Woche
PER_SET = (2, 4)         # Sätze je Auftritt einer Übung
PER_WEEK = 10            # Sätze je Übung und Woche
MAX_EX = 10              # Übungen je Einheit – mehr wird zu kleinteilig
EXACT_LIMIT = 4000       # so viele Plansummen je Block reichen zur Auswahl
RESTARTS = 24            # Anläufe beim Verteilen auf die Wochen
SPREAD_ROUNDS = 600000   # Schritte je Anlauf
SPLITS = 900             # Versuche je Woche für die Aufteilung

# Gerechnet wird durchweg in Zwanzigsteln eines Satzes: alle Anteile in
# exercise-meta.json sind Vielfache von 0,05, damit bleibt alles ganzzahlig und
# "exakt" heißt wirklich exakt und nicht "bis auf Rundungsfehler".
UNIT = 20
GOAL = TARGET * UNIT

LABEL = {
    'quads': 'Oberschenkel', 'hamstrings': 'Beinbeuger', 'glutes': 'Gesäß',
    'chest': 'Brust', 'lats': 'Rücken', 'delts': 'Schultern',
    'rearDelts': 'hint. Schulter', 'biceps': 'Bizeps', 'triceps': 'Trizeps',
    'abs': 'Bauch', 'calves': 'Waden', 'traps': 'Nacken',
}


# ------------------------------------------------------------------ #
# Termine
# ------------------------------------------------------------------ #

def dates():
    src = DATA.read_text(encoding='utf-8')
    plan = json.loads(re.search(r'export const PLAN = ([\s\S]*?);\n?$', src).group(1))
    return [datetime.date.fromisoformat(w['date']) for w in plan]


def extend(day, want):
    """Termine bis `want` Einheiten fortschreiben, im Rhythmus der Excel.

    Die Abstände wiederholen sich; die Periode wird gesucht und fortgesetzt,
    damit die Zusatztage nicht aus der Reihe fallen.
    """
    if want <= len(day):
        return day[:want]
    gap = [(day[i + 1] - day[i]).days for i in range(len(day) - 1)]
    period = next((p for p in range(1, len(gap) // 3 + 1)
                   if all(gap[-1 - i] == gap[-1 - i - p]
                          for i in range(min(len(gap) - p, 3 * p)))), None)
    day = list(day)
    while len(day) < want:
        step = gap[len(day) - 1 - period] if period else (2 if len(day) % 2 else 3)
        gap.append(step)
        day.append(day[-1] + datetime.timedelta(days=step))
    return day


# ------------------------------------------------------------------ #
# Volumen
# ------------------------------------------------------------------ #

class Volume:
    """Rechnet Satzzahlen in Muskelvolumen um – in Zwanzigsteln."""

    def __init__(self, shares, ids, groups):
        self.ids, self.groups = ids, groups
        self.s = [[round(shares[i].get(m, 0) * UNIT) for m in groups] for i in ids]

    def of(self, n):
        out = [0] * len(self.groups)
        for c, row in zip(n, self.s):
            if c:
                for g, v in enumerate(row):
                    if v:
                        out[g] += c * v
        return out

    def off(self, n, goal):
        """Größte und quadratische Abweichung vom Ziel."""
        v = self.of(n)
        return (max(abs(x - goal) for x in v), sum((x - goal) ** 2 for x in v))


# ------------------------------------------------------------------ #
# Schritt 1: Plansummen, die exakt aufgehen
# ------------------------------------------------------------------ #

def parts(ids, shares, groups):
    """Übungen, die über eine Muskelgruppe zusammenhängen, gehören zusammen.

    Der Unterkörper teilt keine Gruppe mit dem Oberkörper und die Waden mit
    niemandem. Getrennt gerechnet zerfällt die Suche in drei kleine Probleme
    statt eines großen – das ist der Unterschied zwischen Sekunden und Stunden.
    """
    root = {i: i for i in ids}

    def find(x):
        while root[x] != x:
            root[x] = root[root[x]]
            x = root[x]
        return x

    for m in groups:
        hit = [i for i in ids if shares[i].get(m)]
        for i in hit[1:]:
            root[find(i)] = find(hit[0])
    out = {}
    for i in ids:
        out.setdefault(find(i), []).append(i)
    return list(out.values())


def exact(block, shares, weeks, values, limit, rnd):
    """Alle Satzzahlen eines Blocks, die jede seiner Gruppen exakt treffen.

    Tiefensuche mit zwei Abkürzungen. Steht in einer Gleichung nur noch eine
    Übung offen, ist ihr Wert bestimmt – passt er nicht, ist der Ast tot.
    Stehen mehrere offen, muss der Rest durch den größten gemeinsamen Teiler
    ihrer Anteile teilbar sein; das schneidet den Baum früh ab, lange bevor
    unten etwas nicht aufginge.
    """
    goal = GOAL * weeks
    groups = sorted({m for i in block for m in shares[i]})
    eqs = [[(i, round(shares[i][m] * UNIT)) for i in block if shares[i].get(m)]
           for m in groups]
    allowed = set(values)
    out = []

    def rec(val):
        while True:
            again = False
            for eq in eqs:
                rest, open_ = goal, []
                for i, c in eq:
                    if i in val:
                        rest -= c * val[i]
                    else:
                        open_.append((i, c))
                if not open_:
                    if rest:
                        return
                    continue
                if len(open_) == 1:
                    i, c = open_[0]
                    if rest % c or rest // c not in allowed:
                        return
                    val[i] = rest // c
                    again = True
                    continue
                g = math.gcd(*[c for _, c in open_])
                if rest % g or rest < 0 or rest > sum(c for _, c in open_) * max(values):
                    return
            if not again:
                break
        rest_ex = [i for i in block if i not in val]
        if not rest_ex:
            out.append(dict(val))
            return
        tight = min((eq for eq in eqs if sum(1 for i, _ in eq if i not in val) > 1),
                    key=lambda eq: sum(1 for i, _ in eq if i not in val), default=None)
        pick = next(i for i, _ in tight if i not in val) if tight else rest_ex[0]
        order = list(values)
        rnd.shuffle(order)
        for v in order:
            if len(out) >= limit:
                return
            rec({**val, pick: v})

    rec({})
    return out


def totals(ids, shares, groups, weeks, rnd):
    """Sätze je Übung über den ganzen Plan, exakt 10·W für jede Gruppe.

    Von allen Lösungen gewinnt die ausgewogenste: erst keine Übung, die ganz
    herausfällt, dann die geringste Streuung – sonst bekäme eine Übung 9 Sätze
    pro Woche und die nächste zwei im ganzen Plan.
    """
    values = [0] + list(range(2, PER_WEEK * weeks + 1))
    total, variants = {}, []
    for block in parts(ids, shares, groups):
        found = exact(block, shares, weeks, values, EXACT_LIMIT, rnd)
        if not found:
            sys.exit(f'Keine exakte Lösung für {weeks} Wochen – Wochenzahl gerade?')
        variants.append(len(found))

        def balance(sol):
            mean = sum(sol.values()) / len(sol)
            return (min(sol.values()) == 0,
                    sum((v - mean) ** 2 for v in sol.values()),
                    sorted(sol.items()))

        total.update(min(found, key=balance))
    return [total[i] for i in ids], variants


# ------------------------------------------------------------------ #
# Schritt 2: Plansummen auf die Wochen verteilen
# ------------------------------------------------------------------ #

def start(total, weeks, rnd):
    """Erste Verteilung: jede Übung über so viele Wochen wie sinnvoll."""
    lo, hi = PER_SET[0], PER_WEEK
    rows = []
    for t in total:
        row = [0] * weeks
        if t:
            k = max(-(-t // hi), 1)                  # so viele Wochen mindestens
            k = max(k, min(weeks, round(t / 4)))
            k = min(k, t // lo, weeks)
            base, extra = divmod(t, k)
            for j, w in enumerate(sorted(rnd.sample(range(weeks), k))):
                row[w] = base + (1 if j < extra else 0)
        rows.append(row)
    return rows


def spread(total, vol, weeks, rnd, restarts, rounds):
    """Plansummen auf die Wochen verteilen.

    Verschoben werden nur Sätze zwischen Wochen – die Plansummen bleiben
    unberührt, der Schnitt also zwangsläufig exakt. Gesucht wird die
    Verteilung, bei der die schlechteste einzelne Woche am nächsten an der 10
    liegt.
    """
    lo, hi = PER_SET[0], PER_WEEK
    rows_s = vol.s

    def fits(v):
        return v == 0 or lo <= v <= hi

    best = None
    for run in range(restarts):
        rows = start(total, weeks, rnd)
        vols = [[sum(rows[i][w] * rows_s[i][g] for i in range(len(rows)))
                 for g in range(len(vol.groups))] for w in range(weeks)]
        sq = [sum((x - GOAL) ** 2 for x in v) for v in vols]
        energy = sum(sq)
        temp = 400.0
        for step in range(rounds):
            temp *= 0.99995
            i = rnd.randrange(len(rows))
            u, v = rnd.randrange(weeks), rnd.randrange(weeks)
            if u == v or not rows[i][u]:
                continue
            d = rnd.choice((1, 2, rows[i][u] - rows[i][v]))
            if d <= 0 or not fits(rows[i][u] - d) or not fits(rows[i][v] + d):
                continue
            share = rows_s[i]
            su = sv = 0
            for g, c in enumerate(share):
                if c:
                    vols[u][g] -= d * c
                    vols[v][g] += d * c
            for g in range(len(share)):
                su += (vols[u][g] - GOAL) ** 2
                sv += (vols[v][g] - GOAL) ** 2
            delta = su + sv - sq[u] - sq[v]
            if delta <= 0 or rnd.random() < pow(2.718, -delta / max(temp, 1e-9)):
                rows[i][u] -= d
                rows[i][v] += d
                sq[u], sq[v] = su, sv
                energy += delta
            else:
                for g, c in enumerate(share):
                    if c:
                        vols[u][g] += d * c
                        vols[v][g] -= d * c
        # Nachschliff: jetzt zählt nur noch die schlechteste Woche, nicht mehr
        # die Summe – dafür ist das Ausglühen zu grob.
        moving = True
        while moving:
            moving = False
            dev = [max(abs(x - GOAL) for x in v) for v in vols]
            # Nicht nur die schlechteste Woche zählt: absteigend sortiert
            # vergleichen drückt auch die zweit- und drittschlechteste.
            cur = (sorted(dev, reverse=True), sum(sq))
            for i in range(len(rows)):
                for u in range(weeks):
                    for v in range(weeks):
                        if u == v or not rows[i][u]:
                            continue
                        for d in (1, 2, rows[i][u] - rows[i][v]):
                            if d <= 0 or not fits(rows[i][u] - d) or not fits(rows[i][v] + d):
                                continue
                            for g, c in enumerate(rows_s[i]):
                                if c:
                                    vols[u][g] -= d * c
                                    vols[v][g] += d * c
                            su = sum((x - GOAL) ** 2 for x in vols[u])
                            sv = sum((x - GOAL) ** 2 for x in vols[v])
                            dev[u] = max(abs(x - GOAL) for x in vols[u])
                            dev[v] = max(abs(x - GOAL) for x in vols[v])
                            got = (sorted(dev, reverse=True),
                                   sum(sq) - sq[u] - sq[v] + su + sv)
                            if got < cur:
                                rows[i][u] -= d
                                rows[i][v] += d
                                sq[u], sq[v] = su, sv
                                cur, moving = got, True
                                break
                            for g, c in enumerate(rows_s[i]):
                                if c:
                                    vols[u][g] += d * c
                                    vols[v][g] -= d * c
                            dev[u] = max(abs(x - GOAL) for x in vols[u])
                            dev[v] = max(abs(x - GOAL) for x in vols[v])
                        if moving:
                            break
                    if moving:
                        break
                if moving:
                    break
        per_week = [[row[w] for row in rows] for w in range(weeks)]
        got = (max(max(abs(x - GOAL) for x in v) for v in vols), sum(sq))
        if best is None or got < best[0]:
            best = (got, per_week)
    return best[1], best[0]


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
            free = sorted(range(sessions),
                          key=lambda s: (len(day[s]), sum(x[1] for x in day[s]), rnd.random()))
            for slot, sets in zip(free, part):
                day[slot].append((ids[k], sets))
        if not ok:
            continue
        load = [sum(s for _, s in d) for d in day]
        imbalance = max(abs(x - target_sets) for x in load)
        mix = 0.0
        for d in day:
            v = dict.fromkeys(groups, 0.0)
            for ex, sets in d:
                for m, share in shares[ex].items():
                    v[m] += sets * share
            mix += sum((v[m] - target_vol[m]) ** 2 for m in groups)
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
    weight = {i: sum(shares[i].values()) for i in ids}   # große Übungen zuerst

    day = dates()
    weeks = -(-len(day) // WEEK)
    weeks += weeks % 2                                   # exakt geht nur geradzahlig
    day = extend(day, weeks * WEEK)

    rnd = random.Random(7)
    vol = Volume(shares, ids, groups)

    total, variants = totals(ids, shares, groups, weeks, rnd)
    print(f'exakte Plansummen: {"·".join(map(str, variants))} Lösungen je Block, '
          f'ausgewogenste gewählt ({min(total)}–{max(total)} Sätze je Übung)')

    per_week, (worst, _) = spread(total, vol, weeks, rnd, RESTARTS, SPREAD_ROUNDS)
    print(f'auf {weeks} Wochen verteilt, schlechteste Woche {worst / UNIT:.2f} Sätze daneben')

    plan = []
    used = set()
    for k, w in enumerate(per_week):
        block = day[k * WEEK:(k + 1) * WEEK]
        for d, sess in zip(block, split(w, ids, shares, groups, WEEK, rnd, SPLITS, used)):
            sess.sort(key=lambda x: -weight[x[0]])
            plan.append({'date': d.isoformat(), 'ex': [{'id': e, 'sets': s} for e, s in sess]})

    # ---- Bericht ----
    got = [vol.of(w) for w in per_week]
    print(f'{len(plan)} Einheiten in {weeks} Wochen ({day[0]} bis {day[-1]}), '
          f'{sum(total)} Sätze insgesamt')
    uniq = len({frozenset(e['id'] for e in s['ex']) for s in plan})
    print(f'{uniq} von {len(plan)} Einheiten verschieden, '
          f'{min(len(s["ex"]) for s in plan)}–{max(len(s["ex"]) for s in plan)} Übungen je Einheit, '
          f'{min(sum(e["sets"] for e in s["ex"]) for s in plan)}–'
          f'{max(sum(e["sets"] for e in s["ex"]) for s in plan)} Sätze je Einheit\n')

    print(f'{"Muskelgruppe":16s} {"Schnitt":>9s} {"min":>6s} {"max":>6s}')
    for g, m in enumerate(groups):
        col = [v[g] / UNIT for v in got]
        print(f'{LABEL.get(m, m):16s} {sum(col) / weeks:9.4f} {min(col):6.2f} {max(col):6.2f}')
    if any(sum(v[g] for v in got) != GOAL * weeks for g in range(len(groups))):
        sys.exit('\nFEHLER: der Schnitt trifft die 10 nicht exakt.')
    print('\nSchnitt exakt 10,0000 in allen zwölf Gruppen.')

    print(f'\n{"Übung":34s} {"Plan":>5s} {"je Woche":>9s}')
    for i, t in sorted(zip(ids, total), key=lambda x: -x[1]):
        print(f'{i:34s} {t:5d} {t / weeks:9.2f}')

    if '--report' in sys.argv:
        return
    OUT.write_text(json.dumps(plan, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    print(f'\n{OUT.relative_to(ROOT)} geschrieben')


if __name__ == '__main__':
    main()
