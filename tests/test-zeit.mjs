/*
 * Zeit im Training: gemessen, gebucht, gezeigt.
 *
 * Die Uhr lief bisher nur für die laufende Einheit. Jetzt landet sie im
 * Protokoll – und darf dabei weder doppelt zählen noch bei einer Unterbrechung
 * verlorengehen.
 */
import { chromium } from 'playwright';
import { URL } from './umgebung.mjs';

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 414, height: 896 } });
await ctx.route('**/rest/v1/**', (r) => r.fulfill({ status: 204, body: '' }));
await ctx.addInitScript(() => {
  window.__hidden = false;
  Object.defineProperty(document, 'hidden', { get: () => window.__hidden, configurable: true });
  Object.defineProperty(document, 'visibilityState', {
    get: () => (window.__hidden ? 'hidden' : 'visible'), configurable: true,
  });
});
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message));
let fails = 0;
const check = (c, m) => { console.log(`${c ? 'OK  ' : 'FAIL'} ${m}`); if (!c) { fails++; process.exitCode = 1; } };

const secs = () => page.evaluate(async () => {
  const s = (await import('./js/store.js')).getState();
  return Object.fromEntries(Object.entries(s.log).map(([n, e]) => [n, e.secs || 0]));
});

await page.goto(URL, { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.setItem('workout.state.v1',
  JSON.stringify({ greeted: true, name: 'T', restSeconds: 0, useExerciseRest: false })));
await page.reload({ waitUntil: 'networkidle' });

// --- Trainieren, dann abschließen ---
await page.locator('[data-act="start-session"]').first().click();
await page.waitForTimeout(2500);
await page.locator('.focus-set').first().click();
await page.waitForTimeout(1200);
check(Object.keys(await secs()).length >= 1, 'die Einheit steht im Protokoll');
await page.locator('[data-act="finish-session"]').first().click();
await page.waitForTimeout(400);
const nach = await secs();
const eins = nach['1'] || 0;
check(eins >= 3, `nach dem Abschließen steht die Zeit drin (${eins} s)`);

// --- Die Uhr läuft nicht weiter, wenn nichts läuft ---
await page.waitForTimeout(2500);
const spaeter = (await secs())['1'] || 0;
check(spaeter === eins, `ohne laufendes Training wächst sie nicht (${eins} -> ${spaeter})`);

// --- Fortsetzen zählt weiter, aber nicht doppelt ---
await page.locator('[data-act="start-session"]').first().click();
await page.waitForTimeout(2500);
await page.locator('[data-act="finish-session"]').first().click();
await page.waitForTimeout(400);
const zweite = (await secs())['1'] || 0;
check(zweite > eins, `Fortsetzen zählt weiter (${eins} -> ${zweite} s)`);
check(zweite < eins * 2 + 3, `und nicht doppelt (${zweite} s, wäre bei Doppelzählung ~${eins * 2 + 3})`);

// --- In der Statistik ---
await page.locator('.tab[data-tab="stats"]').click();
await page.waitForTimeout(400);
const kacheln = (await page.locator('.stat-grid').first().textContent()).replace(/\s+/g, ' ');
check(kacheln.includes('Zeit im Training'), `die Kachel steht da (${kacheln.slice(0, 120)}…)`);
check(/\d+ min|\d+ h/.test(kacheln), 'mit einer lesbaren Zeitangabe');

// --- Ohne gemessene Zeit keine Kachel ---
await page.evaluate(() => localStorage.setItem('workout.state.v1',
  JSON.stringify({ greeted: true, name: 'T' })));
await page.reload({ waitUntil: 'networkidle' });
await page.locator('.tab[data-tab="stats"]').click();
await page.waitForTimeout(300);
check(!(await page.locator('.stat-grid').first().textContent()).includes('Zeit im Training'),
  'wer noch nie trainiert hat, sieht die Kachel nicht');

console.log(`\n${fails ? fails + ' FEHLER' : 'alle Prüfungen bestanden'}`);
console.log('ERRORS:', errs.length ? errs : 'none');
await browser.close();
