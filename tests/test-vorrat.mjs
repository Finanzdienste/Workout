/*
 * Was gerade nicht da ist, steht auch nicht im Plan.
 *
 *     „Außerdem bin ich bei meinen Eltern wo ich nichts hab. Also auch keine
 *      Bänder und Klimmzugstange. Kann ich das irgendwo angeben?"
 *
 * Geprüft werden fünf Dinge, und das vierte ist das, an dem so ein Filter sonst
 * scheitert:
 *
 *   1. Ohne Abwahl ändert sich nichts. Der Normalfall ist „alles da"; wer die
 *      App seit Monaten benutzt, darf von dieser Datei nichts merken.
 *   2. Jede Übung sagt, was sie braucht – aus dem Gerätetext erzeugt, nicht
 *      geraten (siehe GERAET_AUS_TEXT in tools/build-data.py).
 *   3. Abgewählt heißt weg: Weder im Plan noch in einer Einheit taucht eine
 *      Übung auf, deren Gerät fehlt.
 *   4. Ein Ersatz hat dieselben Muskelanteile – sonst verschöbe der Vorrat die
 *      Wochenziele, ohne dass es jemand merkt. Genau das ist der Unterschied
 *      zwischen einem Filter und einem kaputten Plan.
 *   5. Und es steht auf dem Bildschirm: in den Einstellungen als Liste, im
 *      Training als „Statt …", samt der Wahrheit über das, was unbedeckt bleibt.
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

// --- 1. Ohne Abwahl ändert sich nichts ----------------------------------
const unberuehrt = await page.evaluate(async () => {
  const { PLAN } = await import('./js/data.js');
  const { exOf } = await import('./js/plan.js');
  const { vorratVollstaendig } = await import('./js/vorrat.js');
  const zaehle = (m) => PLAN.reduce((s, w) => s + exOf(w, m).length, 0);
  return { voll: vorratVollstaendig(), db: zaehle('db'), bw: zaehle('bw') };
});
console.log('     unberührt:', JSON.stringify(unberuehrt));
check(unberuehrt.voll, 'frisch installiert gilt: alles da');
check(unberuehrt.db > 300 && unberuehrt.db === unberuehrt.bw,
  `der Plan steht vollständig da (${unberuehrt.db} Übungseinträge je Modus)`);

// --- 2. Jede Übung sagt, was sie braucht --------------------------------
const braucht = await page.evaluate(async () => {
  const { EXERCISES } = await import('./js/data.js');
  const alle = new Set();
  let ohneFeld = 0;
  EXERCISES.forEach((e) => ['db', 'bw'].forEach((m) => {
    if (!Array.isArray(e[m].braucht)) { ohneFeld++; return; }
    e[m].braucht.forEach((g) => g.split('|').forEach((k) => alle.add(k)));
  }));
  return { ohneFeld, schluessel: [...alle].sort(), n: EXERCISES.length };
});
console.log('     Schlüssel:', braucht.schluessel.join(', '));
check(braucht.ohneFeld === 0,
  `alle ${braucht.n} Übungen tragen in beiden Varianten eine Geräteangabe`);
const bekannt = await page.evaluate(async () => {
  const { GERAETE } = await import('./js/vorrat.js');
  return GERAETE.map((g) => g.id);
});
check(braucht.schluessel.every((k) => k === 'band' || bekannt.includes(k)),
  `jeder Schlüssel lässt sich abwählen (${bekannt.join(', ')} – „band" deckt beide Farben)`);

// --- 3./4. Ohne Band und Stange ----------------------------------------
//
// Der Fall, um den es ging: bei den Eltern, nichts dabei. Im Bodyweight-Modus
// betrifft das acht Band- und drei Stangenübungen.
const ohne = await page.evaluate(async () => {
  const store = await import('./js/store.js');
  store.setSetting('fehlt', ['band-gelb', 'band-rot', 'stange']);
  const { PLAN, EXERCISES } = await import('./js/data.js');
  const { EX_BY_ID } = await import('./js/uebung.js');
  const { exOf, planSaetze } = await import('./js/plan.js');
  const { nichtMoeglich, ersatzFuer, ersatzGenau } = await import('./js/vorrat.js');

  const raus = nichtMoeglich('bw');
  const drin = new Set();
  PLAN.forEach((w) => exOf(w, 'bw').forEach((it) => drin.add(it.id)));

  const tausche = raus.map((id) => ({
    von: id, nach: ersatzFuer(id, 'bw'),
  })).filter((t) => t.nach);
  // Der Ersatz muss den Hauptmuskel der alten Übung mindestens zur Hälfte
  // treffen – daran hängt die 48-Stunden-Regel. Wo er ihn auch selbst als
  // Hauptmuskel hat, ist es ein voller Ersatz; sonst bringt er einen eigenen
  // Schwerpunkt mit (enge Liegestütze statt Trizepsdrücken bringen Brust).
  const haupt = (sh) => Object.entries(sh).sort((a, b) => b[1] - a[1])[0][0];
  const traegt = tausche.map((t) => {
    const h = haupt(EX_BY_ID.get(t.von).bw.shares);
    return { ...t, h, anteil: EX_BY_ID.get(t.nach).bw.shares[h] || 0,
      voll: haupt(EX_BY_ID.get(t.nach).bw.shares) === h };
  });
  const hauptGleich = traegt.every((t) => t.anteil >= 0.5);
  const nurNotnagel = traegt.filter((t) => !t.voll).map((t) => `${t.von}→${t.nach}`);
  const genau = tausche.filter((t) => ersatzGenau(t.von, t.nach, 'bw'));

  // Was der Plan vorsieht und was übrig bleibt – beides am Plan gerechnet,
  // nicht am Katalog. Genau hier stand die App zuerst falsch: Sie meldete
  // „Rücken ist gedeckt", weil es das Inverted Row an der Tischkante gibt.
  const summe = (hol) => {
    const acc = {};
    PLAN.forEach((w) => hol(w).forEach((it) => {
      Object.entries(EX_BY_ID.get(it.id).bw.shares).forEach(([m, v]) => {
        acc[m] = (acc[m] || 0) + it.sets * v;
      });
    }));
    return acc;
  };
  return {
    raus, tausche, hauptGleich, nurNotnagel, genau: genau.map((t) => `${t.von}→${t.nach}`),
    nochDrin: raus.filter((id) => drin.has(id)),
    soll: summe((w) => planSaetze(w, 'bw')),
    rest: summe((w) => exOf(w, 'bw')),
    gesamt: EXERCISES.length,
    wochen: PLAN.length / 4,   // vier Einheiten je Woche, siehe WEEK_SESSIONS
  };
});
console.log('     nicht möglich:', ohne.raus.length, 'von', ohne.gesamt);
console.log('     ersetzt:', ohne.tausche.map((t) => `${t.von}→${t.nach}`).join(' · '));
check(ohne.raus.length >= 10,
  `ohne Band und Stange gehen ${ohne.raus.length} Übungen nicht`);
check(ohne.nochDrin.length === 0,
  `und keine davon steht noch im Plan${ohne.nochDrin.length ? ': ' + ohne.nochDrin.join(', ') : ''}`);
check(ohne.tausche.length >= 8,
  `für fast jede gibt es Ersatz (${ohne.tausche.length} von ${ohne.raus.length})`);
check(ohne.hauptGleich,
  'und jeder Ersatz trifft den Hauptmuskel der alten Übung mindestens zur Hälfte '
  + '– daran hängt die 48-Stunden-Regel');
check(ohne.nurNotnagel.length <= 1,
  `fast alle sind voller Ersatz; mit eigenem Schwerpunkt nur: ${
    ohne.nurNotnagel.join(', ') || 'keiner'}`);
check(ohne.genau.length >= 2,
  `darunter Tausche mit identischen Anteilen, die gar nichts kosten (${ohne.genau.join(', ')})`);

// --- 4a. Und die Zielmuskelgruppen werden wirklich getroffen ------------
//
//     „Falls es irgendeinen Weg gibt (zB durch neue Übungen) auch bei full
//      bodyweight also auch ohne Bänder und so möglichst die Zielmuskelgruppen
//      dieser Einheit zu treffen dann können wir das gern machen."
//
// Gemessen, vorher und nachher. Vor dieser Prüfung stand hier: Rücken 0,0 von
// 10 Sätzen je Woche, Bizeps 0,0, seitliche Schulter 0,3, hintere Schulter 0,0.
// Zwei Dinge haben das geändert – dass ein Ersatz auch auf denselben
// Hauptmuskel gehen darf statt nur auf identische Anteile, und zwei Übungen
// mehr im Katalog (Seitheben mit Flaschen, Rucksack-Curls) für die beiden
// Gruppen, für die es sonst gar nichts gibt.
const wichtig = ['lats', 'biceps', 'sideDelts', 'rearDelts', 'traps', 'triceps', 'frontDelts'];
const proWoche = (tab, m) => (tab[m] || 0) / ohne.wochen;
console.log('     je Woche:', wichtig.map((m) =>
  `${m} ${proWoche(ohne.rest, m).toFixed(1)}/${proWoche(ohne.soll, m).toFixed(1)}`).join(' · '));
const duenn = wichtig.filter((m) => proWoche(ohne.rest, m) < proWoche(ohne.soll, m) * 0.6);
check(duenn.length === 0,
  `keine Zielgruppe fällt unter 60 % dessen, was der Plan vorsieht${
    duenn.length ? ' – außer ' + duenn.join(', ') : ''}`);
check(wichtig.every((m) => proWoche(ohne.rest, m) > 0),
  'und keine steht bei null – ganz ohne Gerät ist das der Unterschied zwischen '
  + 'Training und Lücke');

// --- 4b. Die Einheit selbst rechnet mit --------------------------------
//
// Der Punkt, an dem ein Filter sonst halb wirkt: Die Anzeige zeigt weniger, das
// Protokoll rechnet aber weiter mit der alten Liste. Deshalb sitzt der Tausch in
// exBasis() und nicht in der Darstellung.
const einheit = await page.evaluate(async () => {
  const { PLAN } = await import('./js/data.js');
  const { exOf, vorratNotiz } = await import('./js/plan.js');
  const treffer = PLAN.find((w) => vorratNotiz(w, 'bw').weg.length
    || vorratNotiz(w, 'bw').getauscht.length);
  if (!treffer) return null;
  const notiz = vorratNotiz(treffer, 'bw');
  const ids = exOf(treffer, 'bw').map((x) => x.id);
  return {
    n: treffer.n,
    geplant: treffer.ex.length,
    jetzt: ids.length,
    weg: notiz.weg.map((d) => d.id),
    getauscht: notiz.getauscht.map((s) => `${s.from}→${s.to}`),
    wegNochDa: notiz.weg.filter((d) => ids.includes(d.id)).map((d) => d.id),
  };
});
console.log('     Einheit:', JSON.stringify(einheit));
check(!!einheit, 'es gibt eine betroffene Einheit');
check(einheit && einheit.wegNochDa.length === 0,
  'was wegfällt, steht auch nicht mehr in exOf() – Protokoll und Bilanz sehen dasselbe');
check(einheit && einheit.jetzt < einheit.geplant,
  `die Einheit ist kürzer als geplant (${einheit && einheit.jetzt} statt ${einheit && einheit.geplant})`);

// --- 5. Und man sieht es ------------------------------------------------
await page.evaluate(async () => {
  const store = await import('./js/store.js');
  store.setSetting('greeted', true);
  store.setSetting('name', 'T');
  store.setSetting('mode', 'bw');
  store.setSetting('fehlt', ['band-gelb', 'band-rot', 'stange']);
  store.setSetting('tab', 'settings');
});
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(500);
const text = (await page.locator('#view').textContent()).replace(/\s+/g, ' ');
check(/Was da ist/.test(text), 'in den Einstellungen steht der Vorrat');
check(/Band, gelb/.test(text) && /Band, rot/.test(text) && /Klimmzugstange/.test(text),
  'mit Band gelb, Band rot und Klimmzugstange zum Ankreuzen');
check(/Je Woche bleiben dann: .{0,30}\d[,.]\d statt \d/.test(text),
  `und was dann je Woche übrig bleibt: ${(/Je Woche bleiben dann:[^.]{0,140}/.exec(text) || ['(nicht gefunden)'])[0].replace(/\s+/g, ' ')}`);
// Keine Warnung mehr, und das ist die Nachricht: Vor den zwei neuen Übungen
// stand hier „für seitliche Schulter bleibt so gut wie nichts übrig".
check(!/so gut wie nichts übrig/.test(text),
  'und ohne Warnung – keine Gruppe fällt mehr unter ein Drittel des Plans');
check(!/Scheibengröße hinzufügen/.test(text),
  'die Scheiben stehen auf der Hantel-Seite, nicht auf der Bodyweight-Seite');

// Umschalten auf die Hantel-Seite – „alles aus bodyweight +".
await page.locator('[data-act="vorrat-seite"][data-v="db"]').first().click();
await page.waitForTimeout(300);
const dbText = (await page.locator('#view').textContent()).replace(/\s+/g, ' ');
check(/Alles aus Bodyweight zählt hier mit/.test(dbText),
  'die Hantel-Seite sagt, dass Bänder und Stange hier mitzählen');
check(/Kurzhanteln/.test(dbText) && /Langhantel/.test(dbText) && /SZ-Stange/.test(dbText),
  'und listet die Hanteln darunter');
check(/Scheibengröße hinzufügen/.test(dbText),
  'die Scheiben-Auflistung steht darunter, wie bisher');

// Im Training: der Tausch ist benannt.
await page.evaluate(async () => {
  const store = await import('./js/store.js');
  store.setSetting('tab', 'dashboard');
});
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(400);
const zielN = await page.evaluate(async () => {
  const { PLAN } = await import('./js/data.js');
  const { vorratNotiz } = await import('./js/plan.js');
  const w = PLAN.find((x) => vorratNotiz(x, 'bw').getauscht.length);
  return w ? w.n : 0;
});
for (let k = 0; zielN && k < 25; k++) {
  const kopf = (await page.locator('#view').textContent()).replace(/\s+/g, ' ');
  if (new RegExp(`Workout ${zielN}\\b`).test(kopf)) break;
  await page.locator('[data-act="nav-workout"][data-delta="1"]').first().click();
  await page.waitForTimeout(200);
}
// Auf der Startansicht steht der Hinweis bewusst nicht – sie ist eine
// Bildschirmseite ohne Scrollen. Er steht dort, wo die Übungen stehen.
const uebersicht = (await page.locator('#view').textContent()).replace(/\s+/g, ' ');
check(!/Nicht da:/.test(uebersicht),
  `die Startansicht bleibt frei von der Vorrats-Karte (Workout ${zielN})`);
await page.locator('[data-act="start-session"]').first().click();
await page.waitForTimeout(500);
await page.locator('[data-act="focus-list"]').first().click();
await page.waitForTimeout(500);
const mitListe = (await page.locator('#view').textContent()).replace(/\s+/g, ' ');
check(/Nicht da: Band, gelb, Band, rot, Klimmzugstange/.test(mitListe),
  'bei den Übungen steht, was fehlt');
const liste = (await page.locator('#view').textContent()).replace(/\s+/g, ' ');
console.log('     im Training:', (/Statt [^–]{0,60}–[^.]{0,60}/.exec(liste) || ['(keine Statt-Zeile)'])[0].trim());
check(/Statt .{3,40}dafür fehlt gerade das Gerät/.test(liste),
  'und an der Übung steht, wofür sie eingesprungen ist – ein stiller Tausch wäre keiner');

check(errs.length === 0, `keine Fehler${errs.length ? ': ' + errs.slice(0, 2).join(' | ') : ''}`);
await browser.close();
console.log(`\n${fails ? fails + ' FEHLER' : 'alle Prüfungen bestanden'}`);
