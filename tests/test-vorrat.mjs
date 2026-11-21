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
  // „Rücken ist gedeckt", weil es das Inverted Row gab, damals an der Tischkante.
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
// Und sie ist *nicht* kürzer geworden. Das war sie einmal, und es war ein
// Fehler in ersatzFuer(): Ein Ersatz wird übersprungen, wenn er in derselben
// Einheit schon steht. An Tagen mit zwei Zugübungen oder zwei Seitheben gab es
// aber nur einen Kandidaten – die zweite fiel ersatzlos weg. Nachgezählt über
// einen Aufbau-Durchlauf: 28 von 28 weggefallenen Übungen hätten einen Ersatz
// gehabt, der nur belegt war. Seit es je Bewegung einen zweiten gibt
// (Rucksack-Rudern, sitzendes Flaschen-Seitheben), bleibt die Einheit ganz.
check(einheit && einheit.jetzt === einheit.geplant,
  `die Einheit bleibt vollständig (${einheit && einheit.jetzt} von ${einheit && einheit.geplant} Übungen)`);

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
// v273: Der Maßstab ist das Training, nicht die einzelne Übung –
//     „Wie gesagt, es muss nicht jede Übung 1:1 n bodyweight equivalent
//      haben. Hauptsache jedes Training hat die gleichen muskelgruppen wie
//      das Hantel equivalent"
check(/Jedes Training trifft weiter alle Muskelgruppen wie mit Hanteln\./.test(text),
  `die Karte sagt zuerst, ob jedes Training dieselben Muskelgruppen trifft (${(/Bodyweight-Modus heißt das:[^.]{0,120}\./.exec(text) || ['(nicht gefunden)'])[0]})`);
check(!/Eins zu eins/.test(text) && !/fallen aus dem Plan/.test(text) && /Getauscht: .*Band-Curls → /.test(text),
  'keine „Eins zu eins"-Liste und kein „fallen aus dem Plan" mehr – die Tausche stehen unter „Getauscht"');

// Umschalten auf Hanteln – „alles aus bodyweight +". Seit v272 stellt der
// Knopf in „Was da ist" das Training um, wie „Womit trainierst du":
//
//     „Hab auf bodyweight umgestellt aber trotzdem steht das heutige Workout
//      auf Hanteln?"
const vorratKnopf = (label) => page.locator('.section-title:has-text("Was da ist") + .card button', { hasText: label }).first();
const modusJetzt = () => page.evaluate(async () => (await import('./js/store.js')).getState().mode);
const womitGewaehlt = async () => ((await page.locator('.section-title:has-text("Womit trainierst du") + .card [aria-pressed="true"]')
  .first().textContent({ timeout: 1500 }).catch(() => '')) || '').replace(/\s+/g, ' ').trim();
await vorratKnopf('Hanteln').click();
await page.waitForTimeout(300);
const dbText = (await page.locator('#view').textContent()).replace(/\s+/g, ' ');
check(/Alles aus Bodyweight zählt hier mit/.test(dbText),
  'die Hantel-Seite sagt, dass Bänder und Stange hier mitzählen');
check(/Kurzhanteln/.test(dbText) && /Langhantel/.test(dbText) && /SZ-Stange/.test(dbText),
  'und listet die Hanteln darunter');
check(/Scheibengröße hinzufügen/.test(dbText),
  'die Scheiben-Auflistung steht darunter, wie bisher');
check(/Jedes Training trifft weiter alle Muskelgruppen wie geplant\./.test(dbText),
  'auch mit Hanteln sagt die Karte es – gemessen am Plan');
const mitHanteln = { modus: await modusJetzt(), womit: await womitGewaehlt() };
check(mitHanteln.modus === 'db' && /Hanteln/.test(mitHanteln.womit),
  `„Hanteln" in „Was da ist" stellt das Training um – Modus ${mitHanteln.modus}, unter „Womit trainierst du" „${mitHanteln.womit}" (bis v271 nur die Liste)`);
// Bänder und Stange stehen mit Hanteln in der Liste – abwählbar, ohne auf
// Bodyweight umzustellen.
const vorratZeilen = await page.locator('.section-title:has-text("Was da ist") + .card [data-act="toggle-vorrat"]')
  .evaluateAll((els) => els.map((e) => e.dataset.v));
check(['band-gelb', 'band-rot', 'stange', 'kurzhantel', 'langhantel'].every((id) => vorratZeilen.includes(id)),
  `mit Hanteln stehen Bänder, Stange und Hanteln zum Abwählen da (${vorratZeilen.join(', ')})`);
// Und zurück auf Bodyweight: der Fokus bleibt auf dem Knopf, den man getippt
// hat – nicht auf dem gleichen unter „Womit trainierst du".
await vorratKnopf('Bodyweight').click();
await page.waitForTimeout(300);
const mitBw = {
  modus: await modusJetzt(),
  womit: await womitGewaehlt(),
  fokus: await page.evaluate(() => document.activeElement && document.activeElement.id),
  zeilen: await page.locator('.section-title:has-text("Was da ist") + .card [data-act="toggle-vorrat"]')
    .evaluateAll((els) => els.map((e) => e.dataset.v)),
};
check(mitBw.modus === 'bw' && /Bodyweight/.test(mitBw.womit) && mitBw.fokus === 'vorrat-bw',
  `„Bodyweight" stellt zurück – Modus ${mitBw.modus}, „${mitBw.womit}", Fokus auf ${mitBw.fokus || 'nichts'}`);
check(mitBw.zeilen.join(',') === 'band-gelb,band-rot,stange',
  `mit Bodyweight nur Bänder und Stange (${mitBw.zeilen.join(', ')})`);

// Im Training: der Tausch ist benannt.
await page.evaluate(async () => {
  const store = await import('./js/store.js');
  store.setSetting('tab', 'dashboard');
});
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(400);
// Erkannt wird die Einheit an data-n: Seit v271 steht die Nummer nicht mehr
// in der Augenbraue („Die Workout Nummer ist mir … komplett egal"), dort nur
// noch das Wann – „T · Heute", „T · in 2 Tagen" (wannWort() in js/app.js).
const ziel = await page.evaluate(async () => {
  const { PLAN } = await import('./js/data.js');
  const { vorratNotiz, effDate } = await import('./js/plan.js');
  const { daysBetween, todayISO } = await import('./js/dates.js');
  const w = PLAN.find((x) => vorratNotiz(x, 'bw').getauscht.length);
  return w ? { n: w.n, d: daysBetween(todayISO(), effDate(w)) } : { n: 0, d: 0 };
});
const zielN = ziel.n;
const wann = (d) => (d === 0 ? 'Heute' : d === 1 ? 'Morgen' : d === -1 ? 'Gestern'
  : d > 1 ? `in ${d} Tagen` : `vor ${-d} Tagen`);
for (let k = 0; zielN && k < 25; k++) {
  if (await page.locator(`.hero-eyebrow[data-n="${zielN}"]`).count()) break;
  await page.locator('[data-act="nav-workout"][data-delta="1"]').first().click();
  await page.waitForTimeout(200);
}
const braue = ((await page.locator(`.hero-eyebrow[data-n="${zielN}"]`).first()
  .textContent({ timeout: 1500 }).catch(() => '')) || '').replace(/\s+/g, ' ').trim();
check(zielN > 0 && braue === `T · ${wann(ziel.d)}`,
  `bei der Einheit mit dem Tausch (data-n="${zielN}"), oben das Wann und keine Nummer („${braue}")`);
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

// --- 5b. Jedes Training dieselben Muskelgruppen wie mit Hanteln (v273) ---
//
// Tobis Maßstab für die Fassung ohne Hanteln, als Wache über alle vier Pläne:
// Je Einheit trifft die Bodyweight-Fassung – mit allem, ohne Stange, ohne
// Bänder, ohne beides – jede Muskelgruppe direkt (Anteil ab 0,5), die ihre
// Hantel-Fassung trifft. Nicht Übung für Übung, sondern das Training. Dazu
// kommen darf etwas: Ohne Stange springt für die Chin-ups das Rucksack-Rudern
// ein und trifft Bizeps und Nacken direkt mit (am 21.11. in 50 von 336
// Einheiten) – das steht in der Ausgabe, fehlt aber nichts.
const gleicheGruppen = await page.evaluate(async () => {
  const store = await import('./js/store.js');
  const { PLANS } = await import('./js/data.js');
  const { EX_BY_ID } = await import('./js/uebung.js');
  const { vorratFassung } = await import('./js/vorrat.js');
  const direkt = (items, mode) => {
    const g = new Set();
    items.forEach((it) => Object.entries(EX_BY_ID.get(it.id)[mode].shares)
      .forEach(([m, a]) => { if (a >= 0.5) g.add(m); }));
    return g;
  };
  const faelle = [[], ['stange'], ['band-gelb', 'band-rot'], ['band-gelb', 'band-rot', 'stange']];
  const vorher = store.getState().fehlt;
  const out = {};
  for (const fehlt of faelle) {
    store.setSetting('fehlt', fehlt);
    const abw = [];
    const dazu = new Map();
    let einheiten = 0;
    Object.entries(PLANS).forEach(([key, v]) => v.plan.forEach((w, i) => {
      einheiten++;
      const db = direkt(w.ex, 'db');
      const bw = direkt(vorratFassung(w.ex.map((it) => ({ id: it.id, sets: it.bwSets ?? it.sets })), 'bw').items, 'bw');
      const fehlen = [...db].filter((m) => !bw.has(m));
      if (fehlen.length) abw.push(`${key} ${i + 1}: ohne ${fehlen.join(',')}`);
      [...bw].filter((m) => !db.has(m)).forEach((m) => dazu.set(m, (dazu.get(m) || 0) + 1));
    }));
    out[fehlt.join('+') || 'alles da'] = { einheiten, abw, dazu: [...dazu.entries()].map(([m, k]) => `${m} ${k}`).join(', ') };
  }
  store.setSetting('fehlt', vorher);
  return out;
});
for (const [fall, r] of Object.entries(gleicheGruppen)) {
  if (r.dazu) console.log(`     ${fall}, dazu direkt: ${r.dazu}`);
  check(r.einheiten >= 4 * 84 && r.abw.length === 0,
    `${fall}: jedes Bodyweight-Training trifft alle Muskelgruppen seiner Hantel-Fassung (${r.einheiten} Einheiten, ${r.abw.length} mit Lücke${r.abw.length ? ` – ${r.abw.slice(0, 3).join(' · ')}` : ''})`);
}

// --- 5c. Mit Hanteln, aber ohne Hanteln: die Karte zeigt auf Bodyweight ---
{
  const ctx3 = await browser.newContext({ viewport: { width: 414, height: 896 } });
  await ctx3.route('**/rest/v1/**', (r) => r.fulfill({ status: 204, body: '' }));
  const p3 = await ctx3.newPage();
  p3.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message));
  await p3.addInitScript(() => {
    if (sessionStorage.getItem('gesaet')) return;
    sessionStorage.setItem('gesaet', '1');
    localStorage.setItem('workout.state.v1', JSON.stringify({
      greeted: true, name: 'T', mode: 'db', tab: 'settings', fehlt: ['kurzhantel', 'langhantel', 'sz'],
    }));
  });
  await p3.goto(URL, { waitUntil: 'networkidle' });
  await p3.waitForTimeout(400);
  const karte = ((await p3.locator('.section-title:has-text("Was da ist") + .card').first().textContent()
    .catch(() => '')) || '').replace(/\s+/g, ' ');
  const satz = (/In \d+ von \d+ Trainings fehlt dann eine Muskelgruppe des Plans:[^.]*\./.exec(karte) || [''])[0];
  console.log(`     ohne Hanteln im Hantel-Modus: ${satz}`);
  check(!!satz && /Oberschenkel/.test(satz),
    '5c ohne Hanteln im Hantel-Modus nennt die Karte die Trainings, denen eine Muskelgruppe fehlt');
  check(/Mit Bodyweight \(Knopf darüber\) träfe jedes Training sie alle\./.test(karte),
    '5c und dass Bodyweight sie alle träfe');
  await ctx3.close();
}

// --- 6. Tobis Fall: in „Was da ist" auf Bodyweight, das Training folgt ----
//
//     „Hab auf bodyweight umgestellt aber trotzdem steht das heutige Workout
//      auf Hanteln?"
//
// Mit Hanteln unterwegs, unter Mehr → Was da ist „Bodyweight" getippt: Bis
// v271 wechselte das nur die Liste, vorn blieb „Hanteln · 4 Übungen · 14
// Sätze" und „▶︎ Start 🏋️ Hanteln". Eigener Kontext, frischer Zustand.
{
  const ctx2 = await browser.newContext({ viewport: { width: 414, height: 896 } });
  await ctx2.route('**/rest/v1/**', (r) => r.fulfill({ status: 204, body: '' }));
  const p2 = await ctx2.newPage();
  p2.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message));
  await p2.addInitScript(() => {
    if (sessionStorage.getItem('gesaet')) return;
    sessionStorage.setItem('gesaet', '1');
    localStorage.setItem('workout.state.v1', JSON.stringify({
      greeted: true, name: 'T', mode: 'db', tab: 'settings', fehlt: ['band-gelb', 'band-rot', 'stange'],
    }));
  });
  await p2.goto(URL, { waitUntil: 'networkidle' });
  await p2.waitForTimeout(400);
  await p2.locator('.section-title:has-text("Was da ist") + .card button', { hasText: 'Bodyweight' }).first().click();
  await p2.waitForTimeout(300);
  const toast = ((await p2.locator('#toast').textContent().catch(() => '')) || '').trim();
  await p2.locator('.tab[data-tab="dashboard"]').click();
  await p2.waitForTimeout(400);
  const sub = ((await p2.locator('#view .hero-sub').first().textContent().catch(() => '')) || '').replace(/\s+/g, ' ').trim();
  const start = ((await p2.locator('#view [data-act="start-session"] .start-modus').first().textContent()
    .catch(() => '')) || '').replace(/\s+/g, ' ').trim();
  const modus = await p2.evaluate(async () => (await import('./js/store.js')).getState().mode);
  console.log(`     Tobis Fall: ${toast} · ${sub} · Start ${start} · Modus ${modus}`);
  check(modus === 'bw' && /^Bodyweight · /.test(sub) && /Bodyweight/.test(start),
    `6 „Bodyweight" in „Was da ist" – vorn steht das Workout von heute auf Bodyweight („${sub}", Start „${start}")`);
  check(/^Bodyweight – /.test(toast), `6 und der Wechsel sagt es („${toast}")`);
  await ctx2.close();
}

// --- 7. Umstellen mitten im Training, ohne Verlust ----------------------
//
//     „Es muss die Möglichkeit geben innerhalb eines Workouts auch in den
//      Einstellungen was ändern zu können. Das bisher trainierte muss dann
//      trotzdem gemerkt werden."
//
// Das Protokoll führt die Varianten getrennt. Ein Wechsel schreibt nur, welche
// gerade gilt – abgehakte Sätze der anderen bleiben stehen.
const mitten = await page.evaluate(async () => {
  const store = await import('./js/store.js');
  const { workoutByNo } = await import('./js/plan.js');
  const n = 1;
  store.setWorkoutMode(n, 'bw');
  const ex = workoutByNo(n, 'bw').ex[0];
  store.updateSet(n, 'bw', ex.id, ex.sets, 0, { done: true });
  const vorher = store.getSets(n, 'bw', ex.id, ex.sets).filter((x) => x.done).length;
  store.setWorkoutMode(n, 'db');          // mitten im Training umgestellt
  const beiDb = store.workoutMode(n);
  store.setWorkoutMode(n, 'bw');
  const nachher = store.getSets(n, 'bw', ex.id, ex.sets).filter((x) => x.done).length;
  return { vorher, beiDb, nachher, gestartet: store.isStarted(n) };
});
console.log('     Wechsel:', JSON.stringify(mitten));
check(mitten.gestartet, 'die Einheit gilt als begonnen');
check(mitten.beiDb === 'db', 'der Wechsel greift auch dann');
check(mitten.vorher === 1 && mitten.nachher === 1,
  'und der abgehakte Satz steht danach unverändert da');

check(errs.length === 0, `keine Fehler${errs.length ? ': ' + errs.slice(0, 2).join(' | ') : ''}`);
await browser.close();
console.log(`\n${fails ? fails + ' FEHLER' : 'alle Prüfungen bestanden'}`);
