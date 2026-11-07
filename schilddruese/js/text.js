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

/*
 * Auf höchstens `n` Zeichen kürzen – nach ganzen Zeichen (Code-Points), nicht
 * nach UTF-16-Hälften. `.slice()` schnitt ein Emoji an der Grenze durch;
 * übrig blieb eine einzelne Hälfte, die in der Kalenderdatei als „�" ankam
 * (Runde 5: F23, F25). Zählt so wie zeichenZahl() unten.
 */
export function kuerzen(text, n) {
  const s = String(text ?? '');
  // Schneller Weg: Wer höchstens n UTF-16-Einheiten hat, hat auch höchstens n Zeichen.
  if (s.length <= n) return s;
  return Array.from(s).slice(0, n).join('');
}

/** Die Zahl der Zeichen (Code-Points) – ein Emoji zählt als eins, wie beim Kürzen. */
export function zeichenZahl(text) {
  return Array.from(String(text ?? '')).length;
}

/*
 * Steuerzeichen und halbe Emojis entfernen – für alles, was aus einer
 * Sicherungsdatei, einem Einfügen oder einem Diktat kommt (Runde 5: F25, F27).
 * Ein senkrechter Tab (weicher Umbruch aus Word) oder Seitenvorschub wird zur
 * Zeile, die übrigen Steuerzeichen zu einem Leerzeichen, „\r\n" zu „\n".
 * Tab und Zeilenumbruch bleiben: Sie gehören zu einer mehrzeiligen Notiz.
 * Eine einzelne Hälfte eines Emojis (übrig nach einem Kürzen nach
 * UTF-16-Einheiten) fällt weg – sie ist kein Zeichen.
 */
export function saeubern(text) {
  const s = String(text ?? '').replace(/\r\n?/g, '\n');
  let aus = '';
  // Zeichen für Zeichen statt mit einem regulären Ausdruck: Steuerzeichen in
  // einem Ausdruck lässt der Linter (no-control-regex) zu Recht nicht durch.
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c >= 0xd800 && c <= 0xdbff) {
      const n = s.charCodeAt(i + 1);
      if (n >= 0xdc00 && n <= 0xdfff) { aus += s[i] + s[i + 1]; i++; }
    } else if (c >= 0xdc00 && c <= 0xdfff) {
      // zweite Hälfte ohne erste – fällt weg
    } else if (c === 0x0b || c === 0x0c) {
      aus += '\n';
    } else if ((c < 0x20 && c !== 0x09 && c !== 0x0a) || c === 0x7f) {
      aus += ' ';
    } else {
      aus += s[i];
    }
  }
  return aus;
}

/** Eine Zeile: gesäubert, jeder Leerraum (auch Umbrüche) als ein Leerzeichen, außen ohne. */
export function einzeilig(text) {
  return saeubern(text).replace(/\s+/g, ' ').trim();
}
