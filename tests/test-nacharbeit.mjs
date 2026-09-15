/*
 * Der Plan passt sich an, wenn eine Einheit nicht zu Ende gemacht wurde.
 *
 * Vorher passierte gar nichts: „Abschließen" zählt den Tag als trainiert, und
 * die fehlenden Sätze verschwanden ersatzlos. Das Wochenziel je Muskelgruppe,
 * auf das dieser Plan exakt gerechnet ist, stimmte danach nicht mehr – und
 * niemand erfuhr davon.
 *
 * Was diese Woche liegen bleibt, kommt auf die nächsten Einheiten derselben
 * Woche – gedeckelt, und niemals über die Wochengrenze hinaus.
 *
 * **Nur nach oben.** Eine zweite Hälfte hätte die Einheiten von selbst gekürzt,
 * wenn jemand sie regelmäßig nicht zu Ende macht. Die ist wieder raus, auf
 * ausdrücklichen Wunsch; Prüfung 5 hält fest, dass die Erfahrungsstufe
 * unangetastet bleibt.
 *
 * Die wichtigste Prüfung ist die erste: dass nichts passiert, wenn alles normal
 * läuft. Ein Plan, der bei jeder Kleinigkeit an sich herumschraubt, wäre
 * schlimmer als einer, der stehen bleibt.
 */
import { chromium } from 'playwright';
import { URL } from './umgebung.mjs';

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 414, height: 896 } });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()); });
page.on('dialog', (d) => d.accept().catch(() => {}));
let fails = 0;
const check = (c, m) => { console.log(`${c ? 'OK  ' : 'FAIL'} ${m}`); if (!c) { fails++; process.exitCode = 1; } };

const setze = (z) => page.evaluate(
  (o) => localStorage.setItem('workout.state.v1', JSON.stringify(o)), z);

/**
 * Ein Protokoll für die Einheiten `von`..`bis` (Index, `bis` exklusiv), bei dem
 * je Einheit die letzten `auslassen` Übungen gar nicht angetippt wurden – genau
 * so sieht ein abgebrochenes Training im Speicher aus.
 */
const protokoll = (von, bis, auslassen) => page.evaluate(async ([a, b, weg]) => {
  const { PLAN } = await import('./js/data.js');
  const log = {};
  PLAN.slice(a, b).forEach((w) => {
    const e = { mode: 'db', done: 'db', soll: {}, db: {} };
    w.ex.slice(0, Math.max(1, w.ex.length - weg)).forEach((it) => {
      e.soll[it.id] = it.sets;
      e.db[it.id] = Array.from({ length: it.sets }, () => ({ w: '20', r: '', done: true }));
    });
    log[w.n] = e;
  });
  return log;
}, [von, bis, auslassen]);

await page.goto(URL, { waitUntil: 'networkidle' });

/**
 * Zur Einheit `n` blättern und ihre Übungszeilen lesen.
 *
 * Über die Knöpfe der App statt über einen internen Aufruf: Was hier geprüft
 * wird, soll das sein, was auch auf dem Bildschirm steht.
 */
const einheit = async (n) => {
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(250);
  const zurUebersicht = page.locator('[data-act="focus-list"]');
  if (await zurUebersicht.count()) { await zurUebersicht.first().click(); await page.waitForTimeout(150); }
  for (let i = 0; i < 20; i++) {
    const txt = (await page.locator('.hero-eyebrow').first().textContent().catch(() => '')) || '';
    const jetzt = Number((txt.match(/Workout (\d+)/) || [])[1] || 0);
    if (jetzt === n) break;
    const knopf = page.locator(`[data-act="nav-workout"][data-delta="${jetzt < n ? 1 : -1}"]:not([disabled])`);
    if (!(await knopf.count())) break;
    await knopf.first().click();
    await page.waitForTimeout(120);
  }
  await page.locator('[data-act="show-list"]').click();
  await page.waitForTimeout(250);
  const meta = await page.locator('.ex-meta').allTextContents();
  const namen = await page.locator('.ex-name').allTextContents();
  return namen.map((nm, i) => ({ name: nm.trim(), meta: (meta[i] || '').replace(/\s+/g, ' ') }));
};

// --- 1. Ohne Rückstand ändert sich nichts ------------------------------
await setze({ greeted: true, name: 'T', level: 'geuebt', shift: 0, log: {} });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(300);
await page.locator('[data-act="show-list"]').click();
await page.waitForTimeout(250);
const sauber = await page.locator('.ex-meta').allTextContents();
check(sauber.length > 0, `die erste Einheit steht (${sauber.length} Übungen)`);
check(!sauber.some((m) => /nachgeholt/.test(m)),
  'ohne Rückstand trägt keine Übung Nacharbeit');
const kopfSauber = (await page.locator('#view').textContent()).replace(/\s+/g, ' ');
check(!/nachgeholt/.test(kopfSauber), 'und im Kopf der Einheit steht auch nichts davon');

// --- 2. Eine abgebrochene Einheit wirkt auf die nächste derselben Woche --
// Einheit 1 abgeschlossen, aber die letzten zwei Übungen gar nicht angefasst.
const halb = await protokoll(0, 1, 2);
await setze({ greeted: true, name: 'T', level: 'geuebt', shift: 0, log: halb });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(400);
const zwei = await einheit(2);
const nachgeholt = zwei.filter((x) => /nachgeholt/.test(x.meta));
console.log('     Einheit 2:', zwei.map((x) => x.meta.split(' · ')[0]).join(' | '));
check(nachgeholt.length > 0,
  `Einheit 2 holt nach, was in Einheit 1 liegen blieb (${nachgeholt.length} Übungen)`);
const summe = nachgeholt.reduce((a, x) => a + Number((x.meta.match(/\+(\d+) nachgeholt/) || [])[1] || 0), 0);
check(summe > 0 && summe <= 3, `höchstens drei Sätze je Einheit (${summe})`);
check(nachgeholt.every((x) => /\+1 nachgeholt/.test(x.meta)),
  'und höchstens einer je Übung');
const kopf = (await page.locator('#view').textContent()).replace(/\s+/g, ' ');
check(/nachgeholt/.test(kopf), 'es steht auch im Kopf der Einheit, nicht nur an der Übung');

// --- 2b. Und im Training, nicht nur in der Liste ------------------------
//
//     „Kann's sein dass ein dritter Fersenerhöhter Goblet Squat kam weil ich
//      Supersatz angeklickt hab? Eigentlich waren ja nur zwei geplant."
//
// War es nicht – es war Nacharbeit. Aber in der Fokusansicht stand nur
// „3 Sätze", und dann sucht man den Grund da, wo man zuletzt etwas umgestellt
// hat. Der Hinweis muss dort stehen, wo man die Sätze abhakt.
await page.locator('[data-act="start-session"]').first().click();
await page.waitForTimeout(500);
let gefunden = false;
for (let k = 0; k < 8 && !gefunden; k++) {
  const m = (await page.locator('.focus-meta').first().textContent()
    .catch(() => '') || '').replace(/\s+/g, ' ');
  if (/nachgeholt/.test(m)) { gefunden = true; console.log('     im Training:', m); break; }
  const weiter = page.locator('[data-act="focus-step"][data-d="1"]:not([disabled])');
  if (!(await weiter.count())) break;
  await weiter.first().click();
  await page.waitForTimeout(250);
}
check(gefunden, 'auch im Training steht an der Übung, dass ein Satz nachgeholt wird');

// Und der Supersatz ändert daran nichts – er ordnet um, er rechnet nicht.
const summen = await page.evaluate(async () => {
  const store = await import('./js/store.js');
  const { PLAN } = await import('./js/data.js');
  const { exOf } = await import('./js/plan.js');
  return [false, true].map((su) => {
    store.setSetting('supersatz', su);
    return exOf(PLAN[1], 'db').reduce((a, x) => a + x.sets, 0);
  });
});
check(summen[0] === summen[1],
  `mit und ohne Supersatz dieselbe Satzzahl (${summen.join(' / ')})`);

// --- 3. Nicht über die Wochengrenze -------------------------------------
// Vier Einheiten sind eine Woche. Was in Einheit 1 fehlt, darf Einheit 5 nicht
// mehr belasten: Volumen wirkt dann, wenn es anfällt, nicht drei Wochen später.
const fuenf = await einheit(5);
check(!fuenf.some((x) => /nachgeholt/.test(x.meta)),
  'Einheit 5 steht in der nächsten Woche und bleibt unberührt');

// --- 4. Kein Aufschaukeln ------------------------------------------------
// Auch wenn die ganze erste Woche abgebrochen wurde, bleibt der Deckel stehen.
const dreiHalbe = await protokoll(0, 3, 2);
await setze({ greeted: true, name: 'T', level: 'geuebt', shift: 0, log: dreiHalbe });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(400);
const vier = await einheit(4);
const summe4 = vier.reduce((a, x) => a + Number((x.meta.match(/\+(\d+) nachgeholt/) || [])[1] || 0), 0);
console.log('     Einheit 4 nach drei abgebrochenen:', summe4, 'Sätze nachgeholt');
check(summe4 <= 3, `drei abgebrochene Einheiten sprengen die Einheit nicht (${summe4} Sätze)`);

// --- 5. Die Erfahrungsstufe bleibt unangetastet -------------------------
//
// Hier stand einmal die Gegenrichtung: Wer über mehrere Einheiten hinweg nur
// einen Teil schafft, dem hätte die App die Stufe von selbst gesenkt. Das ist
// wieder raus, auf ausdrücklichen Wunsch. Die Prüfung bleibt – als Zusage: Der
// Plan wird nicht hinter dem Rücken des Nutzers kleiner.
const sechs = await protokoll(0, 6, 2);
await setze({ greeted: true, name: 'T', level: 'geuebt', shift: 0, log: sechs });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(500);
const nachSechs = await page.evaluate(async () => {
  const s = (await import('./js/store.js')).getState();
  return { level: s.level, abstieg: s.abstieg, aufstieg: s.aufstieg };
});
check(nachSechs.level === 'geuebt',
  `sechs angebrochene Einheiten senken die Stufe nicht (${nachSechs.level})`);
check(!nachSechs.abstieg, 'und lösen keinen Hinweis über eine Kürzung aus');
const text5 = (await page.locator('#view').textContent()).replace(/\s+/g, ' ');
check(!/zu groß|heruntergestuft|gekürzt/.test(text5),
  'nirgends steht, dass der Plan verkleinert wurde');

// Die Sätze je Übung stehen weiter auf dem Wert der eingestellten Stufe.
const sieben = await einheit(7);
const basis = sieben.map((x) => Number((x.meta.match(/^(\d+) ×/) || [])[1] || 0));
console.log('     Sätze je Übung in Einheit 7:', basis.join(', '));
check(basis.every((n) => n >= 3), `Geübt bleibt bei drei Sätzen je Übung (${basis.join(',')})`);

// --- 6. Eine Einstellung erzeugt keine Arbeit ---------------------------
//
//     "Aber heute ist doch erst Dienstag? Montag stand ein Training an,
//      Dienstag nicht."
//
// Die Frage fuehrte auf einen echten Fehler. `offenInWoche` verglich das
// Protokoll einer fertigen Einheit mit der *heutigen* Satzzahl - und die haengt
// an der Erfahrungsstufe. Als die Anfaengerstufe von zwei auf drei Saetze ging,
// war damit jede vorher sauber zu Ende trainierte Einheit derselben Woche
// rueckwirkend um einen Satz je Uebung zu kurz. Die App erfand einen Rueckstand,
// den es nie gab, und legte ihn als "+1 nachgeholt" auf die naechste Einheit.
//
// Hier steht der Fall nach: zwei Einheiten, vollstaendig trainiert mit zwei
// Saetzen je Uebung, danach die Stufe auf Geuebt. Nichts darf nachzuholen sein.
const zweiSaetze = await page.evaluate(async () => {
  const { PLAN } = await import('./js/data.js');
  const log = {};
  PLAN.slice(0, 2).forEach((w) => {
    // `soll` ist der Stempel, den getSets() beim Anlegen setzt: An dem Tag
    // hatte jede Uebung zwei Saetze, und alle zwei stehen.
    const e = { mode: 'db', done: 'db', soll: {}, db: {} };
    w.ex.forEach((it) => {
      e.soll[it.id] = 2;
      e.db[it.id] = Array.from({ length: 2 }, () => ({ w: '20', done: true }));
    });
    log[w.n] = e;
  });
  return log;
});
// Gesaet wird ueber addInitScript und nicht ueber localStorage: Die App
// schreibt ihren Zustand beim Verlassen der Seite noch einmal weg, und dieser
// Nachzuegler ueberholt jedes von Hand gesetzte localStorage - beim ersten
// Anlauf genau so passiert, der Test las danach den Stand des vorigen Blocks.
// Ein Init-Skript laeuft vor dem App-Code und gewinnt deshalb immer.
const saen = (log) => page.addInitScript((z) => {
  localStorage.setItem('workout.state.v1', JSON.stringify(z));
}, { greeted: true, name: 'T', shift: 0, level: 'geuebt', log });
await saen(zweiSaetze);
const dritte = await einheit(3);
console.log('     Einheit 3 nach dem Stufenwechsel:', dritte.map((x) => x.meta).join(' | '));
check(dritte.length > 0, `die dritte Einheit steht (${dritte.length} Übungen)`);
check(!dritte.some((x) => /nachgeholt/.test(x.meta)),
  'ein Stufenwechsel erzeugt keinen Rückstand aus fertig trainierten Einheiten');

// Und der echte Fall bleibt erhalten: Wer wirklich Sätze offen lässt, bekommt
// sie nachgetragen – hier eine Einheit, in der ein Satz je Übung fehlt.
const einerFehlt = await page.evaluate(async () => {
  const { PLAN } = await import('./js/data.js');
  const log = {};
  PLAN.slice(0, 2).forEach((w) => {
    const e = { mode: 'db', done: 'db', soll: {}, db: {} };
    w.ex.forEach((it) => {
      e.soll[it.id] = 3;
      e.db[it.id] = Array.from({ length: 3 }, (_, i) => ({ w: '20', done: i < 2 }));
    });
    log[w.n] = e;
  });
  return log;
});
await saen(einerFehlt);
const dritteEcht = await einheit(3);
console.log('     mit echtem Rückstand:', dritteEcht.map((x) => x.meta).join(' | '));
check(dritteEcht.some((x) => /nachgeholt/.test(x.meta)),
  'ein wirklich offener Satz wird weiterhin nachgetragen');

check(errs.length === 0, `keine Fehler${errs.length ? ': ' + errs.slice(0, 2).join(' | ') : ''}`);
console.log(`\n${fails ? fails + ' FEHLER' : 'alle Prüfungen bestanden'}`);
await browser.close();
