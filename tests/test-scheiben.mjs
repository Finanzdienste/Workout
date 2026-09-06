/*
 * Der eigene Scheibensatz: was sich damit einstellen lässt – und was nicht.
 *
 * Der Anlass war ein Vorschlag der App: „Kurzhanteln auf 6 kg je Hand." Mit
 * einer 1,5-kg-Stange und Scheiben zu 1,25 kommt man auf 4 kg oder auf 6,5 –
 * auf 6 nicht. Eine Zahl, die sich nicht einstellen lässt, ist keine Ansage,
 * sondern eine Hausaufgabe.
 *
 * Geprüft wird hier die Rechnung dahinter, und zwar in beide Richtungen: dass
 * mit eingetragenem Eisen nur noch Erreichbares herauskommt, und dass ohne
 * eingetragenes Eisen alles bleibt, wie es war. Der zweite Teil ist der
 * wichtigere – wer nichts einträgt, darf nicht plötzlich andere Gewichte
 * bekommen, weil sich die App einen Scheibensatz ausgedacht hat.
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

// Der Satz aus dem Anlassfall: kleine Kurzhantelstangen, nur zwei Größen.
const SATZ = {
  kh: { stange: 1.5, scheiben: [[1.25, 8], [2.5, 4]] },
  lh: { stange: 10, scheiben: [[1.25, 4], [2.5, 4], [5, 4], [10, 2]] },
};

// --- 1. Aufzählen -----------------------------------------------------
const zahlen = await page.evaluate(async (satz) => {
  const s = await import('./js/scheiben.js');
  return {
    kh2: s.erreichbar('dumbbells', satz),
    kh1: s.erreichbar('goblet', satz),
    lh: s.erreichbar('barbell', satz),
    ruck: s.erreichbar('backpack', satz),
    leer: s.erreichbar('dumbbells', s.leererSatz()),
  };
}, SATZ);
console.log('     beide Kurzhanteln:', JSON.stringify(zahlen.kh2));
console.log('     eine Kurzhantel:  ', JSON.stringify(zahlen.kh1));

// Beide Hanteln: vier Scheiben je Stufe. Von 8× 1,25 reichen also zwei Stufen
// (je +2,5 kg), von 4× 2,5 eine (+5 kg).
check(JSON.stringify(zahlen.kh2) === JSON.stringify([1.5, 4, 6.5, 9, 11.5]),
  'beide Kurzhanteln: 1,5 / 4 / 6,5 / 9 / 11,5 kg je Hand');
check(!zahlen.kh2.includes(6),
  'und 6 kg je Hand ist genau nicht dabei – der Fall, um den es ging');

// Eine einzelne Hantel darf denselben Vorrat doppelt so tief ausnutzen:
// zwei Scheiben je Stufe statt vier.
check(zahlen.kh1.length > zahlen.kh2.length,
  `eine Kurzhantel kommt weiter als zwei (${zahlen.kh1.length} statt ${zahlen.kh2.length} Werte)`);
check(zahlen.kh1.includes(6.5) && zahlen.kh1.includes(11.5),
  'sie erreicht auch die schwereren Stufen');

check(zahlen.lh[0] === 10, `die Langhantel beginnt bei der leeren Stange (${zahlen.lh[0]})`);
check(zahlen.lh.includes(60), 'und kommt mit allem drauf auf 60 kg');
check(zahlen.ruck === null,
  'der Rucksack wird nicht gerastet – da passt auch eine Wasserflasche rein');
check(zahlen.leer === null,
  'und ohne Eintrag gibt es kein Raster, sondern ein ehrliches "weiß ich nicht"');

// --- 2. Einrasten -----------------------------------------------------
const gerastet = await page.evaluate(async (satz) => {
  const s = await import('./js/scheiben.js');
  return {
    sechs: s.raste(6, 'dumbbells', satz),
    weitUnten: s.raste(0.5, 'dumbbells', satz),
    weitOben: s.raste(99, 'dumbbells', satz),
    // Genau in der Mitte zwischen 4 und 6,5 liegt 5,25.
    mitte: s.raste(5.25, 'dumbbells', satz),
    ohne: s.raste(6, 'dumbbells', s.leererSatz()),
  };
}, SATZ);
check(gerastet.sechs === 6.5, `6 kg rasten auf 6,5 ein (${gerastet.sechs})`);
check(gerastet.weitUnten === 1.5, 'unterhalb der leeren Stange geht nichts');
check(gerastet.weitOben === 11.5, 'und oberhalb des Vorrats auch nicht');
check(gerastet.mitte === 4,
  `bei gleichem Abstand nach unten (${gerastet.mitte}) – lieber ein bisschen zu leicht`);
check(gerastet.ohne === null, 'ohne Eintrag rastet nichts ein');

// --- 3. Der Schritt auf dem Raster ------------------------------------
// Das ist der Punkt, an dem sich die Knöpfe ändern: Wer 2 kg mehr will, aber
// nur in 2,5er-Stufen kann, bekommt 2,5 – nicht 2, und auch nicht 0,25.
const schritte = await page.evaluate(async (satz) => {
  const s = await import('./js/scheiben.js');
  return {
    hoch: s.nachbar(4, 1, 'dumbbells', satz, 2),
    runter: s.nachbar(6.5, -1, 'dumbbells', satz, 2),
    obenAm: s.nachbar(11.5, 1, 'dumbbells', satz, 2),
    // Verlangt jemand einen Schritt, den es nicht gibt, ist der nächste
    // erreichbare besser als gar keiner.
    zuGross: s.nachbar(1.5, 1, 'dumbbells', satz, 40),
  };
}, SATZ);
check(schritte.hoch === 6.5, `von 4 aus mit Wunsch 2 kg auf 6,5 (${schritte.hoch})`);
check(schritte.runter === 4, `und zurück auf 4 (${schritte.runter})`);
check(schritte.obenAm === null, 'am oberen Ende des Vorrats gibt es kein Weiter');
check(schritte.zuGross === 4,
  `ein zu großer Wunsch nimmt den nächsten erreichbaren Wert (${schritte.zuGross})`);

// --- 4. Welche Scheiben, auf welche Seite -----------------------------
const lade = await page.evaluate(async (satz) => {
  const s = await import('./js/scheiben.js');
  return {
    kh: s.belegungText(6.5, 'dumbbells', satz),
    khLeer: s.belegungText(1.5, 'dumbbells', satz),
    lh: s.belegungText(30, 'barbell', satz),
    // 9 kg je Hand sind 3,75 je Seite. Drei 1,25er tun es auch – eine 2,5er
    // plus eine 1,25er ist derselbe Wert mit einem Handgriff weniger.
    wenig: s.belegung(9, 'dumbbells', satz),
    einfach: s.belegung(6.5, 'dumbbells', satz),
    unmoeglich: s.belegung(7, 'dumbbells', satz),
  };
}, SATZ);
console.log('     6,5 kg je Hand:', lade.kh);
console.log('     30 kg Stange:  ', lade.lh);
check(/je Seite/.test(lade.kh) && /beide Hanteln/.test(lade.kh),
  'bei zwei Kurzhanteln steht dabei, dass es je Seite jeder Hantel gilt');
check(/2,5/.test(lade.kh), 'und welche Scheibe das ist');
check(lade.khLeer === 'leere Stange', 'die leere Stange heißt auch so');
check(/je Seite/.test(lade.lh) && /10/.test(lade.lh),
  `die Langhantel nennt die Scheibe je Seite (${lade.lh})`);
check(lade.wenig.reduce((n, [, k]) => n + k, 0) === 2,
  `9 kg gehen mit zwei Scheiben je Seite, nicht mit drei (${JSON.stringify(lade.wenig)})`);
check(lade.einfach.length === 1 && lade.einfach[0][0] === 2.5 && lade.einfach[0][1] === 1,
  `und 6,5 kg mit genau einer 2,5er je Seite (${JSON.stringify(lade.einfach)})`);
check(lade.unmoeglich === null, 'für ein unmögliches Gewicht gibt es keine Belegung');

// --- 5. Unsinn in der Eingabe -----------------------------------------
// Die Werte kommen aus Textfeldern. Eine 0 als Scheibengewicht wäre der
// schlimmste Fall: unendlich viele Stufen, die alle dasselbe wiegen.
const geputzt = await page.evaluate(async () => {
  const s = await import('./js/scheiben.js');
  const n = s.normSatz({
    kh: { stange: 'zwei', scheiben: [[0, 4], [-1, 4], [2.5, 0], [1.25, 4], [1.25, 8], ['x', 4], null] },
    lh: 'Quatsch',
  });
  return { kh: n.kh, lh: n.lh, tief: s.normSatz(null) };
});
console.log('     geputzt:', JSON.stringify(geputzt.kh));
check(geputzt.kh.stange === null, 'Text als Stangengewicht wird zu "nicht eingetragen"');
check(geputzt.kh.scheiben.length === 1 && geputzt.kh.scheiben[0][0] === 1.25,
  'null-, negativ-, doppelt- und Textscheiben fallen raus');
check(geputzt.lh.scheiben.length === 0, 'ein kaputter Zweig wird zum leeren Satz');
check(geputzt.tief.kh.scheiben.length === 0, 'und null zu einem vollständigen leeren Satz');

// --- 6. Ohne Eintrag ändert sich nichts -------------------------------
// Der Vertrag der ganzen Sache. Erst der Stand ohne Scheiben, dann derselbe
// Stand mit – und nur der zweite darf sich verschieben.
const setze = (scheiben) => page.evaluate((sch) => {
  localStorage.removeItem('workout.rounds.v1');
  localStorage.setItem('workout.state.v1', JSON.stringify({
    greeted: true, name: 'T', level: 'anfaenger', shift: 0, log: {}, scheiben: sch,
  }));
}, scheiben);

await setze(null);
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(300);
const ohne = await page.evaluate(async () => {
  const { EX_BY_ID } = await import('./js/uebung.js');
  const { workingWeight } = await import('./js/gewichte.js');
  return workingWeight('sitzendes-schulterdruecken') + 0 * EX_BY_ID.size;
});
check(ohne === 6, `ohne Eintrag steht das Schulterdrücken bei 6 kg je Hand (${ohne})`);

await setze(SATZ);
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(300);
const mit = await page.evaluate(async () => {
  const { workingWeight, naechstesGewicht, ladeText } = await import('./js/gewichte.js');
  const w = workingWeight('sitzendes-schulterdruecken');
  return { w, hoch: naechstesGewicht('sitzendes-schulterdruecken', 1), text: ladeText('sitzendes-schulterdruecken', w) };
});
console.log('     mit Scheiben:', JSON.stringify(mit));
check(mit.w === 6.5, `mit Eintrag rastet es auf 6,5 kg ein (${mit.w})`);
check(mit.hoch === 9, `und der nächste Schritt ist 9, nicht 8,5 (${mit.hoch})`);
check(/2,5/.test(mit.text), `mit der Ansage, was draufkommt (${mit.text})`);

// Der Rucksack bleibt unangetastet, obwohl ein Satz eingetragen ist.
const ruck = await page.evaluate(async () => {
  const { naechstesGewicht, workingWeight } = await import('./js/gewichte.js');
  return { jetzt: workingWeight('gewichtete-liegestuetze'), hoch: naechstesGewicht('gewichtete-liegestuetze', 1) };
});
check(ruck.hoch - ruck.jetzt === 1,
  `der Rucksack geht weiter in seinen eigenen Schritten: ${ruck.jetzt} → ${ruck.hoch}`);

// --- 7. Die Bedienung -------------------------------------------------
await page.locator('.tab[data-tab="settings"]').click();
await page.waitForTimeout(400);
const text = (await page.locator('#view').textContent()).replace(/\s+/g, ' ');
check(/Was bei dir rumliegt/.test(text), 'die Eingabe steht unter Mehr');
check(/Damit einstellbar je Hand:.*6,5/.test(text),
  'und zeigt die erreichbaren Gewichte – der Beleg, dass richtig eingetragen wurde');

// Eine Größe hinzufügen und wieder wegnehmen, ohne dass etwas verrutscht.
const vorher = await page.locator('[data-act="scheiben-weg"]').count();
await page.locator('[data-act="scheiben-plus"]').first().click();
await page.waitForTimeout(300);
const dazu = await page.locator('[data-act="scheiben-weg"]').count();
check(dazu === vorher + 1, `"Scheibengröße hinzufügen" legt eine Zeile an (${vorher} → ${dazu})`);
await page.locator('[data-act="scheiben-weg"]').first().click();
await page.waitForTimeout(300);
check(await page.locator('[data-act="scheiben-weg"]').count() === dazu - 1,
  'und das ✕ nimmt sie wieder weg');

check(errs.length === 0, `keine Fehler${errs.length ? ': ' + errs.slice(0, 2).join(' | ') : ''}`);
console.log(`\n${fails ? fails + ' FEHLER' : 'alle Prüfungen bestanden'}`);
await browser.close();
