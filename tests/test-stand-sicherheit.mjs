/*
 * Ein geschickter Stand darf nichts ausführen.
 *
 * Gefunden bei der Durchsicht der ganzen App, als einziger Befund der Stufe
 * „kritisch": Der Stand-Link (#stand=…) trägt ein JSON-Objekt, das jemand
 * anders gebaut hat. Geprüft wurden nur Version und Name, die Zahlen gingen
 * roh in die Seite und in den Speicher. Ein Link, in dem statt einer Zahl ein
 * <img onerror=…> stand, lief als Skript – beim Öffnen und nach dem
 * Übernehmen bei jedem Blick in die Statistik wieder.
 *
 * Geprüft werden alle drei Wege, auf denen so ein Stand hereinkommt:
 *   1. der Link selbst,
 *   2. ein schon gespeicherter Freund aus einer Fassung vor der Säuberung,
 *   3. eine Sicherungsdatei.
 * Und die Gegenprobe: Ein ehrlicher Stand kommt vollständig an.
 */
import { chromium } from 'playwright';
import { URL } from './umgebung.mjs';

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 414, height: 896 } });
await ctx.route('**/rest/v1/**', (r) => r.fulfill({ status: 204, body: '' }));
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message));
let fails = 0;
const check = (c, m) => { console.log(`${c ? 'OK  ' : 'FAIL'} ${m}`); if (!c) { fails++; process.exitCode = 1; } };

const NUTZLAST = '<img src=x onerror="window.__xss=(window.__xss||0)+1">';
const code = (obj) => Buffer.from(JSON.stringify(obj), 'utf8').toString('base64')
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const boese = {
  v: 1, n: 'Mallory', w: NUTZLAST, s: NUTZLAST, p: NUTZLAST, r: NUTZLAST,
  kg: NUTZLAST, d: NUTZLAST, f: NUTZLAST, z: NUTZLAST,
};

await page.goto(URL, { waitUntil: 'networkidle' });
await page.evaluate(async () => {
  const s = await import('./js/store.js');
  s.setSetting('greeted', true);
  s.setSetting('name', 'T');
  s.setSetting('tab', 'dashboard');
});

// --- 1. Der Link ---------------------------------------------------------
await page.goto(URL.replace(/#.*$/, '') + '#stand=' + code(boese), { waitUntil: 'networkidle' });
await page.waitForTimeout(600);
check(!(await page.evaluate(() => window.__xss)), 'ein präparierter Link führt beim Öffnen nichts aus');
const angebot = (await page.locator('body').innerText()).includes('Mallory');
check(angebot, 'der Name kommt trotzdem an – abgewiesen wird die Nutzlast, nicht der Stand');

const nachUebernahme = await page.evaluate(async () => {
  const s = await import('./js/store.js');
  return s.getState().friends;
});
// Übernehmen wie über den Knopf: auf dem Dashboard, sofern er da ist.
const knopf = page.locator('[data-act="accept-stand"]').first();
if (await knopf.count()) {
  await knopf.click();
  await page.waitForTimeout(400);
}
await page.evaluate(async () => (await import('./js/store.js')).setSetting('tab', 'stats'));
await page.waitForTimeout(500);
check(!(await page.evaluate(() => window.__xss)), 'auch nach dem Übernehmen, in der Statistik, nichts');
const gespeichert = await page.evaluate(async () => Object.values((await import('./js/store.js')).getState().friends));
const roh = JSON.stringify(gespeichert);
check(!/[<>]/.test(roh), `im Speicher steht keine Nutzlast (${gespeichert.length} Freund(e))`);
void nachUebernahme;

// --- 2. Ein alter, schon gespeicherter Freund ---------------------------
await page.evaluate((b) => {
  const k = 'workout.state.v1';
  const st = JSON.parse(localStorage.getItem(k) || '{}');
  st.friends = { alt: { ...b, am: '2026-09-01' }, 'x"><b': { ...b } };
  st.tab = 'stats';
  localStorage.setItem(k, JSON.stringify(st));
}, boese);
await page.goto(URL.replace(/#.*$/, ''), { waitUntil: 'networkidle' });
await page.waitForTimeout(600);
check(!(await page.evaluate(() => window.__xss)), 'ein vor der Säuberung gespeicherter Stand führt beim Laden nichts aus');
const alt = await page.evaluate(async () => (await import('./js/store.js')).getState().friends);
check(!/[<>]/.test(JSON.stringify(alt)), 'und wird beim Laden entschärft');
check(!Object.keys(alt).some((k) => /[<>"]/.test(k)), 'Schlüssel mit HTML-Zeichen fallen weg');

// --- 3. Eine Sicherungsdatei --------------------------------------------
const importiert = await page.evaluate(async (b) => {
  const s = await import('./js/store.js');
  s.importJSON(JSON.stringify({ log: {}, friends: { m: b } }));
  return s.getState().friends;
}, boese);
check(!/[<>]/.test(JSON.stringify(importiert)), 'eine Sicherung mit präpariertem Freund wird beim Einlesen entschärft');

// --- 4. Gegenprobe: ein ehrlicher Stand ---------------------------------
const ehrlich = { v: 1, n: 'Anna', w: 12, s: 180, kg: 5400, r: 3, p: 84, d: '2026-09-20', f: 'Cut', z: '2026-09-19' };
const zurueck = await page.evaluate(async (e) => (await import('./js/store.js')).normStand(e), ehrlich);
check(JSON.stringify(zurueck) === JSON.stringify(ehrlich),
  'ein ehrlicher Stand kommt Feld für Feld unverändert an');

check(errs.length === 0, `keine Fehler${errs.length ? ': ' + errs.slice(0, 2).join(' | ') : ''}`);
await browser.close();
console.log(`\n${fails ? fails + ' FEHLER' : 'alle Prüfungen bestanden'}`);
