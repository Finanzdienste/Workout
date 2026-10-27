/*
 * Die Vorschau des Kalenders: was die App an jedem der nächsten Tage zeigen
 * würde, wenn bis dahin nicht trainiert wird.
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
 * Der Vertrag zwischen App und Skript, Fassung 1 (VORSCHAU_V)
 * ------------------------------------------------------------------------
 *
 * Hier steht er einmal, für beide Seiten: die App sendet so (dieses Modul),
 * das Skript in Tobis Google-Konto nimmt so an. Die Regeln, die beide
 * auswerten, stehen unten als Funktionen (nutzlastPruefen(),
 * sendungVergleichen(), vorschauFuer(), bleibtStehen()) – das Skript
 * übernimmt sie Zeile für Zeile, tests/test-kalender-vorschau.mjs hält sie
 * fest.
 *
 * **Die Sendung.** Ein einfacher POST an die Web-App-Adresse (…/exec):
 * Body = JSON.stringify(nutzlast), Content-Type „text/plain;charset=utf-8",
 * keine eigenen Header, credentials 'omit', redirect 'follow'. Apps Script
 * beantwortet kein OPTIONS – jede andere Form löste einen Preflight aus und
 * käme nie an. Höchstens 64 KiB (VORSCHAU_MAX_BYTES, die Grenze für keepalive
 * beim Wegschalten), gemessen weit darunter. Idempotent: Dieselbe Sendung
 * zweimal ändert beim zweiten Mal nichts.
 *
 *   v           1
 *   token       das Kennwort dieses Kalenders, 16–128 Zeichen [A-Za-z0-9_-].
 *               Steht so im Skript (Platzhalter in der Vorlage) und in der App,
 *               sonst nirgends – nie in einer Antwort, nie im Diagnoseprotokoll
 *   geraet      zufällige Kennung des sendenden Geräts, 4–64 Zeichen
 *               [A-Za-z0-9_-]. Bleibt auf dem Gerät – nicht in Sicherung und
 *               Export (wie deviceId) und nicht die Kennung der Telemetrie –,
 *               sonst sähe ein neues Handy für das Skript aus wie das alte
 *   seq         zählt je Gerät bei jeder Sendung hoch (ganze Zahl ≥ 0)
 *   gesendet    Zeitpunkt der Sendung, ms seit 1970 (UTC)
 *   app         Fassung der App, z. B. "v245" – nur zur Anzeige (darf fehlen)
 *   minuten     Beginn, Minuten nach Mitternacht in Europe/Berlin: 0–1439,
 *               Standard 1050 = 17:30 (KALENDER_MINUTEN in js/kalender.js).
 *               Die Uhrzeit rechnet das Skript selbst aus Tag und Minuten
 *               (Utilities.parseDate(…, 'Europe/Berlin', 'yyyy-MM-dd HH:mm')),
 *               damit sie über die Zeitumstellung hinweg stimmt
 *   erinnerung  Popup-Erinnerung so viele Minuten vorher: 0–1440, Standard 30
 *               (KALENDER_ERINNERUNG), 0 = keine
 *   ab          der erste Tag der Vorschau (ISO, Ortszeit des Geräts)
 *   fenster     [zurueck, voraus] in Tagen, je 0–60: Die Liste eines Tages d
 *               enthält die Termine von d − zurueck bis d + voraus (Standard
 *               [7, 28]). Was davor oder danach liegt, fasst das Skript nicht an
 *   stand       der Trainingsstand des Geräts (trainingsStand()):
 *               { einheiten, saetze, zuletzt } – abgeschlossene Planeinheiten,
 *               abgehakte Sätze und das letzte Lebenszeichen einer Einheit
 *               (ms, 0 = keins bekannt), alle drei über alle Runden, auch
 *               abgelegte und die anderer Fokusse
 *   texte       { <hash>: [titel, beschreibung] } – jeder Text einmal
 *               (Schlüssel [0-9a-z]{1,12}, Titel ≤ 200, Beschreibung ≤ 4000
 *               Zeichen, höchstens 500 Texte)
 *   tage        { "JJJJ-MM-TT": [[kennung, datum, dauer, hash, fertig], …] } –
 *               je Tag der Vorschau (höchstens 60) die Termine seines Fensters,
 *               nach datum sortiert: kennung (KENNUNG in js/kalender.js), datum
 *               (ISO), dauer (Minuten, 1–600), hash (Schlüssel in texte),
 *               fertig (1 abgeschlossen, 0 offen)
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
 * zuletzt trainiert hat.
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
 * Beschreibung texte[hash][1], die Erinnerung nur an offenen. Ein eigener
 * Termin im Fenster, dessen Kennung in der Liste fehlt (bleibtStehen()):
 *   - heute oder später: kommt weg. Die Einheit ist dort leer (ein Termin
 *     schont alles), gehört zu keinem Plan mehr, oder ein unberührter
 *     Zusatztag steckt jetzt in der Einheit des Tages.
 *   - vor heute, aus einer anderen Runde oder einem anderen Fokus (der Anfang
 *     der Kennung, <fokus>-<runde>, kommt in der ganzen Liste nicht vor):
 *     bleibt stehen. Das ist Verlauf – die Liste kennt nur die laufende Runde
 *     (kalenderTermine()), und die letzte Einheit einer abgelegten Runde
 *     gehört in den Kalender, auch wenn sie dort ohne „✓" steht, weil der
 *     Tagesabschluss sie im selben Start abschloss, in dem die Runde
 *     weiterrollte.
 *   - vor heute, aus derselben Runde: kommt weg. Das war ein Zusatztag, der
 *     allein an einem Ruhetag stand, nie gemacht wurde und dann in eine
 *     Einheit wanderte; was gemacht ist, steht in der Liste.
 * Termine ohne Kennung (von Hand, eine eingelesene Kalenderdatei) bleiben,
 * wie sie sind. Ein Skript, das noch keine Vorschau angenommen hat, fasst den
 * Kalender gar nicht an – ein zweites, vergessenes Projekt räumt so nicht im
 * Kalender des ersten herum.
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
 *   version     Fassung des Skripts (ganze Zahl) – ist sie älter als die,
 *               die die App kennt, bittet die App um „Kalender-Code erneuern"
 *   kalender    Name des Kalenders ("Workout") – keine ID, keine Adresse
 *   tag         der Tag, dessen Liste eben angeglichen wurde, oder null
 *   geaendert   Zahl der Änderungen im Kalender bei diesem Abgleich, oder null
 *   stand, seq  was jetzt gilt (bei 'alt' und 'aelter' das Gespeicherte)
 *   hinweis     ein kurzer Satz zum Anzeigen (darf fehlen)
 *
 * Die App darf sich auf die Antwort nicht verlassen: Ob sie lesbar ist
 * (Weiterleitung über script.googleusercontent.com), ist auf jedem Gerät
 * einmal zu prüfen. Ist sie es nicht, zeigt die App „gesendet um …".
 */

export const VORSCHAU_V = 1;
/** So viele Tage reicht eine Vorschau – sechs Wochen ohne Öffnen. */
export const VORSCHAU_TAGE = 42;
/** Das Fenster einer Tagesliste: so viele Tage zurück und voraus. */
export const VORSCHAU_ZURUECK = 7;
export const VORSCHAU_VORAUS = 28;
/** Die Grenze für keepalive (Fetch-Spezifikation): 64 KiB. */
export const VORSCHAU_MAX_BYTES = 64 * 1024;

const TAG = /^\d{4}-\d{2}-\d{2}$/;
const ZEICHEN = /^[A-Za-z0-9_-]+$/;
const MINUTE = 60 * 1000;

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
 * Die Rechnung
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
 *
 * Gibt { v, ab, fenster, stand, texte, tage, zeiten, ms } zurück – den Teil
 * der Nutzlast, der aus der Rechnung kommt (nutzlastBauen() legt den Rest
 * dazu). Nur zum Nachsehen: `zeiten` (je Tag die Uhrzeit, zu der gerechnet
 * wurde, ms) und `ms` (wie lange die Rechnung gedauert hat).
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
} = {}) {
  // Zuerst, vor Uhr und Speicher: Im Fenster bleibt alles, wie es ist.
  if (typeof document !== 'undefined') {
    throw new Error('kalender-vorschau: nur in einem Worker oder in Node – im Fenster der App '
      + 'teilten sich diese Module den Zustand mit ihr');
  }
  const text = typeof zustand === 'string' ? zustand : JSON.stringify(zustand);
  const roh = typeof zustand === 'string' ? JSON.parse(zustand) : zustand;
  if (!Number.isFinite(jetzt)) throw new Error('kalender-vorschau: jetzt fehlt');
  const start = EchteUhr.now();
  uhrStellen(jetzt);
  try {
    const { store, dates, tagstart, kalender } = await laden(text, roh);
    const ab = tagVon(jetzt);
    // Das letzte Lebenszeichen im Ausgangszustand – daran hängt die 3-Stunden-Regel.
    // Nur das laufende Protokoll: Eine abgelegte Runde schließt der Tagesabschluss
    // nicht mehr ab. Für „Wer gilt" zählen alle Runden (trainingsStand()).
    store.importJSON(text);
    const s0 = store.getState();
    const zuletzt = Object.keys(s0.log || {}).reduce((m, k) => Math.max(m, store.lebenszeichen(k, jetzt)), 0);
    const stand = trainingsStand(s0, zuletzt, jetzt);
    const liegtAb = zuletzt ? zuletzt + store.LIEGT_AB_MS + MINUTE : 0;
    // Ohne Prototyp: Ein Schlüssel ist ein Hash, und kein Hash soll auf
    // „constructor" oder „toString" treffen.
    const texte = Object.create(null);
    const aus = {};
    const zeiten = {};
    for (let k = 0; k < tage; k++) {
      const tag = dates.addDays(ab, k);
      const frueh = k === 0 ? jetzt : amTag(tag, 0, 5);
      zeiten[tag] = Math.min(Math.max(frueh, liegtAb), Math.max(frueh, amTag(tag, 23, 59)));
      uhrStellen(zeiten[tag]);
      store.importJSON(text);
      tagstart.tagNachziehen({ art: 'start', wartet: k === 0 ? wartet : null });
      const liste = kalender.kalenderTermine({ von: dates.addDays(tag, -zurueck), bis: dates.addDays(tag, voraus) });
      aus[tag] = liste.map((t) => {
        let h = textHash(t.titel, t.beschreibung);
        while (texte[h] && (texte[h][0] !== t.titel || texte[h][1] !== t.beschreibung)) h += 'x';
        texte[h] = [t.titel, t.beschreibung];
        return [t.kennung, t.datum, t.dauer, h, t.fertig ? 1 : 0];
      });
    }
    return { v: VORSCHAU_V, ab, fenster: [zurueck, voraus], stand, texte, tage: aus, zeiten, ms: EchteUhr.now() - start };
  } finally {
    uhrZurueck();
  }
}

/* ------------------------------------------------------------------ *
 * Die Nutzlast – gebaut, geprüft, gelesen
 * ------------------------------------------------------------------ */

/**
 * Die Nutzlast für das Skript: die Vorschau und, was nur die App weiß
 * (token, geraet, seq, Uhrzeit, Erinnerung). Ohne `ms` – das ist Messung,
 * keine Auskunft.
 */
export function nutzlastBauen(vorschau, {
  token, geraet, seq = 0, gesendet = Date.now(), app = undefined, minuten = 1050, erinnerung = 30,
} = {}) {
  const { ab, fenster, stand, texte, tage } = vorschau;
  return {
    v: VORSCHAU_V, token, geraet, seq, gesendet, ...(app ? { app } : {}),
    minuten, erinnerung, ab, fenster, stand, texte, tage,
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
  if (n.v !== VORSCHAU_V) return 'v';
  if (!zeichenkette(n.token, 16, 128)) return 'token';
  if (!zeichenkette(n.geraet, 4, 64)) return 'geraet';
  if (!ganz(n.seq, 0, Number.MAX_SAFE_INTEGER)) return 'seq';
  if (!ganz(n.gesendet, 1, Number.MAX_SAFE_INTEGER)) return 'gesendet';
  if (n.probe === true || n.aus === true) return null;
  if (nutzlastBytes(n) > VORSCHAU_MAX_BYTES) return 'groesse';
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
  if (texte.length > 500) return 'texte';
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
 * `termin` { kennung, datum }, `liste` die Einträge des Tages, `heute` ISO.
 */
export function bleibtStehen(termin, liste, heute) {
  if (!(termin.datum < heute)) return false;
  const vorn = (k) => String(k).replace(/-z?\d+$/, '');
  return !(liste || []).some((e) => vorn(e[0]) === vorn(termin.kennung));
}

/**
 * Welche Tagesliste heute gilt: tage[heute], sonst die des letzten Tags davor
 * – { tag, liste, aufgebraucht } oder null (keine bis heute). Das Skript
 * wählt genauso; `heute` ist dort der Tag in Europe/Berlin.
 */
export function vorschauFuer(tage, heute) {
  const vorher = Object.keys(tage || {}).filter((t) => TAG.test(t) && t <= heute).sort();
  if (!vorher.length) return null;
  const tag = vorher[vorher.length - 1];
  return { tag, liste: tage[tag], aufgebraucht: tag !== heute };
}
