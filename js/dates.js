const WEEKDAYS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli',
  'August', 'September', 'Oktober', 'November', 'Dezember'];

const pad = (n) => String(n).padStart(2, '0');

export function toISO(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function todayISO() {
  return toISO(new Date());
}

export function parseISO(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(iso, days) {
  if (!days) return iso;
  const d = parseISO(iso);
  d.setDate(d.getDate() + days);
  return toISO(d);
}

/** Ganze Tage von isoA bis isoB; positiv, wenn isoB später liegt. */
export function daysBetween(isoA, isoB) {
  return Math.round((parseISO(isoB) - parseISO(isoA)) / 86400000);
}

export function fmtDate(iso, long) {
  const d = parseISO(iso);
  const wd = WEEKDAYS[d.getDay()];
  if (long) return `${wd}, ${d.getDate()}. ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  return `${wd}, ${pad(d.getDate())}.${pad(d.getMonth() + 1)}.`;
}

export function plural(n, one, many) {
  return `${n} ${n === 1 ? one : many}`;
}

/** Kürzel der Wochentage, montags zuerst – so steht ein Kalender hierzulande. */
export const WEEK_HEAD = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

export function fmtMonth(iso) {
  const d = parseISO(iso);
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** Erster Tag des Monats, in dem `iso` liegt. */
export function monthStart(iso) {
  return `${iso.slice(0, 7)}-01`;
}

/** `n` Monate weiter, immer auf den Ersten. Über Jahresgrenzen hinweg. */
export function addMonths(iso, n) {
  const d = parseISO(monthStart(iso));
  d.setMonth(d.getMonth() + n);
  return toISO(d);
}

/**
 * Alle Tage, die ein Monatsraster zeigt: ganze Wochen von Montag bis Sonntag,
 * vorn und hinten mit den Nachbarmonaten aufgefüllt.
 */
export function monthGrid(iso) {
  const first = parseISO(monthStart(iso));
  const lead = (first.getDay() + 6) % 7;          // Mo = 0
  // Monatslänge über den Abstand zum nächsten Ersten. Math.round, weil eine
  // Zeitumstellung im Monat sonst eine Stunde fehlen ließe.
  const len = Math.round((parseISO(addMonths(iso, 1)) - first) / 86400000);
  const cells = Math.ceil((lead + len) / 7) * 7;
  const out = [];
  for (let i = 0; i < cells; i++) {
    const d = new Date(first);
    d.setDate(d.getDate() - lead + i);
    out.push(toISO(d));
  }
  return out;
}
