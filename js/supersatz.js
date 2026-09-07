/*
 * Supersätze: die Pause mit einer anderen Übung füllen, statt sie abzusitzen.
 *
 * Der Anstoß kam aus dem Training selbst: *„Könnte man statt den langen Pausen
 * nicht immer Supersätze machen? Zumindest wenns nicht gleiche Muskelgruppen
 * sind und nicht das gleiche Equipment mit anderem Gewicht benutzt wird."*
 * Beide Bedingungen sind genau die richtigen, und beide kann die App prüfen.
 *
 * **Warum das nichts kostet.** A1 → B1 → A2 → B2: Zwischen den beiden Sätzen
 * von A liegt ein ganzer Satz B plus zwei Übergänge. A ist also erholt, wenn A
 * wieder drankommt – nur hat man in derselben Zeit doppelt so viel geschafft.
 * Das ist kein Kompromiss zwischen Zeit und Qualität, sondern geschenkte Zeit.
 *
 * **Die beiden Regeln.**
 *   Kein gemeinsamer Muskel. Wer den Trizeps im Floor Press ermüdet und direkt
 *   danach Trizepsstrecker macht, hat keinen Supersatz gemacht, sondern den
 *   zweiten Satz verschenkt. Geprüft wird gegen die Anteile aus
 *   tools/exercise-meta.json: Ein Muskel zählt als „getroffen" ab einem Anteil
 *   von 0,5 – dieselbe Schwelle wie in vorgezogen() (js/gewichte.js).
 *
 *   Nicht dasselbe Gerät. Sonst müsste zwischen jedem Satz umgebaut werden, und
 *   der gewonnene Zeitvorteil ginge in Scheibenwechseln wieder drauf. Umgekehrt
 *   ist der Fall, in dem sich zwei *verschiedene* Geräte treffen, der beste:
 *   Beide Aufbauten bleiben stehen, es wird gar nichts gewechselt.
 *
 * **Warum Paare und nicht sechs im Kreis.** Der Vorschlag war ein Rundlauf über
 * alle Übungen. Der Gedanke stimmt, die Zahl nicht: Ab drei Übungen im Wechsel
 * staut sich die allgemeine Erschöpfung, und die hinteren Übungen leiden – die
 * schweren zuerst. Belegt gut ist der Wechsel zu zweit. Deshalb Paare, und der
 * Rest der Einheit bleibt, wie er war.
 *
 * **Was hier NICHT entschieden wird: die Pausenlänge.** Ein Supersatz verkürzt
 * keine Pause, er füllt sie. Wie lange A noch warten muss, wenn A wieder dran
 * ist, hängt davon ab, wie lange B gedauert hat – und das weiß nur die Uhr.
 * Deshalb rechnet js/app.js die Wartezeit aus „wann war A zuletzt fertig",
 * nicht aus einem festen Übergang. Wer zügig wechselt, wartet kurz; wer trödelt,
 * gar nicht.
 */

import { EX_BY_ID } from './uebung.js';
import { RUEST_FAM } from './gewichte.js';

/** Ab diesem Anteil gilt ein Muskel als von der Übung getroffen. */
export const DIREKT = 0.5;

/** Die Muskeln, die eine Übung wirklich meint – nicht die Randnotizen. */
function direkteMuskeln(id, mode) {
  const ex = EX_BY_ID.get(id);
  const sh = (ex && ex[mode] && ex[mode].shares) || {};
  return new Set(Object.keys(sh).filter((m) => sh[m] >= DIREKT));
}

/**
 * Das Gerät, das aufgebaut werden muss – oder null, wenn keins.
 *
 * Klimmzugstange, Band und Körpergewicht kosten keinen Umbau. Sie sind deshalb
 * die dankbarsten Partner: Sie kollidieren mit gar nichts.
 */
const geraet = (id) => {
  const ex = EX_BY_ID.get(id);
  return (ex && RUEST_FAM[ex.equip]) || null;
};

/** Dürfen diese beiden im Wechsel laufen? */
export function passtZusammen(a, b, mode) {
  if (a.id === b.id) return false;
  const ga = geraet(a.id);
  const gb = geraet(b.id);
  // Dasselbe Gerät hieße: zwischen jedem Satz umbauen. Zwei Übungen ohne Aufbau
  // dürfen sich dagegen treffen – da gibt es nichts zu wechseln.
  if (ga && gb && ga === gb) return false;
  const ma = direkteMuskeln(a.id, mode);
  return ![...direkteMuskeln(b.id, mode)].some((m) => ma.has(m));
}

/**
 * Die Übungen einer Einheit zu Paaren ordnen.
 *
 * Gierig und in Planreihenfolge: Für jede noch freie Übung wird die nächste
 * passende gesucht. Das ist nicht die theoretisch beste Paarung – die wäre ein
 * Matching-Problem –, aber es hält die Reihenfolge des Plans ein, und die ist
 * nicht zufällig: Vorn stehen die schweren Grundübungen, und da gehören sie
 * hin. Eine optimale Paarung, die den Floor Press ans Ende schiebt, wäre auf
 * dem Papier besser und im Training schlechter.
 *
 * Der Partner wird zusätzlich nur unter den nächsten `FENSTER` Übungen gesucht:
 * Ein Paar aus Übung 1 und Übung 6 hieße, zwischen beiden durch den halben Raum
 * zu laufen.
 *
 * Gibt eine Liste von Gruppen zurück – jede mit einer oder zwei Übungen.
 */
export const FENSTER = 3;

export function paare(items, mode) {
  const frei = items.map(() => true);
  const gruppen = [];
  items.forEach((a, i) => {
    if (!frei[i]) return;
    frei[i] = false;
    let partner = -1;
    for (let j = i + 1; j < items.length && j <= i + FENSTER; j++) {
      if (frei[j] && passtZusammen(a, items[j], mode)) { partner = j; break; }
    }
    if (partner < 0) { gruppen.push([a]); return; }
    frei[partner] = false;
    gruppen.push([a, items[partner]]);
  });
  return gruppen;
}

/**
 * Die Reihenfolge der Sätze innerhalb einer Gruppe.
 *
 * Im Wechsel, bis einer ausgeht: A1 B1 A2 B2 A3. Hat B nur zwei Sätze und A
 * drei, macht A den dritten allein zu Ende – genau das war auch die Erwartung
 * (*„Übungen die dann weniger Sätze haben fallen dann halt nach zwei Durchgängen
 * raus"*). Es wird also nichts gestrichen und nichts hinzugefügt; nur die
 * Reihenfolge ändert sich.
 *
 * Gibt Schritte zurück: [{ id, satz }] mit `satz` ab 0.
 */
export function schritte(gruppe) {
  const max = Math.max(...gruppe.map((x) => x.sets));
  const folge = [];
  for (let runde = 0; runde < max; runde++) {
    gruppe.forEach((x) => { if (runde < x.sets) folge.push({ id: x.id, satz: runde }); });
  }
  return folge;
}

/**
 * Der nächste Schritt nach einem abgehakten Satz.
 *
 * Gesucht wird der erste Schritt der Gruppe, der noch offen ist – nicht
 * stumpf „der danach". Wer einen Satz überspringt oder einen Haken wieder
 * wegnimmt, soll trotzdem an der richtigen Stelle landen.
 *
 * `erledigt(id, satz)` sagt, ob ein Satz schon steht.
 */
export function naechsterSchritt(gruppe, erledigt) {
  return schritte(gruppe).find((s) => !erledigt(s.id, s.satz)) || null;
}

/** Zu welcher Gruppe gehört diese Übung? */
export function gruppeVon(gruppen, id) {
  return gruppen.find((g) => g.some((x) => x.id === id)) || null;
}
