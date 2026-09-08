/*
 * Stellungen nachrechnen statt begutachten.
 *
 * Eine Figur wird nach Augenmaß gebaut, und nach Augenmaß fällt auch nicht auf,
 * wenn sie die Übung verfehlt: Beim Hip Thrust lagen die Schultern am Boden,
 * die Knie standen höher als alles andere, und die Füße schwebten – *„teilweise
 * sind die animationen noch irre führend."* Aus dem fertigen Bild las sich das
 * als „irgendwie schräg", nicht als „falsche Übung".
 *
 * Gemessen wird deshalb an den Gelenkpunkten, mit derselben Rechnung, die auch
 * zeichnet (tools/pose.mjs). Die Zahlen stehen in Körperlängen über dem Boden;
 * der Boden ist, wie in js/figure.js, der tiefste Punkt der Stellung.
 *
 * Kein Browser nötig: js/figure.js rechnet ohne DOM, und genau das ist der
 * Grund, warum diese Prüfung so billig ist.
 */
import { PATTERNS, RIG } from '../js/figure.js';
import { masse, skelett } from '../tools/pose.mjs';

let fails = 0;
const check = (c, m) => { console.log(`${c ? 'OK  ' : 'FAIL'} ${m}`); if (!c) { fails++; process.exitCode = 1; } };
const nah = (a, b, tol) => Math.abs(a - b) <= tol;

/* --- 1. Hip Thrust: Schultern oben, Füße unten, Hüfte bewegt sich --------- */
const unten = masse(PATTERNS.thrust, 0);
const oben = masse(PATTERNS.thrust, 1);
console.log('     unten:', JSON.stringify(Object.fromEntries(
  Object.entries(unten).map(([k, v]) => [k, +v.toFixed(3)]))));
console.log('     oben: ', JSON.stringify(Object.fromEntries(
  Object.entries(oben).map(([k, v]) => [k, +v.toFixed(3)]))));

// Die Auflage: Die Schultern liegen etwa auf Schulterhöhe eines Stehenden über
// dem Boden – das ist die Höhe einer Bank oder Sofakante – und zwar in beiden
// Stellungen. Wandern sie, liegt die Figur nicht auf, sondern schwebt.
check(unten.schulterH > 0.32 && oben.schulterH > 0.32,
  `die Schultern liegen erhöht (${unten.schulterH.toFixed(2)} / ${oben.schulterH.toFixed(2)})`);
check(nah(unten.schulterH, oben.schulterH, 0.04),
  'und bleiben dabei auf derselben Höhe – die Bank hält sie');

// Die Füße stehen am Boden, in beiden Stellungen und an derselben Stelle.
check(nah(unten.fussH, 0, 0.01) && nah(oben.fussH, 0, 0.01),
  `die Füße stehen am Boden (${unten.fussH.toFixed(3)} / ${oben.fussH.toFixed(3)})`);
check(nah(unten.fussX, oben.fussX, 0.05),
  `und bleiben stehen (x ${unten.fussX.toFixed(2)} → ${oben.fussX.toFixed(2)})`);

// Bewegt wird die Hüfte, und zwar deutlich.
check(oben.hueftH - unten.hueftH > 0.2,
  `die Hüfte macht die Bewegung (${unten.hueftH.toFixed(2)} → ${oben.hueftH.toFixed(2)})`);
check(unten.hueftH < 0.2, `unten kommt sie fast auf den Boden (${unten.hueftH.toFixed(2)})`);

// Oben eine Linie von Knie bis Schulter – das ist die Endstellung der Übung.
check(oben.knick < 0.03, `oben stehen Schulter, Hüfte und Knie in einer Linie (${oben.knick.toFixed(3)})`);
check(oben.schien < 6, `und die Schienbeine senkrecht (${oben.schien.toFixed(1)}°)`);

// Und die Knie stehen nie höher als die Schultern. Genau daran erkannte man die
// alte Fassung als Beckenbrücke in der Luft.
check(unten.knieH <= unten.schulterH + 0.05 && oben.knieH <= oben.schulterH + 0.05,
  `die Knie bleiben unter Schulterhöhe (${unten.knieH.toFixed(2)} / ${oben.knieH.toFixed(2)})`);

/* --- 2. Einbeinig: ein Fuß steht, der andere ist in der Luft -------------- */
const BODEN = -0.62;
[0, 0.5, 1].forEach((t) => {
  const j = skelett(PATTERNS.thrust1, t);
  const stand = Math.min(j.ankleR[1], j.toeR[1]) - BODEN;
  const frei = Math.min(j.ankleL[1], j.toeL[1]) - BODEN;
  check(nah(stand, 0, 0.01), `t=${t}: das Standbein steht (${stand.toFixed(3)})`);
  check(frei > 0.2, `t=${t}: das freie Bein ist in der Luft (${frei.toFixed(2)})`);
});

/* --- 3. Keine Figur steckt im Boden -------------------------------------- */
// skelett() setzt den tiefsten Punkt auf den Boden. Steckt trotzdem etwas
// darunter, stimmt die Rechnung nicht – und liegt der tiefste Punkt in einer
// Zwischenstellung woanders, hebt und senkt sich die ganze Figur beim Abspielen.
Object.entries(PATTERNS).forEach(([name, spec]) => {
  const tiefsten = [0, 0.25, 0.5, 0.75, 1].map((t) => {
    const j = skelett(spec, t);
    return Math.min(...Object.values(j).map((q) => q[1]));
  });
  const abweichung = Math.max(...tiefsten) - Math.min(...tiefsten);
  check(abweichung < 1e-9, `${name}: sitzt in jeder Stellung auf dem Boden`);
});

/* --- 4. Die Auflage steht nur da, wo sie hingehört ------------------------ */
const mitCouch = Object.entries(PATTERNS).filter(([, s]) => s.couch).map(([n]) => n);
console.log('     mit Auflage:', mitCouch.join(', '));
check(mitCouch.length === 2 && mitCouch.includes('thrust') && mitCouch.includes('thrust1'),
  'genau die beiden Hüftstreckungen bekommen eine Bank');
check(RIG.headR > 0, 'der Kopfradius steht zur Verfügung – daran hängt die Höhe der Auflage');

console.log(`\n${fails ? fails + ' FEHLER' : 'alle Prüfungen bestanden'}`);
