/* Töne zu den Ereignissen der App und der Hinweis im Hintergrund. */
import { chromium } from 'playwright';
import { URL, SHOT } from './umgebung.mjs';


const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: { width: 414, height: 896 } });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()); });

let fails = 0;
const check = (cond, msg) => {
  console.log(`${cond ? 'OK  ' : 'FAIL'} ${msg}`);
  if (!cond) { fails++; process.exitCode = 1; }
};

await ctx.addInitScript(() => {
  window.__osc = [];
  const Ctx = window.AudioContext || window.webkitAudioContext;
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
  // Hinweise mitschneiden. Ohne Service-Worker-Registrierung nimmt die App den
  // Notification-Konstruktor – den ersetzen wir hier.
  window.__notes = [];
  window.__perm = 'granted';
  window.Notification = class {
    constructor(title, opt) { window.__notes.push({ title, ...opt }); }
    static get permission() { return window.__perm; }
    static requestPermission() { return Promise.resolve(window.__perm); }
    close() {}
  };
  // Sichtbarkeit steuerbar machen: Der Hinweis kommt nur, wenn die App gerade
  // nicht zu sehen ist.
  window.__hidden = false;
  Object.defineProperty(document, 'hidden', { get: () => window.__hidden, configurable: true });
  Object.defineProperty(document, 'visibilityState', {
    get: () => (window.__hidden ? 'hidden' : 'visible'), configurable: true,
  });
  if (navigator.serviceWorker) {
    Object.defineProperty(navigator.serviceWorker, 'getRegistration', {
      value: () => Promise.resolve(null), configurable: true,
    });
  }
});

/** Töne ohne den unhörbaren Trägerton. */
const toene = (ab = 0) => page.evaluate((ab) => window.__osc.slice(ab).filter((o) => o.f !== 30), ab);
const zahl = () => page.evaluate(() => window.__osc.length);

await page.goto(URL, { waitUntil: 'networkidle' });
await page.evaluate(() => { localStorage.clear(); localStorage.setItem('workout.state.v1', '{"greeted":true}'); });
await page.evaluate(() => {
  const s = { restSeconds: 2, useExerciseRest: false, tab: 'dashboard' };
  localStorage.setItem('workout.state.v1', JSON.stringify(s));
});
await page.reload({ waitUntil: 'networkidle' });

// --- Trainingsstart ---
const vorStart = await zahl();
await page.locator('[data-act="start-session"]').first().click();
await page.waitForTimeout(150);
const startTon = await toene(vorStart);
check(startTon.length === 3, `Trainingsstart klingt (${startTon.map((o) => Math.round(o.f)).join(' + ')} Hz)`);
check(startTon.every((o) => o.at - o.now < 0.5), 'und zwar sofort, nicht eingeplant');

// --- Satz abhaken ---
const vorSatz = await zahl();
await page.locator('.set-btn').first().click();
await page.waitForTimeout(150);
const satzToene = await toene(vorSatz);
check(satzToene.some((o) => o.at - o.now < 0.5), 'abgehakter Satz gibt einen kurzen Ton');
check(satzToene.some((o) => o.at - o.now > 1), 'und das Pausensignal wird vorausgeplant');

// --- Hinweis im Hintergrund: erst nach Erlaubnis ---
await page.waitForTimeout(2200);
check(await page.evaluate(() => window.__notes.length) === 0,
  'ohne eingeschalteten Schalter kommt kein Hinweis');

await page.locator('.tab[data-tab="settings"]').click();
await page.waitForTimeout(150);
const karte = page.locator('.card').filter({ hasText: 'Hinweis im Hintergrund' }).first();
check(await karte.count() === 1, 'Einstellungen zeigen den Abschnitt "Töne und Hinweise"');
check(await page.locator('[data-act="toggle-sound"]').count() === 1, 'Schalter für die Töne');
check(await page.locator('[data-act="toggle-sound-sets"]').count() === 1, 'Schalter für den Satz-Ton');
check(await page.locator('[data-act="test-sound"]').count() === 1, 'Knopf zum Anhören');
await page.screenshot({ path: `${SHOT}/41-sound-settings.png` });

const vorTest = await zahl();
await page.locator('[data-act="test-sound"]').click();
await page.waitForTimeout(4200);
check((await toene(vorTest)).length >= 10, `"Töne anhören" spielt alle fünf durch (${(await toene(vorTest)).length} Töne)`);

await page.locator('[data-act="toggle-notify"]').click();
await page.waitForTimeout(200);
check(await page.locator('[data-act="toggle-notify"]').getAttribute('aria-pressed') === 'true',
  'Hinweis eingeschaltet, nachdem der Browser die Erlaubnis gegeben hat');

// --- Vor der App sitzend braucht es keinen Hinweis ---
await page.locator('.tab[data-tab="dashboard"]').click();
await page.waitForTimeout(150);
await page.locator('.set-btn').nth(1).click();
await page.waitForTimeout(2600);
check(await page.evaluate(() => window.__notes.length) === 0,
  'wer die App offen hat, bekommt keine Systemmeldung – der Ton reicht');

// --- Weggeschaltet: jetzt kommt er ---
// Sauberer Ausgangspunkt: Nach dem letzten Satz springt die Ansicht seit
// Neuestem sofort weiter, dann zählen die Knöpfe zu einer anderen Übung.
// Über den Store zurücksetzen, nicht über den Speicher: Beim Verlassen der
// Seite schreibt die App ihren eigenen Stand darüber.
await page.evaluate(async () => (await import('./js/store.js')).restartPlan(0));
await page.locator('.tab[data-tab="stats"]').click();
await page.locator('.tab[data-tab="dashboard"]').click();   // neu zeichnen
await page.waitForTimeout(250);
await page.locator('[data-act="start-session"]').first().click();
await page.waitForTimeout(150);
await page.locator('.set-btn').first().click();   // Satz 1 -> Pause läuft
await page.evaluate(() => { window.__hidden = true; });
await page.waitForTimeout(2600);
const notes = await page.evaluate(() => window.__notes);
check(notes.length === 1, `Hinweis am Pausenende (${notes.length})`);
check(notes[0]?.title === 'Pause vorbei', `Titel: ${notes[0]?.title}`);
check(/Satz \d von \d/.test(notes[0]?.body || ''), `Text nennt den nächsten Satz: ${notes[0]?.body}`);

// --- Abgebrochene Pause meldet sich nicht ---
await page.evaluate(() => { window.__notes.length = 0; });
await page.locator('.set-btn').nth(2).click();
await page.waitForTimeout(200);
if (await page.locator('#restSkip').isVisible()) await page.locator('#restSkip').click();
await page.waitForTimeout(2600);
check(await page.evaluate(() => window.__notes.length) === 0,
  'übersprungene Pause meldet sich nicht mehr');

// --- Töne abschalten ---
await page.locator('.tab[data-tab="settings"]').click();
await page.waitForTimeout(150);
await page.locator('[data-act="toggle-sound"]').click();
await page.waitForTimeout(200);
check(await page.locator('[data-act="toggle-sound-sets"]').count() === 0,
  'ohne Töne verschwindet der Unterschalter');
await page.locator('.tab[data-tab="dashboard"]').click();
await page.waitForTimeout(150);
const vorStumm = await zahl();
const knopf = page.locator('.set-btn').first();
await knopf.click();      // Haken weg
await page.waitForTimeout(120);
await knopf.click();      // und wieder hin -> Pause liefe
await page.waitForTimeout(2600);
check((await toene(vorStumm)).length === 0, 'abgeschaltet bleibt alles still');

// --- Vorwarnung fünf Sekunden vor Schluss ---
await page.evaluate(async () => {
  const s = await import('./js/store.js');
  s.setSetting('sound', true);
  s.setSetting('restSeconds', 8);
  s.setSetting('useExerciseRest', false);
  s.restartPlan(0);
});
await page.evaluate(() => { window.__hidden = false; });
await page.locator('.tab[data-tab="stats"]').click();
await page.locator('.tab[data-tab="dashboard"]').click();   // neu zeichnen
await page.waitForTimeout(250);
await page.locator('[data-act="start-session"]').first().click();
await page.waitForTimeout(150);
const vorPause = await zahl();
await page.locator('.set-btn').first().click();
await page.waitForTimeout(200);
const paar = (await toene(vorPause)).filter((o) => o.at - o.now > 1);
check(paar.length === 4, `zwei Signale eingeplant: Vorwarnung und Ende (${paar.length} Töne)`);
const vorwarn = paar.filter((o) => Math.abs(o.at - o.now - 3) < 0.6);
check(vorwarn.length === 2, `Vorwarnung liegt 5 s vor dem Ende (bei +${vorwarn[0] ? (vorwarn[0].at - vorwarn[0].now).toFixed(1) : '?'} s von 8)`);
check(await page.locator('#restLabel').textContent() === 'Pause', 'Leiste sagt zunächst "Pause"');
await page.waitForTimeout(4200);
check(await page.locator('#restLabel').textContent() === 'Fertig machen',
  'in den letzten fünf Sekunden steht dort "Fertig machen"');
check(await page.locator('#restBar').evaluate((el) => el.classList.contains('ready')),
  'und die Leiste färbt sich um');

console.log(`\n${fails ? fails + ' FEHLER' : 'alle Prüfungen bestanden'}`);
console.log('ERRORS:', errs.length ? errs : 'none');
await browser.close();
