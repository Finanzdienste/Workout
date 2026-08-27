/*
 * Wiederholungen und Pause je Erfahrungsstufe.
 *
 * Bei fast jeder Übung braucht es das nicht: Der Anfänger nimmt die Hälfte des
 * Gewichts und trifft damit denselben Wiederholungsbereich. Klimmzüge kennen
 * diesen Hebel nicht – dort *ist* das Körpergewicht die Last. Wer eine
 * Wiederholung schafft, bekam eine Vorgabe von 5–10 und konnte sie nicht
 * erfüllen; die Zahl war damit von einer Ansage zu einem Vorwurf geworden.
 *
 * Drei Dinge müssen stimmen, und das dritte ist das, was man leicht übersieht:
 * Die Statistik rechnet mit dem *geplanten* Wiederholungswert. Bliebe sie bei
 * der Vorgabe für Geübte, würde sie dem Anfänger jeden Satz mit fünf statt
 * einer Wiederholung gutschreiben – und ihn über die Tonnage zu früh
 * aufsteigen lassen.
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

const stellen = async (level) => {
  await page.evaluate((l) => localStorage.setItem('workout.state.v1',
    JSON.stringify({ greeted: true, name: 'T', level: l })), level);
  await page.reload({ waitUntil: 'networkidle' });
};

await page.goto(URL, { waitUntil: 'networkidle' });

// --- 1. Die Daten tragen die Ausnahme ----------------------------------
const daten = await page.evaluate(async () => {
  const { EXERCISES } = await import('./js/data.js');
  const out = {};
  EXERCISES.forEach((e) => {
    ['db', 'bw'].forEach((m) => {
      const s = e[m].stufen;
      if (s && Object.keys(s).length) out[`${e.id}/${m}`] = s;
    });
  });
  return out;
});
const betroffen = [...new Set(Object.keys(daten).map((k) => k.split('/')[0]))].sort();
check(betroffen.join(',') === 'chin-ups,pull-ups',
  `nur Chin-ups und Pull-ups haben eine Stufen-Ausnahme (${betroffen.join(', ') || 'keine'})`);
for (const [k, s] of Object.entries(daten)) {
  check(s.anfaenger && s.anfaenger.reps === '1–3' && s.anfaenger.rest === 120,
    `${k}: Anfänger bekommt 1–3 Wdh. und 120 s Pause (${JSON.stringify(s.anfaenger)})`);
  check(!s.geuebt && !s.fortgeschritten,
    `${k}: für Geübte und Fortgeschrittene bleibt alles, wie es war`);
}

// --- 2. Die App zeigt je Stufe den richtigen Bereich --------------------
// Ein Tag mit Chin-ups suchen, damit der Vergleich etwas zu vergleichen hat.
const tag = await page.evaluate(async () => {
  const { PLAN } = await import('./js/data.js');
  const w = PLAN.find((x) => x.ex.some((it) => it.id === 'chin-ups'));
  return w ? w.n : null;
});
check(tag !== null, `eine Einheit mit Chin-ups gefunden (Workout ${tag})`);

const meta = async (level) => {
  await stellen(level);
  await page.evaluate(async ([n]) => {
    (await import('./js/store.js')).setSetting('lastWorkout', n);
  }, [tag]);
  await page.reload({ waitUntil: 'networkidle' });
  const auf = page.locator('[data-act="show-list"]');
  if (await auf.count()) { await auf.first().click(); await page.waitForTimeout(250); }
  const zeile = page.locator('.ex').filter({ hasText: 'Chin-ups' }).first();
  return (await zeile.locator('.ex-meta').first().textContent()).replace(/\s+/g, ' ');
};

const anf = await meta('anfaenger');
const geu = await meta('geuebt');
check(/1–3/.test(anf), `Anfänger sieht 1–3 Wiederholungen (${anf})`);
check(/5–10/.test(geu), `Geübter sieht weiter 5–10 (${geu})`);

// --- 3. Die Pause folgt mit ---------------------------------------------
const pause = async (level) => {
  await stellen(level);
  return page.evaluate(async () => {
    const { EXERCISES } = await import('./js/data.js');
    const s = await import('./js/store.js');
    const e = EXERCISES.find((x) => x.id === 'chin-ups');
    const st = (e.db.stufen || {})[s.getState().level || 'geuebt'];
    return (st && st.rest) || e.db.rest;
  });
};
check(await pause('anfaenger') === 120, 'Anfänger: 120 s Pause');
check(await pause('geuebt') === 180, 'Geübter: weiterhin 180 s');
check(await pause('fortgeschritten') === 180, 'Fortgeschrittener: weiterhin 180 s');

// --- 4. Die Statistik rechnet mit der Stufe ----------------------------
// Der Fallstrick: Bliebe sie bei 5 Wiederholungen, bekäme der Anfänger je Satz
// das Fünffache gutgeschrieben – und stiege über die Tonnage zu früh auf.
const gerechnet = async (level) => {
  await stellen(level);
  return page.evaluate(async ([n]) => {
    const s = await import('./js/store.js');
    const { PLAN } = await import('./js/data.js');
    const w = PLAN.find((x) => x.n === n);
    const it = w.ex.find((x) => x.id === 'chin-ups');
    for (let i = 0; i < it.sets; i++) s.updateSet(n, 'db', 'chin-ups', it.sets, i, { done: true, w: '0' });
    return null;
  }, [tag]).then(async () => {
    await page.reload({ waitUntil: 'networkidle' });
    await page.locator('.tab[data-tab="stats"]').click();
    await page.waitForTimeout(400);
    const t = (await page.locator('.stat-grid').first().textContent()).replace(/\s+/g, ' ');
    const m = t.match(/([\d.]+)\s*Wiederholungen/);
    return m ? Number(m[1].replace('.', '')) : null;
  });
};
const wdhAnf = await gerechnet('anfaenger');
const wdhGeu = await gerechnet('geuebt');
check(wdhAnf !== null && wdhGeu !== null,
  `die Statistik nennt geplante Wiederholungen (${wdhAnf} / ${wdhGeu})`);
check(wdhAnf < wdhGeu,
  `der Anfänger bekommt weniger gutgeschrieben als der Geübte (${wdhAnf} < ${wdhGeu})`);

check(errs.length === 0, `keine Fehler${errs.length ? ': ' + errs.join(' | ') : ''}`);
console.log(`\n${fails ? fails + ' FEHLER' : 'alle Prüfungen bestanden'}`);
await browser.close();
