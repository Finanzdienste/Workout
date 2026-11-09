/*
 * Schilddrüse: Laborwerte eintragen und ansehen.
 *
 * Der Bereich kommt vom Befund, nicht aus der App – jedes Labor hat eigene
 * Grenzen. Geprüft wird das Abschreiben (Komma, einseitiger Bereich,
 * Tippfehler), die Zuordnung zur damals gültigen Dosis und, was ohne
 * bestätigte Behandlung (P6) nicht passieren darf: ein Muster oder eine
 * Dringlichkeit. Die Lage zum Bereich steht in Worten da („über dem
 * Bereich", mit der Quelle des Bereichs) – nie „zu hoch", nie eine Ampel
 * ohne Worte. Die Einschätzung mit bestätigter Behandlung prüft
 * tests/test-sd-einschaetzung-ui.mjs.
 */
import { oeffne, standMit, plus, kurz, ansichtText, SCHLUESSEL } from './sd-hilfe.mjs';

const TAG = '2026-03-10';
const stand = standMit(plus(TAG, -100), {
  dosen: [
    { id: 'd1', ab: plus(TAG, -100), praeparat: 'L-Thyroxin', mikrogramm: 50, tabletten: 1, notiz: '' },
    { id: 'd2', ab: plus(TAG, -30), praeparat: 'L-Thyroxin', mikrogramm: 75, tabletten: 1, notiz: '' },
  ],
});
const { page, check, uhr, gespeichert, dialoge, ende } = await oeffne({ tag: TAG, stand });

const fehlerTexte = () => page.locator('.feld-fehler').allInnerTexts();
const neu = async () => {
  await page.click('#reiter-verlauf');
  await page.click('#ansicht [data-seite="labor"]');
};

check((await (async () => { await page.click('#reiter-verlauf'); return ansichtText(page); })()).includes('Noch keine Laborwerte'), 'ohne Werte: ein Satz, was einzutragen ist');

// Fehleingaben – die Eingaben bleiben stehen.
await neu();
await page.click('button[type=submit]');
check((await fehlerTexte()).some((t) => t.includes('mindestens einen Wert')), 'ganz leer: „mindestens einen Wert"');
await page.fill('input[name=tsh_wert]', 'zwei');
await page.click('button[type=submit]');
check((await fehlerTexte()).some((t) => t.includes('TSH') && t.includes('Zahl')), 'Text statt Zahl wird am Feld gemeldet');
check(await page.inputValue('input[name=tsh_wert]') === 'zwei', '… und die Eingabe bleibt stehen');
await page.fill('input[name=tsh_wert]', '2,1');
await page.fill('input[name=tsh_von]', '4');
await page.fill('input[name=tsh_bis]', '0,4');
await page.click('button[type=submit]');
check((await fehlerTexte()).some((t) => t.includes('kleiner')), 'vertauschte Grenzen werden bemerkt');
await page.fill('input[name=datum]', plus(TAG, 3));
await page.fill('input[name=tsh_von]', '0,4');
await page.fill('input[name=tsh_bis]', '4,0');
await page.click('button[type=submit]');
check((await fehlerTexte()).some((t) => t.includes('Zukunft')), 'eine Blutabnahme in der Zukunft wird abgelehnt');

// Richtig eingetragen, mit Komma.
await page.fill('input[name=datum]', TAG);
await page.fill('input[name=ft4_wert]', '15.2');
await page.click('button[type=submit]');
let s = await gespeichert();
check(s.labor.length === 1, 'ein Befund gespeichert');
const l = s.labor[0];
check(l.tsh.wert === 2.1 && l.tsh.von === 0.4 && l.tsh.bis === 4 && l.tsh.einheit === 'mU/l', `TSH 2,1 mU/l, Bereich 0,4–4,0 – Komma als Dezimalzeichen (${JSON.stringify(l.tsh)})`);
check(l.ft4.wert === 15.2 && l.ft4.von === null, 'fT4 mit Punkt geschrieben, ohne Bereich: erlaubt');
check(l.ft3 === null, 'fT3 nicht bestimmt: bleibt leer');

let text = await ansichtText(page);
check(text.includes('2,1 mU/l') && text.includes('Bereich Ihres Labors 0,4–4'), 'die Liste zeigt Wert und Bereich des Labors');
check(text.includes('im Bereich') && text.includes('übliche Orientierung, nicht Ihr Labor'), 'je Wert die Lage in Worten – fT4 ohne Bereich ausdrücklich gegen die übliche Orientierung');
check(text.includes('Dosis damals 75 µg'), 'daneben die Dosis, die am Tag der Abnahme galt');

// Ein älterer Befund: andere Dosis damals, sortiert.
await neu();
check(await page.inputValue('input[name=tsh_von]') === '' && (await page.getAttribute('input[name=tsh_von]', 'placeholder')) === 'z. B. 0,4',
  'der Bereich wird nicht still vom letzten Befund übernommen – er steht nur als Platzhalter da');
check(await page.inputValue('select[name=tsh_einheit]') === 'mU/l', 'die Einheit ist vom letzten Befund vorbelegt und sichtbar');
await page.fill('input[name=datum]', plus(TAG, -60));
await page.fill('input[name=tsh_wert]', '6,3');
await page.click('button[type=submit]');
s = await gespeichert();
check(s.labor.map((x) => x.datum).join() === [plus(TAG, -60), TAG].join(), 'Befunde nach Datum sortiert gespeichert');
text = await ansichtText(page);
check(text.indexOf(kurz(TAG)) < text.indexOf(kurz(plus(TAG, -60))), 'in der Liste steht der neueste oben');
check(text.includes('Dosis damals 50 µg'), 'beim älteren Befund steht die damalige Dosis (50 µg)');

// Ohne bestätigte Behandlung (P6): die Lage in Worten, aber kein Muster und
// keine Dringlichkeit – auch nicht bei einem Wert weit über dem Bereich.
await page.click('#reiter-verlauf');
text = await ansichtText(page);
check(text.includes('über dem Bereich'), 'TSH 6,3 ohne Bereich: „über dem Bereich" (übliche Orientierung) in Worten');
check(!/zu hoch|zu niedrig|erhöht|erniedrigt|auffällig|schlecht eingestellt/i.test(text), 'kein „zu hoch", kein „erhöht" – die Lage steht nur als Lage da');
check(!(await page.locator('#ansicht .einschaetzung').count()) && (await page.locator('#ansicht #p6').count()) === 1, 'ohne bestätigte Behandlung kein Muster, keine Frist – stattdessen die P6-Karte zum Einschalten');
check(await page.locator('.verlauf-svg').count() === 1, 'ab zwei TSH-Werten gibt es eine Verlaufslinie');
const label = await page.locator('.verlauf-svg').getAttribute('aria-label');
check(label.includes('6,3') && label.includes('2,1'), 'die Linie ist für Vorleseprogramme als Zahlenreihe beschriftet');
check(await page.locator('.verlauf-bereich').count() === 1, 'der Bereich des Labors liegt als Streifen dahinter');

// Ändern und löschen.
await page.click('[data-seite="labor-liste"]');
await page.locator('[data-seite="labor"][data-param]').first().click();
await page.fill('input[name=tsh_wert]', '2,3');
await page.click('button[type=submit]');
s = await gespeichert();
check(s.labor.length === 2 && s.labor[1].tsh.wert === 2.3, 'Ändern ersetzt den Wert, statt einen dritten Befund anzulegen');
await page.locator('[data-seite="labor"][data-param]').last().click();
await page.click('[data-act="loeschen"]');
s = await gespeichert();
check(s.labor.length === 1 && s.labor[0].datum === TAG, 'Löschen entfernt genau diesen Befund');


// Eine Einheit, die das Menü nicht kennt, geht beim Ändern nicht verloren.
await uhr(TAG);
await page.evaluate((key) => {
  const st = JSON.parse(localStorage.getItem(key));
  st.labor[0].ft4.einheit = 'ng/dL';
  localStorage.setItem(key, JSON.stringify(st));
}, 'schilddruese.stand.v1');
await uhr(TAG);
await page.click('#reiter-verlauf');
await page.click('[data-seite="labor-liste"]');
await page.locator('[data-seite="labor"][data-param]').first().click();
check(await page.inputValue('select[name=ft4_einheit]') === 'ng/dL', 'eine abweichend geschriebene Einheit steht beim Ändern zur Auswahl');

// Ein einseitiger Bereich („< 116") ist erlaubt – so, wie er auf dem Befund steht.
await uhr(TAG);
await neu();
await page.fill('input[name=datum]', plus(TAG, -1));
await page.fill('input[name=tsh_wert]', '2,5');
await page.fill('input[name=tsh_bis]', '4,2');
await page.click('button[type=submit]');
// Gewollt geändert (Durchsicht B51, RW2 L3): Beim TSH fragt die App nach,
// ob der Befund wirklich nur eine Grenze nennt – meist ist die zweite beim
// Abschreiben weggefallen. Bestätigt, wird gespeichert wie bisher.
check((await page.locator('dialog.rueckfrage').innerText()).includes('nur eine Grenze'), 'TSH mit nur einer Grenze: erst eine Rückfrage');
await page.click('dialog.rueckfrage [data-act="befund-bestaetigen"]');
s = await gespeichert();
const einseitig = s.labor.find((x) => x.datum === plus(TAG, -1));
check(einseitig && einseitig.tsh.von === null && einseitig.tsh.bis === 4.2, `nur die obere Grenze eingetragen: gespeichert (${JSON.stringify(einseitig && einseitig.tsh)})`);
check((await ansichtText(page)).includes('bis 4,2 mU/l'), '… und so angezeigt: „bis 4,2 mU/l"');

// ---- Runde 8: K14 – der Befund in zwei Schritten (TSH 2,1 vom Telefon, später
// der Brief mit TSH 2,15, fT4 und den Bereichen). Vorher führte der Knopf
// „Befund … öffnen" im Fehler über „Ihre Eingaben sind noch nicht gespeichert.
// Verwerfen …?" zum alten Befund mit den alten Werten – alles Eingetippte war
// weg, und der Fehler nannte nicht einmal die beiden Werte. Jetzt eine
// Rückfrage mit beiden Werten; „Ja, der neue Wert gilt" speichert alles
// zusammen, „Nein" führt zurück ins Formular – die Eingaben bleiben stehen.
const K14 = plus(TAG, -3);
await page.evaluate(({ key, st }) => localStorage.setItem(key, JSON.stringify(st)), {
  key: SCHLUESSEL,
  st: standMit(plus(TAG, -100), { labor: [{ id: 'k1', datum: K14, tsh: { wert: 2.1, einheit: 'mU/l', von: null, bis: null }, ft4: null, ft3: null, notiz: '' }] }),
});
await uhr(TAG);
const k14Brief = async () => {
  await neu();
  await page.fill('input[name=datum]', K14);
  await page.fill('input[name=tsh_wert]', '2,15');
  await page.fill('input[name=tsh_von]', '0,27');
  await page.fill('input[name=tsh_bis]', '4,2');
  await page.fill('input[name=ft4_wert]', '15,2');
  await page.fill('input[name=ft4_von]', '12');
  await page.fill('input[name=ft4_bis]', '22');
  await page.click('button[type=submit]');
  await page.waitForTimeout(300);
};
const k14Dialog = async () => ((await page.locator('dialog.rueckfrage').count()) ? (await page.locator('dialog.rueckfrage').innerText()).replace(/\s+/g, ' ') : '');
await k14Brief();
let k14Text = await k14Dialog();
check(k14Text.includes('TSH: bisher 2,1 mU/l, jetzt 2,15 mU/l') && k14Text.includes('Soll der neue Wert gelten?') && k14Text.includes('Ja, der neue Wert gilt') && k14Text.includes('Nein, zurück zum Formular'),
  `K14: eine Rückfrage mit beiden Werten statt eines Fehlers mit Seitenwechsel („${k14Text.slice(0, 180)}")`);
await page.waitForTimeout(700);
await page.click('dialog.rueckfrage [data-act="befund-korrigieren"]');
await page.waitForTimeout(300);
check(await page.inputValue('input[name=tsh_wert]') === '2,15' && await page.inputValue('input[name=ft4_wert]') === '15,2' && (await gespeichert()).labor.length === 1 && (await gespeichert()).labor[0].tsh.wert === 2.1,
  'K14: „Nein, zurück zum Formular" – die Eingaben stehen noch da, gespeichert ist nichts');
const k14Dialoge = dialoge.length;
await page.click('button[type=submit]');
await page.waitForTimeout(1000);
await page.click('dialog.rueckfrage [data-act="befund-bestaetigen"]');
await page.waitForTimeout(300);
check(!dialoge.slice(k14Dialoge).some((t) => t.includes('Verwerfen')), 'K14: kein „Ihre Eingaben sind noch nicht gespeichert. Verwerfen …?" auf dem Weg');
s = await gespeichert();
const k14b = s.labor.find((l) => l.datum === K14);
check(s.labor.length === 1 && !!k14b && k14b.id === 'k1' && k14b.tsh.wert === 2.15 && k14b.tsh.von === 0.27 && k14b.tsh.bis === 4.2 && !!k14b.ft4 && k14b.ft4.wert === 15.2,
  `K14: „Ja, der neue Wert gilt" – ein Befund mit TSH 2,15 (0,27–4,2) und fT4 15,2, nichts verloren (${JSON.stringify(k14b && [k14b.tsh, k14b.ft4 && k14b.ft4.wert])})`);
check((await ansichtText(page)).includes('2,15 mU/l'), 'K14: die Liste zeigt den neuen Wert');

// ---- Runde 8: J7, J7b – eine Entscheidung der Praxis über das Befund-Formular
// zählt nach einer eigenen Änderung (Vermerk PRAXIS_DANACH wie über „Die Praxis
// hat entschieden"). Steht die Angabe unverändert vorbelegt da (das „bleibt"
// vom 29.04., vor der eigenen Änderung vom 04.05.), fragt das Formular, ob die
// Praxis das danach gesagt hat – beide Antworten speichern.
const J7 = '2026-05-04';
const J7_FRAGEN = { abnahmeUhr: '', vorAbnahme: 'nein', biotin: 'nein', krank: 'nein', kortison: 'nein', kontrastmittel: 'nein', mittelGeaendert: 'nein', einnahmeGeaendert: 'nein', packung: 'nein', vergessen: 'nein', einnahmeArt: 'ja', abstandOk: 'ja', verwechselt: 'nein', tabletteUhr: '', laborName: '', bestaetigt: false, notiz: '' };
const j7Stand = () => standMit('2025-01-01', {
  version: 4,
  profil: { name: '', begruesst: true, behandelt: true, seit: '2024-01-01', geburtsjahr: 1950, ursache: 'hashimoto', krebs: 'nein', praeparatArt: 't4', herz: 'nein', osteoporose: 'nein', kortison: 'nein', diabetes: 'nein', schwanger: '', zielNiedrig: 'nein', hypophyseOderNiedrig: 'nein', bundesland: 'BY', mittelErfasst: true, kaffee30: true, einfuehrung: 1, einfuehrungDaten: true },
  dosen: [
    { id: 'd1', ab: '2025-01-01', praeparat: 'L-Thyroxin', mikrogramm: 75, tabletten: 1, notiz: '', praxis: true },
    { id: 'e1', ab: J7, praeparat: 'L-Thyroxin', mikrogramm: 100, tabletten: 1, notiz: '', praxis: false, eingetragenAm: J7 },
  ],
  labor: [{ id: 'j1', datum: '2026-04-27', tsh: { wert: 5.5, einheit: 'mU/l', von: 0.4, bis: 4 }, ft4: null, ft3: null, ...J7_FRAGEN, praxis: 'bleibt', praxisAm: '2026-04-29' }],
  nachfragen: [],
});
const j7Oeffnen = async () => {
  await page.click('#reiter-verlauf');
  await page.click('[data-seite="labor-liste"]');
  await page.locator('[data-seite="labor"][data-param="j1"]').first().click();
  await page.waitForTimeout(300);
};
await page.evaluate(({ key, st }) => localStorage.setItem(key, JSON.stringify(st)), { key: SCHLUESSEL, st: j7Stand() });
await uhr(J7, '12:00');
await page.click('#reiter-heute');
check(await page.locator('#ansicht [data-regel="X3"], #ansicht [data-regel="B2"]').count() >= 1, 'J7b Vorbedingung: nach der eigenen Erhöhung wartet „Heute" auf die Praxis (X3/B2)');
await j7Oeffnen();
check(await page.isChecked('form[data-formular="labor"] input[name=praxis][value=bleibt]'), 'J7b Vorbedingung: im Befund-Formular ist „Die Dosis bleibt so" vom 29.04. vorbelegt');
await page.click('form[data-formular="labor"] button[type=submit]');
await page.waitForTimeout(300);
const j7Text = await k14Dialog();
check(j7Text.includes('Beim Befund vom 27.04.2026 steht: „Die Dosis bleibt so" – angegeben am 29.04.2026.') && j7Text.includes('Hat die Praxis das nach Ihrer eigenen Änderung vom 04.05.2026 gesagt?') && j7Text.includes('Ja, danach') && j7Text.includes('Nein, das war vorher'),
  `J7b: das unveränderte „bleibt" fragt, ob die Praxis das nach der eigenen Änderung gesagt hat („${j7Text.slice(0, 200)}")`);
await page.waitForTimeout(700);
await page.click('dialog.rueckfrage [data-act="befund-korrigieren"]');
await page.waitForTimeout(400);
s = await gespeichert();
// Runde 8 – Nachbesserung (D): die Antwort „Nein" steht als Vermerk mit Antwort „nein" da – kein Vermerk „ja" (nur der zählt).
check(s.labor[0].praxisAm === '2026-04-29' && !(s.nachfragen || []).some((n) => n.art === 'praxis_danach' && n.antwort === 'ja') && await page.locator('form[data-formular="labor"]').count() === 0,
  `J7b: „Nein, das war vorher" speichert ohne neues Datum (${s.labor[0].praxisAm}), kein Vermerk „ja"`);
await page.click('#reiter-heute');
check(await page.locator('#ansicht [data-regel="X3"], #ansicht [data-regel="B2"]').count() >= 1, 'J7b: … und „Heute" wartet weiter auf die Praxis');
// Runde 8 – Nachbesserung (D): nach „Nein" käme die Frage nicht mehr – für „Ja, danach" also frisch beginnen.
await page.evaluate(({ key, st }) => localStorage.setItem(key, JSON.stringify(st)), { key: SCHLUESSEL, st: j7Stand() });
await uhr(J7, '12:00');
await j7Oeffnen();
await page.click('form[data-formular="labor"] button[type=submit]');
await page.waitForTimeout(1000);
await page.click('dialog.rueckfrage [data-act="befund-bestaetigen"]');
await page.waitForTimeout(400);
s = await gespeichert();
check(s.labor[0].praxisAm === J7 && (s.nachfragen || []).some((n) => n.art === 'praxis_danach' && n.bezug === 'j1' && n.am === J7),
  `J7/J7b: „Ja, danach" – Datum heute und Vermerk PRAXIS_DANACH wie über „Die Praxis hat entschieden" (${s.labor[0].praxisAm}, ${JSON.stringify((s.nachfragen || []).map((n) => n.art))})`);
await page.click('#reiter-heute');
check(await page.locator('#ansicht [data-regel="X3"], #ansicht [data-regel="B2"]').count() === 0, 'J7: danach wartet „Heute" nicht mehr auf die Praxis');

// ---- Runde 8 – Nachbesserung C: Eine Praxis-Angabe zu einem ÄLTEREN Befund
// (von vor der eigenen Änderung) ist keine Entscheidung danach. Vorher schrieb
// das Formular auch an den Januar-Befund den Vermerk PRAXIS_DANACH: X3 verlor
// die Frist, „Heute" schwieg.
const c3Stand = () => ({ ...j7Stand(), labor: [{ id: 'j0', datum: '2026-01-10', tsh: { wert: 4.8, einheit: 'mU/l', von: 0.4, bis: 4 }, ft4: null, ft3: null, ...J7_FRAGEN, praxis: '', praxisAm: null }, { ...j7Stand().labor[0], praxis: '', praxisAm: null }] });
await page.evaluate(({ key, st }) => localStorage.setItem(key, JSON.stringify(st)), { key: SCHLUESSEL, st: c3Stand() });
await uhr(J7, '12:00');
await page.click('#reiter-heute');
check(await page.locator('#ansicht [data-regel="X3"], #ansicht [data-regel="B2"]').count() >= 1, 'C3 Vorbedingung: „Heute" wartet nach der eigenen Erhöhung auf die Praxis');
await page.click('#reiter-verlauf');
await page.click('[data-seite="labor-liste"]');
await page.locator('[data-seite="labor"][data-param="j0"]').first().click();
await page.waitForTimeout(300);
await page.check('form[data-formular="labor"] input[name=praxis][value=bleibt]', { force: true });
await page.click('form[data-formular="labor"] button[type=submit]');
await page.waitForTimeout(400);
s = await gespeichert();
const c3b0 = s.labor.find((l) => l.id === 'j0');
check(!!c3b0 && c3b0.praxis === 'bleibt' && c3b0.praxisAm === J7 && !(s.nachfragen || []).some((n) => n.art === 'praxis_danach'), `C3: „bleibt" am Januar-Befund gespeichert, ohne Vermerk PRAXIS_DANACH (${JSON.stringify((s.nachfragen || []).map((n) => [n.art, n.bezug]))})`);
await page.click('#reiter-heute');
check(await page.locator('#ansicht [data-regel="X3"], #ansicht [data-regel="B2"]').count() >= 1, 'C3: „Heute" wartet weiter auf die Praxis (X3/B2 mit Frist)');

// ---- Runde 8 – Nachbesserung D: „Nein, das war vorher" wird gemerkt – die
// Frage kommt beim nächsten Speichern desselben Befunds (nur Notiz) nicht wieder.
await page.evaluate(({ key, st }) => localStorage.setItem(key, JSON.stringify(st)), { key: SCHLUESSEL, st: j7Stand() });
await uhr(J7, '12:00');
await j7Oeffnen();
await page.click('form[data-formular="labor"] button[type=submit]');
await page.waitForTimeout(1000);
check((await k14Dialog()).includes('Nein, das war vorher'), 'D Vorbedingung: die J7b-Frage');
await page.click('dialog.rueckfrage [data-act="befund-korrigieren"]');
await page.waitForTimeout(400);
s = await gespeichert();
check((s.nachfragen || []).some((n) => n.art === 'praxis_danach' && n.antwort === 'nein' && n.bezug === 'j1' && n.dosis === 'e1'), `D: „Nein, das war vorher" ist als Vermerk mit Antwort „nein" und der Kennung der Änderung gemerkt (${JSON.stringify((s.nachfragen || []).map((n) => [n.art, n.antwort, n.dosis]))})`);
await j7Oeffnen();
await page.fill('form[data-formular="labor"] textarea[name=notiz], form[data-formular="labor"] input[name=notiz]', 'Brief liegt vor');
await page.click('form[data-formular="labor"] button[type=submit]');
await page.waitForTimeout(600);
s = await gespeichert();
check(!(await page.locator('dialog.rueckfrage').count()) && s.labor[0].notiz === 'Brief liegt vor' && s.labor[0].praxisAm === '2026-04-29', `D: eine Notizänderung speichert ohne die Frage (${s.labor[0].notiz}, ${s.labor[0].praxisAm})`);
await page.click('#reiter-heute');
check(await page.locator('#ansicht [data-regel="X3"], #ansicht [data-regel="B2"]').count() >= 1, 'D: „Heute" wartet weiter auf die Praxis');

// ---- Runde 8 – Nachbesserung 2 (J7b bei einer geplanten eigenen Änderung):
// Die eigene Änderung vom 01.04. ist entschieden („bleibt" am 10.04.), die
// Karte wartet auf die am 02.05. eingetragene geplante Erhöhung ab 10.05. Die
// Rückfrage nannte die schon entschiedene Änderung vom 01.04. – die wahre
// Antwort „Ja, danach" machte die geplante Erhöhung zur entschiedenen. Jetzt
// nennt sie den Eintrag vom 02.05. mit Beginn und Menge.
const nb2Stand = () => ({
  ...j7Stand(),
  dosen: [
    { id: 'd1', ab: '2025-01-01', praeparat: 'L-Thyroxin', mikrogramm: 75, tabletten: 1, notiz: '', praxis: true },
    { id: 'e1', ab: '2026-04-01', praeparat: 'L-Thyroxin', mikrogramm: 100, tabletten: 1, notiz: '', praxis: false, eingetragenAm: '2026-04-01' },
    { id: 'g1', ab: '2026-05-10', praeparat: 'L-Thyroxin', mikrogramm: 150, tabletten: 1, notiz: '', praxis: false, eingetragenAm: '2026-05-02' },
  ],
  labor: [{ ...j7Stand().labor[0], datum: '2026-03-25', praxis: 'bleibt', praxisAm: '2026-04-10' }],
});
await page.evaluate(({ key, st }) => localStorage.setItem(key, JSON.stringify(st)), { key: SCHLUESSEL, st: nb2Stand() });
await uhr(J7, '12:00');
await page.click('#reiter-heute');
check(await page.locator('#ansicht [data-regel="X3"], #ansicht [data-regel="B2"]').count() >= 1, 'Nachbesserung 2 J7b Vorbedingung: „Heute" wartet auf die Praxis wegen der geplanten Erhöhung');
await j7Oeffnen();
await page.click('form[data-formular="labor"] button[type=submit]');
await page.waitForTimeout(1000);
const nb2Text = await k14Dialog();
check(nb2Text.includes('Hat die Praxis das gesagt, nachdem Sie am 02.05.2026 eingetragen hatten, dass Sie ab 10.05.2026 selbst 150 µg am Tag nehmen wollen?') && !nb2Text.includes('01.04.2026'),
  `Nachbesserung 2 J7b: die Rückfrage nennt die geplante Erhöhung, nicht die entschiedene Änderung vom 01.04. („${nb2Text.slice(0, 220)}")`);
await page.click('dialog.rueckfrage [data-act="befund-korrigieren"]');
await page.waitForTimeout(400);
s = await gespeichert();
check((s.nachfragen || []).some((n) => n.art === 'praxis_danach' && n.antwort === 'nein' && n.dosis === 'g1'), `Nachbesserung 2 J7b: „Nein, das war vorher" ist für die geplante Erhöhung gemerkt (${JSON.stringify((s.nachfragen || []).map((n) => [n.art, n.antwort, n.dosis]))})`);
await page.click('#reiter-heute');
check(await page.locator('#ansicht [data-regel="X3"], #ansicht [data-regel="B2"]').count() >= 1, 'Nachbesserung 2 J7b Gegenprobe: „Heute" wartet weiter auf die Praxis (X3/B2 mit Frist)');

await ende();
