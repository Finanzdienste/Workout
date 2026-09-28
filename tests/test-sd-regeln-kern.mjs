/*
 * Regeltreue des Rechenkerns der Schilddrüsen-App – ohne Browser, als Tabellen.
 *
 *     node tests/test-sd-regeln-kern.mjs
 *
 * Geprüft werden schilddruese/js/einschaetzung.js und schilddruese/js/einheiten.js
 * gegen den REGELTEXT, nicht gegen die Umsetzung:
 *
 *   - Regelwerk 1 (P1–P7, L0a–L9, S1–S4, W0–W5, M1–M14, B2) mit allen Fixes
 *     R1–R15 des roten Teams,
 *   - aus Regelwerk 2 nur, was den Kern betrifft: E13a–f (zusätzliche Werte),
 *     L2 (Plausibilität), L3 (einseitige Bereiche), D3 (Muster b = tage), WW3,
 *   - die Entscheidungen 1–18 der Umsetzungsvorgabe; sie gehen den
 *     Regelwerken vor.
 *
 * Texte werden nur über kurze, markante Schlüsselwörter geprüft – die
 * Umsetzung darf umformulieren. Wo der Regeltext mehrdeutig ist, gilt die
 * sicherere Lesart; die Stellen tragen den Kommentar „MEHRDEUTIG:".
 *
 * Ausgabe wie alle Tests (tests/lauf.mjs zählt die Zeilen): je Prüfung
 * „OK …" oder „FAIL … – Grund". Ein Absturz in einem Fall ist ein FAIL dieses
 * Falls, kein Abbruch der Datei. Rückgabewert 1, sobald etwas scheitert.
 */

// ---------------------------------------------------------------- Prüfen

let oks = 0;
let fails = 0;
let faelle = 0;

function check(name, bedingung, detail = '') {
  if (bedingung) {
    oks++;
    console.log(`OK   ${name}`);
    return true;
  }
  fails++;
  console.log(`FAIL ${name}${detail ? ` – ${detail}` : ''}`);
  return false;
}

/** Ein Fall: stürzt er ab, ist das ein FAIL mit Meldung – die Datei läuft weiter. */
function fall(name, fn) {
  faelle++;
  try {
    fn();
  } catch (e) {
    const wo = e && e.stack ? e.stack.split('\n').slice(0, 2).map((z) => z.trim()).join(' | ') : String(e);
    check(`${name} (läuft ohne Absturz)`, false, wo);
  }
}

// ---------------------------------------------------------------- Laden
//
// Gleichwertig zu `import * as ez from '../schilddruese/js/einschaetzung.js'`
// (und ebenso einheiten.js, speicher.js) – nur so, dass ein fehlendes oder
// kaputtes Modul als FAIL erscheint, statt die ganze Datei abzubrechen.
// speicher.js fängt das fehlende localStorage unter Node selbst ab.

let ez = {};
let eh = {};
let normStand = () => { throw new Error('normStand fehlt (speicher.js nicht geladen)'); };

try {
  ez = await import('../schilddruese/js/einschaetzung.js');
  check('Import schilddruese/js/einschaetzung.js', true);
} catch (e) {
  check('Import schilddruese/js/einschaetzung.js', false, e && e.message);
}
try {
  eh = await import('../schilddruese/js/einheiten.js');
  check('Import schilddruese/js/einheiten.js', true);
} catch (e) {
  check('Import schilddruese/js/einheiten.js', false, e && e.message);
}
try {
  ({ normStand } = await import('../schilddruese/js/speicher.js'));
  check('Import schilddruese/js/speicher.js', typeof normStand === 'function');
} catch (e) {
  check('Import schilddruese/js/speicher.js', false, e && e.message);
}

// ---------------------------------------------------------------- Hilfen

const HEUTE = '2026-09-27';
const BEFUND_TAG = '2026-09-20';

/** ISO-Tag + n Tage (mittags gerechnet, ohne Zeitzonen-Fallen). */
function plus(iso, n) {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
const VORTAG = plus(BEFUND_TAG, -1);

/** Rang der Stufen nach Entscheidung 18 – bewusst eigen, nicht aus dem Kern. */
const RANG = { keine: 0, termin: 1, zeitnah: 2, tage: 3, heute: 4, notruf: 5 };
const rang = (s) => (Object.prototype.hasOwnProperty.call(RANG, s) ? RANG[s] : -1);

/** Vergleichsform: klein, Striche und Anführungszeichen vereinheitlicht, Leerraum zusammengezogen. */
const norm = (t) => String(t ?? '').toLowerCase()
  .replace(/[‐-―−]/g, '-')
  .replace(/[„“”‚‘’"']/g, '"')
  .replace(/\s+/g, ' ');

/** Alle Texte eines Ergebnisses (rekursiv), ohne die Rohdaten des Befunds und die Regel-IDs. */
function texteVon(x, aus = ['befund', 'regeln']) {
  const out = [];
  const lauf = (v, key) => {
    if (key !== null && aus.includes(key)) return;
    if (typeof v === 'string') out.push(v);
    else if (Array.isArray(v)) v.forEach((e) => lauf(e, null));
    else if (v && typeof v === 'object') Object.entries(v).forEach(([k, e]) => lauf(e, k));
  };
  lauf(x, null);
  return out;
}
const enthaelt = (texte, stueck) => norm([].concat(texte).join(' | ')).includes(norm(stueck));
const auszug = (texte, n = 260) => {
  const t = [].concat(texte).join(' | ');
  return t.length > n ? `${t.slice(0, n)} …` : (t || '(kein Text)');
};
const ids = (liste) => (Array.isArray(liste) ? liste.map((e) => e && e.id) : liste);
const nahe = (a, b) => typeof a === 'number' && Math.abs(a - b) <= Math.max(Math.abs(b) * 0.005, 0.001);
const kompakt = (s) => String(s ?? '').replace(/\s/g, '');
/** Uhrzeit im Text – „07:30" oder „7:30". */
const hatUhr = (text, hhmm) => enthaelt(text, hhmm) || enthaelt(text, hhmm.replace(/^0/, ''));

/** Für die globalen Prüfungen am Ende: jeder Text, woher er kommt. */
const TEXTE = [];
function sammle(quelle, name, texte) {
  texte.forEach((text) => TEXTE.push({ quelle, name, text }));
}
/** Jede Befund-Einschätzung aus dieser Datei. */
const ALLE_E = [];

// Laborwerte: Wert mit Laborbereich (Voreinstellung: TSH 0,4–4,0 mU/l, fT4
// 12–22 pmol/l, fT3 3,1–6,8 pmol/l) oder ohne Bereich (Orientierung).
const t = (wert, von = 0.4, bis = 4.0, einheit = 'mU/l') => ({ wert, einheit, von, bis });
const tO = (wert, einheit = 'mU/l') => ({ wert, einheit });
const f4 = (wert, von = 12, bis = 22, einheit = 'pmol/l') => ({ wert, einheit, von, bis });
const f4O = (wert, einheit = 'pmol/l') => ({ wert, einheit });
const f3 = (wert, von = 3.1, bis = 6.8, einheit = 'pmol/l') => ({ wert, einheit, von, bis });
const f3O = (wert, einheit = 'pmol/l') => ({ wert, einheit });

// Profile: Grundprofil 56 Jahre (Geburtsjahr 1970), Hashimoto, nur T4, kein
// Herz, keine Osteoporose, kein Krebs, kein Ziel.
const J = { 56: 1970, 64: 1962, 65: 1961, 69: 1957, 70: 1956, 72: 1954, 78: 1948, 80: 1946, 82: 1944 };
const T3 = { praeparatArt: 't3' };
const ZIEL = (zielVon, zielBis, zielAm = '2026-06-01') => ({ zielVon, zielBis, zielAm });
const NIEDRIG = { zielNiedrig: 'ja', zielAm: '2026-06-01' };
const KREBS = { krebs: 'ja' };
const BASIS_PROFIL = {
  begruesst: true, behandelt: true, seit: '2024-01-01', geburtsjahr: J[56], ursache: 'hashimoto',
  krebs: 'nein', praeparatArt: 't4', herz: 'nein', osteoporose: 'nein', kortison: 'nein',
  diabetes: 'nein', zielNiedrig: 'nein', bundesland: '',
};
const D1 = { id: 'd1', ab: '2024-01-01', praeparat: 'L-Thyroxin', mikrogramm: 75, tabletten: 1 };
const dosisAb = (ab, mikrogramm = 88, praeparat = 'L-Thyroxin') => [D1, { id: 'd2', ab, praeparat, mikrogramm, tabletten: 1 }];

/** Einnahmen an `anzahl` Tagen rückwärts ab `bis`; die ersten `aus` davon bewusst „nicht genommen". */
function einnahmen(bis, anzahl, aus = 0) {
  const e = {};
  for (let i = 0; i < anzahl; i++) e[plus(bis, -i)] = i < aus ? null : { uhr: '07:00' };
  return e;
}
/** Ein Befinden-Eintrag. */
const bf = (datum, ...beschwerden) => ({ datum, stufe: 'mittel', beschwerden, notiz: '' });
/** Ein früherer Befund. */
const V = (datum, tsh, weiteres = {}) => ({ id: `v${datum.replace(/-/g, '')}`, datum, tsh, ...weiteres });

/**
 * Einen Stand bauen – immer über normStand, so wie die App liest. Der
 * geprüfte Befund hat die Kennung „ziel" (außer mit ohneBefund).
 */
function baue(f = {}) {
  const profil = { ...BASIS_PROFIL, ...(f.profil || {}) };
  const labor = [...(f.vor || [])];
  if (!f.ohneBefund) {
    labor.push({
      id: 'ziel', datum: f.datum || BEFUND_TAG, tsh: f.tsh ?? null, ft4: f.ft4 ?? null, ft3: f.ft3 ?? null,
      ...(f.befund || {}),
    });
  }
  return normStand({
    version: 2,
    profil,
    mittel: f.mittel || [],
    mittelAbstand: f.abstand || {},
    mittelWechsel: f.mittelWechsel || [],
    dosen: f.dosen || [D1],
    einnahmen: f.einnahmen || {},
    labor,
    befinden: f.befinden || [],
    gewicht: f.gewicht || [],
    termine: f.termine || [],
    warnzeichen: f.warnzeichen || [],
    einstellungen: { erinnerung: f.uhr || '07:00' },
  });
}

/** Befund-Einschätzung des Befunds „ziel" – und für die globalen Prüfungen merken. */
function einschaetzung(f) {
  const s = baue(f);
  const b = s.labor.find((x) => x.id === 'ziel');
  const E = ez.befundEinschaetzen(b, s, f.heute || HEUTE);
  ALLE_E.push({
    name: f.name, E,
    nurLabor: !(f.befinden && f.befinden.length) && !(f.warnzeichen && f.warnzeichen.length),
  });
  sammle('befundEinschaetzen', f.name, texteVon(E));
  return { E, s, b };
}

const MUSTER_REGEL = {
  a: 'L2a', b: 'L2b', c1: 'L2c1', c2: 'L2c2', c3: 'L2c3', d: 'L2d', e1: 'L2e1', e2: 'L2e2', e3: 'L2e3',
  f: 'L2f', g1: 'L2g1', g2: 'L2g2', h: 'L2h', t: 'L2t', z2a: 'L2z2', z2b: 'L2z2', z2c: 'L2z2', z3: 'L2z3',
};
const gruppeVon = (m) => (m === null ? null : m.startsWith('z') ? 'z' : m[0]);

/**
 * Ein Tabellenfall für befundEinschaetzen. Felder:
 *   muster (Wert, null oder Liste erlaubter Werte), stufe | stufeMin | stufeMax,
 *   regeln / ohneRegeln (Teilmenge von E.regeln; die Muster-Regel kommt bei
 *   eindeutigem Muster von selbst dazu), texte / verboten (Schlüsselwörter
 *   in allen Texten der Einschätzung), notfall / notfallNicht (L3e-Satz),
 *   ziel (E.ziel), erste (ID der ersten Erklärung), pruef(E, s) → [[name, ok, detail]].
 */
function pruefeFall(f) {
  fall(f.name, () => {
    const { E, s } = einschaetzung(f);
    const n = f.name;
    const alle = texteVon(E);
    if (f.muster !== undefined) {
      const erlaubt = Array.isArray(f.muster) ? f.muster : [f.muster];
      check(`${n}: Muster ${erlaubt.map(String).join(' oder ')}`, erlaubt.includes(E.muster), `ist ${E.muster}`);
      if (!Array.isArray(f.muster) && f.muster !== null) {
        check(`${n}: Gruppe ${gruppeVon(f.muster)}`, E.gruppe === gruppeVon(f.muster), `ist ${E.gruppe}`);
      }
    }
    if (f.stufe) check(`${n}: Stufe ${f.stufe}`, E.stufe === f.stufe, `ist ${E.stufe}`);
    if (f.stufeMin) check(`${n}: Stufe mindestens ${f.stufeMin}`, rang(E.stufe) >= rang(f.stufeMin), `ist ${E.stufe}`);
    if (f.stufeMax) {
      check(`${n}: Stufe höchstens ${f.stufeMax}`, rang(E.stufe) >= 0 && rang(E.stufe) <= rang(f.stufeMax), `ist ${E.stufe}`);
    }
    const regeln = [...(f.regeln || [])];
    if (typeof f.muster === 'string' && MUSTER_REGEL[f.muster] && !regeln.includes(MUSTER_REGEL[f.muster])) {
      regeln.unshift(MUSTER_REGEL[f.muster]);
    }
    regeln.forEach((r) => check(`${n}: Regel ${r} ausgelöst`, Array.isArray(E.regeln) && E.regeln.includes(r),
      `regeln: ${JSON.stringify(E.regeln)}`));
    (f.ohneRegeln || []).forEach((r) => check(`${n}: Regel ${r} nicht ausgelöst`,
      Array.isArray(E.regeln) && !E.regeln.includes(r), `regeln: ${JSON.stringify(E.regeln)}`));
    (f.texte || []).forEach((x) => check(`${n}: Text „${x}"`, enthaelt(alle, x), auszug(alle)));
    (f.verboten || []).forEach((x) => check(`${n}: ohne „${x}"`, !enthaelt(alle, x), auszug(alle.filter((z) => enthaelt(z, x)))));
    if (f.notfall) {
      check(`${n}: L3e-Satz ${f.notfall}`, !!E.notfall && E.notfall.satz === f.notfall, `ist ${E.notfall && E.notfall.satz}`);
    }
    if (f.notfallNicht) {
      check(`${n}: nicht L3e-Satz ${f.notfallNicht}`, !E.notfall || E.notfall.satz !== f.notfallNicht,
        `ist ${E.notfall && E.notfall.satz}`);
    }
    if (f.ziel !== undefined) check(`${n}: am Zielbereich gemessen = ${f.ziel}`, E.ziel === f.ziel, `ist ${E.ziel}`);
    if (f.erste) {
      const erste = Array.isArray(E.erklaerungen) && E.erklaerungen[0] ? E.erklaerungen[0].id : null;
      check(`${n}: erste Erklärung ${f.erste}`, erste === f.erste, `Erklärungen: ${JSON.stringify(ids(E.erklaerungen))}`);
    }
    if (f.pruef) f.pruef(E, s).forEach(([name, ok, detail]) => check(`${n}: ${name}`, ok, detail));
  });
}

/** Texte einer Liste von { text } bzw. Strings. */
const textListe = (l) => (Array.isArray(l) ? l.map((e) => (typeof e === 'string' ? e : e && e.text)).filter(Boolean) : []);

// ================================================================ L0a Einheiten

// L0a + R4: alle TSH-Schreibweisen sind dieselbe Größe mit demselben Zahlenwert.
const TSH_SYNONYME = [
  'mU/l', 'mIE/l', 'µU/ml', 'µIU/ml', 'mIU/l', 'mie/l', ' µU / ml ', 'μU/ml', 'uU/ml', 'uIU/ml',
  'µIE/ml', 'uIE/ml', 'mUI/l', 'mE/l', 'mIU/L', 'microU/ml',
];
TSH_SYNONYME.forEach((e) => fall(`L0a TSH „${e}"`, () => {
  check(`L0a normEinheit TSH „${e}" = mU/l`, eh.normEinheit('tsh', e) === 'mU/l', `ist ${eh.normEinheit('tsh', e)}`);
  const w = eh.inStandard('tsh', { wert: 2.5, einheit: e });
  check(`L0a inStandard TSH 2,5 „${e}" = 2,5`, nahe(w, 2.5), `ist ${w}`);
}));

// L0a: kanonische Einheiten fT4/fT3 und weitere Werte, unbekannte → null.
[
  ['tsh', 'mg/dl', null], ['tsh', 'pmol/l', null],
  ['ft4', 'pmol/l', 'pmol/l'], ['ft4', 'PMOL/L', 'pmol/l'], ['ft4', 'ng/dl', 'ng/dl'], ['ft4', 'ng/dL', 'ng/dl'],
  ['ft4', 'ng/l', 'ng/l'], ['ft4', 'mU/l', null],
  ['ft3', 'pmol/l', 'pmol/l'], ['ft3', 'pg/ml', 'pg/ml'], ['ft3', 'pg/mL', 'pg/ml'], ['ft3', 'ng/l', 'pg/ml'],
  ['ft3', 'ng/dl', null],
  ['b12', 'pg/ml', 'pg/ml'], ['natrium', 'mmol/l', 'mmol/l'], ['hba1c', '%', '%'], ['hb', 'mg/l', null],
].forEach(([key, e, soll]) => fall(`L0a normEinheit ${key} „${e}"`, () => {
  check(`L0a normEinheit ${key} „${e}" = ${soll}`, eh.normEinheit(key, e) === soll, `ist ${eh.normEinheit(key, e)}`);
}));

// L0a / E13a–f: Umrechnung in die Standardeinheit (Grundsatz 7: rechnen nach Umrechnung).
[
  ['tsh', 2.5, 'xyz', null],
  ['ft4', 1.0, 'ng/dl', 12.87], ['ft4', 10, 'ng/l', 12.87], ['ft4', 15, 'pmol/l', 15],
  ['ft3', 3, 'pg/ml', 4.608], ['ft3', 3, 'ng/l', 4.608], ['ft3', 5, 'pmol/l', 5],
  ['b12', 400, 'pg/ml', 295.2], ['b12', 300, 'pmol/l', 300],
  ['vitd', 50, 'nmol/l', 20], ['vitd', 30, 'ng/ml', 30],
  ['hba1c', 48, 'mmol/mol', 48 / 10.929 + 2.15], ['hba1c', 6.5, '%', 6.5],
  ['ferritin', 25, 'µg/l', 25], ['ferritin', 25, 'ng/ml', 25],
  ['hb', 110, 'g/l', 11], ['hb', 6.8, 'mmol/l', 6.8 * 1.611], ['hb', 12, 'g/dl', 12],
  ['crp', 1.2, 'mg/dl', 12], ['crp', 12, 'mg/l', 12],
  ['ldl', 4.9, 'mmol/l', 4.9 * 38.67], ['ldl', 190, 'mg/dl', 190],
  ['natrium', 140, 'mmol/l', 140],
].forEach(([key, wert, e, soll]) => fall(`L0a inStandard ${key} ${wert} ${e}`, () => {
  const w = eh.inStandard(key, { wert, einheit: e });
  check(`L0a inStandard ${key} ${wert} ${e} = ${soll === null ? 'null' : soll.toFixed(3)}`,
    soll === null ? w === null : nahe(w, soll), `ist ${w}`);
}));

// ================================================================ L1 einordnen()

// [Name, key, Wert, Optionen, Erwartung]
const EINORDNEN = [
  // L1 mit Laborbereich (TSH 0,4–4,0; fT4 12–22): knapp = ±10 %, TSH knapp über zusätzlich ≤ OG + 0,5.
  ['L1 TSH 2,0 im Laborbereich', 'tsh', t(2), {}, { lage: 'im', genau: 'im', quelle: 'labor' }],
  ['L1 TSH 4,0 = OG zählt als im Bereich', 'tsh', t(4.0), {}, { lage: 'im', genau: 'im' }],
  ['L1 TSH 0,4 = UG zählt als im Bereich', 'tsh', t(0.4), {}, { lage: 'im', genau: 'im' }],
  ['L1 TSH 4,3 knapp über', 'tsh', t(4.3), {}, { lage: 'ueber', genau: 'knapp-ueber' }],
  ['L1 TSH 4,5 über (> OG × 1,1)', 'tsh', t(4.5), {}, { lage: 'ueber', genau: 'ueber' }],
  ['L1 TSH 7,4 bei OG 7,0 knapp über (≤ OG + 0,5)', 'tsh', t(7.4, 0.5, 7.0), {}, { lage: 'ueber', genau: 'knapp-ueber' }],
  ['L1 TSH 7,6 bei OG 7,0 über (> OG + 0,5, obwohl ≤ OG × 1,1)', 'tsh', t(7.6, 0.5, 7.0), {}, { lage: 'ueber', genau: 'ueber' }],
  ['L1 TSH 0,37 knapp unter (≥ UG × 0,9)', 'tsh', t(0.37), {}, { lage: 'unter', genau: 'knapp-unter' }],
  ['L1 TSH 0,35 unter (< UG × 0,9)', 'tsh', t(0.35), {}, { lage: 'unter', genau: 'unter' }],
  ['L1 fT4 11 knapp unter', 'ft4', f4(11), {}, { lage: 'unter', genau: 'knapp-unter' }],
  ['L1 fT4 10,5 unter', 'ft4', f4(10.5), {}, { lage: 'unter', genau: 'unter' }],
  ['L1 fT4 9,7 unter, nicht deutlich (≥ UG × 0,8)', 'ft4', f4(9.7), {}, { lage: 'unter', genau: 'unter' }],
  ['L1 fT4 9,5 deutlich unter (< UG × 0,8)', 'ft4', f4(9.5), {}, { lage: 'unter', genau: 'deutlich-unter' }],
  ['L1 fT4 24 knapp über', 'ft4', f4(24), {}, { lage: 'ueber', genau: 'knapp-ueber' }],
  ['L1 fT4 25 über', 'ft4', f4(25), {}, { lage: 'ueber', genau: 'ueber' }],
  ['L1 fT4 26,3 über, nicht deutlich (≤ OG × 1,2)', 'ft4', f4(26.3), {}, { lage: 'ueber', genau: 'ueber' }],
  ['L1 fT4 26,5 deutlich über (> OG × 1,2)', 'ft4', f4(26.5), {}, { lage: 'ueber', genau: 'deutlich-ueber' }],
  ['L1 fT4 0,8 ng/dl mit Bereich 0,93–1,71 unter', 'ft4', f4(0.8, 0.93, 1.71, 'ng/dl'), {}, { lage: 'unter', genau: 'unter', quelle: 'labor' }],
  ['L1 fT4 0,7 ng/dl mit Bereich 0,93–1,71 deutlich unter', 'ft4', f4(0.7, 0.93, 1.71, 'ng/dl'), {}, { lage: 'unter', genau: 'deutlich-unter' }],
  // L1 ohne Laborbereich (Orientierung): Pufferzone „am Rand" zählt als im Bereich.
// MEHRDEUTIG: L1 TEXT nennt den Orientierungs- und den Rand-Zusatz als „Anzeige je Wert"; die
// Schnittstelle hat dafür nur einordnen().text. Sicherere Lesart: der Zusatz steht in diesem Text,
// damit jede Ansicht, die nur den Wert zeigt, die Kennzeichnung mitbekommt.
  ['L1 Orientierung TSH 0,4', 'tsh', tO(0.4), {}, { lage: 'im', genau: 'im', quelle: 'orientierung', texte: ['Orientierung', 'nicht der Bereich Ihres Labors'] }],
  ['L1 Orientierung TSH 4,0', 'tsh', tO(4.0), {}, { lage: 'im', genau: 'im', quelle: 'orientierung' }],
  ['L1 Orientierung TSH 4,5 am Rand', 'tsh', tO(4.5), {}, { lage: 'im', genau: 'rand-ueber', texte: ['am Rand', 'Bereich vom Befund'] }],
  ['L1 Orientierung TSH 4,51 über', 'tsh', tO(4.51), {}, { lage: 'ueber', genau: 'ueber' }],
  ['L1 Orientierung TSH 0,3 am Rand', 'tsh', tO(0.3), {}, { lage: 'im', genau: 'rand-unter', texte: ['am Rand'] }],
  ['L1 Orientierung TSH 0,29 unter', 'tsh', tO(0.29), {}, { lage: 'unter', genau: 'unter' }],
  ['L1 Orientierung fT4 12 pmol/l', 'ft4', f4O(12), {}, { lage: 'im', genau: 'im', quelle: 'orientierung' }],
  ['L1 Orientierung fT4 22 pmol/l', 'ft4', f4O(22), {}, { lage: 'im', genau: 'im' }],
  ['L1 Orientierung fT4 10 am Rand', 'ft4', f4O(10), {}, { lage: 'im', genau: 'rand-unter' }],
  ['L1 Orientierung fT4 9,99 unter', 'ft4', f4O(9.99), {}, { lage: 'unter', genau: 'unter' }],
  ['L1 Orientierung fT4 8 unter, nicht deutlich', 'ft4', f4O(8), {}, { lage: 'unter', genau: 'unter' }],
  ['L1 Orientierung fT4 7,99 deutlich unter', 'ft4', f4O(7.99), {}, { lage: 'unter', genau: 'deutlich-unter' }],
  ['L1 Orientierung fT4 24 am Rand', 'ft4', f4O(24), {}, { lage: 'im', genau: 'rand-ueber' }],
  ['L1 Orientierung fT4 24,01 über', 'ft4', f4O(24.01), {}, { lage: 'ueber', genau: 'ueber' }],
  ['L1 Orientierung fT4 26 über, nicht deutlich', 'ft4', f4O(26), {}, { lage: 'ueber', genau: 'ueber' }],
  ['L1 Orientierung fT4 26,01 deutlich über', 'ft4', f4O(26.01), {}, { lage: 'ueber', genau: 'deutlich-ueber' }],
  ['L1 Orientierung fT4 1,0 ng/dl im Bereich, umgerechnet', 'ft4', f4O(1.0, 'ng/dl'), {}, { lage: 'im', genau: 'im', umgerechnet: true, std: 12.87 }],
  ['L1 Orientierung fT4 0,85 ng/dl am Rand', 'ft4', f4O(0.85, 'ng/dl'), {}, { lage: 'im', genau: 'rand-unter' }],
  ['L1 Orientierung fT4 0,70 ng/dl unter', 'ft4', f4O(0.7, 'ng/dl'), {}, { lage: 'unter', genau: 'unter' }],
  ['L1 Orientierung fT4 0,60 ng/dl deutlich unter', 'ft4', f4O(0.6, 'ng/dl'), {}, { lage: 'unter', genau: 'deutlich-unter' }],
  ['L1 Orientierung fT4 1,80 ng/dl am Rand', 'ft4', f4O(1.8, 'ng/dl'), {}, { lage: 'im', genau: 'rand-ueber' }],
  ['L1 Orientierung fT4 2,05 ng/dl deutlich über', 'ft4', f4O(2.05, 'ng/dl'), {}, { lage: 'ueber', genau: 'deutlich-ueber' }],
  ['L1 Orientierung fT4 12 ng/l im Bereich', 'ft4', f4O(12, 'ng/l'), {}, { lage: 'im', genau: 'im' }],
  ['L1 Orientierung fT4 7 ng/l unter', 'ft4', f4O(7, 'ng/l'), {}, { lage: 'unter', genau: 'unter' }],
  ['L1 Orientierung fT4 21 ng/l deutlich über', 'ft4', f4O(21, 'ng/l'), {}, { lage: 'ueber', genau: 'deutlich-ueber' }],
  // L1b fT3-Orientierung 3,1–6,8 pmol/l = 2,0–4,4 pg/ml, Rand 2,8/7,0 pmol/l.
  ['L1b Orientierung fT3 3,0 pmol/l am Rand', 'ft3', f3O(3.0), {}, { lage: 'im', genau: 'rand-unter' }],
  ['L1b Orientierung fT3 2,7 pmol/l unter', 'ft3', f3O(2.7), {}, { lage: 'unter' }],
  ['L1b Orientierung fT3 7,0 pmol/l am Rand', 'ft3', f3O(7.0), {}, { lage: 'im', genau: 'rand-ueber' }],
  ['L1b Orientierung fT3 7,1 pmol/l über', 'ft3', f3O(7.1), {}, { lage: 'ueber' }],
  ['L1b Orientierung fT3 3,0 pg/ml im Bereich', 'ft3', f3O(3.0, 'pg/ml'), {}, { lage: 'im', genau: 'im' }],
  ['L1b Orientierung fT3 1,9 pg/ml am Rand', 'ft3', f3O(1.9, 'pg/ml'), {}, { lage: 'im', genau: 'rand-unter' }],
  // L0a unbekannte Einheit: mit Bereich nur gegen den Laborbereich, ohne Bereich keine Einordnung.
  ['L0a unbekannte Einheit mit Bereich, im', 'tsh', t(3, 0.4, 4.0, 'mg'), {}, { lage: 'im', quelle: 'labor' }],
  ['L0a unbekannte Einheit mit Bereich, über', 'tsh', t(6, 0.4, 4.0, 'mg'), {}, { lage: 'ueber', quelle: 'labor' }],
  ['L0a unbekannte Einheit ohne Bereich', 'tsh', tO(3, 'mg'), {}, { lage: null, grund: 'einheit', texte: ['Diese Einheit kennt die App nicht'] }],
  // Entscheidung 13 / R5: Einheitenverwechslung ohne Bereich = keine Einordnung.
  ['R5 fT4 1,2 pmol/l ohne Bereich unplausibel', 'ft4', f4O(1.2), {}, { lage: null, grund: 'unplausibel' }],
  ['R5 fT4 1,2 ng/l ohne Bereich unplausibel', 'ft4', f4O(1.2, 'ng/l'), {}, { lage: null, grund: 'unplausibel' }],
  ['R5 fT4 12 ng/dl ohne Bereich unplausibel', 'ft4', f4O(12, 'ng/dl'), {}, { lage: null, grund: 'unplausibel' }],
  ['R5 fT3 0,5 pmol/l ohne Bereich unplausibel', 'ft3', f3O(0.5), {}, { lage: null, grund: 'unplausibel' }],
  ['R5 fT3 0,5 pg/ml ohne Bereich unplausibel', 'ft3', f3O(0.5, 'pg/ml'), {}, { lage: null, grund: 'unplausibel' }],
  ['R5 fT4 1,2 pmol/l MIT Bereich 0,9–1,7 wird gegen den Bereich eingeordnet', 'ft4', f4(1.2, 0.9, 1.7), {}, { lage: 'im', quelle: 'labor' }],
  ['fehlender Wert', 'tsh', null, {}, { lage: null, grund: 'fehlt' }],
  // Entscheidung 14 / R6: sehr niedriges fT4 < 6 pmol/l (< 0,47 ng/dl, < 4,7 ng/l).
  ['R6 fT4 5,5 pmol/l ohne Bereich sehr niedrig', 'ft4', f4O(5.5), {}, { lage: 'unter', sehrNiedrig: true }],
  ['R6 fT4 0,45 ng/dl ohne Bereich sehr niedrig', 'ft4', f4O(0.45, 'ng/dl'), {}, { lage: 'unter', sehrNiedrig: true }],
  ['R6 fT4 4,5 ng/l ohne Bereich sehr niedrig', 'ft4', f4O(4.5, 'ng/l'), {}, { lage: 'unter', sehrNiedrig: true }],
  ['R6 fT4 6,5 pmol/l ohne Bereich nicht sehr niedrig', 'ft4', f4O(6.5), {}, { lage: 'unter', sehrNiedrig: false }],
  // RW2 L3 / Entscheidung 15: einseitige Bereiche – nur gegen die vorhandene Grenze.
  ['L3 einseitig fT4 25 nur „bis 22" → über', 'ft4', { wert: 25, einheit: 'pmol/l', bis: 22 }, {}, { lage: 'ueber', quelle: 'labor' }],
  ['L3 einseitig fT4 15 nur „bis 22" → im', 'ft4', { wert: 15, einheit: 'pmol/l', bis: 22 }, {}, { lage: 'im', quelle: 'labor' }],
  ['L3 einseitig fT4 11 nur „ab 12" → unter', 'ft4', { wert: 11, einheit: 'pmol/l', von: 12 }, {}, { lage: 'unter', quelle: 'labor' }],
  ['L3 einseitig TSH 5 nur „bis 4,0" → über', 'tsh', { wert: 5, einheit: 'mU/l', bis: 4.0 }, {}, { lage: 'ueber', quelle: 'labor' }],
  // P2 / L2z1: persönlicher Zielbereich vor Laborbereich, knapp analog L1.
  ['P2 Ziel 0,1–0,5: TSH 0,2 im Ziel', 'tsh', t(0.2), { ziel: { von: 0.1, bis: 0.5 } }, { lage: 'im', quelle: 'ziel' }],
  ['P2 Ziel 0,1–0,5: TSH 0,05 unter dem Ziel', 'tsh', t(0.05), { ziel: { von: 0.1, bis: 0.5 } }, { lage: 'unter', quelle: 'ziel' }],
  ['P2 Ziel 0,1–0,5: TSH 0,53 knapp über dem Ziel', 'tsh', t(0.53), { ziel: { von: 0.1, bis: 0.5 } }, { lage: 'ueber', genau: 'knapp-ueber', quelle: 'ziel' }],
  ['P2 Ziel 0,1–0,5: TSH 0,6 über dem Ziel', 'tsh', t(0.6), { ziel: { von: 0.1, bis: 0.5 } }, { lage: 'ueber', genau: 'ueber' }],
  ['P2 Ziel gilt auch ohne Laborbereich', 'tsh', tO(0.2), { ziel: { von: 0.1, bis: 0.5 } }, { lage: 'im', quelle: 'ziel' }],
];
EINORDNEN.forEach(([name, key, w, opt, soll]) => fall(name, () => {
  const r = ez.einordnen(key, w, opt);
  sammle('einordnen', name, texteVon(r));
  if ('lage' in soll) check(`${name}: lage ${soll.lage}`, r.lage === soll.lage, `ist ${r.lage}`);
  if ('genau' in soll) check(`${name}: genau ${soll.genau}`, r.genau === soll.genau, `ist ${r.genau}`);
  if ('quelle' in soll) check(`${name}: quelle ${soll.quelle}`, r.quelle === soll.quelle, `ist ${r.quelle}`);
  if ('grund' in soll) check(`${name}: grund ${soll.grund}`, r.grund === soll.grund, `ist ${r.grund}`);
  if ('sehrNiedrig' in soll) check(`${name}: sehrNiedrig ${soll.sehrNiedrig}`, r.sehrNiedrig === soll.sehrNiedrig, `ist ${r.sehrNiedrig}`);
  if ('umgerechnet' in soll) check(`${name}: umgerechnet`, r.umgerechnet === soll.umgerechnet, `ist ${r.umgerechnet}`);
  if ('std' in soll) check(`${name}: std ≈ ${soll.std}`, nahe(r.std, soll.std), `ist ${r.std}`);
  // ENTSCHIEDEN: Der Orientierungs- und Rand-Zusatz (L1) steht in einordnen().zusatz,
  // damit Ansichten, die die Lage schon als Wort zeigen, ihn nicht doppelt setzen.
  const anzeige = [r.text, r.zusatz].filter(Boolean).join(' ');
  (soll.texte || []).forEach((x) => check(`${name}: Text „${x}"`, enthaelt(anzeige, x), auszug(anzeige)));
}));

// ================================================================ L0b / Entscheidung 13 Plausibilität

// pruefeWert: [Name, key, Wert, Rückfrage erwartet, unplausibel erwartet (undefined = nicht geprüft)]
[
  ['L0b TSH 60 mU/l → Rückfrage', 'tsh', t(60), true, false],
  ['L0b TSH 50 mU/l → keine Rückfrage', 'tsh', t(50), false, false],
  ['L0b TSH 60 µIU/ml → Rückfrage (Synonym)', 'tsh', t(60, 0.4, 4, 'µIU/ml'), true, false],
  ['RW2-L2 TSH 0,005 → Rückfrage', 'tsh', t(0.005), true, false],
  ['RW2-L2 TSH 0,01 → keine Rückfrage', 'tsh', t(0.01), false, false],
  ['TSH-Bereich UG 0,05 (< 0,1) → Rückfrage', 'tsh', t(2, 0.05, 4.0), true],
  ['TSH-Bereich UG 1,2 (> 1,0) → Rückfrage', 'tsh', t(2, 1.2, 4.0), true],
  ['TSH-Bereich OG 8 (> 7,5) → Rückfrage', 'tsh', t(2, 0.4, 8), true],
  ['TSH-Bereich OG 2,4 (< 2,5) → Rückfrage', 'tsh', t(2, 0.4, 2.4), true],
  ['TSH-Bereich 0,1–7,5 (Grenzen) → keine Rückfrage', 'tsh', t(2, 0.1, 7.5), false],
  ['fT4 2,5 pmol/l → Rückfrage, unplausibel', 'ft4', f4O(2.5), true, true],
  ['fT4 3 pmol/l → keine Rückfrage', 'ft4', f4O(3), false, false],
  ['fT4 61 pmol/l → Rückfrage, nicht unplausibel', 'ft4', f4O(61), true, false],
  ['fT4 5,5 ng/dl → Rückfrage, unplausibel', 'ft4', f4O(5.5, 'ng/dl'), true, true],
  ['fT4 0,15 ng/dl → Rückfrage', 'ft4', f4O(0.15, 'ng/dl'), true],
  ['fT4 1,2 ng/dl → keine Rückfrage', 'ft4', f4O(1.2, 'ng/dl'), false, false],
  ['R5 fT4 2 ng/l → Rückfrage, unplausibel', 'ft4', f4O(2, 'ng/l'), true, true],
  ['fT4 55 ng/l → Rückfrage, nicht unplausibel', 'ft4', f4O(55, 'ng/l'), true, false],
  ['fT4 12 ng/l → keine Rückfrage', 'ft4', f4O(12, 'ng/l'), false, false],
  ['R5 fT3 0,8 pmol/l → Rückfrage, unplausibel', 'ft3', f3O(0.8), true, true],
  ['fT3 31 pmol/l → Rückfrage', 'ft3', f3O(31), true, false],
  ['R5 fT3 0,6 pg/ml → Rückfrage, unplausibel', 'ft3', f3O(0.6, 'pg/ml'), true, true],
  ['fT3 21 pg/ml → Rückfrage', 'ft3', f3O(21, 'pg/ml'), true, false],
  ['fT3 3,5 pg/ml → keine Rückfrage', 'ft3', f3O(3.5, 'pg/ml'), false, false],
  ['TSH 2 (0,4–4,0) → keine Rückfrage', 'tsh', t(2), false, false],
].forEach(([name, key, w, rueck, unpl]) => fall(name, () => {
  const r = eh.pruefeWert(key, w);
  check(`${name}: Rückfrage ${rueck ? 'ja' : 'nein'}`, rueck ? typeof r.rueckfrage === 'string' && r.rueckfrage.length > 0 : r.rueckfrage === null,
    `rueckfrage: ${r.rueckfrage}`);
  if (unpl !== undefined) check(`${name}: unplausibel ${unpl}`, r.unplausibel === unpl, `ist ${r.unplausibel}`);
}));

// befundPruefen: blockierend (fehler) nur Zukunftsdatum und UG ≥ OG; 8×-Sprung als Rückfrage.
fall('L0b befundPruefen', () => {
  const s = baue({ ohneBefund: true });
  let r = eh.befundPruefen({ datum: plus(HEUTE, 1), tsh: t(2) }, s, HEUTE);
  check('L0b Datum morgen blockiert', r.fehler.length > 0, JSON.stringify(r));
  r = eh.befundPruefen({ datum: HEUTE, tsh: t(2) }, s, HEUTE);
  check('L0b Datum heute blockiert nicht', r.fehler.length === 0, JSON.stringify(r));
  check('L0b unauffälliger Befund: keine Rückfrage', r.rueckfragen.length === 0, JSON.stringify(r));
  // Roh wie aus dem Formular: normStand würde UG ≥ OG selbst verwerfen.
  r = eh.befundPruefen({ datum: BEFUND_TAG, tsh: { wert: 2, einheit: 'mU/l', von: 4.0, bis: 0.4 } }, s, HEUTE);
  check('L0b TSH-Untergrenze > Obergrenze blockiert', r.fehler.length > 0, JSON.stringify(r));
  r = eh.befundPruefen({ datum: BEFUND_TAG, tsh: { wert: 2, einheit: 'mU/l', von: 4.0, bis: 4.0 } }, s, HEUTE);
  check('L0b TSH-Untergrenze = Obergrenze blockiert', r.fehler.length > 0, JSON.stringify(r));
  r = eh.befundPruefen({ datum: BEFUND_TAG, tsh: t(2), ft4: { wert: 15, einheit: 'pmol/l', von: 22, bis: 12 } }, s, HEUTE);
  check('L0b fT4-Untergrenze > Obergrenze blockiert', r.fehler.length > 0, JSON.stringify(r));
  r = eh.befundPruefen({ datum: BEFUND_TAG, tsh: t(60) }, s, HEUTE);
  check('L0b TSH 60: Rückfrage, nicht blockierend', r.rueckfragen.length > 0 && r.fehler.length === 0, JSON.stringify(r));
});

// Entscheidung 13: TSH ≥ 8× größer/kleiner als der vorige Befund bei gleicher Dosis.
[
  ['8×-Sprung 1,0 → 8,0 bei gleicher Dosis → Rückfrage', 1.0, 8.0, [D1], true],
  ['1,0 → 7,5 (7,5×) → keine Sprung-Rückfrage', 1.0, 7.5, [D1], false],
  ['8×-Sprung 2,0 → 0,2 (10× kleiner) → Rückfrage', 2.0, 0.2, [D1], true],
  ['2,0 → 0,3 (6,7× kleiner) → keine Rückfrage', 2.0, 0.3, [D1], false],
  ['1,0 → 9,0 mit Dosisänderung dazwischen → keine Sprung-Rückfrage', 1.0, 9.0, dosisAb('2026-08-01', 50), false],
].forEach(([name, alt, neu, dosen, soll]) => fall(name, () => {
  const s = baue({ ohneBefund: true, vor: [V('2026-06-01', t(alt))], dosen });
  const r = eh.befundPruefen({ datum: BEFUND_TAG, tsh: t(neu) }, s, HEUTE);
  check(name, soll ? r.rueckfragen.length > 0 : r.rueckfragen.length === 0, JSON.stringify(r.rueckfragen));
  check(`${name}: nicht blockierend`, r.fehler.length === 0, JSON.stringify(r.fehler));
}));

// plausibel(): keine Rückfrage offen ODER bestätigt.
[
  ['plausibel: TSH 60 unbestätigt → nein', { tsh: t(60) }, false],
  ['plausibel: TSH 60 bestätigt → ja', { tsh: t(60), befund: { bestaetigt: true } }, true],
  ['plausibel: TSH 2 → ja', { tsh: t(2) }, true],
  ['plausibel: fT4 1,2 pmol/l unbestätigt → nein', { tsh: t(2), ft4: f4O(1.2) }, false],
].forEach(([name, f, soll]) => fall(name, () => {
  const s = baue(f);
  const b = s.labor.find((x) => x.id === 'ziel');
  check(name, eh.plausibel(b, s) === soll, `ist ${eh.plausibel(b, s)}`);
}));

// ================================================================ L2/L3 Muster und Stufen
//
// Grundprofil: 56 Jahre, nur T4, kein Herz/Knochen/Krebs/Ziel. Befund vom
// 20.09.2026, heute 27.09.2026. TSH-Bereich 0,4–4,0 mU/l, fT4 12–22 pmol/l.

// ---- L2a (Stufe keine, L3d): TSH im Bereich, fT4 im Bereich oder fehlend; „am Rand" zählt als im Bereich (L1).
[
  { name: 'L2a TSH 2,0 fT4 15', tsh: t(2), ft4: f4(15), muster: 'a', stufe: 'keine', regeln: ['L3d'], texte: ['Bereich des Labors'], notfall: 3 },
  { name: 'L2a Grenzen TSH 4,0 fT4 22', tsh: t(4.0), ft4: f4(22), muster: 'a', stufe: 'keine' },
  { name: 'L2a Grenzen TSH 0,4 fT4 12', tsh: t(0.4), ft4: f4(12), muster: 'a', stufe: 'keine' },
  { name: 'L2a ohne fT4', tsh: t(2), muster: 'a', stufe: 'keine', texte: ['nur der TSH-Wert'] },
  { name: 'L2a Orientierung (ohne Bereiche)', tsh: tO(2), ft4: f4O(15), muster: 'a', stufe: 'keine', texte: ['Orientierung', 'nicht der Bereich Ihres Labors'], verboten: ['liegen im Bereich des Labors'] },
  { name: 'L2a Orientierung TSH 4,5 am Rand', tsh: tO(4.5), ft4: f4O(15), muster: 'a', stufe: 'keine', texte: ['am Rand', 'Bereich vom Befund'] },
  { name: 'L2a Orientierung TSH 0,3 am Rand', tsh: tO(0.3), muster: 'a', stufe: 'keine', texte: ['am Rand'] },
  { name: 'L2a Orientierung fT4 10 am Rand', tsh: t(2), ft4: f4O(10), muster: 'a', stufe: 'keine', texte: ['am Rand'] },
  { name: 'L2a Orientierung fT4 24 am Rand', tsh: t(2), ft4: f4O(24), muster: 'a', stufe: 'keine' },
  { name: 'L2a Orientierung fT4 0,80 ng/dl am Rand', tsh: t(2), ft4: f4O(0.8, 'ng/dl'), muster: 'a', stufe: 'keine' },
  { name: 'L2a Orientierung fT4 1,80 ng/dl am Rand', tsh: t(2), ft4: f4O(1.8, 'ng/dl'), muster: 'a', stufe: 'keine' },
  { name: 'L2a Orientierung fT4 12 ng/l', tsh: t(2), ft4: f4O(12, 'ng/l'), muster: 'a', stufe: 'keine' },
  { name: 'L0a L2a TSH 3,5 µIU/ml', tsh: t(3.5, 0.4, 4.0, 'µIU/ml'), ft4: f4(15), muster: 'a', stufe: 'keine' },
  { name: 'L1b fT3 9 über dem Bereich ändert das Muster nicht', tsh: t(2), ft4: f4(15), ft3: f3(9), muster: 'a', stufe: 'keine' },
].forEach(pruefeFall);

// ---- L2b: TSH über + fT4 unter → Muster b, Stufe IMMER tage (Entscheidung 8, RW2 D3).
[
  { name: 'L2b TSH 6 fT4 10,5', tsh: t(6), ft4: f4(10.5), muster: 'b', stufe: 'tage', texte: ['zu wenig', 'entscheidet Ihre Ärztin'], verboten: ['beim nächsten Termin'], notfall: 3 },
  { name: 'L2b knapp über + knapp unter (4,3 / 11) → trotzdem tage', tsh: t(4.3), ft4: f4(11), muster: 'b', stufe: 'tage' },
  { name: 'L2b TSH 12 fT4 9 deutlich unter → L3a + L3e-1', tsh: t(12), ft4: f4(9), muster: 'b', stufe: 'tage', regeln: ['L3a'], notfall: 1, texte: ['Schläfrigkeit', '112'] },
  { name: 'L2b TSH 25 (> 20) → L3e-1', tsh: t(25), ft4: f4(10.5), muster: 'b', stufe: 'tage', notfall: 1 },
  { name: 'L2b fT4 ohne Bereich 9 (Orientierung)', tsh: t(6), ft4: f4O(9), muster: 'b', stufe: 'tage', texte: ['Orientierung'] },
  { name: 'L2b fT4 0,8 ng/dl (Bereich 0,93–1,71)', tsh: t(6), ft4: f4(0.8, 0.93, 1.71, 'ng/dl'), muster: 'b', stufe: 'tage' },
  { name: 'L2b unter 28 erfassten Tagen: nur L5b-Satz 3', tsh: t(6), ft4: f4(10.5), einnahmen: einnahmen(VORTAG, 10, 3), muster: 'b', stufe: 'tage', texte: ['zu selten eingetragen'], verboten: ['kein Vorwurf'] },
].forEach(pruefeFall);

// ---- L2c1/L2c2 (Termin), L2c3 (tage ab TSH > 10; L3e-1 ab TSH > 20).
[
  { name: 'L2c1 TSH 4,3 knapp über, fT4 15', tsh: t(4.3), ft4: f4(15), muster: 'c1', stufe: 'termin', regeln: ['L3c'], texte: ['knapp über', 'Schwankung'], notfall: 3 },
  { name: 'L2c1 TSH 4,3 ohne fT4', tsh: t(4.3), muster: 'c1', stufe: 'termin' },
  { name: 'L2c1 TSH 7,4 bei OG 7,0 (≤ OG + 0,5)', tsh: t(7.4, 0.5, 7.0), ft4: f4(15), muster: 'c1', stufe: 'termin' },
  { name: 'L2c2 TSH 7,6 bei OG 7,0 (> OG + 0,5)', tsh: t(7.6, 0.5, 7.0), ft4: f4(15), muster: 'c2', stufe: 'termin' },
  { name: 'L2c2 TSH 4,5 (über der knapp-Grenze 4,4)', tsh: t(4.5), ft4: f4(15), muster: 'c2', stufe: 'termin', texte: ['etwas zu wenig'] },
  { name: 'L2c2 TSH 10,0 (Grenze, nicht > 10)', tsh: t(10.0), ft4: f4(15), muster: 'c2', stufe: 'termin' },
  { name: 'L2c2 TSH 8 ohne fT4', tsh: t(8), muster: 'c2', stufe: 'termin' },
  { name: 'L2c2 Orientierung TSH 6 (> 4,5)', tsh: tO(6), muster: 'c2', stufe: 'termin', texte: ['Orientierung'] },
  { name: 'L2c3 TSH 10,1', tsh: t(10.1), ft4: f4(15), muster: 'c3', stufe: 'tage', regeln: ['L3a'], texte: ['zu wenig'], verboten: ['beim nächsten Termin'], notfall: 3 },
  { name: 'L2c3 TSH 20,0 → noch L3e-3', tsh: t(20), ft4: f4(15), muster: 'c3', stufe: 'tage', notfall: 3 },
  { name: 'L2c3 TSH 20,5 → L3e-1', tsh: t(20.5), ft4: f4(15), muster: 'c3', stufe: 'tage', notfall: 1 },
  { name: 'L2c3 Orientierung TSH 15 (feste Schwelle gilt immer)', tsh: tO(15), ft4: f4O(15), muster: 'c3', stufe: 'tage' },
  { name: 'R4 TSH 25 mIE/l → c3, L3e-1', tsh: t(25, 0.4, 4.0, 'mIE/l'), ft4: f4(15), muster: 'c3', stufe: 'tage', notfall: 1 },
  { name: 'R4 TSH 25 µIE/ml → c3', tsh: t(25, 0.4, 4.0, 'µIE/ml'), ft4: f4(15), muster: 'c3', stufe: 'tage' },
  { name: 'R4 TSH 12 mUI/l → c3', tsh: t(12, 0.4, 4.0, 'mUI/l'), muster: 'c3', stufe: 'tage' },
  { name: 'L0a TSH 12 „ µU / ml " → c3', tsh: t(12, 0.4, 4.0, ' µU / ml '), muster: 'c3', stufe: 'tage' },
].forEach(pruefeFall);

// ---- L2d (tage, L3e-2) mit R7 (knapp unter + nicht deutlich über → e1), L4b, L5c/L5d-Zusatz.
[
  { name: 'L2d TSH 0,2 fT4 25', tsh: t(0.2), ft4: f4(25), muster: 'd', stufe: 'tage', regeln: ['L3a'], notfall: 2, texte: ['zu viel', 'nicht eigenmächtig', 'Herzrasen'], verboten: ['beim nächsten Termin'] },
  { name: 'L2d TSH knapp unter 0,37 + fT4 deutlich über 27 → bleibt d', tsh: t(0.37), ft4: f4(27), muster: 'd', stufe: 'tage', notfall: 2 },
  { name: 'R7 TSH 0,37 knapp unter + fT4 23 knapp über → e1 Termin', tsh: t(0.37), ft4: f4(23), muster: 'e1', stufe: 'termin', regeln: ['R7'], notfallNicht: 2 },
  { name: 'R7 dasselbe mit 78 Jahren → e1 zeitnah', profil: { geburtsjahr: J[78] }, tsh: t(0.37), ft4: f4(23), muster: 'e1', stufe: 'zeitnah', regeln: ['R7'] },
  { name: 'R7 dasselbe mit Herzerkrankung → e1 zeitnah', profil: { herz: 'ja' }, tsh: t(0.37), ft4: f4(23), muster: 'e1', stufe: 'zeitnah' },
  { name: 'R7 mit Tablette vor der Abnahme → L5c-Satz zuerst', befund: { vorAbnahme: 'ja' }, tsh: t(0.37), ft4: f4(23), muster: 'e1', stufe: 'termin', erste: 'L5c', texte: ['vorher genommen'] },
  { name: 'L2d + Tablette vor der Abnahme: Stufe bleibt, Messungs-Zusatz', befund: { vorAbnahme: 'ja' }, tsh: t(0.2), ft4: f4(25), muster: 'd', stufe: 'tage', regeln: ['L5c'], texte: ['an der Messung liegen'] },
  { name: 'L2d + Biotin: Stufe bleibt, Biotin als erste Erklärung', befund: { biotin: 'ja' }, tsh: t(0.2), ft4: f4(25), muster: 'd', stufe: 'tage', regeln: ['L5d'], erste: 'L5d', texte: ['Biotin', 'an der Messung liegen'] },
  { name: 'L4b L2d mit 78 Jahren', profil: { geburtsjahr: J[78] }, tsh: t(0.2), ft4: f4(25), muster: 'd', stufe: 'tage', regeln: ['L4b'], texte: ['Vorhofflimmern', 'Knochen'] },
  { name: 'L4b L2d ohne Geburtsjahr (Entscheidung 7)', profil: { geburtsjahr: null }, tsh: t(0.2), ft4: f4(25), muster: 'd', stufe: 'tage', regeln: ['L4b'] },
  { name: 'L2d Orientierung TSH 0,2 + fT4 25', tsh: tO(0.2), ft4: f4O(25), muster: 'd', stufe: 'tage' },
  { name: 'L2d fT4 20 ng/l (Bereich 9,3–17,1)', tsh: t(0.2), ft4: f4(20, 9.3, 17.1, 'ng/l'), muster: 'd', stufe: 'tage' },
].forEach(pruefeFall);

// ---- L2e1/L2e2 (Termin; L4b: ≥ 65, Herz, Osteoporose → zeitnah), L2e3 (tage, L3e-2).
[
  { name: 'L2e1 TSH 0,37 fT4 15', tsh: t(0.37), ft4: f4(15), muster: 'e1', stufe: 'termin', texte: ['knapp unter'] },
  { name: 'L2e1 TSH 0,37 ohne fT4', tsh: t(0.37), muster: 'e1', stufe: 'termin' },
  { name: 'L2e1 mit 78 Jahren bleibt Termin (L4b nur d, e2, e3, L2t)', profil: { geburtsjahr: J[78] }, tsh: t(0.37), ft4: f4(15), muster: 'e1', stufe: 'termin', ohneRegeln: ['L4b'] },
  { name: 'L2e2 TSH 0,35 (unter der knapp-Grenze 0,36)', tsh: t(0.35), ft4: f4(15), muster: 'e2', stufe: 'termin', texte: ['etwas zu viel'], ohneRegeln: ['L4b'] },
  { name: 'L2e2 TSH 0,1 (Grenze, noch ≥ 0,1)', tsh: t(0.1), ft4: f4(15), muster: 'e2', stufe: 'termin' },
  { name: 'L2e2 mit 64 Jahren → Termin', profil: { geburtsjahr: J[64] }, tsh: t(0.2), ft4: f4(15), muster: 'e2', stufe: 'termin', ohneRegeln: ['L4b'] },
  { name: 'L4b L2e2 mit 65 Jahren → zeitnah', profil: { geburtsjahr: J[65] }, tsh: t(0.2), ft4: f4(15), muster: 'e2', stufe: 'zeitnah', regeln: ['L4b'], texte: ['Vorhofflimmern', 'nicht eigenmächtig'] },
  { name: 'L4b L2e2 Herz ja → zeitnah', profil: { herz: 'ja' }, tsh: t(0.2), muster: 'e2', stufe: 'zeitnah', regeln: ['L4b'] },
  { name: 'L4b L2e2 Osteoporose ja → zeitnah', profil: { osteoporose: 'ja' }, tsh: t(0.2), muster: 'e2', stufe: 'zeitnah', regeln: ['L4b'] },
  { name: 'L4b L2e2 ohne Geburtsjahr → zeitnah (Entscheidung 7)', profil: { geburtsjahr: null }, tsh: t(0.2), muster: 'e2', stufe: 'zeitnah', regeln: ['L4b'] },
  { name: 'L2e2 Orientierung TSH 0,25', tsh: tO(0.25), muster: 'e2', stufe: 'termin' },
  { name: 'L2e3 TSH 0,09 fT4 15', tsh: t(0.09), ft4: f4(15), muster: 'e3', stufe: 'tage', regeln: ['L3a'], notfall: 2, texte: ['zu viel', 'nicht eigenmächtig'], verboten: ['beim nächsten Termin'] },
  { name: 'L2e3 TSH 0,05 ohne fT4', tsh: t(0.05), muster: 'e3', stufe: 'tage', notfall: 2 },
  { name: 'L4b L2e3 mit 78 Jahren bleibt tage', profil: { geburtsjahr: J[78] }, tsh: t(0.05), ft4: f4(15), muster: 'e3', stufe: 'tage', regeln: ['L4b'] },
  { name: 'L2e3 Orientierung TSH 0,09 (feste Schwelle gilt immer)', tsh: tO(0.09), muster: 'e3', stufe: 'tage' },
  { name: 'R4 L2e3 TSH 0,05 mIE/l', tsh: t(0.05, 0.4, 4.0, 'mIE/l'), muster: 'e3', stufe: 'tage' },
].forEach(pruefeFall);

// ---- L2f (zeitnah; fT4 deutlich über bei TSH über → tage nach L3a), L5b-Satz 2 bei f.
[
  { name: 'L2f TSH 6 fT4 25', tsh: t(6), ft4: f4(25), muster: 'f', stufe: 'zeitnah', regeln: ['L3b'], texte: ['ungewöhnliches Muster', 'beide erhöht'] },
  { name: 'L2f knapp über + knapp über (4,3 / 23)', tsh: t(4.3), ft4: f4(23), muster: 'f', stufe: 'zeitnah' },
  { name: 'L2f fT4 deutlich über 27 → tage (L3a)', tsh: t(6), ft4: f4(27), muster: 'f', stufe: 'tage', regeln: ['L3a'] },
  { name: 'L2f + L5b (3 von 42 Tagen nicht genommen) → Satz 1 und 2', tsh: t(6), ft4: f4(25), einnahmen: einnahmen(VORTAG, 42, 3), muster: 'f', stufe: 'zeitnah', regeln: ['L5b'], texte: ['nicht genommen', 'kein Vorwurf', 'nachgeholt'] },
  { name: 'L2f + Biotin: erklärt nur das fT4', befund: { biotin: 'ja' }, tsh: t(6), ft4: f4(25), muster: 'f', stufe: 'zeitnah', texte: ['nicht aber das erhöhte TSH'] },
].forEach(pruefeFall);

// ---- L2g1 (Termin) / L2g2 (zeitnah; fT4 deutlich unter → tage + L3e-1), R6 Orientierung.
[
  { name: 'L2g1 TSH 2 fT4 11', tsh: t(2), ft4: f4(11), muster: 'g1', stufe: 'termin', regeln: ['L3c'], texte: ['fT4 etwas niedrig', 'T3-Anteil'] },
  { name: 'L2g1 fT4 9,7 (knapp über UG × 0,8)', tsh: t(2), ft4: f4(9.7), muster: 'g1', stufe: 'termin' },
  { name: 'L2g1 Orientierung fT4 8,5 (≥ 8)', tsh: t(2), ft4: f4O(8.5), muster: 'g1', stufe: 'termin', texte: ['Orientierung'] },
  { name: 'L2g1 fT4 0,8 ng/dl (Bereich 0,93–1,71)', tsh: t(2), ft4: f4(0.8, 0.93, 1.71, 'ng/dl'), muster: 'g1', stufe: 'termin' },
  { name: 'L2g1 fT4 8 ng/l (Bereich 9,3–17,1)', tsh: t(2), ft4: f4(8, 9.3, 17.1, 'ng/l'), muster: 'g1', stufe: 'termin' },
  { name: 'L2g1 T3-Präparat, fT4 deutlich unter (7) → g1, Termin (Ausnahme L3a)', profil: T3, tsh: t(2), ft4: f4(7), muster: 'g1', stufe: 'termin' },
  { name: 'L2g2 TSH 0,2 + fT4 10,5 (beide unter)', tsh: t(0.2), ft4: f4(10.5), muster: 'g2', stufe: 'zeitnah', regeln: ['L3b'], texte: ['ungewöhnliches Muster', 'andere Hormonstörung'] },
  { name: 'L2g2 TSH 2 + fT4 9 (deutlich unter) → tage, L3e-1', tsh: t(2), ft4: f4(9), muster: 'g2', stufe: 'tage', regeln: ['L3a'], notfall: 1 },
  { name: 'L2g2 fT4 0,7 ng/dl (Bereich 0,93–1,71, deutlich unter)', tsh: t(2), ft4: f4(0.7, 0.93, 1.71, 'ng/dl'), muster: 'g2', stufe: 'tage', notfall: 1 },
  { name: 'R6 Orientierung fT4 7,5 pmol/l → höchstens zeitnah, kein L3e-1', tsh: t(2), ft4: f4O(7.5), muster: 'g2', stufe: 'zeitnah', notfallNicht: 1 },
  { name: 'R6 Orientierung fT4 0,60 ng/dl bei TSH 2,5 → zeitnah, Bereich eintragen', tsh: t(2.5), ft4: f4O(0.6, 'ng/dl'), muster: 'g2', stufe: 'zeitnah', notfallNicht: 1, texte: ['Bereich vom Befund'] },
  { name: 'R6 Orientierung fT4 6,5 pmol/l (knapp über 6) → zeitnah', tsh: t(2), ft4: f4O(6.5), muster: 'g2', stufe: 'zeitnah', notfallNicht: 1 },
  { name: 'R6 Orientierung fT4 5,5 pmol/l (< 6) → tage, L3e-1', tsh: t(2), ft4: f4O(5.5), muster: 'g2', stufe: 'tage', notfall: 1 },
  { name: 'R6 Orientierung fT4 0,45 ng/dl (< 0,47) → tage', tsh: t(2), ft4: f4O(0.45, 'ng/dl'), muster: 'g2', stufe: 'tage', notfall: 1 },
  { name: 'R6 Orientierung fT4 4,5 ng/l (< 4,7) → tage', tsh: t(2), ft4: f4O(4.5, 'ng/l'), muster: 'g2', stufe: 'tage', notfall: 1 },
  { name: 'R6 Ausnahme TSH > 10: fT4 7,5 ohne Bereich + TSH 12 → b, L3e-1', tsh: t(12), ft4: f4O(7.5), muster: 'b', stufe: 'tage', notfall: 1 },
].forEach(pruefeFall);

// ---- L2h (Termin; fT4 deutlich über ohne L5c/L5d → zeitnah).
[
  { name: 'L2h TSH 2 fT4 24', tsh: t(2), ft4: f4(24), muster: 'h', stufe: 'termin', texte: ['vor allem der TSH-Wert'] },
  { name: 'L2h fT4 26,3 (≤ OG × 1,2) → Termin', tsh: t(2), ft4: f4(26.3), muster: 'h', stufe: 'termin' },
  { name: 'L2h fT4 27 deutlich über ohne Erklärung → zeitnah', tsh: t(2), ft4: f4(27), muster: 'h', stufe: 'zeitnah', regeln: ['L3b'] },
  { name: 'L2h fT4 27 + Tablette vor der Abnahme → Termin', befund: { vorAbnahme: 'ja' }, tsh: t(2), ft4: f4(27), muster: 'h', stufe: 'termin', regeln: ['L5c'], texte: ['einige Stunden'] },
  { name: 'L2h fT4 27 + Biotin im Profil, Befundfrage nein → Termin, „Falls Sie"', mittel: ['biotin'], befund: { biotin: 'nein' }, tsh: t(2), ft4: f4(27), muster: 'h', stufe: 'termin', erste: 'L5d', texte: ['Falls Sie', 'zu viel Hormon'] },
  { name: 'L2h Orientierung fT4 25', tsh: t(2), ft4: f4O(25), muster: 'h', stufe: 'termin' },
  { name: 'L2h Orientierung fT4 27 (deutlich) → zeitnah', tsh: t(2), ft4: f4O(27), muster: 'h', stufe: 'zeitnah' },
  { name: 'L2h fT4 2,0 ng/dl (Bereich 0,93–1,71, × 1,17) → Termin', tsh: t(2), ft4: f4(2.0, 0.93, 1.71, 'ng/dl'), muster: 'h', stufe: 'termin' },
  { name: 'L2h fT4 2,1 ng/dl (Bereich 0,93–1,71, × 1,23) → zeitnah', tsh: t(2), ft4: f4(2.1, 0.93, 1.71, 'ng/dl'), muster: 'h', stufe: 'zeitnah' },
].forEach(pruefeFall);

// ---- L2t: T3-Präparat, TSH unter, fT4 nicht über (ersetzt e1–e3); R8.
[
  { name: 'L2t TSH 0,2 fT4 15', profil: T3, tsh: t(0.2), ft4: f4(15), muster: 't', stufe: 'termin', regeln: ['L3c'], texte: ['T3-Anteil', 'gewollt'] },
  { name: 'L2t ersetzt e1 (TSH 0,37)', profil: T3, tsh: t(0.37), ft4: f4(15), muster: 't', stufe: 'termin' },
  { name: 'L4b L2t mit 70 Jahren → zeitnah', profil: { ...T3, geburtsjahr: J[70] }, tsh: t(0.2), ft4: f4(15), muster: 't', stufe: 'zeitnah', regeln: ['L4b'] },
  { name: 'L2t TSH 0,05, 56 Jahre, ohne Herz → zeitnah, L3e-3', profil: T3, tsh: t(0.05), ft4: f4(15), muster: 't', stufe: 'zeitnah', notfall: 3 },
  { name: 'R8 L2t TSH 0,02 mit 78 Jahren → tage, L3e-2', profil: { ...T3, geburtsjahr: J[78] }, tsh: t(0.02), muster: 't', stufe: 'tage', regeln: ['R8'], notfall: 2, texte: ['nicht beabsichtigt'] },
  { name: 'R8 L2t TSH 0,05 Herz ja → tage', profil: { ...T3, herz: 'ja' }, tsh: t(0.05), muster: 't', stufe: 'tage', notfall: 2 },
  { name: 'R8 L2t TSH 0,05 Osteoporose ja → tage', profil: { ...T3, osteoporose: 'ja' }, tsh: t(0.05), muster: 't', stufe: 'tage' },
  { name: 'R8 L2t TSH 0,05 ohne Geburtsjahr → tage (Entscheidung 7)', profil: { ...T3, geburtsjahr: null }, tsh: t(0.05), muster: 't', stufe: 'tage' },
  // L2t: „fT3 über dem Bereich bei TSH unter → wie L2d behandeln" – Muster-Kürzel t oder d.
  { name: 'L2t fT3 über dem Bereich → wie L2d: tage, fT3-Satz, L3e-2', profil: T3, tsh: t(0.2), ft4: f4(15), ft3: f3(8), muster: ['t', 'd'], stufe: 'tage', notfall: 2, texte: ['fT3 ist ebenfalls erhöht', 'nicht eigenmächtig'] },
  { name: 'L2t: TSH unter + fT4 unter → g2 (T3 als Grund)', profil: T3, tsh: t(0.2), ft4: f4(10.5), muster: 'g2', stufe: 'zeitnah', texte: ['T3-Anteil'] },
  { name: 'L2t gilt nicht bei fT4 über → d', profil: T3, tsh: t(0.2), ft4: f4(25), muster: 'd', stufe: 'tage' },
  { name: 'P3 Präparat unbekannt rechnet wie T4 → e2', profil: { praeparatArt: 'unbekannt' }, tsh: t(0.2), ft4: f4(15), muster: 'e2', stufe: 'termin' },
].forEach(pruefeFall);

// ---- L2z1: persönlicher Zielbereich (Vorrang vor Labor und Alter), R11, R12.
[
  { name: 'L2z1 TSH 0,2 im Ziel 0,1–0,5, unter dem Laborbereich', profil: ZIEL(0.1, 0.5), tsh: t(0.2), ft4: f4(15), muster: 'a', stufe: 'keine', ziel: true, regeln: ['L2z1'], texte: ['Zielbereich', 'außerhalb des Bereichs des Labors'] },
  { name: 'L2z1 TSH 0,05 unter dem Ziel 0,1–0,5 → e3, tage', profil: ZIEL(0.1, 0.5), tsh: t(0.05), ft4: f4(15), muster: 'e3', stufe: 'tage', ziel: true, texte: ['persönlichen Zielbereich'] },
  { name: 'L2z1 TSH 0,08 im Ziel 0,05–0,5: feste Schwelle < 0,1 greift nicht', profil: ZIEL(0.05, 0.5), tsh: t(0.08), ft4: f4(15), muster: 'a', stufe: 'keine', ziel: true },
  { name: 'R12 TSH 0,08 im Ziel, 78 Jahre → mindestens zeitnah', profil: { ...ZIEL(0.05, 0.5), geburtsjahr: J[78] }, tsh: t(0.08), ft4: f4(15), stufeMin: 'zeitnah', regeln: ['R12'] },
  { name: 'R12 TSH 0,08 im Ziel, Herz ja → mindestens zeitnah', profil: { ...ZIEL(0.05, 0.5), herz: 'ja' }, tsh: t(0.08), stufeMin: 'zeitnah' },
  { name: 'R12 TSH 0,08 im Ziel, ohne Geburtsjahr → mindestens zeitnah (Entscheidung 7)', profil: { ...ZIEL(0.05, 0.5), geburtsjahr: null }, tsh: t(0.08), stufeMin: 'zeitnah' },
  { name: 'R12 TSH 0,15 im Ziel, 78 Jahre → keine Anhebung, L4b entfällt', profil: { ...ZIEL(0.05, 0.5), geburtsjahr: J[78] }, tsh: t(0.15), ft4: f4(15), muster: 'a', stufe: 'keine', ohneRegeln: ['L4b'] },
  { name: 'R12 Zielbereich älter als 12 Monate → Rückfrage', profil: ZIEL(0.1, 0.5, '2025-06-01'), tsh: t(0.2), muster: 'a', texte: ['Zielbereich noch'] },
  { name: 'R12 Zielbereich frisch → keine Rückfrage', profil: ZIEL(0.1, 0.5, '2026-06-01'), tsh: t(0.2), muster: 'a', verboten: ['Zielbereich noch'] },
  { name: 'L2z1 TSH 3,0 über dem Ziel 0,5–2,0 (im Laborbereich) → c2', profil: ZIEL(0.5, 2.0), tsh: t(3.0), ft4: f4(15), muster: 'c2', stufe: 'termin', ziel: true, texte: ['persönlichen Zielbereich'] },
  { name: 'L2z1 TSH 2,1 knapp über dem Ziel 0,5–2,0 → c1', profil: ZIEL(0.5, 2.0), tsh: t(2.1), ft4: f4(15), muster: 'c1', stufe: 'termin', ziel: true },
  { name: 'L2z1 ersetzt L4a: 72 Jahre, TSH 5,5, Ziel 0,5–2,0', profil: { ...ZIEL(0.5, 2.0), geburtsjahr: J[72] }, tsh: t(5.5), ft4: f4(15), muster: 'c2', stufe: 'termin', ohneRegeln: ['L4a'] },
  { name: 'L2z1 TSH 12 außerhalb des Ziels 0,1–0,5 → c3, tage', profil: ZIEL(0.1, 0.5), tsh: t(12), ft4: f4(15), muster: 'c3', stufe: 'tage' },
  { name: 'R11 Ziel 0,05–0,5, TSH 0,1 + fT4 11 → g2 zeitnah (nicht g1)', profil: ZIEL(0.05, 0.5), tsh: t(0.1), ft4: f4(11), muster: 'g2', stufe: 'zeitnah', regeln: ['R11'] },
].forEach(pruefeFall);

// ---- L2z2: zielNiedrig = ja ohne Zahlen-Ziel (A Termin, B zeitnah/tage, C zeitnah), R11.
[
  { name: 'L2z2 A TSH 0,2, fT4 15', profil: NIEDRIG, tsh: t(0.2), ft4: f4(15), muster: 'z2a', stufe: 'termin', texte: ['bewusst niedrig'] },
  { name: 'L2z2 A TSH 0,05 (feste Schwelle löst nicht tage aus)', profil: NIEDRIG, tsh: t(0.05), ft4: f4(15), muster: 'z2a', stufe: 'termin' },
  { name: 'L2z2 A ohne fT4', profil: NIEDRIG, tsh: t(0.2), muster: 'z2a', stufe: 'termin' },
  // MEHRDEUTIG: R12 nennt nur den Zielbereich („auch im Ziel nicht unter zeitnah");
  // zielNiedrig ist die andere Form eines ärztlichen Ziels – sicherere Lesart: gilt auch hier.
  { name: 'R12 zielNiedrig, TSH 0,05, 78 Jahre → mindestens zeitnah', profil: { ...NIEDRIG, geburtsjahr: J[78] }, tsh: t(0.05), ft4: f4(15), stufeMin: 'zeitnah' },
  { name: 'L2z2 A 78 Jahre, TSH 0,2: L4b entfällt', profil: { ...NIEDRIG, geburtsjahr: J[78] }, tsh: t(0.2), ft4: f4(15), muster: 'z2a', stufe: 'termin', ohneRegeln: ['L4b'] },
  { name: 'L2z2 B TSH 0,2 + fT4 25 → zeitnah', profil: NIEDRIG, tsh: t(0.2), ft4: f4(25), muster: 'z2b', stufe: 'zeitnah', texte: ['über dem Bereich'] },
  { name: 'L2z2 B fT4 deutlich über 27 → tage', profil: NIEDRIG, tsh: t(0.2), ft4: f4(27), muster: 'z2b', stufe: 'tage' },
  { name: 'L2z2 C TSH 2,0 → zeitnah', profil: NIEDRIG, tsh: t(2), ft4: f4(15), muster: 'z2c', stufe: 'zeitnah', texte: ['gewollten Senkung'] },
  { name: 'L2z2 C TSH 5 → zeitnah', profil: NIEDRIG, tsh: t(5), muster: 'z2c', stufe: 'zeitnah' },
  { name: 'L2z2 C bei TSH 12 gilt L2c3 → tage', profil: NIEDRIG, tsh: t(12), ft4: f4(15), muster: 'c3', stufe: 'tage' },
  { name: 'L2z2 C bei TSH 12 + fT4 10 gilt L2b → tage', profil: NIEDRIG, tsh: t(12), ft4: f4(10), muster: 'b', stufe: 'tage' },
  { name: 'R11 zielNiedrig, TSH 0,2 + fT4 10,5 → g2 zeitnah (nicht Text A)', profil: NIEDRIG, tsh: t(0.2), ft4: f4(10.5), muster: 'g2', stufe: 'zeitnah', regeln: ['R11'], verboten: ['so gewollt sein'] },
  { name: 'L2z2 nur bei „ja": zielNiedrig unbekannt → e2', profil: { zielNiedrig: 'unbekannt' }, tsh: t(0.2), ft4: f4(15), muster: 'e2', stufe: 'termin' },
].forEach(pruefeFall);

// ---- L2z3: Krebs (profil.krebs = ja, Entscheidung 1) ohne Ziel und ohne zielNiedrig.
// MEHRDEUTIG: Die Regel L2z3 sagt „TSH ≥ 0,1: Termin", L3b ordnet aber „L2z3" pauschal
// der Stufe zeitnah zu (und L3c nennt L2z3 nicht). Sicherere Lesart: zeitnah auch bei TSH ≥ 0,1.
[
  { name: 'L2z3 Krebs, TSH 0,2, fT4 15', profil: KREBS, tsh: t(0.2), ft4: f4(15), muster: 'z3', stufe: 'zeitnah', texte: ['Schilddrüsenkrebs', 'Zielbereich', 'wie verordnet'] },
  { name: 'L2z3 Krebs, TSH 0,05 → zeitnah (nicht tage)', profil: KREBS, tsh: t(0.05), ft4: f4(15), muster: 'z3', stufe: 'zeitnah' },
  { name: 'L2z3 Krebs, TSH 0,2 + fT4 25 → zeitnah', profil: KREBS, tsh: t(0.2), ft4: f4(25), muster: 'z3', stufe: 'zeitnah' },
  { name: 'L2z3 Krebs, TSH 0,2 + fT4 27 (deutlich) → tage', profil: KREBS, tsh: t(0.2), ft4: f4(27), muster: 'z3', stufe: 'tage' },
  { name: 'L2z3 andere Muster normal: TSH 2 → a', profil: KREBS, tsh: t(2), ft4: f4(15), muster: 'a', stufe: 'keine' },
  { name: 'L2z3 andere Muster normal: TSH 6 → c2', profil: KREBS, tsh: t(6), ft4: f4(15), muster: 'c2', stufe: 'termin' },
  { name: 'L2z3 nur bei krebs = ja: unbekannt → e2', profil: { krebs: 'unbekannt' }, tsh: t(0.2), ft4: f4(15), muster: 'e2', stufe: 'termin' },
  { name: 'L2z3 entfällt mit Zielbereich', profil: { ...KREBS, ...ZIEL(0.05, 0.5) }, tsh: t(0.2), ft4: f4(15), muster: 'a', stufe: 'keine', ziel: true },
  { name: 'L2z3 entfällt mit zielNiedrig', profil: { ...KREBS, ...NIEDRIG }, tsh: t(0.2), ft4: f4(15), muster: 'z2a', stufe: 'termin' },
].forEach(pruefeFall);

// ---- L4a: ≥ 70, TSH über ≤ 6 (ab 80 ≤ 7), fT4 im/fehlend, nicht b, nicht gestiegen, kein Ziel.
[
  { name: 'L4a 72 Jahre, TSH 5,5', profil: { geburtsjahr: J[72] }, tsh: t(5.5), ft4: f4(15), muster: 'c2', stufe: 'termin', regeln: ['L4a'], texte: ['höherer TSH-Wert'] },
  { name: 'L4a 72 Jahre, TSH 6,0 (Grenze)', profil: { geburtsjahr: J[72] }, tsh: t(6.0), muster: 'c2', stufe: 'termin', regeln: ['L4a'] },
  { name: 'L4a 72 Jahre, TSH 6,1 → nicht', profil: { geburtsjahr: J[72] }, tsh: t(6.1), muster: 'c2', ohneRegeln: ['L4a'], verboten: ['höherer TSH-Wert'] },
  { name: 'L4a 82 Jahre, TSH 6,8', profil: { geburtsjahr: J[82] }, tsh: t(6.8), muster: 'c2', regeln: ['L4a'] },
  { name: 'L4a 82 Jahre, TSH 7,0 (Grenze ab 80)', profil: { geburtsjahr: J[82] }, tsh: t(7.0), muster: 'c2', regeln: ['L4a'] },
  { name: 'L4a 82 Jahre, TSH 7,1 → nicht', profil: { geburtsjahr: J[82] }, tsh: t(7.1), muster: 'c2', ohneRegeln: ['L4a'] },
  { name: 'L4a 70 Jahre, TSH 5,5', profil: { geburtsjahr: J[70] }, tsh: t(5.5), muster: 'c2', regeln: ['L4a'] },
  { name: 'L4a 69 Jahre → nicht', profil: { geburtsjahr: J[69] }, tsh: t(5.5), muster: 'c2', ohneRegeln: ['L4a'] },
  { name: 'L4a ohne Geburtsjahr → nicht (Entscheidung 7)', profil: { geburtsjahr: null }, tsh: t(5.5), muster: 'c2', ohneRegeln: ['L4a'] },
  { name: 'L4a nicht bei Muster b', profil: { geburtsjahr: J[72] }, tsh: t(5.5), ft4: f4(10.5), muster: 'b', stufe: 'tage', ohneRegeln: ['L4a'] },
  { name: 'L4a nicht bei gestiegenem TSH (2,0 → 5,5)', profil: { geburtsjahr: J[72] }, vor: [V('2026-03-01', t(2.0))], tsh: t(5.5), muster: 'c2', regeln: ['L6'], ohneRegeln: ['L4a'], texte: ['gestiegen'] },
  { name: 'L4a auch bei knapp über (c1)', profil: { geburtsjahr: J[72] }, tsh: t(4.3), muster: 'c1', regeln: ['L4a'] },
  { name: 'L4a nicht bei zielNiedrig', profil: { geburtsjahr: J[72], ...NIEDRIG }, tsh: t(5.5), muster: 'z2c', ohneRegeln: ['L4a'] },
].forEach(pruefeFall);

// ---- L0a/R5/Grundsatz 7 in der Befund-Einschätzung; „ein Laborwert allein nie 112" (Grundsatz 5).
[
  { name: 'L0a unbekannte TSH-Einheit mit Bereich → nur gegen den Laborbereich', tsh: t(3, 0.4, 4.0, 'mg'), muster: 'a' },
  { name: 'L0a unbekannte TSH-Einheit ohne Bereich → keine Einordnung', tsh: tO(3, 'mg'), muster: null, texte: ['Diese Einheit kennt die App nicht'] },
  {
    name: 'R5 fT4 1,2 pmol/l ohne Bereich, bestätigt → keine Einordnung, kein g2/tage', tsh: t(2), ft4: f4O(1.2), befund: { bestaetigt: true },
    stufeMax: 'zeitnah', notfallNicht: 1, texte: ['Einheit'], pruef: (E) => [['kein Muster g1/g2', !['g1', 'g2'].includes(E.muster), `ist ${E.muster}`]],
  },
  {
    name: 'R5 fT4 1,2 ng/l ohne Bereich, bestätigt → kein g2/tage', tsh: t(2), ft4: f4O(1.2, 'ng/l'), befund: { bestaetigt: true },
    stufeMax: 'zeitnah', notfallNicht: 1, pruef: (E) => [['kein Muster g1/g2', !['g1', 'g2'].includes(E.muster), `ist ${E.muster}`]],
  },
  { name: 'R5 fT4 1,2 pmol/l MIT Bereich 0,9–1,7 wird eingeordnet → a', tsh: t(2), ft4: f4(1.2, 0.9, 1.7), muster: 'a', stufe: 'keine' },
  { name: 'L0b TSH 60 bestätigt → normale Auswertung: c3, tage, L3e-1', tsh: t(60), ft4: f4(12.5), befund: { bestaetigt: true }, muster: 'c3', stufe: 'tage', notfall: 1 },
  { name: 'Grundsatz 5: TSH 80 + fT4 3,5 → tage, nie notruf', tsh: t(80), ft4: f4(3.5), befund: { bestaetigt: true }, muster: 'b', stufe: 'tage', notfall: 1 },
  { name: 'Grundsatz 5: TSH 0,005 + fT4 59 → tage, nie notruf', tsh: t(0.005), ft4: f4(59), befund: { bestaetigt: true }, muster: 'd', stufe: 'tage', notfall: 2 },
  {
    name: 'Grundsatz 7: Anzeige mit Originalwert (fT4 1,2 ng/dl)', tsh: t(2), ft4: f4O(1.2, 'ng/dl'), muster: 'a',
    pruef: (E) => {
      const w = (E.werte || []).find((x) => x.key === 'ft4');
      const roh = w && (typeof w.wert === 'number' ? w.wert : w.wert && w.wert.wert);
      return [
        ['fT4 steht in E.werte', !!w, JSON.stringify(E.werte)],
        ['fT4 mit Originalwert 1,2', roh === 1.2, `ist ${roh}`],
        ['fT4 als umgerechnet markiert', !!(w && w.einordnung && w.einordnung.umgerechnet === true), JSON.stringify(w && w.einordnung)],
      ];
    },
  },
].forEach(pruefeFall);

// ---- L3f / R1: Praxis hat den Befund schon erklärt (praxis ∈ bleibt|geaendert|nachmessen,
// Angabe NACH dem Befunddatum). Der Praxis-Satz ersetzt nur die Laborstufe.
const PRAXIS_BASIS = { profil: { geburtsjahr: J[78] }, tsh: t(0.05), ft4: f4(15) };
[
  ['bleibt', '2026-09-22', true], ['geaendert', '2026-09-22', true], ['nachmessen', '2026-09-22', true],
  ['nochnicht', '2026-09-22', false], ['', null, false],
].forEach(([praxis, praxisAm, erklaert]) => pruefeFall({
  ...PRAXIS_BASIS,
  name: `L3f Praxis „${praxis || 'leer'}" → erklärt = ${erklaert}`,
  befund: { praxis, praxisAm },
  muster: 'e3',
  pruef: (E) => [
    ['praxisErklaert', E.praxisErklaert === erklaert, `ist ${E.praxisErklaert}`],
    ['berechnete Laborstufe bleibt tage (für den Bericht)', E.stufeLabor === 'tage', `ist ${E.stufeLabor}`],
    erklaert
      ? ['Praxis-Satz', enthaelt(E.praxisText || '', 'schon erklärt'), `praxisText: ${E.praxisText}`]
      : ['ohne Praxis-Satz: Stufe tage', E.stufe === 'tage', `ist ${E.stufe}`],
  ],
}));
pruefeFall({
  ...PRAXIS_BASIS,
  name: 'R1 Praxis-Angabe VOR dem Befunddatum zählt nicht',
  befund: { praxis: 'bleibt', praxisAm: '2026-09-10' },
  muster: 'e3', stufe: 'tage',
  pruef: (E) => [['praxisErklaert false', E.praxisErklaert === false, `ist ${E.praxisErklaert}`]],
});
pruefeFall({
  ...PRAXIS_BASIS,
  name: 'R1 neue Herzklopfen-Beschwerde nach dem Gespräch: Stufe bleibt sichtbar',
  befund: { praxis: 'bleibt', praxisAm: '2026-09-22' },
  befinden: [bf('2026-09-25', 'herz')],
  muster: 'e3', stufeMin: 'tage',
  pruef: (E, s) => {
    const g = ez.gesamtbild(s, HEUTE);
    const b = ez.beschwerdenAuswerten(s, HEUTE);
    return [
      ['Gesamtbild mindestens tage', rang(g.stufe) >= rang('tage'), `ist ${g.stufe}`],
      ['Beschwerden: S4 (ii) mit R3 (≥ 65) → heute', b.stufe === 'heute', `ist ${b.stufe}`],
    ];
  },
});

// ================================================================ L5 Erklärungen, L6 Verlauf, L1b fT3

// ---- L5a: < 42 Tage vor der Abnahme Dosis-/Präparatwechsel (jeder weitere Dosis-Eintrag,
// Entscheidung 3), packung = ja oder mittelGeaendert = ja – bei allen Mustern.
[
  { name: 'L5a Dosisänderung 31 Tage vor der Abnahme (Muster a)', dosen: dosisAb('2026-08-20'), tsh: t(2), muster: 'a', regeln: ['L5a'], texte: ['6 Wochen', 'eingependelt'] },
  { name: 'L5a Grenze: Änderung 41 Tage vorher', dosen: dosisAb('2026-08-10'), tsh: t(2), regeln: ['L5a'] },
  { name: 'L5a nicht bei 42 Tagen', dosen: dosisAb('2026-08-09'), tsh: t(2), ohneRegeln: ['L5a'] },
  { name: 'L5a Präparatwechsel gleicher Stärke (weiterer Dosis-Eintrag)', dosen: dosisAb('2026-09-01', 75, 'Euthyrox'), tsh: t(2), regeln: ['L5a'] },
  { name: 'L5a Befundfrage packung = ja', befund: { packung: 'ja' }, tsh: t(6), muster: 'c2', regeln: ['L5a'] },
  { name: 'L5a Befundfrage mittelGeaendert = ja', befund: { mittelGeaendert: 'ja' }, tsh: t(0.2), muster: 'e2', regeln: ['L5a'] },
  { name: 'L5a nicht bei packung = unbekannt (RW1 nur „ja", Entscheidung 6)', befund: { packung: 'unbekannt' }, tsh: t(6), ohneRegeln: ['L5a'] },
].forEach(pruefeFall);

// ---- L5b: ab 28 erfassten von 42 Tagen; ≥ 3 nicht genommen; nur b, c, f; R9 „mehrere".
[
  { name: 'L5b 3 von 42 Tagen nicht genommen bei c2', einnahmen: einnahmen(VORTAG, 42, 3), tsh: t(6), muster: 'c2', regeln: ['L5b'], texte: ['nicht genommen', 'kein Vorwurf', 'vergessenen Tabletten'] },
  { name: 'L5b 2 von 42 nicht genommen → kein Hinweis', einnahmen: einnahmen(VORTAG, 42, 2), tsh: t(6), muster: 'c2', verboten: ['kein Vorwurf', 'zu selten eingetragen'] },
  { name: 'L5b genau 28 erfasste Tage, 3 nicht genommen', einnahmen: einnahmen(VORTAG, 28, 3), tsh: t(6), muster: 'c2', regeln: ['L5b'], texte: ['kein Vorwurf'] },
  { name: 'L5b 27 erfasste Tage → nur Satz 3', einnahmen: einnahmen(VORTAG, 27, 3), tsh: t(6), muster: 'c2', texte: ['zu selten eingetragen'], verboten: ['kein Vorwurf'] },
  { name: 'L5b nicht erfasste Tage zählen nicht als vergessen (30 erfasst, alle genommen)', einnahmen: einnahmen(VORTAG, 30, 0), tsh: t(6), muster: 'c2', verboten: ['kein Vorwurf', 'zu selten eingetragen'] },
  { name: 'L5b nicht bei e2', einnahmen: einnahmen(VORTAG, 42, 5), tsh: t(0.2), muster: 'e2', ohneRegeln: ['L5b'], verboten: ['kein Vorwurf', 'zu selten eingetragen'] },
  { name: 'L5b nicht bei a', einnahmen: einnahmen(VORTAG, 42, 5), tsh: t(2), muster: 'a', ohneRegeln: ['L5b'], verboten: ['kein Vorwurf'] },
  { name: 'R9 Befundfrage vergessen = mehrere wirkt wie L5b (ohne Einnahmen)', befund: { vergessen: 'mehrere' }, tsh: t(6), muster: 'c2', regeln: ['L5b'] },
  { name: 'L2b + L5a + L5b → L5b als erste Erklärung', dosen: dosisAb('2026-08-20'), einnahmen: einnahmen(VORTAG, 42, 4), tsh: t(6), ft4: f4(10.5), muster: 'b', stufe: 'tage', regeln: ['L5a', 'L5b'], erste: 'L5b' },
].forEach(pruefeFall);

// ---- L5c: vorAbnahme = ja. Erklärung nur bei d, f, h (und L2z2 B); Tipp bei allen; T3-Zusatz.
[
  { name: 'L5c bei a: nur der Tipp', befund: { vorAbnahme: 'ja' }, tsh: t(2), ft4: f4(15), muster: 'a', regeln: ['L5c'], texte: ['erst nach der Abnahme'], verboten: ['einige Stunden'] },
  { name: 'L5c bei h: Erklärung + Tipp', befund: { vorAbnahme: 'ja' }, tsh: t(2), ft4: f4(24), muster: 'h', texte: ['einige Stunden', 'aussagekräftig', 'erst nach der Abnahme'] },
  { name: 'L5c bei f: Erklärung', befund: { vorAbnahme: 'ja' }, tsh: t(6), ft4: f4(25), muster: 'f', texte: ['einige Stunden'] },
  { name: 'L5c T3-Zusatz', profil: T3, befund: { vorAbnahme: 'ja' }, tsh: t(2), ft4: f4(24), muster: 'h', texte: ['auch fT3'] },
  { name: 'L5c bei L2z2 B', profil: NIEDRIG, befund: { vorAbnahme: 'ja' }, tsh: t(0.2), ft4: f4(25), muster: 'z2b', texte: ['einige Stunden'] },
  { name: 'L5c nicht bei vorAbnahme = unbekannt', befund: { vorAbnahme: 'unbekannt' }, tsh: t(2), ft4: f4(24), muster: 'h', ohneRegeln: ['L5c'], verboten: ['einige Stunden'] },
].forEach(pruefeFall);

// ---- L5d: Biotin (Befundfrage ja ODER Mittel), bei ALLEN Mustern, Zusatz je Muster.
[
  { name: 'L5d bei a: hoher TSH kann verdeckt sein', befund: { biotin: 'ja' }, tsh: t(2), muster: 'a', regeln: ['L5d'], texte: ['Biotin', 'verdeckt'] },
  { name: 'L5d bei c2: verdeckt-Zusatz', befund: { biotin: 'ja' }, tsh: t(6), muster: 'c2', texte: ['verdeckt'] },
  { name: 'L5d bei e2: wie zu viel Hormon, vor L5a', dosen: dosisAb('2026-08-20'), befund: { biotin: 'ja' }, tsh: t(0.2), muster: 'e2', erste: 'L5d', texte: ['Biotin-Pause'] },
  { name: 'L5d bei g1: der Praxis sagen', befund: { biotin: 'ja' }, tsh: t(2), ft4: f4(11), muster: 'g1', texte: ['sagen Sie es der Praxis'] },
  { name: 'L5d über das Mittel Biotin (Befundfrage offen)', mittel: ['biotin'], tsh: t(2), muster: 'a', regeln: ['L5d'] },
  { name: 'L5d nicht bei biotin = unbekannt ohne Mittel', befund: { biotin: 'unbekannt' }, tsh: t(2), muster: 'a', ohneRegeln: ['L5d'] },
].forEach(pruefeFall);

// ---- L5e: Mittel als mögliche Erklärung, Gruppen A–F, Schlusssatz.
[
  { name: 'L5e A Kalzium ohne Abstand bei c2', mittel: ['kalzium'], abstand: { kalzium: 'nein' }, tsh: t(6), muster: 'c2', regeln: ['L5e'], texte: ['Aufnahme', 'eigenmächtig ab'] },
  { name: 'L5e A Kalzium mit Abstand → nicht genannt', mittel: ['kalzium'], abstand: { kalzium: 'ja' }, tsh: t(6), muster: 'c2', ohneRegeln: ['L5e'] },
  { name: 'L5e A Kalzium, Abstand weiß nicht → genannt (≠ ja)', mittel: ['kalzium'], abstand: { kalzium: 'unbekannt' }, tsh: t(6), muster: 'c2', regeln: ['L5e'] },
  { name: 'L5e A Kaffee ohne Abstand bei b', mittel: ['kaffee'], abstand: { kaffee: 'nein' }, tsh: t(6), ft4: f4(10.5), muster: 'b', regeln: ['L5e'] },
  { name: 'L5e A nicht bei a', mittel: ['kalzium'], abstand: { kalzium: 'nein' }, tsh: t(2), muster: 'a', ohneRegeln: ['L5e'] },
  { name: 'L5e A–D nicht bei f', mittel: ['kalzium', 'ppi', 'oestrogen_tablette', 'lithium'], abstand: { kalzium: 'nein' }, tsh: t(6), ft4: f4(25), muster: 'f', ohneRegeln: ['L5e'] },
  { name: 'L5e B Magenschutz auch mit Abstand', mittel: ['ppi'], tsh: t(6), muster: 'c2', regeln: ['L5e'], texte: ['auch mit Abstand'] },
  { name: 'L5e C Östrogen als Tablette bei c2', mittel: ['oestrogen_tablette'], tsh: t(6), muster: 'c2', regeln: ['L5e'], texte: ['Bedarf'] },
  { name: 'L5e Östrogen über die Haut nie', mittel: ['oestrogen_haut'], tsh: t(6), muster: 'c2', ohneRegeln: ['L5e'] },
  { name: 'L5e C Enzyminduktor bei g1', mittel: ['enzyminduktor'], tsh: t(2), ft4: f4(11), muster: 'g1', regeln: ['L5e'], texte: ['Bedarf'] },
  { name: 'L5e D Lithium bei c2', mittel: ['lithium'], tsh: t(6), muster: 'c2', regeln: ['L5e'], texte: ['Lithium'] },
  { name: 'L5e E Metformin bei e2', mittel: ['metformin'], tsh: t(0.2), muster: 'e2', regeln: ['L5e'], texte: ['senken'] },
  { name: 'L5e E Kortison aus dem Profil bei d (Entscheidung 4)', profil: { kortison: 'ja' }, tsh: t(0.2), ft4: f4(25), muster: 'd', regeln: ['L5e'], texte: ['senken'] },
  { name: 'L5e E Kortison aus der Befundfrage bei e2 (dazu L5g)', befund: { kortison: 'ja' }, tsh: t(0.2), muster: 'e2', regeln: ['L5e', 'L5g'] },
  { name: 'L5e E nicht bei c2', mittel: ['metformin'], tsh: t(6), muster: 'c2', ohneRegeln: ['L5e'] },
  { name: 'L5e F Amiodaron auch bei a', mittel: ['amiodaron'], tsh: t(2), muster: 'a', regeln: ['L5e'], texte: ['direkt beeinflussen'] },
  { name: 'L5e F Jod bei f', mittel: ['jod'], tsh: t(6), ft4: f4(25), muster: 'f', regeln: ['L5e'] },
].forEach(pruefeFall);

// ---- L5g (krank/Kortison/Kontrastmittel, außer a, Stufe unverändert), L5h (Abnahme ab 12:00 bei c1/e1/e2).
[
  { name: 'L5g schwer krank bei c2', befund: { krank: 'ja' }, tsh: t(6), muster: 'c2', stufe: 'termin', regeln: ['L5g'], texte: ['schwer krank'] },
  { name: 'L5g Kontrastmittel bei e3: Stufe bleibt tage', befund: { kontrastmittel: 'ja' }, tsh: t(0.05), muster: 'e3', stufe: 'tage', regeln: ['L5g'] },
  { name: 'L5g nicht bei a', befund: { krank: 'ja' }, tsh: t(2), muster: 'a', ohneRegeln: ['L5g'] },
  { name: 'L5g nicht bei krank = unbekannt', befund: { krank: 'unbekannt' }, tsh: t(6), muster: 'c2', ohneRegeln: ['L5g'] },
  { name: 'L5h Abnahme 13:00 bei c1', befund: { abnahmeUhr: '13:00' }, tsh: t(4.3), muster: 'c1', regeln: ['L5h'], texte: ['Nachmittag'] },
  { name: 'L5h Abnahme 12:00 bei e2', befund: { abnahmeUhr: '12:00' }, tsh: t(0.2), muster: 'e2', regeln: ['L5h'] },
  { name: 'L5h Abnahme 14:00 bei e1', befund: { abnahmeUhr: '14:00' }, tsh: t(0.37), muster: 'e1', regeln: ['L5h'] },
  { name: 'L5h Abnahme 11:59 → nicht', befund: { abnahmeUhr: '11:59' }, tsh: t(4.3), muster: 'c1', ohneRegeln: ['L5h'] },
  { name: 'L5h nicht bei c2', befund: { abnahmeUhr: '13:00' }, tsh: t(6), muster: 'c2', ohneRegeln: ['L5h'] },
].forEach(pruefeFall);

// ---- L3f Reihenfolge der Erklärungen a, b, c, d, g, e, f – und die Vorränge (L2b, L3f, R7).
const REIHE = ['L5a', 'L5b', 'L5c', 'L5d', 'L5g', 'L5e', 'L5f'];
pruefeFall({
  name: 'L3f Reihenfolge L5a, L5b, L5c, L5d, L5g, L5e, L5f bei c2',
  dosen: dosisAb('2026-08-20'),
  einnahmen: einnahmen(VORTAG, 42, 4),
  befund: { vorAbnahme: 'ja', biotin: 'ja', krank: 'ja', laborName: 'Labor Süd' },
  mittel: ['ppi'],
  vor: [V('2026-03-01', t(2.0), { laborName: 'Labor Nord' })],
  tsh: t(6), muster: 'c2', regeln: REIHE,
  // L3f: „Erklärungen L5 in der Reihenfolge a, b, c, d, g, e, f, dann L6" – L5f darf auch als
  // erster Eintrag des Verlaufs stehen; gezählt wird die Folge Erklärungen → Verlauf.
  pruef: (E) => {
    const folge = [...ids(E.erklaerungen || []), ...ids(E.verlauf || [])];
    const ist = folge.filter((id) => REIHE.includes(id));
    const l5f = folge.indexOf('L5f');
    const l6 = folge.indexOf('L6');
    return [
      ['Reihenfolge', JSON.stringify(ist) === JSON.stringify(REIHE), `ist ${JSON.stringify(folge)}`],
      ['L5f vor L6', l5f >= 0 && (l6 < 0 || l5f < l6), `ist ${JSON.stringify(folge)}`],
    ];
  },
});
[
  { name: 'Vorrang L3f: bei d steht Biotin vor L5a', dosen: dosisAb('2026-08-20'), befund: { biotin: 'ja' }, tsh: t(0.2), ft4: f4(25), muster: 'd', erste: 'L5d' },
  { name: 'Vorrang L3f: bei h steht Biotin vor L5a und L5c', dosen: dosisAb('2026-08-20'), befund: { biotin: 'ja', vorAbnahme: 'ja' }, tsh: t(2), ft4: f4(24), muster: 'h', erste: 'L5d' },
  { name: 'Vorrang L3f: bei f steht Biotin vor L5a und L5b', dosen: dosisAb('2026-08-20'), einnahmen: einnahmen(VORTAG, 42, 4), befund: { biotin: 'ja' }, tsh: t(6), ft4: f4(25), muster: 'f', erste: 'L5d' },
  { name: 'Vorrang L2b: bei b steht L5b vor L5a und L5d', dosen: dosisAb('2026-08-20'), einnahmen: einnahmen(VORTAG, 42, 4), befund: { biotin: 'ja' }, tsh: t(6), ft4: f4(10.5), muster: 'b', erste: 'L5b' },
  { name: 'Vorrang R7: L5c vor L5a', dosen: dosisAb('2026-08-20'), befund: { vorAbnahme: 'ja' }, tsh: t(0.37), ft4: f4(23), muster: 'e1', erste: 'L5c' },
].forEach(pruefeFall);

// ---- L6 Verlauf TSH (Faktor 1,5 + 0,5 mU/l oder Kategoriewechsel) mit R10; L5f; L6b.
const verlaufTexte = (E) => textListe(E.verlauf);
[
  {
    name: 'L6 gestiegen im Bereich (2,0 → 3,5 µIU/ml): keine Richtungsübersetzung (R10), kein L5f',
    vor: [V('2026-03-01', t(2.0))], tsh: t(3.5, 0.4, 4.0, 'µIU/ml'), muster: 'a', regeln: ['L6'], ohneRegeln: ['L5f'],
    texte: ['gestiegen'], verboten: ['zu wenig Hormon', 'anderes Labor'],
  },
  { name: 'L6 gestiegen aus dem Bereich (2,0 → 6,0): Richtung übersetzt', vor: [V('2026-03-01', t(2.0))], tsh: t(6), muster: 'c2', regeln: ['L6'], texte: ['gestiegen', 'zu wenig Hormon'] },
  { name: 'L6 gesunken aus dem Bereich (3,0 → 0,2): Richtung übersetzt', vor: [V('2026-03-01', t(3.0))], tsh: t(0.2), muster: 'e2', regeln: ['L6'], texte: ['gesunken', 'mehr Hormon'] },
  {
    name: 'R10 Fall 1: 0,20 → 0,05 etwa gleich, aber kein „normal" bei Stufe tage',
    vor: [V('2026-03-01', t(0.2))], tsh: t(0.05), muster: 'e3', stufe: 'tage', texte: ['etwa gleich'],
    pruef: (E) => [['Verlauf ohne „normal"', !enthaelt(verlaufTexte(E), 'normal'), auszug(verlaufTexte(E))]],
  },
  {
    name: 'R10 Fall 2: 0,35 → 0,9 (in den Bereich hinein): „jetzt im Bereich", keine Übersetzung',
    vor: [V('2026-03-01', t(0.35))], tsh: t(0.9), muster: 'a', texte: ['jetzt im Bereich'],
    pruef: (E) => [['Verlauf ohne „zu wenig Hormon"', !enthaelt(verlaufTexte(E), 'zu wenig Hormon'), auszug(verlaufTexte(E))]],
  },
  {
    name: 'L6 etwa gleich 2,0 → 2,3 bei a: „normal" erlaubt, Dosis gleich',
    vor: [V('2026-03-01', t(2.0))], tsh: t(2.3), muster: 'a', texte: ['etwa gleich', 'normal', 'Dosis war'],
  },
  { name: 'L6 Kategoriewechsel im → über bei kleiner Differenz (3,8 → 4,3) = gestiegen', vor: [V('2026-03-01', t(3.8))], tsh: t(4.3), muster: 'c1', texte: ['gestiegen'] },
  { name: 'L6 Dosis dazwischen geändert, TSH 6,0 → 2,5 (in den Bereich)', dosen: dosisAb('2026-05-01'), vor: [V('2026-03-01', t(6.0))], tsh: t(2.5), muster: 'a', texte: ['Dosis geändert', 'jetzt im Bereich'] },
  { name: 'L6 Abnahmezeiten mehr als 4 Stunden auseinander', vor: [V('2026-03-01', t(2.0), { abnahmeUhr: '07:30' })], befund: { abnahmeUhr: '13:00' }, tsh: t(2.3), muster: 'a', texte: ['Tageszeiten'] },
  { name: 'L6 Abnahmezeiten 3 Stunden auseinander → kein Zusatz', vor: [V('2026-03-01', t(2.0), { abnahmeUhr: '07:30' })], befund: { abnahmeUhr: '10:30' }, tsh: t(2.3), muster: 'a', verboten: ['Tageszeiten'] },
  {
    name: 'L5f anderes Labor: nur Lagevergleich, kein „gestiegen"',
    vor: [V('2026-03-01', t(2.0), { laborName: 'Labor Nord' })], befund: { laborName: 'Labor Süd' }, tsh: t(6), muster: 'c2',
    regeln: ['L5f'], texte: ['anderes Labor'],
    pruef: (E) => [['Verlauf ohne „gestiegen"', !enthaelt(verlaufTexte(E), 'gestiegen'), auszug(verlaufTexte(E))]],
  },
  { name: 'L5f Bereichsgrenze weicht um mehr als 10 % ab (0,4 → 0,27)', vor: [V('2026-03-01', t(2.0))], tsh: t(6, 0.27, 4.2), muster: 'c2', regeln: ['L5f'] },
  { name: 'L5f Bereich weicht höchstens 10 % ab (4,0 → 4,2) → kein Wechsel', vor: [V('2026-03-01', t(2.0))], tsh: t(6, 0.4, 4.2), muster: 'c2', ohneRegeln: ['L5f'] },
  { name: 'L5f mU/l ↔ µU/ml ist kein Wechsel', vor: [V('2026-03-01', t(2.0, 0.4, 4.0, 'mU/l'))], tsh: t(3, 0.4, 4.0, 'µU/ml'), muster: 'a', ohneRegeln: ['L5f'] },
  { name: 'L5f fT4 ng/dl → pmol/l mit umgerechnet gleichem Bereich ist kein Wechsel', vor: [V('2026-03-01', t(2.0), { ft4: f4(1.2, 0.93, 1.71, 'ng/dl') })], tsh: t(2.2), ft4: f4(15), muster: 'a', ohneRegeln: ['L5f'] },
  {
    name: 'L6b fT4 15 → 19 (+27 %) gestiegen, Tablette nur einmal vorher',
    vor: [V('2026-03-01', t(2.0), { ft4: f4(15), vorAbnahme: 'nein' })], befund: { vorAbnahme: 'ja' }, tsh: t(2.1), ft4: f4(19), muster: 'a',
    regeln: ['L6b'], texte: ['fT4 ist seit', 'nur bei einer der beiden'],
  },
  {
    name: 'L6b fT4 15 → 16,5 (+10 %) etwa gleich',
    vor: [V('2026-03-01', t(2.0), { ft4: f4(15) })], tsh: t(2.1), ft4: f4(16.5), muster: 'a', regeln: ['L6b'],
    pruef: (E) => {
      const ft4 = verlaufTexte(E).filter((x) => enthaelt(x, 'fT4'));
      return [['fT4-Verlauf „etwa gleich"', enthaelt(ft4, 'etwa gleich'), auszug(ft4)]];
    },
  },
].forEach(pruefeFall);

// ---- L1b: fT3 unter/am unteren Rand bei T4 → Zusatztext; nie bei T3-Präparat.
[
  { name: 'L1b fT3 3,0 ohne Bereich (unterer Rand)', tsh: t(2), ft4: f4(15), ft3: f3O(3.0), muster: 'a', regeln: ['L1b'], texte: ['unteren Bereich'] },
  { name: 'L1b fT3 2,5 pmol/l unter dem Bereich', tsh: t(2), ft4: f4(15), ft3: f3(2.5), muster: 'a', regeln: ['L1b'], texte: ['unteren Bereich'] },
  { name: 'L1b fT3 1,9 pg/ml ohne Bereich (unterer Rand)', tsh: t(2), ft4: f4(15), ft3: f3O(1.9, 'pg/ml'), muster: 'a', regeln: ['L1b'] },
  { name: 'L1b nicht bei T3-Präparat', profil: T3, tsh: t(2), ft4: f4(15), ft3: f3(2.5), muster: 'a', ohneRegeln: ['L1b'] },
  { name: 'L1b nicht bei fT3 5 im Bereich', tsh: t(2), ft4: f4(15), ft3: f3(5), muster: 'a', ohneRegeln: ['L1b'], verboten: ['unteren Bereich'] },
].forEach(pruefeFall);

// ================================================================ S1–S4, R3, W5 (beschwerdenAuswerten)
//
// Entscheidung 16: S1/S2/S2b/S3 = Befinden der letzten 28 Tage (heute−27 … heute),
// S4, W5, R3 = letzte 14 Tage (heute−13 … heute). Ohne Befund, außer wo angegeben.

const B_TAG = plus(HEUTE, -3);
/**
 * Ein Beschwerde-Fall. Felder: profil, befinden, befund (tsh/ft4/datum/weitere),
 * dosen; Erwartung: richtung, pw/pv (Punkte), stufe/stufeMin/stufeMax,
 * texte/verboten, regeln.
 */
function pruefeBeschwerden(f) {
  fall(f.name, () => {
    const s = baue({
      profil: f.profil, befinden: f.befinden, dosen: f.dosen, ohneBefund: !f.befund,
      ...(f.befund || {}),
    });
    const r = ez.beschwerdenAuswerten(s, HEUTE);
    const texte = textListe(r.texte);
    sammle('beschwerdenAuswerten', f.name, texte);
    const n = f.name;
    if ('richtung' in f) check(`${n}: Richtung ${f.richtung}`, r.richtung === f.richtung, `ist ${r.richtung}`);
    if ('pw' in f) check(`${n}: Punkte zu wenig = ${f.pw}`, nahe(r.punkteWenig, f.pw), `ist ${r.punkteWenig}`);
    if ('pv' in f) check(`${n}: Punkte zu viel = ${f.pv}`, nahe(r.punkteViel, f.pv), `ist ${r.punkteViel}`);
    if (f.stufe) check(`${n}: Stufe ${f.stufe}`, r.stufe === f.stufe, `ist ${r.stufe}`);
    if (f.stufeMin) check(`${n}: Stufe mindestens ${f.stufeMin}`, rang(r.stufe) >= rang(f.stufeMin), `ist ${r.stufe}`);
    if (f.stufeMax) check(`${n}: Stufe höchstens ${f.stufeMax}`, rang(r.stufe) >= 0 && rang(r.stufe) <= rang(f.stufeMax), `ist ${r.stufe}`);
    (f.regeln || []).forEach((x) => check(`${n}: Regel ${x}`, Array.isArray(r.regeln) && r.regeln.includes(x), `regeln: ${JSON.stringify(r.regeln)}`));
    (f.texte || []).forEach((x) => check(`${n}: Text „${x}"`, enthaelt(texte, x), auszug(texte)));
    (f.verboten || []).forEach((x) => check(`${n}: ohne „${x}"`, !enthaelt(texte, x), auszug(texte.filter((z) => enthaelt(z, x)))));
  });
}

// ---- S1 Gewichte und S2 Schwellen (≥ 3 auf einer Seite UND ≤ 1 auf der anderen).
[
  { name: 'S2 zu wenig: frieren, verstopfung, trockenhaut = 3', befinden: [bf(B_TAG, 'frieren', 'verstopfung', 'trockenhaut')], richtung: 'wenig', pw: 3, pv: 0, regeln: ['S2'], texte: ['zu wenig Schilddrüsenhormon', 'andere Gründe', 'nichts an den Tabletten'] },
  { name: 'S1 unter 70 halbe Gewichte: frieren, verstopfung, muede, stimmung = 3', befinden: [bf(B_TAG, 'frieren', 'verstopfung', 'muede', 'stimmung')], richtung: 'wenig', pw: 3 },
  { name: 'S1 ab 70 zählen muede/stimmung nicht: = 2 → kein Muster', profil: { geburtsjahr: J[70] }, befinden: [bf(B_TAG, 'frieren', 'verstopfung', 'muede', 'stimmung')], richtung: null, pw: 2, texte: ['kein klares Muster'] },
  { name: 'S1 mit 69 Jahren: muede, schmerzen noch halb = 3', profil: { geburtsjahr: J[69] }, befinden: [bf(B_TAG, 'frieren', 'verstopfung', 'muede', 'schmerzen')], richtung: 'wenig', pw: 3 },
  { name: 'S1 ohne Geburtsjahr wie ab 70 (Entscheidung 7) = 2', profil: { geburtsjahr: null }, befinden: [bf(B_TAG, 'frieren', 'verstopfung', 'muede', 'stimmung')], richtung: null, pw: 2 },
  { name: 'S1 gesicht zählt 1', befinden: [bf(B_TAG, 'frieren', 'verstopfung', 'gesicht')], richtung: 'wenig', pw: 3 },
  { name: 'S2 zu viel: schwitzen, herz, zittern = 3', befinden: [bf(B_TAG, 'schwitzen', 'herz', 'zittern')], richtung: 'viel', pv: 3, pw: 0, texte: ['zu viel Schilddrüsenhormon', 'nichts an den Tabletten'] },
  { name: 'S1 waerme und abnahme zählen je 1', befinden: [bf(B_TAG, 'waerme', 'abnahme', 'schwitzen')], richtung: 'viel', pv: 3 },
  { name: 'S1 durchfall 0,5: schwitzen, zittern, durchfall = 2,5 → kein Muster', befinden: [bf(B_TAG, 'schwitzen', 'zittern', 'durchfall')], richtung: null, pv: 2.5 },
  { name: 'S1 neutral: konzentration, haarausfall, schlaf, gewicht = 0', befinden: [bf(B_TAG, 'konzentration', 'haarausfall', 'schlaf', 'gewicht')], richtung: null, pw: 0, pv: 0 },
  { name: 'S1 puls zählt nicht als Punkt', befinden: [bf(B_TAG, 'puls')], pw: 0, pv: 0 },
  { name: 'S2 andere Seite 2 → kein Muster', befinden: [bf(B_TAG, 'frieren', 'verstopfung', 'trockenhaut', 'schwitzen', 'zittern')], richtung: null, pw: 3, pv: 2 },
  { name: 'S2 andere Seite 1 → zu wenig', befinden: [bf(B_TAG, 'frieren', 'verstopfung', 'trockenhaut', 'schwitzen')], richtung: 'wenig', pw: 3, pv: 1 },
  { name: 'S2 2,5 Punkte reichen nicht', befinden: [bf(B_TAG, 'frieren', 'verstopfung', 'muede')], richtung: null, pw: 2.5 },
  { name: 'S1 jede Beschwerde zählt einmal', befinden: [bf(plus(HEUTE, -1), 'frieren'), bf(plus(HEUTE, -2), 'frieren'), bf(plus(HEUTE, -3), 'frieren', 'verstopfung')], pw: 2 },
  { name: 'S1 Zeitraum: Eintrag von heute−27 zählt', befinden: [bf(plus(HEUTE, -27), 'frieren', 'verstopfung', 'trockenhaut')], pw: 3, richtung: 'wenig' },
  { name: 'S1 Zeitraum: Eintrag von heute−28 zählt nicht', befinden: [bf(plus(HEUTE, -28), 'frieren', 'verstopfung', 'trockenhaut')], pw: 0, richtung: null },
  { name: 'Keine Beschwerden → Stufe keine', befinden: [], richtung: null, stufe: 'keine' },
  // S1-Hinweis: Alter ≥ 65 (oder unbekannt, Entscheidung 7) und muede oder schmerzen.
  { name: 'S1-Hinweis mit 65 bei muede', profil: { geburtsjahr: J[65] }, befinden: [bf(B_TAG, 'muede')], texte: ['Gewichtsverlust'] },
  { name: 'S1-Hinweis mit 78 bei schmerzen', profil: { geburtsjahr: J[78] }, befinden: [bf(B_TAG, 'schmerzen')], texte: ['Gewichtsverlust'] },
  { name: 'S1-Hinweis ohne Geburtsjahr', profil: { geburtsjahr: null }, befinden: [bf(B_TAG, 'muede')], texte: ['Gewichtsverlust'] },
  { name: 'S1-Hinweis nicht mit 64', profil: { geburtsjahr: J[64] }, befinden: [bf(B_TAG, 'muede')], verboten: ['Gewichtsverlust'] },
  // S2 Zusatz ohne TSH-Befund der letzten 90 Tage.
  { name: 'S2 Zusatz ohne Befund: Blutabnahme fragen', befinden: [bf(B_TAG, 'frieren', 'verstopfung', 'trockenhaut')], texte: ['Blutabnahme sinnvoll'] },
  { name: 'S2 kein Zusatz mit Befund von vor 7 Tagen', befund: { tsh: t(2) }, befinden: [bf(B_TAG, 'frieren', 'verstopfung', 'trockenhaut')], verboten: ['Blutabnahme sinnvoll'] },
].forEach(pruefeBeschwerden);

// ---- S2b: ab 5 verschiedenen Beschwerden (inkl. neutral, ohne puls/lebensmuede) → zeitnah.
[
  { name: 'S2b fünf verschiedene (inkl. neutral) → zeitnah', befinden: [bf(B_TAG, 'muede', 'schlaf', 'konzentration', 'haarausfall', 'gewicht')], stufe: 'zeitnah', regeln: ['S2b'], texte: ['viele Beschwerden'] },
  { name: 'S2b verteilt über mehrere Einträge', befinden: [bf(plus(HEUTE, -20), 'muede', 'schlaf'), bf(B_TAG, 'konzentration', 'haarausfall', 'gewicht')], stufeMin: 'zeitnah', texte: ['viele Beschwerden'] },
  { name: 'S2b vier Beschwerden → nein', befinden: [bf(B_TAG, 'muede', 'schlaf', 'konzentration', 'haarausfall')], verboten: ['viele Beschwerden'] },
  { name: 'S2b vier + puls zählen nicht als fünf', befinden: [bf(B_TAG, 'muede', 'schlaf', 'konzentration', 'haarausfall', 'puls')], verboten: ['viele Beschwerden'] },
].forEach(pruefeBeschwerden);

// ---- S3: Abgleich mit dem letzten TSH-Befund (≤ 90 Tage, seitdem keine Dosisänderung).
const WENIG3 = [bf(B_TAG, 'frieren', 'verstopfung', 'trockenhaut')];
const VIEL3 = [bf(B_TAG, 'schwitzen', 'zittern', 'waerme')];
[
  { name: 'S3 Text 1: zu wenig + Muster c2', befund: { tsh: t(6) }, befinden: WENIG3, regeln: ['S3'], texte: ['passen zum letzten Laborwert'] },
  { name: 'S3 Text 1: zu viel + Muster d', befund: { tsh: t(0.2), ft4: f4(25) }, befinden: VIEL3, texte: ['passen zum letzten Laborwert'] },
  { name: 'S3 Text 2: zu wenig + Muster e2', befund: { tsh: t(0.2) }, befinden: WENIG3, texte: ['passen nicht zum letzten Laborwert'] },
  { name: 'S3 Text 2: zu viel + Muster c2', befund: { tsh: t(6) }, befinden: VIEL3, texte: ['passen nicht zum letzten Laborwert'] },
  { name: 'S3 Text 3: Muster a + eine gezählte Beschwerde', befund: { tsh: t(2) }, befinden: [bf(B_TAG, 'frieren')], texte: ['Blutarmut'] },
  { name: 'S3 Text 3 nicht bei nur neutralen Beschwerden', befund: { tsh: t(2) }, befinden: [bf(B_TAG, 'schlaf')], verboten: ['Blutarmut'] },
  { name: 'S3 Zusatz 4: auffälliger weiterer Wert (Hb unter dem Bereich)', befund: { tsh: t(2), befund: { hb: { wert: 11, einheit: 'g/dl', von: 12, bis: 16 } } }, befinden: [bf(B_TAG, 'frieren')], texte: ['Auffällig war zuletzt', 'Hämoglobin'] },
  { name: 'S3 nicht bei Befund älter als 90 Tage', befund: { tsh: t(6), datum: plus(HEUTE, -91) }, befinden: WENIG3, verboten: ['passen zum letzten', 'passen nicht zum letzten'] },
  { name: 'S3 nicht nach Dosisänderung seit dem Befund', befund: { tsh: t(6) }, dosen: dosisAb(plus(HEUTE, -2)), befinden: WENIG3, verboten: ['passen zum letzten', 'passen nicht zum letzten'] },
].forEach(pruefeBeschwerden);

// ---- S4 (i) Puls → Stufe heute (Entscheidung 18), (ii) Herzklopfen + niedriger TSH ≤ 90 Tage → tage; R3.
[
  { name: 'S4 (i) Puls unregelmäßig → heute, unabhängig vom Labor', befinden: [bf(B_TAG, 'puls')], stufe: 'heute', regeln: ['S4'], texte: ['Vorhofflimmern', '116 117', '112'] },
  { name: 'S4 (i) auch bei Muster a', befund: { tsh: t(2) }, befinden: [bf(B_TAG, 'puls')], stufe: 'heute' },
  { name: 'S4 (i) Puls von heute−13 zählt', befinden: [bf(plus(HEUTE, -13), 'puls')], stufe: 'heute' },
  { name: 'S4 (i) Puls von heute−14 zählt nicht mehr', befinden: [bf(plus(HEUTE, -14), 'puls')], stufeMax: 'zeitnah', verboten: ['Vorhofflimmern'] },
  { name: 'S4 (ii) Herzklopfen + e2, 56 Jahre → mindestens tage', befund: { tsh: t(0.2) }, befinden: [bf(B_TAG, 'herz')], stufeMin: 'tage', texte: ['niedrigen TSH-Wert', 'nicht eigenmächtig'] },
  { name: 'S4 (ii) Herzklopfen + TSH < 0,1 auch bei zielNiedrig', profil: NIEDRIG, befund: { tsh: t(0.05) }, befinden: [bf(B_TAG, 'herz')], stufeMin: 'tage', texte: ['niedrigen TSH-Wert'] },
  { name: 'S4 (ii) Herzklopfen + L2t', profil: T3, befund: { tsh: t(0.2) }, befinden: [bf(B_TAG, 'herz')], stufeMin: 'tage', texte: ['niedrigen TSH-Wert'] },
  { name: 'R3 S4 (ii) mit 65 Jahren → heute', profil: { geburtsjahr: J[65] }, befund: { tsh: t(0.2) }, befinden: [bf(B_TAG, 'herz')], stufe: 'heute' },
  { name: 'R3 S4 (ii) mit Herz ja → heute', profil: { herz: 'ja' }, befund: { tsh: t(0.2) }, befinden: [bf(B_TAG, 'herz')], stufe: 'heute' },
  { name: 'R3 S4 (ii) ohne Geburtsjahr → heute (Entscheidung 7)', profil: { geburtsjahr: null }, befund: { tsh: t(0.2) }, befinden: [bf(B_TAG, 'herz')], stufe: 'heute' },
  { name: 'S4 (ii) nicht bei Befund älter als 90 Tage', befund: { tsh: t(0.2), datum: plus(HEUTE, -100) }, befinden: [bf(B_TAG, 'herz')], verboten: ['niedrigen TSH-Wert'] },
  { name: 'S4 (ii) nicht bei Muster a', befund: { tsh: t(2) }, befinden: [bf(B_TAG, 'herz')], verboten: ['niedrigen TSH-Wert'] },
  // MEHRDEUTIG: R3 verlangt bei 'herz' IMMER den Satz „bitte heute in der Praxis anrufen", sagt aber
  // nicht ausdrücklich, ob damit die Stufe „heute" gilt. Entscheidung 18 nennt R3 als Quelle der
  // Variante „heute" – sicherere Lesart: Stufe heute, auch ohne Befund.
  // ENTSCHIEDEN: R3 schreibt den Satz vor, nicht die Stufe. Einmal angekreuzt ist
  // offen, ob es „seit Tagen" besteht – der Satz sagt, was dann gilt (Stufe Termin).
  // An mehreren Tagen angekreuzt heißt „seit Tagen" – dann Stufe heute.
  { name: 'R3 Herzklopfen einmal, ohne Befund: Satz „heute in der Praxis", Stufe termin', befinden: [bf(B_TAG, 'herz')], stufe: 'termin', regeln: ['R3'], texte: ['heute in der Praxis', '116 117'] },
  { name: 'R3 Herzklopfen an zwei Tagen, ohne Befund: Stufe heute', befinden: [bf(B_TAG, 'herz'), bf(plus(B_TAG, -2), 'herz')], stufe: 'heute', regeln: ['R3'], texte: ['heute in der Praxis'] },
].forEach(pruefeBeschwerden);

// ---- W5 über das Befinden (lebensmuede, 14 Tage) und Zeile 2 bei gedrückter Stimmung.
// MEHRDEUTIG: RW1 W5 hat die Stufe 112, RW2-Fix X2 nennt „Dringlichkeit Tage, in akuter Gefahr 112".
// Sicherere Lesart: notruf.
[
  { name: 'W5 Befinden lebensmüde → Telefonseelsorge, notruf', befinden: [bf(B_TAG, 'lebensmuede')], stufe: 'notruf', regeln: ['W5'], texte: ['Telefonseelsorge', '0800 111 0 111', '0800 111 0 222', '112'] },
  { name: 'W5 lebensmüde auch bei Muster a', befund: { tsh: t(2) }, befinden: [bf(B_TAG, 'lebensmuede')], stufe: 'notruf', texte: ['Telefonseelsorge'] },
  { name: 'W5 lebensmüde zählt nicht als Punkt', befinden: [bf(B_TAG, 'lebensmuede')], pw: 0, pv: 0 },
  { name: 'W5 lebensmüde von heute−20 → nicht mehr (14 Tage)', befinden: [bf(plus(HEUTE, -20), 'lebensmuede')], stufeMax: 'tage', verboten: ['0800 111 0 222'] },
  { name: 'W5 Zeile 2 bei gedrückter Stimmung (ohne lebensmüde)', befinden: [bf(B_TAG, 'stimmung')], stufeMax: 'termin', texte: ['Telefonseelsorge', '0800 111 0 111'], verboten: ['0800 111 0 222'] },
].forEach(pruefeBeschwerden);

// ================================================================ W1–W5 (warnzeichenAuswerten)

const fragen = (gruppe) => (Array.isArray(ez.WARNFRAGEN) ? ez.WARNFRAGEN.filter((q) => q.gruppe === gruppe) : []);
const schluessel = (gruppe) => fragen(gruppe).map((q) => q.key);
const nummern = (r) => (r.abschnitte || []).flatMap((a) => (a.anrufe || []).map((x) => kompakt(x.nummer)));
const abschnittIds = (r) => (r.abschnitte || []).map((a) => a.id);
function warn(name, ja, standF = {}) {
  const s = baue({ ohneBefund: true, ...standF });
  const r = ez.warnzeichenAuswerten(ja, s);
  sammle('warnzeichenAuswerten', name, texteVon(r));
  return r;
}
const warnTexte = (r) => texteVon(r);

fall('WARNFRAGEN: Aufbau (W1 10 Fragen, W2h 6 inkl. Marcumar, W2t 5, W4a ≥ 2 nach R13, W4b 1, W5 1)', () => {
  check('WARNFRAGEN ist eine Liste', Array.isArray(ez.WARNFRAGEN), typeof ez.WARNFRAGEN);
  check('W1 hat 10 Fragen', fragen('w1').length === 10, `ist ${fragen('w1').length}`);
  check('W2h hat 6 Fragen', fragen('w2h').length === 6, `ist ${fragen('w2h').length}`);
  check('W2h: genau eine Frage nur bei Marcumar', fragen('w2h').filter((q) => q.nurWenn === 'marcumar').length === 1);
  check('W2t hat 5 Fragen', fragen('w2t').length === 5, `ist ${fragen('w2t').length}`);
  check('R13 W4a hat auch „mehr als eine Tablette"', fragen('w4a').length >= 2 && fragen('w4a').some((q) => enthaelt(q.text, 'mehr als eine')),
    JSON.stringify(fragen('w4a').map((q) => q.text)));
  check('R13 W4b auf genau eine Tablette begrenzt', fragen('w4b').length === 1 && enthaelt(fragen('w4b')[0].text, 'eine Tablette'),
    JSON.stringify(fragen('w4b').map((q) => q.text)));
  check('W5 hat 1 Frage', fragen('w5').length === 1, `ist ${fragen('w5').length}`);
  const alle = ez.WARNFRAGEN.map((q) => q.key);
  check('WARNFRAGEN: Schlüssel eindeutig', new Set(alle).size === alle.length);
});

// W1: jede Frage einzeln → notruf, 112, nur W1.
schluessel('w1').forEach((k, i) => fall(`W1 Frage ${i + 1} (${k}) allein`, () => {
  const r = warn(`W1 ${k}`, [k]);
  check(`W1 Frage ${i + 1}: Stufe notruf`, r.stufe === 'notruf', `ist ${r.stufe}`);
  check(`W1 Frage ${i + 1}: nur Abschnitt W1`, abschnittIds(r).length > 0 && abschnittIds(r).every((id) => id === 'W1'), JSON.stringify(abschnittIds(r)));
  check(`W1 Frage ${i + 1}: Anruf 112`, nummern(r).includes('112'), JSON.stringify(nummern(r)));
}));
fall('W1 blendet alles andere aus', () => {
  const ja = [schluessel('w1')[0], schluessel('w2h')[0], schluessel('w2t')[0], schluessel('w4a')[0], schluessel('w4b')[0], schluessel('w5')[0]];
  const r = warn('W1 + alle', ja, { profil: { bundesland: 'BY' } });
  check('W1 + alles: Stufe notruf', r.stufe === 'notruf', `ist ${r.stufe}`);
  check('W1 + alles: nur Abschnitt W1', abschnittIds(r).every((id) => id === 'W1'), JSON.stringify(abschnittIds(r)));
  check('W1 + alles: kein Giftnotruf, keine Praxis-Texte', !enthaelt(warnTexte(r), '19240') && !enthaelt(warnTexte(r), 'heute noch in der Praxis'), auszug(warnTexte(r)));
  check('W1 Text: jetzt 112', enthaelt(warnTexte(r), 'jetzt 112'), auszug(warnTexte(r)));
});

// W2h: jede Frage → Stufe heute, Praxis heute, 116 117 (Marcumar-Frage nur mit Marcumar).
fragen('w2h').forEach((q, i) => fall(`W2h Frage ${i + 1} (${q.key})`, () => {
  const r = warn(`W2h ${q.key}`, [q.key], q.nurWenn === 'marcumar' ? { mittel: ['marcumar'] } : {});
  check(`W2h Frage ${i + 1}: Stufe heute`, r.stufe === 'heute', `ist ${r.stufe}`);
  check(`W2h Frage ${i + 1}: Text „heute noch in der Praxis"`, enthaelt(warnTexte(r), 'heute noch in der Praxis'), auszug(warnTexte(r)));
  check(`W2h Frage ${i + 1}: 116 117`, enthaelt(warnTexte(r), '116 117') || nummern(r).includes('116117'), auszug(warnTexte(r)));
}));
// W2t: jede Frage → tage.
schluessel('w2t').forEach((k, i) => fall(`W2t Frage ${i + 1} (${k})`, () => {
  const r = warn(`W2t ${k}`, [k]);
  check(`W2t Frage ${i + 1}: Stufe tage`, r.stufe === 'tage', `ist ${r.stufe}`);
  check(`W2t Frage ${i + 1}: Text „in den nächsten Tagen"`, enthaelt(warnTexte(r), 'in den nächsten Tagen'), auszug(warnTexte(r)));
}));
fall('W2t entfällt neben W2h', () => {
  const r = warn('W2h + W2t', [schluessel('w2h')[0], schluessel('w2t')[0]]);
  check('W2h + W2t: Stufe heute', r.stufe === 'heute', `ist ${r.stufe}`);
  check('W2h + W2t: kein Abschnitt W2t', !abschnittIds(r).includes('W2t'), JSON.stringify(abschnittIds(r)));
});
fall('W3 keine Ja-Antwort', () => {
  const r = warn('W3', []);
  check('W3: Stufe termin', r.stufe === 'termin', `ist ${r.stufe}`);
  check('W3: Abschnitt W3', abschnittIds(r).includes('W3'), JSON.stringify(abschnittIds(r)));
  check('W3: „kein Warnzeichen" und Hinweis gegen falsche Sicherheit', enthaelt(warnTexte(r), 'kein Warnzeichen') && enthaelt(warnTexte(r), 'schlechter'), auszug(warnTexte(r)));
});

// W4a: Giftnotruf nach Bundesland (P5), ohne Bundesland 112; auch „mehr als eine Tablette" (R13).
[
  ['BW', '0761 19240'], ['BY', '089 19240'], ['BE', '030 19240'], ['BB', '030 19240'], ['HB', '0551 19240'], ['HH', '0551 19240'],
  ['NI', '0551 19240'], ['SH', '0551 19240'], ['HE', '06131 19240'], ['RP', '06131 19240'], ['MV', '0361 730730'], ['SN', '0361 730730'],
  ['ST', '0361 730730'], ['TH', '0361 730730'], ['NW', '0228 19240'], ['SL', '06841 19240'], ['', '112'],
].forEach(([land, nummer]) => fall(`W4a Giftnotruf ${land || 'ohne Bundesland'}`, () => {
  const r = warn(`W4a ${land}`, [schluessel('w4a')[0]], { profil: { bundesland: land } });
  check(`W4a ${land || 'ohne Bundesland'}: Nummer ${nummer}`, nummern(r).includes(kompakt(nummer)), JSON.stringify(nummern(r)));
  check(`W4a ${land || 'ohne Bundesland'}: Stufe notruf`, r.stufe === 'notruf', `ist ${r.stufe}`);
}));
fall('W4a Text und Vorrang vor W2h', () => {
  const r = warn('W4a + W2h', [schluessel('w4a')[0], schluessel('w2h')[0]], { profil: { bundesland: 'BY' } });
  check('W4a: „Giftnotruf", „Packung bereit"', enthaelt(warnTexte(r), 'Giftnotruf') && enthaelt(warnTexte(r), 'Packung bereit'), auszug(warnTexte(r)));
  check('W4a + W2h: kein Abschnitt W2h', !abschnittIds(r).includes('W2h'), JSON.stringify(abschnittIds(r)));
});
fall('R13 „mehr als eine Tablette zu viel" → Giftnotruf', () => {
  const q = fragen('w4a').find((x) => enthaelt(x.text, 'mehr als eine'));
  check('R13 Frage vorhanden', !!q);
  const r = warn('R13 mehr als eine', [q.key], { profil: { bundesland: 'NW' } });
  check('R13 mehr als eine: Giftnotruf 0228 19240', nummern(r).includes('022819240'), JSON.stringify(nummern(r)));
  check('R13 mehr als eine: Stufe notruf', r.stufe === 'notruf', `ist ${r.stufe}`);
});

// W4b: einzelne Tablette zu viel – Stufe Termin, keine Anruf-Aufforderung; R13-Zusatz bei T3/Herz.
[
  ['W4b nur L-Thyroxin, Herz nein', {}, false],
  ['R13 W4b mit T3-Präparat', T3, true],
  ['R13 W4b mit Herzerkrankung', { herz: 'ja' }, true],
].forEach(([name, profil, zusatz]) => fall(name, () => {
  const r = warn(name, [schluessel('w4b')[0]], { profil });
  const w4b = (r.abschnitte || []).find((a) => a.id === 'W4b');
  check(`${name}: Stufe termin`, r.stufe === 'termin', `ist ${r.stufe}`);
  check(`${name}: Abschnitt W4b ohne Anrufe`, !!w4b && (w4b.anrufe || []).length === 0, JSON.stringify(w4b));
  check(`${name}: „nächste Tablette wie gewohnt", „keine Tablette weg"`,
    enthaelt(warnTexte(r), 'nächste Tablette wie gewohnt') && enthaelt(warnTexte(r), 'keine Tablette weg'), auszug(warnTexte(r)));
  check(`${name}: kein W3 (W4 ist eine Ja-Antwort)`, !abschnittIds(r).includes('W3'), JSON.stringify(abschnittIds(r)));
  check(`${name}: Zusatz Herzklopfen/Unruhe ${zusatz ? 'ja' : 'nein'}`, enthaelt(warnTexte(r), 'Herzklopfen oder Unruhe') === zusatz, auszug(warnTexte(r)));
}));

// W5 im Check.
fall('W5 im Warnzeichen-Check', () => {
  const r = warn('W5', [schluessel('w5')[0]]);
  check('W5: Stufe notruf', r.stufe === 'notruf', `ist ${r.stufe}`);
  check('W5: Telefonseelsorge beide Nummern und 112', ['Telefonseelsorge', '0800 111 0 111', '0800 111 0 222', '112'].every((x) => enthaelt(warnTexte(r), x)), auszug(warnTexte(r)));
  const r2 = warn('W5 + W2h', [schluessel('w5')[0], schluessel('w2h')[0]]);
  check('W5 + W2h: beide Abschnitte', abschnittIds(r2).includes('W5') && abschnittIds(r2).includes('W2h'), JSON.stringify(abschnittIds(r2)));
  check('W5 + W2h: Stufe notruf', r2.stufe === 'notruf', `ist ${r2.stufe}`);
});

// ================================================================ R2 notfallWorte

[
  ['Druck auf der Brust', true], ['seit heute Brustschmerzen', true], ['BRUSTSCHMERZ', true], ['starke Atemnot', true],
  ['Luftnot beim Treppensteigen', true], ['war kurz ohnmächtig', true], ['Lähmung im rechten Arm', true],
  ['müde und friere', false], ['Knie tut weh', false], ['gut geschlafen', false], ['', false],
  // MEHRDEUTIG: R2 nennt „ohnmächtig", nicht „Ohnmacht" – sicherere Lesart: das Hauptwort zählt auch.
  ['heute eine Ohnmacht gehabt', true],
].forEach(([text, soll]) => fall(`R2 notfallWorte „${text}"`, () => {
  check(`R2 notfallWorte „${text}" = ${soll}`, ez.notfallWorte(text) === soll, `ist ${ez.notfallWorte(text)}`);
}));

// ================================================================ M1–M14 (abstandPlan), R15, WW3

function plan(name, f) {
  const s = baue({ ohneBefund: true, ...f });
  const p = ez.abstandPlan(s);
  sammle('abstandPlan', name, texteVon(p));
  return p;
}
const eintrag = (p, key) => p.find((x) => x.key === key);

fall('M3 immer, M9-Kontrastmittel immer (ohne Mittel)', () => {
  const p = plan('ohne Mittel', { mittel: [] });
  const m3 = p.find((x) => x.id === 'M3');
  check('M3 ohne Mittel vorhanden', !!m3, JSON.stringify(ids(p)));
  check('M3: nur Wasser, ab 07:30 bzw. 08:00', !!m3 && enthaelt(m3.text, 'Wasser') && hatUhr(m3.text, '07:30') && hatUhr(m3.text, '08:00'), m3 && m3.text);
  check('M9 Kontrastmittel-Satz immer', p.some((x) => enthaelt(x.text, 'Kontrastmittel')), auszug(textListe(p)));
});
fall('M3 Abend-Satz (Tablette 18:00)', () => {
  const m3 = plan('M3 abends', { uhr: '18:00' }).find((x) => x.id === 'M3');
  check('M3 abends: nach der letzten Mahlzeit', !!m3 && enthaelt(m3.text, 'letzten Mahlzeit'), m3 && m3.text);
});
fall('M3 mit Kaffee: 60 Minuten', () => {
  const m3 = plan('M3 Kaffee', { mittel: ['kaffee'] }).find((x) => x.id === 'M3');
  check('M3 Kaffee: 60 Minuten', !!m3 && enthaelt(m3.text, '60 Minuten'), m3 && m3.text);
});

// M1 + R15: T + 4 h, wenn T vor 17:00 (dann liegt T + 4 h vor 22 Uhr), sonst Abend-Satz.
// MEHRDEUTIG: R15 sagt „für jede Uhrzeit T die Uhrzeit T + 4 h, wenn sie vor 22 Uhr liegt" – das
// ergäbe bei 17:00 noch 21:00; M1 verlangt ab 17:00 den Abend-Satz. Gewählt: M1 (Abend ab 17:00),
// R15 schließt nur die Lücke 12:00–16:59 – der Abend-Satz nennt ebenfalls 4 Stunden Abstand.
[
  ['07:00', '11:00'], ['12:00', '16:00'], ['13:00', '17:00'], ['16:59', '20:59'], ['17:00', null], ['21:00', null],
].forEach(([uhr, ab]) => fall(`M1/R15 Kalzium bei Tablette ${uhr}`, () => {
  const k = eintrag(plan(`M1 ${uhr}`, { mittel: ['kalzium'], uhr }), 'kalzium');
  check(`M1/R15 Kalzium ${uhr}: vorhanden (M1)`, !!k && k.id === 'M1', JSON.stringify(k));
  check(`M1/R15 Kalzium ${uhr}: ab ${ab}`, !!k && k.ab === ab, `ist ${k && k.ab}`);
  if (ab) check(`M1/R15 Kalzium ${uhr}: Uhrzeit ${ab} im Text`, !!k && hatUhr(k.text, ab), k && k.text);
  else check(`M1 Kalzium ${uhr}: Abend-Satz`, !!k && enthaelt(k.text, 'abends') && enthaelt(k.text, 'mindestens 4 Stunden'), k && k.text);
}));
['eisen', 'magnesium', 'multimineral', 'antazida', 'sucralfat', 'phosphatbinder', 'orlistat', 'soja', 'ballaststoffe']
  .forEach((key) => fall(`M1 ${key} bei Tablette 07:00`, () => {
    const k = eintrag(plan(`M1 ${key}`, { mittel: [key] }), key);
    check(`M1 ${key}: ab 11:00, 4 Stunden`, !!k && k.ab === '11:00' && enthaelt(k.text, '4 Stunden'), JSON.stringify(k));
    check(`M1 ${key}: nicht hervorgehoben (WW3 nur Kalzium/Knochenmittel)`, !!k && k.wichtig !== true, JSON.stringify(k && k.wichtig));
  }));

// M2 + R15: T + 5 h, solange vor 22 Uhr.
[['07:00', '12:00'], ['13:00', '18:00'], ['16:30', '21:30'], ['17:00', null]].forEach(([uhr, ab]) => fall(`M2/R15 Colestyramin bei Tablette ${uhr}`, () => {
  const k = eintrag(plan(`M2 ${uhr}`, { mittel: ['colestyramin'], uhr }), 'colestyramin');
  check(`M2/R15 Colestyramin ${uhr}: ab ${ab}`, !!k && k.ab === ab, `ist ${k && k.ab}`);
  if (ab) check(`M2 Colestyramin ${uhr}: 5 Stunden, ${ab} im Text`, !!k && enthaelt(k.text, '5 Stunden') && hatUhr(k.text, ab), k && k.text);
}));

// M1b, M4–M14: Schlüsselwörter je Mittel.
[
  ['raloxifen', 'M1b', '12 Stunden'], ['ppi', 'M4', 'hilft hier nicht'], ['oestrogen_tablette', 'M5', 'Bedarf'],
  ['oestrogen_haut', 'M5', 'kaum'], ['tamoxifen', 'M5', 'Bedarf'], ['biotin', 'M6', 'mindestens 3 Tage'], ['marcumar', 'M7', 'INR'],
  ['diabetes', 'M8', 'Blutzucker'], ['amiodaron', 'M9', 'direkt beeinflussen'], ['jod', 'M9', 'Algen'], ['lithium', 'M9', 'direkt beeinflussen'],
  ['krebsmittel', 'M9', 'direkt beeinflussen'], ['bisphosphonat', 'M10', 'Alendronat'], ['selen', 'M11', 'nicht belegt'],
  ['digitalis', 'M12', 'Digoxin'], ['enzyminduktor', 'M13', 'Carbamazepin'],
].forEach(([key, id, wort]) => fall(`${id} ${key}`, () => {
  const p = plan(`${id} ${key}`, { mittel: [key] });
  const k = eintrag(p, key);
  check(`${id} ${key}: Eintrag vorhanden`, !!k, JSON.stringify(p.map((x) => x.key)));
  check(`${id} ${key}: Text „${wort}"`, !!k && enthaelt(k.text, wort), k && k.text);
}));
fall('M4 Magenschutz: keine Uhrzeit', () => {
  const k = eintrag(plan('M4 Uhrzeit', { mittel: ['ppi'] }), 'ppi');
  check('M4 Magenschutz: ab null', !!k && k.ab === null, JSON.stringify(k));
});
fall('M8 + M14 Metformin', () => {
  const p = plan('Metformin', { mittel: ['metformin'] });
  const t14 = textListe(p.filter((x) => x.key === 'metformin'));
  check('M8 Metformin: Blutzucker', enthaelt(t14, 'Blutzucker'), auszug(t14));
  check('M14 Metformin: kann TSH senken', enthaelt(t14, 'senken'), auszug(t14));
});
fall('M14 Kortison aus dem Profil (Entscheidung 4)', () => {
  const p = plan('Kortison', { profil: { kortison: 'ja' } });
  check('M14 Kortison: Eintrag mit „senken"', p.some((x) => enthaelt(x.text, 'Kortison') && enthaelt(x.text, 'senken')), auszug(textListe(p)));
});
fall('WW3 Kalzium und Knochenmittel zuerst und hervorgehoben', () => {
  const p = plan('WW3', { mittel: ['eisen', 'ppi', 'selen', 'bisphosphonat', 'kalzium'] });
  const erste = p.slice(0, 2).map((x) => x.key).sort();
  check('WW3: die ersten beiden sind Kalzium und Knochenmittel', JSON.stringify(erste) === JSON.stringify(['bisphosphonat', 'kalzium']), JSON.stringify(p.map((x) => x.key)));
  check('WW3: beide wichtig = true', p.slice(0, 2).every((x) => x.wichtig === true), JSON.stringify(p.slice(0, 2)));
  const letzterWichtig = p.map((x) => x.wichtig === true).lastIndexOf(true);
  const ersterNicht = p.map((x) => x.wichtig === true).indexOf(false);
  check('WW3: alle hervorgehobenen vor den übrigen', ersterNicht === -1 || letzterWichtig < ersterNicht, JSON.stringify(p.map((x) => [x.key, x.wichtig])));
});

// ================================================================ E13a–f und Natrium (weitereWerte)
//
// Entscheidung 12: feste Stufen für HbA1c, B12, Ferritin, Vitamin D; Hb/CRP gegen den
// Laborbereich; Natrium nach RW1 L9 nur gegen den Laborbereich. Diabetes = Mittel
// diabetes/metformin oder profil.diabetes = ja.

const ww = (key, wert, einheit, von = null, bis = null) => ({ [key]: { wert, einheit, von, bis } });
/** [Name, weitere Werte im Befund, Stand-Zusatz, key, Erwartung { stufe, texte, verboten, fehlt }] */
[
  // E13b HbA1c ohne Diabetes: < 5,7 keine, 5,7–6,4 Termin, ≥ 6,5 zeitnah (in % und mmol/mol).
  ['E13b HbA1c 5,6 %', ww('hba1c', 5.6, '%'), {}, 'hba1c', { stufe: 'keine', texte: ['verfälschen'] }],
  ['E13b HbA1c 5,7 %', ww('hba1c', 5.7, '%'), {}, 'hba1c', { stufe: 'termin', texte: ['leicht erhöht'] }],
  ['E13b HbA1c 6,4 %', ww('hba1c', 6.4, '%'), {}, 'hba1c', { stufe: 'termin' }],
  ['E13b HbA1c 6,5 %', ww('hba1c', 6.5, '%'), {}, 'hba1c', { stufe: 'zeitnah', texte: ['Diabetes'] }],
  ['E13b HbA1c 38 mmol/mol', ww('hba1c', 38, 'mmol/mol'), {}, 'hba1c', { stufe: 'keine' }],
  ['E13b HbA1c 39 mmol/mol', ww('hba1c', 39, 'mmol/mol'), {}, 'hba1c', { stufe: 'termin' }],
  ['E13b HbA1c 47 mmol/mol', ww('hba1c', 47, 'mmol/mol'), {}, 'hba1c', { stufe: 'termin' }],
  ['E13b HbA1c 48 mmol/mol', ww('hba1c', 48, 'mmol/mol'), {}, 'hba1c', { stufe: 'zeitnah' }],
  ['E13b HbA1c 7,5 % mit Diabetes-Mittel: keine Wertung', ww('hba1c', 7.5, '%'), { mittel: ['diabetes'] }, 'hba1c', { stufe: 'keine', texte: ['persönlich'] }],
  ['E13b HbA1c 8,0 % mit Metformin: keine Wertung', ww('hba1c', 8.0, '%'), { mittel: ['metformin'] }, 'hba1c', { stufe: 'keine' }],
  ['E13b HbA1c 6,8 % mit Profil Diabetes ja: keine Wertung', ww('hba1c', 6.8, '%'), { profil: { diabetes: 'ja' } }, 'hba1c', { stufe: 'keine', texte: ['persönlich'] }],
  // E13c B12: < 150 pmol/l (< 200 pg/ml) oder unter dem Laborbereich zeitnah, 150–300 Termin.
  ['E13c B12 140 pmol/l', ww('b12', 140, 'pmol/l'), {}, 'b12', { stufe: 'zeitnah', texte: ['B12-Mangel'] }],
  ['E13c B12 150 pmol/l (Graubereich)', ww('b12', 150, 'pmol/l'), {}, 'b12', { stufe: 'termin', texte: ['Holo-TC'] }],
  ['E13c B12 300 pmol/l (Graubereich)', ww('b12', 300, 'pmol/l'), {}, 'b12', { stufe: 'termin' }],
  ['E13c B12 301 pmol/l', ww('b12', 301, 'pmol/l'), {}, 'b12', { stufe: 'keine' }],
  ['E13c B12 190 pg/ml', ww('b12', 190, 'pg/ml'), {}, 'b12', { stufe: 'zeitnah' }],
  ['E13c B12 210 pg/ml (Graubereich)', ww('b12', 210, 'pg/ml'), {}, 'b12', { stufe: 'termin' }],
  ['E13c B12 410 pg/ml', ww('b12', 410, 'pg/ml'), {}, 'b12', { stufe: 'keine' }],
  ['E13c B12 320 pmol/l unter „ab 350" (einseitig)', ww('b12', 320, 'pmol/l', 350, null), {}, 'b12', { stufe: 'zeitnah' }],
  // E13d Ferritin: < 30 zeitnah (auch „im Bereich"), > 400 oder über dem Laborbereich Termin.
  ['E13d Ferritin 29', ww('ferritin', 29, 'ng/ml'), {}, 'ferritin', { stufe: 'zeitnah', texte: ['Eisenmangel'] }],
  ['E13d Ferritin 29 im Laborbereich 15–150', ww('ferritin', 29, 'ng/ml', 15, 150), {}, 'ferritin', { stufe: 'zeitnah', texte: ['auch wenn'] }],
  ['E13d Ferritin 25 µg/l', ww('ferritin', 25, 'µg/l'), {}, 'ferritin', { stufe: 'zeitnah' }],
  ['E13d Ferritin 30', ww('ferritin', 30, 'ng/ml'), {}, 'ferritin', { stufe: 'keine' }],
  ['E13d Ferritin 400', ww('ferritin', 400, 'ng/ml'), {}, 'ferritin', { stufe: 'keine' }],
  ['E13d Ferritin 401', ww('ferritin', 401, 'ng/ml'), {}, 'ferritin', { stufe: 'termin', texte: ['erhöht'] }],
  ['E13d Ferritin 250 über dem Laborbereich 15–200', ww('ferritin', 250, 'ng/ml', 15, 200), {}, 'ferritin', { stufe: 'termin' }],
  ['E13d Ferritin 50 bei CRP über dem Bereich → Entzündungshinweis', { ...ww('ferritin', 50, 'ng/ml'), ...ww('crp', 12, 'mg/l', null, 5) }, {}, 'ferritin', { texte: ['Entzündung'] }],
  // MEHRDEUTIG: E13 „Der Text steht unter jedem dieser Werte" – ob weitereWerte() ihn liefert oder die
  // Ansicht, sagt die Schnittstelle nicht. Sicherere Lesart: er ist Teil der texte jedes Werts.
  ['E13 Grundsatz: Werte ändern nichts an der Dosis', ww('ferritin', 50, 'ng/ml'), {}, 'ferritin', { texte: ['Schilddrüsendosis'] }],
  // E13e Vitamin D: feste Stufen, nicht der Laborbereich.
  ['E13e Vitamin D 11,9 ng/ml (Mangel)', ww('vitd', 11.9, 'ng/ml'), {}, 'vitd', { stufe: 'termin', texte: ['Mangel', 'Jahreszeit'] }],
  ['E13e Vitamin D 12 ng/ml (knapp)', ww('vitd', 12, 'ng/ml'), {}, 'vitd', { stufe: 'termin', texte: ['knapp'] }],
  ['E13e Vitamin D 19,9 ng/ml (knapp)', ww('vitd', 19.9, 'ng/ml'), {}, 'vitd', { stufe: 'termin' }],
  ['E13e Vitamin D 20 ng/ml (ausreichend)', ww('vitd', 20, 'ng/ml'), {}, 'vitd', { stufe: 'keine', texte: ['ausreichend'] }],
  ['E13e Vitamin D 100 ng/ml', ww('vitd', 100, 'ng/ml'), {}, 'vitd', { stufe: 'keine' }],
  ['E13e Vitamin D 100,1 ng/ml → tage', ww('vitd', 100.1, 'ng/ml'), {}, 'vitd', { stufe: 'tage', texte: ['sehr hoch'] }],
  ['E13e Vitamin D 25 ng/ml unter Laborbereich 30–100 → trotzdem ausreichend', ww('vitd', 25, 'ng/ml', 30, 100), {}, 'vitd', { stufe: 'keine', texte: ['ausreichend'] }],
  ['E13e Vitamin D 29 nmol/l (Mangel)', ww('vitd', 29, 'nmol/l'), {}, 'vitd', { stufe: 'termin' }],
  ['E13e Vitamin D 50 nmol/l (ausreichend)', ww('vitd', 50, 'nmol/l'), {}, 'vitd', { stufe: 'keine' }],
  ['E13e Vitamin D 251 nmol/l → tage', ww('vitd', 251, 'nmol/l'), {}, 'vitd', { stufe: 'tage' }],
  // E13f Hb unter dem Laborbereich zeitnah (g/dl, g/l, mmol/l); ohne Bereich keine Einordnung. CRP-Hinweis.
  ['E13f Hb 11 g/dl unter 12–16', ww('hb', 11, 'g/dl', 12, 16), {}, 'hb', { stufe: 'zeitnah', texte: ['Blutarmut'] }],
  ['E13f Hb 13 g/dl im Bereich', ww('hb', 13, 'g/dl', 12, 16), {}, 'hb', { stufe: 'keine', verboten: ['Blutarmut'] }],
  ['E13f Hb 110 g/l unter 120–160', ww('hb', 110, 'g/l', 120, 160), {}, 'hb', { stufe: 'zeitnah' }],
  ['E13f Hb 6,8 mmol/l unter 7,4–9,9', ww('hb', 6.8, 'mmol/l', 7.4, 9.9), {}, 'hb', { stufe: 'zeitnah' }],
  ['E13f Hb 11 g/dl ohne Bereich → keine Einordnung', ww('hb', 11, 'g/dl'), {}, 'hb', { stufe: 'keine', verboten: ['Blutarmut'] }],
  ['E13f CRP 12 mg/l über „bis 5"', ww('crp', 12, 'mg/l', null, 5), {}, 'crp', { texte: ['Entzündungswert'] }],
  ['E13f CRP 1,2 mg/dl über „bis 0,5"', ww('crp', 1.2, 'mg/dl', null, 0.5), {}, 'crp', { texte: ['Entzündungswert'] }],
  ['E13f CRP 3 mg/l unter „bis 5" → kein Hinweis', ww('crp', 3, 'mg/l', null, 5), {}, 'crp', { verboten: ['Entzündungswert ist erhöht'] }],
  // E13a LDL: keine Wertung, Zielwert erfragen, kein Grund für mehr Tablette.
  ['E13a LDL 190 mg/dl', ww('ldl', 190, 'mg/dl'), {}, 'ldl', { stufe: 'keine', texte: ['Zielwert', 'kein Grund'] }],
  ['E13a LDL 4,9 mmol/l', ww('ldl', 4.9, 'mmol/l'), {}, 'ldl', { stufe: 'keine' }],
  // RW1 L9 Natrium: nur mit Laborbereich, außerhalb → Termin.
  ['L9 Natrium 130 unter 135–145', ww('natrium', 130, 'mmol/l', 135, 145), {}, 'natrium', { stufe: 'termin', texte: ['unter dem Bereich'] }],
  ['L9 Natrium 147 über 135–145', ww('natrium', 147, 'mmol/l', 135, 145), {}, 'natrium', { stufe: 'termin', texte: ['über dem Bereich'] }],
  ['L9 Natrium 140 im Bereich', ww('natrium', 140, 'mmol/l', 135, 145), {}, 'natrium', { stufe: 'keine' }],
  ['L9 Natrium 130 ohne Bereich → keine Einordnung', ww('natrium', 130, 'mmol/l'), {}, 'natrium', { fehltOderKeine: true }],
].forEach(([name, werte, zusatz, key, soll]) => fall(name, () => {
  const s = baue({ tsh: t(2), befund: werte, ...zusatz });
  const b = s.labor.find((x) => x.id === 'ziel');
  const liste = ez.weitereWerte(b, s);
  const e = liste.find((x) => x.key === key);
  // ENTSCHIEDEN: Der E13-Grundsatz steht einmal unter allen weiteren Werten
  // (ez.WEITERE_HINWEIS), nicht in jedem Eintrag – die Ansicht setzt ihn darunter.
  const texte = e ? [...[].concat(e.texte || []), ez.WEITERE_HINWEIS] : [];
  sammle('weitereWerte', name, texte);
  if (soll.fehltOderKeine) {
    check(`${name}: keine Einordnung`, !e || e.stufe === 'keine', JSON.stringify(e));
    return;
  }
  check(`${name}: Eintrag ${key} vorhanden`, !!e, JSON.stringify(liste.map((x) => x.key)));
  if (soll.stufe) check(`${name}: Stufe ${soll.stufe}`, !!e && e.stufe === soll.stufe, `ist ${e && e.stufe}`);
  (soll.texte || []).forEach((x) => check(`${name}: Text „${x}"`, enthaelt(texte, x), auszug(texte)));
  (soll.verboten || []).forEach((x) => check(`${name}: ohne „${x}"`, !enthaelt(texte, x), auszug(texte)));
}));

// ================================================================ L7a–d, L8, L0d, E7 (kontrolleHinweise)

/** [Name, Stand, erwartete [id, stufe|null, Schlüsselwort|null] (id als Liste = eine davon), fehlende ids] */
const B = (datum, tsh, weiteres = {}) => ({ id: `k${datum.replace(/-/g, '')}`, datum, tsh, ...weiteres });
[
  ['L7a letzter TSH-Befund 366 Tage alt', { labor: [B(plus(HEUTE, -366), t(2))] }, [['L7a', 'termin', 'über ein Jahr']], []],
  ['L7a nicht bei 365 Tagen', { labor: [B(plus(HEUTE, -365), t(2))] }, [], ['L7a']],
  ['L7a ohne Befund, App seit 88 Tagen', { profil: { seit: '2026-07-01' }, labor: [] }, [['L7a', 'termin', null]], []],
  ['L7a ohne Befund, App seit 43 Tagen → nein', { profil: { seit: '2026-08-15' }, labor: [] }, [], ['L7a']],
  // ENTSCHIEDEN: Die Kontrolle nach einer Dosis- oder Präparatänderung meldet die
  // Dosis-Karte (dosis.js, D6c) – hier nur die Mittel, damit nichts doppelt erscheint.
  ['L7b 43 Tage nach Dosisänderung: hier nicht (steht in D6c)', { dosen: dosisAb('2026-08-15'), labor: [B('2026-06-01', t(2))] }, [], ['L7b']],
  ['L7b erst 41 Tage → noch nicht', { dosen: dosisAb('2026-08-17'), labor: [B('2026-06-01', t(2))] }, [], ['L7b']],
  ['L7b nicht mit neuem TSH nach der Änderung', { dosen: dosisAb('2026-08-01'), labor: [B('2026-06-01', t(2)), B('2026-09-20', t(2))] }, [], ['L7b']],
  ['L7b Präparatwechsel: hier nicht (steht in D6c)', { dosen: dosisAb('2026-08-01', 75, 'Euthyrox'), labor: [B('2026-06-01', t(2))] }, [], ['L7b']],
  ['L7b Beginn Magenschutz', { mittel: ['ppi'], mittelWechsel: [{ id: 'mw1', key: 'ppi', art: 'beginn', am: '2026-07-01' }], labor: [B('2026-06-01', t(2))] }, [['L7b', 'termin', null]], []],
  ['L7b Ende Eisen', { mittelWechsel: [{ id: 'mw1', key: 'eisen', art: 'ende', am: '2026-07-01' }], labor: [B('2026-06-01', t(2))] }, [['L7b', 'termin', null]], []],
  ['L7b nicht bei Magnesium', { mittel: ['magnesium'], mittelWechsel: [{ id: 'mw1', key: 'magnesium', art: 'beginn', am: '2026-07-01' }], labor: [B('2026-06-01', t(2))] }, [], ['L7b']],
  ['L7c/E7 Gewicht +6 kg seit dem letzten Befund', { labor: [B('2026-06-01', t(2))], gewicht: [{ datum: '2026-05-25', kg: 70 }, { datum: '2026-09-20', kg: 76 }] }, [[['L7c', 'E7'], 'termin', null]], []],
  ['L7c genau 5 kg', { labor: [B('2026-06-01', t(2))], gewicht: [{ datum: '2026-05-25', kg: 70 }, { datum: '2026-09-20', kg: 75 }] }, [['L7c', 'termin', null]], []],
  ['L7c/E7 4,9 kg → nein', { labor: [B('2026-06-01', t(2))], gewicht: [{ datum: '2026-05-25', kg: 70 }, { datum: '2026-09-20', kg: 74.9 }] }, [], ['L7c', 'E7']],
  ['L7c kein Gewicht innerhalb 30 Tagen um den Befund → nein', { labor: [B('2026-06-01', t(2))], gewicht: [{ datum: '2026-04-01', kg: 70 }, { datum: '2026-09-20', kg: 76 }] }, [], ['L7c']],
  ['L8 Gewicht −5,1 % in 111 Tagen → tage', { gewicht: [{ datum: '2026-06-01', kg: 70 }, { datum: '2026-09-20', kg: 66.4 }] }, [['L8', 'tage', 'nicht abnehmen wollten']], []],
  ['L8 −4,9 % → nein', { gewicht: [{ datum: '2026-06-01', kg: 70 }, { datum: '2026-09-20', kg: 66.6 }] }, [], ['L8']],
  ['L8 Höchstwert älter als 183 Tage zählt nicht', { gewicht: [{ datum: '2026-03-01', kg: 70 }, { datum: '2026-06-01', kg: 67 }, { datum: '2026-09-20', kg: 66 }] }, [], ['L8']],
  ['L7d letzter Befund c2 vor 118 Tagen → zeitnah', { labor: [B('2026-06-01', t(6))] }, [['L7d', 'zeitnah', 'auffällig']], []],
  ['L7d Grenze 91 Tage', { labor: [B(plus(HEUTE, -91), t(6))] }, [['L7d', 'zeitnah', null]], []],
  ['L7d 90 Tage → noch nicht', { labor: [B(plus(HEUTE, -90), t(6))] }, [], ['L7d']],
  ['L7d nicht bei a', { labor: [B('2026-06-01', t(2))] }, [], ['L7d']],
  ['L7d nicht bei c1', { labor: [B('2026-06-01', t(4.3))] }, [], ['L7d']],
  ['L7d bei b', { labor: [B('2026-06-01', t(6), { ft4: f4(10.5) })] }, [['L7d', 'zeitnah', null]], []],
  ['L7d bei e3', { labor: [B('2026-06-01', t(0.05))] }, [['L7d', 'zeitnah', null]], []],
  ['L7d bei h mit deutlich erhöhtem fT4', { labor: [B('2026-06-01', t(2), { ft4: f4(27) })] }, [['L7d', 'zeitnah', null]], []],
  ['L7d nicht bei h ohne deutlich erhöhtes fT4', { labor: [B('2026-06-01', t(2), { ft4: f4(24) })] }, [], ['L7d']],
  ['L0d Vortag eines Labortermins', { termine: [{ id: 'tm1', datum: plus(HEUTE, 1), art: 'labor' }] }, [['L0d', null, 'Morgen ist Blutabnahme'], ['L0d', null, 'nach der Blutabnahme']], []],
  ['L0d Arzttermin mit Blutabnahme', { termine: [{ id: 'tm1', datum: plus(HEUTE, 1), art: 'arzt', blutabnahme: true }] }, [['L0d', null, 'Morgen ist Blutabnahme']], []],
  ['L0d Arzttermin ohne Blutabnahme → nein', { termine: [{ id: 'tm1', datum: plus(HEUTE, 1), art: 'arzt' }] }, [], ['L0d']],
  ['L0d Labortermin übermorgen → noch nicht', { termine: [{ id: 'tm1', datum: plus(HEUTE, 2), art: 'labor' }] }, [], ['L0d']],
].forEach(([name, f, soll, fehlt]) => fall(name, () => {
  const s = baue({ ohneBefund: true, vor: f.labor || [], ...f });
  const h = ez.kontrolleHinweise(s, HEUTE);
  sammle('kontrolleHinweise', name, textListe(h));
  soll.forEach(([id, stufe, wort]) => {
    const idListe = [].concat(id);
    const treffer = h.filter((x) => idListe.includes(x.id));
    check(`${name}: ${idListe.join('/')} vorhanden`, treffer.length > 0, JSON.stringify(ids(h)));
    if (stufe) check(`${name}: ${idListe.join('/')} Stufe ${stufe}`, treffer.some((x) => x.stufe === stufe), JSON.stringify(treffer.map((x) => x.stufe)));
    if (wort) check(`${name}: ${idListe.join('/')} Text „${wort}"`, enthaelt(textListe(treffer), wort), auszug(textListe(treffer)));
  });
  fehlt.forEach((id) => check(`${name}: kein ${id}`, !h.some((x) => x.id === id), JSON.stringify(ids(h))));
}));
// L0d Biotin: 3 Tage vor der Blutabnahme, nur wenn Biotin in den Mitteln.
[['L0d Biotin-Satz 3 Tage vorher', ['biotin'], true], ['L0d kein Biotin-Satz ohne Biotin', [], false]].forEach(([name, mittel, soll]) => fall(name, () => {
  const s = baue({ ohneBefund: true, mittel, termine: [{ id: 'tm1', datum: plus(HEUTE, 3), art: 'labor' }] });
  const h = ez.kontrolleHinweise(s, HEUTE);
  sammle('kontrolleHinweise', name, textListe(h));
  check(`${name}: ${soll ? 'mit' : 'ohne'} „Biotin … weg"`, h.some((x) => enthaelt(x.text, 'Biotin') && enthaelt(x.text, 'weg')) === soll, auszug(textListe(h)));
}));

// ================================================================ B2 Fragen für die Ärztin (fragenVorschlaege)

/** [Name, Stand-Felder (wie baue), erwartete Schlüsselwörter, verbotene Schlüsselwörter] */
[
  ['B2 F1 + F2 immer ohne Zielbereich (Muster a)', { tsh: t(2) }, ['Zielbereich', 'nächste Mal'], ['TSH liegt über', 'TSH liegt unter', 'T3-Anteil', 'anderen Mittel']],
  ['B2 F1 entfällt mit frischem Zielbereich', { profil: ZIEL(0.5, 2.0), tsh: t(1) }, ['nächste Mal'], ['Zielbereich']],
  ['R12 F1 wieder bei Zielbereich älter als 12 Monate', { profil: ZIEL(0.5, 2.0, '2025-06-01'), tsh: t(1) }, ['Zielbereich'], []],
  ['B2 F3 bei c2', { tsh: t(6) }, ['TSH liegt über'], ['TSH liegt unter']],
  ['B2 F3 bei b', { tsh: t(6), ft4: f4(10.5) }, ['TSH liegt über'], []],
  ['B2 F4 bei e2', { tsh: t(0.2) }, ['TSH liegt unter'], ['TSH liegt über']],
  ['B2 F4 bei d', { tsh: t(0.2), ft4: f4(25) }, ['TSH liegt unter'], []],
  ['B2 F5 bei h', { tsh: t(2), ft4: f4(24) }, ['wiederholt'], []],
  ['B2 F5 bei f', { tsh: t(6), ft4: f4(25) }, ['wiederholt'], []],
  ['B2 F5 bei L5c (Muster a)', { tsh: t(2), befund: { vorAbnahme: 'ja' } }, ['wiederholt'], []],
  ['B2 F5 bei L5d (Biotin im Profil)', { tsh: t(2), mittel: ['biotin'] }, ['wiederholt'], []],
  ['B2 F6 bei g1', { tsh: t(2), ft4: f4(11) }, ['T3-Anteil'], []],
  ['B2 F6 bei g2', { tsh: t(0.2), ft4: f4(10.5) }, ['T3-Anteil'], []],
  ['B2 F7 Beschwerden mit Richtung ohne aktuellen Befund', { ohneBefund: true, befinden: WENIG3 }, ['Blutabnahme sinnvoll'], []],
  ['B2 kein F7 mit aktuellem Befund', { tsh: t(6), befinden: WENIG3 }, [], ['Blutabnahme sinnvoll']],
  ['B2 F8 bei L5b', { tsh: t(6), einnahmen: einnahmen(VORTAG, 42, 4) }, ['vergessenen Tabletten'], []],
  ['R9 F8 bei „mehrere vergessen"', { tsh: t(6), befund: { vergessen: 'mehrere' } }, ['vergessenen Tabletten'], []],
  ['B2 F9 bei Mittel mit M-Regel', { tsh: t(2), mittel: ['kalzium'] }, ['anderen Mittel'], []],
].forEach(([name, f, soll, nicht]) => fall(name, () => {
  const s = baue(f);
  const liste = ez.fragenVorschlaege(s, HEUTE);
  sammle('fragenVorschlaege', name, liste);
  check(`${name}: Liste von Texten`, Array.isArray(liste) && liste.every((x) => typeof x === 'string'), JSON.stringify(liste));
  soll.forEach((x) => check(`${name}: „${x}"`, enthaelt(liste, x), auszug(liste)));
  nicht.forEach((x) => check(`${name}: ohne „${x}"`, !enthaelt(liste, x), auszug(liste)));
}));

// ================================================================ Grundlagen: STUFEN, P6, Texte, letzterBefund, gesamtbild

fall('Entscheidung 18: STUFEN und hoechste()', () => {
  const S = ez.STUFEN || {};
  Object.entries(RANG).forEach(([k, r]) => check(`STUFEN.${k}.rang = ${r}`, S[k] && S[k].rang === r, JSON.stringify(S[k])));
  check('hoechste(termin, tage, zeitnah) = tage', ez.hoechste('termin', 'tage', 'zeitnah') === 'tage');
  check('hoechste(heute, tage) = heute', ez.hoechste('heute', 'tage') === 'heute');
  check('hoechste(notruf, heute, keine) = notruf', ez.hoechste('notruf', 'heute', 'keine') === 'notruf');
  check('hoechste(keine) = keine', ez.hoechste('keine') === 'keine');
});
fall('P6 aktiv()', () => {
  check('P6 nicht aktiv ohne Haken und ohne Grund', ez.aktiv(baue({ ohneBefund: true, profil: { behandelt: false, ursache: '' } })) === false);
  check('P6 aktiv mit Haken „behandelt"', ez.aktiv(baue({ ohneBefund: true, profil: { behandelt: true, ursache: '' } })) === true);
  check('P6 aktiv mit Behandlungsgrund', ez.aktiv(baue({ ohneBefund: true, profil: { behandelt: false, ursache: 'op' } })) === true);
});
fall('Grundsatz 2/4, Entscheidung 9: feste Texte', () => {
  check('FUSSZEILE: ersetzt keine ärztliche Beurteilung', enthaelt(ez.FUSSZEILE, 'ersetzt keine ärztliche Beurteilung') && enthaelt(ez.FUSSZEILE, 'schon erklärt'), ez.FUSSZEILE);
  check('GEGEN_SELBST: weiter genau wie verordnet', enthaelt(ez.GEGEN_SELBST, 'weiter genau wie verordnet') && enthaelt(ez.GEGEN_SELBST, 'nichts weglassen'), ez.GEGEN_SELBST);
  check('P6_TEXT: rechnet nie eine neue Dosis aus', enthaelt(ez.P6_TEXT, 'rechnet nie eine neue Dosis aus'), ez.P6_TEXT);
  check('P6_TEXT: nicht mehr „nennt nie eine Dosis"', !enthaelt(ez.P6_TEXT, 'nennt nie eine Dosis'), ez.P6_TEXT);
});
fall('letzterBefund', () => {
  check('letzterBefund ohne Befund = null', ez.letzterBefund(baue({ ohneBefund: true }), HEUTE) === null);
  const s = baue({ vor: [V('2026-03-01', t(6))], tsh: t(2) });
  const E = ez.letzterBefund(s, HEUTE);
  check('letzterBefund nimmt den jüngsten Befund', !!E && E.befund && E.befund.datum === BEFUND_TAG && E.muster === 'a', JSON.stringify(E && [E.befund && E.befund.datum, E.muster]));
});
fall('Entscheidung 17: nur ein Warnzeichen-Check von HEUTE zählt im Gesamtbild', () => {
  const k = schluessel('w1')[0];
  const heute = ez.gesamtbild(baue({ tsh: t(2), warnzeichen: [{ id: 'wz1', datum: HEUTE, uhr: '08:00', ja: [k] }] }), HEUTE);
  check('Gesamtbild: W1 von heute → notruf', heute.stufe === 'notruf', `ist ${heute.stufe}`);
  const gestern = ez.gesamtbild(baue({ tsh: t(2), warnzeichen: [{ id: 'wz1', datum: plus(HEUTE, -1), uhr: '08:00', ja: [k] }] }), HEUTE);
  check('Gesamtbild: W1 von gestern → nicht notruf', gestern.stufe !== 'notruf', `ist ${gestern.stufe}`);
});

// ================================================================ Nachprüfung: Befunde aus dem Review (B1–B20, B44, B51, B53)
//
// Je Befund mindestens ein Fall, der vor der Korrektur scheiterte. Die Namen
// tragen die Nummer aus der Review-Liste, damit sich ein Rückfall zuordnen lässt.

const teilIds = (g) => (g && Array.isArray(g.teile) ? g.teile.map((x) => `${x.id}:${x.stufe}`) : []);

// ---- B1: „ungewollt abgenommen" im Befinden führt zusätzlich zu W2t (RW1 S1), Stufe tage.
pruefeBeschwerden({ name: 'B1 abnahme allein → W2t, Stufe tage', befinden: [bf(B_TAG, 'abnahme')], stufe: 'tage', regeln: ['W2t'], texte: ['in den nächsten Tagen', '116 117'] });
pruefeBeschwerden({ name: 'B1 abnahme zählt weiter als Punkt (zusätzlich, nicht statt)', befinden: [bf(B_TAG, 'waerme', 'abnahme', 'schwitzen')], richtung: 'viel', pv: 3, regeln: ['W2t', 'S2'] });
fall('B1 Gesamtbild mit TSH 2,0 und abnahme → tage', () => {
  const g = ez.gesamtbild(baue({ tsh: t(2), ft4: f4(15), befinden: [bf(B_TAG, 'abnahme')] }), HEUTE);
  check('B1 Gesamtbild: Stufe tage', g.stufe === 'tage', `ist ${g.stufe}; ${teilIds(g).join(', ')}`);
});

// ---- B2: Befund nur mit fT4 – musterunabhängige L3a/L3e greifen, das Gesamtbild übergeht ihn nicht.
pruefeFall({
  name: 'B2 nur fT4 5 pmol/l (12–22): Stufe tage, Satz 1', tsh: null, ft4: f4(5),
  muster: null, stufe: 'tage', notfall: 1, regeln: ['L3a', 'L3e1'], texte: ['Ohne TSH-Wert', 'deutlich unter'],
  pruef: (E) => [
    ['ohneMuster = true', E.ohneMuster === true, `ist ${E.ohneMuster}`],
    ['Satz gegen Selbsthandlung', typeof E.gegenSelbst === 'string' && enthaelt(E.gegenSelbst, 'wie verordnet'), `ist ${E.gegenSelbst}`],
    ['Frist-Satz „nächsten Tagen"', enthaelt(E.stufeText, 'nächsten Tagen'), E.stufeText],
  ],
});
pruefeFall({ name: 'B2 nur fT4 40 pmol/l (12–22): mindestens zeitnah', tsh: null, ft4: f4(40), muster: null, stufeMin: 'zeitnah', notfall: 3, pruef: (E) => [['ohneMuster', E.ohneMuster === true, `ist ${E.ohneMuster}`]] });
pruefeFall({ name: 'B2 nur fT4 7 ohne Bereich (R6): zeitnah, kein Satz 1', tsh: null, ft4: f4O(7), muster: null, stufe: 'zeitnah', notfallNicht: 1, regeln: ['R6'] });
pruefeFall({ name: 'B2 nur fT4 15 im Bereich: wie bisher kein Anlass', tsh: null, ft4: f4(15), muster: null, stufe: 'keine', texte: ['wichtigste Wert'] });
pruefeFall({ name: 'B2 TSH in unbekannter Einheit ohne Bereich + fT4 5: Stufe tage', tsh: tO(2, 'xyz'), ft4: f4(5), muster: null, stufe: 'tage', notfall: 1 });
fall('B2 Gesamtbild: neuerer Befund nur mit fT4 5 übergeht nicht den älteren „Kein Anlass"', () => {
  const s = baue({ vor: [V('2026-03-01', t(2), { ft4: f4(15) })], tsh: null, ft4: f4(5) });
  const g = ez.gesamtbild(s, HEUTE);
  const teil = g.teile.find((x) => x.id === 'befund-ohne-tsh');
  check('B2 Gesamtbild: Stufe tage', g.stufe === 'tage', `ist ${g.stufe}; ${teilIds(g).join(', ')}`);
  check('B2 Gesamtbild: Teil befund-ohne-tsh mit quelle befund-ohne-muster', !!teil && teil.quelle === 'befund-ohne-muster' && teil.stufe === 'tage', JSON.stringify(teil));
  check('B2 Gesamtbild: Teil nennt den 112-Satz', !!teil && enthaelt(teil.text, '112'), teil && teil.text);
  check('B2 letzterBefund bleibt der Befund mit Muster', !!g.befund && g.befund.befund.datum === '2026-03-01', JSON.stringify(g.befund && g.befund.befund.datum));
  check('B2 gesamtbild.ohneMuster ist die Einschätzung des neuen Befunds', !!g.ohneMuster && g.ohneMuster.befund.datum === BEFUND_TAG, JSON.stringify(g.ohneMuster && g.ohneMuster.befund.datum));
});
fall('B2 Gesamtbild: ein noch neueres unauffälliges fT4 hebt den Teil wieder auf', () => {
  const s = baue({ vor: [V('2026-03-01', t(2), { ft4: f4(15) }), V('2026-08-01', null, { ft4: f4(5) })], tsh: null, ft4: f4(15) });
  const g = ez.gesamtbild(s, HEUTE);
  check('B2 kein Teil befund-ohne-tsh', !g.teile.some((x) => x.id === 'befund-ohne-tsh'), teilIds(g).join(', '));
});
fall('B2 Gesamtbild ohne jeden Befund mit Muster stürzt nicht ab', () => {
  const g = ez.gesamtbild(baue({ tsh: null, ft4: f4(5) }), HEUTE);
  check('B2 ohne Muster-Befund: Stufe tage, befund null', g.stufe === 'tage' && g.befund === null, `ist ${g.stufe}, befund ${g.befund}`);
});

// ---- B3 / B51: einseitiger oder bestätigt ungewöhnlicher TSH-Bereich ergibt nie still Muster a.
pruefeFall({ name: 'B3 TSH 0,05 nur „bis 4,0" → e3 mit Satz gegen Selbsthandlung', tsh: t(0.05, null, 4.0), ft4: f4(15), muster: 'e3', stufe: 'tage', verboten: ['derzeit passt'], pruef: (E) => [['gegenSelbst', !!E.gegenSelbst, `ist ${E.gegenSelbst}`]] });
pruefeFall({ name: 'B3 TSH 25 nur „ab 0,4" → c3, Satz 1', tsh: t(25, 0.4, null), ft4: f4(15), muster: 'c3', stufe: 'tage', notfall: 1, verboten: ['derzeit passt'] });
pruefeFall({ name: 'B3 TSH 0,08 bei bestätigtem Bereich 0,05–4,0 → e3 (feste Schwelle)', tsh: t(0.08, 0.05, 4.0), ft4: f4(15), befund: { bestaetigt: true }, muster: 'e3', stufe: 'tage', verboten: ['derzeit passt'], texte: ['unter 0,1'] });
pruefeFall({ name: 'B3 TSH 12 bei bestätigtem Bereich 0,4–15 → c3 (feste Schwelle)', tsh: t(12, 0.4, 15), ft4: f4(15), befund: { bestaetigt: true }, muster: 'c3', stufe: 'tage' });
pruefeFall({ name: 'B3 feste Schwelle nicht gegen ein Zahlen-Ziel (L2z1): Ziel 0,05–0,5, TSH 0,08 → a', profil: ZIEL(0.05, 0.5), tsh: t(0.08, 0.05, 4.0), ft4: f4(15), befund: { bestaetigt: true }, muster: 'a' });
pruefeFall({ name: 'B3 zielNiedrig + bestätigter Bereich 0,01–4,0, TSH 0,05 → z2a statt z2c', profil: NIEDRIG, tsh: t(0.05, 0.01, 4.0), ft4: f4(15), befund: { bestaetigt: true }, muster: 'z2a' });
fall('B3 TSH 0,05 nur „bis 4,0": Beschwerden zu viel → S3 „passen", L7d nach 100 Tagen', () => {
  const s = baue({ tsh: t(0.05, null, 4.0), ft4: f4(15), befinden: VIEL3 });
  const b = ez.beschwerdenAuswerten(s, HEUTE);
  check('B3 S3 nicht „lagen zuletzt im Bereich"', !enthaelt(textListe(b.texte), 'lagen zuletzt im Bereich'), auszug(textListe(b.texte)));
  check('B3 S3 „passen zum letzten Laborwert"', enthaelt(textListe(b.texte), 'passen zum letzten Laborwert'), auszug(textListe(b.texte)));
  const alt = baue({ tsh: t(0.05, null, 4.0), ft4: f4(15), datum: plus(HEUTE, -100) });
  check('B3 L7d nach 100 Tagen', ez.kontrolleHinweise(alt, HEUTE).some((h) => h.id === 'L7d'), JSON.stringify(ids(ez.kontrolleHinweise(alt, HEUTE))));
});
[
  ['B51 TSH 8, nur „ab 0,27" → über (Orientierung)', t(8, 0.27, null), { lage: 'ueber', quelle: 'orientierung' }],
  ['B51 TSH 4,3, nur „ab 0,27" → am oberen Rand (im)', t(4.3, 0.27, null), { lage: 'im', genau: 'rand-ueber' }],
  ['B51 TSH 0,28, nur „ab 0,27" → im Bereich (die Grenze vom Befund gilt)', t(0.28, 0.27, null), { lage: 'im', genau: 'im' }],
  ['B51 TSH 0,2, nur „ab 0,27" → unter, gegen das Labor', t(0.2, 0.27, null), { lage: 'unter', quelle: 'labor' }],
  ['B51 TSH 0,25, nur „bis 4,2" → unter (Orientierung)', t(0.25, null, 4.2), { lage: 'unter', quelle: 'orientierung' }],
  ['B51 TSH 4,4, nur „bis 4,5" → im (die Grenze vom Befund gilt)', t(4.4, null, 4.5), { lage: 'im' }],
  ['B51 TSH 5, nur „bis 4,2" → über, gegen das Labor', t(5, null, 4.2), { lage: 'ueber', quelle: 'labor' }],
  ['B51 TSH 8 in unbekannter Einheit, nur „ab 0,27" → nur gegen die Grenze', t(8, 0.27, null, 'xyz'), { lage: 'im', quelle: 'labor' }],
].forEach(([name, w, soll]) => fall(name, () => {
  const e = ez.einordnen('tsh', w);
  Object.entries(soll).forEach(([k, v]) => check(`${name}: ${k} = ${v}`, e[k] === v, `ist ${e[k]}`));
}));
pruefeFall({
  name: 'B51 TSH 8 mit „ab 0,27" (zweite Grenze verworfen) → c2 statt a, mit Hinweis', tsh: t(8, 0.27, null), ft4: f4(15),
  muster: 'c2', stufe: 'termin', verboten: ['derzeit passt'], texte: ['beide ein', 'nicht der Bereich Ihres Labors'],
});

// ---- B4 / R1: Der Praxis-Vorrang gilt nur mit Datum und ohne später eingetragene Beschwerde.
fall('B4 Praxis „bleibt" am 21.09., danach Zu-viel-Beschwerden → Gesamtbild bleibt tage', () => {
  const s = baue({ ...PRAXIS_BASIS, befund: { praxis: 'bleibt', praxisAm: '2026-09-21' }, befinden: [bf('2026-09-25', 'schwitzen', 'zittern', 'waerme')] });
  const E = ez.befundEinschaetzen(s.labor.find((x) => x.id === 'ziel'), s, HEUTE);
  const g = ez.gesamtbild(s, HEUTE);
  check('B4 praxisErklaert false', E.praxisErklaert === false, `ist ${E.praxisErklaert}`);
  check('B4 Zusatz R1 erklärt, warum', E.zusaetze.some((z) => z.id === 'R1' && enthaelt(z.text, 'neue Beschwerden')), JSON.stringify(ids(E.zusaetze)));
  check('B4 Gesamtbild tage', g.stufe === 'tage', `ist ${g.stufe}`);
  check('B4 Befund-Teil ohne Praxis-Satz', !g.teile.some((x) => x.quelle === 'befund' && enthaelt(x.text, 'schon erklärt')), teilIds(g).join(', '));
});
fall('B4 Praxis „bleibt" ohne Datum (alte Stände) → Stufe bleibt sichtbar', () => {
  const s = baue({ ...PRAXIS_BASIS, befund: { praxis: 'bleibt', praxisAm: null } });
  const E = ez.befundEinschaetzen(s.labor.find((x) => x.id === 'ziel'), s, HEUTE);
  check('B4 ohne Datum: praxisErklaert false', E.praxisErklaert === false, `ist ${E.praxisErklaert}`);
  check('B4 ohne Datum: Gesamtbild tage', ez.gesamtbild(s, HEUTE).stufe === 'tage', `ist ${ez.gesamtbild(s, HEUTE).stufe}`);
  check('B4 ohne Datum: Zusatz bittet um das Datum', E.zusaetze.some((z) => z.id === 'R1' && enthaelt(z.text, 'Datum')), JSON.stringify(E.zusaetze));
});
fall('B4 Beschwerde VOR dem Gespräch → Praxis-Vorrang gilt weiter', () => {
  const s = baue({ ...PRAXIS_BASIS, befund: { praxis: 'bleibt', praxisAm: '2026-09-21' }, befinden: [bf('2026-09-18', 'schwitzen', 'zittern', 'waerme')] });
  const E = ez.befundEinschaetzen(s.labor.find((x) => x.id === 'ziel'), s, HEUTE);
  check('B4 vorher: praxisErklaert true', E.praxisErklaert === true, `ist ${E.praxisErklaert}`);
});

// ---- B5: zielNiedrig, TSH im Laborbereich – auch mit auffälligem fT4 gilt L2z2 C (zeitnah).
[
  ['B5 zielNiedrig, TSH 2,0 + fT4 11 → z2c zeitnah', f4(11), 'zeitnah'],
  ['B5 zielNiedrig, TSH 2,0 + fT4 24 → z2c zeitnah', f4(24), 'zeitnah'],
  ['B5 zielNiedrig, TSH 2,0 + fT4 9 (deutlich unter) → z2c tage', f4(9), 'tage'],
].forEach(([name, ft4, stufe]) => pruefeFall({ name, profil: { ...NIEDRIG, ...KREBS }, tsh: t(2), ft4, muster: 'z2c', stufe, verboten: ['ohne Bedeutung', 'meist unbedenklich'], texte: ['fT4 liegt zudem'] }));

// ---- B6: Werte genau auf den Grenzen UG × 0,8 / × 0,9, OG × 1,1 / × 1,2 (Gleitkomma).
[
  ['B6 fT4 9,6 bei 12–22 = UG × 0,8 → unter, nicht deutlich', 'ft4', f4(9.6), 'unter'],
  ['B6 fT4 0,64 ng/dl bei 0,8–1,8 → unter, nicht deutlich', 'ft4', f4(0.64, 0.8, 1.8, 'ng/dl'), 'unter'],
  ['B6 fT4 28,8 bei 12–24 = OG × 1,2 → über, nicht deutlich', 'ft4', f4(28.8, 12, 24), 'ueber'],
  ['B6 TSH 0,36 bei 0,4–4,0 = UG × 0,9 → knapp unter', 'tsh', t(0.36), 'knapp-unter'],
  ['B6 TSH 0,243 bei 0,27–4,2 → knapp unter', 'tsh', t(0.243, 0.27, 4.2), 'knapp-unter'],
  ['B6 TSH 4,62 bei 0,27–4,2 = OG × 1,1 → knapp über', 'tsh', t(4.62, 0.27, 4.2), 'knapp-ueber'],
].forEach(([name, key, w, genau]) => fall(name, () => {
  const e = ez.einordnen(key, w);
  check(`${name}: genau ${genau}`, e.genau === genau, `ist ${e.genau}`);
}));
fall('B6 Zielbereich 0,4–2,0: TSH 0,36 = von × 0,9 → knapp unter', () => {
  const e = ez.einordnen('tsh', t(0.36), { ziel: { von: 0.4, bis: 2.0 } });
  check('B6 Ziel: knapp unter', e.genau === 'knapp-unter', `ist ${e.genau}`);
});
pruefeFall({ name: 'B6 TSH 2,0 + fT4 9,6 (12–22) → g1 termin ohne 112-Satz', tsh: t(2), ft4: f4(9.6), muster: 'g1', stufe: 'termin', notfall: 3 });
pruefeFall({ name: 'B6 TSH 0,36 (0,4–4,0), 78 J. → e1 termin', profil: { geburtsjahr: J[78] }, tsh: t(0.36), ft4: f4(15), muster: 'e1', stufe: 'termin' });

// ---- B7: Verlauf am Zielbereich messen (Grundsatz 4) – ein Anstieg über das Ziel heißt nicht „jetzt im Bereich".
pruefeFall({
  name: 'B7 Ziel 0,1–0,5: TSH 0,2 → 1,2 „gestiegen … zu wenig Hormon"', profil: ZIEL(0.1, 0.5), vor: [V('2026-03-01', t(0.2))], tsh: t(1.2),
  muster: 'c2', regeln: ['L6'], texte: ['gestiegen', 'zu wenig Hormon'], verboten: ['jetzt im Bereich'],
});
pruefeFall({
  name: 'B7 Ziel 0,1–0,5: TSH 0,3 → 0,05 „gesunken" statt „etwa gleich"', profil: ZIEL(0.1, 0.5), vor: [V('2026-03-01', t(0.3))], tsh: t(0.05),
  muster: 'e3', texte: ['gesunken'], verboten: ['etwa gleich'],
});
pruefeFall({
  name: 'B7 zielNiedrig: TSH 0,05 → 2,0 „gestiegen" mit Übersetzung', profil: NIEDRIG, vor: [V('2026-03-01', t(0.05))], tsh: t(2),
  muster: 'z2c', texte: ['gestiegen', 'zu wenig Hormon'], verboten: ['jetzt im Bereich'],
});
pruefeFall({
  name: 'B7 Ziel 0,1–0,5: TSH 0,8 → 0,3 „jetzt im Zielbereich"', profil: ZIEL(0.1, 0.5), vor: [V('2026-03-01', t(0.8))], tsh: t(0.3),
  muster: 'a', texte: ['jetzt im Zielbereich'],
});

// ---- B8: Herzklopfen an mehreren Tagen + niedriges TSH → heute (nicht niedriger als ohne Befund).
[
  ['B8 60 J., Herzklopfen an 3 Tagen + e2 → heute', t(0.2)],
  ['B8 60 J., Herzklopfen an 3 Tagen + e3 → heute', t(0.05)],
].forEach(([name, tsh]) => pruefeBeschwerden({
  name, profil: { geburtsjahr: 1966 }, befund: { tsh },
  befinden: [bf(plus(HEUTE, -5), 'herz'), bf(plus(HEUTE, -3), 'herz'), bf(plus(HEUTE, -1), 'herz')],
  stufe: 'heute', regeln: ['S4ii'], texte: ['mehreren Tagen', 'heute in der Praxis', 'niedrigen TSH-Wert'], verboten: ['in den nächsten Tagen'],
}));
pruefeBeschwerden({ name: 'B8 Herzklopfen einmal + e2, 60 J. → weiter tage', profil: { geburtsjahr: 1966 }, befund: { tsh: t(0.2) }, befinden: [bf(B_TAG, 'herz')], stufe: 'tage' });

// ---- B9: gesamtbild nimmt die Dosis-Hinweise auf (Schnittstelle „dosis", eine Gesamteinschätzung).
fall('B9 gesamtbild mit Dosis-Hinweis X3 (tage) → Stufe tage, Teil quelle dosis', () => {
  const s = baue({ tsh: t(2), ft4: f4(15) });
  const dosis = [{ id: 'X3', stufe: 'tage', text: 'Rufen Sie heute oder morgen die Praxis an.', frage: null }, { id: 'WW1', stufe: 'zeitnah', text: 'INR kontrollieren lassen.' }];
  const g = ez.gesamtbild(s, HEUTE, { dosis });
  check('B9 Stufe tage', g.stufe === 'tage', `ist ${g.stufe}`);
  check('B9 Feld dosis mit zwei Einträgen', Array.isArray(g.dosis) && g.dosis.length === 2, JSON.stringify(g.dosis));
  check('B9 Teil X3 mit quelle dosis', g.teile.some((x) => x.id === 'X3' && x.quelle === 'dosis' && x.stufe === 'tage'), teilIds(g).join(', '));
  check('B9 ohne Dosis-Hinweise wie bisher keine', ez.gesamtbild(s, HEUTE).stufe === 'keine', `ist ${ez.gesamtbild(s, HEUTE).stufe}`);
  const wd4 = ez.gesamtbild(s, HEUTE, { dosis: [{ id: 'W-D4', stufe: 'heute', text: 'Bitte heute anrufen.' }] });
  check('B9 W-D4 heute → Gesamtbild heute', wd4.stufe === 'heute', `ist ${wd4.stufe}`);
  const kaputt = ez.gesamtbild(s, HEUTE, { dosis: [{ id: 'X', stufe: 'unsinn', text: 'x' }, null] });
  check('B9 unbekannte Stufe stürzt nicht ab', kaputt.stufe === 'keine', `ist ${kaputt.stufe}`);
});

// ---- B10: M1/WW3 – „am einfachsten mittags" nur, wenn mittags schon 4 Stunden nach der Tablette liegt.
[
  ['B10 Tablette 07:00: mittags oder abends', '07:00', true],
  ['B10 Tablette 11:00: nicht mittags', '11:00', false],
  ['B10 Tablette 13:00: nicht mittags', '13:00', false],
].forEach(([name, uhr, mittags]) => fall(name, () => {
  const p = plan(name, { uhr, mittel: ['kalzium', 'eisen'] });
  ['kalzium', 'eisen'].forEach((k) => {
    const x = eintrag(p, k);
    check(`${name} (${k}): ${mittags ? 'mit' : 'ohne'} „mittags"`, !!x && enthaelt(x.text, 'mittags') === mittags, x && x.text);
  });
}));

// ---- B11: Satz gegen Selbsthandlung (Grundsatz 2) unter jeder Beschwerde-Richtung (S2).
pruefeBeschwerden({ name: 'B11 S2 zu wenig: fester Satz gegen Selbsthandlung', befinden: WENIG3, richtung: 'wenig', texte: ['wie verordnet', 'nichts weglassen', 'nichts an den Tabletten'] });
pruefeBeschwerden({ name: 'B11 S2 zu viel: fester Satz gegen Selbsthandlung', befinden: VIEL3, richtung: 'viel', texte: ['wie verordnet', 'nichts weglassen'] });

// ---- B12: Behandlungsgrund Hirnanhangdrüse – die Stufe kommt aus fT4, nicht aus TSH (RW2 P1).
const HYPO = { ursache: 'hypophyse' };
// Runde 3 (D6): fT4 von 16 auf 19 gesetzt. Geprüft wird hier, dass das
// niedrige TSH keine „zu viel Hormon"-Stufe auslöst; 16 liegt bei 12–22 aber
// in der unteren Hälfte und ergibt seit D6 zu Recht „Termin" (Leitlinie: fT4
// in der oberen Hälfte) – der Fall stünde sonst für etwas anderes.
pruefeFall({ name: 'B12 Hypophyse: TSH 0,05 + fT4 19 → keine „zu viel Hormon"-Stufe', profil: HYPO, tsh: t(0.05), ft4: f4(19), stufe: 'keine', texte: ['entscheidend ist fT4'], verboten: ['zu viel Schilddrüsenhormon', 'Hirnanhangdrüse'], ohneRegeln: ['L3a', 'L4b'] });
pruefeFall({ name: 'B12 Hypophyse: TSH 1,0 + fT4 10,5 → mindestens zeitnah', profil: HYPO, tsh: t(1), ft4: f4(10.5), stufeMin: 'zeitnah', texte: ['zu wenig Schilddrüsenhormon'], verboten: ['ohne Bedeutung'] });
pruefeFall({ name: 'B12 Hypophyse: TSH 1,0 ohne fT4 → termin, fT4 erfragen', profil: HYPO, tsh: t(1), stufe: 'termin', texte: ['fT4 bestimmt'], verboten: ['wichtigste Wert', 'derzeit passt'] });
pruefeFall({ name: 'B12 Hypophyse: fT4 8 (deutlich unter) → tage, Satz 1', profil: HYPO, tsh: t(0.3), ft4: f4(8), stufe: 'tage', notfall: 1 });
// Runde 3 (D6): fT4 von 15 auf 19 gesetzt – aus demselben Grund wie oben.
pruefeFall({ name: 'B12 Hypophyse ohne TSH, fT4 19 → ohne „wichtigste Wert"', profil: HYPO, tsh: null, ft4: f4(19), muster: null, stufe: 'keine', texte: ['entscheidend ist fT4'], verboten: ['wichtigste Wert'] });
pruefeFall({ name: 'B12 Hypophyse: TSH 15 bleibt tage (feste Schwelle)', profil: HYPO, tsh: t(15), ft4: f4(15), stufe: 'tage' });

// ---- B13: bestätigter sehr hoher Wert mit Laborbereich wird eingeordnet (E13: „bis dahin keine Einordnung").
[
  ['B13 Vitamin D 210 ng/ml bestätigt, 30–100 → tage', { ...ww('vitd', 210, 'ng/ml', 30, 100), bestaetigt: true }, 'tage', ['sehr hoch']],
  ['B13 Vitamin D 210 ng/ml nicht bestätigt → keine Einordnung', ww('vitd', 210, 'ng/ml', 30, 100), 'keine', ['passt nicht zur gewählten Einheit']],
  ['B13 Vitamin D 210 ng/ml bestätigt ohne Bereich → Bitte um den Bereich', { ...ww('vitd', 210, 'ng/ml'), bestaetigt: true }, 'keine', ['Bereich vom Befund']],
].forEach(([name, befund, stufe, texte]) => fall(name, () => {
  const s = baue({ tsh: t(2), befund });
  const e = ez.weitereWerte(s.labor.find((x) => x.id === 'ziel'), s).find((x) => x.key === 'vitd');
  check(`${name}: Stufe ${stufe}`, !!e && e.stufe === stufe, JSON.stringify(e));
  texte.forEach((x) => check(`${name}: Text „${x}"`, !!e && enthaelt(e.texte, x), e && e.texte.join(' | ')));
}));

// ---- B14: P3 – Präparat unbekannt oder offen: in Muster e den T3-Hinweis nennen.
[['B14 Präparat unbekannt, e2', 'unbekannt', t(0.2)], ['B14 Präparat offen, e3', '', t(0.05)], ['B14 Präparat offen, e1', '', t(0.37)]]
  .forEach(([name, praeparatArt, tsh]) => pruefeFall({ name, profil: { praeparatArt }, tsh, ft4: f4(15), texte: ['T3-Anteil'], regeln: ['P3'] }));
pruefeFall({ name: 'B14 nur L-Thyroxin, e2: kein P3', tsh: t(0.2), ft4: f4(15), ohneRegeln: ['P3'] });

// ---- B15: E13c B12 in pg/ml gegen die pg/ml-Schwellen (200 / 400).
[
  ['B15 B12 200 pg/ml → Graubereich', 200, 'termin'], ['B15 B12 203 pg/ml → Graubereich', 203, 'termin'],
  ['B15 B12 199 pg/ml → zeitnah', 199, 'zeitnah'], ['B15 B12 401 pg/ml → keine', 401, 'keine'], ['B15 B12 406 pg/ml → keine', 406, 'keine'],
].forEach(([name, wert, stufe]) => fall(name, () => {
  const s = baue({ tsh: t(2), befund: ww('b12', wert, 'pg/ml') });
  const e = ez.weitereWerte(s.labor.find((x) => x.id === 'ziel'), s).find((x) => x.key === 'b12');
  check(`${name}: Stufe ${stufe}`, !!e && e.stufe === stufe, `ist ${e && e.stufe}`);
}));

// ---- B16: W4b beruhigt nicht unter dem Giftnotruf (W4a) oder bei „über Tage zu viele".
[
  ['B16 mehrere + eine_zuviel', ['mehrere', 'eine_zuviel']],
  ['B16 packung + eine_zuviel', ['packung', 'eine_zuviel']],
  ['B16 zuviele + eine_zuviel', ['zuviele', 'eine_zuviel']],
].forEach(([name, ja]) => fall(name, () => {
  const r = warn(name, ja);
  check(`${name}: kein W4b`, !abschnittIds(r).includes('W4b'), JSON.stringify(abschnittIds(r)));
  check(`${name}: kein „unbedenklich"`, !enthaelt(warnTexte(r), 'unbedenklich'), auszug(warnTexte(r)));
}));
fall('B16 eine_zuviel allein → W4b bleibt', () => {
  check('B16 W4b allein', abschnittIds(warn('B16 allein', ['eine_zuviel'])).includes('W4b'));
});

// ---- B17: g2 (R11/L2z3) bei TSH < 0,1 – Ausnahmen von L3a gelten auch hier; Krebs ohne Ziel: Ziel erfragen.
pruefeFall({ name: 'B17 zielNiedrig, TSH 0,08 + fT4 10,5 → g2 zeitnah', profil: NIEDRIG, tsh: t(0.08), ft4: f4(10.5), muster: 'g2', stufe: 'zeitnah', ohneRegeln: ['L3a'] });
pruefeFall({ name: 'B17 Krebs ohne Ziel, TSH 0,08 + fT4 10,5 → g2 zeitnah mit Bitte um Zielbereich', profil: KREBS, tsh: t(0.08), ft4: f4(10.5), muster: 'g2', stufe: 'zeitnah', regeln: ['L2z3'], texte: ['Zielbereich'] });
pruefeFall({ name: 'B17 Zahlen-Ziel 0,5–2,0, TSH 0,08 (unter dem Ziel) + fT4 10,5 → g2 tage (L2z1)', profil: ZIEL(0.5, 2.0), tsh: t(0.08), ft4: f4(10.5), muster: 'g2', stufe: 'tage' });

// ---- B18: R12 hebt Muster a an → Begründung statt „passt"; R12-Zusatz ohne eigene Frist.
pruefeFall({
  name: 'B18 Ziel 0,05–0,5, TSH 0,08, 78 J. → a zeitnah mit Begründung', profil: { ...ZIEL(0.05, 0.5), geburtsjahr: J[78] }, tsh: t(0.08), ft4: f4(15),
  muster: 'a', stufe: 'zeitnah', regeln: ['R12', 'R12b'], texte: ['Herz und Knochen'], verboten: ['derzeit passt'],
  pruef: (E) => [['Satz gegen Selbsthandlung', !!E.gegenSelbst, `ist ${E.gegenSelbst}`]],
});
pruefeFall({ name: 'B18 veraltetes Ziel unter Stufe tage: R12 ohne „nächsten Termin"', profil: ZIEL(0.1, 0.5, '2025-01-01'), tsh: t(0.05), ft4: f4(15), muster: 'e3', stufe: 'tage', regeln: ['R12'], verboten: ['nächsten Termin'] });

// ---- B19: F1 (Zielbereich erfragen), solange kein Zahlen-Ziel eingetragen ist – auch bei zielNiedrig.
fall('B19 zielNiedrig ohne Zahlen: F1 vorgeschlagen', () => {
  const liste = ez.fragenVorschlaege(baue({ profil: { ...NIEDRIG, ...KREBS }, tsh: t(2) }), HEUTE);
  check('B19 F1 „Zielbereich"', enthaelt(liste, 'Zielbereich'), auszug(liste));
});

// ---- B20: Der erste Dosis-Eintrag (Einrichtungstag nach dem Befund) ist keine Dosisänderung (Entscheidung 3).
pruefeBeschwerden({
  name: 'B20 einzige Dosis ab Einrichtung nach dem Befund → S3 bleibt', befund: { tsh: t(0.2), datum: '2026-08-30' },
  dosen: [{ id: 'd1', ab: '2026-09-10', praeparat: 'L-Thyroxin', mikrogramm: 75, tabletten: 1 }], befinden: VIEL3,
  regeln: ['S3'], texte: ['passen zum letzten Laborwert'],
});

// ---- B44: Stufen der weiteren Werte zählen im Gesamtbild (E13e Tage, E13f zeitnah).
fall('B44 Vitamin D 120 ng/ml und Hb 9,5 g/dl → Gesamtbild tage', () => {
  const s = baue({ tsh: t(2.1), ft4: f4(15), befund: { ...ww('vitd', 120, 'ng/ml'), ...ww('hb', 9.5, 'g/dl', 12, 16) } });
  const g = ez.gesamtbild(s, HEUTE);
  check('B44 Stufe tage', g.stufe === 'tage', `ist ${g.stufe}; ${teilIds(g).join(', ')}`);
  check('B44 Teil Vitamin D (quelle weitere, tage)', g.teile.some((x) => x.id === 'E13-vitd' && x.quelle === 'weitere' && x.stufe === 'tage'), teilIds(g).join(', '));
  check('B44 Teil Hb (zeitnah)', g.teile.some((x) => x.id === 'E13-hb' && x.stufe === 'zeitnah'), teilIds(g).join(', '));
  check('B44 Feld weitere', Array.isArray(g.weitere) && g.weitere.length === 2, JSON.stringify(g.weitere));
});
fall('B44 weitere Werte bleiben auch bei Praxis-Angabe zum TSH', () => {
  const s = baue({ tsh: t(2.1), befund: { ...ww('vitd', 120, 'ng/ml'), praxis: 'bleibt', praxisAm: '2026-09-22' } });
  check('B44 Praxis: Stufe tage', ez.gesamtbild(s, HEUTE).stufe === 'tage', `ist ${ez.gesamtbild(s, HEUTE).stufe}`);
});
fall('B44 ein neuerer unauffälliger Wert ersetzt den alten', () => {
  const s = baue({ vor: [V('2026-09-01', t(2), ww('vitd', 120, 'ng/ml'))], tsh: t(2), befund: ww('vitd', 40, 'ng/ml') });
  const g = ez.gesamtbild(s, HEUTE);
  check('B44 kein Vitamin-D-Teil', !g.teile.some((x) => x.id === 'E13-vitd'), teilIds(g).join(', '));
});

// ---- B53: Warnzeichen-Checks werden nicht nach Anzahl 50 gekappt (Bericht: 90 Tage, Entscheidung 17).
fall('B53 60 tägliche Checks bleiben beim Laden erhalten, samt Brustschmerz-Check', () => {
  const w = [];
  for (let i = 59; i >= 0; i--) w.push({ id: `w${i}`, datum: plus(HEUTE, -i), uhr: '08:00', ja: i === 55 ? ['brust'] : [] });
  const s = baue({ ohneBefund: true, warnzeichen: w });
  check('B53 alle 60 Checks', s.warnzeichen.length === 60, `ist ${s.warnzeichen.length}`);
  const z = ez.berichtZeilen(s, HEUTE).filter((x) => x.startsWith('Warnzeichen-Check'));
  check('B53 Bericht nennt den Brustschmerz-Check', z.some((x) => enthaelt(x, 'Brust')), `${z.length} Zeilen`);
});

// ================================================================ Runde 2 (C9–C22)
//
// Befunde der zweiten Review-Runde, soweit sie den Kern und den Speicher
// betreffen. Jeder Fall hier scheiterte vor der Korrektur.

/** Der Warnzeichen-Check von heute ohne ein einziges Kreuz („Nichts davon"). */
const NICHTS_HEUTE = [{ id: 'wz-heute', datum: HEUTE, uhr: '09:00', ja: [] }];
const w3Von = (r) => (r && Array.isArray(r.abschnitte) ? r.abschnitte.find((a) => a.id === 'W3') : null);

// ---- C9: „Nichts davon" nennt nicht „beim nächsten Termin", wenn das Befinden
// selbst anrufen lässt und zum Check geschickt hat (R3, S4, S4ii, W2t; L3f).
[
  ['C9 R3: Herzklopfen an zwei Tagen, TSH 5,5', { tsh: t(5.5) }, [bf(plus(HEUTE, -1), 'herz'), bf(HEUTE, 'herz')], 'R3', 'heute'],
  ['C9 S4: Puls unregelmäßig', { tsh: t(2) }, [bf(HEUTE, 'puls')], 'S4', 'heute'],
  ['C9 S4ii: Herzklopfen an zwei Tagen + TSH 0,2', { tsh: t(0.2) }, [bf(plus(HEUTE, -1), 'herz'), bf(HEUTE, 'herz')], 'S4ii', 'heute'],
  ['C9 W2t: ungewollt abgenommen', { tsh: t(2) }, [bf(HEUTE, 'abnahme')], 'W2t', 'tage'],
].forEach(([name, labor, befinden, id, stufe]) => fall(name, () => {
  const s = baue({ profil: { geburtsjahr: J[78], herz: 'ja' }, ...labor, ft4: f4(15), befinden, warnzeichen: NICHTS_HEUTE });
  const r = ez.warnHeute(s, HEUTE);
  sammle('warnzeichenAuswerten', name, texteVon(r, ['check']));
  const w3 = w3Von(r);
  check(`${name}: Stufe ${stufe}`, !!r && r.stufe === stufe, `ist ${r && r.stufe}`);
  check(`${name}: Stufe des Checks allein bleibt termin`, !!r && r.stufeCheck === 'termin', `ist ${r && r.stufeCheck}`);
  check(`${name}: der Text ${id} steht beim Ergebnis`, !!r && Array.isArray(r.befinden) && r.befinden.some((x) => x.id === id), JSON.stringify(r && ids(r.befinden)));
  check(`${name}: W3 trägt ${stufe}`, !!w3 && w3.stufe === stufe, JSON.stringify(w3 && w3.stufe));
  check(`${name}: W3 ohne „nächsten Termin"`, !!w3 && !enthaelt(w3.text, 'nächsten Termin'), w3 && w3.text);
  check(`${name}: W3 weiter gegen falsche Sicherheit`, !!w3 && enthaelt(w3.text, 'kein Warnzeichen') && enthaelt(w3.text, 'schlechter'), w3 && w3.text);
  if (stufe === 'heute') {
    check(`${name}: 116 117 aus dem W3-Text ist anrufbar`, !!w3 && enthaelt(w3.text, '116 117') && w3.anrufe.some((a) => a.nummer === '116117'), JSON.stringify(w3 && w3.anrufe));
  }
  const g = ez.gesamtbild(s, HEUTE);
  const niedriger = g.teile.filter((x) => x.quelle === 'warnzeichen' && rang(x.stufe) < rang(stufe));
  check(`${name}: im Gesamtbild kein Check-Teil unter ${stufe}`, niedriger.length === 0, teilIds(g).join(', '));
}));
fall('C9 ein älterer Check bleibt, wie er war', () => {
  const s = baue({ tsh: t(2), befinden: [bf(HEUTE, 'puls')], warnzeichen: [{ id: 'wz-alt', datum: plus(HEUTE, -2), uhr: '09:00', ja: [] }] });
  const r = ez.checkAuswerten(s.warnzeichen[0], s, HEUTE);
  check('C9 alt: Stufe termin', r.stufe === 'termin', `ist ${r.stufe}`);
  check('C9 alt: ohne Texte aus dem Befinden', Array.isArray(r.befinden) && r.befinden.length === 0, JSON.stringify(r.befinden));
  check('C9 alt: W3 wie im Regelwerk', enthaelt(w3Von(r).text, 'Übrige Beschwerden beim nächsten Termin'), w3Von(r).text);
  const ohne = ez.warnzeichenAuswerten([], s);
  check('C9 ohne Tag (Dosis-Karte): Stufe termin, W3 unverändert', ohne.stufe === 'termin' && w3Von(ohne).stufe === 'termin', `ist ${ohne.stufe}`);
});
fall('C9 ohne P6: Gesamtbild nimmt die Stufe aus W3 mit', () => {
  const s = baue({ profil: { behandelt: false, ursache: '' }, ohneBefund: true, befinden: [bf(HEUTE, 'puls')], warnzeichen: NICHTS_HEUTE });
  const g = ez.gesamtbild(s, HEUTE);
  check('C9 ohne P6: nicht aktiv', g.aktiv === false, `ist ${g.aktiv}`);
  check('C9 ohne P6: Stufe heute', g.stufe === 'heute', `ist ${g.stufe}`);
});
fall('C9 mit P6: viele Beschwerden (S2b) heben W3 auf „ein bis zwei Wochen"', () => {
  const s = baue({ tsh: t(2), befinden: [bf(HEUTE, 'muede', 'frieren', 'schlaf', 'konzentration', 'schmerzen')], warnzeichen: NICHTS_HEUTE });
  const r = ez.warnHeute(s, HEUTE);
  check('C9 S2b: Stufe zeitnah', r.stufe === 'zeitnah', `ist ${r.stufe}`);
  check('C9 S2b: W3 ohne „nächsten Termin"', !enthaelt(w3Von(r).text, 'nächsten Termin'), w3Von(r).text);
});
fall('C9 W4b mit Herzklopfen an zwei Tagen: W4b bleibt, das Befinden steht dabei', () => {
  const s = baue({ tsh: t(5.5), befinden: [bf(plus(HEUTE, -1), 'herz'), bf(HEUTE, 'herz')], warnzeichen: [{ id: 'wz', datum: HEUTE, uhr: '09:00', ja: ['eine_zuviel'] }] });
  const r = ez.warnHeute(s, HEUTE);
  check('C9 W4b: Stufe heute', r.stufe === 'heute', `ist ${r.stufe}`);
  check('C9 W4b: Abschnitt W4b bleibt termin', r.abschnitte.some((a) => a.id === 'W4b' && a.stufe === 'termin'), JSON.stringify(ids(r.abschnitte)));
  check('C9 W4b: R3 beim Ergebnis', r.befinden.some((x) => x.id === 'R3'), JSON.stringify(ids(r.befinden)));
});

// ---- C10: Eine Befund-Karte, deren weitere Werte eine höhere Frist haben,
// trägt nicht „Kein besonderer Anlass" als Kopf (E13e/f, Grundsatz 5, L3f).
const C10_WEITERE = { ...ww('vitd', 120, 'ng/ml', 30, 100), ...ww('hb', 9.5, 'g/dl', 12, 16) };
fall('C10 Muster a mit Vitamin D 120 und Hb 9,5 → Kopf „In den nächsten Tagen anrufen"', () => {
  const { E, s } = einschaetzung({ name: 'C10 a + Vitamin D', tsh: t(2), ft4: f4(16), befund: C10_WEITERE });
  check('C10: Stufe aus TSH/fT4 bleibt keine (Dosis-Karte, L7d)', E.stufe === 'keine', `ist ${E.stufe}`);
  check('C10: stufeGesamt tage', E.stufeGesamt === 'tage', `ist ${E.stufeGesamt}`);
  check('C10: Kopf tage', !!E.kopf && E.kopf.stufe === 'tage' && E.kopf.titel === 'In den nächsten Tagen anrufen', JSON.stringify(E.kopf));
  check('C10: Kopf ohne „Kein besonderer Anlass"', !!E.kopf && !enthaelt(E.kopf.text, 'Kein besonderer Anlass'), E.kopf && E.kopf.text);
  check('C10: Kopf nennt Vitamin D und die Frist', !!E.kopf && enthaelt(E.kopf.text, 'Vitamin D') && enthaelt(E.kopf.text, 'in den nächsten Tagen'), E.kopf && E.kopf.text);
  check('C10: Kopf sagt, dass die Schilddrüsenwerte keinen Anlass geben', !!E.kopf && enthaelt(E.kopf.text, 'Schilddrüsenwerte'), E.kopf && E.kopf.text);
  check('C10: Kopf nennt den anhebenden Wert', !!E.kopf && JSON.stringify(E.kopf.weitere) === '["vitd"]', JSON.stringify(E.kopf && E.kopf.weitere));
  const g = ez.gesamtbild(s, HEUTE);
  const b = g.teile.find((x) => x.quelle === 'befund');
  check('C10 Gesamtbild: Stufe tage', g.stufe === 'tage', `ist ${g.stufe}`);
  check('C10 Gesamtbild: Befund-Teil ohne „Kein besonderer Anlass"', !!b && !enthaelt(b.text, 'Kein besonderer Anlass'), b && b.text);
  check('C10 Gesamtbild: Befund-Teil als „Schilddrüsenwerte vom …" beschriftet', !!b && b.beschriftung === 'Schilddrüsenwerte vom 20.09.2026' && b.nurSchilddruese === true, JSON.stringify(b));
  const z = ez.berichtZeilen(s, HEUTE).find((x) => x.includes('Einordnung (App)')) || '';
  check('C10 Bericht: Stufe der Schilddrüsenwerte und insgesamt', enthaelt(z, 'Kein besonderer Anlass') && enthaelt(z, 'Vitamin D') && enthaelt(z, 'insgesamt „In den nächsten Tagen anrufen"'), z);
});
fall('C10 ohne weitere Werte: Kopf wie die Stufe', () => {
  const { E, s } = einschaetzung({ name: 'C10 c2 allein', tsh: t(6), ft4: f4(15) });
  check('C10 allein: Kopf = Stufe und Fristsatz', !!E.kopf && E.kopf.stufe === E.stufe && E.kopf.text === E.stufeText && E.stufeGesamt === E.stufe, JSON.stringify(E.kopf));
  const b = ez.gesamtbild(s, HEUTE).teile.find((x) => x.quelle === 'befund');
  check('C10 allein: „Letzter Befund vom …" und der Fristsatz', !!b && b.beschriftung === 'Letzter Befund vom 20.09.2026' && b.text === E.stufeText, JSON.stringify(b));
});
fall('C10 Muster c1 (termin) mit Hb 9,5 (zeitnah) → Kopf zeitnah, nennt Hb und die Schilddrüsenwerte', () => {
  const { E } = einschaetzung({ name: 'C10 c1 + Hb', tsh: t(4.3), ft4: f4(15), befund: ww('hb', 9.5, 'g/dl', 12, 16) });
  check('C10 c1: Stufe termin, Kopf zeitnah', E.stufe === 'termin' && !!E.kopf && E.kopf.stufe === 'zeitnah', `${E.stufe} / ${JSON.stringify(E.kopf)}`);
  check('C10 c1: Kopf ohne „nächsten Termin"', !enthaelt(E.kopf.text, 'nächsten Termin'), E.kopf.text);
  check('C10 c1: Kopf nennt Hämoglobin und die Schilddrüsenwerte', enthaelt(E.kopf.text, 'Hämoglobin') && enthaelt(E.kopf.text, 'Schilddrüsenwerte'), E.kopf.text);
});
fall('C10 Praxis hat erklärt, Vitamin D 120 → Kopf tage, Praxis-Satz nur für die Schilddrüsenwerte', () => {
  const { E } = einschaetzung({ name: 'C10 Praxis', tsh: t(6), ft4: f4(15), befund: { ...ww('vitd', 120, 'ng/ml', 30, 100), praxis: 'bleibt', praxisAm: '2026-09-22' } });
  check('C10 Praxis: praxisErklaert', E.praxisErklaert === true, `ist ${E.praxisErklaert}`);
  check('C10 Praxis: Kopf tage', !!E.kopf && E.kopf.stufe === 'tage', JSON.stringify(E.kopf));
  check('C10 Praxis: Kopf mit Praxis-Satz und Vitamin D', enthaelt(E.kopf.text, 'Praxis hat Ihnen die Schilddrüsenwerte') && enthaelt(E.kopf.text, 'Vitamin D'), E.kopf.text);
});
fall('C10 über alle bisherigen Einschätzungen: der Kopf nennt nie weniger als die Stufe', () => {
  const mit = ALLE_E.filter((x) => x.E && (x.E.muster || x.E.ohneMuster));
  check(`C10 global: Einschätzungen (${mit.length})`, mit.length > 150, `nur ${mit.length}`);
  const falsch = mit.filter((x) => !x.E.kopf || rang(x.E.kopf.stufe) < rang(x.E.praxisErklaert ? 'keine' : x.E.stufe) || x.E.kopf.stufe !== x.E.stufeGesamt);
  check('C10 global: Kopf ≥ Stufe, stufeGesamt = Kopf', falsch.length === 0, falsch.slice(0, 5).map((x) => x.name).join(' | '));
});

// ---- C11 (Kern-Teil): L7d nach einer Dosisänderung unterstellt nicht, es sei nichts geschehen.
fall('C11 Befund c2 vor 100 Tagen, Dosis danach von der Praxis geändert → L7d sagt es', () => {
  const s = baue({ ohneBefund: true, vor: [B('2026-06-19', t(7))], dosen: [D1, { id: 'd2', ab: '2026-07-29', praeparat: 'L-Thyroxin', mikrogramm: 88, tabletten: 1, praxis: true }] });
  const l7d = ez.kontrolleHinweise(s, HEUTE).find((h) => h.id === 'L7d');
  sammle('kontrolleHinweise', 'C11', l7d ? [l7d.text] : []);
  check('C11: L7d bleibt (sonst fehlte nach Tag 183 jede Erinnerung)', !!l7d && l7d.stufe === 'zeitnah', JSON.stringify(l7d));
  check('C11: L7d nennt die Dosisänderung', !!l7d && enthaelt(l7d.text, 'Dosis geändert') && enthaelt(l7d.text, 'TSH'), l7d && l7d.text);
  check('C11: nicht „seitdem wurde nicht neu kontrolliert"', !!l7d && !enthaelt(l7d.text, 'nicht neu kontrolliert'), l7d && l7d.text);
});
fall('C11 eine Berichtigung ist keine Dosisänderung', () => {
  const s = baue({ ohneBefund: true, vor: [B('2026-06-19', t(7))], dosen: [D1, { id: 'd2', ab: '2026-07-29', praeparat: 'L-Thyroxin', mikrogramm: 88, tabletten: 1, berichtigung: true }] });
  const l7d = ez.kontrolleHinweise(s, HEUTE).find((h) => h.id === 'L7d');
  check('C11 Berichtigung: L7d ohne „Dosis geändert"', !!l7d && !enthaelt(l7d.text, 'Dosis geändert'), l7d && l7d.text);
});

// ---- C12: W5 aus dem Check nennt 116 117 – der Knopf dazu fehlt nicht.
fall('C12 Check „lebensmüde": 116 117 anrufbar wie beim W5 aus dem Befinden', () => {
  const r = warn('C12', ['lebensmuede']);
  const w5 = r.abschnitte.find((a) => a.id === 'W5');
  const nr = w5 ? w5.anrufe.map((a) => a.nummer) : [];
  check('C12: der Text nennt 116 117', !!w5 && enthaelt(w5.text, '116 117'), w5 && w5.text);
  check('C12: Knöpfe Seelsorge, 116 117 und 112', ['08001110111', '08001110222', '116117', '112'].every((n) => nr.includes(n)), JSON.stringify(nr));
});

// ---- C13: Ein neuerer Befund nur mit fT4 – L7d und die Beschriftung stimmen.
fall('C13 Befund e2 am 30.05., am 22.09. nur fT4 5 → „TSH nicht neu bestimmt", „Letzter Befund mit TSH"', () => {
  const s = baue({ ohneBefund: true, vor: [B('2026-05-30', t(0.3)), { id: 'nurft4', datum: '2026-09-22', ft4: f4(5) }] });
  const l7d = ez.kontrolleHinweise(s, HEUTE).find((h) => h.id === 'L7d');
  sammle('kontrolleHinweise', 'C13', l7d ? [l7d.text] : []);
  check('C13: L7d bleibt zeitnah (TSH fehlt wirklich)', !!l7d && l7d.stufe === 'zeitnah', JSON.stringify(l7d));
  check('C13: L7d „TSH nicht neu bestimmt"', !!l7d && enthaelt(l7d.text, 'TSH nicht neu bestimmt'), l7d && l7d.text);
  check('C13: nicht „seitdem wurde nicht neu kontrolliert"', !!l7d && !enthaelt(l7d.text, 'nicht neu kontrolliert'), l7d && l7d.text);
  const g = ez.gesamtbild(s, HEUTE);
  const b = g.teile.find((x) => x.quelle === 'befund');
  check('C13 Gesamtbild: „Letzter Befund mit TSH vom 30.05.2026"', !!b && b.beschriftung === 'Letzter Befund mit TSH vom 30.05.2026', JSON.stringify(b && b.beschriftung));
  check('C13 Gesamtbild: der fT4-Befund zählt weiter (tage)', g.stufe === 'tage', `ist ${g.stufe}`);
});

// ---- C14: normStand führt Befunde eines Tages zusammen, ohne still zu entscheiden.
const FRAGEN_NEIN = { krank: 'nein', kortison: 'nein', kontrastmittel: 'nein', mittelGeaendert: 'nein', einnahmeGeaendert: 'nein', packung: 'nein' };
fall('C14 Biotin „nein" und „ja" am selben Tag → ein Befund, Biotin wieder offen', () => {
  const s = baue({ ohneBefund: true, vor: [
    { id: 'a', datum: BEFUND_TAG, tsh: t(0.04, 0.27, 4.2), ...FRAGEN_NEIN, biotin: 'nein' },
    { id: 'b', datum: BEFUND_TAG, ft4: f4(27), ...FRAGEN_NEIN, biotin: 'ja' },
  ] });
  const tag = s.labor.filter((l) => l.datum === BEFUND_TAG);
  check('C14 Biotin: ein Befund mit TSH und fT4 (B52)', tag.length === 1 && !!tag[0].tsh && !!tag[0].ft4, JSON.stringify(tag.map((l) => l.id)));
  check('C14 Biotin: offen statt „nein"', tag.length === 1 && tag[0].biotin === '', `ist ${tag[0] && tag[0].biotin}`);
  check('C14 Biotin: übereinstimmende Antworten bleiben', tag.length === 1 && tag[0].krank === 'nein', `ist ${tag[0] && tag[0].krank}`);
});
fall('C14 zwei Bereiche für dasselbe TSH, Tablette „nein"/„ja" → später Bereich, Notiz, Frage offen', () => {
  const s = baue({ ohneBefund: true, vor: [
    { id: 'a', datum: BEFUND_TAG, tsh: t(4.1, 0.4, 4.0), vorAbnahme: 'nein', abnahmeUhr: '08:00', notiz: 'nüchtern' },
    { id: 'b', datum: BEFUND_TAG, tsh: t(4.1, 0.27, 4.2), vorAbnahme: 'ja', tabletteUhr: '06:30', abnahmeUhr: '09:15' },
  ] });
  const tag = s.labor.filter((l) => l.datum === BEFUND_TAG);
  const l = tag[0] || {};
  check('C14 Bereich: ein Befund', tag.length === 1, `${tag.length} Befunde`);
  check('C14 Bereich: es gilt der spätere (0,27–4,2)', !!l.tsh && l.tsh.von === 0.27 && l.tsh.bis === 4.2, JSON.stringify(l.tsh));
  check('C14 Bereich: der andere steht in der Notiz, die eigene bleibt', enthaelt(l.notiz, '0,4–4') && enthaelt(l.notiz, 'nüchtern'), l.notiz);
  check('C14 Tablette vorher: „nein"/„ja" → offen', l.vorAbnahme === '', `ist ${l.vorAbnahme}`);
  check('C14 Uhrzeit der Abnahme: erste bleibt, zweite in der Notiz', l.abnahmeUhr === '08:00' && enthaelt(l.notiz, '09:15'), `${l.abnahmeUhr} / ${l.notiz}`);
});
fall('C14 zwei Uhrzeiten der Tablette, zwei Praxis-Angaben → beide offen', () => {
  const s = baue({ ohneBefund: true, vor: [
    { id: 'a', datum: BEFUND_TAG, tsh: t(6), tabletteUhr: '06:30', praxis: 'bleibt', praxisAm: '2026-09-21' },
    { id: 'b', datum: BEFUND_TAG, ft4: f4(15), tabletteUhr: '07:10', praxis: 'geaendert', praxisAm: '2026-09-22' },
  ] });
  const l = s.labor.find((x) => x.datum === BEFUND_TAG) || {};
  check('C14 Tablette: Uhrzeit offen, beide in der Notiz', l.tabletteUhr === '' && enthaelt(l.notiz, '06:30') && enthaelt(l.notiz, '07:10'), `${l.tabletteUhr} / ${l.notiz}`);
  check('C14 Praxis: offen, ohne Datum', l.praxis === '' && l.praxisAm === null, `${l.praxis} / ${l.praxisAm}`);
});
fall('C14 ohne Widerspruch ergänzen sich die Angaben wie bisher', () => {
  const s = baue({ ohneBefund: true, vor: [
    { id: 'a', datum: BEFUND_TAG, tsh: t(6, 0.4, null), biotin: 'nein', praxis: 'bleibt', praxisAm: '2026-09-21' },
    { id: 'b', datum: BEFUND_TAG, tsh: t(6, null, 4.0), ft4: f4(15), vorAbnahme: 'nein', abnahmeUhr: '08:00' },
  ] });
  const l = s.labor.find((x) => x.datum === BEFUND_TAG) || {};
  check('C14 ergänzt: Bereich aus beiden Hälften', !!l.tsh && l.tsh.von === 0.4 && l.tsh.bis === 4.0, JSON.stringify(l.tsh));
  check('C14 ergänzt: Fragen, Uhrzeit, Praxis mit Datum', l.biotin === 'nein' && l.vorAbnahme === 'nein' && l.abnahmeUhr === '08:00' && l.praxis === 'bleibt' && l.praxisAm === '2026-09-21',
    JSON.stringify([l.biotin, l.vorAbnahme, l.abnahmeUhr, l.praxis, l.praxisAm]));
  check('C14 ergänzt: keine Notiz', l.notiz === '', l.notiz);
});

// ---- C15: Drei Einträge an einem Tag mit berichtigtem TSH – das fT4 kommt zum
// zuletzt eingetragenen, mit dem die Auswertung rechnet.
fall('C15 TSH 7, TSH 7,5, dann fT4 5 am selben Tag → Muster b, Stufe tage', () => {
  const s = baue({ ohneBefund: true, vor: [
    { id: 'a', datum: BEFUND_TAG, tsh: t(7) }, { id: 'b', datum: BEFUND_TAG, tsh: t(7.5) }, { id: 'c', datum: BEFUND_TAG, ft4: f4(5) },
  ] });
  const b = s.labor.find((l) => l.id === 'b');
  check('C15: das fT4 steht beim zuletzt eingetragenen TSH', !!b && !!b.ft4 && b.ft4.wert === 5, JSON.stringify(s.labor.map((l) => [l.id, l.tsh && l.tsh.wert, l.ft4 && l.ft4.wert])));
  const e = ez.letzterBefund(s, HEUTE);
  check('C15: letzter Befund Muster b, Stufe tage, Notfallsatz 1', !!e && e.muster === 'b' && e.stufe === 'tage' && e.notfall.satz === 1, e && `${e.muster}/${e.stufe}/${e.notfall.satz}`);
  check('C15: Gesamtbild tage', ez.gesamtbild(s, HEUTE).stufe === 'tage', `ist ${ez.gesamtbild(s, HEUTE).stufe}`);
  ['a', 'b'].forEach((id) => {
    const h = ez.befundEinschaetzen(s.labor.find((l) => l.id === id), s, HEUTE).hinweise;
    check(`C15: Befund-Karte ${id} nennt die zwei Einträge`, enthaelt(h, 'zwei Einträge') && enthaelt(h, 'TSH'), auszug(h));
  });
  const k = ez.kontrolleHinweise(s, HEUTE).find((x) => x.id === 'L0b-doppelt');
  check('C15: „Heute" nennt die zwei Einträge (ohne eigene Frist)', !!k && k.stufe === 'keine' && enthaelt(k.text, 'löschen Sie den falschen'), JSON.stringify(k));
});
fall('C15 schon falsch gespeichert (fT4 beim ersten Eintrag) → „Heute" vorsichtshalber tage', () => {
  const s = baue({ ohneBefund: true, vor: [{ id: 'a', datum: BEFUND_TAG, tsh: t(7), ft4: f4(5) }, { id: 'b', datum: BEFUND_TAG, tsh: t(7.5) }] });
  const k = ez.kontrolleHinweise(s, HEUTE).find((x) => x.id === 'L0b-doppelt');
  sammle('kontrolleHinweise', 'C15', k ? [k.text] : []);
  check('C15 alt: Hinweis mit Stufe tage', !!k && k.stufe === 'tage', JSON.stringify(k));
  check('C15 alt: der Hinweis nennt die Frist', !!k && enthaelt(k.text, 'in den nächsten Tagen'), k && k.text);
  const g = ez.gesamtbild(s, HEUTE);
  check('C15 alt: Gesamtbild tage statt termin', g.stufe === 'tage', `ist ${g.stufe}; ${teilIds(g).join(', ')}`);
});
fall('C15 verglichen wird nur, worin sich die Einträge widersprechen', () => {
  // Vitamin D nur im ersten Eintrag zählt im Gesamtbild ohnehin – der Hinweis zum TSH hebt nichts an.
  const nurTsh = baue({ ohneBefund: true, vor: [{ id: 'a', datum: BEFUND_TAG, tsh: t(2), ...ww('vitd', 120, 'ng/ml', 30, 100) }, { id: 'b', datum: BEFUND_TAG, tsh: t(2.5) }] });
  const k1 = ez.kontrolleHinweise(nurTsh, HEUTE).find((x) => x.id === 'L0b-doppelt');
  check('C15 TSH-Widerspruch, Vitamin D nur einmal: Hinweis ohne eigene Frist', !!k1 && k1.stufe === 'keine' && !enthaelt(k1.text, 'dringender'), JSON.stringify(k1));
  check('C15 TSH-Widerspruch: Gesamtbild trotzdem tage (Vitamin D)', ez.gesamtbild(nurTsh, HEUTE).stufe === 'tage', `ist ${ez.gesamtbild(nurTsh, HEUTE).stufe}`);
  // Zwei Vitamin-D-Werte: Das Gesamtbild nimmt den späteren (40) – nach dem anderen (120) wäre es tage.
  const vitd = baue({ ohneBefund: true, vor: [{ id: 'a', datum: BEFUND_TAG, tsh: t(2), ...ww('vitd', 120, 'ng/ml', 30, 100) }, { id: 'b', datum: BEFUND_TAG, tsh: t(2), ...ww('vitd', 40, 'ng/ml', 30, 100) }] });
  const k2 = ez.kontrolleHinweise(vitd, HEUTE).find((x) => x.id === 'L0b-doppelt');
  check('C15 Vitamin-D-Widerspruch: Hinweis tage, nennt Vitamin D', !!k2 && k2.stufe === 'tage' && enthaelt(k2.text, 'Vitamin D'), JSON.stringify(k2));
});
fall('C15 ein Befund je Tag: kein Hinweis', () => {
  const s = baue({ tsh: t(7), ft4: f4(5) });
  check('C15 einzeln: kein L0b-doppelt', !ez.kontrolleHinweise(s, HEUTE).some((x) => x.id === 'L0b-doppelt'));
});

// ---- C16: Biotin und „Tablette vorher" aus der Zwischenfassung (Haken, false) sind offen, nicht „nein".
fall('C16 Befundfragen als Haken: false → offen, true → ja; andere Fragen unverändert', () => {
  const s = baue({ ohneBefund: true, vor: [
    { id: 'a', datum: '2026-05-30', tsh: t(0.04, 0.27, 4.2), biotin: false, vorAbnahme: false, krank: false },
    { id: 'b', datum: BEFUND_TAG, tsh: t(2), biotin: true, vorAbnahme: true },
  ] });
  const a = s.labor.find((l) => l.id === 'a');
  const b = s.labor.find((l) => l.id === 'b');
  check('C16: Biotin false → offen', a.biotin === '', `ist ${a.biotin}`);
  check('C16: Tablette vorher false → offen', a.vorAbnahme === '', `ist ${a.vorAbnahme}`);
  check('C16: true → ja', b.biotin === 'ja' && b.vorAbnahme === 'ja', `${b.biotin} / ${b.vorAbnahme}`);
  check('C16: andere Fragen wie bisher (false → nein)', a.krank === 'nein', `ist ${a.krank}`);
  const z = ez.berichtZeilen(s, HEUTE).join(' | ');
  check('C16: Bericht ohne „Biotin: nein"', !enthaelt(z, 'Biotin: nein'), auszug(z.split(' | ').filter((x) => enthaelt(x, 'Biotin'))));
});

// ---- C21: Eine schon gespeicherte Mittelliste ist kein Ersteintrag.
fall('C21 Mittel aus der Zwischenfassung ohne mittelErfasst → gilt als erfasst', () => {
  const s = normStand({ version: 2, profil: { ...BASIS_PROFIL }, mittel: ['kalzium', 'oestrogen'] });
  check('C21: mittelErfasst true', s.profil.mittelErfasst === true, `ist ${s.profil.mittelErfasst}`);
  check('C21: ohne Mittel bleibt es false', normStand({ version: 2, profil: { ...BASIS_PROFIL } }).profil.mittelErfasst === false);
});

// ---- C22: Die alte Beschwerde „trockene Haut, Haarausfall" bleibt, was sie war.
fall('C22 alter Schlüssel „haut" → eigener Text, kein Punkt für „zu wenig"', () => {
  const s = baue({ ohneBefund: true, befinden: [bf(HEUTE, 'haut', 'frieren', 'verstopfung')] });
  check('C22: Schlüssel bleibt „haut"', JSON.stringify(s.befinden[0].beschwerden) === '["haut","frieren","verstopfung"]', JSON.stringify(s.befinden[0].beschwerden));
  const r = ez.beschwerdenAuswerten(s, HEUTE);
  check('C22: 2 Punkte zu wenig, keine Richtung', nahe(r.punkteWenig, 2) && r.richtung === null, `${r.punkteWenig} / ${r.richtung}`);
  const z = ez.berichtZeilen(s, HEUTE).find((x) => x.startsWith('Beschwerden')) || '';
  check('C22: Bericht nennt „trockene Haut oder Haarausfall"', enthaelt(z, 'trockene Haut oder Haarausfall'), z);
});

// ---- C19–C21 im laufenden Speicher: je eine eigene Instanz von speicher.js
// (eigene Adresse ⇒ eigener Modulzustand) über einem nachgebauten localStorage.
function speicherAttrappe(inhalt = {}) {
  const daten = new Map(Object.entries(inhalt));
  return {
    daten,
    fehler: null, // Name des Fehlers, den setItem wirft – oder null
    get length() { return daten.size; },
    key(i) { return [...daten.keys()][i] ?? null; },
    getItem(k) { return daten.has(k) ? daten.get(k) : null; },
    setItem(k, v) {
      if (this.fehler) throw Object.assign(new Error(this.fehler), { name: this.fehler });
      daten.set(k, String(v));
    },
    removeItem(k) { daten.delete(k); },
  };
}
let instanzen = 0;
const instanz = () => import(`../schilddruese/js/speicher.js?runde2-${++instanzen}`);
const SCHLUESSEL_SD = 'schilddruese.stand.v1';
const MIT_DATEN = () => JSON.stringify({ version: 2, profil: { ...BASIS_PROFIL, name: 'Mama' }, dosen: [D1], labor: [{ id: 'l1', datum: BEFUND_TAG, tsh: t(2) }] });
const hatteLocalStorage = Object.prototype.hasOwnProperty.call(globalThis, 'localStorage');
const vorherLocalStorage = globalThis.localStorage;

// ---- C19: „Alles löschen" in einer Instanz – die zweite schreibt es nicht zurück.
try {
  globalThis.localStorage = speicherAttrappe({ [SCHLUESSEL_SD]: MIT_DATEN() });
  const A = await instanz();
  const Bi = await instanz();
  fall('C19 „Alles löschen" in A, dann ein Tipp in B → bleibt gelöscht', () => {
    check('C19: B hat die Daten', Bi.getStand().labor.length === 1 && Bi.getStand().profil.name === 'Mama');
    A.allesLoeschen();
    check('C19: der Schlüssel selbst ist weg (wie bisher)', globalThis.localStorage.getItem(SCHLUESSEL_SD) === null);
    check('C19: B übernimmt das Löschen', Bi.neuLesen() === true && Bi.getStand().labor.length === 0 && Bi.getStand().profil.name === '',
      JSON.stringify({ labor: Bi.getStand().labor.length, name: Bi.getStand().profil.name }));
    Bi.einnahmeSetzen(HEUTE, { uhr: '07:00' });
    Bi.sofortSchreiben();
    const roh = JSON.parse(globalThis.localStorage.getItem(SCHLUESSEL_SD) || '{}');
    check('C19: im Speicher keine alten Daten', (roh.labor || []).length === 0 && (roh.profil || {}).name === '' && (roh.dosen || []).length === 0,
      JSON.stringify({ labor: (roh.labor || []).length, name: (roh.profil || {}).name }));
  });
  // Wo nie geschrieben werden konnte, fehlt der Schlüssel immer – das ist
  // kein Löschen (sonst leerte jeder Wechsel zurück in die App den einzigen Stand).
  globalThis.localStorage = speicherAttrappe();
  globalThis.localStorage.fehler = 'SecurityError';
  const C = await instanz();
  fall('C19 Speicher gesperrt: neuLesen leert den Stand im Arbeitsspeicher nicht', () => {
    C.einnahmeSetzen(HEUTE, { uhr: '07:00' });
    C.sofortSchreiben();
    check('C19 gesperrt: neuLesen ändert nichts', C.neuLesen() === false && !!C.einnahme(HEUTE), JSON.stringify(C.einnahme(HEUTE)));
  });
} catch (e) {
  check('C19 (läuft ohne Absturz)', false, e && e.message);
}

// ---- C20: Speicher schon beim Start voll → „voll", nicht „privates Fenster?"; ein neuer Grund wird gemeldet.
try {
  globalThis.localStorage = speicherAttrappe({ [SCHLUESSEL_SD]: MIT_DATEN() });
  globalThis.localStorage.fehler = 'QuotaExceededError';
  const V = await instanz();
  fall('C20 Speicher beim Start voll', () => {
    check('C20: Daten geladen', V.getStand().labor.length === 1);
    check('C20: Grund „voll"', V.speicherGrund() === 'voll', `ist ${V.speicherGrund()}`);
  });
  // Altes Safari im privaten Fenster: derselbe Fehler, aber nichts im Speicher.
  globalThis.localStorage = speicherAttrappe();
  globalThis.localStorage.fehler = 'QuotaExceededError';
  const P = await instanz();
  fall('C20 privates Fenster (Grenze 0) bleibt „gesperrt"', () => {
    check('C20 privat: Grund „gesperrt"', P.speicherGrund() === 'gesperrt', `ist ${P.speicherGrund()}`);
  });
  globalThis.localStorage = speicherAttrappe({ [SCHLUESSEL_SD]: MIT_DATEN() });
  const W = await instanz();
  fall('C20 wechselt der Grund, erfährt es die Ansicht', () => {
    const gemeldet = [];
    W.abonnieren(() => gemeldet.push(W.speicherGrund()));
    globalThis.localStorage.fehler = 'SecurityError';
    W.einnahmeSetzen(HEUTE, { uhr: '07:00' });
    W.sofortSchreiben();
    globalThis.localStorage.fehler = 'QuotaExceededError';
    W.einnahmeSetzen(HEUTE, { uhr: '07:05' });
    gemeldet.length = 0;
    W.sofortSchreiben();
    check('C20: nach dem zweiten Fehler Grund „voll"', W.speicherGrund() === 'voll', `ist ${W.speicherGrund()}`);
    check('C20: der neue Grund wurde gemeldet', gemeldet.includes('voll'), JSON.stringify(gemeldet));
  });
} catch (e) {
  check('C20 (läuft ohne Absturz)', false, e && e.message);
}

// ---- C21 im laufenden Speicher: das beim ersten Speichern neu angekreuzte Mittel zählt als begonnen (L7b).
try {
  globalThis.localStorage = speicherAttrappe({ [SCHLUESSEL_SD]: JSON.stringify({ version: 2, profil: { ...BASIS_PROFIL }, dosen: [D1], mittel: ['kalzium', 'oestrogen'], labor: [{ id: 'l1', datum: '2026-06-01', tsh: t(2) }] }) });
  const M = await instanz();
  fall('C21 Magenschutz beim ersten Speichern nach dem Update neu → L7b nach 6 Wochen', () => {
    M.mittelSetzen(['kalzium', 'oestrogen_tablette', 'ppi'], {}, '2026-08-01');
    const w = M.getStand().mittelWechsel;
    check('C21: Beginn Magenschutz vermerkt', w.some((x) => x.key === 'ppi' && x.art === 'beginn'), JSON.stringify(w));
    check('C21: L7b am 15.09.', ez.kontrolleHinweise(M.getStand(), '2026-09-15').some((h) => h.id === 'L7b'), JSON.stringify(ids(ez.kontrolleHinweise(M.getStand(), '2026-09-15'))));
  });
} catch (e) {
  check('C21 im Speicher (läuft ohne Absturz)', false, e && e.message);
}
if (hatteLocalStorage) globalThis.localStorage = vorherLocalStorage;
else delete globalThis.localStorage;

// ================================================================ Runde 3 (D1–D16, Kern-Teile)
//
// Befunde der dritten Review-Runde, soweit sie den Kern und den Speicher
// betreffen. Jeder Fall hier scheiterte vor der Korrektur.

// ---- D1: Vitamin D über 100 – kein pauschales Absetzen „Ihres Vitamin-D-Präparats"
// (nach einer Schilddrüsen-OP oft Calcitriol oder Kalzium gegen die Unterfunktion
// der Nebenschilddrüsen). Stufe tage bleibt (E13e).
['op', 'hashimoto'].forEach((ursache) => fall(`D1 Vitamin D 110 ng/ml (30–100), Ursache ${ursache}`, () => {
  const s = baue({ profil: { ursache }, tsh: t(1.5), befund: ww('vitd', 110, 'ng/ml', 30, 100), mittel: ['kalzium'] });
  const e = ez.weitereWerte(s.labor.find((x) => x.id === 'ziel'), s).find((x) => x.key === 'vitd');
  const n = `D1 (${ursache})`;
  check(`${n}: Stufe tage`, !!e && e.stufe === 'tage', `ist ${e && e.stufe}`);
  ['sehr hoch', 'nicht ohne Rücksprache ab', 'Calcitriol', 'Colecalciferol', 'in den nächsten Tagen die Praxis an'].forEach((x) => check(`${n}: Text „${x}"`, !!e && enthaelt(e.texte, x), e && e.texte.join(' | ')));
  check(`${n}: kein „Ihr Vitamin-D-Präparat … nicht weiter"`, !!e && !enthaelt(e.texte, 'Vitamin-D-Präparat'), e && e.texte.join(' | '));
  // Keine niedrigere Stufe als W1 für Verwirrtheit (112) – der Satz nennt sie gar nicht.
  check(`${n}: nennt keine Verwirrtheit mit „heute"`, !!e && !enthaelt(e.texte, 'Verwirrtheit'), e && e.texte.join(' | '));
  check(`${n}: Gesamtbild tage`, ez.gesamtbild(s, HEUTE).stufe === 'tage', `ist ${ez.gesamtbild(s, HEUTE).stufe}`);
}));

// ---- D3: S4 trägt die Stufe heute – der Text nennt keine mildere Frist daneben.
pruefeBeschwerden({
  name: 'D3 S4 Puls unregelmäßig → „heute noch", ohne „in den nächsten Tagen"', befinden: [bf(HEUTE, 'puls')],
  stufe: 'heute', regeln: ['S4'], texte: ['heute noch in der Praxis an', '116 117', 'sofort 112'], verboten: ['in den nächsten Tagen', 'heute oder'],
});

// Dieselbe Mischung stand in S4ii (Herzklopfen an einem Tag + niedriges TSH):
// Mit 78 Jahren Stufe heute, der Satz begann aber mit „in den nächsten Tagen".
pruefeBeschwerden({
  name: 'D3 S4ii 78 J., Herzklopfen an einem Tag + TSH 0,05 → nur „heute noch"', profil: { geburtsjahr: J[78] }, befund: { tsh: t(0.05), ft4: f4(24) },
  befinden: [bf(HEUTE, 'herz')], stufe: 'heute', regeln: ['S4ii'], texte: ['heute noch in der Praxis an', '116 117', 'sofort 112'], verboten: ['in den nächsten Tagen'],
});
pruefeBeschwerden({
  name: 'D3 S4ii 56 J. ohne Herz → tage, Satz wie bisher', befund: { tsh: t(0.05), ft4: f4(24) },
  befinden: [bf(HEUTE, 'herz')], stufe: 'tage', regeln: ['S4ii'], texte: ['in den nächsten Tagen', 'noch heute'],
});

// ---- D5 (Kern-Teil): abends frühestens 3 Stunden nach der letzten Mahlzeit (RW2 E15, ATA 2014).
['17:00', '21:30', '22:00'].forEach((uhrzeit) => fall(`D5 Plan bei Einnahme ${uhrzeit}: keine „2 Stunden"`, () => {
  const p = plan(`D5 ${uhrzeit}`, { uhr: uhrzeit, mittel: ['kalzium', 'eisen', 'kaffee'] });
  const m3 = eintrag(p, 'fruehstueck');
  check(`D5 ${uhrzeit}: M3 nennt 3 Stunden`, !!m3 && enthaelt(m3.text, '3 Stunden') && enthaelt(m3.text, 'letzten Mahlzeit'), m3 && m3.text);
  const zwei = texteVon(p).filter((x) => /\b2\s*(?:[–-]\s*3\s*|bis\s+3\s+)?Stunden/.test(x));
  check(`D5 ${uhrzeit}: keine „2" vor „Stunden" im Plan`, zwei.length === 0, zwei.join(' | '));
}));

// ---- D6: Behandlungsgrund Hirnanhangdrüse – fT4 im Bereich heißt nur in der
// oberen Hälfte „passt" (ETA 2018, Endocrine Society 2016).
const WENIG4 = [bf(HEUTE, 'muede', 'frieren', 'verstopfung', 'trockenhaut')];
pruefeFall({
  name: 'D6 Hypophyse: TSH 0,3 + fT4 12,5 (12–22), 78 J. → termin, untere Hälfte', profil: { ...HYPO, geburtsjahr: J[78] }, tsh: t(0.3), ft4: f4(12.5),
  stufe: 'termin', texte: ['entscheidend ist fT4', 'unteren Hälfte', 'welcher Bereich für Sie gilt', 'nächsten Termin'], verboten: ['derzeit passt', 'Unterversorgung', 'Hirnanhangdrüse'],
  pruef: (E) => [['Richtung unklar (nicht „passend")', E.richtung === 'unklar', `ist ${E.richtung}`],
    ['Kopf nicht „Kein besonderer Anlass"', !!E.kopf && E.kopf.stufe === 'termin', JSON.stringify(E.kopf)],
    ['Satz gegen Selbsthandlung', !!E.gegenSelbst, `ist ${E.gegenSelbst}`]],
});
pruefeFall({
  name: 'D6 Hypophyse: TSH 0,3 + fT4 20 (12–22) → keine, obere Hälfte passt', profil: HYPO, tsh: t(0.3), ft4: f4(20),
  stufe: 'keine', texte: ['oberen Hälfte', 'derzeit passt'], pruef: (E) => [['Richtung passend', E.richtung === 'passend', `ist ${E.richtung}`]],
});
pruefeFall({ name: 'D6 Hypophyse: fT4 genau in der Mitte (17 bei 12–22) → passt', profil: HYPO, tsh: t(0.3), ft4: f4(17), stufe: 'keine', texte: ['derzeit passt'] });
pruefeFall({
  name: 'D6 Hypophyse: fT4 12,5 ohne Laborbereich → termin, ohne „passt"', profil: HYPO, tsh: t(0.3), ft4: f4O(12.5),
  stufe: 'termin', texte: ['welcher Teil des Bereichs', 'beiden Grenzen'], verboten: ['derzeit passt'],
  pruef: (E) => [['Richtung unklar', E.richtung === 'unklar', `ist ${E.richtung}`]],
});
pruefeFall({
  name: 'D6 Hypophyse: fT4 „< 20" (12–22) → nicht sicher obere Hälfte', profil: HYPO, tsh: t(0.3), ft4: { ...f4(20), unter: true },
  stufe: 'termin', verboten: ['derzeit passt'],
});
pruefeFall({
  name: 'D6 Hypophyse ohne TSH, fT4 12,5 (12–22) → termin', profil: HYPO, tsh: null, ft4: f4(12.5), muster: null,
  stufe: 'termin', texte: ['unteren Hälfte'], verboten: ['derzeit passt'], pruef: (E) => [['Richtung unklar', E.richtung === 'unklar', `ist ${E.richtung}`]],
});
// TSH über 10 hebt auf tage (feste Schwelle) – dann weder „passt" noch „beim nächsten Termin" (L3f).
[['D6 Hypophyse: TSH 15 + fT4 19 → tage ohne „passt"', 19], ['D6 Hypophyse: TSH 15 + fT4 13 → tage ohne „nächsten Termin"', 13]]
  .forEach(([name, wert]) => pruefeFall({ name, profil: HYPO, tsh: t(15), ft4: f4(wert), stufe: 'tage', texte: ['deutlich erhöht'], verboten: ['derzeit passt', 'nächsten Termin'] }));
pruefeBeschwerden({
  name: 'D6 Hypophyse fT4 12,5 + Beschwerden „zu wenig" → kein S3 „Ursache oft woanders"', profil: { ...HYPO, geburtsjahr: J[78] },
  befund: { tsh: t(0.3), ft4: f4(12.5) }, befinden: WENIG4, richtung: 'wenig', verboten: ['oft woanders', 'lagen zuletzt im Bereich'],
});
pruefeBeschwerden({
  name: 'D6 Hypophyse fT4 20 + Beschwerden „zu wenig" → S3 wie bisher', profil: { ...HYPO, geburtsjahr: J[78] },
  befund: { tsh: t(0.3), ft4: f4(20) }, befinden: WENIG4, regeln: ['S3'], texte: ['oft woanders'],
});
fall('D6 Hypophyse fT4 12,5: Gesamtbild nicht „Kein besonderer Anlass"', () => {
  const s = baue({ profil: { ...HYPO, geburtsjahr: J[78] }, tsh: t(0.3), ft4: f4(12.5), befinden: WENIG4 });
  const g = ez.gesamtbild(s, HEUTE);
  check('D6 Gesamtbild mindestens termin', rang(g.stufe) >= rang('termin'), `ist ${g.stufe}; ${teilIds(g).join(', ')}`);
  check('D6 Teil befund termin', g.teile.some((x) => x.id === 'befund' && x.stufe === 'termin'), teilIds(g).join(', '));
});

// ---- D8: L5a nur für Mittel, die TSH, fT4, Aufnahme oder Bedarf verändern (RW1 L5a/L5e).
const D8_FALL = (key) => ({
  profil: { geburtsjahr: J[78], herz: 'ja' }, tsh: t(0.05), ft4: f4(24), befund: { mittelGeaendert: 'nein' },
  mittel: [key], mittelWechsel: [{ id: 'mw1', key, art: 'beginn', am: '2026-09-01' }],
});
['marcumar', 'selen', 'oestrogen_haut', 'digitalis', 'bisphosphonat', 'diabetes'].forEach((key) => pruefeFall({
  name: `D8 ${key} begonnen 19 Tage vor der Abnahme → kein L5a`, ...D8_FALL(key), muster: 'd', stufe: 'tage', ohneRegeln: ['L5a'], verboten: ['eingependelt'],
}));
['ppi', 'kalzium', 'oestrogen_tablette', 'amiodaron', 'jod', 'metformin'].forEach((key) => pruefeFall({
  name: `D8 ${key} begonnen 19 Tage vor der Abnahme → L5a`, ...D8_FALL(key), muster: 'd', regeln: ['L5a'],
}));
pruefeFall({ name: 'D8 Magenschutz abgesetzt 19 Tage vorher → L5a', ...D8_FALL('ppi'), mittel: [], mittelWechsel: [{ id: 'mw1', key: 'ppi', art: 'ende', am: '2026-09-01' }], regeln: ['L5a'] });
pruefeFall({ name: 'D8 Befundfrage „Mittel geändert: ja" → L5a auch ohne Liste', ...D8_FALL('marcumar'), befund: { mittelGeaendert: 'ja' }, regeln: ['L5a'] });
fall('D8 Arztbericht: kein „eingependelt" unter „Mittel geändert: nein" (Marcumar)', () => {
  const z = ez.berichtZeilen(baue(D8_FALL('marcumar')), HEUTE);
  check('D8 Bericht ohne L5a-Satz', !z.some((x) => enthaelt(x, 'eingependelt')), z.filter((x) => enthaelt(x, 'eingependelt')).join(' | '));
});

// ---- D16 (Kern-Teil): Termin mit Blutabnahme heute – solange sie bevorsteht.
fall('D16 abnahmeHeute', () => {
  const T = (datum, uhr, art = 'labor', blutabnahme = false) => ({ id: `t${datum}${uhr}`, datum, uhr, art, wo: '', blutabnahme, notiz: '' });
  const mit = (termine) => baue({ ohneBefund: true, termine });
  const s = mit([T(HEUTE, '09:30')]);
  check('D16 Funktion vorhanden', typeof ez.abnahmeHeute === 'function');
  check('D16 07:10 vor der Abnahme um 9:30 → Termin', !!ez.abnahmeHeute(s, HEUTE, '07:10') && ez.abnahmeHeute(s, HEUTE, '07:10').uhr === '09:30');
  check('D16 10:00 nach der Abnahme → null', ez.abnahmeHeute(s, HEUTE, '10:00') === null);
  check('D16 ohne Uhrzeit-Angabe → Termin', !!ez.abnahmeHeute(s, HEUTE));
  check('D16 Abnahme ohne Uhrzeit gilt den ganzen Tag', !!ez.abnahmeHeute(mit([T(HEUTE, '')]), HEUTE, '18:00'));
  check('D16 Arzttermin mit Haken „Blut" zählt', !!ez.abnahmeHeute(mit([T(HEUTE, '11:00', 'arzt', true)]), HEUTE, '07:00'));
  check('D16 Arzttermin ohne Blutabnahme zählt nicht', ez.abnahmeHeute(mit([T(HEUTE, '11:00', 'arzt')]), HEUTE, '07:00') === null);
  check('D16 Abnahme morgen zählt heute nicht', ez.abnahmeHeute(mit([T(plus(HEUTE, 1), '09:30')]), HEUTE, '07:00') === null);
  const zwei = mit([T(HEUTE, '08:00'), T(HEUTE, '11:00')]);
  check('D16 zwei Abnahmen: bis zur späteren', !!ez.abnahmeHeute(zwei, HEUTE, '09:00') && ez.abnahmeHeute(zwei, HEUTE, '09:00').uhr === '11:00');
});

// ---- D13: Vorrat – der Verbrauch zählt Tag für Tag mit der Dosis, die an dem Tag galt.
try {
  const VORRAT_AB = '2026-01-12';
  const WECHSEL = plus(VORRAT_AB, 40); // 21.02.2026: 1½ → 1 Tablette am Tag
  globalThis.localStorage = speicherAttrappe({
    [SCHLUESSEL_SD]: JSON.stringify({
      version: 2, profil: { ...BASIS_PROFIL },
      dosen: [{ id: 'd1', ab: '2025-06-01', praeparat: 'L-Thyroxin', mikrogramm: 50, tabletten: 1.5 }, { id: 'd2', ab: WECHSEL, praeparat: 'L-Thyroxin', mikrogramm: 50, tabletten: 1, praxis: true }],
      vorrat: { tabletten: 100, stand: VORRAT_AB },
    }),
  });
  const S = await instanz();
  fall('D13 1½ → 1 Tablette ab Tag 40: Vorrat ehrlich gezählt', () => {
    // Tatsächlich übrig an Tag n ≥ 40: 100 − 40 × 1,5 − (n − 40) = 80 − n.
    // Die Reichweite ab heute rechnet die schon eingetragene spätere Dosis mit:
    // an Tag 0 noch 40 Tage zu 1½ und dann 40 zu 1 – zusammen 80.
    [[0, 80], [30, 50], [40, 40], [66, 14], [79, 1], [80, 0]].forEach(([n, soll]) => {
      const r = S.vorratReicht(plus(VORRAT_AB, n));
      check(`D13 Tag ${n}: reicht ${soll}`, r === soll, `ist ${r}`);
    });
    const leer = S.vorratReicht(plus(VORRAT_AB, 86));
    check('D13 Tag 86 (seit 6 Tagen leer): aufgebraucht, nicht „14 Tage"', leer !== null && leer <= 0, `ist ${leer}`);
  });
  globalThis.localStorage = speicherAttrappe({
    [SCHLUESSEL_SD]: JSON.stringify({ version: 2, profil: { ...BASIS_PROFIL }, dosen: [D1], vorrat: { tabletten: 30, stand: HEUTE } }),
  });
  const E = await instanz();
  fall('D13 gleichbleibende Dosis wie bisher', () => {
    check('D13 am Zähltag: 30', E.vorratReicht(HEUTE) === 30, `ist ${E.vorratReicht(HEUTE)}`);
    check('D13 nach 29 Tagen: 1', E.vorratReicht(plus(HEUTE, 29)) === 1, `ist ${E.vorratReicht(plus(HEUTE, 29))}`);
    check('D13 nach 30 Tagen: 0', E.vorratReicht(plus(HEUTE, 30)) === 0, `ist ${E.vorratReicht(plus(HEUTE, 30))}`);
  });
  globalThis.localStorage = speicherAttrappe({ [SCHLUESSEL_SD]: JSON.stringify({ version: 2, profil: { ...BASIS_PROFIL }, dosen: [D1] }) });
  const O = await instanz();
  fall('D13 ohne Vorrat: null', () => check('D13 null', O.vorratReicht(HEUTE) === null, `ist ${O.vorratReicht(HEUTE)}`));
} catch (e) {
  check('D13 im Speicher (läuft ohne Absturz)', false, e && e.message);
}
if (hatteLocalStorage) globalThis.localStorage = vorherLocalStorage;
else delete globalThis.localStorage;

// ================================================================ Globale Eigenschaften über alle Fälle

// MEHRDEUTIG: Grundsatz 1/11 verbietet „Tablette(n) mehr/weniger". Nicht als Aufforderung gelten
// Verneinungen („nie mehr Tabletten", E7) und „keine Tabletten mehr im Haus" (W2h 5).
const MIKROGRAMM = /\d\s*(µg|μg|mcg|mikrogramm)/i;
const TABLETTEN_MEHR = /(?<!\b(?:nie|nicht|keine)\s)\b(?:mehr|weniger)\s+(?:schilddrüsen-?)?tabletten?\b|\btabletten?\s+(?:mehr|weniger)\b(?!\s+im\s+haus)/i;
const KERN_QUELLEN = ['befundEinschaetzen', 'beschwerdenAuswerten', 'warnzeichenAuswerten', 'abstandPlan', 'kontrolleHinweise', 'fragenVorschlaege'];
fall('Global: keine Dosis in µg, kein „mehr/weniger Tabletten" (Grundsatz 1, Entscheidung 9)', () => {
  const kern = TEXTE.filter((x) => KERN_QUELLEN.includes(x.quelle));
  check(`Global: Texte gesammelt (${kern.length})`, kern.length > 100, `nur ${kern.length}`);
  const mg = kern.filter((x) => MIKROGRAMM.test(x.text));
  check('Global: kein Text mit Zahl und µg', mg.length === 0, mg.slice(0, 4).map((x) => `[${x.quelle}: ${x.name}] ${x.text}`).join(' || '));
  const tb = kern.filter((x) => TABLETTEN_MEHR.test(x.text));
  check('Global: kein Text „mehr/weniger Tabletten"', tb.length === 0, tb.slice(0, 4).map((x) => `[${x.quelle}: ${x.name}] ${x.text}`).join(' || '));
  const html = TEXTE.filter((x) => /<[a-z/][^>]*>/i.test(x.text));
  check('Global: keine HTML-Auszeichnung in Texten', html.length === 0, html.slice(0, 3).map((x) => x.text).join(' || '));
});
fall('Global: Befund-Einschätzungen', () => {
  const mitMuster = ALLE_E.filter((x) => x.E && x.E.muster);
  check(`Global: Einschätzungen mit Muster (${mitMuster.length})`, mitMuster.length > 150, `nur ${mitMuster.length}`);
  const ohneSatz = mitMuster.filter((x) => x.E.muster !== 'a' && !(typeof x.E.gegenSelbst === 'string' && enthaelt(x.E.gegenSelbst, 'wie verordnet')));
  check('Global Grundsatz 2: jedes Muster ≠ a hat den Satz gegen Selbsthandlung', ohneSatz.length === 0, ohneSatz.slice(0, 6).map((x) => `${x.name} (${x.E.muster})`).join(' | '));
  const tabu = mitMuster.filter((x) => ['Hirnanhangdrüse', 'Tumor', 'Resistenz'].some((w) => enthaelt([x.E.text, ...textListe(x.E.zusaetze), ...textListe(x.E.erklaerungen)], w)));
  check('Global Grundsatz 6 / Entscheidung 11: kein „Hirnanhangdrüse", „Tumor", „Resistenz"', tabu.length === 0, tabu.slice(0, 6).map((x) => x.name).join(' | '));
  const termin = mitMuster.filter((x) => rang(x.E.stufe) > rang('termin') && enthaelt(x.E.text, 'nächsten Termin'));
  check('Global Entscheidung 10: über Termin kein „beim nächsten Termin" im Mustertext', termin.length === 0, termin.slice(0, 6).map((x) => `${x.name} (${x.E.stufe})`).join(' | '));
  const zeitnah = mitMuster.filter((x) => rang(x.E.stufe) >= rang('tage') && (enthaelt(x.E.text, 'zeitnah') || enthaelt(x.E.text, '1-2 Wochen')));
  check('Global L3f: ab Stufe tage kein „zeitnah"/„1–2 Wochen" im Mustertext', zeitnah.length === 0, zeitnah.slice(0, 6).map((x) => `${x.name} (${x.E.stufe})`).join(' | '));
  const notruf = ALLE_E.filter((x) => x.nurLabor && x.E && x.E.stufe === 'notruf');
  check('Global Grundsatz 5: ein Laborwert allein nie notruf', notruf.length === 0, notruf.slice(0, 6).map((x) => x.name).join(' | '));
  const bRichtig = mitMuster.filter((x) => x.E.muster === 'b' && x.E.stufe !== 'tage' && !x.E.praxisErklaert);
  check('Global Entscheidung 8: Muster b immer tage', bRichtig.length === 0, bRichtig.slice(0, 6).map((x) => `${x.name} (${x.E.stufe})`).join(' | '));
  const stufen = ALLE_E.filter((x) => x.E && rang(x.E.stufe) < 0);
  check('Global: jede Stufe ist eine bekannte Stufe', stufen.length === 0, stufen.slice(0, 6).map((x) => `${x.name} (${x.E.stufe})`).join(' | '));
  const ohneText = mitMuster.filter((x) => !(typeof x.E.text === 'string' && x.E.text.trim()));
  check('Global: jedes Muster hat einen Text', ohneText.length === 0, ohneText.slice(0, 6).map((x) => x.name).join(' | '));
  const ohneNotfall = mitMuster.filter((x) => !(x.E.notfall && [1, 2, 3].includes(x.E.notfall.satz) && x.E.notfall.text));
  check('Global L3e: jede Einschätzung mit Muster hat einen Notfall-Satz 1, 2 oder 3', ohneNotfall.length === 0, ohneNotfall.slice(0, 6).map((x) => x.name).join(' | '));
  const orient = mitMuster.filter((x) => (x.E.werte || []).some((w) => w.einordnung && w.einordnung.quelle === 'orientierung')
    && !enthaelt(texteVon(x.E), 'nicht der Bereich Ihres Labors'));
  check('Global Grundsatz 6: bei Orientierung immer „nicht der Bereich Ihres Labors"', orient.length === 0, orient.slice(0, 6).map((x) => x.name).join(' | '));
});

// ---------------------------------------------------------------- Ende

console.log(`\n${faelle} Fälle, ${oks + fails} Prüfungen: ${oks} OK, ${fails} FAIL`);
process.exit(fails || !oks ? 1 : 0);
