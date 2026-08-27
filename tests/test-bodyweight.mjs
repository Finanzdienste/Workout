/*
 * Der Bodyweight-Modus hat seine eigene Satzzahl.
 *
 * Gerechnet war der Plan für die Hantel-Fassung. Ohne Zusatzlast trifft
 * dieselbe Übung aber teils andere Muskeln – der Goblet Squat hält den Bauch
 * mit 0,35, seine Bodyweight-Fassung mit 0,20 –, und deshalb lag der
 * Bodyweight-Modus systematisch daneben, im ausgewogenen Plan beim Bauch um
 * 0,59 Sätze die Woche. Jetzt bekommt jeder Auftritt zwei bis vier Sätze statt
 * immer drei, und beide Modi treffen dieselben Ziele.
 *
 * Die eigentliche Gefahr dabei ist nicht die Rechnung, sondern die App: Sobald
 * die Satzzahl vom Modus abhängt, wird aus jeder Stelle, die einen Modus
 * *kennt*, ihn aber nicht *weitergibt*, ein Fehler. Eine im Bodyweight-Modus
 * fertig gemachte Einheit würde am Soll der Hantel-Fassung gemessen und käme
 * nie auf „abgeschlossen"; eine halb gemachte Hantel-Einheit gälte nach einem
 * Tipp auf den Umschalter plötzlich als fertig.
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

const frisch = async (extra = {}) => {
  await page.evaluate((e) => localStorage.setItem('workout.state.v1',
    JSON.stringify({ greeted: true, name: 'T', level: 'geuebt', ...e })), extra);
  await page.reload({ waitUntil: 'networkidle' });
};

await page.goto(URL, { waitUntil: 'networkidle' });
await frisch();

// --- 1. Die Pläne tragen eine eigene Bodyweight-Satzzahl ---------------
const daten = await page.evaluate(async () => {
  const { PLANS } = await import('./js/data.js');
  const out = {};
  for (const [key, v] of Object.entries(PLANS)) {
    let auftritte = 0; let anders = 0;
    const spanne = new Set();
    v.plan.forEach((w) => w.ex.forEach((it) => {
      const bw = it.bwSets ?? it.sets;
      auftritte += 1;
      spanne.add(bw);
      if (bw !== it.sets) anders += 1;
    }));
    out[key] = { auftritte, anders, spanne: [...spanne].sort() };
  }
  return out;
});
for (const [key, d] of Object.entries(daten)) {
  check(d.anders > 0, `${key}: ${d.anders} von ${d.auftritte} Auftritten weichen ab`);
  check(d.spanne.every((n) => n >= 2 && n <= 4),
    `${key}: alle Bodyweight-Sätze liegen zwischen zwei und vier (${d.spanne.join(', ')})`);
}

// --- 2. Beide Modi treffen dieselben Wochenziele ------------------------
// Die Probe, um die es überhaupt geht – dieselbe Rechnung wie im Generator,
// noch einmal an den ausgelieferten Daten.
const ziele = await page.evaluate(async () => {
  const { PLANS, EXERCISES } = await import('./js/data.js');
  const byId = new Map(EXERCISES.map((e) => [e.id, e]));
  const out = {};
  for (const [key, v] of Object.entries(PLANS)) {
    const wochen = v.plan.length / 4;
    const rechne = (feld, seite) => {
      const acc = {};
      v.plan.forEach((w) => w.ex.forEach((it) => {
        for (const [m, a] of Object.entries(byId.get(it.id)[seite].shares)) {
          acc[m] = (acc[m] || 0) + (it[feld] ?? it.sets) * a;
        }
      }));
      return acc;
    };
    const werte = { db: rechne('sets', 'db'), bw: rechne('bwSets', 'bw') };
    const schlimmst = (seite) => Object.entries(v.target)
      .filter(([m]) => !v.derived.includes(m))
      .map(([m, ziel]) => [m, Math.abs((werte[seite][m] || 0) / wochen - ziel)])
      .sort((a, b) => b[1] - a[1])[0];
    out[key] = { db: schlimmst('db'), bw: schlimmst('bw') };
  }
  return out;
});
for (const [key, z] of Object.entries(ziele)) {
  check(z.db[1] < 0.005, `${key}: die Hantel-Fassung trifft weiter exakt (${z.db[1].toFixed(3)})`);
  check(z.bw[1] < 0.05,
    `${key}: die Bodyweight-Fassung trifft jetzt auch (schlechteste ${z.bw[0]} ${z.bw[1].toFixed(3)})`);
}

// --- 3. Die App zeigt je Modus die Zahl dieses Modus -------------------
const fall = await page.evaluate(async () => {
  const { PLANS } = await import('./js/data.js');
  for (const w of PLANS.standard.plan) {
    const it = w.ex.find((x) => (x.bwSets ?? x.sets) !== x.sets);
    if (it) return { n: w.n, id: it.id, db: it.sets, bw: it.bwSets };
  }
  return null;
});
check(!!fall, `eine Übung mit unterschiedlicher Satzzahl gefunden (${JSON.stringify(fall)})`);

const knoepfe = async (n, modus, id) => {
  await page.evaluate(async ([nn, m]) => {
    const s = await import('./js/store.js');
    s.setWorkoutMode(nn, m);
    s.setSetting('lastWorkout', nn);
  }, [n, modus]);
  await page.reload({ waitUntil: 'networkidle' });
  const auf = page.locator('[data-act="show-list"]');
  if (await auf.count()) { await auf.first().click(); await page.waitForTimeout(250); }
  return page.locator(`.ex-sets .set-btn[data-ex="${id}"]`).count();
};

const nDb = await knoepfe(fall.n, 'db', fall.id);
const nBw = await knoepfe(fall.n, 'bw', fall.id);
check(nDb === fall.db, `im Hantel-Modus stehen ${fall.db} Satzknöpfe (${nDb})`);
check(nBw === fall.bw, `im Bodyweight-Modus stehen ${fall.bw} (${nBw})`);
check(nDb !== nBw, 'und das sind wirklich verschiedene Zahlen');

// --- 4. Abschluss wird je Modus am eigenen Soll gemessen ---------------
// Alle Bodyweight-Sätze abhaken; danach muss die Einheit als abgeschlossen
// gelten. Vorher rechnete das Soll aus dem Hantel-Modus dagegen.
await frisch();
const fertig = await page.evaluate(async ([n]) => {
  const s = await import('./js/store.js');
  const { PLANS } = await import('./js/data.js');
  s.setWorkoutMode(n, 'bw');
  const w = PLANS.standard.plan.find((x) => x.n === n);
  w.ex.forEach((it) => {
    const anzahl = it.bwSets ?? it.sets;
    for (let i = 0; i < anzahl; i++) s.updateSet(n, 'bw', it.id, anzahl, i, { done: true });
  });
  return w.ex.map((it) => it.bwSets ?? it.sets).reduce((a, b) => a + b, 0);
}, [fall.n]);
await page.reload({ waitUntil: 'networkidle' });
await page.locator('.tab[data-tab="stats"]').click();
await page.waitForTimeout(400);
const statText = (await page.locator('.stat-grid').first().textContent()).replace(/\s+/g, ' ');
check(/\b1\b/.test(statText),
  `nach ${fertig} abgehakten Bodyweight-Sätzen zählt die Statistik die Einheit (${statText.slice(0, 90)}…)`);

// --- 5. Ein Modus wird nie am Soll des anderen gemessen ---------------
// Die Gegenprobe zu 4: so viele Sätze abhaken, wie der *andere* Modus
// verlangt. Daraus darf kein Abschluss werden – und die Anzeige muss die Zahl
// des eingestellten Modus nennen, nicht die des anderen.
await frisch();
const soll = await page.evaluate(async ([n]) => {
  const s = await import('./js/store.js');
  const { PLANS } = await import('./js/data.js');
  s.setWorkoutMode(n, 'db');
  s.setSetting('lastWorkout', n);
  const w = PLANS.standard.plan.find((x) => x.n === n);
  // Je Übung nur so viele Sätze wie im Bodyweight-Modus – im Hantel-Modus
  // fehlt damit überall dort etwas, wo die Bodyweight-Zahl kleiner ist.
  let gesetzt = 0;
  w.ex.forEach((it) => {
    const wenig = Math.min(it.sets, it.bwSets ?? it.sets);
    for (let i = 0; i < wenig; i++) { s.updateSet(n, 'db', it.id, it.sets, i, { done: true }); gesetzt += 1; }
  });
  return { gesetzt, db: w.ex.reduce((a, it) => a + it.sets, 0) };
}, [fall.n]);
await page.reload({ waitUntil: 'networkidle' });
const abzeichen = (await page.locator('.hero-badges, .ov-top').first().textContent()).replace(/\s+/g, ' ');
check(soll.gesetzt < soll.db, `es fehlen Sätze (${soll.gesetzt} von ${soll.db})`);
check(!/Abgeschlossen/.test(abzeichen),
  `die Einheit gilt nicht als abgeschlossen (${abzeichen.slice(0, 70)}…)`);
check(abzeichen.includes(`${soll.gesetzt}/${soll.db}`),
  `und die Anzeige nennt das Hantel-Soll ${soll.gesetzt}/${soll.db} (${abzeichen.slice(0, 70)}…)`);

check(errs.length === 0, `keine Fehler${errs.length ? ': ' + errs.join(' | ') : ''}`);
console.log(`\n${fails ? fails + ' FEHLER' : 'alle Prüfungen bestanden'}`);
await browser.close();
