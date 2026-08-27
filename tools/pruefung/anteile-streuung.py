#!/usr/bin/env python3
"""Was ist „exakt gelöst" wert, wenn die Anteile geschätzt sind?

Der Generator trifft jedes Wochenziel exakt. Er trifft es aber exakt *unter der
Annahme*, dass ein Goblet Squat zu 1,0 auf den Oberschenkel, zu 0,55 auf das
Gesäß und zu 0,35 auf den Bauch geht. Diese Zahlen sind Schätzungen aus
gängiger Trainingslehre, keine Messwerte – im Kopf von build-plan.py steht das
auch so. Damit steht die ganze exakte Rechnerei auf Koeffizienten mit
erheblichem Spielraum, und die Frage ist nicht rhetorisch: Wie viel Präzision
darf man einem Plan zuschreiben, dessen Eingangsgrößen um ein Drittel daneben
liegen können?

Zwei Fragen, die man auseinanderhalten muss:

  **A. Wie falsch ist der Plan, den ich trainiere?**  Der ausgelieferte Plan
  bleibt, wie er ist – nur die Anteile werden gestört. Was bekommt die Brust
  dann wirklich, wenn statt 10,00 eben 9,3 oder 10,8 herauskommt? Das ist die
  Frage, die zählt, wenn jemand wissen will, wie ernst er die 10 nehmen soll.
  Kostet nichts, deshalb viele Läufe.

  **B. Würde ich anders trainieren?**  Hier wird mit den gestörten Anteilen neu
  *gerechnet* – kommen andere Satzzahlen je Übung heraus? Wenn der Plan
  praktisch derselbe bleibt, ist die Unsicherheit in den Anteilen für die
  Trainingsentscheidung folgenlos, so groß sie in der Zahl auch aussieht. Ein
  Lauf dauert ein bis zwei Minuten, deshalb wenige.

    python3 tools/pruefung/anteile-streuung.py                 # nur A, 2000 Läufe
    python3 tools/pruefung/anteile-streuung.py --neu 20        # zusätzlich B
    python3 tools/pruefung/anteile-streuung.py --streuung 0.5  # ±50 % statt ±30 %
"""
import importlib.util
import json
import pathlib
import random
import statistics
import sys

WURZEL = pathlib.Path(__file__).resolve().parent.parent
ROOT = WURZEL.parent
ARGV = sys.argv[1:]
sys.argv = ['build-plan.py', 'standard']
spec = importlib.util.spec_from_file_location('bp', str(WURZEL / 'build-plan.py'))
bp = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bp)

META = json.loads(bp.META.read_text(encoding='utf-8'))
ECHT = {k: dict(v['dbShares']) for k, v in META.items()}
bp.BW_SHARES.update({k: v['bwShares'] for k, v in META.items()})
GRUPPEN = sorted({m for sh in ECHT.values() for m in sh})
WEEK = 4
NAMEN = {
    'chest': 'Brust', 'lats': 'Rücken', 'sideDelts': 'Schulter seitlich',
    'rearDelts': 'Schulter hinten', 'frontDelts': 'Schulter vorn', 'traps': 'Nacken',
    'biceps': 'Bizeps', 'triceps': 'Trizeps', 'abs': 'Bauch', 'glutes': 'Gesäß',
    'quads': 'Oberschenkel vorn', 'hamstringsHip': 'Beinbeuger (Hüfte)',
    'hamstringsKnee': 'Beinbeuger (Knie)', 'calves': 'Waden',
}


def wert(argument, standard):
    return type(standard)(ARGV[ARGV.index(argument) + 1]) if argument in ARGV else standard


STREUUNG = wert('--streuung', 0.3)
LAEUFE = wert('--laeufe', 2000)
NEU = wert('--neu', 0)


def stoere(rnd):
    """Jeden Anteil unabhängig um bis zu ±STREUUNG verschieben.

    Unabhängig, nicht gemeinsam: Ein gemeinsamer Faktor würde alle Ziele
    gleichmäßig verschieben und ließe die *Verteilung* unberührt – gerade sie
    ist aber das, was der Generator entscheidet. Die 1,0 bleibt eine 1,0: Sie
    heißt „dafür ist die Übung da" und ist damit Festlegung, keine Schätzung.
    """
    out = {}
    for i, sh in ECHT.items():
        out[i] = {m: (v if v >= 1.0 else max(0.05, v * (1 + rnd.uniform(-STREUUNG, STREUUNG))))
                  for m, v in sh.items()}
    return out


# --------------------------------------------------------------------- #
# A. Der ausgelieferte Plan unter gestörten Anteilen
# --------------------------------------------------------------------- #

def teil_a():
    plan = json.load(open(ROOT / 'tools' / 'plan.json'))
    ziele = plan['target']
    wochen = len(plan['plan']) // WEEK

    def volumen(shares):
        summe = {m: 0.0 for m in GRUPPEN}
        for e in plan['plan']:
            for it in e['ex']:
                for m, anteil in shares[it['id']].items():
                    summe[m] += it['sets'] * anteil
        return {m: v / wochen for m, v in summe.items()}

    soll = volumen(ECHT)
    rnd = random.Random(20260827)
    proben = {m: [] for m in GRUPPEN}
    for _ in range(LAEUFE):
        got = volumen(stoere(rnd))
        for m in GRUPPEN:
            proben[m].append(got[m])

    print(f'A. Der ausgelieferte Plan, {LAEUFE} mal mit gestörten Anteilen nachgerechnet')
    print(f'   (jeder Anteil unter 1,0 unabhängig um bis zu ±{STREUUNG:.0%})\n')
    print(f'{"Gruppe":<22}{"Ziel":>6}{"gerechnet":>11}{"5 %":>8}{"95 %":>8}{"Spanne":>9}')
    print('-' * 66)
    schlimmste = 0.0
    for m in GRUPPEN:
        v = sorted(proben[m])
        u, o = v[int(0.05 * len(v))], v[int(0.95 * len(v)) - 1]
        ziel = ziele.get(m)
        rel = (o - u) / soll[m] if soll[m] else 0
        schlimmste = max(schlimmste, rel)
        print(f'{NAMEN.get(m, m):<22}{(f"{ziel:.0f}" if ziel is not None else "–"):>6}'
              f'{soll[m]:>11.2f}{u:>8.2f}{o:>8.2f}{rel:>8.0%}')
    print(f'\n   Größte Spanne über alle Gruppen: {schlimmste:.0%} des Sollwerts.')
    return schlimmste


# --------------------------------------------------------------------- #
# B. Neu gerechnet mit gestörten Anteilen
# --------------------------------------------------------------------- #

def loese(shares, wochen=21):
    """Satzzahl je Übung über den ganzen Plan – dieselbe Auswahl wie im Generator,
    ohne das teure Probeverteilen."""
    ids = list(shares)
    werte = [0] + [v for v in range(bp.PER_EX_WEEK[0] * wochen, bp.PER_EX_WEEK[1] * wochen + 1)
                   if v % bp.GRAIN == 0]
    rnd = random.Random(7)
    gesamt = {}
    for block in bp.parts(ids, shares, GRUPPEN):
        gefunden = bp.exact(block, shares, wochen, werte, bp.EXACT_LIMIT, rnd)
        if not gefunden:
            return None
        def rang(sol):
            mittel = sum(sol.values()) / len(sol)
            return (sum(1 for v in sol.values() if v < wochen),
                    bp.klumpen(sol, block, shares),
                    min(sol.values()) == 0,
                    sum((v - mittel) ** 2 for v in sol.values()),
                    sorted(sol.items()))
        gefunden.sort(key=rang)
        gesamt.update(gefunden[0])
    return gesamt


def teil_b(laeufe):
    wochen = 21
    basis = loese(ECHT, wochen)
    if basis is None:
        print('\nB. Übersprungen: schon die ungestörte Rechnung geht nicht auf.')
        return
    print(f'\nB. {laeufe} mal neu gerechnet, jedes Mal mit anderen gestörten Anteilen')
    print('   (Satzzahl je Übung und Woche, verglichen mit der echten Rechnung)\n')
    rnd = random.Random(4711)
    abweichung, groesste, unloesbar, raus = [], [], 0, set()
    for k in range(laeufe):
        sol = loese(stoere(rnd), wochen)
        if sol is None:
            unloesbar += 1
            continue
        diff = {i: abs(sol[i] - basis[i]) / wochen for i in basis}
        abweichung.append(statistics.mean(diff.values()))
        groesste.append(max(diff.values()))
        raus |= {i for i, n in sol.items() if not n and basis[i]}
        print(f'   Lauf {k + 1:>2}: Ø {abweichung[-1]:.2f}, größte {groesste[-1]:.2f} '
              f'Sätze/Woche Unterschied', flush=True)
    if not abweichung:
        print('   keine einzige Störung war lösbar')
        return
    print(f'\n   Ø Unterschied je Übung: {statistics.mean(abweichung):.2f} Sätze/Woche')
    print(f'   Größter Unterschied in einem Lauf: {max(groesste):.2f} Sätze/Woche')
    if unloesbar:
        print(f'   {unloesbar} von {laeufe} Störungen gingen gar nicht exakt auf.')
    if raus:
        print(f'   Übungen, die in mindestens einer Störung ganz herausfielen: {", ".join(sorted(raus))}')
    else:
        print('   Keine Übung fiel in irgendeiner Störung ganz heraus.')


if __name__ == '__main__':
    teil_a()
    if NEU:
        teil_b(NEU)
