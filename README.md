# Workout

Trainings-App zum Plan aus `Workoutplan_mit_Bodyweight_Equivalent.xlsx` – mit
Umschalter zwischen **Hantel-Variante** und **reinem Bodyweight-Äquivalent**.

Statische Web-App: kein Build, keine Abhängigkeiten, keine Server-Anbindung.
`index.html` im Browser öffnen oder über GitHub Pages ausliefern. Alle
protokollierten Sätze liegen lokal im `localStorage` des Geräts.

## Tabs

| Tab | Inhalt |
| --- | --- |
| **Dashboard** | Das heutige Workout (bzw. das nächste anstehende). Umschalter Hanteln ⇄ Bodyweight, Sätze abhaken, Gewicht/Wiederholungen protokollieren, Ausführungshinweis je Übung, Vergleich zum letzten Mal. Blättern zu jeder anderen Einheit. |
| **Plan** | Alle 57 Einheiten mit Datum, Status und Filter (Alle / Offen / Erledigt / Ab heute). Antippen öffnet die Einheit im Dashboard. |
| **Übungen** | Die 17 Grundübungen als Gegenüberstellung Hantel ⇄ Bodyweight, je mit Wiederholungsbereich, benötigtem Equipment und Ausführungshinweis. Durchsuchbar. |
| **Statistik** | Erledigte Workouts, Serie, abgehakte Sätze, Wiederholungen, Hantel-Volumen in kg, Verteilung der Modi, meist trainierte Übungen. |
| **Mehr** | Standardmodus, „Modus je Workout merken“, Export/Import als JSON, Backup-Datei, Alles löschen. |

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
js/store.js             Zustand und localStorage-Persistenz
js/app.js               Rendering der fünf Tabs und Event-Handling
manifest.webmanifest    Installierbar als App auf dem Homescreen
data/…xlsx              Quelle des Plans
tools/build-data.py     Generator: Excel + Hinweise -> js/data.js
tools/exercise-meta.json  Muskelgruppe, Equipment und Ausführungshinweise je Übung
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

## Lokal starten

```bash
npx http-server -p 8080 .
```

Dann `http://localhost:8080` öffnen. (Ein Server ist nötig, weil die App
ES-Module lädt; ein direkter `file://`-Aufruf wird vom Browser blockiert.)
