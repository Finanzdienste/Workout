/*
 * Mahlzeit: ohne Netz – und neben der Workout-App im selben Ursprung.
 *
 * Erst ohne Browser: Jede Datei der App steht in SHELL (mahlzeit/sw.js),
 * jeder Eintrag dort gibt es, jeder Import zeigt auf eine vorhandene Datei,
 * und VERSION passt zu FASSUNG in js/app.js. Dann im Browser, mit eigenem
 * Server, der wirklich ausgeht (Playwrights Offline-Schalter schneidet den
 * Service Worker nicht ab, siehe test-sd-offline.mjs):
 *
 *   1. Nur die Workout-App war offen, Server aus: Unter /mahlzeit/ darf ihr
 *      Worker nicht die Workout-App ausliefern (die Ausnahme in ../sw.js,
 *      v264 – vorher kam genau das).
 *   2. Mahlzeit einmal geladen, Server aus: Sie öffnet mit ihren Einträgen.
 *   3. Die Workout-App daneben auch – keiner hat den Vorrat des anderen
 *      geräumt.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { uhrStellen } from './sd-hilfe.mjs';
import { ROOT } from './umgebung.mjs';
import { starte } from './server.mjs';
import { pruefer, SCHLUESSEL } from './mz-hilfe.mjs';

const { check, ende } = pruefer();
const ORDNER = path.join(ROOT, 'mahlzeit');
const sw = readFileSync(path.join(ORDNER, 'sw.js'), 'utf8');
const shell = [...sw.match(/const SHELL = \[(.*?)\];/s)[1].matchAll(/'\.\/([^']*)'/g)].map((m) => m[1]);
const version = sw.match(/const VERSION = '([^']+)'/)[1];

// --- Ohne Browser
const module = readdirSync(path.join(ORDNER, 'js')).filter((f) => f.endsWith('.js'));
const fehlt = module.filter((f) => !shell.includes(`js/${f}`));
check(!fehlt.length, `jedes Modul unter mahlzeit/js steht in SHELL${fehlt.length ? ` – es fehlen: ${fehlt.join(', ')}` : ''}`);
const tot = shell.filter((f) => f && !existsSync(path.join(ORDNER, f)));
check(!tot.length, `jeder Eintrag in SHELL gibt es als Datei${tot.length ? ` – nicht da: ${tot.join(', ')}` : ''}`);
const kaputt = [];
module.forEach((f) => {
  const src = readFileSync(path.join(ORDNER, 'js', f), 'utf8');
  [...src.matchAll(/^\s*import\s+(?:[^;]+?\s+from\s+)?'\.\/([\w.-]+)';/gm)].forEach((m) => {
    if (!module.includes(m[1])) kaputt.push(`${f} → ${m[1]}`);
  });
});
check(!kaputt.length, `jeder Import zeigt auf eine vorhandene Datei${kaputt.length ? `: ${kaputt.join(', ')}` : ''}`);
const fassung = readFileSync(path.join(ORDNER, 'js', 'app.js'), 'utf8').match(/export const FASSUNG = '([^']+)'/)?.[1];
check(fassung === version, `FASSUNG in js/app.js (${fassung}) = VERSION in sw.js (${version})`);
const manifest = JSON.parse(readFileSync(path.join(ORDNER, 'manifest.webmanifest'), 'utf8'));
check(manifest.icons.every((i) => existsSync(path.join(ORDNER, i.src))), 'jedes Symbol aus dem Manifest gibt es');
check(manifest.start_url === '.' && manifest.scope === '.' && manifest.lang === 'de', 'Manifest: deutsch, startet und gilt im eigenen Ordner');
check(/startsWith\('mahlzeit-'\)/.test(sw.match(/addEventListener\('activate'[\s\S]*?\n\}\);/)[0]), 'der Worker räumt nur Vorräte weg, die mit „mahlzeit-" beginnen');
const workoutSw = readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
check(/startsWith\('workout-'\)/.test(workoutSw.match(/addEventListener\('activate'[\s\S]*?\n\}\);/)[0]), 'der Workout-Worker räumt nur Vorräte, die mit „workout-" beginnen');

// --- Im Browser
const PORT = 8114;
const BASIS = `http://127.0.0.1:${PORT}`;
let server = await starte(PORT, 0);
const aus = () => new Promise((fertig) => { server.closeAllConnections(); server.close(() => fertig()); });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'de-DE' });
await ctx.addInitScript(uhrStellen);
const page = await ctx.newPage();
const fehler = [];
page.on('pageerror', (e) => fehler.push(e.message));

// 1. Erst nur die Workout-App: Ihr Worker gilt für den ganzen Ursprung.
await page.goto(`${BASIS}/index.html`, { waitUntil: 'networkidle' });
await page.evaluate(() => navigator.serviceWorker.ready);
await page.reload({ waitUntil: 'networkidle' });
check(await page.evaluate(() => !!navigator.serviceWorker.controller), 'der Workout-Worker steuert die Workout-App');
await aus();
const probe = await ctx.newPage();
const fremd = await probe.goto(`${BASIS}/mahlzeit/index.html`).then(() => probe.title()).catch(() => 'Netzfehler');
check(fremd !== 'Workout', `offline, ohne eigenen Worker: unter /mahlzeit/ keine Workout-App (${fremd})`);
const fremd2 = await probe.goto(`${BASIS}/mahlzeit/`).then(() => probe.title()).catch(() => 'Netzfehler');
check(fremd2 !== 'Workout', `… auch nicht unter /mahlzeit/ mit Schrägstrich (${fremd2})`);
await probe.close();
server = await starte(PORT, 0);

// 2. Mahlzeit laden, etwas eintragen, Worker übernehmen lassen.
await page.goto(`${BASIS}/mahlzeit/`, { waitUntil: 'networkidle' });
await page.evaluate((key) => {
  localStorage.setItem('__testtag', '2026-11-17');
  localStorage.setItem(key, JSON.stringify({ v: 1, tage: { '2026-11-17': [{ id: 'e1', f: 'broetchen', n: 'Brötchen', p: '1 Stück', m: 1, kcal: 140, kh: 27, z: 'morgens' }] } }));
}, SCHLUESSEL);
await page.evaluate(() => navigator.serviceWorker.ready);
await page.reload({ waitUntil: 'networkidle' });
const scope = await page.evaluate(async () => (await navigator.serviceWorker.getRegistration())?.scope);
check(scope && scope.endsWith('/mahlzeit/'), `der Worker gilt nur für den eigenen Ordner (${scope})`);
check(await page.evaluate(() => !!navigator.serviceWorker.controller), 'nach dem Neuladen steuert er die Seite');
const imVorrat = await page.evaluate(async (v) => (await (await caches.open(`mahlzeit-${v}`)).keys()).length, version);
check(imVorrat === shell.length, `im Vorrat liegen alle ${shell.length} Dateien (${imVorrat})`);
const vorraete = await page.evaluate(() => caches.keys());
check(vorraete.some((k) => k.startsWith('workout-')) && vorraete.some((k) => k.startsWith('mahlzeit-')), `beide Vorräte nebeneinander (${vorraete.join(', ')})`);

// Server aus.
await aus();
await page.reload({ waitUntil: 'load' });
await page.waitForSelector('html[data-bereit="1"]', { timeout: 5000 }).catch(() => {});
check(await page.title() === 'Mahlzeit', 'ohne Server öffnet Mahlzeit');
check((await page.locator('#summe-kcal').innerText().catch(() => '')) === '140', '… mit dem Brötchen von heute');
await page.click('#essen-knopf');
await page.fill('#suche', 'döner');
check((await page.locator('#trefferliste .sache').first().innerText()).includes('Döner'), '… und die Suche geht auch ohne Netz');
await page.goto(`${BASIS}/index.html`, { waitUntil: 'load' }).catch(() => {});
check(await page.title() === 'Workout', 'die Workout-App daneben öffnet offline ebenso');

check(fehler.length === 0, `keine Fehler in der Seite${fehler.length ? `: ${fehler.slice(0, 2).join(' | ')}` : ''}`);
await browser.close();
ende();
