# Workout

Trainings-App zum Plan aus `Workoutplan_mit_Bodyweight_Equivalent.xlsx` – mit
Umschalter zwischen **Hantel-Variante** und **reinem Bodyweight-Äquivalent**.

Statische Web-App: kein Build, keine Abhängigkeiten, keine Server-Anbindung.
`index.html` im Browser öffnen oder über GitHub Pages ausliefern. Alle
protokollierten Sätze liegen lokal im `localStorage` des Geräts.

## Tabs

| Tab | Inhalt |
| --- | --- |
| **Dashboard** | Startansicht: was heute ansteht, welche Muskelgruppen drankommen, Startknopf. Darunter drei Ebenen – Kurzliste, volle Übungsliste, Fokus-Ansicht während des Trainings. |
| **Plan** | Alle 57 Einheiten mit Datum, Status und Filter (Alle / Offen / Erledigt / Ab heute). Antippen öffnet die Einheit im Dashboard. |
| **Statistik** | Kennzahlen, nächste Einheit, **Gewichtsverlauf je Übung** und **Volumen je Muskelgruppe** als Verlaufskarten, meist trainierte Übungen. |
| **Mehr** | Standardmodus, „Modus je Workout merken“, verpasste Tage nachrücken, Plan-Verschiebung, Export/Import als JSON, Backup-Datei, Alles löschen. |

## Drei Ebenen

Die App zeigt beim Öffnen nur, was vor dem Training zählt, und wird erst
tiefer, wenn man es braucht:

1. **Startansicht** – eine Bildschirmseite ohne Scrollen: Datum und Umfang
   oben, darunter die Körperkarte über die volle Breite, die beanspruchten
   Gruppen als Marken, der Startknopf. Keine Übungsliste, keine Satz-Knöpfe:
   vor dem Training will man wissen, was kommt, nicht schon etwas abhaken.
   Kopf und Fuß nehmen sich, was sie brauchen, die Körperkarte bekommt den
   Rest – geprüft von 414 × 896 bis 360 × 740.
2. **Übungsliste** – die vollen Karten mit Gewicht, Satz-Knöpfen und Hinweisen.
   Erreichbar über *Übungen & Gewichte* oder aus dem laufenden Training.
3. **Fokus-Ansicht** – eine Übung groß, während trainiert wird.

### Körperkarte

`js/body.js` setzt Vorder- und Rückansicht aus den Muskelregionen selbst
zusammen – Hervorheben ist dadurch nur eine Frage der Füllfarbe, ohne zweite
Zeichnung darunter. Darunter liegt eine durchgehende Silhouette, sonst zerfällt
der Körper in einzelne Flecken. Kopf, Unterarme, Hände und Füße sind kein
Trainingsziel und bleiben neutral.

Welche Region eine Übung trifft, steht als `dbMuscles`/`bwMuscles` in
`tools/exercise-meta.json` – je Variante getrennt, weil sie sich unterscheiden
können: Seitheben trifft nur die Schulter, sein Bodyweight-Äquivalent Pike
Push-ups zusätzlich den Trizeps.

Der Plan ist Ganzkörpertraining, entsprechend ist an den meisten Tagen fast
alles hervorgehoben. Die Karte zeigt eher, was *nicht* drankommt.

## Bedienung während des Trainings

Zwischen zwei Sätzen soll die App so wenig Aufmerksamkeit wie möglich kosten:

* **Workout starten.** Der Knopf beginnt die Einheit und wechselt in die
  Fokus-Ansicht: eine Übung groß, mit vorgeführter Bewegung, Gewicht und
  Satz-Knöpfen. Sind alle Sätze abgehakt, rückt die App von selbst zur
  nächsten offenen Übung. Über *☰ Übersicht* geht es jederzeit zurück in die
  Liste, ohne das Training zu beenden. Der Start schaltet nebenbei den Ton frei
  – mobile Browser lassen ihn nur nach einer Berührung zu, und so sitzt schon
  das erste Pausensignal.
* **Ein Griff pro Satz.** Die Satz-Knöpfe liegen außerhalb des aufklappbaren
  Bereichs und sind 48 px hoch – Abhaken ohne Zielen, ohne vorher aufzuklappen.
* **Keine Wiederholungen eintragen.** Die stehen im Plan.
* **Ein Arbeitsgewicht je Übung**, vorbelegt mit einem Startwert (siehe unten).
  Änderbar durch Antippen der Zahl oder über **−** und **+**, die in 2,5-kg-
  Schritten gehen.
* **Pausentimer.** Startet automatisch beim Abhaken und meldet sich am Ende mit
  Ton und Vibration. Nach dem letzten Satz einer Übung läuft bewusst keiner.
  Während der Pause um 30 s verlängerbar oder vorzeitig beendbar.

### Bewegungsabläufe

`js/figure.js` zeichnet eine **drehbare 3D-Figur**. Eine Stellung hält nur
Gelenkwinkel, das Skelett rechnet `solve()` daraus. Das ist nicht bloß kürzer
als feste Punkte, sondern hält die Figur anatomisch beisammen: ein Knie kann
nicht neben der Hüfte landen, und dieselbe Stellung stimmt aus jedem
Blickwinkel. Waagerechtes Ziehen dreht um die Hochachse.

Gezeichnet wird mit schwacher Perspektive und Maleralgorithmus – was hinten
liegt, kommt zuerst. Der Rumpf ist eine Fläche zwischen Schultern und Hüften,
die Gliedmaßen sind Striche mit abgestufter Stärke.

**Frei drehbar in alle Richtungen:** waagerechtes Ziehen um die Hochachse,
senkrechtes um die Querachse, beides unbegrenzt und über volle Umdrehungen
hinaus. Auch der Boden liegt als Fläche im Raum und kippt mit – ein Strich am
unteren Rand sah aus wie ein Schieberegler.

Vorzeichen: `+lean` neigt den Rumpf **nach vorn**, und der Arm dreht mit dem
Rumpf mit (`-arm.p + lean`). Beides war zeitweise verdreht, wodurch die Figur
sich nach hinten lehnte und die Stellungen mühsam darum herumgebogen waren.

Reihenfolge der Drehungen ist bedeutsam: erst `roll` um die Längsachse (Brust
nach unten oder oben), dann `tilt` um die Blickachse (aufrecht oder liegend).
Umgekehrt liegt die Figur falsch herum – beim Liegestütz zeigte die Brust sonst
zum Betrachter statt zum Boden.

Die 14 Muster sind nach **Bewegungsart** benannt, nicht nach Übung – Goblet
Squat und Bodyweight Squat teilen sich `squat`. Zugeordnet wird je Variante
über `dbPattern`/`bwPattern` in `tools/exercise-meta.json`.

**Das Gerät leitet sich aus `weightNote` ab** (`equipFor`): „je Hand" ergibt
eine Kurzhantel pro Hand, „eine Hantel" eine vor der Brust, „Stange gesamt"
eine Langhantel über beide Hände, „auf der Hüfte" eine Hantel quer über dem
Becken. So sieht man der Figur an, womit sie arbeitet.

Bewusst keine fremden Bilder: Übungs-GIFs sind fast durchweg urheberrechtlich
geschützt, und ein zugekaufter Fremdstil neben eigenen Zeichnungen wirkt
zusammengestückelt. Alles aus einer Hand bleibt einheitlich und offline
lauffähig.

### Gewichte und Progression

`tools/exercise-meta.json` hält je Übung ein Startgewicht (`dbWeight`) und
einen Hinweis, wie es gemeint ist (`weightNote`: „je Hand", „eine Hantel",
„Zusatzgewicht", „Stange gesamt"). Übungen ohne Zusatzlast – Chin-ups, Sliding
Leg Curls, Füße-erhöhte Liegestütze – tragen dort `null` und zeigen gar keine
Gewichtszeile.

Die Startwerte sind Schätzungen für einen durchschnittlich trainierten
Erwachsenen, kein Messwert. Sie sind als Ausgangspunkt gedacht und werden vom
eigenen Wert überschrieben, sobald einer gesetzt ist.

**Das „+" wirkt ab dem nächsten Mal.** Sobald in einer Einheit der erste Satz
steht, ist deren Gewicht festgeschrieben: Beim Abhaken wird der benutzte Wert
in den Satz geschrieben, und die Karte zeigt weiter ihn. Eine Erhöhung landet
dann sichtbar als „Nächstes Mal: 22,5 kg" – die laufende Einheit wird nicht
rückwirkend umgeschrieben.

### Pausenlängen

Statt einer festen Länge bekommt jede Übung die, die zu ihrer Belastung passt
(`dbRest`/`bwRest` je Variante, an ACSM/NSCA-Richtwerten orientiert):

| Art | Pause | Beispiel |
| --- | --- | --- |
| mehrgelenkig schwer | 2:30 | Goblet Squat, Chin-ups |
| mehrgelenkig mittel | 2:00 | Floor Press, KH-Rudern, Hip Thrust |
| Beinbeuger | 1:30 | Sliding Leg Curl |
| größere Isolation | 1:15 | Trizepsstrecker, SZ-Curls |
| kleine Isolation, Waden | 1:00 | Seitheben, Reverse Fly, Wadenheben |
| Bauch | 0:45 | Crunches |

Die Bodyweight-Varianten weichen dort ab, wo sie einen anderen Charakter haben
– Pike Push-ups sind mehrgelenkig und bekommen 2:00, wo das Seitheben 1:00
hätte. Über *Mehr* lässt sich stattdessen eine feste Länge wählen oder die
Pause ganz abschalten.

Der Ton wird per Web Audio erzeugt, nicht als Datei geladen – das hält die App
offline-tauglich. Weil mobile Browser Ton nur nach einer Berührung zulassen,
entsteht der AudioContext beim ersten Abhaken. Während einer Pause hält die App
zusätzlich das Display wach (`navigator.wakeLock`), sonst friert der Browser die
Seite ein und das Signal käme zu spät.

Gespeichert wird der **Endzeitpunkt** der Pause, nicht die Restdauer. Dadurch
stimmt die Anzeige auch, wenn das Handy zwischendurch gesperrt war, und eine
laufende Pause übersteht sogar einen Neustart der Seite.

Da Wiederholungen nicht mehr erfasst werden, rechnet die Statistik mit dem
geplanten Wert – der unteren Grenze des Bereichs, also eher zu niedrig als zu
hoch. Die betroffenen Kennzahlen sind entsprechend als „ca." und „geplant"
ausgewiesen.

### Verlaufskarten

Die Statistik zeigt Gewicht je Übung und Volumen je Muskelgruppe über die Zeit
als **Small Multiples** – eine kleine Karte je Reihe statt eines Diagramms mit
vielen Linien. Bei zwölf Muskelgruppen wären zwölf Farben nicht mehr
auseinanderzuhalten, für Farbfehlsichtige schon gar nicht. Eine Karte je Reihe
braucht dagegen nur eine Farbe, und die Überschrift ersetzt die Legende.

Je Karte: Fläche als 10-%-Hauch, Linie 2 px, Endpunkt als Punkt mit Ring in der
Untergrundfarbe. Beschriftet wird nur der Endwert – eine Zahl an jedem Punkt
liest niemand. Ziehen über die Karte zeigt den Wert des jeweiligen Tages, die
vollständige Reihe steht im `aria-label`.

Volumen = Gewicht × geplante Wiederholungen × abgehakte Sätze. Nur
Hantel-Einheiten tragen Kilo bei; Bodyweight-Einheiten haben kein Gewicht, das
sich sinnvoll summieren ließe, und erscheinen deshalb nicht in dieser Rechnung.

## Verpasste Tage

Ist ein Trainingstag vorbei, ohne dass an der Einheit irgendetwas eingetragen
oder abgehakt wurde, gilt sie als nicht stattgefunden – und **der gesamte
Restplan rückt um so viele Tage nach hinten**, bis sie wieder auf heute fällt.
Die Abstände zwischen den Einheiten bleiben dabei unverändert; aus einer Pause
von drei Tagen wird also kein gedrängter Nachholplan.

Zwei Punkte, die dabei absichtlich so geregelt sind:

* **Die Historie wandert nicht mit.** Sobald an einer Einheit etwas erfasst
  wurde, merkt sich die App den Tag, an dem das passiert ist. Dieses Datum
  bleibt stehen, auch wenn der Plan später weiterrückt.
* **Angefangen zählt als trainiert.** Nachgerückt wird nur, wenn zu der Einheit
  gar nichts vorliegt – weder ein Haken noch ein eingetragenes Gewicht. Wer
  Sätze notiert, aber das Abhaken vergisst, verliert seinen Platz im Plan nicht.

Nachgerechnet wird beim Öffnen der App und beim Zurückkehren aus dem
Hintergrund, damit auch eine über Mitternacht offene App den richtigen Tag
zeigt. Unter **Mehr** lässt sich die Automatik abschalten, die aktuelle
Verschiebung ablesen, tageweise korrigieren oder auf die Original-Termine aus
der Excel zurücksetzen.

## Die zwei Modi

Der Umschalter oben rechts wechselt die angezeigte Variante. Die Satzzahl bleibt
in beiden Modi identisch, nur Übung und Wiederholungsbereich ändern sich – ohne
Zusatzlast wird über mehr Wiederholungen, langsameres Tempo oder eine einbeinige
Ausführung nachgeschärft.

Beide Varianten werden **getrennt** protokolliert: Wer ein Workout mit Hanteln
beginnt und auf Bodyweight umschaltet, verliert die Einträge nicht.

Ist „Modus je Workout merken“ aktiv (Standard), behält eine einmal bearbeitete
Einheit ihren Modus, auch wenn global umgeschaltet wird.

## Übungszuordnung

| Hanteln | Bodyweight-Äquivalent |
| --- | --- |
| Goblet Squat | 1½-Wdh. Bodyweight Squat |
| Fersenerhöhter Goblet Squat | Fersenerhöhter 1½-Wdh. Bodyweight Squat |
| Sliding Leg Curl | Sliding Leg Curl |
| Einbeiniger Sliding Leg Curl | Einbeiniger Sliding Leg Curl |
| Hip Thrust | Einbeiniger Hip Thrust |
| Gewichtete Liegestütze | Langsame Liegestütze (3 s ablassen) |
| Füße-erhöhte Liegestütze | Füße-erhöhte Liegestütze |
| Floor Press | Liegestütze |
| Einarmiges KH-Rudern | Inverted Rows an sicherer niedriger Stange |
| Chin-ups | Chin-ups |
| Reverse Fly | Prone Reverse Fly / Reverse Snow Angels |
| Sitzendes Seitheben | Pike Push-ups |
| Liegende Trizepsstrecker | Bodyweight Trizeps Extensions an niedriger Stange |
| SZ-Curls | Enge supinierte Chin-ups |
| Gewichtete Crunches | Crunches |
| Einbeiniges stehendes Wadenheben | Einbeiniges Wadenheben |
| Wadenheben gebeugtes Knie | Wadenheben mit gebeugtem Knie |

## Aufbau

```
index.html              Grundgerüst, Topbar mit Modus-Umschalter, Tabbar
css/styles.css          Styling (dunkel, mobil zuerst)
js/data.js              Aus der Excel generiert: 17 Übungen + 57 Einheiten
js/dates.js             Datums-Hilfsfunktionen
js/store.js             Zustand und localStorage-Persistenz
js/app.js               Rendering der fünf Tabs und Event-Handling
js/figure.js            Animierte Bewegungsabläufe (14 Muster)
js/body.js              Körperkarte mit den beanspruchten Muskelgruppen
js/chart.js             Verlaufskarten für die Statistik
sw.js                   Service Worker für den Offline-Betrieb
manifest.webmanifest    Installierbar als App auf dem Homescreen
data/…xlsx              Quelle des Plans
tools/build-data.py     Generator: Excel + Hinweise -> js/data.js
tools/exercise-meta.json  Muskelgruppe, Equipment und Ausführungshinweise je Übung
tools/build-single.py   Bündelt alles zu dist/workout.html
dist/workout.html       Erzeugt: die App als eine portable Datei
```

`js/data.js` ist generiert und wird nicht von Hand editiert. Planänderungen
gehören in die Excel, Textänderungen an Hinweisen in `tools/exercise-meta.json`.
Danach neu erzeugen (nur Standardbibliothek, keine Installation nötig):

```bash
python3 tools/build-data.py
```

Der Generator bricht ab, wenn eine Zeile nicht dem Muster `3× Übung (8–12)`
folgt, wenn Hantel- und Bodyweight-Spalte unterschiedlich viele Übungen haben
oder wenn zu einer Übung der Eintrag in `exercise-meta.json` fehlt.

## Aufs Handy bekommen

**Als GitHub Page.** In den Repo-Einstellungen unter *Pages* als Quelle diesen
Branch und den Ordner `/ (root)` wählen. Die App liegt dann unter
`https://finanzdienste.github.io/Workout/` und lässt sich im Browser über
*Teilen → Zum Home-Bildschirm* als App ablegen – dank `manifest.webmanifest`
startet sie dann ohne Browser-Leiste im Vollbild.

Einmal geladen, läuft die Seite auch **ohne Netz** – `sw.js` legt Oberfläche und
Plandaten im Browser ab. Seitenaufrufe gehen erst ans Netz und fallen bei
Fehlschlag auf den Zwischenspeicher zurück, damit eine neue Fassung sofort
ankommt, sobald Empfang besteht. Übrige Dateien kommen sofort aus dem
Zwischenspeicher und werden im Hintergrund erneuert.

Wichtig beim Ändern: `VERSION` in `sw.js` hochzählen, wenn Dateien aus der
Liste `SHELL` dazukommen oder wegfallen – daran hängt das Aufräumen alter
Zwischenspeicher.

**Als einzelne Datei.** `dist/workout.html` enthält die gesamte App inklusive
CSS und JavaScript und läuft ohne Server und ohne Netz. Neu bauen nach
Änderungen an `index.html`, `css/` oder `js/` – die Datei ist eine Kopie, kein
Verweis:

```bash
python3 tools/build-single.py
```

Auf Android: Datei aufs Gerät legen (Download, Cloud, Messenger, Kabel), in der
Dateien-App antippen, Chrome öffnet sie. Über *Menü → Zum Startbildschirm
hinzufügen* landet sie als Symbol neben den übrigen Apps. Eingetragene Sätze
überstehen Neuladen und Neustart – über `file://` mit persistentem
Browserprofil getestet.

Ein Hinweis dazu: Der Trainingsfortschritt liegt im `localStorage` und hängt
damit am Ort, von dem die App geladen wurde. Wer zwischen GitHub Page und
lokaler Datei wechselt, nimmt seine Daten über *Mehr → Export/Import* mit.
Kann ein Browser gar nicht speichern (privates Fenster, eingebettete Ansicht),
weist die App im Dashboard sichtbar darauf hin, statt Einträge still zu
verlieren.

## Lokal starten

```bash
npx http-server -p 8080 .
```

Dann `http://localhost:8080` öffnen. Ein Server ist nötig, weil `index.html`
ES-Module lädt und ein direkter `file://`-Aufruf davon vom Browser blockiert
wird – `dist/workout.html` hat dieses Problem nicht.
