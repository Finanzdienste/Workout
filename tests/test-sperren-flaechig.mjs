/*
 * Eine angehakte Beschwerde hält – in jedem Modus, jedem Plan, bei jeder Wahl.
 *
 * Die Durchsicht der App fand vier Wege, auf denen eine gesperrte Übung doch
 * im Plan landete oder eine Übung doppelt dastand, und alle vier waren an
 * Einzelfällen nicht zu sehen:
 *
 *   eigene Wahl             Crunches gewählt, Bauchmuskelzerrung angehakt –
 *                           die Crunches blieben (20 solcher Paare)
 *   Bodyweight-Fassung      Handgelenk: getauscht auf „Floor Press", die ohne
 *                           Hanteln ein Liegestütz ist
 *   Hanteln in der Hand     Handgelenkbruch ließ Kreuzheben mit Langhantel stehen
 *   Tausch auf Vorhandenes  zweimal Floor Press in einer Einheit
 *
 * Deshalb hier kein Beispiel, sondern die ganze Fläche: jede Beschwerde, beide
 * Modi, alle vier Pläne, drei Stände eigener Wahl, jede offene Einheit.
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

let geprueft = 0;
for (const fokus of ['standard', 'bbp', 'cut', 'oberkoerper']) {
  // Über den Speicher der App: Beim Neuladen schreibt sie ihren Stand zurück
  // und überschriebe ein direkt gesetztes `focus` – dann prüfte die Schleife
  // viermal denselben Plan, ohne es zu merken.
  await page.evaluate(async (f) => {
    const s = await import('./js/store.js');
    s.setSetting('greeted', true);
    s.setSetting('level', 'geuebt');
    s.setSetting('focus', f);
    s.flush();
  }, fokus);
  await page.reload({ waitUntil: 'networkidle' });
  const geladen = await page.evaluate(async (f) => {
    const d = await import('./js/data.js');
    return d.FOCUS === d.PLANS[f];
  }, fokus);
  check(geladen, `${fokus}: der Plan dieses Fokus ist geladen`);
  const r = await page.evaluate(async () => {
    const store = await import('./js/store.js');
    const { PLAN, EXERCISES } = await import('./js/data.js');
    const { exOf } = await import('./js/plan.js');
    const { INJURIES, gesperrt } = await import('./js/injuries.js');

    // Drei Stände eigener Wahl: keine, überall die leichtere und überall die
    // schwerere Ausführung (mehr steht seit v206 nicht zur Wahl). Mehr
    // Kombinationen ändern an der Frage nichts: Entweder die Wahl kennt die
    // Sperren, oder sie kennt sie nicht.
    const wahl = (welche) => {
      const w = {};
      EXERCISES.forEach((e) => {
        if (e.anfaenger) w[e.id] = welche === 'leicht' ? e.anfaenger : e.id;
      });
      return w;
    };
    const verstoesse = [];
    const doppelt = [];
    let n = 0;
    for (const f of [{}, wahl('leicht'), wahl('schwer')]) {
      store.setSetting('fassung', f);
      for (const inj of INJURIES) {
        store.setSetting('injuries', [inj.id]);
        for (const m of ['db', 'bw']) {
          const tabu = gesperrt([inj.id], m);
          PLAN.forEach((w) => {
            const ids = exOf(w, m).map((x) => x.id);
            n++;
            ids.filter((id) => tabu.has(id)).forEach((id) => {
              if (verstoesse.length < 8) verstoesse.push(`${inj.id}/${m}/W${w.n}: ${id}`);
            });
            if (new Set(ids).size !== ids.length && doppelt.length < 8) {
              doppelt.push(`${inj.id}/${m}/W${w.n}: ${ids.join(',')}`);
            }
          });
        }
      }
    }
    return { verstoesse, doppelt, n };
  });
  geprueft += r.n;
  check(r.verstoesse.length === 0,
    `${fokus}: keine gesperrte Übung im Plan${r.verstoesse.length ? ' – ' + r.verstoesse.join(' | ') : ''}`);
  check(r.doppelt.length === 0,
    `${fokus}: keine Übung doppelt in einer Einheit${r.doppelt.length ? ' – ' + r.doppelt.join(' | ') : ''}`);
}
console.log(`     geprüft: ${geprueft} Einheiten (4 Pläne × Beschwerden × 2 Modi × 3 Wahlstände)`);

// Die Notiz an der Einheit sagt, was im Modus wegfällt.
const notiz = await page.evaluate(async () => {
  localStorage.clear();
  const store = await import('./js/store.js');
  const { PLAN } = await import('./js/data.js');
  const { injuryNotes } = await import('./js/plan.js');
  store.setSetting('injuries', ['handgelenk-reizung']);
  const w = PLAN.find((x) => x.ex.some((e) => e.id === 'floor-press'));
  const n = injuryNotes(w.n, 'bw');
  return n.dropped.map((d) => d.id).concat(n.swapped.map((x) => x.from + '>' + x.to));
});
check(notiz.includes('floor-press'),
  `im Bodyweight-Modus nennt die Notiz, dass die Floor Press wegfällt (${notiz.join(', ')})`);

check(errs.length === 0, `keine Fehler${errs.length ? ': ' + errs.slice(0, 2).join(' | ') : ''}`);
await browser.close();
console.log(`\n${fails ? fails + ' FEHLER' : 'alle Prüfungen bestanden'}`);
