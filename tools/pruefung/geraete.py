#!/usr/bin/env python3
"""Passen Name, Gerät, Hinweis und Zeichnung einer Übung zusammen?

    python3 tools/pruefung/geraete.py

Eine Übung wird an vier Stellen beschrieben, und keine davon kennt die anderen:

    dbName / bwName      wie sie heißt
    dbEquip / bwEquip    womit man sie macht, als Text für den Menschen
    equip                womit die Figur sie zeichnet
    dbCue / bwCue        wie sie ausgeführt wird

Solange das von Hand gepflegt wird, laufen die vier auseinander, und zwar
unbemerkt: Der Überkopf-Trizepsstrecker hieß richtig, der Hinweis beschrieb die
sitzende Fassung, als Gerät stand „Kurzhanteln/SZ" da – und die Figur hielt
zwei einzelne Kurzhanteln über den Kopf, die unüblichste der drei gängigen
Formen. Aufgefallen ist das erst, als jemand die Übung wirklich machen wollte.

Geprüft wird deshalb maschinell, was sich maschinell prüfen lässt:

    1. Sitzt die Figur, wenn der Hinweis vom Sitzen spricht – und umgekehrt?
    2. Liegt sie, wenn er vom Liegen spricht?
    3. Passt das gezeichnete Gerät zum Gerätetext?
    4. Steht im Schlüssel etwas anderes als im Namen?

Punkt 4 ist kein Fehler, sondern eine Warnung: Übungs-Schlüssel dürfen nicht
umbenannt werden, an ihnen hängen die eingetragenen Gewichte und jeder
protokollierte Satz. Sie sollen nur nicht das Gegenteil des Namens behaupten.
"""
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
META = json.loads((ROOT / 'tools' / 'exercise-meta.json').read_text(encoding='utf-8'))
FIG = (ROOT / 'js' / 'figure.js').read_text(encoding='utf-8')

# Haltung je Bewegungsmuster, direkt aus js/figure.js gelesen statt hier
# abgeschrieben – eine zweite Liste wäre die nächste Stelle zum Auseinanderlaufen.
MUSTER = {}
for m in re.finditer(r'^  ([a-z0-9]+): \{(.*?)^  \},', FIG, re.S | re.M):
    name, koerper = m.group(1), m.group(2)
    MUSTER[name] = {
        'seat': 'seat: true' in koerper,
        'lie': bool(re.search(r"lie: '", koerper)),
        'band': re.search(r"band: '([a-z]+)'", koerper).group(1)
                if re.search(r"band: '([a-z]+)'", koerper) else None,
    }

# Welches gezeichnete Gerät zu welchem Gerätetext passt. Mehrere erlaubt: Eine
# Übung darf mit Kurzhantel *oder* Scheibe gehen, gezeichnet wird eine davon.
PASST = {
    'barbell':   r'langhantel|sz-stange|sz\b',
    'hipbar':    r'langhantel',
    'dumbbells': r'kurzhanteln',          # Mehrzahl: zwei Gewichte
    'onehand':   r'kurzhantel\b',         # Einzahl: eines
    'goblet':    r'kurzhantel\b',
    'plate':     r'kurzhantel|scheibe',
    'backpack':  r'rucksack',
    'band':      r'band',
}

# Bewusst am Wortstamm und nicht an einer festen Wendung: Die Hinweise sind für
# Menschen geschrieben, nicht für diese Prüfung. „Aufrecht sitzen", „Auf den
# Stuhl setzen" und „Sitzend" meinen dasselbe, und alle drei kommen vor.
SITZT = re.compile(r'\bsitzend\b|\bsitzen\b|auf (?:den|einen|die) (?:stuhl|bank|stuhlkante)', re.I)

# „Auf den Rücken" allein reicht nicht: Bei den Klimmzügen steht dort
# „Rucksack auf den Rücken", und das ist keine Rückenlage. Verlangt wird
# deshalb ein Wort, das die Lage wirklich benennt.
LIEGT = re.compile(r'rücken am boden|rückenlage|auf dem rücken lieg|flach auf den boden'
                   r'|auf den rücken legen', re.I)

befunde = []


def melde(schluessel, was, text):
    befunde.append((schluessel, was, text))


for k, e in sorted(META.items()):
    gear = e.get('equip')
    for modus in ('db', 'bw'):
        pat = e.get(f'{modus}Pattern') or e.get('pattern')
        cue = e.get(f'{modus}Cue') or ''
        muster = MUSTER.get(pat)
        if not muster:
            continue

        # 1./2. Haltung gegen den Hinweis
        if SITZT.search(cue) and not (muster['seat'] or muster['lie']):
            melde(k, f'{modus}: Hinweis sagt sitzend, Muster „{pat}" zeichnet stehend', cue[:70])
        if muster['seat'] and not SITZT.search(cue):
            melde(k, f'{modus}: Muster „{pat}" zeichnet sitzend, der Hinweis sagt das nicht', cue[:70])
        if LIEGT.search(cue) and not muster['lie']:
            melde(k, f'{modus}: Hinweis sagt liegend, Muster „{pat}" nicht', cue[:70])

    # 3. Gezeichnetes Gerät gegen den Gerätetext (nur Hantel-Modus – im
    #    Bodyweight-Modus leitet die App das Gerät aus dem Text selbst ab).
    if gear and gear in PASST:
        text = (e.get('dbEquip') or '').lower()
        if text and not re.search(PASST[gear], text):
            melde(k, f'db: Figur zeichnet „{gear}", der Text sagt „{e.get("dbEquip")}"', '')


# 4. Schlüssel gegen Namen – eine Warnung, kein Fehler.
#
# Verglichen werden nur die Wörter, die eine *Aussage* treffen: Haltung und
# Gerät. Der Rest eines Schlüssels ist der Bewegungsname, und der stimmt fast
# immer. Genau daran wäre der Überkopf-Trizepsstrecker aufgefallen: Sein
# Schlüssel heißt „liegende-…", die Übung ist aber die sitzende über Kopf.
AUSSAGE = {
    'liegend': r'lieg',
    'liegende': r'lieg',
    'sitzend': r'sitz',
    'sitzendes': r'sitz',
    'stehend': r'steh',
    'stehendes': r'steh',
    'haengendes': r'häng',
    'einarmiges': r'einarm',
    'einbeiniger': r'einbein',
    'einbeiniges': r'einbein',
    'kh': r'kurzhantel',
    'sz': r'sz',
    'band': r'band',
    'gewichtete': r'gewicht',
    'fersenerhoehter': r'fersenerhöht',
}

# ue/oe/ae in den Schlüsseln gegen die Umlaute in den Namen.
UMLAUT = str.maketrans({'ä': 'a', 'ö': 'o', 'ü': 'u', 'ß': 's'})


def flach(s):
    return (s or '').lower().translate(UMLAUT).replace('ue', 'u').replace('oe', 'o').replace('ae', 'a')


# Die Namen stehen für die meisten Übungen in der Excel, nicht in der
# Meta-Datei – gelesen wird deshalb das erzeugte js/data.js, wo beide
# zusammengeführt sind.
NAMEN = {e['id']: e['db']['name'] for e in json.loads(
    re.search(r'export const EXERCISES = (\[.*?\n\]);',
              (ROOT / 'js' / 'data.js').read_text(encoding='utf-8'), re.S).group(1))}

veraltet = []
for k in sorted(META):
    name = NAMEN.get(k) or ''
    if not name:
        continue
    fname = flach(name)
    for wort, muss in AUSSAGE.items():
        if wort not in k.split('-'):
            continue
        if not re.search(flach(muss), fname):
            veraltet.append((k, name, wort))

print(f'{len(META)} Übungen geprüft: Haltung, Gerät, Schlüssel.\n')
if befunde:
    print(f'{len(befunde)} Unstimmigkeit(en):')
    for k, was, text in befunde:
        print(f'  {k}\n      {was}')
        if text:
            print(f'      Hinweis: „{text}…"')
else:
    print('Haltung und Gerät passen überall zum Hinweis.')

if veraltet:
    print(f'\nHinweis – {len(veraltet)} Schlüssel beschreiben etwas anderes als der Name:')
    for k, name, wort in veraltet:
        print(f'  {k:32s} sagt „{wort}", heißt in der App aber „{name}"')
    print('  Das ist kein Fehler: An den Schlüsseln hängen die eingetragenen')
    print('  Gewichte und jeder protokollierte Satz, sie bleiben deshalb stehen.')

sys.exit(1 if befunde else 0)
