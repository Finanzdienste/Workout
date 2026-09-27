/*
 * Schilddrüse: ohne Netz – und alles, was dafür im Vorrat liegen muss.
 *
 * Zwei Teile. Erst ohne Browser: Jede Datei der App steht in SHELL
 * (schilddruese/sw.js), jeder Eintrag dort gibt es, und jeder Import zeigt auf
 * eine vorhandene Datei. Das ging in der Workout-App zweimal still kaputt.
 * Dann im Browser: einmal laden, Server aus, neu laden – die App öffnet mit
 * den Daten. Und die beiden Worker im selben Ursprung lassen einander in Ruhe.
 *
 * **Server aus, nicht setOffline().** Playwrights Offline-Schalter schneidet
 * die Anfragen des Service Workers nicht ab – bei der Durchsicht nachgewiesen:
 * Mit leerem Vorrat und „offline" kam die App trotzdem, frisch vom Server.
 * Die Prüfung war damit grün, egal was im Vorrat lag. Deshalb startet dieser
 * Test seinen eigenen Server und hält ihn an.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { standMit, plus, SCHLUESSEL, uhrStellen } from './sd-hilfe.mjs';
import { ROOT } from './umgebung.mjs';
import { starte } from './server.mjs';

const ORDNER = path.join(ROOT, 'schilddruese');
const sw = readFileSync(path.join(ORDNER, 'sw.js'), 'utf8');
const shell = [...sw.match(/const SHELL = \[(.*?)\];/s)[1].matchAll(/'\.\/([^']*)'/g)].map((m) => m[1]);
const version = sw.match(/const VERSION = '([^']+)'/)[1];

const TAG = '2026-03-10';
const PORT = 8112;
const BASIS = `http://127.0.0.1:${PORT}`;
let server = await starte(PORT, 0);
const aus = () => new Promise((fertig) => { server.closeAllConnections(); server.close(() => fertig()); });

let fails = 0;
let oks = 0;
const check = (c, m) => { console.log(`${c ? 'OK  ' : 'FAIL'} ${m}`); if (c) oks++; else { fails++; process.exitCode = 1; } };
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
await ctx.addInitScript(uhrStellen);
const page = await ctx.newPage();
const fehler = [];
page.on('pageerror', (e) => fehler.push(e.message));

const module = readdirSync(path.join(ORDNER, 'js')).filter((f) => f.endsWith('.js'));
const fehlt = module.filter((f) => !shell.includes(`js/${f}`));
check(!fehlt.length, `jedes Modul unter schilddruese/js steht in SHELL${fehlt.length ? ` – es fehlen: ${fehlt.join(', ')}` : ''}`);
const tot = shell.filter((f) => f && !existsSync(path.join(ORDNER, f)));
check(!tot.length, `jeder Eintrag in SHELL gibt es als Datei${tot.length ? ` – nicht da: ${tot.join(', ')}` : ''}`);
check(shell.includes('css/styles.css') && shell.includes('manifest.webmanifest') && shell.includes('index.html'), 'Seite, Stil und Manifest stehen im Vorrat');
const kaputt = [];
module.forEach((f) => {
  const src = readFileSync(path.join(ORDNER, 'js', f), 'utf8');
  [...src.matchAll(/^\s*import\s+(?:[^;]+?\s+from\s+)?'\.\/([\w.-]+)';/gm)].forEach((m) => {
    if (!module.includes(m[1])) kaputt.push(`${f} → ${m[1]}`);
  });
});
check(!kaputt.length, `jeder Import zeigt auf eine vorhandene Datei${kaputt.length ? `: ${kaputt.join(', ')}` : ''}`);
// Umgekehrt: Der Worker der Workout-App räumt beim Aktualisieren nur seine
// eigenen Vorräte weg, nicht den dieser App.
const workoutSw = readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
const aufraeumen = workoutSw.match(/addEventListener\('activate'[\s\S]*?\n\}\);/)[0];
check(/startsWith\('workout-'\)/.test(aufraeumen), 'der Workout-Worker löscht beim Aktualisieren nur Vorräte, die mit „workout-" beginnen');
const manifest = JSON.parse(readFileSync(path.join(ORDNER, 'manifest.webmanifest'), 'utf8'));
check(manifest.icons.every((i) => existsSync(path.join(ORDNER, i.src))), 'jedes Symbol aus dem Manifest gibt es');
check(manifest.lang === 'de' && manifest.start_url === '.', 'Manifest: deutsch, startet im eigenen Ordner');

// --- Erst die Workout-App: Ihr Worker gilt für den ganzen Ursprung.
await page.goto(`${BASIS}/index.html`, { waitUntil: 'networkidle' });
await page.evaluate(() => navigator.serviceWorker.ready);
await page.reload({ waitUntil: 'networkidle' });
check(await page.evaluate(() => !!navigator.serviceWorker.controller), 'der Workout-Worker steuert die Workout-App');

// Ohne eigenen Worker und ohne Server: Der Workout-Worker darf unter der
// Adresse der Schilddrüsen-App nicht die Workout-App ausliefern.
await aus();
// In einem eigenen Tab: Die Fehlerseite des Browsers unterbricht sonst die
// nächste Navigation in diesem.
const probe = await ctx.newPage();
const fremd = await probe.goto(`${BASIS}/schilddruese/index.html`).then(() => probe.title()).catch(() => 'Netzfehler');
check(fremd !== 'Workout', `offline, ohne eigenen Worker: keine fremde App unter der Schilddrüsen-Adresse (${fremd})`);
await probe.close();
server = await starte(PORT, 0);

// --- Jetzt die Schilddrüsen-App, mit Daten.
await page.goto(`${BASIS}/schilddruese/index.html`, { waitUntil: 'networkidle' });
await page.evaluate(({ key, st, tag }) => {
  localStorage.setItem('__testtag', tag);
  localStorage.setItem(key, JSON.stringify(st));
}, { key: SCHLUESSEL, st: standMit(plus(TAG, -3), { einnahmen: { [TAG]: { uhr: '07:10' } } }), tag: TAG });

// Worker installieren und die Seite übernehmen lassen.
await page.evaluate(() => navigator.serviceWorker.ready);
await page.reload({ waitUntil: 'networkidle' });
const scope = await page.evaluate(async () => (await navigator.serviceWorker.getRegistration())?.scope);
check(scope && scope.endsWith('/schilddruese/'), `der Worker gilt nur für den eigenen Ordner (${scope})`);
check(await page.evaluate(() => !!navigator.serviceWorker.controller), 'nach dem Neuladen steuert der Worker die Seite');
const imVorrat = await page.evaluate(async (v) => (await (await caches.open(`schilddruese-${v}`)).keys()).length, version);
check(imVorrat >= shell.length - 1, `im Vorrat liegen ${imVorrat} von ${shell.length} Dateien`);
const vorraete = await page.evaluate(() => caches.keys());
check(vorraete.some((k) => k.startsWith('workout-')) && vorraete.some((k) => k.startsWith('schilddruese-')), `beide Vorräte liegen nebeneinander (${vorraete.join(', ')})`);

// Server aus – jetzt kommt alles aus dem Vorrat oder gar nicht.
await aus();
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(300);
check(await page.title() === 'Schilddrüse', 'ohne Server öffnet die Schilddrüsen-App');
check(await page.locator('.tablette.genommen').isVisible(), '… mit dem heutigen Haken');
await page.click('#reiter-mehr');
await page.click('[data-seite="wissen"]');
await page.click('[data-param="notfall"]');
check((await page.locator('#ansicht').innerText()).includes('112'), 'auch das Wissen ist ohne Server da');
await page.goto(`${BASIS}/index.html`, { waitUntil: 'load' }).catch(() => {});
check(await page.title() === 'Workout', 'und die Workout-App daneben ebenso – keiner hat den Vorrat des anderen geräumt');

check(fehler.length === 0, `keine Fehler in der Seite${fehler.length ? `: ${fehler.slice(0, 2).join(' | ')}` : ''}`);
await browser.close();
process.exit(fails || !oks ? 1 : 0);
