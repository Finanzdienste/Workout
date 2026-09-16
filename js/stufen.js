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
    + 'Hälfte und, wo es sie gibt, die einfachere Fassung der Übung – die ersten Wochen '
    + 'entscheidet die Technik, nicht die Scheibe. Die Sätze bleiben die des Plans.', 0.5],
  ['geuebt', 'Geübt', 'Du weißt, wie sich ein sauberer Satz anfühlt, und trainierst schon '
    + 'eine Weile. Startgewichte und Sätze wie im Plan.', 1],
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
 * Anfänger stand hier lange auf **zwei** Sätzen, mit einer Begründung, die für
 * sich genommen stimmt: Wer neu anfängt, wächst schon bei drei bis fünf Sätzen
 * je Muskel und Woche fast maximal. Nur ist das eine Aussage über *Sätze je
 * Muskel und Woche* – und was dabei herauskam, lag darunter. Nachgemessen im
 * Cut-Plan, gewichtete Sätze je Muskelgruppe und Woche:
 *
 *                         zwei Sätze    drei Sätze
 *   Beinbeuger (Knie)         2,0          3,0
 *   Beinbeuger (Hüfte)        3,3          5,0
 *   Schulter vorn             4,0          5,9
 *   Oberschenkel, Waden       4,0          6,0
 *   Rest                   4,7 – 6,0    7,0 – 9,0
 *   je Woche gesamt            38           57
 *
 * Fünf von vierzehn Gruppen lagen also an oder unter der Untergrenze, die
 * derselbe Absatz selbst nennt. Der Faktor war als Schonung gemeint und war in
 * der Rechnung eine Kürzung unter die Wirkschwelle – gerade in den Gruppen, die
 * ohnehin die wenigsten Sätze haben.
 *
 * Also heißt Anfänger jetzt: **leichtere Startgewichte und die einfachere
 * Fassung der Übung** (siehe levelFaktor() und anfaengerFassung() in
 * js/plan.js), aber dieselben Sätze wie im Plan. Das ist auch die ehrlichere
 * Lesart der Stufe: Wer neu ist, braucht eine Last, die er beherrscht, und eine
 * Bewegung, die er kann – nicht ein Drittel weniger Reiz.
 *
 * Fortgeschritten legt weiterhin zu: Dort ist mehr Volumen der Reiz, der fehlt.
 *
 * Skaliert wird **gleichmäßig über alle Übungen**. Das ist der Grund, warum es
 * die exakte Rechnung des Generators nicht kaputt macht: Bekommt jede Übung ein
 * Drittel mehr Sätze, bekommt auch jede Muskelgruppe exakt ein Drittel mehr –
 * die Verteilung bleibt dieselbe, nur die Höhe ändert sich, und targetOf()
 * rechnet mit demselben Faktor, damit "Soll gegen Ist" weiter stimmt.
 *
 * Eigene Workouts bleiben außen vor: Was jemand selbst zusammenstellt, hat er
 * so gemeint (siehe exOf()).
 */
export const SAETZE_JE_STUFE = { anfaenger: 3, geuebt: 3, fortgeschritten: 4 };

export const satzFaktor = () => (SAETZE_JE_STUFE[store.getState().level || 'geuebt'] || 3) / 3;

export const satzZahl = (n) => Math.max(1, Math.round(n * satzFaktor()));

/* ------------------------------------------------------------------ *
 * Die Stufe ist, was du hebst
 *
 * Vorher zählte sie Fleiß: 60 Einheiten, 540 Sätze, 30 Tonnen. Alle drei sind
 * Ansammlung – wer oft genug da war, stieg auf. Das misst Anwesenheit und nicht
 * Können, und der Einwand dagegen war knapp und richtig:
 *
 *     "Wenn ich nach 10 Jahren noch immer nur eine Liegestütze kann, bin ich
 *      noch immer Anfänger. Und wenn ich ohne jemals trainiert zu haben hundert
 *      kann, bin ich vermutlich schon geübt."
 *
 * **Woran jetzt gemessen wird, und warum das keine erfundene Zahl ist.** Der
 * Katalog nennt für jede Gewichtsübung ein Startgewicht – Goblet Squat 20 kg,
 * Floor Press 40 kg, SZ-Curls 15 kg. Es gilt für "Geübt"; die Stufen skalieren
 * es mit 0,5 / 1 / 1,5 (siehe LEVELS). Das ist eine Aussage, die diese App
 * ohnehin trifft: *So schwer fängt jemand auf dieser Stufe an.*
 *
 * Also wird sie umgedreht. Wer beim Goblet Squat 20 kg bewegt, hebt dort so
 * viel, wie ein Geübter *anfängt* – Verhältnis 1,0. Der Median über alle
 * Übungen, bei denen etwas Eigenes eingetragen ist, ist die Kennzahl, und die
 * Schwellen sind dieselben 0,5 / 1 / 1,5. Keine neue Skala, keine geschätzten
 * Standards: die Zahlen, die schon da waren, in die andere Richtung gelesen.
 *
 * **Bodyweight zählt mit.** Dort gibt es keine Kilo, aber den Aufschlag auf den
 * geplanten Wiederholungsbereich (`bwPlus`). Wer bei 8–20 Liegestützen +20
 * eingestellt hat, macht das Doppelte des Bereichs – Verhältnis 2,0. Damit
 * trifft der Fall aus dem Zitat zu: hundert Liegestütze sind weit über Geübt,
 * ganz ohne eine einzige protokollierte Einheit.
 *
 * **Der Median, nicht der Schnitt.** Eine einzelne Übung, bei der jemand
 * ungewöhnlich stark oder schwach ist, soll die Einstufung nicht kippen. Und
 * mindestens LEISTUNG_MIN Übungen müssen eine eigene Angabe haben, sonst sagt
 * die Zahl nichts.
 *
 * **Was diese Rechnung nicht kann, und das gehört dazu:** Kraftstandards sind
 * normalerweise auf das Körpergewicht bezogen – 40 kg Kreuzheben heißen bei 60
 * und bei 100 Kilo Körpergewicht nicht dasselbe. Das Körpergewicht ist auf
 * ausdrücklichen Wunsch komplett aus der App ("Dein Gewicht kann vollständig
 * raus"), und ohne Server kommt es auch aus keiner anderen App hierher. Die
 * absoluten Kilo sind deshalb gröber als ein richtiger Standard. Sie sind
 * trotzdem die bessere Grundlage als eine Anwesenheitsliste.
 *
 * **Abgestuft wird nie.** Wer einmal oben ist, bleibt oben; ein verletzungs-
 * bedingt gesenktes Gewicht darf niemanden zurückwerfen.
 * ------------------------------------------------------------------ */

/** So viele Übungen brauchen eine eigene Angabe, sonst wird nicht gemessen. */
export const LEISTUNG_MIN = 4;

export const RANG = ['anfaenger', 'geuebt', 'fortgeschritten'];

/** Die obere Grenze einer Wiederholungsangabe: "8–20" ergibt 20. */
const obereGrenze = (reps) => {
  const zahlen = String(reps || '').match(/\d+/g);
  return zahlen && zahlen.length ? Number(zahlen[zahlen.length - 1]) : 0;
};

/**
 * Was die eingetragenen Gewichte und Wiederholungen über die Stufe sagen.
 *
 * Gezählt wird nur, was der Nutzer selbst eingestellt hat: `weights` und
 * `bwPlus` werden ausschließlich von Hand geschrieben. Das voreingestellte
 * Startgewicht einer Übung steht *nicht* darin – sonst käme bei jedem sofort
 * genau der Faktor seiner eigenen Stufe heraus, und die Messung wäre ein
 * Spiegel der Einstellung.
 */
export function leistungsStand() {
  const s = store.getState();
  const werte = [];
  EX_BY_ID.forEach((ex, id) => {
    const kg = Number((s.weights || {})[id]);
    if (ex.weight > 0 && Number.isFinite(kg) && kg > 0) {
      werte.push({ id, v: kg / ex.weight, wie: 'kg', ist: kg, soll: ex.weight });
      return;
    }
    const plus = Number((s.bwPlus || {})[id]);
    const oben = obereGrenze(ex.bw && ex.bw.reps);
    if (Number.isFinite(plus) && plus > 0 && oben > 0) {
      werte.push({ id, v: (oben + plus) / oben, wie: 'wdh', ist: oben + plus, soll: oben });
    }
  });
  if (werte.length < LEISTUNG_MIN) {
    return { n: werte.length, fehlt: LEISTUNG_MIN - werte.length, verhaeltnis: null, stufe: null };
  }
  const sortiert = werte.map((x) => x.v).sort((a, b) => a - b);
  const m = sortiert.length;
  const median = m % 2 ? sortiert[(m - 1) / 2] : (sortiert[m / 2 - 1] + sortiert[m / 2]) / 2;
  // Von oben nach unten: die höchste Stufe, deren Faktor erreicht ist.
  const treffer = LEVELS.slice().reverse().find(([, , , faktor]) => median >= faktor);
  return { n: m, fehlt: 0, verhaeltnis: median, stufe: (treffer && treffer[0]) || 'anfaenger' };
}

/** Die nächsthöhere Stufe, wenn es eine gibt. */
export function naechsteStufe(von) {
  const i = RANG.indexOf(von || 'geuebt');
  return i >= 0 && i < RANG.length - 1 ? RANG[i + 1] : null;
}

