# Mahlzeit

Kalorien nachschlagen und mitzählen, Hafertage planen, Gewicht und
Blutzucker festhalten – für einen Arbeitskollegen von Tobi. **Keine Fragen
beim Start, kein Konto, alles bleibt auf dem Handy.**

**Adresse:** <https://finanzdienste.github.io/Workout/mahlzeit/>
(Android: in Chrome öffnen, Menü ⋮ → „Zum Startbildschirm hinzufügen“;
iPhone: in Safari öffnen, Teilen → „Zum Home-Bildschirm“).

Wie die [Schilddrüsen-App](../schilddruese/README.md) liegt sie neben der
Workout-App im selben Repository: kein Bauschritt, keine Abhängigkeiten,
eigener Ordner, eigener Service Worker, eigene Tests (`tests/test-mz-*.mjs`).

## Warum es sie gibt (v1, 17.11.2026)

> Tobi: „Mein Arbeitskollege hat Probleme mit Blutzucker, Gewicht usw. Er
> soll drei mal im Monat nur Hafer essen oder so. Er weiß nicht wieviel
> Kalorien seine Sachen haben. Er hat mal ne Kalorien app runter geladen
> aber da kamen 30 Fragen am Anfang, da hatte er kein bock mehr. Können wir
> für ihn nicht aus unserer Erfahrung aus der Boxenstopp und der
> gesundheitsapp [eine] app bauen“

Daraus drei Regeln, nach denen die App gebaut ist:

1. **Nichts vorher.** Beim ersten Öffnen steht „Heute“ da: 0 kcal und der
   große Knopf „Essen eintragen“. Kein Alter, kein Gewicht, kein Ziel – auf
   der Startseite gibt es kein einziges Eingabefeld (geprüft in
   `test-mz-bedienung.mjs`). Ein kurzes „Hallo“ sagt, wie es geht, und
   verschwindet mit „Alles klar“. Alles Weitere (Tagesziel, Hafertage,
   Werte) ist freiwillig und wartet unter seinem Reiter.
2. **Portionen statt Gramm.** Wer seine Kalorien nicht kennt, wiegt auch
   nicht ab. Die Liste (`js/lebensmittel.js`, rund 200 Sachen) kennt
   „1 Brötchen“, „1 Döner“, „Currywurst mit Pommes“, „1 Flasche Cola“ – in
   acht Bereichen, mit Menge ½ bis 3. Die Suche versteht „Semmel“,
   „Schrippe“, „doner“ ohne Umlaut und Markennamen als Suchwort („Nutella“).
   Was fehlt, trägt man selbst ein – auch von der Packung („120 kcal pro
   100 g, 400 g gegessen“ rechnet die App aus) – und die App merkt es sich.
3. **Was oft gegessen wird, steht vorn.** „Oft bei dir“ über den Bereichen,
   in der Suche weiter oben. Nach dem Eintragen bleibt die Suche offen
   („… eingetragen – noch etwas?“), denn ein Frühstück sind meist drei
   Sachen.

Aus Boxenstopp übernommen: Nährwerte je Portion statt je 100 g, die Idee
„besser tauschen“ (bei rund 20 Sachen ein Tipp: „Cola Zero oder light: spart
210 kcal und 53 g Zucker“). Aus der Schilddrüsen-App: der Service Worker mit
ihren Lehren (Vorrat nur bei der Installation, ganz oder gar nicht), eine
Kalenderdatei statt Erinnerungen, die ohne Server nicht gehen, die Sicherung
als Datei, und dass im selben Ursprung andere Apps wohnen (siehe unten).

## In der App statt von Tobi (v2, 17.11.2026)

> Tobi, zur Anleitung, die er dem Kollegen schicken sollte (Startbildschirm,
> und die Frage, ob der Arzt 3 Hafertage im Monat oder 3 am Stück meint):
> „Das können wir ihm ja alles in die app packen“ – und gleich danach: „Wie
> genau kann man bei nem iphone teilen?“

Vorher (v1) stand die Anleitung zum Startbildschirm als eine Zeile im Hallo
(„iPhone Safari → Teilen → Zum Home-Bildschirm“), und *Wie oft* stand fest
auf 3 im Monat – die Frage, wie es gemeint ist, hätte Tobi stellen müssen.

**Auf den Startbildschirm** – eine eigene Karte auf „Heute“ und dieselbe
Anleitung unter *Mehr*, passend zum Handy (`installierenHtml()`):

- **iPhone, Safari 26 und neuer** (nach Apples iPhone-Handbuch): unten
  rechts „⋯“ → „Teilen“ (wer die Leiste anders eingestellt hat, sieht Teilen
  gleich) → in der Liste nach unten bis „Zum Home-Bildschirm“ (fehlt es:
  „Aktionen bearbeiten“) → Schalter „Als Web-App öffnen“ anlassen →
  „Hinzufügen“. **Älteres Safari:** Teilen unten in der Mitte, ohne den
  Schalter. Die Symbole (Teilen, ⋯, Zum Home-Bildschirm, ⋮, der Kompass)
  stehen als kleine Bilder im Text – „Teilen“ allein sagt niemandem, wo er
  tippen soll. Die Fassung kommt aus „Version/26“, nicht aus „iPhone OS
  18_6“: Seit iOS 26 meldet Safari dort mit Absicht eine eingefrorene Zahl
  (`safariFassung()`).
- **Chrome oder Firefox auf dem iPhone:** am sichersten über Safari – Knopf
  „Link kopieren“, dann in Safari einfügen; der eigene Weg des Browsers steht
  klein darunter.
- **Android:** Bietet Chrome das Installieren selbst an
  (`beforeinstallprompt`), genügt ein Knopf „Jetzt installieren“; sonst die
  Schritte über ⋮. Nach `appinstalled` ist die Karte für immer weg.
- **Aus WhatsApp geöffnet:** erst in Safari bzw. Chrome öffnen (Kompass bzw.
  ⋮ → „In Chrome öffnen“) – in dessen Fenster fehlt „Zum Home-Bildschirm“.
- Als App gestartet: keine Karte, unter *Mehr* „Läuft schon als App“.
  „Später“ hält eine Woche; auf dem Rechner (weder iPhone noch Android, kein
  Angebot von Chrome) keine Karte.

**Wie oft Hafertage** fragt die App den Kollegen selbst – aber nicht beim
Start, sondern unter *Hafer* (auf „Heute“ steht bis dahin „Wie oft hat dein
Arzt gesagt? … Hafertage einrichten“). Vier Antworten, die zwei Wege aus dem
Infoblatt und zwei Auswege:

- **Ein paar Tage im Monat** (verteilt): wie viele, 1 bis 4, vorgewählt 3
  (Tobi: „drei mal im Monat“). „Heute“ zählt mit („1 von 3“).
- **Mehrere Tage am Stück:** 2 oder 3 Tage, jeden Monat oder alle 2, 3, 4
  Monate (vorgewählt 3 Tage, jeden Monat – die andere Lesart von „drei mal
  im Monat“). Ein Tipp in den Kalender trägt die ganze Runde ein, ein Tipp
  auf einen ihrer Tage nimmt sie ganz heraus, beides mit „Rückgängig“. Ist
  keine Runde geplant, meldet sich „Heute“ eine Woche bevor die nächste dran
  ist (Beginn der letzten plus „alle … Monate“, `naechsteRunde()`).
- **Weiß ich nicht genau:** drei Fragen für den nächsten Arzttermin (verteilt
  oder am Stück und wie oft; Tabletten oder Insulin an Hafertagen; Kalorien am
  Tag). Die Startseite drängelt dann nicht.
- **Ich mache keine Hafertage:** keine Erinnerung; „doch einrichten“ holt die
  Frage zurück.

Ein Stand aus v1 bekommt die Frage; wer dort „aus“ gewählt hatte
(`proMonat: 0`), bleibt aus.

Geprüft in `tests/test-mz-einrichten.mjs` (gegen v1 rot) und
`tests/test-mz-rechnen.mjs` (Läufe, Monate, Safari-Fassung).

## Heute

Tagessumme groß, darunter die Kohlenhydrate (für den Blutzucker zählen die
mehr als die Kalorien). Mit Tagesziel ein Balken: „von 2.000 · noch 760“,
darüber „… drüber“ in Orange, nicht in Rot. Die Einträge nach Tageszeit
(morgens, mittags, nachmittags, abends; vorgewählt nach der Uhrzeit, der
Döner um eins zählt zum Abend). Antippen: Menge und Tageszeit ändern oder
löschen, mit „Rückgängig“. Mit ‹ zu gestern und weiter zurück, zum
Nachtragen; in die Zukunft nicht. Unten die letzten sieben Tage als Säulen
(Hafertage mit 🌾) und der Schnitt der Tage mit Einträgen, ohne heute.

**Tagesziel** (*Mehr*): kein Ziel, 1.800, 2.000, 2.200, 2.500 oder eine
eigene Zahl. Dazu der Satz: Hat der Arzt eine Zahl genannt, die nehmen; sonst
sind 1.800–2.200 kcal für die meisten Männer, die abnehmen wollen, ein guter
Anfang. Gerechnet wird kein Bedarf – dafür bräuchte es die 30 Fragen.

## Hafertage

Grundlage ist das Infoblatt **„Intensive Hafertage“ der Deutschen
Diabetes-Hilfe** (diabetesDE, Juni 2017,
[PDF](https://www.diabetesde.org/system/files/documents/intensive_hafertage_patienten-infoblatt_begleitend_zum_beratungsgespraech_juni_2017.pdf)):

- je Hafertag drei Mahlzeiten aus je 75 g Haferflocken in rund 500 ml
  Wasser (süß) oder Gemüsebrühe (herzhaft), zusammen 225 g, 828 kcal,
  132 g Kohlenhydrate; dazu nur wenig Gemüse (50 g) oder Obst (25 g),
  Kräuter, Zitrone, nicht salzen;
- mindestens 4 Stunden Abstand, keine Zwischenmahlzeiten, rund 2 Liter
  Wasser oder ungesüßter Tee;
- zwei Wege: 2–3 Hafertage am Stück (oder 2 in einer Woche) und das alle
  3–4 Monate, oder regelmäßig 1, 2 oder 4 Hafertage im Monat;
- mit Insulin: vorher die Dosis mit der Praxis besprechen, an Hafertagen
  mindestens 7-mal messen; bei Unwohlsein oder Unterzucker die Praxis
  anrufen.

Wie oft, fragt die App den Kollegen seit v2 selbst (siehe unten „In der App
statt von Tobi“). Die Tage plant er im Monatskalender; drei Tage am Stück
zeigt „Heute“ als „Tag 2 von 3“.

**Auf der Startseite:** an einem Hafertag oben die Hafer-Karte mit Frühstück,
Mittag und Abend zum Abhaken (jeder Haken trägt den Haferbrei mit
275 bzw. 285 kcal ein, ein zweiter Tipp nimmt ihn wieder heraus), nach der
dritten „Geschafft“. Am Tag davor „Morgen ist Hafertag – Haferflocken (225 g)
und Gemüsebrühe im Haus?“, sonst der nächste geplante Tag oder, wenn im Monat
noch weniger geplant sind als gewünscht, „Hafertage im November: noch keiner
geplant“.

**Auf der Hafer-Seite:** zuerst der Hinweis zum Arzt (Insulin oder
Tabletten gegen Zucker → vorher besprechen; zittrig, schwummrig, kalter
Schweiß → Traubenzucker und die Praxis anrufen), dann Planen, eine
Einkaufsliste für die nächsten Hafertage, die Regeln und die Rezepte aus dem
Infoblatt. **Kalenderdatei:** je Hafertag ein ganztägiger Termin mit
Erinnerung um 18 Uhr am Abend davor – ohne Server ist das der einzige Weg,
dass das Handy erinnert, auch wenn die App zu ist.

## Werte

Gewicht (ein Wert je Tag, ein zweiter ersetzt den ersten; Verlauf als Linie
und „Seit … −2,4 kg“), Blutzucker in mg/dl mit Zeitpunkt (nüchtern, vor dem
Essen, nach dem Essen, sonst; Hafertage mit 🌾) und der Langzeitwert HbA1c
aus dem Befund. Ein Blutzucker unter 35 ist in mg/dl kaum möglich, in mmol/l
üblich: Bei „6,5“ fragt die App „sieht nach mmol/l aus – als 117 mg/dl
speichern?“, statt eine falsche Zahl abzulegen.

**Bewusst keine Bewertung der Werte.** Die App sagt nicht „zu hoch“ oder
„gut“, sie färbt nichts ein. Daneben steht fest derselbe Satz: Was die Werte
heißen, sagt der Arzt; Unterzucker merkt man an Zittern, Schwitzen,
Heißhunger, Schwindel – dann Traubenzucker. Grund: Die App geht an einen
Dritten. Mit Einordnung einzelner Werte wäre sie, anders als ein Tagebuch
mit Kalorienliste und Infoblatt, auf dem Weg zum Medizinprodukt – genau die
Grenze, die `schilddruese/README.md` („Keine Weitergabe an Dritte“) zieht.

## Daten

Alles in einem Schlüssel im localStorage des Handys, `mahlzeit.stand.v1`.
Nach draußen geht nichts – kein Rückkanal, keine Zählung, kein Server.

- **Im selben Ursprung** (`finanzdienste.github.io`) wohnen Workout,
  Schilddrüse, Boxenstopp und Body Check, und der localStorage gehört allen
  zusammen. Die App fasst nur Schlüssel mit `mahlzeit.` an; „Alles löschen“
  löscht nur diese, nie `localStorage.clear()` (geprüft: die Schlüssel der
  anderen bleiben).
- Jede Änderung liest den Stand frisch und schreibt ihn zurück – ein zweiter
  Tab überschreibt nichts. Beim ersten Speichern bittet die App den Browser,
  die Daten nicht von selbst wegzuräumen (`navigator.storage.persist`).
- Ein kaputter Speicher startet die App trotzdem (leer statt weiß);
  unbrauchbare Einträge fliegen beim Lesen raus (`ordnen()`).
- **Sicherung** (*Mehr*): als Datei `mahlzeit-sicherung-JJJJ-MM-TT.json`;
  Einlesen fragt vorher und lehnt fremde Dateien mit Grund ab. Ab sieben
  Tagen mit Einträgen erinnert „Heute“ daran, wenn die letzte Sicherung
  älter als 30 Tage ist („Später“ = 14 Tage Ruhe).
- **iPhone:** Safari löscht die Daten einer Seite, die ein paar Wochen nicht
  geöffnet wurde – vom Home-Bildschirm aus nicht. Das steht im Hallo und
  unter *Mehr*.

## Offline und Aktualisierung

`sw.js` wie in der Schilddrüsen-App: Seite zuerst vom Netz, Module aus dem
Vorrat; der Vorrat entsteht nur bei der Installation und nur vollständig.
`VERSION` in `sw.js` und `FASSUNG` in `js/app.js` zusammen hochzählen
(`test-mz-offline.mjs` vergleicht sie). Kommt eine neue Fassung, lädt die App
einmal neu – aber nicht, während „Essen eintragen“ offen ist; dann danach.

Der Worker der Workout-App (`../sw.js`) gilt formal für den ganzen Ordner
`/Workout/` und lässt `/mahlzeit` seit v264 ausdrücklich in Ruhe – vorher
lieferte er dort offline die Workout-App aus (der Test war gegen v263 rot).

**Bekannte Grenze wie bei Freizeit:** Auf einem Android-Handy, auf dem die
Workout-App installiert ist, rechnet Chrome diesen Ordner der Workout-App zu
und bietet „Mahlzeit“ womöglich nicht als eigene App an. Für den Kollegen
spielt das keine Rolle (er hat Workout nicht). Soll Mahlzeit ein eigenes
Repository bekommen, bleiben seine Einträge trotzdem: Der localStorage hängt
am Ursprung `finanzdienste.github.io`, nicht am Pfad – nur das Symbol auf dem
Startbildschirm müsste er neu anlegen.

## Dateien

| Datei | Inhalt |
| --- | --- |
| `index.html` | Gerüst: Kopf, Leiste unten, Platz für Ansicht, Ebene und Meldung |
| `js/app.js` | Oberfläche – Heute, Hafer, Werte, Mehr, die Ebene „Essen eintragen“ |
| `js/rechnen.js` | alles Rechnen ohne Seite: Suche, Summen, Tage, Hafertage, Kalenderdatei, Sicherung |
| `js/lebensmittel.js` | die Liste: Kennung, Name, Portion, kcal, Kohlenhydrate, Bereich, Suchwörter, Tipp |
| `js/speicher.js` | localStorage, nur Schlüssel mit `mahlzeit.` |
| `sw.js` | Service Worker, Vorrat `mahlzeit-…` |
| `icon.svg` | Symbol; PNGs mit `node tools/mahlzeit-icons.mjs` |

Die Kennungen in `js/lebensmittel.js` ändern sich nie – alte Einträge und
„Oft bei dir“ hängen daran. Neue Sachen einfach anhängen.

## Tests

- `tests/test-mz-rechnen.mjs` (ohne Browser): die Liste (keine doppelten
  Kennungen, keine Sache mit mehr Kohlenhydraten, als ihre Kalorien
  hergeben, Haferbrei dreimal ≈ 828 kcal), die Suche, Mengen, Tage über die
  Zeitumstellung, Hafertage, Kalenderdatei (CRLF, 75 Oktette, das Emoji
  bleibt ganz), mmol/l, Sicherung.
- `tests/test-mz-bedienung.mjs`: der ganze Weg des Kollegen im Browser, vom
  ersten Öffnen ohne Fragen bis Sicherung, Alles löschen und Einlesen, dazu
  der Hafertag selbst und 340 px Breite.
- `tests/test-mz-offline.mjs`: SHELL vollständig, ohne Server öffnen, neben
  der Workout-App.
- `tests/test-mz-einrichten.mjs`: Startbildschirm je Handy, die Hafer-Frage,
  Runden am Stück.

`node tests/lauf.mjs test-mz-`

## Offen

- Strichcode scannen (Open Food Facts) wäre der nächste Schritt für
  Verpacktes; auf dem iPhone fehlt Safari dafür aber die Schnittstelle.
