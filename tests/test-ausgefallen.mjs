/*
 * Ausgefallene Trainings im Kalender – aus dem Protokoll gerechnet.
 *
 *     „Im Kalender ist aktuell nichts unter ausgefallen obwohl ich mehrere
 *      Trainings hab ausfallen lassen"
 *
 * Tobi, Dienstag 13.10.2026, Cut mit Hanteln, trainiert grob Do/Sa/Mo/Di.
 * Workout 9 am Do 08.10. (unvollständig, von Hand abgeschlossen), am Sa 10.
 * und am Mo 12. nichts. Der Kalender zeigte am 10. und 12. gar nichts, W10
 * „heute · geplant" und in der Zeile kein einziges „ausgefallen": catchUpPlan()
 * schiebt den Restplan jeden Tag auf heute, eine Einheit liegt deshalb nie
 * unbegonnen in der Vergangenheit, und dayState() kommt nie zu 'miss'.
 *
 * Jetzt rechnet ausfallTage() in js/plan.js die Tage aus dem Protokoll: Ein
 * Trainingstag im Rhythmus des Plans, an dem nicht trainiert und bis zum
 * nächsten Trainingstag nicht nachgeholt wurde. Geprüft an Tobis echtem Stand
 * (tests/zusatz-tobi-do.json plus W9 am Do):
 *
 *   A1   heute Di: genau Sa 10. und Mo 12. ausgefallen, je Workout 10, die
 *        Zeile „2 Tage ausgefallen", das Detail sagt, wohin die Einheit rückte.
 *   A2   täglich geöffnet (Fr bis Di): dasselbe Ergebnis wie „nicht geöffnet",
 *        am So noch nichts (Fenster offen), am Mo nur der Sa.
 *   A3   W10 einen Tag später (So) nachgeholt: verschoben, nicht ausgefallen.
 *   A4   Zusatztag (eigene Einheit) am Sa: trainiert, nur Mo fällt aus.
 *   A5   Termine: Boxen am Sa ist kein Plantraining (Sa bleibt ausgefallen,
 *        trägt den Sport-Streifen); ein Turnier, das alles schont, macht den
 *        Sa frei.
 *   A6   W10 am Sa angefangen und liegen gelassen: am Mo fällt Workout 11 aus.
 *   A7   W10 und W11 beide am Mo: nur der Sa ist ausgefallen, „am Mo trainiert".
 *   A8   Fokuswechsel nach einer Lücke von einem Tag: Workout 1 liegt dort, wo
 *        die App es hinlegte (So 20., Di 22.), nicht am Sa 19. / Mo 21.
 *   A9   Lange Pause: 11 Tage, der offene Rhythmus-Tag und heute nie.
 *   A10  Über Mitternacht offen, ohne Sichtwechsel: zwei Tage, nicht drei;
 *        die Zeile zählt genau die gestrichelten Kacheln (auch Sa → So).
 *   A11  Zeitzone: Di 00:30 in Berlin ist Di, der Mo ist ausgefallen.
 *   A12  Die Serie bleibt, was sie war (Einheiten, nicht Tage).
 *
 * Gegenprobe: gegen 9b3a4b4 (v239) sind 35 von 68 Prüfungen rot, genau die
 * mit ★; die übrigen 33 (Nachrücken, Ruhetage, Serie, keine Fehler) bleiben
 * grün. Einzeln zurückgedreht wird je eine Stelle rot (AUSFALL_NUR=A2,A3 lässt
 * nur diese Abschnitte laufen): die Fensterregel (A2-So, A3), die Wechselregel
 * für Workout 1 nach einem Fokuswechsel (A8: Sa 19. / Mo 21.), „frei" bei
 * Terminen (A5b) und die Vereinigung mit dayState() in der Monatszählung – als
 * Summe gerechnet „3 Tage" (A10), nur aus der Rechnung eine Kachel ohne Zahl
 * (A10b).
 */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { URL, ROOT, SHOT } from './umgebung.mjs';

const VORLAGE = JSON.parse(readFileSync(path.join(ROOT, 'tests', 'zusatz-tobi-do.json'), 'utf8'));
const kopie = (o) => JSON.parse(JSON.stringify(o));
const gleich = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const DI = '2026-10-13T15:00:00+02:00';

const browser = await chromium.launch();
let fails = 0;
const check = (c, m) => { console.log(`${c ? 'OK  ' : 'FAIL'} ${m}`); if (!c) { fails++; process.exitCode = 1; } };

/** Eine Einheit im Protokoll: je Übung `k` von 3 Sätzen abgehakt. */
function einheit(tag, saetze, done = 'db', mode = 'db') {
  const e = { mode, soll: {}, nach: {}, db: {}, bw: {}, startedOn: tag };
  if (done) e.done = done;
  Object.entries(saetze).forEach(([id, k]) => {
    e.soll[id] = 3;
    e.nach[id] = 0;
    e[mode][id] = Array.from({ length: 3 }, (_, i) => ({ w: i < k ? '20' : '', done: i < k }));
  });
  return e;
}
/** Eine ganz gemachte Einheit – für die Rechnung reicht, dass sie abgeschlossen ist. */
const ganz = (tag) => einheit(tag, { 'goblet-squat': 3, 'chin-ups': 3 });

/** Tobis Stand: W1–W8 aus der Vorlage, W9 am Do 08.10. unvollständig und abgeschlossen. */
function tobi() {
  const z = kopie(VORLAGE);
  z.log[9] = einheit('2026-10-08', {
    'rumaenisches-kreuzheben': 3, 'floor-press': 3, 'fersenerhoehter-goblet-squat': 3,
    'haengendes-knieheben': 2, 'reverse-fly': 1,
  });
  z.session = null;
  z.clock = null;
  z.tab = 'calendar';
  return z;
}

/**
 * Ein Fall in eigenem Kontext: Zustand und Ablage vor dem ersten Laden gesät
 * (durch eine Marke im sessionStorage gegen ein zweites Säen geschützt), Uhr
 * fest auf `wann`, Zeitzone Berlin.
 */
const offen = new Set();
async function fall(name, zustand, wann = DI, runden = null) {
  const ctx = await browser.newContext({
    viewport: { width: 414, height: 896 }, timezoneId: 'Europe/Berlin', serviceWorkers: 'block',
  });
  await ctx.route('**/rest/v1/**', (r) => r.fulfill({ status: 204, body: '' }));
  offen.add(ctx);
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(`PAGEERROR: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errs.push(`CONSOLE: ${m.text()}`); });
  page.on('dialog', (d) => d.accept().catch(() => {}));
  await page.clock.setFixedTime(new Date(wann));
  await page.addInitScript(() => { navigator.vibrate = () => true; });
  await page.addInitScript(([s, r]) => {
    if (sessionStorage.getItem('saat-ausfall')) return;
    sessionStorage.setItem('saat-ausfall', '1');
    localStorage.setItem('workout.state.v1', JSON.stringify(s));
    if (r) localStorage.setItem('workout.rounds.v1', JSON.stringify(r));
    else localStorage.removeItem('workout.rounds.v1');
  }, [zustand, runden]);
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(250);
  const f = {
    name, ctx, page, errs,
    /** Zum Kalender, falls die App nicht schon dort steht. */
    kalender: async () => {
      if (await page.locator('.cal-grid').count()) return;
      await page.locator('.tab[data-tab="settings"]').click();
      await page.waitForTimeout(150);
      await page.locator('[data-act="go-tab"][data-tab="calendar"]').click();
      await page.waitForTimeout(250);
    },
    neuLaden: async () => {
      await page.reload({ waitUntil: 'networkidle' });
      await page.waitForTimeout(300);
      await f.kalender();
    },
    uhr: (iso) => page.clock.setFixedTime(new Date(iso)),
    /** Bildschirmfoto wie am Gerät: oben das Raster, oder `sel` mittig im Bild (die Leiste unten steht fest). */
    bild: async (datei, sel) => {
      await page.evaluate((x) => {
        const e = x && document.querySelector(x);
        if (e) e.scrollIntoView({ block: 'center' }); else window.scrollTo(0, 0);
      }, sel || null);
      await page.waitForTimeout(150);
      await page.screenshot({ path: path.join(SHOT, datei) });
    },
    /** Tageszahlen der ausgefallenen Kacheln im gezeigten Monat. */
    miss: () => page.evaluate(() => [...document.querySelectorAll('.cal-grid:not(.cal-head) .cal-cell.miss:not(.out)')]
      .map((e) => Number(e.querySelector('.cal-num').textContent))),
    /** Klassen der Kachel mit Tageszahl `d` im gezeigten Monat. */
    kachel: (d) => page.evaluate((t) => {
      const e = [...document.querySelectorAll('.cal-grid:not(.cal-head) .cal-cell:not(.out)')]
        .find((x) => x.querySelector('.cal-num').textContent === String(t));
      return e ? [...e.classList].filter((k) => k !== 'cal-cell') : null;
    }, d),
    label: (d) => page.evaluate((t) => {
      const e = [...document.querySelectorAll('.cal-grid:not(.cal-head) .cal-cell:not(.out)')]
        .find((x) => x.querySelector('.cal-num').textContent === String(t));
      return e ? `${e.getAttribute('aria-label') || ''} | ${e.textContent.replace(/\s+/g, ' ').trim()}` : '';
    }, d),
    zeile: async () => ((await page.locator('.cal-legend + .small').first().textContent().catch(() => '')) || '')
      .replace(/\s+/g, ' ').trim(),
    /** Einen Tag antippen – nur, wenn er ein Knopf ist. Gibt das Detail zurück. */
    tippe: async (iso) => {
      const k = page.locator(`button.cal-cell[data-iso="${iso}"]`);
      if (!(await k.count())) return '';
      await k.first().click();
      await page.waitForTimeout(250);
      return (await page.locator('.cal-detail').allTextContents()).map((t) => t.replace(/\s+/g, ' ').trim()).join(' | ');
    },
    /** Rechnen mit den Modulen der App – dieselben Instanzen, die die Seite benutzt. */
    M: (fn, arg) => page.evaluate(async ([src, a]) => {
      const m = {
        P: await import('./js/plan.js'), store: await import('./js/store.js'), D: await import('./js/data.js'),
        dates: await import('./js/dates.js'),
      };
      return (0, eval)(`(${src})`)(m, a);
    }, [fn.toString(), arg]),
  };
  await f.kalender();
  return f;
}
async function ende(f) {
  check(f.errs.length === 0, `${f.name}: keine Fehler${f.errs.length ? ` – ${f.errs.slice(0, 2).join(' | ')}` : ''}`);
  offen.delete(f.ctx);
  await f.ctx.close();
}

/**
 * Ein Abschnitt für sich: Bricht er ab, ist das ein FAIL, und die übrigen
 * laufen trotzdem. AUSFALL_NUR=A3,A8 lässt nur diese laufen – für die
 * Gegenproben an einzelnen zurückgedrehten Stellen.
 */
const nur = (process.env.AUSFALL_NUR || '').split(',').filter(Boolean);
async function abschnitt(name, fn) {
  if (nur.length && !nur.includes(name)) return;
  try {
    await fn();
  } catch (e) {
    check(false, `${name} abgebrochen: ${String(e.message || e).split('\n')[0]}`);
    for (const ctx of offen) await ctx.close().catch(() => {});
    offen.clear();
  }
}

/* ------------------------------------------------------------------ *
 * A1 Tobi heute, A12 Serie – plus Bildschirmfotos
 * ------------------------------------------------------------------ */
await abschnitt('A1', async () => {
  const f = await fall('A1', tobi());
  const miss = await f.miss();
  const zeile = await f.zeile();
  console.log(`     ausgefallen: ${miss.join(', ') || '–'} · ${zeile}`);
  check(gleich(miss, [10, 12]), `★ A1: Sa 10. und Mo 12. ausgefallen, sonst keiner (${miss.join(', ') || 'keiner'})`);
  const k13 = await f.kachel(13);
  check(k13 && k13.includes('today') && k13.includes('plan'), `A1: heute (13.) bleibt „geplant" (${k13})`);
  check(!miss.includes(9) && !miss.includes(11) && !miss.includes(13),
    'A1: die Ruhetage 9. und 11. und heute sind nicht ausgefallen');
  check(/2 Tage ausgefallen/.test(zeile), `★ A1: die Zeile nennt „2 Tage ausgefallen" (${zeile})`);
  check(/16 Einheiten in diesem Monat · 5 trainiert/.test(zeile) && /11 offen/.test(zeile),
    'A1: Einheiten, trainiert und offen zählen wie bisher');
  const label = await f.label(10);
  check(/Workout 10 ausgefallen/.test(label), `★ A1: vorgelesen „Workout 10 ausgefallen" (${label})`);

  await f.bild('ausgefallen-raster-414x896.png');
  const d10 = await f.tippe('2026-10-10');
  console.log(`     Detail 10.: ${d10.slice(0, 220)}`);
  check(/Workout 10 · ausgefallen/.test(d10), '★ A1: Tipp auf den 10.: „Workout 10 · ausgefallen"');
  check(/nach dem Training am Do, 08\.10\./.test(d10), '★ A1: … im Rhythmus nach dem Training am Do, 08.10.');
  check(/Workout 10 rückte nach hinten und ist jetzt für heute geplant/.test(d10),
    '★ A1: … rückte nach hinten und ist jetzt für heute geplant');
  check(!/verpasst|versäumt|leider/i.test(d10), 'A1: sachlich, ohne Vorwurf');
  check(await f.page.locator('.cal-detail [data-act="cal-open"][data-n="10"]').count() === 1,
    '★ A1: der Knopf führt zu Workout 10');
  await f.bild('ausgefallen-detail-414x896.png', '.cal-detail');
  const d12 = await f.tippe('2026-10-12');
  check(/Workout 10 · ausgefallen/.test(d12), `★ A1: Tipp auf den 12.: wieder Workout 10 (${d12.slice(0, 60)})`);

  if (await f.page.locator('.cal-detail [data-act="cal-open"]').count()) {
    await f.page.locator('.cal-detail [data-act="cal-open"]').first().click();
    await f.page.waitForTimeout(300);
    const dash = (await f.page.locator('#view').textContent()).replace(/\s+/g, ' ');
    check(await f.page.locator('.tab[aria-selected="true"]').getAttribute('data-tab') === 'dashboard'
      && /Workout 10\b/.test(dash), 'A1: „Zu dieser Einheit" öffnet Workout 10 im Dashboard');
  } else {
    check(false, '★ A1: kein Knopf im Detail des 12.');
  }

  // Die Funktion selbst – nur, wenn es sie gibt.
  const r = await f.M(({ P, dates }) => (typeof P.ausfallTage === 'function'
    ? [...P.ausfallTage(dates.todayISO()).entries()] : null));
  check(Array.isArray(r), '★ A1: ausfallTage() steht in js/plan.js');
  if (Array.isArray(r)) {
    check(gleich(r.map(([k]) => k), ['2026-10-10', '2026-10-12']), `A1: Schlüssel ${r.map(([k]) => k).join(', ')}`);
    check(r.every(([, x]) => x.n === 10 && x.aktuell === true && x.seit === '2026-10-08' && x.spaeter === null),
      `A1: je { n: 10, aktuell, seit 08.10., noch offen } (${JSON.stringify(r[0] && r[0][1])})`);
  }

  // A12: Die Serie zählt Einheiten, nicht Tage – Ausfälle brechen sie nicht.
  const serie = await f.M(({ P }) => P.sammleStats().streak);
  check(serie === 9, `A12: Serie unverändert 9 (${serie})`);

  // Schmal: dasselbe auf 360×740, ohne Überlauf.
  await f.page.setViewportSize({ width: 360, height: 740 });
  await f.kalender();
  const gewaehlt = f.page.locator('button.cal-cell.sel');
  if (await gewaehlt.count()) {
    await gewaehlt.first().click();
    await f.page.waitForTimeout(200);
  }
  await f.bild('ausgefallen-raster-360x740.png');
  await f.tippe('2026-10-10');
  await f.bild('ausgefallen-detail-360x740.png', '.cal-detail');
  const ueber = await f.page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check(ueber === 0, `A1: 360 px ohne Überlauf (${ueber}px)`);
  await ende(f);
});

/* ------------------------------------------------------------------ *
 * A2 Täglich geöffnet – Fr bis Di, jedes Mal neu geladen
 * ------------------------------------------------------------------ */
await abschnitt('A2', async () => {
  const f = await fall('A2', tobi(), '2026-10-09T15:00:00+02:00');
  const shifts = [];
  const proTag = {};
  for (const [tag, iso] of [['Fr', '09'], ['Sa', '10'], ['So', '11'], ['Mo', '12'], ['Di', '13']]) {
    if (tag !== 'Fr') {
      await f.uhr(`2026-10-${iso}T15:00:00+02:00`);
      await f.neuLaden();
    }
    shifts.push(await f.M(({ store }) => store.getState().shift));
    proTag[tag] = await f.miss();
  }
  console.log(`     shift ${shifts.join(' → ')} · ${Object.entries(proTag).map(([t, m]) => `${t}: ${m.join('+') || '–'}`).join(' · ')}`);
  check(gleich(shifts, [31, 31, 32, 33, 34]), `A2: Nachrücken wie bisher (shift ${shifts.join(', ')})`);
  check(!proTag.Fr.length && !proTag.Sa.length, 'A2: Fr und Sa nichts ausgefallen');
  check(!proTag.So.length, `A2-So: am So noch nichts – der Sa lässt sich bis Mo nachholen (${proTag.So.join(', ') || 'keiner'})`);
  check(gleich(proTag.Mo, [10]), `★ A2: am Mo der Sa (${proTag.Mo.join(', ') || 'keiner'})`);
  check(gleich(proTag.Di, [10, 12]), `★ A2: am Di Sa und Mo – wie ohne tägliches Öffnen (${proTag.Di.join(', ') || 'keiner'})`);
  await ende(f);
});

/* ------------------------------------------------------------------ *
 * A3 Verschoben: W10 am So statt am Sa
 * ------------------------------------------------------------------ */
await abschnitt('A3', async () => {
  const z = tobi();
  z.log[10] = ganz('2026-10-11');
  const f = await fall('A3', z, '2026-10-16T15:00:00+02:00');
  const miss = await f.miss();
  console.log(`     ausgefallen: ${miss.join(', ') || '–'} · ${await f.zeile()}`);
  check(!miss.includes(10), 'A3: W10 einen Tag später nachgeholt – der Sa ist verschoben, nicht ausgefallen');
  check(gleich(miss, [13, 14]), `★ A3: danach Di 13. und Mi 14. (Workout 11) ausgefallen (${miss.join(', ') || 'keiner'})`);
  const d = await f.tippe('2026-10-13');
  check(/Workout 11 · ausgefallen/.test(d) && /nach dem Training am So, 11\.10\./.test(d),
    `★ A3: Detail Workout 11, nach dem Training am So (${d.slice(0, 120)})`);
  await ende(f);
});

/* ------------------------------------------------------------------ *
 * A4 Zusatztag am Sa – eigene Einheit trainiert
 * ------------------------------------------------------------------ */
await abschnitt('A4', async () => {
  const z = tobi();
  z.log.cmuxsf5c0 = einheit('2026-10-10', { 'pull-ups': 3 }, null);
  const f = await fall('A4', z);
  const miss = await f.miss();
  const k10 = await f.kachel(10);
  console.log(`     ausgefallen: ${miss.join(', ') || '–'} · Sa: ${k10}`);
  check(k10 && k10.includes('eigen') && k10.includes('done') && !k10.includes('miss'),
    `A4: Sa mit Zusatztag ist trainiert (${k10})`);
  check(gleich(miss, [12]), `★ A4: nur Mo 12. ausgefallen (${miss.join(', ') || 'keiner'})`);
  await ende(f);
});

/* ------------------------------------------------------------------ *
 * A5 Termine: Sport ist kein Plantraining; „alles schonen" macht frei
 * ------------------------------------------------------------------ */
await abschnitt('A5', async () => {
  const z = tobi();
  z.termine = [{ datum: '2026-10-10', name: 'Boxen', aktivitaet: 'boxen', minuten: 90 }];
  const f = await fall('A5a', z);
  const k10 = await f.kachel(10);
  console.log(`     Sa: ${k10} · ${await f.zeile()}`);
  check(k10 && k10.includes('miss') && k10.includes('akt'), `★ A5a: Sa mit Boxen ausgefallen und mit Sport-Streifen (${k10})`);
  const d = await f.tippe('2026-10-10');
  const iBox = d.indexOf('Boxen');
  const iAus = d.indexOf('Workout 10 · ausgefallen');
  check(iBox >= 0 && iAus > iBox, `★ A5a: Detail erst Boxen, dann Workout 10 · ausgefallen (${iBox}/${iAus})`);
  check(/Boxen/.test(await f.label(10)), 'A5a: vorgelesen mit Boxen');
  await ende(f);
});
await abschnitt('A5b', async () => {
  const z = tobi();
  z.termine = [{ datum: '2026-10-10', name: 'Turnier', schont: 'alles' }];
  const f = await fall('A5b', z);
  const miss = await f.miss();
  const zeile = await f.zeile();
  console.log(`     ausgefallen: ${miss.join(', ') || '–'} · ${zeile}`);
  check(!miss.includes(10), 'A5b: Turnier schont alles – am Sa gab es nichts zu trainieren');
  check(gleich(miss, [12]), `★ A5b: nur Mo 12. ausgefallen (${miss.join(', ') || 'keiner'})`);
  check(/· 1 Tag ausgefallen/.test(zeile), `★ A5b: „1 Tag ausgefallen" (${zeile})`);
  await ende(f);
});

/* ------------------------------------------------------------------ *
 * A6 W10 am Sa angefangen, liegen gelassen
 * ------------------------------------------------------------------ */
await abschnitt('A6', async () => {
  const z = tobi();
  z.log[10] = einheit('2026-10-10', { 'goblet-squat': 1 }, null);
  const f = await fall('A6', z);
  const miss = await f.miss();
  const k10 = await f.kachel(10);
  console.log(`     ausgefallen: ${miss.join(', ') || '–'} · Sa: ${k10}`);
  check(k10 && k10.includes('part'), `A6: Sa bleibt angefangen (${k10})`);
  check(gleich(miss, [12]), `★ A6: Mo 12. ausgefallen (${miss.join(', ') || 'keiner'})`);
  const d = await f.tippe('2026-10-12');
  check(/Workout 11 · ausgefallen/.test(d), `★ A6: fällig war Workout 11 (${d.slice(0, 80)})`);
  await ende(f);
});

/* ------------------------------------------------------------------ *
 * A7 Zwei Einheiten an einem Tag nachgeholt
 * ------------------------------------------------------------------ */
await abschnitt('A7', async () => {
  const z = tobi();
  z.log[10] = ganz('2026-10-12');
  z.log[11] = ganz('2026-10-12');
  const f = await fall('A7', z);
  const miss = await f.miss();
  const zeile = await f.zeile();
  console.log(`     ausgefallen: ${miss.join(', ') || '–'} · ${zeile}`);
  check(gleich(miss, [10]), `★ A7: nur der Sa ausgefallen (${miss.join(', ') || 'keiner'})`);
  const k12 = await f.kachel(12);
  check(k12 && k12.includes('done') && /\(\+1\)/.test(await f.label(12)), `A7: Mo trainiert, „(+1)" (${k12})`);
  check(/· 1 Tag ausgefallen/.test(zeile), `★ A7: „1 Tag ausgefallen" (${zeile})`);
  const d = await f.tippe('2026-10-10');
  check(/Workout 10 rückte nach hinten und wurde am Mo, 12\.10\. trainiert/.test(d),
    `★ A7: „… wurde am Mo, 12.10. trainiert" (${d.slice(0, 160)})`);
  check(/Im Dashboard ansehen/.test(d), '★ A7: trainierte Einheit – „Im Dashboard ansehen"');
  await ende(f);
});

/* ------------------------------------------------------------------ *
 * A8 Fokuswechsel: Aufbau bis Fr 18.09., Wechsel Sa 19.09., Cut
 * ------------------------------------------------------------------ */
await abschnitt('A8', async () => {
  const runde = [{ focus: 'standard', finishedOn: '2026-09-19', shift: 18,
    log: { 1: ganz('2026-09-14'), 2: ganz('2026-09-16'), 3: ganz('2026-09-18') } }];
  const z = tobi();
  z.log = {};
  z.shift = 27;
  z.customs = [];
  const f = await fall('A8', z, '2026-09-24T15:00:00+02:00', runde);
  const miss = await f.miss();
  console.log(`     ausgefallen: ${miss.join(', ') || '–'} · ${await f.zeile()}`);
  check(gleich(miss, [20, 22]), `★ A8: im Cut nichts – So 20. und Di 22. ausgefallen, nicht Sa 19. / Mo 21. (${miss.join(', ') || 'keiner'})`);
  const d = await f.tippe('2026-09-20');
  check(/Workout 1 · ausgefallen/.test(d) && /nach dem Training am Fr, 18\.09\./.test(d),
    `★ A8: fällig war Workout 1 (${d.slice(0, 120)})`);
  await ende(f);

  const z2 = tobi();
  z2.log = { 1: ganz('2026-09-20'), 2: ganz('2026-09-22') };
  z2.shift = 27;
  z2.customs = [];
  const g = await fall('A8-gegen', z2, '2026-09-24T15:00:00+02:00', runde);
  const miss2 = await g.miss();
  check(!miss2.length, `A8: Cut W1 am So und W2 am Di trainiert – kein Ausfall am Übergang (${miss2.join(', ') || 'keiner'})`);
  await ende(g);
});

/* ------------------------------------------------------------------ *
 * A9 Lange Pause bis Fr 30.10.
 * ------------------------------------------------------------------ */
await abschnitt('A9', async () => {
  const f = await fall('A9', tobi(), '2026-10-30T15:00:00+02:00');
  const miss = await f.miss();
  const zeile = await f.zeile();
  console.log(`     ausgefallen: ${miss.join(', ') || '–'} · ${zeile}`);
  check(/· 11 Tage ausgefallen/.test(zeile), `★ A9: „11 Tage ausgefallen" (${zeile})`);
  check(gleich(miss, [10, 12, 13, 15, 17, 19, 20, 22, 24, 26, 27]), `★ A9: die Trainingstage im Rhythmus (${miss.join(', ')})`);
  check(!miss.includes(29) && !miss.includes(30), 'A9: Do 29. (bis Sa nachholbar) und heute nicht');
  await ende(f);
});

/* ------------------------------------------------------------------ *
 * A10 Über Mitternacht offen, ohne Sichtwechsel
 * ------------------------------------------------------------------ */
await abschnitt('A10', async () => {
  const f = await fall('A10', tobi(), '2026-10-12T23:58:00+02:00');
  const vorher = await f.miss();
  await f.uhr('2026-10-13T00:05:00+02:00');
  await f.page.locator('[data-act="cal-month"][data-d="1"]').click();
  await f.page.locator('[data-act="cal-month"][data-d="-1"]').click();
  await f.page.waitForTimeout(200);
  const zeile = await f.zeile();
  const nachts = await f.miss();
  console.log(`     Mo 23:58: ${vorher.join(', ') || '–'} · Di 00:05: ${nachts.join(', ') || '–'} · ${zeile}`);
  check(gleich(vorher, [10]), `★ A10: Mo 23:58 nur der Sa (${vorher.join(', ') || 'keiner'})`);
  check(/· 2 Tage ausgefallen/.test(zeile), `★ A10: Di 00:05 „2 Tage ausgefallen" – nicht 1, nicht 3 (${zeile})`);
  await f.page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await f.page.waitForTimeout(300);
  const danach = await f.miss();
  const shift = await f.M(({ store }) => store.getState().shift);
  check(gleich(danach, [10, 12]) && shift === 34,
    `★ A10: nach dem Sichtwechsel nachgerückt (shift ${shift}), weiter Sa und Mo (${danach.join(', ') || 'keiner'})`);
  check(/· 2 Tage ausgefallen/.test(await f.zeile()), '★ A10: und weiter „2 Tage ausgefallen"');
  await ende(f);

  // Sa → So über Mitternacht: Bis catchUpPlan() läuft, steht W10 noch auf dem
  // Sa, und dayState() zeichnet ihn gestrichelt – nach dem Rhythmus ist der Sa
  // am So noch nachholbar. Was immer die Kacheln zeigen: Die Zeile zählt genau
  // die gestrichelten Tage, vor und nach dem Sichtwechsel.
  const g = await fall('A10b', tobi(), '2026-10-10T23:58:00+02:00');
  await g.uhr('2026-10-11T00:05:00+02:00');
  await g.page.locator('[data-act="cal-month"][data-d="1"]').click();
  await g.page.locator('[data-act="cal-month"][data-d="-1"]').click();
  await g.page.waitForTimeout(200);
  const zahl = (z) => Number((z.match(/· (\d+) Tage? ausgefallen/) || [0, 0])[1]);
  const nachtsSo = await g.miss();
  const zeileSo = await g.zeile();
  console.log(`     So 00:05: ${nachtsSo.join(', ') || '–'} · ${zeileSo}`);
  check(zahl(zeileSo) === nachtsSo.length,
    `★ A10b: So 00:05 – die Zeile zählt die gestrichelten Kacheln (${zahl(zeileSo)} / ${nachtsSo.length})`);
  await g.page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await g.page.waitForTimeout(300);
  const morgensSo = await g.miss();
  const zeileSo2 = await g.zeile();
  check(!morgensSo.length && zahl(zeileSo2) === 0,
    `A10b: nach dem Sichtwechsel am So nichts ausgefallen (${morgensSo.join(', ') || 'keiner'} · ${zeileSo2})`);
  await ende(g);
});

/* ------------------------------------------------------------------ *
 * A11 Zeitzone: Di 00:30 in Berlin, in UTC noch Mo
 * ------------------------------------------------------------------ */
await abschnitt('A11', async () => {
  const f = await fall('A11', tobi(), '2026-10-13T00:30:00+02:00');
  const miss = await f.miss();
  const k13 = await f.kachel(13);
  console.log(`     ausgefallen: ${miss.join(', ') || '–'} · 13.: ${k13}`);
  check(miss.includes(12), `★ A11: Di 00:30 Berlin – der Mo ist ausgefallen (${miss.join(', ') || 'keiner'})`);
  check(k13 && k13.includes('today') && !k13.includes('miss'), 'A11: heute ist der Di, nicht ausgefallen');
  await ende(f);
});

console.log(`\n${fails ? `${fails} FEHLER` : 'alle Prüfungen bestanden'}`);
await browser.close();
