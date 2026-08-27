import { chromium } from 'playwright';
import { URL, SHOT } from './umgebung.mjs';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 414, height: 896 } });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()); });
page.on('response', (r) => { if (r.status() >= 400) errs.push(r.status() + ' ' + r.url()); });

let fails = 0;
const check = (c, m) => { console.log(`${c ? 'OK  ' : 'FAIL'} ${m}`); if (!c) { fails++; process.exitCode = 1; } };

await page.goto(URL, { waitUntil: 'networkidle' });
await page.evaluate(() => { localStorage.clear(); localStorage.setItem('workout.state.v1', '{"greeted":true}'); });
await page.reload({ waitUntil: 'networkidle' });

// --- Startansicht ist schlank ---
check(await page.locator('.ex').count() === 0, 'keine Übungskarten beim Öffnen');
check(await page.locator('.bodymap').count() === 1, 'Körperkarte da');
// Zwei Startknöpfe: die Variante wird beim Starten gewählt.
check(await page.locator('[data-act="start-session"]').count() === 2,
  'zwei Startknöpfe: Hanteln und Bodyweight');
check(await page.locator('.tab').count() === 3, '3 Tabs: Dashboard, Statistik, Mehr');
check(await page.locator('.tab[data-tab="exercises"]').count() === 0, 'Übungen-Tab entfernt');
const startBox = await page.locator('.btn-start').first().boundingBox();
check(startBox.height >= 54, `Startknopf ist groß (${Math.round(startBox.height)} px)`);

// --- Körperkarte: heutige Gruppen hervorgehoben ---
// Der ausgeglichene Plan trifft an manchen Tagen alle zwölf Gruppen; geprüft
// wird deshalb, dass überhaupt hervorgehoben wird und die zwei Stufen greifen.
const on = await page.locator('.bm-part.on').count();
const voll = await page.locator('.bm-part.on:not(.sub)').count();
check(on > 0 && voll > 0 && voll <= on, `Teile hervorgehoben (${on} an, davon ${voll} voll)`);
const legend = await page.locator('.bm-legend span').allTextContents();
console.log('     Workout 1:', legend.join(', '));
check(legend.length >= 4, 'Muskelgruppen benannt');
// Welche Gruppen das sind, sagt der Plan – seit die beiden Einheiten am
// kurzen Übergang je eine Körperhälfte bekommen, steht in Workout 1 nicht
// mehr zwangsläufig dasselbe wie früher.
const erwartetHeute = await page.evaluate(async () => {
  const { PLAN, EXERCISES } = await import('./js/data.js');
  const { MUSCLE_LABEL } = await import('./js/body.js');
  const byId = new Map(EXERCISES.map((e) => [e.id, e]));
  return [...new Set(PLAN[0].ex.flatMap((it) => byId.get(it.id).db.muscles))]
    .map((m) => MUSCLE_LABEL[m] || m);
});
for (const m of erwartetHeute) {
  check(legend.includes(m), `  ${m} als beansprucht ausgewiesen`);
}
const bodyBox = await page.locator('.bodymap').boundingBox();
check(bodyBox.width > 340, `Körper nutzt die Breite (${Math.round(bodyBox.width)} px)`);
await page.screenshot({ path: `${SHOT}/80-overview.png`, fullPage: true });

// --- Anderes Workout, andere Gruppen ---
await page.locator('[data-act="nav-workout"][data-delta="1"]').click();
await page.waitForTimeout(200);
const legend2 = await page.locator('.bm-legend span').allTextContents();
console.log('     Workout 2:', legend2.join(', '));
check(legend2.join() !== legend.join(), 'andere Einheit -> andere Hervorhebung');
check(legend2.includes('Bizeps'), '  Workout 2 hat SZ-Curls -> Bizeps');
await page.locator('[data-act="nav-workout"][data-delta="-1"]').click();

// --- Liste ist eine Ebene tiefer erreichbar ---
// Die Kurzliste ist entfallen - eine Bildschirmseite, kein Scrollen
check(await page.locator('.ov-row').count() === 0, 'keine Übungsliste in der Startansicht');
const fits = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
check(fits < 40, `Startansicht passt auf einen Bildschirm (${fits}px Überhang)`);
const bmBox = await page.locator('.bodymap').boundingBox();
check(bmBox.height > 220, `Körperkarte füllt die Höhe (${Math.round(bmBox.height)} px)`);
await page.locator('[data-act="show-list"]').click();
await page.waitForTimeout(150);
const cnt0 = await page.locator('.ex').count();
const LEN = await page.evaluate(async () => (await import('./js/data.js')).PLAN[0].ex.length);
check(cnt0 === LEN, `Liste zeigt die Übungskarten (${cnt0})`);
await page.locator('[data-act="hide-list"]').click();
await page.waitForTimeout(150);
check(await page.locator('.bodymap').count() === 1, 'Zurück führt zur Startansicht');

// --- Bodyweight-Modus ---
await page.locator('.mode-btn[data-mode="bw"]').click();
await page.waitForTimeout(200);
check(await page.locator('.bodymap').count() === 1, 'Körperkarte auch im Bodyweight-Modus');
await page.locator('.mode-btn[data-mode="db"]').click();

// --- Training starten und beenden ---
await page.locator('[data-act="start-session"]').first().click();
await page.waitForTimeout(250);
check(await page.locator('.focus-fig').count() === 1, 'Start führt in die Fokus-Ansicht');
await page.locator('[data-act="focus-list"]').click();
const cnt1 = await page.locator('.ex').count();
check(cnt1 === LEN, `Übersicht aus dem Training zeigt die Karten (${cnt1})`);
await page.locator('[data-act="focus-back"]').click();
await page.waitForTimeout(150);
check(await page.locator('.focus-fig').count() === 1, 'Zurück führt in die Fokus-Ansicht');
await page.locator('[data-act="finish-session"]').click();
await page.waitForTimeout(200);
check(await page.locator('.bodymap').count() === 1, 'Beenden führt zur Startansicht');

// --- Fortsetzen nach begonnenem Training ---
await page.locator('[data-act="show-list"]').click();
await page.locator('.ex').first().locator('.set-btn').first().click();
await page.waitForTimeout(200);
await page.locator('[data-act="hide-list"]').click();
await page.waitForTimeout(150);
check((await page.locator('.btn-start').textContent()).includes('fortsetzen'), 'Startknopf wird zu "fortsetzen"');
check(await page.locator('.progress').count() === 1, 'Fortschrittsbalken erscheint');

const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
check(overflow === 0, `kein horizontaler Überlauf (${overflow}px)`);

console.log(`\n${fails ? fails + ' FEHLER' : 'alle Prüfungen bestanden'}`);
console.log('ERRORS:', errs.length ? errs : 'none');
await browser.close();
