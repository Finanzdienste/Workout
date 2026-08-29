import { chromium } from 'playwright';
import { URL, SHOT } from './umgebung.mjs';
const browser = await chromium.launch();
let page = await browser.newPage({ viewport: { width: 414, height: 896 } });
const errs = [];
page.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()); });
let fails = 0;
const check = (c, m) => { console.log(`${c ? 'OK  ' : 'FAIL'} ${m}`); if (!c) { fails++; process.exitCode = 1; } };

await page.goto(URL, { waitUntil: 'networkidle' });
await page.evaluate(() => { localStorage.clear(); localStorage.setItem('workout.state.v1', '{"greeted":true}'); });

// --- Gewicht ändern: nur Plus und Minus ------------------------------------
// Zwei Einheiten mit derselben Übung komplett auf 20 kg abhaken.
// Die Übung muss in der ersten Einheit stehen (dort wird der Vorschlag
// erwartet) und ein Gewicht haben. Welche Einheiten sie sonst noch enthalten,
// hängt vom Plan ab – seit der 48-Stunden-Regel liegen die Wiederholungen
// nicht mehr in Einheit 1 und 2, sondern eine Einheit weiter.
const probe = await page.evaluate(() => {
  const key = 'workout.state.v1';
  return import('./js/data.js').then(({ PLAN, EXERCISES }) => {
    const byId = new Map(EXERCISES.map((e) => [e.id, e]));
    const hat = (i, id) => PLAN[i].ex.some((x) => x.id === id);
    const pick = PLAN[0].ex.find((x) => byId.get(x.id).weight !== null
      && PLAN.slice(1).some((w, i) => hat(i + 1, x.id)));
    const zweite = PLAN.findIndex((w, i) => i > 0 && hat(i, pick.id));
    // Die Satzzahl ist je Einheit verschieden – genau so viele eintragen, wie
    // die jeweilige Einheit vorsieht, sonst gilt sie nicht als geschafft.
    const soll = (i) => PLAN[i].ex.find((x) => x.id === pick.id).sets;
    const sets = (i) => Array.from({ length: soll(i) }, () => ({ w: '20', r: '', done: true }));
    localStorage.setItem(key, JSON.stringify({ restSeconds: 0, weights: { [pick.id]: 20 }, log: {
      [PLAN[0].n]: { db: { [pick.id]: sets(0) }, bw: {}, mode: 'db', startedOn: '2026-08-19' },
      [PLAN[zweite].n]: { db: { [pick.id]: sets(zweite) }, bw: {}, mode: 'db', startedOn: '2026-08-21' },
    } }));
    return { name: byId.get(pick.id).db.name, step: byId.get(pick.id).step, zweite: PLAN[zweite].n };
  });
});
console.log('     Testübung:', probe.name, `· Schritt ${probe.step} kg`);
const ziel = String(20 + probe.step).replace('.', ',');
await page.reload({ waitUntil: 'networkidle' });
await page.locator('[data-act="show-list"]').click();
await page.waitForTimeout(150);
// Genau die Zeile der Testübung ansehen, nicht irgendeine
const row = page.locator('.ex', { hasText: probe.name });
await row.locator('.ex-head').first().click();
await page.waitForTimeout(200);

// Vorschläge gibt es nicht mehr: Die App weiß nicht, wie schwer ein Satz war.
check(await page.locator('.kg-bump').count() === 0,
  'auch nach zwei vollen Einheiten kein Steigerungsvorschlag');
check(await row.locator('.kg-val').first().inputValue() === '20',
  'das Gewicht steht unverändert da');

// Stattdessen: zwei Knöpfe, Schrittweite je Übung.
await row.locator('.kg-plus').first().click();
await page.waitForTimeout(200);
check(await row.locator('.kg-val').first().inputValue() === ziel,
  `"+" macht ${ziel} kg daraus (Schritt ${probe.step})`);
await row.locator('.kg-step').first().click();
await page.waitForTimeout(200);
check(await row.locator('.kg-val').first().inputValue() === '20', '"−" nimmt es zurück');

// Bodyweight: kein Kilo-Feld, dafür die Wiederholungen
await page.locator('.mode-btn[data-mode="bw"]').click();
await page.waitForTimeout(250);
check(await page.locator('.kg-bump').count() === 0, 'im Bodyweight-Modus erst recht kein Vorschlag');
const bwOffen = page.locator('.ex.open').first();
if (await bwOffen.count()) {
  check(await bwOffen.locator('.kg-fest').count() === 1,
    'dort steht der Wiederholungsbereich mit ± daneben');
}
await page.locator('.mode-btn[data-mode="db"]').click();
await page.waitForTimeout(200);

// --- Zurück-Taste -----------------------------------------------------------
// Eigene Seite: der Verlauf der Schritte oben würde sonst mitzählen.
await page.evaluate(() => { localStorage.clear(); localStorage.setItem('workout.state.v1', '{"greeted":true}'); });
await page.close();
page = await browser.newPage({ viewport: { width: 414, height: 896 } });
page.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message));
await page.goto(URL, { waitUntil: 'networkidle' });
// Eigener Kontext, eigener Speicher: Ohne diesen Vermerk stünde hier die
// Willkommensseite statt der Startansicht.
await page.evaluate(() => localStorage.setItem('workout.state.v1', '{"greeted":true}'));
await page.reload({ waitUntil: 'networkidle' });
await page.locator('[data-act="start-session"]').first().click();
await page.waitForTimeout(200);
check(await page.locator('.focus-name').count() === 1, 'Fokus-Ansicht offen');
await page.goBack();
await page.waitForTimeout(250);
check(await page.locator('.focus-name').count() === 0 && await page.locator('.bm-part').count() > 0,
  'Zurück führt aus dem Fokus in die Startansicht');
await page.locator('.tab[data-tab="stats"]').click();
await page.waitForTimeout(200);
await page.goBack();
await page.waitForTimeout(250);
check(await page.locator('.bm-part').count() > 0, 'Zurück führt vom Statistik-Tab zurück');

// --- Sicherungshinweis ------------------------------------------------------
// Der Tab bleibt beim Neuladen stehen – oben war zuletzt die Statistik offen.
await page.locator('.tab[data-tab="dashboard"]').click();
await page.waitForTimeout(150);
await page.evaluate(() => {
  const key = 'workout.state.v1';
  const st = JSON.parse(localStorage.getItem(key) || '{}');
  st.log = {};
  for (let i = 1; i <= 4; i++) st.log[i] = { db: {}, bw: {}, mode: 'db', startedOn: '2026-08-10', full: true };
  localStorage.setItem(key, JSON.stringify(st));
});
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(200);
// noch kein Hinweis, weil nichts wirklich abgeschlossen ist
check(await page.locator('[data-act="backup-now"]').count() === 0, 'kein Hinweis ohne abgeschlossene Einheiten');

await page.evaluate(async () => {
  const store = await import('./js/store.js');
  const { PLAN, EXERCISES } = await import('./js/data.js');
  const byId = new Map(EXERCISES.map((e) => [e.id, e]));
  for (let i = 0; i < 3; i++) {
    const w = PLAN[i];
    store.completeWorkout(w.n, 'db', w.ex.map((x) => ({ id: x.id, sets: x.sets })));
  }
  void byId;
});
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(200);
check(await page.locator('[data-act="backup-now"]').count() === 1, 'Sicherungshinweis nach drei Einheiten');
await page.screenshot({ path: `${SHOT}/98-backup.png` });

// --- Plan-Ende --------------------------------------------------------------
await page.evaluate(async () => {
  const store = await import('./js/store.js');
  const { PLAN } = await import('./js/data.js');
  PLAN.forEach((w) => store.completeWorkout(w.n, 'db', w.ex.map((x) => ({ id: x.id, sets: x.sets }))));
  store.setWeight('goblet-squat', 30);
});
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(200);
check(await page.locator('[data-act="restart-plan"]').count() === 1, 'Plan-Ende bietet Neustart an');
await page.screenshot({ path: `${SHOT}/99-planende.png` });
await page.locator('[data-act="restart-plan"]').first().click();
await page.waitForTimeout(300);
const eyebrow = await page.locator('.hero-eyebrow').textContent();
console.log('     nach Neustart:', eyebrow.trim());
check(eyebrow.includes('Workout 1'), 'nach dem Neustart steht Workout 1 an');
check((await page.locator('.hero-eyebrow').textContent()).includes('Heute'), 'und zwar heute');
const after = await page.evaluate(() => JSON.parse(localStorage.getItem('workout.state.v1')));
check(Object.keys(after.log).length === 0, 'Verlauf ist geleert');
check(after.weights['goblet-squat'] === 30, 'Gewichte bleiben stehen (30 kg)');
// Die Ablage steht in ihrem eigenen Schlüssel, und zwar aus einem Grund, der
// genau hier hängt: Der Hauptschlüssel wird bei **jedem abgehakten Satz**
// geschrieben. Läge die abgeschlossene Runde darin, ginge sie 96-mal je Plan
// mit über die Leitung. Beide Hälften werden deshalb geprüft – dass sie da ist,
// und dass sie nicht mehr im Weg liegt.
const ablage = await page.evaluate(() => JSON.parse(localStorage.getItem('workout.rounds.v1')));
check(ablage.length === 1, 'alte Runde liegt in der Ablage');
check(after.rounds === undefined, 'und nicht mehr im Schlüssel, den jeder Satz schreibt');
const gross = await page.evaluate(() => ({
  haupt: localStorage.getItem('workout.state.v1').length,
  ablage: localStorage.getItem('workout.rounds.v1').length,
}));
console.log(`     je Satz geschrieben: ${(gross.haupt / 1024).toFixed(0)} KB `
  + `(Ablage ${(gross.ablage / 1024).toFixed(0)} KB liegt daneben)`);
check(gross.haupt < gross.ablage,
  `der Schreibweg ist kleiner als die Ablage, die er nicht mehr trägt`);
await page.locator('.tab[data-tab="stats"]').click();
await page.waitForTimeout(200);
const stats = (await page.locator('.stat').allTextContents()).join(' | ');
check(stats.includes('Runden abgeschlossen'), 'Statistik weist die Runde aus');

// --- Zwei Stufen in der Körperkarte ----------------------------------------
await page.evaluate(() => { localStorage.clear(); localStorage.setItem('workout.state.v1', '{"greeted":true}'); });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(200);
const voll = await page.locator('.bm-part.on:not(.sub)').count();
const neben = await page.locator('.bm-part.on.sub').count();
console.log(`     Karte: ${voll} voll, ${neben} mitarbeitend`);
check(voll > 0 && neben > 0, 'Karte trennt Haupt- und mitarbeitende Muskeln');
check(await page.locator('.bm-legend span.sub').count() > 0, 'Legende weist die mitarbeitenden aus');
const aria = await page.locator('.bodymap').first().getAttribute('aria-label');
console.log('     aria:', aria);
check(aria.includes('vor allem') && aria.includes('Mitarbeitend'), 'aria-label nennt beide Stufen');

// --- Tempo: langsam ablassen, zügig hoch ------------------------------------
const tempo = await page.evaluate(async () => {
  const m = await import('./js/figure.js');
  const host = document.createElement('div');
  document.body.appendChild(host);
  const h = m.mountFigure(host, 'squat', true, 'goblet');
  h.stop(); h.setView(0, 0);
  const hoehe = (t) => {
    h.draw(t);
    const kopf = host.querySelector('.fig-head');
    return +kopf.getAttribute('cy');
  };
  // Vier Punkte der Bewegung: der Kopf muss beim Absenken tiefer wandern
  const out = [0, 0.33, 0.66, 1].map(hoehe);
  host.remove();
  return out;
});
console.log('     Kopfhöhe über die Bewegung:', tempo.map((x) => x.toFixed(1)).join(' → '));
check(tempo[0] < tempo[3], 'Kniebeuge: Kopf sinkt von Start bis Endstellung');
check(tempo[1] > tempo[0] && tempo[2] > tempo[1], 'die Bewegung läuft gleichmäßig durch');

// --- Abschließen vs. Abbrechen ---------------------------------------------
await page.evaluate(() => { localStorage.clear(); localStorage.setItem('workout.state.v1', '{"greeted":true}'); });
await page.reload({ waitUntil: 'networkidle' });
await page.locator('[data-act="start-session"]').first().click();
await page.waitForTimeout(250);
check(await page.locator('[data-act="finish-session"]').count() === 1
   && await page.locator('[data-act="discard-session"]').count() === 1, 'zwei Wege aus dem Training');

// Zwei Sätze abhaken und abschließen -> bleibt stehen
await page.locator('.focus-set').nth(0).click();
await page.waitForTimeout(150);
await page.locator('.focus-set').nth(1).click();
await page.waitForTimeout(150);
const label = await page.locator('[data-act="finish-session"]').textContent();
const soll = await page.evaluate(async () => {
  const { PLAN } = await import('./js/data.js');
  return PLAN[0].ex.reduce((a, i) => a + i.sets, 0);
});
console.log('     Knopf:', label.trim());
check(label.includes(`2/${soll}`), `Abschließen nennt den Stand (${label.trim()}, Plan: ${soll})`);
await page.locator('[data-act="finish-session"]').click();
await page.waitForTimeout(250);
await page.locator('[data-act="show-list"]').click();
await page.waitForTimeout(200);
check(await page.locator('.set-btn.on').count() === 2, 'nach Abschließen sind die Sätze noch da');
const nachAb = await page.evaluate(() => JSON.parse(localStorage.getItem('workout.state.v1')));
check(nachAb.session === null, 'Session ist beendet');
check(!!nachAb.log['1'].startedOn, 'Trainingstag ist festgehalten');

// Weitermachen und dann abbrechen -> alles weg
page.on('dialog', (d) => d.accept());
await page.locator('[data-act="hide-list"]').click();
await page.waitForTimeout(150);
await page.locator('[data-act="start-session"]').first().click();
await page.waitForTimeout(250);
await page.locator('.focus-set').last().click();
await page.waitForTimeout(150);
await page.locator('[data-act="discard-session"]').click();
await page.waitForTimeout(300);
const nachAbbruch = await page.evaluate(() => JSON.parse(localStorage.getItem('workout.state.v1')));
console.log('     nach Abbruch:', JSON.stringify(nachAbbruch.log['1'] || null));
check(nachAbbruch.session === null, 'Abbruch beendet die Session');
check(!(nachAbbruch.log['1'] && nachAbbruch.log['1'].startedOn), 'Trainingstag ist wieder weg');
await page.locator('[data-act="show-list"]').click();
await page.waitForTimeout(200);
check(await page.locator('.set-btn.on').count() === 0, 'nach Abbrechen ist nichts mehr abgehakt');

// --- Wochenvolumen je Muskelgruppe ------------------------------------------
// Über den ganzen Plan soll jede Gruppe im Schnitt exakt ihr Ziel bekommen,
// und keine einzelne Woche weit danebenliegen. Das Ziel ist nicht überall
// dasselbe – es kommt aus denselben erzeugten Daten wie der Plan, damit hier
// keine zweite Wahrheit steht. Gerechnet wird in Zwanzigsteln: alle Anteile
// sind Vielfache von 0,05, damit ist "exakt" hier wirklich exakt und nicht bis
// auf Rundungsfehler.
const volumen = await page.evaluate(async () => {
  const { EXERCISES, PLAN, TARGET, DERIVED, CAP } = await import('./js/data.js');
  const byId = new Map(EXERCISES.map((e) => [e.id, e]));
  const out = {};
  for (const mode of ['db', 'bw']) {
    const wochen = [];
    for (let k = 0; k + 4 <= PLAN.length; k += 4) {
      const c = {};
      for (const w of PLAN.slice(k, k + 4)) {
        for (const it of w.ex) {
          for (const [m, anteil] of Object.entries(byId.get(it.id)[mode].shares)) {
            c[m] = (c[m] || 0) + it.sets * Math.round(anteil * 20);
          }
        }
      }
      wochen.push(c);
    }
    const gruppen = [...new Set(wochen.flatMap((c) => Object.keys(c)))];
    out[mode] = Object.fromEntries(gruppen.map((m) => [m, {
      summe: wochen.reduce((a, c) => a + (c[m] || 0), 0),
      lo: Math.min(...wochen.map((c) => c[m] || 0)),
      hi: Math.max(...wochen.map((c) => c[m] || 0)),
    }]));
    out[`${mode}Wochen`] = wochen.length;
  }
  out.ziel = TARGET;
  out.ergebnis = DERIVED;
  out.cap = CAP;
  return out;
});
const W = volumen.dbWochen;
const db = Object.entries(volumen.db);
check(db.length === 14, `alle vierzehn Gruppen kommen vor (${db.length})`);
// Die Wochenzahl muss zur Körnung passen: Mit drei Sätzen je Auftritt ist die
// Satzzahl jeder Übung ein Vielfaches von drei, und Gruppen, deren Übungen alle
// Anteil 1,0 haben (Brust, Rücken, Oberschenkel, Waden), können ihr Ziel nur
// treffen, wenn Ziel·Wochen durch drei teilbar ist. Früher stand hier "gerade";
// das galt für eine andere Kombination aus Zielen und Anteilen.
const koernung = await page.evaluate(async () => {
  const { PLAN } = await import('./js/data.js');
  return [...new Set(PLAN.flatMap((w) => w.ex.map((x) => x.sets)))].sort();
});
console.log('     Satzzahlen im Plan:', koernung.join(', '));
check(koernung.length === 1 && koernung[0] === 3, 'jede Übung steht mit drei Sätzen da');
check((W * 3) % 3 === 0 && W % 3 === 0,
  `Wochenzahl passt zur Körnung – ${W} ist durch 3 teilbar`);
const sollU = (m) => Math.round(volumen.ziel[m] * 20);      // in Zwanzigsteln
console.log('     Ziel je Woche:', JSON.stringify(volumen.ziel));
check(db.every(([m]) => volumen.ziel[m] !== undefined), 'für jede Gruppe steht ein Ziel in den Daten');
check(Math.max(...db.map(([m]) => volumen.ziel[m])) <= volumen.cap,
  `keine Gruppe über der Obergrenze von ${volumen.cap}`);
// Gruppen ohne eigenes Ziel (der Nacken) fallen aus den übrigen Gleichungen –
// für sie gilt nur die Obergrenze, "exakt getroffen" wäre eine Behauptung.
const gesetzt = db.filter(([m]) => !volumen.ergebnis.includes(m));
const schief = gesetzt.filter(([m, v]) => v.summe !== sollU(m) * W);
console.log('     Schnitt je Woche:', JSON.stringify(Object.fromEntries(
  db.map(([m, v]) => [m, +(v.summe / 20 / W).toFixed(4)]))));
check(volumen.ergebnis.length > 0, `Gruppen ohne Ziel sind als solche ausgewiesen (${volumen.ergebnis.join(', ')})`);
check(schief.length === 0, `Schnitt exakt auf dem Ziel je gesetzter Gruppe${schief.length
  ? ' – daneben: ' + JSON.stringify(schief.map(([m, v]) => [m, v.summe / 20 / W])) : ''}`);
// Gemessen wird **im Verhältnis zum Ziel der Gruppe**, nicht in Sätzen: Ein
// Satz zu wenig ist bei den Waden (Ziel 6) ein Sechstel, bei der Brust (12) ein
// Zwölftel. Seit jede Übung mit drei Sätzen dasteht, sind größere Ausschläge
// unvermeidlich – eine Gruppe, deren Übungen alle voll auf sie gehen, kann in
// einer Woche nur Vielfache von drei bekommen.
const rel = (m, v) => Math.max(Math.abs(v.lo - sollU(m)), Math.abs(v.hi - sollU(m))) / sollU(m);
const schlimmste = Math.max(...db.filter(([m]) => !volumen.ergebnis.includes(m)).map(([m, v]) => rel(m, v)));
console.log('     größte Wochenabweichung:', `${(schlimmste * 100).toFixed(0)} %`,
  '·', db.filter(([m, v]) => rel(m, v) < 0.01).map(([m]) => m).join(', ') || '–', 'jede Woche exakt');
// Abgeleitete Gruppen (vordere Schulter, Nacken) sind ausgenommen: Sie haben
// kein Ziel, das die Verteilung optimieren könnte – ihr Wert fällt aus den
// übrigen Gleichungen und schwankt entsprechend mit.
const daneben = db.filter(([m, v]) => !volumen.ergebnis.includes(m) && rel(m, v) > 0.3);
check(daneben.length === 0, `keine Woche weiter als 30 % vom Ziel weg (schlimmste ${(schlimmste * 100).toFixed(0)} %)${
  daneben.length ? ' – ' + JSON.stringify(daneben.map(([m, v]) => [m, +(rel(m, v) * 100).toFixed(0)])) : ''}`);
// Die Bodyweight-Variante darf nach oben abweichen (enge Chin-ups treffen mehr),
// aber nicht nennenswert nach unten – sonst wäre der Modus schlicht weniger wert.
// Im Bodyweight-Modus darf es etwas weniger sein, aber nicht beliebig: Das
// Äquivalent des Seithebens sind Pike Push-ups, und die treffen die vordere
// Schulter statt der seitlichen. Aufgefangen wird das vom Band-Seitheben, das
// in beiden Varianten dasselbe ist – ganz ausgleichen kann es das nicht.
const bwLow = Object.entries(volumen.bw)
  .filter(([m]) => !volumen.ergebnis.includes(m))
  .filter(([m, v]) => v.lo < sollU(m) * 0.65);
check(bwLow.length === 0, `auch im Bodyweight-Modus keine Woche mehr als 35 % unter dem Ziel${bwLow.length
  ? ' – ' + JSON.stringify(bwLow.map(([m, v]) => [m, +(v.lo / sollU(m) * 100).toFixed(0)])) : ''}`);

const vielfalt = await page.evaluate(async () => {
  const { PLAN } = await import('./js/data.js');
  const key = (w) => w.ex.map((i) => i.id).sort().join('|');
  let hintereinander = 0;
  for (let i = 1; i < PLAN.length; i++) if (key(PLAN[i]) === key(PLAN[i - 1])) hintereinander++;
  return { uniq: new Set(PLAN.map(key)).size, n: PLAN.length, hintereinander };
});
// Seit die beiden Einheiten am kurzen Übergang auf je eine Körperhälfte
// festgelegt sind, sind nicht mehr alle 80 Zusammenstellungen verschieden –
// der Raum ist kleiner. Zwei gleiche direkt hintereinander wären trotzdem ein
// Fehler.
check(vielfalt.uniq >= vielfalt.n * 0.75,
  `Zusammenstellungen bleiben abwechslungsreich (${vielfalt.uniq} von ${vielfalt.n})`);
check(vielfalt.hintereinander === 0, 'keine zwei gleichen Einheiten hintereinander');

// --- Jede Übung braucht ein Muster, das es gibt -----------------------------
// Eine neue Übung ohne Bewegungsmuster fällt sonst erst auf, wenn sie im
// Training auftaucht – und dann steht dort ein leerer Kasten.
const muster = await page.evaluate(async () => {
  const { EXERCISES } = await import('./js/data.js');
  const { PATTERNS } = await import('./js/figure.js');
  const fehlt = [];
  EXERCISES.forEach((e) => {
    ['db', 'bw'].forEach((m) => { if (!PATTERNS[e[m].pattern]) fehlt.push(`${e.id}/${m}: ${e[m].pattern}`); });
  });
  return { fehlt, uebungen: EXERCISES.length, muster: Object.keys(PATTERNS).length };
});
console.log(`     ${muster.uebungen} Übungen, ${muster.muster} Muster`);
check(muster.fehlt.length === 0, `jede Variante hat ein Bewegungsmuster${
  muster.fehlt.length ? ' – fehlt: ' + muster.fehlt.join(', ') : ''}`);

// --- Erholung: 48 Stunden je Muskelgruppe ---------------------------------
// Vier Termine in sieben Tagen erzwingen einen Ein-Tages-Abstand. An dem darf
// keine Gruppe zweimal *direkt* drankommen (Anteil ab 0,5); Nebenanteile sind
// ausdrücklich erlaubt.
const erholung = await page.evaluate(async () => {
  const { PLAN, EXERCISES } = await import('./js/data.js');
  const byId = new Map(EXERCISES.map((e) => [e.id, e]));
  const tag = (iso) => new Date(iso + 'T00:00:00').getTime() / 86400000;
  const direkt = (w) => new Set(w.ex.flatMap((it) =>
    Object.entries(byId.get(it.id).db.shares).filter(([, v]) => v >= 0.5).map(([m]) => m)));
  const out = { eng: 0, verstoss: [] };
  for (let i = 0; i < PLAN.length - 1; i++) {
    if (tag(PLAN[i + 1].date) - tag(PLAN[i].date) >= 2) continue;
    out.eng++;
    const a = direkt(PLAN[i]);
    const beide = [...direkt(PLAN[i + 1])].filter((m) => a.has(m));
    if (beide.length) out.verstoss.push([PLAN[i].date, beide]);
  }
  return out;
});
console.log(`     kurze Übergänge: ${erholung.eng}`);
check(erholung.eng > 0, `Ein-Tages-Abstände kommen vor (${erholung.eng}) – sonst prüft das hier nichts`);
check(erholung.verstoss.length === 0, `keine Gruppe zweimal direkt in 48 Stunden${
  erholung.verstoss.length ? ' – ' + JSON.stringify(erholung.verstoss.slice(0, 3)) : ''}`);

// --- Frequenz: zweimal in der Woche gehört auf zwei Tage ------------------
// Zweimal pro Woche schlägt einmal bei gleicher Satzzahl. Ohne eigenes
// Kriterium landeten beide Auftritte gern am selben Tag – die Waden in acht
// von zwanzig Wochen, der Bauch in jeder einzelnen.
const frequenz = await page.evaluate(async () => {
  const { PLAN, EXERCISES, REST } = await import('./js/data.js');
  const byId = new Map(EXERCISES.map((e) => [e.id, e]));
  // Die beiden Beinbeuger-Hälften sind ein Muskel mit zwei Funktionen. Für die
  // Häufigkeit zählen sie deshalb zusammen: Die Kniebeugung hat ein Ziel von
  // drei Sätzen, und das ist bei festen Dreiersätzen genau ein Auftritt pro
  // Woche – zwei Tage kann sie gar nicht erreichen, ohne dass sich das Volumen
  // verdoppelt. Der Muskel selbst kommt über beide Hälften weiter zweimal dran.
  const eineGruppe = (m) => (m.startsWith('hamstrings') ? 'hamstrings' : m);
  const direkt = (id) => Object.entries(byId.get(id).db.shares)
    .filter(([, v]) => v >= REST.direct).map(([m]) => m);
  const schlecht = [];
  const tageJeGruppe = {};
  for (let wi = 0; wi * 4 < PLAN.length; wi++) {
    const tage = {}; const auftritte = {}; const muskeltage = {};
    PLAN.slice(wi * 4, wi * 4 + 4).forEach((w, j) => w.ex.forEach((it) => direkt(it.id).forEach((m) => {
      (tage[m] = tage[m] || new Set()).add(j);
      (muskeltage[eineGruppe(m)] = muskeltage[eineGruppe(m)] || new Set()).add(j);
      auftritte[m] = (auftritte[m] || 0) + 1;
    })));
    // Auf denselben Tag geprüft wird je Gruppe – zwei Auftritte derselben
    // Gruppe an einem Tag sind der Fehler, den das Kriterium verhindern soll.
    Object.keys(tage).forEach((m) => {
      if (auftritte[m] >= 2 && tage[m].size < 2) schlecht.push(`Woche ${wi + 1}: ${m}`);
    });
    // Gezählt wird je Muskel: Ob der Beinbeuger über die Knie- oder die
    // Hüftseite drankam, ist für die Erholung dasselbe Gewebe.
    Object.keys(muskeltage).forEach((m) => {
      tageJeGruppe[m] = (tageJeGruppe[m] || 0) + muskeltage[m].size;
    });
  }
  const wochen = PLAN.length / 4;
  return { schlecht, schnitt: Object.fromEntries(
    Object.entries(tageJeGruppe).map(([m, t]) => [m, +(t / wochen).toFixed(2)])) };
});
console.log('     Tage je Woche und Gruppe:', JSON.stringify(frequenz.schnitt));
check(frequenz.schlecht.length === 0, `zwei Auftritte nie am selben Tag${
  frequenz.schlecht.length ? ' – ' + frequenz.schlecht.slice(0, 4).join(', ') : ''}`);
// Knapp unter zwei ist erlaubt, weil es Wochen gibt, in denen eine Gruppe nur
// einen einzigen Auftritt hat – der kann nicht auf zwei Tage. Was zählt, ist
// die Prüfung darüber: Wo zwei Auftritte sind, liegen sie nie am selben Tag.
check(Math.min(...Object.values(frequenz.schnitt)) >= 1.9,
  `jede Gruppe kommt im Schnitt an mindestens zwei Tagen pro Woche dran (schwächste: ${
    Math.min(...Object.values(frequenz.schnitt))})`);

console.log(`\n${fails ? fails + ' FEHLER' : 'alle Prüfungen bestanden'}`);
console.log('ERRORS:', errs.length ? errs : 'none');
await browser.close();
