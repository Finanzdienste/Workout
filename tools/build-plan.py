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

**Ob ein Ziel überhaupt exakt erreichbar ist, ist eine Frage der Teilbarkeit.**
Solange Rücken und hintere Schulter dasselbe Ziel hatten und der Rücken nur aus
zwei Übungen kam – Rudern und Chin-ups, beide mit Anteil 1,0 –, musste die Zahl
der Wochen gerade sein. Die hintere Schulter hing an denselben zwei Übungen
plus Reverse Fly:

    hintere Schulter = 1,5·W + 0,2·Rudern + ReverseFly

Für 10·W bräuchte es ReverseFly = 8,5·W − 0,2·Rudern. Bei ungeradem W endet
8,5·W auf ,5, und 0,2·Rudern kann nur auf ,0 ,2 ,4 ,6 oder ,8 enden – das geht
nie auf. Inzwischen ist die Lage eine andere – drei Zugübungen statt zwei, und
mit festen Dreiersätzen bewegt sich alles in Dreierschritten –, aber die Art
der Bedingung bleibt dieselbe. Verlassen sollte man sich auf keine Faustregel:
Was zusammen aufgeht, sagt der Lauf selbst. Er sucht die erste Wochenzahl ab
WEEKS, für die alle Blöcke exakt aufgehen, und meldet für jede Gruppe, ob der
Schnitt getroffen wurde.

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

import collections
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

# Sätze je Muskelgruppe und Woche – zweite Fassung. Vorher stand im Oberkörper
# überall eine 10, weil das die selbst gesetzte Obergrenze war. Zwei Dinge
# sprachen dagegen:
#
#   * Bauch. Zehn Sätze pro Woche waren das teuerste Nichts im Plan – ein
#     sichtbarer Bauch ist eine Frage des Körperfetts, nicht der Crunches.
#     Erst standen hier fünf. Das war zu wenig, und zwar aus einem Grund,
#     den die Zahl verdeckt: Beim Bauch stecken 60 % des Ziels in
#     indirekten Anteilen – dem Halten bei Kniebeuge, Kreuzheben und Leg
#     Curl. Von fünf blieben zwei direkte Sätze übrig, an einem Tag der
#     Woche. Isometrisches Halten ist aber kein Ersatz für Beugen gegen
#     Widerstand. Neun ergeben rund sechs direkte Sätze auf zwei Tagen –
#     die einzige Gruppe, bei der das Ziel deutlich über dem liegt, was
#     tatsächlich direkt trainiert wird.
#   * Zehn Sätze sind nicht das Ende der Fahnenstange. Die Dosis-Wirkung
#     steigt bis etwa zwanzig Sätze je Muskel und Woche weiter, mit
#     abnehmendem Ertrag. Wer schnell zulegen will, liegt bei 14–16 näher am
#     Optimum als bei 10.
#
# **Die Schulter zählt getrennt.** "10 Sätze Schulter" waren nachgerechnet 8,1
# vordere und 3,7 seitliche: Jedes Drücken füttert die vordere mit, die
# seitliche hängt allein am Heben zur Seite – und sie ist die, die breit macht.
# Zusammengefasst verdeckte das Ziel genau diesen Unterschied. Die seitliche
# bekommt deshalb ein eigenes Ziel, die vordere gar keins: Sie ergibt sich aus
# dem Drücken und muss nur unter der Obergrenze bleiben, so wie der Nacken.
#
# Nicht überall dieselbe Zahl: Was den Oberkörper breit macht, bekommt am
# meisten, die Beine bleiben, wie sie waren. None heißt
# "kein Ziel" – die Gruppe kommt heraus, wie sie herauskommt, und muss nur
# unter CAP bleiben. Der Nacken ist so ein Fall: er hängt vollständig an
# Rudern, Chin-ups, Pull-ups, Reverse Fly und Seitheben und ist damit keine
# freie Größe mehr. Ein Ziel dafür macht das Gleichungssystem nur unlösbar oder
# erzwingt eine Verteilung, die anderswo schlechter ist.
TARGET = {
    'chest': 10, 'lats': 10, 'sideDelts': 10, 'rearDelts': 8,
    'biceps': 10, 'triceps': 10, 'abs': 9,
    'frontDelts': None, 'traps': None,
    'glutes': 9, 'quads': 6, 'hamstrings': 6, 'calves': 6,
}
CAP = 10                 # keine Gruppe darüber, indirekte Anteile eingerechnet
#
# Die Obergrenze bindet in Wahrheit nur eine Gruppe: den Nacken. Er bekommt
# keinen einzigen eigenen Satz – kein Shrug, nichts –, sondern sammelt aus
# Rudern, Klimmzügen, Reverse Fly und Pull-Apart. Genau deshalb ist er teuer:
# Jede Übung, die Rücken oder hintere Schulter trainiert, lädt ihn mit. Bei
# hinterer Schulter 10 liegt sein rechnerisches Minimum bei 10,79 – eine
# Obergrenze von 10 wäre dort schlicht unerfüllbar. Mit 8 sinkt das Minimum auf
# 9,59, und es bleiben genug brauchbare Lösungen übrig. Das ist der Tausch:
# zwei Sätze hintere Schulter für einen Nacken unter zehn.
DIRECT = 0.5             # ab diesem Anteil gilt eine Übung als direkt für die Gruppe
REST_DAYS = 2            # so viele Tage Abstand, bevor eine Gruppe wieder direkt drankommt

# Trainingstage als Wochentage, 0 = Montag. Vorher ergaben sich die Termine aus
# dem Startdatum der Excel und einem gleichmäßigen Rhythmus – das war ein
# Nebenprodukt, keine Entscheidung. Hier steht sie ausdrücklich: Montag,
# Mittwoch, Freitag, Samstag. Der Ein-Tages-Abstand liegt damit auf Fr/Sa, der
# Sonntag bleibt frei. Wer anders kann, ändert die Zeile; die Erholungsregel
# rechnet mit den tatsächlichen Abständen und passt sich von selbst an.
DAYS = (0, 2, 4, 5)
WEEK = len(DAYS)         # Einheiten je Woche
WEEKS = 21               # Wochen im Plan – Vielfaches von GRAIN, siehe oben
# Sätze je Auftritt einer Übung. Gleicher Wert oben wie unten heißt: jede
# Übung steht immer mit derselben Satzzahl da. Das kostet Genauigkeit in der
# einzelnen Woche – die Satzzahl jeder Übung ist dann ein Vielfaches von drei,
# und Gruppen, deren Übungen alle Anteil 1,0 haben (Brust, Rücken,
# Oberschenkel, Waden), können in einer Woche nur 3, 6, 9 … Sätze bekommen.
# Dafür sind die Einheiten kürzer: dieselben Sätze auf weniger Übungen.
PER_SET = (3, 3)         # Sätze je Auftritt einer Übung
# Körnung: Bei fester Satzzahl bewegt sich alles in Dreierschritten.
GRAIN = PER_SET[0] if PER_SET[0] == PER_SET[1] else 1
PER_WEEK = PER_SET[1] * WEEK   # mehr geht in einer Woche gar nicht

# Sätze je Übung und Woche, wenn sie überhaupt vorkommt. Ohne diese Schranken
# wählt die Suche gern Extreme: bei 21 Übungen kam eine Lösung heraus, in der
# Chin-ups mit 10 Sätzen pro Woche am Anschlag standen und das Rudern
# vollständig verschwand – rechnerisch exakt und als Plan unbrauchbar. Nach
# oben begrenzt heißt: keine Übung trägt eine Gruppe allein; nach unten: wer
# vorkommt, kommt regelmäßig vor.
PER_EX_WEEK = (1, 9)
EXACT_LIMIT = 4000       # so viele Plansummen je Block reichen zur Auswahl
SCREEN = 50              # davon werden die besten probeweise verteilt
SCREEN_RESTARTS = 2      # Anläufe je Probe
SCREEN_ROUNDS = 90000    # Schritte je Probe
RESTARTS = 16            # Anläufe beim Verteilen auf die Wochen
SPREAD_ROUNDS = 400000   # Schritte je Anlauf
SPLITS = 2000            # Versuche je Woche für die Aufteilung

# Gerechnet wird durchweg in Zwanzigsteln eines Satzes: alle Anteile in
# exercise-meta.json sind Vielfache von 0,05, damit bleibt alles ganzzahlig und
# "exakt" heißt wirklich exakt und nicht "bis auf Rundungsfehler".
UNIT = 20
GOAL = {m: (None if t is None else t * UNIT) for m, t in TARGET.items()}
CAP_U = CAP * UNIT

LABEL = {
    'quads': 'Oberschenkel', 'hamstrings': 'Beinbeuger', 'glutes': 'Gesäß',
    'chest': 'Brust', 'lats': 'Rücken',
    'frontDelts': 'vord. Schulter', 'sideDelts': 'seitl. Schulter',
    'rearDelts': 'hint. Schulter', 'biceps': 'Bizeps', 'triceps': 'Trizeps',
    'abs': 'Bauch', 'calves': 'Waden', 'traps': 'Nacken',
}


# ------------------------------------------------------------------ #
# Termine
# ------------------------------------------------------------------ #

def dates(weeks):
    """Trainingstermine erzeugen: `weeks` Wochen à WEEK Einheiten.

    Die Wochentage stehen in DAYS. Losgelegt wird am ersten dieser Tage ab dem
    Startdatum der Excel – und zwar am *ersten* aus DAYS, damit jede Woche
    vollständig ist: die Volumenrechnung fasst je WEEK aufeinanderfolgende
    Einheiten zu einer Woche zusammen, und eine angebrochene erste Woche würde
    diese Blöcke gegen den Kalender verschieben.
    """
    src = DATA.read_text(encoding='utf-8')
    plan = json.loads(re.search(r'export const PLAN = ([\s\S]*?);\n?$', src).group(1))
    start = datetime.date.fromisoformat(plan[0]['date'])

    tage = sorted(DAYS)
    first = start
    while first.weekday() != tage[0]:
        first += datetime.timedelta(days=1)
    day = []
    for w in range(weeks):
        for d in tage:
            day.append(first + datetime.timedelta(days=7 * w + d - tage[0]))
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
    fair = PER_SET[1] * weeks     # drei Sätze pro Woche als neutraler Anker
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
        # Erst die Werte nahe an einem ausgewogenen Anteil, dann die Ränder.
        # Die Tiefensuche findet ohnehin nur so viele Lösungen, wie das Limit
        # zulässt – dann sollen es die brauchbaren sein und nicht die, die
        # zufällig zuerst kommen. Der Zufall bleibt als Tiebreak, damit
        # verschiedene Läufe verschiedene Lösungen sehen.
        order = sorted(values, key=lambda v: (abs(v - fair), rnd.random()))
        for v in order:
            if len(out) >= limit:
                return
            rec({**val, pick: v})

    rec({})
    return out


def klumpen(sol, block, shares):
    """Wie sehr hängt eine Gruppe an einer einzigen Übung?

    Zurück kommt der größte Anteil, den eine Übung am Volumen *einer* Gruppe
    hat, grob gestuft. Das ist kein Schönheitspreis: Vorher standen 7,9 Sätze
    Reverse Fly pro Woche für die hintere Schulter und ein Zug-Verhältnis von
    7 zu 3 zwischen Klimmzug und Rudern – beides nicht entschieden, sondern
    zufällig so gewählt. Ein Reiz aus zwei Richtungen ist mehr wert als
    derselbe Reiz doppelt, und fällt eine Übung wegen einer Beschwerde aus,
    bleibt bei einer Klumpen-Lösung nichts übrig.

    Gestuft in Zwanzigsteln, damit winzige Unterschiede nicht die Reihenfolge
    umwerfen und die späteren Kriterien noch etwas zu sagen haben.
    """
    schlimmst = 0.0
    for m in {m for i in block for m in shares[i] if GOAL.get(m) is not None}:
        teile = [sol[i] * shares[i].get(m, 0) for i in block]
        ganz = sum(teile)
        if ganz:
            schlimmst = max(schlimmst, max(teile) / ganz)
    return round(schlimmst * 20)


def totals(ids, shares, groups, weeks, rnd, streng=True):
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
    values = [0] + [v for v in range(PER_EX_WEEK[0] * weeks, PER_EX_WEEK[1] * weeks + 1)
                    if v % GRAIN == 0]
    total, variants = {}, []
    for block in parts(ids, shares, groups):
        found = exact(block, shares, weeks, values, EXACT_LIMIT, rnd)
        if not found:
            if streng:
                sys.exit(f'Keine exakte Lösung für {weeks} Wochen')
            return None, None
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
            # herausfallen eingeschlossen. Dann: keine Gruppe soll an einer
            # einzigen Übung hängen. Dann die Länge der Einheiten, dann die
            # schlechteste Woche.
            knapp = sum(1 for v in sol.values() if v < weeks)
            got = (hart, knapp, klumpen(sol, block, shares), auftritte, worst,
                   min(sol.values()) == 0, balance(sol))
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
            # Gerechnet wird in Blöcken der Körnung, damit jede Wochenzahl
            # ein Vielfaches davon bleibt.
            einheiten = t // GRAIN
            k = min(weeks, einheiten * GRAIN // lo, einheiten)
            k = max(k, -(-t // hi), 1)
            base, extra = divmod(einheiten, k)
            for j, w in enumerate(sorted(rnd.sample(range(weeks), k))):
                row[w] = (base + (1 if j < extra else 0)) * GRAIN
        rows.append(row)
    return rows


HARD = 10 ** 9           # Zuschlag ab MAX_REL Abweichung
APP = 2 * 10 ** 5        # Zuschlag je Auftritt einer Übung
REF = 10 * UNIT          # Bezugsziel der relativen Strafe: zehn Sätze
# Ab welchem Anteil des Wochenziels eine Abweichung als grob gilt. Ein Drittel
# klingt viel und ist bei Dreierschritten das Mindeste: Eine Gruppe mit Ziel 6,
# deren Übungen alle voll auf sie gehen, kann in einer Woche nur 3, 6 oder 9
# Sätze bekommen – 9 sind bereits die Hälfte darüber. Enger gesetzt findet der
# Lauf für solche Gruppen gar keine Verteilung mehr.
MAX_REL = 0.5


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

    Gewogen wird **im Verhältnis zum Ziel der Gruppe**, nicht in Sätzen. Ein
    Satz zu wenig ist bei den Waden (Ziel 4) ein Viertel des Wochenpensums, bei
    der Brust (Ziel 10) ein Zehntel – dieselbe Zahl, ein ganz anderer Verlust.
    Vorher zählte die absolute Abweichung, und das bevorzugte systematisch die
    großen Gruppen: Der Suchlauf holte sich zehn Zehntel bei der Brust, indem
    er den Waden einen ganzen Satz nahm.

    Bezugsgröße ist REF – ein Ziel von zehn Sätzen. Bei genau dieser Gruppe
    rechnet die Strafe wie vorher, darunter strenger, darüber milder.

    Gruppen ohne Ziel haben kein Verhältnis; für sie zählt weiter nur, was über
    die Obergrenze hinausgeht, gemessen an der Obergrenze.
    """
    out = APP * sum(visits(c) for c in week_sets if c)
    for x, goal in zip(week_vol, goals):
        d = miss(x, goal)
        rel = d / (goal if goal else CAP_U)
        out += (rel * REF) ** 4 + (HARD if rel >= MAX_REL else 0)
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
        return v == 0 or (lo <= v <= hi and v % GRAIN == 0)

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
            d = rnd.choice((GRAIN, 2 * GRAIN, 3 * GRAIN, rows[i][u] - rows[i][v]))
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
                        for d in (GRAIN, 2 * GRAIN, 3 * GRAIN, rows[i][u] - rows[i][v]):
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
        # grobe Abweichungen, dann Auftritte, dann die volle Liste – alles im
        # Verhältnis zum Ziel der jeweiligen Gruppe, nicht in Sätzen.
        auftritte = sum(visits(c) for w in col for c in w if c)
        alle = sorted((miss(x, g) / (g if g else CAP_U)
                       for v in vols for x, g in zip(v, goals)), reverse=True)
        hart = sum(1 for x in alle if x >= MAX_REL)
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
    # Welche Gruppen sind in dieser Woche knapp? Bei höchstens sechs direkten
    # Sätzen sind das zwei Auftritte, und dann entscheidet die Platzierung
    # darüber, ob die Gruppe an einem oder an zwei Tagen drankommt. Bei Brust
    # oder Rücken mit drei Auftritten ergibt sich die Streuung von selbst –
    # dort auf frische Tage zu drängen, schiebt nur Sätze auf ohnehin volle
    # Tage und zieht die Einheiten auseinander (16 bis 22 Sätze statt 18 bis 20).
    direkt_woche = collections.Counter()
    for k, ex in enumerate(ids):
        if week[k]:
            for m in direct_groups(ex, shares):
                direkt_woche[m] += week[k]
    knapp = {m for m, n in direkt_woche.items() if n <= 6}
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
                # Zuerst ein Tag, an dem eine *knappe* Gruppe dieser Übung
                # noch nicht direkt drankam, dann der leerste. Ohne den ersten
                # Teil landeten die beiden Wadenübungen regelmäßig am selben
                # Tag: Jede für sich sucht nur den leersten Platz, und dass die
                # andere dieselbe Gruppe trifft, sieht sie nicht. Als reines
                # Auswahlkriterium reichte das nicht – unter 900
                # Zufallsversuchen war oft kein einziger dabei, der es besser
                # machte. Für *alle* Gruppen zu gelten war dagegen zu viel des
                # Guten; siehe `knapp` oben.
                eng_dset = dset & knapp
                free = sorted(range(sessions),
                              key=lambda s: (len(eng_dset & direkt[s]), len(day[s]),
                                             sum(x[1] for x in day[s]), rnd.random()))
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
            # Was zweimal in der Woche vorkommt, gehört auf zwei Tage. Zweimal
            # pro Woche schlägt einmal bei gleicher Satzzahl – und ohne dieses
            # Kriterium landeten beide Auftritte gern am selben Tag: die Waden
            # in acht von zwanzig Wochen, der Bauch in jeder. Gezählt werden
            # nur Gruppen, die überhaupt zwei Auftritte haben; eine Gruppe mit
            # einem einzigen Zweiersatz kann nicht auf zwei Tage.
            tage, auftritte = {}, collections.Counter()
            for slot, d in enumerate(day):
                for ex, _ in d:
                    for m in direct_groups(ex, shares):
                        tage.setdefault(m, set()).add(slot)
                        auftritte[m] += 1
            selten = sum(1 for m, slots in tage.items()
                         if len(slots) < 2 <= auftritte[m])
            got = (doppelt, selten, laengste, imbalance, count, round(mix, 6))
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
    # Reihenfolge in der Einheit. Vorher war es die Summe aller Muskelanteile –
    # eine Hilfsgröße, die meistens stimmte und manchmal daneben lag: der Hip
    # Thrust (1,50) landete hinter dem Reverse Fly (1,60), eine schwere
    # Hüftstreckung also hinter einer Schulter-Isolation. Jetzt steht die
    # Einordnung als `tier` in exercise-meta.json, und innerhalb einer Stufe
    # kommt zuerst, was auf die höchsten Wochenziele einzahlt – die Prioritäten
    # stehen damit an genau einer Stelle, in TARGET.
    def rang(ex):
        ziele = [TARGET.get(m) or 0 for m, v in shares[ex].items() if v >= DIRECT]
        return (meta[ex]['tier'], -max(ziele or [0]), -sum(shares[ex].values()), ex)

    # Ob ein Ziel exakt erreichbar ist, hängt an der Teilbarkeit: Der Rücken
    # kommt aus drei Übungen mit Anteil 1,0, seine Plansumme ist bei
    # Dreierschritten also ein Vielfaches von drei – und muss Ziel·Wochen
    # treffen. Früher stand hier eine feste Regel ("Wochenzahl gerade"). Die
    # galt für eine bestimmte Kombination aus Zielen und Anteilen und wurde
    # falsch, sobald sich eine davon änderte. Jetzt probiert der Lauf, statt zu
    # raten: die erste Wochenzahl ab WEEKS, für die alle Blöcke aufgehen.
    rnd = random.Random(7)
    vol = Volume(shares, ids, groups)
    for weeks in range(WEEKS, WEEKS + 12):
        total, variants = totals(ids, shares, groups, weeks, rnd, streng=False)
        if total is not None:
            break
    else:
        sys.exit(f'Keine exakte Lösung zwischen {WEEKS} und {WEEKS + 11} Wochen – '
                 'Ziele oder Anteile passen nicht zur Körnung.')
    if weeks != WEEKS:
        print(f'Wochenzahl auf {weeks} erhöht – mit {WEEKS} geht das Ziel nicht exakt auf')
    day = dates(weeks)
    print(f'exakte Plansummen: {"·".join(map(str, variants))} Lösungen je Block, '
          f'ausgewogenste gewählt ({min(total)}–{max(total)} Sätze je Übung)')

    per_week, (hart, auftritte, worst) = spread(total, vol, weeks, rnd,
                                                RESTARTS, SPREAD_ROUNDS)
    # Eine Abweichung über MAX_REL ist die eine Sache, die nicht vorkommen soll.
    # Bleibt nach dem ersten Anlauf eine stehen, wird weitergesucht statt sie
    # hinzunehmen: die Verteilung ist eine Suche, kein Beweis, und ein zweiter
    # Anlauf mit anderem Zufall findet sie oft doch. Erst nach mehreren
    # vergeblichen Versuchen gilt es als Eigenschaft der Plansummen.
    for _ in range(3):
        if not hart:
            break
        kandidat = spread(total, vol, weeks, rnd, RESTARTS, SPREAD_ROUNDS)
        if kandidat[1][0] < hart:
            per_week, (hart, auftritte, worst) = kandidat
            print(f'   nochmal verteilt: {hart} Gruppenwochen über {MAX_REL:.0%}')
    print(f'auf {weeks} Wochen verteilt: {auftritte} Auftritte '
          f'({auftritte / (weeks * WEEK):.2f} Übungen je Einheit), '
          f'schlechteste Woche {worst:.0%} vom Ziel entfernt, '
          f'{hart} Gruppenwochen über {MAX_REL:.0%}')

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
        eng_prev = prev if eng_am_anfang else frozenset()
        sess_list, direkt, konflikte = split(w, ids, shares, groups, WEEK, rnd, SPLITS, used,
                                             tight, eng_prev, roles)
        # Ging es nicht auf, kostet ein zweiter Anlauf nur für diese eine Woche
        # ein paar Sekunden – und die Erholungsbedingung ist der Punkt, an dem
        # der ganze Plan hängt. Vorher fiel sie hier still weg: bei zehn Sätzen
        # je Gruppe fand die erste Runde immer eine Lösung, bei sechzehn in zwei
        # von zwanzig Wochen nicht mehr, und im Plan standen zwei Übergänge mit
        # derselben Gruppe an zwei Tagen hintereinander.
        for faktor in (8, 40):
            if not konflikte:
                break
            sess_list, direkt, konflikte = split(w, ids, shares, groups, WEEK, rnd,
                                                 SPLITS * faktor, used, tight, eng_prev, roles)
        offen += 1 if konflikte else 0
        prev = frozenset(direkt[-1])
        for d, sess in zip(block, sess_list):
            sess.sort(key=lambda x: rang(x[0]))
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
             else round(sum(v[groups.index(m)] for v in got) / weeks / UNIT, 4)
             for m in groups}
    # Welche davon Ziel sind und welche bloß Ergebnis, steht ausdrücklich dabei:
    # der Nacken lässt sich nicht setzen, und "exakt getroffen" darf für ihn
    # niemand behaupten – sein Wert ist, was aus den anderen Gleichungen fällt.
    ergebnis = sorted(m for m in groups if TARGET.get(m) is None)
    # Die Erholungsregel wandert ebenfalls mit: die App tauscht bei
    # Verletzungen Übungen aus und muss dabei dieselbe Schwelle einhalten wie
    # der Generator, sonst steht die Gruppe doch zweimal in 48 Stunden.
    OUT.write_text(json.dumps({'target': ziele, 'derived': ergebnis, 'cap': CAP,
                               'rest': {'days': REST_DAYS, 'direct': DIRECT},
                               'plan': plan},
                              ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    print(f'\n{OUT.relative_to(ROOT)} geschrieben')


if __name__ == '__main__':
    main()
