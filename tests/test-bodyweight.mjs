/*
 * Der Bodyweight-Modus hat seine eigene Satzzahl.
 *
 * Gerechnet war der Plan für die Hantel-Fassung. Ohne Zusatzlast trifft
 * dieselbe Übung aber teils andere Muskeln – der Goblet Squat hält den Bauch
 * mit 0,35, seine Bodyweight-Fassung mit 0,20 –, und deshalb lag der
 * Bodyweight-Modus systematisch daneben, im ausgewogenen Plan beim Bauch um
 * 0,59 Sätze die Woche. Jetzt bekommt jeder Auftritt zwei bis vier Sätze statt
 * immer drei, und beide Modi treffen dieselben Ziele.
 *
 * Die eigentliche Gefahr dabei ist nicht die Rechnung, sondern die App: Sobald
 * die Satzzahl vom Modus abhängt, wird aus jeder Stelle, die einen Modus
 * *kennt*, ihn aber nicht *weitergibt*, ein Fehler. Eine im Bodyweight-Modus
 * fertig gemachte Einheit würde am Soll der Hantel-Fassung gemessen und käme
 * nie auf „abgeschlossen"; eine halb gemachte Hantel-Einheit gälte nach einem
 * Tipp auf den Umschalter plötzlich als fertig.
 */
import { chromium } from 'playwright';
import { URL } from './umgebung.mjs';

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 414, height: 896 } });
await ctx.route('**/rest/v1/**', (r) => r.fulfill({ status: 204, body: '' }));
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message));
page.on('dialog', (d) => d.accept().catch(() => {}));
let fails = 0;
const check = (c, m) => { console.log(`${c ? 'OK  ' : 'FAIL'} ${m}`); if (!c) { fails++; process.exitCode = 1; } };

// Bis zu welcher Einheit vorab abgeschlossen wird, damit das Dashboard die
// *gesuchte* zeigt. Das Dashboard zeigt immer die erste offene Einheit;
// `lastWorkout` liest es gar nicht. Im alten Plan lag die Übung mit
// abweichender Bodyweight-Satzzahl zufällig in Einheit 1, deshalb fiel das nie
// auf – mit dem neuen steht sie in Einheit 2, und gezählt wurde in einer
// Einheit, in der sie nicht vorkommt.
let zielEinheit = 1;

const frisch = async (extra = {}) => {
  await page.evaluate((e) => localStorage.setItem('workout.state.v1',
    JSON.stringify({ greeted: true, name: 'T', level: 'geuebt', ...e })), extra);
  await page.reload({ waitUntil: 'networkidle' });
  if (zielEinheit > 1) {
    await page.evaluate(async (nn) => {
      const s = await import('./js/store.js');
      const { PLANS } = await import('./js/data.js');
      PLANS.standard.plan.filter((w) => w.n < nn).forEach((w) => s.completeWorkout(
        w.n, 'db', w.ex.map((x) => ({ id: x.id, sets: x.sets }))));
    }, zielEinheit);
    await page.reload({ waitUntil: 'networkidle' });
  }
};

await page.goto(URL, { waitUntil: 'networkidle' });
await frisch();

// --- 1. Die Pläne tragen eine eigene Bodyweight-Satzzahl ---------------
const daten = await page.evaluate(async () => {
  const { PLANS } = await import('./js/data.js');
  const out = {};
  for (const [key, v] of Object.entries(PLANS)) {
    let auftritte = 0; let anders = 0;
    const spanne = new Set();
    v.plan.forEach((w) => w.ex.forEach((it) => {
      const bw = it.bwSets ?? it.sets;
      auftritte += 1;
      spanne.add(bw);
      if (bw !== it.sets) anders += 1;
    }));
    out[key] = { auftritte, anders, spanne: [...spanne].sort() };
  }
  return out;
});
for (const [key, d] of Object.entries(daten)) {
  check(d.anders > 0, `${key}: ${d.anders} von ${d.auftritte} Auftritten weichen ab`);
  check(d.spanne.every((n) => n >= 2 && n <= 4),
    `${key}: alle Bodyweight-Sätze liegen zwischen zwei und vier (${d.spanne.join(', ')})`);
}

// --- 2. Beide Modi treffen dieselben Wochenziele ------------------------
// Die Probe, um die es überhaupt geht – dieselbe Rechnung wie im Generator,
// noch einmal an den ausgelieferten Daten.
const ziele = await page.evaluate(async () => {
  const { PLANS, EXERCISES } = await import('./js/data.js');
  const byId = new Map(EXERCISES.map((e) => [e.id, e]));
  const out = {};
  for (const [key, v] of Object.entries(PLANS)) {
    const wochen = v.plan.length / 4;
    const rechne = (feld, seite) => {
      const acc = {};
      v.plan.forEach((w) => w.ex.forEach((it) => {
        for (const [m, a] of Object.entries(byId.get(it.id)[seite].shares)) {
          acc[m] = (acc[m] || 0) + (it[feld] ?? it.sets) * a;
        }
      }));
      return acc;
    };
    const werte = { db: rechne('sets', 'db'), bw: rechne('bwSets', 'bw') };
    const schlimmst = (seite) => Object.entries(v.target)
      .filter(([m]) => !v.derived.includes(m))
      .map(([m, ziel]) => [m, Math.abs((werte[seite][m] || 0) / wochen - ziel)])
      .sort((a, b) => b[1] - a[1])[0];
    out[key] = { db: schlimmst('db'), bw: schlimmst('bw') };
  }
  return out;
});
for (const [key, z] of Object.entries(ziele)) {
  check(z.db[1] < 0.005, `${key}: die Hantel-Fassung trifft weiter exakt (${z.db[1].toFixed(3)})`);
  check(z.bw[1] < 0.05,
    `${key}: die Bodyweight-Fassung trifft jetzt auch (schlechteste ${z.bw[0]} ${z.bw[1].toFixed(3)})`);
}

// --- 2b. Ohne Hanteln so wenige Wochen über der Grenze wie möglich ------
// Gezählt wie tools/pruefung/wochen-cap.py: je Gruppe und Woche, Grenze
// max(cap, Ziel). bw_verteilen() in tools/build-plan.py hielt die Zahl bis
// zum 05.10. nur unter der der gleichmäßigen Verteilung und ließ den Rest die
// Nähe zu ihr entscheiden – im Aufbau lagen so 75 Gruppenwochen darüber, wo
// 62 gehen, ohne dass eine Einheit länger oder eine Woche stärker wird. Ein
// Vergleichsstand wie tools/pruefung/befunde.json: Die Zahlen dürfen sinken,
// nicht steigen. plan-pruefen.py sieht nur die stärkste Woche, nicht wie oft.
const DRUEBER_OHNE_HANTELN = { standard: 62, bbp: 16, cut: 13, oberkoerper: 9 };
const drueber = await page.evaluate(async () => {
  const { PLANS, EXERCISES } = await import('./js/data.js');
  const byId = new Map(EXERCISES.map((e) => [e.id, e]));
  return Object.fromEntries(Object.entries(PLANS).map(([key, v]) => {
    const wochen = [];
    v.plan.forEach((w, i) => w.ex.forEach((it) => {
      const woche = (wochen[Math.floor(i / 4)] ||= {});
      for (const [m, a] of Object.entries(byId.get(it.id).bw.shares)) {
        woche[m] = (woche[m] || 0) + (it.bwSets ?? it.sets) * a;
      }
    }));
    const n = wochen.reduce((s, woche) => s + Object.entries(woche)
      .filter(([m, x]) => x > Math.max(v.cap, v.target[m] || 0) + 1e-9).length, 0);
    return [key, n];
  }));
});
for (const [key, n] of Object.entries(drueber)) {
  const stand = DRUEBER_OHNE_HANTELN[key];
  check(stand !== undefined && n <= stand,
    `${key}: ohne Hanteln ${n} Gruppenwochen über der Grenze (Vergleichsstand ${stand ?? '–'})`);
}

// --- 3. Die App zeigt je Modus die Zahl dieses Modus -------------------
const fall = await page.evaluate(async () => {
  const { PLANS } = await import('./js/data.js');
  for (const w of PLANS.standard.plan) {
    const it = w.ex.find((x) => (x.bwSets ?? x.sets) !== x.sets);
    if (it) return { n: w.n, id: it.id, db: it.sets, bw: it.bwSets };
  }
  return null;
});
check(!!fall, `eine Übung mit unterschiedlicher Satzzahl gefunden (${JSON.stringify(fall)})`);

// `lastWorkout` allein reichte nie, und es hat nur so ausgesehen: Das
// Dashboard zeigt immer die erste *offene* Einheit. Im alten Plan lag die
// gesuchte Übung zufällig in der ersten, mit dem neuen steht sie in der
// zweiten – gezählt wurde dann in Einheit 1, wo sie nicht vorkommt, und heraus
// kam "0 Satzknöpfe". Der Test hing damit an einer Eigenschaft des Plans, die
// nie jemand zugesagt hat.
zielEinheit = fall.n;
await frisch();

const knoepfe = async (n, modus, id) => {
  await page.evaluate(async ([nn, m]) => {
    const s = await import('./js/store.js');
    s.setWorkoutMode(nn, m);
    s.setSetting('lastWorkout', nn);
  }, [n, modus]);
  await page.reload({ waitUntil: 'networkidle' });
  const auf = page.locator('[data-act="show-list"]');
  if (await auf.count()) { await auf.first().click(); await page.waitForTimeout(250); }
  return page.locator(`.ex-sets .set-btn[data-ex="${id}"]`).count();
};

const nDb = await knoepfe(fall.n, 'db', fall.id);
const nBw = await knoepfe(fall.n, 'bw', fall.id);
check(nDb === fall.db, `im Hantel-Modus stehen ${fall.db} Satzknöpfe (${nDb})`);
check(nBw === fall.bw, `im Bodyweight-Modus stehen ${fall.bw} (${nBw})`);
check(nDb !== nBw, 'und das sind wirklich verschiedene Zahlen');

// --- 4. Abschluss wird je Modus am eigenen Soll gemessen ---------------
// Alle Bodyweight-Sätze abhaken; danach muss die Einheit als abgeschlossen
// gelten. Vorher rechnete das Soll aus dem Hantel-Modus dagegen.
await frisch();
const fertig = await page.evaluate(async ([n]) => {
  const s = await import('./js/store.js');
  const { PLANS } = await import('./js/data.js');
  s.setWorkoutMode(n, 'bw');
  const w = PLANS.standard.plan.find((x) => x.n === n);
  w.ex.forEach((it) => {
    const anzahl = it.bwSets ?? it.sets;
    for (let i = 0; i < anzahl; i++) s.updateSet(n, 'bw', it.id, anzahl, i, { done: true });
  });
  return w.ex.map((it) => it.bwSets ?? it.sets).reduce((a, b) => a + b, 0);
}, [fall.n]);
await page.reload({ waitUntil: 'networkidle' });
await page.locator('.tab[data-tab="stats"]').click();
await page.waitForTimeout(400);
const statText = (await page.locator('.stat-grid').first().textContent()).replace(/\s+/g, ' ');
check(/\b1\b/.test(statText),
  `nach ${fertig} abgehakten Bodyweight-Sätzen zählt die Statistik die Einheit (${statText.slice(0, 90)}…)`);

// --- 5. Ein Modus wird nie am Soll des anderen gemessen ---------------
// Die Gegenprobe zu 4: so viele Sätze abhaken, wie der *andere* Modus
// verlangt. Daraus darf kein Abschluss werden – und die Anzeige muss die Zahl
// des eingestellten Modus nennen, nicht die des anderen.
await frisch();
const soll = await page.evaluate(async ([n]) => {
  const s = await import('./js/store.js');
  const { PLANS } = await import('./js/data.js');
  s.setWorkoutMode(n, 'db');
  s.setSetting('lastWorkout', n);
  const w = PLANS.standard.plan.find((x) => x.n === n);
  // Je Übung nur so viele Sätze wie im Bodyweight-Modus – im Hantel-Modus
  // fehlt damit überall dort etwas, wo die Bodyweight-Zahl kleiner ist.
  let gesetzt = 0;
  w.ex.forEach((it) => {
    const wenig = Math.min(it.sets, it.bwSets ?? it.sets);
    for (let i = 0; i < wenig; i++) { s.updateSet(n, 'db', it.id, it.sets, i, { done: true }); gesetzt += 1; }
  });
  return { gesetzt, db: w.ex.reduce((a, it) => a + it.sets, 0) };
}, [fall.n]);
await page.reload({ waitUntil: 'networkidle' });
const abzeichen = (await page.locator('.hero-badges, .ov-top').first().textContent()).replace(/\s+/g, ' ');
check(soll.gesetzt < soll.db, `es fehlen Sätze (${soll.gesetzt} von ${soll.db})`);
check(!/Abgeschlossen/.test(abzeichen),
  `die Einheit gilt nicht als abgeschlossen (${abzeichen.slice(0, 70)}…)`);
check(abzeichen.includes(`${soll.gesetzt}/${soll.db}`),
  `und die Anzeige nennt das Hantel-Soll ${soll.gesetzt}/${soll.db} (${abzeichen.slice(0, 70)}…)`);

// --- 6. Umstellen unter Mehr: laufende und unberührte Einheit, keine fertige ---
// set-modus schrieb den Modus der Einheit um, die zuletzt auf dem Dashboard
// stand – auch einer fertigen. Die Hantel-Einheit von heute hieß nach „ab
// jetzt Bodyweight" plötzlich Bodyweight-Einheit.
await page.evaluate(() => localStorage.setItem('workout.state.v1',
  JSON.stringify({ greeted: true, name: 'T', level: 'geuebt', mode: 'db', restSeconds: 0 })));
await page.reload({ waitUntil: 'networkidle' });
await page.evaluate(async () => {
  const s = await import('./js/store.js');
  const { workoutByNo } = await import('./js/plan.js');
  s.completeWorkout(1, 'db', workoutByNo(1, 'db').ex);
  s.markDone(1, 'db');
});
await page.reload({ waitUntil: 'networkidle' });
const modusVon = (n) => page.evaluate(async (nn) => {
  const s = await import('./js/store.js');
  return { mode: s.workoutMode(nn), eintrag: (s.getState().log[nn] || {}).mode || null };
}, n);
const umstellen = async (m) => {
  await page.locator('.tab[data-tab="settings"]').click();
  await page.waitForTimeout(200);
  await page.locator(`[data-act="set-modus"][data-v="${m}"]`).first().click();
  await page.waitForTimeout(200);
  await page.locator('.tab[data-tab="dashboard"]').click();
  await page.waitForTimeout(200);
};
// Zur fertigen Einheit 1 zurückblättern, dann umstellen.
const vorn6 = await page.evaluate(() => (document.querySelector('.hero-eyebrow') || {}).textContent || '');
if (!/Workout 1\b/.test(vorn6)) {
  await page.locator('[data-act="nav-workout"][data-delta="-1"]').first().click();
  await page.waitForTimeout(200);
}
await umstellen('bw');
const fertig1 = await modusVon(1);
const naechste2 = await modusVon(2);
check(fertig1.mode === 'db', `die fertige Hantel-Einheit bleibt Hantel-Einheit (${fertig1.mode})`);
check(naechste2.mode === 'bw', `die nächste, unberührte Einheit nimmt die neue Variante (${naechste2.mode})`);
// Mitten in Einheit 2 zurück auf Hanteln: Die laufende wechselt mit.
await page.locator('[data-act="nav-workout"][data-delta="1"]').first().click();
await page.waitForTimeout(200);
await page.locator('[data-act="start-session"]').first().click();
await page.waitForTimeout(200);
await page.locator('.focus-set').first().click();
await page.waitForTimeout(200);
await umstellen('db');
const laufend2 = await modusVon(2);
check(laufend2.mode === 'db', `die laufende Einheit wechselt mitten im Training mit (${laufend2.mode})`);
check((await modusVon(1)).mode === 'db', 'und die fertige bleibt, wie sie war');

// --- 7. Vorab angesehen heißt nicht gewählt -----------------------------
// Das bloße Öffnen der Übungsliste von Workout 2 legte einen Eintrag mit dem
// damaligen Modus an, und der überstimmte danach jeden Wechsel unter Mehr:
// Workout 2 kam beim nächsten Training mit Hanteln, entgegen „die nächsten
// nehmen sie von selbst".
// Frisch anfangen. Erst die laufende Einheit beenden und warten: Beim
// Neuladen hält die App die Uhr an und schreibt ihren Stand (pagehide), und
// der überholte sonst den hier gesetzten.
const neuerStand = async () => {
  await page.evaluate(async () => (await import('./js/store.js')).endSession());
  await page.waitForTimeout(300);
  await page.evaluate(() => localStorage.setItem('workout.state.v1',
    JSON.stringify({ greeted: true, name: 'T', level: 'geuebt', mode: 'db', restSeconds: 0 })));
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(200);
};
await neuerStand();
await page.locator('[data-act="nav-workout"][data-delta="1"]').first().click();
await page.waitForTimeout(200);
await page.locator('[data-act="show-list"]').first().click();
await page.waitForTimeout(300);
const angesehen = await page.evaluate(async () => (await import('./js/store.js')).getState().log[2] || null);
check(angesehen && !angesehen.mode,
  `die Liste von Workout 2 ist angesehen, ohne eine Variante festzulegen (${JSON.stringify(angesehen && angesehen.mode)})`);
await page.locator('[data-act="hide-list"]').first().click();
await page.waitForTimeout(200);
await page.locator('[data-act="nav-workout"][data-delta="-1"]').first().click();
await page.waitForTimeout(200);
await umstellen('bw');
check((await modusVon(2)).mode === 'bw',
  `die vorab angesehene Einheit nimmt die neue Variante (${(await modusVon(2)).mode})`);
// Auch ein Eintrag aus der Zeit davor, der schon einen Modus trägt, folgt.
await page.evaluate(async () => {
  const s = await import('./js/store.js');
  s.getState().log[3] = { db: {}, bw: {}, mode: 'bw' };
});
await umstellen('db');
check((await modusVon(3)).mode === 'db',
  `ein alter, unberührter Eintrag mit Modus folgt ebenso (${(await modusVon(3)).mode})`);

// --- 8. „Alle Sätze abhaken" beendet die laufende Einheit ---------------
// Bisher hakte der Knopf nur ab: Die Uhr lief weiter, jede andere Einheit
// zeigte „Workout 1 läuft noch", und ein Wechsel unter Mehr stellte die
// fertige Einheit als „laufende" auf Bodyweight um – 17/18.
await neuerStand();
await page.locator('[data-act="start-session"]').first().click();
await page.waitForTimeout(300);
await page.locator('[data-act="focus-list"]').first().click();
await page.waitForTimeout(300);
await page.locator('[data-act="complete-workout"]').first().click();
await page.waitForTimeout(400);
const nachAlle = await page.evaluate(async () => {
  const s = await import('./js/store.js');
  const e = s.getState().log[1] || {};
  return { session: s.getState().session, done: e.done || null };
});
check(!nachAlle.session && nachAlle.done === 'db',
  `nach „Alle Sätze abhaken" ist die Einheit abgeschlossen und läuft nicht mehr (${JSON.stringify(nachAlle)})`);
await umstellen('bw');
check((await modusVon(1)).mode === 'db',
  `ein Wechsel danach lässt die fertige Hantel-Einheit, wie sie ist (${(await modusVon(1)).mode})`);
// Und set-modus stellt auch eine laufende Einheit nicht um, die schon ganz
// abgehakt ist und nur noch auf „Abschließen" wartet.
await page.evaluate(async () => {
  const s = await import('./js/store.js');
  const { workoutByNo } = await import('./js/plan.js');
  s.setMode('db');
  s.startSession(2);
  workoutByNo(2, 'db').ex.forEach((it) => {
    for (let i = 0; i < it.sets; i++) s.updateSet(2, 'db', it.id, it.sets, i, { done: true }, it.nach || 0);
  });
});
await page.reload({ waitUntil: 'networkidle' });
await umstellen('bw');
check((await modusVon(2)).mode === 'db',
  `eine fertig abgehakte, noch laufende Einheit bleibt bei Hanteln (${(await modusVon(2)).mode})`);

// --- 9. Abbrechen nach einem Wechsel verwirft beide Varianten -----------
// Zwei Sätze mit Hanteln, dann unter Mehr auf Bodyweight, dann „Abbrechen":
// Die Rückfrage nannte die zwei Sätze, gelöscht wurde aber nur der leere
// Bodyweight-Eimer – und der Toast meldete „nichts gespeichert".
const fragen = [];
page.on('dialog', (d) => fragen.push(d.message()));
const zweiSaetzeDannBw = async () => {
  await neuerStand();
  await page.locator('[data-act="start-session"]').first().click();
  await page.waitForTimeout(300);
  await page.locator('.focus-set').first().click();
  await page.waitForTimeout(200);
  await page.locator('.focus-set:not(.on)').first().click();
  await page.waitForTimeout(200);
  await umstellen('bw');
  // Zur Übungsliste der laufenden Einheit – aus der Fokusansicht oder der Übersicht.
  const weg = (await page.locator('[data-act="focus-list"]').count()) ? 'focus-list' : 'show-list';
  await page.locator(`[data-act="${weg}"]`).first().click();
  await page.waitForTimeout(300);
};
const stand1 = () => page.evaluate(async () => {
  const s = await import('./js/store.js');
  const e = s.getState().log[1] || {};
  const zahl = (m) => Object.values(e[m] || {})
    .reduce((a, arr) => a + (Array.isArray(arr) ? arr.filter((x) => x.done).length : 0), 0);
  return { db: zahl('db'), bw: zahl('bw'), angefangen: s.isStarted(1), session: s.getState().session };
});
await zweiSaetzeDannBw();
const vorAbbruch = await stand1();
check(vorAbbruch.db === 2 && vorAbbruch.bw === 0, `zwei Hantelsätze, dann Bodyweight (${JSON.stringify(vorAbbruch)})`);
fragen.length = 0;
await page.locator('[data-act="discard-session"]').first().click();
await page.waitForTimeout(400);
const nachAbbruch = await stand1();
const toastAbbruch = await page.evaluate(() => document.getElementById('toast').textContent);
check(/2 abgehakte Sätze/.test(fragen[0] || ''), `die Rückfrage nennt die zwei Sätze („${fragen[0]}")`);
check(nachAbbruch.db === 0 && nachAbbruch.bw === 0 && !nachAbbruch.angefangen && !nachAbbruch.session,
  `und genau die sind danach weg – in beiden Varianten, die Einheit ist unberührt (${JSON.stringify(nachAbbruch)})`);
check(/nichts gespeichert/.test(toastAbbruch), `„nichts gespeichert" stimmt jetzt („${toastAbbruch}")`);

// Zurücksetzen bei laufender Einheit genauso.
await zweiSaetzeDannBw();
fragen.length = 0;
await page.locator('[data-act="reset-workout"]').first().click();
await page.waitForTimeout(400);
const nachReset = await stand1();
check(/beiden Varianten/.test(fragen[0] || ''), `„Zurücksetzen" sagt, dass beide Varianten gehen („${fragen[0]}")`);
check(nachReset.db === 0 && nachReset.bw === 0 && !nachReset.angefangen,
  `und setzt bei der laufenden Einheit beide zurück (${JSON.stringify(nachReset)})`);

check(errs.length === 0, `keine Fehler${errs.length ? ': ' + errs.join(' | ') : ''}`);
console.log(`\n${fails ? fails + ' FEHLER' : 'alle Prüfungen bestanden'}`);
await browser.close();
