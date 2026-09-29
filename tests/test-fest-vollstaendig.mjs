/*
 * Ein Planwechsel schreibt angefangene Einheiten ganz fest, nicht halb.
 *
 *     „Heute nur zwei Übungen?"
 *
 * Mit v215 kam ein neuer Cut-Plan. Die Cut-Einheit Nr. 4 war in der
 * Fokusansicht angefangen – Liegestütze im Wechsel mit Band-Seitheben –, und
 * die Ansicht hatte im Protokoll nur dieses erste Paar angelegt. planWechsel()
 * schrieb die Einheit auf genau diese zwei fest; Crunches und Wadenheben waren
 * weg. Geprüft wird:
 *
 *   1. Die Fokusansicht legt die ganze Einheit im Protokoll an, nicht nur, was
 *      sie gerade zeigt.
 *   2. Wechselt der Plan, und der Plan davor ist bekannt (PLANS[f].vorher),
 *      wird eine angefangene Einheit mit ihrer ganzen alten Liste
 *      festgeschrieben.
 *   3. Ein schon zu kurz festgeschriebener Stand wird repariert, abgehakte
 *      Sätze bleiben, und die App sagt es.
 *   4. Eine abgeschlossene Einheit bleibt, was sie war – was nicht gemacht
 *      wurde, wird nicht nachträglich hineingeschrieben.
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

// Zustand setzen und neu laden. Danach schreibt diese Seite nichts mehr: Die
// App sichert ihren Stand beim Verlassen und mit laufender Uhr auch
// zwischendurch (store.flush()), und nach einer angefangenen Einheit ist das
// ein anderer als der hier gesetzte. Der neu geladenen Seite gilt das nicht.
const setze = async (z) => {
  await page.evaluate((zz) => {
    localStorage.clear();
    localStorage.setItem('workout.state.v1', JSON.stringify(zz));
    window.Storage.prototype.setItem = () => {};
    window.Storage.prototype.removeItem = () => {};
    window.Storage.prototype.clear = () => {};
  }, z);
  await page.reload({ waitUntil: 'networkidle' });
};

// --- 1. Die Fokusansicht legt die ganze Einheit an ---------------------
await setze({ greeted: true, mode: 'db', focus: 'cut' });
await page.locator('[data-act="start-session"]').first().click();
await page.waitForTimeout(400);
const angelegt = await page.evaluate(async () => {
  const { getState } = await import('./js/store.js');
  const { workoutByNo } = await import('./js/plan.js');
  const s = getState();
  const [n, e] = Object.entries(s.log).find(([, x]) => x && x.db) || [];
  const soll = workoutByNo(Number(n), 'db').ex.map((x) => x.id);
  return { soll, im: Object.keys((e || {}).db || {}), fokus: !!document.querySelector('.focus-cue') };
});
check(angelegt.fokus, 'die Fokusansicht ist offen');
check(angelegt.soll.length > 2 && angelegt.soll.every((id) => angelegt.im.includes(id)),
  `alle ${angelegt.soll.length} Übungen der Einheit stehen im Protokoll, nicht nur die angezeigte (${angelegt.im.length})`);

// Welche Variante bringt einen Plan davor mit? Ohne einen gibt es 2. und 3.
// nicht – dann ist nichts zu prüfen, und das wird gesagt statt verschwiegen.
const lage = await page.evaluate(async () => {
  const { PLANS } = await import('./js/data.js');
  const f = Object.keys(PLANS).find((k) => PLANS[k].vorher);
  if (!f) return null;
  const v = PLANS[f].vorher;
  // Eine Nummer, deren alte Liste mindestens drei Übungen hatte.
  const i = v.ex.findIndex((l) => l.length >= 3);
  return { f, stand: PLANS[f].stand, alt: v.stand, n: i + 1, liste: v.ex[i].map(([id, sets]) => ({ id, sets })) };
});
if (!lage) {
  console.log('     kein Plan bringt einen Vorgänger mit (tools/plan-vorher/) – 2. und 3. entfallen');
} else {
  console.log(`     ${lage.f}: Plan davor ${lage.alt}, jetzt ${lage.stand}, Einheit ${lage.n} hatte ${lage.liste.length} Übungen`);
  const [a, b] = lage.liste;
  const halb = {
    mode: 'db', startedOn: '2026-09-29', bw: {},
    db: { [a.id]: [{ w: '20', done: true }, {}, {}], [b.id]: [{ done: true }, {}, {}] },
    soll: { [a.id]: a.sets, [b.id]: b.sets },
  };

  // --- 2. Wechsel mit bekanntem Plan davor: ganze Liste --------------
  await setze({
    greeted: true, mode: 'db', focus: lage.f, planStand: { [lage.f]: lage.alt }, log: { [lage.n]: halb },
  });
  const wechsel = await page.evaluate(async (n) => {
    const { getState } = await import('./js/store.js');
    const { workoutByNo } = await import('./js/plan.js');
    const e = getState().log[n] || {};
    return { fest: (e.fest || []).map((x) => x.id), ex: workoutByNo(n, 'db').ex.map((x) => x.id) };
  }, lage.n);
  check(wechsel.fest.join() === lage.liste.map((x) => x.id).join(),
    `beim Wechsel steht die angefangene Einheit ganz fest: ${wechsel.fest.length} von ${lage.liste.length} Übungen`);
  // Dieselben Übungen – die Reihenfolge ordnet die App selbst (weniger Umbau).
  check([...wechsel.ex].sort().join() === [...wechsel.fest].sort().join(),
    `und so zeigt die App sie auch (${wechsel.ex.join(', ')})`);

  // --- 3. Schon zu kurz festgeschrieben: Reparatur --------------------
  await setze({
    greeted: true, mode: 'db', focus: lage.f, planStand: { [lage.f]: lage.stand },
    log: { [lage.n]: { ...halb, fest: lage.liste.slice(0, 2) } },
  });
  await page.waitForTimeout(300);
  const repariert = await page.evaluate(async (n) => {
    const { getState } = await import('./js/store.js');
    const e = getState().log[n] || {};
    return {
      fest: (e.fest || []).map((x) => x.id),
      abgehakt: Object.values(e.db || {}).reduce((s, arr) => s + arr.filter((x) => x && x.done).length, 0),
      hinweis: (document.querySelector('#view') || {}).textContent || '',
    };
  }, lage.n);
  check(repariert.fest.join() === lage.liste.map((x) => x.id).join(),
    `die zu kurz festgeschriebene Einheit hat wieder alle ${lage.liste.length} Übungen (${repariert.fest.length})`);
  check(repariert.abgehakt === 2, `die abgehakten Sätze bleiben (${repariert.abgehakt})`);
  check(/wieder vollständig/.test(repariert.hinweis), 'und die App sagt es');
  await page.locator('[data-act="umbau-ok"]').first().click();
  await page.waitForTimeout(200);
  await page.reload({ waitUntil: 'networkidle' });
  const zweimal = await page.evaluate(() => /wieder vollständig/.test(document.querySelector('#view').textContent));
  check(!zweimal, 'weggetippt bleibt der Hinweis weg – die Reparatur läuft nicht jedes Mal neu');

  // --- 4. Abgeschlossen bleibt abgeschlossen ---------------------------
  await setze({
    greeted: true, mode: 'db', focus: lage.f, planStand: { [lage.f]: lage.stand },
    log: { [lage.n]: { ...halb, done: 'db', fest: lage.liste.slice(0, 2) } },
  });
  const fertig = await page.evaluate(async (n) => {
    const { getState } = await import('./js/store.js');
    return (getState().log[n].fest || []).length;
  }, lage.n);
  check(fertig === 2, `eine abgeschlossene Einheit behält, was gemacht wurde (${fertig} Übungen)`);
}

console.log(`\n${fails ? fails + ' FEHLER' : 'alle Prüfungen bestanden'}`);
console.log('ERRORS:', errs.length ? errs : 'none');
if (errs.length) process.exitCode = 1;
await browser.close();
