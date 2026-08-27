import { chromium } from 'playwright';
import { URL, SHOT } from './umgebung.mjs';


const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 414, height: 896 } });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()); });

/** Neu laden und wieder in die Uebungsliste wechseln (ui.listView ist nicht persistent). */
async function reloadToList(waitUntil = 'networkidle') {
  await page.reload({ waitUntil });
  const open = page.locator('[data-act="show-list"]');
  if (await open.count()) { await open.click(); await page.waitForTimeout(120); }
}

let fails = 0;
const check = (cond, msg) => {
  console.log(`${cond ? 'OK  ' : 'FAIL'} ${msg}`);
  if (!cond) { fails++; process.exitCode = 1; }
};
const state = () => page.evaluate(() => JSON.parse(localStorage.getItem('workout.state.v1') || '{}'));
const ex = (i) => page.locator('.ex').nth(i);

await page.goto(URL, { waitUntil: 'networkidle' });
await page.evaluate(() => { localStorage.clear(); localStorage.setItem('workout.state.v1', '{"greeted":true}'); });
await reloadToList();

// Welche Übung an erster Stelle steht, hängt vom generierten Plan ab.
const heute = await page.evaluate(() => import('./js/data.js').then(({ PLAN, EXERCISES }) => {
  const byId = new Map(EXERCISES.map((e) => [e.id, e]));
  const mitGewicht = PLAN[0].ex.map((i) => byId.get(i.id)).filter((e) => e.weight !== null);
  // Nicht jede Einheit hat eine Übung ohne Zusatzlast – die Einheit, die eine
  // hat, wird für diese eine Prüfung angesteuert.
  const ohneNr = PLAN.findIndex((w) => w.ex.some((i) => byId.get(i.id).weight === null));
  const ohne = ohneNr < 0 ? null
    : byId.get(PLAN[ohneNr].ex.find((i) => byId.get(i.id).weight === null).id);
  return { erst: { id: mitGewicht[0].id, name: mitGewicht[0].db.name, rest: mitGewicht[0].db.rest,
                   kg: mitGewicht[0].weight, step: mitGewicht[0].step, note: mitGewicht[0].weightNote },
           rest: mitGewicht[0].db.rest, ohne: ohne ? ohne.db.name : null, ohneNr };
}));
console.log('     Testübung:', heute.erst.name, `${heute.erst.kg} kg`, '· ohne Last:', heute.ohne);
// Wie fmtNum() in der App: zwei Nachkommastellen, seit es 1,25-kg-Schritte gibt.
const fmt = (v) => (Number.isInteger(v) ? String(v) : String(+v.toFixed(2)).replace('.', ','));
const idx = (await page.locator('.ex-name').allTextContents()).findIndex((t) => t.includes(heute.erst.name));


// --- Startgewichte vorbelegt ---
const kgs = await page.locator('.kg-val').evaluateAll((els) => els.map((e) => e.value));
console.log('     Gewichte Workout 1:', kgs.join(' | '));
check(kgs.length > 0 && kgs.every((v) => v !== ''), 'Startgewichte sind vorbelegt');
check(await ex(idx).locator('.kg-val').inputValue() === fmt(heute.erst.kg), `${heute.erst.name} startet bei ${fmt(heute.erst.kg)} kg`);
check((await ex(idx).locator('.kg-unit').textContent()).includes(heute.erst.note), 'Hinweis, wie das Gewicht gemeint ist');

// Übungen ohne Zusatzlast zeigen keine Gewichtszeile. Dafür zur ersten
// Einheit blättern, die überhaupt eine solche Übung enthält.
const names = await page.locator('.ex-name').allTextContents();   // Workout 1
await page.locator('[data-act="hide-list"]').click();
await page.waitForTimeout(120);
for (let i = 0; i < heute.ohneNr; i++) {
  await page.locator('[data-act="nav-workout"][data-delta="1"]').click();
  await page.waitForTimeout(60);
}
await page.locator('[data-act="show-list"]').click();
await page.waitForTimeout(120);
const dortige = await page.locator('.ex-name').allTextContents();
const ohne = dortige.findIndex((t) => t.includes(heute.ohne));
check(ohne >= 0, `${heute.ohne} in Workout ${heute.ohneNr + 1} gefunden`);
check(await ex(ohne).locator('.kg-val').count() === 0, `${heute.ohne} ohne Gewichtszeile`);
for (let i = 0; i < heute.ohneNr; i++) {
  await page.locator('[data-act="hide-list"]').click();
  await page.waitForTimeout(60);
  await page.locator('[data-act="nav-workout"][data-delta="-1"]').click();
  await page.waitForTimeout(60);
  await page.locator('[data-act="show-list"]').click();
  await page.waitForTimeout(60);
}

// --- "+" erhöht um einen Schritt --- (je Übung verschieden, siehe stepOf)
const S = heute.erst.step;

await ex(idx).locator(`[data-act="weight-step"][data-d="${S}"]`).click();
await page.waitForTimeout(250);
check(await ex(idx).locator('.kg-val').inputValue() === fmt(heute.erst.kg + S), `"+" macht ${fmt(heute.erst.kg)} -> ${fmt(heute.erst.kg + S)} kg (Schritt ${S})`);
check((await state()).weights[heute.erst.id] === heute.erst.kg + S, 'Gewicht gespeichert');
await ex(idx).locator(`[data-act="weight-step"][data-d="${-S}"]`).click();
await page.waitForTimeout(250);
check(await ex(idx).locator('.kg-val').inputValue() === fmt(heute.erst.kg), '"−" macht es rückgängig');

// --- Gewicht von Hand setzen ---
await ex(idx).locator('.kg-val').fill('27,5');
await page.waitForTimeout(250);
check((await state()).weights[heute.erst.id] === 27.5, 'Gewicht per Tastatur änderbar');
await ex(idx).locator('.kg-val').fill(fmt(heute.erst.kg));
await page.waitForTimeout(250);

// --- Workout starten ---
check(await page.locator('[data-act="start-session"]').count() === 1, '"Workout starten" vorhanden');
await page.locator('[data-act="start-session"]').click();
await page.waitForTimeout(250);
check((await state()).session?.n === 1, 'Session läuft');
check(await page.locator('#sessionBadge').count() === 1, 'Laufzeit wird angezeigt');
check(await page.locator('.focus-fig').count() === 1, 'Start fuehrt in die Fokus-Ansicht');
await page.locator('[data-act="focus-list"]').click();
check(await page.locator('[data-act="finish-session"]').count() === 1, 'Abschluss-Knöpfe ersetzen den Start');
await page.screenshot({ path: `${SHOT}/50-session.png` });

// --- Abhaken schreibt das Gewicht mit ---
await ex(idx).locator('.set-btn').first().click();
await page.waitForTimeout(250);
check((await state()).log['1'].db[heute.erst.id][0].w === fmt(heute.erst.kg), `benutztes Gewicht im Protokoll (${fmt(heute.erst.kg)})`);

// --- "+" nach dem ersten Satz gilt ab dem nächsten Satz ---
// Der abgehakte Satz behält sein Gewicht; die Zahl in der Zeile ist die für den
// nächsten. Vorher stand dort das zuerst benutzte Gewicht und jede Änderung galt
// erst nächstes Mal – beim Senken mitten im Satz war das falsch.
await ex(idx).locator(`[data-act="weight-step"][data-d="${S}"]`).click();
await page.waitForTimeout(250);
check(await ex(idx).locator('.kg-val').inputValue() === fmt(heute.erst.kg + S),
  `die Zeile zeigt das neue Gewicht (${fmt(heute.erst.kg + S)})`);
check((await state()).log['1'].db[heute.erst.id][0].w === fmt(heute.erst.kg),
  `der abgehakte Satz bleibt bei ${fmt(heute.erst.kg)}`);
check(await ex(idx).locator('.kg-next').count() === 1, 'Hinweis, womit die bisherigen Sätze liefen');
console.log('     ', await ex(idx).locator('.kg-next').textContent());
check((await state()).weights[heute.erst.id] === heute.erst.kg + S, `gespeichert ist ${fmt(heute.erst.kg + S)}`);
await page.screenshot({ path: `${SHOT}/51-next-time.png` });

// --- Pause richtet sich nach der Übung ---
check(await page.locator('#restBar').isVisible(), 'Pause läuft nach dem Satz');
const t0 = await page.locator('#restTime').textContent();
const soll = `${Math.floor(heute.erst.rest / 60)}:${String(heute.erst.rest % 60).padStart(2, '0')}`;
console.log(`     ${heute.erst.name}: ${t0}, empfohlen ${soll}`);
const sek = Number(t0.split(':')[0]) * 60 + Number(t0.split(':')[1]);
check(Math.abs(sek - heute.erst.rest) <= 2, `Pause richtet sich nach der Übung (${t0} statt ${soll})`);
await page.locator('#restSkip').click();

// Kleine Übung: die mit der kürzesten empfohlenen Pause im heutigen Plan
const klein = await page.evaluate(() => import('./js/data.js').then(({ PLAN, EXERCISES }) => {
  const byId = new Map(EXERCISES.map((e) => [e.id, e]));
  const e = PLAN[0].ex.map((i) => byId.get(i.id)).sort((a, b) => a.db.rest - b.db.rest)[0];
  return { name: e.db.name, rest: e.db.rest };
}));
const kleinIdx = names.findIndex((t) => t.includes(klein.name));
await ex(kleinIdx).locator('.set-btn').first().click();
const t1 = await page.locator('#restTime').textContent();
const sek1 = Number(t1.split(':')[0]) * 60 + Number(t1.split(':')[1]);
console.log(`     ${klein.name} (kürzeste Pause): ${t1}`);
check(Math.abs(sek1 - klein.rest) <= 2, `kleine Übung bekommt ${klein.rest} s (${t1})`);
await page.locator('#restSkip').click();

// --- Aufgeklappt stehen die Eckdaten ---
await ex(idx).locator('.ex-head').click();
const facts = await ex(idx).locator('.ex-facts').textContent();
console.log('     Eckdaten:', facts.replace(/\s+/g, ' ').trim());
check(facts.includes(soll), `empfohlene Pause wird ausgewiesen (${soll})`);
check(await page.locator('input[data-field="w"]').count() === 0, 'keine Gewichtsfelder je Satz mehr');
await ex(0).locator('.ex-head').click();

// --- Training beenden ---
await page.locator('[data-act="finish-session"]').click();
await page.waitForTimeout(250);
check((await state()).session === null, 'Session beendet');
check(await page.locator('[data-act="start-session"]').count() === 1, 'Startknopf ist wieder da');

// --- Feste Pause als Alternative ---
await page.locator('.tab[data-tab="settings"]').click();
await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
await page.locator('[data-act="toggle-ex-rest"]').click();
await page.waitForTimeout(250);
check((await state()).useExerciseRest === false, 'Pause je Übung abschaltbar');
check(await page.locator('[data-act="set-rest"]').count() === 4, 'feste Längen erscheinen dann');
await page.screenshot({ path: `${SHOT}/52-settings-rest.png`, fullPage: true });
await page.locator('[data-act="toggle-ex-rest"]').click();

const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
check(overflow === 0, `kein horizontaler Überlauf (${overflow}px)`);

console.log(`\n${fails ? fails + ' FEHLER' : 'alle Prüfungen bestanden'}`);
console.log('ERRORS:', errs.length ? errs : 'none');
await browser.close();
