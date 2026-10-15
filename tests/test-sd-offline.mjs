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
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
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

// --- Update aus einem unvollständigen Vorrat (C18)
/*
 * Der Worker einer Zwischenfassung hatte nicht alle Module im Vorrat. Beim
 * ersten Öffnen nach dem Update kam das fehlende frisch vom Server, die
 * übrigen alt aus dem Vorrat – sie passten nicht zusammen, die App startete
 * nicht. Das Neuladen nach dem Update stand im Modul, das nicht lief: leere
 * Seite ohne Notfallleiste bis zum nächsten Öffnen.
 *
 * Nachgestellt mit einem eigenen Server: einmal laden, dem Vorrat ein Modul
 * nehmen, dann liefert der Server einen neuen Worker (mit Verzögerung, wie
 * im Netz) und beim ersten Abruf dieses Modul in einer Fassung, die nicht zu
 * den übrigen passt.
 */
const UPDATE_PORT = 8113;
/*
 * Runde 4 (E25, E26) nutzt denselben Server weiter: `fassung` liefert einen
 * Worker mit eigener VERSION, `fehlt` beantwortet eine Datei mit 503 (Abbruch
 * im Mobilnetz), `aus` trennt jede Verbindung (kein Netz). Runde 6 (G1):
 * `inhalt` ändert auch die Module – js/app.js braucht dann etwas, das nur
 * das neue js/text.js hat, wie bei einem echten Update.
 */
const lage = { update: false, unpassend: 0, fassung: null, fehlt: null, aus: false, inhalt: false };
const TYPEN = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png' };
const updateServer = createServer((req, res) => {
  if (lage.aus) { req.socket.destroy(); return; }
  let rel = decodeURIComponent(req.url.split(/[?#]/)[0]);
  if (lage.fehlt && rel === lage.fehlt) { res.writeHead(503, { 'content-type': 'text/plain' }).end('weg'); return; }
  if (rel.endsWith('/')) rel += 'index.html';
  const datei = path.join(ROOT, path.normalize(rel).replace(/^(\.\.[/\\])+/, ''));
  let inhalt;
  try {
    if (!datei.startsWith(ROOT) || statSync(datei).isDirectory()) throw new Error('nicht da');
    inhalt = readFileSync(datei, rel.endsWith('.js') ? 'utf8' : null);
  } catch {
    res.writeHead(404).end();
    return;
  }
  if (lage.inhalt && rel === '/schilddruese/js/app.js') inhalt = `import { NEU_IN_G1 } from './text.js';\nwindow.__fassung = NEU_IN_G1;\n${inhalt}`;
  if (lage.inhalt && rel === '/schilddruese/js/text.js') inhalt = `${inhalt}\nexport const NEU_IN_G1 = 'g1';\n`;
  const senden = () => {
    res.writeHead(200, { 'content-type': TYPEN[path.extname(datei)] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(inhalt);
  };
  if (lage.fassung && rel === '/schilddruese/sw.js') {
    inhalt = inhalt.replace(/const VERSION = '([^']+)'/, `const VERSION = '$1-${lage.fassung}'`);
    setTimeout(senden, 300);
    return;
  }
  if (lage.update && rel === '/schilddruese/sw.js') {
    inhalt = inhalt.replace(/const VERSION = '([^']+)'/, "const VERSION = '$1-neu'");
    setTimeout(senden, 1500);
    return;
  }
  if (lage.update && rel === '/schilddruese/js/dosis.js' && !lage.unpassend) {
    lage.unpassend++;
    inhalt = `import { gibtEsNicht } from './einschaetzung.js';\n${inhalt}`;
  }
  senden();
});
await new Promise((ok) => updateServer.listen(UPDATE_PORT, '127.0.0.1', ok));
const uctx = await browser.newContext({ viewport: { width: 360, height: 740 }, locale: 'de-DE' });
await uctx.addInitScript(uhrStellen);
const upage = await uctx.newPage();
const startFehler = [];
upage.on('pageerror', (e) => startFehler.push(e.message));
await upage.goto(`http://127.0.0.1:${UPDATE_PORT}/schilddruese/index.html`, { waitUntil: 'networkidle' });
await upage.evaluate(({ key, st, tag }) => {
  localStorage.setItem('__testtag', tag);
  localStorage.setItem(key, JSON.stringify(st));
}, { key: SCHLUESSEL, st: standMit(plus(TAG, -3)), tag: TAG });
await upage.evaluate(() => navigator.serviceWorker.ready);
await upage.reload({ waitUntil: 'networkidle' });
const genommen = await upage.evaluate(async () => {
  const name = (await caches.keys()).find((k) => k.startsWith('schilddruese-'));
  return (await caches.open(name)).delete('./js/dosis.js');
});
check(genommen && await upage.evaluate(() => Boolean(navigator.serviceWorker.controller)), 'C18: der eigene Worker steuert die Seite, seinem Vorrat fehlt ein Modul');
lage.update = true;
await upage.reload({ waitUntil: 'load' });
await upage.waitForTimeout(500);
const festeLeiste = upage.locator('#ansicht .notfall-leiste');
check(startFehler.length > 0 && await upage.locator('.tablette').count() === 0, `C18: das frische Modul passt nicht zu den alten – die App startet nicht (${(startFehler[0] || 'kein Fehler').slice(0, 60)})`);
check(await festeLeiste.isVisible() && await festeLeiste.locator('a[href="tel:112"]').count() >= 1 && await festeLeiste.locator('a[href="tel:116117"]').count() === 1,
  'C18: … die Notfallleiste steht trotzdem da (W0)');
let gestartet = false;
for (let i = 0; i < 60 && !gestartet; i++) {
  await upage.waitForTimeout(250);
  gestartet = await upage.locator('.tablette').isVisible().catch(() => false);
}
check(gestartet && lage.unpassend === 1, 'C18: sobald der neue Worker übernimmt, lädt die Seite einmal neu – und die App ist da');
check((await upage.evaluate(() => caches.keys())).some((k) => k.endsWith('-neu')), '… jetzt aus dem Vorrat des neuen Workers');
await uctx.close();

// --- Runde 4: E25 – ein Update lädt nicht mitten im Formular neu
/*
 * Übernahm der neue Worker, lud index.html die Seite ohne Rückfrage neu –
 * auf einem langsamen Netz 20 Sekunden nach dem Öffnen, mitten in den
 * Laborwerten. Jetzt wartet das Neuladen, bis das Formular verlassen ist.
 */
lage.update = false;
const SD_UPDATE = `http://127.0.0.1:${UPDATE_PORT}/schilddruese/index.html`;
/** Ein eigener Kontext (eigener Vorrat, eigene Sitzung), die App mit Daten, vom eigenen Worker gesteuert. */
async function mitWorker() {
  const k = await browser.newContext({ viewport: { width: 360, height: 740 }, locale: 'de-DE' });
  await k.addInitScript(uhrStellen);
  const p = await k.newPage();
  p.on('dialog', (d) => d.accept());
  await p.goto(SD_UPDATE, { waitUntil: 'networkidle' });
  await p.evaluate(({ key, st, tag }) => {
    localStorage.setItem('__testtag', tag);
    localStorage.setItem(key, JSON.stringify(st));
  }, { key: SCHLUESSEL, st: standMit(plus(TAG, -3)), tag: TAG });
  await p.evaluate(() => navigator.serviceWorker.ready);
  await p.reload({ waitUntil: 'networkidle' });
  return { k, p };
}
/** Das Update anstoßen – wie der Browser beim nächsten Öffnen. → 'activated' | 'redundant' | … */
const updateAnstossen = (p) => p.evaluate(async () => {
  const r = await navigator.serviceWorker.getRegistration();
  return new Promise((fertig) => {
    r.addEventListener('updatefound', () => {
      const w = r.installing;
      w.addEventListener('statechange', () => { if (w.state === 'activated' || w.state === 'redundant') fertig(w.state); });
    });
    r.update().catch(() => fertig('update-fehler'));
    setTimeout(() => fertig('zeit'), 20000);
  });
}).catch((e) => `abgebrochen: ${e.message.split('\n')[0]}`);
const wert = (p, sel) => p.evaluate((x) => { const el = document.querySelector(x); return el ? el.value : null; }, sel).catch(() => null);

const e25 = await mitWorker();
check(await e25.p.evaluate(() => Boolean(navigator.serviceWorker.controller)), 'E25: der eigene Worker steuert die Seite');
await e25.p.click('#reiter-verlauf');
await e25.p.click('#ansicht [data-seite="labor"]:not([data-param])');
await e25.p.fill('input[name=tsh_wert]', '6,8');
// Gezählt wird ein Laden der Seite – nicht die Schritte im Browserverlauf, die die App selbst macht.
let e25Neu = 0;
e25.p.on('load', () => { e25Neu++; });
lage.fassung = 'e25';
const e25Zustand = await updateAnstossen(e25.p);
await e25.p.waitForTimeout(1500);
check(e25Neu === 0 && await wert(e25.p, 'input[name=tsh_wert]') === '6,8',
  `E25: das Update übernimmt (${e25Zustand}), die Seite lädt aber nicht mitten im Formular neu – TSH 6,8 steht noch da (${e25Neu} Neuladen)`);
if (await e25.p.locator('form[data-formular="labor"] [data-act="zurueck"]').count()) await e25.p.click('form[data-formular="labor"] [data-act="zurueck"]');
for (let i = 0; i < 40 && !e25Neu; i++) await e25.p.waitForTimeout(250);
await e25.p.waitForTimeout(500);
check(e25Neu === 1 && await e25.p.locator('#reiterleiste').isVisible() && (await e25.p.evaluate(() => caches.keys())).some((k) => k.endsWith('-e25')),
  `E25: nach dem Verlassen des Formulars lädt sie einmal neu – mit der neuen Fassung (${e25Neu})`);
await e25.k.close();

// --- Runde 4: E26 – ein Update mit fehlender Datei lässt den alten Vorrat stehen
/*
 * Brach beim Update eine einzige Datei ab (hier js/dosis.js mit 503), ging
 * die Installation trotzdem durch, und activate löschte den alten,
 * vollständigen Vorrat. Ohne Netz startete die App danach nicht mehr.
 */
lage.fassung = null;
const e26 = await mitWorker();
const e26Vorrat = () => e26.p.evaluate(async () => {
  const o = {};
  for (const k of await caches.keys()) o[k] = (await (await caches.open(k)).keys()).length;
  return o;
});
const e26Alt = Object.entries(await e26Vorrat()).find(([k]) => k.startsWith('schilddruese-'));
check(e26Alt && e26Alt[1] >= shell.length - 1, `E26: vorher ein vollständiger Vorrat (${JSON.stringify(e26Alt)})`);
lage.fassung = 'e26';
lage.fehlt = '/schilddruese/js/dosis.js';
const e26Zustand = await updateAnstossen(e26.p);
await e26.p.waitForTimeout(500);
const e26Nach = await e26Vorrat();
check(e26Zustand === 'redundant' && e26Alt && e26Nach[e26Alt[0]] === e26Alt[1],
  `E26: fehlt beim Update eine Datei, scheitert die Installation – der alte Vorrat bleibt vollständig (${e26Zustand}, ${JSON.stringify(e26Nach)})`);
lage.fehlt = null;
lage.aus = true;
const e26Offline = await e26.k.newPage();
const e26Fehler = [];
e26Offline.on('pageerror', (e) => e26Fehler.push(e.message));
await e26Offline.goto(SD_UPDATE, { waitUntil: 'load' }).catch(() => {});
let e26Da = false;
for (let i = 0; i < 20 && !e26Da; i++) {
  await e26Offline.waitForTimeout(250);
  e26Da = await e26Offline.locator('.tablette').isVisible().catch(() => false);
}
check(e26Da, `E26: ohne Netz startet die App danach wie gewohnt${e26Fehler.length ? ` (${e26Fehler[0].slice(0, 60)})` : ''}`);
await e26.k.close();
lage.aus = false;

// --- Runde 6: G1 – der alte Worker mischt nach einem gescheiterten Update keine Fassungen
/*
 * E26 ließ den alten Worker stehen, sein Abruf legte aber jede gute Antwort
 * des Servers in seinen Vorrat. Bei einem echten Update ändern sich Module:
 * Beim ersten Öffnen kam das neue js/app.js in den alten Vorrat, das neue
 * js/text.js brach wieder ab. Ab dem zweiten Öffnen passten die Module nicht
 * zusammen – die App startete nicht, auch ohne Netz nicht. Der E26-Fall
 * oben ändert nur VERSION und fand das deshalb nicht. Dazu blieb der halb
 * gefüllte Vorrat der gescheiterten Fassung liegen.
 */
lage.fassung = null;
const g1 = await mitWorker();
const g1Fehler = [];
g1.p.on('pageerror', (e) => g1Fehler.push(e.message));
/** Die Vorräte dieser App: Einträge, und ob js/app.js schon das der neuen Fassung ist. */
const g1Vorrat = (p) => p.evaluate(async () => {
  const o = {};
  for (const k of (await caches.keys()).filter((n) => n.startsWith('schilddruese-'))) {
    const c = await caches.open(k);
    const app = await c.match('./js/app.js');
    o[k] = { eintraege: (await c.keys()).length, neuesApp: app ? (await app.text()).includes('NEU_IN_G1') : null };
  }
  return o;
});
const g1App = async (p) => {
  for (let i = 0; i < 24; i++) {
    if (await p.locator('.tablette').isVisible().catch(() => false)) return true;
    await p.waitForTimeout(250);
  }
  return false;
};
const g1Alt = await g1Vorrat(g1.p);
check(Object.keys(g1Alt).length === 1 && Object.values(g1Alt)[0].eintraege >= shell.length - 1 && Object.values(g1Alt)[0].neuesApp === false,
  `G1: vorher ein vollständiger Vorrat der alten Fassung (${JSON.stringify(g1Alt)})`);
lage.fassung = 'g1';
lage.inhalt = true;
lage.fehlt = '/schilddruese/js/text.js';
// Erstes Öffnen nach dem Update: Der Browser versucht die neue Fassung, js/text.js bricht ab.
await g1.p.reload({ waitUntil: 'networkidle' }).catch(() => {});
for (let i = 0; i < 20; i++) {
  if (!await g1.p.evaluate(async () => Boolean((await navigator.serviceWorker.getRegistration())?.installing)).catch(() => false)) break;
  await g1.p.waitForTimeout(250);
}
await g1.p.waitForTimeout(500);
// Zweites Öffnen, das Netz wackelt weiter.
g1Fehler.length = 0;
await g1.p.reload({ waitUntil: 'networkidle' }).catch(() => {});
const g1Zweites = await g1App(g1.p);
check(g1Zweites, `G1: nach dem gescheiterten Update startet die App beim nächsten Öffnen${g1Fehler.length ? ` (${g1Fehler[0].slice(0, 80)})` : ''}`);
const g1Nach = await g1Vorrat(g1.p);
check(JSON.stringify(g1Nach) === JSON.stringify(g1Alt),
  `G1: der alte Vorrat bleibt, wie er war – ohne Dateien der neuen Fassung, und kein halber Vorrat liegt daneben (${JSON.stringify(g1Nach)})`);
lage.aus = true;
const g1Offline = await g1.k.newPage();
const g1OfflineFehler = [];
g1Offline.on('pageerror', (e) => g1OfflineFehler.push(e.message));
await g1Offline.goto(SD_UPDATE, { waitUntil: 'load' }).catch(() => {});
check(await g1App(g1Offline), `G1: ohne Netz startet die App danach wie gewohnt${g1OfflineFehler.length ? ` (${g1OfflineFehler[0].slice(0, 80)})` : ''}`);
await g1Offline.close();
// Ist das Netz wieder gut, kommt die neue Fassung doch – vollständig.
lage.aus = false;
lage.fehlt = null;
const g1Gut = await g1.k.newPage();
await g1Gut.goto(SD_UPDATE, { waitUntil: 'networkidle' }).catch(() => {});
let g1Fassung = null;
for (let i = 0; i < 60 && g1Fassung !== 'g1'; i++) {
  await g1Gut.waitForTimeout(250);
  g1Fassung = await g1Gut.evaluate(() => window.__fassung || null).catch(() => null);
}
check(g1Fassung === 'g1' && await g1App(g1Gut) && Object.keys(await g1Vorrat(g1Gut)).every((k) => k.endsWith('-g1')),
  `G1: mit gutem Netz übernimmt die neue Fassung danach ganz (${g1Fassung}, ${JSON.stringify(await g1Vorrat(g1Gut))})`);
await g1.k.close();
lage.fassung = null;
lage.inhalt = false;

updateServer.closeAllConnections();
updateServer.close();

await browser.close();
process.exit(fails || !oks ? 1 : 0);
