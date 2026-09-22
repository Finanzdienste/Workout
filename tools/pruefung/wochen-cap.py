"""Bleibt jede einzelne Woche unter der Obergrenze – und wenn nicht, wie weit darüber?

    python3 tools/pruefung/wochen-cap.py            # alle vier Varianten
    python3 tools/pruefung/wochen-cap.py cut        # nur eine

**Warum es diese Prüfung gibt.** Die Obergrenze stand jahrelang nur im
Generator, und dort nur als *Durchschnitt*: capped() prüft die Plansumme gegen
CAP × Wochen. Ob eine einzelne Woche darüber liegt, hat nie jemand nachgesehen –
und der Plan wird nicht im Schnitt trainiert, sondern Woche für Woche.

Nachgemessen sah das so aus (Aufbau, Bodyweight, vor v186):

    vordere Schulter   bis 13,90 bei Grenze 10, in 7 von 21 Wochen
    Brust              bis 13,00 bei Grenze 10, in 8 von 21 Wochen
    Gesäß (bbp)        bis 16,35 bei Grenze 12, in 21 von 21 Wochen

Der letzte Fall war ein Widerspruch in den Vorgaben und ist behoben – im
Bauch-Beine-Po-Plan steht das Gesäß auf Ziel 15 bei Grenze 12, und eine Grenze
unter dem eigenen Ziel ist keine. Sie liegt jetzt für jede Gruppe bei
mindestens ihrem Ziel (CAP_FUER in tools/build-plan.py).

**Was bleibt, ist die Körnung, und die ist echt.** Brust, Rücken, Bizeps und
Trizeps stehen im Aufbau-Plan alle auf Ziel 10 bei Grenze 10. Der Schnitt muss
also exakt 10,00 treffen, und gearbeitet wird in Dreiersätzen: Jede Woche
*genau* 10 ist damit unmöglich, es gibt nur 9 und 12. Wer über dem Schnitt
liegen muss, um ihn zu treffen, liegt zwangsläufig auch über der Grenze. Eine
Prüfung, die null verlangt, wäre deshalb keine Prüfung, sondern ein Verbot des
Plans.

Gefordert wird darum eine *Schranke*, kein Nullwert – und sie steht unten als
Zahl, die der ausgelieferte Plan einhält. Rückt ein neuer Plan darüber, ist das
eine Verschlechterung und muss auffallen.

**Abgrenzung zu plan-pruefen.py.** Das dortige `woche_max` hält ebenfalls die
stärkste Woche je Gruppe fest – aber gegen den *Vergleichsstand*, also gegen
den letzten Plan, nicht gegen die Obergrenze. Es schlägt an, wenn ein neuer
Plan schlechter wird als der alte; es hätte nie gemeldet, dass die vordere
Schulter seit jeher 39 % über ihrer Grenze liegt. Beides ist nötig, und keins
ersetzt das andere.
"""
import collections
import json
import pathlib
import sys

WURZEL = pathlib.Path(__file__).resolve().parent.parent
META = json.loads((WURZEL / 'exercise-meta.json').read_text(encoding='utf-8'))

DATEIEN = {
    'standard': 'plan.json',
    'cut': 'plan-cut.json',
    'bbp': 'plan-bbp.json',
    'oberkoerper': 'plan-oberkoerper.json',
}

# Wie weit eine einzelne Woche über ihrer Grenze liegen darf, in Sätzen.
#
# Die Zahl ist gemessen und nicht gesetzt: Sie ist der schlechteste Wert, den
# die *ausgelieferten* Pläne erreichen – 3,90 bei der vorderen Schulter im
# Bodyweight-Modus des Aufbau-Plans –, aufgerundet. Sie ist keine Aussage
# darüber, was gesund ist; sie ist die Grenze, ab der ein neuer Plan schlechter
# wäre als der jetzige.
#
# **Sie bleibt vorerst so hoch, und der Grund ist gemessen.** Ein mit dem
# Gitterweg neu gerechneter Aufbau-Plan kommt auf +2,00 in beiden Modi – das
# rechnerische Optimum für Gruppen mit Ziel == Grenze (siehe Kopf). Der Preis
# dafür sind 108 Verschlechterungen an anderer Stelle: Frequenzen fallen,
# größte Abstände wachsen, bei der vorderen Schulter von 7 auf 19 Tage. Die
# neuen Pläne sind auf diese eine Zahl besser und auf alles andere schlechter,
# und deshalb bleiben die alten. Diese Schranke sinkt erst, wenn ein neuer Plan
# beides zugleich kann.
SCHRANKE = 4.0

# Und wie viele Gruppenwochen überhaupt darüber liegen dürfen, als Anteil.
# Auch das ein Messwert am ausgelieferten Stand (27 %); die neu gerechneten
# Pläne liegen bei 19 %.
ANTEIL = 0.30


def wochenwerte(plan, feld):
    """Volumen je Gruppe und Woche. Vier Einheiten sind eine Woche."""
    wochen = collections.defaultdict(lambda: collections.defaultdict(float))
    for i, e in enumerate(plan):
        w = i // 4
        for it in e['ex']:
            n = it.get('bwSets') if feld == 'bwShares' else it.get('sets')
            if not n:
                continue
            for m, v in META[it['id']][feld].items():
                wochen[w][m] += n * v
    return wochen


def pruefe(variante, datei):
    d = json.loads((WURZEL / datei).read_text(encoding='utf-8'))
    ziele = d['target']
    cap = d['cap']
    fehler = []
    for modus, feld in (('db', 'dbShares'), ('bw', 'bwShares')):
        wochen = wochenwerte(d['plan'], feld)
        zeilen, drueber_gesamt, gesamt = [], 0, 0
        for m in sorted({m for wv in wochen.values() for m in wv}):
            grenze = max(cap, ziele.get(m) or 0)
            werte = [wochen[w][m] for w in sorted(wochen)]
            gesamt += len(werte)
            ueber = [v - grenze for v in werte if v > grenze + 1e-9]
            drueber_gesamt += len(ueber)
            if ueber:
                zeilen.append((max(ueber), m, len(ueber), max(werte), grenze))
        zeilen.sort(reverse=True)
        schlimmste = zeilen[0][0] if zeilen else 0.0
        anteil = drueber_gesamt / gesamt if gesamt else 0
        angehoben = {m: t for m, t in ziele.items() if t and t > cap}
        print(f'  {variante:12s} {modus}  Grenze {cap}  '
              f'schlimmste Woche +{schlimmste:.2f}  '
              f'über der Grenze: {drueber_gesamt}/{gesamt} Gruppenwochen '
              f'({anteil * 100:.0f}%)'
              + (f'  · eigene Grenze wegen höherem Ziel: {angehoben}' if angehoben else ''))
        for d_, m, n, mx, grenze in zeilen[:4]:
            print(f'                 {m:16s} bis {mx:5.2f} bei Grenze {grenze:g}  '
                  f'(+{d_:.2f}) in {n} Wochen')
        if schlimmste > SCHRANKE + 1e-9:
            fehler.append(f'{variante}/{modus}: eine Woche liegt {schlimmste:.2f} Sätze '
                          f'über der Grenze, erlaubt sind {SCHRANKE}')
        if anteil > ANTEIL + 1e-9:
            fehler.append(f'{variante}/{modus}: {anteil * 100:.0f} % der Gruppenwochen '
                          f'liegen über der Grenze, erlaubt sind {ANTEIL * 100:.0f} %')
    return fehler


def main():
    nur = sys.argv[1:] or list(DATEIEN)
    alle = []
    for variante in nur:
        if variante not in DATEIEN:
            sys.exit(f'Unbekannte Variante: {variante}')
        alle += pruefe(variante, DATEIEN[variante])
    print()
    if alle:
        for f in alle:
            print('FEHLER:', f)
        sys.exit(1)
    print(f'Keine Woche mehr als {SCHRANKE} Sätze über ihrer Grenze, '
          f'und höchstens {ANTEIL * 100:.0f} % der Gruppenwochen überhaupt darüber.')


if __name__ == '__main__':
    main()
