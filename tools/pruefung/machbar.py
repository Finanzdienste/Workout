"""Geht ein Zielsatz überhaupt exakt auf? Nur die Gleichungen, nicht die Verteilung.

    python3 tools/pruefung/machbar.py            # die Kandidaten unten
    python3 tools/pruefung/machbar.py cut        # mit den Zielen einer Variante

**Eine Werkbank, kein Tor.** Der Unterschied ist wichtig genug für einen eigenen
Absatz, weil dieses Skript im Verzeichnis der Prüfungen liegt und trotzdem in
keiner Prüfung läuft:

  Ein *Tor* beantwortet „ist das, was wir ausliefern, in Ordnung?" – das tun
  plan-pruefen.py und plan-frisch.py bei jedem Push. Dieses Skript beantwortet
  „würden *diese* Ziele überhaupt aufgehen?", und diese Frage stellt sich genau
  dann, wenn jemand TARGET in tools/build-plan.py anfassen will. Sie hat mit dem
  eingecheckten Stand nichts zu tun, und ein Lauf, der sie bei jedem Push
  beantwortet, prüft nichts – er kostet nur Zeit.

Wann man es also von Hand startet: **bevor** man eine Zielzahl ändert. Vier
Zahlen weiter oben oder unten, und die Wochensummen gehen nicht mehr exakt auf –
das merkt man sonst erst nach einer Viertelstunde Rechnen je Variante, am
Abbruch des Generators.

Gerechnet wird nur der erste Schritt des Generators: die Satzzahlen je Übung,
die jede Zielgleichung exakt treffen. Das Verteilen auf Wochen und Tage – der
längere Teil – bleibt weg. Trotzdem ist das kein Sekundenlauf: Bis zu einer
halben Stunde je Zielsatz, wenn keine Lösung dasteht. Mit `--knoten=20000000`
geht es schneller und die Antwort wird unschärfer; was das heißt, steht unten
bei KNOTEN.

**Das Knotenbudget ist Teil der Antwort.** Die Suche hat eine Grenze (siehe
exact() in tools/build-plan.py), und „im Budget nichts gefunden" ist etwas
anderes als „es gibt nichts". Beides steht deshalb getrennt in der Ausgabe. Wer
das nicht trennt, hält eine zu kurze Suche für einen Beweis – genau das ist beim
Aufbau-Plan passiert.
"""
import importlib.util
import json
import pathlib
import random
import sys

WURZEL = pathlib.Path(__file__).resolve().parent.parent
# Erst merken, dann überschreiben: tools/build-plan.py liest beim Import seine
# Variante aus sys.argv. Ohne die erste Zeile bekam main() nie die eigenen
# Argumente zu sehen und rechnete immer nur „standard" nach.
ARGUMENTE = sys.argv[1:]
sys.argv = ['build-plan.py', 'standard']
spec = importlib.util.spec_from_file_location('bp', str(WURZEL / 'build-plan.py'))
bp = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bp)
meta = json.loads(bp.META.read_text(encoding='utf-8'))
shares = {k: v['dbShares'] for k, v in meta.items()}
bp.BW_SHARES.update({k: v['bwShares'] for k, v in meta.items()})
ids = list(shares)
groups = sorted({m for sh in shares.values() for m in sh})

# Klein gehalten: Hier geht es um „gibt es überhaupt eine", nicht um die Auswahl
# unter vielen. Der volle Lauf sucht 4000 je Block und darf dafür eine halbe
# Milliarde Knoten anfassen; für die Machbarkeit reichen zwanzig Lösungen.
#
# Das Budget gilt für den **ganzen Zielsatz**, nicht je Wochenzahl. Der erste
# Anlauf verteilte es je Wochenzahl neu – zwölf Wochenzahlen mal zwei Blöcke,
# und ein einziger Kandidat lief über zehn Minuten. Ein Werkzeug, das man vor
# einer Änderung kurz befragt, muss in Minuten antworten, sonst befragt man es
# nicht.
LOESUNGEN = 20
# Zweihundert Millionen, und die Zahl ist teuer bezahlt: Mit zwanzig Millionen
# meldete dieses Skript für Cut und Oberkörper „nichts gefunden" – für zwei
# Zielsätze also, aus denen der Generator kurz zuvor einen fertigen Plan
# gerechnet hatte. Der Grund steht im Bericht des vollen Laufs: Cut brauchte 205
# Millionen Knoten. Die *erste* Lösung ist das Teure, die weiteren kommen dann
# im Tausenderpack. Ein Budget unterhalb dieser Größenordnung beantwortet die
# Frage nicht, es verneint sie nur.
KNOTEN = int(next((a.split('=')[1] for a in ARGUMENTE if a.startswith('--knoten=')),
                  2 * 10 ** 8))


def probiere(ziele, wochen=range(21, 33)):
    """(Wochenzahl, vollständig) – oder (None, vollständig) wenn nichts aufgeht.

    `vollständig` sagt, ob die Suche den Baum wirklich abgesucht hat. Nur dann
    heißt „nichts gefunden" auch „es gibt nichts".
    """
    bp.TARGET.clear()
    bp.TARGET.update(ziele)
    bp.GOAL.clear()
    bp.GOAL.update({m: (None if t is None else t * bp.UNIT) for m, t in ziele.items()})
    ganz_ueberall = True
    rest = KNOTEN
    for w in wochen:
        rnd = random.Random(7)
        werte = [0] + [v for v in range(bp.PER_EX_WEEK[0] * w, bp.PER_EX_WEEK[1] * w + 1)
                       if v % bp.GRAIN == 0]
        ok = True
        for block in bp.parts(ids, shares, groups):
            if rest <= 0:
                return None, False
            found, (ganz, knoten) = bp.exact(block, shares, w, werte, LOESUNGEN, rnd, rest)
            rest -= knoten
            ganz_ueberall &= ganz
            if not found:
                ok = False
                break
        if ok:
            return w, ganz_ueberall
    return None, ganz_ueberall


BASIS = {
    'chest': 7, 'lats': 7, 'sideDelts': 7, 'rearDelts': 7,
    'biceps': 7, 'triceps': 7, 'abs': 9,
    'frontDelts': None, 'traps': None,
    'glutes': 7, 'quads': 6, 'hamstringsHip': 5, 'hamstringsKnee': 3, 'calves': 6,
}
KANDIDATEN = [
    ('wie eingetragen (hHip 5)', dict(BASIS)),
    ('hHip 6', {**BASIS, 'hamstringsHip': 6}),
    ('hHip 4', {**BASIS, 'hamstringsHip': 4}),
    ('hHip abgeleitet', {**BASIS, 'hamstringsHip': None}),
    ('hHip 5, glutes 8', {**BASIS, 'glutes': 8}),
    ('hHip 5, abs 8', {**BASIS, 'abs': 8}),
    ('hHip 5, rearDelts 6', {**BASIS, 'rearDelts': 6}),
    ('hHip 6, glutes 8', {**BASIS, 'hamstringsHip': 6, 'glutes': 8}),
]


def main():
    namen = [a for a in ARGUMENTE if not a.startswith('-')]
    if namen:
        # Die Ziele einer ausgelieferten Variante nachrechnen, statt sie von
        # Hand abzutippen – VARIANTEN in tools/build-plan.py hält sie.
        liste = []
        for name in namen:
            if name not in bp.VARIANTEN:
                print(f'Unbekannte Variante {name!r} – bekannt: '
                      f'{", ".join(bp.VARIANTEN)}')
                return 1
            liste.append((name, dict(bp.VARIANTEN[name]['ziele'])))
    else:
        liste = KANDIDATEN
    print(f'{LOESUNGEN} Lösungen je Block genügen, höchstens '
          f'{format(KNOTEN, ",").replace(",", ".")} Knoten je Zielsatz')
    for name, z in liste:
        w, ganz = probiere(z)
        if w:
            antwort = f'geht ab {w} Wochen'
        elif ganz:
            antwort = 'KEINE exakte Lösung'
        else:
            antwort = 'im Budget nichts gefunden – sagt nichts über die Lösbarkeit'
        print(f'{name:<28} {antwort}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
