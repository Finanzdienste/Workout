/*
 * Die Erfahrungsstufe bestimmt das Volumen, der Fokus die Verteilung.
 *
 * Zwei Dinge müssen dabei stimmen: die Satzzahl ändert sich wirklich, und ein
 * Stufenwechsel löscht nichts, was schon abgehakt ist.
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

const stellen = async (level, focus = 'standard') => {
  await page.evaluate(([l, f]) => localStorage.setItem('workout.state.v1',
    JSON.stringify({ greeted: true, name: 'T', level: l, focus: f })), [level, focus]);
  await page.reload({ waitUntil: 'networkidle' });
};
const saetzeJeUebung = async () => {
  const auf = page.locator('[data-act="show-list"]');
  if (await auf.count()) { await auf.first().click(); await page.waitForTimeout(150); }
  return page.locator('.ex-sets').first().locator('.set-btn').count();
};

await page.goto(URL, { waitUntil: 'networkidle' });

// --- 1. Die Stufe bestimmt die Satzzahl ---
for (const [stufe, soll] of [['anfaenger', 2], ['geuebt', 3], ['fortgeschritten', 4]]) {
  await stellen(stufe);
  const n = await saetzeJeUebung();
  check(n === soll, `${stufe}: ${n} Sätze je Übung (erwartet ${soll})`);
}

// --- 2. Das Wochensoll skaliert mit, sonst stimmt "Soll gegen Ist" nicht ---
// Sonst stünde beim Anfänger dauerhaft "0 von 12 Gruppen im Ziel", obwohl er
// genau das gemacht hat, was sein Plan vorsieht.
const sollBrust = async (stufe) => {
  await stellen(stufe);
  await page.locator('[data-act="start-session"]').first().click();
  await page.waitForTimeout(200);
  await page.locator('.focus-set').first().click();
  await page.waitForTimeout(150);
  await page.locator('.tab[data-tab="stats"]').click();
  await page.waitForTimeout(400);
  const t = (await page.locator('#volWeek').textContent()).replace(/\s+/g, ' ');
  const m = t.match(/Brust [\d,]+\/([\d,]+)/);
  return m ? Number(m[1].replace(',', '.')) : null;
};
const sollA = await sollBrust('anfaenger');
const sollG = await sollBrust('geuebt');
const sollF = await sollBrust('fortgeschritten');
check(sollA !== null && sollG !== null, `das Wochensoll steht in der Statistik (${sollA} / ${sollG})`);
check(sollA < sollG && sollG < sollF,
  `und wächst mit der Stufe: Anfänger ${sollA} < Geübt ${sollG} < Fortgeschritten ${sollF}`);
check(Math.abs(sollA / sollG - 2 / 3) < 0.02,
  `der Anfänger liegt bei zwei Dritteln (${(sollA / sollG).toFixed(2)})`);

// --- 3. Ein Stufenwechsel löscht keine abgehakten Sätze ---
await stellen('geuebt');
await page.locator('[data-act="start-session"]').first().click();
await page.waitForTimeout(250);
for (let i = 0; i < 3; i++) { await page.locator('.focus-set').nth(i).click(); await page.waitForTimeout(120); }
const vorher = await page.evaluate(async () => {
  const s = (await import('./js/store.js')).getState();
  const erste = Object.values(s.log[1].db)[0];
  return erste.filter((x) => x.done).length;
});
check(vorher === 3, `drei Sätze abgehakt (${vorher})`);

await page.evaluate(async () => (await import('./js/store.js')).setSetting('level', 'anfaenger'));
await page.reload({ waitUntil: 'networkidle' });
await saetzeJeUebung();
const nachher = await page.evaluate(async () => {
  const s = (await import('./js/store.js')).getState();
  const erste = Object.values(s.log[1].db)[0];
  return { gespeichert: erste.length, abgehakt: erste.filter((x) => x.done).length };
});
check(nachher.abgehakt === 3,
  `nach dem Wechsel auf Anfänger stehen die drei Sätze noch im Protokoll (${nachher.abgehakt})`);
check(nachher.gespeichert === 3, 'der Eintrag wurde nicht gekürzt');

// --- 4. Leere Sätze werden dagegen sehr wohl weggeräumt ---
await page.evaluate(async () => {
  const s = await import('./js/store.js');
  s.restartPlan(0);
  s.getSets(5, 'db', 'chin-ups', 3);      // drei leere anlegen
});
const leer = await page.evaluate(async () => {
  const s = await import('./js/store.js');
  return s.getSets(5, 'db', 'chin-ups', 2).length;   // Anfänger fragt nur zwei
});
check(leer === 2, `leere Sätze werden auf die neue Zahl gekürzt (${leer})`);

console.log(`\n${fails ? fails + ' FEHLER' : 'alle Prüfungen bestanden'}`);
console.log('ERRORS:', errs.length ? errs : 'none');
await browser.close();
