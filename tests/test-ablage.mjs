/* Verlauf zurückholen: der Rückweg aus der Ablage. */
import { chromium } from 'playwright';
import { URL } from './umgebung.mjs';

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 414, height: 896 } });
await ctx.route('**/rest/v1/**', (r) => r.fulfill({ status: 204, body: '' }));
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message));
// Rückfragen ("wirklich neu starten?") immer bestätigen – ein einziger
// Handler, sonst greifen zwei once() beim selben Dialog zu.
page.on('dialog', (d) => d.accept().catch(() => {}));
let fails = 0;
const check = (c, m) => { console.log(`${c ? 'OK  ' : 'FAIL'} ${m}`); if (!c) { fails++; process.exitCode = 1; } };

const stats = async () => {
  await page.locator('.tab[data-tab="stats"]').click();
  await page.waitForTimeout(250);
  return (await page.locator('.stat').first().textContent()).trim();
};

await page.goto(URL, { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.setItem('workout.state.v1', JSON.stringify({
  greeted: true, name: 'Tobi', restSeconds: 0, useExerciseRest: false,
})));
await page.reload({ waitUntil: 'networkidle' });

// --- Trainieren und abschließen ---
await page.locator('[data-act="start-session"]').first().click();
await page.waitForTimeout(200);
for (let i = 0; i < 3; i++) { await page.locator('.focus-set').nth(i).click(); await page.waitForTimeout(100); }
await page.evaluate(async () => (await import('./js/store.js')).markDone(1, 'db'));
await page.waitForTimeout(200);
const vorher = await stats();
check(/1\/84/.test(vorher), `vorher steht eine Einheit im Protokoll (${vorher.replace(/\s+/g, ' ')})`);

// --- Von vorn beginnen: der Verlauf wandert in die Ablage ---
await page.locator('.tab[data-tab="settings"]').click();
await page.waitForTimeout(200);
await page.locator('[data-act="restart-plan"]').click();
await page.waitForTimeout(300);
const leer = await stats();
check(/0\/84/.test(leer), `danach ist der Plan leer (${leer.replace(/\s+/g, ' ')})`);

// --- Und wieder zurück ---
await page.locator('.tab[data-tab="settings"]').click();
await page.waitForTimeout(200);
const knopf = page.locator('[data-act="restore-round"]');
check(await knopf.count() === 1, 'in den Einstellungen steht "Verlauf zurückholen"');
await knopf.click();
await page.waitForTimeout(300);
const zurueck = await stats();
check(/1\/84/.test(zurueck), `der Verlauf ist zurück (${zurueck.replace(/\s+/g, ' ')})`);

// --- Was seitdem dazukam, bleibt stehen ---
await page.locator('.tab[data-tab="settings"]').click();
await page.waitForTimeout(150);
check(await page.locator('[data-act="restore-round"]').count() === 0,
  'ist die Ablage leer, verschwindet der Knopf wieder');

// --- Zweiter Durchgang: neuer Fortschritt überlebt das Zurückholen ---
await page.evaluate(async () => {
  const s = await import('./js/store.js');
  s.restartPlan(0);
  s.markDone(2, 'db');
});
await page.evaluate(async () => (await import('./js/store.js')).restoreRound());
const beides = await page.evaluate(async () => {
  const s = await import('./js/store.js');
  return Object.keys(s.getState().log).sort().join(',');
});
check(beides === '1,2', `alter und neuer Verlauf stehen nebeneinander (${beides})`);

// --- Ein Verlauf aus einem anderen Fokus gehört nicht auf diesen Plan ---
await page.evaluate(async () => {
  const s = await import('./js/store.js');
  s.restartPlan(0);
  s.markDone(1, 'db');
  s.markDone(2, 'db');
});
// Fokuswechsel: legt den Verlauf ab und schaltet um.
await page.locator('.tab[data-tab="settings"]').click();
await page.waitForTimeout(250);
await page.locator('[data-act="set-focus"][data-v="beine"]').click();
await page.waitForTimeout(1500);
const nachWechsel = await page.evaluate(async () => {
  const s = await import('./js/store.js');
  const st = s.getState();
  return {
    focus: st.focus,
    ablage: st.rounds.map((r) => r.focus),
    holbar: !!s.restorable(),
    log: Object.keys(st.log).length,
  };
});
check(nachWechsel.focus === 'beine', `Fokus steht auf beine (${nachWechsel.focus})`);
check(nachWechsel.log === 0, 'der Plan startet leer');
check(nachWechsel.ablage[nachWechsel.ablage.length - 1] === 'standard',
  `der abgelegte Verlauf trägt den Fokus, aus dem er stammt (${nachWechsel.ablage.join(',')})`);
check(!nachWechsel.holbar, 'und lässt sich hier nicht zurückholen – die Nummern meinen andere Übungen');
await page.locator('.tab[data-tab="settings"]').click();
await page.waitForTimeout(300);
check(await page.locator('[data-act="restore-round"]').count() === 0,
  'der Knopf erscheint dort gar nicht erst');
check((await page.locator('#view').textContent()).includes('anderen'),
  'dafür steht da, warum');

// Zurück auf den alten Fokus: jetzt passt er wieder.
await page.locator('[data-act="set-focus"][data-v="standard"]').click();
await page.waitForTimeout(1500);
await page.locator('.tab[data-tab="settings"]').click();
await page.waitForTimeout(300);
check(await page.locator('[data-act="restore-round"]').count() === 1,
  'zurück im ausgewogenen Plan steht der Knopf wieder da');
await page.locator('[data-act="restore-round"]').click();
await page.waitForTimeout(400);
const zurueckAlt = await page.evaluate(async () => Object.keys((await import('./js/store.js')).getState().log).sort().join(','));
check(zurueckAlt === '1,2', `und holt genau den richtigen Verlauf (${zurueckAlt})`);

console.log(`\n${fails ? fails + ' FEHLER' : 'alle Prüfungen bestanden'}`);
console.log('ERRORS:', errs.length ? errs : 'none');
await browser.close();
