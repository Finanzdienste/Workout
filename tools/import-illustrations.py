#!/usr/bin/env python3
"""Holt die Everkinetic-Illustrationen ins Projekt.

    git clone --depth 1 https://github.com/chaosbastler/opentraining-exercises /tmp/ot
    python3 tools/import-illustrations.py /tmp/ot

Kopiert die unten ausgewaehlten SVG-Paare (Start- und Endstellung) nach img/,
duennt sie dabei aus und schreibt img/CREDITS.md mit der vorgeschriebenen
Namensnennung.

Uebernommen werden nur Zeichnungen, die genauer sind als die gezeichnete Figur
aus js/figure.js. Wo Everkinetic die falsche Ausfuehrung zeigt - der dortige
Squat traegt eine Langhantel im Nacken, unser Plan sieht Goblet Squats vor -
oder gar nichts Passendes hat (Waden, Sliding Leg Curl, Pike Push-ups), bleibt
es bei der eigenen Figur.

Lizenz: die Bilder stehen unter CC BY-SA 3.0, Urheber Everkinetic. Das
Ausduennen macht sie zu einer Bearbeitung, die damit ebenfalls unter CC BY-SA
3.0 steht; CREDITS.md haelt das fest.
"""

import pathlib
import re
import shutil
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / 'img'

# Zielname -> Everkinetic-Basisname im svg/-Verzeichnis
WANTED = {
    'bridge':        ('Bridge', 'Hüftstreckung / Hip Thrust'),
    'pushup':        ('Push-ups', 'Liegestütze'),
    'pushup-feet':   ('Push-up-with-feet-on-an-exercise-ball', 'Füße-erhöhte Liegestütze'),
    'benchpress':    ('Bench-press', 'Drücken im Liegen / Floor Press'),
    'row':           ('Rear-deltoid-row', 'Einarmiges Rudern'),
    'reversefly':    ('Lying-rear-lateral-raise', 'Reverse Fly'),
    'lateral':       ('Dumbbell-lateral-raises', 'Seitheben'),
    'triceps':       ('Lying-triceps-extension-across-face', 'Liegende Trizepsstrecker'),
    'curl':          ('Biceps-curl', 'Bizeps-Curl'),
    'crunch':        ('Crunches', 'Crunches'),
}

NUM = re.compile(r'-?\d+\.\d{3,}')
DROP = re.compile(r'<(metadata|title|desc)\b.*?</\1>|<!--.*?-->|<\?xml[^>]*\?>', re.S)


def slim(svg):
    """Kommentare und Metadaten raus, Koordinaten auf eine Nachkommastelle."""
    svg = DROP.sub('', svg)
    svg = NUM.sub(lambda m: f'{float(m.group()):.1f}', svg)
    return re.sub(r'>\s+<', '><', svg).strip()


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    src = pathlib.Path(sys.argv[1]) / 'svg'
    if not src.is_dir():
        sys.exit(f'Kein svg/-Verzeichnis unter {src}')

    OUT.mkdir(exist_ok=True)
    for old in OUT.glob('*.svg'):
        old.unlink()

    rows, total = [], 0
    for name, (base, label) in sorted(WANTED.items()):
        for frame in (1, 2):
            source = src / f'{base}-{frame}.svg'
            if not source.exists():
                sys.exit(f'Fehlt: {source}')
            data = slim(source.read_text(encoding='utf-8', errors='replace'))
            target = OUT / f'{name}-{frame}.svg'
            target.write_text(data, encoding='utf-8')
            total += len(data)
        before = sum((src / f'{base}-{f}.svg').stat().st_size for f in (1, 2))
        after = sum((OUT / f'{name}-{f}.svg').stat().st_size for f in (1, 2))
        rows.append(f'| `{name}-1.svg`, `{name}-2.svg` | {label} | `{base}` |')
        print(f'  {name:14s} {before // 1024:4d} KB -> {after // 1024:3d} KB')

    (OUT / 'CREDITS.md').write_text(
        '# Bildnachweis\n\n'
        'Die Illustrationen in diesem Verzeichnis stammen von **Everkinetic** und stehen\n'
        'unter der Lizenz **[Creative Commons Attribution-ShareAlike 3.0 Unported]'
        '(https://creativecommons.org/licenses/by-sa/3.0/)**.\n\n'
        'Bezogen über [chaosbastler/opentraining-exercises]'
        '(https://github.com/chaosbastler/opentraining-exercises).\n\n'
        'Sie wurden **bearbeitet**: Metadaten entfernt und Koordinaten gerundet, um die\n'
        'Dateien zu verkleinern. In der App werden sie zusätzlich per CSS invertiert und\n'
        'eingefärbt, damit sie auf dunklem Grund lesbar sind. Als Bearbeitung stehen sie\n'
        'damit ebenfalls unter CC BY-SA 3.0.\n\n'
        '| Datei | Übung | Original |\n| --- | --- | --- |\n' + '\n'.join(rows) + '\n',
        encoding='utf-8')

    print(f'\n{len(WANTED)} Paare, {total // 1024} KB gesamt -> {OUT.relative_to(ROOT)}')


if __name__ == '__main__':
    main()
