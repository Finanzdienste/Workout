/*
 * Nach dem Neuladen geht eine laufende Einheit weiter, wo sie war.
 *
 *     „Immer wenn ich kurz aus der app rausgeh und wieder rein komm dann kommt
 *      das. Aber eigentlich sollte ja einfach die Übung kommen die jetzt als
 *      nächstes ansteht"
 *
 * Das Handy beendet eine Web-App im Hintergrund gern ganz; zurück lädt sie
 * neu. Geprüft wird:
 *
 *   1. Läuft eine heute begonnene Einheit, öffnet die App in der Fokusansicht.
 *   2. Bei der ersten Übung mit offenem Satz – ist die erste fertig, bei der
 *      zweiten.
 *   3. Eine Einheit von gestern wartet auf dem Dashboard.
 *   4. Wer auf einem anderen Reiter war, bleibt dort.
 *   5. Wer mitten im Training bewusst zurück aufs Dashboard gegangen ist,
 *      landet auch wieder dort.
 *   6. Neuladen legt keinen weiteren Verlaufseintrag an: Nach zweimal Neuladen
 *      führt *ein* Zurück aufs Dashboard. Kalt gestartet (frischer Verlauf)
 *      ebenso – und nicht aus der App hinaus.
 *   7. Wer bewusst zu einer späteren Übung gesprungen ist, landet wieder dort.
 *   8. Mit Supersätzen beim Partner: Nach A1 kommt B, auch nach dem Neuladen,
 *      auch aus dem Stand von v217/v218 (nur die Nummer der Einheit gemerkt)
 *      und auch über „Training fortsetzen".
 *   9. Mit Supersätzen und Umschalten mitten in der Einheit: Paar 1 mit
 *      Hanteln fertig, dann Bodyweight – weder „Training fortsetzen" noch das
 *      Neuladen noch das Weiterrücken nach Paar 2 führen zurück zu Paar 1.
 *  10. Geht die App nach dem Neuladen nicht weiter (Einheit von gestern oder
 *      vorbei, ein Hinweis beim Start), obwohl der Verlauf auf der
 *      Fokusansicht stand – auch über Liste und Fokusansicht –, führt schon der
 *      erste Druck auf Zurück dorthin, wo man vor dem Dashboard war – und
 *      tut nicht scheinbar nichts.
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

const blick = (p = page) => p.evaluate(() => ({
  fokus: !!document.querySelector('.focus-cue'),
  ex: (document.querySelector('.focus-sets .set-btn') || {}).dataset?.ex || null,
  start: !!document.querySelector('[data-act="start-session"]'),
}));

await page.goto(URL, { waitUntil: 'networkidle' });
await page.evaluate(() => {
  localStorage.clear();
  localStorage.setItem('workout.state.v1', JSON.stringify({ greeted: true, mode: 'db' }));
});
await page.reload({ waitUntil: 'networkidle' });

// Ohne laufende Einheit: das Dashboard, wie immer.
check(!(await blick()).fokus, 'ohne laufende Einheit öffnet die App auf dem Dashboard');

// --- 1. Einheit anfangen, einen Satz abhaken, neu laden ---------------
await page.locator('[data-act="start-session"]').first().click();
await page.waitForTimeout(400);
const erste = (await blick()).ex;
await page.locator('.focus-sets .set-btn').first().click();
await page.waitForTimeout(300);
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(300);
const nachReload = await blick();
check(nachReload.fokus, 'nach dem Neuladen steht die Fokusansicht da, nicht das Dashboard');
check(nachReload.ex === erste, `bei der Übung, in der noch ein Satz offen ist (${nachReload.ex})`);

// --- 2. Erste Übung fertig: dann die nächste ---------------------------
const plan = await page.evaluate(async () => {
  const { getState } = await import('./js/store.js');
  const { workoutByNo } = await import('./js/plan.js');
  const n = getState().session.n;
  return { n, ex: workoutByNo(n, 'db').ex.map((x) => ({ id: x.id, sets: x.sets })) };
});
// Alle Sätze der ersten Übung abhaken – über den Speicher, so wie ein Tipp es
// tut (updateSet), damit keine Pause und kein Supersatz dazwischenfunkt.
await page.evaluate(async (p) => {
  const store = await import('./js/store.js');
  const { id, sets } = p.ex[0];
  for (let i = 0; i < sets; i++) store.updateSet(p.n, 'db', id, sets, i, { done: true });
  store.flush();
}, plan);
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(300);
const weiter = await blick();
const erwartet = await page.evaluate(async (n) => {
  const { getState } = await import('./js/store.js');
  const { workoutByNo } = await import('./js/plan.js');
  const e = getState().log[n] || {};
  const offen = workoutByNo(n, 'db').ex.find((x) => ((e.db || {})[x.id] || []).filter((s) => s && s.done).length < x.sets);
  return offen ? offen.id : null;
}, plan.n);
check(weiter.fokus && weiter.ex === erwartet && erwartet !== plan.ex[0].id,
  `ist die erste Übung durch, geht es bei der nächsten offenen weiter (${weiter.ex}, erwartet ${erwartet})`);

// --- 3. Eine Einheit von gestern wartet auf dem Dashboard --------------
await page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('workout.state.v1'));
  const gestern = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  s.clock = { ...(s.clock || {}), on: gestern };
  localStorage.setItem('workout.state.v1', JSON.stringify(s));
  // Ab hier schreibt diese Seite nichts mehr zurück – sonst setzte die App
  // beim Verlassen (pagehide) ihren eigenen Stand wieder drüber.
  window.Storage.prototype.setItem = () => {};
});
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(300);
check(!(await blick()).fokus, 'eine Einheit von gestern öffnet nicht von selbst');

// --- 4. Anderer Reiter: bleibt ------------------------------------------
await page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('workout.state.v1'));
  s.clock = { ...(s.clock || {}), on: new Date().toISOString().slice(0, 10) };
  s.tab = 'stats';
  localStorage.setItem('workout.state.v1', JSON.stringify(s));
  window.Storage.prototype.setItem = () => {};
});
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(300);
const reiter = await page.evaluate(() => ({
  fokus: !!document.querySelector('.focus-cue'),
  tab: (document.querySelector('.tab.active, .tab[aria-current="page"]') || {}).dataset?.tab || null,
}));
check(!reiter.fokus, `wer auf einem anderen Reiter war, bleibt dort (${reiter.tab})`);

// --- 5. Bewusst zurück aufs Dashboard: bleibt dort ------------------------
// Eigener Kontext, eigener Speicher – die Seite von oben hat ihren Stand
// eingefroren (setItem abgeschaltet) und hält noch Verbindungen offen.
await page.close();
const ctx2 = await browser.newContext({ viewport: { width: 414, height: 896 } });
await ctx2.route('**/rest/v1/**', (r) => r.fulfill({ status: 204, body: '' }));
const seite = await ctx2.newPage();
seite.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message));
await seite.goto(URL, { waitUntil: 'networkidle' });
await seite.evaluate(() => {
  localStorage.clear();
  localStorage.setItem('workout.state.v1', JSON.stringify({ greeted: true, mode: 'db' }));
});
await seite.reload({ waitUntil: 'networkidle' });
await seite.locator('[data-act="start-session"]').first().click();
await seite.waitForTimeout(300);
await seite.goBack();
await seite.waitForTimeout(300);
const zurueck = await seite.evaluate(() => !!document.querySelector('.focus-cue'));
await seite.reload({ waitUntil: 'networkidle' });
await seite.waitForTimeout(300);
const danach = await seite.evaluate(() => ({
  fokus: !!document.querySelector('.focus-cue'),
  weiter: !!document.querySelector('[data-act="start-session"]'),
}));
check(!zurueck && !danach.fokus && danach.weiter,
  'wer im Training zurück aufs Dashboard geht, findet nach dem Neuladen das Dashboard mit „fortsetzen"');

/** Neuer Kontext mit eigenem Speicher und diesem Stand. */
async function frisch(stand) {
  const c = await browser.newContext({ viewport: { width: 414, height: 896 } });
  await c.route('**/rest/v1/**', (r) => r.fulfill({ status: 204, body: '' }));
  const p = await c.newPage();
  p.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message));
  p.on('dialog', (d) => d.accept().catch(() => {}));
  await p.goto(URL, { waitUntil: 'networkidle' });
  await p.evaluate((s) => {
    localStorage.clear();
    localStorage.setItem('workout.state.v1', JSON.stringify(s));
  }, stand);
  await p.reload({ waitUntil: 'networkidle' });
  return { c, p };
}
const neuLaden = async (p) => {
  await p.reload({ waitUntil: 'networkidle' });
  await p.waitForTimeout(300);
};

// --- 6. Neuladen legt keinen weiteren Verlaufseintrag an -----------------
// Ein Neuladen behält den Verlauf (location.reload() nach einer neuen Fassung,
// ein wiederhergestellter Tab). Vorher kam dabei jedes Mal ein Eintrag für die
// Fokusansicht dazu: Nach zweimal Neuladen zeigten die ersten beiden Zurück
// unverändert dieselbe Übung, erst der dritte kam aufs Dashboard.
const { c: c6, p: h } = await frisch({ greeted: true, mode: 'db' });
await h.locator('[data-act="start-session"]').first().click();
await h.waitForTimeout(300);
const laenge = await h.evaluate(() => history.length);
await neuLaden(h);
await neuLaden(h);
const nachZwei = await h.evaluate(() => ({ len: history.length, fokus: !!document.querySelector('.focus-cue') }));
check(nachZwei.fokus && nachZwei.len === laenge,
  `zweimal neu geladen: Fokusansicht, und kein Verlaufseintrag dazu (${nachZwei.len}, vorher ${laenge})`);
await h.goBack();
await h.waitForTimeout(300);
const einZurueck = await blick(h);
check(!einZurueck.fokus && einZurueck.start, 'danach führt ein einziges Zurück aufs Dashboard');

// Kalt gestartet – das Handy hat die App ganz beendet, der Verlauf fängt
// frisch an. Dann muss die App den Eintrag selbst anlegen, sonst führt Zurück
// aus ihr hinaus statt aufs Dashboard. (Ging das Zurück oben ins Leere, steht
// die Fokusansicht noch – dann gibt es nichts wieder zu öffnen.)
if (!einZurueck.fokus) await h.locator('[data-act="start-session"]').first().click();
await h.waitForTimeout(400);
await h.close();
const kalt = await c6.newPage();
kalt.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message));
await kalt.goto(URL, { waitUntil: 'networkidle' });
await kalt.waitForTimeout(300);
check((await blick(kalt)).fokus, 'kalt gestartet geht es ebenso in der Fokusansicht weiter');
await kalt.goBack();
await kalt.waitForTimeout(300);
const draussen = kalt.url().startsWith('about:');
const nachKalt = draussen ? {} : await blick(kalt);
check(!draussen && !nachKalt.fokus && nachKalt.start,
  `und Zurück führt aufs Dashboard, nicht aus der App (${kalt.url()})`);
await c6.close();

// --- 7. Bewusst zu einer späteren Übung gesprungen: dort weiter ----------
// Ein Tipp auf die Übersicht oben (focus-goto). Aus den Haken lässt sich das
// nicht ablesen – die erste Übung hat noch offene Sätze –, die App muss es
// sich merken.
const { c: c7, p: g } = await frisch({ greeted: true, mode: 'db' });
await g.locator('[data-act="start-session"]').first().click();
await g.waitForTimeout(300);
const vorn = (await blick(g)).ex;
await g.locator('[data-act="focus-goto"][data-i="2"]').click();
await g.waitForTimeout(300);
const gesprungen = (await blick(g)).ex;
await neuLaden(g);
const nachSprung = await blick(g);
check(gesprungen !== vorn && nachSprung.fokus && nachSprung.ex === gesprungen,
  `wer zu Übung 3 gesprungen ist, landet nach dem Neuladen dort (${nachSprung.ex}, erwartet ${gesprungen})`);
await c7.close();

// --- 8. Supersätze: beim Partner weiter -----------------------------------
//     „Aber eigentlich sollte ja einfach die Übung kommen die jetzt als
//      nächstes ansteht"
// Nach A1 springt der Supersatz zu B. Vorher stand nach dem Neuladen wieder A
// da – die erste Übung mit offenem Satz –, und der Wechsel geriet durcheinander.
const { c: c8, p: s } = await frisch({ greeted: true, mode: 'db', supersatz: true });
await s.locator('[data-act="start-session"]').first().click();
await s.waitForTimeout(300);
const a = (await blick(s)).ex;
await s.locator('.focus-sets .set-btn').first().click();
await s.waitForTimeout(400);
const b = (await blick(s)).ex;
// Der Partner laut js/supersatz.js – nicht bloß „irgendeine andere".
const partner = await s.evaluate(async (id) => {
  const { getState } = await import('./js/store.js');
  const { workoutByNo, resolve } = await import('./js/plan.js');
  const { paare, gruppeVon } = await import('./js/supersatz.js');
  const n = getState().session.n;
  const items = workoutByNo(n, 'db').ex.map((x) => resolve(x, 'db'));
  const grp = gruppeVon(paare(items, 'db'), id);
  return grp && grp.length === 2 ? grp.find((x) => x.id !== id).id : null;
}, a);
check(partner && b === partner, `nach A1 steht der Partner da (${b}, Partner von ${a}: ${partner})`);
await neuLaden(s);
check((await blick(s)).ex === b, `nach dem Neuladen weiter beim Partner, nicht wieder bei A (${(await blick(s)).ex})`);

// Der Stand von v217/v218 merkte sich nur die Nummer der Einheit. Dann
// entscheidet die Reihenfolge im Wechsel, nicht die Planreihenfolge.
await s.evaluate(() => {
  const st = JSON.parse(localStorage.getItem('workout.state.v1'));
  st.fokusOffen = st.session.n;
  localStorage.setItem('workout.state.v1', JSON.stringify(st));
  window.Storage.prototype.setItem = () => {};
});
await neuLaden(s);
const alt = await blick(s);
check(alt.fokus && alt.ex === b, `auch aus dem alten Stand (nur die Nummer) beim Partner (${alt.ex})`);

// „Training fortsetzen" auf dem Dashboard fragt dieselbe Stelle. Wie oft
// Zurück dafür nötig ist, prüft Abschnitt 6 – hier zählt nur das Ziel.
for (let k = 0; k < 4 && (await blick(s)).fokus; k++) {
  await s.goBack();
  await s.waitForTimeout(300);
}
const amBrett = await blick(s);
if (amBrett.start) await s.locator('[data-act="start-session"]').first().click();
await s.waitForTimeout(300);
const fortgesetzt = await blick(s);
check(!amBrett.fokus && fortgesetzt.fokus && fortgesetzt.ex === b,
  `„Training fortsetzen" landet ebenfalls beim Partner (${fortgesetzt.ex})`);
await c8.close();

// --- 9. Supersätze und Umschalten mitten in der Einheit -------------------
// Umschalten geht auch mitten im Training (set-modus), und saetzeErledigt()
// zählt die Sätze beider Modi zusammen. Der Wechsel fragte bis v219 nur den
// gerade eingestellten Modus – und führte zu Paar 1 zurück, dessen Karte
// längst „fertig" sagte.
const { c: c9, p: m } = await frisch({ greeted: true, mode: 'db', supersatz: true });
await m.locator('[data-act="start-session"]').first().click();
await m.waitForTimeout(300);
const ein = await m.evaluate(async () => {
  const { getState } = await import('./js/store.js');
  const { workoutByNo, resolve } = await import('./js/plan.js');
  const { paare } = await import('./js/supersatz.js');
  const n = getState().session.n;
  const gr = (md) => paare(workoutByNo(n, md).ex.map((x) => resolve(x, md)), md)
    .map((g) => g.map((x) => ({ id: x.id, sets: x.sets })));
  return { n, db: gr('db'), bw: gr('bw'), bwIds: workoutByNo(n, 'bw').ex.map((x) => x.id) };
});
const paar1 = ein.db[0].map((x) => x.id);
const paar2 = ein.bw[1].map((x) => x.id);
check(ein.db[0].length === 2 && ein.bw[1].length === 2
  && paar1.every((id) => ein.bw[0].some((x) => x.id === id)) && !paar2.some((id) => paar1.includes(id)),
`Ausgangslage: Paar 1 ist in beiden Modi dasselbe Paar (${paar1.join(' + ')}), Paar 2 ein anderes (${paar2.join(' + ')})`);
// Paar 1 mit Hanteln ganz abhaken – so wie die Tipps es täten.
await m.evaluate(async (e) => {
  const store = await import('./js/store.js');
  for (const x of e.db[0]) for (let i = 0; i < x.sets; i++) store.updateSet(e.n, 'db', x.id, x.sets, i, { done: true });
  store.flush();
}, ein);
await neuLaden(m);
// Zurück aufs Dashboard, unter „Mehr" auf Bodyweight – mitten in der Einheit.
await m.goBack();
await m.waitForTimeout(300);
await m.locator('.tab[data-tab="settings"]').click();
await m.waitForTimeout(250);
await m.locator('[data-act="set-modus"][data-v="bw"]').first().click();
await m.waitForTimeout(250);
await m.locator('.tab[data-tab="dashboard"]').click();
await m.waitForTimeout(250);
const fertigBeide = await m.evaluate(async (e) => {
  const { saetzeErledigt, workoutByNo } = await import('./js/plan.js');
  return workoutByNo(e.n, 'bw').ex.filter((x) => saetzeErledigt(e.n, x.id, x.sets) >= x.sets).map((x) => x.id);
}, ein);
check(paar1.every((id) => fertigBeide.includes(id)),
  `nach dem Umschalten zählt Paar 1 auch im Bodyweight-Modus als fertig (${fertigBeide.join(', ')})`);

// a) Zurück auf dem Dashboard: „Training fortsetzen".
const brett9 = await blick(m);
if (brett9.start) await m.locator('[data-act="start-session"]').first().click();
await m.waitForTimeout(300);
const fort9 = await blick(m);
check(!brett9.fokus && fort9.fokus && fort9.ex === paar2[0],
  `„Training fortsetzen" nach dem Umschalten: Paar 2, nicht zurück zu Paar 1 (${fort9.ex}, erwartet ${paar2[0]})`);

// b) Neuladen, gemerkt ist eine Übung aus Paar 1: Die ist fertig, also greift
//    der Rückfall – und der darf nicht wieder bei Paar 1 landen.
await m.evaluate((id) => {
  const st = JSON.parse(localStorage.getItem('workout.state.v1'));
  st.fokusOffen = { n: st.session.n, id };
  localStorage.setItem('workout.state.v1', JSON.stringify(st));
  window.Storage.prototype.setItem = () => {};
}, paar1[0]);
await neuLaden(m);
const geladen9 = await blick(m);
check(geladen9.fokus && geladen9.ex === paar2[0],
  `Neuladen mit gemerkter fertiger Übung: weiter bei Paar 2 (${geladen9.ex}, erwartet ${paar2[0]})`);

// c) Paar 2 im Bodyweight-Modus per Tipp durchhaken. Nach dem letzten Satz
//    rückt die App weiter – zu Paar 3, nicht zu Paar 1.
await m.locator(`[data-act="focus-goto"][data-i="${ein.bwIds.indexOf(paar2[0])}"]`).click();
await m.waitForTimeout(250);
const saetze2 = ein.bw[1].reduce((a, x) => a + x.sets, 0);
const wege = [];
for (let k = 0; k < saetze2; k++) {
  const vor = (await blick(m)).ex;
  if (!paar2.includes(vor)) break;
  await m.locator('.focus-sets .set-btn:not(.on)').first().click();
  await m.waitForTimeout(350);
  wege.push(`${vor}→${(await blick(m)).ex}`);
}
const nach9 = await blick(m);
check(nach9.fokus && nach9.ex === ein.bw[2][0].id,
  `nach Paar 2 weiter zu Paar 3, nicht zu Paar 1 (${nach9.ex}, erwartet ${ein.bw[2][0].id}; ${wege.join(' ')})`);
await c9.close();

// d) Umschalten mitten *im* Paar. Bis v219 entschied hier ein Haken auf dem
//    letzten Satz im aktuellen Modus, ob die Übung fertig ist: Stand B mit
//    Hanteln bei 2 von 3, lief nach dem Umschalten mit dem einen fehlenden
//    Satz eine Pause „1/3", und die App blieb bei B, statt zu Paar 2 zu gehen.
//    Und mit nur A fertig muss der Wechsel bei B bleiben, nicht zu A springen.
async function imPaar(vorB) {
  const { c, p } = await frisch({ greeted: true, mode: 'db', supersatz: true });
  await p.locator('[data-act="start-session"]').first().click();
  await p.waitForTimeout(300);
  await p.evaluate(async ([e, k]) => {
    const store = await import('./js/store.js');
    const [a, b] = e.db[0];
    for (let i = 0; i < a.sets; i++) store.updateSet(e.n, 'db', a.id, a.sets, i, { done: true });
    for (let i = 0; i < k; i++) store.updateSet(e.n, 'db', b.id, b.sets, i, { done: true });
    store.flush();
  }, [ein, vorB]);
  await neuLaden(p);
  await p.goBack();
  await p.waitForTimeout(300);
  await p.locator('.tab[data-tab="settings"]').click();
  await p.waitForTimeout(250);
  await p.locator('[data-act="set-modus"][data-v="bw"]').first().click();
  await p.waitForTimeout(250);
  await p.locator('.tab[data-tab="dashboard"]').click();
  await p.waitForTimeout(250);
  await p.locator('[data-act="start-session"]').first().click();
  await p.waitForTimeout(300);
  const vorher = await blick(p);
  await p.locator('.focus-sets .set-btn:not(.on)').first().click();
  await p.waitForTimeout(400);
  const danach = await blick(p);
  const pause = await p.evaluate(async () => !!(await import('./js/store.js')).getState().rest);
  await c.close();
  return { vorher, danach, pause };
}
const bFast = await imPaar(ein.db[0][1].sets - 1);
check(bFast.vorher.ex === paar1[1] && bFast.danach.ex === paar2[0] && !bFast.pause,
  `B mit Hanteln fast fertig, nach dem Umschalten der letzte Satz: weiter zu Paar 2, keine Pause (${bFast.vorher.ex} → ${bFast.danach.ex}, Pause ${bFast.pause})`);
const nurA = await imPaar(0);
check(nurA.vorher.ex === paar1[1] && nurA.danach.ex === paar1[1],
  `nur A mit Hanteln fertig, nach dem Umschalten ein Satz B: die App bleibt bei B, nicht zurück zu A (${nurA.vorher.ex} → ${nurA.danach.ex})`);

// --- 10. Verlauf, wenn die App nach dem Neuladen nicht weitergeht ----------
// Der Verlauf stand auf der Fokusansicht, die App bleibt aber auf dem
// Dashboard. Bis v219 saß das Dashboard auf dem Eintrag der Fokusansicht, und
// der erste Druck auf Zurück führte zum Eintrag darunter – wieder das
// Dashboard. Davor war die Statistik offen: Dorthin muss *ein* Zurück führen.
const aktiv = (p) => p.evaluate(() => ({
  fokus: !!document.querySelector('.focus-cue'),
  tab: (document.querySelector('.tab[aria-selected="true"]') || {}).dataset?.tab || null,
}));
async function ohneFortsetzen(name, aendern, ueberListe = false) {
  const { c, p } = await frisch({ greeted: true, mode: 'db' });
  await p.locator('.tab[data-tab="stats"]').click();
  await p.waitForTimeout(200);
  await p.locator('.tab[data-tab="dashboard"]').click();
  await p.waitForTimeout(200);
  await p.locator('[data-act="start-session"]').first().click();
  await p.waitForTimeout(300);
  await p.locator('.focus-sets .set-btn').first().click();
  await p.waitForTimeout(300);
  if (ueberListe) {
    // Zwischendurch in der Übersicht und zurück: Dann liegen Fokusansicht,
    // Liste und wieder Fokusansicht übereinander, und alle drei gelten nicht
    // mehr.
    await p.locator('[data-act="focus-list"]').click();
    await p.waitForTimeout(250);
    await p.locator('[data-act="focus-back"]').click();
    await p.waitForTimeout(250);
  }
  const vorher = await p.evaluate(() => history.state);
  await p.evaluate(aendern);
  await neuLaden(p);
  const da = await aktiv(p);
  const zustand = await p.evaluate(() => history.state);
  check(vorher && vorher.focus && !da.fokus && da.tab === 'dashboard' && zustand && !zustand.focus,
    `${name}: Dashboard, und der Verlauf steht nicht mehr auf der Fokusansicht (${JSON.stringify(zustand)})`);
  await p.goBack();
  await p.waitForTimeout(300);
  const zurueck10 = p.url().startsWith('about:') ? { tab: p.url() } : await aktiv(p);
  check(zurueck10.tab === 'stats',
    `${name}: ein Zurück führt zur Statistik, wo man vorher war (${zurueck10.tab})`);
  return { c, p };
}
const gestrig = await ohneFortsetzen('Einheit von gestern', () => {
  const st = JSON.parse(localStorage.getItem('workout.state.v1'));
  st.clock = { ...(st.clock || {}), on: new Date(Date.now() - 86400000).toISOString().slice(0, 10) };
  localStorage.setItem('workout.state.v1', JSON.stringify(st));
  window.Storage.prototype.setItem = () => {};
});
// Und die Zurück-Taste arbeitet danach wie immer: wieder ins Training, und
// ein Zurück führt aus der Fokusansicht aufs Dashboard.
const w10 = gestrig.p;
await w10.locator('.tab[data-tab="dashboard"]').click();
await w10.waitForTimeout(250);
await w10.locator('[data-act="start-session"]').first().click();
await w10.waitForTimeout(300);
const wieder = await aktiv(w10);
await w10.goBack();
await w10.waitForTimeout(300);
const raus = await aktiv(w10);
check(wieder.fokus && !raus.fokus && raus.tab === 'dashboard',
  'danach führt Zurück aus der Fokusansicht wieder aufs Dashboard');
await gestrig.c.close();
const vorbei = await ohneFortsetzen('Einheit schon vorbei', () => {
  const st = JSON.parse(localStorage.getItem('workout.state.v1'));
  st.session = null;
  localStorage.setItem('workout.state.v1', JSON.stringify(st));
  window.Storage.prototype.setItem = () => {};
}, true);
await vorbei.c.close();
// Der Start hat etwas zu sagen (`startHinweis`): Hier ein Plan-Update – die
// Einheit läuft heute noch, aber der Hinweis steht auf dem Dashboard.
const hinweis = await ohneFortsetzen('Hinweis beim Start (Plan-Update)', () => {
  const st = JSON.parse(localStorage.getItem('workout.state.v1'));
  const f = st.focus || 'standard';
  st.planStand = { ...(st.planStand || {}), [f]: 'ein-alter-stand' };
  localStorage.setItem('workout.state.v1', JSON.stringify(st));
  window.Storage.prototype.setItem = () => {};
});
check(await hinweis.p.evaluate(async () => !!(await import('./js/store.js')).getState().planUmbau),
  'Hinweis beim Start: der Planwechsel wurde wirklich erkannt');
await hinweis.c.close();

console.log(`\n${fails ? fails + ' FEHLER' : 'alle Prüfungen bestanden'}`);
console.log('ERRORS:', errs.length ? errs : 'none');
if (errs.length) process.exitCode = 1;
await browser.close();
