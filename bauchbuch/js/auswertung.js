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
import { ALLE_AUSLOESER, ROLLEN, ROLLE_VORGABE } from './daten.js';

/** Späte Mahlzeit ab dieser Stunde – siehe UMSTAENDE in js/daten.js. */
const SPAET_AB = 20;

/**
 * Die Zutaten einer Mahlzeit als [{ id, rolle }].
 *
 * Seit die Rolle dazugehört, stehen sie unter `zutaten`. Vorher war es eine
 * bloße Liste von IDs unter `tags`. Der Speicher rechnet alte Stände beim
 * Laden um (siehe mahlzeitFrisch in js/store.js) – die Zeile hier ist der
 * zweite Riegel, für alles, was an dieser Umrechnung vorbeikommt: eine
 * Sicherung aus einer älteren Fassung, ein von Hand gesetzter Zustand, ein
 * Test, der die Rechenschicht direkt aufruft.
 */
export function zutatenVon(eintrag) {
  if (Array.isArray(eintrag.zutaten)) {
    return eintrag.zutaten
      .filter((z) => z && typeof z.id === 'string')
      .map((z) => ({ id: z.id, rolle: z.rolle || ROLLE_VORGABE }));
  }
  if (Array.isArray(eintrag.tags)) {
    return eintrag.tags.map((id) => ({ id, rolle: ROLLE_VORGABE }));
  }
  return [];
}

/**
 * Alle Merkmale einer Mahlzeit: die Zutaten plus die beiden Umstände, die
 * sich aus Portion und Uhrzeit von selbst ergeben.
 *
 * Die Rolle spielt hier bewusst *keine* Rolle: Für die Frage „war es drin?"
 * zählt jede Zutat gleich. Was die Rolle unterscheidet, steht getrennt in
 * rollenBilanz() – und zwar mit Fallzahlen, statt still eine Gewichtung in
 * die Hauptzahl zu rechnen, die niemand nachvollziehen könnte.
 */
export function merkmale(eintrag) {
  if (eintrag.art !== 'essen') return [];
  const raus = zutatenVon(eintrag).map((z) => z.id);
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

/**
 * Ein auffälliger Auslöser, aufgeschlüsselt nach der Rolle, in der er vorkam.
 *
 * Das ist die Auskunft, für die es die Rollen gibt: „Zwiebel" ist keine
 * Antwort, wenn sie achtmal die Suppe war und viermal drei Ringe obendrauf.
 * Zurück kommt jede Rolle, die überhaupt vorkam, mit ihrer Fallzahl – ohne
 * Schwelle und ohne Urteil, denn eine Aufschlüsselung hat naturgemäß kleinere
 * Zahlen als das Ganze, und wer sie liest, soll das sehen.
 */
export function rollenBilanz(eintraege, id, fensterStunden) {
  const treffer = eintraege.filter((e) => e.art === 'essen'
    && zutatenVon(e).some((z) => z.id === id));
  const raus = [];
  ROLLEN.forEach((r) => {
    const mit = treffer.filter((e) => zutatenVon(e)
      .some((z) => z.id === id && z.rolle === r.id));
    if (!mit.length) return;
    const summe = mit.reduce((sum, e) => sum + wertNach(eintraege, e, fensterStunden), 0);
    raus.push({ rolle: r.id, faelle: mit.length, schnitt: summe / mit.length });
  });
  return raus.sort((a, b) => b.schnitt - a.schnitt);
}

/* ---------- Die übrigen Faktoren ---------- */

/**
 * Wie viele Stunden vor einer Beschwerde zuletzt gegessen wurde.
 *
 * `null`, wenn an dem Tag und dem davor gar nichts eingetragen ist – dann ist
 * die Angabe nicht „lange her", sondern unbekannt, und das sind zwei
 * verschiedene Dinge.
 */
export function stundenSeitEssen(eintraege, beschwerde) {
  const t = zeitpunkt(beschwerde.am, beschwerde.um);
  let letzte = null;
  eintraege.filter((e) => e.art === 'essen').forEach((e) => {
    const te = zeitpunkt(e.am, e.um);
    if (te < t && (letzte === null || te > letzte)) letzte = te;
  });
  if (letzte === null) return null;
  const std = stundenDazwischen(letzte, t);
  return std <= 24 ? std : null;
}

/**
 * Kommen die Beschwerden nach dem Essen oder nüchtern?
 *
 * Das ist die erste Frage, die im Sprechzimmer gestellt wird, und die
 * schwerste aus dem Kopf zu beantworten. Aus dem Tagebuch fällt sie ab.
 */
export function essensbezug(eintraege, nahStunden = 2, fernStunden = 4) {
  const beschwerden = eintraege.filter((e) => e.art === 'beschwerde');
  let nah = 0;
  let fern = 0;
  let unbekannt = 0;
  beschwerden.forEach((b) => {
    const std = stundenSeitEssen(eintraege, b);
    if (std === null) unbekannt += 1;
    else if (std <= nahStunden) nah += 1;
    else if (std >= fernStunden) fern += 1;
  });
  const bewertbar = nah + fern;
  return {
    gesamt: beschwerden.length,
    nachDemEssen: nah,
    nuechtern: fern,
    unbekannt,
    anteilNachDemEssen: bewertbar ? nah / bewertbar : 0,
    anteilNuechtern: bewertbar ? fern / bewertbar : 0,
    bewertbar,
  };
}

/**
 * Ein Tagesfaktor gegen die Beschwerdestärke: Tage mit viel gegen Tage mit
 * wenig davon.
 *
 * Dieselbe Logik wie bei den Auslösern und aus demselben Grund: Verglichen
 * wird gegen den eigenen Alltag, nicht gegen null. Wer an jedem zweiten Tag
 * angespannt ist, hätte sonst „Anspannung" als Dauerbefund.
 */
export function faktorBilanz(eintraege, tage, frageId, tagesWertFn) {
  const hoch = [];
  const niedrig = [];
  Object.keys(tage || {}).forEach((iso) => {
    const wert = tage[iso] ? tage[iso][frageId] : null;
    if (wert === null || wert === undefined) return;
    const t = tagesWertFn(eintraege, iso, tage);
    if (!t.notiert) return;
    if (Number(wert) >= 3) hoch.push(t.wert);
    else if (Number(wert) <= 1) niedrig.push(t.wert);
  });
  const schnitt = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
  return {
    id: frageId,
    hoch: { tage: hoch.length, schnitt: schnitt(hoch) },
    niedrig: { tage: niedrig.length, schnitt: schnitt(niedrig) },
    differenz: schnitt(hoch) - schnitt(niedrig),
    genug: hoch.length >= 4 && niedrig.length >= 4,
  };
}

/** Wie oft eine Beschwerdeart unter allen Beschwerden vorkommt, als Anteil. */
export function artAnteil(eintraege, arten) {
  const alle = eintraege.filter((e) => e.art === 'beschwerde');
  if (!alle.length) return { anteil: 0, anzahl: 0, gesamt: 0 };
  const treffer = alle.filter((e) => (e.arten || []).some((a) => arten.includes(a)));
  return { anteil: treffer.length / alle.length, anzahl: treffer.length, gesamt: alle.length };
}

/* ---------- Was oft vorkommt ---------- */

/**
 * Die Zutaten nach Häufigkeit, die meistbenutzte zuerst.
 *
 * Die Auswahlliste beim Eintragen ist sechzehn Marken lang plus eigene. Wer
 * jeden Tag Kaffee einträgt, soll ihn nicht jeden Tag suchen – und eine
 * Eingabe, die drei Sekunden dauert statt fünfzehn, wird auch an einem
 * schlechten Tag noch gemacht. Genau daran hängt, ob das Tagebuch Lücken hat.
 */
export function haeufigeZutaten(eintraege) {
  const zaehler = new Map();
  eintraege.filter((e) => e.art === 'essen').forEach((e) => {
    zutatenVon(e).forEach((z) => zaehler.set(z.id, (zaehler.get(z.id) || 0) + 1));
  });
  return zaehler;
}

/**
 * Die häufigsten Mahlzeiten im Klartext, als Vorschlag fürs Textfeld.
 *
 * Verglichen wird kleingeschrieben und ohne Randleerzeichen, angezeigt wird
 * die zuletzt benutzte Schreibweise – sonst stünde „haferbrei" neben
 * „Haferbrei" und beide wären halb so häufig.
 */
export function haeufigeGerichte(eintraege, anzahl = 6) {
  const zaehler = new Map();
  eintraege.filter((e) => e.art === 'essen').forEach((e) => {
    const roh = String(e.was || '').trim();
    if (!roh) return;
    const schluessel = roh.toLowerCase();
    const v = zaehler.get(schluessel) || { text: roh, anzahl: 0 };
    v.text = roh;
    v.anzahl += 1;
    zaehler.set(schluessel, v);
  });
  return [...zaehler.values()]
    .filter((g) => g.anzahl > 1)
    .sort((a, b) => b.anzahl - a.anzahl)
    .slice(0, anzahl);
}

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
