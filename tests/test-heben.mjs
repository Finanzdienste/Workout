/* Hochnehmen und ablegen.
 *
 *     „Sag am besten bei jeder Übung auch immer wie man das Gewicht am besten
 *      zuhause hochnimmt und ablegt wenn man alleine ist und so"
 *
 * Geprüft wird die Anzeige, nicht der Text – den prüft tools/pruefung/geraete.py:
 *
 *   * In der Fokusansicht steht der Absatz unter dem Hinweis, wenn die Übung
 *     eine Last hat, und fehlt sonst.
 *   * In der Übungsliste hat genau jede Übung mit Last einen.
 *   * Ohne Hanteln gibt es keinen – da wird nichts gehoben.
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

await page.goto(URL, { waitUntil: 'networkidle' });
await page.evaluate(() => { localStorage.clear(); localStorage.setItem('workout.state.v1', '{"greeted":true,"mode":"db"}'); });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(300);

// Was die Daten sagen: welche Übungen der ersten Einheit eine Last haben.
const erwartet = await page.evaluate(async () => {
  const d = await import('./js/data.js');
  const { exOf, resolve } = await import('./js/plan.js');
  const w = d.PLAN[0];
  const ex = exOf(w, 'db').map((it) => resolve(it, 'db'));
  return {
    mitHeben: ex.filter((it) => it.heben).map((it) => it.id),
    ohneHeben: ex.filter((it) => !it.heben).map((it) => it.id),
    erste: ex[0].id, ersteHeben: !!ex[0].heben,
    katalogMit: d.EXERCISES.filter((e) => e.db.heben).length,
    katalogBw: d.EXERCISES.filter((e) => e.bw.heben).length,
  };
});
check(erwartet.katalogMit >= 20, `im Katalog haben ${erwartet.katalogMit} Übungen einen Absatz zum Hochnehmen`);
check(erwartet.katalogBw === 0, 'ohne Hanteln keine – da wird nichts gehoben');
check(erwartet.mitHeben.length > 0, `in der ersten Einheit ${erwartet.mitHeben.length} mit Last`);

// --- Fokusansicht ---
await page.locator('[data-act="start-session"]').first().click();
await page.waitForTimeout(400);
const fokus = await page.evaluate(() => ({
  cue: document.querySelectorAll('.focus-cue').length,
  heben: document.querySelectorAll('.heben').length,
  text: (document.querySelector('.heben') || {}).textContent || '',
  reihenfolge: (() => {
    const c = document.querySelector('.focus-cue');
    return c && c.nextElementSibling && c.nextElementSibling.classList.contains('heben');
  })(),
}));
check(fokus.cue === 1, 'die Fokusansicht ist offen');
check(fokus.heben === (erwartet.ersteHeben ? 1 : 0),
  `die erste Übung (${erwartet.erste}) hat ${erwartet.ersteHeben ? 'einen' : 'keinen'} Absatz (${fokus.heben})`);
if (erwartet.ersteHeben) {
  check(fokus.reihenfolge, 'er steht direkt unter dem Hinweis');
  check(fokus.text.startsWith('Hochnehmen und ablegen:'), `mit Vorspann („${fokus.text.slice(0, 40)}…")`);
}

// Durch die Einheit: jede Übung mit Last hat ihn, keine ohne.
const gesehen = { mit: 0, ohne: 0, falsch: [] };
for (let k = 0; k < erwartet.mitHeben.length + erwartet.ohneHeben.length; k++) {
  const hier = await page.evaluate(() => ({
    id: (document.querySelector('.focus-sets .set-btn') || {}).dataset?.ex,
    heben: document.querySelectorAll('.heben').length,
  }));
  const soll = erwartet.mitHeben.includes(hier.id);
  if (hier.heben === (soll ? 1 : 0)) gesehen[soll ? 'mit' : 'ohne']++;
  else gesehen.falsch.push(`${hier.id}: ${hier.heben}`);
  const next = page.locator('[data-act="focus-step"][data-d="1"]:not([disabled])');
  if (!(await next.count())) break;
  await next.click();
  await page.waitForTimeout(150);
}
check(gesehen.falsch.length === 0 && gesehen.mit === erwartet.mitHeben.length,
  `durch die Einheit: ${gesehen.mit} mit, ${gesehen.ohne} ohne Absatz, passend zur Last${
    gesehen.falsch.length ? ' – falsch: ' + gesehen.falsch.join(', ') : ''}`);

// --- Übungsliste ---
await page.locator('[data-act="focus-list"]').first().click();
await page.waitForTimeout(300);
const liste = await page.evaluate(() => document.querySelectorAll('article.ex .heben').length);
check(liste === erwartet.mitHeben.length,
  `in der Liste genau je Übung mit Last einer (${liste} von ${erwartet.mitHeben.length})`);

// --- Ohne Hanteln ---
await page.evaluate(async () => {
  const s = await import('./js/store.js');
  s.setSetting('mode', 'bw');
  s.flush();
});
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(300);
await page.locator('[data-act="start-session"]').first().click();
await page.waitForTimeout(400);
const bw = await page.evaluate(() => document.querySelectorAll('.heben').length);
check(bw === 0, `ohne Hanteln steht kein Absatz zum Hochnehmen (${bw})`);

console.log(`\n${fails ? fails + ' FEHLER' : 'alle Prüfungen bestanden'}`);
console.log('ERRORS:', errs.length ? errs : 'none');
await browser.close();
