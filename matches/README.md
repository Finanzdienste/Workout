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

## Prüfen

```bash
node tests/lauf.mjs matches
```

Geprüft wird vor allem die Reihenfolge, und dort der unbequeme Fall: dass Zeilen
ohne Entfernung in beiden Richtungen unten bleiben, dass eine eingetragene Zahl
eine gerechnete schlägt, und dass ein leeres Kilometerfeld leer bleibt. Der
letzte Punkt steht im Test, weil er einmal falsch war: `Number('')` ist `0`, und
damit behauptete die Tabelle von jeder Zeile ohne Angabe, sie wohne nebenan –
und stellte sie an die Spitze.
