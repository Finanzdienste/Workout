/*
 * Ein geänderter Plan deutet nicht um, was schon abgehakt ist.
 *
 * Ein Protokoll steht nach Workout-Nummer. Kommen Übungen in den Katalog und
 * verteilt der Generator neu, steckt hinter Nummer 3 etwas anderes als an dem
 * Tag, an dem sie abgehakt wurde – und die App behauptete rückwirkend, es sei
 * schon immer das gewesen. Derselbe Fehler wie beim Fokuswechsel, nur ohne dass
 * jemand darauf getippt hätte.
 *
 * Jede Planvariante trägt deshalb einen Fingerabdruck ihrer Inhalte. Geprüft
 * wird hier:
 *
 *   1. Der Fingerabdruck hängt an den Übungen, nicht an den Terminen. Die
 *      verschieben sich im Betrieb ständig und ändern nichts an dem, was zu tun
 *      ist – hinge er daran, legte jeder verpasste Tag den Verlauf weg.
 *   2. Bei seiner Einführung passiert nichts. Wer keinen gespeicherten Stand
 *      hat, hat nichts gewechselt.
 *   3. Ändert er sich wirklich, wandert der laufende Verlauf in die Ablage –
 *      und Statistik, Kalender und Trainingstage überleben das.
 */
import { chromium } from 'playwright';
import { URL, ROOT } from './umgebung.mjs';

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 414, height: 896 } });
await ctx.route('**/rest/v1/**', (r) => r.fulfill({ status: 204, body: '' }));
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message));
let fails = 0;
const check = (c, m) => { console.log(`${c ? 'OK  ' : 'FAIL'} ${m}`); if (!c) { fails++; process.exitCode = 1; } };

await page.goto(URL, { waitUntil: 'networkidle' });

// --- 1. Jede Variante hat einen, und keine zwei denselben --------------
const staende = await page.evaluate(async () => {
  const { PLANS } = await import('./js/data.js');
  return Object.fromEntries(Object.entries(PLANS).map(([k, v]) => [k, v.stand]));
});
console.log('     Fingerabdrücke:', JSON.stringify(staende));
const werte = Object.values(staende);
check(werte.every((x) => typeof x === 'string' && x.length >= 8),
  'jede Variante trägt einen Fingerabdruck');
check(new Set(werte).size === werte.length,
  'und keine zwei Varianten denselben – sonst bliebe ein Wechsel unbemerkt');

// --- 2. Er hängt an den Übungen, nicht an den Terminen -----------------
//
// Nachgerechnet an der Quelle: derselbe Plan mit verschobenen Datumsangaben muss
// denselben Abdruck ergeben, ein getauschtes Übungspaar einen anderen.
const { createHash } = await import('node:crypto');
const path = await import('node:path');
const plan = JSON.parse(await (await import('node:fs/promises'))
  .readFile(path.join(ROOT, 'tools', 'plan.json'), 'utf8'));
// Die laufende Nummer steht nicht in der Plandatei – sie entsteht erst beim
// Bauen aus der Reihenfolge. Beim ersten Anlauf hat dieser Test sie deshalb als
// `undefined` mitgehasht und der App einen Fehler angehängt, den sie nicht
// hatte.
const abdruck = (einheiten) => createHash('sha256').update(
  einheiten.map((o, i) => `${i + 1}:${o.ex.map((x) => x.id).join(',')}`).join(';'))
  .digest('hex').slice(0, 12);

const original = plan.plan;
const verschoben = original.map((o) => ({ ...o, date: '2099-01-01' }));
const getauscht = original.map((o, i) => (i === 0
  ? { ...o, ex: [...o.ex].reverse() } : o));
check(abdruck(verschoben) === abdruck(original),
  'verschobene Termine ändern ihn nicht');
check(abdruck(getauscht) !== abdruck(original),
  'eine andere Reihenfolge der Übungen schon');
check(abdruck(original) === staende.standard,
  `und er stimmt mit dem überein, den js/data.js mitbringt (${staende.standard})`);

// --- 3. Bei der Einführung passiert nichts -----------------------------
const einfuehrung = await page.evaluate(async () => {
  const store = await import('./js/store.js');
  const { PLAN } = await import('./js/data.js');
  const log = {};
  PLAN.slice(0, 3).forEach((w) => {
    const e = { mode: 'db', done: 'db', startedOn: '2026-09-01', db: {} };
    w.ex.forEach((it) => { e.db[it.id] = [{ w: '20', done: true }]; });
    log[w.n] = e;
  });
  localStorage.removeItem('workout.rounds.v1');
  localStorage.setItem('workout.state.v1', JSON.stringify({
    greeted: true, name: 'T', focus: 'standard', log,   // planStand fehlt
  }));
  return Object.keys(log).length;
});
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(400);
let s = await page.evaluate(async () => {
  const st = (await import('./js/store.js')).getState();
  return { imLog: Object.keys(st.log || {}).length, runden: (st.rounds || []).length,
           stand: (st.planStand || {}).standard };
});
console.log('     nach der Einführung:', JSON.stringify(s));
check(s.imLog === einfuehrung, `der Verlauf bleibt liegen (${s.imLog} Einheiten)`);
check(s.runden === 0, 'nichts wandert in die Ablage');
check(s.stand === staende.standard, 'der Stand wird nur vermerkt – das ist der Anfang der Buchführung');

// --- 4. Ein echter Wechsel legt den Verlauf weg -------------------------
await page.evaluate(async () => {
  const store = await import('./js/store.js');
  // So sähe es aus, wenn der Plan unter dem laufenden Verlauf ausgetauscht
  // worden wäre: gespeichert ist ein anderer Abdruck als der geladene.
  store.setSetting('planStand', { standard: 'alterplan01' });
});
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(500);
s = await page.evaluate(async () => {
  const store = await import('./js/store.js');
  const { lebenStats } = await import('./js/bilanz.js');
  const st = store.getState();
  const l = lebenStats();
  return { imLog: Object.keys(st.log || {}).length, runden: (st.rounds || []).length,
           stand: (st.planStand || {}).standard, saetze: l.saetze, tage: [...l.tage] };
});
console.log('     nach dem Wechsel:', JSON.stringify(s));
check(s.imLog === 0, `der neue Plan fängt sauber an (${s.imLog} Einheiten im Protokoll)`);
check(s.runden === 1, 'der alte Verlauf liegt in der Ablage, nicht im Müll');
check(s.stand === staende.standard, 'und der neue Stand ist vermerkt');
check(s.saetze > 0, `die Statistik zählt weiter (${s.saetze} Sätze)`);
check(s.tage.includes('2026-09-01'), 'und der Trainingstag steht weiter da');

// --- 5. Und danach ist Ruhe --------------------------------------------
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(400);
const nochmal = await page.evaluate(async () => (await import('./js/store.js')).getState().rounds.length);
check(nochmal === 1,
  'ein zweites Laden legt nichts noch einmal weg – der Abdruck stimmt jetzt ja');

check(errs.length === 0, `keine Fehler${errs.length ? ': ' + errs.slice(0, 2).join(' | ') : ''}`);
await browser.close();
console.log(`\n${fails ? fails + ' FEHLER' : 'alle Prüfungen bestanden'}`);
