/*
 * Summen statt Aufschlüsselung.
 *
 *     „Da brauch auch nicht 5+1 oder so stehen. Da soll einfach die normale
 *      Zahl dieses Trainings inkl der nachholübungen stehen. Also einfach 6 in
 *      diesem Fall. Genauso bei den Sätzen"
 *
 * Tobi zum Kopf der Startansicht „Hanteln · 5 + 1 Übungen · 15 + 2 Sätze"
 * (v239; an der Übung stand die Nacharbeit seit v238 als „3 + 1 Sätze"). Jetzt
 * steht überall die eine Zahl, die man an diesem Tag macht – Nachholsätze und
 * eingefügte Übungen eingerechnet. Woher das Mehr kommt, sagt weiter die
 * stille Zeile unter der Übung („+1 nachgeholt …", „Nachgeholt aus Woche 2 …").
 *
 *   S1  Donnerstag, Workout 9 mit den Chin-ups aus Woche 2 – Tobis Stand
 *       (tests/zusatz-tobi-do.json): Kopf „Hanteln · 6 Übungen · 17 Sätze",
 *       Kopf der Liste „6 Übungen · 0/17 Sätze", die Chin-ups „2 × …" mit
 *       ihrer Herkunftszeile, der Kalender „6 Übungen · 17 Sätze".
 *   S2  Samstag, Workout 10 mit Nacharbeit *und* Zusatz (derselbe Stand wie
 *       Z19 in test-zusatz-einheit.mjs): Kopf „Hanteln · 6 Übungen · 19 Sätze";
 *       die Übung mit Nachholsatz zeigt in Liste und Fokusansicht ihre ganze
 *       Satzzahl – so viele, wie Satzknöpfe dastehen –, darunter weiter
 *       „+1 nachgeholt …", und die Vorlesefunktion liest dieselbe Zahl.
 *   S3  Nirgends ein „+" zwischen zwei Zahlen vor „Übungen", „Sätze" oder
 *       „×" – nicht in der Startansicht, der Liste, der Fokusansicht, dem
 *       Kalender.
 *
 * Gegenprobe: gegen 9b3a4b4 (v239) schlagen alle zwölf Prüfungen auf die
 * Zahlen fehl (S1, S2, S3 – Kopf, Liste, Fokus, Vorlesen, Kalender); die zehn
 * auf Ausgangslage, Herkunftszeilen und Satzknöpfe bleiben grün – das stand
 * schon da und soll bleiben.
 */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { URL, ROOT, SHOT } from './umgebung.mjs';

const VORLAGE = JSON.parse(readFileSync(path.join(ROOT, 'tests', 'zusatz-tobi-do.json'), 'utf8'));
const kopie = (o) => JSON.parse(JSON.stringify(o));

const browser = await chromium.launch();
let fails = 0;
const check = (c, m) => { console.log(`${c ? 'OK  ' : 'FAIL'} ${m}`); if (!c) { fails++; process.exitCode = 1; } };

/** „15 + 2 Sätze", „5 + 1 Übungen", „3 + 1 ×" – die Aufschlüsselung, die weg ist. */
const PLUS = /\d+ \+ \d+ ?(Übungen|Sätze|×)/;

/** Ein Fall in eigenem Kontext, Zustand vor dem ersten Laden, Uhr fest. */
async function fall(zustand, wann) {
  const ctx = await browser.newContext({
    viewport: { width: 414, height: 896 }, timezoneId: 'Europe/Berlin', serviceWorkers: 'block',
  });
  // Nie den echten Server beschreiben.
  await ctx.route(/\.supabase\.co\//, (r) => r.fulfill({ status: 204, body: '' }));
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(`PAGEERROR: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errs.push(`CONSOLE: ${m.text()}`); });
  page.on('dialog', (d) => d.accept().catch(() => {}));
  await page.clock.setFixedTime(new Date(wann));
  await page.addInitScript(() => { navigator.vibrate = () => true; });
  await page.addInitScript((s) => {
    if (sessionStorage.getItem('saat')) return;
    sessionStorage.setItem('saat', '1');
    localStorage.setItem('workout.state.v1', JSON.stringify(s));
    localStorage.removeItem('workout.rounds.v1');
  }, zustand);
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(250);
  const txt = async (sel) => ((await page.locator(sel).first().textContent({ timeout: 1500 }).catch(() => '')) || '')
    .replace(/\s+/g, ' ').trim();
  const klick = async (sel, warte = 250) => {
    await page.locator(sel).first().click({ timeout: 3000 });
    await page.waitForTimeout(warte);
  };
  /** Was die Einheit `n` laut Plan an diesem Tag ist – Übungen und Sätze, alles. */
  const einheit = (n) => page.evaluate(async (nr) => {
    const P = await import('./js/plan.js');
    return P.workoutByNo(nr, 'db').ex.map((x) => ({
      id: x.id, name: P.resolve(x, 'db').name, sets: x.sets, nach: x.nach || 0, zusatz: !!x.zusatz,
    }));
  }, n);
  const zumKalender = async () => {
    await klick('.tab[data-tab="settings"]');
    await klick('[data-act="go-tab"][data-tab="calendar"]', 300);
    await klick('.cal-cell.today', 300);
  };
  return { ctx, page, errs, txt, klick, einheit, zumKalender };
}
const ende = async (f, name) => {
  check(f.errs.length === 0, `${name}: keine Fehler${f.errs.length ? ` – ${f.errs.slice(0, 2).join(' | ')}` : ''}`);
  await f.ctx.close();
};
const summe = (ex) => ex.reduce((a, x) => a + x.sets, 0);

/* ------------------------------------------------------------------ *
 * S1 Donnerstag: Workout 9 und die Chin-ups aus Woche 2
 * ------------------------------------------------------------------ */
{
  const f = await fall(VORLAGE, '2026-10-08T17:00:00+02:00');
  const ex = await f.einheit(9);
  const sub = await f.txt('.hero-sub');
  console.log(`     ${await f.txt('.hero-eyebrow')} · ${sub}`);
  check(ex.length === 6 && summe(ex) === 17 && ex.filter((x) => x.zusatz).length === 1,
    `S1 Ausgangslage: fünf Planübungen und die Chin-ups, zusammen 17 Sätze (${ex.length} · ${summe(ex)})`);
  check(sub === 'Hanteln · 6 Übungen · 17 Sätze', `S1 Kopf der Startansicht: die Summe („${sub}")`);
  const texte = [await f.txt('#view')];
  await f.page.screenshot({ path: path.join(SHOT, 'summen-start-414x896.png') });

  await f.klick('[data-act="show-list"]');
  const count = await f.txt('.focus-count');
  check(count === '6 Übungen · 0/17 Sätze', `S1 Kopf der Liste („${count}")`);
  const chin = await f.page.locator('article.ex', { hasText: 'Chin-ups' }).first().evaluate((el) => ({
    meta: el.querySelector('.ex-meta').textContent.replace(/\s+/g, ' ').trim(),
    knoepfe: el.querySelectorAll('.set-btn').length,
    zeile: (el.querySelector('.nach-warum') || {}).textContent || '',
  }));
  check(/^2 × /.test(chin.meta) && chin.knoepfe === 2, `S1 Chin-ups: „2 × …", zwei Satzknöpfe („${chin.meta}")`);
  check(/^Nachgeholt aus Woche 2: /.test(chin.zeile.trim()), `S1 die Herkunftszeile bleibt („${chin.zeile.trim()}")`);
  texte.push(await f.txt('#view'));
  await f.page.screenshot({ path: path.join(SHOT, 'summen-liste-414x896.png') });

  await f.zumKalender();
  const det = await f.txt('.cal-detail .hint');
  check(/· 6 Übungen · 17 Sätze$/.test(det), `S1 Kalender: der Tag mit derselben Summe („${det}")`);
  check(/Chin-ups.*· nachgeholt/.test(await f.txt('.cal-detail')), 'S1 Kalender: die Chin-ups stehen weiter als nachgeholt da');
  texte.push(await f.txt('#view'));
  await f.page.locator('.cal-detail').first().scrollIntoViewIfNeeded();
  await f.page.screenshot({ path: path.join(SHOT, 'summen-kalender-414x896.png') });

  const plus = texte.map((t) => (t.match(PLUS) || [])[0]).filter(Boolean);
  check(plus.length === 0, `S3 Donnerstag: kein „+" zwischen zwei Zahlen (${plus.join(' | ') || 'keins'})`);
  await ende(f, 'S1');
}

/* ------------------------------------------------------------------ *
 * S2 Samstag: Workout 10 mit Nacharbeit und Zusatz
 *
 * Workout 9 am Do trainiert, beim Kreuzheben ein Satz liegen gelassen; in
 * Woche 2 der Goblet Squat von Workout 7 offen – wie Z19.
 * ------------------------------------------------------------------ */
{
  const z = kopie(VORLAGE);
  z.log[7].db['goblet-squat'] = z.log[7].db['goblet-squat'].map(() => ({ w: '', done: false }));
  const w9 = { 'rumaenisches-kreuzheben': 3, 'floor-press': 3, 'fersenerhoehter-goblet-squat': 3, 'haengendes-knieheben': 3, 'reverse-fly': 3 };
  const e = { mode: 'db', done: 'db', soll: {}, nach: {}, nachFest: { db: {}, bw: {} }, nachWarum: { db: {}, bw: {} },
    db: {}, bw: {}, startedOn: '2026-10-08', super: true };
  Object.entries(w9).forEach(([id, k]) => {
    e.soll[id] = k;
    e.nach[id] = 0;
    e.db[id] = Array.from({ length: k }, (_, s) => ({ w: '20', done: !(id === 'rumaenisches-kreuzheben' && s === k - 1) }));
  });
  z.log[9] = e;
  const f = await fall(z, '2026-10-10T17:00:00+02:00');
  const ex = await f.einheit(10);
  const nach = ex.find((x) => x.nach > 0 && !x.zusatz) || {};
  console.log(`     ${ex.map((x) => `${x.name} ${x.sets}${x.nach ? ` (davon ${x.nach} nachgeholt)` : ''}${x.zusatz ? ' (Zusatz)' : ''}`).join(', ')}`);
  check(ex.length === 6 && summe(ex) === 19 && !!nach.id && ex.some((x) => x.zusatz),
    `S2 Ausgangslage: sechs Übungen, 19 Sätze, Nacharbeit an ${nach.name} und ein Zusatz`);
  const sub = await f.txt('.hero-sub');
  console.log(`     ${await f.txt('.hero-eyebrow')} · ${sub}`);
  check(sub === 'Hanteln · 6 Übungen · 19 Sätze', `S2 Kopf: Nacharbeit und Zusatz in einer Summe („${sub}")`);
  const texte = [await f.txt('#view')];
  await f.page.screenshot({ path: path.join(SHOT, 'summen-start-sa-414x896.png') });

  await f.klick('[data-act="show-list"]');
  const count = await f.txt('.focus-count');
  check(count === '6 Übungen · 0/19 Sätze', `S2 Kopf der Liste („${count}")`);
  const karte = await f.page.locator('article.ex').filter({
    has: f.page.locator('.ex-name', { hasText: new RegExp(`^${nach.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`) }),
  }).first().evaluate((el) => ({
    meta: el.querySelector('.ex-meta').textContent.replace(/\s+/g, ' ').trim(),
    knoepfe: el.querySelectorAll('.set-btn').length,
    zeile: ((el.querySelector('.nach-warum') || {}).textContent || '').replace(/\s+/g, ' ').trim(),
  }));
  console.log(`     Liste: ${nach.name} | ${karte.meta} | ${karte.zeile}`);
  check(karte.meta.startsWith(`${nach.sets} × `) && karte.knoepfe === nach.sets,
    `S2 Liste: ${nach.name} „${nach.sets} × …" – so viele wie Satzknöpfe (${karte.knoepfe}; „${karte.meta}")`);
  check(/^\+1 nachgeholt/.test(karte.zeile), `S2 Liste: darunter weiter die Herkunft („${karte.zeile}")`);
  texte.push(await f.txt('#view'));

  // Fokusansicht, an der Übung mit Nachholsatz.
  await f.klick('[data-act="start-session"]', 400);
  for (let k = 0; k < 8; k++) {
    if ((await f.txt('.focus-name')) === nach.name) break;
    const weiter = f.page.locator('[data-act="focus-step"][data-d="1"]:not([disabled])');
    if (!(await weiter.count())) break;
    await weiter.first().click();
    await f.page.waitForTimeout(150);
  }
  const meta = await f.txt('.focus-meta');
  const knoepfe = await f.page.locator('.focus-set').count();
  const zeile = await f.txt('.nach-warum');
  console.log(`     Fokus: ${await f.txt('.focus-name')} | ${meta} | ${zeile}`);
  check(meta.startsWith(`${nach.sets} Sätze × `) && knoepfe === nach.sets,
    `S2 Fokus: „${nach.sets} Sätze × …", ${knoepfe} Satzknöpfe („${meta}")`);
  check(/^\+1 nachgeholt/.test(zeile), `S2 Fokus: die Herkunftszeile bleibt („${zeile}")`);
  const cdp = await f.ctx.newCDPSession(f.page);
  const { nodes } = await cdp.send('Accessibility.getFullAXTree');
  await cdp.detach();
  const sichtbar = nodes.filter((k) => !k.ignored);
  const vorgelesen = sichtbar.filter((k) => k.role?.value === 'StaticText'
    && (k.name?.value || '').startsWith(`${nach.sets} Sätze × `));
  check(vorgelesen.length === 1, `S2 Vorlesen: die Meta-Zeile kommt mit der Summe an („${vorgelesen[0]?.name?.value}")`);
  const mitPlus = sichtbar.filter((k) => PLUS.test(k.name?.value || ''));
  check(mitPlus.length === 0, `S2 Vorlesen: kein Knoten mit „… + …" (${mitPlus.map((k) => k.name.value).join(' | ') || 'keiner'})`);
  const letzter = await f.page.locator('.focus-set').last().getAttribute('aria-label');
  check(letzter === `Satz ${nach.sets} von ${nach.sets}, nachgeholt, erledigt`,
    `S2 Vorlesen: der Nachholsatz sagt weiter, dass er einer ist („${letzter}")`);
  texte.push(await f.txt('#view'));
  await f.page.evaluate(() => window.scrollTo(0, 0));
  // Das Foto ohne den „Los geht's"-Hinweis über den Satzknöpfen (bei fester
  // Uhr läuft sein Zeitgeber nicht ab).
  await f.page.evaluate(() => document.querySelector('#toast')?.classList.remove('show'));
  await f.page.waitForTimeout(300);
  await f.page.screenshot({ path: path.join(SHOT, 'summen-fokus-414x896.png') });

  await f.zumKalender();
  const det = await f.txt('.cal-detail .hint');
  check(/· 6 Übungen · 19 Sätze$/.test(det), `S2 Kalender: dieselbe Summe („${det}")`);
  texte.push(await f.txt('#view'));

  const plus = texte.map((t) => (t.match(PLUS) || [])[0]).filter(Boolean);
  check(plus.length === 0, `S3 Samstag: kein „+" zwischen zwei Zahlen (${plus.join(' | ') || 'keins'})`);
  await ende(f, 'S2');
}

console.log(`\n${fails ? fails + ' FEHLER' : 'alle Prüfungen bestanden'}`);
await browser.close();
