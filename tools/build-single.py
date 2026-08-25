#!/usr/bin/env python3
"""Baut dist/workout.html – die komplette App in einer einzigen Datei.

    python3 tools/build-single.py

CSS und alle Module werden eingebettet, sodass die Datei ohne Server und ohne
Netz laeuft: per Doppelklick, aus einer Cloud, als Mail-Anhang. Die modulare
Fassung unter index.html bleibt die Arbeitsgrundlage; diese Datei ist nur das
Ergebnis zum Weitergeben.

Die ES-Module werden dabei in Abhaengigkeitsreihenfolge aneinandergehaengt und
ihre import/export-Zeilen entfernt. Fuer den Namensraum 'store', den app.js
benutzt, wird ein Objekt aus den exportierten Namen von store.js gebaut.
"""

import pathlib
import json
import base64
import re
import sys
from urllib.parse import quote

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / 'dist' / 'workout.html'

# Reihenfolge = Abhaengigkeitsreihenfolge
MODULES = ['js/dates.js', 'js/data.js', 'js/figure.js', 'js/body.js', 'js/chart.js',
           'js/injuries.js', 'js/audio.js', 'js/store.js', 'js/app.js']

IMPORT_RE = re.compile(r'^\s*import\s.+?;\s*$', re.MULTILINE)
EXPORT_RE = re.compile(r'^(\s*)export\s+(?=(?:const|let|var|function|class)\b)', re.MULTILINE)
TOPLEVEL_RE = re.compile(
    r'^(?:export\s+)?(?:const|let|var|function|class)\s+([A-Za-z_$][\w$]*)', re.MULTILINE)
EXPORTED_NAME_RE = re.compile(
    r'^\s*export\s+(?:const|let|var|function|class)\s+([A-Za-z_$][\w$]*)', re.MULTILINE)


def strip_module_syntax(src, path):
    if 'export {' in src or 'export default' in src or 'export *' in src:
        sys.exit(f'{path}: nur benannte Inline-Exporte werden unterstuetzt')
    return EXPORT_RE.sub(r'\1', IMPORT_RE.sub('', src)).strip()


def main():
    html = (ROOT / 'index.html').read_text(encoding='utf-8')
    css = (ROOT / 'css' / 'styles.css').read_text(encoding='utf-8')

    chunks = []
    for rel in MODULES:
        path = ROOT / rel
        src = path.read_text(encoding='utf-8')
        chunks.append(f'/* ===== {rel} ===== */\n{strip_module_syntax(src, rel)}')
        if rel == 'js/store.js':
            names = EXPORTED_NAME_RE.findall(src)
            if not names:
                sys.exit('js/store.js: keine Exporte gefunden')
            # app.js spricht den Store als Namensraum an
            chunks.append('const store = { ' + ', '.join(sorted(names)) + ' };')

    # Alle Module landen in EINEM Gueltigkeitsbereich - gleiche Namen auf
    # oberster Ebene wuerden das ganze Skript zum Absturz bringen, waehrend die
    # modulare Fassung weiterlaeuft. Deshalb hier hart pruefen.
    seen = {}
    for rel in MODULES:
        for name in TOPLEVEL_RE.findall((ROOT / rel).read_text(encoding='utf-8')):
            if name in seen:
                sys.exit(f'Namenskollision {name!r}: {seen[name]} und {rel} '
                         f'- im Buendel teilen sich alle Module einen Gueltigkeitsbereich')
            seen[name] = rel

    script = '\n\n'.join(chunks)
    if '</script' in script:
        sys.exit('Skriptinhalt enthaelt "</script" und wuerde das Dokument zerreissen')

    # Externe Verweise durch die eingebetteten Fassungen ersetzen
    html = html.replace(
        '<link rel="stylesheet" href="css/styles.css">',
        f'<style>\n{css}\n</style>')
    html = html.replace(
        '<script type="module" src="js/app.js"></script>',
        f'<script type="module">\n{script}\n</script>')
    html = re.sub(r'^\s*<link rel="manifest".*\n', '', html, flags=re.MULTILINE)

    # Symbole als data:-URI einbetten, sonst zeigte die Einzeldatei ins Leere.
    # Das SVG bleibt lesbar eingebettet, das PNG fürs Startbildschirm-Symbol
    # muss als base64 mit – Android-Launcher nehmen kein SVG.
    icon = (ROOT / 'icon.svg').read_text(encoding='utf-8')
    icon_uri = 'data:image/svg+xml,' + quote(icon, safe='')
    html = html.replace('href="icon.svg"', f'href="{icon_uri}"')
    png = base64.b64encode((ROOT / 'icon-192.png').read_bytes()).decode()
    html = html.replace('href="icon-192.png"', f'href="data:image/png;base64,{png}"')

    for leftover in ('href="css/', 'src="js/', 'href="manifest', 'href="icon'):
        if leftover in html:
            sys.exit(f'Externer Verweis nicht ersetzt: {leftover}')

    OUT.parent.mkdir(exist_ok=True)
    OUT.write_text(html, encoding='utf-8')
    print(f'{OUT.relative_to(ROOT)}: {len(html) / 1024:.0f} KB, alles eingebettet')


if __name__ == '__main__':
    main()
