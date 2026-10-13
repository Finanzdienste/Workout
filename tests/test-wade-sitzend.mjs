/*
 * Wadenheben mit gebeugtem Knie: mit Hantel im Sitzen, die Hantel quer auf
 * den Knien.
 *
 *     „Ist nicht bisschen merkwürdig für Hantel nur in einer Hand zu halten?"
 *
 * Tobi, Cut mit Hanteln. Die Übung stand mit einer Kurzhantel in *einer* Hand
 * da, stehend, das Knie 30° gebeugt. Das ist merkwürdig, und nicht nur fürs
 * Gefühl: Die Last hängt auf einer Seite, das Gleichgewicht kostet mehr als
 * die Wade, und bei 30° im Knie arbeitet die Zwillingswade noch mit. Im
 * Sitzen mit 90° im Knie ist sie entspannt, der Schollenmuskel macht die
 * Arbeit – um den es bei dieser Übung geht –, die Hantel liegt quer über
 * beiden Oberschenkeln, symmetrisch, ohne Gleichgewichtsproblem, und es geht
 * deutlich mehr Last.
 *
 * Ohne Hanteln bleibt sie stehend mit gebeugtem Knie: Ohne Last ist sitzend
 * zu leicht. Dort hält eine Hand an der Wand das Gleichgewicht.
 *
 * Was sich dabei nicht ändern darf, ist ebenso Prüfgegenstand: Schlüssel,
 * Muskelanteile, Gerät, Gewicht – und damit die Pläne. Ein neuer Fingerabdruck
 * hieße bei Tobi eine Planwechsel-Meldung für eine Übung, die nur anders
 * ausgeführt wird.
 *
 *   W1  Katalog: Name, Hinweis, Hochnehmen, Erklärung je Fassung.
 *   W2  Was bleibt: Schlüssel, Anteile, Gerät, Gewicht, alle vier Pläne.
 *   W3  Figur: sitzt auf der Bank, Knie 90°, Ballen auf dem Buch, Fersen
 *       heben sich, Hantel quer auf den Oberschenkeln, beide Hände daran.
 *   W4  In der App: Karte und Fokus mit Hanteln, Karte ohne Hanteln.
 *
 * Gegenprobe: gegen 9b3a4b4 (v239) rot in W1, W3 und W4, 16 Prüfungen – dort
 * heißt die Übung „Wadenheben gebeugtes Knie", das Muster `calfseated` gibt es
 * nicht, und die Figur steht mit der Hantel in einer Hand. W2 ist grün wie
 * vorher; es ist die Wache dafür, dass es so bleibt. Einzeln zurückgedreht
 * wird jede Stelle in js/figure.js rot: ballenSitz() (die Hüfte rutscht
 * 0,010), knieHantel() (Hantel in der rechten Hand, schräg, neben der Mitte),
 * die zweite Faust, das Buch unter beiden Ballen und `fuss` in solve() (die
 * Fersen bleiben unten).
 */
import { createHash } from 'node:crypto';
import { chromium } from 'playwright';
import { PATTERNS, RIG, hanteln, hantelTeile, handForm } from '../js/figure.js';
import { EXERCISES, PLANS } from '../js/data.js';
import { skelett } from '../tools/pose.mjs';
import { URL, SHOT } from './umgebung.mjs';

let fails = 0;
const check = (c, m) => { console.log(`${c ? 'OK  ' : 'FAIL'} ${m}`); if (!c) { fails++; process.exitCode = 1; } };
const ID = 'wadenheben-gebeugtes-knie';
const ex = EXERCISES.find((e) => e.id === ID);
const f2 = (v) => v.toFixed(3);

/* --- W1. Katalog ---------------------------------------------------------- */
check(!!ex, `die Übung behält ihren Schlüssel ${ID} – an ihm hängen Gewichte und Protokoll`);
if (ex) {
  check(ex.db.name === 'Sitzendes Wadenheben', `mit Hanteln heißt sie „Sitzendes Wadenheben" (${ex.db.name})`);
  check(ex.bw.name === 'Wadenheben mit gebeugtem Knie', `ohne Hanteln weiter „Wadenheben mit gebeugtem Knie" (${ex.bw.name})`);
  check(ex.db.pattern === 'calfseated' && ex.bw.pattern === 'calfbent',
    `Figur: mit Hanteln sitzend, ohne stehend (${ex.db.pattern} / ${ex.bw.pattern})`);

  const cue = ex.db.cue;
  check(/sitz|setz/i.test(cue) && /90/.test(cue), 'der Hinweis sagt: sitzen, Knie 90°');
  check(/Buch/.test(cue) && /Ferse/.test(cue), 'Ballen auf ein Buch, die Fersen frei');
  check(/quer/.test(cue) && /Oberschenkel/.test(cue) && /beide[n]? Hände/.test(cue),
    'die Hantel liegt quer über den Oberschenkeln, beide Hände halten sie');
  check(/1 s/.test(cue), 'oben eine Sekunde halten');
  // Die Scheiben stecken an den Hanteln. Eine Hantelscheibe als Standard unter
  // dem Fuß hieße: vor jedem Satz die Hantel abbauen.
  check(!/Scheibe/.test(cue), 'keine Hantelscheibe als Unterlage im Hinweis – die steckt an den Hanteln');
  check(!/30/.test(cue), 'keine 30° mehr im Hinweis der Hantelfassung');

  const heben = ex.db.heben || '';
  check(/setz/.test(heben) && /quer/.test(heben) && /Oberschenkel/.test(heben) && /(abstell|ableg)/.test(heben),
    `Hochnehmen und Ablegen: setzen, quer auf die Oberschenkel, am Ende abstellen („${heben.slice(0, 60)}…")`);

  const titel = (m) => ex.detail.filter((d) => !d[2] || d[2] === m);
  const db = titel('db');
  const bw = titel('bw');
  check(db.some((d) => d[0] === 'Warum sitzend'), `mit Hanteln erklärt „Warum sitzend" (${db.map((d) => d[0]).join(', ')})`);
  check(db.every((d) => !/30/.test(d[1])), 'und nichts davon spricht noch von 30°');
  check(db.some((d) => /Schollenmuskel/.test(d[1]) && /Zwillings/.test(d[1])),
    'der Grund steht da: Zwillingswade entspannt, der Schollenmuskel arbeitet');
  check(db.some((d) => /Scheibe/.test(d[1]) && /Buch/.test(d[1])),
    'und warum ein Buch und keine Hantelscheibe');
  check(bw.some((d) => /30/.test(d[1])) && bw.every((d) => !/sitz/i.test(d[0])),
    `ohne Hanteln bleibt die stehende Erklärung mit 30° (${bw.map((d) => d[0]).join(', ')})`);
  check(/Wand/.test(ex.bw.cue) && !/optional/i.test(ex.bw.cue),
    'ohne Hanteln: eine Hand an der Wand, und keine zweite Übung im Hinweis');
  check(!/gleiche/i.test(ex.bw.cue), 'der Bodyweight-Hinweis steht für sich – kein „gleiche" auf die Hantelfassung');
}

/* --- W2. Was bleibt ------------------------------------------------------- */
if (ex) {
  check(JSON.stringify(ex.db.shares) === '{"calves":1}' && JSON.stringify(ex.bw.shares) === '{"calves":1}',
    'Anteile unverändert: Waden 1,0 in beiden Fassungen');
  check(ex.equip === 'onehand' && ex.weightNote === 'eine Hantel' && ex.weight === 12 && ex.step === 2 && ex.tier === 4,
    'Gerät, Gewichtshinweis, Startgewicht, Schritt und Stufe unverändert');
  check(ex.db.rest === 90 && ex.bw.rest === 90 && ex.db.reps === '12–20' && ex.bw.reps === '15–30',
    'Pause und Wiederholungen unverändert');
}
// Der Stand vor dieser Änderung (9b3a4b4), je Fokus: Fingerabdruck der
// Übungen, der Satzzahlen und ein Abdruck des ganzen Eintrags samt Kette.
const VORHER = {
  standard: ['5d06c61de5e8', 'cd3cb5cf2569', '8ab26359c4fbe26f'],
  bbp: ['f689fd6497f1', '01b721078644', 'bd1f27b1f32dda00'],
  cut: ['345241a49404', '577d2f7aeeb1', '20e7de5061017244'],
  oberkoerper: ['49ced3ea3450', 'ada4850e5a59', '24ea23e7709d1f46'],
};
Object.entries(VORHER).forEach(([k, [stand, saetze, alles]]) => {
  const v = PLANS[k];
  const abdruck = v ? createHash('sha256').update(JSON.stringify(v)).digest('hex').slice(0, 16) : '';
  check(v && v.stand === stand && v.saetze === saetze && abdruck === alles,
    `${k}: derselbe Plan wie vorher – keine Planwechsel-Meldung (${v && v.stand}/${v && v.saetze}/${abdruck})`);
});

/* --- W3. Die Figur ---------------------------------------------------------- */
const spec = PATTERNS.calfseated;
const T = Array.from({ length: 11 }, (_, i) => i / 10);
const minus = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const plus = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mal = (v, s) => [v[0] * s, v[1] * s, v[2] * s];
const punkt = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const laenge = (v) => Math.hypot(v[0], v[1], v[2]);
const einheit = (v) => mal(v, 1 / (laenge(v) || 1));
const mitte = (a, b) => mal(plus(a, b), 0.5);
const grad = (r) => (r * 180) / Math.PI;
check(!!spec, 'es gibt ein eigenes Muster für das Wadenheben im Sitzen (calfseated)');
if (spec) {
  check(spec.seat === true, 'es sitzt – mit Bank unter dem Gesäß');
  check(Array.isArray(spec.view) && Math.abs(spec.view[0]) >= 55 && Math.abs(spec.view[0]) <= 125,
    `von der Seite gezeigt, sonst ist die Ferse nicht zu sehen (${spec.view})`);
  check(spec.stufe === 'beide', 'mit einem Buch unter beiden Ballen');
  const js = T.map((t) => skelett(spec, t));
  const [j0] = js;
  const j1 = js[js.length - 1];

  // Knie 90°, Schienbein senkrecht – am Start, in der Dehnung.
  const beugung = (j, s) => grad(Math.acos(punkt(einheit(minus(j[`knee${s}`], j[`hip${s}`])),
    einheit(minus(j[`ankle${s}`], j[`knee${s}`])))));
  const knie = ['L', 'R'].map((s) => beugung(j0, s));
  check(knie.every((w) => w >= 82 && w <= 98), `unten ist das Knie rechtwinklig (${knie.map((w) => w.toFixed(0)).join('° / ')}°)`);
  const schien = grad(Math.acos(einheit(minus(j0.kneeR, j0.ankleR))[1]));
  check(schien < 8, `und das Schienbein steht senkrecht (${schien.toFixed(1)}° gegen die Senkrechte)`);

  // Das Gesäß bleibt auf der Bank: Gehoben wird die Ferse, nicht der Mensch.
  const huefte = Math.max(...js.map((j) => laenge(minus(j.hipC, j0.hipC))));
  check(huefte < 0.002, `die Hüfte bleibt auf der Bank (wandert ${f2(huefte)})`);
  check(j0.hipC[1] - (-0.62) > 0.3, `und die sitzt erhöht, nicht am Boden (${f2(j0.hipC[1] + 0.62)})`);
  // Die Ballen bleiben auf dem Buch.
  const zeh = (j) => mitte(j.toeL, j.toeR);
  const zehWeg = Math.max(...js.map((j) => laenge(minus(zeh(j), zeh(j0)))));
  check(zehWeg < 0.002, `die Ballen bleiben auf dem Buch (wandern ${f2(zehWeg)})`);
  // Die Fersen steigen, Schritt für Schritt, und deutlich.
  const ferse = js.map((j) => (j.ankleL[1] + j.ankleR[1]) / 2);
  check(ferse.every((y, i) => i === 0 || y >= ferse[i - 1] - 1e-9), 'die Fersen steigen ohne Rückschritt');
  check(ferse[ferse.length - 1] - ferse[0] >= 0.07,
    `die Fersen heben sich deutlich (${f2(ferse[0] + 0.62)} → ${f2(ferse[ferse.length - 1] + 0.62)})`);
  check(Math.abs(j0.ankleR[1] - j0.toeR[1]) < 0.02, `unten steht der Fuß flach (Ferse ${f2(j0.ankleR[1] - j0.toeR[1])} über dem Ballen)`);
  check(j1.ankleR[1] - j1.toeR[1] > 0.07, `oben steht er auf dem Ballen (Ferse ${f2(j1.ankleR[1] - j1.toeR[1])} darüber)`);

  // Die Hantel: quer über beiden Oberschenkeln, direkt hinter den Knien.
  const breiteOS = (u) => (4.6 + (3.1 - 4.6) * u) / 40;   // limb(hip, knee, 4.6, 3.1)
  const zumGlied = (p, a, b) => {
    const u = Math.max(0, Math.min(1, punkt(minus(p, a), minus(b, a)) / punkt(minus(b, a), minus(b, a))));
    return { u, d: laenge(minus(p, plus(a, mal(minus(b, a), u)))) };
  };
  const befund = {
    anzahl: true, quer: 1, mitteX: 0, uMin: 1, uMax: 0, spalt: [Infinity, -Infinity], hand: 0, griff: true, faust: true,
    // Wie weit die Fäuste entlang der Achse reichen – Fläche, Finger und
    // Daumen mit ihrer gezeichneten Dicke. Innen dürfen sie sich nicht
    // durchdringen, außen nicht in den Scheiben stecken.
    luecke: Infinity, scheibe: Infinity,
  };
  js.forEach((j, k) => {
    const hs = hanteln(spec, j, 'onehand');
    if (hs.length !== 1) { befund.anzahl = false; return; }
    const [h] = hs;
    const { r, dick, innen } = hantelTeile(h.plate, h.half);
    const knieachse = einheit(minus(j.kneeR, j.kneeL));
    befund.quer = Math.min(befund.quer, Math.abs(punkt(h.axis, knieachse)));
    befund.mitteX = Math.max(befund.mitteX, Math.abs(h.centre[0] - j.hipC[0]));
    const os = minus(mitte(j.kneeL, j.kneeR), mitte(j.hipL, j.hipR));
    const u = punkt(minus(h.centre, mitte(j.hipL, j.hipR)), os) / punkt(os, os);
    befund.uMin = Math.min(befund.uMin, u); befund.uMax = Math.max(befund.uMax, u);
    // Die große Scheibe je Seite liegt auf ihrem Oberschenkel: ihr tiefster
    // Punkt am Rand des Oberschenkels, weder darüber schwebend noch darin.
    const rechts = punkt(h.axis, [1, 0, 0]) > 0 ? 1 : -1;
    ['L', 'R'].forEach((s) => {
      const seite = (s === 'R' ? 1 : -1) * rechts;
      const scheibe = plus(h.centre, mal(h.axis, seite * (innen + dick / 2)));
      const tief = minus(scheibe, [0, r, 0]);
      const g = zumGlied(tief, j[`hip${s}`], j[`knee${s}`]);
      const spalt = g.d - breiteOS(g.u);
      befund.spalt = [Math.min(befund.spalt[0], spalt), Math.max(befund.spalt[1], spalt)];
      // Und die Hand derselben Seite am Griff, zwischen den Scheiben.
      const d = minus(j[`hand${s}`], h.centre);
      const entlang = punkt(d, h.axis);
      befund.hand = Math.max(befund.hand, laenge(minus(d, mal(h.axis, entlang))));
      if (!(Math.abs(entlang) < innen - 0.02 && Math.sign(entlang) === seite)) befund.griff = false;
      const hf = handForm(spec, j, s, 'onehand');
      if (!hf.faust) befund.faust = false;
      const reicht = [
        ...hf.flaeche.map((p) => [punkt(minus(p, h.centre), h.axis), 0]),
        ...hf.stuecke.flatMap(([a, b, w1, w2]) => [[punkt(minus(a, h.centre), h.axis), w1 / 40],
          [punkt(minus(b, h.centre), h.axis), w2 / 40]]),
      ].map(([v, w]) => seite * v - w);   // wie weit vor der Mitte, mit Dicke
      const nachAussen = Math.max(...[
        ...hf.flaeche.map((p) => seite * punkt(minus(p, h.centre), h.axis)),
        ...hf.stuecke.flatMap(([a, b, w1, w2]) => [seite * punkt(minus(a, h.centre), h.axis) + w1 / 40,
          seite * punkt(minus(b, h.centre), h.axis) + w2 / 40]),
      ]);
      befund.luecke = Math.min(befund.luecke, Math.min(...reicht));
      befund.scheibe = Math.min(befund.scheibe, innen - nachAussen);
    });
    if (k === 0 || k === js.length - 1) {
      console.log(`     t=${T[k]}: Hantelmitte ${h.centre.map(f2).join(', ')} · u ${u.toFixed(2)} · Spalt `
        + `${befund.spalt.map(f2).join(' … ')} · Hand ${f2(befund.hand)} von der Achse`);
    }
  });
  check(befund.anzahl, 'eine Hantel, nicht zwei und nicht keine');
  check(befund.quer > 0.99, `quer: parallel zur Knieachse (${befund.quer.toFixed(3)})`);
  check(befund.mitteX < 0.01, `mittig zwischen den Beinen (${f2(befund.mitteX)} neben der Mitte)`);
  check(befund.uMin >= 0.6 && befund.uMax <= 0.95,
    `direkt hinter den Knien (${befund.uMin.toFixed(2)}–${befund.uMax.toFixed(2)} der Oberschenkellänge)`);
  check(befund.spalt[0] >= -0.015 && befund.spalt[1] <= 0.015,
    `die Scheiben liegen auf den Oberschenkeln (Spalt ${befund.spalt.map(f2).join(' … ')})`);
  check(befund.hand < 0.012 && befund.griff,
    `beide Hände am Griff, jede auf ihrer Seite (höchstens ${f2(befund.hand)} von der Achse)`);
  check(befund.faust, 'und beide greifen zu – nicht eine Faust und eine leere Hand');
  check(befund.luecke > 0 && befund.scheibe > 0,
    `die Fäuste passen nebeneinander auf den Griff (je ${f2(befund.luecke)} bis zur Mitte, ${f2(befund.scheibe)} bis zur Scheibe)`);
  check(RIG.thigh > 0, 'Körpermaße da');
}

/* --- W4. In der App --------------------------------------------------------- */
const TOBI = {
  greeted: true, setupDone: true, name: 'Tobi', focus: 'cut', mode: 'db', level: 'geuebt',
  supersatz: true, theme: 'orange', weights: { [ID]: 6.5 },
  scheiben: { stange: {}, scheiben: [[5, 2], [2.5, 4], [1.25, 4]] },
};
const browser = await chromium.launch();
const errs = [];
async function seite(zustand) {
  const ctx = await browser.newContext({
    viewport: { width: 414, height: 896 }, timezoneId: 'Europe/Berlin', serviceWorkers: 'block', reducedMotion: 'reduce',
  });
  await ctx.route('**/rest/v1/**', (r) => r.fulfill({ status: 204, body: '' }));
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errs.push(`PAGEERROR: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errs.push(`CONSOLE: ${m.text()}`); });
  await page.clock.setFixedTime(new Date('2026-10-13T17:00:00+02:00'));
  await page.addInitScript((s) => {
    if (sessionStorage.getItem('gesaet')) return;
    sessionStorage.setItem('gesaet', '1');
    localStorage.setItem('workout.state.v1', JSON.stringify(s));
  }, zustand);
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(250);
  return { ctx, page };
}
const txt = async (loc) => ((await loc.first().textContent().catch(() => '')) || '').replace(/\s+/g, ' ').trim();
const fig = async (loc) => ({
  bank: await loc.locator('.fig-bench').count(),
  buch: await loc.locator('.fig-buch').count(),
  beine: await loc.locator('.fig-bench-leg').count(),
  scheiben: await loc.locator('.fig-scheibe').count(),
});

try {
  // Mit Hanteln: die Karte in der Liste, aufgeklappt.
  const { ctx, page } = await seite(TOBI);
  await page.locator('[data-act="show-list"]').first().click();
  await page.waitForTimeout(250);
  const karte = page.locator('article.ex').filter({ has: page.locator('.ex-name', { hasText: /^\s*Sitzendes Wadenheben\s*$/ }) });
  check(await karte.count() === 1, 'Tobis Cut-Einheit zeigt „Sitzendes Wadenheben"');
  await karte.locator('.ex-head').click();
  await page.waitForTimeout(300);
  const offen = page.locator('article.ex.open').filter({ has: page.locator('.ex-name', { hasText: 'Sitzendes Wadenheben' }) });
  const kg = await offen.locator('.kg-val').inputValue().catch(() => '');
  check(kg === '6,5', `sein Gewicht bleibt stehen – nichts ändert sich still (${kg})`);
  check(/Buch/.test(await txt(offen.locator('.cue'))), 'der Hinweis an der Karte nennt das Buch');
  check(/quer/.test(await txt(offen.locator('.heben'))), 'Hochnehmen und Ablegen: quer auf die Oberschenkel');
  const k = await fig(offen.locator('.ex-fig'));
  check(k.bank === 8 && k.buch === 4 && k.beine === 4,
    `die Figur sitzt auf einer Bank, ein Buch unter den Ballen (${k.bank} Flächen, davon ${k.buch} Buch, ${k.beine} Beine)`);
  check(k.scheiben === 4, `und hält eine Hantel, nicht zwei (${k.scheiben} Scheiben)`);
  // Das Buch liegt unter den Füßen: von der Seite gesehen unter ihnen und mit
  // der Oberkante an der Sohle, unten wie oben.
  const lage = await page.evaluate(async () => {
    const { mountFigure } = await import('./js/figure.js');
    const host = document.createElement('div');
    host.style.cssText = 'width:300px;height:300px;position:fixed;left:0;top:0';
    document.body.appendChild(host);
    const f = mountFigure(host, 'calfseated', true, 'onehand');
    f.stop(); f.setView(90, 0);
    const box = (sel) => {
      const bb = [...host.querySelectorAll(sel)].map((n) => n.getBBox());
      return bb.length ? {
        x: Math.min(...bb.map((b) => b.x)), r: Math.max(...bb.map((b) => b.x + b.width)),
        y: Math.min(...bb.map((b) => b.y)), b: Math.max(...bb.map((b) => b.y + b.height)),
      } : null;
    };
    const out = [0, 1].map((t) => { f.draw(t); return { buch: box('.fig-buch'), fuss: box('.fig-foot') }; });
    host.remove();
    return out;
  });
  lage.forEach(({ buch, fuss }, i) => {
    const drunter = buch && fuss && buch.x < fuss.r && buch.r > fuss.x && buch.y >= fuss.y && buch.y <= fuss.b && buch.b > fuss.b;
    check(drunter, `t=${i}: das Buch liegt unter den Ballen (${JSON.stringify(buch && { x: Math.round(buch.x), r: Math.round(buch.r), y: Math.round(buch.y) })} `
      + `unter ${JSON.stringify(fuss && { x: Math.round(fuss.x), r: Math.round(fuss.r), b: Math.round(fuss.b) })})`);
  });
  await offen.locator('[data-act="toggle-detail"]').click();
  await page.waitForTimeout(200);
  const titel = await page.locator('article.ex.open .detail-h').allTextContents();
  check(titel.includes('Warum sitzend'), `„Mehr zur Ausführung" erklärt es (${titel.join(', ')})`);
  await page.screenshot({ path: `${SHOT}/wade-sitzend-karte.png` });

  // Im Fokus.
  await page.locator('[data-act="start-session"]').first().click().catch(() => {});
  await page.waitForTimeout(250);
  for (let i = 0; i < 8 && (await txt(page.locator('.focus-name'))) !== 'Sitzendes Wadenheben'; i++) {
    await page.locator('[data-act="focus-step"][data-d="1"]').first().click().catch(() => {});
    await page.waitForTimeout(150);
  }
  check(await txt(page.locator('.focus-name')) === 'Sitzendes Wadenheben', 'im Fokus steht sie auch so da');
  const f = await fig(page.locator('#focusFig'));
  check(f.bank === 8 && f.beine === 4 && f.scheiben === 4, `und die große Figur sitzt mit der Hantel auf den Knien (${JSON.stringify(f)})`);
  await page.screenshot({ path: `${SHOT}/wade-sitzend-fokus.png` });
  await ctx.close();

  // Ohne Hanteln: stehend, die Hand an der Wand.
  const bw = await seite({ ...TOBI, mode: 'bw' });
  await bw.page.locator('[data-act="show-list"]').first().click();
  await bw.page.waitForTimeout(250);
  const kb = bw.page.locator('article.ex').filter({ has: bw.page.locator('.ex-name', { hasText: /^\s*Wadenheben mit gebeugtem Knie\s*$/ }) });
  check(await kb.count() === 1, 'ohne Hanteln heißt sie weiter „Wadenheben mit gebeugtem Knie"');
  await kb.locator('.ex-head').click();
  await bw.page.waitForTimeout(300);
  const ob = bw.page.locator('article.ex.open');
  check(/Wand/.test(await txt(ob.locator('.cue'))), 'der Hinweis nennt die Hand an der Wand');
  const b = await fig(ob.locator('.ex-fig'));
  check(b.beine === 0 && b.buch === 0 && b.scheiben === 0, `die Figur steht, ohne Bank, Buch und Hantel (${JSON.stringify(b)})`);
  await bw.ctx.close();
} catch (e) {
  check(false, `W4 abgebrochen: ${String(e.message || e).split('\n')[0]}`);
}
check(errs.length === 0, `keine Fehler${errs.length ? ` – ${errs.slice(0, 2).join(' | ')}` : ''}`);
await browser.close();
console.log(`\n${fails ? `${fails} FEHLER` : 'alle Prüfungen bestanden'}`);
