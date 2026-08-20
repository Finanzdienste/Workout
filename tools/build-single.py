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
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / 'dist' / 'workout.html'

# Reihenfolge = Abhaengigkeitsreihenfolge
MODULES = ['js/dates.js', 'js/data.js', 'js/store.js', 'js/app.js']

IMPORT_RE = re.compile(r'^\s*import\s.+?;\s*$', re.MULTILINE)
EXPORT_RE = re.compile(r'^(\s*)export\s+(?=(?:const|let|var|function|class)\b)', re.MULTILINE)
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

    for leftover in ('href="css/', 'src="js/', 'href="manifest'):
        if leftover in html:
            sys.exit(f'Externer Verweis nicht ersetzt: {leftover}')

    OUT.parent.mkdir(exist_ok=True)
    OUT.write_text(html, encoding='utf-8')
    print(f'{OUT.relative_to(ROOT)}: {len(html) / 1024:.0f} KB, alles eingebettet')


if __name__ == '__main__':
    main()
