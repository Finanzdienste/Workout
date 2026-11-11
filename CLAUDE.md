# Hinweise für Claude

## Ultracode-Empfehlung
Bevor du mit einer Aufgabe anfängst: Wenn sie sich für einen Workflow eignet
(dieselbe Arbeit über viele Dateien, eine Prüfung über das ganze Projekt oder
eine Aufgabe, die zu groß für einen einzelnen Agenten ist), schlag mir in einem
Satz vor, sie mit „ultracode“ laufen zu lassen, und warte auf meine Antwort.
Bei normalen Aufgaben erwähnst du Ultracode nicht.

## Das Repository
- **Workout-App** (Wurzel): PWA für Tobi, live unter
  https://finanzdienste.github.io/Workout/. Kein Bauschritt außer zwei
  Generatoren (unten), keine Abhängigkeiten zur Laufzeit.
- **`schilddruese/`**: eigene App mit eigenem Service Worker, eigener `VERSION`
  und eigenen Tests (`tests/test-sd-*.mjs`). Ihre Regeln stehen in
  `schilddruese/README.md`.
- **`freizeit/`**: nur noch eine Weiterleitung; die Freizeit-App liegt in
  `Finanzdienste/Freizeit`.
- **`README.md` ist das Gedächtnis der Workout-App**: jede Entscheidung mit
  Tobis Zitat, was vorher war, was jetzt gilt, warum, und wo es geprüft wird.
  Vor einer Änderung den passenden Abschnitt suchen (grep) und lesen.

## Mit Tobi arbeiten
- Deutsch. Er schreibt kurz, meist vom Handy, oft mit einem Screenshot aus der
  App. Antworten knapp und direkt.
- Jede Rückmeldung wird eine Änderung an der App, nicht bloß eine Erklärung.
  Sagt er „Entscheide du“, entscheiden und in einem Satz begründen.
- Nachfragen nur, wenn die Antwort etwas ändert – meist Zahlen, die nur er
  kennt („Wie viele saubere Chin-ups schaffst du?“).
- Was er selbst tun muss (in der App einstellen, im Apps-Script-Editor
  einspielen), als genaue Klickfolge sagen.

## Ablauf je Änderung (Workout-App)
1. Ursache finden; den README-Abschnitt dazu lesen.
2. Ändern. Übungsdaten stehen in `tools/exercise-meta.json` (dazu
   `data/Workoutplan_mit_Bodyweight_Equivalent.xlsx`) →
   `python3 tools/build-data.py` schreibt `js/data.js`. Danach immer
   `python3 tools/build-single.py` (`dist/workout.html`).
3. Test: neuer oder erweiterter `tests/test-*.mjs`, der gegen die alte Fassung
   rot ist. So geprüft: `git worktree add <ordner> HEAD`, `node_modules` dorthin
   verlinken, den neuen Test hineinkopieren, dort laufen lassen.
4. README: Abschnitt mit Tobis Zitat, „(vNNN)“ in der Überschrift oder im
   ersten Satz.
5. `const VERSION = 'vNNN'` in `sw.js` hochzählen (`versionspflicht.py` prüft
   das, sobald eine Datei geändert ist, die der Service Worker vorhält).
6. Prüfen: `sh tools/pruefung/tore.sh`, `npm run lint`, die betroffenen Tests;
   bei Änderungen an `js/app.js`, `js/store.js` oder `js/plan.js` die volle
   Suite.
7. Commit (deutsch, erste Zeile endet auf „(vNNN)“; der Haken in
   `.githooks/pre-commit` prüft Bau, Linter und alle Tore). Push auf `main`
   **und** `git push origin main:claude/workout-app-bodyweight-tabs-1lob1j` –
   von diesem Zweig baut GitHub Pages.
8. Live prüfen: `gh run list --repo Finanzdienste/Workout --workflow
   pages-build-deployment --limit 1` (fertig, richtiger Commit), oder `sw.js`
   von der Seite laden, wo das Netz es erlaubt.

## Tests
- Erst `npm ci` (eslint, playwright 1.56.1). Fehlt dessen Chromium:
  `npx playwright install chromium`.
- `node tests/lauf.mjs [teil…]`: Teil ist ein Teilstring des Dateinamens
  („test-nacharbeit“ trifft auch `test-nacharbeit-herkunft`). Ports 8099/8100.
- Die volle Suite dauert 45 bis 60 Minuten: im Hintergrund starten
  (`nohup node tests/lauf.mjs > log 2>&1 &`) und mit einer until-Schleife auf
  das Ende warten. Solange sie läuft, keine Datei ändern – der Testserver
  liefert die Arbeitskopie aus.
- Bekannt rot: `test-kalender-sync.mjs` mit genau 12 Prüfungen (Hintergrund
  des Service Workers in headless Chromium). In CI kippt gelegentlich eine
  einzelne Zeitprüfung dort oder in `test-tagesabschluss.mjs`. Alles andere
  muss grün sein.
- Prozesse nicht mit `pkill -f` beenden (trifft die eigene Shell), sondern
  `pgrep -f "^node tests/lauf.mjs"` und gezielt `kill`.
- Einseitige Übungen („je Bein“) haben zwei Haken je Satz – Tests tippen Sätze
  über `tests/saetze.mjs`.
- Frischer Zustand = neuer Browser-Kontext: Mitten in einer Einheit kam nach
  `localStorage.clear()` und Neuladen der alte Stand zurück – die App schreibt
  beim Verlassen noch einmal weg.
- Töne offline rendern (OfflineAudioContext, siehe `tests/test-sound.mjs`),
  nicht nur Knoten zählen – so wurde der stumme Ton von v250 gefunden.

## Tore (wie der CI-Job „Pläne und erzeugte Dateien“)
`tools/pruefung/tore.sh`: plan-pruefen, weg-nach-unten, geraete, wochen-cap,
plan-frisch, schichten, bewegung, versionspflicht, plan-vorher. Eine neue
Übung mit `nurErsatz: true` braucht zwei Einträge: `hingenommen` in
`tools/pruefung/plan-eingaben.json` (alle vier Pläne, mit Grund) und
`python3 tools/pruefung/plan-pruefen.py --schreiben` für
`tools/pruefung/befunde.json` – danach im Diff nur die erwarteten Zeilen.
Neue Module: Reihenfolge in `MODULES` von `tools/build-single.py`
(`schichten.py` prüft sie).

## Teile außerhalb des Repos
- **Google Kalender „Workout“**: `kalender/workout-kalender.gs` läuft als Apps
  Script in Tobis Google-Konto. Eine neue Fassung spielt er selbst ein (Code im
  Editor ersetzen, dann `einrichten` ausführen). Uhrzeit und Erinnerung kommen
  aus der App (*Mehr → Google Kalender automatisch*); was man im Kalender
  direkt ändert, gleicht das Skript stündlich wieder an.
- **Microsoft To Do**: dasselbe Skript; Tobis App-ID steht in `TODO_APP`
  (seit v251), verbunden über `todoVerbinden`.
- **Sicherung**: verschlüsselt und automatisch (README „Sicherung“); in Tests
  nachgebildet durch `tests/sicherung-labor.mjs`.

## Stand (11.11.2026)
- Workout v256 live. Zuletzt: je Bein zwei Haken mit eigener Seitenpause
  (halbe Satzpause, v255), Chin-ups für Anfänger 3–10, lautere Töne (v256).
- Offen bei Tobi: ob ihm die halbe Seitenpause reicht (sonst die volle nach
  jeder Seite); die Kalender-Erinnerung stellt er in der App auf „keine“.

## Cloud-Sitzungen (Claude Code im Browser oder in der Claude-App)
- Chromium für playwright 1.56.1 lädt `npx playwright install chromium` von
  `cdn.playwright.dev` und `playwright.download.prss.microsoft.com`. Beide
  stehen nicht in der Standardliste „Trusted“ – in der Umgebung unter
  Netzwerkzugriff „Custom“ eintragen (mit der Standardliste) oder „Full“.
- Die Pages-API ist über den GitHub-Proxy gesperrt: den Deploy über
  `gh run list … pages-build-deployment` prüfen. GraphQL über `gh` geht
  nicht, REST (`gh api repos/...`) schon.
