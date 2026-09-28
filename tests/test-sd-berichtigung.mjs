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
await o.ende();
