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
 * **Eine Zahl an einer Übung ist Scheibengewicht, nicht Gesamtgewicht.** Das ist
 * die Rechnung, die hier gilt, und sie ist eine Ansage:
 *
 *     „Wenn bei ner Übung aber 4kg steht mein ich damit 4kg Scheibengewicht
 *      gesamt. Da will ich nicht jedesmal die Stange mit zurechnen und so."
 *
 * Deshalb wiegt eine Stange, deren Leergewicht niemand eingetragen hat, für die
 * Rechnung null – und das ist kein Versäumnis, sondern der Normalfall. Es wird
 * auch nichts angemahnt.
 *
 * Ein Zwischenstand hat hier einmal geschätzt (Kurzhantelstange 2 kg, SZ 5,5,
 * Langhantel 8) und ist auf dieselbe Ansage hin wieder ausgebaut worden. Der
 * Fehler war nicht die Schätzung, sondern die Annahme dahinter: dass die Zahl
 * an einer Übung das Gesamtgewicht meint. Tut sie nicht.
 *
 * Wer es anders will, trägt die Leergewichte ein; dann zählen sie mit, und alle
 * Vorschläge sind Gesamtgewichte. Beides geht, die Vorgabe ist Scheibengewicht.
 *
 * Was das kostet, damit es nicht später jemand als Fehler entdeckt: Das Volumen
 * in der Statistik ist um das Stangengewicht mal Wiederholungen zu niedrig, und
 * mit fremden Zahlen sind diese hier nicht vergleichbar. Für den Verlauf über
 * die Zeit – und darum geht es – macht es nichts: Ein konstanter Sockel ändert
 * an einer Steigerung nichts.
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
  // Die SZ-Stange lädt wie eine Langhantel, wiegt leer aber anders – meist 6
  // bis 10 kg statt 10 bis 20. *„Ich hab auch ne sz Stange."* Vorher liefen die
  // Curls und die Trizepsstrecker über 'lh' und bekamen damit das Leergewicht
  // der grossen Stange aufgerechnet; bei 20 kg Langhantel und 7 kg SZ waren
  // alle Vorschläge um 13 kg zu schwer.
  szbar: { stange: 'sz', pro: 2, faktor: 2 },
  dumbbells: { stange: 'kh', pro: 4, faktor: 2 },
  goblet: { stange: 'kh', pro: 2, faktor: 2 },
  onehand: { stange: 'kh', pro: 2, faktor: 2 },
  plate: { stange: null, pro: 1, faktor: 1 },
};

export const STANGE_LABEL = {
  kh: 'Kurzhantelstange (eine)', sz: 'SZ-Stange', lh: 'Langhantel',
};

/**
 * Wiegt bei dieser Rechnung eine Stange überhaupt mit?
 *
 * Nur, wenn jemand ein Leergewicht eingetragen hat. Leer heißt Scheibengewicht –
 * siehe oben. Gebraucht wird das für die eine Zeile, die dem Leser sagt, welche
 * der beiden Rechnungen er gerade vor sich hat.
 */
export const stangeZaehlt = (satz, equip) => {
  const r = RASTER[equip];
  if (!r || !r.stange || !satz || !satz.stange) return false;
  return typeof satz.stange[r.stange] === 'number' && satz.stange[r.stange] > 0;
};

/** Ein leerer Satz – nichts eingetragen, also rastet nichts. */
export const leererSatz = () => ({
  stange: Object.fromEntries(Object.keys(STANGE_LABEL).map((k) => [k, null])),
  scheiben: [],
});

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
  Object.keys(STANGE_LABEL).forEach((k) => { out.stange[k] = zahl(stangen[k]); });

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

/**
 * Das Leergewicht der Stange, an der dieses Gerät hängt.
 *
 * Nicht eingetragen ist null, und null ist hier richtig: Die Zahl an einer Übung
 * meint Scheibengewicht (siehe Kopf). Wer Gesamtgewichte will, trägt die
 * Leergewichte ein – dann stehen sie hier und zählen mit.
 */
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
  // Eine einzige Möglichkeit ist kein Raster, sondern ein Mangel – und zwar
  // einer, der sich stillschweigend auf jedes Gewicht legt.
  //
  // Nachgemessen an einem echten Satz: 0,5 / 1,25 / 2 / 2,5 / 4 / 5 / 10 / 20,
  // von jeder Größe zwei Stück. Für *beide* Kurzhanteln braucht eine Stufe vier
  // Scheiben derselben Größe (zwei je Hantel) – davon gibt es hier keine
  // einzige. Erreichbar ist also nur die leere Stange, und raste() schnappte
  // daraufhin **jedes** Gewicht darauf: aus 12 kg Schulterdrücken wurden 0.
  // Die App hätte behauptet, er könne nichts heben.
  //
  // Wo nichts zu wählen ist, wird nicht gerastet. Dann rechnet die App weiter
  // in freien Schritten wie ohne Eintrag – und die Vorschau unter Mehr sagt,
  // woran es liegt, statt eine 0 hinzuschreiben.
  if (!liste || liste.length <= 1) return null;
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
  // Dieselbe Bremse wie in raste(): Mit nur einer Möglichkeit gäbe es keinen
  // Schritt nach oben, und der +-Knopf stünde für immer auf „kein weiterer
  // Schritt" – obwohl es an vier fehlenden Scheiben liegt, nicht am Training.
  if (!liste || liste.length <= 1) return null;
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

/**
 * Lassen sich diese Aufbauten *gleichzeitig* bestücken – aus einem Vorrat?
 *
 *     „Goblet squad und Floor Press geht nicht im suoersatz weil man für
 *      beides 5kg Scheiben brauch"
 *
 * Alles andere hier rechnet so, als wäre die andere Stange leer (siehe Kopf):
 * eine abbauen, die andere aufbauen. Im Supersatz bleiben aber *beide* stehen –
 * das ist der ganze Sinn. Dann müssen die Scheiben für beide zugleich da sein,
 * und zwei verschiedene Stangen helfen nichts, wenn beide dieselben zwei
 * 5er brauchen.
 *
 * `lasten` ist eine Liste von [Gerät, kg]. Gefragt ist, ob es *irgendeine*
 * Aufteilung gibt – nicht nur die mit den wenigsten Scheiben, denn mit
 * kleineren Scheiben geht es vielleicht doch.
 *
 * **Warum nicht einfach alles aufzählen.** Die erste Fassung zählte alle
 * Belegungen des ersten Aufbaus auf und prüfte für jede den Rest. Mit einem
 * Heimsatz sind das ein paar Millisekunden; scheitert das Paar aber bei einem
 * großen Vorrat, wurde der ganze Suchraum abgearbeitet – gemessen 25 s für
 * 6 Größen zu je 20 Stück, im Hauptthread, bei jedem Neuzeichnen (gefunden bei
 * der Durchsicht). Dabei hängt alles Weitere nur daran, bei welcher Größe man
 * steht und wie viel jedem Aufbau noch fehlt – nicht daran, womit der Rest
 * erreicht wurde. Gesucht wird deshalb Größe für Größe, mit drei Abkürzungen:
 *
 *   - Ein Zwischenstand, der schon einmal gescheitert ist, scheitert wieder.
 *   - Was ein Aufbau *allein* mit den restlichen Größen nicht mehr schafft,
 *     schafft er mit einem Partner erst recht nicht (`allein` unten).
 *   - Was zusammen mehr Eisen braucht, als noch daliegt, geht nicht.
 *
 * Gerundet wird Schritt für Schritt wie vorher; die Antwort ist dieselbe, nur
 * ohne Aufzählung. Bleibt es trotzdem zu viel, gibt es null statt einer
 * eingefrorenen App: lieber „weiß ich nicht" als eine Antwort, auf die man
 * wartet.
 *
 * null, wenn nichts eingetragen ist: „weiß ich nicht" ist nicht „geht nicht".
 */
const ZUSAMMEN_BUDGET = 100000;   // Zwischenstände, bevor aufgegeben wird

/**
 * Was zusammen() und zusammenBelegung() gemeinsam vorrechnen – oder null, wenn
 * nichts eingetragen ist, und 'allein', wenn sich ein Gewicht schon für sich
 * nicht bauen lässt.
 */
function vorrechnen(lasten, satz) {
  if (!satz || !Array.isArray(satz.scheiben) || !satz.scheiben.length) return null;
  const offen = lasten.filter(([equip]) => RASTER[equip]);
  const rs = offen.map(([equip]) => RASTER[equip]);
  const v = satz.scheiben;
  const n = v.length;
  // Gerechnet wird in Viertelkilo: Nach jedem Schritt wird darauf gerundet,
  // also liegt jeder Fehlbetrag auf diesem Raster und taugt als Index.
  const ziele = offen.map(([, kg], i) => {
    const ziel = Math.round(((kg || 0) - basisVon(rs[i], satz)) * 4);
    return ziel < 1 ? 0 : ziel;
  });
  // Eine Stufe mehr: Fehlbetrag danach, gerundet wie in belegung().
  const nach = (q, r, k, w) => (k ? Math.round((q / 4 - r.faktor * k * w) * 4) : q);
  const stufen = (q, r, frei, w) => (q === 0 ? 0
    : Math.min(Math.floor(frei / r.pro), Math.floor((q / 4 + 1e-9) / (r.faktor * w))));

  // allein[i][j][q]: Schafft Aufbau i den Fehlbetrag q mit den Größen ab j,
  // wenn ihm keiner etwas wegnimmt?
  const allein = offen.map((_, i) => {
    const r = rs[i];
    const tab = Array.from({ length: n + 1 }, () => new Uint8Array(ziele[i] + 1));
    tab[n][0] = 1;
    for (let j = n - 1; j >= 0; j--) {
      const [w, anzahl] = v[j];
      for (let q = 0; q <= ziele[i]; q++) {
        for (let k = stufen(q, r, anzahl, w); k >= 0 && !tab[j][q]; k--) {
          if (tab[j + 1][nach(q, r, k, w)]) tab[j][q] = 1;
        }
      }
    }
    return tab;
  });
  // Ein Gewicht, das sich schon allein nicht bauen lässt, ist kein Konflikt
  // zwischen den beiden – das ist die Sache von raste() und der Vorschau.
  // (Dieselbe Frage wie belegung() !== null.)
  if (ziele.some((z, i) => !allein[i][0][z])) return 'allein';

  // Wie viel Eisen ab Größe j noch daliegt, in Viertelkilo. Nur bei Scheiben
  // auf dem Viertelkilo-Raster (normSatz() sorgt dafür) ist das ohne Rundung.
  const exakt = v.every(([w]) => Number.isInteger(w * 4));
  const eisen = new Array(n + 1).fill(0);
  for (let j = n - 1; j >= 0; j--) eisen[j] = eisen[j + 1] + v[j][1] * v[j][0] * 4;
  // Hoffnungslos ab Größe j: ein Aufbau, der allein nicht mehr hinkommt, oder
  // zusammen mehr Eisen, als noch daliegt. Ein Aufbau verbraucht je Kilo, das
  // er trägt, pro/faktor Kilo Scheiben.
  const aussichtslos = (j, qs) => j >= n || qs.some((q, i) => !allein[i][j][q])
    || (exakt && qs.reduce((s, q, i) => s + q * rs[i].pro / rs[i].faktor, 0) > eisen[j]);
  return { offen, rs, v, ziele, nach, stufen, aussichtslos };
}

export function zusammen(lasten, satz) {
  const p = vorrechnen(lasten, satz);
  if (!p || p === 'allein') return null;
  const { rs, v, ziele, nach, stufen, aussichtslos } = p;

  const gescheitert = new Set();
  let schritte = 0;
  const geht = (j, qs) => {
    if (qs.every((q) => q === 0)) return true;
    if (aussichtslos(j, qs)) return false;
    const key = `${j}|${qs.join(',')}`;
    if (gescheitert.has(key)) return false;
    if (++schritte > ZUSAMMEN_BUDGET) return false;   // aufgegeben, s. u.
    const [w, anzahl] = v[j];
    const neu = qs.slice();
    // Der erste greift zuerst zu, die nächsten nehmen, was übrig bleibt.
    const verteile = (i, frei) => {
      if (i >= qs.length) return geht(j + 1, neu.slice());
      for (let k = stufen(qs[i], rs[i], frei, w); k >= 0; k--) {
        neu[i] = nach(qs[i], rs[i], k, w);
        if (verteile(i + 1, frei - k * rs[i].pro)) return true;
      }
      return false;
    };
    if (verteile(0, anzahl)) return true;
    gescheitert.add(key);
    return false;
  };
  // Ein Weg, der gefunden wurde, gilt – auch nach dem Aufgeben. Ein „nein"
  // nach dem Aufgeben ist aber keins.
  if (geht(0, ziele)) return true;
  return schritte > ZUSAMMEN_BUDGET ? null : false;
}

/**
 * Nicht nur ob, sondern womit: die Belegung für alle Aufbauten zugleich.
 *
 * Gefunden auf dem Weg durch die App: Floor Press 40 kg und Gewichtete Crunches
 * 5 kg bei 4× 1,25 / 4× 2,5 / 4× 5 / 2× 10. zusammen() sagt ja – je Seite
 * 10 + 5 + 2,5 + 2,5, dann bleiben zwei 5er für die Brust. Die Rüstzeile
 * rechnete aber jede Übung für sich und schrieb beim Floor Press „je Seite
 * 1× 10 + 2× 5 kg": alle vier 5er auf der Stange, und beim Crunch stand
 * „1× 5 kg" – eine Scheibe, die nach der eigenen Anweisung nicht mehr daliegt.
 * Ein „es geht" nützt nichts, wenn die Anweisung danach einen anderen Weg
 * beschreibt.
 *
 * Gibt je Eintrag von `lasten` die Belegung zurück, in der Form von
 * belegung() – null für Geräte ohne Raster (Rucksack). Gesucht wird die mit den
 * wenigsten Scheiben *insgesamt*, gezählt wie sie in der Hand liegen (bei
 * beiden Kurzhanteln vier je Stufe). Passen die Belegungen, die jede Übung für
 * sich bekäme, ohnehin nebeneinander, bleiben es genau die: Dann ändert sich an
 * der Anzeige nichts. Bei gleich vielen Scheiben gewinnt die zuerst gefundene,
 * und gesucht wird immer in derselben Reihenfolge – dieselbe Frage gibt
 * dieselbe Antwort.
 *
 * null, wenn es keine gemeinsame gibt, wenn nichts eingetragen ist oder wenn
 * die Suche zu lang würde – dann rechnet die Anzeige wie vorher je Übung.
 */
export function zusammenBelegung(lasten, satz) {
  const p = vorrechnen(lasten, satz);
  if (!p || p === 'allein') return null;
  const { offen, rs, v, ziele, nach, stufen, aussichtslos } = p;
  const zurueck = (wahlen) => {
    let x = 0;
    return lasten.map(([equip]) => (RASTER[equip] ? wahlen[x++] : null));
  };

  // Zuerst die Belegungen für sich: Liegen sie zusammen im Vorrat, gelten die.
  const fuerSich = offen.map(([equip, kg], i) => (ziele[i] ? belegung(kg, equip, satz) : []));
  if (fuerSich.every(Boolean)) {
    const braucht = new Map();
    fuerSich.forEach((b, i) => b.forEach(([w, k]) => braucht.set(w, (braucht.get(w) || 0) + k * rs[i].pro)));
    if (v.every(([w, anzahl]) => (braucht.get(w) || 0) <= anzahl)) return zurueck(fuerSich);
  }

  // Sonst die gemeinsame mit den wenigsten Scheiben. Was ab Größe j noch zu
  // tun ist, hängt nur an j und den Fehlbeträgen – das Beste dafür wird gemerkt.
  const gemerkt = new Map();
  let schritte = 0;
  const bestes = (j, qs) => {
    if (qs.every((q) => q === 0)) return { stueck: 0, wahl: [] };
    if (aussichtslos(j, qs)) return null;
    const key = `${j}|${qs.join(',')}`;
    if (gemerkt.has(key)) return gemerkt.get(key);
    if (++schritte > ZUSAMMEN_BUDGET) return null;
    const [w, anzahl] = v[j];
    const neu = qs.slice();
    const ks = qs.map(() => 0);
    let sieger = null;
    const verteile = (i, frei) => {
      if (i >= qs.length) {
        const rest = bestes(j + 1, neu.slice());
        if (!rest) return;
        const stueck = rest.stueck + ks.reduce((s, k, x) => s + k * rs[x].pro, 0);
        if (sieger && stueck >= sieger.stueck) return;
        const hier = ks.flatMap((k, x) => (k ? [[x, w, k]] : []));
        sieger = { stueck, wahl: hier.concat(rest.wahl) };
        return;
      }
      for (let k = stufen(qs[i], rs[i], frei, w); k >= 0; k--) {
        neu[i] = nach(qs[i], rs[i], k, w);
        ks[i] = k;
        verteile(i + 1, frei - k * rs[i].pro);
      }
      neu[i] = qs[i];
      ks[i] = 0;
    };
    verteile(0, anzahl);
    gemerkt.set(key, sieger);
    return sieger;
  };
  const b = bestes(0, ziele);
  if (!b || schritte > ZUSAMMEN_BUDGET) return null;
  const wahlen = offen.map(() => []);
  b.wahl.forEach(([x, w, k]) => wahlen[x].push([w, k]));
  return zurueck(wahlen.map((wahl) => wahl.sort((a, c) => c[0] - a[0])));
}

/**
 * Eine Belegung als Satz, wie man ihn jemandem zurufen würde.
 *
 * Getrennt von der Suche, weil sie nicht immer von belegung() kommt: Im
 * Supersatz gilt die gemeinsame aus zusammenBelegung().
 */
export function belegungAlsText(b, equip, satz) {
  if (!b) return '';
  const r = RASTER[equip];
  if (!b.length) {
    if (!r.stange) return '';
    // Zählt die Stange nicht mit (Leergewicht 0 oder gar nicht eingetragen),
    // ist „leere Stange" als Ansage sinnlos – dann ist die Aussage: gar nichts
    // drauf.
    const leer = basisVon(r, satz) === 0;
    return leer ? 'ohne Scheiben' : 'leere Stange';
  }
  const teile = b.map(([w, k]) => `${k}× ${fmtNum(w)}`).join(' + ');
  // „je Seite" gilt überall dort, wo Scheiben auf eine Stange gehen – bei
  // beiden Kurzhanteln je Seite *jeder* Hantel, also viermal die Zahl.
  if (equip === 'dumbbells') return `je Seite ${teile} kg (beide Hanteln)`;
  if (r.faktor === 2) return `je Seite ${teile} kg`;
  return `${teile} kg`;
}

/** Die Belegung mit den wenigsten Scheiben als Satz. */
export function belegungText(kg, equip, satz) {
  return belegungAlsText(belegung(kg, equip, satz), equip, satz);
}
