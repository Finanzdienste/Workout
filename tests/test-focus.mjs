import { chromium } from 'playwright';
import { URL, SHOT } from './umgebung.mjs';


const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 414, height: 896 } });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()); });

// Alle Übungen der Einheit in der Fokus-Ansicht durchblättern
async function sweepFocus() {
  let fig = 0; const illu = 0;
  for (let i = 0; i < 12; i++) {
    fig += await page.locator('.focus-fig svg.fig').count();
    const next = page.locator('[data-act="focus-step"][data-d="1"]:not([disabled])');
    if (!(await next.count())) break;
    await next.click();
    await page.waitForTimeout(120);
  }
  return { illu, fig };
}

let fails = 0;
const check = (cond, msg) => {
  console.log(`${cond ? 'OK  ' : 'FAIL'} ${msg}`);
  if (!cond) { fails++; process.exitCode = 1; }
};

await page.goto(URL, { waitUntil: 'networkidle' });
await page.evaluate(() => { localStorage.clear(); localStorage.setItem('workout.state.v1', '{"greeted":true}'); });

// Der Plan wird generiert – Namen und Länge der Einheit stehen nicht fest. Die
// Reihenfolge auch nicht: Die App sortiert die Einheit nach Rüstaufwand, also
// wird sie hier aus der Übersicht gelesen statt aus dem Plan.
await page.reload({ waitUntil: 'networkidle' });
await page.locator('[data-act="show-list"]').click();
await page.waitForTimeout(200);
const namen = await page.locator('.ex-name').allTextContents();
const heute = await page.evaluate((namen) => import('./js/data.js').then(({ EXERCISES }) => {
  const byName = new Map(EXERCISES.map((e) => [e.db.name, e]));
  return namen.map((n) => {
    const e = byName.get(n.trim());
    return { name: n.trim(), sets: 3, hasWeight: e.weight !== null };
  });
}), namen);
const LEN = heute.length;
// Pause aus, damit die Leiste die Knöpfe nicht überlagert
await page.evaluate(() => {
  const k = 'workout.state.v1';
  const s = JSON.parse(localStorage.getItem(k) || '{}');
  s.useExerciseRest = false; s.restSeconds = 0;
  localStorage.setItem(k, JSON.stringify(s));
});
await page.reload({ waitUntil: 'networkidle' });

// --- Start springt direkt in die erste Übung ---
await page.locator('[data-act="start-session"]').first().click();
await page.waitForTimeout(200);
check(await page.locator('.focus-fig').count() === 1, 'Fokus-Ansicht erscheint beim Starten');
check((await page.locator('.focus-name').textContent()) === heute[0].name, `erste Übung wird gezeigt (${heute[0].name})`);
check((await page.locator('.focus-count').textContent()).includes(`Übung 1 von ${LEN}`), 'Fortschritt wird ausgewiesen');
check(await page.locator('.focus-set').count() === heute[0].sets, `${heute[0].sets} große Satz-Knöpfe`);
const box = await page.locator('.focus-set').first().boundingBox();
check(box.height >= 60, `Knöpfe sind groß (${Math.round(box.height)} px)`);

// --- Die Bewegung wird tatsächlich animiert ---
const figBox = await page.locator('.focus-fig').boundingBox();
check(figBox.height >= 200, `Animation ist groß (${Math.round(figBox.height)} px hoch)`);
check(await page.locator('.focus-fig svg .fig-head').count() === 1, 'Figur gezeichnet');
// Die ganze Zeichnung vergleichen, nicht ein einzelnes Teil: bei manchen
// Übungen steht der Rumpf still und nur ein Arm arbeitet.
const snap = () => page.locator('.focus-fig svg').innerHTML();
// Über eine ganze Wiederholung abtasten: das Tempo hält an beiden Enden kurz
// an, zwei dicht beieinander liegende Bilder können gleich sein.
const frames = new Set();
for (let i = 0; i < 12; i++) { frames.add(await snap()); await page.waitForTimeout(400); }
check(frames.size > 3, `Figur bewegt sich (${frames.size} verschiedene Bilder)`);
await page.screenshot({ path: `${SHOT}/60-focus.png` });

// --- Alle Sätze abhaken -> sofort zur nächsten Übung ---
// Dazwischen stand einmal die Frage "Wie war das?"; sie ist raus, und mit ihr
// das Warten auf eine Antwort.
for (let i = 0; i < heute[0].sets; i++) {
  await page.locator('.focus-set').nth(i).click();
  await page.waitForTimeout(120);
}
await page.waitForTimeout(150);
check(await page.locator('.effort').count() === 0, 'keine Frage nach der Anstrengung mehr');
check((await page.locator('.focus-name').textContent()) === heute[1].name,
  `letzter Satz blättert sofort weiter (${heute[1].name})`);
check((await page.locator('.focus-count').textContent()).includes(`Übung 2 von ${LEN}`), 'Zähler zieht mit');
check(await page.locator('.focus-fig .fig-head').count() === 1, 'neue Bewegung gezeichnet');

// Gewichtszeile nur bei Übungen mit Zusatzlast
check(await page.locator('.focus-weight').count() === (heute[1].hasWeight ? 1 : 0),
  `${heute[1].name}: Gewichtszeile ${heute[1].hasWeight ? 'vorhanden' : 'fehlt zu Recht'}`);

// --- Von Hand blättern ---
await page.locator('[data-act="focus-step"][data-d="1"]').click();
check((await page.locator('.focus-name').textContent()) === heute[2].name, 'Weiter-Knopf blättert');
check(await page.locator('.focus-weight').count() === (heute[2].hasWeight ? 1 : 0), 'Gewichtszeile passt zur Übung');
await page.locator('[data-act="focus-step"][data-d="-1"]').click();
check((await page.locator('.focus-name').textContent()) === heute[1].name, 'Zurück-Knopf blättert');

// --- Übersicht und zurück ---
await page.locator('[data-act="focus-list"]').click();
check(await page.locator('.ex').count() === LEN, 'Übersicht zeigt wieder alle Übungen');
check(await page.locator('[data-act="finish-session"]').count() === 1, 'Session läuft weiter');
await page.locator('[data-act="finish-session"]').click();
await page.waitForTimeout(200);
check(await page.locator('[data-act="start-session"]').count() >= 1, 'Beenden führt zurück zum Start');

// --- Jede Übung der Einheit hat ein Bewegungsbild ---
// Zuruecksetzen: der Durchlauf soll bei Uebung 1 beginnen, nicht bei der
// ersten noch offenen.
await page.evaluate(() => { localStorage.clear(); localStorage.setItem('workout.state.v1', '{"greeted":true}'); });
await page.reload({ waitUntil: 'networkidle' });
await page.locator('[data-act="start-session"]').first().click();
await page.waitForTimeout(200);
const sweep = await sweepFocus();
console.log('     Fokus-Durchlauf:', JSON.stringify(sweep));
check(sweep.illu + sweep.fig === LEN, `alle ${LEN} Übungen mit Bewegungsbild (${sweep.illu} Illu + ${sweep.fig} Figur)`);
await page.locator('[data-act="finish-session"]').click();
await page.waitForTimeout(150);

// Bodyweight-Modus nutzt eigene Muster
await page.locator('.mode-btn[data-mode="bw"]').click();
await page.locator('[data-act="start-session"]').first().click();
await page.waitForTimeout(200);
const sweepBw = await sweepFocus();
console.log('     Bodyweight:', JSON.stringify(sweepBw));
check(sweepBw.illu + sweepBw.fig === LEN, `Bodyweight ebenfalls vollständig (${sweepBw.illu} Illu + ${sweepBw.fig} Figur)`);
await page.locator('[data-act="finish-session"]').click();
await page.waitForTimeout(150);

const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
check(overflow === 0, `kein horizontaler Überlauf (${overflow}px)`);


// --- Vier Pläne zur Wahl, und der Beinplan rechnet auf Beinziele ---
await page.locator('.tab[data-tab="settings"]').click();
await page.waitForTimeout(250);
const knoepfe = page.locator('[data-act="set-focus"]');
check(await knoepfe.count() === 4, `vier Trainingsfokus zur Wahl (${await knoepfe.count()})`);
const fokusNamen = (await knoepfe.allTextContents()).join(' | ');
check(!/Kurz und knapp|Beine ernst gemeint/.test(fokusNamen),
  'die beiden abgeschafften stehen nicht mehr darunter');
check(/Aufbau/.test(fokusNamen), 'der ausgewogene Plan heißt jetzt "Aufbau"');
const bbp = page.locator('[data-act="set-focus"][data-v="bbp"]');
check(await bbp.count() === 1, 'darunter "Bauch, Beine, Po"');
check((await bbp.textContent()).includes('Gesäß'), 'mit einem Satz, was daran anders ist');
const zahlen = (await bbp.locator('.fokus-zahl').textContent()).replace(/\s+/g, ' ');
console.log('     ', zahlen.trim());
check(/\d+ Sätze/.test(zahlen), 'und den Zahlen der Variante');

page.once('dialog', (d) => d.accept());
await bbp.click();
await page.waitForTimeout(1200);
const stand = await page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('workout.state.v1') || '{}');
  return s.focus;
});
check(stand === 'bbp', `nach dem Wechsel steht der Fokus auf bbp (${stand})`);
const ziele = await page.evaluate(async () => (await import('./js/data.js')).TARGET);
check(ziele.quads === 12 && ziele.glutes === 15 && ziele.abs === 12,
  `und die Ziele stimmen (Oberschenkel ${ziele.quads}, Gesäß ${ziele.glutes}, Bauch ${ziele.abs})`);

console.log(`\n${fails ? fails + ' FEHLER' : 'alle Prüfungen bestanden'}`);
console.log('ERRORS:', errs.length ? errs : 'none');
await browser.close();
