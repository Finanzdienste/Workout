#!/usr/bin/env python3
"""Prueft, dass die App keinen Weg nach draussen hat.

    python3 tools/pruefung/keine-leitung.py

„Alles bleibt auf dem Geraet" steht im Willkommenstext, unter Mehr und in der
README. Das ist die einzige Zusage, die diese App macht, und sie ist genau so
lange wahr, wie niemand aus Versehen eine Zeile hineinschreibt, die etwas
verschickt.

tests/test-still.mjs prueft dasselbe im laufenden Browser und ist der
gruendlichere Nachweis. Diese Datei ist der schnelle: Sie braucht keinen
Browser, laeuft in einer Sekunde und faellt auch dann auf, wenn die
Browsertests gerade aus einem anderen Grund rot sind.

Erlaubt bleibt fetch() auf eigene Dateien - der Service Worker lebt davon.
Verboten ist alles, was eine fremde Adresse nennen koennte.
"""
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent.parent

DATEIEN = sorted(ROOT.glob('js/*.js')) + [ROOT / 'sw.js', ROOT / 'index.html']

# Was in keiner Zeile stehen darf.
VERBOTEN = [
    (re.compile(r'https?://'), 'eine Adresse'),
    (re.compile(r'\bXMLHttpRequest\b'), 'XMLHttpRequest'),
    (re.compile(r'navigator\.sendBeacon'), 'sendBeacon'),
    (re.compile(r'\bWebSocket\b'), 'WebSocket'),
    (re.compile(r'\bEventSource\b'), 'EventSource'),
    (re.compile(r'\bimportScripts\b'), 'importScripts'),
    (re.compile(r'<script[^>]+src="https?:'), 'ein Skript von auswaerts'),
    (re.compile(r'@import\s+url\('), 'ein CSS-Import'),
]

fehler = []
for datei in DATEIEN:
    text = datei.read_text(encoding='utf-8')
    for nr, zeile in enumerate(text.splitlines(), 1):
        for muster, was in VERBOTEN:
            if muster.search(zeile):
                rel = datei.relative_to(ROOT)
                fehler.append(f'{rel}:{nr}: {was} - {zeile.strip()[:90]}')

# Auch das Blatt: eingebundene Schriften waeren ein Aufruf bei jedem Start.
css = (ROOT / 'css' / 'styles.css').read_text(encoding='utf-8')
for muster, was in [(re.compile(r'https?://'), 'eine Adresse'),
                    (re.compile(r'@import'), 'ein CSS-Import'),
                    (re.compile(r'url\(\s*[\'"]?(?!data:)[a-z]+:'), 'eine externe Quelle')]:
    for nr, zeile in enumerate(css.splitlines(), 1):
        if muster.search(zeile):
            fehler.append(f'css/styles.css:{nr}: {was} - {zeile.strip()[:90]}')

if fehler:
    print('Die App haette einen Weg nach draussen:')
    for f in fehler:
        print('  ' + f)
    sys.exit(1)

print(f'{len(DATEIEN) + 1} Dateien geprueft: keine fremde Adresse, kein Versandweg.')
