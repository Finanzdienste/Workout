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
 *   3. Ändert er sich wirklich, bleiben angefangene und trainierte Einheiten,
 *      wie sie waren, und nur der Rest bekommt den neuen Plan. Die Runde läuft
 *      weiter (bis v204 fing sie bei eins an).
 *   4. Und die App sagt es. Eine Einheit, die plötzlich andere Übungen zeigt,
 *      braucht einen Grund, den man lesen kann.
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

// --- 4. Ein echter Wechsel schreibt fest, was angefangen ist ------------
//
// Bis v204 legte er den ganzen Verlauf in die Ablage, und die Runde fing bei
// eins an. Jetzt: Was angefangen oder trainiert ist, bleibt genau so, wie es
// war; alles andere bekommt den neuen Plan, und die Runde läuft weiter.
//
// Nachgestellt wird der echte Fall – ein Protokoll, dessen Einheiten *andere*
// Übungen tragen als der geladene Plan: Einheit 1 fertig, Einheit 2 halb,
// Einheit 5 nur angesehen (leere Einträge vom Vorausblättern).
const fall = await page.evaluate(async () => {
  const { PLAN } = await import('./js/data.js');
  const fremd = (k) => PLAN[k].ex.map((x) => x.id);
  const alt1 = fremd(10);
  const alt2 = fremd(11);
  const alt5 = fremd(12);
  const eintrag = (ids, bis) => {
    const e = { mode: 'db', startedOn: '2026-09-01', db: {}, soll: {} };
    ids.forEach((id, k) => {
      e.db[id] = [0, 1, 2].map(() => ({ w: k < bis ? '20' : '', done: k < bis }));
      e.soll[id] = 3;
    });
    return e;
  };
  const log = { 1: { ...eintrag(alt1, 99), done: 'db' }, 2: eintrag(alt2, 2), 5: eintrag(alt5, 0) };
  log[2].startedOn = '2026-09-03';
  delete log[5].startedOn;
  localStorage.removeItem('workout.rounds.v1');
  localStorage.setItem('workout.state.v1', JSON.stringify({
    greeted: true, name: 'T', focus: 'standard', log, shift: 7,
    planStand: { standard: 'alterplan01' },
  }));
  return { alt1, alt2, neu5: PLAN[4].ex.map((x) => x.id) };
});
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(500);
s = await page.evaluate(async () => {
  const store = await import('./js/store.js');
  const { PLAN } = await import('./js/data.js');
  const { exOf, progressOf, defaultWorkoutNo } = await import('./js/plan.js');
  const { lebenStats } = await import('./js/bilanz.js');
  const st = store.getState();
  const ids = (n) => exOf(PLAN[n - 1], 'db').map((x) => x.id).sort().join(',');
  return {
    imLog: Object.keys(st.log || {}).length, runden: (st.rounds || []).length,
    stand: (st.planStand || {}).standard, shift: st.shift,
    e1: ids(1), e2: ids(2), e5: ids(5),
    p1: progressOf(1, 'db'), p2: progressOf(2, 'db'),
    offen: defaultWorkoutNo(), saetze: lebenStats().saetze,
  };
});
const sortiert = (l) => [...l].sort().join(',');
console.log('     nach dem Wechsel:', JSON.stringify({ ...s, e1: undefined, e2: undefined, e5: undefined }));
check(s.runden === 0 && s.imLog === 3, `nichts wandert in die Ablage (${s.runden} Runden, ${s.imLog} Einheiten im Protokoll)`);
check(s.stand === staende.standard, 'der neue Stand ist vermerkt');
check(s.e1 === sortiert(fall.alt1) && s.p1.complete,
  'die fertige Einheit zeigt die Übungen, die trainiert wurden, und bleibt fertig');
check(s.e2 === sortiert(fall.alt2) && s.p2.done === 6 && !s.p2.complete,
  `die angefangene behält ihre Liste samt dem, was noch fehlt (${s.p2.done}/${s.p2.total})`);
check(s.e5 === sortiert(fall.neu5),
  'eine bloß angesehene Einheit bekommt den neuen Plan');
check(s.offen === 2, `weiter geht es mit der angefangenen Einheit, nicht bei eins (${s.offen})`);
check(s.saetze === fall.alt1.length * 3 + 6, `die Statistik zählt jeden abgehakten Satz weiter (${s.saetze})`);

// Und es steht auch da.
const hinweis = (await page.locator('#view').textContent()).replace(/\s+/g, ' ');
console.log('     ' + (hinweis.match(/Der Plan wurde überarbeitet.{0,160}/) || ['(kein Hinweis)'])[0]);
check(/Der Plan wurde überarbeitet/.test(hinweis), 'das Dashboard sagt, dass der Plan ein anderer ist');
check(/2 angefangenen oder trainierten Einheiten bleiben/.test(hinweis),
  'und dass die zwei angefangenen Einheiten bleiben, wie sie waren');
check(/Gewichte, Bänder, Erfahrungsstufe und Statistik bleiben/.test(hinweis),
  'und was sonst *nicht* verloren geht');
await page.locator('[data-act="umbau-ok"]').click();
await page.waitForTimeout(300);
check(!/Der Plan wurde überarbeitet/.test((await page.locator('#view').textContent()).replace(/\s+/g, ' ')),
  'weggetippt ist er weg');

// --- 5. Und danach ist Ruhe --------------------------------------------
// Auch ein zweiter Planwechsel schreibt nichts um, was schon fest ist.
await page.evaluate(async () => {
  const store = await import('./js/store.js');
  store.setSetting('planStand', { standard: 'nochandersplan' });
  store.flush();
});
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(400);
const nochmal = await page.evaluate(async () => {
  const st = (await import('./js/store.js')).getState();
  return { runden: st.rounds.length, fest1: (st.log[1].fest || []).length, umbau: st.planUmbau };
});
check(nochmal.runden === 0 && nochmal.fest1 === fall.alt1.length,
  'ein weiterer Wechsel legt nichts weg und schreibt nichts neu fest');

check(errs.length === 0, `keine Fehler${errs.length ? ': ' + errs.slice(0, 2).join(' | ') : ''}`);
await browser.close();
console.log(`\n${fails ? fails + ' FEHLER' : 'alle Prüfungen bestanden'}`);
