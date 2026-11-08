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
import { oeffne, plus } from './sd-hilfe.mjs';
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
let heuteTag = '2026-08-25';
async function laden(st, tag) {
  heuteTag = tag;
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
/**
 * Karte: „Nein, ich nehme etwas anderes" → „Dosis eintragen" → Menge, „Gilt ab", Praxis Nein.
 * Runde 8: J12 – „Gilt ab" ist bei einer Berichtigung leer (bewusste Wahl nötig);
 * ohne Angabe trägt der Test heute ein, wie es vorher vorbelegt war.
 */
async function berichtigen(mikrogramm, ab = null) {
  await karteOffen();
  await klick('#dosis-karte [data-act="frage-antwort"][data-feld="dosis_stimmt"][data-wert^="nein"]');
  await klick('#dosis-karte [data-act="seite"][data-seite="dosis"]:is([data-param=""], :not([data-param]))');
  await page.fill('form[data-formular="dosis"] input[name=mikrogramm]', String(mikrogramm));
  await page.fill('form[data-formular="dosis"] input[name=ab]', ab || heuteTag);
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

// ================================================================ Runde 8 – Berichtigung, Anordnung der Praxis und das „Nein" der Karte
//
// J12: das Formular nach „Nein" heißt „Dosis berichtigen", „Gilt ab" ist leer.
// J1/H-N3: Berichtigung und Anordnung der Praxis am selben Tag. H-N1/N2-1/N2-2:
// die Anordnung über „Die Praxis hat entschieden" bei offenem „Nein". J9: eine
// vergessene Änderung der Praxis. Jeder Fall scheiterte vor der Korrektur
// (Kopie des Stands 7029062). Heute ist der 27.09.2026 wie in den Nachweisen.
const R8_TAG = '2026-09-27';
const r8Dosis = (id, ab, mikrogramm, mehr = {}) => ({ id, ab, praeparat: 'L-Thyroxin', mikrogramm, tabletten: 1, notiz: '', praxis: null, ...mehr });
// Mit F8 „Noch nicht" vom Folgetag – sonst stellt die Karte zuerst die F8-Frage.
const r8Befund = (id, datum, wert) => ({ id, datum, tsh: { wert, einheit: 'mU/l', von: 0.4, bis: 4 }, ft4: null, ft3: null, ...NEIN, praxis: 'nochnicht', praxisAm: plus(datum, 1) });
const r8Stand = (dosen, labor) => ({ ...stand, profil: { ...R7_PROFIL, seit: '2024-01-01' }, einnahmen: {}, mittel: ['marcumar'], dosen, labor, nachfragen: [] });
const r8Dialog = async (knopf) => { await warte(); await klick(`dialog.rueckfrage [data-act="${knopf}"]`); };
const titel = async () => ((await gibt('#seitentitel')) ? (await page.locator('#seitentitel').innerText()).trim() : '');
const neinSagen = async () => { await karteOffen(); await klick('#dosis-karte [data-act="frage-antwort"][data-feld="dosis_stimmt"][data-wert^="nein"]'); };
const praxisEntschieden = async (wert) => { await karteOffen(); await klick('[data-seite="praxis-entschieden"]'); await klick(`[data-act="praxis-entscheid"][data-wert="${wert}"]`); };
const DOSIS_EINTRAGEN = '#dosis-karte [data-act="seite"][data-seite="dosis"]:is([data-param=""], :not([data-param]))';
const ausfuellen = async (mikrogramm, ab, praxis) => {
  await page.fill('form[data-formular="dosis"] input[name=mikrogramm]', String(mikrogramm));
  if (ab !== null) await page.fill('form[data-formular="dosis"] input[name=ab]', ab);
  if (praxis && await gibt(`form[data-formular="dosis"] input[name=praxis][value=${praxis}]`)) await page.check(`form[data-formular="dosis"] input[name=praxis][value=${praxis}]`, { force: true });
  await page.click('form[data-formular="dosis"] button[type=submit]');
  await warte();
};
const fehlerTexte = () => page.locator('form[data-formular="dosis"] .feld-fehler').allInnerTexts();
const D1_100 = r8Dosis('d1', '2025-08-23', 100, { praxis: true });

// ---- J12, J1, H-N3: „Nein" → Berichtigung 75 µg → „Die Praxis hat entschieden → Neue Dosis" 88 µg.
await laden(r8Stand([D1_100], [r8Befund('b1', '2026-09-17', 6.5)]), R8_TAG);
await neinSagen();
await klick(DOSIS_EINTRAGEN);
check(await titel() === 'Dosis berichtigen' && await page.inputValue('form[data-formular="dosis"] input[name=ab]') === '' && (await text()).includes('was Sie wirklich nehmen') && !(await text()).includes('so wie die Ärztin sie verordnet hat'),
  `Runde 8 J12: nach „Nein" heißt das Formular „Dosis berichtigen", „Gilt ab" ist leer, der Hinweis sagt, was einzutragen ist („${await titel()}")`);
await ausfuellen(75, null, 'nein');
check((await fehlerTexte()).some((x) => x.includes('Bitte ein Datum wählen')), 'Runde 8 J12: ohne „Gilt ab" kommt „Bitte ein Datum wählen."');
await ausfuellen(75, R8_TAG, 'nein');
let s8 = await gespeichert();
const ber8 = s8.dosen.find((d) => d.berichtigung) || {};
check(ber8.mikrogramm === 75 && ber8.statt === 'd1', `Runde 8 J1: Berichtigung 75 µg ab heute statt d1 (${JSON.stringify(s8.dosen.map((d) => [d.mikrogramm, d.berichtigung || false]))})`);
await praxisEntschieden('geaendert');
check(await gibt('form[data-formular="dosis"] input[name="weg"][value="praxis"]'), 'Runde 8 H-N1: das Formular der Praxis trägt das versteckte Feld weg=praxis');
await ausfuellen(88, R8_TAG, 'ja');
let frage8 = await dialogText();
check(frage8.includes('Ab 27.09.2026 ist schon 75 µg am Tag eingetragen') && frage8.includes('Haben Sie bis heute 75 µg am Tag genommen?') && frage8.includes('Ja, bis dahin') && frage8.includes('Nein, das war falsch'),
  `Runde 8 J1: die Anordnung nach einer Berichtigung desselben Tages fragt „bis dahin?", nicht „ersetzen?" („${frage8.slice(0, 160)}")`);
await r8Dialog('befund-korrigieren');
const fehler8 = page.locator('form[data-formular="dosis"] .feld-fehler');
check(await fehler8.count() === 1 && (await fehler8.innerText()).includes('Ab 27.09.2026 ist Ihre Berichtigung eingetragen: 75 µg am Tag') && await fehler8.locator(`[data-seite="dosis"][data-param="${ber8.id}"]`).count() === 1,
  `Runde 8 H-N3: „Nein, das war falsch" ersetzt die Berichtigung nicht – Fehler am Feld mit Knopf „Berichtigung ändern" („${((await fehler8.allInnerTexts())[0] || '').slice(0, 120)}")`);
check((await gespeichert()).dosen.length === 2 && !(await gespeichert()).dosen.some((d) => d.mikrogramm === 88), 'Runde 8 H-N3: nichts gespeichert');
await klick(`form[data-formular="dosis"] .feld-fehler [data-seite="dosis"][data-param="${ber8.id}"]`);
check(await titel() === 'Dosis ändern' && await page.inputValue('form[data-formular="dosis"] input[name=mikrogramm]') === '75', `Runde 8 H-N3: der Knopf öffnet die Berichtigung zum Ändern („${await titel()}")`);
// Derselbe Weg mit „Ja, bis dahin": die 88 µg stehen daneben (nach), die Berichtigung bleibt.
await laden(r8Stand([D1_100], [r8Befund('b1', '2026-09-17', 6.5)]), R8_TAG);
await neinSagen();
await klick(DOSIS_EINTRAGEN);
await ausfuellen(75, R8_TAG, 'nein');
const ber8b = (await gespeichert()).dosen.find((d) => d.berichtigung) || {};
await praxisEntschieden('geaendert');
await ausfuellen(88, R8_TAG, 'ja');
await r8Dialog('befund-bestaetigen');
s8 = await gespeichert();
const neu8 = s8.dosen.find((d) => d.praxis === true && d.mikrogramm === 88) || {};
check(s8.dosen.length === 3 && neu8.nach === ber8b.id && !neu8.berichtigung && !neu8.statt && !neu8.berichtigtAm && s8.dosen.some((d) => d.id === ber8b.id && d.berichtigung && d.statt === 'd1'),
  `Runde 8 J1: „Ja, bis dahin" – die 88 µg stehen daneben (nach), ohne Berichtigungsfelder; die Berichtigung bleibt (${JSON.stringify(s8.dosen.map((d) => [d.mikrogramm, d.praxis, d.berichtigung || false, d.nach || null]))})`);
const z8 = await berichtZeilen();
check(!z8.some((x) => /nach eigener Angabe 88 µg am Tag statt/.test(x)) && z8.some((x) => x.startsWith('Aktuell: L-Thyroxin 88 µg') && x.includes('auf Anweisung der Praxis: ja')),
  `Runde 8 J1: Bericht „Aktuell: 88 µg … auf Anweisung der Praxis: ja", keine „Berichtigung … 88 statt 100" (${z8.filter((x) => /^Aktuell|^Berichtigung/.test(x)).join(' | ')})`);
await page.getByRole('tab', { name: 'Heute' }).click(); await warte();
const h8 = await text();
check(/INR/.test(h8) && !/Sie haben berichtigt/.test(h8), 'Runde 8 J1: „Heute" nennt WW1 (INR unter Marcumar) zur Änderung, nicht „Sie haben berichtigt"');

// ---- H-N1, N2-2: „Nein" → direkt „Die Praxis hat entschieden → Neue Dosis" 88 µg ab heute.
await laden(r8Stand([D1_100], [r8Befund('b1', '2026-09-17', 6.5)]), R8_TAG);
await neinSagen();
await praxisEntschieden('geaendert');
await ausfuellen(88, R8_TAG, 'ja');
frage8 = await dialogText();
check(frage8.includes('Auf der Dosis-Karte hatten Sie angegeben: „Nein, ich nehme etwas anderes"') && frage8.includes('Haben Sie bis heute 100 µg am Tag genommen?') && frage8.includes('Nein, etwas anderes'),
  `Runde 8 H-N1: vor dem Speichern „Haben Sie bis heute 100 µg am Tag genommen?" [Ja] / [Nein, etwas anderes] („${frage8.slice(0, 200)}")`);
await r8Dialog('befund-korrigieren');
s8 = await gespeichert();
const a8 = s8.dosen.find((d) => d.mikrogramm === 88) || {};
const nein8 = s8.nachfragen.find((n) => n.art === 'dosis_stimmt' && /^nein/.test(n.antwort));
check(a8.praxis === true && !a8.berichtigung && !a8.statt && !!nein8 && nein8.anordnung === a8.id,
  `Runde 8 H-N1: die Anordnung ist eine Änderung (keine Berichtigung), das „Nein" wartet mit anordnung (${JSON.stringify({ a: [a8.mikrogramm, a8.berichtigung || false], nein: nein8 && nein8.anordnung })})`);
check(await titel() === 'Dosis eintragen' && (await text()).includes('Ab 27.09.2026 gilt die neue Dosis der Praxis (88 µg am Tag)') && (await text()).includes('Mit „Gilt ab" am 27.09.2026 oder später tragen Sie stattdessen eine neue Dosis ein'),
  `Runde 8 N2-2: danach öffnet sich „Dosis eintragen" für die Zeit davor, mit dem Satz zum Tag der Anordnung („${await titel()}")`);
await ausfuellen(75, '2026-09-01', 'nein');
frage8 = await dialogText();
check(frage8.includes('Hat sich Ihre Dosis am 01.09.2026 geändert, und war sie bis dahin richtig eingetragen?') && frage8.includes('Nein, schon vorher falsch'),
  `Runde 8 J9: beim Eintrag für die Zeit davor die Frage nach einer Änderung am 01.09.2026 („${frage8.slice(0, 160)}")`);
await r8Dialog('befund-korrigieren');
s8 = await gespeichert();
const b8 = s8.dosen.find((d) => d.berichtigung) || {};
check(b8.mikrogramm === 75 && b8.ab === '2026-09-01' && b8.statt === 'd1' && !s8.nachfragen.some((n) => n.art === 'dosis_stimmt' && /^nein/.test(n.antwort)),
  `Runde 8 H-N1: „Nein, schon vorher falsch" – die Berichtigung für die Zeit davor (statt d1), das „Nein" ist erledigt (${JSON.stringify(s8.dosen.map((d) => [d.mikrogramm, d.ab, d.berichtigung || false, d.statt || null]))})`);
const z9 = await berichtZeilen();
check(z9.some((x) => x.startsWith('Aktuell: L-Thyroxin 88 µg')) && z9.some((x) => x.startsWith('Davor: L-Thyroxin 75 µg')) && !z9.some((x) => /nicht so genommen|nach eigener Angabe 88/.test(x)),
  `Runde 8 H-N1: Bericht „Aktuell 88 µg", „Davor 75 µg" (Berichtigung), kein Vorbehalt mehr (${z9.filter((x) => /^Aktuell|^Davor|Angabe/.test(x)).join(' | ')})`);

// ---- N2-1: die Praxis hatte am 24.09. umgestellt – „Ja" erledigt das „Nein".
await laden(r8Stand([D1_100], [r8Befund('b1', '2026-09-17', 6.5)]), R8_TAG);
await neinSagen();
await praxisEntschieden('geaendert');
await ausfuellen(88, '2026-09-24', 'ja');
frage8 = await dialogText();
check(frage8.includes('Haben Sie bis zum 23.09.2026 100 µg am Tag genommen?'), `Runde 8 N2-1: „Gilt ab" 24.09. – „Haben Sie bis zum 23.09.2026 100 µg am Tag genommen?" („${frage8.slice(0, 160)}")`);
await r8Dialog('befund-bestaetigen');
s8 = await gespeichert();
check(s8.dosen.length === 2 && !s8.dosen.some((d) => d.berichtigung) && !s8.nachfragen.some((n) => n.art === 'dosis_stimmt' && /^nein/.test(n.antwort)) && !(await gibt('form[data-formular="dosis"]')),
  `Runde 8 N2-1: „Ja" – gewöhnliche Änderung, das „Nein" ist erledigt, kein Folgeformular (${JSON.stringify(s8.dosen.map((d) => [d.mikrogramm, d.berichtigung || false]))})`);
const z10 = await berichtZeilen();
check(!z10.some((x) => /Angabe der Patientin \(|nicht so genommen|Berichtigung \(Angabe\)/.test(x)) && z10.some((x) => x.startsWith('Aktuell: L-Thyroxin 88 µg') && x.includes('seit 24.09.2026')),
  `Runde 8 N2-1: Bericht ohne Vorbehalt, „Aktuell: 88 µg … seit 24.09.2026" (${z10.filter((x) => /^Aktuell|Angabe der Patientin \(/.test(x)).join(' | ')})`);

// ---- J9: eine vergessene Änderung der Praxis (Februar), nachgetragen nach „Nein".
await laden(r8Stand([r8Dosis('d1', '2024-06-01', 75, { praxis: true })], [r8Befund('b1', '2026-09-17', 6.5)]), R8_TAG);
await neinSagen();
await klick(DOSIS_EINTRAGEN);
await ausfuellen(88, '2026-02-16', 'ja');
frage8 = await dialogText();
check(frage8.includes('Hat sich Ihre Dosis am 16.02.2026 geändert, und war sie bis dahin richtig eingetragen?') && frage8.includes('Ja, am 16.02.2026 geändert') && frage8.includes('Nein, schon vorher falsch'),
  `Runde 8 J9: die Frage „Hat sich Ihre Dosis am 16.02.2026 geändert …?" („${frage8.slice(0, 160)}")`);
await r8Dialog('befund-bestaetigen');
s8 = await gespeichert();
const n9 = s8.dosen.find((d) => d.mikrogramm === 88) || {};
check(n9.praxis === true && !n9.berichtigung && !n9.statt && !s8.nachfragen.some((n) => n.art === 'dosis_stimmt'), `Runde 8 J9: „Ja" – die 88 µg sind eine Änderung, keine Berichtigung; das „Nein" ist weg (${JSON.stringify([n9.mikrogramm, n9.berichtigung || false])})`);
const z11 = await berichtZeilen();
check(z11.some((x) => x.startsWith('Aktuell: L-Thyroxin 88 µg') && x.includes('seit 16.02.2026')) && z11.some((x) => x.startsWith('Davor: L-Thyroxin 75 µg')) && !z11.some((x) => /Berichtigung \(Angabe\)/.test(x)),
  `Runde 8 J9: Bericht „Aktuell 88 µg seit 16.02.2026", „Davor 75 µg", keine „Berichtigung (Angabe)" (${z11.filter((x) => /^Aktuell|^Davor|^Berichtigung/.test(x)).join(' | ')})`);
await o.ende();
