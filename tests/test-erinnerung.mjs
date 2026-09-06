/*
 * Erinnerung am Trainingstag.
 *
 * Der Kalenderweg schied aus: Der Plan rückt nach, wenn ein Termin verstreicht,
 * exportierte Termine stehen danach an falschen Tagen, und wer oft aussetzt,
 * exportiert und löscht dauernd. Was bleibt, muss dem Plan von selbst folgen.
 *
 * **Was dieser Test NICHT prüfen kann, und das ist wichtig:** ob der Browser den
 * Service Worker jemals weckt. `periodicsync` lässt sich von außen nicht
 * auslösen; ob Chrome es tut, entscheidet Chrome nach Nutzung und Laune. Diese
 * Hälfte ist hier grundsätzlich unprüfbar – deshalb behauptet die App sie auch
 * nicht, sondern schreibt jeden Weckruf mit Zeitstempel auf und zeigt ihn unter
 * Mehr. Geprüft wird hier die andere Hälfte: die Entscheidung, *wann* erinnert
 * werden soll, und dass der Merkzettel für den Worker richtig gefüllt wird.
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

const setze = (z) => page.evaluate((o) => {
  localStorage.removeItem('workout.rounds.v1');
  localStorage.setItem('workout.state.v1', JSON.stringify(o));
}, z);

await page.goto(URL, { waitUntil: 'networkidle' });

// --- 1. Die Uhrzeiten ---------------------------------------------------
const zeiten = await page.evaluate(async () => {
  const { minuten, istWochenende, zeitpunkt } = await import('./js/erinnerung.js');
  const stunde = (ms) => { const d = new Date(ms); return `${d.getHours()}:${d.getMinutes()}`; };
  return {
    gut: minuten('16:00'),
    mitternacht: minuten('00:00'),
    quatsch: [minuten(''), minuten('25:00'), minuten('16:70'), minuten('abends')],
    // 2026-09-05 ist ein Samstag, 2026-09-07 ein Montag.
    samstag: istWochenende(new Date(2026, 8, 5)),
    montag: istWochenende(new Date(2026, 8, 7)),
    amSamstag: stunde(zeitpunkt('2026-09-05', { werktags: '16:00', wochenende: '06:30' })),
    amMontag: stunde(zeitpunkt('2026-09-07', { werktags: '16:00', wochenende: '06:30' })),
  };
});
check(zeiten.gut === 960, `"16:00" sind 960 Minuten (${zeiten.gut})`);
check(zeiten.mitternacht === 0, 'und Mitternacht ist 0 – nicht "falsch"');
check(zeiten.quatsch.every((x) => x === null),
  `Unsinn gibt null statt einer Zahl (${JSON.stringify(zeiten.quatsch)})`);
check(zeiten.samstag === true && zeiten.montag === false, 'Samstag ist Wochenende, Montag nicht');
check(zeiten.amSamstag === '6:30', `am Samstag gilt die Wochenendzeit (${zeiten.amSamstag})`);
check(zeiten.amMontag === '16:0', `am Montag die Werktagszeit (${zeiten.amMontag})`);

// --- 2. Der Termin folgt dem Plan --------------------------------------
// Kein einziger Eintrag: Die erste Einheit ist fällig, und weil der Plan
// verpasste Tage nachrückt, liegt sie auf heute.
await setze({ greeted: true, name: 'T', level: 'geuebt', shift: 0, log: {},
  erinnerung: { an: true, werktags: '16:00', wochenende: '06:30' } });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(400);

const stand = await page.evaluate(async () => {
  const { erinnerungsStand } = await import('./js/erinnerung.js');
  const s = erinnerungsStand({ werktags: '16:00', wochenende: '06:30' });
  const heute = new Date(); heute.setHours(0, 0, 0, 0);
  return s && { tag: s.tag, titel: s.titel, nummer: s.nummer,
                heute: s.tag === new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
                  .toISOString().slice(0, 10) };
});
console.log('     fällig:', JSON.stringify(stand));
check(!!stand, 'es gibt einen fälligen Termin');
check(stand.heute === true, `und er liegt auf heute (${stand.tag})`);
check(/^Workout \d+ von \d+$/.test(stand.titel), `der Titel nennt die Einheit (${stand.titel})`);

// --- 3. Der Merkzettel für den Service Worker ---------------------------
// Das ist das Einzige, was der Worker später zu sehen bekommt. Steht hier
// Falsches, erinnert er zur falschen Zeit oder gar nicht.
const zettel = await page.evaluate(async () => {
  const { liesMerkzettel } = await import('./js/merkzettel.js');
  return liesMerkzettel();
});
console.log('     Merkzettel:', JSON.stringify(zettel));
check(zettel.an === true, 'die Erinnerung steht als eingeschaltet drin');
check(typeof zettel.zeigenAb === 'number' && zettel.zeigenAb > 0,
  `mit einem Zeitpunkt (${zettel.zeigenAb})`);
const sollAb = new Date(zettel.zeigenAb);
check(sollAb.getHours() === 16 && sollAb.getMinutes() === 0
  || sollAb.getHours() === 6 && sollAb.getMinutes() === 30,
  `und der ist eine der beiden eingestellten Zeiten (${sollAb.getHours()}:${sollAb.getMinutes()})`);
check(zettel.titel === stand.titel, 'der Titel steht mit drin, damit der Worker nichts rechnen muss');

// --- 4. Abgeschaltet heißt abgeschaltet ---------------------------------
await setze({ greeted: true, name: 'T', level: 'geuebt', shift: 0, log: {},
  erinnerung: { an: false, werktags: '16:00', wochenende: '06:30' } });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(400);
const aus = await page.evaluate(async () =>
  (await import('./js/merkzettel.js')).liesMerkzettel());
check(aus.an === false, 'ausgeschaltet steht auch so im Merkzettel');

// --- 5. Alles erledigt, nichts zu erinnern ------------------------------
// Der ganze Plan durch: Dann gibt es keinen nächsten Termin, und der Worker
// darf niemanden mehr wecken.
await page.evaluate(async () => {
  const store = await import('./js/store.js');
  const { PLAN } = await import('./js/data.js');
  store.setSetting('erinnerung', { an: true, werktags: '16:00', wochenende: '06:30' });
  PLAN.forEach((w) => store.completeWorkout(w.n, 'db', w.ex.map((x) => ({ id: x.id, sets: x.sets }))));
});
await page.waitForTimeout(500);
const fertig = await page.evaluate(async () => {
  const { erinnerungsStand } = await import('./js/erinnerung.js');
  const { liesMerkzettel } = await import('./js/merkzettel.js');
  return { stand: erinnerungsStand({ werktags: '16:00', wochenende: '06:30' }),
           zettel: await liesMerkzettel() };
});
check(fertig.stand === null, 'ist der Plan durch, steht kein Termin mehr an');
check(fertig.zettel.an === false && fertig.zettel.zeigenAb === 0,
  'und der Merkzettel ist entschärft – der Worker weckt niemanden mehr');

// --- 6. Die Bedienung sagt die Wahrheit ---------------------------------
await page.locator('.tab[data-tab="settings"]').click();
await page.waitForTimeout(400);
const text = (await page.locator('#view').textContent()).replace(/\s+/g, ' ');
check(/Erinnerung am Trainingstag/.test(text), 'die Einstellung steht unter Mehr');
// Der Punkt dieser Prüfung ist nicht der Wortlaut, sondern dass die
// Unsicherheit überhaupt dasteht: Ohne Push hängt die Erinnerung daran, ob der
// Browser von sich aus aufwacht. Eine Oberfläche, die das verschweigt,
// verspricht etwas, das sie nicht halten kann.
check(/das entscheidet er|entscheidet er selbst/.test(text),
  'und sagt dazu, dass der Browser über den Zeitpunkt entscheidet');
check(/zuletzt geklappt|zuletzt geweckt|Noch nie geweckt/.test(text),
  'und zeigt, wann es zuletzt wirklich geklappt hat – statt es zu behaupten');

check(errs.length === 0, `keine Fehler${errs.length ? ': ' + errs.slice(0, 2).join(' | ') : ''}`);
console.log(`\n${fails ? fails + ' FEHLER' : 'alle Prüfungen bestanden'}`);
await browser.close();
