/*
 * Einheiten und Plausibilität der Laborwerte.
 *
 * Deutsche Labore schreiben denselben TSH-Wert als mU/l, mIE/l, µU/ml oder
 * µIU/ml – der Zahlenwert ist jedes Mal derselbe. Bevor die App einordnet,
 * vergleicht oder eine Kurve zeichnet, bringt sie deshalb jede Schreibweise
 * auf eine Form. Angezeigt wird immer, was auf dem Befund steht.
 *
 * Und weil ein vergessenes Komma aus 4,0 eine 40 macht, fragt die App bei
 * ungewöhnlichen Werten nach, bevor sie etwas daraus schließt. Ein Wert, der
 * nach einer Verwechslung der Einheit aussieht (fT4 1,2 in „ng/l"), wird ohne
 * den Bereich vom Befund gar nicht eingeordnet – auch nach Bestätigung nicht.
 */
import { rohText } from './datum.js';
import * as sp from './speicher.js';

/** Schreibweise vereinheitlichen: klein, ohne Leerzeichen, µ/μ/micro → u. */
function schluessel(einheit) {
  return String(einheit || '').toLowerCase().replace(/\s+/g, '')
    .replace(/micro|mikro/g, 'u').replace(/[µμ]/g, 'u');
}

const TSH_SYNONYME = ['mu/l', 'miu/l', 'mie/l', 'mui/l', 'me/l', 'uu/ml', 'uiu/ml', 'uie/ml', 'uui/ml', 'ue/ml'];

/*
 * Je Wert: kanonische Einheit → Faktor auf die Standardeinheit. Die erste
 * Zeile ist die Standardeinheit selbst.
 */
const FAKTOR = {
  tsh: { 'mU/l': 1 },
  ft4: { 'pmol/l': 1, 'ng/dl': 12.87, 'ng/l': 1.287 },
  ft3: { 'pmol/l': 1, 'pg/ml': 1.536 },
  b12: { 'pmol/l': 1, 'pg/ml': 0.738 },
  vitd: { 'ng/ml': 1, 'nmol/l': 0.4 },
  hba1c: { '%': 1, 'mmol/mol': null },   // nicht linear, siehe inStandard
  ferritin: { 'ng/ml': 1, 'µg/l': 1 },
  hb: { 'g/dl': 1, 'g/l': 0.1, 'mmol/l': 1.611 },
  ldl: { 'mg/dl': 1, 'mmol/l': 38.67 },
  crp: { 'mg/l': 1, 'mg/dl': 10 },
  natrium: { 'mmol/l': 1 },
};

/** Die Standardeinheit je Wert – darin rechnen alle Schwellen. */
export const STANDARD = Object.fromEntries(Object.entries(FAKTOR).map(([k, f]) => [k, Object.keys(f)[0]]));

/**
 * Die kanonische Schreibweise einer Einheit – oder null, wenn die App sie
 * für diesen Wert nicht kennt.
 */
export function normEinheit(key, einheit) {
  const s = schluessel(einheit);
  if (!s) return null;
  if (key === 'tsh') return TSH_SYNONYME.includes(s) ? 'mU/l' : null;
  if (key === 'ft3' && s === 'ng/l') return 'pg/ml';
  if (key === 'ferritin' && s === 'ug/l') return 'µg/l';
  const tabelle = FAKTOR[key];
  if (!tabelle) return null;
  return Object.keys(tabelle).find((k) => schluessel(k) === s) || null;
}

/** Der Wert in der Standardeinheit (siehe STANDARD) – oder null bei unbekannter Einheit. */
export function inStandard(key, w) {
  if (!w || typeof w.wert !== 'number') return null;
  const e = normEinheit(key, w.einheit);
  if (!e) return null;
  if (key === 'hba1c' && e === 'mmol/mol') return Math.round((w.wert / 10.929 + 2.15) * 100) / 100;
  return w.wert * FAKTOR[key][e];
}

/** Eine Grenze des Laborbereichs in der Standardeinheit. */
export function grenzeInStandard(key, w, grenze) {
  if (!w || w[grenze] === null || w[grenze] === undefined) return null;
  return inStandard(key, { wert: w[grenze], einheit: w.einheit });
}

// ---------------------------------------------------------------- Plausibilität

/*
 * Die Rückfrage fragt, ob auf dem Befund wirklich diese Zahl steht – also
 * genau die eingegebene, ungerundet. Mit drei Stellen fragte sie bei TSH
 * 0,0004 „wirklich 0 mU/l?" (Runde 4: E21).
 */
const zahl = (n) => rohText(n);

/*
 * Grenzen je Wert und Einheit: [unten, oben, Hinweis bei zu klein, Hinweis
 * bei zu groß]. Ein Hinweis heißt: Das sieht nach einer verwechselten Einheit
 * aus – dann ist der Wert „unplausibel" und wird ohne Laborbereich nicht
 * eingeordnet. '?' heißt: unplausibel, aber ohne Vorschlag für die Einheit.
 */
const GRENZEN = {
  tsh: { 'mU/l': [0.01, 50, null, null] },
  ft4: {
    'pmol/l': [3, 60, 'ng/dl', null],
    'ng/dl': [0.2, 5, null, 'pmol/l'],
    'ng/l': [3, 50, 'ng/dl', null],
  },
  ft3: {
    'pmol/l': [1, 30, 'pg/ml', null],
    'pg/ml': [0.65, 20, '?', null],
  },
  hb: { 'g/dl': [3, 25, null, 'g/l'], 'g/l': [30, 250, 'g/dl', null], 'mmol/l': [2, 15, null, 'g/dl'] },
  ferritin: { 'ng/ml': [1, 5000, null, null], 'µg/l': [1, 5000, null, null] },
  b12: { 'pmol/l': [30, 2200, null, null], 'pg/ml': [50, 3000, null, null] },
  vitd: { 'ng/ml': [2, 200, null, 'nmol/l'], 'nmol/l': [5, 500, 'ng/ml', null] },
  natrium: { 'mmol/l': [100, 180, null, null] },
  hba1c: { '%': [3, 20, null, 'mmol/mol'], 'mmol/mol': [10, 200, '%', null] },
  ldl: { 'mg/dl': [20, 500, 'mmol/l', null], 'mmol/l': [0.5, 13, null, 'mg/dl'] },
  crp: { 'mg/l': [0, 500, null, null], 'mg/dl': [0, 50, null, null] },
};

/*
 * Runde 7: H19, H20 – Welche Einheit der Laborbereich nahelegt, bei den
 * Werten mit einer Gefahrengrenze und mehreren Einheiten (Hb, CRP). Vorher
 * prüfte die App bei den weiteren Werten nur den Wert, nie den Bereich: Ein Hb
 * aus einem mmol/l-Befund (7,8 bei 7,4–9,9) ging mit dem vorbelegten g/dl
 * ohne Rückfrage als „deutliche Blutarmut – in den nächsten Tagen anrufen"
 * durch, obwohl der Wert im eingetragenen Bereich lag; ein CRP von 15 mg/dl
 * (= 150 mg/l, Bereich „bis 0,5") mit dem vorbelegten mg/l hieß nur „Beim
 * nächsten Termin". RW2 E13 verlangt dafür eine Rückfrage.
 *
 * Die Grenzen liegen dort, wo sich die üblichen Bereiche der Einheiten nicht
 * überschneiden: Hb-Obergrenzen in mmol/l bis etwa 11,2, in g/dl ab 15, in
 * g/l ab 150; Untergrenzen in mmol/l 7–9, in g/dl ab 11. CRP-Obergrenzen in
 * mg/dl 0,3–1, in mg/l 3–10. Eine hs-CRP-Grenze „< 1 mg/l" fragt deshalb
 * nicht nach (erst unter 1), eine CRP-Obergrenze zwischen 1 und 1,5 ist
 * mehrdeutig und bleibt ohne Rückfrage.
 * → die Einheit, zu der der Bereich passt, oder null (ohne Bereich, mehrdeutig).
 */
function einheitNachBereich(key, w) {
  const hat = (x) => x !== null && x !== undefined;
  if (key === 'hb') {
    if (hat(w.bis)) return w.bis < 12.5 ? 'mmol/l' : w.bis < 30 ? 'g/dl' : 'g/l';
    if (hat(w.von)) return w.von < 10 ? 'mmol/l' : w.von < 30 ? 'g/dl' : 'g/l';
    return null;
  }
  if (key === 'crp' && hat(w.bis)) return w.bis < 1 ? 'mg/dl' : w.bis > 1.5 ? 'mg/l' : null;
  return null;
}

/**
 * Ein einzelner Wert: { rueckfrage, unplausibel, vorschlag }. `unplausibel`
 * heißt, die Einheit ist wahrscheinlich verwechselt; `vorschlag` ist dann die
 * vermutete Einheit (kanonisch) – oder null, wenn die App keine vermutet.
 */
export function pruefeWert(key, w) {
  const ergebnis = { rueckfrage: null, unplausibel: false, vorschlag: null };
  if (!w || typeof w.wert !== 'number') return ergebnis;
  const e = normEinheit(key, w.einheit);
  const g = e && GRENZEN[key] && GRENZEN[key][e];
  const name = ([...sp.LABORWERTE, ...sp.WEITERE_WERTE].find(([k]) => k === key) || [key, key])[1];
  const frage = `Bitte prüfen Sie Komma und Einheit: Steht auf dem Befund bei ${name} wirklich ${zahl(w.wert)} ${w.einheit}?`;
  // Runde 7: H19, H20 – passt der Bereich zu einer anderen Einheit, ist sie
  // der bessere Vorschlag als die aus dem Wert allein (Hb 7,8 „g/l" bei
  // 7,4–9,9 kommt aus mmol/l, nicht aus g/dl).
  const nachBereich = e ? einheitNachBereich(key, w) : null;
  const bereichAnders = nachBereich && nachBereich !== e ? nachBereich : null;
  if (g) {
    const [unten, oben, sonstKlein, sonstGross] = g;
    // „< 0,01" vom Befund zählt als 0,01 und ist kein Tippfehler.
    const zuKlein = w.wert < unten && !(key === 'tsh' && w.unter && w.wert >= 0.01);
    const vorschlag = (e2) => (e2 === '?' ? `${frage} Der Wert passt nicht gut zu dieser Einheit.`
      : `${frage} Der Wert passt nicht gut zu dieser Einheit – steht auf dem Befund vielleicht „${e2}"?`);
    const setze = (sonst) => {
      const e2 = bereichAnders && sonst !== '?' ? bereichAnders : sonst;
      ergebnis.rueckfrage = e2 ? vorschlag(e2) : frage;
      ergebnis.unplausibel = Boolean(e2);
      ergebnis.vorschlag = e2 && e2 !== '?' ? e2 : null;
    };
    if (zuKlein) setze(sonstKlein);
    else if (w.wert > oben) setze(sonstGross);
  }
  // Runde 7: H19, H20 – der Wert allein passt, der Bereich aber zu einer
  // anderen Einheit: unplausibel wie bei einem Wert, der nicht passt (E13 „bis
  // dahin keine Einordnung"). Nach „Ja, stimmt" rechnet weitereWerte die
  // Gefahrengrenzen in beiden Einheiten (siehe dort).
  if (!ergebnis.rueckfrage && bereichAnders) {
    ergebnis.rueckfrage = `${frage} Der Bereich passt nicht gut zu dieser Einheit – steht auf dem Befund vielleicht „${bereichAnders}"?`;
    ergebnis.unplausibel = true;
    ergebnis.vorschlag = bereichAnders;
  }
  // Runde 7: H20 – ein Hb unter 10 in g/dl ohne Bereich kann ebenso gut ein
  // normaler Wert in mmol/l sein (Frauen etwa 7,4–9,9). Ohne Bereich lässt
  // sich das nicht erkennen – also einmal nachfragen. Nicht „unplausibel": In
  // g/dl ist der Wert möglich und bekommt seine Frist, nur eben bestätigt.
  if (!ergebnis.rueckfrage && key === 'hb' && e === 'g/dl' && w.wert < 10
    && (w.von === null || w.von === undefined) && (w.bis === null || w.bis === undefined)) {
    ergebnis.rueckfrage = `${frage} Manche Labore geben Hämoglobin in mmol/l an – dann wählen Sie bitte diese Einheit.`;
  }
  if (key === 'tsh' && e) {
    const von = w.von;
    const bis = w.bis;
    if ((von !== null && von !== undefined && (von < 0.1 || von > 1.0)) || (bis !== null && bis !== undefined && (bis < 2.5 || bis > 7.5))) {
      const bereich = `${von ?? '…'}–${bis ?? '…'}`.replace(/\./g, ',');
      ergebnis.rueckfrage = ergebnis.rueckfrage
        || `Bitte prüfen Sie den TSH-Bereich: Steht auf dem Befund wirklich ${bereich} ${w.einheit}? Üblich ist etwa 0,3 bis 4,5.`;
    }
  }
  return ergebnis;
}

/*
 * Die Dosis-Einträge, die galten – rein aus dem übergebenen Stand: ohne die,
 * die eine Berichtigung nach ihrem „Gilt ab" ersetzt (Runde 6: G11), und
 * ohne einen, den eine Berichtigung am selben Tag ersetzt (G15). Die volle
 * Prüfung, ob eine Marke „berichtigung" gilt, steht in js/einschaetzung.js
 * (istBerichtigung) – der Kern importiert dieses Modul, umgekehrt wäre es ein
 * Zirkel. Hier zählt die Marke selbst: Im Zweifel fragt die App einmal mehr
 * nach dem Komma.
 */
function dosenOhneErsetzte(stand) {
  const dosen = sp.gueltigeDosen(stand);
  return dosen.filter((d, i) => !(dosen[i + 1] && dosen[i + 1].ab === d.ab && dosen[i + 1].berichtigung));
}

/*
 * Runde 6: G14 – „bei gleicher Dosis" (Entscheidung 13) heißt: dieselbe
 * Menge am Tag an beiden Befundtagen und dazwischen kein Eintrag mit einer
 * anderen – wie L6 in der Einschätzung. Vorher zählte nur, ob derselbe
 * Eintrag galt: Nach einem Präparatwechsel mit gleicher Menge (neues
 * Rezept) oder einem doppelten Eintrag ging TSH 0,25 nach 2,5 ohne Rückfrage
 * durch, und die Dosis-Karte gab aus einem vermutlichen Kommafehler eine
 * Richtung.
 */
function gleicheMenge(stand, von, bis) {
  const dosen = dosenOhneErsetzte(stand);
  const am = (tag) => {
    let d = null;
    for (const x of dosen) if (x.ab <= tag) d = x;
    return d;
  };
  // Die Menge am Tag; ohne Stärke gilt nur ein ganz gleicher Eintrag als gleich
  // (wie bisher derselbe Eintrag – im Zweifel fragt die App nach dem Komma).
  const menge = (d) => (sp.tagesdosis(d) !== null ? sp.tagesdosis(d)
    : `?${String(d.praeparat || '').trim().toLowerCase()}|${d.tabletten}`);
  const a = am(von);
  const b = am(bis);
  if (!a || !b || menge(a) !== menge(b)) return false;
  return !dosen.some((d) => d.ab > von && d.ab <= bis && menge(d) !== menge(a));
}

/**
 * Den ganzen Befund prüfen, bevor er gespeichert wird.
 * fehler: Speichern nicht möglich. rueckfragen: Speichern nach Bestätigung.
 */
export function befundPruefen(befund, stand, heute) {
  const fehler = [];
  const rueckfragen = [];
  if (befund.datum > heute) fehler.push('Das Datum der Blutabnahme liegt in der Zukunft. Bitte das Datum vom Befund eintragen.');
  [...sp.LABORWERTE, ...sp.WEITERE_WERTE].forEach(([key, name]) => {
    const w = befund[key];
    if (!w) return;
    if (w.von !== null && w.von !== undefined && w.bis !== null && w.bis !== undefined && w.von >= w.bis) {
      fehler.push(`Beim ${name} ist die untere Grenze nicht kleiner als die obere. Bitte den Bereich prüfen.`);
    }
    const p = pruefeWert(key, w);
    if (p.rueckfrage) rueckfragen.push(p.rueckfrage);
  });
  // Ein Sprung um das Achtfache bei gleicher Dosis ist fast immer ein Komma.
  const tsh = inStandard('tsh', befund.tsh);
  if (tsh !== null) {
    const vorher = [...stand.labor].reverse().find((l) => l.id !== befund.id && l.datum < befund.datum && inStandard('tsh', l.tsh) !== null);
    if (vorher) {
      const alt = inStandard('tsh', vorher.tsh);
      const gleich = gleicheMenge(stand, vorher.datum, befund.datum);
      if (gleich && alt > 0 && tsh > 0 && (tsh / alt >= 8 || alt / tsh >= 8)) {
        rueckfragen.push(`Der TSH-Wert ist bei gleicher Dosis ${tsh > alt ? 'mehr als achtmal so hoch' : 'weniger als ein Achtel'} wie am ${vorher.datum.split('-').reverse().join('.')} (${zahl(vorher.tsh.wert)}). Bitte prüfen Sie das Komma.`);
      }
    }
  }
  return { fehler, rueckfragen: [...new Set(rueckfragen)] };
}

/** Darf aus dem Befund geschlossen werden? Keine offene Rückfrage oder ausdrücklich bestätigt. */
export function plausibel(befund, stand) {
  if (befund.bestaetigt) return true;
  const heute = befund.datum;
  return befundPruefen(befund, stand, heute).rueckfragen.length === 0;
}
