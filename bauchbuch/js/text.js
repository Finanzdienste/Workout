/*
 * Text und Zahlen fürs Auge. Hängt von nichts ab und darf deshalb überall
 * benutzt werden.
 */

export function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

/** Zahl in deutscher Schreibweise, ohne unnötige Null hinter dem Komma. */
export function fmtZahl(n, stellen = 1) {
  if (!Number.isFinite(n)) return '–';
  return Number.isInteger(n) ? String(n) : String(+n.toFixed(stellen)).replace('.', ',');
}

export function mehrzahl(n, eins, viele) {
  return `${n} ${n === 1 ? eins : viele}`;
}

/**
 * Lange Eingaben kürzen, ohne mitten im Wort abzubrechen.
 *
 * Gebraucht in der Tagesliste: „Was gegessen?" ist ein freies Feld, und
 * jemand, der ein ganzes Menü hineinschreibt, soll die Liste nicht sprengen.
 */
export function kuerze(s, max = 60) {
  const t = String(s).trim();
  if (t.length <= max) return t;
  const schnitt = t.slice(0, max);
  const luecke = schnitt.lastIndexOf(' ');
  return `${(luecke > max * 0.6 ? schnitt.slice(0, luecke) : schnitt).trimEnd()} …`;
}
