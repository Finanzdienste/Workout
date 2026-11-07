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
 *                nicht er selbst. Einen Schlüssel aus einem Link übernimmt das
 *                Gerät nie als seinen eigenen (sicherungUebernehmen()) – sonst
 *                läse, wer den Link geschickt hat, jedes künftige Training mit.
 *   Offengelegt. Einstieg und Mehr sagen in zwei Sätzen, was geschieht, mit
 *                dem Schalter daneben, dazu „Zuletzt gesichert: vor 3 Min."
 *   Abschaltbar. Aus heißt aus: keine einzige Sicherungsanfrage, auch nicht
 *                beim Start. Nur ein Löschauftrag, den der Mensch selbst
 *                gegeben hat, geht noch hinaus – Löschen ist kein Sichern.
 *   Löschbar.    Ein Knopf löscht die Sicherung auf dem Server; „Alle Daten
 *                löschen" nimmt sie mit, auch ohne Netz (dann sobald wieder
 *                welches da ist); was 400 Tage niemand erneuert hat, löscht
 *                der Server von selbst.
 *
 * Wann gesichert wird – und nur, wenn sich der Inhalt geändert hat (der Hash
 * des Klartexts wird gemerkt):
 *
 *   nach dem Abschluss einer Einheit   sofort – ob per Knopf oder mit dem
 *                                      letzten Haken (einheitBeenden() in
 *                                      js/app.js)
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
 * Und nie öfter als alle zehn Sekunden: Der Server lehnt darunter mit „zu oft"
 * ab. Das hält das Gerät selbst ein, statt es sich sagen zu lassen – sonst lag
 * eine Einheit, die drei Sekunden nach einer gedrosselten Sicherung fertig
 * wurde, bis zum nächsten Start nur auf dem Gerät.
 *
 * Zwei Geräte, ein Schlüssel – nach dem Umzug ganz normal, solange das alte
 * Handy noch herumliegt. Jedes Schreiben nennt deshalb den Stand, den es zu
 * ersetzen glaubt (`p_vorher`). Hat dazwischen ein anderes Gerät geschrieben,
 * lehnt der Server mit „veraltet" ab, und dieses Gerät hört auf, statt den
 * neueren Stand still zu überschreiben. Was dann gilt, entscheidet der Mensch
 * unter Mehr. War es in Wahrheit dieses Gerät selbst – das Schreiben kam an,
 * die Antwort nicht –, erkennt es das am IV (hochladen()).
 *
 * Was hier *nicht* steht: alles, was auf dem Bildschirm zu sehen ist. Das liegt
 * in js/app.js; dieses Modul weiß nichts von der Oberfläche und nichts vom
 * Trainingsplan. Was gesichert wird, reicht die App über
 * sicherungEinrichten() herein.
 */

import { hatServer } from './config.js';
import { notieren } from './diagnose.js';
import { fehltFunktion, grund, rpcAufruf } from './telemetry.js';

/** Eigener Schlüssel im Speicher, nicht im Zustand – siehe sicherungMetaLesen(). */
export const SICHERUNG_SPEICHER = 'workout.sicherung.v1';

/**
 * Was dieses Gerät vor dem letzten Zurückholen über seine Sicherung wusste –
 * für „Stand von vor dem Import zurückholen" (sicherungRueckweg()).
 */
const SICHERUNG_ABLAGE = 'workout.sicherung.v1.vorImport';

/**
 * Löschaufträge, die noch nicht beim Server angekommen sind: [{ id, w, seit }].
 * In einem eigenen Schlüssel, weil „Alle Daten löschen" den der Sicherung
 * mitnimmt – und der Auftrag genau das überleben muss.
 */
const SICHERUNG_LOESCHEN = 'workout.sicherung.loeschen';

const SICHERUNG_DROSSEL = 2 * 60 * 1000;
// Eine Änderung kommt selten allein: Abhaken, Gewicht, Pause. Fünf Sekunden
// fassen sie zu einer Sicherung zusammen, ohne dass etwas liegen bleibt.
const SICHERUNG_ERSTE = 5000;
const SICHERUNG_VORBEREITEN = 1000;
const SICHERUNG_START = 3000;
const SICHERUNG_AUFFRISCHEN = 30 * 24 * 3600 * 1000;
// Der Server nimmt je Sicherung höchstens alle zehn Sekunden etwas an – eine
// halbe Sekunde Luft für die Zeit, die die Antwort unterwegs war.
const SICHERUNG_SPERRE = 10500;
// Fehlen die Funktionen auf dem Server, fragt das Gerät höchstens so oft
// wieder nach: oft genug, dass es nach dem Einrichten bald von selbst geht,
// selten genug, dass es keine Flut wird.
const SICHERUNG_FEHLT_PAUSE = 10 * 60 * 1000;
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
 *   herkunft  'geraet' (hier erzeugt) oder 'geholt' (aus dem eigenen
 *             Passwortmanager übernommen)
 *   hash      SHA-256 des zuletzt gesicherten Inhalts
 *   ok        Zeitpunkt der letzten gelungenen Sicherung (ISO)
 *   zuletzt   dasselbe in der Uhr dieses Geräts (ms) – für die zehn Sekunden
 *   stand     was der Server dabei als Stand vermerkt hat – das nächste
 *             Schreiben nennt ihn als Vorgänger
 *   offen     [{ iv, hash }] – abgeschickt, Antwort noch nicht da
 *   fehler    warum der letzte Versuch nicht ging, oder null
 *   fehlt     der Server kennt die Funktionen nicht
 *   konflikt  { art: 'veraltet' | 'geloescht', am } – bis zur Entscheidung
 *             wird nicht mehr geschrieben
 *   aussen    { passwort, geprueft, link } – wann der Schlüssel wohin kam
 * ------------------------------------------------------------------ */

function jsonLesen(schluessel, ersatz) {
  try {
    const roh = JSON.parse(localStorage.getItem(schluessel) || 'null');
    return roh && typeof roh === 'object' ? roh : ersatz;
  } catch {
    return ersatz;
  }
}

function jsonSchreiben(schluessel, wert) {
  try {
    if (wert === null) localStorage.removeItem(schluessel);
    else localStorage.setItem(schluessel, JSON.stringify(wert));
  } catch { /* voller Speicher – dann eben beim nächsten Mal */ }
}

export function sicherungMetaLesen() {
  const m = jsonLesen(SICHERUNG_SPEICHER, {});
  return Array.isArray(m) ? {} : m;
}

function sicherungMetaSchreiben(teil) {
  const neu = { ...sicherungMetaLesen(), ...teil };
  jsonSchreiben(SICHERUNG_SPEICHER, neu);
  sicherungVermerken(teil);
  return neu;
}

/**
 * Fürs Diagnoseprotokoll (js/diagnose.js): das Ergebnis eines Versuchs.
 *
 * Hier und nicht in jedem Zweig von hochladen(): Jedes Ergebnis landet in den
 * Metadaten, und zwar genau so – gelungen mit `ok` und einer frischen Zeit in
 * `zuletzt`, gescheitert mit `fehler`, `fehlt` oder `konflikt`. Was sonst
 * hierherkommt (Schlüssel entsteht, Schalter, Zurückholen, Rückweg), setzt
 * diese Felder höchstens leer oder ohne Zeit und bleibt still. Der Schlüssel
 * selbst steht nie in der Zeile – nur, was der Versuch ergab.
 */
function sicherungVermerken(teil) {
  if (teil.konflikt) notieren('sicherung', { ok: false, konflikt: teil.konflikt.art });
  else if (teil.fehlt === true) notieren('sicherung', { ok: false, fehlt: true });
  else if (teil.fehler) notieren('sicherung', { ok: false, fehler: teil.fehler });
  else if (teil.ok && teil.zuletzt) notieren('sicherung', { ok: true });
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
        key, id, w, herkunft: 'geraet', seit: new Date().toISOString(),
        hash: null, ok: null, zuletzt: 0, stand: null, offen: [], konflikt: null, aussen: {},
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
let sperreUhr = null;
let letzterVersuch = 0;
let kette = Promise.resolve();
let belegt = 0;                  // Aufgaben in der Warteschlange, die laufende mitgezählt
// Wann die App zuletzt erfahren hat, dass dem Server die Funktionen fehlen.
// 0 beim Start: einmal je Start wird gefragt, danach höchstens alle zehn
// Minuten – auch ohne Neustart, denn die installierte App bleibt auf Android
// oft tagelang im Speicher, und wer den SQL-Block gerade ausgeführt hat, soll
// es bald sehen.
let fehltGeprueft = 0;

/**
 * Eins nach dem anderen – Schreiben, Löschen, Zurückholen. Zwei Schreibversuche
 * zugleich hielten sich gegenseitig für ein fremdes Gerät, und ein Löschen, das
 * an einem laufenden Schreiben vorbeizieht, findet die Zeile noch nicht, die
 * gleich danach entsteht. Gibt zurück, was die Aufgabe zurückgibt.
 */
function einreihen(aufgabe) {
  belegt += 1;
  const ergebnis = kette.then(aufgabe, aufgabe);
  kette = ergebnis.catch(() => {}).then(() => { belegt -= 1; });
  return ergebnis.catch(() => undefined);
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
  return !m.konflikt && !(m.fehlt && Date.now() - fehltGeprueft < SICHERUNG_FEHLT_PAUSE);
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
const isoAus = (t) => (Number.isFinite(Date.parse(t || '')) ? new Date(Date.parse(t)).toISOString() : null);

/**
 * Wie lange der Server noch „zu oft" sagen würde – gerechnet in der Uhr dieses
 * Geräts ab der letzten gelungenen Sicherung. Höchstens die zehn Sekunden:
 * Springt die Uhr zurück, soll das Gerät nicht stundenlang warten.
 */
function sperreRest() {
  const z = Number(sicherungMetaLesen().zuletzt) || 0;
  return Math.min(Math.max(z + SICHERUNG_SPERRE - Date.now(), 0), SICHERUNG_SPERRE);
}

/** Nach Ablauf der zehn Sekunden schicken, was dann ansteht. */
function nachDerSperre(ms = sperreRest()) {
  clearTimeout(sperreUhr);
  sperreUhr = setTimeout(() => {
    sperreUhr = null;
    einreihen(() => lauf());
  }, Math.max(ms, 50));
}

/** Was der Server unter dieser Kennung gerade hält – oder warum das nicht zu erfahren war. */
async function zeileLesen(id) {
  try {
    const res = await rpcAufruf('sicherung_lesen', { p_id: id });
    if (!res.ok) return { ok: false, msg: await grund(res) };
    const reihen = await res.json().catch(() => null);
    return { ok: true, zeile: Array.isArray(reihen) && reihen[0] ? reihen[0] : null };
  } catch {
    return { ok: false, msg: 'Keine Verbindung' };
  }
}

/**
 * Nach „veraltet": War das andere Gerät in Wahrheit dieses hier?
 *
 * So kommt es dazu: Das Gerät schickt, der Server schreibt, aber die Antwort
 * kommt nie an – Android beendet die weggelegte App, das Netz reißt nach dem
 * Schreiben ab, oder der Abbruch nach zehn Sekunden greift bei langsamem Netz.
 * Das Gerät kennt dann seinen eigenen neuen Stand nicht, nennt beim nächsten
 * Mal den alten als Vorgänger und bekommt „veraltet" – und hielt bis v240 sich
 * selbst für ein fremdes Gerät und die Sicherung an, obwohl es nur das eine
 * Handy gibt.
 *
 * Erkennbar ist es am IV: Er ist bei jeder Verschlüsselung frisch gewürfelt,
 * also kann nur dieses Gerät eine Zeile mit genau dem IV geschrieben haben, den
 * es vor dem Abschicken unter `offen` vermerkt hat.
 *
 *   'eigen'   ja – Stand übernommen, weiter wie nach einer gelungenen Sicherung
 *   'fremd'   nein, wirklich ein anderes Gerät
 *   'unklar'  das ließ sich gerade nicht erfahren (kein Netz) – später wieder
 */
async function eigenesSchreiben(id) {
  const offen = sicherungMetaLesen().offen || [];
  if (!offen.length) return 'fremd';
  const erg = await zeileLesen(id);
  if (!erg.ok) return 'unklar';
  const z = erg.zeile;
  const treffer = z && offen.find((o) => o.iv === z.iv);
  if (!treffer) return 'fremd';
  sicherungMetaSchreiben({
    stand: z.stand || null, hash: treffer.hash, ok: isoAus(z.stand) || jetztIso(),
    // Wann es genau ankam, weiß das Gerät nicht – es rechnet vorsichtig mit „eben".
    zuletzt: Date.now(), offen: [], fehler: null, fehlt: false, konflikt: null,
  });
  return 'eigen';
}

/**
 * Einmal schreiben. Gibt zurück, ob es ging; was schiefging, steht danach in
 * den Metadaten und unter Mehr – eine Meldung mitten im Training gibt es nicht.
 *
 * Bis zum Abschicken kein await: Beim Weglegen der App muss die Anfrage im
 * selben Takt losgehen, sonst friert die Seite vorher ein.
 */
async function hochladen(v, { keepalive = false, nochmal = true } = {}) {
  const m = sicherungMetaLesen();
  // Inzwischen ein anderer Schlüssel – vergessen, zurückgeholt, Rückweg: Was
  // hier bereitlag, gehört nicht mehr unter diese Kennung.
  if (m.id !== v.id) return false;
  const params = { p_id: v.id, p_w: v.w, p_daten: v.daten, p_iv: v.iv, p_vorher: m.stand || null };
  if (keepalive && JSON.stringify(params).length > SICHERUNG_KEEPALIVE) return false;
  // Vor dem Abschicken vermerken, was unterwegs ist – geht die Antwort
  // verloren, erkennt das Gerät seine Zeile später daran (eigenesSchreiben()).
  const offen = [...(m.offen || []).filter((o) => o.iv !== v.iv), { iv: v.iv, hash: v.hash }].slice(-5);
  sicherungMetaSchreiben({ offen });
  letzterVersuch = Date.now();
  let res;
  try {
    res = await rpcAufruf('sicherung_schreiben', params, { keepalive });
  } catch {
    sicherungMetaSchreiben({ fehler: 'Keine Verbindung' });
    return false;
  }
  if (sicherungMetaLesen().id !== v.id) return false;
  if (res.ok) {
    let stand = null;
    try { stand = await res.json(); } catch { stand = null; }
    sicherungMetaSchreiben({
      hash: v.hash, ok: jetztIso(), zuletzt: Date.now(), stand: typeof stand === 'string' ? stand : null,
      offen: [], fehler: null, fehlt: false, konflikt: null,
    });
    if (vorbereitet === v) vorbereitet = null;
    return true;
  }
  const msg = await grund(res);
  if (fehltFunktion(res, msg)) {
    fehltGeprueft = Date.now();
    sicherungMetaSchreiben({ fehlt: true, fehler: msg });
    return false;
  }
  if (/\bveraltet\b/.test(msg)) {
    // Ein zweites Fenster derselben App hat dazwischen geschrieben und seinen
    // Stand in denselben Speicher gelegt – dann ist es kein fremdes Gerät.
    if (nochmal && (sicherungMetaLesen().stand || null) !== params.p_vorher) {
      return hochladen(v, { keepalive, nochmal: false });
    }
    const wer = await eigenesSchreiben(v.id);
    if (wer === 'eigen') {
      if (sicherungMetaLesen().hash === v.hash) {
        if (vorbereitet === v) vorbereitet = null;
        return true;
      }
      // Seitdem kam noch etwas dazu – das geht nach den zehn Sekunden hinterher.
      nachDerSperre();
      return false;
    }
    if (wer === 'unklar') {
      sicherungMetaSchreiben({ fehler: 'Keine Verbindung' });
      return false;
    }
    sicherungMetaSchreiben({ konflikt: { art: 'veraltet', am: jetztIso() }, fehler: null, offen: [] });
    return false;
  }
  if (/\bgeloescht\b/.test(msg)) {
    sicherungMetaSchreiben({ konflikt: { art: 'geloescht', am: jetztIso() }, fehler: null, offen: [] });
    return false;
  }
  if (/\bzu oft\b/.test(msg)) {
    // Kein Fehler, nur zu früh – etwa, weil ein zweites Fenster eben gesichert
    // hat. In zehn Sekunden noch einmal, nicht erst nach der Drossel.
    notieren('sicherung', { ok: false, grund: 'zu oft' });
    sicherungMetaSchreiben({ zuletzt: Date.now() });
    nachDerSperre();
    return false;
  }
  sicherungMetaSchreiben({ fehler: msg });
  return false;
}

/** Passt dieser Stand in eine keepalive-Anfrage? */
const klein = (v) => v.daten.length + 512 < SICHERUNG_KEEPALIVE;

async function lauf(auffrischen = false) {
  const v = await vorbereiten(auffrischen);
  if (!v) return;
  const rest = sperreRest();
  if (rest > 0) { nachDerSperre(rest); return; }
  // Ist die App schon weggelegt (der Zeitgeber nach der Sperre lief dann im
  // Hintergrund), trägt nur keepalive die Anfrage sicher zu Ende.
  await hochladen(v, { keepalive: !!document.hidden && klein(v) });
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
  clearTimeout(sperreUhr);
  vorbereitenUhr = null;
  hochladenUhr = null;
  sperreUhr = null;
  vorbereitet = null;
}

/* ------------------------------------------------------------------ *
 * Löschaufträge
 *
 * Gelöscht wird nicht „jetzt oder nie": Ohne Netz bliebe die Sicherung sonst
 * auf dem Server, während das Gerät Kennung und Schreibmarke schon vergessen
 * hat – kein Knopf käme mehr an sie heran, und lag der Schlüssel im
 * Passwortmanager, holte ein neues Gerät die „gelöschte" Sicherung vollständig
 * zurück. Der Auftrag bleibt deshalb liegen, bis der Server ihn bestätigt, und
 * wird beim Start und bei „online" nachgeholt.
 * ------------------------------------------------------------------ */

function auftraege() {
  const a = jsonLesen(SICHERUNG_LOESCHEN, []);
  return Array.isArray(a) ? a.filter((x) => x && x.id && x.w) : [];
}

function auftragDazu(id, w) {
  jsonSchreiben(SICHERUNG_LOESCHEN, [...auftraege().filter((x) => x.id !== id), { id, w, seit: jetztIso() }]);
}

function auftragWeg(id) {
  const rest = auftraege().filter((x) => x.id !== id);
  jsonSchreiben(SICHERUNG_LOESCHEN, rest.length ? rest : null);
}

/** Steht noch ein Löschauftrag aus? Für die Zeile unter Mehr. */
export const loeschenAusstehend = () => auftraege().length > 0;

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

/** Alle offenen Aufträge abarbeiten. true, wenn danach keiner mehr aussteht. */
async function auftraegeErledigen() {
  if (!hatServer()) return auftraege().length === 0;
  for (const a of auftraege()) {
    // 0 Zeilen zählt auch als erledigt: Dann lag dort nichts (mehr).
    const erg = await loeschenMit(a.id, a.w);
    notieren('sicherung', { was: 'loeschauftrag', ok: erg.ok, zeilen: erg.zeilen, msg: erg.ok ? undefined : erg.msg });
    if (erg.ok) auftragWeg(a.id);
  }
  return auftraege().length === 0;
}

/* ------------------------------------------------------------------ *
 * Was die App aufruft
 * ------------------------------------------------------------------ */

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
  window.addEventListener('online', () => {
    if (auftraege().length) einreihen(auftraegeErledigen).then(() => sicherungRuf.nachher());
    sicherungGeaendert();
  });
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

/**
 * Nach dem Abschluss einer Einheit: sofort, an der Drossel vorbei – nur nicht
 * an den zehn Sekunden des Servers, die wartet lauf() ab.
 */
export function sicherungJetzt() {
  if (!sicherungAn()) return Promise.resolve();
  anhalten();
  return einreihen(() => lauf());
}

/**
 * Beim Start: nur, wenn etwas dazukam – oder die letzte Sicherung alt wird.
 * Liegt noch ein Löschauftrag, geht er zuerst hinaus, auch bei abgeschalteter
 * Sicherung.
 */
export function sicherungStart() {
  const loeschen = hatServer() && auftraege().length > 0;
  if (!loeschen && !sicherungAn()) return;
  setTimeout(() => {
    if (loeschen) einreihen(auftraegeErledigen).then(() => sicherungRuf.nachher());
    if (!sicherungAn()) return;
    einreihen(() => {
      const m = sicherungMetaLesen();
      const alt = !!m.ok && Date.now() - Date.parse(m.ok) > SICHERUNG_AUFFRISCHEN;
      return lauf(alt);
    });
  }, SICHERUNG_START);
}

/**
 * Zurück in der App oder unter Mehr: Fehlten dem Server die Funktionen, nach
 * zehn Minuten noch einmal nachsehen. Sonst bliebe „Der Server kennt die
 * Sicherung noch nicht" stehen, bis die App neu startet – auch wenn der
 * SQL-Block längst gelaufen ist.
 */
export function sicherungNachsehen() {
  if (!sicherungAn() || !sicherungRuf.darf()) return;
  if (!sicherungMetaLesen().fehlt || Date.now() - fehltGeprueft < SICHERUNG_FEHLT_PAUSE) return;
  // Auffrischen: Auch ein unveränderter Stand fragt, ob es jetzt geht.
  einreihen(() => lauf(true));
}

/**
 * Beim Weglegen der App: was schon fertig verschlüsselt bereitliegt, mit
 * keepalive hinterher – im selben Takt, ohne await davor, sonst friert die
 * Seite ein, bevor die Anfrage losgeht. Über 64 KB geht das nicht zuverlässig,
 * dann bleibt es beim nächsten Start.
 *
 * Nicht, solange in der Warteschlange etwas läuft: Das ist dann entweder schon
 * der neueste Stand, oder ein zweites Schreiben daneben bekäme „veraltet". Und
 * nicht innerhalb der zehn Sekunden – das gäbe nur „zu oft"; den Rest trägt
 * der Zeitgeber aus nachDerSperre() nach.
 */
export function sicherungVerstecken() {
  if (!sicherungBereit() || belegt > 0) return;
  const v = vorbereitet;
  if (!v || v.hash === sicherungMetaLesen().hash || sperreRest() > 0) return;
  einreihen(() => hochladen(v, { keepalive: true }).then(() => sicherungRuf.nachher()));
}

/* ------------------------------------------------------------------ *
 * Zurückholen, Übernehmen, Rückweg
 * ------------------------------------------------------------------ */

/**
 * Eine Sicherung holen und entschlüsseln. { ok, text, stand } oder
 * { ok: false, msg, fehlt?, leer? }.
 *
 * Fürs Diagnoseprotokoll steht danach eine Zeile da, was dabei herauskam – nur
 * das Ergebnis: nie der Schlüssel, nie die Kennung, nie der Text.
 */
export async function sicherungHolen(key) {
  const erg = await sicherungHolenAusServer(key);
  notieren('sicherung', {
    was: 'holen', ok: erg.ok, fehlt: erg.fehlt, leer: erg.leer, msg: erg.ok ? undefined : erg.msg,
  });
  return erg;
}

async function sicherungHolenAusServer(key) {
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

/**
 * Nach dem Zurückholen: Unter welchem Schlüssel sichert dieses Gerät weiter?
 *
 *   'passwort'  aus dem eigenen Passwortmanager – also der eigene Schlüssel
 *               vom alten Gerät. Unter ihm geht es weiter, mit dem Stand des
 *               Servers als Vorgänger.
 *   'eigen'     „Den Stand von dort holen" nach einem Konflikt – derselbe
 *               Schlüssel wie bisher.
 *   'link'      aus einem Link oder dem Eingabefeld. Woher der kam, weiß
 *               niemand: Den Link kann jeder geschickt haben, und ein Hyperlink
 *               auf …/#sicherung=… genügt, keine Nachricht nötig. Dieser
 *               Schlüssel wird deshalb **nie** übernommen – sonst läse, wer
 *               den Link geschickt hat, ab da jedes Training mit, mit einem
 *               harmlosen Köder-Stand als Lockmittel. Dazu bleibt der Link mit
 *               Anker im Browserverlauf stehen (replaceState räumt nur die
 *               Adresszeile). Das Gerät sichert unter seinem eigenen Schlüssel
 *               weiter, und hat es noch keinen, entsteht beim nächsten Lauf ein
 *               frischer – samt der Zeile „Schlüssel sichern". Die Zeile unter
 *               dem Link-Schlüssel bleibt, wie sie ist: Sie gehört dem, der den
 *               Link hat.
 *
 * Was das Gerät bis eben wusste, wird beiseitegelegt – für „Stand von vor dem
 * Import zurückholen" (sicherungRueckweg()). Hatte es vorher unter einem
 * anderen eigenen Schlüssel gesichert und gilt jetzt der geholte, wird jene
 * Sicherung gelöscht – sonst läge sie bis zum Ablauf der 400 Tage auf dem
 * Server, und kein Knopf käme mehr an sie heran.
 */
export async function sicherungUebernehmen(key, { stand = null, weg = 'link' } = {}) {
  const alt = sicherungMetaLesen();
  anhalten();
  jsonSchreiben(SICHERUNG_ABLAGE, {
    am: jetztIso(), key: alt.key || null, id: alt.id || null, w: alt.w || null,
    herkunft: alt.herkunft || 'geraet', aussen: alt.aussen || {},
    stand: alt.stand || null, ok: alt.ok || null, offen: alt.offen || [],
  });
  if (weg !== 'passwort' && weg !== 'eigen') {
    // Der eigene Schlüssel bleibt (oder entsteht neu); der eingelesene Stand
    // geht beim nächsten Lauf unter ihm hinaus.
    sicherungMetaSchreiben({ hash: null, fehler: null });
    return;
  }
  const { id, w } = await sicherungAbleiten(key);
  const heute = jetztIso().slice(0, 10);
  sicherungMetaSchreiben({
    key, id, w, stand, hash: null, ok: isoAus(stand), zuletzt: 0, offen: [],
    fehler: null, fehlt: false, konflikt: null,
    herkunft: weg === 'passwort' ? 'geholt' : (alt.herkunft || 'geraet'),
    aussen: weg === 'passwort' ? { passwort: heute, geprueft: heute } : (alt.aussen || {}),
  });
  const hatteZeile = alt.ok || (alt.offen || []).length;
  if (alt.key && alt.key !== key && alt.id && alt.w && hatteZeile && hatServer()) {
    auftragDazu(alt.id, alt.w);
    await einreihen(auftraegeErledigen);
  }
}

/**
 * „Stand von vor dem Import zurückholen" – auch für die Sicherung.
 *
 * Bis v240 holte der Knopf nur den Stand auf dem Gerät zurück. Die Sicherung
 * blieb beim eben geholten Schlüssel, und die nächste Sicherung schrieb den
 * alten Stand darüber: Die Sicherung vom alten Handy, drei Einheiten, hatte
 * danach eine – ohne Rückfrage, und gerade dann, wenn das alte Handy weg ist,
 * war der Verlauf damit nirgends mehr.
 *
 * Jetzt kehrt auch die Sicherung zurück: zum Schlüssel von vorher, und die
 * geholte Zeile bleibt unberührt. Wurde die eigene Zeile beim Zurückholen
 * gelöscht, legt die nächste Sicherung sie neu an; steht ihr Löschauftrag noch
 * aus, wird er zurückgenommen. Gab es vorher keinen eigenen Schlüssel und kam
 * der jetzige aus dem Passwortmanager, entsteht ein frischer.
 */
export function sicherungRueckweg() {
  const abl = jsonLesen(SICHERUNG_ABLAGE, null);
  jsonSchreiben(SICHERUNG_ABLAGE, null);
  if (!abl) return;
  anhalten();
  const m = sicherungMetaLesen();
  if (abl.key && abl.key === m.key) {
    sicherungMetaSchreiben({ hash: null });
    return;
  }
  const leer = {
    hash: null, zuletzt: 0, offen: [], fehler: null, fehlt: false, konflikt: null,
  };
  if (abl.key && abl.id && abl.w) {
    const steht = auftraege().some((a) => a.id === abl.id);
    if (steht) auftragWeg(abl.id);
    sicherungMetaSchreiben({
      ...leer, key: abl.key, id: abl.id, w: abl.w, herkunft: abl.herkunft || 'geraet',
      aussen: abl.aussen || {}, stand: steht ? abl.stand : null, ok: steht ? abl.ok : null,
      offen: steht ? abl.offen || [] : [],
    });
    return;
  }
  if (m.herkunft === 'geholt') {
    const { key, id, w, ...rest } = m;
    void key; void id; void w;
    jsonSchreiben(SICHERUNG_SPEICHER, {
      ...rest, ...leer, herkunft: null, stand: null, ok: null, aussen: {},
    });
    return;
  }
  sicherungMetaSchreiben({ hash: null });
}

/** Eine Datei wurde eingelesen: Die Ablage gehört dann nicht mehr zum Stand von vorher. */
export const sicherungAblageVerwerfen = () => jsonSchreiben(SICHERUNG_ABLAGE, null);

/* ------------------------------------------------------------------ *
 * Löschen, Schalten
 * ------------------------------------------------------------------ */

/**
 * „Sicherung auf dem Server löschen": erst abschalten, dann löschen – hinter
 * einem Schreiben, das vielleicht gerade unterwegs ist. Sonst kam das Löschen
 * zuerst an, fand nichts („Da lag nichts"), und das Schreiben legte die Zeile
 * gleich danach wieder an.
 */
export function sicherungLoeschen() {
  // Abschalten zuerst – sonst schriebe die nächste Änderung sie gleich wieder hin.
  sicherungMetaSchreiben({ an: false });
  anhalten();
  return einreihen(async () => {
    const m = sicherungMetaLesen();
    if (!m.id || !m.w) return { ok: true, zeilen: 0, msg: '' };
    const erg = await loeschenMit(m.id, m.w);
    notieren('sicherung', { was: 'loeschen', ok: erg.ok, zeilen: erg.zeilen, msg: erg.ok ? undefined : erg.msg });
    if (erg.ok) {
      sicherungMetaSchreiben({
        stand: null, hash: null, ok: null, zuletzt: 0, offen: [], konflikt: null, fehler: null,
      });
    }
    return erg;
  }).then((erg) => erg || { ok: false, zeilen: 0, msg: '' });
}

/**
 * Für „Alle Daten löschen": die Sicherung auf dem Server und alles hier.
 *
 * Der Löschauftrag wird zuerst festgehalten, dann der Schlüssel vergessen.
 * Gibt zurück, ob der Server das Löschen bestätigt hat; wenn nicht, holen
 * sicherungStart() und das „online"-Ereignis es nach.
 */
export function sicherungVergessen() {
  const m = sicherungMetaLesen();
  anhalten();
  if (m.id && m.w) auftragDazu(m.id, m.w);
  jsonSchreiben(SICHERUNG_SPEICHER, null);
  jsonSchreiben(SICHERUNG_ABLAGE, null);
  return einreihen(auftraegeErledigen).then((fertig) => fertig === true);
}

/** Schalter unter Mehr und im Einstieg. */
export function sicherungSchalten(an) {
  sicherungMetaSchreiben({ an });
  notieren('schalter', { feld: 'sicherung', nach: !!an });
  if (!an) { anhalten(); return; }
  fehltGeprueft = 0;
  sicherungGeaendert();
}

/**
 * „Diesen Stand sichern" nach einem Konflikt, „Wieder sichern" nach einem
 * Löschen anderswo: den heutigen Stand des Servers als Vorgänger nehmen und
 * schreiben. Gefragt wurde vorher.
 */
export function sicherungTrotzdem() {
  return einreihen(async () => {
    const m = sicherungMetaLesen();
    if (!m.id) return { ok: false, msg: 'Noch kein Schlüssel' };
    const erg = await zeileLesen(m.id);
    if (!erg.ok) {
      return { ok: false, msg: /Verbindung/.test(erg.msg) ? 'Keine Verbindung – mit Netz noch einmal versuchen.' : erg.msg };
    }
    sicherungMetaSchreiben({
      stand: erg.zeile ? erg.zeile.stand || null : null,
      konflikt: null, hash: null, offen: [], fehler: null, an: true,
    });
    anhalten();
    await lauf(true);
    const nach = sicherungMetaLesen();
    // Kam der andere Stand eben erst, gilt die Zehn-Sekunden-Regel des
    // Servers auch hier – dann geht es gleich danach von selbst hinaus.
    return { ok: !nach.konflikt && !nach.fehler, gleich: !!sperreUhr, msg: nach.fehler || '' };
  }).then((erg) => erg || { ok: false, msg: '' });
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
