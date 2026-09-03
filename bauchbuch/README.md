# Bauchbuch

Ein Gesundheitstagebuch mit Schwerpunkt Magen und Verdauung. Man trägt ein, was
man gegessen hat und wie es einem danach ging – dazu Stimmung, Anspannung,
Schlaf, Bewegung und Zyklus. Nach ein paar Wochen zeigt die App, was
zusammenfällt, ordnet das Bild ein und macht daraus einen Zettel für den
nächsten Arzttermin.

**Alles bleibt auf dem Gerät.** Es gibt keinen Server, kein Konto, keine
Anmeldung und keine Zählung von Aufrufen. Die Eintragungen liegen im
`localStorage` des Browsers, in dem sie gemacht wurden, und verlassen ihn nie.
Das ist keine Absichtserklärung, sondern eine geprüfte Eigenschaft – siehe
[Die eine Zusage](#die-eine-zusage).

---

## Was die App kann

**Tag.** Vier Knöpfe: Mahlzeit, Beschwerden, Medikament, Notiz. Eine Mahlzeit
bekommt einen freien Text, eine Portionsgröße und angekreuzte Merkmale aus
einer kurzen Liste (Kaffee, Fettiges, Scharfes, Zwiebeln, Kohlensäure …).
Beschwerden bekommen eine Stärke von 0 bis 10, eine oder mehrere Arten und
eine Notiz. Dazu für den ganzen Tag: Anspannung und Schlaf.

**Verlauf.** Ein Balken je Tag über 14, 30 oder 90 Tage, ein Monatskalender
und vier Zahlen: notierte Tage, Anteil mit Beschwerden, mittlere Stärke,
beschwerdefreie Tage in Folge.

**Muster.** Die eigentliche Auskunft. Ganz oben Warnzeichen, darunter die
Einordnung des Bildes (siehe unten), dann: Geht es nach Mahlzeiten mit einem
bestimmten Merkmal schlechter als nach den übrigen? Dazu Tageszeit, Art der
Beschwerden und die Auswertung nach Zyklusphase.

**Ruhe.** Vier Atemübungen – 4–7–8, Quadrat, Gleichmaß, Bauchatmung – mit Ton,
damit man die Augen zumachen kann. Der Ton entsteht im Browser aus einem
Oszillator: keine Datei, kein Download, läuft offline. Bei jeder Übung ist das
Ausatmen mindestens so lang wie das Einatmen; umgekehrt täte die Übung das
Gegenteil.

**Ideen.** Ein Zettel für Verbesserungsvorschläge zur App selbst. Wer die App
benutzt, sitzt selten neben dem, der sie baut – deshalb ist der eigentliche
Knopf nicht „Eintragen", sondern „Alle kopieren": die Liste als Text, zum
Einfügen in eine Nachricht. Ideen stehen neben den Eintragungen, nicht in
ihnen, und tauchen in keiner Auswertung auf.

**Mehr.** Sicherung als JSON-Datei und zurück, der Bericht für den Arzttermin,
die Übersicht „Was die Mittel bewirken", die Einstellungen der Auswertung,
welche Tagesfragen erscheinen sollen, eigene Auslöser, Ton, vier Farbvarianten.

### Vorschläge für heute

Auf dem Tagesreiter steht, was für heute naheliegt: worauf sie heute eher
verzichten würde, ob Bewegung gerade intensiv oder moderat sinnvoll ist, ob
eine Atemrunde ansteht. Jeder Vorschlag trägt sein **warum** sichtbar mit sich
und die Angabe, woher es kommt:

* **aus deinem Verlauf** – aus den eigenen Eintragungen gerechnet, mit den
  Zahlen daneben („nach 12 Mahlzeiten mit Kaffee im Mittel 7,0 statt 0,0").
* **allgemein** – gilt für einen Durchschnitt, den es nicht gibt. Sticht der
  eigene Verlauf.

Ein Rat ohne Begründung ist ein Befehl, und Befehle über das eigene Essen
befolgt man blind oder gar nicht. Beides ist schlecht.

**Was hier nicht vorkommt: welches Medikament sie nehmen soll.** Diese Wahl
hängt an Diagnose, anderen Mitteln, Nieren, Leber, Schwangerschaft – nichts
davon weiß die App, und keines davon kann sie erfragen, ohne so zu tun, als
wüsste sie es dann. Was stattdessen kommt: was sie selbst eingenommen hat, wann
zuletzt, was es bewirkt, und die Frage dazu für den nächsten Termin.

### Wie weit Richtung Diagnose

So weit, wie ein Tagebuch ehrlich kommt – und keinen Schritt weiter.

Nicht weiter, weil weiter geraten wäre: Gastritis, Magengeschwür,
Refluxkrankheit, funktionelle Dyspepsie und ein Reizdarm machen im Tagebuch
teils dasselbe Bild. Auseinander hält sie eine Magenspiegelung, ein Test auf
Helicobacter, ein Blutbild, ein Atemtest. Eine App, die sich trotzdem für eine
entscheidet, nimmt der Untersuchung ihre Frage weg.

Was `js/bild.js` stattdessen liefert:

1. **Warnzeichen.** Blut erbrochen, schwarzer Stuhl, Schluckstörung,
   ungewollter Gewichtsverlust, nächtliches Aufwachen, Schmerz mit Ausstrahlung
   in Arm oder Kiefer. Sie werden im Beschwerdebogen angekreuzt, tauchen in
   keiner Statistik auf und stehen im Reiter „Muster" wie im Bericht ganz oben,
   mit `sofort` oder `zeitnah`. Ohne Schwelle: Ein einziges Mal ist ein
   einziges Mal zu viel.
2. **Muster mit Belegen.** Säuretypisch, Nüchternschmerz, Völlegefühl nach dem
   Essen, darmbetont, Zusammenhang mit Schmerzmitteln, zyklusgebunden,
   anspannungsgebunden. Jedes nennt seine Belege mit Zahlen – „14 von 14
   zuordenbaren Beschwerden kamen erst vier Stunden nach der letzten Mahlzeit".
   Angezeigt wird nur, was mindestens zwei Belege hat.
3. **Was dahinterstecken kann und was es unterscheidet.** Also welche
   Untersuchung welche Frage beantwortet – die nützlichste Zeile des
   Programms.
4. **Fertige Fragen für den Termin.**

Der Zyklus wird aus den eingetragenen Blutungstagen gerechnet, nicht
vorhergesagt. Ohne abgeschlossenen Zyklus gibt es keine mittlere Länge und
damit keine Phasen; 28 Tage still anzunehmen wäre bequem und bei jedem, dessen
Zyklus 24 oder 34 Tage dauert, durchgehend falsch. **Nicht zur Verhütung
geeignet** – der Eisprung wird hier nicht gemessen, sondern geschätzt.

### Was die Mittel bewirken

Wer Magenbeschwerden hat, hat bald mehrere Schachteln im Schrank, und die
Beipackzettel beantworten selten die Frage, die man wirklich hat: Was macht das
eigentlich, und warum ausgerechnet vor dem Frühstück? `js/mittel.js` beschreibt
neun Wirkstoffgruppen – von Protonenpumpenhemmern über Antazida bis zur
Helicobacter-Behandlung – in ganzen Sätzen: wie sie arbeiten, wann man sie
üblicherweise nimmt, worauf zu achten ist. Unter „Mehr" stehen zuerst die
Mittel, die tatsächlich eingetragen wurden, mit Häufigkeit und Erklärung; beim
Eintragen erscheint die Erklärung gleich im Bogen.

Dazu gehören zwei Gruppen, die keine Magenmittel sind: entzündungshemmende
Schmerzmittel und Kortison. Eine Übersicht über Magenmittel, in der das fehlt,
was den Magen erst reizt, ist die halbe Wahrheit – und die gefährlichere Hälfte.

Drei Regeln hält der Text ein, und `tests/test-mittel.mjs` zählt sie nach:
**keine Dosierungen**, **keine Empfehlung** („nimm", „hilft gegen" kommen
nirgends vor), und der Verweis auf Ärztin oder Apotheke steht sichtbar darüber.

## Wie die Auswertung rechnet – und was sie nicht behauptet

Verglichen wird die mittlere Beschwerdestärke in den *n* Stunden nach
Mahlzeiten **mit** einem Merkmal gegen alle **übrigen** Mahlzeiten. Also nicht
gegen null, sondern gegen den eigenen Alltag: Sonst wäre bei jedem Menschen mit
täglichen Beschwerden jedes Lebensmittel „auffällig", das er täglich isst.

Drei Regeln halten das davon ab, Kaffeesatzleserei zu werden:

1. **Fallzahl.** Ein Merkmal erscheint erst mit mindestens fünf Mahlzeiten
   dafür *und* fünf dagegen (einstellbar). Darunter steht es unter „Zählt
   noch", mit der Angabe, wie viele fehlen.
2. **Die Zahlen stehen daneben.** Immer beide Mittelwerte, beide Fallzahlen,
   beide Quoten – auch wenn sie unbequem sind.
3. **Es heißt „auffällig", nicht „verursacht".** Ab einem Punkt Unterschied
   „möglicherweise", ab zwei „auffällig". Darunter: kein Unterschied.

Was dabei herauskommt, ist eine Häufigkeit. Wer an einem ohnehin schlechten Tag
anders isst, findet sich hier wieder, ohne dass das Essen schuld wäre. Die App
stellt keine Diagnose und ersetzt keine ärztliche Beratung.

Eine Unterscheidung trägt das Ganze: **Ein Tag ohne Beschwerden ist etwas
anderes als ein Tag ohne Eintragung.** Beide sind „null", und sie sind das
Gegenteil voneinander. Lücken häufen sich ausgerechnet in den Wochen, in denen
es jemandem zu schlecht ging, um etwas einzutragen – wer sie als gute Tage
zählt, baut eine App, die genau dann Besserung meldet. Deshalb trägt jeder Tag
ein `notiert`, und der Verlauf zeigt eine Lücke als Lücke.

## Die eine Zusage

„Alles bleibt auf dem Gerät" ist die einzige Zusage, die diese App macht, und
ein Satz in einer README ist keine Eigenschaft. Zwei Prüfungen halten ihn:

* `tools/pruefung/keine-leitung.py` – der schnelle Nachweis ohne Browser:
  keine Adresse im Quelltext, kein `XMLHttpRequest`, kein `sendBeacon`, kein
  `WebSocket`, keine eingebundene Schrift, kein CSS-Import.
* `tests/test-still.mjs` – der gründliche: Ein Browser geht einmal durch die
  ganze App, jede Anfrage wird mitgeschrieben, und alles, was nicht auf die
  eigene Adresse zeigt, lässt den Test scheitern.

Beide laufen bei jedem Push.

Eine Ausnahme mit Ansage: Der Knopf „Teilen" unter „Ideen" ruft
`navigator.share` auf, sofern das Gerät es kennt. Auch damit sendet die App
nichts – der Text wird an das Betriebssystem übergeben, das daraufhin *den
Nutzer* fragt, wohin. Wo es die Schnittstelle nicht gibt, bleibt der
gewöhnliche Weg über die Zwischenablage.

## Benutzen

Drei Wege, alle gleichwertig:

| Weg | Wie |
| --- | --- |
| **Eine Datei** | `dist/bauchbuch.html` herunterladen und öffnen. Läuft per Doppelklick, ohne Server, ohne Netz. Auf dem Handy: öffnen, „Zum Startbildschirm hinzufügen". |
| **Aus dem Ordner** | `index.html` braucht einen Webserver, weil ES-Module und der Service Worker das verlangen: `npm run serve`, dann `http://127.0.0.1:8199/`. |
| **Über GitHub Pages** | Wenn eingerichtet, unter der Adresse des Repositories. |

Die Ein-Datei-Fassung ist nicht die zweite Wahl, sondern für diese App der
naheliegende Weg: Sie braucht keine Adresse, die irgendwo im Netz steht, und
das Tagebuch entsteht trotzdem an genau einer Stelle – im Browser dessen, der
es führt.

**Sicherung.** Was nur in einem Browser liegt, ist mit dem Browser weg:
gelöschte Website-Daten, ein neues Handy, ein privates Fenster. Unter „Mehr"
gibt es eine Sicherungsdatei, gewöhnliches JSON, auch ohne diese App lesbar.

## Entwickeln

```
npm ci                              # nur Playwright, nur für die Tests
npx playwright install chromium
python3 tools/build-single.py       # dist/bauchbuch.html neu bauen
node tests/lauf.mjs                 # alle Tests
node tests/lauf.mjs muster rechnen  # einzelne
npm run serve                       # http://127.0.0.1:8199/
```

Die App selbst hat keine Abhängigkeit und keinen Bauschritt. Der einzige
erzeugte Stand ist `dist/bauchbuch.html`; er wird bei jedem Push nachgebaut und
mit dem eingecheckten verglichen.

### Aufbau

```
index.html          Gerüst: Kopfleiste, ein <main>, die Reiterleiste
css/styles.css      ein Blatt, Farben als Variablen auf :root
js/datum.js         Datum und Uhrzeit, hängt von nichts ab
js/text.js          Text und Zahlen fürs Auge
js/daten.js         die Kataloge: Auslöser, Beschwerdearten, Skalenworte
js/chart.js         Balken und Vergleichsbalken als SVG-Zeichenkette
js/store.js         der Speicher – localStorage, mehr gibt es nicht
js/auswertung.js    die Rechenschicht: Merkmale, Fenster, Bilanz, Verlauf
js/mittel.js        was die Wirkstoffgruppen bewirken – reine Daten
js/klang.js         Töne aus einem Oszillator, keine Dateien
js/atem.js          die Atemübungen – Daten, nicht der Ablauf
js/zyklus.js        Zyklen und Phasen aus Blutungstagen
js/bild.js          Warnzeichen, Muster, Differentialdiagnosen, Fragen
js/rat.js           Vorschläge für heute, jeder mit seinem Grund
js/bericht.js       der Zettel für den Arzttermin, als reiner Text
js/app.js           die Anzeige: ein Zustand, eine Zeichenfunktion,
                    ein Klick-Empfänger für alles
sw.js               Service Worker – ohne Netz benutzbar
```

Die Richtung ist Einbahnstraße: Die Anzeige darf rechnen lassen, die Rechnung
weiß nichts von der Anzeige. `tools/pruefung/schichten.py` prüft das, sucht
Kreise und stellt sicher, dass jedes Modul sowohl im Bündel
(`tools/build-single.py`) als auch im Offline-Vorrat (`sw.js`) steht. Fehlt es
in einer der Listen, geht genau eine der beiden Fassungen still kaputt.

### Tests

Sechzehn Dateien, über 320 Prüfungen, alle in einem echten Chromium. Kein
Rahmenwerk: Jeder Test ist ein eigenes Programm und meldet sein Ergebnis über
den Rückgabewert.

| Datei | Was sie prüft |
| --- | --- |
| `test-rechnen.mjs` | die Rechenschicht an ausgedachten Verläufen mit bekanntem Ergebnis |
| `test-eintrag.mjs` | eintragen, ändern, löschen, blättern |
| `test-muster.mjs` | ein gepflanzter Zusammenhang wird gefunden, ein zu dünner nicht |
| `test-verlauf.mjs` | Kacheln, Balken, Kalender – und die Lücke bleibt eine Lücke |
| `test-bericht.mjs` | die Zahlen im Arztbericht |
| `test-sicherung.mjs` | sichern, alles löschen, wieder einlesen – über echte Dateien |
| `test-persist.mjs` | die Ein-Datei-Fassung übersteht Neuladen und Neustart |
| `test-offline.mjs` | Service Worker, offline eintragen, offline auswerten |
| `test-ideen.mjs` | eintragen, abhaken, kopieren – und Ideen bleiben aus der Auswertung heraus |
| `test-mittel.mjs` | die Zuordnung freier Namen zur Wirkstoffgruppe, und der Ton der Texte |
| `test-zutaten.mjs` | Reihenfolge nach Häufigkeit, Rollen statt Gramm, Umrechnung alter Stände |
| `test-zyklus.mjs` | Zyklen, Phasen – und das Schweigen ohne Grundlage |
| `test-bild.mjs` | Warnzeichen kommen durch; Nüchternschmerz wird nicht mit Völlegefühl verwechselt |
| `test-rat.mjs` | jeder Vorschlag mit Grund, und keine Medikamentenempfehlung |
| `test-atem.mjs` | Phasenlängen, Ablauf, Abbruch beim Reiterwechsel, stummer Betrieb |
| `test-still.mjs` | die App schickt nichts |

Die Auswertung wird nicht daran geprüft, ob im Browser etwas Grünes steht,
sondern an Verläufen, deren richtiges Ergebnis vorher feststeht. Der wichtigste
Fall ist der, in dem die App **schweigen** muss: Bei zwei Mahlzeiten mit
Alkohol und zweimal Stärke 10 darf nichts herauskommen. Eine App, die daraus
eine Regel macht, bringt jemanden dazu, sein Essen umzustellen, ohne dass es
dafür einen Grund gibt.

## Herkunft

Aufbau, Testläufer, der Ein-Datei-Bau und die Schichtungsprüfung stammen aus
einem Schwesterprojekt und sind hier übernommen und angepasst. Was ausdrücklich
nicht mitgekommen ist: der Rückkanal. Eine App über den eigenen Körper meldet
niemandem etwas.
