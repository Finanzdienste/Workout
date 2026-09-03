/*
 * Datum und Uhrzeit – die unterste Schicht. Hängt von nichts ab.
 *
 * Ein Tagebuch rechnet dauernd mit Zeit, und zwar mit *örtlicher* Zeit: Wer um
 * halb elf abends isst und um eins nachts Beschwerden bekommt, hat einen
 * Zusammenhang erlebt, den keine Tagesgrenze zerschneiden darf. Deshalb steht
 * hier neben dem Datum auch der Zeitpunkt – Datum plus Uhrzeit, zusammen
 * gerechnet.
 *
 * Alles in Ortszeit, nichts in UTC. Die Alternative wäre ein Eintrag, der nach
 * einer Reise oder der Zeitumstellung auf einem anderen Tag steht als dem, an
 * dem er gemacht wurde.
 */

const WOCHENTAGE = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const MONATE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli',
  'August', 'September', 'Oktober', 'November', 'Dezember'];

/** Kürzel der Wochentage, montags zuerst – so steht ein Kalender hierzulande. */
export const WOCHE_KOPF = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

export const pad2 = (n) => String(n).padStart(2, '0');

export function zuISO(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function heuteISO() {
  return zuISO(new Date());
}

/** Aktuelle Uhrzeit als "HH:MM". */
export function jetztUhr() {
  const d = new Date();
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

export function ausISO(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function plusTage(iso, tage) {
  if (!tage) return iso;
  const d = ausISO(iso);
  d.setDate(d.getDate() + tage);
  return zuISO(d);
}

/** Ganze Tage von isoA bis isoB; positiv, wenn isoB später liegt. */
export function tageDazwischen(isoA, isoB) {
  return Math.round((ausISO(isoB) - ausISO(isoA)) / 86400000);
}

/**
 * Ein Zeitpunkt aus Datum und Uhrzeit, als Millisekunden.
 *
 * Fehlt die Uhrzeit oder ist sie unbrauchbar, gilt Mittag statt Mitternacht:
 * Ein Eintrag ohne Uhrzeit soll innerhalb seines Tages liegen und nicht am
 * Rand, wo er beim Rechnen mit Zeitfenstern in den Vortag rutscht.
 */
export function zeitpunkt(iso, uhr) {
  const d = ausISO(iso);
  const m = /^(\d{1,2}):(\d{2})$/.exec(uhr || '');
  if (m) d.setHours(Number(m[1]), Number(m[2]), 0, 0);
  else d.setHours(12, 0, 0, 0);
  return d.getTime();
}

/** Stunden von a nach b; positiv, wenn b später liegt. */
export function stundenDazwischen(a, b) {
  return (b - a) / 3600000;
}

/** Minuten seit Mitternacht – zum Sortieren innerhalb eines Tages. */
export function minutenAmTag(uhr) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(uhr || '');
  return m ? Number(m[1]) * 60 + Number(m[2]) : 12 * 60;
}

export function fmtDatum(iso, lang) {
  const d = ausISO(iso);
  const wd = WOCHENTAGE[d.getDay()];
  if (lang) return `${wd}, ${d.getDate()}. ${MONATE[d.getMonth()]} ${d.getFullYear()}`;
  return `${wd}, ${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.`;
}

export function fmtMonat(iso) {
  const d = ausISO(iso);
  return `${MONATE[d.getMonth()]} ${d.getFullYear()}`;
}

/** "heute", "gestern" oder das Datum – für Überschriften. */
export function fmtTag(iso) {
  const abstand = tageDazwischen(iso, heuteISO());
  if (abstand === 0) return 'heute';
  if (abstand === 1) return 'gestern';
  if (abstand === -1) return 'morgen';
  return fmtDatum(iso, true);
}

/** Erster Tag des Monats, in dem `iso` liegt. */
export function monatsStart(iso) {
  return `${iso.slice(0, 7)}-01`;
}

/** `n` Monate weiter, immer auf den Ersten. Über Jahresgrenzen hinweg. */
export function plusMonate(iso, n) {
  const d = ausISO(monatsStart(iso));
  d.setMonth(d.getMonth() + n);
  return zuISO(d);
}

/**
 * Alle Tage, die ein Monatsraster zeigt: ganze Wochen von Montag bis Sonntag,
 * vorn und hinten mit den Nachbarmonaten aufgefüllt.
 */
export function monatsRaster(iso) {
  const erster = ausISO(monatsStart(iso));
  const vorlauf = (erster.getDay() + 6) % 7;          // Mo = 0
  // Monatslänge über den Abstand zum nächsten Ersten. Math.round, weil eine
  // Zeitumstellung im Monat sonst eine Stunde fehlen ließe.
  const laenge = Math.round((ausISO(plusMonate(iso, 1)) - erster) / 86400000);
  const felder = Math.ceil((vorlauf + laenge) / 7) * 7;
  const raus = [];
  for (let i = 0; i < felder; i++) {
    const d = new Date(erster);
    d.setDate(d.getDate() - vorlauf + i);
    raus.push(zuISO(d));
  }
  return raus;
}

/**
 * Grobe Tageszeit einer Uhrzeit. Für die Frage, wann die Beschwerden kommen –
 * nachts ist eine andere Auskunft als nach dem Mittagessen.
 */
export function tageszeit(uhr) {
  const m = minutenAmTag(uhr);
  if (m < 5 * 60) return 'nacht';
  if (m < 11 * 60) return 'morgen';
  if (m < 15 * 60) return 'mittag';
  if (m < 19 * 60) return 'nachmittag';
  return 'abend';
}

export const TAGESZEIT_NAME = {
  nacht: 'nachts',
  morgen: 'morgens',
  mittag: 'mittags',
  nachmittag: 'nachmittags',
  abend: 'abends',
};
