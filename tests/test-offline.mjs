import { chromium } from 'playwright';
import { URL, SHOT, profil } from './umgebung.mjs';
import { rmSync } from 'node:fs';

// Frisches Profil: ein Zwischenspeicher aus dem letzten Lauf gehört einer
// älteren Fassung, und der erste Aufruf danach ist eine Aktualisierung – das
// prüft test-update.mjs, hier geht es um den Offline-Betrieb.
rmSync(profil('sw'), { recursive: true, force: true });
const ctx = await chromium.launchPersistentContext(profil('sw'), { viewport: { width: 414, height: 896 } });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message));

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

await page.goto(URL, { waitUntil: 'networkidle' });
// Das Profil bleibt zwischen Läufen bestehen – das ist für den Service Worker
// gewollt, für die Trainingsdaten nicht: sonst zählt hier ein Haken aus einem
// früheren Lauf mit, womöglich noch zu einem älteren Plan.
await page.evaluate(() => { localStorage.clear(); localStorage.setItem('workout.state.v1', '{"greeted":true}'); });
const LEN = await page.evaluate(() => import('./js/data.js').then(({ PLAN }) => PLAN[0].ex.length));
// Pausentimer stoert diese Tests nur - hier geht es um anderes.
await page.evaluate(() => { const k='workout.state.v1'; const s=JSON.parse(localStorage.getItem(k)||'{}'); s.restSeconds=0; localStorage.setItem(k, JSON.stringify(s)); });
await reloadToList();

// Registrierung abwarten
await page.waitForFunction(() => navigator.serviceWorker.controller !== null, { timeout: 15000 })
  .catch(() => {});
const state = await page.evaluate(async () => {
  const reg = await navigator.serviceWorker.getRegistration();
  return { scope: reg?.scope, active: !!reg?.active, controlled: !!navigator.serviceWorker.controller };
});
console.log('     ', JSON.stringify(state));
check(state.active, 'Service Worker aktiv');
check(state.controlled, 'Seite wird vom Service Worker bedient');

// Etwas eintragen, damit auch die Persistenz offline geprüft wird
await page.locator('.set-btn').first().click();
await page.waitForTimeout(300);

const cached = await page.evaluate(async () => {
  // Name aus dem Zwischenspeicher selbst lesen, damit ein Versionssprung
  // in sw.js den Test nicht scheitern lässt.
  const name = (await caches.keys()).find((k) => k.startsWith('workout-'));
  const c = await caches.open(name);
  return (await c.keys()).map((r) => new URL(r.url).pathname).sort();
});
console.log('     zwischengespeichert:', cached.join(' '));
check(cached.some((p) => p.endsWith('/js/data.js')), 'Plandaten im Zwischenspeicher');
check(cached.some((p) => p.endsWith('/css/styles.css')), 'Styling im Zwischenspeicher');

// --- Netz weg ---
await ctx.setOffline(true);
await reloadToList('load');

check(await page.locator('.ex').count() === LEN, 'App rendert ohne Netz');
const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
check(bg === 'rgb(15, 17, 21)', `Styling auch offline da (${bg})`);
check(await page.locator('.set-btn.on').count() === 1, 'eingetragener Satz offline noch da');

await page.locator('[data-act="hide-list"]').click();
await page.waitForTimeout(150);
check(await page.locator('.bm-part').count() > 0, 'Körperkarte offline vollständig');
await page.locator('[data-act="show-list"]').click();
await page.waitForTimeout(150);

// Offline weiterarbeiten
await page.locator('.ex').nth(1).locator('.set-btn').first().click();
await page.waitForTimeout(300);
await reloadToList('load');
check(await page.locator('.set-btn.on').count() === 2, 'offline eingetragener Satz übersteht Neuladen');
await page.screenshot({ path: `${SHOT}/30-offline.png` });

// --- Netz zurück ---
await ctx.setOffline(false);
await reloadToList();
check(await page.locator('.ex').count() === LEN, 'nach Rückkehr des Netzes weiterhin in Ordnung');
check(await page.locator('.set-btn.on').count() === 2, 'Eintragungen unverändert');

console.log(`\n${fails ? fails + ' FEHLER' : 'alle Prüfungen bestanden'}`);
console.log('ERRORS:', errs.length ? errs : 'none');
await ctx.close();
