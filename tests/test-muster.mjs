/*
 * Der Plan liest, was im Protokoll steht.
 *
 * Bisher verschob er sich bei verpassten Tagen – mehr lernte er nicht. Dass
 * dreimal hintereinander dieselbe Übung fehlt, stand im Protokoll und wurde
 * nirgends gelesen.
 *
 * Was hier geprüft wird, ist vor allem, wann die App **nichts** sagt. Eine
 * Auswertung, die nach einem schlechten Tag „du lässt X aus" meldet, ist
 * schlimmer als keine: Sie hat einmal recht und viermal unrecht, und danach
 * liest sie niemand mehr.
 *
 * Kein Browser nötig – die Rechnung hängt nur am Zustand, nicht am DOM. Für die
 * Anzeige gibt es unten trotzdem einen Durchgang durch die echte App.
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

/**
 * Ein Protokoll bauen: `wieviel` Einheiten, in jeder werden die ersten
 * `bisUebung` Übungen abgehakt. `ausser` lässt eine bestimmte Übung überall weg,
 * auch wenn sie eigentlich drankäme.
 */
const protokoll = (wieviel, bisUebung, ausser = null) => page.evaluate(
  async ([anzahl, bis, weg]) => {
    const store = await import('./js/store.js');
    const { PLAN } = await import('./js/data.js');
    const { exOf } = await import('./js/plan.js');
    const log = {};
    PLAN.slice(0, anzahl).forEach((w) => {
      const eintrag = { mode: 'db', db: {}, bw: {} };
      exOf(w, 'db').slice(0, bis === null ? undefined : bis).forEach((it) => {
        if (weg && it.id === weg) return;
        eintrag.db[it.id] = Array.from({ length: it.sets }, () => ({ w: '20', done: true }));
      });
      log[w.n] = eintrag;
    });
    store.setSetting('log', log);
    return Object.keys(log).length;
  }, [wieviel, bisUebung, ausser]);

const lies = () => page.evaluate(async () => {
  const { abbruch, ausgelassen } = await import('./js/muster.js');
  return { abbruch: abbruch(), weg: ausgelassen() };
});

// --- 1. Alles vollständig: kein Wort ------------------------------------
await protokoll(6, null);
let r = await lies();
console.log('     vollständig:', JSON.stringify(r));
check(r.weg.length === 0, 'wer alles macht, bekommt keine Liste');
check(r.abbruch === null, 'und keine Abbruch-Meldung');

// --- 2. Zu wenig Material: auch kein Wort -------------------------------
await protokoll(2, 2);
r = await lies();
console.log('     nach zwei Einheiten:', JSON.stringify(r.abbruch), r.weg.length, 'Übungen');
check(r.abbruch === null,
  'nach zwei Einheiten sagt die App nichts – zweimal ist kein Muster, das ist ein Wochenende');
check(r.weg.length === 0, 'und auch keine einzelne Übung wird angeprangert');

// --- 3. Regelmäßig nach Übung 3 Schluss ---------------------------------
await protokoll(6, 3);
r = await lies();
console.log('     immer nach 3:', JSON.stringify(r.abbruch));
check(!!r.abbruch, 'sechsmal vorzeitig aufgehört fällt auf');
check(r.abbruch && r.abbruch.bis === 3,
  `und zwar an der richtigen Stelle (nach Übung ${r.abbruch && r.abbruch.bis})`);
check(r.abbruch && r.abbruch.kurz === r.abbruch.einheiten,
  'alle sechs waren kurz');

// --- 4. Eine einzelne Übung fehlt ---------------------------------------
const opfer = await page.evaluate(async () => {
  const { PLAN } = await import('./js/data.js');
  const { exOf } = await import('./js/plan.js');
  // Eine Übung, die in mehreren der ersten Einheiten vorkommt.
  const zaehler = new Map();
  PLAN.slice(0, 8).forEach((w) => exOf(w, 'db').forEach(
    (it) => zaehler.set(it.id, (zaehler.get(it.id) || 0) + 1)));
  return [...zaehler.entries()].sort((a, b) => b[1] - a[1])[0][0];
});
await protokoll(8, null, opfer);
r = await lies();
console.log('     ausgelassen:', opfer, '→', JSON.stringify(r.weg));
check(r.weg.length === 1, `genau diese eine Übung wird gemeldet (${r.weg.length})`);
check(r.weg[0] && r.weg[0].id === opfer, 'und zwar die richtige');
check(r.weg[0] && r.weg[0].weg === r.weg[0].dran,
  `mit der Zahl dahinter (${r.weg[0] && r.weg[0].weg} von ${r.weg[0] && r.weg[0].dran})`);
check(r.abbruch === null,
  'als Abbruch gilt das nicht – der Rest der Einheit stand ja');

// --- 5. Nach vorn geholt: die Reihenfolge ändert sich wirklich ----------
const reihenfolge = await page.evaluate(async ([id]) => {
  const store = await import('./js/store.js');
  const { ruestCache } = await import('./js/gewichte.js');
  const { exOf } = await import('./js/plan.js');
  const { PLAN } = await import('./js/data.js');
  const { vorneUm } = await import('./js/muster.js');
  // Die erste Einheit, in der die Übung vorkommt und nicht schon vorn steht.
  const w = PLAN.find((x) => exOf(x, 'db').findIndex((it) => it.id === id) > 0);
  if (!w) return null;
  const vorher = exOf(w, 'db').findIndex((it) => it.id === id);
  vorneUm(id);
  ruestCache.clear();
  const nachher = exOf(w, 'db').findIndex((it) => it.id === id);
  const alle = exOf(w, 'db').map((it) => it.id);
  vorneUm(id);
  ruestCache.clear();
  const zurueck = exOf(w, 'db').findIndex((it) => it.id === id);
  return { vorher, nachher, zurueck, anzahl: alle.length, doppelt: new Set(alle).size !== alle.length };
}, [opfer]);
console.log('     Platz vorher/vorn/zurück:', JSON.stringify(reihenfolge));
check(reihenfolge && reihenfolge.nachher === 0,
  `nach vorn geholt steht sie an erster Stelle (von Platz ${reihenfolge && reihenfolge.vorher + 1})`);
check(reihenfolge && reihenfolge.zurueck === reihenfolge.vorher,
  'wieder losgelassen steht sie da, wo sie war');
check(reihenfolge && !reihenfolge.doppelt && reihenfolge.anzahl > 1,
  'und die Einheit hat dabei keine Übung verloren oder doppelt bekommen');

// --- 6. In der App --------------------------------------------------------
await protokoll(6, 3);
await page.evaluate(async () => {
  const store = await import('./js/store.js');
  store.setSetting('greeted', true);
  store.setSetting('name', 'T');
  store.setSetting('tab', 'stats');
});
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(500);
const text = (await page.locator('#view').textContent()).replace(/\s+/g, ' ');
check(/Was dir im Protokoll auffällt/.test(text), 'die Auswertung steht in der Statistik');
check(/vor dem Ende aufgehört/.test(text), 'mit dem Abbruch-Muster im Klartext');
console.log('     Karte:', (/Was dir im Protokoll auffällt.{0,160}/.exec(text) || [''])[0]);

// Und sie verschwindet wieder, wenn es nichts zu sagen gibt.
await protokoll(6, null);
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(500);
const sauber = (await page.locator('#view').textContent()).replace(/\s+/g, ' ');
check(!/Was dir im Protokoll auffällt/.test(sauber),
  'ohne Befund steht sie nicht da – eine Karte, die immer „alles gut" meldet, liest niemand');

check(errs.length === 0, `keine Fehler${errs.length ? ': ' + errs.slice(0, 2).join(' | ') : ''}`);
await browser.close();
console.log(`\n${fails ? fails + ' FEHLER' : 'alle Prüfungen bestanden'}`);
