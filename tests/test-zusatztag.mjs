/*
 * Der Zusatztag: eine Einheit daneben statt Sätze hineingestopft.
 *
 * Die Nacharbeit hat einen Deckel von drei Sätzen, und der ist gewollt. Wer
 * aber eine ganze Einheit ausgelassen hat, dem fehlen fünfzehn – die passen
 * nirgendwo mehr hinein, ohne dass die nächste Einheit zur Zumutung wird.
 *
 * Vier Dinge müssen stimmen, und zwei davon sind Fälle, in denen *nichts*
 * angeboten werden darf:
 *
 *   1. Wer seine Woche gemacht hat, bekommt keinen Vorschlag.
 *   2. Solange die Woche noch läuft, auch nicht – da ist nichts versäumt.
 *   3. Bei echtem Rückstand: eine Einheit aus genau dem, was fehlt.
 *   4. Und die 48-Stunden-Regel gilt auch für sie. Sonst stünde die Regel, die
 *      den ganzen Plan trägt, ausgerechnet für die freiwillige Einheit nicht.
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
page.on('dialog', (d) => d.accept().catch(() => {}));
let fails = 0;
const check = (c, m) => { console.log(`${c ? 'OK  ' : 'FAIL'} ${m}`); if (!c) { fails++; process.exitCode = 1; } };

const setze = (z) => page.evaluate(
  (o) => localStorage.setItem('workout.state.v1', JSON.stringify(o)), z);

/** Protokoll für die Einheiten `von`..`bis`; `auslassen` Übungen je Einheit weg. */
const protokoll = (von, bis, auslassen = 0) => page.evaluate(async ([a, b, weg]) => {
  const { PLAN } = await import('./js/data.js');
  const log = {};
  PLAN.slice(a, b).forEach((w) => {
    const e = { mode: 'db', done: 'db', db: {} };
    w.ex.slice(0, Math.max(1, w.ex.length - weg)).forEach((it) => {
      e.db[it.id] = Array.from({ length: it.sets }, () => ({ w: '20', r: '', done: true }));
    });
    log[w.n] = e;
  });
  return log;
}, [von, bis, auslassen]);

await page.goto(URL, { waitUntil: 'networkidle' });

// Der Plan rückt beim Laden auf heute nach. Damit die erste Woche wirklich in
// der Vergangenheit liegt, wird die Verschiebung fest gesetzt – sonst steht die
// „abgeschlossene" Woche je nach Testtag noch in der Zukunft.
//
// Minus, nicht plus: Die Verschiebung kommt auf das Plandatum drauf, und mit
// „+ 14" lag Workout 1 zwei Wochen *vor* uns. Abschnitt 5 fand dann an keinem
// Tag eine Einheit in Reichweite und war grün, ohne etwas zu prüfen.
//
// Die zwei Wochen gelten aber nur bis zum Laden: `schiebe` legt Workout 1 auf
// heute − 14, damit ist Workout 5 schon verstrichen, und catchUpPlan() rückt
// den Plan nach, bis Workout 5 auf heute fällt. Die abgehakten Einheiten haben
// hier kein startedOn und wandern mit. Danach liegen W1 bei −7, W4 bei −2,
// W5 heute und W6 bei +2 – in Reichweite (unter REST.days) ist damit nur W5,
// die anstehende Einheit, gegen die der Zusatztag ruhen muss. Den Fall einer
// gestern *abgeschlossenen* Einheit prüft ein eigener Abschnitt weiter unten.
const schiebe = await page.evaluate(async () => {
  const { PLAN } = await import('./js/data.js');
  const { daysBetween, todayISO } = await import('./js/dates.js');
  return daysBetween(PLAN[0].date, todayISO()) - 14;   // W1 vor dem Nachrücken bei −14
});

const zustand = () => page.evaluate(async () => {
  const store = await import('./js/store.js');
  const s = store.getState();
  return { hinweis: s.zusatztag, customs: store.customs().map((c) => c.name) };
});

// --- 1. Volle Woche: es passiert nichts ---------------------------------
await setze({ greeted: true, name: 'T', level: 'geuebt', shift: schiebe,
  log: await protokoll(0, 4, 0) });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(500);
let z = await zustand();
check(z.customs.length === 0, 'wer seine Woche gemacht hat, bekommt keinen Zusatztag');
check(!z.hinweis, 'und keinen Hinweis');

// --- 2. Woche läuft noch: auch nichts -----------------------------------
await setze({ greeted: true, name: 'T', level: 'geuebt', shift: 0,
  log: await protokoll(0, 2, 0) });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(500);
z = await zustand();
check(z.customs.length === 0,
  'solange die Woche läuft, wird nichts angelegt – da ist nichts versäumt');

// --- 3. Woche durch, Rückstand: der Zusatztag ist einfach da ------------
// Ungefragt, ohne Knopf. Das ist der Punkt: Wer erst suchen und drücken muss,
// bekommt keine Anpassung, sondern eine Hausaufgabe.
await setze({ greeted: true, name: 'T', level: 'geuebt', shift: schiebe,
  log: await protokoll(0, 4, 2) });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(600);
z = await zustand();
console.log('     ', JSON.stringify(z.hinweis));
check(z.customs.length === 1 && /Zusatztag Woche 1/.test(z.customs[0]),
  `der Zusatztag steht von selbst da (${z.customs.join(', ') || 'nichts'})`);
// Und ohne jede Meldung: „Die Zusatztag Meldung brauchen wir nicht. Es soll
// einfach passieren." Der Kasten mit drei Knöpfen ist raus – stattdessen *ist*
// der Zusatztag die nächste Einheit. Eine Meldung, die erklärt, was ohnehin
// gleich dasteht, ist eine Zwischenstation ohne Aufgabe.
check(!z.hinweis, 'ohne Meldung – es passiert einfach');
check(await page.locator('[data-act="zusatztag-weg"]').count() === 0,
  'und ohne die drei Knöpfe, von denen zwei nur „weg damit" hießen');
// Workout 5 liegt hier auf heute (siehe `schiebe`). Dann steht der Plan vorn
// – nicht umgekehrt: Vorher zeigte das Dashboard „Eigenes Workout /
// Zusatztag Woche 1", und dass heute Workout 5 dran war, stand nirgends.
//
// Und der Zusatztag steckt *in* Workout 5. Danach stand er eine Weile als
// „Als zweite Einheit heute" darunter – „Was soll das mit zweite Einheit.
// Wenn heute Übungen dazu kommen dann soll alles flüssig in EINE Einheit".
// Jetzt ein Start, und im Kopf „5 + 1 Übungen" (test-zusatz-einheit.mjs prüft
// den ganzen Ablauf an Tobis Stand).
const kopf = (await page.locator('.hero-eyebrow').textContent()).trim();
console.log('     Startansicht zeigt:', kopf);
check(/Heute · Workout 5/.test(kopf),
  `an einem Tag mit fälliger Planeinheit steht sie vorn (${kopf})`);
check(await page.locator('.zusatz-danach').count() === 0
  && await page.locator('#view [data-act="custom-start"]').count() === 0,
'keine zweite Einheit daneben, kein zweiter Start');
const sub5 = (await page.locator('.hero-sub').textContent()).trim();
check(/\d+ \+ \d+ Übungen/.test(sub5), `der Zusatz steht im Kopf der Einheit (${sub5})`);

// --- 4. Die Einheit selbst ----------------------------------------------
// Eingefügt: eine bis zwei Übungen, jede, weil sie sich trägt (NACH_ANTEIL –
// mindestens die Hälfte dessen, was sie direkt trainiert, geht in den
// Rückstand), keine doppelt. Nachgerechnet mit dem Rückstand der Woche: Soll
// aus dem Plan, Ist aus den Haken; gezählt nur Gruppen, die heute nicht ruhen
// (Workout 5 ist heute fällig, Workout 4 liegt zwei Tage zurück).
const angelegt = await page.evaluate(async () => {
  const P = await import('./js/plan.js');
  const D = await import('./js/data.js');
  const store = await import('./js/store.js');
  const byId = new Map(D.EXERCISES.map((e) => [e.id, e]));
  const ex = P.workoutByNo(5, 'db').ex;
  const zus = ex.filter((x) => x.zusatz);
  const luecke = {};
  D.PLAN.slice(0, 4).forEach((w) => P.exBasis(w, 'db').forEach((it) => {
    const done = (((store.getState().log[w.n] || {}).db || {})[it.id] || []).filter((s) => s.done).length;
    Object.entries(byId.get(it.id).db.shares).forEach(([g, s]) => {
      luecke[g] = (luecke[g] || 0) + (it.sets - done) * s;
    });
  }));
  const ruht = new Set(P.exBasis(D.PLAN[4], 'db').flatMap((it) => Object.entries(byId.get(it.id).db.shares)
    .filter(([, s]) => s >= D.REST.direct).map(([g]) => g)));
  const traegt = zus.map((x) => {
    const sh = byId.get(x.id).db.shares;
    const wert = Object.entries(sh).reduce((a, [g, s]) => a + (ruht.has(g) ? 0 : Math.min(s * x.sets, Math.max(0, luecke[g] || 0))), 0);
    const direkt = Object.values(sh).filter((s) => s >= D.REST.direct).reduce((a, s) => a + s, 0) * x.sets;
    Object.entries(sh).forEach(([g, s]) => { luecke[g] = (luecke[g] || 0) - s * x.sets; });
    return { id: x.id, wert, direkt, ok: wert >= P.NACH_ANTEIL * direkt - 1e-9 };
  });
  return { ids: ex.map((x) => x.id), zus: zus.map((x) => ({ id: x.id, woche: x.zusatz.woche })), traegt };
});
console.log('     ', JSON.stringify(angelegt));
check(angelegt.zus.length >= 1 && angelegt.zus.length <= 2 && angelegt.zus.every((x) => x.woche === 1),
  `eine bis zwei Übungen, eingefügt in Workout 5 (${angelegt.zus.map((x) => x.id).join(', ')})`);
check(angelegt.traegt.every((x) => x.ok),
  `jede trägt sich – mindestens die Hälfte ihres direkten Anteils geht in den Rückstand (${
    angelegt.traegt.map((x) => `${x.id} ${x.wert.toFixed(2)}/${x.direkt.toFixed(2)}`).join(', ')})`);
check(new Set(angelegt.ids).size === angelegt.ids.length, 'keine Übung doppelt');

// --- 5. Die Erholungsregel gilt auch hier --------------------------------
// Gezählt wird in Kalendertagen am tatsächlichen Termin, wie in
// ruhendeGruppen(). Mit `new Date()` samt Uhrzeit rundete eine Einheit von
// übermorgen ab Mittag auf „morgen" und galt als in Reichweite, die App aber
// sperrt sie zu Recht nicht. Und gezählt wird, wie viele Einheiten überhaupt
// geprüft wurden: Eine leere Schleife meldet keine Kollision, das hieß hier
// bisher „bestanden".
const ruhe = await page.evaluate(async () => {
  const store = await import('./js/store.js');
  const daten = await import('./js/data.js');
  const { effDate } = await import('./js/plan.js');
  const { daysBetween, todayISO } = await import('./js/dates.js');
  const c = store.customs()[0];
  const byId = new Map(daten.EXERCISES.map((e) => [e.id, e]));
  const heute = todayISO();
  const direktIm = (liste) => new Set(liste.flatMap((x) => Object.entries(byId.get(x.id).db.shares)
    .filter(([, sh]) => sh >= daten.REST.direct).map(([m]) => m)));
  const zusatz = direktIm(c.ex);
  const treffer = [];
  const geprueft = [];
  daten.PLAN.forEach((w) => {
    if (Math.abs(daysBetween(effDate(w), heute)) >= daten.REST.days) return;
    geprueft.push(`W${w.n}`);
    direktIm(w.ex).forEach((m) => { if (zusatz.has(m)) treffer.push(`${m}@W${w.n}`); });
  });
  return { treffer, geprueft };
});
console.log('      in Reichweite:', ruhe.geprueft.join(', ') || 'keine');
check(ruhe.geprueft.length > 0,
  `mindestens eine Planeinheit liegt in Reichweite und wird geprüft (${ruhe.geprueft.length})`);
check(ruhe.treffer.length === 0,
  `keine Gruppe kollidiert mit einer Einheit in Reichweite${
    ruhe.treffer.length ? ': ' + ruhe.treffer.slice(0, 4).join(', ') : ''}`);

// --- 6. Kein zweiter beim nächsten Laden --------------------------------
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(500);
z = await zustand();
check(z.customs.length === 1, `es bleibt bei einem (${z.customs.length})`);

// --- 7. Am Ruhetag steht er allein – wer ihn nicht will, blättert vorbei --
// „Brauch ich nicht" gibt es nicht mehr – der Knopf war zwei Drittel eines
// Kastens, den niemand bestellt hat. Der Weg zurück in den Plan reicht: Der
// Zusatztag steht dann eben da und wird beim nächsten Wochenwechsel durch den
// neuen ersetzt, wenn er unberührt bleibt.
//
// Allein steht er nur an einem Tag ohne fällige Planeinheit. Dafür tragen die
// vier Einheiten hier ihren Trainingstag (−8, −6, −4, −3), und Workout 5
// liegt drei Tage voraus: heute ein Ruhetag, und keine Einheit in Reichweite
// der Erholungsregel.
const ruhetag = await page.evaluate(async () => {
  const { PLAN } = await import('./js/data.js');
  const { addDays, daysBetween, todayISO } = await import('./js/dates.js');
  const heute = todayISO();
  return { shift: daysBetween(PLAN[4].date, addDays(heute, 3)),
    tage: { 1: addDays(heute, -8), 2: addDays(heute, -6), 3: addDays(heute, -4), 4: addDays(heute, -3) } };
});
const ruhetagLog = await protokoll(0, 4, 2);
Object.entries(ruhetag.tage).forEach(([n, tag]) => { ruhetagLog[n].startedOn = tag; });
await setze({ greeted: true, name: 'T', level: 'geuebt', shift: ruhetag.shift, log: ruhetagLog });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(500);
await page.locator('.tab[data-tab="dashboard"]').click();
await page.waitForTimeout(300);
const alleinKopf = (await page.locator('.hero-eyebrow').textContent()).trim();
const alleinTitel = (await page.locator('.hero-title').textContent()).trim();
console.log('     am Ruhetag:', alleinKopf, '/', alleinTitel);
check(/Heute · Zusatztag$/.test(alleinKopf) && /Zusatztag Woche 1/.test(alleinTitel),
  `am Ruhetag ist er die Einheit des Tages („${alleinKopf}" / „${alleinTitel}")`);
check(await page.locator('[data-act="back-to-plan"]').count() === 1,
  'und es gibt den Weg zurück in den Plan, wer ihn nicht will');
await page.locator('[data-act="back-to-plan"]').click();
await page.waitForTimeout(400);
const zurueck = (await page.locator('.hero-eyebrow').textContent()).trim();
console.log('     nach „Zurück zum Plan":', zurueck);
check(/Workout \d+/.test(zurueck), `„Zurück zum Plan" führt in den Plan (${zurueck})`);
z = await zustand();
check(z.customs.length === 1, 'der Zusatztag bleibt dabei liegen – er ist ja nicht falsch');

/* ------------------------------------------------------------------ *
 * Ein Zusatztag überlebt seine Runde nicht
 *
 * *„Okay ist heute Zusatztag oder normaler übungstag?"* – Das Dashboard bot
 * „Zusatztag Woche 1" an, der Kalender zeigte für denselben Tag Workout 1 des
 * Cut-Plans. Beide hatten recht: Der Zusatztag stammte aus der Aufbau-Runde,
 * die beim Fokuswechsel in die Ablage gewandert war. Er blieb stehen, und weil
 * naechsteEinheit() ihn dem Plan vorzieht, war er die nächste Einheit.
 * ------------------------------------------------------------------ */
await page.evaluate(async () => {
  const store = await import('./js/store.js');
  const { PLAN } = await import('./js/data.js');
  // Eine Woche komplett, aber knapp – so entsteht ein Zusatztag.
  const wochenEnde = 3;
  PLAN.slice(0, wochenEnde).forEach((w) => store.completeWorkout(
    w.n, 'db', w.ex.slice(0, 2).map((x) => ({ id: x.id, sets: x.sets }))));
});
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(500);
const frischAngelegt = await page.evaluate(async () => (await import('./js/store.js'))
  .customs().filter((c) => /^Zusatztag Woche /.test(c.name)).map((c) => c.name));
console.log('     frischAngelegt:', JSON.stringify(frischAngelegt));
check(frischAngelegt.length >= 1, `nach einer knappen Woche steht ein Zusatztag da (${frischAngelegt.length})`);

// Und jetzt die Runde weglegen, so wie es ein Fokuswechsel tut.
await page.evaluate(async () => {
  const store = await import('./js/store.js');
  store.restartPlan(0, null);
});
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(500);
const nachAblage = await page.evaluate(async () => {
  const store = await import('./js/store.js');
  const text = document.getElementById('view').textContent.replace(/\s+/g, ' ');
  return {
    uebrig: store.customs().filter((c) => /^Zusatztag Woche /.test(c.name)).map((c) => c.name),
    imDashboard: /Zusatztag Woche/.test(text),
  };
});
console.log('     nach dem Weglegen der Runde:', JSON.stringify(nachAblage));
check(nachAblage.uebrig.length === 0,
  `der unberührte Zusatztag ist weg (${nachAblage.uebrig.join(', ') || 'keiner mehr'}) – er gehörte zu einer Runde, die es nicht mehr gibt`);
check(!nachAblage.imDashboard,
  'und das Dashboard bietet ihn nicht mehr als nächste Einheit an');

// Ein *angefangener* bleibtStehen: Was abgehakt ist, wird nicht weggeräumt.
const schonAngefasst = await page.evaluate(async () => {
  const store = await import('./js/store.js');
  const { EXERCISES } = await import('./js/data.js');
  const id = store.saveCustom({ name: 'Zusatztag Woche 9',
    ex: [{ id: EXERCISES[0].id, sets: 2 }] });
  // updateSet braucht die Satzzahl mit: Ohne sie legt getSets() kein Feld an,
  // und Object.assign stolpert über undefined.
  store.updateSet(id, 'db', EXERCISES[0].id, 2, 0, { done: true, w: '10' });
  return id;
});
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(500);
const bleibtStehen = await page.evaluate(async () => (await import('./js/store.js'))
  .customs().some((c) => c.name === 'Zusatztag Woche 9'));
check(bleibtStehen, 'ein angefangener Zusatztag bleibtStehen stehen – abgehakte Sätze räumt niemand weg');
void schonAngefasst;

/* ------------------------------------------------------------------ *
 * Auch die Einheit von gestern sperrt
 *
 * Abschnitt 5 trifft nur die *anstehende* Einheit: Nach dem Nachrücken liegt
 * Workout 4 genau zwei Tage zurück und damit außer Reichweite. Der andere Zweig
 * in ruhendeGruppen() – eine abgehakte Einheit von gestern sperrt ihre Gruppen
 * – lief nie mit. Man konnte ihn ausbauen, und der Test blieb grün.
 *
 * Einfach Workout 4 auf gestern zu legen reicht nicht: Dann sperren W4 und das
 * auf heute gerückte W5 zusammen alles bis auf die Quads, und unter zwei
 * Übungen gibt es gar keinen Zusatztag – geprüft wäre wieder nichts. Deshalb
 * tragen hier alle vier Einheiten ihren echten Trainingstag (W1 −7, W2 −5,
 * W3 −3, W4 gestern), und der Rest des Plans liegt drei Tage voraus: W5 ist
 * noch nicht dran, catchUpPlan() hat nichts nachzurücken. In Reichweite ist
 * damit allein Workout 4 – abgeschlossen, gestern.
 * ------------------------------------------------------------------ */
const gesternAufbau = await page.evaluate(async () => {
  const { PLAN } = await import('./js/data.js');
  const { addDays, daysBetween, todayISO } = await import('./js/dates.js');
  const heute = todayISO();
  return {
    shift: daysBetween(PLAN[4].date, heute) + 3,     // W5 bei +3
    tage: { 1: addDays(heute, -7), 2: addDays(heute, -5),
            3: addDays(heute, -3), 4: addDays(heute, -1) },
    gestern: addDays(heute, -1),
  };
});
const gesternLog = await protokoll(0, 4, 2);
Object.entries(gesternAufbau.tage).forEach(([n, tag]) => { gesternLog[n].startedOn = tag; });
await setze({ greeted: true, name: 'T', level: 'geuebt', shift: gesternAufbau.shift,
  log: gesternLog });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(600);

const gesternRuhe = await page.evaluate(async () => {
  const store = await import('./js/store.js');
  const daten = await import('./js/data.js');
  const { effDate, completedMode } = await import('./js/plan.js');
  const { daysBetween, todayISO } = await import('./js/dates.js');
  const byId = new Map(daten.EXERCISES.map((e) => [e.id, e]));
  const heute = todayISO();
  const direktIm = (liste) => new Set(liste.flatMap((x) => Object.entries(byId.get(x.id).db.shares)
    .filter(([, sh]) => sh >= daten.REST.direct).map(([m]) => m)));
  const c = store.customs().find((x) => /^Zusatztag Woche 1$/.test(x.name));
  const w4 = daten.PLAN[3];
  // Was ausgelassen wurde: je Einheit die letzten zwei Übungen (protokoll()).
  const ausgelassen = direktIm(daten.PLAN.slice(0, 4).flatMap((w) => w.ex.slice(-2)));
  // Gesperrt sind nur die Gruppen der Übungen, die gestern wirklich trainiert
  // wurden – nicht die der ausgelassenen (siehe ruhendeGruppen()).
  const gruppenW4 = direktIm(w4.ex.slice(0, -2));
  const nurAusgelassenW4 = [...direktIm(w4.ex.slice(-2))].filter((m) => !gruppenW4.has(m));
  const zusatz = c ? direktIm(c.ex) : new Set();
  return {
    angelegt: c ? c.ex.map((x) => x.id) : null,
    w4: { termin: effDate(w4), fertig: !!completedMode(w4.n) },
    inReichweite: daten.PLAN.filter((w) => Math.abs(daysBetween(effDate(w), heute))
      < daten.REST.days).map((w) => `W${w.n}`),
    // Gruppen von W4, die auch im Rückstand stehen: Die würde der Zusatztag
    // ohne die Sperre nehmen. Ist das leer, beweist der Fall nichts.
    gewollt: [...gruppenW4].filter((m) => ausgelassen.has(m)),
    treffer: [...gruppenW4].filter((m) => zusatz.has(m)),
    // Gestern ausgelassen und auch sonst nicht trainiert: ruht nicht.
    frei: nurAusgelassenW4.filter((m) => ausgelassen.has(m)),
    freiImZusatz: nurAusgelassenW4.filter((m) => zusatz.has(m)),
  };
});
console.log('     gestern abgeschlossen:', JSON.stringify(gesternRuhe));
check(gesternRuhe.w4.termin === gesternAufbau.gestern && gesternRuhe.w4.fertig,
  `Workout 4 ist abgehakt und liegt auf gestern (${gesternRuhe.w4.termin})`);
check(gesternRuhe.inReichweite.join() === 'W4',
  `in Reichweite ist allein Workout 4 (${gesternRuhe.inReichweite.join(', ') || 'keine'})`);
check(gesternRuhe.gewollt.length > 0,
  `der Rückstand enthält Gruppen von Workout 4 – sonst gäbe es nichts zu sperren (${
    gesternRuhe.gewollt.join(', ')})`);
check(gesternRuhe.angelegt && gesternRuhe.angelegt.length >= 2,
  `trotzdem entsteht ein Zusatztag mit mindestens zwei Übungen (${
    gesternRuhe.angelegt ? gesternRuhe.angelegt.length : 'keiner'})`);
check(gesternRuhe.treffer.length === 0,
  `und er lässt die Gruppen von gestern in Ruhe${
    gesternRuhe.treffer.length ? ': ' + gesternRuhe.treffer.join(', ') + '@W4' : ''}`);
// „Hab gestern mein Training nicht ganz beendet. Müssten die muskelgruppen
// nicht heute dazu kommen oder so?" – Was gestern liegen blieb, ist nicht
// ermüdet und darf in den Zusatztag. Vorher sperrte die Einheit von gestern
// alle ihre Gruppen, auch die der ausgelassenen Übungen.
check(gesternRuhe.frei.length > 0,
  `gestern Ausgelassenes steht im Rückstand und ist sonst nicht trainiert (${gesternRuhe.frei.join(', ')})`);
check(gesternRuhe.freiImZusatz.length > 0,
  `der Zusatztag nimmt gestern Ausgelassenes auf (${gesternRuhe.freiImZusatz.join(', ') || 'nichts'})`);

// --- Aufstieg und Zusatztag beim selben Start ----------------------------
// Beim Start stand `pruefeAufstieg() || pruefeZusatztag()`: Kam ein Aufstieg,
// lief die zweite Prüfung gar nicht, und der fällige Zusatztag fehlte bis zum
// nächsten Laden. Aufstieg wie in test-aufstieg.mjs: Anfänger mit Gewichten
// über dem Start.
const steigt = await page.evaluate(async () => {
  const { EXERCISES } = await import('./js/data.js');
  const w = {};
  EXERCISES.filter((e) => e.weight > 0).slice(0, 8).forEach((e) => { w[e.id] = e.weight * 1.1; });
  return w;
});
await setze({ greeted: true, name: 'T', level: 'anfaenger', shift: schiebe, weights: steigt,
  log: await protokoll(0, 4, 2) });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(600);
const mitAufstieg = await page.evaluate(async () => {
  const store = await import('./js/store.js');
  return { level: store.getState().level, customs: store.customs().map((c) => c.name) };
});
check(mitAufstieg.level !== 'anfaenger', `beim Start kam ein Aufstieg (${mitAufstieg.level})`);
check(mitAufstieg.customs.some((c) => /Zusatztag Woche 1/.test(c)),
  `und der fällige Zusatztag steht trotzdem schon beim selben Start da (${mitAufstieg.customs.join(', ') || 'nichts'})`);

/* ------------------------------------------------------------------ *
 * Angelegt am Tag der letzten Einheit, gemacht am Tag danach
 *
 * Der Normalfall, und genau der fehlte: Der Zusatztag entsteht beim Abschluss
 * der letzten Einheit der Woche, also an deren eigenem Tag. Dort zählte sie
 * als „anstehend" und sperrte alle ihre Gruppen, auch die ausgelassenen – und
 * am Tag danach, wenn er gemacht wird, wurde er nicht neu gerechnet: Es fehlte
 * das gestern Ausgelassene, dafür standen Gruppen der Einheit von morgen drin.
 *
 * Gestellt wird der Folgetag, indem alle Termine einen Tag nach hinten rücken
 * (startedOn und shift −1) – für die App dasselbe wie eine Uhr, die einen Tag
 * weiter ist, und der angelegte Zusatztag bleibt dabei liegen.
 * ------------------------------------------------------------------ */
const amTagAufbau = await page.evaluate(async () => {
  const { PLAN } = await import('./js/data.js');
  const { addDays, daysBetween, todayISO } = await import('./js/dates.js');
  const shift = daysBetween(PLAN[3].date, todayISO());          // W4 heute
  const log = {};
  PLAN.slice(0, 4).forEach((w) => {
    const e = { mode: 'db', done: 'db', soll: {}, db: {}, bw: {},
                startedOn: addDays(w.date, shift) };
    w.ex.forEach((it, k) => {
      e.soll[it.id] = it.sets;
      // Je Einheit die letzten zwei Übungen ausgelassen.
      e.db[it.id] = Array.from({ length: it.sets },
        () => ({ w: '20', done: k < w.ex.length - 2 }));
    });
    log[w.n] = e;
  });
  return { greeted: true, name: 'T', level: 'geuebt', mode: 'db', shift, log };
});
await setze(amTagAufbau);
// Ohne abgelegte Runden: Sonst trüge der Kalender weiter unten den heutigen
// Tag womöglich wegen einer früheren Runde und nicht wegen des Zusatztags.
await page.evaluate(() => localStorage.removeItem('workout.rounds.v1'));
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(600);

/** Der Zusatztag samt dem, woran er sich messen lassen muss. */
const zusatzPruefen = () => page.evaluate(async () => {
  const store = await import('./js/store.js');
  const daten = await import('./js/data.js');
  const { effDate, saetzeErledigt } = await import('./js/plan.js');
  const { daysBetween, todayISO } = await import('./js/dates.js');
  const byId = new Map(daten.EXERCISES.map((e) => [e.id, e]));
  const direktVon = (id) => Object.entries(byId.get(id).db.shares)
    .filter(([, sh]) => sh >= daten.REST.direct).map(([m]) => m);
  const heute = todayISO();
  const c = store.customs().find((x) => x.name === 'Zusatztag Woche 1');
  const zusatz = new Set(c ? c.ex.flatMap((x) => direktVon(x.id)) : []);
  const w4 = daten.PLAN[3];
  const trainiertW4 = new Set(w4.ex.filter((it) => saetzeErledigt(4, it.id, it.sets) > 0)
    .flatMap((it) => direktVon(it.id)));
  // Am Tag von W4 ausgelassen und dort sonst nicht trainiert.
  const freiW4 = [...new Set(w4.ex.slice(-2).flatMap((it) => direktVon(it.id)))]
    .filter((m) => !trainiertW4.has(m));
  // Kollisionen mit Einheiten in Reichweite: angefasste nach Trainiertem,
  // anstehende mit allem.
  const treffer = [];
  daten.PLAN.forEach((w) => {
    const d = effDate(w);
    if (Math.abs(daysBetween(d, heute)) >= daten.REST.days) return;
    const angefasst = store.isStarted(w.n);
    if (!angefasst && d < heute) return;
    w.ex.filter((it) => !angefasst || saetzeErledigt(w.n, it.id, it.sets) > 0)
      .flatMap((it) => direktVon(it.id))
      .forEach((m) => { if (zusatz.has(m)) treffer.push(`${m}@W${w.n}`); });
  });
  return { id: c && c.id, ex: c ? c.ex.map((x) => x.id) : [], freiW4,
           freiImZusatz: freiW4.filter((m) => zusatz.has(m)), treffer: [...new Set(treffer)] };
});
const amTag = await zusatzPruefen();
console.log('     am Tag von Workout 4:', JSON.stringify(amTag));
check(amTag.id, 'beim Abschluss der Woche entsteht der Zusatztag');
check(amTag.freiW4.length > 0, `Workout 4 hat heute Ausgelassenes (${amTag.freiW4.join(', ')})`);
check(amTag.freiImZusatz.length > 0,
  `auch die heute abgeschlossene Einheit sperrt nur, was trainiert ist – Ausgelassenes steht im Zusatztag (${
    amTag.freiImZusatz.join(', ') || 'nichts'})`);
check(amTag.treffer.length === 0, `keine Kollision am Tag selbst (${amTag.treffer.join(', ') || 'keine'})`);

// Ein Tag später – der Tag, an dem er gemacht wird.
const gespeichert = await page.evaluate(() => JSON.parse(localStorage.getItem('workout.state.v1')));
const folgetag = await page.evaluate(async (z) => {
  const { addDays } = await import('./js/dates.js');
  const s = JSON.parse(JSON.stringify(z));
  s.shift -= 1;
  Object.values(s.log).forEach((e) => { if (e && e.startedOn) e.startedOn = addDays(e.startedOn, -1); });
  return s;
}, gespeichert);
await setze(folgetag);
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(600);
const danach = await zusatzPruefen();
console.log('     am Tag danach:', JSON.stringify(danach));
check(danach.id === amTag.id, 'am Tag danach ist es derselbe Zusatztag – der Name bleibt');
check(danach.treffer.length === 0,
  `und er ist für diesen Tag gerechnet: keine Gruppe der Einheit von morgen (${danach.treffer.join(', ') || 'keine'})`);
// Gegenprobe: Was rechnet die App heute frisch, ohne den alten?
await setze({ ...folgetag, customs: [] });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(600);
const frisch = await zusatzPruefen();
check(frisch.ex.join() === danach.ex.join(),
  `er ist derselbe, den die App heute frisch anlegen würde (${danach.ex.join(', ')} | frisch: ${frisch.ex.join(', ')})`);

/* ------------------------------------------------------------------ *
 * Ein gemachter Zusatztag zählt
 *
 * In der Wochenbilanz, im Hinweis darunter und im Kalender. Vorher standen nach
 * 9 von 9 Sätzen in der Statistik genau die Lücken, die er schließen sollte,
 * darunter „Für diese Woche steht schon ein Zusatztag bereit … Öffnen", und
 * der Kalender war an dem Tag leer.
 * ------------------------------------------------------------------ */
const bilanz = async () => {
  await page.locator('.tab[data-tab="stats"]').click();
  await page.waitForTimeout(400);
  return page.evaluate(() => {
    const host = document.getElementById('volWeek');
    const zahl = (t) => Number(String(t).replace(',', '.'));
    const zeilen = {};
    host.querySelectorAll('.vol-row').forEach((r) => {
      const [got, soll] = r.querySelector('.vol-num').textContent.split('/');
      zeilen[r.querySelector('.vol-name').textContent.trim()] = { got: zahl(got), soll: zahl(soll) };
    });
    return { kopf: host.querySelector('.lbl').textContent.trim(), zeilen,
             bereit: /steht\s+schon ein Zusatztag bereit/.test(host.textContent) };
  });
};
const vorher = await bilanz();
console.log('     Woche vorher:', vorher.kopf, JSON.stringify(vorher.zeilen));
check(/Woche 1/.test(vorher.kopf), `die Bilanz zeigt Woche 1 (${vorher.kopf})`);
check(vorher.bereit, 'solange er unberührt ist, steht der Hinweis auf den bereiten Zusatztag da');

// Alle Sätze des Zusatztags abhaken – so, wie die App es beim Antippen tut.
await page.evaluate(async () => {
  const store = await import('./js/store.js');
  const c = store.customs().find((x) => x.name === 'Zusatztag Woche 1');
  c.ex.forEach((it) => {
    for (let i = 0; i < it.sets; i++) store.updateSet(c.id, 'db', it.id, it.sets, i, { done: true, w: '10' });
  });
});
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(500);
const nachher = await bilanz();
console.log('     Woche nachher:', JSON.stringify(nachher.zeilen));
const gestiegen = Object.keys(nachher.zeilen)
  .filter((g) => nachher.zeilen[g].got > (vorher.zeilen[g] || { got: 0 }).got + 1e-9);
check(gestiegen.length > 0, `der Zusatztag zählt in der Woche, für die er da ist (${gestiegen.join(', ') || 'keine Gruppe'})`);
// Doppelt zählt nichts: Was schon im Ziel stand, bleibt, wo es war, und keine
// Gruppe wächst über ihr Pensum hinaus, weil der Zusatztag dazukam.
const ueber = Object.keys(nachher.zeilen).filter((g) => {
  const v = vorher.zeilen[g] || { got: 0 };
  return nachher.zeilen[g].got > Math.max(v.got, nachher.zeilen[g].soll) + 0.05;
});
check(ueber.length === 0,
  `er schließt nur, was noch offen war – nichts zweimal, nichts über das Pensum (${ueber.join(', ') || 'alles im Rahmen'})`);
check(!nachher.bereit, 'und der Hinweis „steht schon ein Zusatztag bereit" ist weg');

// Und der Kalender kennt den Tag.
await page.locator('.tab[data-tab="settings"]').click();
await page.waitForTimeout(250);
await page.locator('[data-act="go-tab"][data-tab="calendar"]').first().click();
await page.waitForTimeout(400);
const heuteKachel = await page.locator('.cal-cell.today').first().getAttribute('class');
console.log('     Kalender heute:', heuteKachel);
check(/\bdone\b/.test(heuteKachel || '') && /\beigen\b/.test(heuteKachel || ''), `der Kalender markiert den Tag des Zusatztags als trainiert (${heuteKachel})`);
await page.locator('.cal-cell.today').first().click();
await page.waitForTimeout(300);
const detail = (await page.locator('.cal-detail').allTextContents()).join(' ').replace(/\s+/g, ' ');
check(/Zusatztag Woche 1/.test(detail), 'und nennt ihn beim Antippen');

check(errs.length === 0, `keine Fehler${errs.length ? ': ' + errs.slice(0, 2).join(' | ') : ''}`);
console.log(`\n${fails ? fails + ' FEHLER' : 'alle Prüfungen bestanden'}`);
await browser.close();

