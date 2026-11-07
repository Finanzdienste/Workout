/*
 * Schilddrüse: die Befunde der zweiten Nachprüfung als Regressionsfälle.
 *
 * Nach den Review-Korrekturen haben zwei Prüfer jeden Befund erneut
 * nachgestellt und dabei noch fünf Fehler gefunden, dazu zwei nur teilweise
 * behobene (B26, B52). Jeder Fall hier scheiterte vor der Korrektur. Unten
 * im Abschnitt „Runde 2" die Befunde der zweiten Review-Runde (C…), im
 * Abschnitt „Runde 3" die der dritten zur Dosis-Karte (D…), im Abschnitt
 * „Runde 4" die der vierten (E…).
 *
 *     node tests/test-sd-nachpruefung.mjs
 *
 * Läuft ohne Browser, Ausgabe „OK …"/„FAIL …", Exit-Code 1 bei Fehlern.
 */
// Als Namensraum: Fehlt ein Export (D6_HEUTE vor Runde 2), scheitern nur die
// Prüfungen, die ihn brauchen – nicht die ganze Datei beim Laden.
import { readFileSync } from 'node:fs';
import * as dosisModul from '../schilddruese/js/dosis.js';
import * as ez from '../schilddruese/js/einschaetzung.js';
import { erinnerungText } from '../schilddruese/js/ics.js';
import { normStand } from '../schilddruese/js/speicher.js';

const { dosisRichtung, dosisHinweise, gesamtbildMitDosis, dosisBerichtZeilen, D6_LANG, D6_HEUTE } = dosisModul;

let fails = 0;
function check(name, bedingung, detail = '') {
  if (bedingung) console.log(`OK   ${name}`);
  else { fails++; console.log(`FAIL ${name}${detail ? ` – ${detail}` : ''}`); }
}
function fall(name, fn) {
  try { fn(); } catch (e) { fails++; console.log(`FAIL ${name}: Absturz – ${e && e.stack ? e.stack.split('\n').slice(0, 2).join(' ') : e}`); }
}

function plus(iso, n) {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const HEUTE = '2026-09-27';
const BEFUND = plus(HEUTE, -10);
const tsh = (wert) => ({ wert, einheit: 'mU/l', von: 0.4, bis: 4.0 });
const ft4 = (wert) => ({ wert, einheit: 'pmol/l', von: 12, bis: 22 });
const FRAGEN = {
  abnahmeUhr: '08:00', vorAbnahme: 'nein', biotin: 'nein', krank: 'nein', kortison: 'nein', kontrastmittel: 'nein',
  mittelGeaendert: 'nein', einnahmeGeaendert: 'nein', packung: 'nein', vergessen: 'nein', einnahmeArt: 'ja',
  abstandOk: 'ja', verwechselt: 'nein', praxis: 'nochnicht',
};
const PROFIL = {
  begruesst: true, behandelt: true, seit: '2025-01-01', geburtsjahr: 1948, ursache: 'hashimoto', krebs: 'nein',
  praeparatArt: 't4', herz: 'ja', osteoporose: 'nein', kortison: 'nein', diabetes: 'nein', zielNiedrig: 'nein',
  hypophyseOderNiedrig: 'nein', bundesland: 'BY',
};
const einnahmen = () => {
  const e = {};
  for (let t = '2026-03-01'; t <= HEUTE; t = plus(t, 1)) e[t] = { uhr: '07:00' };
  return e;
};
function stand(ue = {}) {
  const befund = { id: 'b1', datum: BEFUND, tsh: tsh(2), ft4: ft4(15), ...FRAGEN, ...(ue.befund || {}) };
  return normStand({
    version: 2,
    profil: { ...PROFIL, ...(ue.profil || {}) },
    mittel: ue.mittel || [],
    dosen: ue.dosen || [{ id: 'd1', ab: '2025-01-01', praeparat: 'L-Thyroxin', mikrogramm: 75, tabletten: 1 }],
    einnahmen: einnahmen(),
    labor: [...(ue.vorher || []), befund, ...(ue.nachher || [])],
    befinden: ue.befinden || [],
    warnzeichen: ue.warnzeichen || [],
    nachfragen: ue.nachfragen || [{ id: 'n1', art: 'dosis_stimmt', bezug: 'b1', antwort: 'ja', am: plus(HEUTE, -9) }],
  });
}
const alleTexte = (k) => [k.titel, ...(k.texte || []), ...(k.gruende || []).map((g) => g.text)].join(' ');

// ---------------------------------------------------------------- 1: Berichtigung nach „Nein, ich nehme etwas anderes"
fall('Berichtigung', () => {
  // TSH 0,08 (e3, Stufe tage). Die Nutzerin sagt „Nein, ich nehme etwas anderes"
  // und trägt heute 100 µg ein – „Auf Anweisung der Praxis: Ja", weil die
  // Praxis ihr das einmal verordnet hat. Das ist keine beschlossene Änderung.
  const s = stand({
    befund: { tsh: tsh(0.08) },
    dosen: [
      { id: 'd1', ab: '2025-01-01', praeparat: 'L-Thyroxin', mikrogramm: 75, tabletten: 1 },
      { id: 'd2', ab: HEUTE, praeparat: 'L-Thyroxin', mikrogramm: 100, tabletten: 1, praxis: true, berichtigung: true },
    ],
    nachfragen: [],
  });
  check('1 Berichtigungs-Flag übersteht normStand', s.dosen[1].berichtigung === true);
  const k = dosisRichtung(s, HEUTE);
  check('1 keine Richtung nach Berichtigung', k.richtung === 'klaeren', k.richtung);
  check('1 Stufe bleibt die des Befunds (nicht „keine")', k.stufe !== 'keine' && ['tage', 'heute', 'notruf'].includes(k.stufe), k.stufe);
  check('1 kein „schon geändert" als beschlossene Änderung', !/Ihre Dosis wurde nach dieser Blutabnahme schon geändert/.test(alleTexte(k)), alleTexte(k).slice(0, 200));
  check('1 Karte erklärt die Berichtigung („Gilt ab")', /Gilt ab/.test(alleTexte(k)), alleTexte(k).slice(0, 200));
  const h = dosisHinweise(s, HEUTE);
  const ids = h.map((x) => x.id);
  check('1 kein „wieder Ihre bisherige Menge" (X3) nach Berichtigung', !ids.includes('X3'), ids.join(','));
  check('1 kein B2 nach Berichtigung', !ids.includes('B2'), ids.join(','));
  check('1 Hinweis X3b zur Berichtigung', ids.includes('X3b'), ids.join(','));
  const g = ez.gesamtbild(s, HEUTE);
  check('1 Gesamtbild nicht „keine"', g.stufe !== 'keine', g.stufe);
});

// ---------------------------------------------------------------- 2: neuerer Befund nur mit fT4
fall('fT4 neuer', () => {
  const s = stand({
    befund: { tsh: tsh(0.2), datum: plus(HEUTE, -20) },
    nachher: [{ id: 'b2', datum: plus(HEUTE, -3), ft4: ft4(5), ...FRAGEN }],
  });
  const k = dosisRichtung(s, HEUTE);
  check('2 keine Richtung „weniger", wenn das neueste fT4 deutlich zu niedrig ist', k.richtung === 'klaeren', `${k.richtung} ${k.titel}`);
  check('2 Grund nennt den fT4-Befund', /nur fT4/.test(alleTexte(k)), alleTexte(k).slice(0, 200));
  check('2 Stufe mindestens tage', ['tage', 'heute', 'notruf'].includes(k.stufe), k.stufe);
});

// ---------------------------------------------------------------- 3: W2t in der Kartenstufe; Praxis-Vorrang veraltet
fall('W2t Karte', () => {
  const s = stand({ befinden: [{ id: 'bf1', datum: plus(HEUTE, -1), stufe: 'mittel', beschwerden: ['abnahme'] }] });
  const k = dosisRichtung(s, HEUTE);
  check('3 „ungewollt abgenommen": Karte mindestens tage', ['tage', 'heute', 'notruf'].includes(k.stufe), k.stufe);
});
fall('Praxis veraltet', () => {
  const s = stand({
    befund: { tsh: tsh(12), praxis: 'bleibt', praxisAm: plus(BEFUND, 2) },
    befinden: [{ id: 'bf1', datum: plus(HEUTE, -1), stufe: 'schlecht', beschwerden: ['frieren'] }],
  });
  const k = dosisRichtung(s, HEUTE);
  const g = ez.gesamtbild(s, HEUTE);
  check('3b neue Beschwerde nach dem Praxisgespräch: Karte nicht unter der Laborstufe', ['tage', 'heute'].includes(k.stufe), `${k.stufe} (Gesamtbild ${g.stufe})`);
});

// ---------------------------------------------------------------- 4: Hirnanhangdrüse
fall('Hypophyse', () => {
  const s = stand({
    profil: { ursache: 'hypophyse' },
    befund: { tsh: tsh(0.05), ft4: ft4(16) },
    befinden: [
      { id: 'bf1', datum: plus(HEUTE, -2), stufe: 'mittel', beschwerden: ['herz'] },
      { id: 'bf2', datum: plus(HEUTE, -1), stufe: 'mittel', beschwerden: ['herz'] },
    ],
  });
  const b = ez.beschwerdenAuswerten(s, HEUTE);
  check('4 kein S4ii („niedriger TSH") bei Hirnanhangdrüse', !b.texte.some((t) => t.id === 'S4ii'), b.texte.map((t) => t.id).join(','));
  check('4 Herzklopfen an 2 Tagen: R3 heute', b.texte.some((t) => t.id === 'R3' && t.stufe === 'heute'), b.texte.map((t) => `${t.id}:${t.stufe}`).join(','));
  const f = ez.fragenVorschlaege(s, HEUTE);
  check('4 keine TSH-Frage bei Hirnanhangdrüse', !f.some((x) => /Mein TSH liegt/.test(x)), f.join(' | '));
});

// ---------------------------------------------------------------- 5: Kalendertext
fall('Kalender', () => {
  check('5 07:00 Frühstück', /Frühstück/.test(erinnerungText('07:00')));
  ['12:00', '13:00', '16:00'].forEach((u) => check(`5 ${u} ohne „nichts mehr essen" und ohne Abendtext`, !/nichts mehr essen|letzten Mahlzeit/.test(erinnerungText(u)), erinnerungText(u)));
  ['17:00', '22:00'].forEach((u) => check(`5 ${u} Abstand zur letzten Mahlzeit, ohne „nichts mehr essen"`, /letzten Mahlzeit/.test(erinnerungText(u)) && !/nichts mehr essen/.test(erinnerungText(u)), erinnerungText(u)));
});

// ---------------------------------------------------------------- 6: nach Praxis-Änderung kein „wie bisher"
fall('wie bisher', () => {
  const s = stand({
    befund: { tsh: tsh(6), praxis: 'geaendert', praxisAm: plus(BEFUND, 1) },
    dosen: [
      { id: 'd1', ab: '2025-01-01', praeparat: 'L-Thyroxin', mikrogramm: 75, tabletten: 1 },
      { id: 'd2', ab: HEUTE, praeparat: 'L-Thyroxin', mikrogramm: 88, tabletten: 1, praxis: true },
    ],
  });
  const k = dosisRichtung(s, HEUTE);
  check('6 keine Aufforderung „genau wie bisher weiter" nach eingetragener Änderung', !/genau wie bisher weiter/.test(alleTexte(k)), alleTexte(k).slice(0, 240));
});

// ---------------------------------------------------------------- B52: zwei Befunde am selben Tag
fall('B52', () => {
  const s = stand({
    befund: { tsh: tsh(7), ft4: null },
    nachher: [{ id: 'b2', datum: BEFUND, ft4: ft4(9), notiz: 'fT4 kam später' }],
  });
  check('B52 zusammengeführt: ein Befund', s.labor.filter((l) => l.datum === BEFUND).length === 1, s.labor.length);
  const e = ez.letzterBefund(s, HEUTE);
  check('B52 Muster b aus TSH und nachgereichtem fT4', e && e.muster === 'b', e && e.muster);
  const k = dosisRichtung(s, HEUTE);
  check('B52 Dosis-Karte sieht das fT4 (Stufe tage)', ['tage', 'heute'].includes(k.stufe), k.stufe);
  const w = stand({
    befund: { tsh: tsh(7) },
    nachher: [{ id: 'b2', datum: BEFUND, tsh: tsh(3) }],
  });
  check('B52 widersprüchliche Werte bleiben getrennt', w.labor.filter((l) => l.datum === BEFUND).length === 2);
});

// ================================================================ Runde 2
/*
 * Die Befunde der zweiten Review-Runde (C1–C17), so nachgestellt wie im
 * Nachweis des Prüfers. Jeder Fall scheiterte vor der Korrektur.
 */
const lage = (k) => `${k.richtung}/${k.stufe} ${k.gruende.map((g) => `${g.id}:${g.stufe}`).join(',')}${k.frage ? ` frage=${k.frage.id}` : ''}`;
const mitPflicht = (k) => `${alleTexte(k)} ${k.pflicht}`;
const d = (id, ab, mikrogramm, mehr = {}) => ({ id, ab, praeparat: 'L-Thyroxin', mikrogramm, tabletten: 1, praxis: true, ...mehr });
/** Wie app.js frageBeantworten: die Antwort dorthin, wohin die Frage gehört. */
function antworte(s, f, wert, heute) {
  if (f.ziel === 'befund') {
    const b = s.labor.find((l) => l.id === f.bezug);
    b[f.feld] = wert;
    if (f.feld === 'praxis') b.praxisAm = heute;
  } else if (f.ziel === 'nachfrage') {
    s.nachfragen.push({ id: `n${s.nachfragen.length + 1}`, art: f.feld.toLowerCase(), bezug: f.bezug, antwort: wert, am: heute });
  } else throw new Error(`Ziel ${f.ziel}`);
}

// C1 / C6 – der Check von heute gilt auch ohne Befinden-Eintrag.
fall('C1', () => {
  const s = (ja, ue = {}) => stand({ profil: { geburtsjahr: 1950, herz: 'nein' }, befund: { tsh: tsh(7.5), ft4: ft4(14), ...(ue.befund || {}) }, warnzeichen: [{ id: 'w1', datum: HEUTE, uhr: '09:00', ja }] });
  for (const ja of [['packung'], ['brust'], ['mehrere'], ['lebensmuede']]) {
    const x = s(ja);
    const k = dosisRichtung(x, HEUTE);
    const g = gesamtbildMitDosis(x, HEUTE);
    check(`C1 Check „${ja}" ohne Befinden: Karte 112 ohne Richtung wie das Gesamtbild`, k.richtung === 'klaeren' && k.stufe === 'notruf' && g.stufe === 'notruf', `${lage(k)} | Gesamtbild ${g.stufe}`);
    check(`C1 Check „${ja}": kein „Ein paar Tage Warten", kein „Beim nächsten Termin"`, !/Ein paar Tage Warten/.test(mitPflicht(k)) && k.kopf.titel !== 'Beim nächsten Termin', k.kopf.titel);
  }
  const gift = dosisRichtung(s(['packung']), HEUTE);
  check('C1 „große Menge": Giftnotruf Bayern anrufbar', gift.anrufe.some((a) => a.nummer === '08919240'), JSON.stringify(gift.anrufe));
  const w5 = dosisRichtung(s(['lebensmuede'], { befund: { tsh: tsh(0.2), ft4: ft4(20) } }), HEUTE);
  check('C1 „lebensmüde" bei TSH 0,2: kein „weniger", W5 mit Seelsorge', w5.richtung === 'klaeren' && w5.gruende.some((g) => g.id === 'W5')
    && w5.anrufe.some((a) => a.nummer === '08001110111'), lage(w5));
  const brust = dosisRichtung(s(['brust'], { befund: { tsh: tsh(0.05), ft4: ft4(30) } }), HEUTE);
  check('C1 Brustschmerz bei Muster d: 112 statt „weniger"/tage', brust.stufe === 'notruf' && brust.richtung === 'klaeren', lage(brust));
  const nichts = dosisRichtung(s([]), HEUTE);
  check('C1 „Nichts davon" ohne Befinden: Richtung unverändert, kein Satz zum Check', nichts.richtung === 'mehr' && nichts.stufe === 'termin'
    && !/Warnzeichen-Check von heute/.test(alleTexte(nichts)), lage(nichts));
});

// C2 – „mit der Praxis gesprochen" → „Noch nichts entschieden": keine Endlosschleife.
fall('C2', () => {
  const s = stand({
    profil: { geburtsjahr: 1950, herz: 'nein' }, befund: { tsh: tsh(7.5), ft4: ft4(14), datum: plus(HEUTE, -31) },
    nachfragen: [{ id: 'n1', art: 'dosis_stimmt', bezug: 'b1', antwort: 'ja', am: plus(HEUTE, -20) }],
  });
  let k = dosisRichtung(s, HEUTE);
  check('C2 Start: die 14-Tage-Frage', k.frage && k.frage.id === 'X3-14', lage(k));
  antworte(s, k.frage, 'praxis', HEUTE);
  k = dosisRichtung(s, HEUTE);
  check('C2 danach: was hat die Praxis gesagt (F8)', k.frage && k.frage.id === 'F8', lage(k));
  antworte(s, k.frage, 'nochnicht', HEUTE);
  k = dosisRichtung(s, HEUTE);
  check('C2 nach „Noch nichts entschieden": die Richtung, keine Frage', !k.frage && k.richtung === 'mehr', lage(k));
  const t13 = dosisRichtung(s, plus(HEUTE, 13));
  check('C2 Tag 13: weiter die Richtung', !t13.frage && t13.richtung === 'mehr', lage(t13));
  const t14 = dosisRichtung(s, plus(HEUTE, 14));
  check('C2 Tag 14: wieder die 14-Tage-Frage', t14.frage && t14.frage.id === 'X3-14', lage(t14));
  antworte(s, t14.frage, 'praxis', plus(HEUTE, 14));
  const f8 = dosisRichtung(s, plus(HEUTE, 14));
  check('C2 Tag 14, „mit der Praxis gesprochen": wieder F8 statt Schleife', f8.frage && f8.frage.id === 'F8', lage(f8));
});

// C3 – „über Tage zu viele Tabletten" im Check wie Q5 „über Tage zu viel".
fall('C3', () => {
  const faelle = [
    ['A 60 J., TSH 0,2, Herzklopfen', { geburtsjahr: 1966, herz: 'nein' }, tsh(0.2), ft4(20), ['herz']],
    ['B 70 J., Muster b, müde', { geburtsjahr: 1956, herz: 'nein' }, tsh(12), ft4(9), ['muede']],
    ['C 76 J., c2, Herzklopfen', { geburtsjahr: 1950, herz: 'nein' }, tsh(7.5), ft4(14), ['herz']],
    ['E 60 J., Muster d, Herzklopfen', { geburtsjahr: 1966, herz: 'nein' }, tsh(0.2), ft4(24), ['herz']],
    ['F 76 J., c2, kein Befinden', { geburtsjahr: 1950, herz: 'nein' }, tsh(7.5), ft4(14), []],
  ];
  for (const [name, profil, t, f, beschwerden] of faelle) {
    const k = dosisRichtung(stand({
      profil, befund: { tsh: t, ft4: f }, warnzeichen: [{ id: 'w1', datum: HEUTE, uhr: '09:00', ja: ['zuviele'] }],
      befinden: beschwerden.length ? [{ id: 'bf1', datum: HEUTE, stufe: 'mittel', beschwerden }] : [],
    }), HEUTE);
    check(`C3 ${name}: keine Richtung, mindestens heute`, k.richtung === 'klaeren' && ['heute', 'notruf'].includes(k.stufe), lage(k));
    check(`C3 ${name}: „verordnete Stärke", nie „genau wie bisher"`, /verordnete Stärke/.test(alleTexte(k)) && !/genau wie bisher/.test(mitPflicht(k)), alleTexte(k).slice(0, 200));
    check(`C3 ${name}: Kennung W2h, nicht Q5 (der Bericht nennt keine Befundantwort, die es nicht gibt)`, k.gruende.some((g) => g.id === 'W2h') && !k.gruende.some((g) => g.id === 'Q5'), lage(k));
  }
});

// C4 – nach „selbst geändert" gilt die Entscheidung der Praxis.
fall('C4', () => {
  const s = stand({
    profil: { geburtsjahr: 1950, herz: 'nein' }, befund: { tsh: tsh(7.5), ft4: ft4(14), datum: '2026-08-18' },
    dosen: [d('d1', '2024-01-01', 75), d('d2', '2026-09-07', 88, { praxis: false })],
    nachfragen: [{ id: 'n1', art: 'dosis_stimmt', bezug: 'b1', antwort: 'ja', am: '2026-08-23' }, { id: 'n2', art: 'nach14', bezug: 'b1', antwort: 'selbst', am: '2026-09-07' }],
  });
  const vorher = dosisRichtung(s, HEUTE);
  check('C4 vorher: „In den nächsten Tagen anrufen" (X3, Tage)', vorher.stufe === 'tage' && vorher.gruende.some((g) => g.id === 'X3' && g.stufe === 'tage'), lage(vorher));
  // „Die Praxis hat entschieden → Die Dosis bleibt so"
  s.labor[0].praxis = 'bleibt';
  s.labor[0].praxisAm = HEUTE;
  for (const tag of [HEUTE, plus(HEUTE, 30)]) {
    const k = dosisRichtung(s, tag);
    const g = gesamtbildMitDosis(s, tag);
    check(`C4 nach „bleibt so" (${tag}): kein „anrufen" auf Karte und „Heute"`, !/anrufen/.test(k.kopf.titel) && !/anrufen/.test(g.kopf.titel), `${lage(k)} | ${k.kopf.titel} | Gesamtbild ${g.kopf.titel}`);
    check(`C4 nach „bleibt so" (${tag}): X3 bleibt ohne Frist`, k.gruende.some((g2) => g2.id === 'X3' && !g2.stufe && !/in den nächsten Tagen/.test(g2.text)), lage(k));
  }
  // Dieselbe Lage, der eigene Eintrag erst 3 Tage alt: „Heute" (B2) schweigt ebenso.
  const frisch = stand({
    profil: { geburtsjahr: 1950, herz: 'nein' }, befund: { tsh: tsh(7.5), ft4: ft4(14), datum: '2026-08-18', praxis: 'bleibt', praxisAm: HEUTE },
    dosen: [d('d1', '2024-01-01', 75), d('d2', plus(HEUTE, -3), 88, { praxis: false })],
    nachfragen: [{ id: 'n1', art: 'dosis_stimmt', bezug: 'b1', antwort: 'ja', am: '2026-08-23' }, { id: 'n2', art: 'nach14', bezug: 'b1', antwort: 'selbst', am: plus(HEUTE, -4) }],
  });
  const g = gesamtbildMitDosis(frisch, HEUTE);
  check('C4 Eintrag 3 Tage alt, Praxis danach „bleibt so": Karte und „Heute" ohne „anrufen"', !/anrufen/.test(g.kopf.titel) && !g.dosisHinweise.some((h) => ['B2', 'X3'].includes(h.id)),
    `${g.kopf.titel} | ${g.teile.map((t) => `${t.id}:${t.stufe}`).join(',')}`);
});

// C5 – D6 unter „Heute anrufen" ohne „auch am Wochenende … Ein paar Tage Warten".
fall('C5', () => {
  const k = dosisRichtung(stand({
    profil: { geburtsjahr: 1952, herz: 'nein' }, befund: { tsh: tsh(0.2), ft4: ft4(20) },
    befinden: [{ id: 'bf1', datum: plus(HEUTE, -1), stufe: 'mittel', beschwerden: ['herz'] }, { id: 'bf2', datum: HEUTE, stufe: 'mittel', beschwerden: ['herz'] }],
    warnzeichen: [{ id: 'w1', datum: HEUTE, uhr: '09:00', ja: [] }],
  }), HEUTE);
  check('C5 74 J., TSH 0,2, Herzklopfen an 2 Tagen: weniger/heute', k.richtung === 'weniger' && k.stufe === 'heute', lage(k));
  check('C5 Pflichttext ohne „Ein paar Tage Warten" und „Wochenende"', !/Ein paar Tage Warten|Wochenende/.test(k.pflicht), k.pflicht.slice(0, 300));
  check('C5 Pflichttext: „Bis Sie mit der Praxis gesprochen haben, nehmen Sie Ihre Tablette genau wie bisher weiter." – ohne „,."',
    k.pflicht.includes('Bis Sie mit der Praxis gesprochen haben, nehmen Sie Ihre Tablette genau wie bisher weiter. Nehmen Sie keine') && !k.pflicht.includes(',.'), k.pflicht.slice(0, 300));
  check('C5 D6_HEUTE unterscheidet sich wirklich von D6_LANG', typeof D6_HEUTE === 'string' && D6_HEUTE !== D6_LANG && D6_LANG.includes('Ein paar Tage Warten'));
});

// C7 – eigene Verdopplung per Dosis-Eintrag: Karte wie „Heute".
fall('C7', () => {
  const s = (dosen) => stand({ profil: { geburtsjahr: 1954, herz: 'nein' }, befund: { tsh: tsh(7.2), ft4: ft4(14), datum: '2026-09-07' }, dosen });
  const l06 = s([d('d1', '2025-01-01', 75), d('d2', '2026-09-24', 75, { tabletten: 2, praxis: false })]);
  const k = dosisRichtung(l06, HEUTE);
  const g = gesamtbildMitDosis(l06, HEUTE);
  check('C7 L06 75 × 1 → 75 × 2 ohne Praxis: Karte Tage wie „Heute"', k.stufe === 'tage' && g.stufe === 'tage', `${lage(k)} | Gesamtbild ${g.stufe}`);
  check('C7 L06: „bis dahin wieder Ihre bisherige Menge", W-D2 sichtbar', /bisherige Menge/.test(alleTexte(k)) && /112/.test(k.warnzeichen || ''), alleTexte(k).slice(0, 300));
  check('C7 L06: nicht „neue Einschätzung mit dem Kontrollwert … nach der Änderung"', !/Eine neue Einschätzung gibt es mit dem Kontrollwert/.test(alleTexte(k)), alleTexte(k).slice(0, 300));
  check('C7 L06: der X3-Text steht im Gesamtbild nicht doppelt', g.teile.filter((t) => /bisherige Menge/.test(t.text)).length === 1, g.teile.map((t) => t.id).join(','));
  const m04 = dosisRichtung(s([d('d1', '2025-01-01', 75), d('d2', plus(HEUTE, -2), 88, { praxis: false })]), HEUTE);
  check('C7 M04 75 → 88 µg ohne Praxis: B2 mit Tage', m04.stufe === 'tage' && m04.gruende.some((x) => x.id === 'B2'), lage(m04));
  // Die Praxis hat danach entschieden: die Karte ohne Frist, „Heute" ohne X3 – wie bei C4.
  const danach = s([d('d1', '2025-01-01', 75), d('d2', '2026-09-24', 75, { tabletten: 2, praxis: false })]);
  danach.labor[0].praxis = 'bleibt';
  danach.labor[0].praxisAm = '2026-09-26';
  const kd = dosisRichtung(danach, HEUTE);
  const gd = gesamtbildMitDosis(danach, HEUTE);
  check('C7 danach Praxis „bleibt so": X3 ohne Frist, W-D2 bleibt, „Heute" ohne X3', kd.gruende.some((x) => x.id === 'X3' && !x.stufe) && /112/.test(kd.warnzeichen || '')
    && !gd.dosisHinweise.some((h) => h.id === 'X3') && kd.stufe === gd.stufe, `${lage(kd)} | Gesamtbild ${gd.stufe}`);
});

// C8 – „Ja" auf W-D4 nach einer Erhöhung.
fall('C8', () => {
  const s = stand({
    profil: { geburtsjahr: 1950, herz: 'nein' }, befund: { tsh: tsh(6.8), ft4: ft4(14), datum: '2026-08-18' },
    dosen: [d('d1', '2024-01-01', 75), d('d2', '2026-09-12', 88)],
    nachfragen: [{ id: 'n1', art: 'dosis_stimmt', bezug: 'b1', antwort: 'ja', am: '2026-08-20' }, { id: 'n2', art: 'wd4', bezug: 'd2-14', antwort: 'ja', am: HEUTE }],
  });
  const k = dosisRichtung(s, HEUTE);
  const g = gesamtbildMitDosis(s, HEUTE);
  check('C8 Karte „Heute anrufen" wie „Heute", nicht „Kein besonderer Anlass"', k.stufe === 'heute' && g.stufe === 'heute' && k.kopf.titel !== 'Kein besonderer Anlass', `${lage(k)} | ${k.kopf.titel}`);
  const h = g.dosisHinweise.find((x) => x.id === 'W-D4');
  check('C8 W-D4 unter „Heute anrufen" sagt „heute noch", nicht „heute oder morgen"', h && /heute noch/.test(h.text) && !/heute oder morgen/.test(h.text), h && h.text);
});

// C11 – L7d und D6c zur selben Kontrolle: nur eine Stufe.
fall('C11', () => {
  const s = stand({
    profil: { geburtsjahr: 1950, herz: 'nein' }, befund: { tsh: tsh(7), ft4: ft4(14), datum: '2026-06-19' },
    dosen: [d('d1', '2024-01-01', 75), d('d2', '2026-07-29', 88)],
  });
  for (const tag of [HEUTE, '2026-10-07', '2026-10-21']) {
    const g = gesamtbildMitDosis(s, tag);
    const d6c = g.dosisHinweise.find((h) => h.id === 'D6c');
    const l7d = g.teile.find((t) => t.id === 'L7d');
    check(`C11 ${tag}: nicht L7d und D6c nebeneinander, D6c mindestens zeitnah`, !(d6c && l7d) && (!d6c || ['zeitnah', 'tage', 'heute'].includes(d6c.stufe)),
      g.teile.map((t) => `${t.id}:${t.stufe}`).join(','));
  }
});

// C17 – alte Antwort „Nein, ich nehme etwas anderes" (Nachweis b6-alte-nein-antwort).
fall('C17', () => {
  const s = stand({
    profil: { geburtsjahr: 1950, herz: 'nein', diabetes: 'ja' }, mittel: ['marcumar'],
    befund: { id: 'b1', datum: '2026-08-25', tsh: tsh(6.5), ft4: ft4(13), praxis: 'geaendert', praxisAm: '2026-08-26' },
    vorher: [{ id: 'b0', datum: '2026-03-10', tsh: tsh(3), ft4: ft4(14), ...FRAGEN }],
    // „Auf Anweisung der Praxis: Ja" – die Marke kam von der alten Antwort zum Befund vom 10.03.
    dosen: [d('d1', '2024-01-01', 75), d('d2', '2026-09-01', 100, { berichtigung: true })],
    nachfragen: [{ id: 'n1', art: 'dosis_stimmt', bezug: 'b1', antwort: 'ja', am: '2026-08-26' }],
  });
  const h15 = dosisHinweise(s, '2026-09-15');
  check('C17 15.09.: Nachfrage W-D4 nach der Erhöhung', h15.some((h) => h.id === 'W-D4' && h.frage), h15.map((h) => h.id).join(','));
  check('C17 15.09.: WW1/WW2 ohne „Sie haben berichtigt", kein X3b', !h15.some((h) => /berichtigt/.test(h.text)) && !h15.some((h) => h.id === 'X3b'), h15.map((h) => h.id).join(','));
  const h27 = dosisHinweise(s, '2026-10-27');
  check('C17 27.10.: Kontrolle D6c', h27.some((h) => h.id === 'D6c'), h27.map((h) => h.id).join(','));
  const k = dosisRichtung(s, '2026-09-15');
  check('C17 Karte: kein Rat, „Gilt ab" auf die Blutabnahme vorzuverlegen', !/Gilt ab/.test(alleTexte(k)), alleTexte(k).slice(0, 200));
});

// ---------------------------------------------------------------- Nachprüfung Runde 2

// Eigene Änderung VOR der Blutabnahme, danach entscheidet die Praxis: Der
// Schutz „wieder die bisherige Menge" bleibt als Grund ohne Frist (C4-Urteil).
fall('R2-a', () => {
  const s = stand({
    befund: { datum: plus(HEUTE, -5), tsh: tsh(0.2), praxis: 'bleibt', praxisAm: plus(HEUTE, -3) },
    dosen: [d('d1', '2025-01-01', 75), d('d2', plus(HEUTE, -10), 150, { praxis: false })],
  });
  const k = dosisRichtung(s, HEUTE);
  check('R2-a eigene Änderung vor der Abnahme: Grund bleibt nach der Entscheidung der Praxis', /ohne Anweisung der Praxis/.test(alleTexte(k)), alleTexte(k).slice(0, 240));
  check('R2-a großer Schritt: „bisherige Menge" und 112-Zeichen', /bisherige Menge/.test(alleTexte(k)) && Boolean(k.warnzeichen), k.warnzeichen);
});

// Herzklopfen ohne Check von heute: Die Karte fragt zuerst nach dem Check –
// ihr Schild liegt trotzdem nicht unter „Heute" (X3 nach eigener Änderung).
fall('R2-b', () => {
  const s = stand({
    dosen: [d('d1', '2025-01-01', 75), d('d2', plus(HEUTE, -2), 150, { praxis: false })],
    befinden: [{ id: 'bf1', datum: plus(HEUTE, -1), stufe: 'mittel', beschwerden: ['herz'] }],
  });
  const k = dosisRichtung(s, HEUTE);
  const g = gesamtbildMitDosis(s, HEUTE);
  check('R2-b Frage nach dem Check', k.frage && k.frage.ziel === 'warncheck', k.frage && k.frage.id);
  check('R2-b Kartenstufe nicht unter Heute', ez.STUFEN[k.stufe].rang >= ez.STUFEN.tage.rang, `${k.stufe} / ${g.stufe}`);
});

// Drei Einträge am selben Tag: Eine widersprüchliche Frage bleibt offen.
fall('R2-c', () => {
  const s = stand({
    befund: { tsh: tsh(0.2), biotin: 'nein' },
    nachher: [
      { id: 'b2', datum: BEFUND, ft4: ft4(15), biotin: 'ja' },
      { id: 'b3', datum: BEFUND, ft3: { wert: 4, einheit: 'pmol/l', von: 3.1, bis: 6.8 }, biotin: 'nein' },
    ],
  });
  const b = s.labor.find((l) => l.datum === BEFUND);
  check('R2-c Biotin ja/nein/nein: bleibt offen', b.biotin === '', b.biotin);
  const k = dosisRichtung(s, HEUTE);
  check('R2-c Karte fragt nach Biotin statt eine Richtung zu nennen', k.frage && k.frage.feld === 'biotin', k.frage ? k.frage.feld : k.richtung);
});

// Nach einem Check von heute schickt R3 nicht noch einmal zum Check.
fall('R2-d', () => {
  const s = stand({
    befinden: [{ id: 'bf1', datum: plus(HEUTE, -1), stufe: 'mittel', beschwerden: ['herz'] }],
    warnzeichen: [{ id: 'w1', datum: HEUTE, uhr: '09:00', ja: [] }],
  });
  const r3 = ez.beschwerdenAuswerten(s, HEUTE).texte.find((t) => t.id === 'R3');
  check('R2-d R3 ohne „Gehen Sie dazu kurz den Warnzeichen-Check durch"', r3 && !/Warnzeichen-Check durch/.test(r3.text), r3 && r3.text);
  const ohne = ez.beschwerdenAuswerten(stand({ befinden: [{ id: 'bf1', datum: plus(HEUTE, -1), stufe: 'mittel', beschwerden: ['herz'] }] }), HEUTE).texte.find((t) => t.id === 'R3');
  check('R2-d ohne Check: Verweis bleibt', ohne && /Warnzeichen-Check durch/.test(ohne.text));
});

// Kopfzeile nach „große Menge Tabletten": der Giftnotruf zuerst.
fall('R2-e', () => {
  const s = stand({ warnzeichen: [{ id: 'w1', datum: HEUTE, uhr: '09:00', ja: ['packung'] }] });
  const g = ez.gesamtbild(s, HEUTE);
  check('R2-e Kopf nennt den Giftnotruf', /Giftnotruf/.test(g.kopf.titel), g.kopf.titel);
  const b = ez.gesamtbild(stand({ warnzeichen: [{ id: 'w1', datum: HEUTE, uhr: '09:00', ja: ['packung', 'brust'] }] }), HEUTE);
  check('R2-e mit Brustschmerz: 112 im Kopf', /112/.test(`${b.kopf.titel} ${b.kopf.text}`) && !/Giftnotruf anrufen/.test(b.kopf.titel), b.kopf.titel);
});

// ================================================================ Runde 3
/*
 * Die Befunde der dritten Review-Runde zur Dosis-Karte (D4, D7, D9, D11,
 * D12, D14, D15, D17–D20), so nachgestellt wie im Nachweis – meist über
 * viele Tage oder mehrere Antworten hintereinander. Jeder Fall scheiterte vor
 * der Korrektur.
 */
const R3 = { keine: 0, termin: 1, zeitnah: 2, tage: 3, heute: 4, notruf: 5 };
const bef3 = (id, datum, beschwerden) => ({ id, datum, stufe: 'mittel', beschwerden });
const ja = (bezug, am) => ({ id: `n-${bezug}-${am}`, art: 'dosis_stimmt', bezug, antwort: 'ja', am });

// D4 – nach einer Erhöhung: „Schmerzen in der Brust" heißt sofort 112, schon unter der Frage.
fall('D4', () => {
  const s = stand({
    profil: { herz: 'nein' }, befund: { datum: '2026-08-20', tsh: tsh(6.5), ft4: ft4(14), praxisAm: '2026-08-22' },
    dosen: [d('d1', '2024-01-01', 75), d('d2', '2026-09-13', 88)], nachfragen: [ja('b1', '2026-08-22')],
  });
  const f = dosisHinweise(s, HEUTE).find((h) => h.id === 'W-D4' && h.frage);
  check('D4 Tag 14: Frage nach Herzklopfen … Brust nennt „sofort 112", 112 anrufbar', f && /sofort 112/.test(f.text) && f.anrufe.some((a) => a.nummer === '112'), f && f.text);
  antworte(s, f.frage, 'ja', HEUTE);
  const h = dosisHinweise(s, HEUTE).find((x) => x.id === 'W-D4');
  check('D4 nach „Ja": heute noch anrufen, bei Brustschmerz sofort 112, 112 anrufbar', h && h.stufe === 'heute' && /heute noch/.test(h.text) && /sofort 112/.test(h.text)
    && h.anrufe.some((a) => a.nummer === '112'), h && h.text);
  const k = dosisRichtung(s, HEUTE);
  check('D4 Dosis-Karte: W-D4 mit „sofort 112", 112 anrufbar', k.gruende.some((g) => g.id === 'W-D4' && /sofort 112/.test(g.text)) && k.anrufe.some((a) => a.nummer === '112'), lage(k));
});

// D7 – Hirnanhangdrüse: D0.18 aus fT4, nicht aus dem TSH-Muster.
fall('D7', () => {
  const s = (f) => stand({
    profil: { ursache: 'hypophyse' }, befund: { tsh: tsh(0.3), ft4: ft4(f) },
    befinden: [bef3('bf1', HEUTE, ['muede', 'frieren', 'verstopfung', 'trockenhaut'])],
  });
  for (const f of [12.5, 20]) {
    const x = s(f);
    const k = dosisRichtung(x, HEUTE);
    const g = gesamtbildMitDosis(x, HEUTE);
    check(`D7 fT4 ${f} im Bereich, Beschwerden „zu wenig": kein „passen nicht zu diesem Laborwert"`, !k.gruende.some((y) => y.id === 'D0.18')
      && !g.teile.some((t) => /passen nicht zu diesem Laborwert/.test(t.text)), lage(k));
  }
  const ueber = dosisRichtung(s(23), HEUTE);
  check('D7 fT4 23 über dem Bereich, Beschwerden „zu wenig": D0.18', ueber.gruende.some((y) => y.id === 'D0.18'), lage(ueber));
});

// D9 – Muster b: Schläfrigkeit, Verwirrtheit, Auskühlen → sofort 112 wie in der Einschätzung.
fall('D9', () => {
  const x = stand({ befund: { tsh: tsh(15), ft4: ft4(7) } });
  const k = dosisRichtung(x, HEUTE);
  const e = ez.letzterBefund(x, HEUTE);
  check('D9 Einschätzung: sofort 112', /sofort 112/.test(e.notfall.text), e.notfall.text);
  check('D9 Dosis-Karte: ebenfalls sofort 112, nicht zuerst der Check', /ungewohnt stark schläfrig oder neu verwirrt sind oder stark auskühlen: sofort 112/.test(alleTexte(k))
    && !/verwirrt sind oder stark frieren, machen Sie gleich den Warnzeichen-Check/.test(alleTexte(k)), alleTexte(k).slice(0, 400));
});

// D11 – eigene große Änderung: kein Ablaufdatum nach 14 Tagen.
fall('D11', () => {
  const basis = (dosen) => stand({
    profil: { herz: 'nein' }, befund: { datum: '2026-01-19', tsh: tsh(6.5), ft4: ft4(14), praxisAm: '2026-01-22' },
    dosen, nachfragen: [ja('b1', '2026-01-22')],
  });
  const s = basis([d('d1', '2025-03-01', 75), d('d2', '2026-01-26', 125, { praxis: false })]);
  const schlecht = [];
  for (let n = 0; n <= 70; n++) {
    const tag = plus('2026-01-26', n);
    const k = dosisRichtung(s, tag);
    const g = gesamtbildMitDosis(s, tag);
    const ok = k.stufe === 'tage' && g.stufe === 'tage' && k.gruende.some((x) => x.id === 'X3' && /bisherige Menge/.test(x.text)) && /112/.test(k.warnzeichen || '')
      && !/Eine neue Einschätzung gibt es mit dem Kontrollwert/.test(alleTexte(k));
    if (!ok) schlecht.push(`Tag ${n}: ${lage(k)} Gesamtbild ${g.stufe}`);
  }
  check('D11 75 → 125 µg ohne Praxis, Tag 0 bis 70: Karte und Gesamtbild Tage, X3 „bisherige Menge", W-D2', !schlecht.length, schlecht.slice(0, 3).join(' | '));
  // Die Praxis entscheidet danach: X3 ohne Frist, kein „anrufen".
  const entschieden = basis([d('d1', '2025-03-01', 75), d('d2', '2026-01-26', 125, { praxis: false })]);
  entschieden.labor[0].praxis = 'bleibt';
  entschieden.labor[0].praxisAm = '2026-02-15';
  const ke = dosisRichtung(entschieden, '2026-02-25');
  check('D11 Praxis danach „bleibt so": X3 ohne Frist, Stufe keine', ke.stufe === 'keine' && ke.gruende.some((x) => x.id === 'X3' && !x.stufe), lage(ke));
  // Sie folgt dem Rat und nimmt wieder 75 µg (Quelle nein): nicht noch einmal „bisherige Menge".
  const zurueck = basis([d('d1', '2025-03-01', 75), d('d2', '2026-01-26', 125, { praxis: false }), d('d3', '2026-01-29', 75, { praxis: false })]);
  for (const n of [3, 10, 18]) {
    const tag = plus('2026-01-26', n);
    const k = dosisRichtung(zurueck, tag);
    const h = dosisHinweise(zurueck, tag);
    check(`D11 zurück auf 75 µg, Tag ${n}: kein „wieder Ihre bisherige Menge", Tage`, !/bisherige Menge/.test(alleTexte(k)) && !h.some((x) => /bisherige Menge/.test(x.text))
      && k.stufe === 'tage' && /frühere Menge/.test(alleTexte(k)), `${lage(k)} | ${h.map((x) => x.id).join(',')}`);
  }
});

// D12 – Kontrolle nach der Änderung: eine stabile Stufe, keine Obergrenze.
fall('D12', () => {
  const s = stand({
    befund: { datum: '2026-01-19', tsh: tsh(4.5), ft4: ft4(14), praxis: 'geaendert', praxisAm: '2026-01-24' },
    dosen: [d('d1', '2025-03-01', 75), d('d2', '2026-01-26', 88)], nachfragen: [ja('b1', '2026-01-22')],
  });
  const schlecht = [];
  for (let n = 56; n <= 400; n++) {
    const tag = plus('2026-01-26', n);
    const g = gesamtbildMitDosis(s, tag);
    const karte = g.dosisHinweise.some((h) => h.id === 'D6c');
    const soll = n > 90 ? 'zeitnah' : 'termin';
    if (R3[g.stufe] < R3[soll] || karte !== (n <= 84 || n % 7 === 0) || g.teile.some((t) => t.id === 'L7a' || t.id === 'L7d')) {
      schlecht.push(`Tag ${n}: ${g.stufe} D6c-Karte=${karte} [${g.teile.map((t) => t.id).join(',')}]`);
    }
  }
  check('D12 Tag 56 bis 400 ohne Befund: ab Tag 91 jeden Tag zeitnah, Karte auf „Heute" nur bis Tag 84 und jeden 7. Tag, nie L7a/L7d daneben', !schlecht.length, schlecht.slice(0, 4).join(' | '));
});

// D14 – die 14-Tage-Rückfrage nur bei „mehr" oder „weniger".
fall('D14', () => {
  const s = (t) => stand({ befund: { datum: '2026-03-13', tsh: tsh(t), ft4: ft4(16), praxisAm: '2026-03-16' }, nachfragen: [ja('b1', '2026-03-16')] });
  const normal = s(2.1);
  const mit = [];
  for (let tag = '2026-03-29'; tag <= '2026-06-13'; tag = plus(tag, 1)) {
    const k = dosisRichtung(normal, tag);
    if (k.frage) mit.push(`${tag}: ${k.frage.id}`);
  }
  check('D14 TSH 2,1 („so lassen"): bis zum Befundalter 92 nie „Haben Sie inzwischen mit der Praxis gesprochen …?"', !mit.length, mit.slice(0, 3).join(' | '));
  const hoch = dosisRichtung(s(6.5), '2026-03-30');
  check('D14 Gegenprobe TSH 6,5 (mehr): Rückfrage nach 14 Tagen', hoch.frage && hoch.frage.id === 'X3-14', lage(hoch));
});

// D15 – INR und Blutzucker mit festem Datum.
fall('D15', () => {
  const s = stand({
    profil: { herz: 'nein', diabetes: 'ja' }, mittel: ['marcumar', 'metformin'],
    befund: { datum: '2026-01-19', tsh: tsh(4.5), ft4: ft4(14), praxis: 'geaendert', praxisAm: '2026-01-24' },
    dosen: [d('d1', '2025-03-01', 75), d('d2', '2026-01-26', 88)], nachfragen: [ja('b1', '2026-01-22')],
  });
  const texte = (id, von, bis) => {
    const t = new Set();
    for (let n = von; n <= bis; n++) dosisHinweise(s, plus('2026-01-26', n)).filter((h) => h.id === id).forEach((h) => t.add(h.text));
    return [...t];
  };
  const ww1 = texte('WW1', 0, 14);
  check('D15 WW1 Tag 0 bis 14: jeden Tag derselbe Text, „bis spätestens 09.02.2026", kein „in den nächsten 1 bis 2 Wochen"', ww1.length === 1 && /bis spätestens 09\.02\.2026/.test(ww1[0])
    && !/in den nächsten 1 bis 2 Wochen/.test(ww1[0]), ww1.join(' | ').slice(0, 300));
  const ww2 = texte('WW2', 0, 42);
  check('D15 WW2 Tag 0 bis 42: jeden Tag derselbe Text, „bis zum 09.03.2026"', ww2.length === 1 && /bis zum 09\.03\.2026/.test(ww2[0]) && !/in den nächsten 6 Wochen/.test(ww2[0]), ww2.join(' | ').slice(0, 300));
});

// D17 – ein neues Warnsignal senkt nie die Dosis-Karte oder „Heute" und tilgt keinen dringlichen Grund.
fall('D17', () => {
  const V = {
    'V1 „selbst geändert", kein Eintrag, c2': () => stand({
      profil: { geburtsjahr: 1950, herz: 'nein' }, befund: { datum: plus(HEUTE, -30), tsh: tsh(7.5), ft4: ft4(14) },
      nachfragen: [ja('b1', plus(HEUTE, -28)), { id: 'n2', art: 'nach14', bezug: 'b1', antwort: 'selbst', am: plus(HEUTE, -2) }],
    }),
    'V2 Muster d, Q5 „einmal"': () => stand({
      profil: { geburtsjahr: 1962, herz: 'nein' }, befund: { datum: plus(HEUTE, -3), tsh: tsh(0.05), ft4: ft4(30), verwechselt: 'einmal' }, nachfragen: [ja('b1', plus(HEUTE, -2))],
    }),
    'V3 Muster d, Q5 „über Tage"': () => stand({
      profil: { geburtsjahr: 1962, herz: 'nein' }, befund: { datum: plus(HEUTE, -3), tsh: tsh(0.05), ft4: ft4(30), verwechselt: 'tage' }, nachfragen: [ja('b1', plus(HEUTE, -2))],
    }),
    'V4 75 → 150 µg ohne Praxis vor 20 Tagen': () => stand({
      profil: { herz: 'nein' }, befund: { datum: plus(HEUTE, -40), tsh: tsh(7.5), ft4: ft4(14), praxisAm: plus(HEUTE, -38) },
      dosen: [d('d1', '2025-01-01', 75), d('d2', plus(HEUTE, -20), 150, { praxis: false })], nachfragen: [ja('b1', plus(HEUTE, -38))],
    }),
  };
  const DAZU = {
    'Herzklopfen heute': (x) => x.befinden.push(bef3('neu', HEUTE, ['herz'])),
    'Zittern vor 10 Tagen': (x) => x.befinden.push(bef3('neu', plus(HEUTE, -10), ['zittern'])),
    'lebensmüde im Befinden': (x) => x.befinden.push(bef3('neu', HEUTE, ['lebensmuede'])),
    'Check „lebensmüde"': (x) => x.warnzeichen.push({ id: 'neu', datum: HEUTE, uhr: '23:00', ja: ['lebensmuede'] }),
    'Check „große Menge"': (x) => x.warnzeichen.push({ id: 'neu', datum: HEUTE, uhr: '23:00', ja: ['packung'] }),
  };
  for (const [vn, mk] of Object.entries(V)) {
    const k0 = dosisRichtung(mk(), HEUTE);
    const g0 = gesamtbildMitDosis(mk(), HEUTE);
    const dringend = k0.gruende.filter((g) => g.stufe && R3[g.stufe] >= R3.tage);
    for (const [dn, f] of Object.entries(DAZU)) {
      const x = mk();
      f(x);
      const k = dosisRichtung(x, HEUTE);
      const g = gesamtbildMitDosis(x, HEUTE);
      const fehlt = dringend.filter((y) => !k.gruende.some((z) => z.id === y.id)).map((y) => y.id);
      check(`D17 ${vn} + ${dn}: Karte und Gesamtbild nicht niedriger, kein dringlicher Grund verschwindet`,
        R3[k.stufe] >= R3[k0.stufe] && R3[g.stufe] >= R3[g0.stufe] && !fehlt.length, `${lage(k0)} → ${lage(k)} | Gesamtbild ${g0.stufe} → ${g.stufe} | fehlt ${fehlt}`);
    }
  }
  // Nur neben W1 (Brustschmerz) blendet die Karte alles andere aus (RW1 W1).
  const brust = V['V2 Muster d, Q5 „einmal"']();
  brust.warnzeichen.push({ id: 'neu', datum: HEUTE, uhr: '23:00', ja: ['brust'] });
  const kb = dosisRichtung(brust, HEUTE);
  check('D17 Gegenprobe Check Brustschmerz: nur W1 auf der Karte', kb.stufe === 'notruf' && kb.gruende.every((g) => g.id === 'W1'), lage(kb));
});

// D18 – beantwortetes Q5 „einmal" bleibt neben jedem weiteren Grund.
fall('D18', () => {
  const s = (ue = {}) => stand({
    profil: { geburtsjahr: 1962, herz: 'nein', ...(ue.profil || {}) }, befund: { datum: '2026-09-24', tsh: tsh(0.05), ft4: ft4(30), verwechselt: 'einmal' },
    nachfragen: [ja('b1', '2026-09-25')], befinden: ue.befinden || [], warnzeichen: ue.warnzeichen || [],
  });
  const faelle = {
    'Beschwerden frieren, Verstopfung, trockene Haut (D0.18)': { befinden: [bef3('bf1', HEUTE, ['frieren', 'verstopfung', 'trockenhaut'])] },
    'Kortison „weiß nicht" (D0.14)': { profil: { kortison: 'unbekannt' } },
    'Check „über Tage zu viele" (W2h)': { warnzeichen: [{ id: 'w1', datum: HEUTE, uhr: '09:00', ja: ['zuviele'] }] },
  };
  for (const [name, ue] of Object.entries(faelle)) {
    const x = s(ue);
    const k = dosisRichtung(x, HEUTE);
    const g = gesamtbildMitDosis(x, HEUTE);
    check(`D18 Q5 „einmal" + ${name}: Karte und Gesamtbild heute, Giftnotruf auf Karte und im Gesamtbild, kein „genau wie bisher"`,
      k.stufe === 'heute' && g.stufe === 'heute' && k.gruende.some((y) => y.id === 'Q5') && k.anrufe.some((a) => a.nummer === '08919240')
      && g.teile.some((t) => /Giftnotruf/.test(t.text)) && !/genau wie bisher/.test(alleTexte(k)), `${lage(k)} | Gesamtbild ${g.stufe}`);
  }
});

// D19 – „Nein, ich nehme etwas anderes" am Einrichtungstag: keine Schleife.
fall('D19', () => {
  const s = stand({ profil: { geburtsjahr: 1950, herz: 'nein' }, befund: { datum: HEUTE, tsh: tsh(7.5), ft4: ft4(14) }, dosen: [d('d1', HEUTE, 75)], nachfragen: [] });
  const k1 = dosisRichtung(s, HEUTE);
  check('D19 Start: „Nehmen Sie im Moment genau 75 µg …?"', k1.frage && k1.frage.id === 'X3', lage(k1));
  antworte(s, k1.frage, k1.frage.optionen[1][0], HEUTE);
  const k2 = dosisRichtung(s, HEUTE);
  check('D19 nach „Nein": nicht dieselbe Frage, sondern der vorhandene Eintrag zum Ändern', !k2.frage && k2.gruende.some((g) => g.id === 'X3') && k2.aktion === 'dosis' && k2.aktionParam === 'd1', lage(k2));
  check('D19 am Folgetag ebenso, ohne zweite Antwort', !dosisRichtung(s, plus(HEUTE, 1)).frage, lage(dosisRichtung(s, plus(HEUTE, 1))));
  // Wie das Dosis-Formular beim Ändern: Menge berichtigt, Marke „berichtigung", die Antwort „Nein" fällt weg.
  Object.assign(s.dosen[0], { mikrogramm: 100, berichtigung: true });
  s.nachfragen = s.nachfragen.filter((n) => !/^nein/.test(n.antwort));
  const k3 = dosisRichtung(s, HEUTE);
  check('D19 nach dem Ändern: „Nehmen Sie im Moment genau 100 µg …?"', k3.frage && k3.frage.id === 'X3' && /100 µg/.test(k3.frage.text), lage(k3));
  antworte(s, k3.frage, 'ja', HEUTE);
  const k4 = dosisRichtung(s, HEUTE);
  const h = dosisHinweise(s, HEUTE);
  check('D19 nach „Ja": die Richtung, keine Hinweise auf eine Änderung (X3, B2, W-D4)', !k4.frage && k4.richtung === 'mehr' && !h.some((x) => ['X3', 'B2', 'W-D4', 'X3b'].includes(x.id)), `${lage(k4)} | ${h.map((x) => x.id)}`);
});

// D20 – W-D4 nach einer Senkung unter „In den nächsten Tagen anrufen".
fall('D20', () => {
  const s = stand({
    profil: { geburtsjahr: 1950, herz: 'nein' },
    vorher: [{ id: 'b0', datum: '2026-08-20', tsh: tsh(0.2), ft4: ft4(21), ...FRAGEN, praxis: 'geaendert', praxisAm: '2026-08-25' }],
    befund: { datum: '2026-09-25', tsh: tsh(12), ft4: ft4(11) },
    dosen: [d('d1', '2025-01-01', 100), d('d2', '2026-08-26', 88)],
    nachfragen: [ja('b1', '2026-09-25'), { id: 'n2', art: 'wd4', bezug: 'd2-28', antwort: 'ja', am: '2026-09-24' }],
  });
  const k = dosisRichtung(s, HEUTE);
  const w = k.gruende.find((g) => g.id === 'W-D4');
  check('D20 Karte „In den nächsten Tagen anrufen": W-D4 ohne „bei der Kontrolle", mit dem Anruf', k.stufe === 'tage' && w && !/bei der Kontrolle/.test(w.text) && /Anruf/.test(w.text), `${lage(k)} | ${w && w.text}`);
});

// ================================================================ Nachprüfung Runde 3
/*
 * Was die Nachprüfer nach den Korrekturen der dritten Runde noch fanden.
 * Jeder Fall scheiterte vor der Korrektur.
 */

// R3-a – Berichtigung über den Verlauf („Weg B"): ein zweiter Eintrag mit demselben Beginn ist keine Änderung.
fall('R3-a', () => {
  for (const praxis of [false, true, null]) {
    const s = stand({
      profil: { geburtsjahr: 1950, herz: 'nein' }, befund: { datum: HEUTE, tsh: tsh(7.5), ft4: ft4(14) },
      dosen: [d('d1', HEUTE, 75, { praxis: null }), d('d2', HEUTE, 100, { praxis, berichtigung: true })], nachfragen: [],
    });
    const k = dosisRichtung(s, HEUTE);
    check(`R3-a praxis ${praxis}: kein „weniger als 8 Wochen vor der Abnahme geändert" (D0.6), Frage „genau 100 µg?"`,
      !k.gruende.some((g) => g.id === 'D0.6') && k.frage && k.frage.id === 'X3' && /100 µg/.test(k.frage.text), lage(k));
  }
  // Gegenprobe: ein echter Wechsel am selben Tag (ohne Berichtigung) bleibt eine Änderung.
  const w = stand({
    profil: { geburtsjahr: 1950, herz: 'nein' }, befund: { datum: HEUTE, tsh: tsh(7.5), ft4: ft4(14) },
    dosen: [d('d0', '2024-01-01', 75), d('d1', plus(HEUTE, -10), 88), d('d2', plus(HEUTE, -10), 100)], nachfragen: [ja('b1', HEUTE)],
  });
  check('R3-a Gegenprobe: 75 → 100 µg vor 10 Tagen bleibt D0.6', dosisRichtung(w, HEUTE).gruende.some((g) => g.id === 'D0.6'), lage(dosisRichtung(w, HEUTE)));
  // Ein doppelter Eintrag (alles gleich) ist keine Änderung (B59) – auch für D0.6.
  const dp = stand({
    profil: { geburtsjahr: 1950, herz: 'nein' }, befund: { datum: HEUTE, tsh: tsh(7.5), ft4: ft4(14) },
    dosen: [d('d0', '2024-01-01', 75), d('d1', plus(HEUTE, -10), 75, { praxis: null })], nachfragen: [ja('b1', HEUTE)],
  });
  check('R3-a doppelter Eintrag: kein D0.6', !dosisRichtung(dp, HEUTE).gruende.some((g) => g.id === 'D0.6'), lage(dosisRichtung(dp, HEUTE)));
});

// R3-b – 112-Karten mit übernommener großer eigener Änderung (X3) tragen W-D2 wie die übrigen Karten.
fall('R3-b', () => {
  const basis = (ue = {}) => stand({
    profil: { herz: 'nein' }, befund: { datum: '2026-09-20', tsh: tsh(8), ft4: ft4(13), praxisAm: '2026-09-21' },
    dosen: [d('d1', '2024-01-01', 75), d('d2', plus(HEUTE, -3), 150, { praxis: false })], nachfragen: [ja('b1', '2026-09-21')], ...ue,
  });
  const ohne = dosisRichtung(basis(), HEUTE);
  check('R3-b ohne Notfall: X3 mit W-D2', ohne.gruende.some((g) => g.id === 'X3') && ohne.warnzeichen === dosisModul.WD2, lage(ohne));
  const w5 = dosisRichtung(basis({ befinden: [bef3('f1', HEUTE, ['lebensmuede'])] }), HEUTE);
  check('R3-b lebensmüde (W5): X3 bleibt, W-D2 steht auf der Karte', w5.stufe === 'notruf' && w5.gruende.some((g) => g.id === 'X3') && w5.warnzeichen === dosisModul.WD2, lage(w5));
  const w4 = dosisRichtung(basis({ warnzeichen: [{ id: 'w1', datum: HEUTE, uhr: '09:00', ja: ['packung'] }] }), HEUTE);
  check('R3-b Check mit 112-Zeichen: X3 bleibt, W-D2 steht auf der Karte', w4.stufe === 'notruf' && w4.gruende.some((g) => g.id === 'X3') && w4.warnzeichen === dosisModul.WD2, lage(w4));
});

// R3-c – die 14-Tage-Frage (X3-14) verdeckt nicht die Notfallzeilen der Richtung.
fall('R3-c', () => {
  const s = (t, f) => stand({
    profil: { geburtsjahr: 1948, herz: 'nein' }, befund: { datum: '2026-03-13', tsh: tsh(t), ft4: ft4(f), praxisAm: '2026-03-16' },
    dosen: [d('d1', '2025-03-01', 75, { praxis: null })], nachfragen: [ja('b1', '2026-03-16')],
  });
  const b = dosisRichtung(s(15, 7), '2026-04-01');
  check('R3-c Muster b unter der Frage: „sofort 112" bei Schläfrigkeit, W-D2, 112 anrufbar',
    b.frage && b.frage.id === 'X3-14' && b.texte.some((t) => /sofort 112/.test(t)) && b.warnzeichen === dosisModul.WD2 && b.anrufe.some((a) => a.nummer === '112'), lage(b));
  const dd = dosisRichtung(s(0.05, 25), '2026-04-01');
  check('R3-c Muster d unter der Frage: W-D2 bleibt', dd.frage && dd.frage.id === 'X3-14' && dd.warnzeichen === dosisModul.WD2, lage(dd));
});

// ================================================================ Runde 4
/*
 * Die Befunde der vierten Review-Runde zur Dosis-Karte (E16, E18, E30, E31,
 * E33), so nachgestellt wie im Nachweis – über viele Tage hintereinander.
 * Jeder Fall scheiterte vor der Korrektur (außer den Gegenproben).
 */
const R4 = { keine: 0, termin: 1, zeitnah: 2, tage: 3, heute: 4, notruf: 5 };
const tshL = (wert) => ({ wert, einheit: 'mU/l', von: 0.27, bis: 4.2 });
const tage = (von, bis) => { const l = []; for (let t = von; t <= bis; t = plus(t, 1)) l.push(t); return l; };
/** Wie app.js render(): Die Karte merkt sich, welche Richtung sie gezeigt hat. */
function zeigen(s, heute, mitTitel = true) {
  const k = dosisRichtung(s, heute);
  if (k && k.merken) {
    const { titel, ...rest } = k.merken;
    s.nachfragen.push({ id: `kg-${heute}`, ...rest, ...(mitTitel ? { titel } : {}), am: heute });
  }
  return k;
}

// E16 – RW2 B1: Der Bericht nennt die zuletzt gezeigte Richtungskarte mit
// Datum, auch wenn die Karte heute die 14-Tage-Rückfrage stellt.
fall('E16', () => {
  const neu = () => stand({
    profil: { geburtsjahr: 1958, herz: 'nein' }, befund: { datum: '2026-09-08', tsh: tshL(7.8), ft4: ft4(14) },
    dosen: [d('d1', '2025-01-01', 100)], nachfragen: [ja('b1', '2026-09-10')],
  });
  const s = neu();
  // Vor der ersten Anzeige: kein „der Patientin gezeigt", der Kopf nennt den Stand.
  const vorher = dosisBerichtZeilen(s, '2026-09-12');
  check('E16 Bericht vor der ersten Anzeige: „Stand 12.09.2026", „Dazu gehört der Pflichttext", nicht „der Patientin dazu gezeigt"',
    /^Dosis-Karte der App, Stand 12\.09\.2026, zum Befund vom 08\.09\.2026/.test(vorher[0]) && vorher.some((z) => /Dazu gehört der Pflichttext: .*keine Anweisung/.test(z))
    && !vorher.some((z) => /Patientin dazu gezeigt/.test(z)), vorher.slice(0, 2).join(' | '));
  const k12 = zeigen(s, '2026-09-12');
  check('E16 die Karte merkt sich die Richtung mit Titel', k12.merken && k12.merken.art === 'karte_gezeigt' && k12.merken.bezug === 'b1'
    && k12.merken.antwort === 'mehr' && k12.merken.titel === k12.titel, JSON.stringify(k12.merken));
  tage('2026-09-13', '2026-09-23').forEach((t) => zeigen(s, t));
  const gemerkt = s.nachfragen.filter((n) => n.art === 'karte_gezeigt');
  check('E16 gemerkt wird nur der Wechsel: ein Eintrag für zwölf Tage', gemerkt.length === 1 && gemerkt[0].am === '2026-09-12', JSON.stringify(gemerkt));
  check('E16 am 12.09. „Der Patientin dazu gezeigt"', dosisBerichtZeilen(s, '2026-09-12').some((z) => /^ {2}Der Patientin dazu gezeigt: /.test(z)));
  for (const heute of ['2026-09-24', '2026-09-30']) {
    const k = zeigen(s, heute);
    const z = dosisBerichtZeilen(s, heute);
    const i = z.findIndex((x) => /^Zuletzt gezeigte Richtung der Dosis-Karte, zuerst angezeigt am 12\.09\.2026, zum Befund vom 08\.09\.2026 \(App\): Das spricht für eine Kontrolle oder einen kleinen Schritt nach oben\./.test(x));
    check(`E16 ${heute}: Karte mit Rückfrage X3-14, der Bericht nennt die zuletzt gezeigte Richtung mit Datum und Pflichttext`,
      k.frage && k.frage.id === 'X3-14' && /Stand /.test(z[0]) && /offene Frage/.test(z[0]) && i > 0 && /^ {2}Der Patientin dazu gezeigt: .*keine Anweisung/.test(z[i + 1] || ''), z.join(' | ').slice(0, 400));
  }
  // So wie app.js heute merkt (ohne Titel): die Richtung in Worten.
  const o = neu();
  zeigen(o, '2026-09-12', false);
  const zo = dosisBerichtZeilen(o, '2026-09-24');
  check('E16 gemerkt ohne Titel: „Richtung „mehr"" in Worten', zo.some((x) => /^Zuletzt gezeigte Richtung .*Richtung „mehr" – eine etwas höhere Dosis\./.test(x)), zo.join(' | ').slice(0, 300));
  // Gegenprobe: Zeigt die Karte heute dieselbe Richtung, steht sie nicht zweimal da.
  check('E16 Gegenprobe: dieselbe Richtung heute – keine zweite Zeile', !dosisBerichtZeilen(s, '2026-09-20').some((x) => /^Zuletzt gezeigte/.test(x)));
  // Eine Frage merkt nichts.
  check('E16 die Rückfrage (X3-14) merkt nichts', dosisRichtung(s, '2026-09-24').merken === null);
  // Der gemerkte Eintrag übersteht Speichern und Laden.
  const geladen = normStand(JSON.parse(JSON.stringify(s)));
  check('E16 nach normStand bleibt der Titel', geladen.nachfragen.some((n) => n.art === 'karte_gezeigt' && n.titel === k12.titel));
});

// E18 – B31-Kette an der Altersgrenze 70: Der Kontrollwert, zu dem „Heute"
// (D6c) schickt, wird auf der Karte nie als „weniger als 8 Wochen" verworfen.
fall('E18', () => {
  const schlecht = [];
  for (let t = '2025-10-15'; t <= '2025-12-31'; t = plus(t, 3)) {
    const s = stand({
      profil: { geburtsjahr: 1956, herz: 'nein' }, befund: { datum: '2025-10-01', tsh: tsh(0.15), ft4: ft4(18), praxis: 'geaendert', praxisAm: '2025-10-05' },
      dosen: [d('d1', '2024-01-01', 100), d('d2', t, 88)], nachfragen: [],
    });
    let n = 30;
    while (n < 90 && !dosisHinweise(s, plus(t, n)).some((h) => h.id === 'D6c')) n++;
    const tag = plus(t, n);
    s.labor.push({ id: 'b2', datum: tag, tsh: tsh(1.8), ft4: ft4(15), ...FRAGEN });
    s.nachfragen.push(ja('b2', plus(tag, 1)));
    const k = dosisRichtung(s, plus(tag, 1));
    if (k.gruende.some((g) => g.id === 'D0.6')) schlecht.push(`${t}: D6c ab Tag ${n}, Karte ${lage(k)}`);
  }
  check('E18 Änderungen Okt.–Dez. 2025 (Jahrgang 1956): der Wert zum Tag von D6c bekommt nie D0.6', schlecht.length === 0, schlecht.slice(0, 3).join(' | '));
});

// E30 – rot-2 X3 (4): Nach einer eigenen Erhöhung (75 → 125 µg) und einem
// Herstellerwechsel zehn Tage später bleibt X3 Tag für Tag stehen, bis die
// Praxis entscheidet oder ein Kontrollwert da ist.
fall('E30', () => {
  const s = stand({
    profil: { geburtsjahr: 1948, herz: 'nein' }, befund: { datum: '2026-01-19', tsh: tshL(6.5), ft4: ft4(14) },
    dosen: [d('d1', '2025-01-01', 75), d('d2', '2026-01-26', 125, { praxis: false }), d('d3', '2026-02-05', 125, { praxis: null, praeparat: 'Euthyrox' })],
    nachfragen: [ja('b1', '2026-01-20')],
  });
  const ohne = tage('2026-01-26', '2026-04-30').filter((t) => {
    const k = dosisRichtung(s, t);
    const g = gesamtbildMitDosis(s, t);
    return !(k.gruende.some((x) => x.id === 'X3' && x.stufe === 'tage') && k.warnzeichen === dosisModul.WD2 && R4[g.stufe] >= R4.tage);
  });
  check('E30 26.01.–30.04.: jeden Tag X3 (Tage) mit W-D2 auf der Karte, Gesamtbild mindestens Tage', ohne.length === 0, ohne.slice(0, 5).join(', '));
  const heuteX3 = tage('2026-01-26', '2026-02-09').filter((t) => !dosisHinweise(s, t).some((h) => h.id === 'X3'));
  check('E30 „Heute" nennt X3 die ersten 14 Tage, auch nach dem Euthyrox-Eintrag', heuteX3.length === 0, heuteX3.join(', '));
  const wd4 = tage('2026-02-09', '2026-02-15').filter((t) => !dosisHinweise(s, t).some((h) => h.id === 'W-D4' && h.frage && h.frage.bezug === 'd2-14'));
  check('E30 die W-D4-Frage nach der Erhöhung kommt an Tag 14–20', wd4.length === 0, wd4.join(', '));
  // Erst ein Kontrollwert nach der Einpendelzeit (8 Wochen) beendet es.
  s.labor.push({ id: 'b2', datum: '2026-03-25', tsh: tshL(2.5), ft4: ft4(16), ...FRAGEN });
  s.nachfragen.push(ja('b2', '2026-03-26'));
  check('E30 Gegenprobe: Kontrollwert 58 Tage nach der Änderung – kein X3 mehr', !dosisRichtung(s, '2026-03-27').gruende.some((x) => x.id === 'X3'), lage(dosisRichtung(s, '2026-03-27')));
});

// E31 – Q5 „einmal viele Tabletten" nach der Entscheidung der Praxis: kein
// tägliches „Heute anrufen – Giftnotruf" bis zum nächsten Befund.
fall('E31', () => {
  const s = stand({
    profil: { geburtsjahr: 1962, herz: 'nein' }, befund: { datum: '2026-09-24', tsh: tsh(0.05), ft4: ft4(30), verwechselt: 'einmal', praxis: 'bleibt', praxisAm: '2026-09-26' },
    nachfragen: [ja('b1', '2026-09-25')],
  });
  const heute = tage('2026-09-26', '2027-01-31').filter((t) => {
    const k = dosisRichtung(s, t);
    return R4[k.stufe] >= R4.heute || R4[gesamtbildMitDosis(s, t).stufe] >= R4.heute || k.gruende.some((g) => /Giftnotruf/.test(g.text));
  });
  check('E31 nach „Die Dosis bleibt so" (26.09.) bis Ende Januar: nie „heute", nie der Giftnotruf', heute.length === 0, heute.slice(0, 5).join(', '));
  const b = dosisBerichtZeilen(s, '2026-12-10').join('\n');
  check('E31 der Bericht nennt Q5 ohne „heute noch den Giftnotruf"', /Grund Q5: Sie hatten angegeben/.test(b) && !/heute noch den Giftnotruf/.test(b), b.slice(0, 300));
  // Gegenprobe: vor der Entscheidung der Praxis bleibt es akut.
  const vor = stand({
    profil: { geburtsjahr: 1962, herz: 'nein' }, befund: { datum: '2026-09-24', tsh: tsh(0.05), ft4: ft4(30), verwechselt: 'einmal' },
    nachfragen: [ja('b1', '2026-09-25')],
  });
  const kv = dosisRichtung(vor, HEUTE);
  check('E31 Gegenprobe ohne Entscheidung: heute mit Giftnotruf', kv.stufe === 'heute' && kv.gruende.some((g) => g.id === 'Q5' && /Giftnotruf/.test(g.text)), lage(kv));
});

// E33 – Was als Änderung zählt, steht an einer Stelle (js/einschaetzung.js):
// Die Dosis-Karte hat keine eigenen Kopien mehr, die auseinanderlaufen können.
fall('E33', () => {
  const quelle = readFileSync(new URL('../schilddruese/js/dosis.js', import.meta.url), 'utf8');
  check('E33 dosis.js hat keine eigenen Kopien von aenderungsArt, istBerichtigung, aenderungen',
    !/function (aenderungsArt|istBerichtigung)\b|const aenderungen\s*=/.test(quelle));
  check('E33 dosis.js importiert sie aus einschaetzung.js',
    /import \{[^}]*\baenderungsArt\b[^}]*\bistBerichtigung\b[^}]*\baenderungen\b[^}]*\} from '\.\/einschaetzung\.js'/.test(quelle));
  // Karte (D0.6) und Einschätzung (L5a) sagen zum selben Stand dasselbe.
  const faelle = {
    doppelt: [d('d1', '2025-01-01', 75), d('d2', '2026-09-14', 75, { praxis: null })],
    berichtigt: [d('d1', '2025-01-01', 75), d('d2', '2026-09-14', 75), d('d3', '2026-09-14', 100, { berichtigung: true })],
    echt: [d('d1', '2025-01-01', 75), d('d2', '2026-09-14', 100)],
    praeparat: [d('d1', '2025-01-01', 75), d('d2', '2026-09-14', 75, { praeparat: 'Euthyrox' })],
  };
  for (const [name, dosen] of Object.entries(faelle)) {
    const s = stand({ profil: { geburtsjahr: 1960, herz: 'nein' }, befund: { datum: '2026-09-24', tsh: tsh(7.5), ft4: ft4(13) }, dosen, nachfragen: [ja('b1', '2026-09-25')] });
    const karte = dosisRichtung(s, HEUTE).gruende.some((g) => g.id === 'D0.6');
    const einsch = ez.befundEinschaetzen(s.labor[0], s, HEUTE).erklaerungen.some((x) => x.id === 'L5a');
    check(`E33 ${name}: Karte (D0.6) und Einschätzung (L5a) stimmen überein`, karte === einsch && karte === ['echt', 'praeparat'].includes(name), `D0.6 ${karte}, L5a ${einsch}`);
  }
});

// ================================================================ Nachprüfung Runde 4
// R4-a – Q5 „einmal" ohne Akutlage (nach der Entscheidung der Praxis, E31)
// bleibt auch auf Karten früher Ausstiege stehen (D7, Check mit 112-Zeichen):
// „Wusste die Praxis das nicht, sagen Sie es ihr" fiel dort weg.
fall('R4-a', () => {
  const s = (ue = {}) => stand({
    profil: { geburtsjahr: 1990, herz: 'nein', schwanger: 'nein', ...(ue.profil || {}) },
    befund: { datum: '2026-09-20', tsh: tsh(0.05), ft4: ft4(30), verwechselt: 'einmal', praxis: 'bleibt', praxisAm: '2026-09-22' },
    nachfragen: [ja('b1', '2026-09-21')], warnzeichen: ue.warnzeichen || [],
  });
  const basis = dosisRichtung(s(), HEUTE);
  check('R4-a Vorbedingung: Q5 ohne Stufe neben D0.5', basis.gruende.some((g) => g.id === 'Q5' && !g.stufe), lage(basis));
  const d7 = dosisRichtung(s({ profil: { schwanger: 'ja' } }), HEUTE);
  check('R4-a Schwangerschaft (D7): Q5 steht weiter auf der Karte', d7.gruende.some((g) => g.id === 'D7') && d7.gruende.some((g) => g.id === 'Q5'), lage(d7));
  const w4 = dosisRichtung(s({ warnzeichen: [{ id: 'w1', datum: HEUTE, uhr: '09:00', ja: ['packung'] }] }), HEUTE);
  check('R4-a Check mit „große Menge" (W4a): Q5 steht weiter auf der Karte', w4.stufe === 'notruf' && w4.gruende.some((g) => g.id === 'Q5'), lage(w4));
});

// ================================================================ Runde 5
/*
 * Die Befunde der fünften Review-Runde zu Bericht und Dosis-Karte (F10, F11,
 * F12, F15, F28), so nachgestellt wie im Nachweis – über viele Tage
 * hintereinander. Jeder Fall scheiterte vor der Korrektur (außer den Gegenproben).
 */
const R5_TAG = '2026-09-28';
const r5Tage = (von, n) => Array.from({ length: n }, (_, i) => plus(von, i));

// F10 – Die Dringlichkeit im Bericht ist an jedem Tag die der Karte, die
// Gesamteinschätzung die von „Heute": Herzklopfen am 26. und 27.09. bei TSH 0,05.
fall('F10', () => {
  const s = stand({
    profil: { geburtsjahr: 1942, herz: 'ja', osteoporose: 'ja' }, befund: { datum: '2026-09-22', tsh: tshL(0.05), ft4: ft4(24.5), praxisAm: '2026-09-23' },
    dosen: [d('d1', '2020-01-01', 125)], nachfragen: [ja('b1', '2026-09-24')],
    befinden: [{ id: 'x1', datum: '2026-09-26', stufe: 'mittel', beschwerden: ['herz'], notiz: '' }, { id: 'x2', datum: '2026-09-27', stufe: 'schlecht', beschwerden: ['herz'], notiz: '' }],
    warnzeichen: [{ id: 'w', datum: R5_TAG, uhr: '09:00', ja: [] }],
  });
  const falsch = r5Tage(R5_TAG, 14).filter((t) => {
    const k = dosisRichtung(s, t);
    const z = dosisBerichtZeilen(s, t).join('\n');
    const g = gesamtbildMitDosis(s, t);
    const gz = typeof dosisModul.gesamtBerichtZeilen === 'function' ? dosisModul.gesamtBerichtZeilen(s, t).join('\n') : '';
    return !z.includes(`Dringlichkeit auf der Karte (App): „${k.kopf.titel}"`) || !gz.includes(`(App, wie auf „Heute"): „${g.kopf.titel}"`);
  });
  check('F10 28.09.–11.10.: Bericht nennt jeden Tag die Dringlichkeit der Karte und die von „Heute"', falsch.length === 0, falsch.join(', '));
  const z = dosisBerichtZeilen(s, R5_TAG).join('\n');
  check('F10 am 28.09.: „Heute anrufen" und der Herzklopfen-Satz stehen im Bericht', /„Heute anrufen"/.test(z) && /Auf der Karte: Sie haben Herzklopfen eingetragen/.test(z), z.slice(0, 300));
});

// F11 – Nach dem TSH-Befund vom 10.06. kommen Monat für Monat Einträge nur
// mit weiteren Werten: Der TSH-Befund bleibt im Bericht, nie „(Befund): .".
fall('F11', () => {
  const labor = [{ id: 'b1', datum: '2026-06-10', tsh: tshL(0.06), ft4: ft4(26), ...FRAGEN, biotin: 'ja', vorAbnahme: 'ja', tabletteUhr: '06:30' }];
  const weitere = [['2026-07-15', { hba1c: { wert: 6.1, einheit: '%', von: null, bis: 5.7 } }], ['2026-08-20', { vitd: { wert: 18, einheit: 'ng/ml', von: 30, bis: 100 } }],
    ['2026-09-18', { b12: { wert: 320, einheit: 'pmol/l', von: 150, bis: 700 } }], ['2026-09-25', { ferritin: { wert: 80, einheit: 'ng/ml', von: 15, bis: 150 } }]];
  const schlecht = [];
  weitere.forEach(([datum, werte], i) => {
    labor.push({ id: `w${i}`, datum, ...werte });
    const s = normStand({ version: 2, profil: PROFIL, dosen: [d('d1', '2021-01-01', 100)], einnahmen: einnahmen(), labor: JSON.parse(JSON.stringify(labor)) });
    const t = ez.berichtZeilen(s, R5_TAG).join('\n');
    if (!/Einordnung \(App\): Muster d/.test(t) || !/Biotin: ja/.test(t) || /\(Befund\): \./.test(t) || !t.includes(`Weitere Werte vom ${datum.slice(8, 10)}.${datum.slice(5, 7)}.2026 (Befund)`)) schlecht.push(datum);
  });
  check('F11 mit jedem weiteren Eintrag: Muster d, Biotin, eine kurze Zeile, nie „(Befund): ."', schlecht.length === 0, schlecht.join(', '));
});

// F12 – Die Angaben stehen mit und ohne P6 gleich da; ohne P6 fehlt nur die Einschätzung.
fall('F12', () => {
  const ue = {
    mittel: ['marcumar', 'amiodaron', 'biotin', 'kalzium'], befund: { datum: '2026-09-22', tsh: tshL(0.04), ft4: ft4(28), biotin: 'ja', vorAbnahme: 'ja', tabletteUhr: '06:30', verwechselt: 'einmal' },
    warnzeichen: [{ id: 'w1', datum: '2026-09-20', uhr: '21:40', ja: ['brust', 'herzrasen'] }],
    befinden: [{ id: 'x', datum: '2026-09-20', stufe: 'schlecht', beschwerden: ['puls'], notiz: '' }],
  };
  const mit = ez.berichtZeilen(stand(ue), R5_TAG);
  const ohne = typeof ez.angabenZeilen === 'function' ? ez.angabenZeilen(stand({ ...ue, profil: { behandelt: false, ursache: '' } }), R5_TAG) : [];
  const angaben = mit.filter((x) => /\(Angabe\)|\(Befund\)/.test(x) && !/^(Profil|Grundlage)|Hirnanhangdrüse/.test(x)).map((x) => x.replace(/ Auswertung \(App\):.*$/, '').replace(/ – (im|über|unter|deutlich|knapp)[^;.]*/g, ''));
  const fehlt = angaben.filter((x) => !ohne.includes(x));
  check('F12 jede Angabe aus dem Abschnitt mit P6 steht auch ohne P6 da', angaben.length >= 6 && fehlt.length === 0, `${angaben.length} Angaben, fehlt: ${fehlt.join(' | ').slice(0, 300)}`);
  check('F12 ohne P6 keine Zeile mit „(App)"', ohne.length > 0 && !ohne.some((x) => /\(App\)/.test(x)), ohne.filter((x) => /\(App\)/.test(x)).join(' | '));
});

// F15 – Doppelter Eintrag vom Einrichten (75 µg ab 2019 und ab 01.09.2026):
// Die Grundlage der Karte nennt an jedem Tag „seit 01.03.2019".
fall('F15', () => {
  const s = stand({
    befund: { datum: '2026-09-15', tsh: tshL(5.8), ft4: ft4(12.6) }, nachfragen: [ja('b1', '2026-09-16')],
    dosen: [d('d1', '2019-03-01', 75), d('d2', '2026-09-01', 75, { praxis: null })],
  });
  const falsch = r5Tage('2026-09-16', 30).filter((t) => !dosisRichtung(s, t).grundlage.includes('75 µg am Tag seit 01.03.2019'));
  check('F15 16.09.–15.10.: Grundlage „75 µg am Tag seit 01.03.2019"', falsch.length === 0, falsch.slice(0, 3).join(', '));
});

// F28 – Dosis 75 → 100 µg am 14.09. mit einer Kennung aus 40 Zeichen: Die
// W-D4-Frage erscheint an Tag 14, wird beantwortet (wie app.js: Bezug auf 40
// Zeichen) und kommt danach – auch nach dem Laden – nicht wieder.
fall('F28', () => {
  const id = 'A'.repeat(40);
  let s = stand({ befund: { datum: '2026-09-01', tsh: tsh(6) }, dosen: [d('d1', '2020-01-01', 75), d(id, '2026-09-14', 100)], nachfragen: [ja('b1', '2026-09-02')] });
  const vorher = r5Tage('2026-09-14', 14).filter((t) => dosisHinweise(s, t).some((h) => h.id === 'W-D4' && h.frage));
  check('F28 vor Tag 14 keine W-D4-Frage', vorher.length === 0, vorher.join(', '));
  const f = dosisHinweise(s, R5_TAG).find((h) => h.id === 'W-D4' && h.frage);
  check('F28 Tag 14 (28.09.): die W-D4-Frage steht da', !!f);
  if (!f) return;
  s.nachfragen.push({ id: 'a', art: 'wd4', bezug: String(f.frage.bezug).slice(0, 40), antwort: 'nein', am: R5_TAG });
  s = normStand(JSON.parse(JSON.stringify(s)));
  const noch = r5Tage(R5_TAG, 7).filter((t) => dosisHinweise(s, t).some((h) => h.id === 'W-D4' && h.frage && h.frage.bezug === f.frage.bezug));
  check('F28 nach der Antwort und dem Laden: die Frage kommt an Tag 14–20 nicht wieder', noch.length === 0, noch.join(', '));
});

// ================================================================ Nachprüfung Runde 5
// R5-a – zwei Einträge eines Tages (nur TSH, nur fT4) werden auch dann
// zusammengeführt, wenn ihre Notizen zusammen über der Grenze liegen: Sonst
// rechnete die App nur mit dem TSH und nannte eine niedrigere Frist.
fall('R5-a', () => {
  const roh = {
    version: 2, profil: { ...PROFIL }, dosen: [{ id: 'd1', ab: '2021-01-01', praeparat: 'L-Thyroxin', mikrogramm: 100, tabletten: 1, praxis: true }],
    labor: [
      { id: 'b1', datum: '2026-09-22', tsh: tsh(0.2), ...FRAGEN, notiz: 'A'.repeat(900) },
      { id: 'b2', datum: '2026-09-22', ft4: ft4(26), ...FRAGEN, notiz: 'B'.repeat(200) },
    ],
  };
  const s = normStand(roh);
  const b = s.labor[0];
  check('R5-a ein Eintrag mit TSH und fT4', s.labor.length === 1 && b.tsh && b.ft4, `${s.labor.length} Einträge`);
  check('R5-a Notiz sichtbar gekürzt, innerhalb der Grenze', b.notiz.includes('[…]') && Array.from(b.notiz).length <= 1000, `${Array.from(b.notiz).length} Zeichen`);
  const kurz = normStand({ ...roh, labor: roh.labor.map((l) => ({ ...l, notiz: 'x' })) });
  check('R5-a Gegenprobe kurze Notizen: gleiche Stufe', gesamtbildMitDosis(s, HEUTE).stufe === gesamtbildMitDosis(kurz, HEUTE).stufe,
    `${gesamtbildMitDosis(s, HEUTE).stufe} / ${gesamtbildMitDosis(kurz, HEUTE).stufe}`);
});

// ================================================================ Runde 6
/*
 * Die Befunde der sechsten Review-Runde zur Dosis-Karte und zu „Heute"
 * (G10, G11, G12), so nachgestellt wie im Nachweis. Jeder Fall scheiterte
 * vor der Korrektur, außer den Gegenproben.
 */
const { berichtText } = await import('../schilddruese/js/bericht.js');
const R6_NEIN = { ...FRAGEN, abnahmeUhr: '', tabletteUhr: '', laborName: '', bestaetigt: false, notiz: '' };
const r6Einnahmen = (bis) => {
  const e = {};
  for (let t = '2026-05-01'; t <= bis; t = plus(t, 1)) e[t] = { uhr: '07:00' };
  return e;
};

// G11 – Die Praxis ordnet 100 µg an (F8 „geändert", eingetragen „auf Anweisung
// der Praxis: Ja"), die Nutzerin nimmt aber weiter 75 µg. Beim nächsten Befund
// „Nein, ich nehme etwas anderes" → 75 µg eingetragen. Die Karte bat, „Gilt ab"
// auf den Tag zu setzen, seit dem sie es nimmt („seit 2024") – das rückte die
// Berichtigung vor die 100 µg, und die galten wieder, auch im Arztbericht.
fall('G11', () => {
  const H6 = '2026-08-12';
  const roh = (abB) => ({
    version: 2,
    profil: { ...PROFIL, seit: '2024-05-14', geburtsjahr: 1950, herz: 'nein' },
    dosen: [
      { id: 'd1', ab: '2024-05-14', praeparat: 'L-Thyroxin', mikrogramm: 75, tabletten: 1, praxis: null },
      { id: 'dC', ab: '2026-06-04', praeparat: 'L-Thyroxin', mikrogramm: 100, tabletten: 1, praxis: true },
      { id: 'dB', ab: abB, praeparat: 'L-Thyroxin', mikrogramm: 75, tabletten: 1, praxis: false, berichtigung: true },
    ],
    einnahmen: r6Einnahmen(H6),
    labor: [
      { id: 'bA', datum: '2026-05-13', tsh: tsh(25), ...R6_NEIN, praxis: 'geaendert', praxisAm: '2026-06-04' },
      { id: 'bB', datum: '2026-08-10', tsh: tsh(6.5), ...R6_NEIN, praxis: 'nochnicht', praxisAm: '2026-08-12' },
    ],
    nachfragen: [{ id: 'n0', art: 'dosis_stimmt', bezug: 'bA', antwort: 'ja', am: '2026-05-14' }],
  });
  const k = dosisRichtung(normStand(roh(H6)), H6);
  const d05 = (k.gruende.find((g) => g.id === 'D0.5') || {}).text || '';
  check('G11 die Karte nennt den frühesten Tag: „nicht vor dem 04.06.2026" (sonst gälten die 100 µg wieder)', /nicht vor dem 04\.06\.2026/.test(d05) && /100 µg am Tag eingetragen/.test(d05), d05);
  check('G11 … und für „nie genommen" genau diesen Tag, mit dem Hinweis an die Praxis', /nie genommen, wählen Sie bei „Gilt ab" genau den 04\.06\.2026/.test(d05) && /angeordnete Menge nicht genommen/.test(d05), d05);
  // Dem Rat der Karte folgen, wie das Dosis-Formular es speichert (Gilt ab
  // ändern, stabil nach Datum sortieren). Nennt die Karte keinen Tag (vorher),
  // folgt die Nutzerin „seit der Blutabnahme oder länger": seit 2024.
  const m = /genau den (\d\d)\.(\d\d)\.(\d{4})/.exec(d05);
  const neuAb = m ? `${m[3]}-${m[2]}-${m[1]}` : '2024-05-14';
  const r = roh(neuAb);
  r.dosen.sort((a, b) => a.ab.localeCompare(b.ab));
  const s = normStand(r);
  const k2 = dosisRichtung(s, H6);
  const bericht = berichtText(s, H6);
  check('G11 nach dem Rat: die Karte fragt nicht wieder nach den nie genommenen 100 µg', !(k2.frage && /100 µg/.test(k2.frage.text)) && /Ihre Dosis laut App: 75 µg am Tag/.test(k2.grundlage),
    `${k2.frage ? k2.frage.text : k2.titel} | ${k2.grundlage.replace(/^.*?\. Ihre/, 'Ihre').slice(0, 80)}`);
  check('G11 nach dem Rat: der Arztbericht nennt 75 µg als aktuelle Dosis und „Dosis damals 75 µg"', /Aktuell: L-Thyroxin 75 µg/.test(bericht) && !/Aktuell: L-Thyroxin 100 µg/.test(bericht)
    && /10\.08\.2026: TSH 6,5 mU\/l[^\n]*Dosis damals 75 µg/.test(bericht), bericht.split('\n').filter((z) => /Aktuell|Dosis damals/.test(z)).join(' | '));
  // Ersetzt die Berichtigung den Eintrag schon am selben Tag (beide nach der
  // Blutabnahme), gibt es an „Gilt ab" nichts mehr zu ändern.
  const r3 = roh('2026-08-11');
  r3.dosen[1].ab = '2026-08-11';
  const k3 = dosisRichtung(normStand(r3), H6);
  const t3 = (k3.gruende.find((g) => g.id === 'D0.5') || {}).text || '';
  check('G11 schon am selben Tag ersetzt: kein Rat, „Gilt ab" zu ändern, kein Knopf „Dosis ändern", Hinweis an die Praxis',
    !!t3 && !/Gilt ab/.test(t3) && !k3.aktionen.some((a) => a.aktion === 'dosis') && /sagen Sie der Praxis, was Sie wirklich nehmen/.test(t3), `${t3} | ${JSON.stringify(k3.aktionen)}`);
  // Ist der berichtigte Eintrag der erste (beim Einrichten 100 µg statt 75 µg
  // eingetragen), bleibt „seit der Blutabnahme oder länger" – mit seinem Beginn als frühestem Tag.
  const r4 = roh(H6);
  r4.dosen = [{ ...r4.dosen[0], mikrogramm: 100 }, r4.dosen[2]];
  const t4 = (dosisRichtung(normStand(r4), H6).gruende.find((g) => g.id === 'D0.5') || {}).text || '';
  check('G11 berichtigter Eintrag vom Einrichten: „seit der Blutabnahme oder länger", aber nicht vor seinem Beginn',
    /seit der Blutabnahme am 10\.08\.2026 oder länger/.test(t4) && /nicht vor dem 14\.05\.2024/.test(t4), t4);
});

// G12 – „Ja" auf die Nachfrage nach der Erhöhung (Tag 14), am nächsten Tag
// selbst wieder weniger eingetragen: „Heute anrufen", der Warnzeichen-Check
// und die Zeile im Arztbericht bleiben; nie zurück zur Menge mit den Beschwerden.
fall('G12', () => {
  const H6 = '2026-09-16';
  const s = (eigen) => normStand({
    version: 2,
    profil: { ...PROFIL, geburtsjahr: 1950, herz: 'nein' },
    dosen: [
      { id: 'd0', ab: '2025-01-01', praeparat: 'L-Thyroxin', mikrogramm: 75, tabletten: 1, praxis: null },
      { id: 'd1', ab: '2026-09-01', praeparat: 'L-Thyroxin', mikrogramm: 100, tabletten: 1, praxis: true },
      ...(eigen ? [{ id: 'd2', ab: H6, praeparat: 'L-Thyroxin', mikrogramm: eigen, tabletten: 1, praxis: false }] : []),
    ],
    einnahmen: r6Einnahmen(H6),
    labor: [{ id: 'b1', datum: '2026-08-20', tsh: tsh(6.8), ...R6_NEIN, praxis: 'geaendert', praxisAm: '2026-08-28' }],
    nachfragen: [{ id: 'n1', art: 'dosis_stimmt', bezug: 'b1', antwort: 'ja', am: '2026-08-21' }, { id: 'n2', art: 'wd4', bezug: 'd1-14', antwort: 'ja', am: '2026-09-15' }],
  });
  for (const eigen of [88, 50]) {
    const st = s(eigen);
    const g = gesamtbildMitDosis(st, H6);
    const w = g.dosisHinweise.find((h) => h.id === 'W-D4');
    check(`G12 selbst auf ${eigen} µg: „Heute" bleibt bei „Heute anrufen" mit dem Warnzeichen-Check`, g.stufe === 'heute' && !!w && w.stufe === 'heute' && /Warnzeichen-Check/.test(w.text),
      `${g.stufe} | ${g.dosisHinweise.map((h) => `${h.id}/${h.stufe}`).join(', ')}`);
    const z = [...dosisBerichtZeilen(st, H6), ...dosisModul.gesamtBerichtZeilen(st, H6)].join('\n');
    // Geändert in Runde 7 (H23): Die Gesamteinschätzung nennt ihre Herkunft in
    // Worten („Beschwerden seit der Dosisänderung"), nicht als Kennung „W-D4".
    check(`G12 selbst auf ${eigen} µg: der Bericht nennt „Heute anrufen" und die Beschwerden seit der Erhöhung`, /„Heute anrufen" – aus [^\n]*Beschwerden seit der Dosisänderung/.test(z) && /Grund W-D4: [^\n]*seit der Erhöhung/.test(z), z.slice(0, 400));
    const texte = [alleTexte(dosisRichtung(st, H6)), ...g.dosisHinweise.map((h) => h.text)].join(' ');
    check(`G12 selbst auf ${eigen} µg: kein „wieder Ihre bisherige Menge" (die 100 µg mit den Beschwerden)`, !/bisherige Menge/.test(texte), texte.slice(0, 300));
  }
});

// G10 – wie Fall 1 (Berichtigung), mit „Auf Anweisung der Praxis: Nein": Frist und Stufe passen zusammen.
fall('G10', () => {
  const mitPraxis = (praxis) => stand({
    befund: { tsh: tsh(6.5) },
    dosen: [
      { id: 'd1', ab: '2025-01-01', praeparat: 'L-Thyroxin', mikrogramm: 75, tabletten: 1 },
      { id: 'd2', ab: HEUTE, praeparat: 'L-Thyroxin', mikrogramm: 100, tabletten: 1, praxis, berichtigung: true },
    ],
    nachfragen: [],
  });
  const nein = mitPraxis(false);
  const h = dosisHinweise(nein, HEUTE).find((x) => x.id === 'X3b');
  check('G10 „Nein": X3b mit Stufe Tage, der Text nennt dieselbe Frist ohne Bedingung', !!h && h.stufe === 'tage' && /in den nächsten Tagen/.test(h.text) && !/Ist das nicht/.test(h.text), JSON.stringify(h));
  check('G10 „Nein": Einschätzung auf „Heute" und Dosis-Karte in den nächsten Tagen', gesamtbildMitDosis(nein, HEUTE).stufe === 'tage' && dosisRichtung(nein, HEUTE).stufe === 'tage',
    `${gesamtbildMitDosis(nein, HEUTE).stufe} / ${dosisRichtung(nein, HEUTE).stufe}`);
  const ja = dosisHinweise(mitPraxis(true), HEUTE).find((x) => x.id === 'X3b');
  check('G10 „Ja": X3b beim nächsten Termin, ohne „in den nächsten Tagen" und ohne die schon beantwortete Frage',
    !!ja && ja.stufe === 'termin' && !/in den nächsten Tagen|Ist das nicht die Menge/.test(ja.text), JSON.stringify(ja));
});

// ================================================================ Runde 6 – Rest
/*
 * Die offenen Punkte nach der Nachprüfung der Runde 6, so nachgestellt wie in
 * den Nachweisen (review6/nach-p61-*.mjs, rot4w/acht.mjs, rot4w/ersetzt.mjs):
 * Stellen, die noch jeden Dosis-Eintrag als Änderung zählten (G14, G15, G11),
 * die W-D4-Antwort aus dem heutigen Datenstand gedeutet, und X3b ab „Gilt ab".
 * Jeder Fall scheiterte vor der Korrektur, außer den Gegenproben.
 */
const R6R_D = (id, ab, mikrogramm, weiteres = {}) => ({ id, ab, praeparat: 'L-Thyroxin', mikrogramm, tabletten: 1, notiz: '', praxis: null, ...weiteres });

// G14-Rest (rot4w/acht.mjs): TSH 6,2 über dem Bereich, jetzt 0,25 darunter,
// dazwischen nur ein doppelter Eintrag. D0.17 fehlte, die Karte hätte ohne die
// Komma-Rückfrage (bestätigt) „weniger" gesagt.
fall('G14-Rest', () => {
  const H = '2026-09-28';
  const s = (dosen) => normStand({
    version: 2,
    profil: { ...PROFIL, geburtsjahr: 1966, herz: 'nein' },
    dosen,
    einnahmen: r6Einnahmen(H),
    labor: [
      { id: 'b1', datum: '2026-03-02', tsh: tsh(6.2), ...R6_NEIN, praxis: 'nochnicht', praxisAm: '2026-03-05' },
      { id: 'b2', datum: '2026-09-22', tsh: tsh(0.25), ...R6_NEIN, bestaetigt: true, praxisAm: '2026-09-23' },
    ],
    nachfragen: [{ id: 'n1', art: 'dosis_stimmt', bezug: 'b2', antwort: 'ja', am: '2026-09-23' }],
  });
  const d0 = R6R_D('d0', '2024-01-01', 100);
  const k = dosisRichtung(s([d0, R6R_D('d1', '2026-05-04', 100, { praxis: true })]), H);
  check('G14-Rest doppelter Eintrag: D0.17 („bei gleicher Dosis auf der anderen Seite"), keine Richtung',
    k.richtung === 'klaeren' && k.gruende.some((g) => g.id === 'D0.17'), `${k.richtung}/${k.stufe} ${k.gruende.map((g) => g.id)}`);
  const p = dosisRichtung(s([d0, R6R_D('d1', '2026-05-04', 100, { praeparat: 'Euthyrox', praxis: true })]), H);
  check('G14-Rest Gegenprobe Präparatwechsel: eine Änderung (RW2 D0.17) – kein D0.17', !p.gruende.some((g) => g.id === 'D0.17'), `${p.richtung} ${p.gruende.map((g) => g.id)}`);
});

// G15-Rest (review6/nach-p61-g15-rest.mjs, rot4w/ersetzt.mjs): 75 µg seit
// 2025; 100 µg ab 01.06. (angeordnet, nie genommen), am selben Tag berichtigt
// auf 75 µg. vorUeber fiel weg (mehr/zeitnah → mehr/termin), D2d zählte die
// 100 µg als zweite Erhöhung („schon mehrfach erhöht").
fall('G15-Rest', () => {
  const roh = (dosen, t1, t2) => normStand({
    version: 2,
    profil: { ...PROFIL, geburtsjahr: 1966, herz: 'nein' },
    dosen,
    einnahmen: r6Einnahmen('2026-09-05'),
    labor: [
      { id: 'b1', datum: '2026-05-10', tsh: tsh(t1), ...R6_NEIN, praxis: 'geaendert', praxisAm: '2026-05-28' },
      { id: 'b2', datum: '2026-08-20', tsh: tsh(t2), ...R6_NEIN, praxis: 'nochnicht', praxisAm: '2026-08-21' },
    ],
    nachfragen: [{ id: 'n1', art: 'dosis_stimmt', bezug: 'b1', antwort: 'ja', am: '2026-05-11' }, { id: 'n2', art: 'dosis_stimmt', bezug: 'b2', antwort: 'ja', am: '2026-08-23' }],
  });
  const D0 = R6R_D('d0', '2025-01-01', 75);
  const ersetzt = [R6R_D('dC', '2026-06-01', 100, { praxis: true }), R6R_D('dB', '2026-06-01', 75, { praxis: false, berichtigung: true })];
  // Nach den 14 Tagen von X3b (die Berichtigung kam frühestens mit dem Befund vom 20.08.).
  const H = '2026-09-05';
  const wahr = dosisRichtung(roh([D0], 5.5, 5.8), H);
  const k = dosisRichtung(roh([D0, ...ersetzt], 5.5, 5.8), H);
  check('G15-Rest vorUeber: mit dem ersetzten Eintrag dieselbe Karte wie ohne – mehr, zeitnah, „Zweimal erhöht"',
    k.richtung === 'mehr' && k.stufe === 'zeitnah' && wahr.stufe === 'zeitnah' && /Zweimal erhöht/.test(alleTexte(k)), `${wahr.richtung}/${wahr.stufe} | ${k.richtung}/${k.stufe} ${k.gruende.map((g) => g.id)}`);
  const D00 = R6R_D('d00', '2025-06-01', 50);
  const D0b = { ...D0, ab: '2025-12-01', praxis: true };
  const d2d = dosisRichtung(roh([D00, D0b, ...ersetzt], 9, 9.5), H);
  check('G15-Rest D2d: kein „schon mehrfach erhöht" wegen des ersetzten Eintrags', !/mehrfach erhöht/.test(alleTexte(d2d)) && d2d.regeln.includes('D2c'), `${d2d.richtung}/${d2d.stufe} ${d2d.regeln}`);
  // Am Tag des Nachweises (25.08.): Die Berichtigung ist erst Tage alt – die
  // Karte liegt nicht unter der Wahrheit, sondern nennt X3b (siehe unten).
  const n = dosisRichtung(roh([D0, ...ersetzt], 5.5, 5.8), '2026-08-25');
  check('G15-Rest am 25.08.: nicht unter „zeitnah" – X3b „in den nächsten Tagen" (Berichtigung frühestens am 20.08.)',
    n.stufe === 'tage' && n.gruende.some((g) => g.id === 'X3b'), `${n.richtung}/${n.stufe} ${n.gruende.map((g) => g.id)}`);
});

// G11-Rest (review6/nach-p61-g11-hinweise.mjs): Berichtigung mit „statt" auf
// den wahren Beginn gerückt; die nie genommenen 100 µg (ab 29.07.) waren
// trotzdem die jüngste Änderung – W-D4-Frage „seit Ihre Dosis erhöht wurde"
// und INR zu einer Erhöhung, die es nie gab.
const R6R_G11 = (weiteres = {}) => normStand({
  version: 2,
  profil: { ...PROFIL, seit: '2024-05-14', geburtsjahr: 1950, herz: 'nein' },
  mittel: weiteres.mittel || [],
  // Wie das Dosis-Formular: die Berichtigung zuletzt angefügt, dann stabil nach „Gilt ab" sortiert.
  dosen: [R6R_D('d1', '2024-05-14', 75), R6R_D('dC', weiteres.dC || '2026-06-04', 100, { praxis: true }),
    R6R_D('dB', weiteres.ab || '2024-05-14', 75, { praxis: false, berichtigung: true, ...(weiteres.statt === false ? {} : { statt: 'dC' }) })].sort((a, b) => a.ab.localeCompare(b.ab)),
  einnahmen: r6Einnahmen('2026-08-19'),
  labor: [
    { id: 'bA', datum: '2026-05-13', tsh: tsh(25), ...R6_NEIN, praxis: 'geaendert', praxisAm: weiteres.dC || '2026-06-04' },
    { id: 'bB', datum: '2026-08-10', tsh: tsh(6.5), ...R6_NEIN, praxis: 'nochnicht', praxisAm: '2026-08-12' },
  ],
  nachfragen: weiteres.nachfragen || [{ id: 'n0', art: 'dosis_stimmt', bezug: 'bA', antwort: 'ja', am: '2026-05-14' }, { id: 'n2', art: 'dosis_stimmt', bezug: 'bB', antwort: 'ja', am: '2026-08-12' }],
});
fall('G11-Rest', () => {
  const s = R6R_G11({ dC: '2026-07-29', mittel: ['marcumar'] });
  const h = dosisHinweise(s, '2026-08-12');
  check('G11-Rest Tag 14 nach den nie genommenen 100 µg: keine W-D4-Frage „seit Ihre Dosis erhöht wurde"', !h.some((x) => x.id === 'W-D4'), h.map((x) => x.id).join(','));
  check('G11-Rest mit Marcumar: kein INR wegen einer Änderung, die es nie gab (WW1)', !h.some((x) => x.id === 'WW1'), h.map((x) => `${x.id}: ${x.text.slice(0, 60)}`).join(' | '));
  const k = dosisRichtung(s, '2026-08-12');
  check('G11-Rest Grundlage: 75 µg seit dem wahren Beginn', /Ihre Dosis laut App: 75 µg am Tag seit 14\.05\.2024/.test(k.grundlage), k.grundlage.slice(-150));
});

// W-D4-Art (review6/nach-p61-wd4-art.mjs): „Ja" auf die Tag-14-Frage (immer
// die nach einer Erhöhung). Danach ein Eintrag davor nachgetragen (selbst
// 125 µg) oder die Stärke von 2025 berichtigt – Karte und Arztbericht sagten
// „müder seit der Senkung", die Stufe fiel von heute auf Termin.
fall('W-D4-Art', () => {
  const H = '2026-09-16';
  const s = (dosen, antwort = {}) => normStand({
    version: 2,
    profil: { ...PROFIL, geburtsjahr: 1950, herz: 'nein' },
    dosen,
    einnahmen: r6Einnahmen(H),
    labor: [{ id: 'b1', datum: '2026-08-20', tsh: tsh(6.8), ...R6_NEIN, praxis: 'geaendert', praxisAm: '2026-08-28' }],
    nachfragen: [{ id: 'n1', art: 'dosis_stimmt', bezug: 'b1', antwort: 'ja', am: '2026-08-21' }, { id: 'n2', art: 'wd4', bezug: 'd1-14', antwort: 'ja', am: '2026-09-15', ...antwort }],
  });
  const d0 = R6R_D('d0', '2025-01-01', 75);
  const d1 = R6R_D('d1', '2026-09-01', 100, { praxis: true });
  for (const [was, dosen] of [
    ['nachgetragen: selbst 125 µg ab 20.08.', [d0, R6R_D('dX', '2026-08-20', 125, { praxis: false }), d1]],
    ['Stärke von 2025 berichtigt 75 → 125', [{ ...d0, mikrogramm: 125 }, d1]],
  ]) {
    const st = s(dosen);
    const k = dosisRichtung(st, H);
    const g = gesamtbildMitDosis(st, H);
    const b = berichtText(st, H);
    check(`W-D4-Art ${was}: Karte und „Heute" – heute anrufen, „seit der Erhöhung"`,
      k.stufe === 'heute' && g.stufe === 'heute' && k.gruende.some((x) => x.id === 'W-D4' && /seit der Erhöhung/.test(x.text)) && !/seit der Senkung/.test(alleTexte(k)),
      `${k.stufe}/${g.stufe} ${k.gruende.map((x) => `${x.id}: ${x.text.slice(0, 60)}`).join(' | ')}`);
    check(`W-D4-Art ${was}: der Arztbericht nennt die Nachfrage nach der Erhöhung, nicht „müder seit der Senkung"`,
      /Nachfrage 14 Tage nach der Erhöhung vom 01\.09\.2026[^\n]*Brust seit der Erhöhung: ja/.test(b) && !/seit der Senkung/.test(b),
      b.split('\n').filter((z) => /Nachfrage|W-D4/.test(z)).join(' | ').slice(0, 300));
  }
  // rot4w/mono.mjs Seed 5056: eine ältere Antwort nach 28 Tagen (ohne
  // gespeicherte Art) zu 137 → 150 µg; danach „selbst +25 µg ab heute"
  // eingetragen. Ein Eintrag ab dem Antworttag war nicht die Menge vor der
  // Frage – vorher las die App daraus eine Senkung, heute → Termin.
  const HM = '2026-09-28';
  const mono = (eigen) => normStand({
    version: 2,
    profil: { ...PROFIL, geburtsjahr: 1966, herz: 'ja' },
    dosen: [R6R_D('a', '2023-02-28', 137), R6R_D('b', '2026-10-08', 150, { praxis: true }), ...(eigen ? [R6R_D('c', HM, 162, { praxis: false })] : [])].sort((x, y) => x.ab.localeCompare(y.ab)),
    einnahmen: r6Einnahmen(HM),
    labor: [{ id: 'l1', datum: '2026-07-05', tsh: tsh(4.6), ...R6_NEIN, praxis: 'nochnicht', praxisAm: '2026-07-06' }],
    nachfragen: [{ id: 'n1', art: 'dosis_stimmt', bezug: 'l1', antwort: 'ja', am: '2026-07-31' }, { id: 'n2', art: 'wd4', bezug: 'b-28', antwort: 'ja', am: HM }],
  });
  const w5056 = (st) => (dosisHinweise(st, HM).find((x) => x.id === 'W-D4' && !x.frage) || {}).stufe;
  check('W-D4-Art Seed 5056: „selbst +25 µg ab heute" macht aus der Erhöhung keine Senkung (heute bleibt)', w5056(mono(false)) === 'heute' && w5056(mono(true)) === 'heute',
    `${w5056(mono(false))} → ${w5056(mono(true))}`);
  // Die gespeicherte Art bleibt beim Laden erhalten (normStand) – nur bei W-D4.
  const n = s([d0, d1], { aenderung: 'erhoehung' }).nachfragen;
  check('W-D4-Art normStand behält die Art der Antwort', n.find((x) => x.art === 'wd4').aenderung === 'erhoehung' && !('aenderung' in n.find((x) => x.art === 'dosis_stimmt')), JSON.stringify(n));
  const fremd = normStand({ version: 2, nachfragen: [{ id: 'a', art: 'dosis_stimmt', bezug: 'b1', antwort: 'ja', am: H, aenderung: 'erhoehung' }, { id: 'b', art: 'wd4', bezug: 'd1-28', antwort: 'ja', am: H, aenderung: 'irgendwas' }] }).nachfragen;
  check('W-D4-Art normStand: keine Art an anderen Antworten, keine unbekannte Art', fremd.every((x) => !('aenderung' in x)), JSON.stringify(fremd));
});

// X3b nach G11 (review6/nach-p61-g11-hinweise.mjs, nach-p61-g11-selbertag.mjs):
// „Gilt ab" der Berichtigung auf den wahren Beginn (oder auf den Tag der
// ersetzten 100 µg) – X3b „bitte in den nächsten Tagen anrufen und sagen, was
// Sie nehmen" verschwand sofort, weil es an 14 Tagen nach „Gilt ab" hing.
fall('X3b nach G11', () => {
  const x3b = (s, h) => dosisHinweise(s, h).find((x) => x.id === 'X3b');
  const s = R6R_G11();
  for (const h of ['2026-08-12', '2026-08-20']) {
    const k = dosisRichtung(s, h);
    check(`X3b nach G11 „Gilt ab" 2024, ${h}: X3b mit Stufe Tage, auf „Heute" und der Karte`, !!x3b(s, h) && x3b(s, h).stufe === 'tage' && k.stufe === 'tage' && k.gruende.some((g) => g.id === 'X3b'),
      `${JSON.stringify(x3b(s, h))} | ${k.stufe} ${k.gruende.map((g) => g.id)}`);
  }
  check('X3b nach G11 „Gilt ab" 2024: nach den 14 Tagen (01.09.) nicht mehr', !x3b(s, '2026-09-01'));
  // Alte Berichtigung ohne Vermerk, „Gilt ab" genau auf den Tag der 100 µg (nach-p61-g11-selbertag.mjs).
  const selb = R6R_G11({ ab: '2026-06-04', statt: false, nachfragen: [{ id: 'n0', art: 'dosis_stimmt', bezug: 'bA', antwort: 'ja', am: '2026-05-14' }] });
  check('X3b nach G11 selber Tag wie die ersetzten 100 µg (ohne Vermerk): X3b am 14.08.', !!x3b(selb, '2026-08-14') && x3b(selb, '2026-08-14').stufe === 'tage',
    dosisHinweise(selb, '2026-08-14').map((x) => x.id).join(','));
  // Mit dem Tag der Berichtigung aus dem Formular: genau 14 Tage ab ihm.
  const mitTag = normStand({ ...JSON.parse(JSON.stringify(s)), dosen: s.dosen.map((d) => (d.id === 'dB' ? { ...d, berichtigtAm: '2026-08-12' } : d)) });
  check('X3b nach G11 mit gespeichertem Tag (12.08.): bis 26.08., am 27.08. nicht mehr', !!x3b(mitTag, '2026-08-26') && !x3b(mitTag, '2026-08-27'));
  check('X3b nach G11 normStand behält den Tag nur bei einer Berichtigung',
    normStand({ version: 2, dosen: [R6R_D('a', '2025-01-01', 75, { berichtigtAm: '2026-01-01' }), R6R_D('b', '2026-01-01', 50, { berichtigung: true, berichtigtAm: '2026-01-05' }), R6R_D('c', '2026-02-01', 50, { berichtigung: true, berichtigtAm: 'gestern' })] })
      .dosen.map((d) => d.berichtigtAm || '-').join(',') === '-,2026-01-05,-');
});

// ================================================================ Runde 7
/*
 * Die Befunde der siebten Review-Runde zu Dosis-Karte, „Heute" und
 * Gesamteinschätzung (H3, H8, H9, H10, H12, H13, H16, H17, H23), so
 * nachgestellt wie in den Nachweisen (review7/verify-*.mjs, rot5w/…). Jeder
 * Fall scheiterte vor der Korrektur, außer den Gegenproben.
 */
const R7_FR = { ...R6_NEIN, praxis: 'nochnicht', praxisAm: null };
const R7_P = (weiteres = {}) => ({ ...PROFIL, seit: '2025-01-01', geburtsjahr: 1950, herz: 'nein', ...weiteres });
const r7Stand = ({ profil = {}, dosen, labor = [], nachfragen = [], befinden = [], warnzeichen = [], mittel = [], bis = '2026-10-31' }) => normStand({
  version: 2, profil: R7_P(profil), mittel, dosen, einnahmen: r6Einnahmen(bis), labor, befinden, warnzeichen, nachfragen,
});
const r7Befund = (id, datum, wert, weiteres = {}) => ({ id, datum, tsh: tsh(wert), ft4: null, ...R7_FR, ...weiteres });
const rang7 = (s) => ({ keine: 0, termin: 1, zeitnah: 2, tage: 3, heute: 4, notruf: 5 }[s] ?? -1);
// H8: der Tag des Eintrags, wie das Dosis-Formular ihn vermerkt – nach normStand gesetzt.
const r7Eingetragen = (s, id, am) => { s.dosen.find((x) => x.id === id).eingetragenAm = am; return s; };
const r7Lage = (s, tag) => {
  const g = gesamtbildMitDosis(s, tag);
  const k = g.dosis;
  return `Gesamtbild ${g.stufe} | Heute [${g.dosisHinweise.map((h) => `${h.id}/${h.stufe}`)}] | Karte ${k ? `${k.stufe} [${k.gruende.map((x) => `${x.id}/${x.stufe}`)}]` : '-'}`;
};

// H8 (rot5w/v/e-eigen.mjs, S/w/p-spaet.mjs, S/w/p-gleichtag.mjs; verify-rotes-team-0-1.mjs):
// Die eigene Änderung war „bekannt seit Gilt ab". Eine Angabe der Praxis von
// vor dem Eintrag galt als Entscheidung danach, und ein spät eingetragener
// Beginn verkürzte oder strich die 14 Tage auf „Heute".
fall('H8', () => {
  const H = '2026-09-28';
  // (b) TSH 0,06 vom 18.09., F8 „Dosis bleibt so" am 23.09.; am 28.09. eingetragen: seit 20.09. selbst 112 → 150 µg.
  const b = r7Eingetragen(r7Stand({
    dosen: [R6R_D('d1', '2025-01-01', 112), R6R_D('e1', '2026-09-20', 150, { praxis: false })],
    labor: [r7Befund('b1', '2026-09-18', 0.06, { praxis: 'bleibt', praxisAm: '2026-09-23' })],
    nachfragen: [{ id: 'n1', art: 'dosis_stimmt', bezug: 'b1', antwort: 'ja', am: '2026-09-19' }],
  }), 'e1', H);
  const gb = gesamtbildMitDosis(b, H);
  check('H8 (b) „bleibt" am 23.09., eigene Erhöhung am 28.09. eingetragen: Karte, „Heute" und Gesamtbild „In den nächsten Tagen anrufen" mit X3',
    gb.stufe === 'tage' && gb.dosis.stufe === 'tage' && gb.dosisHinweise.some((h) => h.id === 'X3' && h.stufe === 'tage') && gb.dosis.gruende.some((g) => g.id === 'X3' && g.stufe === 'tage'), r7Lage(b, H));
  const zb = [...dosisBerichtZeilen(b, H), ...dosisModul.gesamtBerichtZeilen(b, H)].join('\n');
  check('H8 (b) Bericht: nicht „Kein besonderer Anlass", sondern „In den nächsten Tagen anrufen" – Karte und Gesamteinschätzung',
    /Dringlichkeit auf der Karte \(App\): „In den nächsten Tagen anrufen"/.test(zb) && /Gesamteinschätzung[^\n]*„In den nächsten Tagen anrufen"/.test(zb) && !/Kein besonderer Anlass/.test(zb), zb.slice(0, 400));
  // (c) gleicher Tag: TSH 6,5, heute F8 „Erst nachmessen", danach selbst 100 → 150 µg ab heute.
  const c = r7Stand({
    profil: { geburtsjahr: 1948, herz: 'ja' },
    dosen: [R6R_D('d1', '2025-01-01', 100), R6R_D('e1', H, 150, { praxis: false })],
    labor: [r7Befund('b1', '2026-09-22', 6.5, { praxis: 'nachmessen', praxisAm: H })],
    nachfragen: [{ id: 'n1', art: 'dosis_stimmt', bezug: 'b1', antwort: 'ja', am: '2026-09-23' }],
    warnzeichen: [{ id: 'w', datum: H, uhr: '08:00', ja: [] }],
  });
  for (const tag of [H, plus(H, 1)]) {
    const g = gesamtbildMitDosis(c, tag);
    const x3 = g.dosisHinweise.find((h) => h.id === 'X3');
    check(`H8 (c) „Erst nachmessen" heute, danach selbst verdoppelt, ${tag}: X3 auf „Heute" mit „bis dahin wieder Ihre bisherige Menge" und den 112-Zeichen, Gesamtbild Tage`,
      rang7(g.stufe) >= rang7('tage') && !!x3 && x3.stufe === 'tage' && /bisherige Menge/.test(x3.text) && /112/.test(x3.warnzeichen || '') && /112/.test(g.dosis.warnzeichen || ''), r7Lage(c, tag));
  }
  // (a) ohne Befund: am 28.09. eingetragen 150 µg ab 13.09. (Praxis: Nein).
  const a = r7Eingetragen(r7Stand({
    profil: { geburtsjahr: 1948, herz: 'ja' },
    dosen: [R6R_D('d1', '2025-01-01', 100), R6R_D('e1', '2026-09-13', 150, { praxis: false })],
  }), 'e1', H);
  const ga = gesamtbildMitDosis(a, H);
  const x3a = ga.dosisHinweise.find((h) => h.id === 'X3');
  check('H8 (a) ohne Befund, „Gilt ab" 15 Tage zurück: „Heute" X3 „heute oder morgen … bisherige Menge" mit 112-Zeichen, Gesamtbild Tage',
    ga.stufe === 'tage' && !!x3a && /bisherige Menge/.test(x3a.text) && /112/.test(x3a.warnzeichen || ''), r7Lage(a, H));
  check('H8 (a) Bericht: Gesamteinschätzung „In den nächsten Tagen anrufen" aus der eigenen Dosisänderung',
    /„In den nächsten Tagen anrufen" – aus [^\n]*eigene Dosisänderung/.test(dosisModul.gesamtBerichtZeilen(a, H).join('\n')), dosisModul.gesamtBerichtZeilen(a, H).join(' | '));
  // Gegenprobe (C4): „selbst geändert" gemeldet, am selben Tag danach „Die
  // Praxis hat entschieden" – die Rückfrage gibt es nur ohne Entscheidung, also
  // kam die Entscheidung danach: X3 ohne Frist.
  const selbst = r7Stand({
    dosen: [R6R_D('d1', '2024-01-01', 75), R6R_D('d2', '2026-09-07', 88, { praxis: false })],
    labor: [r7Befund('b1', '2026-08-18', 7.5, { praxis: 'bleibt', praxisAm: '2026-09-20' })],
    nachfragen: [{ id: 'n1', art: 'dosis_stimmt', bezug: 'b1', antwort: 'ja', am: '2026-08-23' }, { id: 'n2', art: 'nach14', bezug: 'b1', antwort: 'selbst', am: '2026-09-20' }],
  });
  const ks = dosisRichtung(selbst, H);
  check('H8 Gegenprobe C4: Entscheidung am Tag der Meldung „selbst geändert" gilt als danach – X3 ohne Frist', ks.gruende.some((g) => g.id === 'X3' && !g.stufe) && ks.stufe !== 'tage', r7Lage(selbst, H));
});

// H9 (rot5w/f-zickzack.mjs, verify-rotes-team-2.mjs): 100 µg; am 10.09.
// selbst 150, am 12.09. zurück auf 100, am 20.09. wieder selbst 150 µg.
fall('H9', () => {
  const dosen = [R6R_D('d1', '2025-01-01', 100), R6R_D('e1', '2026-09-10', 150, { praxis: false }), R6R_D('e2', '2026-09-12', 100, { praxis: false }), R6R_D('e3', '2026-09-20', 150, { praxis: false })];
  const s = (bis) => r7Stand({
    dosen: dosen.filter((x) => x.ab <= bis),
    labor: [r7Befund('b1', '2026-09-01', 6.2)],
    nachfragen: [{ id: 'n1', art: 'dosis_stimmt', bezug: 'b1', antwort: 'ja', am: '2026-09-02' }],
  });
  const zuruck = s('2026-09-12');
  check('H9 Gegenprobe 12.09. (zurück auf die verordnete Menge): B2 „Sie nehmen wieder Ihre frühere Menge"',
    gesamtbildMitDosis(zuruck, '2026-09-12').dosisHinweise.some((h) => h.id === 'B2' && /wieder Ihre frühere Menge/.test(h.text)), r7Lage(zuruck, '2026-09-12'));
  const z = s('2026-09-20');
  const g = gesamtbildMitDosis(z, '2026-09-20');
  const x3 = g.dosisHinweise.find((h) => h.id === 'X3');
  check('H9 20.09. wieder selbst 150 µg: „Heute" X3 „bis dahin wieder Ihre bisherige Menge" mit den 112-Zeichen, nicht „Sie nehmen wieder Ihre frühere Menge"',
    !!x3 && x3.stufe === 'tage' && /bis dahin wieder Ihre bisherige Menge/.test(x3.text) && /112/.test(x3.warnzeichen || '') && !g.dosisHinweise.some((h) => /frühere Menge/.test(h.text)), r7Lage(z, '2026-09-20'));
  check('H9 20.09.: Karte X3 mit W-D2, nicht „zurück auf Ihre frühere Menge"', g.dosis.gruende.some((x) => x.id === 'X3') && /112/.test(g.dosis.warnzeichen || '') && !/frühere Menge/.test(alleTexte(g.dosis)), r7Lage(z, '2026-09-20'));
  const b = berichtText(z, '2026-09-20');
  check('H9 Bericht: Grund X3, nicht „zurück auf Ihre frühere Menge"', /Grund X3: /.test(b) && !/zurück auf Ihre frühere Menge/.test(b), b.split('\n').filter((x) => /Grund (B2|X3)/.test(x)).join(' | '));
});

// H10 (rot5w/v/d-q5.mjs, S/w/p-q5-ft4.mjs, verify-rotes-team-3.mjs): TSH
// 0,09, Q5 „einmal viele Tabletten". Danach fT4 im selben Befund oder eine
// Angabe unter „Über mich" – Giftnotruf und „Heute anrufen" fielen weg.
fall('H10', () => {
  const H = '2026-05-23';
  const s = (verw, ft4Wert, profil = {}) => r7Stand({
    profil, dosen: [R6R_D('d1', '2025-01-01', 125)],
    labor: [{ ...r7Befund('b1', '2026-05-18', 0.09), tsh: { wert: 0.09, einheit: 'mU/l', von: 0.3, bis: 4 }, ft4: ft4Wert ? ft4(ft4Wert) : null, verwechselt: verw }],
    nachfragen: [{ id: 'n1', art: 'dosis_stimmt', bezug: 'b1', antwort: 'ja', am: '2026-05-19' }],
  });
  for (const [was, st] of [['fT4 10,5 nachgetragen', s('einmal', 10.5)], ['„TSH bewusst niedrig: Ja"', s('einmal', null, { zielNiedrig: 'ja' })], ['Krebs „ja"', s('einmal', null, { krebs: 'ja' })]]) {
    const g = gesamtbildMitDosis(st, H);
    const q5 = g.dosis.gruende.find((x) => x.id === 'Q5');
    check(`H10 Q5 „einmal", danach ${was}: Karte und „Heute" weiter „Heute anrufen" mit dem Giftnotruf, nicht „genau wie bisher weiter"`,
      g.stufe === 'heute' && g.dosis.stufe === 'heute' && !!q5 && /Giftnotruf/.test(q5.text) && g.dosis.anrufe.some((x) => /Giftnotruf/.test(x.text)) && !/genau wie bisher weiter/.test(alleTexte(g.dosis)), r7Lage(st, H));
    const z = dosisBerichtZeilen(st, H).join('\n');
    check(`H10 Q5 „einmal", ${was}: Bericht „Dringlichkeit auf der Karte (App): „Heute anrufen""`, /Dringlichkeit auf der Karte \(App\): „Heute anrufen"/.test(z), z.slice(0, 300));
  }
  const t = s('tage', 10.5);
  check('H10 Q5 „über Tage zu viel", danach fT4 nachgetragen: Q5 bleibt mit Stufe Tage', dosisRichtung(t, H).gruende.some((x) => x.id === 'Q5' && x.stufe === 'tage'), r7Lage(t, H));
});

// H3 (review7/r6rf/s2-x3b-praxis.mjs, verify-rueckfall-f2-kern.mjs): Berichtigung
// am 12.08., „Ja" am 13.08., am 14.08. „Die Praxis hat entschieden → Die Dosis
// bleibt so". „✓ Gut. Es gilt, was die Praxis gesagt hat" stand direkt über
// „📞 In den nächsten Tagen anrufen" – bis zum 26.08.
fall('H3', () => {
  const s = (praxisAm) => r7Stand({
    profil: { seit: '2024-05-14' },
    dosen: [R6R_D('d1', '2024-05-14', 75), R6R_D('dK', '2024-05-14', 75, { praxis: false, berichtigung: true, statt: 'dC', berichtigtAm: '2026-08-12' }), R6R_D('dC', '2026-06-04', 100, { praxis: true })],
    labor: [r7Befund('bA', '2026-05-13', 9, { praxis: 'geaendert', praxisAm: '2026-06-04' }), r7Befund('bB', '2026-08-10', 6.5, { praxis: 'bleibt', praxisAm })],
    nachfragen: [{ id: 'n1', art: 'dosis_stimmt', bezug: 'bA', antwort: 'ja', am: '2026-05-14' }, { id: 'n2', art: 'dosis_stimmt', bezug: 'bB', antwort: 'ja', am: '2026-08-13' }],
  });
  const nach = s('2026-08-14');
  for (const tag of ['2026-08-14', '2026-08-26']) {
    const g = gesamtbildMitDosis(nach, tag);
    check(`H3 Praxis „bleibt" nach der Berichtigung, ${tag}: „Heute" und Karte ohne „In den nächsten Tagen anrufen"`,
      rang7(g.stufe) < rang7('tage') && !g.dosisHinweise.some((h) => h.id === 'X3b') && rang7(g.dosis.stufe) < rang7('tage') && !/in den nächsten Tagen/.test(alleTexte(g.dosis)), r7Lage(nach, tag));
    check(`H3 ${tag}: die Karte nennt die Berichtigung ohne Frist`, g.dosis.gruende.some((x) => x.id === 'X3b' && !x.stufe && /Wusste die Praxis/.test(x.text)), r7Lage(nach, tag));
  }
  const vor = s('2026-08-11');
  check('H3 Gegenprobe: Entscheidung vor der Berichtigung (11.08.) – X3b bleibt mit Stufe Tage', gesamtbildMitDosis(vor, '2026-08-14').dosisHinweise.some((h) => h.id === 'X3b' && h.stufe === 'tage'), r7Lage(vor, '2026-08-14'));
});

// H12 (rot5w/w/p-x3b-erst.mjs, verify-rotes-team-4-6.mjs #5): einziger Eintrag
// 100 µg ab 10.01.2026; X3 „Nein" → 125 µg ab heute (Praxis: Nein), dann
// „Gilt ab" wie geraten auf den 01.06.2025. „Heute" sank auf „Kein besonderer Anlass".
fall('H12', () => {
  const H = '2026-09-28';
  const s = r7Stand({
    profil: { seit: '2026-01-10' },
    dosen: [R6R_D('dB', '2025-06-01', 125, { praxis: false, berichtigung: true, statt: 'd1', berichtigtAm: H }), R6R_D('d1', '2026-01-10', 100)],
    labor: [r7Befund('b1', '2026-09-22', 3.5)],
    nachfragen: [{ id: 'n1', art: 'dosis_stimmt', bezug: 'b1', antwort: 'nein_100', am: H }],
  });
  for (const tag of [H, '2026-10-01']) {
    const g = gesamtbildMitDosis(s, tag);
    check(`H12 nach dem Rat der Karte, ${tag}: „Heute" X3b „In den nächsten Tagen anrufen", Gesamtbild Tage`,
      g.stufe === 'tage' && g.dosisHinweise.some((h) => h.id === 'X3b' && h.stufe === 'tage'), r7Lage(s, tag));
  }
});

// H13 (rot5w/v/j-d06.mjs, S/w/p-x3b-d06.mjs, verify-rotes-team-4-6.mjs #6):
// 100 µg seit 2025, TSH 6,5 vom 22.09.; X3 „Nein" → 75 µg ab heute, dann „Gilt
// ab" auf den 01.09. Karte „Beim nächsten Termin" [D0.6], „Heute" X3b/Tage.
fall('H13', () => {
  const H = '2026-09-28';
  const s = r7Stand({
    dosen: [R6R_D('d1', '2025-01-01', 100), R6R_D('dB', '2026-09-01', 75, { praxis: false, berichtigung: true, statt: 'd1', berichtigtAm: H })],
    labor: [r7Befund('b1', '2026-09-22', 6.5)],
    nachfragen: [{ id: 'n1', art: 'dosis_stimmt', bezug: 'b1', antwort: 'nein_100', am: H }],
  });
  const g = gesamtbildMitDosis(s, H);
  check('H13 „Gilt ab" weniger als 8 Wochen vor der Abnahme: Karte „In den nächsten Tagen anrufen" mit D0.6 und X3b, wie „Heute"',
    g.dosis.stufe === 'tage' && g.stufe === 'tage' && g.dosis.gruende.some((x) => x.id === 'D0.6') && g.dosis.gruende.some((x) => x.id === 'X3b' && x.stufe === 'tage'), r7Lage(s, H));
  const z = [...dosisBerichtZeilen(s, H), ...dosisModul.gesamtBerichtZeilen(s, H)].join('\n');
  check('H13 Bericht: Karte und Gesamteinschätzung mit derselben Dringlichkeit', /Dringlichkeit auf der Karte \(App\): „In den nächsten Tagen anrufen"/.test(z) && /Gesamteinschätzung[^\n]*„In den nächsten Tagen anrufen"/.test(z), z.slice(0, 300));
});

// H16 (rot5w/w/p-d6c2.mjs, verify-rotes-team-9.mjs): 75 µg; TSH 6,8 am 20.06.;
// die Praxis ändert auf 88 µg ab 01.07.; am 15.07. TSH 5,9 beim Hausarzt.
// „Heute" nannte die Kontrolle nie, die Karte verwarf den Wert (D0.6).
fall('H16', () => {
  const s = r7Stand({
    dosen: [R6R_D('d1', '2025-01-01', 75), R6R_D('d2', '2026-07-01', 88, { praxis: true })],
    labor: [r7Befund('b0', '2026-06-20', 6.8, { praxis: 'geaendert', praxisAm: '2026-06-25' }), r7Befund('b1', '2026-07-15', 5.9)],
    nachfragen: [{ id: 'n0', art: 'dosis_stimmt', bezug: 'b0', antwort: 'ja', am: '2026-06-21' }, { id: 'n1', art: 'dosis_stimmt', bezug: 'b1', antwort: 'ja', am: '2026-07-16' }],
  });
  for (const [tag, stufe, sichtbar] of [['2026-08-26', 'termin', true], ['2026-09-23', 'termin', true], ['2026-10-12', 'zeitnah', false]]) {
    const g = gesamtbildMitDosis(s, tag);
    const t = g.teile.find((x) => x.id === 'D6c');
    check(`H16 ${tag}: „Jetzt ist die Kontrolle fällig" (D6c ${stufe}) im Gesamtbild${sichtbar ? ' und als Karte auf „Heute"' : ''}`,
      !!t && t.stufe === stufe && /Kontrolle fällig/.test(t.text) && (!sichtbar || g.dosisHinweise.some((h) => h.id === 'D6c')), r7Lage(s, tag));
  }
});

// H17 (rot5w/w/p-n3c.mjs, verify-rotes-team-10.mjs): 100 µg, TSH 6,5 vom
// 10.09.; Herzklopfen gestern und heute; eigene Erhöhung auf 150 µg ab 26.09.
fall('H17', () => {
  const H = '2026-09-28';
  const s = r7Stand({
    dosen: [R6R_D('d1', '2025-01-01', 100), R6R_D('e1', '2026-09-26', 150, { praxis: false })],
    labor: [r7Befund('b1', '2026-09-10', 6.5, { praxisAm: '2026-09-12' })],
    nachfragen: [{ id: 'n1', art: 'dosis_stimmt', bezug: 'b1', antwort: 'ja', am: '2026-09-12' }],
    warnzeichen: [{ id: 'w', datum: H, uhr: '08:00', ja: [] }],
    befinden: [{ id: 'x1', datum: '2026-09-27', stufe: 'mittel', beschwerden: ['herz'], notiz: '' }, { id: 'x2', datum: H, stufe: 'mittel', beschwerden: ['herz'], notiz: '' }],
  });
  const g = gesamtbildMitDosis(s, H);
  const texte = g.dosisHinweise.map((h) => h.text).join(' ');
  check('H17 „Heute": derselbe Anruf mit einer Frist – X3 „heute noch", nirgends „heute oder morgen" oder „in den nächsten Tagen"',
    g.stufe === 'heute' && g.dosisHinweise.some((h) => h.id === 'X3' && h.stufe === 'heute' && /heute noch/.test(h.text)) && !/heute oder morgen|in den nächsten Tagen/.test(texte), `${r7Lage(s, H)} | ${texte.slice(0, 200)}`);
});

// H23 (review7/verify-medizin-x7.mjs, a5.mjs): „Heute anrufen – aus
// E13-natrium, E13-crp, S4, S4ii, Dosis-Karte" – Kennungen, die die Ärztin nicht deuten kann.
fall('H23', () => {
  const H = '2026-09-28';
  const s = r7Stand({
    mittel: ['marcumar'],
    dosen: [R6R_D('d1', '2025-01-01', 100)],
    labor: [{ ...r7Befund('b1', plus(H, -5), 0.08), ft4: ft4(24), praxis: '', natrium: { wert: 123, einheit: 'mmol/l', von: 135, bis: 145 }, hb: { wert: 7.6, einheit: 'g/dl', von: 12, bis: 16 }, crp: { wert: 130, einheit: 'mg/l', von: null, bis: 5 } }],
    befinden: [{ id: 'bf1', datum: plus(H, -2), stufe: 'schlecht', beschwerden: ['herz', 'puls'], notiz: '' }],
  });
  const z = berichtText(s, H).split('\n').filter((x) => /^Gesamteinschätzung am/.test(x));
  check('H23 Bericht: die Gesamteinschätzung nennt ihre Herkunft in Worten, ohne interne Kennungen',
    z.length === 1 && /– aus /.test(z[0]) && !/\b(E13-\w+|S4ii?|W-D4|L7d|D6c|R3)\b/.test(z[0]) && /Natrium im Befund vom 23\.09\.2026/.test(z[0]), z.join(' | '));
});

// ================================================================ Nachprüfung Runde 7
/*
 * Die Nachprüfung der siebten Runde (review7/nach-w8901, nach-w8902): H8 war
 * im Kern behoben, aber nicht verdrahtet – normStand warf dosen[].eingetragenAm
 * weg. N1: Ein Tag für den ganzen Befund begann die Frist eines unveränderten
 * Gefahrenwerts neu. N3: Der Bericht nannte bei einem später eingetragenen
 * Wert den falschen Grund. Jeder Fall scheiterte vor der Korrektur.
 */
fall('Nachprüfung R7 – H8: normStand behält den Tag des Eintrags', () => {
  const H = '2026-09-28';
  // Wie H8 (b), aber der Tag steht in den gespeicherten Daten, nicht nachträglich gesetzt.
  const b = r7Stand({
    dosen: [R6R_D('d1', '2025-01-01', 112), R6R_D('e1', '2026-09-20', 150, { praxis: false, eingetragenAm: H })],
    labor: [r7Befund('b1', '2026-09-18', 0.06, { praxis: 'bleibt', praxisAm: '2026-09-23' })],
    nachfragen: [{ id: 'n1', art: 'dosis_stimmt', bezug: 'b1', antwort: 'ja', am: '2026-09-19' }],
  });
  const gb = gesamtbildMitDosis(b, H);
  check('Nachprüfung R7 H8: eigene Erhöhung am 28.09. eingetragen, „bleibt" vom 23.09. – nach dem Laden X3 mit „In den nächsten Tagen anrufen"',
    b.dosen.find((d) => d.id === 'e1').eingetragenAm === H && gb.stufe === 'tage' && gb.dosis.gruende.some((g) => g.id === 'X3' && g.stufe === 'tage'), r7Lage(b, H));
  // PRAXIS_DANACH: dieselbe Entscheidung am Tag des Eintrags, eingetragen, während die Karte wartete.
  const danach = r7Stand({
    dosen: [R6R_D('d1', '2025-01-01', 112), R6R_D('e1', '2026-09-20', 150, { praxis: false, eingetragenAm: H })],
    labor: [r7Befund('b1', '2026-09-18', 0.06, { praxis: 'bleibt', praxisAm: H })],
    nachfragen: [{ id: 'n1', art: 'dosis_stimmt', bezug: 'b1', antwort: 'ja', am: '2026-09-19' },
      { id: 'n2', art: dosisModul.PRAXIS_DANACH, bezug: 'b1', antwort: 'ja', am: H }],
  });
  const kd = dosisRichtung(danach, H);
  check('Nachprüfung R7 H8 Gegenprobe: mit PRAXIS_DANACH vom selben Tag gilt die Entscheidung als danach – X3 ohne Frist',
    kd.gruende.some((g) => g.id === 'X3' && !g.stufe) && kd.stufe !== 'tage', r7Lage(danach, H));
});

fall('Nachprüfung R7 – N1: der Tag je weiterem Wert', () => {
  const na = { wert: 118, einheit: 'mmol/l', von: 135, bis: 145, unter: false };
  // Natrium 118 vom 20.05., „Die Praxis weiß davon" am 21.05.; am 01.06. kam fT4
  // dazu (alter Tag für den ganzen Befund: 01.06., neuer je Wert: Natrium 20.05.).
  const s = r7Stand({
    dosen: [R6R_D('d1', '2025-01-01', 100, { praxis: true })],
    labor: [r7Befund('b1', '2026-05-20', 2, { ft4: ft4(15), natrium: na, eingetragenAm: '2026-06-01', werteAm: { natrium: '2026-05-20' } })],
    nachfragen: [{ id: 'n1', art: ez.WERT_BEKANNT, bezug: 'b1', antwort: 'natrium', am: '2026-05-21' }],
    bis: '2026-06-30',
  });
  const w = ez.weitereWerte(s.labor[0], s, '2026-06-03').find((x) => x.key === 'natrium');
  check('Nachprüfung R7 N1: fT4 nachgetragen – „Die Praxis weiß davon" gilt für das unveränderte Natrium weiter (termin, nicht heute)',
    s.labor[0].werteAm && s.labor[0].werteAm.natrium === '2026-05-20' && w && w.stufe === 'termin', JSON.stringify({ am: s.labor[0].werteAm, w: w && [w.stufe, w.texte[0].slice(0, 80)] }));
  const ohne = r7Stand({
    dosen: [R6R_D('d1', '2025-01-01', 100, { praxis: true })],
    labor: [r7Befund('b1', '2026-05-20', 2, { natrium: na, werteAm: { natrium: '2026-05-20', tsh: '2026-05-20', quatsch: 'x' } })],
    bis: '2026-06-30',
  });
  check('Nachprüfung R7 N1: normStand behält werteAm nur für weitere Werte des Eintrags mit gültigem Tag',
    JSON.stringify(ohne.labor[0].werteAm) === '{"natrium":"2026-05-20"}', JSON.stringify(ohne.labor[0].werteAm));
});

fall('Nachprüfung R7 – N3: Begründung im Bericht bei einem später eingetragenen Wert', () => {
  const H = '2026-09-28';
  const s = r7Stand({
    dosen: [R6R_D('d1', '2025-01-01', 100, { praxis: true })],
    labor: [r7Befund('b1', '2026-08-01', 2, { natrium: { wert: 118, einheit: 'mmol/l', von: 135, bis: 145, unter: false }, werteAm: { natrium: '2026-08-20' } })],
  });
  const text = berichtText(s, H);
  check('Nachprüfung R7 N3: „seit dem Eintrag in die App am 20.08.2026 mehr als 14 Tage", nicht „seit 04.09.2026 älter als 14 Tage"',
    /seit dem Eintrag in die App am 20\.08\.2026 mehr als 14 Tage ohne Angabe/.test(text) && !/seit 04\.09\.2026 älter/.test(text),
    (text.split('\n').find((z) => /Natrium/.test(z) && /inzwischen/.test(z)) || '').slice(0, 300));
  const frueh = r7Stand({
    dosen: [R6R_D('d1', '2025-01-01', 100, { praxis: true })],
    labor: [r7Befund('b1', '2026-08-01', 2, { natrium: { wert: 118, einheit: 'mmol/l', von: 135, bis: 145, unter: false } })],
  });
  check('Nachprüfung R7 N3 Gegenprobe: am Abnahmetag eingetragen – „seit 16.08.2026 älter als 14 Tage" wie bisher',
    /seit 16\.08\.2026 älter als 14 Tage/.test(berichtText(frueh, H)), (berichtText(frueh, H).split('\n').find((z) => /inzwischen/.test(z)) || '').slice(0, 300));
});

// N1 (8901, review7/nach-h18-ersetzen-ui.mjs, nach-h18-praxis.mjs): Die Regel
// „von zwei Einträgen eines Tages zählt der letzte" (H18) verschluckte eine
// eigene Änderung am Tag des Einrichtens, und eine am selben Tag ersetzte
// Anordnung der Praxis fehlte im Bericht.
fall('Nachprüfung R7 – N1: eigene Änderung am Tag eines vorhandenen Eintrags', () => {
  const H = '2026-09-28';
  const s = r7Stand({
    profil: { geburtsjahr: 1948, herz: 'ja' },
    dosen: [R6R_D('d1', H, 137), R6R_D('e1', H, 274, { praxis: false, eingetragenAm: H })],
  });
  const v = ez.dosisVerlauf(s, H);
  const g = gesamtbildMitDosis(s, H);
  const x3 = g.dosisHinweise.find((h) => h.id === 'X3');
  check('Nachprüfung R7 N1: 137 µg vom Einrichten, am selben Tag selbst 274 µg – die 137 µg sind die Menge davor, X3 mit „bisherige Menge" und 112-Zeichen',
    v.length === 2 && v[1].d.id === 'e1' && v[1].aenderung && !!x3 && /bisherige Menge/.test(x3.text) && /112/.test(x3.warnzeichen || '') && rang7(g.stufe) >= rang7('tage'),
    `${JSON.stringify(v.map((p) => [p.ab, p.d.id]))} | ${r7Lage(s, H)}`);
  // Anordnung der Praxis 137 µg ab heute, am selben Tag selbst 112 µg (vorher 100 µg).
  const p = r7Stand({
    dosen: [R6R_D('d0', '2025-01-01', 100, { praxis: true }), R6R_D('p1', H, 137, { praxis: true }), R6R_D('e1', H, 112, { praxis: false, eingetragenAm: H })],
  });
  const text = berichtText(p, H);
  check('Nachprüfung R7 N1: eine am selben Tag ersetzte Anordnung der Praxis steht im Bericht',
    /Ab 28\.09\.2026 war [^\n]*137 µg[^\n]*eingetragen \(auf Anweisung der Praxis\) – am selben Tag ersetzt durch [^\n]*112 µg[^\n]*\(nicht auf Anweisung der Praxis\)/.test(text),
    (text.split('\n').filter((z) => /137/.test(z)).join(' | ') || text.split('\n').filter((z) => /^Aktuell|^Davor/.test(z)).join(' | ')).slice(0, 300));
  const gp = gesamtbildMitDosis(p, H);
  check('Nachprüfung R7 N1: … und die eigene Änderung gegenüber den 100 µg davor gibt B2 bzw. X3 mit Frist', gp.dosisHinweise.some((h) => ['X3', 'B2'].includes(h.id) && h.stufe === 'tage'), r7Lage(p, H));
  // Gegenprobe H18: zwei Angaben der Praxis am selben Tag – die letzte zählt, kein Zeitraum ohne Dauer.
  const q = r7Stand({ dosen: [R6R_D('d0', '2025-01-01', 100, { praxis: true }), R6R_D('p1', H, 137, { praxis: true }), R6R_D('p2', H, 125, { praxis: true })] });
  check('Nachprüfung R7 N1 Gegenprobe: zwei Anordnungen am selben Tag bleiben ein Zeitraum (H18)', ez.dosisVerlauf(q, H).length === 2 && ez.dosisVerlauf(q, H)[1].d.id === 'p2',
    JSON.stringify(ez.dosisVerlauf(q, H).map((x) => [x.ab, x.d.id])));
});

console.log(fails ? `\n${fails} gescheitert` : '\nalles grün');
process.exit(fails ? 1 : 0);
