/*
 * Heute anfangen, obwohl der Plan erst später beginnt.
 *
 * Die Termine kommen aus der Excel und können in der Zukunft liegen. Die
 * Nachrück-Automatik half da nicht: Sie schiebt nur, was verstrichen ist.
 */
import { chromium } from 'playwright';
import { URL } from './umgebung.mjs';

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 414, height: 896 } });

// Datum fest verdrahten, sonst hängt der Test am Kalender des Rechners.
await ctx.addInitScript(() => {
  let iso = null;
  try { iso = localStorage.getItem('__testday'); } catch { /* about:blank */ }
  if (!iso) return;
  const Real = Date;
  const fixed = new Real(`${iso}T12:00:00`).getTime();
  function Mock(...args) {
    if (!(this instanceof Mock)) return new Real(fixed).toString();
    return args.length === 0 ? new Real(fixed) : new Real(...args);
  }
  Mock.prototype = Real.prototype;
  Mock.now = () => fixed;
  Mock.parse = Real.parse;
  Mock.UTC = Real.UTC;
  window.Date = Mock;
});

const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()); });
let fails = 0;
const check = (c, m) => { console.log(`${c ? 'OK  ' : 'FAIL'} ${m}`); if (!c) { fails++; process.exitCode = 1; } };

await page.goto(URL, { waitUntil: 'networkidle' });
await page.evaluate(() => { localStorage.clear(); localStorage.setItem('workout.state.v1', '{"greeted":true}'); });

const P = await page.evaluate(async () => (await import('./js/data.js')).PLAN.slice(0, 3).map((w) => w.date));
const plus = (iso, d) => {
  const x = new Date(`${iso}T12:00:00`);
  x.setDate(x.getDate() + d);
  return x.toISOString().slice(0, 10);
};
const MON = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli',
  'August', 'September', 'Oktober', 'November', 'Dezember'];
const de = (iso) => {
  const x = new Date(`${iso}T12:00:00`);
  return `${x.getDate()}. ${MON[x.getMonth()]}`;
};

// Fünf Tage vor dem Plantag: genau die Lage, in der die App bisher nur
// „in 5 Tagen" anzeigen konnte.
const heute = plus(P[0], -5);
await page.evaluate((v) => localStorage.setItem('__testday', v), heute);
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(200);

const eyebrow = () => page.locator('.hero-eyebrow').textContent();
const title = () => page.locator('.hero-title').textContent();
const shift = () => page.evaluate(() => JSON.parse(localStorage.getItem('workout.state.v1') || '{}').shift ?? 0);

console.log('     vorher:', (await eyebrow()).trim(), '·', (await title()).trim());
check((await eyebrow()).startsWith('in 5 Tagen'), 'Plan beginnt erst in fünf Tagen');
check(await shift() === 0, 'die Nachrück-Automatik rührt sich nicht (richtig so)');

const knopf = page.locator('[data-act="start-today"]');
check(await knopf.count() >= 1, 'Knopf „Heute anfangen" ist da');
check((await knopf.first().textContent()).includes('5 Tage'), 'er nennt die Zahl der Tage');

await knopf.first().click();
await page.waitForTimeout(300);
console.log('     nachher:', (await eyebrow()).trim(), '·', (await title()).trim());
check((await eyebrow()).startsWith('Heute'), 'Workout 1 ist jetzt heute fällig');
check((await title()).includes(de(heute)), `und trägt das heutige Datum (${de(heute)})`);
check(await shift() === -5, 'die Verschiebung ist negativ (−5)');
check(await page.locator('[data-act="start-today"]').count() === 0, 'der Knopf verschwindet, wenn nichts vorzuziehen ist');

// Die Abstände bleiben: Workout 2 liegt genauso weit weg wie im Plan.
const w2 = await page.evaluate(async () => {
  const app = document.querySelector('[data-act="nav-workout"][data-delta="1"]');
  app.click();
  return new Promise((r) => setTimeout(() => r(document.querySelector('.hero-title').textContent), 200));
});
const abstand = (Date.parse(`${P[1]}T12:00:00`) - Date.parse(`${P[0]}T12:00:00`)) / 86400000;
console.log('     Workout 2:', w2.trim(), `(Plan-Abstand ${abstand} Tage)`);
check(w2.includes(de(plus(heute, abstand))), `Workout 2 behält den Abstand von ${abstand} Tagen`);

// Und der Weg zurück: „Auf Original" stellt die Excel-Termine wieder her.
await page.locator('.tab[data-tab="settings"]').click();
await page.waitForTimeout(200);
await page.locator('[data-act="shift-reset"]').click();
await page.waitForTimeout(250);
check(await shift() === 0, '„Auf Original" räumt die Verschiebung wieder weg');

// Von Hand nach vorn: der Minus-Knopf ist bei 0 nicht mehr gesperrt.
await page.locator('[data-act="shift-minus"]').click();
await page.waitForTimeout(250);
check(await shift() === -1, 'auch − 1 Tag geht jetzt unter null');

console.log(`\n${fails ? fails + ' FEHLER' : 'alle Prüfungen bestanden'}`);
console.log('ERRORS:', errs.length ? errs : 'none');
await browser.close();
