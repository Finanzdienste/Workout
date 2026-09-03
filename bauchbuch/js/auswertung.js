/*
 * Die Rechenschicht: aus Eintragungen Muster machen.
 *
 * Reine Funktionen, keine Anzeige, kein Speicherzugriff – alles kommt als
 * Argument herein. Das ist nicht Ordnungsliebe: Diese Datei ist der einzige
 * Ort, an dem die App etwas *behauptet*, und Behauptungen über den eigenen
 * Körper muss man einzeln nachrechnen können. Genau das tut tests/rechnen.mjs.
 *
 * Die Grundfrage lautet immer gleich: Geht es nach Mahlzeiten mit einem
 * bestimmten Merkmal schlechter als nach Mahlzeiten ohne? Verglichen wird
 * also nicht gegen Null, sondern gegen den eigenen Alltag. Ohne diesen
 * Vergleich fände man bei jedem Menschen mit täglichen Beschwerden jedes
 * Lebensmittel „auffällig", das er täglich isst.
 *
 * Drei Regeln, die verhindern, dass daraus Kaffeesatzleserei wird:
 *
 *   1. Mindestens `mindestFaelle` Mahlzeiten *mit* dem Merkmal und ebenso
 *      viele *ohne*. Aus drei Fällen wird hier keine Aussage.
 *   2. Die Fallzahl steht immer daneben, auch wenn sie unbequem ist.
 *   3. Es heißt „auffällig", nicht „verursacht". Was hier herauskommt, ist
 *      ein Anhaltspunkt fürs Gespräch beim Arzt, keine Diagnose.
 */
import { plusTage, tageDazwischen, tageszeit, TAGESZEIT_NAME, zeitpunkt, stundenDazwischen } from './datum.js';
import { ALLE_AUSLOESER } from './daten.js';

/** Späte Mahlzeit ab dieser Stunde – siehe UMSTAENDE in js/daten.js. */
const SPAET_AB = 20;

/**
 * Alle Merkmale einer Mahlzeit: angekreuzte Auslöser plus die beiden
 * Umstände, die sich aus Portion und Uhrzeit von selbst ergeben.
 */
export function merkmale(eintrag) {
  if (eintrag.art !== 'essen') return [];
  const raus = Array.isArray(eintrag.tags) ? [...eintrag.tags] : [];
  if (eintrag.portion === 'gross') raus.push('gross');
  const std = Number(String(eintrag.um || '').split(':')[0]);
  if (Number.isFinite(std) && std >= SPAET_AB) raus.push('spaet');
  return [...new Set(raus)];
}

/**
 * Die Beschwerden, die einer Mahlzeit im Zeitfenster folgen.
 *
 * `> 0` und nicht `>= 0`: Eine Beschwerde, die zur selben Minute eingetragen
 * ist wie die Mahlzeit, war schon da. Sie der Mahlzeit zuzurechnen hieße, die
 * Ursache nach der Wirkung zu suchen.
 */
export function folgende(eintraege, mahlzeit, fensterStunden) {
  const t0 = zeitpunkt(mahlzeit.am, mahlzeit.um);
  return eintraege.filter((e) => {
    if (e.art !== 'beschwerde') return false;
    const abstand = stundenDazwischen(t0, zeitpunkt(e.am, e.um));
    return abstand > 0 && abstand <= fensterStunden;
  });
}

/** Die stärkste Beschwerde im Fenster, oder 0, wenn keine kam. */
export function wertNach(eintraege, mahlzeit, fensterStunden) {
  const nach = folgende(eintraege, mahlzeit, fensterStunden);
  return nach.reduce((m, e) => Math.max(m, Number(e.staerke) || 0), 0);
}

/**
 * Die Bilanz je Auslöser.
 *
 * Ein Auslöser taucht nur auf, wenn er überhaupt vorkommt. Ob genug Fälle
 * beisammen sind, sagt `genug` – die Zeile wird trotzdem geliefert, denn „noch
 * 2 Mahlzeiten, dann kann ich etwas dazu sagen" ist eine nützliche Auskunft.
 *
 * @param {object[]} eintraege  alle Eintragungen
 * @param {{fenster: number, mindestFaelle: number, eigene: object[]}} opt
 */
export function ausloeserBilanz(eintraege, opt = {}) {
  const fenster = opt.fenster || 4;
  const mindest = opt.mindestFaelle || 5;
  const mahlzeiten = eintraege.filter((e) => e.art === 'essen');
  if (!mahlzeiten.length) return [];

  // Einmal für alle Mahlzeiten rechnen, nicht je Auslöser neu: Bei einem Jahr
  // Tagebuch und zwei Dutzend Auslösern wäre das sonst das Quadrat davon.
  const bewertet = mahlzeiten.map((m) => ({
    m,
    merkmale: new Set(merkmale(m)),
    wert: wertNach(eintraege, m, fenster),
  }));

  const bekannt = new Set(ALLE_AUSLOESER.map((a) => a.id));
  (opt.eigene || []).forEach((a) => bekannt.add(a.id));
  // Auch Auslöser zählen, die nur in alten Eintragungen stehen – etwa ein
  // eigener, den jemand später aus der Auswahl entfernt hat.
  bewertet.forEach((b) => b.merkmale.forEach((id) => bekannt.add(id)));

  const zeilen = [];
  bekannt.forEach((id) => {
    const mit = bewertet.filter((b) => b.merkmale.has(id));
    if (!mit.length) return;
    const ohne = bewertet.filter((b) => !b.merkmale.has(id));
    const schnitt = (liste) => (liste.length
      ? liste.reduce((s, b) => s + b.wert, 0) / liste.length : 0);
    const quote = (liste) => (liste.length
      ? liste.filter((b) => b.wert > 0).length / liste.length : 0);
    const schnittMit = schnitt(mit);
    const schnittOhne = schnitt(ohne);
    zeilen.push({
      id,
      faelle: mit.length,
      gegenFaelle: ohne.length,
      schnittMit,
      schnittOhne,
      differenz: schnittMit - schnittOhne,
      quoteMit: quote(mit),
      quoteOhne: quote(ohne),
      genug: mit.length >= mindest && ohne.length >= mindest,
      fehlt: Math.max(0, mindest - mit.length),
      zuletzt: mit[mit.length - 1].m.am,
    });
  });

  // Auffälligstes zuerst; bei gleicher Differenz die größere Fallzahl, weil
  // sie mehr wert ist.
  return zeilen.sort((a, b) => (b.differenz - a.differenz) || (b.faelle - a.faelle));
}

/**
 * Wie ein Ergebnis zu lesen ist. Eine halbe Stufe Unterschied ist Rauschen,
 * und es als Fund darzustellen wäre die eine Art, mit der so eine App
 * tatsächlich schaden kann: Wer daraufhin ein Lebensmittel streicht, isst
 * einseitiger, ohne dass es ihm besser geht.
 */
export function einstufung(zeile) {
  if (!zeile.genug) return 'zuwenig';
  if (zeile.differenz >= 2) return 'auffaellig';
  if (zeile.differenz >= 1) return 'moeglich';
  if (zeile.differenz <= -1) return 'unauffaellig';
  return 'neutral';
}

export const EINSTUFUNG_WORT = {
  auffaellig: 'auffällig',
  moeglich: 'möglicherweise',
  neutral: 'kein Unterschied',
  unauffaellig: 'eher unauffällig',
  zuwenig: 'zu wenige Fälle',
};

/* ---------- Verlauf ---------- */

/**
 * Der Tageswert: die stärkste Beschwerde des Tages.
 *
 * `notiert` unterscheidet den beschwerdefreien Tag vom Tag ohne Eintrag. Für
 * die Auswertung ist das der wichtigste Unterschied überhaupt – aus einer
 * Lücke im Tagebuch einen guten Tag zu machen, verschiebt jede Statistik nach
 * unten, und zwar genau in den Wochen, in denen es jemandem zu schlecht ging,
 * um etwas einzutragen.
 */
export function tagesWert(eintraege, iso, tage = {}) {
  const amTag = eintraege.filter((e) => e.am === iso);
  const beschwerden = amTag.filter((e) => e.art === 'beschwerde');
  const notiert = amTag.length > 0 || !!tage[iso];
  const max = beschwerden.reduce((m, e) => Math.max(m, Number(e.staerke) || 0), 0);
  const summe = beschwerden.reduce((s, e) => s + (Number(e.staerke) || 0), 0);
  return {
    am: iso,
    notiert,
    wert: max,
    schnitt: beschwerden.length ? summe / beschwerden.length : 0,
    anzahl: beschwerden.length,
    mahlzeiten: amTag.filter((e) => e.art === 'essen').length,
    medikamente: amTag.filter((e) => e.art === 'medikament').length,
  };
}

/** Eine Reihe von Tageswerten, lückenlos von `von` bis `bis`. */
export function verlaufReihe(eintraege, von, bis, tage = {}) {
  const raus = [];
  const n = tageDazwischen(von, bis);
  for (let i = 0; i <= n; i++) raus.push(tagesWert(eintraege, plusTage(von, i), tage));
  return raus;
}

/**
 * Beschwerden nach Tageszeit. Beantwortet die Frage, die im Sprechzimmer
 * immer kommt: nüchtern oder nach dem Essen, tagsüber oder nachts.
 */
export function nachTageszeit(eintraege) {
  const faecher = Object.keys(TAGESZEIT_NAME);
  const eimer = Object.fromEntries(faecher.map((k) => [k, { anzahl: 0, summe: 0 }]));
  eintraege.filter((e) => e.art === 'beschwerde').forEach((e) => {
    const f = eimer[tageszeit(e.um)];
    f.anzahl += 1;
    f.summe += Number(e.staerke) || 0;
  });
  return faecher.map((k) => ({
    id: k,
    name: TAGESZEIT_NAME[k],
    anzahl: eimer[k].anzahl,
    schnitt: eimer[k].anzahl ? eimer[k].summe / eimer[k].anzahl : 0,
  })).filter((f) => f.anzahl > 0).sort((a, b) => b.anzahl - a.anzahl);
}

/** Wie oft welche Beschwerdeart angekreuzt wurde. */
export function nachArt(eintraege) {
  const zaehler = new Map();
  eintraege.filter((e) => e.art === 'beschwerde').forEach((e) => {
    (e.arten || []).forEach((a) => zaehler.set(a, (zaehler.get(a) || 0) + 1));
  });
  return [...zaehler.entries()].map(([id, anzahl]) => ({ id, anzahl }))
    .sort((a, b) => b.anzahl - a.anzahl);
}

/**
 * Die laufende Serie beschwerdefreier Tage, rückwärts ab `bis`.
 *
 * Ein Tag ohne Eintragung beendet die Serie nicht, aber er zählt auch nicht
 * mit – sonst wäre die längste Serie die längste Pause vom Tagebuch.
 */
export function serieOhne(eintraege, tage, bis) {
  let iso = bis;
  let zaehler = 0;
  for (let i = 0; i < 400; i++) {
    const t = tagesWert(eintraege, iso, tage);
    if (t.notiert) {
      if (t.wert > 0) break;
      zaehler += 1;
    }
    iso = plusTage(iso, -1);
  }
  return zaehler;
}

/** Die großen Zahlen für die Übersicht und den Bericht. */
export function gesamtZahlen(eintraege, tage, von, bis) {
  const reihe = verlaufReihe(eintraege, von, bis, tage);
  const notiert = reihe.filter((t) => t.notiert);
  const mit = notiert.filter((t) => t.wert > 0);
  return {
    tage: reihe.length,
    notierteTage: notiert.length,
    tageMitBeschwerden: mit.length,
    anteil: notiert.length ? mit.length / notiert.length : 0,
    schnitt: notiert.length ? notiert.reduce((s, t) => s + t.wert, 0) / notiert.length : 0,
    hoechster: notiert.reduce((m, t) => Math.max(m, t.wert), 0),
    mahlzeiten: reihe.reduce((s, t) => s + t.mahlzeiten, 0),
    medikamente: reihe.reduce((s, t) => s + t.medikamente, 0),
  };
}
