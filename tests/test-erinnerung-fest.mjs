/*
 * Die Erinnerung: ein Symbol, kein „von 84", und weggewischt kommt sie zurück.
 *
 * Drei Dinge auf einmal, alle drei am selben Bildschirmfoto abgelesen:
 *
 *   *„Da steht noch immer 1/84."* – Der Plan läuft unendlich; am Ende der
 *   Runde beginnt er von selbst wieder bei 1. Eine Gesamtzahl ist damit keine
 *   Auskunft mehr, sondern eine falsche.
 *
 *   *„Außerdem ist zwei mal icon unnötig."* – `icon` und `badge` standen beide
 *   auf derselben Datei. Android zeichnet daraufhin dieselbe Hantel zweimal.
 *
 *   *„Außerdem kann ichs wegwischen aber es soll fest sein."* – `requireInter-
 *   action` steht seit jeher in den Optionen und hilft auf Android nicht;
 *   Chrome kennt das Feld dort nicht. Was trägt, ist der Weg über
 *   `notificationclose`: weggewischt wird sie erneut gezeigt.
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
 * dabei entsteht, ist aber genau das hier geschickte.
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
check(/^Workout \d+ · \d+ Übungen?$/.test(titel || ''),
  'stattdessen die Nummer und der Umfang der Einheit');

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
  const heute = heuteISO();
  const nutzlast = { art: 'erinnerung', titel: 'Workout 7 · 6 Übungen' };

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
  await erinnerungZeigen('Workout 7 · 6 Übungen');
  ergebnis.meldung = gezeigt.slice();

  // b) Weggewischt kommt sie zurück – aber nur, wenn sie von heute ist und
  //    heute auch wirklich noch eine Einheit offen steht.
  await merkSchreiben({ an: true, tag: heute, zeigenAb: 1, gemeldet: heute, wegAm: null });
  ergebnis.nachWischen = await ereignis('notificationclose', nutzlast);

  // b2) Ist die Einheit erledigt, zeigt der Merkzettel auf den nächsten Termin –
  //     und dann klebt die Meldung nicht weiter auf dem Bildschirm. Das ist die
  //     eine Lage, in der „nicht wegwischbar" nur noch nerven würde.
  await merkSchreiben({ tag: '2099-01-01', gemeldet: heute, wegAm: null });
  ergebnis.nachTraining = await ereignis('notificationclose', nutzlast);

  // c) Ist „Heute nicht" vermerkt, bleibt sie weg. (Dass der Knopf den Vermerk
  //    setzt, steht weiter unten – ein nachgestelltes notificationclick bringt
  //    den Worker im Testlauf zum Stehen.)
  await merkSchreiben({ tag: heute, gemeldet: heute, wegAm: heute });
  ergebnis.nachAbsage = await ereignis('notificationclose', nutzlast);

  // d) Eine Meldung von gestern schiebt nichts nach.
  await merkSchreiben({ tag: heute, gemeldet: '2020-01-01', wegAm: null });
  ergebnis.zettel = await merkLesen();
  ergebnis.vonGestern = await ereignis('notificationclose', nutzlast);

  // e) Eine fremde Meldung – etwa die Pause – auch nicht.
  await merkSchreiben({ tag: heute, gemeldet: heute, wegAm: null });
  ergebnis.fremd = await ereignis('notificationclose', {});

  // e2) Die App verlassen, ohne trainiert zu haben: Die Seite meldet sich, und
  //     der Worker legt die Erinnerung wieder hin. Ohne das war sie nach einem
  //     Antippen für den Tag verbraucht – der wahrscheinlichste Weg, sie
  //     loszuwerden, ganz ohne Wischen.
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
  await merkSchreiben({ an: true, tag: heute, zeigenAb: 1, wegAm: null,
                        titel: 'Workout 7 · 6 Übungen' });
  ergebnis.beimWeggehen = await nachricht('erinnerung-wieder');
  // Aber nicht nach „Heute nicht", und nicht vor der eingestellten Uhrzeit.
  await merkSchreiben({ wegAm: heute });
  ergebnis.weggehenAbgesagt = await nachricht('erinnerung-wieder');
  await merkSchreiben({ wegAm: null, zeigenAb: Date.now() + 3600000 });
  ergebnis.weggehenZuFrueh = await nachricht('erinnerung-wieder');

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
check(m.titel === 'Training steht an' && m.body === 'Workout 7 · 6 Übungen',
  'Titel und Text stehen richtig');
check((m.actions || []).some((a) => a.action === 'heute-nicht'),
  'sie hat einen ausdrücklichen Ausgang: „Heute nicht"');
check(m.data && m.data.art === 'erinnerung',
  'und trägt mit, was sie ist – daran erkennt sie der Wisch-Zweig wieder');

// --- 4. Weggewischt kommt sie zurück ------------------------------------
console.log('     Nach dem Wischen:', JSON.stringify(lauf.nachWischen[0]));
check(lauf.nachWischen.length === 1, `die Meldung steht wieder da (${lauf.nachWischen.length})`);
check(lauf.nachWischen[0] && lauf.nachWischen[0].body === 'Workout 7 · 6 Übungen',
  'mit demselben Text');

check(lauf.nachTraining.length === 0,
  `nach getaner Einheit klebt sie nicht weiter (${lauf.nachTraining.length})`);

// --- 4b. Die App verlassen, ohne trainiert zu haben ---------------------
console.log('     beim Weggehen:', JSON.stringify(lauf.beimWeggehen[0] && lauf.beimWeggehen[0].body));
check(lauf.beimWeggehen.length === 1,
  `wer die App verlässt, ohne trainiert zu haben, findet sie wieder vor (${lauf.beimWeggehen.length})`);
check(lauf.weggehenAbgesagt.length === 0,
  'nach „Heute nicht" aber nicht');
check(lauf.weggehenZuFrueh.length === 0,
  'und vor der eingestellten Uhrzeit auch nicht – die Zeit gilt weiter');

// --- 5. „Heute nicht" beendet sie wirklich ------------------------------
check(lauf.nachAbsage.length === 0,
  `mit dem Vermerk bleibt sie weg (${lauf.nachAbsage.length}) – fest heisst nicht: nicht loszuwerden`);
check(lauf.zettel && lauf.zettel.wegAm !== undefined,
  'der Vermerk steht im Merkzettel, den auch die App liest');

// Dass der Knopf ihn setzt, steht am Quelltext: Ein nachgestelltes
// notificationclick bringt den Worker im Testlauf zum Stehen – dispatchEvent
// mit einem gebauten Ereignis dieses Typs kehrt nicht zurück (nachgemessen).
// Der Zweig ist drei Zeilen lang; ihn dafür umzubauen wäre der falsche Preis.
const swQuelle = await (await import('node:fs/promises'))
  .readFile((await import('node:path')).join((await import('./umgebung.mjs')).ROOT, 'sw.js'), 'utf8');
check(/const nurWeg = daten\.art === 'erinnerung' && event\.action === 'heute-nicht'/.test(swQuelle),
  'der Knopf „Heute nicht" wird im Worker unterschieden – und nur an der Erinnerung');
check(/merkSchreiben\(\{ wegAm: heuteISO\(\) \}\)/.test(swQuelle),
  'und schreibt den Vermerk, der die Meldung beendet');
check(/if \(nurWeg\) \{[\s\S]{0,300}return;\s*\}/.test(swQuelle),
  'er öffnet dabei die App nicht – wer „Heute nicht" tippt, will sie nicht sehen');
// Und umgekehrt: Die App zu öffnen ist kein Ausgang mehr. Stünde hier noch ein
// zweiter Zweig, der wegAm setzt, wäre die Erinnerung nach einem Antippen
// wieder für den Tag verbraucht – genau die Lücke, um die es ging.
check((swQuelle.match(/merkSchreiben\(\{ wegAm: heuteISO\(\) \}\)/g) || []).length === 1,
  'und es gibt genau eine Stelle, die den Tag absagt');

// --- 6. Was nicht nachgeschoben wird -----------------------------------
check(lauf.vonGestern.length === 0,
  `eine Meldung von gestern schiebt nichts nach (${lauf.vonGestern.length})`);
check(lauf.fremd.length === 0,
  `und eine fremde Meldung auch nicht (${lauf.fremd.length})`);

// --- 7. Auch die Pausenmeldung trägt nur ein Symbol ---------------------
console.log('     Pausenmeldung:', JSON.stringify(lauf.pause[0]));
check(lauf.pause.length > 0 && /^Pause /.test(lauf.pause[0].titel || ''),
  `der Worker zählt die Pause herunter (${lauf.pause.length} Meldungen)`);
check(lauf.pause.length > 0 && !lauf.pause[0].icon, 'und zeigt dabei ebenfalls nur ein Symbol');
check(lauf.pause.length > 0 && /badge-96/.test(lauf.pause[0].badge || ''),
  'dieselbe Schablone auch hier');

check(errs.length === 0, `keine Fehler${errs.length ? ': ' + errs.slice(0, 2).join(' | ') : ''}`);
await browser.close();
console.log(`\n${fails ? fails + ' FEHLER' : 'alle Prüfungen bestanden'}`);
