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
2. Dieses Programm holen - direkt, nicht ueber den Browser in die Downloads,
   sonst liegt irgendwann eine alte Fassung da und wirft Fehler, die laengst
   behoben sind:

       curl -sSL -o ~/android-lesen.py https://raw.githubusercontent.com/Finanzdienste/Workout/main/matches/android-lesen.py

   curl gehoert zur Grundausstattung von Termux; ein `pkg install` waere hier
   nicht nur unnoetig, sondern scheitert auch, solange der Spiegelserver
   gerade synchronisiert ("File has unexpected size").
3. Entwickleroptionen -> **WLAN-Debugging** einschalten. Steht das Telefon
   dort schon unter "Gekoppelte Geraete", ist Schritt 4 erledigt.
4. Dort *Geraet mit Kopplungscode koppeln* antippen. Der Dialog zeigt einen
   sechsstelligen Code; getippt wird der **in Termux**, hinter --einrichten,
   waehrend der Dialog offen stehen bleibt (geteilter Bildschirm - Android
   schliesst ihn sonst, und mit ihm sterben Port und Code):

       python3 ~/android-lesen.py --einrichten CODE

   Das ist **einmalig**. Die Kopplung ueberlebt Neustarts; sie steht danach
   unter "Gekoppelte Geraete".
5. Danach nichts mehr. Der Verbindungsport aendert sich zwar bei jedem
   Neustart und bei jedem Ein- und Ausschalten des WLAN-Debuggings - aber er
   wird gesucht, nicht abgetippt: Wer `--schauen` oder `--fahren` aufruft und
   nicht verbunden ist, wird von selbst verbunden.

   Von Hand bleibt nur der **Schalter** "Debugging ueber WLAN": Android
   schaltet ihn bei jedem Neustart des Telefons ab, und daran laesst sich von
   aussen nichts aendern - es ist genau der Schalter, der fremden Zugriff
   erlaubt. Als Kachel in den Schnelleinstellungen ist es ein Tipp.
6. `termux-wake-lock`, damit Termux im Hintergrund weiterlaeuft, waehrend du in
   Bumble bist. Dann `--schauen` oder `--fahren` wie sonst.

Herauskommt eine Datei im selben Format wie beim Browser-Mitleser, die die
Match-Tabelle unter *Datenauskunft einlesen* nimmt. In Termux landet sie in
den Downloads, wenn `termux-setup-storage` gelaufen ist - sonst muesste man sie
aus dem Termux-Verzeichnis heraussuchen, an das der Browser nicht herankommt.
"""

import argparse
import json
import os
import pathlib
import random
import re
import subprocess
import sys
import threading
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
    # Aus den echten Laeufen am Galaxy S21 - Tinder-Oberflaeche und, in den
    # Augenblicken vor der Paketfilterung, Termux' eigene Tastenleiste.
    'chat', 'explore', 'swipe', 'sicherheitstools', 'profilfoto', 'hey',
    'verifizierungs-badge', 'esc', 'ctrl', 'alt', 'home', 'end', 'pgup', 'pgdn',
    'tab', 'shift', 'enter',
    # Die Angaben, die Tinder unter dem Profil als Schildchen zeigt. Sie sehen
    # der Form nach aus wie Vornamen - ein Wort, gross beginnend - und standen
    # deshalb in der Abfuhrliste des vierten Laufs ("Heterosexuell, Monogamie").
    # Falsch war daran nichts, aber gemeldet gehoert nur, was ein Name sein
    # koennte, sonst sieht man die echten Fehlenden nicht mehr.
    'heterosexuell', 'homosexuell', 'bisexuell', 'pansexuell', 'asexuell',
    'demisexuell', 'queer', 'hetero', 'lesbisch', 'schwul',
    'monogamie', 'monogam', 'polyamorie', 'polyamor', 'beziehungstyp',
    'beziehungsziele', 'sternzeichen', 'persoenlichkeitstyp',
    'persönlichkeitstyp', 'kommunikationsstil', 'liebessprache',
    'ernaehrung', 'ernährung', 'haustiere', 'rauchen', 'trinken', 'training',
    'bildung', 'kinderwunsch', 'grundlagen', 'lebensstil',
    # Sternzeichen stehen in denselben Schildchen. Keines davon ist im
    # deutschsprachigen Raum ein Vorname - dieselbe Schranke wie bei den
    # Staedten unten.
    'widder', 'stier', 'zwillinge', 'krebs', 'löwe', 'loewe', 'jungfrau',
    'waage', 'skorpion', 'schütze', 'schuetze', 'steinbock', 'wassermann',
    'fische',
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


def angeschlossen():
    """Welche Geraete meldet adb gerade als verbunden?"""
    zeilen = [z for z in adb('devices').splitlines()[1:] if z.strip()]
    return [z.split()[0] for z in zeilen if z.split()[1:2] == ['device']]


def geraet_pruefen(selbst_verbinden=True):
    """Ein verbundenes Geraet, oder eine Meldung, die sagt, was fehlt.

    Auf dem Telefon selbst wird zuerst versucht, die Verbindung herzustellen,
    statt sie zu verlangen. Denn was nach einem Neustart fehlt, ist nicht die
    Kopplung - die bleibt -, sondern nur die Verbindung, und deren Port kann
    das Programm suchen (siehe `offene_ports`). Damit bleibt von der ganzen
    Einrichtung genau ein Handgriff uebrig, den niemand abnehmen kann: der
    Schalter "Debugging ueber WLAN", den Android bei jedem Neustart abschaltet.
    """
    dabei = angeschlossen()
    if not dabei and selbst_verbinden and in_termux():
        print('Nicht verbunden - ich suche den Port selbst. Das dauert einen Moment.')
        if verbinden_versuchen():
            dabei = angeschlossen()
    if not dabei:
        if in_termux():
            sys.exit('Kein Geraet - und auch nichts gefunden, womit sich verbinden liesse.\n'
                     'Fast immer heisst das: "Debugging ueber WLAN" ist aus. Android\n'
                     'schaltet es bei jedem Neustart ab.\n'
                     '  Entwickleroptionen -> Debugging ueber WLAN einschalten,\n'
                     '  dann denselben Befehl noch einmal.\n'
                     'Falls dieses Telefon noch nie gekoppelt wurde: dort auf "Geraet mit\n'
                     'Kopplungscode koppeln" tippen und einmalig --einrichten CODE aufrufen.')
        sys.exit('Kein Geraet. `adb devices` zeigt nichts Verbundenes - Kabel dran, '
                 'Bildschirm entsperrt, die Nachfrage auf dem Telefon bestaetigt?')
    return dabei[0]


def offene_ports(von=30000, bis=65535, faeden=400, wartezeit=0.05):
    """Welche Ports auf 127.0.0.1 hoeren gerade zu?

    Der Grund für diese Suche ist eine Zumutung der Bedienung: Android zeigt den
    Kopplungsport in einem Fenster, das sich schliesst, sobald man zur
    Terminal-App wechselt - und mit ihm sterben Port und Code. Man muss also
    zwei fünfstellige Zahlen und einen sechsstelligen Code im Kopf behalten und
    fehlerfrei abtippen, während man im geteilten Bildschirm hantiert.

    Da wir aber *auf dem Geraet selbst* laufen, ist der Port kein Geheimnis: Der
    Dienst hoert auf 127.0.0.1, und offene Ports kann man zaehlen. Bleibt der
    sechsstellige Code, den nur der Mensch lesen kann.
    """
    import socket
    from concurrent.futures import ThreadPoolExecutor

    def offen(port):
        with socket.socket() as s:
            s.settimeout(wartezeit)
            return port if s.connect_ex(('127.0.0.1', port)) == 0 else None

    with ThreadPoolExecutor(max_workers=faeden) as gruppe:
        return [p for p in gruppe.map(offen, range(von, bis + 1)) if p]


def einrichten(code):
    """Koppeln und verbinden in einem Zug - der Mensch nennt nur den Code.

    Probiert wird gegen jeden offenen Port. Das klingt grob, ist aber harmlos:
    Wer nicht der Kopplungsdienst ist, antwortet mit einem Fehler, und das war's.
    """
    print('Suche den Kopplungsdienst … (der Dialog muss offen sein)')
    ports = offene_ports()
    if not ports:
        sys.exit('Kein offener Port gefunden. Ist "Debugging über WLAN" an und der '
                 'Kopplungsdialog offen? Er muss offen *bleiben* - im geteilten '
                 'Bildschirm neben Termux.')

    gekoppelt = None
    for port in ports:
        try:
            antwort = adb('pair', f'127.0.0.1:{port}', code)
        except SystemExit:
            continue
        if 'Successfully paired' in antwort or 'erfolgreich' in antwort.lower():
            gekoppelt = port
            print(f'Gekoppelt (Port {port}).')
            break
    if not gekoppelt:
        sys.exit(f'Kein Port hat den Code {code} angenommen. Meistens heisst das: Der '
                 'Dialog war schon wieder zu, und der Code ist tot. Neu oeffnen, neuer '
                 'Code, noch einmal.')

    # Der Verbindungsport ist ein anderer als der Kopplungsport - und er ist
    # jetzt vielleicht erst aufgegangen, deshalb noch einmal nachsehen.
    if verbinden_versuchen(ausser=gekoppelt):
        print('Das war die Einrichtung. Sie gilt auch nach einem Neustart; nur der\n'
              'Schalter "Debugging ueber WLAN" ist dann wieder von Hand zu setzen.')
        return
    sys.exit('Gekoppelt, aber keine Verbindung zustande gekommen. '
             f'Einmal von Hand: --verbinden PORT (der Port steht im Menü unter '
             '"IP-Adresse & Port").')


def phantom_aus():
    """Seit Android 12 raeumt das System Kindprozesse weg, die zu keiner
    sichtbaren App gehoeren. uiautomator ist genau so einer und wird sonst
    mitten im Lesen abgeschossen."""
    try:
        adb('shell', 'settings', 'put', 'global',
            'settings_enable_monitor_phantom_procs', 'false')
        print('(Die Aufsicht ueber Hintergrundprozesse ist abgeschaltet, sonst '
              'beendet Android das Mitlesen nach wenigen Minuten von selbst.)')
    except SystemExit:
        print('(Die Aufsicht ueber Hintergrundprozesse liess sich nicht abschalten - '
              'bricht das Lesen spaeter ab, ist das der Grund.)')


def freischalten(paket):
    """Einer App erlauben, das WLAN-Debugging von sich aus einzuschalten.

    Android schaltet "Debugging ueber WLAN" bei jedem Neustart ab und ausserdem,
    sobald das WLAN weggeht. Das ist kein Versehen, sondern der Zweck des
    Schalters: Er ist die Tuer, durch die ein fremdes Geraet auf dieses hier
    zugreifen darf. Von aussen laesst sich der Schalter nur mit
    WRITE_SECURE_SETTINGS umlegen, und die vergibt allein adb - eine
    adb-Verbindung haben wir hier aber gerade. Vergeben bleibt sie ueber
    Neustarts hinweg; sie muss also genau einmal vergeben werden.

    Termux selbst kommt dafuer nicht in Frage: Eine Berechtigung, die eine App
    nicht in ihrem Manifest anfordert, kann ihr auch adb nicht geben. Es braucht
    eine App, die sie anfordert - MacroDroid und Tasker tun das - und die einen
    Ausloeser fuer "Neustart" oder "WLAN verbunden" hat.
    """
    geraet_pruefen()
    print(f'{paket} soll WRITE_SECURE_SETTINGS bekommen.')
    print('Das ist keine kleine Berechtigung: Die App darf danach *jede*')
    print('geschuetzte Systemeinstellung aendern, nicht nur das WLAN-Debugging.')
    print('Zuruecknehmen: adb shell pm revoke ' + paket +
          ' android.permission.WRITE_SECURE_SETTINGS')
    print()
    try:
        adb('shell', 'pm', 'grant', paket, 'android.permission.WRITE_SECURE_SETTINGS')
    except SystemExit as fehlschlag:
        sys.exit(str(fehlschlag) + '\n\nFordert die App die Berechtigung ueberhaupt an? '
                 'Wenn nicht, kann adb sie\nnicht vergeben - das gilt auch fuer Termux '
                 'selbst und fuer Termux:API.')

    # `pm grant` meldet nicht auf jedem Android einen Fehler, wenn nichts
    # geschehen ist. Deshalb wird nachgesehen statt geglaubt.
    if 'WRITE_SECURE_SETTINGS: granted=true' not in adb('shell', 'dumpsys', 'package', paket):
        sys.exit('Die Berechtigung steht hinterher nicht als vergeben da. Fordert die '
                 'App sie an?')
    print('Vergeben. Jetzt in der App eine Regel anlegen:')
    print('  Ausloeser: Geraet gestartet - und, wenn es die App kann, WLAN verbunden')
    print('  Aktion:    globale Einstellung  adb_wifi_enabled = 1')
    print('Danach schaltet sich das WLAN-Debugging selbst ein, und dieses Programm')
    print('sucht sich den Port. Von Hand bleibt dann nichts mehr.')


def koppeln(port, code):
    """Einmalig: das Telefon mit sich selbst (oder dem Rechner) koppeln."""
    print(adb('pair', f'127.0.0.1:{port}', code).strip())
    print('Jetzt den *anderen* Port aus der Hauptansicht des WLAN-Debuggings nehmen '
          'und --verbinden damit aufrufen.')


def verbinden_versuchen(ausser=None):
    """Jeden offenen Port durchprobieren, bis adb ein Geraet meldet.

    Gibt zurueck, ob es geklappt hat, statt abzubrechen - denn der Aufrufer
    weiss besser als diese Funktion, ob ein Fehlschlag das Ende ist.
    """
    for kandidat in offene_ports():
        if kandidat == ausser:
            continue
        try:
            adb('connect', f'127.0.0.1:{kandidat}')
        except SystemExit:
            continue
        if angeschlossen():
            print(f'Verbunden (Port {kandidat}).')
            phantom_aus()
            return True
    return False


def verbinden(port=None):
    """Verbinden. Ohne Port wird er gesucht.

    Der Verbindungsport aendert sich bei jedem Neustart des Telefons - das ist
    die eine Zahl, die man sonst regelmaessig nachschlagen und abtippen muesste.
    Gekoppelt bleibt das Geraet dabei; nur die Verbindung ist weg. Von Hand
    aufrufen muss man das seit --schauen und --fahren nicht mehr; die verbinden
    sich selbst.
    """
    if port:
        print(adb('connect', f'127.0.0.1:{port}').strip())
        geraet_pruefen(selbst_verbinden=False)
        phantom_aus()
        return

    print('Suche den Verbindungsdienst …')
    if not verbinden_versuchen():
        sys.exit('Keine Verbindung zustande gekommen. Ist "Debugging über WLAN" an? '
                 'Und wurde dieses Geraet schon einmal gekoppelt (--einrichten CODE)?')


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

PAKET_VON = {kuerzel: paket for paket, kuerzel in PAKETE.items()}


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


"""Vornamen.

Warum eine Liste und keine Regel: Beim ersten Fahrversuch am echten Geraet
wollte das Programm auf „Sicherheitstools", „Profilfoto" und „Weitere Optionen"
tippen, und einer Entfernung von 4,0 km hängte es „Weitere Optionen" als Namen
an. Alle drei bestehen jede Formregel, die auch „Anna" bestehen laesst: Sie
fangen gross an, sind ein bis zwei Woerter lang und stehen mitten im Profil.

An der *Gestalt* ist ein deutscher Vorname von einem deutschen Substantiv nicht
zu unterscheiden. Also wird nachgeschlagen. Der Preis dafuer ist ehrlich: Wer
einen Namen traegt, der hier fehlt, wird uebersprungen - das Programm sagt es
dann, statt still an ihm vorbeizugehen, und die Liste laesst sich ergaenzen.
"""
VORNAMEN = set('''
anna anne annika antonia amelie alina alexandra alicia amina angelina ann annalena
antonella ariana asia astrid aylin ayse barbara bianca birgit brigitte carla carlotta
carmen caro carolin caroline catharina cathrin celina charlotte chiara christin
christina claudia clara conny cora corinna daniela daria denise diana dilara dominique
dorothea ela elena eleni elif elisa elisabeth ella emilia emily emma enya erika esther
eva evelyn fabienne fatima fiona franziska frida gabi gabriele giulia greta hanna
hannah heike helena helene henriette ida ines inga ines irina isabel isabella jana
janina janine jasmin jenny jennifer jessica joana johanna jolina jona josefine judith
julia juliane julie justine kathrin katharina katja katrin kerstin kim kira klara
kristin larissa laura lea leah lena lene leni leonie lia lilith lilli lilly lina linda
lisa liv louisa louise luca lucia lucy luisa luise luna lydia maja malin mara maren
maria mariam marie marina marion marlene marta martina mary maya melanie melina melis
melissa merle mia michelle mila milena mira miriam mona monika nadine nadja nancy
naomi natalia natalie nathalie neele nele nadia nika nikola nina nora olivia paula
pauline petra philippa pia rabea rebecca regina renate riana romina ronja rosa ruth
sabine sabrina sally sandra sara sarah saskia selin selina sina sofia sofie sonja
sophia sophie stefanie stella susanne svenja svea tabea talia tamara tanja tara tessa
thea theresa therese tina vanessa vera verena victoria viktoria vivien wiebke yara
yasmin yvonne zoe zoey
anastasia anastasiia iryna irina oksana olena olga kateryna katerina yuliia yulia
svitlana viktoriia valeriia daryna sofiia solomiia bohdana halyna nataliia liudmyla
tetiana tetyana alona alyona anzhelika diana karina kristina ksenia lada larisa
lesia marharyta milana nadiya polina roksolana ruslana snizhana svetlana taisiia
vira yana zlata alina agata aneta beata dorota ewa hanna iwona joanna justyna
kasia katarzyna magda magdalena malgorzata marta monika natalia paulina wanda
weronika zofia adela andrea barbora eliska jitka lucie marketa michaela petra
tereza veronika zuzana anica dragana ivana jelena jovana maja marija milica nevena
sanja tamara tijana vesna ada aylin ayse burcu ceren defne derya dilan ebru ecem
elif emine esra eylul fatma gizem gul gulsah hande irem melek merve nur ozge pinar
selin sena seda sevim sude tugce yasemin zehra zeynep amira dalia farah hala hiba
laila layla lina maha malak mariam nadia noor rania rasha salma samira sara yasmine
ai aiko akari emi haruka hina kaori mei miku nana rin sakura yui yuki yuna aria
ashley brittany chelsea courtney destiny hailey haley jasmine kayla kelsey madison
megan paige savannah shelby sierra taylor tiffany whitney
andrii andriy bohdan denys dmytro ihor kyrylo maksym mykola oleh oleksandr oleksii
pavlo petro roman ruslan serhii sviatoslav taras vadym valerii vasyl viktor vitalii
volodymyr yaroslav yevhen yurii aleksandar bojan dejan dusan filip goran igor ivan
luka marko milan milos nemanja nikola petar stefan vladimir zoran adam bartek
grzegorz jakub jan jerzy kacper kamil krzysztof lukasz maciej mateusz michal pawel
piotr rafal szymon tomasz wojciech zbigniew ahmet ali baris burak cem cenk deniz
emre ercan ferhat gokhan halil hasan huseyin ibrahim kaan kemal mehmet mert murat
mustafa onur ozan serkan sinan tarik tolga ugur umut yigit yusuf ahmad amir hamza
karim khaled mahmoud omar rami samir tarek youssef daichi haruto hiroshi kaito ken
kenji ryo sota takumi yuto brandon cody dylan hunter jared jordan logan mason tyler
zachary
adrian alex alexander ali andre andreas anton arne arthur ben benedikt benjamin
bernd bjoern bruno burak carl carsten christian christoph clemens conrad constantin
daniel david dennis dieter dirk dominik eddie elias emil enes eric erik fabian felix
ferdinand finn florian frank franz frederik friedrich fritz gabriel georg gerd
gregor gustav hannes hans harald hendrik henri henrik holger hugo ingo jakob jan
janis jannik jared jason jens jeremy jesper joel johann johannes jonas jonathan jorge
josef julian juri justin kai karl kevin klaus konrad konstantin lars lasse leo leon
leonard levi levin linus lorenz louis luca lucas ludwig luis lukas malte manuel marc
marcel marco marcus mario mark markus martin marvin mathias matthias mattis max
maximilian michael mika mike milan mirko moritz murat nick niclas nico niels niklas
nils noah norman oliver oscar oskar patrick paul peter philipp pierre rafael ralf
raphael rene ricardo richard robert robin roman ron ruben rudolf samuel sascha
sebastian sergej silas simon soeren stefan steffen stephan sven thomas thorsten tim
timo tino tobias tom tomas toni torben tristan udo ulrich valentin viktor vincent
volker waldemar walter wilhelm william willi wolfgang yannick yusuf
'''.split())


def namensform(text):
    """Sieht das *wie* ein Vorname aus? Ohne Nachschlagen."""
    t = text.strip()
    treffer = NAME_ALTER_RE.match(t)
    if treffer:
        t = treffer.group(1).strip()
    if not (2 <= len(t) <= 30):
        return None
    if t.lower() in KEINE_NAMEN:
        return None
    # Ein Wort, gross beginnend. Doppelnamen mit Bindestrich zaehlen als eines.
    if not re.match(r"^[A-ZÄÖÜ][\wÄÖÜäöüß.'-]*$", t):
        return None
    if kilometer(t) is not None:
        return None
    return t


def als_name(text):
    """Ist das ein Vorname? Gibt ihn zurueck oder None."""
    t = namensform(text)
    if not t:
        return None
    # Nachgeschlagen. Bei Doppelnamen genuegt ein bekannter Teil.
    teile = [teil.lower() for teil in re.split(r'[-\s]', t) if teil]
    return t if any(teil in VORNAMEN for teil in teile) else None


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


def nur_app(xml, paket):
    """Alles wegwerfen, was nicht zur gemeinten App gehoert.

    `uiautomator dump` liefert den *ganzen* Bildschirm. Im geteilten Bildschirm
    steht darin auch die andere Haelfte - und beim ersten Fahrversuch war das
    Termux selbst: Das Programm wollte auf 'ESC' aus der eigenen Tastenleiste
    tippen. Jeder Knoten trägt aber ein `package`, und damit ist die Frage
    entschieden, statt sie zu raten.
    """
    if not paket:
        return xml
    try:
        baum = ET.fromstring(xml)
    except ET.ParseError:
        return xml
    for eltern in baum.iter():
        for kind in list(eltern):
            if kind.get('package') and kind.get('package') != paket:
                eltern.remove(kind)
    return ET.tostring(baum, encoding='unicode')


def knoten(xml):
    """Alle Knoten mit Text, Lage und der Frage, ob man sie antippen kann.

    Der Haken, an dem die erste Fassung scheiterte: Anklickbar ist in Android
    fast nie der Text selbst, sondern der Kasten um ihn herum. Ein Listeneintrag
    besteht aus einem klickbaren Container und einer TextView darin, die
    `clickable="false"` ist. Wer nur den Text ansieht, findet deshalb nie ein
    Ziel und wischt ewig weiter - genau das war im ersten Trockenlauf zu sehen.
    Also wird der Baum von oben durchlaufen und der naechste klickbare Vorfahr
    mitgefuehrt; getippt wird auf dessen Mitte.
    """
    gefunden = []
    try:
        baum = ET.fromstring(xml)
    except ET.ParseError:
        return gefunden

    def geh(k, klickbarer_vorfahr):
        lage = grenzen(k.get('bounds'))
        hier = k if (k.get('clickable') == 'true' and lage) else klickbarer_vorfahr
        text = (k.get('text') or k.get('content-desc') or '').strip()
        if text and lage and len(text) <= 120:
            ziel = grenzen(hier.get('bounds')) if hier is not None else lage
            gefunden.append({
                'text': text,
                'klickbar': hier is not None,
                'x': ziel['x'], 'y': ziel['y'],
                'oben': lage['oben'], 'unten': lage['unten'],
            })
        for kind in k:
            geh(kind, hier)

    for k in baum:
        geh(k, None)
    return gefunden


# Was niemals angetippt wird. Ein falsch gesetzter Tipp ist auf einer Dating-App
# im besten Fall ein Like, das man nicht zurückholt, und im schlechtesten ein
# Abo. Deshalb ist das hier eine Sperrliste und kein Filter: Im Zweifel wird
# nicht getippt.
VERBOTEN = re.compile(
    r'\b(like|likes|nope|super|boost|premium|plus|gold|platinum|abo|kaufen|'
    r'upgrade|bezahlen|zahlen|verlängern|verlaengern|kündigen|kuendigen|'
    r'löschen|loeschen|entfernen|blockieren|melden|abmelden|logout|'
    r'einstellungen|settings|subscribe|purchase|buy|unlock)\b', re.I)


def tippziel(liste, gesehen):
    """Welche Zeile als Naechstes antippen - oder keine.

    Getippt wird nur auf etwas, das im Baum steht und wie ein Vorname aussieht.
    Blinde Koordinaten gibt es hier nicht: Wenn die App gerade woanders steht,
    findet sich kein Ziel, und dann passiert nichts. Das ist der Unterschied
    zwischen „durch die Liste gehen" und „irgendwo auf den Schirm hauen".
    """
    for eintrag in liste:
        if VERBOTEN.search(eintrag['text']):
            continue
        name = als_name(eintrag['text'])
        if not name or name.lower() in gesehen:
            continue
        if kilometer(eintrag['text']) is not None:
            continue
        if not eintrag['klickbar']:
            continue
        return {**eintrag, 'name': name}
    return None


def tippen(ziel, trocken=False):
    if trocken:
        print(f'    [trocken] tippen auf {ziel["name"]!r} bei {ziel["x"]},{ziel["y"]}')
        return
    adb('shell', 'input', 'tap', str(ziel['x']), str(ziel['y']))


def zurueck(trocken=False):
    if trocken:
        print('    [trocken] zurueck')
        return
    adb('shell', 'input', 'keyevent', '4')


def wischen(hoehe, trocken=False):
    """Ein Stueck weiter in der Liste. Senkrecht - waagerecht waere ein Like."""
    x, oben, unten = 540, int(hoehe * 0.72), int(hoehe * 0.32)
    if trocken:
        print(f'    [trocken] wischen {x},{oben} -> {x},{unten}')
        return
    adb('shell', 'input', 'swipe', str(x), str(oben), str(x), str(unten), '450')


def bildschirmhoehe():
    text = adb('shell', 'wm', 'size')
    treffer = re.search(r'(\d+)x(\d+)', text)
    return int(treffer.group(2)) if treffer else 2400


"""Die Seite und die Daten aus einem kleinen Server heraus anbieten.

Der Grund ist eine Einschränkung des Browsers, keine Bequemlichkeit: Eine über
file:// geoeffnete Seite darf keine Nachbardatei lesen. Damit die Tabelle sich
die Daten *selbst* holen kann, muessen beide von derselben Adresse kommen - also
liefert das Programm sie aus, solange es laeuft. Nur an 127.0.0.1, nur solange
gelesen wird, und ohne dass ein Byte das Geraet verlaesst.
"""


def seite_finden(hier):
    for kandidat in (hier / 'matches.html', hier / 'index.html',
                     hier / 'dist' / 'matches.html',
                     pathlib.Path.cwd() / 'matches.html'):
        if kandidat.is_file():
            return kandidat
    return None


def server_starten(port, seite, daten_holen):
    from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

    class Griff(BaseHTTPRequestHandler):
        def log_message(self, *_):
            pass  # das Protokoll wuerde die Fundmeldungen zuschuetten

        def do_GET(self):
            if self.path.startswith('/daten.json'):
                koerper = json.dumps(daten_holen(), ensure_ascii=False).encode()
                typ = 'application/json; charset=utf-8'
            elif self.path in ('/', '/index.html'):
                koerper = seite.read_bytes()
                typ = 'text/html; charset=utf-8'
            else:
                self.send_error(404)
                return
            self.send_response(200)
            self.send_header('content-type', typ)
            self.send_header('content-length', str(len(koerper)))
            self.send_header('cache-control', 'no-store')
            self.end_headers()
            self.wfile.write(koerper)

    server = ThreadingHTTPServer(('127.0.0.1', port), Griff)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return server


def schauen(app, sekunden, ruhe, fahren=False, trocken=False, port=None):
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
    pause_gemeldet = False
    gesehen = set()          # schon angetippte Zeilen, beim Fahren
    im_profil = False        # sind wir gerade eine Ebene tiefer?
    letzter_baum = None      # zum Erkennen, dass sich nichts mehr tut
    gleich = 0
    unbekannt = set()        # sah aus wie ein Vorname, stand aber nicht in der Liste
    hoehe = bildschirmhoehe() if fahren else 2400

    def daten():
        return {
            'format': 'matches-mitlesen/1',
            'app': 'gemischt' if app == 'auto' else app,
            'erzeugt': datetime.now(timezone.utc).isoformat(),
            'leute': list(leute.values()),
        }

    server = None
    if port:
        seite = seite_finden(pathlib.Path(__file__).resolve().parent)
        if not seite:
            sys.exit('Keine matches.html gefunden. Sie muss neben diesem Programm liegen, '
                     'damit die Tabelle ausgeliefert werden kann.')
        server = server_starten(port, seite, daten)
        print(f'Tabelle: http://127.0.0.1:{port}/  – im Browser oeffnen und offen lassen.')
        print('Sie holt sich die Zeilen von hier, solange dieses Programm laeuft.\n')

    if fahren:
        print('Fahren. Das Programm tippt selbst auf die Zeilen, liest das Profil und '
              'geht zurueck.')
        print('Vorher: die Match-Liste der App oeffnen. Getippt wird nur auf etwas, das '
              'wie ein Vorname aussieht und im Baum steht - nie auf blinde Koordinaten, '
              'nie auf Like, Boost oder Abo.')
    elif app == 'auto':
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
            # Gehoert der Bildschirm gerade keiner der drei Apps, wird gar nicht
            # erst gelesen. Sonst landet der eigene Terminal im Ergebnis: Beim
            # zweiten Fahrversuch standen ALT, CTRL, ESC, HOME, PGUP und PGDN in
            # der Liste der uebersprungenen Namen - Termux' eigene Tastenleiste,
            # eingesammelt in den Augenblicken, in denen es im Vordergrund war.
            if jetzt not in PAKET_VON:
                # Einmal sagen, nicht im Zweisekundentakt: Im geteilten
                # Bildschirm hat Termux den Fokus, sobald man hinsieht, und die
                # Wiederholung schob den eigentlichen Verlauf aus dem Bild.
                if fahren and not pause_gemeldet:
                    print('  (keine der drei Apps im Vordergrund - es wird nichts '
                          'getippt, bis eine davon wieder vorn ist)')
                    pause_gemeldet = True
                time.sleep(sekunden)
                continue
            pause_gemeldet = False

            xml = bildschirm()
            if xml:
                # Und im geteilten Bildschirm steht im Abzug auch die andere
                # Haelfte. Was nicht zur erkannten App gehoert, fliegt raus.
                xml = nur_app(xml, PAKET_VON.get(jetzt))
                for stueck in texte(xml):
                    wort = namensform(stueck['text'])
                    if wort and not als_name(stueck['text']):
                        unbekannt.add(wort)
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

                if fahren:
                    if im_profil:
                        # Erst lesen, dann zurueck: Das Profil ist die einzige
                        # Stelle, an der die Entfernung steht.
                        zurueck(trocken)
                        im_profil = False
                    else:
                        ziel = tippziel(knoten(xml), gesehen)
                        if ziel:
                            gesehen.add(ziel['name'].lower())
                            print(f'    -> {ziel["name"]}')
                            tippen(ziel, trocken)
                            im_profil = True
                            letzte_neuigkeit = time.time()
                        else:
                            wischen(hoehe, trocken)
                            # Ändert sich danach nichts mehr, ist die Liste zu
                            # Ende – oder es ist ein Trockenlauf, in dem gar
                            # nicht wirklich gewischt wird. In beiden Fällen ist
                            # Weitermachen sinnlos, und ohne diese Bremse lief
                            # der erste Trockenlauf endlos weiter.
                            if xml == letzter_baum:
                                gleich += 1
                                if gleich >= 3:
                                    print('  Der Bildschirm ändert sich nicht mehr – '
                                          'Ende der Liste.' + (' (Im Trockenlauf wird '
                                          'nicht wirklich gewischt, deshalb kommt das '
                                          'hier immer.)' if trocken else ''))
                                    break
                            else:
                                gleich = 0
                            letzter_baum = xml
            # Etwas ungleichmaessig, weil ein Mensch auch nicht im Takt tippt.
            time.sleep(sekunden * random.uniform(0.8, 1.4) if fahren else sekunden)
    except KeyboardInterrupt:
        print('\nAbgebrochen.')
    finally:
        if server:
            server.shutdown()

    if unbekannt:
        print('\nÜbersprungen, weil nicht in der Vornamensliste: '
              + ', '.join(sorted(unbekannt)))
        print('Ist da ein echter Name dabei, gehoert er in VORNAMEN oben im Programm.')

    if not leute:
        print('\nNichts gefunden. Einmal `--abzug` machen, waehrend ein Profil offen '
              'ist, und in der Datei nachsehen, wie die Texte dort heissen.')
        return

    name = ablageort(f'matches-{date.today().isoformat()}.json')
    with open(name, 'w', encoding='utf-8') as datei:
        json.dump(daten(), datei, ensure_ascii=False, indent=1)

    mit_km = sum(1 for p in leute.values() if p['km'] is not None)
    print(f'\n{name}: {len(leute)} Zeilen, {mit_km} mit Entfernung.')
    for kuerzel, anzeige in APPS.items():
        anzahl = sum(1 for p in leute.values() if p['app'] == kuerzel)
        if anzahl:
            print(f'  {anzeige}: {anzahl}')
    if not port:
        print('In der Match-Tabelle unter "Datenauskunft einlesen" auswaehlen '
              '- oder beim naechsten Mal --server dazunehmen, dann holt sie sich '
              'die Zeilen von selbst.')


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
    zerleger.add_argument('--einrichten', metavar='CODE',
                          help='einmalig: koppeln und verbinden in einem Zug; die Ports '
                               'werden selbst gesucht, nur der sechsstellige Code wird '
                               'gebraucht')
    zerleger.add_argument('--koppeln', nargs=2, metavar=('PORT', 'CODE'),
                          help='einmalig: WLAN-Debugging koppeln (auf dem Telefon selbst)')
    zerleger.add_argument('--freischalten', metavar='PAKET',
                          help='einer App (z. B. com.arlosoft.macrodroid) erlauben, das '
                               'WLAN-Debugging selbst einzuschalten - weitreichend')
    zerleger.add_argument('--verbinden', nargs='?', const='', metavar='PORT',
                          help='von Hand verbinden; noetig ist das nicht mehr, '
                               '--schauen und --fahren verbinden sich selbst')
    zerleger.add_argument('--fahren', action='store_true',
                          help='selbst durch die Match-Liste gehen, statt zuzusehen')
    zerleger.add_argument('--trocken', action='store_true',
                          help='mit --fahren: nur sagen, was getippt wuerde, und nichts tun')
    zerleger.add_argument('--server', nargs='?', type=int, const=8099, metavar='PORT',
                          help='die Tabelle ausliefern; sie holt sich die Zeilen dann selbst')
    wahl = zerleger.parse_args()

    if wahl.einrichten:
        einrichten(wahl.einrichten)
    elif wahl.koppeln:
        koppeln(*wahl.koppeln)
    elif wahl.freischalten:
        freischalten(wahl.freischalten)
    elif wahl.verbinden is not None:
        verbinden(wahl.verbinden or None)
    elif wahl.abzug:
        abzug(wahl.abzug)
    elif wahl.schauen or wahl.fahren:
        schauen(wahl.app, wahl.takt, wahl.ruhe,
                fahren=wahl.fahren, trocken=wahl.trocken, port=wahl.server)
    else:
        zerleger.print_help()


if __name__ == '__main__':
    main()
