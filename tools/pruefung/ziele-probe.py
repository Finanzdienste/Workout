#!/usr/bin/env python3
"""Taugt ein Zielsatz, bevor man eine halbe Stunde darauf wartet?

Ein voller Generatorlauf dauert lange, und fast alles davon entfällt auf das
Verteilen auf Wochen und Tage. Die beiden Fragen, an denen ein Zielsatz
tatsächlich scheitert, stehen aber schon nach Sekunden fest:

  1. **Geht es exakt auf?** Reine Teilbarkeit, siehe build-plan.py.
  2. **Wie viele *direkte* Sätze bekommt jede Gruppe?** Das ist die Frage
     hinter der Frequenz. Die Ziele zählen gewichtetes Volumen, also auch das
     Halten bei der Kniebeuge und das Mitziehen beim Rudern. Wie oft eine
     Gruppe in der Woche drankommt, hängt aber allein an den Sätzen, in denen
     sie gemeint ist – und weil ein Auftritt immer drei Sätze hat, ist das
     keine Faustregel, sondern eine Gleichung:

         Termine je Woche = direkte Sätze ÷ 3

     Für zwei Termine braucht es also sechs direkte Sätze, egal wie hoch das
     Ziel steht. Genau daran sind „Cut" im ersten Anlauf und „Kurz und knapp"
     über Monate gescheitert – ohne dass die exakte Rechnung etwas gemerkt
     hätte, denn die Ziele *waren* getroffen.

Das ist eine Abschätzung, keine Messung: Welche der exakten Lösungen der
Generator am Ende nimmt, entscheidet er nach dem Probeverteilen. Genommen wird
hier dieselbe Vorsortierung (die ausgewogenste zuerst), und das genügt, um
einen untauglichen Zielsatz zu erkennen, bevor er Rechenzeit kostet.

    python3 tools/pruefung/ziele-probe.py            # die eingetragenen Varianten
    python3 tools/pruefung/ziele-probe.py kurz cut   # nur diese
"""
import importlib.util
import json
import pathlib
import random
import sys

WURZEL = pathlib.Path(__file__).resolve().parent.parent
# Erst sichern, dann überschreiben: build-plan.py liest beim Laden sein eigenes
# sys.argv, um die Variante zu bestimmen. Ohne die Kopie wäre der Aufruf dieses
# Skripts nach dem Import verschwunden – und es liefe immer nur „standard".
ARGV = sys.argv[1:]
sys.argv = ['build-plan.py', 'standard']
spec = importlib.util.spec_from_file_location('bp', str(WURZEL / 'build-plan.py'))
bp = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bp)          # main() läuft nicht, steht hinter __main__

META = json.loads(bp.META.read_text(encoding='utf-8'))
SHARES = {k: v['dbShares'] for k, v in META.items()}
bp.BW_SHARES.update({k: v['bwShares'] for k, v in META.items()})
IDS = list(SHARES)
GRUPPEN = sorted({m for sh in SHARES.values() for m in sh})
NAMEN = {
    'chest': 'Brust', 'lats': 'Rücken', 'sideDelts': 'Schulter seitlich',
    'rearDelts': 'Schulter hinten', 'frontDelts': 'Schulter vorn', 'traps': 'Nacken',
    'biceps': 'Bizeps', 'triceps': 'Trizeps', 'abs': 'Bauch', 'glutes': 'Gesäß',
    'quads': 'Oberschenkel vorn', 'hamstringsHip': 'Beinbeuger (Hüfte)',
    'hamstringsKnee': 'Beinbeuger (Knie)', 'calves': 'Waden',
}


def ausgewogen(sol):
    """Die Vorsortierung des Generators: keine Übung auf null, dann eben."""
    mittel = sum(sol.values()) / len(sol)
    return (min(sol.values()) == 0, sum((v - mittel) ** 2 for v in sol.values()), sorted(sol.items()))


def rang(sol, block, wochen):
    """Die Auswahl des Generators, so weit sie ohne Probeverteilen geht.

    Der Generator entscheidet zwischen den exakten Lösungen erst, nachdem er
    jede probeweise auf Wochen verteilt hat – das ist der teure Teil. Die
    beiden Kriterien, die davorstehen, kosten nichts: keine Übung unter einem
    Satz pro Woche (knapp), keine Gruppe an einer einzigen Übung (klumpen).
    Sie allein trennen die brauchbaren Lösungen schon so gut, dass eine
    untaugliche Zielkombination hier auffällt.
    """
    knapp = sum(1 for v in sol.values() if v < wochen)
    return (knapp, bp.klumpen(sol, block, SHARES), ausgewogen(sol))


def probiere(ziele, wochen=range(21, 33), limit=bp.EXACT_LIMIT):
    """Erste Wochenzahl, in der alle Blöcke exakt aufgehen – plus die Lösung."""
    # Kopieren, bevor geleert wird: Die Variante „standard" trägt als Ziele
    # dasselbe Wörterbuch, das hier gerade geleert würde – ohne die Kopie
    # löscht sich der Zielsatz selbst, und die Probe rechnet gegen nichts.
    ziele = dict(ziele)
    bp.TARGET.clear()
    bp.TARGET.update(ziele)
    bp.GOAL.clear()
    bp.GOAL.update({m: (None if t is None else t * bp.UNIT) for m, t in ziele.items()})
    for w in wochen:
        rnd = random.Random(7)
        werte = [0] + [v for v in range(bp.PER_EX_WEEK[0] * w, bp.PER_EX_WEEK[1] * w + 1)
                       if v % bp.GRAIN == 0]
        gesamt = {}
        for block in bp.parts(IDS, SHARES, GRUPPEN):
            gefunden = bp.exact(block, SHARES, w, werte, limit, rnd)
            if not gefunden:
                gesamt = None
                break
            gefunden.sort(key=lambda s: rang(s, block, w))
            gesamt.update(gefunden[0])
        if gesamt is not None:
            return w, gesamt
    return None, None


def direkt_je_woche(sol, wochen):
    """Sätze, in denen die Gruppe gemeint ist (Anteil ab 0,5), je Woche."""
    out = {m: 0.0 for m in GRUPPEN}
    for i, n in sol.items():
        for m, anteil in SHARES[i].items():
            if anteil >= 0.5:
                out[m] += n / wochen
    return out


def urteile(ziele, sol, wochen):
    """Was an diesem Zielsatz auffällt."""
    direkt = direkt_je_woche(sol, wochen)
    befunde = []
    for m in GRUPPEN:
        d = direkt[m]
        # Ziellose Gruppen leben ohnehin von dem, was nebenbei anfällt.
        if ziele.get(m) is None:
            continue
        # An den fertigen Plänen nachgemessen ist der Zusammenhang keine
        # Faustregel, sondern eine Gleichung: **Termine je Woche = direkte
        # Sätze ÷ 3.** Bei festen Dreiersätzen kann es gar nicht anders sein.
        # Über alle sechs Varianten und vierzehn Gruppen stimmt es auf zwei
        # Nachkommastellen – 3,0 direkte Sätze ergeben 1,00 Termine, 4,4
        # ergeben 1,48, 5,9 ergeben 1,95, 8,1 ergeben 2,24.
        termine = d / bp.PER_SET[1]
        if termine < 0.98:
            befunde.append(f'{NAMEN.get(m, m)}: {d:.1f} direkte Sätze/Woche = nur '
                           f'{termine:.2f} Termine – nicht einmal jede Woche')
        elif termine < 1.95:
            befunde.append(f'{NAMEN.get(m, m)}: {d:.1f} direkte Sätze/Woche = '
                           f'{termine:.2f} Termine statt zwei')
    leer = sorted(i for i, n in sol.items() if not n)
    for i in leer:
        befunde.append(f'{i}: null Sätze, fällt aus dem Plan')
    return direkt, befunde


def zeige(name, ziele, ausfuehrlich=False):
    wochen, sol = probiere(ziele)
    if not wochen:
        print(f'{name:<22} KEINE exakte Lösung zwischen 21 und 32 Wochen')
        return False
    direkt, befunde = urteile(ziele, sol, wochen)
    print(f'{name:<22} geht ab {wochen} Wochen'
          + ('' if befunde else '  – nichts auffällig'))
    for b in befunde:
        print(f'{"":<22}   {b}')
    if ausfuehrlich:
        for m in GRUPPEN:
            z = ziele.get(m)
            print(f'{"":<22}   {NAMEN.get(m, m):<22}'
                  f'{("Ziel " + str(z)) if z is not None else "ohne Ziel":<12}'
                  f'{direkt[m]:>6.1f} direkt/Woche')
    return not befunde


if __name__ == '__main__':
    wunsch = [a for a in ARGV if not a.startswith('-')]
    lang = '--lang' in ARGV
    varianten = wunsch or list(bp.VARIANTEN)
    gut = True
    for v in varianten:
        if v not in bp.VARIANTEN:
            print(f'Unbekannte Variante {v!r} – bekannt: {", ".join(bp.VARIANTEN)}')
            sys.exit(2)
        gut &= zeige(bp.VARIANTEN[v]['name'], bp.VARIANTEN[v]['ziele'], lang)
    sys.exit(0 if gut else 1)
