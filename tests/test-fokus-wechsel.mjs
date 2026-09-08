/*
 * Der Wechsel des Trainingsfokus nimmt nichts weg.
 *
 * *„Hab auf cut gewechselt und anscheinend hat er damit vergessen dass ich
 * gestern und vorgestern trainiert hab. Die Übergänge von cut zu Aufbau usw
 * müssen natürlich flüssig sein."* – und, einen Blick auf die Statistik später:
 * *„Auch Statistik und so ist jetzt ja alles weg."*
 *
 * Weg war nichts: Der Verlauf lag in der Ablage. Er wurde nur nirgends mehr
 * gezeigt, und zurückholen ließ er sich einzig über einen Knopf unter Mehr, den
 * man kennen muss. Vier Dinge müssen deshalb stimmen:
 *
 *   1. Zurückwechseln stellt den Verlauf des alten Fokus wieder her – von
 *      selbst, samt der Verschiebung, mit der der Plan dort stand.
 *   2. Die Statistik zählt weiter: Sätze, Kilo, Zeit, Trainingstage.
 *   3. Der Kalender zeigt die trainierten Tage weiter an, auch wenn ihr Plan
 *      gerade gar nicht geladen ist.
 *   4. Der neue Fokus fängt nicht heute an, wenn gestern trainiert wurde. Der
 *      übliche Abstand gilt auch über einen Wechsel hinweg.
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

const heute = () => new Date().toISOString().slice(0, 10);
const vorTagen = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);

/**
 * Zwei trainierte Tage im Aufbauplan: vorgestern und gestern, mit echten
 * Übungs-IDs aus dem geladenen Plan. `startedOn` ist dabei die Angabe, um die
 * es geht – daran hängen Kalender und Trainingstage.
 */
const zweiTage = () => page.evaluate(async ([vorgestern, gestern]) => {
  const { PLAN } = await import('./js/data.js');
  const log = {};
  [vorgestern, gestern].forEach((tag, i) => {
    const w = PLAN[i];
    const eintrag = { mode: 'db', done: 'db', startedOn: tag, secs: 2400, db: {} };
    w.ex.forEach((item) => {
      eintrag.db[item.id] = Array.from({ length: item.sets }, () => ({ w: '20', done: true }));
    });
    log[w.n] = eintrag;
  });
  return log;
}, [vorTagen(2), vorTagen(1)]);

const setze = (zustand) => page.evaluate((z) => {
  localStorage.removeItem('workout.rounds.v1');
  localStorage.setItem('workout.state.v1', JSON.stringify(z));
}, zustand);

/** Was die App über sich sagt – Zustand plus die Zahlen der Statistik. */
const lies = () => page.evaluate(async () => {
  const store = await import('./js/store.js');
  const { lebenStats } = await import('./js/bilanz.js');
  const s = store.getState();
  const l = lebenStats();
  return {
    focus: s.focus,
    shift: s.shift,
    imLog: Object.keys(s.log || {}).length,
    runden: (s.rounds || []).length,
    saetze: l.saetze,
    volumen: l.volumen,
    sekunden: l.sekunden,
    tage: [...l.tage].sort(),
    einheiten: l.einheiten,
    uebungen: l.perEx.size,
  };
});

const fokusWechsel = async (key) => {
  await page.evaluate(async ([k]) => {
    const store = await import('./js/store.js');
    store.setSetting('tab', 'settings');
  }, [key]);
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator(`.fokus-btn[data-v="${key}"]`).click();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(300);
};

await page.goto(URL, { waitUntil: 'networkidle' });

// --- 0. Ausgangslage: zwei Tage im Aufbauplan --------------------------
const log = await zweiTage();
await setze({ greeted: true, name: 'T', level: 'geuebt', focus: 'standard', tab: 'settings',
  shift: 0, log });
await page.reload({ waitUntil: 'networkidle' });
const start = await lies();
console.log('     Start:', JSON.stringify({ focus: start.focus, saetze: start.saetze,
  tage: start.tage, shift: start.shift }));
check(start.focus === 'standard', 'Ausgangslage: Aufbauplan');
check(start.imLog === 2, `zwei Einheiten im Protokoll (${start.imLog})`);
check(start.saetze > 0, `Sätze stehen drin (${start.saetze})`);
check(start.tage.length === 2, `zwei Trainingstage (${start.tage.join(', ')})`);
check(start.tage[1] === vorTagen(1), 'der letzte war gestern');

// --- 1. Auf Cut wechseln: der Plan ist neu, die Zahlen bleiben ----------
await fokusWechsel('cut');
const cut = await lies();
console.log('     Nach dem Wechsel auf Cut:', JSON.stringify({ focus: cut.focus,
  imLog: cut.imLog, saetze: cut.saetze, tage: cut.tage, shift: cut.shift }));
check(cut.focus === 'cut', `gewechselt (${cut.focus})`);
check(cut.imLog === 0, `der Cut-Plan beginnt leer (${cut.imLog} Einheiten)`);
check(cut.runden === 1, `der Aufbau-Verlauf liegt zur Seite (${cut.runden})`);

// Genau das war die Beschwerde: Nach dem Wechsel stand hier überall die Null.
check(cut.saetze === start.saetze,
  `die Sätze zählen weiter (${cut.saetze} statt ${start.saetze})`);
check(cut.volumen === start.volumen, `die Kilo auch (${cut.volumen})`);
check(cut.sekunden === start.sekunden, `und die Zeit im Training (${cut.sekunden} s)`);
check(cut.uebungen === start.uebungen,
  `jede trainierte Übung ist noch gezählt (${cut.uebungen})`);
check(cut.tage.join() === start.tage.join(),
  `gestern und vorgestern stehen weiter als Trainingstage da (${cut.tage.join(', ')})`);
check(cut.einheiten === start.einheiten,
  `und die erledigten Einheiten (${cut.einheiten})`);

// --- 2. Der neue Plan beginnt nicht heute ------------------------------
//
// Alle Plandaten liegen in der Vergangenheit; mit shift 0 zöge catchUpPlan()
// Workout 1 sofort auf heute – der dritte Trainingstag in Folge, nur weil
// jemand den Fokus gewechselt hat.
const ersterTermin = await page.evaluate(async () => {
  const { PLAN } = await import('./js/data.js');
  const { effDate } = await import('./js/plan.js');
  return effDate(PLAN[0]);
});
console.log('     Workout 1 im Cut-Plan:', ersterTermin, '· heute:', heute());
check(ersterTermin > vorTagen(1),
  `Workout 1 liegt nach dem letzten Training (${ersterTermin})`);
check(ersterTermin >= heute(),
  'und nicht in der Vergangenheit – der übliche Abstand gilt über den Wechsel hinweg');

// --- 3. Der Kalender erinnert sich an die Tage -------------------------
await page.evaluate(async () => (await import('./js/store.js')).setSetting('tab', 'calendar'));
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(300);
const kalender = (await page.locator('#view').textContent()).replace(/\s+/g, ' ');
check(/früheren Plan/.test(kalender),
  'der Kalender weist die Tage aus einem früheren Plan aus');
const marken = await page.locator('.cal-cell.frueher').count();
check(marken === 2, `beide Tage sind markiert (${marken})`);

// Und antippen erklärt, was da war.
await page.locator('.cal-cell.frueher').first().click();
await page.waitForTimeout(200);
const detail = (await page.locator('.cal-detail').first().textContent()).replace(/\s+/g, ' ');
console.log('     Kalenderdetail:', detail.slice(0, 90).trim(), '…');
check(/Sätze/.test(detail) && /trainiert/.test(detail),
  'mit Modus und Zahl der Sätze');

// --- 4. Zurück auf Aufbau: der Verlauf ist wieder da -------------------
await fokusWechsel('standard');
const zurueck = await lies();
console.log('     Zurück auf Aufbau:', JSON.stringify({ focus: zurueck.focus,
  imLog: zurueck.imLog, runden: zurueck.runden, shift: zurueck.shift }));
check(zurueck.focus === 'standard', `zurückgewechselt (${zurueck.focus})`);
check(zurueck.imLog === 2,
  `der Aufbau-Verlauf steht wieder auf dem Plan (${zurueck.imLog} Einheiten)`);
check(zurueck.runden === 0, `und liegt nicht doppelt in der Ablage (${zurueck.runden})`);
check(zurueck.saetze === start.saetze,
  `nichts doppelt gezählt (${zurueck.saetze} statt ${start.saetze})`);
check(zurueck.tage.join() === start.tage.join(), 'die Trainingstage stimmen weiter');

// --- 5. Die Statistik zeigt es auch an ---------------------------------
await page.evaluate(async () => (await import('./js/store.js')).setSetting('tab', 'stats'));
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(400);
const stats = (await page.locator('#view').textContent()).replace(/\s+/g, ' ');
check(/Trainingstage/.test(stats), 'die Statistik nennt die Trainingstage');
check(new RegExp(`${start.saetze}`).test(stats), `und die Zahl der Sätze (${start.saetze})`);

// --- 6. Kein Fehler auf der Konsole ------------------------------------
check(errs.length === 0, `keine JS-Fehler (${errs.length})${errs.length ? ': ' + errs[0] : ''}`);

await browser.close();
console.log(fails ? `\n${fails} Prüfung(en) fehlgeschlagen` : '\nAlles grün');
