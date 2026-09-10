# Matches

Eine Tabelle aller Matches aus Tinder, Hinge und Bumble – sortiert nach
Entfernung. Eigene Seite unter `matches/`, eigener Speicher, kein Zusammenhang
mit dem Trainingsplan außer dem Aussehen.

Öffnen: `matches/index.html` über einen Webserver (ES-Module), im Betrieb also
`…/matches/` auf derselben Adresse wie die Workout-App.

## Der eine Weg – und was es sonst noch gibt

Das gehört an den Anfang, weil es die ganze Bedienung erklärt.

**Eine offizielle Schnittstelle hat keiner der drei Dienste.** Es gibt die
Datenauskunft nach Art. 15 DSGVO: selbst anfordern, ein paar Tage warten, Link
per Mail. **Und in dieser Auskunft steht keine Entfernung** – in keiner der
drei. Bei Tinder und Hinge fehlen auch die Namen; Tinder liefert Kennungen wie
`5f3a…` und die Nachrichten, die *man selbst* geschickt hat.

Die Entfernung gibt es trotzdem, nur eben nicht in einer Datei: Der Server
schickt sie an die App, sonst könnte die „4 km entfernt" nicht anzeigen. Wer
automatisch drankommen will, muss also dort mitlesen, wo sie ankommt – im
Browser oder auf dem Bildschirm des Telefons. Beides tut diese App, und beides
tut sie **passiv**: zusehen, nicht abfragen.

| Weg | Für wen | Bringt |
| --- | --- | --- |
| **[`android-lesen.py`](android-lesen.py) `--fahren --server`** | **alle drei, in einem Durchgang, ohne Handgriff** | Name, **Entfernung** |
| [`mitlesen.user.js`](mitlesen.user.js) im Browser | nur Tinder | zusätzlich das Match-Datum |
| Datenauskunft einlesen | alle drei | Datum, Nachrichtenzahl, Stand |
| Formular | alle drei | alles, in fünf Sekunden je Person |

**Der Bildschirmleser ist der Hauptweg**, und zwar aus einem Grund, der erst
beim Benutzen auffällt: Er interessiert sich nicht dafür, welche App gerade vorn
ist – er liest Text. Also reicht *ein* Durchgang für alle drei. Du gehst durch
Tinder, wechselst zu Bumble, dann zu Hinge; jede Zeile bekommt die App, die im
Moment des Lesens den Fokus hatte. Am Ende liegt eine Datei da, nicht drei.

Bumble hat seine Weboberfläche am 8. August 2026 abgeschaltet, Hinge hatte nie
eine – im Browser ginge also ohnehin nur Tinder, und das auch nur mit einer
zweiten Einrichtung (Firefox, Tampermonkey, Login auf tinder.com). Das
Userscript bleibt trotzdem da: Es bringt für Tinder zusätzlich das Match-Datum,
und es ist die Rückfalltür, falls eine App das Auslesen ihres Bildschirms
irgendwann unterbindet.

Was auf keinem Weg dazukommt, trägt man im Formular nach. Es ist darauf
ausgelegt: Name, App, Zahl, Enter.

## Automatisch mitlesen – Tinder, im Browser

**Mitlesen, nicht abfragen.** Das Skript schickt keine einzige eigene Anfrage.
Es hängt sich vor `fetch` und `XMLHttpRequest` und sieht sich an, was die Seite
von sich aus holt, während du durch deine Matches scrollst. Für den Server sieht
das aus wie ein Mensch, der durch seine Matches scrollt – weil genau das
passiert.

Der Unterschied ist nicht kosmetisch. Ein eigener Client, der die private
Schnittstelle selbst abfragt, erzeugt ein Muster, das kein echtes Gerät erzeugt:
gleichmäßige Abstände, keine Bilder, hunderte Profilabrufe in zwei Minuten.
Genau darauf schaut die Bot-Erkennung, und das übliche Ende ist die Kontosperre.

Ehrlich dazugesagt: Automatisiertes Auslesen steht in den Nutzungsbedingungen
unter „nicht erlaubt", auch das passive. Das Risiko ist klein, aber nicht null,
und es ist deins.

### So läuft es

1. Tampermonkey (oder Violentmonkey) installieren, `mitlesen.user.js` hinzufügen.
   Ohne Erweiterung geht es auch: die Datei öffnen, Inhalt kopieren, in der
   Konsole von tinder.com einfügen – dann fängt das Mitlesen aber erst ab dem
   Einfügen an, und was vorher geladen wurde, fehlt.
2. tinder.com öffnen, einloggen.
3. Durch die Matches scrollen. Unten rechts zählt ein Kasten mit: *„17 gefunden
   · 4 mit km"*.
4. Für die Entfernung die Profile öffnen – **die schickt Tinder erst dann.** In
   der Liste steht sie nicht. Das ist der Grund, warum die zweite Zahl im Kasten
   hinter der ersten herhinkt.
5. *Datei* drücken, die JSON in der Match-Tabelle unter *Datenauskunft einlesen*
   auswählen.

Findet der Kasten nichts, hat sich der Aufbau der Antworten geändert. Dann
*Rohdaten* drücken – darin stehen die letzten Antworten, und daraus lässt sich
der Leser nachziehen. Er sucht bewusst nach Gestalt statt nach Feldnamen (etwas
mit Namen und Entfernung ist eine Person), damit genau das selten nötig wird.

Nichts davon verlässt den Browser.

## Automatisch mitlesen – alle drei, vom Telefon

`matches/android-lesen.py` liest den **Bildschirm** statt des Netzes. Android
gibt über `uiautomator` den Textbaum der sichtbaren App heraus, und dort stehen
Name und „4 km entfernt" als ganz gewöhnlicher Text.

    python3 matches/android-lesen.py --fahren --server

Das ist der Ein-Befehl-Fall, und er nimmt einem beide Handgriffe ab:

* **`--fahren`** geht selbst durch die Match-Liste: tippt eine Zeile an, liest
  das Profil, geht zurück, nimmt die nächste, scrollt weiter. Vorher die
  Match-Liste der App öffnen — den Rest macht das Programm.
* **`--server`** liefert die Tabelle unter `http://127.0.0.1:8099/` aus. Die
  Seite dort holt sich die Zeilen alle vier Sekunden von selbst; man sieht sie
  auflaufen, während nebenan gelesen wird. Kein Auswählen einer Datei mehr.

Wer lieber selbst durch die Profile geht, lässt `--fahren` weg und nimmt
`--schauen` — dann sieht das Programm nur zu.

Ohne weitere Angabe läuft es auf `--app auto`: Bei jedem Blick wird nachgesehen,
welche App gerade den Fokus hat, und die gefundene Zeile bekommt deren Namen.
Erkannt werden `com.tinder`, `com.bumble.app` und `co.hinge.app`; alles andere
zählt als „Andere". Deshalb reicht **ein** Durchgang: durch Tinder gehen, zu
Bumble wechseln, dann zu Hinge. Am Ende liegt eine Datei da, nicht drei, und die
Tabelle sortiert alle zusammen nach Entfernung.

Ohne diese Zuordnung wäre die Sache schlimmer als unbequem: Tinder-Matches
lägen unter Bumble, und das sieht man der fertigen Tabelle nicht mehr an.

Mit `--schauen` wischt und tippt das Programm nicht selbst: Es sieht alle zwei
Sekunden nach, was auf dem Schirm steht, und du gehst durch deine Matches wie
sonst auch. So oder so gilt: **Die Profile müssen aufgemacht werden** – die
Entfernung steht in allen drei Apps dort, nicht in der Liste.

### Was `--fahren` niemals tut

Ein falsch gesetzter Tipp ist auf einer Dating-App im besten Fall ein Like, das
man nicht zurückholt, und im schlechtesten ein Abo. Deshalb drei harte Regeln,
und alle drei stehen in der Prüfung:

1. **Keine blinden Koordinaten.** Getippt wird ausschließlich auf einen Knoten,
   der im Textbaum steht, `clickable` ist und dessen Text wie ein Vorname
   aussieht. Steht die App gerade woanders, findet sich kein Ziel – und dann
   passiert nichts, statt irgendwohin zu tippen.
2. **Eine Sperrliste, kein Filter.** Alles mit *Like, Super, Boost, Premium,
   Abo, kaufen, verlängern, löschen, blockieren, melden, Einstellungen* wird
   übersprungen, auch wenn es sonst passen würde. Im Zweifel wird nicht getippt.
3. **Nur senkrecht wischen.** Waagerecht wäre in einer Kartenansicht ein Like.

Dazu ein ungleichmäßiger Takt (0,8 bis 1,4 mal die eingestellte Zeit), weil ein
Mensch auch nicht im Sekundentakt tippt.

Zuerst einmal trocken laufen lassen — dann wird nur ausgegeben, was getippt
würde, und nichts angefasst:

    python3 matches/android-lesen.py --fahren --trocken

### Ohne Rechner, nur mit dem Telefon

Seit Android 11 kann ein Gerät sich über das **WLAN-Debugging selbst bedienen**:
`adb` läuft in Termux und verbindet sich auf `127.0.0.1`. Damit braucht der
ganze Weg keinen Rechner und kein Kabel mehr.

1. F-Droid → Termux. Darin: `pkg install android-tools python curl`, dann
   `termux-setup-storage` (sonst landet die Datei in den App-Daten, wo der
   Browser nicht herankommt).
2. Das Programm holen — nicht über den Browser in die Downloads, sondern
   direkt, weil sonst irgendwann eine alte Fassung im Verzeichnis liegt und
   Fehler wirft, die längst behoben sind:

       curl -sSL -o ~/android-lesen.py https://raw.githubusercontent.com/Finanzdienste/Workout/main/matches/android-lesen.py

   Dieselbe Zeile holt später auch jede neuere Fassung.
3. Entwickleroptionen → **WLAN-Debugging** einschalten.
4. Steht dieses Telefon auf demselben Bildschirm schon unter **Gekoppelte
   Geräte**, sind die Schritte 5 und 6 erledigt — weiter bei 7.
5. Termux und die Einstellungen im **geteilten Bildschirm** nebeneinander legen
   (Zuletzt-verwendet → auf das Termux-Symbol → *In geteilter Bildschirmansicht
   öffnen*). Das ist nötig, weil Android den Kopplungsdialog schließt, sobald
   man ihn verlässt — und mit ihm sterben Port und Code.
6. *Gerät mit Kopplungscode koppeln* antippen. Der Dialog zeigt einen
   sechsstelligen Code; der wird **in Termux getippt**, hinter `--einrichten`,
   während der Dialog offen stehen bleibt:

       python3 ~/android-lesen.py --einrichten 096656

   Den Port braucht es nicht: Das Programm läuft auf demselben Gerät, also kann
   es die offenen Ports auf `127.0.0.1` selbst abzählen und den Kopplungsdienst
   darunter finden. Nur den Code kann kein Programm lesen.
7. `termux-wake-lock`, dann — jedes Mal derselbe eine Befehl:

       python3 android-lesen.py --fahren --server

   Die Match-Liste der App öffnen und das Telefon liegen lassen. In einem
   zweiten Browser-Tab `http://127.0.0.1:8099/` offen halten – dort füllt sich
   die Tabelle mit, während gelesen wird. (Eine Datei landet trotzdem in den
   Downloads, als Sicherung.)

#### Was davon beim nächsten Mal wieder anfällt

Die Schritte 1, 5 und 6 sind einmalig; die Kopplung überlebt Neustarts und
steht danach unter *Gekoppelte Geräte*. Was der Kopplungsdialog anzeigt, ist
dagegen jedes Mal neu und nur Sekunden gültig — das ist die Kopplung selbst
nicht. Schritt 2 fällt nur an, wenn es eine neuere Fassung gibt.

Bleibt Schritt 3, der Schalter **Debugging über WLAN**. Der geht öfter aus, als
man denkt: bei jedem Neustart, bei jedem Abschalten des WLANs, und nach längerer
Untätigkeit. Als Kachel in den Schnelleinstellungen ist es ein Tipp
(Schnelleinstellungen → Bearbeiten → *WLAN-Debugging*), und das ist der Weg, den
dieses Programm empfiehlt.

#### Und wenn auch dieser Tipp weg soll

Er lässt sich automatisieren, aber nicht von hier aus. Der Schalter hängt an der
globalen Einstellung `adb_wifi_enabled`, und wer die von außen setzen will,
braucht `WRITE_SECURE_SETTINGS`. Vergeben kann die nur adb — eine adb-Verbindung
hat dieses Programm gerade —, und **vergeben bleibt sie über Neustarts hinweg**.
Termux selbst nützt das nichts: Eine Berechtigung, die eine App nicht in ihrem
Manifest anfordert, kann ihr auch adb nicht geben, und weder Termux noch
Termux:API fordern sie an. Es braucht also eine App, die das tut und einen
Auslöser für *Gerät gestartet* hat — MacroDroid (kostenlos) und Tasker können
beides.

    python3 android-lesen.py --freischalten com.arlosoft.macrodroid

Danach dort eine Regel: Auslöser *Gerät gestartet* (und, wenn vorhanden, *WLAN
verbunden*), Aktion *globale Einstellung* `adb_wifi_enabled` = `1`.

Der Preis steht hier und nicht im Kleingedruckten, weil er zweimal anfällt:

* Die App darf danach **jede** geschützte Systemeinstellung ändern, nicht nur
  diese eine. Zurücknehmen geht mit `adb shell pm revoke …` oder durch
  Deinstallieren.
* Ein dauerhaft eingeschaltetes WLAN-Debugging ist eine offen gelassene Tür.
  Koppeln muss sich ein fremdes Gerät weiterhin, aber der Dienst ist im ganzen
  Netz erreichbar — und dass Android den Schalter von selbst umlegt, ist genau
  deshalb kein Fehler, sondern seine Aufgabe. Auf fremdem WLAN ist das etwas
  anderes als zu Hause.

Google arbeitet an einem automatischen Einschalten in *vertrauenswürdigen*
Netzen; in einer stabilen Android-Fassung steht es noch nicht.

Ohne WLAN geht ohnehin nichts: Der Schalter lässt sich nur setzen, wenn das
Telefon in einem WLAN ist. Unterwegs auf Mobilfunk läuft dieser Weg nicht — er
ist für den Durchgang zu Hause gedacht, bei dem das Telefon liegen bleibt.

Der **Verbindungsport** wechselt dabei jedes Mal, aber abschreiben muss man ihn
nicht: `--schauen` und `--fahren` sehen zuerst nach, ob eine Verbindung steht,
und stellen sie sonst selbst her — die offenen Ports auf `127.0.0.1` kann ein
Programm, das auf demselben Gerät läuft, abzählen. `--verbinden` gibt es
weiterhin, gebraucht wird es nicht mehr.

Beim Verbinden wird außerdem die Aufsicht über *phantom processes* abgeschaltet
(`settings_enable_monitor_phantom_procs`). Seit Android 12 räumt das System
Kindprozesse weg, die zu keiner sichtbaren App gehören — `uiautomator` ist genau
so einer, und ohne diesen Griff bricht das Mitlesen nach ein paar Minuten ohne
erkennbaren Grund ab.

### Was dafür nötig ist – und was ausdrücklich nicht

Am Rechner: USB-Debugging auf dem Telefon (Einstellungen → Telefoninfo →
Softwareinformationen → siebenmal auf *Buildnummer*, dann Entwickleroptionen),
`adb`, ein Kabel. Auf dem Telefon allein: Termux und die vier Schritte oben.

**Nicht nötig: Root.** Und das ist der Punkt, an dem sich die beiden Wege
entscheiden. Den *Datenverkehr* der Apps mitzulesen wäre der andere – aber beide
prüfen das Serverzertifikat gegen ihr eigenes (*certificate pinning*). Ein Proxy
dazwischen bräuchte sein Zertifikat im Systemspeicher, also einen entsperrten
Bootloader, Root und Frida. Bei Samsung setzt das Entsperren eine E-Fuse: Knox
steht danach dauerhaft auf 0x1, Samsung Pay und Secure Folder sind
**unwiderruflich** weg, auch nach erneutem Sperren, und das Gerät wird dabei
gelöscht. Beim Galaxy S21 mit Snapdragon (USA, Kanada) lässt sich der Bootloader
gar nicht erst entsperren.

Der Bildschirmweg kostet nichts davon und ist serverseitig sogar unauffälliger:
Es entsteht **kein einziges zusätzliches Netzpaket**, weil nichts abgefragt wird.

Auch hier gilt: Automatisiertes Auslesen widerspricht den Nutzungsbedingungen
beider Dienste. Das Risiko ist gering, aber nicht null.

### Wenn nichts gefunden wird

    python3 matches/android-lesen.py --abzug bumble.xml

Das zieht den aktuellen Bildschirm einmal ab und zeigt, welche Texte darauf
stehen und was davon als Name oder Entfernung erkannt wurde. Aus dieser Datei
lässt sich der Leser nachziehen.

Geprüft wird er in `tools/pruefung/android-lesen-pruefen.py` an nachgebauten
Bildschirmbäumen – an ein echtes Telefon kommt weder der Testlauf bei GitHub
noch sonst jemand hier heran, und ungeprüft bliebe ausgerechnet der Teil, der
raten muss. Die unbequemen Fälle stehen dort zuerst: die Entfernung ohne Namen
in der Nähe, der Wohnort unter dem Namen, die Meilenangabe, die
Knopfbeschriftung, die aussieht wie eine Person.

## Woher die Kilometer kommen

Zwei Wege, und welcher es war, steht in der Tabelle neben der Zahl:

| Anzeige | Herkunft | Genauigkeit |
| --- | --- | --- |
| `4 km`, fett, „aus der App" | abgetippt, was im Profil stand | genau die Zahl, nach der sortiert werden soll |
| `~ 149 km`, „aus dem Ort" | aus einem Ortsnamen gerechnet | Ortsmitte zu Ortsmitte, Luftlinie |
| `–` | weder noch | unbekannt – und das steht auch so da |

Die eingetragene Zahl gewinnt immer. Trägt man bei einer gerechneten Zeile
nachträglich die Kilometer aus der App ein, gilt ab sofort die.

Zeilen ohne Entfernung stehen **in beiden Sortierrichtungen unten**. Wer nach
„am nächsten" sortiert, will oben die Nächsten sehen; wer umdreht, die
Fernsten. Ein Dutzend „unbekannt" an der Spitze wäre auf beide Fragen die
falsche Antwort.

## Orte zu Koordinaten

Drei Wege, in dieser Reihenfolge:

1. **Koordinaten** direkt: `52.52, 13.405`.
2. **Eingebaute Liste** – die größeren Städte im deutschsprachigen Raum, die
   Berliner Bezirke und ein paar europäische Hauptstädte. Ohne Netz, ohne
   Wartezeit, und vor allem, ohne dass die Ortsnamen das Gerät verlassen.
3. **Ortssuche im Netz** (OpenStreetMap/Nominatim) – ausdrücklich einzuschalten,
   standardmäßig aus. Das ist die einzige Stelle, an der diese App etwas nach
   draußen schickt. Wer eine Liste von Menschen samt Wohnort führt, sollte sie
   nicht nebenbei an einen fremden Server durchreichen, nur damit eine Spalte
   gefüllt ist.

Für Großstädte ist der gerechnete Wert grob: „Berlin" nach „Berlin" sind null
Kilometer, zwischen Spandau und Köpenick liegen dreißig. Deshalb kennt die Liste
die Bezirke einzeln – und deshalb ist die abgetippte Zahl aus der App immer die
bessere.

## Datenauskunft anfordern

* **Tinder** → Einstellungen → *Meine Daten herunterladen*. Im ZIP liegt
  `data.json`.
* **Hinge** → Einstellungen → Datenschutz → *Meine Daten herunterladen*. Darin
  `matches.json`.
* **Bumble** → Einstellungen → Datenschutz → *Datenauskunft anfordern*. Der
  Aufbau schwankt nach Land und Zeitpunkt; JSON und CSV werden beide versucht,
  und was nicht erkannt wird, sagt die App, statt es zu verschweigen.

Mehrere Dateien auf einmal gehen. Ein zweiter Import derselben Datei legt keine
Dubletten an und überschreibt nichts von Hand Eingetragenes – er füllt nur, was
leer ist.

## Wo die Daten liegen

Im `localStorage` dieses Browsers, unter `matches.v1`. Kein Konto, kein Server,
keine Übertragung. Das ist keine Bescheidenheit: Eine Tabelle mit Namen,
Wohnorten und Verabredungen anderer Menschen ist deren Sache und hat in einem
fremden Rechenzentrum nichts verloren.

Mitnehmen und aufheben über *Sicherung* (JSON, liest sich wieder ein) und
*Tabelle als CSV* (Semikolon und BOM, damit Excel Umlaute richtig zeigt). Der
Speicher hängt am Ort, von dem die Seite geladen wurde – wer zwischen GitHub
Page und lokaler Datei wechselt, nimmt die Sicherung mit.

## Aufs Handy bekommen

Zwei Wege, und der zweite braucht niemanden ausser dir.

**Als Seite.** Liegt das Repo auf GitHub Pages, ist die Tabelle unter
`…/matches/` erreichbar. Im Handy-Browser oeffnen, *Zum Startbildschirm
hinzufuegen* – dann steht sie als Symbol neben den uebrigen Apps.

**Als eine einzige Datei.**

```bash
python3 tools/build-matches-single.py
```

Das ergibt `dist/matches.html`: CSS, alle vier Module und das Symbol
eingebettet, rund 100 KB. Die Datei aufs Geraet legen (Download, Cloud,
Messenger, Kabel), in der Dateien-App antippen – der Browser oeffnet sie ohne
Server und ohne Netz, und auch von hier aus geht *Zum Startbildschirm
hinzufuegen*.

Ein Hinweis, der bei der Workout-App genauso gilt: Der Speicher haengt am Ort,
von dem die Seite geladen wurde. Wer zwischen der GitHub Page und der Datei
wechselt, nimmt seine Zeilen ueber *Sicherung* mit – sonst steht er vor einer
leeren Tabelle und haelt sie fuer einen Datenverlust.

Die Reihenfolge der Module im Buendel steht nicht in einer Liste, sondern wird
aus den import-Zeilen gelesen. Bei der Workout-App fehlte `js/ics.js`
jahrelang in genau so einer Liste, und der Kalenderexport der Einzeldatei endete
in einem ReferenceError, waehrend er unter `index.html` lief. Eine Liste, die
jemand von Hand pflegen muss, geht irgendwann auseinander; die import-Zeilen
koennen es nicht, denn ohne sie laeuft die modulare Fassung selbst nicht.

## Prüfen

```bash
node tests/lauf.mjs matches
```

Das laeuft beide: `test-matches.mjs` gegen die modulare Fassung und
`test-matches-einzel.mjs` gegen `dist/matches.html` aus dem Dateisystem. Die
zweite Pruefung ist keine Formsache – im Buendel teilen sich alle Module einen
Gueltigkeitsbereich, und was dort schiefgeht, geht genau dort schief, wo man es
am wenigsten merkt: auf dem Handy, offline, ohne Entwicklerwerkzeuge.

Geprüft wird vor allem die Reihenfolge, und dort der unbequeme Fall: dass Zeilen
ohne Entfernung in beiden Richtungen unten bleiben, dass eine eingetragene Zahl
eine gerechnete schlägt, und dass ein leeres Kilometerfeld leer bleibt. Der
letzte Punkt steht im Test, weil er einmal falsch war: `Number('')` ist `0`, und
damit behauptete die Tabelle von jeder Zeile ohne Angabe, sie wohne nebenan –
und stellte sie an die Spitze.
