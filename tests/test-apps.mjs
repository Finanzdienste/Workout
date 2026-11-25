/*
 * Meine Apps (v274): die Übersicht über alle Apps – wird's genutzt?
 *
 * Tobi, 25.11.2026: „Können wir mir nicht mal ne masterübersicht aus allen
 * meinen Apps bauen damit ich seh ob die genutzt werden?“
 *
 * Erst ohne Browser: Jede Datei steht im Vorrat (apps/sw.js), FASSUNG passt zu
 * VERSION, der Workout-Worker lässt /apps in Ruhe. Dann das Rechnen
 * (apps/js/modell.js) mit erfundenen Zahlen, wie sie apps_uebersicht()
 * schickt. Dann im Browser, Supabase gespielt, mit eigenem Server, der
 * wirklich ausgeht (Playwrights Offline-Schalter schneidet den Service Worker
 * nicht ab):
 *
 *   1. Ohne Anmeldung das Passwortfeld; falsches Passwort → „Falsches
 *      Passwort.“; richtiges → je App eine Karte, die Ampel, wer wann.
 *   2. Neu geöffnet: der letzte Stand steht sofort da, bevor der Server
 *      antwortet, und wird dann aufgefrischt.
 *   3. Ohne Netz (Server aus, Supabase weg): Die Seite geht auf, mit dem
 *      letzten Stand und „Ohne Netz – Stand von …“; mit `online` holt sie
 *      von selbst nach.
 *   4. Zum ersten Öffnen ohne Netz: ein Satz, dass es Netz braucht.
 *   5. Der Workout-Worker liefert unter /apps/ nicht die Workout-App aus.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { ROOT } from './umgebung.mjs';
import { starte } from './server.mjs';
import { pruefer } from './mz-hilfe.mjs';

const { check, ende } = pruefer();
const ORDNER = path.join(ROOT, 'apps');
const sw = readFileSync(path.join(ORDNER, 'sw.js'), 'utf8');
const shell = [...sw.match(/const SHELL = \[(.*?)\];/s)[1].matchAll(/'\.\/([^']*)'/g)].map((m) => m[1]);
const version = sw.match(/const VERSION = '([^']+)'/)[1];

// --- Ohne Browser: Dateien und Worker
const module = readdirSync(path.join(ORDNER, 'js')).filter((f) => f.endsWith('.js'));
const fehlt = [...module.map((f) => `js/${f}`), 'css/apps.css', 'index.html', 'manifest.webmanifest'].filter((f) => !shell.includes(f));
check(!fehlt.length, `jede Datei der Seite steht in SHELL${fehlt.length ? ` – es fehlen: ${fehlt.join(', ')}` : ''}`);
const tot = shell.filter((f) => f && !existsSync(path.join(ORDNER, f)));
check(!tot.length, `jeder Eintrag in SHELL gibt es als Datei${tot.length ? ` – nicht da: ${tot.join(', ')}` : ''}`);
const fassung = readFileSync(path.join(ORDNER, 'js', 'app.js'), 'utf8').match(/export const FASSUNG = '([^']+)'/)?.[1];
check(fassung === version, `FASSUNG in js/app.js (${fassung}) = VERSION in sw.js (${version})`);
const manifest = JSON.parse(readFileSync(path.join(ORDNER, 'manifest.webmanifest'), 'utf8'));
check(manifest.icons.every((i) => existsSync(path.join(ORDNER, i.src))), 'jedes Symbol aus dem Manifest gibt es');
check(manifest.start_url === '.' && manifest.scope === '.' && manifest.lang === 'de' && manifest.id === '/Workout/apps/', 'Manifest: deutsch, startet und gilt im eigenen Ordner');
check(/startsWith\('apps-'\)/.test(sw.match(/addEventListener\('activate'[\s\S]*?\n\}\);/)[0]), 'der Worker räumt nur Vorräte weg, die mit „apps-" beginnen');
const workoutSw = readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
check(/startsWith\(new URL\('\.\/apps', self\.location\)\.pathname\)\) return;/.test(workoutSw), 'der Workout-Worker lässt /apps in Ruhe');

// --- Ohne Browser: das Rechnen
const M = await import(path.join(ORDNER, 'js', 'modell.js'));
const H = '2026-11-25';
const vor = (n, heute = H) => new Date(Date.parse(`${heute}T00:00:00Z`) - n * 86400000).toISOString().slice(0, 10);

function zahlen(heute) {
  const v = (n) => vor(n, heute);
  return {
    stand: `${heute}T15:00:00Z`,
    heute,
    bildschirmzeit: [
      { app: 'workout', tag: v(0), sekunden: 1500 },
      { app: 'workout', tag: v(2), sekunden: 2400 },
      { app: 'workout', tag: v(30), sekunden: 600 },
      { app: 'boxenstopp', tag: v(1), sekunden: 300 },
      { app: 'bewerbungszentrale', tag: v(4), sekunden: 0 }, // verbunden, aber nicht offen
      { app: 'bewerbungszentrale', tag: v(5), sekunden: 3900 },
      { app: 'freizeit', tag: v(5), sekunden: 30 },
    ],
    widget: `${heute}T13:05:00Z`,
    tage: [
      { app: 'workout', wer: 'Tobi', tag: v(3) },
      { app: 'freizeit', wer: 'aaaaaaaaaaaa', tag: v(1) },
      { app: 'freizeit', wer: 'cccccccccccc', tag: v(20) },
    ],
    workout: [
      { wer: 'Tobi', geraete: 3, gesehen: `${v(1)}T09:00:00Z`, trainiert: v(6), einheiten: 18 },
      { wer: 'Amy', geraete: 1, gesehen: `${v(88)}T09:00:00Z`, trainiert: null, einheiten: 0 },
    ],
    schilddruese: [],
    mahlzeit: [
      { wer: 'Uwe', tag: v(0), essen: 4, hafer: 0, sport: 1, werte: 1, als_app: true, at: `${heute}T08:00:00Z` },
      { wer: 'Uwe', tag: v(1), essen: 3, hafer: 3, sport: 0, werte: 0, als_app: true, at: `${v(1)}T08:00:00Z` },
      { wer: 'Gerät n4zs', tag: v(0), essen: 1, hafer: 0, sport: 0, werte: 0, als_app: false, at: `${heute}T09:00:00Z` },
      { wer: 'Gerät 9ifv', tag: v(3), essen: 0, hafer: 0, sport: 0, werte: 0, als_app: false, at: `${v(3)}T09:00:00Z` },
    ],
    mahlzeit_ki: [{ tag: v(4), n: 9 }],
    freizeit: [
      { wer: 'aaaaaaaaaaaa', name: 'Tobi', angelegt: `${v(30)}T10:00:00Z`, offen: `${v(0)}T07:00:00Z`, bock: null },
      { wer: 'bbbbbbbbbbbb', name: '<img src=x onerror="window.__boese=1">Lea', angelegt: `${v(30)}T10:00:00Z`, offen: null, bock: `${v(2)}T18:00:00Z` },
      { wer: 'cccccccccccc', name: 'Jan', angelegt: `${v(30)}T10:00:00Z`, offen: null, bock: null },
    ],
    fragmal_konten: [
      { nr: 1, angelegt: `${v(14)}T07:00:00Z`, zuletzt: `${v(14)}T19:47:00Z` },
      { nr: 2, angelegt: `${v(14)}T07:00:00Z`, zuletzt: `${v(13)}T18:19:00Z` },
    ],
    fragmal: [
      { app: 'boxenstopp', konto: null, tag: v(10), n: 23 },
      { app: 'boxenstopp', konto: null, tag: v(9), n: 6 },
      { app: 'probe', konto: null, tag: v(12), n: 1 },
    ],
  };
}

const apps = M.auswerten(zahlen(H), H);
const app = (id) => apps.find((a) => a.id === id);
const leute = (id) => app(id).leute.map((p) => p.name);

check(apps.length === M.APPS.length, `jede App bekommt eine Karte (${apps.length})`);
check(app('workout').zuletzt === H && app('workout').stufe === 'frisch' && app('workout').wann === 'heute', 'Workout: heute benutzt, grün');
const tobiW = app('workout').leute.find((p) => p.name === 'Tobi');
check(leute('workout').filter((n) => n === 'Tobi').length === 1, 'Tobi aus dem Widget und aus dem Rückkanal ist eine Person');
check(tobiW.tage === 5, `Workout: Tobi an 5 der 14 Tage (heute, Widget vor 2, apps_tag vor 3, Rückkanal vor 1, Training vor 6) – ${tobiW.tage}`);
check(tobiW.sekunden === 3900, `Workout: nur die Minuten der 14 Tage zählen (${tobiW.sekunden} s)`);
check(tobiW.notiz.some((n) => n === `zuletzt trainiert am ${M.datumKurz(vor(6))}`) && tobiW.notiz.includes('3 Geräte'), `Workout: letztes Training und Geräte (${tobiW.notiz.join(' · ')})`);
check(app('workout').weitere.map((p) => p.name).join() === 'Amy' && app('workout').weitere[0].zuletzt === vor(88), 'Workout: Amy, zuletzt vor 88 Tagen, steht unter „Weitere“');
check(app('workout').streifen.length === 14 && app('workout').streifen[13].tag === H && app('workout').streifen[0].tag === vor(13), 'der Streifen: 14 Tage, heute rechts');
check(app('workout').streifen[13].sekunden === 1500 && app('workout').streifen[13].an, 'der Streifen kennt die Sekunden des Tages');

check(app('bewerbungszentrale').zuletzt === vor(5) && app('bewerbungszentrale').stufe === 'mittel', 'Bewerbungszentrale: ein Tag mit 0 Sekunden zählt nicht – zuletzt vor 5 Tagen, gelb');
check(app('boxenstopp').zeilen.some((z) => z === 'KI: 29 Anfragen in 14 Tagen, zuletzt vor 9 Tagen'), `Boxenstopp: KI-Anfragen (${app('boxenstopp').zeilen.join(' | ')})`);
check(!!app('boxenstopp').blind, 'Boxenstopp sagt, was es nicht sieht (Amy, Marielle)');

const uwe = app('mahlzeit').leute.find((p) => p.name === 'Uwe');
check(uwe && uwe.wann === 'heute' && uwe.tage === 2 && uwe.notiz.includes('7 Einträge in 14 Tagen'), `Mahlzeit: Uwe heute, an 2 Tagen, 7 Einträge (${uwe && uwe.notiz.join(' · ')})`);
check(app('mahlzeit').zeilen.includes('KI: 9 Anfragen in 14 Tagen'), 'Mahlzeit: KI-Anfragen');
check(uwe.notiz.includes('vom Startbildschirm'), 'Mahlzeit: Uwe nutzt sie vom Startbildschirm');
check(leute('mahlzeit').join() === 'Uwe,Gerät n4zs' && app('mahlzeit').weitere.map((p) => p.name).join() === 'Gerät 9ifv',
  `Mahlzeit: ein Gerät, das nur einen Tag kurz offen war, steht neben Uwe unter „Weitere“ – eins mit Eintrag nicht (${leute('mahlzeit').join()} | ${app('mahlzeit').weitere.map((p) => p.name).join()})`);
const nurEins = M.auswerten({ heute: H, schilddruese: [{ wer: 'Gerät 1a2b', erstmals: H, zuletzt: H, tage: 1 }] }, H);
check(nurEins.find((a) => a.id === 'schilddruese').leute.length === 1, 'ein einziges Gerät mit einem Tag bleibt sichtbar (Schilddrüse)');

check(app('schilddruese').zuletzt === null && app('schilddruese').stufe === 'nie' && app('schilddruese').wann === 'noch nie', 'Schilddrüse ohne Gerät: „noch nie“, grau');
check(app('freizeit').leute.filter((p) => p.name === 'Tobi').length === 1, 'Freizeit: Tobi aus Widget und Raum ist eine Person');
check(app('freizeit').leute.find((p) => p.name === 'Tobi').wann === 'heute', 'Freizeit: „zuletzt in der App“ zählt');
check(app('freizeit').leute.some((p) => p.name.endsWith('Lea') && p.wann === 'vor 2 Tagen'), 'Freizeit: ein Haken zählt als benutzt');
check(app('freizeit').weitere.some((p) => p.name === 'Jan' && p.zuletzt === vor(20)), 'Freizeit: Jan über apps_tag beim Namen, vor 20 Tagen → „Weitere“');
check(app('freizeit').zeilen.includes('3 Personen im Raum'), 'Freizeit: Personen im Raum');
check(app('fragmal').zuletzt === vor(13) && app('fragmal').stufe === 'alt' && app('fragmal').leute.length === 1, 'Frag mal: zuletzt vor 13 Tagen, rot; Konto 1 (vor 14) nur unter „Weitere“');
check(app('widget').wann === 'heute' && app('widget').leute[0].notiz.some((n) => /^zuletzt um \d\d:\d\d Zahlen geholt$/.test(n)), 'Widget: heute, mit Uhrzeit');
check(app('bodycheck').stufe === 'nichts' && apps[apps.length - 1].id === 'bodycheck', 'Body Check misst nichts und steht unten');
const reihe = apps.map((a) => a.id);
check(reihe.indexOf('schilddruese') > reihe.indexOf('fragmal') && reihe.indexOf('workout') < reihe.indexOf('bewerbungszentrale'), `Reihenfolge: zuletzt benutzt zuerst, nie danach (${reihe.join(', ')})`);

const zf = M.zusammenfassung(apps, H);
check(zf.satz === 'In den letzten 7 Tagen benutzt: 6 von 8 Apps.', `Zusammenfassung: ${zf.satz}`);
check(zf.still === `Still: Frag mal (seit ${M.datumKurz(vor(13))}), Schilddrüse (noch nie).`, `Still: ${zf.still}`);
check([0, 1, 2, 3, 7, 8].map((n) => M.stufe(vor(n), H)).join() === 'frisch,frisch,frisch,mittel,mittel,alt', 'Ampel: grün bis 2 Tage, gelb bis 7, dann rot');
check(M.wann(vor(1), H) === 'gestern' && M.wann(vor(3), H) === 'vor 3 Tagen', 'gestern, vor 3 Tagen');
check(M.dauer(3900) === '1 Std. 5 Min.' && M.dauer(600) === '10 Min.' && M.dauer(20) === 'unter 1 Min.' && M.dauer(7200) === '2 Std.', 'Dauer wie das Widget');
check(M.tagAus('2026-11-24T23:30:00Z') === '2026-11-25' && M.tagAus('2026-07-24T22:30:00Z') === '2026-07-25', 'ein Zeitpunkt zählt zum Tag in Berlin (Winter- und Sommerzeit)');
const leer = M.auswerten({ heute: H }, H);
check(leer.length === M.APPS.length && leer.every((a) => a.stufe === 'nie' || a.stufe === 'nichts'), 'leere Antwort: alle Karten, nichts kaputt');

// --- Im Browser
const PORT = 8146;
const BASIS = `http://127.0.0.1:${PORT}`;
const heute = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin' }).format(new Date());
let server = await starte(PORT, 0);
const aus = () => new Promise((fertig) => { server.closeAllConnections(); server.close(() => fertig()); });

const browser = await chromium.launch();
const fehler = [];
const aufrufe = [];
let modus = 'gut';
let verzoegern = 0;

async function kontext() {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'de-DE' });
  await ctx.route('https://vjyohppohmvhhxgwouti.supabase.co/**', async (route) => {
    const req = route.request();
    aufrufe.push({ url: req.url(), body: req.postData(), kopf: req.headers() });
    if (modus === 'weg') { await route.abort('internetdisconnected'); return; }
    if (verzoegern) await new Promise((r) => setTimeout(r, verzoegern));
    const { pass } = JSON.parse(req.postData() || '{}');
    if (pass !== 'geheim') {
      await route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ code: '42501', message: 'nope' }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(zahlen(heute)) });
  });
  return ctx;
}
const seite = async (ctx) => {
  const p = await ctx.newPage();
  p.on('pageerror', (e) => fehler.push(e.message));
  return p;
};

// 1. Anmelden
const ctx = await kontext();
const page = await seite(ctx);
await page.goto(`${BASIS}/apps/`, { waitUntil: 'networkidle' });
check(await page.title() === 'Meine Apps', 'die Seite heißt „Meine Apps“');
check(await page.locator('#pass').isVisible(), 'ohne Anmeldung: das Passwortfeld');
check(aufrufe.length === 0, 'ohne Passwort geht keine Anfrage hinaus');
await page.fill('#pass', 'falsch');
await page.click('#anmelden button');
await page.waitForSelector('#fehler:has-text("Falsches Passwort.")');
check(true, 'falsches Passwort: „Falsches Passwort.“');
check(await page.evaluate(() => localStorage.getItem('apps.pass.v1')) === null, 'ein falsches Passwort wird nicht gemerkt');
await page.fill('#pass', 'geheim');
await page.click('#anmelden button');
await page.waitForSelector('article.app[data-app="workout"]');
const karten = await page.locator('article.app').evaluateAll((els) => els.map((e) => e.dataset.app));
check(karten.length === 9 && karten[0] === 'workout' && karten[8] === 'bodycheck', `je App eine Karte, zuletzt benutzt zuerst (${karten.join(', ')})`);
const anfrage = aufrufe[aufrufe.length - 1];
check(anfrage.url.endsWith('/rest/v1/rpc/apps_uebersicht') && anfrage.kopf.apikey && !anfrage.kopf.authorization, 'ein Aufruf an apps_uebersicht, nur mit apikey');
check(await page.locator('.satz').textContent() === 'In den letzten 7 Tagen benutzt: 6 von 8 Apps.', 'oben der Satz, wie viele benutzt werden');
const workout = page.locator('article[data-app="workout"]');
check(await workout.locator('.pille').textContent() === 'heute' && await workout.evaluate((e) => e.classList.contains('stufe-frisch')), 'Workout: Pille „heute“, grün');
check((await workout.locator('.leute li').first().textContent()).includes('Tobi') && (await workout.locator('.leute li').first().textContent()).includes('an 5 von 14 Tagen'), 'Workout: Tobi an 5 von 14 Tagen');
check(await workout.locator('.streifen i').count() === 14 && await workout.locator('.streifen i.an').count() === 5, 'Workout: 14 Kästchen, 5 davon an');
check((await workout.locator('details.weitere').textContent()).includes('Amy'), 'Workout: Amy unter „Weitere“');
check((await page.locator('article[data-app="schilddruese"]').textContent()).includes('Noch kein Gerät hat sich gemeldet.'), 'Schilddrüse: „Noch kein Gerät hat sich gemeldet.“');
check((await page.locator('article[data-app="bodycheck"] .pille').textContent()) === 'misst nichts', 'Body Check: „misst nichts“');
check((await page.locator('article[data-app="boxenstopp"]').textContent()).includes('Amy und Marielle'), 'Boxenstopp sagt, wen es nicht sieht');
check((await page.locator('article[data-app="mahlzeit"]').textContent()).includes('Uwe'), 'Mahlzeit: Uwe');
const widget = page.locator('article[data-app="widget"]');
check(await widget.locator('.streifen').count() === 0 && !(await widget.textContent()).includes('von 14 Tagen'), 'Widget: kein Streifen – der Server kennt nur den letzten Abruf');
check((await page.locator('article[data-app="freizeit"] details.weitere summary').textContent()) === 'Weitere: Jan', '„Weitere“ nennt die Namen');
check(await page.evaluate(() => !window.__boese) && (await page.locator('article[data-app="freizeit"]').textContent()).includes('<img'), 'Namen stehen als Text da, nicht als HTML');
check(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), 'auf dem Handy kein Wischen zur Seite');
check(await page.evaluate(() => localStorage.getItem('apps.pass.v1')) === '"geheim"', 'das richtige Passwort bleibt auf dem Gerät');
const stand1 = await page.evaluate(() => JSON.parse(localStorage.getItem('apps.stand.v1')));
check(stand1 && stand1.daten && stand1.daten.heute === heute && stand1.geholt > 0, 'der Stand liegt im Speicher dieses Geräts');
check((await page.locator('#stand').textContent()).startsWith('Stand: heute '), `darunter, von wann (${await page.locator('#stand').textContent()})`);

// 2. Neu geöffnet: sofort der letzte Stand, dann aufgefrischt
await page.evaluate(() => navigator.serviceWorker.ready);
const vorher = aufrufe.length;
verzoegern = 1500;
await page.reload({ waitUntil: 'domcontentloaded' });
const sofort = await page.waitForFunction(() => document.querySelectorAll('article.app').length === 9
  && document.querySelector('#stand').textContent.includes('lädt'), null, { timeout: 1000 }).then(() => true).catch(() => false);
for (let i = 0; i < 20 && aufrufe.length === vorher; i++) await new Promise((r) => setTimeout(r, 50));
check(sofort && aufrufe.length === vorher + 1, 'neu geöffnet: der letzte Stand steht sofort da, während der Server noch antwortet');
await page.waitForFunction(() => !document.querySelector('#stand').textContent.includes('lädt'));
verzoegern = 0;
check(await page.evaluate(() => !!navigator.serviceWorker.controller), 'der eigene Worker steuert die Seite');

// 3. Ohne Netz
await aus();
modus = 'weg';
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForSelector('#stand.warn');
const ohne = await page.locator('#stand').textContent();
check(ohne.startsWith('Ohne Netz – Stand von heute ') && ohne.includes('sobald Netz da ist'), `ohne Netz: die Seite geht auf, mit dem letzten Stand (${ohne})`);
check(await page.locator('article.app').count() === 9, 'ohne Netz: alle Karten da');
const vorOnline = aufrufe.length;
server = await starte(PORT, 0);
modus = 'gut';
await page.evaluate(() => window.dispatchEvent(new Event('online')));
await page.waitForFunction(() => !document.querySelector('#stand').classList.contains('warn') && !document.querySelector('#stand').textContent.includes('lädt'));
check(aufrufe.length === vorOnline + 1, 'mit `online` holt die Seite von selbst nach – einmal');

// Abmelden
await page.click('#abmelden');
check(await page.locator('#pass').isVisible() && await page.evaluate(() => localStorage.getItem('apps.pass.v1') === null && localStorage.getItem('apps.stand.v1') === null), 'Abmelden: Passwort und Stand sind vom Gerät');
await ctx.close();

// 4. Zum ersten Öffnen ohne Netz
const ctx2 = await kontext();
const p2 = await seite(ctx2);
await p2.goto(`${BASIS}/apps/`, { waitUntil: 'networkidle' });
modus = 'weg';
await p2.fill('#pass', 'geheim');
await p2.click('#anmelden button');
await p2.waitForSelector('#fehler:has-text("Netz")');
check((await p2.locator('#fehler').textContent()) === 'Zum ersten Öffnen braucht die Übersicht Netz.', 'zum ersten Öffnen ohne Netz: ein Satz, dass es Netz braucht');
modus = 'gut';
await ctx2.close();

// 5. Der Workout-Worker lässt /apps in Ruhe
const ctx3 = await kontext();
const p3 = await seite(ctx3);
await p3.goto(`${BASIS}/index.html`, { waitUntil: 'networkidle' });
await p3.evaluate(() => navigator.serviceWorker.ready);
await p3.reload({ waitUntil: 'networkidle' });
const workoutTitel = await p3.title();
check(await p3.evaluate(() => !!navigator.serviceWorker.controller), 'der Workout-Worker steuert die Workout-App');
await aus();
const fremd = await p3.goto(`${BASIS}/apps/`).then(() => p3.title()).catch(() => 'Netzfehler');
check(fremd !== workoutTitel, `offline, ohne eigenen Worker: unter /apps/ keine Workout-App (${fremd})`);
server = await starte(PORT, 0);
await ctx3.close();

check(!fehler.length, `keine Fehler in der Seite${fehler.length ? `: ${fehler.join(' | ')}` : ''}`);
await browser.close();
await aus();
ende();
