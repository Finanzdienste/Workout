/* ------------------------------------------------------------------ *
 * Kleinkram, den jede Ansicht braucht
 *
 * Symbole, Beschriftungen und die eine Zeile Rechnung, die dahintersteckt.
 * Für sich genommen ist hier nichts erwähnenswert – gerade deshalb steht es
 * hier: Sonst liegt es in js/app.js, und jede Ansicht, die herausgelöst wird,
 * müsste es mitnehmen oder nachbauen.
 *
 * Die Regel für diese Datei ist eng: Nur, was **mehr als eine** Ansicht
 * benutzt. Was zu einer gehört, gehört in deren Modul – sonst wird das hier
 * der Abstellraum, in dem am Ende alles liegt, was nirgends passte.
 * ------------------------------------------------------------------ */
import * as store from './store.js';

/** Hanteln oder Bodyweight – als Symbol und als Wort. */
export const MODE_ICON = { db: '🏋️', bw: '🤸' };
export const MODE_LABEL = { db: 'Hanteln', bw: 'Bodyweight' };

/**
 * Der Wiederholungsbereich einer Übung, wie er heute gilt.
 *
 * Im Bodyweight-Modus gibt es kein Gewicht, das man erhöhen könnte – die
 * Steigerung sind die Wiederholungen. Was der Nutzer sich erarbeitet hat,
 * steht in `bwPlus` und wird hier auf den vorgegebenen Bereich draufgerechnet:
 * Aus „8–12" werden mit zwei Zusatzwiederholungen „10–14".
 *
 * Auf jede Zahl im Text, nicht nur auf die erste: Sonst stünde „10–12" da, und
 * die obere Grenze wäre plötzlich die leichtere.
 */
export function repsLabel(it, mode) {
  const plus = mode === 'bw' ? store.bwPlusOf(it.id) : 0;
  if (!plus) return it.reps;
  return String(it.reps).replace(/\d+/g, (d) => String(Number(d) + plus));
}
