#!/usr/bin/env python3
"""
Wer eine Datei aus dem Offline-Vorrat ändert, zählt VERSION in sw.js hoch.

Der Service Worker liefert die Dateien aus seinem Vorrat, bis sich VERSION
ändert. Bleibt sie stehen, trifft beim ersten Öffnen nach einem Update ein
frisches index.html auf ein altes app.js – gemessen bei der Durchsicht der
App: "Start 1 … neues app.js läuft = false, Start 2 … = true". Die Pflicht
stand in sw.js, aber niemand prüfte sie, und zwei Commits der Historie hatten
sie vergessen.

Verglichen wird mit einem Stand, der schon ausgeliefert ist:

    python3 tools/pruefung/versionspflicht.py                # gegen origin/main
    python3 tools/pruefung/versionspflicht.py <commit>       # gegen diesen

Lokal zählt auch, was noch nicht committet ist – der Vergleich läuft gegen den
Arbeitsbaum. Gibt es den Vergleichsstand nicht (flacher Klon, erster Push),
wird nichts geprüft und das gesagt.
"""
import re
import subprocess
import sys


def git(*args, check=True):
    r = subprocess.run(['git', *args], capture_output=True, text=True)
    if check and r.returncode:
        raise RuntimeError(r.stderr.strip())
    return r


def version(text):
    m = re.search(r"const VERSION = '([^']+)'", text)
    return m.group(1) if m else None


def shell(text):
    m = re.search(r'const SHELL = \[(.*?)\];', text, re.S)
    pfade = re.findall(r"'\./([^']*)'", m.group(1)) if m else []
    return {p or 'index.html' for p in pfade} | {'sw.js'}


def main():
    basis = sys.argv[1] if len(sys.argv) > 1 else 'origin/main'
    da = not re.fullmatch(r'0+', basis) and git(
        'rev-parse', '--verify', '--quiet', basis + '^{commit}', check=False).returncode == 0
    if not da:
        print(f'– Versionspflicht: kein Vergleichsstand ({basis}), nichts geprüft')
        return 0
    jetzt = open('sw.js', encoding='utf-8').read()
    vorher = git('show', f'{basis}:sw.js').stdout
    geaendert = set(git('diff', '--name-only', basis, '--').stdout.split())
    betroffen = sorted((geaendert & shell(jetzt)) - {'sw.js'})
    # sw.js selbst zählt nur, wenn sich mehr als die VERSION-Zeile geändert hat.
    ohne = lambda t: re.sub(r"const VERSION = '[^']+'", '', t)
    if ohne(jetzt) != ohne(vorher):
        betroffen.append('sw.js')
    if not betroffen:
        print(f'✓ Versionspflicht: keine Datei aus dem Offline-Vorrat geändert (gegen {basis})')
        return 0
    if version(jetzt) == version(vorher):
        print(f'✗ Versionspflicht: {", ".join(betroffen)} geändert, aber VERSION in sw.js steht '
              f'weiter auf {version(jetzt)} (wie in {basis}). Hochzählen, sonst läuft beim ersten '
              'Öffnen nach dem Update eine Mischung aus alten und neuen Dateien.')
        return 1
    print(f'✓ Versionspflicht: {version(vorher)} → {version(jetzt)} ({len(betroffen)} Dateien)')
    return 0


if __name__ == '__main__':
    sys.exit(main())
