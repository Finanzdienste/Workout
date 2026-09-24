/*
 * Daten gehen nicht still verloren, und die App geht auch ohne Netz auf.
 *
 * Sechs Befunde der Durchsicht, alle von derselben Sorte – etwas geht weg,
 * ohne dass es jemand merkt:
 *
 *   1. Eine einzige Fehlerseite (503 von GitHub) landete im Zwischenspeicher
 *      und wurde danach auch offline ausgeliefert.
 *   2. „App aktualisieren" ohne Netz räumte die App ab.
 *   3. Der Import ersetzte den Verlauf ohne Frage und ohne Rückweg,
 *   4. schaltete eine abgeschaltete Telemetrie wieder ein
 *   5. und übernahm eigene Workouts ungeprüft.
 *   6. Zwei offene Fenster: Ein Tipp im veralteten überschrieb das andere.
 *   7. „Alles löschen" bei abgeschaltetem Teilen ließ die Server-Zeile stehen.
 *
 * Für 1 und 2 steht ein Vermittler vor dem Server, der auf Knopfdruck eine
 * 503 liefert oder ganz verschwindet. Die Prüfung mit setOffline() sieht den
 * Service Worker nicht – dessen Abrufe gehen daran vorbei, gemessen bei der
 * Durchsicht: 31 Anfragen am Server, während die Seite „offline" meldete.
 */
import http from 'node:http';
import { chromium } from 'playwright';
import { starte } from './server.mjs';

const HINTEN = 8141;
const VORN = 8142;
const hinten = await starte(HINTEN, 0);
let modus = 'gut';   // 'gut' | 'kaputt'
let vorn = null;
const vornAuf = () => new Promise((ok) => {
  vorn = http.createServer((req, res) => {
    if (modus === 'kaputt') {
      res.writeHead(503, { 'content-type': 'text/html' });
      res.end('<h1>503 Service Unavailable</h1>');
      return;
    }
    const p = http.request({ host: '127.0.0.1', port: HINTEN, path: req.url, method: req.method,
      headers: req.headers }, (r) => { res.writeHead(r.statusCode, r.headers); r.pipe(res); });
    req.pipe(p);
  });
  vorn.listen(VORN, '127.0.0.1', ok);
});
const vornZu = () => new Promise((ok) => {
  vorn.closeAllConnections?.();
  vorn.close(() => ok());
});
await vornAuf();
const URL = `http://127.0.0.1:${VORN}/index.html`;

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 414, height: 896 } });
const anfragen = [];
await ctx.route('**/rest/v1/**', (r) => { anfragen.push(r.request().url()); r.fulfill({ status: 204, body: '' }); });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message));
let fails = 0;
const check = (c, m) => { console.log(`${c ? 'OK  ' : 'FAIL'} ${m}`); if (!c) { fails++; process.exitCode = 1; } };
const appDa = async () => (await page.locator('#view').count()) > 0
  && !/503 Service/.test(await page.locator('body').innerText());

await page.goto(URL, { waitUntil: 'networkidle' });
await page.evaluate(async () => {
  const s = await import('./js/store.js');
  s.setSetting('greeted', true);
  s.setSetting('name', 'T');
  await navigator.serviceWorker.ready;
});
// Einmal neu laden, damit der Worker die Seite kontrolliert und sie ablegt.
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(500);
check(await page.evaluate(() => !!navigator.serviceWorker.controller), 'der Service Worker kontrolliert die Seite');

// --- 1. Eine 503 ersetzt nicht die gute Fassung ---------------------------
modus = 'kaputt';
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(500);
check(await appDa(), 'bei einer 503 zeigt der Worker die letzte gute Fassung statt der Fehlerseite');
modus = 'gut';
await vornZu();
await page.reload({ waitUntil: 'load' }).catch(() => {});
await page.waitForTimeout(700);
check(await appDa(), 'und ohne Server geht die App danach weiterhin auf');

// --- 2. „App aktualisieren" ohne Netz räumt nichts ab ---------------------
await page.locator('.tab[data-tab="settings"]').click();
await page.waitForTimeout(300);
const vorher = await page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length);
await page.locator('[data-act="force-update"]').click();
await page.waitForTimeout(1200);
const nachher = await page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length);
check(vorher > 0 && nachher === vorher, `ohne Netz bleibt der Worker angemeldet (${vorher} → ${nachher})`);
check(/keine Verbindung/i.test(await page.locator('body').innerText()), 'und die App sagt, warum nichts passiert');
await vornAuf();

// --- 3.–5. Import ----------------------------------------------------------
await page.evaluate(async () => {
  const s = await import('./js/store.js');
  const { PLAN } = await import('./js/data.js');
  s.setSetting('share', false);
  s.setSetting('deviceId', 'dieses-geraet-1');
  s.updateSet(PLAN[0].n, 'db', PLAN[0].ex[0].id, 3, 0, { done: true, w: '20' });
});
const datei = JSON.stringify({
  log: {}, focus: 'standard', share: true, deviceId: 'fremdes-geraet-9',
  customs: [{ id: 'c1" onmouseover="window.__x=1', name: '<b>x</b>', ex: [{ id: 'hip-thrust', sets: 3 }] },
    { id: 'c2', name: 'Gut', ex: [{ id: 'sz-curls', sets: 'viele' }, 7, null] }],
});
let dialog = null;
page.once('dialog', (d) => { dialog = d.message(); d.dismiss(); });
await page.evaluate((t) => { document.getElementById('io').value = t; }, datei);
await page.locator('[data-act="import"]').click();
await page.waitForTimeout(400);
check(dialog && /ersetzt/.test(dialog), 'vor dem Import mit vorhandenem Verlauf wird gefragt');
const unberuehrt = await page.evaluate(async () => Object.keys((await import('./js/store.js')).getState().log).length);
check(unberuehrt > 0, 'abgebrochen heißt: der Verlauf ist unberührt');

page.once('dialog', (d) => d.accept());
await page.locator('[data-act="import"]').click();
await page.waitForTimeout(600);
const nachImport = await page.evaluate(async () => {
  const s = await import('./js/store.js');
  const st = s.getState();
  return { share: st.share, id: st.deviceId, customs: st.customs, log: Object.keys(st.log).length,
    zurueck: !!s.vorImport() };
});
check(nachImport.log === 0, 'bestätigt heißt: der eingelesene Stand gilt');
check(nachImport.share === false && nachImport.id === 'dieses-geraet-1',
  'die abgeschaltete Telemetrie und die Gerätekennung kommen nicht aus der Datei');
check(nachImport.customs.length === 1 && nachImport.customs[0].id === 'c2'
  && nachImport.customs[0].ex.length === 1 && nachImport.customs[0].ex[0].sets === 3,
  `eigene Workouts werden auf ihre Felder gebracht (${JSON.stringify(nachImport.customs)})`);
check(nachImport.zurueck, 'der bisherige Stand liegt beiseite');
check(await page.locator('[data-act="vor-import-zurueck"]').count() === 1, 'und unter Mehr steht der Knopf zum Zurückholen');
page.once('dialog', (d) => d.accept());
await page.locator('[data-act="vor-import-zurueck"]').click();
await page.waitForTimeout(600);
const zurueck = await page.evaluate(async () => Object.keys((await import('./js/store.js')).getState().log).length);
check(zurueck > 0, 'nach dem Zurückholen ist der alte Verlauf wieder da');

// Anderer Fokus: danach läuft der Plan dieses Fokus, nicht der alte.
page.once('dialog', (d) => d.accept());
await page.evaluate(() => {
  document.getElementById('io').value = JSON.stringify({ log: {}, focus: 'cut' });
});
await Promise.all([
  page.waitForNavigation({ waitUntil: 'networkidle' }).catch(() => {}),
  page.locator('[data-act="import"]').click(),
]);
await page.waitForTimeout(500);
const fokus = await page.evaluate(async () => (await import('./js/data.js')).FOCUS.name);
check(/Cut/.test(fokus), `nach einem Import mit anderem Fokus gilt dessen Plan (${fokus})`);

// --- 6. Zwei Fenster ------------------------------------------------------
// Fenster A ist offen, Fenster B hakt drei Sätze ab – danach tippt A etwas
// ganz anderes. Vorher schrieb A dabei seinen veralteten Stand als Ganzes
// zurück, und die drei Sätze aus B waren weg.
const b = await ctx.newPage();
await b.goto(URL, { waitUntil: 'networkidle' });
await page.reload({ waitUntil: 'networkidle' });
await b.evaluate(async () => {
  const s = await import('./js/store.js');
  const { PLAN } = await import('./js/data.js');
  for (let i = 0; i < 3; i++) s.updateSet(PLAN[1].n, 'db', PLAN[1].ex[0].id, 3, i, { done: true, w: '30' });
  s.flush();
});
await page.waitForTimeout(1500);
await page.evaluate(async () => {
  const s = await import('./js/store.js');
  const { PLAN } = await import('./js/data.js');
  s.updateSet(PLAN[2].n, 'db', PLAN[2].ex[0].id, 3, 0, { done: true, w: '12' });
  s.flush();
});
await page.waitForTimeout(500);
await b.reload({ waitUntil: 'networkidle' });
const beide = await b.evaluate(async () => {
  const s = await import('./js/store.js');
  const { PLAN } = await import('./js/data.js');
  const z = (n, id) => ((((s.getState().log[n] || {}).db || {})[id]) || []).filter((x) => x.done).length;
  return { ausB: z(PLAN[1].n, PLAN[1].ex[0].id), ausA: z(PLAN[2].n, PLAN[2].ex[0].id) };
});
check(beide.ausB === 3 && beide.ausA === 1,
  `ein Tipp im anderen Fenster überschreibt nichts (aus B ${beide.ausB}/3, aus A ${beide.ausA}/1)`);
await b.close();

// --- 7. Alles löschen bei abgeschaltetem Teilen ---------------------------
anfragen.length = 0;
await page.evaluate(async () => {
  const s = await import('./js/store.js');
  s.setSetting('share', false);
  s.setSetting('deviceId', 'weg-damit-7');
  s.setSetting('lastShare', { on: '2026-09-20', ok: true, msg: '' });
  // Auf localhost meldet die App nur mit ausdrücklicher Erlaubnis.
  localStorage.setItem('workout.rueckkanal.lokal', '1');
});
await page.locator('.tab[data-tab="settings"]').click();
await page.waitForTimeout(300);
page.once('dialog', (d) => d.accept());
await page.locator('[data-act="reset-all"]').click();
await page.waitForTimeout(800);
check(anfragen.some((u) => /entferne/.test(u)),
  'auch bei abgeschaltetem Teilen wird die Server-Zeile gelöscht, wenn je gemeldet wurde');

check(errs.length === 0, `keine Fehler${errs.length ? ': ' + errs.slice(0, 2).join(' | ') : ''}`);
await browser.close();
await vornZu();
hinten.close();
console.log(`\n${fails ? fails + ' FEHLER' : 'alle Prüfungen bestanden'}`);
