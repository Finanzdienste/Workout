# Workout

Trainings-App zum Plan aus `Workoutplan_mit_Bodyweight_Equivalent.xlsx` – mit
Umschalter zwischen **Hantel-Variante** und **reinem Bodyweight-Äquivalent**.

Statische Web-App: kein Build, keine Abhängigkeiten, keine Server-Anbindung.
`index.html` im Browser öffnen oder über GitHub Pages ausliefern. Alle
protokollierten Sätze liegen lokal im `localStorage` des Geräts.

## Tabs

| Tab | Inhalt |
| --- | --- |
| **Dashboard** | Das heutige Workout (bzw. das nächste anstehende). Umschalter Hanteln ⇄ Bodyweight, Sätze direkt abhaken, Pausentimer, Gewicht notieren, Ausführungshinweis je Übung, Vergleich zum letzten Mal. Blättern zu jeder anderen Einheit. |
| **Plan** | Alle 57 Einheiten mit Datum, Status und Filter (Alle / Offen / Erledigt / Ab heute). Antippen öffnet die Einheit im Dashboard. |
| **Übungen** | Die 17 Grundübungen als Gegenüberstellung Hantel ⇄ Bodyweight, je mit Wiederholungsbereich, benötigtem Equipment und Ausführungshinweis. Durchsuchbar. |
| **Statistik** | Erledigte Workouts, Serie, abgehakte Sätze, Wiederholungen, Hantel-Volumen in kg, Verteilung der Modi, meist trainierte Übungen. |
| **Mehr** | Standardmodus, „Modus je Workout merken“, verpasste Tage nachrücken, Plan-Verschiebung, Export/Import als JSON, Backup-Datei, Alles löschen. |

## Bedienung während des Trainings

Zwischen zwei Sätzen soll die App so wenig Aufmerksamkeit wie möglich kosten:

* **Ein Griff pro Satz.** Die Satz-Knöpfe liegen außerhalb des aufklappbaren
  Bereichs und sind 48 px hoch – Abhaken ohne Zielen, ohne vorher aufzuklappen.
* **Keine Wiederholungen eintragen.** Die stehen im Plan. Aufgeklappt wird nur
  noch das Gewicht notiert, und auch das freiwillig.
* **Pausentimer.** Startet automatisch beim Abhaken und meldet sich am Ende mit
  Ton und Vibration. Nach dem letzten Satz einer Übung läuft bewusst keiner.
  Länge über *Mehr* einstellbar (Standard 1:30), abschaltbar, während der Pause
  um 30 s verlängerbar oder vorzeitig beendbar.

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
