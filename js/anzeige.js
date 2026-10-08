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
 * Der Umfang einer Einheit in Zahlen, getrennt nach Plan und Nachgeholtem –
 * für die Kopfzeile der Einheit (tagKopf() in js/app.js) und den Kalender.
 *
 *   plan        Planübungen (ohne die eines eingefügten Zusatztags)
 *   zusatz      eingefügte Übungen eines Zusatztags
 *   saetze      alle Sätze
 *   nachgeholt  Nacharbeit („+1 nachgeholt") und Zusatztag zusammen – das
 *               „+" in „15 + 3 Sätze" heißt überall dasselbe: nachgeholt
 *
 * `allein` für einen Zusatztag, der als eigene Einheit dasteht: Dann *ist* er
 * die Einheit, und seine Übungen sind kein „+".
 */
export function umfang(items, allein = false) {
  const zus = allein ? [] : items.filter((x) => x.zusatz);
  const saetze = items.reduce((a, x) => a + x.sets, 0);
  const nachgeholt = items.reduce((a, x) => a + (x.nach || 0), 0)
    + zus.reduce((a, x) => a + x.sets, 0);
  return { plan: items.length - zus.length, zusatz: zus.length, saetze, nachgeholt };
}

export function repsLabel(it, mode) {
  const plus = mode === 'bw' ? store.bwPlusOf(it.id) : 0;
  if (!plus) return it.reps;
  return String(it.reps).replace(/\d+/g, (d) => String(Number(d) + plus));
}
