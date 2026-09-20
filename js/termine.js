/*
 * Termine: Tage, an denen etwas anderes ansteht.
 *
 *     „dass man auswählen kann dass man an nem bestimmten Kalendertag was
 *      vorhat zb 02.06. Padel und dass man dadurch automatisch am Tag davor
 *      keine Beine trainiert"
 *
 * **Warum das etwas bringt, und warum nur am Tag davor.** Der Muskelkater nach
 * schweren Kniebeugen ist nicht am Abend am schlimmsten, sondern nach 24 bis 48
 * Stunden – genau dann, wenn am nächsten Tag Padel wäre. Sprint, Sprung und
 * seitliches Abstoppen leiden messbar. Zwei Tage vorher zu schonen wäre
 * übervorsichtig und kostete ein zweites Mal Volumen; am Tag selbst ist es
 * ohnehin klar. Deshalb gilt der Schutz für **den Termintag und den Tag davor**
 * und sonst für keinen.
 *
 * **Was es kostet, und das steht hier, weil es sonst niemand sagt.** Die
 * betroffenen Übungen fallen aus der Einheit, ersatzlos. Die Woche verfehlt
 * damit ihr Ziel für diese Gruppen – der ganze Plan ist darauf gebaut, jedes
 * Wochenziel im Schnitt exakt zu treffen, und ein Termin bricht das für eine
 * Woche auf. Das ist der Preis; die App zeigt ihn an, statt ihn zu verschweigen.
 *
 * **Warum kein Ersatz.** Bei einer Verletzung wird getauscht: Wer nicht
 * drücken kann, rudert. Hier ginge das nicht sinnvoll – ein Ersatz für die
 * Kniebeuge, der die Beine nicht trifft, ist keine Beinübung mehr, sondern
 * zusätzliches Volumen für eine Gruppe, die ihr Ziel schon hat. Weglassen ist
 * ehrlicher als umverteilen.
 *
 * **Was es ausdrücklich nicht tut: den Plan verschieben.** Die Termine der
 * Einheiten bleiben, wo sie sind. Wer die Einheit lieber vorzieht, kann das von
 * Hand – dafür gibt es den Plan und die Verschiebung. Ein Termin, der den
 * halben Restplan um Tage rückt, wäre eine viel größere Wirkung, als das
 * Anhaken erwarten lässt.
 */
import { EXERCISES } from './data.js';
import { addDays } from './dates.js';
import * as store from './store.js';
import { directOf } from './uebung.js';

/**
 * Was ein Termin beansprucht – und welche Muskelgruppen deshalb geschont
 * werden.
 *
 * Bewusst drei grobe Körbe statt vierzehn Häkchen: Wer am Dienstag Padel
 * spielt, weiß, dass die Beine drankommen, und nicht, ob der Beinbeuger an der
 * Hüfte oder am Knie mehr leidet. Die Aufteilung folgt den Gruppen, die
 * js/data.js ohnehin führt.
 */
export const TERMIN_ARTEN = {
  beine: {
    label: 'Beine',
    hinweis: 'Padel, Fußball, Laufen, Skifahren',
    gruppen: ['quads', 'hamstringsKnee', 'hamstringsHip', 'glutes', 'calves'],
  },
  oberkoerper: {
    label: 'Oberkörper',
    hinweis: 'Klettern, Bouldern, Schwimmen, Umzug',
    gruppen: ['chest', 'lats', 'frontDelts', 'sideDelts', 'rearDelts', 'traps',
              'biceps', 'triceps'],
  },
  alles: {
    label: 'Alles',
    hinweis: 'Wettkampf, langer Wandertag',
    gruppen: null,        // null heißt: jede Gruppe, siehe geschont()
  },
};

/** Die eingetragenen Termine, immer als Liste und immer sortiert. */
export function termine() {
  const t = store.getState().termine;
  return Array.isArray(t)
    ? t.filter((x) => x && x.datum).slice().sort((a, b) => a.datum.localeCompare(b.datum))
    : [];
}

/**
 * Welche Gruppen an einem bestimmten Tag geschont werden – und wessentwegen.
 *
 * Gibt `{ gruppen, namen }` zurück; `gruppen` ist leer, wenn nichts ansteht.
 * Mehrere Termine an benachbarten Tagen zählen zusammen: Wer Samstag Padel und
 * Sonntag klettert, schont am Freitag die Beine und am Samstag beides.
 */
export function geschont(iso) {
  const gruppen = new Set();
  const namen = [];
  termine().forEach((t) => {
    // Der Termintag selbst und der Tag davor.
    if (iso !== t.datum && iso !== addDays(t.datum, -1)) return;
    const art = TERMIN_ARTEN[t.schont] || TERMIN_ARTEN.beine;
    if (art.gruppen === null) EXERCISES.forEach((e) => directOf(e.id).forEach((m) => gruppen.add(m)));
    else art.gruppen.forEach((m) => gruppen.add(m));
    namen.push(t.name || art.label);
  });
  return { gruppen, namen };
}

/**
 * Die Übungen einer Einheit, die wegen eines Termins wegfallen.
 *
 * Maßgeblich ist der *direkte* Reiz (directOf): Ein Drücken, das den Trizeps
 * mit 0,6 trifft, zählt als Trizeps-Übung; die 0,3 Nacken beim Rudern nicht.
 * Sonst fiele bei „Oberkörper schonen" praktisch die ganze Einheit weg.
 */
export function faelltAus(items, iso) {
  const { gruppen, namen } = geschont(iso);
  if (!gruppen.size) return { items, dropped: [], namen: [] };
  const dropped = [];
  const bleibt = [];
  items.forEach((it) => {
    if (directOf(it.id).some((m) => gruppen.has(m))) dropped.push({ ...it, reason: 'termin' });
    else bleibt.push(it);
  });
  return { items: dropped.length ? bleibt : items, dropped, namen };
}
