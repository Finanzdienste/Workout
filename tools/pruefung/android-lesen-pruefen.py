#!/usr/bin/env python3
"""Der Bildschirmleser fuer Bumble und Hinge - geprueft an nachgebauten Baeumen.

    python3 tools/pruefung/android-lesen-pruefen.py

Der Grund, warum diese Datei existiert: An das eigentliche Gegenueber - ein
Telefon mit offener Dating-App - kommt hier niemand heran, weder im Testlauf bei
GitHub noch beim Bauen. Ungeprueft bliebe damit ausgerechnet der Teil, der raet:
Was auf einem Bildschirm ist ein Vorname, was eine Entfernung, und welche beiden
gehoeren zusammen.

Also stehen hier Baeume, wie `uiautomator dump` sie liefert, und zwar die
unbequemen Faelle zuerst: die Entfernung ohne Namen in der Naehe, der Wohnort
unter dem Namen, die Meilenangabe, die Knopfbeschriftung, die aussieht wie eine
Person. Was hier durchgeht, geht auf dem Telefon auch durch - und was hier
haengenbleibt, haette dort eine Zeile mit einem falschen Menschen erzeugt.
"""

import pathlib
import sys

HIER = pathlib.Path(__file__).resolve()
sys.path.insert(0, str(HIER.parent.parent.parent / 'matches'))

import importlib.util

spec = importlib.util.spec_from_file_location(
    'android_lesen', HIER.parent.parent.parent / 'matches' / 'android-lesen.py')
lesen = importlib.util.module_from_spec(spec)
spec.loader.exec_module(lesen)


fehler = 0


def pruefe(bedingung, text):
    global fehler
    print(('OK   ' if bedingung else 'FAIL ') + text)
    if not bedingung:
        fehler += 1


def baum(*stuecke):
    """Einen Bildschirmbaum bauen: (text, oben, unten) je Zeile."""
    knoten = ''.join(
        f'<node index="0" text="{t}" class="android.widget.TextView" '
        f'bounds="[48,{o}][900,{u}]"/>'
        for t, o, u in stuecke)
    return f'<?xml version="1.0" encoding="UTF-8"?><hierarchy rotation="0">{knoten}</hierarchy>'


# --- 1. Ein Profil, wie Bumble es zeigt --------------------------------
xml = baum(
    ('Zurück', 100, 160),
    ('Anna, 28', 1700, 1780),
    ('4 km entfernt', 1800, 1850),
    ('Berlin', 1870, 1920),
)
gefunden = lesen.ernten(lesen.texte(xml))
pruefe(len(gefunden) == 1, f'ein Profil ergibt genau eine Zeile ({len(gefunden)})')
pruefe(gefunden and gefunden[0]['name'] == 'Anna',
       'aus "Anna, 28" wird der Vorname, nicht "Anna, 28"')
pruefe(gefunden and gefunden[0]['km'] == 4.0, 'und 4 km sind 4 km')

# --- 2. Der Wohnort ist keine Person -----------------------------------
# "Berlin" steht unter der Entfernung und waere ohne die Sperrliste ein Name -
# nur eben nicht bei dieser Entfernung, sondern bei der naechsten. Hier wird
# geprueft, dass er ueberhaupt nicht als Name durchgeht.
# Die vier, auf die das Programm beim ersten Fahrversuch am echten Geraet
# tippen wollte. Alle vier bestehen jede Formregel, die auch „Anna" bestehen
# laesst - deshalb wird seither nachgeschlagen statt geraten.
for aus_dem_echten_lauf in ('Sicherheitstools', 'Profilfoto', 'Weitere Optionen', 'ESC'):
    pruefe(lesen.als_name(aus_dem_echten_lauf) is None,
           f'{aus_dem_echten_lauf!r} ist kein Vorname (aus dem ersten Fahrversuch)')
# Der Punkt, um den es geht: An der Form ist ein deutsches Substantiv von einem
# Vornamen nicht zu unterscheiden. „Lieblingsmusik" steht auf keiner Sperrliste
# und besteht trotzdem jede Formregel, die auch „Anna" bestehen laesst - nur das
# Nachschlagen trennt die beiden.
pruefe(lesen.namensform('Lieblingsmusik') == 'Lieblingsmusik',
       'der Form nach sieht „Lieblingsmusik" wie ein Vorname aus …')
pruefe(lesen.als_name('Lieblingsmusik') is None,
       '… und nur das Nachschlagen sagt, dass es keiner ist')

# Der zweite Lauf meldete, was er aussortiert hatte. Zwei davon waren echte
# Matches: Die Liste war zu deutschlastig. Der Rest ist Oberflaeche - Tinders
# eigene und, aus den Augenblicken davor, Termux' Tastenleiste.
for echt in ('Anastasia', 'Iryna'):
    pruefe(lesen.als_name(echt) == echt,
           f'{echt!r} ist ein Name (aus dem zweiten Fahrversuch aussortiert)')
for oberflaeche in ('Chat', 'Explore', 'Swipe', 'Verifizierungs-Badge', 'Hey',
                    'ALT', 'CTRL', 'END', 'HOME', 'PGUP', 'PGDN'):
    pruefe(lesen.als_name(oberflaeche) is None,
           f'{oberflaeche!r} nicht (aus demselben Lauf)')

pruefe(lesen.als_name('Berlin') is None, 'ein Stadtname gilt nicht als Vorname')
pruefe(lesen.als_name('Nachrichten') is None, 'eine Knopfbeschriftung auch nicht')
pruefe(lesen.als_name('Sie mag Klettern und lange Spaziergaenge') is None,
       'und ein ganzer Satz erst recht nicht')
pruefe(lesen.als_name('Anna') == 'Anna', 'ein Vorname dagegen schon')
pruefe(lesen.als_name('Marie-Luise') == 'Marie-Luise', 'auch mit Bindestrich')

# --- 3. Entfernung ohne Namen in der Naehe -----------------------------
# Der Fall, der still falsch waere: Die Kopfzeile nennt einen Namen, und weit
# unten im Profil steht eine Entfernung. Wer beides verbindet, erfindet eine
# Angabe.
xml = baum(
    ('Mira, 31', 200, 260),
    ('Ueber mich', 900, 950),
    ('Sucht: etwas Ernstes', 1400, 1450),
    ('12 km entfernt', 2100, 2150),
)
gefunden = lesen.ernten(lesen.texte(xml))
pruefe(not gefunden,
       f'eine Entfernung 1840 Bildpunkte unter dem Namen wird nicht zugeordnet ({gefunden})')

# --- 4. Nah genug ist nah genug ---------------------------------------
xml = baum(('Mira, 31', 1500, 1560), ('12 km entfernt', 1900, 1950))
gefunden = lesen.ernten(lesen.texte(xml))
pruefe(len(gefunden) == 1 and gefunden[0]['name'] == 'Mira',
       'in einem Block darunter dagegen schon')

# --- 5. Einheiten ------------------------------------------------------
pruefe(lesen.kilometer('3 miles away') == round(3 * 1.609344, 2),
       f'Meilen werden umgerechnet ({lesen.kilometer("3 miles away")})')
pruefe(lesen.kilometer('800 m entfernt') == 0.8, 'Meter werden Kilometer')
pruefe(lesen.kilometer('1,5 km entfernt') == 1.5, 'das deutsche Komma zaehlt als Komma')
pruefe(lesen.kilometer('28') is None, 'eine nackte Zahl ist keine Entfernung')
pruefe(lesen.kilometer('Anna, 28') is None, 'und ein Alter erst recht nicht')

# --- 6. "weniger als 1 km" ist eine Obergrenze -------------------------
xml = baum(('Lena, 26', 1500, 1560), ('Weniger als 1 km entfernt', 1600, 1650))
gefunden = lesen.ernten(lesen.texte(xml))
pruefe(len(gefunden) == 1 and gefunden[0]['ungefaehr'],
       'eine Obergrenze wird als solche vermerkt, statt sie als Messwert auszugeben')

# --- 7. Ein Bildschirm ohne alles --------------------------------------
pruefe(lesen.ernten(lesen.texte('<hierarchy></hierarchy>')) == [],
       'ein leerer Baum ergibt nichts, statt zu stolpern')
pruefe(lesen.texte('kein xml') == [],
       'und etwas, das kein XML ist, auch nicht')

# --- 8. Die Portsuche --------------------------------------------------
# Android zeigt den Kopplungsport in einem Fenster, das sich schliesst, sobald
# man zur Terminal-App wechselt. Statt zwei fuenfstellige Zahlen abtippen zu
# lassen, sucht das Programm den Port selbst - und das muss es koennen, sonst
# haengt der ganze Einrichtungsweg an einer Zahl, die man nicht mehr sieht.
import socket

horcher = socket.socket()
horcher.bind(('127.0.0.1', 0))
horcher.listen(1)
welcher = horcher.getsockname()[1]
try:
    # Eng um den echten Port herum suchen, damit die Pruefung schnell bleibt.
    gefunden = lesen.offene_ports(von=max(1024, welcher - 40), bis=welcher + 40)
    pruefe(welcher in gefunden, f'ein offener Port wird gefunden ({welcher})')
    zu = welcher + 1 if welcher + 1 not in gefunden else welcher + 2
    pruefe(zu not in gefunden, 'ein geschlossener daneben nicht')
finally:
    horcher.close()

pruefe(lesen.offene_ports(von=welcher, bis=welcher) == [],
       'nach dem Schliessen ist der Port wieder weg - es wird gemessen, nicht geraten')

# --- 9. Worauf getippt wird - und worauf niemals ------------------------
# Der heikelste Teil des ganzen Programms. Ein falsch gesetzter Tipp ist auf
# einer Dating-App im besten Fall ein Like, das man nicht zurueckholt, und im
# schlechtesten ein Abo. Deshalb wird hier nicht geprueft, ob das Richtige
# getroffen wird, sondern zuerst, ob das Falsche in Ruhe gelassen wird.
def kn(text, klickbar=True, oben=1000):
    return {'text': text, 'klickbar': klickbar, 'x': 500, 'y': oben + 30,
            'oben': oben, 'unten': oben + 60}


pruefe(lesen.tippziel([kn('Anna')], set())['name'] == 'Anna',
       'eine anklickbare Zeile mit Vornamen ist ein Ziel')
pruefe(lesen.tippziel([kn('Anna', klickbar=False)], set()) is None,
       'dieselbe Zeile ohne clickable=true dagegen nicht')
pruefe(lesen.tippziel([kn('Anna')], {'anna'}) is None,
       'und eine schon besuchte auch nicht - sonst laeuft es im Kreis')

for gefaehrlich in ('Like', 'Super Like', 'Boost kaufen', 'Premium', 'Abo verlängern',
                    'Blockieren', 'Melden', 'Löschen', 'Einstellungen'):
    pruefe(lesen.tippziel([kn(gefaehrlich)], set()) is None,
           f'auf {gefaehrlich!r} wird nie getippt')

pruefe(lesen.tippziel([kn('4 km entfernt')], set()) is None,
       'auf eine Entfernungsangabe auch nicht')
pruefe(lesen.tippziel([kn('Like'), kn('Mira', oben=1200)], set())['name'] == 'Mira',
       'steht Gefaehrliches neben Harmlosem, wird das Harmlose genommen')
pruefe(lesen.tippziel([], set()) is None,
       'auf einem leeren Schirm passiert gar nichts - kein blindes Tippen')

xml_liste = baum(('Nachrichten', 100, 160), ('Anna', 800, 860), ('Mira', 900, 960))
pruefe(len(lesen.knoten(xml_liste)) == 3, 'der Knotenleser findet alle drei Zeilen')
pruefe(all(not k['klickbar'] for k in lesen.knoten(xml_liste)),
       'und merkt sich, dass in diesem Baum keine davon anklickbar ist')

# Der Fall, an dem die erste Fassung scheiterte, und zwar am echten Geraet:
# Anklickbar ist der Kasten um den Text, nicht der Text. Wer nur den Text
# ansieht, findet nie ein Ziel und wischt endlos weiter.
VERSCHACHTELT = '''<?xml version="1.0" encoding="UTF-8"?><hierarchy rotation="0">
 <node class="android.widget.FrameLayout" clickable="false" bounds="[0,0][1080,2400]">
  <node class="androidx.recyclerview.widget.RecyclerView" clickable="false" bounds="[0,300][1080,2000]">
   <node class="android.view.ViewGroup" clickable="true" bounds="[0,400][1080,700]">
    <node class="android.widget.TextView" text="Anna" clickable="false" bounds="[48,480][300,540]"/>
   </node>
   <node class="android.view.ViewGroup" clickable="true" bounds="[0,700][1080,1000]">
    <node class="android.widget.TextView" text="Mira" clickable="false" bounds="[48,780][300,840]"/>
   </node>
  </node>
 </node>
</hierarchy>'''

tief = lesen.knoten(VERSCHACHTELT)
pruefe(len(tief) == 2 and all(k['klickbar'] for k in tief),
       'ein Text in einem klickbaren Kasten gilt als anklickbar')
anna = next(k for k in tief if k['text'] == 'Anna')
pruefe(anna['y'] == 550 and anna['x'] == 540,
       f'getippt wird auf die Mitte des Kastens, nicht des Textes ({anna["x"]},{anna["y"]})')
pruefe(anna['oben'] == 480 and anna['unten'] == 540,
       'die Lage des Textes bleibt erhalten – daran haengt die Zuordnung der Entfernung')
ziel = lesen.tippziel(tief, set())
pruefe(ziel and ziel['name'] == 'Anna', 'und daraus wird ein Ziel, statt endlos zu wischen')

# --- Der geteilte Bildschirm -------------------------------------------
# `uiautomator dump` liefert den ganzen Schirm. Beim ersten Fahrversuch stand
# darin auch Termux, und das Programm wollte auf dessen 'ESC' tippen.
ZWEI_APPS = '''<?xml version="1.0" encoding="UTF-8"?><hierarchy rotation="0">
 <node package="com.tinder" class="android.view.ViewGroup" clickable="true" bounds="[0,400][1080,700]">
  <node package="com.tinder" class="android.widget.TextView" text="Anna" bounds="[48,480][300,540]"/>
 </node>
 <node package="com.termux" class="android.view.ViewGroup" clickable="true" bounds="[0,1400][1080,1600]">
  <node package="com.termux" class="android.widget.TextView" text="ESC" bounds="[48,1480][160,1540]"/>
 </node>
</hierarchy>'''

nur_tinder = lesen.knoten(lesen.nur_app(ZWEI_APPS, 'com.tinder'))
pruefe([k['text'] for k in nur_tinder] == ['Anna'],
       f'im geteilten Bildschirm bleibt nur die gemeinte App uebrig ({[k["text"] for k in nur_tinder]})')
pruefe(len(lesen.knoten(lesen.nur_app(ZWEI_APPS, None))) == 2,
       'ohne Angabe wird nichts weggeworfen')

# --- 9. Welche App gerade vorn ist -------------------------------------
# Der eine Durchgang fuer alle drei steht und faellt damit: Jede Zeile bekommt
# die App, die im Moment des Lesens den Fokus hatte. Erkennt das nichts, landen
# Tinder-Matches unter Bumble - eine Verwechslung, die man der fertigen Tabelle
# nicht mehr ansieht.
echtes_adb = lesen.adb
FOKUS = {
    'mResumedActivity: ActivityRecord{a1 u0 com.tinder/.MainActivity t42}': 'tinder',
    'mCurrentFocus=Window{b2 u0 com.bumble.app/com.bumble.app.ui.MainActivity}': 'bumble',
    'topResumedActivity=ActivityRecord{c3 u0 co.hinge.app/.MainActivity t7}': 'hinge',
    'mCurrentFocus=Window{d4 u0 com.whatsapp/com.whatsapp.Main}': 'andere',
}
try:
    for zeile, erwartet in FOKUS.items():
        lesen.adb = lambda *a, _z=zeile, **k: _z
        pruefe(lesen.vordergrund() == erwartet,
               f'{erwartet}: aus {zeile.split()[0][:22]!r} … erkannt')
    # Antwortet adb gar nicht, darf nichts geraten werden.
    lesen.adb = lambda *a, **k: ''
    pruefe(lesen.vordergrund() == 'andere', 'ohne Antwort bleibt es bei „andere", statt zu raten')
finally:
    lesen.adb = echtes_adb

# --- 9. Wohin die Datei geschrieben wird -------------------------------
# Auf dem Telefon liegt das Termux-Verzeichnis in den App-Daten, und der
# Browser, der die Datei gleich einlesen soll, kommt dort nicht heran. Eine
# Datei, die man nicht aufmachen kann, ist keine.
import os

pruefe(not lesen.in_termux(), 'auf einem gewoehnlichen Rechner ist das kein Termux')
pruefe(str(lesen.ablageort('x.json')) == 'x.json',
       'und die Datei landet dort, wo das Programm laeuft')

os.environ['TERMUX_VERSION'] = '0.118'
try:
    pruefe(lesen.in_termux(), 'in Termux wird Termux erkannt')
    # Ohne `termux-setup-storage` gibt es ~/storage/downloads nicht - dann bleibt
    # es beim Arbeitsverzeichnis, aber mit einem Hinweis statt stillschweigend.
    ziel = lesen.ablageort('x.json')
    pruefe(str(ziel).endswith('x.json'), f'und der Name bleibt derselbe ({ziel})')
finally:
    del os.environ['TERMUX_VERSION']

# --- 10. Verbinden, ohne eine Zahl abzuschreiben -----------------------
# Nach jedem Neustart schaltet Android das WLAN-Debugging ab und vergibt beim
# Einschalten einen neuen Port. Der Schalter bleibt Handarbeit - der Port nicht.
# Sonst faengt jeder Durchgang damit an, eine fuenfstellige Zahl aus einem
# Menue abzuschreiben, und genau daran ist der erste echte Versuch gescheitert.
echtes_adb = lesen.adb
echte_ports = lesen.offene_ports
lage = {'verbunden': False, 'gesucht': 0, 'connects': []}


def falsches_adb(*args, **kw):
    if args[:1] == ('devices',):
        return 'List of devices attached\n' + (
            '127.0.0.1:41111\tdevice\n' if lage['verbunden'] else '')
    if args[:1] == ('connect',):
        lage['connects'].append(args[1])
        if args[1] == '127.0.0.1:41111':
            lage['verbunden'] = True
    return ''


def falsche_ports(*a, **kw):
    lage['gesucht'] += 1
    return [40000, 41111]


try:
    lesen.adb = falsches_adb
    lesen.offene_ports = falsche_ports
    os.environ['TERMUX_VERSION'] = '0.118'

    lage['verbunden'] = True
    pruefe(lesen.geraet_pruefen() == '127.0.0.1:41111', 'ein verbundenes Geraet wird genommen')
    pruefe(lage['gesucht'] == 0, 'und dabei wird kein Port gesucht')

    # Fehlt die Verbindung, wird sie hergestellt, statt sie zu verlangen.
    lage['verbunden'] = False
    pruefe(lesen.geraet_pruefen() == '127.0.0.1:41111',
           'ohne Verbindung stellt Termux sie selbst her')
    pruefe(lage['gesucht'] == 1, 'genau ein Suchlauf dafuer')

    # Am Rechner am Kabel gibt es nichts zu suchen: Dort waere die Suche 35000
    # Verbindungsversuche ins Leere, und der Fehler ist ein ganz anderer.
    del os.environ['TERMUX_VERSION']
    lage['verbunden'] = False
    lage['gesucht'] = 0
    try:
        lesen.geraet_pruefen()
        pruefe(False, 'ohne Termux und ohne Geraet bricht es ab')
    except SystemExit as fehlschlag:
        pruefe('Kabel' in str(fehlschlag),
               'ohne Termux und ohne Geraet bricht es ab und nennt das Kabel')
    pruefe(lage['gesucht'] == 0, 'und sucht dort keine Ports')

    # Und wer einen Port nennt, bekommt genau den - sonst liefe die Suche
    # trotzdem, und die Angabe waere eine Luege.
    os.environ['TERMUX_VERSION'] = '0.118'
    lage.update(verbunden=False, gesucht=0, connects=[])
    lesen.verbinden('41111')
    pruefe(lage['connects'] == ['127.0.0.1:41111'], 'ein genannter Port wird genommen')
    pruefe(lage['gesucht'] == 0, 'und dann nicht zusaetzlich gesucht')
finally:
    lesen.adb = echtes_adb
    lesen.offene_ports = echte_ports
    os.environ.pop('TERMUX_VERSION', None)

# --- 11. Eine Berechtigung, die nicht ankommt, ist keine ---------------
# `pm grant` bricht nicht auf jedem Android ab, wenn die App die Berechtigung
# gar nicht anfordert - und genau darin steckt Termux selbst fest. Wer sich auf
# die Meldung verlaesst, baut eine Automatik, die stillschweigend nichts tut und
# beim naechsten Neustart trotzdem nach dem Schalter verlangt.
lage2 = {'vergeben': False, 'gefragt': []}


def adb_mit_grant(*args, **kw):
    if args[:1] == ('devices',):
        return 'List of devices attached\n127.0.0.1:41111\tdevice\n'
    if args[:3] == ('shell', 'pm', 'grant'):
        lage2['gefragt'].append(args[3])
        return ''
    if args[:3] == ('shell', 'dumpsys', 'package'):
        return ('    android.permission.WRITE_SECURE_SETTINGS: granted=true\n'
                if lage2['vergeben'] else '    android.permission.INTERNET: granted=true\n')
    return ''


try:
    lesen.adb = adb_mit_grant
    try:
        lesen.freischalten('com.termux')
        pruefe(False, 'eine nicht angekommene Berechtigung wird gemeldet')
    except SystemExit as fehlschlag:
        pruefe('nicht als vergeben' in str(fehlschlag),
               'eine nicht angekommene Berechtigung wird gemeldet, statt sie zu behaupten')

    lage2.update(vergeben=True, gefragt=[])
    lesen.freischalten('com.arlosoft.macrodroid')
    pruefe(lage2['gefragt'] == ['com.arlosoft.macrodroid'],
           'und gefragt wird genau fuer das genannte Paket')
finally:
    lesen.adb = echtes_adb

print()
if fehler:
    sys.exit(f'{fehler} Pruefung(en) fehlgeschlagen.')
print('Alles in Ordnung.')
