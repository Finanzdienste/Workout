/*
 * Der Punkt am App-Symbol – und dass keine Meldung mehr kommt.
 *
 * Bis v171 stand hier eine Erinnerung in der Statusleiste, ausgelöst von einem
 * Web Push. Beides ist weg, auf Ansage: *„Deaktivier sämtliche Push
 * Benachrichtigungen. Kann man bei der app nicht oben rechts nen Punkt machen?
 * So wie bei WhatsApp wenn man ne neue Nachricht hat?"*
 *
 * **Was dieser Test NICHT prüfen kann, und das ist wichtig:** ob am Handy je
 * ein Punkt erscheint. Chrome auf Android stellt `navigator.setAppBadge` gar
 * nicht bereit – dort entsteht der Punkt nur aus einer ungelesenen Meldung, und
 * die gibt es hier nicht mehr. Ob der Browser den Service Worker weckt, lässt
 * sich von außen ebenfalls nicht auslösen. Beide Hälften sind grundsätzlich
 * unprüfbar; deshalb behauptet die App sie auch nicht, sondern sagt unter Mehr,
 * was dieser Browser kann und wann zuletzt geweckt wurde.
 *
 * Geprüft wird die Hälfte, die hier liegt: *wann* ein Punkt fällig ist, dass er
 * gesetzt und wieder gelöscht wird, dass der Merkzettel für den Worker stimmt –
 * und dass der Push-Weg wirklich zu ist und nicht bloß nicht benutzt wird.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import { ROOT, URL } from './umgebung.mjs';

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 414, height: 896 } });
await ctx.route('**/rest/v1/**', (r) => r.fulfill({ status: 204, body: '' }));
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message));
let fails = 0;
const check = (c, m) => { console.log(`${c ? 'OK  ' : 'FAIL'} ${m}`); if (!c) { fails++; process.exitCode = 1; } };

const setze = (z) => page.evaluate((o) => {
  localStorage.removeItem('workout.rounds.v1');
  localStorage.setItem('workout.state.v1', JSON.stringify(o));
}, z);

/*
 * Den Punkt mitschreiben, statt ihn zu glauben.
 *
 * In einem Testbrowser ohne installierte App bewirkt setAppBadge() nichts
 * Sichtbares – ob die App ihn überhaupt anfordert, wäre damit unprüfbar. Also
 * wird die Stelle ersetzt und protokolliert. Das ist ehrlicher als eine
 * Sichtprüfung, die es hier gar nicht geben kann.
 */
const horcher = () => page.evaluate(() => {
  window.__punkt = [];
  navigator.setAppBadge = (n) => { window.__punkt.push(n === undefined ? 'punkt' : `zahl:${n}`); return Promise.resolve(); };
  navigator.clearAppBadge = () => { window.__punkt.push('weg'); return Promise.resolve(); };
});

const heuteISO = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
  .toISOString().slice(0, 10);

await page.goto(URL, { waitUntil: 'networkidle' });

// --- 1. Der Termin folgt dem Plan --------------------------------------
// Kein einziger Eintrag: Die erste Einheit ist fällig, und weil der Plan
// verpasste Tage nachrückt, liegt sie auf heute.
await setze({ greeted: true, name: 'T', level: 'geuebt', shift: 0, log: {},
  erinnerung: { an: true } });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(400);

const tag = await page.evaluate(async () => (await import('./js/erinnerung.js')).faelligAm());
console.log('     fällig am:', tag);
check(!!tag, 'es gibt einen fälligen Termin');
check(tag === heuteISO(), `und er liegt auf heute (${tag})`);

// --- 2. Der Merkzettel für den Service Worker ---------------------------
// Das ist das Einzige, was der Worker später zu sehen bekommt. Steht hier
// Falsches, setzt er den Punkt am falschen Tag oder gar nicht.
const zettel = await page.evaluate(async () =>
  (await import('./js/merkzettel.js')).liesMerkzettel());
console.log('     Merkzettel:', JSON.stringify(zettel));
check(zettel.an === true, 'der Punkt steht als eingeschaltet drin');
check(zettel.tag === tag, `mit dem fälligen Tag (${zettel.tag})`);
check(zettel.zeigenAb === undefined && zettel.titel === undefined,
  'und ohne Uhrzeit und Meldungstext – beides gehörte zur Meldung, die es nicht mehr gibt');

// --- 3. Der Punkt wird gesetzt und wieder gelöscht ----------------------
await horcher();
await page.evaluate(async () => {
  const store = await import('./js/store.js');
  store.setSetting('name', 'T2');            // irgendeine Änderung – die reicht
});
await page.waitForTimeout(300);
let punkte = await page.evaluate(() => window.__punkt);
check(punkte.includes('punkt'), `eine offene Einheit setzt den Punkt (${JSON.stringify(punkte)})`);
check(!punkte.some((p) => p.startsWith('zahl:')),
  'und zwar als Punkt, nicht als Zahl – gewünscht war „so wie bei WhatsApp"');

// Alles erledigt: Dann gibt es keinen nächsten Termin mehr, und der Punkt muss weg.
await horcher();
await page.evaluate(async () => {
  const store = await import('./js/store.js');
  const { PLAN } = await import('./js/data.js');
  PLAN.forEach((w) => store.completeWorkout(w.n, 'db', w.ex.map((x) => ({ id: x.id, sets: x.sets }))));
});
await page.waitForTimeout(600);
punkte = await page.evaluate(() => window.__punkt);
const fertig = await page.evaluate(async () => ({
  tag: (await import('./js/erinnerung.js')).faelligAm(),
  zettel: await (await import('./js/merkzettel.js')).liesMerkzettel(),
}));
check(fertig.tag === null, 'ist der Plan durch, steht kein Termin mehr an');
check(fertig.zettel.tag === '', 'und der Merkzettel ist leer – der Worker setzt nichts mehr');
check(punkte[punkte.length - 1] === 'weg',
  `zuletzt wurde der Punkt gelöscht (${JSON.stringify(punkte)})`);

// --- 4. Abgeschaltet heißt abgeschaltet ---------------------------------
await setze({ greeted: true, name: 'T', level: 'geuebt', shift: 0, log: {},
  erinnerung: { an: false } });
await page.reload({ waitUntil: 'networkidle' });
await horcher();
await page.evaluate(async () => (await import('./js/store.js')).setSetting('name', 'T3'));
await page.waitForTimeout(300);
const aus = await page.evaluate(async () => ({
  zettel: await (await import('./js/merkzettel.js')).liesMerkzettel(),
  punkte: window.__punkt,
}));
check(aus.zettel.an === false, 'ausgeschaltet steht auch so im Merkzettel');
check(!aus.punkte.includes('punkt'), `und es wird kein Punkt gesetzt (${JSON.stringify(aus.punkte)})`);

// --- 5. Voreingestellt an ----------------------------------------------
// Ein neuer Zustand ohne die Einstellung: Der Punkt soll trotzdem kommen. Ein
// Schalter, den man erst finden muss, ist bei einer Meldung richtig und bei
// einem Punkt am Symbol übertrieben.
await setze({ greeted: true, name: 'T', level: 'geuebt', shift: 0, log: {} });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(400);
const voreingestellt = await page.evaluate(async () =>
  (await import('./js/merkzettel.js')).liesMerkzettel());
check(voreingestellt.an === true, 'ohne gespeicherte Einstellung ist der Punkt an');

// --- 6. Die Bedienung sagt die Wahrheit ---------------------------------
await page.locator('.tab[data-tab="settings"]').click();
await page.waitForTimeout(400);
const text = (await page.locator('#view').textContent()).replace(/\s+/g, ' ');
check(/Punkt am App-Symbol/.test(text), 'die Einstellung steht unter Mehr');
check(/Push ist abgeschaltet/.test(text),
  'und sagt, dass Push abgeschaltet ist – nicht bloß, dass hier nichts davon steht');
// Der Punkt dieser Prüfung ist nicht der Wortlaut, sondern dass die
// Unsicherheit überhaupt dasteht: Ist die App zu, hängt der Punkt daran, ob der
// Browser von sich aus aufwacht. Eine Oberfläche, die das verschweigt,
// verspricht etwas, das sie nicht halten kann.
check(/entscheidet er selbst|das entscheidet er/.test(text),
  'und dass der Browser über den Zeitpunkt entscheidet');
check(/zuletzt geklappt|zuletzt geweckt|noch nie von selbst geweckt/i.test(text),
  'und zeigt, wann es zuletzt wirklich geklappt hat – statt es zu behaupten');

// --- 7. Der Push-Weg ist zu, nicht nur unbenutzt ------------------------
// Eine Zusage, die nur in der Oberfläche steht, hält bis zum nächsten Umbau.
// Deshalb hier am Quelltext: Es gibt niemanden mehr, der eine Meldung zeigen
// oder einen Push entgegennehmen könnte.
const sw = await readFile(path.join(ROOT, 'sw.js'), 'utf8');
const app = await readFile(path.join(ROOT, 'js', 'app.js'), 'utf8');
check(!/addEventListener\('push'/.test(sw), 'sw.js nimmt keinen Push mehr entgegen');
check(!/showNotification\('Training steht an'/.test(sw),
  'und zeigt keine Trainingserinnerung mehr');
check(!/pushManager\.subscribe/.test(app), 'die App meldet sich nirgends mehr für Push an');
check(/pushManager[\s\S]{0,120}unsubscribe/.test(app),
  'sondern löst eine bestehende Anmeldung auf – sonst käme weiter etwas an');

check(errs.length === 0, `keine Fehler${errs.length ? ': ' + errs.slice(0, 2).join(' | ') : ''}`);
console.log(`\n${fails ? fails + ' FEHLER' : 'alle Prüfungen bestanden'}`);
await browser.close();
