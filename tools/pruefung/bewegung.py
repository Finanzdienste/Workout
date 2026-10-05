#!/usr/bin/env python3
"""Keine Bewegung zweimal in derselben Einheit.

    python3 tools/pruefung/bewegung.py

    „Wenn es optimal ist die selbe Übung zwei mal zu machen können wir es
     machen. Wenn nicht dann nicht"

Es ist nicht optimal: Zwei Fassungen derselben Bewegung am selben Tag – sitzendes
Seitheben und Band-Seitheben, Floor Press und Kurzhantel-Bodenpresse – bringen
nicht mehr als dieselben Sätze einer einzigen Übung, und auf zwei Tage verteilt
trifft jede einen frischen Muskel. Vor dieser Prüfung standen solche Paare in
78 Einheiten der vier Pläne.

Was als dieselbe Bewegung gilt, steht als `bewegung` in tools/exercise-meta.json,
je Modus, wo es sich unterscheidet: Im Bodyweight-Modus werden Floor Press und
gewichtete Liegestütze beide zu Liegestützen. Geprüft wird jeder Modus für sich,
mit eigener Obergrenze. Früher zählte das Skript ein Paar einmal, egal in welchem
Modus es doppelt war, und verglich mit einer Zahl je Plan. Ohne Hanteln hat der
Oberkörper 32 Paare, mit Hanteln 11 – die 32 waren damit auch die Grenze für die
Hanteln, und dort hätten es fast dreimal so viele werden dürfen, ohne dass etwas
anschlägt. Im Generator ist genau das einmal passiert: mit Hanteln 11 → 19 bei
gleicher Summe (Kommentar bei `bewpaare` in tools/build-plan.py).

Gezählt werden Paare, nicht Einheiten: Eine Einheit mit drei Fassungen derselben
Bewegung hat drei Paare. Im Oberkörper ohne Hanteln sind es 32 Paare in 29 Einheiten.

Verteilt werden die Übungen von tools/build-plan.py (split_exakt(), Kriterium ganz
vorn); nur die Tage neu verteilen geht mit WK_NUR_TAGE=1.

**Null ist nicht überall erreichbar**, und das ist Arithmetik, keine Nachlässigkeit:
Im Oberkörper-Plan haben seitliche Schulter und Brust je 12 Sätze die Woche, bei
drei Sätzen je Auftritt also vier Auftritte – und die 48-Stunden-Regel lässt eine
Gruppe an höchstens drei der vier Tage zu. An einem Tag stehen dann zwei Übungen
für dieselbe Gruppe, und im Bodyweight-Modus sind alle Brustübungen Liegestütze.
Das sind dort einfach sechs Sätze für die Gruppe, nicht schlechter als eine
Übung mit sechs Sätzen. Deshalb gilt je Plan und Modus der erreichte Stand als
Obergrenze (tools/pruefung/bewegung-stand.json, je Plan `{"db": …, "bw": …}`):
mehr schlägt an, weniger ist willkommen.
"""
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
META = json.loads((ROOT / 'tools' / 'exercise-meta.json').read_text(encoding='utf-8'))
STAND = json.loads((ROOT / 'tools' / 'pruefung' / 'bewegung-stand.json').read_text(encoding='utf-8'))
PLAENE = {'Aufbau': 'plan.json', 'Bauch, Beine, Po': 'plan-bbp.json',
          'Cut': 'plan-cut.json', 'Oberkörper': 'plan-oberkoerper.json'}
MODI = {'db': 'mit Hanteln', 'bw': 'ohne Hanteln'}


def bewegungen(ex):
    b = (META.get(ex) or {}).get('bewegung')
    if not b:
        return set()
    if isinstance(b, str):
        return {('db', b), ('bw', b)}
    return {(m, b[m]) for m in ('db', 'bw') if b.get(m)}


def paare(plan, modus):
    """Die Paare derselben Bewegung in einem Modus, als (Einheit, a, b)."""
    gefunden = []
    for n, einheit in enumerate(plan, 1):
        ids = [e['id'] for e in einheit['ex']]
        for a in range(len(ids)):
            for b in range(a + 1, len(ids)):
                if ({x for x in bewegungen(ids[a]) if x[0] == modus}
                        & {x for x in bewegungen(ids[b]) if x[0] == modus}):
                    gefunden.append((n, ids[a], ids[b]))
    return gefunden


def wort(n, eins, mehr):
    return f'{n} {eins if n == 1 else mehr}'


def main():
    fehler = 0
    for name, datei in PLAENE.items():
        plan = json.loads((ROOT / 'tools' / datei).read_text(encoding='utf-8'))['plan']
        for modus, text in MODI.items():
            gefunden = paare(plan, modus)
            einheiten = len({n for n, _, _ in gefunden})
            erlaubt = (STAND.get(datei) or {}).get(modus, 0)
            zeile = (f'{name} {text}: {wort(len(gefunden), "Paar", "Paare")} derselben Bewegung '
                     f'in {wort(einheiten, "Einheit", "Einheiten")}')
            if len(gefunden) > erlaubt:
                fehler += 1
                print(f'✗ {zeile}, festgehalten sind höchstens {erlaubt}')
                for n, a, b in gefunden[:6]:
                    print(f'    Einheit {n}: {a} + {b}')
            else:
                print(f'✓ {zeile} (höchstens {erlaubt})')
                if len(gefunden) < erlaubt:
                    print(f'    besser als festgehalten – {datei} „{modus}" in bewegung-stand.json '
                          f'auf {len(gefunden)} setzen')
    return 1 if fehler else 0


if __name__ == '__main__':
    sys.exit(main())
