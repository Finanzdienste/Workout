#!/usr/bin/env python3
"""Nennt jede Übung einen Weg nach unten?

    python3 tools/pruefung/weg-nach-unten.py

Der Plan gibt Wiederholungsbereiche vor – 8–15, 5–10, 12–20. Wer sie nicht
erreicht, braucht eine leichtere Fassung. Bei den meisten Übungen erledigt das
die Erfahrungsstufe von selbst: Der Anfänger nimmt die Hälfte des Gewichts und
liegt damit im Bereich.

**Bei Übungen ohne Gewichtsfeld gibt es diesen Hebel nicht.** Dort ist das
Körpergewicht die Last, und die einzige Anpassung ist eine andere Ausführung –
Negative statt ganzer Klimmzüge, im Liegen statt an der Stange, Hände erhöht
statt Füße erhöht. Steht die nirgends, bekommt der Anfänger eine Vorgabe, die
er nicht erfüllen kann, und die Zahl wird von einer Ansage zu einem Vorwurf.

Genau das war viermal der Fall, und jedes Mal ist es erst aufgefallen, als
jemand danach gefragt hat:

    Chin-ups, Pull-ups     erklärten nur, wann man Gewicht *dazu*packt
    Hängendes Knieheben    kannte die Fassung im Liegen nicht
    Fußerhöhte Liegestütze „Für mehr Reiz Füße höher stellen" – nur nach oben
    Sliding Leg Curl       nur der Hinweis für Teppichboden

Deshalb hier als Regel statt als fünfte Einzelkorrektur. Geprüft wird der
Hinweistext und die ausführliche Erklärung zusammen; gesucht wird nach den
Wendungen, in denen eine Erleichterung überhaupt formuliert werden kann.
"""
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
META = json.loads((ROOT / 'tools' / 'exercise-meta.json').read_text(encoding='utf-8'))

# Wendungen, mit denen sich ein Weg nach unten ausdrücken lässt. Bewusst breit:
# Die Regel soll erzwingen, dass *etwas* dasteht, nicht eine bestimmte Formulierung.
RUNTER = re.compile(
    r'zu schwer|noch nicht|schaffst du (?:kein|noch)|leichter|negativ|abstütz'
    r'|im liegen|weniger weit|einfacher|schwächer|halbe[nr]? weg|nachhelfen',
    re.I)


def ohne_last(e):
    """Übungen, bei denen die Erfahrungsstufe die Last nicht senken kann."""
    return e.get('dbWeight') in (0, None)


def text(e):
    return ' '.join([e.get('dbCue', ''), e.get('bwCue', '')]
                    + [d[1] for d in e.get('detail', [])])


fehlt = sorted(k for k, e in META.items() if ohne_last(e) and not RUNTER.search(text(e)))
betroffen = sorted(k for k, e in META.items() if ohne_last(e))

print(f'{len(betroffen)} von {len(META)} Übungen haben kein Gewichtsfeld – dort muss der '
      f'Hinweis eine leichtere Ausführung nennen.')
for k in betroffen:
    print(f'  {"FEHLT" if k in fehlt else "ok   "}  {k}')

if fehlt:
    print(f'\n{len(fehlt)} Übung(en) ohne Weg nach unten: {", ".join(fehlt)}')
    print('Ein Anfänger bekommt dort eine Vorgabe, die er nicht erfüllen kann.')
    sys.exit(1)
print('\nJede Übung ohne einstellbare Last nennt eine leichtere Ausführung.')
