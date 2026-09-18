#!/usr/bin/env python3
"""Sind die eingecheckten Plaene noch die ihrer Eingaben?

    python3 tools/pruefung/plan-frisch.py
    python3 tools/pruefung/plan-frisch.py --schreiben   # Stand neu festhalten

Die vier Plaene unter tools/plan*.json sind erzeugt, nicht geschrieben. Fuer
alles andere Erzeugte prueft die CI das Naheliegende: noch einmal erzeugen und
vergleichen. Bei den Plaenen geht das nicht – ein Lauf dauert eine Viertelstunde
je Variante. Genau deshalb war das hier ein blinder Fleck.

**Was passiert ist.** In tools/exercise-meta.json wurde das Geraet des
Ueberkopf-Trizepsstreckers von `dumbbells` auf `barbell` geaendert – sachlich
richtig, man macht ihn mit der SZ-Stange. Nur fliesst `equip` in die
Tagesaufteilung ein: Der Generator legt Uebungen desselben Geraets zusammen,
damit nicht dreimal umgebaut wird. Der Plan wurde nicht neu erzeugt, und seither
sind Datei und Eingaben zwei verschiedene Dinge. Aufgefallen ist es zufaellig,
weil ein Lauf gestoppt wurde und die Datei danach anders aussah.

**Was hier geprueft wird.** Nur die Felder, die den Plan wirklich bestimmen –
nicht die ganze Datei. Hinweistexte, Namen und Zeichenmuster aendern sich oft
und aendern am Plan nichts; wuerde man sie mitzaehlen, schluege die Pruefung
staendig ohne Grund an und waere nach der dritten Meldung abgeschaltet.

Zum Aufloesen gibt es zwei ehrliche Wege, und beide sind sichtbar:

  * Plaene neu erzeugen (`python3 tools/build-plan.py [variante]`) und danach
    `--schreiben`. Der Plan-Gate sagt anschliessend, ob der neue schlechter ist.
  * Die Abweichung bewusst hinnehmen – dann steht sie unter `hingenommen` in
    tools/pruefung/plan-eingaben.json, mit Grund, und diese Pruefung laesst
    genau sie durch. Alles andere schlaegt weiter an.

Der zweite Weg ist kein Schlupfloch, sondern der ehrlichere von beiden: Er
schreibt ins Repo, dass die Plaene aelter sind als ihre Eingaben, und warum das
so bleiben soll. Ein Fingerabdruck, der einfach nachgezogen wird, wuerde dieselbe
Lage verschweigen.

**Je Variante ein eigener Stand.** Anfangs stand hier ein Fingerabdruck fuer
alle vier Plaene, und das ging gut, solange sie zusammen erzeugt wurden. Am
17.09. wurden drei von vieren neu gerechnet und der vierte nicht – eine Lage,
die ein gemeinsamer Abdruck gar nicht abbilden kann. Die Folge war eine Datei,
die bei zehn von vierzehn Eintraegen das Gegenteil dessen behauptete, was in den
Plaenen stand: "In den Plaenen stehen sie nicht", waehrend sie in dreien
standen. Deshalb hat jede Variante ihren eigenen Abschnitt, `--schreiben` nimmt
den Namen der Variante entgegen, und wo eine Uebung wirklich vorkommt, rechnet
wo_drin() bei jedem Lauf nach, statt es aufzuschreiben.
"""
import hashlib
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
META = ROOT / 'tools' / 'exercise-meta.json'
STAND = ROOT / 'tools' / 'pruefung' / 'plan-eingaben.json'

# Genau die Felder, die tools/build-plan.py aus exercise-meta.json liest:
#   dbShares/bwShares  die Muskelanteile – daraus kommen die Wochenmengen
#   tier               die Reihenfolge innerhalb einer Einheit
#   equip + dbWeight   das Geraet, nach dem Umbauten gebuendelt werden
FELDER = ('dbShares', 'bwShares', 'tier', 'equip', 'dbWeight')

# Je Variante ein eigener Stand, und das ist die Lehre aus dem 17.09.: Drei der
# vier Plaene wurden neu erzeugt, der vierte nicht. Ein gemeinsamer
# Fingerabdruck kann diese Lage gar nicht abbilden – er behauptet fuer alle vier
# dasselbe. Die Folge war eine Datei, die bei zehn von vierzehn Eintraegen das
# Gegenteil dessen sagte, was in den Plaenen stand.
VARIANTEN = {'standard': 'Aufbau', 'bbp': 'Bauch, Beine, Po',
             'cut': 'Cut', 'oberkoerper': 'Oberkoerper'}


def eingaben():
    meta = json.loads(META.read_text(encoding='utf-8'))
    return {k: {f: v.get(f) for f in FELDER} for k, v in sorted(meta.items())}


def fingerabdruck(daten):
    roh = json.dumps(daten, sort_keys=True, ensure_ascii=False, separators=(',', ':'))
    return hashlib.sha256(roh.encode('utf-8')).hexdigest()[:16]


def unterschiede(alt, neu):
    """[(schluessel, vorher, jetzt)] – je geaendertem Feld eine Zeile."""
    raus = []
    for k in sorted(set(alt) | set(neu)):
        if k not in alt:
            raus.append((k, None, 'neu im Katalog'))
        elif k not in neu:
            raus.append((k, 'im Katalog', None))
        else:
            for f in FELDER:
                if alt[k].get(f) != neu[k].get(f):
                    raus.append((f'{k}.{f}', alt[k].get(f), neu[k].get(f)))
    return raus


def wo_drin(schluessel):
    """In welchen Plaenen die Uebung hinter diesem Schluessel wirklich steht.

    Ausgerechnet statt aufgeschrieben, und das ist der Punkt. Unter
    `hingenommen` stand die Zugehoerigkeit lange im Begruendungstext – „In den
    Plaenen stehen sie nicht". Nach einem Neulauf von drei der vier Varianten
    war das bei zehn von vierzehn Eintraegen das Gegenteil der Wahrheit, und
    niemand haette es gemerkt: Ein Text prueft sich nicht selbst. Was sich
    aendert, gehoert deshalb hierher und nicht in die Datei.
    """
    ex = schluessel.split('.')[0]
    drin = []
    for name, label in VARIANTEN.items():
        pfad = ROOT / 'tools' / ('plan.json' if name == 'standard' else f'plan-{name}.json')
        if not pfad.exists():
            continue
        plan = json.loads(pfad.read_text(encoding='utf-8'))['plan']
        if any(it['id'] == ex for e in plan for it in e['ex']):
            drin.append(label)
    return drin


HINWEIS = ('Erzeugt von tools/pruefung/plan-frisch.py – je Variante der Stand der '
           'Eingaben, aus denen ihre Plandatei erzeugt wurde. Unter "hingenommen" '
           'stehen Abweichungen, die bewusst so bleiben; alles andere laesst die '
           'Pruefung nicht durch.')


def pruefe(variante, stand, jetzt):
    """Eine Variante gegen ihren eigenen Stand. Rueckgabe: 0 oder 1."""
    kopf = f'{VARIANTEN[variante]} ({variante})'
    if stand.get('fingerabdruck') == fingerabdruck(jetzt):
        print(f'{kopf}: Plan und Eingaben passen zusammen ({stand["fingerabdruck"]}).')
        return 0

    hingenommen = stand.get('hingenommen', {})
    offen, bekannt = [], []
    for schluessel, alt, neu in unterschiede(stand.get('felder', {}), jetzt):
        eintrag = hingenommen.get(schluessel)
        if eintrag and eintrag.get('erzeugt_mit') == alt and eintrag.get('jetzt') == neu:
            bekannt.append((schluessel, eintrag.get('grund', '')))
        else:
            offen.append(f'{schluessel}: {alt!r} -> {neu!r}')

    print(f'{kopf}:')
    for schluessel, grund in bekannt:
        drin = wo_drin(schluessel)
        print(f'  Bewusst hingenommen: {schluessel}'
              + (f' – im Plan von: {", ".join(drin)}' if drin else ' – in keinem Plan'))
        print(f'    {grund}')
    if not offen:
        print(f'  Sonst passen Plan und Eingaben zusammen '
              f'({len(bekannt)} bekannte Abweichung(en)).')
        return 0

    print('  Der Plan ist aelter als seine Eingaben:')
    for zeile in offen:
        print(f'    {zeile}')
    print(f'  Entweder neu erzeugen (python3 tools/build-plan.py {variante}) und mit')
    print(f'  --schreiben {variante} festhalten – oder die Abweichung unter')
    print(f'  "hingenommen" in {STAND.relative_to(ROOT)} eintragen, mit Grund.')
    return 1


def main():
    jetzt = eingaben()
    alt = json.loads(STAND.read_text(encoding='utf-8')) if STAND.exists() else {}
    plaene = alt.get('plaene', {})

    if '--schreiben' in sys.argv:
        # Ohne Namen alle vier, mit Namen nur den einen. Der Normalfall ist der
        # einzelne: Ein Lauf erzeugt eine Variante, und nur deren Stand darf
        # danach vorruecken – sonst behauptet die Datei fuer die drei anderen
        # eine Frische, die sie nicht haben. Genau so war es passiert.
        namen = [a for a in sys.argv[1:] if a in VARIANTEN] or list(VARIANTEN)
        for name in namen:
            plaene[name] = {'fingerabdruck': fingerabdruck(jetzt),
                            'hingenommen': plaene.get(name, {}).get('hingenommen', {}),
                            'felder': jetzt}
        STAND.write_text(json.dumps({'hinweis': HINWEIS, 'plaene': plaene},
                                    ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        print(f'{STAND.relative_to(ROOT)} geschrieben: {", ".join(namen)} '
              f'({fingerabdruck(jetzt)})')
        return 0

    if not plaene:
        print(f'{STAND.relative_to(ROOT)} fehlt oder ist leer – einmal mit --schreiben anlegen.')
        return 1

    schlecht = 0
    for name in VARIANTEN:
        if name not in plaene:
            print(f'{VARIANTEN[name]} ({name}): kein Stand – mit --schreiben {name} anlegen.')
            schlecht = 1
            continue
        schlecht |= pruefe(name, plaene[name], jetzt)
    return schlecht


if __name__ == '__main__':
    sys.exit(main())
