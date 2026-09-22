/*
 * Die Erinnerung am Trainingstag ist weg – die Pause ist es nicht.
 *
 *     „Mach auch die einmalige Push Nachricht morgens weg. Pausen usw sollen
 *      aber natürlich immer noch mit angezeigt werden"
 *
 * Zwei Hälften, und die zweite ist die wichtigere. Etwas zu entfernen ist
 * leicht; dabei nicht versehentlich das Nachbarstück mitzunehmen, ist die
 * eigentliche Arbeit. Meldung und Pausenmeldung liefen beide über
 * `showNotification` im selben Service Worker – wer die eine herausschneidet,
 * kann die andere mit erwischen, und auffallen würde das erst mitten im
 * Training, wenn der Ton am Pausenende ausbleibt.
 *
 * Geprüft wird deshalb:
 *
 *   1. dass der Weg zur Morgenmeldung nirgends mehr existiert – nicht nur die
 *      Meldung, sondern auch periodicsync, der Push-Empfang, der Merkzettel,
 *      die Module und der Wecker bei GitHub;
 *   2. dass die App trotzdem lädt und die Einstellungen keine Leichen zeigen;
 *   3. dass die Pause nach wie vor eine Meldung erzeugt.
 *
 * Für (1) wird am Quelltext geprüft und nicht am Bildschirm: Ein Testlauf kann
 * `periodicsync` und `push` gar nicht auslösen, ein Test dafür bestünde also
 * auch dann, wenn die Ereignisse noch da wären. Was es nicht gibt, kann nicht
 * erscheinen – und genau das lässt sich lesen.
 */
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import { URL, ROOT } from './umgebung.mjs';

let fails = 0;
const check = (c, m) => { console.log(`${c ? 'OK  ' : 'FAIL'} ${m}`); if (!c) { fails++; process.exitCode = 1; } };
const da = async (rel) => !!(await fs.stat(path.join(ROOT, rel)).catch(() => null));

/* --- 1. Der Weg dorthin existiert nicht mehr ---------------------------- */
const sw = await fs.readFile(path.join(ROOT, 'sw.js'), 'utf8');
check(!/showNotification\(\s*['"]Training steht an/.test(sw),
  'der Service Worker zeigt kein „Training steht an" mehr');
check(!/addEventListener\(\s*['"]periodicsync/.test(sw),
  'und meldet sich nicht mehr auf periodicsync');
check(!/addEventListener\(\s*['"]push['"]/.test(sw),
  'und nimmt keinen Web Push mehr entgegen');
check(!/indexedDB/.test(sw),
  'der Merkzettel in IndexedDB ist mit raus – er hatte keinen anderen Leser');

for (const rel of ['js/push.js', 'js/erinnerung.js', 'js/merkzettel.js',
                   '.github/workflows/push-erinnerung.yml']) {
  check(!(await da(rel)), `${rel} ist gelöscht`);
}

const app = await fs.readFile(path.join(ROOT, 'js', 'app.js'), 'utf8');
check(!/PUSH_KONFIG/.test(app),
  'die Anleitung für das GitHub-Secret steht nicht mehr in der App');
check(!/periodicSync\.register/.test(app),
  'und es wird sich nichts mehr bei periodicsync angemeldet');

// Der Zwischenspeicher darf keine Datei mehr nennen, die es nicht gibt: Der
// Service Worker holt jede Zeile der Liste einzeln, ein Fehlschlag bleibt
// stumm – die Liste wäre also falsch, ohne dass es jemand merkt.
const genannt = [...sw.matchAll(/'\.\/(js\/[\w-]+\.js)'/g)].map((m) => m[1]);
const fehlend = [];
for (const rel of genannt) if (!(await da(rel))) fehlend.push(rel);
check(!fehlend.length, `jede Datei im Zwischenspeicher existiert${fehlend.length ? ': ' + fehlend.join(', ') : ''}`);

/* --- 2. Die App läuft, und zwar ohne Reste ------------------------------ */
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 414, height: 896 } });
await ctx.route('**/rest/v1/**', (r) => r.fulfill({ status: 204, body: '' }));
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()); });

await page.goto(URL, { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.setItem('workout.state.v1', JSON.stringify({
  greeted: true, name: 'T', level: 'geuebt', shift: 0, log: {},
  // Eine alte Sicherung bringt die Einstellung mit. Sie darf nichts mehr tun,
  // aber auch nichts kaputt machen.
  erinnerung: { an: true, werktags: '16:00', wochenende: '06:30' },
})));
await page.reload({ waitUntil: 'networkidle' });
await page.locator('.tab[data-tab="settings"]').click();
await page.waitForTimeout(500);

const text = (await page.locator('#view').textContent()).replace(/\s+/g, ' ');
check(!/Erinnerung am Trainingstag/.test(text), 'der Abschnitt steht nicht mehr unter Mehr');
check(!/Push einrichten/.test(text), 'und auch kein „Push einrichten"');
check(!/zuletzt geweckt/i.test(text), 'und keine Anzeige, wann zuletzt geweckt wurde');
check(await page.locator('[data-act="toggle-erinnerung"], [data-act="push-einrichten"]').count() === 0,
  'die Knöpfe dazu gibt es nicht mehr');
// Die Ansage aus demselben Satz: Alles zur Pause bleibt stehen.
check(/Ton und Vibration|Signalton|Pause/.test(text),
  'die Einstellungen zur Pause stehen weiter da');
check(errs.length === 0, `keine Fehler beim Laden${errs.length ? ': ' + errs.slice(0, 2).join(' | ') : ''}`);

/* --- 3. Die Pause meldet sich weiterhin --------------------------------- */
//
// Die zweite Hälfte der Ansage, und die wichtigere. Dass die Meldung am
// Pausenende wirklich erscheint, prüft tests/test-pause-worker.mjs am echten
// Worker – der Test lief vor dieser Änderung und läuft danach, und genau das
// ist der Nachweis. Hier steht nur, dass die Teile noch da sind, damit ein
// Fehlschlag sofort hierher zeigt statt in einen fremden Testlauf.
check(/addEventListener\(\s*['"]message['"]/.test(sw) && /pause-start/.test(sw),
  'der Worker nimmt „pause-start" von der Seite weiter entgegen');
check(/Pause vorbei/.test(sw) && /vibrate/.test(sw),
  'die Endmeldung samt Vibration steht unverändert drin');
check(/showNotification/.test(sw),
  'Meldungen an sich kann er weiterhin – nur die morgens nicht mehr');
check(/addEventListener\(\s*['"]notificationclick/.test(sw),
  'und ein Tipp darauf bringt die App weiterhin nach vorn');

console.log(`\n${fails ? fails + ' FEHLER' : 'alle Prüfungen bestanden'}`);
await browser.close();
