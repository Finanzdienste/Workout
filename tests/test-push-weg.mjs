/*
 * Der Weg des Pushs – und die Frage, die er beantworten muss.
 *
 * *„Die push Nachricht kam erst als ich die app geöffnet hab. Sie soll ja auch
 * bei geschlossener app kommen."*
 *
 * Dahinter stecken zwei Ursachen, die von außen gleich aussehen:
 *
 *   Der Push kam nicht an     Android hält Nachrichten für gedrosselte Apps im
 *                             Doze-Modus zurück und liefert sie beim Entsperren
 *                             nach. Dagegen hilft `urgency: high` beim Absender
 *                             und eine Einstellung am Gerät – hier nicht
 *                             prüfbar, aber der Absender schon.
 *   Der Push kam an           …und der Worker hat entschieden, nichts zu zeigen.
 *                             Das ist hier prüfbar, und zwar vollständig.
 *
 * Weil ich auf seinem Handy nichts nachmessen kann, schreibt der Worker jeden
 * Ausgang mit Uhrzeit und Grund in den Merkzettel. Geprüft wird hier beides: dass
 * ein Push bei geschlossener App wirklich meldet, und dass jeder andere Ausgang
 * seinen Grund hinterlässt – sonst wäre die Anzeige unter Mehr eine Behauptung.
 *
 * Zwei Zugeständnisse an den Testlauf, dieselben wie in test-erinnerung-fest:
 * die Anzeige ist abgefangen (ein Chromium ohne Bildschirm verweigert Meldungen
 * grundsätzlich), und die geschlossene App ist über clients.matchAll gestellt.
 * Das Push-Ereignis selbst ist echt: `new Event('push')` erreicht denselben
 * Zuhörer, den der Browser bedient.
 */
import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { URL, ROOT } from './umgebung.mjs';

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 414, height: 896 } });
await ctx.route('**/rest/v1/**', (r) => r.fulfill({ status: 204, body: '' }));
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message));
let fails = 0;
const check = (c, m) => { console.log(`${c ? 'OK  ' : 'FAIL'} ${m}`); if (!c) { fails++; process.exitCode = 1; } };

await page.goto(URL, { waitUntil: 'networkidle' });

// --- 1. Der Absender bittet um sofortige Zustellung ---------------------
//
// Ohne Angabe sendet web-push mit urgency „normal", und genau die sammelt ein
// Android im Doze-Modus ein. Das ist die einzige Stellschraube, die der Absender
// überhaupt hat – steht sie falsch, hilft am Gerät nichts mehr.
const yml = await readFile(
  path.join(ROOT, '.github', 'workflows', 'push-erinnerung.yml'), 'utf8');
check(/urgency:\s*["']high["']/.test(yml),
  'der Absender schickt mit urgency „high" – sonst hält Android ihn zurück');
check(/TTL:\s*3600/.test(yml),
  'und mit einer Stunde Haltbarkeit: später ist die Erinnerung ohnehin sinnlos');
// Zur vollen Stunde ist die Warteschlange bei GitHub am längsten. Gemessen an
// den ersten beiden Läufen: 3 h 47 min und 4 h 37 min zu spät.
const crons = [...yml.matchAll(/cron:\s*'(\d+)\s/g)].map((m) => Number(m[1]));
check(crons.length >= 2 && crons.every((m) => m !== 0),
  `keine Sendung zur vollen Stunde (Minuten: ${crons.join(', ')})`);

// --- 2. Der Worker ------------------------------------------------------
await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null,
  { timeout: 15000 }).catch(() => {});
let worker = ctx.serviceWorkers()[0];
if (!worker) worker = await ctx.waitForEvent('serviceworker', { timeout: 15000 });
check(!!worker, 'der Service Worker läuft');

const lauf = await worker.evaluate(async () => {
  const gezeigt = [];
  self.registration.showNotification = (t, o) => {
    gezeigt.push({ titel: t, ...(o || {}) });
    return Promise.resolve();
  };
  const echteClients = self.clients.matchAll.bind(self.clients);
  // Auch die Zahl am Symbol muss weg, und das ist kein Schönheitsfehler:
  // erinnern() stößt setAppBadge an, ohne darauf zu warten, und ein Chromium
  // ohne Bildschirm beendet daraufhin den Worker mitten im Ereignis (nachge-
  // messen: awaited geht es gut, nicht awaited stirbt er). Auf einem Handy ist
  // das kein Thema – dort gibt es das Symbol wirklich. Hier wäre es sonst kein
  // Test, sondern ein Aufhänger.
  self.navigator.setAppBadge = () => Promise.resolve();
  const heute = heuteISO();

  /** Ein Push schicken und abwarten, was daraus wurde. */
  const klopfen = async () => {
    gezeigt.length = 0;
    const warten = [];
    const ev = new Event('push');
    ev.waitUntil = (p) => warten.push(p);
    self.dispatchEvent(ev);
    await Promise.all(warten);
    return { gezeigt: gezeigt.slice(), zettel: await merkLesen() };
  };

  const ergebnis = {};
  const vorher = Date.now();

  // a) Geschlossene App, heute steht etwas an: Das ist der Fall, um den es geht.
  self.clients.matchAll = () => Promise.resolve([]);
  await merkSchreiben({ an: true, tag: heute, zeigenAb: Date.now() + 3600000,
                        gemeldet: null, wegAm: null, titel: 'Workout 7 · 6 Übungen',
                        weckArt: null, weckGrund: null });
  ergebnis.zu = await klopfen();
  ergebnis.vorher = vorher;

  // b) Ein zweiter Push am selben Tag meldet nicht noch einmal – aber er
  //    hinterlässt seinen Grund, sonst sähe er aus wie einer, der nie ankam.
  ergebnis.nochmal = await klopfen();

  // c) Offene App: nichts zeigen, denn er sieht es ja. Genau dieser Ausgang
  //    macht die Beobachtung mehrdeutig – deshalb muss er benannt sein.
  await merkSchreiben({ gemeldet: null });
  self.clients.matchAll = () => Promise.resolve([{ visibilityState: 'visible' }]);
  ergebnis.offen = await klopfen();
  self.clients.matchAll = () => Promise.resolve([]);

  // d) Ruhetag: Der Merkzettel zeigt auf einen späteren Termin.
  await merkSchreiben({ gemeldet: null, tag: '2099-01-01' });
  ergebnis.ruhetag = await klopfen();

  // e) Erinnerung ausgeschaltet.
  await merkSchreiben({ an: false, tag: heute });
  ergebnis.aus = await klopfen();

  // f) Die Uhrzeit prüft der Push absichtlich nicht: Er ist die Uhr. Zur
  //    Winterzeit trifft er eine Stunde früher ein; eine Zeitprüfung hätte ihn
  //    verworfen, und dann wäre an dem Tag gar nichts gekommen.
  await merkSchreiben({ an: true, tag: heute, gemeldet: null,
                        zeigenAb: Date.now() + 6 * 3600000 });
  ergebnis.zuFrueh = await klopfen();

  self.clients.matchAll = echteClients;
  return ergebnis;
});

console.log('     Push bei geschlossener App:', JSON.stringify(lauf.zu.gezeigt));
check(lauf.zu.gezeigt.length === 1,
  'ein Push bei geschlossener App zeigt die Erinnerung – darum geht die ganze Übung');
check((lauf.zu.gezeigt[0] || {}).body === 'Workout 7 · 6 Übungen',
  'mit dem, was auf dem Merkzettel steht – der Push selbst trägt keinen Text');
check(lauf.zu.zettel.weckArt === 'push',
  `vermerkt wird, wodurch geweckt wurde (${lauf.zu.zettel.weckArt})`);
check(lauf.zu.zettel.weckGrund === 'gezeigt',
  `und was daraus wurde (${lauf.zu.zettel.weckGrund})`);
check(lauf.zu.zettel.geweckt >= lauf.vorher,
  'mit einem Zeitstempel von jetzt, nicht von einem früheren Lauf');
check(lauf.zu.zettel.gemeldet, 'der Tag ist als gemeldet vermerkt');

console.log('     zweiter Push am selben Tag:', JSON.stringify(lauf.nochmal.zettel.weckGrund));
check(lauf.nochmal.gezeigt.length === 0, 'ein zweiter Push am selben Tag meldet nicht noch einmal');
check(lauf.nochmal.zettel.weckGrund === 'schon',
  'sagt aber, warum – ein stiller Push ohne Grund wäre von einem fehlenden nicht zu unterscheiden');

check(lauf.offen.gezeigt.length === 0, 'bei offener App bleibt es still');
check(lauf.offen.zettel.weckGrund === 'offen',
  `und der Grund steht da (${lauf.offen.zettel.weckGrund}) – das ist genau die Verwechslung, um die es ging`);

check(lauf.ruhetag.gezeigt.length === 0, 'an einem Ruhetag kommt nichts');
check(lauf.ruhetag.zettel.weckGrund === 'kein-tag', 'auch das mit Grund');

check(lauf.aus.gezeigt.length === 0, 'ausgeschaltet kommt nichts');
check(lauf.aus.zettel.weckGrund === 'aus', 'auch das mit Grund');
check(lauf.aus.zettel.weckArt === 'push',
  'und selbst dann ist vermerkt, dass der Push ankam – sonst hieße „nichts" zweierlei');

check(lauf.zuFrueh.gezeigt.length === 1,
  'der Push prüft die Uhrzeit nicht – zur Winterzeit käme sonst gar nichts');

// --- 3. Die App sagt es im Klartext -------------------------------------
//
// Nur ein Zeitstempel ist keine Auskunft. Ob der Weckruf um 16 Uhr kam oder erst
// um 21 beim Entsperren, ist genau die Frage.
await page.evaluate(async () => {
  const store = await import('./js/store.js');
  store.setSetting('greeted', true);
  store.setSetting('name', 'T');
  store.setSetting('erinnerung', { an: true, werktags: '16:00', wochenende: '06:30' });
  store.setSetting('tab', 'settings');
});
// Erst danach auf den Zettel schreiben: Jede Einstellung stößt erinnerungPflegen()
// an, das den Zettel liest und zurückschreibt. Wer dazwischenfunkt, wird von der
// älteren Fassung überholt – beim ersten Anlauf genau so passiert.
await page.waitForTimeout(500);
await page.evaluate(async () => {
  const { schreibeMerkzettel } = await import('./js/merkzettel.js');
  await schreibeMerkzettel({ geweckt: Date.now() - 5 * 3600000, weckArt: 'push',
                             weckGrund: 'offen' });
});
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(600);
const stand = await page.evaluate(() => {
  const el = document.getElementById('weckStand');
  return el ? el.textContent.replace(/\s+/g, ' ').trim() : null;
});
console.log('     Anzeige:', JSON.stringify(stand));
check(!!stand && /heute um \d{1,2}:\d{2} Uhr/.test(stand),
  `die Anzeige nennt die Uhrzeit, nicht nur den Tag (${stand})`);
check(!!stand && /Push/.test(stand), 'und wodurch geweckt wurde');
check(!!stand && /App war offen/.test(stand), 'und warum nichts kam');

check(errs.length === 0, `keine Fehler${errs.length ? ': ' + errs.slice(0, 2).join(' | ') : ''}`);
await browser.close();
console.log(`\n${fails ? fails + ' FEHLER' : 'alle Prüfungen bestanden'}`);
