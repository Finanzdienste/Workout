# Hinweise für Claude

## Ultracode-Empfehlung
Bevor du mit einer Aufgabe anfängst: Wenn sie sich für einen Workflow eignet
(dieselbe Arbeit über viele Dateien, eine Prüfung über das ganze Projekt oder
eine Aufgabe, die zu groß für einen einzelnen Agenten ist), schlag mir in einem
Satz vor, sie mit „ultracode“ laufen zu lassen, und warte auf meine Antwort.
Bei normalen Aufgaben erwähnst du Ultracode nicht.

## Modell und Aufwand
Bevor du mit einer Aufgabe anfängst: Passt sie deutlich besser zu einem anderen
Modell oder Aufwand als dem laufenden, schlag mir das in einem Satz vor – mit
Grund und dem Befehl, den ich als Nachricht schicke (`/model fable|opus|sonnet`,
`/effort low|medium|high|xhigh|max`). Was gerade läuft, zeigt `get_session`
(`model`, `effort_level`); am 11.11.2026 war es Opus 5.5 mit Aufwand max.
- **Nur melden, wenn etwas zu ändern ist** (Tobi, 26.11.2026: „Dass Opus okay
  ist brauch ich nicht zu wissen, ich brauch nur zu wissen wenn was geändert
  werden muss“): Kein Schlusssatz mehr wie „passt – nichts umstellen“. Sollte
  etwas umgestellt werden (Modell, Aufwand, neuer Chat), am Ende ein Satz mit
  Grund und dem genauen Befehl.
- **Neuer Chat – fast nie** (Tobi, 27.11.2026: „Also eigentlich brauch man
  doch nie nen neuen chat oder?“ – „Dann lass die Regel doch ändern“): Wird
  der Verlauf voll, fasst die Sitzung ihn bei etwa 90 % von selbst zusammen,
  und es geht weiter (am 27.11. von 79 % auf 27 %); das ist nicht schlechter
  als ein neuer Chat (Tobi, 26.11.: „dass hier Infos zusammengefasst wurden
  ist schlechter als bei nem neuen chat komplett von 0 zu beginnen?“ – nein).
  Darum keine Meldung nach Prozent mehr – bis 27.11. hieß es „ab etwa 80 %“
  (26.11.: „in allen Chats bescheid geben wenn ein neuer Chat nötig ist“),
  das kam kurz vor der Zusammenfassung und war überflüssig. Einen neuen Chat
  nur vorschlagen, wenn du merkst, dass du mit veraltetem oder
  widersprüchlichem Stand arbeitest, oder bei einem anderen Projekt – dann
  vorher alles Offene in die Dateien schreiben und einen kurzen Starttext
  zum Einfügen mitgeben. Die Schwelle der Zusammenfassung bleibt (Tobi
  fragte nach 95 %): Sie braucht selbst Platz, und eine einzige große
  Ausgabe (Testlauf, Bilder) kann Zehntausende Tokens haben.
- **Mehr** – vorschlagen und auf meine Antwort warten: `/model fable`, dazu
  `/effort high`, wenn die Ursache nach dem ersten Durchgang unklar ist, ein
  Fehler nach einer Korrektur wiederkommt oder viel ineinandergreift (Service
  Worker, Pausen-Uhr, Kalender-Sync, Sicherung, Planberechnung). Fable kostet kein Nutzungsguthaben (Tobi, 26.11.2026; Guthaben kostet nur
  die Claude-API). Ist der Aufwand gerade gesenkt, zuerst zurück auf
  `/effort max`.
- **Weniger** – nicht warten, erledigen und am Ende in einem Satz sagen, dass
  für Aufgaben dieser Art `/effort high` (oder `medium`) reicht: Texte und
  Zahlen in `tools/exercise-meta.json`, Formulierungen im README. Für eine
  einzelne schwere Frage genügt dann „ultrathink“ in meiner Nachricht.
- Lieber den Aufwand senken als zu Sonnet wechseln, und nicht hin und her: Nach
  einem Modellwechsel wird der ganze Verlauf ohne Zwischenspeicher neu gelesen.
- `/fast` (dasselbe Modell schneller, kostet Guthaben extra) nur, wenn ich auf
  etwas warte, das eilt.

## Offline zuerst
Tobi, 22.11.2026: „Generell sollen all meine Apps auch so weit wie möglich
offline funktionieren.“ Das gilt für jede Änderung und jede neue Funktion:
- Was ohne Netz gehen kann, geht ohne Netz: App-Hülle und zuletzt geladene
  Daten liegen im Vorrat von `sw.js`, ebenso Bilder und Kartenkacheln, die
  man schon gesehen hat.
- Änderungen ohne Netz werden lokal gemerkt und von selbst nachgeschickt –
  beim Ereignis `online`, beim nächsten Abgleich und beim nächsten Start.
  Nichts geht verloren, nichts kommt doppelt an, und was sich inzwischen
  anderswo geändert hat, wird zusammengeführt statt überschrieben.
- Was nur mit Netz geht, wird ohne Netz vorgemerkt und läuft von selbst,
  sobald Netz da ist – Tobi, 22.11.2026: „sowas wie mails senden könnte er sich
  doch vormerken und dann machen sobald er internet hat“. Also Mails senden,
  KI-Aufträge und Ähnliches: sichtbar „wartet auf Netz“ (mit „Nicht senden“),
  vor dem Ausführen gegen den neuesten Stand geprüft, nie doppelt. Braucht es
  eine Anmeldung, die nur nach einem Tipp aufgeht (Google), reicht dann ein Tipp.
  Nur was sich nicht vormerken lässt (neue Angebote, eine Suche, Push), sagt
  ohne Netz in einem Satz, dass es Netz braucht; der Rest bleibt benutzbar.
- Neue Funktionen bekommen einen Test ohne Netz (Server aus oder Anfragen
  abbrechen – Playwrights `setOffline()` schneidet die Anfragen des Service
  Workers nicht ab).

## Das Repository
- **Workout-App** (Wurzel): PWA für Tobi, live unter
  https://finanzdienste.github.io/Workout/. Kein Bauschritt außer zwei
  Generatoren (unten), keine Abhängigkeiten zur Laufzeit.
- **`schilddruese/`**: eigene App mit eigenem Service Worker, eigener `VERSION`
  und eigenen Tests (`tests/test-sd-*.mjs`). Ihre Regeln stehen in
  `schilddruese/README.md`.
- **`mahlzeit/`** (seit v264): Kalorien, Hafertage, Gewicht und Blutzucker für
  einen Arbeitskollegen von Tobi – ohne Fragen beim Start. Eigener Service
  Worker (`VERSION` dort und `FASSUNG` in `js/app.js` zusammen hochzählen),
  eigene Tests (`tests/test-mz-*.mjs`), Regeln in `mahlzeit/README.md`. Werte
  werden bewusst nicht bewertet (geht an einen Dritten).
- **`apps/`**: nur noch eine Weiterleitung; *Meine Apps* (Tobis Übersicht,
  wer welche seiner Apps wann benutzt) liegt seit a6 in `Finanzdienste/Apps`
  (https://finanzdienste.github.io/Apps/) – mit Test, SQL
  (`tools/apps-uebersicht.sql`) und eigenem README/CLAUDE.md. Unter
  `/Workout/` ließ Android sie nicht als eigene App installieren.
  `apps/sw.js` meldet nur noch den alten Worker ab
  (`tests/test-apps-umzug.mjs`).
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
- **Nachsehen, was das Skript getan hat**: Über den Google-Kalender-Connector
  (`list_calendars`, dann `list_events` auf „Workout“) – die Beschreibung des
  Kalenders nennt den letzten Abgleich, den Tag der Liste und die letzte
  Sendung der App, die Termine zeigen, ob verschoben wurde. Den Stand von To Do
  sieht man dort nicht, nur in der App (v257) oder im Protokoll in Apps Script.

## Stand (25.11.2026)
- Workout v274: *Meine Apps* unter `apps/` – je App Ampel, 14 Tage und wer
  (Tobi über das Widget, Uwe, Freizeit-Leute, Konten von Frag mal); Body
  Check misst mit Absicht nichts, Boxenstopp ist blind für Amy und Marielle.
  Supabase: `apps_uebersicht`, `apps_tag` mit Triggern auf `nutzung`,
  `sd_geraete`, `freizeit_person`, `freizeit_bock` (eingespielt am 25.11.).
  Gefunden: Die Worker von Frag mal (Amy) und Body Check (Bauchbuch) löschen
  beim Aktivieren alle fremden Vorräte im Ursprung – offen (README „Meine
  Apps“). Meine Apps a2: Tobi hatte das Passwort der Übersichten vergessen –
  am 25.11. neu gesetzt, in `admin_liste()` steht nur noch die Prüfsumme
  (README „Passwort vergessen“). Das Passwort nie ins Repo oder in Notizen.
  Meine Apps a3: bei Body Check das Tagebuch, das Amy nach „Ja, teilen“ teilt
  (`bodycheck_lesen(pass)`, gebaut im Repo Bauchbuch, Fassung 31/32) –
  zugeklappt, nach Tagen (`apps/js/tagebuch.js`); Namen der Kennungen aus
  `node tools/bodycheck-woerter.mjs <Bauchbuch>`. Am 25.11. noch 0 Zeilen.
  Meine Apps a4 (26.11.): „Werte von Uwe“ in der Karte Mahlzeit – Gewicht,
  Blutzucker, HbA1c, Schlaf, Schritte nach Tagen, nicht bewertet
  (`mahlzeit_lesen(pass)`, `apps/js/werte.js`). Meine Apps a5 / Mahlzeit
  v14 (26.11.): auch Uwes Essen – Mahlzeit fragt ihn einmal „Darf Tobi auch
  sehen, was du isst?“ (`stand.essenTeilen`), erst nach „Ja“ →
  `mahlzeit_essen_melden` → `mahlzeit_essen` (`mahlzeit/supabase/essen.sql`);
  „nein“ löscht bei Tobi. Test `tests/test-mz-essen.mjs`.
  Meine Apps a6 (26.11.): umgezogen ins Repo `Finanzdienste/Apps`
  (https://finanzdienste.github.io/Apps/), damit Tobi sie als eigene App
  installieren kann – Tobi: „als App auf mein Handy downloaden aber nicht
  aufm startbildschirm haben“. Weitere Arbeit an der Übersicht dort.
  Meine Apps a7 (26.11.): Boxenstopp ist nicht mehr blind für Amy und
  Marielle – Boxenstopp v100 schickt von Tobis Handy aus dem Dashboard die
  Zahl der Änderungen je Person und Tag (`boxenstopp_aktiv`, README im Repo
  Apps „Boxenstopp: Amy und Marielle“).
- Davor v273: *Was da ist* sagt zuerst, ob jedes Training alle
  Muskelgruppen seiner Hantel-Fassung trifft (`vorratDeckung()`), statt
  „Eins zu eins getauscht“ – Tobi: „Hauptsache jedes Training hat die
  gleichen muskelgruppen wie das Hantel equivalent“. Wache in
  `tests/test-vorrat.mjs`: alle vier Pläne, mit/ohne Bänder und Stange,
  keine Lücke (README „Jedes Training alle Muskelgruppen“).
- Davor v272: Die Knöpfe *Bodyweight*/*Hanteln* in *Mehr → Was da ist*
  stellen das Training um wie *Womit trainierst du* (vorher nur die
  Geräteliste) – Tobi: „Hab auf bodyweight umgestellt aber trotzdem steht das
  heutige Workout auf Hanteln?“. Mit Hanteln stehen Bänder und Stange mit in
  der Liste (README „„Was da ist“ stellt mit um“).
- Davor v271: Die laufende Nummer steht nirgends mehr – Tobi: „Die Workout
  Nummer ist mir in to Do und Kalender und in meiner App übrigens komplett
  egal“. Kopf nur „Heute“, eine Einheit heißt nach ihrem Tag
  (`einheitTag()`: „das Workout von heute“, „vom Samstag“), Kalender/To Do/ICS
  „Workout · 5 Übungen · 15 Sätze“; intern bleibt die Nummer, in der Ansicht
  `data-n` für die Tests (README „Der Tag statt der Nummer“). Kein neuer Code
  für Apps Script.
- Zwei Sitzungen arbeiteten am 19.11. zugleich an Workout (diese und
  „Schmerzen beim Stehen mit Adidas Multi X“, v266–v270): vor dem Push
  `git fetch` und die nächste freie Versionsnummer nehmen.
- Davor v270: Haltung und Plattfuß ohne Zusatzübung – stattdessen eine Zeile
  in den betroffenen Übungen (`formCue`, `formZeile()`); kein Block „Zum
  Schluss“ mehr für die beiden. Tobi: „wir wollens voll integrieren“.
- Davor v269: Die Zusatzübung „Kurzer Fuß“ heißt „Fußgewölbe anheben“ – Tobi
  las den Fachnamen als Diagnose (Schlüssel `kurzerFuss` bleibt).
- Davor v268: Was ein Termin (Padel) herausnimmt, steht nicht mehr unter den
  Beschwerden (Trainingskarte, *Verletzt*, Kostentabelle) – fiel auf, weil
  Haltung und Plattfuß dauerhaft angehakt sind. Auswahl gegen die Studienlage
  geprüft und gelassen (README „Nachgeprüft“).
- Davor v267: Haltung und Plattfuß nur noch mit dem, was der Plan nicht
  abdeckt – Kinn zurückziehen und Kurzer Fuß, je 2 × 10 (`careDose`), rund 4
  Minuten je Training; die Tabelle „Was das pro Woche kostet“ zählt nur noch,
  was die Beschwerden ändern (`weeklyImpact()` aus `injuryNotes()`).
- Davor v266: unter *Verletzt* „Haltung beim Stehen“ und „Plattfuß /
  Fersen beim Stehen“ – sperren nichts, die Pläne bleiben bitgleich, nur die
  Zusatzübungen hängen hinter jedem Training (neu: „Kurzer Fuß“; README
  „Haltung und Plattfuß“). Tobi wollte ausdrücklich keinen eigenen Modus.
- Davor v265: `js/bildschirmzeit.js` in der neuen Fassung der Quelle – sie
  kennt die Bewerbungszentrale als vierte Web-App (Widget-App Release v15);
  für Workout ändert sich nichts.
- Davor v264: `sw.js` lässt `/mahlzeit` in Ruhe; daneben die neue App
  Mahlzeit v1 unter https://finanzdienste.github.io/Workout/mahlzeit/ (README
  „Mahlzeit im Unterordner“). Mahlzeit v2: Anleitung zum Startbildschirm je
  Handy (iPhone nach Safari-Fassung, mit Symbolen) und die Hafer-Frage
  (verteilt oder am Stück) stellt die App dem Kollegen selbst. Mahlzeit v3:
  Strichcode (Open Food Facts) und KI für Rezepte/Fotos über die
  Supabase-Funktion `mahlzeit-ki` (Code in `mahlzeit/supabase/functions/`,
  ausgeliefert per Supabase-MCP; Freischalt-Codes in `mahlzeit_zugang`, der
  Kollege heißt Uwe). Am 17.11. war das Anthropic-Guthaben leer – auch für
  „Frag mal“. Mahlzeit v4: Reiter „Sport“ (Beweglichkeit täglich,
  Kraft 2–3× mit Uwes Hanteln, Schwungstäben, Schwingstab, Wackelkissen,
  Heimtrainer; `js/sport.js`). Mahlzeit v5: Strichfiguren je Übung
  (`js/figuren.js`). Mahlzeit v6: Lebenszeichen (nur Zahlen) in
  `mahlzeit_nutzung` – fragt Tobi, ob Uwe die App nutzt: die Abfrage steht in
  `mahlzeit/README.md` „Lebenszeichen an Tobi“. Mahlzeit v7: Eiweiß mitgezählt,
  Bereich „Rezepte & Meal Prep“ (Uwes Overnight Oats und Gerichte), Studio-Tag
  mit Maschinen. Uwe: 60, 125 kg, 176 cm, Bürojob, Studio 1×/Woche. Mahlzeit v8:
  KI ausgeblendet (`KI_AN = false` in `mahlzeit/js/ki.js`), solange Tobi
  kein Anthropic-Guthaben hat – Uwe testet die App seit dem 19.11. Mahlzeit v9:
  Schlaf und Schritte unter *Werte* zum Abtippen von der Uhr – Uwe hat ein
  iPhone, an Apple Health kommt nur eine echte App (Mac + Entwicklerkonto
  fehlen). Mahlzeit v10: Uwe ist einverstanden, dass Tobi seine Werte sieht –
  Kurzbefehl „Mahlzeit Uhr“ (richtet Tobi auf Uwes iPhone ein, Anleitung in
  der App) → Supabase-Funktion `mahlzeit-uhr` → `mahlzeit_uhr`; Abfrage in
  `mahlzeit/README.md` „Die Uhr schickt Schlaf und Schritte selbst“. Mahlzeit v11: `mahlzeit-ki` fragt Gemini (kostenlos) vor
  Claude, „Im Internet nachsehen“ über Tavily; die App blendet die KI ein,
  sobald die Funktion per GET „ki: true“ meldet. Seit dem 21.11. sind
  `GEMINI_API_KEY` und `TAVILY_API_KEY` in Supabase eingetragen, und beides
  ist live geprüft. Gemini ist oft überlastet, deshalb geht es reihum durch
  die Modelle, mit `thinking_level: "low"`. Mahlzeit v12: Ohne Code steht „Bitte Tobi, dir den
  Freischalt-Code zu schicken“, mit Knöpfen zum Bitten und Einfügen (Uwe soll
  so wenig wie möglich tun). `mahlzeit_ki` hat jetzt `grund`, `versuche` und
  `ms`; die Abfrage steht in `mahlzeit/README.md` (v12). Mahlzeit v13: Uwes Werte
  (Gewicht, Blutzucker, HbA1c, Schlaf, Schritte, 60 Tage) gehen an Tobi, in
  `mahlzeit_werte` über die Datenbankfunktion `mahlzeit_werte_melden`. Uwes
  Gerät ist `0jhz8uo152qh`; die Abfrage steht in `mahlzeit/README.md` (v13). Mahlzeit v15:
  Testbrowser melden nichts mehr (`echtesGeraet()`, nur GitHub Pages ohne
  `navigator.webdriver`). Die Geräte o0ty, n4zs, rlo3 und l5yl in
  `mahlzeit_nutzung` waren Testläufe; 37q1 und 9ifv sind vermutlich Tobi.
- Davor v263: Bildschirmzeit für Tobis Widget (README „Bildschirmzeit für
  das Widget“). `js/bildschirmzeit.js` ist eine byte-gleiche Kopie aus
  Finanzdienste/Bildschirmzeit (`web/bildschirmzeit.js`) – nur dort ändern,
  dann in Workout, Boxenstopp, Freizeit und Bewerbungszentrale kopieren. Ohne
  Verbinden-Link (`#bildschirmzeit=…` aus der Widget-App) passiert nichts. Die
  Widget-App (Android) liegt in Finanzdienste/Bildschirmzeit.
- CI „Prüfung“, Job Browsertests: Playwright 1.56.1 kennt das Ubuntu 26.04
  der Runner nicht („does not support chromium on ubuntu26.04-x64“) – schon
  seit vor v263 rot, der Job „Pläne und erzeugte Dateien“ ist grün. Freizeit
  hat dafür auf Playwright 1.64.1 gewechselt.
- Davor v262. Im Supersatz aus zwei Teilen derselben Partie sagt
  der Wechselhinweis, welche es sind („Schulter vorn und Schulter seitlich:
  verschiedene Muskeln …“, v262). Knieheben im Liegen nennt den Weg nach oben (zu
  leicht → Oberkörper leicht mit anheben, v261; Tempo, dann das + zur
  hängenden Fassung, v260); Chin-ups und
  Pull-ups sagen, wie man das Schwingen abstellt (v259); das Volumen für
  Anfänger im Cut bleibt, wie es ist (README
  „Anfänger heißt leichter, nicht weniger“, 14.11.). Davor: Das Skript sagt,
  warum To Do nicht durchkommt – der Grund im Protokoll, nach drei Stunden
  „später“ ein Fehler mit Mail und in der App (v258, neuer Code für Apps
  Script, `FASSUNG` bleibt 2); v257 zeigt den To-Do-Stand auf der
  Kalender-Karte und, wo nötig, auf der Startseite.
- To Do kam vom 13.11. 00:03 bis zum 14.11. nicht durch (Grund unbekannt). Am
  14.11. um 21:31 hat Tobi den Code von v258 eingespielt; `einrichten`:
  „✓ Microsoft To Do verbunden … nichts zu tun“. Kommt es wieder, nennt v258
  den Grund (Protokoll, nach drei Stunden Mail und Startseite).
  Apps-Script-Projekt: „Unbenanntes Projekt“, erkennbar am Trigger
  `stuendlich` – im Editor vor *Ausführen* die Funktion wählen und speichern.
- Offen bei Tobi: ob ihm die halbe Seitenpause reicht (sonst die volle nach
  jeder Seite); „Neue Version“ für den Code von v258 bereitstellen. Die
  Kalender-Erinnerung steht auf „keine“.

## Cloud-Sitzungen (Claude Code im Browser oder in der Claude-App)
- Chromium für playwright 1.56.1 lädt `npx playwright install chromium` von
  `cdn.playwright.dev` und `playwright.download.prss.microsoft.com`. Beide
  stehen nicht in der Standardliste „Trusted“ – in der Umgebung unter
  Netzwerkzugriff „Custom“ eintragen (mit der Standardliste) oder „Full“.
  Vorinstalliert ist nur Chromium 1243 (für ein neueres Playwright), der
  Download (rund 280 MB) ist also in jeder neuen Sitzung nötig. Die Umgebung
  „Default“ hat volles Netz; dort ging er am 11.11. durch.
- Die Pages-API ist über den GitHub-Proxy gesperrt: den Deploy über
  `gh run list … pages-build-deployment` prüfen. GraphQL über `gh` geht
  nicht, REST (`gh api repos/...`) schon. Gibt die Sitzung `gh` nur für die
  Suche frei: GitHub-MCP `actions_list`, `list_workflow_runs` mit Workflow
  339307472 (`pages-build-deployment`).
