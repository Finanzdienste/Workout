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

// --- 3. Zurückstellen hält ---------------------------------------------
await page.locator('.tab[data-tab="dashboard"]').click();
await page.waitForTimeout(200);
await page.locator('[data-act="aufstieg-zurueck"]').click();
await page.waitForTimeout(250);
s = await lies();
check(s.level === 'anfaenger', `zurückgestellt auf Anfänger (${s.level})`);
check(!s.aufstieg, 'der Hinweis ist weg');
check(s.aufstiege.includes('geuebt'), 'der Schritt bleibt als erledigt vermerkt');

// Und zwar dauerhaft: Neuladen darf ihn nicht wieder hochstufen.
await page.reload({ waitUntil: 'networkidle' });
s = await lies();
check(s.level === 'anfaenger', `nach dem Neuladen immer noch Anfänger (${s.level})`);
check(!s.aufstieg, 'und der Hinweis kommt nicht wieder');

// --- 4. Bodyweight zählt genauso --------------------------------------
// Dort gibt es keine Kilo. Wer deswegen ewig auf Anfänger stünde, würde für
// die Wahl seiner Variante bestraft.
await stand(70, { modus: 'bw' });
await page.reload({ waitUntil: 'networkidle' });
s = await lies();
check(s.level === 'geuebt', `70 Bodyweight-Einheiten stufen ebenfalls hoch (${s.level})`);

// --- 5. Eine Wahl von Hand räumt den Hinweis weg ------------------------
await page.locator('.tab[data-tab="settings"]').click();
await page.waitForTimeout(300);
await page.locator('[data-act="set-level"][data-v="fortgeschritten"]').first().click();
await page.waitForTimeout(250);
s = await lies();
check(s.level === 'fortgeschritten', `von Hand auf Fortgeschritten (${s.level})`);
check(!s.aufstieg, 'und der offene Hinweis ist damit erledigt');

check(errs.length === 0, `keine Fehler${errs.length ? ': ' + errs.join(' | ') : ''}`);
console.log(`\n${fails ? fails + ' FEHLER' : 'alle Prüfungen bestanden'}`);
await browser.close();
