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
                    'weightNote': m['weightNote'],
                    'equip': m['equip'],      # Geraet in der Hantel-Variante
                    'db': {'name': db['name'], 'reps': db['reps'], 'equip': m['dbEquip'],
                           'cue': m['dbCue'], 'rest': m['dbRest'], 'pattern': m['dbPattern'],
                           'shares': m['dbShares'], 'muscles': muscles(m['dbShares'])},
                    'bw': {'name': bw['name'], 'reps': bw['reps'], 'equip': m['bwEquip'],
                           'cue': m['bwCue'], 'rest': m['bwRest'], 'pattern': m['bwPattern'],
                           'shares': m['bwShares'], 'muscles': muscles(m['bwShares'])},
                }
            elif (entry['db']['reps'], entry['bw']['name'], entry['bw']['reps']) != (db['reps'], bw['name'], bw['reps']):
                sys.exit(f'{date}: widerspruechliche Angaben fuer {key!r}')
            items.append({'id': key, 'sets': db['sets']})

        plan.append({'n': len(plan) + 1, 'date': date, 'ex': items})

    # Der Trainingsplan darf komplett aus tools/plan.json kommen: Termine,
    # Auswahl und Satzzahlen. Die Excel bleibt Quelle für die Übungen selbst –
    # Namen, Wiederholungen, Hinweise und das Bodyweight-Äquivalent. Datei
    # löschen und neu generieren stellt den Originalplan wieder her.
    if PLAN_OVERRIDE.exists():
        override = json.loads(PLAN_OVERRIDE.read_text(encoding='utf-8'))
        fresh, prev = [], None
        for o in override:
            date = datetime.date.fromisoformat(o['date'])
            if prev is not None and date <= prev:
                sys.exit(f'{PLAN_OVERRIDE.name}: Termin {o["date"]} folgt nicht auf {prev}')
            prev = date
            unknown = [i['id'] for i in o['ex'] if i['id'] not in catalog]
            if unknown:
                sys.exit(f'{PLAN_OVERRIDE.name}: unbekannte Übung {unknown}')
            fresh.append({'n': len(fresh) + 1, 'date': o['date'], 'ex': o['ex']})
        print(f'{PLAN_OVERRIDE.relative_to(ROOT)}: {len(fresh)} Einheiten übernommen '
              f'({fresh[0]["date"]} bis {fresh[-1]["date"]}), Excel liefert nur die Übungen')
        plan = fresh

    unused = set(meta) - set(catalog)
    if unused:
        sys.exit(f'Unbenutzte Eintraege in exercise-meta.json: {sorted(unused)}')

    OUT.write_text(
        "// Auto-generiert von tools/build-data.py aus data/Workoutplan_mit_Bodyweight_Equivalent.xlsx.\n"
        "// Nicht von Hand bearbeiten - Plan in der Excel aendern und neu generieren.\n"
        "export const EXERCISES = " + json.dumps(list(catalog.values()), ensure_ascii=False, indent=2) + ";\n\n"
        "export const PLAN = " + json.dumps(plan, ensure_ascii=False, separators=(',', ':')) + ";\n",
        encoding='utf-8',
    )
    print(f'{OUT.relative_to(ROOT)}: {len(catalog)} Uebungen, {len(plan)} Einheiten')


if __name__ == '__main__':
    main()
