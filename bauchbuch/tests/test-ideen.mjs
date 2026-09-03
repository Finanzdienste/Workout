/*
 * Der Reiter „Ideen": Verbesserungsvorschläge zur App selbst.
 *
 * Der Sinn liegt nicht im Aufschreiben, sondern im Weitergeben – wer die App
 * benutzt, sitzt nicht neben dem, der sie baut. Deshalb wird hier neben dem
 * Eintragen vor allem geprüft, dass die Liste wieder herauskommt: als Text,
 * den man in eine Nachricht einfügen kann.
 *
 * Und dass eine Idee nichts mit dem Tagebuch zu tun hat: Sie darf in keiner
 * Auswertung auftauchen und keinen Tag als „notiert" gelten lassen.
 */
import { chromium } from 'playwright';
import { URL, KEY, HANDY, SHOT, pruefer } from './umgebung.mjs';

const { check, ende } = pruefer();
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: HANDY, permissions: ['clipboard-read', 'clipboard-write'] });
const page = await ctx.newPage();
const fehler = [];
page.on('pageerror', (e) => fehler.push(`PAGEERROR: ${e.message}`));

await page.goto(URL, { waitUntil: 'networkidle' });
await page.evaluate((k) => localStorage.setItem(k, JSON.stringify({ begruesst: true, tab: 'ideen' })), KEY);
await page.reload({ waitUntil: 'networkidle' });

check(await page.locator('.tab').count() === 5, 'fünf Reiter unten, „Ideen" ist dabei');
check(
  await page.locator('[data-act="tab"][data-tab="ideen"]').count() === 1,
  'der Reiter lässt sich ansteuern',
);
check(await page.locator('.leer').count() === 1, 'am Anfang steht dort, dass noch nichts da ist');

/* ---------- Eintragen ---------- */

await page.locator('#ideeText').fill('Die Uhrzeit sollte man schneller ändern können.');
await page.locator('[data-act="idee-neu"]').click();
await page.waitForTimeout(250);
check(await page.locator('.idee').count() === 1, 'die Idee steht in der Liste');
check(
  (await page.locator('.idee').first().textContent()).includes('Uhrzeit'),
  'mit ihrem Wortlaut',
);
check(await page.locator('#ideeText').inputValue() === '', 'das Feld ist danach wieder leer');

await page.locator('[data-act="idee-neu"]').click();
await page.waitForTimeout(250);
check(await page.locator('.idee').count() === 1, 'ein leeres Feld legt nichts an');
check(
  (await page.locator('#toast').textContent()).includes('Da steht noch nichts'),
  'und sagt das auch',
);

await page.locator('#ideeText').fill('Mehr Platz für eigene Auslöser.');
await page.locator('[data-act="idee-neu"]').click();
await page.waitForTimeout(250);
check(await page.locator('.idee').count() === 2, 'zwei Ideen');
check(
  (await page.locator('.idee').first().textContent()).includes('Mehr Platz'),
  'die neueste steht oben',
);

/* ---------- Erledigt ist nicht gelöscht ---------- */

await page.locator('.idee').first().locator('[data-act="idee-haken"]').click();
await page.waitForTimeout(250);
check(await page.locator('.idee').count() === 2, 'abhaken löscht nichts');
check(
  await page.locator('.idee.ab').count() === 1,
  'die erledigte Idee ist als erledigt gezeichnet',
);
check(
  (await page.locator('.idee').last().textContent()).includes('Mehr Platz'),
  'und rutscht ans Ende der Liste',
);
check(
  (await page.locator('.karte').last().textContent()).includes('1 offene Idee, 1 erledigt'),
  'die Zählung stimmt',
);

await page.locator('.idee.ab').locator('[data-act="idee-haken"]').click();
await page.waitForTimeout(250);
check(await page.locator('.idee.ab').count() === 0, 'ein zweites Tippen macht sie wieder offen');

/* ---------- Der Weg nach draußen ---------- */

await page.locator('[data-act="ideen-kopieren"]').click();
await page.waitForTimeout(300);
const ablage = await page.evaluate(() => navigator.clipboard.readText());
check(ablage.includes('Bauchbuch'), 'der kopierte Text ist überschrieben');
check(ablage.includes('Uhrzeit') && ablage.includes('Mehr Platz'), 'und enthält beide Ideen');

/* ---------- Ideen sind kein Tagebuch ---------- */

await page.locator('[data-act="tab"][data-tab="verlauf"]').click();
await page.waitForTimeout(250);
const kacheln = await page.locator('.kachel').allTextContents();
check(
  kacheln[0].startsWith('0'),
  `zwei Ideen machen aus keinem Tag einen notierten (${kacheln[0]})`,
);
await page.locator('[data-act="tab"][data-tab="muster"]').click();
await page.waitForTimeout(250);
check(
  (await page.locator('#view').textContent()).includes('Noch keine Mahlzeit'),
  'und tauchen in der Auswertung nicht auf',
);

/* ---------- Bleiben ---------- */

await page.reload({ waitUntil: 'networkidle' });
await page.locator('[data-act="tab"][data-tab="ideen"]').click();
await page.waitForTimeout(250);
check(await page.locator('.idee').count() === 2, 'die Ideen überleben das Neuladen');
const gespeichert = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)), KEY);
check(gespeichert.ideen.length === 2, 'sie stehen im selben Speicher wie alles andere');
check(
  gespeichert.eintraege.length === 0,
  'aber nicht in den Eintragungen – getrennte Liste, wie gedacht',
);

/* ---------- Löschen ---------- */

await page.locator('.idee').first().locator('[data-act="idee-weg"]').click();
await page.waitForTimeout(250);
check(await page.locator('.idee').count() === 1, 'löschen geht auch');

await page.screenshot({ path: `${SHOT}/60-ideen.png` });
check(fehler.length === 0, `keine Fehler${fehler.length ? `: ${fehler.join(' | ')}` : ''}`);
await browser.close();
ende();
