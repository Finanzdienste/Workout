/*
 * Schilddrüse: die Befunde der zweiten Nachprüfung als Regressionsfälle.
 *
 * Nach den Review-Korrekturen haben zwei Prüfer jeden Befund erneut
 * nachgestellt und dabei noch fünf Fehler gefunden, dazu zwei nur teilweise
 * behobene (B26, B52). Jeder Fall hier scheiterte vor der Korrektur.
 *
 *     node tests/test-sd-nachpruefung.mjs
 *
 * Läuft ohne Browser, Ausgabe „OK …"/„FAIL …", Exit-Code 1 bei Fehlern.
 */
import { dosisRichtung, dosisHinweise } from '../schilddruese/js/dosis.js';
import * as ez from '../schilddruese/js/einschaetzung.js';
import { erinnerungText } from '../schilddruese/js/ics.js';
import { normStand } from '../schilddruese/js/speicher.js';

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

console.log(fails ? `\n${fails} gescheitert` : '\nalles grün');
process.exit(fails ? 1 : 0);
