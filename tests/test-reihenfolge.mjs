/*
 * Reihenfolge in der Einheit: Umbauten sparen, aber keine Isolation vor eine
 * Grundübung am selben Muskel ziehen.
 *
 * Abgelesen wird die Ansicht selbst – das ist die Reihenfolge, die er im
 * Training vor sich hat, nicht die im Plan.
 */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { URL, ROOT } from './umgebung.mjs';

const EINHEITEN = 84;

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 414, height: 896 } });
await ctx.route('**/rest/v1/**', (r) => r.fulfill({ status: 204, body: '' }));
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message));

let fails = 0;
const check = (c, m) => { console.log(`${c ? 'OK  ' : 'FAIL'} ${m}`); if (!c) { fails++; process.exitCode = 1; } };

await page.goto(URL, { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.setItem('workout.state.v1',
  JSON.stringify({ greeted: true, name: 'Tobi', mode: 'db' })));
await page.reload({ waitUntil: 'networkidle' });

const meta = await page.evaluate(async () => {
  const d = await import('./js/data.js');
  return {
    nachName: Object.fromEntries(d.EXERCISES.map((e) => [e.db.name, e.id])),
    ex: Object.fromEntries(d.EXERCISES.map((e) => [e.id, {
      tier: e.tier,
      equip: e.equip,
      kg: e.weight,
      direkt: Object.entries(e.db.shares).filter(([, v]) => v >= 0.5).map(([m]) => m),
    }])),
  };
});
check(meta.ex['liegende-trizepsstrecker'].tier === 3, 'die Stufe je Übung steht in den Daten');

// --- Durchblättern und ablesen ---
const gelesen = [];
await page.locator('[data-act="show-list"]').first().click();
await page.waitForTimeout(200);
for (let i = 0; i < EINHEITEN; i++) {
  const namen = await page.locator('.ex-name').allTextContents();
  gelesen.push(namen.map((t) => meta.nachName[t.trim()] || t.trim()));
  const weiter = page.locator('[data-act="nav-workout"][data-delta="1"]').first();
  if (!(await weiter.count()) || await weiter.isDisabled()) break;
  await weiter.click();
  await page.waitForTimeout(60);
  const auf = page.locator('[data-act="show-list"]');
  if (await auf.count()) { await auf.first().click(); await page.waitForTimeout(40); }
}
check(gelesen.length === EINHEITEN, `${gelesen.length} von ${EINHEITEN} Einheiten abgelesen`);
check(gelesen.every((l) => l.length >= 4), 'jede Einheit hat ihre Übungen');

// --- 1. Keine kleine Übung vor einer schweren am selben Muskel ---
let konflikte = 0;
const beispiele = [];
gelesen.forEach((liste, idx) => {
  for (let a = 0; a < liste.length; a++) {
    for (let b = a + 1; b < liste.length; b++) {
      const A = meta.ex[liste[a]];
      const B = meta.ex[liste[b]];
      if (!A || !B || A.tier <= B.tier) continue;
      if (A.direkt.some((m) => B.direkt.includes(m))) {
        konflikte++;
        if (beispiele.length < 3) beispiele.push(`W${idx + 1}: ${liste[a]} vor ${liste[b]}`);
      }
    }
  }
});
check(konflikte === 0,
  `keine Isolation vor einer Grundübung am selben Muskel${beispiele.length ? ' – ' + beispiele.join(' | ') : ''}`);

// --- 2. Die Umbau-Ersparnis steht noch ---
const FAM = { barbell: 'lh', hipbar: 'lh', dumbbells: 'kh2', goblet: 'kh1', onehand: 'kh1', plate: 'kh1', backpack: 'ruck' };
const ruesten = (liste) => {
  let vorher = null;
  let n = 0;
  liste.forEach((id) => {
    const e = meta.ex[id];
    if (!e || !FAM[e.equip] || !e.kg) return;
    const jetzt = { fam: FAM[e.equip], kg: e.kg };
    if (!vorher || vorher.fam !== jetzt.fam || Math.abs(vorher.kg - jetzt.kg) > 0.01) n += 1;
    vorher = jetzt;
  });
  return n;
};
const jetzt = gelesen.reduce((s, l) => s + ruesten(l), 0);
const roh = await page.evaluate(async () => {
  const d = await import('./js/data.js');
  return d.PLAN.map((w) => w.ex.map((x) => x.id));
});
const ohne = roh.reduce((s, l) => s + ruesten(l), 0);
check(jetzt <= ohne, `Rüstvorgänge: ${jetzt} sortiert gegen ${ohne} in der Plan-Reihenfolge`);

// --- 3. Alle vier Pläne gegen einen festgehaltenen Stand ------------------
// Weniger Scheibenwechsel ist „ultra wichtig" – geprüft wurde bisher aber nur,
// dass die Sortierung im Standardplan nicht schlechter ist als gar keine.
// Eine Änderung an Startgewichten, Geräten oder ruestOrder() konnte die
// anderen drei Pläne verschlechtern, ohne dass etwas anschlug (gefunden bei
// der Durchsicht der App). Jetzt: je Plan die Rüstvorgänge je Einheit, mit der
// Rechnung der App selbst (setupOf, wie ruestHint sie zählt), gegen
// tests/ruestaufwand-stand.json. Schlechter schlägt an; besser heißt: den Stand
// dort nachziehen, damit er hält.
const STAND = JSON.parse(readFileSync(new globalThis.URL('./ruestaufwand-stand.json', import.meta.url), 'utf8'));
const gemessen = {};
for (const fokus of ['standard', 'bbp', 'cut', 'oberkoerper']) {
  await page.evaluate(async (f) => {
    const s = await import('./js/store.js');
    s.setSetting('focus', f);
    s.flush();
  }, fokus);
  await page.reload({ waitUntil: 'networkidle' });
  gemessen[fokus] = await page.evaluate(async (f) => {
    const d = await import('./js/data.js');
    const { exOf } = await import('./js/plan.js');
    const { setupOf, workingWeight } = await import('./js/gewichte.js');
    if (d.FOCUS !== d.PLANS[f]) return null;
    let n = 0;
    d.PLAN.forEach((w) => {
      let vorher = null;
      exOf(w, 'db').forEach((it) => {
        const cur = setupOf(it.id, workingWeight(it.id));
        if (!cur) return;
        if (!vorher || vorher.fam !== cur.fam || Math.abs(vorher.kg - cur.kg) > 0.01) n += 1;
        vorher = cur;
      });
    });
    return +(n / d.PLAN.length).toFixed(3);
  }, fokus);
}
console.log('     Rüstvorgänge je Einheit:', JSON.stringify(gemessen), ' Stand:', JSON.stringify(STAND));

// --- 4. Der Generator zählt Einheit für Einheit wie die App ----------------
// tools/build-plan.py verteilt die Übungen so auf die Tage, dass möglichst
// wenig umgebaut wird. Bis zum 03.10. zählte er dabei Gerätefamilien je Tag –
// ohne Gewicht, die SZ-Stange als Langhantel – und optimierte damit eine
// andere Zahl als die, die hier oben steht: im Aufbau 2,39 gegen 3,55. Hier
// steht seine Zählung (ruest_zaehlen()) neben der der App, für jede Einheit
// jedes Plans.
const generator = JSON.parse(execFileSync('python3', ['-c', `
import importlib.util, json, sys
sys.argv = ['build-plan.py']
spec = importlib.util.spec_from_file_location('bp', 'tools/build-plan.py')
bp = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bp)
info = bp.ruest_info_aus(json.load(open('tools/exercise-meta.json', encoding='utf-8')))
out = {}
for v, f in [('standard', 'plan.json'), ('bbp', 'plan-bbp.json'), ('cut', 'plan-cut.json'), ('oberkoerper', 'plan-oberkoerper.json')]:
    plan = json.load(open('tools/' + f, encoding='utf-8'))['plan']
    out[v] = [bp.ruest_zaehlen([it['id'] for it in e['ex']], info) for e in plan]
print(json.dumps(out))
`], { cwd: ROOT, encoding: 'utf8' }));
for (const fokus of ['standard', 'bbp', 'cut', 'oberkoerper']) {
  await page.evaluate(async (f) => {
    const s = await import('./js/store.js');
    s.setSetting('focus', f);
    s.flush();
  }, fokus);
  await page.reload({ waitUntil: 'networkidle' });
  const app = await page.evaluate(async () => {
    const d = await import('./js/data.js');
    const { exOf } = await import('./js/plan.js');
    const { setupOf, workingWeight } = await import('./js/gewichte.js');
    return d.PLAN.map((w) => {
      let vorher = null;
      let n = 0;
      exOf(w, 'db').forEach((it) => {
        const cur = setupOf(it.id, workingWeight(it.id));
        if (!cur) return;
        if (!vorher || vorher.fam !== cur.fam || Math.abs(vorher.kg - cur.kg) > 0.01) n += 1;
        vorher = cur;
      });
      return n;
    });
  });
  const anders = app.map((n, i) => [i + 1, n, generator[fokus][i]]).filter(([, a, g]) => a !== g);
  check(app.length === generator[fokus].length && !anders.length,
    `${fokus}: Generator und App zählen in jeder Einheit gleich viele Rüstvorgänge`
    + (anders.length ? ` – anders in ${anders.length}, etwa Einheit ${anders[0][0]}: App ${anders[0][1]}, Generator ${anders[0][2]}` : ''));
}
Object.entries(gemessen).forEach(([f, wert]) => {
  check(wert !== null && typeof STAND[f] === 'number' && wert <= STAND[f] + 0.005,
    `${f}: ${wert} Rüstvorgänge je Einheit, nicht mehr als festgehalten (${STAND[f]})`);
  if (wert !== null && STAND[f] - wert > 0.01) {
    console.log(`     ${f} ist besser geworden – tests/ruestaufwand-stand.json auf ${wert} nachziehen`);
  }
});

// --- Im Supersatz folgt die Rüstzeile dem Ablauf, nicht der Liste ---------
// Gefunden auf dem Weg durch Workout 3 des Aufbau-Plans: Liegestütze ↔ RDL,
// Floor Press ↔ Crunches, Goblet Squat allein. Die Rüstzeile nahm die Übung
// darüber in der Liste als Vorgänger – vor dem ersten RDL-Satz stand „Stange
// bleibt bei 40 kg" (leer, die 40 kg waren die des Floor Press, der danach
// kommt), bei den Crunches „Umbauen von 20" (der Goblet Squat, noch nicht dran).
// Mit dem Vorrat aus dem Fund: Er trennt Floor Press und Goblet Squat (beide
// bräuchten die 5er), deshalb wechselt der Floor Press mit den Crunches.
const ruestIn = async (supersatz) => {
  const c = await browser.newContext({ viewport: { width: 414, height: 896 } });
  await c.route('**/rest/v1/**', (r) => r.fulfill({ status: 204, body: '' }));
  const page = await c.newPage();
  page.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message));
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.evaluate((s) => {
    localStorage.setItem('workout.state.v1', JSON.stringify({
      greeted: true, name: 'Tobi', mode: 'db', focus: 'standard', level: 'geuebt', log: {}, supersatz: s,
      weights: { 'rumaenisches-kreuzheben': 40, 'floor-press': 40, 'fersenerhoehter-goblet-squat': 20, 'gewichtete-crunches': 5 },
      scheiben: { stange: { kh: null, sz: null, lh: null }, scheiben: [[1.25, 4], [2.5, 4], [5, 4], [10, 2]] },
    }));
  }, supersatz);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  for (let i = 0; i < 100; i++) {
    if (/Workout 3\b/.test(await page.locator('#view').textContent())) break;
    await page.locator('[data-act="nav-workout"][data-delta="1"]').first().click();
    await page.waitForTimeout(60);
  }
  await page.locator('[data-act="start-session"]').first().click();
  await page.waitForTimeout(400);
  const namen = await page.evaluate(async () => {
    const { EX_BY_ID } = await import('./js/uebung.js');
    return Object.fromEntries(['rumaenisches-kreuzheben', 'floor-press', 'fersenerhoehter-goblet-squat', 'gewichtete-crunches']
      .map((id) => [id, EX_BY_ID.get(id).db.name]));
  });
  const out = {};
  for (const [id, nm] of Object.entries(namen)) {
    const idx = await page.evaluate((x) => [...document.querySelectorAll('.prog-ex')]
      .findIndex((b) => b.getAttribute('aria-label').includes(x)), nm);
    await page.locator(`[data-act="focus-goto"][data-i="${idx}"]`).click();
    await page.waitForTimeout(250);
    out[id] = {
      ruest: (await page.locator('.ruest').first().textContent()).replace(/\s+/g, ' ').trim(),
      hin: (await page.locator('.super-hin').allTextContents()).join(' | '),
    };
  }
  await c.close();
  return out;
};
const mitSuper = await ruestIn(true);
console.log('     Rüstzeilen W3 mit Supersatz:', JSON.stringify(mitSuper, null, 1));
check(/Im Wechsel mit Gewichtete Crunches/.test(mitSuper['floor-press'].hin)
  && /Im Wechsel mit/.test(mitSuper['rumaenisches-kreuzheben'].hin) && !mitSuper['fersenerhoehter-goblet-squat'].hin,
  'W3 läuft wie im Fund: RDL im Paar, Floor Press mit den Crunches, Goblet Squat allein');
check(/^Aufbauen: Stange auf 40 kg/.test(mitSuper['rumaenisches-kreuzheben'].ruest),
  `RDL kommt als erste Übung an die Stange: aufbauen, nicht „bleibt" (${mitSuper['rumaenisches-kreuzheben'].ruest})`);
check(/^✓ Stange bleibt bei 40 kg/.test(mitSuper['floor-press'].ruest),
  `Floor Press direkt nach dem RDL mit 40 kg: bleibt (${mitSuper['floor-press'].ruest})`);
check(/^Aufbauen: Kurzhantel auf 5 kg/.test(mitSuper['gewichtete-crunches'].ruest),
  `Crunches: aufbauen, kein Umbau von einer Hantel, die noch keiner angefasst hat (${mitSuper['gewichtete-crunches'].ruest})`);
check(/^Umbauen: Kurzhantel von 5 auf 20 kg/.test(mitSuper['fersenerhoehter-goblet-squat'].ruest),
  `Goblet Squat zum Schluss: von den 5 kg der Crunches auf 20 (${mitSuper['fersenerhoehter-goblet-squat'].ruest})`);
const ohneSuper = await ruestIn(false);
check(/^✓ Stange bleibt bei 40 kg/.test(ohneSuper['rumaenisches-kreuzheben'].ruest)
  && /^Aufbauen: Stange auf 40 kg/.test(ohneSuper['floor-press'].ruest),
  `ohne Supersatz gilt die Liste wie bisher (Floor Press: ${ohneSuper['floor-press'].ruest})`);

console.log(`\n${fails ? fails + ' FEHLER' : 'alle Prüfungen bestanden'}`);
console.log('ERRORS:', errs.length ? errs : 'none');
await browser.close();
