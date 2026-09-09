#!/usr/bin/env python3
"""Liest Tinder, Bumble und Hinge vom Bildschirm des Telefons mit.

    python3 matches/android-lesen.py --schauen            # zusehen und sammeln
    python3 matches/android-lesen.py --abzug bumble.xml   # einmal abziehen, zum Nachsehen

Ein Weg fuer alle drei
----------------------

Der Bildschirmleser interessiert sich nicht dafuer, welche App gerade vorn ist -
er liest Text. Deshalb reicht **ein** Durchgang fuer alle drei: durch Tinder
gehen, zu Bumble wechseln, dann zu Hinge. Jede gefundene Zeile bekommt die App,
die im Moment des Lesens den Fokus hatte (siehe PAKETE weiter unten). Am Ende
liegt eine Datei da, nicht drei.

Fuer Tinder gibt es zusaetzlich matches/mitlesen.user.js im Browser. Das bringt
dort auch das Match-Datum mit - aber es ist ein zweiter Weg mit eigener
Einrichtung, und wer alle drei an einem Nachmittag erledigen will, braucht ihn
nicht.

Warum vom Bildschirm und nicht aus dem Netz
-------------------------------------------

Bumble hat seine Weboberflaeche am 8. August 2026 abgeschaltet, Hinge hatte nie
eine, und Tinder liegt ohnehin als App auf dem Telefon. Um an mehr zu kommen als
an das, was auf dem Schirm steht, bleiben zwei Moeglichkeiten, und sie sind sehr
verschieden teuer:

*Den Datenverkehr der App mitlesen.* Beide Apps pruefen das Serverzertifikat
gegen ihr eigenes. Ein Proxy dazwischen braucht also sein Zertifikat im
Systemspeicher, und das heisst: Bootloader entsperren, rooten, dazu Frida gegen
das Pinning. Bei Samsung setzt das Entsperren eine E-Fuse - Knox steht danach
dauerhaft auf 0x1, Samsung Pay und Secure Folder sind unwiderruflich weg, auch
nach erneutem Sperren, und das Geraet wird dabei geloescht. Beim S21 mit
Snapdragon (USA, Kanada) laesst sich der Bootloader ueberhaupt nicht entsperren.

*Den Bildschirm lesen.* Android gibt ueber `uiautomator` den Textbaum der gerade
sichtbaren App heraus - Name und "4 km entfernt" stehen dort als Text. Kein
Root, keine Installation, nur USB-Debugging und adb.

Der zweite Weg kostet nichts Unwiderrufliches und ist serverseitig unauffaellig:
Es entsteht **kein einziges zusaetzliches Netzpaket**, weil nichts abgefragt
wird. Was die App laedt, laedt sie, weil ein Mensch scrollt.

Zusehen statt steuern
---------------------

Das Programm wischt und tippt nicht selbst. Es sieht alle zwei Sekunden nach,
was auf dem Schirm steht, und merkt sich, was nach einem Menschen aussieht. Du
gehst durch deine Matches wie sonst auch; die Entfernung steht bei beiden Apps
im Profil, nicht in der Liste, also musst du die Profile ohnehin oeffnen.

Automatisch zu wischen waere die naheliegende Ergaenzung und ist bewusst nicht
drin: Ein Programm, das im Sekundentakt durch fremde Profile blaettert, ist
genau das Muster, das auffaellt - und ein falsch gesetzter Wisch ist auf einer
Dating-App ein Like, das man nicht zurueckholt.

Ehrlich dazugesagt: Automatisiertes Auslesen widerspricht den
Nutzungsbedingungen beider Dienste, auch dieses. Das Risiko ist gering, aber
nicht null, und es ist deins.

Zwei Arten zu laufen
--------------------

**Am Rechner**, per Kabel - der einfache Fall:

1. Telefon: Einstellungen -> Telefoninfo -> Softwareinformationen -> siebenmal
   auf "Buildnummer" tippen, dann Entwickleroptionen -> USB-Debugging.
2. Rechner: `adb` (Android Platform Tools). Kabel dran, Nachfrage bestaetigen.
3. `adb devices` muss das Geraet zeigen.

**Auf dem Telefon selbst**, ohne Rechner. Seit Android 11 kann sich ein Geraet
ueber das WLAN-Debugging selbst bedienen: adb laeuft in Termux und verbindet
sich auf 127.0.0.1. Das Galaxy S21 kann das.

1. F-Droid -> Termux. Darin: `pkg install android-tools python`
2. Entwickleroptionen -> **WLAN-Debugging** einschalten.
3. Dort *Geraet mit Kopplungscode koppeln* antippen. Es erscheinen ein
   sechsstelliger Code und ein Port. In Termux, mit beidem:

       python3 android-lesen.py --koppeln PORT CODE

4. Zurueck in der Hauptansicht des WLAN-Debuggings steht ein **anderer** Port.
   Damit:

       python3 android-lesen.py --verbinden PORT

   Gekoppelt wird einmal, verbunden nach jedem Neustart neu - der Port aendert
   sich dabei jedes Mal. Das ist laestig und liegt an Android, nicht hier.
5. `termux-wake-lock`, damit Termux im Hintergrund weiterlaeuft, waehrend du in
   Bumble bist. Dann `--schauen` wie sonst.

Herauskommt eine Datei im selben Format wie beim Browser-Mitleser, die die
Match-Tabelle unter *Datenauskunft einlesen* nimmt. In Termux landet sie in
den Downloads, wenn `termux-setup-storage` gelaufen ist - sonst muesste man sie
aus dem Termux-Verzeichnis heraussuchen, an das der Browser nicht herankommt.
"""

import argparse
import json
import os
import pathlib
import re
import subprocess
import sys
import time
import xml.etree.ElementTree as ET
from datetime import date, datetime, timezone

MEILE = 1.609344

# "4 km entfernt", "weniger als 1 km", "3 miles away", "800 m entfernt"
KM_RE = re.compile(r'(\d+(?:[.,]\d+)?)\s*(km|kilometer)\b', re.I)
METER_RE = re.compile(r'(\d+(?:[.,]\d+)?)\s*(m|meter)\b(?!i)', re.I)
MEILEN_RE = re.compile(r'(\d+(?:[.,]\d+)?)\s*(mi|mile|miles|meilen)\b', re.I)
# "weniger als 1 km entfernt" - die Zahl ist eine Obergrenze, kein Messwert.
UNGEFAEHR_RE = re.compile(r'weniger als|less than|under', re.I)

# "Anna, 28" - Name und Alter stehen bei beiden Apps in einer Zeile.
NAME_ALTER_RE = re.compile(r'^([^\d,]{2,30}?)\s*,\s*(\d{2})$')

# Woerter, die auf einem Dating-Bildschirm gross geschrieben herumstehen, ohne
# jemand zu sein. Die Liste ist kurz und muss es auch sein: Sie darf niemals
# einen echten Vornamen enthalten, sonst fehlt genau der eine still.
KEINE_NAMEN = {
    'matches', 'chats', 'nachrichten', 'entdecken', 'profil', 'einstellungen',
    'beliebt', 'filter', 'premium', 'boost', 'likes', 'gesendet', 'neu',
    'heute', 'gestern', 'online', 'aktiv', 'verbindungen', 'unterhaltungen',
    'standort', 'entfernung', 'suchen', 'mehr', 'weiter', 'zurueck', 'zurück',
    'senden', 'abbrechen', 'fertig', 'teilen', 'melden', 'blockieren',
    'discover', 'settings', 'messages', 'people', 'you', 'likes you',
    # Und die Staedte, die auf jedem Profil unter dem Namen stehen. Ohne sie
    # bekaeme die Entfernung im Zweifel den Wohnort als Namen angehaengt, und in
    # der Tabelle staende "Hamburg, 4 km" zwischen lauter Menschen.
    #
    # Die Schranke dabei: In dieser Liste darf niemals etwas stehen, das auch
    # ein Vorname sein kann - sonst fehlt genau die eine Person still. Deshalb
    # nur Staedtenamen, die im deutschsprachigen Raum niemand heisst; "Paris"
    # und "Florenz" stehen bewusst nicht da.
    'berlin', 'hamburg', 'münchen', 'muenchen', 'köln', 'koeln', 'frankfurt',
    'stuttgart', 'düsseldorf', 'duesseldorf', 'leipzig', 'dortmund', 'essen',
    'bremen', 'dresden', 'hannover', 'nürnberg', 'nuernberg', 'duisburg',
    'bochum', 'wuppertal', 'bielefeld', 'bonn', 'münster', 'muenster',
    'karlsruhe', 'mannheim', 'augsburg', 'wiesbaden', 'potsdam', 'wien',
    'zürich', 'zuerich', 'basel', 'graz', 'linz', 'salzburg', 'innsbruck',
}


def adb(*args, binaer=False):
    """Ein adb-Aufruf. Bricht mit einer lesbaren Meldung ab, statt zu stolpern."""
    try:
        fertig = subprocess.run(['adb', *args], capture_output=True, timeout=30)
    except FileNotFoundError:
        sys.exit('adb nicht gefunden. Android Platform Tools installieren und in den PATH legen.')
    except subprocess.TimeoutExpired:
        sys.exit('adb antwortet nicht. Kabel, Bildschirm entsperrt, USB-Debugging bestaetigt?')
    if fertig.returncode != 0:
        sys.exit('adb ' + ' '.join(args) + ':\n' + fertig.stderr.decode('utf-8', 'replace').strip())
    return fertig.stdout if binaer else fertig.stdout.decode('utf-8', 'replace')


def in_termux():
    """Laufen wir auf dem Telefon selbst?"""
    return 'TERMUX_VERSION' in os.environ or 'com.termux' in os.environ.get('PREFIX', '')


def geraet_pruefen():
    zeilen = [z for z in adb('devices').splitlines()[1:] if z.strip()]
    angeschlossen = [z.split()[0] for z in zeilen if z.split()[1:2] == ['device']]
    if not angeschlossen:
        if in_termux():
            sys.exit('Kein Geraet. Auf dem Telefon selbst braucht es das WLAN-Debugging:\n'
                     '  1. Entwickleroptionen -> WLAN-Debugging einschalten\n'
                     '  2. "Geraet mit Kopplungscode koppeln" -> --koppeln PORT CODE\n'
                     '  3. Port aus der Hauptansicht -> --verbinden PORT\n'
                     'Nach jedem Neustart des Telefons ist Schritt 3 noetig, mit neuem Port.')
        sys.exit('Kein Geraet. `adb devices` zeigt nichts Verbundenes - Kabel dran, '
                 'Bildschirm entsperrt, die Nachfrage auf dem Telefon bestaetigt?')
    return angeschlossen[0]


def koppeln(port, code):
    """Einmalig: das Telefon mit sich selbst (oder dem Rechner) koppeln."""
    print(adb('pair', f'127.0.0.1:{port}', code).strip())
    print('Jetzt den *anderen* Port aus der Hauptansicht des WLAN-Debuggings nehmen '
          'und --verbinden damit aufrufen.')


def verbinden(port):
    print(adb('connect', f'127.0.0.1:{port}').strip())
    geraet_pruefen()
    # Seit Android 12 raeumt das System "phantom processes" weg - Kindprozesse,
    # die nicht zu einer sichtbaren App gehoeren. uiautomator ist genau so einer
    # und wird sonst mitten im Zusehen abgeschossen. Einmal abschalten, sonst
    # bricht das Sammeln nach ein paar Minuten ohne erkennbaren Grund ab.
    try:
        adb('shell', 'settings', 'put', 'global',
            'settings_enable_monitor_phantom_procs', 'false')
        print('Verbunden. (Die Aufsicht ueber Hintergrundprozesse ist abgeschaltet, '
              'sonst beendet Android das Mitlesen nach wenigen Minuten von selbst.)')
    except SystemExit:
        print('Verbunden. Die Aufsicht ueber Hintergrundprozesse liess sich nicht '
              'abschalten - bricht das Sammeln spaeter ab, ist das der Grund.')


def ablageort(name):
    """Wohin die Datei geschrieben wird.

    In Termux in die Downloads, sofern `termux-setup-storage` gelaufen ist: Das
    Termux-Verzeichnis liegt in den App-Daten, und der Browser, der die Datei
    gleich einlesen soll, kommt dort nicht heran. Eine Datei, die man nicht
    aufmachen kann, ist keine.
    """
    if in_termux():
        downloads = pathlib.Path.home() / 'storage' / 'downloads'
        if downloads.is_dir():
            return downloads / name
        print('Hinweis: `termux-setup-storage` ist nicht gelaufen - die Datei landet '
              'im Termux-Verzeichnis, an das der Browser nicht herankommt.')
    return pathlib.Path(name)


"""Welche App gehoert zu welchem Paketnamen.

Das ist der ganze Trick am einheitlichen Weg: Der Bildschirmleser interessiert
sich nicht dafuer, welche App gerade vorn ist - er liest Text. Also kann
derselbe Durchgang alle drei mitnehmen, wenn nur jede Zeile weiss, wo sie
herkam. Und das steht im Paketnamen der App, die gerade den Fokus hat.
"""
PAKETE = {
    'com.tinder': 'tinder',
    'com.bumble.app': 'bumble',
    'co.hinge.app': 'hinge',
}

APPS = {'tinder': 'Tinder', 'bumble': 'Bumble', 'hinge': 'Hinge', 'andere': 'Andere'}


def vordergrund():
    """Welche App ist gerade vorn? Rueckgabe: 'tinder' | 'bumble' | 'hinge' | 'andere'."""
    # Auf dem Geraet greppen statt hier: `dumpsys window` ist einige hundert
    # Kilobyte gross, und davon braucht es genau eine Zeile.
    for befehl in (
        "dumpsys activity activities | grep -m1 -E 'mResumedActivity|topResumedActivity'",
        "dumpsys window | grep -m1 mCurrentFocus",
    ):
        try:
            zeile = adb('shell', befehl)
        except SystemExit:
            continue
        for paket, kuerzel in PAKETE.items():
            if paket in zeile:
                return kuerzel
        if zeile.strip():
            return 'andere'
    return 'andere'


def bildschirm():
    """Den Textbaum des gerade sichtbaren Bildschirms holen."""
    # `exec-out` statt `dump` plus `pull`: Das spart die Datei auf dem Telefon.
    roh = adb('exec-out', 'uiautomator', 'dump', '/dev/tty', binaer=True)
    text = roh.decode('utf-8', 'replace')
    anfang = text.find('<?xml')
    ende = text.rfind('</hierarchy>')
    if anfang < 0 or ende < 0:
        return None
    return text[anfang:ende + len('</hierarchy>')]


def grenzen(wert):
    """bounds="[48,1800][500,1860]" -> (x, y) der Mitte, plus oben/unten."""
    zahlen = [int(n) for n in re.findall(r'-?\d+', wert or '')]
    if len(zahlen) != 4:
        return None
    x1, y1, x2, y2 = zahlen
    return {'x': (x1 + x2) // 2, 'y': (y1 + y2) // 2, 'oben': y1, 'unten': y2}


def texte(xml):
    """Alle sichtbaren Textstuecke mit ihrer Lage auf dem Schirm."""
    gefunden = []
    try:
        baum = ET.fromstring(xml)
    except ET.ParseError:
        return gefunden
    for knoten in baum.iter('node'):
        for feld in ('text', 'content-desc'):
            wert = (knoten.get(feld) or '').strip()
            if not wert or len(wert) > 120:
                continue
            lage = grenzen(knoten.get('bounds'))
            if lage:
                gefunden.append({'text': wert, **lage})
    return gefunden


def kilometer(text):
    """Aus einem Bildschirmtext Kilometer machen - oder None."""
    if MEILEN_RE.search(text):
        m = MEILEN_RE.search(text)
        return round(float(m.group(1).replace(',', '.')) * MEILE, 2)
    if KM_RE.search(text):
        m = KM_RE.search(text)
        return float(m.group(1).replace(',', '.'))
    if METER_RE.search(text):
        m = METER_RE.search(text)
        return round(float(m.group(1).replace(',', '.')) / 1000, 2)
    return None


def als_name(text):
    """Ist das ein Vorname? Gibt ihn zurueck oder None."""
    t = text.strip()
    treffer = NAME_ALTER_RE.match(t)
    if treffer:
        t = treffer.group(1).strip()
    if not (2 <= len(t) <= 30):
        return None
    if t.lower() in KEINE_NAMEN:
        return None
    # Ein Name ist ein Wort, hoechstens zwei, und faengt gross an. Saetze,
    # Knopfbeschriftungen und Profiltexte fallen damit heraus.
    if not re.match(r'^[A-ZÄÖÜ][\wÄÖÜäöüß.\'-]*(\s[A-ZÄÖÜ][\wÄÖÜäöüß.\'-]*)?$', t):
        return None
    if kilometer(t) is not None:
        return None
    return t


def ernten(stuecke):
    """Aus einem Bildschirm die Paare (Name, Entfernung) lesen.

    Gepaart wird ueber die Lage: Die Entfernung steht bei beiden Apps unter dem
    Namen, im selben Block. Genommen wird deshalb der naechste Name *ueber* der
    Entfernung - und nur, wenn er nah genug ist. Ohne diese Schranke bekaeme
    eine Entfernung ganz unten im Profil den Namen aus der Kopfzeile angehaengt,
    und das waere in einer Liste von Menschen die unangenehmste Art von Fehler.
    """
    namen = [(s, als_name(s['text'])) for s in stuecke]
    namen = [(s, n) for s, n in namen if n]
    gefunden = []

    for stueck in stuecke:
        km = kilometer(stueck['text'])
        if km is None or km > 20000:
            continue
        ungefaehr = bool(UNGEFAEHR_RE.search(stueck['text']))
        kandidaten = [
            (stueck['oben'] - s['unten'], n)
            for s, n in namen
            if s['unten'] <= stueck['oben'] + 10 and stueck['oben'] - s['unten'] < 600
        ]
        if not kandidaten:
            continue
        abstand, name = min(kandidaten, key=lambda k: k[0])
        gefunden.append({'name': name, 'km': km, 'ungefaehr': ungefaehr, 'abstand': abstand})
    return gefunden


def schauen(app, sekunden, ruhe):
    """Zusehen, bis nichts Neues mehr kommt.

    `app` ist entweder eine feste Angabe oder 'auto'. Bei 'auto' wird bei jedem
    Blick nachgesehen, welche App gerade vorn ist, und die Zeile bekommt deren
    Namen. Das ist der Grund, warum ein einziger Durchgang fuer alle drei
    reicht: Du gehst durch Tinder, wechselst zu Bumble, dann zu Hinge, und jede
    Zeile weiss hinterher, wo sie herkam.
    """
    geraet_pruefen()
    leute = {}
    letzte_neuigkeit = time.time()
    letzte_app = None

    if app == 'auto':
        print('Zusehen. Geh auf dem Telefon durch deine Matches - in Tinder, Bumble '
              'und Hinge nacheinander, in beliebiger Reihenfolge.')
    else:
        print(f'Zusehen. Geh auf dem Telefon durch deine {app.capitalize()}-Matches.')
    print('Wichtig: die Profile oeffnen. Die Entfernung steht dort, nicht in der Liste.')
    print('Beenden mit Strg+C, oder es hoert von selbst auf, wenn '
          f'{ruhe} Sekunden lang nichts Neues kommt.\n')

    try:
        while time.time() - letzte_neuigkeit < ruhe:
            jetzt = vordergrund() if app == 'auto' else app
            if app == 'auto' and jetzt != letzte_app:
                print(f'  [{APPS.get(jetzt, jetzt)}]')
                letzte_app = jetzt
            xml = bildschirm()
            if xml:
                for person in ernten(texte(xml)):
                    schluessel = person['name'].lower()
                    alt = leute.get(schluessel)
                    if alt and alt['km'] is not None:
                        continue
                    leute[schluessel] = {
                        'name': person['name'],
                        'km': person['km'],
                        'app': jetzt,
                        'quelle': 'android',
                        'ungefaehr': person['ungefaehr'],
                    }
                    letzte_neuigkeit = time.time()
                    print(f'  {person["name"]}: {person["km"]} km')
            time.sleep(sekunden)
    except KeyboardInterrupt:
        print('\nAbgebrochen.')

    if not leute:
        print('\nNichts gefunden. Einmal `--abzug` machen, waehrend ein Profil offen '
              'ist, und in der Datei nachsehen, wie die Texte dort heissen.')
        return

    name = ablageort(f'matches-{date.today().isoformat()}.json')
    with open(name, 'w', encoding='utf-8') as datei:
        json.dump({
            'format': 'matches-mitlesen/1',
            'app': 'gemischt' if app == 'auto' else app,
            'erzeugt': datetime.now(timezone.utc).isoformat(),
            'leute': list(leute.values()),
        }, datei, ensure_ascii=False, indent=1)

    mit_km = sum(1 for p in leute.values() if p['km'] is not None)
    print(f'\n{name}: {len(leute)} Zeilen, {mit_km} mit Entfernung.')
    for kuerzel, anzeige in APPS.items():
        anzahl = sum(1 for p in leute.values() if p['app'] == kuerzel)
        if anzahl:
            print(f'  {anzeige}: {anzahl}')
    print('In der Match-Tabelle unter "Datenauskunft einlesen" auswaehlen.')


def abzug(ziel):
    """Einmal alles abziehen, was auf dem Schirm steht - zum Nachsehen."""
    geraet_pruefen()
    xml = bildschirm()
    if not xml:
        sys.exit('Kein Textbaum zu bekommen. Steht die App im Vordergrund?')
    with open(ziel, 'w', encoding='utf-8') as datei:
        datei.write(xml)
    stuecke = texte(xml)
    print(f'{ziel}: {len(stuecke)} Textstuecke.')
    for s in stuecke[:60]:
        km = kilometer(s['text'])
        name = als_name(s['text'])
        marke = ' <- Entfernung' if km is not None else (' <- Name?' if name else '')
        print(f'  [{s["oben"]:5d}] {s["text"][:60]!r}{marke}')


def main():
    zerleger = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    zerleger.add_argument('--schauen', action='store_true', help='zusehen und sammeln')
    zerleger.add_argument('--app', choices=['auto', 'tinder', 'bumble', 'hinge', 'andere'],
                          default='auto',
                          help='auto (Standard): je Zeile die App nehmen, die gerade vorn ist')
    zerleger.add_argument('--abzug', metavar='DATEI', help='den Bildschirm einmal abziehen')
    zerleger.add_argument('--takt', type=float, default=2.0, help='Sekunden zwischen zwei Blicken')
    zerleger.add_argument('--ruhe', type=float, default=90.0, help='Sekunden ohne Neues bis Schluss')
    zerleger.add_argument('--koppeln', nargs=2, metavar=('PORT', 'CODE'),
                          help='einmalig: WLAN-Debugging koppeln (auf dem Telefon selbst)')
    zerleger.add_argument('--verbinden', metavar='PORT',
                          help='nach jedem Neustart: mit dem WLAN-Debugging verbinden')
    wahl = zerleger.parse_args()

    if wahl.koppeln:
        koppeln(*wahl.koppeln)
    elif wahl.verbinden:
        verbinden(wahl.verbinden)
    elif wahl.abzug:
        abzug(wahl.abzug)
    elif wahl.schauen:
        schauen(wahl.app, wahl.takt, wahl.ruhe)
    else:
        zerleger.print_help()


if __name__ == '__main__':
    main()
