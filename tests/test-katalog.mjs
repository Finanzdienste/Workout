/*
 * Hat jede Übung im Katalog eine Aufgabe?
 *
 *     „wenn die Übungen keinen Sinn machen dann brauch man sie ja nicht mit
 *      reinzubringen"
 *
 * Der Katalog ist breiter als der Plan, und das ist Absicht: 35 Übungen, von
 * denen der ausgelieferte Plan 24 benutzt. Die anderen elf stehen nicht
 * herum – sie sind der Ersatz. Wer das Band abwählt, die Klimmzugstange nicht
 * hat oder eine Übung nicht mag, bekommt eine von ihnen.
 *
 * Nur: „ist Ersatz" ist eine Behauptung, und Behauptungen veralten. Eine neue
 * Übung, die niemand je zu sehen bekommt, ist tote Last im Katalog, in der
 * Übersicht unter „Mehr" und in jeder Rechnung, die über ihn läuft. Dieser
 * Test rechnet deshalb für **jede** Übung nach, auf welchem der drei Wege sie
 * tatsächlich erreichbar ist:
 *
 *   1. Sie steht in einem der vier Pläne.
 *   2. Sie springt ein, wenn eine andere Übung abgewählt wird (im geladenen Plan).
 *   3. Sie steht im geladenen Plan, wenn Geräte fehlen.
 *
 * Kein Weg, keine Daseinsberechtigung – dann gehört sie raus oder der Plan
 * muss sie benutzen. Gemessen am 16.09.2026: alle 35 sind erreichbar, neun der
 * elf Nicht-Plan-Übungen über Weg 2, alle elf über Weg 3.
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

const daten = await page.evaluate(async () => {
  const { EXERCISES, PLAN, PLANS } = await import('./js/data.js');
  const vorrat = await import('./js/vorrat.js');
  const store = await import('./js/store.js');
  const alle = EXERCISES.map((e) => e.id);

  // Weg 1 über alle vier Pläne: Wer den Cut wählt, sieht dessen Übungen –
  // eine Übung, die nur dort steht, ist keine tote Last. Seit dem 25.09.
  // braucht das Inverted Row auch ohne Hanteln die Klimmzugstange und ist
  // damit im Aufbau ohne Gerät nicht mehr der Ersatz; im Cut steht es.
  const imPlan = new Set();
  Object.values(PLANS).forEach((p) => p.plan.forEach((w) => w.ex.forEach((it) => imPlan.add(it.id))));

  // Weg 2: jede Übung einzeln abwählen und aufschreiben, wer für sie einspringt.
  const ersatzVon = {};
  for (const mode of ['db', 'bw']) {
    for (const id of alle) {
      store.setSetting('ausUebungen', [id]);
      const zu = vorrat.ersatzFuer(id, mode);
      if (zu) (ersatzVon[zu] = ersatzVon[zu] || []).push(`${id}/${mode}`);
    }
  }
  store.setSetting('ausUebungen', []);

  // Weg 3: alles abwählen, was man abwählen kann – was steht dann im Plan?
  const ohneGeraet = {};
  for (const mode of ['db', 'bw']) {
    store.setSetting('fehlt', vorrat.GERAETE.map((g) => g.id));
    const drin = new Set();
    PLAN.forEach((w) => vorrat.vorratFassung(w.ex, mode).items.forEach((it) => drin.add(it.id)));
    ohneGeraet[mode] = [...drin];
    store.setSetting('fehlt', []);
  }

  return { alle, imPlan: [...imPlan], ersatzVon, ohneGeraet };
});

const wege = (id) => {
  const w = [];
  if (daten.imPlan.includes(id)) w.push('Plan');
  if ((daten.ersatzVon[id] || []).length) w.push(`Ersatz für ${daten.ersatzVon[id].length}`);
  const ohne = ['db', 'bw'].filter((m) => daten.ohneGeraet[m].includes(id));
  if (ohne.length) w.push(`ohne Gerät (${ohne.join(',')})`);
  return w;
};

console.log(`     Katalog ${daten.alle.length} · im Plan ${daten.imPlan.length}`);
const tot = daten.alle.filter((id) => wege(id).length === 0);
for (const id of daten.alle.filter((x) => !daten.imPlan.includes(x))) {
  console.log(`     ${id.padEnd(32)} ${wege(id).join(' · ') || '— kein Weg —'}`);
}
check(tot.length === 0,
  `jede Katalogübung ist erreichbar${tot.length ? ' – tote Last: ' + tot.join(', ') : ''}`);

console.log(`     der Plan benutzt ${daten.imPlan.length} von ${daten.alle.length} Übungen`);

// „sodass man trotzdem alle Muskelgruppen optimal trainiert" – das geht nur,
// wenn jede Gruppe mehr als eine Übung hat, die sie ernsthaft trifft. Bei einer
// einzigen ist ihre Abwahl das Ende der Gruppe, und keine Ersatzregel der Welt
// ändert daran etwas.
//
// Gezählt wird mit derselben Schwelle wie in ersatzFuer(): ein Anteil ab 0,5.
// Nicht „ist ihr Hauptmuskel" – danach steht das Gesäß allein am Hip Thrust,
// obwohl beide Kreuzheben voll darauf einzahlen und der Ersatz sie auch nimmt.
// Was der Tausch an Schwerpunkt verschiebt, rechnet vorratBilanz() vor.
const einsam = await page.evaluate(async () => {
  const { EXERCISES } = await import('./js/data.js');
  const zaehl = {};
  const haupt = {};
  for (const mode of ['db', 'bw']) {
    EXERCISES.forEach((e) => {
      const anteile = e[mode].shares;
      const oben = Object.entries(anteile).sort((a, b) => b[1] - a[1])[0];
      if (oben) haupt[`${oben[0]}/${mode}`] = true;
      Object.entries(anteile).forEach(([m, v]) => {
        if (v >= 0.5) zaehl[`${m}/${mode}`] = (zaehl[`${m}/${mode}`] || 0) + 1;
      });
    });
  }
  // Nur Gruppen, um die es bei irgendeiner Übung überhaupt geht: Nacken und
  // vordere Schulter kommen nirgends als Schwerpunkt vor, sie fallen nebenbei
  // ab – und haben deshalb auch kein Ziel im Plan.
  return Object.keys(haupt).filter((k) => (zaehl[k] || 0) < 2);
});
console.log(`     Gruppen mit nur einer Übung: ${einsam.length ? einsam.join(', ') : 'keine'}`);
check(einsam.length === 0,
  `jede Muskelgruppe hat mindestens zwei Übungen${einsam.length ? ': ' + einsam.join(', ') : ''}`);

// Und der Ersatz greift wirklich: Jede Übung *im Plan* muss eine haben, sonst
// hinterlässt ihre Abwahl eine Lücke statt eines Tauschs.
const ohneErsatz = await page.evaluate(async (ids) => {
  const vorrat = await import('./js/vorrat.js');
  const store = await import('./js/store.js');
  const raus = [];
  for (const mode of ['db', 'bw']) {
    for (const id of ids) {
      store.setSetting('ausUebungen', [id]);
      if (!vorrat.ersatzFuer(id, mode)) raus.push(`${id}/${mode}`);
    }
  }
  store.setSetting('ausUebungen', []);
  return raus;
}, daten.imPlan);
console.log(`     ohne Ersatz: ${ohneErsatz.length ? ohneErsatz.join(', ') : 'keine'}`);
check(ohneErsatz.length === 0,
  `jede Übung des Plans hat einen Ersatz${ohneErsatz.length ? ': ' + ohneErsatz.join(', ') : ''}`);

// --- Startgewicht auf dem eigenen Schritt, eine Schreibweise für „ohne" ---
//
// Die Kurzhantel-Bodenpresse stand auf 12 kg bei 2,5er-Schritten: Der Knopf
// lief 12 → 14,5 → 17, der Anfänger bekam 5 statt 6. Und „ohne Gerät" stand in
// vier Schreibweisen im Katalog, die die Übungskarte roh anzeigt.
const form = await page.evaluate(async () => {
  const { EXERCISES } = await import('./js/data.js');
  const daneben = EXERCISES.filter((e) => e.weight > 0 && e.step
    && Math.abs(e.weight / e.step - Math.round(e.weight / e.step)) > 1e-9)
    .map((e) => `${e.id} ${e.weight}/${e.step}`);
  const ohne = new Set();
  EXERCISES.forEach((e) => ['db', 'bw'].forEach((m) => {
    if (/^ohne/i.test(e[m].equip || '')) ohne.add(e[m].equip.replace(/ \(.*\)$/, ''));
  }));
  return { daneben, ohne: [...ohne] };
});
check(form.daneben.length === 0,
  `jedes Startgewicht liegt auf dem Schritt seiner Übung${form.daneben.length ? ': ' + form.daneben.join(', ') : ''}`);
check(form.ohne.length === 1 && form.ohne[0] === 'Ohne Gerät',
  `„ohne Gerät" in einer Schreibweise (${form.ohne.join(' | ')})`);

// --- Pausen nach der Regel aus dem README (Abschnitt Pausenlängen) -------
//
// Stufe 1 unter 8 Wdh. 3:00, Stufe 1 ab 8 Wdh. 2:30, Stufe 2 und 3 2:00,
// Stufe 4 1:30. Die Ausnahmen stehen dort mit Grund; jede andere Abweichung
// ist ein Versehen – wie das Band-Schulterdrücken, das mit 3:00 länger
// pausierte als die Hantelfassung.
const AUSNAHMEN = {
  'sitzendes-schulterdruecken.db': 150,   // „Und sicher 3 min Pause?" – nein
  'pike-liegestuetze.db': 150, 'pike-liegestuetze.bw': 150,
  'reverse-snow-angel.db': 90, 'reverse-snow-angel.bw': 90,
};
const pausen = await page.evaluate(async () => {
  const { EXERCISES } = await import('./js/data.js');
  return EXERCISES.flatMap((e) => ['db', 'bw'].map((m) => ({
    k: `${e.id}.${m}`, tier: e.tier, lo: Number((/\d+/.exec(e[m].reps) || [0])[0]), rest: e[m].rest })));
});
const regel = (p) => (p.tier === 1 ? (p.lo < 8 ? 180 : 150) : (p.tier === 4 ? 90 : 120));
const abweichend = pausen.filter((p) => p.rest !== (AUSNAHMEN[p.k] ?? regel(p)))
  .map((p) => `${p.k} ${p.rest} statt ${AUSNAHMEN[p.k] ?? regel(p)}`);
check(abweichend.length === 0,
  `jede Pause folgt der Regel oder einer benannten Ausnahme${abweichend.length ? ': ' + abweichend.join(', ') : ''}`);

check(errs.length === 0, `keine Fehler${errs.length ? ': ' + errs[0] : ''}`);
console.log(`\n${fails ? fails + ' FEHLER' : 'alle Prüfungen bestanden'}`);
await browser.close();
