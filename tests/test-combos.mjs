/*
 * Was die Wechselwirkungen im Beschwerden-Tab behaupten, stimmt auch.
 *
 * Die Texte in COMBOS (js/injuries.js) sind von Hand geschrieben, und die
 * Durchsicht der App fand einen, der den Zahlen direkt darüber widersprach:
 * „Schulter und Handgelenk zusammen lassen vom Drücken nichts übrig" – gerechnet
 * blieb die Brust mit Hanteln voll auf Ziel. Zwei weitere sagten „nichts" oder
 * „reines Oberkörpertraining", wo das Beckenheben noch etwas trug.
 *
 * Deshalb nennt jeder Eintrag in `null`, was auf null Sätze fällt, und hier wird
 * das für alle vier Pläne und beide Modi nachgerechnet. Dazu die wenigen
 * Aussagen, dass etwas *bleibt*.
 */
import { chromium } from 'playwright';
import { URL } from './umgebung.mjs';

const browser = await chromium.launch();
const page = await browser.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message));
let fails = 0;
const check = (c, m) => { console.log(`${c ? 'OK  ' : 'FAIL'} ${m}`); if (!c) { fails++; process.exitCode = 1; } };

await page.goto(URL, { waitUntil: 'networkidle' });

for (const fokus of ['standard', 'bbp', 'cut', 'oberkoerper']) {
  await page.evaluate(async (f) => {
    const s = await import('./js/store.js');
    s.setSetting('greeted', true);
    s.setSetting('level', 'geuebt');
    s.setSetting('focus', f);
    s.flush();
  }, fokus);
  await page.reload({ waitUntil: 'networkidle' });
  const r = await page.evaluate(async () => {
    const store = await import('./js/store.js');
    const { PLAN, EXERCISES } = await import('./js/data.js');
    const { exOf } = await import('./js/plan.js');
    const { COMBOS } = await import('./js/injuries.js');
    const EX = new Map(EXERCISES.map((e) => [e.id, e]));
    const summe = (inj, m) => {
      store.setSetting('injuries', inj);
      const t = {};
      PLAN.forEach((w) => exOf(w, m).forEach((x) => {
        Object.entries(EX.get(x.id)[m].shares).forEach(([k, v]) => { t[k] = (t[k] || 0) + v * x.sets; });
      }));
      return t;
    };
    const out = [];
    COMBOS.forEach((c) => ['db', 'bw'].forEach((m) => {
      const vor = summe([], m);
      const nach = summe(c.when, m);
      out.push({ when: c.when.join('+'), m, vor, nach,
        null: [...(c.null || []), ...(m === 'bw' ? c.nullBw || [] : [])] });
    }));
    return out;
  });
  r.forEach((x) => {
    const uebrig = x.null.filter((k) => (x.nach[k] || 0) > 0.01);
    check(x.null.length > 0 && !uebrig.length,
      `${fokus}/${x.m} ${x.when}: auf null fällt, was der Text sagt${uebrig.length
        ? ' – bleibt doch: ' + uebrig.map((k) => `${k} ${x.nach[k].toFixed(1)}`).join(', ') : ''}`);
  });
  const bei = (when, m) => r.find((x) => x.when === when && x.m === m);
  // „Mit Hanteln bleibt das Drücken … die Brust bekommt ihre Sätze dort."
  const sh = bei('schulter-impingement+handgelenk-reizung', 'db');
  check(sh.vor.chest > 0 && sh.nach.chest >= sh.vor.chest * 0.9,
    `${fokus}: Schulter + Handgelenk mit Hanteln – die Brust bleibt (${sh.vor.chest} → ${sh.nach.chest} Sätze)`);
  // „Übrig bleibt, was die hintere Schulter mit dem Band macht."
  const el = bei('tennisarm+golferarm', 'db');
  check(el.nach.rearDelts > 0, `${fokus}: beide Ellenbogenseiten – die hintere Schulter bleibt (${el.nach.rearDelts.toFixed(1)})`);
  // „Das Gesäß bleibt über den Hip Thrust im Plan."
  const rk = bei('lws-bandscheibe+patellasehne', 'db');
  check(rk.nach.glutes > 0, `${fokus}: Rücken + Knie – das Gesäß bleibt (${rk.nach.glutes.toFixed(1)})`);
  // „das Gesäß nur noch … etwa die Hälfte"
  const hf = bei('isg+huefte-fai', 'db');
  const anteil = hf.nach.glutes / hf.vor.glutes;
  check(anteil > 0.3 && anteil < 0.7, `${fokus}: Becken + Hüfte – das Gesäß behält etwa die Hälfte (${Math.round(anteil * 100)} %)`);
}

check(errs.length === 0, `keine Fehler${errs.length ? ': ' + errs.slice(0, 2).join(' | ') : ''}`);
await browser.close();
console.log(`\n${fails ? fails + ' FEHLER' : 'alle Prüfungen bestanden'}`);
