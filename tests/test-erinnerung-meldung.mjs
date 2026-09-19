/*
 * Die Erinnerung: ein Symbol, kein „von 84", und einmal am Tag – wegwischbar.
 *
 * Drei Dinge auf einmal, die ersten beiden an einem Bildschirmfoto abgelesen:
 *
 *   *„Da steht noch immer 1/84."* – Der Plan läuft unendlich; am Ende der
 *   Runde beginnt er von selbst wieder bei 1. Eine Gesamtzahl ist damit keine
 *   Auskunft mehr, sondern eine falsche.
 *
 *   *„Außerdem ist zwei mal icon unnötig."* – `icon` und `badge` standen beide
 *   auf derselben Datei. Android zeichnet daraufhin dieselbe Hantel zweimal.
 *
 *   *„Dann lass doch machen dass ich ne einmalige Push Nachricht bekomme, die
 *   ich weg wischen kann."* – Bis v171 galt das Gegenteil: Weggewischt wurde
 *   sie erneut gezeigt, und beim Verlassen der App noch einmal hingelegt. Beide
 *   Wege sind raus. Was die Meldung jetzt auf einen Auftritt am Tag begrenzt,
 *   ist allein der Vermerk `gemeldet` – und genau der wird hier geprüft.
 *
 * Geprüft wird im **echten Service Worker** – dem, den der Browser gerade
 * laufen lässt, mit seinem Merkzettel und seinen Ereignissen. Zwei Zugeständ-
 * nisse an den Testlauf, beide benannt:
 *
 *   * Die Anzeige ist abgefangen. Ein Chromium ohne Bildschirm verweigert
 *     Meldungen grundsätzlich (Notification.permission steht auf 'denied', und
 *     grantPermissions ändert daran nichts). Aufgezeichnet wird deshalb,
 *     **womit** der Worker showNotification aufruft – und darin steckt jede der
 *     drei Entscheidungen.
 *   * Die geschlossene App ist gestellt. Der Worker meldet nur, wenn kein
 *     Fenster offen und sichtbar ist – und in einem Chromium ohne Bildschirm
 *     ist jede Seite „visible", auch eingefroren oder hinter einer zweiten
 *     (nachgemessen: beide Wege ändern den Zustand nicht). Die Seite ganz zu
 *     schliessen wiederum beendet den Worker mitsamt dieser Prüfung. Deshalb
 *     liefert clients.matchAll hier eine leere Liste – genau das, was der
 *     Browser bei geschlossener App liefert.
 *
 * Was ein Testlauf nicht kann, ist wischen wie ein Finger. Das Ereignis, das
 * dabei entsteht, ist aber genau das hier geschickte – und dass darauf nichts
 * mehr folgt, ist die Prüfung.
 */
import { chromium } from 'playwright';
import { URL } from './umgebung.mjs';

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 414, height: 896 } });
await ctx.route('**/rest/v1/**', (r) => r.fulfill({ status: 204, body: '' }));
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message));
let fails = 0;
const check = (c, m) => { console.log(`${c ? 'OK  ' : 'FAIL'} ${m}`); if (!c) { fails++; process.exitCode = 1; } };

await page.goto(URL, { waitUntil: 'networkidle' });

// --- 1. Der Titel, den die Seite dem Worker hinlegt ---------------------
const titel = await page.evaluate(async () => {
  const { erinnerungsStand } = await import('./js/erinnerung.js');
  const stand = erinnerungsStand({ an: true, werktags: '00:01', wochenende: '00:01' });
  return stand && stand.titel;
});
console.log('     Titel:', JSON.stringify(titel));
check(!!titel, 'es gibt einen Titel');
check(!/ von \d+/.test(titel || ''), `ohne „von 84" (${titel})`);
check(!/Workout/.test(titel || ''), `und ohne laufende Nummer (${titel})`);
check(/^\d+ Übungen?$/.test(titel || ''),
  'stattdessen der Umfang der Einheit');

// --- 2. Der laufende Worker --------------------------------------------
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
  // Die geschlossene App – siehe Kopf. Danach wieder zurückgesetzt.
  const echteClients = self.clients.matchAll.bind(self.clients);
  self.clients.matchAll = () => Promise.resolve([]);
  // Und der Punkt am Symbol muss weg, was kein Schönheitsfehler ist:
  // erinnern() stößt setAppBadge an, ohne darauf zu warten, und ein Chromium
  // ohne Bildschirm beendet daraufhin den Worker mitten im Ereignis (nachge-
  // messen: awaited geht es gut, nicht awaited stirbt er, und der Testlauf
  // haengt an dieser Stelle fest). Auf einem Rechner mit installierter App ist
  // das kein Thema – dort gibt es den Punkt wirklich.
  self.navigator.setAppBadge = () => Promise.resolve();
  const heute = heuteISO();
  const nutzlast = { art: 'erinnerung', titel: '6 Übungen' };

  /** Ein Ereignis schicken und seine Zusagen abwarten. Gibt zurück, was dabei
   *  angezeigt wurde. */
  const ereignis = async (typ, daten, aktion) => {
    gezeigt.length = 0;
    const warten = [];
    const ev = new Event(typ);
    ev.notification = { data: daten, close: () => {} };
    if (aktion) ev.action = aktion;
    ev.waitUntil = (p) => warten.push(p);
    self.dispatchEvent(ev);
    await Promise.all(warten);
    return gezeigt.slice();
  };

  const ergebnis = {};
  // Erst prüfen, dass die Seite den Worker sonst sehr wohl erreicht – sonst
  // stünde hier eine leere Liste, weil gar nichts läuft.
  ergebnis.echteClients = (await echteClients({ type: 'window', includeUncontrolled: true })).length;
  ergebnis.clients = (await self.clients.matchAll({ type: 'window', includeUncontrolled: true })).length;

  // a) Die Meldung selbst.
  gezeigt.length = 0;
  await erinnerungZeigen('6 Übungen');
  ergebnis.meldung = gezeigt.slice();

  // b) Weggewischt bleibt weggewischt. Der Zweig, der sie erneut gezeigt hat,
  //    ist raus – das Ereignis geht also ins Leere, und genau das soll es.
  await merkSchreiben({ an: true, tag: heute, zeigenAb: 1, gemeldet: heute });
  ergebnis.nachWischen = await ereignis('notificationclose', nutzlast);

  // c) Und die Seite kann sie auch nicht mehr nachlegen, wenn man die App
  //    verlässt, ohne trainiert zu haben. Die Nachricht gibt es nicht mehr;
  //    käme sie doch von irgendwoher, dürfte nichts passieren.
  const nachricht = async (typ) => {
    gezeigt.length = 0;
    const warten = [];
    const ev = new Event('message');
    ev.data = { typ };
    ev.waitUntil = (p) => warten.push(p);
    self.dispatchEvent(ev);
    await Promise.all(warten);
    return gezeigt.slice();
  };
  ergebnis.beimWeggehen = await nachricht('erinnerung-wieder');

  // d) Der zweite Push des Tages schiebt nichts nach – das ist die Bremse, an
  //    der „einmal am Tag" wirklich hängt, seit das Wischen zählt.
  await merkSchreiben({ an: true, tag: heute, gemeldet: heute });
  gezeigt.length = 0;
  await erinnern(false, null);
  ergebnis.zweiterPush = gezeigt.slice();
  ergebnis.zettelNachZweitem = await merkLesen();

  // e) Am selben Tag, aber noch nicht gemeldet: Dann kommt sie – einmal.
  await merkSchreiben({ an: true, tag: heute, gemeldet: null });
  gezeigt.length = 0;
  await erinnern(false, null);
  ergebnis.ersterPush = gezeigt.slice();
  ergebnis.zettelNachErstem = await merkLesen();

  // f) Die Pausenmeldung: derselbe Worker, dieselbe Frage nach dem Symbol.
  gezeigt.length = 0;
  const start = new Event('message');
  start.data = { typ: 'pause-start', endet: Date.now() + 4000,
                 text: 'Satz 2 von 3 · Chin-ups', sichtbar: false };
  start.waitUntil = () => {};
  self.dispatchEvent(start);
  await new Promise((ok) => setTimeout(ok, 1400));
  ergebnis.pause = gezeigt.slice();
  const aus = new Event('message');
  aus.data = { typ: 'pause-aus' };
  aus.waitUntil = () => {};
  self.dispatchEvent(aus);

  self.clients.matchAll = echteClients;
  return ergebnis;
});

check(lauf.echteClients > 0,
  `der Worker sieht die laufende App (${lauf.echteClients} Fenster) – er läuft also wirklich`);
check(lauf.clients === 0, 'für die Prüfung gilt sie als geschlossen – nur dann meldet er etwas');

// --- 3. Eine Meldung, ein Symbol ---------------------------------------
console.log('     Meldung:', JSON.stringify(lauf.meldung[0]));
check(lauf.meldung.length === 1, `genau eine Meldung (${lauf.meldung.length})`);
const m = lauf.meldung[0] || {};
check(!m.icon,
  `kein grosses Symbol – sonst steht die Hantel zweimal da (icon: ${m.icon || 'leer'})`);
check(/badge-96/.test(m.badge || ''),
  `das kleine ist eine eigene Datei (${m.badge}) – icon-192.png ist deckend und `
  + 'käme als weisser Kasten in der Statusleiste an');
check(m.titel === 'Training steht an' && m.body === '6 Übungen',
  'Titel und Text stehen richtig');
check(!(m.actions || []).length,
  'kein Knopf „Heute nicht" mehr – wischen tut dasselbe und ist der kürzere Weg');
check(m.data && m.data.art === 'erinnerung', 'und sie trägt mit, was sie ist');

// --- 4. Weggewischt bleibt weggewischt ---------------------------------
check(lauf.nachWischen.length === 0,
  `nach dem Wischen kommt sie nicht zurück (${lauf.nachWischen.length})`);
check(lauf.beimWeggehen.length === 0,
  `und die App zu verlassen legt sie auch nicht wieder hin (${lauf.beimWeggehen.length})`);

// --- 5. Einmal am Tag, und nur einmal ----------------------------------
console.log('     erster Push:', JSON.stringify(lauf.ersterPush[0] && lauf.ersterPush[0].body));
check(lauf.ersterPush.length === 1,
  `der erste Push des Tages zeigt sie (${lauf.ersterPush.length})`);
check(!!(lauf.zettelNachErstem && lauf.zettelNachErstem.gemeldet),
  'und vermerkt den Tag – daran hängt alles Weitere');
check(lauf.zweiterPush.length === 0,
  `der zweite Push desselben Tages zeigt nichts (${lauf.zweiterPush.length})`);
check(!!(lauf.zettelNachZweitem && lauf.zettelNachZweitem.weckGrund === 'schon'),
  `und schreibt auf, warum (${lauf.zettelNachZweitem && lauf.zettelNachZweitem.weckGrund})`);

// Und am Quelltext: Die beiden Wege, die sie früher zurückbrachten, sind weg.
// Eine Zusage, die nur im Verhalten eines Testlaufs steht, hält bis zum
// nächsten Umbau – diese hier steht in der Datei.
const swQuelle = await (await import('node:fs/promises'))
  .readFile((await import('node:path')).join((await import('./umgebung.mjs')).ROOT, 'sw.js'), 'utf8');
check(!/addEventListener\('notificationclose'/.test(swQuelle),
  'es gibt keinen Zweig mehr, der auf das Wegwischen reagiert');
check(!/erinnerung-wieder/.test(swQuelle),
  'und keinen, der sie beim Verlassen der App nachlegt');
check(!/heute-nicht/.test(swQuelle),
  'und keinen Ausgang „Heute nicht" – den braucht es nicht mehr');

// --- 6. Auch die Pausenmeldung trägt nur ein Symbol ---------------------
console.log('     Pausenmeldung:', JSON.stringify(lauf.pause[0]));
check(lauf.pause.length > 0 && /^Pause /.test(lauf.pause[0].titel || ''),
  `der Worker zählt die Pause herunter (${lauf.pause.length} Meldungen)`);
check(lauf.pause.length > 0 && !lauf.pause[0].icon, 'und zeigt dabei ebenfalls nur ein Symbol');
check(lauf.pause.length > 0 && /badge-96/.test(lauf.pause[0].badge || ''),
  'dieselbe Schablone auch hier');

check(errs.length === 0, `keine Fehler${errs.length ? ': ' + errs.slice(0, 2).join(' | ') : ''}`);
await browser.close();
console.log(`\n${fails ? fails + ' FEHLER' : 'alle Prüfungen bestanden'}`);
