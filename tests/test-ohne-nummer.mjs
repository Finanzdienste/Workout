/*
 * Die laufende Nummer steht nirgends mehr (v271).
 *
 *     „Die Workout Nummer ist mir in to Do und Kalender und in meiner App
 *      übrigens komplett egal"
 *
 * Bis v270 hieß jede Einheit nach ihrer Nummer: „Heute · Workout 13" über dem
 * Titel, „Workout 19 · Mi, 18. November 2026" unter „Nächste Einheit",
 * „Workout 12 läuft noch.", „✓ Workout 12 vom Samstag ist abgeschlossen – …",
 * „Zuletzt (Workout 17)", im Kalender „Workout 10 · ausgefallen", im Google
 * Kalender, in To Do und in der Kalenderdatei „Workout 18 · 5 Übungen · 15
 * Sätze". Seit v271 sagt die App, wann: „Heute", „das Workout von heute",
 * „Das Workout vom Montag", „Zuletzt (Mo 16.11.)". Die Nummer bleibt, wo sie
 * etwas trägt – in der Kennung der Termine (kalenderTermine(), UID der
 * Kalenderdatei), im Protokoll und in data-n an Kopf, Plantag, Kalendertag
 * und am Knopf zurück zur laufenden Einheit. Daran erkennt dieser Test, welche
 * Einheit gemeint ist.
 *
 * Nachgestellt mit fester Uhr (Europe/Berlin): Aufbau, Hanteln, Supersätze an,
 * Workout 1 am Mo 16.11.2026, Workout 2 am Mi 18.11., Workout 3 am Fr 20.11.
 * (shift 84). Je Fall ein frischer Browser:
 *
 *   1. Montag, nichts trainiert: der Kopf auf der Startseite und in „Übungen &
 *      Gewichte" (Workout 1, dann 2), die Supersatz-Vorschau unter Mehr für
 *      beide, „Nächste Einheit" in der Statistik, der Kalender mit offenem
 *      Tag, „Plan neu starten", die Termine für Google Kalender und To Do
 *      (kalenderTermine()) und die Kalenderdatei samt Absagen.
 *   2. Montag, Workout 1 läuft, zu Workout 2 geblättert: „Das Workout von
 *      heute läuft noch." und „▶︎ Zurück zum Workout von heute" (data-n="1"),
 *      auf der Startseite und in der Liste; der Knopf führt zurück. Nach dem
 *      Wechsel liegen beide auf heute: „Das andere Workout beendet …", und auf
 *      Workout 1 „Das andere Workout von heute läuft noch.".
 *   3. Dienstag, Workout 1 am Montag liegen geblieben (4 Sätze): „✓ Das Workout
 *      vom Montag ist abgeschlossen – 4 von 18 Sätzen." (die geschützten
 *      Leerzeichen bleiben), die Karte „Gestern", nach „Doch noch
 *      weitermachen" „Gestern angefangen" und „Das Workout von gestern läuft
 *      noch.".
 *   4. Freitag, Workout 1 am Montag ganz gemacht, Workout 2 am Mittwoch
 *      ausgefallen: „Zuletzt (Mo 16.11.): 12 · 12 · 10" an derselben Übung in
 *      Workout 3, im Kalender „Workout · trainiert" und „Workout ·
 *      ausgefallen" mit data-n, „Das Workout rückte nach hinten und ist jetzt
 *      für heute geplant.", vorgelesen „…: Workout ausgefallen"; Workout 1
 *      „vor 4 Tagen", der Wechsel der Variante und die Rückfrage beim
 *      Zurücksetzen „das Workout vom Montag".
 *   5. Dienstag, Workout 1 und 2 am Montag angefangen und liegen geblieben:
 *      „✓ Die beiden Workouts vom Montag sind abgeschlossen – 4 von 18 und 3
 *      von 17 Sätzen." – der Tag einmal, nicht „vom Montag (…) und vom
 *      Montag (…)".
 *
 * Überall dazu: kein „Workout <Zahl>" im Text der Ansicht, in aria-label und
 * title, in keinem Toast und keiner Rückfrage. Ausgenommen ist die Diagnose
 * unter Mehr – sie nennt die Einheit mit Absicht („Einheit 1 läuft").
 *
 * Gegenprobe gegen v270 (b220cc3): 63 von 79 Prüfungen rot – 1 (20 von 25),
 * 2 (15 von 19), 3 (10 von 12), 4 (15 von 16), 5 (3 von 5); nichts bricht ab. Grün bleibt
 * dort, was es schon gab: Kennung und UID mit der Nummer, Beschreibungen ohne,
 * die Wege durch die App, die Toasts des Exports, die geschützten Leerzeichen
 * und „keine Fehler".
 */
import { chromium } from 'playwright';
import { URL } from './umgebung.mjs';
import { naechsterSatz } from './saetze.mjs';

const T = {
  mo: '2026-11-16T10:00:00+01:00',
  moAbend: '2026-11-16T18:40:00+01:00',
  di: '2026-11-17T10:00:00+01:00',
  fr: '2026-11-20T10:00:00+01:00',
};
const TAG = { mo: '2026-11-16', mi: '2026-11-18', fr: '2026-11-20' };
const SHIFT = 84;   // Workout 1 (Plan: Mo 24.8.) auf Mo 16.11.
// `lastBackup`: sonst stünde über allem die Zeile zur Sicherung.
const GRUND = {
  greeted: true, name: 'Tobi', focus: 'standard', level: 'geuebt', mode: 'db', supersatz: true, shift: SHIFT,
  tabs: ['stats', 'calendar'], lastBackup: { on: TAG.mo, done: 0 },
};

/** „Workout" mit einer Zahl dahinter – die Nummer, die es nicht mehr gibt. */
const NUMMER = /Workout\s*\d/;
/** Ein Titel für Google Kalender, To Do und die Kalenderdatei, seit v271. */
const TITEL = /^Workout · \d+ Übungen · \d+ Sätze$/;

const browser = await chromium.launch();
let fails = 0;
const check = (c, m) => { console.log(`${c ? 'OK  ' : 'FAIL'} ${m}`); if (!c) { fails++; process.exitCode = 1; } };
const offen = new Set();
const ms = (iso) => new Date(iso).getTime();
const eng = (s) => String(s || '').replace(/\s+/g, ' ').trim();

/**
 * Ein Fall in eigenem Kontext: `zustand` vor dem ersten Laden gesät, die Uhr
 * fest auf `wann`. Toasts und Rückfragen werden mitgeschrieben – ende() prüft
 * sie.
 */
async function fall(name, zustand, wann) {
  const ctx = await browser.newContext({
    viewport: { width: 414, height: 896 }, timezoneId: 'Europe/Berlin', serviceWorkers: 'block', acceptDownloads: true,
  });
  offen.add(ctx);
  await ctx.route('**/rest/v1/**', (r) => r.fulfill({ status: 204, body: '' }));
  // Jeder Toast, sobald er gesetzt wird – auch einer beim Start der App.
  await ctx.addInitScript(() => {
    window.__toasts = [];
    new MutationObserver((liste) => {
      liste.forEach((m) => {
        const el = m.target.nodeType === 1 ? m.target : m.target.parentElement;
        if (el && el.id === 'toast' && el.textContent.trim()) window.__toasts.push(el.textContent.trim());
      });
    }).observe(document, { childList: true, characterData: true, subtree: true });
  });
  const page = await ctx.newPage();
  const errs = [];
  const fragen = [];
  page.on('pageerror', (e) => errs.push(`PAGEERROR: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errs.push(`CONSOLE: ${m.text()}`); });
  page.on('dialog', (d) => { fragen.push(d.message()); d.accept().catch(() => {}); });
  await page.clock.setFixedTime(new Date(wann));
  await page.addInitScript((s) => {
    if (sessionStorage.getItem('gesaet')) return;
    sessionStorage.setItem('gesaet', '1');
    localStorage.setItem('workout.state.v1', JSON.stringify(s));
  }, zustand);
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(250);
  return {
    name, ctx, page, errs, fragen,
    txt: async (sel) => eng(await page.locator(sel).first().textContent({ timeout: 1500 }).catch(() => '')),
    attr: (sel, a) => page.locator(sel).first().getAttribute(a, { timeout: 1500 }).catch(() => null),
    M: (fn, arg) => page.evaluate(async ([src, a]) => {
      const m = {
        P: await import('./js/plan.js'), store: await import('./js/store.js'), D: await import('./js/data.js'),
        K: await import('./js/kalender.js'),
      };
      return (0, eval)(`(${src})`)(m, a);
    }, [fn.toString(), arg]),
    klick: async (sel, warte = 300) => {
      await page.locator(sel).first().click({ timeout: 3000 });
      await page.waitForTimeout(warte);
    },
    tab: async (t) => {
      await page.locator(`.tab[data-tab="${t}"]`).click({ timeout: 3000 });
      await page.waitForTimeout(300);
    },
    /** Was der Toast gerade sagt – leer, wenn keiner steht. */
    toast: () => page.evaluate(() => {
      const t = document.getElementById('toast');
      return t && t.classList.contains('show') ? t.textContent.trim() : '';
    }),
  };
}
async function zu(f) {
  offen.delete(f.ctx);
  await f.ctx.close();
}
async function ende(f) {
  const toasts = await f.page.evaluate(() => window.__toasts || []).catch(() => []);
  const gesagt = [...new Set([...toasts, ...f.fragen])];
  check(f.errs.length === 0, `${f.name}: keine Fehler${f.errs.length ? ` – ${f.errs.slice(0, 2).join(' | ')}` : ''}`);
  check(!gesagt.some((t) => NUMMER.test(t)),
    `${f.name}: kein Toast, keine Rückfrage mit Nummer (${gesagt.map((t) => `„${t}"`).join(', ') || 'keine'})`);
  await zu(f);
}
async function abschnitt(nr, fn) {
  try {
    await fn();
  } catch (e) {
    check(false, `${nr} abgebrochen: ${String(e.message || e).split('\n')[0]}`);
    for (const ctx of offen) await ctx.close().catch(() => {});
    offen.clear();
  }
}

/** Der Kopf über dem Titel: Text und die Einheit dahinter (data-n). */
const kopf = (f) => f.page.evaluate(() => {
  const e = document.querySelector('#view .hero-eyebrow');
  return e ? { text: e.textContent.replace(/\s+/g, ' ').trim(), n: e.getAttribute('data-n') } : { text: '', n: null };
});
/**
 * Alles, was die Ansicht sagt: jeder Text, auch zugeklappter, dazu aria-label
 * und title – Textstück für Textstück, mit Leerzeichen dazwischen. Ohne die
 * Diagnose unter Mehr: Sie nennt die laufende Einheit mit Absicht bei der
 * Nummer („Einheit 1 läuft"), zum Nachsehen bei einem Fehler.
 */
const ansicht = (f) => f.page.evaluate(() => {
  const v = document.getElementById('view').cloneNode(true);
  v.querySelectorAll('#diagnose').forEach((d) => d.remove());
  const teile = [];
  const gang = document.createTreeWalker(v, window.NodeFilter.SHOW_TEXT);
  while (gang.nextNode()) teile.push(gang.currentNode.data);
  v.querySelectorAll('[aria-label], [title]').forEach((e) => {
    ['aria-label', 'title'].forEach((a) => { if (e.hasAttribute(a)) teile.push(e.getAttribute(a)); });
  });
  return teile.join(' ').replace(/\s+/g, ' ').trim();
});
/** Wo die Nummer steht, mit etwas Umgebung – für die Meldung. */
const fundstelle = (s) => {
  const m = NUMMER.exec(s);
  return m ? ` – „…${s.slice(Math.max(0, m.index - 40), m.index + 30)}…"` : '';
};
/** Die ganze Ansicht ohne „Workout <Zahl>". */
async function nirgends(f, wo) {
  const t = await ansicht(f);
  check(t.length > 0 && !NUMMER.test(t), `${wo}: nirgends eine Nummer${fundstelle(t)}`);
  return t;
}
/** Die Köpfe der Detailkarten im Kalender als „n:Text" („2:Workout · ausgefallen"). */
const detailKoepfe = (f) => f.page.evaluate(() => [...document.querySelectorAll('.cal-detail .lbl')]
  .map((e) => `${e.dataset.n || '–'}:${e.textContent.replace(/\s+/g, ' ').trim()}`));
/** Der Block, wenn eine andere Einheit läuft: Satz, Knopf zurück (Text, data-n), Start. */
const laeuftWoanders = async (f) => ({
  satz: await f.txt('.laeuft-woanders'),
  zurueck: await f.txt('[data-act="zur-laufenden"]'),
  n: await f.attr('[data-act="zur-laufenden"]', 'data-n'),
  start: await f.txt('.laeuft-woanders ~ [data-act="start-session"]'),
});
/** Aus der Fokusansicht zurück auf die Startseite. */
async function zurueck(f) {
  for (let k = 0; k < 3 && await f.page.locator('.focus-cue').count(); k++) {
    await f.page.goBack();
    await f.page.waitForTimeout(250);
  }
}
/** Eine Datei über ihren Knopf unter Mehr holen, wie man sie bekommt: als Download. */
async function hole(f, act) {
  const [dl] = await Promise.all([
    f.page.waitForEvent('download', { timeout: 5000 }),
    f.page.locator(`[data-act="${act}"]`).first().click({ timeout: 3000 }),
  ]);
  const teile = [];
  for await (const stueck of await dl.createReadStream()) teile.push(stueck);
  await f.page.waitForTimeout(200);
  // Gefaltete Zeilen wieder zusammensetzen (RFC 5545, fold() in js/ics.js).
  return Buffer.concat(teile).toString('utf8').replace(/\r\n[ \t]/g, '');
}

/* ------------------------------------------------------------------ *
 * Der Plan, wie die App ihn sieht
 * ------------------------------------------------------------------ */

const { PLAN, laenge, tage } = await (async () => {
  const f = await fall('Plan lesen', GRUND, T.mo);
  const p = await f.M(({ P, D }) => ({
    PLAN: D.PLAN.slice(0, 4).map((w) => ({ n: w.n, ex: P.exBasis(w, 'db').map((x) => ({ id: x.id, sets: x.sets })) })),
    laenge: D.PLAN.length,
    tage: D.PLAN.slice(0, 3).map((w) => P.effDate(w)),
  }));
  await zu(f);
  return p;
})();
check(tage.join() === [TAG.mo, TAG.mi, TAG.fr].join(),
  `Ausgangslage: Workout 1 am Mo 16.11., Workout 2 am Mi 18.11., Workout 3 am Fr 20.11. (${tage.join(', ')})`);
const saetze1 = PLAN[0].ex.reduce((a, x) => a + x.sets, 0);
// Eine Übung, die in Workout 1 und Workout 3 steht – für „Zuletzt (…)".
const gleiche = PLAN[0].ex.find((x) => PLAN[2].ex.some((y) => y.id === x.id)) || { id: '' };
check(!!gleiche.id, `Workout 1 und 3 teilen eine Übung (${gleiche.id || 'keine'})`);

/**
 * Ein Protokolleintrag wie die App ihn schreibt (so auch in
 * test-tagesabschluss.mjs): `soll` für jede Übung, keine Nacharbeit, die
 * ersten `k` Sätze abgehakt – alle, wenn `k` fehlt, und dann abgeschlossen.
 * `gewichte`: je Übung, was in den Sätzen eingetragen ist.
 */
function eintrag(w, k = Infinity, tag = TAG.mo, gewichte = {}) {
  const e = { db: {}, bw: {}, mode: 'db', soll: {}, nach: {}, nachFest: { db: {}, bw: {} }, nachWarum: { db: {}, bw: {} } };
  let rest = k;
  w.ex.forEach(({ id, sets }) => {
    e.soll[id] = sets;
    e.nach[id] = 0;
    e.db[id] = Array.from({ length: sets }, (_, i) => {
      const d = rest > 0;
      if (d) rest -= 1;
      return { w: d && gewichte[id] ? String(gewichte[id][i] ?? '') : '', done: d };
    });
  });
  if (k > 0) e.startedOn = tag;
  if (k === Infinity) e.done = 'db';
  return e;
}

/* ------------------------------------------------------------------ *
 * 1. Montag, nichts trainiert
 * ------------------------------------------------------------------ */
await abschnitt(1, async () => {
  const f = await fall('1 Montag', GRUND, T.mo);
  let k = await kopf(f);
  const titel = await f.txt('.hero-title');
  console.log(`     Startseite: „${k.text}" (data-n ${k.n}) · ${titel}`);
  check(k.n === '1' && k.text === 'Tobi · Heute' && titel === 'Mo, 16. November 2026',
    `1 Startseite: über Workout 1 nur „Tobi · Heute", darunter der Tag (bis v270 „Tobi · Heute · Workout 1") – „${k.text}", data-n ${k.n}`);
  await nirgends(f, '1 Startseite');

  await f.klick('[data-act="show-list"]');
  k = await kopf(f);
  check(k.n === '1' && k.text === 'Heute', `1 Übungen & Gewichte, Workout 1: „Heute" („${k.text}", data-n ${k.n})`);
  await nirgends(f, '1 Übungen & Gewichte, Workout 1');
  // Blättern führt auf die Startseite der Einheit, von dort in ihre Liste.
  await f.klick('[data-act="nav-workout"][data-delta="1"]');
  k = await kopf(f);
  check(k.n === '2' && k.text === 'Tobi · in 2 Tagen', `1 geblättert zu Workout 2: „Tobi · in 2 Tagen" („${k.text}", data-n ${k.n})`);
  await nirgends(f, '1 Startseite von Workout 2');
  await f.klick('[data-act="show-list"]');
  k = await kopf(f);
  check(k.n === '2' && k.text === 'in 2 Tagen', `1 Übungen & Gewichte, Workout 2: „in 2 Tagen" („${k.text}", data-n ${k.n})`);
  await nirgends(f, '1 Übungen & Gewichte, Workout 2');

  // Die Supersatz-Vorschau unter Mehr gilt der gezeigten Einheit
  // (superVorschau()): erst Workout 2 am Mittwoch, dann wieder Workout 1.
  await f.tab('settings');
  const vorschau2 = await f.txt('.super-vorschau .lbl');
  check(vorschau2 === 'Workout am Mittwoch liefe so', `1 Mehr, Workout 2 gezeigt: „${vorschau2}" (bis v270 „Workout 2 liefe so")`);
  await f.tab('dashboard');
  await f.klick('[data-act="nav-today"]');
  k = await kopf(f);
  check(k.n === '1' && k.text === 'Tobi · Heute', `1 „Heute" führt zurück zu Workout 1 („${k.text}", data-n ${k.n})`);

  await f.tab('stats');
  const plantag = { text: await f.txt('.plan-date'), n: await f.attr('.plan-date', 'data-n') };
  const oeffnen = await f.attr('.plan-date ~ .btn-row [data-act="open-workout"]', 'data-n');
  check(plantag.n === '1' && oeffnen === '1' && plantag.text === 'Mo, 16. November 2026',
    `1 Statistik, Nächste Einheit: nur der Tag (bis v270 „Workout 1 · …") – „${plantag.text}", data-n ${plantag.n}, Öffnen ${oeffnen}`);
  await nirgends(f, '1 Statistik');

  await f.tab('calendar');
  await f.klick(`[data-act="cal-day"][data-iso="${TAG.mo}"]`);
  const koepfe = await detailKoepfe(f);
  check(koepfe.includes('1:Workout · geplant'), `1 Kalender, heute angetippt: „Workout · geplant" für Workout 1 (${koepfe.join(' | ')})`);
  await nirgends(f, '1 Kalender mit offenem Tag');

  await f.tab('settings');
  const vorschau1 = await f.txt('.super-vorschau .lbl');
  check(vorschau1 === 'Workout von heute liefe so', `1 Mehr, Workout 1 gezeigt: „${vorschau1}"`);
  const mehr = await nirgends(f, '1 Mehr');
  check(/legt das erste Workout auf heute\./.test(mehr), '1 Mehr, Plan neu starten: „… legt das erste Workout auf heute." (bis v270 „legt Workout 1 auf heute")');

  // Google Kalender und To Do bekommen ihre Titel von hier (js/kalender.js);
  // die Nummer steckt nur noch in der Kennung, an der das Skript Termin und
  // Aufgabe wiederfindet.
  const termine = await f.M(({ K }) => K.kalenderTermine().map((t) => ({
    kennung: t.kennung, n: t.n, titel: t.titel, beschreibung: t.beschreibung,
  })));
  const plan = termine.filter((t) => typeof t.n === 'number');
  console.log(`     Termine: ${plan.slice(0, 2).map((t) => `${t.kennung} „${t.titel}"`).join(', ')} …`);
  check(plan.length === laenge && plan.every((t) => TITEL.test(t.titel)),
    `1 kalenderTermine(): alle ${plan.length} Titel „Workout · N Übungen · M Sätze" (bis v270 „Workout 1 · …") – ${
      (plan.find((t) => !TITEL.test(t.titel)) || {}).titel || 'jeder'}`);
  check(plan.every((t) => t.kennung.endsWith(`-${t.n}`)) && new Set(plan.map((t) => t.kennung)).size === plan.length,
    `1 kalenderTermine(): die Kennung trägt weiter die Nummer (${plan[0] && plan[0].kennung} … ${plan[plan.length - 1] && plan[plan.length - 1].kennung})`);
  check(termine.length > 0 && !termine.some((t) => NUMMER.test(t.beschreibung)),
    '1 kalenderTermine(): auch keine Beschreibung nennt eine Nummer');

  // Die Kalenderdatei, über ihren Knopf: Titel ohne Nummer, die UID mit.
  const ics = await hole(f, 'download-ics');
  const ereignisse = ics.split('BEGIN:VEVENT').slice(1);
  const summary = ereignisse.map((b) => (/\r\nSUMMARY:([^\r]*)/.exec(b) || [])[1] || '');
  const uids = ereignisse.map((b) => (/\r\nUID:([^\r]*)/.exec(b) || [])[1] || '');
  console.log(`     Kalenderdatei: ${ereignisse.length} Termine, ${uids[0]} „${summary[0]}"`);
  check(ereignisse.length === laenge && uids.every((u, i) => u === `workout-${i + 1}@workout.local`),
    `1 Kalenderdatei: ${ereignisse.length} Termine, die UID weiter workout-<n>@workout.local`);
  check(summary.every((s) => TITEL.test(s)) && !/SUMMARY:[^\r]*Workout\s*\d/.test(ics),
    `1 Kalenderdatei: jeder Titel ohne Nummer (${summary.find((s) => !TITEL.test(s)) || summary[0]})`);
  const aus = await hole(f, 'ics-aus');
  const absagen = aus.split('BEGIN:VEVENT').slice(1);
  check(absagen.length >= laenge && absagen.every((b, i) => b.includes(`\r\nUID:workout-${i + 1}@workout.local\r\n`)
    && b.includes('\r\nSTATUS:CANCELLED\r\n') && b.includes('\r\nSUMMARY:Workout – entfällt\r\n')),
  `1 Termine austragen: ${absagen.length} Absagen „Workout – entfällt" (bis v270 „Workout 1 – entfällt"), je mit ihrer UID`);
  await ende(f);
});

/* ------------------------------------------------------------------ *
 * 2. Montag, Workout 1 läuft – zu Workout 2 geblättert
 * ------------------------------------------------------------------ */
await abschnitt(2, async () => {
  const f = await fall('2 Montag, Training läuft', GRUND, T.mo);
  await f.klick('[data-act="start-session"]', 400);
  const id = await f.attr('.focus-set', 'data-ex');
  check(!!id && await naechsterSatz(f.page, id), `2 Workout 1 gestartet, ein Satz abgehakt (${id})`);
  await zurueck(f);
  let k = await kopf(f);
  check(k.n === '1' && k.text === 'Tobi · Heute', `2 zurück auf der Startseite: Workout 1, „${k.text}" (data-n ${k.n})`);
  await nirgends(f, '2 Startseite von Workout 1, es läuft');
  await f.klick('.ov-foot [data-act="nav-workout"][data-delta="1"]');
  k = await kopf(f);
  let b = await laeuftWoanders(f);
  console.log(`     Workout 2: „${k.text}" (data-n ${k.n}) · ${b.satz} · ${b.zurueck} (data-n ${b.n}) · ${b.start}`);
  check(k.n === '2' && b.satz === 'Das Workout von heute läuft noch.',
    `2 Startseite von Workout 2: „${b.satz}" (bis v270 „Workout 1 läuft noch.")`);
  check(b.zurueck === '▶︎ Zurück zum Workout von heute' && b.n === '1',
    `2 der Knopf zurück: „${b.zurueck}", data-n ${b.n} (bis v270 „▶︎ Zurück zu Workout 1")`);
  check(b.start === 'Diese starten – das Workout von heute wird beendet', `2 und der Start daneben: „${b.start}"`);
  await nirgends(f, '2 Startseite von Workout 2');

  await f.klick('[data-act="show-list"]');
  k = await kopf(f);
  b = await laeuftWoanders(f);
  check(k.n === '2' && b.satz === 'Das Workout von heute läuft noch.' && b.zurueck === '▶︎ Zurück zum Workout von heute' && b.n === '1',
    `2 Übungen & Gewichte von Workout 2: derselbe Block („${b.satz}", „${b.zurueck}", data-n ${b.n})`);
  await nirgends(f, '2 Übungen & Gewichte von Workout 2');

  await f.klick('[data-act="zur-laufenden"]');
  const fokus = await f.M(({ store }) => (store.getState().fokusOffen || {}).n ?? null);
  check(fokus === 1 && await f.page.locator('.focus-cue').count() > 0, `2 der Knopf führt in die Fokusansicht von Workout 1 (offen: ${fokus})`);

  // Über den Kalender zu Workout 2 („Zu dieser Einheit"), dann der Wechsel.
  await f.tab('calendar');
  await f.klick(`[data-act="cal-day"][data-iso="${TAG.mi}"]`);
  const koepfe = await detailKoepfe(f);
  check(koepfe.includes('2:Workout · geplant'), `2 Kalender, Mittwoch: „Workout · geplant" für Workout 2 (${koepfe.join(' | ')})`);
  await nirgends(f, '2 Kalender, Mittwoch offen');
  await f.klick('.cal-detail [data-act="cal-open"][data-n="2"]');
  k = await kopf(f);
  check(k.n === '2' && (await laeuftWoanders(f)).n === '1', `2 „Zu dieser Einheit": Workout 2, Workout 1 läuft (data-n ${k.n})`);
  await f.klick('.laeuft-woanders ~ [data-act="start-session"]', 400);
  const t = await f.toast();
  // Workout 2 liegt jetzt auch auf heute – die vorige heißt „das andere".
  check(t.startsWith('Das andere Workout beendet, Zeit gespeichert – los geht’s'),
    `2 „Diese starten": „${t}" (bis v270 „Workout 1 beendet, …")`);
  const lauf = await f.M(({ store }) => (store.getState().session || {}).n ?? null);
  check(lauf === 2, `2 jetzt läuft Workout 2 (${lauf})`);

  // Zurück zu Workout 1, das auch von heute ist: Beide hießen „das Workout von
  // heute" – die laufende heißt deshalb „das andere Workout von heute".
  await zurueck(f);
  await f.klick('.ov-foot [data-act="nav-workout"][data-delta="-1"]');
  k = await kopf(f);
  b = await laeuftWoanders(f);
  console.log(`     zurück auf Workout 1: „${k.text}" (data-n ${k.n}) · ${b.satz} · ${b.zurueck} (data-n ${b.n}) · ${b.start}`);
  check(k.n === '1' && b.satz === 'Das andere Workout von heute läuft noch.'
    && b.zurueck === '▶︎ Zurück zum anderen Workout von heute' && b.n === '2'
    && b.start === 'Diese fortsetzen – das andere Workout von heute wird beendet',
  `2 Workout 1, Workout 2 läuft, beide von heute: „${b.satz}", „${b.zurueck}" (data-n ${b.n}), „${b.start}"`);
  await nirgends(f, '2 Startseite von Workout 1, Workout 2 läuft');
  await ende(f);
});

/* ------------------------------------------------------------------ *
 * 3. Dienstag, Workout 1 am Montag liegen geblieben
 * ------------------------------------------------------------------ */
await abschnitt(3, async () => {
  const z = { ...GRUND, log: { 1: { ...eintrag(PLAN[0], 4), zuletzt: ms(T.moAbend) } } };
  const f = await fall('3 Dienstag', z, T.di);
  await f.page.locator('.notice.abschluss').first().waitFor({ timeout: 3000 }).catch(() => {});
  const zeile = await f.txt('.notice.abschluss');
  const inZeile = await f.M(({ store }) => ((store.tagesabschluss() || {}).einheiten || []).map((e) => e.n).join(','));
  let k = await kopf(f);
  console.log(`     Di: „${k.text}" (data-n ${k.n}) · ${zeile}`);
  check(zeile.startsWith(`✓ Das Workout vom Montag ist abgeschlossen – 4 von ${saetze1} Sätzen.`) && inZeile === '1' && !NUMMER.test(zeile),
    `3 die Zeile zum Tagesabschluss nennt den Tag, nicht die Nummer (bis v270 „✓ Workout 1 vom Montag …"): „${zeile}" (Einheiten ${inZeile})`);
  // Die geschützten Leerzeichen bleiben, wo sie hingehören: in „4 von 18
  // Sätzen" und vor dem letzten Wort (abschlussHinweis()).
  const roh = (await f.page.locator('.notice.abschluss').first().textContent({ timeout: 1500 }).catch(() => '')).trim();
  const nbsp = String.fromCharCode(0xa0);
  check(roh.includes(['4', 'von', saetze1, 'Sätzen'].join(nbsp)) && new RegExp(`${nbsp}\\S+$`).test(roh),
    '3 „4 von 18 Sätzen" bricht nicht um, das letzte Wort steht nie allein');
  check(k.n === '2' && k.text === 'Tobi · Morgen', `3 vorn steht Workout 2 für morgen („${k.text}", data-n ${k.n})`);
  await nirgends(f, '3 Startseite mit der Zeile');

  await f.klick('.ov-foot [data-act="nav-workout"][data-delta="-1"]');
  k = await kopf(f);
  const fertig = await f.txt('.fertig-kopf');
  check(k.n === '1' && k.text === 'Tobi · Gestern' && fertig === '✓ Abgeschlossen',
    `3 zurückgeblättert: Workout 1 ist „Tobi · Gestern", „${fertig}" (bis v270 „Tobi · Gestern · Workout 1") – „${k.text}", data-n ${k.n}`);
  await nirgends(f, '3 Karte von Workout 1');

  await f.klick('[data-act="start-session"]:has-text("Doch noch weitermachen")', 400);
  await zurueck(f);
  k = await kopf(f);
  check(k.n === '1' && k.text === 'Tobi · Gestern angefangen',
    `3 nach „Doch noch weitermachen": „${k.text}" (data-n ${k.n})`);
  await f.klick('.ov-foot [data-act="nav-workout"][data-delta="1"]');
  const b = await laeuftWoanders(f);
  check(b.satz === 'Das Workout von gestern läuft noch.' && b.zurueck === '▶︎ Zurück zum Workout von gestern' && b.n === '1'
    && b.start === 'Diese starten – das Workout von gestern wird beendet',
  `3 auf Workout 2: „${b.satz}", „${b.zurueck}" (data-n ${b.n}), „${b.start}"`);
  await nirgends(f, '3 Startseite von Workout 2, Workout 1 läuft');
  await f.klick('.laeuft-woanders ~ [data-act="start-session"]', 400);
  const t = await f.toast();
  check(t.startsWith('Workout von gestern beendet, Zeit gespeichert – los geht’s'), `3 „Diese starten": „${t}"`);
  await ende(f);
});

/* ------------------------------------------------------------------ *
 * 4. Freitag, Workout 1 am Montag gemacht, Workout 2 am Mittwoch ausgefallen
 * ------------------------------------------------------------------ */
await abschnitt(4, async () => {
  const e1 = { ...eintrag(PLAN[0], Infinity, TAG.mo, { [gleiche.id]: ['12', '12', '10'] }), zuletzt: ms(T.moAbend) };
  const f = await fall('4 Freitag', { ...GRUND, log: { 1: e1 } }, T.fr);
  let k = await kopf(f);
  check(k.n === '2' && k.text === 'Tobi · Heute', `4 Workout 2 rückte auf heute („${k.text}", data-n ${k.n})`);
  await nirgends(f, '4 Startseite');

  await f.klick('.ov-foot [data-act="nav-workout"][data-delta="1"]');
  await f.klick('[data-act="show-list"]');
  k = await kopf(f);
  const zuletzt = await f.page.evaluate(() => [...document.querySelectorAll('#view article.ex')].map((a) => ({
    id: (a.querySelector('.ex-head') || {}).dataset?.ex || '',
    text: ((a.querySelector('.last-time') || {}).textContent || '').replace(/\s+/g, ' ').trim(),
  })));
  const an = (zuletzt.find((x) => x.id === gleiche.id) || {}).text || '';
  const zeilen = zuletzt.filter((x) => x.text);
  console.log(`     Workout 3: „${k.text}" (data-n ${k.n}) · ${zeilen.map((x) => `${x.id}: ${x.text}`).join(' | ')}`);
  check(k.n === '3' && an === 'Zuletzt (Mo 16.11.): 12 · 12 · 10',
    `4 Übungen & Gewichte von Workout 3: „${an}" – der Tag, an dem trainiert wurde (bis v270 „Zuletzt (Workout 1)")`);
  check(zeilen.length > 0 && zeilen.every((x) => /^Zuletzt \((Mo|Di|Mi|Do|Fr|Sa|So) \d{1,2}\.\d{1,2}\.\): /.test(x.text)),
    `4 jede Zeile „Zuletzt" nennt Wochentag und Datum (${zeilen.length})`);
  await nirgends(f, '4 Übungen & Gewichte von Workout 3');

  await f.tab('calendar');
  const vorgelesen = await f.attr(`[data-act="cal-day"][data-iso="${TAG.mi}"]`, 'aria-label');
  check(vorgelesen === 'Mi, 18. November 2026: Workout ausgefallen',
    `4 Kalender, vorgelesen: „${vorgelesen}" (bis v270 „…: Workout 2 ausgefallen")`);
  await f.klick(`[data-act="cal-day"][data-iso="${TAG.mi}"]`);
  let koepfe = await detailKoepfe(f);
  const aus = await f.txt('.cal-detail.cal-aus');
  console.log(`     Mi 18.11.: ${koepfe.join(' | ')} · ${aus.slice(0, 160)}`);
  check(koepfe.includes('2:Workout · ausgefallen') && /Das Workout rückte nach hinten und ist jetzt für heute geplant\./.test(aus),
    `4 Kalender, Mittwoch: „Workout · ausgefallen" für Workout 2, „Das Workout rückte nach hinten …" (bis v270 „Workout 2 · ausgefallen")`);
  await nirgends(f, '4 Kalender, Mittwoch offen');
  await f.klick(`[data-act="cal-day"][data-iso="${TAG.mo}"]`);
  koepfe = await detailKoepfe(f);
  check(koepfe.includes('1:Workout · trainiert'), `4 Kalender, Montag: „Workout · trainiert" für Workout 1 (${koepfe.join(' | ')})`);
  await nirgends(f, '4 Kalender, Montag offen');

  // Von dort zu Workout 1: Der Kopf sagt „vor 4 Tagen"; der Wechsel der
  // Variante und die Rückfrage beim Zurücksetzen nennen es „vom Montag".
  await f.klick('.cal-detail [data-act="cal-open"][data-n="1"]');
  k = await kopf(f);
  check(k.n === '1' && k.text === 'Tobi · vor 4 Tagen', `4 „Im Dashboard ansehen": Workout 1, „${k.text}" (data-n ${k.n})`);
  await nirgends(f, '4 Startseite von Workout 1');
  await f.tab('settings');
  await f.klick('[data-act="set-modus"][data-v="bw"]', 200);
  const t = await f.toast();
  check(t === 'Bodyweight – das Workout vom Montag bleibt so, wie du trainiert hast',
    `4 Variante gewechselt: „${t}" (bis v270 „Bodyweight – Workout 1 bleibt, wie du sie trainiert hast")`);
  await f.tab('dashboard');
  await f.klick('[data-act="show-list"]');
  await f.klick('[data-act="reset-workout"]');
  check(f.fragen.includes('Das Workout vom Montag (Hanteln) wirklich zurücksetzen?'),
    `4 Zurücksetzen fragt nach dem Tag: ${f.fragen.map((x) => `„${x}"`).join(', ') || 'keine Rückfrage'}`);
  await ende(f);
});

/* ------------------------------------------------------------------ *
 * 5. Dienstag, Workout 1 und 2 am Montag angefangen und liegen geblieben
 * ------------------------------------------------------------------ */
await abschnitt(5, async () => {
  // Zwei Einheiten vom selben Tag: Ohne Nummer stünde dort „vom Montag (…)
  // und vom Montag (…)" – die Zeile nennt den Tag einmal.
  const saetze2 = PLAN[1].ex.reduce((a, x) => a + x.sets, 0);
  const z = {
    ...GRUND,
    log: {
      1: { ...eintrag(PLAN[0], 4), zuletzt: ms(T.moAbend) },
      2: { ...eintrag(PLAN[1], 3), zuletzt: ms(T.moAbend) + 30 * 60 * 1000 },
    },
  };
  const f = await fall('5 Dienstag, zwei vom Montag', z, T.di);
  await f.page.locator('.notice.abschluss').first().waitFor({ timeout: 3000 }).catch(() => {});
  const zeile = await f.txt('.notice.abschluss');
  const inZeile = await f.M(({ store }) => ((store.tagesabschluss() || {}).einheiten || []).map((e) => e.n).join(','));
  console.log(`     Di: ${zeile} (Einheiten ${inZeile})`);
  check(zeile.startsWith(`✓ Die beiden Workouts vom Montag sind abgeschlossen – 4 von ${saetze1} und 3 von ${saetze2} Sätzen.`)
    && inZeile === '1,2' && !NUMMER.test(zeile),
  `5 zwei vom selben Tag, der Tag einmal: „${zeile}" (Einheiten ${inZeile})`);
  const roh = (await f.page.locator('.notice.abschluss').first().textContent({ timeout: 1500 }).catch(() => '')).trim();
  const nbsp = String.fromCharCode(0xa0);
  check(roh.includes(`${['4', 'von', saetze1].join(nbsp)} und ${['3', 'von', saetze2, 'Sätzen'].join(nbsp)}`),
    '5 „4 von 18" und „3 von 17 Sätzen" brechen nicht um');
  await nirgends(f, '5 Startseite mit der Zeile');
  await ende(f);
});

console.log(`\n${fails ? `${fails} FEHLER` : 'alle Prüfungen bestanden'}`);
await browser.close();
