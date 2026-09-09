/*
 * Aufwärmsätze: eine Ansage vor der Arbeit, kein Teil davon.
 *
 * Der erste Arbeitssatz war bisher wirklich der erste Satz – bei 40 kg Hip
 * Thrust also aus dem Sessel auf die Bank und volles Gewicht.
 *
 * Die drei Entscheidungen, an denen das hängt, und die deshalb hier stehen:
 *
 *   1. **Nicht abhakbar, nicht gezählt.** Wären Aufwärmsätze Knöpfe, stünde am
 *      Monatsende ein Drittel mehr Sätze in der Statistik, ohne dass ein Gramm
 *      mehr bewegt wurde – und der Stufenaufstieg käme zu früh.
 *   2. **Nur die schweren.** `tier` 1 und 2. Eine Zeile, die über jeder Übung
 *      steht, liest nach einer Woche niemand mehr.
 *   3. **Auf dem Raster.** „Aufwärmen: 6× 17,3 kg" wäre eine Rechnung, keine
 *      Ansage. Gerundet wird auf das, was sich aufstecken lässt.
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

await page.goto(URL, { waitUntil: 'networkidle' });

// --- 1. Die Rechnung ---------------------------------------------------
const rechnung = await page.evaluate(async () => {
  const { aufwaermsaetze } = await import('./js/gewichte.js');
  const { EX_BY_ID } = await import('./js/uebung.js');
  const ex = (id) => EX_BY_ID.get(id);
  return {
    // tier 1, 40 kg, ohne eingetragene Scheiben: freie Schritte
    schwer: aufwaermsaetze(ex('hip-thrust'), 40, '8–15'),
    // tier 3: gar nichts
    leicht: aufwaermsaetze(ex('sitzendes-seitheben'), 8, '12–20'),
    // ohne Last: nichts zu halbieren
    ohneLast: aufwaermsaetze(ex('chin-ups'), 0, '5–10'),
    band: aufwaermsaetze(ex('band-seitheben'), null, '12–20'),
    // tier 2 bekommt einen statt zwei
    mittel: aufwaermsaetze(ex('einbeiniges-kreuzheben'), 12, '8–12 je Bein'),
  };
});
console.log('     Hip Thrust 40 kg:', JSON.stringify(rechnung.schwer));
console.log('     tier 2, 12 kg:   ', JSON.stringify(rechnung.mittel));

check(rechnung.schwer.length === 2, `eine Grundübung bekommt zwei Anläufe (${rechnung.schwer.length})`);
check(rechnung.schwer[0].kg === 20 && rechnung.schwer[1].kg === 30,
  `die Hälfte und drei Viertel von 40 (${rechnung.schwer.map((s) => s.kg).join(' / ')})`);
check(rechnung.schwer.every((s) => s.reps >= 4 && s.reps <= 8),
  `mit wenigen Wiederholungen (${rechnung.schwer.map((s) => s.reps).join(' / ')})`);
check(rechnung.schwer[0].kg < rechnung.schwer[1].kg && rechnung.schwer[1].kg < 40,
  'aufsteigend und immer unter dem Arbeitsgewicht');
check(rechnung.mittel.length === 1, `eine schwere Nebenübung bekommt einen (${rechnung.mittel.length})`);
check(rechnung.leicht.length === 0, 'eine Isolationsübung gar keinen');
check(rechnung.ohneLast.length === 0, 'ohne Zusatzlast gibt es nichts zu halbieren');
check(rechnung.band.length === 0, 'und am Band schon gar nicht');

// --- 2. Auf dem Raster, nicht auf der Rechnung -------------------------
//
// Mit einem groben Scheibensatz darf kein krummer Wert dastehen. Und wenn das
// Raster so grob ist, dass die Hälfte auf dasselbe Gewicht schnappt wie drei
// Viertel, bleibt einer übrig – zweimal dasselbe ist kein Aufbau.
const gerastet = await page.evaluate(async () => {
  const store = await import('./js/store.js');
  const { aufwaermsaetze } = await import('./js/gewichte.js');
  const { EX_BY_ID } = await import('./js/uebung.js');
  store.setSetting('scheiben', { stange: { kh: 0, sz: 0, lh: 0 },
    scheiben: [[10, 2], [20, 2]] });
  const grob = aufwaermsaetze(EX_BY_ID.get('hip-thrust'), 40, '8–15');
  store.setSetting('scheiben', { stange: { kh: 0, sz: 0, lh: 0 },
    scheiben: [[1.25, 4], [2.5, 4], [5, 4], [10, 4]] });
  const fein = aufwaermsaetze(EX_BY_ID.get('hip-thrust'), 37.5, '8–15');
  store.setSetting('scheiben', null);
  return { grob, fein };
});
console.log('     grobes Raster:', JSON.stringify(gerastet.grob));
console.log('     feines Raster:', JSON.stringify(gerastet.fein));
check(gerastet.grob.every((s) => [20, 40].includes(s.kg) === (s.kg === 20)),
  'mit groben Scheiben stehen nur erreichbare Gewichte da');
check(new Set(gerastet.grob.map((s) => s.kg)).size === gerastet.grob.length,
  'und keins zweimal – zweimal dasselbe Gewicht ist kein Aufbau');
check(gerastet.fein.every((s) => Number.isFinite(s.kg) && s.kg % 1.25 < 1e-9),
  `mit feinen Scheiben trotzdem keine krummen Zahlen (${gerastet.fein.map((s) => s.kg).join(' / ')})`);

// --- 3. In der App: eine Zeile, kein Knopf -----------------------------
await page.evaluate(async () => {
  const store = await import('./js/store.js');
  const { PLAN } = await import('./js/data.js');
  store.setSetting('greeted', true);
  store.setSetting('name', 'T');
  store.setSetting('tab', 'dashboard');
  window.__n = PLAN[0].n;
});
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(400);
// Die Übungsliste steht nicht auf dem Dashboard, sondern hinter dem Start –
// vorher gibt es nichts, worüber eine Aufwärmzeile stehen könnte.
await page.locator('[data-act="start-session"]').first().click();
await page.waitForTimeout(400);
if (await page.locator('[data-act="focus-list"]').count()) {
  await page.locator('[data-act="focus-list"]').first().click();
  await page.waitForTimeout(300);
}

const seite = await page.evaluate(() => {
  const text = document.getElementById('view').textContent.replace(/\s+/g, ' ');
  return {
    zeilen: document.querySelectorAll('.aufwaerm').length,
    knoepfe: document.querySelectorAll('.aufwaerm button, .aufwaerm [data-act]').length,
    text: (/Aufwärmen: [^A]{0,60}/.exec(text) || [''])[0].trim(),
  };
});
console.log('     in der App:', JSON.stringify(seite));
check(seite.zeilen > 0, `die Zeile steht über den schweren Übungen (${seite.zeilen}×)`);
check(seite.knoepfe === 0, 'und enthält nichts zum Antippen – kein Satz, keine Leistung');
check(/zählt nicht mit/.test(
  (await page.locator('.aufwaerm').first().textContent()) || ''),
  'sie sagt selbst dazu, dass sie nicht mitzählt');

// --- 4. Nach dem ersten Satz ist Aufwärmen vorbei ----------------------
const vorher = await page.locator('.aufwaerm').count();
await page.locator('.ex-sets .set-btn').first().click();
await page.waitForTimeout(300);
const nachher = await page.locator('.aufwaerm').count();
console.log(`     Zeilen vor/nach dem ersten Haken: ${vorher} → ${nachher}`);
check(nachher === vorher - 1,
  'sobald ein Satz steht, verschwindet sie – eine überholte Ansage ist eine zu viel');

// --- 5. Abschaltbar ----------------------------------------------------
await page.evaluate(async () => {
  const store = await import('./js/store.js');
  store.setSetting('aufwaermen', false);
});
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(400);
check(await page.locator('.aufwaerm').count() === 0,
  'ausgeschaltet steht nirgends mehr eine Zeile');

check(errs.length === 0, `keine Fehler${errs.length ? ': ' + errs.slice(0, 2).join(' | ') : ''}`);
await browser.close();
console.log(`\n${fails ? fails + ' FEHLER' : 'alle Prüfungen bestanden'}`);
