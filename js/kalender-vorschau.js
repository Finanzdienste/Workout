/*
 * Die Vorschau des Kalenders: was die App an jedem der nächsten Tage zeigen
 * würde, wenn bis dahin nicht trainiert wird – und dahinter ein Jahr Plan.
 *
 *     „Ja aber nur wenn es wirklich keinen Weg gibt wie verschoben wird auch
 *      wenn ich die app nicht öffne"
 *
 * Ohne Öffnen der App ändert sich der Plan nur dadurch, dass Tage vergehen.
 * Was die App am Tag d zeigen würde, ist deshalb schon heute bekannt – unter
 * der einen Annahme, dass bis dahin nicht trainiert wird. Genau das rechnet
 * diese Datei aus: für jeden der nächsten 42 Tage die Terminliste, die ein
 * frischer Start der App an diesem Tag ergäbe (tagNachziehen() in
 * js/tagstart.js, kalenderTermine() in js/kalender.js). Ein kleines Skript in
 * Tobis eigenem Google-Konto bekommt sie zugeschickt und gleicht seinen
 * Kalender „Workout" danach an – sofort und dann jede Stunde mit der Liste
 * für heute. Es rechnet nichts selbst; es wählt nur den Tag. Trainiert Tobi,
 * schickt die App eine neue Vorschau, und die alte ist überholt.
 *
 * **Je Tag ein frischer Start.** Jeder Tag beginnt mit demselben
 * Ausgangszustand (store.importJSON()), nicht mit dem des Vortags: Der
 * Kalender soll zeigen, was die App beim nächsten Öffnen *aus dem jetzigen
 * Stand* rechnet, und das ist per Definition ein Start, kein Fortschreiben.
 * Gemessen sind beide gleich (Prüfung „Pfadunabhängigkeit" in
 * tests/test-kalender-vorschau.mjs) – die Neusaat ist trotzdem die, die man
 * nicht beweisen muss.
 *
 * **Zu welcher Uhrzeit.** Die Uhr steht je Tag auf 0:05 – außer, die 3-Stunden-
 * Regel des Tagesabschlusses (LIEGT_AB_MS in js/store.js) greift später: Wer
 * bis 23:10 trainiert und die Einheit liegen lässt, dem schließt die App sie
 * erst ab 2:10 ab. Um 0:05 gerechnet, stünde sie im Kalender den ganzen
 * nächsten Tag offen, samt der Nacharbeit, die erst der Abschluss verteilt
 * (gemessen bei der Prüfung des Entwurfs: um 0:05 offen, um 12:00
 * abgeschlossen). Deshalb max(0:05, letztes Lebenszeichen + 3 h + 1 min), und
 * nie über 23:59 hinaus – sonst gehörte die Rechnung zum nächsten Tag. Für
 * heute gilt die echte Uhrzeit, mit derselben Untergrenze: Die Liste für heute
 * gilt im Kalender den ganzen Tag, und um 0:30 gerechnet stünde dort sonst
 * eine Einheit von gestern offen, die die App um 2:10 abschließt. Die
 * Uhrzeit wirkt nur über diese Regel; Nachrücken, Runde und Zusatztag hängen
 * am Tag allein.
 *
 * **Die Ferne – ein Jahr statt vier Wochen.**
 *
 *     „Klappt alles aber bisschen wenig Termine. Lass doch mal ein Jahr
 *      machen"
 *
 * Bis v245 stand je Tag d nur, was von d − 7 bis d + 28 liegt (die Nähe).
 * Die bleibt genau so. Dahinter, bis d + 365, steht jetzt die Ferne: die
 * Einheiten so, wie die App sie zeigen würde, wenn Tobi ab d nach Plan
 * trainiert – der Rest der laufenden Runde an seinen Tagen, und über ihr Ende
 * hinaus die nächsten Runden, so wie rundeWeiter() in js/tagstart.js sie
 * anlegt: Workout 1 im üblichen Abstand nach der letzten Einheit
 * (naechsteRundeAb()), Kennung <fokus>-<runde+1>-<n>, Übungen mit den
 * Einstellungen von heute (Stufe, Modus, Beschwerden, Termine). Gerechnet mit
 * den Funktionen der App – store.restartPlan() spielt das Rundenende, dann
 * kalenderTermine() –, nicht mit einem Nachbau, und nur hier im Worker, wo
 * der Zustand je Tag frisch gesät wird (fernTermine()).
 *
 * Das ist eine Schätzung, und so wird es behandelt: Steigt Tobi in der
 * nächsten Runde auf eine andere Stufe, wechselt den Fokus oder trägt einen
 * Termin ein, sieht sie anders aus. Je näher sie rückt, desto mehr wird aus
 * ihr die Nähe, und die stimmt. Endet die Runde innerhalb der nächsten vier
 * Wochen, stehen deren erste Einheiten nach der letzten schon im Kalender –
 * die Nähe kennt die nächste Runde erst, wenn sie da ist, und dazwischen
 * stünde sonst eine Lücke von bis zu vier Wochen.
 *
 * **Kompakt.** 42 Tage zu je rund 200 Terminen wären über 8000 Einträge. Aber
 * zwischen zwei Tagen verschiebt sich die Ferne fast immer als Ganzes:
 * catchUpPlan() schiebt den ganzen Rest, und die nächsten Runden hängen an
 * der letzten Einheit. Darum stehen in der Sendung wenige Referenzlisten
 * (Tage als Zahl ab `ab`, nicht als Datum) und je Tag nur: welche Liste, um
 * wie viele Tage verschoben, und was dann noch anders ist (ein Termin in der
 * Ferne trifft genau die Einheit, die gerade auf seinem Tag liegt). Ob das
 * stimmt, wird nicht angenommen, sondern je Tag geprüft: Die echte Fernliste
 * des Tages muss genau herauskommen (ferneBauen()); wo keine Liste mit
 * wenigen Änderungen passt oder die Probe nicht aufgeht, wird die Fernliste
 * dieses Tages selbst eine neue Referenz. Wird die Sendung trotzdem zu groß,
 * wird die Ferne kürzer, nicht die Sendung abgewiesen – und das steht in
 * `gekuerzt`. Scheitert die Ferne ganz (ein Fehler beim Rechnen), geht die
 * Nähe allein hinaus, als v 1: Das Skript gleicht die vier Wochen an und
 * lässt das Jahr dahinter stehen, wie es ist – `fernFehler` sagt es. Die
 * Ferne darf das Senden nie aufhalten.
 *
 * **Wo.** Nie im Fenster der App: Dort teilten sich diese Module mit ihr den
 * Zustand, und importJSON() ersetzte das echte Training – deshalb bricht
 * vorschauRechnen() dort ab, bevor es etwas anfasst. Ein Modul-Worker hat
 * eigene Modulinstanzen, keinen echten Speicher und keine Seite
 * (js/kalender-worker.js); Node ebenso (die Tests). Den Speicher ersetzt hier
 * eine Map, die Uhr eine Unterklasse von Date – beides vor dem ersten Import,
 * weil js/data.js und js/store.js den Speicher beim Laden lesen. Darum lädt
 * dieses Modul die anderen erst beim ersten Rechnen und importiert beim Laden
 * nichts. Gemessen: siehe README („Google Kalender automatisch").
 *
 * ------------------------------------------------------------------------
 * Der Vertrag zwischen App und Skript, Fassung 2 (VORSCHAU_V)
 * ------------------------------------------------------------------------
 *
 * Hier steht er einmal, für beide Seiten: die App sendet so (dieses Modul),
 * das Skript in Tobis Google-Konto nimmt so an. Die Regeln, die beide
 * auswerten, stehen unten als Funktionen (nutzlastPruefen(),
 * sendungVergleichen(), vorschauFuer(), fernListe(), bleibtStehen()) – das
 * Skript übernimmt sie Zeile für Zeile, tests/test-kalender-vorschau.mjs und
 * tests/test-kalender-gas.mjs halten sie fest.
 *
 * **Zwei Fassungen.** Fassung 1 (v245) kennt nur die Nähe, Fassung 2 dazu die
 * Ferne. Die App schickt v 2, sobald das Skript in einer lesbaren Antwort
 * `version` 2 oder höher meldet, sonst v 1 – unbekannt heißt 1; es zählt die
 * letzte lesbare Antwort (jede Antwort trägt `version`, auch eine Ablehnung).
 * So läuft ein Skript der Fassung 1 weiter, bis Tobi den neuen Code einfügt;
 * danach merkt die App es an der nächsten Antwort (oder einer Probe, mit der
 * sie nachfragt, solange neuer Code aussteht) und schickt die Ferne. Weist
 * ein Skript eine v 2 zurück („format", `version` 1 – etwa wenn der alte Code
 * wieder bereitgestellt ist), schickt die App dieselbe Vorschau gleich als
 * v 1. Ein Skript der Fassung 2 nimmt v 1 und v 2 an; Probe und „aus" gehen
 * immer als v 1, die versteht jede Fassung gleich.
 *
 * **Die Sendung.** Ein einfacher POST an die Web-App-Adresse (…/exec):
 * Body = JSON.stringify(nutzlast), Content-Type „text/plain;charset=utf-8",
 * keine eigenen Header, credentials 'omit', redirect 'follow'. Apps Script
 * beantwortet kein OPTIONS – jede andere Form löste einen Preflight aus und
 * käme nie an. Idempotent: Dieselbe Sendung zweimal ändert beim zweiten Mal
 * nichts. Höchstens VORSCHAU_MAX_BYTES (64 KiB) bei v 1 – so viel nimmt ein
 * Skript der Fassung 1 –, VORSCHAU_MAX_BYTES_2 (192 KiB) bei v 2. Die 64 KiB
 * sind die Grenze für keepalive beim Wegschalten; eine größere Sendung geht
 * dort über den Service Worker (js/kalender-sync.js). Die 192 KiB kommen vom
 * Speicher des Skripts: 500 KB Skript-Eigenschaften insgesamt, und beim
 * Speichern stehen die alte und die neue Sendung kurz nebeneinander.
 *
 *   v           1 oder 2 (siehe oben)
 *   token       das Kennwort dieses Kalenders, 16–128 Zeichen [A-Za-z0-9_-].
 *               Steht so im Skript (Platzhalter in der Vorlage) und in der App,
 *               sonst nirgends – nie in einer Antwort, nie im Diagnoseprotokoll
 *   geraet      zufällige Kennung des sendenden Geräts, 4–64 Zeichen
 *               [A-Za-z0-9_-]. Bleibt auf dem Gerät – nicht in Sicherung und
 *               Export (wie deviceId) und nicht die Kennung der Telemetrie –,
 *               sonst sähe ein neues Handy für das Skript aus wie das alte
 *   seq         zählt je Gerät bei jeder Sendung hoch (ganze Zahl ≥ 0)
 *   gesendet    Zeitpunkt der Sendung, ms seit 1970 (UTC)
 *   app         Fassung der App, z. B. "v246" – nur zur Anzeige (darf fehlen)
 *   minuten     Beginn, Minuten nach Mitternacht in Europe/Berlin: 0–1439,
 *               Standard 1050 = 17:30 (KALENDER_MINUTEN in js/kalender.js).
 *               Die Uhrzeit rechnet das Skript selbst aus Tag und Minuten
 *               (Utilities.parseDate(…, 'Europe/Berlin', 'yyyy-MM-dd HH:mm')),
 *               damit sie über die Zeitumstellung hinweg stimmt
 *   erinnerung  Popup-Erinnerung so viele Minuten vorher: 0–1440, Standard 30
 *               (KALENDER_ERINNERUNG), 0 = keine
 *   ab          der erste Tag der Vorschau (ISO, Ortszeit des Geräts)
 *   fenster     [zurueck, voraus] in Tagen, je 0–60: Die Liste eines Tages d
 *               in `tage` enthält die Termine von d − zurueck bis d + voraus
 *               (Standard [7, 28]) – die Nähe
 *   stand       der Trainingsstand des Geräts (trainingsStand()):
 *               { einheiten, saetze, zuletzt } – abgeschlossene Planeinheiten,
 *               abgehakte Sätze und das letzte Lebenszeichen einer Einheit
 *               (ms, 0 = keins bekannt), alle drei über alle Runden, auch
 *               abgelegte und die anderer Fokusse
 *   texte       { <hash>: [titel, beschreibung] } – jeder Text einmal, für
 *               Nähe und Ferne (Schlüssel [0-9a-z]{1,12}, Titel ≤ 200,
 *               Beschreibung ≤ 4000 Zeichen, höchstens 500 Texte bei v 1,
 *               3000 bei v 2)
 *   tage        { "JJJJ-MM-TT": [[kennung, datum, dauer, hash, fertig], …] } –
 *               je Tag der Vorschau (höchstens 60) die Termine seiner Nähe,
 *               nach datum sortiert: kennung (KENNUNG in js/kalender.js), datum
 *               (ISO), dauer (Minuten, 1–600), hash (Schlüssel in texte),
 *               fertig (1 abgeschlossen, 0 offen)
 *   ferne       nur bei v 2, dort Pflicht: { bis, listen, tage }
 *               bis     so weit reicht die Liste eines Tages d: bis d + bis
 *                       (fenster[1] bis 400, Standard 365; kleiner, wenn die
 *                       App kürzen musste – dann ist bis = fenster[1] und die
 *                       Ferne leer möglich)
 *               listen  Referenzlisten, höchstens 60, je höchstens 600
 *                       Einträge: [[kennung, t, dauer, hash, fertig], …] –
 *                       wie ein Eintrag in `tage`, nur t statt datum: der Tag
 *                       als Zahl, Tage nach ab (0–2000)
 *               tage    je Tag der Vorschau ein Satz, in der Reihenfolge ab,
 *                       ab + 1, …: [r, v] oder [r, v, weg, dazu] – die Liste
 *                       listen[r], jeder Tag um v verschoben (−1000 bis
 *                       1000); weg: Kennungen, die herausfallen; dazu:
 *                       Einträge wie in listen (t ohne Versatz), die
 *                       hinzukommen oder einen gleichnamigen ersetzen
 *               Die Ferne des Tages d (fernListe()): listen[r] um v
 *               verschoben, ohne weg und ohne die von dazu ersetzten, mit
 *               dazu – davon alles mit t nach d bis d + bis, dessen Kennung
 *               nicht schon in tage[d] steht. Die ganze Liste des Tages d ist
 *               tage[d] und dahinter seine Ferne.
 *
 * Zwei Sonderformen, nur mit v, token, geraet, seq, gesendet:
 *   probe: true   „Verbinden": nichts speichern, nur antworten
 *   aus: true     „Abschalten": eigene Termine ab heute löschen, nichts mehr
 *                 angleichen, bis wieder eine Vorschau kommt
 *
 * **Wer gilt** (sendungVergleichen()). Dasselbe Gerät mit späterer Sendung
 * (höheres seq oder späteres gesendet) gilt immer – auch nach einer
 * eingelesenen älteren Sicherung, denn dann zeigt die App deren Stand. Eine
 * frühere Sendung desselben Geräts (eine verspätete Wiederholung) ist
 * überholt. Ein anderes Gerät gilt, wenn es zuletzt trainiert hat (stand.
 * zuletzt später, über alle Runden – sonst stünde das Handy am Morgen nach
 * dem Rundenende mit 0 da), bei gleichem Lebenszeichen mit mindestens so
 * vielen Einheiten, dann Sätzen. Nicht „die neueste Sendung gewinnt": Ein Tablet,
 * das seit zwei Wochen in der Schublade lag, rückt beim Öffnen nach, sendet
 * frisch – und hätte damit den Kalender des Handys überschrieben, mit dem
 * seitdem trainiert wird. Umgekehrt braucht ein neues Handy keinen Knopf
 * („Trotzdem übernehmen"): Mit dem ersten Satz dort ist es das Gerät, das
 * zuletzt trainiert hat. Die Fassung spielt dabei keine Rolle.
 *
 * **Welcher Tag gilt** (vorschauFuer()). tage[heute], heute in Europe/Berlin
 * (Utilities.formatDate(new Date(), 'Europe/Berlin', 'yyyy-MM-dd') – 'yyyy',
 * nicht 'YYYY', das Wochenjahr), sonst der letzte Tag davor. Liegt heute vor
 * jedem Tag der Vorschau, nichts ändern. Ist sie aufgebraucht (heute nach
 * dem letzten Tag), nichts mehr verschieben und es ehrlich sagen: Die App war
 * seit sechs Wochen nicht mit Netz offen.
 *
 * **Was das Skript mit der Liste macht.** Je Eintrag ein Termin im eigenen
 * Kalender, wiedergefunden über die Kennung (ein Merkmal am Termin, nie über
 * den Titel): Beginn am datum um minuten in Europe/Berlin, Ende dauer
 * Minuten später, Titel texte[hash][0] – bei fertig mit „✓ " davor –,
 * Beschreibung texte[hash][1], die Erinnerung nur an offenen. Das Fenster
 * reicht von heute − fenster[0] bis heute + ferne.bis (v 1: + fenster[1]).
 * Ein eigener Termin im Fenster, dessen Kennung in der Liste fehlt
 * (bleibtStehen()):
 *   - nach heute: kommt weg. Die Einheit ist dort leer (ein Termin schont
 *     alles), gehört zu keinem Plan mehr, oder ein unberührter Zusatztag
 *     steckt jetzt in der Einheit des Tages.
 *   - heute oder davor, aus derselben Runde wie ein Eintrag der Liste (der
 *     Anfang der Kennung, <fokus>-<runde>, kommt dort vor): kommt weg – heute
 *     eine leere Einheit, davor ein Zusatztag, der allein an einem Ruhetag
 *     stand, nie gemacht wurde und dann in eine Einheit wanderte; was gemacht
 *     ist, steht in der Liste.
 *   - heute oder davor, aus einer Runde desselben Fokus, die nach einer Runde
 *     der Liste kommt: kommt weg. Das war eine Schätzung der Ferne, die nicht
 *     eintraf.
 *   - heute oder davor, sonst (eine frühere Runde, ein anderer Fokus): bleibt
 *     stehen. Das ist Verlauf – die Liste kennt nur die laufende Runde und
 *     die kommenden (kalenderTermine()), und die letzte Einheit einer
 *     abgelegten Runde gehört in den Kalender, auch an dem Tag, an dem die
 *     Runde weiterrollt (bis v245 kam sie dann weg, weil sie „heute" lag).
 * Hinter dem Fenster, bis heute + 400: Bei v 2 kommt ein eigener Termin dort
 * weg – die App hat die Ferne gekürzt, und was dahinter steht, ist durch
 * nichts mehr gedeckt. Bei v 1 bleibt er (eine Sendung im alten Vertrag, etwa
 * von einem Gerät mit älterer App, kennt die Ferne nicht); kommt er näher,
 * gleicht ihn die Liste an. Termine ohne Kennung (von Hand, eine eingelesene
 * Kalenderdatei) bleiben, wie sie sind. Ein Skript, das noch keine Vorschau
 * angenommen hat, fasst den Kalender gar nicht an – ein zweites, vergessenes
 * Projekt räumt so nicht im Kalender des ersten herum.
 *
 * **Die Antwort** ist immer JSON (ContentService), auch bei jedem Fehler –
 * sonst sieht die App nur einen CORS-Fehler und kann nicht sagen, was los ist:
 *
 *   ok          true, wenn die Sendung angenommen ist oder schon da war
 *   code        'angekommen' | 'gleich' (dieselbe Sendung schon da) |
 *               'probe' | 'aus' – mit ok true;
 *               'token' | 'format' | 'alt' (frühere Sendung desselben
 *               Geräts) | 'aelter' (ein anderes Gerät hat zuletzt trainiert) |
 *               'fehler' – mit ok false
 *   version     Fassung des Skripts (ganze Zahl) – daran wählt die App v 1
 *               oder v 2, und ist sie älter als die Vorlage, bittet die App
 *               um neuen Code
 *   kalender    Name des Kalenders ("Workout") – keine ID, keine Adresse
 *   tag         der Tag, dessen Liste eben angeglichen wurde, oder null
 *   geaendert   Zahl der Änderungen im Kalender bei diesem Abgleich, oder null
 *   offen       Fassung 2: so viele Änderungen sind noch offen (das Skript
 *               holt sie in den nächsten Läufen nach), oder null
 *   bis         Fassung 2: bis zu diesem Tag (ISO) reicht die Liste, die eben
 *               galt, oder null
 *   stehen      Fassung 2: bis zu diesem Tag (ISO) steht der Kalender schon
 *               ganz wie die Liste – gleich `bis`, wenn nichts offen ist;
 *               null, solange heute oder morgen noch etwas fehlt. Daran sagt
 *               die App, was im Kalender steht, solange das Skript das Jahr
 *               noch einträgt (bei der Probe: vom letzten Abgleich)
 *   folge       Fassung 2, nur wenn etwas offen ist: true – der Rest kommt in
 *               ein paar Minuten (ein einmaliger Auslöser), false – mit dem
 *               nächsten stündlichen Abgleich (Google bremst, kleiner Rest);
 *               sonst null
 *   morgen      Fassung 2, nur wenn etwas offen ist: true – Google lässt heute
 *               keine Änderungen mehr zu (Tageskontingent), der Rest kommt
 *               morgen (folge ist dann false); sonst false, null, wenn nichts
 *               offen ist (bei der Probe: vom letzten Abgleich)
 *   stand, seq  was jetzt gilt (bei 'alt' und 'aelter' das Gespeicherte)
 *   hinweis     ein kurzer Satz zum Anzeigen (darf fehlen)
 *
 * Die App darf sich auf die Antwort nicht verlassen: Ob sie lesbar ist
 * (Weiterleitung über script.googleusercontent.com), ist auf jedem Gerät
 * einmal zu prüfen. Ist sie es nicht, zeigt die App „gesendet um …".
 */

/** Die neueste Fassung des Vertrags; die App spricht auch 1 (siehe oben). */
export const VORSCHAU_V = 2;
/** So viele Tage reicht eine Vorschau – sechs Wochen ohne Öffnen. */
export const VORSCHAU_TAGE = 42;
/** Das Fenster einer Tagesliste (die Nähe): so viele Tage zurück und voraus. */
export const VORSCHAU_ZURUECK = 7;
export const VORSCHAU_VORAUS = 28;
/** So weit reicht die Ferne eines Tages: ein Jahr. */
export const VORSCHAU_FERNE = 365;
/** Weiter nie – auch nicht nach Vertrag. */
export const FERNE_MAX = 400;
/** Fassung 1, und die Grenze für keepalive (Fetch-Spezifikation): 64 KiB. */
export const VORSCHAU_MAX_BYTES = 64 * 1024;
/** Fassung 2: 192 KiB – zweimal davon passt mit Luft in 500 KB Skript-Eigenschaften. */
export const VORSCHAU_MAX_BYTES_2 = 192 * 1024;

const TAG = /^\d{4}-\d{2}-\d{2}$/;
const ZEICHEN = /^[A-Za-z0-9_-]+$/;
const MINUTE = 60 * 1000;
// Mehr Änderungen an einer Referenzliste als diese lohnen nicht – dann wird
// die Fernliste des Tages selbst eine neue Referenz.
const FLICKEN_MAX = 24;
// Platz für die Felder, die erst nutzlastBauen() dazulegt (token, geraet, …).
const RESERVE_BYTES = 1024;

/* ------------------------------------------------------------------ *
 * Speicher und Uhr – nur für die eigenen Module
 * ------------------------------------------------------------------ */

// Die echte Uhr, beim Laden dieser Datei festgehalten – vor jeder Vorschauuhr.
const EchteUhr = Date;
let geladen = null;
let uhrMs = 0;

function speicherErsatz() {
  const mem = new Map();
  return {
    getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => { mem.set(String(k), String(v)); },
    removeItem: (k) => { mem.delete(k); },
    clear: () => mem.clear(),
    key: (i) => [...mem.keys()][i] ?? null,
    get length() { return mem.size; },
  };
}

/** Die Uhr auf `ms` stellen: `new Date()` und Date.now() geben ab jetzt diesen Zeitpunkt. */
class Vorschauuhr extends EchteUhr {
  constructor(...a) {
    if (a.length) super(...a);
    else super(uhrMs);
  }

  static now() { return uhrMs; }
}

function uhrStellen(ms) {
  uhrMs = ms;
  globalThis.Date = Vorschauuhr;
}

function uhrZurueck() {
  globalThis.Date = EchteUhr;
}

/** Der Plan, den js/data.js für diesen Zustand wählen würde (AKTIV dort). */
function planFuer(D, zustand) {
  const key = zustand && zustand.focus;
  if (D.PLANS[key]) return D.PLANS[key];
  const ersatz = D.FOKUS_ERSATZ[key];
  return (ersatz && D.PLANS[ersatz.nach]) || D.PLANS.standard;
}

/**
 * Die Module laden – einmal je Worker oder Prozess, mit dem Zustand als
 * Speicherinhalt. Danach kennt der Modulsatz genau einen Plan: den, den
 * js/data.js beim Laden gewählt hat. Ein Zustand mit anderem Fokus braucht
 * einen frischen Worker (Fehler `fokus`).
 */
async function laden(text, zustand) {
  if (!geladen) {
    const speicher = speicherErsatz();
    Object.defineProperty(globalThis, 'localStorage', { value: speicher, configurable: true, writable: true });
    speicher.setItem('workout.state.v1', text);
    const [store, data, plan, dates, tagstart, kalender] = await Promise.all([
      import('./store.js'), import('./data.js'), import('./plan.js'), import('./dates.js'),
      import('./tagstart.js'), import('./kalender.js'),
    ]);
    geladen = { store, data, plan, dates, tagstart, kalender };
  }
  if (planFuer(geladen.data, zustand) !== geladen.data.FOCUS) {
    const e = new Error('kalender-vorschau: anderer Fokus als beim Laden – neuer Worker nötig');
    e.code = 'fokus';
    throw e;
  }
  return geladen;
}

/* ------------------------------------------------------------------ *
 * Kleine Rechnungen mit Tagen – ohne Uhr, also ohne Zeitumstellung
 * ------------------------------------------------------------------ */

/** Ortszeit eines Tages um hh:mm, in ms – über die Bestandteile, also über die Zeitumstellung hinweg richtig. */
function amTag(iso, h, m) {
  const [y, mo, d] = iso.split('-').map(Number);
  return new EchteUhr(y, mo - 1, d, h, m).getTime();
}

/** Der Tag eines Zeitpunkts in Ortszeit (ISO). */
function tagVon(ms) {
  const d = new EchteUhr(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const utc = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return EchteUhr.UTC(y, m - 1, d);
};

/** Ganze Tage von `a` bis `b` (ISO), positiv, wenn b später liegt. */
export function tageZwischen(a, b) {
  return Math.round((utc(b) - utc(a)) / 86400000);
}

/** ISO-Tag plus k Tage. */
export function plusTage(iso, k) {
  return new EchteUhr(utc(iso) + k * 86400000).toISOString().slice(0, 10);
}

/** Text → kurzer Schlüssel (FNV-1a, 32 Bit, Basis 36). */
function textHash(titel, beschreibung) {
  let h = 0x811c9dc5;
  const s = `${titel}\u0000${beschreibung}`;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

/** Rang einer Kennung innerhalb eines Tages: die Nummer der Einheit, ein Zusatztag dahinter. */
function kennungRang(k) {
  const m = /-(z?)(\d+)$/.exec(k);
  return m && !m[1] ? Number(m[2]) : 1e6;
}

/** Sortiert Einträge [kennung, tag, …] wie kalenderTermine(): Tag, Nummer, Kennung. */
function nachTag(a, b) {
  if (a[1] !== b[1]) return a[1] < b[1] ? -1 : 1;
  const r = kennungRang(a[0]) - kennungRang(b[0]);
  if (r) return r;
  if (a[0] === b[0]) return 0;
  return a[0] < b[0] ? -1 : 1;
}

/**
 * Der Trainingsstand eines Zustands: abgeschlossene Planeinheiten und
 * abgehakte Sätze über alle Runden (laufende und abgelegte), dazu das letzte
 * Lebenszeichen – auch das über alle Runden. Gezählt wird, was das Gerät weiß
 * – nicht, was der Tagesabschluss gleich daraus macht.
 *
 * `zuletzt` ist das Lebenszeichen des laufenden Protokolls (store.
 * lebenszeichen(), samt Uhr der Sitzung). Dazu kommt das jüngste `zuletzt`
 * der abgelegten Runden: Nach dem Rundenende ist das Protokoll leer, nach
 * einem Fokuswechsel steht dort der ältere Verlauf des Ziel-Fokus. Allein
 * gezählt, meldete das Handy am Morgen nach Workout 84 „nie trainiert" – und
 * ein Tablet aus der Schublade überholte es in der Regel „Wer gilt" still
 * (gemessen bei der Prüfung). Werte aus der Zukunft (eine Sicherung von einem
 * Gerät mit falsch gehender Uhr) zählen wie in js/store.js nicht.
 */
export function trainingsStand(zustand, zuletzt = 0, jetzt = Date.now()) {
  let einheiten = 0;
  let saetze = 0;
  let spaetestens = Math.max(0, Math.round(Number(zuletzt) || 0));
  const zaehle = (log, abgelegt) => Object.entries(log || {}).forEach(([k, e]) => {
    if (!e || typeof e !== 'object') return;
    if (/^\d+$/.test(k) && e.done) einheiten += 1;
    ['db', 'bw'].forEach((m) => Object.values(e[m] || {}).forEach((arr) => {
      if (Array.isArray(arr)) saetze += arr.filter((x) => x && x.done).length;
    }));
    const t = e.zuletzt;
    if (abgelegt && Number.isFinite(t) && t > 0 && t <= jetzt + MINUTE) spaetestens = Math.max(spaetestens, Math.round(t));
  });
  (Array.isArray(zustand.rounds) ? zustand.rounds : []).forEach((r) => zaehle(r && r.log, true));
  zaehle(zustand.log, false);
  return { einheiten, saetze, zuletzt: spaetestens };
}

/* ------------------------------------------------------------------ *
 * Die Rechnung
 * ------------------------------------------------------------------ */

/**
 * Die Vorschau rechnen – nur im Worker oder in Node (siehe oben).
 *
 *   zustand   der Zustand der App (store.getState() oder exportJSON()-Text),
 *             so wie er nach ihrem eigenen Start dasteht
 *   jetzt     die echte Uhrzeit (ms); Standard Date.now()
 *   tage      wie viele Tage ab heute (VORSCHAU_TAGE)
 *   zurueck, voraus   das Fenster je Tag (VORSCHAU_ZURUECK, VORSCHAU_VORAUS)
 *   wartet    abschlussWartetAm() der App: Hat ihr Start heute mit einem
 *             Planumbau begonnen, schließt sie heute nichts ab – die Vorschau
 *             für heute dann auch nicht
 *   ferne     so weit reicht die Ferne je Tag (VORSCHAU_FERNE); 0 = keine
 *             Ferne (für ein Skript der Fassung 1 – dann gar nicht rechnen)
 *   maxBytes  so groß darf die Nutzlast werden (VORSCHAU_MAX_BYTES_2); wird
 *             sie größer, wird die Ferne kürzer
 *
 * Gibt { v, ab, fenster, stand, texte, tage, ferne, gekuerzt, fernFehler,
 * zeiten, ms, fernMs } zurück – den Teil der Nutzlast, der aus der Rechnung
 * kommt (nutzlastBauen() legt den Rest dazu). `ferne` nur, wenn gerechnet;
 * `gekuerzt`: so viele Tage reicht die Ferne statt der gewünschten, oder null;
 * `fernFehler`: die Ferne ließ sich nicht rechnen (ein kurzer Grund, ohne
 * Kennwort und Adresse – die kennt die Rechnung nicht) – dann ist es eine
 * Vorschau der Fassung 1, die Nähe allein. Nur zum Nachsehen: `zeiten` (je
 * Tag die Uhrzeit, zu der gerechnet wurde, ms), `ms` (wie lange die Rechnung
 * gedauert hat) und `fernMs` (davon die Ferne).
 */
export function vorschauRechnen(zustand, optionen = {}) {
  // Nacheinander, nie verschränkt: Uhr und Speicher gibt es hier einmal.
  const lauf = kette.then(() => rechnen(zustand, optionen));
  kette = lauf.catch(() => {});
  return lauf;
}
let kette = Promise.resolve();

async function rechnen(zustand, {
  jetzt = Date.now(), tage = VORSCHAU_TAGE, zurueck = VORSCHAU_ZURUECK, voraus = VORSCHAU_VORAUS, wartet = null,
  ferne = 0, maxBytes = VORSCHAU_MAX_BYTES_2,
} = {}) {
  // Zuerst, vor Uhr und Speicher: Im Fenster bleibt alles, wie es ist.
  if (typeof document !== 'undefined') {
    throw new Error('kalender-vorschau: nur in einem Worker oder in Node – im Fenster der App '
      + 'teilten sich diese Module den Zustand mit ihr');
  }
  const text = typeof zustand === 'string' ? zustand : JSON.stringify(zustand);
  const roh = typeof zustand === 'string' ? JSON.parse(zustand) : zustand;
  if (!Number.isFinite(jetzt)) throw new Error('kalender-vorschau: jetzt fehlt');
  const weit = ferne ? Math.max(voraus, Math.min(FERNE_MAX, Math.round(Number(ferne) || 0))) : 0;
  const start = EchteUhr.now();
  let fernMs = 0;
  uhrStellen(jetzt);
  try {
    const m = await laden(text, roh);
    const { store, dates, tagstart, kalender } = m;
    const ab = tagVon(jetzt);
    // Das letzte Lebenszeichen im Ausgangszustand – daran hängt die 3-Stunden-Regel.
    // Nur das laufende Protokoll: Eine abgelegte Runde schließt der Tagesabschluss
    // nicht mehr ab. Für „Wer gilt" zählen alle Runden (trainingsStand()).
    store.importJSON(text);
    const s0 = store.getState();
    const zuletzt = Object.keys(s0.log || {}).reduce((x, k) => Math.max(x, store.lebenszeichen(k, jetzt)), 0);
    const stand = trainingsStand(s0, zuletzt, jetzt);
    const liegtAb = zuletzt ? zuletzt + store.LIEGT_AB_MS + MINUTE : 0;
    // Ohne Prototyp: Ein Schlüssel ist ein Hash, und kein Hash soll auf
    // „constructor" oder „toString" treffen. Erst alle Texte, die vorkommen;
    // in die Sendung kommen nur die, auf die etwas zeigt (texteFuer()).
    const pool = Object.create(null);
    const merke = (t) => {
      let h = textHash(t.titel, t.beschreibung);
      while (pool[h] && (pool[h][0] !== t.titel || pool[h][1] !== t.beschreibung)) h += 'x';
      pool[h] = [t.titel, t.beschreibung];
      return h;
    };
    const aus = {};
    const zeiten = {};
    const fern = [];
    // Scheitert die Ferne, bleibt es bei der Nähe – die geht immer.
    let fernFehler = null;
    const fernGrund = (e) => String((e && e.message) || e || 'Ferne').slice(0, 160);
    // Bis wohin die Ferne je Tag gerechnet wird: bis ans Ende des Fensters
    // des letzten Tags – so reicht eine Referenzliste auch für die Tage
    // danach, an denen sich nichts verschiebt.
    const fernEnde = weit ? dates.addDays(ab, tage - 1 + weit) : null;
    for (let k = 0; k < tage; k++) {
      const tag = dates.addDays(ab, k);
      const frueh = k === 0 ? jetzt : amTag(tag, 0, 5);
      zeiten[tag] = Math.min(Math.max(frueh, liegtAb), Math.max(frueh, amTag(tag, 23, 59)));
      uhrStellen(zeiten[tag]);
      store.importJSON(text);
      tagstart.tagNachziehen({ art: 'start', wartet: k === 0 ? wartet : null });
      const liste = kalender.kalenderTermine({ von: dates.addDays(tag, -zurueck), bis: dates.addDays(tag, voraus) });
      aus[tag] = liste.map((t) => [t.kennung, t.datum, t.dauer, merke(t), t.fertig ? 1 : 0]);
      if (weit && !fernFehler) {
        const t0 = EchteUhr.now();
        try {
          fern.push({
            nah: new Set(liste.map((t) => t.kennung)),
            fern: fernTermine(m, tag, voraus, fernEnde).map((t) => [t.kennung, tageZwischen(ab, t.datum), t.dauer, merke(t), t.fertig ? 1 : 0]),
          });
        } catch (e) {
          fernFehler = fernGrund(e);
        }
        fernMs += EchteUhr.now() - t0;
      }
    }
    const v = {
      v: weit ? 2 : 1, ab, fenster: [zurueck, voraus], stand, texte: null, tage: aus, zeiten, ms: 0, fernMs,
    };
    // Kodieren, messen – und wenn es zu groß wird, die Ferne kürzen statt die
    // Sendung scheitern zu lassen: jedes Mal ein Viertel weniger, zuletzt
    // gar keine (dann ist es die Nähe allein, wie in Fassung 1).
    let bis = weit;
    if (weit && !fernFehler) {
      try {
        for (;;) {
          v.ferne = ferneBauen(fern, bis, voraus);
          v.texte = texteFuer(pool, aus, v.ferne);
          const bytes = new TextEncoder().encode(JSON.stringify({ texte: v.texte, tage: aus, ferne: v.ferne })).length + RESERVE_BYTES;
          if (bytes <= maxBytes || bis <= voraus) break;
          bis = Math.max(voraus, Math.floor(bis * 0.75));
        }
      } catch (e) {
        fernFehler = fernGrund(e);
      }
    }
    if (!weit || fernFehler) {
      // Ohne Ferne: eine Vorschau der Fassung 1. Ein Skript der Fassung 2
      // nimmt sie an, gleicht die Nähe an und lässt das Jahr dahinter stehen.
      v.v = 1;
      delete v.ferne;
      v.texte = texteFuer(pool, aus, null);
      if (fernFehler) v.fernFehler = fernFehler;
      v.ms = EchteUhr.now() - start;
      return v;
    }
    v.gekuerzt = bis < weit ? bis : null;
    v.ms = EchteUhr.now() - start;
    return v;
  } finally {
    uhrZurueck();
  }
}

/**
 * Die Ferne eines Tages – was die App zeigen würde, wenn ab heute nach Plan
 * trainiert wird: der Rest der laufenden Runde hinter der Nähe, dann die
 * nächsten Runden, wie rundeWeiter() sie anlegt. Läuft im frisch gesäten
 * Zustand dieses Tages und verändert ihn (store.restartPlan()) – das darf es
 * nur hier, wo der nächste Tag ohnehin neu gesät wird.
 *
 * Workout 1 der nächsten Runde liegt im üblichen Abstand nach der letzten
 * Einheit (naechsteRundeAb()), frühestens morgen: Liegt die letzte Einheit
 * angefangen in der Vergangenheit, zöge catchUpPlan() die neue Runde beim
 * Weiterrollen ohnehin auf den Tag, an dem es passiert.
 */
function fernTermine({ store, data, dates, tagstart, kalender }, tag, voraus, bis) {
  const von = dates.addDays(tag, voraus + 1);
  const out = von <= bis ? kalender.kalenderTermine({ von, bis }) : [];
  const morgen = dates.addDays(tag, 1);
  let runde = kalender.kalenderRunde().runde;
  // Höchstens so viele Runden – eine Runde ist nie kürzer als ein paar Wochen.
  for (let i = 0; i < 12; i++) {
    const naechste = tagstart.naechsteRundeAb();
    const anfang = naechste > morgen ? naechste : morgen;
    if (anfang > bis) break;
    if (!store.restartPlan(dates.daysBetween(data.PLAN[0].date, anfang), null)) break;
    runde += 1;
    out.push(...kalender.kalenderTermine({ von: anfang, bis, runde }));
  }
  return out;
}

/**
 * Die Ferne kodieren: Referenzlisten, je Tag Liste, Versatz und Flicken –
 * und jeder Tag geprüft: Was fernListe() daraus macht, muss genau die echte
 * Fernliste des Tages sein. Geht die Probe mit einer vorhandenen Liste nicht
 * auf, wird die Fernliste des Tages selbst eine neue Referenz – die geht
 * immer auf. `roh` je Tag { nah: Set der Kennungen in der Nähe, fern:
 * [[kennung, t, dauer, hash, fertig], …] bis ans Ende }. Exportiert nur für
 * die Prüfung (tests/test-kalender-vorschau.mjs).
 */
export function ferneBauen(roh, bis, voraus) {
  const listen = [];
  const index = [];
  const saetze = [];
  // Eine Referenzliste reicht bis ans Ende des Fensters des letzten Tags –
  // nicht weiter, sonst wäre eine gekürzte Ferne kaum kleiner.
  const letzter = roh.length - 1 + bis;
  let zuletzt = -1;
  const geht = (s, von, ende, nah, soll) => JSON.stringify(entschluesseln(listen[s[0]], s[1], s[2] || [], s[3] || [], von, ende, nah))
    === JSON.stringify(soll);
  roh.forEach(({ nah, fern }, k) => {
    const von = k + 1;
    const ende = k + bis;
    const soll = bis > voraus ? fern.filter((e) => e[1] >= von && e[1] <= ende && !nah.has(e[0])).sort(nachTag) : [];
    let beste = null;
    const reihe = zuletzt >= 0 ? [zuletzt, ...listen.map((_, r) => r).reverse().filter((r) => r !== zuletzt)] : [];
    for (const r of reihe) {
      const versatz = versatzRaten(index[r], soll);
      const ist = entschluesseln(listen[r], versatz, [], [], von, ende, nah);
      const fl = flicken(ist, soll);
      const kosten = fl.weg.length + fl.dazu.length;
      if (!beste || kosten < beste.kosten) beste = { r, versatz, ...fl, kosten };
      if (!kosten) break;
    }
    // Die Probe: genau die echte Fernliste – sonst eine neue Referenz.
    let satz = null;
    if (beste && beste.kosten <= FLICKEN_MAX) {
      const s = beste.kosten ? [beste.r, beste.versatz, beste.weg, beste.dazu] : [beste.r, beste.versatz];
      if (geht(s, von, ende, nah, soll)) satz = s;
    }
    if (!satz) {
      const liste = bis > voraus ? fern.filter((e) => e[1] >= von && e[1] <= letzter && !nah.has(e[0])).sort(nachTag) : [];
      listen.push(liste);
      index.push(new Map(liste.map((e) => [e[0], e])));
      satz = [listen.length - 1, 0];
      // Geht selbst das nicht auf, stimmt an der Rechnung etwas nicht – dann
      // lieber gar keine Ferne als eine falsche (rechnen() schickt die Nähe).
      if (!geht(satz, von, ende, nah, soll)) throw new Error(`Ferne am Tag ${k} nicht genau kodierbar`);
    }
    saetze.push(satz);
    zuletzt = satz[0];
  });
  return { bis, listen, tage: saetze };
}

/** Der Versatz zwischen Referenz und Soll: an der ersten Kennung, die beide kennen. */
function versatzRaten(index, soll) {
  for (const e of soll) {
    const r = index.get(e[0]);
    if (r) return e[1] - r[1];
  }
  return 0;
}

/**
 * Eine Referenzliste mit Versatz und Flicken auspacken, zwischen `von` und
 * `ende` (Tage nach ab), ohne die Kennungen der Nähe – sortiert. Dieselbe
 * Regel wie fernListe(), nur mit Tagen als Zahl.
 */
function entschluesseln(liste, versatz, weg, dazu, von, ende, nah) {
  const raus = new Set(weg);
  dazu.forEach((e) => raus.add(e[0]));
  const out = [];
  liste.forEach((e) => {
    if (!raus.has(e[0])) out.push([e[0], e[1] + versatz, e[2], e[3], e[4]]);
  });
  dazu.forEach((e) => out.push([e[0], e[1], e[2], e[3], e[4]]));
  return out.filter((e) => e[1] >= von && e[1] <= ende && !nah.has(e[0])).sort(nachTag);
}

/** Was an `ist` anders ist als an `soll`: Kennungen, die wegfallen, und Einträge, die dazukommen oder ersetzen. */
function flicken(ist, soll) {
  const sollNach = new Map(soll.map((e) => [e[0], e]));
  const istNach = new Map(ist.map((e) => [e[0], e]));
  const weg = ist.filter((e) => !sollNach.has(e[0])).map((e) => e[0]);
  const dazu = soll.filter((e) => {
    const x = istNach.get(e[0]);
    return !x || x[1] !== e[1] || x[2] !== e[2] || x[3] !== e[3] || x[4] !== e[4];
  }).map((e) => e.slice());
  return { weg, dazu };
}

/** Die Texte, auf die etwas zeigt – Nähe und Ferne. */
function texteFuer(pool, tage, ferne) {
  const texte = Object.create(null);
  const nimm = (h) => { texte[h] = pool[h]; };
  Object.values(tage).forEach((l) => l.forEach((e) => nimm(e[3])));
  if (ferne) {
    ferne.listen.forEach((l) => l.forEach((e) => nimm(e[3])));
    ferne.tage.forEach((s) => (s[3] || []).forEach((e) => nimm(e[3])));
  }
  return texte;
}

/* ------------------------------------------------------------------ *
 * Die Nutzlast – gebaut, geprüft, gelesen
 * ------------------------------------------------------------------ */

/**
 * Die Nutzlast für das Skript: die Vorschau und, was nur die App weiß
 * (token, geraet, seq, Uhrzeit, Erinnerung). Ohne `ms`, `fernMs`, `zeiten`
 * und `gekuerzt` – das ist Messung, keine Auskunft.
 *
 * `v` die Fassung des Vertrags: 1 für ein Skript der Fassung 1 – dann ohne
 * Ferne und nur mit den Texten der Nähe –, 2 sonst (Standard: 2, wenn die
 * Vorschau eine Ferne hat). Eine Vorschau ohne Ferne als v 2 trägt eine
 * leere: bis = fenster[1].
 */
export function nutzlastBauen(vorschau, {
  token, geraet, seq = 0, gesendet = Date.now(), app = undefined, minuten = 1050, erinnerung = 30, v = null,
} = {}) {
  const { ab, fenster, stand, tage } = vorschau;
  const fassung = v || (vorschau.ferne ? 2 : 1);
  if (fassung < 2) {
    const texte = {};
    Object.values(tage).forEach((l) => l.forEach((e) => { texte[e[3]] = vorschau.texte[e[3]]; }));
    return {
      v: 1, token, geraet, seq, gesendet, ...(app ? { app } : {}), minuten, erinnerung, ab, fenster, stand, texte, tage,
    };
  }
  const ferne = vorschau.ferne || { bis: fenster[1], listen: [[]], tage: Object.keys(tage).map(() => [0, 0]) };
  return {
    v: 2, token, geraet, seq, gesendet, ...(app ? { app } : {}), minuten, erinnerung, ab, fenster, stand,
    texte: vorschau.texte, tage, ferne,
  };
}

/** Die Größe einer Nutzlast in Byte, so wie sie geschickt wird (UTF-8). */
export function nutzlastBytes(nutzlast) {
  return new TextEncoder().encode(JSON.stringify(nutzlast)).length;
}

const ganz = (x, lo, hi) => Number.isInteger(x) && x >= lo && x <= hi;
const zeichenkette = (x, lo, hi) => typeof x === 'string' && x.length >= lo && x.length <= hi && ZEICHEN.test(x);
const eigen = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

/**
 * So sieht eine Kennung aus – dasselbe Muster wie KENNUNG in js/kalender.js
 * (die Prüfung vergleicht beide). Hier noch einmal, weil dieses Modul
 * js/kalender.js nicht beim Laden importieren darf: Das holte js/store.js und
 * js/data.js herein, bevor der Speicher ersetzt ist.
 */
export const KENNUNG_MUSTER = /^[a-z0-9]{1,24}-\d{1,4}-z?\d{1,4}$/;

/**
 * Prüft eine Nutzlast gegen den Vertrag oben: null, wenn sie passt, sonst der
 * erste Grund. Dieselben Regeln gelten im Skript – es glaubt nichts, was hier
 * nicht durchkäme. Ein Verweis auf einen Text zählt nur, wenn es ihn wirklich
 * gibt (eigener Schlüssel, nicht etwa „constructor").
 */
export function nutzlastPruefen(n, { kennung = KENNUNG_MUSTER } = {}) {
  if (!n || typeof n !== 'object' || Array.isArray(n)) return 'kein Objekt';
  if (n.v !== 1 && n.v !== VORSCHAU_V) return 'v';
  if (!zeichenkette(n.token, 16, 128)) return 'token';
  if (!zeichenkette(n.geraet, 4, 64)) return 'geraet';
  if (!ganz(n.seq, 0, Number.MAX_SAFE_INTEGER)) return 'seq';
  if (!ganz(n.gesendet, 1, Number.MAX_SAFE_INTEGER)) return 'gesendet';
  if (n.probe === true || n.aus === true) return null;
  if (nutzlastBytes(n) > (n.v === 2 ? VORSCHAU_MAX_BYTES_2 : VORSCHAU_MAX_BYTES)) return 'groesse';
  if (!ganz(n.minuten, 0, 1439)) return 'minuten';
  if (!ganz(n.erinnerung, 0, 1440)) return 'erinnerung';
  if (!TAG.test(n.ab || '')) return 'ab';
  if (!Array.isArray(n.fenster) || n.fenster.length !== 2 || !n.fenster.every((x) => ganz(x, 0, 60))) return 'fenster';
  const st = n.stand;
  if (!st || !ganz(st.einheiten, 0, 1e7) || !ganz(st.saetze, 0, 1e8) || !ganz(st.zuletzt, 0, Number.MAX_SAFE_INTEGER)) {
    return 'stand';
  }
  if (!n.texte || typeof n.texte !== 'object' || Array.isArray(n.texte)) return 'texte';
  const texte = Object.entries(n.texte);
  if (texte.length > (n.v === 2 ? 3000 : 500)) return 'texte';
  for (const [h, t] of texte) {
    if (!/^[0-9a-z]{1,12}$/.test(h) || !Array.isArray(t) || t.length !== 2
      || typeof t[0] !== 'string' || t[0].length > 200 || typeof t[1] !== 'string' || t[1].length > 4000) return 'texte';
  }
  if (!n.tage || typeof n.tage !== 'object' || Array.isArray(n.tage)) return 'tage';
  const tage = Object.entries(n.tage);
  if (!tage.length || tage.length > 60) return 'tage';
  for (const [tag, liste] of tage) {
    if (!TAG.test(tag) || !Array.isArray(liste) || liste.length > 200) return 'tage';
    for (const e of liste) {
      if (!Array.isArray(e) || e.length !== 5 || typeof e[0] !== 'string' || !kennung.test(e[0])
        || !TAG.test(e[1] || '') || !ganz(e[2], 1, 600) || typeof e[3] !== 'string' || !eigen(n.texte, e[3])
        || (e[4] !== 0 && e[4] !== 1)) {
        return 'eintrag';
      }
    }
  }
  if (n.v === 2) return fernePruefen(n, kennung);
  return null;
}

/** Fassung 2: die Ferne (siehe Vertrag) – null oder 'ferne'. */
function fernePruefen(n, kennung) {
  const f = n.ferne;
  if (!f || typeof f !== 'object' || Array.isArray(f)) return 'ferne';
  if (!ganz(f.bis, n.fenster[1], FERNE_MAX)) return 'ferne';
  const eintrag = (e) => Array.isArray(e) && e.length === 5 && typeof e[0] === 'string' && kennung.test(e[0])
    && ganz(e[1], 0, 2000) && ganz(e[2], 1, 600) && typeof e[3] === 'string' && eigen(n.texte, e[3]) && (e[4] === 0 || e[4] === 1);
  if (!Array.isArray(f.listen) || !f.listen.length || f.listen.length > 60) return 'ferne';
  for (const l of f.listen) {
    if (!Array.isArray(l) || l.length > 600 || !l.every(eintrag)) return 'ferne';
  }
  if (!Array.isArray(f.tage) || !f.tage.length || f.tage.length > 60) return 'ferne';
  for (const s of f.tage) {
    if (!Array.isArray(s) || (s.length !== 2 && s.length !== 4) || !ganz(s[0], 0, f.listen.length - 1) || !ganz(s[1], -1000, 1000)) return 'ferne';
    if (s.length === 4) {
      if (!Array.isArray(s[2]) || s[2].length > 600 || !s[2].every((k) => typeof k === 'string' && kennung.test(k))) return 'ferne';
      if (!Array.isArray(s[3]) || s[3].length > 600 || !s[3].every(eintrag)) return 'ferne';
    }
  }
  // Jeder Tag der Vorschau hat seinen Satz.
  for (const tag of Object.keys(n.tage)) {
    const k = tageZwischen(n.ab, tag);
    if (!(k >= 0 && k < f.tage.length)) return 'ferne';
  }
  return null;
}

/**
 * Gilt die neue Sendung, gemessen an der zuletzt angenommenen? Die Regel
 * „Wer gilt" aus dem Vertrag oben. `alt` und `neu` sind Nutzlasten; gelesen
 * werden nur geraet, seq, gesendet und stand.
 *
 *   'neu'     übernehmen
 *   'gleich'  dieselbe Sendung noch einmal – angekommen, nichts zu tun
 *   'alt'     dasselbe Gerät, aber eine frühere Sendung (eine verspätete
 *             Wiederholung) – die spätere gilt
 *   'aelter'  ein anderes Gerät, das nicht zuletzt trainiert hat
 *
 * Bei zwei Geräten zählt zuerst das letzte Lebenszeichen, dann die Zahl der
 * Einheiten, dann die der Sätze – „mindestens gleich" gilt. Nicht die Zeit der
 * Sendung: Die ist bei einem Gerät, das eben aus der Schublade kommt, die
 * neueste von allen.
 */
export function sendungVergleichen(alt, neu) {
  if (!alt) return 'neu';
  if (neu.geraet === alt.geraet) {
    if (neu.seq === alt.seq && neu.gesendet === alt.gesendet) return 'gleich';
    return neu.seq > alt.seq || neu.gesendet > alt.gesendet ? 'neu' : 'alt';
  }
  const a = alt.stand || {};
  const b = neu.stand || {};
  for (const k of ['zuletzt', 'einheiten', 'saetze']) {
    if ((b[k] || 0) !== (a[k] || 0)) return (b[k] || 0) > (a[k] || 0) ? 'neu' : 'aelter';
  }
  return 'neu';
}

/**
 * Ein eigener Termin, dessen Kennung in der Tagesliste fehlt: bleibt er
 * stehen? Die Regel „Was das Skript mit der Liste macht" aus dem Vertrag.
 * `termin` { kennung, datum }, `liste` die Einträge des Tages (Nähe und
 * Ferne), `heute` ISO.
 */
export function bleibtStehen(termin, liste, heute) {
  if (termin.datum > heute) return false;
  const teile = (k) => /^(.*)-(\d+)-z?\d+$/.exec(String(k)) || [String(k), String(k), '0'];
  const [, fokus, runde] = teile(termin.kennung);
  const l = liste || [];
  if (l.some((e) => teile(e[0])[1] === fokus && teile(e[0])[2] === runde)) return false;
  return !l.some((e) => teile(e[0])[1] === fokus && Number(teile(e[0])[2]) < Number(runde));
}

/**
 * Welche Tagesliste heute gilt: tage[heute], sonst die des letzten Tags davor
 * – { tag, liste, aufgebraucht } oder null (keine bis heute). Das Skript
 * wählt genauso; `heute` ist dort der Tag in Europe/Berlin. `liste` ist die
 * Nähe – die Ferne dazu gibt fernListe().
 */
export function vorschauFuer(tage, heute) {
  const vorher = Object.keys(tage || {}).filter((t) => TAG.test(t) && t <= heute).sort();
  if (!vorher.length) return null;
  const tag = vorher[vorher.length - 1];
  return { tag, liste: tage[tag], aufgebraucht: tag !== heute };
}

/**
 * Die Ferne des Tages `tag` aus einer Nutzlast: [[kennung, datum, dauer,
 * hash, fertig], …] – nach Tag sortiert, wie die Liste in `tage`. Leer bei
 * v 1 oder ohne Satz für den Tag. Die Regel aus dem Vertrag: listen[r] um v
 * verschoben, ohne weg, mit dazu, nach dem Tag bis tag + bis, ohne die
 * Kennungen der Nähe.
 */
export function fernListe(n, tag) {
  const f = n && n.ferne;
  const nah = n && n.tage && n.tage[tag];
  if (!f || !Array.isArray(nah)) return [];
  const k = tageZwischen(n.ab, tag);
  const s = f.tage[k];
  if (!s || !f.listen[s[0]]) return [];
  const raus = entschluesseln(f.listen[s[0]], s[1], s[2] || [], s[3] || [], k + 1, k + f.bis, new Set(nah.map((e) => e[0])));
  return raus.map((e) => [e[0], plusTage(n.ab, e[1]), e[2], e[3], e[4]]);
}
