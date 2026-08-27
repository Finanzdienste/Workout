#!/usr/bin/env python3
"""Prüft die ausgelieferten Pläne – als Tor, nicht als Bericht.

    python3 tools/pruefung/plan-pruefen.py              # prüfen, Rückgabewert 0 oder 1
    python3 tools/pruefung/plan-pruefen.py --bericht    # zusätzlich die Zahlen zeigen
    python3 tools/pruefung/plan-pruefen.py --schreiben  # den Vergleichsstand neu setzen

Warum überhaupt: Die Zielrechnung im Generator prüft sich selbst und bricht ab,
wenn ein Ziel nicht exakt aufgeht. Was sie *nicht* prüft, ist das, woran der
Plan in der Praxis kaputtgeht – eine Übung, die auf null Sätze fällt, eine
Muskelgruppe, die nur noch einmal die Woche drankommt, zwei Wochen Pause
zwischen zwei Reizen. „Kurz und knapp" hatte alle drei, monatelang, ohne dass
irgendetwas Alarm geschlagen hätte.

Zwei Arten von Regel, weil die Sache zwei Arten von Fehler kennt:

  **Feste Regeln** gelten immer und ohne Ermessen. Ein Ziel, das im Schnitt
  nicht getroffen wird, ist ein Fehler. Eine ziellose Gruppe über der
  Obergrenze ist ein Fehler. Zwei direkte Reize derselben Gruppe an
  aufeinanderfolgenden Tagen sind ein Fehler – 48 Stunden Erholung sind die
  Zusage, auf der die ganze Tagesverteilung steht.

  **Ein Vergleichsstand** für alles, wo es kein sauberes Ja/Nein gibt.
  Frequenz, größter Abstand, ausgefallene Übungen: Was heute im Plan steht, ist
  in befunde.json festgehalten, und das Tor schlägt an, wenn es *schlechter*
  wird. Kein erfundener Schwellenwert, sondern die Frage, die zählt: Habe ich
  gerade etwas verschlimmert?

  Der Vergleichsstand hält also fest, wie gut die Pläne sind – nicht, wie gut
  sie sein sollten. Wer eine Zahl darin schlecht findet, verbessert den Plan
  und schreibt ihn neu, statt die Regel zu lockern.
"""
import collections
import datetime
import json
import pathlib
import statistics
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
META = json.load(open(ROOT / 'tools' / 'exercise-meta.json'))
STAND = pathlib.Path(__file__).resolve().parent / 'befunde.json'

VARIANTEN = ['standard', 'bbp', 'oberkoerper', 'kurz', 'beine', 'cut']
MODI = ['db', 'bw']
WEEK = 4
REST_DAYS = 2

NAMEN = {
    'chest': 'Brust', 'lats': 'Rücken', 'sideDelts': 'Schulter seitlich',
    'rearDelts': 'Schulter hinten', 'frontDelts': 'Schulter vorn', 'traps': 'Nacken',
    'biceps': 'Bizeps', 'triceps': 'Trizeps', 'abs': 'Bauch', 'glutes': 'Gesäß',
    'quads': 'Oberschenkel vorn', 'hamstringsHip': 'Beinbeuger (Hüfte)',
    'hamstringsKnee': 'Beinbeuger (Knie)', 'calves': 'Waden',
}


def pfad(variante):
    return ROOT / 'tools' / ('plan.json' if variante == 'standard' else f'plan-{variante}.json')


def messen(variante, modus):
    """Alles, was sich am fertigen Plan nachrechnen lässt."""
    p = json.load(open(pfad(variante)))
    plan, ziele, cap = p['plan'], p['target'], p['cap']
    schluessel = f'{modus}Shares'
    gruppen = sorted({m for e in META.values() for m in e.get(schluessel, {})})

    wochen = [plan[i:i + WEEK] for i in range(0, len(plan), WEEK)]
    volumen = {m: [] for m in gruppen}
    direkt = {m: [] for m in gruppen}
    frequenz = {m: [] for m in gruppen}
    for w in wochen:
        summe, dir_, tage = collections.Counter(), collections.Counter(), collections.defaultdict(set)
        for tag, e in enumerate(w):
            for it in e['ex']:
                for m, anteil in META[it['id']].get(schluessel, {}).items():
                    summe[m] += it['sets'] * anteil
                    if anteil >= 0.5:
                        dir_[m] += it['sets']
                        tage[m].add(tag)
        for m in gruppen:
            volumen[m].append(summe[m])
            direkt[m].append(dir_[m])
            frequenz[m].append(len(tage[m]))

    # Abstände zwischen zwei direkten Reizen derselben Gruppe.
    abstand = {}
    for m in gruppen:
        tage = [datetime.date.fromisoformat(e['date']) for e in plan
                if any(META[it['id']].get(schluessel, {}).get(m, 0) >= 0.5 for it in e['ex'])]
        ab = [(b - a).days for a, b in zip(tage, tage[1:])]
        abstand[m] = (min(ab), max(ab)) if ab else (None, None)

    saetze = collections.Counter()
    for e in plan:
        for it in e['ex']:
            saetze[it['id']] += it['sets']

    return {
        'wochen': len(wochen), 'ziele': ziele, 'cap': cap, 'gruppen': gruppen,
        'schnitt': {m: statistics.mean(volumen[m]) for m in gruppen},
        'direkt': {m: statistics.mean(direkt[m]) for m in gruppen},
        'frequenz': {m: statistics.mean(frequenz[m]) for m in gruppen},
        'abstand': abstand,
        'ohne_saetze': sorted(i for i in META if not saetze[i]),
    }


def feste_regeln(v, modus, m):
    """Was immer gilt, unabhängig von jedem Vergleichsstand."""
    fehler = []
    for g in m['gruppen']:
        ziel = m['ziele'].get(g)
        schnitt = m['schnitt'][g]
        name = NAMEN.get(g, g)
        # Im Bodyweight-Modus sind die Anteile andere; die Ziele gelten für den
        # gerechneten Modus. Siehe README, „Der Bodyweight-Modus trifft
        # dieselben Ziele nicht ganz".
        if modus == 'db':
            if ziel is not None and abs(schnitt - ziel) > 0.05:
                fehler.append(f'{name}: Ziel {ziel} im Schnitt verfehlt ({schnitt:+.2f} → {schnitt:.2f})')
            if ziel is None and schnitt > m['cap'] + 0.05:
                fehler.append(f'{name}: ohne Ziel über der Obergrenze ({schnitt:.2f} > {m["cap"]})')
        klein, _ = m['abstand'][g]
        if klein is not None and klein < REST_DAYS:
            fehler.append(f'{name}: nur {klein} Tag(e) zwischen zwei direkten Reizen')
    return fehler


def weiche_werte(m):
    """Die Zahlen, die gegen den Vergleichsstand laufen."""
    return {
        'frequenz': {g: round(m['frequenz'][g], 2) for g in m['gruppen']},
        'abstand_max': {g: m['abstand'][g][1] for g in m['gruppen']},
        'ohne_saetze': m['ohne_saetze'],
    }


def vergleiche(alt, neu):
    """Ist etwas schlechter geworden als beim letzten festgehaltenen Stand?"""
    fehler = []
    for g, wert in neu['frequenz'].items():
        vorher = alt.get('frequenz', {}).get(g)
        if vorher is not None and wert < vorher - 0.05:
            fehler.append(f'{NAMEN.get(g, g)}: Frequenz gefallen ({vorher} → {wert} ×/Woche)')
    for g, wert in neu['abstand_max'].items():
        vorher = alt.get('abstand_max', {}).get(g)
        if vorher is not None and wert is not None and wert > vorher:
            fehler.append(f'{NAMEN.get(g, g)}: größter Abstand gewachsen ({vorher} → {wert} Tage)')
    neue = set(neu['ohne_saetze']) - set(alt.get('ohne_saetze', []))
    for i in sorted(neue):
        fehler.append(f'{i}: fällt neuerdings ganz aus dem Plan')
    return fehler


def bericht(v, modus, m):
    print(f'\n=== {v} / {modus} · {m["wochen"]} Wochen ===')
    print(f'{"Gruppe":<22}{"Ziel":>6}{"Ø":>7}{"direkt":>8}{"Freq":>7}{"Abstand":>10}')
    for g in m['gruppen']:
        ziel = m['ziele'].get(g)
        klein, gross = m['abstand'][g]
        spanne = f'{klein}–{gross}d' if klein is not None else '–'
        print(f'{NAMEN.get(g, g):<22}{(f"{ziel:.0f}" if ziel is not None else "–"):>6}'
              f'{m["schnitt"][g]:>7.2f}{m["direkt"][g]:>8.1f}{m["frequenz"][g]:>7.2f}{spanne:>10}')
    if m['ohne_saetze']:
        print('nicht im Plan:', ', '.join(m['ohne_saetze']))


def main():
    zeigen = '--bericht' in sys.argv
    schreiben = '--schreiben' in sys.argv
    alt = json.loads(STAND.read_text()) if STAND.exists() else {}
    neu, fehler = {}, []

    for v in VARIANTEN:
        if not pfad(v).exists():
            fehler.append(f'{v}: {pfad(v).name} fehlt')
            continue
        for modus in MODI:
            m = messen(v, modus)
            if zeigen:
                bericht(v, modus, m)
            schluessel = f'{v}/{modus}'
            neu[schluessel] = weiche_werte(m)
            for f in feste_regeln(v, modus, m):
                fehler.append(f'{schluessel} · {f}')
            if not schreiben:
                for f in vergleiche(alt.get(schluessel, {}), neu[schluessel]):
                    fehler.append(f'{schluessel} · {f}')

    if schreiben:
        STAND.write_text(json.dumps(neu, indent=1, ensure_ascii=False, sort_keys=True) + '\n')
        print(f'Vergleichsstand geschrieben: {STAND.relative_to(ROOT)} '
              f'({len(neu)} Plan/Modus-Kombinationen)')

    if fehler:
        print(f'\n{len(fehler)} Befund(e):')
        for f in fehler:
            print(f'  {f}')
        return 1
    print(f'\n{len(VARIANTEN)} Pläne × {len(MODI)} Modi: alle Ziele exakt, '
          f'48 Stunden Erholung eingehalten, nichts schlechter als zuletzt.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
