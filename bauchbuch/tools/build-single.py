#!/usr/bin/env python3
"""Baut dist/bauchbuch.html - die komplette App in einer einzigen Datei.

    python3 tools/build-single.py

CSS und alle Module werden eingebettet, sodass die Datei ohne Server und ohne
Netz laeuft: per Doppelklick, aus einer Cloud, als Anhang einer Nachricht. Die
modulare Fassung unter index.html bleibt die Arbeitsgrundlage; diese Datei ist
nur das Ergebnis zum Weitergeben.

Fuer diese App ist das nicht bloss Bequemlichkeit. Wer das Tagebuch nicht ins
Netz stellen will, braucht gar keine Adresse: eine Datei, einmal geschickt,
auf den Startbildschirm gelegt, fertig. Alles Eingetragene liegt danach im
Browser des Geraets und war nie irgendwo sonst.

Die ES-Module werden in Abhaengigkeitsreihenfolge aneinandergehaengt und ihre
import/export-Zeilen entfernt. Fuer den Namensraum 'store', den app.js benutzt,
wird ein Objekt aus den exportierten Namen von store.js gebaut.
"""

import pathlib
import base64
import re
import sys
from urllib.parse import quote

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / 'dist' / 'bauchbuch.html'

# Reihenfolge = Abhaengigkeitsreihenfolge. Wer das aendert, merkt es hier
# zuerst: Im Buendel gibt es keine Importe, die eine Reihenfolge erzwingen.
MODULES = ['js/datum.js', 'js/text.js', 'js/daten.js', 'js/mittel.js', 'js/chart.js',
           'js/store.js', 'js/auswertung.js', 'js/bericht.js', 'js/app.js']

IMPORT_RE = re.compile(r'^\s*import\s.+?;\s*$', re.MULTILINE | re.DOTALL)
IMPORT_BLOCK_RE = re.compile(r'^\s*import\s+\{[^}]*\}\s+from\s+\'[^\']+\';\s*$',
                             re.MULTILINE | re.DOTALL)
EXPORT_RE = re.compile(r'^(\s*)export\s+(?=(?:const|let|var|function|class)\b)', re.MULTILINE)
TOPLEVEL_RE = re.compile(
    r'^(?:export\s+)?(?:const|let|var|function|class)\s+([A-Za-z_$][\w$]*)', re.MULTILINE)
EXPORTED_NAME_RE = re.compile(
    r'^\s*export\s+(?:const|let|var|function|class)\s+([A-Za-z_$][\w$]*)', re.MULTILINE)


def ohne_modulsyntax(src, pfad):
    if 'export {' in src or 'export default' in src or 'export *' in src:
        sys.exit(f'{pfad}: nur benannte Inline-Exporte werden unterstuetzt')
    # Mehrzeilige Importe zuerst, danach die einzeiligen Reste.
    src = IMPORT_BLOCK_RE.sub('', src)
    src = re.sub(r'^\s*import\s+[^;]+;\s*$', '', src, flags=re.MULTILINE)
    return EXPORT_RE.sub(r'\1', src).strip()


def main():
    html = (ROOT / 'index.html').read_text(encoding='utf-8')
    css = (ROOT / 'css' / 'styles.css').read_text(encoding='utf-8')

    stuecke = []
    for rel in MODULES:
        src = (ROOT / rel).read_text(encoding='utf-8')
        stuecke.append(f'/* ===== {rel} ===== */\n{ohne_modulsyntax(src, rel)}')
        if rel == 'js/store.js':
            namen = EXPORTED_NAME_RE.findall(src)
            if not namen:
                sys.exit('js/store.js: keine Exporte gefunden')
            # app.js spricht den Speicher als Namensraum an
            stuecke.append('const store = { ' + ', '.join(sorted(namen)) + ' };')

    # Alle Module landen in EINEM Gueltigkeitsbereich - gleiche Namen auf
    # oberster Ebene wuerden das ganze Skript zum Absturz bringen, waehrend die
    # modulare Fassung weiterlaeuft. Deshalb hier hart pruefen.
    gesehen = {}
    for rel in MODULES:
        for name in TOPLEVEL_RE.findall((ROOT / rel).read_text(encoding='utf-8')):
            if name in gesehen:
                sys.exit(f'Namenskollision {name!r}: {gesehen[name]} und {rel} '
                         '- im Buendel teilen sich alle Module einen Gueltigkeitsbereich')
            gesehen[name] = rel
    if 'store' in gesehen:
        sys.exit(f'{gesehen["store"]}: der Name "store" ist im Buendel fuer den '
                 'Namensraum von store.js reserviert')

    skript = '\n\n'.join(stuecke)
    if '</script' in skript:
        sys.exit('Skriptinhalt enthaelt "</script" und wuerde das Dokument zerreissen')

    html = html.replace(
        '<link rel="stylesheet" href="css/styles.css">',
        f'<style>\n{css}\n</style>')
    html = html.replace(
        '<script type="module" src="js/app.js"></script>',
        f'<script type="module">\n{skript}\n</script>')
    html = re.sub(r'^\s*<link rel="manifest".*\n', '', html, flags=re.MULTILINE)

    # Symbole als data:-URI einbetten, sonst zeigte die Einzeldatei ins Leere.
    # Das SVG bleibt lesbar eingebettet, das PNG fuer den Startbildschirm muss
    # als base64 mit - Android-Launcher nehmen kein SVG.
    icon = (ROOT / 'icon.svg').read_text(encoding='utf-8')
    html = html.replace('href="icon.svg"',
                        'href="data:image/svg+xml,' + quote(icon, safe='') + '"')
    png = base64.b64encode((ROOT / 'icon-192.png').read_bytes()).decode()
    html = html.replace('href="icon-192.png"', f'href="data:image/png;base64,{png}"')

    for rest in ('href="css/', 'src="js/', 'href="manifest', 'href="icon'):
        if rest in html:
            sys.exit(f'Externer Verweis nicht ersetzt: {rest}')

    OUT.parent.mkdir(exist_ok=True)
    OUT.write_text(html, encoding='utf-8')
    print(f'{OUT.relative_to(ROOT)}: {len(html) / 1024:.0f} KB, alles eingebettet')


if __name__ == '__main__':
    main()
