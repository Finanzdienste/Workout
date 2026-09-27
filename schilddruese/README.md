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
| **Heute** | Datum in Worten, die heute gültige Dosis, der große Knopf „Tablette genommen?". Darunter nur, was zutrifft: eine schon eingetragene künftige Dosis („Ab Montag: …"), die Stärke fehlt noch, gestern nichts eingetragen, gestern nicht genommen („heute wie gewohnt – nicht doppelt"), ein Termin in den nächsten zwei Wochen, Blutkontrolle nach einer Dosisänderung, Vorrat geht zur Neige, lange keine Sicherung. Ganz unten „Wie geht es Ihnen heute?" mit drei Knöpfen. |
| **Verlauf** | Laborwerte (TSH, fT4, fT3) je Befund mit dem Bereich des Labors und der Tagesdosis, die damals galt; Verlaufslinie ab zwei Werten in derselben Einheit. Dosis mit Verlauf („aktuell", „geplant"). Einnahmen der letzten vier Wochen als Kalender mit ✓ ✗ ? zum Antippen und Nachtragen. Gewicht. Befinden mit Beschwerden. |
| **Mehr** | Bericht für den Arzttermin (teilen, kopieren, drucken), eigene Fragen für den Termin, Termine (mit Kalenderdatei), Wissen in neun Kapiteln, Erinnerung, Tablettenvorrat, Schrift und Farben, Sicherung, „Über diese App" mit „Alles löschen". |

Beim allerersten Öffnen drei Schritte: Anrede, Tablette (Präparat, Stärke in
µg, Tabletten am Tag, seit wann), Einnahmezeit. Die Stärke darf leer bleiben,
wenn die Packung nicht zur Hand ist – geschätzt wäre schlimmer; „Heute"
erinnert dann daran. Wer ein neues Handy hat, kann schon dort eine Sicherung
einlesen.

## Was sie ausdrücklich nicht tut

- **Keine Bewertung von Werten.** Kein „zu hoch", kein „zu niedrig", keine
  Ampel. Der Bereich wird vom Befund abgeschrieben, nicht von der App
  vorgegeben – jedes Labor hat eigene Grenzen, im Alter liegt die obere
  TSH-Grenze oft höher, und den persönlichen Zielbereich legt die Ärztin fest.
  Ein Prüfer beim Entwurf: *„Jede Farbe an einem Laborwert wird als Urteil
  gelesen."* `tests/test-sd-labor.mjs` prüft das mit einem TSH weit über dem
  Bereich.
- **Keine Dosisempfehlung, keine Diagnose.** Kein Wissenstext weist an, eine
  Tablette mehr oder weniger zu nehmen (`tests/test-sd-wissen.mjs` sucht nach
  solchen Sätzen). Auch der Hinweis „Blutkontrolle nach 6–8 Wochen" nach einer
  Dosisänderung sagt nur die Regel und nichts über die Dosis.
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

**Offen und ehrlich:** Die Prüfer waren KI-Agenten, keine Ärztinnen. Die
Texte sollte vor dem Gebrauch eine Ärztin oder eine Apothekerin einmal
gegenlesen.

## Daten

Ein Schlüssel im localStorage: `schilddruese.stand.v1`, mit `version: 1`.

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
| `index.html` | Seite mit Kopf, Ansicht und Reiterleiste |
| `sw.js` | Offline-Vorrat. **VERSION hochzählen**, wenn sich eine Datei aus `SHELL` ändert |
| `manifest.webmanifest`, `icon*` | Installierbar; PNGs aus `icon.svg` über `node tools/schilddruese-icons.mjs` |
| `css/styles.css` | Gestaltung, Farbwelten, Schriftgrößen |
| `js/app.js` | Reiter, Seiten, Aktionen (`data-act`), Sicherung, Hinweise, Service Worker |
| `js/speicher.js` | Zustand, Normalisierung, Speichern, Sicherung, Abfragen (Dosis am Tag, Einnahmebilanz, Vorrat) |
| `js/ansicht-*.js` | Heute, Verlauf, Mehr, Formulare, Willkommen – liefern HTML als Text |
| `js/bericht.js` | Der Text für den Arzttermin |
| `js/wissen.js` | Die Wissenskapitel |
| `js/ics.js` | Kalenderdateien: tägliche Erinnerung, einzelne Termine |
| `js/diagramm.js` | Verlaufslinie ohne Bibliothek |
| `js/datum.js`, `js/text.js` | Datum, Zahlen mit Komma, HTML entschärfen |

Tests: `tests/test-sd-*.mjs` (elf Dateien), gemeinsame Helfer in
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
- **Weitere Medikamente** – etwa Kalzium, Eisen oder Magensäureblocker, bei
  denen der Abstand zählt – sind nicht als eigene Einträge vorgesehen.
- **Giftnotruf:** In Deutschland regional; die App nennt Berlin als Beispiel.
  Die Nummer des eigenen Bundeslands ließe sich als Einstellung ergänzen.
- **Gegenlesen:** siehe oben – die Wissenstexte einmal von einer Ärztin oder
  Apothekerin prüfen lassen.
- **Notausgang der Workout-App** („App neu laden" unter Mehr dort) meldet alle
  Service Worker des Ursprungs ab und leert alle Vorräte – auch die dieser
  App. Die Daten bleiben erhalten; offline geht diese App erst wieder nach
  dem nächsten Öffnen mit Netz. Das zu ändern hieße, die Workout-App samt
  Bündel anzufassen; es ist ein ausdrücklicher Knopfdruck dort.
- **Kalender und UID:** Manche Kalender werten die feste UID beim Import aus
  und ersetzen den Termin, viele nicht. Deshalb der Hinweis, den alten Termin
  vorher zu löschen.
