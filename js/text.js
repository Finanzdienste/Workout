/*
 * Text und Zahlen fürs Auge.
 *
 * Zwei Funktionen, die überall gebraucht werden und von nichts abhängen –
 * deshalb stehen sie ganz unten im Stapel: Jedes andere Modul darf sie
 * benutzen, sie selbst dürfen nichts.
 */

export function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

/** Zahl in deutscher Schreibweise, ohne unnötige Null hinter dem Komma.
 *
 * Zwei Nachkommastellen, nicht eine: seit die Gewichtsschritte je Übung gehen,
 * gibt es 1,25-kg-Sprünge, und 21,25 kg als "21,3" anzuzeigen wäre schlicht
 * falsch – die Zahl steht am Knopf, nach dem man greift.
 */
export function fmtNum(n) {
  return Number.isInteger(n) ? String(n) : String(+n.toFixed(2)).replace('.', ',');
}
