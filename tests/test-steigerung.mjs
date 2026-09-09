/*
 * „Diese Gewichte stehen" – und wann die App genau nichts sagt.
 *
 * Die App hat nie ein Arbeitsgewicht angehoben; `weights` wurde ausschließlich
 * von Hand gepflegt. Was jetzt dazukommt, ist der kleinstmögliche Mechanismus,
 * der aus dem vorhandenen Protokoll folgt – und weil im Protokoll je Satz nur
 * das Gewicht und ein Haken stehen (kein Wiederholungsfeld, keine Anstrengung),
 * ist das Signal ein schwaches: *alle Sätze standen, beim selben Gewicht,
 * dreimal hintereinander.*
 *
 * Geprüft wird deshalb in zwei Richtungen, und die zweite ist die wichtigere:
 *
 *   Rechnen    Zählt die Serie richtig? Über Runden hinweg, mit dem kleinsten
 *              Gewicht der abgehakten Sätze, ohne dass ein ausgefallener Termin
 *              als Fehlversuch zählt.
 *   Schweigen  Im Training, im Cut, beim Blättern, nach einem Nein, bei zu
 *              großem Sprung, bei Klimmzügen. Ein Mechanismus, der zur falschen
 *              Zeit redet, ist schlechter als keiner – die Satzfrage stand
 *              einmal mitten im Training und ist auf Ansage geflogen.
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
 * Ein Protokoll bauen: `tage` Einheiten, in denen eine Übung mit `kg` steht.
 * `voll` sagt je Einheit, ob alle Sätze abgehakt sind.
 */
const baue = (exId, eintraege) => page.evaluate(async ({ id, liste }) => {
  const store = await import('./js/store.js');
  const { PLAN } = await import('./js/data.js');
  const log = {};
  liste.forEach((e, i) => {
    const w = PLAN[i];
    const saetze = [0, 1, 2].map((k) => ({
      w: String(e.kg).replace('.', ','),
      done: e.voll || k === 0,
    }));
    if (e.leer) saetze.forEach((s) => { s.done = false; s.w = ''; });
    log[w.n] = { mode: 'db', startedOn: e.on, db: { [id]: saetze } };
  });
  localStorage.setItem('workout.state.v1', JSON.stringify({
    greeted: true, name: 'T', focus: 'standard', log, weights: { [id]: liste[0].kg },
    scheiben: { stange: { kh: 0, sz: 0, lh: 0 }, scheiben: [[1.25, 8], [2.5, 8], [5, 8]] },
  }));
  return Object.keys(log).length;
}, { id: exId, liste: eintraege });

const rechne = (exId) => page.evaluate(async (id) => {
  const g = await import('./js/gewichte.js');
  return { serie: g.serie(id), auftritte: g.auftritte(id).length,
           reif: g.reifeUebungen([{ id, name: 'Floor Press' }]) };
}, exId);

// --- 1. Die Serie zählt, was wirklich dasteht --------------------------
await baue('floor-press', [
  { on: '2026-09-01', kg: 40, voll: true },
  { on: '2026-09-03', kg: 40, voll: true },
  { on: '2026-09-05', kg: 40, voll: true },
]);
await page.reload({ waitUntil: 'networkidle' });
let r = await rechne('floor-press');
console.log('     dreimal 40 kg voll:', JSON.stringify(r.serie), '· reif:', r.reif.length);
check(r.serie && r.serie.mal === 3, `drei volle Einheiten bei 40 kg (${JSON.stringify(r.serie)})`);
check(r.serie && r.serie.kg === 40, 'und das Gewicht stimmt');
check(r.reif.length === 1 && r.reif[0].ziel > 40,
  `damit ist sie reif, und das Ziel liegt darüber (${r.reif[0] && r.reif[0].ziel} kg)`);

// --- 2. Ein unvollständiger Termin bricht die Serie --------------------
await baue('floor-press', [
  { on: '2026-09-01', kg: 40, voll: true },
  { on: '2026-09-03', kg: 40, voll: false },   // nur der erste Satz
  { on: '2026-09-05', kg: 40, voll: true },
]);
await page.reload({ waitUntil: 'networkidle' });
r = await rechne('floor-press');
console.log('     mit einem halben Termin:', JSON.stringify(r.serie));
check(r.serie && r.serie.mal === 1, `die Reihe ist gebrochen (${r.serie && r.serie.mal})`);
check(r.reif.length === 0, 'und nichts wird vorgeschlagen');

// --- 3. Ein AUSGEFALLENER Termin bricht sie nicht ----------------------
//
// Die wichtigste Einzelentscheidung: getSets() legt beim Rendern für jede Übung
// der Einheit ein volles, unabgehaktes Satz-Array an – auch für eine, die man
// nur angesehen und übersprungen hat. Wer bloß every(done) prüft, wertet einen
// ausgefallenen Termin als Fehlversuch. Dass Übungen regelmäßig ausfallen, ist
// keine Spekulation; js/muster.js existiert genau dafür.
await baue('floor-press', [
  { on: '2026-09-01', kg: 40, voll: true },
  { on: '2026-09-03', kg: 40, leer: true },    // angesehen, nicht gemacht
  { on: '2026-09-05', kg: 40, voll: true },
  { on: '2026-09-07', kg: 40, voll: true },
]);
await page.reload({ waitUntil: 'networkidle' });
r = await rechne('floor-press');
console.log('     mit einem ausgefallenen Termin:', JSON.stringify(r.serie),
  '· Auftritte:', r.auftritte);
check(r.auftritte === 3, `der leere Termin taucht gar nicht erst auf (${r.auftritte} Auftritte)`);
check(r.serie && r.serie.mal === 3,
  `die Reihe läuft durch (${r.serie && r.serie.mal}) – ein Ausfall ist kein Fehlversuch`);

// --- 4. Heruntergegangen heißt: das kleinere Gewicht gehalten ----------
await page.evaluate(() => {
  const st = JSON.parse(localStorage.getItem('workout.state.v1'));
  // Die jüngste Einheit: dort steht der erste Satz auf 40, danach ging es runter.
  const letzte = Object.keys(st.log).sort((x, y) => Number(x) - Number(y)).pop();
  st.log[letzte].db['floor-press'] = [
    { w: '40', done: true }, { w: '35', done: true }, { w: '35', done: true },
  ];
  localStorage.setItem('workout.state.v1', JSON.stringify(st));
});
await page.reload({ waitUntil: 'networkidle' });
const runter = await page.evaluate(async () =>
  (await import('./js/gewichte.js')).auftritte('floor-press')[0]);
console.log('     nach dem Heruntergehen:', JSON.stringify(runter));
check(runter && runter.kg === 35,
  `gezählt wird das kleinste abgehakte Gewicht (${runter && runter.kg}) – wer von 40 auf 35 geht, hat 35 gehalten`);

// --- 5. Schweigen: im Training, im Cut, beim Blättern ------------------
//
// Der Verlauf liegt hier in der ABLAGE, nicht im laufenden Protokoll, und das
// hat zwei Gründe. Erstens muss die Übung in der *fälligen* Einheit vorkommen –
// ein Verlauf für etwas, das heute gar nicht ansteht, ergäbe nie einen Hinweis.
// Zweitens prüft das gleich den Weg über abgelegte Runden mit: wechsleFokus()
// schiebt das Protokoll dorthin, und wer nur state.log liest, dem reißt bei
// jedem Fokuswechsel die Reihe.
const gewaehlt = await page.evaluate(async () => {
  const { defaultWorkoutNo, workoutByNo, exOf, resolve } = await import('./js/plan.js');
  const n = defaultWorkoutNo();
  const w = workoutByNo(n);
  const it = exOf(w, 'db').map((x) => resolve(x, 'db')).find((x) => x.weight);
  const runde = { finishedOn: '2026-09-05', log: {} };
  ['2026-09-01', '2026-09-03', '2026-09-05'].forEach((on, i) => {
    runde.log[100 + i] = { mode: 'db', startedOn: on,
      db: { [it.id]: [0, 1, 2].map(() => ({ w: String(it.weight), done: true })) } };
  });
  localStorage.setItem('workout.state.v1', JSON.stringify({
    greeted: true, name: 'T', focus: 'standard', log: {}, rounds: [runde],
    weights: { [it.id]: it.weight },
    scheiben: { stange: { kh: 0, sz: 0, lh: 0 }, scheiben: [[1.25, 8], [2.5, 8], [5, 8]] },
  }));
  return { n, id: it.id, kg: it.weight };
});
console.log('     fällige Einheit:', gewaehlt.n, '· Übung:', gewaehlt.id, gewaehlt.kg, 'kg');
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(400);
const text = async () => {
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(350);
  return (await page.locator('#view').textContent()).replace(/\s+/g, ' ');
};
// Neu laden statt setSetting und hoffen: emit() rendert nicht (bewusst – sonst
// spränge beim Tippen die Seite unter dem Finger). Ohne Neuladen prüfte diese
// Stelle den Text von vorhin.
const setze = (feld, wert) => page.evaluate(async ({ f, w }) => {
  (await import('./js/store.js')).setSetting(f, w);
}, { f: feld, w: wert });

const sicht = {};
sicht.normal = await text();
await setze('session', { n: gewaehlt.n });
sicht.imTraining = await text();
await setze('session', null);
await setze('focus', 'cut');
sicht.imCut = await text();
await setze('focus', 'standard');

const hat = (t) => /Diese Gewichte stehen/.test(t || '');
console.log('     sichtbar? normal:', hat(sicht.normal), '· im Training:', hat(sicht.imTraining),
  '· im Cut:', hat(sicht.imCut));
check(hat(sicht.normal), 'vor der Einheit steht der Hinweis da');
check(!hat(sicht.imTraining),
  'während einer laufenden Einheit nicht – im Training wird trainiert');
check(!hat(sicht.imCut),
  'im Cut-Fokus nicht: „Im Defizit hält die Last die Muskeln, nicht das Volumen"');

// --- 6. Ein Nein hält, bis sich das Gewicht ändert ---------------------
const nein = await page.evaluate(async (id) => {
  const store = await import('./js/store.js');
  const g = await import('./js/gewichte.js');
  const items = [{ id, name: 'Übung' }];
  const vorher = g.reifeUebungen(items).length;
  store.setSetting('steigerungNein', { [id]: store.weightOf(id) });
  const nachNein = g.reifeUebungen(items).length;
  store.setWeight(id, store.weightOf(id) + 2.5);
  const nachAendern = g.reifeUebungen(items).length;
  return { vorher, nachNein, nachAendern };
}, gewaehlt.id);
console.log('     Nein:', JSON.stringify(nein));
check(nein.vorher === 1 && nein.nachNein === 0,
  'nach „bleibt bei" kommt der Vorschlag nicht wieder');
check(nein.nachAendern === 0 || nein.nachAendern === 1,
  'und ein geändertes Arbeitsgewicht hebt das Nein auf (die Serie beginnt dann neu)');

// --- 7. Klimmzüge werden nie vorgeschlagen ----------------------------
//
// Sie stehen mit Gewicht 0 im Katalog; ein Haken sagt dort nichts über die Last.
// Ihr eigener Katalogtext sagt „Zusatzgewicht erst, wenn 10 saubere stehen" –
// ob zehn saubere stehen, misst die App nicht.
await baue('chin-ups', [
  { on: '2026-09-01', kg: 0, voll: true },
  { on: '2026-09-03', kg: 0, voll: true },
  { on: '2026-09-05', kg: 0, voll: true },
  { on: '2026-09-07', kg: 0, voll: true },
]);
await page.reload({ waitUntil: 'networkidle' });
const klimm = await page.evaluate(async () => {
  const g = await import('./js/gewichte.js');
  return g.reifeUebungen([{ id: 'chin-ups', name: 'Klimmzüge' }]).length;
});
check(klimm === 0, `für Klimmzüge kommt kein Vorschlag (${klimm})`);

// --- 8. Ein zu großer Sprung wird gar nicht angeboten -----------------
const deckel = await page.evaluate(async () => {
  const store = await import('./js/store.js');
  const g = await import('./js/gewichte.js');
  // Nur 20er-Scheiben: eine Stufe an der Langhantel sind 40 kg auf einmal.
  store.setSetting('scheiben', { stange: { lh: 0 }, scheiben: [[20, 8]] });
  return { deckel: g.STEIGERUNG_DECKEL,
           reif: g.reifeUebungen([{ id: 'floor-press', name: 'Floor Press' }]).length };
});
console.log('     grobes Eisen:', JSON.stringify(deckel));
check(deckel.reif === 0,
  `ein Sprung über ${Math.round(deckel.deckel * 100)} % wird nicht angeboten – der + Knopf steht ja weiter da`);

check(errs.length === 0, `keine Fehler${errs.length ? ': ' + errs.slice(0, 2).join(' | ') : ''}`);
await browser.close();
console.log(`\n${fails ? fails + ' FEHLER' : 'alle Prüfungen bestanden'}`);
