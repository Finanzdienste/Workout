/*
 * Text für HTML entschärfen.
 *
 * Alles, was die Nutzerin eintippt (Präparat, Notizen, Arztname), landet über
 * innerHTML in der Seite. Ohne diese Funktion wäre ein „<" in einer Notiz
 * schon ein kaputtes Layout – und ein Stück Skript in einer Sicherungsdatei
 * ein Einfallstor.
 */
export function esc(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Für Attribute wie value="…" – dasselbe, nur ausdrücklich benannt. */
export const attr = esc;

/** „1 Tag" / „3 Tage" – mit der Zahl davor. */
export function mehrzahl(n, eins, viele) {
  return `${n} ${n === 1 ? eins : viele}`;
}
