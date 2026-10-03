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

// --- Weggehen hält die Uhr an, auch während einer Pause -----------------
//
//     „Die Zeit geht iwie immer weiter wenn ich aus der app rausgeh"
//
// Und so war es: Solange eine Pause lief, hielt die Uhr beim Verlassen gar
// nicht an. Nach einem abgehakten Satz läuft fast immer eine – wer danach das
// Handy weglegte, sammelte jede Minute als Trainingszeit ein. Jetzt hält sie
// immer an; nachgetragen wird nur, was beim Verschwinden noch Pause war.
await page.evaluate(() => localStorage.setItem('workout.state.v1',
  JSON.stringify({ greeted: true, name: 'T', restSeconds: 60, useExerciseRest: false })));
await page.reload({ waitUntil: 'networkidle' });
await page.locator('[data-act="start-session"]').first().click();
await page.waitForTimeout(600);
await page.locator('.focus-set').first().click();   // startet die Pause
await page.waitForTimeout(600);
const pauseLaeuft = await page.evaluate(async () => !!(await import('./js/store.js')).getState().rest);
check(pauseLaeuft, 'nach dem Satz läuft eine Pause');

const vorWeg = await page.evaluate(async () =>
  (await import('./js/store.js')).sessionSeconds());
await page.evaluate(() => {
  window.__hidden = true;
  document.dispatchEvent(new Event('visibilitychange'));
});
await page.waitForTimeout(2500);
const imWeg = await page.evaluate(async () =>
  (await import('./js/store.js')).sessionSeconds());
check(imWeg === vorWeg,
  `während die App weg ist, steht die Uhr (${vorWeg} -> ${imWeg} s)`);

await page.evaluate(() => {
  window.__hidden = false;
  document.dispatchEvent(new Event('visibilitychange'));
});
await page.waitForTimeout(300);
const zurueck = await page.evaluate(async () =>
  (await import('./js/store.js')).sessionSeconds());
console.log(`     vor dem Weggehen ${vorWeg} s, weg ${imWeg} s, zurück ${zurueck} s`);
check(zurueck >= vorWeg + 2 && zurueck <= vorWeg + 4,
  `die abgelaufene Pause wird nachgetragen, der Rest nicht (${zurueck} s)`);
await page.locator('[data-act="finish-session"]').first().click();
await page.waitForTimeout(300);

// --- Eine zweite Einheit starten, während eine läuft --------------------
// Auf der Übersicht der nächsten Einheit stand „▶︎ Start", und ein Tipp
// ersetzte die Uhr der laufenden: Ihre Zeit seit dem letzten Wegschalten war
// weg. Jetzt führt der erste Knopf zurück, und wer doch wechselt, wechselt
// mit gebuchter Zeit.
await page.evaluate(() => localStorage.setItem('workout.state.v1',
  JSON.stringify({ greeted: true, name: 'T', restSeconds: 0, useExerciseRest: false })));
await page.reload({ waitUntil: 'networkidle' });
await page.locator('[data-act="start-session"]').first().click();
await page.waitForTimeout(2500);
await page.locator('.focus-set').first().click();
await page.waitForTimeout(300);
// Aus der Fokusansicht in die Liste und dort eine Einheit weiter.
const zumBrett = async () => {
  await page.locator('[data-act="focus-list"]').click();
  await page.waitForTimeout(200);
  await page.locator('[data-act="nav-workout"][data-delta="1"]').first().click();
  await page.waitForTimeout(200);
};
await zumBrett();
const andere = await page.evaluate(() => ({
  kopf: (document.querySelector('.hero-eyebrow') || {}).textContent || '',
  start: [...document.querySelectorAll('[data-act="start-session"]')].map((b) => b.textContent.replace(/\s+/g, ' ').trim()),
  zurueck: (document.querySelector('[data-act="zur-laufenden"]') || {}).textContent || '',
}));
check(/Workout 2/.test(andere.kopf) && /Workout 1/.test(andere.zurueck),
  `auf Workout 2 führt der erste Knopf zurück zur laufenden (${andere.zurueck.replace(/\s+/g, ' ').trim()})`);
check(andere.start.length === 1 && /wird beendet/.test(andere.start[0]),
  `und wer hier startet, liest, dass Workout 1 dabei endet (${andere.start.join(' | ')})`);
await page.locator('[data-act="zur-laufenden"]').click();
await page.waitForTimeout(200);
const zurueckIn = await page.evaluate(async () => ({
  fokus: !!document.querySelector('.focus-cue'),
  n: (await import('./js/store.js')).getState().session?.n,
}));
check(zurueckIn.fokus && zurueckIn.n === 1, `„Zurück" landet in der laufenden Einheit, die weiterläuft (${JSON.stringify(zurueckIn)})`);
await page.waitForTimeout(1000);
await zumBrett();
await page.locator('[data-act="start-session"]').first().click();
await page.waitForTimeout(300);
const gewechselt = await page.evaluate(async () => {
  const s = (await import('./js/store.js')).getState();
  return { n: s.session?.n, secs1: (s.log[1] || {}).secs || 0, uhr: s.clock?.n };
});
check(gewechselt.n === 2 && gewechselt.uhr === 2, `gewechselt wird erst auf ausdrücklichen Tipp (${JSON.stringify(gewechselt)})`);
check(gewechselt.secs1 >= 3, `und die Zeit von Workout 1 ist gebucht (${gewechselt.secs1} s)`);
await page.locator('[data-act="finish-session"]').first().click().catch(() => {});
await page.waitForTimeout(300);


console.log(`\n${fails ? fails + ' FEHLER' : 'alle Prüfungen bestanden'}`);
console.log('ERRORS:', errs.length ? errs : 'none');
await browser.close();
