/*
 * Einseitige Übungen: jede Seite ihr Haken, jede Seite ihre Pause.
 *
 *     „Vllt sollten bei Übungen bei denen man mit beiden Körperteilen
 *      unabhängig voneinander macht jedesmal abhaken oder? Also hier zb 6?"
 *     „jede Seite brauch ihre eigenen Pausen"
 *
 * Bis v254 hatte jeder Satz einen Knopf, auch bei „8–12 je Bein". Der Haken
 * kam nach beiden Seiten, und mit ihm die Pause – zwischen den Seiten gab es
 * keine. Seit v255 hat ein einseitiger Satz zwei Haken, links und rechts:
 *
 *   - Die erste Seite startet die Seitenpause (die halbe Satzpause, siehe
 *     seitenPause() in js/uebung.js). Gezählt wird noch nichts.
 *   - Die zweite macht den Satz voll, und ab da läuft alles wie bei jedem
 *     Satz: volle Pause, im Supersatz der Partner, nach dem letzten die
 *     nächste Übung.
 *   - Zurücknehmen geht je Seite.
 *
 * Geprüft wird das hier an der Oberfläche, wie man es benutzt, und am
 * Protokoll darunter – ein halber Satz darf nirgends als Satz zählen.
 */
import { chromium } from 'playwright';
import { URL } from './umgebung.mjs';

const browser = await chromium.launch();
const errs = [];
/** Eine frische Seite in einem frischen Kontext – ohne Stand von vorher. */
const seite = async () => {
  const c = await browser.newContext({ viewport: { width: 414, height: 896 } });
  await c.route('**/rest/v1/**', (r) => r.fulfill({ status: 204, body: '' }));
  const p = await c.newPage();
  p.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message));
  p.on('dialog', (d) => d.accept().catch(() => {}));
  return p;
};
let page = await seite();
let fails = 0;
const check = (c, m) => { console.log(`${c ? 'OK  ' : 'FAIL'} ${m}`); if (!c) { fails++; process.exitCode = 1; } };

const zustand = () => page.evaluate(() => JSON.parse(localStorage.getItem('workout.state.v1') || '{}'));
const knopf = (i, seite) => page.locator(`.focus-sets [data-act="toggle-side"][data-i="${i}"][data-seite="${seite}"]`);
const tippe = async (i, seite) => { await knopf(i, seite).click(); await page.waitForTimeout(250); };
const text = async (sel) => ((await page.locator(sel).first().textContent()) || '').replace(/\s+/g, ' ').trim();
const neu = async (extra = {}) => {
  await page.evaluate((x) => {
    localStorage.clear();
    localStorage.setItem('workout.state.v1', JSON.stringify({ greeted: true, name: 'T', level: 'geuebt', ...x }));
  }, extra);
  await page.reload({ waitUntil: 'networkidle' });
};

await page.goto(URL, { waitUntil: 'networkidle' });

/* ------------------------------------------------------------------ *
 * 1. Was einseitig ist, steht im Katalog – und wie lang die Seitenpause ist
 * ------------------------------------------------------------------ */
const kat = await page.evaluate(async () => {
  const { EXERCISES } = await import('./js/data.js');
  const { einseitig, seitenPause } = await import('./js/uebung.js');
  const ja = [];
  EXERCISES.forEach((e) => ['db', 'bw'].forEach((m) => { if (einseitig(e[m])) ja.push(`${e.id}.${m}`); }));
  return { ja, pausen: [45, 60, 90, 120, 150, 180].map(seitenPause), null0: seitenPause(0) };
});
check(kat.ja.includes('split-squat.db') && kat.ja.includes('einbeiniges-stehendes-wadenheben.db')
  && kat.ja.includes('rumaenisches-kreuzheben.bw') && !kat.ja.includes('rumaenisches-kreuzheben.db')
  && !kat.ja.includes('sliding-leg-curl.db') && !kat.ja.includes('chin-ups.db'),
  `einseitig sind genau die Fassungen mit „je Bein" – das RDL ohne Hanteln, mit nicht (${kat.ja.length}: ${kat.ja.join(', ')})`);
check(JSON.stringify(kat.pausen) === JSON.stringify([30, 30, 45, 60, 75, 90]) && kat.null0 === 0,
  `Seitenpause: die halbe Satzpause, auf 15 s, mindestens 30 – für 45/60/90/120/150/180 s: ${kat.pausen.join(' / ')}`);

/* ------------------------------------------------------------------ *
 * 2. In der Einheit: zwei Haken je Satz, nur wo „je Bein" steht
 * ------------------------------------------------------------------ */
await neu();
const plan = await page.evaluate(async () => {
  const { PLAN } = await import('./js/data.js');
  const { workoutByNo, resolve } = await import('./js/plan.js');
  const { einseitig } = await import('./js/uebung.js');
  const n = PLAN[0].n;
  const items = workoutByNo(n, 'db').ex.map((x) => resolve(x, 'db'));
  const idx = items.findIndex(einseitig);
  const beid = items.findIndex((x) => !einseitig(x));
  return {
    n, idx, beid, id: items[idx].id, name: items[idx].name, sets: items[idx].sets, rest: items[idx].rest,
    beidSets: items[beid].sets, w: items[idx].weight,
  };
});
check(plan.idx >= 0, `Workout ${plan.n} hat eine einseitige Übung: ${plan.name}, ${plan.sets} Sätze, ${plan.rest} s Pause`);
await page.locator('[data-act="start-session"]').first().click();
await page.waitForTimeout(300);
await page.locator(`.prog-ex[data-i="${plan.beid}"]`).click();
await page.waitForTimeout(250);
check(await page.locator('.focus-sets [data-act="toggle-set"]').count() === plan.beidSets
  && await page.locator('.focus-sets [data-act="toggle-side"]').count() === 0,
  'beidseitig: ein Knopf je Satz, wie bisher');

await page.locator(`.prog-ex[data-i="${plan.idx}"]`).click();
await page.waitForTimeout(250);
check(await text('.focus-name') === plan.name, `in der Einheit bei ${plan.name}`);
check(await page.locator('.focus-sets .set-paar').count() === plan.sets
  && await page.locator('.focus-sets [data-act="toggle-side"]').count() === 2 * plan.sets
  && await page.locator('.focus-sets [data-act="toggle-set"]').count() === 0,
  `einseitig: ${plan.sets} Sätze mit je zwei Haken – ${2 * plan.sets} Knöpfe („Also hier zb 6?")`);
const lbl = await knopf(0, 'l').getAttribute('aria-label');
check(/^Satz 1 von \d+, links, erledigt$/.test(lbl || ''), `vorgelesen: „${lbl}"`);
const beschriftung = await knopf(0, 'r').textContent();
check(/^\s*1\s*R\s*$/.test(beschriftung || ''), `auf dem Knopf: Satznummer und Seite („${(beschriftung || '').trim()}")`);

/* ------------------------------------------------------------------ *
 * 3. Die erste Seite: Haken, Seitenpause, gezählt wird noch nichts
 * ------------------------------------------------------------------ */
const seitenSoll = await page.evaluate(async (r) => (await import('./js/uebung.js')).seitenPause(r), plan.rest);
await tippe(0, 'l');
let s = await zustand();
let satz = s.log[plan.n].db[plan.id][0];
check(satz.seite === 'l' && !satz.done, `links steht, der Satz noch nicht (${JSON.stringify(satz)})`);
check(plan.w === null || satz.w !== '', `das Gewicht ist mit der ersten Seite notiert (${JSON.stringify(satz.w)})`);
check(/ 0\/\d+ Sätze/.test(await text('.focus-count')), `im Kopf zählt der halbe Satz nicht („${await text('.focus-count')}")`);
check(await page.locator('.prog-sets i.halb').count() === 1, 'oben in der Leiste ein halbes Feld');
check(await knopf(0, 'l').getAttribute('aria-pressed') === 'true' && await knopf(0, 'r').getAttribute('aria-pressed') === 'false',
  'links gedrückt, rechts offen');
check(!!s.rest && s.rest.total === seitenSoll && s.rest.ex === plan.id,
  `die Seitenpause läuft: ${s.rest && s.rest.total} s – die halbe von ${plan.rest} („jede Seite brauch ihre eigenen Pausen")`);
const naechst = await text('#restNext');
check(/^Satz 1 von \d+, rechts · /.test(naechst), `die Leiste sagt, was danach kommt – die Seite zuerst: „${naechst}"`);
check(await page.evaluate(async () => (await import('./js/store.js')).isStarted(1)), 'die Einheit gilt als angefangen');

// Neu laden: Der halbe Satz bleibt halb.
await page.reload({ waitUntil: 'networkidle' });
if (await page.locator(`.prog-ex[data-i="${plan.idx}"]`).count() === 0) {
  const weiter = page.locator('[data-act="start-session"], [data-act="continue-session"]');
  if (await weiter.count()) { await weiter.first().click(); await page.waitForTimeout(300); }
}
await page.locator(`.prog-ex[data-i="${plan.idx}"]`).click();
await page.waitForTimeout(250);
check(await knopf(0, 'l').getAttribute('aria-pressed') === 'true' && await knopf(0, 'r').getAttribute('aria-pressed') === 'false',
  'nach dem Neuladen: links steht noch, rechts ist offen');

/* ------------------------------------------------------------------ *
 * 4. Die zweite Seite macht den Satz voll – mit der vollen Pause
 * ------------------------------------------------------------------ */
await tippe(0, 'r');
s = await zustand();
satz = s.log[plan.n].db[plan.id][0];
check(satz.done === true && satz.seite === undefined, `mit rechts steht der Satz, die Seite ist kein Eintrag mehr (${JSON.stringify(satz)})`);
check(/ 1\/\d+ Sätze/.test(await text('.focus-count')), 'im Kopf: ein Satz');
check(await page.locator('.prog-sets i.halb').count() === 0, 'kein halbes Feld mehr');
check(!!s.rest && s.rest.total === plan.rest && /^Satz 2 von /.test(await text('#restNext')),
  `danach die volle Pause, ${s.rest && s.rest.total} s, vor Satz 2 („${await text('#restNext')}")`);

/* ------------------------------------------------------------------ *
 * 5. Zurücknehmen geht je Seite
 * ------------------------------------------------------------------ */
await tippe(0, 'l');
s = await zustand();
satz = s.log[plan.n].db[plan.id][0];
check(!satz.done && satz.seite === 'r', `links zurück: Der Satz ist offen, rechts bleibt (${JSON.stringify(satz)})`);
check(plan.w === null || satz.w !== '', 'die stehende Seite behält ihr Gewicht');
check(!s.rest, 'und die Pause ist weg');
await tippe(0, 'r');
s = await zustand();
satz = s.log[plan.n].db[plan.id][0];
check(!satz.done && !satz.seite && satz.w === '', `rechts auch zurück: Der Satz ist leer (${JSON.stringify(satz)})`);

/* ------------------------------------------------------------------ *
 * 6. Rechts zuerst geht genauso
 * ------------------------------------------------------------------ */
await tippe(1, 'r');
s = await zustand();
check(s.log[plan.n].db[plan.id][1].seite === 'r' && s.rest && s.rest.total === seitenSoll
  && /, links · /.test(await text('#restNext')),
  `erst rechts: Seitenpause, danach links („${await text('#restNext')}")`);
await tippe(1, 'l');
s = await zustand();
check(s.log[plan.n].db[plan.id][1].done === true, 'dann links: Satz 2 steht');

/* ------------------------------------------------------------------ *
 * 7. Der letzte Satz: nach der zweiten Seite geht es weiter
 * ------------------------------------------------------------------ */
for (let i = 0; i < plan.sets; i++) {
  if (i === 1) continue;
  await tippe(i, 'l');
  if (i === plan.sets - 1) {
    s = await zustand();
    check(!!s.rest && s.rest.total === seitenSoll, 'auch vor der zweiten Seite des letzten Satzes eine Seitenpause');
  }
  await tippe(i, 'r');
}
s = await zustand();
check(s.log[plan.n].db[plan.id].every((x) => x.done && !x.seite), `alle ${plan.sets} Sätze stehen`);
check(!s.rest || s.rest.ex !== plan.id, 'nach der letzten Seite keine Pause dieser Übung mehr');
check(await text('.focus-name') !== plan.name, `und die Ansicht ist bei der nächsten offenen Übung (${await text('.focus-name')})`);

/* ------------------------------------------------------------------ *
 * 8. „Alle Sätze abhaken" lässt keinen halben Satz zurück
 * ------------------------------------------------------------------ */
const alle = await page.evaluate(async ([n, id, sets]) => {
  const store = await import('./js/store.js');
  const { workoutByNo, resolve } = await import('./js/plan.js');
  store.updateSet(n, 'db', id, sets, 0, { done: false, w: '' });
  store.updateSet(n, 'db', id, sets, 0, { seite: 'l' });
  const halb = JSON.stringify(store.getSets(n, 'db', id, sets)[0]);
  store.completeWorkout(n, 'db', workoutByNo(n, 'db').ex.map((x) => ({ ...x, sets: resolve(x, 'db').sets })));
  return { halb, danach: JSON.stringify(store.getSets(n, 'db', id, sets)) };
}, [plan.n, plan.id, plan.sets]);
check(/"seite":"l"/.test(alle.halb) && !/seite/.test(alle.danach) && !/"done":false/.test(alle.danach),
  `alles abgehakt: kein halber Satz bleibt stehen (${alle.danach})`);

/* ------------------------------------------------------------------ *
 * 9. Die Dauer kennt die zweite Seite
 * ------------------------------------------------------------------ */
// Sechs Übungen à drei Sätze, 90 s Pause. Beidseitig je Übung 3 × 45 + 2 × 90
// + 45 = 360 s, zusammen 36 min → 40. Einseitig kommen je Übung drei zweite
// Seiten und drei Seitenpausen dazu, 3 × (45 + 45) = 270 s: 63 min → 65.
const dauer = await page.evaluate(async () => {
  const { duration } = await import('./js/ics.js');
  const sechs = (reps) => Array.from({ length: 6 }, () => ({ sets: 3, rest: 90, reps }));
  return [duration(sechs('10–20')), duration(sechs('10–20 je Bein'))];
});
check(dauer[0] === 40 && dauer[1] === 65,
  `Kalender: dieselben Sätze, 40 min beidseitig, 65 min einseitig (${dauer.join(' / ')})`);

/* ------------------------------------------------------------------ *
 * 10. Im Supersatz: Die Seitenpause bleibt beim Satz, der Partner kommt
 *     nach beiden Seiten
 * ------------------------------------------------------------------ */
// Ein frischer Kontext: Der laufende Stand von oben liegt nicht nur unter
// localStorage – die App hält ihn auch dauerhaft vor und holt ihn zurück.
await page.context().close();
page = await seite();
await page.goto(URL, { waitUntil: 'networkidle' });
await neu({ supersatz: true });
const paar = await page.evaluate(async () => {
  const { PLAN } = await import('./js/data.js');
  const { paare } = await import('./js/supersatz.js');
  const { workoutByNo, resolve } = await import('./js/plan.js');
  const { einseitig, seitenPause } = await import('./js/uebung.js');
  const n = PLAN[0].n;
  const items = workoutByNo(n, 'db').ex.map((x) => resolve(x, 'db'));
  const g = paare(items, 'db').find((x) => x.length === 2 && x.some(einseitig) && x.some((y) => !einseitig(y)));
  if (!g) return null;
  const ein = g.find(einseitig);
  const beid = g.find((y) => !einseitig(y));
  return {
    n, ein: { id: ein.id, name: ein.name, i: items.findIndex((x) => x.id === ein.id), pause: seitenPause(ein.rest) },
    beid: { id: beid.id, name: beid.name, i: items.findIndex((x) => x.id === beid.id) },
  };
});
check(!!paar, `Workout 1 hat im Supersatz ein Paar aus ein- und beidseitig${paar ? ` (${paar.beid.name} ↔ ${paar.ein.name})` : ''}`);
if (paar) {
  await page.locator('[data-act="start-session"]').first().click();
  await page.waitForTimeout(300);
  await page.locator(`.prog-ex[data-i="${paar.beid.i}"]`).click();
  await page.waitForTimeout(250);
  await page.locator('.focus-sets [data-act="toggle-set"][data-i="0"]').click();
  await page.waitForTimeout(300);
  check(await text('.focus-name') === paar.ein.name, `nach ${paar.beid.name} geht es zu ${paar.ein.name}`);
  await tippe(0, 'l');
  s = await zustand();
  check(await text('.focus-name') === paar.ein.name && !!s.rest && s.rest.total === paar.ein.pause && s.rest.ex === paar.ein.id,
    `die erste Seite: Seitenpause ${s.rest && s.rest.total} s, und die Ansicht bleibt bei ${paar.ein.name}`);
  await tippe(0, 'r');
  check(await text('.focus-name') === paar.beid.name, `erst nach beiden Seiten weiter zu ${paar.beid.name} (${await text('.focus-name')})`);
  s = await zustand();
  check(s.log[paar.n].db[paar.ein.id][0].done === true, `und der Satz ${paar.ein.name} steht`);
}

check(errs.length === 0, `keine Fehler${errs.length ? ': ' + errs.join(' | ') : ''}`);
console.log(`\n${fails ? fails + ' FEHLER' : 'alle Prüfungen bestanden'}`);
await browser.close();
