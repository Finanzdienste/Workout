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
