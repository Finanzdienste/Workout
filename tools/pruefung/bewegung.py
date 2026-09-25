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
gewichtete Liegestütze beide zu Liegestützen. Geprüft wird in beiden Modi.

Verteilt werden die Übungen von tools/build-plan.py (split(), Kriterium ganz
vorn); nur die Tage neu verteilen geht mit WK_NUR_TAGE=1.

**Null ist nicht überall erreichbar**, und das ist Arithmetik, keine Nachlässigkeit:
Im Oberkörper-Plan haben seitliche Schulter und Brust je 12 Sätze die Woche, bei
drei Sätzen je Auftritt also vier Auftritte – und die 48-Stunden-Regel lässt eine
Gruppe an höchstens drei der vier Tage zu. An einem Tag stehen dann zwei Übungen
für dieselbe Gruppe, und im Bodyweight-Modus sind alle Brustübungen Liegestütze.
Das sind dort einfach sechs Sätze für die Gruppe, nicht schlechter als eine
Übung mit sechs Sätzen. Deshalb gilt je Plan der erreichte Stand als Obergrenze
(tools/pruefung/bewegung-stand.json): mehr schlägt an, weniger ist willkommen.
"""
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
META = json.loads((ROOT / 'tools' / 'exercise-meta.json').read_text(encoding='utf-8'))
STAND = json.loads((ROOT / 'tools' / 'pruefung' / 'bewegung-stand.json').read_text(encoding='utf-8'))
PLAENE = {'Aufbau': 'plan.json', 'Bauch, Beine, Po': 'plan-bbp.json',
          'Cut': 'plan-cut.json', 'Oberkörper': 'plan-oberkoerper.json'}


def bewegungen(ex):
    b = (META.get(ex) or {}).get('bewegung')
    if not b:
        return set()
    if isinstance(b, str):
        return {('db', b), ('bw', b)}
    return {(m, b[m]) for m in ('db', 'bw') if b.get(m)}


def main():
    fehler = 0
    for name, datei in PLAENE.items():
        plan = json.loads((ROOT / 'tools' / datei).read_text(encoding='utf-8'))['plan']
        paare = []
        for n, einheit in enumerate(plan, 1):
            ids = [e['id'] for e in einheit['ex']]
            for a in range(len(ids)):
                for b in range(a + 1, len(ids)):
                    gleich = bewegungen(ids[a]) & bewegungen(ids[b])
                    if gleich:
                        modi = '/'.join(sorted(m for m, _ in gleich))
                        paare.append(f'Einheit {n}: {ids[a]} + {ids[b]} ({modi})')
        erlaubt = STAND.get(datei, 0)
        if len(paare) > erlaubt:
            fehler += 1
            print(f'✗ {name}: {len(paare)} Einheiten mit derselben Bewegung zweimal, '
                  f'festgehalten sind höchstens {erlaubt}')
            for p in paare[:6]:
                print(f'    {p}')
        else:
            print(f'✓ {name}: {len(paare)} Einheiten mit derselben Bewegung zweimal '
                  f'(höchstens {erlaubt})')
            if len(paare) < erlaubt:
                print(f'    besser als festgehalten – {datei} in bewegung-stand.json auf {len(paare)} setzen')
    return 1 if fehler else 0


if __name__ == '__main__':
    sys.exit(main())
