/*
 * Google Kalender automatisch – das Senden.
 *
 *     „Sicher dass man jetzt die Workout zeiten täglich um 17:30 nicht
 *      reinschreiben kann inkl Verschiebung wenn ich mal was verpasse oder
 *      so?"
 *
 *     „Es soll von selbst einfach das optimale passieren"
 *
 * Was die App an jedem der nächsten 42 Tage zeigte, wenn bis dahin nicht
 * trainiert wird, rechnet js/kalender-vorschau.js; das Skript in Tobis
 * Google-Konto (kalender/workout-kalender.gs) legt es ab und gleicht den
 * Kalender „Workout" jede Stunde danach an. Hier steht das Dazwischen: wann
 * die App die Vorschau rechnet, wie sie hinausgeht und was die App aus der
 * Antwort macht. Ohne Oberfläche – was davon zu sehen ist, steht in js/app.js
 * (kalenderKarte()).
 *
 * **Welche Fassung des Vertrags.**
 *
 *     „Klappt alles aber bisschen wenig Termine. Lass doch mal ein Jahr
 *      machen"
 *
 * Ein Jahr kann erst ein Skript der Fassung 2 (die Ferne, siehe
 * js/kalender-vorschau.js). Tobis Skript ist Fassung 1, bis er den neuen
 * Code einfügt – und bis dahin soll es weiterlaufen wie bisher. Darum merkt
 * sich die App je Verbindung die Fassung aus der letzten lesbaren Antwort
 * (`fassung`) und schickt v 1 ohne Ferne, solange sie unter 2 liegt oder
 * unbekannt ist, sonst v 2 mit Ferne. Meldet eine Antwort auf v 1 schon
 * Fassung 2, geht dieselbe Vorschau gleich noch einmal hinaus, jetzt mit dem
 * Jahr; weist ein Skript v 2 zurück (älterer Code), noch einmal als v 1.
 * Solange der neue Code aussteht, fragt die App beim Start und beim
 * Zurückkommen kurz nach (eine Probe, höchstens einmal je zwei Minuten) –
 * Tobi kommt aus Apps Script zurück, und die App sieht von selbst, dass es
 * geklappt hat. Keine Wahl, kein Knopf.
 *
 * **Wann.** Nur mit Verbindung (state.kalender mit url), und nur, wenn sich die
 * Vorschau seit der zuletzt angekommenen geändert hat. In einem Training ist
 * das dreimal so: beim ersten Haken, beim zweiten (ab zwei Sätzen schließt der
 * Tagesabschluss die Einheit morgen ab – die Liste für morgen zeigt sie dann
 * als erledigt) und beim Abschluss; weitere Sätze ändern bis dahin nichts.
 *
 *   erster Haken einer Einheit   sofort. Ab da steht sie auf heute fest; ohne
 *                                Sendung schöbe der Kalender sie morgen als
 *                                verpasst weiter.
 *   Abschluss einer Einheit      sofort (auch aus einheitBeenden() in js/app.js)
 *   jede andere Änderung         gerechnet 2 s danach, geschickt frühestens
 *                                5 s danach und höchstens alle zwei Minuten
 *                                (auch der zweite Haken)
 *   Start                        3 s nach dem Laden: Ein neuer Tag ist eine
 *                                neue Vorschau, und die sechs Wochen zählen
 *                                ab dem letzten Öffnen.
 *   kein Netz, Skript            dieselbe Vorschau noch einmal: nach 2, 5 und
 *   beschäftigt, keine Antwort   15 Minuten, solange die Seite lebt, dazu bei
 *                                „online" und beim Zurückkommen (KAL_NOCHMAL)
 *   Wegschalten                  nur, was schon fertig gerechnet bereitliegt:
 *                                bis 64 KiB mit keepalive, größer (ein Jahr
 *                                mit vielen Terminen) über den Service Worker
 *                                – danach friert die Seite ein
 *   App zu                       der Service Worker schickt eine Vorschau, die
 *                                nicht ankam, nach – ohne Netz, sobald wieder
 *                                welches da ist; ist das Skript beschäftigt,
 *                                einige Minuten später (Background Sync –
 *                                Chrome und Android; Safari kennt es nicht)
 *
 * **Wo gerechnet wird.** In einem Modul-Worker (js/kalender-worker.js). Im
 * Fenster ginge es nicht – dort teilten sich die Rechenmodule den Zustand mit
 * der App –, und dort stünde die Oberfläche still, solange 42 Starts laufen.
 * Im Fenster bleibt nur, den Zustand hinüberzugeben (structured clone) und die
 * fertige Nutzlast in Text zu wandeln; beides wird gemessen und steht im
 * Diagnoseprotokoll (`haupt`, in ms).
 *
 * **Wie.** Ein einfacher POST an die Web-App-Adresse: Text als Body (der
 * Browser schreibt text/plain dazu), keine eigenen Header, ohne Cookies
 * (credentials 'omit') – Apps Script beantwortet kein OPTIONS, und mit
 * Cookies sähe Google einen angemeldeten Fremden statt „Jeder". Die Antwort
 * kommt über eine Weiterleitung zu script.googleusercontent.com. Ist sie
 * lesbar, sagt sie, was los ist (`code`, js/kalender-vorschau.js). Ist sie es
 * nicht, kann der Browser zweierlei meinen – kein Netz oder eine Antwort ohne
 * CORS – und sagt in beiden Fällen nur „Failed to fetch". Ein zweiter Versuch
 * ohne CORS trennt das: Kommt dann eine undurchsichtige Antwort, war das Netz
 * da, und geantwortet hat nicht das Skript, sondern eine Anmeldeseite (Zugriff
 * „Jeder mit Google-Konto"), eine Fehlerseite (alter Code ohne doPost, „Neue
 * Version" vergessen) oder eine falsche Adresse. Welche davon, fragt die App
 * beim Verbinden mit einem einfachen GET nach (kalGetFragen() – doGet
 * antwortet ohne Kennwort), statt Tobi zwischen dreien wählen zu lassen. Die
 * Sendung ist idempotent; zweimal dieselbe schadet nicht.
 *
 * **Was nirgends hinkommt:** das Kennwort und die Adresse – nicht ins
 * Diagnoseprotokoll (dort steht nur, was eine Sendung ergab und wie groß sie
 * war), nicht in den Rückkanal, nicht in eine Meldung auf dem Bildschirm,
 * nicht an den Worker (er bekommt den Zustand ohne die Verbindung).
 * Gespeichert sind sie in state.kalender (Sicherung und Export, siehe
 * js/store.js) und, solange eine Sendung auf Netz wartet, im Ausgang des
 * Service Workers auf diesem Gerät.
 *
 * Alles Interne trägt „kal" vorn: Im Ein-Datei-Bündel teilen sich alle Module
 * einen Gültigkeitsbereich.
 */
import { notieren } from './diagnose.js';
import * as store from './store.js';
import { abschlussWartetAm } from './tagstart.js';

/** Was nur dieses Gerät angeht – eigener Schlüssel, nicht im Zustand (siehe unten). */
export const KALENDER_GERAET = 'workout.kalender.v1';
/** Der Ausgang für den Service Worker (Cache Storage – localStorage sieht er nicht). */
export const KALENDER_AUSGANG = 'kalender-ausgang';
export const KALENDER_SYNC_TAG = 'kalender';
/** Die Vorlage des Skripts; der Service Worker hält sie vor. */
export const KALENDER_VORLAGE = './kalender/workout-kalender.gs';
export const KALENDER_PLATZHALTER = '<<KENNWORT-AUS-DER-APP>>';

// Der Vertrag (js/kalender-vorschau.js): Fassung, Größe, Reichweite. Hier noch
// einmal, weil dieses Modul jenes nicht laden darf – im Fenster holte es sonst
// die Rechenmodule an der App vorbei, und im Bündel kollidierten die Namen.
// tests/test-kalender-sync.mjs vergleicht beide. KAL_VERTRAG ist die neueste
// Fassung; ein Skript der Fassung 1 bekommt v 1 (kalVertrag()).
const KAL_VERTRAG = 2;
// Fassung 1, und die Grenze für keepalive beim Wegschalten.
const KAL_MAX_BYTES = 64 * 1024;
// Fassung 2 – größer geht über den Service Worker, nie mit keepalive.
const KAL_MAX_BYTES_2 = 192 * 1024;
const KAL_FERNE = 365;
// So oft fragt die App höchstens nach, ob der neue Code schon da ist.
const KAL_FASSUNG_FRAGEN = 2 * 60 * 1000;

const KAL_VORBEREITEN = 2000;
const KAL_ERSTE = 5000;
const KAL_DROSSEL = 2 * 60 * 1000;
const KAL_START = 3000;
// Lange, weil die erste Sendung beim Skript alle Termine anlegt (geschätzt
// 20–40 s). Ein Abbruch heißt „Antwort blieb aus", nicht „nicht angekommen" –
// gespeichert hat das Skript vor dem Abgleich.
const KAL_ABBRUCH = 45000;
const KAL_PROBE_ABBRUCH = 30000;

// Antworten, die nicht mehr besser werden, wenn man dieselbe Vorschau gleich
// noch einmal schickt – erst wieder mit einer neuen oder beim nächsten Start.
// (undurchsichtig und http erst nach den Wiederholungen, wenn diese
// Verbindung schon einmal ging – siehe kalSenden().)
const KAL_ENDGUELTIG = new Set(['token', 'format', 'undurchsichtig', 'http', 'aelter', 'alt', 'groesse']);
const KAL_CODES = new Set(['angekommen', 'gleich', 'probe', 'aus', 'token', 'format', 'alt', 'aelter', 'fehler']);
// Antworten, nach denen dieselbe Vorschau von selbst noch einmal hinausgeht:
// kein Netz, das Skript beschäftigt (der stündliche Abgleich hält die Sperre
// bis zu vier Minuten, doPost wartet 30 s), keine Antwort in 45 s. Bis zur
// Prüfung des Entwurfs ging nur „netz" noch einmal hinaus, und das nur bei
// „online" – bei bestehendem Netz blieb die Vorschau von vor dem Training beim
// Skript, und ab Mitternacht schob der Kalender die gemachte Einheit als
// verpasst weiter.
const KAL_NOCHMAL = new Set(['netz', 'fehler', 'zeit']);
// So lange nach einem Fehlschlag, solange die Seite lebt – danach erst wieder
// mit der nächsten Änderung, beim Start, bei „online" oder beim Zurückkommen.
// Ist die Seite zu, übernimmt der Service Worker (der Ausgang unten).
const KAL_WIEDER = [2 * 60 * 1000, 5 * 60 * 1000, 15 * 60 * 1000];

/* ------------------------------------------------------------------ *
 * Was dieses Gerät weiß – in workout.kalender.v1, nicht im Zustand
 *
 * Nicht im Zustand, aus demselben Grund wie bei der Sicherung: Der Zustand
 * ist das, was die Vorschau rechnet und die Sicherung sichert – stünde
 * „zuletzt angekommen" darin, löste jede Sendung die nächste aus. Und eine
 * Sicherung, die ein neues Handy einliest, soll dort nicht als dasselbe Gerät
 * auftreten (die Regel „Wer gilt" im Vertrag hängt an `geraet`).
 *
 *   geraet      die Kennung dieses Geräts für das Skript (zufällig, nicht die
 *               des Rückkanals)
 *   seq         zählt jede Sendung hoch
 *   hash, ziel  Fingerabdruck der zuletzt angekommenen Vorschau und der
 *               Verbindung, an die sie ging – dieselbe geht nicht noch einmal
 *   letzte      der letzte Versuch: { art, zeit, ergebnis, ok, version,
 *               hinweis, tag, geaendert, bytes, status, ziel, wieder,
 *               erschoepft } – wieder: die App versucht es gleich noch
 *               einmal; erschoepft: auch die Wiederholungen scheiterten
 *   angekommen  der letzte, der ankam: { zeit, version, tag, ziel }
 *   offen       der letzte Versuch scheiterte am Netz, das Skript war
 *               beschäftigt oder die Antwort blieb aus – „online" und das
 *               Zurückkommen holen ihn nach
 *   aus         Abschalten, das noch nicht beim Skript ist: [{ url, token,
 *               geraet, seq, gesendet }] – bis es ankommt, beim Start und bei
 *               „online" wieder versucht
 *   nach        was der Service Worker im Hintergrund nachgeschickt hat
 *   fassung     die Fassung des Skripts aus seiner letzten lesbaren Antwort:
 *               { ziel, version } – daran hängt, ob v 1 oder v 2 hinausgeht
 *   gesehen     die Fassung der Vorlage, zu der Tobi die Bitte um neuen Code
 *               schon gesehen hat (Ansehen, Code kopieren) – dann steht sie
 *               nicht mehr auf dem Dashboard, nur noch auf der Karte
 * ------------------------------------------------------------------ */

function kalMeta() {
  try {
    const m = JSON.parse(localStorage.getItem(KALENDER_GERAET) || '{}');
    return m && typeof m === 'object' && !Array.isArray(m) ? m : {};
  } catch {
    return {};
  }
}

function kalMetaSchreiben(teil) {
  const neu = { ...kalMeta(), ...teil };
  try { localStorage.setItem(KALENDER_GERAET, JSON.stringify(neu)); } catch { /* voll – beim nächsten Mal */ }
  return neu;
}

function kalZufall(bytes) {
  const b = crypto.getRandomValues(new Uint8Array(bytes));
  let s = '';
  b.forEach((x) => { s += String.fromCharCode(x); });
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Ein neues Kennwort: 256 Bit, base64url (43 Zeichen). */
export function kalenderNeuesToken() {
  return kalZufall(32);
}

function kalGeraet() {
  const m = kalMeta();
  if (typeof m.geraet === 'string' && /^[A-Za-z0-9_-]{4,64}$/.test(m.geraet)) return m.geraet;
  const g = `g${kalZufall(12)}`;
  kalMetaSchreiben({ geraet: g });
  return g;
}

function kalSeq() {
  const m = kalMeta();
  const seq = Number.isInteger(m.seq) && m.seq >= 0 ? m.seq + 1 : 1;
  kalMetaSchreiben({ seq });
  return seq;
}

/** FNV-1a, 32 Bit, Basis 36 – ein Fingerabdruck, kein Geheimnis. */
function kalHash(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

/** Welche Verbindung – damit ein Stand von früher nicht für eine neue spricht. */
const kalZiel = (k) => (k && k.url && k.token ? kalHash(`${k.url}\u0000${k.token}`) : null);

/**
 * Die Fassung des Skripts dieser Verbindung aus seiner letzten lesbaren
 * Antwort – sonst null. Seit v246 steht sie in `fassung`; was eine ältere App
 * hinterließ, steht nur beim letzten Versuch und beim letzten, der ankam.
 */
function kalFassung(ziel = kalZiel(store.kalender())) {
  if (!ziel) return null;
  const m = kalMeta();
  const f = [m.fassung, m.letzte, m.angekommen].find((x) => x && x.ziel === ziel && Number.isInteger(x.version));
  return f ? f.version : null;
}

/** Welche Fassung des Vertrags hinausgeht: die neueste, sobald das Skript sie kennt, sonst 1. */
function kalVertrag(ziel = kalZiel(store.kalender())) {
  const f = kalFassung(ziel);
  return f !== null && f >= KAL_VERTRAG ? KAL_VERTRAG : 1;
}

const kalBytes = (text) => new TextEncoder().encode(text).length;

/* ------------------------------------------------------------------ *
 * Die Adresse
 * ------------------------------------------------------------------ */

/**
 * Was jemand ins Feld eingefügt hat → { url } oder { fehler } mit dem Satz,
 * der sagt, was stattdessen gemeint ist. Die häufigen Verwechslungen haben je
 * einen eigenen: die Test-URL (…/dev geht nur angemeldet), die Adresse des
 * Editors, die Weiterleitung.
 */
export function kalenderUrlPruefen(eingabe) {
  const roh = String(eingabe || '').trim();
  if (!roh) return { fehler: 'Bitte die Web-App-URL einfügen – sie endet auf /exec.' };
  const url = roh.replace(/[?#].*$/, '').replace(/\/+$/, '');
  if (store.KALENDER_URL.test(url)) return { url };
  if (/^https:\/\/script\.google\.com\/.*\/dev$/.test(url)) {
    return { fehler: 'Das ist die Test-URL (endet auf /dev), die geht nur angemeldet. Nimm die Web-App-URL, die auf /exec endet.' };
  }
  if (/^https:\/\/script\.google\.com\/(?:home|d\/|macros\/d\/)/.test(url) || /\/edit$/.test(url)) {
    return { fehler: 'Das ist die Adresse des Editors. Die Web-App-URL steht unter Bereitstellen → Bereitstellungen verwalten und endet auf /exec.' };
  }
  if (/^https:\/\/script\.googleusercontent\.com\//.test(url)) {
    return { fehler: 'Das ist die Weiterleitung, nicht die Web-App-URL. Nimm die aus „Bereitstellungen verwalten" – sie endet auf /exec.' };
  }
  return { fehler: 'Das ist keine Web-App-URL von Google Apps Script. Sie beginnt mit https://script.google.com/macros/s/ und endet auf /exec.' };
}

/* ------------------------------------------------------------------ *
 * Die Vorlage des Skripts
 * ------------------------------------------------------------------ */

let kalVorlage = null;   // { text, fassung }

/** Die Vorlage holen (der Service Worker hält sie vor) – einmal je Sitzung. */
export async function kalenderVorlage() {
  if (kalVorlage) return kalVorlage;
  const res = await fetch(KALENDER_VORLAGE);
  if (!res.ok) throw new Error(`Vorlage: HTTP ${res.status}`);
  const text = await res.text();
  const m = /^const FASSUNG = (\d+);$/m.exec(text);
  if (!m || text.split(KALENDER_PLATZHALTER).length !== 2) throw new Error('Vorlage unvollständig');
  kalVorlage = { text, fassung: Number(m[1]) };
  return kalVorlage;
}

/** Die Fassung der Vorlage, sobald sie einmal geholt ist – sonst null. */
export const kalenderVorlageFassung = () => (kalVorlage ? kalVorlage.fassung : null);

/**
 * Der Code zum Einfügen in Apps Script, mit dem Kennwort dieses Kalenders.
 *
 * Das Kennwort steht danach fest im Speicher – *bevor* der Code die App
 * verlässt: Lädt die App beim Wechsel in den Browser und zurück neu (iOS tut
 * das oft) und entstünde dabei ein neues, passte der eingefügte Code nicht
 * mehr, und jede Sendung würde abgewiesen. Ein zweites Kopieren nimmt
 * dasselbe. Steht es nicht im Speicher (voll, gesperrt), gibt es keinen Code.
 */
export async function kalenderCode() {
  let k = store.kalender();
  if (!k || !k.token) k = store.setzeKalender({ token: kalenderNeuesToken() });
  let fest = false;
  try {
    const roh = JSON.parse(localStorage.getItem('workout.state.v1') || '{}');
    fest = !!(roh.kalender && roh.kalender.token === k.token);
  } catch { fest = false; }
  if (!fest) {
    const f = new Error('Das Kennwort ließ sich nicht speichern – der Speicher nimmt gerade nichts an.');
    f.code = 'speicher';
    throw f;
  }
  const v = await kalenderVorlage();
  return v.text.replace(KALENDER_PLATZHALTER, k.token);
}

/* ------------------------------------------------------------------ *
 * Der Worker
 * ------------------------------------------------------------------ */

let kalWorker = null;
let kalNr = 0;
const kalAuftraege = new Map();
let kalHauptMs = 0;   // Zeit im Fenster für die laufende Sendung

function kalWorkerWeg() {
  if (kalWorker) {
    try { kalWorker.terminate(); } catch { /* schon weg */ }
  }
  kalWorker = null;
}

function kalWorkerNeu() {
  const w = new Worker(new URL('./kalender-worker.js', import.meta.url), { type: 'module' });
  w.addEventListener('message', (e) => {
    const d = e.data || {};
    const a = kalAuftraege.get(d.id);
    if (!a) return;
    kalAuftraege.delete(d.id);
    if (d.ok) {
      a.fertig(d.vorschau);
      return;
    }
    const f = new Error(String(d.fehler || 'Vorschau gescheitert'));
    f.code = d.code || 'fehler';
    a.fehler(f);
  });
  // Lädt der Worker gar nicht (kein Modul-Worker, Datei fehlt): alle
  // wartenden Aufträge scheitern, der nächste legt einen neuen an.
  w.addEventListener('error', (e) => {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    const f = new Error(`Worker: ${(e && e.message) || 'lädt nicht'}`);
    f.code = 'worker';
    kalAuftraege.forEach((a) => a.fehler(f));
    kalAuftraege.clear();
    kalWorkerWeg();
  });
  return w;
}

function kalRechnenLassen(ferne) {
  return new Promise((fertig, fehler) => {
    if (!kalWorker) kalWorker = kalWorkerNeu();
    kalNr += 1;
    kalAuftraege.set(kalNr, { fertig, fehler });
    const t0 = performance.now();
    // Der Zustand, wie die App ihn nach ihrem Start hat; der Worker bekommt
    // eine Kopie (structured clone) und fasst das Original nie an. Ohne die
    // Verbindung: Die Vorschau braucht sie nicht, und so kann auch keine
    // Fehlermeldung aus dem Worker Kennwort oder Adresse enthalten.
    kalWorker.postMessage({
      id: kalNr, zustand: { ...store.getState(), kalender: null }, jetzt: Date.now(), wartet: abschlussWartetAm(), ferne,
    });
    kalHauptMs += performance.now() - t0;
  });
}

/**
 * Rechnen – mit einem frischen Worker, wenn der alte einen anderen Fokus
 * geladen hat. `ferne`: so viele Tage reicht die Ferne, 0 für ein Skript der
 * Fassung 1 (dann rechnet der Worker sie gar nicht erst).
 */
async function kalRechnen(ferne = 0) {
  try {
    return await kalRechnenLassen(ferne);
  } catch (e) {
    if (e.code !== 'fokus') throw e;
    kalWorkerWeg();
    return kalRechnenLassen(ferne);
  }
}

/* ------------------------------------------------------------------ *
 * Senden und lesen
 * ------------------------------------------------------------------ */

/**
 * Einmal hinaus. { res } oder { art: 'netz' | 'zeit' | 'undurchsichtig' }.
 * Bis zum Abschicken kein await – beim Wegschalten muss die Anfrage im selben
 * Takt losgehen.
 */
async function kalSchicken(url, text, { keepalive = false, abbruch = KAL_ABBRUCH } = {}) {
  if (navigator.onLine === false) return { art: 'netz' };
  const ctrl = new AbortController();
  const uhr = setTimeout(() => ctrl.abort(), abbruch);
  const anfrage = (mode) => fetch(url, {
    method: 'POST', body: text, mode, credentials: 'omit', redirect: 'follow', keepalive, signal: ctrl.signal,
  });
  try {
    return { res: await anfrage('cors') };
  } catch {
    if (ctrl.signal.aborted) return { art: 'zeit' };
    // Beim Wegschalten kein zweiter Versuch: Die Seite friert gleich ein.
    if (keepalive) return { art: 'netz' };
    try {
      await anfrage('no-cors');
      return { art: 'undurchsichtig' };
    } catch {
      return { art: ctrl.signal.aborted ? 'zeit' : 'netz' };
    }
  } finally {
    clearTimeout(uhr);
  }
}

/**
 * Was zurückkam → { ergebnis, ok, version, hinweis, tag, geaendert, status }.
 * `ergebnis` ist ein Code des Skripts (KAL_CODES) oder netz, zeit,
 * undurchsichtig, http. Der Hinweis ist ein Satz des Skripts (ohne Kennwort
 * und ohne IDs, bereinigt_() dort) – er wird angezeigt, nicht protokolliert.
 */
async function kalLesen(erg) {
  if (!erg.res) return { ergebnis: erg.art, ok: false };
  const { res } = erg;
  if (res.type === 'opaque' || res.type === 'opaqueredirect') return { ergebnis: 'undurchsichtig', ok: false };
  let roh = null;
  try { roh = JSON.parse(await res.text()); } catch { roh = null; }
  if (!roh || typeof roh !== 'object' || typeof roh.ok !== 'boolean' || typeof roh.code !== 'string') {
    return { ergebnis: 'http', ok: false, status: res.status };
  }
  const tag = (x) => (typeof x === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x) ? x : null);
  return {
    ergebnis: KAL_CODES.has(roh.code) ? roh.code : 'fehler',
    ok: roh.ok === true,
    version: Number.isInteger(roh.version) ? roh.version : null,
    hinweis: typeof roh.hinweis === 'string' ? roh.hinweis.slice(0, 300) : '',
    tag: tag(roh.tag),
    geaendert: Number.isInteger(roh.geaendert) ? roh.geaendert : null,
    // Fassung 2: noch offene Änderungen und bis wann die Liste reicht.
    offen: Number.isInteger(roh.offen) ? roh.offen : null,
    bis: tag(roh.bis),
    status: res.status,
  };
}

/**
 * Hat ein Skript eine Sendung abgewiesen, weil sie in einer neueren Fassung
 * des Vertrags kam, als es spricht (v 2 an Fassung 1)? Das richtet die App
 * selbst – sie schickt dieselbe Vorschau gleich passend (kalSenden(),
 * kalenderSichtbar()). Nichts für Tobi, keine Warnzeile.
 */
const kalFassungZurueck = (a) => !!a && a.ergebnis === 'format' && Number.isInteger(a.version)
  && Number.isInteger(a.vertrag) && a.version < a.vertrag;

/**
 * Kann das Skript nicht annehmen, was die App schickt? Dann muss neuer Code
 * her, sonst geht gar nichts. Ein Skript der Fassung 1 gehört nicht dazu: Es
 * bekommt v 1 und läuft weiter (kalNeuerCode() bittet dann freundlich um das
 * Jahr). Übrig bleibt, dass das Skript selbst „erneuern" sagt – zu einer
 * Sendung in der Fassung, die es spricht.
 */
const kalZuAlt = (a) => !!a && a.ergebnis === 'format' && /erneuern/i.test(a.hinweis || '') && !kalFassungZurueck(a);

/** Gibt es neueren Code als den im Skript? Fassung bekannt und älter als die Vorlage. */
const kalNeuerCode = (fassung) => Number.isInteger(fassung) && !!kalVorlage && fassung < kalVorlage.fassung;

/**
 * Die Bitte um neuen Code – für die Karte unter Mehr → Kalender, wörtlich so
 * auch im README. „einrichten" gehört nicht hinein: Kalender und stündlicher
 * Auslöser bestehen schon, der Auslöser ruft „stuendlich" beim Namen, und
 * Fassung 2 braucht keine neuen Rechte. Fehlt doch etwas, sagt es das Skript
 * selbst (kalenderHandeln()).
 */
export const KALENDER_JAHR = {
  titel: 'Ein Jahr im Voraus',
  satz: 'Dein Skript bei Google ist noch Fassung 1 und trägt nur die nächsten vier Wochen ein. Für ein ganzes Jahr '
    + 'braucht es einmal den neuen Code – das Kennwort bleibt dasselbe:',
  schritte: [
    '„Code kopieren" tippen (gleich hier unten).',
    'In Chrome script.google.com öffnen, im Drei-Punkte-Menü Desktopwebsite anhaken und dein Projekt öffnen – dasselbe wie beim Einrichten.',
    'Den ganzen Code dort durch den kopierten ersetzen und speichern.',
    'Bereitstellen → Bereitstellungen verwalten → Bearbeiten (Stift) → Version: Neue Version → Bereitstellen.',
  ],
  danach: 'Fertig. Die App merkt den neuen Code von selbst und schickt dann das ganze Jahr. Bis dahin läuft alles weiter wie bisher.',
};

/** Ein Satz mit Punkt am Ende – ein Hinweis des Skripts kann ohne kommen. */
const kalSatzEnde = (s) => (/[.!?…]$/.test(s.trim()) ? s.trim() : `${s.trim()}.`);

/**
 * Der Satz zu einem Ergebnis – für „Verbinden", die Karte und das Dashboard.
 * Jeder sagt, was zu tun ist, nicht nur, was schiefging.
 */
export function kalenderSatz(a) {
  if (!a) return '';
  if (kalFassungZurueck(a)) {
    return `Das Skript ist noch Fassung ${a.version} – die App schickt die Vorschau gleich so, wie es sie versteht.`;
  }
  if (kalZuAlt(a)) {
    return 'Kalender-Code erneuern: Der Code in Apps Script ist älter als die App. „Code kopieren", in Apps Script den '
      + 'ganzen Code ersetzen, speichern, dann Bereitstellen → Bereitstellungen verwalten → Bearbeiten (Stift) → '
      + 'Version: Neue Version → Bereitstellen.';
  }
  switch (a.ergebnis) {
    case 'angekommen':
    case 'gleich':
    case 'probe':
    case 'aus':
      return a.hinweis || '';
    case 'netz':
      return 'Kein Netz – geht hinaus, sobald wieder welches da ist.';
    case 'zeit':
      return 'Gesendet, aber die Antwort blieb aus. Beim allerersten Mal braucht das Skript länger – ob es ankam, '
        + 'zeigt der Kalender „Workout".';
    case 'undurchsichtig':
      return 'Google hat geantwortet, aber nicht das Skript. Meist eins davon: (1) Die neue Version ist nicht '
        + 'bereitgestellt – Bereitstellen → Bereitstellungen verwalten → Bearbeiten (Stift) → Version: Neue Version → '
        + 'Bereitstellen. (2) Bei der Bereitstellung steht nicht „Zugriff: Jeder" (sondern „Jeder mit Google-Konto") '
        + 'oder nicht „Ausführen als: Ich". (3) Die URL ist nicht die Web-App-URL (endet auf /exec).';
    case 'token':
      return 'Das Skript kennt dieses Kennwort nicht. „Code kopieren", in Apps Script den ganzen Code ersetzen, '
        + 'speichern, dann Bereitstellen → Bereitstellungen verwalten → Bearbeiten (Stift) → Version: Neue Version → '
        + 'Bereitstellen.';
    case 'aelter':
      return 'Ein anderes Gerät hat zuletzt trainiert – im Kalender gilt dessen Plan. Sobald du hier trainierst, '
        + 'gilt wieder dieses.';
    case 'alt':
      return 'Schon angekommen – eine spätere Sendung dieses Geräts gilt.';
    case 'http':
      return `Unerwartete Antwort von Google${a.status ? ` (HTTP ${a.status})` : ''} – stimmt die URL?`;
    case 'groesse':
      return 'Die Vorschau ist größer, als das Skript annimmt – sie geht nicht hinaus. Bitte dem Assistenten das '
        + 'Diagnoseprotokoll schicken (Mehr → Daten).';
    case 'worker':
      return 'Die Vorschau lässt sich in diesem Browser nicht rechnen (kein Modul-Worker).';
    case 'rechnen':
      return 'Die Vorschau ließ sich nicht rechnen – das ist ein Fehler der App. Bitte dem Assistenten das '
        + 'Diagnoseprotokoll schicken (Mehr → Daten).';
    case 'format':
      return `Das Skript hat die Sendung nicht angenommen${a.hinweis ? `: ${a.hinweis}` : '.'}`;
    case 'fehler':
      if (a.erschoepft) {
        return `${kalSatzEnde(a.hinweis || 'Das Skript meldet einen Fehler.')} Auch drei weitere Versuche kamen nicht durch – `
          + 'bitte dem Assistenten das Diagnoseprotokoll schicken (Mehr → Daten).';
      }
      return a.hinweis || 'Das Skript meldet einen Fehler – die App schickt es gleich noch einmal.';
    default:
      return a.hinweis || 'Das Skript meldet einen Fehler.';
  }
}

/**
 * Braucht es Tobi? Für die eine Zeile auf dem Dashboard – nur, was er selbst
 * richten muss. Netz, ein anderes Gerät, ein beschäftigtes Skript, eine
 * ausgebliebene Antwort richten sich von selbst (die App schickt dieselbe
 * Vorschau noch einmal, KAL_NOCHMAL) und stehen nur unter Mehr. Solange eine
 * Wiederholung aussteht, ist auch eine Seite von Google ohne das Skript noch
 * kein Alarm – bei einer Verbindung, die schon einmal ging, ist das meist ein
 * Aussetzer. Ein „fehler", der auch nach den Wiederholungen bleibt, ist kein
 * Beschäftigtsein mehr.
 */
export function kalenderHandeln(a) {
  if (!a || kalFassungZurueck(a)) return false;
  if (kalZuAlt(a)) return true;
  if (a.wieder) return false;
  if (a.ergebnis === 'fehler' && a.erschoepft) return true;
  if (['token', 'undurchsichtig', 'http', 'format', 'groesse', 'worker', 'rechnen'].includes(a.ergebnis)) return true;
  // Angenommen, aber das Skript bittet um „einrichten" – der Kalender fehlt,
  // ein anderes Projekt pflegt ihn, oder der stündliche Auslöser ist nicht
  // sicher. Ohne den verschiebt nichts, solange die App zu ist.
  return a.ok && /einrichten/.test(a.hinweis || '');
}

/* ------------------------------------------------------------------ *
 * Der Ausgang für den Service Worker (Background Sync)
 *
 * Trainiert Tobi im Studio ohne Netz, geht die Vorschau erst beim nächsten
 * Öffnen mit Netz hinaus – bis dahin hielte der Kalender das Training für
 * verpasst und schöbe es weiter. Dasselbe, wenn das Skript gerade beschäftigt
 * war oder nicht antwortete und Tobi die App gleich danach schließt. Wo es
 * Background Sync gibt (Chrome, Android), legt die App die fertige Sendung
 * deshalb in den Ausgang und bittet den Browser um ein „sync" – das kommt
 * sofort, wenn Netz da ist, sonst sobald wieder welches da ist. Das bekommt
 * der Service Worker auch bei geschlossener App (sw.js, kalenderNachsenden()).
 * Er liest die Antwort, wenn sie lesbar ist: Ist das Skript beschäftigt,
 * wirft er, und der Browser versucht es einige Minuten später noch einmal.
 * Vermerkt wird, dass es hinausging, und, wenn lesbar, was das Skript sagte;
 * mehr erfährt die App mit ihrer nächsten eigenen Sendung.
 * ------------------------------------------------------------------ */

const kalAusgangSchluessel = () => new URL('kalender-ausgang', location.href).href;
const kalNachSchluessel = () => new URL('kalender-ausgang-nach', location.href).href;

/**
 * Eine Sendung in den Ausgang. `hash` und `ziel` reisen mit und kommen im
 * Vermerk des Service Workers zurück (kalNachLesen()) – kam sie dort an, geht
 * dieselbe Vorschau nicht noch einmal hinaus.
 */
async function kalAusgangLegen(v) {
  try {
    if (!window.caches || !navigator.serviceWorker) return false;
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg || !reg.sync) return false;
    const c = await caches.open(KALENDER_AUSGANG);
    await c.put(kalAusgangSchluessel(), new Response(JSON.stringify({
      url: v.url, text: v.text, seq: v.seq, hash: v.hash, ziel: v.ziel, gelegt: Date.now(),
    }), { headers: { 'content-type': 'application/json' } }));
    await reg.sync.register(KALENDER_SYNC_TAG);
    return true;
  } catch {
    return false;
  }
}

async function kalAusgangLeeren() {
  try {
    // Nicht anlegen, was es nicht gibt: Wer den Kalender nie verbunden hat,
    // bekommt auch keinen leeren Ausgang.
    if (!window.caches || !(await caches.has(KALENDER_AUSGANG))) return;
    const c = await caches.open(KALENDER_AUSGANG);
    await c.delete(kalAusgangSchluessel());
  } catch { /* dann eben nicht */ }
}

/** Hat der Service Worker etwas nachgeschickt? Einmal lesen, vermerken, wegräumen. */
async function kalNachLesen() {
  try {
    if (!window.caches || !(await caches.has(KALENDER_AUSGANG))) return;
    const c = await caches.open(KALENDER_AUSGANG);
    const hit = await c.match(kalNachSchluessel());
    if (!hit) return;
    const n = await hit.json().catch(() => null);
    await c.delete(kalNachSchluessel());
    if (!n || !Number.isFinite(n.zeit)) return;
    const code = typeof n.code === 'string' && KAL_CODES.has(n.code) ? n.code : null;
    const teil = { nach: { zeit: n.zeit, seq: Number.isInteger(n.seq) ? n.seq : null, code } };
    // Angekommen: Diese Vorschau ist beim Skript – sie geht nicht noch einmal.
    if ((code === 'angekommen' || code === 'gleich') && typeof n.hash === 'string' && n.ziel === kalZiel(store.kalender())) {
      Object.assign(teil, { hash: n.hash, ziel: n.ziel, offen: false });
      if (Number.isInteger(n.version)) teil.fassung = { ziel: n.ziel, version: n.version };
    }
    kalMetaSchreiben(teil);
    notieren('kalender', { was: 'nachgesendet', seq: n.seq, lesbar: !!code, ergebnis: code || undefined });
  } catch { /* nur eine Auskunft */ }
}

/* ------------------------------------------------------------------ *
 * Der Takt
 * ------------------------------------------------------------------ */

let kalRuf = { nachher: () => {} };
let kalVorbereitenUhr = null;
let kalSendenUhr = null;
let kalVorbereitet = null;      // { text, hash, bytes, seq, url, ziel }
let kalLetzterVersuch = 0;
let kalGeaendertUm = 0;          // die letzte Änderung – „frühestens 5 s danach" zählt ab ihr
let kalKette = Promise.resolve();
let kalBelegt = 0;
let kalZeichenVorher = null;
// Zählt jede Meldung des Stores: Eine Sendung, die bei gleichem Stand
// vorbereitet wurde, muss zum Senden nicht noch einmal gerechnet werden.
let kalStandNr = 0;
// In dieser Sitzung schon endgültig beantwortet (KAL_ENDGUELTIG): Hash → Ergebnis.
const kalVersucht = new Map();
// Die Wiederholungen nach einem Fehlschlag (KAL_WIEDER): für welche Vorschau,
// wie viele schon, ob an der Drossel vorbei (wie der Versuch, der scheiterte).
let kalWieder = { hash: null, n: 0 };
let kalWiederUhr = null;

function kalWiederWeg() {
  clearTimeout(kalWiederUhr);
  kalWiederUhr = null;
  kalWieder = { hash: null, n: 0 };
}

/** Dieselbe Vorschau gleich noch einmal – false, wenn die Wiederholungen aufgebraucht sind. */
function kalWiederPlanen(v) {
  if (kalWieder.hash !== v.hash) kalWieder = { hash: v.hash, n: 0 };
  if (kalWieder.n >= KAL_WIEDER.length) return false;
  const warte = KAL_WIEDER[kalWieder.n];
  kalWieder.n += 1;
  clearTimeout(kalWiederUhr);
  kalWiederUhr = setTimeout(() => {
    kalWiederUhr = null;
    kalenderJetzt('wieder', { zwingen: !!v.zwingen });
  }, warte);
  return true;
}

function kalEinreihen(aufgabe) {
  kalBelegt += 1;
  const ergebnis = kalKette.then(aufgabe, aufgabe);
  kalKette = ergebnis.catch(() => {}).then(() => { kalBelegt -= 1; });
  return ergebnis.catch(() => undefined);
}

/** Geht das hier überhaupt? Nur über http(s), mit Modul-Worker, nicht in der Einzeldatei. */
const kalModul = (() => {
  try { return /\/js\/kalender-sync\.js$/.test(new URL(import.meta.url).pathname); } catch { return false; }
})();
export function kalenderMoeglich() {
  return kalModul && typeof Worker === 'function' && /^https?:$/.test(location.protocol);
}

/** Verbunden: Kennwort und Adresse stehen, und hier lässt sich rechnen. */
export function kalenderVerbunden() {
  const k = store.kalender();
  return !!(k && k.url && k.token) && kalenderMoeglich();
}

function kalAnhalten() {
  clearTimeout(kalVorbereitenUhr);
  clearTimeout(kalSendenUhr);
  kalVorbereitenUhr = null;
  kalSendenUhr = null;
}

function kalVermerken(art, a, mehr = {}) {
  const ziel = mehr.ziel || null;
  const vorher = kalMeta().letzte;
  const letzte = {
    // Zählt jeden Versuch – daran erkennt die Karte, ob ihre Meldung überholt
    // ist (die Uhrzeit taugt dafür nicht: zwei Versuche in derselben ms).
    nr: (vorher && Number.isInteger(vorher.nr) ? vorher.nr : 0) + 1,
    art, zeit: Date.now(), ergebnis: a.ergebnis, ok: !!a.ok, version: a.version ?? null,
    hinweis: a.hinweis || '', tag: a.tag || null, geaendert: a.geaendert ?? null, status: a.status ?? null,
    offen: a.offen ?? null, bis: a.bis || null,
    bytes: mehr.bytes ?? null, ziel, wieder: !!mehr.wieder, erschoepft: !!mehr.erschoepft,
    vertrag: mehr.vertrag ?? null, fern: mehr.fern ?? null, gekuerzt: mehr.gekuerzt ?? null,
  };
  const teil = { letzte };
  if (a.ok && ziel) {
    teil.angekommen = {
      zeit: letzte.zeit, version: letzte.version, tag: letzte.tag, ziel, bis: letzte.bis, offen: letzte.offen,
      vertrag: letzte.vertrag, gekuerzt: letzte.gekuerzt,
    };
  }
  // Jede lesbare Antwort sagt, welche Fassung das Skript hat – daran hängt,
  // was als Nächstes hinausgeht (kalVertrag()).
  if (ziel && Number.isInteger(a.version)) teil.fassung = { ziel, version: a.version };
  kalMetaSchreiben(teil);
  // Nur, was die Sendung ergab – nie Kennwort, Adresse oder Hinweistext.
  notieren('kalender', {
    was: art, ergebnis: a.ergebnis, version: a.version ?? undefined, status: a.ergebnis === 'http' ? a.status : undefined,
    geaendert: a.geaendert ?? undefined, offen: a.offen || undefined, bytes: mehr.bytes ?? undefined, rechnen: mehr.rechnen ?? undefined,
    haupt: mehr.haupt ?? undefined, seq: mehr.seq ?? undefined, keepalive: mehr.keepalive || undefined,
    ausgang: mehr.ausgang ?? undefined, wieder: mehr.wieder || undefined, erschoepft: mehr.erschoepft || undefined,
    vertrag: mehr.vertrag ?? undefined, fern: mehr.fern ?? undefined, gekuerzt: mehr.gekuerzt ?? undefined,
  }, art !== 'vorschau' || !a.ok);
}

/**
 * Die Vorschau rechnen und zur Sendung machen. null, wenn es nichts zu
 * schicken gibt – keine Verbindung, oder dieselbe Vorschau ist schon da
 * (`zwingen` schickt trotzdem).
 */
async function kalVorbereiten({ zwingen = false } = {}) {
  if (!kalenderVerbunden()) { kalVorbereitet = null; return null; }
  const nr = kalStandNr;
  // Welche Fassung hinausgeht, steht vor dem Rechnen fest: Für ein Skript der
  // Fassung 1 wird die Ferne gar nicht erst gerechnet.
  const vertrag = kalVertrag();
  kalHauptMs = 0;
  const t0 = performance.now();
  let vorschau;
  try {
    vorschau = await kalRechnen(vertrag >= 2 ? KAL_FERNE : 0);
  } catch (e) {
    kalVorbereitet = null;
    const art = e.code === 'worker' ? 'worker' : 'rechnen';
    const vorher = kalMeta().letzte;
    kalMetaSchreiben({
      letzte: {
        nr: (vorher && Number.isInteger(vorher.nr) ? vorher.nr : 0) + 1,
        art: 'vorschau', zeit: Date.now(), ergebnis: art, ok: false, ziel: kalZiel(store.kalender()),
      },
    });
    notieren('kalender', { was: 'rechnen', ok: false, code: e.code || 'fehler', fehler: String(e.message || '').slice(0, 160) }, true);
    return null;
  }
  const rechnen = Math.round(performance.now() - t0);
  // Während des Rechnens getrennt?
  const k = store.kalender();
  if (!kalenderVerbunden()) { kalVorbereitet = null; return null; }
  const t1 = performance.now();
  const ziel = kalZiel(k);
  // Hat sich die Fassung während des Rechnens geklärt (eine Antwort kam
  // dazwischen), rechnet die nächste Sendung passend – diese geht, wie sie ist.
  const ferne = vertrag >= 2 && vorschau.ferne ? vorschau.ferne : null;
  const kern = {
    minuten: k.minuten, erinnerung: k.erinnerung, ab: vorschau.ab, fenster: vorschau.fenster,
  };
  const hash = kalHash(`${ziel}|${ferne ? 2 : 1}|${JSON.stringify(kern)}|${JSON.stringify(vorschau.texte)}|${JSON.stringify(vorschau.tage)}`
    + `|${ferne ? JSON.stringify(ferne) : ''}`);
  const m = kalMeta();
  const schonDa = m.hash === hash && m.ziel === ziel;
  if (!zwingen && (schonDa || kalVersucht.has(hash))) {
    kalVorbereitet = null;
    kalHauptMs += performance.now() - t1;
    return null;
  }
  const app = kalApp();
  const nutzlast = {
    v: ferne ? 2 : 1, token: k.token, geraet: kalGeraet(), seq: kalSeq(), gesendet: Date.now(), ...(app ? { app } : {}),
    minuten: kern.minuten, erinnerung: kern.erinnerung, ab: kern.ab, fenster: kern.fenster,
    stand: vorschau.stand, texte: vorschau.texte, tage: vorschau.tage, ...(ferne ? { ferne } : {}),
  };
  const text = JSON.stringify(nutzlast);
  const bytes = kalBytes(text);
  kalHauptMs += performance.now() - t1;
  kalVorbereitet = {
    text, hash, bytes, seq: nutzlast.seq, url: k.url, ziel, rechnen, haupt: Math.round(kalHauptMs * 10) / 10, nr, zwingen,
    vertrag: nutzlast.v, fern: ferne ? ferne.bis : null, gekuerzt: ferne ? vorschau.gekuerzt ?? null : null,
    fernMs: Number.isFinite(vorschau.fernMs) ? Math.round(vorschau.fernMs) : null,
  };
  return kalVorbereitet;
}

/** Die Fassung der App (aus dem Namen des Zwischenspeichers), nur zur Anzeige im Skript. */
let kalAppFassung = null;
function kalApp() { return kalAppFassung; }
export function kalenderAppFassung(namen) {
  const f = (namen || []).map(String).map((x) => /^workout-(v\d{1,5})$/.exec(x)).find(Boolean);
  if (f) kalAppFassung = f[1];
}

/** Wie oft hintereinander eine Sendung wegen der Fassung gleich noch einmal hinausging (kalSenden()). */
let kalFassungRunden = 0;

/**
 * Eine vorbereitete Sendung hinaus – und vermerken, was dabei herauskam.
 * Sagt die Antwort, dass das Skript eine andere Fassung des Vertrags kann als
 * die eben geschickte (der neue Code ist da, oder ein älterer weist v 2
 * zurück), geht dieselbe Vorschau gleich noch einmal hinaus, passend.
 */
async function kalSenden(v, { keepalive = false } = {}) {
  if (!v || !kalenderVerbunden() || kalZiel(store.kalender()) !== v.ziel) return null;
  if (v.bytes > (v.vertrag >= 2 ? KAL_MAX_BYTES_2 : KAL_MAX_BYTES)) {
    const a = { ergebnis: 'groesse', ok: false };
    kalVersucht.set(v.hash, 'groesse');
    kalVermerken('vorschau', a, { ziel: v.ziel, bytes: v.bytes, seq: v.seq, vertrag: v.vertrag, fern: v.fern });
    return a;
  }
  kalLetzterVersuch = Date.now();
  const m0 = kalMeta();
  // Ging diese Verbindung schon einmal? Dann ist eine Seite von Google ohne
  // das Skript eher ein Aussetzer als eine falsche Einrichtung.
  const bewaehrt = !!(m0.angekommen && m0.angekommen.ziel === v.ziel);
  const erg = await kalSchicken(v.url, v.text, { keepalive });
  const a = await kalLesen(erg);
  if (kalVorbereitet === v) kalVorbereitet = null;
  let ausgang;
  let wieder = false;
  let erschoepft = false;
  if (a.ok) {
    kalMetaSchreiben({ hash: v.hash, ziel: v.ziel, offen: false });
    kalWiederWeg();
    kalAusgangLeeren();
  } else if (KAL_NOCHMAL.has(a.ergebnis)) {
    kalMetaSchreiben({ offen: true });
    // Auch in den Ausgang: Schließt Tobi die App gleich nach dem Training,
    // schickt der Service Worker sie nach (sw.js) – bei bestehendem Netz
    // sofort, und ist das Skript noch beschäftigt, einige Minuten später.
    ausgang = await kalAusgangLegen(v);
    wieder = kalWiederPlanen(v);
    erschoepft = !wieder;
  } else if ((a.ergebnis === 'undurchsichtig' || a.ergebnis === 'http') && bewaehrt && !keepalive && kalWiederPlanen(v)) {
    wieder = true;
  } else if (KAL_ENDGUELTIG.has(a.ergebnis)) {
    kalVersucht.set(v.hash, a.ergebnis);
    kalMetaSchreiben({ offen: false });
    kalAusgangLeeren();
  }
  kalVermerken('vorschau', a, {
    ziel: v.ziel, bytes: v.bytes, rechnen: v.rechnen, haupt: v.haupt, seq: v.seq, keepalive, ausgang, wieder, erschoepft,
    vertrag: v.vertrag, fern: v.fern, gekuerzt: v.gekuerzt,
  });
  // Die Fassung hat sich geklärt: dieselbe Vorschau gleich noch einmal, passend.
  // Nicht beim Wegschalten – die Seite friert gleich ein; dann der nächste Anlass.
  // Neu gezeichnet wird erst danach: Wies ein Skript der Fassung 1 v 2 zurück
  // („erneuern"), stünde sonst bis zur Sendung als v 1 kurz eine Warnzeile da.
  // Höchstens zweimal hintereinander: Fände die Rechnung nie zur Fassung des
  // Skripts (etwa ein Worker aus einem älteren Zwischenspeicher, der die Ferne
  // nicht kennt), schickte die App sonst ohne Ende.
  if (!keepalive && Number.isInteger(a.version) && kalVertrag(v.ziel) !== v.vertrag) {
    const nochmal = kalFassungRunden < 2;
    kalFassungRunden += 1;
    notieren('kalender', {
      was: 'fassung', von: v.vertrag, nach: kalVertrag(v.ziel), version: a.version, aufgegeben: nochmal ? undefined : true,
    }, !nochmal);
    if (nochmal) {
      kalenderJetzt('fassung', { zwingen: true }).then(() => kalRuf.nachher());
      return a;
    }
  } else if (Number.isInteger(a.version)) {
    kalFassungRunden = 0;
  }
  kalRuf.nachher();
  return a;
}

/**
 * Ist der neue Code schon da? Nur, solange er aussteht (die Fassung des
 * Skripts ist bekannt und älter als die Vorlage), und höchstens einmal je
 * zwei Minuten: eine Probe, die beim Skript nichts speichert. Meldet sie die
 * neue Fassung, geht die Vorschau gleich mit dem Jahr hinaus (kalSenden()
 * über kalVermerken()). Tobi kommt aus Apps Script zurück in die App – und
 * sie merkt es von selbst.
 */
let kalFassungGefragt = 0;
async function kalFassungFragen() {
  const k = store.kalender();
  const ziel = kalZiel(k);
  if (!ziel || !kalNeuerCode(kalFassung(ziel)) || Date.now() - kalFassungGefragt < KAL_FASSUNG_FRAGEN) return null;
  kalFassungGefragt = Date.now();
  const probe = JSON.stringify({ v: 1, token: k.token, geraet: kalGeraet(), seq: kalSeq(), gesendet: Date.now(), probe: true });
  const a = await kalLesen(await kalSchicken(k.url, probe, { abbruch: KAL_PROBE_ABBRUCH }));
  // Nur eine lesbare Antwort zählt; ein Netzfehler ist kein Befund.
  if (!Number.isInteger(a.version)) return a;
  const vorher = kalVertrag(ziel);
  kalMetaSchreiben({ fassung: { ziel, version: a.version } });
  notieren('kalender', { was: 'fassung-frage', version: a.version });
  if (kalVertrag(ziel) !== vorher) {
    kalVorbereitet = null;
    kalenderJetzt('fassung', { zwingen: true });
  }
  kalRuf.nachher();
  return a;
}

function kalPlanen() {
  if (kalSendenUhr) return;
  const jetzt = Date.now();
  const warte = Math.max(0, kalGeaendertUm + KAL_ERSTE - jetzt, kalLetzterVersuch + KAL_DROSSEL - jetzt);
  kalSendenUhr = setTimeout(() => {
    kalSendenUhr = null;
    kalEinreihen(async () => {
      // Ist seitdem etwas passiert, frisch rechnen statt Altes schicken.
      const fertig = kalVorbereitet && kalVorbereitet.nr === kalStandNr ? kalVorbereitet : null;
      const v = fertig || await kalVorbereiten();
      if (v) await kalSenden(v, { keepalive: !!document.hidden && v.bytes <= KAL_MAX_BYTES });
    });
  }, warte);
}

/**
 * Woran die App erkennt, dass es sofort hinaus muss: eine Einheit bekommt ihren
 * ersten Eintrag (startedOn) oder wird abgeschlossen (done), oder Fokus und
 * Runde wechseln. Ein Vergleich über die Einträge des Protokolls je Meldung des
 * Stores – kein Rechnen.
 */
function kalZeichen(s) {
  const log = (s && s.log) || {};
  let z = `${s && s.focus}|${((s && s.rounds) || []).length}|`;
  Object.keys(log).forEach((n) => {
    const e = log[n];
    if (!e || typeof e !== 'object') return;
    if (e.startedOn) z += `${n}s${e.startedOn}`;
    if (e.done) z += `${n}d`;
  });
  return z;
}

/* ------------------------------------------------------------------ *
 * Was die App aufruft
 * ------------------------------------------------------------------ */

/**
 * Die App sagt, wie sie neu zeichnet (`nachher` nach jedem Versuch – dort
 * entscheidet sie, ob es sich lohnt).
 */
export function kalenderEinrichten(ruf = {}) {
  kalRuf = { nachher: () => {}, ...ruf };
  kalZeichenVorher = kalZeichen(store.getState());
  window.addEventListener('online', () => {
    if (!kalenderMoeglich()) return;
    if ((kalMeta().aus || []).length) kalEinreihen(kalAusErledigen).then(() => kalRuf.nachher());
    if (kalenderVerbunden() && kalMeta().offen) kalenderJetzt('online');
  });
}

/** Nach jeder Meldung des Stores: sofort, wenn eine Einheit anfängt oder fertig wird, sonst gedrosselt. */
export function kalenderGeaendert() {
  if (!kalenderVerbunden()) return;
  kalStandNr += 1;
  kalGeaendertUm = Date.now();
  const z = kalZeichen(store.getState());
  const anders = z !== kalZeichenVorher;
  kalZeichenVorher = z;
  if (anders) {
    kalenderJetzt('einheit');
    return;
  }
  clearTimeout(kalVorbereitenUhr);
  kalVorbereitenUhr = setTimeout(() => {
    kalVorbereitenUhr = null;
    kalEinreihen(async () => { if (await kalVorbereiten()) kalPlanen(); });
  }, KAL_VORBEREITEN);
}

/** Sofort, an der Drossel vorbei: Einheit fertig, Uhrzeit oder Erinnerung geändert, eben verbunden. */
export function kalenderJetzt(grund = 'jetzt', { zwingen = false } = {}) {
  if (!kalenderVerbunden()) return Promise.resolve(null);
  kalAnhalten();
  return kalEinreihen(async () => {
    const v = await kalVorbereiten({ zwingen });
    if (!v) return null;
    notieren('kalender', { was: 'anlass', grund });
    return kalSenden(v);
  });
}

/**
 * Beim Start: ausstehendes Abschalten zuerst, dann die Vorschau – wie die App
 * sie nach ihrem Start rechnet. Was in der letzten Sitzung endgültig
 * abgewiesen wurde, darf jetzt noch einmal: Vielleicht ist es inzwischen
 * gerichtet.
 */
export function kalenderStart() {
  // Nie eingerichtet und nichts offen: beim Start gar nichts tun – kein
  // Zeitgeber, kein Blick in den Zwischenspeicher.
  if (!kalenderMoeglich() || !(kalenderVerbunden() || (kalMeta().aus || []).length)) return;
  setTimeout(() => {
    kalNachLesen();
    try { if (window.caches) caches.keys().then(kalenderAppFassung).catch(() => {}); } catch { /* ohne Fassung */ }
    if ((kalMeta().aus || []).length) kalEinreihen(kalAusErledigen).then(() => kalRuf.nachher());
    if (!kalenderVerbunden()) return;
    kalEinreihen(async () => {
      await kalenderVorlage().catch(() => null);
      const v = await kalVorbereiten();
      // Ging nichts hinaus (dieselbe Vorschau ist schon da), fragt die App,
      // ob der neue Code inzwischen im Skript steht – nur, solange er aussteht.
      if (v) await kalSenden(v);
      else await kalFassungFragen();
    });
  }, KAL_START);
}

/**
 * Beim Wegschalten: was fertig gerechnet bereitliegt, mit keepalive hinterher
 * – im selben Takt, ohne await davor. Nicht, solange in der Warteschlange
 * etwas läuft (das ist dann der neueste Stand). Geht es nicht (keepalive
 * teilt sich die 64 KiB mit der Sicherung, die eben hinausging), legt
 * kalSenden() es in den Ausgang. Über 64 KiB – ein Jahr mit vielen Terminen –
 * trägt keepalive gar nicht: Dann gleich in den Ausgang, und der Service
 * Worker schickt es, ohne Grenze und auch bei geschlossener App.
 */
export function kalenderVerstecken() {
  if (!kalenderVerbunden() || kalBelegt > 0) return;
  const v = kalVorbereitet;
  if (!v) return;
  kalAnhalten();
  if (v.bytes > KAL_MAX_BYTES) {
    kalEinreihen(async () => {
      const ausgang = await kalAusgangLegen(v);
      if (ausgang) kalMetaSchreiben({ offen: true });
      notieren('kalender', { was: 'ausgang', grund: 'gross', bytes: v.bytes, ausgang }, true);
    });
    return;
  }
  kalEinreihen(() => kalSenden(v, { keepalive: true }));
}

/**
 * Wieder da: Hat der Service Worker inzwischen nachgeschickt? Und steht der
 * letzte Versuch noch offen (kein Netz, Skript beschäftigt, keine Antwort),
 * gleich noch einmal – die Seite kam vielleicht nach Stunden aus dem
 * Speicher zurück, und ihre Zeitgeber liefen solange nicht. Nicht öfter als
 * einmal je Minute. Ging die letzte Vorschau beim Wegschalten in einer
 * Fassung des Vertrags hinaus, die nicht zum Skript passt (die Antwort
 * sagte es, aber nachschicken durfte die Seite da nicht mehr), jetzt passend.
 */
export function kalenderSichtbar() {
  if (!kalenderVerbunden()) return;
  kalNachLesen().then(() => kalRuf.nachher());
  const m = kalMeta();
  const ziel = kalZiel(store.kalender());
  const l = m.letzte;
  if (l && l.ziel === ziel && l.art === 'vorschau' && Number.isInteger(l.vertrag) && l.vertrag !== kalVertrag(ziel)) {
    kalenderJetzt('fassung', { zwingen: true });
  } else if (m.offen && Date.now() - kalLetzterVersuch > 60 * 1000) {
    kalenderJetzt('sichtbar');
  } else if (kalNeuerCode(kalFassung(ziel))) {
    // Steht neuer Code aus, kommt Tobi vielleicht gerade aus Apps Script zurück.
    kalEinreihen(kalFassungFragen);
  }
}

/**
 * „Verbinden": erst fragen, dann merken. Die Probe ({ probe: true }) speichert
 * beim Skript nichts und braucht eine lesbare Antwort – sonst wüsste niemand,
 * ob das, was die URL beantwortet, überhaupt das Skript ist. Gibt
 * { ok, satz, hinweis } zurück. War vorher eine andere Adresse verbunden, geht
 * an sie ein „aus": Sonst schöbe ihr Skript den Kalender nach seiner letzten
 * Vorschau weiter (das neue Projekt übernimmt den Kalender ohnehin, siehe
 * Skript-Kennung im Skript).
 */
export async function kalenderVerbinden(eingabe) {
  const u = kalenderUrlPruefen(eingabe);
  if (u.fehler) return { ok: false, satz: u.fehler };
  if (!kalenderMoeglich()) return { ok: false, satz: 'Das geht nur in der App aus dem Netz, nicht in dieser Datei.' };
  const k = store.kalender();
  if (!k || !k.token) {
    return { ok: false, satz: 'Erst „Code kopieren" und den Code in Apps Script einfügen – darin steckt das Kennwort, an dem das Skript die App erkennt.' };
  }
  return kalEinreihen(async () => {
    // Die Fassung der Vorlage, damit die Antwort sagen kann, ob der Code alt ist.
    await kalenderVorlage().catch(() => null);
    // v 1: Probe und „aus" versteht jede Fassung des Skripts gleich.
    const probe = JSON.stringify({ v: 1, token: k.token, geraet: kalGeraet(), seq: kalSeq(), gesendet: Date.now(), probe: true });
    const a = await kalLesen(await kalSchicken(u.url, probe, { abbruch: KAL_PROBE_ABBRUCH }));
    const neu = { url: u.url, token: k.token };
    kalVermerken('probe', a, { ziel: kalZiel(neu) });
    const nr = (kalMeta().letzte || {}).nr ?? null;
    if (!(a.ok && a.ergebnis === 'probe')) {
      // Bei der Probe heißt keine Antwort nur: noch einmal fragen.
      let satz = a.ergebnis === 'zeit'
        ? 'Keine Antwort nach 30 Sekunden – noch einmal „Verbinden" tippen. Beim allerersten Aufruf braucht Google manchmal länger.'
        : kalenderSatz(a) || `Das Skript sagt: ${a.ergebnis}.`;
      let befund;
      if (a.ergebnis === 'undurchsichtig') {
        befund = await kalGetFragen(u.url);
        satz = kalUndurchsichtigSatz(befund) || satz;
        notieren('kalender', { was: 'probe-get', befund }, true);
      }
      return { ok: false, satz, ergebnis: a.ergebnis, befund, nr };
    }
    const alt = store.kalender();
    if (alt && alt.url && alt.url !== u.url) kalAusDazu(alt);
    // Ein „aus" an genau diese Adresse, das noch wartete, gilt nicht mehr.
    kalMetaSchreiben({ aus: (kalMeta().aus || []).filter((x) => x.url !== u.url) });
    // Vor dem Speichern: Das meldet der Store sofort (kalenderGeaendert()),
    // und mit einem alten Zeichen ginge dieselbe Vorschau zweimal hinaus.
    kalZeichenVorher = kalZeichen(store.getState());
    kalWiederWeg();
    store.setzeKalender({ url: u.url });
    // Erst danach: ein Abschalten an die alte Adresse, und gleich die erste Vorschau.
    if ((kalMeta().aus || []).length) kalEinreihen(kalAusErledigen);
    kalEinreihen(async () => {
      const v = await kalVorbereiten({ zwingen: true });
      if (v) await kalSenden(v);
    });
    return {
      ok: true, satz: a.hinweis || 'Verbunden.', hinweis: a.hinweis || '', zuAlt: kalZuAlt(a), handeln: kalenderHandeln(a), nr,
      neuerCode: kalNeuerCode(a.version),
    };
  }).then((r) => r || { ok: false, satz: 'Das ging gerade nicht – noch einmal versuchen.' });
}

/**
 * „Google hat geantwortet, aber nicht das Skript" hat drei häufige Ursachen –
 * die App fragt nach, statt Tobi zwischen ihnen wählen zu lassen. Ein
 * einfacher GET an dieselbe Adresse (doGet, öffentlich, ohne Kennwort):
 *
 *   'status'    lesbar, code 'status' – der neue Code ist bereitgestellt,
 *               „Zugriff: Jeder" stimmt; das Senden kam trotzdem nicht durch
 *   'alt'       lesbar, aber ohne code 'status' – die Web-App läuft noch mit
 *               dem Code der Probe („Neue Version" vergessen)
 *   'gesperrt'  eine Seite ohne CORS-Freigabe (Anmeldeseite bei „Jeder mit
 *               Google-Konto" oder „Ausführen als: Nutzer", Fehlerseite bei
 *               einer falschen Adresse)
 *   'netz'      auch der GET kam nicht durch – dann bleibt der lange Satz
 */
async function kalGetFragen(url) {
  const ctrl = new AbortController();
  const uhr = setTimeout(() => ctrl.abort(), 20000);
  try {
    let res;
    try {
      res = await fetch(url, { method: 'GET', credentials: 'omit', redirect: 'follow', signal: ctrl.signal });
    } catch {
      if (ctrl.signal.aborted) return 'netz';
      try {
        await fetch(url, { method: 'GET', mode: 'no-cors', credentials: 'omit', redirect: 'follow', signal: ctrl.signal });
        return 'gesperrt';
      } catch {
        return 'netz';
      }
    }
    let j = null;
    try { j = JSON.parse(await res.text()); } catch { j = null; }
    if (j && typeof j === 'object' && j.code === 'status') return 'status';
    if (j && typeof j === 'object') return 'alt';
    return 'gesperrt';
  } finally {
    clearTimeout(uhr);
  }
}

/** Der eine Satz zu dem, was der GET ergab – oder '' (dann bleibt der lange). */
function kalUndurchsichtigSatz(befund) {
  switch (befund) {
    case 'status':
      return 'Der neue Code ist bereitgestellt, aber das Senden kam bei ihm nicht an. Noch einmal „Verbinden" tippen – '
        + 'kommt das wieder, dem Assistenten Bescheid geben.';
    case 'alt':
      return 'Die Web-App läuft noch mit dem Code der Probe: In Apps Script Bereitstellen → Bereitstellungen verwalten → '
        + 'Bearbeiten (Stift) → Version: Neue Version → Bereitstellen, dann hier noch einmal „Verbinden".';
    case 'gesperrt':
      return 'Google lässt die App nicht zum Skript durch: Bei der Bereitstellung muss „Zugriff: Jeder" stehen (nicht '
        + '„Jeder mit Google-Konto") und „Ausführen als: Ich" – Bereitstellen → Bereitstellungen verwalten → Bearbeiten '
        + '(Stift), beides einstellen, Version: Neue Version → Bereitstellen. Stimmt beides, ist die URL nicht die aus '
        + '„Bereitstellungen verwalten".';
    default:
      return '';
  }
}

/* ------------------------------------------------------------------ *
 * Trennen
 * ------------------------------------------------------------------ */

function kalAusDazu(k) {
  const job = { url: k.url, token: k.token, geraet: kalGeraet(), seq: kalSeq(), gesendet: Date.now() };
  kalMetaSchreiben({ aus: [...(kalMeta().aus || []).filter((x) => x.url !== k.url), job].slice(-4) });
}

/**
 * Alle ausstehenden „aus" schicken. Weg ist eins, sobald das Skript es
 * angenommen hat – oder sobald klar ist, dass es nie angenommen wird
 * (falsches Kennwort, keine Antwort vom Skript). Ohne Netz bleibt es liegen.
 */
async function kalAusErledigen() {
  let letztes = null;
  for (const job of kalMeta().aus || []) {
    if (!job || !store.KALENDER_URL.test(job.url || '')) continue;
    const text = JSON.stringify({ v: 1, token: job.token, geraet: job.geraet, seq: job.seq, gesendet: job.gesendet, aus: true });
    const a = await kalLesen(await kalSchicken(job.url, text, { abbruch: KAL_ABBRUCH }));
    letztes = a;
    notieren('kalender', { was: 'aus', ergebnis: a.ergebnis, version: a.version ?? undefined, geaendert: a.geaendert ?? undefined }, true);
    if (!['netz', 'zeit', 'fehler'].includes(a.ergebnis)) {
      kalMetaSchreiben({ aus: (kalMeta().aus || []).filter((x) => x.url !== job.url || x.seq !== job.seq) });
    }
  }
  return letztes;
}

/**
 * „Trennen": Das Skript bekommt ein „aus" (eigene Termine ab heute weg, nichts
 * mehr angleichen), die App vergisst die Adresse. Das Kennwort bleibt – es
 * steht ja noch im Skript, und ein erneutes „Verbinden" mit derselben URL
 * braucht dann keinen neuen Code. Ohne Netz geht das „aus" nach, sobald
 * welches da ist. { ok, wartet, satz }.
 */
export async function kalenderTrennen() {
  const k = store.kalender();
  if (!k || !k.url) return { ok: true, wartet: false, satz: '' };
  kalAnhalten();
  kalWiederWeg();
  kalVorbereitet = null;
  kalAusDazu(k);
  store.setzeKalender({ url: null });
  kalMetaSchreiben({ hash: null, ziel: null, offen: false });
  await kalAusgangLeeren();
  const a = await kalEinreihen(kalAusErledigen);
  const wartet = (kalMeta().aus || []).length > 0;
  kalRuf.nachher();
  if (wartet) return { ok: true, wartet, satz: 'Getrennt. Beim Skript kam das noch nicht an (kein Netz) – die App schickt es nach, sobald Netz da ist.' };
  if (a && a.ergebnis === 'aus') return { ok: true, wartet, satz: 'Getrennt – die Termine ab heute verschwinden aus „Workout".' };
  return { ok: true, wartet, satz: `Getrennt. ${kalenderSatz(a) || 'Ob die Termine weg sind, zeigt der Kalender „Workout".'}` };
}

/**
 * Für „Alle Daten löschen": Das Skript soll aufhören, nach dem alten Stand zu
 * schieben. Das „aus" überlebt das Löschen (eigener Schlüssel) und geht nach,
 * wenn gerade kein Netz ist. Die Gerätekennung bleibt – sie hängt an diesem
 * Gerät, nicht am Training.
 */
export function kalenderVergessen() {
  const k = store.kalender();
  kalAnhalten();
  kalWiederWeg();
  kalVorbereitet = null;
  if (k && k.url) kalAusDazu(k);
  kalMetaSchreiben({ hash: null, ziel: null, offen: false, letzte: null, angekommen: null, nach: null });
  kalAusgangLeeren();
  if ((kalMeta().aus || []).length && kalenderMoeglich()) kalEinreihen(kalAusErledigen);
}

/* ------------------------------------------------------------------ *
 * Was die Karte zeigt
 * ------------------------------------------------------------------ */

/**
 * Die Lage für die Karte unter Mehr und das Dashboard – synchron, ohne Netz.
 * `letzte` und `angekommen` nur, wenn sie zur jetzigen Verbindung gehören.
 *
 *   fassung    die Fassung des Skripts dieser Verbindung, soweit bekannt
 *   vertrag    was als Nächstes hinausgeht: 1 oder 2
 *   neuerCode  im Skript steht ältere Fassung als in der Vorlage – die Karte
 *              bittet um den neuen Code (KALENDER_JAHR)
 *   gesehen    Tobi hat die Bitte schon gesehen (Ansehen, Code kopieren) –
 *              dann nicht mehr auf dem Dashboard
 */
export function kalenderLage() {
  const k = store.kalender();
  const m = kalMeta();
  const ziel = kalZiel(k);
  const letzte = m.letzte && ziel && m.letzte.ziel === ziel ? m.letzte : null;
  const angekommen = m.angekommen && ziel && m.angekommen.ziel === ziel ? m.angekommen : null;
  const fassung = kalFassung(ziel);
  const vorlage = kalenderVorlageFassung();
  return {
    moeglich: kalenderMoeglich(),
    token: !!(k && k.token),
    verbunden: !!ziel,
    minuten: k ? k.minuten : 17 * 60 + 30,
    erinnerung: k ? k.erinnerung : 30,
    letzte,
    angekommen,
    nach: m.nach || null,
    ausstehend: (m.aus || []).length,
    zuAlt: kalZuAlt(letzte),
    handeln: !!ziel && kalenderHandeln(letzte),
    vorlage,
    fassung,
    vertrag: kalVertrag(ziel),
    neuerCode: !!ziel && kalNeuerCode(fassung),
    gesehen: !!vorlage && m.gesehen === vorlage,
  };
}

/** Tobi hat die Bitte um neuen Code gesehen (Ansehen, Code kopieren) – nicht mehr auf dem Dashboard. */
export function kalenderJahrGesehen() {
  const v = kalenderVorlageFassung();
  if (v && kalMeta().gesehen !== v) kalMetaSchreiben({ gesehen: v });
}

/** Für den Kopf des Diagnoseprotokolls – ohne Kennwort, ohne Adresse. */
export function kalenderKurz() {
  const l = kalenderLage();
  if (!l.moeglich) return 'Kalender: hier nicht möglich';
  if (!l.verbunden) return `Kalender: ${l.token ? 'Code kopiert, nicht verbunden' : 'nicht eingerichtet'}${l.ausstehend ? ` · ${l.ausstehend} Abschalten offen` : ''}`;
  const z = (t) => {
    const d = new Date(t);
    return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}. ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };
  return `Kalender verbunden${l.angekommen ? `, zuletzt angekommen ${z(l.angekommen.zeit)}${l.angekommen.version ? ` (Skript ${l.angekommen.version})` : ''}` : ', noch nichts angekommen'}`
    + ` · Vertrag ${l.vertrag}${l.neuerCode ? ' · neuer Code steht aus' : ''}`
    + `${l.letzte && !l.letzte.ok ? ` · zuletzt ${l.letzte.ergebnis}` : ''}${l.ausstehend ? ` · ${l.ausstehend} Abschalten offen` : ''}`;
}
