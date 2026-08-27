/* Tab bleibt beim Neuladen stehen, Notausgang funktioniert. */
import { chromium } from 'playwright';
import { URL } from './umgebung.mjs';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 414, height: 896 } });
const errs = [];
page.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()); });
let fails = 0;
const check = (c, m) => { console.log(`${c ? 'OK  ' : 'FAIL'} ${m}`); if (!c) { fails++; process.exitCode = 1; } };

await page.goto(URL, { waitUntil: 'networkidle' });
await page.evaluate(() => { localStorage.clear(); localStorage.setItem('workout.state.v1', '{"greeted":true}'); });
await page.reload({ waitUntil: 'networkidle' });

const aktiv = () => page.evaluate(() => document.querySelector('.tab[aria-selected="true"]')?.dataset.tab);
check(await aktiv() === 'dashboard', 'startet auf dem Dashboard');

for (const tab of ['stats', 'settings']) {
  await page.locator(`.tab[data-tab="${tab}"]`).click();
  await page.waitForTimeout(200);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(200);
  check(await aktiv() === tab, `nach dem Neuladen weiterhin im Tab "${tab}"`);
}

// Kalender und Verletzungen liegen unter Mehr und haben keinen eigenen Reiter.
// Beim Neuladen steht man wieder dort, und markiert ist der Reiter "Mehr".
for (const seite of ['calendar', 'injuries']) {
  await page.locator('.tab[data-tab="settings"]').click();
  await page.waitForTimeout(150);
  await page.locator(`[data-act="go-tab"][data-tab="${seite}"]`).click();
  await page.waitForTimeout(200);
  check(await aktiv() === 'settings', `${seite}: der Reiter "Mehr" bleibt markiert`);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(200);
  check(await page.locator('[data-act="go-tab"][data-tab="settings"]').count() === 1,
    `${seite}: nach dem Neuladen wieder da, mit Weg zurück`);
}
await page.locator('.tab[data-tab="settings"]').click();
await page.waitForTimeout(200);

// Kein Ziehen-zum-Neuladen
const ob = await page.evaluate(() => getComputedStyle(document.body).overscrollBehaviorY);
check(ob === 'contain' || ob === 'none', `Ziehen-zum-Neuladen abgeschaltet (${ob})`);

// Fassung steht im Mehr-Tab
await page.locator('.tab[data-tab="settings"]').click();
await page.waitForTimeout(400);
const v = await page.locator('#appVersion').textContent();
console.log('     Fassung:', v.trim());
check(/\d+ Einheiten/.test(v), 'Fassung nennt die Plangröße');
check(await page.locator('[data-act="force-update"]').count() === 1, 'Notausgang "App aktualisieren" da');

// Notausgang lässt die Trainingsdaten stehen
await page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('workout.state.v1') || '{}');
  s.weights = { 'goblet-squat': 42 };
  localStorage.setItem('workout.state.v1', JSON.stringify(s));
});
await page.locator('[data-act="force-update"]').click();
await page.waitForTimeout(1500);
const kg = await page.evaluate(() => JSON.parse(localStorage.getItem('workout.state.v1')).weights['goblet-squat']);
check(kg === 42, 'Gewichte überstehen den Notausgang');

console.log(`\n${fails ? fails + ' FEHLER' : 'alle Prüfungen bestanden'}`);
console.log('ERRORS:', errs.length ? errs : 'none');
await browser.close();
