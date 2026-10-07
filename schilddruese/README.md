# Schilddrüse

Alltagsbegleiter bei Schilddrüsenunterfunktion – für eine Nutzerin, die morgens
eine Tablette nimmt und beim Arzttermin wissen will, was seit dem letzten Mal
war.

Die App liegt neben der Workout-App im selben Repository und folgt denselben
Grundsätzen: **kein Bauschritt, keine Abhängigkeiten, kein Server, kein
Konto.** `schilddruese/index.html` im Browser öffnen genügt; über GitHub Pages
liegt sie unter `https://finanzdienste.github.io/Workout/schilddruese/` und
lässt sich von dort aus „zum Startbildschirm hinzufügen". Alle Daten bleiben im
Browser des Handys.

## Was sie kann

| Bereich | Inhalt |
| --- | --- |
| **Heute** | Ganz oben die Notfallleiste (112, Bereitschaftsdienst 116 117, Giftnotruf des Bundeslands, Telefonseelsorge). Datum in Worten, die heute gültige Dosis, der große Knopf „Tablette genommen?". Darunter nur, was zutrifft, nach Dringlichkeit geordnet: seelische Not immer zuerst, Puls und Herzklopfen aus dem Befinden, die Stufe der Einschätzung mit Verweis, ein Verweis auf die Dosis-Karte, Kontrollen und Nachfragen nach einer Dosisänderung, eine schon eingetragene künftige Dosis, die Stärke fehlt noch, gestern nichts eingetragen, gestern nicht genommen („heute wie gewohnt – nicht doppelt"), ein Termin in den nächsten zwei Wochen, Vorrat geht zur Neige, lange keine Sicherung. Ganz unten „Wie geht es Ihnen heute?" mit drei Knöpfen. |
| **Verlauf** | Laborwerte (TSH, fT4, fT3 und freiwillig weitere) je Befund mit der Tagesdosis, die damals galt; je Wert die Lage in Worten und woher der Bereich stammt, darunter die Einschätzung (siehe unten). Verlaufslinie ab zwei Werten, umgerechnet auf eine Einheit. Dosis mit Verlauf („aktuell", „geplant", „auf Anweisung der Praxis"). Einnahmen der letzten vier Wochen als Kalender mit ✓ ✗ ? zum Antippen und Nachtragen. Gewicht. Befinden mit Beschwerden. |
| **Mehr** | Einschätzung (Gesamtbild), Dosis-Karte, Warnzeichen prüfen, „Was braucht Abstand?", „Über mich & weitere Mittel". Bericht für den Arzttermin (teilen, kopieren, drucken), eigene Fragen für den Termin, Termine (mit Kalenderdatei), Wissen in zehn Kapiteln, Erinnerung, Tablettenvorrat, Schrift und Farben, Sicherung, „Über diese App" mit „Alles löschen". |

Beim allerersten Öffnen drei Schritte: für wen die Einschätzung gilt (mit dem
Haken „Ich werde wegen einer Schilddrüsen-Unterfunktion mit Tabletten
behandelt"), Anrede und Geburtsjahr; Tablette (Präparat, Stärke in µg,
Tabletten am Tag, seit wann); Einnahmezeit. Die Stärke darf leer bleiben,
wenn die Packung nicht zur Hand ist – geschätzt wäre schlimmer; „Heute"
erinnert dann daran. Wer ein neues Handy hat, kann schon dort eine Sicherung
einlesen.

## Einschätzung und Dosis-Karte

Auf ausdrücklichen Wunsch ordnet die App ein, so weit das verantwortbar ist –
und sagt auf der Dosis-Karte, ob ein Wert eher für mehr, weniger oder gleich
viel Tablette spricht. Gerechnet wird in `js/einheiten.js`,
`js/einschaetzung.js` und `js/dosis.js` (rein, ohne Anzeige, jede Regel mit
ihrer Kennung aus den Regelwerken); die Ansichten zeigen nur, was dort
herauskommt.

**Was die App einordnet**

- **Jeden Laborwert** gegen den Bereich vom Befund (auch einseitig, „< 116"),
  sonst gegen eine übliche Orientierung – mit der Quelle in Worten („Bereich
  Ihres Labors", „übliche Orientierung, nicht Ihr Labor", „Ihr Zielbereich").
  Einheiten werden vorher vereinheitlicht (mU/l = µU/ml = mIE/l; fT4 ng/dl →
  pmol/l); angezeigt wird der Originalwert, bei Umrechnung mit dem
  umgerechneten dazu. Ein ungewöhnlicher Wert (Komma, Einheit, ein
  achtfacher Sprung bei gleicher Dosis) braucht beim Eintragen ein
  ausdrückliches „Ja, stimmt".
- **Das Muster aus TSH und fT4** mit einer Dringlichkeit in festen Stufen
  („Sofort 112", „Heute anrufen", „In den nächsten Tagen anrufen", „In ein bis
  zwei Wochen", „Beim nächsten Termin", „Kein besonderer Anlass"), dazu der
  Satz gegen Selbsthandlung, mögliche Erklärungen aus den eigenen Einträgen
  (Fragen zur Blutabnahme, Mittel, Einnahmen), der Verlauf zum vorigen Befund
  und – wo nötig – ein Notfallsatz.
- **Beschwerden** der letzten vier Wochen (wozu sie passen, im Alter anders
  gewichtet), mit eigenen Pfaden für unregelmäßigen Puls und seelische Not.
- **Warnzeichen** im Check (gespeichert, mit Anruf-Knöpfen), weitere Werte
  (Hämoglobin, Ferritin, B12, Vitamin D, Natrium, HbA1c, LDL, CRP),
  Abstände zu anderen Mitteln mit Uhrzeit, Kontrollen nach Änderungen.

Die Einschätzung gilt nur für Erwachsene mit bekannter, behandelter
Unterfunktion – eingeschaltet über den Haken im Willkommen oder im Profil
(oder einen Behandlungsgrund). Ohne ihn zeigt die App die Lage der Werte,
aber kein Muster und keine Dringlichkeit. Notfallleiste, Warnzeichen-Check
und die Hinweise bei seelischer Not und unregelmäßigem Puls gelten immer.

**Die Reihenfolge der Dosis-Karte** ist verbindlich und wird nie abgekürzt:

1. Warnzeichen – bei Herzklopfen, Unruhe, unregelmäßigem Puls oder sehr
   hohem TSH zuerst der Warnzeichen-Check (von heute), bei seelischer Not das
   Gesprächsangebot statt einer Aussage zur Dosis;
2. Schwangerschaft (nur unter 55);
3. Sperrgründe, die schon feststehen – Befund zu alt, Dosis seither
   geändert, die Praxis hat entschieden, kein Laborbereich, Krebs, T3,
   Kortison, Hirnanhangdrüse, Biotin, Krankheit, neue Mittel, vergessene
   Tabletten und weitere;
4. offene Fragen, **eine je Anzeige**, per Knopf beantwortet (an den Befund,
   ins Profil oder als Nachfrage mit Datum);
5. erst dann die Richtung nach Muster – „spricht für …" mit der üblichen
   Schrittgröße („Ärztinnen erhöhen dann meist um …"), nie eine neue
   Tagesdosis.

Unter jeder Richtung steht der Pflichttext (immer sichtbar, nie
aufklappbar, nie kleiner als der Titel), bei Herzrisiko die 112-Zeichen,
darunter die Grundlage und der Knopf „Die Praxis hat entschieden". Keine
Richtung heißt nicht „alles gut": Die Karte nennt jeden Grund. „Heute"
verweist nur auf die Karte und nennt die Richtung nie ohne den Pflichttext.

**Grenzen.** Die App kennt nur, was eingetragen ist – keine übrigen
Befunde, kein EKG, keine Knochendichte. Sie rechnet nie eine neue Dosis
aus. Vor jeder Änderung: die Praxis anrufen; hat die Praxis anders
entschieden oder einen Zielbereich genannt, gilt die Praxis. Nach jeder
Änderung gibt es bis zum Kontrollwert (6–8 Wochen) keine neue Richtung.

**Woher die Regeln stammen.** Aus zwei Regelwerken – eines für Laborwerte,
Beschwerden, Warnzeichen, Wechselwirkungen und den Bericht, eines für die
Dosisrichtung und die Ernährung. Jedes haben drei unabhängige Prüfer mit
verschiedenem Blick (Endokrinologie, Labormedizin, Pharmazie und
Patientensicherheit) gegengelesen; danach hat je ein „rotes Team" sie an
Fallbeispielen angegriffen, und seine Korrekturen sind eingearbeitet.
Unabhängig davon geschriebene Tests prüfen die Regeln gegen den Regeltext
(`tests/test-sd-regeln-kern.mjs`, `tests/test-sd-regeln-dosis.mjs`).
**Offen gesagt: Alle Prüfer waren KI-Agenten, keine Ärztinnen.** Vor dem
Gebrauch soll die behandelnde Ärztin (oder eine Apothekerin) die Regeln und
Texte einmal durchsehen und den persönlichen TSH-Zielbereich nennen.

**Keine Weitergabe an Dritte.** Die App ist für eine Nutzerin gebaut und
bleibt privat. Mit Befundeinordnung, Dringlichkeitsstufen und Dosisrichtung
wäre sie, an andere weitergegeben, ein Medizinprodukt im Sinne der MDR – mit
allem, was das an Prüfung und Zulassung verlangt.

## Was sie ausdrücklich nicht tut

- **Keine neue Dosis.** Die Dosis-Karte nennt eine Richtung und die übliche
  Schrittgröße, nie eine Tagesdosis und keine Rechnung. Alle übrigen Texte
  bleiben ohne µg-Zahl und ohne Aufforderung, etwas zu ändern; kein
  Wissenstext weist an, eine Tablette mehr oder weniger zu nehmen
  (`tests/test-sd-wissen.mjs` sucht nach solchen Sätzen).
- **Keine Ampel ohne Worte.** Jede Lage und jede Stufe steht in Worten da;
  die Farbe kommt nur dazu. Kein „zu hoch", kein „zu niedrig".
- **Keine Erinnerung bei geschlossener App.** Dafür bräuchte es einen Server,
  der zur Minute Push-Nachrichten schickt. Ein Service Worker wacht nicht von
  selbst um sieben Uhr auf, Periodic Background Sync ist unzuverlässig und auf
  dem iPhone nicht vorhanden. Die App sagt das beim Einrichten und unter
  „Erinnerung" – und bietet stattdessen eine **Kalenderdatei** mit einem
  täglichen Termin samt Alarm an. Die klingelt zuverlässig, weil der Kalender
  des Handys klingelt. Ist die App gerade auf dem Bildschirm offen, meldet sie
  sich nach der Einnahmezeit einmal zusätzlich (Systemhinweis, nach
  Erlaubnis). Im Hintergrund halten iOS und Android die Seite meist an – dann
  kommt nichts, und so steht es auch in der App.

## Woher das Wissen stammt

Die Texte unter „Wissen" beruhen auf einem Faktenblatt mit 40 einzelnen
Aussagen (Einnahme, Wechselwirkungen, Laborwerte, Kontrollen, Anzeichen,
Sonderfälle, Sicherheit). Jede Aussage wurde vor dem Bau von drei unabhängigen
Prüfern mit verschiedenem Blick gegengelesen – Pharmazie, Labor und
Endokrinologie, Patientensicherheit –, jeweils mit dem Auftrag, sie zu
widerlegen. Alle 40 haben bestanden; rund dreißig Präzisierungen der Prüfer
sind eingearbeitet, zum Beispiel:

- „30 Minuten vor dem Frühstück" → „mindestens 30, besser 60 Minuten", mit
  Leitungswasser statt kalziumreichem Mineralwasser;
- vergessene Tablette: am selben Tag nachholen, *wenn ein nüchterner Zeitpunkt
  möglich ist*, sonst auslassen – nie doppelt;
- Biotin: lässt die Werte fälschlich nach zu viel Hormon aussehen;
- bei älteren Menschen fehlen die typischen Anzeichen oft;
- Herzkrankheit: die µg-Angabe zum Einschleichen gestrichen – wie schnell,
  entscheidet die Ärztin.

Hauptquellen: Fachinformation L-Thyroxin, Leitlinie der American Thyroid
Association 2014 (Jonklaas et al.), ATA-Leitlinie Schwangerschaft 2017,
Lehrbücher der Inneren Medizin und Labormedizin.

Das Kapitel „Ernährung und Alltag" übernimmt die Texte E1–E16 aus dem
zweiten Regelwerk (siehe „Einschätzung und Dosis-Karte").

**Offen und ehrlich:** Die Prüfer waren KI-Agenten, keine Ärztinnen. Die
Texte sollte vor dem Gebrauch eine Ärztin oder eine Apothekerin einmal
gegenlesen.

## Daten

Ein Schlüssel im localStorage: `schilddruese.stand.v1`, seit der Einschätzung
mit `version: 2` (Profil mit Geburtsjahr, Behandlung, Zielbereich, Herz,
Knochen, Kortison, Bundesland; Mittel mit Abstand und Wechseln; je Befund die
Fragen zur Blutabnahme und die Entscheidung der Praxis; Warnzeichen-Checks;
Nachfragen der Dosis-Karte). Maßgeblich ist `normStand()` in
`js/speicher.js`; ein Stand der Fassung 1 wird beim Lesen ergänzt. Das
Beispiel zeigt die Grundfelder:

```json
{
  "version": 1,
  "profil": { "name": "Mama", "begruesst": true },
  "einstellungen": { "erinnerung": "07:00", "schrift": "gross", "farbe": "hell", "hinweisTablette": true },
  "dosen": [{ "id": "…", "ab": "2026-03-01", "praeparat": "L-Thyroxin Henning", "mikrogramm": 75, "tabletten": 1, "notiz": "" }],
  "einnahmen": { "2026-09-25": { "uhr": "06:41" }, "2026-09-24": null },
  "labor": [{ "id": "…", "datum": "2026-09-10",
              "tsh": { "wert": 3.2, "einheit": "mU/l", "von": 0.4, "bis": 4.0 },
              "ft4": { "wert": 14.1, "einheit": "pmol/l", "von": 10, "bis": 22 }, "ft3": null, "notiz": "" }],
  "befinden": [{ "id": "…", "datum": "2026-09-20", "stufe": "mittel", "beschwerden": ["muede"], "notiz": "" }],
  "gewicht": [{ "id": "…", "datum": "2026-09-21", "kg": 72.4 }],
  "termine": [{ "id": "…", "datum": "2026-10-02", "uhr": "08:00", "art": "labor", "wo": "", "blutabnahme": true, "notiz": "" }],
  "fragen": [{ "id": "…", "text": "Warum bin ich abends so müde?", "erledigt": false }],
  "vorrat": { "tabletten": 58, "stand": "2026-09-25" },
  "letzteSicherung": "2026-09-01"
}
```

**Einnahmen haben drei Zustände**, und der Unterschied zählt im Bericht: ein
Objekt heißt genommen, `null` heißt bewusst nicht genommen, ein fehlender Tag
heißt unbekannt. „Zurücknehmen" eines Hakens macht aus dem Tag „unbekannt",
nicht „nicht genommen".

**Gezählt wird ab dem Einrichten** (`profil.seit`), nicht ab der ersten Dosis:
Wer beim Einrichten „seit März" angibt, hätte sonst am ersten Tag „an 0 von 28
Tagen genommen" im Bericht. Der laufende Tag zählt erst, wenn für ihn etwas
eingetragen ist – morgens vor der Tablette ist er keine Lücke.

**Die Dosis gilt ab ihrem Datum.** Eine im Voraus eingetragene Dosis („ab
Montag 100 µg") erscheint bis dahin nur als Ankündigung; „Heute", Bericht und
Vorrat rechnen mit der heute gültigen. Im Bericht und neben den Laborwerten
steht die **Tagesdosis** (Stärke × Tabletten), nicht die Stärke allein.

Drei Regeln aus der Workout-App, hier von Anfang an:

- **Nichts geht still verloren.** Kann der Browser nicht speichern (privates
  Fenster, Speicher voll), steht über jeder Ansicht eine Warnung.
- **Ein neuerer Stand wird nie überschrieben.** Liegt im Speicher ein Stand mit
  höherer `version`, schreibt die App nichts und sagt warum; eine Sicherung aus
  einer neueren Fassung wird abgelehnt.
- **Gelesenes wird entschärft.** `normStand()` bringt jeden Stand – aus dem
  Speicher wie aus einer Sicherungsdatei – in die erwartete Form; unbekannte
  Felder fallen weg, kaputte Werte werden zu ihrem Standard, Einträge ohne
  Datum oder ohne einen lesbaren Wert fallen heraus, Kennungen mit fremden
  Zeichen werden ersetzt. Die Sicherung der Workout-App wird als fremd erkannt
  und nicht als leerer Stand eingelesen.
- **Zwei offene Fenster** (ein Browser-Tab neben der installierten App) lesen
  den Stand neu, sobald das andere schreibt oder sie wieder nach vorn kommen –
  sonst überschriebe das ältere die Einträge des neueren.
- **„Stand vor dem Einlesen zurückholen"** fragt nach und steht nur am Tag des
  Einlesens und zwei Tage danach da; auf einem neuen Handy gar nicht.

## Gestaltung

Für eine ältere Nutzerin: Grundschrift 20 px (wählbar 18 / 20 / 23 px), alle
Maße in rem, damit Knöpfe und Abstände mitwachsen; jeder Knopf mindestens 44 px
hoch, der Tabletten-Knopf über 100 px; hell als Standard, dunkel wählbar;
Kontrast mindestens 4,5 : 1 in beiden. Text statt Symbol, keine Wischgesten,
keine versteckten Menüs. „Zurück" oben links sagt, wohin es geht, und führt
dorthin, woher man kam – aus einem Befund in die Liste, nicht bis zum Reiter.
Nach jedem Tipp bleibt der Fokus auf dem getippten Knopf bzw. auf der neuen
Seite, damit Vorleseprogramme die Stelle nicht verlieren.
Geprüft in `tests/test-sd-darstellung.mjs` auf 360 × 740 über alle Seiten und
alle drei Schriftgrößen.

## Dateien

| Datei | Zweck |
| --- | --- |
| `index.html` | Seite mit Kopf, Ansicht und Reiterleiste; eine feste Notfallleiste, die beim Start ersetzt wird, und ein kleines klassisches Skript für Service Worker und Neuladen nach einem Update – beides läuft auch, wenn die Module nicht starten |
| `sw.js` | Offline-Vorrat. **VERSION hochzählen**, wenn sich eine Datei aus `SHELL` ändert |
| `manifest.webmanifest`, `icon*` | Installierbar; PNGs aus `icon.svg` über `node tools/schilddruese-icons.mjs` |
| `css/styles.css` | Gestaltung, Farbwelten, Schriftgrößen |
| `js/app.js` | Reiter, Seiten, Aktionen (`data-act`), Sicherung, Hinweise |
| `js/speicher.js` | Zustand, Normalisierung, Speichern, Sicherung, Abfragen (Dosis am Tag, Einnahmebilanz, Vorrat, Mittel setzen) |
| `js/einheiten.js` | Einheiten vereinheitlichen, Plausibilität beim Eintragen |
| `js/einschaetzung.js` | Einordnung, Muster, Stufen, Erklärungen, Beschwerden, Warnzeichen, Abstände, Kontrollen, Gesamtbild, Berichtszeilen |
| `js/dosis.js` | Die Dosis-Karte (Richtung, Sperrgründe, Pflichtfragen) und ihre Hinweise |
| `js/ansicht-*.js` | Heute, Verlauf, Mehr, Formulare, Willkommen, Einschätzung (Befund-Block, Gesamtbild, Warnzeichen, Abstand), Dosis-Karte – liefern HTML als Text |
| `js/bericht.js` | Der Text für den Arzttermin |
| `js/wissen.js` | Die Wissenskapitel |
| `js/ics.js` | Kalenderdateien: tägliche Erinnerung, einzelne Termine |
| `js/diagramm.js` | Verlaufslinie ohne Bibliothek |
| `js/datum.js`, `js/text.js` | Datum, Zahlen mit Komma, HTML entschärfen |

Tests: `tests/test-sd-*.mjs` (vierzehn Dateien – die Oberfläche der
Einschätzung in `test-sd-einschaetzung-ui.mjs`, die Regeln ohne Browser in
`test-sd-regeln-*.mjs`), gemeinsame Helfer in
`tests/sd-hilfe.mjs`. Sie laufen mit allen anderen:

    node tests/lauf.mjs sd-      # nur die Schilddrüse
    npm run lint                 # prüft schilddruese/ mit

## Durchsicht vor dem Mergen

Fünf Prüfer (Logik, medizinische Texte, Barrierefreiheit, Offline-Betrieb,
Datensicherheit) haben die App durchgesehen; jeder Befund wurde von einem
zweiten gegengeprüft. 41 Befunde, 27 bestätigt, alle behoben – dazu einige
der verworfenen, wo der Fix klein und eindeutig richtig war. Die wichtigsten:

- „Dosis damals 50 µg" nannte bei 1½ Tabletten die Stärke statt der
  Tagesdosis von 75 µg – genau die Zahl, mit der eine Ärztin weiterrechnet.
- Eine im Voraus eingetragene Dosis erschien sofort als heutige.
- Eine neu erzeugte Kalenderdatei legt in manchen Handy-Kalendern einen
  zweiten täglichen Alarm an, statt den alten zu ersetzen – die App sagt
  jetzt, den alten Termin zuerst zu löschen.
- Der Worker der Workout-App löschte beim Aktualisieren den Vorrat dieser App
  und beantwortete ihre Seitenaufrufe, solange ihr eigener Worker fehlte –
  offline mit der Workout-App. Er lässt `schilddruese/` jetzt in Ruhe
  (`../sw.js`).
- Das Einnahme-Raster war 18 Pixel breit und unterschied nur über Rot/Grün.

Festgehalten in `tests/test-sd-bedienung.mjs` und den übrigen Tests. Der
Offline-Test hält dafür seinen eigenen Server an: Playwrights
Offline-Schalter schneidet die Anfragen eines Service Workers nicht ab, und
die Prüfung war vorher auch mit leerem Vorrat grün.

## Offene Punkte

- **Wechselnde Dosis je Wochentag** (z. B. werktags 100 µg, am Wochenende
  50 µg) ist üblich, aber hier nur als Notiz zur Dosis abbildbar. Der
  Vorratszähler rechnet mit einer Menge je Tag.
- **Giftnotruf:** Die Nummern je Bundesland stehen in `js/speicher.js`; vor
  dem Gebrauch einmal gegen die aktuelle Liste der Giftinformationszentren
  prüfen.
- **Gegenlesen:** siehe oben – Regeln und Wissenstexte einmal von einer
  Ärztin oder Apothekerin prüfen lassen.
- **Notausgang der Workout-App** („App neu laden" unter Mehr dort) meldet alle
  Service Worker des Ursprungs ab und leert alle Vorräte – auch die dieser
  App. Die Daten bleiben erhalten; offline geht diese App erst wieder nach
  dem nächsten Öffnen mit Netz. Das zu ändern hieße, die Workout-App samt
  Bündel anzufassen; es ist ein ausdrücklicher Knopfdruck dort.
- **Kalender und UID:** Manche Kalender werten die feste UID beim Import aus
  und ersetzen den Termin, viele nicht. Deshalb der Hinweis, den alten Termin
  vorher zu löschen.
