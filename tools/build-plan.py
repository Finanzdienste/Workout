#!/usr/bin/env python3
"""Verteilt die Übungen so auf die Trainingstage, dass jede Muskelgruppe ihr
Wochenziel trifft.

    python3 tools/build-plan.py            # schreibt tools/plan.json
    python3 tools/build-plan.py --report    # nur rechnen und zeigen

Der ursprüngliche Plan aus der Excel zog die Übungen praktisch zufällig: 55
verschiedene Zusammenstellungen in 57 Einheiten. Dabei kam die hintere Schulter
auf 0,5 Sätze pro Woche (Reverse Fly stand 4× im ganzen Plan), die Waden auf
10,2 aus zwei Übungen. Die Abwechslung war also nicht das Problem, die
Verteilung schon.

Gerechnet wird in zwei Schritten:

  1. Wie oft muss jede Übung vorkommen?  Kleinste Quadrate über die Anteile aus
     exercise-meta.json (`dbShares`), mit Unter- und Obergrenze, damit keine
     Übung verschwindet und keine in jeder Einheit steht.
  2. Daraus ein Kalender.  Jede Übung wird gleichmäßig über die Einheiten
     gestreut; von vielen Versuchen gewinnt der mit den meisten verschiedenen
     Zusammenstellungen und der kleinsten Lücke zwischen zwei Auftritten.

Die Anteile sind Schätzungen aus gängiger Trainingslehre, keine Messwerte: 1,0
heißt "dafür ist die Übung da", 0,5 "arbeitet spürbar mit". Wer sie anders
einschätzt, ändert exercise-meta.json und lässt neu rechnen.

Datum und Wiederholungen kommen unverändert aus der Excel – hier wird nur
bestimmt, welche Übung an welchem Tag steht.
"""

import collections
import datetime
import json
import pathlib
import random
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
META = ROOT / 'tools' / 'exercise-meta.json'
XLSX_DATES = ROOT / 'js' / 'data.js'
OUT = ROOT / 'tools' / 'plan.json'

TARGET = 10.0          # Sätze je Muskelgruppe und Woche
SETS = 3               # Sätze je Übung
LO, HI = 12, 52        # Auftritte je Übung: nie ganz raus, nie in jeder Einheit
SEEDS = 3000


def dates():
    """Trainingstage. Der Plan selbst wird hier neu gemischt, die Termine nicht."""
    import re
    src = XLSX_DATES.read_text(encoding='utf-8')
    plan = json.loads(re.search(r'export const PLAN = ([\s\S]*?);\n?$', src).group(1))
    return [w['date'] for w in plan]


def frequencies(shares, groups, weeks, sessions, slots):
    """Auftritte je Übung, so dass jede Gruppe möglichst nah an TARGET landet."""
    ids = list(shares)
    fair = slots / len(ids)
    n = {i: fair for i in ids}
    # Projizierter Gradientenabstieg: kleiner Schritt, danach zurück in die
    # Grenzen und auf die Zahl der Plätze normiert.
    for _ in range(60000):
        vol = {m: sum(n[i] * SETS * shares[i].get(m, 0) for i in ids) / weeks for m in groups}
        for i in ids:
            g = sum(2 * (vol[m] - TARGET) * SETS * shares[i].get(m, 0) / weeks for m in groups)
            g += 0.05 * 2 * (n[i] - fair) / fair      # leichte Bremse gegen Extreme
            n[i] = min(HI, max(LO, n[i] - 0.25 * g))
        scale = slots / sum(n.values())
        for i in ids:
            n[i] = min(HI, max(LO, n[i] * scale))

    cnt = {i: int(round(v)) for i, v in n.items()}
    while sum(cnt.values()) != slots:                 # Rundungsrest verteilen
        d = 1 if sum(cnt.values()) < slots else -1
        k = max(ids, key=lambda i: (n[i] - cnt[i]) * d)
        cnt[k] += d
    return cnt


def schedule(cnt, sessions, sizes):
    """Kalender: jede Übung gleichmäßig gestreut, möglichst viel Abwechslung."""
    best = None
    for seed in range(SEEDS):
        random.seed(seed)
        slots = [[] for _ in range(sessions)]
        ok = True
        for ex in sorted(cnt, key=lambda x: -cnt[x]):
            for k in range(cnt[ex]):
                want = int((k + random.random()) * sessions / cnt[ex]) % sessions
                for d in range(sessions):
                    hit = False
                    for j in ((want + d) % sessions, (want - d) % sessions):
                        if len(slots[j]) < sizes[j] and ex not in slots[j]:
                            slots[j].append(ex)
                            hit = True
                            break
                    if hit:
                        break
                else:
                    ok = False
            if not ok:
                break
        if not ok or any(len(x) != sizes[k] for k, x in enumerate(slots)):
            continue
        uniq = len({tuple(sorted(x)) for x in slots})
        gap = 0
        for ex in cnt:
            at = [k for k, x in enumerate(slots) if ex in x]
            gap = max(gap, max(at[i + 1] - at[i] for i in range(len(at) - 1)) if len(at) > 1 else sessions)
        score = (uniq, -gap)
        if best is None or score > best[0]:
            best = (score, [list(x) for x in slots])
    if best is None:
        sys.exit('Kein Kalender gefunden – Grenzen LO/HI prüfen.')
    return best


def main():
    meta = json.loads(META.read_text(encoding='utf-8'))
    shares = {k: v['dbShares'] for k, v in meta.items()}
    groups = sorted({m for sh in shares.values() for m in sh})

    day = dates()
    sessions = len(day)
    weeks = (datetime.date.fromisoformat(day[-1]) - datetime.date.fromisoformat(day[0])).days / 7

    # Wie viele Übungsplätze es insgesamt braucht, wird mitgesucht: zu wenige
    # und keine Gruppe erreicht ihr Ziel, zu viele und alle liegen darüber.
    best = None
    for slots in range(sessions * 7, sessions * 10, 5):
        cnt = frequencies(shares, groups, weeks, sessions, slots)
        vol = {m: sum(cnt[i] * SETS * shares[i].get(m, 0) for i in cnt) / weeks for m in groups}
        err = max(abs(vol[m] - TARGET) for m in groups)
        if best is None or err < best[0]:
            best = (err, slots, cnt, vol)
    err, slots, cnt, vol = best

    # Einheiten unterschiedlich groß, damit die Summe genau aufgeht
    base, extra = divmod(slots, sessions)
    sizes = [base] * sessions
    for k in range(extra):
        sizes[int(k * sessions / extra)] = base + 1

    (uniq, gap), plan = schedule(cnt, sessions, sizes)

    print(f'{sessions} Einheiten, {weeks:.1f} Wochen, {slots} Übungsplätze '
          f'({slots / sessions:.2f} je Einheit)')
    print(f'{uniq} verschiedene Zusammenstellungen, größte Lücke {-gap} Einheiten\n')
    print(f'{"Muskelgruppe":16s} {"Sätze/Woche":>12s}')
    for m in sorted(groups, key=lambda x: -vol[x]):
        print(f'{m:16s} {vol[m]:12.1f}')
    print(f'\ngrößte Abweichung von {TARGET:.0f}: {err:.2f} Sätze')

    if '--report' in sys.argv:
        return
    OUT.write_text(json.dumps(
        [{'date': d, 'ex': [{'id': x, 'sets': SETS} for x in sess]}
         for d, sess in zip(day, plan)], ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    print(f'\n{OUT.relative_to(ROOT)} geschrieben')


if __name__ == '__main__':
    main()
