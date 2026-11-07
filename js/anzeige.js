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
import { plural } from './dates.js';

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
/**
 * „10–20 je Bein" mit „Wdh." an der richtigen Stelle: vor dem Zusatz, nicht
 * dahinter – sonst stand da „10–20 je Bein Wdh.". Als [Zahl, Zusatz], weil die
 * Wiederholungsanzeige im Bodyweight-Modus beides getrennt setzt.
 */
export function wdhTeile(reps) {
  const m = String(reps).match(/^(.*?)(?:\s+(je\s.+))?$/);
  return [m[1], m[2] || ''];
}
export function mitWdh(reps) {
  const [zahl, zusatz] = wdhTeile(reps);
  return `${zahl} Wdh.${zusatz ? ' ' + zusatz : ''}`;
}

/**
 * Der Umfang einer Einheit: „6 Übungen · 17 Sätze" – für die Kopfzeile der
 * Einheit (tagKopf() in js/app.js) und den Kalender, wortgleich.
 *
 * Gezählt wird alles, was an dem Tag gemacht wird: Nachholsätze und die
 * eingefügten Übungen eines Zusatztags eingerechnet. Hier stand bis v239 die
 * Aufschlüsselung „5 + 1 Übungen · 15 + 2 Sätze" (in v238 „12 + 3 Sätze"),
 * das „+" für nachgeholt. Raus auf Zuruf:
 *
 *     „Da brauch auch nicht 5+1 oder so stehen. Da soll einfach die normale
 *      Zahl dieses Trainings inkl der nachholübungen stehen. Also einfach 6 in
 *      diesem Fall. Genauso bei den Sätzen"
 *
 * Und das ist richtig so: Die Kopfzeile sagt, was dieser Tag *ist*, nicht wie
 * er zustande kam. Das Warum steht an der Übung, in der stillen Zeile darunter
 * („+1 nachgeholt …", „Nachgeholt aus Woche 2 …") – dort, wo man den Satz
 * macht und die Frage aufkommt.
 */
export function umfangText(items) {
  const saetze = items.reduce((a, x) => a + x.sets, 0);
  return `${plural(items.length, 'Übung', 'Übungen')} · ${plural(saetze, 'Satz', 'Sätze')}`;
}

export function repsLabel(it, mode) {
  const plus = mode === 'bw' ? store.bwPlusOf(it.id) : 0;
  if (!plus) return it.reps;
  return String(it.reps).replace(/\d+/g, (d) => String(Number(d) + plus));
}
