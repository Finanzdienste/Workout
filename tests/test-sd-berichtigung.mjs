/*
 * Schilddrüse: Tag einer älteren Dosis-Berichtigung (Nachprüfung zu Runde 6 – Rest).
 *
 * Eine Berichtigung aus der Zeit vor dem Feld `berichtigtAm` ersetzt am
 * selben Tag einen Eintrag der Praxis (100 µg ab 01.06., berichtigt auf
 * 75 µg). Die Dosis-Karte schätzt ihren Tag auf den ersten TSH-Befund danach
 * (20.08.) und bittet bis 03.09., der Praxis zu sagen, was sie nimmt (X3b).
 * Ändert die Nutzerin am 25.08. nur die Notiz dieses Eintrags, speicherte
 * das Formular den alten „Gilt ab" (01.06.) als Tag – die Bitte verschwand,
 * „Heute" fiel auf „In ein bis zwei Wochen". Jetzt speichert es denselben
 * Ersatztag wie die Karte.
 *
 *     node tests/test-sd-berichtigung.mjs
 */
import { oeffne } from './sd-hilfe.mjs';
const NEIN = { vorAbnahme: 'nein', biotin: 'nein', krank: 'nein', kortison: 'nein', kontrastmittel: 'nein', mittelGeaendert: 'nein', einnahmeGeaendert: 'nein', packung: 'nein', vergessen: 'nein', einnahmeArt: 'ja', abstandOk: 'ja', verwechselt: 'nein', abnahmeUhr: '', tabletteUhr: '', laborName: '', bestaetigt: false, notiz: '' };
const einn = {}; for (let d = new Date('2026-03-01T12:00:00'); d <= new Date('2026-08-24T12:00:00'); d.setDate(d.getDate() + 1)) einn[d.toISOString().slice(0, 10)] = { uhr: '07:00' };
const stand = {
  version: 2,
  profil: { name: '', begruesst: true, behandelt: true, seit: '2025-01-01', geburtsjahr: 1966, ursache: 'hashimoto', krebs: 'nein', praeparatArt: 't4', herz: 'nein', osteoporose: 'nein', kortison: 'nein', diabetes: 'nein', schwanger: '', zielNiedrig: 'nein', hypophyseOderNiedrig: 'nein', bundesland: 'BY', mittelErfasst: true, kaffee30: true },
  mittel: [], mittelAbstand: {}, mittelWechsel: [], uhrWechsel: [], einnahmen: einn, befinden: [], warnzeichen: [], gewicht: [], termine: [], fragen: [],
  einstellungen: { erinnerung: '07:00', schrift: 'normal', farbe: 'hell', hinweisTablette: false }, letzteSicherung: '2026-08-24',
  dosen: [
    { id: 'd0', ab: '2025-01-01', praeparat: 'L-Thyroxin', mikrogramm: 75, tabletten: 1, notiz: '', praxis: null },
    { id: 'dC', ab: '2026-06-01', praeparat: 'L-Thyroxin', mikrogramm: 100, tabletten: 1, notiz: '', praxis: true },
    { id: 'dB', ab: '2026-06-01', praeparat: 'L-Thyroxin', mikrogramm: 75, tabletten: 1, notiz: '', praxis: false, berichtigung: true },
  ],
  labor: [
    { id: 'b1', datum: '2026-05-10', tsh: { wert: 5.5, einheit: 'mU/l', von: 0.4, bis: 4 }, ft4: null, ft3: null, ...NEIN, praxis: 'geaendert', praxisAm: '2026-05-28' },
    { id: 'b2', datum: '2026-08-20', tsh: { wert: 5.8, einheit: 'mU/l', von: 0.4, bis: 4 }, ft4: null, ft3: null, ...NEIN, praxis: 'nochnicht', praxisAm: '2026-08-21' },
  ],
  nachfragen: [{ id: 'n1', art: 'dosis_stimmt', bezug: 'b1', antwort: 'ja', am: '2026-05-11' }, { id: 'n2', art: 'dosis_stimmt', bezug: 'b2', antwort: 'ja', am: '2026-08-23' }],
};
const o = await oeffne({ tag: '2026-08-25', zeit: '09:30', stand });
const { page, check, gespeichert } = o;
const warte = () => page.waitForTimeout(700);
const text = async () => (await page.locator('#ansicht').innerText()).replace(/\n+/g, ' | ');
const zurKarte = async () => {
  await page.getByRole('tab', { name: 'Mehr' }).click(); await warte();
  await page.locator('[data-seite=dosis-karte]').first().click(); await warte();
};
await warte();
const h0 = await text();
await zurKarte();
const k0 = await text();
check(/Sie haben berichtigt/.test(h0) && /In den nächsten Tagen anrufen/.test(k0), 'vorher: X3b auf „Heute", Karte „In den nächsten Tagen anrufen"');
// Nur die Notiz des Eintrags dB ändern
await page.getByRole('tab', { name: 'Verlauf' }).click(); await warte();
await page.locator('[data-seite="dosis-liste"]').first().click(); await warte();
await page.locator('#ansicht [data-seite="dosis"][data-param="dB"]').first().click(); await warte();
await page.locator('[name="notiz"]').fill('Rezept vom Hausarzt');
await page.locator('form[data-formular="dosis"] button[type="submit"]').click(); await warte();
const dlg = page.locator('dialog[open]');
check(await dlg.count() === 0, 'beim Ändern der Notiz keine Rückfrage');
const s = await gespeichert();
const dB = s.dosen.find((d) => d.id === 'dB');
check(dB.berichtigtAm === '2026-08-20' && dB.notiz === 'Rezept vom Hausarzt', `gespeichert wird derselbe Tag wie auf der Karte (${dB.berichtigtAm})`);
await page.getByRole('tab', { name: 'Heute' }).click(); await warte();
const h1 = await text();
await zurKarte();
const k1 = await text();
check(/Sie haben berichtigt/.test(h1), 'nach der Notiz-Änderung: X3b bleibt auf „Heute"');
check(/In den nächsten Tagen anrufen/.test(k1), 'nach der Notiz-Änderung: Karte bleibt „In den nächsten Tagen anrufen"');

// ================================================================ Runde 7 – Berichtigung auf der Karte, so wie die Nutzerin sie bedient
//
// H1: das ungefähre „Gilt ab" vor einer genommenen Menge; H7: eine zweite
// Berichtigung. Jeder Fall scheiterte vor der Korrektur.

const R7_PROFIL = { ...stand.profil, geburtsjahr: 1950, seit: '2019-01-01' };
/** Einen Stand mit fester Uhr laden und neu öffnen. */
async function laden(st, tag) {
  await page.waitForTimeout(250);
  await page.evaluate(({ key, s: roh, t }) => {
    localStorage.setItem(key, JSON.stringify(roh));
    localStorage.setItem('__testtag', t);
  }, { key: 'schilddruese.stand.v1', s: st, t: tag });
  await page.reload({ waitUntil: 'networkidle' });
  await warte();
}
const gibt = async (sel) => (await page.locator(sel).count()) > 0;
// Vor der Korrektur fehlt manches – der Test soll dann scheitern, nicht hängen.
const klick = async (sel) => { if (await gibt(sel)) { await page.click(sel); await warte(); } };
const dialogText = async () => ((await gibt('dialog.rueckfrage')) ? (await page.locator('dialog.rueckfrage').innerText()).replace(/\s+/g, ' ') : '');
const karteOffen = async () => { if (!(await gibt('#dosis-karte'))) await zurKarte(); };
/** Karte: „Nein, ich nehme etwas anderes" → „Dosis eintragen" → Menge, „Gilt ab", Praxis Nein. */
async function berichtigen(mikrogramm, ab = null) {
  await karteOffen();
  await klick('#dosis-karte [data-act="frage-antwort"][data-feld="dosis_stimmt"][data-wert^="nein"]');
  await klick('#dosis-karte [data-act="seite"][data-seite="dosis"]:is([data-param=""], :not([data-param]))');
  await page.fill('form[data-formular="dosis"] input[name=mikrogramm]', String(mikrogramm));
  if (ab) await page.fill('form[data-formular="dosis"] input[name=ab]', ab);
  await page.check('form[data-formular="dosis"] input[name=praxis][value=nein]', { force: true });
  await page.click('form[data-formular="dosis"] button[type=submit]');
  await warte();
}
/** Karte: „Dosis ändern" beim Eintrag `id` → neues „Gilt ab". */
async function giltAb(id, ab) {
  await karteOffen();
  await klick(`#dosis-karte [data-act="seite"][data-seite="dosis"][data-param="${id}"]`);
  await page.fill('form[data-formular="dosis"] input[name=ab]', ab);
  await page.click('form[data-formular="dosis"] button[type=submit]');
  await warte();
}
const berichtZeilen = async () => {
  await page.getByRole('tab', { name: 'Mehr' }).click(); await warte();
  await klick('#ansicht [data-seite="bericht"]');
  return (await page.locator('#berichtText').innerText()).split('\n');
};

// ---------------------------------------------------------------- H1: „ungefähr" vor die 75 µg der Praxis
//
// 50 µg seit 2019, 75 µg ab 14.05.2024 (Praxis), 100 µg ab 04.06.2026
// (Praxis, nie genommen). Nach „Nein" 75 µg eingetragen, dann wie geraten
// „Gilt ab" ungefähr auf 01.01.2024. Vorher ohne Rückfrage: Die 75 µg der
// Praxis hießen „nie genommen; stattdessen 75 µg", beim Befund vom März
// stand „Dosis damals 75 µg", die Anordnung der Praxis war weg.
const H1_TAG = '2026-08-12';
const h1Stand = {
  ...stand,
  profil: R7_PROFIL,
  einnahmen: {},
  dosen: [
    { id: 'd0', ab: '2019-01-01', praeparat: 'L-Thyroxin', mikrogramm: 50, tabletten: 1, notiz: '', praxis: null },
    { id: 'd1', ab: '2024-05-14', praeparat: 'L-Thyroxin', mikrogramm: 75, tabletten: 1, notiz: '', praxis: true },
    { id: 'dC', ab: '2026-06-04', praeparat: 'L-Thyroxin', mikrogramm: 100, tabletten: 1, notiz: '', praxis: true },
  ],
  labor: [
    { id: 'b0', datum: '2024-03-01', tsh: { wert: 5.5, einheit: 'mU/l', von: 0.4, bis: 4 }, ft4: null, ft3: null, ...NEIN, praxis: 'geaendert', praxisAm: '2024-05-10' },
    { id: 'bA', datum: '2026-05-13', tsh: { wert: 9, einheit: 'mU/l', von: 0.4, bis: 4 }, ft4: null, ft3: null, ...NEIN, praxis: 'geaendert', praxisAm: '2026-06-04' },
    { id: 'bB', datum: '2026-08-10', tsh: { wert: 6.5, einheit: 'mU/l', von: 0.4, bis: 4 }, ft4: null, ft3: null, ...NEIN, praxis: 'nochnicht', praxisAm: '2026-08-11' },
  ],
  nachfragen: [{ id: 'n1', art: 'dosis_stimmt', bezug: 'bA', antwort: 'ja', am: '2026-05-14' }],
};
for (const [antwort, knopf, erwartet] of [['Ja', 'befund-bestaetigen', '2024-05-14'], ['Nein, schon früher', 'befund-korrigieren', '2024-01-01']]) {
  await laden(h1Stand, H1_TAG);
  await berichtigen(75);
  const neu = (await gespeichert()).dosen.find((d) => d.berichtigung) || {};
  await giltAb(neu.id, '2024-01-01');
  const frage = await dialogText();
  check(frage.includes('Ab 14.05.2024 ist schon 75 µg am Tag eingetragen (auf Anweisung der Praxis)') && frage.includes('Nehmen Sie diese Menge seit dem 14.05.2024?')
    && frage.includes('Ja, seit dem 14.05.2024') && frage.includes('Nein, schon früher'),
  `H1 (${antwort}): „Gilt ab" 01.01.2024 vor den 75 µg der Praxis – die Rückfrage nennt den genaueren Eintrag („${frage.slice(0, 120)}")`);
  await klick(`dialog.rueckfrage [data-act="${knopf}"]`);
  const nach = (await gespeichert()).dosen.find((d) => d.id === neu.id) || {};
  check(!(await gibt('dialog.rueckfrage')) && nach.ab === erwartet && nach.statt === 'dC',
    `H1 (${antwort}): gespeichert mit „Gilt ab" ${erwartet}, ohne weitere Rückfrage (${JSON.stringify({ ab: nach.ab, statt: nach.statt })})`);
  const z = await berichtZeilen();
  check(!z.some((x) => x.startsWith('Berichtigung (Angabe): Ab 14.05.2024')) && z.some((x) => x.startsWith('Berichtigung (Angabe): Ab 04.06.2026 war L-Thyroxin 100 µg')),
    `H1 (${antwort}): im Bericht sind nur die 100 µg nie genommen, nicht die 75 µg der Praxis (${z.filter((x) => x.startsWith('Berichtigung')).join(' | ')})`);
  if (erwartet === '2024-05-14') {
    check(z.includes('Aktuell: L-Thyroxin 75 µg, 1 Tablette am Tag, seit 14.05.2024 – auf Anweisung der Praxis: ja')
      && z.some((x) => x.startsWith('01.03.2024: TSH 5,5') && x.includes('Dosis damals 50 µg')),
    `H1 (Ja): „Aktuell … seit 14.05.2024 – auf Anweisung der Praxis: ja", beim Befund vom März „Dosis damals 50 µg" (${z.filter((x) => /^Aktuell|^01\.03\.2024/.test(x)).join(' | ')})`);
  }
  await page.getByRole('tab', { name: 'Verlauf' }).click(); await warte();
  await klick('#ansicht [data-seite="dosis-liste"]');
  const zeile = (await gibt('#ansicht [data-seite="dosis"][data-param="d1"]')) ? await page.locator('#ansicht [data-seite="dosis"][data-param="d1"]').innerText() : '';
  check(zeile.includes('75 µg') && !zeile.includes('nie genommen'), `H1 (${antwort}): in „Dosis im Verlauf" sind die 75 µg der Praxis nicht „nie genommen" („${zeile.replace(/\s+/g, ' ')}")`);
}

// ---------------------------------------------------------------- H7: eine zweite Berichtigung
//
// 125 µg seit 24.12.2025, TSH 0,15. „Nein" → 175 µg, „Gilt ab" 01.06.2025.
// Die Karte fragt „genau 175 µg?" → „Nein" (Tippfehler) → „Dosis eintragen"
// 150 µg ab 01.06.2025. Vorher verschluckte die erste Berichtigung die
// zweite: „Die 150 µg … zählen jetzt als nie genommen", „Heute" nannte
// 175 µg, die Karte fragte wieder „genau 175 µg?" – eine Schleife.
const H7_TAG = '2026-09-28';
await laden({
  ...stand,
  profil: { ...R7_PROFIL, seit: '2025-12-24' },
  einnahmen: {},
  dosen: [{ id: 'd1', ab: '2025-12-24', praeparat: 'L-Thyroxin', mikrogramm: 125, tabletten: 1, notiz: '', praxis: null }],
  labor: [{ id: 'b1', datum: '2026-09-22', tsh: { wert: 0.15, einheit: 'mU/l', von: 0.4, bis: 4 }, ft4: null, ft3: null, ...NEIN, praxis: 'nochnicht', praxisAm: '2026-09-22' }],
  nachfragen: [],
}, H7_TAG);
await berichtigen(175);
const b1 = (await gespeichert()).dosen.find((d) => d.berichtigung) || {};
await giltAb(b1.id, '2025-06-01');
await berichtigen(150, '2025-06-01');
const meldung7 = await page.locator('#meldung').innerText();
const s7 = await gespeichert();
const b2 = s7.dosen.find((d) => d.berichtigung && d.statt === b1.id) || {};
check(b2.mikrogramm === 150 && !/150 µg am Tag ab 01\.06\.2025 zählen jetzt als nie genommen/.test(meldung7) && /175 µg am Tag ab 01\.06\.2025 zählen jetzt als nie genommen/.test(meldung7),
  `H7: die Meldung nennt die erste Berichtigung (175 µg) als nie genommen, nicht die eben eingetragenen 150 µg („${meldung7}")`);
await page.getByRole('tab', { name: 'Heute' }).click(); await warte();
const heute7 = await text();
check(heute7.includes('L-Thyroxin 150 µg') && !heute7.includes('L-Thyroxin 175 µg'), `H7: „Heute" nennt die eingetragenen 150 µg (${(heute7.match(/L-Thyroxin \d+ µg/) || [''])[0]})`);
await zurKarte();
const karte7 = await text();
check(!karte7.includes('genau 175 µg') && karte7.includes('150 µg'), 'H7: die Karte fragt nicht wieder nach den als falsch gemeldeten 175 µg');
const z7 = await berichtZeilen();
check(z7.some((x) => x.startsWith('Aktuell: L-Thyroxin 150 µg')) && z7.some((x) => x.startsWith('22.09.2026: TSH 0,15') && x.includes('Dosis damals 150 µg'))
  && z7.some((x) => x.startsWith('Berichtigung (Angabe): Ab 01.06.2025 war L-Thyroxin 175 µg') && x.includes('stattdessen L-Thyroxin 150 µg')),
`H7: der Bericht nennt 150 µg als aktuelle Dosis und die 175 µg als nie genommen (${z7.filter((x) => /^Aktuell|^Berichtigung|^22\.09/.test(x)).join(' | ')})`);
await o.ende();
