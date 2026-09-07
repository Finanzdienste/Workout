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

// Ein Vorrat, zwei Stangen: Scheiben passen überall drauf, nur die Leergewichte
// unterscheiden sich.
const SATZ = {
  stange: { kh: 1.5, lh: 10 },
  scheiben: [[1.25, 8], [2.5, 4], [5, 4], [10, 2]],
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
    // Beide Stangen greifen in denselben Vorrat, nur die Basis unterscheidet sie.
    lhBasis: s.erreichbar('barbell', satz)[0],
  };
}, SATZ);
console.log('     beide Kurzhanteln:', JSON.stringify(zahlen.kh2));
console.log('     eine Kurzhantel:  ', JSON.stringify(zahlen.kh1));

// Beide Hanteln: vier Scheiben je Stufe. Von 8× 1,25 reichen also zwei Stufen
// (je +2,5 kg), von 4× 2,5 eine (+5 kg).
check(zahlen.kh2[0] === 1.5 && zahlen.kh2.includes(4) && zahlen.kh2.includes(6.5),
  `beide Kurzhanteln beginnen bei der leeren Stange und gehen 4 / 6,5 weiter (${JSON.stringify(zahlen.kh2.slice(0, 5))})`);
check(!zahlen.kh2.includes(6),
  'und 6 kg je Hand ist genau nicht dabei – der Fall, um den es ging');

// Eine einzelne Hantel darf denselben Vorrat doppelt so tief ausnutzen:
// zwei Scheiben je Stufe statt vier.
check(zahlen.kh1.length > zahlen.kh2.length,
  `eine Kurzhantel kommt weiter als zwei (${zahlen.kh1.length} statt ${zahlen.kh2.length} Werte)`);
check(zahlen.kh1.includes(6.5) && zahlen.kh1.includes(11.5),
  'sie erreicht auch die schwereren Stufen');

check(zahlen.lh[0] === 10, `die Langhantel beginnt bei ihrer leeren Stange (${zahlen.lh[0]})`);
check(zahlen.lh.includes(60), 'und kommt mit allem aus demselben Vorrat auf 60 kg');
check(zahlen.lhBasis === 10 && zahlen.kh2[0] === 1.5,
  'ein Vorrat, zwei Stangen – unterschieden werden sie nur durchs Leergewicht');
check(zahlen.ruck === null,
  'der Rucksack wird nicht gerastet – da passt auch eine Wasserflasche rein');
check(zahlen.leer === null,
  'und ohne Eintrag gibt es kein Raster, sondern ein ehrliches "weiß ich nicht"');

// --- 1b. Zwei Scheiben je Größe: für ein Paar reicht das nicht -------
// Genau der Stand, der in der App als „0 kg" dastand. Vier Scheiben kostet eine
// Stufe bei beiden Hanteln; von jeder Größe nur zwei heißt: geht nicht. Die
// Zahl war richtig, sie sah nur aus wie ein Fehler.
const knapp = await page.evaluate(async () => {
  const s = await import('./js/scheiben.js');
  const satz = { stange: { kh: 2.5, lh: 10 }, scheiben: [[2.5, 2], [5, 2], [4, 2]] };
  return { paar: s.erreichbar('dumbbells', satz), einzeln: s.erreichbar('goblet', satz) };
});
console.log('     knapper Vorrat, Paar:', JSON.stringify(knapp.paar));
check(knapp.paar.length === 1 && knapp.paar[0] === 2.5,
  'von jeder Größe nur zwei Scheiben: für ein Paar bleibt die leere Stange');
check(knapp.einzeln.length > 1,
  `für eine einzelne Hantel reicht derselbe Vorrat (${JSON.stringify(knapp.einzeln)})`);

// --- 2. Einrasten -----------------------------------------------------
const gerastet = await page.evaluate(async (satz) => {
  const s = await import('./js/scheiben.js');
  return {
    sechs: s.raste(6, 'dumbbells', satz),
    weitUnten: s.raste(0.5, 'dumbbells', satz),
    weitOben: s.raste(99, 'dumbbells', satz),
    // Das Schwerste, was der Vorrat je Hand hergibt – nicht als Zahl im Test,
    // sondern aus der Aufzählung selbst. Sonst müsste jede Änderung am
    // Beispielvorrat hier nachgezogen werden.
    schwerstes: s.erreichbar('dumbbells', satz).at(-1),
    // Genau in der Mitte zwischen 4 und 6,5 liegt 5,25.
    mitte: s.raste(5.25, 'dumbbells', satz),
    ohne: s.raste(6, 'dumbbells', s.leererSatz()),
  };
}, SATZ);
check(gerastet.sechs === 6.5, `6 kg rasten auf 6,5 ein (${gerastet.sechs})`);
check(gerastet.weitUnten === 1.5, 'unterhalb der leeren Stange geht nichts');
check(gerastet.weitOben === gerastet.schwerstes,
  `und oberhalb des Vorrats auch nicht (${gerastet.schwerstes})`);
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
    obenAm: s.nachbar(s.erreichbar('dumbbells', satz).at(-1), 1, 'dumbbells', satz, 2),
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
    stange: { kh: 'zwei', lh: 10 },
    scheiben: [[0, 4], [-1, 4], [2.5, 0], [1.25, 4], [1.25, 8], ['x', 4], null],
  });
  // Die erste Fassung hatte zwei Listen. So ein Stand darf nicht verloren gehen.
  const altBestand = s.normSatz({
    kh: { stange: 1.5, scheiben: [[1.25, 4], [2.5, 2]] },
    lh: { stange: 10, scheiben: [[2.5, 4], [5, 2]] },
  });
  return { n, altBestand, tief: s.normSatz(null) };
});
console.log('     geputzt:', JSON.stringify(geputzt.n));
console.log('     alter Stand:', JSON.stringify(geputzt.altBestand));
check(geputzt.n.stange.kh === null && geputzt.n.stange.lh === 10,
  'Text als Stangengewicht wird zu "nicht eingetragen", die gute Zahl bleibt');
check(geputzt.n.scheiben.length === 1 && geputzt.n.scheiben[0][0] === 1.25,
  'null-, negativ-, doppelt- und Textscheiben fallen raus');
check(geputzt.n.scheiben[0][1] === 8,
  'bei doppelter Größe gilt die größere Stückzahl, nicht die erste');
check(geputzt.altBestand.stange.kh === 1.5 && geputzt.altBestand.stange.lh === 10,
  'ein Stand aus der Fassung mit zwei Listen behält beide Stangen');
check(JSON.stringify(geputzt.altBestand.scheiben) === JSON.stringify([[1.25, 4], [2.5, 4], [5, 2]]),
  `und seine Listen werden zu einem Vorrat zusammengelegt (${JSON.stringify(geputzt.altBestand.scheiben)})`);
check(geputzt.tief.scheiben.length === 0, 'und null zu einem vollständigen leeren Satz');

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
check(/Beide Kurzhanteln, je Hand:.*6,5/.test(text),
  'und zeigt die erreichbaren Gewichte – der Beleg, dass richtig eingetragen wurde');
check(/Eine Kurzhantel:/.test(text) && /Langhantel:/.test(text),
  'für alle drei Ladearten, weil derselbe Vorrat je nach Gerät anders weit reicht');

// Eine Größe hinzufügen und wieder wegnehmen, ohne dass etwas verrutscht.
const vorher = await page.locator('[data-act="scheiben-weg"]').count();
await page.locator('[data-act="scheiben-plus"]').click();
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
