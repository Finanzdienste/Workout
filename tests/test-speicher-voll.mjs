/*
 * Wenn der Speicher voll ist, muss die App das Richtige sagen.
 *
 * `storageOk` wird bei zwei ganz verschiedenen Lagen false, und lange stand für
 * beide derselbe Satz da:
 *
 *   gesperrt   Privates Fenster oder eingebettete Ansicht. Es war nie etwas da,
 *              es geht nichts verloren, und der Ausweg ist, die Seite normal im
 *              Browser zu öffnen.
 *
 *   voll       Es ging bisher und geht jetzt nicht mehr. Ein halbes Jahr
 *              Training liegt gespeichert, der heutige Satz kommt nicht mehr
 *              dazu – und „öffne die Seite direkt im Browser" hilft daran
 *              nichts. Genau in der Lage, in der etwas auf dem Spiel steht, gab
 *              die App also den falschen Rat.
 *
 * Der Speicher wird hier wirklich vollgeschrieben, nicht simuliert: Nur so
 * durchläuft der Code denselben Weg wie auf einem Handy, dessen Browser dicht
 * ist – bis hin zu der Frage, ob die Warnung überhaupt rechtzeitig erscheint.
 * Der Schreibvorgang läuft nämlich 120 ms *nach* dem Rendern.
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
await page.evaluate(() => localStorage.setItem('workout.state.v1', JSON.stringify({
  greeted: true, name: 'Tobi', restSeconds: 0, useExerciseRest: false, log: {},
})));
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(300);

// --- Normalzustand: keine Warnung --------------------------------------
check(await page.locator('.notice.warn').count() === 0,
  'solange gespeichert werden kann, steht keine Warnung da');

// --- Den Speicher wirklich vollschreiben -------------------------------
// In drei Stufen, immer feiner: 64 KB, 1 KB, 32 Byte. Die letzte Stufe ist die
// entscheidende, und sie ist der Grund, warum der erste Anlauf dieses Tests
// nichts fand. Ein gespeicherter Stand **ersetzt** seinen alten Eintrag – er
// muss also nicht ganz hineinpassen, sondern nur sein *Zuwachs*. Bleiben 64 KB
// oder auch nur ein Kilobyte frei, gehen noch Hunderte abgehakter Sätze durch.
// Erst wenn weniger als ein paar Dutzend Byte übrig sind, scheitert der nächste
// Schreibvorgang – und genau das ist die Lage auf einem vollen Handy.
const gefuellt = await page.evaluate(() => {
  const fuellen = (groesse, praefix, max) => {
    const block = 'x'.repeat(groesse);
    let n = 0;
    try {
      for (; n < max; n++) localStorage.setItem(`${praefix}${n}`, block);
    } catch { /* voll – genau das war der Zweck */ }
    return n;
  };
  const grob = fuellen(64 * 1024, 'ballast.grob.', 500);
  const mittel = fuellen(1024, 'ballast.mittel.', 200);
  const fein = fuellen(32, 'ballast.fein.', 2000);
  return { grob, mittel, fein };
});
console.log(`     ${gefuellt.grob} × 64 KB + ${gefuellt.mittel} × 1 KB + `
  + `${gefuellt.fein} × 32 B – der Speicher ist bis auf Rundungsreste dicht`);
check(gefuellt.grob > 0, 'der Speicher liess sich wirklich fuellen');

// --- Einen Satz abhaken: der geht jetzt verloren ------------------------
await page.locator('[data-act="start-session"]').first().click();
await page.waitForTimeout(300);
await page.locator('.focus-set').first().click();
// 120 ms Aussetzer von persist() plus die Zeit fürs Neuzeichnen.
await page.waitForTimeout(700);

const lage = await page.evaluate(async () => {
  const s = await import('./js/store.js');
  return { kann: s.canPersist(), grund: s.speicherGrund() };
});
console.log(`     store meldet: canPersist=${lage.kann}, Grund=${lage.grund}`);
check(lage.kann === false && lage.grund === 'voll',
  `der Store erkennt die Lage als „voll" (${lage.grund})`);

const warnung = (await page.locator('.notice.warn').allTextContents()).join(' ').replace(/\s+/g, ' ');
console.log('     Warnung:', warnung.slice(0, 90) || '(keine)');
check(/Speicher .*voll|voll/i.test(warnung),
  'die App sagt, dass der Speicher voll ist');
check(!/privaten Modus/.test(warnung),
  'und rät nicht mehr, die Seite „direkt im Browser" zu öffnen – das hilft hier nichts');
check(/nicht.*gespeichert|nicht\b/i.test(warnung),
  'sie sagt außerdem, dass der Eintrag gerade nicht ankommt');

// Und sie erscheint **sofort**, nicht erst beim nächsten Tipp: Der
// Schreibvorgang läuft nach dem Rendern, ohne Rückmeldung stünde sie einen
// verlorenen Satz zu spät da.
check(await page.locator('.notice.warn').count() > 0,
  'sie steht schon nach dem ersten verlorenen Satz da, nicht erst nach dem zweiten');

// Der Sicherungsknopf gehört dazu – er ist das Einzige, was hier noch hilft.
check(await page.locator('.notice.warn [data-act="backup-now"]').count() > 0,
  'mit dem Sicherungsknopf direkt daneben');

// --- Aufgeräumt ist die Warnung wieder weg -----------------------------
await page.evaluate(() => {
  Object.keys(localStorage).filter((k) => k.startsWith('ballast.'))
    .forEach((k) => localStorage.removeItem(k));
});
await page.locator('.focus-set').nth(1).click();
await page.waitForTimeout(700);
check(await page.locator('.notice.warn').count() === 0,
  'nach dem Aufräumen ist sie wieder weg – sie klebt nicht');

check(errs.length === 0, `keine Fehler${errs.length ? ': ' + errs.slice(0, 2).join(' | ') : ''}`);
console.log(`\n${fails ? fails + ' FEHLER' : 'alle Prüfungen bestanden'}`);
await browser.close();
