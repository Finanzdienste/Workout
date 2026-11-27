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





## Nichts Persönliches im öffentlichen Repo, neue Kennung (v19, 27.11.2026)

Dieses Repository ist öffentlich. In den Notizen standen Uwes Alter, Gewicht
und Größe (aus dem Plan von v7) und seit v13 die Kennung seines Handys. Die
Kennung ist der einzige Ausweis eines Handys beim Server: Wer sie kennt,
kann über `mahlzeit_werte_melden` überschreiben, was bei Tobi ankommt. Auf
die Frage „Soll ich die Angaben aus den Notizen nehmen und Uwes App eine neue
Kennung geben?“ sagte Tobi: „Jo“.

**Was vorher war:** `README.md` und `CLAUDE.md` nannten die Kennung im
Klartext (Liste der Geräte von v15, SQL-Abfrage von v13) und die
Körperangaben; `tests/test-mz-protokoll.mjs` und `tests/test-mz-essen.mjs`
rechneten mit Uwes echten Werten aus einem Screenshot.

**Was jetzt gilt:**
- **In Notizen, Code und Tests steht keine Kennung eines echten Handys und
  nichts über Uwes Körper.** Wer Uwe ist, sagt nur die Datenbank:
  `select geraet from mahlzeit_name where name = 'Uwe'`. Die Tests rechnen
  mit erfundenen Werten. In der alten Git-Historie bleibt das Entfernte
  lesbar – ganz weg bekäme man es nur mit umgeschriebener Historie; darum
  die neue Kennung.
- **Jedes Handy mit alter Kennung wechselt von selbst** (`geraetBereit()` in
  `js/lebenszeichen.js`): Beim nächsten Öffnen würfelt es eine neue Kennung
  (16 Zeichen, `mahlzeit.geraet.v2`) und meldet dem Server den Wechsel –
  mit den Kennungen seiner eigenen Werte als Beweis, die kennt außer dem
  Handy nur die Datenbank. Die Datenbankfunktion `mahlzeit_geraet_wechseln`
  zieht dann Werte, Essen, Lebenszeichen und den Namen um; danach ist die
  alte Kennung auf dem Handy gelöscht und beim Server leer. Uwe merkt davon
  nichts und muss nichts tun.
- **Als Beweis zählt nur, was vor der Umstellung da war**
  (`mahlzeit_wechsel_beweis`): Was jemand mit der alten Kennung nachträglich
  hinlegt, zählt nicht. Mindestens drei Treffer (oder alle, wenn es weniger
  sind), nach 20 Fehlversuchen ist die alte Kennung gesperrt.
- **Nach dem Wechsel gehen die Werte einmal ganz** unter der neuen Kennung
  hinaus – dann steht bei Tobi sicher, was auf dem Handy steht. Kennt der
  Server die alte Kennung nicht (ein Handy ohne Werte), fängt es unter der
  neuen einfach von vorn an.
- **Ohne Netz** geht nichts hinaus und nichts verloren: Die alte Kennung
  bleibt, bis der Server geantwortet hat; der nächste Versuch kommt beim
  Öffnen, beim Weglegen und beim Ereignis `online`. Die App selbst läuft
  dabei weiter wie immer.
- **Neue Handys** haben gleich eine Kennung der neuen Art und fragen den
  Server gar nicht. Ist „Lebenszeichen an Tobi“ abgeschaltet, passiert auch
  der Wechsel nicht – erst, wenn es wieder an ist.
- **„Meine Apps“** erkennt Uwe über `mahlzeit_name` statt über eine feste
  Kennung (`apps_wer`, `mahlzeit_lesen`).

SQL: `supabase/geraet.sql` (ohne die Zeile mit Uwes Kennung).

**Für Tobi nachsehen** (Supabase, SQL):

```sql
-- Ist Uwes Handy schon gewechselt?
select fertig, fehlversuche from public.mahlzeit_wechsel;
```

**Geprüft** in `tests/test-mz-kennung.mjs`:
- neues Handy: kein Wechsel, 16 Zeichen Zufall
- alte Kennung: genau ein Wechsel vor allem anderen, mit alter und neuer
  Kennung und den Kennungen der Werte, ohne Werte und Essen; danach alles
  unter der neuen, die alte ist vom Handy gelöscht
- ohne Netz und bei einem Fehler des Servers: nichts geht hinaus, die alte
  Kennung bleibt; mit `online` kommt der Wechsel von selbst
- umgezogen oder nicht: die Werte gehen einmal ganz unter der neuen Kennung
- abgeschaltet und im Testbrowser (v15): gar keine Frage
- **Wache:** In `mahlzeit/`, `CLAUDE.md`, `README.md` und den Tests steht
  keine feste Kennung (`geraet = '…'`) und kein Gewicht mit Größe.

## Erinnerung am Abend (v18, 27.11.2026)

Tobi fragte: „Und wie können wir die app noch weiter optimieren?“ Der zweite
von drei Vorschlägen war „eine sanfte Erinnerung am Abend“, weil Uwe jeden
Tag einträgt, aber von Tag zu Tag weniger. Tobi: „Alle drei“.

**Vorher:** Die App meldete sich nie von selbst.

**Jetzt:** Ist zur gewählten Uhrzeit (19, 20 oder 21 Uhr, vorgewählt 20)
noch nichts fürs Abendessen eingetragen, kommt eine Mitteilung. Ist schon
eingetragen, bleibt es still.

- **Zwei Texte, ohne Urteil:**
  - „Abendessen schon gehabt? Kurz eintragen, dann ist der Tag komplett.“
  - „Heute ist noch nichts eingetragen. Magst du es kurz nachtragen?“ (wenn
    der Tag leer ist oder die App heute nicht offen war)
- **Höchstens eine am Tag,** bis zwei Stunden nach der Uhrzeit, danach nicht
  mehr.
- **Sie hört von selbst auf,** wenn die App sich sieben Tage nicht gemeldet
  hat. Niemand wird ewig angetippt.

**In der App:**
- Auf „Heute“ fragt eine Karte einmal „🔔 Soll ich dich abends erinnern?“
  mit „Ja, erinnern“ und „Nein danke“. Sie kommt erst nach zwei Tagen mit
  Einträgen und nur, wenn das Handy Mitteilungen kann.
- Unter *Mehr → Erinnerung am Abend* stehen aus / 19 / 20 / 21 Uhr und
  „Probe schicken“.
- Geht es nicht, steht dort warum: iPhone im Browser statt vom
  Home-Bildschirm, oder Mitteilungen blockiert.

**Wie es läuft:**
1. `js/erinnerung.js` holt beim Push-Dienst des Browsers ein Abo. Auf dem
   iPhone geht das nur in der App vom Home-Bildschirm, ab iOS 16.4.
2. Die App legt das Abo mit Uhrzeit, Zeitzone und zwei Zahlen (Einträge
   heute, davon abends) in `mahlzeit_erinnerung` ab, über
   `mahlzeit_erinnerung_melden` (`supabase/erinnerung.sql`). Was gegessen
   wurde, geht dafür nicht mit.
3. Die Zahlen meldet sie nach, wenn sie sich ändern: beim Öffnen, beim
   Weglegen und bei `online`. Ohne Netz gilt nichts als gemeldet.
4. pg_cron ruft alle 15 Minuten `mahlzeit_erinnerung_anstossen()`. Die weckt
   die Edge Function `mahlzeit-erinnerung` nur, wenn jemand dran sein könnte.
5. Die Funktion entscheidet (`faellig` in `lauf.js`) und verschickt
   verschlüsselt. `webpush.js` ist eine unveränderte Kopie aus
   Finanzdienste/Freizeit. Der Ausweis (VAPID) ist derselbe und liegt in der
   Datenbank (`freizeit_push_schluessel`).
6. `sw.js` zeigt die Mitteilung. Ein Tipp darauf holt die App nach vorn.

**Schutz:**
- Die Kennung ist zufällig (24 Zeichen) und liegt nur auf dem Handy, in
  `mahlzeit.erinnerung.v1`. Sie steht nicht im Stand und zieht nicht mit der
  Sicherung um. Es ist nicht die Gerätekennung des Lebenszeichens.
- Verschickt wird nur an echte Push-Dienste (Google, Apple, Mozilla,
  Microsoft).
- Höchstens fünf Proben am Tag.
- Ein Abo, das der Push-Dienst nicht mehr kennt (404, 410), wird gelöscht.
  Die App legt beim nächsten Öffnen ein neues ab.
- Testbrowser melden nichts (`echtesGeraet()`).

**Live geprüft am 27.11.** mit einem erfundenen Abo:
- Anmelden und Abmelden gehen, ein kaputtes Abo wird abgelehnt.
- Mit dem öffentlichen Schlüssel ist die Tabelle nicht lesbar.
- Die Probe kam bis zu Googles Push-Dienst. Der antwortete 410, weil es das
  Abo nicht gibt, und die Zeile war danach weg.
- Dabei gefunden: Postgres erlaubt in einem Muster höchstens 255
  Wiederholungen, `{10,1000}` ließ jeden Aufruf scheitern. Behoben.
- **Nicht geprüft:** dass die Mitteilung auf einem echten Handy erscheint.
  Das zeigt „Probe schicken“.

**Für Tobi nachsehen** (Supabase, SQL):

```sql
-- Wer hat die Erinnerung an, wann zuletzt erinnert, wann war die App zuletzt da?
select left(kennung, 4) as handy, uhr, tag, gesamt, abends, gesendet, at
from public.mahlzeit_erinnerung order by at desc;
```

Was die Funktion getan hat, steht in Supabase unter *Edge Functions →
mahlzeit-erinnerung → Logs* (eine Zeile je Durchlauf, in dem jemand dran
war).

Geprüft in `tests/test-mz-erinnerung.mjs`:
- wer wann dran ist
- was beim Push-Dienst ankommt (entschlüsselt nachgelesen)
- tote Abos und die Probe mit Grenze
- der Service Worker
- in der App: Frage, Einschalten, Nachmelden auch nach einer Zeit ohne
  Netz, Uhrzeit, Probe, Aus, Erlaubnis verweigert, Server weg, iPhone im
  Browser, Testbrowser

## „Wie gestern“ mit einem Tipp (v17, 27.11.2026)

Tobi fragte: „Und wie können wir die app noch weiter optimieren?“ Uwe trug
jeden Tag ein, aber immer weniger: 13 → 7 → 9 → 5 → 5 → 4 Einträge. Sein
Frühstück ist meist dasselbe. Unter den drei Vorschlägen war dieser der
erste. Tobi: „Alle drei“.

**Jetzt:** Auf „Heute“ steht über den Einträgen je Tageszeit ein Knopf
„↻ Morgens wie gestern · 405 kcal“. Angeboten werden die Tageszeiten, die am
letzten Tag mit Einträgen etwas hatten und am angezeigten Tag noch nichts.
Gesucht wird bis zu sieben Tage zurück; liegt ein Tag dazwischen, heißt es
„wie am Mittwoch“. Ein Tipp trägt alles dieser Tageszeit ein, mit neuen
Kennungen und ohne Hafer-Platz. Die Meldung hat „Rückgängig“. Der Code
dafür steht in `wieVorher` und `wiederholen` in `js/rechnen.js`.

**Die anderen beiden Vorschläge:**
- „Seine eigenen Sachen fest in die Liste“: Uwe hat das Teilen seines Essens
  nicht erlaubt (`mahlzeit_essen` leer). Seine 13 eigenen Sachen stehen
  ohnehin in seiner Suche und unter „Oft bei dir“. Kein Bau.
- Die Abend-Erinnerung als Mitteilung kam mit v18 (Abschnitt oben).

Geprüft in `tests/test-mz-wie-gestern.mjs`.

## Ernährungsprotokoll zum Teilen und Drucken (v16, 27.11.2026)

Uwe an Tobi: „Gibt es eine Möglichkeit das ich die eingetragenen Lebensmittel
pro Tag irgendwie auslesen kann? Dann bräuchte ich sie nicht doppelt für
meine Ernährungsprotokoll für die Ernährungsberatung aufzuschreiben.“

**Vorher:** Was eingetragen war, sah man nur Tag für Tag auf „Heute“.

**Jetzt:** „📋 Ernährungsprotokoll“ ist der Knopf unten auf „Heute“, sobald
etwas eingetragen ist. Dieselbe Funktion steht als Karte unter *Mehr*. Sie
öffnet eine Ebene:
- **Zeitraum** zum Wählen: letzte 7 Tage (vorgewählt), 14 oder 30 Tage.
- **Nur Tage mit Einträgen**, der älteste zuerst. Je Tag stehen die
  Einträge nach Tageszeit da, als Menge × Name mit Portion und kcal. Darunter
  die Summe aus kcal, Kohlenhydraten und Eiweiß und die Werte des Tages
  (Gewicht, Blutzucker mit „wann“ und Uhrzeit). Ein Hafertag ist
  gekennzeichnet.
- **„📤 Teilen“** gibt das Protokoll als Text weiter, per WhatsApp oder Mail
  (`navigator.share`). Wo das nicht geht, kopiert die App den Text.
- **„🖨️ Drucken / PDF“** öffnet das Druckfenster. Gedruckt wird nur das
  Protokoll mit Überschrift (`@media print`). Auf dem iPhone wird es im
  Druckfenster über das Teilen-Symbol zum PDF.

Alles geht ohne Netz. Die Berechnung steckt in `protokollTage` und
`protokollText` in `js/rechnen.js`.

Geprüft in `tests/test-mz-protokoll.mjs`:
- Tage, Tageszeiten, Mengen, Summen und Werte
- der Text
- die Ebene mit Zeitraum, Teilen und Drucken
- die Druckansicht ohne Knöpfe
- ganz ohne Netz

## Nur echte Handys melden (v15, 26.11.2026)

Tobi zeigte „Meine Apps“ (Karte Mahlzeit: „Weitere: Gerät l5yl, Gerät n4zs,
Gerät o0ty und 2 mehr“) und fragte: „Was sind das eigentlich für weitere
Geräte?“

**Was in `mahlzeit_nutzung` stand:**
- Uwes Handy: die App vom Startbildschirm, seit dem 18.11. (welche Kennung
  das ist, steht seit v19 nur noch in der Datenbank, `mahlzeit_name`).
- `37q1…` (19. und 26.11., v8) und `9ifv…` (18.11., v6): im
  Browser ohne einen einzigen Eintrag – vermutlich Tobi beim Ansehen.
- `o0ty…`, `n4zs…`, `rlo3…` (25.11., v13) und `l5yl…` (26.11., v14): je
  einmal, im Browser, mit genau einem Tag voller Einträge, kurz nach dem
  Ausliefern einer neuen Fassung – Testläufe von Claude-Sitzungen. Sie
  haben die App mit Testdaten geöffnet, und deren Lebenszeichen ist bis zu
  Tobi durchgekommen.
- `testclaude01`: mein Test vom 18.11.

**Jetzt gilt:** `echtesGeraet()` in `js/lebenszeichen.js`. Das Lebenszeichen,
die Werte und das Essen gehen nur noch raus, wenn der Browser nicht
ferngesteuert ist (`navigator.webdriver`) und die App von GitHub Pages
kommt. Die Tests schalten das Melden über `__mz_lz_test` bewusst ein, das
setzt `oeffne()` in `tests/mz-hilfe.mjs`. Mit `oeffne({ wieEcht: true })` ist
es wie im Testbrowser draußen: Dann geht nichts raus. Geprüft in
`tests/test-mz-lebenszeichen.mjs`.

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

## Rezepte, Kochbuchseiten, Strichcodes – mit KI (v3, 17.11.2026)

> Tobi: „ihm fehlen viele rezepte und zutaten. Lass doch per Api ne ki
> einbauen in der er seine eigenen rezepte in textform reinschreiben kann
> oder ne seite ausm kochbuch fotografieren aknn. Dann kann man ja kalorien
> je 100g sagen“ – und gleich danach: „und barcode scanner“.

Vorher (v1, v2) kannte die App ihre rund 200 Sachen, und was fehlte, trug man
von Hand ein. Jetzt gibt es unter der Suche zwei Knöpfe:

- **Strichcode.** Android (Chrome) liest ihn live mit der Kamera
  (`BarcodeDetector`, nur EAN/UPC), das iPhone kann das in Webseiten nicht –
  dort fotografiert man ihn, und die KI liest die Ziffern ab (wie Boxenstopp).
  Eintippen geht immer, die Prüfziffer wird geprüft. Nachgeschlagen wird bei
  **Open Food Facts** (frei, ohne Schlüssel; nur die Nummer geht hinaus). Das
  Produkt wird eine eigene Sache mit kcal je 100 g und der Portion der
  Packung; beim zweiten Scan kommt es ohne Netz aus den eigenen Sachen. Kennt
  Open Food Facts die Nummer nicht (oder ohne Kalorien): „Nährwerttabelle
  fotografieren“ (KI) oder „Selbst eintragen“.
- **Rezept oder Foto.** Rezept als Text oder Foto der Kochbuchseite (bis zu
  drei Fotos), dazu auf Wunsch die Zahl der Portionen; oder „Packung,
  Nährwerte“ mit dem Foto der Nährwerttabelle. Die KI liefert kcal und
  Kohlenhydrate je 100 g, das ganze Rezept, das Gewicht des fertigen Gerichts
  und „So hat die KI gerechnet“ (je Zutat). Die Portionen stellt man im
  Ergebnis um (1 bis 8), dann „Speichern und eintragen“ oder „Nur speichern“.
- **In Gramm eintragen:** Jede Sache mit kcal je 100 g (Strichcode, KI, und
  „Selbst eintragen“ mit „pro 100 g“) hat im Eintragen ein Feld „oder genau
  … g“, das sofort rechnet.

**Wo die KI läuft.** In der Supabase-Funktion `mahlzeit-ki`
(`supabase/functions/mahlzeit-ki/`, Projekt „Finanzdienste's Project“, neben
`amy-chat`) mit dem Anthropic-Schlüssel, der dort schon für „Frag mal“ liegt –
auf dem Handy liegt kein Schlüssel. Modell Claude Opus 5.5, Aufwand mittel,
festes JSON-Schema, bei einer Ablehnung springt ein anderes Modell ein
(`fallbacks: "default"`). Die Funktion kappt unmögliche Zahlen (mehr als
950 kcal je 100 g) und rechnet beim Rezept je 100 g aus Summe und Gewicht.
Kosten: rund 2 bis 5 Cent je Auswertung; sie stehen in `mahlzeit_ki` und, für
die Übersicht in „Frag mal“, in `fragmal_kosten` (App „mahlzeit“).

**Freischalt-Code.** Die Funktion antwortet nur mit einem Code (Kopf
`x-zugang`); gespeichert ist nur seine Prüfsumme in `mahlzeit_zugang`. Uwe
bekommt ihn im Link: `…/mahlzeit/#ki=ABCDE-FGHJK` – die App merkt ihn sich
(eigener Schlüssel `mahlzeit.ki.v1`, nicht in der Sicherung) und nimmt ihn aus
der Adresse. Unter *Mehr → KI und Strichcode* lässt er sich eintippen oder
entfernen. **iPhone:** Die App vom Home-Bildschirm hat einen eigenen Speicher,
deshalb zeigt die Startbildschirm-Karte in Safari den Code mit „kopieren“.
Grenzen: 30 Auswertungen je Code und Tag, 100 für alle zusammen.

- Code sperren: `update mahlzeit_zugang set aktiv = false where name = 'Uwe';`
- Neuer Code: zehn Zeichen aus `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`, die
  SHA-256 der Zeichen (ohne Bindestrich, groß) als `hash` eintragen.

**Am 17.11. war das Anthropic-Guthaben leer** („Your credit balance is too
low“) – die Funktion lief, die KI nicht, „Frag mal“ genauso. Für so einen
Fehler (400/401/403/404 von Anthropic) sagt die App „Die KI ist gerade nicht
verfügbar. Sag Tobi Bescheid“ statt „gleich noch einmal versuchen“.

Geprüft in `tests/test-mz-ki.mjs` (die Funktion in Node, mit nachgebauter
Datenbank und KI), `tests/test-mz-scan.mjs` (die App, mit nachgebautem Open
Food Facts, nachgebauter Funktion und nachgebauter Kamera) und
`tests/test-mz-rechnen.mjs` (Prüfziffer, Open Food Facts lesen, Portionen).

## Sport (v4, 17.11.2026)

> Tobi: „Lass noch nen Sportmodus einbauen. Uwe brauch auch bewerglichkeit
> und so. Können wir ja basierend auf meiner workout app machen. Er soll auch
> eintragen können was er für Hanteln und Gewichte hat und so“ – dazu Fotos
> von Schwungstäben (seillose Battle Ropes) und einem Schwingstab, „und n
> wackelkissen“, „Hometrainer Fahrrad hat er auch“, „er meint er ist sehr
> steif“.

Ein fünfter Reiter **Sport**. Beim ersten Öffnen dort (nicht beim Start der
App) drei Fragen: was er zu Hause hat (Kurzhanteln mit den Gewichten je
Hantel, Heimtrainer, Schwungstäbe, Schwingstab, Wackelkissen, Matte), ob
etwas zwickt (Rücken, Knie, Schulter, Nacken, Hüfte), und ob Kraft zwei- oder
dreimal die Woche. „Ändern“ holt die Fragen zurück.

- **Beweglichkeit jeden Tag**, rund zehn Minuten, zehn Übungen von oben nach
  unten (Schultern, Nacken, Brust, Rumpf drehen, Katze–Kuh, Hüftbeuger,
  Beinbeuger, Wade, Gesäß, Schwingstab). Weil er sehr steif ist: sanfte
  Dauer (30–60 s), alles im Stehen oder Sitzen möglich; ohne Matte die
  Katze–Kuh im Stehen. Die Texte stammen aus der Workout-App (`CARE` in
  `js/injuries.js`), kopiert, nicht verlinkt – eine Änderung an Tobis Plan
  verschiebt Uwes App nicht.
- **Kraft & Ausdauer** zwei- oder dreimal die Woche, nie zwei Tage
  hintereinander: Rad zum Aufwärmen (sonst auf der Stelle gehen), Kniebeuge
  zum Stuhl (mit Hantel als Goblet), Liegestütz an der Wand, Rudern,
  Schulterdrücken im Sitzen, Beckenheben, Bird Dog, Bizeps, Einbeinstand auf
  dem Wackelkissen, Schwingstab, Schwungstäbe (3 × 30 s), Rad-Intervalle.
  Fehlt ein Gerät, kommt der Ersatz ohne; verträgt eine Beschwerde eine Übung
  nicht, fällt sie weg oder wird sanfter (Rücken: Schulterblätter statt
  vorgebeugtem Rudern; Schulter: kein Drücken, keine Schwungstäbe; Knie:
  keine Kniebeuge).
- **Die Hanteln:** Startgewicht ist die schwerste Hantel bis zum Zielwert der
  Übung (Goblet 8, Rudern 6, Bizeps 5, Schulterdrücken 4 kg). Nach jeder
  Hantelübung „zu leicht / passt / zu schwer“ – beim nächsten Mal die
  nächste bzw. leichtere Hantel, die er hat.
- **Die Einheit** läuft Schritt für Schritt: Name, Dosis, Gewicht,
  Anleitung, bei Zeitübungen eine Uhr (je Seite in zwei Hälften, Runden mit
  Pausen, Ton und Vibration beim Wechsel; der Bildschirm bleibt an).
  „Geschafft – weiter“ oder „Auslassen“; am Ende festgehalten.
- **Heimtrainer** lässt sich auch einzeln eintragen (Minuten, locker /
  mittel / zügig); mit einem Gewicht unter „Werte“ steht dabei, wie viele kcal
  ungefähr verbraucht wurden. Die verbrauchten kcal zählen nicht gegen das
  Essen – das bleibt eine eigene, ehrliche Zahl.
- **Auf „Heute“:** ist die Beweglichkeit noch nicht gemacht, eine Karte mit
  „Los geht’s“ (und, wenn dran, „Kraft & Ausdauer“). Am Hafertag rät die
  Sportseite zu Beweglichkeit oder lockerem Rad.
- Fest auf der Sportseite: Sport senkt den Blutzucker – mit Insulin oder
  solchen Tabletten Traubenzucker in Reichweite; stechender Schmerz heißt
  auslassen.

**Zeichnungen (v5).** Tobi: „Mach Zeichnungen für die Sportübungen.“ Jede
Übung hat eine Strichfigur in der Seitenansicht (`js/figuren.js`), mit Stuhl,
Wand, Türrahmen, Stufe, Matte, Hantel, Schwungstäben, Schwingstab,
Wackelkissen oder Rad. Die Figur pendelt langsam zwischen Ausgangs- und
Endstellung (SVG-Animation, 4 s); mit „Bewegung reduzieren“ steht sie still in
der Ausgangsstellung. Nicht die drehbaren 3D-Figuren der Workout-App
(`js/figure.js`): Die kennen weder Schwungstäbe noch Schwingstab, Wackelkissen
oder Heimtrainer. Geprüft in `tests/test-mz-sport.mjs` (jede Übung hat eine,
alle Punkte im Bild, Geräte mitgezeichnet, still bei reduzierter Bewegung).

Geprüft in `tests/test-mz-sport.mjs` (Auswahl je Gerät und Beschwerde,
Hanteln, was dran ist, die Einheit mit Uhr im Browser, Gewicht anpassen,
Heimtrainer, 340 px).

## Lebenszeichen an Tobi (v6, 18.11.2026)

> Tobi: „Und hat er die app schon genutzt?“ – Rückwirkend ging das nicht:
> Bis v5 verließ nichts das Handy. Dann: „ich hab die app ja selbst nicht und
> brauch sie nicht aber wenn ich dich hier frage sollst dus mir sagen können“.

Die App meldet höchstens alle drei Stunden (beim Öffnen und beim Weglegen)
**nur Zahlen des Tages** an die Tabelle `mahlzeit_nutzung` in Tobis
Supabase-Projekt (`js/lebenszeichen.js`): Einträge, Hafer-Mahlzeiten,
Sporteinheiten, Werte, eigene Sachen, Tage mit Einträgen insgesamt, Fassung,
ob sie vom Startbildschirm läuft, und eine Zufallskennung des Geräts. Nie ein
Name, eine Kalorie, ein Gewicht oder ein Blutzucker. Die App darf nur
einfügen (öffentlicher Schlüssel, RLS), lesen kann nur der geheime Schlüssel
– also Claude über den Supabase-Zugang, wenn Tobi fragt:

    select tag, max(essen) essen, max(hafer) hafer, max(sport) sport, max(werte) werte,
           max(tage) tage_gesamt, bool_or(als_app) als_app, max(at) zuletzt
    from mahlzeit_nutzung where geraet <> 'testclaude01' group by tag order by tag desc;

Steht offen im Hallo und unter *Mehr → Lebenszeichen an Tobi*, dort
abschaltbar (`stand.meldung`). Ohne Netz kein Fehler; es wird beim nächsten
Öffnen noch einmal versucht. Geprüft in `tests/test-mz-lebenszeichen.mjs`.

## Was Uwe isst, geht an Tobi – nach seinem Ja (v14, 26.11.2026)

Tobi: „Ja ich will das essen auch sehen. In meiner Master übersicht“. Bis
v13 ging das Essen nicht mit („Mach Variante 2“), und in der App stand das
auch so: „Was du isst, geht nicht mit.“ Deshalb schickt die App das Essen
nicht einfach mit, sondern **fragt Uwe einmal**.

**Jetzt gilt:**
- **Die Frage:** auf „Heute“, oben: „🍽 Darf Tobi auch sehen, was du isst?“,
  dazu was dann geht (was, wie viel, die Kalorien, die letzten 60 Tage) und
  dass es unter „Mehr“ wieder abzustellen ist. Knöpfe „Ja, darf er“ und
  „Lieber nicht“.
- **Wann die Frage kommt:** einmal, nur wenn schon etwas eingetragen ist und
  nicht gleich neben dem „Hallo“. Nach einer Antwort nie wieder.
  Gespeichert in `stand.essenTeilen` (true/false; fehlt = noch nicht
  gefragt).
- **Was geht:** nach „Ja“ die Einträge der letzten 60 Tage, mit Tag,
  Tageszeit, Name, Portion, Menge, Kalorien, Kohlenhydraten und Eiweiß für den
  ganzen Eintrag (kcal × Menge) und ob es Hafer war (`essenFuerTobi()` in
  `js/lebenszeichen.js`).
- **Wohin:** an die Datenbankfunktion `mahlzeit_essen_melden`
  (`supabase/essen.sql`), die die 60 Tage je Gerät in `mahlzeit_essen`
  ersetzt. Die Tabelle hat RLS ohne Regeln; lesen kann nur Tobi, über
  `mahlzeit_lesen(pass)` (Meine Apps).
- **Wann:** sofort nach „Ja“, sonst wie die Werte beim Öffnen, beim Weglegen
  und bei `online`, und nur, wenn sich etwas geändert hat. Über 60 KiB geht
  es ohne `keepalive`, das Chrome sonst ablehnt.
- **Abstellen:** unter *Mehr → Lebenszeichen an Tobi* „Was du isst, an Tobi:
  ja / nein“. „nein“ (oder das Lebenszeichen ganz aus) schickt einmal eine
  leere Liste, dann ist bei Tobi auch nichts mehr davon.
- **Ohne Netz:** nichts als geschickt gemerkt; es kommt von selbst nach.
- **Texte in der App:** Die Karte unter *Mehr*, das „Hallo“ und „Über die
  App“ sagen, ob das Essen mitgeht.

Geprüft in `tests/test-mz-essen.mjs`:
- vor der Antwort nichts
- nach „Ja“ die 60 Tage mit Kalorien für den ganzen Eintrag
- Unverändertes nicht doppelt
- „nein“ löscht bei Tobi
- „Lieber nicht“ schickt nie etwas, und die Frage kommt nicht wieder
- ohne Netz nichts verloren
- Lebenszeichen aus heißt kein Essen (und einmal löschen, wenn vorher
  geschickt)
- ohne Einträge und neben dem „Hallo“ keine Frage
- die Texte

## Uwes Werte gehen an Tobi (v13, 25.11.2026)

Tobi fragte: „Kannst du sehen welche werte er einträgt?“ Bis dahin nicht, das
Lebenszeichen (v6) schickte nur Anzahlen. Zur Wahl standen nur die Art oder
die Werte selbst. Tobi: „Mach Variante 2“. Uwe ist einverstanden („Uwe
meinte ich kann all seine gesundheitsdaten haben“, 21.11.).

**Jetzt gilt:**
- **Was die App schickt:** Gewicht, Blutzucker (mit Uhrzeit und „wann“),
  HbA1c, Schlaf und Schritte der letzten 60 Tage, mit Datum und Herkunft (⌚
  von der Uhr). Was Uwe isst, geht nicht mit.
- **Wann:** an die Datenbankfunktion `mahlzeit_werte_melden`, beim Öffnen,
  beim Weglegen und beim Ereignis `online`, aber nur, wenn sich seit dem
  letzten Mal etwas geändert hat.
- **Wohin:** Die Funktion ersetzt die 60 Tage je Gerät in `mahlzeit_werte`,
  so kommen auch Löschungen an. Sie läuft als security definer, mit dem
  öffentlichen Schlüssel aufrufbar. Die Tabelle hat RLS ohne Regeln, lesen
  geht nur mit dem geheimen Schlüssel.
- **Ohne Netz:** Die App merkt sich nichts als „geschickt“ und schickt beim
  nächsten Mal nach.
- **Abschalten:** Derselbe Schalter wie beim Lebenszeichen (*Mehr →
  Lebenszeichen an Tobi*) stellt beides ab.
- **Texte in der App:** Die Karte unter *Mehr*, das „Hallo“ und „Über die
  App“ sagen jetzt, dass die Werte an Tobi gehen.

**Für Tobi nachsehen** (Supabase, SQL):

```sql
-- Uwes Werte (welches Gerät Uwe ist, steht seit v19 in mahlzeit_name)
select tag, art, wert, uhr, wann, quelle from public.mahlzeit_werte
where geraet = (select geraet from public.mahlzeit_name where name = 'Uwe')
order by tag desc, art;
-- Gewicht im Verlauf
select tag, wert as kg from public.mahlzeit_werte where art = 'gewicht' order by tag;
```

Einheiten: Gewicht in kg, Blutzucker in mg/dl, HbA1c in %, Schlaf in Minuten,
Schritte als Anzahl.

Geprüft in `tests/test-mz-lebenszeichen.mjs`:
- nur Werte, kein Essen, 60 Tage
- beim Öffnen geschickt, ohne Änderung kein zweites Mal
- ein neues Gewicht ersetzt das alte
- abgeschaltet geht nichts
- ohne Netz nichts verloren, bei `online` kommt es nach

## Uwe muss nichts eintippen, Tobi sieht, warum die KI nicht konnte (v12, 21.11.2026)

Tobi: „Statt ihn nach einem freischalt Code zu fragen soll in solchen
Situationen dort stehen dass er tobi bitten soll den freischalt Code zu
schicken. Er selbst soll generell so wenig wie möglich machen. Aber können
wir nicht auch mit loggen ob die ais zb alle überlastet waren?“

**Vorher:** Ohne Code stand dort „Die KI ist noch nicht freigeschaltet. Dafür
brauchst du den Code aus dem Link …“ mit einem Eingabefeld. In
`mahlzeit_ki` stand je Anfrage nur ok oder nicht ok.

**Freischalten, jetzt:**
- Der Kasten sagt **„Bitte Tobi, dir den Freischalt-Code zu schicken.“**
- **„📨 Tobi um den Code bitten“** öffnet das Teilen-Menü mit einer fertigen
  Nachricht an Tobi (sonst WhatsApp).
- **„📋 Code von Tobi einfügen“** holt den Code aus der Zwischenablage. Es
  reicht, Tobis Nachricht zu kopieren, ob Link oder Code (`codeAusText` in
  `js/ki.js`).
- Eintippen geht nur noch unter „Code eintippen“, zugeklappt.
- Ein Link allein hilft auf dem iPhone nicht: Er öffnet Safari, nicht die
  App vom Home-Bildschirm, und die hat ihren eigenen Speicher.
- Wird ein Code mitten im Gebrauch abgelehnt (401), vergisst die App ihn und
  sagt „Der Freischalt-Code gilt nicht mehr – bitte Tobi um einen neuen“.

**Protokoll, jetzt:** `mahlzeit_ki` hat drei neue Spalten:
- `grund`: ok, ueberlastet, kontingent, zeit, guthaben, schluessel,
  unlesbar oder fehler. Bei einem Fehlschlag zählt der Grund von Gemini,
  nicht der vom Claude-Ersatz ohne Guthaben.
- `versuche`: je versuchtes Modell `{modell, grund, ms}`.
- `ms`: wie lange die Anfrage gedauert hat.

Die Funktion ist dafür als Version 10 ausgeliefert.

**Für Tobi nachsehen** (Supabase, SQL):

```sql
-- Die letzten Anfragen: was, ob es ging, warum nicht, wie lange
select at, art, ok, grund, modell, round(ms / 1000.0) as sekunden,
       jsonb_path_query_array(versuche, '$[*].grund') as versuche
from public.mahlzeit_ki order by at desc limit 20;
-- Wie oft war alles überlastet (je Tag)?
select date(at) as tag, count(*) filter (where grund = 'ueberlastet') as ueberlastet, count(*) as alle
from public.mahlzeit_ki group by 1 order by 1 desc;
```

Geprüft:
- `tests/test-mz-ki.mjs`: Grund und Versuche bei Erfolg nach zwei
  Überlastungen und wenn alles überlastet ist, dazu `grundVon`.
- `tests/test-mz-scan.mjs`: Kasten, Teilen, Einfügen ohne und mit Code, der
  Code aus Tobis ganzer Nachricht, 401 im Gebrauch.
- `tests/test-mz-rechnen.mjs`: `codeAusText`.

## Gemini und Tavily statt Claude (v11, 21.11.2026)

Tobi: „Wir benutzen in der anderen app ja gemini und tavily. Können wir doch
hier auch machen“.

**Vorher:** Seit v3 rechnete Claude (Opus 5.5) Rezepte, Kochbuchseiten und
Packungen aus. Der Anthropic-Schlüssel ist der von amy-chat. Weil auf ihm
seit dem 17.11. kein Guthaben ist, hat v8 die KI mit einem festen Schalter
ausgeblendet.

**Jetzt:**
- **Gemini zuerst.** Die Funktion `mahlzeit-ki` (Version 4) fragt zuerst
  Gemini (`gemini-3.8-flash`, Interactions-API, `store: false`). Das ist
  gebaut wie in Boxenstopp (`js/ki.js`), mit dem Secret `GEMINI_API_KEY`.
  Gemini ist kostenlos, dafür darf Google die Anfragen zum Verbessern nutzen.
  Hin geht nur das Rezept, das Foto oder das Suchwort, nichts über Uwe. Das
  steht so auch unter *Mehr → KI und Strichcode*.
- **Claude nur noch als Ersatz,** wenn Gemini hakt und der Anthropic-Schlüssel
  Guthaben hat.
- **Neu: „🔎 Im Internet nachsehen“.** Der Knopf steht unter den Treffern der
  Suche („Nicht dabei?“). Tavily sucht nach „… Kalorien Nährwerte pro 100 g“
  (Secret `TAVILY_API_KEY`, wie bei rezept-web in Boxenstopp). Gemini liest
  aus den fünf Ergebnissen kcal, Kohlenhydrate und Eiweiß je 100 g und eine
  übliche Portion ab, mit Quelle („Laut fddb.info“). Gilt nur eine Adresse
  aus den Ergebnissen, keine ausgedachte.
- **Eiweiß** liefert die KI jetzt mit, bei Rezepten, Packungen und der Suche.
- **Kein fester Schalter mehr.** Die App fragt die Funktion per GET, was
  eingerichtet ist (`{ ki, gemini, claude, suche }`, nur ja/nein). Ist die
  KI an, fragt sie alle zwölf Stunden, sonst jede halbe Stunde. Maßgeblich
  ist Gemini: Der Anthropic-Schlüssel ohne Guthaben schaltet nichts ein.
  Sobald Tobi den Gemini-Schlüssel einträgt, erscheinen „Rezept oder Foto“
  und die Suche bei Uwe von selbst, ohne neue Fassung.

**Live geprüft am 21.11., nachdem Tobi die Schlüssel eingetragen hatte:**
- „Leberkäsbrötchen“: 264 kcal und 10,6 g Eiweiß je 100 g, 1 Brötchen mit
  190 g, Quelle arise-app.com, nach 29 s.
- Linseneintopf (Rezept): nach 45 s.

Davor sind zwei Dinge aufgefallen:
- **Gemini war überlastet** (503 „high demand“). Jetzt geht es reihum weiter
  mit 3.8 → 3.7 → 3.6 → 3.5 → 3.5-lite (`GEMINI_MODELLE`, dieselbe Liste wie
  in Boxenstopp). Das Modell, das zuletzt geantwortet hat, kommt zuerst dran.
  Ist alles überlastet, sagt die App „gerade überlastet, in ein paar Minuten
  noch einmal“ und nicht „Sag Tobi Bescheid“. Das kam vorher vom Claude-Ersatz
  ohne Guthaben.
- **Gemini dachte ohne Vorgabe über 40 s nach** und schickte bis dahin nur
  „keep-alive“. Jetzt gilt `thinking_level: "low"` (wie die Angebote in
  Boxenstopp). Kennt ein Modell die Vorgabe nicht, fragt die Funktion einmal
  ohne sie.

Dazu kommen Zeitgrenzen: 30 s je Modell, nach 75 s kein neuer Versuch. Den
Datenstrom liest die Funktion Stück für Stück und hört beim Ende-Ereignis
auf. Der Test-Code dafür („Claude-Test 21.11.“ in `mahlzeit_zugang`) ist
wieder abgeschaltet.

**Stand beim ersten Ausliefern (vorher):** GET gab `{"ki":false,"gemini":false,"claude":true,"suche":false}`
zurück. In Supabase fehlen also beide Secrets, Tobi muss sie eintragen:

1. https://aistudio.google.com/apikey → „API-Schlüssel erstellen“ → kopieren.
2. Supabase → Projekt „Finanzdienste's Project“ → *Edge Functions* →
   *Secrets* → *Add new secret* → Name `GEMINI_API_KEY`, Wert einfügen →
   *Save*.
3. Genauso `TAVILY_API_KEY` mit dem Schlüssel von https://app.tavily.com
   (Boxenstopp hat dafür einen).

Geprüft in `tests/test-mz-ki.mjs`:
- der Datenstrom von Gemini
- der Gemini-Rumpf
- die Reihenfolge Gemini vor Claude, das Gratis-Kontingent
- die Suche: Begriff, Ergebnisse, Quelle, nichts gefunden, Tavily-Kontingent,
  ohne Schlüssel
- GET, auch nur mit Anthropic-Schlüssel

In `tests/test-mz-scan.mjs`, Abschnitt 8:
- der Knopf „Im Internet nachsehen“
- das Ergebnis mit Quelle und Eiweiß
- KI an, Suche aus
- die KI erscheint, sobald die Funktion „eingerichtet“ meldet

## Die Uhr schickt Schlaf und Schritte selbst (v10, 21.11.2026)

Tobi: „Doch Uwe meinte ich kann all seine gesundheitsdaten haben“, und auf
die Wahl zwischen der Bezahl-App „Health Auto Export“ und einem eigenen
Kurzbefehl: „Ne lass weg 2 machen. Ich kann das ja auch auf Uwes Handy
einrichten. Er kann ja n Pop up bekommen ‚an dieser Stelle muss Tobi was an
deinem Handy einrichten‘“.

**Was vorher galt (v9):** Schlaf und Schritte tippte Uwe von der Uhr ab. Der
Weg über einen Server war ausgeschlossen, weil seine Gesundheitswerte nicht
bei Tobi liegen sollten. Uwe ist jetzt einverstanden.

**Jetzt gilt:**
1. Die Uhr gibt ihre Werte an Apple Health. Ein Kurzbefehl „Mahlzeit Uhr“
   liest daraus Schlaf und Schritte der letzten zwei Tage.
2. Er schickt sie an die Supabase-Funktion `mahlzeit-uhr`
   (`supabase/functions/mahlzeit-uhr/`, `verify_jwt` false), zweimal am Tag
   über Automationen um 09:30 und 21:30.
3. Sie stehen dann in `mahlzeit_uhr`: ein Wert je Schlüssel, Art und Tag; ein
   späterer Lauf ersetzt den Wert. Das Rohe kommt 14 Tage lang in
   `mahlzeit_uhr_eingang`. Beide Tabellen haben RLS ohne Regeln, nur die
   Funktion kommt heran.
4. Die App holt die Werte beim Öffnen und beim Zurückkommen ab, höchstens
   alle zehn Minuten (`js/uhr.js`). Unter *Werte* stehen sie mit ⌚. Was Uwe
   selbst eingetragen hat, bleibt stehen.

**Der Schlüssel** entsteht in der App: 20 zufällige Zeichen in `stand.uhr.k`.
Er zieht mit der Sicherung um, und die Adresse des Kurzbefehls enthält ihn.
Ohne Schlüssel gibt die Funktion nichts heraus, und eine fremde Seite
bekommt auch mit ihm nichts (CORS, 403).

**Der Hinweis an Uwe:** Auf dem iPhone steht auf der Startseite: „⌚ Schlaf
und Schritte von deiner Uhr … muss Tobi einmal einrichten – Tobi richtet
ein / Später“. „Später“ blendet ihn aus; unter *Mehr → Uhr* geht es
jederzeit. Die Ebene „Für Tobi: Uhr verbinden“ zeigt die Adresse mit dem
Knopf „Adresse kopieren“ und die Anleitung, Schritt für Schritt mit den
deutschen Namen der Kurzbefehle-App. Dazu kommt „Ist etwas angekommen?“, das
sofort nachsieht und sagt, was fehlt.

**Was der Kurzbefehl schickt:** JSON `{ schlaf, schritte }`, je eine Zeile
pro Health-Sample:
- Schlaf: `Wert|Startdatum|Enddatum`
- Schritte, nach Tag gruppiert: `Startdatum|Wert`

Am iPhone hat das hier niemand nachgeprüft. Deshalb liest die Funktion
großzügig:
- Die Felder dürfen in beliebiger Reihenfolge kommen.
- Datumsangaben gehen als ISO 8601 oder deutsch.
- Zahlen dürfen eine Einheit oder einen Tausenderpunkt haben.
- „Im Bett“ und „Wach“ zählen nicht mit.
- Wenn iPhone und Uhr dieselbe Nacht melden, wird sie nur einmal gezählt.
- Eine Nacht gehört zu dem Tag, an dem Uwe aufwacht.
- Fehlt die Uhrzeit, sagt die Antwort „Zeit einschließen anschalten“.

**Grenzen:**
- Ist das Handy zur Automationszeit gesperrt, gibt iOS Health nicht heraus.
  Dann holt der nächste Lauf nach, weil er immer zwei Tage schickt. Kommt
  trotzdem tagelang nichts: als Auslöser „App wird geöffnet“ nehmen (steht
  in der Anleitung).
- Ruhepuls, Gewicht und Blutzucker kommen noch nicht mit. Das wäre je ein
  weiterer Block im Kurzbefehl.

**Für Tobi nachsehen** (Supabase, SQL):

```sql
select art, tag, wert, at from public.mahlzeit_uhr
where geraet <> 'testclaudeuhr0000001' order by tag desc, art;
-- was zuletzt roh ankam, wenn etwas nicht stimmt:
select at, werte, left(roh, 400) from public.mahlzeit_uhr_eingang order by at desc limit 5;
```

Schlaf steht in Minuten (435 = 7 Std 15 Min). Die Zeile
`testclaudeuhr0000001` ist vom Test beim Ausliefern am 21.11.

Geprüft in `tests/test-mz-uhr.mjs`: Lesen in allen Formen, die Funktion mit
nachgebauter Datenbank, das Übernehmen in den Stand, und in der App der
Hinweis, die Anleitung, das Nachsehen, das Abholen beim Öffnen und das
Trennen.

## Schlaf und Schritte von der Uhr (v9, 21.11.2026)

Tobi: „Er hat Sone smart watch. Kann man deren Werte nicht mit unserer App
connecten? Zb schlaf“, dann „Dann lass doch ne richtige app aus unserer
machen“ – und: „Er hat ein iphone“.

**Warum nicht automatisch:** Die Werte der Uhr liegen auf dem iPhone in
Apple Health. Darauf kommt nur eine echte iPhone-App. Für die braucht man
einen Mac mit Xcode und ein Apple-Entwicklerkonto (99 € im Jahr), und
verteilt wird sie über TestFlight. Davon ist nichts da (Tobi hat Android).

Der Umweg über einen Kurzbefehl hilft auch nicht: Ein Link aus Kurzbefehle
öffnet Safari, nicht die App vom Home-Bildschirm. Die hat auf dem iPhone
einen eigenen Speicher (siehe v3, der Code zum Mitnehmen), die Werte kämen
also nicht bei Uwes Einträgen an. Bliebe nur ein Weg über einen Server –
dann lägen Uwes Gesundheitswerte bei Tobi, und das soll nicht sein
(„Alles bleibt auf deinem Handy“).

**Jetzt gilt:** Unter *Werte* gibt es zwei neue Karten:
- **„😴 Schlaf“:** morgens die Zahl von der Uhr eintragen. Die App liest
  „7:30“, „7,5“, „7 30“, „7h30“ und „7 Std 30 Min“ und speichert Minuten,
  ein Wert je Nacht.
- **„👟 Schritte“:** abends eintragen, „8.432“ mit Tausenderpunkt geht.

Ab drei Einträgen steht der Schnitt der letzten sieben da. Die App bewertet
nichts, wie bei allen Werten.

Bekommt Tobi einmal Zugang zu einem Mac und einem Entwicklerkonto, ist die
echte App der nächste Schritt (HealthKit, Schlafanalyse). Bis dahin ist das
hier der Weg.

Geprüft in `tests/test-mz-rechnen.mjs` (Lesen, Schnitt, `ordnen`) und
`tests/test-mz-bedienung.mjs` (Eintragen, Ersetzen, Unsinn abgelehnt).

## KI aus, solange kein Guthaben da ist (v8, 19.11.2026)

Tobi: „Der Kollege testet die app jetzt. Es muss also alles außer die ki
optimal sein. Lass den ki Teil rausnehmen solange ich kein api hab“.

Vorher (v3–v7) zeigte die App die KI überall: „✨ Rezept oder Foto“ unter
der Suche, die Karte „KI und Strichcode“ mit Freischalten unter *Mehr*, auf
dem iPhone „Strichcode fotografieren“ und bei einem unbekannten Strichcode
„Nährwerttabelle fotografieren“. Ohne Anthropic-Guthaben endete jedes davon
mit „Sag Tobi Bescheid“.

Jetzt gilt der Schalter `KI_AN = false` in `js/ki.js`: An der Stelle von
„Rezept oder Foto“ steht „✎ Selbst eintragen“. *Mehr* hat keine KI-Karte
mehr, der Text „Über die App“ nennt nur noch Open Food Facts. Auf dem iPhone
tippt man die Nummer unter dem Strichcode ein, und die Startbildschirm-Karte
nennt keinen Code. Ein Link mit `#ki=…` merkt den Code trotzdem still, damit
es später ohne neuen Link geht. Der Code der KI bleibt in der App, die
Supabase-Funktion bleibt ausgeliefert.

**Wieder einschalten**, wenn Guthaben da ist: `KI_AN = true`, `VERSION` und
`FASSUNG` hochzählen, einmal echt testen.

Die Tests der KI-Oberfläche laufen weiter mit `oeffne({ ki: true })` aus
`tests/mz-hilfe.mjs`, das `KI_AN` beim Ausliefern umschreibt. Geprüft in
`tests/test-mz-scan.mjs`, Abschnitt 7: KI aus, nichts davon sichtbar.

## Uwes Plan: Eiweiß, Rezepte, Studio (v7, 19.11.2026)

Tobi hat den Verlauf eines anderen KI-Chats geschickt, in dem Uwe sein
Frühstück (Overnight Oats) hat ausrechnen lassen und einen Plan bekam:
Bürojob, einmal die Woche Fitnessstudio an den Maschinen, einmal zu Hause mit Hanteln, dazwischen Heimtrainer; Eiweiß
150–165 g am Tag; vier Meal-Prep-Gerichte. Auf die Frage, was davon in die
App soll: „Alles“.

- **Eiweiß wird mitgezählt:** jede der rund 210 Sachen hat Eiweiß je
  Portion (`EIWEISS` in `js/lebensmittel.js`, Richtwerte wie die kcal);
  „Heute“ zeigt „davon etwa … g Kohlenhydrate · … g Eiweiß“, das Eintragen
  ebenso. Selbst eintragen hat ein Feld für Eiweiß, der Strichcode liest es
  aus Open Food Facts (`proteins_100g`). Die KI liefert es noch nicht (das
  Schema der Funktion kennt es nicht – beim nächsten Ausliefern nachziehen).
  **Kein Eiweißziel:** Unter *Mehr → Tagesziel* steht, viel Eiweiß vorher mit
  dem Arzt zu besprechen – bei Blutzuckerproblemen sollten die Nieren einmal
  angeschaut sein. Wie bei den Hafertagen: keine Zahl, die die App vorgibt.
- **Neuer Bereich „Rezepte & Meal Prep“:** Overnight Oats (385 kcal),
  mit Skyr (455) und mit Eiweißpulver (450), Hähnchen-Kartoffel-Blech (590),
  Rinder-Chili (620), Thunfisch-Nudel-Pfanne (580), Puten-Reis-Pfanne (560),
  Magerquark mit Beeren (230) – je Portion, mit den Werten aus seinem Plan.
- **Studio im Sport:** Gerät „Fitnessstudio“; dann eine eigene Einheit mit
  Ergometer, Beinpresse, Brustpresse, Latzug (bei Schulter/Nacken der
  Ruderzug), Ruderzug, Beinbeuger sitzend, Schulterdrücken an der Maschine –
  mit Zeichnungen. Die App schlägt einmal die Woche das Studio vor, die
  übrigen Male zu Hause; beides zählt als Kraft (nie zwei Tage
  hintereinander). An jeder Maschine ein Feld fürs Gewicht, das beim nächsten
  Mal schon dasteht.

Geprüft in `tests/test-mz-rechnen.mjs` und `tests/test-mz-sport.mjs`.

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

Alles in einem Schlüssel im localStorage des Handys, `mahlzeit.stand.v1`
(der KI-Code daneben in `mahlzeit.ki.v1`). Von sich aus geht nichts nach
draußen – kein Rückkanal, keine Zählung. Nur auf Tipp: die Nummer eines
Strichcodes an Open Food Facts, Rezepttext und Fotos an die KI (v3).

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
| `js/lebensmittel.js` | die Liste: Kennung, Name, Portion, kcal, Kohlenhydrate, Eiweiß, Bereich, Suchwörter, Tipp |
| `js/speicher.js` | localStorage, nur Schlüssel mit `mahlzeit.` |
| `js/strichcode.js` | Prüfziffer, Open Food Facts, Kamera (`BarcodeDetector`) |
| `js/figuren.js` | Strichfiguren der Sportübungen, Start- und Endstellung |
| `js/sport.js` | Sport: Übungen, Auswahl nach Geräten und Beschwerden, Hanteln, was heute dran ist |
| `js/ki.js` | Freischalt-Code, Anfrage an `mahlzeit-ki`, Fotos verkleinern |
| `supabase/functions/mahlzeit-ki/` | die Funktion: `handler.ts` (ohne Deno und SDK, in Node geprüft), `index.ts` (SDK und Datenbank) |
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
- `tests/test-mz-ki.mjs`, `tests/test-mz-scan.mjs`: KI und Strichcode (v3).
  Kein Test geht ins echte Netz – `mz-hilfe.mjs` sperrt Supabase und Open
  Food Facts, jeder Test baut sie nach.

`node tests/lauf.mjs test-mz-`

## Offen

- Die erste echte Auswertung, sobald das Anthropic-Guthaben aufgeladen ist.
