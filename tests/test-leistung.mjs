/*
 * Die Stufe ist, was du hebst.
 *
 *     „Mach's so, dass man zum optimalen Zeitpunkt aufsteigt. Mit
 *      Benachrichtigung und Beglückwünschung. Genau, wenn ich nach 10 Jahren
 *      noch immer nur eine Liegestütze kann bin ich noch immer Anfänger und
 *      wenn ich ohne jemals trainiert zu haben hundert kann bin ich vermutlich
 *      schon geübt."
 *
 * Beide Hälften des Satzes sind hier je eine Prüfung: viel Anwesenheit ohne
 * Leistung stuft nicht hoch, Leistung ohne eine einzige Einheit schon.
 *
 * Gemessen wird gegen die Startgewichte aus dem Katalog – dieselben Zahlen, die
 * die Einrichtung anzeigt. Dieser Test rechnet sie selbst aus js/data.js aus,
 * statt die Funktion gegen sich selbst zu prüfen.
 */
import { chromium } from 'playwright';
import { URL } from './umgebung.mjs';

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 414, height: 896 } });
await ctx.route('**/rest/v1/**', (r) => r.fulfill({ status: 204, body: '' }));
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()); });
let fails = 0;
const check = (c, m) => { console.log(`${c ? 'OK  ' : 'FAIL'} ${m}`); if (!c) { fails++; process.exitCode = 1; } };

await page.goto(URL, { waitUntil: 'networkidle' });

/** Die Startgewichte aus dem Katalog – die Messlatte, unabhängig gelesen. */
const katalog = await page.evaluate(async () => {
  const { EXERCISES } = await import('./js/data.js');
  const mitGewicht = EXERCISES.filter((e) => e.weight > 0).map((e) => [e.id, e.weight]);
  const obere = (r) => {
    const z = String(r || '').match(/\d+/g);
    return z && z.length ? Number(z[z.length - 1]) : 0;
  };
  const mitWdh = EXERCISES.filter((e) => !(e.weight > 0) && obere(e.bw && e.bw.reps) > 0)
    .map((e) => [e.id, obere(e.bw.reps)]);
  return { mitGewicht, mitWdh };
});
console.log(`     ${katalog.mitGewicht.length} Übungen mit Startgewicht, `
  + `${katalog.mitWdh.length} mit Wiederholungsbereich`);
check(katalog.mitGewicht.length >= 15, 'der Katalog hat genug Gewichtsübungen als Messlatte');

/** Einen Stand säen, der vor dem App-Code liegt (siehe test-nacharbeit.mjs). */
const saen = (zustand) => page.addInitScript((z) => {
  localStorage.setItem('workout.state.v1', JSON.stringify(z));
}, zustand);

const lies = () => page.evaluate(async () => {
  const store = await import('./js/store.js');
  const { leistungsStand } = await import('./js/stufen.js');
  const s = store.getState();
  return { level: s.level, aufstieg: s.aufstieg || null, stand: leistungsStand() };
});

// --- 1. Zu wenig Angaben: die App misst nicht und stuft nicht --------------
await saen({ greeted: true, name: 'T', level: 'anfaenger', log: {},
  weights: { [katalog.mitGewicht[0][0]]: katalog.mitGewicht[0][1] * 2 } });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(400);
let r = await lies();
console.log('     mit einer Angabe:', JSON.stringify(r.stand));
check(r.stand.verhaeltnis === null, 'mit einer einzigen Übung gibt es keine Kennzahl');
check(r.level === 'anfaenger', `und keine Hochstufung (${r.level})`);
check(r.stand.fehlt > 0, `die App sagt, wie viele Angaben fehlen (${r.stand.fehlt})`);

// --- 2. Viel Anwesenheit, wenig Last: bleibt Anfänger ----------------------
// 80 vollständig abgehakte Einheiten – nach der alten Regel (60 Einheiten,
// 540 Sätze, 30 t) wäre das ein sicherer Aufstieg gewesen.
const vieleEinheiten = await page.evaluate(async () => {
  const { PLAN } = await import('./js/data.js');
  const log = {};
  PLAN.slice(0, 80).forEach((w) => {
    const e = { mode: 'db', done: 'db', soll: {}, db: {} };
    w.ex.forEach((it) => {
      e.soll[it.id] = it.sets;
      e.db[it.id] = Array.from({ length: it.sets }, () => ({ w: '20', done: true }));
    });
    log[w.n] = e;
  });
  return log;
});
const schwach = {};
katalog.mitGewicht.slice(0, 8).forEach(([id, kg]) => { schwach[id] = Math.max(0.25, kg * 0.4); });
await saen({ greeted: true, name: 'T', level: 'anfaenger', log: vieleEinheiten, weights: schwach });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(500);
r = await lies();
console.log('     80 Einheiten, 40 % der Startgewichte:',
  `Verhältnis ${r.stand.verhaeltnis && r.stand.verhaeltnis.toFixed(2)}, Stufe ${r.level}`);
check(r.level === 'anfaenger',
  `viel Anwesenheit ohne Last stuft nicht hoch (${r.level}) – das war vorher anders`);
check(!r.aufstieg, 'und es gibt keinen Glückwunsch');

// --- 3. Leistung ohne eine einzige Einheit: stuft hoch ---------------------
const stark = {};
katalog.mitGewicht.slice(0, 8).forEach(([id, kg]) => { stark[id] = kg * 1.1; });
await saen({ greeted: true, name: 'T', level: 'anfaenger', log: {}, weights: stark });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(500);
r = await lies();
console.log('     0 Einheiten, 110 % der Startgewichte:',
  `Verhältnis ${r.stand.verhaeltnis && r.stand.verhaeltnis.toFixed(2)}, Stufe ${r.level}`);
check(Math.abs(r.stand.verhaeltnis - 1.1) < 0.01,
  `der Median trifft das Verhältnis (${r.stand.verhaeltnis})`);
check(r.level === 'geuebt', `Leistung ohne Anwesenheit stuft hoch (${r.level})`);
check(!!r.aufstieg && r.aufstieg.nach === 'geuebt', 'der Aufstieg ist vermerkt');
check(r.aufstieg.uebungen === 8 && r.aufstieg.verhaeltnis > 1,
  `mit der Zahl, die ihn ausgelöst hat (${r.aufstieg.uebungen} Übungen, ${r.aufstieg.verhaeltnis})`);

// Und der Glückwunsch steht auf der Startseite.
const hinweis = (await page.locator('.notice.aufstieg').first().textContent()).replace(/\s+/g, ' ');
console.log('     ' + hinweis.trim().slice(0, 130));
check(/Glückwunsch/.test(hinweis), 'mit einer Beglückwünschung, nicht nur einer Meldung');
check(/Geübt/.test(hinweis), 'sie nennt die neue Stufe');
check(/-fache/.test(hinweis), 'und woran es gemessen wurde');

// --- 4. Ein Schritt, nicht zwei -------------------------------------------
// 1,6 läge über der Schwelle für Fortgeschritten. Von Anfänger aus wäre das ein
// Sprung über eine Stufe – und eine Verdopplung der Sätze von einem Tag auf den
// anderen.
const sehrStark = {};
katalog.mitGewicht.slice(0, 8).forEach(([id, kg]) => { sehrStark[id] = kg * 1.6; });
await saen({ greeted: true, name: 'T', level: 'anfaenger', log: {}, weights: sehrStark });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(500);
r = await lies();
console.log('     160 % der Startgewichte ab Anfänger:',
  `gemessen ${r.stand.stufe}, gesetzt ${r.level}`);
check(r.stand.stufe === 'fortgeschritten', 'gemessen wird Fortgeschritten');
check(r.level === 'geuebt', `gesetzt wird trotzdem nur ein Schritt (${r.level})`);

// --- 5. Bodyweight zählt mit ----------------------------------------------
// Ohne Kilo gäbe es sonst nie einen Aufstieg – eine Strafe für die Wahl der
// Variante. Gemessen wird der Aufschlag auf den geplanten Bereich.
const bwPlus = {};
katalog.mitWdh.slice(0, 6).forEach(([id, oben]) => { bwPlus[id] = oben; });   // doppelter Bereich
await saen({ greeted: true, name: 'T', level: 'anfaenger', log: {}, weights: {}, bwPlus });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(500);
r = await lies();
console.log('     doppelter Wiederholungsbereich:',
  `Verhältnis ${r.stand.verhaeltnis && r.stand.verhaeltnis.toFixed(2)}, Stufe ${r.level}`);
check(Math.abs(r.stand.verhaeltnis - 2) < 0.01,
  `der doppelte Bereich ist Verhältnis 2 (${r.stand.verhaeltnis})`);
check(r.level === 'geuebt', `auch ohne ein einziges Kilo wird hochgestuft (${r.level})`);

// --- 6. Abgestuft wird nie ------------------------------------------------
await saen({ greeted: true, name: 'T', level: 'fortgeschritten', log: {}, weights: schwach });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(500);
r = await lies();
check(r.level === 'fortgeschritten',
  `schwache Gewichte stufen niemanden zurück (${r.level})`);

// --- 7. Unter Mehr steht, woran es hängt ----------------------------------
await saen({ greeted: true, name: 'T', level: 'anfaenger', log: {}, weights: {} });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(400);
await page.locator('.tab[data-tab="settings"]').click();
await page.waitForTimeout(400);
const mehr = (await page.locator('#view').textContent()).replace(/\s+/g, ' ');
check(/fehlen noch/.test(mehr),
  'ohne genug Angaben sagt die App, dass welche fehlen, statt zu schweigen');
check(!/Tonnen/.test(mehr) && !/\d+ Einheiten \//.test(mehr),
  'und Einheiten und Tonnen stehen nicht mehr als Bedingung da');

check(errs.length === 0, `keine Fehler${errs.length ? ': ' + errs.slice(0, 2).join(' | ') : ''}`);
console.log(`\n${fails ? fails + ' FEHLER' : 'alle Prüfungen bestanden'}`);
await browser.close();
