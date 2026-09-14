/**
 * Die Einordnung des Tages.
 *
 * Anlass: *„heute wieder nur fünf übungen - optimal?"* – dieselbe Frage wie
 * *„würdest du sagen dass der heutige tag mit 4 Übungen optimal ist?"*. In der
 * Kopfzeile stand eine Zahl ohne Maßstab; jetzt steht dahinter, ob dieser Tag
 * für diesen Fokus kurz, normal oder lang ist.
 *
 * Geprüft wird gegen die *rohen* Plandaten, nicht gegen die Rechnung der App:
 * Die Häufigkeitstabelle wird hier aus js/data.js neu gebaut. Sonst prüfte der
 * Test die Funktion an sich selbst.
 */
import { chromium } from 'playwright';
import { URL, SHOT } from './umgebung.mjs';

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 414, height: 896 } });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()); });
page.on('response', (r) => { if (r.status() >= 400) errs.push(r.status() + ' ' + r.url()); });

let fails = 0;
const check = (c, m) => { console.log(`${c ? 'OK  ' : 'FAIL'} ${m}`); if (!c) { fails++; process.exitCode = 1; } };

const modus = async (m) => {
  await page.evaluate(async (ziel) => {
    const store = await import('./js/store.js');
    store.setMode(ziel);
    for (let n = 1; n <= 12; n++) store.setWorkoutMode(n, ziel);
  }, m);
  await page.locator('.tab[data-tab="dashboard"]').click();
  await page.waitForTimeout(250);
};

const kopf = () => page.locator('.hero-sub').first().textContent()
  .then((t) => t.replace(/\s+/g, ' ').trim());
const nummer = () => page.locator('.hero-eyebrow').first().textContent()
  .then((t) => Number((t.match(/Workout\s+(\d+)/) || [])[1]));

await page.goto(URL, { waitUntil: 'networkidle' });
await page.evaluate(() => {
  localStorage.clear();
  localStorage.setItem('workout.state.v1',
    JSON.stringify({ greeted: true, focus: 'cut', level: 'geuebt' }));
});
await page.reload({ waitUntil: 'networkidle' });

// --- Erwartung aus den rohen Plandaten ---
const soll = await page.evaluate(async () => {
  const { PLAN } = await import('./js/data.js');
  const tab = new Map();
  PLAN.forEach((w) => tab.set(w.ex.length, (tab.get(w.ex.length) || 0) + 1));
  const sortiert = [...tab.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0]);
  const norm = sortiert[0][0];
  const groessen = [...tab.keys()].sort((a, b) => a - b);
  return {
    norm,
    haeufig: sortiert[0][1],
    summe: PLAN.length,
    kleinste: groessen[0],
    groesste: groessen[groessen.length - 1],
    tage: PLAN.map((w) => ({
      n: w.n,
      len: w.ex.length,
      wort: w.ex.length === norm ? 'normaler Tag'
        : (w.ex.length < norm ? 'kurzer Tag' : 'langer Tag'),
      dbGleich: new Set(w.ex.map((x) => x.sets)).size === 1,
      bwGleich: new Set(w.ex.map((x) => x.bwSets ?? x.sets)).size === 1,
      bwSumme: w.ex.reduce((a, x) => a + (x.bwSets ?? x.sets), 0),
    })),
  };
});
console.log(`     Cut: ${soll.kleinste} bis ${soll.groesste} Übungen, `
  + `${soll.haeufig} von ${soll.summe} mit ${soll.norm}`);
check(soll.kleinste !== soll.groesste, 'der Plan hat überhaupt verschieden lange Einheiten');

// --- Hantel-Variante: das Wort stimmt, die Satzzahl ist weg ---
const gesehen = new Set();
for (let i = 0; i < 8; i++) {
  const n = await nummer();
  const t = await kopf();
  const tag = soll.tage[n - 1];
  check(t.includes(tag.wort), `Workout ${n} (${tag.len} Übungen): „${t}"`);
  gesehen.add(tag.wort);
  // Im Plan hat jede Übung dieselbe Satzzahl – dann ist "15 Sätze" nur
  // "5 Übungen" mal drei und steht nicht mehr da.
  check(tag.dbGleich === !/\d+ Sätze/.test(t),
    `  Satzzahl ${tag.dbGleich ? 'weggelassen' : 'genannt'}, weil die Übungen `
    + `${tag.dbGleich ? 'gleich viele' : 'verschieden viele'} Sätze haben`);
  const weiter = page.locator('[data-act="nav-workout"][data-delta="1"]:not([disabled])');
  if (!(await weiter.count())) break;
  await weiter.click();
  await page.waitForTimeout(150);
}
check(gesehen.size >= 2, `beide Größen kamen vor (${[...gesehen].join(', ')})`);

// --- Zurück auf Workout 1 ---
for (let i = 0; i < 8; i++) {
  const zurueck = page.locator('[data-act="nav-workout"][data-delta="-1"]:not([disabled])');
  if (!(await zurueck.count())) break;
  await zurueck.click();
  await page.waitForTimeout(100);
}
check(await nummer() === 1, 'wieder bei Workout 1');

// --- Bodyweight: da weicht die Satzzahl je Übung ab, also steht sie wieder da ---
await modus('bw');
let gemischt = 0;
let uniform = 0;
for (let i = 0; i < 8; i++) {
  const n = await nummer();
  const t = await kopf();
  const tag = soll.tage[n - 1];
  check(t.startsWith('Bodyweight'), `Workout ${n} nennt die Variante: „${t}"`);
  if (tag.bwGleich) {
    uniform++;
    check(!/\d+ Sätze/.test(t), `  Workout ${n}: gleiche Satzzahlen, keine Summe`);
  } else {
    gemischt++;
    check(t.includes(`${tag.bwSumme} Sätze`),
      `  Workout ${n}: abweichende Satzzahlen, Summe ${tag.bwSumme} genannt`);
  }
  const weiter = page.locator('[data-act="nav-workout"][data-delta="1"]:not([disabled])');
  if (!(await weiter.count())) break;
  await weiter.click();
  await page.waitForTimeout(150);
}
console.log(`     Bodyweight: ${gemischt} Einheiten mit gemischten, ${uniform} mit gleichen Satzzahlen`);
await modus('db');

// --- Die Erklärung steht über der Liste, nicht in der Startansicht ---
check(await page.locator('.tag-note').count() === 0,
  'keine Erklärzeile in der Startansicht');
const ueberhang = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
check(ueberhang < 40, `Startansicht passt weiter auf einen Bildschirm (${ueberhang}px)`);

await page.locator('[data-act="show-list"]').click();
await page.waitForTimeout(200);
check(await page.locator('.tag-note').count() === 1, 'über der Liste steht die Erklärung');
const notiz = (await page.locator('.tag-note').textContent()).replace(/\s+/g, ' ').trim();
console.log('     ' + notiz);
check(notiz.includes(`${soll.kleinste} bis ${soll.groesste} Übungen`),
  'sie nennt die Spanne des Fokus');
check(notiz.includes(`${soll.haeufig} von ${soll.summe} mit ${soll.norm}`),
  'und wie viele Einheiten die häufige Größe haben');
check(/Woche/.test(notiz), 'und dass das Pensum je Woche feststeht');
// Keine Behauptung über die Trainingslehre: Die Zeile ordnet ein, sie bewertet
// nicht. "optimal" war die Frage, nicht die Antwort.
check(!/optimal|genug|reicht|ideal/i.test(notiz), 'ohne „optimal" und ohne Note');
await page.screenshot({ path: `${SHOT}/95-tagesgroesse.png`, fullPage: true });

// --- Anderer Fokus, andere Spanne ---
await page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('workout.state.v1'));
  s.focus = 'standard';
  localStorage.setItem('workout.state.v1', JSON.stringify(s));
});
await page.reload({ waitUntil: 'networkidle' });
const sollStd = await page.evaluate(async () => {
  const { PLAN } = await import('./js/data.js');
  const tab = new Map();
  PLAN.forEach((w) => tab.set(w.ex.length, (tab.get(w.ex.length) || 0) + 1));
  const g = [...tab.keys()].sort((a, b) => a - b);
  return { kleinste: g[0], groesste: g[g.length - 1] };
});
check(sollStd.kleinste !== soll.kleinste || sollStd.groesste !== soll.groesste,
  `Aufbau hat andere Größen als Cut (${sollStd.kleinste}–${sollStd.groesste} statt `
  + `${soll.kleinste}–${soll.groesste})`);
await page.locator('[data-act="show-list"]').click();
await page.waitForTimeout(200);
const notizStd = (await page.locator('.tag-note').textContent()).replace(/\s+/g, ' ').trim();
console.log('     ' + notizStd);
check(notizStd.includes(`${sollStd.kleinste} bis ${sollStd.groesste} Übungen`),
  'die Tabelle wird beim Fokuswechsel neu gerechnet');

// --- Eigenes Workout: kein Plan, also keine Einordnung – aber die Satzzahl ---
// Ohne Plan gibt es nichts, woran sich "kurzer Tag" messen ließe. Dann darf die
// Zeile nicht einfach um eine Angabe kürzer sein: Die Summe bleibt stehen.
await page.locator('.tab[data-tab="settings"]').click();
await page.waitForTimeout(150);
await page.locator('[data-act="go-tab"][data-tab="custom"]').click();
await page.waitForTimeout(200);
await page.locator('[data-act="custom-new"]').click();
await page.waitForTimeout(200);
await page.locator('[data-act="custom-name"]').fill('Eigenes');
const chips = page.locator('[data-act="custom-add"]');
await chips.nth(0).click();
await page.waitForTimeout(120);
await chips.nth(3).click();
await page.waitForTimeout(120);
await page.locator('[data-act="custom-save"]').click();
await page.waitForTimeout(400);
const eigen = await kopf();
console.log('     ' + eigen);
check(!/(kurzer|normaler|langer) Tag/.test(eigen),
  `eigenes Workout wird nicht eingeordnet: „${eigen}"`);
check(/\d+ Sätze/.test(eigen), 'dafür steht die Satzzahl weiter da');
await page.locator('[data-act="show-list"]').click();
await page.waitForTimeout(200);
check(await page.locator('.tag-note').count() === 0,
  'und über der Liste steht keine Erklärzeile zu einem Plan, den es hier nicht gibt');

const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
check(overflow === 0, `kein horizontaler Überlauf (${overflow}px)`);

console.log(`\n${fails ? fails + ' FEHLER' : 'alle Prüfungen bestanden'}`);
console.log('ERRORS:', errs.length ? errs : 'none');
await browser.close();
