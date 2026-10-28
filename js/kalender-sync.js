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
 * Zurückkommen kurz nach (eine Probe, höchstens einmal je zwei Minuten; hat
 * Tobi den Code eben kopiert, gleich beim Zurückkommen und, solange die App zu
 * sehen ist, alle zwei Minuten) – Tobi kommt aus Apps Script zurück, und die
 * App sieht von selbst, dass es geklappt hat. Keine Wahl, kein Knopf.
 *
 * **Ob das Skript nachträgt.** Zum Code-Tausch gehört seit v247 `einrichten`
 * (KALENDER_JAHR). Tobi hatte Fassung 1 am 27.10. verbunden, ohne je
 * `einrichten` auszuführen – den stündlichen Auslöser legte darum das Skript
 * selbst an, aus `doPost` der bereitgestellten Version (ausloeserSichern_() in
 * kalender/workout-kalender.gs). So ein Auslöser hängt, zu Googles Verhalten
 * passend, an der Version, aus der er entstand: Nach „Neue Version" am 28.10.
 * meldete die Web-App Fassung 2 und 204 Änderungen offen, der stündliche Lauf
 * um 12:14 schrieb aber „(Fassung 1)" in die Beschreibung des Kalenders, und
 * kein neuer Termin kam. An der Fassung sieht die App das nicht – die stimmt
 * ja –, sondern daran, dass `offen` nicht sinkt: Sagt über mindestens 75
 * Minuten und mindestens zwei Proben keine Auskunft einen kleineren Stand
 * (kalStockenMerken()), sagt die Karte, dass das Skript nichts nachträgt und
 * `einrichten` hilft (KALENDER_STOCKT) – ohne Zeile auf dem Dashboard. Damit
 * sie es auch merkt, während Tobi auf der Karte wartet, fragt sie dort von
 * selbst nach, solange etwas offen ist (kalNachfrageSpaeter()). Bis v247
 * fragte sie nach dem Stand nur beim Zeichnen der Karte und beim Zurückkommen.
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
 *   die Pause                    gar nicht (Start, Ende, „+30 s") – die
 *                                Vorschau liest sie nicht
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
// So oft fragt die App höchstens nach, ob der neue Code schon da ist – und
// wie weit das Skript mit dem Jahr ist, solange es noch einträgt.
const KAL_FASSUNG_FRAGEN = 2 * 60 * 1000;
// Nach „Code kopieren", solange der neue Code aussteht: so lange wartet die
// App die zwei Minuten beim Zurückkommen nicht ab, und solange sie zu sehen
// ist, fragt sie alle zwei Minuten von selbst (kalCodeUnterwegs()) …
const KAL_KOPIERT_FRAGEN = 30 * 60 * 1000;
// … aber auch dann nicht öfter als so – Zurückkommen kann zweimal kurz
// hintereinander gemeldet werden.
const KAL_FRAGEN_MIN = 10 * 1000;
// Erst so lange nach der letzten Auskunft lohnt es, nach dem Stand zu fragen:
// Ein Lauf „weiter" kommt frühestens drei Minuten nach dem vorigen.
const KAL_STAND_FRAGEN = 3 * 60 * 1000;
// Sinkt `offen` so lange nicht, obwohl so viele Proben danach gefragt haben,
// trägt das Skript nichts nach (kalStockenMerken()). 75 Minuten, weil ein
// stündlicher Lauf dazwischen gelegen haben muss – ein „weiter" kommt sonst
// nach Minuten, und ein kleiner Rest wartet höchstens eine Stunde; zwei
// Proben, damit nicht eine einzelne Auskunft allein etwas behauptet.
const KAL_STOCKT_NACH = 75 * 60 * 1000;
const KAL_STOCKT_PROBEN = 2;

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
// Warum eine Sendung im Ausgang lag (kalAusgangLegen()): kein Netz, beim
// Wegschalten mit keepalive gescheitert (ohne Netz oder an der 64-KiB-Grenze,
// die keepalive mit der Sicherung teilt – das sagt der Browser nicht), das
// Skript beschäftigt, keine Antwort, über 64 KiB beim Wegschalten.
const KAL_GRUENDE = new Set(['netz', 'wegschalten', 'fehler', 'zeit', 'gross']);

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
 *   fremd       beim Skript gilt der Plan eines anderen Geräts: { ziel, zeit,
 *               stand } aus der letzten Antwort „aelter" – stand: der
 *               Trainingsstand, der dort gilt ({ einheiten, saetze,
 *               zuletzt }). Weg, sobald eine eigene Sendung ankam
 *               (kalFremd()) – nicht mit dem nächsten Versuch, der scheitert
 *   angekommen  der letzte, der ankam – auch einer, den der Service Worker
 *               nachgeschickt hat: { zeit, version, tag, ziel, vertrag, … }
 *               mit dem, was die Antwort über den Abgleich sagt (kalAbgleich())
 *   offen       der letzte Versuch scheiterte am Netz, das Skript war
 *               beschäftigt oder die Antwort blieb aus – „online" und das
 *               Zurückkommen holen ihn nach
 *   aus         Abschalten, das noch nicht beim Skript ist: [{ url, token,
 *               geraet, seq, gesendet }] – bis es ankommt, beim Start und bei
 *               „online" wieder versucht
 *   nach        was der Service Worker im Hintergrund nachgeschickt hat:
 *               { zeit, seq, code, grund, ziel } – grund: warum es im
 *               Ausgang lag (KAL_GRUENDE, kalAusgangLegen()). Verfällt,
 *               sobald eine neuere eigene Sendung ankam.
 *   stockt      { ziel, offen, seit, proben, zuletzt, gemeldet }: seit wann
 *               keine Auskunft des Skripts (Fassung 2) einen anderen Stand
 *               `offen` gesagt hat, und wie viele Proben seitdem – daran
 *               erkennt die Karte, dass das Skript nichts nachträgt
 *               (kalStockenMerken(), kalStockt())
 *   fassung     die Fassung des Skripts aus seiner letzten lesbaren Antwort:
 *               { ziel, version, zeit } – daran hängt, ob v 1 oder v 2
 *               hinausgeht; zeit: wann diese Antwort kam
 *   gesehen     die Fassung der Vorlage, zu der Tobi die Bitte um neuen Code
 *               schon gesehen hat (Ansehen, Code kopieren) – dann steht sie
 *               nicht mehr auf dem Dashboard, nur noch auf der Karte
 *   kopiert     { zeit, vorlage, ziel }: wann er den Code dafür kopiert hat –
 *               meldet eine Antwort ein paar Minuten danach noch die alte
 *               Fassung, fehlt meist „Neue Version"
 *   abgleich    { ziel, zeit, offen, bis, stehen, folge, morgen }: wie weit
 *               das Skript beim Eintragen des Jahres ist – aus einer Probe,
 *               solange nach der letzten Sendung noch etwas offen war
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
 * Was zurückkam → { ergebnis, ok, version, hinweis, tag, geaendert, status,
 * stand }. `ergebnis` ist ein Code des Skripts (KAL_CODES) oder netz, zeit,
 * undurchsichtig, http. Der Hinweis ist ein Satz des Skripts (ohne Kennwort
 * und ohne IDs, bereinigt_() dort) – er wird angezeigt, nicht protokolliert.
 * `stand` ist der Trainingsstand, der beim Skript gilt – bei „aelter" der
 * eines anderen Geräts (kalStandLesen()).
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
    ...kalAbgleich(roh),
    status: res.status,
    stand: kalStandLesen(roh.stand),
  };
}

/**
 * Ein Trainingsstand aus einer Antwort ({ einheiten, saetze, zuletzt }, wie
 * `stand` im Vertrag, js/kalender-vorschau.js) – oder null, wenn er nicht so
 * aussieht. Nur Zahlen: Er kommt aus fremder Hand.
 */
function kalStandLesen(st) {
  const ganz = (x) => Number.isInteger(x) && x >= 0 && x <= Number.MAX_SAFE_INTEGER;
  return st && typeof st === 'object' && ganz(st.einheiten) && ganz(st.saetze) && ganz(st.zuletzt)
    ? { einheiten: st.einheiten, saetze: st.saetze, zuletzt: st.zuletzt } : null;
}

/**
 * Was eine Antwort über den Abgleich sagt – auch die, die der Service Worker
 * gelesen hat (kalNachLesen()). Fassung 2 dazu: noch offene Änderungen, bis
 * wann die Liste reicht, bis wann der Kalender schon ganz steht, ob der Rest
 * in Minuten kommt und ob erst morgen (Tageskontingent).
 */
function kalAbgleich(roh) {
  const r = roh && typeof roh === 'object' ? roh : {};
  const tag = (x) => (typeof x === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x) ? x : null);
  return {
    tag: tag(r.tag),
    geaendert: Number.isInteger(r.geaendert) ? r.geaendert : null,
    offen: Number.isInteger(r.offen) ? r.offen : null,
    bis: tag(r.bis),
    stehen: tag(r.stehen),
    folge: typeof r.folge === 'boolean' ? r.folge : null,
    morgen: typeof r.morgen === 'boolean' ? r.morgen : null,
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
 * auch im README. Seit v247 mit `einrichten` als Schritt 4, nach dem
 * Speichern und vor „Neue Version":
 *
 *     Code ersetzen, speichern, einrichten ausführen, dann Neue Version.
 *
 * Bis dahin stand hier, „einrichten" brauche es nicht – Kalender und
 * stündlicher Auslöser bestünden schon, und der Auslöser rufe „stuendlich"
 * beim Namen, also den neuen Code. Das stimmt nur für einen Auslöser, der im
 * Editor entstand. Tobis hatte das Skript selbst angelegt (ausloeserSichern_()
 * aus doPost, weil er bei Fassung 1 nie `einrichten` ausgeführt hatte), und so
 * einer hängt, zu Googles Verhalten passend, an der Version der
 * Bereitstellung, aus der er entstand: Am 28.10. lief er nach „Neue Version"
 * weiter mit Fassung 1 (12:14), und das Jahr kam nicht. `einrichten` löscht
 * alle Auslöser des Projekts und legt einen aus dem Editor an – der nimmt
 * immer den zuletzt gespeicherten Code –, gleicht sofort ab und kann dabei
 * ein paar Minuten laufen (bis viereinhalb); Google fragt womöglich noch
 * einmal nach Zugriff. Vor „Neue Version", weil es nur gespeicherten Code
 * braucht und der Rest der Anleitung dann wie beim Einrichten endet.
 */
export const KALENDER_JAHR = {
  titel: 'Ein Jahr im Voraus',
  satz: 'Dein Skript bei Google ist noch Fassung 1 und trägt nur die nächsten vier Wochen ein. Für ein ganzes Jahr '
    + 'braucht es einmal den neuen Code – das Kennwort bleibt dasselbe:',
  schritte: [
    '„Code kopieren" tippen (gleich hier unten).',
    'In Chrome script.google.com öffnen, im Drei-Punkte-Menü Desktopwebsite anhaken und dein Projekt öffnen – dasselbe wie beim Einrichten.',
    'Den ganzen Code dort durch den kopierten ersetzen und speichern.',
    'Oben die Funktion einrichten wählen und Ausführen tippen. Fragt Google noch einmal nach Zugriff: erlauben wie beim '
      + 'Einrichten. Es gleicht sofort ab und kann ein paar Minuten laufen – warten, bis unten „Ausführung abgeschlossen" steht.',
    'Bereitstellen → Bereitstellungen verwalten → Bearbeiten (Stift) → Version: Neue Version → Bereitstellen.',
  ],
  danach: 'Fertig. Die App merkt den neuen Code von selbst und schickt dann das ganze Jahr. Bis dahin läuft alles weiter wie bisher.',
  // Meldet eine Antwort ein paar Minuten nach „Code kopieren" noch die alte
  // Fassung: Am leichtesten vergisst man „Neue Version" (oder das Speichern
  // davor) – ohne läuft die Web-App mit dem alten Code. Gezählt wird die Zeit
  // der Antwort, nicht die des Anzeigens: Sonst blitzte der Satz beim
  // Zurückkommen auf, bevor die Nachfrage die neue Fassung meldet. Ob
  // „einrichten" lief, sieht die App an der Fassung nicht – darum steht es als
  // Erinnerung dabei; ob der Auslöser nachträgt, zeigt sich erst danach
  // (KALENDER_STOCKT).
  fehltNach: 3 * 60 * 1000,
  fehlt: 'Der Code ist kopiert, aber das Skript meldet noch Fassung 1. Meist fehlt der letzte Schritt: Bereitstellen → '
    + 'Bereitstellungen verwalten → Bearbeiten (Stift) → Version: Neue Version → Bereitstellen – oder das Speichern '
    + 'davor. Ohne beides läuft die Web-App mit dem alten Code weiter. Und hast du einrichten (Schritt 4) noch nicht '
    + 'ausgeführt: das auch – sonst bleibt der stündliche Auslöser womöglich beim alten Code.',
};

/**
 * Das Skript trägt nichts nach (kalStockt()): für die Karte, in der Farbe für
 * „da ist etwas zu tun", ohne Zeile auf dem Dashboard – die nächsten vier
 * Wochen stimmen ja, nur das Jahr dahinter kommt nicht.
 */
export const KALENDER_STOCKT = 'Das Skript trägt nichts nach – wahrscheinlich läuft der stündliche Auslöser noch mit dem alten Code. '
  + 'In Apps Script einmal „einrichten" ausführen.';

/**
 * Zwei Hinweise des Skripts, die nur den Augenblick ihrer Sendung beschreiben
 * – wörtlich SPAETER und TAGESKONTINGENT in kalender/workout-kalender.gs
 * (tests/test-kalender-sync.mjs vergleicht, auch mit Fassung 1). Neben einem
 * neueren Stand zeigt die Karte sie nicht mehr (kalenderLage().hinweisAlt).
 * „Google bremst" hat in der Antwort kein eigenes Feld, das Tageskontingent
 * `morgen`; am Text erkannt werden beide – ein Feld dazu hieße neuer Code im
 * Skript, und Tobi soll den Code nicht schon wieder tauschen.
 */
export const KALENDER_SPAETER = 'Google bremst gerade – der Rest folgt mit dem nächsten stündlichen Abgleich.';
export const KALENDER_KONTINGENT = 'Google lässt heute keine weiteren Kalender-Änderungen zu (Tageskontingent aufgebraucht) – '
  + 'morgen geht es von selbst weiter.';

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
      + 'ganzen Code ersetzen, speichern, oben „einrichten" ausführen, dann Bereitstellen → Bereitstellungen verwalten → '
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
        + 'speichern, oben „einrichten" ausführen, dann Bereitstellen → Bereitstellungen verwalten → Bearbeiten (Stift) → '
        + 'Version: Neue Version → Bereitstellen.';
    // Die Regel „Wer gilt" (sendungVergleichen() in js/kalender-vorschau.js):
    // Beim Skript liegt die Vorschau eines anderen Geräts, das zuletzt
    // trainiert hat, und diese hier nimmt es nicht. Seit v247 mit dem, was zu
    // tun ist – zwei Geräte an einem Kalender sind ein Versehen: Tobi hatte
    // die App auch im Browser am Rechner verbunden, dessen Stand eine
    // Einheit hinterherhinkte (dort zwar mit einem zweiten Projekt, aber am
    // selben hätte er genau so ausgesehen). Mit dem ersten Satz hier gilt
    // wieder dieses Gerät – auch das gehört dazu, falls hier trainiert wird.
    // „Trennen" schickt dann kein „aus" (kalFremd()): Die Termine des anderen
    // Geräts bleiben stehen.
    case 'aelter':
      return 'Ein anderes Gerät mit neuerem Training ist mit diesem Kalender verbunden – dieses hier nicht mehr verbinden '
        + '(„Trennen" unten; die Termine des anderen bleiben stehen). Im Kalender gilt dessen Plan; trainierst du doch '
        + 'hier weiter, gilt mit dem ersten Satz wieder dieses.';
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
 * Vermerkt wird, dass es hinausging, und, wenn lesbar, was das Skript sagte –
 * kam sie an, gilt sie der App danach als die, die zuletzt ankam.
 * ------------------------------------------------------------------ */

const kalAusgangSchluessel = () => new URL('kalender-ausgang', location.href).href;
const kalNachSchluessel = () => new URL('kalender-ausgang-nach', location.href).href;

/**
 * Eine Sendung in den Ausgang. `hash` und `ziel` reisen mit und kommen im
 * Vermerk des Service Workers zurück (kalNachLesen()) – kam sie dort an, geht
 * dieselbe Vorschau nicht noch einmal hinaus. Ebenso `vertrag` und
 * `gekuerzt`: Die App vermerkt sie dann wie eine eigene, die ankam. Und
 * `grund`, warum sie hier liegt (KAL_GRUENDE): 'netz' (kein Netz),
 * 'wegschalten' (keepalive scheiterte), 'fehler' (das Skript beschäftigt),
 * 'zeit' (keine Antwort) oder 'gross' (über 64 KiB beim Wegschalten,
 * kalGrossWeg()). Bis v247 kam er nicht mit, und die Karte sagte zu jeder
 * nachgeschickten Sendung „Ohne Netz trainiert" – bei Tobis Jahr mit rund
 * 75 KiB ging beim Wegschalten häufig eine über den Ausgang, mit Netz.
 */
async function kalAusgangLegen(v, grund) {
  try {
    if (!window.caches || !navigator.serviceWorker) return false;
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg || !reg.sync) return false;
    const c = await caches.open(KALENDER_AUSGANG);
    await c.put(kalAusgangSchluessel(), new Response(JSON.stringify({
      url: v.url, text: v.text, seq: v.seq, hash: v.hash, ziel: v.ziel, vertrag: v.vertrag ?? null, gekuerzt: v.gekuerzt ?? null,
      grund: KAL_GRUENDE.has(grund) ? grund : null, gelegt: Date.now(),
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
    // Warum sie im Ausgang lag (KAL_GRUENDE) und an welche Verbindung sie
    // ging – die Karte sagt „Ohne Netz trainiert" nur bei 'netz' und nur zu
    // dieser Verbindung. Ein Vermerk eines Service Workers von vor v247 trägt
    // keinen Grund; dann steht nur „Im Hintergrund nachgeschickt".
    const teil = {
      nach: {
        zeit: n.zeit, seq: Number.isInteger(n.seq) ? n.seq : null, code,
        grund: KAL_GRUENDE.has(n.grund) ? n.grund : null, ziel: typeof n.ziel === 'string' ? n.ziel : null,
      },
    };
    // „aelter": Beim Skript gilt der Plan eines anderen Geräts – wie bei einer
    // eigenen Sendung (kalVermerken()), mit dem Stand, der dort gilt. Nicht,
    // wenn schon Neueres vermerkt ist (kalFremd() vergleicht die Zeiten).
    const mVorher = kalMeta();
    const hier = typeof n.ziel === 'string' && n.ziel === kalZiel(store.kalender());
    const fremdBekannt = mVorher.fremd && mVorher.fremd.ziel === n.ziel && Number.isFinite(mVorher.fremd.zeit) ? mVorher.fremd : null;
    if (code === 'aelter' && hier && !(fremdBekannt && fremdBekannt.zeit >= n.zeit)) {
      teil.fremd = { ziel: n.ziel, zeit: n.zeit, stand: kalStandLesen(n.antwort && n.antwort.stand) };
    }
    // Angekommen: Diese Vorschau ist beim Skript – sie geht nicht noch einmal.
    if ((code === 'angekommen' || code === 'gleich') && typeof n.hash === 'string' && n.ziel === kalZiel(store.kalender())) {
      Object.assign(teil, { hash: n.hash, ziel: n.ziel, offen: false });
      // Und dieses Gerät gilt wieder, falls es eben noch ein anderes war.
      if (fremdBekannt && fremdBekannt.zeit < n.zeit) teil.fremd = null;
      const version = Number.isInteger(n.version) ? n.version : null;
      if (version !== null) teil.fassung = { ziel: n.ziel, version, zeit: n.zeit };
      // Was sie über den Abgleich sagt, zählt auch dafür, ob das Skript
      // nachträgt – wie bei einer eigenen Sendung (kalVermerken()).
      kalStockenMerken(n.ziel, { version, ...kalAbgleich(n.antwort) }, 'sendung', n.zeit);
      // Und sie ist die, die zuletzt ankam – wie bei einer eigenen Sendung
      // (kalVermerken()), mit dem, was das Skript über den Abgleich sagt. Bis
      // zum Gegenlesen von v246 blieb `angekommen` bei der Sendung davor: War
      // die nachgeschickte die erste mit dem Jahr, stand auf der Karte weiter
      // „Neuer Code erkannt … geht jetzt an das Skript", und was schon im
      // Kalender steht, sagte sie nicht – bis zur nächsten eigenen Sendung.
      const vorher = kalMeta().angekommen;
      if (!(vorher && vorher.ziel === n.ziel && vorher.zeit >= n.zeit)) {
        const { tag, bis, offen, stehen, folge, morgen } = kalAbgleich(n.antwort);
        teil.angekommen = {
          zeit: n.zeit, version, tag, ziel: n.ziel, bis, offen, stehen, folge, morgen,
          vertrag: Number.isInteger(n.vertrag) ? n.vertrag : null, gekuerzt: Number.isInteger(n.gekuerzt) ? n.gekuerzt : null,
        };
      }
    }
    kalMetaSchreiben(teil);
    notieren('kalender', { was: 'nachgesendet', seq: n.seq, lesbar: !!code, ergebnis: code || undefined });
  } catch { /* nur eine Auskunft */ }
}

/* ------------------------------------------------------------------ *
 * Der Takt
 * ------------------------------------------------------------------ */

// Was die App dazu sagt (kalenderEinrichten()): `nachher` nach jedem Versuch,
// `karte` – ist die Karte unter Mehr gerade aufgeschlagen?
let kalRuf = { nachher: () => {}, karte: () => false };
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
  const m0 = kalMeta();
  const vorher = m0.letzte;
  const letzte = {
    // Zählt jeden Versuch – daran erkennt die Karte, ob ihre Meldung überholt
    // ist (die Uhrzeit taugt dafür nicht: zwei Versuche in derselben ms).
    nr: (vorher && Number.isInteger(vorher.nr) ? vorher.nr : 0) + 1,
    art, zeit: Date.now(), ergebnis: a.ergebnis, ok: !!a.ok, version: a.version ?? null,
    hinweis: a.hinweis || '', tag: a.tag || null, geaendert: a.geaendert ?? null, status: a.status ?? null,
    offen: a.offen ?? null, bis: a.bis || null, stehen: a.stehen || null, folge: a.folge ?? null, morgen: a.morgen ?? null,
    bytes: mehr.bytes ?? null, ziel, wieder: !!mehr.wieder, erschoepft: !!mehr.erschoepft,
    vertrag: mehr.vertrag ?? null, fern: mehr.fern ?? null, gekuerzt: mehr.gekuerzt ?? null, fernFehler: !!mehr.fernFehler,
  };
  const teil = { letzte };
  // Gilt beim Skript der Plan eines anderen Geräts (kalFremd())? „aelter"
  // sagt es, mit dem Stand, der dort gilt – die Karte sagt, wann dort zuletzt
  // trainiert wurde. Vorbei ist es erst, wenn eine eigene Sendung ankam; ein
  // Versuch, der scheitert, ändert daran nichts. Bis zur Prüfung von v247 stand
  // es nur im letzten Versuch, und schon „das Skript ist beschäftigt" danach
  // machte den Weg für ein „aus" frei, das die Termine des anderen Geräts
  // wegräumt. Hat es eine App von vor v247 nur dort vermerkt, wird es hier
  // festgehalten, bevor der Versuch überschrieben ist.
  const fremdVorher = kalFremd(m0, ziel);
  if (ziel && a.ergebnis === 'aelter') teil.fremd = { ziel, zeit: letzte.zeit, stand: a.stand || null };
  else if (ziel && a.ok && art === 'vorschau') { if (m0.fremd && m0.fremd.ziel === ziel) teil.fremd = null; }
  else if (fremdVorher && !(m0.fremd && m0.fremd.ziel === ziel)) teil.fremd = fremdVorher;
  if (a.ok && ziel) {
    teil.angekommen = {
      zeit: letzte.zeit, version: letzte.version, tag: letzte.tag, ziel, bis: letzte.bis, offen: letzte.offen,
      stehen: letzte.stehen, folge: letzte.folge, morgen: letzte.morgen, vertrag: letzte.vertrag, gekuerzt: letzte.gekuerzt,
    };
    // Eine eigene Sendung ist angekommen: Was der Service Worker davor
    // nachgeschickt hat, ist erzählt – der Vermerk verfällt. Bis v247 blieb er
    // für immer, und „Im Hintergrund nachgeschickt vor 3 Tagen" stand neben
    // jeder späteren Sendung.
    const nach = kalMeta().nach;
    if (art === 'vorschau' && nach && Number.isFinite(nach.zeit) && nach.zeit < letzte.zeit) teil.nach = null;
  }
  // Jede lesbare Antwort sagt, welche Fassung das Skript hat – daran hängt,
  // was als Nächstes hinausgeht (kalVertrag()).
  if (ziel && Number.isInteger(a.version)) teil.fassung = { ziel, version: a.version, zeit: letzte.zeit };
  kalMetaSchreiben(teil);
  // Und ob es nachträgt (kalStockenMerken()): die Antwort auf eine Sendung,
  // die ankam, und die Probe beim Verbinden.
  if (a.ok && ziel && (art === 'vorschau' || a.ergebnis === 'probe')) {
    kalStockenMerken(ziel, a, art === 'vorschau' ? 'sendung' : 'probe', letzte.zeit);
  }
  // Nur, was die Sendung ergab – nie Kennwort, Adresse oder Hinweistext.
  notieren('kalender', {
    was: art, ergebnis: a.ergebnis, version: a.version ?? undefined, status: a.ergebnis === 'http' ? a.status : undefined,
    geaendert: a.geaendert ?? undefined, offen: a.offen || undefined, bytes: mehr.bytes ?? undefined, rechnen: mehr.rechnen ?? undefined,
    haupt: mehr.haupt ?? undefined, seq: mehr.seq ?? undefined, keepalive: mehr.keepalive || undefined,
    ausgang: mehr.ausgang ?? undefined, wieder: mehr.wieder || undefined, erschoepft: mehr.erschoepft || undefined,
    vertrag: mehr.vertrag ?? undefined, fern: mehr.fern ?? undefined, gekuerzt: mehr.gekuerzt ?? undefined,
    fernfehler: mehr.fernFehler ? String(mehr.fernFehler).slice(0, 120) : undefined,
  }, art !== 'vorschau' || !a.ok || !!mehr.fernFehler);
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
    // Die Ferne ließ sich nicht rechnen: Es geht die Nähe allein (v 1) – mit
    // Absicht, also kein „passend nachschicken" (kalSenden()).
    fernFehler: vertrag >= 2 && typeof vorschau.fernFehler === 'string' ? vorschau.fernFehler : null,
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
    // sofort, und ist das Skript noch beschäftigt, einige Minuten später. Mit
    // dem Grund (KAL_GRUENDE): Mit keepalive heißt „netz" nur, dass die Anfrage
    // nicht losging – womöglich an der 64-KiB-Grenze, bei bestehendem Netz.
    const grund = a.ergebnis === 'netz' && keepalive && navigator.onLine !== false ? 'wegschalten' : a.ergebnis;
    ausgang = await kalAusgangLegen(v, grund);
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
    vertrag: v.vertrag, fern: v.fern, gekuerzt: v.gekuerzt, fernFehler: v.fernFehler,
  });
  // Die Fassung hat sich geklärt: dieselbe Vorschau gleich noch einmal, passend.
  // Nicht beim Wegschalten – die Seite friert gleich ein; dann der nächste Anlass.
  // Neu gezeichnet wird erst danach: Wies ein Skript der Fassung 1 v 2 zurück
  // („erneuern"), stünde sonst bis zur Sendung als v 1 kurz eine Warnzeile da.
  // Höchstens zweimal hintereinander: Fände die Rechnung nie zur Fassung des
  // Skripts (etwa ein Worker aus einem älteren Zwischenspeicher, der die Ferne
  // nicht kennt), schickte die App sonst ohne Ende. Und nicht, wenn die Ferne
  // nicht zu rechnen war – dann ging die Nähe allein mit Absicht als v 1.
  if (!keepalive && !v.fernFehler && Number.isInteger(a.version) && kalVertrag(v.ziel) !== v.vertrag) {
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
  // Bleibt nach dieser Sendung etwas offen und ist die Karte aufgeschlagen,
  // fragt die App von selbst nach, wie weit das Skript kommt
  // (kalNachfrageSpaeter()).
  kalNachfrageSpaeter();
  return a;
}

/**
 * Wie weit das Skript mit dem Eintragen ist – die jüngste Auskunft dazu:
 * die Antwort auf die letzte Sendung, die ankam (Fassung 2), oder eine Probe
 * danach (`abgleich`). { zeit, offen, bis, stehen, folge, morgen, gekuerzt }
 * oder null, wenn die letzte Sendung keine mit Ferne war.
 *
 * `morgen` (das Tageskontingent ist aufgebraucht) aus derselben Auskunft wie
 * `offen`: Bis zum Gegenlesen von v246 las die Karte es aus dem Hinweis der
 * letzten Sendung. Ging das Kontingent erst in einem Lauf „weiter" aus, stand
 * dort nichts, und die Karte versprach die nächste Stunde; stand es dort, blieb
 * „morgen" auch noch, als eine Probe am nächsten Tag einen kleinen Rest für
 * die nächste Stunde meldete.
 */
function kalStand(m, ziel) {
  const a = m.angekommen && m.angekommen.ziel === ziel && m.angekommen.vertrag === 2 && m.angekommen.bis ? m.angekommen : null;
  if (!a) return null;
  const g = m.abgleich && m.abgleich.ziel === ziel && Number.isFinite(m.abgleich.zeit) && m.abgleich.zeit > a.zeit ? m.abgleich : null;
  const s = g || a;
  return {
    zeit: s.zeit, offen: Number.isInteger(s.offen) ? s.offen : 0, bis: s.bis || a.bis, stehen: s.stehen || null,
    folge: s.folge ?? null, morgen: s.morgen === true, gekuerzt: a.gekuerzt ?? null, probe: !!g,
  };
}

/**
 * Trägt das Skript noch nach? Jede Auskunft eines Skripts der Fassung 2 über
 * den Abgleich kommt hier vorbei – die Antwort auf eine eigene oder vom
 * Service Worker nachgeschickte Sendung (`art` 'sendung') und jede Probe
 * ('probe'). `stockt` hält den Bezug: so viel war offen (`offen`), seit wann
 * (`seit`), und wie viele Proben seitdem nichts anderes gesagt haben
 * (`proben`, die letzte um `zuletzt`).
 *
 *   - Ein anderer Stand als der Bezug, aus einer Sendung oder einer Probe:
 *     neuer Bezug. Weniger heißt, das Skript trägt nach – der Satz auf der
 *     Karte ist weg. Mehr heißt neue Arbeit (eine Sendung, nach der das ganze
 *     Jahr einen Tag weiterrückt, oder die eines anderen Geräts), und bis
 *     „weiter" damit anfängt, vergehen ein paar Minuten.
 *   - Eine Probe mit demselben Stand oder ganz ohne `offen`: zählt. Ohne
 *     `offen` antwortet Fassung 2, wenn den letzten Abgleich ein Lauf des
 *     alten Codes schrieb (Fassung 1 kennt das Feld nicht) – so sieht es aus,
 *     solange ein Auslöser mit Fassung 1 läuft (tests/test-kalender-gas.mjs,
 *     Abschnitt 12). Aber auch, wenn ein Lauf von Fassung 2 selbst vor dem
 *     Ende scheiterte: ein Fehler vor dem Abarbeiten, oder ein
 *     Tageskontingent, das auch die Beschreibung des Kalenders trifft. Dann
 *     sagt die Probe auch kein „morgen" (probeAntwort_() gibt es nur mit
 *     `offen` weiter), und von außen sieht es aus wie der alte Auslöser – die
 *     Karte rät bis zum nächsten Tag zu „einrichten". Schaden kann das nicht;
 *     unterscheiden ließe es sich nur mit neuem Code im Skript (gefunden bei
 *     der Prüfung von v247, ebenda nachgestellt).
 *   - Eine Sendung mit demselben Stand oder ohne `offen`: ändert nichts – ihr
 *     doPost hat 25 Sekunden angeglichen und doch nichts geschafft.
 *   - Nichts mehr offen: nichts zu merken.
 *
 * Gibt es noch keinen Bezug (gleich nach dem Update auf v247), ist es der
 * Stand, den die App schon kennt (kalStand()) – darum kommt eine Probe hier
 * vorbei, bevor ihr Stand vermerkt ist (kalNachfragen()). Das gilt nur, bis
 * eine Sendung ankommt, die einen anderen Stand sagt: Schafft ihr doPost ein
 * paar Termine (am nächsten Tag etwa die Sendung beim Start), beginnt der
 * Bezug dort neu, und „trägt nichts nach" kommt frühestens 75 Minuten danach.
 * Ein Skript der Fassung 1 sagt nichts über `offen`; was es sagt, zählt
 * nicht. Wann daraus „trägt nichts nach" wird, sagt kalStockt().
 */
function kalStockenMerken(ziel, a, art, zeit = Date.now()) {
  if (!ziel || !Number.isInteger(a.version) || a.version < 2) return;
  const m = kalMeta();
  const offen = Number.isInteger(a.offen) ? a.offen : null;
  if (offen !== null && offen <= 0) {
    if (m.stockt) kalMetaSchreiben({ stockt: null });
    return;
  }
  const bezug = (o, t) => ({ ziel, offen: o, seit: t, proben: 0, zuletzt: t });
  const gemerkt = m.stockt && m.stockt.ziel === ziel && Number.isInteger(m.stockt.offen) && Number.isFinite(m.stockt.seit)
    ? m.stockt : null;
  let s = gemerkt;
  if (!s) {
    const st = kalStand(m, ziel);
    s = st && st.offen > 0 && Number.isFinite(st.zeit) ? bezug(st.offen, st.zeit) : null;
  }
  if (offen !== null && (!s || offen !== s.offen)) {
    kalMetaSchreiben({ stockt: bezug(offen, zeit) });
    return;
  }
  if (!s) return;
  if (art !== 'probe') {
    if (!gemerkt) kalMetaSchreiben({ stockt: s });
    return;
  }
  const weiter = { ...s, proben: (Number.isInteger(s.proben) ? s.proben : 0) + 1, zuletzt: Math.max(zeit, s.zuletzt || 0) };
  kalMetaSchreiben({ stockt: weiter });
  // Einmal ins Diagnoseprotokoll, sobald es so aussieht – nur Zahlen.
  if (!weiter.gemeldet && kalStockt(kalMeta(), ziel)) {
    kalMetaSchreiben({ stockt: { ...weiter, gemeldet: true } });
    notieren('kalender', {
      was: 'stockt', offen: weiter.offen, minuten: Math.round((weiter.zuletzt - weiter.seit) / 60000), proben: weiter.proben,
    }, true);
  }
}

/**
 * Das Skript trägt nichts nach: Über mindestens 75 Minuten und mindestens zwei
 * Proben hat keine Auskunft einen kleineren Stand gesagt (kalStockenMerken()),
 * und offen ist noch etwas. Nicht, wenn die jüngste Auskunft „morgen" sagt –
 * dann ist das Tageskontingent aufgebraucht, und bis morgen sinkt nichts, mit
 * keinem Code. Gibt { seit, proben, zuletzt, offen } zurück, sonst null.
 */
function kalStockt(m, ziel) {
  const s = m.stockt && m.stockt.ziel === ziel ? m.stockt : null;
  const stand = kalStand(m, ziel);
  if (!s || !stand || !(stand.offen > 0) || stand.offen !== s.offen || stand.morgen) return null;
  if (!(s.proben >= KAL_STOCKT_PROBEN) || !(s.zuletzt - s.seit >= KAL_STOCKT_NACH)) return null;
  return { seit: s.seit, proben: s.proben, zuletzt: s.zuletzt, offen: s.offen };
}

/**
 * Nachfragen mit einer Probe, die beim Skript nichts speichert – höchstens
 * einmal je zwei Minuten, und nur, wenn es etwas zu erfahren gibt:
 *
 *   - Ist der neue Code schon da? Solange er aussteht (die Fassung des
 *     Skripts ist bekannt und älter als die Vorlage). Meldet die Probe die
 *     neue Fassung, geht die Vorschau gleich mit dem Jahr hinaus. Tobi kommt
 *     aus Apps Script zurück in die App – und sie merkt es von selbst.
 *   - Wie weit ist das Skript mit dem Jahr? Solange nach der letzten Auskunft
 *     noch etwas offen war und sie mindestens drei Minuten alt ist – sonst
 *     stünde auf der Karte stundenlang „noch 183 Änderungen offen", obwohl
 *     längst alles eingetragen ist.
 *
 * Hat Tobi den Code eben kopiert (kalCodeUnterwegs()), fragt die App beim
 * Zurückkommen gleich (`sofort`, höchstens alle zehn Sekunden) und, solange
 * sie zu sehen ist, alle zwei Minuten von selbst (kalNachfrageSpaeter()). Bis
 * zur Prüfung des Entwurfs merkte sie den neuen Code nicht, wenn er nach 90 s
 * zurück war und auf der Karte blieb: Gefragt hatte sie eben erst, beim
 * Zeichnen der Karte, und das nächste Mal erst nach dem nächsten Wegschalten.
 */
let kalFassungGefragt = 0;
/** Gibt es etwas zu erfragen? { code } – nur rechnen, ohne Netz. */
function kalNachfragenNoetig({ sofort = false } = {}) {
  const ziel = kalZiel(store.kalender());
  if (!ziel || !kalenderVerbunden()) return null;
  if (Date.now() - kalFassungGefragt < (sofort ? KAL_FRAGEN_MIN : KAL_FASSUNG_FRAGEN)) return null;
  const stand = kalStand(kalMeta(), ziel);
  const code = kalNeuerCode(kalFassung(ziel));
  const eintragen = !!stand && stand.offen > 0 && Date.now() - stand.zeit >= KAL_STAND_FRAGEN;
  return code || eintragen ? { code } : null;
}

/**
 * Hat Tobi den Code für die neue Fassung vor weniger als einer halben Stunde
 * kopiert, und das Skript meldet noch die alte? Dann ist er gerade in Apps
 * Script – oder eben zurück.
 */
function kalCodeUnterwegs(ziel = kalZiel(store.kalender())) {
  const k = kalMeta().kopiert;
  return !!ziel && kalenderVerbunden() && !!k && k.ziel === ziel && k.vorlage === kalenderVorlageFassung() && Number.isFinite(k.zeit)
    && Date.now() - k.zeit < KAL_KOPIERT_FRAGEN && kalNeuerCode(kalFassung(ziel));
}

async function kalNachfragen({ sofort = false } = {}) {
  const noetig = kalNachfragenNoetig({ sofort });
  if (!noetig) return null;
  try {
    const { code } = noetig;
    const k = store.kalender();
    const ziel = kalZiel(k);
    kalFassungGefragt = Date.now();
    const probe = JSON.stringify({ v: 1, token: k.token, geraet: kalGeraet(), seq: kalSeq(), gesendet: Date.now(), probe: true });
    const a = await kalLesen(await kalSchicken(k.url, probe, { abbruch: KAL_PROBE_ABBRUCH }));
    // Nur eine lesbare Antwort zählt; ein Netzfehler ist kein Befund.
    if (!Number.isInteger(a.version) || kalZiel(store.kalender()) !== ziel) return a;
    const vorher = kalVertrag(ziel);
    // Jede Probe zählt dafür, ob das Skript nachträgt – auch eine, die
    // `offen` nicht nennt (kalStockenMerken()). Vor dem Vermerken ihres
    // Stands: Ohne Bezug gilt der, den die App bis eben kannte.
    if (a.ok && a.ergebnis === 'probe') kalStockenMerken(ziel, a, 'probe');
    const teil = { fassung: { ziel, version: a.version, zeit: Date.now() } };
    if (a.ok && a.ergebnis === 'probe' && Number.isInteger(a.offen) && a.bis) {
      teil.abgleich = {
        ziel, zeit: Date.now(), offen: a.offen, bis: a.bis, stehen: a.stehen || null, folge: a.folge ?? null, morgen: a.morgen ?? null,
      };
    }
    kalMetaSchreiben(teil);
    notieren('kalender', {
      was: code ? 'fassung-frage' : 'stand-frage', version: a.version, offen: teil.abgleich ? teil.abgleich.offen : undefined,
    });
    if (kalVertrag(ziel) !== vorher) {
      kalVorbereitet = null;
      kalenderJetzt('fassung', { zwingen: true });
    }
    kalRuf.nachher();
    return a;
  } finally {
    kalNachfrageSpaeter();
  }
}

let kalNachfrageUhr = null;
/**
 * Ist noch etwas offen, das das Skript einträgt – und nicht erst morgen
 * (Tageskontingent: bis dahin ändert Fragen nichts)? { zeit } der jüngsten
 * Auskunft, sonst null.
 */
function kalStandOffen() {
  const stand = kalStand(kalMeta(), kalZiel(store.kalender()));
  return stand && stand.offen > 0 && !stand.morgen ? stand : null;
}

/**
 * Von selbst fragen – zwei Anlässe, höchstens ein Zeitgeber, und nur, solange
 * die App zu sehen ist (versteckt fragt keiner; beim Zurückkommen tut es
 * kalenderSichtbar()):
 *
 *   - Der neue Code ist unterwegs (kalCodeUnterwegs()): alle zwei Minuten,
 *     wo immer Tobi in der App ist – er kommt gerade aus Apps Script.
 *   - Das Skript trägt noch ein, und die Karte unter Mehr ist aufgeschlagen
 *     (kalRuf.karte()): sobald die letzte Auskunft drei Minuten alt ist
 *     (KAL_STAND_FRAGEN), höchstens alle zwei Minuten. Wer dort wartet, sieht
 *     es weitergehen – oder dass nichts nachkommt (kalStockt()). Bis v247
 *     fragte die Karte nur beim Zeichnen; eine Stunde auf der Karte war eine
 *     einzige Probe. Auf den anderen Seiten nicht: Ein Training dauert eine
 *     Stunde, und jede Probe ist ein Aufruf bei Google.
 */
function kalVonSelbstFragen() {
  if (document.hidden || !kalenderVerbunden()) return null;
  if (kalCodeUnterwegs()) return { code: true };
  const stand = kalRuf.karte() ? kalStandOffen() : null;
  return stand ? { stand } : null;
}

function kalNachfrageSpaeter() {
  if (kalNachfrageUhr) return;
  const anlass = kalVonSelbstFragen();
  if (!anlass) return;
  let warte = Math.max(KAL_FRAGEN_MIN, KAL_FASSUNG_FRAGEN - (Date.now() - kalFassungGefragt));
  if (anlass.stand) warte = Math.max(warte, KAL_STAND_FRAGEN - (Date.now() - anlass.stand.zeit));
  kalNachfrageUhr = setTimeout(() => {
    kalNachfrageUhr = null;
    // Inzwischen weggeschaltet oder die Karte verlassen: nichts. Das nächste
    // Zeichnen der Karte oder das Zurückkommen stellt den Zeitgeber neu.
    if (!kalVonSelbstFragen()) return;
    // Läuft gerade etwas (eine Rechnung nach einem Tipp), kommt die Probe dahinter.
    if (kalNachfragenNoetig()) kalEinreihen(kalNachfragen);
    else kalNachfrageSpaeter();
  }, warte);
}

/**
 * Für die Karte: nachfragen, wenn es etwas zu erfahren gibt (kalNachfragen())
 * – in der Warteschlange, und nur dann: Ein leerer Auftrag hielte sonst beim
 * Wegschalten das Senden auf (kalenderVerstecken() wartet, solange etwas läuft).
 * Ist es dafür zu früh, und der neue Code ist unterwegs: später.
 */
export function kalenderNachfragen() {
  if (kalBelegt > 0 || !kalNachfragenNoetig()) {
    kalNachfrageSpaeter();
    return;
  }
  kalEinreihen(kalNachfragen);
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
      if (!v) return;
      // Bei versteckter Seite wie beim Wegschalten (kalenderVerstecken()):
      // über 64 KiB trägt keepalive nicht – dann über den Service Worker.
      if (document.hidden && v.bytes > KAL_MAX_BYTES && await kalGrossWeg(v)) return;
      await kalSenden(v, { keepalive: !!document.hidden && v.bytes <= KAL_MAX_BYTES });
    });
  }, warte);
}

/**
 * Eine Sendung über 64 KiB bei versteckter Seite: in den Ausgang, der Service
 * Worker schickt sie (sw.js). true, wenn sie dort liegt; sonst (kein
 * Background Sync – Safari) schickt der Aufrufer sie, so gut es geht.
 */
async function kalGrossWeg(v) {
  const ausgang = await kalAusgangLegen(v, 'gross');
  if (ausgang) kalMetaSchreiben({ offen: true });
  notieren('kalender', { was: 'ausgang', grund: 'gross', bytes: v.bytes, ausgang }, true);
  return ausgang;
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
 * entscheidet sie, ob es sich lohnt) und ob die Karte unter Mehr gerade
 * aufgeschlagen ist (`karte` – dann fragt die App nach dem Stand von selbst,
 * kalNachfrageSpaeter()).
 */
export function kalenderEinrichten(ruf = {}) {
  kalRuf = { nachher: () => {}, karte: () => false, ...ruf };
  kalZeichenVorher = kalZeichen(store.getState());
  window.addEventListener('online', () => {
    if (!kalenderMoeglich()) return;
    if ((kalMeta().aus || []).length) kalEinreihen(kalAusErledigen).then(() => kalRuf.nachher());
    if (kalenderVerbunden() && kalMeta().offen) kalenderJetzt('online');
  });
}

/**
 * Nach jeder Meldung des Stores: sofort, wenn eine Einheit anfängt oder fertig
 * wird, sonst gedrosselt. Gar nicht, wenn sich nur die Pause geändert hat
 * (`was` 'pause' – Start, Ende, „+30 s", store.setRest()): Die Vorschau liest
 * state.rest nicht, es käme dasselbe heraus. Bis zur Prüfung des Entwurfs
 * rechnete jede davon die Vorschau samt Jahr neu – am ersten Haken zweimal
 * statt einmal, am Pausenende noch einmal: gemessen 13 statt 6 Rechnungen für
 * sechs Sätze mit Pause, also rund 40 statt 20 je Training. Mit Fußball jede
 * Woche kostet jede davon im Worker 2,6–2,8 s. Ebenso wenig bei 'ansicht'
 * (seit v247): der Reiter (go() in js/app.js) und welche Einheit in der
 * Fokusansicht offen ist (`fokusOffen`, render()) – beides steht im Zustand,
 * damit die App nach dem Neuladen dort wieder aufgeht, und die Vorschau liest
 * beides nicht. Bis dahin rechnete jeder Tab-Wechsel das Jahr im Worker neu
 * (am Handy an Tobis Stand geschätzt eine knappe Sekunde, mit vielen Terminen
 * mehrere) und schickte nie etwas: gleicher Fingerabdruck.
 */
export function kalenderGeaendert(was) {
  if (was === 'pause' || was === 'ansicht' || !kalenderVerbunden()) return;
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
      // ob der neue Code inzwischen im Skript steht oder wie weit das Skript
      // mit dem Jahr ist – nur, wenn es etwas zu erfahren gibt.
      if (v) await kalSenden(v);
      else await kalNachfragen();
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
 * Worker schickt es, ohne Grenze und auch bei geschlossener App. Ohne
 * Background Sync (Safari) geht sie gewöhnlich hinaus, so weit die Seite
 * noch kommt – und gilt als offen, bis die Antwort da ist: Beim Zurückkommen
 * geht sie sonst noch einmal. Bis zur Prüfung ging sie dort gar nicht, und
 * nichts holte sie nach bis zur nächsten Änderung.
 */
export function kalenderVerstecken() {
  if (!kalenderVerbunden() || kalBelegt > 0) return;
  const v = kalVorbereitet;
  if (!v) return;
  kalAnhalten();
  if (v.bytes > KAL_MAX_BYTES) {
    kalEinreihen(async () => {
      if (await kalGrossWeg(v)) return;
      kalMetaSchreiben({ offen: true });
      await kalSenden(v);
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
  if (l && l.ziel === ziel && l.art === 'vorschau' && Number.isInteger(l.vertrag) && l.vertrag !== kalVertrag(ziel) && !l.fernFehler) {
    // Läuft gerade etwas, ist das meist schon die Sendung in der passenden
    // Fassung (die Nachfrage beim Zurückkommen hat sie eben angestoßen) – dann
    // nur, wenn sie danach nicht schon beim Skript ist, statt ein zweites Mal.
    kalenderJetzt('fassung', { zwingen: kalBelegt === 0 });
  } else if (m.offen && Date.now() - kalLetzterVersuch > 60 * 1000) {
    kalenderJetzt('sichtbar');
  } else {
    // Steht neuer Code aus, kommt Tobi vielleicht gerade aus Apps Script
    // zurück – hat er ihn eben kopiert, fragt die App gleich, ohne die zwei
    // Minuten abzuwarten; trägt das Skript noch das Jahr ein, sagt die Karte,
    // wie weit.
    const sofort = kalCodeUnterwegs(ziel);
    if (kalNachfragenNoetig({ sofort })) kalEinreihen(() => kalNachfragen({ sofort }));
    else kalNachfrageSpaeter();
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
    // Galt bei der bisherigen Verbindung der Plan eines anderen Geräts, bekommt
    // sie gleich kein „aus" (kalFremd()) – festgestellt, bevor die Probe an die
    // neue den letzten Versuch überschreibt.
    const altFremd = kalFremd(kalMeta(), kalZiel(store.kalender()));
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
    if (alt && alt.url && alt.url !== u.url && !altFremd) kalAusDazu(alt);
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
 * Gilt beim Skript dieser Verbindung der Plan eines anderen Geräts? Eine
 * Antwort sagte „aelter" – auf eine eigene Sendung oder eine, die der Service
 * Worker nachgeschickt hat (`fremd`, kalVermerken(), kalNachLesen()) –, und
 * danach kam von hier nichts mehr an (sonst wäre es wieder dieses Gerät). Dann
 * geht beim Trennen, bei „Alle Daten löschen" und beim Wechsel zu einer
 * anderen URL kein „aus" hinaus: Das Skript nimmt ein „aus" von jedem Gerät mit
 * dem Kennwort an und räumte damit die Termine ab heute weg – die des Geräts,
 * mit dem trainiert wird. Die Karte rät in diesem Fall ja gerade zum Trennen
 * (kalenderSatz(), „aelter").
 *
 * Bis zur Prüfung von v247 hing es am letzten Versuch – und jeder Versuch
 * danach überschrieb ihn, auch einer, der nicht ankam: Sagte das Skript
 * „beschäftigt" (ein Lauf „weiter" des anderen Geräts hält die Sperre bis zu
 * viereinhalb Minuten) oder fehlte das Netz, war der Hinweis weg, und
 * „Trennen" schickte das „aus" doch. Was eine App von vor v247 hinterließ – nur
 * ein letzter Versuch „aelter" –, zählt hier noch mit.
 *
 * { ziel, zeit, stand } oder null.
 */
function kalFremd(m, ziel) {
  if (!ziel) return null;
  const a = m.angekommen && m.angekommen.ziel === ziel && Number.isFinite(m.angekommen.zeit) ? m.angekommen.zeit : null;
  let f = m.fremd && m.fremd.ziel === ziel && Number.isFinite(m.fremd.zeit) ? m.fremd : null;
  if (!f && m.letzte && m.letzte.ziel === ziel && m.letzte.ergebnis === 'aelter' && Number.isFinite(m.letzte.zeit)) {
    f = { ziel, zeit: m.letzte.zeit, stand: null };
  }
  return f && !(a !== null && a > f.zeit) ? f : null;
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
 *
 * Gilt beim Skript der Plan eines anderen Geräts (kalFremd(), „aelter"), geht
 * seit v247 kein „aus": Getrennt wird nur dieses Gerät, den Kalender pflegt
 * weiter das andere.
 */
export async function kalenderTrennen() {
  const k = store.kalender();
  if (!k || !k.url) return { ok: true, wartet: false, satz: '' };
  const fremd = kalFremd(kalMeta(), kalZiel(k));
  kalAnhalten();
  kalWiederWeg();
  kalVorbereitet = null;
  if (!fremd) kalAusDazu(k);
  store.setzeKalender({ url: null });
  kalMetaSchreiben({ hash: null, ziel: null, offen: false });
  await kalAusgangLeeren();
  if (fremd) {
    notieren('kalender', { was: 'getrennt', fremd: true }, true);
    kalRuf.nachher();
    return { ok: true, wartet: false, satz: 'Getrennt – dieses Gerät schickt nichts mehr. Den Kalender pflegt weiter das andere Gerät.' };
  }
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
  // Gilt beim Skript der Plan eines anderen Geräts, gibt es von hier nichts
  // abzuschalten (kalFremd()).
  if (k && k.url && !kalFremd(kalMeta(), kalZiel(k))) kalAusDazu(k);
  kalMetaSchreiben({ hash: null, ziel: null, offen: false, letzte: null, angekommen: null, nach: null, stockt: null, fremd: null });
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
 *   kopiert    wann er den Code dafür kopiert hat (ms), oder null
 *   fassungZeit  wann die letzte lesbare Antwort kam, die die Fassung sagte
 *              (ms), oder null
 *   fehlt      eine Antwort mindestens drei Minuten nach dem Kopieren meldet
 *              noch die alte Fassung – meist fehlt „Neue Version"
 *   unterwegs  neuer Code erkannt, das Jahr geht an das Skript: Fassung 2
 *              meldete eine Antwort nach der letzten Sendung, die ankam, und
 *              die war noch keine mit dem Jahr
 *   nachgeholt der letzte Versuch scheiterte, aber danach kam doch etwas an
 *              (der Service Worker hat nachgeschickt) – er ist überholt
 *   stand      wie weit das Skript mit dem Eintragen ist (kalStand()), oder
 *              null, wenn die letzte Sendung keine mit Ferne war
 *   stockt     das Skript trägt nichts nach (kalStockt()): { seit, proben,
 *              zuletzt, offen }, sonst null
 *   nach       was der Service Worker nachgeschickt hat – nur zu dieser
 *              Verbindung, und nur, solange keine neuere eigene Sendung ankam
 *   hinweisAlt der Hinweis der letzten eigenen Sendung beschreibt nur ihren
 *              Augenblick (Tageskontingent, Google bremst – KALENDER_SPAETER,
 *              KALENDER_KONTINGENT), und danach kam eine neuere Auskunft: eine
 *              Probe oder eine Sendung, die der Service Worker nachgeschickt
 *              hat. Die Karte zeigt ihn dann nicht mehr. Was zu tun bleibt
 *              („einrichten", eine URL, „Zugriff: Jeder"), bleibt stehen.
 *   fremd      eine Antwort sagte „aelter", und danach kam von hier nichts an
 *              (kalFremd()): Ein anderes Gerät mit neuerem Training speist
 *              dieses Skript. { zuletzt, einheiten, saetze } – dessen Stand aus
 *              der Antwort, soweit sie ihn trug (sonst die Felder null)
 */
export function kalenderLage() {
  const k = store.kalender();
  const m = kalMeta();
  const ziel = kalZiel(k);
  const letzte = m.letzte && ziel && m.letzte.ziel === ziel ? m.letzte : null;
  const angekommen = m.angekommen && ziel && m.angekommen.ziel === ziel ? m.angekommen : null;
  const stand = ziel ? kalStand(m, ziel) : null;
  // Nur ein Vermerk zu dieser Verbindung, den keine eigene Sendung überholt
  // hat (ein Vermerk von vor v247 trägt kein Ziel – der zählt wie bisher).
  const nach = m.nach && Number.isFinite(m.nach.zeit) && !(m.nach.ziel && m.nach.ziel !== ziel)
    && !(angekommen && angekommen.zeit > m.nach.zeit) ? m.nach : null;
  const fassung = kalFassung(ziel);
  const vorlage = kalenderVorlageFassung();
  const kopiert = m.kopiert && ziel && m.kopiert.ziel === ziel && m.kopiert.vorlage === vorlage && Number.isFinite(m.kopiert.zeit)
    ? m.kopiert.zeit : null;
  const neuerCode = !!ziel && kalNeuerCode(fassung);
  const antwort = m.fassung && m.fassung.ziel === ziel && Number.isFinite(m.fassung.zeit) ? m.fassung.zeit : null;
  const nachgeholt = !!letzte && !letzte.ok && !!angekommen && Number.isFinite(angekommen.zeit) && angekommen.zeit > letzte.zeit;
  // Ein Hinweis, der nur den Augenblick der letzten eigenen Sendung beschreibt,
  // ist überholt, sobald danach eine Auskunft kam – eine Probe (`fassung`
  // trägt die Zeit jeder lesbaren Antwort), ein Stand von ihr oder eine
  // Sendung, die der Service Worker nachgeschickt hat. Bis v247 galt das nur
  // für das Tageskontingent und nur neben einem Stand mit Jahr.
  const augenblick = !!letzte && letzte.ok && letzte.art !== 'probe' && !!letzte.hinweis
    && (letzte.morgen === true || letzte.hinweis === KALENDER_SPAETER || letzte.hinweis === KALENDER_KONTINGENT);
  const hinweisAlt = augenblick && [stand && stand.zeit, angekommen && angekommen.zeit, antwort]
    .some((t) => Number.isFinite(t) && t > letzte.zeit);
  const f = kalFremd(m, ziel);
  const fremd = f ? { zuletzt: null, einheiten: null, saetze: null, ...(f.stand || {}) } : null;
  // Unterwegs, bis die erste Sendung mit dem Jahr ankommt (`angekommen`, auch
  // über den Service Worker) oder endgültig beantwortet ist: Bis zum
  // Gegenlesen von v246 stand „Neuer Code erkannt" nach „aelter" (ein anderes
  // Gerät hat zuletzt trainiert) bis zur nächsten Sendung, die ankam. Scheitert
  // sie am Netz, am beschäftigten Skript oder ohne Antwort, ist sie weiter
  // unterwegs – die App und der Service Worker schicken sie noch einmal.
  const abgewiesen = !!letzte && letzte.vertrag === KAL_VERTRAG && !letzte.ok && !letzte.wieder && !KAL_NOCHMAL.has(letzte.ergebnis);
  const unterwegs = !!angekommen && fassung !== null && fassung >= KAL_VERTRAG && angekommen.vertrag !== KAL_VERTRAG
    && antwort !== null && antwort > angekommen.zeit && !abgewiesen;
  return {
    moeglich: kalenderMoeglich(),
    token: !!(k && k.token),
    verbunden: !!ziel,
    minuten: k ? k.minuten : 17 * 60 + 30,
    erinnerung: k ? k.erinnerung : 30,
    letzte,
    angekommen,
    nach,
    hinweisAlt,
    ausstehend: (m.aus || []).length,
    zuAlt: kalZuAlt(letzte),
    handeln: !!ziel && !nachgeholt && kalenderHandeln(letzte),
    vorlage,
    fassung,
    vertrag: kalVertrag(ziel),
    neuerCode,
    gesehen: !!vorlage && m.gesehen === vorlage,
    kopiert,
    fassungZeit: antwort,
    fehlt: neuerCode && kopiert !== null && antwort !== null && antwort - kopiert >= KALENDER_JAHR.fehltNach,
    unterwegs,
    nachgeholt,
    stand,
    stockt: ziel ? kalStockt(m, ziel) : null,
    fremd,
  };
}

/** Tobi hat die Bitte um neuen Code gesehen (Ansehen, Code kopieren) – nicht mehr auf dem Dashboard. */
export function kalenderJahrGesehen() {
  const v = kalenderVorlageFassung();
  if (v && kalMeta().gesehen !== v) kalMetaSchreiben({ gesehen: v });
}

/**
 * „Code kopieren", während neuer Code aussteht: wann. Meldet das Skript ein
 * paar Minuten danach noch die alte Fassung, fehlt meist „Neue Version" – die
 * Karte sagt es dann (KALENDER_JAHR.fehlt), statt still dieselbe Bitte zu
 * zeigen.
 */
export function kalenderCodeKopiert() {
  const v = kalenderVorlageFassung();
  const ziel = kalZiel(store.kalender());
  if (!(v && ziel && kalNeuerCode(kalFassung(ziel)))) return;
  kalMetaSchreiben({ kopiert: { zeit: Date.now(), vorlage: v, ziel } });
  // Ab jetzt fragt die App öfter nach (kalCodeUnterwegs()).
  kalNachfrageSpaeter();
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
    + `${l.stand && l.stand.offen > 0 ? ` · ${l.stand.offen} offen${l.stockt ? ', trägt nichts nach' : ''}` : ''}`
    + `${l.fremd ? ' · beim Skript gilt ein anderes Gerät' : ''}`
    + `${l.letzte && !l.letzte.ok ? ` · zuletzt ${l.letzte.ergebnis}` : ''}${l.ausstehend ? ` · ${l.ausstehend} Abschalten offen` : ''}`;
}
