/*
 * Schilddrüse: die Kalenderdatei – der verlässliche Weg zur Erinnerung.
 *
 * Ohne Server meldet sich die App nicht von selbst; der Kalender des Handys
 * schon. Deshalb muss die Datei stimmen: täglich wiederholt, mit Alarm, zur
 * eingestellten Uhrzeit, nach Norm umbrochen – und ein Termin kurz vor
 * Mitternacht darf nicht vor seinem Beginn enden.
 */
import { oeffne, standMit, plus } from './sd-hilfe.mjs';

const TAG = '2026-03-10';
const { page, check, gespeichert, ende } = await oeffne({ tag: TAG, stand: standMit(plus(TAG, -3)) });

const ics = await page.evaluate(async () => {
  const m = await import('./js/ics.js');
  return {
    taeglich: m.erinnerungICS({ abISO: '2026-03-10', uhr: '06:45' }),
    spaet: m.erinnerungICS({ abISO: '2026-12-31', uhr: '23:50' }),
    termin: m.terminICS({ id: 'abc', datum: '2026-04-02', uhr: '23:30', titel: 'Blutabnahme; Praxis, Dr. Meier', notiz: 'nüchtern\nBefunde mitbringen' }),
    ohneZeit: m.terminICS({ id: 'x', datum: '2026-04-02', uhr: '', titel: 'Arzttermin' }),
    lang: m.terminICS({ id: 'y', datum: '2026-04-02', uhr: '09:00', titel: 'Arzttermin Schilddrüse – Praxis Dr. Müller-Lüdenscheidt, Überweisung',
      notiz: `${'a'.repeat(62)}😊 ok, danach Blutabnahme im Erdgeschoß – nüchtern kommen\rZweite Zeile` }),
  };
});
const oktette = (z) => new TextEncoder().encode(z).length;
const zeilen = (t) => t.split('\r\n');
check(ics.taeglich.includes('DTSTART:20260310T064500') && ics.taeglich.includes('DTEND:20260310T070000'), 'Beginn 6:45, Ende eine Viertelstunde später');
check(ics.taeglich.includes('RRULE:FREQ=DAILY'), 'täglich wiederholt');
check(/BEGIN:VALARM[\s\S]*TRIGGER:PT0M[\s\S]*END:VALARM/.test(ics.taeglich), 'mit Alarm zur Einnahmezeit');
check(ics.taeglich.includes('UID:tablette@schilddruese.local'), 'feste Kennung – ein zweiter Import ersetzt den Termin');
check(ics.taeglich.endsWith('\r\n') && !/[^\r]\n/.test(ics.taeglich), 'Zeilenenden CRLF, wie die Norm es verlangt');
check(zeilen(ics.termin).every((z) => z.length <= 75), 'keine Zeile länger als 75 Zeichen');
check(ics.spaet.includes('DTSTART:20261231T235000') && ics.spaet.includes('DTEND:20270101T000500'), 'um 23:50 endet der Termin am nächsten Tag (Jahreswechsel) – nicht vor seinem Beginn');
check(ics.termin.includes('DTEND:20260403T003000'), 'Termin um 23:30 endet um 0:30 des Folgetags');
check(ics.termin.includes('Blutabnahme\\; Praxis\\, Dr. Meier'), 'Semikolon und Komma im Titel sind maskiert');
check(ics.termin.includes('nüchtern\\nBefunde'), 'Zeilenumbruch in der Notiz ist maskiert');
check(ics.termin.includes('TRIGGER:-P1D') && ics.termin.includes('TRIGGER:-PT1H'), 'Termin: Erinnerung am Vortag und eine Stunde vorher');
check(ics.ohneZeit.includes('DTSTART:20260402T090000'), 'Termin ohne Uhrzeit steht um 9 Uhr');
check(zeilen(ics.lang).every((z) => oktette(z) <= 75), `mit Umlauten: keine Zeile über 75 Oktette (längste ${Math.max(...zeilen(ics.lang).map(oktette))})`);
const entfaltet = ics.lang.replace(/\r\n /g, '');
check(entfaltet.includes('😊') && !entfaltet.includes('\uFFFD') && !/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/.test(entfaltet), 'ein Emoji an der Umbruchstelle bleibt ganz');
check(!/\r(?!\n)/.test(ics.lang), 'ein einzelnes CR in der Notiz wird maskiert, nicht durchgereicht');
check(Number(ics.taeglich.match(/SEQUENCE:(\d+)/)[1]) > 1, 'SEQUENCE steigt mit der Zeit – eine neue Datei ist die neuere Fassung');

// Über die Oberfläche: Uhrzeit ändern, Datei holen.
await page.click('#reiter-mehr');
await page.click('[data-seite="erinnerung"]');
await page.fill('input[name=erinnerung]', '06:20');
await page.locator('input[name=erinnerung]').dispatchEvent('change');
const s = await gespeichert();
check(s.einstellungen.erinnerung === '06:20', 'die neue Einnahmezeit wird sofort übernommen');
await page.click('#reiter-mehr');
await page.click('[data-seite="erinnerung"]');
const [download] = await Promise.all([page.waitForEvent('download'), page.click('[data-act="ics-erinnerung"]')]);
check(download.suggestedFilename().endsWith('.ics'), 'der Knopf liefert eine .ics-Datei');
const inhalt = await (async () => {
  const strom = await download.createReadStream();
  let t = '';
  for await (const teil of strom) t += teil;
  return t;
})();
check(inhalt.includes(`DTSTART:${TAG.replace(/-/g, '')}T062000`), 'die Datei nimmt die eingestellte Zeit (6:20) ab heute');
check((await page.locator('#ansicht').innerText()).includes('nicht von selbst melden'), 'die Seite sagt ehrlich, warum es den Kalender braucht');
check((await page.locator('#ansicht').innerText()).includes('zuerst den alten Termin'), 'bei geänderter Uhrzeit: erst den alten Termin löschen – sonst zwei tägliche Alarme');

// Termin anlegen und in den Kalender.
await page.click('#reiter-mehr');
await page.click('[data-seite="termine"]');
await page.click('[data-seite="termin"]');
await page.selectOption('select[name=art]', 'labor');
await page.fill('input[name=datum]', plus(TAG, 5));
await page.fill('input[name=uhr]', '08:00');
await page.click('button[type=submit]');
const [d2] = await Promise.all([page.waitForEvent('download'), page.click('[data-act="ics-termin"]')]);
check(d2.suggestedFilename() === `termin-${plus(TAG, 5)}.ics`, 'jeder Termin lässt sich einzeln in den Kalender legen');
await page.click('#reiter-heute');
const heute = await page.locator('#ansicht').innerText();
check(heute.includes('Blutabnahme in 5 Tagen, 8:00 Uhr'), '„Heute" kündigt die Blutabnahme an');
check(heute.includes('erst danach'), '… mit dem Hinweis, die Tablette meist erst danach zu nehmen');

await ende();
