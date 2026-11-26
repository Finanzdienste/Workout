/*
 * Meine Apps ist umgezogen (a6): https://finanzdienste.github.io/Apps/, Repo
 * Finanzdienste/Apps – dort liegen App und Test (tests/test-apps.mjs).
 *
 * Tobi, 26.11.2026: „Ich will die Master Übersicht als App auf mein Handy
 * downloaden aber nicht aufm startbildschirm haben“. Unter /Workout/apps/
 * hätte Android sie nicht als eigene App installiert (die Workout-App ist
 * installiert). Hier bleibt nur die Weiterleitung. Geprüft:
 *
 *   1. /apps/ leitet nach /Apps/ weiter, samt allem hinter dem #, und räumt
 *      die alten Vorräte (apps-…) weg – fremde bleiben.
 *   2. Der alte Worker (apps/sw.js) meldet sich selbst ab und räumt auf.
 *   3. Der Workout-Worker liefert unter /apps/ offline nicht die Workout-App.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { ROOT } from './umgebung.mjs';
import { starte } from './server.mjs';
import { pruefer } from './mz-hilfe.mjs';

const { check, ende } = pruefer();

const workoutSw = readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
check(/startsWith\(new URL\('\.\/apps', self\.location\)\.pathname\)\) return;/.test(workoutSw), 'der Workout-Worker lässt /apps in Ruhe');
const html = readFileSync(path.join(ROOT, 'apps', 'index.html'), 'utf8');
check(html.includes('location.replace(`https://finanzdienste.github.io/Apps/${location.hash}`)') && html.includes('url=https://finanzdienste.github.io/Apps/'),
  'die Weiterleitung zeigt auf /Apps/, mit Skript und ohne');

const PORT = 8147;
const BASIS = `http://127.0.0.1:${PORT}`;
let server = await starte(PORT, 0);
const aus = () => new Promise((fertig) => { server.closeAllConnections(); server.close(() => fertig()); });
const browser = await chromium.launch();
const fehler = [];

async function kontext() {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'de-DE' });
  // Die neue Adresse spielen – ins echte Netz geht der Test nicht.
  await ctx.route('https://finanzdienste.github.io/**', (r) => r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: '<!doctype html><title>Meine Apps (neu)</title><p>neu</p>' }));
  await ctx.route(/supabase\.co/, (r) => r.abort());
  return ctx;
}
const vorraete = (p) => p.evaluate(() => caches.keys());

// 1. Die Weiterleitung
let ctx = await kontext();
let page = await ctx.newPage();
page.on('pageerror', (e) => fehler.push(e.message));
await page.goto(`${BASIS}/index.html`, { waitUntil: 'load' });
await page.evaluate(async () => { await caches.open('apps-a5'); await caches.open('apps-bilder'); await caches.open('fremd-v1'); });
await page.goto(`${BASIS}/apps/#apps=probe`);
await page.waitForURL('https://finanzdienste.github.io/Apps/#apps=probe', { timeout: 10000 }).catch(() => null);
check(page.url() === 'https://finanzdienste.github.io/Apps/#apps=probe' && await page.title() === 'Meine Apps (neu)', `/apps/ leitet nach /Apps/ weiter, samt # (${page.url()})`);
await page.goto(`${BASIS}/index.html`, { waitUntil: 'load' });
const nachher = await vorraete(page);
check(!nachher.some((k) => k.startsWith('apps-')) && nachher.includes('fremd-v1'), `die alten Vorräte sind weg, fremde bleiben (${nachher.join(', ')})`);
await ctx.close();

// 2. Der alte Worker meldet sich selbst ab
ctx = await kontext();
page = await ctx.newPage();
page.on('pageerror', (e) => fehler.push(e.message));
await page.goto(`${BASIS}/index.html`, { waitUntil: 'load' });
await page.evaluate(async () => { await caches.open('apps-a4'); await caches.open('fremd-v2'); });
await page.evaluate(() => navigator.serviceWorker.register('./apps/sw.js', { scope: './apps/' }));
let weg = false;
for (let i = 0; i < 50 && !weg; i++) {
  await page.waitForTimeout(100);
  weg = await page.evaluate(async () => !(await navigator.serviceWorker.getRegistrations()).some((r) => new URL(r.scope).pathname === '/apps/'));
}
const v2 = await vorraete(page);
check(weg && !v2.includes('apps-a4') && v2.includes('fremd-v2'), `der alte Worker meldet sich ab und räumt nur seine Vorräte weg (${v2.join(', ')})`);
await ctx.close();

// 3. Offline: Der Workout-Worker liefert unter /apps/ nicht die Workout-App
ctx = await kontext();
page = await ctx.newPage();
await page.goto(`${BASIS}/index.html`, { waitUntil: 'networkidle' });
await page.evaluate(() => navigator.serviceWorker.ready);
await page.reload({ waitUntil: 'networkidle' });
const workoutTitel = await page.title();
check(await page.evaluate(() => !!navigator.serviceWorker.controller), 'der Workout-Worker steuert die Workout-App');
await aus();
const fremd = await page.goto(`${BASIS}/apps/`).then(() => page.title()).catch(() => 'Netzfehler');
check(fremd !== workoutTitel, `offline: unter /apps/ keine Workout-App (${fremd})`);
server = await starte(PORT, 0);
await ctx.close();

check(!fehler.length, `keine Fehler in der Seite${fehler.length ? `: ${fehler.join(' | ')}` : ''}`);
await browser.close();
await aus();
ende();
