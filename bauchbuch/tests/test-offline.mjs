/*
 * Ohne Netz benutzbar.
 *
 * Für ein Magentagebuch ist das kein Zusatz: Eingetragen wird nachts, im Bad,
 * im Zug, im Untergeschoss einer Praxis. Eine App, die dann eine leere Seite
 * zeigt, wird nach dem zweiten Mal nicht mehr geöffnet – und ein Tagebuch mit
 * Lücken ist genau das, was die Auswertung wertlos macht.
 */
import { chromium } from 'playwright';
import { rmSync } from 'node:fs';
import { URL, KEY, HANDY, SHOT, profil, pruefer } from './umgebung.mjs';

const { check, ende } = pruefer();

// Frisches Profil: ein Zwischenspeicher aus dem letzten Lauf gehört einer
// älteren Fassung.
const ORT = profil('sw');
rmSync(ORT, { recursive: true, force: true });
const ctx = await chromium.launchPersistentContext(ORT, { viewport: HANDY });
const page = ctx.pages()[0] || await ctx.newPage();
const fehler = [];
page.on('pageerror', (e) => fehler.push(`PAGEERROR: ${e.message}`));

await page.goto(URL, { waitUntil: 'networkidle' });
await page.evaluate((k) => localStorage.setItem(k, JSON.stringify({ begruesst: true })), KEY);
await page.reload({ waitUntil: 'networkidle' });

await page.waitForFunction(() => navigator.serviceWorker.controller !== null, { timeout: 15000 })
  .catch(() => {});
const stand = await page.evaluate(async () => {
  const reg = await navigator.serviceWorker.getRegistration();
  return { aktiv: !!reg?.active, bedient: !!navigator.serviceWorker.controller };
});
check(stand.aktiv, 'Service Worker aktiv');
check(stand.bedient, 'die Seite wird von ihm bedient');

// Etwas eintragen, damit auch das Speichern ohne Netz geprüft wird.
await page.locator('[data-act="neu"][data-art="essen"]').click();
await page.waitForTimeout(150);
await page.locator('#bogenWas').fill('Zwieback');
await page.locator('[data-act="bogen-speichern"]').click();
await page.waitForTimeout(250);

const vorrat = await page.evaluate(async () => {
  // Den Namen aus dem Zwischenspeicher selbst lesen, damit ein Versionssprung
  // in sw.js den Test nicht scheitern lässt.
  const name = (await caches.keys()).find((k) => k.startsWith('bauchbuch-'));
  const c = await caches.open(name);
  return (await c.keys()).map((r) => new URL(r.url).pathname).sort();
});
check(vorrat.some((p) => p.endsWith('/css/styles.css')), 'das Styling liegt im Vorrat');
check(vorrat.some((p) => p.endsWith('/js/auswertung.js')), 'die Rechenschicht auch');
check(vorrat.some((p) => p.endsWith('/js/bericht.js')), 'und der Bericht – er wird selten gebraucht und dann meist offline');

/* ---------- Netz weg ---------- */

await ctx.setOffline(true);
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(400);

check(await page.locator('.anlegen-btn').count() === 4, 'die App zeichnet ohne Netz');
const grund = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
check(grund === 'rgb(20, 16, 19)', `das Styling ist auch offline da (${grund})`);
check(await page.locator('.strang-zeile').count() === 1, 'der Eintrag von vorhin steht noch da');

// Offline weiterarbeiten – das ist der eigentliche Zweck.
await page.locator('[data-act="neu"][data-art="beschwerde"]').click();
await page.waitForTimeout(150);
await page.locator('.stufe[data-n="3"]').click();
await page.locator('[data-act="bogen-speichern"]').click();
await page.waitForTimeout(250);
check(await page.locator('.strang-zeile').count() === 2, 'offline eintragen geht');

await page.locator('[data-act="tab"][data-tab="muster"]').click();
await page.waitForTimeout(250);
check(
  (await page.locator('#view').textContent()).includes('Wie das gelesen wird'),
  'auch die Auswertung läuft ohne Netz – sie rechnet ohnehin nur mit dem, was hier liegt',
);

await page.locator('[data-act="tab"][data-tab="heute"]').click();
await page.waitForTimeout(200);
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(400);
check(await page.locator('.strang-zeile').count() === 2, 'offline Eingetragenes übersteht das Neuladen');
await page.screenshot({ path: `${SHOT}/50-offline.png` });

/* ---------- Netz zurück ---------- */

await ctx.setOffline(false);
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(300);
check(await page.locator('.strang-zeile').count() === 2, 'nach der Rückkehr des Netzes ist alles unverändert');

check(fehler.length === 0, `keine Fehler${fehler.length ? `: ${fehler.join(' | ')}` : ''}`);
await ctx.close();
ende();
