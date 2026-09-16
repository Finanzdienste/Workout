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
 *   1. Sie steht im Plan.
 *   2. Sie springt ein, wenn eine andere Übung abgewählt wird.
 *   3. Sie steht im Plan, wenn Geräte fehlen.
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
  const { EXERCISES, PLAN } = await import('./js/data.js');
  const vorrat = await import('./js/vorrat.js');
  const store = await import('./js/store.js');
  const alle = EXERCISES.map((e) => e.id);

  const imPlan = new Set();
  PLAN.forEach((w) => w.ex.forEach((it) => imPlan.add(it.id)));

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

check(errs.length === 0, `keine Fehler${errs.length ? ': ' + errs[0] : ''}`);
console.log(`\n${fails ? fails + ' FEHLER' : 'alle Prüfungen bestanden'}`);
await browser.close();
