#!/usr/bin/env python3
"""Erzeugt js/data.js aus der Excel-Quelle.

    python3 tools/build-data.py

Liest data/Workoutplan_mit_Bodyweight_Equivalent.xlsx (Spalte A Datum,
Spalte B Hantel-Workout, Spalte C Bodyweight-Aequivalent), verbindet die
Uebungen zeilenweise mit den Hinweisen aus tools/exercise-meta.json und
schreibt js/data.js. Keine Abhaengigkeiten ausser der Standardbibliothek.
"""

import datetime
import json
import pathlib
import re
import sys
import unicodedata
import xml.etree.ElementTree as ET
import zipfile

ROOT = pathlib.Path(__file__).resolve().parent.parent
XLSX = ROOT / 'data' / 'Workoutplan_mit_Bodyweight_Equivalent.xlsx'
META = ROOT / 'tools' / 'exercise-meta.json'
OUT = ROOT / 'js' / 'data.js'
PLAN_OVERRIDE = ROOT / 'tools' / 'plan.json'
# Weitere Trainingsfokusse: tools/plan-<name>.json, erzeugt mit
# `python3 tools/build-plan.py <name>`. Alle wandern zusammen nach js/data.js;
# welcher gilt, entscheidet die App.
VARIANT_GLOB = 'plan-*.json'

# Abgeschaffte Fokusse und wohin sie führen.
#
# Ein Fokus steht im Browser des Nutzers, nicht in der App. Wird eine Variante
# gestrichen, findet der Browser beim nächsten Laden einen Schlüssel, den es
# nicht mehr gibt – und fiel bisher stillschweigend auf den Standardplan
# zurück. Still ist hier das Problem: `state.focus` blieb auf 'kurz' stehen,
# während der ausgewogene Plan lief. Zwei Werte, die dasselbe meinen sollen,
# gingen dauerhaft auseinander, und `restorable()` in js/store.js hätte danach
# ein Protokoll aus dem alten Plan in den neuen zurückgeholt.
#
# Deshalb hier ein benannter Nachfolger statt eines Fallbacks. Die Zuordnung
# ist nicht beliebig: „Kurz und knapp" wollte weniger Volumen bei gleicher
# Abdeckung – das ist „Cut". „Beine ernst gemeint" wollte Beine mit eigenem
# Ziel – das ist „Bauch, Beine, Po". `name` steht dabei, weil die App dem
# Nutzer sagen soll, *woher* er kommt, und der Name sonst mit der Variante
# verschwunden wäre.
# `uebungen` ist die Zahl der Übungen je Einheit des *alten* Plans, und sie steht
# hier, weil sie sonst nirgends mehr steht: Die Plandateien sind gelöscht.
#
# Ohne sie geht beim Umzug die Trainingsgeschichte verloren. Gemessen: Ein Gerät
# mit einer vollständigen „Kurz und knapp"-Runde – 96 Einheiten, 1230 Sätze –
# schrieb beim automatischen Umzug eine Bilanz von {0, 0, 0} in die Ablage. Denn
# js/data.js hat zu diesem Zeitpunkt längst den Nachfolgeplan geladen, während
# das Protokoll noch nach den Einheiten des alten abgelegt ist; gezählt wurde
# damit ein Cut-Plan gegen ein Kurz-Protokoll.
#
# Mehr als diese Zahl braucht es nicht: Ob eine Einheit fertig war, hängt daran,
# ob zu *jeder* geplanten Übung ein Satz abgehakt ist – die Übungen selbst
# stehen mit ihrer ID im Protokoll. Rund 400 Byte gegen ein halbes Jahr
# Trainingsgeschichte.
FOKUS_ERSATZ = {
    'kurz': {
        'nach': 'cut', 'name': 'Kurz und knapp',
        'uebungen': [4, 5, 4, 4, 5, 4, 4, 4, 5, 5, 4, 4, 5, 4, 4, 4, 5, 5, 4, 4, 5, 5, 3, 4,
                     4, 5, 4, 4, 5, 5, 3, 4, 5, 4, 4, 4, 4, 5, 4, 4, 4, 5, 4, 4, 4, 5, 4, 4,
                     4, 5, 4, 4, 4, 5, 4, 4, 5, 5, 3, 4, 5, 4, 4, 4, 5, 5, 4, 4, 5, 5, 4, 4,
                     4, 5, 4, 4, 5, 4, 3, 4, 5, 4, 4, 4, 4, 5, 4, 4, 5, 4, 4, 4, 5, 4, 3, 4],
    },
    'beine': {
        'nach': 'bbp', 'name': 'Beine ernst gemeint',
        'uebungen': [7, 6, 7, 6, 6, 6, 6, 6, 7, 7, 6, 6, 7, 6, 6, 6, 6, 7, 6, 6, 7, 7, 6, 6,
                     7, 7, 6, 6, 6, 6, 6, 7, 7, 6, 6, 6, 6, 6, 6, 7, 7, 6, 6, 6, 7, 6, 7, 6,
                     6, 7, 6, 6, 6, 7, 6, 6, 7, 6, 5, 7, 7, 6, 6, 6, 6, 6, 6, 6, 7, 6, 6, 6,
                     7, 7, 6, 7, 6, 7, 7, 6, 6, 6, 6, 7],
    },
}

DEFAULT_TARGET = 10   # Sätze je Muskelgruppe und Woche, wenn plan.json fehlt
DEFAULT_CAP = 10      # Obergrenze je Gruppe, wenn plan.json fehlt
DEFAULT_REST = {'days': 2, 'direct': 0.5}   # Erholung, wenn plan.json fehlt
NS = '{http://schemas.openxmlformats.org/spreadsheetml/2006/main}'
LINE_RE = re.compile(r'^(\d+)×\s*(.+?)\s*\(([^()]*)\)\s*$')
EXCEL_EPOCH = datetime.date(1899, 12, 30)


def read_rows(path):
    """Zeilen des ersten Blattes als {Spaltenbuchstabe: Text}."""
    with zipfile.ZipFile(path) as z:
        shared = [
            ''.join(t.text or '' for t in si.iter(NS + 't'))
            for si in ET.fromstring(z.read('xl/sharedStrings.xml')).iter(NS + 'si')
        ]
        sheet = ET.fromstring(z.read('xl/worksheets/sheet1.xml'))

    for row in sheet.iter(NS + 'row'):
        cells = {}
        for c in row.iter(NS + 'c'):
            col = ''.join(ch for ch in c.get('r') if ch.isalpha())
            v = c.find(NS + 'v')
            if v is None:
                continue
            cells[col] = shared[int(v.text)] if c.get('t') == 's' else v.text
        yield cells


def parse_block(text, has_title):
    lines = [l.strip() for l in text.split('\n') if l.strip()]
    if has_title:
        lines.pop(0)
    out = []
    for line in lines:
        m = LINE_RE.match(line)
        if not m:
            sys.exit(f'Zeile nicht lesbar: {line!r}')
        out.append({'sets': int(m.group(1)), 'name': m.group(2), 'reps': m.group(3)})
    return out


def muscles(shares):
    """Muskeln nach Anteil, der größte zuerst.

    Die Körperkarte hebt den ersten voll hervor und den Rest gedämpft; damit
    ergibt sich das direkt aus den Anteilen und kann nicht auseinanderlaufen.
    """
    return [m for m, _ in sorted(shares.items(), key=lambda x: -x[1])]


def slug(s):
    s = s.replace('ä', 'ae').replace('ö', 'oe').replace('ü', 'ue').replace('ß', 'ss')
    s = unicodedata.normalize('NFKD', s).encode('ascii', 'ignore').decode()
    return re.sub(r'-+', '-', re.sub(r'[^a-z0-9]+', '-', s.lower())).strip('-')


def main():
    meta = json.loads(META.read_text(encoding='utf-8'))
    catalog = {}
    plan = []

    for cells in read_rows(XLSX):
        raw_date = cells.get('A', '')
        if not re.fullmatch(r'\d+(\.\d+)?', raw_date or ''):
            continue  # Kopf- und Fusszeilen ueberspringen
        date = (EXCEL_EPOCH + datetime.timedelta(days=int(float(raw_date)))).isoformat()

        dumbbell = parse_block(cells.get('B', ''), has_title=True)
        bodyweight = parse_block(cells.get('C', ''), has_title=False)
        if len(dumbbell) != len(bodyweight):
            sys.exit(f'{date}: {len(dumbbell)} Hantel- vs. {len(bodyweight)} Bodyweight-Uebungen')

        items = []
        for db, bw in zip(dumbbell, bodyweight):
            key = slug(db['name'])
            if key not in meta:
                sys.exit(f'Kein Eintrag in exercise-meta.json fuer {key!r} ({db["name"]})')
            entry = catalog.get(key)
            if entry is None:
                m = meta[key]
                catalog[key] = {
                    'id': key,
                    'group': m['group'],
                    'weight': m['dbWeight'],       # Startgewicht in kg, null = ohne Zusatzlast
                    'step': m['dbStep'],           # sinnvolle Steigerung in kg
                    'weightNote': m['weightNote'],
                    'equip': m['equip'],      # Geraet in der Hantel-Variante
                    # Stufe der Uebung: 1 schwere Grunduebung ... 4 kleine
                    # Isolation. Der Generator sortiert die Einheit danach; die
                    # App braucht sie, damit ihre Ruest-Sortierung eine
                    # Isolation nicht vor eine Grunduebung am selben Muskel
                    # zieht (siehe ruestOrder in js/app.js).
                    'tier': m['tier'],
                    # Ausführliche Erklärung, aufklappbar in der App. Sie hängt
                    # an der Übung und nicht an der Variante: Griff, Aufbau und
                    # typische Fehler sind in beiden Fassungen dieselben.
                    'detail': m.get('detail', []),
                    # Name und Wiederholungen kommen aus der Excel – es sei
                    # denn, exercise-meta.json setzt eigene. Nötig geworden, als
                    # aus dem liegenden ein Überkopf-Trizepsstrecker wurde: Der
                    # Schlüssel einer Übung ist der Slug ihres Excel-Namens und
                    # trägt die eingetragenen Gewichte, also bleibt er, wenn die
                    # Übung selbst sich ändert. Dieselbe Mechanik wie bwName.
                    'db': {'name': m.get('name') or db['name'],
                           'reps': m.get('reps') or db['reps'], 'equip': m['dbEquip'],
                           'cue': m['dbCue'], 'rest': m['dbRest'], 'pattern': m['dbPattern'],
                           'shares': m['dbShares'], 'muscles': muscles(m['dbShares']),
                           # Eigene Wiederholungen und Pause je Erfahrungsstufe –
                           # nur dort nötig, wo sich die Last nicht herunterdrehen
                           # lässt. Siehe stufen() in js/app.js.
                           'stufen': m.get('dbStufen', {})},
                    # Das Bodyweight-Äquivalent kommt aus der Excel – es sei
                    # denn, in exercise-meta.json steht ein eigenes. Nötig
                    # geworden, als vordere und seitliche Schulter getrennt
                    # gezählt wurden: Die Excel macht aus dem Seitheben Pike
                    # Push-ups, und das ist ein Überkopfdrücken. Anatomisch
                    # passte die Zuordnung damit nicht mehr.
                    'bw': {'name': m.get('bwName') or bw['name'],
                           'reps': m.get('bwReps') or bw['reps'], 'equip': m['bwEquip'],
                           'cue': m['bwCue'], 'rest': m['bwRest'], 'pattern': m['bwPattern'],
                           'shares': m['bwShares'], 'muscles': muscles(m['bwShares']),
                           'stufen': m.get('bwStufen', {})},
                }
            elif (entry['db']['reps'], entry['bw']['name'], entry['bw']['reps']) != (
                    meta[key].get('reps') or db['reps'],
                    meta[key].get('bwName') or bw['name'],
                    meta[key].get('bwReps') or bw['reps']):
                sys.exit(f'{date}: widerspruechliche Angaben fuer {key!r}')
            items.append({'id': key, 'sets': db['sets']})

        plan.append({'n': len(plan) + 1, 'date': date, 'ex': items})

    # Übungen, die nicht in der Excel stehen. Die Excel ist die Quelle für den
    # ursprünglichen Plan; was später dazukommt, um eine Lücke im Bewegungs-
    # repertoire zu schließen, braucht keine Tabellenzeile – es braucht Name,
    # Wiederholungen und ein Bodyweight-Äquivalent, und die stehen dann
    # vollständig in exercise-meta.json.
    for key, m in meta.items():
        if key in catalog or 'name' not in m:
            continue
        catalog[key] = {
            'id': key,
            'group': m['group'],
            'weight': m['dbWeight'],
            'step': m['dbStep'],
            'weightNote': m['weightNote'],
            'equip': m['equip'],
            'tier': m['tier'],
            'detail': m.get('detail', []),
            'db': {'name': m['name'], 'reps': m['reps'], 'equip': m['dbEquip'],
                   'cue': m['dbCue'], 'rest': m['dbRest'], 'pattern': m['dbPattern'],
                   'shares': m['dbShares'], 'muscles': muscles(m['dbShares']),
                   'stufen': m.get('dbStufen', {})},
            'bw': {'name': m['bwName'], 'reps': m['bwReps'], 'equip': m['bwEquip'],
                   'cue': m['bwCue'], 'rest': m['bwRest'], 'pattern': m['bwPattern'],
                   'shares': m['bwShares'], 'muscles': muscles(m['bwShares']),
                   'stufen': m.get('bwStufen', {})},
        }
        print(f'{key}: nicht in der Excel, aus exercise-meta.json übernommen')


    # Der Trainingsplan darf komplett aus tools/plan.json kommen: Termine,
    # Auswahl und Satzzahlen. Die Excel bleibt Quelle für die Übungen selbst –
    # Namen, Wiederholungen, Hinweise und das Bodyweight-Äquivalent. Datei
    # löschen und neu generieren stellt den Originalplan wieder her.
    # Ohne plan.json gilt das alte, gleichmäßige Ziel für jede Gruppe.
    def lies_plan(pfad):
        """Eine Plandatei prüfen und in die Form bringen, die die App erwartet."""
        roh = json.loads(pfad.read_text(encoding='utf-8'))
        # Der Suchbegriff ist tools/plan-*.json, und da geraet leicht etwas
        # hinein, das kein Plan ist – eine Notiz, ein Zwischenstand, eine Datei
        # neben dem Generator. Ohne diese Zeile stirbt der Lauf an einem
        # KeyError mitten in der Ausgabe, und man sucht den Fehler im Plan
        # statt im Dateinamen. Genau so ist es passiert.
        if 'plan' not in roh:
            sys.exit(f'{pfad.name}: kein "plan" darin. Der Suchbegriff '
                     f'{VARIANT_GLOB} meint Planvarianten – andere Dateien '
                     f'gehoeren nicht nach tools/ oder brauchen einen Namen, '
                     f'der nicht darauf passt.')
        fresh, prev = [], None
        for o in roh['plan']:
            date = datetime.date.fromisoformat(o['date'])
            if prev is not None and date <= prev:
                sys.exit(f'{pfad.name}: Termin {o["date"]} folgt nicht auf {prev}')
            prev = date
            unknown = [i['id'] for i in o['ex'] if i['id'] not in catalog]
            if unknown:
                sys.exit(f'{pfad.name}: unbekannte Übung {unknown}')
            # Der Bodyweight-Modus hat seine eigene Satzzahl (siehe bw_saetze()
            # in build-plan.py). Fehlt sie, gilt die der Hantel-Fassung – aber
            # eine unsinnige darf nicht durchrutschen.
            for i in o['ex']:
                i.setdefault('bwSets', i['sets'])
                if not 1 <= i['bwSets'] <= 6:
                    sys.exit(f'{pfad.name}: {i["id"]} am {o["date"]} hat '
                             f'{i["bwSets"]} Bodyweight-Sätze')
            fresh.append({'n': len(fresh) + 1, 'date': o['date'], 'ex': o['ex']})
        print(f'{pfad.relative_to(ROOT)}: {len(fresh)} Einheiten '
              f'({fresh[0]["date"]} bis {fresh[-1]["date"]}), '
              f'Fokus "{roh.get("name", "Ausgewogen")}"')
        return {
            'name': roh.get('name', 'Aufbau'),
            'target': roh['target'],
            'derived': roh.get('derived', []),
            'cap': roh.get('cap', DEFAULT_CAP),
            'rest': roh.get('rest', dict(DEFAULT_REST)),
            'plan': fresh,
        }

    target, derived, rest, cap = {}, [], dict(DEFAULT_REST), DEFAULT_CAP
    varianten = {}
    if PLAN_OVERRIDE.exists():
        standard = lies_plan(PLAN_OVERRIDE)
        varianten['standard'] = standard
        target, derived = standard['target'], standard['derived']
        rest, cap = standard['rest'], standard['cap']
        plan = standard['plan']
        for pfad in sorted((ROOT / 'tools').glob(VARIANT_GLOB)):
            key = pfad.stem[len('plan-'):]
            varianten[key] = lies_plan(pfad)

    unused = set(meta) - set(catalog)
    if unused:
        sys.exit(f'Unbenutzte Eintraege in exercise-meta.json: {sorted(unused)}')

    groups = sorted({m for e in catalog.values() for m in e['db']['shares']})
    target = {m: target.get(m, DEFAULT_TARGET) for m in groups}
    if not varianten:
        varianten['standard'] = {'name': 'Aufbau', 'target': target, 'derived': derived,
                                 'cap': cap, 'rest': rest, 'plan': plan}
    for v in varianten.values():
        v['target'] = {m: v['target'].get(m, DEFAULT_TARGET) for m in groups}

    # Eine Umleitung ins Leere wäre schlimmer als gar keine: Sie sieht im Code
    # nach Sorgfalt aus und landet doch wieder beim stillen Rückfall.
    for alt, ziel in FOKUS_ERSATZ.items():
        if alt in varianten:
            sys.exit(f'{alt!r} steht in FOKUS_ERSATZ, existiert aber noch als Variante')
        if ziel['nach'] not in varianten:
            sys.exit(f'FOKUS_ERSATZ leitet {alt!r} auf {ziel["nach"]!r} – die Variante gibt es nicht')

    OUT.write_text(
        "// Auto-generiert von tools/build-data.py aus data/Workoutplan_mit_Bodyweight_Equivalent.xlsx.\n"
        "// Nicht von Hand bearbeiten - Plan in der Excel aendern und neu generieren.\n"
        "export const EXERCISES = " + json.dumps(list(catalog.values()), ensure_ascii=False, indent=2) + ";\n\n"
        "// Ein Eintrag je Trainingsfokus. Alle kommen aus derselben Rechnung in\n"
        "// tools/build-plan.py und unterscheiden sich nur in den Wochenzielen:\n"
        "//   name     wie der Fokus in der App heisst\n"
        "//   target   Saetze je Muskelgruppe und Woche, auf die der Plan gerechnet ist\n"
        "//   derived  Gruppen ohne eigenes Ziel - ihr Wert faellt aus den Gleichungen\n"
        "//   cap      Obergrenze: keine Gruppe darueber, indirekte Anteile eingerechnet\n"
        "//   rest     Mindestabstand in Tagen, bis eine Gruppe wieder direkt drankommt,\n"
        "//            und ab welchem Anteil eine Uebung als direkt fuer sie gilt\n"
        "//   plan     die Einheiten selbst\n"
        "export const PLANS = {\n"
        + "".join(
            f"  {json.dumps(key)}: {{\n"
            f"    name: {json.dumps(v['name'], ensure_ascii=False)},\n"
            f"    target: {json.dumps(v['target'], ensure_ascii=False)},\n"
            f"    derived: {json.dumps(v['derived'], ensure_ascii=False)},\n"
            f"    cap: {json.dumps(v['cap'])},\n"
            f"    rest: {json.dumps(v['rest'], ensure_ascii=False)},\n"
            f"    plan: {json.dumps(v['plan'], ensure_ascii=False, separators=(',', ':'))},\n"
            f"  }},\n"
            for key, v in varianten.items())
        + "};\n\n"
        "// Abgeschaffte Fokusse und ihr Nachfolger. Ein Fokus steht im Browser des\n"
        "// Nutzers; wird eine Variante gestrichen, findet der Browser beim naechsten\n"
        "// Laden einen Schluessel, den es nicht mehr gibt. Ohne diese Tabelle fiele er\n"
        "// still auf den Standardplan zurueck - und state.focus bliebe auf dem alten\n"
        "// Wert stehen, waehrend ein anderer Plan laeuft. js/app.js schreibt den Wert\n"
        "// beim Start um und sagt es dem Nutzer; `name` ist dafuer da, damit die App\n"
        "// den alten Plan noch benennen kann, obwohl es ihn nicht mehr gibt.\n"
        "export const FOKUS_ERSATZ = " + json.dumps(FOKUS_ERSATZ, ensure_ascii=False, indent=2) + ";\n\n"
        "// Welcher Fokus gilt, steht im Speicher des Browsers - unter demselben\n"
        "// Schluessel wie der uebrige Zustand. Hier gelesen und nicht in der App\n"
        "// gewaehlt, damit PLAN, TARGET und REST ueberall dasselbe meinen. Ein\n"
        "// Wechsel laedt die Seite neu; der Plan steckt in Hunderten von Zeilen,\n"
        "// und ein Tausch mitten im Betrieb hiesse, dass die halbe App noch mit\n"
        "// dem alten rechnet.\n"
        "const AKTIV = (() => {\n"
        "  try {\n"
        "    const key = JSON.parse(localStorage.getItem('workout.state.v1') || '{}').focus;\n"
        "    if (PLANS[key]) return PLANS[key];\n"
        "    // Abgeschaffter Fokus: zum benannten Nachfolger, nicht irgendwohin.\n"
        "    const ersatz = FOKUS_ERSATZ[key];\n"
        "    return (ersatz && PLANS[ersatz.nach]) || PLANS.standard;\n"
        "  } catch {\n"
        "    return PLANS.standard;   // privater Modus: kein Speicher, kein Fokus\n"
        "  }\n"
        "})();\n\n"
        "export const FOCUS = AKTIV;\n"
        "// Saetze je Muskelgruppe und Woche, auf die der Plan gerechnet ist.\n"
        "export const TARGET = AKTIV.target;\n"
        "// Obergrenze: keine Gruppe kommt darueber, indirekte Anteile eingerechnet.\n"
        "export const CAP = AKTIV.cap;\n"
        "// Gruppen ohne eigenes Ziel: ihr Wert faellt aus den uebrigen Gleichungen.\n"
        "export const DERIVED = AKTIV.derived;\n"
        "// Erholung: Mindestabstand in Tagen und ab welchem Anteil eine Uebung\n"
        "// als direkt fuer die Gruppe gilt.\n"
        "export const REST = AKTIV.rest;\n"
        "export const PLAN = AKTIV.plan;\n",
        encoding='utf-8',
    )
    print(f'{OUT.relative_to(ROOT)}: {len(catalog)} Uebungen, '
          f'{len(varianten)} Fokus-Varianten, {len(plan)} Einheiten je Variante, '
          f'Ziele {min(target.values())}–{max(target.values())} Sätze je Gruppe')


if __name__ == '__main__':
    main()
