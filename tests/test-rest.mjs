import { chromium } from 'playwright';
import { URL, SHOT } from './umgebung.mjs';


const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
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

// Erzeugte Töne mitschneiden, statt sie nur zu hoffen. Seit das Pausensignal
// im Voraus auf die Uhr des AudioContext gelegt wird, zählt nicht nur DASS ein
// Oszillator entsteht, sondern WANN er spielen soll – genau daran hängt, dass
// der Ton auch im Hintergrund kommt.
await ctx.addInitScript(() => {
  window.__osc = [];   // { f: Frequenz, at: geplante Spielzeit, now: Zeit beim Auflegen }
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return;
  const orig = Ctx.prototype.createOscillator;
  Ctx.prototype.createOscillator = function (...a) {
    const audio = this;
    const osc = orig.apply(this, a);
    const start = osc.start.bind(osc);
    osc.start = (when = 0) => {
      window.__osc.push({ f: osc.frequency.value, at: when || audio.currentTime, now: audio.currentTime });
      return start(when);
    };
    return osc;
  };
  navigator.vibrate = (p) => { window.__vibrate = p; return true; };
});

/** Alle Töne, die seit `ab` aufgelegt wurden – ohne den unhörbaren Trägerton. */
const toene = (ab = 0) => page.evaluate((ab) => window.__osc.slice(ab).filter((o) => o.f !== 30), ab);
const tonZahl = () => page.evaluate(() => window.__osc.length);

await page.goto(URL, { waitUntil: 'networkidle' });
await page.evaluate(() => { localStorage.clear(); localStorage.setItem('workout.state.v1', '{"greeted":true}'); });
await reloadToList();


// --- Abhaken ohne Aufklappen ---
// Wie viele Sätze die erste Übung hat, bestimmt der generierte Plan.
const SETS = await page.evaluate(async () => (await import('./js/data.js')).PLAN[0].ex[0].sets);
const firstEx = page.locator('.ex').first();
check(await firstEx.locator('.ex-sets .set-btn').count() === SETS,
  `Satz-Knöpfe ohne Aufklappen sichtbar (${SETS})`);
check(!(await firstEx.evaluate((el) => el.classList.contains('open'))), 'Übung ist zugeklappt');
const box = await firstEx.locator('.set-btn').first().boundingBox();
check(box.height >= 44, `Knopf ist daumengroß (${Math.round(box.height)} px hoch)`);

// --- Keine Wiederholungs-Eingabe mehr ---
await firstEx.locator('.ex-head').click();
check(await page.locator('input[data-field="r"]').count() === 0, 'kein Wiederholungs-Feld mehr');
// Genau ein Arbeitsgewicht – aber nur, wo die Übung eines kennt. Steht vorn
// eine ohne Zusatzlast (Chin-ups), gehört dort auch keine Zeile hin.
const hatGewicht = await page.evaluate(async () => {
  const { PLAN, EXERCISES } = await import('./js/data.js');
  const byId = new Map(EXERCISES.map((e) => [e.id, e]));
  return byId.get(PLAN[0].ex[0].id).weight !== null;
});
check(await firstEx.locator('.kg-val').count() === (hatGewicht ? 1 : 0),
  `ein Arbeitsgewicht je Übung, wo es eines gibt (hier ${hatGewicht ? 'ja' : 'nein'})`);
await firstEx.locator('.ex-head').click();

// --- Pause kurz stellen, damit der Test nicht 90 s wartet ---
await page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('workout.state.v1') || '{}');
  s.restSeconds = 2; s.useExerciseRest = false;
  localStorage.setItem('workout.state.v1', JSON.stringify(s));
});
await reloadToList();

// --- Satz 1 abhaken -> Pause startet ---
await page.locator('.ex').first().locator('.set-btn').first().click();
check(await page.locator('.ex').first().locator('.set-btn').first().getAttribute('aria-pressed') === 'true', 'Satz 1 abgehakt');
check(await page.locator('#restBar').isVisible(), 'Pausenleiste erscheint');
console.log('     Leiste:', (await page.locator('#restBar').textContent()).replace(/\s+/g, ' ').trim());
check((await page.locator('#restNext').textContent()).includes(`Satz 2 von ${SETS}`), 'kündigt den nächsten Satz an');
check(await page.evaluate(() => document.body.classList.contains('resting')), 'Seiteninhalt weicht der Leiste aus');
await page.screenshot({ path: `${SHOT}/40-rest-running.png` });

// --- Signal liegt im Voraus auf der Audio-Uhr ---
// Das ist der Kern: ein setTimeout würde im Hintergrund ausgebremst, ein fest
// eingeplanter Oszillator spielt trotzdem zur richtigen Sekunde.
const geplant = (await toene()).filter((o) => o.at - o.now > 1);
check(geplant.length >= 2, `Pausensignal im Voraus eingeplant (${geplant.length} Töne)`);
check(geplant.some((o) => Math.abs(o.at - o.now - 2) < 0.5),
  `und zwar auf das Ende der Pause (+${geplant.length ? (geplant[0].at - geplant[0].now).toFixed(2) : '?'} s)`);
check(await page.evaluate(() => window.__osc.some((o) => o.f === 30)),
  'unhörbarer Trägerton hält den AudioContext wach');

// --- Ablauf abwarten -> kein zweiter Ton oben drauf ---
const vorAblauf = await tonZahl();
await page.waitForFunction(() => document.getElementById('restBar').hidden, { timeout: 8000 });
check((await toene(vorAblauf)).length === 0,
  'am Ende kommt kein zweiter Ton – der eingeplante hat gespielt');
check(await page.evaluate(() => Array.isArray(window.__vibrate)), 'Handy vibriert');
check(!(await page.evaluate(() => document.body.classList.contains('resting'))), 'Leiste wieder weg');

// --- Letzter Satz einer Übung -> KEINE Pause ---
// Alle Sätze bis auf den letzten abhaken; nach jedem läuft eine Pause.
for (let k = 1; k < SETS - 1; k++) {
  await page.locator('.ex').first().locator('.set-btn').nth(k).click();
  await page.waitForTimeout(200);
  check(await page.locator('#restBar').isVisible(), `nach Satz ${k + 1} läuft wieder eine Pause`);
  await page.locator('#restSkip').click();
  check(!(await page.locator('#restBar').isVisible()), '"Fertig" bricht die Pause ab');
}
const vorLetztem = await tonZahl();
await page.locator('.ex').first().locator('.set-btn').nth(SETS - 1).click();
await page.waitForTimeout(500);
check(!(await page.locator('#restBar').isVisible()), 'nach dem LETZTEN Satz einer Übung startet keine Pause');
const danach = await toene(vorLetztem);
check(!danach.some((o) => o.at - o.now > 1), 'und es wird kein Pausensignal eingeplant');
check(danach.length > 0, `dafür der Ton "Übung fertig" (${danach.map((o) => Math.round(o.f)).join(' + ')} Hz)`);
check(await page.locator('.ex').first().evaluate((el) => el.classList.contains('complete')), 'Übung als erledigt markiert');

// --- Haken entfernen beendet die Pause ---
await page.locator('.ex').nth(1).locator('.set-btn').first().click();
check(await page.locator('#restBar').isVisible(), 'Pause bei nächster Übung gestartet');
await page.locator('.ex').nth(1).locator('.set-btn').first().click();
check(!(await page.locator('#restBar').isVisible()), 'Haken entfernt -> Pause beendet');

// --- Pause übersteht ein Neuladen ---
await page.locator('.ex').nth(1).locator('.set-btn').first().click();
await page.waitForTimeout(250); // Debounce des Speicherns abwarten
await page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('workout.state.v1'));
  s.rest.endsAt = Date.now() + 60000; s.rest.total = 60;
  localStorage.setItem('workout.state.v1', JSON.stringify(s));
});
await reloadToList();
check(await page.locator('#restBar').isVisible(), 'laufende Pause übersteht einen Neustart der Seite');
await page.locator('#restPlus').click();
check((await page.locator('#restTime').textContent()).startsWith('1:2') || (await page.locator('#restTime').textContent()).startsWith('1:3'), `"+30 s" verlängert (${await page.locator('#restTime').textContent()})`);
await page.locator('#restSkip').click();

// --- Statistik ohne erfasste Wiederholungen ---
await page.locator('.tab[data-tab="stats"]').click();
const stats = await page.locator('.stat').allTextContents();
console.log('     ', stats.join(' | '));
check(stats.some((s) => s.includes('geplant')), 'Wiederholungen als geplant ausgewiesen');

const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
check(overflow === 0, `kein horizontaler Überlauf (${overflow}px)`);

console.log(`\n${fails ? fails + ' FEHLER' : 'alle Prüfungen bestanden'}`);
console.log('ERRORS:', errs.length ? errs : 'none');
await browser.close();
