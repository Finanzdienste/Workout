/*
 * Die Erfahrungsstufe wählt jetzt auch die Übung, nicht nur Gewicht und Sätze.
 *
 *     „Beim hängenden Beinheben merk ich eigentlich nur die Arme und muss nach
 *      zwei Wiederholungen abbrechen … Dann brauch ich als Anfänger halt einfach
 *      ne andere Übung und zwar anscheinend die Boden Variante. Das soll nicht
 *      nur im Text stehen sondern wenn man Anfänger ausgewählt hat soll auch nur
 *      die Boden Variante kommen."
 *
 * Der Rat stand seit jeher im Katalogtext. Ein Rat, den man erst aufklappen
 * muss, ändert aber nichts an dem, was auf dem Bildschirm steht – und zwei
 * Wiederholungen an der Stange sind kein halbes Training, sondern keins.
 *
 * Vier Dinge müssen dafür zugleich stimmen, und der dritte ist der, an dem so
 * etwas sonst schiefgeht:
 *
 *   1. Auf der Anfängerstufe steht die Bodenfassung im Plan, sonst die
 *      hängende. Und zwar überall, wo die App rechnet – nicht nur in der
 *      Anzeige.
 *   2. Der Tausch ist sichtbar. Eine App, die stillschweigend etwas anderes
 *      zeigt, als sie sagt, ist genau das, was js/muster.js im Kopf ausschließt.
 *   3. Die Muskelanteile sind identisch. Sonst verschöbe der Tausch die
 *      Wochenziele für jeden Anfänger, ohne dass es jemand merkt – die
 *      Wochenrechnung hängt an den Anteilen der Übungen, die wirklich dastehen.
 *   4. Die Ersatzübung ist vollständig: eigenes Bewegungsbild, ein Weg nach
 *      unten im Text, und sie ist dem Verletzungsfilter bekannt.
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

// --- 1. Alle Paare aus dem Katalog --------------------------------------
const paare = await page.evaluate(async () => {
  const { EXERCISES } = await import('./js/data.js');
  const byId = new Map(EXERCISES.map((e) => [e.id, e]));
  return EXERCISES.filter((e) => e.anfaenger).map((e) => {
    const ziel = byId.get(e.anfaenger);
    return {
      von: e.id, nach: e.anfaenger, gibtEs: !!ziel,
      anteileGleich: ziel
        ? JSON.stringify(e.db.shares) === JSON.stringify(ziel.db.shares)
          && JSON.stringify(e.bw.shares) === JSON.stringify(ziel.bw.shares)
        : false,
      musterEigen: ziel ? ziel.db.pattern !== e.db.pattern : false,
      zielName: ziel && ziel.db.name,
    };
  });
});
console.log('     Paare:', JSON.stringify(paare));
check(paare.length >= 1, `es gibt mindestens ein Paar (${paare.length})`);
paare.forEach((p) => {
  check(p.gibtEs, `${p.nach} steht im Katalog`);
  check(p.anteileGleich,
    `${p.von} → ${p.nach}: dieselben Muskelanteile – sonst verschöbe der Tausch die Wochenziele`);
  check(p.musterEigen,
    `${p.nach} hat ein eigenes Bewegungsbild (${p.zielName}) – es ist eine andere Bewegung`);
});

// --- 2. Was im Plan steht, hängt an der Stufe ---------------------------
const imPlan = (stufe) => page.evaluate(async (lvl) => {
  const store = await import('./js/store.js');
  store.setSetting('level', lvl);
  const { PLAN } = await import('./js/data.js');
  const { exOf } = await import('./js/plan.js');
  const ids = new Set();
  PLAN.forEach((w) => exOf(w, 'db').forEach((it) => ids.add(it.id)));
  return [...ids];
}, stufe);

const alsGeuebt = await imPlan('geuebt');
const alsAnfaenger = await imPlan('anfaenger');
console.log('     hängend/liegend als geübt:',
  alsGeuebt.includes('haengendes-knieheben'), '/', alsGeuebt.includes('liegendes-knieheben'));
console.log('     hängend/liegend als Anfänger:',
  alsAnfaenger.includes('haengendes-knieheben'), '/', alsAnfaenger.includes('liegendes-knieheben'));
check(alsGeuebt.includes('haengendes-knieheben') && !alsGeuebt.includes('liegendes-knieheben'),
  'als Geübter steht die hängende Fassung im Plan und die liegende nirgends');
check(alsAnfaenger.includes('liegendes-knieheben') && !alsAnfaenger.includes('haengendes-knieheben'),
  'als Anfänger genau umgekehrt – nicht beide, nicht nur im Text');

// --- 3. Und zwar überall, wo gerechnet wird -----------------------------
//
// Der Tausch sitzt in exBasis(), also vor allem anderen. Das ist der Punkt:
// Protokoll, Fortschritt, Wochenvolumen und Zeitschätzung sehen dann von selbst
// die richtige Übung. Ein Tausch erst in der Anzeige hätte das Gegenteil
// bewirkt – abgehakt worden wäre unter dem alten Schlüssel.
const durchgereicht = await page.evaluate(async () => {
  const store = await import('./js/store.js');
  const { PLAN } = await import('./js/data.js');
  const { workoutByNo, exOf, resolve } = await import('./js/plan.js');
  store.setSetting('level', 'anfaenger');
  const w = PLAN.find((x) => x.ex.some((e) => e.id === 'haengendes-knieheben'));
  const items = exOf(w, 'db');
  const it = items.find((x) => x.id === 'liegendes-knieheben');
  const aufgeloest = it ? resolve(it, 'db') : null;
  const ausWorkout = workoutByNo(w.n, 'db').ex.map((x) => x.id);
  return {
    n: w.n,
    imBasis: !!it,
    statt: it && it.statt,
    name: aufgeloest && aufgeloest.name,
    resolveStatt: aufgeloest && aufgeloest.statt,
    ausWorkout: ausWorkout.includes('liegendes-knieheben'),
  };
});
console.log('     durchgereicht:', JSON.stringify(durchgereicht));
check(durchgereicht.imBasis, `exOf() liefert die Bodenfassung (Workout ${durchgereicht.n})`);
check(durchgereicht.statt === 'haengendes-knieheben',
  'und merkt sich, wofür sie eingesprungen ist');
check(durchgereicht.resolveStatt === 'haengendes-knieheben',
  'resolve() reicht das weiter – ohne das könnte die Anzeige es nicht sagen');
check(durchgereicht.ausWorkout, 'workoutByNo() sieht sie ebenfalls');

// --- 4. Und man sieht es ------------------------------------------------
//
// Über die Knöpfe der App und nicht über gesetzten Zustand: Welche Einheit
// gerade gezeigt wird und ob die Fokus- oder die Listenansicht läuft, ist
// Anzeige-Zustand – er übersteht kein Neuladen und lässt sich von außen nicht
// setzen. Die Reihenfolge ist dabei entscheidend: erst zu der Einheit blättern,
// dann starten. Umgekehrt führt „Nächstes" aus dem Training heraus in die
// Übersicht der nächsten Einheit, und dort stehen gar keine Übungskarten.
await page.evaluate(async () => {
  const store = await import('./js/store.js');
  store.setSetting('greeted', true);
  store.setSetting('name', 'T');
  store.setSetting('level', 'anfaenger');
  store.setSetting('tab', 'dashboard');
});
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(400);

const zielN = await page.evaluate(async () => {
  const { PLAN } = await import('./js/data.js');
  return PLAN.find((x) => x.ex.some((e) => e.id === 'haengendes-knieheben')).n;
});
for (let k = 0; k < 20; k++) {
  const kopf = (await page.locator('#view').textContent()).replace(/\s+/g, ' ');
  if (new RegExp(`Workout ${zielN}\\b`).test(kopf)) break;
  await page.locator('[data-act="nav-workout"][data-delta="1"]').first().click();
  await page.waitForTimeout(220);
}
await page.locator('[data-act="start-session"]').first().click();
await page.waitForTimeout(600);
// Die Fokusansicht zeigt immer nur die eine Übung, an der man steht – das
// Knieheben steht hinten. Also in die Liste.
await page.locator('[data-act="focus-list"]').first().click();
await page.waitForTimeout(600);
const text = (await page.locator('#view').textContent()).replace(/\s+/g, ' ');
console.log(`     Workout ${zielN}, Liste:`,
  (/Knieheben[^▼]{0,80}/.exec(text) || ['(nicht gefunden)'])[0].trim());
check(/Knieheben im Liegen/.test(text), 'im Training steht die Bodenfassung');
check(!/Hängendes Knieheben 2 ×|Hängendes Knieheben \d/.test(text),
  'und die hängende nicht als eigene Übung daneben');
check(/Statt Hängendes Knieheben/.test(text),
  'darunter steht, wofür sie eingesprungen ist – ein stiller Tausch wäre keiner');
check(/Erfahrungsstufe/.test(text),
  'mit dem Weg zurück zur schwereren Fassung');

// --- 5. Die Ersatzübung ist dem Verletzungsfilter bekannt ---------------
//
// Sie ist dort nicht nur bekannt, sondern das Ziel: Alle acht Regeln, die das
// hängende Knieheben bisher ersatzlos gestrichen haben, sind Arm-, Hand-,
// Schulter- oder Nackenprobleme – also genau das, was die hängende Fassung
// unmöglich macht und die liegende nicht.
const filter = await page.evaluate(async () => {
  const { INJURIES } = await import('./js/injuries.js');
  const tauschen = INJURIES.filter((i) => (i.swap || {})['haengendes-knieheben'] === 'liegendes-knieheben');
  const meiden = INJURIES.filter((i) => (i.avoid || []).includes('haengendes-knieheben'));
  return { tauschen: tauschen.map((i) => i.id), meiden: meiden.map((i) => i.id) };
});
console.log('     tauschen:', filter.tauschen.length, '· meiden:', filter.meiden.length);
check(filter.tauschen.length === filter.meiden.length && filter.tauschen.length >= 8,
  `jede Regel, die die hängende Fassung meidet, tauscht jetzt auf die liegende `
  + `(${filter.tauschen.length} von ${filter.meiden.length})`);

check(errs.length === 0, `keine Fehler${errs.length ? ': ' + errs.slice(0, 2).join(' | ') : ''}`);
await browser.close();
console.log(`\n${fails ? fails + ' FEHLER' : 'alle Prüfungen bestanden'}`);
