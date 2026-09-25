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

# Die Geräte, die man hebt – aus tools/build-data.py gelesen, nicht abgeschrieben.
sys.path.insert(0, str(ROOT / 'tools'))
MIT_LAST = __import__('importlib').import_module('build-data').MIT_LAST

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

# Welches gezeichnete Gerät zu welchem Gerätetext passt. Der Text nennt genau
# ein Gerät (siehe 5.); die Zeichnung muss zu dem passen, das dort steht.
PASST = {
    'barbell':   r'langhantel',
    # Eigene Stange, eigenes Leergewicht – siehe RASTER in js/scheiben.js.
    'szbar':     r'sz-stange|sz\b',
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

    # 5. Der Gerätetext nennt genau ein Gerät.
    #
    #     „Mach nicht immer ODER sondern mach das optimale. Also hier zb nicht
    #      SZ-Stange oder Kurzhantel"
    #
    # Acht Übungen stellten die Wahl dem Nutzer: Kurzhanteln oder SZ-Stange,
    # Kurzhantel oder Scheibe, Stuhl oder Kiste, Stufe oder Buch, Klimmzugstange
    # oder Tischkante. Die Wahl ist eine Entscheidung, und die gehört in den
    # Katalog, mit Grund – nicht auf die Karte. Was die bessere Fassung ist,
    # steht je Übung unter `detail`; hier wird nur geprüft, dass sie getroffen
    # ist. Ein "/" ist dasselbe "oder" mit weniger Buchstaben.
    for modus in ('db', 'bw'):
        text = e.get(f'{modus}Equip') or ''
        if re.search(r'\boder\b|/', text):
            melde(k, f'{modus}: Gerätetext stellt eine Wahl – „{text}"; eines festlegen', '')

    # 6. Wo eine Last gehoben wird, steht, wie man sie allein hochnimmt und ablegt.
    #
    #     „Sag am besten bei jeder Übung auch immer wie man das Gewicht am
    #      besten zuhause hochnimmt und ablegt wenn man alleine ist und so"
    #
    # Der Hinweis beschreibt die Bewegung; dass die Stange vorher am Boden
    # liegt und nachher wieder dorthin muss – ohne Ständer, ohne zweite Person –
    # stand nirgends. Verlangt für jedes gezeichnete Gerät, das man hebt
    # (MIT_LAST in tools/build-data.py); Band und Klimmzugstange hebt niemand.
    # Beide Wörter müssen vorkommen, sonst fehlt die Hälfte: Das Ablegen ist
    # der Teil, bei dem man müde ist.
    if gear in MIT_LAST:
        text = e.get('dbHeben') or ''
        if not text:
            melde(k, f'db: Figur zeichnet „{gear}", aber kein dbHeben – wie kommt die Last hoch und wieder herunter?', '')
        elif not (re.search(r'hochnehmen|heben|greifen|aufstehen|aufsetzen|hineinrollen|hinlegen|hinsetzen|zur schulter',
                            text, re.I)
                  and re.search(r'ablegen|abstellen|absetzen|abnehmen|zurück|boden', text, re.I)):
            melde(k, 'db: dbHeben nennt Hochnehmen oder Ablegen nicht', text[:70])


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

# --- Steht der Hinweis fuer sich? --------------------------------------
#
#     "Hier steht identisch. Aber identisch zu was? Mich interessiert hier ja
#      nicht ein Vergleich zur Hantelübung oder so sondern einfach nur diese
#      eine losgelöste Übung."
#
# Neun Bodyweight-Hinweise fingen mit "Identisch." an und meinten damit die
# Hantelfassung derselben Uebung. Auf dem Bildschirm steht aber immer nur eine
# von beiden: Wer im Bodyweight-Modus trainiert, sieht den Hantel-Hinweis nie
# und bekam als Anleitung das Wort "Identisch". Ein Hinweis, der auf etwas
# verweist, das nicht danebensteht, ist keiner.
#
# Geprueft wird der Anfang - dort steht so ein Rueckverweis, wenn es ihn gibt.
# Ein "wie oben" mitten im Text meint meistens die Zeile davor und ist in
# Ordnung.
VERWEIS = re.compile(r'^\s*(identisch|wie (oben|beidbeinig|bei der|in der|vorher|beschrieben)|'
                     r'dasselbe|das gleiche|siehe oben)\b', re.I)

# Und dieselbe Sache mitten im Satz. Gefunden an dieser Frage:
#
#     "Was ist ein 1 1/2 Wdh Bodyweight Squat?"
#
# Auf der Karte stand "Fersen erhoeht, gleiche 1½-Technik" - erklaert war die
# Technik auf einer *anderen* Uebung, die an dem Tag gar nicht dranstand. Das
# ist derselbe Fehler wie ein "Identisch." am Anfang, nur schwerer zu sehen.
#
# Eng gefasst, damit Vergleiche nicht mitgefangen werden: "haelt die Scheibe wie
# einen Becher" und "kippt wie eine Wippe" sind Bilder und keine Verweise.
VERWEIS_IM_SATZ = re.compile(
    r'\b(gleiche[rsn]?\s+[\w½-]+-?technik|dieselbe\s+technik|gleiche\s+ausf(ü|ue)hrung'
    r'|wie\s+(bei|in)\s+(der|dem|den)\s|wie\s+oben\s+beschrieben|siehe\s+dort)\b', re.I)

# Und die dritte Sorte: eine *zweite Uebung* im Hinweis der ersten. Gefunden an
# diesem Bildschirmfoto:
#
#     "Hier sind wieder zwei Uebungen in einer? Jede Uebung soll wirklich nur
#      eine Uebung sein. Ohne Variationen usw. Jede kleinste Variation ist ne
#      eigene Uebung."
#
# Beim Band-Pull-Apart stand: "Mit einem langen Band ueber der Klimmzugstange
# wird daraus ein Face Pull - das ist die bessere Variante." Auf einer Karte
# standen damit zwei Uebungen, und die empfohlene war die, die man nicht
# abhaken konnte. Der Face Pull ist jetzt eine eigene Uebung mit eigener Figur.
#
# NICHT gemeint sind Erleichterungen und Erschwerungen derselben Bewegung -
# "zu schwer? Fuesse naeher heran" ist keine zweite Uebung, sondern die
# Skalierung, die weg-nach-unten.py sogar verlangt. Gesucht wird deshalb nur
# das Muster "daraus wird X" bzw. "X statt dessen", das eine andere Uebung
# benennt.
ZWEITE_UEBUNG = re.compile(
    r'\b(wird\s+daraus|daraus\s+wird|macht\s+daraus|ist\s+das\s+ein\s+\w+\s*-?\s*pull'
    r'|die\s+bessere\s+Variante|besser(e|es)\s+Variante|alternativ\s+(macht|nimmt|geht)'
    r'|statt\s*dessen\s+(macht|nimmt))\b', re.I)

lose = [(k, f, e[f][:60]) for k, e in sorted(META.items()) for f in ('dbCue', 'bwCue')
        if VERWEIS.match(e.get(f, '')) or VERWEIS_IM_SATZ.search(e.get(f, ''))
        or ZWEITE_UEBUNG.search(e.get(f, ''))]

print(f'{len(META)} Übungen geprüft: Haltung, Gerät, Schlüssel, Hinweis für sich.\n')
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

if lose:
    print(f'\n{len(lose)} Hinweis(e) verweisen auf die andere Variante, statt die Übung '
          f'selbst zu beschreiben:')
    for k, f, anfang in lose:
        print(f'  {k:32s} {f}: „{anfang}…"')
    print('  Auf dem Bildschirm steht immer nur eine Variante. Ausschreiben.')
else:
    print('Jeder Hinweis beschreibt seine eigene Übung, ohne Verweis auf die andere Variante.')

sys.exit(1 if befunde or lose else 0)
