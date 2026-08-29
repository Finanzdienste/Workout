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
