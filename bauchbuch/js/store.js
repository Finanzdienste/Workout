/*
 * Der Speicher. Alles, was eingetragen wird, liegt hier – und nur hier.
 *
 * Es gibt keinen Server, kein Konto und keine Anmeldung. Der gesamte Zustand
 * steht im localStorage dieses einen Browsers auf diesem einen Gerät. Das ist
 * keine Sparmaßnahme, sondern die Bauart: Ein Tagebuch über den eigenen Körper
 * soll nirgendwohin gehen, wo es jemand anders lesen könnte, und was nie
 * verschickt wird, kann auch nicht abhandenkommen.
 *
 * Die Kehrseite steht ehrlich in der App: Ein gelöschter Browser-Speicher
 * nimmt alles mit. Dagegen hilft nur die Sicherung unter „Mehr" – deshalb
 * erinnert die App daran, und deshalb ist der Export eine gewöhnliche
 * JSON-Datei, die man auch ohne diese App noch lesen kann.
 */
import { heuteISO, jetztUhr, minutenAmTag, zeitpunkt } from './datum.js';

const KEY = 'bauchbuch.state.v1';

const VORGABE = {
  // Alle Eintragungen in einer Liste, nach Zeitpunkt sortiert gehalten.
  // Ein Eintrag ist immer { id, am, um, art } plus die Felder seiner Art:
  //   essen       { was, tags: [ausloeserId], portion: 'klein'|'normal'|'gross' }
  //   beschwerde  { staerke: 0..10, arten: [beschwerdeId], notiz }
  //   medikament  { mittel, dosis }
  //   notiz       { text }
  eintraege: [],
  // Was für einen ganzen Tag gilt, nicht für einen Zeitpunkt:
  // { 'YYYY-MM-DD': { stress: 0..4, schlaf: 0..4, notiz } }
  tage: {},
  // In wie vielen Stunden nach einer Mahlzeit eine Beschwerde ihr noch
  // zugerechnet wird. Vier Stunden sind der Vorschlag, nicht das Gesetz –
  // wer weiß, dass es bei ihm später kommt, stellt es unter Mehr um.
  fenster: 4,
  // Ab wie vielen Mahlzeiten mit einem Auslöser die Auswertung überhaupt
  // etwas dazu sagt. Darunter ist jede Aussage Zufall, und eine App, die aus
  // zwei Fällen eine Regel macht, schadet mehr als sie nützt.
  mindestFaelle: 5,
  eigeneAusloeser: [],   // [{ id: 'x:...', name }]
  zuletztMittel: [],     // zuletzt eingetragene Medikamente, als Vorschlag
  theme: 'rosa',
  begruesst: false,
  tab: 'heute',
  lastBackup: null,      // { on, anzahl } – wann zuletzt gesichert wurde
};

const klon = (o) => JSON.parse(JSON.stringify(o));

let zustand = laden();
const hoerer = new Set();

function laden() {
  try {
    const roh = localStorage.getItem(KEY);
    if (!roh) return klon(VORGABE);
    const gelesen = JSON.parse(roh);
    const s = Object.assign(klon(VORGABE), gelesen);
    // Wer schon etwas eingetragen hat, hat die Begrüßung hinter sich – auch
    // wenn der Stand aus einer Fassung stammt, die den Schlüssel noch nicht
    // kannte. Sonst stünde die Einführung eines Tages wieder vor dem Tagebuch.
    if (!('begruesst' in gelesen) && s.eintraege.length) s.begruesst = true;
    s.eintraege = sortiert(Array.isArray(s.eintraege) ? s.eintraege : []);
    return s;
  } catch {
    return klon(VORGABE);
  }
}

/** Nach Tag und Uhrzeit. Die Liste wird nirgends anders sortiert. */
function sortiert(liste) {
  return [...liste].sort((a, b) => (a.am === b.am
    ? minutenAmTag(a.um) - minutenAmTag(b.um)
    : (a.am < b.am ? -1 : 1)));
}

/* ---------- Schreiben ---------- */

let schreibUhr = null;

/**
 * Warum nicht gespeichert werden kann – und das sind zwei verschiedene Lagen.
 *
 *   'gesperrt'  Der Browser lässt gar nicht erst speichern: privates Fenster,
 *               eingebettete Ansicht, blockierte Website-Daten. Nichts bleibt,
 *               aber es war auch nie etwas da.
 *
 *   'voll'      Es ging bisher, und jetzt nicht mehr. Das ist die gefährliche
 *               Lage: Monate an Eintragungen liegen gespeichert, der heutige
 *               Eintrag kommt nicht mehr dazu. Hier gehört der Rat zur
 *               Sicherung hin, sofort und deutlich.
 */
function warumNicht(fehler) {
  // Chrome/Safari melden QuotaExceededError, Firefox NS_ERROR_DOM_QUOTA_REACHED,
  // ältere Fassungen nur den Code 22. Alles andere ist eine Sperre.
  const name = fehler && (fehler.name || '');
  const code = fehler && fehler.code;
  return (name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED'
    || code === 22 || code === 1014) ? 'voll' : 'gesperrt';
}

let speicherGeht = true;
let speicherFehler = null;

try {
  localStorage.setItem(`${KEY}.probe`, '1');
  localStorage.removeItem(`${KEY}.probe`);
} catch {
  // Beim Start ist auch ein voller Speicher eine Sperre: Es gibt noch nichts
  // zu retten, und der Rat wäre derselbe wie bei jeder anderen Ursache.
  speicherGeht = false;
  speicherFehler = 'gesperrt';
}

/** false, wenn der Browser nichts speichern kann – Eintragungen sind flüchtig. */
export function kannSpeichern() { return speicherGeht; }

/** 'gesperrt', 'voll' oder null – siehe warumNicht(). */
export function speicherGrund() { return speicherGeht ? null : speicherFehler; }

function schreibe() {
  schreibUhr = null;
  const vorher = speicherGeht;
  try {
    localStorage.setItem(KEY, JSON.stringify(zustand));
    speicherGeht = true;
    speicherFehler = null;
  } catch (e) {
    speicherGeht = false;
    speicherFehler = warumNicht(e);
  }
  // Beim Wechsel melden, in *beide* Richtungen: Der Schreibvorgang läuft nach
  // dem Zeichnen, die Warnung stünde sonst einen Eintrag zu spät da – und
  // bliebe nach dem Aufräumen kleben, bis zufällig etwas anderes neu zeichnet.
  if (speicherGeht !== vorher) melde();
}

function merke() {
  clearTimeout(schreibUhr);
  schreibUhr = setTimeout(schreibe, 120);
}

/**
 * Ausstehenden Schreibvorgang sofort ausführen. Nötig, bevor die App in den
 * Hintergrund geht: mobile Browser verwerfen die Seite dort ohne Vorwarnung,
 * und der letzte Eintrag wäre verloren.
 */
export function sofortSchreiben() {
  if (schreibUhr === null) return;
  clearTimeout(schreibUhr);
  schreibe();
}

function melde() {
  hoerer.forEach((fn) => fn(zustand));
}

export function horche(fn) {
  hoerer.add(fn);
  return () => hoerer.delete(fn);
}

export function zustandLesen() { return zustand; }

/* ---------- Eintragungen ---------- */

/**
 * Eine Kennung, die auch dann eindeutig bleibt, wenn zwei Einträge in
 * derselben Millisekunde entstehen – beim Einlesen einer Sicherung etwa, oder
 * wenn jemand schnell hintereinander tippt.
 */
let zaehler = 0;
function neueId() {
  zaehler += 1;
  return `e${Date.now().toString(36)}${zaehler.toString(36)}`;
}

/**
 * Einen Eintrag anlegen. Datum und Uhrzeit sind optional und stehen sonst auf
 * jetzt – der Normalfall ist „ich trage gerade ein, was gerade war".
 */
export function eintragen(eintrag) {
  const neu = {
    id: neueId(),
    am: eintrag.am || heuteISO(),
    um: eintrag.um || jetztUhr(),
    ...eintrag,
  };
  zustand.eintraege = sortiert([...zustand.eintraege, neu]);
  merke();
  melde();
  return neu.id;
}

export function eintragAendern(id, patch) {
  const i = zustand.eintraege.findIndex((e) => e.id === id);
  if (i < 0) return;
  zustand.eintraege[i] = { ...zustand.eintraege[i], ...patch, id };
  zustand.eintraege = sortiert(zustand.eintraege);
  merke();
  melde();
}

export function eintragLoeschen(id) {
  const vorher = zustand.eintraege.length;
  zustand.eintraege = zustand.eintraege.filter((e) => e.id !== id);
  if (zustand.eintraege.length === vorher) return;
  merke();
  melde();
}

export function eintragVon(id) {
  return zustand.eintraege.find((e) => e.id === id) || null;
}

/** Alle Eintragungen eines Tages, in zeitlicher Reihenfolge. */
export function eintraegeAm(iso) {
  return zustand.eintraege.filter((e) => e.am === iso);
}

/** Der Tag der jüngsten Eintragung – oder heute, wenn es keine gibt. */
export function letzterTag() {
  const e = zustand.eintraege;
  return e.length ? e[e.length - 1].am : heuteISO();
}

/**
 * Wann zuletzt etwas eingetragen wurde, als Zeitpunkt. Die Tagesansicht
 * braucht das, um „seit 6 Stunden nichts" sagen zu können.
 */
export function letzterZeitpunkt() {
  const e = zustand.eintraege;
  return e.length ? zeitpunkt(e[e.length - 1].am, e[e.length - 1].um) : null;
}

/* ---------- Tagesangaben ---------- */

export function tagLesen(iso) {
  return zustand.tage[iso] || { stress: null, schlaf: null, notiz: '' };
}

export function tagSetzen(iso, patch) {
  const vorher = tagLesen(iso);
  const neu = { ...vorher, ...patch };
  // Einen leeren Tag gar nicht erst anlegen: Sonst wächst `tage` mit jedem
  // angetippten und wieder abgewählten Regler, und die Sicherung füllt sich
  // mit Zeilen, die nichts aussagen.
  if (neu.stress === null && neu.schlaf === null && !String(neu.notiz || '').trim()) {
    delete zustand.tage[iso];
  } else {
    zustand.tage[iso] = neu;
  }
  merke();
  melde();
}

/* ---------- Einstellungen ---------- */

export function einstellen(schluessel, wert) {
  if (!(schluessel in VORGABE)) return;
  zustand[schluessel] = wert;
  merke();
  melde();
}

/** Ein eigener Auslöser. Doppelte Namen führen auf denselben Eintrag zurück. */
export function ausloeserAnlegen(id, name) {
  if (zustand.eigeneAusloeser.some((a) => a.id === id)) return;
  zustand.eigeneAusloeser = [...zustand.eigeneAusloeser, { id, name }];
  merke();
  melde();
}

/**
 * Einen eigenen Auslöser wieder loswerden.
 *
 * Er verschwindet aus der Auswahl, aber nicht aus den Eintragungen, in denen
 * er steht. Das ist Absicht: Ein Tagebuch rückwirkend zu verändern, weil eine
 * Auswahlliste sich geändert hat, wäre das Gegenteil von dem, wofür man es
 * führt.
 */
export function ausloeserLoeschen(id) {
  zustand.eigeneAusloeser = zustand.eigeneAusloeser.filter((a) => a.id !== id);
  merke();
  melde();
}

/** Ein benutztes Mittel als Vorschlag merken – die fünf jüngsten. */
export function mittelMerken(name) {
  const sauber = String(name).trim();
  if (!sauber) return;
  zustand.zuletztMittel = [sauber, ...zustand.zuletztMittel.filter((m) => m !== sauber)].slice(0, 5);
  merke();
}

/* ---------- Sicherung ---------- */

export function alsJSON() {
  return JSON.stringify(zustand, null, 2);
}

export function sicherungNotiert() {
  zustand.lastBackup = { on: heuteISO(), anzahl: zustand.eintraege.length };
  merke();
  melde();
}

/**
 * Sicherung einlesen.
 *
 * Geprüft wird nicht aus Misstrauen, sondern weil eine halb passende Datei
 * sonst still einen Zustand hinterlässt, in dem die App merkwürdig wird –
 * `eintraege` als Zeichenkette etwa. Alles Unbekannte fällt weg, alles
 * Bekannte wird auf seinen Typ gebracht, und jeder einzelne Eintrag muss
 * mindestens Datum und Art haben, sonst fliegt er raus.
 */
export function ausJSON(text) {
  const gelesen = JSON.parse(text);
  if (!gelesen || typeof gelesen !== 'object' || Array.isArray(gelesen)
      || !Array.isArray(gelesen.eintraege)) {
    throw new Error('Unerwartetes Format – die Liste "eintraege" fehlt.');
  }
  const frisch = klon(VORGABE);
  Object.keys(VORGABE).forEach((k) => {
    const v = gelesen[k];
    if (v === undefined || v === null) return;
    const soll = VORGABE[k];
    if (Array.isArray(soll) !== Array.isArray(v)) return;
    if (soll !== null && typeof soll !== typeof v) return;
    frisch[k] = v;
  });
  frisch.eintraege = sortiert(gelesen.eintraege.filter((e) => (
    e && typeof e === 'object' && typeof e.am === 'string' && typeof e.art === 'string'
  )).map((e) => ({ ...e, id: e.id || neueId() })));
  if (!Number.isFinite(frisch.fenster) || frisch.fenster <= 0) frisch.fenster = VORGABE.fenster;
  zustand = frisch;
  merke();
  melde();
  return frisch.eintraege.length;
}

export function allesLoeschen() {
  zustand = klon(VORGABE);
  // Die Begrüßung nicht noch einmal: Wer gerade bewusst alles gelöscht hat,
  // weiß, was die App ist.
  zustand.begruesst = true;
  try { localStorage.removeItem(KEY); } catch { /* dann eben nicht */ }
  merke();
  melde();
}
