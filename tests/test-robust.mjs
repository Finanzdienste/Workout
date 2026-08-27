/*
 * Die Stellen, an denen die App vorher stolperte.
 *
 * Alle fünf sind aus einer Durchsicht gefallen, nicht aus dem Betrieb – genau
 * deshalb stehen sie hier: ohne Prüfung kommen sie beim nächsten Umbau zurück.
 */
import { chromium } from 'playwright';
import { URL, SHOT } from './umgebung.mjs';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 414, height: 896 } });
const errs = [];
// Der Rückkanal geht von hier aus nicht ins Netz; das ist kein Fehler der App.
await page.route('**/rest/v1/**', (route) => route.fulfill({ status: 201, body: '' }));
page.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()); });
let fails = 0;
const check = (c, m) => { console.log(`${c ? 'OK  ' : 'FAIL'} ${m}`); if (!c) { fails++; process.exitCode = 1; } };

// Die Zähler für Fenster-Listener müssen vor allem anderen stehen.
await page.addInitScript(() => {
  window.__lis = 0;
  const add = window.addEventListener.bind(window);
  const rem = window.removeEventListener.bind(window);
  window.addEventListener = (t, f, o) => { if (t === 'pointermove' || t === 'pointerup') window.__lis++; return add(t, f, o); };
  window.removeEventListener = (t, f, o) => { if (t === 'pointermove' || t === 'pointerup') window.__lis--; return rem(t, f, o); };
});

await page.goto(URL, { waitUntil: 'networkidle' });
await page.evaluate(() => { localStorage.clear(); localStorage.setItem('workout.state.v1', '{"greeted":true}'); });
await page.reload({ waitUntil: 'networkidle' });

// --- 1. Leere Einheit: mit genug Beschwerden bleibt nichts übrig -------------
const leere = await page.evaluate(async () => {
  const { PLAN } = await import('./js/data.js');
  const inj = await import('./js/injuries.js');
  const alle = inj.INJURIES.map((i) => i.id);
  return {
    mitAllen: PLAN.filter((w) => inj.applyInjuries(w.ex, alle).items.length === 0).length,
    mitEiner: PLAN.filter((w) => inj.applyInjuries(w.ex, ['handgelenk-bruch']).items.length === 0).length,
  };
});
console.log('     Einheiten ohne Übung:', JSON.stringify(leere));
// Seit der Vorrat größer ist, leert keine einzelne Beschwerde mehr eine
// Einheit – erreichbar bleibt der Fall trotzdem, und genau darum geht es hier.
check(leere.mitAllen > 0, `leere Einheiten kommen vor (${leere.mitAllen} von 80 bei allen Beschwerden)`);

await page.evaluate(async () => {
  const inj = await import('./js/injuries.js');
  localStorage.setItem('workout.state.v1', JSON.stringify({
    injuries: inj.INJURIES.map((i) => i.id), autoShift: false, log: {},
  }));
});
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(300);
// Welche Einheit leer ist, hängt vom Plan ab – nicht mehr zwangsläufig die
// erste. Also hinblättern statt hoffen.
const leerIdx = await page.evaluate(async () => {
  const { PLAN } = await import('./js/data.js');
  const inj = await import('./js/injuries.js');
  const alle = inj.INJURIES.map((i) => i.id);
  return PLAN.findIndex((w) => inj.applyInjuries(w.ex, alle).items.length === 0);
});
check(leerIdx >= 0, `eine leere Einheit gefunden (Workout ${leerIdx + 1})`);
for (let i = 0; i < leerIdx; i++) {
  await page.locator('[data-act="nav-workout"][data-delta="1"]').click();
  await page.waitForTimeout(60);
}
check(await page.locator('[data-act="start-session"]').first().count() === 0, 'kein Startknopf für einen leeren Tag');
check((await page.locator('#view').textContent()).includes('Heute bleibt nichts übrig'), 'die Startansicht sagt, warum');
// Auch der Weg über die Liste und ein erzwungener Fokus darf nicht krachen
await page.locator('[data-act="show-list"]').click();
await page.waitForTimeout(200);
check(await page.locator('.ex').count() === 0, 'die Liste ist leer statt kaputt');
await page.evaluate(() => { window.dispatchEvent(new PopStateEvent('popstate', { state: { tab: 'dashboard', focus: true } })); });
await page.waitForTimeout(250);
await page.screenshot({ path: `${SHOT}/robust-leer.png`, fullPage: true });
check(errs.length === 0, `kein Fehler auf dem leeren Tag${errs.length ? ' – ' + errs.join(' | ') : ''}`);

// --- 2. Kein Listener-Leck in der Figur --------------------------------------
await page.evaluate(() => { localStorage.clear(); localStorage.setItem('workout.state.v1', '{"greeted":true}'); });
await page.reload({ waitUntil: 'networkidle' });
await page.locator('[data-act="start-session"]').first().click();
await page.waitForTimeout(400);
const nachStart = await page.evaluate(() => window.__lis);
for (let i = 0; i < 10; i++) {
  const btn = page.locator('.focus-sets .set-btn').first();
  if (await btn.count()) { await btn.click(); await page.waitForTimeout(120); }
}
const nachKlicks = await page.evaluate(() => window.__lis);
console.log(`     offene Fenster-Listener: nach Start ${nachStart}, nach 10 Klicks ${nachKlicks}`);
check(nachStart <= 2, `eine Figur meldet zwei Listener an (${nachStart})`);
check(nachKlicks <= nachStart, 'jeder Neuaufbau meldet sie wieder ab');

// --- 3. Fokus überlebt den Neuaufbau ----------------------------------------
await page.locator('[data-act="focus-list"]').click();
await page.waitForTimeout(200);
const knopf = page.locator('.ex').nth(1).locator('.set-btn').nth(1);
await knopf.focus();
const vorher = await page.evaluate(() => {
  const a = document.activeElement;
  return `${a.tagName}|${a.dataset.ex || ''}|${a.dataset.i || ''}`;
});
await page.keyboard.press('Enter');
await page.waitForTimeout(300);
const nachher = await page.evaluate(() => {
  const a = document.activeElement;
  return `${a.tagName}|${a.dataset.ex || ''}|${a.dataset.i || ''}`;
});
console.log('     Fokus:', vorher, '->', nachher);
check(vorher === nachher, 'nach dem Abhaken steht der Fokus noch auf demselben Satz');

// --- 4. Ansage für die Pause -------------------------------------------------
// Nach dem *letzten* Satz einer Übung läuft bewusst keine Pause – für die
// Ansage muss also ein Satz her, dem noch einer folgt.
const mehrsatzig = await page.evaluate(async () => {
  const { PLAN } = await import('./js/data.js');
  return PLAN[0].ex.findIndex((x) => x.sets > 1);
});
await page.locator('.ex').nth(mehrsatzig).locator('.set-btn').first().click();
await page.waitForTimeout(350);
const ansage = await page.locator('#restLive').textContent();
console.log('     Ansage:', JSON.stringify(ansage));
check(/Pause/.test(ansage), 'der Pausenbeginn wird angesagt');
check(await page.locator('#view').getAttribute('aria-labelledby') === 'tab-dashboard',
  'die Ansicht nennt den Tab, zu dem sie gehört');
await page.locator('.tab[data-tab="stats"]').click();
await page.waitForTimeout(200);
check(await page.locator('#view').getAttribute('aria-labelledby') === 'tab-stats', 'und wechselt mit');

// --- 5. Neustart, Import, doppelte Modi --------------------------------------
const zustand = await page.evaluate(async () => {
  const store = await import('./js/store.js');
  const { PLAN } = await import('./js/data.js');
  const w = PLAN[0];
  const id = w.ex[0].id;
  store.completeWorkout(w.n, 'db', w.ex.map((x) => ({ id: x.id, sets: x.sets })));
  store.setWeight(id, 30);
  store.addBwPlus(id, 2);
  store.restartPlan(0);
  const st = store.getState();
  return {
    gewicht: store.weightOf(id),
    bwPlus: store.bwPlusOf(id),
    rundeHatLog: !!(st.rounds[0] && st.rounds[0].log),
  };
});
console.log('     nach Neustart:', JSON.stringify(zustand));
check(zustand.rundeHatLog, 'der bisherige Verlauf steht im abgelegten Durchlauf');
check(zustand.gewicht === 30 && zustand.bwPlus === 2, 'Gewichte und Wiederholungs-Aufschlag bleiben');

const importe = await page.evaluate(async () => {
  const store = await import('./js/store.js');
  const out = { abgewiesen: [] };
  for (const [name, text] of [['ohne log', '{}'], ['log als Liste', '{"log":[]}'],
                              ['gar kein Objekt', '[]']]) {
    try { store.importJSON(text); } catch { out.abgewiesen.push(name); }
  }
  store.importJSON('{"log":{},"injuries":"kaputt","shift":"viel","fremdfeld":1,"mode":"bw"}');
  const st = store.getState();
  out.injuriesIstListe = Array.isArray(st.injuries);
  out.shift = st.shift;
  out.fremdfeldWeg = !('fremdfeld' in st);
  out.modusUebernommen = st.mode === 'bw';
  return out;
});
console.log('     Import:', JSON.stringify(importe));
check(importe.abgewiesen.length === 3, `unpassende Dateien werden abgewiesen (${importe.abgewiesen.join(', ')})`);
check(importe.injuriesIstListe && importe.shift === 0 && importe.fremdfeldWeg,
  'falsche Typen und Fremdfelder überleben den Import nicht');
check(importe.modusUebernommen, 'Bekanntes wird trotzdem übernommen');

// Wochenvolumen zählt eine Einheit nur einmal, auch wenn beide Modi Sätze haben
const volumen = await page.evaluate(async () => {
  const store = await import('./js/store.js');
  const { PLAN, EXERCISES } = await import('./js/data.js');
  localStorage.clear();
  const byId = new Map(EXERCISES.map((e) => [e.id, e]));
  const w = PLAN[0];
  const soll = (mode) => w.ex.reduce((a, it) => a + it.sets * (byId.get(it.id)[mode].shares.lats || 0), 0);
  store.completeWorkout(w.n, 'db', w.ex.map((x) => ({ id: x.id, sets: x.sets })));
  store.completeWorkout(w.n, 'bw', w.ex.map((x) => ({ id: x.id, sets: x.sets })));
  return { db: soll('db'), bw: soll('bw') };
});
await page.reload({ waitUntil: 'networkidle' });
await page.locator('.tab[data-tab="stats"]').click();
await page.waitForTimeout(400);
const ruecken = await page.$$eval('.vol-row', (rows) => {
  const r = rows.find((x) => x.querySelector('.vol-name').textContent.trim() === 'Rücken');
  return r ? parseFloat(r.querySelector('.vol-num').firstChild.textContent.replace(',', '.')) : null;
});
console.log(`     Rücken: angezeigt ${ruecken}, eine Variante wäre ${volumen.db} bzw. ${volumen.bw}`);
check(ruecken !== null && ruecken <= Math.max(volumen.db, volumen.bw) + 0.05,
  'beide Modi zum selben Workout werden nicht doppelt gezählt');

const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
check(overflow === 0, `kein horizontaler Überlauf (${overflow}px)`);

console.log(`\n${fails ? fails + ' FEHLER' : 'alle Prüfungen bestanden'}`);
console.log('ERRORS:', errs.length ? errs : 'none');
await browser.close();
