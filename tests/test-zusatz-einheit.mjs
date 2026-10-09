/*
 * Der Zusatztag steckt in der Einheit des Tages.
 *
 *     „Was soll das mit zweite Einheit. Wenn heute Übungen dazu kommen dann
 *      soll alles flüssig in EINE Einheit"
 *
 * Tobi, Donnerstag 08.10.2026, Cut mit Hanteln, Supersätze an. Das Dashboard
 * zeigte „Heute · Workout 9 · Hanteln · 5 Übungen · 15 Sätze" und darunter
 * „↩︎ Als zweite Einheit heute: Zusatztag Woche 2, 2 Übungen. Öffnen". Am Tag
 * davor stand derselbe Zusatztag allein auf der Startseite, und die Frage war:
 *
 *     „Check ich nicht. Wann soll ich das machen?"
 *
 * Jetzt gehören seine Übungen zu Workout 9: ein Start, eine Liste, eine
 * Fokusansicht, Supersätze und Rüst-Reihenfolge über alle, ein Abschluss – und
 * an der Übung steht, woher sie kommt. Geprüft wird an Tobis echtem Stand
 * (tests/zusatz-tobi-do.json: W1–W8 trainiert, am Sa Chin-ups 1 von 3, der
 * Träger „Zusatztag Woche 2" aus v238 mit Pull-ups und Chin-ups):
 *
 *   Z1   Startansicht: ein Start, „5 + 1 Übungen · 15 + 2 Sätze", keine Zeile
 *        „zweite Einheit"; bis zum ersten Eintrag nichts im Protokoll.
 *   Z2   Liste und Herkunftszeile, auch für die Vorlesefunktion.
 *   Z3   Fokus „Übung 1 von 6", Festhalten mit dem ersten Haken, Paarung über
 *        alle, Neuladen. Z3b/Z3c: die beiden anderen Schreibwege.
 *   Z4   Abschluss erst nach allen 17 Sätzen; von Hand „15/17".
 *   Z5   Buchhaltung: Woche 3 bekommt nichts, Woche 2 bekommt den Zusatz.
 *   Z6   Liegen gelassen: kein zweiter Zusatztag, kein Rückstand.
 *   Z7   Abbrechen und Zurücksetzen holen den Zusatz neu gerechnet zurück.
 *   Z8   Planwechsel nach dem Festhalten.
 *   Z9   Gleichstand: bei gleichem Nutzen kein Umbau mehr.
 *   Z10  Tobis Auswahl: Chin-ups, keine Pull-ups.
 *   Z11  Die Erholungsregel nach dem ersten Satz.
 *   Z12  Am Tag des Wochenabschlusses kein Sprung; am Ruhetag danach allein.
 *   Z13  Mittwoch: kein Träger; Vorziehen bringt ihn mit.
 *   Z14  Moduswechsel vor und nach dem Festhalten.
 *   Z15  Sicherung, auch manipuliert.
 *   Z16  Kalender, Statistik, Eigene Workouts, Supersatz-Vorschau.
 *   Z17  Fortsetzen nach dem Neuladen im letzten Paar.
 *   Z18  Bodyweight.
 *   Z19  Nacharbeit und Zusatz in derselben Einheit.
 *   Z20  Kein Leersatz: zwei Chin-ups, nicht drei (1 → 9, 2 → 11, 3 → 11
 *        Gruppen im Ziel); allein bleibt die volle Satzzahl (Z12).
 *   Z21  „Von vorn beginnen" räumt den Träger der alten Runde weg, ein
 *        übrig gebliebener bindet nicht an Workout 1; „Verlauf zurückholen"
 *        rechnet sofort; ebenso eine Runde, die bei offener App weiterrollt.
 *   Z22  Klimmzugstange ab und an: Träger neu gerechnet, die Wochenkarte
 *        behauptet nichts, was nicht in der Einheit steht.
 *   Z23  Eine Sitzung auf dem Träger endet, wenn er in eine Einheit wandert.
 *   Z24  Termine: Der Zusatz trifft nichts, was der Tag schont – geladen,
 *        eingetragen, entfernt; fest und danach eingetragen nennt die Notiz ihn;
 *        Nebenanteile auf geschonten Gruppen sind kein Nutzen (Boxen).
 *   Z25  Fester Zusatz, dann Beschwerde oder fehlendes Gerät: Die Notiz nennt
 *        die weggefallene Übung.
 *
 *   Platz  Startansicht eine Seite, Fokus an den Chin-ups bis zu den Knöpfen
 *          über der Leiste – 414×896 und 360×740.
 *
 * Gegenprobe: gegen 4cd482d (v238) wird jeder Abschnitt rot, 76 Prüfungen
 * („5 Übungen · 15 Sätze", „Als zweite Einheit heute", Pull-ups + Chin-ups,
 * Abschluss nach 15). Einzeln zurückgedreht wird jede dieser Stellen rot
 * (ZUSATZ_NUR=… lässt nur die zugehörigen Abschnitte laufen): das Festhalten
 * in toggle-set (Z3), set-input (Z3b) und complete-workout (Z3c), der Filter
 * in protokolliert() (Z5, Z6), die Regel „vergeben" (Z6), die Neurechnung
 * nach dem Verwerfen (Z7), der Filter in festeListen() (Z8), die
 * Gleichstandsregel (Z9), die Neurechnung beim Vorziehen (Z13) und nach dem
 * Moduswechsel (Z14), der Nutzen ohne ruhende Gruppen (Z1) und der Beitrag des
 * festen Zusatzes zur Woche (Z5).
 *
 * Z20–Z25 kamen mit der Prüfung danach (gegen 2598ac7 rot): die kleinste
 * Satzzahl beim Einfügen (Z1, Z2, Z20), pruefeZusatztag() nach Neustart und
 * Zurückholen (Z21), die Bindung nur hinter einer Woche im Protokoll (Z21),
 * pruefeZusatztag() beim Gerät (Z22) und bei Terminen (Z24), keine Übungen
 * des Trägers an Stelle der angekommenen (Z22), die Sitzung beim Start und
 * in halteZusatz() (Z23), die Termine in ruhendeGruppen() (Z24 Boxen) und in
 * zusatzGrund() (Z24) und die weggefallene Zusatzübung in den Notizen (Z24, Z25).
 */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { URL, ROOT, SHOT } from './umgebung.mjs';

const VORLAGE = JSON.parse(readFileSync(path.join(ROOT, 'tests', 'zusatz-tobi-do.json'), 'utf8'));
const DO = '2026-10-08T17:00:00+02:00';
const kopie = (o) => JSON.parse(JSON.stringify(o));
const gleich = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const browser = await chromium.launch();
let fails = 0;
const check = (c, m) => { console.log(`${c ? 'OK  ' : 'FAIL'} ${m}`); if (!c) { fails++; process.exitCode = 1; } };

/**
 * Ein Fall in eigenem Kontext: Zustand vor dem ersten Laden gesät (und gegen
 * das, was die App beim Verlassen noch wegschreibt, durch eine Marke im
 * sessionStorage geschützt), Uhr fest auf `wann`.
 */
async function fall(name, zustand, wann = DO) {
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
  // Ohne Vibration: Eine Pause, die über ein Neuladen mit vorgestellter Uhr
  // abläuft, vibriert ohne Berührung, und Chrome meldet das als Fehler.
  await page.addInitScript(() => { navigator.vibrate = () => true; });
  /** Einen Zustand säen – genau einmal, beim nächsten Laden. */
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
    alle: async (sel) => (await page.locator(sel).allTextContents()).map((t) => t.replace(/\s+/g, ' ').trim()),
    lies: () => page.evaluate(() => JSON.parse(localStorage.getItem('workout.state.v1') || '{}')),
    /** Rechnen mit den Modulen der App – dieselben Instanzen, die die Seite benutzt. */
    M: (fn, arg) => page.evaluate(async ([src, a]) => {
      const m = {
        P: await import('./js/plan.js'), store: await import('./js/store.js'), D: await import('./js/data.js'),
        G: await import('./js/gewichte.js'), S: await import('./js/supersatz.js'), V: await import('./js/vorrat.js'),
        I: await import('./js/injuries.js'),
      };
      return (0, eval)(`(${src})`)(m, a);
    }, [fn.toString(), arg]),
    klick: async (sel, warte = 250) => {
      await page.locator(sel).first().click({ timeout: 3000 });
      await page.waitForTimeout(warte);
    },
    neuLaden: async (z) => {
      if (z) await saeen(z);
      await page.reload({ waitUntil: 'networkidle' });
      await page.waitForTimeout(300);
    },
    uhr: (iso) => page.clock.setFixedTime(new Date(iso)),
    tab: async (t) => { await page.locator(`.tab[data-tab="${t}"]`).click(); await page.waitForTimeout(250); },
    toast: async () => ((await page.locator('#toast').textContent()) || '').trim(),
  };
  return f;
}
async function ende(f) {
  check(f.errs.length === 0, `${f.name}: keine Fehler${f.errs.length ? ` – ${f.errs.slice(0, 2).join(' | ')}` : ''}`);
  offen.delete(f.ctx);
  await f.ctx.close();
}

/**
 * Ein Abschnitt für sich: Bricht er ab (ein Knopf, den es nicht gibt – etwa
 * gegen v238 in der Gegenprobe), ist das ein FAIL, und die übrigen laufen
 * trotzdem. Offene Kontexte werden dabei geschlossen.
 *
 * ZUSATZ_NUR=Z3,Z5 lässt nur diese Abschnitte laufen – für die Gegenproben
 * an einzelnen zurückgedrehten Stellen.
 */
const offen = new Set();
const nur = (process.env.ZUSATZ_NUR || '').split(',').filter(Boolean);
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

/** Alle offenen Sätze der Liste abhaken, deren Karte `wer(name)` erfüllt. */
async function listeAbhaken(f, wer, hoechstens = 99) {
  let k = 0;
  for (; k < hoechstens; k++) {
    const knopf = await f.page.evaluate((src) => {
      const passt = (0, eval)(`(${src})`);
      const karten = [...document.querySelectorAll('article.ex')];
      for (let i = 0; i < karten.length; i++) {
        const name = (karten[i].querySelector('.ex-name') || {}).textContent || '';
        if (!passt(name.trim())) continue;
        const b = karten[i].querySelector('.set-btn[aria-pressed="false"]');
        if (b) return [i, b.dataset.i];
      }
      return null;
    }, wer.toString());
    if (!knopf) break;
    await f.page.locator('article.ex').nth(knopf[0]).locator(`.set-btn[data-i="${knopf[1]}"]`).click();
    await f.page.waitForTimeout(80);
  }
  await f.page.waitForTimeout(200);   // gespeichert wird 120 ms später
  return k;
}

/** Was ein festgehaltener Zusatz bei Tobi heißen muss. */
const TOBI_ZUSATZ = {
  woche: 2,
  ex: [{ id: 'chin-ups', sets: 2, bwSets: 2 }],
  warum: { 'chin-ups': { g: ['lats', 'biceps'], q: [[6, 'chin-ups', 1, 3, 'db']] } },
};
const traeger = (st) => (st.customs || []).filter((c) => /^Zusatztag/.test(c.name));

/* ------------------------------------------------------------------ *
 * Z1 Startansicht, Z2 Liste – Donnerstag, unberührt
 * ------------------------------------------------------------------ */
await abschnitt('Z1', async () => {
  const f = await fall('Z1/Z2', VORLAGE);
  const eyebrow = await f.txt('.hero-eyebrow');
  const sub = await f.txt('.hero-sub');
  console.log(`     ${eyebrow} | ${sub}`);
  check(/Heute · Workout 9/.test(eyebrow), `Z1 die Einheit des Tages steht vorn („${eyebrow}")`);
  check(sub === 'Hanteln · 5 + 1 Übungen · 15 + 2 Sätze', `Z1 eine Einheit, der Zusatz im Kopf („${sub}")`);
  check(await f.page.locator('.zusatz-danach').count() === 0, 'Z1 keine Zeile „Als zweite Einheit heute"');
  check(!/zweite Einheit/.test(await f.txt('#view')), 'Z1 nirgends „zweite Einheit"');
  check(await f.page.locator('[data-act="start-session"]').count() === 1, 'Z1 genau ein Start');
  const chips = await f.page.locator('.bm-legend span').evaluateAll((s) => s.map((x) => [x.textContent.trim(), x.className]));
  const ruecken = chips.find(([t]) => t === 'Rücken');
  const bizeps = chips.find(([t]) => t === 'Bizeps');
  check(!!ruecken && ruecken[1] === '' && !!bizeps && bizeps[1] === 'sub',
    `Z1 Rücken als Hauptgruppe, Bizeps als Nebengruppe im Muskelbild (${chips.map(([t, c]) => `${t}${c ? '°' : ''}`).join(', ')})`);
  const st = await f.lies();
  const tr = traeger(st);
  console.log('     Träger:', JSON.stringify(tr));
  check(tr.length === 1 && tr[0].name === 'Zusatztag Woche 2' && gleich(tr[0].ex, [{ id: 'chin-ups', sets: 2 }]),
    `Z1/Z10/Z20 genau ein Träger „Zusatztag Woche 2" mit Chin-ups ×2 – keine Pull-ups, kein Leersatz (${JSON.stringify((tr[0] || {}).ex)})`);
  check(gleich(((tr[0] || {}).warum || {})['chin-ups']?.q?.[0], [6, 'chin-ups', 1, 3, 'db']),
    'Z1 der Träger kennt seine Herkunft: Workout 6, Chin-ups 1 von 3');

  // Z10 Tobis Auswahl, gegen den Plan der Einheit gemessen.
  const aus = await f.M(({ P, D, REST = D.REST }) => {
    const w = D.PLAN[8];
    const direkt = (id) => Object.entries(D.EXERCISES.find((e) => e.id === id).db.shares)
      .filter(([, s]) => s >= REST.direct).map(([g]) => g);
    const plan = new Set(P.exBasis(w, 'db').flatMap((it) => direkt(it.id)));
    const ex = P.workoutByNo(9, 'db').ex;
    const zus = ex.filter((x) => x.zusatz);
    return {
      treffer: zus.flatMap((x) => direkt(x.id).filter((g) => plan.has(g)).map((g) => `${x.id}:${g}`)),
      doppelt: ex.length - new Set(ex.map((x) => x.id)).size,
      zus: zus.map((x) => x.id),
    };
  });
  check(aus.zus.length === 1 && aus.treffer.length === 0,
    `Z10 die Zusatzübung trifft keine Gruppe, die Workout 9 direkt trainiert (${aus.treffer.join(', ') || 'keine'})`);
  check(aus.doppelt === 0, 'Z10 keine Übung doppelt in der Einheit');

  await f.klick('[data-act="show-list"]');
  let st2 = await f.lies();
  check(st2.log[9]?.db?.['chin-ups'] === undefined && st2.log[9]?.soll?.['chin-ups'] === undefined,
    'Z1 bis zum ersten Eintrag steht vom Zusatz nichts im Protokoll – kein Satzfeld, kein Stempel');

  // Z2 Liste und Herkunftszeile.
  const count = await f.txt('.focus-count');
  check(count === '5 + 1 Übungen · 0/17 Sätze', `Z2 Kopf der Liste („${count}")`);
  const namen = await f.alle('article.ex .ex-name');
  check(namen.length === 6 && namen[5] === 'Chin-ups', `Z2 sechs Karten, die Chin-ups am Ende (${namen.join(', ')})`);
  const zw = await f.txt('#zw-chin-ups');
  check(zw === 'Nachgeholt aus Woche 2: am Sa nur 1 von 3 Sätzen abgehakt', `Z2 die Herkunft an der Übung („${zw}")`);
  const knoepfe = await f.page.locator('article.ex').nth(5).locator('.set-btn')
    .evaluateAll((b) => b.map((x) => [x.getAttribute('aria-label'), x.getAttribute('aria-describedby')]));
  check(knoepfe.length === 2 && knoepfe.every(([l, d], i) => l === `Satz ${i + 1} von 2, nachgeholt, erledigt` && d === 'zw-chin-ups'),
    `Z2 jeder Satzknopf sagt „nachgeholt" und verweist auf die Zeile (${knoepfe.map(([l]) => l).join(' | ')})`);
  // Die Einordnung über der Liste nennt die Größen des Plans („4 bis 5
  // Übungen") – eine eingefügte Übung macht daraus keine sechs.
  const notiz = await f.txt('.tag-note');
  check(!/6 Übungen|bis 6/.test(notiz), `Z2 die Einordnung zählt Planübungen („${notiz.slice(0, 60)}")`);
  check(await f.page.locator('.nach-warum').count() === 1, 'Z2 genau eine Herkunftszeile – die der Chin-ups');
  // Liste ansehen stempelt den Zusatz nicht (saetzeZeigen()).
  st2 = await f.lies();
  check(st2.log[9]?.db?.['chin-ups'] === undefined, 'Z2 auch die Liste legt für den Zusatz nichts an');
  // „Heute" führt zur Einheit des Tages.
  await f.klick('[data-act="nav-workout"][data-delta="1"]');
  await f.klick('[data-act="show-list"]');
  await f.klick('[data-act="nav-today"]');
  check(/Heute · Workout 9/.test(await f.txt('.hero-eyebrow')), 'Z1 „Heute" (naechsteEinheit()) zeigt Workout 9');
  await ende(f);
});

/* ------------------------------------------------------------------ *
 * Z3 Fokus und Festhalten über den Haken, Neuladen
 * ------------------------------------------------------------------ */
await abschnitt('Z3', async () => {
  const f = await fall('Z3', VORLAGE);
  await f.klick('[data-act="start-session"]', 400);
  const kopf = await f.txt('.focus-count');
  console.log(`     ${kopf}`);
  check(/^⏱ \S+ · Übung 1 von 6 · 0\/17 Sätze$/.test(kopf), `Z3 eine Fokusansicht über alle („${kopf}")`);
  check(await f.page.locator('.prog-ex').count() === 6, 'Z3 der Fortschritt hat sechs Gruppen');
  const ersteUebung = await f.txt('.focus-name');
  await f.klick('.focus-set[aria-pressed="false"]', 400);
  const st = await f.lies();
  console.log('     log[9].zusatz:', JSON.stringify(st.log[9].zusatz));
  check(gleich(st.log[9].zusatz, TOBI_ZUSATZ), 'Z3 mit dem ersten Haken steht der Zusatz fest in log[9].zusatz');
  check(traeger(st).length === 0, 'Z3 und der Träger ist im selben Schritt verbraucht');
  check(!Object.keys(st.log).some((k) => k.startsWith('c')), 'Z3 samt seinem Protokoll');
  check(/chin-ups/.test(st.log[9].paare?.db?.key || ''), `Z3 die Paarung steht über alle sechs fest (${st.log[9].paare?.db?.key})`);
  check((st.log[9].db[(await f.M(({ P }) => P.workoutByNo(9, 'db').ex[0].id))] || []).some((x) => x.done),
    `Z3 der Haken sitzt bei ${ersteUebung}`);
  const idx = await f.M(({ P }) => P.workoutByNo(9, 'db').ex.findIndex((x) => x.id === 'reverse-fly'));
  await f.klick(`[data-act="focus-goto"][data-i="${idx}"]`);
  const sup = await f.txt('.super-hin');
  check(sup === '↔ Im Wechsel mit Chin-ups', `Z3 am Reverse Fly: „${sup}"`);
  const vorher = await f.M(({ P }) => P.workoutByNo(9, 'db').ex.map((x) => x.id));
  await f.neuLaden();
  const nach = await f.M(({ P }) => ({
    ids: P.workoutByNo(9, 'db').ex.map((x) => x.id),
    offen: P.offenerZusatztag ? P.offenerZusatztag() : 'fehlt',
  }));
  check(gleich(nach.ids, vorher) && nach.ids.length === 6, `Z3 nach dem Neuladen dieselben sechs (${nach.ids.join(', ')})`);
  check(nach.offen === null, 'Z3 und kein Zusatztag mehr, der bereitsteht');
  check(/Übung \d von 6/.test(await f.txt('.focus-count')), `Z3 die Fokusansicht geht wieder auf („${await f.txt('.focus-count')}")`);
  await ende(f);
});

// Z3b: der erste Eintrag über das Satzfeld (set-input) einer Planübung.
await abschnitt('Z3b', async () => {
  const f = await fall('Z3b', VORLAGE);
  await f.page.evaluate(() => {
    const i = document.createElement('input');
    Object.assign(i.dataset, { act: 'set-input', ex: 'floor-press', i: '0', field: 'w' });
    i.value = '40';
    document.getElementById('view').appendChild(i);
    i.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await f.page.waitForTimeout(300);
  const st = await f.lies();
  check(gleich(st.log[9]?.zusatz, TOBI_ZUSATZ) && traeger(st).length === 0,
    'Z3b auch der erste Eintrag ins Satzfeld hält den Zusatz fest und verbraucht den Träger');
  check(await f.M(({ P }) => P.workoutByNo(9, 'db').ex.some((x) => x.id === 'chin-ups')), 'Z3b die Chin-ups bleiben in der Einheit');
  await ende(f);
});

// Z3c: „Alle Sätze abhaken" ohne laufende Einheit.
await abschnitt('Z3c', async () => {
  const f = await fall('Z3c', VORLAGE);
  await f.klick('[data-act="show-list"]');
  await f.klick('[data-act="complete-workout"]', 400);
  let st = await f.lies();
  const prog = await f.M(({ P }) => P.progressOf(9, 'db'));
  check(gleich(st.log[9]?.zusatz, TOBI_ZUSATZ) && traeger(st).length === 0, 'Z3c „Alle Sätze abhaken" hält den Zusatz fest');
  check(prog.done === 17 && prog.total === 17, `Z3c und hakt alle 17 ab (${prog.done}/${prog.total})`);
  await f.neuLaden();
  st = await f.lies();
  check(st.log[9].done === 'db' && await f.M(({ P }) => P.completedMode(9)) === 'db',
    'Z3c die Einheit gilt als trainiert, nach dem Neuladen auch abgestempelt');
  await ende(f);
});

/* ------------------------------------------------------------------ *
 * Z4 Abschluss
 * ------------------------------------------------------------------ */
await abschnitt('Z4', async () => {
  const f = await fall('Z4', VORLAGE);
  await f.klick('[data-act="start-session"]', 400);
  await f.klick('[data-act="focus-list"]');
  const plan = await listeAbhaken(f, (n) => n !== 'Chin-ups');
  let st = await f.lies();
  let prog = await f.M(({ P }) => P.progressOf(9, 'db'));
  check(plan === 15 && prog.done === 15 && prog.total === 17 && !!st.session,
    `Z4 nach den 15 Plansätzen läuft die Einheit weiter (${prog.done}/${prog.total}, Uhr ${st.session ? 'läuft' : 'aus'})`);
  check(!/abgeschlossen/.test(await f.toast()), 'Z4 und es kam kein Abschluss');
  await listeAbhaken(f, (n) => n === 'Chin-ups');
  const t = await f.toast();
  console.log(`     Toast: ${t}`);
  check(t === 'Training abgeschlossen – alle 17 Sätze 🎉', `Z4 der letzte Chin-up beendet die Einheit („${t}")`);
  check(/Heute · Workout 9/.test(await f.txt('.hero-eyebrow')) && /Alle 17 Sätze stehen/.test(await f.txt('.fertig-sub')),
    `Z4 die Startansicht bleibt bei Workout 9 („${await f.txt('.fertig-sub')}")`);
  st = await f.lies();
  check(traeger(st).length === 0 && await f.page.locator('.zusatz-danach').count() === 0, 'Z4 kein Träger, keine zweite Einheit danach');
  await f.neuLaden();
  check(!/Zusatztag/.test(await f.txt('.hero-eyebrow')), `Z4 nach dem Neuladen am selben Abend kein Zusatztag vorn („${await f.txt('.hero-eyebrow')}")`);
  await ende(f);

  // Von Hand bei 15/17.
  const g = await fall('Z4b', VORLAGE);
  await g.klick('[data-act="start-session"]', 400);
  await g.klick('[data-act="focus-list"]');
  await listeAbhaken(g, (n) => n !== 'Chin-ups');
  await g.klick('[data-act="finish-session"]', 400);
  const t2 = await g.toast();
  check(t2 === 'Gespeichert · 15/17 Sätze', `Z4b von Hand abgeschlossen („${t2}")`);
  check(await g.M(({ P }) => P.completedMode(9)) === 'db', 'Z4b die Einheit zählt als trainiert');
  await ende(g);
});

/* ------------------------------------------------------------------ *
 * Z5 Buchhaltung – A mit Zusatz, B ohne; beide Workout 9 ganz abgehakt
 *
 * A hakt in der App alles ab („Alle Sätze abhaken", 17 Sätze). B hakt nur den
 * Plan ab, an der App vorbei (store.completeWorkout() mit exOf(), 15 Sätze) –
 * so, als hätte es den Zusatz nie gegeben. Die App selbst legt ihn ja beim
 * Laden an. Alles, was dem Plan gehört, muss in A und B gleich sein.
 * ------------------------------------------------------------------ */
const wochenKarte = async (f) => {
  await f.tab('stats');
  return f.page.evaluate(() => {
    const host = document.getElementById('volWeek');
    const zeilen = {};
    host.querySelectorAll('.vol-row').forEach((r) => {
      zeilen[r.querySelector('.vol-name').textContent.trim()] = r.querySelector('.vol-num').textContent.trim();
    });
    const [, davor, von] = host.textContent.match(/Woche davor: (\d+)\s+von (\d+) Gruppen/) || [];
    return { kopf: host.querySelector('.lbl').textContent.trim(), zeilen, davor: davor === undefined ? null : Number(davor),
      von: von === undefined ? null : Number(von), text: host.textContent.replace(/\s+/g, ' ') };
  });
};
await abschnitt('Z5', async () => {
  const ganz = async (name, z) => {
    const f = await fall(name, z);
    await f.klick('[data-act="show-list"]');
    await f.klick('[data-act="complete-workout"]', 400);
    await f.neuLaden();
    return f;
  };
  const a = await ganz('Z5 A', VORLAGE);
  const b = await fall('Z5 B', VORLAGE);
  await b.M(({ P, D, store }) => store.completeWorkout(9, 'db', P.exOf(D.PLAN[8], 'db')
    .map((x) => ({ ...x, w: '20' }))));
  await b.page.waitForTimeout(200);
  await b.neuLaden();
  check(await b.M(({ P }) => P.progressOf(9, 'db').done) === 15
    && Object.keys((await b.lies()).log[9].db).length === 5,
  'Z5 B: Workout 9 mit den 15 Plansätzen, ohne Zusatz');
  const ka = await wochenKarte(a);
  const kb = await wochenKarte(b);
  // Mit Nenner ausgegeben: In README und Bericht stand „9 von 12 → 11 von
  // 12", die App hat 14 Gruppen. Die Zahl für die README kommt von hier.
  console.log(`     A: ${ka.kopf} Rücken ${ka.zeilen['Rücken']} Bizeps ${ka.zeilen.Bizeps} · davor ${ka.davor} von ${ka.von}`);
  console.log(`     B: ${kb.kopf} Rücken ${kb.zeilen['Rücken']} Bizeps ${kb.zeilen.Bizeps} · davor ${kb.davor} von ${kb.von}`);
  const gruppen = await a.M(async () => Object.keys((await import('./js/body.js')).MUSCLE_LABEL).length);
  check(ka.von === gruppen && kb.von === gruppen, `Z5 „Woche davor" zählt gegen alle ${gruppen} Gruppen (${ka.von}, ${kb.von})`);
  check(/Woche 3/.test(ka.kopf) && ka.zeilen['Rücken'] === kb.zeilen['Rücken'] && ka.zeilen.Bizeps === kb.zeilen.Bizeps,
    'Z5 Woche 3: Rücken und Bizeps in Soll und Ist gleich, mit und ohne Zusatz – er gehört nicht dieser Woche');
  check(ka.davor !== null && kb.davor !== null && ka.davor >= kb.davor + 2,
    `Z5 Woche 2 („Woche davor"): mit Zusatz mindestens zwei Gruppen mehr im Ziel (${ka.davor} gegen ${kb.davor})`);
  const ra = await a.M(({ P, D }) => {
    const w = D.PLAN[8];
    const o = P.offenInWoche(D.PLAN[9]);
    return {
      basis: P.exBasis(w, 'db').map((x) => `${x.id}${x.gehalten ? '(gehalten)' : ''}`),
      plan: P.exOf(w, 'db').map((x) => x.id),
      einheit: (P.einheitEx || P.exOf)(w, 'db').map((x) => x.id),
      herkunft: o.herkunft.map((h) => h.id), lats: o.fehlt.lats,
      stats: P.sammleStats(),
    };
  });
  const rb = await b.M(({ P }) => P.sammleStats());
  check(ra.basis.length === 5 && !ra.basis.some((x) => /chin-ups|gehalten/.test(x)),
    `Z5 exBasis(Workout 9): fünf Planübungen, nichts gehalten (${ra.basis.join(', ')})`);
  check(!ra.plan.includes('chin-ups') && ra.einheit.length === 6, 'Z5 exOf ohne, einheitEx mit dem Zusatz');
  check(!ra.herkunft.includes('chin-ups') && ra.lats === undefined,
    `Z5 für Workout 10 ist der Zusatz weder Rückstand noch Herkunft (${ra.herkunft.join(', ') || 'nichts'})`);
  check(ra.stats.setsDone === rb.setsDone + 2 && ra.stats.customSets === 0,
    `Z5 Statistik: zwei Sätze mehr, nicht als „eigene" (${ra.stats.setsDone} gegen ${rb.setsDone}, eigene ${ra.stats.customSets})`);
  await ende(a);
  await ende(b);

  // Satz-Ort: nur die Chin-ups, dann „Als trainiert markieren".
  const c = await fall('Z5 Satz-Ort', VORLAGE);
  await c.klick('[data-act="show-list"]');
  await listeAbhaken(c, (n) => n === 'Chin-ups');
  await c.klick('[data-act="hide-list"]');
  await c.klick('[data-act="mark-done"]', 400);
  const kc = await wochenKarte(c);
  const any3 = await c.M(({ P, D }) => {
    const w = D.PLAN[8];
    return (P.einheitEx || P.exOf)(w, 'db').length;
  });
  console.log(`     Satz-Ort: ${kc.kopf} · Rücken ${kc.zeilen['Rücken']}`);
  check(/Woche 2/.test(kc.kopf) && kc.zeilen['Rücken'] === '6,0/6',
    `Z5 nur die Chin-ups: Woche 3 bleibt leer, Woche 2 zeigt Rücken 6,0/6 („${kc.kopf}", ${kc.zeilen['Rücken']})`);
  check(any3 === 6, 'Z5 die Einheit hat dabei weiter sechs Übungen');
  await ende(c);
});

/* ------------------------------------------------------------------ *
 * Z6 Zusatz liegen gelassen
 *
 * Damit am Samstag überhaupt ein zweiter Zusatztag möglich wäre, ist in
 * Woche 2 zusätzlich der Goblet Squat von Workout 7 liegen geblieben: Die
 * Oberschenkel ruhen am Donnerstag (Workout 9 trifft sie), am Samstag nicht
 * mehr (Workout 10 trifft sie nicht). Ohne die Regel „vergeben" hinge sich
 * dann ein neuer „Zusatztag Woche 2" an Workout 10.
 * ------------------------------------------------------------------ */
await abschnitt('Z6', async () => {
  const z = kopie(VORLAGE);
  z.log[7].db['goblet-squat'] = z.log[7].db['goblet-squat'].map(() => ({ w: '', done: false }));
  const f = await fall('Z6', z);
  check(gleich(await f.M(({ P }) => P.workoutByNo(9, 'db').ex.filter((x) => x.zusatz).map((x) => x.id)), ['chin-ups']),
    'Z6 am Donnerstag kommen die Chin-ups dazu');
  await f.klick('[data-act="show-list"]');
  await listeAbhaken(f, (n) => n !== 'Chin-ups');
  await listeAbhaken(f, (n) => n === 'Chin-ups', 1);
  await f.klick('[data-act="hide-list"]');
  await f.klick('[data-act="mark-done"]', 400);
  await f.uhr('2026-10-10T17:00:00+02:00');
  await f.neuLaden();
  const st = await f.lies();
  const r = await f.M(({ P, D }) => ({
    herkunft: P.offenInWoche(D.PLAN[9]).herkunft.map((h) => `W${h.n} ${h.id} ${h.abgehakt}/${h.von}`),
    nach: [...(P.nacharbeit(D.PLAN[9], 'db') || new Map()).keys()],
    vergeben: P.zusatzVergeben ? P.zusatzVergeben(2) : 'fehlt',
  }));
  console.log(`     Sa: ${await f.txt('.hero-eyebrow')} · Rückstand ${r.herkunft.join(', ') || '–'} · Nacharbeit ${r.nach.join(', ') || '–'}`);
  check(traeger(st).length === 0, 'Z6 kein zweiter „Zusatztag Woche 2"');
  check(!r.herkunft.some((h) => /chin-ups/.test(h)), 'Z6 die liegen gelassenen Chin-ups sind kein Rückstand von Workout 9');
  check(!r.nach.includes('einarmiges-kh-rudern'), 'Z6 und Workout 10 holt sie nicht als „+1 Einarmiges KH-Rudern" nach');
  check(r.vergeben === true, 'Z6 der Zusatztag der Woche 2 gilt als vergeben');
  await ende(f);
});

/* ------------------------------------------------------------------ *
 * Z7 Abbrechen und Zurücksetzen
 * ------------------------------------------------------------------ */
await abschnitt('Z7', async () => {
  const f = await fall('Z7', VORLAGE);
  await f.klick('[data-act="start-session"]', 400);
  await f.klick('.focus-set[aria-pressed="false"]', 300);
  check(!!(await f.lies()).log[9].zusatz, 'Z7 vorher festgehalten');
  await f.klick('[data-act="discard-session"]', 400);
  let st = await f.lies();
  check(st.log[9]?.zusatz === undefined, 'Z7 Abbrechen löscht den festgehaltenen Zusatz');
  check(traeger(st).length === 1 && traeger(st)[0].name === 'Zusatztag Woche 2', 'Z7 ein neuer Träger steht bereit');
  const sub = await f.txt('.hero-sub');
  check(sub === 'Hanteln · 5 + 1 Übungen · 15 + 2 Sätze', `Z7 und die Einheit zeigt ihn wieder („${sub}")`);
  // Dasselbe mit „Zurücksetzen" in der Liste bei laufender Einheit.
  await f.klick('[data-act="start-session"]', 400);
  await f.klick('.focus-set[aria-pressed="false"]', 300);
  await f.klick('[data-act="focus-list"]');
  await f.klick('[data-act="reset-workout"]', 400);
  st = await f.lies();
  const kopf = await f.txt('.focus-count');
  check(st.log[9]?.zusatz === undefined && traeger(st).length === 1 && kopf === '5 + 1 Übungen · 0/17 Sätze',
    `Z7 Zurücksetzen ebenso („${kopf}")`);
  await ende(f);
});

/* ------------------------------------------------------------------ *
 * Z8 Planwechsel nach dem Festhalten
 * ------------------------------------------------------------------ */
await abschnitt('Z8', async () => {
  const f = await fall('Z8', VORLAGE);
  await f.klick('[data-act="start-session"]', 400);
  await f.klick('.focus-set[aria-pressed="false"]', 400);
  const st = await f.lies();
  const z = kopie(st);
  z.planStand = { ...(z.planStand || {}), cut: 'alterplan01' };
  await f.neuLaden(z);
  const st2 = await f.lies();
  const fest = (st2.log[9].fest || []).map((x) => x.id);
  console.log(`     fest: ${fest.join(', ')}`);
  check(fest.length === 5 && !fest.includes('chin-ups'), 'Z8 festgeschrieben werden die fünf Planübungen, ohne den Zusatz');
  check(gleich(st2.log[9].zusatz, TOBI_ZUSATZ), 'Z8 der Zusatz bleibt, wie er war');
  const ids = await f.M(({ P }) => P.workoutByNo(9, 'db').ex.map((x) => x.id));
  check(ids.length === 6 && new Set(ids).size === 6, `Z8 die Einheit hat weiter sechs Übungen (${ids.join(', ')})`);
  check(/5 \+ 1 Übungen/.test(await f.txt('.hero-sub')), `Z8 Kopf „${await f.txt('.hero-sub')}"`);
  await ende(f);
});

/* ------------------------------------------------------------------ *
 * Z9 Gleichstand: kein zusätzlicher Umbau
 * ------------------------------------------------------------------ */
const seitheben = (supersatz) => {
  const z = kopie(VORLAGE);
  z.supersatz = supersatz;
  z.log[8].db['sitzendes-seitheben'] = z.log[8].db['sitzendes-seitheben'].map(() => ({ w: '', done: false }));
  return z;
};
// Ohne Supersatz entscheidet allein der Umbau (Regel a), mit Supersatz danach
// die Zahl der Paare (Regel b) – hier zeigen beide auf dieselbe Übung.
for (const supersatz of [true, false]) await abschnitt('Z9', async () => {
  const f = await fall(`Z9 ${supersatz ? 'mit' : 'ohne'} Supersatz`, seitheben(supersatz));
  const r = await f.M(({ P, D, G, S }) => {
    const w = D.PLAN[8];
    const ex = P.workoutByNo(9, 'db').ex;
    const zus = ex.filter((x) => x.zusatz);
    const paar = (items) => S.paare(items.map((x) => P.resolve(x, 'db')), 'db').filter((g) => g.length === 2).length;
    const fassung = zus.find((x) => (D.EXERCISES.find((e) => e.id === x.id).db.shares.sideDelts || 0) >= 0.5);
    return {
      zus: zus.map((x) => x.id),
      fassung: fassung ? fassung.id : null,
      ohneAufbau: fassung ? G.setupOf(fassung.id, G.workingWeight(fassung.id)) === null : false,
      schritte: [G.ruestSchritte(P.exOf(w, 'db')), G.ruestSchritte(ex)],
      paare: [paar(P.exOf(w, 'db')), paar(ex)],
    };
  });
  console.log(`     ${f.name}: Zusatz ${r.zus.join(', ')} · Rüstschritte ${r.schritte.join(' → ')} · Paare ${r.paare.join(' → ')}`);
  check(!!r.fassung && r.ohneAufbau, `Z9 eine Seitheben-Fassung ohne Aufbau (${r.fassung})`);
  check(r.schritte[0] === r.schritte[1] && r.schritte[1] === 3, `Z9 kein zusätzlicher Rüstschritt (${r.schritte.join(' → ')})`);
  check(r.zus.length <= 2, `Z9 höchstens zwei eingefügte Übungen (${r.zus.length})`);
  if (supersatz) check(r.paare[1] >= r.paare[0], `Z9 mindestens so viele Paare wie ohne Zusatz (${r.paare.join(' → ')})`);
  await ende(f);
});

/* ------------------------------------------------------------------ *
 * Z11 Die Erholungsregel nach dem ersten Satz
 * ------------------------------------------------------------------ */
await abschnitt('Z11', async () => {
  const f = await fall('Z11', VORLAGE);
  await f.klick('[data-act="start-session"]', 400);
  await f.klick('.focus-set[aria-pressed="false"]', 400);
  await f.neuLaden();
  await f.uhr('2026-10-08T18:00:00+02:00');
  await f.neuLaden();
  await f.tab('settings');
  await f.klick('[data-act="set-modus"][data-v="bw"]', 300);
  await f.klick('[data-act="set-modus"][data-v="db"]', 300);
  const st = await f.lies();
  const ids = await f.M(({ P }) => P.workoutByNo(9, 'db').ex.map((x) => x.id));
  check(traeger(st).length === 0, 'Z11 nach Neuladen, Uhr und Moduswechsel entsteht kein neuer Träger');
  check(gleich(st.log[9].zusatz, TOBI_ZUSATZ) && new Set(ids).size === ids.length, 'Z11 der Zusatz bleibt, keine Übung doppelt');
  check(Object.keys(st.log[9].db).every((id) => ids.includes(id)),
    `Z11 im Protokoll stehen nur Übungen der Einheit (${Object.keys(st.log[9].db).join(', ')})`);
  await ende(f);
});

/* ------------------------------------------------------------------ *
 * Z12 Der Tag des Wochenabschlusses – Standardplan
 *
 * Woche 1 mit je zwei ausgelassenen Übungen in Workout 1–3, Workout 4 heute
 * bis auf den letzten Satz abgehakt. Workout 5 liegt drei Tage weiter: Der Tag
 * danach ist ein echter Ruhetag, an dem Workout 5 noch nicht in Reichweite der
 * Erholungsregel liegt. (Mit Workout 5 übermorgen sperrt es am Tag danach
 * fast alles, und der Träger fällt ganz still weg – bewusst unverändert, siehe
 * README.)
 * ------------------------------------------------------------------ */
await abschnitt('Z12', async () => {
  const leer = await fall('Z12 Aufbau', null);
  const zustand = await leer.M(({ D }, heute) => {
    const plan = D.PLANS.standard.plan;
    const tage = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);
    const add = (iso, k) => new Date(Date.parse(iso) + k * 864e5).toISOString().slice(0, 10);
    const shift = tage(plan[4].date, add(heute, 3));
    const log = {};
    plan.slice(0, 4).forEach((w, i) => {
      const e = { mode: 'db', soll: {}, nach: {}, nachFest: { db: {}, bw: {} }, db: {}, bw: {},
        startedOn: i === 3 ? heute : add(w.date, shift - 1) };
      if (i < 3) e.done = 'db';
      w.ex.forEach((it, k) => {
        e.soll[it.id] = it.sets;
        e.nach[it.id] = 0;
        const an = i < 3 && k >= w.ex.length - 2 ? 0 : it.sets;
        e.db[it.id] = Array.from({ length: it.sets }, (_, s) => ({ w: s < an ? '20' : '', done: s < an }));
      });
      if (i === 3) { const x = w.ex[w.ex.length - 1]; e.db[x.id][x.sets - 1] = { w: '', done: false }; }
      log[w.n] = e;
    });
    return { greeted: true, setupDone: true, name: 'T', focus: 'standard', level: 'geuebt', mode: 'db',
      supersatz: false, planStand: { standard: D.PLANS.standard.stand }, planSaetze: { standard: D.PLANS.standard.saetze },
      shift, log };
  }, '2026-10-08');
  await leer.ctx.close();
  const f = await fall('Z12', zustand);
  await f.klick('[data-act="start-session"]', 400);
  await f.klick('.focus-set[aria-pressed="false"]', 500);
  const t = await f.toast();
  check(/^Training abgeschlossen – alle \d+ Sätze/.test(t), `Z12 der Abschluss meldet sich („${t}")`);
  check(/Heute · Workout 4/.test(await f.txt('.hero-eyebrow')) && /Für heute durch/.test(await f.txt('.fertig-kopf')),
    `Z12 die Startansicht bleibt bei Workout 4 („${await f.txt('.hero-eyebrow')}")`);
  const st = await f.lies();
  check(traeger(st).length === 1, `Z12 der Zusatztag für Woche 1 ist angelegt (${traeger(st).map((c) => c.ex.map((x) => x.id).join('+')).join(' | ')})`);
  const karte = await wochenKarte(f);
  check(/frühestens morgen/.test(karte.text) && await f.page.locator('#volWeek [data-act="custom-start"]').count() === 0,
    'Z12 die Wochenkarte sagt „frühestens morgen" und bietet kein Öffnen an');
  await f.tab('dashboard');
  await f.neuLaden();
  check(!/Zusatztag/.test(await f.txt('.hero-eyebrow')), `Z12 auch nach dem Neuladen nicht vorn („${await f.txt('.hero-eyebrow')}")`);
  await f.uhr('2026-10-09T17:00:00+02:00');
  await f.neuLaden();
  const eb = await f.txt('.hero-eyebrow');
  const titel = await f.txt('.hero-title');
  check(/Heute · Zusatztag$/.test(eb) && titel === 'Zusatztag Woche 1', `Z12 am Ruhetag danach steht er allein da („${eb}" / „${titel}")`);
  await f.klick('[data-act="show-list"]');
  const zeilen = await f.alle('article.ex .nach-warum');
  const karten = await f.page.locator('article.ex').count();
  console.log(`     ${zeilen.join(' | ')}`);
  check(karten >= 2 && karten <= 5 && zeilen.length === karten && zeilen.every((z) => /^Nachgeholt aus Woche 1/.test(z)),
    `Z12 jede seiner ${karten} Übungen sagt, woher sie kommt`);
  // Allein bleibt es bei der vollen Satzzahl – gekürzt wird nur, was in eine
  // Einheit eingefügt wird (Z20).
  const allein = traeger(await f.lies())[0];
  check(!!allein && allein.ex.every((x) => x.sets === 3),
    `Z12/Z20 allein: jede Übung mit voller Satzzahl (${(allein ? allein.ex : []).map((x) => `${x.id}×${x.sets}`).join(', ')})`);
  await ende(f);
});

/* ------------------------------------------------------------------ *
 * Z13 Tobis Mittwoch und das Vorziehen
 * ------------------------------------------------------------------ */
await abschnitt('Z13', async () => {
  const f = await fall('Z13', { ...kopie(VORLAGE), customs: [] }, '2026-10-07T17:00:00+02:00');
  const st = await f.lies();
  check(traeger(st).length === 0, 'Z13 am Mittwoch kein Zusatztag (allein trägt nur Chin-ups, allein braucht es zwei)');
  check(/Morgen · Workout 9/.test(await f.txt('.hero-eyebrow')), `Z13 vorn steht Workout 9 für morgen („${await f.txt('.hero-eyebrow')}")`);
  await f.klick('[data-act="start-session"]', 400);
  const t = await f.toast();
  check(t === 'Los geht’s 💪 · dazu Chin-ups aus Woche 2', `Z13 Vorziehen sagt, was dazukommt („${t}")`);
  check(/Übung 1 von 6 · 0\/17 Sätze/.test(await f.txt('.focus-count')), `Z13 („${await f.txt('.focus-count')}")`);
  check(await f.M(({ P }) => (P.zusatzBindung ? (P.zusatzBindung() || {}).w?.n : null)) === 9, 'Z13 der Träger steckt in Workout 9');
  await ende(f);
});

/* ------------------------------------------------------------------ *
 * Z14 Moduswechsel
 *
 * (a) vor dem ersten Satz: Der Zusatz wird im Modus der Einheit neu gerechnet.
 *     Ohne Bänder und mit liegen gelassenen SZ-Curls holt er mit Hanteln die
 *     SZ-Curls nach – die gehen ohne Hanteln nur am Band. Ohne Neurechnung
 *     fielen sie bloß weg; mit ihr kommen Rucksack-Curls.
 * (b) nach dem Festhalten bleiben dieselben Übungen, mit der Satzzahl des Modus.
 * ------------------------------------------------------------------ */
await abschnitt('Z14', async () => {
  const z = kopie(VORLAGE);
  z.log[7].db['sz-curls'] = z.log[7].db['sz-curls'].map(() => ({ w: '', done: false }));
  z.fehlt = ['band-gelb', 'band-rot'];
  const f = await fall('Z14a', z);
  const vorher = await f.M(({ P }) => P.workoutByNo(9, 'db').ex.filter((x) => x.zusatz).map((x) => x.id));
  await f.tab('settings');
  await f.klick('[data-act="set-modus"][data-v="bw"]', 300);
  await f.tab('dashboard');
  const r = await f.M(({ P, V, store }) => {
    const zus = P.workoutByNo(9, 'bw').ex.filter((x) => x.zusatz);
    const c = store.customs().find((x) => /^Zusatztag/.test(x.name));
    return { zus: zus.map((x) => x.id), geht: zus.every((x) => V.uebungGeht(x.id, 'bw')), traeger: c ? c.ex.map((x) => x.id) : [] };
  });
  const sub = await f.txt('.hero-sub');
  console.log(`     Hanteln: ${vorher.join(', ')} · ohne Hanteln: ${r.zus.join(', ')} · ${sub}`);
  check(r.geht && gleich(r.zus, r.traeger) && r.zus.length === vorher.length,
    `Z14a ohne Hanteln neu gerechnet: alle Zusatzübungen gehen, keine fällt bloß weg (${r.zus.join(', ')})`);
  check(/^Bodyweight · 5 \+ \d Übungen/.test(sub), `Z14a der Kopf („${sub}")`);
  await ende(f);

  const g = await fall('Z14b', VORLAGE);
  await g.klick('[data-act="start-session"]', 400);
  const idx = await g.M(({ P }) => P.workoutByNo(9, 'db').ex.findIndex((x) => x.id === 'chin-ups'));
  await g.klick(`[data-act="focus-goto"][data-i="${idx}"]`);
  await g.klick('.focus-set[aria-pressed="false"]', 300);
  await g.tab('settings');
  await g.klick('[data-act="set-modus"][data-v="bw"]', 300);
  await g.tab('dashboard');
  const r2 = await g.M(({ P }) => {
    const c = P.workoutByNo(9, 'bw').ex.find((x) => x.id === 'chin-ups');
    return { sets: c ? c.sets : null, erledigt: P.saetzeErledigt(9, 'chin-ups', 2) };
  });
  check(r2.sets === 2 && r2.erledigt === 1, `Z14b ohne Hanteln stehen die Chin-ups weiter da (${r2.sets} Sätze, ${r2.erledigt} erledigt)`);
  await g.klick('[data-act="focus-list"]');
  await g.klick('[data-act="complete-workout"]', 400);
  const p = await g.M(({ P }) => P.progressOf(9, 'bw'));
  check(p.complete && /Training abgeschlossen – alle/.test(await g.toast()), `Z14b endet bei voller Satzzahl (${p.done}/${p.total})`);
  await ende(g);
});

/* ------------------------------------------------------------------ *
 * Z15 Sicherung
 * ------------------------------------------------------------------ */
await abschnitt('Z15', async () => {
  const f = await fall('Z15', VORLAGE);
  const roh1 = await f.M(({ store }) => store.exportJSON());
  await f.klick('[data-act="start-session"]', 400);
  await f.klick('.focus-set[aria-pressed="false"]', 400);
  const roh2 = await f.M(({ store }) => store.exportJSON());
  const ein = async (text) => {
    await f.M(({ store }, t) => store.importJSON(t), text);
    await f.page.waitForTimeout(200);
    await f.neuLaden();
    return f.lies();
  };
  let st = await ein(roh1);
  check(gleich(traeger(st)[0]?.warum, traeger(JSON.parse(roh1))[0]?.warum) && !!traeger(st)[0]?.warum,
    'Z15 die Herkunft am Träger reist in der Sicherung mit');
  st = await ein(roh2);
  check(gleich(st.log[9].zusatz, TOBI_ZUSATZ), 'Z15 der festgehaltene Zusatz auch');
  const kaputt = JSON.parse(roh1);
  kaputt.log[9] = { db: {}, bw: {}, zusatz: { woche: '2', ex: [{ id: 'gibtsnicht' }, { id: 'chin-ups', sets: 99 },
    { id: 'pull-ups' }, { id: 'reverse-fly' }, { id: 'band-seitheben' }, { id: 'sz-curls' }, { id: 'hammer-curls' }] } };
  kaputt.customs[0].warum = { 'chin-ups': { g: ['<script>', 'lats'], q: [[6, 'chin-ups', 1, 3, 'db'], ['x']] } };
  await ein(JSON.stringify(kaputt));
  const r = await f.M(({ P, store }) => ({
    fest: P.festerZusatz(store.getState().log[9]),
    warum: store.customs()[0]?.warum,
    ids: P.workoutByNo(9, 'db').ex.map((x) => x.id),
  }));
  check(r.fest === null, 'Z15 eine Woche, die keine Zahl ist, macht den Zusatz ungültig');
  check(!JSON.stringify(r.warum || {}).includes('<script>') && gleich(r.warum?.['chin-ups']?.q, [[6, 'chin-ups', 1, 3, 'db']]),
    `Z15 normCustoms lässt von der Herkunft nur Gültiges durch (${JSON.stringify(r.warum)})`);
  kaputt.log[9].zusatz.woche = 2;
  await ein(JSON.stringify(kaputt));
  const r2 = await f.M(({ P, store }) => P.festerZusatz(store.getState().log[9]));
  check(!!r2 && r2.ex.length === 5 && !r2.ex.some((x) => x.id === 'gibtsnicht')
    && r2.ex.find((x) => x.id === 'chin-ups').sets === 10,
  `Z15 mit Zahl: unbekannte Übung weg, höchstens fünf, Satzzahl auf 10 gekappt (${JSON.stringify(r2 && r2.ex)})`);
  await ende(f);
});

/* ------------------------------------------------------------------ *
 * Z16 Andere Ansichten
 * ------------------------------------------------------------------ */
await abschnitt('Z16', async () => {
  const f = await fall('Z16', VORLAGE);
  const id = (traeger(await f.lies())[0] || {}).id;
  // Kalender
  await f.tab('settings');
  await f.klick('[data-act="go-tab"][data-tab="calendar"]', 300);
  const kachel = await f.txt('.cal-cell.today');
  await f.klick('.cal-cell.today', 300);
  const detail = await f.alle('.cal-detail');
  const det = detail.join(' ');
  console.log(`     Kalender: ${det.slice(0, 160)}`);
  check(/5 \+ 1 Übungen · 15 \+ 2 Sätze/.test(det) && /Chin-ups.*· nachgeholt/.test(det), 'Z16 Kalender: der Tag zeigt die ganze Einheit, die Chin-ups als nachgeholt');
  check(!/\(\+1\)/.test(kachel), `Z16 die Kachel zählt keine zweite Einheit („${kachel}")`);
  // Statistik
  await f.tab('stats');
  const karte = await f.txt('#volWeek');
  check(/Was hier fehlt, holt Workout 9 heute nach: Chin-ups\./.test(karte)
    && await f.page.locator('#volWeek [data-act="open-workout"][data-n="9"]').count() === 1
    && await f.page.locator('#volWeek [data-act="custom-start"]').count() === 0,
  'Z16 Wochenkarte: „Was hier fehlt, holt Workout 9 heute nach: Chin-ups." mit „Zu Workout 9"');
  const naechste = await f.page.locator('.plan-date + .small').first().textContent();
  check(/Chin-ups\s*$/.test(naechste || ''), `Z16 „Nächste Einheit" endet mit den Chin-ups („${(naechste || '').trim()}")`);
  // Eigene Workouts
  await f.tab('settings');
  await f.klick('[data-act="go-tab"][data-tab="custom"]', 300);
  const eigen = await f.txt('#view');
  check(/steckt heute in Workout 9/.test(eigen)
    && await f.page.locator(`[data-id="${id}"]`).count() === 0,
  'Z16 Eigene Workouts: „steckt heute in Workout 9", ohne Öffnen, Bearbeiten und Löschen');
  // Supersatz-Vorschau
  await f.tab('settings');
  const vorschau = await f.txt('.super-vorschau');
  check(/^Workout 9 liefe so/.test(vorschau) && /3 Paare/.test(vorschau), `Z16 Supersatz-Vorschau („${vorschau.slice(0, 60)}… ${(vorschau.match(/\d Paare?/) || [''])[0]}")`);
  await ende(f);
});

/* ------------------------------------------------------------------ *
 * Z17 Fortsetzen nach dem Neuladen, im letzten Paar
 * ------------------------------------------------------------------ */
await abschnitt('Z17', async () => {
  const f = await fall('Z17', VORLAGE);
  await f.klick('[data-act="start-session"]', 400);
  for (let k = 0; k < 30; k++) {
    const done = await f.M(({ P }) => P.progressOf(9, 'db').done);
    if (done >= 12) break;
    const offen = f.page.locator('.focus-set[aria-pressed="false"]');
    if (await offen.count()) await offen.first().click();
    else await f.page.locator('[data-act="focus-step"][data-d="1"]').click();
    await f.page.waitForTimeout(120);
  }
  const paarVorher = (await f.lies()).log[9].paare;
  await f.neuLaden();
  const name = await f.txt('.focus-name');
  const kopf = await f.txt('.focus-count');
  console.log(`     nach dem Neuladen: ${name} · ${kopf}`);
  check(['Reverse Fly', 'Chin-ups'].includes(name) && /Übung \d von 6/.test(kopf),
    `Z17 die Fokusansicht geht im letzten Paar wieder auf (${name})`);
  check(gleich((await f.lies()).log[9].paare, paarVorher) && (await f.lies()).session?.n === 9,
    'Z17 dieselbe Einheit, dieselbe Paarung');
  await ende(f);
});

/* ------------------------------------------------------------------ *
 * Z18 Bodyweight
 * ------------------------------------------------------------------ */
await abschnitt('Z18', async () => {
  const f = await fall('Z18', { ...kopie(VORLAGE), mode: 'bw' });
  const r = await f.M(({ P, V, I, store }) => {
    const ex = P.workoutByNo(9, 'bw').ex;
    const erst = ex.findIndex((x) => x.zusatz);
    const sperre = I.gesperrt(store.getState().injuries || [], 'bw');
    return { ids: ex.map((x) => `${x.id}${x.zusatz ? '*' : ''}`),
      hinten: erst >= 0 && ex.slice(erst).every((x) => x.zusatz),
      geht: ex.filter((x) => x.zusatz).every((x) => V.uebungGeht(x.id, 'bw') && !sperre.has(x.id)) };
  });
  const sub = await f.txt('.hero-sub');
  console.log(`     ${r.ids.join(', ')} · ${sub}`);
  check(r.hinten && r.geht, 'Z18 ohne Hanteln steht der Zusatz hinten, und jede seiner Übungen geht ohne Hanteln');
  check(/^Bodyweight · 5 \+ \d Übungen/.test(sub), `Z18 Kopf („${sub}")`);
  await f.klick('[data-act="show-list"]');
  check(/^Nachgeholt aus Woche 2/.test(await f.txt('article.ex [id^="zw-"]')), 'Z18 mit Herkunftszeile');
  await ende(f);
});

/* ------------------------------------------------------------------ *
 * Z19 Nacharbeit und Zusatz in derselben Einheit
 *
 * Workout 9 am Do trainiert, beim Kreuzheben ein Satz liegen gelassen. Am Sa
 * ist Workout 10 fällig: Es bekommt aus Workout 9 ein „+1", und der Träger der
 * Woche 2 steckt in ihm. Damit der Zusatz zu Workout 10 passt (das Rücken und
 * Bizeps direkt trifft), ist in Woche 2 der Goblet Squat von Workout 7 liegen
 * geblieben – nachgeholt wird er als Fersenerhöhter Goblet Squat.
 * ------------------------------------------------------------------ */
await abschnitt('Z19', async () => {
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
  const f = await fall('Z19', z, '2026-10-10T17:00:00+02:00');
  const sub = await f.txt('.hero-sub');
  console.log(`     ${await f.txt('.hero-eyebrow')} · ${sub}`);
  check(/Heute · Workout 10/.test(await f.txt('.hero-eyebrow')) && sub === 'Hanteln · 5 + 1 Übungen · 15 + 4 Sätze',
    `Z19 Nacharbeit und Zusatz in einem Kopf („${sub}")`);
  await f.klick('[data-act="show-list"]');
  const zeilen = await f.page.locator('article.ex .nach-warum').evaluateAll((z2) => z2.map((x) => [x.id, x.textContent.trim()]));
  console.log(`     ${zeilen.map(([i, t]) => `${i}: ${t}`).join(' | ')}`);
  check(zeilen.some(([i, t]) => i.startsWith('nw-') && /^\+1 nachgeholt/.test(t))
    && zeilen.some(([i, t]) => i.startsWith('zw-') && /^Nachgeholt aus Woche 2/.test(t)),
  'Z19 an der Planübung „+1 nachgeholt …", an der Zusatzübung „Nachgeholt aus Woche 2 …"');
  const zusId = await f.M(({ P }) => (P.workoutByNo(10, 'db').ex.find((x) => x.zusatz) || {}).id);
  await listeAbhaken(f, (n) => n !== '', 1);
  let st = await f.lies();
  check(!!st.log[10].nachFest && !!st.log[10].zusatz, 'Z19 nach dem ersten Haken stehen Nacharbeit und Zusatz beide fest');
  await f.klick('[data-act="hide-list"]');
  await f.klick('[data-act="mark-done"]', 400);
  st = await f.lies();
  const r = await f.M(({ P, D }, zid) => ({
    herkunft: P.offenInWoche(D.PLAN[10]).herkunft.filter((h) => h.n === 10).map((h) => h.id),
    nach: [...(P.nacharbeit(D.PLAN[10], 'db') || new Map()).keys()],
    zid,
  }), zusId);
  check(!r.herkunft.includes(zusId) && !r.nach.includes(zusId),
    `Z19 für Workout 11 ist der liegen gelassene Zusatz (${zusId}) kein Rückstand von Workout 10`);
  await ende(f);
});

/* ------------------------------------------------------------------ *
 * Z20 Kein Leersatz: eingefügt nur so viele Sätze, wie etwas bringen
 *
 * An Tobis Chin-ups stand „am Sa nur 1 von 3 Sätzen abgehakt", eingefügt
 * waren aber drei. Gemessen an Woche 2 („Woche davor" auf der Wochenkarte):
 * Workout 9 ganz, dazu k Sätze Chin-ups, festgehalten wie aus der App. Der
 * erste Satz reicht nicht, der zweite schließt Rücken und Bizeps, der dritte
 * bringt nichts mehr – deshalb sind es zwei (Z1, Z2).
 * ------------------------------------------------------------------ */
const mitChinups = (k) => {
  const z = kopie(VORLAGE);
  z.customs = [];
  const e = { mode: 'db', done: 'db', soll: {}, nach: {}, nachFest: { db: {}, bw: {} }, nachWarum: { db: {}, bw: {} },
    db: {}, bw: {}, startedOn: '2026-10-08', zusatz: { ...kopie(TOBI_ZUSATZ), ex: [{ id: 'chin-ups', sets: k, bwSets: k }] } };
  ['rumaenisches-kreuzheben', 'floor-press', 'fersenerhoehter-goblet-squat', 'haengendes-knieheben', 'reverse-fly'].forEach((id) => {
    e.soll[id] = 3;
    e.nach[id] = 0;
    e.db[id] = Array.from({ length: 3 }, () => ({ w: '20', done: true }));
  });
  e.db['chin-ups'] = Array.from({ length: k }, () => ({ w: '', done: true }));
  z.log[9] = e;
  return z;
};
await abschnitt('Z20', async () => {
  const davor = {};
  for (const k of [1, 2, 3]) {
    const f = await fall(`Z20 ${k} Chin-ups`, mitChinups(k));
    const karte = await wochenKarte(f);
    davor[k] = karte.davor;
    await ende(f);
  }
  console.log(`     Woche 2 im Ziel mit 1 / 2 / 3 Sätzen Chin-ups: ${davor[1]} / ${davor[2]} / ${davor[3]} von 14`);
  check(davor[1] < davor[2], `Z20 ein Satz reicht nicht (${davor[1]} gegen ${davor[2]})`);
  check(davor[2] === davor[3], `Z20 ein dritter Satz bringt nichts mehr (${davor[2]} gegen ${davor[3]})`);
});

/* ------------------------------------------------------------------ *
 * Z21 „Von vorn beginnen" und „Verlauf zurückholen"
 *
 * Der Träger der alten Runde blieb nach dem Neustart stehen und hing sich an
 * Workout 1 der neuen Runde – mit einem Datum in der Zukunft an der Übung und,
 * nach dem ersten Haken, als vergebener Zusatz der neuen Woche 2.
 * ------------------------------------------------------------------ */
await abschnitt('Z21', async () => {
  const f = await fall('Z21', VORLAGE);
  check(traeger(await f.lies()).length === 1, 'Z21 vorher steht der Träger');
  await f.tab('settings');
  await f.klick('[data-act="restart-plan"]', 500);
  await f.tab('dashboard');
  let st = await f.lies();
  const sub = await f.txt('.hero-sub');
  check(traeger(st).length === 0, 'Z21 nach „Von vorn beginnen" ist der Träger der alten Runde weg – ohne Neuladen');
  check(/Workout 1/.test(await f.txt('.hero-eyebrow')) && !/\+/.test(sub), `Z21 Workout 1 ohne Zusatz („${sub}")`);
  // Und hielte ihn doch jemand fest (eine Sicherung, ein Stand von vorher):
  // Workout 1 nimmt keinen Zusatztag einer Woche, die es im Protokoll nicht gibt.
  const r = await f.M(({ P, store }) => {
    store.saveCustom({ name: 'Zusatztag Woche 2', ex: [{ id: 'chin-ups', sets: 2 }] });
    return { b: P.zusatzBindung(), zus: P.workoutByNo(1, 'db').ex.filter((x) => x.zusatz).length };
  });
  check(r.b === null && r.zus === 0, 'Z21 ein übrig gebliebener Träger bindet nicht an Workout 1');
  await f.klick('[data-act="show-list"]');
  await listeAbhaken(f, () => true, 1);
  st = await f.lies();
  check(st.log[1] && st.log[1].zusatz === undefined && await f.M(({ P }) => P.zusatzVergeben(2)) === false,
    'Z21 der erste Haken in Workout 1 hält nichts fest; Woche 2 der neuen Runde behält ihren Zusatztag');
  await ende(f);

  // Zurückholen: Mit dem Verlauf ist Woche 2 wieder fertig, und der Träger
  // steht sofort so da, wie ihn der nächste Start rechnen würde – nicht erst
  // dann. (Workout 9 liegt danach in der Zukunft, der Neustart hat die Termine
  // auf heute gelegt; der Zusatztag steht deshalb allein und braucht zwei
  // Übungen. In Workout 5 ist dafür das Band-Seitheben liegen geblieben.)
  const zz = kopie(VORLAGE);
  zz.log[5].db['band-seitheben'] = zz.log[5].db['band-seitheben'].map(() => ({ w: '', done: false }));
  const g = await fall('Z21 zurück', zz);
  await g.tab('settings');
  await g.klick('[data-act="restart-plan"]', 500);
  check(traeger(await g.lies()).length === 0, 'Z21 zurück: nach dem Neustart kein Träger');
  await g.klick('[data-act="restore-round"]', 500);
  const sofort = traeger(await g.lies()).map((c) => [c.name, c.ex]);
  await g.neuLaden();
  const danach = traeger(await g.lies()).map((c) => [c.name, c.ex]);
  console.log(`     zurückgeholt: ${JSON.stringify(sofort)}`);
  check(sofort.length === 1 && gleich(sofort, danach),
    `Z21 zurück: „Verlauf zurückholen" rechnet ihn sofort, wie der nächste Start (${JSON.stringify(sofort)} / ${JSON.stringify(danach)})`);
  await ende(g);

  // Eine Sicherung mit einem Zusatz der Woche 2 in Workout 1: zählt nicht.
  const z = kopie(VORLAGE);
  z.log = { 1: { ...kopie(VORLAGE.log[1]), zusatz: kopie(TOBI_ZUSATZ) } };
  z.log[1].db['chin-ups'] = [{ w: '', done: true }, { w: '', done: true }];
  z.customs = [];
  const h = await fall('Z21 Sicherung', z);
  const r2 = await h.M(({ P, store }) => ({ vergeben: P.zusatzVergeben(2), zaehlt: P.zusatzZaehlt(1, P.festerZusatz(store.getState().log[1])) }));
  check(r2.vergeben === false && r2.zaehlt === false, `Z21 ein Zusatz in oder vor seiner Woche zählt nicht für sie (${JSON.stringify(r2)})`);
  await ende(h);

  // Und wenn die Runde bei offener App weiterrollt (rundeWeiter() beim
  // Zurückkommen, am selben Tag): Der Träger, den der Abschluss der letzten
  // Woche angelegt hat, gehört zur alten Runde – wie nach „Von vorn beginnen".
  // (Der aus der Vorlage für Woche 2 steht dann auch noch da.)
  const k = await fall('Z21 Runde', VORLAGE);
  const vor = await k.M(({ P, D, store }) => {
    D.PLAN.filter((w) => !P.completedMode(w.n)).forEach((w) => store.completeWorkout(w.n, 'db', P.exOf(w, 'db')));
    const letzte = Math.ceil(D.PLAN.length / P.WEEK_SESSIONS);
    store.saveCustom({ name: `Zusatztag Woche ${letzte}`, ex: [{ id: 'chin-ups', sets: 3 }, { id: 'face-pull', sets: 3 }] });
    return { alle: D.PLAN.every((w) => P.completedMode(w.n)), traeger: store.customs().filter((c) => /^Zusatztag/.test(c.name)).length };
  });
  await k.page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await k.page.waitForTimeout(400);
  const st3 = await k.lies();
  check(vor.alle && vor.traeger >= 1 && Object.keys(st3.log || {}).length === 0,
    `Z21 Runde: alle Einheiten fertig, beim Zurückkommen rollt die Runde weiter (${JSON.stringify(vor)}, Protokoll ${Object.keys(st3.log || {}).length})`);
  check(traeger(st3).length === 0, `Z21 Runde: der Träger der alten Runde ist sofort weg (${traeger(st3).map((c) => c.name).join(', ') || 'keiner'})`);
  await ende(k);
});

/* ------------------------------------------------------------------ *
 * Z22 Gerätevorrat: Klimmzugstange ab- und wieder anwählen
 * ------------------------------------------------------------------ */
const stange = async (f) => {
  await f.tab('settings');
  await f.klick('[data-act="vorrat-seite"][data-v="bw"]');
  await f.klick('[data-act="toggle-vorrat"][data-v="stange"]', 400);
};
const stimmig = (f) => f.M(({ P, store }) => {
  const c = store.customs().find((x) => /^Zusatztag/.test(x.name));
  const zus = P.workoutByNo(9, 'db').ex.filter((x) => x.zusatz).map((x) => x.id);
  return { traeger: c ? c.ex.map((x) => x.id) : [], zus, ok: !c || c.ex.every((x) => zus.includes(x.id)) };
});
await abschnitt('Z22', async () => {
  const f = await fall('Z22', VORLAGE);
  await stange(f);
  await f.tab('dashboard');
  const sub = await f.txt('.hero-sub');
  const r = await stimmig(f);
  console.log(`     ohne Stange: ${sub} · Träger ${r.traeger.join(', ') || '–'} · in Workout 9 ${r.zus.join(', ') || '–'}`);
  check(r.ok, 'Z22 ohne Stange wird der Träger neu gerechnet – er nennt nichts, was nicht in Workout 9 steht');
  await f.tab('stats');
  check(!/Chin-ups/.test(await f.txt('#volWeek')), 'Z22 die Wochenkarte behauptet keine Chin-ups in Workout 9');
  // Ein Träger, von dem heute nichts in die Einheit passt: Die Karte sagt
  // das, statt seine Übungen als „holt Workout 9 heute nach" auszugeben.
  await f.M(({ store }) => store.saveCustom({ name: 'Zusatztag Woche 2', ex: [{ id: 'chin-ups', sets: 2 }] }));
  await f.tab('dashboard');
  await f.tab('stats');
  const hinweis = await f.txt('#volWeek .zusatz-hinweis');
  check(!/holt Workout 9 heute nach/.test(hinweis) && /In Workout 9 geht davon heute nichts/.test(hinweis),
    `Z22 nichts angekommen, nichts behauptet („${hinweis}")`);
  await stange(f);
  await f.tab('dashboard');
  const sub2 = await f.txt('.hero-sub');
  check(sub2 === 'Hanteln · 5 + 1 Übungen · 15 + 2 Sätze' && (await stimmig(f)).ok,
    `Z22 mit Stange kommen die Chin-ups zurück („${sub2}")`);
  await ende(f);
});

/* ------------------------------------------------------------------ *
 * Z23 Eine Sitzung auf dem Träger
 *
 * Standardplan, Woche 1 mit Lücken, Workout 4 am Do. Fr ist Ruhetag: der
 * Zusatztag allein, Start getippt, nichts abgehakt. So ist Workout 5 fällig,
 * und der Zusatztag steckt darin. Vorher stand dort „Zusatztag Woche 1 läuft
 * noch. ▶︎ Zurück zu Zusatztag Woche 1", im Kreis, und nach dem ersten Satz
 * „Eigenes Workout läuft noch".
 * ------------------------------------------------------------------ */
await abschnitt('Z23', async () => {
  const leer = await fall('Z23 Aufbau', null);
  const zustand = await leer.M(({ D }, heute) => {
    const plan = D.PLANS.standard.plan;
    const tage = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);
    const add = (iso, k) => new Date(Date.parse(iso) + k * 864e5).toISOString().slice(0, 10);
    const shift = tage(plan[4].date, add(heute, 3));
    const log = {};
    plan.slice(0, 4).forEach((w, i) => {
      const e = { mode: 'db', soll: {}, nach: {}, nachFest: { db: {}, bw: {} }, db: {}, bw: {}, done: 'db',
        startedOn: i === 3 ? heute : add(w.date, shift - 1) };
      w.ex.forEach((it, k) => {
        e.soll[it.id] = it.sets;
        e.nach[it.id] = 0;
        const an = i < 3 && k >= w.ex.length - 2 ? 0 : it.sets;
        e.db[it.id] = Array.from({ length: it.sets }, (_, s) => ({ w: s < an ? '20' : '', done: s < an }));
      });
      log[w.n] = e;
    });
    return { greeted: true, setupDone: true, name: 'T', focus: 'standard', level: 'geuebt', mode: 'db',
      supersatz: false, planStand: { standard: D.PLANS.standard.stand }, planSaetze: { standard: D.PLANS.standard.saetze },
      shift, log };
  }, '2026-10-08');
  await leer.ctx.close();
  const f = await fall('Z23', zustand, '2026-10-09T17:00:00+02:00');
  check(/Heute · Zusatztag$/.test(await f.txt('.hero-eyebrow')), `Z23 Fr: der Zusatztag allein („${await f.txt('.hero-eyebrow')}")`);
  await f.klick('[data-act="start-session"]', 400);
  const traegerId = (await f.lies()).session?.n;
  check(typeof traegerId === 'string' && traegerId.startsWith('c'), `Z23 Fr: die Sitzung steht auf dem Träger (${traegerId})`);
  await f.uhr('2026-10-11T17:00:00+02:00');
  await f.neuLaden();
  let st = await f.lies();
  const sub = await f.txt('.hero-sub');
  console.log(`     So: ${await f.txt('.hero-eyebrow')} · ${sub} · Sitzung ${JSON.stringify(st.session)}`);
  check(/Heute · Workout 5/.test(await f.txt('.hero-eyebrow')) && /\d \+ \d Übungen/.test(sub), 'Z23 So: der Zusatztag steckt in Workout 5');
  check(st.session === null && await f.page.locator('.laeuft-woanders').count() === 0
    && await f.page.locator('[data-act="start-session"]').count() === 1,
  'Z23 So: keine Sitzung auf dem Träger, kein „läuft noch", ein Start');
  // Und wenn doch eine stehen geblieben ist (über Mitternacht offen, ohne
  // Prüfung): Der erste Satz, der den Träger verbraucht, nimmt sie mit.
  await f.M(({ store }, id) => store.startSession(id), traegerId);
  await f.tab('stats');
  await f.tab('dashboard');
  check(await f.page.locator('.laeuft-woanders').count() === 1, 'Z23 (gestellt) die Sitzung steht wieder auf dem Träger');
  await f.klick('[data-act="show-list"]');
  await listeAbhaken(f, () => true, 1);
  await f.klick('[data-act="hide-list"]');
  st = await f.lies();
  check(!!st.log[5]?.zusatz && traeger(st).length === 0 && (st.session === null || st.session.n !== traegerId)
    && await f.page.locator('.laeuft-woanders').count() === 0,
  `Z23 der erste Satz verbraucht den Träger samt seiner Sitzung (Sitzung ${JSON.stringify(st.session)})`);
  await ende(f);
});

/* ------------------------------------------------------------------ *
 * Z24 Termine
 *
 * Bouldern schont Rücken, Bizeps, Schultern. Der Plan nimmt an so einem Tag
 * heraus, was sie direkt trifft – und der Zusatz darf sie dann auch nicht
 * treffen. Vorher kam mit Bouldern am Fr die Inverted Row dazu.
 * ------------------------------------------------------------------ */
const terminTreffer = (f) => f.M(({ P }) => import('./js/termine.js').then((T) => import('./js/uebung.js').then((U) => {
  const g = T.geschont('2026-10-08').gruppen;
  const zus = P.workoutByNo(9, 'db').ex.filter((x) => x.zusatz);
  return { geschont: [...g], zus: zus.map((x) => x.id),
    treffer: zus.flatMap((x) => U.directOf(x.id).filter((m) => g.has(m)).map((m) => `${x.id}:${m}`)) };
})));
await abschnitt('Z24', async () => {
  const z = kopie(VORLAGE);
  z.termine = [{ datum: '2026-10-09', name: 'Bouldern', aktivitaet: 'bouldern', minuten: 90 }];
  const f = await fall('Z24 Fr', z);
  const r = await terminTreffer(f);
  await f.klick('[data-act="show-list"]');
  const notiz = (await f.alle('.injury-note')).join(' ');
  console.log(`     Bouldern Fr: geschont ${r.geschont.join(', ')} · Zusatz ${r.zus.join(', ') || '–'} · ${await f.txt('.focus-count')}`);
  check(/Rücksicht auf: Bouldern/.test(notiz) && /Reverse Fly/.test(notiz), 'Z24 der Plan nimmt den Reverse Fly heraus');
  check(r.treffer.length === 0, `Z24 und der Zusatz trifft keine geschonte Gruppe (${r.treffer.join(', ') || 'keine'})`);
  check((await stimmig(f)).ok, 'Z24 der Träger nennt nichts, was nicht in der Einheit steht');
  await ende(f);

  // Was ein Termin schont, ist auch kein Nutzen. Zwei Stunden Boxen am Fr
  // schonen am Do unter anderem hintere Schulter und Nacken, aber weder Rücken
  // noch Bizeps; der Plan nimmt den Reverse Fly heraus, und damit ruhen die
  // beiden nicht mehr über die Einheit. Zählten ihre Nebenanteile als Nutzen,
  // gewönnen die Pull-ups (Nacken 0,35, hintere Schulter 0,2 je Satz) vor den
  // Chin-ups – genau mit der Last auf den Gruppen, die geschont werden sollen.
  const zb = kopie(VORLAGE);
  zb.termine = [{ datum: '2026-10-09', name: 'Boxen', aktivitaet: 'boxen', minuten: 120 }];
  const b = await fall('Z24 Boxen', zb);
  const rb = await b.M(({ P, store }) => {
    const c = store.customs().find((x) => /^Zusatztag/.test(x.name));
    return { traeger: c ? c.ex.map((x) => `${x.id}×${x.sets}`) : [],
      plan: P.workoutByNo(9, 'db').ex.filter((x) => !x.zusatz).map((x) => x.id) };
  });
  console.log(`     Boxen Fr: Plan ${rb.plan.join(', ')} · Träger ${rb.traeger.join(', ') || '–'}`);
  check(!rb.plan.includes('reverse-fly') && gleich(rb.traeger, ['chin-ups×2']),
    `Z24 Boxen: Nebenanteile auf geschonten Gruppen entscheiden nichts – Chin-ups ×2, keine Pull-ups (${rb.traeger.join(', ') || '–'})`);
  await ende(b);

  // Erst nach dem Laden eingetragen – heute Bouldern –, und wieder entfernt.
  const g = await fall('Z24 neu', VORLAGE);
  await g.tab('settings');
  await g.klick('[data-act="termin-akt"][data-v="bouldern"]');
  await g.klick('[data-act="termin-neu"]', 400);
  await g.tab('dashboard');
  const r2 = await terminTreffer(g);
  const s2 = await stimmig(g);
  console.log(`     eingetragen: ${await g.txt('.hero-sub')} · Träger ${s2.traeger.join(', ') || '–'}`);
  check(r2.treffer.length === 0 && s2.ok, 'Z24 „eintragen" rechnet den Träger neu: nichts Geschontes, nichts Behauptetes');
  await g.tab('settings');
  await g.klick('[data-act="termin-weg"]', 400);
  await g.tab('dashboard');
  const sub = await g.txt('.hero-sub');
  check(sub === 'Hanteln · 5 + 1 Übungen · 15 + 2 Sätze', `Z24 „Entfernen" holt die Chin-ups zurück („${sub}")`);
  await ende(g);

  // Fest, dann der Termin: Die unberührten Chin-ups fallen weg – und die
  // Notiz sagt es, in derselben Zeile wie beim Plan.
  const h = await fall('Z24 fest', VORLAGE);
  await h.klick('[data-act="show-list"]');
  await listeAbhaken(h, (n) => n !== 'Chin-ups', 1);
  await h.M(({ store }) => store.setSetting('termine', [{ datum: '2026-10-09', name: 'Bouldern', aktivitaet: 'bouldern', minuten: 90 }]));
  await h.klick('[data-act="hide-list"]');
  await h.klick('[data-act="show-list"]');
  const notiz3 = (await h.alle('.injury-note')).join(' ');
  check(/Heute fällt deshalb weg:.*Chin-ups \(nachgeholt aus Woche 2\)/.test(notiz3),
    `Z24/M9 die weggefallenen Chin-ups stehen in der Termin-Notiz („${notiz3.slice(0, 140)}")`);
  await ende(h);
});

/* ------------------------------------------------------------------ *
 * Z25 Fester Zusatz, danach Beschwerde oder fehlendes Gerät
 *
 * Der Zusatz ist mit dem ersten Satz vergeben und wird nicht ersetzt. Fällt
 * eine seiner Übungen danach weg, sagt die Notiz es – wie bei einer Planübung.
 * ------------------------------------------------------------------ */
await abschnitt('Z25', async () => {
  const f = await fall('Z25 Beschwerde', VORLAGE);
  await f.klick('[data-act="show-list"]');
  await listeAbhaken(f, (n) => n !== 'Chin-ups', 1);
  await f.M(({ store }) => store.toggleInjury('tennisarm', true));
  await f.klick('[data-act="hide-list"]');
  await f.klick('[data-act="show-list"]');
  const kopf = await f.txt('.focus-count');
  const notiz = (await f.alle('.injury-note')).join(' ');
  console.log(`     Tennisarm: ${kopf} · ${notiz.slice(0, 120)}`);
  check(kopf === '5 Übungen · 1/15 Sätze' && /Chin-ups \(nachgeholt aus Woche 2\) fällt aus/.test(notiz),
    'Z25 Tennisarm: die Chin-ups fallen weg, und die Rücksicht-Notiz nennt sie');
  await ende(f);

  const g = await fall('Z25 Gerät', VORLAGE);
  await g.klick('[data-act="show-list"]');
  await listeAbhaken(g, (n) => n !== 'Chin-ups', 1);
  await g.klick('#restSkip');   // die Pausenleiste liegt sonst über dem Schalter
  await stange(g);
  await g.tab('dashboard');
  // Der Reiter kommt in die Liste zurück, aus der er verlassen wurde.
  if (!(await g.page.locator('article.ex').count())) await g.klick('[data-act="show-list"]');
  const notiz2 = (await g.alle('.injury-note')).join(' ');
  check(/Nicht da: .*Klimmzugstange/.test(notiz2) && /Chin-ups \(nachgeholt aus Woche 2\) fällt aus/.test(notiz2),
    `Z25 ohne Stange: die Vorrat-Notiz nennt die Chin-ups („${notiz2.slice(0, 120)}")`);
  await ende(g);
});

/* ------------------------------------------------------------------ *
 * Platz: Die Startansicht bleibt eine Bildschirmseite, und in der
 * Fokusansicht liegt die Knopfreihe auch mit der Herkunftszeile und dem
 * Wechselhinweis ganz über der Leiste.
 * ------------------------------------------------------------------ */
await abschnitt('Platz', async () => {
  for (const [b, h] of [[414, 896], [360, 740]]) {
    const f = await fall(`Platz ${b}×${h}`, VORLAGE);
    await f.page.setViewportSize({ width: b, height: h });
    await f.neuLaden();
    const masse = () => f.page.evaluate(() => {
      const leiste = document.getElementById('tabbar').getBoundingClientRect();
      const set = document.querySelector('.focus-set');
      return { sichtbar: Math.min(window.innerHeight, leiste.height ? leiste.top : window.innerHeight),
        setUnten: set ? set.getBoundingClientRect().bottom : null,
        scroll: document.documentElement.scrollHeight - window.innerHeight,
        breit: document.documentElement.scrollWidth > window.innerWidth + 1 };
    });
    const start = await masse();
    check(start.scroll <= 0 && !start.breit, `${b}×${h} die Startansicht passt auf eine Seite (über ${start.scroll} px)`);
    await f.klick('[data-act="start-session"]', 400);
    const idx = await f.M(({ P }) => P.workoutByNo(9, 'db').ex.findIndex((x) => x.id === 'chin-ups'));
    await f.klick(`[data-act="focus-goto"][data-i="${idx}"]`, 300);
    await f.page.evaluate(() => window.scrollTo(0, 0));
    await f.page.waitForTimeout(150);
    const m = await masse();
    check(m.setUnten !== null && m.setUnten <= m.sichtbar && !m.breit,
      `${b}×${h} Chin-ups: Herkunft, Wechsel und Satzknöpfe auf einer Seite (Knopf unten ${Math.round(m.setUnten)}, sichtbar bis ${Math.round(m.sichtbar)})`);
    await f.page.screenshot({ path: path.join(SHOT, `zusatz-einheit-fokus-${b}x${h}.png`) });
    await ende(f);
  }
});

/* ------------------------------------------------------------------ *
 * Gemessen – für die README
 * ------------------------------------------------------------------ */
await abschnitt('Messung', async () => {
  const f = await fall('Messung', VORLAGE);
  const m = await f.M(({ P, D, G, S }) => {
    const w = D.PLAN[8];
    const plan = P.exOf(w, 'db');
    const ganz = P.workoutByNo(9, 'db').ex;
    const alt = [...plan, { id: 'pull-ups', sets: 3 }, { id: 'chin-ups', sets: 3 }];
    // Dieselbe Formel wie dauerLautFormel() in js/app.js: 40 s je Satz plus die
    // Pause der Übung, ohne die letzte Pause.
    const formel = (items) => {
      const pause = (id) => (D.EXERCISES.find((e) => e.id === id).db.rest || 120);
      return Math.round((items.reduce((a, it) => a + it.sets * (40 + pause(it.id)), 0) - pause(items[items.length - 1].id)) / 60);
    };
    const paar = (items) => S.paare(items.map((x) => P.resolve(x, 'db')), 'db').filter((g) => g.length === 2).length;
    const s = (items) => items.reduce((a, x) => a + x.sets, 0);
    return { saetze: [s(plan), s(ganz)], schritte: [G.ruestSchritte(plan), G.ruestSchritte(ganz)],
      paare: [paar(plan), paar(ganz)], minuten: [formel(plan), formel(ganz), formel(alt)] };
  });
  console.log(`     Tobi Do: Sätze ${m.saetze.join(' → ')} · Rüstschritte ${m.schritte.join(' → ')} · Paare ${m.paare.join(' → ')}`
    + ` · Formelzeit ohne Supersatz ${m.minuten[0]} → ${m.minuten[1]} min (Pull-ups + Chin-ups: ${m.minuten[2]} min)`);
  check(m.saetze[1] === 17 && m.schritte[0] === m.schritte[1], 'Messung: 17 Sätze, kein zusätzlicher Rüstschritt');
  await f.page.screenshot({ path: path.join(SHOT, 'zusatz-einheit-start.png') });
  await ende(f);
});

console.log(`\n${fails ? `${fails} FEHLER` : 'alle Prüfungen bestanden'}`);
await browser.close();
