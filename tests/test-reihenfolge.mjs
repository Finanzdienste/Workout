/*
 * Reihenfolge in der Einheit: Umbauten sparen, aber keine Isolation vor eine
 * Grundübung am selben Muskel ziehen.
 *
 * Abgelesen wird die Ansicht selbst – das ist die Reihenfolge, die er im
 * Training vor sich hat, nicht die im Plan.
 */
import { chromium } from 'playwright';
import { URL } from './umgebung.mjs';

const EINHEITEN = 84;

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 414, height: 896 } });
await ctx.route('**/rest/v1/**', (r) => r.fulfill({ status: 204, body: '' }));
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message));

let fails = 0;
const check = (c, m) => { console.log(`${c ? 'OK  ' : 'FAIL'} ${m}`); if (!c) { fails++; process.exitCode = 1; } };

await page.goto(URL, { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.setItem('workout.state.v1',
  JSON.stringify({ greeted: true, name: 'Tobi', mode: 'db' })));
await page.reload({ waitUntil: 'networkidle' });

const meta = await page.evaluate(async () => {
  const d = await import('./js/data.js');
  return {
    nachName: Object.fromEntries(d.EXERCISES.map((e) => [e.db.name, e.id])),
    ex: Object.fromEntries(d.EXERCISES.map((e) => [e.id, {
      tier: e.tier,
      equip: e.equip,
      kg: e.weight,
      direkt: Object.entries(e.db.shares).filter(([, v]) => v >= 0.5).map(([m]) => m),
    }])),
  };
});
check(meta.ex['liegende-trizepsstrecker'].tier === 3, 'die Stufe je Übung steht in den Daten');

// --- Durchblättern und ablesen ---
const gelesen = [];
await page.locator('[data-act="show-list"]').first().click();
await page.waitForTimeout(200);
for (let i = 0; i < EINHEITEN; i++) {
  const namen = await page.locator('.ex-name').allTextContents();
  gelesen.push(namen.map((t) => meta.nachName[t.trim()] || t.trim()));
  const weiter = page.locator('[data-act="nav-workout"][data-delta="1"]').first();
  if (!(await weiter.count()) || await weiter.isDisabled()) break;
  await weiter.click();
  await page.waitForTimeout(60);
  const auf = page.locator('[data-act="show-list"]');
  if (await auf.count()) { await auf.first().click(); await page.waitForTimeout(40); }
}
check(gelesen.length === EINHEITEN, `${gelesen.length} von ${EINHEITEN} Einheiten abgelesen`);
check(gelesen.every((l) => l.length >= 4), 'jede Einheit hat ihre Übungen');

// --- 1. Keine kleine Übung vor einer schweren am selben Muskel ---
let konflikte = 0;
const beispiele = [];
gelesen.forEach((liste, idx) => {
  for (let a = 0; a < liste.length; a++) {
    for (let b = a + 1; b < liste.length; b++) {
      const A = meta.ex[liste[a]];
      const B = meta.ex[liste[b]];
      if (!A || !B || A.tier <= B.tier) continue;
      if (A.direkt.some((m) => B.direkt.includes(m))) {
        konflikte++;
        if (beispiele.length < 3) beispiele.push(`W${idx + 1}: ${liste[a]} vor ${liste[b]}`);
      }
    }
  }
});
check(konflikte === 0,
  `keine Isolation vor einer Grundübung am selben Muskel${beispiele.length ? ' – ' + beispiele.join(' | ') : ''}`);

// --- 2. Die Umbau-Ersparnis steht noch ---
const FAM = { barbell: 'lh', hipbar: 'lh', dumbbells: 'kh2', goblet: 'kh1', onehand: 'kh1', plate: 'kh1', backpack: 'ruck' };
const ruesten = (liste) => {
  let vorher = null;
  let n = 0;
  liste.forEach((id) => {
    const e = meta.ex[id];
    if (!e || !FAM[e.equip] || !e.kg) return;
    const jetzt = { fam: FAM[e.equip], kg: e.kg };
    if (!vorher || vorher.fam !== jetzt.fam || Math.abs(vorher.kg - jetzt.kg) > 0.01) n += 1;
    vorher = jetzt;
  });
  return n;
};
const jetzt = gelesen.reduce((s, l) => s + ruesten(l), 0);
const roh = await page.evaluate(async () => {
  const d = await import('./js/data.js');
  return d.PLAN.map((w) => w.ex.map((x) => x.id));
});
const ohne = roh.reduce((s, l) => s + ruesten(l), 0);
check(jetzt <= ohne, `Rüstvorgänge: ${jetzt} sortiert gegen ${ohne} in der Plan-Reihenfolge`);

console.log(`\n${fails ? fails + ' FEHLER' : 'alle Prüfungen bestanden'}`);
console.log('ERRORS:', errs.length ? errs : 'none');
await browser.close();
