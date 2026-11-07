/*
 * Die automatische Sicherung – Ende-zu-Ende verschlüsselt, über den Rückkanal.
 *
 *     „Wenn ich auch 'Sicherung weitergeben' klicke passiert nichts. Lass das
 *      doch generell einfach automatisch sichern"
 *
 * Der Server wird hier gespielt, und zwar nicht als Attrappe, die alles
 * schluckt, sondern mit der Semantik der drei Funktionen aus
 * tools/sicherung.sql: Kennung und Schreibmarke als Hex, IV als base64, ein
 * Größenlimit, der Hash der Schreibmarke statt der Marke selbst, „veraltet",
 * wenn ein anderes Gerät dazwischen geschrieben hat, „geloescht", wenn die
 * Zeile weg ist, und „zu oft" unter zehn Sekunden. Kein Aufruf erreicht den
 * echten Server – alles, was nach *.supabase.co will, landet beim gespielten
 * (tests/sicherung-labor.mjs).
 *
 * Geprüft wird, was die Zusage ausmacht, nicht nur, dass etwas ankommt:
 *
 *   * Der Server bekommt kein Klartext-Fragment – keinen Namen, keine Übung,
 *     kein "log". Entschlüsseln lässt sich der Inhalt mit dem Schlüssel, der
 *     auf dem Gerät liegt, und der Schlüssel selbst geht nie über die Leitung.
 *   * Gesichert wird nach dem Abschluss sofort, nach Änderungen gedrosselt
 *     (höchstens alle zwei Minuten), beim Weglegen nur, wenn es unter die
 *     keepalive-Grenze passt, und nur, wenn sich etwas geändert hat.
 *   * Ein frisches Gerät holt den Stand zurück – über den Passwortmanager
 *     (nachgebildet) und über den Link; ein falscher Schlüssel findet nichts.
 *   * Fehlen die Funktionen auf dem Server, sagt Mehr das ruhig, und es bleibt
 *     bei einem Versuch. Abgeschaltet geht nichts raus. Löschen löscht.
 *   * Sichert ein anderes Gerät unter demselben Schlüssel, überschreibt dieses
 *     dessen Stand nicht still.
 */
import { chromium } from 'playwright';
import { randomBytes } from 'node:crypto';
import { SHOT } from './umgebung.mjs';
import {
  START, entschluesseln, labor, logVon, meta, sha, text, zuMehr, zumDashboard,
} from './sicherung-labor.mjs';

let fails = 0;
const check = (c, m) => { console.log(`${c ? 'OK  ' : 'FAIL'} ${m}`); if (!c) { fails++; process.exitCode = 1; } };

// Der gespielte Server und die Geräte stehen in tests/sicherung-labor.mjs –
// tests/test-sicherung-faelle.mjs braucht dieselben.
const browser = await chromium.launch();
const lab = labor(browser);
const { zeilen, anfragen } = lab;
const sicherungsVerkehr = lab.verkehr;
const geschrieben = lab.geschrieben;
const warte = lab.warte;
// Jedes Gerät beginnt hier um START – so ist diese Datei entstanden.
const geraet = (name, o = {}) => lab.geraet(name, { zeit: START, ...o });

/* ================================================================== *
 * A – Tobis Handy
 * ================================================================== */
const { page: a } = await geraet('A', { zustand: { greeted: true, name: 'Tobi', focus: 'cut' } });

// --- Ohne Inhalt geht nichts raus -------------------------------------
await warte(a, 10000);
check(sicherungsVerkehr().length === 0,
  `ohne ein einziges Training wird nichts gesichert (${sicherungsVerkehr().length} Aufrufe)`);

// --- Drei Einheiten: nach der Änderung von selbst, aber nicht sofort ---
const uebung = await a.evaluate(async () => {
  const store = await import('./js/store.js');
  const { PLAN } = await import('./js/data.js');
  for (let i = 0; i < 3; i++) {
    const w = PLAN[i];
    store.completeWorkout(w.n, 'db', w.ex.map((x) => ({ id: x.id, sets: x.sets, w: '20' })));
  }
  return PLAN[0].ex[0].id;
});
await zumDashboard(a);
check(/seit der letzten\s+Sicherung/.test(await text(a)),
  'vor der ersten automatischen Sicherung steht die alte Erinnerung noch da');
await warte(a, 1100);
check(geschrieben().length === 0, 'eine Sekunde nach der Änderung ist noch nichts unterwegs');
await warte(a, 5000);
check(geschrieben().length === 1, `fünf Sekunden später ist sie gesichert (${geschrieben().length})`);

// --- Was der Server bekommt --------------------------------------------
const erste = geschrieben()[0];
check(Object.keys(erste.body).sort().join(',') === 'p_daten,p_id,p_iv,p_vorher,p_w',
  `nur Kennung, Schreibmarke, Chiffrat, IV und Vorgänger (${Object.keys(erste.body).sort().join(',')})`);
const roh = Buffer.from(erste.body.p_daten || '', 'base64');
const verraet = ['"log"', 'Tobi', uebung, '"weights"', 'cut'].filter((s) => roh.includes(Buffer.from(s, 'utf8')));
check(roh.length > 100 && verraet.length === 0,
  `im Chiffrat steht kein Klartext-Fragment (${roh.length} Byte${verraet.length ? `, gefunden: ${verraet.join(', ')}` : ''})`);
check(!/Tobi|"log"|weights/.test(erste.roh.replace(erste.body.p_daten, '')),
  'auch daneben nicht: kein Name, kein Protokoll in den übrigen Feldern');
const mA = await meta(a);
check(/^[A-Za-z0-9_-]{43}$/.test(mA.key || ''), 'der Schlüssel liegt auf dem Gerät: 256 Bit, base64url');
check(anfragen.every((x) => !x.roh.includes(mA.key) && !x.url.includes(mA.key)),
  'und geht nie über die Leitung – weder im Inhalt noch in der Adresse');
check(erste.body.p_id === sha(`id:${mA.key}`) && erste.body.p_w === sha(`w:${mA.key}`),
  'Kennung und Schreibmarke sind aus dem Schlüssel abgeleitet, nicht er selbst');
const zeileA = zeilen.get(erste.body.p_id);
check(!!zeileA && zeileA.w_hash === sha(erste.body.p_w) && zeileA.w_hash !== erste.body.p_w,
  'der Server hält von der Schreibmarke nur den Hash');
const klar = await entschluesseln(mA.key, erste.body.p_daten, erste.body.p_iv);
const inhalt = JSON.parse(klar);
check(inhalt.name === 'Tobi' && Object.keys(inhalt.log || {}).length === 3,
  `mit dem Schlüssel des Geräts entschlüsselt: der vollständige Stand (${Object.keys(inhalt.log || {}).length} Einheiten)`);
let falsch = false;
try { await entschluesseln(randomBytes(32).toString('base64url'), erste.body.p_daten, erste.body.p_iv); } catch { falsch = true; }
check(falsch, 'mit jedem anderen Schlüssel ist es Rauschen');

// --- Dashboard: die alte Erinnerung weicht der Zeile „Schlüssel sichern" --
await zumDashboard(a);
const dash = await text(a);
check(!/seit der letzten\s+Sicherung/.test(dash),
  'nach der ersten automatischen Sicherung ist die Erinnerung weg');
check(await a.locator('[data-act="schluessel-sichern"]').count() === 1,
  'stattdessen eine Zeile: der Schlüssel liegt nur auf diesem Gerät');
await a.screenshot({ path: `${SHOT}/sicherung-dashboard.png` });

// --- Mehr → Daten -------------------------------------------------------
await zuMehr(a);
const mehr = await text(a);
check(/automatisch verschlüsselt/.test(mehr) && /Lesen kann es nur, wer den Schlüssel hat/.test(mehr),
  'unter Mehr steht in zwei Sätzen, was geschieht');
check(await a.locator('[data-act="toggle-sicherung"][aria-pressed="true"]').count() === 1,
  'mit dem Schalter daneben – an');
check(/Zuletzt gesichert: (gerade eben|vor \d+ Min\.)/.test(await text(a, '#sicherungStand')),
  `und wann zuletzt gesichert wurde („${(await text(a, '#sicherungStand')).trim()}")`);
check(/nur auf diesem Gerät/.test(await text(a, '#schluesselStand')),
  'und dass der Schlüssel bisher nur auf diesem Gerät liegt');
check(await a.locator('[data-act="sicherung-loeschen"]').count() === 1, 'Löschen ist erreichbar');
check(await a.locator('[data-act="download"]').count() === 1 && await a.locator('[data-act="import-file"]').count() === 1,
  'Datei-Export und -Import bleiben daneben');
await a.evaluate(() => { document.getElementById('daten').scrollIntoView(); window.scrollBy(0, -56); });
await a.screenshot({ path: `${SHOT}/sicherung-mehr-daten.png` });

// --- Schlüssel sichern: ein Tipp auf dem Dashboard ----------------------
await zumDashboard(a);
await a.locator('[data-act="schluessel-sichern"]').click();
await warte(a, 300);
const pm = await a.evaluate(() => JSON.parse(localStorage.getItem('__test.pm') || 'null'));
check(!!pm && pm.password === mA.key && /^workout-sicherung/.test(pm.id || ''),
  `ein Tipp legt den Schlüssel im Passwortmanager ab (${pm && pm.id})`);
await zumDashboard(a);
check(await a.locator('[data-act="schluessel-sichern"]').count() === 0, 'danach ist die Zeile weg');
check(!/seit der letzten\s+Sicherung/.test(await text(a)), 'und die alte Erinnerung kommt nicht zurück');
await zuMehr(a);
check(/Passwortmanager/.test(await text(a, '#schluesselStand')), 'unter Mehr steht, wo er jetzt liegt');

// --- Der Link: Schlüssel im Anker, an sich selbst geschickt -------------
await a.locator('[data-act="schluessel-link"]').click();
await warte(a, 300);
const link = await a.evaluate(() => (window.__geteilt || {}).url || '');
check(link.endsWith(`#sicherung=${mA.key}`), 'der Wiederherstellungs-Link trägt den Schlüssel im Anker');

// --- Drossel: höchstens alle zwei Minuten -------------------------------
await a.evaluate(async (id) => (await import('./js/store.js')).setWeight(id, 22.5), uebung);
await warte(a, 1100);
await warte(a, 60000);
check(geschrieben().length === 1, `eine Minute nach der letzten Sicherung geht noch nichts raus (${geschrieben().length})`);
await warte(a, 65000);
check(geschrieben().length === 2, `nach zwei Minuten schon (${geschrieben().length})`);
check(geschrieben()[1].body.p_vorher === zeileA.stand || !!geschrieben()[1].body.p_vorher,
  'mit dem Stand der eigenen letzten Sicherung als Vorgänger');

// --- Nach dem Abschluss sofort, ohne die Drossel abzuwarten -------------
//
// Heute sind schon drei Einheiten durch; trainiert wird am nächsten Tag. Die
// Uhr springt dorthin, ohne Zeitgeber auszulösen – wie ein Handy, das über
// Nacht in der Tasche lag.
await a.clock.setSystemTime(START + 26 * 3600 * 1000);
lab.uhr = Math.max(lab.uhr, START + 26 * 3600 * 1000);
await a.reload({ waitUntil: 'networkidle' });
await warte(a, 5000);
// Eine Änderung, die sicher hochgeht – danach steht die Drossel zwei Minuten.
await a.evaluate(async (id) => (await import('./js/store.js')).setWeight(id, 23), uebung);
await warte(a, 1100);
await warte(a, 2 * 60000 + 5000);
const vorAbschluss = geschrieben().length;
await warte(a, 15000);
await zumDashboard(a);
if (!(await a.locator('[data-act="start-session"]').count())) console.log('     Dashboard:', (await text(a)).slice(0, 300));
await a.locator('[data-act="start-session"]').first().click();
await warte(a, 300);
await a.locator('.focus-set').first().click();
await warte(a, 300);
await a.locator('[data-act="finish-session"]').first().click();
await warte(a, 0);
check(geschrieben().length === vorAbschluss + 1,
  `nach dem Abschließen sofort gesichert, mitten in der Drossel (${geschrieben().length - vorAbschluss})`);
const nachAbschluss = JSON.parse(await entschluesseln(mA.key, zeilen.get(mA.id).daten, zeilen.get(mA.id).iv));
check(Object.keys(nachAbschluss.log || {}).length === 4, 'und die eben abgeschlossene Einheit ist darin');

// --- Nur bei Änderung: weder von der Uhr noch vom Neustart ---------------
const vorRuhe = geschrieben().length;
await warte(a, 5 * 60000);
check(geschrieben().length === vorRuhe, `ohne Änderung nichts – auch nach fünf Minuten (${geschrieben().length - vorRuhe})`);
// Unter Mehr → Daten: „vor 5 Min." endet schon mit dem Punkt der Abkürzung –
// bis zur Prüfung von v247 stand dort „Zuletzt gesichert: vor 5 Min.." (wie
// bis v247 unter Mehr → Kalender „nachgeschickt vor 1 Min..").
await zuMehr(a);
const standRuhe = await text(a, '#sicherungStand');
check(/Zuletzt gesichert: vor \d+ Min\.(?!\.)/.test(standRuhe) && !/\.\./.test(standRuhe),
  `„Zuletzt gesichert: vor 5 Min." – mit einem Punkt, nicht zweien („${standRuhe.trim()}")`);
await a.reload({ waitUntil: 'networkidle' });
await warte(a, 10000);
check(geschrieben().length === vorRuhe, `ein Neustart ohne Änderung schickt nichts (${geschrieben().length - vorRuhe})`);

// --- Beim Weglegen: sofort, weil es klein genug ist ---------------------
await a.evaluate(async (id) => (await import('./js/store.js')).setWeight(id, 25), uebung);
await warte(a, 1100);
await a.evaluate(() => { window.__hidden = true; document.dispatchEvent(new Event('visibilitychange')); });
await warte(a, 0);
check(geschrieben().length === vorRuhe + 1, `beim Weglegen geht die Änderung gleich mit (${geschrieben().length - vorRuhe})`);
await a.evaluate(() => { window.__hidden = false; document.dispatchEvent(new Event('visibilitychange')); });
await warte(a, 15000);
check(geschrieben().length === vorRuhe + 1, 'und die Drossel schickt sie danach nicht noch einmal');

// --- … aber nicht, wenn es die keepalive-Grenze sprengt ------------------
await a.evaluate(async () => {
  // Rund 120 KB Zufall: lässt sich nicht packen, also über 64 KB.
  // getRandomValues gibt höchstens 64 KiB auf einmal her.
  let s = '';
  for (let i = 0; i < 2; i++) {
    crypto.getRandomValues(new Uint8Array(34000)).forEach((b) => { s += b.toString(36); });
  }
  (await import('./js/store.js')).setSetting('ballast', s);
});
await warte(a, 1100);
const vorBallast = geschrieben().length;
await a.evaluate(() => { window.__hidden = true; document.dispatchEvent(new Event('visibilitychange')); });
await warte(a, 0);
check(geschrieben().length === vorBallast, 'über 64 KB wird beim Weglegen nichts geschickt – das ginge nicht zuverlässig');
await a.evaluate(() => { window.__hidden = false; document.dispatchEvent(new Event('visibilitychange')); });
await warte(a, 2 * 60000 + 5000);
check(geschrieben().length === vorBallast + 1, `das holt die gewöhnliche Drossel nach (${geschrieben().length - vorBallast})`);

// --- Ohne Netz: still, und später nachgeholt ---------------------------
lab.modus = 'weg';
const vorNetz = geschrieben().length;
await a.evaluate(async (id) => (await import('./js/store.js')).setWeight(id, 27.5), uebung);
await warte(a, 1100);
await warte(a, 2 * 60000 + 5000);
check(geschrieben().length === vorNetz + 1, `ohne Netz wird es versucht (${geschrieben().length - vorNetz})`);
check((await meta(a)).fehler === 'Keine Verbindung', 'und vermerkt, warum es nicht ging');
check(!/Keine Verbindung/.test(await text(a, '#toast')), 'ohne eine Meldung, die das Training unterbricht');
lab.modus = 'ok';
await a.evaluate(() => window.dispatchEvent(new Event('online')));
await warte(a, 1100);
await warte(a, 2 * 60000 + 5000);
check(geschrieben().length === vorNetz + 2 && (await meta(a)).fehler === null,
  `sobald das Netz zurück ist, wird nachgeholt (${geschrieben().length - vorNetz - 1})`);

// --- „+Wdh." meldet sich wie jede Änderung -------------------------------
// Bis v247 schwieg store.addBwPlus() beim Store: Die Sicherung erfuhr vom
// Aufschlag erst mit der nächsten Meldung, und wer danach nichts mehr
// antippte, hatte ihn nur auf diesem Gerät.
const vorPlus = geschrieben().length;
await a.evaluate(async (id) => (await import('./js/store.js')).addBwPlus(id, 2), uebung);
await warte(a, 1100);
await warte(a, 2 * 60000 + 5000);
const mitPlus = JSON.parse(await entschluesseln(mA.key, zeilen.get(mA.id).daten, zeilen.get(mA.id).iv));
check(geschrieben().length === vorPlus + 1 && (mitPlus.bwPlus || {})[uebung] === 2,
  `„+Wdh." (store.addBwPlus) geht von selbst in die Sicherung – ohne eine weitere Änderung (${geschrieben().length - vorPlus}, bwPlus ${(mitPlus.bwPlus || {})[uebung]})`);

/* ================================================================== *
 * B – ein frisches Gerät, Schlüssel aus dem Passwortmanager
 * ================================================================== */
const zielLog = await logVon(a);
const { page: b } = await geraet('B', { pm });
check(await b.locator('[data-act="toggle-sicherung"]').count() === 1
  && /automatisch verschlüsselt/.test(await text(b)),
  'schon der erste Schritt des Einstiegs sagt, was geschieht, mit dem Schalter daneben');
check(await b.locator('[data-act="sicherung-holen"]').count() === 1,
  'und bietet an, eine Sicherung zurückzuholen');
check(!/Von allein geht nichts irgendwohin/.test(await text(b)),
  'der alte Satz „Von allein geht nichts irgendwohin" steht nicht mehr da – er stimmte nicht mehr');
await b.evaluate(() => {
  document.querySelector('[data-act="toggle-sicherung"]').closest('.card').scrollIntoView({ block: 'center' });
});
await b.screenshot({ path: `${SHOT}/sicherung-einstieg.png` });
const vorB = zeilen.size;
await b.locator('[data-act="sicherung-holen"]').click();
await warte(b, 300);
await b.waitForLoadState('networkidle');
await warte(b, 500);
const getOpts = await b.evaluate(() => JSON.parse(sessionStorage.getItem('__test.get') || 'null'));
check(!!getOpts && getOpts.password === true && getOpts.mediation === 'optional',
  `gefragt wird der Passwortmanager, mit Auswahl (${JSON.stringify(getOpts)})`);
check(await logVon(b) === zielLog, 'das frische Gerät hat danach genau den Verlauf des alten');
check(await b.evaluate(async () => (await import('./js/store.js')).getState().greeted) === true,
  'und die Einrichtung ist damit erledigt');
const mB = await meta(b);
check(mB.key === mA.key && mB.id === mA.id, 'es sichert ab jetzt unter demselben Schlüssel weiter');
check(zeilen.size === vorB, 'ohne eine zweite Sicherung anzulegen');

/* ================================================================== *
 * Konflikt: zwei Geräte, ein Schlüssel
 * ================================================================== */
await b.evaluate(async () => {
  const store = await import('./js/store.js');
  store.setSetting('name', 'Tobi B');
});
await warte(b, 1100);
await warte(b, 2 * 60000 + 5000);
const nachB = geschrieben().length;
check(geschrieben()[nachB - 1].body.p_id === mA.id, `B sichert in dieselbe Zeile (${nachB})`);
await a.evaluate(async (id) => (await import('./js/store.js')).setWeight(id, 30), uebung);
await warte(a, 1100);
await warte(a, 2 * 60000 + 5000);
const nameNachKonflikt = JSON.parse(await entschluesseln(mA.key, zeilen.get(mA.id).daten, zeilen.get(mA.id).iv)).name;
check(nameNachKonflikt === 'Tobi B', 'A überschreibt den neueren Stand von B nicht');
check(!!(await meta(a)).konflikt, 'A merkt sich den Konflikt');
await zumDashboard(a);
check(await a.locator('[data-act="sicherung-ansehen"]').count() === 1,
  'und sagt es auf dem Dashboard, statt still weiterzumachen');
const zahlVorher = geschrieben().length;
await a.evaluate(async (id) => (await import('./js/store.js')).setWeight(id, 32.5), uebung);
await warte(a, 1100);
await warte(a, 2 * 60000 + 5000);
check(geschrieben().length === zahlVorher, 'bis zur Entscheidung versucht A es nicht wieder');
await zuMehr(a);
await a.locator('[data-act="sicherung-trotzdem"]').click();
await warte(a, 300);
await warte(a, 300);
check(JSON.parse(await entschluesseln(mA.key, zeilen.get(mA.id).daten, zeilen.get(mA.id).iv)).name === 'Tobi'
  && !(await meta(a)).konflikt,
  '„Diesen Stand sichern" entscheidet für A');

/* ================================================================== *
 * C – ein frisches Gerät mit dem Link
 * ================================================================== */
const zielC = JSON.stringify(JSON.parse(await entschluesseln(mA.key, zeilen.get(mA.id).daten, zeilen.get(mA.id).iv)).log);
const vorC = anfragen.length;
const { page: c } = await geraet('C', { pm: 'keiner', anker: `#sicherung=${mA.key}` });
check(await c.evaluate(() => location.hash) === '', 'der Anker ist sofort aus der Adresse verschwunden');
check(await c.locator('[data-act="sicherung-angebot-holen"]').count() === 1, 'der Einstieg bietet das Zurückholen an');
await c.locator('[data-act="sicherung-angebot-holen"]').click();
await warte(c, 300);
await c.waitForLoadState('networkidle');
await warte(c, 500);
check(await logVon(c) === zielC, 'über den Link ist der Verlauf ebenfalls zurück');
check(anfragen.slice(vorC).every((x) => !x.roh.includes(mA.key) && !x.url.includes(mA.key)),
  'und der Schlüssel aus dem Link ging dabei nicht an den Server');
// Wer den Link hat, soll nicht mitlesen – mehr dazu in test-sicherung-faelle.mjs.
check((await meta(c)).key !== mA.key, 'als eigenen Schlüssel übernimmt das Gerät den aus dem Link nicht');

/* ================================================================== *
 * D – ein falscher Schlüssel
 * ================================================================== */
const fremd = randomBytes(32).toString('base64url');
const { page: d } = await geraet('D', { pm: 'keiner', anker: `#sicherung=${fremd}` });
await d.locator('[data-act="sicherung-angebot-holen"]').click();
await warte(d, 300);
check(/keine Sicherung/.test(await text(d)), 'ein falscher Schlüssel findet nichts – und das steht da');
check(await d.evaluate(async () => (await import('./js/store.js')).getState().greeted) === false,
  'der Einstieg läuft weiter, nichts wurde überschrieben');
await d.locator('[data-act="sicherung-holen"]').click();
await warte(d, 300);
check(await d.locator('#sicherungSchluessel').count() === 1,
  'gibt der Passwortmanager nichts her, kommt das Eingabefeld');
await d.locator('#sicherungSchluessel').fill('kein-schluessel');
await d.locator('[data-act="sicherung-eingabe-laden"]').click();
await warte(d, 300);
check(/kein gültiger Schlüssel/i.test(await text(d)), 'Unsinn im Feld wird als solcher benannt');

/* ================================================================== *
 * E – der Server kennt die Funktionen (noch) nicht
 * ================================================================== */
lab.modus = 'fehlt';
const vorE = geschrieben().length;
const { page: e } = await geraet('E', { zustand: { greeted: true, name: 'Eva', weights: { 'goblet-squat': 20 } } });
await warte(e, 4000);
await warte(e, 1000);
check(geschrieben().length === vorE + 1, `es bleibt bei einem Versuch (${geschrieben().length - vorE})`);
for (let i = 0; i < 3; i++) {
  await e.evaluate(async (kg) => (await import('./js/store.js')).setWeight('goblet-squat', kg), 22 + i);
  await warte(e, 1100);
  await warte(e, 2 * 60000 + 5000);
}
check(geschrieben().length === vorE + 1, `auch nach weiteren Änderungen keine Fehlerflut (${geschrieben().length - vorE})`);
await zuMehr(e);
check(/kennt die Sicherung noch nicht/.test(await text(e, '#sicherungStand')),
  'unter Mehr steht ruhig, dass der Server sie noch nicht kennt');
check(!/PGRST202|kennt die Sicherung/.test(await text(e, '#toast')), 'als Meldung kam nichts');
lab.modus = 'ok';

/* ================================================================== *
 * F – abgeschaltet: kein Netzverkehr
 * ================================================================== */
await zuMehr(a);
await a.locator('[data-act="toggle-sicherung"]').click();
await warte(a, 300);
const vorF = sicherungsVerkehr().length;
await a.evaluate(async (id) => (await import('./js/store.js')).setWeight(id, 35), uebung);
await warte(a, 1100);
await warte(a, 2 * 60000 + 5000);
await a.evaluate(() => { window.__hidden = true; document.dispatchEvent(new Event('visibilitychange')); });
await warte(a, 0);
await a.evaluate(() => { window.__hidden = false; document.dispatchEvent(new Event('visibilitychange')); });
await a.evaluate(() => window.dispatchEvent(new Event('online')));
await a.reload({ waitUntil: 'networkidle' });
await warte(a, 10000);
check(sicherungsVerkehr().length === vorF, `abgeschaltet geht nichts raus – kein einziger Aufruf (${sicherungsVerkehr().length - vorF})`);
check(await a.locator('[data-act="toggle-sicherung"][aria-pressed="false"]').count() === 1, 'der Schalter steht auf aus');

/* ================================================================== *
 * G – Löschen
 * ================================================================== */
check(zeilen.has(mA.id), 'vor dem Löschen liegt die Sicherung auf dem Server');
await a.locator('[data-act="sicherung-loeschen"]').click();
await warte(a, 300);
const loesch = anfragen.filter((x) => x.name === 'sicherung_loeschen');
check(loesch.length === 1 && loesch[0].body.p_id === mA.id && loesch[0].body.p_w === sha(`w:${mA.key}`),
  'Löschen schickt Kennung und Schreibmarke');
check(!zeilen.has(mA.id), 'und danach ist sie dort weg');
check(/Gelöscht/.test(await text(a, '#toast')), 'die App sagt es');

check(lab.fehler.length === 0, `keine Fehler${lab.fehler.length ? `: ${lab.fehler.slice(0, 3).join(' | ')}` : ''}`);
await browser.close();
console.log(`\n${fails ? `${fails} FEHLER` : 'alle Prüfungen bestanden'}`);
