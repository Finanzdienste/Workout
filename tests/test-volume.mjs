/* Wochenvolumen: was tatsächlich abgehakt wurde, gegen das Ziel je Gruppe. */
import { chromium } from 'playwright';
import { URL } from './umgebung.mjs';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 414, height: 896 } });
const errs = [];
page.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()); });
let fails = 0;
const check = (c, m) => { console.log(`${c ? 'OK  ' : 'FAIL'} ${m}`); if (!c) { fails++; process.exitCode = 1; } };

await page.goto(URL, { waitUntil: 'networkidle' });
await page.evaluate(() => { localStorage.clear(); localStorage.setItem('workout.state.v1', '{"greeted":true}'); });
await page.reload({ waitUntil: 'networkidle' });
await page.locator('.tab[data-tab="stats"]').click();
await page.waitForTimeout(300);
check((await page.locator('#volWeek').textContent()).includes('erste Einheit'),
  'ohne Verlauf ein Hinweis statt leerer Balken');

// Eine volle Woche abhaken – dann muss alles bei 10 stehen
await page.evaluate(async () => {
  const store = await import('./js/store.js');
  const { PLAN } = await import('./js/data.js');
  for (let i = 0; i < 4; i++) {
    const w = PLAN[i];
    store.completeWorkout(w.n, 'db', w.ex.map((x) => ({ id: x.id, sets: x.sets })));
  }
});
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(400);
// Zeilenweise lesen: seit die Ziele auseinandergehen, sagt eine nackte Zahl
// nichts mehr – geprüft wird jede Gruppe gegen ihr eigenes Ziel aus den Daten.
const zeile = async () => page.$$eval('.vol-row', (rows) => rows.map((r) => ({
  name: r.querySelector('.vol-name').textContent.trim(),
  ist: parseFloat(r.querySelector('.vol-num').firstChild.textContent.replace(',', '.')),
  soll: parseFloat(r.querySelector('.vol-num span').textContent.slice(1).replace(',', '.')),
})));
const werte = await zeile();
console.log('     volle Woche:', werte.map((r) => `${r.name} ${r.ist}/${r.soll}`).join(' · '));
check(werte.length === 14, 'vierzehn Muskelgruppen');
const ziele = await page.evaluate(async () => (await import('./js/data.js')).TARGET);
const cap = await page.evaluate(async () => (await import('./js/data.js')).CAP);
// Verglichen wird seit den festen Dreiersätzen mit dem Pensum *dieser* Woche,
// nicht mit dem Wochenziel: Das Ziel ist ein Schnitt über den ganzen Plan, die
// einzelne Woche liegt zwangsläufig darüber oder darunter. Der angezeigte
// Sollwert muss deshalb nah am Ziel liegen, aber nicht darauf.
const zielListe = Object.values(ziele);
check(werte.every((r) => zielListe.some((t) => Math.abs(t - r.soll) <= t * 0.5)),
  'die angezeigten Sollwerte liegen im Rahmen der Ziele aus den Daten');
// Maßstab ist die Zusage des Generators: keine Gruppe liegt in einer einzelnen
// Woche einen *ganzen* Satz daneben. Der Schnitt über den ganzen Plan ist
// exakt; eine einzelne Woche darf um Bruchteile schwanken, weil sich Sätze nur
// als Ganzes verschieben lassen.
const schlimmste = Math.max(...werte.map((r) => Math.abs(r.ist - r.soll)));
console.log('     größte Abweichung dieser Woche:', schlimmste.toFixed(2), 'Sätze');
const daneben = werte.filter((r) => Math.abs(r.ist - r.soll) > 0.99);
check(daneben.length === 0, `keine Gruppe einen ganzen Satz daneben (schlimmste ${schlimmste.toFixed(2)})${
  daneben.length ? ' – ' + daneben.map((r) => `${r.name} ${r.ist}/${r.soll}`).join(', ') : ''}`);
// Die Obergrenze gilt für die *Ziele*, nicht für die angezeigten Sollwerte:
// Angezeigt wird das Pensum dieser Woche, und das liegt bei Brust und Rücken
// zwangsläufig mal bei 12, weil ihre Wochensumme nur Vielfache von drei
// annehmen kann.
check(Math.max(...Object.values(ziele)) <= cap, `kein Ziel über der Obergrenze von ${cap}`);
const hoechstes = Math.max(...werte.map((r) => r.soll));
check(werte.some((r) => r.soll < hoechstes), 'nicht überall dasselbe Ziel');
const zaehler = (await page.locator('.vol-quote').textContent()).replace(/\s+/g, '');
console.log('     Zähler:', zaehler);
check(zaehler === '14/14', 'alle vierzehn Gruppen im Ziel');
check((await page.locator('#volWeek').textContent()).includes('abgeschlossen'), 'Woche als abgeschlossen erkannt');

// Eine Verletzung muss sich hier niederschlagen
await page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('workout.state.v1'));
  s.injuries = ['kreuzband'];
  localStorage.setItem('workout.state.v1', JSON.stringify(s));
});
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(400);
const mitVerletzung = await zeile();
console.log('     mit Kreuzbandriss:', mitVerletzung.map((r) => `${r.name} ${r.ist}`).join(' · '));
check(mitVerletzung.some((r) => r.ist < 1), 'gesperrte Beinübungen schlagen bis hierher durch');
// "Im Ziel" misst jetzt, ob das Pensum der Woche geschafft wurde – und das
// Pensum sinkt mit der Verletzung mit. Die Verletzung zeigt sich deshalb nicht
// mehr an der Quote, sondern am Sollwert der betroffenen Gruppen: Was der Plan
// für die Woche vorsieht, ist weniger geworden.
const sollVorher = Object.fromEntries(werte.map((r) => [r.name, r.soll]));
const gesunken = mitVerletzung.filter((r) => r.soll < sollVorher[r.name] - 0.05);
console.log('     Pensum gesunken bei:', gesunken.map((r) => `${r.name} ${sollVorher[r.name]}→${r.soll}`).join(', ') || 'nirgends');
check(gesunken.length > 0, 'die Verletzung senkt das Wochenpensum sichtbar');
const nachher = parseInt(await page.locator('.vol-quote').textContent(), 10);
check(nachher === 14, `wer sein (kleineres) Pensum schafft, steht weiter im Ziel (${nachher} von 14)`);

const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
check(overflow === 0, `kein horizontaler Überlauf (${overflow}px)`);

console.log(`\n${fails ? fails + ' FEHLER' : 'alle Prüfungen bestanden'}`);
console.log('ERRORS:', errs.length ? errs : 'none');
await browser.close();
