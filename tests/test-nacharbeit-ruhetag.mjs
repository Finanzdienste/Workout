/*
 * Am Ruhetag sagt die Startansicht, wohin der Rückstand der Woche geht.
 *
 *     „Hab gestern nicht vollständig trainiert. Trotzdem soll ich heute
 *      nichts nachholen?"
 *
 * Tobi, Freitag 09.10.2026, Cut mit Hanteln, Supersätze an – ein planmäßiger
 * Ruhetag. Am Donnerstag blieb in Workout 9 etwas liegen. Das Dashboard
 * zeigte „Tobi · Morgen · Workout 10 / Sa, 10. Oktober 2026 / Hanteln · 5
 * Übungen · 15 + 2 Sätze" – und nirgends, dass der Rückstand schon verteilt
 * ist: auf die restlichen Einheiten derselben Woche (Nacharbeit, höchstens drei
 * je Einheit), und was dort nicht hineinpasst, nach der Woche (Zusatztag).
 * Jetzt steht im Kopf eine stille Zeile:
 *
 *     Heute frei. Was am Do liegen blieb, kommt dazu: morgen +2, Mo +1, Di +1,
 *     der Rest entfällt.
 *
 * Geprüft über die Oberfläche, von Tobis echtem Stand am Donnerstag aus
 * (tests/zusatz-tobi-do.json): Workout 9 wird abgehakt wie bei ihm –
 * Kreuzheben 2/3, Floor Press 2/3, Reverse Fly 1/3, der Rest samt den
 * eingefügten Chin-ups ganz –, dann wird die Woche Tag für Tag durchgespielt,
 * jede Einheit ganz gemacht, wie sie dasteht.
 *
 *   R1  Wortlaut und Stelle: im Kopf unter der Satzzahl, still – kein Knopf,
 *       keine Ansage, keine Karte; die Startansicht bleibt eine Seite
 *       (414×896, 360×740).
 *   R2  Was die Zeile am Freitag ankündigt, zeigen Sa, Mo und Di dann
 *       wirklich – Einheit für Einheit, gleiche Zahl. Am Sonntag (wieder frei)
 *       dieselbe Rechnung vom Tag aus. „der Rest entfällt" – und nach der
 *       Woche entsteht wirklich kein Zusatztag.
 *   R3  Viel liegen geblieben: „der Rest danach" (nicht „nach der Woche" –
 *       die Woche des Plans ist nicht die Kalenderwoche) – und nach der Woche
 *       ist der Zusatztag Woche 3 wirklich da. Am Mittwoch davor sagt die
 *       Zeile, was er am Donnerstag in Workout 13 bringt.
 *   R4  Ohne Hanteln dasselbe.
 *   R5  Termin am Folgetag (Padel am So): Sa und Mo verlieren Beinübungen, die
 *       Zeile rechnet mit dem, was dann dasteht.
 *   R6  Zusatz in der Einheit: Liegen gelassene Chin-ups (der Zusatz aus Woche
 *       2 in Workout 9) sind kein Rückstand – dieselbe Zeile wie in R1.
 *   R9  Zwei Tage mit Rückstand (Do und Sa): „Was am Do und Sa liegen blieb",
 *       und Mo und Di zeigen dann, was die Zeile am So ankündigt.
 *   R10 Der Zusatztag der Woche davor kommt erst in die zweite Einheit der
 *       neuen Woche: Am Ruhetag davor nennt die Zeile ihn („Aus Woche 3 kommt
 *       dazu: morgen +3"), auch ohne Rückstand in der neuen Woche, und der
 *       Samstag zeigt genau die Summe. Die Startansicht bleibt auch mit
 *       beiden Sätzen eine Seite (360×740).
 *   R11 Zwei verpasste Tage dehnen die Woche: Quell- und Zieltag mit demselben
 *       Kürzel – die Quelle bekommt ihr Datum („Do 8.10.").
 *   R12 Festgehaltene Nacharbeit an einer nicht angefangenen Einheit (ein Satz
 *       an- und wieder abgetippt): Die Zeile nennt, was der Kopf zeigt.
 *   R13 Weniger liegen geblieben, als einen Zusatztag trägt, und nicht alles
 *       passt hinein: „der Rest entfällt" – und es kommt auch keiner.
 *   R7  Ohne Rückstand keine Zeile.
 *   R8  Keine Zeile, wenn heute nicht frei ist: die fällige Einheit verpasst
 *       (der Plan rückt nach, am Fr und am So), heute schon trainiert – eine
 *       Planeinheit oder ein eigenes Workout –, eine andere Einheit
 *       angeblättert, die nächste per Start vorgezogen.
 *
 * Gegenprobe: Gegen 9b3a4b4 (ohne die Zeile) werden 27 von 117 Prüfungen rot –
 * R1 bis R6, R9 und die beiden Gegenstücke in R8d. R7 und der Rest von R8
 * prüfen, dass *keine* Zeile steht, und bleiben dort grün; sie halten die
 * Bedingung fest. Einzeln zurückgedreht wird jede Stelle rot: ohne den Abzug
 * zwischen den Einheiten sagt die Zeile „Mo +2", der Montag zeigt +1 (R2);
 * nur die nächste Einheit statt der Woche (R2); „der Rest danach" ohne die
 * Schwelle des Zusatztags (R2); ohne „heute schon trainiert" (R2, R8c), ohne
 * „die Einheit für heute" (R8d), ohne „liegt nach heute" (R2, R8b).
 *
 * Gegenprobe der zweiten Runde gegen 8bf9b37: 19 von 177 Prüfungen rot – R1
 * bis R3 (Wortlaut, „der Rest danach", der Mi vor dem Zusatztag), R6 und R8d
 * (Tobis Zeile), R8f, R10 bis R13. Einzeln zurückgedreht: ohne zusatzMorgen()
 * rot R3 und R10 (5), mit ruhendeGruppen() von heute statt vom Tag der
 * Einheit R10 (4), mit zusatzEinheitFuer() von heute R10 (4), ohne Datum am
 * Quelltag R11 (2), ohne die festgehaltene Nacharbeit in der Vorschau R12
 * (2), nur Planeinheiten als „heute trainiert" R8f (1), ohne „der Rest
 * entfällt" R1, R2, R13 (4), mit „der Rest nach der Woche" R3 (2).
 *
 * RUHETAG_NUR=R1,R3 lässt nur diese Abschnitte laufen.
 */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { URL, ROOT, SHOT } from './umgebung.mjs';

const VORLAGE = JSON.parse(readFileSync(path.join(ROOT, 'tests', 'zusatz-tobi-do.json'), 'utf8'));
const kopie = (o) => JSON.parse(JSON.stringify(o));
const TAG = {
  do: '2026-10-08T17:00:00+02:00',
  fr: '2026-10-09T10:00:00+02:00',
  sa: '2026-10-10T17:00:00+02:00',
  so: '2026-10-11T10:00:00+02:00',
  mo: '2026-10-12T17:00:00+02:00',
  di: '2026-10-13T17:00:00+02:00',
  mi: '2026-10-14T10:00:00+02:00',
  do2: '2026-10-15T10:00:00+02:00',
  fr2: '2026-10-16T10:00:00+02:00',
  sa2: '2026-10-17T10:00:00+02:00',
};
/** Workout 9 am Donnerstag wie bei Tobi – alles andere ganz. */
const TOBI_DO = { 'rumaenisches-kreuzheben': 2, 'floor-press': 2, 'reverse-fly': 1 };
/*
 * „der Rest entfällt": Der Face Pull am Montag holt einen der zwei liegen
 * gebliebenen Reverse-Fly-Sätze nach, den zweiten keine Einheit mehr (hintere
 * Schulter 1,0 und Hüftstrecker 0,7 bleiben offen, zu wenig für einen
 * Zusatztag).
 */
const ZEILE_TOBI = 'Heute frei. Was am Do liegen blieb, kommt dazu: morgen +2, Mo +1, Di +1, der Rest entfällt.';

const browser = await chromium.launch();
let fails = 0;
const check = (c, m) => { console.log(`${c ? 'OK  ' : 'FAIL'} ${m}`); if (!c) { fails++; process.exitCode = 1; } };

/** Ein Fall in eigenem Kontext: Zustand vor dem ersten Laden gesät, Uhr fest. */
async function fall(name, zustand, wann) {
  const ctx = await browser.newContext({
    viewport: { width: 414, height: 896 }, timezoneId: 'Europe/Berlin', serviceWorkers: 'block',
  });
  await ctx.route('**/rest/v1/**', (r) => r.fulfill({ status: 204, body: '' }));
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(`PAGEERROR: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errs.push(`CONSOLE: ${m.text()}`); });
  page.on('dialog', (d) => d.accept().catch(() => {}));
  await page.clock.setFixedTime(new Date(wann));
  offen.add(ctx);
  let saat = 0;
  await page.addInitScript(() => { navigator.vibrate = () => true; });
  const saeen = async (z) => {
    const marke = `saat-${++saat}`;
    await page.addInitScript(([s, mk]) => {
      if (sessionStorage.getItem(mk)) return;
      sessionStorage.setItem(mk, '1');
      localStorage.setItem('workout.state.v1', JSON.stringify(s));
      localStorage.removeItem('workout.rounds.v1');
    }, [z, marke]);
  };
  if (zustand) await saeen(zustand);
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(250);
  const f = {
    name, ctx, page, errs,
    txt: async (sel) => ((await page.locator(sel).first().textContent({ timeout: 1500 }).catch(() => '')) || '')
      .replace(/\s+/g, ' ').trim(),
    lies: () => page.evaluate(() => JSON.parse(localStorage.getItem('workout.state.v1') || '{}')),
    M: (fn, arg) => page.evaluate(async ([src, a]) => {
      const m = { P: await import('./js/plan.js'), store: await import('./js/store.js'), D: await import('./js/data.js') };
      return (0, eval)(`(${src})`)(m, a);
    }, [fn.toString(), arg]),
    klick: async (sel, warte = 250) => {
      await page.locator(sel).first().click({ timeout: 3000 });
      await page.waitForTimeout(warte);
    },
    /** Uhr stellen und neu laden – ein neuer Tag, die App geht neu auf. */
    tag: async (iso) => {
      await page.clock.setFixedTime(new Date(iso));
      await page.reload({ waitUntil: 'networkidle' });
      await page.waitForTimeout(300);
    },
  };
  return f;
}
async function ende(f) {
  check(f.errs.length === 0, `${f.name}: keine Fehler${f.errs.length ? ` – ${f.errs.slice(0, 2).join(' | ')}` : ''}`);
  offen.delete(f.ctx);
  await f.ctx.close();
}

const offen = new Set();
const nur = (process.env.RUHETAG_NUR || '').split(',').filter(Boolean);
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

/** Was im Kopf der Startansicht steht. */
async function kopf(f) {
  return {
    auge: await f.txt('.hero-eyebrow'),
    titel: await f.txt('.hero-title'),
    sub: await f.txt('.hero-sub'),
    frei: await f.txt('.ov-frei'),
    zeilen: await f.page.locator('.ov-frei').count(),
  };
}

/** Zur Einheit n blättern (Startansicht). */
async function zuEinheit(f, n) {
  for (const sel of ['[data-act="focus-list"]', '[data-act="hide-list"]']) {
    if (await f.page.locator(sel).count()) await f.klick(sel, 120);
  }
  for (let i = 0; i < 20; i++) {
    const jetzt = Number(((await f.txt('.hero-eyebrow')).match(/Workout (\d+)/) || [])[1] || 0);
    if (jetzt === n) return true;
    const knopf = f.page.locator(`[data-act="nav-workout"][data-delta="${jetzt < n ? 1 : -1}"]:not([disabled])`);
    if (!(await knopf.count())) return false;
    await knopf.first().click();
    await f.page.waitForTimeout(100);
  }
  return false;
}

/**
 * Einheit n über die Liste abhaken – je Übung so viele Sätze, wie `muster`
 * sagt, sonst alle, die dastehen (samt Nachholsätzen) – und abschließen.
 */
async function spiele(f, n, muster = {}) {
  check(await zuEinheit(f, n), `${f.name}: Workout ${n} ist zu erreichen`);
  await f.klick('[data-act="start-session"]', 300);
  if (await f.page.locator('[data-act="focus-list"]').count()) await f.klick('[data-act="focus-list"]', 200);
  const liste = await f.M(({ P }, k) => P.workoutByNo(k).ex.map((x) => x.id), n);
  for (const id of liste) {
    const soll = muster[id] ?? 99;
    for (let i = 0; i < soll; i++) {
      const l = f.page.locator(`[data-act="toggle-set"][data-ex="${id}"][aria-pressed="false"]`);
      if (!(await l.count())) break;
      await l.first().click();
      await f.page.waitForTimeout(90);
      if (await f.page.locator('[data-act="focus-list"]').count()) await f.klick('[data-act="focus-list"]', 100);
    }
  }
  if (await f.page.locator('[data-act="finish-session"]').count()) await f.klick('[data-act="finish-session"]', 300);
  return ((await f.lies()).log || {})[n] || {};
}

/** Nachholsätze der Einheit n, wie sie dasteht (Summe der `nach`). */
const nachVon = (f, n) => f.M(({ P }, k) => P.workoutByNo(k).ex.reduce((a, x) => a + (x.nach || 0), 0), n);
/** „15 + 2 Sätze" → 2. */
const plusImKopf = (sub) => Number((sub.match(/(\d+) \+ (\d+) Sätze/) || [])[2] || 0);

/**
 * Die Zeile zerlegt: Quelltage, Ziele („morgen +2, Mo +1"), was mit dem Rest
 * geschieht (`rest`: er kommt nach der Woche – „der Rest danach", „der Rest
 * nach Di", „kommt nach Di dazu"; `entfaellt`: „der Rest entfällt") und der
 * Zusatztag der Woche davor („Aus Woche 3 kommt dazu: morgen +3.").
 */
function zerlege(zeile) {
  const m = zeile.match(/^Heute frei\.(?: Was am (.+?) liegen blieb, kommt (?:dazu: (.+?)|nach (.+?) dazu)\.)?(?: Aus Woche (\d+) kommt dazu: morgen \+(\d+)\.)?$/);
  if (!m || (!m[1] && !m[4])) return null;
  const teile = (m[2] || '').split(', ').filter(Boolean);
  const restTeil = teile.find((t) => t.startsWith('der Rest ')) || '';
  return {
    quellen: m[1] || '',
    ziele: teile.filter((t) => !t.startsWith('der Rest ')).join(', '),
    rest: !!m[3] || /^der Rest (danach|nach )/.test(restTeil),
    entfaellt: restTeil === 'der Rest entfällt',
    zusatz: m[4] ? { woche: Number(m[4]), plus: Number(m[5]) } : null,
  };
}

/**
 * Die Woche durchspielen: Do Workout 9 nach `muster9`, dann Fr (frei), Sa
 * Workout 10, So (frei), Mo Workout 11, Di Workout 12, jede Einheit ganz,
 * Mi und Do danach. Festgehalten wird, was die Startansicht an jedem Tag
 * zeigt und wie viele Nachholsätze jede Einheit an ihrem Tag wirklich trägt.
 */
async function woche(name, zustand, muster9, { bis = 'do2' } = {}) {
  const f = await fall(name, zustand, TAG.do);
  const w9 = await spiele(f, 9, muster9);
  check(!!w9.done, `${name}: Workout 9 am Do abgeschlossen`);
  const r = { f };
  await f.tag(TAG.fr);
  r.fr = await kopf(f);
  r.fr10 = await nachVon(f, 10);
  await f.tag(TAG.sa);
  r.sa = await kopf(f);
  r.ist = [];
  r.ist.push({ n: 10, plus: await nachVon(f, 10), kopf: plusImKopf(r.sa.sub) });
  await spiele(f, 10);
  r.saDanach = await kopf(f);
  await f.tag(TAG.sa);
  r.saNeu = await kopf(f);
  await f.tag(TAG.so);
  r.so = await kopf(f);
  await f.tag(TAG.mo);
  r.mo = await kopf(f);
  r.ist.push({ n: 11, plus: await nachVon(f, 11), kopf: plusImKopf(r.mo.sub) });
  await spiele(f, 11);
  await f.tag(TAG.di);
  r.di = await kopf(f);
  r.ist.push({ n: 12, plus: await nachVon(f, 12), kopf: plusImKopf(r.di.sub) });
  await spiele(f, 12);
  if (bis === 'di') return r;
  await f.tag(TAG.mi);
  r.mi = await kopf(f);
  const traeger = (st) => (st.customs || []).some((c) => c.name === 'Zusatztag Woche 3');
  r.zusatzMi = traeger(await f.lies());
  await f.tag(TAG.do2);
  r.do2 = await kopf(f);
  const st = await f.lies();
  r.zusatzDo = traeger(st) || /Übungen/.test(r.do2.sub) && /\d+ \+ \d+ Übungen/.test(r.do2.sub);
  return r;
}

/** Was die Einheiten wirklich zeigen, als Zeile vom Freitag (bzw. Sonntag) aus. */
const alsZeile = (ist, tage) => ist.filter((x) => x.plus > 0 && tage[x.n]).map((x) => `${tage[x.n]} +${x.plus}`).join(', ');
const VOM_FR = { 10: 'morgen', 11: 'Mo', 12: 'Di' };
const VOM_SO = { 11: 'morgen', 12: 'Di' };

/** Die gemeinsamen Prüfungen einer durchgespielten Woche. */
function pruefeWoche(tag, r) {
  console.log(`     ${tag} Fr: ${r.fr.auge} | ${r.fr.sub} | ${r.fr.frei}`);
  console.log(`     ${tag} So: ${r.so.auge} | ${r.so.sub} | ${r.so.frei}`);
  console.log(`     ${tag} Einheiten: ${r.ist.map((x) => `W${x.n} +${x.plus} (Kopf +${x.kopf})`).join(', ')}`);
  check(/Morgen · Workout 10/.test(r.fr.auge), `${tag} Fr: „Morgen · Workout 10" („${r.fr.auge}")`);
  const z = zerlege(r.fr.frei);
  check(r.fr.zeilen === 1 && !!z, `${tag} Fr: eine Zeile „Heute frei. Was am … liegen blieb, kommt …" („${r.fr.frei}")`);
  const ist = alsZeile(r.ist, VOM_FR);
  check(!!z && z.ziele === ist, `${tag} was die Zeile am Fr ankündigt, zeigen Sa, Mo, Di wirklich („${z && z.ziele}" – gezeigt: „${ist}")`);
  check(r.ist.every((x) => x.plus === x.kopf || x.kopf === 0 && x.plus === 0),
    `${tag} und so steht es auch im Kopf der Einheiten (${r.ist.map((x) => `+${x.kopf}`).join(', ')})`);
  check(r.fr10 === r.ist[0].plus, `${tag} Workout 10 am Fr angesehen = am Sa (${r.fr10} / ${r.ist[0].plus})`);
  check(/Heute · Workout 10/.test(r.sa.auge) && r.sa.zeilen === 0, `${tag} Sa: Workout 10 ist fällig – keine Zeile („${r.sa.auge}")`);
  check(r.saDanach.zeilen === 0 && r.saNeu.zeilen === 0, `${tag} Sa nach dem Training: heute war Training – keine Zeile („${r.saNeu.auge}")`);
  check(/Morgen · Workout 11/.test(r.so.auge), `${tag} So: „Morgen · Workout 11" („${r.so.auge}")`);
  const istSo = alsZeile(r.ist, VOM_SO);
  const zSo = zerlege(r.so.frei);
  if (istSo) {
    check(!!zSo && zSo.ziele === istSo, `${tag} So: dieselbe Rechnung vom Sonntag aus („${r.so.frei}" – gezeigt: „${istSo}")`);
  } else {
    check(r.so.zeilen === 0 || (zSo && zSo.rest && !zSo.ziele),
      `${tag} So: nichts mehr für Mo und Di – keine Ziele in der Zeile („${r.so.frei}")`);
  }
  check(/Heute · Workout 11/.test(r.mo.auge) && r.mo.zeilen === 0, `${tag} Mo: keine Zeile, Workout 11 ist fällig`);
  check(/Heute · Workout 12/.test(r.di.auge) && r.di.zeilen === 0, `${tag} Di: keine Zeile, Workout 12 ist fällig`);
  return z;
}

/* ------------------------------------------------------------------ *
 * R1/R2 Tobis Woche
 * ------------------------------------------------------------------ */
let freitagsStand = null;
await abschnitt('R1', async () => {
  const f = await fall('R1', VORLAGE, TAG.do);
  await spiele(f, 9, TOBI_DO);
  await f.tag(TAG.fr);
  freitagsStand = await f.lies();
  const k = await kopf(f);
  console.log(`     ${k.auge} | ${k.titel} | ${k.sub}\n     ${k.frei}`);
  check(k.auge === 'Tobi · Morgen · Workout 10' && k.titel === 'Sa, 10. Oktober 2026'
    && k.sub === 'Hanteln · 5 Übungen · 15 + 2 Sätze', 'R1 Tobis Freitag: der Kopf wie auf seinem Bildschirm');
  check(k.frei === ZEILE_TOBI, `R1 die Zeile: „${ZEILE_TOBI}" („${k.frei}")`);
  const roh = await f.page.locator('.ov-frei').first().textContent().catch(() => '');
  check(/morgen\u00a0\+2, Mo\u00a0\+1, Di\u00a0\+1/.test(roh || ''),
    'R1 Tag und Zahl bleiben zusammen (festes Leerzeichen) – kein „morgen" am Zeilenende, „+2" darunter');
  const art = await f.page.evaluate(() => {
    const z = document.querySelector('.ov-frei');
    if (!z) return null;
    const sub = document.querySelector('.hero-sub');
    return {
      imKopf: !!z.closest('header.ov-top'),
      unterSub: !!sub && !!(sub.compareDocumentPosition(z) & 4),
      knopf: !!z.querySelector('button, a, [data-act]'),
      ansage: z.hasAttribute('role') || z.hasAttribute('aria-live') || !!z.closest('[role="alert"], [aria-live]'),
      karte: !!z.closest('.notice, .card'),
      zeilen: Math.round(z.getBoundingClientRect().height),
    };
  });
  console.log('     Zeile:', JSON.stringify(art));
  check(!!art && art.imKopf && art.unterSub, 'R1 die Zeile steht im Kopf, unter der Satzzahl');
  check(!!art && !art.knopf && !art.ansage && !art.karte, 'R1 still: kein Knopf, keine Ansage, keine Karte');
  check(await f.page.locator('.notice').count() === 0, 'R1 kein Hinweis-Kasten auf der Startansicht');
  for (const [b, h] of [[414, 896], [360, 740]]) {
    await f.page.setViewportSize({ width: b, height: h });
    await f.page.reload({ waitUntil: 'networkidle' });
    await f.page.waitForTimeout(300);
    const m = await f.page.evaluate(() => {
      const leiste = document.getElementById('tabbar').getBoundingClientRect();
      const start = document.querySelector('.btn-start').getBoundingClientRect();
      const fuss = document.querySelector('.ov-foot').getBoundingClientRect();
      const z = document.querySelector('.ov-frei');
      return {
        sichtbar: Math.min(window.innerHeight, leiste.height ? leiste.top : window.innerHeight),
        fussUnten: fuss.bottom, startUnten: start.bottom,
        koerper: document.getElementById('bodyMap').getBoundingClientRect().height,
        zeile: z ? Math.round(z.getBoundingClientRect().height) : 0,
        scroll: document.documentElement.scrollHeight - window.innerHeight,
        breit: document.documentElement.scrollWidth > window.innerWidth + 1,
      };
    });
    console.log(`     ${b}×${h}: Zeile ${m.zeile} px, Körper ${Math.round(m.koerper)} px, Fuß unten ${Math.round(m.fussUnten)}, sichtbar bis ${Math.round(m.sichtbar)}, Überhang ${m.scroll}`);
    check(m.scroll <= 0 && !m.breit && m.fussUnten <= m.sichtbar,
      `R1 ${b}×${h}: die Startansicht bleibt eine Seite, Start und Fuß über der Leiste`);
    check(m.zeile > 0 && m.zeile <= 40, `R1 ${b}×${h}: die Zeile hat höchstens zwei Zeilen (${m.zeile} px)`);
    await f.page.screenshot({ path: path.join(SHOT, `ruhetag-${b}x${h}.png`) });
  }
  await ende(f);
});

await abschnitt('R2', async () => {
  const r = await woche('R2', VORLAGE, TOBI_DO);
  const z = pruefeWoche('R2', r);
  check(r.fr.frei === ZEILE_TOBI, `R2 Fr: „${ZEILE_TOBI}"`);
  check(!!z && !z.rest && !r.zusatzMi && !r.zusatzDo,
    'R2 keine Rest-Ankündigung – und nach der Woche entsteht auch kein Zusatztag Woche 3');
  check(!!z && z.entfaellt && !!r.so.frei.endsWith(', der Rest entfällt.'),
    `R2 „der Rest entfällt" am Fr und am So – und es kommt wirklich nichts mehr („${r.so.frei}")`);
  check(/Morgen · Workout 13/.test(r.mi.auge) && r.mi.zeilen === 0,
    `R2 Mi: neue Woche, nichts offen – keine Zeile („${r.mi.auge}")`);
  await ende(r.f);
});

/* ------------------------------------------------------------------ *
 * R3 Viel liegen geblieben: der Rest nach der Woche
 * ------------------------------------------------------------------ */
await abschnitt('R3', async () => {
  const r = await woche('R3', VORLAGE, { 'rumaenisches-kreuzheben': 0, 'floor-press': 0,
    'fersenerhoehter-goblet-squat': 0, 'reverse-fly': 0 });
  const z = pruefeWoche('R3', r);
  console.log(`     R3 Mi: ${r.mi.auge} | ${r.mi.sub} | Träger ${r.zusatzMi}; Do: ${r.do2.auge} | ${r.do2.sub} | ${r.zusatzDo}`);
  check(!!z && z.rest && r.fr.frei.endsWith(', Di +3, der Rest danach.'), `R3 Fr: „… Di +3, der Rest danach." („${r.fr.frei}")`);
  // Die Woche des Plans geht von Do bis Di. „nach der Woche" hieß am Freitag
  // schon „ab Mo" und am Sonntag „ab morgen" – genau da, wo „+2" stand.
  check(![r.fr.frei, r.so.frei].some((t) => /Woche/.test(t)) && r.so.frei.endsWith(', der Rest danach.'),
    `R3 kein „nach der Woche" – am So „… der Rest danach." („${r.so.frei}")`);
  const getragen = r.ist.reduce((a, x) => a + x.plus, 0);
  check(getragen > 0 && getragen < 12,
    `R3 die restlichen Einheiten tragen ${getragen} der 12 liegen gebliebenen Sätze – der Rest passt nicht hinein`);
  check(r.zusatzMi || r.zusatzDo, 'R3 und nach der Woche ist der Zusatztag Woche 3 da');
  // Der Mittwoch ist frei, der Zusatztag kommt morgen in Workout 13: Die Zeile
  // sagt es, mit der Zahl, die der Donnerstag dann zeigt.
  const zMi = zerlege(r.mi.frei);
  check(/Heute · Workout 13/.test(r.do2.auge) && /^\w+ · 5 \+ \d+ Übungen/.test(r.do2.sub),
    `R3 Do: der Zusatztag steckt in Workout 13 („${r.do2.sub}")`);
  check(!!zMi && !zMi.quellen && !!zMi.zusatz && zMi.zusatz.woche === 3 && zMi.zusatz.plus === plusImKopf(r.do2.sub),
    `R3 Mi: „Aus Woche 3 kommt dazu: morgen +${plusImKopf(r.do2.sub)}" („${r.mi.frei}")`);
  check(r.do2.zeilen === 0, 'R3 Do: Workout 13 ist fällig – keine Zeile');
  await ende(r.f);
});

/* ------------------------------------------------------------------ *
 * R4 Ohne Hanteln
 * ------------------------------------------------------------------ */
await abschnitt('R4', async () => {
  const r = await woche('R4', { ...kopie(VORLAGE), mode: 'bw' }, TOBI_DO, { bis: 'di' });
  check(/^Bodyweight · /.test(r.fr.sub), `R4 Fr: Workout 10 ohne Hanteln („${r.fr.sub}")`);
  pruefeWoche('R4', r);
  await ende(r.f);
});

/* ------------------------------------------------------------------ *
 * R5 Termin am Folgetag: Padel am Sonntag schont am Sa und am Mo die Beine
 * ------------------------------------------------------------------ */
await abschnitt('R5', async () => {
  const z = { ...kopie(VORLAGE), termine: [{ datum: '2026-10-11', name: 'Padel', aktivitaet: 'padel', minuten: 90 }] };
  const r = await woche('R5', z, TOBI_DO, { bis: 'di' });
  const ohne = await r.f.M(({ P, D }) => [10, 11].map((n) => P.injuryNotes(n, 'db').termin.length), null);
  check(ohne.every((x) => x > 0), `R5 der Termin nimmt am Sa und am Mo etwas heraus (${ohne.join(', ')})`);
  const zl = pruefeWoche('R5', r);
  check(!!zl && r.fr.frei !== ZEILE_TOBI, `R5 die Zeile ist eine andere als ohne Termin („${r.fr.frei}")`);
  await ende(r.f);
});

/* ------------------------------------------------------------------ *
 * R6 Zusatz in der Einheit: liegen gelassene Chin-ups sind kein Rückstand
 * ------------------------------------------------------------------ */
await abschnitt('R6', async () => {
  const f = await fall('R6', VORLAGE, TAG.do);
  const w9 = await spiele(f, 9, { ...TOBI_DO, 'chin-ups': 0 });
  check(!!w9.zusatz && (w9.zusatz.ex || []).some((x) => x.id === 'chin-ups'),
    'R6 Workout 9 trug den Zusatz aus Woche 2 (Chin-ups)');
  await f.tag(TAG.fr);
  const k = await kopf(f);
  console.log(`     ${k.sub} | ${k.frei}`);
  check(k.frei === ZEILE_TOBI, `R6 dieselbe Zeile wie mit gemachten Chin-ups („${k.frei}")`);
  await ende(f);
});

/* ------------------------------------------------------------------ *
 * R9 Zwei Tage mit Rückstand: am Do und am Sa liegen geblieben
 * ------------------------------------------------------------------ */
await abschnitt('R9', async () => {
  const f = await fall('R9', VORLAGE, TAG.do);
  await spiele(f, 9, TOBI_DO);
  await f.tag(TAG.sa);
  await spiele(f, 10, { 'band-seitheben': 1, 'einbeiniges-stehendes-wadenheben': 1 });
  await f.tag(TAG.so);
  const so = await kopf(f);
  await f.tag(TAG.mo);
  const ist = [{ n: 11, plus: await nachVon(f, 11) }];
  await spiele(f, 11);
  await f.tag(TAG.di);
  ist.push({ n: 12, plus: await nachVon(f, 12) });
  console.log(`     R9 So: ${so.auge} | ${so.sub} | ${so.frei}\n     R9 Einheiten: ${ist.map((x) => `W${x.n} +${x.plus}`).join(', ')}`);
  const z = zerlege(so.frei);
  check(!!z && z.quellen === 'Do und Sa', `R9 So: „Was am Do und Sa liegen blieb" („${so.frei}")`);
  check(!!z && z.ziele === alsZeile(ist, VOM_SO), `R9 und Mo und Di zeigen dann, was sie ankündigt („${z && z.ziele}" – gezeigt: „${alsZeile(ist, VOM_SO)}")`);
  await ende(f);
});

/** Sätze des eingefügten Zusatztags in Einheit n, wie sie dasteht. */
const zusatzVon = (f, n) => f.M(({ P }, k) => P.workoutByNo(k).ex.filter((x) => x.zusatz).reduce((a, x) => a + x.sets, 0), n);

/** Tobis Freitag (aus R1, sonst hier gespielt). */
async function freitagsStandHolen() {
  if (freitagsStand) return freitagsStand;
  const f = await fall('Freitagsstand', VORLAGE, TAG.do);
  await spiele(f, 9, TOBI_DO);
  await f.tag(TAG.fr);
  freitagsStand = await f.lies();
  await ende(f);
  return freitagsStand;
}

/* ------------------------------------------------------------------ *
 * R10 Der Zusatztag der Woche davor kommt morgen in die Einheit
 *
 * Woche 3: am Do Kreuzheben, Floor Press und Knieheben gar nicht – „der Rest
 * danach". Am Mi und am Do darauf lässt die Erholungsregel keinen Zusatz zu;
 * er entsteht erst am Sa, in Workout 14. Am Fr davor stand „morgen +1", der
 * Sa zeigte „15 + 4" – und ohne Rückstand in der neuen Woche gar keine Zeile,
 * obwohl am Sa „15 + 3" kam.
 * ------------------------------------------------------------------ */
await abschnitt('R10', async () => {
  const f = await fall('R10', VORLAGE, TAG.do);
  await spiele(f, 9, { 'rumaenisches-kreuzheben': 0, 'floor-press': 0, 'haengendes-knieheben': 0 });
  await f.tag(TAG.fr);
  const fr = await kopf(f);
  const zFr = zerlege(fr.frei);
  check(!!zFr && zFr.rest, `R10 Fr 09.10.: der Rest kommt nach der Woche („${fr.frei}")`);
  for (const [t, n] of [['sa', 10], ['mo', 11], ['di', 12]]) {
    await f.tag(TAG[t]);
    await spiele(f, n);
  }
  await f.tag(TAG.mi);
  const mi = await kopf(f);
  await f.tag(TAG.do2);
  const do2 = await kopf(f);
  const stand = await f.lies();
  // Was der Mi ankündigt, bringt der Do – hier nichts, und so sagt es die Zeile.
  const zMi = zerlege(mi.frei);
  console.log(`     R10 Mi: ${mi.auge} | ${mi.sub} | ${mi.frei}\n     R10 Do: ${do2.auge} | ${do2.sub}`);
  check(/Heute · Workout 13/.test(do2.auge) && ((zMi && zMi.zusatz && zMi.zusatz.plus) || 0) === plusImKopf(do2.sub),
    `R10 Mi: die Zeile kündigt an, was Workout 13 am Do bringt (+${plusImKopf(do2.sub)}, „${mi.frei}")`);

  // a) In der neuen Woche bleibt am Do ein Floor-Press-Satz liegen.
  await spiele(f, 13, { 'floor-press': 2 });
  await f.tag(TAG.fr2);
  const a = await kopf(f);
  const zA = zerlege(a.frei);
  // Die längste Fassung der Zeile: Auch sie lässt die Startansicht eine Seite.
  await f.page.setViewportSize({ width: 360, height: 740 });
  await f.page.reload({ waitUntil: 'networkidle' });
  await f.page.waitForTimeout(300);
  const mA = await f.page.evaluate(() => {
    const leiste = document.getElementById('tabbar').getBoundingClientRect();
    const z = document.querySelector('.ov-frei');
    return {
      sichtbar: Math.min(window.innerHeight, leiste.height ? leiste.top : window.innerHeight),
      fussUnten: document.querySelector('.ov-foot').getBoundingClientRect().bottom,
      zeile: z ? Math.round(z.getBoundingClientRect().height) : 0,
      scroll: document.documentElement.scrollHeight - window.innerHeight,
    };
  });
  console.log(`     R10a 360×740: Zeile ${mA.zeile} px, Fuß unten ${Math.round(mA.fussUnten)}, sichtbar bis ${Math.round(mA.sichtbar)}`);
  check(mA.zeile > 0 && mA.scroll <= 0 && mA.fussUnten <= mA.sichtbar,
    `R10a 360×740: mit beiden Sätzen bleibt die Startansicht eine Seite (Zeile ${mA.zeile} px)`);
  await f.page.screenshot({ path: path.join(SHOT, 'ruhetag-zusatz-360x740.png') });
  await f.page.setViewportSize({ width: 414, height: 896 });
  await f.tag(TAG.sa2);
  const saA = await kopf(f);
  const istA = { nach: await nachVon(f, 14), zusatz: await zusatzVon(f, 14) };
  console.log(`     R10a Fr 16.10.: ${a.auge} | ${a.sub} | ${a.frei}\n     R10a Sa 17.10.: ${saA.auge} | ${saA.sub} | +${istA.nach} nachgeholt, +${istA.zusatz} Zusatz`);
  check(istA.zusatz > 0 && istA.nach > 0, 'R10a Workout 14 trägt am Sa Nacharbeit und den Zusatztag Woche 3');
  check(!!zA && zA.ziele === `morgen +${istA.nach}` && !!zA.zusatz && zA.zusatz.woche === 3 && zA.zusatz.plus === istA.zusatz,
    `R10a Fr: „… morgen +${istA.nach}. Aus Woche 3 kommt dazu: morgen +${istA.zusatz}." („${a.frei}")`);
  check(!!zA && plusImKopf(saA.sub) === istA.nach + (zA.zusatz ? zA.zusatz.plus : 0),
    `R10a was die Zeile am Fr ankündigt, ergibt den Kopf des Sa („${saA.sub}")`);
  await ende(f);

  // b) Die neue Woche ohne Rückstand: Die Zeile steht trotzdem – wegen morgen.
  const b = await fall('R10b', stand, TAG.do2);
  await spiele(b, 13);
  await b.tag(TAG.fr2);
  const kb = await kopf(b);
  const zB = zerlege(kb.frei);
  await b.tag(TAG.sa2);
  const saB = await kopf(b);
  const zusB = await zusatzVon(b, 14);
  console.log(`     R10b Fr 16.10.: ${kb.sub} | ${kb.frei}\n     R10b Sa 17.10.: ${saB.sub}`);
  check(kb.frei === `Heute frei. Aus Woche 3 kommt dazu: morgen +${zusB}.` && zusB > 0,
    `R10b Fr: „Heute frei. Aus Woche 3 kommt dazu: morgen +${zusB}." („${kb.frei}")`);
  check(!!zB && plusImKopf(saB.sub) === (zB.zusatz ? zB.zusatz.plus : -1),
    `R10b und der Sa zeigt genau das („${saB.sub}")`);
  await ende(b);
});

/* ------------------------------------------------------------------ *
 * R11 Quell- und Zieltag mit demselben Kürzel
 *
 * Sa und So verpasst, der Plan rückt nach: Workout 10 am Mo, 11 am Mi, 12 am
 * Do 15.10. Am Di stand „Was am Do liegen blieb, kommt dazu: morgen +1, Do
 * +1" – zwei Donnerstage im selben Satz.
 * ------------------------------------------------------------------ */
await abschnitt('R11', async () => {
  const f = await fall('R11', VORLAGE, TAG.do);
  await spiele(f, 9, TOBI_DO);
  await f.tag(TAG.mo);
  await spiele(f, 10);
  await f.tag(TAG.di);
  const di = await kopf(f);
  const daten = await f.M(({ P, D }) => [11, 12].map((n) => P.effDate(D.PLAN[n - 1])));
  const z = zerlege(di.frei);
  console.log(`     R11 Di: ${di.auge} | ${di.frei} | W11 ${daten[0]}, W12 ${daten[1]}`);
  check(daten[0] === '2026-10-14' && daten[1] === '2026-10-15', 'R11 nachgerückt: Workout 11 am Mi, 12 am Do 15.10.');
  const quellen = z ? z.quellen.split(' und ') : [];
  const ziele = z ? z.ziele.split(', ').map((t) => t.replace(/ \+\d+$/, '')) : [];
  check(!!z && ziele.includes('Do') && !quellen.some((q) => ziele.includes(q)),
    `R11 kein Kürzel zugleich Quelle und Ziel („${di.frei}")`);
  check(!!z && z.quellen === 'Do 8.10.', `R11 die Quelle mit Datum: „Was am Do 8.10. liegen blieb" („${z && z.quellen}")`);
  const ist = [];
  await f.tag(TAG.mi);
  ist.push({ n: 11, plus: await nachVon(f, 11) });
  await spiele(f, 11);
  await f.tag(TAG.do2);
  ist.push({ n: 12, plus: await nachVon(f, 12) });
  check(!!z && z.ziele === alsZeile(ist, { 11: 'morgen', 12: 'Do' }),
    `R11 und Mi und Do zeigen dann, was sie ankündigt („${z && z.ziele}" – gezeigt: „${alsZeile(ist, { 11: 'morgen', 12: 'Do' })}")`);
  await ende(f);
});

/* ------------------------------------------------------------------ *
 * R12 Festgehaltene Nacharbeit an einer nicht angefangenen Einheit
 *
 * Am Fr in Workout 10 einen Satz an- und wieder abgetippt: `nachFest` steht,
 * angefangen ist die Einheit nicht. Danach in Workout 9 den vergessenen
 * dritten Floor-Press-Satz nachgetragen. Der Kopf zeigt weiter „15 + 2" (die
 * festgehaltene Nacharbeit), die Zeile sagte „morgen +1".
 * ------------------------------------------------------------------ */
await abschnitt('R12', async () => {
  const f = await fall('R12', await freitagsStandHolen(), TAG.fr);
  check(await zuEinheit(f, 10), 'R12 Workout 10 ist zu erreichen');
  await f.klick('[data-act="show-list"]', 300);
  const satz = '[data-act="toggle-set"][data-ex="band-seitheben"]';
  await f.klick(satz, 200);
  await f.klick(satz, 200);
  const st = await f.lies();
  check(!!(st.log[10] || {}).nachFest && !(st.log[10] || {}).startedOn && !st.session,
    'R12 Workout 10: Nacharbeit festgehalten, nicht angefangen, keine Sitzung');
  if (await f.page.locator('[data-act="hide-list"]').count()) await f.klick('[data-act="hide-list"]', 200);
  check(await zuEinheit(f, 9), 'R12 Workout 9 ist zu erreichen');
  await f.klick('[data-act="show-list"]', 300);
  await f.klick('[data-act="toggle-set"][data-ex="floor-press"][aria-pressed="false"]', 200);
  await f.tag(TAG.fr);
  const k = await kopf(f);
  const z = zerlege(k.frei);
  console.log(`     R12 Fr: ${k.auge} | ${k.sub} | ${k.frei}`);
  check(!!z && plusImKopf(k.sub) > 0 && z.ziele.startsWith(`morgen +${plusImKopf(k.sub)}`),
    `R12 die Zahl hinter „morgen" ist das „+" im Kopf (+${plusImKopf(k.sub)}, „${k.frei}")`);
  const ist = [];
  for (const [t, n] of [['sa', 10], ['mo', 11], ['di', 12]]) {
    await f.tag(TAG[t]);
    ist.push({ n, plus: await nachVon(f, n) });
    await spiele(f, n);
  }
  check(!!z && z.ziele === alsZeile(ist, VOM_FR),
    `R12 und Sa, Mo, Di zeigen dann, was sie ankündigt („${z && z.ziele}" – gezeigt: „${alsZeile(ist, VOM_FR)}")`);
  await ende(f);
});

/* ------------------------------------------------------------------ *
 * R13 Der Rest unter der Schwelle des Zusatztags verfällt – und die Zeile
 * sagt es
 *
 * Am Do nur die Floor Press nicht (0 von 3): Brust 3, Trizeps 2,1, vordere
 * Schulter 1,05. Sa und Di holen je einen Satz nach, dann ist kein Platz mehr,
 * und für einen Zusatztag ist der Rest zu klein. „Was am Do liegen blieb,
 * kommt dazu: morgen +1, Di +1." versprach das Ganze.
 * ------------------------------------------------------------------ */
await abschnitt('R13', async () => {
  const r = await woche('R13', VORLAGE, { 'floor-press': 0 });
  const z = pruefeWoche('R13', r);
  console.log(`     R13 Mi: ${r.mi.auge} | ${r.mi.frei} | Träger ${r.zusatzMi}; Do: ${r.do2.sub} | ${r.zusatzDo}`);
  check(!!z && z.entfaellt && !z.rest && r.fr.frei.endsWith(', der Rest entfällt.'),
    `R13 Fr: „… der Rest entfällt." („${r.fr.frei}")`);
  check(!r.zusatzMi && !r.zusatzDo && r.mi.zeilen === 0 && !/\+/.test(r.do2.sub),
    `R13 und es kommt wirklich nichts mehr: kein Zusatztag Woche 3, am Do „${r.do2.sub}"`);
  await ende(r.f);
});

/* ------------------------------------------------------------------ *
 * R7 Ohne Rückstand keine Zeile
 * ------------------------------------------------------------------ */
await abschnitt('R7', async () => {
  const f = await fall('R7', VORLAGE, TAG.do);
  await spiele(f, 9);
  await f.tag(TAG.fr);
  const k = await kopf(f);
  console.log(`     ${k.auge} | ${k.sub} | ${k.zeilen}`);
  check(/Morgen · Workout 10/.test(k.auge) && k.sub === 'Hanteln · 5 Übungen · 15 Sätze',
    `R7 Fr nach vollem Do: „Morgen · Workout 10", 15 Sätze („${k.sub}")`);
  check(k.zeilen === 0, 'R7 ohne Rückstand keine Zeile');
  await ende(f);
});

/* ------------------------------------------------------------------ *
 * R8 Heute ist nicht frei
 * ------------------------------------------------------------------ */
await abschnitt('R8', async () => {
  // a) Workout 9 nicht gemacht: Am Freitag rückt der Plan nach, Workout 9 ist heute.
  const a = await fall('R8a', VORLAGE, TAG.fr);
  const ka = await kopf(a);
  check(/Heute · Workout 9/.test(ka.auge) && ka.zeilen === 0, `R8a Do verpasst: „Heute · Workout 9", keine Zeile („${ka.auge}")`);
  await ende(a);

  if (!freitagsStand) { check(false, 'R8 braucht den Freitagsstand aus R1'); return; }
  // b) Samstag verpasst: Am Sonntag ist Workout 10 heute.
  const b = await fall('R8b', freitagsStand, TAG.so);
  const kb = await kopf(b);
  check(/Heute · Workout 10/.test(kb.auge) && kb.zeilen === 0 && plusImKopf(kb.sub) === 2,
    `R8b Sa verpasst: am So „Heute · Workout 10" mit +2, keine Zeile („${kb.auge} | ${kb.sub}")`);
  // d) Am Freitag eine andere Einheit angeblättert: keine Zeile – sie gehört zur nächsten.
  const d =await fall('R8d', freitagsStand, TAG.fr);
  check((await kopf(d)).zeilen === 1, 'R8d Fr auf Workout 10: die Zeile steht');
  await zuEinheit(d, 11);
  const kd = await kopf(d);
  check(/Workout 11/.test(kd.auge) && kd.zeilen === 0, `R8d auf Workout 11 geblättert: keine Zeile („${kd.auge}")`);
  await zuEinheit(d, 10);
  check((await kopf(d)).frei === ZEILE_TOBI, 'R8d zurück auf Workout 10: wieder da');
  // e) Vorgezogen: Start am Freitag zieht Workout 10 auf heute – dann ist heute nicht frei.
  await d.klick('[data-act="start-session"]', 300);
  const vor = await d.M(({ P, D }) => P.effDate(D.PLAN[9]));
  check(await zuEinheit(d, 10), 'R8e zurück zur Startansicht von Workout 10');
  const ke = await kopf(d);
  console.log(`     R8e ${ke.auge} | ${ke.sub} | Workout 10 am ${vor}`);
  check(vor === '2026-10-09' && /Heute · Workout 10/.test(ke.auge) && ke.zeilen === 0,
    `R8e vorgezogen: Workout 10 steht auf heute, keine Zeile („${ke.auge}")`);
  await ende(d);
  await ende(b);

  // c) Heute schon trainiert: Workout 9 erst am Freitag gemacht, unvollständig.
  const c = await fall('R8c', VORLAGE, TAG.fr);
  await spiele(c, 9, TOBI_DO);
  const kc1 = await kopf(c);
  await c.tag(TAG.fr);
  const kc = await kopf(c);
  console.log(`     R8c ${kc1.auge} → ${kc.auge} | ${kc.sub}`);
  check(kc1.zeilen === 0 && kc.zeilen === 0, `R8c heute schon trainiert: keine Zeile („${kc.auge}")`);
  await ende(c);
});

/*
 * R8f Heute schon trainiert – ein eigenes Workout. Wer auf „soll ich heute
 * nichts nachholen?" hin doch etwas macht, las danach „Heute frei.": Gezählt
 * hatten nur die Planeinheiten. Ein allein stehender Zusatztag ist im
 * Protokoll ebenfalls ein eigenes Workout und fällt unter dieselbe Prüfung.
 */
await abschnitt('R8f', async () => {
  const stand = kopie(await freitagsStandHolen());
  stand.customs = [...(stand.customs || []), { id: 'cextra1', name: 'Arme extra', ex: [{ id: 'sz-curls', sets: 3 }] }];
  const f = await fall('R8f', stand, TAG.fr);
  check((await kopf(f)).frei === ZEILE_TOBI, 'R8f Fr, eigenes Workout nur angelegt: die Zeile steht');
  await f.klick('.tab[data-tab="settings"]', 150);
  await f.klick('[data-act="go-tab"][data-tab="custom"]', 200);
  await f.klick('[data-act="custom-start"][data-id="cextra1"]', 300);
  await f.klick('[data-act="start-session"]', 300);
  if (await f.page.locator('[data-act="focus-list"]').count()) await f.klick('[data-act="focus-list"]', 200);
  for (let i = 0; i < 8; i++) {
    const l = f.page.locator('[data-act="toggle-set"][data-ex="sz-curls"][aria-pressed="false"]');
    if (!(await l.count())) break;
    await l.first().click();
    await f.page.waitForTimeout(250);
    if (await f.page.locator('[data-act="focus-list"]').count()) await f.klick('[data-act="focus-list"]', 150);
  }
  if (await f.page.locator('[data-act="finish-session"]').count()) await f.klick('[data-act="finish-session"]', 300);
  const st = await f.lies();
  check(((st.log || {}).cextra1 || {}).startedOn === '2026-10-09' && !st.session,
    'R8f das eigene Workout ist heute trainiert und abgeschlossen');
  await f.tag(TAG.fr);
  const k = await kopf(f);
  console.log(`     R8f ${k.auge} | ${k.sub} | ${k.zeilen}`);
  check(/Morgen · Workout 10/.test(k.auge) && k.zeilen === 0, `R8f danach: keine Zeile – heute war Training („${k.auge}")`);
  await ende(f);
});

console.log(`\n${fails ? `${fails} FEHLER` : 'alle Prüfungen bestanden'}`);
await browser.close();
