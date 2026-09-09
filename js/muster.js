/*
 * Was im Protokoll steht, ohne dass es jemand hingeschrieben hat.
 *
 * Der Plan verschiebt sich bei verpassten Tagen – mehr lernt er nicht. Dass
 * dreimal hintereinander dieselbe Übung fehlt, steht im Protokoll und wird
 * nirgends gelesen. Genau das passiert hier, und zwar **ohne eine einzige neue
 * Eingabe**: Ein abgehakter Satz ist alles, was gebraucht wird, und den gibt es
 * ohnehin.
 *
 * Zwei Muster, weil sie verschiedene Ursachen haben und verschiedene Antworten:
 *
 *   Eine Übung fehlt        Sie liegt hinten, die Zeit war um, oder sie nervt.
 *                           Antwort: nach vorn holen – oder wissen, dass man
 *                           sie nicht macht, statt es sich vorzunehmen.
 *   Die Einheit bricht ab   Nicht *eine* Übung fehlt, sondern der ganze Rest ab
 *                           einer Stelle. Das ist kein Übungsproblem, sondern
 *                           eine Frage der Länge.
 *
 * **Was hier bewusst nicht passiert: von selbst etwas ändern.** Ein Plan, der
 * sich unbemerkt umstellt, weil man zweimal früher aufgehört hat, ist keiner.
 * Es wird gezeigt, was dasteht; entschieden wird von Hand.
 */
import * as store from './store.js';
import { EX_BY_ID } from './uebung.js';
import { PLAN } from './data.js';
import { exOf, istCustom, resolve } from './plan.js';

/**
 * Wie viele der zuletzt trainierten Einheiten angesehen werden.
 *
 * Der Name ist lang, weil es in js/supersatz.js schon ein FENSTER gibt (dort:
 * wie weit im Plan nach einem Partner gesucht wird). Im Ein-Datei-Bündel teilen
 * sich alle Module einen Gültigkeitsbereich – tools/pruefung/schichten.py hat
 * die Kollision beim ersten Bauen gemeldet.
 */
export const MUSTER_FENSTER = 8;

/**
 * Die zuletzt trainierten Einheiten, jüngste zuerst.
 *
 * „Trainiert" heißt: mindestens ein abgehakter Satz. Eine Einheit, in der
 * nichts steht, ist keine ausgelassene Übung, sondern ein ausgefallener Tag –
 * das ist ein anderes Thema und hat mit der Reihenfolge nichts zu tun.
 */
function letzteEinheiten(fenster = MUSTER_FENSTER) {
  const log = store.getState().log || {};
  const raus = [];
  for (let i = PLAN.length - 1; i >= 0 && raus.length < fenster; i--) {
    const w = PLAN[i];
    const e = log[w.n];
    if (!e || istCustom(w.n)) continue;
    const mode = e.mode || store.workoutMode(w.n);
    const gemacht = new Set();
    ['db', 'bw'].forEach((m) => {
      Object.entries(e[m] || {}).forEach(([id, arr]) => {
        if (Array.isArray(arr) && arr.some((s) => s && s.done)) gemacht.add(id);
      });
    });
    if (gemacht.size) raus.push({ w, mode, gemacht });
  }
  return raus;
}

/**
 * Übungen, die regelmäßig übergangen werden.
 *
 * Gezählt wird nur, wo die Übung an dem Tag auch vorgesehen war: Was der
 * Verletzungsfilter ohnehin herausgenommen hat, ist nicht ausgelassen.
 *
 * `mindestens` verhindert die Meldung nach einem einzigen schlechten Tag – und
 * die Hälfte als Anteil verhindert sie bei einer Übung, die in acht Einheiten
 * dreimal vorkam und einmal fehlte.
 */
export function ausgelassen({ fenster = MUSTER_FENSTER, mindestens = 3 } = {}) {
  const einheiten = letzteEinheiten(fenster);
  const zaehler = new Map();
  einheiten.forEach(({ w, mode, gemacht }) => {
    exOf(w, mode).forEach((it) => {
      const z = zaehler.get(it.id) || { dran: 0, weg: 0, name: null };
      z.dran += 1;
      if (!gemacht.has(it.id)) z.weg += 1;
      z.name = z.name || resolve(it, mode).name;
      zaehler.set(it.id, z);
    });
  });
  return [...zaehler.entries()]
    .filter(([, z]) => z.weg >= mindestens && z.weg * 2 >= z.dran)
    .map(([id, z]) => ({ id, name: z.name || (EX_BY_ID.get(id) || {}).id || id,
                         weg: z.weg, dran: z.dran }))
    .sort((a, b) => b.weg - a.weg || b.dran - a.dran);
}

/**
 * Bricht die Einheit regelmäßig an derselben Stelle ab?
 *
 * Gemessen an der Stelle der letzten Übung, an der noch etwas abgehakt wurde.
 * Liegt sie in mehr als der Hälfte der Fälle vor dem Ende, ist nicht eine Übung
 * das Problem, sondern die Länge – und dann hilft es nicht, eine davon nach vorn
 * zu holen.
 *
 * Gibt `null` zurück, solange es zu wenige Einheiten sind, um etwas zu sagen.
 * Vier ist die Untergrenze: Bei dreien wäre „zweimal von drei" schon ein Muster,
 * und das ist keins, das ist ein Wochenende.
 */
export function abbruch({ fenster = MUSTER_FENSTER } = {}) {
  const einheiten = letzteEinheiten(fenster);
  if (einheiten.length < 4) return null;
  const stellen = [];
  einheiten.forEach(({ w, mode, gemacht }) => {
    const liste = exOf(w, mode);
    let letzte = -1;
    liste.forEach((it, i) => { if (gemacht.has(it.id)) letzte = i; });
    if (letzte >= 0) stellen.push({ bis: letzte + 1, von: liste.length });
  });
  const kurz = stellen.filter((s) => s.bis < s.von);
  if (kurz.length * 2 <= stellen.length) return null;
  // Die typische Stelle: der Median, nicht der Mittelwert. Ein einzelner Tag,
  // an dem nach der ersten Übung das Telefon klingelte, soll die Zahl nicht
  // nach unten ziehen.
  const bis = kurz.map((s) => s.bis).sort((a, b) => a - b);
  return {
    einheiten: stellen.length,
    kurz: kurz.length,
    bis: bis[Math.floor(bis.length / 2)],
    von: Math.max(...kurz.map((s) => s.von)),
  };
}

/** Übungen, die von Hand nach vorn geholt wurden. */
export const vorneListe = () => store.getState().vorne || [];

/**
 * Eine Übung nach vorn holen oder wieder loslassen.
 *
 * Das kostet unter Umständen einen zusätzlichen Umbau – die Reihenfolge ist
 * sonst nach Gerät gebündelt. Es ist trotzdem richtig so: Eine Übung, die
 * regelmäßig ausfällt, bringt null Sätze, und ein zweiter Aufbau ist ein
 * billigerer Preis als eine Muskelgruppe, die seit einem Monat nichts bekommt.
 */
export function vorneUm(exId) {
  const liste = vorneListe();
  const drin = liste.includes(exId);
  store.setSetting('vorne', drin ? liste.filter((x) => x !== exId) : [...liste, exId]);
  return !drin;
}
