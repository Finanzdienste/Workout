/*
 * Einschätzung – die App ordnet ein, so weit das verantwortbar ist.
 *
 * Auf Wunsch: „Es soll wirklich so weit wie möglich auch Diagnose sein."
 * Deshalb liest die App ihre Daten nicht nur vor, sondern sagt, was sie
 * bedeuten können: wo ein Wert liegt, welches Muster TSH und fT4 zusammen
 * ergeben, wie dringend das ist, was in den eigenen Daten eine Erklärung
 * sein könnte, wozu die Beschwerden passen und was bei Warnzeichen zu tun ist.
 *
 * Ob man mehr oder weniger nehmen soll, sagt die Dosis-Karte (js/dosis.js) –
 * auch das auf ausdrücklichen Wunsch, als Richtung mit der üblichen
 * Schrittgröße und immer mit dem Rat, zuerst die Praxis anzurufen. Alle
 * Texte hier bleiben ohne Mengenangaben: Sie ordnen ein, die Karte rät.
 *
 * Die Regeln stammen aus zwei Regelwerken, die je drei unabhängige Prüfer
 * (Endokrinologie, Labormedizin, Pharmazie/Patientensicherheit) gegengelesen
 * und ein „rotes Team" an Fallbeispielen angegriffen hat; die Regel-IDs im
 * Code (L2c2, S4, W2h, …) verweisen darauf. Siehe schilddruese/README.md.
 *
 * Reine Rechnung, keine Anzeige: Alles rechnet nur mit dem übergebenen Stand
 * und Tag. So lässt sich jede Regel im Test prüfen, und die Ansicht zeigt
 * genau das, was sie übergibt.
 */
import { tageWeiter, tageZwischen, zahlText, datumKurz } from './datum.js';
import * as sp from './speicher.js';
import { inStandard, normEinheit, pruefeWert, plausibel } from './einheiten.js';

// ---------------------------------------------------------------- Stufen

export const STUFEN = {
  notruf: { rang: 5, titel: 'Sofort 112', text: 'Bitte rufen Sie jetzt 112 an.' },
  heute: { rang: 4, titel: 'Heute anrufen', text: 'Bitte rufen Sie heute noch in der Praxis an. Außerhalb der Sprechzeiten: Ärztlicher Bereitschaftsdienst 116 117.' },
  tage: { rang: 3, titel: 'In den nächsten Tagen anrufen', text: 'Bitte rufen Sie in den nächsten Tagen in der Praxis an. Warten Sie nicht bis zum nächsten Routinetermin.' },
  zeitnah: { rang: 2, titel: 'In ein bis zwei Wochen', text: 'Bitte besprechen Sie das in den nächsten ein bis zwei Wochen mit der Praxis.' },
  termin: { rang: 1, titel: 'Beim nächsten Termin', text: 'Bitte beim nächsten Termin ansprechen.' },
  keine: { rang: 0, titel: 'Kein besonderer Anlass', text: 'Kein besonderer Anlass. Wenn Sie Beschwerden haben, sprechen Sie sie trotzdem an.' },
};

/** Die höchste der Stufen (L3f): notruf > heute > tage > zeitnah > termin > keine. */
export function hoechste(...stufen) {
  return stufen.filter((s) => STUFEN[s]).reduce((a, b) => (STUFEN[b].rang > STUFEN[a].rang ? b : a), 'keine');
}
const mindestens = (stufe, boden) => hoechste(stufe, boden);

/** Die Frist-Sätze unter einem Befund (L3a–L3d). */
const BEFUND_STUFE = {
  tage: 'Bitte rufen Sie in den nächsten Tagen in der Praxis an – falls sich die Praxis nicht schon bei Ihnen gemeldet hat. Warten Sie nicht bis zum nächsten Routinetermin. Die Praxis hat den Befund meist schon gesehen.',
  zeitnah: 'Bitte besprechen Sie den Befund in den nächsten ein bis zwei Wochen mit der Praxis.',
  termin: 'Bitte beim nächsten Termin ansprechen.',
  keine: 'Kein besonderer Anlass. Wenn Sie Beschwerden haben, sprechen Sie sie trotzdem an.',
};

export const FUSSZEILE = 'Automatische Einschätzung der App – sie ersetzt keine ärztliche Beurteilung. Wenn die Praxis Ihnen den Wert schon erklärt hat, gilt deren Einschätzung.';

/*
 * Der feste Satz gegen Selbsthandlung (Grundsatz 2). „Auch geteilt": Wer auf
 * Anordnung eine halbe Tablette nimmt, soll aus „nichts teilen" nicht lesen,
 * jetzt die ganze zu nehmen.
 */
export const GEGEN_SELBST = 'Bitte nehmen Sie die Tabletten bis zum Gespräch weiter genau wie verordnet – auch geteilt, wenn die Praxis es so verordnet hat. Nichts weglassen, nichts zusätzlich teilen, nichts dazunehmen.';

export const P6_TEXT = 'Die Einschätzungen dieser App gelten nur für Erwachsene mit einer bekannten, behandelten Schilddrüsen-Unterfunktion. Sie ersetzen nicht die Beurteilung durch Ihre Ärztin. Die App rechnet nie eine neue Dosis aus. Wenn die Praxis Ihnen einen Wert schon erklärt hat, gilt deren Einschätzung.';

export const PRAXIS_TEXT = 'Die Praxis hat Ihnen diesen Befund schon erklärt. Halten Sie sich an das, was dort besprochen wurde. Wenn Sie unsicher sind, fragen Sie ruhig noch einmal nach.';

export const NOTFALL = {
  1: 'Wichtig: Bei ungewohnt starker Schläfrigkeit, neuer Verwirrtheit oder starkem Auskühlen sofort 112 anrufen.',
  2: 'Wichtig: Bei Herzrasen mit Schwindel, Atemnot oder Brustschmerz sofort 112 anrufen.',
  3: 'Wenn es Ihnen akut schlecht geht: Warnzeichen-Check oder 112.',
};

/** P6: Die Regeln gelten nur bei bekannter, behandelter Unterfunktion. */
export function aktiv(stand) {
  return Boolean(stand.profil.behandelt || stand.profil.ursache);
}

// ---------------------------------------------------------------- Hilfen

const kurz = (iso) => datumKurz(iso);
const zahl = (n) => zahlText(n, 2);

export function alterAm(stand, tag) {
  return stand.profil.geburtsjahr ? Number(tag.slice(0, 4)) - stand.profil.geburtsjahr : null;
}
/* Schutzregeln rechnen ohne Geburtsjahr mit dem höheren Alter (R14). */
const ab65 = (stand, tag) => { const a = alterAm(stand, tag); return a === null || a >= 65; };
const ab70 = (stand, tag) => { const a = alterAm(stand, tag); return a === null || a >= 70; };
/** L4b: Alter ab 65 (oder unbekannt), Herzkrankheit oder Osteoporose. */
const risiko = (stand, tag) => ab65(stand, tag) || stand.profil.herz === 'ja' || stand.profil.osteoporose === 'ja';

/** Die Dosis, die an `tag` galt. */
export function dosisAmIn(stand, tag) {
  let d = null;
  for (const x of stand.dosen) if (x.ab <= tag) d = x;
  return d;
}

export function mittelName(k) {
  return (sp.MITTEL.find(([m]) => m === k) || [k, k])[1];
}
const kurzName = (k) => mittelName(k).replace(/ \(.*\)$/, '');
function aufzaehlung(namen) {
  return namen.length > 1 ? `${namen.slice(0, -1).join(', ')} und ${namen[namen.length - 1]}` : namen[0] || '';
}

/** Hat der Befund eine Praxis-Entscheidung (F8)? Dann gilt deren Einschätzung (L3f). */
export const praxisHatErklaert = (befund) => ['bleibt', 'geaendert', 'nachmessen'].includes(befund.praxis)
  // R1: nur eine Angabe nach der Blutabnahme kann sich auf diesen Befund beziehen
  && (!befund.praxisAm || befund.praxisAm >= befund.datum);

/** Biotin im Spiel (L5d): beim Befund angegeben oder als Mittel eingetragen. */
const biotinImSpiel = (befund, stand) => befund.biotin === 'ja' || stand.mittel.includes('biotin');

/**
 * Einnahmen in den 42 Tagen vor der Abnahme: erfasst (genommen oder bewusst
 * nicht), nicht genommen, ohne Eintrag. `ab`: Tage davor zählen als nicht
 * erfasst – für die Dosis-Karte (D0.7) zählen nur Einträge ab dem Einrichten,
 * nachgetragene Tage aus der Erinnerung sind dafür zu unsicher.
 */
export function einnahmenVor(befund, stand, tage = 42, ab = null) {
  let erfasst = 0;
  let nicht = 0;
  for (let i = 1; i <= tage; i++) {
    const tag = tageWeiter(befund.datum, -i);
    if (ab && tag < ab) continue;
    const x = stand.einnahmen[tag];
    if (x === null) { nicht++; erfasst++; } else if (x) erfasst++;
  }
  return { erfasst, nicht, genommen: erfasst - nicht, unbekannt: tage - erfasst, tage };
}

// ---------------------------------------------------------------- Einordnen (L0a, L1, L1b)

/*
 * Übliche Orientierung ohne Laborbereich, je kanonischer Einheit. „rand" ist
 * die Pufferzone: Darin zählt ein Wert als im Bereich, weil die Bereiche der
 * Messverfahren – gerade beim fT4 – weit auseinanderliegen. „sehr" (R6): erst
 * darunter darf ein fT4 ohne Laborbereich allein dringlich werden.
 */
const ORIENTIERUNG = {
  tsh: { 'mU/l': { im: [0.4, 4.0], rand: [0.3, 4.5] } },
  ft4: {
    'pmol/l': { im: [12, 22], rand: [10, 24], deutlich: [8, 26], sehr: 6 },
    'ng/dl': { im: [0.93, 1.71], rand: [0.78, 1.86], deutlich: [0.62, 2.0], sehr: 0.47 },
    'ng/l': { im: [9.3, 17.1], rand: [7.8, 18.6], deutlich: [6.2, 20], sehr: 4.7 },
  },
  ft3: {
    'pmol/l': { im: [3.1, 6.8], rand: [2.8, 7.0] },
    'pg/ml': { im: [2.0, 4.4], rand: [1.8, 4.6] },
  },
};

export const LAGE_TEXT = {
  'deutlich-unter': 'deutlich unter dem Bereich',
  unter: 'unter dem Bereich',
  'knapp-unter': 'knapp unter dem Bereich',
  'rand-unter': 'im Bereich, am unteren Rand',
  im: 'im Bereich',
  'rand-ueber': 'im Bereich, am oberen Rand',
  'knapp-ueber': 'knapp über dem Bereich',
  ueber: 'über dem Bereich',
  'deutlich-ueber': 'deutlich über dem Bereich',
};

const TEXT_EINHEIT = 'Diese Einheit kennt die App nicht. Bitte tragen Sie den Bereich vom Befund ein (steht meist neben dem Wert) – dann kann die App den Wert einordnen.';
const TEXT_UNPLAUSIBEL = 'Der Wert passt nicht zur gewählten Einheit. Bitte prüfen Sie die Einheit oder tragen Sie den Bereich vom Befund ein – bis dahin ordnet die App ihn nicht ein.';
const TEXT_ORIENTIERUNG = 'Übliche Orientierung, nicht der Bereich Ihres Labors.';
const TEXT_RAND = 'Ohne den Bereich Ihres Labors lässt sich dieser Wert nicht sicher einordnen – er liegt am Rand des üblichen Bereichs. Bitte tragen Sie den Bereich vom Befund ein (steht meist neben dem Wert).';
const TEXT_TSH_EINSEITIG = 'TSH: Auf dem Befund steht meist ein Bereich mit zwei Grenzen (z. B. 0,27–4,20). Bitte tragen Sie beide ein – bis dahin ordnet die App die fehlende Seite nach der üblichen Orientierung ein.';

/*
 * Grenzen wie UG × 0,8 auf neun Stellen runden, bevor verglichen wird: Im
 * Rechner ist 12 × 0,8 = 9,600000000000001 – ein fT4 von genau 9,6 wäre sonst
 * „deutlich unter" (Stufe Tage mit 112-Satz), ein TSH von genau 0,36 bei
 * UG 0,4 nicht mehr „knapp unter". Die Regel (L1) meint die Zahl auf dem Papier.
 */
const rund = (x) => Math.round(x * 1e9) / 1e9;

/**
 * Ein Wert gegen seinen Bereich. Vorrang: persönlicher Zielbereich (nur TSH,
 * in mU/l), dann Laborbereich vom Befund (auch einseitig), dann Orientierung.
 * Beim TSH mit nur einer Grenze ordnet die Orientierung die fehlende Seite ein.
 */
export function einordnen(key, w, { ziel = null } = {}) {
  const leer = { lage: null, genau: null, quelle: null, von: null, bis: null, std: null, umgerechnet: false, sehrNiedrig: false, grund: 'fehlt', text: '', zusatz: '' };
  if (!w || typeof w.wert !== 'number') return leer;
  const std = inStandard(key, w);
  const umgerechnet = std !== null && Math.abs(std - w.wert) > 1e-9;
  const basis = { ...leer, std, umgerechnet, grund: null };
  // `zusatz`: was bei der Anzeige dazugehört (L1) – Orientierung, Rand.
  const mit = (lage, genau, quelle, von, bis, extra = {}) => ({
    ...basis, lage, genau, quelle, von, bis, text: LAGE_TEXT[genau],
    zusatz: quelle === 'orientierung' ? (genau.startsWith('rand') ? `${TEXT_ORIENTIERUNG} ${TEXT_RAND}` : TEXT_ORIENTIERUNG) : '',
    ...extra,
  });

  // Persönlicher Zielbereich (P2): TSH gegen das Ziel, „knapp" wie beim Labor.
  if (ziel && key === 'tsh' && std !== null) {
    if (std < ziel.von) return mit('unter', std >= rund(ziel.von * 0.9) ? 'knapp-unter' : 'unter', 'ziel', ziel.von, ziel.bis);
    if (std > ziel.bis) return mit('ueber', std <= rund(ziel.bis * 1.1) && std <= rund(ziel.bis + 0.5) ? 'knapp-ueber' : 'ueber', 'ziel', ziel.von, ziel.bis);
    return mit('im', 'im', 'ziel', ziel.von, ziel.bis);
  }

  const hatVon = w.von !== null && w.von !== undefined;
  const hatBis = w.bis !== null && w.bis !== undefined;
  if (hatVon || hatBis) {
    // Gegen den Bereich vom Befund – in der Einheit, in der beides dasteht.
    const x = w.wert;
    if (hatVon && x < w.von) {
      const genau = key === 'ft4' && x < rund(w.von * 0.8) ? 'deutlich-unter' : x >= rund(w.von * 0.9) ? 'knapp-unter' : 'unter';
      return mit('unter', genau, 'labor', hatVon ? w.von : null, hatBis ? w.bis : null);
    }
    if (hatBis && x > w.bis) {
      const knapp = x <= rund(w.bis * 1.1) && (key !== 'tsh' || x <= rund(w.bis + 0.5));
      const genau = key === 'ft4' && x > rund(w.bis * 1.2) ? 'deutlich-ueber' : knapp ? 'knapp-ueber' : 'ueber';
      return mit('ueber', genau, 'labor', hatVon ? w.von : null, hatBis ? w.bis : null);
    }
    // TSH mit nur einer Grenze (RW1 L1: Laborbereich heißt von UND bis). Eine
    // vergessene oder unlesbare zweite Grenze ließ sonst ein TSH von 8 „im
    // Bereich" erscheinen, samt „Einstellung passt". Die fehlende Seite ordnet
    // deshalb die Orientierung ein – aber nur, wenn die eingetragene Grenze das
    // zulässt; gegen die Grenze vom Befund wird nie anders entschieden (oben).
    // Quelle ist die Orientierung nur, wenn sie wirklich entscheidet (außerhalb
    // oder am Rand); sonst bleibt es der Bereich, so wie er auf dem Befund steht.
    // Nur in mU/l: Für eine unbekannte Einheit gibt es keine Orientierung.
    if (key === 'tsh' && hatVon !== hatBis && std !== null) {
      const o = ORIENTIERUNG.tsh['mU/l'];
      const [ov, ob] = o.im;
      const einseitig = { einseitig: true };
      if (hatVon && w.von < ob) {
        if (x > o.rand[1]) return mit('ueber', 'ueber', 'orientierung', ov, ob, einseitig);
        if (x > ob) return mit('im', 'rand-ueber', 'orientierung', ov, ob, einseitig);
      }
      if (hatBis && w.bis > ov) {
        if (x < o.rand[0]) return mit('unter', 'unter', 'orientierung', ov, ob, einseitig);
        if (x < ov) return mit('im', 'rand-unter', 'orientierung', ov, ob, einseitig);
      }
      return mit('im', 'im', 'labor', hatVon ? w.von : null, hatBis ? w.bis : null, einseitig);
    }
    return mit('im', 'im', 'labor', hatVon ? w.von : null, hatBis ? w.bis : null);
  }

  // Ohne Bereich: nur mit bekannter Einheit und plausiblem Wert (L0a, R5).
  if (pruefeWert(key, w).unplausibel) return { ...basis, grund: 'unplausibel', text: TEXT_UNPLAUSIBEL };
  const einheit = normEinheit(key, w.einheit);
  const o = einheit && ORIENTIERUNG[key] && ORIENTIERUNG[key][einheit];
  if (!o) return { ...basis, grund: 'einheit', text: TEXT_EINHEIT };
  const x = w.wert;
  const sehrNiedrig = o.sehr !== undefined && x < o.sehr;
  const [von, bis] = o.im;
  if (x < o.rand[0]) return mit('unter', o.deutlich && x < o.deutlich[0] ? 'deutlich-unter' : 'unter', 'orientierung', von, bis, { sehrNiedrig });
  if (x < von) return mit('im', 'rand-unter', 'orientierung', von, bis);
  if (x <= bis) return mit('im', 'im', 'orientierung', von, bis);
  if (x <= o.rand[1]) return mit('im', 'rand-ueber', 'orientierung', von, bis);
  return mit('ueber', o.deutlich && x > o.deutlich[1] ? 'deutlich-ueber' : 'ueber', 'orientierung', von, bis);
}

/** Der persönliche Zielbereich als { von, bis } – oder null. */
export function zielBereich(stand) {
  const p = stand.profil;
  return p.zielVon !== null && p.zielBis !== null ? { von: p.zielVon, bis: p.zielBis } : null;
}

// ---------------------------------------------------------------- Muster (L2)

const MUSTER_GRUPPE = {
  a: 'a', b: 'b', c1: 'c', c2: 'c', c3: 'c', d: 'd', e1: 'e', e2: 'e', e3: 'e', f: 'f', g1: 'g', g2: 'g', h: 'h', t: 't', z2a: 'z', z2b: 'z', z2c: 'z', z3: 'z',
};
const MUSTER_RICHTUNG = {
  a: 'passend', b: 'wenig', c: 'wenig', d: 'viel', e: 'viel', t: 'viel', f: 'unklar', g: 'unklar', h: 'unklar',
};

/**
 * Das Muster aus TSH und fT4. fT3 fließt nicht ein (L1b), außer beim
 * T3-Präparat (L2t). Rückgabe mit den Einordnungen, die es bestimmt haben.
 */
export function musterBestimmen(befund, stand) {
  const p = stand.profil;
  const ziel = zielBereich(stand);
  const zielNiedrig = !ziel && p.zielNiedrig === 'ja';
  const krebsOhneZiel = p.krebs === 'ja' && !ziel && !zielNiedrig;
  const t3 = p.praeparatArt === 't3';
  const tLab = einordnen('tsh', befund.tsh);
  // Das Ziel steht in mU/l – bei unbekannter TSH-Einheit gilt der Laborbereich.
  const tZiel = ziel ? einordnen('tsh', befund.tsh, { ziel }) : null;
  const tZ = tZiel && tZiel.quelle === 'ziel' ? tZiel : tLab;
  const f = einordnen('ft4', befund.ft4);
  const f3 = einordnen('ft3', befund.ft3);
  const tsh = tLab.std;
  const ergebnis = { code: null, variante: '', tLab, tZ, f, f3, tsh, ziel: tZ.quelle === 'ziel' ? ziel : null, zielNiedrig, krebsOhneZiel, t3, tLage: tZ.lage, schwelle: null };
  if (!tZ.lage) return ergebnis;

  let T = tZ.lage;
  let tKnapp = tZ.genau === 'knapp-unter' || tZ.genau === 'knapp-ueber';
  // Die festen Schwellen gelten immer (L1) – auch wenn ein bestätigt
  // ungewöhnlicher Laborbereich (z. B. 0,05–4,0) den Wert noch einschließt.
  // Sonst würde aus TSH 0,05 oder 25 still „Muster a, Einstellung passt".
  // Nur ein Zahlen-Ziel der Ärztin geht vor (L2z1); zielNiedrig ist keines.
  let schwelle = null;
  if (!ergebnis.ziel && tsh !== null && ((tsh < 0.1 && T !== 'unter') || (tsh > 10 && T !== 'ueber'))) {
    schwelle = tsh < 0.1 ? 'unter' : 'ueber';
    T = schwelle;
  }
  if (!ergebnis.ziel && tsh !== null && (tsh < 0.1 || tsh > 10)) tKnapp = false;
  const F = f.lage;
  const fDeutlichUeber = f.genau === 'deutlich-ueber';
  const fDeutlichUnter = f.genau === 'deutlich-unter';
  // Feste Schwellen gelten nur in mU/l – und bei einem Ziel nur außerhalb.
  const sehrNiedrig = tsh !== null && tsh < 0.1 && (!ergebnis.ziel || T === 'unter');

  let code;
  let variante = '';
  if ((T === 'unter' || tLab.lage === 'unter') && F === 'unter') {
    code = 'g2';
    if (ergebnis.ziel || zielNiedrig) variante = 'r11'; // R11: auch bei Ziel
    else if (krebsOhneZiel) variante = 'z3'; // L2z3 gilt auch bei fT4 unter: Zielbereich erfragen
  } else if (T === 'ueber' && F === 'unter') code = 'b';
  else if (T === 'ueber' && F === 'ueber') code = 'f';
  else if (T === 'ueber') {
    if (tsh !== null && tsh > 10) code = 'c3';
    else if (zielNiedrig) code = 'z2c';
    else code = tKnapp ? 'c1' : 'c2';
  } else if (T === 'unter') {
    if (F === 'ueber') {
      if (zielNiedrig) code = 'z2b';
      else if (krebsOhneZiel) { code = 'z3'; variante = 'ft4-ueber'; }
      else if (tKnapp && !fDeutlichUeber) { code = 'e1'; variante = 'aus-d'; } // R7
      else code = 'd';
    } else if (zielNiedrig) code = 'z2a';
    else if (krebsOhneZiel) code = 'z3';
    else if (t3) code = 't';
    else if (sehrNiedrig) code = 'e3';
    else code = tKnapp ? 'e1' : 'e2';
  } else if (zielNiedrig) code = 'z2c'; // L2z2 (iii): TSH im Bereich ist bei gewollter Senkung zu hoch – auch mit auffälligem fT4
  else if (F === 'unter') code = t3 || !fDeutlichUnter ? 'g1' : 'g2';
  else if (F === 'ueber') code = 'h';
  else code = 'a';
  return { ...ergebnis, code, variante, fDeutlichUeber, fDeutlichUnter, sehrNiedrig, tLage: T, schwelle };
}

/*
 * `passt: false`, wenn Muster a trotzdem eine Frist bekommt (R12: TSH unter
 * 0,1 im Zielbereich bei Alter oder Herz) – „Einstellung passt" über „in ein
 * bis zwei Wochen besprechen" wäre ein Widerspruch (L3f). Den Grund nennt
 * dann der Zusatz R12b.
 */
function musterText(m, befund, stand, { passt = true } = {}) {
  const { code, ziel, tLab, f } = m;
  const ohneFt4 = !f.lage;
  const zielText = ziel ? `${zahl(ziel.von)}–${zahl(ziel.bis)} mU/l` : '';
  switch (code) {
    case 'a': {
      let t;
      if (ziel) {
        t = tLab.lage === 'im' || !tLab.lage
          ? `Der TSH-Wert liegt in dem Zielbereich, den Ihre Ärztin für Sie genannt hat (${zielText}).`
          : `Der TSH-Wert liegt außerhalb des Bereichs des Labors, aber in dem Zielbereich, den Ihre Ärztin für Sie genannt hat (${zielText}).`;
      } else {
        t = tLab.quelle === 'orientierung' || f.quelle === 'orientierung'
          ? 'Die Werte liegen im üblichen Bereich (Orientierung, nicht Ihr Labor).'
          : 'Die Werte liegen im Bereich des Labors.';
      }
      if (passt) t += ' Das spricht dafür, dass die Tabletten-Einstellung derzeit passt.';
      if (ohneFt4) t += ' Beurteilt wurde nur der TSH-Wert – unter der Tablette ist er meist der wichtigste Wert.';
      return t;
    }
    case 'b': return 'Muster: deutlich zu wenig Schilddrüsenhormon im Blut. Ein hoher TSH-Wert bedeutet, dass der Körper mehr Hormon anfordert. Häufige Gründe sind vergessene Tabletten, die Einnahme zusammen mit Essen oder anderen Mitteln oder ein veränderter Bedarf. Ob die Dosis angepasst wird, entscheidet Ihre Ärztin.';
    case 'c1': return 'Der TSH-Wert liegt knapp über dem Bereich. Das ist oft nur eine Schwankung – TSH ist zum Beispiel morgens höher als nachmittags.';
    case 'c2': return 'Muster: eher etwas zu wenig Schilddrüsenhormon. Ein erhöhter TSH-Wert bedeutet, dass der Körper etwas mehr Hormon anfordert. Ein einzelner leicht erhöhter Wert ist oft nur eine Schwankung. Ob kontrolliert oder die Dosis angepasst wird, entscheidet Ihre Ärztin.';
    case 'c3': return `Muster: zu wenig Schilddrüsenhormon${ohneFt4 ? '' : ' – auch wenn fT4 noch im Bereich liegt'}. Ein deutlich erhöhter TSH-Wert zeigt, dass der Körper klar mehr Hormon anfordert. Ob die Dosis angepasst wird, entscheidet Ihre Ärztin.`;
    case 'd': return 'Muster: zu viel Schilddrüsenhormon im Blut. Ein niedriger TSH-Wert zusammen mit einem hohen fT4 bedeutet, dass mehr Hormon da ist, als der Körper braucht. Ob die Dosis angepasst wird, entscheidet Ihre Ärztin. Bitte lassen Sie die Tabletten nicht eigenmächtig weg, sondern rufen Sie die Praxis an.';
    case 'e1': return m.variante === 'aus-d'
      ? 'Der TSH-Wert liegt knapp unter dem Bereich, fT4 etwas darüber. Das ist oft ohne Bedeutung – besonders, wenn die Tablette vor der Blutabnahme genommen wurde.'
      : 'Der TSH-Wert liegt knapp unter dem Bereich. Das ist oft ohne Bedeutung.';
    case 'e2': return 'Muster: eher etwas zu viel Schilddrüsenhormon. Ein niedriger TSH-Wert bedeutet, dass der Körper eher mehr Hormon hat, als er anfordert. Ob die Dosis angepasst wird, entscheidet Ihre Ärztin.';
    case 'e3': return `Muster: zu viel Schilddrüsenhormon${ohneFt4 ? '' : ' – auch wenn fT4 im Bereich liegt'}. Ein sehr niedriger TSH-Wert zeigt, dass der Körper deutlich mehr Hormon hat, als er anfordert. Ob die Dosis angepasst wird, entscheidet Ihre Ärztin. Bitte lassen Sie die Tabletten nicht eigenmächtig weg, sondern rufen Sie die Praxis an.`;
    case 'f': return 'Ungewöhnliches Muster: TSH und fT4 sind beide erhöht. Häufigste Gründe: Die Tablette wurde in den Wochen davor unregelmäßig genommen und kurz vor der Blutabnahme wieder regelmäßig genommen oder nachgeholt – oder die Dosis wurde erst vor Kurzem erhöht (TSH sinkt langsamer, als fT4 steigt). Selten stört etwas die Messung oder es liegt eine andere Hormonstörung vor. Oft wird der Wert wiederholt. Bitte mit der Praxis besprechen.';
    case 'g1': return 'fT4 etwas niedrig, TSH im Bereich. Das kommt unter Tabletten vor und ist oft ohne Bedeutung – besonders bei Präparaten mit T3-Anteil (z. B. Novothyral, Prothyrid, Thybon) oder bei bestimmten Mitteln (z. B. Carbamazepin, Phenytoin).';
    case 'g2': return 'Ungewöhnliches Muster, das Ihre Ärztin abklären sollte. Mögliche Gründe sind ein Präparat mit T3-Anteil, eine vor Kurzem gesenkte Dosis, eine schwere andere Erkrankung, bestimmte Medikamente, Besonderheiten der Messung oder selten eine andere Hormonstörung.';
    case 'h': return `Unter L-Thyroxin liegt fT4 häufig etwas über dem Bereich, besonders wenn die Tablette vor der Blutabnahme genommen wurde. Für die Einstellung zählt vor allem der TSH-Wert, und der liegt im Bereich.${m.fDeutlichUeber ? '' : ' Das ist meist unbedenklich.'}`;
    case 't': {
      let t = 'Bei Präparaten mit T3-Anteil liegt der TSH-Wert oft niedrig. Bitte mit Ihrer Ärztin klären, ob das bei Ihnen so gewollt ist.';
      if (m.tsh !== null && m.tsh < 0.1) t += ' Ein so niedriger Wert ist auch bei T3-haltigen Präparaten meist nicht beabsichtigt.';
      if (m.f3.lage === 'ueber') t += ' fT3 ist ebenfalls erhöht – das passt zu zu viel Schilddrüsenhormon. Bitte lassen Sie die Tabletten nicht eigenmächtig weg, sondern rufen Sie die Praxis an.';
      else if (!befund.ft3) t += ' fT3 wurde nicht gemessen – ob wirklich zu viel Hormon im Körper ist, lässt sich deshalb nicht sagen.';
      return t;
    }
    case 'z2a': return 'Ihre Ärztin möchte den TSH-Wert bewusst niedrig halten. Der niedrige Wert kann deshalb so gewollt sein – bitte mit der Praxis abgleichen.';
    case 'z2b': return 'Ihre Ärztin möchte den TSH-Wert niedrig halten. fT4 liegt aber über dem Bereich – bitte mit der Praxis abgleichen.';
    case 'z2c': {
      const fZusatz = { unter: ' fT4 liegt zudem unter dem Bereich.', ueber: ' fT4 liegt zudem über dem Bereich.' }[f.lage] || '';
      return `Der TSH-Wert liegt höher, als es bei einer gewollten Senkung meist angestrebt wird.${fZusatz} Bitte mit der Praxis abgleichen.`;
    }
    case 'z3': return `Nach Schilddrüsenkrebs wird der TSH-Wert oft bewusst niedrig gehalten. Ob das bei Ihnen so ist, weiß nur Ihre Ärztin. Bitte fragen Sie nach Ihrem persönlichen Zielbereich und tragen Sie ihn im Profil ein. Tabletten bis dahin weiter genau wie verordnet.${m.variante === 'ft4-ueber' ? ' Ein niedriger TSH-Wert zusammen mit einem hohen fT4 bedeutet aber, dass mehr Hormon da ist, als der Körper braucht.' : ''}`;
    default: return '';
  }
}

// ---------------------------------------------------------------- Befund einschätzen

/*
 * Behandlungsgrund Hirnanhangdrüse (RW2 P1): Dann bildet die Hirnanhangdrüse
 * selbst zu wenig TSH – der Wert liegt oft niedrig, ganz gleich, wie gut die
 * Tablette passt, und sagt über die Einstellung wenig. Entscheidend ist fT4.
 * Das Wort „Hirnanhangdrüse" steht hier nicht (Entscheidung 11).
 */
const HYPO_TEXT = 'Bei Ihrem Behandlungsgrund (siehe Profil) sagt der TSH-Wert wenig über die Einstellung – entscheidend ist fT4.';

function hypophyseText(f) {
  if (!f.lage) return `${HYPO_TEXT} fT4 fehlt oder lässt sich nicht einordnen. Bitte fragen Sie die Praxis, ob fT4 bestimmt werden soll.`;
  const lage = `fT4 liegt ${LAGE_TEXT[f.genau]}.`;
  if (f.lage === 'unter') return `${HYPO_TEXT} ${lage} Das kann bedeuten, dass zu wenig Schilddrüsenhormon im Körper ist. Ob die Dosis angepasst wird, entscheidet Ihre Ärztin.`;
  if (f.lage === 'ueber') return `${HYPO_TEXT} ${lage} Das kann bedeuten, dass zu viel Schilddrüsenhormon im Körper ist – oder die Tablette wurde kurz vor der Blutabnahme genommen. Ob die Dosis angepasst wird, entscheidet Ihre Ärztin.`;
  return `${HYPO_TEXT} ${lage} Das spricht dafür, dass die Tabletten-Einstellung derzeit passt.`;
}

/*
 * Stufe und Notfallsatz allein aus fT4 – wenn kein TSH einzuordnen ist (B2)
 * oder TSH beim Behandlungsgrund Hirnanhangdrüse wenig sagt (B12). Wie L3a und
 * L3e (i): fT4 deutlich unter → Tage und Satz 1; ohne Laborbereich nur, wenn
 * sehr niedrig (R6, Entscheidung 14). Sonst unter oder über dem Bereich →
 * zeitnah, denn ohne TSH lässt sich nicht sagen, ob es harmlos ist. Ohne
 * eingeordnetes fT4: null.
 */
function nachFt4(f) {
  if (!f.lage) return null;
  if (f.genau === 'deutlich-unter' && (f.quelle !== 'orientierung' || f.sehrNiedrig)) return { stufe: 'tage', satz: 1, regeln: ['L3a', 'L3e1'] };
  if (f.genau === 'deutlich-unter') return { stufe: 'zeitnah', satz: 3, regeln: ['R6'] };
  if (f.lage === 'unter' || f.lage === 'ueber') return { stufe: 'zeitnah', satz: 3, regeln: [] };
  return { stufe: 'keine', satz: 3, regeln: [] };
}
const FT4_RICHTUNG = { unter: 'wenig', ueber: 'viel', im: 'passend' };

/*
 * Gilt die Praxis-Angabe (L3f) für diesen Befund noch? R1: nur mit einem
 * Datum nach der Blutabnahme und ohne Beschwerde, die danach eingetragen
 * wurde – sonst stünde „Halten Sie sich an das, was dort besprochen wurde"
 * über Beschwerden, die im Gespräch noch gar nicht bekannt waren. Ohne Datum
 * (alte Stände: „erklärt" ohne Tag) lässt sich das nicht prüfen; dann bleibt
 * die Stufe der App sichtbar. praxisHatErklaert() selbst bleibt, wie es ist:
 * Die Dosis-Karte liest daraus „die Praxis hat über die Dosis entschieden",
 * und das gilt auch bei neuen Beschwerden.
 */
function praxisGilt(befund, stand, heute) {
  if (!praxisHatErklaert(befund)) return { gilt: false, grund: null };
  if (!befund.praxisAm) return { gilt: false, grund: 'datum' };
  const neu = stand.befinden.some((b) => b.datum > befund.praxisAm && b.datum <= heute && b.beschwerden.length > 0);
  return neu ? { gilt: false, grund: 'beschwerde' } : { gilt: true, grund: null };
}
const PRAXIS_NICHT = {
  datum: 'Sie haben angegeben, dass die Praxis diesen Befund schon erklärt hat, aber nicht, wann. Bitte tragen Sie das Datum beim Befund nach – bis dahin zeigt die App ihre eigene Einschätzung.',
  beschwerde: 'Die Praxis hat Ihnen diesen Befund schon erklärt. Seitdem haben Sie neue Beschwerden eingetragen – deshalb zeigt die App ihre Einschätzung wieder. Bitte sprechen Sie die Beschwerden an.',
};

/*
 * Der Kopf der Befund-Karte (C10): Schild und Satz über der Einschätzung.
 *
 * Die Stufe des Befunds (stufe, stufeLabor) kommt nur aus TSH und fT4
 * (L3a–d). Daran hängen Dosis-Karte, L7d und das Gesamtbild, und die weiteren
 * Werte ändern nichts an der Schilddrüsendosis – deshalb bleibt sie, wie sie
 * ist. Hat aber ein weiterer Wert desselben Befunds eine höhere Frist (E13:
 * Vitamin D über 100 → in den nächsten Tagen), stand über der Karte grün
 * „Kein besonderer Anlass" und darunter „In den nächsten Tagen anrufen".
 * Der Kopf nennt deshalb die höchste Frist des ganzen Befunds und sagt, woher
 * sie kommt: eine Stufe je Befund (Grundsatz 5), und kein Satz darunter nennt
 * eine niedrigere (L3f). Die Praxis-Angabe betrifft nur TSH und fT4.
 *
 * → { stufeGesamt, kopf: { stufe, titel, text, weitere: [Schlüssel der Werte, die ihn anheben] } }
 */
function befundKopf(stufe, frist, praxis, weitere) {
  const gezeigt = praxis ? 'keine' : stufe;
  const oben = hoechste(gezeigt, ...weitere.map((x) => x.stufe));
  if (oben === gezeigt) return { stufeGesamt: gezeigt, kopf: { stufe: gezeigt, titel: STUFEN[gezeigt].titel, text: frist, weitere: [] } };
  const hoch = weitere.filter((x) => x.stufe === oben);
  const namen = aufzaehlung(hoch.map((x) => x.name));
  const schilddruese = praxis ? 'Die Praxis hat Ihnen die Schilddrüsenwerte schon erklärt.'
    : gezeigt === 'keine' ? 'Die Schilddrüsenwerte geben keinen besonderen Anlass.' : '';
  // Eine eigene Frist der Schilddrüsenwerte (Termin, zeitnah) wäre hier die
  // niedrigere – sie steht nicht da, nur die Bitte, beides zusammen anzusprechen.
  const text = schilddruese
    ? `${schilddruese} Für ${namen} gilt aber: ${STUFEN[oben].text}`
    : `Für ${namen} gilt: ${STUFEN[oben].text} Sprechen Sie dabei auch die Schilddrüsenwerte an.`;
  return { stufeGesamt: oben, kopf: { stufe: oben, titel: STUFEN[oben].titel, text, weitere: hoch.map((x) => x.key) } };
}

/** Die Werte [Schlüssel, Name], bei denen ein anderer Eintrag desselben Abnahmetags etwas anderes sagt (C15). */
function doppelteWerte(befund, stand) {
  return [...sp.LABORWERTE, ...sp.WEITERE_WERTE]
    .filter(([k]) => befund[k] && stand.labor.some((l) => l.id !== befund.id && l.datum === befund.datum && sp.wertWiderspruch(l[k], befund[k])))
    .map(([k, name]) => [k, name.replace(/ \(.*\)$/, '')]);
}

/**
 * Die ganze Einschätzung eines Befunds – nur aus Laborwerten und den Angaben
 * zum Befund. Beschwerden und Warnzeichen kommen im Gesamtbild dazu.
 */
export function befundEinschaetzen(befund, stand, heute) {
  const m = musterBestimmen(befund, stand);
  const hypophyse = stand.profil.ursache === 'hypophyse';
  const regeln = [];
  const hinweise = [];
  const werte = sp.LABORWERTE.filter(([k]) => befund[k]).map(([key, name]) => {
    const einordnung = key === 'tsh' ? m.tLab : key === 'ft4' ? m.f : m.f3;
    return { key, name, wert: befund[key], einordnung, ziel: key === 'tsh' && m.ziel ? m.tZ : null };
  });

  // Hinweise zur Einordnung der einzelnen Werte (L0a, L1, L1b, R5, R6)
  werte.forEach(({ key, name, einordnung: e }) => {
    if (e.grund === 'einheit') hinweise.push(`${name}: ${TEXT_EINHEIT}`);
    if (e.grund === 'unplausibel') hinweise.push(`${name}: ${TEXT_UNPLAUSIBEL}`);
    if (e.quelle === 'orientierung' && (e.genau === 'rand-unter' || e.genau === 'rand-ueber')) hinweise.push(`${name}: ${TEXT_RAND}`);
    else if (e.quelle === 'orientierung' && key === 'ft4' && e.lage !== 'im') {
      hinweise.push('fT4: Die Bereiche für fT4 unterscheiden sich je nach Labor stark. Bitte tragen Sie den Bereich vom Befund ein – erst dann ist die Einordnung sicher.');
    }
  });
  if (werte.some((w) => w.einordnung.quelle === 'orientierung')) hinweise.push(TEXT_ORIENTIERUNG);
  if (m.tLab.einseitig) hinweise.push(TEXT_TSH_EINSEITIG);
  if (m.tLab.quelle === 'labor' && m.tLab.std === null && befund.tsh) {
    hinweise.push('TSH: Die Einheit kennt die App nicht. Eingeordnet wird deshalb nur gegen den Bereich vom Befund; die festen Schwellen für sehr hohe oder sehr niedrige Werte gelten nur in mU/l (auch µU/ml oder mIE/l).');
  }
  // Die feste Schwelle hat die Lage aus dem Bereich überstimmt – sagen, warum.
  if (m.schwelle === 'unter' && !hypophyse) hinweise.push('TSH: Ein Wert unter 0,1 mU/l gilt immer als sehr niedrig – auch wenn der eingetragene Bereich ihn noch einschließt.');
  if (m.schwelle === 'ueber') hinweise.push('TSH: Ein Wert über 10 mU/l gilt immer als deutlich erhöht – auch wenn der eingetragene Bereich ihn noch einschließt.');
  if ((m.f3.lage === 'unter' || m.f3.genau === 'rand-unter') && !m.t3) {
    hinweise.push('Unter L-Thyroxin liegt fT3 oft im unteren Bereich. Das ist meist normal und für die Einstellung wenig aussagekräftig.');
    regeln.push('L1b');
  }
  // C15: Ein älterer Stand kann für einen Abnahmetag zwei Einträge mit
  // verschiedenen Werten haben – etwa einen Tippfehler, der als neuer Eintrag
  // berichtigt wurde (das Formular lässt das inzwischen nicht mehr zu).
  // normStand führt sie deshalb nicht zusammen, und die Auswertung rechnet mit
  // dem zuletzt eingetragenen. Welcher stimmt, weiß nur der Befund – ohne
  // diesen Hinweis fiele nie auf, dass einer falsch ist.
  const doppelt = doppelteWerte(befund, stand).map(([, name]) => name);
  if (doppelt.length) {
    hinweise.push(`Für den ${kurz(befund.datum)} gibt es zwei Einträge mit verschiedenen Werten (${aufzaehlung(doppelt)}). Bitte vergleichen Sie beide mit dem Befund und löschen Sie den falschen.`);
  }
  const weitere = weitereWerte(befund, stand);

  const leer = {
    befund, muster: null, gruppe: null, ziel: false, text: '', richtung: null, werte, hinweise, stufe: 'keine', stufeLabor: 'keine',
    stufeText: '', praxisErklaert: false, praxisText: null, gegenSelbst: null, notfall: { satz: 3, text: NOTFALL[3] },
    zusaetze: [], erklaerungen: [], verlauf: [], fragen: [], regeln, plausibel: plausibel(befund, stand), fussnote: FUSSZEILE,
    ohneMuster: false, hypophyse,
    // Ohne Einschätzung aus TSH/fT4 zeigt die Karte keinen Kopf; die weiteren
    // Werte tragen ihre Frist dann selbst (siehe befundKopf).
    stufeGesamt: hoechste(...weitere.map((x) => x.stufe)), kopf: null,
  };
  const praxis = praxisGilt(befund, stand, heute);
  const praxisZusatz = praxis.grund ? [{ id: 'R1', text: PRAXIS_NICHT[praxis.grund] }] : [];
  if (praxis.gilt) regeln.push('L3f-praxis');

  if (!m.code) {
    if (befund.tsh && !m.tLab.lage) regeln.push('L0a');
    const tshText = befund.tsh ? 'Der TSH-Wert lässt sich so nicht einordnen – siehe Hinweis.' : 'Ohne TSH-Wert ergibt sich kein Muster.';
    const ft4 = nachFt4(m.f);
    // B2: Ein auffälliges fT4 zählt auch ohne einordenbaren TSH-Wert. L3a und
    // L3e (i) hängen nicht am Muster – fT4 5 pmol/l ohne TSH ist nicht
    // „kein besonderer Anlass". Ohne auffälliges fT4 bleibt es beim Hinweis.
    if (!ft4 || (ft4.stufe === 'keine' && !hypophyse)) {
      const text = hypophyse ? `${HYPO_TEXT} Ohne fT4-Wert ordnet die App den Befund nicht ein.`
        : befund.tsh ? tshText : `${tshText} Unter der Tablette ist TSH meist der wichtigste Wert.`;
      return { ...leer, text };
    }
    const { stufe, satz } = ft4;
    ft4.regeln.forEach((r) => regeln.push(r));
    const text = hypophyse ? hypophyseText(m.f) : `${tshText} fT4 liegt ${LAGE_TEXT[m.f.genau]} – das sollte die Praxis sehen.`;
    const erklaerungen = erklaerungenFuer(befund, m, stand);
    erklaerungen.forEach((e) => regeln.push(e.id));
    const verlauf = verlaufTexte(befund, stand, verlaufRechnen(befund, stand), stufe, m.tsh, { hypophyse });
    verlauf.forEach((v) => regeln.push(v.id));
    praxisZusatz.forEach((z) => regeln.push(z.id));
    regeln.push({ tage: 'L3a', zeitnah: 'L3b', termin: 'L3c', keine: 'L3d' }[stufe]);
    return {
      ...leer,
      ohneMuster: true,
      text,
      richtung: FT4_RICHTUNG[m.f.lage] || 'unklar',
      stufe,
      stufeLabor: stufe,
      stufeText: BEFUND_STUFE[stufe],
      praxisErklaert: praxis.gilt,
      praxisText: praxis.gilt ? PRAXIS_TEXT : null,
      ...befundKopf(stufe, praxis.gilt ? PRAXIS_TEXT : BEFUND_STUFE[stufe], praxis.gilt, weitere),
      gegenSelbst: stufe === 'keine' ? null : GEGEN_SELBST,
      notfall: { satz, text: NOTFALL[satz] },
      zusaetze: praxisZusatz,
      erklaerungen,
      verlauf,
      regeln: [...new Set(regeln)],
      mInfo: m,
    };
  }

  const { code } = m;
  const gruppe = MUSTER_GRUPPE[code];
  regeln.push(code.startsWith('z2') ? 'L2z2' : `L2${code}`);
  if (m.ziel) regeln.push('L2z1');
  if (m.variante === 'aus-d') regeln.push('R7');
  if (m.variante === 'r11') regeln.push('R11');
  if (hypophyse) regeln.push('P1h');
  const tag = befund.datum;
  const alt = alterAm(stand, tag);
  const rs = risiko(stand, tag);
  const f = m.f;
  const orientFt4 = f.quelle === 'orientierung';
  const zusaetze = [];

  // Grundstufe je Muster (L3b–L3d; Muster b immer „tage", Entscheidung 8)
  let stufe = {
    a: 'keine', b: 'tage', c1: 'termin', c2: 'termin', c3: 'tage', d: 'tage', e1: 'termin', e2: 'termin', e3: 'tage', f: 'zeitnah',
    g1: 'termin', g2: 'zeitnah', h: 'termin', t: 'termin', z2a: 'termin', z2b: 'zeitnah', z2c: 'zeitnah', z3: 'termin',
  }[code];

  const vorher = befund.vorAbnahme === 'ja';
  const biotin = biotinImSpiel(befund, stand);
  const tsh = m.tsh;

  // Sonderfälle der Muster
  if (code === 'e1' && m.variante === 'aus-d' && rs) stufe = mindestens(stufe, 'zeitnah');
  if (code === 'h' && m.fDeutlichUeber && !vorher && !biotin) stufe = mindestens(stufe, 'zeitnah');
  if (code === 't') {
    if (tsh !== null && tsh < 0.1) { stufe = mindestens(stufe, rs ? 'tage' : 'zeitnah'); if (rs) regeln.push('R8'); }
    if (m.f3.lage === 'ueber') stufe = mindestens(stufe, 'tage');
  }
  if (code === 'z2b' && m.fDeutlichUeber) stufe = mindestens(stufe, 'tage');
  if (code === 'z3') {
    // Ohne Zielbereich nach Krebs: immer „zeitnah" (L3b) – der Zielbereich soll bald geklärt werden.
    stufe = mindestens(stufe, 'zeitnah');
    if (m.variante === 'ft4-ueber') stufe = mindestens(stufe, m.fDeutlichUeber ? 'tage' : 'zeitnah');
  }

  // L3a – feste Schwellen und fT4 deutlich außerhalb. TSH < 0,1 hat Ausnahmen
  // (L2z1–z3, L2t): Sie gelten auch, wenn fT4 zusätzlich niedrig ist und der
  // Fall deshalb über R11 bzw. L2z3 zu g2 wird – sonst hinge die Stufe davon
  // ab, ob das Ziel als Zahl oder als Haken eingetragen ist (B17). Beim
  // Behandlungsgrund Hirnanhangdrüse ist ein niedriges TSH erwartet (P1).
  const l3a = [];
  const g2Ausnahme = code === 'g2' && (m.variante === 'z3' || (m.variante === 'r11' && m.zielNiedrig));
  if (tsh !== null && tsh > 10) l3a.push('tsh>10');
  if (m.sehrNiedrig && !['t', 'z2a', 'z2b', 'z2c', 'z3'].includes(code) && !g2Ausnahme && !hypophyse) l3a.push('tsh<0,1');
  if (m.fDeutlichUeber && (m.tLage === 'unter' || m.tLage === 'ueber') && code !== 'e1') {
    if (!orientFt4 || (tsh !== null && tsh > 10)) l3a.push('ft4-deutlich-ueber');
  }
  if (m.fDeutlichUnter && !(code === 'g1' && m.t3)) {
    // R6: ohne Laborbereich allein höchstens „zeitnah"
    if (!orientFt4 || f.sehrNiedrig || (tsh !== null && tsh > 10)) l3a.push('ft4-deutlich-unter');
    else stufe = mindestens(stufe, 'zeitnah');
  }
  if (l3a.length) { stufe = mindestens(stufe, 'tage'); regeln.push('L3a'); }
  if (m.fDeutlichUnter && orientFt4 && !l3a.includes('ft4-deutlich-unter')) regeln.push('R6');

  // R12: TSH < 0,1 im Zielbereich bei Alter/Herz nicht unter „zeitnah"
  let r12Angehoben = false;
  if (!hypophyse && (m.ziel ? m.tZ.lage === 'im' : m.zielNiedrig) && tsh !== null && tsh < 0.1 && (ab65(stand, tag) || stand.profil.herz === 'ja')) {
    r12Angehoben = STUFEN[stufe].rang < STUFEN.zeitnah.rang;
    stufe = mindestens(stufe, 'zeitnah');
    regeln.push('R12');
  }
  // B18: Hebt R12 Muster a an, steht der Grund da – sonst hieße es „passt"
  // und zugleich „in ein bis zwei Wochen besprechen".
  if (r12Angehoben && code === 'a') {
    zusaetze.push({ id: 'R12b', text: 'Ein TSH-Wert unter 0,1 mU/l kann im Alter oder bei einer Herzerkrankung Herz und Knochen belasten – bitte klären Sie mit der Praxis, ob Ihr Zielbereich so noch gilt.' });
  }

  // L4b – Alter, Herz, Knochen bei zu viel Hormon (beim Behandlungsgrund
  // Hirnanhangdrüse nur, wenn fT4 selbst zu hoch ist)
  const ohneZiel = !m.ziel && stand.profil.zielNiedrig !== 'ja';
  if (ohneZiel && rs && (!hypophyse || f.lage === 'ueber') && (['d', 'e2', 'e3', 't'].includes(code) || (code === 'e1' && m.variante === 'aus-d'))) {
    if (code === 'e2' || code === 't') stufe = mindestens(stufe, 'zeitnah');
    zusaetze.push({ id: 'L4b', text: 'Gerade im Alter kann dauerhaft zu viel Schilddrüsenhormon Herz (zum Beispiel Herzrhythmusstörungen wie Vorhofflimmern) und Knochen belasten – deshalb bald ansprechen. Bitte die Tabletten nicht eigenmächtig weglassen oder teilen.' });
    regeln.push('L4b');
  }

  // B12: Behandlungsgrund Hirnanhangdrüse – die Stufe kommt aus fT4 (ohne
  // fT4: Termin, damit er bestimmt wird). Was nicht am niedrigen TSH hängt,
  // bleibt: TSH > 10 oder fT4 deutlich außerhalb (L3a), Muster b (Entscheidung 8).
  if (hypophyse) {
    const ft4 = nachFt4(f);
    let s = ft4 ? ft4.stufe : 'termin';
    if (l3a.length) s = mindestens(s, 'tage');
    if (code === 'b') s = mindestens(s, 'tage');
    stufe = s;
  }

  // Verlauf (L6) vor L4a – dort zählt, ob TSH gestiegen ist
  const verlaufInfo = verlaufRechnen(befund, stand);

  // L4a – im Alter wird ein etwas höheres TSH oft hingenommen
  if (!hypophyse && alt !== null && alt >= 70 && ohneZiel && (code === 'c1' || code === 'c2') && tsh !== null
    && tsh <= (alt >= 80 ? 7 : 6) && verlaufInfo.tsh !== 'gestiegen') {
    zusaetze.push({ id: 'L4a', text: 'Im Alter wird ein etwas höherer TSH-Wert oft bewusst hingenommen. Fragen Sie Ihre Ärztin, welcher Zielbereich für Sie gilt.' });
    regeln.push('L4a');
  }

  // B17: g2 bei Krebs ohne Ziel – die Bitte um den Zielbereich aus L2z3 gilt auch hier.
  if (code === 'g2' && m.variante === 'z3') {
    zusaetze.push({ id: 'L2z3', text: 'Nach Schilddrüsenkrebs wird der TSH-Wert oft bewusst niedrig gehalten. Ob das bei Ihnen so ist, weiß nur Ihre Ärztin. Bitte fragen Sie nach Ihrem persönlichen Zielbereich und tragen Sie ihn im Profil ein.' });
  }

  // P3: Präparat unbekannt – bei niedrigem TSH kann ein T3-Anteil der Grund sein.
  if (!hypophyse && gruppe === 'e' && ['', 'unbekannt'].includes(stand.profil.praeparatArt)) {
    zusaetze.push({ id: 'P3', text: 'Bei Präparaten mit T3-Anteil (z. B. Novothyral, Prothyrid, Thybon) liegt der TSH-Wert oft niedrig. Bitte tragen Sie im Profil ein, welche Tablette Sie nehmen, und sagen Sie es der Praxis.' });
  }

  // R12: veralteter Zielbereich. Ohne eigene Frist – die Frist kommt aus der
  // Stufe, und „beim nächsten Termin" unter Stufe Tage wäre zu spät (L3f).
  if (m.ziel && (!stand.profil.zielAm || tageZwischen(stand.profil.zielAm, heute) > 365)) {
    zusaetze.push({ id: 'R12', text: 'Gilt Ihr Zielbereich noch? Er wurde vor über einem Jahr oder ohne Datum eingetragen – ein Zielbereich kann sich mit der Zeit ändern. Bitte lassen Sie ihn von der Praxis bestätigen.' });
  }
  zusaetze.push(...praxisZusatz);

  // L3e – der gezielte Notfallsatz
  let satz = 3;
  const fSehrTief = m.fDeutlichUnter && (!orientFt4 || f.sehrNiedrig || (tsh !== null && tsh > 10));
  if (fSehrTief || (tsh !== null && tsh > 20)) satz = 1;
  else if (hypophyse) { if (f.lage === 'ueber' && (code === 'd' || l3a.includes('ft4-deutlich-ueber'))) satz = 2; }
  else if (code === 'd' || code === 'e3' || (code === 't' && (m.f3.lage === 'ueber' || (tsh !== null && tsh < 0.1 && rs)))) satz = 2;
  if (satz !== 3) regeln.push(`L3e${satz}`);

  // Text, bei Muster am Ziel mit Kennzeichnung (L2z1)
  let text;
  if (hypophyse) text = hypophyseText(f);
  else {
    text = musterText(m, befund, stand, { passt: !r12Angehoben });
    if (code === 'd' && (vorher || biotin)) text += ' Ein Teil kann an der Messung liegen – der niedrige TSH-Wert bleibt aber wichtig.';
    if (m.ziel && code !== 'a' && m.tZ.lage !== 'im') text += ` (Gemessen an Ihrem persönlichen Zielbereich von ${zahl(m.ziel.von)} bis ${zahl(m.ziel.bis)} mU/l.)`;
  }

  const erklaerungen = erklaerungenFuer(befund, m, stand);
  erklaerungen.forEach((e) => regeln.push(e.id));
  const verlauf = verlaufTexte(befund, stand, verlaufInfo, stufe, tsh, { hypophyse });
  verlauf.forEach((v) => regeln.push(v.id));
  zusaetze.forEach((z) => { if (!regeln.includes(z.id)) regeln.push(z.id); });

  regeln.push({ tage: 'L3a', zeitnah: 'L3b', termin: 'L3c', keine: 'L3d' }[stufe]);

  return {
    ...leer,
    muster: code,
    gruppe,
    ziel: Boolean(m.ziel),
    text,
    richtung: hypophyse ? FT4_RICHTUNG[f.lage] || 'unklar' : MUSTER_RICHTUNG[gruppe] || (code === 'z2c' ? 'wenig' : 'viel'),
    stufe,
    stufeLabor: stufe,
    stufeText: BEFUND_STUFE[stufe] || STUFEN[stufe].text,
    praxisErklaert: praxis.gilt,
    praxisText: praxis.gilt ? PRAXIS_TEXT : null,
    ...befundKopf(stufe, praxis.gilt ? PRAXIS_TEXT : BEFUND_STUFE[stufe] || STUFEN[stufe].text, praxis.gilt, weitere),
    // Grundsatz 2: außer bei Muster a – hat a aber eine Frist (R12), gilt der Satz auch dort.
    gegenSelbst: code === 'a' && stufe === 'keine' ? null : GEGEN_SELBST,
    notfall: { satz, text: NOTFALL[satz] },
    zusaetze,
    erklaerungen,
    verlauf,
    regeln: [...new Set(regeln)],
    mInfo: m,
  };
}

// ---------------------------------------------------------------- Erklärungen (L5)

const GRUPPE_A = ['kalzium', 'eisen', 'magnesium', 'multimineral', 'antazida', 'sucralfat', 'soja', 'ballaststoffe', 'kaffee', 'phosphatbinder', 'orlistat', 'raloxifen'];

function erklaerungenFuer(befund, m, stand) {
  const { code } = m;
  const gruppe = MUSTER_GRUPPE[code];
  const e = [];
  const tag = befund.datum;
  const imFenster = (d, fenster = 42) => d <= tag && tageZwischen(d, tag) < fenster;

  // L5a – etwas wurde weniger als 6 Wochen vorher geändert
  const dosisNeu = stand.dosen.some((d, i) => i > 0 && imFenster(d.ab));
  const mittelNeu = stand.mittelWechsel.some((w) => imFenster(w.am));
  if (dosisNeu || mittelNeu || befund.packung === 'ja' || befund.mittelGeaendert === 'ja') {
    e.push({ id: 'L5a', text: 'Die Dosis, das Präparat oder ein anderes Mittel wurde weniger als 6 Wochen vor der Blutabnahme geändert. Der Wert hat sich womöglich noch nicht eingependelt – das dauert etwa 6–8 Wochen. Ihre Ärztin wird das berücksichtigen.' });
  }

  // L5b – vergessene Tabletten (nur b, c, f); R9: eigene Angabe zählt auch
  if (['b', 'c', 'f'].includes(gruppe)) {
    const x = einnahmenVor(befund, stand);
    const ausDaten = x.erfasst >= 28 && (x.nicht >= 3 || x.genommen / x.erfasst < 0.9);
    const zusatzF = gruppe === 'f' ? ' Wenn die Tablette vor der Blutabnahme wieder regelmäßig genommen oder nachgeholt wurde, kann das dieses Muster erklären.' : '';
    const schluss = ' Vergessene Tabletten können dazu beitragen, dass der TSH-Wert steigt – das ist häufig und kein Vorwurf. Wie Sie mit vergessenen Tabletten umgehen sollen, fragen Sie bitte Ihre Ärztin.';
    if (ausDaten) {
      e.push({ id: 'L5b', text: `In den 6 Wochen vor der Blutabnahme wurde die Tablette an ${x.nicht} von ${x.erfasst} erfassten Tagen nicht genommen.${schluss}${zusatzF}` });
    } else if (befund.vergessen === 'mehrere') {
      e.push({ id: 'L5b', text: `Sie haben angegeben, in den 6 Wochen vor der Blutabnahme an mehreren Tagen Tabletten vergessen oder ausgelassen zu haben.${schluss}${zusatzF}` });
    } else if (x.erfasst < 28) {
      e.push({ id: 'L5b3', text: 'Die Einnahme wurde in dieser Zeit zu selten eingetragen, um etwas darüber zu sagen.' });
    }
  }

  // L5c – Tablette vor der Abnahme
  if (befund.vorAbnahme === 'ja') {
    // Ohne Muster (kein TSH, B2): Ein hohes fT4 kann an der Tablette vorher liegen.
    const erklaert = ['d', 'f', 'h', 'z2b'].includes(code) || m.variante === 'aus-d' || (!code && m.f.lage === 'ueber');
    const teile = [];
    if (erklaert) teile.push('Die Tablette wurde am Tag der Blutabnahme vorher genommen. Der fT4-Wert kann dadurch einige Stunden lang etwas höher ausfallen. Der TSH-Wert wird dadurch kaum verändert und bleibt aussagekräftig.');
    if (erklaert && m.t3) teile.push('Bei Präparaten mit T3-Anteil kann auch fT3 deutlich höher ausfallen.');
    teile.push('Tipp für das nächste Mal: Am Tag der Blutabnahme die Tablette erst nach der Abnahme nehmen – außer die Praxis sagt etwas anderes.');
    e.push({ id: 'L5c', text: teile.join(' ') });
  }

  // L5d – Biotin (alle Muster)
  if (biotinImSpiel(befund, stand)) {
    const grund = 'Biotin (Vitamin B7, oft in Haar-, Haut- und Nägel-Mitteln und Vitamin-B-Komplexen) kann bei manchen Labortests die Messung verfälschen: TSH erscheint zu niedrig, fT4 und fT3 zu hoch.';
    let zusatz;
    if (['d', 'e', 'h', 't'].includes(gruppe) || ['z2a', 'z2b', 'z3'].includes(code) || (!code && m.f.lage === 'ueber')) zusatz = 'Das kann aussehen wie zu viel Hormon. Bitte sagen Sie es der Praxis – oft wird der Wert nach einer Biotin-Pause wiederholt.';
    else if (gruppe === 'a' || gruppe === 'c' || code === 'z2c') zusatz = 'Dadurch kann ein zu hoher TSH-Wert verdeckt sein. Bitte sagen Sie es der Praxis.';
    else if (gruppe === 'f') zusatz = 'Das kann das erhöhte fT4 erklären, nicht aber das erhöhte TSH.';
    else zusatz = 'Bitte sagen Sie es der Praxis.';
    const falls = befund.biotin === 'ja' ? '' : 'Falls Sie in den Tagen vor der Blutabnahme Biotin genommen haben: ';
    e.push({ id: 'L5d', text: `${falls}${grund} ${zusatz}` });
  }

  // L5e – Mittel aus dem Profil
  const mt = stand.mittel;
  const saetze = [];
  const hat = (k) => mt.includes(k);
  if (['b', 'c'].includes(gruppe)) {
    const a = GRUPPE_A.filter((k) => hat(k) && stand.mittelAbstand[k] !== 'ja');
    a.forEach((k) => saetze.push(`${kurzName(k)} kann die Aufnahme der Tablette verringern, wenn es zu nah an der Tablette genommen wird – dann kann der TSH-Wert steigen.`));
    if (hat('ppi')) saetze.push('Magenschutz kann die Aufnahme der Tablette verringern – auch mit Abstand.');
    if (hat('colestyramin')) saetze.push('Colestyramin und ähnliche Mittel können die Aufnahme der Tablette verringern.');
    ['oestrogen_tablette', 'tamoxifen', 'raloxifen', 'enzyminduktor'].filter(hat)
      .forEach((k) => saetze.push(`${kurzName(k)} kann den Bedarf an Schilddrüsenhormon erhöhen.`));
    if (hat('lithium')) saetze.push('Lithium kann den TSH-Wert erhöhen.');
  }
  if (gruppe === 'g' && hat('enzyminduktor')) saetze.push(`${kurzName('enzyminduktor')} kann den Bedarf an Schilddrüsenhormon erhöhen und fT4 senken.`);
  if (['d', 'e', 'g', 't'].includes(gruppe) || ['z2a', 'z2b', 'z3'].includes(code)) {
    if (stand.profil.kortison === 'ja' || befund.kortison === 'ja') saetze.push('Kortison kann den TSH-Wert senken.');
    if (hat('metformin')) saetze.push('Metformin kann den TSH-Wert senken.');
  }
  ['amiodaron', 'jod', 'krebsmittel'].filter(hat)
    .forEach((k) => saetze.push(`${kurzName(k)} kann die Schilddrüse direkt beeinflussen – die Werte können sich dadurch auch später noch ändern.`));
  if (saetze.length) {
    saetze.push('Bitte setzen Sie kein Mittel eigenmächtig ab, sondern sprechen Sie es an.');
    e.push({ id: 'L5e', text: saetze.join(' ') });
  }

  // L5g – schwere Krankheit, Kortison, Kontrastmittel (nicht bei a)
  if (code !== 'a' && (befund.krank === 'ja' || befund.kortison === 'ja' || befund.kontrastmittel === 'ja')) {
    e.push({ id: 'L5g', text: 'Sie waren in den Wochen vor der Blutabnahme schwer krank oder im Krankenhaus oder haben Kortison oder Kontrastmittel bekommen. Das kann die Schilddrüsenwerte vorübergehend verändern. Ihre Ärztin beurteilt, ob der Wert später wiederholt werden soll.' });
  }

  // L5h – Abnahme am Nachmittag
  if (befund.abnahmeUhr && befund.abnahmeUhr >= '12:00' && ['c1', 'e1', 'e2'].includes(code)) {
    e.push({ id: 'L5h', text: 'Die Blutabnahme war am Nachmittag. Der TSH-Wert ist nachmittags oft etwas niedriger als morgens.' });
  }

  // Reihenfolge (L3f): a, b, c, d, g, e, f, h – mit Vorrang
  const ordnung = ['L5a', 'L5b', 'L5b3', 'L5c', 'L5d', 'L5g', 'L5e', 'L5f', 'L5h'];
  e.sort((x, y) => ordnung.indexOf(x.id) - ordnung.indexOf(y.id));
  const nachVorn = (id) => { const i = e.findIndex((x) => x.id === id); if (i > 0) e.unshift(...e.splice(i, 1)); };
  if (m.variante === 'aus-d') nachVorn('L5c');
  if (code === 'b') nachVorn('L5b');
  if (['d', 'e', 'h', 'f', 't'].includes(gruppe)) nachVorn('L5d');
  return e;
}

// ---------------------------------------------------------------- Verlauf (L5f, L6, L6b)

/** Der letzte frühere Befund mit diesem Wert. */
function vorigerMit(befund, stand, key) {
  return [...stand.labor].reverse().find((l) => l.id !== befund.id && l.datum < befund.datum && l[key]) || null;
}

/**
 * Sind zwei Befunde vergleichbar (L5f)? Gleiche umrechenbare Einheit, kein
 * anderes Labor, Bereichsgrenzen nicht mehr als 10 % verschieden.
 */
export function vergleichbar(a, b, key) {
  const wa = a[key];
  const wb = b[key];
  if (!wa || !wb) return false;
  if (inStandard(key, wa) === null || inStandard(key, wb) === null) return false;
  const na = (a.laborName || '').trim().toLowerCase();
  const nb = (b.laborName || '').trim().toLowerCase();
  if (na && nb && na !== nb) return false;
  for (const g of ['von', 'bis']) {
    if (wa[g] !== null && wb[g] !== null && wa[g] !== undefined && wb[g] !== undefined) {
      const ga = inStandard(key, { wert: wa[g], einheit: wa.einheit });
      const gb = inStandard(key, { wert: wb[g], einheit: wb.einheit });
      if (ga !== null && gb !== null && gb > 0 && Math.abs(ga - gb) / gb > 0.1) return false;
    }
  }
  return true;
}

function verlaufRechnen(befund, stand) {
  const info = { tsh: null, vorher: null, vergleichbar: false, ft4: null, vorherFt4: null };
  const v = vorigerMit(befund, stand, 'tsh');
  if (v && befund.tsh) {
    info.vorher = v;
    info.vergleichbar = vergleichbar(v, befund, 'tsh');
    if (info.vergleichbar) {
      const a = inStandard('tsh', v.tsh);
      const b = inStandard('tsh', befund.tsh);
      // Grundsatz 4: derselbe Bezug wie beim Muster – das Ziel der Ärztin vor
      // dem Laborbereich. Sonst hieß ein Anstieg von 0,2 auf 1,2 bei Ziel
      // 0,1–0,5 „TSH liegt jetzt im Bereich", während das Muster „eher zu
      // wenig Hormon" sagt (B7).
      const ziel = zielBereich(stand);
      const ea = einordnen('tsh', v.tsh, ziel ? { ziel } : {});
      const eb = einordnen('tsh', befund.tsh, ziel ? { ziel } : {});
      const la = ea.lage;
      const lb = eb.lage;
      info.mitZiel = ea.quelle === 'ziel' && eb.quelle === 'ziel';
      info.zielNiedrig = !ziel && stand.profil.zielNiedrig === 'ja';
      const gestiegen = (b >= a * 1.5 && b - a >= 0.5) || (la === 'unter' && (lb === 'im' || lb === 'ueber')) || (la === 'im' && lb === 'ueber');
      const gesunken = (b <= a / 1.5 && a - b >= 0.5) || (la === 'ueber' && (lb === 'im' || lb === 'unter')) || (la === 'im' && lb === 'unter');
      info.tsh = gestiegen ? 'gestiegen' : gesunken ? 'gesunken' : 'gleich';
      info.a = a; info.b = b; info.la = la; info.lb = lb;
    }
  }
  const vf = vorigerMit(befund, stand, 'ft4');
  if (vf && befund.ft4 && vergleichbar(vf, befund, 'ft4')) {
    const a = inStandard('ft4', vf.ft4);
    const b = inStandard('ft4', befund.ft4);
    info.vorherFt4 = vf;
    info.ft4 = b >= a * 1.2 ? 'gestiegen' : b <= a * 0.8 ? 'gesunken' : 'gleich';
  }
  return info;
}

function wertMitEinheit(a, b) {
  return a.einheit === b.einheit
    ? `von ${zahl(a.wert)} auf ${zahl(b.wert)} ${b.einheit}`
    : `von ${zahl(a.wert)} ${a.einheit} auf ${zahl(b.wert)} ${b.einheit}`;
}

/*
 * `hypophyse`: Beim Behandlungsgrund Hirnanhangdrüse sagt die Richtung des
 * TSH nichts über die Hormonmenge – dann nur die Zahlen, ohne Übersetzung.
 */
function verlaufTexte(befund, stand, info, stufe, tsh, { hypophyse = false } = {}) {
  const t = [];
  const v = info.vorher;
  if (v && !info.vergleichbar) {
    const la = einordnen('tsh', v.tsh);
    const lb = einordnen('tsh', befund.tsh);
    const lage = (e) => (e.lage ? LAGE_TEXT[e.lage] : 'ohne Einordnung');
    t.push({ id: 'L5f', text: `Anderes Labor oder anderer Test als beim letzten Mal – die Werte nur eingeschränkt vergleichen. Die App vergleicht deshalb nur, wo der Wert jeweils im Bereich lag: am ${kurz(v.datum)} ${lage(la)}, jetzt ${lage(lb)}.` });
  } else if (v && info.tsh) {
    const { la, lb } = info;
    const werte = wertMitEinheit(v.tsh, befund.tsh);
    const bereich = info.mitZiel ? 'Zielbereich' : 'Bereich';
    // Übersetzen (Grundsatz 3), außer beim Wechsel in den Bereich hinein (R10).
    // Bei gewollter Senkung ohne Zahlen ist der Laborbereich kein Ziel: Dort
    // heißt „im Bereich" schon „höher als gewollt" (L2z2 C) – also übersetzen.
    const uebersetzen = !hypophyse && (lb !== 'im' || info.zielNiedrig);
    let s;
    if (lb === 'im' && la !== 'im' && la && !info.zielNiedrig) {
      s = `TSH liegt jetzt im ${bereich} (am ${kurz(v.datum)} ${la === 'unter' ? 'unter' : 'über'} dem ${bereich}): ${werte}.`;
    } else if (info.tsh === 'gestiegen') {
      s = `TSH ist seit dem ${kurz(v.datum)} gestiegen: ${werte}.`;
      if (uebersetzen) s += ' Ein steigender TSH-Wert bedeutet: Der Körper meldet eher zu wenig Hormon.';
    } else if (info.tsh === 'gesunken') {
      s = `TSH ist seit dem ${kurz(v.datum)} gesunken: ${werte}.`;
      if (uebersetzen) s += ' Ein sinkender TSH-Wert bedeutet: eher mehr Hormon im Körper.';
    } else {
      s = `TSH ist etwa gleich geblieben (${zahl(v.tsh.wert)} → ${zahl(befund.tsh.wert)} ${befund.tsh.einheit}).`;
      const schwelle = tsh !== null && (tsh < 0.1 || tsh > 10);
      if (STUFEN[stufe].rang <= STUFEN.termin.rang && !schwelle) s += ' Schwankungen dieser Größe sind normal.';
    }
    const dA = dosisAmIn(stand, v.datum);
    const dB = dosisAmIn(stand, befund.datum);
    if (dA && dB) {
      const geaendert = stand.dosen.some((d) => d.ab > v.datum && d.ab <= befund.datum && sp.tagesdosis(d) !== sp.tagesdosis(dA));
      s += geaendert ? ' Dazwischen wurde die Dosis geändert.' : ' Die Dosis war in dieser Zeit gleich.';
    }
    if (v.abnahmeUhr && befund.abnahmeUhr) {
      const min = (u) => Number(u.slice(0, 2)) * 60 + Number(u.slice(3));
      if (Math.abs(min(v.abnahmeUhr) - min(befund.abnahmeUhr)) > 240) s += ' Die Blutabnahmen waren zu unterschiedlichen Tageszeiten – TSH schwankt über den Tag.';
    }
    t.push({ id: 'L6', text: s });
  }
  if (info.ft4) {
    const vf = info.vorherFt4;
    const wort = { gestiegen: 'gestiegen', gesunken: 'gesunken', gleich: 'etwa gleich geblieben' }[info.ft4];
    let s = `fT4 ist seit dem ${kurz(vf.datum)} ${wort}: ${wertMitEinheit(vf.ft4, befund.ft4)}.`;
    const ja = (x) => x === 'ja';
    if (['ja', 'nein'].includes(vf.vorAbnahme) && ['ja', 'nein'].includes(befund.vorAbnahme) && ja(vf.vorAbnahme) !== ja(befund.vorAbnahme)) {
      s += ' Die Tablette wurde nur bei einer der beiden Blutabnahmen vorher genommen – fT4 ist deshalb nur eingeschränkt vergleichbar.';
    }
    t.push({ id: 'L6b', text: s });
  }
  return t;
}

/** Der jüngste Befund mit Muster – als Einschätzung, oder null. */
export function letzterBefund(stand, heute) {
  for (let i = stand.labor.length - 1; i >= 0; i--) {
    if (stand.labor[i].datum > heute) continue;
    const e = befundEinschaetzen(stand.labor[i], stand, heute);
    if (e.muster) return e;
  }
  return null;
}

/** Der jüngste Befund mit einem TSH-Wert (auch ohne Einordnung) – oder null. */
function letzterMitTsh(stand, heute) {
  return [...stand.labor].reverse().find((l) => l.tsh && l.datum <= heute) || null;
}

// ---------------------------------------------------------------- Weitere Werte (E13, L9)

export const WEITERE_HINWEIS = 'Der Laborbereich ist nicht Ihr persönlicher Zielwert – den legt die Ärztin fest. Diese Werte ändern nichts an Ihrer Schilddrüsendosis.';

export function hatDiabetes(stand) {
  return stand.mittel.includes('diabetes') || stand.mittel.includes('metformin') || stand.profil.diabetes === 'ja';
}

/** Einordnung der freiwilligen Werte eines Befunds. */
export function weitereWerte(befund, stand) {
  const liste = [];
  sp.WEITERE_WERTE.forEach(([key, name]) => {
    const w = befund[key];
    if (!w) return;
    const texte = [];
    let stufe = 'keine';
    const std = inStandard(key, w);
    const p = pruefeWert(key, w);
    const unter = w.von !== null && w.von !== undefined && w.wert < w.von;
    const ueber = w.bis !== null && w.bis !== undefined && w.wert > w.bis;
    // E13: Passt die Einheit nicht zum Wert, erst nachfragen und bis dahin
    // nicht einordnen. Ist der Wert bestätigt und steht der Bereich vom Befund
    // dabei, gilt er (B13) – sonst bliebe gerade ein bestätigter Vitamin-D-Wert
    // von 210 ng/ml ohne die Stufe Tage, die schon 180 ng/ml bekommen.
    const hatBereich = (w.von !== null && w.von !== undefined) || (w.bis !== null && w.bis !== undefined);
    if (p.unplausibel && !(befund.bestaetigt && hatBereich)) {
      texte.push(befund.bestaetigt
        ? 'Der Wert passt nicht gut zur gewählten Einheit. Bitte tragen Sie den Bereich vom Befund ein (steht meist neben dem Wert) – dann ordnet die App den Wert ein.'
        : 'Der Wert passt nicht zur gewählten Einheit – bitte prüfen. Bis dahin ordnet die App ihn nicht ein.');
      liste.push({ key, name, wert: w, stufe, texte });
      return;
    }
    switch (key) {
      case 'hb':
        if (unter) { stufe = 'zeitnah'; texte.push('Der Wert spricht für eine Blutarmut. Besprechen Sie ihn innerhalb von ein bis zwei Wochen mit der Praxis.'); }
        else if (ueber) { stufe = 'termin'; texte.push('Hämoglobin liegt über dem Bereich des Labors. Bitte ansprechen, falls die Praxis es noch nicht mit Ihnen besprochen hat.'); }
        break;
      case 'ferritin': {
        const crp = befund.crp;
        const crpHoch = crp && crp.bis !== null && crp.bis !== undefined && crp.wert > crp.bis;
        if (std !== null && std < 30) { stufe = 'zeitnah'; texte.push('Der Wert spricht für Eisenmangel, auch wenn das Labor „im Bereich" schreibt. Besprechen Sie ihn innerhalb von ein bis zwei Wochen mit der Praxis, denn die Ursache sollte geklärt werden.'); }
        else if (std !== null && std <= 100 && crpHoch) texte.push('Bei einer Entzündung kann Ferritin trotz Eisenmangel normal wirken.');
        else if ((std !== null && std > 400) || ueber) { stufe = 'termin'; texte.push('Der Wert ist erhöht. Sprechen Sie ihn beim nächsten Termin an.'); }
        break;
      }
      case 'b12': {
        // E13c nennt die Schwellen in beiden Einheiten (< 200 bzw. 200–400 pg/ml).
        // Über die Umrechnung × 0,738 verschoben sie sich auf etwa 203 und 406.
        const pg = normEinheit('b12', w.einheit) === 'pg/ml';
        const x = pg ? w.wert : std;
        const [tief, grau] = pg ? [200, 400] : [150, 300];
        if (unter || (x !== null && x < tief)) { stufe = 'zeitnah'; texte.push('Der Wert spricht für einen Vitamin-B12-Mangel. Besprechen Sie ihn innerhalb von ein bis zwei Wochen mit der Praxis.'); }
        else if (x !== null && x <= grau) { stufe = 'termin'; texte.push('Ein Wert im unteren Bereich schließt einen Mangel nicht sicher aus. Bei Beschwerden wie Müdigkeit, Kribbeln oder Gangunsicherheit ansprechen; dann kann ein genauerer Test (Holo-TC oder MMA) sinnvoll sein.'); }
        break;
      }
      case 'vitd':
        if (std !== null) {
          if (std < 12) { stufe = 'termin'; texte.push('Der Wert zeigt einen Vitamin-D-Mangel. Sprechen Sie ihn beim nächsten Termin an.'); }
          else if (std < 20) { stufe = 'termin'; texte.push('Der Wert ist knapp. Fragen Sie beim nächsten Termin, ob Sie Vitamin D nehmen sollen.'); }
          else if (std <= 100) texte.push('Der Wert ist ausreichend, auch wenn das Labor einen höheren Bereich angibt.');
          else { stufe = 'tage'; texte.push('Der Wert ist sehr hoch. Nehmen Sie Ihr Vitamin-D-Präparat bis zur Rücksprache nicht weiter und rufen Sie in den nächsten Tagen die Praxis an.'); }
          texte.push('Der Wert schwankt mit der Jahreszeit.');
        }
        break;
      case 'hba1c':
        if (std !== null) {
          if (hatDiabetes(stand)) texte.push('Ihr Zielwert ist persönlich, im Alter oft 7 bis 8 % (53 bis 64 mmol/mol). Fragen Sie die Praxis, welcher für Sie gilt.');
          else if (std >= 6.5) { stufe = 'zeitnah'; texte.push('Der Wert ist erhöht und kann auf Diabetes hindeuten. Besprechen Sie ihn innerhalb von ein bis zwei Wochen mit der Praxis.'); }
          else if (std >= 5.7) { stufe = 'termin'; texte.push('Der Wert ist leicht erhöht. Sprechen Sie ihn beim nächsten Termin an.'); }
          texte.push('Blutarmut, Eisen- oder B12-Mangel und Nierenerkrankungen können den Wert verfälschen.');
        }
        break;
      case 'ldl':
        texte.push('Ihr persönlicher Zielwert hängt von Herz, Gefäßen, Diabetes und Alter ab. Fragen Sie die Praxis danach. Ein hohes LDL ist kein Grund, mehr Schilddrüsentablette zu nehmen.');
        break;
      case 'crp':
        if (ueber) { stufe = 'termin'; texte.push('Der Entzündungswert ist erhöht. Dann sind Ferritin und manche anderen Werte schwerer zu beurteilen. Wenn Sie sich krank fühlen, sprechen Sie mit der Praxis.'); }
        break;
      case 'natrium':
        if (unter || ueber) { stufe = 'termin'; texte.push(`Natrium liegt ${unter ? 'unter' : 'über'} dem Bereich des Labors. Bitte ansprechen, falls die Praxis es noch nicht mit Ihnen besprochen hat.`); }
        break;
      default:
    }
    liste.push({ key, name, wert: w, stufe, texte, auffaellig: stufe !== 'keine' });
  });
  return liste;
}

// ---------------------------------------------------------------- Beschwerden (S1–S4)

/*
 * S1: Gewichte je Seite. Neutral: Konzentration, Haarausfall, Schlaf,
 * Gewicht – und der alte Punkt „trockene Haut oder Haarausfall" (C22): Er
 * meinte das eine oder das andere, und Haarausfall passt zu beidem.
 */
export const GEWICHT_WENIG = { frieren: 1, verstopfung: 1, trockenhaut: 1, gesicht: 1, muede: 0.5, stimmung: 0.5, schmerzen: 0.5 };
export const GEWICHT_VIEL = { schwitzen: 1, herz: 1, zittern: 1, waerme: 1, abnahme: 1, durchfall: 0.5 };
const IM_ALTER_NICHT = ['muede', 'stimmung', 'schmerzen'];
const EIGENE_PFADE = ['puls', 'lebensmuede'];

export const W5_TEXT = 'Danke, dass Sie das angeben. Bitte bleiben Sie damit nicht allein und sprechen Sie heute noch mit jemandem darüber: Telefonseelsorge 0800 111 0 111 oder 0800 111 0 222 (rund um die Uhr, kostenlos, anonym), Ihre Hausarztpraxis oder abends und am Wochenende der Bereitschaftsdienst 116 117. Wenn Sie in Gefahr sind, sich etwas anzutun: sofort 112.';

function genanntIn(stand, heute, tage) {
  const ab = tageWeiter(heute, -(tage - 1));
  const s = new Set();
  stand.befinden.filter((b) => b.datum >= ab && b.datum <= heute).forEach((b) => b.beschwerden.forEach((k) => s.add(k)));
  return s;
}

/** Wozu passen die Beschwerden? Dazu die eigenen Pfade für Puls und seelische Not. */
export function beschwerdenAuswerten(stand, heute) {
  const g28 = genanntIn(stand, heute, 28);
  const g14 = genanntIn(stand, heute, 14);
  const alt70 = ab70(stand, heute);
  const alt65 = ab65(stand, heute);
  const gewicht = (k, tabelle) => (alt70 && IM_ALTER_NICHT.includes(k) ? 0 : tabelle[k] || 0);
  let punkteWenig = 0;
  let punkteViel = 0;
  g28.forEach((k) => { punkteWenig += gewicht(k, GEWICHT_WENIG); punkteViel += gewicht(k, GEWICHT_VIEL); });
  const richtung = punkteWenig >= 3 && punkteViel <= 1 ? 'wenig' : punkteViel >= 3 && punkteWenig <= 1 ? 'viel' : null;
  const gezaehlt = [...g28].filter((k) => !EIGENE_PFADE.includes(k));
  const texte = [];
  const regeln = [];
  const add = (id, stufe, text) => { texte.push({ id, stufe, text }); regeln.push(id); };

  // W5 über das Befinden – vor allem anderen
  // W5 hat die Stufe 112 (Regelwerk 1, offen 15) – der Text bietet aber
  // zuerst die Telefonseelsorge an; 112 gilt bei akuter Gefahr.
  if (g14.has('lebensmuede')) add('W5', 'notruf', W5_TEXT);
  else if (g14.has('stimmung')) add('W5b', 'keine', 'Wenn die Stimmung sehr schlecht ist: Telefonseelsorge 0800 111 0 111 (rund um die Uhr, kostenlos).');

  // S4 – Puls und Herzklopfen
  const letzter = letzterBefund(stand, heute);
  const frisch = letzter && tageZwischen(letzter.befund.datum, heute) <= 90;
  if (g14.has('puls')) {
    add('S4', 'heute', 'Ein neu unregelmäßiger Puls oder Herzstolpern sollte ärztlich angeschaut werden – möglich ist zum Beispiel Vorhofflimmern, auch wenn Ihr Schilddrüsenwert passt. Bitte rufen Sie heute oder in den nächsten Tagen in der Praxis an, außerhalb der Sprechzeiten 116 117. Mit Schwindel, Atemnot, Brustschmerz oder Ohnmacht: sofort 112.');
  }
  if (g14.has('herz')) {
    // Bei einer Ursache in der Hirnanhangdrüse sagt ein niedriges TSH nichts
    // über zu viel Hormon (P1h) – dann gilt der R3-Weg, nicht S4ii.
    const tshTief = frisch && stand.profil.ursache !== 'hypophyse'
      && (['d', 'e2', 'e3', 't', 'z2a', 'z2b', 'z3'].includes(letzter.muster) || (letzter.mInfo.tsh !== null && letzter.mInfo.tsh < 0.1));
    // R3: An mehreren Tagen eingetragen heißt „seit Tagen" – dann heute anrufen.
    // Das gilt erst recht, wenn ein niedriger TSH-Wert dazu passt (B8): vorher
    // bekam gerade dieser Fall nur „in den nächsten Tagen".
    const tage = new Set(stand.befinden.filter((b) => b.datum >= tageWeiter(heute, -13) && b.datum <= heute && b.beschwerden.includes('herz')).map((b) => b.datum)).size;
    if (tshTief && tage >= 2) {
      add('S4ii', 'heute', 'Sie haben an mehreren Tagen Herzklopfen eingetragen. Zusammen mit einem niedrigen TSH-Wert kann das bedeuten, dass zu viel Schilddrüsenhormon im Körper ist. Bitte rufen Sie heute in der Praxis an, außerhalb der Sprechzeiten 116 117. Bei Herzrasen mit Schwindel, Atemnot oder Brustschmerz: sofort 112. Bitte die Tabletten nicht eigenmächtig weglassen.');
    } else if (tshTief) {
      add('S4ii', alt65 || stand.profil.herz === 'ja' ? 'heute' : 'tage', 'Herzklopfen zusammen mit einem niedrigen TSH-Wert kann bedeuten, dass zu viel Schilddrüsenhormon im Körper ist. Bitte rufen Sie in den nächsten Tagen in der Praxis an – im Alter oder bei Herzkrankheit noch heute. Bei Herzrasen mit Schwindel, Atemnot oder Brustschmerz: sofort 112. Bitte die Tabletten nicht eigenmächtig weglassen.');
    } else {
      // Wer den Check heute schon gemacht hat, wird nicht noch einmal dorthin geschickt.
      const zumCheck = stand.warnzeichen.some((w) => w.datum === heute) ? '' : ' Gehen Sie dazu kurz den Warnzeichen-Check durch.';
      add('R3', tage >= 2 ? 'heute' : 'termin', tage >= 2
        ? `Sie haben an mehreren Tagen Herzklopfen eingetragen. Bitte rufen Sie heute in der Praxis an, außerhalb der Sprechzeiten 116 117.${zumCheck}`
        : `Wenn Sie seit Tagen Herzklopfen haben: Bitte rufen Sie heute in der Praxis an, außerhalb der Sprechzeiten 116 117.${zumCheck}`);
    }
  }

  // W2t über das Befinden: „ungewollt abgenommen" zählt in S1 als Punkt und
  // führt zusätzlich zum eigenen Pfad W2t (RW1 S1) – ungewollter
  // Gewichtsverlust ist im Alter ein Warnzeichen, nicht nur ein Zeichen für
  // zu viel Hormon.
  if (g28.has('abnahme')) add('W2t', 'tage', 'Sie haben „ungewollt abgenommen" eingetragen. Bitte rufen Sie in den nächsten Tagen in der Praxis an. Wenn es nicht warten kann und die Praxis geschlossen ist: 116 117.');

  // S2 – Richtung. Unter einer Richtung steht der feste Satz gegen
  // Selbsthandlung (Grundsatz 2) – gerade wer „zu viel Hormon" liest, soll
  // nicht von sich aus weglassen.
  if (gezaehlt.length) {
    const kopf = richtung === 'wenig' ? 'Ihre Beschwerden könnten dazu passen, dass zu wenig Schilddrüsenhormon im Körper ist.'
      : richtung === 'viel' ? 'Ihre Beschwerden könnten dazu passen, dass zu viel Schilddrüsenhormon im Körper ist.'
        : 'Aus Ihren Beschwerden ergibt sich kein klares Muster.';
    let s = `${kopf} Ob die Schilddrüse der Grund ist, zeigt nur eine Blutabnahme – solche Beschwerden haben im Alter sehr oft andere Gründe. Bitte ändern Sie nichts an den Tabletten, sondern sprechen Sie die Beschwerden an.`;
    if (richtung) s += ` ${GEGEN_SELBST}`;
    const tshFrisch = letzterMitTsh(stand, heute);
    if (!tshFrisch || tageZwischen(tshFrisch.datum, heute) > 90) s += ' Fragen Sie in der Praxis, ob eine Blutabnahme sinnvoll ist.';
    add('S2', 'termin', s);
  }
  // S1 – Hinweis im Alter
  if (alt65 && (g28.has('muede') || g28.has('schmerzen'))) add('S1', 'keine', 'Hinweis: Im Alter zeigt sich zu viel Schilddrüsenhormon oft nicht als Unruhe, sondern als Schwäche, Müdigkeit oder Gewichtsverlust.');
  // S2b – viele Beschwerden
  if (gezaehlt.length >= 5) add('S2b', 'zeitnah', 'Sie haben zurzeit viele Beschwerden. Bitte vereinbaren Sie in den nächsten ein bis zwei Wochen einen Termin, damit die Ursache geklärt wird.');

  // S3 – Abgleich mit dem letzten Befund. Der erste Dosis-Eintrag ist keine
  // Änderung (Entscheidung 3) – beim Einrichten beginnt er am Einrichtungstag,
  // oft nach dem nachgetragenen Befund (B20). Beim Behandlungsgrund
  // Hirnanhangdrüse zählt die Richtung aus fT4, nicht das TSH-Muster (B12).
  if (frisch && !stand.dosen.some((d, i) => i > 0 && d.ab > letzter.befund.datum && d.ab <= heute)) {
    const r = letzter.gruppe;
    const wenigLabor = letzter.hypophyse ? letzter.richtung === 'wenig' : ['b', 'c'].includes(r);
    const vielLabor = letzter.hypophyse ? letzter.richtung === 'viel' : ['d', 'e'].includes(r);
    const imBereich = letzter.hypophyse ? letzter.richtung === 'passend' : r === 'a';
    if ((richtung === 'wenig' && wenigLabor) || (richtung === 'viel' && vielLabor)) add('S3', 'termin', 'Ihre Beschwerden passen zum letzten Laborwert. Bitte sprechen Sie beides zusammen an.');
    else if ((richtung === 'wenig' && vielLabor) || (richtung === 'viel' && wenigLabor)) add('S3', 'termin', 'Ihre Beschwerden passen nicht zum letzten Laborwert. Das spricht eher für andere Ursachen – bitte ansprechen.');
    else if (imBereich && (punkteWenig + punkteViel) > 0) {
      let s = 'Ihre Schilddrüsenwerte lagen zuletzt im Bereich. Dann liegt die Ursache der Beschwerden oft woanders, zum Beispiel bei Blutarmut, Eisen- oder Vitamin-B12-Mangel, Vitamin-D-Mangel, Blutzucker, Schlaf, Stimmung oder anderen Medikamenten. Die Beschwerden sind trotzdem ernst zu nehmen – bitte sprechen Sie sie an.';
      const auff = weitereWerte(letzter.befund, stand).filter((x) => x.auffaellig).map((x) => x.name);
      if (auff.length) s += ` Auffällig war zuletzt: ${aufzaehlung(auff)}.`;
      add('S3', 'termin', s);
    }
  }

  const stufe = hoechste(...texte.map((t) => t.stufe));
  return { punkteWenig, punkteViel, richtung, anzahl: gezaehlt.length, genannt: [...g28], genannt14: [...g14], texte, stufe, regeln };
}

/** R2: Notfallwörter in einer Notiz – dann zeigt die App sofort den 112-Text. */
export function notfallWorte(text) {
  return /brust|atemnot|luftnot|keine luft|ohnm[aä]cht|bewusstlos|l[äa]e?hm|verwirr|schlaganfall|sprachst[öo]|herzinfarkt|kollab/i.test(String(text || ''));
}

// ---------------------------------------------------------------- Warnzeichen (W0–W5)

export const WARNFRAGEN = [
  { key: 'brust', gruppe: 'w1', text: 'Schmerzen oder Engegefühl in der Brust' },
  { key: 'herzrasen', gruppe: 'w1', text: 'Plötzliches starkes Herzrasen oder Herzstolpern mit Schwindel' },
  { key: 'atemnot', gruppe: 'w1', text: 'Plötzliche oder starke Atemnot, auch in Ruhe' },
  { key: 'ohnmacht', gruppe: 'w1', text: 'Ohnmacht (kurz bewusstlos)' },
  { key: 'schlaganfall', gruppe: 'w1', text: 'Hängender Mundwinkel, Schwäche in Arm oder Bein einer Körperseite, plötzliche Sprach- oder Sehstörung' },
  { key: 'schlaefrig', gruppe: 'w1', text: 'Ungewohnt starke Schläfrigkeit, kaum wach zu halten' },
  { key: 'verwirrt', gruppe: 'w1', text: 'Plötzliche, neue Verwirrtheit' },
  { key: 'kalt', gruppe: 'w1', text: 'Körpertemperatur unter 35 °C oder starkes Auskühlen' },
  { key: 'fieber', gruppe: 'w1', text: 'Hohes Fieber zusammen mit Herzrasen und starker Unruhe oder Verwirrtheit' },
  { key: 'blutung', gruppe: 'w1', text: 'Starke Blutung, die nicht aufhört' },
  { key: 'packung', gruppe: 'w4a', text: 'Auf einmal eine große Menge Schilddrüsen-Tabletten eingenommen (z. B. eine halbe oder ganze Packung)' },
  { key: 'mehrere', gruppe: 'w4a', text: 'Heute mehr als eine Tablette zu viel auf einmal genommen' },
  { key: 'lebensmuede', gruppe: 'w5', text: 'So niedergeschlagen, dass Sie manchmal nicht mehr leben möchten' },
  { key: 'herzklopfen', gruppe: 'w2h', text: 'Herzklopfen seit Tagen oder Puls neu unregelmäßig' },
  { key: 'puls', gruppe: 'w2h', text: 'Ruhepuls mehrmals über 100 oder unter 50 Schläge pro Minute (falls gemessen)' },
  { key: 'erbrechen', gruppe: 'w2h', text: 'Erbrechen länger als einen Tag oder Durchfall über mehrere Tage' },
  { key: 'zuviele', gruppe: 'w2h', text: 'Über mehrere Tage versehentlich zu viele Schilddrüsen-Tabletten genommen' },
  { key: 'keine_tabletten', gruppe: 'w2h', text: 'Keine Schilddrüsen-Tabletten mehr im Haus' },
  { key: 'blutungszeichen', gruppe: 'w2h', text: 'Blutungszeichen: Nasenbluten, das nicht aufhört, Blut im Urin oder Stuhl, große blaue Flecken ohne Grund', nurWenn: 'marcumar' },
  { key: 'unruhe', gruppe: 'w2t', text: 'Zittern oder innere Unruhe seit Tagen' },
  { key: 'abnahme', gruppe: 'w2t', text: 'Ungewollt abgenommen – mehr als 5 % des Gewichts in wenigen Monaten (z. B. 3 kg bei 60 kg)' },
  { key: 'muede_frieren', gruppe: 'w2t', text: 'Neue starke Müdigkeit oder ständiges Frieren seit Wochen' },
  { key: 'hals', gruppe: 'w2t', text: 'Neue Schwellung am Hals, Schluckbeschwerden oder Heiserkeit seit Wochen' },
  { key: 'schwellung', gruppe: 'w2t', text: 'Neu deutlich geschwollene Beine oder geschwollenes Gesicht' },
  { key: 'eine_zuviel', gruppe: 'w4b', text: 'Heute versehentlich genau eine Tablette zu viel genommen (einmalig)' },
];

/** Die Fragen des Checks, die für diesen Stand gelten (Blutungszeichen nur mit Marcumar). */
export function warnfragenFuer(stand) {
  return WARNFRAGEN.filter((f) => !f.nurWenn || stand.mittel.includes(f.nurWenn));
}

const TEL_112 = { nummer: '112', text: '112 anrufen' };
const TEL_116 = { nummer: '116117', text: 'Bereitschaftsdienst 116 117' };
const TEL_SEELSORGE = [{ nummer: '08001110111', text: 'Telefonseelsorge 0800 111 0 111' }, { nummer: '08001110222', text: 'Telefonseelsorge 0800 111 0 222' }];

/** Der Giftnotruf fürs Bundesland – ohne Angabe 112. */
export function giftnotrufAnruf(stand) {
  const n = sp.giftnotruf(stand.profil.bundesland);
  return n ? { nummer: n.replace(/\s/g, ''), text: `Giftnotruf ${n}` } : TEL_112;
}

const W3_TEXT = 'Nach Ihren Angaben liegt kein Warnzeichen vor. Die App kann aber nicht alles erkennen: Wenn Sie sich deutlich schlechter fühlen als sonst, rufen Sie die Praxis an – auch wenn hier nichts angezeigt wird. Übrige Beschwerden beim nächsten Termin ansprechen. Wenn es schlimmer wird, machen Sie den Check noch einmal.';
/** W3, wenn das Befinden selbst eine Frist hat: Sie steht da, nicht „beim nächsten Termin". */
const w3MitBefinden = (stufe) => `Im Check haben Sie kein Warnzeichen angekreuzt. Für Ihre eingetragenen Beschwerden gilt aber weiter: ${STUFEN[stufe].text} Wenn Sie sich deutlich schlechter fühlen oder es schlimmer wird, machen Sie den Check noch einmal.`;

/*
 * Die Texte aus dem Befinden, die selbst zum Anruf auffordern und zum Check
 * schicken (R3: „Gehen Sie dazu kurz den Warnzeichen-Check durch", S4, S4ii,
 * W2t) – mit P6 auch S2b, das dann im Gesamtbild steht. Sie stehen auch ohne
 * P6-Haken auf „Heute". W5 nicht: Die Frage danach steht im Check selbst,
 * und seine Antwort ist neuer.
 */
const BEFINDEN_ZUM_CHECK = ['S4', 'S4ii', 'R3', 'W2t'];

/**
 * Auswertung des Checks: die Stufe und je Gruppe ein Abschnitt.
 *
 * `heute` – nur für einen Check von heute übergeben (siehe checkAuswerten):
 * Dann zählen die Texte aus dem Befinden mit, die zum Check geschickt haben.
 * Vorher antwortete „Nichts davon" darauf mit „Beim nächsten Termin …
 * Übrige Beschwerden beim nächsten Termin ansprechen", während die Karte,
 * die zum Check geschickt hatte, „heute anrufen" verlangte (C9, L3f). Dann:
 *   - `befinden`: diese Texte [{ id, stufe, text }], soweit sie über der
 *     Stufe des Checks liegen – die Ansicht zeigt sie über den Abschnitten,
 *   - `stufe`: die höchste aus Check und diesen Texten,
 *   - W3 nennt statt „beim nächsten Termin" die Frist aus dem Befinden und
 *     trägt deren Stufe (samt 116 117 als Anruf, wenn der Satz sie nennt).
 * `stufeCheck` ist immer die Stufe des Checks allein. Ohne `heute` ist
 * `stufe` dasselbe und `befinden` leer – so rechnet die Dosis-Karte (W-D1).
 */
export function warnzeichenAuswerten(ja, stand, heute = null) {
  const gewaehlt = warnfragenFuer(stand).filter((f) => ja.includes(f.key));
  const in_ = (g) => gewaehlt.some((f) => f.gruppe === g);
  const abschnitte = in_('w1')
    ? [{ id: 'W1', stufe: 'notruf', text: 'Bitte rufen Sie jetzt 112 an. Im Zweifel lieber 112. Wenn Sie nicht selbst anrufen können, bitten Sie Angehörige oder Nachbarn.', anrufe: [TEL_112] }]
    : checkAbschnitte(ja, stand, in_);
  const stufeCheck = hoechste(...abschnitte.map((a) => a.stufe));
  if (!heute) return { stufe: stufeCheck, stufeCheck, abschnitte, befinden: [] };

  const pfade = [...BEFINDEN_ZUM_CHECK, ...(aktiv(stand) ? ['S2b'] : [])];
  const befinden = beschwerdenAuswerten(stand, heute).texte
    .filter((t) => pfade.includes(t.id) && STUFEN[t.stufe].rang > STUFEN[stufeCheck].rang)
    .map(({ id, stufe: s, text }) => ({ id, stufe: s, text }));
  const stufe = hoechste(stufeCheck, ...befinden.map((t) => t.stufe));
  const w3 = abschnitte.find((a) => a.id === 'W3');
  if (w3 && befinden.length) {
    w3.stufe = stufe;
    w3.text = w3MitBefinden(stufe);
    // Der Satz der Stufe „heute" nennt den Bereitschaftsdienst – dann ist er anrufbar.
    if (/116 117/.test(w3.text)) w3.anrufe = [TEL_116];
  }
  return { stufe, stufeCheck, abschnitte, befinden };
}

/**
 * Ein gespeicherter Check, ausgewertet für die Anzeige: Nur ein Check von
 * heute rechnet das Befinden von heute mit – ein älterer bleibt, wie er war.
 */
export function checkAuswerten(check, stand, heute) {
  return warnzeichenAuswerten(check.ja, stand, check.datum === heute ? heute : null);
}

/** Die Abschnitte des Checks ohne W1 (W1 blendet alles andere aus). */
function checkAbschnitte(ja, stand, in_) {
  const abschnitte = [];
  if (in_('w4a')) {
    const gift = giftnotrufAnruf(stand);
    abschnitte.push({ id: 'W4a', stufe: 'notruf', text: `Bitte rufen Sie jetzt den Giftnotruf an${gift === TEL_112 ? ' – oder, weil kein Bundesland eingetragen ist, 112' : ''}. Halten Sie die Packung bereit. Bei Beschwerden wie Herzrasen, Brustschmerz, Atemnot oder Verwirrtheit: sofort 112.`, anrufe: gift === TEL_112 ? [TEL_112] : [gift, TEL_112] });
  }
  // C12: Der Text nennt abends und am Wochenende den Bereitschaftsdienst –
  // gerade dann muss er anrufbar sein, wie bei W5 aus dem Befinden.
  if (in_('w5')) abschnitte.push({ id: 'W5', stufe: 'notruf', text: W5_TEXT, anrufe: [...TEL_SEELSORGE, TEL_116, TEL_112] });
  if (!in_('w4a') && in_('w2h')) {
    abschnitte.push({ id: 'W2h', stufe: 'heute', text: 'Bitte rufen Sie heute noch in der Praxis an. Außerhalb der Sprechzeiten: Ärztlicher Bereitschaftsdienst 116 117. Wenn es schlimmer wird oder ein Notfallzeichen dazukommt: 112.', anrufe: [TEL_116] });
  }
  if (!in_('w4a') && !in_('w2h') && in_('w2t')) {
    abschnitte.push({ id: 'W2t', stufe: 'tage', text: 'Bitte rufen Sie in den nächsten Tagen in der Praxis an. Wenn es nicht warten kann und die Praxis geschlossen ist: 116 117.', anrufe: [TEL_116] });
  }
  // W4b beruhigt („in der Regel unbedenklich … wie gewohnt") – nicht unter
  // dem Giftnotruf (W4a) und nicht, wenn über Tage zu viele genommen wurden:
  // Kein Text darf eine niedrigere Stufe nennen als die oben (L3f).
  if (in_('w4b') && !in_('w4a') && !ja.includes('zuviele')) {
    let t = 'Eine einzelne versehentlich doppelte Tablette ist in der Regel unbedenklich. Nehmen Sie die nächste Tablette wie gewohnt und erwähnen Sie es beim nächsten Kontakt mit der Praxis. Bitte lassen Sie deshalb keine Tablette weg.';
    if (stand.profil.praeparatArt === 't3' || stand.profil.herz === 'ja') t += ' Wenn heute Herzklopfen oder Unruhe auftreten, rufen Sie die Praxis an.';
    abschnitte.push({ id: 'W4b', stufe: 'termin', text: t, anrufe: [] });
  }
  if (!abschnitte.length) abschnitte.push({ id: 'W3', stufe: 'termin', text: W3_TEXT, anrufe: [] });
  abschnitte.sort((a, b) => STUFEN[b.stufe].rang - STUFEN[a.stufe].rang);
  return abschnitte;
}

// ---------------------------------------------------------------- Abstand (M1–M14)

function plusMinuten(hhmm, min) {
  const [h, m] = hhmm.split(':').map(Number);
  const t = h * 60 + m + min;
  return t >= 24 * 60 ? null : `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}
const uhr = (hhmm) => `${Number(hhmm.slice(0, 2))}:${hhmm.slice(3)} Uhr`;

const M1_MITTEL = ['kalzium', 'eisen', 'magnesium', 'multimineral', 'antazida', 'sucralfat', 'phosphatbinder', 'orlistat', 'soja', 'ballaststoffe'];
/** Mittel mit Abstandsfrage (P7): Aufnahmehemmer, Colestyramin, Kaffee. */
export const ABSTAND_MITTEL = { ...Object.fromEntries(M1_MITTEL.map((k) => [k, 240])), colestyramin: 300, kaffee: 60 };

/**
 * Der persönliche Plan: je Mittel ein Eintrag, dazu immer Frühstück (M3) und
 * Kontrastmittel (M9). Kalzium und Knochenmittel zuerst (WW3).
 */
export function abstandPlan(stand) {
  const T = stand.einstellungen.erinnerung;
  const abend = T >= '17:00';
  const ungewoehnlich = T >= '10:00' && T < '17:00';
  const hat = (k) => stand.mittel.includes(k);
  const plan = [];
  const add = (id, key, name, ab, text, wichtig = false) => plan.push({ id, key, name, ab, text, wichtig });

  // M3 – Frühstück, immer
  if (abend) {
    add('M3', 'fruehstueck', 'Essen und Trinken', null, 'Wenn Ihre Ärztin die Einnahme am Abend festgelegt hat: die Tablette frühestens 2–3 Stunden nach der letzten Mahlzeit nehmen, nur mit einem Glas Wasser.');
  } else {
    let t = `Die Schilddrüsen-Tablette nüchtern nur mit einem Glas Wasser nehmen. Frühstück, Kaffee, Tee, Milch und Saft erst nach 30 Minuten, besser nach 60 Minuten – also ab ${uhr(plusMinuten(T, 30))}, besser ab ${uhr(plusMinuten(T, 60))}.`;
    if (hat('kaffee')) t += ' Bei Kaffee sind 60 Minuten besser.';
    if (ungewoehnlich) t += ' Ihre Einnahmezeit ist ungewöhnlich – stimmen Sie die Abstände bitte mit Praxis oder Apotheke ab.';
    add('M3', 'fruehstueck', 'Frühstück, Kaffee, Milch, Saft', plusMinuten(T, 30), t);
  }

  // M1 + R15: „am einfachsten mittags" nur, wenn mittags schon 4 Stunden nach
  // der Tablette liegt. Bei einer Tablette um 11 oder 13 Uhr hieße „mittags"
  // sonst zu nah oder sogar zugleich (B10).
  const nach4 = abend ? null : plusMinuten(T, 240);
  const wann = !nach4 ? '' : nach4 <= '13:00' ? 'am einfachsten mittags oder abends'
    : T >= '11:00' ? 'am einfachsten abends – oder morgens, mindestens 4 Stunden vor der Tablette' : 'am einfachsten abends';

  const abstand = (k, stunden) => {
    const name = kurzName(k);
    if (abend) return `Sie nehmen die Schilddrüsen-Tablette abends. Dann ${name} morgens oder mittags, mindestens ${stunden} Stunden vorher.`;
    const ab = plusMinuten(T, stunden * 60);
    if (!ab || ab >= '22:00') return `${name}: vor der Tablette nehmen, mindestens ${stunden} Stunden vorher.`;
    return null;
  };

  // WW3 – Kalzium und Knochenmittel oben und hervorgehoben
  if (hat('kalzium')) {
    const t = abstand('kalzium', 4) || `Wichtig: Kalzium-Vitamin-D-Tabletten für die Knochen brauchen 4 Stunden Abstand zur Schilddrüsen-Tablette – in beide Richtungen. Bei Ihrer Einnahmezeit also frühestens ab ${uhr(nach4)}, ${wann}. Wenn das in Ihrem Tagesablauf schwierig ist, sprechen Sie mit Praxis oder Apotheke einen Zeitplan ab.`;
    add('M1', 'kalzium', mittelName('kalzium'), abend ? null : plusMinuten(T, 240), t, true);
  }
  if (hat('bisphosphonat')) {
    add('M10', 'bisphosphonat', mittelName('bisphosphonat'), null, 'Knochenmittel zum Nüchtern-Einnehmen (z. B. Alendronat): nicht zusammen mit der Schilddrüsen-Tablette nehmen. Bitte mit Ärztin oder Apotheke klären, wie beides zeitlich getrennt wird – bei wöchentlicher Einnahme meist nur an diesem einen Tag nötig. Die Kalzium-Tablette, die oft dazugehört, braucht ebenfalls Abstand (siehe Kalzium).', true);
  }
  if (hat('kaffee')) {
    add('M3k', 'kaffee', mittelName('kaffee'), abend ? null : plusMinuten(T, 30), abend ? 'Kaffee oder Tee: nicht zusammen mit der Tablette, nur Wasser.' : `Kaffee oder Tee: frühestens ab ${uhr(plusMinuten(T, 30))}, besser ab ${uhr(plusMinuten(T, 60))}.`);
  }
  M1_MITTEL.filter((k) => k !== 'kalzium' && hat(k)).forEach((k) => {
    const t = abstand(k, 4) || `${kurzName(k)}: mindestens 4 Stunden Abstand zur Schilddrüsen-Tablette – in beide Richtungen. Bei Ihrer Einnahmezeit also frühestens ab ${uhr(nach4)}, ${wann}. Wenn das in Ihrem Tagesablauf schwierig ist, sprechen Sie mit Praxis oder Apotheke einen Zeitplan ab.`;
    add('M1', k, mittelName(k), abend ? null : plusMinuten(T, 240), t);
  });
  if (hat('raloxifen')) add('M1b', 'raloxifen', mittelName('raloxifen'), null, 'Raloxifen: möglichst zu einer ganz anderen Tageszeit als die Schilddrüsen-Tablette nehmen (etwa 12 Stunden Abstand) – bitte mit der Ärztin klären. Es kann außerdem den Bedarf an Schilddrüsenhormon erhöhen; bei Beginn oder Absetzen etwa 6–8 Wochen später TSH kontrollieren lassen.');
  if (hat('colestyramin')) {
    const t = abstand('colestyramin', 5) || `${kurzName('colestyramin')} kann die Aufnahme der Schilddrüsen-Tablette stark verringern. Mindestens 4–5 Stunden nach der Schilddrüsen-Tablette nehmen – die App rechnet mit 5 Stunden: frühestens ab ${uhr(plusMinuten(T, 300))}.`;
    add('M2', 'colestyramin', mittelName('colestyramin'), abend ? null : plusMinuten(T, 300), t);
  }
  if (hat('ppi')) add('M4', 'ppi', mittelName('ppi'), null, 'Magenschutz (z. B. Pantoprazol, Omeprazol, Famotidin) verringert die Magensäure – dadurch wird die Schilddrüsen-Tablette schlechter aufgenommen. Ein zeitlicher Abstand hilft hier nicht. Weiß Ihre Ärztin, dass Sie beides nehmen? Bitte den Magenschutz nicht eigenmächtig absetzen. Etwa 6–8 Wochen nach Beginn oder Absetzen sollte TSH kontrolliert werden.');
  ['oestrogen_tablette', 'tamoxifen'].filter(hat).forEach((k) => add('M5', k, mittelName(k), null, `${k === 'tamoxifen' ? 'Tamoxifen' : 'Östrogen als Tablette'} kann den Bedarf an Schilddrüsenhormon erhöhen. Etwa 6–8 Wochen (bis 12 Wochen) nach Beginn oder Absetzen sollte TSH kontrolliert werden.`));
  if (hat('oestrogen_haut')) add('M5', 'oestrogen_haut', mittelName('oestrogen_haut'), null, 'Östrogen als Pflaster, Gel oder Spray beeinflusst die Schilddrüsen-Tablette kaum.');
  if (hat('biotin')) add('M6', 'biotin', mittelName('biotin'), null, 'Biotin (auch in Haar-, Haut- und Nägel-Mitteln und Vitamin-B-Komplexen) kann Laborwerte verfälschen. Vor jeder Blutabnahme mindestens 3 Tage weglassen, bei hoch dosierten Präparaten bis zu 1 Woche. Sagen Sie der Praxis, dass Sie Biotin nehmen. Wurde Biotin ärztlich verordnet, die Pause nur nach Rücksprache.');
  if (hat('marcumar')) add('M7', 'marcumar', mittelName('marcumar'), null, 'Marcumar/Phenprocoumon: Mehr Schilddrüsenhormon verstärkt die Blutverdünnung. Nach jeder Dosisänderung oder jedem Präparatwechsel der Schilddrüsen-Tablette die Gerinnung (INR) früher kontrollieren lassen, etwa innerhalb von 1–2 Wochen – bitte die Praxis informieren, die Ihren Marcumar-Ausweis führt. Bei Blutungszeichen (Nasenbluten, das nicht aufhört, Blut im Urin oder Stuhl, große blaue Flecken ohne Grund) heute die Praxis anrufen, bei starker Blutung 112.');
  if (hatDiabetes(stand)) add('M8', hat('diabetes') ? 'diabetes' : 'metformin', 'Diabetes-Mittel', null, 'Diabetes-Mittel oder Insulin: Nach einer Dosisänderung der Schilddrüsen-Tablette den Blutzucker in den folgenden Wochen häufiger messen und Auffälligkeiten Ihrer Diabetes-Praxis melden.');
  ['amiodaron', 'jod', 'lithium', 'krebsmittel'].filter(hat).forEach((k) => add('M9', k, mittelName(k), null, `${kurzName(k)} kann die Schilddrüse direkt beeinflussen. Bitte mit der Praxis abstimmen, die Ihre Schilddrüse behandelt – Kontrollen sind hier besonders wichtig.${k === 'jod' ? ' Algen- und Kelp-Präparate besser meiden.' : ''}`));
  if (hat('selen')) add('M11', 'selen', mittelName('selen'), null, 'Selen: Ein Nutzen für das Befinden oder die Einstellung ist nicht belegt, und zu viel Selen kann schaden. Bitte nur nach Rücksprache mit Ihrer Ärztin.');
  if (hat('digitalis')) add('M12', 'digitalis', mittelName('digitalis'), null, 'Herzmittel Digoxin oder Digitoxin: Die Wirkung hängt von der Schilddrüsen-Einstellung ab. Nach jeder Änderung der Schilddrüsen-Dosis bitte die Praxis informieren, die das Herzmittel verordnet.');
  if (hat('enzyminduktor')) add('M13', 'enzyminduktor', mittelName('enzyminduktor'), null, 'Carbamazepin, Phenytoin, Phenobarbital oder Rifampicin können den Bedarf an Schilddrüsenhormon erhöhen. Bei Beginn oder Absetzen etwa 6–8 Wochen später TSH kontrollieren lassen. Bitte nichts eigenmächtig absetzen.');
  if (stand.profil.kortison === 'ja') add('M14', 'kortison', 'Kortison', null, 'Kortison in höherer Dosis kann den TSH-Wert senken. Das ist wichtig, damit Ihre Laborwerte richtig eingeordnet werden – bitte der Praxis sagen, die Ihre Schilddrüse behandelt.');
  if (hat('metformin')) add('M14', 'metformin', mittelName('metformin'), null, 'Metformin kann den TSH-Wert senken. Das ist wichtig, damit Ihre Laborwerte richtig eingeordnet werden – bitte der Praxis sagen, die Ihre Schilddrüse behandelt.');
  add('M9', 'kontrastmittel', 'Kontrastmittel', null, 'Vor Untersuchungen mit jodhaltigem Kontrastmittel (z. B. CT, Herzkatheter) sagen Sie bitte, dass Sie eine Schilddrüsenerkrankung haben.');

  // Hervorgehobene zuerst, sonst in der Reihenfolge oben
  return [...plan.filter((p) => p.wichtig), ...plan.filter((p) => !p.wichtig)];
}

// ---------------------------------------------------------------- Kontrollen (L0d, L7, L8, E7)

const L7B_MITTEL = ['ppi', 'oestrogen_tablette', 'tamoxifen', 'raloxifen', 'kalzium', 'eisen', 'enzyminduktor', 'lithium', 'amiodaron'];

export function kontrolleHinweise(stand, heute) {
  const h = [];
  const add = (id, stufe, text) => h.push({ id, stufe, text });
  const tshBefund = letzterMitTsh(stand, heute);

  // L0d – vor der Blutabnahme
  stand.termine.filter((t) => t.art === 'labor' || t.blutabnahme).forEach((t) => {
    const n = tageZwischen(heute, t.datum);
    if (n === 1) add('L0d', 'keine', 'Morgen ist Blutabnahme. Bitte nehmen Sie die Schilddrüsen-Tablette morgen erst NACH der Blutabnahme – außer die Praxis hat etwas anderes gesagt. Die Blutabnahme möglichst morgens.');
    if (n === 0) add('L0d', 'keine', 'Heute ist Blutabnahme. Bitte nehmen Sie die Schilddrüsen-Tablette erst NACH der Blutabnahme – außer die Praxis hat etwas anderes gesagt.');
    if (stand.mittel.includes('biotin') && n >= 1 && n <= 3) {
      add('L0d-biotin', 'keine', `${n === 3 ? 'Bitte lassen Sie Biotin ab heute bis zur Blutabnahme weg.' : 'Bitte lassen Sie Biotin bis zur Blutabnahme weg.'} Wurde Biotin ärztlich verordnet, fragen Sie vorher in der Praxis.`);
    }
  });

  // L7a – letzte Kontrolle über ein Jahr her
  if (tshBefund && tageZwischen(tshBefund.datum, heute) > 365) {
    add('L7a', 'termin', 'Die letzte Kontrolle der Schilddrüsenwerte ist über ein Jahr her. Bei stabiler Einstellung wird meist alle 6–12 Monate kontrolliert – fragen Sie in der Praxis nach einem Termin.');
  } else if (!tshBefund && stand.profil.seit && tageZwischen(stand.profil.seit, heute) > 60) {
    add('L7a', 'termin', 'In der App ist noch kein TSH-Wert eingetragen. Bei stabiler Einstellung wird meist alle 6–12 Monate kontrolliert – tragen Sie den letzten Befund ein oder fragen Sie in der Praxis nach einem Termin.');
  }

  // L7b – 6–8 Wochen nach Beginn oder Ende eines Mittels (Dosis: siehe js/dosis.js, D6c)
  const wechsel = [...stand.mittelWechsel].reverse().find((w) => L7B_MITTEL.includes(w.key)
    && tageZwischen(w.am, heute) >= 42 && tageZwischen(w.am, heute) <= 183
    && !stand.labor.some((l) => l.tsh && l.datum > w.am));
  if (wechsel) {
    add('L7b', 'termin', `Etwa 6–8 Wochen nach ${wechsel.art === 'beginn' ? 'Beginn' : 'Ende'} von ${kurzName(wechsel.key)} wird meist der TSH-Wert kontrolliert. Fragen Sie in der Praxis, ob eine Blutabnahme geplant ist.`);
  }

  // L7c / E7 – Gewicht seit der letzten Blutabnahme
  const gw = stand.gewicht;
  if (tshBefund && gw.length) {
    const naechster = gw.map((g) => ({ g, abstand: Math.abs(tageZwischen(g.datum, tshBefund.datum)) }))
      .filter((x) => x.abstand <= 30).sort((a, b) => a.abstand - b.abstand)[0];
    const jetzt = gw[gw.length - 1];
    if (naechster && jetzt.datum > naechster.g.datum && Math.abs(jetzt.kg - naechster.g.kg) >= 5) {
      add('L7c', 'termin', `Ihr Gewicht hat sich seit der letzten Blutabnahme um ${zahl(Math.abs(jetzt.kg - naechster.g.kg))} kg verändert. Das kann den Bedarf an Schilddrüsenhormon verändern – bitte bei der nächsten Gelegenheit ansprechen.`);
    }
  }

  // L7d – auffälliger letzter Befund, seit über 90 Tagen nicht kontrolliert
  // Beim Behandlungsgrund Hirnanhangdrüse ist „auffällig", was die Einschätzung
  // aus fT4 mindestens zeitnah macht – ein niedriges TSH allein ist es nicht.
  const letzter = letzterBefund(stand, heute);
  const auffaellig = (e) => (e.hypophyse ? STUFEN[e.stufeLabor].rang >= STUFEN.zeitnah.rang
    : ['b', 'c2', 'c3', 'd', 'e2', 'e3', 'f', 'g2'].includes(e.muster) || (e.muster === 'h' && e.mInfo.fDeutlichUeber));
  if (letzter && tageZwischen(letzter.befund.datum, heute) > 90 && auffaellig(letzter)
    && !stand.labor.some((l) => l.tsh && l.datum > letzter.befund.datum && l.datum <= heute)) {
    // „Seitdem wurde nicht neu kontrolliert" stimmt nicht immer so: Kam danach
    // ein Befund nur mit fT4, stand der Satz neben „vor 5 Tagen gemessen"
    // (C13). Wurde die Dosis danach geändert, klang „auffällig … nicht neu
    // kontrolliert", als sei nichts geschehen (C11). Die Erinnerung bleibt –
    // TSH fehlt ja wirklich –, der Satz sagt dann genau das.
    const d = letzter.befund.datum;
    const danachOhneTsh = stand.labor.some((l) => l.datum > d && l.datum <= heute);
    const damals = sp.tagesdosis(dosisAmIn(stand, d));
    const dosisGeaendert = stand.dosen.some((x, i) => i > 0 && !x.berichtigung && x.ab > d && x.ab <= heute
      && sp.tagesdosis(x) !== null && sp.tagesdosis(x) !== damals);
    add('L7d', 'zeitnah', dosisGeaendert || danachOhneTsh
      ? `Seit Ihrem auffälligen Befund vom ${kurz(d)} ${dosisGeaendert ? 'wurde die Dosis geändert, TSH aber nicht neu bestimmt' : 'wurde TSH nicht neu bestimmt'}. Bitte fragen Sie in der Praxis, wann TSH kontrolliert werden soll.`
      : 'Ihr letzter Befund war auffällig, und seitdem wurde nicht neu kontrolliert. Bitte fragen Sie in der Praxis, wann kontrolliert werden soll.');
  }

  // C15 – zwei Einträge eines Abnahmetags mit verschiedenen Werten (aus
  // älteren Ständen; das Formular lässt das nicht mehr zu). Die Auswertung
  // rechnet mit dem zuletzt eingetragenen, die Befund-Karte sagt es bei
  // beiden. Hier steht es für die Tage, auf denen die Einschätzung beruht –
  // sonst fiele es nur auf, wer die ältere Karte im Verlauf aufschlägt. Wäre
  // nach dem anderen Eintrag die Frist höher, gilt vorsichtshalber sie: Wurde
  // ein nachgereichtes fT4 beim falschen Eintrag gespeichert, blieb „Heute"
  // sonst bei „Beim nächsten Termin", obwohl TSH und fT4 zusammen „in den
  // nächsten Tagen anrufen" hießen.
  // Verglichen wird nur, worin sich die Einträge widersprechen: TSH, fT4 und
  // fT3 über die Stufe des Befunds, ein weiterer Wert über seine eigene –
  // ein Vitamin D, das nur in einem der beiden steht, zählt im Gesamtbild ohnehin.
  // Mit dem zuletzt eingetragenen rechnet die Auswertung; normStand führt
  // spätere Werte des Tages in ihn zusammen.
  const abDoppelt = letzter ? letzter.befund.datum : tageWeiter(heute, -90);
  [...new Set(stand.labor.filter((l) => l.datum >= abDoppelt && l.datum <= heute).map((l) => l.datum))].forEach((tag) => {
    const eintraege = stand.labor.filter((l) => l.datum === tag);
    const doppelt = eintraege.flatMap((l) => doppelteWerte(l, stand));
    if (!doppelt.length) return;
    const namen = [...new Set(doppelt.map(([, name]) => name))];
    const keys = doppelt.map(([k]) => k);
    const schilddruese = sp.LABORWERTE.some(([k]) => keys.includes(k));
    const stufen = eintraege.map((l) => {
      const e = befundEinschaetzen(l, stand, heute);
      return hoechste(schilddruese && !e.praxisErklaert ? e.stufeLabor : 'keine',
        ...weitereWerte(l, stand).filter((x) => keys.includes(x.key)).map((x) => x.stufe));
    });
    const oben = hoechste(...stufen);
    const hoeher = STUFEN[oben].rang > STUFEN[stufen[stufen.length - 1]].rang;
    add('L0b-doppelt', hoeher ? oben : 'keine', `Für den ${kurz(tag)} gibt es zwei Einträge mit verschiedenen Werten (${aufzaehlung(namen)}). Die App rechnet mit dem zuletzt eingetragenen. Bitte vergleichen Sie beide mit dem Befund und löschen Sie den falschen.${
      hoeher ? ` Nach dem anderen Eintrag wäre es dringender – bis das geklärt ist, gilt vorsichtshalber: ${STUFEN[oben].text}` : ''}`);
  });

  // L8 – ungewollter Gewichtsverlust
  if (gw.length >= 2) {
    const jetzt = gw[gw.length - 1];
    if (tageZwischen(jetzt.datum, heute) <= 60) {
      const davor = gw.filter((g) => g.datum < jetzt.datum && tageZwischen(g.datum, jetzt.datum) <= 183);
      const hoch = davor.reduce((a, b) => (b.kg > (a ? a.kg : -1) ? b : a), null);
      if (hoch && (hoch.kg - jetzt.kg) / hoch.kg >= 0.05) {
        add('L8', 'tage', `Ihr Gewicht ist seit dem ${kurz(hoch.datum)} um ${zahl(hoch.kg - jetzt.kg)} kg gesunken. Wenn Sie nicht abnehmen wollten, rufen Sie bitte in den nächsten Tagen in der Praxis an.`);
      }
    }
  }
  return h;
}

// ---------------------------------------------------------------- Fragen für die Ärztin (B2)

export function fragenVorschlaege(stand, heute) {
  const f = [];
  const p = stand.profil;
  const e = letzterBefund(stand, heute);
  const frisch = e && tageZwischen(e.befund.datum, heute) <= 180;
  const zielAlt = zielBereich(stand) && (!p.zielAm || tageZwischen(p.zielAm, heute) > 365);
  // F1, solange kein Zielbereich eingetragen ist – auch bei gewollter Senkung
  // ohne Zahlen: Gerade dann hilft der Zielbereich (L2z2, L2z3).
  if (!zielBereich(stand) || zielAlt) f.push('Welcher TSH-Zielbereich gilt für mich?');
  f.push('Wann soll der Wert das nächste Mal kontrolliert werden?');
  if (frisch) {
    // Bei der Hirnanhangdrüse als Ursache steuert TSH nicht (P1h) – dann keine TSH-Fragen.
    const tshSteuert = p.ursache !== 'hypophyse';
    if (tshSteuert && ['b', 'c'].includes(e.gruppe)) f.push('Mein TSH liegt über dem Bereich – soll die Dosis angepasst werden, oder erst kontrolliert?');
    if (tshSteuert && ['d', 'e', 't'].includes(e.gruppe)) f.push('Mein TSH liegt unter dem Bereich – ist das in meinem Alter so gewollt?');
    if (['f', 'h'].includes(e.gruppe) || e.regeln.includes('L5c') || e.regeln.includes('L5d')) f.push('Kann die Tablette vor der Blutabnahme oder Biotin den Wert beeinflusst haben – soll er wiederholt werden?');
    if (e.gruppe === 'g') f.push('Nehme ich ein Präparat mit T3-Anteil, oder muss der niedrige fT4-Wert weiter abgeklärt werden?');
    if (e.regeln.includes('L5b')) f.push('Wie soll ich mit vergessenen Tabletten umgehen?');
  }
  const b = beschwerdenAuswerten(stand, heute);
  const tsh = letzterMitTsh(stand, heute);
  if (b.richtung && (!tsh || tageZwischen(tsh.datum, heute) > 90)) f.push('Können meine Beschwerden an der Schilddrüse liegen – ist eine Blutabnahme sinnvoll?');
  if (stand.mittel.length) f.push('Muss eines meiner anderen Mittel zeitlich anders genommen werden?');
  return [...new Set(f)];
}

// ---------------------------------------------------------------- Gesamtbild (L3f)

/**
 * Der Warnzeichen-Check von heute – oder null. Mit den Beschwerden von heute
 * ausgewertet (C9): „Nichts davon" sagt dann nicht „beim nächsten Termin",
 * wenn das Befinden „heute anrufen" verlangt.
 */
export function warnHeute(stand, heute) {
  const w = [...stand.warnzeichen].reverse().find((x) => x.datum === heute);
  return w ? { ...checkAuswerten(w, stand, heute), check: w } : null;
}

/**
 * Die Kopfzeile des Gesamtbilds. Kommt die 112-Stufe nur von W5 (seelische
 * Not), steht oben nicht „Bitte rufen Sie jetzt 112 an", sondern das Angebot,
 * heute mit jemandem zu sprechen – 112 steht im Text für akute Gefahr.
 */
export function kopfFuer(stufe, teile) {
  const notruf = teile.filter((t) => t.stufe === 'notruf');
  const nurW5 = stufe === 'notruf' && notruf.every((t) => t.id === 'W5');
  // Nach „große Menge Tabletten auf einmal" (W4a) ist der Giftnotruf der
  // erste Anruf – die Kopfzeile sagt das, 112 steht für Beschwerden dabei.
  if (stufe === 'notruf' && notruf.length && notruf.every((t) => t.id === 'W4a')) {
    return { titel: 'Jetzt den Giftnotruf anrufen', text: 'Bitte rufen Sie jetzt den Giftnotruf an – die Nummer steht darunter. Bei Herzrasen, Brustschmerz, Atemnot oder Verwirrtheit: sofort 112.' };
  }
  if (nurW5) return { titel: 'Bitte sprechen Sie heute mit jemandem', text: 'Telefonseelsorge 0800 111 0 111 oder 0800 111 0 222 – rund um die Uhr, kostenlos. Wenn Sie in Gefahr sind, sich etwas anzutun: sofort 112.' };
  return { titel: STUFEN[stufe].titel, text: STUFEN[stufe].text };
}

/*
 * Ein jüngerer Befund ohne Muster, der selbst eine Stufe hat (B2) – etwa ein
 * nachgereichter Befund nur mit fT4 oder einer mit TSH in unbekannter
 * Einheit. letzterBefund() bleibt beim jüngsten Befund mit Muster, weil
 * Befund-Karte, S4 und L7d dessen Muster brauchen. Hier entscheidet der
 * jüngste Befund mit eingeordnetem fT4, der nicht älter ist als jener (auch
 * am selben Tag): Ist sein fT4 wieder unauffällig, zählt ein älterer nicht.
 */
function befundOhneMuster(stand, heute, letzter) {
  const ab = letzter ? letzter.befund.datum : '';
  for (let i = stand.labor.length - 1; i >= 0; i--) {
    const l = stand.labor[i];
    if (l.datum > heute) continue;
    if (l.datum < ab) break;
    if (letzter && l.id === letzter.befund.id) continue;
    const e = befundEinschaetzen(l, stand, heute);
    const ft4 = e.werte.find((w) => w.key === 'ft4');
    if (e.muster || !ft4 || !ft4.einordnung.lage) continue;
    return e.ohneMuster && e.stufe !== 'keine' && !e.praxisErklaert ? e : null;
  }
  return null;
}

/*
 * Die Stufen der weiteren Werte (E13) für das Gesamtbild (B44): Vitamin D
 * über 100 ng/ml heißt „in den nächsten Tagen anrufen" – oben darf dann nicht
 * „Kein besonderer Anlass" stehen. Je Wert zählt der jüngste Befund, der ihn
 * enthält – aus den letzten 90 Tagen oder ab dem letzten Befund mit Muster.
 * Die Praxis-Angabe zum Befund betrifft TSH und fT4, nicht diese Werte.
 */
function weitereTeile(stand, heute, letzter) {
  const tage90 = tageWeiter(heute, -90);
  const ab = letzter && letzter.befund.datum < tage90 ? letzter.befund.datum : tage90;
  const gesehen = new Set();
  const teile = [];
  for (let i = stand.labor.length - 1; i >= 0; i--) {
    const l = stand.labor[i];
    if (l.datum > heute) continue;
    if (l.datum < ab) break;
    weitereWerte(l, stand).forEach((x) => {
      if (gesehen.has(x.key)) return;
      gesehen.add(x.key);
      if (STUFEN[x.stufe].rang >= STUFEN.termin.rang) {
        teile.push({ id: `E13-${x.key}`, stufe: x.stufe, text: `${x.name}: ${x.texte[0]}`, quelle: 'weitere', datum: l.datum });
      }
    });
  }
  return teile;
}

/**
 * Alles zusammen: eine Stufe oben, darunter die Teile. Die Praxis-Angabe zu
 * einem Befund ersetzt nur die Laborstufe – Beschwerden und Warnzeichen, die
 * später dazukommen, bleiben sichtbar (R1).
 *
 * `dosis`: die Hinweise aus dosisHinweise() (js/dosis.js) – [{ id, stufe,
 * text }]. Sie zählen für die Stufe oben mit (Grundsatz 5: eine
 * Gesamteinschätzung, B9). Der Kern ruft dosis.js nicht selbst auf, weil
 * dosis.js diesen Kern importiert; wer das Gesamtbild zeigt, reicht sie durch –
 * aber nur einmal: Wer die Dosis-Teile schon selbst anhängt, übergibt hier nichts.
 */
export function gesamtbild(stand, heute, { dosis = [] } = {}) {
  const warn = warnHeute(stand, heute);
  if (!aktiv(stand)) {
    // Mit den Texten aus dem Befinden, die auch ohne P6 gelten (C9): Trägt
    // W3 deren Stufe, trägt sie auch der Kopf.
    const s = warn ? warn.stufe : 'keine';
    return { aktiv: false, stufe: s, kopf: kopfFuer(s, warn ? [...warn.befinden, ...warn.abschnitte] : []), befund: null, ohneMuster: null, beschwerden: null, warnHeute: warn, kontrolle: [], weitere: [], dosis: [], teile: [] };
  }
  const befund = letzterBefund(stand, heute);
  const ohneMuster = befundOhneMuster(stand, heute, befund);
  const beschwerden = beschwerdenAuswerten(stand, heute);
  const kontrolle = kontrolleHinweise(stand, heute);
  const weitere = weitereTeile(stand, heute, befund);
  const dosisTeile = (Array.isArray(dosis) ? dosis : []).filter((h) => h && typeof h.text === 'string')
    .map((h) => ({ id: h.id, stufe: STUFEN[h.stufe] ? h.stufe : 'keine', text: h.text, quelle: 'dosis' }));
  const teile = [];
  if (warn) warn.abschnitte.forEach((a) => teile.push({ id: a.id, stufe: a.stufe, text: a.text, quelle: 'warnzeichen' }));
  if (befund) {
    const s = befund.praxisErklaert ? 'keine' : befund.stufeLabor;
    const d = kurz(befund.befund.datum);
    // C10: Tragen weitere Werte eine höhere Frist, gilt dieser Teil nur für
    // TSH und fT4 – und sagt das. Vorher folgte auf „Befund vom 20.09.:
    // Vitamin D … in den nächsten Tagen anrufen" direkt „Letzter Befund vom
    // 20.09.: Kein besonderer Anlass".
    const nurSchilddruese = weitere.some((w) => STUFEN[w.stufe].rang > STUFEN[s].rang);
    let text = befund.praxisErklaert ? PRAXIS_TEXT : befund.stufeText;
    if (nurSchilddruese) {
      text = befund.praxisErklaert ? 'Die Praxis hat Ihnen die Schilddrüsenwerte schon erklärt. Halten Sie sich an das, was dort besprochen wurde.'
        : s === 'keine' ? 'Die Schilddrüsenwerte geben keinen besonderen Anlass.' : `Zu den Schilddrüsenwerten: ${befund.stufeText}`;
    }
    // C13: Gibt es danach einen Befund ohne Muster (nur fT4), ist dieser nicht
    // mehr „der letzte Befund" – die Beschriftung sagt, welcher er ist.
    const danach = stand.labor.filter((l) => l.datum > befund.befund.datum && l.datum <= heute);
    const beschriftung = danach.length
      ? `${danach.every((l) => !l.tsh) ? 'Letzter Befund mit TSH' : 'Letzter auswertbarer Befund'} vom ${d}`
      : `${nurSchilddruese ? 'Schilddrüsenwerte' : 'Letzter Befund'} vom ${d}`;
    teile.push({ id: 'befund', stufe: s, text, quelle: 'befund', beschriftung, nurSchilddruese });
  }
  if (ohneMuster) {
    // Eigene Quelle: Der Text nennt das Datum selbst; Teile mit „befund"
    // tragen ihre Beschriftung in `beschriftung` (siehe oben).
    const text = [`Befund vom ${kurz(ohneMuster.befund.datum)}: ${ohneMuster.text}`, ohneMuster.stufeText,
      ohneMuster.notfall.satz !== 3 ? ohneMuster.notfall.text : ''].filter(Boolean).join(' ');
    teile.push({ id: 'befund-ohne-tsh', stufe: ohneMuster.stufe, text, quelle: 'befund-ohne-muster', datum: ohneMuster.befund.datum });
  }
  teile.push(...weitere);
  beschwerden.texte.forEach((t) => teile.push({ ...t, quelle: 'beschwerden' }));
  kontrolle.forEach((k) => teile.push({ ...k, quelle: 'kontrolle' }));
  teile.push(...dosisTeile);
  // W5 steht immer oben, ganz gleich, welche Stufe sonst gilt.
  teile.sort((a, b) => (b.id === 'W5') - (a.id === 'W5') || STUFEN[b.stufe].rang - STUFEN[a.stufe].rang);
  const stufe = hoechste(...teile.map((t) => t.stufe));
  return { aktiv: true, stufe, kopf: kopfFuer(stufe, teile), befund, ohneMuster, beschwerden, warnHeute: warn, kontrolle, weitere, dosis: dosisTeile, teile };
}

// ---------------------------------------------------------------- Bericht (B1)

const JNW_TEXT = { ja: 'ja', nein: 'nein', unbekannt: 'weiß nicht', '': 'nicht beantwortet' };

function wertZeile(key, name, w, e) {
  if (!w) return null;
  const std = inStandard(key, w);
  const bereich = w.von !== null || w.bis !== null
    ? ` (Labor ${w.von !== null ? zahl(w.von) : '…'}–${w.bis !== null ? zahl(w.bis) : '…'})`
    : e && e.quelle === 'orientierung' ? ` (ohne Laborbereich; Orientierung ${zahl(e.von)}–${zahl(e.bis)})` : ' (ohne Laborbereich)';
  const um = std !== null && Math.abs(std - w.wert) > 1e-9 && key !== 'tsh' ? `, umgerechnet ${zahl(std)} ${key === 'tsh' ? 'mU/l' : 'pmol/l'}` : '';
  return `${name} ${w.unter ? '< ' : ''}${zahl(w.wert)} ${w.einheit}${um}${bereich}${e && e.lage ? ` – ${LAGE_TEXT[e.genau]}` : ''}`;
}

/** Die Zeilen des Abschnitts „Einschätzung der App" im Arztbericht. */
export function berichtZeilen(stand, heute) {
  const z = [];
  const p = stand.profil;
  z.push(`EINSCHÄTZUNG DER APP (automatisch erstellt, ersetzt keine ärztliche Beurteilung) – Stand ${kurz(heute)}.`);
  z.push('Grundlage: Angaben der Patientin und von ihr übertragene Befunde. Kennzeichnung: (Angabe) = Angabe der Patientin, (Befund) = vom Befund übertragen, (App) = von der App berechnet.');
  const alter = alterAm(stand, heute);
  const ziel = zielBereich(stand);
  z.push(`Profil (Angabe): ${[
    alter !== null ? `Alter etwa ${alter} Jahre` : 'Alter nicht angegeben',
    `Behandlungsgrund: ${p.ursache ? sp.URSACHEN.find(([k]) => k === p.ursache)[1] : 'nicht angegeben'}`,
    `Schilddrüsenkrebs: ${JNW_TEXT[p.krebs]}`,
    `Präparat: ${(sp.PRAEPARATE.find(([k]) => k === p.praeparatArt) || ['', 'nicht angegeben'])[1]}`,
    ziel ? `TSH-Zielbereich laut Ärztin ${zahl(ziel.von)}–${zahl(ziel.bis)} mU/l${p.zielAm ? ` (eingetragen ${kurz(p.zielAm)})` : ''}` : 'kein TSH-Zielbereich eingetragen',
    `TSH bewusst niedrig: ${JNW_TEXT[p.zielNiedrig]}`,
    `Herzerkrankung: ${JNW_TEXT[p.herz]}`,
    `Osteoporose: ${JNW_TEXT[p.osteoporose]}`,
    `Kortison dauerhaft: ${JNW_TEXT[p.kortison]}`,
    `Diabetes: ${hatDiabetes(stand) ? 'ja' : JNW_TEXT[p.diabetes]}`,
  ].join('; ')}.`);
  if (stand.mittel.length) {
    z.push(`Weitere Mittel (Angabe): ${stand.mittel.map((k) => `${kurzName(k)}${ABSTAND_MITTEL[k] ? ` (Abstand eingehalten: ${JNW_TEXT[stand.mittelAbstand[k] || '']})` : ''}`).join('; ')}.`);
  }

  // Die letzten drei Befunde
  stand.labor.filter((l) => l.datum <= heute).slice(-3).reverse().forEach((l) => {
    const e = befundEinschaetzen(l, stand, heute);
    const w = sp.LABORWERTE.map(([k, name]) => wertZeile(k, name, l[k], e.werte.find((x) => x.key === k)?.einordnung)).filter(Boolean);
    z.push(`Befund vom ${kurz(l.datum)} (Befund): ${w.join('; ')}${l.laborName ? `; Labor: ${l.laborName}` : ''}.`);
    const fragen = [
      l.abnahmeUhr ? `Abnahme ${uhr(l.abnahmeUhr)}` : null,
      `Tablette vorher: ${JNW_TEXT[l.vorAbnahme]}${l.tabletteUhr ? ` (${uhr(l.tabletteUhr)})` : ''}`,
      `Biotin: ${JNW_TEXT[l.biotin]}`,
      `krank/Krankenhaus: ${JNW_TEXT[l.krank]}`,
      `Kortison: ${JNW_TEXT[l.kortison]}`,
      `Kontrastmittel: ${JNW_TEXT[l.kontrastmittel]}`,
      `Mittel geändert: ${JNW_TEXT[l.mittelGeaendert]}`,
      `Einnahme geändert: ${JNW_TEXT[l.einnahmeGeaendert]}`,
      `andere Packung: ${JNW_TEXT[l.packung]}`,
      l.vergessen ? `vergessen: ${{ nein: 'nein', einzelne: 'einzelne Tage', mehrere: 'mehrere Tage', unbekannt: 'weiß nicht' }[l.vergessen]}` : null,
    ].filter(Boolean);
    z.push(`  Angaben zur Abnahme (Angabe): ${fragen.join('; ')}.`);
    const x = einnahmenVor(l, stand);
    z.push(x.erfasst >= 28
      ? `  Einnahme in den 42 Tagen davor (App): an ${x.erfasst} Tagen erfasst, davon ${x.nicht} nicht genommen; ${x.unbekannt} Tage ohne Eintrag (unbekannt).`
      : `  Einnahme in den 42 Tagen davor (App): zu wenig erfasst (${x.erfasst} Tage erfasst, ${x.unbekannt} Tage ohne Eintrag – unbekannt).`);
    if (e.muster || e.ohneMuster) {
      const ersetzt = e.praxisErklaert ? ' – für die Patientin ersetzt durch die Angabe, dass die Praxis den Befund erklärt hat' : '';
      const grundlage = e.muster ? `Muster ${e.muster}${e.ziel ? ' (am persönlichen Zielbereich)' : ''}` : 'kein Muster (TSH fehlt oder ist nicht einzuordnen)';
      // Beim Behandlungsgrund Hirnanhangdrüse kommt die Stufe aus fT4 (RW2 P1).
      // C10: Die Stufe hier gilt für TSH und fT4. Hebt ein weiterer Wert den
      // Befund an, steht das dabei – wie im Kopf der Befund-Karte.
      const mitWeiteren = e.kopf && e.kopf.weitere.length
        ? `; mit ${aufzaehlung(weitereWerte(l, stand).filter((x) => e.kopf.weitere.includes(x.key)).map((x) => x.name))} insgesamt „${STUFEN[e.stufeGesamt].titel}"` : '';
      z.push(`  Einordnung (App): ${grundlage}, Stufe „${STUFEN[e.stufeLabor].titel}"${e.hypophyse || e.ohneMuster ? ' nach fT4' : ''}${ersetzt}${mitWeiteren}.`);
      e.erklaerungen.forEach((x2) => z.push(`  – ${x2.text}`));
      e.verlauf.forEach((x2) => z.push(`  – ${x2.text}`));
      e.zusaetze.forEach((x2) => z.push(`  – ${x2.text}`));
    } else if (e.hinweise.length) {
      z.push(`  Einordnung (App): keine – ${e.hinweise.join(' ')}`);
    }
    weitereWerte(l, stand).forEach((ww) => z.push(`  ${ww.name} ${zahl(ww.wert.wert)} ${ww.wert.einheit}${ww.texte.length ? ` – ${ww.texte[0]}` : ''}`));
  });

  const b = beschwerdenAuswerten(stand, heute);
  if (b.genannt.length) {
    z.push(`Beschwerden der letzten 28 Tage (Angabe): ${b.genannt.map(sp.beschwerdeName).join(', ')}. Auswertung (App): ${b.richtung === 'wenig' ? 'könnten zu zu wenig Hormon passen' : b.richtung === 'viel' ? 'könnten zu zu viel Hormon passen' : 'kein klares Muster'} (Punkte zu wenig ${zahl(b.punkteWenig)}, zu viel ${zahl(b.punkteViel)}).`);
  }
  const ab = tageWeiter(heute, -89);
  const checks = stand.warnzeichen.filter((w) => w.datum >= ab && w.datum <= heute);
  checks.forEach((c) => {
    const namen = c.ja.map((k) => (WARNFRAGEN.find((f) => f.key === k) || { text: k }).text);
    z.push(`Warnzeichen-Check vom ${kurz(c.datum)}${c.uhr ? ` ${uhr(c.uhr)}` : ''} (Angabe): ${namen.length ? namen.join('; ') : 'nichts angekreuzt'}.`);
  });
  return z;
}
