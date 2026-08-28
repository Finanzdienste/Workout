/* Ein Fokus, den es nicht mehr gibt.
 *
 * „Kurz und knapp" und „Beine ernst gemeint" sind gestrichen. Der Fokus steht
 * aber nicht in der App, sondern im Browser des Nutzers – auf jedem Gerät, das
 * damals eine der beiden gewählt hat, liegt der alte Schlüssel noch im
 * localStorage. Was dann passiert, ist der einzige Weg, auf dem jemand die
 * Abschaffung überhaupt bemerkt, und er muss stimmen:
 *
 *   * Es läuft der *benannte* Nachfolger, nicht irgendein Plan.
 *   * `state.focus` zieht nach. Bliebe er auf 'kurz' stehen, verglichen App und
 *     Speicher dauerhaft zwei verschiedene Dinge – restorable() würde ein
 *     Protokoll aus 96 Einheiten in einen Plan mit 84 zurückholen.
 *   * Der bisherige Verlauf ist abgelegt, nicht gelöscht, und trägt den alten
 *     Fokus als Vermerk.
 *   * Die Gewichte bleiben. Sie sind das, was jemand in Monaten erarbeitet hat.
 *   * Es steht dran. Ein stiller Planwechsel ist genau das, was hier nicht
 *     passieren darf.
 */
import { chromium } from 'playwright';
import { URL } from './umgebung.mjs';

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 414, height: 896 } });
await ctx.route('**/rest/v1/**', (r) => r.fulfill({ status: 204, body: '' }));
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message));
page.on('dialog', (d) => d.accept().catch(() => {}));
let fails = 0;
const check = (c, m) => { console.log(`${c ? 'OK  ' : 'FAIL'} ${m}`); if (!c) { fails++; process.exitCode = 1; } };

// --- Ein Gerät, das seit einem halben Jahr auf „Kurz und knapp" steht ---
await page.goto(URL, { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.setItem('workout.state.v1', JSON.stringify({
  greeted: true, name: 'Tobi', focus: 'kurz',
  weights: { 'goblet-squat': 24, 'floor-press': 30 },
  bwPlus: { 'liegestuetze': 4 },
  level: 'geuebt',
  log: { 1: { db: { 'goblet-squat': [{ w: 24, done: true }] }, mode: 'db', startedOn: '2026-03-01' } },
})));
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(400);

const nach = await page.evaluate(async () => {
  const [store, daten] = await Promise.all([import('./js/store.js'), import('./js/data.js')]);
  const s = store.getState();
  return {
    focus: s.focus,
    planName: daten.FOCUS.name,
    planLaenge: daten.PLAN.length,
    ziele: daten.TARGET,
    umzug: s.fokusUmzug,
    ablage: (s.rounds || []).map((r) => r.focus),
    logLeer: Object.keys(s.log || {}).length === 0,
    holbar: !!store.restorable(),
    gewichte: s.weights,
    bwPlus: s.bwPlus,
    level: s.level,
  };
});

check(nach.planName === 'Cut', `es läuft der benannte Nachfolger (${nach.planName})`);
check(nach.focus === 'cut', `und der gespeicherte Fokus zieht nach (${nach.focus})`);
check(nach.planLaenge === 84, `mit dessen 84 Einheiten statt der 96 von vorher (${nach.planLaenge})`);
check(nach.ziele.abs === 9 && nach.ziele.hamstringsHip === 5,
  `und dessen Zielen (Bauch ${nach.ziele.abs}, Hüftstreckung ${nach.ziele.hamstringsHip})`);

check(!!nach.umzug, 'der Umzug ist vermerkt');
check(nach.umzug && nach.umzug.von === 'Kurz und knapp',
  `und nennt den Plan beim Namen, den es nicht mehr gibt (${nach.umzug && nach.umzug.von})`);
check(nach.umzug && nach.umzug.nach === 'Cut', 'sowie den, auf dem man jetzt steht');

check(nach.ablage.includes('kurz'),
  `der bisherige Verlauf liegt in der Ablage, mit altem Fokus (${nach.ablage.join(',') || 'leer'})`);
check(nach.logLeer, 'der neue Plan startet leer');
check(!nach.holbar,
  'und lässt sich nicht zurückholen – hinter Workout 12 stehen jetzt andere Übungen');

check(nach.gewichte['goblet-squat'] === 24 && nach.gewichte['floor-press'] === 30,
  'die eingetragenen Gewichte bleiben unangetastet');
check(nach.bwPlus['liegestuetze'] === 4, 'die Zusatzwiederholungen ebenso');
check(nach.level === 'geuebt', 'und die Erfahrungsstufe auch');

// --- Es steht sichtbar da, nicht nur im Speicher ---
const hinweis = page.locator('.notice.aufstieg', { hasText: 'Kurz und knapp' });
check(await hinweis.count() === 1, 'auf der Startseite steht ein Hinweis dazu');
check((await hinweis.textContent()).includes('Cut'), 'der den neuen Plan benennt');

// --- Wegtippen heißt weg, auch nach dem Neuladen ---
await hinweis.locator('[data-act="umzug-ok"]').click();
await page.waitForTimeout(250);
check(await page.locator('.notice.aufstieg').count() === 0, 'wegtippen lässt ihn verschwinden');
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(400);
const zweiteRunde = await page.evaluate(async () => {
  const s = (await import('./js/store.js')).getState();
  return { focus: s.focus, umzug: s.fokusUmzug, runden: (s.rounds || []).length };
});
check(zweiteRunde.umzug === null, 'und er kommt beim nächsten Laden nicht wieder');
check(zweiteRunde.focus === 'cut', 'der Fokus steht weiter auf cut');
check(zweiteRunde.runden === 1,
  `der Umzug läuft nur einmal, nicht bei jedem Laden (${zweiteRunde.runden} Runde(n) in der Ablage)`);

// --- Der zweite abgeschaffte Plan, und der Weg zur eigenen Wahl ---
await page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('workout.state.v1'));
  s.focus = 'beine'; s.rounds = []; s.fokusUmzug = null;
  localStorage.setItem('workout.state.v1', JSON.stringify(s));
});
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(400);
const beine = await page.evaluate(async () => {
  const [store, daten] = await Promise.all([import('./js/store.js'), import('./js/data.js')]);
  return { focus: store.getState().focus, planName: daten.FOCUS.name };
});
check(beine.focus === 'bbp' && beine.planName === 'Bauch, Beine, Po',
  `„Beine ernst gemeint" führt auf den Beinplan (${beine.focus}, ${beine.planName})`);

// Der Nachfolger ist eine Annahme. Wer sie nicht teilt, kommt in einem Griff
// zur Auswahl – sonst wäre die Umleitung doch wieder eine Entscheidung über
// den Kopf des Nutzers hinweg.
await page.locator('[data-act="umzug-waehlen"]').click();
await page.waitForTimeout(350);
check(await page.locator('[data-act="set-focus"]').count() === 4,
  'der zweite Knopf führt direkt zur Fokusauswahl');

// --- Ein Fokus, der nie existiert hat, darf trotzdem nicht die App anhalten ---
await page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('workout.state.v1'));
  s.focus = 'quatsch'; s.fokusUmzug = null;
  localStorage.setItem('workout.state.v1', JSON.stringify(s));
});
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(400);
const quatsch = await page.evaluate(async () => {
  const [store, daten] = await Promise.all([import('./js/store.js'), import('./js/data.js')]);
  return { focus: store.getState().focus, planName: daten.FOCUS.name, umzug: store.getState().fokusUmzug };
});
check(quatsch.planName === 'Aufbau', `ein unbekannter Fokus landet beim Aufbauplan (${quatsch.planName})`);
check(!quatsch.umzug, 'ohne Umzugsmeldung – dafür gibt es keinen Vorgänger zu benennen');
check(await page.locator('[data-act="start-session"]').count() > 0, 'und die App läuft weiter');

console.log(`\n${fails ? fails + ' FEHLER' : 'alle Prüfungen bestanden'}`);
console.log('ERRORS:', errs.length ? errs : 'none');
await browser.close();
