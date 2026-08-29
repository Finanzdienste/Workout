/*
 * Die Ablage liegt nicht mehr im Weg jedes abgehakten Satzes.
 *
 * Der Zustand wird bei **jeder** Änderung komplett gespeichert – auch bei einem
 * angetippten Satz, also einige Hundert Mal je Plan. Die abgeschlossenen Runden
 * lagen bis eben mit in diesem Zustand: rund 56 KB je Runde, die bei jedem
 * Tipp mit serialisiert und geschrieben wurden, obwohl sie sich zwei-, dreimal
 * im halben Jahr ändern. Auf einem Handy mitten im Training ist das die eine
 * Stelle, an der die App von selbst träger wird, je länger man sie benutzt.
 *
 * Geprüft wird deshalb nicht „ist ein zweiter Schlüssel da", sondern die vier
 * Dinge, an denen die Auslagerung scheitern könnte:
 *
 *   1. Ein alter Stand verliert seine Runden nicht (die Wanderung).
 *   2. Ein angetippter Satz fasst die Ablage nicht an.
 *   3. Der Schreibweg ist wirklich kürzer – gemessen, nicht behauptet.
 *   4. Sicherung und Zurücksetzen kennen beide Hälften.
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

const KB = (n) => `${(n / 1024).toFixed(0)} KB`;

/** Ein vollständiges Protokoll über `n` Einheiten – so groß wie im Ernstfall. */
const protokoll = (n) => page.evaluate(async (anzahl) => {
  const { PLAN } = await import('./js/data.js');
  const log = {};
  PLAN.slice(0, anzahl).forEach((w) => {
    const e = { mode: 'db', done: 'db', startedOn: '2026-01-01', secs: 3000, db: {} };
    w.ex.forEach((it) => {
      e.db[it.id] = Array.from({ length: it.sets }, () => ({ w: '22.5', r: '10', done: true }));
    });
    log[w.n] = e;
  });
  return log;
}, n);

const groessen = () => page.evaluate(() => ({
  haupt: (localStorage.getItem('workout.state.v1') || '').length,
  ablage: (localStorage.getItem('workout.rounds.v1') || '').length,
}));

await page.goto(URL, { waitUntil: 'networkidle' });
const voll = await protokoll(84);

// --- 1. Ein alter Stand wandert, ohne etwas zu verlieren -----------------
// So sah der Speicher vor der Auslagerung aus: alles in einem Schlüssel. Genau
// das liegt auf jedem Gerät, das die App schon benutzt hat.
await page.evaluate((log) => {
  localStorage.removeItem('workout.rounds.v1');
  localStorage.setItem('workout.state.v1', JSON.stringify({
    greeted: true, name: 'Tobi', level: 'geuebt', log: {},
    weights: { 'goblet-squat': 30 },
    rounds: [
      { finishedOn: '2026-01-10', focus: 'standard', log },
      { finishedOn: '2026-05-10', focus: 'cut', log },
    ],
  }));
}, voll);
const altGross = (await groessen()).haupt;
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(400);

const nachWanderung = await page.evaluate(async () => {
  const s = (await import('./js/store.js')).getState();
  return {
    imSpeicher: (s.rounds || []).length,
    einheiten: Object.keys(((s.rounds || [])[0] || {}).log || {}).length,
    gewicht: s.weights['goblet-squat'],
    hauptKey: JSON.parse(localStorage.getItem('workout.state.v1')).rounds,
    ablageKey: (JSON.parse(localStorage.getItem('workout.rounds.v1') || 'null') || []).length,
  };
});
check(nachWanderung.imSpeicher === 2, `beide Runden sind noch da (${nachWanderung.imSpeicher})`);
check(nachWanderung.einheiten === 84,
  `und vollständig, nicht nur die Hülle (${nachWanderung.einheiten} Einheiten)`);
check(nachWanderung.gewicht === 30, 'der Rest des Standes ebenfalls (30 kg)');
check(nachWanderung.ablageKey === 2, 'sie stehen jetzt im eigenen Schlüssel');
check(nachWanderung.hauptKey === undefined,
  'und nicht mehr im Hauptschlüssel – die Wanderung passiert sofort, nicht irgendwann');

// Wichtig: sofort. Zwischen Laden und erstem Satz darf es keinen Moment geben,
// in dem der Hauptschlüssel die Runden schon los ist und der neue sie noch
// nicht hat – ein Neuladen genau dort hätte sie sonst gekostet.
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(300);
check(await page.evaluate(async () =>
  ((await import('./js/store.js')).getState().rounds || []).length) === 2,
  'auch nach einem zweiten Laden – die Wanderung überlebt sich selbst');

// --- 2. Ein angetippter Satz fasst die Ablage nicht an -------------------
// Direkt am Schlüssel gemessen: Ein Merker hinein, der nur überlebt, wenn
// niemand die Ablage überschreibt.
await page.evaluate(() => {
  const a = JSON.parse(localStorage.getItem('workout.rounds.v1'));
  a[0].merker = 'unangetastet';
  localStorage.setItem('workout.rounds.v1', JSON.stringify(a));
});
await page.evaluate(async () => {
  const store = await import('./js/store.js');
  const { PLAN } = await import('./js/data.js');
  const it = PLAN[0].ex[0];
  for (let i = 0; i < it.sets; i++) {
    store.updateSet(PLAN[0].n, 'db', it.id, it.sets, i, { w: '20', r: '10', done: true });
  }
  store.flush();
});
await page.waitForTimeout(300);
const merker = await page.evaluate(() =>
  JSON.parse(localStorage.getItem('workout.rounds.v1'))[0].merker);
check(merker === 'unangetastet',
  'nach mehreren abgehakten Sätzen ist die Ablage unberührt – sie wird nicht mitgeschrieben');
check(await page.evaluate(async () =>
  Object.keys((await import('./js/store.js')).getState().log).length) === 1,
  'die Sätze selbst sind dagegen angekommen');

// --- 3. Der Schreibweg ist messbar kürzer -------------------------------
const jetzt = await groessen();
console.log(`     vorher alles in einem Schlüssel: ${KB(altGross)} je abgehaktem Satz`);
console.log(`     jetzt Schreibweg ${KB(jetzt.haupt)}, Ablage ${KB(jetzt.ablage)} daneben`);
check(jetzt.ablage > 40 * 1024,
  `die Ablage ist wirklich der große Teil (${KB(jetzt.ablage)})`);
check(jetzt.haupt < altGross / 10,
  `der Schreibweg ist auf unter ein Zehntel geschrumpft (${KB(jetzt.haupt)} statt ${KB(altGross)})`);
check(jetzt.haupt + jetzt.ablage >= altGross * 0.9,
  'und nichts ist dabei verloren gegangen – die Summe stimmt noch');

// --- 4. Sicherung und Zurücksetzen kennen beide Hälften ------------------
// Eine Sicherung ohne die Ablage wäre die stillste Art, sie zu verlieren:
// Die Datei sieht vollständig aus, und der Verlust fällt erst beim Einlesen auf.
const sicherung = await page.evaluate(async () =>
  (await import('./js/store.js')).exportJSON());
const gesichert = JSON.parse(sicherung);
check(Array.isArray(gesichert.rounds) && gesichert.rounds.length === 2,
  `die Sicherung trägt die Ablage weiterhin (${(gesichert.rounds || []).length} Runden)`);

await page.evaluate(async () => (await import('./js/store.js')).resetAll());
await page.waitForTimeout(300);
const nachReset = await page.evaluate(() => ({
  haupt: localStorage.getItem('workout.state.v1'),
  ablage: localStorage.getItem('workout.rounds.v1'),
}));
check(!nachReset.ablage || nachReset.ablage === '[]',
  'Zurücksetzen räumt auch den zweiten Schlüssel');
check(!JSON.parse(nachReset.haupt || '{}').rounds, 'und lässt keine Runden im ersten');

// Und die Sicherung findet zurück – in den richtigen Schlüssel.
await page.evaluate(async (text) => (await import('./js/store.js')).importJSON(text), sicherung);
await page.waitForTimeout(300);
const nachImport = await page.evaluate(() => ({
  imSpeicher: (JSON.parse(localStorage.getItem('workout.rounds.v1') || 'null') || []).length,
  imHaupt: JSON.parse(localStorage.getItem('workout.state.v1')).rounds,
}));
check(nachImport.imSpeicher === 2,
  `eingelesen landet sie im eigenen Schlüssel (${nachImport.imSpeicher} Runden)`);
check(nachImport.imHaupt === undefined, 'und wieder nicht im Schreibweg');

check(errs.length === 0, `keine Fehler${errs.length ? ': ' + errs.slice(0, 2).join(' | ') : ''}`);
console.log(`\n${fails ? fails + ' FEHLER' : 'alle Prüfungen bestanden'}`);
await browser.close();
