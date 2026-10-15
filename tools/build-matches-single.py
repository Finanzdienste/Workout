#!/usr/bin/env python3
"""Baut dist/matches.html – die Match-Tabelle in einer einzigen Datei.

    python3 tools/build-matches-single.py

CSS und alle Module werden eingebettet, sodass die Datei ohne Server und ohne
Netz laeuft: aufs Handy legen, antippen, fertig. Die modulare Fassung unter
matches/index.html bleibt die Arbeitsgrundlage; diese Datei ist nur das
Ergebnis zum Mitnehmen.

Ein Unterschied zu tools/build-single.py, und er hat einen Grund: Die
Reihenfolge der Module steht hier **nicht** in einer Liste, sondern wird aus den
import-Zeilen gelesen. Bei der Workout-App fehlte js/ics.js jahrelang in genau
so einer Liste, und der Kalenderexport der Einzeldatei endete deshalb in einem
ReferenceError, waehrend er unter index.html lief. Eine Liste, die jemand von
Hand pflegen muss, geht irgendwann auseinander; die import-Zeilen koennen es
nicht, denn ohne sie laeuft die modulare Fassung selbst nicht.
"""

import base64
import pathlib
import re
import sys
from urllib.parse import quote

ROOT = pathlib.Path(__file__).resolve().parent.parent
QUELLE = ROOT / 'matches'
OUT = ROOT / 'dist' / 'matches.html'

IMPORT_RE = re.compile(r'^\s*import\s.+?;\s*$', re.MULTILINE | re.DOTALL)
VON_RE = re.compile(r"""from\s+['"]\./([\w.-]+\.js)['"]""")
DEKL = r'(?:const|let|var|class|function|async\s+function)'
EXPORT_RE = re.compile(rf'^(\s*)export\s+(?={DEKL}\b)', re.MULTILINE)
TOPLEVEL_RE = re.compile(rf'^(?:export\s+)?{DEKL}\s+([A-Za-z_$][\w$]*)', re.MULTILINE)


def modulsyntax_entfernen(quelltext, name):
    if 'export {' in quelltext or 'export default' in quelltext or 'export *' in quelltext:
        sys.exit(f'{name}: nur benannte Inline-Exporte werden unterstuetzt')
    return EXPORT_RE.sub(r'\1', IMPORT_RE.sub('', quelltext)).strip()


def reihenfolge(dateien):
    """Abhaengigkeitsreihenfolge aus den import-Zeilen (Tiefensuche).

    Ein Kreis waere in Modulen erlaubt, im Buendel aber nicht aufloesbar –
    deshalb bricht die Suche darauf ab, statt eine Reihenfolge zu erfinden.
    """
    quelle = {p.name: p.read_text(encoding='utf-8') for p in dateien}
    fertig, unterwegs, sortiert = set(), [], []

    def besuche(name):
        if name in fertig:
            return
        if name in unterwegs:
            sys.exit('Kreis in den Importen: ' + ' -> '.join(unterwegs + [name]))
        unterwegs.append(name)
        for gebraucht in VON_RE.findall(quelle[name]):
            if gebraucht not in quelle:
                sys.exit(f'{name} importiert {gebraucht}, das es in matches/js/ nicht gibt')
            besuche(gebraucht)
        unterwegs.pop()
        fertig.add(name)
        sortiert.append(name)

    # app.js zuerst, damit alles Erreichbare mitkommt; danach der Rest, damit
    # ein Modul, das gerade niemand importiert, nicht stillschweigend fehlt.
    for name in ['app.js'] + sorted(quelle):
        if name in quelle:
            besuche(name)
    return sortiert, quelle


def main():
    dateien = sorted((QUELLE / 'js').glob('*.js'))
    if not dateien:
        sys.exit('matches/js/ ist leer')
    sortiert, quelle = reihenfolge(dateien)

    # Alle Module landen in EINEM Gueltigkeitsbereich – gleiche Namen auf
    # oberster Ebene brechen das ganze Skript, waehrend die modulare Fassung
    # weiterlaeuft. Deshalb hier hart pruefen statt hoffen.
    gesehen = {}
    for name in sortiert:
        for bezeichner in TOPLEVEL_RE.findall(quelle[name]):
            if bezeichner in gesehen:
                sys.exit(f'Namenskollision {bezeichner!r}: {gesehen[bezeichner]} und {name} '
                         '- im Buendel teilen sich alle Module einen Gueltigkeitsbereich')
            gesehen[bezeichner] = name

    skript = '\n\n'.join(
        f'/* ===== matches/js/{name} ===== */\n{modulsyntax_entfernen(quelle[name], name)}'
        for name in sortiert)

    uebrig = re.search(r'^\s*(?:import|export)\s', skript, re.MULTILINE)
    if uebrig:
        zeile = skript[:uebrig.start()].count('\n') + 1
        sys.exit(f'Modulsyntax nicht entfernt (Zeile {zeile}): '
                 f'{skript.split(chr(10))[zeile - 1].strip()!r}')
    if '</script' in skript:
        sys.exit('Skriptinhalt enthaelt "</script" und wuerde das Dokument zerreissen')

    html = (QUELLE / 'index.html').read_text(encoding='utf-8')
    css = (QUELLE / 'css' / 'matches.css').read_text(encoding='utf-8')
    html = html.replace('<link rel="stylesheet" href="css/matches.css">', f'<style>\n{css}\n</style>')
    html = html.replace('<script type="module" src="js/app.js"></script>',
                        f'<script type="module">\n{skript}\n</script>')

    # Das Symbol als data:-URI, sonst zeigt die Einzeldatei ins Leere.
    icon = (ROOT / 'icon.svg').read_text(encoding='utf-8')
    html = html.replace('href="../icon.svg"', 'href="data:image/svg+xml,' + quote(icon, safe='') + '"')
    # Fuers Startbildschirm-Symbol: Android-Launcher nehmen kein SVG.
    png = base64.b64encode((ROOT / 'icon-192.png').read_bytes()).decode()
    html = html.replace('<link rel="icon"',
                        f'<link rel="apple-touch-icon" href="data:image/png;base64,{png}">\n<link rel="icon"')

    # Der Wachposten: Bleibt irgendwo ein Verweis nach draussen stehen, ist die
    # Datei genau dann kaputt, wenn man sie am dringendsten braucht – offline.
    for rest in ('href="css/', 'src="js/', 'href="../', 'href="icon'):
        if rest in html:
            sys.exit(f'Externer Verweis nicht ersetzt: {rest}')

    OUT.parent.mkdir(exist_ok=True)
    OUT.write_text(html, encoding='utf-8')
    print(f'{OUT.relative_to(ROOT)}: {len(html) / 1024:.0f} KB, '
          f'{len(sortiert)} Module in der Reihenfolge {" -> ".join(sortiert)}')


if __name__ == '__main__':
    main()
