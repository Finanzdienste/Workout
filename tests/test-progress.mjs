/* Gewichtsschritte, "Wie war das?" und Bodyweight-Progression. */
import { chromium } from 'playwright';
import { URL } from './umgebung.mjs';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 414, height: 896 } });
const errs = [];
page.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()); });
let fails = 0;
const check = (c, m) => { console.log(`${c ? 'OK  ' : 'FAIL'} ${m}`); if (!c) { fails++; process.exitCode = 1; } };

await page.goto(URL, { waitUntil: 'networkidle' });
await page.evaluate(() => { localStorage.clear(); localStorage.setItem('workout.state.v1', '{"greeted":true}'); });
await page.reload({ waitUntil: 'networkidle' });

// --- Schrittweite hängt an der Übung ---
const schritte = await page.evaluate(async () => {
  const { EXERCISES } = await import('./js/data.js');
  // Übungen mit Startgewicht 0 – Chin-ups am eigenen Körpergewicht – haben
  // kein Verhältnis, an dem sich eine Schrittweite messen ließe.
  return EXERCISES.filter((e) => e.weight)
    .map((e) => ({ id: e.id, kg: e.weight, step: e.step, pct: (e.step / e.weight) * 100 }));
});
console.log('     ' + schritte.map((x) => `${x.id.split('-')[0]}:${x.step}`).join(' '));
check(schritte.every((x) => x.step > 0), 'jede Übung mit Gewicht hat eine Schrittweite');
const grob = schritte.filter((x) => x.pct > 26);
check(grob.length === 0, `kein Schritt über ein Viertel des Gewichts${
  grob.length ? ' – ' + grob.map((x) => `${x.id} ${x.pct.toFixed(0)} %`).join(', ') : ''}`);

await page.locator('[data-act="show-list"]').click();
await page.waitForTimeout(250);
const labels = await page.locator('.kg-plus').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')));
console.log('     Knöpfe:', labels.join(' | '));
check(new Set(labels).size > 1, 'die ±-Knöpfe sind nicht mehr überall gleich');

// Aufwärmkarte gibt es nicht mehr – sie stand auf Wunsch des Nutzers zur
// Disposition und ist entfernt. Die Anlaufsätze waren der belegte Teil daran;
// wer sie zurückwill, holt warmupCard() aus der Versionsgeschichte.
check(await page.locator('.warmup').count() === 0, 'keine Aufwärmkarte mehr');

// --- Kein Fragebogen mehr, auch nicht nach dem letzten Satz ---
const ex1 = page.locator('.ex').nth(1);
const setCount = await ex1.locator('.set-btn').count();
for (let k = 0; k < setCount; k++) { await ex1.locator('.set-btn').nth(k).click(); await page.waitForTimeout(120); }
await page.waitForTimeout(250);
check(await ex1.locator('.effort-btn').count() === 0, 'nach dem letzten Satz keine Rückfrage');
check(await ex1.evaluate((el) => el.classList.contains('complete')), 'Übung gilt als erledigt');

// --- Steigerungsvorschlag nach zwei vollen Einheiten ---
const test = await page.evaluate(async () => {
  const { PLAN, EXERCISES } = await import('./js/data.js');
  const byId = new Map(EXERCISES.map((e) => [e.id, e]));
  // Die Wiederholung einer Übung liegt seit der 48-Stunden-Regel nicht mehr in
  // der direkt folgenden Einheit – die zweite Einheit deshalb suchen.
  const hat = (i, id) => PLAN[i].ex.some((x) => x.id === id);
  const pick = PLAN[0].ex.find((x) => byId.get(x.id).weight !== null
    && PLAN.slice(1).some((w, i) => hat(i + 1, x.id)));
  const zweite = PLAN.findIndex((w, i) => i > 0 && hat(i, pick.id));
  const soll = (i) => PLAN[i].ex.find((x) => x.id === pick.id).sets;
  const sets = (i) => Array.from({ length: soll(i) }, () => ({ w: '20', r: '', done: true }));
  const state = { restSeconds: 0, weights: { [pick.id]: 20 }, log: {
    [PLAN[0].n]: { db: { [pick.id]: sets(0) }, bw: {}, mode: 'db', startedOn: '2026-08-19' },
    [PLAN[zweite].n]: { db: { [pick.id]: sets(zweite) }, bw: {}, mode: 'db', startedOn: '2026-08-21' },
  } };
  localStorage.setItem('workout.state.v1', JSON.stringify(state));
  return {
    id: pick.id, name: byId.get(pick.id).db.name,
    step: byId.get(pick.id).step, zweite: PLAN[zweite].n,
  };
});
await page.reload({ waitUntil: 'networkidle' });
await page.locator('[data-act="show-list"]').click();
await page.waitForTimeout(250);
const kartenIndex = async (name) => page.evaluate((n) => [...document.querySelectorAll('.ex')]
  .findIndex((e) => e.querySelector('.ex-name').textContent.trim() === n), name);
const karteVon = async (name) => {
  const i = await page.evaluate((n) => [...document.querySelectorAll('.ex')]
    .findIndex((e) => e.querySelector('.ex-name').textContent.trim() === n), name);
  if (i < 0) throw new Error(`Karte "${name}" nicht gefunden`);
  return page.locator('.ex').nth(i);
};

// --- Kein Vorschlag, auch nach zwei vollen Einheiten ---
// Die App weiß nicht, wie schwer ein Satz war – ob 8 oder 12 Wiederholungen
// drin waren, steht nirgends. Also schlägt sie nichts vor.
check(await page.locator('.kg-bump').count() === 0,
  'nach zwei vollen Einheiten kommt kein Steigerungsvorschlag');
check(!(await page.locator('#view').textContent()).includes('geschafft'),
  'und auch sonst kein "×  alles geschafft"');

// --- Plus und Minus, mit der Schrittweite der Übung ---
const karte = await karteVon(test.name);
await karte.locator('.ex-head').click();
await page.waitForTimeout(200);
const wert = () => karte.locator('.kg-val').first().inputValue();
const komma = (x) => String(x).replace('.', ',');
check(await wert() === komma(20), `steht auf ${komma(20)} kg`);
await karte.locator('.kg-plus').first().click();
await page.waitForTimeout(200);
check(await wert() === komma(20 + test.step),
  `"+" geht auf ${komma(20 + test.step)} kg (Schritt ${test.step})`);
await karte.locator('.kg-step').first().click();
await page.waitForTimeout(200);
check(await wert() === komma(20), '"−" nimmt es zurück');

// --- Bodyweight: Wiederholungen mit denselben zwei Knöpfen ---
const bw = await page.evaluate(async () => {
  const { PLAN, EXERCISES } = await import('./js/data.js');
  const byId = new Map(EXERCISES.map((e) => [e.id, e]));
  const inBoth = PLAN[0].ex.filter((a) => PLAN[1].ex.some((b) => b.id === a.id));
  const pick = inBoth[0];
  const soll = (n) => PLAN[n].ex.find((x) => x.id === pick.id).sets;
  const sets = (n) => Array.from({ length: soll(n) }, () => ({ w: '', r: '', done: true }));
  localStorage.setItem('workout.state.v1', JSON.stringify({
    restSeconds: 0, mode: 'bw', keepModePerWorkout: false,
    log: {
      1: { db: {}, bw: { [pick.id]: sets(0) }, mode: 'bw', startedOn: '2026-08-19' },
      2: { db: {}, bw: { [pick.id]: sets(1) }, mode: 'bw', startedOn: '2026-08-21' },
    },
  }));
  return { id: pick.id, name: byId.get(pick.id).bw.name, reps: byId.get(pick.id).bw.reps };
});
await page.reload({ waitUntil: 'networkidle' });
await page.locator('[data-act="show-list"]').click();
await page.waitForTimeout(250);
const bwCard = await karteVon(bw.name);
await bwCard.locator('.ex-head').click();
await page.waitForTimeout(200);
const bwZeile = bwCard.locator('.ex-weight').first();
check(await bwZeile.count() === 1, 'Bodyweight: eine Zeile für die Wiederholungen');
check(await bwCard.locator('.kg-bump').count() === 0, 'und kein Vorschlag daneben');
const stand = async () => (await bwCard.locator('.kg-fest').first().textContent()).trim();
check(await stand() === bw.reps, `sie steht auf dem Planwert (${await stand()})`);
check(await bwZeile.locator('.kg-step').first().isDisabled(),
  '"−" ist gesperrt – unter den Plan geht es nicht');

await bwZeile.locator('.kg-plus').first().click();
await page.waitForTimeout(250);
const eins = bw.reps.replace(/\d+/g, (d) => String(Number(d) + 1));
check(await stand() === eins, `"+" macht daraus ${eins}`);
const plus = await page.evaluate(() => JSON.parse(localStorage.getItem('workout.state.v1')).bwPlus);
check(plus[bw.id] === 1, 'und wird gespeichert');
const meta = await bwCard.locator('.ex-meta').first().textContent();
check(meta.includes(eins), `die Kopfzeile zeigt denselben Bereich (${meta.trim()})`);

await bwZeile.locator('.kg-step').first().click();
await page.waitForTimeout(250);
check(await stand() === bw.reps, '"−" nimmt es wieder zurück');

console.log(`\n${fails ? fails + ' FEHLER' : 'alle Prüfungen bestanden'}`);
console.log('ERRORS:', errs.length ? errs : 'none');
await browser.close();
