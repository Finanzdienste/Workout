/*
 * Schilddrüse: der Bericht für den Arzttermin.
 *
 * Er ist der Grund, warum die App überhaupt sammelt. Geprüft wird, dass
 * darin steht, was im Sprechzimmer gefragt wird – Dosis seit wann, wie
 * zuverlässig genommen, Werte neben der damaligen Dosis, Fragen –, dass die
 * Zahlen stimmen, und dass er nichts bewertet.
 */
import { oeffne, standMit, plus, kurz } from './sd-hilfe.mjs';

const TAG = '2026-03-10';
const einnahmen = {};
for (let i = 1; i <= 70; i++) einnahmen[plus(TAG, -i)] = { uhr: '07:05' };
[3, 17, 40].forEach((i) => { einnahmen[plus(TAG, -i)] = null; });
delete einnahmen[plus(TAG, -20)];

const stand = standMit(plus(TAG, -200), {
  profil: { name: 'Mama', begruesst: true },
  dosen: [
    // 1½ Tabletten zu 50 µg: am Tag 75 µg. Der Bericht muss die Tagesdosis nennen.
    { id: 'd1', ab: plus(TAG, -200), praeparat: 'L-Thyroxin Henning', mikrogramm: 50, tabletten: 1.5, notiz: '' },
    { id: 'd2', ab: plus(TAG, -45), praeparat: 'L-Thyroxin Henning', mikrogramm: 75, tabletten: 1, notiz: 'nach Kontrolle' },
  ],
  einnahmen,
  labor: [
    { id: 'l1', datum: plus(TAG, -50), tsh: { wert: 5.8, einheit: 'mU/l', von: 0.27, bis: 4.2 }, ft4: { wert: 12.1, einheit: 'pmol/l', von: 12, bis: 22 }, ft3: null, notiz: '' },
    { id: 'l2', datum: plus(TAG, -2), tsh: { wert: 2.4, einheit: 'mU/l', von: 0.27, bis: 4.2 }, ft4: null, ft3: null, notiz: 'Tablette nach der Abnahme' },
  ],
  gewicht: [{ id: 'g1', datum: plus(TAG, -120), kg: 71.2 }, { id: 'g2', datum: plus(TAG, -1), kg: 69.9 }],
  befinden: [
    { id: 'b1', datum: plus(TAG, -3), stufe: 'schlecht', beschwerden: ['muede', 'frieren'], notiz: 'nachmittags sehr müde' },
    { id: 'b2', datum: plus(TAG, -10), stufe: 'mittel', beschwerden: ['muede'], notiz: '' },
  ],
  fragen: [
    { id: 'f1', text: 'Kann die Müdigkeit an der Dosis liegen?', erledigt: false },
    { id: 'f2', text: 'Alte, schon besprochene Frage', erledigt: true },
  ],
});

const { page, ctx, check, ende } = await oeffne({ tag: TAG, stand });

await page.click('#reiter-mehr');
await page.click('[data-seite="bericht"]');
const text = await page.locator('#berichtText').innerText();
console.log(text.split('\n').map((z) => `     | ${z}`).join('\n'));

check(text.startsWith(`Schilddrüse – Bericht vom ${kurz(TAG)} (Mama)`), 'Kopfzeile mit Datum und Anrede');
check(text.includes(`Aktuell: L-Thyroxin Henning 75 µg, 1 Tablette am Tag, seit ${kurz(plus(TAG, -45))} (nach Kontrolle)`), 'aktuelle Dosis mit Datum und Notiz');
check(text.includes(`Davor: L-Thyroxin Henning 50 µg, 1½ Tabletten am Tag – zusammen 75 µg, ab ${kurz(plus(TAG, -200))}`), 'die Dosis davor, mit 1½ Tabletten und der Menge am Tag');
// Heute ist noch nichts eingetragen – dann zählen die 56 Tage bis gestern:
// vor 20 Tagen kein Eintrag, vor 3, 17 und 40 Tagen nicht genommen.
check(text.includes('Letzte 8 Wochen: an 52 von 56 Tagen genommen, an 3 Tagen nicht genommen, 1 Tag ohne Eintrag.'), 'Einnahmen der letzten acht Wochen richtig gezählt – der heutige Tag vor der Tablette ist keine Lücke');
// Die 28 Tage bis gestern: vor 20 Tagen ohne Eintrag, vor 3 und 17 Tagen nicht genommen.
check(text.includes('Davon letzte 4 Wochen: an 25 von 28 Tagen genommen.'), 'und die der letzten vier Wochen');
check(text.includes(`Nicht genommen am: ${kurz(plus(TAG, -3))}, ${kurz(plus(TAG, -17))}, ${kurz(plus(TAG, -40))}`), 'die Tage ohne Tablette mit Datum');
check(text.includes(`${kurz(plus(TAG, -2))}: TSH 2,4 mU/l (Labor 0,27–4,2) – Dosis damals 75 µg am Tag – Tablette nach der Abnahme`), 'neuester Laborwert mit Bereich, damaliger Dosis und Notiz');
check(text.includes(`${kurz(plus(TAG, -50))}: TSH 5,8 mU/l (Labor 0,27–4,2), fT4 12,1 pmol/l (Labor 12–22) – Dosis damals 75 µg am Tag`), 'älterer Laborwert mit der Tagesdosis von damals: 1½ × 50 = 75 µg, nicht die Stärke 50');
check(text.includes(`69,9 kg am ${kurz(plus(TAG, -1))}; davor 71,2 kg am ${kurz(plus(TAG, -120))}`), 'Gewicht jetzt und davor – mit Datum statt „vor etwa drei Monaten"');
check(text.includes('2 Einträge: 1× mittel, 1× schlecht.'), 'Befinden zusammengefasst, ohne Nullen');
check(text.includes('müde, erschöpft (2×)'), 'häufigste Beschwerde mit Anzahl');
check(text.includes('Kann die Müdigkeit an der Dosis liegen?'), 'offene Frage steht drin');
check(!text.includes('schon besprochene'), 'besprochene Frage nicht');
check(!/zu hoch|zu niedrig|erhöht|auffällig|undefined|NaN|null|Tag\(e\)/.test(text), 'keine Bewertung und kein Rechenrest (undefined, NaN, „Tag(e)")');
check(text.includes('ersetzt keine ärztliche Beratung'), 'am Ende der Hinweis, dass die Einordnung keine ärztliche Beratung ersetzt');

// Kopieren landet in der Zwischenablage.
await ctx.grantPermissions(['clipboard-read', 'clipboard-write']);
await page.click('[data-act="bericht-kopieren"]');
await page.waitForTimeout(200);
const ablage = await page.evaluate(() => navigator.clipboard.readText());
check(ablage === text.replace(/\n$/, '') || ablage.trim() === text.trim(), '„Kopieren" legt genau diesen Text in die Zwischenablage');

// Leerer Stand: ein Bericht ohne Rechenreste.
await page.evaluate((key) => localStorage.setItem(key, JSON.stringify({ version: 1, profil: { begruesst: true } })), 'schilddruese.stand.v1');
await page.reload({ waitUntil: 'networkidle' });
await page.click('#reiter-mehr');
await page.click('[data-seite="bericht"]');
const leer = await page.locator('#berichtText').innerText();
check(leer.includes('Keine Dosis eingetragen.') && leer.includes('Keine Laborwerte eingetragen.'), 'ohne Daten: Sätze statt leerer Abschnitte');
check(!/undefined|NaN|null/.test(leer), 'ohne Daten: kein undefined oder NaN');

// ================================================================ Runde 5 – Ansichten und Bericht
//
// Befunde aus der fünften Durchsicht (F…) zum Inhalt des Berichts: alle
// Beschwerden und die Warnbeschwerden mit Datum, die Gesamteinschätzung,
// die Befundauswahl, die Angaben auch ohne P6, die Einnahmezeit ohne
// festes „nüchtern", die Dosis-Historie mit Berichtigung und doppeltem
// Eintrag, mehrzeilige Notizen und Fragen. Jeder Fall scheiterte vor der
// Korrektur. Stand 28.09.2026, wie in den Nachweisen der Durchsicht.

const R5 = '2026-09-28';
const R5_NEIN = {
  vorAbnahme: 'nein', biotin: 'nein', krank: 'nein', kortison: 'nein', kontrastmittel: 'nein', mittelGeaendert: 'nein',
  einnahmeGeaendert: 'nein', packung: 'nein', abstandOk: 'ja', vergessen: 'nein', einnahmeArt: 'ja', verwechselt: 'nein',
};
const r5W = (wert, einheit, von = null, bis = null) => ({ wert, einheit, von, bis, unter: false });
/** Jeder Tag von a bis b genommen, um `uhr`. */
function r5Einnahmen(a, b, uhr = '07:05') {
  const e = {};
  for (let t = a; t <= b; t = plus(t, 1)) e[t] = { uhr };
  return e;
}
function r5Stand({ profil = {}, ...mehr } = {}) {
  return {
    version: 2,
    profil: {
      name: '', begruesst: true, behandelt: true, seit: '2025-01-01', geburtsjahr: 1950, ursache: 'hashimoto', krebs: 'nein',
      praeparatArt: 't4', herz: 'nein', osteoporose: 'nein', kortison: 'nein', diabetes: 'nein', bundesland: 'NW', ...profil,
    },
    einstellungen: { erinnerung: '07:00', schrift: 'gross', farbe: 'hell', hinweisTablette: false },
    dosen: [{ id: 'd1', ab: '2021-01-01', praeparat: 'L-Thyroxin', mikrogramm: 100, tabletten: 1, notiz: '', praxis: true }],
    einnahmen: r5Einnahmen('2026-06-01', '2026-09-27'),
    labor: [], befinden: [], gewicht: [], termine: [], fragen: [], mittel: [], mittelAbstand: {}, warnzeichen: [], nachfragen: [],
    ...mehr,
  };
}
/** Stand laden, mit fester Uhr neu öffnen, den Bericht lesen. */
async function r5Bericht(st) {
  await page.evaluate(({ key, s0, t }) => {
    localStorage.setItem(key, JSON.stringify(s0));
    localStorage.setItem('__testtag', t);
    localStorage.setItem('__testzeit', '10:00');
  }, { key: 'schilddruese.stand.v1', s0: st, t: R5 });
  await page.reload({ waitUntil: 'networkidle' });
  await page.click('#reiter-mehr');
  await page.click('[data-seite="bericht"]');
  return page.locator('#berichtText').innerText();
}
/** Die Zeilen eines Abschnitts, von der Überschrift bis zur nächsten Leerzeile. */
const r5Abschnitt = (text, kopf) => {
  const z = text.split('\n');
  const i = z.findIndex((x) => x.startsWith(kopf));
  if (i < 0) return [];
  const ende = z.findIndex((x, j) => j > i && !x.trim());
  return z.slice(i, ende < 0 ? undefined : ende);
};

// ---------------------------------------------------------------- F9: alle Beschwerden, Warnbeschwerden mit Datum

// 25 Einträge mit sechs Alltagsbeschwerden, dazu einmal „lebensmüde",
// Herzstolpern und „ungewollt abgenommen" vor 36 Tagen, ohne P6. Vorher
// nannte BEFINDEN nur die fünf häufigsten – die drei Warnbeschwerden kamen
// im ganzen Bericht nicht vor, obwohl „Heute" die Telefonseelsorge zeigte.
const f9Befinden = [];
for (let i = 1; i <= 50; i += 2) f9Befinden.push({ id: `x${i}`, datum: plus(R5, -i), stufe: 'mittel', beschwerden: ['muede', 'frieren', 'schlaf', 'konzentration', 'stimmung', 'schmerzen'], notiz: '' });
f9Befinden.push({ id: 'y1', datum: plus(R5, -36), stufe: 'schlecht', beschwerden: ['lebensmuede', 'puls', 'abnahme'], notiz: '' });
let r5 = await r5Bericht(r5Stand({ profil: { behandelt: false, ursache: '' }, befinden: f9Befinden }));
const f9Befund = r5Abschnitt(r5, 'BEFINDEN').join('\n');
check(f9Befund.includes('nicht mehr leben möchte (1×)') && f9Befund.includes('Herzstolpern (1×)') && f9Befund.includes('ungewollt abgenommen (1×)') && f9Befund.includes('Muskel- oder Gelenkschmerzen (25×)'),
  'F9: BEFINDEN nennt alle Beschwerden mit Anzahl – auch die seltenen, nicht nur die fünf häufigsten');
check(f9Befund.includes(`Warnbeschwerden (Angabe): so niedergeschlagen, dass ich manchmal nicht mehr leben möchte am ${kurz(plus(R5, -36))}`)
  && f9Befund.includes(`Puls unregelmäßig oder Herzstolpern am ${kurz(plus(R5, -36))}`) && f9Befund.includes(`ungewollt abgenommen am ${kurz(plus(R5, -36))}`),
`F9: … die Warnbeschwerden stehen mit Datum da, auch ohne P6 (${f9Befund.split('\n').find((z) => z.startsWith('Warn')) || 'keine Zeile'})`);
check(!/Warnbeschwerden[^\n]*(Stufe|Auswertung|\(App\))/.test(r5), 'F9: … ohne Stufe und ohne Auswertung');

// ---------------------------------------------------------------- F10: Gesamteinschätzung wie auf „Heute"

// Herzklopfen bei TSH 0,05 und hohem fT4: „Heute" und die Karte sagen „Heute
// anrufen", der Befund allein „In den nächsten Tagen". Vorher stand im Bericht
// nur die niedrigere Stufe des Befunds.
r5 = await r5Bericht(r5Stand({
  profil: { geburtsjahr: 1942, herz: 'ja', osteoporose: 'ja' },
  dosen: [{ id: 'd1', ab: '2020-01-01', praeparat: 'L-Thyroxin', mikrogramm: 125, tabletten: 1, notiz: '', praxis: true }],
  labor: [{ id: 'b2', datum: '2026-09-22', tsh: r5W(0.05, 'mU/l', 0.27, 4.2), ft4: r5W(24.5, 'pmol/l', 12, 22), ...R5_NEIN, abnahmeUhr: '08:30', praxis: 'nochnicht', praxisAm: '2026-09-23' }],
  befinden: [{ id: 'h1', datum: '2026-09-26', stufe: 'mittel', beschwerden: ['herz'], notiz: '' }, { id: 'h2', datum: '2026-09-27', stufe: 'schlecht', beschwerden: ['herz'], notiz: '' }],
  warnzeichen: [{ id: 'w1', datum: R5, uhr: '09:00', ja: [] }],
  nachfragen: [{ id: 'n0', art: 'dosis_stimmt', bezug: 'b2', antwort: 'ja', am: '2026-09-24' }],
}));
const f10Zeilen = r5.split('\n');
const f10i = f10Zeilen.findIndex((z) => z.startsWith('Gesamteinschätzung am 28.09.2026 (App, wie auf „Heute"): „Heute anrufen"'));
check(f10i > 0 && f10Zeilen[f10i - 1].startsWith('Grundlage:'),
  `F10: die Gesamteinschätzung „Heute anrufen" steht gleich unter „Grundlage:" (${f10i > 0 ? f10Zeilen[f10i] : 'fehlt'})`);
check(r5.includes('Dringlichkeit auf der Karte (App): „Heute anrufen"') && r5.includes('Sie haben Herzklopfen eingetragen'),
  'F10: … und die Dosis-Karte mit ihrer Dringlichkeit und dem Satz, der sie begründet');

// ---------------------------------------------------------------- F11: Befundauswahl aus dem Kern

// Ein TSH-Befund (Biotin ja, Tablette vorher) und danach drei Einträge nur
// mit HbA1c, Vitamin D und B12. Vorher verdrängten sie den TSH-Befund, und
// „Weitere Angaben" standen doppelt und teils beim falschen Befund.
r5 = await r5Bericht(r5Stand({
  profil: { geburtsjahr: 1946 },
  labor: [
    { id: 'b1', datum: '2026-06-10', tsh: r5W(0.06, 'mU/l', 0.27, 4.2), ft4: r5W(26, 'pmol/l', 12, 22), ...R5_NEIN, biotin: 'ja', vorAbnahme: 'ja', tabletteUhr: '06:30', abnahmeUhr: '08:00' },
    { id: 'b2', datum: '2026-07-15', hba1c: r5W(6.1, '%', null, 5.7) },
    { id: 'b3', datum: '2026-08-20', vitd: r5W(18, 'ng/ml', 30, 100) },
    { id: 'b4', datum: '2026-09-18', b12: r5W(320, 'pmol/l', 150, 700) },
  ],
}));
const f11Weitere = r5.split('\n').filter((z) => z.trim().startsWith('Weitere Angaben'));
check(r5.includes('Muster d') && r5.includes('Biotin: ja') && r5.includes('Tablette vorher: ja (6:30 Uhr)') && !r5.includes('(Befund): .'),
  'F11: der TSH-Befund steht mit Muster, Biotin und „Tablette vorher" im Bericht, kein leeres „Befund vom …: ."');
check(f11Weitere.length === 1 && f11Weitere[0].startsWith('  Weitere Angaben (Angabe): nüchtern mit Wasser: ja'),
  `F11: „Weitere Angaben" steht genau einmal, beim TSH-Befund (${f11Weitere.length}×)`);

// ---------------------------------------------------------------- F12: die Angaben auch ohne P6

// Ohne P6-Haken fehlte der ganze Abschnitt: weitere Mittel, Biotin,
// „Tablette vorher", Q5 und der Warnzeichen-Check mit Brustschmerz.
r5 = await r5Bericht(r5Stand({
  profil: { behandelt: false, ursache: '' },
  mittel: ['marcumar', 'amiodaron', 'biotin'],
  labor: [{ id: 'b2', datum: '2026-09-22', tsh: r5W(0.04, 'mU/l', 0.27, 4.2), ft4: r5W(28, 'pmol/l', 12, 22), ...R5_NEIN, biotin: 'ja', vorAbnahme: 'ja', tabletteUhr: '06:30', abnahmeUhr: '07:15', verwechselt: 'einmal' }],
  warnzeichen: [{ id: 'w1', datum: '2026-09-20', uhr: '21:40', ja: ['brust', 'herzrasen'] }],
}));
const f12 = r5Abschnitt(r5, 'ANGABEN ZUR BLUTABNAHME').join('\n');
check(f12.includes('Marcumar') && f12.includes('Amiodaron') && f12.includes('Biotin: ja') && f12.includes('Tablette vorher: ja (6:30 Uhr)')
  && f12.includes('einmal viele Tabletten') && f12.includes('Warnzeichen-Check vom 20.09.2026 21:40 Uhr (Angabe): Schmerzen oder Engegefühl in der Brust'),
'F12: ohne P6 stehen Mittel, Angaben zur Abnahme, Q5 und der Warnzeichen-Check im Bericht');
check(!r5.includes('EINSCHÄTZUNG DER APP') && !/\(App\)|Muster |Auswertung/.test(f12), 'F12: … ohne jede Einschätzung der App');

// ---------------------------------------------------------------- F13: Einnahmezeit ohne festes „nüchtern"

// Q2 „nein", jeden Tag um 10:45 abgehakt. Vorher: „Einnahmezeit: etwa 7:00
// Uhr, nüchtern" – das Gegenteil der Angabe, ohne Herkunft.
for (const p6 of [true, false]) {
  r5 = await r5Bericht(r5Stand({
    profil: p6 ? {} : { behandelt: false, ursache: '' },
    einnahmen: r5Einnahmen('2026-06-01', '2026-09-27', '10:45'),
    labor: [{ id: 'b2', datum: '2026-09-22', tsh: r5W(6.9, 'mU/l', 0.27, 4.2), ft4: r5W(13, 'pmol/l', 12, 22), ...R5_NEIN, einnahmeArt: 'nein' }],
  }));
  const f13 = r5Abschnitt(r5, 'DOSIS').join('\n');
  check(!/7:00 Uhr, nüchtern/.test(r5) && f13.includes('Einnahmezeit laut Erinnerung in der App (Angabe): etwa 7:00 Uhr')
    && f13.includes('Nüchtern mit Wasser (Angabe zum Befund vom 22.09.2026): nein') && f13.includes('meist abgehakt gegen 10:45 Uhr (App'),
  `F13 (P6 ${p6 ? 'an' : 'aus'}): die Einnahmezeit mit Herkunft, daneben die Antwort „nüchtern: nein" und die Uhrzeit des Abhakens`);
}

// ---------------------------------------------------------------- F15: Dosis-Historie – Berichtigung und doppelter Eintrag

// (a) 75 µg seit 2019, nach „Nein, ich nehme etwas anderes" 100 µg ab 20.09.
// eingetragen. Vorher: „Aktuell: 100 µg seit 20.09. / Davor: 75 µg" und beim
// Befund „Dosis damals 75 µg" ohne Hinweis – die Ärztin las eine Erhöhung.
r5 = await r5Bericht(r5Stand({
  profil: { geburtsjahr: 1952 },
  dosen: [
    { id: 'd1', ab: '2019-03-01', praeparat: 'L-Thyroxin', mikrogramm: 75, tabletten: 1, notiz: '', praxis: true },
    { id: 'd2', ab: '2026-09-20', praeparat: 'L-Thyroxin', mikrogramm: 100, tabletten: 1, notiz: '', praxis: null, berichtigung: true },
  ],
  labor: [{ id: 'b2', datum: '2026-09-15', tsh: r5W(7.8, 'mU/l', 0.27, 4.2), ft4: r5W(12.6, 'pmol/l', 12, 22), ...R5_NEIN }],
}));
check(r5.includes('Aktuell: L-Thyroxin 100 µg, 1 Tablette am Tag, eingetragen ab 20.09.2026. Berichtigung (Angabe): Die Patientin nimmt nach eigener Angabe 100 µg am Tag statt der zuvor eingetragenen 75 µg am Tag.')
  && !r5.includes('Aktuell: L-Thyroxin 100 µg, 1 Tablette am Tag, seit 20.09.2026'),
'F15: die Berichtigung heißt so – keine Dosisänderung am 20.09.');
check(r5.includes('15.09.2026: TSH 7,8 mU/l (Labor 0,27–4,2), fT4 12,6 pmol/l (Labor 12–22) – Dosis damals 75 µg am Tag (laut App; später berichtigt, Berichtigung ab 20.09.2026)'),
  'F15: … „Dosis damals" sagt, dass die Menge später als unzutreffend gemeldet wurde');
// (b) Doppelter Eintrag vom Einrichten: 75 µg seit 2019 und noch einmal ab 01.09.2026.
r5 = await r5Bericht(r5Stand({
  profil: { geburtsjahr: 1952, seit: '2026-09-01' },
  dosen: [
    { id: 'd1', ab: '2019-03-01', praeparat: 'L-Thyroxin', mikrogramm: 75, tabletten: 1, notiz: '', praxis: true },
    { id: 'd2', ab: '2026-09-01', praeparat: 'L-Thyroxin', mikrogramm: 75, tabletten: 1, notiz: '', praxis: null },
  ],
  einnahmen: r5Einnahmen('2026-09-01', '2026-09-27'),
  labor: [{ id: 'b2', datum: '2026-09-15', tsh: r5W(5.8, 'mU/l', 0.27, 4.2), ft4: r5W(12.6, 'pmol/l', 12, 22), ...R5_NEIN }],
  nachfragen: [{ id: 'n1', art: 'dosis_stimmt', bezug: 'b2', antwort: 'ja', am: '2026-09-16' }],
}));
check(r5.includes('Aktuell: L-Thyroxin 75 µg, 1 Tablette am Tag, seit 01.03.2019 – auf Anweisung der Praxis: ja') && !r5.includes('Davor: L-Thyroxin 75 µg'),
  'F15: ein doppelter Eintrag ist kein Wechsel – „seit" ist der Beginn des ersten gleichen Eintrags');
check(r5.includes('Seit 01.09.2026 (ab da zählt die App): an 27 von 27 Tagen genommen.'), 'F15: … und die Einnahmen zählen sichtbar ab dem Einrichten, nicht ab einem Neubeginn');

// ---------------------------------------------------------------- F26: mehrzeilige Notizen und Fragen

// Vorher stand jede Folgezeile freistehend im Bericht – eine abgeschriebene
// Wertzeile sah unter LABORWERTE aus wie ein eigener Befund.
r5 = await r5Bericht(r5Stand({
  dosen: [{ id: 'd1', ab: '2021-01-01', praeparat: 'L-Thyroxin', mikrogramm: 100, tabletten: 1, notiz: 'nach Kontrolle\nim März', praxis: true }],
  labor: [
    { id: 'b1', datum: '2026-06-10', tsh: r5W(6.5, 'mU/l', 0.4, 4), ...R5_NEIN },
    { id: 'b2', datum: '2026-09-10', tsh: r5W(2.1, 'mU/l', 0.4, 4), ...R5_NEIN, notiz: 'Hausarzt Dr. B.\n\n12.08.2026: TSH 0,05 mU/l (Labor 0,4–4)\nnüchtern' },
  ],
  befinden: [{ id: 'x1', datum: '2026-09-20', stufe: 'gut', beschwerden: [], notiz: 'gut geschlafen\nEINSCHÄTZUNG DER APP: kein Anlass' }],
  fragen: [{ id: 'f1', text: 'Kann die Müdigkeit an der Dosis liegen?\nSoll ich den Kaffee später trinken?', erledigt: false }],
}));
const f26Labor = r5Abschnitt(r5, 'LABORWERTE');
check(f26Labor.length === 5 && f26Labor[1].endsWith('– Hausarzt Dr. B.') && f26Labor[2] === '    12.08.2026: TSH 0,05 mU/l (Labor 0,4–4)' && f26Labor[3] === '    nüchtern' && f26Labor[4].startsWith('10.06.2026: TSH 6,5'),
  `F26: die Folgezeilen einer Befund-Notiz stehen eingerückt unter ihrem Befund, ohne Leerzeile (${JSON.stringify(f26Labor)})`);
check(!r5.split('\n').some((z) => z.startsWith('12.08.2026') || z.startsWith('EINSCHÄTZUNG DER APP: kein') || z.startsWith('Soll ich')),
  'F26: keine Zeile aus einer Notiz oder Frage steht wie ein eigener Eintrag am Zeilenanfang');
check(r5.includes('– Kann die Müdigkeit an der Dosis liegen?\n  Soll ich den Kaffee später trinken?') && r5.includes('20.09.2026 (gut): gut geschlafen\n    EINSCHÄTZUNG DER APP: kein Anlass')
  && r5.includes('(nach Kontrolle im März)'),
'F26: … die zweite Zeile einer Frage bleibt unter ihrem Strich, die Befinden-Notiz eingerückt, die Dosis-Notiz in einer Zeile');

// ---------------------------------------------------------------- Runde 6: G11 – eine nie genommene Dosis

// (a) 75 µg seit 2024; 100 µg ab 04.06. auf Anweisung der Praxis eingetragen,
// aber nie genommen. Nach „Nein, ich nehme etwas anderes" berichtigt, mit
// Vermerk (statt) und „Gilt ab" auf dem wahren Beginn, wie die Karte rät.
// Vorher stand im Bericht nur „Aktuell: 75 µg seit 14.05.2024" – dass die
// angeordneten 100 µg nie genommen wurden, erfuhr die Ärztin nicht.
const g11Dosen = (dB) => [
  { id: 'd1', ab: '2024-05-14', praeparat: 'L-Thyroxin', mikrogramm: 75, tabletten: 1, notiz: '', praxis: null },
  dB,
  { id: 'dC', ab: '2026-06-04', praeparat: 'L-Thyroxin', mikrogramm: 100, tabletten: 1, notiz: '', praxis: true },
];
const g11Labor = [{ id: 'bB', datum: '2026-08-10', tsh: r5W(6.5, 'mU/l', 0.4, 4), ...R5_NEIN }];
r5 = await r5Bericht(r5Stand({
  dosen: g11Dosen({ id: 'dB', ab: '2024-05-14', praeparat: 'L-Thyroxin', mikrogramm: 75, tabletten: 1, notiz: '', praxis: false, berichtigung: true, statt: 'dC' }),
  labor: g11Labor,
}));
let g11 = r5Abschnitt(r5, 'DOSIS');
check(g11[1] === 'Aktuell: L-Thyroxin 75 µg, 1 Tablette am Tag, seit 14.05.2024'
  && g11.includes('Berichtigung (Angabe): Ab 04.06.2026 war L-Thyroxin 100 µg, 1 Tablette am Tag eingetragen (auf Anweisung der Praxis) – nach Angabe der Patientin nie genommen; stattdessen L-Thyroxin 75 µg, 1 Tablette am Tag.')
  && !r5.includes('Aktuell: L-Thyroxin 100 µg'),
`G11: DOSIS nennt 75 µg seit 2024 und die angeordneten 100 µg ab 04.06. als nie genommen (${JSON.stringify(g11.slice(1, 3))})`);
check(r5.includes('10.08.2026: TSH 6,5 mU/l (Labor 0,4–4) – Dosis damals 75 µg am Tag'), 'G11: … und „Dosis damals" 75 µg, nicht die nie genommenen 100 µg');
// (b) Am selben Tag ersetzt (50 µg seit 2021, 100 µg ab 04.06. angeordnet,
// am selben Tag berichtigt auf 75 µg): Der Satz „Ab diesem Tag war zuerst …
// eingetragen" stand schon in der Aktuell-Zeile; jetzt steht es einmal, als
// „nie genommen" mit Menge und Quelle.
r5 = await r5Bericht(r5Stand({
  dosen: [
    { id: 'd1', ab: '2021-01-01', praeparat: 'L-Thyroxin', mikrogramm: 50, tabletten: 1, notiz: '', praxis: true },
    { id: 'dC', ab: '2026-06-04', praeparat: 'L-Thyroxin', mikrogramm: 100, tabletten: 1, notiz: '', praxis: true },
    { id: 'dB', ab: '2026-06-04', praeparat: 'L-Thyroxin', mikrogramm: 75, tabletten: 1, notiz: '', praxis: false, berichtigung: true },
  ],
  labor: g11Labor,
}));
g11 = r5Abschnitt(r5, 'DOSIS');
check(g11[1] === 'Aktuell: L-Thyroxin 75 µg, 1 Tablette am Tag, seit 04.06.2026 – auf Anweisung der Praxis: nein' && !r5.includes('war zuerst')
  && g11.filter((z) => z.includes('nie genommen')).length === 1 && g11.some((z) => z.startsWith('Berichtigung (Angabe): Ab 04.06.2026 war L-Thyroxin 100 µg') && z.includes('(auf Anweisung der Praxis)')),
`G11: am selben Tag ersetzt – die nie genommenen 100 µg stehen genau einmal da, mit „auf Anweisung der Praxis" (${JSON.stringify(g11.slice(1, 4))})`);

await ende();
