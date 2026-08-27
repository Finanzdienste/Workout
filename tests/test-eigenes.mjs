/* Eigenes Workout: zusammenstellen, laufen lassen, zählen. */
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
await page.evaluate(() => localStorage.setItem('workout.state.v1', JSON.stringify({
  greeted: true, name: 'Tobi', restSeconds: 0, useExerciseRest: false,
})));
await page.reload({ waitUntil: 'networkidle' });

const zumBaukasten = async () => {
  await page.locator('.tab[data-tab="settings"]').click();
  await page.waitForTimeout(150);
  await page.locator('[data-act="go-tab"][data-tab="custom"]').click();
  await page.waitForTimeout(200);
};

await zumBaukasten();
check(await page.locator('[data-act="custom-new"]').count() === 1, 'Baukasten steht unter Mehr');
await page.locator('[data-act="custom-new"]').click();
await page.waitForTimeout(200);
check(await page.locator('[data-act="custom-save"]').isDisabled(),
  'ohne Übung lässt sich nichts speichern');

await page.locator('[data-act="custom-name"]').fill('Kurz und schwer');
const chips = page.locator('[data-act="custom-add"]');
const ersteZwei = [await chips.nth(0).textContent(), await chips.nth(3).textContent()];
await chips.nth(0).click();
await page.waitForTimeout(150);
await chips.nth(3).click();
await page.waitForTimeout(150);
check(await page.locator('.cx-row').count() === 2, `zwei Übungen gewählt (${ersteZwei.join(', ')})`);
await chips.nth(3).click();   // nochmal antippen nimmt sie wieder raus
await page.waitForTimeout(150);
check(await page.locator('.cx-row').count() === 1, 'nochmal antippen nimmt sie wieder heraus');
await chips.nth(3).click();
await page.waitForTimeout(150);

await page.locator('[data-act="custom-sets"][data-i="0"][data-d="1"]').click();
await page.waitForTimeout(150);
check((await page.locator('.cx-num').first().textContent()).trim() === '4', 'Sätze einstellbar');
check((await page.locator('.section-title').filter({ hasText: 'Übungen' }).textContent()).includes('7 Sätze'),
  'die Kopfzeile zählt mit');

await page.locator('[data-act="custom-save"]').click();
await page.waitForTimeout(400);
check((await page.locator('.hero-title').first().textContent()).trim() === 'Kurz und schwer',
  'nach dem Speichern steht das eigene Workout da');
check((await page.locator('.hero-eyebrow').first().textContent()).includes('Eigenes Workout'),
  'als eigenes gekennzeichnet, nicht als Plan-Einheit');
check(await page.locator('[data-act="nav-workout"]').count() === 0,
  'kein Blättern in den Plan hinein');

// --- Läuft wie eine Plan-Einheit ---
await page.locator('[data-act="start-session"]').first().click();
await page.waitForTimeout(300);
check(await page.locator('.focus-name').count() === 1, 'Fokus-Ansicht mit Bewegungsbild');
check(await page.locator('.prog-ex').count() === 2, 'Fortschrittsleiste kennt beide Übungen');
await page.locator('.focus-set').first().click();
await page.waitForTimeout(250);
const log = await page.evaluate(() => JSON.parse(localStorage.getItem('workout.state.v1')).log);
const keys = Object.keys(log);
check(keys.length === 1 && keys[0].startsWith('c'), `abgehakt unter eigener Kennung (${keys.join()})`);

// --- Zählt in der Statistik, aber nicht als Plan-Einheit ---
await page.locator('.tab[data-tab="stats"]').click();
await page.waitForTimeout(300);
const stats = (await page.locator('.stat').allTextContents()).join(' | ');
check(/^0\//.test(stats.replace(/\s/g, '')), `der Plan bleibt bei 0 erledigten Einheiten (${stats.split('|')[0].trim()})`);
check(stats.includes('(1 eigene)'), 'der Satz zählt trotzdem mit');

// --- Zurück zum Plan ---
await page.locator('.tab[data-tab="dashboard"]').click();
await page.waitForTimeout(250);
if (await page.locator('[data-act="finish-session"]').count()) {
  await page.locator('[data-act="finish-session"]').click();
  await page.waitForTimeout(250);
}
await page.locator('[data-act="back-to-plan"]').click();
await page.waitForTimeout(250);
check((await page.locator('.hero-eyebrow').first().textContent()).includes('Workout 1'),
  'der Rückweg führt zur nächsten Plan-Einheit');

// --- Löschen ---
page.on('dialog', (d) => d.accept());
await zumBaukasten();
await page.locator('[data-act="custom-del"]').first().click();
await page.waitForTimeout(300);
check(await page.locator('[data-act="custom-del"]').count() === 0, 'gelöscht');
check(Object.keys(await page.evaluate(() => JSON.parse(localStorage.getItem('workout.state.v1')).log)).length === 0,
  'und die abgehakten Sätze gehen mit');

console.log(`\n${fails ? fails + ' FEHLER' : 'alle Prüfungen bestanden'}`);
console.log('ERRORS:', errs.length ? errs : 'none');
await browser.close();
