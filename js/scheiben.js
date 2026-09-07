/*
 * Was wirklich im Raum liegt – und welche Gewichte sich daraus bauen lassen.
 *
 * Die App hat Gewichte bisher gerechnet, als wäre jede Zahl aufsteckbar: Ein
 * Startgewicht mal dem Erfahrungsfaktor, auf die Schrittweite gerundet, fertig.
 * Das ergibt Vorschläge wie „Kurzhanteln auf 6 kg je Hand" – und dann steht man
 * mit einer 1,5-kg-Stange und Scheiben zu 1,25 und 2,5 davor und kommt auf 4
 * oder auf 6,5, aber nicht auf 6.
 *
 * Eine Zahl, die man nicht einstellen kann, ist keine Ansage, sondern eine
 * Hausaufgabe. Deshalb rechnet dieses Modul umgekehrt: erst aufzählen, was mit
 * dem vorhandenen Eisen überhaupt herauskommt, dann den Vorschlag darauf
 * einrasten.
 *
 * **Leer heißt: nicht raten.** Wer nichts einträgt, bekommt das alte Verhalten.
 * Ein erfundener Standardsatz wäre schlimmer als gar keiner: Er sähe aus wie
 * Wissen und wäre geraten.
 *
 * **Ein Vorrat, mehrere Stangen.** Scheiben liegen nicht bei einer Hantel, sie
 * liegen im Raum und passen überall drauf: *„Ich kann ja alle Scheiben überall
 * draufmachen."* Getrennte Listen je Gerät wären deshalb doppelte Arbeit und
 * zwei Gelegenheiten, sich zu verzählen. Gespeichert wird ein Vorrat; getrennt
 * sind nur die Leergewichte der Stangen.
 *
 * Gerechnet wird je Gerät so, als wäre die andere Stange leer. Das deckt sich
 * mit dem, was man tut: eine abbauen, die andere aufbauen.
 *
 * **Wie geladen wird, hängt am Gerät, nicht am Gewicht.**
 *   - Langhantel: Scheiben paarweise, eine je Seite. Ein Paar zu 2,5 kg macht
 *     5 kg auf der Stange.
 *   - Kurzhanteln, beide Hände: derselbe Aufbau zweimal. Für 2,5 kg mehr *je
 *     Hand* braucht es **vier** Scheiben zu 1,25 – nicht zwei. Wer von einer
 *     Größe nur zwei hat, kann damit kein Paar bestücken; dann bleibt es bei
 *     der leeren Stange, und die Vorschau sagt genau das, statt "0 kg"
 *     hinzuschreiben und den Leser rätseln zu lassen.
 *   - Eine Kurzhantel (Goblet, einarmiges Rudern): zwei Scheiben je Stufe.
 *   - Scheibe auf der Brust: die Scheibe selbst, einzeln.
 *   - Rucksack: hier wird bewusst nicht gerastet. In einen Rucksack passt auch
 *     eine Wasserflasche; ein Raster würde Genauigkeit vortäuschen.
 */

import { fmtNum } from './text.js';

/**
 * Je Gerät: an welcher Stange es hängt, wie viele Scheiben eine Stufe kostet
 * (`pro`) und wie viel eine Stufe bringt (`faktor`).
 *
 * Bei beiden Kurzhanteln fallen die auseinander: vier Scheiben für zwei Kilo
 * mehr je Hand. Genau dieser Unterschied ist der Grund, warum ein einzelner
 * „Schritt" je nach Übung etwas anderes bedeutet.
 */
export const RASTER = {
  barbell: { stange: 'lh', pro: 2, faktor: 2 },
  hipbar: { stange: 'lh', pro: 2, faktor: 2 },
  dumbbells: { stange: 'kh', pro: 4, faktor: 2 },
  goblet: { stange: 'kh', pro: 2, faktor: 2 },
  onehand: { stange: 'kh', pro: 2, faktor: 2 },
  plate: { stange: null, pro: 1, faktor: 1 },
};

export const STANGE_LABEL = { kh: 'Kurzhantelstange (eine)', lh: 'Langhantel' };

/** Ein leerer Satz – nichts eingetragen, also rastet nichts. */
export const leererSatz = () => ({ stange: { kh: null, lh: null }, scheiben: [] });

/**
 * Einen gespeicherten Satz auf eine brauchbare Form bringen.
 *
 * Die Werte kommen aus Eingabefeldern und aus alten Ständen; hier wird alles
 * abgefangen, womit die Aufzählung sonst entgleist: Text statt Zahl, negative
 * Scheiben, doppelte Größen, eine Null als Scheibengewicht (die brächte eine
 * unendliche Zahl von Stufen, die alle dasselbe wiegen).
 *
 * Die erste Fassung hatte zwei getrennte Scheibenlisten, eine je Stange. Wer so
 * einen Stand schon eingetippt hat, soll ihn nicht noch einmal eintippen: Die
 * beiden Listen werden zusammengelegt, je Größe die größere Stückzahl.
 */
export function normSatz(roh) {
  const out = leererSatz();
  if (!roh || typeof roh !== 'object') return out;

  // null ist nicht 0. Number(null) wäre 0 gewesen – und damit hätte sich
  // „noch nicht eingetragen" nicht mehr von „zählt bewusst nicht mit"
  // unterscheiden lassen. Beides gibt es, und die App sagt Verschiedenes dazu.
  const zahl = (v) => {
    if (v === null || v === undefined || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? Math.round(n * 4) / 4 : null;
  };
  const alt = !!(roh.lh && typeof roh.lh === 'object' && 'scheiben' in roh.lh);
  const stangen = alt
    ? { kh: roh.kh && roh.kh.stange, lh: roh.lh.stange }
    : (roh.stange && typeof roh.stange === 'object' ? roh.stange : {});
  out.stange.kh = zahl(stangen.kh);
  out.stange.lh = zahl(stangen.lh);

  const quellen = alt ? [roh.kh && roh.kh.scheiben, roh.lh.scheiben] : [roh.scheiben];
  const groessen = new Map();
  quellen.forEach((liste) => {
    (Array.isArray(liste) ? liste : []).forEach((z) => {
      if (!Array.isArray(z)) return;
      const kg = zahl(z[0]);
      const n = Math.floor(Number(z[1]));
      if (!kg || !Number.isFinite(n) || n <= 0) return;
      groessen.set(kg, Math.max(groessen.get(kg) || 0, Math.min(n, 40)));
    });
  });
  out.scheiben = [...groessen.entries()].sort((a, b) => a[0] - b[0]).slice(0, 10);
  return out;
}

/** Ist für dieses Gerät überhaupt etwas eingetragen? */
export function gepflegt(equip, satz) {
  return !!(RASTER[equip] && satz && Array.isArray(satz.scheiben) && satz.scheiben.length);
}

/** Das Leergewicht der Stange, an der dieses Gerät hängt. */
const basisVon = (r, satz) => (r.stange ? (satz.stange[r.stange] || 0) : 0);

/**
 * Alle Gewichte, die sich mit dem vorhandenen Eisen einstellen lassen.
 *
 * Aufgezählt wird über die Scheibengrößen; nach jeder Größe wird zusammen-
 * gefasst, sonst wächst die Liste exponentiell, obwohl viele Kombinationen
 * dasselbe wiegen (zwei 1,25er sind ein 2,5er).
 *
 * Gibt null zurück, wenn nichts eingetragen ist – der Unterschied zu einer
 * leeren Liste ist wichtig: „weiß ich nicht" ist nicht „geht nichts".
 */
export function erreichbar(equip, satz) {
  const r = RASTER[equip];
  if (!r || !gepflegt(equip, satz)) return null;
  const basis = basisVon(r, satz);
  let summen = new Set([0]);
  satz.scheiben.forEach(([kg, anzahl]) => {
    const maxK = Math.floor(anzahl / r.pro);
    if (maxK <= 0) return;
    const naechste = new Set();
    summen.forEach((vor) => {
      for (let k = 0; k <= maxK; k++) naechste.add(Math.round((vor + r.faktor * k * kg) * 4) / 4);
    });
    summen = naechste;
  });
  return [...summen].map((x) => Math.round((basis + x) * 4) / 4).sort((a, b) => a - b);
}

/**
 * Den nächsten wirklich einstellbaren Wert zu `kg`.
 *
 * Bei genau gleichem Abstand nach unten: Lieber ein halbes Kilo zu leicht als
 * ein halbes zu schwer – das ist die Richtung, in die ein Satz noch aufgeht.
 */
export function raste(kg, equip, satz) {
  const liste = erreichbar(equip, satz);
  if (!liste || !liste.length) return null;
  let beste = liste[0];
  liste.forEach((w) => {
    const d = Math.abs(w - kg) - Math.abs(beste - kg);
    if (d < -1e-9 || (Math.abs(d) < 1e-9 && w < beste)) beste = w;
  });
  return beste;
}

/**
 * Ein Schritt nach oben oder unten – aber auf dem Raster, nicht auf der
 * Wunschschrittweite.
 *
 * `mindestens` ist die Schrittweite der Übung: Wer 2,5 kg draufpacken will,
 * soll nicht bei 0,25 landen, nur weil zufällig eine Kleinscheibe passt.
 * Gibt es nichts in dieser Größenordnung, wird der nächste erreichbare Wert
 * genommen – ein kleiner Sprung ist besser als gar keiner.
 */
export function nachbar(kg, richtung, equip, satz, mindestens = 0) {
  const liste = erreichbar(equip, satz);
  if (!liste || !liste.length) return null;
  const hoch = richtung > 0;
  const passend = liste.filter((w) => (hoch ? w >= kg + mindestens - 1e-9 : w <= kg - mindestens + 1e-9));
  if (passend.length) return hoch ? passend[0] : passend[passend.length - 1];
  const naechste = liste.filter((w) => (hoch ? w > kg + 1e-9 : w < kg - 1e-9));
  if (naechste.length) return hoch ? naechste[0] : naechste[naechste.length - 1];
  return null;   // schon am Ende dessen, was da ist
}

/**
 * Womit dieses Gewicht zu laden ist – mit möglichst wenig Scheiben.
 *
 * Wenig Scheiben ist nicht Kosmetik: Jede Scheibe ist ein Verschluss auf und
 * zu. Gesucht wird deshalb über alle Kombinationen die mit der kleinsten
 * Scheibenzahl, nicht die erstbeste. Der Suchraum ist klein genug dafür –
 * höchstens acht Größen mit je einer Handvoll Stufen.
 */
export function belegung(kg, equip, satz) {
  const r = RASTER[equip];
  if (!r || !gepflegt(equip, satz)) return null;
  const ziel = Math.round((kg - basisVon(r, satz)) * 4) / 4;
  if (ziel < -1e-9) return null;

  let beste = null;
  const suche = (i, rest, wahl, stueck) => {
    if (beste && stueck >= beste.stueck) return;      // schon schlechter als das Beste
    if (Math.abs(rest) < 1e-9) { beste = { wahl: wahl.slice(), stueck }; return; }
    if (i >= satz.scheiben.length || rest < -1e-9) return;
    const [w, anzahl] = satz.scheiben[i];
    const maxK = Math.min(Math.floor(anzahl / r.pro), Math.floor((rest + 1e-9) / (r.faktor * w)));
    for (let k = maxK; k >= 0; k--) {
      if (k) wahl.push([w, k]);
      suche(i + 1, Math.round((rest - r.faktor * k * w) * 4) / 4, wahl, stueck + k);
      if (k) wahl.pop();
    }
  };
  suche(0, ziel, [], 0);
  return beste ? beste.wahl.sort((a, b) => b[0] - a[0]) : null;
}

/** Die Belegung als Satz, wie man ihn jemandem zurufen würde. */
export function belegungText(kg, equip, satz) {
  const b = belegung(kg, equip, satz);
  if (!b) return '';
  const r = RASTER[equip];
  if (!b.length) {
    if (!r.stange) return '';
    // Zählt die Stange nicht mit (Leergewicht 0), ist „leere Stange" als
    // Ansage sinnlos – dann ist die Aussage: gar nichts drauf.
    const leer = (satz.stange[r.stange] || 0) === 0;
    return leer ? 'ohne Scheiben' : 'leere Stange';
  }
  const teile = b.map(([w, k]) => `${k}× ${fmtNum(w)}`).join(' + ');
  // „je Seite" gilt überall dort, wo Scheiben auf eine Stange gehen – bei
  // beiden Kurzhanteln je Seite *jeder* Hantel, also viermal die Zahl.
  if (equip === 'dumbbells') return `je Seite ${teile} kg (beide Hanteln)`;
  if (r.faktor === 2) return `je Seite ${teile} kg`;
  return `${teile} kg`;
}
