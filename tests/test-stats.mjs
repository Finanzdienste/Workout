import { chromium } from 'playwright';
import { URL, SHOT } from './umgebung.mjs';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 414, height: 896 } });
const errs = [];
page.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()); });
let fails = 0;
const check = (c, m) => { console.log(`${c ? 'OK  ' : 'FAIL'} ${m}`); if (!c) { fails++; process.exitCode = 1; } };

await page.goto(URL, { waitUntil: 'networkidle' });
await page.evaluate(() => { localStorage.clear(); localStorage.setItem('workout.state.v1', '{"greeted":true}'); });

// Drei Einheiten mit steigenden Gewichten erfinden. Welche Übung dafür taugt,
// entscheidet der Plan: sie muss in allen drei Einheiten vorkommen, sonst zeigt
// die Statistik weniger Punkte als hier eingetragen werden. Welche drei
// Einheiten das sind, steht nicht fest – seit der 48-Stunden-Regel wechseln
// sich zwei Körperhälften ab, eine Übung kommt also frühestens jede zweite
// Einheit wieder vor.
const probe = await page.evaluate(async () => {
  const { EXERCISES, PLAN } = await import('./js/data.js');
  const { MUSCLE_LABEL } = await import('./js/body.js');
  const wo = new Map();
  PLAN.forEach((w) => w.ex.forEach((it) => {
    if (!wo.has(it.id)) wo.set(it.id, []);
    wo.get(it.id).push(w.n);
  }));
  // Von den Übungen mit mindestens drei Terminen die mit den meisten
  // Muskelgruppen – sonst prüft der Verlauf je Gruppe nur eine Karte.
  const ex = [...wo.keys()].filter((id) => wo.get(id).length >= 3)
    .map((id) => EXERCISES.find((e) => e.id === id))
    .sort((a, b) => b.db.muscles.length - a.db.muscles.length)[0];
  return {
    id: ex.id, name: ex.db.name, wo: wo.get(ex.id).slice(0, 3),
    muscles: ex.db.muscles.map((m) => MUSCLE_LABEL[m] || m),
  };
});
console.log('     Probe-Übung:', probe.name, `(Einheiten ${probe.wo.join(', ')})`, '→', probe.muscles.join(', '));
await page.evaluate(({ id, wo }) => {
  const s = { mode: 'db', keepModePerWorkout: true, autoShift: false, shift: 0,
              useExerciseRest: false, restSeconds: 0, sound: false, rest: null,
              weights: {}, session: null, log: {} };
  const kg = ['20', '22,5', '25'];
  wo.forEach((n, i) => {
    s.log[n] = { db: {}, bw: {}, mode: 'db', startedOn: `2026-08-${20 + i}` };
    s.log[n].db[id] = [0, 1, 2].map(() => ({ w: kg[i], r: '', done: true }));
  });
  localStorage.setItem('workout.state.v1', JSON.stringify(s));
}, probe);
await page.reload({ waitUntil: 'networkidle' });
await page.locator('.tab[data-tab="stats"]').click();
await page.waitForTimeout(300);

const panels = await page.locator('#sparkEx .spark').count();
check(panels >= 1, `Verlaufskarte je Übung (${panels})`);
check((await page.locator('#sparkEx .spark-name').first().textContent()) === probe.name, 'richtige Übung benannt');
check((await page.locator('#sparkEx .spark-val').first().textContent()).includes('25'), 'Endwert 25 kg beschriftet');
console.log('     Fußzeile:', await page.locator('#sparkEx .spark-foot').first().textContent());
check((await page.locator('#sparkEx .spark-foot').first().textContent()).includes('20 → 25'), 'Verlauf 20 → 25 ausgewiesen');

const mus = await page.locator('#sparkMus .spark').count();
const musNames = await page.locator('#sparkMus .spark-name').allTextContents();
console.log('     Muskelgruppen:', musNames.join(', '));
check(mus === probe.muscles.length, `je Muskelgruppe der Probe-Übung eine Karte (${mus})`);
const erwartet = probe.muscles;
check(erwartet.every((m) => musNames.includes(m)), `alle Gruppen der Probe-Übung dabei (${erwartet.join(', ')})`);

// Eine Serie -> keine Legende (Titel trägt die Identität)
check(await page.locator('.spark legend, .spark .legend').count() === 0, 'keine Legende bei einer Serie');
// Nur der Endwert ist beschriftet, keine Zahl an jedem Punkt
check(await page.locator('#sparkEx .spark').first().locator('text').count() === 0, 'keine Zahl an jedem Punkt');
// Volle Reihe für Screenreader
const aria = await page.locator('#sparkEx .spark-svg').first().getAttribute('aria-label');
console.log('     aria:', aria);
check(aria.includes('20') && aria.includes('25'), 'vollständige Reihe im aria-label');

// Linie, Fläche, Endpunkt vorhanden
check(await page.locator('#sparkEx .spark-line').first().count() === 1, 'Linie gezeichnet');
const areaOp = await page.locator('#sparkEx .spark-area').first().evaluate((e) => getComputedStyle(e).opacity);
check(Math.abs(Number(areaOp) - 0.1) < 0.02, `Fläche als 10-%-Hauch (${areaOp})`);
const ring = await page.locator('#sparkEx .spark-dot').first().evaluate((e) => getComputedStyle(e).strokeWidth);
check(ring === '2px', `Endpunkt mit 2-px-Ring (${ring})`);

// Ziehen zeigt den Wert des Tages. Erst in den sichtbaren Bereich holen –
// seit das Wochenvolumen darüber steht, liegt die Karte sonst unterhalb des
// Bildschirms, und der Mauszeiger landet ins Leere.
await page.locator('#sparkEx .spark-svg').first().scrollIntoViewIfNeeded();
await page.waitForTimeout(150);
const box = await page.locator('#sparkEx .spark-svg').first().boundingBox();
await page.mouse.move(box.x + 4, box.y + box.height / 2);
await page.waitForTimeout(120);
const early = await page.locator('#sparkEx .spark-val').first().textContent();
check(early.includes('20'), `Ziehen zeigt den frühen Wert (${early})`);

await page.screenshot({ path: `${SHOT}/95-stats.png`, fullPage: true });
const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
check(overflow === 0, `kein horizontaler Überlauf (${overflow}px)`);

console.log(`\n${fails ? fails + ' FEHLER' : 'alle Prüfungen bestanden'}`);
console.log('ERRORS:', errs.length ? errs : 'none');
await browser.close();
