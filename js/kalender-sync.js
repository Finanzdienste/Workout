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
 * **Wann.** Nur mit Verbindung (state.kalender mit url), und nur, wenn sich die
 * Vorschau seit der zuletzt angekommenen geändert hat – ein Training, in dem
 * nur Sätze dazukommen, ändert sie erst mit dem Abschluss:
 *
 *   erster Haken einer Einheit   sofort. Ab da steht sie auf heute fest; ohne
 *                                Sendung schöbe der Kalender sie morgen als
 *                                verpasst weiter.
 *   Abschluss einer Einheit      sofort (auch aus einheitBeenden() in js/app.js)
 *   jede andere Änderung         gerechnet 2 s danach, geschickt frühestens
 *                                5 s danach und höchstens alle zwei Minuten
 *   Start                        3 s nach dem Laden: Ein neuer Tag ist eine
 *                                neue Vorschau, und die sechs Wochen zählen
 *                                ab dem letzten Öffnen.
 *   „online"                     wenn der letzte Versuch am Netz scheiterte
 *   Wegschalten                  nur, was schon fertig gerechnet bereitliegt
 *                                und unter 64 KiB bleibt (keepalive) – danach
 *                                friert die Seite ein
 *   ohne Netz                    der Service Worker schickt die Vorschau nach,
 *                                sobald wieder Netz da ist, auch bei
 *                                geschlossener App (Background Sync – Chrome
 *                                und Android; Safari kennt es nicht)
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
 * Version" vergessen) oder eine falsche Adresse. Die Sendung ist idempotent;
 * zweimal dieselbe schadet nicht.
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

// Der Vertrag (js/kalender-vorschau.js): Fassung und Größe. Hier noch einmal,
// weil dieses Modul jenes nicht laden darf – im Fenster holte es sonst die
// Rechenmodule an der App vorbei, und im Bündel kollidierten die Namen.
// tests/test-kalender-sync.mjs vergleicht beide.
const KAL_VERTRAG = 1;
const KAL_MAX_BYTES = 64 * 1024;

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
const KAL_ENDGUELTIG = new Set(['token', 'format', 'undurchsichtig', 'http', 'aelter', 'alt', 'zeit', 'groesse']);
const KAL_CODES = new Set(['angekommen', 'gleich', 'probe', 'aus', 'token', 'format', 'alt', 'aelter', 'fehler']);

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
 *               hinweis, tag, geaendert, bytes, status, ziel }
 *   angekommen  der letzte, der ankam: { zeit, version, tag, ziel }
 *   offen       der letzte Versuch scheiterte am Netz (oder das Skript war
 *               beschäftigt) – „online" holt ihn nach
 *   aus         Abschalten, das noch nicht beim Skript ist: [{ url, token,
 *               geraet, seq, gesendet }] – bis es ankommt, beim Start und bei
 *               „online" wieder versucht
 *   nach        was der Service Worker im Hintergrund nachgeschickt hat
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

function kalRechnenLassen() {
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
      id: kalNr, zustand: { ...store.getState(), kalender: null }, jetzt: Date.now(), wartet: abschlussWartetAm(),
    });
    kalHauptMs += performance.now() - t0;
  });
}

/** Rechnen – mit einem frischen Worker, wenn der alte einen anderen Fokus geladen hat. */
async function kalRechnen() {
  try {
    return await kalRechnenLassen();
  } catch (e) {
    if (e.code !== 'fokus') throw e;
    kalWorkerWeg();
    return kalRechnenLassen();
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
  return {
    ergebnis: KAL_CODES.has(roh.code) ? roh.code : 'fehler',
    ok: roh.ok === true,
    version: Number.isInteger(roh.version) ? roh.version : null,
    hinweis: typeof roh.hinweis === 'string' ? roh.hinweis.slice(0, 300) : '',
    tag: typeof roh.tag === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(roh.tag) ? roh.tag : null,
    geaendert: Number.isInteger(roh.geaendert) ? roh.geaendert : null,
    status: res.status,
  };
}

/** Bittet das Skript, sich zu erneuern? Ältere Fassung als die Vorlage, oder es kennt den Vertrag nicht. */
const kalZuAlt = (a) => !!a && ((a.ergebnis === 'format' && /erneuern/i.test(a.hinweis || ''))
  || (Number.isInteger(a.version) && kalVorlage && a.version < kalVorlage.fassung));

/**
 * Der Satz zu einem Ergebnis – für „Verbinden", die Karte und das Dashboard.
 * Jeder sagt, was zu tun ist, nicht nur, was schiefging.
 */
export function kalenderSatz(a) {
  if (!a) return '';
  if (kalZuAlt(a)) {
    return 'Kalender-Code erneuern: Der Code in Apps Script ist älter als die App. „Code kopieren", in Apps Script den '
      + 'ganzen Code ersetzen, speichern, „einrichten" ausführen, dann Bereitstellen → Bereitstellungen verwalten → '
      + 'Bearbeiten (Stift) → Version: Neue Version → Bereitstellen.';
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
      return 'Die Vorschau ist größer als die 64 KiB, die das Skript annimmt – sie geht nicht hinaus.';
    case 'worker':
      return 'Die Vorschau lässt sich in diesem Browser nicht rechnen (kein Modul-Worker).';
    case 'rechnen':
      return 'Die Vorschau ließ sich nicht rechnen – das ist ein Fehler der App. Bitte dem Assistenten das '
        + 'Diagnoseprotokoll schicken (Mehr → Daten).';
    case 'format':
      return `Das Skript hat die Sendung nicht angenommen${a.hinweis ? `: ${a.hinweis}` : '.'}`;
    default:
      return a.hinweis || 'Das Skript meldet einen Fehler.';
  }
}

/**
 * Braucht es Tobi? Für die eine Zeile auf dem Dashboard – nur, was er selbst
 * richten muss. Netz, ein anderes Gerät, eine ausgebliebene Antwort richten
 * sich von selbst und stehen nur unter Mehr.
 */
export function kalenderHandeln(a) {
  if (!a) return false;
  if (kalZuAlt(a)) return true;
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
 * verpasst und schöbe es weiter. Wo es Background Sync gibt (Chrome, Android),
 * legt die App die fertige Sendung deshalb in den Ausgang und bittet den
 * Browser um ein „sync", sobald wieder Netz da ist. Das bekommt der Service
 * Worker auch bei geschlossener App (sw.js, kalenderNachsenden()). Er schickt
 * ohne CORS – die Antwort kann er ohnehin niemandem zeigen – und vermerkt nur,
 * dass es hinausging; was das Skript dazu sagt, erfährt die App mit ihrer
 * nächsten eigenen Sendung.
 * ------------------------------------------------------------------ */

const kalAusgangSchluessel = () => new URL('kalender-ausgang', location.href).href;
const kalNachSchluessel = () => new URL('kalender-ausgang-nach', location.href).href;

async function kalAusgangLegen(url, text, seq) {
  try {
    if (!window.caches || !navigator.serviceWorker) return false;
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg || !reg.sync) return false;
    const c = await caches.open(KALENDER_AUSGANG);
    await c.put(kalAusgangSchluessel(), new Response(JSON.stringify({ url, text, seq, gelegt: Date.now() }),
      { headers: { 'content-type': 'application/json' } }));
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
    kalMetaSchreiben({ nach: { zeit: n.zeit, seq: Number.isInteger(n.seq) ? n.seq : null } });
    notieren('kalender', { was: 'nachgesendet', seq: n.seq, lesbar: false });
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
  const letzte = {
    art, zeit: Date.now(), ergebnis: a.ergebnis, ok: !!a.ok, version: a.version ?? null,
    hinweis: a.hinweis || '', tag: a.tag || null, geaendert: a.geaendert ?? null, status: a.status ?? null,
    bytes: mehr.bytes ?? null, ziel,
  };
  const teil = { letzte };
  if (a.ok && ziel) teil.angekommen = { zeit: letzte.zeit, version: letzte.version, tag: letzte.tag, ziel };
  kalMetaSchreiben(teil);
  // Nur, was die Sendung ergab – nie Kennwort, Adresse oder Hinweistext.
  notieren('kalender', {
    was: art, ergebnis: a.ergebnis, version: a.version ?? undefined, status: a.ergebnis === 'http' ? a.status : undefined,
    geaendert: a.geaendert ?? undefined, bytes: mehr.bytes ?? undefined, rechnen: mehr.rechnen ?? undefined,
    haupt: mehr.haupt ?? undefined, seq: mehr.seq ?? undefined, keepalive: mehr.keepalive || undefined,
    ausgang: mehr.ausgang ?? undefined,
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
  kalHauptMs = 0;
  const t0 = performance.now();
  let vorschau;
  try {
    vorschau = await kalRechnen();
  } catch (e) {
    kalVorbereitet = null;
    const art = e.code === 'worker' ? 'worker' : 'rechnen';
    kalMetaSchreiben({ letzte: { art: 'vorschau', zeit: Date.now(), ergebnis: art, ok: false, ziel: kalZiel(store.kalender()) } });
    notieren('kalender', { was: 'rechnen', ok: false, code: e.code || 'fehler', fehler: String(e.message || '').slice(0, 160) }, true);
    return null;
  }
  const rechnen = Math.round(performance.now() - t0);
  // Während des Rechnens getrennt?
  const k = store.kalender();
  if (!kalenderVerbunden()) { kalVorbereitet = null; return null; }
  const t1 = performance.now();
  const ziel = kalZiel(k);
  const kern = {
    minuten: k.minuten, erinnerung: k.erinnerung, ab: vorschau.ab, fenster: vorschau.fenster,
  };
  const hash = kalHash(`${ziel}|${KAL_VERTRAG}|${JSON.stringify(kern)}|${JSON.stringify(vorschau.texte)}|${JSON.stringify(vorschau.tage)}`);
  const m = kalMeta();
  const schonDa = m.hash === hash && m.ziel === ziel;
  if (!zwingen && (schonDa || kalVersucht.has(hash))) {
    kalVorbereitet = null;
    kalHauptMs += performance.now() - t1;
    return null;
  }
  const app = kalApp();
  const nutzlast = {
    v: KAL_VERTRAG, token: k.token, geraet: kalGeraet(), seq: kalSeq(), gesendet: Date.now(), ...(app ? { app } : {}),
    minuten: kern.minuten, erinnerung: kern.erinnerung, ab: kern.ab, fenster: kern.fenster,
    stand: vorschau.stand, texte: vorschau.texte, tage: vorschau.tage,
  };
  const text = JSON.stringify(nutzlast);
  const bytes = kalBytes(text);
  kalHauptMs += performance.now() - t1;
  kalVorbereitet = {
    text, hash, bytes, seq: nutzlast.seq, url: k.url, ziel, rechnen, haupt: Math.round(kalHauptMs * 10) / 10, nr,
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

/** Eine vorbereitete Sendung hinaus – und vermerken, was dabei herauskam. */
async function kalSenden(v, { keepalive = false } = {}) {
  if (!v || !kalenderVerbunden() || kalZiel(store.kalender()) !== v.ziel) return null;
  if (v.bytes > KAL_MAX_BYTES) {
    const a = { ergebnis: 'groesse', ok: false };
    kalVersucht.set(v.hash, 'groesse');
    kalVermerken('vorschau', a, { ziel: v.ziel, bytes: v.bytes, seq: v.seq });
    return a;
  }
  kalLetzterVersuch = Date.now();
  const erg = await kalSchicken(v.url, v.text, { keepalive });
  const a = await kalLesen(erg);
  if (kalVorbereitet === v) kalVorbereitet = null;
  let ausgang;
  if (a.ok) {
    kalMetaSchreiben({ hash: v.hash, ziel: v.ziel, offen: false });
    kalAusgangLeeren();
  } else if (a.ergebnis === 'netz') {
    kalMetaSchreiben({ offen: true });
    ausgang = await kalAusgangLegen(v.url, v.text, v.seq);
  } else if (a.ergebnis === 'fehler') {
    kalMetaSchreiben({ offen: true });
  } else if (KAL_ENDGUELTIG.has(a.ergebnis)) {
    kalVersucht.set(v.hash, a.ergebnis);
    kalMetaSchreiben({ offen: false });
    kalAusgangLeeren();
  }
  kalVermerken('vorschau', a, {
    ziel: v.ziel, bytes: v.bytes, rechnen: v.rechnen, haupt: v.haupt, seq: v.seq, keepalive, ausgang,
  });
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
      if (v) await kalSenden(v);
    });
  }, KAL_START);
}

/**
 * Beim Wegschalten: was fertig gerechnet bereitliegt, mit keepalive hinterher
 * – im selben Takt, ohne await davor. Nicht, solange in der Warteschlange
 * etwas läuft (das ist dann der neueste Stand), und nicht über 64 KiB. Geht
 * es nicht (keepalive teilt sich die 64 KiB mit der Sicherung, die eben
 * hinausging), legt kalSenden() es in den Ausgang.
 */
export function kalenderVerstecken() {
  if (!kalenderVerbunden() || kalBelegt > 0) return;
  const v = kalVorbereitet;
  if (!v || v.bytes > KAL_MAX_BYTES) return;
  kalAnhalten();
  kalEinreihen(() => kalSenden(v, { keepalive: true }));
}

/** Wieder da: hat der Service Worker inzwischen nachgeschickt? */
export function kalenderSichtbar() {
  if (kalenderVerbunden()) kalNachLesen().then(() => kalRuf.nachher());
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
    const probe = JSON.stringify({ v: KAL_VERTRAG, token: k.token, geraet: kalGeraet(), seq: kalSeq(), gesendet: Date.now(), probe: true });
    const a = await kalLesen(await kalSchicken(u.url, probe, { abbruch: KAL_PROBE_ABBRUCH }));
    const neu = { url: u.url, token: k.token };
    kalVermerken('probe', a, { ziel: kalZiel(neu) });
    if (!(a.ok && a.ergebnis === 'probe')) {
      // Bei der Probe heißt keine Antwort nur: noch einmal fragen.
      const satz = a.ergebnis === 'zeit'
        ? 'Keine Antwort nach 30 Sekunden – noch einmal „Verbinden" tippen. Beim allerersten Aufruf braucht Google manchmal länger.'
        : kalenderSatz(a) || `Das Skript sagt: ${a.ergebnis}.`;
      return { ok: false, satz, ergebnis: a.ergebnis };
    }
    const alt = store.kalender();
    if (alt && alt.url && alt.url !== u.url) kalAusDazu(alt);
    // Ein „aus" an genau diese Adresse, das noch wartete, gilt nicht mehr.
    kalMetaSchreiben({ aus: (kalMeta().aus || []).filter((x) => x.url !== u.url) });
    // Vor dem Speichern: Das meldet der Store sofort (kalenderGeaendert()),
    // und mit einem alten Zeichen ginge dieselbe Vorschau zweimal hinaus.
    kalZeichenVorher = kalZeichen(store.getState());
    store.setzeKalender({ url: u.url });
    // Erst danach: ein Abschalten an die alte Adresse, und gleich die erste Vorschau.
    if ((kalMeta().aus || []).length) kalEinreihen(kalAusErledigen);
    kalEinreihen(async () => {
      const v = await kalVorbereiten({ zwingen: true });
      if (v) await kalSenden(v);
    });
    return { ok: true, satz: a.hinweis || 'Verbunden.', zuAlt: kalZuAlt(a) };
  }).then((r) => r || { ok: false, satz: 'Das ging gerade nicht – noch einmal versuchen.' });
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
    const text = JSON.stringify({ v: KAL_VERTRAG, token: job.token, geraet: job.geraet, seq: job.seq, gesendet: job.gesendet, aus: true });
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
 */
export function kalenderLage() {
  const k = store.kalender();
  const m = kalMeta();
  const ziel = kalZiel(k);
  const letzte = m.letzte && ziel && m.letzte.ziel === ziel ? m.letzte : null;
  const angekommen = m.angekommen && ziel && m.angekommen.ziel === ziel ? m.angekommen : null;
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
    zuAlt: kalZuAlt(letzte) || kalZuAlt(angekommen ? { version: angekommen.version } : null),
    handeln: !!ziel && kalenderHandeln(letzte),
    vorlage: kalenderVorlageFassung(),
  };
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
    + `${l.letzte && !l.letzte.ok ? ` · zuletzt ${l.letzte.ergebnis}` : ''}${l.ausstehend ? ` · ${l.ausstehend} Abschalten offen` : ''}`;
}
