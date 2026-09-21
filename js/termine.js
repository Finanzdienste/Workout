/*
 * Termine: Tage, an denen etwas anderes ansteht.
 *
 *     „dass man auswählen kann dass man an nem bestimmten Kalendertag was
 *      vorhat zb 02.06. Padel und dass man dadurch automatisch am Tag davor
 *      keine Beine trainiert"
 *
 * **Warum das etwas bringt.** Der Muskelkater nach schweren Kniebeugen ist
 * nicht am Abend am schlimmsten, sondern nach 24 bis 48 Stunden – genau dann,
 * wenn am nächsten Tag Padel wäre. Sprint, Sprung und seitliches Abstoppen
 * leiden messbar. Zwei Tage vorher zu schonen wäre übervorsichtig und kostete
 * ein zweites Mal Volumen; am Tag selbst ist es ohnehin klar.
 *
 * **Seit v182 sagt die Aktivität selbst, was sie trifft.**
 *
 *     „Ich will das nicht selbst anklicken müssen. … Ich will nur sagen was
 *      ich an welchem tag gemacht hab. Der Rest soll automatisch passieren"
 *
 * Die drei Körbe unten – Beine, Oberkörper, alles – waren eine Frage an den
 * Nutzer, die die App beantworten kann: In welchen Korb gehört Padel? Seit
 * v182 steht die Antwort in js/aktivitaeten.js, für rund fünfzig Aktivitäten
 * und je vierzehn Muskelgruppen, mit einem Satz Begründung pro Zeile. Der
 * Termin trägt jetzt eine Aktivität und eine Dauer; welche Gruppen an welchem
 * Tag ausfallen, rechnet der Katalog. TERMIN_ARTEN steht nur noch für
 * Einträge da, die vor v182 angelegt wurden.
 *
 * **Der Tag danach, seit v181.**
 *
 *     „Ich hab gestern 1,5h padel gemacht. Kannst das irgendwo eintragen und
 *      die Übungen usw entsprechend anpassen? Oder spielt padel gestern keinen
 *      Einfluss auf Workout heute?"
 *
 * Er spielt einen. Dieselbe Rechnung, nur andersherum gelesen: Anderthalb
 * Stunden Padel sind vor allem Abbremsen und Richtungswechsel, also exzentrische
 * Last auf Quadrizeps, Beinbeuger und Waden. Deren Muskelkater hat sein
 * Maximum ebenfalls nach 24 bis 48 Stunden – am Tag danach. Bis v180 sah die
 * App genau daran vorbei: Ein Termin schützte den Wettkampf vor dem Training,
 * aber nicht das Training vor dem Wettkampf. Der Schutz gilt deshalb jetzt für
 * **den Tag davor, den Termintag und den Tag danach**.
 *
 * Drei Tage statt zwei sind ein Drittel mehr Ausfall, und das ist kein
 * Rundungsfehler: Wer wöchentlich spielt, verliert damit regelmäßig Beinvolumen.
 * Die Gegenrechnung: Auf müden, schweren Beinen schwer zu beugen bringt wenig
 * Anpassung und trägt ein erhöhtes Risiko – gerade am Beinbeuger. Wem es nach
 * einem bestimmten Termin gut geht, der löscht ihn; er ist eine Eintragung und
 * keine Vorschrift.
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
import { AKT_BY_ID, gruppenAm } from './aktivitaeten.js';

/**
 * Die drei groben Körbe von vor v182 – nur noch für alte Einträge.
 *
 * Neue Termine tragen eine Aktivität aus js/aktivitaeten.js und brauchen das
 * hier nicht. Gelöscht wird es trotzdem nicht: Im Speicher eines Geräts, das
 * länger nicht aktualisiert hat, stehen Einträge in dieser Form, und die
 * sollen weiter wirken statt stillschweigend zu verschwinden.
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
    // Wie viele Tage liegt der betrachtete Tag hinter dem Termin? −1 ist der
    // Tag davor, 0 der Termintag, +1 und +2 danach.
    const tage = [-1, 0, 1, 2].find((d) => iso === addDays(t.datum, d));
    if (tage === undefined) return;
    const treffer = terminGruppen(t, tage);
    if (!treffer.length) return;
    treffer.forEach((m) => gruppen.add(m));
    namen.push(t.name || terminLabel(t));
  });
  return { gruppen, namen };
}

/**
 * Die Gruppen eines einzelnen Termins an einem Tagesversatz.
 *
 * Zwei Formen liegen im Speicher nebeneinander, und das bleibt so:
 *
 *   `{ aktivitaet, minuten }`  die heutige. Die Gruppen kommen aus dem
 *                              Katalog in js/aktivitaeten.js – Padel weiß
 *                              selbst, dass es Kniestrecker und Waden trifft.
 *   `{ schont: 'beine' }`      die alte mit drei Körben. Wer sie vor v182
 *                              eingetragen hat, soll sie nicht neu anlegen
 *                              müssen; sie wirkt weiter wie bisher, nur eben
 *                              ohne Abstufung nach Tag.
 */
function terminGruppen(t, tage) {
  if (t.aktivitaet && AKT_BY_ID.has(t.aktivitaet)) {
    return gruppenAm(t.aktivitaet, t.minuten, tage);
  }
  // Die alte Form kannte nur „Tag davor und Termintag"; der Tag danach kam
  // mit v181 dazu. Zwei Tage danach gab es nie und kommt hier auch nicht.
  if (tage === 2) return [];
  const art = TERMIN_ARTEN[t.schont] || TERMIN_ARTEN.beine;
  if (art.gruppen === null) {
    const alle = new Set();
    EXERCISES.forEach((e) => directOf(e.id).forEach((m) => alle.add(m)));
    return [...alle];
  }
  return art.gruppen;
}

/** Wie ein Termin heißt, wenn kein Name eingetragen wurde. */
export function terminLabel(t) {
  const a = t.aktivitaet && AKT_BY_ID.get(t.aktivitaet);
  if (a) return a.name;
  return (TERMIN_ARTEN[t.schont] || TERMIN_ARTEN.beine).label;
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
