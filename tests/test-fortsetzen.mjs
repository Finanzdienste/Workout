/*
 * Nach dem Neuladen geht eine laufende Einheit weiter, wo sie war.
 *
 *     „Immer wenn ich kurz aus der app rausgeh und wieder rein komm dann kommt
 *      das. Aber eigentlich sollte ja einfach die Übung kommen die jetzt als
 *      nächstes ansteht"
 *
 * Das Handy beendet eine Web-App im Hintergrund gern ganz; zurück lädt sie
 * neu. Geprüft wird:
 *
 *   1. Läuft eine heute begonnene Einheit, öffnet die App in der Fokusansicht.
 *   2. Bei der ersten Übung mit offenem Satz – ist die erste fertig, bei der
 *      zweiten.
 *   3. Eine Einheit von gestern wartet auf dem Dashboard.
 *   4. Wer auf einem anderen Reiter war, bleibt dort.
 *   5. Wer mitten im Training bewusst zurück aufs Dashboard gegangen ist,
 *      landet auch wieder dort.
 */
import { chromium } from 'playwright';
import { URL } from './umgebung.mjs';

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 414, height: 896 } });
await ctx.route('**/rest/v1/**', (r) => r.fulfill({ status: 204, body: '' }));
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message));
page.on('dialog', (d) => d.accept().catch(() => {}));
let fails = 0;
const check = (c, m) => { console.log(`${c ? 'OK  ' : 'FAIL'} ${m}`); if (!c) { fails++; process.exitCode = 1; } };

const blick = () => page.evaluate(() => ({
  fokus: !!document.querySelector('.focus-cue'),
  ex: (document.querySelector('.focus-sets .set-btn') || {}).dataset?.ex || null,
  start: !!document.querySelector('[data-act="start-session"]'),
}));

await page.goto(URL, { waitUntil: 'networkidle' });
await page.evaluate(() => {
  localStorage.clear();
  localStorage.setItem('workout.state.v1', JSON.stringify({ greeted: true, mode: 'db' }));
});
await page.reload({ waitUntil: 'networkidle' });

// Ohne laufende Einheit: das Dashboard, wie immer.
check(!(await blick()).fokus, 'ohne laufende Einheit öffnet die App auf dem Dashboard');

// --- 1. Einheit anfangen, einen Satz abhaken, neu laden ---------------
await page.locator('[data-act="start-session"]').first().click();
await page.waitForTimeout(400);
const erste = (await blick()).ex;
await page.locator('.focus-sets .set-btn').first().click();
await page.waitForTimeout(300);
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(300);
const nachReload = await blick();
check(nachReload.fokus, 'nach dem Neuladen steht die Fokusansicht da, nicht das Dashboard');
check(nachReload.ex === erste, `bei der Übung, in der noch ein Satz offen ist (${nachReload.ex})`);

// --- 2. Erste Übung fertig: dann die nächste ---------------------------
const plan = await page.evaluate(async () => {
  const { getState } = await import('./js/store.js');
  const { workoutByNo } = await import('./js/plan.js');
  const n = getState().session.n;
  return { n, ex: workoutByNo(n, 'db').ex.map((x) => ({ id: x.id, sets: x.sets })) };
});
// Alle Sätze der ersten Übung abhaken – über den Speicher, so wie ein Tipp es
// tut (updateSet), damit keine Pause und kein Supersatz dazwischenfunkt.
await page.evaluate(async (p) => {
  const store = await import('./js/store.js');
  const { id, sets } = p.ex[0];
  for (let i = 0; i < sets; i++) store.updateSet(p.n, 'db', id, sets, i, { done: true });
  store.flush();
}, plan);
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(300);
const weiter = await blick();
const erwartet = await page.evaluate(async (n) => {
  const { getState } = await import('./js/store.js');
  const { workoutByNo } = await import('./js/plan.js');
  const e = getState().log[n] || {};
  const offen = workoutByNo(n, 'db').ex.find((x) => ((e.db || {})[x.id] || []).filter((s) => s && s.done).length < x.sets);
  return offen ? offen.id : null;
}, plan.n);
check(weiter.fokus && weiter.ex === erwartet && erwartet !== plan.ex[0].id,
  `ist die erste Übung durch, geht es bei der nächsten offenen weiter (${weiter.ex}, erwartet ${erwartet})`);

// --- 3. Eine Einheit von gestern wartet auf dem Dashboard --------------
await page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('workout.state.v1'));
  const gestern = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  s.clock = { ...(s.clock || {}), on: gestern };
  localStorage.setItem('workout.state.v1', JSON.stringify(s));
  // Ab hier schreibt diese Seite nichts mehr zurück – sonst setzte die App
  // beim Verlassen (pagehide) ihren eigenen Stand wieder drüber.
  window.Storage.prototype.setItem = () => {};
});
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(300);
check(!(await blick()).fokus, 'eine Einheit von gestern öffnet nicht von selbst');

// --- 4. Anderer Reiter: bleibt ------------------------------------------
await page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('workout.state.v1'));
  s.clock = { ...(s.clock || {}), on: new Date().toISOString().slice(0, 10) };
  s.tab = 'stats';
  localStorage.setItem('workout.state.v1', JSON.stringify(s));
  window.Storage.prototype.setItem = () => {};
});
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(300);
const reiter = await page.evaluate(() => ({
  fokus: !!document.querySelector('.focus-cue'),
  tab: (document.querySelector('.tab.active, .tab[aria-current="page"]') || {}).dataset?.tab || null,
}));
check(!reiter.fokus, `wer auf einem anderen Reiter war, bleibt dort (${reiter.tab})`);

// --- 5. Bewusst zurück aufs Dashboard: bleibt dort ------------------------
// Eigener Kontext, eigener Speicher – die Seite von oben hat ihren Stand
// eingefroren (setItem abgeschaltet) und hält noch Verbindungen offen.
await page.close();
const ctx2 = await browser.newContext({ viewport: { width: 414, height: 896 } });
await ctx2.route('**/rest/v1/**', (r) => r.fulfill({ status: 204, body: '' }));
const seite = await ctx2.newPage();
seite.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message));
await seite.goto(URL, { waitUntil: 'networkidle' });
await seite.evaluate(() => {
  localStorage.clear();
  localStorage.setItem('workout.state.v1', JSON.stringify({ greeted: true, mode: 'db' }));
});
await seite.reload({ waitUntil: 'networkidle' });
await seite.locator('[data-act="start-session"]').first().click();
await seite.waitForTimeout(300);
await seite.goBack();
await seite.waitForTimeout(300);
const zurueck = await seite.evaluate(() => !!document.querySelector('.focus-cue'));
await seite.reload({ waitUntil: 'networkidle' });
await seite.waitForTimeout(300);
const danach = await seite.evaluate(() => ({
  fokus: !!document.querySelector('.focus-cue'),
  weiter: !!document.querySelector('[data-act="start-session"]'),
}));
check(!zurueck && !danach.fokus && danach.weiter,
  'wer im Training zurück aufs Dashboard geht, findet nach dem Neuladen das Dashboard mit „fortsetzen"');

console.log(`\n${fails ? fails + ' FEHLER' : 'alle Prüfungen bestanden'}`);
console.log('ERRORS:', errs.length ? errs : 'none');
if (errs.length) process.exitCode = 1;
await browser.close();
