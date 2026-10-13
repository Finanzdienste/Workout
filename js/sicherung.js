/*
 * Die automatische Sicherung – verschlüsselt, bevor sie das Gerät verlässt.
 *
 *     „Wenn ich auch 'Sicherung weitergeben' klicke passiert nichts. Lass das
 *      doch generell einfach automatisch sichern"
 *
 * Bis v239 stand in js/app.js ausdrücklich, dass die App den Verlauf *nicht*
 * von selbst irgendwohin schickt. Tobi ist Nutzer und Betreiber zugleich und
 * hat das anders entschieden. Die Grundsätze dahinter bleiben, und an ihnen
 * hängt die ganze Bauart:
 *
 *   Niemand außer dir kann es lesen.
 *                Der Schlüssel entsteht zufällig auf dem Gerät (256 Bit) und
 *                geht nie über die Leitung. Hinaus geht nur, was AES-GCM aus
 *                dem Stand macht. Der Server – also auch der Betreiber – sieht
 *                eine Kennung, den Hash einer Schreibmarke, das Chiffrat, den
 *                IV, die Größe und die Uhrzeit. Beide Kennungen sind aus dem
 *                Schlüssel abgeleitet (SHA-256 über "id:" bzw. "w:" davor),
 *                nicht er selbst.
 *   Offengelegt. Einstieg und Mehr sagen in zwei Sätzen, was geschieht, mit
 *                dem Schalter daneben, dazu „Zuletzt gesichert: vor 3 Min."
 *   Abschaltbar. Aus heißt aus: keine einzige Anfrage, auch nicht beim Start.
 *   Löschbar.    Ein Knopf löscht die Sicherung auf dem Server; was 400 Tage
 *                niemand erneuert hat, löscht der Server von selbst.
 *
 * Wann gesichert wird – und nur, wenn sich der Inhalt geändert hat (der Hash
 * des Klartexts wird gemerkt):
 *
 *   nach dem Abschluss einer Einheit   sofort
 *   nach jeder anderen Änderung        gedrosselt, höchstens alle zwei Minuten
 *   beim Start                         wenn seit der letzten Sicherung etwas
 *                                      dazukam, und alle 30 Tage ohnehin, damit
 *                                      die 400 Tage nie ablaufen, solange die
 *                                      App benutzt wird
 *   beim Weglegen                      nur, was schon fertig verschlüsselt
 *                                      bereitliegt und unter 64 KB bleibt –
 *                                      mehr trägt keepalive nicht, und ohne
 *                                      keepalive stirbt die Anfrage mit der
 *                                      eingefrorenen Seite
 *   ohne Netz                          still; nachgeholt beim nächsten Anlass
 *                                      oder sobald der Browser „online" meldet
 *
 * Zwei Geräte, ein Schlüssel – nach dem Umzug ganz normal, solange das alte
 * Handy noch herumliegt. Jedes Schreiben nennt deshalb den Stand, den es zu
 * ersetzen glaubt (`p_vorher`). Hat dazwischen ein anderes Gerät geschrieben,
 * lehnt der Server mit „veraltet" ab, und dieses Gerät hört auf, statt den
 * neueren Stand still zu überschreiben. Was dann gilt, entscheidet der Mensch
 * unter Mehr.
 *
 * Was hier *nicht* steht: alles, was auf dem Bildschirm zu sehen ist. Das liegt
 * in js/app.js; dieses Modul weiß nichts von der Oberfläche und nichts vom
 * Trainingsplan. Was gesichert wird, reicht die App über
 * sicherungEinrichten() herein.
 */

import { hatServer } from './config.js';
import { fehltFunktion, grund, rpcAufruf } from './telemetry.js';

/** Eigener Schlüssel im Speicher, nicht im Zustand – siehe sicherungMetaLesen(). */
export const SICHERUNG_SPEICHER = 'workout.sicherung.v1';

const SICHERUNG_DROSSEL = 2 * 60 * 1000;
// Eine Änderung kommt selten allein: Abhaken, Gewicht, Pause. Fünf Sekunden
// fassen sie zu einer Sicherung zusammen, ohne dass etwas liegen bleibt.
const SICHERUNG_ERSTE = 5000;
const SICHERUNG_VORBEREITEN = 1000;
const SICHERUNG_START = 3000;
const SICHERUNG_AUFFRISCHEN = 30 * 24 * 3600 * 1000;
// Chrome nimmt für alle keepalive-Anfragen einer Seite zusammen höchstens
// 64 KiB an. Ein wenig Luft für die übrigen Felder und den Kopf.
const SICHERUNG_KEEPALIVE = 60 * 1024;

/**
 * Felder, die sich ändern, ohne dass sich am Training etwas ändert: welcher
 * Reiter offen ist, die laufende Pause, die Uhr der Einheit (die bei jedem
 * Wegschalten anhält), was dieses Gerät dem Rückkanal gemeldet hat. Sie fahren
 * in der Sicherung mit, zählen aber nicht als Änderung – sonst schickte jedes
 * Wegschalten eine neue Sicherung los. `share`, `deviceId` und `lastShare`
 * übernimmt ein Import ohnehin nicht (importJSON in js/store.js).
 */
const SICHERUNG_FLUECHTIG = new Set([
  'tab', 'rest', 'clock', 'fokusOffen', 'lastShare', 'share', 'deviceId', 'dauerhaft', 'lastBackup',
]);

/* ------------------------------------------------------------------ *
 * Was dieses Gerät über seine Sicherung weiß
 *
 * In einem eigenen Schlüssel, nicht im Zustand der App, aus zwei Gründen: Der
 * Zustand *ist* das, was gesichert wird – stünde „zuletzt gesichert" darin,
 * änderte jede Sicherung den Inhalt und löste die nächste aus. Und eine
 * Sicherungsdatei, die jemand weitergibt, trägt den Schlüssel nicht mit.
 *
 *   an        false, wenn abgeschaltet (fehlt: an)
 *   key       der Schlüssel, base64url, 43 Zeichen
 *   id, w     daraus abgeleitet: Kennung und Schreibmarke (hex)
 *   hash      SHA-256 des zuletzt gesicherten Inhalts
 *   ok        Zeitpunkt der letzten gelungenen Sicherung (ISO)
 *   stand     was der Server dabei als Stand vermerkt hat – das nächste
 *             Schreiben nennt ihn als Vorgänger
 *   fehler    warum der letzte Versuch nicht ging, oder null
 *   fehlt     der Server kennt die Funktionen nicht
 *   konflikt  { art: 'veraltet' | 'geloescht', am } – bis zur Entscheidung
 *             wird nicht mehr geschrieben
 *   aussen    { passwort, geprueft, link } – wann der Schlüssel wohin kam
 * ------------------------------------------------------------------ */

export function sicherungMetaLesen() {
  try {
    const roh = JSON.parse(localStorage.getItem(SICHERUNG_SPEICHER) || '{}');
    return roh && typeof roh === 'object' ? roh : {};
  } catch {
    return {};
  }
}

function sicherungMetaSchreiben(teil) {
  const neu = { ...sicherungMetaLesen(), ...teil };
  try {
    localStorage.setItem(SICHERUNG_SPEICHER, JSON.stringify(neu));
  } catch { /* voller Speicher – dann eben beim nächsten Mal */ }
  return neu;
}

/** Läuft die automatische Sicherung? Nur mit Server und nicht abgeschaltet. */
export const sicherungAn = () => hatServer() && sicherungMetaLesen().an !== false;

/* ------------------------------------------------------------------ *
 * Bytes, Hashes, Schlüssel
 * ------------------------------------------------------------------ */

const sicherungText = new TextEncoder();

function zuBase64(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(s);
}

function ausBase64(text) {
  const s = atob(text);
  const bytes = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
  return bytes;
}

const zuBase64Url = (bytes) => zuBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const ausBase64Url = (t) => ausBase64(t.replace(/-/g, '+').replace(/_/g, '/')
  + '='.repeat((4 - (t.length % 4)) % 4));

async function hexHash(text) {
  const h = new Uint8Array(await crypto.subtle.digest('SHA-256', sicherungText.encode(text)));
  return [...h].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const SCHLUESSEL_FORM = /^[A-Za-z0-9_-]{43}$/;

/**
 * Den Schlüssel aus dem lesen, was jemand eingibt: der Schlüssel selbst oder
 * der ganze Wiederherstellungs-Link. null, wenn es keiner ist.
 */
export function schluesselAus(eingabe) {
  const t = String(eingabe || '').trim();
  const treffer = /[#&]sicherung=([A-Za-z0-9_-]{43})(?![A-Za-z0-9_-])/.exec(t);
  const kandidat = treffer ? treffer[1] : t;
  return SCHLUESSEL_FORM.test(kandidat) ? kandidat : null;
}

/** Kennung und Schreibmarke – beide aus dem Schlüssel, keine verrät ihn. */
export async function sicherungAbleiten(key) {
  return { id: await hexHash(`id:${key}`), w: await hexHash(`w:${key}`) };
}

let schluesselEntsteht = null;

/** Der Schlüssel dieses Geräts – beim ersten Mal erzeugt. */
function eigenerSchluessel() {
  const m = sicherungMetaLesen();
  if (m.key && m.id && m.w) return Promise.resolve(m);
  // Zwei Aufrufe gleichzeitig dürfen nicht zwei Schlüssel erzeugen.
  if (!schluesselEntsteht) {
    schluesselEntsteht = (async () => {
      const key = zuBase64Url(crypto.getRandomValues(new Uint8Array(32)));
      const { id, w } = await sicherungAbleiten(key);
      return sicherungMetaSchreiben({
        key, id, w, seit: new Date().toISOString(), hash: null, ok: null, stand: null, aussen: {},
      });
    })().finally(() => { schluesselEntsteht = null; });
  }
  return schluesselEntsteht;
}

/* ------------------------------------------------------------------ *
 * Ver- und Entschlüsseln
 *
 * Klartext ist ein Byte für die Form und dahinter der Stand als JSON – mit
 * gzip gepackt, wo der Browser CompressionStream kennt (Form 1), sonst roh
 * (Form 0). Gepackt sind ein halbes Jahr Training rund 30 bis 60 KB statt 300
 * bis 500 KB. Die Form steht *im* Chiffrat: Von außen ist nicht einmal zu
 * sehen, ob gepackt wurde.
 * ------------------------------------------------------------------ */

async function aesSchluessel(key) {
  return crypto.subtle.importKey('raw', ausBase64Url(key), 'AES-GCM', false, ['encrypt', 'decrypt']);
}

function mitForm(form, bytes) {
  const out = new Uint8Array(bytes.length + 1);
  out[0] = form;
  out.set(bytes, 1);
  return out;
}

async function packen(text) {
  const roh = sicherungText.encode(text);
  const Packer = globalThis.CompressionStream;
  if (typeof Packer !== 'function') return mitForm(0, roh);
  const strom = new Blob([roh]).stream().pipeThrough(new Packer('gzip'));
  return mitForm(1, new Uint8Array(await new Response(strom).arrayBuffer()));
}

async function auspacken(bytes) {
  const rest = bytes.subarray(1);
  if (bytes[0] === 0) return new TextDecoder().decode(rest);
  if (bytes[0] === 1) {
    const Entpacker = globalThis.DecompressionStream;
    if (typeof Entpacker !== 'function') {
      throw new Error('Dieser Browser kann die Sicherung nicht entpacken – in Chrome öffnen.');
    }
    const strom = new Blob([rest]).stream().pipeThrough(new Entpacker('gzip'));
    return new TextDecoder().decode(await new Response(strom).arrayBuffer());
  }
  throw new Error('Diese Sicherung stammt aus einer neueren Fassung der App.');
}

export async function sicherungVerschluesseln(key, text) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const klar = await packen(text);
  const geheim = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await aesSchluessel(key), klar);
  return { daten: zuBase64(new Uint8Array(geheim)), iv: zuBase64(iv) };
}

export async function sicherungEntschluesseln(key, daten, iv) {
  let klar;
  try {
    klar = new Uint8Array(await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: ausBase64(iv) }, await aesSchluessel(key), ausBase64(daten)));
  } catch {
    throw new Error('Der Schlüssel passt nicht zu dieser Sicherung.');
  }
  return auspacken(klar);
}

/* ------------------------------------------------------------------ *
 * Der Takt
 * ------------------------------------------------------------------ */

let sicherungRuf = { stand: () => null, darf: () => false, nachher: () => {} };
let vorbereitet = null;          // { hash, id, w, daten, iv } – fertig für das Weglegen
let vorbereitenUhr = null;
let hochladenUhr = null;
let letzterVersuch = 0;
let unterwegs = false;
let kette = Promise.resolve();
// Fehlen die Funktionen auf dem Server, versucht es diese Sitzung nicht wieder:
// einmal je Start ist eine Frage, bei jeder Änderung wäre es eine Flut.
let fehltDieseSitzung = false;

/** Eins nach dem anderen: Zwei Schreibversuche zugleich hielten sich gegenseitig für ein fremdes Gerät. */
function einreihen(aufgabe) {
  kette = kette.then(aufgabe, aufgabe).catch(() => {});
  return kette;
}

function vergleichsText(stand) {
  return JSON.stringify(stand, function weglassen(k, v) {
    return this === stand && SICHERUNG_FLUECHTIG.has(k) ? undefined : v;
  });
}

/** Hält still, solange etwas dagegen spricht – Schalter, Server, Konflikt. */
function sicherungBereit() {
  if (!sicherungAn() || !sicherungRuf.darf()) return false;
  const m = sicherungMetaLesen();
  return !m.konflikt && !(m.fehlt && fehltDieseSitzung);
}

/**
 * Den Stand verschlüsseln, wenn er sich geändert hat. null, wenn nichts zu tun
 * ist. `auffrischen` verschlüsselt auch Unverändertes – für die 30 Tage.
 */
async function vorbereiten(auffrischen = false) {
  if (!sicherungBereit()) { vorbereitet = null; return null; }
  const stand = sicherungRuf.stand();
  const hash = await hexHash(vergleichsText(stand));
  if (hash === sicherungMetaLesen().hash && !auffrischen) { vorbereitet = null; return null; }
  const s = await eigenerSchluessel();
  const { daten, iv } = await sicherungVerschluesseln(s.key, JSON.stringify(stand));
  vorbereitet = { hash, id: s.id, w: s.w, daten, iv };
  return vorbereitet;
}

const jetztIso = () => new Date().toISOString();

/**
 * Einmal schreiben. Gibt zurück, ob es ging; was schiefging, steht danach in
 * den Metadaten und unter Mehr – eine Meldung mitten im Training gibt es nicht.
 */
async function hochladen(v, { keepalive = false, nochmal = true } = {}) {
  const m = sicherungMetaLesen();
  const params = { p_id: v.id, p_w: v.w, p_daten: v.daten, p_iv: v.iv, p_vorher: m.stand || null };
  if (keepalive && JSON.stringify(params).length > SICHERUNG_KEEPALIVE) return false;
  letzterVersuch = Date.now();
  unterwegs = true;
  let res;
  try {
    res = await rpcAufruf('sicherung_schreiben', params, { keepalive });
  } catch {
    sicherungMetaSchreiben({ fehler: 'Keine Verbindung' });
    return false;
  } finally {
    unterwegs = false;
  }
  if (res.ok) {
    let stand = null;
    try { stand = await res.json(); } catch { stand = null; }
    sicherungMetaSchreiben({
      hash: v.hash, ok: jetztIso(), stand: typeof stand === 'string' ? stand : null,
      fehler: null, fehlt: false, konflikt: null,
    });
    if (vorbereitet === v) vorbereitet = null;
    return true;
  }
  const msg = await grund(res);
  if (fehltFunktion(res, msg)) {
    fehltDieseSitzung = true;
    sicherungMetaSchreiben({ fehlt: true, fehler: msg });
    return false;
  }
  if (/\bveraltet\b/.test(msg)) {
    // Ein zweites Fenster derselben App hat dazwischen geschrieben und seinen
    // Stand in denselben Speicher gelegt – dann ist es kein fremdes Gerät.
    if (nochmal && (sicherungMetaLesen().stand || null) !== params.p_vorher) {
      return hochladen(v, { keepalive, nochmal: false });
    }
    sicherungMetaSchreiben({ konflikt: { art: 'veraltet', am: jetztIso() }, fehler: null });
    return false;
  }
  if (/\bgeloescht\b/.test(msg)) {
    sicherungMetaSchreiben({ konflikt: { art: 'geloescht', am: jetztIso() }, fehler: null });
    return false;
  }
  sicherungMetaSchreiben({ fehler: msg });
  // „zu oft" und alles Vorübergehende: beim nächsten Takt wieder.
  if (/\bzu oft\b/.test(msg)) planen();
  return false;
}

async function lauf(auffrischen = false) {
  const v = await vorbereiten(auffrischen);
  if (!v) return;
  await hochladen(v);
  sicherungRuf.nachher();
}

function planen() {
  if (hochladenUhr) return;
  const warte = Math.max(SICHERUNG_ERSTE, letzterVersuch + SICHERUNG_DROSSEL - Date.now());
  hochladenUhr = setTimeout(() => {
    hochladenUhr = null;
    einreihen(() => lauf());
  }, warte);
}

function anhalten() {
  clearTimeout(vorbereitenUhr);
  clearTimeout(hochladenUhr);
  vorbereitenUhr = null;
  hochladenUhr = null;
  vorbereitet = null;
}

/**
 * Die App sagt, was gesichert wird und wann es losgehen darf.
 *
 *   stand()    der vollständige Zustand, wie ihn auch die Sicherungsdatei hat
 *   darf()     false, solange der Einstieg den Satz dazu noch nicht gezeigt
 *              hat oder es nichts zu sichern gibt
 *   nachher()  nach jedem Versuch – die App zeichnet neu, wo es etwas ändert
 */
export function sicherungEinrichten(ruf) {
  sicherungRuf = { nachher: () => {}, ...ruf };
  window.addEventListener('online', () => sicherungGeaendert());
}

/** Nach jeder Änderung am Zustand: vorbereiten, dann gedrosselt schicken. */
export function sicherungGeaendert() {
  if (!sicherungAn()) return;
  clearTimeout(vorbereitenUhr);
  vorbereitenUhr = setTimeout(() => {
    vorbereitenUhr = null;
    einreihen(async () => { if (await vorbereiten()) planen(); });
  }, SICHERUNG_VORBEREITEN);
}

/** Nach dem Abschluss einer Einheit: sofort, an der Drossel vorbei. */
export function sicherungJetzt() {
  if (!sicherungAn()) return Promise.resolve();
  anhalten();
  return einreihen(() => lauf());
}

/** Beim Start: nur, wenn etwas dazukam – oder die letzte Sicherung alt wird. */
export function sicherungStart() {
  if (!sicherungAn()) return;
  setTimeout(() => {
    einreihen(() => {
      const m = sicherungMetaLesen();
      const alt = !!m.ok && Date.now() - Date.parse(m.ok) > SICHERUNG_AUFFRISCHEN;
      return lauf(alt);
    });
  }, SICHERUNG_START);
}

/**
 * Beim Weglegen der App: was schon fertig verschlüsselt bereitliegt, mit
 * keepalive hinterher – im selben Takt, ohne await davor, sonst friert die
 * Seite ein, bevor die Anfrage losgeht. Über 64 KB geht das nicht zuverlässig,
 * dann bleibt es beim nächsten Start.
 */
export function sicherungVerstecken() {
  if (!sicherungBereit() || unterwegs) return;
  const v = vorbereitet;
  if (!v || v.hash === sicherungMetaLesen().hash) return;
  hochladen(v, { keepalive: true }).then(() => sicherungRuf.nachher()).catch(() => {});
}

/* ------------------------------------------------------------------ *
 * Zurückholen, Übernehmen, Löschen
 * ------------------------------------------------------------------ */

/**
 * Eine Sicherung holen und entschlüsseln. { ok, text, stand } oder
 * { ok: false, msg, fehlt?, leer? }.
 */
export async function sicherungHolen(key) {
  if (!hatServer()) return { ok: false, msg: 'In dieser Fassung ist kein Server eingetragen.' };
  const { id } = await sicherungAbleiten(key);
  let res;
  try {
    res = await rpcAufruf('sicherung_lesen', { p_id: id });
  } catch {
    return { ok: false, msg: 'Keine Verbindung – mit Netz noch einmal versuchen.' };
  }
  if (!res.ok) {
    const msg = await grund(res);
    if (fehltFunktion(res, msg)) {
      return { ok: false, fehlt: true, msg: 'Der Server kennt die Sicherung noch nicht.' };
    }
    return { ok: false, msg };
  }
  const reihen = await res.json().catch(() => null);
  const z = Array.isArray(reihen) ? reihen[0] : null;
  if (!z || !z.daten || !z.iv) {
    return { ok: false, leer: true, msg: 'Unter diesem Schlüssel liegt keine Sicherung.' };
  }
  try {
    return { ok: true, text: await sicherungEntschluesseln(key, z.daten, z.iv), stand: z.stand || null };
  } catch (e) {
    return { ok: false, msg: e.message };
  }
}

async function loeschenMit(id, w) {
  try {
    const res = await rpcAufruf('sicherung_loeschen', { p_id: id, p_w: w });
    if (!res.ok) return { ok: false, zeilen: 0, msg: await grund(res) };
    const roh = (await res.text()).trim();
    const zahl = Number(roh);
    return { ok: true, zeilen: Number.isFinite(zahl) ? zahl : null, msg: '' };
  } catch {
    return { ok: false, zeilen: 0, msg: 'Keine Verbindung – mit Netz noch einmal versuchen.' };
  }
}

/**
 * Nach dem Zurückholen: Dieses Gerät sichert ab jetzt unter dem geholten
 * Schlüssel, mit dem Stand des Servers als Vorgänger. Hatte es vorher unter
 * einem eigenen gesichert, wird diese Sicherung gelöscht – sonst läge sie bis
 * zum Ablauf der 400 Tage auf dem Server, und kein Knopf käme mehr an sie
 * heran. Der Stand von vorher bleibt auf dem Gerät beiseitegelegt
 * (Mehr → Stand von vor dem Import zurückholen).
 */
export async function sicherungUebernehmen(key, { stand = null, weg = 'link' } = {}) {
  const alt = sicherungMetaLesen();
  anhalten();
  const { id, w } = await sicherungAbleiten(key);
  const heute = jetztIso().slice(0, 10);
  const aussen = weg === 'passwort' ? { passwort: heute, geprueft: heute }
    : weg === 'eigen' ? (alt.aussen || {}) : { link: heute };
  const t = Date.parse(stand || '');
  sicherungMetaSchreiben({
    key, id, w, stand, hash: null, ok: Number.isFinite(t) ? new Date(t).toISOString() : null,
    fehler: null, fehlt: false, konflikt: null, aussen,
  });
  if (alt.key && alt.key !== key && alt.ok && hatServer()) await loeschenMit(alt.id, alt.w);
}

/** „Sicherung auf dem Server löschen": erst abschalten, dann löschen. */
export async function sicherungLoeschen() {
  // Abschalten zuerst – sonst schriebe die nächste Änderung sie gleich wieder hin.
  sicherungMetaSchreiben({ an: false });
  anhalten();
  const m = sicherungMetaLesen();
  if (!m.id || !m.w) return { ok: true, zeilen: 0, msg: '' };
  const erg = await loeschenMit(m.id, m.w);
  if (erg.ok) sicherungMetaSchreiben({ stand: null, hash: null, ok: null, konflikt: null, fehler: null });
  return erg;
}

/** Für „Alle Daten löschen": die Sicherung auf dem Server und alles hier. */
export async function sicherungVergessen() {
  const m = sicherungMetaLesen();
  anhalten();
  try { localStorage.removeItem(SICHERUNG_SPEICHER); } catch { /* egal */ }
  if (m.id && m.w && hatServer()) await loeschenMit(m.id, m.w);
}

/** Schalter unter Mehr und im Einstieg. */
export function sicherungSchalten(an) {
  sicherungMetaSchreiben({ an });
  if (!an) { anhalten(); return; }
  fehltDieseSitzung = false;
  sicherungGeaendert();
}

/**
 * „Diesen Stand sichern" nach einem Konflikt, „Wieder sichern" nach einem
 * Löschen anderswo: den heutigen Stand des Servers als Vorgänger nehmen und
 * schreiben. Gefragt wurde vorher.
 */
export async function sicherungTrotzdem() {
  const m = sicherungMetaLesen();
  if (!m.id) return { ok: false, msg: 'Noch kein Schlüssel' };
  let stand = null;
  try {
    const res = await rpcAufruf('sicherung_lesen', { p_id: m.id });
    if (!res.ok) return { ok: false, msg: await grund(res) };
    const reihen = await res.json().catch(() => []);
    stand = Array.isArray(reihen) && reihen[0] ? reihen[0].stand || null : null;
  } catch {
    return { ok: false, msg: 'Keine Verbindung – mit Netz noch einmal versuchen.' };
  }
  sicherungMetaSchreiben({ stand, konflikt: null, hash: null, an: true });
  anhalten();
  await einreihen(() => lauf(true));
  const nach = sicherungMetaLesen();
  return { ok: !nach.konflikt && !nach.fehler, msg: nach.fehler || '' };
}

/* ------------------------------------------------------------------ *
 * Der Schlüssel außerhalb des Geräts
 * ------------------------------------------------------------------ */

function aussenVermerken(art) {
  const m = sicherungMetaLesen();
  sicherungMetaSchreiben({ aussen: { ...(m.aussen || {}), [art]: jetztIso().slice(0, 10) } });
}

/** Gibt es hier einen Passwortmanager, den die Seite ansprechen darf? */
export const passwortManagerDa = () => typeof window.PasswordCredential === 'function'
  && !!navigator.credentials && typeof navigator.credentials.store === 'function';

/**
 * Den Schlüssel im Passwortmanager ablegen. Chrome synchronisiert ihn über das
 * Google-Konto auf jedes andere Gerät mit demselben Konto.
 *
 * Der Benutzername trägt den Anfang der Kennung: Ein zweiter Schlüssel unter
 * demselben Namen ersetzte den ersten **still** – ein frisches Gerät, das
 * ablegt, bevor es zurückholt, hätte damit den einzigen Weg zur alten
 * Sicherung überschrieben. So stehen zwei Einträge nebeneinander, und die
 * Auswahl beim Zurückholen zeigt beide.
 *
 * store() sagt nicht, ob gespeichert wurde: Das Versprechen erfüllt sich,
 * bevor Chrome überhaupt fragt. Deshalb heißt der Vermerk „übergeben" – ob es
 * wirklich dort liegt, prüft schluesselPruefen().
 */
export async function schluesselAblegen() {
  const s = await eigenerSchluessel();
  const ausweis = new window.PasswordCredential({
    id: `workout-sicherung-${s.id.slice(0, 8)}`, name: 'Workout-Sicherung', password: s.key,
  });
  await navigator.credentials.store(ausweis);
  aussenVermerken('passwort');
}

/** Liegt der Schlüssel im Passwortmanager? Fragt mit Auswahl, also nur auf Tipp. */
export async function schluesselPruefen() {
  const m = sicherungMetaLesen();
  const c = await navigator.credentials.get({ password: true, mediation: 'optional' });
  const da = !!c && c.password === m.key;
  if (da) aussenVermerken('geprueft');
  return da;
}

/** Den Schlüssel aus dem Passwortmanager holen – mit Auswahl, wie jede Anmeldung. */
export async function schluesselAusManager() {
  if (!passwortManagerDa() || typeof navigator.credentials.get !== 'function') return null;
  const c = await navigator.credentials.get({ password: true, mediation: 'optional' });
  return c && c.password ? schluesselAus(c.password) : null;
}

/** Der Wiederherstellungs-Link: der Schlüssel im Anker, und der geht nie an einen Server. */
export async function sicherungLink(basis) {
  const s = await eigenerSchluessel();
  return `${basis}#sicherung=${s.key}`;
}

/** Den Link als außerhalb vermerken – nach dem Teilen oder Kopieren. */
export const linkVermerken = () => aussenVermerken('link');
