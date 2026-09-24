/*
 * Was trainiert ist, bleibt trainiert.
 *
 * Gefunden bei der Durchsicht der ganzen App, bestätigt von einem zweiten
 * Prüfer, der es selbst nachgestellt hat: Der Plan einer Einheit wurde bei
 * jedem Anzeigen mit den *heutigen* Einstellungen neu gerechnet – auch für
 * Einheiten, die längst trainiert waren. Die Folgen, gemessen:
 *
 *   „Tennisarm" angehakt      Woche 1 zeigte 9/12 statt 18/18, Statistik 9
 *   Stufe gewechselt          das liegende Knieheben wurde rückwirkend hängend
 *   „gestern Padel" nachgetr. Hip Thrust galt als ausgefallen, obwohl gemacht
 *   Aufstieg 3 → 4 Sätze      ein „Zusatztag Woche 1" für eine volle Woche
 *   Nacharbeit mitgemacht     trotzdem ein Zusatztag für denselben Rückstand
 *
 * Die Regel jetzt (behalteProtokolliertes in js/plan.js): Jede Übung, zu der
 * in einer Einheit etwas protokolliert ist, steht dort wieder – egal, was sich
 * danach ändert. Was noch nicht angefasst wurde, bleibt beweglich.
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

// Woche 1 vollständig trainieren, jeweils frisch, dann eine Einstellung ändern.
const szenario = (aenderung) => page.evaluate(async (a) => {
  localStorage.clear();
  const store = await import('./js/store.js');
  const plan = await import('./js/plan.js');
  const { PLAN } = await import('./js/data.js');
  store.resetAll();
  store.setSetting('greeted', true);
  store.setSetting('level', a.level || 'geuebt');
  const vorher = plan.exOf(PLAN[0], 'db');
  vorher.forEach((it) => {
    for (let i = 0; i < it.sets; i++) store.updateSet(1, 'db', it.id, it.sets, i, { done: true, w: '10' });
  });
  store.markDone(1, 'db');
  const stats0 = plan.sammleStats().setsDone;

  if (a.injury) store.setSetting('injuries', [a.injury]);
  if (a.stufe) store.setSetting('level', a.stufe);
  if (a.fassung) store.setSetting('fassung', a.fassung);

  const nachher = plan.exOf(PLAN[0], 'db');
  const p = plan.progressOf(1, 'db');
  return {
    vorher: vorher.map((x) => x.id).sort().join(','),
    nachher: nachher.map((x) => x.id).sort().join(','),
    done: p.done,
    stats: [stats0, plan.sammleStats().setsDone],
    nach: [...(plan.nacharbeit(PLAN[1], 'db') || [])].length,
    offen: plan.offenInWoche(PLAN[1]).summe,
    notiz: plan.injuryNotes(1).dropped.map((d) => d.id),
  };
}, aenderung);

for (const [name, a] of [
  ['Tennisarm angehakt', { injury: 'tennisarm' }],
  ['Handgelenksüberlastung angehakt', { injury: 'handgelenk-reizung' }],
  ['Bandscheibe LWS angehakt', { injury: 'lws-bandscheibe' }],
  ['Stufe Anfänger → Geübt', { level: 'anfaenger', stufe: 'geuebt' }],
  ['eigene Fassung gewählt', { fassung: { 'sz-curls': 'rucksack-curls', 'einarmiges-kh-rudern': 'rucksack-rudern' } }],
]) {
  const r = await szenario(a);
  check(r.vorher === r.nachher,
    `${name}: die trainierte Einheit zeigt dieselben Übungen${r.vorher === r.nachher ? '' : ` (${r.vorher} → ${r.nachher})`}`);
  check(r.stats[0] === r.stats[1], `${name}: Statistik unverändert (${r.stats.join(' → ')} Sätze)`);
  check(r.nach === 0 && r.offen < 0.01, `${name}: kein erfundener Rückstand (${r.nach} Nacharbeit, ${r.offen.toFixed(2)} offen)`);
  check(r.notiz.length === 0, `${name}: keine Notiz, dass etwas ausgefallen sei`);
}

// --- Mitten in der Einheit: Gemachtes bleibt, Kommendes wird getauscht -----
const mitten = await page.evaluate(async () => {
  localStorage.clear();
  const store = await import('./js/store.js');
  const plan = await import('./js/plan.js');
  const { PLAN } = await import('./js/data.js');
  store.resetAll();
  store.setSetting('greeted', true);
  store.setSetting('level', 'geuebt');
  const w = PLAN.find((x) => x.ex.some((e) => e.id === 'gewichtete-liegestuetze')
    && x.ex.some((e) => e.id === 'sz-curls'));
  // Zwei Sätze Liegestütze, die Curls noch nicht angefasst.
  store.updateSet(w.n, 'db', 'gewichtete-liegestuetze', 3, 0, { done: true, w: '5' });
  store.updateSet(w.n, 'db', 'gewichtete-liegestuetze', 3, 1, { done: true, w: '5' });
  // Handgelenksüberlastung sperrt beide.
  store.setSetting('injuries', ['handgelenk-reizung']);
  const ids = plan.exOf(w, 'db').map((x) => x.id);
  return { ids, done: plan.progressOf(w.n, 'db').done };
});
console.log('     mitten in der Einheit:', mitten.ids.join(', '));
check(mitten.ids.includes('gewichtete-liegestuetze'),
  'die angefangene Übung bleibt stehen – ihre Sätze verschwinden nicht');
check(mitten.done === 2, `und die zwei Sätze zählen weiter (${mitten.done})`);
check(!mitten.ids.includes('sz-curls') && mitten.ids.includes('hammer-curls'),
  'die noch nicht angefasste wird trotzdem getauscht (SZ-Curls → Hammercurls)');

// --- Moduswechsel mitten in der Einheit -----------------------------------
// Drei Übungen mit Hanteln, dann umgeschaltet, drei ohne. Vorher zählte nur
// der Eimer des gerade gewählten Modus: 9 von 18, und die nächste Einheit
// bekam Nacharbeit für schon Gemachtes.
const wechsel = await page.evaluate(async () => {
  localStorage.clear();
  const store = await import('./js/store.js');
  const plan = await import('./js/plan.js');
  const { PLAN } = await import('./js/data.js');
  store.resetAll();
  store.setSetting('greeted', true);
  store.setSetting('level', 'geuebt');
  const ex = plan.exOf(PLAN[0], 'db');
  ex.forEach((it, k) => {
    const m = k < 3 ? 'db' : 'bw';
    if (k === 3) store.setWorkoutMode(1, 'bw');
    for (let i = 0; i < it.sets; i++) store.updateSet(1, m, it.id, it.sets, i, { done: true, w: '10' });
  });
  const p = plan.progressOf(1, 'bw');
  return { done: p.done, total: p.total, nach: [...(plan.nacharbeit(PLAN[1], 'bw') || [])].length };
});
check(wechsel.done === wechsel.total, `nach einem Moduswechsel zählen alle Sätze (${wechsel.done}/${wechsel.total})`);
check(wechsel.nach === 0, `und die nächste Einheit bekommt keine Nacharbeit dafür (${wechsel.nach})`);

// --- Und über die echte App: kein Zusatztag nach einem Aufstieg ------------
await page.evaluate(async () => {
  localStorage.clear();
  const store = await import('./js/store.js');
  const plan = await import('./js/plan.js');
  const { PLAN } = await import('./js/data.js');
  const { addDays, todayISO } = await import('./js/dates.js');
  store.resetAll();
  store.setSetting('greeted', true);
  store.setSetting('name', 'T');
  store.setSetting('level', 'geuebt');
  for (const n of [1, 2, 3, 4]) {
    plan.exOf(PLAN[n - 1], 'db').forEach((it) => {
      for (let i = 0; i < it.sets; i++) store.updateSet(n, 'db', it.id, it.sets, i, { done: true, w: '10' });
    });
    store.markDone(n, 'db');
    store.getState().log[n].startedOn = addDays(todayISO(), -(11 - 2 * n));
  }
  store.setSetting('level', 'fortgeschritten');
  store.flush();
});
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(600);
const zusatz = await page.evaluate(async () => (await import('./js/store.js')).getState().customs
  .filter((c) => /Zusatztag/.test(c.name || '')).map((c) => c.name));
check(zusatz.length === 0, `nach einem Aufstieg kein Zusatztag für die volle Woche (${zusatz.join(', ') || 'keiner'})`);

check(errs.length === 0, `keine Fehler${errs.length ? ': ' + errs.slice(0, 2).join(' | ') : ''}`);
await browser.close();
console.log(`\n${fails ? fails + ' FEHLER' : 'alle Prüfungen bestanden'}`);
