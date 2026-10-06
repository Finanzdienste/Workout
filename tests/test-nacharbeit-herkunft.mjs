/*
 * An jedem Nachholsatz steht, woher er kommt.
 *
 *     „Jetzt vier Sätze je Übung? Wegen Wiederholung? Aber vorgestern hab ich
 *      ja goblet sqauds gemacht"
 *
 * Tobi, Montag, Workout 7 im Cut. Auf dem Bildschirm stand „4 Sätze × 8–12 ·
 * Beine · Kurzhantel · +1 nachgeholt". Die 4 las sich wie eine neue Grundzahl,
 * und wofür der Satz nachgeholt wird, stand nirgends – also suchte er den
 * Grund bei dem, was er zuletzt gemacht hatte, und fand einen Widerspruch.
 *
 * Jetzt steht die Satzzahl getrennt da („3 + 1 Sätze") und darunter eine
 * stille Zeile: der Tag und die Übung, die den Rückstand hinterlassen haben,
 * mit ihren Haken. Geprüft wird hier:
 *
 *   1. Wortlaut und Stelle – in der Fokusansicht, in der Liste, im Kopf.
 *   2. Supersatz: Die Zeile gehört nur zur gezeigten Übung.
 *   3. Kein Text ohne Nacharbeit.
 *   4. Eingefroren mit dem ersten Satz (`nachWarum` neben `nachFest`).
 *   5. Rückfall für Einheiten aus v233–v235 (nachFest ohne nachWarum) – mit
 *      der Rechnung von damals, sonst mit Wochentagen.
 *   6. Ohne Hanteln dasselbe; die Quelle heißt wie an ihrem Tag.
 *   7. Barrierefreiheit: Nur der Nachholsatz verweist auf die Zeile, und was
 *      ankommt, steht im Barrierefreiheitsbaum (nicht nur im Attribut).
 *   8. Platz: Der erste Satzknopf bleibt im Fenster.
 *
 * Gegenprobe: Ohne die Änderung fehlt `.nach-warum`, und „3 + 1" steht nicht
 * da – die Prüfungen 1, 4, 5, 6 und 7 schlagen fehl. Gegen 9808cf7 (die erste
 * Fassung dieser Zeile) schlagen 5b, 5c, 6b und 7 fehl.
 */
import { chromium } from 'playwright';
import { URL, SHOT } from './umgebung.mjs';
import path from 'node:path';

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 414, height: 896 }, serviceWorkers: 'block' });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()); });
page.on('dialog', (d) => d.accept().catch(() => {}));
let fails = 0;
const check = (c, m) => { console.log(`${c ? 'OK  ' : 'FAIL'} ${m}`); if (!c) { fails++; process.exitCode = 1; } };
await page.clock.setFixedTime(new Date('2026-10-05T15:40:00Z'));

/**
 * Den Zustand genau einmal säen, beim nächsten Laden. Ein Init-Skript läuft vor
 * dem App-Code und gewinnt gegen das, was die App beim Verlassen der Seite noch
 * wegschreibt; die Marke in sessionStorage sorgt dafür, dass ein späteres
 * Neuladen behält, was die App selbst geschrieben hat.
 */
let saat = 0;
const saeEinmal = async (z) => {
  const marke = `saat-${++saat}`;
  await page.addInitScript(([s, mk]) => {
    if (sessionStorage.getItem(mk)) return;
    sessionStorage.setItem(mk, '1');
    localStorage.setItem('workout.state.v1', JSON.stringify(s));
  }, [z, marke]);
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(250);
};
const lies = () => page.evaluate(() => JSON.parse(localStorage.getItem('workout.state.v1') || '{}'));
const txt = async (sel) => ((await page.locator(sel).first().textContent().catch(() => '')) || '').replace(/\s+/g, ' ').trim();

await page.goto(URL, { waitUntil: 'networkidle' });
const tobi = await page.evaluate(async () => {
  const { PLANS } = await import('./js/data.js');
  return {
    greeted: true, setupDone: true, name: 'Tobi', focus: 'cut', mode: 'db', supersatz: true,
    level: 'geuebt', shift: 31,
    planStand: { cut: PLANS.cut.stand }, planSaetze: { cut: PLANS.cut.saetze },
  };
});
await saeEinmal({ ...tobi, log: {} });

const tagDer = { 1: '2026-09-24', 2: '2026-09-26', 3: '2026-09-28', 4: '2026-09-29',
  5: '2026-10-01', 6: '2026-10-03' };
/** Protokoll wie von der App: `soll`/`nach` für jede Übung, `nachFest`. */
const baue = (spez) => page.evaluate(async ([sp, tage]) => {
  const P = await import('./js/plan.js');
  const { PLAN } = await import('./js/data.js');
  const log = {};
  Object.entries(sp).forEach(([n, s]) => {
    const e = { mode: 'db', done: 'db', soll: {}, nach: {}, nachFest: { db: {}, bw: {} }, db: {}, bw: {},
      startedOn: tage[n] };
    P.exBasis(PLAN[n - 1], 'db').forEach((it) => {
      const k = (s.haken || {})[it.id] ?? it.sets;
      e.soll[it.id] = it.sets;
      e.nach[it.id] = 0;
      e.db[it.id] = Array.from({ length: it.sets }, (_, i) => ({ w: i < k ? '12' : '', done: i < k }));
    });
    log[n] = e;
  });
  return log;
}, [spez, tagDer]);

// Fall B: Workout 1–5 voll, Samstag (Workout 6) abgeschlossen mit Goblet 2/3,
// Liegestütze 3/3, Chin-ups, Knieheben und Reverse Fly gar nicht.
const fallB = await baue({ 1: {}, 2: {}, 3: {}, 4: {}, 5: {},
  6: { haken: { 'goblet-squat': 2, 'chin-ups': 0, 'haengendes-knieheben': 0, 'reverse-fly': 0 } } });

/** Zur Einheit n blättern (Startansicht). */
const zuEinheit = async (n) => {
  const zurueck = page.locator('[data-act="focus-list"]');
  if (await zurueck.count()) { await zurueck.first().click(); await page.waitForTimeout(120); }
  const zu = page.locator('[data-act="hide-list"]');
  if (await zu.count()) { await zu.first().click(); await page.waitForTimeout(120); }
  for (let i = 0; i < 20; i++) {
    const t = await txt('.hero-eyebrow');
    const jetzt = Number((t.match(/Workout (\d+)/) || [])[1] || 0);
    if (jetzt === n) return true;
    const knopf = page.locator(`[data-act="nav-workout"][data-delta="${jetzt < n ? 1 : -1}"]:not([disabled])`);
    if (!(await knopf.count())) return false;
    await knopf.first().click();
    await page.waitForTimeout(100);
  }
  return false;
};
/** Die Karten der Liste: Name, Meta, Herkunftszeile. */
const karten = () => page.locator('article.ex').evaluateAll((els) => els.map((el) => {
  const t = (s) => ((el.querySelector(s) || {}).textContent || '').replace(/\s+/g, ' ').trim();
  return { name: t('.ex-name'), meta: t('.ex-meta'), warum: t('.nach-warum') };
}));
/** In der Fokusansicht zur Übung `name` blättern und lesen, was dort steht. */
const fokusBei = async (name) => {
  for (let k = 0; k < 8; k++) {
    if ((await txt('.focus-name')) === name) break;
    const weiter = page.locator('[data-act="focus-step"][data-d="1"]:not([disabled])');
    if (!(await weiter.count())) break;
    await weiter.first().click();
    await page.waitForTimeout(150);
  }
  return {
    name: await txt('.focus-name'), meta: await txt('.focus-meta'),
    warum: await txt('.nach-warum'), zeilen: await page.locator('.nach-warum').count(),
    sup: await txt('.super-hin'),
  };
};
const fokusAnfang = async () => {
  for (let k = 0; k < 8; k++) {
    const zurueck = page.locator('[data-act="focus-step"][data-d="-1"]:not([disabled])');
    if (!(await zurueck.count())) break;
    await zurueck.first().click();
    await page.waitForTimeout(120);
  }
};

// --- 1. Wortlaut und Stelle ----------------------------------------------
await saeEinmal({ ...tobi, log: fallB });
check(await zuEinheit(7), 'Workout 7 ist zu erreichen');
const titel = await txt('.hero-title');
const kopf = await txt('.hero-sub');
console.log(`     ${titel} · ${kopf}`);
check(/12 \+ 3 Sätze/.test(kopf), `im Kopf der Einheit: Grundzahl und Nachgeholtes getrennt („${kopf}")`);

await page.locator('[data-act="show-list"]').click();
await page.waitForTimeout(250);
const liste = await karten();
liste.forEach((k) => console.log(`     ${k.name} | ${k.meta}${k.warum ? ` | ${k.warum}` : ''}`));
const gL = liste.find((k) => k.name === 'Goblet Squat') || {};
const fL = liste.find((k) => k.name === 'Face Pull') || {};
check(/^3 \+ 1 ×/.test(gL.meta || ''), `Liste: Goblet Squat „3 + 1 ×" („${gL.meta}")`);
check(!/nachgeholt/.test(gL.meta || ''), 'Liste: die Meta-Zeile sagt nicht mehr „nachgeholt" – das steht in der Zeile darunter');
check(/am Sa nur 2 von 3 Sätzen abgehakt/.test(gL.warum || ''), `Liste: Goblet „…am Sa nur 2 von 3 Sätzen abgehakt" („${gL.warum}")`);
check(/Reverse Fly \(Sa 0 von 3\)/.test(fL.warum || ''), `Liste: Face Pull nennt den Reverse Fly vom Samstag („${fL.warum}")`);
// --- 3. Kein Text ohne Nacharbeit
const ohne = liste.filter((k) => !/\+ \d/.test(k.meta));
check(ohne.length > 0 && ohne.every((k) => !k.warum),
  `Übungen ohne Nacharbeit haben keine Zeile (${ohne.map((k) => k.name).join(', ')})`);
check(liste.filter((k) => k.warum).length === 3, 'genau drei Zeilen für drei Nachholsätze');
check(liste.every((k) => !/Woche/.test(k.warum)), 'kein Wort „Woche" in der Zeile');

// Fokusansicht
await page.locator('[data-act="start-session"]').first().click();
await page.waitForTimeout(400);
const gF = await fokusBei('Goblet Squat');
console.log(`     Fokus: ${gF.name} | ${gF.meta} | ${gF.warum} | ${gF.sup}`);
check(/3 \+ 1 Sätze/.test(gF.meta) && !/nachgeholt/.test(gF.meta), `Fokus: Goblet „3 + 1 Sätze", ohne „nachgeholt" in der Meta-Zeile („${gF.meta}")`);
check(/am Sa nur 2 von 3 Sätzen abgehakt/.test(gF.warum), `Fokus: darunter die Herkunft („${gF.warum}")`);
// --- 2. Supersatz: nur die gezeigte Übung
check(gF.zeilen === 1, `Fokus: genau eine Herkunftszeile – die der gezeigten Übung (${gF.zeilen})`);
check(!/nachgeholt/.test(gF.sup), `der Wechselhinweis bleibt, wie er war („${gF.sup}")`);
const reihe = await page.evaluate(() => {
  const m = document.querySelector('.focus-meta');
  const z = document.querySelector('.nach-warum');
  const s = document.querySelector('.super-hin');
  // 4 = DOCUMENT_POSITION_FOLLOWING: b steht im Dokument nach a.
  const pos = (a, b) => !!(a && b && (a.compareDocumentPosition(b) & 4));
  return { metaVorZeile: pos(m, z), zeileVorSuper: !s || pos(z, s), alert: !!document.querySelector('.nach-warum[role], .nach-warum[aria-live]') };
});
check(reihe.metaVorZeile && reihe.zeileVorSuper, 'die Zeile steht direkt unter der Satzzahl, vor dem Wechselhinweis');
check(!reihe.alert, 'keine Ansage, kein role/aria-live – eine stille Zeile');
// --- 7. Barrierefreiheit
// Gelesen aus dem Barrierefreiheitsbaum (CDP), nicht aus den Attributen: In
// der ersten Fassung stand an „3 + 1" ein aria-label auf einem <span>. Ein Name
// ohne Rolle ist in ARIA nicht vorgesehen; im Baum stand der Text „3 + 1"
// daneben weiter, und wo der Name ankam, hieß es „3 Sätze plus 1 nachgeholter
// Sätze". Und alle vier Knöpfe trugen die Herkunft als Beschreibung, auch
// Satz 1 bis 3.
const cdp = await ctx.newCDPSession(page);
const { nodes: ax } = await cdp.send('Accessibility.getFullAXTree');
const sichtbar = ax.filter((k) => !k.ignored);
const axKnoepfe = sichtbar.filter((k) => k.role?.value === 'button' && /^Satz \d von/.test(k.name?.value || ''))
  .map((k) => ({ name: k.name.value, desc: k.description?.value || '' }));
console.log('     Knöpfe:', axKnoepfe.map((k) => `${k.name}${k.desc ? ` [${k.desc}]` : ''}`).join(' | '));
check(axKnoepfe.length === 4 && /nachgeholt/.test(axKnoepfe[3].name) && axKnoepfe.slice(0, 3).every((k) => !/nachgeholt/.test(k.name)),
  `nur der vierte Knopf heißt „nachgeholt" („${axKnoepfe[3]?.name}")`);
check(axKnoepfe.length === 4 && /am Sa nur 2 von 3/.test(axKnoepfe[3].desc) && axKnoepfe.slice(0, 3).every((k) => !k.desc),
  'nur der Nachholsatz trägt die Herkunft als Beschreibung – Satz 1 bis 3 nicht');
const benannt = sichtbar.filter((k) => /nachgeholter/.test(k.name?.value || ''));
check(benannt.length === 0, `kein Knoten mit einem Namen „… nachgeholter …" (${benannt.map((k) => k.role?.value).join(', ')})`);
const metaText = sichtbar.filter((k) => k.role?.value === 'StaticText' && /^3 \+ 1 Sätze ×/.test(k.name?.value || ''));
check(metaText.length === 1, `die Meta-Zeile kommt als ein Text an („${metaText[0]?.name?.value}")`);
await cdp.detach();
const fF = await fokusBei('Face Pull');
console.log(`     Fokus: ${fF.name} | ${fF.meta} | ${fF.warum}`);
check(/Reverse Fly \(Sa 0 von 3\)/.test(fF.warum) && fF.zeilen === 1, `Fokus: Face Pull mit seiner eigenen Zeile („${fF.warum}")`);
const sz = await fokusBei('SZ-Curls');
check(sz.name === 'SZ-Curls' && sz.zeilen === 0 && !/\+/.test(sz.meta), `Fokus: SZ-Curls ohne Nacharbeit, ohne Zeile („${sz.meta}")`);
await fokusAnfang();
await page.evaluate(() => window.scrollTo(0, 0));
await page.screenshot({ path: path.join(SHOT, 'herkunft-414x896.png') });

// --- 4. Eingefroren mit dem ersten Satz ----------------------------------
// Ersten Goblet-Satz abhaken: Ab da stehen Nacharbeit *und* Herkunft fest.
await fokusBei('Goblet Squat');
await page.locator('.focus-set[aria-pressed="false"]').first().click();
await page.waitForTimeout(300);
let st = await lies();
const e7 = st.log[7] || {};
console.log('     nachFest:', JSON.stringify(e7.nachFest), '\n     nachWarum:', JSON.stringify(e7.nachWarum));
check(e7.nachWarum && e7.nachWarum.db && e7.nachWarum.db['goblet-squat'] && e7.nachWarum.bw,
  'mit dem ersten Satz ist die Herkunft festgehalten – für beide Varianten');
check(e7.nachWarum && Object.keys(e7.nachWarum.db).sort().join() === Object.keys(e7.nachFest.db).sort().join(),
  'und nur für die Übungen mit Nacharbeit');
const zeileVorher = gL.warum;
// Am Samstag wird der dritte Goblet-Satz nachgetragen. Die laufende Einheit
// behält ihre Sätze – und deshalb auch ihren Grund.
st.log[6].db['goblet-squat'][2] = { w: '12', done: true };
await saeEinmal(st);
await zuEinheit(7);
await page.locator('[data-act="show-list"]').click().catch(() => {});
await page.waitForTimeout(250);
const nachher = await karten();
const gN = nachher.find((k) => k.name === 'Goblet Squat') || {};
console.log(`     nach dem Nachtragen: ${gN.meta} | ${gN.warum}`);
check(/^3 \+ 1 ×/.test(gN.meta || ''), `die angefangene Einheit behält „3 + 1" („${gN.meta}")`);
check(gN.warum === zeileVorher, `und die Zeile wortgleich („${gN.warum}")`);

// --- 5. Einheiten aus v233–v235: nachFest ohne nachWarum -----------------
// a) Die Neurechnung ergibt genau die festgehaltene Nacharbeit: Dann darf sie
//    erklären.
const ohneWarum = JSON.parse(JSON.stringify(st));
ohneWarum.log[6].db['goblet-squat'][2] = { w: '', done: false };
delete ohneWarum.log[7].nachWarum;
await saeEinmal(ohneWarum);
await zuEinheit(7);
await page.locator('[data-act="show-list"]').click().catch(() => {});
await page.waitForTimeout(250);
const passt = (await karten()).find((k) => k.name === 'Goblet Squat') || {};
check(/am Sa nur 2 von 3 Sätzen abgehakt/.test(passt.warum || ''),
  `v233–v235, Neurechnung passt: die Herkunft wird nachgerechnet („${passt.warum}")`);
// b) Sie passt nicht (hier: festgehalten ist ein +1 auf den SZ-Curls, das
//    weder die Rechnung von damals noch die von heute ergibt). Dann nur die
//    Tage, aus denen es stammen kann – mit Wochentag wie der Rest der Zeile,
//    nicht „Rest aus Workout 5–6".
const passtNicht = JSON.parse(JSON.stringify(ohneWarum));
passtNicht.log[7].nachFest = { db: { 'sz-curls': 1 }, bw: { 'sz-curls': 1 } };
passtNicht.log[7].soll['sz-curls'] = 4;
passtNicht.log[7].nach['sz-curls'] = 1;
await saeEinmal(passtNicht);
await zuEinheit(7);
await page.locator('[data-act="show-list"]').click().catch(() => {});
await page.waitForTimeout(250);
const rueck = await karten();
const szR = rueck.find((k) => k.name === 'SZ-Curls') || {};
console.log(`     Rückfall: ${szR.meta} | ${szR.warum}`);
check(/^3 \+ 1 ×/.test(szR.meta || '') && szR.warum === '+1 nachgeholt: Rest vom Do und Sa',
  `Neurechnung passt nicht: „+1 nachgeholt: Rest vom Do und Sa" („${szR.warum}")`);
check(rueck.filter((k) => k.warum).length === 1, 'und keine Zeile an Übungen, die nur die Neurechnung nachholen würde');

// c) Der Übergang auf Tobis Telefon: Workout 7 unter v235 angefangen. Damals
//    stand am Samstag der Goblet Squat mit +1 da (für das Kreuzheben vom
//    Donnerstag, 2 von 3), Tobi machte alle vier, und v235 rechnete für
//    Montag – ohne Gutschrift – denselben Rückstand noch einmal: +1 auf
//    Goblet Squat, Rudern und Face Pull, festgehalten mit dem ersten Satz,
//    ohne `nachWarum`. Die heutige Rechnung kommt nie auf diese Sätze; die
//    erste Fassung fiel deshalb an allen drei Übungen auf „Rest aus Workout
//    5–6" zurück – am Goblet Squat, an dem die Frage entstand, ohne ein Wort
//    zum Donnerstag. Jetzt erklärt die Rechnung von damals (offenInWocheAlt()).
//    Der Samstag hier wie in Tobis Ablauf (test-nacharbeit.mjs, Abschnitt 11):
//    Goblet 4/4, Liegestütze 3/3, 1 Chin-up, 1 Knieheben, kein Reverse Fly.
const v235 = await page.evaluate(async ([sp, tage]) => {
  const P = await import('./js/plan.js');
  const { PLAN } = await import('./js/data.js');
  const log = {};
  Object.entries(sp).forEach(([n, s]) => {
    const e = { mode: 'db', soll: {}, nach: {}, nachFest: { db: { ...(s.fest || {}) }, bw: { ...(s.fest || {}) } },
      db: {}, bw: {}, startedOn: tage[n] };
    if (!s.offen) e.done = 'db';
    P.exBasis(PLAN[n - 1], 'db').forEach((it) => {
      const extra = (s.fest || {})[it.id] || 0;
      const soll = it.sets + extra;
      const k = (s.haken || {})[it.id] ?? soll;
      e.soll[it.id] = soll;
      e.nach[it.id] = extra;
      e.db[it.id] = Array.from({ length: soll }, (_, i) => ({ w: i < k ? '12' : '', done: i < k }));
    });
    log[n] = e;
  });
  return log;
}, [{ 1: {}, 2: {}, 3: {}, 4: {},
  5: { haken: { 'rumaenisches-kreuzheben': 2 } },
  6: { fest: { 'goblet-squat': 1 }, haken: { 'chin-ups': 1, 'haengendes-knieheben': 1, 'reverse-fly': 0 } },
  7: { offen: true, fest: { 'goblet-squat': 1, 'einarmiges-kh-rudern': 1, 'face-pull': 1 },
    haken: { 'goblet-squat': 1, 'einarmiges-kh-rudern': 0, 'face-pull': 0, 'sz-curls': 0 } } },
{ ...tagDer, 7: '2026-10-05' }]);
await saeEinmal({ ...tobi, log: v235 });
await zuEinheit(7);
await page.locator('[data-act="show-list"]').click().catch(() => {});
await page.waitForTimeout(250);
const ueber = await karten();
ueber.forEach((k) => console.log(`     v235-Übergang: ${k.name} | ${k.meta}${k.warum ? ` | ${k.warum}` : ''}`));
const gU = ueber.find((k) => k.name === 'Goblet Squat') || {};
check(/^3 \+ 1 ×/.test(gU.meta || '') && gU.warum === '+1 nachgeholt für Gesäß: Rumänisches Kreuzheben (Do 2 von 3)',
  `v235-Übergang: am Goblet Squat steht, woher v235 den Satz hatte („${gU.warum}")`);
check(ueber.filter((k) => k.warum).length === 3 && ueber.every((k) => !/Workout \d/.test(k.warum)),
  'und an allen drei Nachholsätzen eine Herkunft mit Tagen, keine Workout-Nummern');

// --- 6. Ohne Hanteln -----------------------------------------------------
const bw = JSON.parse(JSON.stringify({ ...tobi, mode: 'bw', log: fallB }));
await saeEinmal(bw);
await zuEinheit(7);
await page.locator('[data-act="show-list"]').click().catch(() => {});
await page.waitForTimeout(250);
const bwListe = await karten();
bwListe.forEach((k) => console.log(`     bw: ${k.name} | ${k.meta}${k.warum ? ` | ${k.warum}` : ''}`));
const bwNach = bwListe.filter((k) => /\+ \d/.test(k.meta));
check(bwNach.length > 0 && bwNach.every((k) => /^\+1 nachgeholt/.test(k.warum)),
  `ohne Hanteln trägt jede Übung mit Nacharbeit ihre Zeile (${bwNach.length})`);
check(bwListe.filter((k) => !/\+ \d/.test(k.meta)).every((k) => !k.warum), 'und die ohne keine');

// b) Die Quelle heißt so, wie sie an ihrem Tag hieß. Gefunden in der
//    Prüfung: Donnerstag ganz ohne Hanteln (Kreuzheben = Standwaage, 2 von 3),
//    heute Workout 6 mit Hanteln – die Zeile nannte „Rumänisches Kreuzheben",
//    das am Donnerstag niemand gemacht hat.
const ohneHantelDo = await page.evaluate(async (tag5) => {
  const P = await import('./js/plan.js');
  const { PLAN } = await import('./js/data.js');
  const e = { mode: 'bw', done: 'bw', soll: {}, nach: {}, nachFest: { db: {}, bw: {} }, db: {}, bw: {}, startedOn: tag5 };
  P.exBasis(PLAN[4], 'bw').forEach((it) => {
    const s = it.bwSets || it.sets;
    const k = it.id === 'rumaenisches-kreuzheben' ? 2 : s;
    e.soll[it.id] = s;
    e.nach[it.id] = 0;
    e.bw[it.id] = Array.from({ length: s }, (_, i) => ({ r: i < k ? '10' : '', done: i < k }));
  });
  return e;
}, tagDer[5]);
const bwLog = await baue({ 1: {}, 2: {}, 3: {}, 4: {} });
await saeEinmal({ ...tobi, log: { ...bwLog, 5: ohneHantelDo } });
await zuEinheit(6);
await page.locator('[data-act="show-list"]').click().catch(() => {});
await page.waitForTimeout(250);
const modusListe = await karten();
const gM = modusListe.find((k) => k.name === 'Goblet Squat') || {};
console.log(`     Do ohne Hanteln: ${gM.name} | ${gM.meta} | ${gM.warum}`);
check(/Einbeiniges Kreuzheben \(Standwaage\) \(Do/.test(gM.warum || '') && !/Rumänisches/.test(gM.warum || ''),
  `die Quelle heißt wie am Donnerstag: Standwaage („${gM.warum}")`);

// Kein Text, wo es keine Nacharbeit gibt: Workout 6 selbst (Block-Anfang ohne Rückstand davor).
await saeEinmal({ ...tobi, log: await baue({ 1: {}, 2: {}, 3: {}, 4: {}, 5: {} }) });
await zuEinheit(6);
await page.locator('[data-act="show-list"]').click().catch(() => {});
await page.waitForTimeout(250);
const sauber = await karten();
check(sauber.length > 0 && sauber.every((k) => !k.warum && !/\+ \d/.test(k.meta)),
  `ohne Rückstand: keine Zeile, keine „+" (${sauber.length} Übungen)`);
check(!/\+ \d+ Sätze/.test(await txt('.hero-sub')), `und der Kopf zeigt eine einzige Zahl („${await txt('.hero-sub')}")`);

// --- 8. Platz ------------------------------------------------------------
// Der obere Teil der Fokusansicht ist eine feste Seite bis zu den
// Satzknöpfen (section.fo). Die neue Zeile kostet eine bis zwei Zeilen;
// die Figur nimmt nur den Rest und schrumpft. Der erste Satzknopf muss ganz
// im Fenster bleiben.
const platz = [];
// Wie weit die Knopfreihe bei 360×640 schon *ohne* die Zeile unter der Leiste
// lag, gemessen am Stand v235 (48c705e) mit demselben Zustand (Fall B):
// Goblet Squat bis 600 bei sichtbar bis 581, also 19 px verdeckt – mit
// Gewichtszeile, Aufbau- und Aufwärmhinweis ist die Seite dort schon voll, und
// die Figur steht auf ihrem Mindestmaß. Face Pull (ohne Gewichtszeile) bis 570.
// Mit der Zeile gemessen: Goblet 599 (die Meta-Zeile ist ohne „· +1
// nachgeholt" kürzer und bricht nicht mehr um), Face Pull 581.
const VORHER_640 = { 'Goblet Squat': 19, 'Face Pull': 0 };
for (const [b, h] of [[414, 896], [390, 844], [360, 740], [360, 640]]) {
  await page.setViewportSize({ width: b, height: h });
  await saeEinmal({ ...tobi, log: fallB });
  await zuEinheit(7);
  await page.locator('[data-act="start-session"]').first().click();
  await page.waitForTimeout(400);
  // Goblet Squat (kurze Zeile) und Face Pull (die längste in Fall B).
  for (const [uebung, kurz] of [['Goblet Squat', 'goblet'], ['Face Pull', 'facepull']]) {
    await fokusBei(uebung);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(150);
    const m = await page.evaluate(() => {
      const r = (s) => { const el = document.querySelector(s); return el ? el.getBoundingClientRect() : null; };
      const fo = r('section.fo');
      const fig = r('.focus-fig');
      const set = r('.focus-set');
      const zeile = r('.nach-warum');
      // Sichtbar ist nur, was über der festen Leiste unten liegt.
      const leiste = r('#tabbar');
      const sichtbar = Math.min(window.innerHeight, leiste && leiste.height ? leiste.top : window.innerHeight);
      const breit = document.documentElement.scrollWidth > window.innerWidth + 1;
      return { fo: Math.round(fo.height), fig: Math.round(fig.height), zeile: zeile ? Math.round(zeile.height) : 0,
        setUnten: Math.round(set.bottom), sichtbar: Math.round(sichtbar), breit };
    });
    platz.push({ b, h, uebung, ...m });
    console.log(`     ${b}×${h} ${uebung}: section.fo ${m.fo} px, Figur ${m.fig} px, Zeile ${m.zeile} px, erster Satzknopf unten bei ${m.setUnten}, sichtbar bis ${m.sichtbar}${m.breit ? ', WAAGRECHT ZU BREIT' : ''}`);
    if (h > 640) {
      check(m.setUnten <= m.sichtbar, `${b}×${h} ${uebung}: der erste Satzknopf liegt ganz im sichtbaren Teil`);
    } else {
      // 360×640: Schon vor dieser Änderung lag die Knopfreihe hier zum Teil
      // unter der Leiste (gemessen am Stand v235, siehe Commit) – ein eigener
      // Befund, kein Grund, die Zeile zu kürzen. Festgehalten wird, dass sie
      // nicht mehr verdeckt als vorher: höchstens so viel wie die Zeile hoch ist.
      check(m.setUnten - m.sichtbar <= VORHER_640[uebung] + m.zeile,
        `${b}×${h} ${uebung}: Knopfreihe ${Math.max(0, m.setUnten - m.sichtbar)} px unter der Leiste (vorher ${VORHER_640[uebung]} px)`);
    }
    check(!m.breit, `${b}×${h} ${uebung}: nichts läuft seitlich über`);
    check(m.zeile > 0 && m.zeile <= 40, `${b}×${h} ${uebung}: die Zeile hat höchstens zwei Zeilen (${m.zeile} px)`);
    await page.screenshot({ path: path.join(SHOT, `herkunft-fokus-${kurz}-${b}x${h}.png`) });
  }
}

check(errs.length === 0, `keine Fehler${errs.length ? ': ' + errs.slice(0, 2).join(' | ') : ''}`);
console.log(`\n${fails ? fails + ' FEHLER' : 'alle Prüfungen bestanden'}`);
await browser.close();
