/*
 * Erfahrungsstufen: Startgewichte, Sätze je Übung und der Aufstieg.
 *
 * Die Stufe entscheidet zwei Dinge – wie schwer eine Übung startet und wie
 * viele Sätze sie bekommt. Beides wird an genug Stellen gebraucht, dass es
 * einen eigenen Ort verdient.
 */
import * as store from './store.js';
import { EX_BY_ID } from './uebung.js';
import { fmtNum } from './text.js';
import { plural } from './dates.js';

/* ------------------------------------------------------------------ *
 * Erfahrung
 *
 * Die Startgewichte in tools/exercise-meta.json sind die eines Menschen, der
 * seit einer Weile trainiert: 40 kg Floor Press, 20 kg Goblet Squat. Für jemand
 * anderen, der den Link bekommt, ist das entweder zu viel oder zu wenig – und
 * beides führt zum selben Ergebnis, nämlich dass die erste Einheit nichts taugt.
 *
 * Die Erfahrung skaliert deshalb die Startwerte, gerundet auf die Schrittweite
 * der jeweiligen Übung. Mehr nicht: Der Plan selbst, die Sätze, die Pausen und
 * die Erholungsregel sind für Anfänger dieselben wie für alle anderen – daran
 * ist nichts anfängerspezifisch. Und sobald jemand ein Gewicht selbst einstellt,
 * gilt seins; die Erfahrung ist ein Startpunkt, keine Obergrenze.
 * ------------------------------------------------------------------ */

export const LEVELS = [
  ['anfaenger', 'Anfänger', 'Neu im Krafttraining oder lange raus. Startgewichte auf der '
    + 'Hälfte und zwei Sätze je Übung statt drei: Wer neu anfängt, wächst schon bei wenig '
    + 'Volumen – die ersten Wochen entscheidet die Technik, nicht die Scheibe.', 0.5],
  ['geuebt', 'Geübt', 'Du weißt, wie sich ein sauberer Satz anfühlt, und trainierst schon '
    + 'eine Weile. Startgewichte und drei Sätze je Übung passen so.', 1],
  ['fortgeschritten', 'Fortgeschritten', 'Jahre im Training, die Technik sitzt. Startgewichte '
    + 'um die Hälfte höher und vier Sätze je Übung – dein Reiz liegt weiter oben.', 1.5],
];

/** Zwei Beispiele, damit die Wahl nicht abstrakt bleibt. */
export function levelBeispiel(faktor, key) {
  const zeig = ['floor-press', 'goblet-squat']
    .map((id) => EX_BY_ID.get(id))
    .filter((ex) => ex && ex.weight)
    .map((ex) => {
      const step = ex.step || 2.5;
      const kg = faktor === 1 ? ex.weight
        : Math.max(step, Math.round((ex.weight * faktor) / step) * step);
      return `${ex.db.name} ${fmtNum(kg)} kg`;
    });
  // Die Satzzahl gehört dazu: Sie ist seit Neuestem der größere Unterschied
  // zwischen den Stufen – die Gewichte stellt man sich ohnehin selbst ein.
  const saetze = SAETZE_JE_STUFE[key] || 3;
  return `${plural(saetze, 'Satz', 'Sätze')} je Übung · ${zeig.join(' · ')}`;
}

export const levelFaktor = () => {
  const eintrag = LEVELS.find(([key]) => key === (store.getState().level || 'geuebt'));
  return eintrag ? eintrag[3] : 1;
};

/**
 * Sätze je Übung nach Erfahrung.
 *
 * Die Stufe skalierte lange nur die Startgewichte. Dabei ist das *Volumen* die
 * Größe, die sich zwischen Anfänger und Fortgeschrittenem am deutlichsten
 * unterscheidet: Wer neu anfängt, wächst schon bei drei bis fünf Sätzen je
 * Muskel und Woche fast maximal – die Dosis-Wirkungs-Kurve ist dort oben flach.
 * Mehr bringt kaum etwas und kostet das, woran es bei Anfängern wirklich hängt:
 * saubere Technik in den letzten Sätzen, erträglicher Muskelkater, und eine
 * Einheit, die man ein halbes Jahr lang durchhält.
 *
 * Skaliert wird **gleichmäßig über alle Übungen**. Das ist der Grund, warum es
 * die exakte Rechnung des Generators nicht kaputt macht: Bekommt jede Übung
 * zwei Drittel ihrer Sätze, bekommt auch jede Muskelgruppe exakt zwei Drittel
 * ihres Ziels. Die Verteilung bleibt dieselbe, nur die Höhe ändert sich – und
 * targetOf() rechnet mit demselben Faktor, damit "Soll gegen Ist" weiter stimmt.
 *
 * Eigene Workouts bleiben außen vor: Was jemand selbst zusammenstellt, hat er
 * so gemeint (siehe exOf()).
 */
export const SAETZE_JE_STUFE = { anfaenger: 2, geuebt: 3, fortgeschritten: 4 };

export const satzFaktor = () => (SAETZE_JE_STUFE[store.getState().level || 'geuebt'] || 3) / 3;

export const satzZahl = (n) => Math.max(1, Math.round(n * satzFaktor()));

/* ------------------------------------------------------------------ *
 * Aufsteigen, ohne daran zu denken
 *
 * Die Stufe war bisher eine Einstellung, die man einmal trifft und dann
 * vergisst – und genau das ist der Fehler. Wer als Anfänger anfängt und ein
 * Jahr durchhält, trainiert danach immer noch auf zwei Sätzen je Übung, weil
 * ihm niemand gesagt hat, dass die Zahl inzwischen zu klein ist. Die App weiß
 * es aber: Sie zählt mit.
 *
 * **Woran gemessen wird.** An drei Dingen zusammen, denn jedes einzelne lässt
 * sich zu leicht erfüllen:
 *
 *   Einheiten   Erfahrung ist vor allem Zeit unter der Hantel. 60 Einheiten
 *               sind bei vier pro Woche rund ein Vierteljahr.
 *   Sätze       Damit halbe Einheiten nicht so viel zählen wie ganze.
 *   Tonnage     Kilo mal Wiederholungen, aufsummiert. Das ist der Teil, der
 *               *Fortschritt* misst statt nur Anwesenheit: Wer schwerer wird,
 *               kommt schneller ans Ziel.
 *
 * Die Tonnage gilt nur für den, der mit Gewichten trainiert. Im
 * Bodyweight-Modus gibt es keine Kilo zu zählen, und jemanden deswegen ewig auf
 * Anfänger stehen zu lassen, wäre eine Strafe für die Wahl der Variante.
 *
 * **Was dann passiert.** Die Stufe wird umgestellt – das ist der Punkt, der
 * Arbeit spart – und ein Hinweis sagt, was sich dadurch ändert, mit einem
 * Knopf zum Zurückstellen daneben. Jeder Schritt kommt genau einmal: Wer
 * zurückstellt, bleibt unten, bis er selbst etwas anderes will.
 * ------------------------------------------------------------------ */
export const AUFSTIEGE = [
  { von: 'anfaenger', nach: 'geuebt', einheiten: 60, saetze: 700, tonnen: 30 },
  { von: 'geuebt', nach: 'fortgeschritten', einheiten: 200, saetze: 3400, tonnen: 200 },
];

/** Der nächste Schritt, wenn es einen gibt und er noch nicht dran war. */
export function offenerAufstieg() {
  const s = store.getState();
  const schritt = AUFSTIEGE.find((a) => a.von === (s.level || 'geuebt'));
  if (!schritt) return null;
  return (s.aufstiege || []).includes(schritt.nach) ? null : schritt;
}
