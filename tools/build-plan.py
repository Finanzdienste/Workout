#!/usr/bin/env python3
"""Verteilt die Übungen so auf die Trainingstage, dass jede Muskelgruppe über
den ganzen Plan im Schnitt exakt ihr Ziel aus TARGET an Sätzen pro Woche
bekommt – und keine über der Obergrenze CAP liegt.

    python3 tools/build-plan.py             # schreibt tools/plan.json
    python3 tools/build-plan.py --report    # nur rechnen und zeigen

Die Ziele sind nicht überall gleich: der Oberkörper steht am Limit, der
Unterkörper hält. Wer das anders gewichten will, ändert TARGET und lässt neu
rechnen; welche Ziele überhaupt zusammen erreichbar sind, sagt der Lauf selbst.
Eine Gruppe darf auch ohne Ziel bleiben (None) – dann ergibt sie sich aus den
übrigen und muss nur unter CAP bleiben.

Eine "Woche" sind hier WEEK aufeinanderfolgende Einheiten.

Warum das überhaupt gerechnet werden muss: die Übungen treffen die
Muskelgruppen nicht sauber getrennt, sondern anteilig. Ein Goblet Squat ist
voll Oberschenkel, gut zur Hälfte Gesäß, ein Drittel Bauch. Wer stur drei Sätze
je Übung verteilt, landet bei manchen Gruppen weit über und bei anderen weit
unter dem Ziel. Also wird die Satzzahl je Übung gesucht statt gesetzt.

**Die Zahl der Wochen muss gerade sein** – solange Rücken und hintere Schulter
dasselbe Ziel haben, was sie derzeit tun. Sonst ist "exakt 10" nicht knapp
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
     Gesucht wird eine Lösung, die jede Zielgleichung exakt trifft und die
     Gruppen ohne Ziel unter CAP lässt – von vielen gefundenen die
     ausgewogenste, damit keine Übung fast verschwindet.
  2. Verteilung auf die Wochen.  Die Summen stehen fest; verschoben werden nur
     einzelne Sätze zwischen Wochen. Der Schnitt bleibt dabei zwangsläufig
     exakt, und gesucht wird die Verteilung, bei der die schlechteste einzelne
     Woche ihrem Ziel am nächsten liegt.
  3. Aufteilung auf die Einheiten.  Jede Übung kommt ein- bis dreimal pro
     Woche vor, je zwei bis drei Sätze; alle Einheiten etwa gleich lang.

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

# Sätze je Muskelgruppe und Woche. Nicht überall dieselbe Zahl: der Plan soll
# den Oberkörper voll bedienen und unten halten, was da ist. None heißt "kein
# Ziel" – die Gruppe kommt heraus, wie sie herauskommt, und muss nur unter CAP
# bleiben. Der Nacken ist so ein Fall: er hängt vollständig an Rudern,
# Chin-ups, Reverse Fly und Seitheben,
#
#     Nacken = 0,29·Rudern + 0,21·Chin-ups + 0,6·ReverseFly + 0,2·Seitheben
#
# und ist damit keine freie Größe mehr. Ein Ziel dafür macht das
# Gleichungssystem nur unlösbar oder erzwingt eine Verteilung, die anderswo
# schlechter ist – ohne Gleichung bleiben im Oberkörper 2431 exakte Lösungen
# statt 16, aus denen sich die ausgewogenste wählen lässt.
TARGET = {
    'chest': 10, 'lats': 10, 'delts': 10, 'rearDelts': 10,
    'biceps': 10, 'triceps': 10, 'abs': 10,
    'traps': None,
    'glutes': 8, 'quads': 6, 'hamstrings': 6, 'calves': 4,
}
CAP = 10                 # keine Gruppe darüber, indirekte Anteile eingerechnet
DIRECT = 0.5             # ab diesem Anteil gilt eine Übung als direkt für die Gruppe
REST_DAYS = 2            # so viele Tage Abstand, bevor eine Gruppe wieder direkt drankommt
WEEK = 4                 # Einheiten je Woche
WEEKS = 20               # Wochen im Plan – muss gerade sein, siehe oben
PER_SET = (2, 3)         # Sätze je Auftritt einer Übung
PER_WEEK = PER_SET[1] * WEEK   # mehr geht in einer Woche gar nicht
EXACT_LIMIT = 4000       # so viele Plansummen je Block reichen zur Auswahl
SCREEN = 50              # davon werden die besten probeweise verteilt
SCREEN_RESTARTS = 2      # Anläufe je Probe
SCREEN_ROUNDS = 90000    # Schritte je Probe
RESTARTS = 16            # Anläufe beim Verteilen auf die Wochen
SPREAD_ROUNDS = 400000   # Schritte je Anlauf
SPLITS = 900             # Versuche je Woche für die Aufteilung

# Gerechnet wird durchweg in Zwanzigsteln eines Satzes: alle Anteile in
# exercise-meta.json sind Vielfache von 0,05, damit bleibt alles ganzzahlig und
# "exakt" heißt wirklich exakt und nicht "bis auf Rundungsfehler".
UNIT = 20
GOAL = {m: (None if t is None else t * UNIT) for m, t in TARGET.items()}
CAP_U = CAP * UNIT

LABEL = {
    'quads': 'Oberschenkel', 'hamstrings': 'Beinbeuger', 'glutes': 'Gesäß',
    'chest': 'Brust', 'lats': 'Rücken', 'delts': 'Schultern',
    'rearDelts': 'hint. Schulter', 'biceps': 'Bizeps', 'triceps': 'Trizeps',
    'abs': 'Bauch', 'calves': 'Waden', 'traps': 'Nacken',
}


# ------------------------------------------------------------------ #
# Termine
# ------------------------------------------------------------------ #

def dates(weeks):
    """Trainingstermine erzeugen: `weeks` Wochen à WEEK Einheiten.

    Der erste Termin kommt aus der Excel, der Rhythmus aus WEEK: die sieben
    Tage einer Woche werden so gleichmäßig wie möglich auf die Abstände
    verteilt. Bei drei Einheiten sind das 3-2-2, bei vier 2-2-2-1 – vier
    Einheiten in sieben Tagen heißen zwangsläufig einmal zwei Tage
    hintereinander. Die Wochentage bleiben dabei fest, weil sich die Abstände
    zu genau sieben Tagen addieren.
    """
    src = DATA.read_text(encoding='utf-8')
    plan = json.loads(re.search(r'export const PLAN = ([\s\S]*?);\n?$', src).group(1))
    start = datetime.date.fromisoformat(plan[0]['date'])

    base, extra = divmod(7, WEEK)
    gaps = [base + 1] * extra + [base] * (WEEK - extra)
    day = [start]
    while len(day) < weeks * WEEK:
        day.append(day[-1] + datetime.timedelta(days=gaps[(len(day) - 1) % WEEK]))
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


def capped(sol, shares, weeks):
    """Bleibt jede Gruppe ohne Ziel unter der Obergrenze?

    Für Gruppen mit Ziel erledigen das die Gleichungen. Für die anderen ist es
    die einzige Bedingung: höchstens CAP Sätze pro Woche, indirekte Anteile
    eingerechnet.
    """
    got = {}
    for i, n in sol.items():
        for m, s in shares[i].items():
            if GOAL.get(m) is None:
                got[m] = got.get(m, 0) + n * round(s * UNIT)
    return all(v <= CAP_U * weeks for v in got.values())


def exact(block, shares, weeks, values, limit, rnd):
    """Alle Satzzahlen eines Blocks, die jede Zielgruppe exakt treffen.

    Tiefensuche mit zwei Abkürzungen. Steht in einer Gleichung nur noch eine
    Übung offen, ist ihr Wert bestimmt – passt er nicht, ist der Ast tot.
    Stehen mehrere offen, muss der Rest durch den größten gemeinsamen Teiler
    ihrer Anteile teilbar sein; das schneidet den Baum früh ab, lange bevor
    unten etwas nicht aufginge.

    Gruppen ohne Ziel (GOAL[m] is None) bekommen keine Gleichung. Sie werden
    hinterher nur noch gegen CAP geprüft – siehe capped().
    """
    groups = [m for m in sorted({m for i in block for m in shares[i]})
              if GOAL.get(m) is not None]
    eqs = [(GOAL[m] * weeks, [(i, round(shares[i][m] * UNIT)) for i in block if shares[i].get(m)])
           for m in groups]
    allowed = set(values)
    out = []

    def rec(val):
        while True:
            again = False
            for goal, eq in eqs:
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
            if capped(val, shares, weeks):
                out.append(dict(val))
            return
        tight = min((eq for _, eq in eqs if sum(1 for i, _ in eq if i not in val) > 1),
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

    Exakt sind viele Lösungen; brauchbar sind es weniger. Erst werden die
    ausgewogensten vorsortiert – keine Übung, die ganz herausfällt, möglichst
    wenig Streuung –, dann wird für die vordersten kurz durchgerechnet, wie eng
    sich damit die einzelne Woche halten lässt. Das entscheidet.

    Der Unterschied ist nicht klein: 180 Sätze Rudern sehen ausgewogen aus,
    ergeben aber 9 pro Woche und damit in jeder Woche dieselben drei Auftritte
    – die Chin-ups müssten dann auf einen Satz pro Woche, was bei mindestens
    zwei Sätzen je Auftritt nicht geht, und der Rücken schwankt um einen ganzen
    Satz. 160 Sätze Rudern lassen sich dagegen sauber teilen.

    Die Blöcke hängen über keine Gruppe zusammen, also lässt sich das je Block
    getrennt beurteilen.
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

        found.sort(key=balance)
        vol = Volume(shares, block, sorted({m for i in block for m in shares[i]}))
        best = None
        for sol in found[:SCREEN]:
            _, (hart, auftritte, worst) = spread([sol[i] for i in block], vol, weeks,
                                                 rnd, SCREEN_RESTARTS, SCREEN_ROUNDS)
            # Erst: keine Gruppe soll einen ganzen Satz danebenliegen. Dann:
            # keine Übung soll unter einen Satz pro Woche rutschen, ganz
            # herausfallen eingeschlossen. Dann die Länge der Einheiten, dann
            # die schlechteste Woche.
            knapp = sum(1 for v in sol.values() if v < weeks)
            got = (hart, knapp, auftritte, worst, min(sol.values()) == 0, balance(sol))
            if best is None or got < best[0]:
                best = (got, sol)
        total.update(best[1])
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
            # So breit wie möglich streuen: über alle Wochen, solange in jeder
            # noch die Mindestzahl steht. Auf wenige Wochen zu stapeln macht
            # aus 40 Sätzen zehnmal vier statt zwanzigmal zwei – und damit eine
            # Gruppe, die jede zweite Woche um einen ganzen Satz danebenliegt.
            k = min(weeks, t // lo)
            k = max(k, -(-t // hi), 1)
            base, extra = divmod(t, k)
            for j, w in enumerate(sorted(rnd.sample(range(weeks), k))):
                row[w] = base + (1 if j < extra else 0)
        rows.append(row)
    return rows


HARD = 10 ** 9           # Zuschlag für einen ganzen Satz Abweichung
APP = 2 * 10 ** 5        # Zuschlag je Auftritt einer Übung


def visits(sets):
    """Wie oft eine Übung in der Woche auftaucht: so selten wie möglich.

    Bei höchstens drei Sätzen je Auftritt sind das aufgerundet ein Drittel –
    sechs Sätze als 3+3, sieben schon als 3+2+2.
    """
    return -(-sets // PER_SET[1])


def miss(x, goal):
    """Abweichung einer Gruppe in dieser Woche.

    Mit Ziel zählt jede Richtung. Ohne Ziel zählt nur, was über die Obergrenze
    hinausgeht – unterhalb ist jeder Wert gleich recht, sonst zöge die Strafe
    eine ungezielte Gruppe unnötig an eine Zahl, die niemand gesetzt hat.
    """
    return abs(x - goal) if goal is not None else max(0, x - CAP_U)


def pen(week_vol, week_sets, goals):
    """Strafe einer Woche.

    Ein ganzer Satz Abweichung in einer Gruppe wiegt am schwersten – so weit
    kommt es nur, wo es rechnerisch nicht anders geht. Darunter stehen ein
    zusätzlicher Auftritt und eine Abweichung von gut 0,85 Sätzen etwa gleich
    hoch: für eine Übung weniger in der Einheit darf eine Gruppe ein paar
    Zehntel danebenliegen, für einen halben Satz aber nicht.
    """
    out = APP * sum(visits(c) for c in week_sets if c)
    for x, goal in zip(week_vol, goals):
        d = miss(x, goal)
        out += d ** 4 + (HARD if d >= UNIT else 0)
    return out


def spread(total, vol, weeks, rnd, restarts, rounds):
    """Plansummen auf die Wochen verteilen.

    Verschoben werden nur Sätze zwischen Wochen – die Plansummen bleiben
    unberührt, der Schnitt also zwangsläufig exakt. Zu holen ist zweierlei:
    möglichst wenige Auftritte, also kurze Einheiten, und möglichst kleine
    Abweichungen. Beides zieht in dieselbe Richtung, solange die Satzzahl einer
    Übung durch drei teilbar ist – sechs Sätze sind zwei Auftritte, sieben
    schon drei.
    """
    lo, hi = PER_SET[0], PER_WEEK
    rows_s = vol.s
    goals = [GOAL.get(m) for m in vol.groups]

    def fits(v):
        return v == 0 or lo <= v <= hi

    best = None
    for run in range(restarts):
        rows = start(total, weeks, rnd)
        vols = [[sum(rows[i][w] * rows_s[i][g] for i in range(len(rows)))
                 for g in range(len(vol.groups))] for w in range(weeks)]
        col = [[row[w] for row in rows] for w in range(weeks)]
        sq = [pen(vols[w], col[w], goals) for w in range(weeks)]
        # Der erste Anlauf glüht gar nicht aus, sondern schleift die
        # gleichmäßige Startverteilung nur nach. Die ist oft schon fast
        # richtig – 8 Sätze Rudern in jeder der 20 Wochen etwa –, und
        # Ausglühen zerlegt sie zuverlässig, ohne zurückzufinden.
        temp = 0.0 if run == 0 else 3e5 * (1 + run % 4)

        def move(i, u, v, d):
            """d Sätze der Übung i von Woche u nach v; neue Strafen zurück."""
            rows[i][u] -= d
            rows[i][v] += d
            col[u][i] -= d
            col[v][i] += d
            for g, c in enumerate(rows_s[i]):
                if c:
                    vols[u][g] -= d * c
                    vols[v][g] += d * c
            return pen(vols[u], col[u], goals), pen(vols[v], col[v], goals)

        for _ in range(rounds):
            temp *= 0.99995
            i = rnd.randrange(len(rows))
            u, v = rnd.randrange(weeks), rnd.randrange(weeks)
            if u == v or not rows[i][u]:
                continue
            d = rnd.choice((1, 2, 3, rows[i][u] - rows[i][v]))
            if d <= 0 or not fits(rows[i][u] - d) or not fits(rows[i][v] + d):
                continue
            su, sv = move(i, u, v, d)
            delta = su + sv - sq[u] - sq[v]
            if delta <= 0 or rnd.random() < pow(2.718, -delta / max(temp, 1e-9)):
                sq[u], sq[v] = su, sv
            else:
                move(i, u, v, -d)

        # Nachschliff: strikt bergab, bis kein einzelner Zug mehr etwas
        # bringt. Nach einem Treffer wird weitergescannt statt von vorn
        # angefangen – sonst kostet jede Verbesserung einen vollen Durchlauf,
        # und das sind bei 17 Übungen und 20 Wochen 27 000 Züge.
        moving = True
        while moving:
            moving = False
            for i in range(len(rows)):
                for u in range(weeks):
                    if not rows[i][u]:
                        continue
                    for v in range(weeks):
                        if u == v:
                            continue
                        for d in (1, 2, 3, rows[i][u] - rows[i][v]):
                            if d <= 0 or not fits(rows[i][u] - d) or not fits(rows[i][v] + d):
                                continue
                            su, sv = move(i, u, v, d)
                            if su + sv < sq[u] + sq[v]:
                                sq[u], sq[v] = su, sv
                                moving = True
                                break
                            move(i, u, v, -d)
                        if not rows[i][u]:
                            break

        # Zwischen den Anläufen zählt dieselbe Rangfolge wie in pen(): erst
        # ganze Sätze daneben, dann Auftritte, dann die volle Liste aller
        # Abweichungen, absteigend sortiert.
        auftritte = sum(visits(c) for w in col for c in w if c)
        alle = sorted((miss(x, g) for v in vols for x, g in zip(v, goals)), reverse=True)
        hart = sum(1 for x in alle if x >= UNIT)
        got = (hart, auftritte, alle)
        if best is None or got < best[0]:
            best = (got, [list(c) for c in col])
    (hart, auftritte, alle), per_week = best
    return per_week, (hart, auftritte, alle[0])


# ------------------------------------------------------------------ #
# Schritt 3: eine Woche auf ihre Einheiten aufteilen
# ------------------------------------------------------------------ #

def chunks(sets, rnd, sessions):
    """Sätze einer Übung auf möglichst wenige Auftritte verteilen.

    Wenige Auftritte heißt kurze Einheiten: sechs Sätze als 3+3 füllen zwei
    Zeilen, als 2+2+2 drei. Nur die kürzesten Zerlegungen kommen infrage.
    """
    lo, hi = PER_SET
    options = []
    for parts in range(1, sessions + 1):
        for combo in itertools.combinations_with_replacement(range(lo, hi + 1), parts):
            if sum(combo) == sets:
                options.append(list(combo))
        if options:
            break
    if not options:
        return None
    pick = list(rnd.choice(options))
    rnd.shuffle(pick)
    return pick


def sides(ids, shares, total, groups):
    """Zwei Hälften des Körpers, die sich keine Übung teilen.

    Der Ein-Tages-Abstand lässt sich nicht wegplanen – vier Termine in sieben
    Tagen erzwingen ihn. Er lässt sich aber auf zwei Hälften legen: die Einheit
    davor nimmt nur die eine, die danach nur die andere. Damit hat jede Gruppe
    mindestens REST_DAYS Tage, ohne dass eine Einheit leer ausgeht.

    Die Hälften werden nicht von Hand gesetzt, sondern gerechnet. Übungen, die
    eine direkte Gruppe teilen, müssen zusammenbleiben – daraus ergeben sich
    Blöcke (Ziehen, Drücken, Beine, Bauch, Waden). Von allen Aufteilungen
    dieser Blöcke gewinnt die, bei der beide Hälften gleich viele Sätze haben:
    sonst wird eine der beiden Einheiten zum Rumpf.
    """
    root = {i: i for i in ids}

    def find(x):
        while root[x] != x:
            root[x] = root[root[x]]
            x = root[x]
        return x

    for m in groups:
        hit = [i for i in ids if shares[i].get(m, 0) >= DIRECT]
        for i in hit[1:]:
            root[find(i)] = find(hit[0])
    block = {}
    for i, t in zip(ids, total):
        block.setdefault(find(i), []).append((i, t))

    keys = list(block)
    saetze = [sum(t for _, t in block[k]) for k in keys]
    ganz = sum(saetze)
    best = None
    for mask in range(1 << len(keys)):
        a = sum(s for i, s in enumerate(saetze) if mask >> i & 1)
        got = (abs(2 * a - ganz), mask)
        if best is None or got < best:
            best = got
    _, mask = best
    half = [set(), set()]
    for i, k in enumerate(keys):
        seite = half[0] if mask >> i & 1 else half[1]
        for ex, _ in block[k]:
            seite |= direct_groups(ex, shares)
    return [frozenset(h) for h in half], best[0]


def clash(slot, dset, direkt, tight, prev):
    """Verletzt die Übung in dieser Einheit die Erholungsbedingung?

    Geprüft wird gegen beide Nachbarn: die zu kurz davorliegende Einheit des
    Blocks und, für die erste Einheit, die letzte der Vorwoche.
    """
    for a, b in tight:
        if slot == a and direkt[b] & dset:
            return True
        if slot == b and direkt[a] & dset:
            return True
    return slot == 0 and bool(prev & dset)


def direct_groups(ex, shares):
    """Muskelgruppen, für die eine Übung *da* ist – Anteil ab DIRECT.

    Die Trennung ist grob, aber sie ist die, um die es bei der Erholung geht:
    drei Sätze Kniebeugen sind für den Oberschenkel etwas anderes als der
    Bauchanteil derselben Sätze.
    """
    return frozenset(m for m, s in shares[ex].items() if s >= DIRECT)


def split(week, ids, shares, groups, sessions, rnd, tries, used, tight=(), prev=frozenset(), roles=None):
    """Aufteilung mit möglichst gleich langen und gleich gemischten Einheiten.

    `used` sind die bereits vergebenen Zusammenstellungen; eine Wiederholung
    wiegt schwerer als jede Unwucht, sonst gleichen sich zwei Wochen an.

    `roles` gibt je Einheit vor, welche Muskelgruppen sie direkt treffen darf –
    darüber laufen die beiden Hälften aus sides(). Nur die Einheiten an einem
    zu kurzen Übergang bekommen eine Rolle, die übrigen bleiben frei.
    `tight` sind Paare von Einheiten dieses Blocks, die weniger als REST_DAYS
    Tage auseinanderliegen, `prev` die direkt trainierten Gruppen der Einheit
    unmittelbar davor, falls auch dieser Abstand zu kurz ist – beides als
    Rückversicherung, damit die Bedingung auch dann hält, wenn WEEK oder die
    Abstände einmal anders stehen.

    Zurück kommt (Einheiten, Konflikte): Konflikte > 0 heißt, dass sich die
    Bedingung in dieser Woche nicht einhalten ließ.
    """
    target_sets = sum(week) / sessions
    target_vol = {m: sum(week[k] * shares[ids[k]].get(m, 0) for k in range(len(ids))) / sessions
                  for m in groups}
    best = None
    # Erst mit Erholungsbedingung; findet sich damit keine Aufteilung, wird sie
    # für diese Woche fallen gelassen statt den Plan scheitern zu lassen.
    for streng in (True, False):
        for _ in range(tries):
            day = [[] for _ in range(sessions)]
            direkt = [set() for _ in range(sessions)]
            ok = True
            for k in sorted(range(len(ids)), key=lambda x: -week[x]):
                if not week[k]:
                    continue
                part = chunks(week[k], rnd, sessions)
                if part is None:
                    ok = False
                    break
                dset = direct_groups(ids[k], shares)
                free = sorted(range(sessions),
                              key=lambda s: (len(day[s]), sum(x[1] for x in day[s]), rnd.random()))
                if streng:
                    free = [s for s in free
                            if (roles is None or roles[s] is None or dset <= roles[s])
                            and not clash(s, dset, direkt, tight, prev)]
                if len(free) < len(part):
                    ok = False
                    break
                for slot, sets in zip(free, part):
                    day[slot].append((ids[k], sets))
                    direkt[slot] |= dset
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
            # Wie viele Übungen die Woche hat, steht schon fest; hier geht es nur
            # noch darum, dass keine Einheit die längste wird.
            laengste = max(len(d) for d in day)
            got = (doppelt, laengste, imbalance, count, round(mix, 6))
            if best is None or got < best[0]:
                best = (got, day, direkt)
        if best is not None:
            break
    if best is None:
        sys.exit('Keine Aufteilung gefunden – PER_SET/PER_WEEK prüfen.')
    _, day, direkt = best
    konflikte = sum(len(direkt[a] & direkt[b]) for a, b in tight)
    konflikte += len(prev & direkt[0]) if prev else 0
    used.update(frozenset(ex for ex, _ in d) for d in day)
    return day, direkt, konflikte


# ------------------------------------------------------------------ #

def main():
    meta = json.loads(META.read_text(encoding='utf-8'))
    shares = {k: v['dbShares'] for k, v in meta.items()}
    ids = list(shares)
    groups = sorted({m for sh in shares.values() for m in sh})
    weight = {i: sum(shares[i].values()) for i in ids}   # große Übungen zuerst

    weeks = WEEKS + WEEKS % 2                            # exakt geht nur geradzahlig
    day = dates(weeks)

    rnd = random.Random(7)
    vol = Volume(shares, ids, groups)

    total, variants = totals(ids, shares, groups, weeks, rnd)
    print(f'exakte Plansummen: {"·".join(map(str, variants))} Lösungen je Block, '
          f'ausgewogenste gewählt ({min(total)}–{max(total)} Sätze je Übung)')

    per_week, (hart, auftritte, worst) = spread(total, vol, weeks, rnd,
                                                RESTARTS, SPREAD_ROUNDS)
    print(f'auf {weeks} Wochen verteilt: {auftritte} Auftritte '
          f'({auftritte / (weeks * WEEK):.2f} Übungen je Einheit), '
          f'schlechteste Woche {worst / UNIT:.2f} Sätze daneben, '
          f'{hart} ganze Sätze daneben')

    half, unwucht = sides(ids, shares, total, groups)
    print(f'Erholung: zwei Hälften mit {unwucht / 2 / weeks:+.1f} Sätzen Unterschied pro Woche – '
          f'[{", ".join(sorted(LABEL.get(m, m) for m in half[0]))}] gegen '
          f'[{", ".join(sorted(LABEL.get(m, m) for m in half[1]))}]')

    plan = []
    used = set()
    offen = 0            # Wochen, in denen die Erholungsbedingung nicht aufging
    prev = frozenset()   # direkt trainierte Gruppen der letzten Einheit davor
    for k, w in enumerate(per_week):
        block = day[k * WEEK:(k + 1) * WEEK]
        # Welche Einheiten dieses Blocks liegen zu dicht beieinander? Bei vier
        # Terminen in sieben Tagen ist das genau einer – meist der Übergang zur
        # nächsten Woche, deshalb wird `prev` mitgeführt.
        tight = [(i, i + 1) for i in range(len(block) - 1)
                 if (block[i + 1] - block[i]).days < REST_DAYS]
        eng_am_anfang = k > 0 and (block[0] - day[k * WEEK - 1]).days < REST_DAYS
        eng_am_ende = k + 1 < len(per_week) and (day[(k + 1) * WEEK] - block[-1]).days < REST_DAYS
        # Nur die Einheiten an einem zu kurzen Übergang bekommen eine Hälfte
        # zugewiesen; die dazwischen bleiben frei und nehmen, was übrig ist.
        roles = [None] * WEEK
        if eng_am_ende:
            roles[-1] = half[0]
        if eng_am_anfang:
            roles[0] = half[1]
        for a, b in tight:
            roles[a], roles[b] = roles[a] or half[0], roles[b] or half[1]
        sess_list, direkt, konflikte = split(w, ids, shares, groups, WEEK, rnd, SPLITS, used,
                                             tight, prev if eng_am_anfang else frozenset(), roles)
        offen += 1 if konflikte else 0
        prev = frozenset(direkt[-1])
        for d, sess in zip(block, sess_list):
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
          f'{max(sum(e["sets"] for e in s["ex"]) for s in plan)} Sätze je Einheit')

    # ---- Erholung: am fertigen Plan nachgemessen, nicht dem Verfahren geglaubt ----
    def direkt_am_tag(sess):
        out = set()
        for e in sess['ex']:
            out |= direct_groups(e['id'], shares)
        return out

    eng, doppelt = 0, []
    for i in range(len(plan) - 1):
        d1 = datetime.date.fromisoformat(plan[i]['date'])
        d2 = datetime.date.fromisoformat(plan[i + 1]['date'])
        if (d2 - d1).days >= REST_DAYS:
            continue
        eng += 1
        beide = direkt_am_tag(plan[i]) & direkt_am_tag(plan[i + 1])
        if beide:
            doppelt.append((plan[i]['date'], sorted(LABEL.get(m, m) for m in beide)))
    print(f'{eng} Übergänge unter {REST_DAYS} Tagen, davon {len(doppelt)} mit einer Gruppe '
          f'zweimal direkt{" (Wochen ohne Lösung: " + str(offen) + ")" if offen else ""}')
    for datum, ms in doppelt[:5]:
        print(f'   {datum} -> Folgetag: {", ".join(ms)}')
    print()

    print(f'{"Muskelgruppe":16s} {"Ziel":>5s} {"Schnitt":>9s} {"min":>6s} {"max":>6s}')
    for g, m in enumerate(groups):
        col = [v[g] / UNIT for v in got]
        ziel = TARGET.get(m)
        print(f'{LABEL.get(m, m):16s} {"–" if ziel is None else ziel:>5} '
              f'{sum(col) / weeks:9.4f} {min(col):6.2f} {max(col):6.2f}')
    for g, m in enumerate(groups):
        summe = sum(v[g] for v in got)
        if GOAL.get(m) is None:
            if summe > CAP_U * weeks:
                sys.exit(f'\nFEHLER: {LABEL.get(m, m)} über der Obergrenze von {CAP}.')
        elif summe != GOAL[m] * weeks:
            sys.exit(f'\nFEHLER: {LABEL.get(m, m)} trifft {TARGET[m]} nicht exakt.')
    gezielt = sum(1 for m in groups if GOAL.get(m) is not None)
    print(f'\nSchnitt exakt getroffen in {gezielt} von {len(groups)} Gruppen, '
          f'der Rest unter der Obergrenze von {CAP}.')

    print(f'\n{"Übung":34s} {"Plan":>5s} {"je Woche":>9s}')
    for i, t in sorted(zip(ids, total), key=lambda x: -x[1]):
        print(f'{i:34s} {t:5d} {t / weeks:9.2f}')

    if '--report' in sys.argv:
        return
    # Die Ziele wandern mit: die App zeigt das Wochenvolumen gegen genau diese
    # Zahlen, und eine zweite Stelle, an der 10 steht, wäre eine Stelle zu viel.
    # Der Nacken bekommt seinen Ist-Wert als Ziel – ohne Ziel gäbe es dort
    # nichts anzuzeigen, und die Obergrenze ist keine Ansage. Zwei
    # Nachkommastellen sind dabei nicht gerundet, sondern exakt: der Wert ist
    # ein Vielfaches von 0,05.
    ziele = {m: TARGET[m] if TARGET.get(m) is not None
             else round(sum(v[groups.index(m)] for v in got) / weeks / UNIT, 2)
             for m in groups}
    # Die Erholungsregel wandert ebenfalls mit: die App tauscht bei
    # Verletzungen Übungen aus und muss dabei dieselbe Schwelle einhalten wie
    # der Generator, sonst steht die Gruppe doch zweimal in 48 Stunden.
    OUT.write_text(json.dumps({'target': ziele, 'cap': CAP,
                               'rest': {'days': REST_DAYS, 'direct': DIRECT},
                               'plan': plan},
                              ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    print(f'\n{OUT.relative_to(ROOT)} geschrieben')


if __name__ == '__main__':
    main()
