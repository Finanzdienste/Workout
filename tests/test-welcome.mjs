/* Erster Start, Teilen-Knopf und die Uhr, die nur läuft, wenn trainiert wird. */
import { chromium } from 'playwright';
import { URL, SHOT } from './umgebung.mjs';


const browser = await chromium.launch();
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
  window.__geteilt = [];
  navigator.share = (d) => { window.__geteilt.push(d); return Promise.resolve(); };
  window.__hidden = false;
  Object.defineProperty(document, 'hidden', { get: () => window.__hidden, configurable: true });
  Object.defineProperty(document, 'visibilityState', {
    get: () => (window.__hidden ? 'hidden' : 'visible'), configurable: true,
  });
});

// --- Wer den Link zum ersten Mal öffnet ---
await page.goto(URL, { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle' });
check(await page.locator('.welcome').count() === 1, 'erster Start zeigt die Willkommensseite');
check(await page.locator('#nameInput').count() === 1, 'und fragt nach dem Namen');
check((await page.locator('.welcome').textContent()).includes('kein Konto'),
  'sagt, dass es kein Konto gibt');
await page.screenshot({ path: `${SHOT}/44-welcome.png` });

// Drei Schritte: Name, Farbe, Fokus.
await page.locator('#nameInput').fill('Tom');
await page.locator('[data-act="setup-next"]').click();
await page.waitForTimeout(200);
check((await page.locator('.hero-title').textContent()).includes('Farbe'), 'Schritt 2: Farbe');
check(await page.locator('[data-act="set-theme"]').count() >= 4, 'mehrere Farben zur Wahl');
await page.locator('[data-act="set-theme"][data-v="rosa"]').click();
await page.waitForTimeout(200);
check(await page.evaluate(() => document.documentElement.dataset.theme) === 'rosa',
  'die Farbe wirkt sofort');
await page.locator('[data-act="setup-next"]').click();
await page.waitForTimeout(200);
check(await page.locator('[data-act="set-level"]').count() === 3, 'Schritt 3: Erfahrung');
check((await page.locator('.welcome').textContent()).includes('Startgewichte'),
  'und erklärt, dass es um die Startgewichte geht');
await page.locator('[data-act="set-level"][data-v="anfaenger"]').click();
await page.waitForTimeout(200);
await page.locator('[data-act="setup-next"]').click();
await page.waitForTimeout(200);
check(await page.locator('.fokus-btn').count() >= 1, 'Schritt 4: Trainingsfokus');
check((await page.locator('.welcome').textContent()).includes('selbst zusammen'),
  'mit dem Hinweis, dass man sich alles selbst zusammenstellen kann');
await page.locator('[data-act="setup-next"]').click();
await page.waitForTimeout(300);
check(await page.locator('.welcome').count() === 0, 'danach steht die Startansicht da');
check((await page.locator('.hero-eyebrow').first().textContent()).includes('Tom'),
  'der Name steht im Kopf');

await page.reload({ waitUntil: 'networkidle' });
check(await page.locator('.welcome').count() === 0, 'und die Willkommensseite kommt nicht wieder');

// --- Wer schon Daten hat, wird nicht begrüßt ---
await page.evaluate(() => {
  localStorage.setItem('workout.state.v1', JSON.stringify({ mode: 'db', weights: { x: 1 } }));
});
await page.reload({ waitUntil: 'networkidle' });
check(await page.locator('.welcome').count() === 0,
  'ein alter Stand ohne den Schlüssel gilt als bekannt, nicht als neu');

// --- Teilen ---
await page.evaluate(() => localStorage.setItem('workout.state.v1', JSON.stringify({ greeted: true, name: 'Tom' })));
await page.reload({ waitUntil: 'networkidle' });
await page.locator('.tab[data-tab="settings"]').click();
await page.waitForTimeout(200);
const karte = page.locator('.card').filter({ hasText: 'Schick den Link weiter' });
check(await karte.count() === 1, 'Einstellungen haben einen Abschnitt zum Teilen');
check(await page.locator('[data-act="share-whatsapp"]').count() === 1, 'WhatsApp-Knopf');
check(await page.locator('[data-act="copy-link"]').count() === 1, 'Link kopieren');
check((await karte.textContent()).includes('von allein wird nichts übertragen'),
  'sagt klar, dass von allein nichts übertragen wird');
check((await karte.textContent()).includes('was ihr euch'),
  'und dass man sich den Stand gegenseitig schickt');
await page.locator('[data-act="share-link"]').click();
await page.waitForTimeout(150);
const geteilt = await page.evaluate(() => window.__geteilt);
check(geteilt.length === 1, 'Teilen ruft den Systemdialog');
check(/^http:\/\/127\.0\.0\.1:8099\/$/.test(geteilt[0]?.url || ''),
  `und gibt die Adresse der App weiter (${geteilt[0]?.url})`);
check((geteilt[0]?.text || '').includes('ohne Konto'), 'mit einem Text, der die App erklärt');

const nameFeld = page.locator('[data-act="name-input"]');
check(await nameFeld.inputValue() === 'Tom', 'der Name lässt sich hier ändern');
await nameFeld.fill('Alex');
await page.waitForTimeout(150);
check(await page.evaluate(() => JSON.parse(localStorage.getItem('workout.state.v1')).name) === 'Alex',
  'und wird gespeichert');
await page.screenshot({ path: `${SHOT}/45-share.png` });

// --- Die Uhr läuft nur, wenn die App offen ist oder Pause ist ---
await page.evaluate(() => {
  localStorage.setItem('workout.state.v1', JSON.stringify({
    greeted: true, restSeconds: 0, useExerciseRest: false,
  }));
});
await page.reload({ waitUntil: 'networkidle' });
await page.locator('[data-act="start-session"]').first().click();
await page.waitForTimeout(2200);
const lauf1 = await page.evaluate(async () => (await import('./js/store.js')).sessionSeconds());
check(lauf1 >= 2, `Uhr läuft im Training (${lauf1} s)`);

// weggeschaltet, keine Pause -> steht
await page.evaluate(() => {
  window.__hidden = true;
  document.dispatchEvent(new Event('visibilitychange'));
});
await page.waitForTimeout(2500);
const lauf2 = await page.evaluate(async () => (await import('./js/store.js')).sessionSeconds());
check(lauf2 === lauf1, `im Hintergrund steht sie (${lauf1} -> ${lauf2} s)`);

await page.evaluate(() => {
  window.__hidden = false;
  document.dispatchEvent(new Event('visibilitychange'));
});
await page.waitForTimeout(2200);
const lauf3 = await page.evaluate(async () => (await import('./js/store.js')).sessionSeconds());
check(lauf3 > lauf2, `zurück in der App läuft sie weiter (${lauf3} s)`);

// weggeschaltet, aber Pause läuft -> läuft weiter
// Über den Store einstellen, nicht über den Speicher: Beim Verlassen der Seite
// schreibt die App ihren eigenen Stand darüber, und ein Neuladen verlöre ihn.
await page.evaluate(async () => (await import('./js/store.js')).setSetting('restSeconds', 60));
await page.locator('.set-btn').first().click();
await page.waitForTimeout(300);
check(await page.locator('#restBar').isVisible(), 'Pause läuft');
const lauf4 = await page.evaluate(async () => (await import('./js/store.js')).sessionSeconds());
await page.evaluate(() => {
  window.__hidden = true;
  document.dispatchEvent(new Event('visibilitychange'));
});
await page.waitForTimeout(2500);
const lauf5 = await page.evaluate(async () => (await import('./js/store.js')).sessionSeconds());
check(lauf5 > lauf4, `während der Pause zählt sie auch im Hintergrund weiter (${lauf4} -> ${lauf5} s)`);

console.log(`\n${fails ? fails + ' FEHLER' : 'alle Prüfungen bestanden'}`);
console.log('ERRORS:', errs.length ? errs : 'none');
await browser.close();
