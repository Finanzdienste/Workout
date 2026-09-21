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

/* --- 5. Bodenpresse: über der Brust, Ellbogen am Boden -------------------- *
 *
 * Diese Prüfung fehlte, und das ist der Grund, warum die Stellung monatelang
 * falsch dastehen konnte, während 53 Prüfungen grün meldeten. Gemessen wurde
 * bisher, dass die Figur auf dem Boden sitzt und dass die Gelenke erreichbar
 * sind – nicht, ob die Bewegung die Übung trifft.
 *
 *     „Animationen sind noch immer falsch."
 *
 * Zwei Zahlen entscheiden es, beide aus solve() und beide in Körperlängen. Die
 * Schulter liegt bei x −0.42, die Brust bei −0.28, der Kopf bei −0.63:
 *
 *   Hand x unten   Wo die Last am tiefsten Punkt steht. Vorher −0.586 bei der
 *                  Stange und −0.537 bei den Kurzhanteln – beides zwischen
 *                  Schulter und Kopf. Das ist ein Überzug, keine Presse.
 *   Ellbogen y     Der Boden ist bei dieser Übung der Anschlag; unten liegt der
 *                  Oberarm auf. Vorher schwebte er 0.19 bis 0.25 darüber.
 */
const presseMuster = ['press', 'pressbar'];
presseMuster.forEach((name) => {
  const spec = PATTERNS[name];
  const unten = skelett(spec, 0);
  const oben = skelett(spec, 1);
  const schulterX = unten.shoulderL[0];
  const brustX = unten.chest[0];
  const kopfX = unten.head[0];
  console.log(`     ${name}: Hand unten x=${unten.handL[0].toFixed(3)} `
    + `Ellbogen y=${unten.elbowL[1].toFixed(3)} · Hand oben x=${oben.handL[0].toFixed(3)} `
    + `y=${oben.handL[1].toFixed(3)} · Schulter x=${schulterX.toFixed(3)} Brust x=${brustX.toFixed(3)}`);

  // Über der Brust heißt: zwischen Brust und Schulter, nicht dahinter.
  check(unten.handL[0] > schulterX + 0.05,
    `${name}: unten steht die Last über der Brust, nicht hinter der Schulter `
    + `(${unten.handL[0].toFixed(3)} gegen Schulter ${schulterX.toFixed(3)})`);
  check(unten.handL[0] > kopfX + 0.25,
    `${name}: und mit Abstand zum Kopf (${kopfX.toFixed(3)})`);

  // Der Boden ist der Anschlag – sonst ist es kein Bodendrücken.
  const ellHoehe = unten.elbowL[1] - Math.min(...Object.values(unten).map((q) => q[1]));
  check(ellHoehe < 0.08,
    `${name}: unten liegt der Oberarm am Boden (Ellbogen ${ellHoehe.toFixed(3)} darüber)`);

  // Oben über der Schulter, Arm lang.
  check(Math.abs(oben.handL[0] - schulterX) < 0.06,
    `${name}: oben steht sie über der Schulter (${oben.handL[0].toFixed(3)})`);
  check(oben.handL[1] > unten.handL[1] + 0.2,
    `${name}: und deutlich höher als unten (${oben.handL[1].toFixed(3)} gegen ${unten.handL[1].toFixed(3)})`);

  // Die Griffweite ändert sich nicht – sonst schrumpft die Stange im Ablauf.
  if (name === 'pressbar') {
    check(Math.abs(Math.abs(oben.handL[2]) - Math.abs(unten.handL[2])) < 0.03,
      `${name}: die Griffweite bleibt gleich (${unten.handL[2].toFixed(3)} → ${oben.handL[2].toFixed(3)})`);
  }
});

/* --- 5. Abgespreizter Arm: die Beugung muss nach innen gehen -------------- */
//
//     „Irgendwie sieht die Animation bei face pull falsch aus"
//
// Zum zweiten Mal dieselbe Falle. Der Ellenbogen beugt in dieser Figur nur in
// der Längsebene (arm.e, rotX); die Abspreizung liegt in der Frontalebene
// (arm.a, rotZ). Zeigt der Oberarm weit abgespreizt fast entlang der x-Achse,
// dreht eine Beugung *um* diese Achse den Unterarm nicht nach oben zum Kopf,
// sondern weiter nach außen. Beim Schulterdrücken kam so ein Seitheben heraus,
// beim Face Pull ein breites Auseinanderziehen.
//
// Der Prüfstein ist in beiden Fällen derselbe und braucht keine Übungskunde:
// Ist der Arm abgespreizt *und* gebeugt, muss der Unterarm mehr nach oben als
// nach außen gehen. Geht er mehr nach außen, ist er in der falschen Ebene
// geklappt. Dafür gibt es arm.i, das in der Frontalebene dreht.
//
//   alt  facepull t=1   Ellenbogen 0,44 → Hand 0,66:  0,21 nach außen,
//                       0,13 nach oben. Also nach außen geklappt.
//   neu  facepull t=1   Ellenbogen 0,48 → Hand 0,38: 0,10 nach *innen*,
//                       0,23 nach oben.
//
// Geprüft wird nur, wo die Übung einen gebeugten Arm verlangt: beim Face Pull
// am Ende, beim Schulterdrücken am Anfang. Das Band-Auseinanderziehen steht
// bewusst nicht in der Liste – dort ist der Arm gestreckt, und dann *soll* die
// Hand weiter draußen liegen als der Ellenbogen.
[['facepull', 1], ['ohp', 0], ['ohpstand', 0]].forEach(([name, t]) => {
  const spec = PATTERNS[name];
  if (!spec) { check(false, `${name}: Muster fehlt`); return; }
  const j = skelett(spec, t);
  const raus = j.elbowR[0] - j.shoulderR[0];
  const nachAussen = j.handR[0] - j.elbowR[0];
  const nachOben = j.handR[1] - j.elbowR[1];
  check(raus > 0.15, `${name} t=${t}: der Oberarm ist abgespreizt (${raus.toFixed(3)})`);
  check(nachOben > Math.abs(nachAussen),
    `${name} t=${t}: der Unterarm geht nach oben, nicht nach außen `
    + `(${nachOben.toFixed(3)} hoch gegen ${nachAussen.toFixed(3)} seitlich)`);
});

/* --- 6. Face Pull: Ellenbogen hoch, Hände am Kopf ------------------------- */
//
// Der Hinweis der Übung sagt, wie das Ende aussieht: „Ellenbogen hoch und nach
// außen, Hände enden neben den Schläfen." Genau das wird hier nachgerechnet –
// vorher endete die Hand 0,66 draußen auf Brusthöhe, also weder hoch noch am
// Kopf, und der Arm war dabei fast gestreckt.
{
  const anfang = skelett(PATTERNS.facepull, 0);
  const ende = skelett(PATTERNS.facepull, 1);
  const winkel = (j) => {
    const u = [0, 1, 2].map((i) => j.elbowR[i] - j.shoulderR[i]);
    const f = [0, 1, 2].map((i) => j.handR[i] - j.elbowR[i]);
    const len = (v) => Math.hypot(...v) || 1;
    const cos = u.reduce((s, x, i) => s + x * f[i], 0) / (len(u) * len(f));
    return 180 - (Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI;
  };
  console.log('     Face Pull Ende:', JSON.stringify({
    ellenbogen: ende.elbowR.map((v) => +v.toFixed(3)),
    hand: ende.handR.map((v) => +v.toFixed(3)),
    winkel: +winkel(ende).toFixed(0),
  }));
  // Anfang: Arme zum Band hin gestreckt, nach vorn.
  check(winkel(anfang) > 150,
    `Face Pull: unten ist der Arm fast gestreckt (${winkel(anfang).toFixed(0)}°)`);
  check(anfang.handR[2] > anfang.shoulderR[2] + 0.3,
    `Face Pull: und die Hände stehen weit vorn am Band (z ${anfang.handR[2].toFixed(3)})`);
  // Ende: Ellenbogen auf Schulterhöhe, Hand auf Kopfhöhe, Arm gebeugt.
  check(Math.abs(ende.elbowR[1] - ende.shoulderR[1]) < 0.08,
    `Face Pull: oben steht der Ellenbogen auf Schulterhöhe `
    + `(${ende.elbowR[1].toFixed(3)} gegen ${ende.shoulderR[1].toFixed(3)})`);
  check(Math.abs(ende.handR[1] - ende.head[1]) < 0.09,
    `Face Pull: die Hand endet auf Kopfhöhe (${ende.handR[1].toFixed(3)} gegen ${ende.head[1].toFixed(3)})`);
  check(winkel(ende) < 90,
    `Face Pull: und der Arm ist dabei deutlich gebeugt (${winkel(ende).toFixed(0)}°)`);
  check(ende.handR[1] > anfang.handR[1],
    `Face Pull: die Hand geht nach oben, nicht nach unten `
    + `(${anfang.handR[1].toFixed(3)} → ${ende.handR[1].toFixed(3)})`);
}

console.log(`\n${fails ? fails + " FEHLER" : "alle Prüfungen bestanden"}`);
