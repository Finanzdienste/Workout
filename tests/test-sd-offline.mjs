/*
 * Schilddrüse: ohne Netz – und alles, was dafür im Vorrat liegen muss.
 *
 * Zwei Teile. Erst ohne Browser: Jede Datei der App steht in SHELL
 * (schilddruese/sw.js), jeder Eintrag dort gibt es, und jeder Import zeigt auf
 * eine vorhandene Datei. Das ging in der Workout-App zweimal still kaputt.
 * Dann im Browser: einmal laden, Netz weg, neu laden – die App öffnet mit
 * den Daten. Und der Worker räumt nur seine eigenen alten Vorräte weg, nicht
 * den der Workout-App im selben Ursprung.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { oeffne, standMit, plus } from './sd-hilfe.mjs';
import { ROOT } from './umgebung.mjs';

const ORDNER = path.join(ROOT, 'schilddruese');
const sw = readFileSync(path.join(ORDNER, 'sw.js'), 'utf8');
const shell = [...sw.match(/const SHELL = \[(.*?)\];/s)[1].matchAll(/'\.\/([^']*)'/g)].map((m) => m[1]);
const version = sw.match(/const VERSION = '([^']+)'/)[1];

const TAG = '2026-03-10';
const { page, ctx, check, ende } = await oeffne({ tag: TAG, stand: standMit(plus(TAG, -3), { einnahmen: { [TAG]: { uhr: '07:10' } } }) });

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
const manifest = JSON.parse(readFileSync(path.join(ORDNER, 'manifest.webmanifest'), 'utf8'));
check(manifest.icons.every((i) => existsSync(path.join(ORDNER, i.src))), 'jedes Symbol aus dem Manifest gibt es');
check(manifest.lang === 'de' && manifest.start_url === '.', 'Manifest: deutsch, startet im eigenen Ordner');

// Ein Vorrat der Workout-App im selben Ursprung – der muss stehen bleiben.
await page.evaluate(() => caches.open('workout-v999').then((c) => c.put('/probe', new Response('x'))));

// Worker installieren und die Seite übernehmen lassen.
await page.evaluate(() => navigator.serviceWorker.ready);
await page.reload({ waitUntil: 'networkidle' });
const scope = await page.evaluate(async () => (await navigator.serviceWorker.getRegistration())?.scope);
check(scope && scope.endsWith('/schilddruese/'), `der Worker gilt nur für den eigenen Ordner (${scope})`);
check(await page.evaluate(() => !!navigator.serviceWorker.controller), 'nach dem Neuladen steuert der Worker die Seite');
const imVorrat = await page.evaluate(async (v) => (await (await caches.open(`schilddruese-${v}`)).keys()).length, version);
check(imVorrat >= shell.length - 1, `im Vorrat liegen ${imVorrat} von ${shell.length} Dateien`);
check(await page.evaluate(() => caches.has('workout-v999')), 'der Vorrat der Workout-App bleibt unangetastet');

// Ohne Netz.
await ctx.setOffline(true);
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(300);
check(await page.locator('.tablette.genommen').isVisible(), 'ohne Netz öffnet die App, mit dem heutigen Haken');
await page.click('#reiter-mehr');
await page.click('[data-seite="wissen"]');
await page.click('[data-param="notfall"]');
check((await page.locator('#ansicht').innerText()).includes('112'), 'auch das Wissen ist ohne Netz da');
await ctx.setOffline(false);

await ende();
