/*
 * „Wie ist der Satz gelaufen?" – und was die App daraus macht.
 *
 * Diese Frage stand schon einmal in der App und flog wieder raus (b9ae2b3).
 * Die Begründung von damals war richtig und gilt weiter: Sie *hielt den Ablauf
 * an* – der Sprung zur nächsten Übung wartete auf die Antwort. Nicht der Tipp
 * war das Problem, sondern das Warten.
 *
 * Geprüft wird deshalb zuerst das, was sie umgebracht hat: dass sie **nichts**
 * aufhält. Erst danach, dass sie überhaupt etwas nützt – nämlich einen
 * Steigerungsvorschlag, den es ohne sie nicht geben konnte, und eine
 * Volumenzahl, die nicht mehr für jeden Satz die kleinste denkbare ist.
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

const setze = (z) => page.evaluate((o) => {
  localStorage.removeItem('workout.rounds.v1');
  localStorage.setItem('workout.state.v1', JSON.stringify(o));
}, z);

await page.goto(URL, { waitUntil: 'networkidle' });
await setze({ greeted: true, name: 'T', level: 'geuebt', shift: 0,
  restSeconds: 0, useExerciseRest: false, log: {} });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(300);

// --- 1. Sie hält nichts auf --------------------------------------------
await page.locator('[data-act="start-session"]').first().click();
await page.waitForTimeout(300);
const name1 = await page.locator('.focus-name').textContent();
const saetze = await page.locator('.focus-set').count();
console.log(`     erste Übung: ${name1.trim()} mit ${saetze} Sätzen`);

check(await page.locator('.wie-row').count() === 0,
  'vor dem ersten Satz steht keine Frage da');

await page.locator('.focus-set').first().click();
await page.waitForTimeout(300);
check(await page.locator('.wie-row').count() === 1,
  'nach dem ersten Satz steht sie da – während der Pause, in der nichts zu tun ist');

// Der entscheidende Punkt: Ohne Antwort geht es ganz normal weiter.
for (let i = 1; i < saetze; i++) {
  await page.locator('.focus-set').nth(i).click();
  await page.waitForTimeout(200);
}
await page.waitForTimeout(400);
const name2 = await page.locator('.focus-name').textContent();
console.log(`     nach dem letzten Satz: ${name2.trim()}`);
check(name2.trim() !== name1.trim(),
  'ohne eine einzige Antwort springt die App zur nächsten Übung – sie wartet nicht');

const ohneAntwort = await page.evaluate(async () => {
  const s = (await import('./js/store.js')).getState();
  const erste = Object.values(s.log)[0];
  return Object.values(erste.db)[0].filter((x) => x.done).length;
});
check(ohneAntwort === saetze, `alle ${saetze} Sätze sind trotzdem protokolliert`);

// --- 2. Antworten wird gespeichert -------------------------------------
await page.locator('.focus-set').first().click();
await page.waitForTimeout(300);
const knoepfe = await page.locator('.wie-btn').allTextContents();
console.log('     angeboten:', knoepfe.map((s) => s.trim()).join(' | '));
check(knoepfe.length === 3, 'drei Knöpfe, kein Zahlenfeld – keine Tastatur im Training');
check(knoepfe.some((t) => /^\d+\+$/.test(t.trim())),
  'einer davon ist „oben raus", mit der echten Obergrenze des Bereichs');

await page.locator('.wie-btn').last().click();
await page.waitForTimeout(300);
// Die Übungs-ID aus der Oberfläche holen statt sie zu raten: Beide Übungen
// liegen in *derselben* Einheit – das Protokoll ist nach Workout-Nummer
// abgelegt, nicht nach Übung.
const exId = await page.locator('.focus-set').first().getAttribute('data-ex');
const gespeichert = await page.evaluate(async (id) => {
  const s = (await import('./js/store.js')).getState();
  return Object.values(s.log)[0].db[id][0].wie;
}, exId);
check(gespeichert === 'oben', `die Antwort steht am Satz (${gespeichert})`);
check(await page.locator('.wie-row').count() === 0,
  'und die Frage ist weg – sie wird nicht zweimal gestellt');

// --- 3. Daraus wird ein Vorschlag --------------------------------------
// Gesetzt statt durchgeklickt: Wie viele Sätze eine Übung hat, hängt am Plan,
// und mit zwei Sätzen wäre sie nach der zweiten Antwort schon fertig und
// weggesprungen. Geprüft wird die Regel, nicht der Weg dorthin.
//
// Geschrieben wird auf die Übung, die die Fokus-Ansicht **gerade zeigt**, und
// nicht auf eine vorher ausgerechnete: Die Reihenfolge innerhalb einer Einheit
// richtet sich nach Gerät und Gewicht und verschiebt sich mit dem Protokoll.
// Ein vorab bestimmter Übungsschlüssel zeigte deshalb ins Leere – der Test
// setzte brav zwei Sätze, nur eben an einer Übung, die niemand ansah.
const lade = async (wie) => {
  await setze({ greeted: true, name: 'T', level: 'geuebt', shift: 0,
    restSeconds: 0, useExerciseRest: false, session: { n: 1 }, log: {} });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  const weiter = page.locator('[data-act="start-session"]');
  if (await weiter.count()) { await weiter.first().click(); await page.waitForTimeout(400); }

  // Zur ersten Übung mit Gewichtsfeld: Bei Klimmzügen und Liegestützen gibt es
  // nichts zu erhöhen, dort schlägt die App zu Recht nichts vor.
  const felder = await page.locator('[data-act="focus-goto"]').count();
  for (let k = 0; k < felder; k++) {
    await page.locator(`[data-act="focus-goto"][data-i="${k}"]`).click();
    await page.waitForTimeout(200);
    if (await page.locator('.kg-val').count()) break;
  }
  const id = await page.locator('.focus-set').first().getAttribute('data-ex');
  const anzahl = await page.locator('.focus-set').count();
  await page.evaluate(async ([exId, sets, antworten]) => {
    const store = await import('./js/store.js');
    antworten.forEach((w, i) => store.updateSet(1, 'db', exId, sets, i,
      { w: '20', done: true, ...(w ? { wie: w } : {}) }));
  }, [id, anzahl, wie]);
  // Neu zeichnen über die Fortschrittsleiste – updateSet() meldet zwar, löst
  // aber von sich aus kein Rendern aus.
  await page.locator('.prog-ex.cur').click();
  await page.waitForTimeout(350);
  return {
    name: (await page.locator('.focus-name').textContent()).trim(),
    text: (await page.locator('.kg-next').allTextContents()).join(' ').replace(/\s+/g, ' '),
    kg: await page.locator('.kg-val').first().inputValue().catch(() => null),
  };
};

const einmal = await lade(['oben']);
console.log(`     ${einmal.name}, nach einem „oben": ${einmal.text.trim() || '(kein Vorschlag)'}`);
check(!/oben raus/.test(einmal.text),
  'eine einzelne Antwort schlägt noch nichts vor – das wäre ein Zufall, keine Aussage');

const gemischt = await lade(['oben', 'drin']);
console.log(`     nach „oben" + „drin": ${gemischt.text.trim() || '(kein Vorschlag)'}`);
check(!/oben raus/.test(gemischt.text),
  'und ein Satz, der nur im Bereich lag, reicht auch nicht');

const zwei = await lade(['oben', 'oben']);
console.log(`     nach zwei „oben": ${zwei.text.trim() || '(kein Vorschlag)'}`);
check(/oben raus/.test(zwei.text) && /kg\?/.test(zwei.text),
  'erst wenn alle beantworteten Sätze oben lagen, steht der Vorschlag da');

// Es bleibt ein Vorschlag: Das eingetragene Gewicht ändert sich nicht von selbst.
const vorgeschlagen = (zwei.text.match(/([\d,]+) kg\?/) || [])[1];
console.log(`     eingetragen ${zwei.kg} kg, vorgeschlagen ${vorgeschlagen} kg`);
check(vorgeschlagen && zwei.kg !== vorgeschlagen,
  'das Gewicht steht unverändert – die App schlägt vor, sie entscheidet nicht');

// --- 4. Und das Volumen zählt „oben" als oben --------------------------
const volumen = await page.evaluate(async (id) => {
  const { sammleStats } = await import('./js/plan.js');
  const { repsBereich } = await import('./js/uebung.js');
  const store = await import('./js/store.js');
  const jetzt = sammleStats().volume;
  // Dieselbe Rechnung ohne die Antworten: jeden „oben"-Satz zurückstellen.
  Object.values(store.getState().log)[0].db[id].forEach((x) => { delete x.wie; });
  return { mit: jetzt, ohne: sammleStats().volume, bereich: repsBereich('8–12') };
}, await page.locator('.focus-set').first().getAttribute('data-ex'));
console.log(`     Volumen mit Antworten ${Math.round(volumen.mit)} kg, `
  + `ohne ${Math.round(volumen.ohne)} kg`);
check(volumen.mit > volumen.ohne,
  'ein Satz „oben raus" zählt mehr als derselbe Satz ohne Antwort');
check(volumen.bereich.lo === 8 && volumen.bereich.hi === 12,
  `repsBereich liest beide Grenzen (${JSON.stringify(volumen.bereich)})`);

check(errs.length === 0, `keine Fehler${errs.length ? ': ' + errs.slice(0, 2).join(' | ') : ''}`);
console.log(`\n${fails ? fails + ' FEHLER' : 'alle Prüfungen bestanden'}`);
await browser.close();
