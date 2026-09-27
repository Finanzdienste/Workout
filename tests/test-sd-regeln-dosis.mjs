/*
 * Schilddrüse: die Dosisrichtung gegen den Regeltext.
 *
 * Unabhängig von der Umsetzung geschrieben: Jede Erwartung hier steht so im
 * Regelwerk 2 (Dosisrichtung) mit den Fixes X1–X15 des roten Teams und den
 * Entscheidungen der Umsetzungsvorgabe – nicht so, wie js/dosis.js es gerade
 * rechnet. Wo der Regeltext zwei Lesarten zulässt, prüft der Test die
 * sicherere und sagt es mit „MEHRDEUTIG:". Wo er eine Kennung der Umsetzung
 * annehmen muss, steht „ANNAHME:" – dann ist nur diese Stelle anzupassen.
 *
 * Tabellengetrieben: FAELLE (dosisRichtung) und HINWEIS_FAELLE
 * (dosisHinweise) sind Listen aus Stand und Erwartung. Darunter prüfen
 * globale Eigenschaften alle Ergebnisse zusammen: nie eine neue Tagesdosis,
 * nie eine Richtung ohne Pflichttext, bei „klaeren" nie „spricht für …".
 *
 * Läuft mit plain node, ohne Browser:
 *
 *     node tests/test-sd-regeln-dosis.mjs
 *
 * Ausgabe „OK …"/„FAIL …" wie die übrigen Tests, Exit-Code 1 bei Fehlern.
 */
// Als Namensraum: Fehlt ein Export (etwa gesamtbildMitDosis), scheitern nur
// die Prüfungen, die ihn brauchen – nicht die ganze Datei beim Laden.
import * as dosisModul from '../schilddruese/js/dosis.js';
import { normStand } from '../schilddruese/js/speicher.js';
// Nur für die Schlüssel des Warnzeichen-Checks (Schnittstelle WARNFRAGEN der
// Umsetzungsvorgabe). Keine Erwartung stammt aus diesem Modul.
import * as ez from '../schilddruese/js/einschaetzung.js';

const { dosisRichtung, dosisHinweise, gesamtbildMitDosis } = dosisModul;

// ================================================================ Prüfen

let oks = 0;
let fails = 0;

/** „OK name" bzw. „FAIL name – detail". */
function check(name, bedingung, detail = '') {
  if (bedingung) {
    oks++;
    console.log(`OK   ${name}`);
  } else {
    fails++;
    console.log(`FAIL ${name}${detail ? ` – ${detail}` : ''}`);
  }
}

const kurzFehler = (e) => (e && e.stack ? e.stack.split('\n').slice(0, 2).join(' ') : String(e));

// ================================================================ Datum

/** ISO-Tag + n Tage, mittags gerechnet – ohne Zeitzonen-Fallen. */
function plus(iso, n) {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** „17.09.2026" aus „2026-09-17". */
const kurz = (iso) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;
/** Ein Text als RegExp, Sonderzeichen entschärft. */
const re = (text) => new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

// ================================================================ Stufen

// Rangfolge (Umsetzung, Entscheidung 18): notruf 5 > heute 4 > tage 3 >
// zeitnah 2 > termin 1 > keine 0. „heute" ist eine Variante von „Tage".
const RANG = { keine: 0, termin: 1, zeitnah: 2, tage: 3, heute: 4, notruf: 5 };
const rang = (s) => (typeof s === 'string' && s in RANG ? RANG[s] : -1);
const RICHTUNGEN = ['mehr', 'weniger', 'gleich', 'klaeren'];

// ================================================================ Bausteine der Stände

const HEUTE = '2026-09-27';
const BEFUND = plus(HEUTE, -10);        // 2026-09-17
const DOSIS_AB = '2025-01-01';
/** DV: Alter = Jahr(befund.datum) − Geburtsjahr. Alle aktuellen Befunde der Fälle liegen in 2026. */
const geb = (alter) => 2026 - alter;

const tsh = (wert, mehr = {}) => ({ wert, einheit: 'mU/l', von: 0.4, bis: 4.0, ...mehr });
const ft4 = (wert, mehr = {}) => ({ wert, einheit: 'pmol/l', von: 12, bis: 22, ...mehr });
const dosis = (id, ab, mikrogramm, mehr = {}) => ({
  id, ab, praeparat: 'L-Thyroxin', mikrogramm, tabletten: 1, notiz: '', praxis: true, ...mehr,
});

/** TSH und fT4 eines Befunds (Zahl = Standardbereich), dazu weitere Felder. */
function bef(tshW, ft4W = 15, mehr = {}) {
  const t = tshW === null ? null : typeof tshW === 'object' ? tshW : tsh(tshW);
  const f = ft4W === null ? null : typeof ft4W === 'object' ? ft4W : ft4(ft4W);
  return { tsh: t, ft4: f, ...mehr };
}

// Alle Pflicht- und Kontrollfragen eines Befunds beantwortet (Entscheidung 6),
// so dass nur die Regel des jeweiligen Falls greift.
const BEFUNDFRAGEN = {
  abnahmeUhr: '08:00', vorAbnahme: 'nein', tabletteUhr: '', biotin: 'nein', krank: 'nein',
  kortison: 'nein', kontrastmittel: 'nein', mittelGeaendert: 'nein', einnahmeGeaendert: 'nein',
  packung: 'nein', vergessen: 'nein', einnahmeArt: 'ja', abstandOk: 'ja', verwechselt: 'nein',
  laborName: 'Labor Mitte', praxis: 'nochnicht', praxisAm: null, bestaetigt: false,
};

// Profil vollständig: 60 Jahre, kein Herz, keine Osteoporose, kein Krebs,
// kein Kortison, Hashimoto, Ziel nicht bewusst niedrig.
const PROFIL = {
  name: '', begruesst: true, behandelt: true, seit: DOSIS_AB,
  geburtsjahr: geb(60), ursache: 'hashimoto', krebs: 'nein', praeparatArt: 't4',
  herz: 'nein', osteoporose: 'nein', kortison: 'nein', diabetes: 'nein', schwanger: 'nein',
  zielNiedrig: 'nein', hypophyseOderNiedrig: 'nein', bundesland: 'BY',
};

let lfd = 0;
const neueId = (p) => `${p}${++lfd}`;
/** Ein Befinden-Eintrag `tag` Tage vor heute. */
const bf = (tag, beschwerden) => ({ id: neueId('f'), datum: plus(HEUTE, tag), stufe: 'mittel', beschwerden, notiz: '' });
/**
 * Ein Warnzeichen-Check `tag` Tage vor heute. ja = [] heißt „Nichts davon".
 * ANNAHME: Die Karte erkennt den erledigten Check an einem Eintrag in
 * stand.warnzeichen (Entscheidung 17) – nicht an einer eigenen Nachfrage.
 */
const wc = (tag, ja = []) => ({ id: neueId('w'), datum: plus(HEUTE, tag), uhr: '09:00', ja });

// Schlüssel für den Warnzeichen-Check: der erste der Gruppe w1 (112) und w2t
// (Stufe Tage) aus WARNFRAGEN; ohne sie ein Ersatz.
const WARNFRAGEN = Array.isArray(ez.WARNFRAGEN) ? ez.WARNFRAGEN : [];
const warnSchluessel = (gruppe, ersatz) => (WARNFRAGEN.find((f) => f && f.gruppe === gruppe && !f.nurWenn) || {}).key || ersatz;
const W_112 = warnSchluessel('w1', 'brust');
const W_TAGE = warnSchluessel('w2t', 'unruhe');

/**
 * Die Pflichtfrage aus X3 (1): „Nehmen Sie im Moment genau [x] µg am Tag?"
 * ANNAHME: gespeichert in stand.nachfragen als { art: 'dosis_stimmt',
 * bezug: <Befund-id>, antwort: 'ja' | 'nein', am }. Nutzt die Umsetzung eine
 * andere Kennung, ist nur diese Zeile anzupassen.
 */
const dosisStimmt = (bezug, am = HEUTE, antwort = 'ja') => ({ id: `n-${bezug}-${am}`, art: 'dosis_stimmt', bezug, antwort, am });
/** Die Rückfrage aus X3 (2) nach 14 Tagen: 'praxis' | 'selbst' | 'nein'. ANNAHME wie oben, art 'nach14'. */
const nachfrage14 = (bezug, am, antwort) => ({ id: `n14-${bezug}-${am}`, art: 'nach14', bezug, antwort, am });

/** Jeden Tag genommen, von `von` bis `bis`. */
function einnahmenVoll(von = plus(HEUTE, -200), bis = HEUTE) {
  const e = {};
  for (let t = von; t <= bis; t = plus(t, 1)) e[t] = { uhr: '07:00' };
  return e;
}
/** Jeden Tag genommen, außer an den Tagen `i` Tage vor dem Befund (bewusst nicht). */
function mitLuecken(tageVorBefund, befund = BEFUND) {
  const e = einnahmenVoll();
  tageVorBefund.forEach((i) => { e[plus(befund, -i)] = null; });
  return e;
}
/** Nur die `erfasst` Tage direkt vor dem Befund eingetragen, an `nicht` bewusst nicht genommen. */
function nurVorBefund(erfasst, nicht = [], befund = BEFUND) {
  const e = {};
  for (let i = 1; i <= erfasst; i++) e[plus(befund, -i)] = nicht.includes(i) ? null : { uhr: '07:00' };
  return e;
}

/** Ein früherer Befund, alle Fragen beantwortet. */
const vorbefund = (id, datum, tshWert, mehr = {}) => ({
  id, datum, tsh: tsh(tshWert), ft4: ft4(15), ft3: null, notiz: '', ...BEFUNDFRAGEN, ...mehr,
});

/**
 * Ein Stand, in dem alle Pflichtfragen beantwortet sind: Profil vollständig,
 * alle Befundfragen „nein" bzw. passend, Praxis „noch nicht", Einnahme 200
 * Tage lückenlos, die X3-Frage mit „ja" beantwortet (heute), 75 µg seit
 * 01.01.2025. Muster a (TSH 2, fT4 15) – überschreibbar:
 *
 *   profil, befund (wird über die Vorgabe gelegt), dosen, mittel, befinden,
 *   gewicht, warnzeichen, nachfragen, einnahmen, vorbefunde.
 */
function vollständigerStand(überschreibungen = {}) {
  const ue = überschreibungen;
  const befund = {
    id: 'b1', datum: BEFUND, tsh: tsh(2), ft4: ft4(15), ft3: null, notiz: '',
    ...BEFUNDFRAGEN, ...(ue.befund || {}),
  };
  return normStand({
    version: 2,
    profil: { ...PROFIL, ...(ue.profil || {}) },
    einstellungen: { erinnerung: '07:00', schrift: 'gross', farbe: 'hell', hinweisTablette: false },
    mittel: ue.mittel || [],
    mittelAbstand: ue.mittelAbstand || {},
    dosen: ue.dosen || [dosis('d1', DOSIS_AB, 75)],
    einnahmen: ue.einnahmen || einnahmenVoll(),
    labor: [...(ue.vorbefunde || []), befund],
    befinden: ue.befinden || [],
    gewicht: ue.gewicht || [],
    termine: [],
    fragen: [],
    warnzeichen: ue.warnzeichen || [],
    nachfragen: ue.nachfragen || [dosisStimmt(befund.id)],
  });
}

// ================================================================ Auswerten

const ids = (r) => [...(Array.isArray(r.regeln) ? r.regeln : []), ...(Array.isArray(r.gruende) ? r.gruende : []).map((g) => g && g.id)]
  .filter((x) => typeof x === 'string');

/** 'D0.5a' gehört zu 'D0.5', 'D1b' aber nicht zu 'D1' und 'D0.10' nicht zu 'D0.1'. */
function idPasst(ist, soll) {
  if (typeof ist !== 'string') return false;
  if (ist === soll) return true;
  if (!ist.startsWith(soll)) return false;
  const rest = ist.slice(soll.length);
  return /^[^A-Za-z0-9]/.test(rest) || (/\.\d+$/.test(soll) && /^[a-z]/.test(rest));
}
const hatRegel = (r, id) => ids(r).some((x) => idPasst(x, id));

const str = (x) => (typeof x === 'string' ? x : '');
const gruendeTexte = (r) => (Array.isArray(r.gruende) ? r.gruende : []).map((g) => str(g && g.text));
const frageTexte = (r) => (r.frage ? [str(r.frage.text), ...(Array.isArray(r.frage.optionen) ? r.frage.optionen : [])
  .map((o) => (Array.isArray(o) ? str(o[1]) : str(o)))] : []);
/** Titel, Texte, Schritt und Gründe – das, was die Karte als Einschätzung sagt. */
const kern = (r) => [str(r.titel), ...(Array.isArray(r.texte) ? r.texte.map(str) : []), str(r.schritt), ...gruendeTexte(r)]
  .filter(Boolean).join('\n');
/** Alles, was auf der Karte steht. */
const alles = (r) => [kern(r), str(r.pflicht), str(r.warnzeichen), str(r.grundlage), ...frageTexte(r)].filter(Boolean).join('\n');

function info(r) {
  if (!r) return `Ergebnis ${r}`;
  const f = r.frage ? `${r.frage.ziel || '?'}/${r.frage.feld || r.frage.id || '?'}` : '–';
  return `richtung=${r.richtung} stufe=${r.stufe} frage=${f} regeln=[${ids(r).join(',')}] titel=„${str(r.titel).slice(0, 80)}"`;
}

// DV/Grundsatz 4: keine neue Tagesdosis. Verboten sind die Summen aus der
// aktuellen Tagesdosis ± 12,5/25 µg – außer sie sind selbst ein eingetragener
// Wert (Stärke oder Tagesdosis eines Eintrags) oder die Schrittgröße.
const tagesdosis = (d) => (d && d.mikrogramm ? Math.round(d.mikrogramm * d.tabletten * 10) / 10 : null);
function aktuelleTagesdosis(stand, heute) {
  let g = null;
  for (const d of stand.dosen) if (d.ab <= heute) g = d;
  return tagesdosis(g || stand.dosen[0]);
}
function verboteneZahlen(stand, heute) {
  const d = aktuelleTagesdosis(stand, heute);
  if (d === null) return [];
  const erlaubt = new Set([12.5, 25]);
  stand.dosen.forEach((x) => { if (x.mikrogramm) { erlaubt.add(x.mikrogramm); erlaubt.add(tagesdosis(x)); } });
  return [d + 12.5, d + 25, d - 12.5, d - 25].filter((v) => v > 0 && !erlaubt.has(v));
}
/** 100 → „100 µg"; 87,5 → „87,5" auch ohne Einheit. */
function zahlMuster(v) {
  const t = String(v).replace('.', ',');
  return Number.isInteger(v)
    ? new RegExp(`(?<![\\d,.])${t}\\s*(µg|Mikrogramm)`)
    : new RegExp(`(?<![\\d,.])${t.replace(',', '[,.]')}(?!\\d)`);
}
function neueDosisGenannt(text, stand, heute) {
  const treffer = verboteneZahlen(stand, heute).filter((v) => zahlMuster(v).test(text)).map((v) => String(v).replace('.', ','));
  if (/\balso\s+(etwa\s+|rund\s+)?\d/.test(text)) treffer.push('„also …"');
  return treffer;
}

// ================================================================ Tabelle: dosisRichtung

const SCHRITT = {
  normal: (s) => /erhöhen/.test(s) && /12,5 bis 25 µg/.test(s),
  klein: (s) => /erhöhen/.test(s) && /12,5 µg/.test(s) && !/bis 25/.test(s),
  weniger: (s) => /verringern/.test(s) && /12,5 bis 25 µg/.test(s),
  wenigerKlein: (s) => /verringern/.test(s) && /12,5 µg/.test(s) && !/bis 25/.test(s),
};
const SCHRITT_NAME = {
  normal: 'S_normal „erhöhen … 12,5 bis 25 µg"',
  klein: 'S_klein „erhöhen … 12,5 µg"',
  weniger: 'S_weniger „verringern … 12,5 bis 25 µg"',
  wenigerKlein: 'S_weniger_klein „verringern … 12,5 µg"',
};

const liste = (x) => (x === undefined ? [] : Array.isArray(x) ? x : [x]);
const ERGEBNISSE = [];

/**
 * Ein Fall: { name, stand: Überschreibungen | () => Stand, heute?, erwartet }.
 * erwartet: richtung, keineRichtung (nicht mehr/weniger), ohneRichtung (auch
 * nicht gleich), frage (true | false | 'warncheck' | Feldname), regel,
 * ohneRegel, stufe, stufeMin, stufeMax, schritt, pflicht ('lang' | 'kurz'),
 * warnzeichen (W-D2), d0 (Kopftext), text (RegExp über alles), ohne (RegExp
 * über Titel, Texte, Schritt, Gründe), extra [[name, (r, stand) => bool]],
 * nullErlaubt.
 */
function pruefeFall(f) {
  const heute = f.heute || HEUTE;
  const e = f.erwartet;
  let stand;
  let r;
  try {
    stand = typeof f.stand === 'function' ? f.stand() : vollständigerStand(f.stand);
    r = dosisRichtung(stand, heute);
  } catch (err) {
    check(`${f.name}: dosisRichtung läuft`, false, kurzFehler(err));
    return;
  }
  ERGEBNISSE.push({ name: f.name, r, stand, heute });
  const p = (was, fn, detail) => {
    let ok = false;
    let d = '';
    try { ok = fn() === true; } catch (err) { d = `Ausnahme: ${err.message}`; }
    let zusatz = d;
    if (!ok && !zusatz) {
      try { zusatz = detail ? detail() : info(r); } catch { zusatz = info(r); }
    }
    check(`${f.name}: ${was}`, ok, zusatz);
  };
  if (r === null || r === undefined) {
    if (!e.nullErlaubt) {
      check(`${f.name}: liefert eine Karte`, false, `Ergebnis ${r}`);
      return;
    }
  }
  const snip = (t) => () => `${info(r)} | ${t().replace(/\s+/g, ' ').slice(0, 220)}`;

  if (e.richtung) p(`richtung = ${e.richtung}`, () => r.richtung === e.richtung);
  if (e.keineRichtung) p('keine Richtung „mehr"/„weniger"', () => r === null || !['mehr', 'weniger'].includes(r.richtung));
  if (e.ohneRichtung) p('keine Richtung, auch nicht „so lassen"', () => r === null || !['mehr', 'weniger', 'gleich'].includes(r.richtung));
  if (e.frage === false) p('keine offene Frage', () => !r.frage);
  if (e.frage === true) p('stellt eine Frage', () => !!r.frage && str(r.frage.text).length > 0);
  if (e.frage === 'warncheck') p('zeigt zuerst den Warnzeichen-Check', () => !!r.frage && r.frage.ziel === 'warncheck');
  if (typeof e.frage === 'string' && e.frage !== 'warncheck') {
    p('stellt eine Pflichtfrage', () => !!r.frage && str(r.frage.text).length > 0);
    // ANNAHME: frage.feld ist der Feldname aus speicher.js (Befund bzw. Profil).
    p(`Frage betrifft „${e.frage}"`, () => !!r.frage && r.frage.feld === e.frage);
  }
  liste(e.regel).forEach((id) => p(`Regel ${id}`, () => hatRegel(r, id)));
  liste(e.ohneRegel).forEach((id) => p(`nicht Regel ${id}`, () => !hatRegel(r, id)));
  if (e.stufe) p(`Stufe ${e.stufe}`, () => r.stufe === e.stufe);
  if (e.stufeMin) p(`Stufe mindestens ${e.stufeMin}`, () => rang(r.stufe) >= RANG[e.stufeMin]);
  if (e.stufeMax) p(`Stufe höchstens ${e.stufeMax}`, () => rang(r.stufe) >= 0 && rang(r.stufe) <= RANG[e.stufeMax]);
  if (e.schritt) p(`Schritt ${SCHRITT_NAME[e.schritt]}`, () => SCHRITT[e.schritt](str(r.schritt)), () => `schritt=„${r.schritt}"`);
  if (e.pflicht === 'lang') {
    p('D6 lang: „keine Anweisung", „nicht auf eigene Faust"', () => /keine Anweisung/.test(str(r.pflicht)) && /nicht auf eigene Faust/.test(str(r.pflicht)),
      () => `pflicht=„${str(r.pflicht).slice(0, 120)}"`);
    p('D6 lang: erst Anruf in der Praxis, bis dahin genau wie bisher', () => /Anruf in der Praxis/.test(str(r.pflicht)) && /genau wie bisher/.test(str(r.pflicht)),
      () => `pflicht=„${str(r.pflicht).slice(0, 120)}"`);
  }
  if (e.pflicht === 'kurz') {
    p('D6 kurz: „Beschwerden allein", ohne „keine Anweisung"', () => /Einschätzung aus Ihrem Laborwert/.test(str(r.pflicht))
      && /Beschwerden allein/.test(str(r.pflicht)) && !/keine Anweisung/.test(str(r.pflicht)), () => `pflicht=„${str(r.pflicht).slice(0, 120)}"`);
  }
  if (e.warnzeichen) {
    p('W-D2 direkt sichtbar (112, Brust, Atemnot)', () => /112/.test(str(r.warnzeichen)) && /Brust/.test(str(r.warnzeichen)) && /Atemnot/.test(str(r.warnzeichen)),
      () => `warnzeichen=${JSON.stringify(r.warnzeichen)}`);
  }
  if (e.d0) {
    p('D0-Kopftext: „nichts zur Dosis ableiten", nicht „alles in Ordnung"', () => /nichts zur Dosis ableiten/.test(alles(r))
      && /nicht, dass alles in Ordnung ist/.test(alles(r)), snip(() => kern(r)));
  }
  liste(e.text).forEach((m) => p(`Text ${m}`, () => m.test(alles(r)), snip(() => kern(r))));
  liste(e.ohne).forEach((m) => p(`ohne ${m}`, () => !m.test(kern(r)), snip(() => kern(r))));
  liste(e.extra).forEach(([was, fn]) => p(was, () => fn(r, stand) === true));

  // DV, Grundsatz 4: Bei jeder Richtung konkret prüfen, dass keine neue Tagesdosis dasteht.
  if (r && ['mehr', 'weniger'].includes(r.richtung)) {
    const verboten = verboteneZahlen(stand, heute).map((v) => String(v).replace('.', ','));
    p(`keine neue Tagesdosis (nie ${verboten.join(' / ') || '–'} µg, nie „also …")`, () => neueDosisGenannt(alles(r), stand, heute).length === 0,
      () => `gefunden: ${neueDosisGenannt(alles(r), stand, heute).join(', ')}`);
  }
}

const Z = /Zöliakie/;
const FAELLE = [
  // ================================================================ Grundsatz 1 – Reihenfolge
  // (a) Warnzeichen (W-D1, W-D3) → (b) Schwangerschaft (D7) → (c) offene
  // Pflichtfragen → (d) D0.1–D0.18 → (e) D1–D5.
  {
    name: 'G1 Warnzeichen (W-D1) vor Schwangerschaft (D7)',
    stand: { profil: { geburtsjahr: geb(36), schwanger: 'ja' }, befund: bef(8), befinden: [bf(-3, ['herz'])] },
    erwartet: { frage: 'warncheck', ohneRichtung: true },
  },
  {
    name: 'G1 Schwangerschaft (D7) vor offener Pflichtfrage',
    stand: { profil: { geburtsjahr: geb(36), schwanger: 'ja' }, befund: bef(8, 15, { biotin: '' }) },
    erwartet: { richtung: 'klaeren', regel: 'D7', frage: false },
  },
  {
    // ENTSCHIEDEN: Steht ein Sperrgrund schon fest (hier Amiodaron, D0.11),
    // stellt die Karte keine Pflichtfragen mehr – ihre Antworten könnten an
    // „keine Richtung" nichts ändern, und jede Frage mehr ist für die Nutzerin
    // Mühe ohne Nutzen. Keine Richtung bleibt keine Richtung.
    name: 'G1 fester Sperrgrund (D0.11) – keine unnötige Pflichtfrage',
    stand: { befund: bef(8, 15, { biotin: '' }), mittel: ['amiodaron'] },
    erwartet: { richtung: 'klaeren', regel: 'D0.11', keineRichtung: true },
  },
  {
    name: 'G1 D0 vor D1–D5 (Muster c mit Amiodaron)',
    stand: { befund: bef(8), mittel: ['amiodaron'] },
    erwartet: { richtung: 'klaeren', regel: 'D0.11', ohne: [/spricht für eine etwas höhere Dosis/] },
  },
  {
    name: 'G1 W-D3 vor D0.9 (Muster b, TSH 25, Biotin)',
    stand: { befund: bef(25, 8, { biotin: 'ja' }) },
    erwartet: { frage: 'warncheck', ohneRichtung: true },
  },
  {
    name: 'G1 W-D1 vor offener Pflichtfrage',
    stand: { befund: bef(8, 15, { biotin: '' }), befinden: [bf(-3, ['herz'])] },
    erwartet: { frage: 'warncheck', ohneRichtung: true },
  },

  // ================================================================ D7 – Schwangerschaft (Stufe Tage)
  {
    name: 'D7 schwanger, Muster c',
    stand: { profil: { geburtsjahr: geb(36), schwanger: 'ja' }, befund: bef(8) },
    erwartet: { richtung: 'klaeren', regel: 'D7', stufe: 'tage', text: [/Schwangerschaft/], ohne: [/spricht für/] },
  },
  {
    name: 'D7 geht auch D0.11 vor',
    stand: { profil: { geburtsjahr: geb(36), schwanger: 'ja' }, befund: bef(0.2), mittel: ['amiodaron'] },
    erwartet: { richtung: 'klaeren', regel: 'D7', stufe: 'tage' },
  },
  {
    name: 'D7 nicht schwanger (36 J.)',
    stand: { profil: { geburtsjahr: geb(36), schwanger: 'nein' }, befund: bef(8) },
    erwartet: { richtung: 'mehr', ohneRegel: 'D7' },
  },

  // ================================================================ Grundsatz 2 – was nie in die Richtung fließt
  {
    name: 'G2 fT3 über dem Bereich ändert „so lassen" nicht',
    stand: { befund: bef(2, 15, { ft3: { wert: 9, einheit: 'pmol/l', von: 3.1, bis: 6.8 } }) },
    erwartet: { richtung: 'gleich' },
  },
  {
    name: 'G2 LDL, HbA1c, Ferritin ändern „mehr" nicht',
    stand: {
      befund: bef(8, 15, {
        ldl: { wert: 190, einheit: 'mg/dl', von: null, bis: 116 },
        hba1c: { wert: 7.5, einheit: '%', von: 4, bis: 5.6 },
        ferritin: { wert: 15, einheit: 'ng/ml', von: 15, bis: 150 },
      }),
    },
    erwartet: { richtung: 'mehr' },
  },

  // ================================================================ D0.1 – TSH und Laborbereich
  {
    name: 'D0.1 TSH ohne Laborbereich',
    stand: { befund: bef(tsh(8, { von: null, bis: null })) },
    erwartet: { richtung: 'klaeren', regel: 'D0.1', d0: true, text: [/beide Grenzen/] },
  },
  { name: 'D0.1 TSH nur mit unterer Grenze', stand: { befund: bef(tsh(8, { bis: null })) }, erwartet: { richtung: 'klaeren', regel: 'D0.1' } },
  { name: 'D0.1 TSH nur mit oberer Grenze', stand: { befund: bef(tsh(8, { von: null })) }, erwartet: { richtung: 'klaeren', regel: 'D0.1' } },
  {
    name: 'D0.1 ohne Laborbereich, aber Zielbereich der Ärztin (P6)',
    stand: { befund: bef(tsh(2, { von: null, bis: null })), profil: { zielVon: 1, zielBis: 3 } },
    erwartet: { richtung: 'gleich', ohneRegel: 'D0.1' },
  },
  {
    // MEHRDEUTIG: dosisRichtung liefert „null ohne Befund mit TSH", D0.1 nennt
    // „Kein TSH im Befund" als Sperrgrund. Beides ist hier richtig – nur ein
    // „so lassen" aus fT4 allein nicht (D0.1: sonst hätte D1 „so lassen" gesagt).
    name: 'D0.1 kein TSH, nur fT4',
    stand: { befund: { tsh: null, ft4: ft4(15) } },
    erwartet: {
      nullErlaubt: true,
      extra: [['nie „so lassen" aus fT4 allein (null oder klaeren mit D0.1)', (r) => r === null || r === undefined || (r.richtung === 'klaeren' && hatRegel(r, 'D0.1'))]],
    },
  },

  // ================================================================ D0.2 – TSH-Einheit (L1)
  { name: 'D0.2 TSH in ng/ml', stand: { befund: bef(tsh(8, { einheit: 'ng/ml' })) }, erwartet: { richtung: 'klaeren', regel: 'D0.2', d0: true, text: [/Einheit/] } },
  { name: 'D0.2 TSH in pmol/l', stand: { befund: bef(tsh(8, { einheit: 'pmol/l' })) }, erwartet: { richtung: 'klaeren', regel: 'D0.2' } },
  // L1: mU/l = µU/ml = mIU/l = µIU/ml = uU/ml (Entscheidung: auch mIE/l, Groß/klein egal).
  ...['µU/ml', 'mIE/l', 'µIU/ml', 'mIU/l', 'uU/ml', 'MU/L'].map((einheit) => ({
    name: `L1/D0.2 TSH in ${einheit} gilt`,
    stand: { befund: bef(tsh(8, { einheit })) },
    erwartet: { richtung: 'mehr', ohneRegel: 'D0.2' },
  })),

  // ================================================================ D0.3 – Plausibilität (L2, Entscheidung 13)
  { name: 'D0.3 TSH 60 unbestätigt', stand: { befund: bef(60) }, erwartet: { richtung: 'klaeren', regel: 'D0.3', d0: true, stufeMin: 'tage', text: [/ungewöhnlich/] } },
  { name: 'D0.3 TSH 60 bestätigt', stand: { befund: bef(60, 15, { bestaetigt: true }) }, erwartet: { richtung: 'mehr', ohneRegel: 'D0.3', stufe: 'tage' } },
  { name: 'D0.3 Grenze: TSH 50 ohne Rückfrage', stand: { befund: bef(50) }, erwartet: { richtung: 'mehr', ohneRegel: 'D0.3' } },
  { name: 'D0.3 TSH 0,009', stand: { befund: bef(0.009) }, erwartet: { richtung: 'klaeren', regel: 'D0.3' } },
  { name: 'D0.3 TSH-Untergrenze 0,05', stand: { befund: bef(tsh(8, { von: 0.05 })) }, erwartet: { richtung: 'klaeren', regel: 'D0.3' } },
  { name: 'D0.3 TSH-Obergrenze 8,0', stand: { befund: bef(tsh(9, { bis: 8 })) }, erwartet: { richtung: 'klaeren', regel: 'D0.3' } },
  { name: 'D0.3 Grenze: Obergrenze 7,5 noch plausibel', stand: { befund: bef(tsh(9, { bis: 7.5 })) }, erwartet: { richtung: 'mehr', ohneRegel: 'D0.3' } },
  { name: 'D0.3 fT4 2,5 pmol/l (Einheit verwechselt?)', stand: { befund: bef(2, 2.5) }, erwartet: { richtung: 'klaeren', regel: 'D0.3' } },
  {
    name: 'D0.3 TSH 8-mal so hoch wie vorher bei gleicher Dosis',
    stand: { vorbefunde: [vorbefund('b0', plus(BEFUND, -100), 1)], befund: bef(8) },
    erwartet: { richtung: 'klaeren', regel: 'D0.3' },
  },
  {
    name: 'D0.3 Grenze: 7,9-mal so hoch',
    stand: { vorbefunde: [vorbefund('b0', plus(BEFUND, -100), 1)], befund: bef(7.9) },
    erwartet: { richtung: 'mehr', ohneRegel: 'D0.3' },
  },

  // ================================================================ D0.4 – Befund älter als 92 Tage (+ X12)
  {
    name: 'D0.4 Befund 93 Tage alt',
    stand: { befund: bef(8, 15, { datum: plus(HEUTE, -93) }) },
    erwartet: { richtung: 'klaeren', regel: 'D0.4', d0: true, text: [/älter als drei Monate/] },
  },
  { name: 'D0.4 Grenze: 92 Tage', stand: { befund: bef(8, 15, { datum: plus(HEUTE, -92) }) }, erwartet: { ohneRegel: 'D0.4' } },
  {
    name: 'D0.4/X12 Praxis „noch nicht", keine neue Dosis: Musterstufe bleibt',
    stand: { befund: bef(15, 15, { datum: plus(HEUTE, -100) }) },
    erwartet: { richtung: 'klaeren', regel: 'D0.4', stufe: 'tage', text: [/Falls die Praxis/] },
  },
  {
    name: 'D0.4/X12 Praxis hat geändert: Ausnahme Termin',
    stand: { befund: bef(15, 15, { datum: plus(HEUTE, -100), praxis: 'geaendert', praxisAm: plus(HEUTE, -95) }) },
    erwartet: { richtung: 'klaeren', regel: 'D0.4', stufeMax: 'termin' },
  },
  {
    name: 'D0.4/X12 neue Dosis seit dem Befund: Ausnahme Termin',
    stand: { befund: bef(15, 15, { datum: plus(HEUTE, -100) }), dosen: [dosis('d1', DOSIS_AB, 75), dosis('d2', plus(HEUTE, -70), 100)] },
    erwartet: { richtung: 'klaeren', regel: 'D0.4', stufeMax: 'termin' },
  },

  // ================================================================ D0.5 – Praxis hat entschieden / Dosis danach geändert
  {
    name: 'D0.5a Dosis nach der Abnahme geändert',
    stand: { befund: bef(8), dosen: [dosis('d1', DOSIS_AB, 75), dosis('d2', plus(BEFUND, 3), 100)] },
    erwartet: { richtung: 'klaeren', regel: 'D0.5', d0: true, stufe: 'keine', text: [/nach dieser Blutabnahme schon geändert/] },
  },
  ...['bleibt', 'geaendert', 'nachmessen'].map((praxis) => ({
    name: `D0.5b Praxis: ${praxis}`,
    stand: { befund: bef(8, 15, { praxis, praxisAm: plus(BEFUND, 2) }) },
    erwartet: { richtung: 'klaeren', regel: 'D0.5', stufe: 'keine', text: [/Praxis hat zu diesem Wert schon entschieden/] },
  })),
  { name: 'D0.5 F8 offen: Frage vor der Richtung', stand: { befund: bef(8, 15, { praxis: '' }) }, erwartet: { frage: 'praxis', keineRichtung: true } },
  {
    name: 'D0.5 Sperre endet mit Kontrollbefund ≥ Änderung + 42 Tage',
    stand: {
      vorbefunde: [vorbefund('b0', plus(BEFUND, -120), 8)],
      dosen: [dosis('d1', DOSIS_AB, 75), dosis('d2', plus(BEFUND, -42), 87.5)],
      befund: bef(8),
    },
    erwartet: { richtung: 'mehr', ohneRegel: ['D0.5', 'D0.6'] },
  },

  // ================================================================ D0.6 – Einpendelzeit (+ X14 Packung)
  {
    name: 'D0.6 Dosis 41 Tage vor der Abnahme geändert (60 J.)',
    stand: { befund: bef(8), dosen: [dosis('d1', DOSIS_AB, 75), dosis('d2', plus(BEFUND, -41), 87.5)] },
    erwartet: { richtung: 'klaeren', regel: 'D0.6', d0: true, text: [/6 Wochen/, /eingependelt/] },
  },
  {
    name: 'D0.6 ab 70: 55 Tage reichen nicht',
    stand: { profil: { geburtsjahr: geb(72) }, befund: bef(0.2), dosen: [dosis('d1', DOSIS_AB, 75), dosis('d2', plus(BEFUND, -55), 62.5)] },
    erwartet: { richtung: 'klaeren', regel: 'D0.6', text: [/8 Wochen/] },
  },
  {
    name: 'D0.6 ab 70: Grenze 56 Tage',
    stand: { profil: { geburtsjahr: geb(72) }, befund: bef(0.2), dosen: [dosis('d1', DOSIS_AB, 75), dosis('d2', plus(BEFUND, -56), 62.5)] },
    erwartet: { richtung: 'weniger', ohneRegel: 'D0.6' },
  },
  {
    name: 'D0.6 ohne Geburtsjahr gilt 8 Wochen (50 Tage)',
    stand: { profil: { geburtsjahr: null }, befund: bef(0.2), dosen: [dosis('d1', DOSIS_AB, 75), dosis('d2', plus(BEFUND, -50), 62.5)] },
    erwartet: { richtung: 'klaeren', regel: 'D0.6' },
  },
  {
    name: 'D0.6 der erste Dosis-Eintrag zählt nicht',
    stand: { befund: bef(0.2), dosen: [dosis('d1', plus(BEFUND, -10), 75)] },
    erwartet: { richtung: 'weniger', ohneRegel: 'D0.6' },
  },
  {
    name: 'D0.6 Präparatwechsel zählt',
    stand: { befund: bef(8), dosen: [dosis('d1', DOSIS_AB, 75), dosis('d2', plus(BEFUND, -20), 75, { praeparat: 'Euthyrox' })] },
    erwartet: { richtung: 'klaeren', regel: 'D0.6' },
  },
  { name: 'D0.6/X14 andere Packung (F10): ja', stand: { befund: bef(8, 15, { packung: 'ja' }) }, erwartet: { richtung: 'klaeren', regel: 'D0.6' } },
  { name: 'D0.6/X14 andere Packung: weiß nicht', stand: { befund: bef(8, 15, { packung: 'unbekannt' }) }, erwartet: { richtung: 'klaeren', regel: 'D0.6' } },
  { name: 'D0.6/X14 Packungsfrage offen', stand: { befund: bef(8, 15, { packung: '' }) }, erwartet: { frage: 'packung', keineRichtung: true } },

  // ================================================================ D0.7 – Einnahmetreue (nur Muster b/c)
  {
    name: 'D0.7 A: an 3 Tagen nicht genommen',
    stand: { befund: bef(8), einnahmen: mitLuecken([5, 6, 7]) },
    erwartet: { richtung: 'klaeren', regel: 'D0.7', d0: true, text: [/an 3 Tagen nicht genommen/] },
  },
  { name: 'D0.7 A Grenze: 2 Tage nicht genommen', stand: { befund: bef(8), einnahmen: mitLuecken([5, 6]) }, erwartet: { richtung: 'mehr', ohneRegel: 'D0.7' } },
  { name: 'D0.7 A: 17 von 19 erfassten Tagen (< 90 %)', stand: { befund: bef(8), einnahmen: nurVorBefund(19, [5, 6]) }, erwartet: { richtung: 'klaeren', regel: 'D0.7' } },
  { name: 'D0.7 A Grenze: 18 von 20 (90 %), Q1 „ja"', stand: { befund: bef(8), einnahmen: nurVorBefund(20, [5, 6]) }, erwartet: { richtung: 'mehr', ohneRegel: 'D0.7' } },
  {
    name: 'D0.7 B: 33 Tage erfasst, Q1 offen',
    stand: { befund: bef(8, 15, { vergessen: '' }), einnahmen: nurVorBefund(33) },
    erwartet: { frage: 'vergessen', keineRichtung: true },
  },
  {
    name: 'D0.7 B Grenze: 34 Tage erfasst, keine Q1',
    stand: { befund: bef(8, 15, { vergessen: '' }), einnahmen: nurVorBefund(34) },
    erwartet: { richtung: 'mehr', ohneRegel: 'D0.7', frage: false },
  },
  ...['einzelne', 'mehrere', 'unbekannt'].map((vergessen) => ({
    name: `D0.7 B: Q1 „${vergessen}"`,
    stand: { befund: bef(8, 15, { vergessen }), einnahmen: nurVorBefund(10) },
    erwartet: { richtung: 'klaeren', regel: 'D0.7' },
  })),
  {
    // D0.7 wörtlich: „Tage vor profil.seit zählen als nicht erfasst" – auch
    // wenn für sie Einträge vorliegen (sp.zaehltAb zählt nachgetragene Tage
    // mit; D0.7 geht hier vor, weil es die sicherere Fassung ist).
    name: 'D0.7 Tage vor „seit" zählen als nicht erfasst',
    stand: { profil: { seit: plus(BEFUND, -20) }, befund: bef(8, 15, { vergessen: '' }) },
    erwartet: { frage: 'vergessen', keineRichtung: true },
  },
  { name: 'D0.7 C: Q2 offen', stand: { befund: bef(8, 15, { einnahmeArt: '' }) }, erwartet: { frage: 'einnahmeArt', keineRichtung: true } },
  ...['nein', 'unbekannt'].map((einnahmeArt) => ({
    name: `D0.7 C: Q2 „${einnahmeArt}"`,
    stand: { befund: bef(8, 15, { einnahmeArt }) },
    erwartet: { richtung: 'klaeren', regel: 'D0.7', text: [/Zuerst die Einnahme ordnen/] },
  })),
  { name: 'D0.7 C: Q2 „abends, mit der Praxis abgesprochen"', stand: { befund: bef(8, 15, { einnahmeArt: 'abends' }) }, erwartet: { richtung: 'mehr', ohneRegel: 'D0.7' } },
  {
    name: 'D0.7 gilt nicht bei Muster e',
    stand: { befund: bef(0.2, 15, { einnahmeArt: 'nein', vergessen: 'mehrere' }), einnahmen: mitLuecken([5, 6, 7]) },
    erwartet: { richtung: 'weniger', ohneRegel: 'D0.7' },
  },
  {
    name: 'D0.7 bei Muster b: Stufe bleibt Tage',
    stand: { befund: bef(15, 8), einnahmen: mitLuecken([5, 6, 7]) },
    erwartet: { richtung: 'klaeren', regel: 'D0.7', stufe: 'tage' },
  },

  // ================================================================ D0.8 – Wechselwirkungen, Aufnahme
  { name: 'D0.8a F6 Mittel geändert: ja (c)', stand: { befund: bef(8, 15, { mittelGeaendert: 'ja' }) }, erwartet: { richtung: 'klaeren', regel: 'D0.8', d0: true, text: [/begonnen oder abgesetzt/] } },
  { name: 'D0.8a F7 Einnahme geändert: weiß nicht (c)', stand: { befund: bef(8, 15, { einnahmeGeaendert: 'unbekannt' }) }, erwartet: { richtung: 'klaeren', regel: 'D0.8' } },
  { name: 'D0.8a gilt auch bei Muster e', stand: { befund: bef(0.2, 15, { mittelGeaendert: 'ja' }) }, erwartet: { richtung: 'klaeren', regel: 'D0.8' } },
  { name: 'D0.8a gilt nicht bei Muster a', stand: { befund: bef(2, 15, { mittelGeaendert: 'ja' }) }, erwartet: { richtung: 'gleich', ohneRegel: 'D0.8' } },
  { name: 'D0.8a F6 offen', stand: { befund: bef(8, 15, { mittelGeaendert: '' }) }, erwartet: { frage: 'mittelGeaendert', keineRichtung: true } },
  { name: 'D0.8b Kalzium, Q3 offen', stand: { befund: bef(8, 15, { abstandOk: '' }), mittel: ['kalzium'] }, erwartet: { frage: 'abstandOk', keineRichtung: true } },
  ...[['kalzium', 'nein'], ['kalzium', 'unbekannt'], ['bisphosphonat', 'nein'], ['kaffee', 'nein']].map(([m, abstandOk]) => ({
    name: `D0.8b ${m}, Abstand „${abstandOk}"`,
    stand: { befund: bef(8, 15, { abstandOk }), mittel: [m] },
    erwartet: { richtung: 'klaeren', regel: 'D0.8', text: [/Abst[aä]nde?/] },
  })),
  { name: 'D0.8b Kalzium, Abstand eingehalten', stand: { befund: bef(8, 15, { abstandOk: 'ja' }), mittel: ['kalzium'] }, erwartet: { richtung: 'mehr', ohneRegel: 'D0.8' } },
  { name: 'D0.8b Magenschutz (PPI) allein löst Q3 nicht aus', stand: { befund: bef(8, 15, { abstandOk: '' }), mittel: ['ppi'] }, erwartet: { richtung: 'mehr', ohneRegel: 'D0.8' } },
  { name: 'D0.8b gilt nicht bei Muster e', stand: { befund: bef(0.2, 15, { abstandOk: 'nein' }), mittel: ['kalzium'] }, erwartet: { richtung: 'weniger', ohneRegel: 'D0.8' } },

  // ================================================================ D0.9 – Biotin (jedes Muster)
  { name: 'D0.9 Biotin ja, auch bei Muster a', stand: { befund: bef(2, 15, { biotin: 'ja' }) }, erwartet: { richtung: 'klaeren', regel: 'D0.9', d0: true, text: [/Biotin/] } },
  { name: 'D0.9 Biotin weiß nicht (c)', stand: { befund: bef(8, 15, { biotin: 'unbekannt' }) }, erwartet: { richtung: 'klaeren', regel: 'D0.9' } },
  { name: 'D0.9 Biotin in den Mitteln, F2 nein', stand: { befund: bef(8), mittel: ['biotin'] }, erwartet: { richtung: 'klaeren', regel: 'D0.9' } },
  { name: 'D0.9 F2 offen', stand: { befund: bef(8, 15, { biotin: '' }) }, erwartet: { frage: 'biotin', keineRichtung: true } },

  // ================================================================ D0.10 – Krankheit, Kortison, Kontrastmittel
  { name: 'D0.10 schwer krank: ja', stand: { befund: bef(8, 15, { krank: 'ja' }) }, erwartet: { richtung: 'klaeren', regel: 'D0.10', d0: true, text: [/Kontrastmittel/] } },
  { name: 'D0.10 Kortison: weiß nicht', stand: { befund: bef(8, 15, { kortison: 'unbekannt' }) }, erwartet: { richtung: 'klaeren', regel: 'D0.10' } },
  { name: 'D0.10 Kontrastmittel: ja', stand: { befund: bef(8, 15, { kontrastmittel: 'ja' }) }, erwartet: { richtung: 'klaeren', regel: 'D0.10' } },
  { name: 'D0.10 F3 offen', stand: { befund: bef(8, 15, { krank: '' }) }, erwartet: { frage: 'krank', keineRichtung: true } },
  { name: 'D0.10 bei TSH 0,05: Musterstufe Tage bleibt (Grundsatz 5)', stand: { befund: bef(0.05, 15, { krank: 'ja' }) }, erwartet: { richtung: 'klaeren', regel: 'D0.10', stufe: 'tage' } },

  // ================================================================ D0.11 – Amiodaron, Lithium, Jod
  { name: 'D0.11 Amiodaron', stand: { befund: bef(8), mittel: ['amiodaron'] }, erwartet: { richtung: 'klaeren', regel: 'D0.11', d0: true, text: [/Amiodaron/] } },
  { name: 'D0.11 Lithium', stand: { befund: bef(8), mittel: ['lithium'] }, erwartet: { richtung: 'klaeren', regel: 'D0.11', text: [/Lithium/] } },
  { name: 'D0.11 Jod, Algen, Kelp', stand: { befund: bef(0.2), mittel: ['jod'] }, erwartet: { richtung: 'klaeren', regel: 'D0.11', text: [/Jod/] } },
  { name: 'D0.11 bei TSH 15: Musterstufe Tage bleibt', stand: { befund: bef(15), mittel: ['amiodaron'] }, erwartet: { richtung: 'klaeren', regel: 'D0.11', stufe: 'tage' } },

  // ================================================================ D0.12 – Muster f, g, h
  { name: 'D0.12 Muster f (TSH 6, fT4 23)', stand: { befund: bef(6, 23) }, erwartet: { richtung: 'klaeren', regel: 'D0.12', d0: true, stufe: 'zeitnah', text: [/beide erhöht/] } },
  {
    // Entscheidung 11: Muster g nimmt den RW1-Text, „Hirnanhangdrüse" nie im Mustertext.
    // ENTSCHIEDEN: Regelwerk 1 hat Muster g in g1 (fT4 etwas niedrig, Stufe
    // Termin) und g2 (zeitnah) geteilt; D0.12 kannte die Teilung nicht. Die
    // Karte übernimmt die Stufe des Musters.
    name: 'D0.12 Muster g1 (TSH 2, fT4 11)',
    stand: { befund: bef(2, 11) },
    erwartet: { richtung: 'klaeren', regel: 'D0.12', stufe: 'termin', ohne: [/Hirnanhangdrüse/] },
  },
  {
    name: 'D0.12 Muster g2 (TSH 2, fT4 9)',
    stand: { befund: bef(2, 9) },
    erwartet: { richtung: 'klaeren', regel: 'D0.12', stufe: 'tage', ohne: [/Hirnanhangdrüse/] },
  },
  { name: 'D0.12 Muster h (TSH 2, fT4 24)', stand: { befund: bef(2, 24) }, erwartet: { richtung: 'klaeren', regel: 'D0.12', stufe: 'termin', ohne: [/spricht für/] } },
  {
    // MEHRDEUTIG: „der Satz zur Tablette vor der Abnahme" ist nicht wörtlich
    // festgelegt – geprüft wird nur, dass bei F1 = ja etwas dazukommt.
    name: 'D0.12 Muster h mit Tablette vor der Abnahme (F1)',
    stand: { befund: bef(2, 24, { vorAbnahme: 'ja' }) },
    erwartet: {
      richtung: 'klaeren',
      regel: 'D0.12',
      extra: [['Satz zur Tablette vor der Abnahme kommt dazu', (r) => {
        const ohneF1 = dosisRichtung(vollständigerStand({ befund: bef(2, 24) }), HEUTE);
        return kern(r).length > kern(ohneF1).length;
      }]],
    },
  },

  // ================================================================ D0.13 – Schilddrüsenkrebs (+ X11)
  { name: 'D0.13 Krebs ja, Muster a: Termin', stand: { profil: { krebs: 'ja' }, befund: bef(2) }, erwartet: { richtung: 'klaeren', regel: 'D0.13', d0: true, stufe: 'termin', text: [/Schilddrüsenkrebs/] } },
  { name: 'D0.13 Krebs ja, TSH über dem Bereich: zeitnah', stand: { profil: { krebs: 'ja' }, befund: bef(7) }, erwartet: { richtung: 'klaeren', regel: 'D0.13', stufe: 'zeitnah' } },
  { name: 'D0.13/X11 Krebs ja, Muster b TSH 15: Tage', stand: { profil: { krebs: 'ja' }, befund: bef(15, 8) }, erwartet: { richtung: 'klaeren', regel: 'D0.13', stufe: 'tage' } },
  { name: 'D0.13/X11 Krebs ja, Muster d, 80 J.: Tage', stand: { profil: { krebs: 'ja', geburtsjahr: geb(80) }, befund: bef(0.05, 30) }, erwartet: { richtung: 'klaeren', regel: 'D0.13', stufe: 'tage' } },
  {
    name: 'D0.13 Krebs ja: auch mit Zielbereich keine Richtung',
    stand: { profil: { krebs: 'ja', zielVon: 0.1, zielBis: 0.5 }, befund: bef(0.3) },
    erwartet: { richtung: 'klaeren', regel: 'D0.13' },
  },
  { name: 'D0.13 Krebs weiß nicht', stand: { profil: { krebs: 'unbekannt' }, befund: bef(8) }, erwartet: { richtung: 'klaeren', regel: 'D0.13', text: [/im Profil/] } },
  // MEHRDEUTIG: krebs = '' ist laut P2/D0.13 ein Sperrgrund; ob die Karte ihn
  // als D0.13 zeigt oder als Frage stellt, lässt der Text offen – eine
  // Richtung gibt es jedenfalls nicht.
  { name: 'D0.13 Krebsfrage leer', stand: { profil: { krebs: '' }, befund: bef(8) }, erwartet: { keineRichtung: true } },

  // ================================================================ D0.14 – Hirnanhangdrüse, Kortison, TSH bewusst niedrig (+ Q4)
  { name: 'D0.14 Ursache Hirnanhangdrüse, Muster a', stand: { profil: { ursache: 'hypophyse' }, befund: bef(2) }, erwartet: { richtung: 'klaeren', regel: 'D0.14', d0: true } },
  { name: 'D0.14 Ursache Hirnanhangdrüse, Muster c', stand: { profil: { ursache: 'hypophyse' }, befund: bef(8) }, erwartet: { richtung: 'klaeren', regel: 'D0.14' } },
  { name: 'D0.14 dauerhaft Kortison: ja (c)', stand: { profil: { kortison: 'ja' }, befund: bef(8) }, erwartet: { richtung: 'klaeren', regel: 'D0.14' } },
  { name: 'D0.14 dauerhaft Kortison: weiß nicht (e)', stand: { profil: { kortison: 'unbekannt' }, befund: bef(0.2) }, erwartet: { richtung: 'klaeren', regel: 'D0.14' } },
  // MEHRDEUTIG: P9 nennt nur „ja, weiß nicht"; Grundsatz 3 und Entscheidung 6
  // machen eine leere Angabe zur offenen Frage – eine Richtung gibt es nicht.
  { name: 'D0.14 Kortisonfrage leer', stand: { profil: { kortison: '' }, befund: bef(8) }, erwartet: { keineRichtung: true } },
  { name: 'D0.14 TSH bewusst niedrig, Muster e', stand: { profil: { zielNiedrig: 'ja' }, befund: bef(0.2) }, erwartet: { richtung: 'klaeren', regel: 'D0.14' } },
  { name: 'D0.14 TSH bewusst niedrig, Muster d', stand: { profil: { zielNiedrig: 'ja' }, befund: bef(0.05, 30) }, erwartet: { richtung: 'klaeren', regel: 'D0.14' } },
  {
    name: 'D0.14 Q4 offen bei unbekannter Ursache (e)',
    stand: { profil: { ursache: 'unbekannt', zielNiedrig: '', hypophyseOderNiedrig: '' }, befund: bef(0.2) },
    erwartet: { frage: 'hypophyseOderNiedrig', keineRichtung: true },
  },
  {
    name: 'D0.14 Q4 offen bei leerer Ursache (e)',
    stand: { profil: { ursache: '', zielNiedrig: '', hypophyseOderNiedrig: '' }, befund: bef(0.2) },
    erwartet: { frage: 'hypophyseOderNiedrig', keineRichtung: true },
  },
  {
    name: 'D0.14 Q4 „ja", Frage „bewusst niedrig" offen (andere Ursache, e)',
    stand: { profil: { ursache: 'andere', zielNiedrig: '', hypophyseOderNiedrig: 'ja' }, befund: bef(0.2) },
    erwartet: { richtung: 'klaeren', regel: 'D0.14' },
  },
  {
    name: 'D0.14 Q4 „weiß nicht", Frage „bewusst niedrig" offen (e)',
    stand: { profil: { ursache: 'unbekannt', zielNiedrig: '', hypophyseOderNiedrig: 'unbekannt' }, befund: bef(0.2) },
    erwartet: { richtung: 'klaeren', regel: 'D0.14' },
  },
  // MEHRDEUTIG: „Q4 wird gestellt, solange tshNiedrigGewollt ≠ nein" regelt
  // nur das Fragen. Eine gespeicherte Antwort „ja"/„weiß nicht" (Q4 fragt auch
  // nach der Hirnanhangdrüse) sperrt nach dem Wortlaut von D0.14 trotzdem –
  // sicherer: auch wenn „bewusst niedrig" inzwischen „nein" ist.
  { name: 'D0.14 Q4 „ja" bei Ziel-niedrig „nein" (andere Ursache, e)', stand: { profil: { ursache: 'andere', hypophyseOderNiedrig: 'ja' }, befund: bef(0.2) }, erwartet: { richtung: 'klaeren', regel: 'D0.14' } },
  { name: 'D0.14 Q4 „weiß nicht" bei Ziel-niedrig „nein" (e)', stand: { profil: { ursache: 'unbekannt', hypophyseOderNiedrig: 'unbekannt' }, befund: bef(0.2) }, erwartet: { richtung: 'klaeren', regel: 'D0.14' } },
  { name: 'D0.14 Q4 „nein" (e)', stand: { profil: { ursache: 'unbekannt', hypophyseOderNiedrig: 'nein' }, befund: bef(0.2) }, erwartet: { richtung: 'weniger', ohneRegel: 'D0.14' } },
  {
    name: 'D0.14 Q4 nur bei d/e: Muster c ohne Frage',
    stand: { profil: { ursache: 'unbekannt', hypophyseOderNiedrig: '' }, befund: bef(8) },
    erwartet: { richtung: 'mehr', ohneRegel: 'D0.14' },
  },

  // ================================================================ D0.15 – Präparat mit T3 (Entscheidung 3)
  { name: 'D0.15 T3-Präparat, Muster c', stand: { profil: { praeparatArt: 't3' }, befund: bef(8) }, erwartet: { richtung: 'klaeren', regel: 'D0.15', d0: true, text: [/T3/] } },
  { name: 'D0.15 T3-Präparat, TSH niedrig', stand: { profil: { praeparatArt: 't3' }, befund: bef(0.2) }, erwartet: { richtung: 'klaeren', regel: 'D0.15' } },
  { name: 'D0.15 Präparat „weiß nicht" rechnet wie T4', stand: { profil: { praeparatArt: 'unbekannt' }, befund: bef(8) }, erwartet: { richtung: 'mehr', ohneRegel: 'D0.15' } },

  // ================================================================ D0.16 – keine Dosis
  { name: 'D0.16 keine Dosis eingetragen', stand: { befund: bef(8), dosen: [] }, erwartet: { richtung: 'klaeren', regel: 'D0.16', text: [/wie viel Sie im Moment nehmen/] } },
  { name: 'D0.16 Stärke fehlt', stand: { befund: bef(8), dosen: [dosis('d1', DOSIS_AB, null)] }, erwartet: { richtung: 'klaeren', regel: 'D0.16' } },
  { name: 'D0.16 Dosis erst nach dem Befund eingetragen', stand: { befund: bef(8), dosen: [dosis('d1', plus(BEFUND, 3), 75)] }, erwartet: { richtung: 'klaeren', regel: 'D0.16' } },

  // ================================================================ D0.17 – Vorbefund auf der anderen Seite
  // bestaetigt: true, damit die 8-fach-Rückfrage (D0.3) nicht mitgreift.
  {
    name: 'D0.17 voriger Wert unter, jetzt über dem Bereich',
    stand: { vorbefunde: [vorbefund('b0', plus(BEFUND, -100), 0.2)], befund: bef(8, 15, { bestaetigt: true }) },
    erwartet: { richtung: 'klaeren', regel: 'D0.17', d0: true, text: [/anderen Seite/, re(kurz(plus(BEFUND, -100)))] },
  },
  {
    name: 'D0.17 voriger Wert über, jetzt unter dem Bereich',
    stand: { vorbefunde: [vorbefund('b0', plus(BEFUND, -100), 8)], befund: bef(0.2, 15, { bestaetigt: true }) },
    erwartet: { richtung: 'klaeren', regel: 'D0.17' },
  },
  {
    name: 'D0.17 Grenze: Vorbefund 42 Tage vorher',
    stand: { vorbefunde: [vorbefund('b0', plus(BEFUND, -42), 0.2)], befund: bef(8, 15, { bestaetigt: true }) },
    erwartet: { richtung: 'klaeren', regel: 'D0.17' },
  },
  {
    name: 'D0.17 Grenze: Vorbefund 41 Tage vorher zählt nicht',
    stand: { vorbefunde: [vorbefund('b0', plus(BEFUND, -41), 0.2)], befund: bef(8, 15, { bestaetigt: true }) },
    erwartet: { richtung: 'mehr', ohneRegel: 'D0.17' },
  },
  {
    name: 'D0.17 Grenze: Vorbefund 365 Tage vorher',
    stand: { vorbefunde: [vorbefund('b0', plus(BEFUND, -365), 0.2)], befund: bef(8, 15, { bestaetigt: true }) },
    erwartet: { richtung: 'klaeren', regel: 'D0.17' },
  },
  {
    name: 'D0.17 Grenze: Vorbefund 366 Tage vorher zählt nicht',
    stand: { vorbefunde: [vorbefund('b0', plus(BEFUND, -366), 0.2)], befund: bef(8, 15, { bestaetigt: true }) },
    erwartet: { richtung: 'mehr', ohneRegel: 'D0.17' },
  },
  {
    name: 'D0.17 Dosis dazwischen geändert: kein Widerspruch',
    stand: {
      vorbefunde: [vorbefund('b0', plus(BEFUND, -100), 0.2)],
      dosen: [dosis('d1', DOSIS_AB, 75), dosis('d2', plus(BEFUND, -60), 62.5)],
      befund: bef(8, 15, { bestaetigt: true }),
    },
    erwartet: { richtung: 'mehr', ohneRegel: 'D0.17' },
  },
  {
    name: 'D0.17 beide unter dem Bereich: kein Widerspruch',
    stand: { vorbefunde: [vorbefund('b0', plus(BEFUND, -100), 0.3)], befund: bef(0.2) },
    erwartet: { richtung: 'weniger', ohneRegel: 'D0.17' },
  },

  // ================================================================ D0.18 – Beschwerden widersprechen dem Wert
  // Die Zu-viel-Beschwerden liegen 20 Tage zurück: im 28-Tage-Fenster, aber
  // außerhalb der 14 Tage von W-D1.
  {
    name: 'D0.18 Zu-viel-Beschwerden bei Muster c',
    stand: { befund: bef(8), befinden: [bf(-20, ['waerme', 'schwitzen', 'zittern'])] },
    erwartet: { richtung: 'klaeren', regel: 'D0.18', d0: true, stufeMin: 'zeitnah', text: [/passen nicht zu diesem Laborwert/] },
  },
  {
    name: 'D0.18 Zu-viel-Beschwerden bei Muster b: Tage',
    stand: { befund: bef(15, 8), befinden: [bf(-20, ['waerme', 'schwitzen', 'zittern'])] },
    erwartet: { richtung: 'klaeren', regel: 'D0.18', stufe: 'tage' },
  },
  {
    name: 'D0.18 Zu-wenig-Beschwerden bei Muster e',
    stand: { befund: bef(0.2), befinden: [bf(-5, ['frieren', 'verstopfung', 'trockenhaut'])] },
    erwartet: { richtung: 'klaeren', regel: 'D0.18', stufeMin: 'zeitnah' },
  },
  {
    name: 'D0.18 Zu-wenig-Beschwerden bei Muster d',
    stand: { befund: bef(0.05, 30), befinden: [bf(-5, ['frieren', 'verstopfung', 'trockenhaut'])] },
    erwartet: { richtung: 'klaeren', regel: 'D0.18' },
  },
  {
    name: 'D0.18 gleiche Richtung (zu wenig bei c): kein Widerspruch',
    stand: { befund: bef(8), befinden: [bf(-5, ['frieren', 'verstopfung', 'trockenhaut'])] },
    erwartet: { richtung: 'mehr', ohneRegel: 'D0.18' },
  },
  {
    name: 'D0.18 Grenze: 2,5 Punkte sind noch keine Richtung',
    stand: { befund: bef(0.2), befinden: [bf(-5, ['frieren', 'verstopfung', 'muede'])] },
    erwartet: { richtung: 'weniger', ohneRegel: 'D0.18' },
  },

  // ================================================================ D1 – Muster a: so lassen
  {
    name: 'D1 TSH 2 im Bereich',
    stand: { befund: bef(2) },
    erwartet: {
      richtung: 'gleich', regel: 'D1', stufe: 'keine', frage: false, pflicht: 'kurz',
      text: [/so zu lassen/, /Blutarmut|andere[n]? Ursachen/],
      extra: [['Karte nennt ihren Befund', (r) => !!r.befund && r.befund.id === 'b1']],
    },
  },
  {
    name: 'D1 Rand oben (TSH 3,7), Dosis seit dem Vorbefund gleich',
    stand: { vorbefunde: [vorbefund('b0', plus(BEFUND, -200), 2.5)], befund: bef(3.7) },
    erwartet: { richtung: 'gleich', text: [/schwankt von Messung zu Messung/] },
  },
  {
    name: 'D1 Rand: TSH 3,5 liegt nicht am Rand',
    stand: { vorbefunde: [vorbefund('b0', plus(BEFUND, -200), 2.5)], befund: bef(3.5) },
    erwartet: { richtung: 'gleich', ohne: [/schwankt von Messung zu Messung/] },
  },
  {
    name: 'D1 Rand unten (TSH 0,7), 60 J. ohne Risiko: nicht D1b',
    stand: { vorbefunde: [vorbefund('b0', plus(BEFUND, -200), 2.5)], befund: bef(0.7) },
    erwartet: { richtung: 'gleich', ohneRegel: 'D1b', text: [/schwankt von Messung zu Messung/] },
  },
  { name: 'D1/E9 müde: Hinweis auf B12 und Eisen', stand: { befund: bef(2), befinden: [bf(-3, ['muede'])] }, erwartet: { richtung: 'gleich', text: [/B12/] } },
  {
    name: 'D1 Beschwerden mit Richtung: Termin',
    stand: { befund: bef(2), befinden: [bf(-5, ['frieren', 'verstopfung', 'trockenhaut'])] },
    erwartet: { richtung: 'gleich', stufe: 'termin', ohneRegel: 'D0.18' },
  },
  { name: 'D1 im Zielbereich der Ärztin (P6)', stand: { profil: { zielVon: 1, zielBis: 3 }, befund: bef(2) }, erwartet: { richtung: 'gleich', text: [/Ärztin festgelegt/] } },
  {
    name: 'P6 Zielbereich hat Vorrang: 80 J., TSH 4,5 im Ziel 1–5',
    stand: { profil: { geburtsjahr: geb(80), zielVon: 1, zielBis: 5 }, befund: bef(4.5) },
    erwartet: { richtung: 'gleich' },
  },
  { name: 'P6 Zielbereich: TSH 3 über dem Ziel 0,5–2', stand: { profil: { zielVon: 0.5, zielBis: 2 }, befund: bef(3) }, erwartet: { richtung: 'mehr' } },
  { name: 'P6 Zielbereich: TSH 0,45 unter dem Ziel 1–3', stand: { profil: { zielVon: 1, zielBis: 3 }, befund: bef(0.45) }, erwartet: { richtung: 'weniger' } },

  // ================================================================ D1b (X8) – unterer Rand im Alter
  {
    name: 'D1b 72 J., TSH 0,5',
    stand: { profil: { geburtsjahr: geb(72) }, vorbefunde: [vorbefund('b0', plus(BEFUND, -200), 1.5)], befund: bef(0.5) },
    erwartet: { richtung: 'gleich', regel: 'D1b', stufe: 'termin', pflicht: 'kurz', text: [/unteren Rand/], ohne: [/kein Grund für eine Änderung/] },
  },
  { name: 'D1b 60 J. mit Osteoporose, TSH 0,55', stand: { profil: { osteoporose: 'ja' }, befund: bef(0.55) }, erwartet: { richtung: 'gleich', regel: 'D1b', stufe: 'termin' } },
  { name: 'D1b 60 J., Herz weiß nicht, TSH 0,5', stand: { profil: { herz: 'unbekannt' }, befund: bef(0.5) }, erwartet: { richtung: 'gleich', regel: 'D1b' } },
  { name: 'D1b 72 J., TSH 0,6 (unterer Randbereich bis 0,76)', stand: { profil: { geburtsjahr: geb(72) }, befund: bef(0.6) }, erwartet: { richtung: 'gleich', regel: 'D1b' } },
  { name: 'D1b 72 J., Labor 0,27–4,2, TSH 0,3', stand: { profil: { geburtsjahr: geb(72) }, befund: bef(tsh(0.3, { von: 0.27, bis: 4.2 })) }, erwartet: { richtung: 'gleich', regel: 'D1b' } },
  { name: 'D1b Grenze: 72 J., TSH 0,8', stand: { profil: { geburtsjahr: geb(72) }, befund: bef(0.8) }, erwartet: { richtung: 'gleich', regel: 'D1', ohneRegel: 'D1b' } },
  { name: 'D1b nicht mit Zielbereich', stand: { profil: { geburtsjahr: geb(72), zielVon: 0.3, zielBis: 2 }, befund: bef(0.5) }, erwartet: { richtung: 'gleich', ohneRegel: 'D1b' } },

  // ================================================================ D2a – Muster c im Alter: so lassen (+ X6, X7)
  { name: 'D2a 70 J., TSH 6,0', stand: { profil: { geburtsjahr: geb(70) }, befund: bef(6) }, erwartet: { richtung: 'gleich', regel: 'D2a', stufe: 'termin', pflicht: 'kurz', text: [/bewusst hingenommen/] } },
  { name: 'D2a 80 J., TSH 7,0', stand: { profil: { geburtsjahr: geb(80) }, befund: bef(7) }, erwartet: { richtung: 'gleich', regel: 'D2a', stufe: 'termin' } },
  { name: 'D2a Grenze: 69 J., TSH 5,0 → D2b', stand: { profil: { geburtsjahr: geb(69) }, befund: bef(5) }, erwartet: { richtung: 'mehr', ohneRegel: 'D2a', stufe: 'termin', warnzeichen: true } },
  {
    name: 'D2a/X7 79 J., TSH 6,5: D2b-Wortlaut statt „zu hoch"',
    stand: { profil: { geburtsjahr: geb(79) }, befund: bef(6.5) },
    erwartet: { richtung: 'mehr', ohneRegel: 'D2a', text: [/nachgemessen|nachmessen/, /entscheidet die Praxis/], ohne: [/zu hoch/, /12,5 bis 25/], warnzeichen: true },
  },
  {
    name: 'D2a/X7 80 J., TSH 7,1: D2b-Wortlaut',
    stand: { profil: { geburtsjahr: geb(80) }, befund: bef(7.1) },
    erwartet: { richtung: 'mehr', ohne: [/zu hoch/, /12,5 bis 25/], warnzeichen: true },
  },
  {
    name: 'D2c/X7 72 J., TSH 8: D2b-Wortlaut',
    stand: { profil: { geburtsjahr: geb(72) }, befund: bef(8) },
    erwartet: { richtung: 'mehr', ohne: [/zu hoch/, /12,5 bis 25/], text: [/nachgemessen|nachmessen/], warnzeichen: true },
  },
  {
    // MEHRDEUTIG: X7 „ab 70 (oder vorsichtig) … zwischen der D2a-Grenze und
    // 10" – unter 70 gibt es keine D2a-Grenze; gelesen als 6,0 mU/l.
    name: 'D2c/X7 60 J. mit Herzkrankheit, TSH 8: D2b-Wortlaut',
    stand: { profil: { herz: 'ja' }, befund: bef(8) },
    erwartet: { richtung: 'mehr', ohne: [/zu hoch/, /12,5 bis 25/], warnzeichen: true },
  },
  { name: 'D2a/X7 83 J. mit Herzkrankheit, TSH 7,4: klären, Termin', stand: { profil: { geburtsjahr: geb(83), herz: 'ja' }, befund: bef(7.4) }, erwartet: { richtung: 'klaeren', stufe: 'termin' } },
  // MEHRDEUTIG: X7 sagt „mit Herzkrankheit"; Grundsatz 3 zählt „weiß nicht" als Herzkrankheit.
  { name: 'D2a/X7 83 J., Herz weiß nicht, TSH 7,4: klären', stand: { profil: { geburtsjahr: geb(83), herz: 'unbekannt' }, befund: bef(7.4) }, erwartet: { richtung: 'klaeren' } },
  {
    name: 'D2c 83 J. mit Herzkrankheit, TSH 10,5: kleiner Schritt, Tage',
    stand: { profil: { geburtsjahr: geb(83), herz: 'ja' }, befund: bef(10.5) },
    erwartet: { richtung: 'mehr', stufe: 'tage', schritt: 'klein', warnzeichen: true },
  },
  { name: 'D2a/X6 Muster c ohne Geburtsjahr (TSH 5)', stand: { profil: { geburtsjahr: null }, befund: bef(5) }, erwartet: { frage: 'geburtsjahr', keineRichtung: true } },
  { name: 'D2a/X6 Muster c ohne Geburtsjahr (TSH 12)', stand: { profil: { geburtsjahr: null }, befund: bef(12) }, erwartet: { frage: 'geburtsjahr', keineRichtung: true } },
  { name: 'D2a entfällt mit Zielbereich (75 J., TSH 3 > Ziel 0,5–2,5)', stand: { profil: { geburtsjahr: geb(75), zielVon: 0.5, zielBis: 2.5 }, befund: bef(3) }, erwartet: { richtung: 'mehr', ohneRegel: 'D2a' } },

  // ================================================================ D2b – leicht erhöht, Graubereich bis 1,5 × OG
  {
    name: 'D2b TSH 5,0 (60 J.)',
    stand: { befund: bef(5) },
    erwartet: { richtung: 'mehr', regel: 'D2b', stufe: 'termin', pflicht: 'lang', text: [/leicht erhöht/, /12,5 µg/], ohne: [/12,5 bis 25/] },
  },
  { name: 'D2b Grenze: TSH 6,0 = 1,5 × OG', stand: { befund: bef(6) }, erwartet: { richtung: 'mehr', regel: 'D2b', stufe: 'termin', ohneRegel: 'D2c' } },
  {
    name: 'D2b Zusatz Vorbefund (schon vor 100 Tagen erhöht): zeitnah',
    stand: { vorbefunde: [vorbefund('b0', plus(BEFUND, -100), 5.5)], befund: bef(5) },
    erwartet: { richtung: 'mehr', stufe: 'zeitnah', text: [re(kurz(plus(BEFUND, -100))), /Zweimal erhöht/] },
  },
  {
    name: 'D2b Vorbefund erst 30 Tage vorher: kein Zusatz',
    stand: { vorbefunde: [vorbefund('b0', plus(BEFUND, -30), 5.5)], befund: bef(5) },
    erwartet: { richtung: 'mehr', stufe: 'termin', ohne: [/Zweimal erhöht/] },
  },
  { name: 'D2b/X5 66 J.: 112-Zeichen direkt dabei', stand: { profil: { geburtsjahr: geb(66) }, befund: bef(5) }, erwartet: { richtung: 'mehr', warnzeichen: true, text: [/112/] } },

  // ================================================================ D2c – zu hoch (+ DV Schrittgröße)
  {
    name: 'D2c TSH 8 (60 J., 75 µg)',
    stand: { befund: bef(8) },
    erwartet: { richtung: 'mehr', regel: 'D2c', stufe: 'zeitnah', schritt: 'normal', pflicht: 'lang', text: [/zu hoch/, /etwas höhere Dosis/] },
  },
  { name: 'D2c Grenze: TSH 6,1', stand: { befund: bef(6.1) }, erwartet: { richtung: 'mehr', regel: 'D2c', stufe: 'zeitnah', text: [/zu hoch/] } },
  { name: 'D2c Grenze: TSH 10 zeitnah', stand: { befund: bef(10) }, erwartet: { richtung: 'mehr', stufe: 'zeitnah' } },
  { name: 'D2c TSH 10,1: Tage', stand: { befund: bef(10.1) }, erwartet: { richtung: 'mehr', stufe: 'tage', text: [/in den nächsten Tagen/] } },
  // DV: vorsichtig := Alter ≥ 65 ODER Geburtsjahr fehlt ODER herz ∈ {ja, unbekannt, ''}.
  { name: 'DV 64 J., TSH 12: normaler Schritt', stand: { profil: { geburtsjahr: geb(64) }, befund: bef(12) }, erwartet: { richtung: 'mehr', schritt: 'normal' } },
  { name: 'DV 65 J., TSH 12: kleiner Schritt', stand: { profil: { geburtsjahr: geb(65) }, befund: bef(12) }, erwartet: { richtung: 'mehr', schritt: 'klein', warnzeichen: true, text: [/kleinen Schritten/, /65/] } },
  { name: 'DV Herzkrankheit, TSH 12: kleiner Schritt', stand: { profil: { herz: 'ja' }, befund: bef(12) }, erwartet: { richtung: 'mehr', schritt: 'klein', warnzeichen: true, text: [/Herz(krankheit|erkrankung)/] } },
  { name: 'DV Herz weiß nicht, TSH 12: kleiner Schritt', stand: { profil: { herz: 'unbekannt' }, befund: bef(12) }, erwartet: { richtung: 'mehr', schritt: 'klein', warnzeichen: true } },
  { name: 'DV Herz nicht angegeben, TSH 12: kleiner Schritt', stand: { profil: { herz: '' }, befund: bef(12) }, erwartet: { richtung: 'mehr', schritt: 'klein', warnzeichen: true, text: [/im Profil/] } },
  { name: 'DV Tagesdosis 50 µg: kleiner Schritt', stand: { befund: bef(8), dosen: [dosis('d1', DOSIS_AB, 50)] }, erwartet: { richtung: 'mehr', schritt: 'klein' } },
  { name: 'DV ½ × 100 µg = 50 µg am Tag: kleiner Schritt', stand: { befund: bef(8), dosen: [dosis('d1', DOSIS_AB, 100, { tabletten: 0.5 })] }, erwartet: { richtung: 'mehr', schritt: 'klein' } },
  { name: 'DV 2 × 25 µg = 50 µg am Tag: kleiner Schritt', stand: { befund: bef(8), dosen: [dosis('d1', DOSIS_AB, 25, { tabletten: 2 })] }, erwartet: { richtung: 'mehr', schritt: 'klein' } },
  { name: 'DV Tagesdosis 62,5 µg: normaler Schritt', stand: { befund: bef(8), dosen: [dosis('d1', DOSIS_AB, 62.5)] }, erwartet: { richtung: 'mehr', schritt: 'normal' } },

  // ================================================================ D2d (+ X9) – hohe Dosis, Aufnahme klären
  {
    name: 'D2d 175 µg, TSH 8',
    stand: { befund: bef(8), dosen: [dosis('d1', DOSIS_AB, 175)] },
    erwartet: { richtung: 'klaeren', regel: 'D2d', stufe: 'zeitnah', text: [Z, /nicht selbst mehr/], ohne: [/spricht für eine etwas höhere Dosis/] },
  },
  { name: 'D2d Grenze: 150 µg bei 100 kg (1,5 µg/kg)', stand: { befund: bef(8), dosen: [dosis('d1', DOSIS_AB, 150)], gewicht: [{ id: 'g1', datum: plus(HEUTE, -30), kg: 100 }] }, erwartet: { richtung: 'mehr', ohneRegel: 'D2d' } },
  { name: 'D2d 150 µg bei 90 kg (1,67 µg/kg)', stand: { befund: bef(8), dosen: [dosis('d1', DOSIS_AB, 150)], gewicht: [{ id: 'g1', datum: plus(HEUTE, -30), kg: 90 }] }, erwartet: { richtung: 'klaeren', regel: 'D2d' } },
  { name: 'D2d/X9a Grenze: ohne Gewicht 125 µg (60 J.)', stand: { befund: bef(8), dosen: [dosis('d1', DOSIS_AB, 125)] }, erwartet: { richtung: 'mehr', ohneRegel: 'D2d' } },
  { name: 'D2d/X9a ohne Gewicht 137,5 µg (60 J.)', stand: { befund: bef(8), dosen: [dosis('d1', DOSIS_AB, 137.5)] }, erwartet: { richtung: 'klaeren', regel: 'D2d', text: [Z] } },
  { name: 'D2d/X9a Grenze: ohne Gewicht 100 µg (66 J.)', stand: { profil: { geburtsjahr: geb(66) }, befund: bef(8), dosen: [dosis('d1', DOSIS_AB, 100)] }, erwartet: { richtung: 'mehr', ohneRegel: 'D2d' } },
  { name: 'D2d/X9a ohne Gewicht 112,5 µg (66 J.)', stand: { profil: { geburtsjahr: geb(66) }, befund: bef(8), dosen: [dosis('d1', DOSIS_AB, 112.5)] }, erwartet: { richtung: 'klaeren', regel: 'D2d' } },
  { name: 'D2d/X9b 66 J., 112,5 µg bei 80 kg (1,41 µg/kg)', stand: { profil: { geburtsjahr: geb(66) }, befund: bef(8), dosen: [dosis('d1', DOSIS_AB, 112.5)], gewicht: [{ id: 'g1', datum: plus(HEUTE, -30), kg: 80 }] }, erwartet: { richtung: 'klaeren', regel: 'D2d' } },
  { name: 'D2d/X9b Grenze: 66 J., 112,5 µg bei 90 kg (1,25 µg/kg)', stand: { profil: { geburtsjahr: geb(66) }, befund: bef(8), dosen: [dosis('d1', DOSIS_AB, 112.5)], gewicht: [{ id: 'g1', datum: plus(HEUTE, -30), kg: 90 }] }, erwartet: { richtung: 'mehr', ohneRegel: 'D2d' } },
  {
    name: 'D2d/X9c in 12 Monaten zweimal erhöht',
    stand: { befund: bef(8), dosen: [dosis('d1', DOSIS_AB, 50), dosis('d2', plus(HEUTE, -300), 62.5), dosis('d3', plus(HEUTE, -150), 75)] },
    erwartet: { richtung: 'klaeren', regel: 'D2d', text: [Z] },
  },
  {
    name: 'D2d/X9c nur einmal erhöht',
    stand: { befund: bef(8), dosen: [dosis('d1', DOSIS_AB, 62.5), dosis('d2', plus(HEUTE, -150), 75)] },
    erwartet: { richtung: 'mehr', ohneRegel: 'D2d' },
  },
  { name: 'D2d/X9d Durchfall bei Muster c', stand: { befund: bef(8), befinden: [bf(-10, ['durchfall'])] }, erwartet: { richtung: 'klaeren', regel: 'D2d', text: [Z] } },
  { name: 'D2d/X9d ungewollt abgenommen bei Muster c', stand: { befund: bef(8), befinden: [bf(-20, ['abnahme'])] }, erwartet: { richtung: 'klaeren', regel: 'D2d' } },
  { name: 'D2d/X9d Durchfall bei Muster e: nicht', stand: { befund: bef(0.2), befinden: [bf(-10, ['durchfall'])] }, erwartet: { richtung: 'weniger', ohneRegel: 'D2d' } },
  { name: 'D2d bei Muster b: Tage', stand: { befund: bef(15, 8), dosen: [dosis('d1', DOSIS_AB, 175)] }, erwartet: { richtung: 'klaeren', regel: 'D2d', stufe: 'tage' } },

  // ================================================================ D3 – Muster b: klar zu wenig (Stufe immer Tage)
  {
    name: 'D3 TSH 15, fT4 8 (60 J.)',
    stand: { befund: bef(15, 8) },
    erwartet: {
      richtung: 'mehr', regel: 'D3', stufe: 'tage', schritt: 'normal', pflicht: 'lang',
      text: [/klar dafür/, /nicht auf eigene Faust mehr/, /in den nächsten Tagen/], ohne: [/spricht deutlich/],
    },
  },
  { name: 'D3 TSH 5, fT4 10: trotzdem Tage (Entscheidung 8)', stand: { befund: bef(5, 10) }, erwartet: { richtung: 'mehr', regel: 'D3', stufe: 'tage' } },
  { name: 'D3/DV 66 J.: kleiner Schritt, W-D2', stand: { profil: { geburtsjahr: geb(66) }, befund: bef(15, 8) }, erwartet: { richtung: 'mehr', schritt: 'klein', warnzeichen: true } },
  { name: 'D3/DV/P5 ohne Geburtsjahr: kleiner Schritt und Hinweis', stand: { profil: { geburtsjahr: null }, befund: bef(15, 8) }, erwartet: { richtung: 'mehr', schritt: 'klein', text: [/Geburtsjahr/] } },
  { name: 'D3 fT4 ohne Laborbereich (Orientierung)', stand: { befund: bef(15, ft4(8, { von: null, bis: null })) }, erwartet: { richtung: 'mehr', regel: 'D3' } },
  { name: 'D3/W-D3 Grenze: TSH 20 ohne Warnzeichen-Check', stand: { befund: bef(20, 8) }, erwartet: { richtung: 'mehr', frage: false } },

  // ================================================================ D4a – leicht zu niedrig, ohne Risiko
  {
    name: 'D4a TSH 0,2 (60 J., kein Herz, keine Osteoporose)',
    stand: { befund: bef(0.2) },
    erwartet: {
      richtung: 'weniger', regel: 'D4a', stufe: 'termin', pflicht: 'lang',
      text: [/leicht zu niedrig/, /nicht zusätzlich|auch geteilt/], ohne: [/teilen Sie keine\s*\./],
    },
  },
  { name: 'D4a Grenze: 64 J.', stand: { profil: { geburtsjahr: geb(64) }, befund: bef(0.2) }, erwartet: { richtung: 'weniger', regel: 'D4a' } },
  { name: 'D4a Grenze: TSH 0,1', stand: { befund: bef(0.1) }, erwartet: { richtung: 'weniger', regel: 'D4a' } },
  { name: 'D4a/X10 1½ Tabletten: Menge genannt', stand: { befund: bef(0.2), dosen: [dosis('d1', DOSIS_AB, 50, { tabletten: 1.5 })] }, erwartet: { richtung: 'weniger', text: [/1½ Tabletten/] } },

  // ================================================================ D4b – zu niedrig
  { name: 'D4b Grenze: 65 J.', stand: { profil: { geburtsjahr: geb(65) }, befund: bef(0.2) }, erwartet: { richtung: 'weniger', regel: 'D4b', ohneRegel: 'D4a', stufe: 'zeitnah' } },
  { name: 'D4b Grenze: TSH 0,09 → Tage', stand: { befund: bef(0.09) }, erwartet: { richtung: 'weniger', regel: 'D4b', stufe: 'tage' } },
  { name: 'D4b Herz weiß nicht', stand: { profil: { herz: 'unbekannt' }, befund: bef(0.2) }, erwartet: { richtung: 'weniger', regel: 'D4b', stufe: 'zeitnah' } },
  { name: 'D4b Osteoporose weiß nicht', stand: { profil: { osteoporose: 'unbekannt' }, befund: bef(0.2) }, erwartet: { richtung: 'weniger', regel: 'D4b', stufe: 'zeitnah' } },
  { name: 'D4b Osteoporose nicht angegeben', stand: { profil: { osteoporose: '' }, befund: bef(0.2) }, erwartet: { richtung: 'weniger', regel: 'D4b' } },
  { name: 'D4b/P5 ohne Geburtsjahr', stand: { profil: { geburtsjahr: null }, befund: bef(0.2) }, erwartet: { richtung: 'weniger', regel: 'D4b', text: [/Geburtsjahr/] } },
  {
    name: 'D4b 70 J., 75 µg',
    stand: { profil: { geburtsjahr: geb(70) }, befund: bef(0.2) },
    erwartet: {
      richtung: 'weniger', regel: 'D4b', stufe: 'zeitnah', schritt: 'weniger', pflicht: 'lang',
      text: [/zu niedrig/, /etwas niedrigere Dosis/, /Gerade im Alter/, /nicht zusätzlich|auch geteilt/], ohne: [/teilen Sie keine\s*\./],
    },
  },
  { name: 'D4b/DV 70 J., 50 µg: kleiner Schritt', stand: { profil: { geburtsjahr: geb(70) }, befund: bef(0.2), dosen: [dosis('d1', DOSIS_AB, 50)] }, erwartet: { richtung: 'weniger', schritt: 'wenigerKlein' } },
  { name: 'D4b 60 J. mit Osteoporose: zeitnah', stand: { profil: { osteoporose: 'ja' }, befund: bef(0.2) }, erwartet: { richtung: 'weniger', regel: 'D4b', stufe: 'zeitnah', text: [/Gerade/] } },
  {
    // MEHRDEUTIG: D4b setzt „innerhalb von ein bis zwei Wochen" in den Text,
    // bei TSH < 0,1 aber Stufe Tage. Sicherer: dann keine längere Frist nennen.
    name: 'D4b 60 J. ohne Risiko, TSH 0,05: Tage, ohne Alterssatz',
    stand: { befund: bef(0.05) },
    erwartet: { richtung: 'weniger', regel: 'D4b', stufe: 'tage', text: [/in den nächsten Tagen/], ohne: [/Gerade im Alter/, /innerhalb von ein bis zwei Wochen/] },
  },
  { name: 'D4b 70 J., TSH 0,05: Tage', stand: { profil: { geburtsjahr: geb(70) }, befund: bef(0.05) }, erwartet: { richtung: 'weniger', stufe: 'tage' } },
  {
    name: 'D4b/X10 ½ Tablette zu 150 µg: „weiter ½ Tablette"',
    stand: { profil: { geburtsjahr: geb(70) }, befund: bef(0.2), dosen: [dosis('d1', DOSIS_AB, 150, { tabletten: 0.5 })] },
    erwartet: { richtung: 'weniger', schritt: 'weniger', text: [/½ Tablette/] },
  },

  // ================================================================ D5 – Muster d (+ Q5/X15, F1)
  {
    name: 'D5 TSH 0,05, fT4 30 (60 J.)',
    stand: { befund: bef(0.05, 30) },
    erwartet: {
      richtung: 'weniger', regel: 'D5', stufe: 'tage', schritt: 'weniger', pflicht: 'lang', warnzeichen: true,
      text: [/fT4 zu hoch/, /niedrigere Dosis/, /in den nächsten Tagen/, /keine Tage weg/, /nicht zusätzlich|auch geteilt/],
    },
  },
  { name: 'D5/DV 50 µg: kleiner Schritt', stand: { befund: bef(0.05, 30), dosen: [dosis('d1', DOSIS_AB, 50)] }, erwartet: { richtung: 'weniger', schritt: 'wenigerKlein' } },
  { name: 'D5 Q5 offen', stand: { befund: bef(0.05, 30, { verwechselt: '' }) }, erwartet: { frage: 'verwechselt', keineRichtung: true } },
  {
    name: 'D5/X15 Q5 „einmal viele auf einmal": heute, Giftnotruf',
    stand: { befund: bef(0.05, 30, { verwechselt: 'einmal' }) },
    erwartet: { richtung: 'klaeren', stufeMin: 'heute', text: [/Giftnotruf/] },
  },
  {
    name: 'D5/X15 Q5 „über Tage falsche Stärke": Text X, Tage',
    stand: { befund: bef(0.05, 30, { verwechselt: 'tage' }) },
    erwartet: { richtung: 'klaeren', stufeMin: 'tage', text: [/verordnete Stärke/] },
  },
  { name: 'D5 Q5 „weiß nicht": Text Y und weiter', stand: { befund: bef(0.05, 30, { verwechselt: 'unbekannt' }) }, erwartet: { richtung: 'weniger', text: [/Packung/] } },
  { name: 'D5/X3 Q5 auch bei Muster e: offen', stand: { befund: bef(0.2, 15, { verwechselt: '' }) }, erwartet: { frage: 'verwechselt', keineRichtung: true } },
  { name: 'D5/X3/X15 Q5 bei Muster e „einmal"', stand: { befund: bef(0.2, 15, { verwechselt: 'einmal' }) }, erwartet: { richtung: 'klaeren', stufeMin: 'heute' } },
  { name: 'D5/X3 Q5 bei Muster e „über Tage"', stand: { befund: bef(0.2, 15, { verwechselt: 'tage' }) }, erwartet: { richtung: 'klaeren', stufeMin: 'tage' } },
  {
    // MEHRDEUTIG: „wie D4a/D4b behandeln" – ob die Stufe von D4a (Termin) oder
    // die Musterstufe d (Tage) gilt, sagt D5 nicht; die Stufe wird hier nicht geprüft.
    name: 'D5 F1: fT4 25 ≤ 1,2 × OG, Tablette vor der Abnahme → wie D4',
    stand: { befund: bef(0.2, 25, { vorAbnahme: 'ja' }) },
    erwartet: { richtung: 'weniger', ohneRegel: 'D5', text: [/Tablette war vor der Abnahme/] },
  },
  { name: 'D5 F1 Grenze: fT4 26,5 > 1,2 × OG → D5', stand: { befund: bef(0.2, 26.5, { vorAbnahme: 'ja' }) }, erwartet: { richtung: 'weniger', regel: 'D5', stufe: 'tage', warnzeichen: true } },
  {
    name: 'D5 Zusatz Unruhe (Herzklopfen, Check ohne Befund)',
    stand: { befund: bef(0.05, 30), befinden: [bf(-3, ['herz'])], warnzeichen: [wc(0)] },
    erwartet: { richtung: 'weniger', text: [/heute oder morgen/] },
  },

  // ================================================================ W-D1 (+ X1, X4) – Herz, Schwitzen, Puls, Zittern in 14 Tagen
  { name: 'W-D1/X1 Herzklopfen bei Muster a', stand: { befund: bef(2), befinden: [bf(-3, ['herz'])] }, erwartet: { frage: 'warncheck', ohneRichtung: true } },
  { name: 'W-D1/X1 Puls unregelmäßig bei Muster c', stand: { befund: bef(8), befinden: [bf(-3, ['puls'])] }, erwartet: { frage: 'warncheck', ohneRichtung: true } },
  { name: 'W-D1/X1 Zittern bei Muster e', stand: { befund: bef(0.2), befinden: [bf(-3, ['zittern'])] }, erwartet: { frage: 'warncheck', ohneRichtung: true } },
  { name: 'W-D1 Schwitzen bei Muster d', stand: { befund: bef(0.05, 30), befinden: [bf(-3, ['schwitzen'])] }, erwartet: { frage: 'warncheck', ohneRichtung: true } },
  { name: 'W-D1/X1 Herzklopfen bei Muster f', stand: { befund: bef(6, 23), befinden: [bf(-3, ['herz'])] }, erwartet: { frage: 'warncheck' } },
  { name: 'W-D1 Grenze: Schwitzen vor 13 Tagen', stand: { befund: bef(8), befinden: [bf(-13, ['schwitzen'])] }, erwartet: { frage: 'warncheck', ohneRichtung: true } },
  { name: 'W-D1 Grenze: Schwitzen vor 14 Tagen zählt nicht', stand: { befund: bef(8), befinden: [bf(-14, ['schwitzen'])] }, erwartet: { richtung: 'mehr', frage: false } },
  { name: 'W-D1/X1 auch bei D0-Sperre (Biotin)', stand: { befund: bef(2, 15, { biotin: 'ja' }), befinden: [bf(-3, ['herz'])] }, erwartet: { frage: 'warncheck' } },
  { name: 'W-D1 Check heute „Nichts davon": Richtung', stand: { befund: bef(8), befinden: [bf(-3, ['herz'])], warnzeichen: [wc(0)] }, erwartet: { richtung: 'mehr', frage: false } },
  // MEHRDEUTIG: Ob ein Check von gestern noch zählt, sagt W-D1 nicht; wie in
  // der Gesamteinschätzung (Entscheidung 17) zählt nur ein Check von heute.
  { name: 'W-D1 Check von gestern zählt nicht', stand: { befund: bef(8), befinden: [bf(-3, ['herz'])], warnzeichen: [wc(-1)] }, erwartet: { frage: 'warncheck', ohneRichtung: true } },
  // Eindeutig: Ein Check vor dem Eintrag kann die neue Beschwerde nicht erfasst haben.
  { name: 'W-D1 Check vor dem Eintrag zählt nicht', stand: { befund: bef(8), befinden: [bf(-3, ['herz'])], warnzeichen: [wc(-5)] }, erwartet: { frage: 'warncheck', ohneRichtung: true } },
  {
    name: 'W-D1 Check heute mit 112-Zeichen: nur Notruf',
    stand: { befund: bef(8), befinden: [bf(-3, ['herz'])], warnzeichen: [wc(0, [W_112])] },
    erwartet: { ohneRichtung: true, stufe: 'notruf' },
  },
  {
    name: 'W-D1/X4 Check Stufe Tage bei Muster c: klären',
    stand: { befund: bef(8), befinden: [bf(-3, ['herz'])], warnzeichen: [wc(0, [W_TAGE])] },
    erwartet: { richtung: 'klaeren', stufeMin: 'tage', text: [/Herz und Puls/] },
  },
  {
    name: 'W-D1/X4 Check Stufe Tage bei Muster b: klären',
    stand: { befund: bef(15, 8), befinden: [bf(-3, ['herz'])], warnzeichen: [wc(0, [W_TAGE])] },
    erwartet: { richtung: 'klaeren', stufeMin: 'tage' },
  },
  {
    name: 'W-D1/X4 Check Stufe Tage bei Muster e: „weniger" bleibt',
    stand: { befund: bef(0.2), befinden: [bf(-3, ['herz'])], warnzeichen: [wc(0, [W_TAGE])] },
    erwartet: { richtung: 'weniger', stufeMin: 'tage' },
  },
  {
    name: 'W-D1/X1 Puls unregelmäßig bei Muster a: mindestens Tage',
    stand: { befund: bef(2), befinden: [bf(-3, ['puls'])], warnzeichen: [wc(0)] },
    erwartet: { stufeMin: 'tage', text: [/unregelmäßiger Puls/] },
  },
  // MEHRDEUTIG: X4 spricht von „Stufe tage" des Checks; ein neu
  // unregelmäßiger Puls hebt nach X1 ebenfalls auf Tage – sicherer: auch dann
  // kein „mehr" bei Muster b/c.
  { name: 'W-D1/X1/X4 Puls unregelmäßig bei Muster c: kein „mehr"', stand: { befund: bef(8), befinden: [bf(-3, ['puls'])], warnzeichen: [wc(0)] }, erwartet: { keineRichtung: true, stufeMin: 'tage' } },

  // ================================================================ W-D3 – Muster b, TSH > 20 oder müde/frieren/Konzentration
  { name: 'W-D3 Muster b, TSH 25', stand: { befund: bef(25, 8) }, erwartet: { frage: 'warncheck', ohneRichtung: true } },
  { name: 'W-D3 Muster b, TSH 25, Check heute ohne Befund: D3', stand: { befund: bef(25, 8), warnzeichen: [wc(0)] }, erwartet: { richtung: 'mehr', regel: 'D3', stufe: 'tage' } },
  { name: 'W-D3 Muster b, TSH 25, Check heute „verwirrt/112"', stand: { befund: bef(25, 8), warnzeichen: [wc(0, [W_112])] }, erwartet: { ohneRichtung: true, stufe: 'notruf' } },
  { name: 'W-D3 Muster b, frieren vor 5 Tagen', stand: { befund: bef(15, 8), befinden: [bf(-5, ['frieren'])] }, erwartet: { frage: 'warncheck', ohneRichtung: true } },
  { name: 'W-D3 Muster b, Konzentration', stand: { befund: bef(15, 8), befinden: [bf(-5, ['konzentration'])] }, erwartet: { frage: 'warncheck', ohneRichtung: true } },
  { name: 'W-D3 Muster b, müde vor 20 Tagen zählt nicht', stand: { befund: bef(15, 8), befinden: [bf(-20, ['muede'])] }, erwartet: { richtung: 'mehr', frage: false } },
  { name: 'W-D3 nur bei Muster b: c mit TSH 25', stand: { befund: bef(25, 15) }, erwartet: { richtung: 'mehr', frage: false, stufe: 'tage' } },

  // ================================================================ X3 – tatsächlich genommene Dosis, 14 Tage
  {
    name: 'X3 Pflichtfrage „genau 75 µg?" offen',
    stand: { befund: bef(8), nachfragen: [] },
    erwartet: { frage: true, keineRichtung: true, extra: [['Frage nennt die eingetragene Dosis', (r) => /genau/.test(str(r.frage && r.frage.text)) && /75 µg/.test(str(r.frage && r.frage.text))]] },
  },
  { name: 'X3 Antwort „nein, ich nehme etwas anderes"', stand: { befund: bef(8), nachfragen: [dosisStimmt('b1', HEUTE, 'nein')] }, erwartet: { keineRichtung: true } },
  // MEHRDEUTIG: X3 „auch vor so lassen"? „Vor jeder Richtung" – sicherer: ja.
  { name: 'X3 Pflichtfrage auch vor „so lassen"', stand: { befund: bef(2), nachfragen: [] }, erwartet: { frage: true, keineRichtung: true } },
  // MEHRDEUTIG: Die 14 Tage zählen ab der Antwort auf die X3-Frage (dann
  // zeigt die Karte die Richtung zum ersten Mal); am 14. Tag kommt sicherer
  // schon die Rückfrage. ANNAHME: Anker ist nachfragen[dosis_stimmt].am –
  // speichert die Umsetzung den ersten Anzeigetag anders, sind nur diese
  // vier Fälle anzupassen.
  {
    name: 'X3 Richtung am 13. Tag nach der Antwort',
    stand: { befund: bef(8, 15, { datum: plus(HEUTE, -20) }), nachfragen: [dosisStimmt('b1', plus(HEUTE, -13))] },
    erwartet: { richtung: 'mehr' },
  },
  {
    name: 'X3 am 14. Tag: Rückfrage statt Richtung',
    stand: { befund: bef(8, 15, { datum: plus(HEUTE, -20) }), nachfragen: [dosisStimmt('b1', plus(HEUTE, -14))] },
    erwartet: { frage: true, keineRichtung: true },
  },
  {
    name: 'X3 nach 19 Tagen: Rückfrage vor „mehr"',
    stand: { befund: bef(8, 15, { datum: plus(HEUTE, -20) }), nachfragen: [dosisStimmt('b1', plus(HEUTE, -19))] },
    erwartet: { frage: true, keineRichtung: true },
  },
  {
    name: 'X3 nach 19 Tagen: Rückfrage vor „weniger"',
    stand: { befund: bef(0.2, 15, { datum: plus(HEUTE, -20) }), nachfragen: [dosisStimmt('b1', plus(HEUTE, -19))] },
    erwartet: { frage: true, keineRichtung: true },
  },

  // ================================================================ DG – Grundlage
  {
    name: 'DG Grundlage bei „mehr" (Labor 0,27–4,2)',
    stand: { befund: bef(tsh(7.2, { von: 0.27, bis: 4.2 }), 14) },
    erwartet: {
      richtung: 'mehr',
      extra: [
        ['Grundlage nennt das Befunddatum', (r) => str(r.grundlage).includes(kurz(BEFUND))],
        ['Grundlage nennt TSH mit Einheit', (r) => /TSH[^.]*7,2\s*mU\/l/.test(str(r.grundlage))],
        ['Grundlage nennt den Laborbereich', (r) => /0,27\s*(–|-|bis)\s*4,2/.test(str(r.grundlage))],
        ['Grundlage nennt fT4 mit Einheit', (r) => /fT4[^.]*14\s*pmol\/l/.test(str(r.grundlage))],
        ['Grundlage nennt „75 µg am Tag seit 01.01.2025"', (r) => str(r.grundlage).includes(`75 µg am Tag seit ${kurz(DOSIS_AB)}`)],
        ['Grundlage: die Entscheidung trifft die Praxis', (r) => /Entscheidung trifft die Praxis/.test(str(r.grundlage))],
      ],
    },
  },
  {
    name: 'DG Grundlage mit Zielbereich der Ärztin',
    stand: { profil: { zielVon: 1.5, zielBis: 3.5 }, befund: bef(2) },
    erwartet: {
      richtung: 'gleich',
      extra: [['Grundlage nennt den Zielbereich', (r) => /Zielbereich/.test(str(r.grundlage)) && /1,5\s*(–|-|bis)\s*3,5/.test(str(r.grundlage))]],
    },
  },
  {
    name: 'DG Grundlage auch bei „klären"',
    stand: { befund: bef(8, 15, { biotin: 'ja' }) },
    erwartet: { richtung: 'klaeren', extra: [['Grundlage steht auch bei klaeren', (r) => str(r.grundlage).includes(`Befund vom ${kurz(BEFUND)}`)]] },
  },
  // ================================================================ Review-Befunde: Regressionsfälle
  // Jeder Fall stand in einem nachgestellten Befund des Reviews (B21 …) und
  // scheiterte vor der Korrektur. Erwartet ist, was Regelwerk, rotes Team und
  // die Grundsätze verlangen: keine Richtung ohne Pflichttext, nie eine
  // niedrigere Frist als die Stufe der Karte, Notfallnummern anrufbar.

  // B21 – eine schon eingetragene künftige Dosis (D0.5 a kennt keine Obergrenze „heute").
  {
    name: 'B21 künftige Erhöhung (ab heute + 3) schon eingetragen: keine Richtung, D0.5 mit Datum',
    stand: { profil: { geburtsjahr: geb(72) }, befund: bef(7.5, 14), dosen: [dosis('d1', DOSIS_AB, 75), dosis('d2', plus(HEUTE, 3), 88)] },
    erwartet: { keineRichtung: true, regel: 'D0.5', text: [re(kurz(plus(HEUTE, 3)))], extra: [['Grundlage nennt die künftige Dosis', (r) => /88 µg am Tag/.test(str(r.grundlage))]] },
  },
  {
    name: 'B21 künftige Senkung 175 → 50 µg schon eingetragen: kein „weniger"',
    stand: { befund: bef(0.02, 18), dosen: [dosis('d1', DOSIS_AB, 175), dosis('d2', plus(HEUTE, 5), 50)] },
    erwartet: { keineRichtung: true, regel: 'D0.5' },
  },

  // B22 / B28 – nach „selbst geändert" nie „genau wie bisher weiter" und nie „Kein besonderer Anlass".
  {
    name: 'B22 selbst geändert (X3-14), 150 µg ab heute eingetragen (Quelle nein): Stufe bleibt, bisherige Menge',
    stand: {
      profil: { geburtsjahr: geb(78) }, befund: bef(12, 13, { datum: plus(HEUTE, -20) }),
      dosen: [dosis('d1', DOSIS_AB, 75), dosis('d2', HEUTE, 150, { praxis: false })],
      nachfragen: [dosisStimmt('b1', plus(HEUTE, -16)), nachfrage14('b1', HEUTE, 'selbst')],
    },
    erwartet: {
      keineRichtung: true, regel: 'X3', stufeMin: 'tage', text: [/bisherige Menge/], ohne: [/genau wie bisher weiter/],
      extra: [['keine Aktion mehr – der Eintrag ist da', (r) => r.aktion === null]],
    },
  },
  {
    name: 'B22 selbst geändert, Quelle offen: keine Entwarnung, keine Frage nach der Anordnung',
    stand: {
      profil: { geburtsjahr: geb(78) }, befund: bef(12, 13, { datum: plus(HEUTE, -20) }),
      dosen: [dosis('d1', DOSIS_AB, 75), dosis('d2', HEUTE, 150, { praxis: null })],
      nachfragen: [dosisStimmt('b1', plus(HEUTE, -16)), nachfrage14('b1', HEUTE, 'selbst')],
    },
    erwartet: { keineRichtung: true, stufeMin: 'tage', ohne: [/genau wie bisher weiter/, /Auf Anweisung der Praxis/] },
  },
  {
    name: 'B22 selbst geändert, noch nichts eingetragen: Knopf „Dosis eintragen"',
    stand: { befund: bef(12, 13, { datum: plus(HEUTE, -20) }), nachfragen: [dosisStimmt('b1', plus(HEUTE, -16)), nachfrage14('b1', HEUTE, 'selbst')] },
    erwartet: { keineRichtung: true, regel: 'X3', stufeMin: 'tage', ohne: [/genau wie bisher weiter/], extra: [['Aktion: neue Dosis', (r) => r.aktion === 'dosis' && r.aktionParam === null]] },
  },
  {
    name: 'B22 D0.18 (zeitnah) neben D0.5 (Praxis „bleibt"): die Stufe des Grundes bleibt',
    stand: {
      befund: bef(9, 13, { praxis: 'bleibt', praxisAm: HEUTE }),
      befinden: [bf(0, ['schwitzen', 'zittern', 'waerme', 'abnahme']), bf(-1, ['schwitzen', 'zittern', 'waerme', 'abnahme'])],
      warnzeichen: [wc(0)],
    },
    erwartet: { regel: ['D0.5', 'D0.18'], stufeMin: 'zeitnah' },
  },
  {
    name: 'B28 Q5 „über Tage falsche Stärke": kein „genau wie bisher weiter"',
    stand: { befund: bef(0.05, 30, { verwechselt: 'tage' }) },
    erwartet: { richtung: 'klaeren', regel: 'Q5', ohne: [/genau wie bisher weiter/], text: [/verordnete Stärke/] },
  },
  {
    name: 'B28 Notruf-Karte (Check „große Menge auf einmal"): kein „genau wie bisher weiter"',
    stand: { befund: bef(8), befinden: [bf(-3, ['herz'])], warnzeichen: [wc(0, ['packung'])] },
    erwartet: { stufe: 'notruf', ohne: [/genau wie bisher weiter/] },
  },

  // B24 – die Karte nennt nie eine niedrigere Stufe als das Muster.
  {
    name: 'B24 D2d bei TSH 25 (125 µg, 72 J.): Tage wie das Muster',
    stand: { profil: { geburtsjahr: geb(72) }, befund: bef(25), dosen: [dosis('d1', DOSIS_AB, 125)] },
    erwartet: { richtung: 'klaeren', regel: 'D2d', stufe: 'tage' },
  },
  { name: 'B24 D2d bei TSH 14 mit Durchfall: Tage', stand: { befund: bef(14), befinden: [bf(-10, ['durchfall'])] }, erwartet: { richtung: 'klaeren', regel: 'D2d', stufe: 'tage' } },
  {
    name: 'B24 TSH 10,8 bei Labor 0,4–7,5: kein Graubereich über 10',
    stand: { profil: { geburtsjahr: geb(72) }, befund: bef(tsh(10.8, { bis: 7.5 })) },
    erwartet: { richtung: 'mehr', regel: 'D2c', stufe: 'tage', text: [/in den nächsten Tagen/], ohne: [/leicht erhöht/] },
  },
  {
    name: 'B24 TSH 11,5 bei Zielbereich 1–8: Tage',
    stand: { profil: { zielVon: 1, zielBis: 8, zielAm: HEUTE }, befund: bef(11.5) },
    erwartet: { stufeMin: 'tage', ohne: [/leicht erhöht/] },
  },
  {
    name: 'B24 Muster d, Tablette vor der Abnahme (wie D4a): Stufe des Musters, keine längere Frist',
    stand: { befund: bef(0.2, 24, { vorAbnahme: 'ja' }) },
    erwartet: { richtung: 'weniger', stufeMin: 'tage', text: [/in den nächsten Tagen/], ohne: [/6 bis 8 Wochen nachgemessen/, /innerhalb von ein bis zwei Wochen/] },
  },

  // B25 / B61 – Herzklopfen und Puls: die Karte liegt nie unter S4, S4ii, R3.
  {
    name: 'B25 74 J., Muster e2, Herzklopfen gestern und heute, Check ohne Kreuz: heute wie S4ii',
    stand: { profil: { geburtsjahr: geb(74) }, befund: bef(0.2, 18), befinden: [bf(-1, ['herz']), bf(0, ['herz'])], warnzeichen: [wc(0)] },
    erwartet: { richtung: 'weniger', stufe: 'heute', text: [/heute noch/], ohne: [/innerhalb von ein bis zwei Wochen/, /in den nächsten Tagen/] },
  },
  {
    name: 'B25 76 J., Muster c2, Herzklopfen an zwei Tagen (R3 heute): kein „mehr"',
    stand: { profil: { geburtsjahr: geb(76) }, befund: bef(7.5, 14), befinden: [bf(-1, ['herz']), bf(0, ['herz'])], warnzeichen: [wc(0)] },
    erwartet: { keineRichtung: true, regel: 'X4', stufe: 'heute' },
  },
  {
    name: 'B25 82 J., unregelmäßiger Puls heute: heute wie S4',
    stand: { profil: { geburtsjahr: geb(82) }, befund: bef(2), befinden: [bf(0, ['puls'])], warnzeichen: [wc(0)] },
    erwartet: { stufe: 'heute', text: [/unregelmäßiger Puls/], ohne: [/in den nächsten Tagen/] },
  },

  // B26 / B63 – „Nein, ich nehme etwas anderes" sperrt nur, bis die Dosis berichtigt ist.
  {
    name: 'B26 „Nein" – danach 100 µg ab heute eingetragen: X3-Sperre fällt, keine Entwarnung',
    stand: { befund: bef(7), nachfragen: [dosisStimmt('b1', plus(HEUTE, -1), 'nein')], dosen: [dosis('d1', DOSIS_AB, 75), dosis('d2', HEUTE, 100, { praxis: null })] },
    erwartet: { keineRichtung: true, stufeMin: 'termin', ohne: [/Sie nehmen im Moment etwas anderes/, /genau wie bisher weiter/] },
  },
  {
    name: 'B63 „Nein" (bezogen auf 75 µg), Eintrag auf 100 µg berichtigt: Karte fragt neu',
    stand: { befund: bef(7), nachfragen: [dosisStimmt('b1', plus(HEUTE, -1), 'nein_75')], dosen: [dosis('d1', DOSIS_AB, 100)] },
    erwartet: { frage: true, keineRichtung: true, extra: [['fragt nach 100 µg', (r) => r.frage.id === 'X3' && /100 µg/.test(r.frage.text)]] },
  },
  {
    name: 'B63 „Nein", nichts berichtigt: Sperre mit Knopf zum Eintragen',
    stand: { befund: bef(7), nachfragen: [dosisStimmt('b1', plus(HEUTE, -1), 'nein_75')] },
    erwartet: { keineRichtung: true, regel: 'X3', extra: [['Aktion: Dosis eintragen', (r) => r.aktion === 'dosis']] },
  },
  {
    name: 'B63 die X3-Frage merkt sich im „Nein" die Menge',
    stand: { befund: bef(7), nachfragen: [] },
    erwartet: { frage: true, extra: [['Antwortwert nein_75', (r) => r.frage.optionen.some(([w]) => w === 'nein_75')]] },
  },

  // B27 / B46 – F8 „Die Dosis wird geändert" führt zum Dosis-Eintrag.
  {
    name: 'B27 F8 „Dosis wird geändert", noch keine neue Dosis: Knopf zur neuen Dosis (Praxis)',
    stand: { befund: bef(8, 15, { praxis: 'geaendert', praxisAm: HEUTE }), mittel: ['marcumar'] },
    erwartet: {
      richtung: 'klaeren', regel: 'D0.5', text: [/neue Dosis ein/], ohne: [/genau wie bisher weiter/],
      extra: [['Aktion: neue Dosis auf Anweisung der Praxis', (r) => r.aktion === 'dosis' && r.aktionParam === 'praxis']],
    },
  },
  {
    name: 'B27 F8 „geändert" und neue Dosis eingetragen: keine Aktion mehr',
    stand: { befund: bef(8, 15, { praxis: 'geaendert', praxisAm: HEUTE }), dosen: [dosis('d1', DOSIS_AB, 75), dosis('d2', HEUTE, 88)] },
    erwartet: { regel: 'D0.5', stufe: 'keine', extra: [['keine Aktion', (r) => r.aktion === null]] },
  },

  // B29 – Q4 auch bei „bewusst niedrig: nein", wenn die Ursache offen ist.
  {
    name: 'B29 Ursache unbekannt, „bewusst niedrig: nein", Q4 offen (e): Frage nach der Hirnanhangdrüse',
    stand: { profil: { ursache: 'unbekannt', zielNiedrig: 'nein', hypophyseOderNiedrig: '' }, befund: bef(0.15) },
    erwartet: { frage: 'hypophyseOderNiedrig', keineRichtung: true, extra: [['nennt die Hirnanhangdrüse', (r) => /Hirnanhangdrüse/.test(r.frage.text)]] },
  },

  // B30 – bei 12,5 µg am Tag kein Schritt, der das Absetzen bedeutet.
  {
    name: 'B30 12,5 µg am Tag (½ × 25 µg), TSH 0,05: keine Schrittzahl',
    stand: { profil: { geburtsjahr: geb(88), herz: 'ja' }, befund: bef(0.05), dosen: [dosis('d1', DOSIS_AB, 25, { tabletten: 0.5 })] },
    erwartet: { richtung: 'weniger', pflicht: 'lang', ohne: [/verringern dann meist um 12,5/], extra: [['Schritt ohne µg-Zahl', (r) => !/µg/.test(str(r.schritt))]] },
  },

  // B32 / B59 – Einrichten „ab heute" plus älterer Befund: kein erfundener Wechsel, keine Entwarnung.
  {
    name: 'B32 Dosis beim Einrichten ab heute, Befund älter: Beginn ändern statt neue Dosis',
    stand: { profil: { geburtsjahr: geb(78), herz: 'ja' }, befund: bef(0.08, 19), dosen: [dosis('d1', HEUTE, 75, { praxis: null })] },
    erwartet: {
      keineRichtung: true, regel: 'D0.16', stufeMin: 'tage', text: [/Gilt ab/], ohne: [/wie viel Sie im Moment nehmen/],
      extra: [['Knopf ändert den Eintrag d1', (r) => r.aktion === 'dosis' && r.aktionParam === 'd1']],
    },
  },
  {
    name: 'B59 dieselbe Dosis mit früherem Beginn nachgetragen: keine erfundene Änderung, keine Entwarnung',
    stand: { profil: { geburtsjahr: geb(78), herz: 'ja' }, befund: bef(0.08, 19), dosen: [dosis('d0', '2024-03-01', 75), dosis('d1', HEUTE, 75, { praxis: null })] },
    erwartet: {
      keineRichtung: true, stufeMin: 'tage', text: [/doppelten Eintrag/], ohne: [/nach dieser Blutabnahme schon geändert/],
      extra: [['Knopf ändert den doppelten Eintrag', (r) => r.aktion === 'dosis' && r.aktionParam === 'd1']],
    },
  },

  // B33 / B43 – W5 auf der Karte: Kopf mit Gesprächsangebot, Telefonseelsorge anrufbar.
  {
    name: 'B33 Check nur „lebensmüde": Kopf mit Gesprächsangebot, Seelsorge anrufbar',
    stand: { befund: bef(7.5), befinden: [bf(0, ['herz'])], warnzeichen: [wc(0, ['lebensmuede'])] },
    erwartet: {
      ohneRichtung: true, stufe: 'notruf', regel: 'W5',
      extra: [
        ['Kopf „Bitte sprechen Sie heute mit jemandem"', (r) => /sprechen Sie heute mit jemandem/.test(str(r.kopf && r.kopf.titel))],
        ['Telefonseelsorge anrufbar', (r) => r.anrufe.some((a) => a.nummer === '08001110111')],
      ],
    },
  },
  {
    name: 'B33 Check „große Menge" und „lebensmüde": beide Abschnitte, Giftnotruf und Seelsorge anrufbar',
    stand: { befund: bef(7.5), befinden: [bf(0, ['herz'])], warnzeichen: [wc(0, ['packung', 'lebensmuede'])] },
    erwartet: {
      stufe: 'notruf', regel: ['W4a', 'W5'],
      extra: [
        ['Giftnotruf Bayern anrufbar', (r) => r.anrufe.some((a) => a.nummer === '08919240')],
        ['Telefonseelsorge anrufbar', (r) => r.anrufe.some((a) => a.nummer === '08001110111')],
      ],
    },
  },
  {
    name: 'B33 „lebensmüde" im Befinden und Check heute mit 112-Zeichen: beides auf der Karte, 112 anrufbar',
    stand: { befund: bef(7.5), befinden: [bf(-2, ['lebensmuede'])], warnzeichen: [wc(0, [W_112])] },
    erwartet: {
      stufe: 'notruf', regel: ['W5', 'W1'],
      extra: [['112 anrufbar', (r) => r.anrufe.some((a) => a.nummer === '112')], ['Kopf „Sofort 112"', (r) => /112/.test(str(r.kopf && r.kopf.titel))]],
    },
  },
  {
    name: 'B33 „lebensmüde" im Befinden: Stufe notruf, Kopf mit Gesprächsangebot',
    stand: { befund: bef(7.5), befinden: [bf(-2, ['lebensmuede'])] },
    erwartet: { ohneRichtung: true, stufe: 'notruf', extra: [['Kopf mit Gesprächsangebot', (r) => /sprechen Sie heute mit jemandem/.test(str(r.kopf && r.kopf.titel))]] },
  },

  // B34 – „weiß nicht", ob TSH bewusst niedrig sein soll, sperrt wie „ja".
  { name: 'B34 „bewusst niedrig: weiß nicht" (e): keine Richtung', stand: { profil: { zielNiedrig: 'unbekannt' }, befund: bef(0.2) }, erwartet: { richtung: 'klaeren', regel: 'D0.14' } },

  // B35 / B62 – D4b nennt genau eine Frist.
  {
    name: 'B35 D4b 70 J., TSH 0,05: nur „in den nächsten Tagen"',
    stand: { profil: { geburtsjahr: geb(70) }, befund: bef(0.05) },
    erwartet: { richtung: 'weniger', stufe: 'tage', text: [/in den nächsten Tagen/], ohne: [/innerhalb von ein bis zwei Wochen/] },
  },
  {
    name: 'B62 78 J. mit Herzkrankheit, TSH 0,08 (0,27–4,2): nur eine Frist',
    stand: { profil: { geburtsjahr: geb(78), herz: 'ja' }, befund: bef(tsh(0.08, { von: 0.27, bis: 4.2 }), 19) },
    erwartet: { richtung: 'weniger', stufe: 'tage', ohne: [/innerhalb von ein bis zwei Wochen/] },
  },

  // B38 – X4 (Herz und Puls) nur bei Herz oder Unruhe, nicht bei W-D3 wegen Müdigkeit.
  {
    name: 'B38 W-D3 wegen Müdigkeit, Check „Müdigkeit/Frieren": kein Herz-Satz, D3',
    stand: { profil: { geburtsjahr: geb(70) }, befund: bef(25, 9), befinden: [bf(0, ['muede'])], warnzeichen: [wc(0, ['muede_frieren'])] },
    erwartet: { richtung: 'mehr', regel: 'D3', ohneRegel: 'X4', stufeMin: 'tage', ohne: [/Herz und Puls/] },
  },

  // B42 / B67 – der Giftnotruf steht nie ohne Nummer da.
  {
    name: 'B42 Q5 „einmal", Bundesland NRW: Giftnotruf mit Nummer, anrufbar',
    stand: { profil: { bundesland: 'NW' }, befund: bef(0.3, 15, { verwechselt: 'einmal' }) },
    erwartet: {
      stufeMin: 'heute', text: [/0228 19240/],
      extra: [['Grund Q5 mit Giftnotruf NRW', (r) => r.gruende.some((g) => g.id === 'Q5' && g.anrufe.some((a) => a.nummer === '022819240'))]],
    },
  },
  {
    name: 'B42 Q5 „einmal" ohne Bundesland: 112 anrufbar',
    stand: { profil: { bundesland: '' }, befund: bef(0.3, 15, { verwechselt: 'einmal' }) },
    erwartet: { stufeMin: 'heute', extra: [['Grund Q5 mit 112', (r) => r.gruende.some((g) => g.id === 'Q5' && g.anrufe.some((a) => a.nummer === '112'))]] },
  },

  // B70 – „Ja, mit der Praxis gesprochen": zuerst fragen, was die Praxis gesagt hat.
  {
    name: 'B70 „mit der Praxis gesprochen": Folgefrage F8 statt „In den nächsten Tagen anrufen"',
    stand: { befund: bef(0.08, 15, { datum: plus(HEUTE, -20) }), nachfragen: [dosisStimmt('b1', plus(HEUTE, -16)), nachfrage14('b1', HEUTE, 'praxis')] },
    erwartet: { frage: 'praxis', keineRichtung: true, ohneRegel: 'D0.5' },
  },
  {
    name: 'B70 danach „Die Dosis bleibt so": D0.5, Stufe keine',
    stand: {
      befund: bef(0.08, 15, { datum: plus(HEUTE, -20), praxis: 'bleibt', praxisAm: HEUTE }),
      nachfragen: [dosisStimmt('b1', plus(HEUTE, -16)), nachfrage14('b1', HEUTE, 'praxis')],
    },
    erwartet: { regel: 'D0.5', stufe: 'keine' },
  },

  // ================================================================ Review Runde 2 (C1–C17): Regressionsfälle
  // C1 / C6 – RW2 Grundsatz 1 (a), W-D1, RW1 L3f und Entscheidung 17: Der
  // Warnzeichen-Check von heute zählt immer, nicht nur, wenn Herzklopfen oder
  // Müdigkeit im Befinden ihn verlangt haben. Ohne Befinden-Eintrag stand
  // sonst nach „große Menge auf einmal" eine Richtung mit „Beim nächsten Termin".
  {
    name: 'C1 Check heute „große Menge auf einmal", kein Befinden (c2, 76 J.): nur Notruf, Giftnotruf anrufbar',
    stand: { profil: { geburtsjahr: geb(76) }, befund: bef(7.5, 14), warnzeichen: [wc(0, ['packung'])] },
    erwartet: {
      ohneRichtung: true, stufe: 'notruf', regel: 'W4a', ohne: [/genau wie bisher weiter/],
      extra: [['Giftnotruf Bayern anrufbar', (r) => r.anrufe.some((a) => a.nummer === '08919240')], ['kein „Ein paar Tage Warten"', (r) => !/Ein paar Tage Warten/.test(alles(r))]],
    },
  },
  {
    name: 'C6 Check heute mit Brustschmerz, kein Befinden (e2, 78 J.): nur Notruf, 112 anrufbar',
    stand: { profil: { geburtsjahr: geb(78) }, befund: bef(0.2, 18), warnzeichen: [wc(0, [W_112])] },
    erwartet: { ohneRichtung: true, stufe: 'notruf', regel: 'W1', extra: [['112 anrufbar', (r) => r.anrufe.some((a) => a.nummer === '112')]] },
  },
  {
    name: 'C1 Check heute mit Brustschmerz, kein Befinden (Muster d): kein „weniger" mit „in den nächsten Tagen"',
    stand: { befund: bef(0.05, 30), warnzeichen: [wc(0, [W_112])] },
    erwartet: { ohneRichtung: true, stufe: 'notruf', regel: 'W1' },
  },
  {
    name: 'C6 Check heute nur „lebensmüde", kein Befinden (Muster a): Gesprächsangebot, Seelsorge anrufbar',
    stand: { befund: bef(2), warnzeichen: [wc(0, ['lebensmuede'])] },
    erwartet: {
      ohneRichtung: true, stufe: 'notruf', regel: ['W5', 'X2'],
      extra: [
        ['Kopf „Bitte sprechen Sie heute mit jemandem"', (r) => /sprechen Sie heute mit jemandem/.test(str(r.kopf && r.kopf.titel))],
        ['Telefonseelsorge anrufbar', (r) => r.anrufe.some((a) => a.nummer === '08001110111')],
      ],
    },
  },
  {
    name: 'C1 Check heute „lebensmüde", kein Befinden, TSH 0,2: kein „weniger", W5 auf der Karte',
    stand: { profil: { geburtsjahr: geb(76) }, befund: bef(0.2, 20), warnzeichen: [wc(0, ['lebensmuede'])] },
    erwartet: { ohneRichtung: true, stufe: 'notruf', regel: 'W5', text: [/Telefonseelsorge/] },
  },
  {
    name: 'C1 Check heute mit Stufe Tage, kein Befinden (Muster a): Richtung bleibt, Karte mindestens Tage (W-D1)',
    stand: { befund: bef(2), warnzeichen: [wc(0, [W_TAGE])] },
    erwartet: { richtung: 'gleich', stufe: 'tage', text: [/Warnzeichen-Check von heute/] },
  },
  {
    name: 'C1 Check heute „Nichts davon", kein Befinden (c2, 76 J.): Richtung unverändert, kein Satz zum Check',
    stand: { profil: { geburtsjahr: geb(76) }, befund: bef(7.5, 14), warnzeichen: [wc(0)] },
    erwartet: { richtung: 'mehr', regel: 'D2b', stufe: 'termin', ohne: [/Warnzeichen-Check von heute/] },
  },

  // C3 – „Über mehrere Tage versehentlich zu viele Tabletten" im Check ist
  // dieselbe Angabe wie Q5 „über Tage zu viel" (RW2 D5, rot-2 X15, B28):
  // keine Richtung, „verordnete Stärke", nie „genau wie bisher weiter".
  ...[
    ['Muster b (70 J.), müde', { profil: { geburtsjahr: geb(70) }, befund: bef(12, 9), befinden: [bf(0, ['muede'])] }],
    ['Muster c2 (76 J.), Herzklopfen', { profil: { geburtsjahr: geb(76) }, befund: bef(7.5, 14), befinden: [bf(0, ['herz'])] }],
    ['Muster d, Herzklopfen', { befund: bef(0.2, 24), befinden: [bf(0, ['herz'])] }],
    ['Muster e2, kein Befinden', { befund: bef(0.2, 20) }],
    ['Muster c2 (76 J.), kein Befinden', { profil: { geburtsjahr: geb(76) }, befund: bef(7.5, 14) }],
  ].map(([was, s]) => ({
    name: `C3 Check heute „über Tage zu viele Tabletten", ${was}: keine Richtung, kein „wie bisher"`,
    stand: { ...s, warnzeichen: [wc(0, ['zuviele'])] },
    erwartet: {
      richtung: 'klaeren', stufeMin: 'heute', regel: 'W2h', ohneRegel: 'Q5', text: [/verordnete Stärke/], ohne: [/genau wie bisher/],
      extra: [['116 117 anrufbar', (r) => r.anrufe.some((a) => a.nummer === '116117')]],
    },
  })),

  // C5 – RW1 L3f: Unter „Heute anrufen" steht D6 ohne „auch am Wochenende …
  // Ein paar Tage Warten schaden nicht"; bis Stufe Tage bleibt D6 wörtlich.
  {
    name: 'C5 74 J., Muster e2, Herzklopfen an zwei Tagen: Pflichttext ohne „Ein paar Tage Warten"',
    stand: { profil: { geburtsjahr: geb(74) }, befund: bef(0.2, 18), befinden: [bf(-1, ['herz']), bf(0, ['herz'])], warnzeichen: [wc(0)] },
    erwartet: {
      richtung: 'weniger', stufe: 'heute', pflicht: 'lang',
      extra: [
        ['Pflichttext ohne „Ein paar Tage Warten" und ohne „Wochenende"', (r) => !/Ein paar Tage Warten|Wochenende/.test(str(r.pflicht))],
        ['Pflichttext: „… genau wie bisher weiter." ohne „,."', (r) => /nehmen Sie Ihre Tablette genau wie bisher weiter\. Nehmen Sie keine/.test(str(r.pflicht)) && !/,\./.test(str(r.pflicht))],
      ],
    },
  },
  {
    name: 'C5 Gegenprobe Muster b (Stufe Tage): D6 wörtlich mit „Ein paar Tage Warten"',
    stand: { befund: bef(12, 9) },
    erwartet: { richtung: 'mehr', stufe: 'tage', pflicht: 'lang', extra: [['D6 wörtlich mit „auch am Wochenende … Ein paar Tage Warten schaden nicht."', (r) => /weiter, auch am Wochenende oder wenn die Praxis Urlaub hat\. Ein paar Tage Warten schaden nicht\./.test(str(r.pflicht))]] },
  },

  // C7 – rot-2 X3 (4), RW2 B2, RW1 L3f: Eine eingetragene eigene Änderung
  // („Auf Anweisung der Praxis: Nein") steht auf der Karte wie auf „Heute".
  {
    name: 'C7 75 µg × 1 → × 2 ohne Praxis nach dem Befund (c2, 72 J.): Tage, bisherige Menge, W-D2',
    stand: {
      profil: { geburtsjahr: geb(72) }, befund: bef(7.2, 14),
      dosen: [dosis('d1', DOSIS_AB, 75), dosis('d2', plus(HEUTE, -3), 75, { tabletten: 2, praxis: false })],
    },
    erwartet: {
      keineRichtung: true, stufe: 'tage', regel: ['D0.5', 'X3'], warnzeichen: true, text: [/bisherige Menge/, /heute oder morgen/],
      ohne: [/Eine neue Einschätzung gibt es mit dem Kontrollwert/, /genau wie bisher weiter/],
    },
  },
  {
    name: 'C7 75 → 88 µg ohne Praxis nach dem Befund: B2, Tage',
    stand: { befund: bef(7.2, 14), dosen: [dosis('d1', DOSIS_AB, 75), dosis('d2', plus(HEUTE, -2), 88, { praxis: false })] },
    erwartet: { keineRichtung: true, stufe: 'tage', regel: 'B2', text: [/in den nächsten Tagen/], ohne: [/Eine neue Einschätzung gibt es mit dem Kontrollwert/, /genau wie bisher weiter/] },
  },
  {
    name: 'C7 „selbst geändert" gemeldet, 75 → 150 µg: D0.5 ohne „Kontrollwert … nach der Änderung"',
    stand: {
      befund: bef(7.2, 14, { datum: plus(HEUTE, -30) }), dosen: [dosis('d1', DOSIS_AB, 75), dosis('d2', plus(HEUTE, -2), 150, { praxis: null })],
      nachfragen: [dosisStimmt('b1', plus(HEUTE, -28)), nachfrage14('b1', HEUTE, 'selbst')],
    },
    erwartet: { keineRichtung: true, stufeMin: 'tage', regel: 'X3', warnzeichen: true, text: [/bisherige Menge/, /klärt der Anruf/], ohne: [/Eine neue Einschätzung gibt es mit dem Kontrollwert/] },
  },

  // C4 – RW2 Grundsatz 6, D6b: Nach „selbst geändert" und danach „Die Praxis
  // hat entschieden" gilt die Praxis – X3 bleibt ohne Frist, kein „anrufen".
  {
    name: 'C4 „selbst geändert", danach Praxis „bleibt so": keine Frist, kein „anrufen" im Kopf',
    stand: {
      befund: bef(7.5, 14, { datum: plus(HEUTE, -40), praxis: 'bleibt', praxisAm: HEUTE }),
      dosen: [dosis('d1', DOSIS_AB, 75), dosis('d2', plus(HEUTE, -20), 88, { praxis: false })],
      nachfragen: [dosisStimmt('b1', plus(HEUTE, -35)), nachfrage14('b1', plus(HEUTE, -20), 'selbst')],
    },
    erwartet: {
      keineRichtung: true, stufe: 'keine', regel: 'X3', ohne: [/in den nächsten Tagen/, /heute oder morgen/],
      extra: [['Kopf ohne „anrufen"', (r) => !/anrufen/.test(str(r.kopf && r.kopf.titel))], ['X3 ohne Stufe', (r) => r.gruende.some((g) => g.id === 'X3' && !g.stufe)]],
    },
  },
  {
    name: 'C4 dasselbe 30 Tage später: weiter ohne Frist',
    heute: plus(HEUTE, 30),
    stand: {
      befund: bef(7.5, 14, { datum: plus(HEUTE, -40), praxis: 'bleibt', praxisAm: HEUTE }),
      dosen: [dosis('d1', DOSIS_AB, 75), dosis('d2', plus(HEUTE, -20), 88, { praxis: false })],
      nachfragen: [dosisStimmt('b1', plus(HEUTE, -35)), nachfrage14('b1', plus(HEUTE, -20), 'selbst')],
    },
    erwartet: { keineRichtung: true, stufeMax: 'termin', ohne: [/in den nächsten Tagen/] },
  },
  {
    name: 'C4 großer eigener Schritt, danach Praxis „bleibt so": bisherige Menge ohne Frist, W-D2 bleibt',
    stand: {
      befund: bef(7.5, 14, { datum: plus(HEUTE, -40), praxis: 'bleibt', praxisAm: HEUTE }),
      dosen: [dosis('d1', DOSIS_AB, 75), dosis('d2', plus(HEUTE, -20), 150, { praxis: false })],
      nachfragen: [dosisStimmt('b1', plus(HEUTE, -35)), nachfrage14('b1', plus(HEUTE, -20), 'selbst')],
    },
    erwartet: { keineRichtung: true, stufe: 'keine', warnzeichen: true, text: [/bisherige Menge/], ohne: [/heute oder morgen/, /in den nächsten Tagen/] },
  },
  {
    name: 'C4 ohne Entscheidung der Praxis: weiter mindestens Tage',
    stand: {
      befund: bef(7.5, 14, { datum: plus(HEUTE, -40) }),
      dosen: [dosis('d1', DOSIS_AB, 75), dosis('d2', plus(HEUTE, -20), 88, { praxis: false })],
      nachfragen: [dosisStimmt('b1', plus(HEUTE, -35)), nachfrage14('b1', plus(HEUTE, -20), 'selbst')],
    },
    erwartet: { keineRichtung: true, stufeMin: 'tage', regel: 'X3', text: [/in den nächsten Tagen/] },
  },

  // C2 – rot-2 X3 (2), RW2 D0.5: „Ja, mit der Praxis gesprochen" und dann
  // „Noch nichts entschieden" gibt die Richtung für 14 Tage frei – vorher kam
  // die 14-Tage-Frage sofort und endlos wieder.
  ...[[0, false], [13, false], [14, true]].map(([tag, frage]) => ({
    name: `C2 „mit der Praxis gesprochen" → „Noch nichts entschieden", Tag ${tag}: ${frage ? 'wieder die 14-Tage-Frage' : 'die Richtung'}`,
    heute: plus(HEUTE, tag),
    stand: {
      befund: bef(7.5, 14, { datum: plus(HEUTE, -31), praxis: 'nochnicht', praxisAm: HEUTE }),
      nachfragen: [dosisStimmt('b1', plus(HEUTE, -20)), nachfrage14('b1', HEUTE, 'praxis')],
    },
    erwartet: frage ? { frage: 'nach14', keineRichtung: true } : { richtung: 'mehr', frage: false },
  })),

  // C8 – RW2 W-D4, RW1 L3f: „Ja" auf die Nachfrage nach einer Erhöhung hebt
  // auch die Karte – nicht grün „Kein besonderer Anlass" unter „Heute anrufen".
  {
    name: 'C8 Erhöhung auf Anweisung, W-D4 heute „Ja": Karte „Heute anrufen"',
    stand: {
      befund: bef(6.8, 14, { datum: plus(HEUTE, -40) }),
      dosen: [dosis('d1', DOSIS_AB, 75), dosis('d2', plus(HEUTE, -15), 88)],
      nachfragen: [dosisStimmt('b1', plus(HEUTE, -38)), { id: 'wd4', art: 'wd4', bezug: 'd2-14', antwort: 'ja', am: HEUTE }],
    },
    erwartet: {
      keineRichtung: true, stufe: 'heute', regel: ['D0.5', 'W-D4'], text: [/heute noch/, /Warnzeichen-Check/], ohne: [/heute oder morgen/],
      extra: [['Kopf „Heute anrufen"', (r) => /Heute anrufen/.test(str(r.kopf && r.kopf.titel))], ['116 117 anrufbar', (r) => r.anrufe.some((a) => a.nummer === '116117')]],
    },
  },

  // C17 – eine alte Antwort „Nein, ich nehme etwas anderes" macht eine
  // spätere Änderung der Praxis nicht zur Berichtigung (kein „Gilt ab").
  {
    name: 'C17 Marke „berichtigung" aus alter Antwort, Befund mit „Ja", Praxis „geändert": Änderung, kein „Gilt ab"',
    stand: {
      befund: bef(6.5, 13, { datum: plus(HEUTE, -33), praxis: 'geaendert', praxisAm: plus(HEUTE, -30) }),
      dosen: [dosis('d1', DOSIS_AB, 75), dosis('d2', plus(HEUTE, -26), 100, { berichtigung: true })],
      nachfragen: [dosisStimmt('b1', plus(HEUTE, -32))],
    },
    erwartet: { keineRichtung: true, regel: 'D0.5', stufe: 'keine', ohne: [/Gilt ab/] },
  },
];

// ================================================================ Tabelle: dosisHinweise

const HB = plus(HEUTE, -120);   // Befund vor jeder Änderung – er beendet nichts
/** Ein Stand mit einer Dosisänderung `am` von `von` auf `nach` µg. */
function hStand({ am, von = 75, nach = 87.5, praxis = true, erste = false, mittel = [], profil = {}, befund = {} }) {
  const dosen = erste ? [dosis('d1', am, nach, { praxis })] : [dosis('d1', DOSIS_AB, von), dosis('d2', am, nach, { praxis })];
  return vollständigerStand({ dosen, mittel, profil, befund: { datum: HB, ...befund } });
}

// ANNAHME: Kennungen der Hinweise wie die Regel-IDs ('D6c', 'W-D4', 'WW1',
// 'WW2', 'B2'); gefunden wird ein Hinweis an der Kennung ODER am Text.
const H = {
  D6C: { name: 'D6c-Erinnerung', id: 'D6c', muster: /fällig/ },
  WD4A: { name: 'W-D4 Frage A', muster: /Seit Ihre Dosis erhöht/ },
  WD4B: { name: 'W-D4 Frage B', muster: /Seit Ihre Dosis verringert/ },
  WW1: { name: 'WW1 Marcumar', id: 'WW1', muster: /INR/ },
  WW2: { name: 'WW2 Diabetes', id: 'WW2', muster: /Blutzucker/ },
  B2: { name: 'B2-Hinweis', id: 'B2', muster: /dass Sie die Dosis geändert haben/ },
  X34: { name: 'X3(4) großer eigener Schritt', muster: /mehr als ein üblicher Schritt/ },
};
const hText = (h) => [str(h && h.text), str(h && h.frage && h.frage.text)].join('\n');
const normId = (x) => str(x).toUpperCase().replace(/[^A-Z0-9]/g, '');
const findeHinweis = (liste2, def) => (liste2 || []).find((h) => h && ((def.id && normId(h.id).startsWith(normId(def.id)))
  || (def.muster && def.muster.test(hText(h)))));
const hinweisInfo = (liste2) => `[${(liste2 || []).map((h) => `${h && h.id}/${h && h.stufe}: ${hText(h).replace(/\s+/g, ' ').slice(0, 50)}`).join(' | ')}]`;

const HINWEIS_ERGEBNISSE = [];
const mit = (def, mehr) => ({ ...def, ...mehr });

const HINWEIS_FAELLE = [
  // ---------------------------------------------------------------- D6c – Kontrolle ab + 42 Tage, nach + 70 wöchentlich (mit L5)
  { name: 'D6c Tag 41 nach der Änderung', stand: () => hStand({ am: plus(HEUTE, -41) }), nicht: [H.D6C] },
  {
    name: 'D6c Tag 42 nach der Änderung',
    stand: () => hStand({ am: plus(HEUTE, -42) }),
    hat: [mit(H.D6C, { stufe: 'termin', text: [re(kurz(plus(HEUTE, -42))), /erst nach der (Blut)?[Aa]bnahme/] })],
  },
  { name: 'D6c Tag 56', stand: () => hStand({ am: plus(HEUTE, -56) }), hat: [H.D6C] },
  { name: 'D6c Tag 70', stand: () => hStand({ am: plus(HEUTE, -70) }), hat: [H.D6C] },
  // MEHRDEUTIG: „wöchentlich wiederholen" – geprüft werden nur die Wochentage
  // 77 und 84 (in jeder Lesart dabei), nicht die Tage dazwischen.
  { name: 'D6c Tag 77 (wöchentlich)', stand: () => hStand({ am: plus(HEUTE, -77) }), hat: [H.D6C] },
  { name: 'D6c Tag 84 (wöchentlich)', stand: () => hStand({ am: plus(HEUTE, -84) }), hat: [H.D6C] },
  { name: 'D6c nicht nach dem ersten Dosis-Eintrag', stand: () => hStand({ am: plus(HEUTE, -50), erste: true }), nicht: [H.D6C] },
  { name: 'D6c endet mit dem Kontrollbefund', stand: () => hStand({ am: plus(HEUTE, -50), befund: { datum: plus(HEUTE, -3) } }), nicht: [H.D6C] },
  {
    name: 'D6c nach „erst nachmessen" (Tag 42)',
    stand: () => vollständigerStand({ befund: { datum: plus(HEUTE, -60), praxis: 'nachmessen', praxisAm: plus(HEUTE, -42) } }),
    hat: [H.D6C],
  },

  // ---------------------------------------------------------------- W-D4 – Beobachtung nach der Änderung
  // MEHRDEUTIG: „am Tag 14" – ab Tag 14 (bis beantwortet); Tag 13 noch nicht.
  { name: 'W-D4 Tag 13 nach Erhöhung', stand: () => hStand({ am: plus(HEUTE, -13) }), nicht: [H.WD4A] },
  { name: 'W-D4 Tag 14 nach Erhöhung: Frage A', stand: () => hStand({ am: plus(HEUTE, -14) }), hat: [mit(H.WD4A, { stufe: 'termin', text: [/Herzklopfen/, /Brust/] })] },
  { name: 'W-D4 Tag 28 nach Erhöhung: Frage A', stand: () => hStand({ am: plus(HEUTE, -28) }), hat: [H.WD4A] },
  { name: 'W-D4 Tag 28 nach Senkung: Frage B', stand: () => hStand({ am: plus(HEUTE, -28), nach: 62.5 }), hat: [mit(H.WD4B, { text: [/müder/, /frieren/] })], nicht: [H.WD4A] },
  { name: 'W-D4 Tag 14 nach Senkung: noch keine Frage B', stand: () => hStand({ am: plus(HEUTE, -14), nach: 62.5 }), nicht: [H.WD4B] },

  // ---------------------------------------------------------------- WW1 – Marcumar
  { name: 'WW1 Marcumar, Änderung heute', stand: () => hStand({ am: HEUTE, mittel: ['marcumar'] }), hat: [mit(H.WW1, { stufe: 'zeitnah', text: [/blaue Flecken|Nasenbluten/] })] },
  { name: 'WW1 Marcumar, Erinnerung an Tag 7', stand: () => hStand({ am: plus(HEUTE, -7), mittel: ['marcumar'] }), hat: [H.WW1] },
  { name: 'WW1 ohne Marcumar', stand: () => hStand({ am: HEUTE }), nicht: [H.WW1] },

  // ---------------------------------------------------------------- WW2 (+ X13) – Diabetes
  {
    name: 'WW2/X13 Diabetes laut Profil, Erhöhung heute',
    stand: () => hStand({ am: HEUTE, profil: { diabetes: 'ja' } }),
    hat: [mit(H.WW2, { stufe: 'zeitnah', ohne: [/Achten Sie auf Unterzucker/] })],
  },
  { name: 'WW2 Metformin, Senkung heute: Unterzucker-Satz', stand: () => hStand({ am: HEUTE, nach: 62.5, mittel: ['metformin'] }), hat: [mit(H.WW2, { text: [/Unterzucker/] })] },
  { name: 'WW2 Diabetes-Mittel, Tag 7', stand: () => hStand({ am: plus(HEUTE, -7), nach: 62.5, mittel: ['diabetes'] }), hat: [H.WW2] },
  { name: 'WW2 ohne Diabetes', stand: () => hStand({ am: HEUTE }), nicht: [H.WW2] },
  { name: 'WW2 nach 6 Wochen vorbei (Tag 49)', stand: () => hStand({ am: plus(HEUTE, -49), mittel: ['diabetes'] }), nicht: [H.WW2] },

  // ---------------------------------------------------------------- B2 – Dosis ohne Anweisung der Praxis
  { name: 'B2 eigene Änderung (Quelle nein), heute', stand: () => hStand({ am: HEUTE, praxis: false }), hat: [mit(H.B2, { stufe: 'tage', text: [/in den nächsten Tagen/] })] },
  { name: 'B2 eigene Änderung, gestern eingetragen', stand: () => hStand({ am: plus(HEUTE, -1), praxis: false }), hat: [H.B2] },
  { name: 'B2 auf Anweisung der Praxis: kein Hinweis', stand: () => hStand({ am: HEUTE, praxis: true }), nicht: [H.B2] },

  // ---------------------------------------------------------------- X3 (4) – eigenmächtig mehr als ein Schritt
  {
    name: 'X3(4) 75 → 150 µg ohne Praxis',
    stand: () => hStand({ am: HEUTE, nach: 150, praxis: false }),
    hat: [mit(H.X34, { stufeMin: 'tage', text: [/heute oder morgen/, /bisherige Menge/] })],
    extra: [['W-D2-Zeichen sofort dabei (112)', (l) => l.some((h) => /112/.test(hText(h)) && /Brust/.test(hText(h)))]],
  },
  { name: 'X3(4) 75 → 100 µg (+33 %)', stand: () => hStand({ am: HEUTE, nach: 100, praxis: false }), hat: [mit(H.X34, { stufeMin: 'tage' })] },
  { name: 'X3(4) 75 → 50 µg (−33 %)', stand: () => hStand({ am: HEUTE, nach: 50, praxis: false }), hat: [H.X34] },
  { name: 'X3(4) Grenze: 100 → 125 µg (+25 µg = 25 %)', stand: () => hStand({ am: HEUTE, von: 100, nach: 125, praxis: false }), nicht: [H.X34] },
  { name: 'X3(4) 125 → 150 µg (+20 %)', stand: () => hStand({ am: HEUTE, von: 125, nach: 150, praxis: false }), nicht: [H.X34] },
  { name: 'X3(4) 75 → 150 µg auf Anweisung der Praxis', stand: () => hStand({ am: HEUTE, nach: 150, praxis: true }), nicht: [H.X34] },
  // ---------------------------------------------------------------- Review-Befunde: Regressionsfälle
  // B23: Quelle offen, aber auf der Karte „Ich habe selbst etwas geändert" gesagt.
  {
    name: 'B23 Quelle offen, „selbst geändert" gemeldet, 75 → 150 µg: X3(4)',
    stand: () => vollständigerStand({
      befund: { datum: HB }, dosen: [dosis('d1', DOSIS_AB, 75), dosis('d2', plus(HEUTE, -2), 150, { praxis: null })],
      nachfragen: [dosisStimmt('b1', plus(HB, 4)), nachfrage14('b1', HEUTE, 'selbst')],
    }),
    hat: [mit(H.X34, { stufeMin: 'tage', text: [/bisherige Menge/] })],
  },
  { name: 'B23 Quelle offen ohne Meldung: kein Hinweis (offen heißt nicht „nein")', stand: () => hStand({ am: plus(HEUTE, -2), nach: 150, praxis: null }), nicht: [H.X34, H.B2] },
  // B31: nach einer Änderung ab 70 erst nach 8 Wochen zur Kontrolle.
  { name: 'B31 78 J.: D6c noch nicht an Tag 42', stand: () => hStand({ am: plus(HEUTE, -42), profil: { geburtsjahr: geb(78) } }), nicht: [H.D6C] },
  { name: 'B31 78 J.: D6c an Tag 56 („etwa 8 Wochen")', stand: () => hStand({ am: plus(HEUTE, -56), profil: { geburtsjahr: geb(78) } }), hat: [mit(H.D6C, { text: [/etwa 8 Wochen/] })] },
  // B36: „erst nachmessen" ohne Dosisänderung.
  {
    name: 'B36 D6c nach „erst nachmessen" ohne Änderung: kein „Ihre Dosis wurde geändert"',
    stand: () => vollständigerStand({ befund: { datum: plus(HEUTE, -50), praxis: 'nachmessen', praxisAm: plus(HEUTE, -50) } }),
    hat: [mit(H.D6C, { text: [/nachmessen/], ohne: [/Dosis wurde/] })],
  },
  // B37: nach drei Monaten ohne Kontrolle dieselbe Stufe wie L7d.
  {
    name: 'B37 D6c an Tag 91 ohne Kontrolle: zeitnah',
    stand: () => vollständigerStand({ befund: { datum: plus(HEUTE, -96), tsh: tsh(7.5) }, dosen: [dosis('d1', DOSIS_AB, 75), dosis('d2', plus(HEUTE, -91), 88)] }),
    hat: [mit(H.D6C, { stufe: 'zeitnah' })],
  },
  // B59: ein doppelter Eintrag (Einrichten „ab heute" plus derselbe mit richtigem Beginn) ist keine Änderung.
  {
    name: 'B59 doppelter Eintrag: kein „Dosis wurde geändert" (WW1, WW2), kein B2',
    stand: () => vollständigerStand({
      mittel: ['marcumar'], profil: { diabetes: 'ja' }, befund: { datum: plus(HEUTE, -10) },
      dosen: [dosis('d0', '2024-03-01', 75), dosis('d1', HEUTE, 75, { praxis: false })],
    }),
    nicht: [H.WW1, H.WW2, H.B2, H.X34],
  },
  {
    name: 'B59 doppelter Eintrag, 42 Tage später: keine Kontrolle „nach der Änderung"',
    heute: plus(HEUTE, 42),
    stand: () => vollständigerStand({ befund: { datum: plus(HEUTE, -10) }, dosen: [dosis('d0', '2024-03-01', 75), dosis('d1', HEUTE, 75)] }),
    nicht: [H.D6C],
  },

  // ---------------------------------------------------------------- Review Runde 2: Regressionsfälle
  // C8 – Grundsatz 4 (feste Fristen): Unter „Heute anrufen" nicht „heute oder morgen".
  {
    name: 'C8 W-D4 heute mit „Ja" beantwortet (Erhöhung): „heute noch", 116 117 anrufbar',
    stand: () => vollständigerStand({
      befund: { datum: HB }, dosen: [dosis('d1', DOSIS_AB, 75), dosis('d2', plus(HEUTE, -15), 88)],
      nachfragen: [dosisStimmt('b1', plus(HB, 2)), { id: 'wd4', art: 'wd4', bezug: 'd2-14', antwort: 'ja', am: HEUTE }],
    }),
    extra: [['W-D4 „heute" mit „heute noch", ohne „heute oder morgen", 116 117 anrufbar', (l) => l.some((h) => h.id === 'W-D4' && h.stufe === 'heute'
      && /heute noch/.test(h.text) && !/heute oder morgen/.test(h.text) && h.anrufe.some((a) => a.nummer === '116117'))]],
  },
  // C4 – RW2 Grundsatz 6, D6b: Hat die Praxis nach der eigenen Änderung
  // entschieden, fordert „Heute" nicht mehr zum Anruf deswegen auf.
  {
    name: 'C4 eigene Änderung vor 3 Tagen, danach Praxis „bleibt so": kein B2/X3 auf „Heute"',
    stand: () => hStand({ am: plus(HEUTE, -3), nach: 150, praxis: false, befund: { datum: plus(HEUTE, -20), praxis: 'bleibt', praxisAm: HEUTE } }),
    nicht: [H.B2, H.X34],
  },
  {
    name: 'C4 Gegenprobe: Praxis entschied vor der eigenen Änderung – X3(4) bleibt',
    stand: () => hStand({ am: plus(HEUTE, -3), nach: 150, praxis: false, befund: { datum: plus(HEUTE, -20), praxis: 'bleibt', praxisAm: plus(HEUTE, -10) } }),
    hat: [mit(H.X34, { stufeMin: 'tage' })],
  },
  // C17 – Die Marke „berichtigung" aus einer alten Antwort „Nein" macht eine
  // Änderung der Praxis nicht zur Berichtigung: Kontrolle (D6c), W-D4, WW1/WW2 bleiben.
  ...[
    ['mit „Ja" zum Befund vorher', [dosisStimmt('b1', plus(HB, 1))], { praxis: 'nochnicht', praxisAm: plus(HB, 1) }],
    ['ohne „Ja" (F8 „geändert" sperrt die Frage)', [], { praxis: 'geaendert', praxisAm: plus(HB, 3) }],
  ].flatMap(([was, nachfragen, praxis]) => {
    const st = () => vollständigerStand({
      mittel: ['marcumar'], profil: { diabetes: 'ja' },
      befund: { datum: HB, tsh: tsh(6.5), ...praxis },
      dosen: [dosis('d1', DOSIS_AB, 75), dosis('d2', plus(HEUTE, -14), 100, { berichtigung: true })],
      nachfragen,
    });
    return [
      {
        name: `C17 Marke „berichtigung" aus alter Antwort, ${was}, Tag 14: W-D4, WW1 ohne „berichtigt", kein X3b`,
        stand: st, hat: [H.WD4A, mit(H.WW1, { ohne: [/berichtigt/] })],
        extra: [['kein X3b', (l) => !l.some((h) => h.id === 'X3b')]],
      },
      { name: `C17 dieselbe Lage, ${was}, Tag 56: D6c`, heute: plus(HEUTE, 42), stand: st, hat: [H.D6C] },
    ];
  }),
  {
    name: 'C17 Gegenprobe: echte Berichtigung (kein „Ja", Praxis „noch nicht"): X3b, keine W-D4',
    stand: () => vollständigerStand({
      befund: { datum: HB, tsh: tsh(6.5) }, dosen: [dosis('d1', DOSIS_AB, 75), dosis('d2', plus(HEUTE, -14), 100, { berichtigung: true })], nachfragen: [],
    }),
    nicht: [H.WD4A],
    extra: [['X3b', (l) => l.some((h) => h.id === 'X3b')]],
  },
];

function pruefeHinweisFall(f) {
  const heute = f.heute || HEUTE;
  let stand;
  let l;
  try {
    stand = f.stand();
    l = dosisHinweise(stand, heute);
  } catch (err) {
    check(`${f.name}: dosisHinweise läuft`, false, kurzFehler(err));
    return;
  }
  if (!Array.isArray(l)) {
    check(`${f.name}: dosisHinweise liefert eine Liste`, false, `Ergebnis ${typeof l}`);
    return;
  }
  HINWEIS_ERGEBNISSE.push({ name: f.name, l, stand, heute });
  for (const def of f.hat || []) {
    const h = findeHinweis(l, def);
    check(`${f.name}: ${def.name} erscheint`, !!h, hinweisInfo(l));
    if (!h) continue;
    if (def.stufe) check(`${f.name}: ${def.name} Stufe ${def.stufe}`, h.stufe === def.stufe, `stufe=${h.stufe}`);
    if (def.stufeMin) check(`${f.name}: ${def.name} Stufe mindestens ${def.stufeMin}`, rang(h.stufe) >= RANG[def.stufeMin], `stufe=${h.stufe}`);
    for (const m of def.text || []) check(`${f.name}: ${def.name} Text ${m}`, m.test(hText(h)), hText(h).replace(/\s+/g, ' ').slice(0, 200));
    for (const m of def.ohne || []) check(`${f.name}: ${def.name} ohne ${m}`, !m.test(hText(h)), hText(h).replace(/\s+/g, ' ').slice(0, 200));
  }
  for (const def of f.nicht || []) check(`${f.name}: kein ${def.name}`, !findeHinweis(l, def), hinweisInfo(l));
  for (const [was, fn] of f.extra || []) {
    let ok = false;
    try { ok = fn(l) === true; } catch { ok = false; }
    check(`${f.name}: ${was}`, ok, hinweisInfo(l));
  }
}

// ================================================================ Tabelle: gesamtbildMitDosis

/*
 * Umsetzung, Schnittstelle gesamtbild → { …, dosis, teile }: Stufe und Kopf
 * für „Heute" und die Einschätzung enthalten die Dosis-Karte und die
 * Dosis-Hinweise (RW1 Grundsatz 5 und L3f: eine Gesamteinschätzung, kein
 * Bildschirm nennt eine niedrigere Stufe als ein anderer). ANNAHME: Die
 * Funktion heißt gesamtbildMitDosis(stand, heute) und die Teile der Karte und
 * der Hinweise tragen quelle 'dosis', der Teil der Karte die Kennung 'dosis'.
 *
 * Ein Fall: { name, stand: () => Stand, heute?, stufe?, stufeMin?, teile?,
 * nichtTeile?, extra: [[name, (g, stand) => bool]] }.
 */
const GESAMT_FAELLE = [
  {
    name: 'B9 eigenmächtig 75 → 150 µg vor 3 Tagen (Quelle nein): mindestens Tage',
    stand: () => hStand({ am: plus(HEUTE, -3), nach: 150, praxis: false, befund: { datum: plus(HEUTE, -10) } }),
    stufeMin: 'tage', teile: ['X3', 'dosis'],
  },
  {
    name: 'B40 Q5 „einmal": heute, der Teil der Karte nennt den Giftnotruf mit Nummer',
    stand: () => vollständigerStand({ befund: bef(0.3, 15, { verwechselt: 'einmal' }) }),
    stufeMin: 'heute', teile: ['dosis'],
    extra: [['Teil der Karte: Giftnotruf 089 19240, anrufbar', (g) => g.teile.some((t) => t.id === 'dosis' && /089 19240/.test(t.text)
      && Array.isArray(t.anrufe) && t.anrufe.some((a) => a.nummer === '08919240'))]],
  },
  {
    name: 'B40 selbst geändert (X3), Muster c1: mindestens Tage',
    stand: () => vollständigerStand({ befund: bef(4.6, 15, { datum: plus(HEUTE, -20) }), nachfragen: [dosisStimmt('b1', plus(HEUTE, -16)), nachfrage14('b1', HEUTE, 'selbst')] }),
    stufeMin: 'tage',
  },
  {
    name: 'B61 74 J., Muster e2, Herzklopfen an zwei Tagen: Karte und Gesamtbild heute',
    stand: () => vollständigerStand({ profil: { geburtsjahr: geb(74) }, befund: bef(0.2, 18), befinden: [bf(-1, ['herz']), bf(0, ['herz'])], warnzeichen: [wc(0)] }),
    stufe: 'heute', extra: [['Karte und Gesamtbild gleich', (g) => g.dosis && g.dosis.stufe === g.stufe]],
  },
  {
    name: 'B33 W5 im Befinden: Kopf bleibt beim Gesprächsangebot',
    stand: () => vollständigerStand({ befund: bef(7.5), befinden: [bf(-2, ['lebensmuede'])] }),
    stufe: 'notruf', extra: [['Kopf „Bitte sprechen Sie heute mit jemandem"', (g) => /sprechen Sie heute mit jemandem/.test(g.kopf.titel)]],
  },
  {
    name: 'B37 D6c (zeitnah) ersetzt L7d für dieselbe Kontrolle',
    stand: () => vollständigerStand({ befund: { datum: plus(HEUTE, -96), tsh: tsh(7.5) }, dosen: [dosis('d1', DOSIS_AB, 75), dosis('d2', plus(HEUTE, -91), 88)] }),
    teile: ['D6c'], nichtTeile: ['L7d'], stufeMin: 'zeitnah',
    extra: [['ohne die Dosis-Hinweise stünde L7d da', (g, stand) => ez.gesamtbild(stand, HEUTE).teile.some((t) => t.id === 'L7d')]],
  },
  {
    name: 'D6: die Richtung „mehr" steht nicht im Gesamtbild',
    stand: () => vollständigerStand({ befund: bef(8) }),
    teile: ['dosis'],
    extra: [['kein „spricht für", keine Schrittgröße in den Dosis-Teilen', (g) => g.dosis.richtung === 'mehr' && g.teile.filter((t) => t.quelle === 'dosis')
      .every((t) => !/spricht (klar |eher )?(für|dafür)|höhere Dosis|niedrigere Dosis|so zu lassen|µg/.test(t.text))]],
  },
  {
    name: 'P6 nicht aktiv: keine Dosis-Teile',
    stand: () => vollständigerStand({ profil: { behandelt: false, ursache: '' }, befund: bef(8) }),
    extra: [['dosis null, keine Teile mit quelle dosis', (g) => g.dosis === null && g.teile.every((t) => t.quelle !== 'dosis')]],
  },

  // ---------------------------------------------------------------- Review Runde 2: Regressionsfälle
  // C1 / C6 – dieselbe Lage, dieselbe Dringlichkeit auf Karte und „Heute".
  ...[['packung', 'große Menge auf einmal'], [W_112, 'Brustschmerz'], ['lebensmuede', 'lebensmüde']].map(([key, was]) => ({
    name: `C1 Check heute „${was}" ohne Befinden: Karte und Gesamtbild 112`,
    stand: () => vollständigerStand({ profil: { geburtsjahr: geb(76) }, befund: bef(7.5, 14), warnzeichen: [wc(0, [key])] }),
    stufe: 'notruf', extra: [['Karte 112 ohne Richtung', (g) => g.dosis && g.dosis.stufe === 'notruf' && g.dosis.richtung === 'klaeren']],
  })),
  // C7 – eigene Verdopplung: Karte und „Heute" nennen dieselbe Stufe.
  {
    name: 'C7 75 µg × 1 → × 2 ohne Praxis nach dem Befund: Karte und Gesamtbild Tage',
    stand: () => vollständigerStand({
      profil: { geburtsjahr: geb(72) }, befund: bef(7.2, 14),
      dosen: [dosis('d1', DOSIS_AB, 75), dosis('d2', plus(HEUTE, -3), 75, { tabletten: 2, praxis: false })],
    }),
    stufe: 'tage', teile: ['X3', 'dosis'], extra: [['Karte Tage', (g) => g.dosis && g.dosis.stufe === 'tage']],
  },
  // C8 – „Ja" auf W-D4 nach einer Erhöhung: Karte nicht „Kein besonderer Anlass".
  {
    name: 'C8 W-D4 heute „Ja": Karte und Gesamtbild heute',
    stand: () => vollständigerStand({
      befund: bef(6.8, 14, { datum: plus(HEUTE, -40) }), dosen: [dosis('d1', DOSIS_AB, 75), dosis('d2', plus(HEUTE, -15), 88)],
      nachfragen: [dosisStimmt('b1', plus(HEUTE, -38)), { id: 'wd4', art: 'wd4', bezug: 'd2-14', antwort: 'ja', am: HEUTE }],
    }),
    stufe: 'heute', extra: [['Karte heute', (g) => g.dosis && g.dosis.stufe === 'heute']],
  },
  // C11 – B37 vollständig: L7d und D6c meinen dieselbe Kontrolle, auch vor Tag 91 nach der Änderung.
  {
    name: 'C11 Befund vor 100 Tagen (c2), Änderung vor 60 Tagen: nur D6c, mit der Stufe von L7d',
    stand: () => vollständigerStand({
      profil: { geburtsjahr: geb(76) }, befund: bef(7, 15, { datum: plus(HEUTE, -100) }), dosen: [dosis('d1', DOSIS_AB, 75), dosis('d2', plus(HEUTE, -60), 88)],
    }),
    teile: ['D6c'], nichtTeile: ['L7d'], stufeMin: 'zeitnah',
    extra: [
      ['ohne die Dosis-Hinweise stünde L7d da', (g, stand) => ez.gesamtbild(stand, HEUTE).teile.some((t) => t.id === 'L7d')],
      ['D6c auf „Heute" (dosisHinweise) mindestens zeitnah', (g) => g.dosisHinweise.some((h) => h.id === 'D6c' && rang(h.stufe) >= RANG.zeitnah)],
    ],
  },
];
const GESAMT_ERGEBNISSE = [];

function pruefeGesamtFall(f) {
  const heute = f.heute || HEUTE;
  let stand;
  let g;
  try {
    if (typeof gesamtbildMitDosis !== 'function') throw new Error('gesamtbildMitDosis fehlt in js/dosis.js');
    stand = f.stand();
    g = gesamtbildMitDosis(stand, heute);
  } catch (err) {
    check(`${f.name}: gesamtbildMitDosis läuft`, false, kurzFehler(err));
    return;
  }
  GESAMT_ERGEBNISSE.push({ name: f.name, g, stand, heute });
  const info = () => `stufe=${g.stufe} kopf=„${g.kopf && g.kopf.titel}" teile=[${(g.teile || []).map((t) => `${t.id}/${t.stufe}/${t.quelle}`).join(', ')}]`;
  const hat = (id) => (g.teile || []).some((t) => t.id === id);
  if (f.stufe) check(`${f.name}: Stufe ${f.stufe}`, g.stufe === f.stufe, info());
  if (f.stufeMin) check(`${f.name}: Stufe mindestens ${f.stufeMin}`, rang(g.stufe) >= RANG[f.stufeMin], info());
  for (const id of f.teile || []) check(`${f.name}: Teil ${id}`, hat(id), info());
  for (const id of f.nichtTeile || []) check(`${f.name}: kein Teil ${id}`, !hat(id), info());
  for (const [was, fn] of f.extra || []) {
    let ok = false;
    try { ok = fn(g, stand) === true; } catch { ok = false; }
    check(`${f.name}: ${was}`, ok, info());
  }
}

// ================================================================ Lauf

for (const f of FAELLE) pruefeFall(f);
for (const f of HINWEIS_FAELLE) pruefeHinweisFall(f);
for (const f of GESAMT_FAELLE) pruefeGesamtFall(f);

// ================================================================ Globale Eigenschaften über alle Fälle

/** Eine Eigenschaft über alle Ergebnisse: eine Prüfung, die Verstöße im Detail. */
function global(name, ergebnisse, gilt, beschreibe = (x) => x.name) {
  const schlecht = ergebnisse.filter((x) => {
    try { return gilt(x) !== true; } catch { return true; }
  });
  check(`${name} (${ergebnisse.length} Fälle)`, schlecht.length === 0,
    `${schlecht.length} Verstöße: ${schlecht.slice(0, 5).map((x) => { try { return beschreibe(x); } catch { return x.name; } }).join(' | ')}`);
}

const karten = ERGEBNISSE.filter((x) => x.r);
const mitRichtung = karten.filter((x) => ['mehr', 'weniger'].includes(x.r.richtung));
const ohneDatum = (t) => t.replace(/\b\d{1,2}\.\d{1,2}\.\d{4}\b/g, '');
const checkHeute = (x) => (x.stand.warnzeichen || []).some((w) => w.datum === x.heute && w.ja.length > 0);

global('Form: richtung ist mehr, weniger, gleich oder klaeren', karten, (x) => RICHTUNGEN.includes(x.r.richtung), (x) => `${x.name}: ${x.r.richtung}`);
global('Form: stufe ist eine der sechs Stufen', karten, (x) => rang(x.r.stufe) >= 0, (x) => `${x.name}: ${x.r.stufe}`);
global('Form: texte, gruende und regeln sind Listen', karten, (x) => Array.isArray(x.r.texte) && Array.isArray(x.r.gruende) && Array.isArray(x.r.regeln));
// D6, Grundsatz 8: die Richtung steht nie ohne Pflichttext.
global('D6: jede Richtung (mehr, weniger, gleich) steht mit Pflichttext', karten.filter((x) => ['mehr', 'weniger', 'gleich'].includes(x.r.richtung)),
  (x) => str(x.r.pflicht).length >= 60, (x) => `${x.name}: pflicht=„${str(x.r.pflicht).slice(0, 40)}"`);
global('D6: „mehr"/„weniger" immer mit dem langen Pflichttext („keine Anweisung", „nicht auf eigene Faust")', mitRichtung,
  (x) => /keine Anweisung/.test(str(x.r.pflicht)) && /nicht auf eigene Faust/.test(str(x.r.pflicht)));
global('D6: nie „braucht ohnehin ein Rezept"', karten, (x) => !/ohnehin ein Rezept/.test(alles(x.r)));
// Grundsatz 1 (c): offene Frage vor jeder Richtung.
global('Grundsatz 1: offene Frage → keine Richtung mehr/weniger', karten.filter((x) => x.r.frage), (x) => !['mehr', 'weniger'].includes(x.r.richtung),
  (x) => `${x.name}: ${x.r.richtung}`);
// Das Geburtsjahr (X6) ist eine freie Eingabe, keine Auswahl.
global('Grundsatz 1: eine Frage hat Text, eine Auswahlfrage mindestens zwei Antworten', karten.filter((x) => x.r.frage && x.r.frage.ziel !== 'warncheck'),
  (x) => str(x.r.frage.text).length > 0 && (x.r.frage.feld === 'geburtsjahr' || (Array.isArray(x.r.frage.optionen) && x.r.frage.optionen.length >= 2)),
  (x) => `${x.name}: ${JSON.stringify(x.r.frage).slice(0, 80)}`);
// Grundsatz 5: keine Richtung heißt nicht „alles gut" – aber auch kein „spricht für".
global('Grundsatz 5: bei klaeren kein „spricht für eine etwas höhere/niedrigere Dosis" im Titel', karten.filter((x) => x.r.richtung === 'klaeren'),
  (x) => !/spricht\s+(klar(er)?\s+|eher\s+)?(für|dafür)[^.]*(höhere|niedrigere)\s+Dosis/.test(str(x.r.titel)) && !/spricht klar dafür/.test(str(x.r.titel)),
  (x) => `${x.name}: „${x.r.titel}"`);
global('Grundsatz 5: klaeren ohne offene Frage nennt einen Grund', karten.filter((x) => x.r.richtung === 'klaeren' && !x.r.frage),
  (x) => x.r.gruende.length > 0 || x.r.texte.length > 0);
// DV: eine Schrittgröße gibt es nur mit einer Richtung.
global('DV: Schrittgröße nur bei mehr/weniger', karten.filter((x) => !['mehr', 'weniger'].includes(x.r.richtung)),
  (x) => x.r.schritt === null || x.r.schritt === undefined || x.r.schritt === '', (x) => `${x.name}: ${x.r.richtung}, schritt=„${x.r.schritt}"`);
// Grundsatz 4 / DV: keine neue Tagesdosis, auf keiner Karte.
global('DV: auf keiner Karte eine neue Tagesdosis (Dosis ± 12,5/25 µg, „also …")', karten,
  (x) => neueDosisGenannt(alles(x.r), x.stand, x.heute).length === 0, (x) => `${x.name}: ${neueDosisGenannt(alles(x.r), x.stand, x.heute).join(', ')}`);
global('Grundsatz 4: nie „nehmen Sie mehr/weniger" als Aufforderung', karten,
  (x) => !/\bnehmen Sie (ab (jetzt|morgen|heute) )?(eine? )?(mehr|weniger|zusätzlich)\b/i.test(alles(x.r)) && !/\b(erhöhen|verringern|reduzieren|senken) Sie\b/.test(alles(x.r)));
global('Grundsatz 4: feste Fristen statt „bald"', karten, (x) => !/\bbald\b/i.test(alles(x.r)));
global('Grundsatz 4: „klar" statt „spricht deutlich"', karten, (x) => !/spricht deutlich/.test(alles(x.r)));
global('Grundsatz 4: Zahlen mit Komma', karten, (x) => !/\d\.\d/.test(ohneDatum(alles(x.r))),
  (x) => `${x.name}: ${(ohneDatum(alles(x.r)).match(/.{0,20}\d\.\d.{0,10}/) || [''])[0]}`);
global('Texte ohne HTML-Auszeichnung', karten, (x) => !/<[a-z/!]/i.test(alles(x.r)));
// X10: „teilen" nie ohne Einschränkung auf die Verordnung der Praxis.
global('X10: „teilen" nur mit Einschränkung', karten, (x) => kern(x.r).split(/(?<=[.!?])\s+/)
  .filter((s) => /teilen Sie keine|Tabletten? (nicht )?teilen|teilen Sie (die )?Tabletten? nicht/i.test(s))
  .every((s) => /Praxis|zusätzlich/.test(s)));
// RW1 Grundsatz 5: 112 nie aus einem Laborwert allein. Geändert (Review B33):
// W5 aus dem Befinden hat nach der Entscheidung zu W5 die Stufe 112 – sie kommt
// aus dem Befinden, nicht aus einem Laborwert, und die Kopfzeile bietet zuerst
// das Gespräch an (kopfFuer). Die Karte zeigte dort vorher nur „heute".
const nurW5 = (x) => x.r.gruende.some((g) => g.id === 'W5') && x.r.gruende.filter((g) => g.stufe === 'notruf').every((g) => g.id === 'W5');
global('Notruf-Stufe nur nach einem Warnzeichen-Check mit Ja von heute (oder W5 aus dem Befinden)', karten.filter((x) => x.r.stufe === 'notruf'),
  (x) => checkHeute(x) || nurW5(x));
// DG: Grundlage auf jeder Richtungskarte, auch bei klaeren.
global('DG: Grundlage „Befund vom …" auf jeder Karte ohne offene Frage', karten.filter((x) => !x.r.frage && x.r.befund && x.r.befund.tsh),
  (x) => /Befund vom \d{2}\.\d{2}\.\d{4}/.test(str(x.r.grundlage)), (x) => `${x.name}: „${str(x.r.grundlage).slice(0, 50)}"`);

// L3f / Grundsatz 4: Kein Text der Karte nennt eine längere Frist als ihre
// Stufe (Review B24, B35, B62). 112-Karten ausgenommen: Dort stehen die
// Abschnitte des Checks mit ihren eigenen Fristen.
const FRIST_UNTER = [
  ['zeitnah', /beim nächsten Termin/],
  ['tage', /innerhalb von ein bis zwei Wochen|[Oo]ft wird erst in 6 bis 8 Wochen nachgemessen/],
  ['heute', /in den nächsten Tagen/],
];
global('L3f: kein Text nennt eine längere Frist als die Stufe der Karte', karten.filter((x) => x.r.stufe !== 'notruf'),
  (x) => FRIST_UNTER.every(([ab, m]) => rang(x.r.stufe) < RANG[ab] || !m.test(kern(x.r))),
  (x) => `${x.name}: ${x.r.stufe} | ${kern(x.r).replace(/\s+/g, ' ').slice(0, 160)}`);
// Grundsatz 5: Die Dringlichkeit des Musters bleibt – außer bei D0.4 und D0.5 (Review B24).
global('Grundsatz 5: Karte nie unter der Stufe des Musters (außer D0.4/D0.5)',
  karten.filter((x) => x.r.einschaetzung && !x.r.gruende.some((g) => ['D0.4', 'D0.5'].includes(g.id))),
  (x) => rang(x.r.stufe) >= rang(x.r.einschaetzung.stufeLabor), (x) => `${x.name}: Karte ${x.r.stufe}, Muster ${x.r.einschaetzung.stufeLabor}`);
// Eine Stufe für dieselben Einträge (Review B25, B61): Die Karte liegt nie unter
// der Stufe, die die Einschätzung für Puls, Herzklopfen oder seelische Not
// nennt. Hier ist die Einschätzung der Maßstab – so verlangt es die Vorgabe.
global('Karte nie unter der Stufe der Einschätzung für Puls, Herzklopfen, seelische Not (S4, S4ii, R3, W5)', karten,
  (x) => ez.beschwerdenAuswerten(x.stand, x.heute).texte.filter((t) => ['S4', 'S4ii', 'R3', 'W5'].includes(t.id)).every((t) => rang(x.r.stufe) >= rang(t.stufe)),
  (x) => `${x.name}: Karte ${x.r.stufe}`);
// Notfallnummern immer anrufbar (Review B42, B67, B33): Wer zum Anruf
// auffordert, liefert die Nummer in `anrufe` mit.
const NUMMERN = [
  [/(^|[^\d,.])112([^\d,]|$)/, (a) => a.nummer === '112'],
  [/116 ?117/, (a) => a.nummer === '116117'],
  [/Telefonseelsorge/, (a) => a.nummer === '08001110111'],
  [/Giftnotruf/, (a) => /19240|730730/.test(a.nummer) || a.nummer === '112'],
];
global('Notfallnummern: jede genannte Nummer steht in anrufe', karten,
  (x) => Array.isArray(x.r.anrufe) && NUMMERN.every(([m, passt]) => !m.test([kern(x.r), str(x.r.warnzeichen), ...frageTexte(x.r)].join('\n')) || x.r.anrufe.some(passt)),
  (x) => `${x.name}: anrufe=${JSON.stringify(x.r.anrufe)}`);
global('Form: kopf { titel, text } passt zur Stufe', karten, (x) => x.r.kopf && str(x.r.kopf.titel).length > 0 && str(x.r.kopf.text).length > 0);
// Der Warnzeichen-Check von heute gilt immer (Review C1, C6; RW2 Grundsatz 1a,
// W-D1; RW1 W1–W5, L3f): 112-Zeichen (W1, W4a, W5) → nur die 112-Anzeige,
// keine Richtung; sonst liegt die Karte nie unter seiner Stufe (W2h „heute",
// W2t Tage). Die Gruppen stehen in WARNFRAGEN, die Stufen im Regeltext.
const CHECK_STUFE = { w1: 'notruf', w4a: 'notruf', w5: 'notruf', w2h: 'heute', w2t: 'tage' };
const checkStufe = (x) => {
  const c = [...(x.stand.warnzeichen || [])].reverse().find((w) => w.datum === x.heute);
  const gruppen = c ? WARNFRAGEN.filter((f) => c.ja.includes(f.key)).map((f) => f.gruppe) : [];
  return gruppen.reduce((s, g) => (rang(CHECK_STUFE[g] || 'keine') > rang(s) ? CHECK_STUFE[g] : s), 'keine');
};
global('W-D1: Check von heute mit 112-Zeichen → Karte 112, keine Richtung', karten.filter((x) => checkStufe(x) === 'notruf'),
  (x) => x.r.stufe === 'notruf' && x.r.richtung === 'klaeren', (x) => `${x.name}: ${x.r.richtung}/${x.r.stufe}`);
global('W-D1: Karte nie unter der Stufe des Checks von heute', karten, (x) => rang(x.r.stufe) >= rang(checkStufe(x)),
  (x) => `${x.name}: Karte ${x.r.stufe}, Check ${checkStufe(x)}`);
// L3f (Review C5): Unter „Heute anrufen" sagt D6 nicht „Ein paar Tage Warten schaden nicht".
global('D6 unter Stufe heute ohne „Ein paar Tage Warten"', mitRichtung.filter((x) => rang(x.r.stufe) >= RANG.heute),
  (x) => !/Ein paar Tage Warten|Wochenende/.test(str(x.r.pflicht)), (x) => `${x.name}: ${x.r.stufe}`);
// Das Gesamtbild liegt nie unter der Karte (Review B40, B61).
global('Gesamtbild: nie unter der Dosis-Karte', GESAMT_ERGEBNISSE.filter((x) => x.g.dosis), (x) => rang(x.g.stufe) >= rang(x.g.dosis.stufe),
  (x) => `${x.name}: ${x.g.stufe} < ${x.g.dosis.stufe}`);

// Hinweise für „Heute".
const alleHinweise = HINWEIS_ERGEBNISSE.flatMap((x) => x.l.map((h) => ({ ...x, h })));
global('Hinweise: Form { id, stufe, text }', alleHinweise, (x) => typeof x.h.id === 'string' && rang(x.h.stufe) >= 0 && str(x.h.text).length > 0,
  (x) => `${x.name}: ${JSON.stringify(x.h).slice(0, 80)}`);
global('Hinweise: keine neue Tagesdosis, kein „also …"', alleHinweise, (x) => neueDosisGenannt(hText(x.h), x.stand, x.heute).length === 0,
  (x) => `${x.name}: ${neueDosisGenannt(hText(x.h), x.stand, x.heute).join(', ')}`);
global('Hinweise: feste Fristen statt „bald", Zahlen mit Komma', alleHinweise, (x) => !/\bbald\b/i.test(hText(x.h)) && !/\d\.\d/.test(ohneDatum(hText(x.h))));

console.log(`\n${oks} OK, ${fails} FAIL – ${FAELLE.length} Fälle dosisRichtung, ${HINWEIS_FAELLE.length} Fälle dosisHinweise, ${GESAMT_FAELLE.length} Fälle gesamtbildMitDosis`);
process.exit(fails || !oks ? 1 : 0);
