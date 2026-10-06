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
  // Je Karte die Meta-Zeile („3 + 1 × …") und, falls da, die Herkunftszeile
  // darunter („+1 nachgeholt: …") – zusammen ist das, was an der Übung steht.
  return page.locator('article.ex').evaluateAll((els) => els.map((el) => {
    const t = (s) => ((el.querySelector(s) || {}).textContent || '').replace(/\s+/g, ' ').trim();
    return { name: t('.ex-name'), meta: [t('.ex-meta'), t('.nach-warum')].filter(Boolean).join(' · ') };
  }));
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
// Einheit 1 abgeschlossen, aber die letzten drei Übungen gar nicht angefasst.
//
// Drei, nicht zwei: Mit zwei fehlten Bauch und Waden, und Einheit 2 bekam
// „+1 nachgeholt" beim Split Squat – für einen Bauchanteil von 0,25, während
// Oberschenkel und Gesäß, für die man ihn macht, nichts vermissten. Genau
// solche Sätze schließt NACH_ANTEIL jetzt aus (Prüfung 8). Mit drei fehlt
// auch die seitliche Schulter, und Einheit 2 holt mit dem Schulterdrücken
// etwas nach, das sich lohnt.
const halb = await protokoll(0, 1, 3);
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
// Hier prüfte ein /nachgeholt/ über die ganze Ansicht – das wurde allein durch
// die Zeile an der Übung grün, der Kopf selbst sagte nichts. Jetzt steht er
// als „12 + 3 Sätze" da, und genau das wird geprüft.
const kopf = ((await page.locator('.hero-sub').first().textContent()) || '').replace(/\s+/g, ' ');
check(new RegExp(`\\+ ${summe} Sätze`).test(kopf),
  `es steht auch im Kopf der Einheit, nicht nur an der Übung („${kopf.trim()}")`);

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
  // Die Satzzahl („3 + 1 Sätze") und die Zeile darunter („+1 nachgeholt …").
  const m = (await page.locator('.focus-meta').first().textContent()
    .catch(() => '') || '').replace(/\s+/g, ' ');
  const z = (await page.locator('.nach-warum').first().textContent()
    .catch(() => '') || '').replace(/\s+/g, ' ');
  if (/\d \+ \d Sätze/.test(m) && /nachgeholt/.test(z)) { gefunden = true; console.log('     im Training:', m, '/', z); break; }
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
// Die Grundzahl steht vorn – mit Nacharbeit als „3 + 1 ×".
const basis = sieben.map((x) => Number((x.meta.match(/^(\d+)(?: \+ \d+)? ×/) || [])[1] || 0));
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

// --- 7. Der nachgeholte Satz bleibt, bis er gemacht ist -----------------
//
// Workout 4 bekam „+1 nachgeholt" auf Schulterdrücken und Crunches, 17 Sätze.
// Nach dem dritten Crunch-Satz endete die Einheit von selbst bei 16/17 und
// meldete „Alle 15 Sätze stehen": Sobald alle *Grund*sätze standen, rechnete
// nacharbeit() die Einheit als fertig und strich das +1. Ob ein angesagter
// Satz drankam, hing nur daran, wo seine Übung in der Reihenfolge lag.
//
// Hier der schlimmste Fall: Die Grundsätze zuerst, die Nachholsätze ganz am
// Ende – so, wie sie mit Supersätzen immer liegen.
await saen(halb);
await einheit(2);
await page.locator('[data-act="start-session"]').first().click();
await page.waitForTimeout(400);
await page.locator('[data-act="focus-list"]').first().click();
await page.waitForTimeout(300);
const plan2 = await page.evaluate(async () => {
  const { workoutByNo } = await import('./js/plan.js');
  return workoutByNo(2, 'db').ex.map((x) => ({ id: x.id, sets: x.sets, nach: x.nach || 0 }));
});
const nachSaetze = plan2.reduce((a, x) => a + x.nach, 0);
const gesamt = plan2.reduce((a, x) => a + x.sets, 0);
console.log('     Einheit 2:', plan2.map((x) => `${x.id} ${x.sets}${x.nach ? `(+${x.nach})` : ''}`).join(', '));
check(nachSaetze > 0, `Einheit 2 trägt Nacharbeit (${nachSaetze} Sätze, ${gesamt} insgesamt)`);
const tippe = async (id, i) => {
  await page.locator(`[data-act="toggle-set"][data-ex="${id}"][data-i="${i}"]`).first().click();
  await page.waitForTimeout(60);
};
for (const x of plan2) for (let i = 0; i < x.sets - x.nach; i++) await tippe(x.id, i);
const nachGrund = await page.evaluate(async () => {
  const store = await import('./js/store.js');
  const { progressOf, workoutByNo } = await import('./js/plan.js');
  return {
    prog: progressOf(2, 'db'),
    laeuft: !!store.getState().session,
    nach: workoutByNo(2, 'db').ex.reduce((a, x) => a + (x.nach || 0), 0),
  };
});
console.log('     nach allen Grundsätzen:', JSON.stringify(nachGrund));
check(nachGrund.nach === nachSaetze,
  `alle Grundsätze stehen, die Nacharbeit bleibt angesagt (${nachGrund.nach} von ${nachSaetze})`);
check(!nachGrund.prog.complete && nachGrund.laeuft && nachGrund.prog.total === gesamt,
  `die Einheit läuft weiter, ${nachGrund.prog.done}/${nachGrund.prog.total} – nicht von selbst beendet`);
for (const x of plan2) for (let i = x.sets - x.nach; i < x.sets; i++) await tippe(x.id, i);
await page.waitForTimeout(200);
const amEnde = await page.evaluate(async () => {
  const store = await import('./js/store.js');
  const { progressOf } = await import('./js/plan.js');
  return { prog: progressOf(2, 'db'), laeuft: !!store.getState().session,
           done: (store.getState().log[2] || {}).done || null,
           toast: document.getElementById('toast').textContent };
});
console.log('     am Ende:', JSON.stringify(amEnde));
check(amEnde.done && !amEnde.laeuft, 'mit dem letzten Nachholsatz ist die Einheit fertig');
check(amEnde.prog.done === gesamt && amEnde.prog.total === gesamt,
  `und der Fortschritt zählt die Nacharbeit mit (${amEnde.prog.done}/${amEnde.prog.total})`);
check(new RegExp(`alle ${gesamt} Sätze`).test(amEnde.toast),
  `der Abschluss nennt alle ${gesamt} Sätze („${amEnde.toast}")`);

// --- 8. Ein Nachholsatz muss überwiegend Rückstand schließen ------------
//
// Gemessen im Cut: In Workout 3 blieben Rudern, Goblet Squat und Hammercurls
// liegen – Rücken, Beine, Bizeps. Workout 4 bekam „+1 nachgeholt" beim
// Sitzenden Schulterdrücken, weil dessen Nackenanteil (0,3) eine Lücke traf.
// Vordere Schulter und Trizeps, für die man den Satz macht, fehlten nicht.
// Jetzt zählt der Satz nur, wenn mindestens die Hälfte seiner direkten
// Anteile in den Rückstand geht (NACH_ANTEIL in js/plan.js).
await page.addInitScript(() => localStorage.setItem('workout.state.v1', JSON.stringify(
  { greeted: true, name: 'T', level: 'geuebt', focus: 'cut', shift: 0, log: {} })));
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(300);
const cutLog = await page.evaluate(async () => {
  const { PLAN } = await import('./js/data.js');
  const p = await import('./js/plan.js');
  const log = {};
  PLAN.slice(0, 3).forEach((w, i) => {
    const e = { mode: 'db', done: 'db', soll: {}, db: {} };
    p.exBasis(w, 'db').forEach((it, j) => {
      e.soll[it.id] = it.sets;
      // W1 und W2 ganz, W3 nach dem ersten Paar und einem Satz der dritten Übung.
      const n = i < 2 ? it.sets : (j < 2 ? it.sets : (j === 2 ? 1 : 0));
      if (n) e.db[it.id] = Array.from({ length: it.sets }, (_, k) => ({ w: '20', done: k < n }));
    });
    log[w.n] = e;
  });
  return log;
});
await page.addInitScript((log) => localStorage.setItem('workout.state.v1', JSON.stringify(
  { greeted: true, name: 'T', level: 'geuebt', focus: 'cut', shift: 0, log })), cutLog);
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(300);
const cut4 = await page.evaluate(async () => {
  const { PLAN, REST } = await import('./js/data.js');
  const p = await import('./js/plan.js');
  const { EX_BY_ID } = await import('./js/uebung.js');
  const w = PLAN[3];
  const { fehlt } = p.offenInWoche(w);
  const extra = p.nacharbeit(w, 'db');
  return {
    fehlt,
    nach: extra ? [...extra.keys()] : [],
    // Je nachgeholter Übung: Anteil, der in den Rückstand geht, gegen ihre direkten Anteile.
    quote: (extra ? [...extra.keys()] : []).map((id) => {
      const sh = EX_BY_ID.get(id).db.shares;
      const wert = Object.entries(sh).reduce((a, [m, s]) => a + Math.min(s, fehlt[m] || 0), 0);
      const direkt = Object.values(sh).filter((s) => s >= REST.direct).reduce((a, s) => a + s, 0);
      return { id, q: wert / direkt };
    }),
  };
});
console.log('     Cut, Workout 4:', JSON.stringify(cut4));
check(cut4.nach.length > 0, `Workout 4 holt weiter nach, was sich lohnt (${cut4.nach.join(', ')})`);
check(!cut4.nach.includes('sitzendes-schulterdruecken'),
  'aber kein Schulterdrücken für 0,3 Sätze Nacken');
check(cut4.quote.every((x) => x.q >= 0.5),
  `jeder Nachholsatz schließt überwiegend Rückstand (${cut4.quote.map((x) => `${x.id} ${x.q.toFixed(2)}`).join(', ')})`);

// --- 9. Gemachte Nacharbeit zählt – derselbe Rückstand kommt nicht zweimal ---
//
//     „Jetzt vier Sätze je Übung? Wegen Wiederholung? Aber vorgestern hab ich
//      ja goblet sqauds gemacht"
//
// Tobi, Montag, Workout 7 im Cut: Goblet Squat mit „4 Sätze … +1 nachgeholt".
// Am Samstag (Workout 6) stand derselbe Goblet Squat schon mit +1 da – für das
// Kreuzheben, das am Donnerstag (Workout 5) einen Satz zu kurz blieb –, und er
// hat alle vier gemacht. offenInWoche() maß Workout 6 aber nur an seiner
// Grundzahl: Der vierte Haken wurde abgeschnitten, nie gegen das Loch vom
// Donnerstag gerechnet, und Workout 7 bekam denselben Rückstand noch einmal.
//
// Eigener Kontext mit fester Uhr (Mo 05.10.2026, 17:40) und Tobis
// Einstellungen: Cut, Hanteln, Supersätze an.
const ctx2 = await browser.newContext({ viewport: { width: 414, height: 896 }, serviceWorkers: 'block' });
const p2 = await ctx2.newPage();
p2.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message));
p2.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()); });
p2.on('dialog', (d) => d.accept().catch(() => {}));
await p2.clock.setFixedTime(new Date('2026-10-05T15:40:00Z'));

/**
 * Den Zustand genau einmal säen – beim nächsten Laden, danach nicht mehr.
 *
 * Ein gewöhnliches Init-Skript säte bei *jedem* Laden neu; für die Fälle hier
 * reicht das, aber der Ablauf über die Oberfläche (unten) lädt zwischen
 * Donnerstag, Samstag und Montag neu und braucht, was die App selbst
 * geschrieben hat. Jede Saat hat deshalb eine eigene Marke in sessionStorage.
 */
let saat = 0;
const saeEinmal = async (z) => {
  const marke = `saat-${++saat}`;
  await p2.addInitScript(([s, mk]) => {
    if (sessionStorage.getItem(mk)) return;
    sessionStorage.setItem(mk, '1');
    localStorage.setItem('workout.state.v1', JSON.stringify(s));
  }, [z, marke]);
  await p2.goto(URL, { waitUntil: 'networkidle' });
  await p2.waitForTimeout(250);
};

await p2.goto(URL, { waitUntil: 'networkidle' });
const tobi = await p2.evaluate(async () => {
  const { PLANS } = await import('./js/data.js');
  return {
    greeted: true, setupDone: true, name: 'Tobi', focus: 'cut', mode: 'db', supersatz: true,
    level: 'geuebt', shift: 31,
    planStand: { cut: PLANS.cut.stand }, planSaetze: { cut: PLANS.cut.saetze },
  };
});
await saeEinmal({ ...tobi, log: {} });

/**
 * Ein Protokoll wie die App es schreibt: `soll` für jede Übung, `nach`,
 * `nachFest`. `spez[n]`: { tag, offen (kein done), haken {id: k},
 * soll {id: k}, nach {id: k}, weg [ids ohne Stempel], ohneNachFest }.
 */
const tagDer = { 1: '2026-09-24', 2: '2026-09-26', 3: '2026-09-28', 4: '2026-09-29',
  5: '2026-10-01', 6: '2026-10-03' };
const baue = (spez) => p2.evaluate(async ([sp, tage]) => {
  const P = await import('./js/plan.js');
  const { PLAN } = await import('./js/data.js');
  const log = {};
  Object.entries(sp).forEach(([n, s]) => {
    const e = { mode: 'db', soll: {}, nach: {}, nachFest: { db: {}, bw: {} }, db: {}, bw: {},
      startedOn: s.tag || tage[n] };
    if (!s.offen) e.done = 'db';
    P.exBasis(PLAN[n - 1], 'db').forEach((it) => {
      if ((s.weg || []).includes(it.id)) return;
      const extra = (s.nach || {})[it.id] || 0;
      const soll = (s.soll || {})[it.id] ?? it.sets + extra;
      const k = (s.haken || {})[it.id] ?? soll;
      e.soll[it.id] = soll;
      e.nach[it.id] = extra;
      if (extra) { e.nachFest.db[it.id] = extra; e.nachFest.bw[it.id] = extra; }
      e.db[it.id] = Array.from({ length: soll }, (_, i) => ({ w: i < k ? '12' : '', done: i < k }));
    });
    if (s.ohneNachFest) delete e.nachFest;
    log[n] = e;
  });
  return log;
}, [spez, tagDer]);
const voll = { 1: {}, 2: {}, 3: {}, 4: {} };

/** Workout 7 so, wie es auf dem Bildschirm steht – Liste, Fokus und Rechnung. */
const sieben7 = async (spez) => {
  await saeEinmal({ ...tobi, log: await baue(spez) });
  await p2.waitForTimeout(150);
  const zurUebersicht = p2.locator('[data-act="focus-list"]');
  if (await zurUebersicht.count()) { await zurUebersicht.first().click(); await p2.waitForTimeout(150); }
  for (let i = 0; i < 20; i++) {
    const txt = (await p2.locator('.hero-eyebrow').first().textContent().catch(() => '')) || '';
    const jetzt = Number((txt.match(/Workout (\d+)/) || [])[1] || 0);
    if (jetzt === 7) break;
    const knopf = p2.locator(`[data-act="nav-workout"][data-delta="${jetzt < 7 ? 1 : -1}"]:not([disabled])`);
    if (!(await knopf.count())) break;
    await knopf.first().click();
    await p2.waitForTimeout(120);
  }
  const rechnung = await p2.evaluate(async () => {
    const P = await import('./js/plan.js');
    const { PLAN } = await import('./js/data.js');
    const na = P.nacharbeit(PLAN[6], 'db');
    const { fehlt, summe } = P.offenInWoche(PLAN[6]);
    return { nach: na ? Object.fromEntries(na) : null, fehlt, summe };
  });
  await p2.locator('[data-act="show-list"]').click();
  await p2.waitForTimeout(200);
  const namen = await p2.locator('.ex-name').allTextContents();
  // Die Herkunftszeile der Nacharbeit, falls die Karte eine hat.
  const karten = await p2.locator('article.ex').evaluateAll((els) => els.map((el) => {
    const z = el.querySelector('.nach-warum');
    return z ? z.textContent.replace(/\s+/g, ' ') : '';
  }));
  const metas = await p2.locator('.ex-meta').allTextContents();
  const liste = namen.map((nm, i) => ({ name: nm.trim(), meta: (metas[i] || '').replace(/\s+/g, ' ').trim(), karte: karten[i] || '' }));
  await p2.locator('[data-act="start-session"]').first().click();
  await p2.waitForTimeout(300);
  const kopf = ((await p2.locator('.focus-count').first().textContent().catch(() => '')) || '').replace(/\s+/g, ' ');
  return { ...rechnung, liste, kopf };
};
const goblet = (r) => r.liste.find((x) => /^Goblet Squat$/.test(x.name)) || { meta: '', karte: '' };
const mitNach = (x) => /nachgeholt|\d \+ \d/.test(`${x.meta} ${x.karte}`);
const zeigeR = (t, r) => console.log(`     ${t}: nacharbeit ${JSON.stringify(r.nach)} · ${r.kopf.trim()} · Goblet „${goblet(r).meta}"`);

// (a) Donnerstag Kreuzheben 2/3, Samstag Goblet 4/4 mit dem angesagten +1.
const w5Loch = { haken: { 'rumaenisches-kreuzheben': 2 } };
const w6Mit = { soll: { 'goblet-squat': 4 }, nach: { 'goblet-squat': 1 } };
const ra = await sieben7({ ...voll, 5: w5Loch, 6: w6Mit });
zeigeR('(a) +1 am Sa gemacht', ra);
check(!(ra.nach && ra.nach['goblet-squat']), '(a) der am Samstag gemachte Nachholsatz zählt: kein zweites +1 auf den Goblet Squat');
check(!mitNach(goblet(ra)), `(a) Goblet Squat steht mit seiner Grundzahl da („${goblet(ra).meta}")`);
check(/0\/12 Sätze/.test(ra.kopf), `(a) Workout 7 hat 12 Sätze („${ra.kopf.trim()}")`);
check(ra.nach === null, `(a) und gar keine Nacharbeit (${JSON.stringify(ra.nach)})`);

// (b) Dasselbe, aber das +1 am Samstag liegen gelassen (3/4): Der Rückstand
// vom Donnerstag ist dann nicht geschlossen – das gewollte Verhalten bleibt.
const rb = await sieben7({ ...voll, 5: w5Loch, 6: { ...w6Mit, haken: { 'goblet-squat': 3 } } });
zeigeR('(b) +1 am Sa liegen gelassen', rb);
check(rb.nach && rb.nach['goblet-squat'] === 1, '(b) liegen gelassenes +1: Workout 7 holt das Kreuzheben-Loch weiter über den Goblet Squat nach');

// (c) Samstag angefangen, aber nicht abgeschlossen (die letzten zwei Übungen
// offen, kein „Abschließen"), Workout 7 direkt geöffnet. Der offene Rest ist
// Zukunft – die schon gemachte Nacharbeit aber nicht.
const rc = await sieben7({ ...voll, 5: w5Loch,
  6: { ...w6Mit, offen: true, haken: { 'haengendes-knieheben': 0, 'reverse-fly': 0 } } });
zeigeR('(c) Sa offen', rc);
check(!(rc.nach && rc.nach['goblet-squat']), '(c) auch aus einer offenen Einheit zählt die gemachte Nacharbeit');

// (d) Stufenkanten. Gemessen wird am gespeicherten Vermerk (`nach`), nicht an
// „soll minus heutige Satzzahl".
//   d1: An jenem Tag 2 Grundsätze + 1 nachgeholt (soll 3, nach 1), heute
//       stünden 3 Grundsätze; 3 Haken. Kein Rückstand, nichts doppelt.
const rd1 = await sieben7({ ...voll, 5: {}, 6: { soll: { 'goblet-squat': 3 }, nach: { 'goblet-squat': 1 } } });
zeigeR('(d1) soll 3 = 2 + 1, 3 Haken', rd1);
check(rd1.summe === 0 && rd1.nach === null, `(d1) Stufenkante soll 3 = 2 + 1: kein Rückstand (${JSON.stringify(rd1.fehlt)})`);
//   d2: dasselbe mit nur 2 Haken – das liegen gelassene +1 ist kein Rückstand.
const rd2 = await sieben7({ ...voll, 5: {},
  6: { soll: { 'goblet-squat': 3 }, nach: { 'goblet-squat': 1 }, haken: { 'goblet-squat': 2 } } });
zeigeR('(d2) soll 3 = 2 + 1, 2 Haken', rd2);
check(rd2.summe === 0 && rd2.nach === null, `(d2) ein liegen gelassener Nachholsatz wird nicht nachgeholt (${JSON.stringify(rd2.fehlt)})`);
//   d3: An jenem Tag 4 *Grund*sätze (soll 4, nach 0), heute 3. Der vierte
//       Haken ist keine Nacharbeit und darf das Kreuzheben-Loch nicht schließen.
const rd3 = await sieben7({ ...voll, 5: w5Loch, 6: { soll: { 'goblet-squat': 4 } } });
zeigeR('(d3) soll 4 ohne Nacharbeit', rd3);
check(rd3.nach && rd3.nach['goblet-squat'] === 1, '(d3) ein vierter Grundsatz aus einer höheren Stufe wird nicht als Nacharbeit gutgeschrieben');

// --- 10. Was am Tag nicht dastand, schuldet der Tag nicht ---------------
//
// Seit v216 legt die Fokusansicht beim Öffnen die ganze Einheit an, die Liste
// jede Karte: Jede Übung, die an dem Tag auf dem Bildschirm stand, hat einen
// Stempel in `soll`. Fehlt er in einer Einheit mit `nachFest` (ab v233), hat
// eine Beschwerde oder ein Termin die Übung an dem Tag gestrichen. Fällt der
// Grund später weg, darf sie nicht rückwirkend „ganz offen" heißen.
const re = await sieben7({ ...voll, 5: {}, 6: { weg: ['goblet-squat'] } });
zeigeR('(e) Goblet am Sa nicht da, nachFest', re);
check(!(re.nach && re.nach['goblet-squat']), '(e) eine Übung, die am Samstag nicht dastand, zählt nicht rückwirkend als offen');
check(/0\/12 Sätze/.test(re.kopf), `(e) Workout 7 bleibt bei 12 Sätzen („${re.kopf.trim()}")`);
// (f) Dieselbe Einheit ohne nachFest – ein Stand von vor v233. Dort heißt ein
// fehlender Stempel weiter „stand da, nicht angefasst". Das ist die Grenze.
const rf = await sieben7({ ...voll, 5: {}, 6: { weg: ['goblet-squat'], ohneNachFest: true } });
zeigeR('(f) dasselbe ohne nachFest', rf);
check(rf.nach && rf.nach['goblet-squat'] === 1, '(f) ohne nachFest (Altbestand) bleibt die bisherige Lesart');

// --- 11. Tobis Ablauf über die Oberfläche --------------------------------
//
// Donnerstag Workout 5 über die Liste, Kreuzheben nur 2 von 3. Samstag
// Workout 6 nur über die Fokusknöpfe, wie die App im Supersatz weiterspringt:
// Goblet 4/4 (mit dem angesagten +1), 3 Liegestütze, 1 Chin-up, 1 Knieheben,
// dann „Abschließen". Montag: Workout 7.
const hake = async (id, k) => {
  for (let i = 0; i < k; i++) {
    const l = p2.locator(`[data-act="toggle-set"][data-ex="${id}"][aria-pressed="false"]`);
    if (!(await l.count())) break;
    await l.first().click();
    await p2.waitForTimeout(90);
    if (await p2.locator('[data-act="focus-list"]').count()) {
      await p2.locator('[data-act="focus-list"]').first().click();
      await p2.waitForTimeout(100);
    }
  }
};
const zuEinheit = async (n) => {
  const zurueck = p2.locator('[data-act="focus-list"]');
  if (await zurueck.count()) { await zurueck.first().click(); await p2.waitForTimeout(100); }
  const zu = p2.locator('[data-act="hide-list"]');
  if (await zu.count()) { await zu.first().click(); await p2.waitForTimeout(100); }
  for (let i = 0; i < 20; i++) {
    const txt = (await p2.locator('.hero-eyebrow').first().textContent().catch(() => '')) || '';
    const jetzt = Number((txt.match(/Workout (\d+)/) || [])[1] || 0);
    if (jetzt === n) return;
    const knopf = p2.locator(`[data-act="nav-workout"][data-delta="${jetzt < n ? 1 : -1}"]:not([disabled])`);
    if (!(await knopf.count())) return;
    await knopf.first().click();
    await p2.waitForTimeout(100);
  }
};
await p2.clock.setFixedTime(new Date('2026-10-01T16:00:00Z'));
await saeEinmal({ ...tobi, shift: 31, log: await baue(voll) });
await zuEinheit(5);
await p2.locator('[data-act="start-session"]').first().click();
await p2.waitForTimeout(300);
await p2.locator('[data-act="focus-list"]').first().click();
await p2.waitForTimeout(200);
const liste5 = await p2.evaluate(async () => {
  const { workoutByNo } = await import('./js/plan.js');
  return workoutByNo(5, 'db').ex.map((x) => [x.id, x.sets]);
});
for (const [id, k] of liste5) await hake(id, id === 'rumaenisches-kreuzheben' ? 2 : k);
await p2.locator('[data-act="finish-session"]').first().click();
await p2.waitForTimeout(250);

await p2.clock.setFixedTime(new Date('2026-10-03T16:00:00Z'));
await p2.reload({ waitUntil: 'networkidle' });
await p2.waitForTimeout(250);
await zuEinheit(6);
await p2.locator('[data-act="start-session"]').first().click();
await p2.waitForTimeout(300);
const folge = [];
for (let i = 0; i < 9; i++) {
  const name = ((await p2.locator('.focus-name').first().textContent().catch(() => '')) || '').trim();
  const knopf = p2.locator('.focus-set[aria-pressed="false"]');
  if (!(await knopf.count())) break;
  await knopf.first().click();
  await p2.waitForTimeout(120);
  folge.push(name);
}
await p2.locator('[data-act="finish-session"]').first().click();
await p2.waitForTimeout(250);
const sa = await p2.evaluate(() => {
  const e = JSON.parse(localStorage.getItem('workout.state.v1')).log[6];
  return { done: e.done, soll: e.soll, haken: Object.fromEntries(Object.entries(e.db)
    .map(([id, a]) => [id, a.filter((x) => x.done).length])) };
});
console.log('     Sa, Workout 6:', JSON.stringify(sa));
check(sa.done === 'db' && sa.soll['goblet-squat'] === 4 && sa.haken['goblet-squat'] === 4
  && sa.haken['chin-ups'] === 1 && sa.haken['haengendes-knieheben'] === 1 && !sa.haken['reverse-fly'],
'Samstag wie bei Tobi: Goblet 4/4 mit +1, 1 Chin-up, 1 Knieheben, abgeschlossen');

await p2.clock.setFixedTime(new Date('2026-10-05T15:40:00Z'));
await p2.reload({ waitUntil: 'networkidle' });
await p2.waitForTimeout(250);
await zuEinheit(7);
const mo = await p2.evaluate(async () => {
  const { workoutByNo } = await import('./js/plan.js');
  return workoutByNo(7, 'db').ex.map((x) => ({ id: x.id, sets: x.sets, nach: x.nach || 0 }));
});
await p2.locator('[data-act="start-session"]').first().click();
await p2.waitForTimeout(300);
const moKopf = ((await p2.locator('.focus-count').first().textContent().catch(() => '')) || '').replace(/\s+/g, ' ').trim();
const moName = ((await p2.locator('.focus-name').first().textContent().catch(() => '')) || '').trim();
const moMeta = ((await p2.locator('.focus-meta').first().textContent().catch(() => '')) || '').replace(/\s+/g, ' ').trim();
console.log(`     Mo, Workout 7: ${moKopf} · ${moName}: ${moMeta}`);
console.log('     ', mo.map((x) => `${x.id} ${x.sets}${x.nach ? `(+${x.nach})` : ''}`).join(', '));
const g7 = mo.find((x) => x.id === 'goblet-squat') || {};
check(g7.sets === 3 && !g7.nach, `Montag: Goblet Squat mit 3 Sätzen, ohne zweites +1 (${g7.sets}${g7.nach ? ` +${g7.nach}` : ''})`);
check(moName !== 'Goblet Squat' || !/nachgeholt|\d \+ \d/.test(moMeta), `und so steht er auch im Training da („${moMeta}")`);
check(/0\/15 Sätze/.test(moKopf), `die liegen gebliebenen Klimmzüge und Reverse Fly werden weiter nachgeholt („${moKopf}")`);
check(['einarmiges-kh-rudern', 'face-pull', 'sz-curls'].every((id) => (mo.find((x) => x.id === id) || {}).nach === 1),
  'mit +1 auf Rudern, Face Pull und SZ-Curls');
console.log('     Sa-Folge im Supersatz:', folge.join(' → '));
await ctx2.close();

check(errs.length === 0, `keine Fehler${errs.length ? ': ' + errs.slice(0, 2).join(' | ') : ''}`);
console.log(`\n${fails ? fails + ' FEHLER' : 'alle Prüfungen bestanden'}`);
await browser.close();
