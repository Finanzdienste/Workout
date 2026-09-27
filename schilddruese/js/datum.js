/*
 * Datum und Zahlen, so wie sie hierzulande gelesen werden.
 *
 * Alles, was die App an Datum speichert, ist ein ISO-Tag („2026-09-26") –
 * sortierbar, vergleichbar, ohne Zeitzone. Angezeigt wird in Worten, weil
 * „Samstag, 26. September" für die Nutzerin lesbarer ist als „26.09.2026".
 */

const WOCHENTAGE = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
const MONATE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli',
  'August', 'September', 'Oktober', 'November', 'Dezember'];

export const zweistellig = (n) => String(n).padStart(2, '0');

export function zuISO(d) {
  return `${d.getFullYear()}-${zweistellig(d.getMonth() + 1)}-${zweistellig(d.getDate())}`;
}

export function heuteISO() {
  return zuISO(new Date());
}

/** „07:12" – die Uhrzeit von jetzt, für die Einnahme. */
export function jetztUhr() {
  const d = new Date();
  return `${zweistellig(d.getHours())}:${zweistellig(d.getMinutes())}`;
}

export function ausISO(iso) {
  const [j, m, t] = iso.split('-').map(Number);
  return new Date(j, m - 1, t);
}

/** Ist das ein gültiger ISO-Tag? Ein Datumsfeld kann auch leer oder Unsinn sein. */
export function istISO(iso) {
  if (typeof iso !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const d = ausISO(iso);
  return zuISO(d) === iso;
}

export function tageWeiter(iso, tage) {
  if (!tage) return iso;
  const d = ausISO(iso);
  d.setDate(d.getDate() + tage);
  return zuISO(d);
}

/** Ganze Tage von a bis b; positiv, wenn b später liegt. */
export function tageZwischen(a, b) {
  return Math.round((ausISO(b) - ausISO(a)) / 86400000);
}

/** „Samstag, 26. September 2026" bzw. ohne Jahr, wenn es das laufende ist. */
export function datumInWorten(iso, { jahr = 'auto', wochentag = true } = {}) {
  const d = ausISO(iso);
  const mitJahr = jahr === true || (jahr === 'auto' && d.getFullYear() !== new Date().getFullYear());
  const text = `${d.getDate()}. ${MONATE[d.getMonth()]}${mitJahr ? ` ${d.getFullYear()}` : ''}`;
  return wochentag ? `${WOCHENTAGE[d.getDay()]}, ${text}` : text;
}

/** „26.09.2026" – kurz, für Tabellen und den Arztbericht. */
export function datumKurz(iso) {
  const d = ausISO(iso);
  return `${zweistellig(d.getDate())}.${zweistellig(d.getMonth() + 1)}.${d.getFullYear()}`;
}

/**
 * „heute", „gestern", „vor 3 Tagen", „in 5 Tagen" – relativ zu `heute`.
 * Weiter weg als zwei Wochen steht das Datum selbst; „vor 23 Tagen" rechnet
 * niemand mehr um.
 */
export function relativ(iso, heute = heuteISO()) {
  const n = tageZwischen(heute, iso);
  if (n === 0) return 'heute';
  if (n === 1) return 'morgen';
  if (n === -1) return 'gestern';
  if (n > 1 && n <= 14) return `in ${n} Tagen`;
  if (n < -1 && n >= -14) return `vor ${-n} Tagen`;
  return `am ${datumInWorten(iso, { wochentag: false })}`;
}

/**
 * Zahl aus einem Eingabefeld: „2,1" und „2.1" sind dieselbe Zahl, Leerzeichen
 * stören nicht. null, wenn nichts Lesbares drinsteht – nie NaN, weil NaN in
 * einer Verlaufskurve ein Loch ohne Erklärung wäre.
 */
export function zahlAus(text) {
  if (typeof text === 'number') return Number.isFinite(text) ? text : null;
  const t = String(text ?? '').trim().replace(/\s/g, '').replace(',', '.');
  if (!t || !/^-?\d*\.?\d+$/.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** Zahl in deutscher Schreibweise: 2.1 → „2,1"; höchstens `stellen` Nachkommastellen. */
export function zahlText(n, stellen = 2) {
  if (n === null || n === undefined || !Number.isFinite(n)) return '–';
  const gerundet = Math.round(n * 10 ** stellen) / 10 ** stellen;
  return String(gerundet).replace('.', ',');
}

/** „7:12 Uhr" aus „07:12". */
export function uhrText(hhmm) {
  if (!hhmm || !/^\d{2}:\d{2}$/.test(hhmm)) return '';
  const [h, m] = hhmm.split(':');
  return `${Number(h)}:${m} Uhr`;
}

export function istUhr(hhmm) {
  if (typeof hhmm !== 'string' || !/^\d{2}:\d{2}$/.test(hhmm)) return false;
  const [h, m] = hhmm.split(':').map(Number);
  return h >= 0 && h < 24 && m >= 0 && m < 60;
}
