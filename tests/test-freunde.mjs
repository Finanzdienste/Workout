/* Stand verschicken, empfangen, vergleichen – ohne Server. */
import { chromium } from 'playwright';
import { URL } from './umgebung.mjs';

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 414, height: 896 } });
const errs = [];
let fails = 0;
const check = (c, m) => { console.log(`${c ? 'OK  ' : 'FAIL'} ${m}`); if (!c) { fails++; process.exitCode = 1; } };

await ctx.addInitScript(() => {
  window.__geteilt = [];
  navigator.share = (d) => { window.__geteilt.push(d); return Promise.resolve(); };
});

const seite = async () => {
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()); });
  return p;
};

// --- Tobi hakt ein paar Sätze ab und verschickt seinen Stand ---
const tobi = await seite();
await tobi.goto(URL, { waitUntil: 'networkidle' });
await tobi.evaluate(() => localStorage.setItem('workout.state.v1', JSON.stringify({
  greeted: true, name: 'Tobi', restSeconds: 0, useExerciseRest: false,
})));
await tobi.reload({ waitUntil: 'networkidle' });
await tobi.locator('[data-act="start-session"]').first().click();
await tobi.waitForTimeout(200);
for (let i = 0; i < 3; i++) { await tobi.locator('.focus-set').nth(i).click(); await tobi.waitForTimeout(120); }
await tobi.locator('.tab[data-tab="stats"]').click();
await tobi.waitForTimeout(250);
check(await tobi.locator('.card').filter({ hasText: 'Noch niemand im Vergleich' }).count() === 1,
  'ohne Freunde steht da, wie man welche dazubekommt');
await tobi.locator('[data-act="share-stand"]').click();
await tobi.waitForTimeout(200);
const geteilt = await tobi.evaluate(() => window.__geteilt[0]);
check(/#stand=[A-Za-z0-9_-]+$/.test(geteilt?.url || ''), `der Link trägt den Stand (${(geteilt?.url || '').slice(-24)})`);
check((geteilt?.text || '').includes('Einheiten'), 'und der Text nennt die Einheiten');

// --- Alex öffnet den Link, ganz frisch ---
// Eigener Kontext: ein anderes Gerät, eigener Speicher. Im selben Kontext
// schreibt Tobis noch offene Seite ihren Stand zurück, kaum ist er gelöscht.
const ctxAlex = await browser.newContext({ viewport: { width: 414, height: 896 } });
const alex = await ctxAlex.newPage();
alex.on('pageerror', (e) => errs.push('ALEX PAGEERROR: ' + e.message));
await alex.goto(geteilt.url, { waitUntil: 'networkidle' });
await alex.waitForTimeout(300);
check(await alex.locator('.welcome').count() === 1, 'Alex sieht zuerst die Willkommensseite');
check((await alex.locator('.welcome').textContent()).includes('Tobi'),
  'und dort schon, von wem der Link kommt');
check(!alex.url().includes('#stand'), 'der Anker ist aus der Adresse verschwunden');
await alex.locator('#nameInput').fill('Alex');
// Name, Farbe, Erfahrung, Fokus – vier Mal weiter.
for (let i = 0; i < 4; i++) {
  await alex.locator('[data-act="setup-next"]').click();
  await alex.waitForTimeout(200);
}
await alex.locator('.tab[data-tab="stats"]').click();
await alex.waitForTimeout(300);
const tabelle = (await alex.locator('.vgl').textContent()).replace(/\s+/g, ' ');
console.log('     ', tabelle.trim());
check(tabelle.includes('Tobi') && tabelle.includes('Alex'), 'beide stehen im Vergleich');
check(/1 Tobi/.test(tabelle.trim()), 'Tobi liegt vorn – er hat abgehakt, Alex nicht');
check(tabelle.includes('Stand von heute'), 'mit dem Alter des geschickten Standes');

// --- Wieder wegnehmen ---
await alex.locator('[data-act="remove-friend"]').first().click();
await alex.waitForTimeout(250);
check(await alex.locator('.vgl').count() === 0, 'entfernt lässt die Liste wieder leer');

// --- Ein zweiter Stand desselben Menschen ersetzt den ersten ---
const code2 = await alex.evaluate(() => {
  const obj = { v: 1, n: 'Tobi', w: 5, s: 90, kg: 12000, r: 2, p: 84, d: '2026-08-25' };
  const bytes = new TextEncoder().encode(JSON.stringify(obj));
  let roh = ''; bytes.forEach((x) => { roh += String.fromCharCode(x); });
  return btoa(roh).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
});
const ctxDritt = await browser.newContext({ viewport: { width: 414, height: 896 } });
const dritte = await ctxDritt.newPage();
dritte.on('pageerror', (e) => errs.push('DRITTE PAGEERROR: ' + e.message));
await dritte.goto(URL, { waitUntil: 'networkidle' });
await dritte.evaluate(() => localStorage.setItem('workout.state.v1',
  JSON.stringify({ greeted: true, name: 'Chris' })));
await dritte.reload({ waitUntil: 'networkidle' });
// Der Link kommt an, während die App schon offen ist: Für den Browser ist das
// nur ein Ankerwechsel, kein Neuladen.
for (const durchgang of [1, 2]) {
  await dritte.evaluate((c) => { location.hash = `stand=${c}`; }, code2);
  await dritte.waitForTimeout(300);
  check(await dritte.locator('[data-act="accept-stand"]').count() === 1,
    `Ankerwechsel bei offener App wird bemerkt (${durchgang}. Mal)`);
  await dritte.locator('[data-act="accept-stand"]').click();
  await dritte.waitForTimeout(300);
}
const zeilen = await dritte.locator('.vgl tbody tr').count();
check(zeilen === 2, `derselbe Name bleibt eine Zeile (${zeilen} Zeilen: ich und Tobi)`);

console.log(`\n${fails ? fails + ' FEHLER' : 'alle Prüfungen bestanden'}`);
console.log('ERRORS:', errs.length ? errs : 'none');
await browser.close();
