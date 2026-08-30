/*
 * Die einzelne Übung: nachschlagen, Wiederholungen lesen, Muskeln zuordnen.
 *
 * Was hier steht, kennt den Übungskatalog aus js/data.js und – für die
 * Wiederholungen – die Erfahrungsstufe. Den Plan kennt es nicht: keine
 * Termine, keine Einheiten, kein Protokoll.
 */
import * as store from './store.js';
import { EXERCISES, REST } from './data.js';

export const EX_BY_ID = new Map(EXERCISES.map((e) => [e.id, e]));

/** Muskelgruppen, für die eine Übung da ist – dieselbe Schwelle wie im Plan. */
export function directOf(exId) {
  const ex = EX_BY_ID.get(exId);
  if (!ex) return [];
  return Object.entries(ex.db.shares).filter(([, v]) => v >= REST.direct).map(([m]) => m);
}

export const directSets = (items) => new Set(items.flatMap((it) => directOf(it.id)));

/** Untere Grenze eines Wiederholungsbereichs, z. B. "8–12" -> 8. */
export function plannedReps(reps) {
  const m = String(reps).match(/\d+/);
  return m ? Number(m[0]) : 0;
}

/**
 * Beide Grenzen eines Wiederholungsbereichs: "8–12 je Bein" -> { lo: 8, hi: 12 }.
 *
 * Der Zusatz hinter der Zahl ist Absicht und darf nicht stören – "je Bein"
 * sagt etwas über die Ausführung, nicht über den Bereich.
 */
export function repsBereich(reps) {
  const zahlen = String(reps).match(/\d+/g) || [];
  const lo = Number(zahlen[0] || 0);
  const hi = Number(zahlen[1] || zahlen[0] || 0);
  return { lo, hi };
}

/**
 * Mit wie vielen Wiederholungen ein abgehakter Satz in die Volumenrechnung
 * eingeht.
 *
 * Erfasst wird nicht die Zahl, sondern die Lage im Bereich – ein Tipp statt
 * eines Zahlenfelds (siehe satzFrage() in js/app.js). Daraus wird hier so
 * vorsichtig wie möglich gerechnet:
 *
 *   oben        die obere Grenze. Wer 12 von 8–12 schafft, hat 12 gemacht.
 *   drin/nichts die untere Grenze – wie bisher, und bewusst eher zu niedrig.
 *   unter       ebenfalls die untere Grenze. Wie weit darunter, weiß niemand,
 *               und eine erfundene Zahl wäre schlechter als eine zu hohe.
 *
 * Die Volumenzahl bleibt damit eine Untergrenze und heißt in der Statistik
 * weiterhin "ca." – sie ist nur nicht mehr für *jeden* Satz die kleinste
 * denkbare.
 */
export function gezaehlteReps(satz, reps) {
  const { lo, hi } = repsBereich(reps);
  return satz && satz.wie === 'oben' ? hi : lo;
}

/**
 * Wiederholungen und Pause, auf die Erfahrungsstufe umgerechnet.
 *
 * Bei fast jeder Übung braucht es das nicht: Der Anfänger nimmt die Hälfte des
 * Gewichts und trifft damit denselben Wiederholungsbereich. Klimmzüge kennen
 * diesen Hebel nicht – dort *ist* das Körpergewicht die Last. Wer eine
 * Wiederholung schafft, bekommt eine Vorgabe von 5–10 und kann sie nicht
 * erfüllen; die Zahl wird damit von einer Ansage zu einem Vorwurf.
 *
 * Die Ausnahmen stehen als `stufen` an der Übung selbst (siehe
 * tools/exercise-meta.json), damit hier keine Übungsnamen im Code stehen.
 */
export function stufenWerte(v) {
  const s = (v.stufen || {})[store.getState().level || 'geuebt'];
  return { reps: (s && s.reps) || v.reps, rest: (s && s.rest) || v.rest };
}
