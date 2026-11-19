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
// Seit v271 ohne Nummer („Die Workout Nummer ist mir … komplett egal"): Oben
// steht das Wann (bis v270 „T · in 2 Tagen · Workout 2"), der Knopf nennt den
// Tag der laufenden („Zurück zum Workout von heute", bis v270 „Zurück zu
// Workout 1"). Welche Einheit es ist, sagt data-n.
const andere = await page.evaluate(() => ({
  kopf: ((document.querySelector('.hero-eyebrow') || {}).textContent || '').replace(/\s+/g, ' ').trim(),
  kopfN: (document.querySelector('.hero-eyebrow') || { dataset: {} }).dataset.n,
  start: [...document.querySelectorAll('[data-act="start-session"]')].map((b) => b.textContent.replace(/\s+/g, ' ').trim()),
  zurueck: ((document.querySelector('[data-act="zur-laufenden"]') || {}).textContent || '').replace(/\s+/g, ' ').trim(),
  zurueckN: (document.querySelector('[data-act="zur-laufenden"]') || { dataset: {} }).dataset.n,
}));
// Das Wann über Workout 2 aus seinem Termin, so wie wannWort() in js/app.js
// es schreibt (Workout 2 ist nicht angefangen).
const w2Tage = await page.evaluate(async () => {
  const P = await import('./js/plan.js');
  const { PLAN } = await import('./js/data.js');
  const d = await import('./js/dates.js');
  return d.daysBetween(d.todayISO(), P.effDate(PLAN[1]));
});
const wann = (t) => (t === 0 ? 'Heute' : t === 1 ? 'Morgen' : t === -1 ? 'Gestern'
  : t > 1 ? `in ${t} Tagen` : `vor ${-t} Tagen`);
const kopfSoll = `T · ${wann(w2Tage)}`;
check(andere.kopfN === '2' && andere.kopf === kopfSoll
  && andere.zurueckN === '1' && /^\u25B6\uFE0E? Zurück zum Workout von heute$/.test(andere.zurueck),
  `auf Workout 2 führt der erste Knopf zurück zur laufenden (${andere.zurueck} [${andere.zurueckN}] · oben „${
    andere.kopf}" [${andere.kopfN}], erwartet „${kopfSoll}")`);
check(andere.start.length === 1 && andere.start[0] === 'Diese starten – das Workout von heute wird beendet',
  `und wer hier startet, liest, dass Workout 1 dabei endet (${andere.start.join(' | ')})`);
await page.locator('[data-act="zur-laufenden"]').click();
await page.waitForTimeout(200);
const zurueckIn = await page.evaluate(async () => ({
  fokus: !!document.querySelector('.focus-cue'),
  n: (await import('./js/store.js')).getState().session?.n,
}));
check(zurueckIn.fokus && zurueckIn.n === 1, `„Zurück" landet in der laufenden Einheit, die weiterläuft (${JSON.stringify(zurueckIn)})`);

// Dieselbe Weiche in der Übungsliste von Workout 2. Dort stand bisher der
// schlichte Knopf „▶︎ Workout starten", und ein Tipp beendete Workout 1 ohne
// ein Wort davor. Und „‹ Zurück" führte in die Fokusansicht einer Einheit,
// die hier gar nicht gezeigt wird – `ui.focus` blieb hängen.
await zumBrett();
await page.locator('[data-act="show-list"]').first().click();
await page.waitForTimeout(200);
const inListe = await page.evaluate(() => ({
  start: [...document.querySelectorAll('[data-act="start-session"]')].map((b) => b.textContent.replace(/\s+/g, ' ').trim()),
  zurueck: !!document.querySelector('[data-act="zur-laufenden"]'),
  zurueckN: (document.querySelector('[data-act="zur-laufenden"]') || { dataset: {} }).dataset.n,
  hinweis: !!document.querySelector('.laeuft-woanders'),
  hinweisText: ((document.querySelector('.laeuft-woanders') || {}).textContent || '').replace(/\s+/g, ' ').trim(),
  back: (document.querySelector('.back-link') || { dataset: {} }).dataset.act,
}));
// „Das Workout von heute läuft noch." – bis v270 „Workout 1 läuft noch."
check(inListe.zurueck && inListe.zurueckN === '1' && inListe.hinweis
  && inListe.hinweisText === 'Das Workout von heute läuft noch.',
  `auch die Liste von Workout 2 sagt, dass Workout 1 läuft, und führt zurück (${JSON.stringify(inListe)})`);
check(inListe.start.length === 1 && inListe.start[0] === 'Diese starten – das Workout von heute wird beendet',
  `wer dort startet, liest vorher, dass Workout 1 endet (${inListe.start.join(' | ')})`);
check(inListe.back === 'hide-list', `„‹ Zurück" führt zur Übersicht von Workout 2 (${inListe.back})`);
await page.locator('.back-link').first().click();
await page.waitForTimeout(200);
const nachZurueck = await page.evaluate(async () => ({
  kopf: ((document.querySelector('.hero-eyebrow') || {}).textContent || '').replace(/\s+/g, ' ').trim(),
  kopfN: (document.querySelector('.hero-eyebrow') || { dataset: {} }).dataset.n,
  fokusOffen: (await import('./js/store.js')).getState().fokusOffen,
  session: (await import('./js/store.js')).getState().session?.n,
}));
check(nachZurueck.kopfN === '2' && nachZurueck.kopf === kopfSoll && nachZurueck.session === 1
  && !(nachZurueck.fokusOffen && nachZurueck.fokusOffen.n === 2),
  `danach steht die Übersicht von Workout 2 da – oben „${kopfSoll}", ohne Nummer –, ohne hängende Fokusansicht (${JSON.stringify(nachZurueck)})`);
await page.locator('[data-act="zur-laufenden"]').click();
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
