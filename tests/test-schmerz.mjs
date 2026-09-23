/*
 * „Wenn etwas weh tut": von einer Stelle am Körper zu einer Folge im Plan.
 *
 *     „Okay also ich will nicht je Übung die Auswahl haben zwischen zwei
 *      Übungen. Viel mehr soll man bestimmte Schmerzen oder so die man bei
 *      bestimmten Übungen hat unter Krankheiten abhaken können bzw es soll bei
 *      der Übung ein Erklärungstext stehen was man machen soll wenn man
 *      schmerzen in bestimmten Bereichen hat. Wenn da rauskommt dass die Übung
 *      einfach nicht für einen geeignet ist dann soll sie natürlich ganz raus"
 *
 * Drei Schritte, und geprüft wird jeder einzeln – vor allem der dritte, denn
 * er ist der, an dem so etwas sonst eine Attrappe ist:
 *
 *   1. An der Übung steht, wo es weh tun kann und was dann zu tun ist.
 *   2. Wo es dafür eine Beschwerde gibt, führt ein Knopf dorthin.
 *   3. Nach dem Antippen ist die Übung wirklich aus dem Plan – überall, nicht
 *      nur an dieser Karte, und nicht nur in der Anzeige.
 *
 * Dazu die Gegenrichtung, die leicht vergessen wird: Jede Beschwerde, auf die
 * ein Schmerz-Eintrag zeigt, muss die Übung auch wirklich sperren. Ein Knopf,
 * der eine Beschwerde anhakt, die diese Übung gar nicht betrifft, sähe aus wie
 * eine Hilfe und wäre keine.
 */
import { chromium } from 'playwright';
import { URL } from './umgebung.mjs';

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 414, height: 896 } });
await ctx.route('**/rest/v1/**', (r) => r.fulfill({ status: 204, body: '' }));
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message));
let fails = 0;
const check = (c, m) => { console.log(`${c ? 'OK  ' : 'FAIL'} ${m}`); if (!c) { fails++; process.exitCode = 1; } };

await page.goto(URL, { waitUntil: 'networkidle' });

// --- 1. Der Katalog: jeder Eintrag ist vollständig und zeigt ins Leere ---
const katalog = await page.evaluate(async () => {
  const { EXERCISES } = await import('./js/data.js');
  const { INJURIES } = await import('./js/injuries.js');
  const inj = new Map(INJURIES.map((i) => [i.id, i]));
  const raus = [];
  EXERCISES.forEach((e) => {
    (e.schmerz || []).forEach((s) => {
      (s.verletzung || []).forEach((v) => {
        raus.push({
          ex: e.id,
          ort: s.ort,
          inj: v,
          gibtEs: inj.has(v),
          // Der Kern: Die Beschwerde muss genau diese Übung sperren.
          sperrt: !!(inj.get(v) || { avoid: [] }).avoid.includes(e.id),
          ersatz: (inj.get(v) || { swap: {} }).swap[e.id] || null,
        });
      });
    });
  });
  return {
    zeilen: raus,
    mitSchmerz: EXERCISES.filter((e) => (e.schmerz || []).length).map((e) => e.id),
    unvollstaendig: EXERCISES.flatMap((e) => (e.schmerz || [])
      .filter((s) => !s.ort || !s.text || s.text.length < 80)
      .map((s) => `${e.id}/${s.ort}`)),
  };
});
console.log('     Übungen mit Schmerz-Einträgen:', katalog.mitSchmerz.join(', '));
check(katalog.mitSchmerz.length >= 5,
  `mehrere Übungen haben Schmerz-Einträge (${katalog.mitSchmerz.length})`);
check(katalog.unvollstaendig.length === 0,
  `jeder Eintrag hat Stelle und einen Text, der etwas sagt (${katalog.unvollstaendig.join(', ') || 'alle'})`);
katalog.zeilen.forEach((z) => {
  check(z.gibtEs, `${z.ex}/${z.ort} → ${z.inj}: die Beschwerde gibt es`);
  check(z.sperrt,
    `und sie sperrt ${z.ex} wirklich${z.ersatz ? ` (Ersatz: ${z.ersatz})` : ' (ersatzlos)'}`);
});

// --- 2. Die Zeile steht an der Karte ------------------------------------
await page.evaluate(async () => {
  const store = await import('./js/store.js');
  store.setSetting('greeted', true);
  store.setSetting('name', 'T');
  store.clearInjuries();
  store.setSetting('tab', 'dashboard');
});
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(400);

const zielN = await page.evaluate(async () => {
  const { PLAN } = await import('./js/data.js');
  return PLAN.find((x) => x.ex.some((e) => e.id === 'einarmiges-kh-rudern')).n;
});
for (let k = 0; k < 25; k++) {
  const kopf = (await page.locator('#view').textContent()).replace(/\s+/g, ' ');
  if (new RegExp(`Workout ${zielN}\\b`).test(kopf)) break;
  await page.locator('[data-act="nav-workout"][data-delta="1"]').first().click();
  await page.waitForTimeout(200);
}
await page.locator('[data-act="show-list"]').first().click();
await page.waitForTimeout(400);
const karte = page.locator('.ex').filter({ hasText: 'Langhantelrudern' }).first();
await karte.locator('.ex-head').click();
await page.waitForTimeout(300);

const stellen = await karte.locator('.schmerz-h').allTextContents();
console.log('     Stellen an der Karte:', stellen.map((x) => x.replace(/\s+/g, ' ').trim()).join(' | '));
check(stellen.some((x) => /Unterer Rücken/.test(x)),
  'an der Rudern-Karte steht „Unterer Rücken" als Stelle');
// Zugeklappt ist zugeklappt: Der Text kostet sonst jedem Satz eine
// Bildschirmhöhe, und gelesen wird er einmal.
check(await karte.locator('.schmerz-b').count() === 0,
  'und zugeklappt steht dort nur die Zeile, nicht der ganze Text');

await karte.locator('.schmerz-h').first().click();
await page.waitForTimeout(300);
const text = (await karte.locator('.schmerz-b p').first().textContent()).replace(/\s+/g, ' ');
console.log('     Textanfang:', text.slice(0, 90), '…');
check(text.length > 400, `aufgeklappt steht dort der Text (${text.length} Zeichen)`);
check(!/\*/.test(text), 'ohne Sternchen im Text – die Anzeige kann kein Markdown');

const knopf = karte.locator('[data-act="schmerz-anhaken"]');
const beschriftung = (await knopf.first().textContent()).replace(/\s+/g, ' ').trim();
console.log('     Knopf:', beschriftung);
check(await knopf.count() === 1, 'und genau ein Knopf darunter');
// Der Knopf macht mehr, als diese Übung zu tauschen – er hakt eine Beschwerde
// an, die für den ganzen Plan gilt. Also muss er das auch sagen.
check(/Überlasteter unterer Rücken/.test(beschriftung) && /anhaken/.test(beschriftung),
  'der Knopf nennt die Beschwerde, die er anhakt – nicht „Übung tauschen"');

// --- 3. Und dann ist die Übung wirklich weg -----------------------------
const vorher = await page.evaluate(async () => {
  const { PLAN } = await import('./js/data.js');
  const { exOf } = await import('./js/plan.js');
  return PLAN.filter((w) => exOf(w, 'db').some((it) => it.id === 'einarmiges-kh-rudern')).length;
});
await knopf.first().click();
await page.waitForTimeout(600);
const nachher = await page.evaluate(async () => {
  const store = await import('./js/store.js');
  const { PLAN } = await import('./js/data.js');
  const { exOf } = await import('./js/plan.js');
  const zaehl = (id) => PLAN.filter((w) => exOf(w, 'db').some((it) => it.id === id)).length;
  return {
    angehakt: (store.getState().injuries || []).includes('rueckenstrecker'),
    rudern: zaehl('einarmiges-kh-rudern'),
    ersatz: zaehl('inverted-row'),
    // Auch im Bodyweight-Modus: Die Beschwerde gilt nicht je Modus.
    rudernBw: PLAN.filter((w) => exOf(w, 'bw').some((it) => it.id === 'einarmiges-kh-rudern')).length,
  };
});
console.log('     Rudern in Einheiten:', vorher, '→', nachher.rudern,
  '· Inverted Row jetzt in', nachher.ersatz);
check(nachher.angehakt, 'nach dem Tippen steht die Beschwerde unter den angehakten');
check(vorher > 0 && nachher.rudern === 0,
  `und das Langhantelrudern ist aus dem ganzen Plan raus (${vorher} → ${nachher.rudern} Einheiten)`);
check(nachher.rudernBw === 0, 'im Bodyweight-Modus genauso – die Beschwerde gilt für beide');
check(nachher.ersatz >= vorher, `die Inverted Row ist dafür eingesprungen (${nachher.ersatz} Einheiten)`);

// Und in der Liste steht danach der Ersatz. Neu geladen statt nur neu
// gezeichnet: Nach dem Anhaken springt die Ansicht, und ein Klick auf einen
// Knopf, der gerade woanders steht, prüft nichts.
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(400);
for (let k = 0; k < 25; k++) {
  const kopf = (await page.locator('#view').textContent()).replace(/\s+/g, ' ');
  if (new RegExp(`Workout ${zielN}\\b`).test(kopf)) break;
  await page.locator('[data-act="nav-workout"][data-delta="1"]').first().click();
  await page.waitForTimeout(200);
}
await page.locator('[data-act="show-list"]').first().click();
await page.waitForTimeout(400);
const namen = (await page.locator('.ex-name').allTextContents()).map((x) => x.trim());
console.log('     Einheit danach:', namen.join(' | '));
check(namen.some((x) => /Inverted Row/.test(x)) && !namen.some((x) => /Langhantelrudern/.test(x)),
  'in der Einheit steht jetzt die Inverted Row und nicht mehr das Langhantelrudern');

// --- 4. Abgehakt wird unter Beschwerden, und dann ist alles zurück ------
const zurueck = await page.evaluate(async () => {
  const store = await import('./js/store.js');
  store.toggleInjury('rueckenstrecker', false);
  const { PLAN } = await import('./js/data.js');
  const { exOf } = await import('./js/plan.js');
  return PLAN.filter((w) => exOf(w, 'db').some((it) => it.id === 'einarmiges-kh-rudern')).length;
});
check(zurueck === vorher,
  `Haken weg, Übung zurück – vollständig und ohne Rest (${zurueck} von ${vorher})`);

// --- 5. Die abgeschaffte zweite Reihe ist auch wirklich weg -------------
//
// Nicht Kosmetik: Solange nachbarn() noch exportiert wäre, stünde neben dem
// neuen Weg der alte, und irgendwann liefe einer von beiden ins Leere.
const alt = await page.evaluate(async () => {
  const plan = await import('./js/plan.js');
  return { nachbarn: typeof plan.nachbarn, kosten: typeof plan.tauschKosten };
});
check(alt.nachbarn === 'undefined' && alt.kosten === 'undefined',
  'nachbarn() und tauschKosten() gibt es nicht mehr');
check(await page.locator('.lbl-nah').count() === 0,
  'und an keiner Karte steht noch eine zweite Auswahlreihe');

// --- 6. Kein Hinweis „steht schon unter Beschwerden" -------------------
//
// Nicht vergessen, sondern unmöglich: Jede Beschwerde, auf die ein
// Schmerz-Eintrag zeigt, sperrt genau diese Übung (Abschnitt 1). Ist sie
// angehakt, steht die Übung nicht mehr da, deren Karte den Hinweis tragen
// würde. Eine erste Fassung hatte ihn trotzdem – toter Code, gefunden beim
// Nachsehen und nicht durch einen Fehler. Diese Prüfung hält fest, dass die
// Lage wirklich so ist, damit ihn niemand gutgläubig wieder einbaut.
const beideAn = await page.evaluate(async () => {
  const store = await import('./js/store.js');
  const { PLAN } = await import('./js/data.js');
  const { exOf } = await import('./js/plan.js');
  const { EXERCISES } = await import('./js/data.js');
  const mit = EXERCISES.filter((e) => (e.schmerz || []).some((x) => (x.verletzung || []).length));
  mit.forEach((e) => (e.schmerz || []).forEach((x) => (x.verletzung || [])
    .forEach((v) => store.toggleInjury(v, true))));
  const sichtbar = new Set();
  PLAN.forEach((w) => ['db', 'bw'].forEach((m) => exOf(w, m)
    .forEach((it) => sichtbar.add(it.id))));
  const raus = mit.filter((e) => sichtbar.has(e.id)).map((e) => e.id);
  store.clearInjuries();
  return { geprueft: mit.length, trotzdemDa: raus };
});
console.log('     alle Beschwerden an:', beideAn.geprueft, 'Übungen mit Knopf geprüft');
check(beideAn.trotzdemDa.length === 0,
  `mit allen angehakt steht keine davon mehr im Plan (${beideAn.trotzdemDa.join(', ') || 'keine'})`);

check(errs.length === 0, `keine Fehler${errs.length ? ': ' + errs.slice(0, 2).join(' | ') : ''}`);
await browser.close();
console.log(`\n${fails ? fails + ' FEHLER' : 'alle Prüfungen bestanden'}`);
