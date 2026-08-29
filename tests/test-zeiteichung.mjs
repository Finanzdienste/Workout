/*
 * Die Zeitschätzung an der echten Uhr eichen.
 *
 * „ca. 50 min" steht an jeder Variante, und nach dieser Zahl sucht jemand
 * seinen Plan aus. Sie kam aus einer Formel: 40 Sekunden je Satz plus die
 * vorgesehene Pause – beides geraten. Die Uhr misst derweil längst mit und
 * wurde nur angezeigt.
 *
 * Drei Dinge müssen stimmen, und zwei davon sind Fälle, in denen die App die
 * Formel *behalten* muss:
 *
 *   1. Ohne gemessene Einheiten bleibt es bei „ca." – eine Eichung aus dem
 *      Nichts wäre schlechter als eine ehrliche Schätzung.
 *   2. Eine einzelne Einheit reicht nicht. Wer beim ersten Mal zwischendurch
 *      telefoniert, bekäme sonst für den Rest des Plans falsche Zahlen.
 *   3. Ab fünf Einheiten rechnet sie mit der Uhr – und sagt, dass sie es tut.
 */
import { chromium } from 'playwright';
import { URL } from './umgebung.mjs';

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 414, height: 896 } });
await ctx.route('**/rest/v1/**', (r) => r.fulfill({ status: 204, body: '' }));
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message));
let fails = 0;
const check = (c, m) => { console.log(`${c ? 'OK  ' : 'FAIL'} ${m}`); if (!c) { fails++; process.exitCode = 1; } };

/**
 * Ein Protokoll über `n` vollständige Einheiten, bei denen die Uhr das
 * `faktor`-fache dessen gemessen hat, was die Formel vorsieht.
 */
const protokoll = (n, faktor) => page.evaluate(async ([anzahl, f]) => {
  const { PLAN, EXERCISES } = await import('./js/data.js');
  const byId = new Map(EXERCISES.map((e) => [e.id, e]));
  const log = {};
  PLAN.slice(0, anzahl).forEach((w) => {
    const e = { mode: 'db', done: 'db', db: {} };
    let formel = 0;
    w.ex.forEach((it, i) => {
      e.db[it.id] = Array.from({ length: it.sets }, () => ({ w: '20', r: '', done: true }));
      const pause = byId.get(it.id).db.rest || 120;
      formel += it.sets * (40 + pause);
      if (i === w.ex.length - 1) formel -= pause;
    });
    e.secs = Math.round(formel * f);
    log[w.n] = e;
  });
  return log;
}, [n, faktor]);

const setze = (z) => page.evaluate(
  (o) => localStorage.setItem('workout.state.v1', JSON.stringify(o)), z);

const fokusZeilen = async () => {
  await page.locator('.tab[data-tab="settings"]').click();
  await page.waitForTimeout(350);
  // Nur die Fokus-Karten: .fokus-zahl steht auch an den Erfahrungsstufen.
  return (await page.locator('[data-act="set-focus"] .fokus-zahl').allTextContents())
    .map((s) => s.replace(/\s+/g, ' ').trim());
};

await page.goto(URL, { waitUntil: 'networkidle' });

// --- 1. Ohne gemessene Zeit bleibt es bei der Formel --------------------
await setze({ greeted: true, name: 'T', level: 'geuebt', shift: 0, log: {} });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(300);
let zeilen = await fokusZeilen();
console.log('     ohne Messung:', zeilen[0]);
check(zeilen.length === 4, `vier Plänen steht eine Dauer dabei (${zeilen.length})`);
check(zeilen.every((z) => /ca\. \d+ min/.test(z)), 'alle sagen „ca." – es ist eine Schätzung');
check(!zeilen.some((z) => /gemessen/.test(z)), 'und keiner behauptet, gemessen zu sein');

// --- 2. Eine einzelne Einheit reicht nicht ------------------------------
await setze({ greeted: true, name: 'T', level: 'geuebt', shift: 0, log: await protokoll(1, 1.4) });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(300);
zeilen = await fokusZeilen();
console.log('     nach einer Einheit:', zeilen[0]);
check(zeilen.every((z) => /ca\. /.test(z)),
  'eine gemessene Einheit ändert nichts – zu wenig, um daraus zu schließen');

// --- 3. Ab fünf rechnet sie mit der Uhr ---------------------------------
// 40 % länger als die Formel: der typische Fall, wenn zwischen den Sätzen
// umgebaut wird und die Pause großzügiger ausfällt als vorgesehen.
const ohne = zeilen.map((z) => Number((z.match(/(\d+) min/) || [])[1]));
await setze({ greeted: true, name: 'T', level: 'geuebt', shift: 0, log: await protokoll(6, 1.4) });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(300);
zeilen = await fokusZeilen();
console.log('     nach sechs Einheiten:', zeilen[0]);
check(zeilen.every((z) => /gemessen/.test(z)), 'jetzt steht „gemessen" dran');
check(!zeilen.some((z) => /ca\. /.test(z)), 'und „ca." ist weg – es ist keine Schätzung mehr');
const mit = zeilen.map((z) => Number((z.match(/(\d+) min/) || [])[1]));
console.log(`     Formel ${ohne.join('/')} min  ->  gemessen ${mit.join('/')} min`);
check(mit.every((m, i) => m > ohne[i]), 'die Zahlen steigen, weil dieser Nutzer länger braucht');
check(mit[0] / ohne[0] > 1.25 && mit[0] / ohne[0] < 1.55,
  `und zwar um die gemessenen 40 % (${(mit[0] / ohne[0]).toFixed(2)}×)`);

// --- 4. Es steht auch in der Statistik, woher die Zahl kommt ------------
await page.locator('.tab[data-tab="stats"]').click();
await page.waitForTimeout(400);
const stats = (await page.locator('#view').textContent()).replace(/\s+/g, ' ');
check(/keine Schätzung mehr/.test(stats), 'die Statistik sagt, dass gerechnet statt geraten wird');
check(/40 % mehr/.test(stats), `und um wie viel (${(stats.match(/\d+ % (mehr|weniger)/) || [])[0]})`);
check(/gegen die Schätzung/.test(stats), 'mit einer eigenen Kachel dafür');

// --- 5. Ausreißer werden gedeckelt --------------------------------------
// Die Uhr lief mal weiter, während jemand einkaufen war: fünffache Dauer.
// Ungedeckelt stünden danach 250 min am Plan, und niemand würde ihn wählen.
await setze({ greeted: true, name: 'T', level: 'geuebt', shift: 0, log: await protokoll(6, 5) });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(300);
zeilen = await fokusZeilen();
const extrem = zeilen.map((z) => Number((z.match(/(\d+) min/) || [])[1]));
console.log('     bei fünffacher Messung:', zeilen[0]);
check(extrem[0] <= ohne[0] * 2.1,
  `der Faktor ist bei 2× gedeckelt (${extrem[0]} statt ${ohne[0] * 5} min)`);
await page.locator('.tab[data-tab="stats"]').click();
await page.waitForTimeout(400);
const stats2 = (await page.locator('#view').textContent()).replace(/\s+/g, ' ');
check(/gedeckelt|Vertrauensbereich/.test(stats2), 'und die App sagt, dass sie gedeckelt hat');

check(errs.length === 0, `keine Fehler${errs.length ? ': ' + errs.slice(0, 2).join(' | ') : ''}`);
console.log(`\n${fails ? fails + ' FEHLER' : 'alle Prüfungen bestanden'}`);
await browser.close();
