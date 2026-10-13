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
 *     Heute frei. Was am Do liegen blieb, kommt dazu: morgen +2, Mo +1, Di +1.
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
 *       dieselbe Rechnung vom Tag aus. Nach der Woche kein Zusatztag, weil die
 *       Zeile keinen ankündigt.
 *   R3  Viel liegen geblieben: „der Rest nach der Woche" – und nach der Woche
 *       ist der Zusatztag Woche 3 wirklich da.
 *   R4  Ohne Hanteln dasselbe.
 *   R5  Termin am Folgetag (Padel am So): Sa und Mo verlieren Beinübungen, die
 *       Zeile rechnet mit dem, was dann dasteht.
 *   R6  Zusatz in der Einheit: Liegen gelassene Chin-ups (der Zusatz aus Woche
 *       2 in Workout 9) sind kein Rückstand – dieselbe Zeile wie in R1.
 *   R9  Zwei Tage mit Rückstand (Do und Sa): „Was am Do und Sa liegen blieb",
 *       und Mo und Di zeigen dann, was die Zeile am So ankündigt.
 *   R7  Ohne Rückstand keine Zeile.
 *   R8  Keine Zeile, wenn heute nicht frei ist: die fällige Einheit verpasst
 *       (der Plan rückt nach, am Fr und am So), heute schon trainiert, eine
 *       andere Einheit angeblättert, die nächste per Start vorgezogen.
 *
 * Gegenprobe: Gegen 9b3a4b4 (ohne die Zeile) werden 27 von 117 Prüfungen rot –
 * R1 bis R6, R9 und die beiden Gegenstücke in R8d. R7 und der Rest von R8
 * prüfen, dass *keine* Zeile steht, und bleiben dort grün; sie halten die
 * Bedingung fest. Einzeln zurückgedreht wird jede Stelle rot: ohne den Abzug
 * zwischen den Einheiten sagt die Zeile „Mo +2", der Montag zeigt +1 (R2);
 * nur die nächste Einheit statt der Woche (R2); „der Rest nach der Woche"
 * ohne die Schwelle des Zusatztags (R2); ohne „heute schon trainiert" (R2,
 * R8c), ohne „die Einheit für heute" (R8d), ohne „liegt nach heute" (R2, R8b).
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
};
/** Workout 9 am Donnerstag wie bei Tobi – alles andere ganz. */
const TOBI_DO = { 'rumaenisches-kreuzheben': 2, 'floor-press': 2, 'reverse-fly': 1 };
const ZEILE_TOBI = 'Heute frei. Was am Do liegen blieb, kommt dazu: morgen +2, Mo +1, Di +1.';

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

/** Die Zeile zerlegt: Quelltage, Ziele („morgen +2, Mo +1"), Rest nach der Woche. */
function zerlege(zeile) {
  const m = zeile.match(/^Heute frei\. Was am (.+?) liegen blieb, kommt (?:dazu: (.+?)|nach der Woche dazu)\.$/);
  if (!m) return null;
  const teile = (m[2] || '').split(', ').filter(Boolean);
  const rest = !m[2] || teile.includes('der Rest nach der Woche');
  return { quellen: m[1], ziele: teile.filter((t) => t !== 'der Rest nach der Woche').join(', '), rest };
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
  check(!!z && z.rest, `R3 Fr: „… der Rest nach der Woche" („${r.fr.frei}")`);
  const getragen = r.ist.reduce((a, x) => a + x.plus, 0);
  check(getragen > 0 && getragen < 12,
    `R3 die restlichen Einheiten tragen ${getragen} der 12 liegen gebliebenen Sätze – der Rest passt nicht hinein`);
  check(r.zusatzMi || r.zusatzDo, 'R3 und nach der Woche ist der Zusatztag Woche 3 da');
  check(r.mi.zeilen === 0 && r.do2.zeilen === 0, 'R3 Mi und Do danach: keine Zeile – die neue Woche hat keinen Rückstand');
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

console.log(`\n${fails ? `${fails} FEHLER` : 'alle Prüfungen bestanden'}`);
await browser.close();
