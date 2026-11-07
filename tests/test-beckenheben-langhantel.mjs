/*
 * Beckenheben mit Langhantel: der Hip Thrust für eine Wohnung, in der die
 * Stange am Sofa nicht passt.
 *
 *     „So wie in der app angegeben kann ich hip thrusts glaub ich nicht bei
 *      mir zuhause machen. Wenn ich auf dem Sofa liege, stößt die langhantel
 *      links oder rechts gegen die Wand"
 *
 * Tobi, Cut mit Hanteln. Das Sofa steht in einer Nische, und die Stange ist
 * länger als die Nische breit. Der Hip Thrust geht dann nur an einer anderen
 * Kante – ein Stuhl mit der Lehne an einer freien Wand – oder gar nicht. Das
 * Beckenheben mit der Scheibe, das bisher einsprang, ist für jemanden, der den
 * Hip Thrust mit 40 kg und mehr macht, zu leicht: eine Scheibe auf der Hüfte.
 * Dieselbe Stange am Boden geht überall dort, wo sonst mit ihr trainiert wird.
 *
 *   B1  Katalog: Name, Gerät, Gewicht wie beim Hip Thrust, Anteile genau die
 *       des Hip Thrust, Hochnehmen vom Boden, Erklärung; der Hip Thrust selbst
 *       sagt, was tun, wenn die Stange nicht passt.
 *   B2  Pläne: Die Übung steht in keinem (nurErsatz), der Hip Thrust bleibt,
 *       und plan-frisch.py weiß, warum der Katalog neuer ist als die Pläne.
 *   B3  Ersatz: Hip Thrust aus → Beckenheben mit Langhantel, Satz für Satz;
 *       ohne Langhantel, bei ISG-Blockade oder Zerrung des Beinbeugers das
 *       mit der Scheibe; ohne Abwahl ändert sich nichts.
 *   B4  In der App: Name, Gewicht, und „Statt Hip Thrust" mit dem richtigen
 *       Grund – ausgeschaltet, nicht „dafür fehlt gerade das Gerät".
 *   B5  Figur: Die Stange liegt quer über der Hüfte, die Scheiben über dem
 *       Boden, oben wie unten.
 *
 * Gegenprobe: gegen 1da6f42 (v251) rot in B1–B4 – die Übung gibt es nicht,
 * der Hip Thrust weicht aufs Beckenheben mit der Scheibe aus, und an dessen
 * Karte stand „Statt Hip Thrust – dafür fehlt gerade das Gerät." B5 ist dort
 * grün: Das Muster und die Stange auf der Hüfte gab es schon, nur nicht
 * zusammen.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { PATTERNS, hanteln, hantelTeile } from '../js/figure.js';
import { EXERCISES, PLANS } from '../js/data.js';
import { skelett } from '../tools/pose.mjs';
import { URL, ROOT } from './umgebung.mjs';

let fails = 0;
const check = (c, m) => { console.log(`${c ? 'OK  ' : 'FAIL'} ${m}`); if (!c) { fails++; process.exitCode = 1; } };
const ID = 'langhantel-beckenheben';
const ex = EXERCISES.find((e) => e.id === ID);
const ht = EXERCISES.find((e) => e.id === 'hip-thrust');
const scheibe = EXERCISES.find((e) => e.id === 'beckenheben');

/* --- B1. Katalog ------------------------------------------------------------ */
check(!!ex, `die Übung steht im Katalog (${ID})`);
if (ex) {
  check(ex.db.name === 'Beckenheben mit Langhantel', `mit Hanteln: „Beckenheben mit Langhantel" (${ex.db.name})`);
  check(ex.equip === 'hipbar' && ex.weight === ht.weight && ex.step === ht.step && ex.weightNote === ht.weightNote,
    `dieselbe Stange, dasselbe Gewicht wie beim Hip Thrust (${ex.equip}, ${ex.weight} kg ${ex.weightNote}, Schritt ${ex.step})`);
  check(JSON.stringify(ex.db.shares) === JSON.stringify(ht.db.shares),
    `Anteile genau die des Hip Thrust – die Wochenrechnung bleibt stehen (${JSON.stringify(ex.db.shares)})`);
  check(ex.db.pattern === 'bridge' && ex.db.braucht.includes('langhantel'),
    `am Boden, und es braucht die Langhantel (${ex.db.pattern}, ${ex.db.braucht.join(' + ')})`);
  check(ex.tier === ht.tier, `eine Grundübung wie der Hip Thrust (Stufe ${ex.tier})`);
  check(/Hüftbeuge/.test(ex.db.cue) && /Handtuch/.test(ex.db.cue) && /Fersen/.test(ex.db.cue) && !/Sofa/.test(ex.db.cue),
    'Hinweis: Stange auf die Hüftbeuge, Handtuch darunter, Fersen nah – kein Sofa');
  const heben = ex.db.heben || '';
  check(/Boden/.test(heben) && /rollen/.test(heben) && /Nie mit der Stange auf der Hüfte aufstehen/.test(heben),
    'Hochnehmen: vom Boden über die Beine rollen, nie mit der Stange aufstehen');
  const wozu = (ex.detail.find((d) => d[0].startsWith('Wozu')) || [])[1] || '';
  check(/Sofa/.test(wozu) && /Wand/.test(wozu) && /Mehr → Übungen/.test(wozu),
    'die Erklärung sagt, wofür es sie gibt und wie sie einspringt');
  check(ex.bw.name === scheibe.bw.name && JSON.stringify(ex.bw.shares) === JSON.stringify(scheibe.bw.shares),
    `ohne Hanteln ist sie das Beckenheben ohne Gerät (${ex.bw.name})`);
  const isg = (ex.schmerz || []).find((s) => (s.verletzung || []).includes('isg'));
  check(!!isg && /Scheibe/.test(isg.text), 'bei Schmerz am Kreuz-Darmbein-Gelenk führt sie zum Beckenheben mit der Scheibe');
}
const platz = (ht.detail.find((d) => d[0] === 'Kein Platz für die Stange') || [])[1] || '';
check(/Nische/.test(platz) && /Stuhl/.test(platz) && /Lehne/.test(platz) && /Beckenheben mit Langhantel/.test(platz),
  'der Hip Thrust sagt, was tun, wenn die Stange nicht passt: Stuhl an der Wand, sonst vom Boden');
check(/frei stehender Stuhl kippt/.test(ht.detail[0][1]),
  'und widerspricht sich nicht: Nur der frei stehende Stuhl kippt');

/* --- B2. Pläne -------------------------------------------------------------- */
const inPlaenen = Object.entries(PLANS).filter(([, p]) => p.plan.some((w) => w.ex.some((x) => x.id === ID)));
check(!inPlaenen.length, `in keinem Plan – sie springt nur ein (${inPlaenen.map(([k]) => k).join(', ') || 'keiner'})`);
check(['standard', 'bbp', 'cut'].every((k) => PLANS[k].plan.some((w) => w.ex.some((x) => x.id === 'hip-thrust'))),
  'der Hip Thrust bleibt in den Plänen, in denen er stand');
const lies = (datei) => JSON.parse(readFileSync(path.join(ROOT, datei), 'utf8'));
const meta = lies('tools/exercise-meta.json');
check(meta[ID] && meta[ID].nurErsatz === true, 'im Katalog als nurErsatz markiert – der Generator nimmt sie nicht');
const eingaben = lies('tools/pruefung/plan-eingaben.json').plaene || {};
check(Object.values(eingaben).every((v) => /nurErsatz/.test(((v.hingenommen || {})[ID] || {}).grund || '')),
  'plan-frisch.py nimmt den neuen Katalogeintrag in allen vier Plänen hin, mit Grund');

/* --- B3. Ersatz ------------------------------------------------------------- */
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 414, height: 896 } });
await ctx.route('**/rest/v1/**', (r) => r.fulfill({ status: 204, body: '' }));
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message));
await page.goto(URL, { waitUntil: 'networkidle' });
const stand = (mehr) => ({ greeted: true, name: 'T', level: 'geuebt', focus: 'cut', shift: 0, log: {}, ...mehr });
const mitStand = async (s) => {
  await page.evaluate((x) => localStorage.setItem('workout.state.v1', JSON.stringify(x)), s);
  await page.reload({ waitUntil: 'networkidle' });
};
// Je Einheit des Cuts, in der der Hip Thrust steht: was dort stattdessen steht.
const tausch = async (mode) => page.evaluate(async (m) => {
  const { PLAN } = await import('./js/data.js');
  const { exOf } = await import('./js/plan.js');
  return PLAN.filter((w) => w.ex.some((x) => x.id === 'hip-thrust')).map((w) => {
    const plan = w.ex.find((x) => x.id === 'hip-thrust');
    const items = exOf(w, m);
    // `statt` setzt der Vorrat, `from` eine Beschwerde (js/plan.js).
    const da = items.find((x) => x.statt === 'hip-thrust' || x.from === 'hip-thrust' || x.id === 'hip-thrust') || null;
    return { n: w.n, plan: plan.sets, id: da && da.id, sets: da && da.sets, warum: da && da.stattWarum };
  });
}, mode);
const nur = (liste) => [...new Set(liste.map((x) => x.id))].join(', ');

await mitStand(stand({}));
const ohne = await tausch('db');
check(ohne.length > 0 && ohne.every((x) => x.id === 'hip-thrust'),
  `ohne Abwahl bleibt der Hip Thrust (${ohne.length} Einheiten im Cut)`);

await mitStand(stand({ ausUebungen: ['hip-thrust'] }));
const aus = await tausch('db');
console.log('     Hip Thrust aus:', aus.map((x) => `${x.n}:${x.id}×${x.sets}`).join(' '));
check(aus.every((x) => x.id === ID && x.warum === 'vorrat'),
  `Hip Thrust aus → in jeder dieser Einheiten das Beckenheben mit Langhantel (${nur(aus)})`);
check(aus.every((x) => x.sets === x.plan), 'mit genau den Sätzen, die der Hip Thrust hatte');
const bw = await tausch('bw');
check(bw.every((x) => x.id && x.id !== 'hip-thrust') && bw.every((x) => x.id === ID || x.id === 'beckenheben'),
  `ohne Hanteln springt das Beckenheben ohne Gerät ein (${nur(bw)})`);

await mitStand(stand({ ausUebungen: ['hip-thrust'], fehlt: ['langhantel'] }));
const keineStange = await tausch('db');
check(keineStange.every((x) => x.id === 'beckenheben'),
  `ohne Langhantel bleibt es beim Beckenheben mit der Scheibe (${nur(keineStange)})`);

for (const verletzung of ['isg', 'hamstringzerrung']) {
  await mitStand(stand({ ausUebungen: ['hip-thrust'], injuries: [verletzung] }));
  const r = await tausch('db');
  check(r.every((x) => x.id !== ID) && r.some((x) => x.id === 'beckenheben'),
    `${verletzung}: nicht die volle Last vom Boden, sondern die Scheibe (${nur(r)})`);
}

/* --- B4. In der App --------------------------------------------------------- */
await mitStand(stand({ ausUebungen: ['hip-thrust'], mode: 'db' }));
const ziel = aus[0] && aus[0].n;
for (let i = 0; i < 100; i++) {
  if (new RegExp(`Workout ${ziel}\\b`).test(await page.locator('#view').textContent())) break;
  await page.locator('[data-act="nav-workout"][data-delta="1"]').first().click();
  await page.waitForTimeout(60);
}
await page.locator('[data-act="start-session"]').first().click();
await page.waitForTimeout(400);
const finde = (name) => page.evaluate((x) => [...document.querySelectorAll('.prog-ex')]
  .findIndex((b) => (b.getAttribute('aria-label') || '').includes(x)), name);
const idx = await finde('Beckenheben mit Langhantel');
check(idx >= 0, `im Training steht das Beckenheben mit Langhantel (Workout ${ziel})`);
// Der Grund an der Karte gilt für jeden Ersatz des abgewählten Hip Thrust –
// auch für das Beckenheben mit der Scheibe, das vorher einsprang.
const karteIdx = idx >= 0 ? idx : await finde('Beckenheben');
if (karteIdx >= 0) {
  await page.locator(`[data-act="focus-goto"][data-i="${karteIdx}"]`).click();
  await page.waitForTimeout(300);
  const karte = (await page.locator('#view').textContent()).replace(/\s+/g, ' ');
  const statt = (/Statt Hip Thrust[^.]*\./.exec(karte) || [''])[0];
  console.log('     an der Karte:', statt);
  check(/Statt Hip Thrust – die Übung ist unter Mehr → Übungen ausgeschaltet\./.test(karte) && !/fehlt gerade das Gerät/.test(karte),
    'an der Karte steht der richtige Grund: ausgeschaltet, nicht „dafür fehlt gerade das Gerät"');
}
if (idx >= 0) {
  const karte = (await page.locator('#view').textContent()).replace(/\s+/g, ' ');
  const kg = await page.locator('.focus-weight .kg-val').first().inputValue();
  // „Stange gesamt" zeigt die App als „mit Stange" oder „Scheiben gesamt",
  // je nachdem, ob das Leergewicht der Stange eingetragen ist (gewichtNotiz()).
  const notiz = (/kg · (mit Stange|Scheiben gesamt)/.exec(karte) || [])[1];
  check(kg === '40' && !!notiz, `40 kg wie beim Hip Thrust, ${notiz || 'ohne Gewichtshinweis'} (${kg})`);
}
check(errs.length === 0, `keine Fehler${errs.length ? ': ' + errs.slice(0, 2).join(' | ') : ''}`);
await browser.close();

/* --- B5. Figur -------------------------------------------------------------- */
const spec = PATTERNS[ex ? ex.db.pattern : 'bridge'];
const befund = { anzahl: true, quer: 0, ueberHuefte: Infinity, luft: Infinity };
[0, 0.25, 0.5, 0.75, 1].forEach((t) => {
  const j = skelett(spec, t);
  const hs = hanteln(spec, j, 'hipbar');
  if (hs.length !== 1) { befund.anzahl = false; return; }
  const [h] = hs;
  const { r } = hantelTeile(h.plate, h.half);
  const boden = Math.min(...Object.values(j).map((q) => q[1]));
  befund.quer = Math.max(befund.quer, Math.abs(h.axis[0]) + Math.abs(h.axis[1]));
  befund.ueberHuefte = Math.min(befund.ueberHuefte, h.centre[1] - j.hipC[1]);
  befund.luft = Math.min(befund.luft, h.centre[1] - r - boden);
});
check(befund.anzahl, 'eine Stange, nicht zwei Hanteln');
check(befund.quer < 1e-6, `quer zum Körper, waagerecht (Abweichung ${befund.quer.toFixed(3)})`);
check(befund.ueberHuefte > 0.05, `auf der Hüfte, nicht im Becken (${befund.ueberHuefte.toFixed(3)} darüber)`);
check(befund.luft > 0, `die Scheiben über dem Boden, auch unten (${befund.luft.toFixed(3)} Luft)`);

console.log(`\n${fails ? fails + ' FEHLER' : 'alle Prüfungen bestanden'}`);
