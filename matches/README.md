# Matches

Eine Tabelle aller Matches aus Tinder, Hinge und Bumble – sortiert nach
Entfernung. Eigene Seite unter `matches/`, eigener Speicher, kein Zusammenhang
mit dem Trainingsplan außer dem Aussehen.

Öffnen: `matches/index.html` über einen Webserver (ES-Module), im Betrieb also
`…/matches/` auf derselben Adresse wie die Workout-App.

## Was diese App nicht kann, und warum

Das gehört an den Anfang, weil es die halbe Bedienung erklärt.

**Es gibt keine Schnittstelle.** Weder Tinder noch Hinge noch Bumble bietet
einen offiziellen Zugang zu den eigenen Matches. Was man bekommt, ist die
Datenauskunft nach Art. 15 DSGVO: selbst anfordern, ein paar Tage warten, Link
per Mail. Der andere Weg – ein Programm, das sich als App ausgibt und das eigene
Konto fernsteuert – verstößt gegen die Nutzungsbedingungen, und das übliche Ende
ist eine Kontosperre. Deshalb steht er hier nicht zur Wahl.

**In dieser Auskunft stehen keine Entfernungen.** In keiner der drei. Die „4 km"
im Profil entstehen im Moment des Anzeigens aus zwei aktuellen Standorten und
werden nirgends gespeichert. Es gibt also keine Datei, aus der sich die
gewünschte Spalte auslesen ließe – auf keinem legalen und auf keinem illegalen
Weg.

**Und meistens fehlen auch die Namen.** Tinder liefert Match-Kennungen wie
`5f3a…` und die Nachrichten, die *man selbst* geschickt hat; Hinge liefert
Zeitstempel und Gesprächsverläufe ohne jeden Namen. Bumble ist uneinheitlich –
dort stehen manchmal Namen dabei.

Daraus folgt der Zuschnitt: Der Import baut das Gerüst (Datum, Nachrichtenzahl,
Stand), die beiden Spalten, um die es eigentlich geht, füllt man selbst. Das
Formular ist darauf ausgelegt – Name, App, Zahl, Enter.

## Automatisch mitlesen – für Tinder

`matches/mitlesen.user.js` ist der einzige Weg, auf dem eine **Entfernung von
selbst** in diese Tabelle kommt. Er funktioniert für Tinder, und nur dafür:

| Dienst | Weboberfläche | mitlesen |
| --- | --- | --- |
| Tinder | tinder.com, funktioniert | ja |
| Bumble | am 8. August 2026 abgeschaltet | nein |
| Hinge | gab es nie | nein |

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

### Bumble und Hinge

Bleiben Handarbeit – oder ein Eingriff auf dem Telefon selbst: Der Datenverkehr
der App lässt sich mit einem Proxy mitlesen, aber beide Apps prüfen das
Serverzertifikat gegen ihr eigenes (*certificate pinning*), was ein gerootetes
Android und ein Werkzeug wie Frida voraussetzt. Auf iOS läuft es auf einen
Jailbreak hinaus. Der Aufwand ist groß, das Sperrrisiko deutlich höher als beim
Mitlesen im Browser, und beides steht hier nicht.

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
