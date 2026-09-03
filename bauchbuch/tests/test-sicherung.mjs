/*
 * Sichern, löschen, wiederherstellen – der ganze Weg.
 *
 * Diese App hat keinen Server, der etwas aufhebt. Die Sicherungsdatei ist die
 * einzige Kopie, die es je geben wird, und sie wird genau einmal gebraucht:
 * wenn das Gerät weg ist. Ein Export, den man nicht wieder einlesen kann, ist
 * schlimmer als keiner, weil man sich darauf verlassen hat.
 *
 * Deshalb wird hier nicht die Funktion geprüft, sondern der Weg: über den
 * Knopf, durch eine echte Datei, zurück über den Dateiauswähler.
 */
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { URL, KEY, HANDY, ABLAGE, vorTagen, pruefer } from './umgebung.mjs';

const { check, ende } = pruefer();
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: HANDY, acceptDownloads: true });
const page = await ctx.newPage();
const fehler = [];
page.on('pageerror', (e) => fehler.push(`PAGEERROR: ${e.message}`));
// Der Löschknopf fragt nach – im Test wird zugestimmt.
page.on('dialog', (d) => d.accept());

const eintraege = [
  { id: 'a', am: vorTagen(1), um: '12:00', art: 'essen', was: 'Linsensuppe', tags: ['huelsen'], portion: 'normal' },
  { id: 'b', am: vorTagen(1), um: '15:00', art: 'beschwerde', staerke: 5, arten: ['blaehung'], notiz: 'nach dem Mittag' },
  { id: 'c', am: vorTagen(0), um: '08:00', art: 'medikament', mittel: 'Pantoprazol', dosis: '20 mg' },
];

await page.goto(URL, { waitUntil: 'networkidle' });
await page.evaluate(([k, s]) => localStorage.setItem(k, JSON.stringify(s)),
  [KEY, { eintraege, tage: { [vorTagen(1)]: { stress: 3, schlaf: 2, notiz: '' } }, begruesst: true, tab: 'mehr', theme: 'flieder' }]);
await page.reload({ waitUntil: 'networkidle' });

check(
  (await page.locator('#view').textContent()).includes('Gesichert: noch nie'),
  'die App sagt, dass noch nie gesichert wurde',
);

/* ---------- Sichern ---------- */

const [download] = await Promise.all([
  page.waitForEvent('download'),
  page.locator('[data-act="export"]').click(),
]);
const datei = path.join(ABLAGE, 'sicherung.json');
await download.saveAs(datei);
check(/^bauchbuch-\d{4}-\d{2}-\d{2}\.json$/.test(download.suggestedFilename()),
  `der Dateiname trägt das Datum (${download.suggestedFilename()})`);

const roh = readFileSync(datei, 'utf8');
const gesichert = JSON.parse(roh);
check(gesichert.eintraege.length === 3, 'drei Einträge in der Datei');
check(gesichert.eintraege[0].was === 'Linsensuppe', 'lesbar im Klartext, ohne diese App');
check(gesichert.tage[vorTagen(1)].stress === 3, 'die Tagesangaben sind mit dabei');
check(gesichert.theme === 'flieder', 'die Einstellungen ebenfalls');

await page.waitForTimeout(250);
check(
  (await page.locator('#view').textContent()).includes('zuletzt am'),
  'danach merkt sich die App, dass gesichert wurde',
);

/* ---------- Alles löschen ---------- */

await page.locator('[data-act="alles-weg"]').click();
await page.waitForTimeout(300);
check(
  await page.evaluate((k) => {
    const s = JSON.parse(localStorage.getItem(k) || '{"eintraege":[]}');
    return s.eintraege.length;
  }, KEY) === 0,
  'nach dem Löschen ist nichts mehr da',
);
await page.locator('[data-act="tab"][data-tab="heute"]').click();
await page.waitForTimeout(200);
check(await page.locator('.strang-zeile').count() === 0, 'auch in der Tagesansicht nicht');

/* ---------- Wieder einlesen ---------- */

await page.locator('[data-act="tab"][data-tab="mehr"]').click();
await page.waitForTimeout(200);
const [waehler] = await Promise.all([
  page.waitForEvent('filechooser'),
  page.locator('[data-act="import"]').click(),
]);
await waehler.setFiles(datei);
await page.waitForTimeout(400);

await page.locator('[data-act="tab"][data-tab="heute"]').click();
await page.waitForTimeout(250);
check(await page.locator('.strang-zeile').count() === 1, 'der heutige Eintrag ist zurück');
await page.locator('[data-act="tag-blaettern"][data-d="-1"]').click();
await page.waitForTimeout(200);
check(await page.locator('.strang-zeile').count() === 2, 'die beiden von gestern auch');
check(
  (await page.locator('.strang-zeile').first().textContent()).includes('Linsensuppe'),
  'mit ihrem Text',
);
check(
  await page.locator('[data-act="stress"][data-n="3"]').getAttribute('aria-pressed') === 'true',
  'und die Tagesangaben stehen wieder',
);

/* ---------- Eine kaputte Datei richtet keinen Schaden an ---------- */

const kaputt = path.join(ABLAGE, 'kaputt.json');
writeFileSync(kaputt, '{"irgendwas": 1}');
await page.locator('[data-act="tab"][data-tab="mehr"]').click();
await page.waitForTimeout(200);
const [waehler2] = await Promise.all([
  page.waitForEvent('filechooser'),
  page.locator('[data-act="import"]').click(),
]);
await waehler2.setFiles(kaputt);
await page.waitForTimeout(400);
check(
  (await page.locator('#toast').textContent()).includes('Ging nicht'),
  'eine unpassende Datei wird abgelehnt',
);
await page.locator('[data-act="tab"][data-tab="heute"]').click();
await page.waitForTimeout(250);
check(
  await page.evaluate((k) => JSON.parse(localStorage.getItem(k)).eintraege.length, KEY) === 3,
  'und die vorhandenen Eintragungen bleiben unangetastet',
);

check(fehler.length === 0, `keine Fehler${fehler.length ? `: ${fehler.join(' | ')}` : ''}`);
await browser.close();
ende();
