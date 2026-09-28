/*
 * Schilddrüse: die Kalenderdatei – der verlässliche Weg zur Erinnerung.
 *
 * Ohne Server meldet sich die App nicht von selbst; der Kalender des Handys
 * schon. Deshalb muss die Datei stimmen: täglich wiederholt, mit Alarm, zur
 * eingestellten Uhrzeit, nach Norm umbrochen – und ein Termin kurz vor
 * Mitternacht darf nicht vor seinem Beginn enden.
 */
import { oeffne, standMit, plus, SD_URL } from './sd-hilfe.mjs';

const TAG = '2026-03-10';
const { browser, page, check, gespeichert, ende } = await oeffne({ tag: TAG, stand: standMit(plus(TAG, -3)) });

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

// ---- Runde 4: E27 – die tägliche Erinnerung am Morgen nennt den Tag der
// Blutabnahme (RW1 L0d). Sie kennt einen später angelegten Abnahmetag nicht,
// deshalb allgemein – und nur morgens.
const texte = await page.evaluate(async () => {
  const m = await import('./js/ics.js');
  return {
    morgens: m.erinnerungText('06:45'), mittags: m.erinnerungText('12:00'), abends: m.erinnerungText('21:30'),
    datei: m.erinnerungICS({ abISO: '2026-03-10', uhr: '06:45' }).replace(/\r\n /g, ''),
  };
});
check(/Blutabnahme/.test(texte.morgens) && /erst nach der Abnahme/.test(texte.morgens) && /außer die Praxis/.test(texte.morgens),
  `E27: morgens „Am Tag einer Blutabnahme … erst nach der Abnahme" (${texte.morgens})`);
check(/Frühstück frühestens eine halbe Stunde später/.test(texte.morgens), 'E27: … und weiter der Satz zum Frühstück');
check(!/Blutabnahme/.test(texte.mittags) && !/Blutabnahme/.test(texte.abends), 'E27: mittags und abends ohne diesen Satz');
check(texte.datei.includes('DESCRIPTION:Nüchtern\\, mit einem Glas Wasser. Frühstück frühestens eine halbe Stunde später. Am Tag einer Blutabnahme'),
  'E27: die Kalenderdatei trägt den Satz in der Beschreibung des täglichen Termins');

// ---- Runde 4: E29 – Zeitumstellung. Am 29.03.2026 gibt es in Deutschland
// 2:00–2:59 nicht; die schwebende Uhrzeit darf trotzdem nicht auf 3:xx
// rutschen (sonst klingelt die tägliche Erinnerung jeden Tag eine Stunde
// später, und ein Termin um 2:30 hat die Dauer 0). Eigener Browserkontext in
// der Zeitzone Berlin – die Uhr der übrigen Prüfungen bleibt, wie sie ist.
const berlin = await browser.newContext({ timezoneId: 'Europe/Berlin', locale: 'de-DE' });
const pb = await berlin.newPage();
await pb.goto(SD_URL, { waitUntil: 'networkidle' });
const um = await pb.evaluate(async () => {
  const m = await import('./js/ics.js');
  const zeiten = (t) => t.match(/DT(?:START|END):\d{8}T\d{6}/g);
  return {
    zone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    luecke: new Date(2026, 2, 29, 2, 30).getHours(),
    taeglich: zeiten(m.erinnerungICS({ abISO: '2026-03-29', uhr: '02:30' })),
    termin: zeiten(m.terminICS({ id: 'u1', datum: '2026-03-29', uhr: '02:30', titel: 'Termin' })),
    frueh: zeiten(m.terminICS({ id: 'u2', datum: '2026-03-29', uhr: '01:50', titel: 'Termin' })),
    herbst: zeiten(m.erinnerungICS({ abISO: '2026-10-25', uhr: '02:30' })),
    silvester: zeiten(m.erinnerungICS({ abISO: '2026-12-31', uhr: '23:50' })),
  };
});
await berlin.close();
const gleich = (a, b) => JSON.stringify(a) === JSON.stringify(b);
check(um.zone === 'Europe/Berlin' && um.luecke === 3, `E29: Prüfumgebung in Berlin, 2:30 am 29.03. gibt es dort nicht (${um.zone}, ${um.luecke} Uhr)`);
check(gleich(um.taeglich, ['DTSTART:20260329T023000', 'DTEND:20260329T024500']), `E29: tägliche Erinnerung ab 29.03. um 2:30 bleibt 2:30 (${um.taeglich})`);
check(gleich(um.termin, ['DTSTART:20260329T023000', 'DTEND:20260329T033000']), `E29: Termin am 29.03. um 2:30 dauert eine Stunde (${um.termin})`);
check(gleich(um.frueh, ['DTSTART:20260329T015000', 'DTEND:20260329T025000']), `E29: Termin um 1:50 endet um 2:50, nicht 3:50 (${um.frueh})`);
check(gleich(um.herbst, ['DTSTART:20261025T023000', 'DTEND:20261025T024500']), `E29: Umstellung im Herbst unverändert (${um.herbst})`);
check(gleich(um.silvester, ['DTSTART:20261231T235000', 'DTEND:20270101T000500']), `E29: 23:50 endet weiter am nächsten Tag (${um.silvester})`);

await ende();
