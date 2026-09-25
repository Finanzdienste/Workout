#!/usr/bin/env python3
"""Ein ausgewogener Startpunkt für tools/build-plan.py, ganzzahlig gelöst.

    python3 tools/pruefung/startpunkt.py cut          # schreibt tools/pruefung/cut-start.json
    WK_START=tools/pruefung/cut-start.json python3 tools/build-plan.py cut

Braucht numpy und scipy (pip install scipy). Kein Tor, kein Schritt der CI –
ein Werkzeug für den Neulauf einer Variante, einmal vorher.

**Worum es geht.** build-plan.py rechnet die Plansummen je Übung exakt aus den
Zielen (totals()). Es beginnt an einem Partikulärpunkt der Gleichungen und
wandert von dort durch den Nullraum zu ganzzahligen Lösungen. Der Weg findet,
was nahe am Start liegt – und der Start ist Arithmetik, kein Trainingsplan. Beim
Cut mit fünf Pflichtübungen war die erste Lösung exakt und schief: sechs Sätze
Waden die Woche, null Trizeps.

Hier stellt ein ganzzahliger Löser (scipy.optimize.milp) dieselben Gleichungen
und sucht unter allen Lösungen die ausgewogenste:

  * jede Gruppe mit Ziel exakt getroffen, die abgeleiteten unter der Kappe,
  * jede Übung entweder draußen oder mit PER_EX_WEEK Sätzen je Woche,
  * die Pflichtübungen mit ihrem Minimum (PFLICHT aus build-plan.py),
  * und als Maß: möglichst viele Übungen drin, jede möglichst nah an drei
    Sätzen je Woche. Band, Rucksack (außer an der Klimmzugstange) und reine
    Körpergewichtsübungen zählen dabei als zweite Wahl, weil Hanteln und
    Stange im Haus sind:

        „Ists normal dass ich so viele Übungen mit Rucksack und Flaschen usw
         machen soll obwohl ich ja ne komplette hantelausrüstung usw hab?"

    Ausgenommen sind die Übungen, für die es keine Hantelfassung gibt.

Das Ergebnis ist kein Plan, sondern ein Startpunkt: {Übung: Sätze über den
ganzen Plan}. Von ihm aus läuft wandern() in build-plan.py (WK_START) und
verteilt danach auf Wochen und Tage wie immer. Der Startpunkt des Cut vom
25.09. liegt als cut-start.json daneben – damit der Lauf nachvollziehbar
bleibt, nicht nur sein Ergebnis.
"""
import importlib.util
import json
import pathlib
import sys

import numpy as np
from scipy.optimize import Bounds, LinearConstraint, milp

ROOT = pathlib.Path(__file__).resolve().parent.parent.parent


def lade_generator(variante):
    """tools/build-plan.py als Modul, mit seinen Konstanten für diese Variante."""
    sys.argv = ['build-plan.py', variante]
    spec = importlib.util.spec_from_file_location('bp', ROOT / 'tools' / 'build-plan.py')
    bp = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(bp)
    return bp


def zweite_wahl(meta, ids):
    """Übungen, die mit Hanteln im Haus nur die zweite Wahl sind."""
    raus = set()
    for i in ids:
        equip = meta[i].get('equip')
        if equip in ('band', None):
            raus.add(i)
        elif equip == 'backpack' and 'Klimmzugstange' not in meta[i].get('dbEquip', ''):
            raus.add(i)
    # Dafür gibt es keine Hantelfassung – sie sind nicht zweite Wahl, sondern die einzige.
    return raus - {'haengendes-knieheben', 'sliding-leg-curl', 'einbeiniger-sliding-leg-curl'}


def main():
    variante = sys.argv[1] if len(sys.argv) > 1 else 'cut'
    bp = lade_generator(variante)
    meta = json.loads(bp.META.read_text(encoding='utf-8'))
    shares = {k: v['dbShares'] for k, v in meta.items()}
    ids = [k for k in shares if not meta[k].get('nurErsatz')]
    groups = sorted({m for sh in shares.values() for m in sh})
    weeks, g, n = bp.WEEKS, bp.GRAIN, len(ids)
    lo, hi = bp.PER_EX_WEEK[0] * weeks // g, bp.PER_EX_WEEK[1] * weeks // g
    soll = 3 * weeks // g

    # Je Übung drei Unbekannte: y Sätze (in Körnung g) über den Plan, b drin
    # oder nicht, d der Abstand von drei Sätzen je Woche.
    N = 3 * n
    A, lb, ub = [], [], []
    for m in groups:
        row = [round(shares[i].get(m, 0) * bp.UNIT) * g for i in ids] + [0] * (2 * n)
        ziel = bp.GOAL.get(m)
        A.append(row)
        lb.append(ziel * weeks if ziel is not None else 0)
        ub.append(ziel * weeks if ziel is not None else bp.CAP_U * weeks)
    for k in range(n):
        r = [0] * N; r[k] = 1; r[n + k] = -lo
        A.append(r); lb.append(0); ub.append(np.inf)            # drin → mindestens lo
        r = [0] * N; r[k] = 1; r[n + k] = -hi
        A.append(r); lb.append(-np.inf); ub.append(0)           # draußen → 0, drin → höchstens hi
        r = [0] * N; r[k] = 1; r[2 * n + k] = -1
        A.append(r); lb.append(-np.inf); ub.append(soll)        # d ≥ y − soll
        r = [0] * N; r[k] = 1; r[2 * n + k] = 1; r[n + k] = -soll
        A.append(r); lb.append(0); ub.append(np.inf)            # d ≥ soll − y, wenn drin

    pflicht = bp.PFLICHT
    lower = ([(pflicht.get(i, 0) * weeks + g - 1) // g for i in ids]
             + [1 if i in pflicht else 0 for i in ids] + [0] * n)
    upper = [hi] * n + [1] * n + [np.inf] * n

    zweite = zweite_wahl(meta, ids)
    print('zweite Wahl:', ', '.join(sorted(zweite)))
    # Jede Übung drin ist einen halben Wochen-Sollwert wert, die zweite Wahl nur
    # ein Zehntel; jeder Satz Abstand vom Soll kostet eins.
    c = np.array([0] * n + [(-0.5 + (0.4 if i in zweite else 0)) * soll for i in ids] + [1] * n, float)
    r = milp(c=c, constraints=LinearConstraint(np.array(A, float), lb, ub),
             integrality=np.array([1] * (2 * n) + [0] * n), bounds=Bounds(lower, upper),
             options={'time_limit': 240})
    print(r.status, r.message)
    if r.status != 0:
        return 1
    start = {i: int(round(r.x[k])) * g for k, i in enumerate(ids)}
    ziel = ROOT / 'tools' / 'pruefung' / f'{variante}-start.json'
    ziel.write_text(json.dumps(start) + '\n', encoding='utf-8')
    for i, v in sorted(start.items(), key=lambda x: -x[1]):
        if v:
            print(f'{i:34s} {v:4d} {v / weeks:5.2f}')
    print(f'{ziel.relative_to(ROOT)} geschrieben – als WK_START an tools/build-plan.py {variante}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
