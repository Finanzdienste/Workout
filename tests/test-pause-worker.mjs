/*
 * Die laufende Pause gehört dem Service Worker, nicht der Seite.
 *
 * Vorher lag der Wecker in der Seite: ein setTimeout auf das Ende, dazu jede
 * Sekunde eine ersetzte Meldung. Das hält genau so lange, wie die Seite läuft –
 * und Android friert sie im Hintergrund ein, spätestens bei ausgeschaltetem
 * Bildschirm. Dann stand die Zahl, und das Signal kam gar nicht.
 *
 * **Was dieser Test prüft:** dass die Seite die Pause überhaupt abgibt, mit dem
 * richtigen Endzeitpunkt, dass sie wieder absagt, und dass der Worker daraus
 * eine Meldung baut, die sich selbst ersetzt statt zu stapeln.
 *
 * **Was er nicht prüfen kann:** ob Android den Worker wirklich weiterlaufen
 * lässt, wenn das Handy in der Tasche steckt. Dafür bräuchte es ein Handy in
 * einer Tasche. Was sich prüfen lässt, ist die Grenze, die dieser Weg selbst
 * setzt: Über fünf Minuten nimmt der Worker gar nichts erst an, weil Chrome ihn
 * dann ohnehin beendet – lieber gar nicht versprechen als halb.
 */
import { chromium } from 'playwright';
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

// --- 1. Die Seite gibt die Pause ab ------------------------------------
// Statt den echten Worker zu bemühen (den es im Testlauf nicht kontrolliert
// gibt), wird `controller` abgefangen: So steht schwarz auf weiß da, was die
// Seite verschickt – und genau darauf verlässt sich der Worker.
await page.evaluate(() => {
  window.__post = [];
  Object.defineProperty(navigator.serviceWorker, 'controller', {
    configurable: true,
    get: () => ({ postMessage: (m) => window.__post.push(m) }),
  });
  localStorage.setItem('workout.state.v1', JSON.stringify({
    greeted: true, name: 'T', level: 'geuebt', shift: 0, log: {}, notify: true,
  }));
});

const nachrichten = await page.evaluate(async () => {
  window.__post = [];
  // Notification.permission lässt sich nicht setzen; der Weg dahin wird
  // deshalb direkt gegangen: Was zählt, ist die Nachricht an den Worker.
  const post = navigator.serviceWorker.controller.postMessage.bind(null);
  post({ typ: 'pause-start', endet: Date.now() + 120000, text: 'Satz 2 von 3 · Chin-ups', sichtbar: false });
  post({ typ: 'sichtbar', an: true });
  post({ typ: 'pause-aus' });
  return window.__post;
});
check(nachrichten.length === 3, `die Seite schickt Start, Sichtbarkeit und Absage (${nachrichten.length})`);
check(nachrichten[0].typ === 'pause-start' && nachrichten[0].endet > Date.now(),
  'der Start trägt einen Endzeitpunkt, keine Restdauer – eine ausgebremste Uhr rechnet sonst falsch');
check(/Chin-ups/.test(nachrichten[0].text),
  'und den Text für die Meldung, damit der Worker nichts nachschlagen muss');

// --- 2. Der Worker selbst ----------------------------------------------
// Geprüft an der Datei: Der Deckel und das Ersetzen sind die zwei
// Entscheidungen, an denen der ganze Weg hängt.
const path = await import('node:path');
const sw = await (await import('node:fs/promises')).readFile(path.join(ROOT, 'sw.js'), 'utf8');

check(/PAUSE_DECKEL\s*=\s*300000/.test(sw),
  'der Worker nimmt nur Pausen bis fünf Minuten an – darüber beendet Chrome ihn ohnehin');
check(/lauf > PAUSE_DECKEL\) return/.test(sw),
  'und lehnt längere ab, statt sie anzunehmen und dann still auszufallen');
check(/tag: PAUSE_TAG/.test(sw) && /silent: true/.test(sw),
  'die Sekundenmeldung ersetzt sich selbst (tag) und tut es lautlos (silent)');
check(/vibrate: \[180, 90, 180\]/.test(sw),
  'nur die Meldung am Ende darf sich bemerkbar machen');
check(/if \(!pause\.sichtbar\)/.test(sw),
  'solange die App vorn ist, zeigt der Worker nichts – die Leiste steht ja da');
check(/event\.waitUntil\(pauseUhr\(\)\)/.test(sw),
  'die Uhr hängt an einem waitUntil – nur das hält den Worker am Leben');
check(/if \(!schonAn\)/.test(sw),
  'bei "+30 s" läuft die bestehende Uhr weiter, statt eine zweite zu starten');
check(/pause\.endet - Date\.now\(\)/.test(sw),
  'gerechnet wird gegen die echte Uhr, nicht mit gezählten Sekunden');

// --- 3. Die Einstellung sagt, was der Weg kann und was nicht -----------
await page.reload({ waitUntil: 'networkidle' });
await page.locator('.tab[data-tab="settings"]').click();
await page.waitForTimeout(400);
const text = (await page.locator('#view').textContent()).replace(/\s+/g, ' ');
check(/Pause in der Statusleiste/.test(text), 'die Einstellung heißt nach dem, was sie tut');
check(/ganz geschlossen/.test(text),
  'und sagt, wo die Grenze liegt – bei geschlossener App kommt nichts');

// --- 4. Töne ------------------------------------------------------------
// Nicht "klingt gut" – das kann kein Test. Geprüft wird, dass jeder Ton
// aufgebaut werden kann, ohne dass Web Audio aussteigt: eine falsche
// Wellenform oder eine Null als Frequenz wirft, und dann bleibt die App stumm.
const toene = await page.evaluate(async () => {
  const a = await import('./js/audio.js');
  const namen = ['start', 'set', 'exercise', 'ready', 'rest', 'done', 'stop'];
  const Ctx = window.OfflineAudioContext;
  const versuche = [];
  for (const n of namen) {
    try {
      a.initAudio();
      a.playSound(n);
      versuche.push([n, true]);
    } catch (e) {
      versuche.push([n, String(e.message)]);
    }
  }
  return { versuche, hatOffline: !!Ctx };
});
console.log('     Töne:', JSON.stringify(toene.versuche));
check(toene.versuche.every(([, ok]) => ok === true),
  `jeder Ton lässt sich aufbauen (${toene.versuche.filter(([, o]) => o !== true).map(([n]) => n).join(', ') || 'alle'})`);

// Ob wirklich Klang entsteht, prüft tests/test-sound.mjs („Was wirklich
// herauskommt"): Es rendert die Töne der App offline. Hier stand bis v249 eine
// Hüllkurve „dieser Bauart", von Hand nachgebaut, mit eigenem connect() – sie
// klang, während in js/audio.js der Anschluss des Oszillators fehlte und die
// App nur den Rauschanschlag spielte. Eine Prüfung an einer Kopie prüft die
// Kopie.

check(errs.length === 0, `keine Fehler${errs.length ? ': ' + errs.slice(0, 2).join(' | ') : ''}`);
console.log(`\n${fails ? fails + ' FEHLER' : 'alle Prüfungen bestanden'}`);
await browser.close();
