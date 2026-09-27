/*
 * Schilddrüse: die Befunde der zweiten Nachprüfung als Regressionsfälle.
 *
 * Nach den Review-Korrekturen haben zwei Prüfer jeden Befund erneut
 * nachgestellt und dabei noch fünf Fehler gefunden, dazu zwei nur teilweise
 * behobene (B26, B52). Jeder Fall hier scheiterte vor der Korrektur. Unten
 * im Abschnitt „Runde 2" die Befunde der zweiten Review-Runde (C…).
 *
 *     node tests/test-sd-nachpruefung.mjs
 *
 * Läuft ohne Browser, Ausgabe „OK …"/„FAIL …", Exit-Code 1 bei Fehlern.
 */
// Als Namensraum: Fehlt ein Export (D6_HEUTE vor Runde 2), scheitern nur die
// Prüfungen, die ihn brauchen – nicht die ganze Datei beim Laden.
import * as dosisModul from '../schilddruese/js/dosis.js';
import * as ez from '../schilddruese/js/einschaetzung.js';
import { erinnerungText } from '../schilddruese/js/ics.js';
import { normStand } from '../schilddruese/js/speicher.js';

const { dosisRichtung, dosisHinweise, gesamtbildMitDosis, D6_LANG, D6_HEUTE } = dosisModul;

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

console.log(fails ? `\n${fails} gescheitert` : '\nalles grün');
process.exit(fails ? 1 : 0);
