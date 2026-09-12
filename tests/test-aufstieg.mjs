/*
 * Aufsteigen, ohne daran zu denken.
 *
 * Die Erfahrungsstufe war eine Einstellung, die man einmal trifft und dann
 * vergisst – und wer als Anfänger anfängt und ein Jahr durchhält, trainiert
 * danach immer noch auf zwei Sätzen je Übung. Jetzt zählt die App mit und
 * stellt selbst um.
 *
 * Vier Dinge müssen dabei stimmen, und drei davon sind Fälle, in denen *nichts*
 * passieren darf: zu früh, nach dem Zurückstellen, und nach einer Wahl von
 * Hand. Ein Hinweis, der immer wieder auftaucht, ist schlimmer als keiner.
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

/**
 * Einen Stand mit `n` abgeschlossenen Einheiten hinlegen.
 *
 * Gebaut wird er aus dem echten Plan, nicht aus erfundenen Übungs-IDs: Die
 * Statistik zählt nur, was auch im Plan steht, und ein Test mit erfundenen IDs
 * würde bei jeder Planänderung still zu null Sätzen werden.
 */
const stand = (n, { level = 'anfaenger', kg = 20, modus = 'db', ...rest } = {}) => page.evaluate(
  async ([anzahl, stufe, gewicht, m, extra]) => {
    const { PLAN } = await import('./js/data.js');
    const log = {};
    PLAN.slice(0, anzahl).forEach((w) => {
      const eintrag = { done: m, [m]: {} };
      w.ex.forEach((item) => {
        eintrag[m][item.id] = Array.from({ length: item.sets }, () => ({
          w: m === 'db' ? String(gewicht) : '', r: '', done: true,
        }));
      });
      log[w.n] = eintrag;
    });
    localStorage.setItem('workout.state.v1', JSON.stringify({
      greeted: true, name: 'T', level: stufe, log, ...extra,
    }));
  }, [n, level, kg, modus, rest],
);

const lies = () => page.evaluate(async () => {
  const s = (await import('./js/store.js')).getState();
  return { level: s.level, aufstiege: s.aufstiege || [], aufstieg: s.aufstieg };
});

await page.goto(URL, { waitUntil: 'networkidle' });

// --- 1. Zu früh passiert nichts ---------------------------------------
// 20 Einheiten sind ein gutes Vierteljahr entfernt von der Schwelle.
await stand(20);
await page.reload({ waitUntil: 'networkidle' });
let s = await lies();
check(s.level === 'anfaenger', `nach 20 Einheiten immer noch Anfänger (${s.level})`);
check(!s.aufstieg, 'und kein Hinweis');

// --- 2. Über der Schwelle wird umgestellt ------------------------------
// 70 Einheiten mit vollen Sätzen und 20 kg: über allen drei Schwellen.
await stand(70);
await page.reload({ waitUntil: 'networkidle' });
s = await lies();
check(s.level === 'geuebt', `nach 70 Einheiten steht die Stufe auf Geübt (${s.level})`);
check(s.aufstiege.includes('geuebt'), 'der Schritt ist als erledigt vermerkt');
const hinweis = (await page.locator('.notice.aufstieg').first().textContent()).replace(/\s+/g, ' ');
check(/Aufgestiegen/.test(hinweis), `der Hinweis steht auf der Startseite (${hinweis.slice(0, 70)}…)`);
check(/3 statt 2 Sätze/.test(hinweis), 'und sagt, was sich am Plan ändert');

// Der Plan zeigt die neue Satzzahl auch wirklich an.
const auf = page.locator('[data-act="show-list"]');
if (await auf.count()) { await auf.first().click(); await page.waitForTimeout(200); }
const saetze = await page.locator('.ex-sets').first().locator('.set-btn').count();
check(saetze === 3, `der Plan steht auf drei Sätzen je Übung (${saetze})`);

// --- 3. Die Stufe lässt sich nicht mehr überstimmen ---------------------
//
//     „Die App sollte einen ja selbst auf Grundlage der Gewichte,
//      Wiederholungen, Anzahl absolvierter Trainings usw irgendwann hochstufen.
//      Selbst sollte man diese Einstufung ja nie verändern."
//
// Deshalb gibt es weder ein „Bei Anfänger bleiben" neben dem Hinweis noch die
// drei Knöpfe unter Mehr. Eine Stufe ist etwas, das man sich ertrainiert.
await page.locator('.tab[data-tab="dashboard"]').click();
await page.waitForTimeout(200);
check(await page.locator('[data-act="aufstieg-zurueck"]').count() === 0,
  'kein Knopf, der den Aufstieg zurücknimmt');
await page.locator('[data-act="aufstieg-ok"]').click();
await page.waitForTimeout(250);
s = await lies();
check(s.level === 'geuebt', `die Stufe bleibt stehen (${s.level})`);
check(!s.aufstieg, 'der Hinweis ist weggetippt');

await page.locator('.tab[data-tab="settings"]').click();
await page.waitForTimeout(300);
const text = (await page.locator('#view').textContent()).replace(/\s+/g, ' ');
check(await page.locator('[data-act="set-level"]').count() === 0,
  'und unter Mehr steht die Stufe nur noch da, ohne Knöpfe');
check(/Geübt/.test(text) && /3 Sätze je Übung/.test(text),
  'mit dem, was sie für den Plan heißt');

// --- 4. Bodyweight zählt genauso --------------------------------------
// Dort gibt es keine Kilo. Wer deswegen ewig auf Anfänger stünde, würde für
// die Wahl seiner Variante bestraft.
await stand(70, { modus: 'bw' });
await page.reload({ waitUntil: 'networkidle' });
s = await lies();
check(s.level === 'geuebt', `70 Bodyweight-Einheiten stufen ebenfalls hoch (${s.level})`);

// --- 5. Die Einrichtung blockiert den Aufstieg nicht mehr ---------------
//
// Der Fehler, um den es ging: Die Selbsteinschätzung bei der Einrichtung lief
// über dieselbe Aktion wie die Knöpfe unter Mehr – und die buchte den nächsten
// Aufstieg sofort als „schon dagewesen". Wer dort „Anfänger" antippte, wurde
// nie hochgestuft, egal wie lange er trainierte.
await page.evaluate(() => localStorage.setItem('workout.state.v1',
  JSON.stringify({ greeted: false, name: '' })));
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(400);
const stufenKnopf = page.locator('[data-act="set-level"][data-v="anfaenger"]');
let gewaehlt = false;
for (let k = 0; k < 8 && !gewaehlt; k++) {
  if (await stufenKnopf.count()) { await stufenKnopf.first().click(); gewaehlt = true; break; }
  const weiter = page.locator('[data-act="setup-next"], [data-act="setup-weiter"]');
  if (!(await weiter.count())) break;
  await weiter.first().click();
  await page.waitForTimeout(200);
}
check(gewaehlt, 'in der Einrichtung lässt sich die Stufe wählen');
s = await lies();
check(s.level === 'anfaenger', `gewählt: Anfänger (${s.level})`);
check(!(s.aufstiege || []).includes('geuebt'),
  `und der Aufstieg ist nicht als erledigt gebucht (${JSON.stringify(s.aufstiege)})`);

// Und ein alter Stand mit genau dieser Blockade wird beim Laden geheilt.
await page.evaluate(() => localStorage.setItem('workout.state.v1',
  JSON.stringify({ greeted: true, level: 'anfaenger', aufstiege: ['geuebt'] })));
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(300);
s = await lies();
check(!(s.aufstiege || []).includes('geuebt'),
  `ein blockierter Altstand wird geheilt (${JSON.stringify(s.aufstiege)})`);

check(errs.length === 0, `keine Fehler${errs.length ? ': ' + errs.slice(0, 2).join(' | ') : ''}`);
await browser.close();
console.log(`\n${fails ? fails + ' FEHLER' : 'alle Prüfungen bestanden'}`);
