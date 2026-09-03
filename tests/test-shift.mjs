import { chromium } from 'playwright';
import { URL, SHOT } from './umgebung.mjs';


const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 414, height: 896 } });

// Genau EIN Init-Script; der Tag kommt aus dem localStorage, damit sich über
// Reloads hinweg keine Mocks stapeln.
await ctx.addInitScript(() => {
  let iso = null;
  try { iso = localStorage.getItem('__testday'); } catch { /* about:blank */ }
  if (!iso) return;
  const Real = Date;
  const fixed = new Real(`${iso}T12:00:00`).getTime();
  function Mock(...args) {
    if (!(this instanceof Mock)) return new Real(fixed).toString();
    return args.length === 0 ? new Real(fixed) : new Real(...args);
  }
  Mock.prototype = Real.prototype;
  Mock.now = () => fixed;
  Mock.parse = Real.parse;
  Mock.UTC = Real.UTC;
  window.Date = Mock;
});

const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()); });

// Dieser erste Aufruf läuft noch mit der echten Systemzeit und schreibt je
// nach heutigem Datum bereits eine Verschiebung. Weg damit, sonst startet der
// erste gemockte Lauf nicht bei null.
await page.goto(URL, { waitUntil: 'networkidle' });
await page.evaluate(() => { localStorage.clear(); localStorage.setItem('workout.state.v1', '{"greeted":true}'); });

async function at(iso) {
  await page.evaluate((v) => localStorage.setItem('__testday', v), iso);
  await page.reload({ waitUntil: 'networkidle' });
  const seen = await page.evaluate(() => new Date().toISOString().slice(0, 10));
  if (seen !== iso) throw new Error(`Datums-Mock griff nicht: ${seen} statt ${iso}`);
}

/** Klickt so, wie ein Nutzer es täte: erst ans Seitenende scrollen. */
async function tap(selector) {
  // Manche Knoepfe liegen in der Uebungsliste, eine Ebene unter der Startansicht
  if (!(await page.locator(selector).count())) {
    const open = page.locator('[data-act="show-list"]');
    if (await open.count()) { await open.click(); await page.waitForTimeout(150); }
  }
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.locator(selector).click();
  await page.waitForTimeout(200); // Debounce des Speicherns abwarten
}

const readState = () => page.evaluate(() => JSON.parse(localStorage.getItem('workout.state.v1') || '{}'));

async function snap(label) {
  await page.waitForTimeout(200); // debounce des Speicherns abwarten
  // Die App bleibt beim Neuladen im zuletzt sichtbaren Tab; hier wird aber
  // immer der Kopf der Startansicht gelesen.
  if (await page.locator('.hero-eyebrow').count() === 0) {
    await page.locator('.tab[data-tab="dashboard"]').click();
    await page.waitForTimeout(200);
  }
  const st = await readState();
  const eyebrow = await page.locator('.hero-eyebrow').textContent();
  const title = await page.locator('.hero-title').textContent();
  console.log(`${label.padEnd(32)} shift=${String(st.shift ?? 0).padStart(2)}  ${eyebrow}  ->  ${title}`);
  return { shift: st.shift ?? 0, eyebrow, title, st };
}

let fails = 0;
function check(cond, msg) {
  console.log(`   ${cond ? 'OK  ' : 'FAIL'} ${msg}`);
  if (!cond) { fails++; process.exitCode = 1; }
}

// --- Termine aus dem Plan holen -------------------------------------------
// Früher standen hier feste Daten. Die Wochentage des Plans sind aber
// einstellbar geworden (Mo/Mi/Fr/Sa statt Do/So/…), und dann stimmte kein
// einziges Datum mehr. Also alles aus PLAN ableiten.
const P = await page.evaluate(async () => (await import('./js/data.js')).PLAN.slice(0, 4).map((w) => w.date));
const MON = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli',
  'August', 'September', 'Oktober', 'November', 'Dezember'];
const plus = (iso, d) => {
  const x = new Date(`${iso}T12:00:00`);
  x.setDate(x.getDate() + d);
  return x.toISOString().slice(0, 10);
};
const de = (iso) => {
  const x = new Date(`${iso}T12:00:00`);
  return `${x.getDate()}. ${MON[x.getMonth()]}`;
};
const tag1 = P[0];                 // Plantag von Workout 1
const tag2 = plus(tag1, 1);        // ein Tag verpasst
const tag4 = plus(tag1, 3);        // insgesamt drei Tage verpasst
const w2 = plus(P[1], 3);          // Workout 2, um drei Tage geschoben
const verpasst2 = plus(w2, 1);     // auch Workout 2 liegen gelassen
const spaet = plus(w2, 16);        // lange nichts getan: 15 Tage nach dem Nachrücken
console.log(`   Plan: 1=${de(tag1)} 2=${de(P[1])} · verschoben: 2=${de(w2)}`);

await at(tag1);
let s = await snap('Trainingstag, nichts getan');
check(s.shift === 0, 'kein Shift am Trainingstag selbst');
check(s.eyebrow.startsWith('Heute'), 'Workout 1 ist heute fällig');

await at(tag2);
s = await snap('1 Tag verpasst');
check(s.shift === 1, 'Shift = 1');
check(s.title.includes(de(tag2)), `Workout 1 liegt jetzt auf dem ${de(tag2)}`);
check(s.eyebrow.startsWith('Heute'), 'und ist wieder heute fällig');

await at(tag4);
s = await snap('2 weitere Tage verpasst');
check(s.shift === 3, 'Shift = 3');
check(s.title.includes(de(tag4)), `Workout 1 auf dem ${de(tag4)}`);
await page.screenshot({ path: `${SHOT}/10-dash-shifted.png`, fullPage: false });

// --- Workout 1 an diesem Tag tatsächlich trainieren -----------------------
await tap('[data-act="complete-workout"]');
s = await snap('Workout 1 abgeschlossen');
check(s.st.log['1'].startedOn === tag4, `Trainingstag festgehalten (${s.st.log['1'].startedOn})`);

await page.evaluate(() => window.scrollTo(0, 0));
await page.locator('[data-act="nav-workout"][data-delta="1"]').click();
s = await snap('Workout 2 angesehen');
check(s.title.includes(de(w2)), `Workout 2 auf dem ${de(w2)} – Abstand aus dem Plan gewahrt`);

// --- Workout 2 verpassen ---------------------------------------------------
await at(verpasst2);
s = await snap('Workout 2 verpasst');
check(s.shift === 4, 'Shift = 4 (nicht erneut ab Workout 1 gerechnet)');
check(s.eyebrow.includes('Workout 2'), 'Dashboard steht auf Workout 2');
check(s.title.includes(de(verpasst2)), 'Workout 2 auf heute nachgerückt');

// --- Historie darf nicht mitwandern ---------------------------------------
// Der Plan-Tab ist raus; durchgeblättert wird jetzt direkt im Dashboard.
const step = async (d, n) => {
  for (let i = 0; i < n; i++) {
    await page.locator(`[data-act="nav-workout"][data-delta="${d}"]`).click();
    await page.waitForTimeout(60);
  }
  return snap(`Workout angesehen (${d > 0 ? '+' : ''}${d * n})`);
};
const s3 = await step(1, 1);
const s4 = await step(1, 1);
const s1 = await step(-1, 3);
console.log(`   Termine: 1=${s1.title}  3=${s3.title}  4=${s4.title}`);
check(s1.title.includes(de(tag4)), 'erledigtes Workout 1 bleibt auf seinem echten Trainingstag');
// Termine kommen aus dem generierten Plan, nicht aus dem Gedächtnis.
const soll = await page.evaluate(async () => {
  const { PLAN } = await import('./js/data.js');
  const plus = (iso, d) => { const x = new Date(iso); x.setDate(x.getDate() + d); return x; };
  const de = (x) => `${x.getDate()}. ${['Januar','Februar','März','April','Mai','Juni','Juli',
    'August','September','Oktober','November','Dezember'][x.getMonth()]}`;
  return { w3: de(plus(PLAN[2].date, 4)), w4: de(plus(PLAN[3].date, 4)) };
});
check(s3.title.includes(soll.w3), `Workout 3 auf dem ${soll.w3} (Plan + 4 Tage)`);
check(s4.title.includes(soll.w4), `Workout 4 auf dem ${soll.w4} (Plan + 4 Tage)`);
await step(1, 1);
const s2 = await snap('zurück auf Workout 2');
// Die Verschiebung steht im Datum, nicht in einem Hinweis. „Plan + N Tage"
// gab es einmal in der Kopfzeile und als Abzeichen, und danach noch als
// Kasten „N Tage verpasst" – alles drei ist raus, weil es nach einem
// Rückstand aussah, den es nicht gibt. Diese Prüfung hing als Oder-Zweig
// daran und wäre stillschweigend zu einer halben Prüfung geworden.
check(s2.title.includes(de(verpasst2)),
  `die verschobene Einheit steht auf ihrem neuen Tag (${de(verpasst2)})`);
await page.screenshot({ path: `${SHOT}/11-plan-shifted.png`, fullPage: false });

// --- Nachrücken passiert von allein ----------------------------------------
// Den Schalter dafür gibt es nicht mehr: Wer einen Tag verpasst, will nicht
// gefragt werden, ob nachgerückt werden darf.
await at(spaet);
s = await snap('15 Tage weg');
check(s.shift === 19, 'Shift = 19');
check(s.title.includes(de(spaet)), 'Workout 2 auf heute nachgerückt');

// --- Manuelle Korrektur ----------------------------------------------------
await page.locator('.tab[data-tab="settings"]').click();
await page.screenshot({ path: `${SHOT}/12-settings-shift.png`, fullPage: true });
await tap('[data-act="shift-plus"]');
check((await readState()).shift === 20, '+1 Tag von Hand');
await tap('[data-act="shift-minus"]');
check((await readState()).shift === 19, '−1 Tag von Hand');
await tap('[data-act="shift-reset"]');
check((await readState()).shift === 0, 'Zurücksetzen auf Original-Termine');

// --- Ganz ohne verpasste Tage ----------------------------------------------
await page.evaluate(() => localStorage.removeItem('workout.state.v1'));
await at(tag1);
s = await snap('frischer Start am Plantag');
check(s.shift === 0, 'kein Shift ohne Rückstand');

console.log(`\n${fails ? fails + ' FEHLER' : 'alle Prüfungen bestanden'}`);
console.log('ERRORS:', errs.length ? errs : 'none');
await browser.close();
