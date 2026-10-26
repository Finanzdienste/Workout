/*
 * Freizeit: ohne Netz – und alles, was dafür im Vorrat liegen muss.
 *
 * Aufgebaut wie test-sd-offline.mjs. Erst ohne Browser: Jede Datei der App
 * steht in SHELL (freizeit/sw.js), jeden Eintrag dort gibt es, jeder Import
 * zeigt auf eine vorhandene Datei, die Daten stehen nicht darin. Dann im
 * Browser, mit den echten Daten aus freizeit/daten/: einmal laden, Server
 * aus, neu laden – die Woche ist noch da. Und die Worker im selben Ursprung
 * lassen einander in Ruhe.
 *
 * Server aus statt setOffline(): Playwrights Offline-Schalter schneidet die
 * Anfragen des Service Workers nicht ab (siehe test-sd-offline.mjs).
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { uhrStellen } from './sd-hilfe.mjs';
import { ROOT } from './umgebung.mjs';
import { starte } from './server.mjs';

const ORDNER = path.join(ROOT, 'freizeit');
const sw = readFileSync(path.join(ORDNER, 'sw.js'), 'utf8');
const shell = [...sw.match(/const SHELL = \[(.*?)\];/s)[1].matchAll(/'\.\/([^']*)'/g)].map((m) => m[1]);
const version = sw.match(/const VERSION = '([^']+)'/)[1];
// Der Tag kommt aus den echten Daten, damit der Test jede Woche passt.
const { von: TAG } = JSON.parse(readFileSync(path.join(ORDNER, 'daten', 'woche.json'), 'utf8'));

const PORT = 8113;
const BASIS = `http://127.0.0.1:${PORT}`;
let server = await starte(PORT, 0);
const aus = () => new Promise((fertig) => { server.closeAllConnections(); server.close(() => fertig()); });

let fails = 0;
let oks = 0;
const check = (c, m) => { console.log(`${c ? 'OK  ' : 'FAIL'} ${m}`); if (c) oks++; else { fails++; process.exitCode = 1; } };

// --- Ohne Browser
const module = readdirSync(path.join(ORDNER, 'js')).filter((f) => f.endsWith('.js'));
const fehlt = module.filter((f) => !shell.includes(`js/${f}`));
check(!fehlt.length, `jedes Modul unter freizeit/js steht in SHELL${fehlt.length ? ` – es fehlen: ${fehlt.join(', ')}` : ''}`);
const tot = shell.filter((f) => f && !existsSync(path.join(ORDNER, f)));
check(!tot.length, `jeden Eintrag in SHELL gibt es als Datei${tot.length ? ` – nicht da: ${tot.join(', ')}` : ''}`);
check(!shell.some((f) => f.startsWith('daten/')), 'die Daten stehen nicht in SHELL – ein Datenlauf muss sw.js nicht anfassen');
const kaputt = [];
module.forEach((f) => {
  const src = readFileSync(path.join(ORDNER, 'js', f), 'utf8');
  [...src.matchAll(/^\s*import\s+(?:[^;]+?\s+from\s+)?'\.\/([\w.-]+)';/gm)].forEach((m) => {
    if (!module.includes(m[1])) kaputt.push(`${f} → ${m[1]}`);
  });
});
check(!kaputt.length, `jeder Import zeigt auf eine vorhandene Datei${kaputt.length ? `: ${kaputt.join(', ')}` : ''}`);
const html = readFileSync(path.join(ORDNER, 'index.html'), 'utf8');
const verweise = [...html.matchAll(/(?:href|src)="(?!https?:|#|data:)([^"]+)"/g)].map((m) => m[1].replace(/^\.\//, ''));
const ohneVorrat = verweise.filter((v) => !shell.includes(v));
check(verweise.length >= 4 && !ohneVorrat.length, `alles, was index.html lädt, steht in SHELL${ohneVorrat.length ? ` – nicht: ${ohneVorrat.join(', ')}` : ''}`);
const aufraeumen = (quelle) => quelle.match(/addEventListener\('activate'[\s\S]*?\n\}\);/)[0];
check(/startsWith\('freizeit-'\)/.test(aufraeumen(sw)), 'der Freizeit-Worker löscht beim Aktualisieren nur Vorräte, die mit „freizeit-“ beginnen');
const workoutSw = readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
check(/startsWith\('workout-'\)/.test(aufraeumen(workoutSw)), 'der Workout-Worker löscht nur Vorräte, die mit „workout-“ beginnen');
check(/url\.pathname\.startsWith\(new URL\('\.\/freizeit', self\.location\)\.pathname\)\) return;/.test(workoutSw), 'der Workout-Worker lässt Anfragen unter /freizeit durch');
const manifest = JSON.parse(readFileSync(path.join(ORDNER, 'manifest.webmanifest'), 'utf8'));
check(manifest.icons.every((i) => existsSync(path.join(ORDNER, i.src))), 'jedes Symbol aus dem Manifest gibt es');
check(manifest.lang === 'de' && manifest.start_url === '.' && manifest.scope === '.', 'Manifest: deutsch, startet und bleibt im eigenen Ordner');
check(manifest.icons.some((i) => i.purpose === 'maskable') && manifest.icons.some((i) => i.sizes === '512x512'), 'Manifest: Symbol in 512 px, auch als „maskable“');

// --- Im Browser
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'de-DE' });
await ctx.addInitScript(uhrStellen);
const page = await ctx.newPage();
const fehler = [];
page.on('pageerror', (e) => fehler.push(e.message));

// Erst die Workout-App: Ihr Worker gilt für den ganzen Ursprung.
await page.goto(`${BASIS}/index.html`, { waitUntil: 'networkidle' });
await page.evaluate(() => navigator.serviceWorker.ready);
await page.reload({ waitUntil: 'networkidle' });
check(await page.evaluate(() => !!navigator.serviceWorker.controller), 'der Workout-Worker steuert die Workout-App');

// Ohne eigenen Worker und ohne Server darf unter der Freizeit-Adresse nicht
// die Workout-App erscheinen.
await aus();
const probe = await ctx.newPage();
const fremd = await probe.goto(`${BASIS}/freizeit/index.html`).then(() => probe.title()).catch(() => 'Netzfehler');
check(fremd !== 'Workout', `offline, ohne eigenen Worker: keine fremde App unter der Freizeit-Adresse (${fremd})`);
await probe.close();
server = await starte(PORT, 0);

// Jetzt die Freizeit-App.
await page.goto(`${BASIS}/freizeit/index.html`, { waitUntil: 'networkidle' });
await page.evaluate((tag) => { localStorage.setItem('__testtag', tag); localStorage.setItem('__testzeit', '10:00'); }, TAG);
const eigener = await page.evaluate(async () => {
  for (let i = 0; i < 100; i++) {
    const r = await navigator.serviceWorker.getRegistration();
    if (r && r.scope.endsWith('/freizeit/') && r.active && r.active.state === 'activated') return r.scope;
    await new Promise((f) => { setTimeout(f, 100); });
  }
  return null;
});
check(Boolean(eigener), `der eigene Worker ist aktiv und gilt nur für den eigenen Ordner (${eigener})`);
await page.reload({ waitUntil: 'networkidle' });
const steuert = await page.evaluate(() => navigator.serviceWorker.controller?.scriptURL || '');
check(steuert.endsWith('/freizeit/sw.js'), `nach dem Neuladen steuert der eigene Worker die Seite (${steuert})`);
await page.waitForFunction(() => document.querySelectorAll('#ansicht .karte').length > 0);
const karten = await page.locator('#ansicht .karte').count();
const tage = await page.locator('#ansicht .tag').count();
check(karten > 0 && tage > 0, `mit Netz: die Woche ist da (${tage} Tage, ${karten} Karten)`);
// Merken, solange das Netz noch da ist.
await page.locator('#ansicht .karte [data-merken]').first().click();

const vorrat = await page.evaluate(async (v) => {
  for (let i = 0; i < 50; i++) {
    const keys = (await (await caches.open(`freizeit-${v}`)).keys()).map((r) => new URL(r.url).pathname);
    if (keys.some((k) => k.endsWith('/daten/woche.json')) && keys.some((k) => k.endsWith('/daten/konzerte.json'))) return keys;
    await new Promise((f) => { setTimeout(f, 100); });
  }
  return (await (await caches.open(`freizeit-${v}`)).keys()).map((r) => new URL(r.url).pathname);
}, version);
check(vorrat.filter((k) => !k.includes('/daten/')).length >= shell.length - 1, `im Vorrat liegt die App (${vorrat.length} Dateien, SHELL hat ${shell.length})`);
check(vorrat.some((k) => k.endsWith('/daten/woche.json')) && vorrat.some((k) => k.endsWith('/daten/konzerte.json')), 'die zuletzt geladenen Daten liegen ebenfalls im Vorrat');
const vorraete = await page.evaluate(() => caches.keys());
check(vorraete.some((k) => k.startsWith('workout-')) && vorraete.some((k) => k.startsWith('freizeit-')), `beide Vorräte liegen nebeneinander (${vorraete.join(', ')})`);

// Server aus – jetzt kommt alles aus dem Vorrat oder gar nicht.
await aus();
await page.reload({ waitUntil: 'load' });
await page.waitForFunction(() => !document.querySelector('#ansicht').textContent.includes('Lädt'), null, { timeout: 5000 }).catch(() => {});
check(await page.title() === 'Freizeit', 'ohne Server öffnet die Freizeit-App');
check(await page.locator('#ansicht .karte').count() === karten, 'ohne Server: dieselbe Woche wie eben');
check(!(await page.locator('#ansicht').innerText()).includes('Keine Wochendaten') && await page.locator('.datenfehler').count() === 0, 'ohne Server: keine Fehlermeldung zu den Daten');
await page.click('[data-reiter="merkliste"]');
check(await page.locator('#ansicht .karte').count() === 1, 'ohne Server: die Merkliste mit dem gemerkten Eintrag');
await page.click('[data-reiter="konzerte"]');
check(await page.locator('#ansicht h2, #ansicht .leer').count() > 0, 'ohne Server: auch der Reiter Konzerte zeichnet');
await page.goto(`${BASIS}/index.html`, { waitUntil: 'load' }).catch(() => {});
check(await page.title() === 'Workout', 'und die Workout-App daneben ebenso – keiner hat den Vorrat des anderen geräumt');

check(fehler.length === 0, `keine Fehler in der Seite${fehler.length ? `: ${fehler.slice(0, 2).join(' | ')}` : ''}`);
await browser.close();
process.exit(fails || !oks ? 1 : 0);
