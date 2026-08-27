/*
 * Aktualisierung: frisches index.html darf nicht auf altes app.js treffen.
 *
 * Nachgestellt wird der echte Ablauf: Version installieren, App benutzen,
 * dann eine neue Version ausliefern und die App wieder öffnen. Danach muss
 * alles aus derselben Fassung stammen.
 *
 * Ausgeliefert wird dabei über Port 8100 – der Server dort setzt wie GitHub
 * Pages eine Haltbarkeit von zehn Minuten. Genau daran ist es in der Praxis
 * gescheitert: ein gewöhnliches fetch() im Service Worker bekam die alte
 * Fassung aus dem Browser-Zwischenspeicher und legte sie als frisch ab.
 */
import { chromium } from 'playwright';
import { UPDATE_URL, ROOT, profil } from './umgebung.mjs';
import { readFileSync, writeFileSync, rmSync } from 'node:fs';

const SW = `${ROOT}/sw.js`;
const APP = `${ROOT}/js/app.js`;
const swOrig = readFileSync(SW, 'utf8');
const appOrig = readFileSync(APP, 'utf8');

let fails = 0;
const check = (c, m) => { console.log(`${c ? 'OK  ' : 'FAIL'} ${m}`); if (!c) { fails++; process.exitCode = 1; } };

// Das Profil muss frisch sein: ein übrig gebliebener Zwischenspeicher aus dem
// letzten Lauf würde schon beim ersten Öffnen als Aktualisierung zählen und das
// einmalige Neuladen verbrauchen.
rmSync(profil('upd'), { recursive: true, force: true });
const ctx = await chromium.launchPersistentContext(profil('upd'), { viewport: { width: 414, height: 896 } });
const page = await ctx.pages()[0];
const errs = [];
page.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message));

try {
  // 1. Alte Fassung installieren
  await page.goto(UPDATE_URL, { waitUntil: 'networkidle' });
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForTimeout(600);
  const marker = await page.evaluate(() => window.__version || null);
  check(await page.locator('.tab').count() === 3, 'App läuft mit installiertem Service Worker');
  void marker;

  // 2. Neue Fassung ausliefern: app.js bekommt eine erkennbare Marke, sw.js
  //    eine neue Version – genau das passiert bei einem Deploy.
  writeFileSync(APP, `${appOrig}\nwindow.__neu = true;\n`);
  writeFileSync(SW, swOrig.replace(/const VERSION = 'v\d+';/, "const VERSION = 'vTEST';"));

  // 3. App wieder öffnen
  await page.goto(UPDATE_URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(4000);   // Installieren, Übernehmen, Neuladen
  console.log('     Marke gesetzt:', await page.evaluate(() => { try { return sessionStorage.getItem('workout.reloaded'); } catch { return 'fehler'; } }));
  console.log('     app.js im Cache neu:', await page.evaluate(async () => {
    const c = await caches.open((await caches.keys()).find((k) => k.startsWith('workout-')));
    const r = await c.match('./js/app.js');
    return r ? (await r.text()).includes('__neu') : 'nicht im Cache';
  }));
  const neu = await page.evaluate(() => !!window.__neu);
  check(neu, 'nach der Aktualisierung läuft das neue app.js');
  const cacheName = await page.evaluate(async () => (await caches.keys()).find((k) => k.startsWith('workout-')));
  check(cacheName === 'workout-vTEST', `neuer Zwischenspeicher aktiv (${cacheName})`);
  check(await page.locator('.tab').count() === 3, 'Oberfläche steht');
  check(errs.length === 0, `keine Fehler${errs.length ? ': ' + errs.join(' | ') : ''}`);
} finally {
  writeFileSync(APP, appOrig);
  writeFileSync(SW, swOrig);
  await ctx.close();
}

console.log(`\n${fails ? fails + ' FEHLER' : 'alle Prüfungen bestanden'}`);
