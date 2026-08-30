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


def main():
    jetzt = eingaben()
    if '--schreiben' in sys.argv:
        vorher = json.loads(STAND.read_text(encoding='utf-8')) if STAND.exists() else {}
        STAND.write_text(json.dumps({
            'hinweis': 'Erzeugt von tools/pruefung/plan-frisch.py – der Stand der '
                       'Eingaben, aus denen tools/plan*.json erzeugt wurden. '
                       'Unter "hingenommen" stehen Abweichungen, die bewusst so '
                       'bleiben; alles andere laesst die Pruefung nicht durch.',
            'fingerabdruck': fingerabdruck(jetzt),
            'hingenommen': vorher.get('hingenommen', {}),
            'felder': jetzt,
        }, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        print(f'{STAND.relative_to(ROOT)} geschrieben ({fingerabdruck(jetzt)})')
        return 0

    if not STAND.exists():
        print(f'{STAND.relative_to(ROOT)} fehlt – einmal mit --schreiben anlegen.')
        return 1

    stand = json.loads(STAND.read_text(encoding='utf-8'))
    if stand.get('fingerabdruck') == fingerabdruck(jetzt):
        print(f'Plaene und Eingaben passen zusammen ({stand["fingerabdruck"]}).')
        return 0

    hingenommen = stand.get('hingenommen', {})
    offen, bekannt = [], []
    for schluessel, alt, neu in unterschiede(stand.get('felder', {}), jetzt):
        eintrag = hingenommen.get(schluessel)
        if eintrag and eintrag.get('erzeugt_mit') == alt and eintrag.get('jetzt') == neu:
            bekannt.append((schluessel, eintrag.get('grund', '')))
        else:
            offen.append(f'{schluessel}: {alt!r} -> {neu!r}')

    for schluessel, grund in bekannt:
        print(f'Bewusst hingenommen: {schluessel}')
        print(f'  {grund}')
    if not offen:
        print(f'\nSonst passen Plaene und Eingaben zusammen '
              f'({len(bekannt)} bekannte Abweichung(en)).')
        return 0

    print('\nDie Plaene sind aelter als ihre Eingaben:')
    for zeile in offen:
        print(f'  {zeile}')
    print('\nEntweder die Plaene neu erzeugen (tools/build-plan.py je Variante) und')
    print('mit --schreiben festhalten – oder die Abweichung unter "hingenommen" in')
    print(f'{STAND.relative_to(ROOT)} eintragen, mit Grund.')
    return 1


if __name__ == '__main__':
    sys.exit(main())
