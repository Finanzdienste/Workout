/*
 * Der Stufenaufstieg zählt über abgeschlossene Runden hinweg.
 *
 * sammleStats() liest nur `state.log` – das Protokoll der laufenden Runde. Und
 * restartPlan() räumt genau das weg. Wer 55 von 60 nötigen Einheiten hatte und
 * den Trainingsfokus wechselte, fing damit wieder bei null an; der automatische
 * Fokus-Umzug hätte das sogar ungefragt getan. Die Erfahrung eines Menschen
 * hört aber nicht auf, weil er einen Plan gewechselt hat.
 *
 * Vier Dinge müssen dabei stimmen, und zwei davon sind Fälle, in denen *nicht*
 * mehr gezählt werden darf, als geleistet wurde:
 *
 *   1. Ablage plus laufende Runde ergibt die Summe.
 *   2. Nichts wird doppelt gezählt – auch nicht, wenn eine Runde zurückgeholt wird.
 *   3. Eine halb gemachte Einheit ist keine Einheit, auch nicht rückwirkend.
 *   4. Es steht sichtbar da. Sonst stuft die App bei 60 hoch, während im
 *      Statistik-Tab "4 von 84" steht, und das sieht aus wie ein Fehler.
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

/**
 * Ein Protokoll über `von` bis `bis` (Index in den Plan, `bis` exklusiv) aus dem
 * echten Plan – nicht aus erfundenen Übungs-IDs: Die Statistik zählt nur, was
 * die App auch kennt, und ein Test mit erfundenen IDs würde bei jeder
 * Planänderung still zu null Sätzen werden.
 *
 * `auslassen` lässt die letzten n Übungen jeder Einheit weg. Genau so sieht ein
 * abgebrochenes Training im Protokoll aus: Die angetippten Übungen stehen
 * vollständig abgehakt darin, die übrigen fehlen ganz.
 */
const protokoll = (von, bis, { modus = 'db', kg = 20, auslassen = 0, markiere = true } = {}) =>
  page.evaluate(async ([a, b, m, gewicht, weg, mark]) => {
    const { PLAN } = await import('./js/data.js');
    const log = {};
    PLAN.slice(a, b).forEach((w) => {
      const eintrag = mark ? { mode: m, done: m } : { mode: m };
      eintrag[m] = {};
      w.ex.slice(0, Math.max(1, w.ex.length - weg)).forEach((item) => {
        eintrag[m][item.id] = Array.from({ length: item.sets }, () => ({
          w: m === 'db' ? String(gewicht) : '', r: '', done: true,
        }));
      });
      log[w.n] = eintrag;
    });
    return log;
  }, [von, bis, modus, kg, auslassen, markiere]);

const setze = (zustand) => page.evaluate(
  (z) => localStorage.setItem('workout.state.v1', JSON.stringify(z)), zustand);

const lies = () => page.evaluate(async () => {
  const s = (await import('./js/store.js')).getState();
  return { level: s.level, aufstiege: s.aufstiege || [], aufstieg: s.aufstieg,
           runden: (s.rounds || []).length, log: Object.keys(s.log || {}).length };
});

await page.goto(URL, { waitUntil: 'networkidle' });

// Die Schwellen kommen aus der App, nicht aus dem Gedächtnis dieses Tests.
const SCHWELLE = { einheiten: 60, saetze: 700, tonnen: 30 };
console.log(`     Schwelle Anfänger → Geübt: ${SCHWELLE.einheiten} Einheiten, `
  + `${SCHWELLE.saetze} Sätze, ${SCHWELLE.tonnen} t`);

// --- 1. Getrennt zu wenig, zusammen genug ------------------------------
// 35 Einheiten in der Ablage, 35 in der laufenden Runde. Keine der beiden
// Zahlen reicht für sich; 70 reichen. Genau das war der Fehler.
const alteRunde = await protokoll(0, 35);
const laufend = await protokoll(0, 35);

await setze({ greeted: true, name: 'T', level: 'anfaenger', log: laufend });
await page.reload({ waitUntil: 'networkidle' });
let s = await lies();
check(s.level === 'anfaenger', `35 Einheiten allein stufen nicht hoch (${s.level})`);

await setze({ greeted: true, name: 'T', level: 'anfaenger', log: laufend,
  rounds: [{ finishedOn: '2026-01-01', log: alteRunde, focus: 'standard' }] });
await page.reload({ waitUntil: 'networkidle' });
s = await lies();
check(s.level === 'geuebt', `35 + 35 aus der Ablage stufen hoch (${s.level})`);
check(s.aufstiege.includes('geuebt'), 'und der Schritt ist vermerkt');

const hinweis = (await page.locator('.notice.aufstieg').first().textContent()).replace(/\s+/g, ' ');
console.log('     Hinweis:', hinweis.slice(0, 100).trim(), '…');
check(/Insgesamt 70 Einheiten/.test(hinweis),
  'der Hinweis nennt die Gesamtzahl, nicht die der laufenden Runde');
check(/über alle Runden/i.test(hinweis), 'und sagt dazu, dass die Ablage mitzählt');

// --- 2. Eine abgebrochene Einheit ist keine Einheit --------------------
// Der Grund, warum die Bilanz beim Ablegen entsteht und nicht beim Auswerten:
// Ein Protokoll speichert nur die *angetippten* Übungen. Wer vorzeitig
// aufhört, hinterlässt ein Log, in dem alles abgehakt ist – nur eben weniger.
//
// Es fehlt bewusst nur *eine* Übung je Einheit. Damit liegen die Sätze weit
// über ihrer Schwelle, und die Prüfung hängt allein an der Frage, ob eine
// unvollständige Einheit als Einheit zählt.
const angebrochen = await protokoll(0, 84, { auslassen: 1, markiere: false });
await setze({ greeted: true, name: 'T', level: 'anfaenger', log: {},
  rounds: [{ finishedOn: '2026-01-01', log: angebrochen, focus: 'standard' }] });
await page.reload({ waitUntil: 'networkidle' });
const abgebrochen = await page.evaluate(async () => {
  const s = (await import('./js/store.js')).getState();
  return { level: s.level, saetze: Object.values(s.rounds[0].log)
    .reduce((a, e) => a + Object.values(e.db || {}).reduce((b, arr) => b + arr.length, 0), 0) };
});
console.log(`     ${abgebrochen.saetze} Sätze in der Ablage – Schwelle ist ${SCHWELLE.saetze}`);
check(abgebrochen.saetze > SCHWELLE.saetze,
  'die Sätze allein reichen längst – es hängt wirklich an den Einheiten');
check(abgebrochen.level === 'anfaenger',
  `84 angebrochene Einheiten stufen nicht hoch (${abgebrochen.level})`);

// Dieselben Einheiten, aber vollständig: jetzt schon.
const ganze = await protokoll(0, 70, { markiere: false });
await setze({ greeted: true, name: 'T', level: 'anfaenger', log: {},
  rounds: [{ finishedOn: '2026-01-01', log: ganze, focus: 'standard' }] });
await page.reload({ waitUntil: 'networkidle' });
s = await lies();
check(s.level === 'geuebt', `70 vollständige stufen hoch (${s.level})`);

// --- 3. Der automatische Umzug darf die Geschichte nicht wegwerfen -----
//
// Der Fall, an dem die erste Fassung gescheitert ist, und er ist tückisch: Wer
// noch auf 'kurz' steht, bekommt von js/data.js beim Laden längst den
// Cut-Plan – FOKUS_ERSATZ wird beim Import aufgelöst. Das Protokoll ist aber
// nach den Einheiten des alten Plans abgelegt. Wer die Bilanz in diesem Moment
// über den geladenen Plan zieht, zählt einen Cut-Plan gegen ein
// Kurz-Protokoll: gemessen kamen dabei {0 Einheiten, 0 Sätze, 0 Volumen} für
// 96 tatsächlich trainierte Einheiten heraus – und weil eine einmal
// geschriebene Bilanz nicht mehr nachgerechnet wird, war das endgültig.
//
// Gebaut wird deshalb ein Protokoll mit den Einheitengrößen des ECHTEN alten
// Plans (96 Einheiten, 3–5 Übungen), nicht mit denen des heutigen.
const kurzLog = await page.evaluate(async () => {
  const { FOKUS_ERSATZ, EXERCISES } = await import('./js/data.js');
  const ids = EXERCISES.map((e) => e.id);
  const log = {};
  FOKUS_ERSATZ.kurz.uebungen.forEach((wieViele, i) => {
    const e = { mode: 'db', db: {} };
    for (let k = 0; k < wieViele; k++) {
      e.db[ids[(i * 7 + k) % ids.length]] = Array.from({ length: 3 },
        () => ({ w: '20', r: '', done: true }));
    }
    log[i + 1] = e;
  });
  return log;
});
check(Object.keys(kurzLog).length === 96,
  `das alte 'kurz' hatte 96 Einheiten, die kennt die App noch (${Object.keys(kurzLog).length})`);

await setze({ greeted: true, name: 'T', level: 'anfaenger', focus: 'kurz', log: kurzLog });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(400);
const nachUmzug = await page.evaluate(async () => {
  const store = await import('./js/store.js');
  const daten = await import('./js/data.js');
  const st = store.getState();
  return { level: st.level, focus: st.focus, plan: daten.FOCUS.name,
           bilanz: (st.rounds[0] || {}).bilanz };
});
console.log('     Bilanz nach dem Umzug:', JSON.stringify(nachUmzug.bilanz));
check(nachUmzug.plan === 'Cut' && nachUmzug.focus === 'cut',
  `umgezogen auf Cut (${nachUmzug.plan})`);
check(nachUmzug.bilanz && nachUmzug.bilanz.einheiten === 96,
  `alle 96 Einheiten sind erhalten (${nachUmzug.bilanz && nachUmzug.bilanz.einheiten})`);
check(nachUmzug.bilanz && nachUmzug.bilanz.saetze > SCHWELLE.saetze,
  `und ihre Sätze auch (${nachUmzug.bilanz && nachUmzug.bilanz.saetze})`);
check(nachUmzug.level === 'geuebt',
  `der Umzug kostet den fälligen Aufstieg nicht (${nachUmzug.level})`);

// Dieselbe Runde, aber angebrochen: dann zählt sie auch hier nicht.
const kurzHalb = await page.evaluate(async () => {
  const { FOKUS_ERSATZ, EXERCISES } = await import('./js/data.js');
  const ids = EXERCISES.map((e) => e.id);
  const log = {};
  FOKUS_ERSATZ.kurz.uebungen.forEach((wieViele, i) => {
    const e = { mode: 'db', db: {} };
    for (let k = 0; k < wieViele - 1; k++) {
      e.db[ids[(i * 7 + k) % ids.length]] = Array.from({ length: 3 },
        () => ({ w: '20', r: '', done: true }));
    }
    log[i + 1] = e;
  });
  return log;
});
await setze({ greeted: true, name: 'T', level: 'anfaenger', focus: 'cut', log: {},
  rounds: [{ finishedOn: '2026-01-01', log: kurzHalb, focus: 'kurz' }] });
await page.reload({ waitUntil: 'networkidle' });
s = await lies();
check(s.level === 'anfaenger',
  `auch beim alten Plan zählt eine angebrochene Einheit nicht (${s.level})`);

// --- 4. Nichts wird doppelt gezählt ------------------------------------
// 40 in der Ablage, 40 laufend, aus demselben Fokus: zusammen 80. Holt man die
// Runde zurück, sind es immer noch 80 – nicht 120.
const zaehle = () => page.evaluate(async () => {
  const store = await import('./js/store.js');
  const s = store.getState();
  return { runden: (s.rounds || []).length, imLog: Object.keys(s.log || {}).length };
});

const a40 = await protokoll(0, 40);
const b40 = await protokoll(40, 80);
await setze({ greeted: true, name: 'T', level: 'geuebt', log: b40,
  rounds: [{ finishedOn: '2026-01-01', log: a40, focus: 'standard' }] });
await page.reload({ waitUntil: 'networkidle' });
const vorher = await zaehle();
check(vorher.runden === 1 && vorher.imLog === 40,
  `Ausgangslage: eine Runde in der Ablage, 40 Einheiten laufend (${JSON.stringify(vorher)})`);

await page.evaluate(async () => (await import('./js/store.js')).restoreRound());
await page.waitForTimeout(200);
const nachher = await zaehle();
check(nachher.runden === 0,
  `zurückgeholt: die Runde ist aus der Ablage verschwunden (${nachher.runden})`);
check(nachher.imLog === 80,
  `und steht vollständig im Protokoll (${nachher.imLog} statt ${vorher.imLog})`);

// --- 5. Der Fokuswechsel wirft nicht mehr zurück -----------------------
// Der Fall, um den es eigentlich geht: kurz vor der Schwelle den Plan wechseln.
await setze({ greeted: true, name: 'T', level: 'anfaenger', focus: 'standard',
  log: await protokoll(0, 58) });
await page.reload({ waitUntil: 'networkidle' });
s = await lies();
check(s.level === 'anfaenger', `58 Einheiten: knapp unter der Schwelle (${s.level})`);

await page.locator('.tab[data-tab="settings"]').click();
await page.waitForTimeout(300);
await page.locator('[data-act="set-focus"][data-v="bbp"]').click();
await page.waitForTimeout(1500);
const nachWechsel = await page.evaluate(async () => {
  const store = await import('./js/store.js');
  const s = store.getState();
  const r = (s.rounds || [])[0];
  return { focus: s.focus, imLog: Object.keys(s.log || {}).length,
           bilanz: r && r.bilanz, rundenFokus: r && r.focus };
});
check(nachWechsel.focus === 'bbp', `gewechselt auf bbp (${nachWechsel.focus})`);
check(nachWechsel.imLog === 0, 'der neue Plan startet leer');
check(!!nachWechsel.bilanz, 'die abgelegte Runde trägt ihre Bilanz');
check(nachWechsel.bilanz && nachWechsel.bilanz.einheiten === 58,
  `und zwar die richtige (${nachWechsel.bilanz && nachWechsel.bilanz.einheiten} Einheiten)`);
console.log('     Bilanz:', JSON.stringify(nachWechsel.bilanz));

// Zwei weitere Einheiten im neuen Plan – zusammen 60, also die Schwelle.
await page.evaluate(async () => {
  const store = await import('./js/store.js');
  const { PLAN } = await import('./js/data.js');
  PLAN.slice(0, 2).forEach((w) => store.completeWorkout(w.n, 'db',
    w.ex.map((x) => ({ id: x.id, sets: x.sets, w: 20 }))));
});
await page.reload({ waitUntil: 'networkidle' });
s = await lies();
check(s.level === 'geuebt',
  `zwei Einheiten im neuen Plan schließen die Lücke zu 60 (${s.level})`);

// --- 6. Es steht sichtbar da -------------------------------------------
await page.locator('.tab[data-tab="stats"]').click();
await page.waitForTimeout(400);
const statsText = (await page.locator('#view').textContent()).replace(/\s+/g, ' ');
check(/Insgesamt trainiert/.test(statsText),
  'der Statistik-Tab zeigt eine Gesamtkarte, sobald es eine abgelegte Runde gibt');
check(/60/.test(statsText), 'mit der Gesamtzahl der Einheiten');
check(/Runde/.test(statsText), 'und dem Hinweis, dass die Ablage mitzählt');

// Ohne Ablage bleibt sie weg – zwei gleiche Zahlen nebeneinander erklären nichts.
await setze({ greeted: true, name: 'T', level: 'geuebt', log: await protokoll(0, 5) });
await page.reload({ waitUntil: 'networkidle' });
await page.locator('.tab[data-tab="stats"]').click();
await page.waitForTimeout(400);
const ohneAblage = (await page.locator('#view').textContent()).replace(/\s+/g, ' ');
check(!/Insgesamt trainiert/.test(ohneAblage),
  'in der ersten Runde steht sie nicht da');

// --- 7. Eine kaputte Sicherung darf nicht jeden hochstufen --------------
//
// importJSON() prüft an `rounds` nur, dass es ein Array ist (js/store.js). Eine
// Sicherungsdatei kommt aber von irgendwoher. Stünde dort eine Bilanz mit
// {einheiten: "viele"}, ergäbe die Summe NaN – und **NaN < 60 ist false**.
// Damit fiele nicht eine Schwelle durch, sondern alle drei auf einmal: Eine
// kaputte Datei hätte nicht die Rechnung gestört, sondern sofort hochgestuft.
await setze({ greeted: true, name: 'T', level: 'anfaenger', log: {},
  rounds: [
    { finishedOn: '2026-01-01', log: {}, focus: 'standard',
      bilanz: { einheiten: 'viele', saetze: null, volumen: undefined } },
    null,
    'kaputt',
    { finishedOn: '2026-01-02' },
  ] });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(400);
s = await lies();
check(s.level === 'anfaenger', `Unsinn in der Ablage stuft niemanden hoch (${s.level})`);
check(await page.locator('[data-act="start-session"]').count() > 0,
  'und die App läuft weiter, statt leer zu bleiben');
check(errs.length === 0, `ohne Fehler in der Konsole${errs.length ? ': ' + errs.join(' | ') : ''}`);

// --- 8. Eine Wahl von Hand bleibt eine Wahl -----------------------------
// Seit über alles Trainierte gerechnet wird, sind die Schwellen für jemanden
// mit Vorgeschichte längst überschritten. Wer sich nach einer langen Pause
// bewusst zurückstellt, stünde beim nächsten Laden sonst wieder oben.
await setze({ greeted: true, name: 'T', level: 'geuebt', log: {},
  rounds: [{ finishedOn: '2026-01-01', log: ganze, focus: 'standard' }] });
await page.reload({ waitUntil: 'networkidle' });
await page.locator('.tab[data-tab="settings"]').click();
await page.waitForTimeout(300);
await page.locator('[data-act="set-level"][data-v="anfaenger"]').first().click();
await page.waitForTimeout(300);
s = await lies();
check(s.level === 'anfaenger', `von Hand auf Anfänger zurückgestellt (${s.level})`);
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(400);
s = await lies();
check(s.level === 'anfaenger',
  `und das hält auch nach dem Neuladen (${s.level})`);

check(errs.length === 0, `keine Fehler${errs.length ? ': ' + errs.join(' | ') : ''}`);
console.log(`\n${fails ? fails + ' FEHLER' : 'alle Prüfungen bestanden'}`);
await browser.close();
