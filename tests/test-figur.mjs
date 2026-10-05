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
 * zeichnet (skelett() aus js/figure.js, über tools/pose.mjs). Die Zahlen stehen
 * in Körperlängen über dem Boden.
 *
 * Kein Browser nötig: js/figure.js rechnet ohne DOM, und genau das ist der
 * Grund, warum diese Prüfung so billig ist.
 */
import { readFileSync } from 'node:fs';
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
// dem Boden – das ist die Höhe der Sofakante – und zwar in beiden
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
// Ausgenommen, was an der Stange hängt: Dort halten die Hände, nicht der Boden.
Object.entries(PATTERNS).filter(([, spec]) => spec.anchor !== 'bar').forEach(([name, spec]) => {
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

/* --- 7. Was am Boden steht, bleibt stehen -------------------------------- */
//
// Die Durchsicht der App fand drei Figuren, die rutschten, während alle
// Prüfungen oben grün waren – denn die prüften nur, dass *irgendetwas* den
// Boden berührt, nicht was:
//
//   Liegestütz        die Hände wanderten 0,2 über den Boden, die Fußspitzen
//                     hoben ab; gedrückt wurde optisch der Boden weg
//   Pike Push-up      die Füße rutschten 0,34 nach vorn, der Kopf kam nie
//                     tiefer als die Hüfte – ein Hüftknick, kein Drücken
//   Stehende Übungen  die Füße zogen bei jeder Wiederholung mit
//
// Zeichnung, Werkzeug und diese Prüfung rechnen seit v201 mit derselben
// skelett(), die die Kontaktpunkte festhält. Hier wird gemessen, dass sie es tut.
const T = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1];
const flach = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const mittel = (a, b) => [0, 1, 2].map((i) => (a[i] + b[i]) / 2);

const stehend = Object.entries(PATTERNS).filter(([, s]) => !s.lie && s.anchor !== 'bar');
stehend.forEach(([name, spec]) => {
  const s = spec.stance || spec.poses[0].stance;
  const fuss = (j) => (s ? j[`toe${s}`] : mittel(j.toeL, j.toeR));
  const js = T.map((t) => skelett(spec, t));
  const weg = Math.max(...js.map((j) => flach(fuss(j), fuss(js[0]))));
  const hoch = Math.max(...js.map((j) => (s ? j[`toe${s}`][1] : Math.min(j.toeL[1], j.toeR[1])) - BODEN));
  check(weg < 0.005 && hoch < 0.03,
    `${name}: ${s ? 'der Standfuß' : 'die Füße'} bleibt am Boden stehen (wandert ${weg.toFixed(3)}, hebt ${hoch.toFixed(3)})`);
});
check(stehend.length >= 20, `alle stehenden Muster geprüft (${stehend.length})`);

const stuetzend = Object.entries(PATTERNS).filter(([, s]) => s.stuetz);
check(['pushup', 'pushupfeet', 'pike'].every((n) => PATTERNS[n].stuetz),
  'Liegestütz, erhöhte Füße und Pike stützen sich ab');
stuetzend.forEach(([name, spec]) => {
  const js = T.map((t) => skelett(spec, t));
  const hand = (j) => mittel(j.handL, j.handR);
  const zeh = (j) => mittel(j.toeL, j.toeR);
  const handWeg = Math.max(...js.map((j) => flach(hand(j), hand(js[0]))));
  const handHoch = Math.max(...js.map((j) => Math.max(j.handL[1], j.handR[1]) - BODEN));
  const zehWeg = Math.max(...js.map((j) => flach(zeh(j), zeh(js[0]))));
  const zehHoch = js.map((j) => Math.min(j.toeL[1], j.toeR[1]) - BODEN);
  const zehStreu = Math.max(...zehHoch) - Math.min(...zehHoch);
  const griff = js.map((j) => Math.hypot(...[0, 1, 2].map((i) => j.handL[i] - j.handR[i])));
  const griffStreu = Math.max(...griff) - Math.min(...griff);
  check(handWeg < 0.005 && handHoch < 0.005,
    `${name}: die Hände bleiben am Boden, wo sie sind (wandern ${handWeg.toFixed(3)}, heben ${handHoch.toFixed(3)})`);
  check(zehWeg < 0.01 && zehStreu < 0.005,
    `${name}: die Fußspitzen auch (wandern ${zehWeg.toFixed(3)}, Höhe ${zehHoch[0].toFixed(3)} ± ${zehStreu.toFixed(3)})`);
  check(spec.step ? zehHoch[0] > 0.3 : zehHoch[0] < 0.005,
    `${name}: ${spec.step ? 'auf dem Kasten' : 'am Boden'} (${zehHoch[0].toFixed(3)})`);
  check(griffStreu < 0.01, `${name}: die Griffweite bleibt (${griff[0].toFixed(3)} ± ${griffStreu.toFixed(3)})`);
  check(js[0].head[1] - js[T.length - 1].head[1] > 0.1,
    `${name}: gedrückt wird der Kopf zum Boden (${(js[0].head[1] - BODEN).toFixed(2)} → ${(js[T.length - 1].head[1] - BODEN).toFixed(2)})`);
});
// Ein Liegestütz, kein Unterarmstütz: oben die Hände nicht vor dem Kopf,
// unten der Unterarm eher steil als flach. Vorher 0,155 vor der Schulter und
// unten 60° gegen die Senkrechte – das sah aus wie Ablegen auf die Unterarme.
['pushup', 'pushupfeet'].forEach((name) => {
  const oben = skelett(PATTERNS[name], 0);
  const unten = skelett(PATTERNS[name], 1);
  const vor = oben.shoulderR[0] - oben.handR[0];   // Kopf liegt bei −x
  const unterarm = Math.abs(Math.atan2(unten.handR[0] - unten.elbowR[0],
    unten.elbowR[1] - unten.handR[1]) * 180 / Math.PI);
  check(vor < 0.03 && vor > -0.15,
    `${name}: oben setzen die Hände unter Schulter oder Brust auf (${vor.toFixed(3)} vor der Schulter)`);
  check(unterarm < 40, `${name}: unten steht der Unterarm eher steil (${unterarm.toFixed(0)}° gegen die Senkrechte)`);
  // Mit den Füßen auf dem Kasten geht der Kopf voran nach unten, die Brust
  // bleibt höher – dort zählt der Kopf.
  const tief = name === 'pushup' ? unten.chest[1] : unten.head[1];
  check(tief - BODEN < 0.3,
    `${name}: und ${name === 'pushup' ? 'die Brust' : 'der Kopf'} kommt tief (${(tief - BODEN).toFixed(3)})`);
});
{
  const unten = skelett(PATTERNS.pike, 1);
  check(unten.head[1] < unten.hipC[1] - 0.4,
    `Pike: unten steht der Kopf tief unter der Hüfte (${(unten.head[1] - BODEN).toFixed(2)} gegen ${(unten.hipC[1] - BODEN).toFixed(2)})`);
}

/* --- 8. Face Pull: das Band kommt etwa waagerecht ------------------------- */
//
// Gemessen, wie es gezeichnet wird: vom Handpunkt zur Stange bei
// [x der Hand, ueberkopf, ueberkopfZ], in denselben Bodenkoordinaten.
// Die erste Korrektur (v190) hatte in anderen Koordinaten gemessen und das
// Band damit von unten kommen lassen (−21 Grad) – daher diese Prüfung.
{
  const spec = PATTERNS.facepull;
  const band = (t) => {
    const h = skelett(spec, t).handR;
    return Math.atan2(spec.ueberkopf - h[1], spec.ueberkopfZ - h[2]) * 180 / Math.PI;
  };
  const w = [0, 0.5, 1].map(band);
  console.log('     Face Pull Band:', w.map((x) => x.toFixed(0) + '°').join(' '));
  check(w.every((x) => x > -8 && x < 30),
    `Face Pull: das Band steigt nie steil an und kommt nie von unten (${w.map((x) => x.toFixed(0)).join(' / ')} Grad)`);
  const kopf = skelett(spec, 0).head[1];
  check(Math.abs(spec.ueberkopf - kopf) < 0.08,
    `Face Pull: die Stange hängt auf Kopfhöhe (${spec.ueberkopf} gegen ${kopf.toFixed(3)})`);
}

/* --- 9. Tempo: langsam wird abgelassen ------------------------------------ */
// Bei diesen Mustern ist Stellung 1 das Ende des Ablassens. Sie fehlten in der
// Liste und liefen dadurch verkehrt: schnell in die Dehnung, langsam zurück.
{
  const quelle = readFileSync(new URL('../js/figure.js', import.meta.url), 'utf8');
  const treffer = quelle.match(/const LOWER_TO_1 = \[([^\]]*)\]/);
  const liste = treffer ? treffer[1] : '';
  ['squatheel', 'squatheelbw', 'legcurl', 'legcurl1'].forEach((n) => {
    check(liste.includes(`'${n}'`), `${n}: wird langsam abgelassen, nicht langsam angestrengt`);
  });
}

/* --- 10. Einbeiniges Kreuzheben: Hantel in der freien Hand ---------------- */
check(PATTERNS.hinge1.gewichtHand && PATTERNS.hinge1.gewichtHand !== PATTERNS.hinge1.stance,
  'einbeiniges Kreuzheben: die Hantel hängt auf der freien Seite, wie der Hinweis sagt');

/* --- 11. Jede greifende Hand zeigt ihren Griff ---------------------------- */
//
//     „Man soll bei jeder Übung auch die Finger sehen können damit man sieht
//      obs Ober- oder Untergriff ist"
//
// `daumen` am Muster zeichnet Finger und Daumen (js/figure.js). Geprüft wird,
// dass kein Muster ohne auskommt, dessen Übung etwas greift – Stange, Hantel,
// Band, Boden –, und dass Chin-ups und Pull-ups sich im Daumen unterscheiden:
// Das ist der ganze sichtbare Unterschied zwischen den beiden.
{
  const { EXERCISES } = await import('../js/data.js');
  const greift = /Stange|Hantel|Band|Rucksack|Scheibe/i;
  const muss = new Set();
  EXERCISES.forEach((e) => ['db', 'bw'].forEach((m) => {
    const v = e[m];
    if (greift.test(v.equip) || /pushup|pike/.test(v.pattern)) muss.add(v.pattern);
  }));
  // Crunches und Beckenheben halten die Scheibe auf dem Körper, sie greifen sie
  // nicht; das Handtuch beim Leg Curl liegt unter der Ferse.
  ['crunch', 'bridge', 'legcurl', 'legcurl1', 'thrust1', 'kneeraisefloor', 'snowangel'].forEach((k) => muss.delete(k));
  const ohne = [...muss].filter((k) => PATTERNS[k] && !PATTERNS[k].daumen);
  check(ohne.length === 0, `jedes greifende Muster sagt, wohin der Daumen zeigt${ohne.length ? ' – fehlt: ' + ohne.join(', ') : ` (${muss.size} Muster)`}`);
  check(PATTERNS.pullup.daumen === 'aussen' && PATTERNS.pullupwide.daumen === 'innen',
    'Chin-ups: Daumen außen (Untergriff), Pull-ups: Daumen innen (Obergriff)');
  check(PATTERNS.curl.daumen === 'aussen' && PATTERNS.hammercurl.daumen === 'vorn',
    'Curl im Untergriff, Hammercurl mit Daumen nach vorn');
  const erlaubt = ['innen', 'aussen', 'vorn', 'hinten', 'oben', 'unten'];
  const fremd = Object.entries(PATTERNS).filter(([, s]) => s.daumen && !erlaubt.includes(s.daumen)).map(([k]) => k);
  check(fremd.length === 0, `nur bekannte Daumenrichtungen${fremd.length ? ': ' + fremd.join(', ') : ''}`);
  check(PATTERNS.invrow.packAt === 'chest', 'bei der Inverted Row liegt der Rucksack auf der Brust');
}

/* --- 12. Liegend mit aufgestellten Füßen: die Ferse steht ----------------- */
//
// Bodenpresse, Trizeps im Liegen und Crunch lagen auf der Hüfte, und Knöchel
// wie Zehen hingen 0,07 darüber – „Füße aufstellen" sagt der Hinweis. Gefunden
// bei der Durchsicht der Figuren. Dieselbe Abmachung wie bei Beckenheben und
// Hip Thrust (Abschnitt 1): Steht der Fuß, liegt der Knöchel auf dem Boden.
[['press', T], ['pressbar', T], ['triceps', T], ['crunch', T], ['kneeraisefloor', [0]],
  ['bridge', T], ['thrust', T]].forEach(([name, ts]) => {
  const hoch = Math.max(...ts.map((t) => {
    const j = skelett(PATTERNS[name], t);
    return Math.min(j.ankleL[1], j.ankleR[1]) - BODEN;
  }));
  check(hoch < 0.02, `${name}: die Füße stehen auf dem Boden (Knöchel höchstens ${hoch.toFixed(3)} darüber)`);
});

/* --- 13. Reverse Snow Angel: die Figur bleibt liegen ---------------------- */
//
// Abschnitt 3 kann das nicht sehen – er prüft, dass der tiefste Punkt auf dem
// Boden liegt, und das stellt skelett() immer her. Liefen die Arme durch den
// Boden, wurde die Hand zum tiefsten Punkt und hob die ganze Figur an: Zehen
// bei t=0,7 0,10 über dem Boden. Also die Zehen selbst messen.
{
  const js = T.map((t) => skelett(PATTERNS.snowangel, t));
  const zehen = js.map((j) => Math.min(j.toeL[1], j.toeR[1]) - BODEN);
  const haende = js.map((j) => Math.min(j.handL[1], j.handR[1]) - BODEN);
  check(Math.max(...zehen) < 0.005,
    `Snow Angel: die Zehen bleiben in jedem Bild liegen (höchstens ${Math.max(...zehen).toFixed(3)})`);
  check(Math.min(...haende) > 0.05,
    `Snow Angel: die Hände bleiben über dem Boden (mindestens ${Math.min(...haende).toFixed(3)})`);
  const ende = js[js.length - 1];
  check(Math.abs(ende.handL[0] - ende.hipC[0]) < 0.2,
    `Snow Angel: am Ende stehen die Hände neben der Hüfte (x ${ende.handL[0].toFixed(2)} gegen ${ende.hipC[0].toFixed(2)})`);
}

/* --- 14. An der Stange mit Füßen am Boden: die Fersen stehen -------------- */
//
// Inverted Row und Trizeps an der Stange halten die Hände fest; den Boden
// zeichnet die Figur einmal aus der Startstellung. Wanderte der Fuß, steckte er
// im Boden (Inverted Row −0,010) oder schwebte (+0,045, beim Trizeps +0,038),
// beim Trizeps rutschte er zudem 0,25 nach hinten.
Object.entries(PATTERNS).filter(([, s]) => s.anchor === 'bar' && !s.float).forEach(([name, spec]) => {
  const js = T.map((t) => skelett(spec, t));
  const boden = Math.min(...Object.values(js[0]).map((q) => q[1]));
  const fuss = (j) => ['ankleL', 'ankleR', 'toeL', 'toeR'].map((k) => j[k]).reduce((a, b) => (b[1] < a[1] ? b : a));
  const hoehe = js.map((j) => fuss(j)[1] - boden);
  const weg = Math.max(...js.map((j) => flach(fuss(j), fuss(js[0]))));
  check(Math.max(...hoehe.map(Math.abs)) < 0.002,
    `${name}: die Fersen bleiben auf Bodenhöhe (${Math.min(...hoehe).toFixed(3)} … ${Math.max(...hoehe).toFixed(3)})`);
  check(weg < 0.005, `${name}: und rutschen nicht (wandern ${weg.toFixed(3)})`);
});

/* --- 15. Trizeps an der Stange: von der Seite gezeigt --------------------- */
// Im Standardblick (yaw 25) neigte sich der Körper auf die Kamera zu, und
// die Beine verschwanden hinter Rumpf und Kopf – wie vorher beim Pike.
{
  const v = PATTERNS.tricepsbar.view;
  check(Array.isArray(v) && Math.abs(v[0]) >= 55 && Math.abs(v[0]) <= 125,
    `Trizeps an der Stange: eigener Blick von der Seite (${v ? v.join('/') : 'keiner'})`);
}

/* --- 16. Bodyweight-Gerät: auch der Rucksack ------------------------------ */
//
// Abgeleitet wurde nur das Band; Rucksack-Curls und Rucksack-Rudern curlten
// und ruderten im Bodyweight-Modus mit leeren Fäusten.
{
  const { bwGeraet, figurGeraet, flaschen } = await import('../js/figure.js');
  const { EXERCISES } = await import('../js/data.js');
  check(bwGeraet('Rucksack') === 'backpack' && bwGeraet('Loop-Band') === 'band' && bwGeraet('Ohne Gerät') === null,
    'bwGeraet: Rucksack → backpack, Band → band, sonst nichts');
  const rucksack = EXERCISES.filter((e) => /rucksack/i.test(e.bw.equip));
  check(rucksack.length >= 2 && rucksack.every((e) => bwGeraet(e.bw.equip) === 'backpack'),
    `jede Bodyweight-Fassung mit Rucksack zeigt ihn (${rucksack.map((e) => e.id).join(', ')})`);

  // Und die Flaschen beim Seitheben – „zwei volle Flaschen", in beiden
  // Fassungen. Im Hantel-Modus nennt die Übung kein Gerät (equip null), und
  // die Figur hob dort wie im Bodyweight-Modus leere Fäuste.
  check(bwGeraet('zwei volle Flaschen') === 'bottles', 'bwGeraet: Flaschen → bottles');
  const flaschenUebungen = EXERCISES.filter((e) => /flasche/i.test(e.db.equip) || /flasche/i.test(e.bw.equip));
  const ohne = flaschenUebungen.flatMap((e) => ['db', 'bw'].filter((m) => figurGeraet(e, m) !== 'bottles').map((m) => `${e.id}:${m}`));
  check(flaschenUebungen.length >= 2 && ohne.length === 0,
    `jede Flaschen-Übung zeigt die Flaschen, in beiden Fassungen (${flaschenUebungen.map((e) => e.id).join(', ')}`
    + `${ohne.length ? '; ohne: ' + ohne.join(', ') : ''})`);
  const mitGeraet = EXERCISES.filter((e) => e.equip);
  check(mitGeraet.every((e) => figurGeraet(e, 'db') === e.equip),
    'im Hantel-Modus gilt weiter das Gerät der Übung, wo sie eins nennt');
  // Eine Flasche je Faust, quer durch sie hindurch.
  for (const name of ['lateral', 'lateralstand']) {
    const j = skelett(PATTERNS[name], 0.5);
    const f = flaschen(PATTERNS[name], j, 'bottles');
    const inDerHand = f.length === 2 && f.every((x, k) => x.centre === j[`hand${['L', 'R'][k]}`]);
    check(inDerHand, `${name}: je eine Flasche in jeder Hand (${f.length})`);
  }
}

/* --- 17. Goblet: Hände als Schale vor der Brust, Arme nicht gekreuzt ------ */
//
// „Findest du seine handpositionen sehen gesund aus?" – Die Unterarme
// kreuzten sich vor der Brust, die linke Hand stand rechts der Mitte, und die
// Hände standen hochkant vor dem Kinn. Gehalten wird die Hantel mit den
// Ellenbogen unten und fast senkrechten Unterarmen, jede Hand auf ihrer Seite.
for (const name of ['squat', 'squatheel']) {
  const spec = PATTERNS[name];
  check(spec.finger === 'schale', `${name}: Hände als Schale unter der Hantel (finger ${spec.finger})`);
  for (let k = 0; k <= 10; k++) {
    const t = k / 10;
    const j = skelett(spec, t);
    const seite = (s) => Math.sign(j[`shoulder${s}`][0]);
    const gekreuzt = ['L', 'R'].some((s) => Math.sign(j[`hand${s}`][0]) !== seite(s));
    const steil = Math.min(...['L', 'R'].map((s) => {
      const h = j[`hand${s}`]; const e = j[`elbow${s}`];
      return (h[1] - e[1]) / Math.hypot(h[0] - e[0], h[1] - e[1], h[2] - e[2]);
    }));
    const vorn = Math.min(...['L', 'R'].map((s) => j[`hand${s}`][2] - j.chest[2]));
    const unterHals = Math.max(...['L', 'R'].map((s) => j[`hand${s}`][1])) < j.neck[1];
    if (k === 0 || k === 10 || gekreuzt || steil < 0.8 || vorn < 0.1 || !unterHals) {
      check(!gekreuzt && steil >= 0.8 && vorn >= 0.1 && unterHals,
        `${name} t=${t}: Hände je auf ihrer Seite, Unterarm steil (${steil.toFixed(2)}), `
        + `${vorn.toFixed(2)} vor der Brust, unter dem Hals`);
    }
  }
}

/*
 * Und die Hände an der Hantel – gemessen an den Punkten, die gezeichnet
 * werden (handForm, hanteln aus js/figure.js), über die ganze Bewegung.
 *
 * Die zweite Fassung (v228) bestand alle Prüfungen oben und war trotzdem
 * falsch: Die Hände saßen 0,061 neben der Achse einer Scheibe mit Radius
 * 0,10, die Finger steckten ab der halben Handfläche in beiden oberen
 * Scheiben und kreuzten sich 0,05 jenseits der Mitte, die Handflächen zeigten
 * nach unten, die untere Scheibe lief durch die Unterarme, und unten in der
 * Hocke steckte die obere Scheibe 0,04 im Kinn. Keine Prüfung kam an die
 * Hände heran. Jede Hand, jeder Finger und der Daumen sind hier Kapseln mit
 * der Dicke, mit der sie gezeichnet werden (Breite / 40), die Hantel ist ihre
 * Scheiben, ihr Griff und ihre Stummel als Zylinder.
 */
{
  const { handForm, hanteln, hantelTeile, achsen } = await import('../js/figure.js');
  const plus = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const minus = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const mal = (v, s) => [v[0] * s, v[1] * s, v[2] * s];
  const punkt = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const laenge = (v) => Math.hypot(v[0], v[1], v[2]);
  const auf = (a, b, u) => plus(a, mal(minus(b, a), u));
  // Abstand eines Punkts zu einem Zylinder entlang der Hantelachse, innen negativ.
  const zylinder = (h, s0, s1, r) => (p) => {
    const d = minus(p, h.centre); const s = punkt(d, h.axis); const q = laenge(minus(d, mal(h.axis, s)));
    if (s >= s0 && s <= s1) return q <= r ? -Math.min(r - q, s - s0, s1 - s) : q - r;
    const ds = s < s0 ? s0 - s : s - s1;
    return q <= r ? ds : Math.hypot(ds, q - r);
  };
  // Kapseln (Punkt, Halbmesser) einer Hand: Fläche und alle Glieder.
  const kapseln = (hf) => {
    const out = [];
    const m = hf.flaeche.reduce((s, p) => plus(s, mal(p, 1 / hf.flaeche.length)), [0, 0, 0]);
    hf.flaeche.forEach((p) => [0.34, 0.67, 1].forEach((u) => out.push({ p: auf(m, p, u), r: 0.022, teil: 'Handfläche' })));
    hf.stuecke.forEach(([a, b, w1, w2], k) => {
      const teil = k === 0 ? 'Handballen' : k === hf.stuecke.length - 1 ? 'Daumen' : 'Finger';
      for (let i = 0; i <= 8; i++) out.push({ p: auf(a, b, i / 8), r: (w1 + (w2 - w1) * i / 8) / 40, teil });
    });
    return out;
  };
  const abstandStrecken = (a1, b1, a2, b2) => {
    let m = Infinity;
    for (let i = 0; i <= 12; i++) for (let k = 0; k <= 12; k++) m = Math.min(m, laenge(minus(auf(a1, b1, i / 12), auf(a2, b2, k / 12))));
    return m;
  };
  for (const name of ['squat', 'squatheel']) {
    const spec = PATTERNS[name];
    const schlimm = {
      inHantel: [Infinity, ''], nah: [-Infinity, ''], oben: [Infinity, ''], streck: [Infinity, ''], streckMax: [-Infinity, ''],
      mitte: [-Infinity, ''], finger: [Infinity, ''], arm: [Infinity, ''], kopf: [Infinity, ''], daumen: [-Infinity, ''],
    };
    const merke = (k, v, wo, kleiner) => {
      if (kleiner ? v < schlimm[k][0] : v > schlimm[k][0]) schlimm[k] = [v, wo];
    };
    for (let i = 0; i <= 20; i++) {
      const t = i / 20;
      const j = skelett(spec, t);
      const ach = achsen(j);
      const [h] = hanteln(spec, j, 'goblet');
      const T = hantelTeile(h.plate, h.half);
      const teile = [];
      T.scheiben.forEach(([a, b, r], k) => {
        teile.push({ name: k ? 'kleine obere Scheibe' : 'große obere Scheibe', d: zylinder(h, a, b, r) });
        teile.push({ name: k ? 'kleine untere Scheibe' : 'große untere Scheibe', d: zylinder(h, -b, -a, r) });
      });
      teile.push({ name: 'Griff', d: zylinder(h, -T.innen, T.innen, T.griffR) });
      teile.push({ name: 'Stummel oben', d: zylinder(h, T.scheiben[1][1], T.stummel, T.griffR) });
      teile.push({ name: 'Stummel unten', d: zylinder(h, -T.stummel, -T.scheiben[1][1], T.griffR) });
      const oberePlatte = teile[0];
      const haende = ['L', 'R'].map((s) => ({ s, hf: handForm(spec, j, s, 'goblet') }));
      haende.forEach(({ s, hf }) => {
        const wo = `t=${t} ${s}`;
        const innen = mal(ach.sideAxis, s === 'L' ? 1 : -1);
        let nah = Infinity;
        kapseln(hf).forEach(({ p, r, teil }) => {
          teile.forEach((z) => merke('inHantel', z.d(p) - r, `${wo} ${teil} – ${z.name}`, true));
          nah = Math.min(nah, oberePlatte.d(p) - r);
          if (teil === 'Finger' || teil === 'Daumen') merke('mitte', punkt(minus(p, h.centre), innen) + r, `${wo} ${teil}`, false);
        });
        merke('nah', nah, wo, false);
        merke('oben', punkt(hf.n, ach.upAxis), wo, true);
        // Streckung: Handfläche gegen Unterarm. Positiv heißt, die Hand ist
        // zum Handrücken hin abgeknickt – gestreckt, nicht gebeugt.
        const streck = Math.asin(Math.max(-1, Math.min(1, punkt(hf.n, hf.unterarm)))) * 180 / Math.PI;
        merke('streck', streck, wo, true);
        merke('streckMax', streck, wo, false);
        // Daumen um den Griff: seine Spitze liegt hinter der Achse, nah am Griff.
        const [, spitze] = hf.stuecke[hf.stuecke.length - 1];
        const d = minus(spitze, h.centre);
        const zurAchse = laenge(minus(d, mal(h.axis, punkt(d, h.axis))));
        merke('daumen', punkt(d, ach.frontAxis) < 0 ? zurAchse : Infinity, wo, false);
        // Unter- und Oberarm gegen jedes Teil der Hantel, mit ihrer Dicke.
        [[j[`elbow${s}`], j[`hand${s}`], 2.5, 1.8, 'Unterarm'], [j[`shoulder${s}`], j[`elbow${s}`], 3.4, 2.5, 'Oberarm']]
          .forEach(([a, b, w1, w2, arm]) => {
            for (let k = 0; k <= 20; k++) {
              const p = auf(a, b, k / 20); const r = (w1 + (w2 - w1) * k / 20) / 40;
              teile.forEach((z) => merke('arm', z.d(p) - r, `${wo} ${arm} – ${z.name}`, true));
            }
          });
      });
      // Finger der einen Hand gegen die der anderen
      haende[0].hf.stuecke.slice(1).forEach(([a1, b1, w1, w2]) => haende[1].hf.stuecke.slice(1).forEach(([a2, b2, v1, v2]) => {
        merke('finger', abstandStrecken(a1, b1, a2, b2) - (Math.max(w1, w2) + Math.max(v1, v2)) / 40, `t=${t}`, true);
      }));
      // Obere Scheiben samt Stummel gegen den Kopfmittelpunkt
      teile.filter((z) => /obere|oben/.test(z.name)).forEach((z) => merke('kopf', z.d(j.head), `t=${t} ${z.name}`, true));
    }
    const f3 = (v) => v.toFixed(3);
    const [inH, inWo] = schlimm.inHantel;
    check(inH >= 0, `${name}: keine Hand, kein Finger, kein Daumen steckt in Scheibe, Griff oder Stummel (knappster Abstand ${f3(inH)}, ${inWo})`);
    check(schlimm.nah[0] <= 0.02, `${name}: die Hände liegen an der oberen Scheibe an (höchstens ${f3(schlimm.nah[0])} entfernt, ${schlimm.nah[1]})`);
    check(schlimm.oben[0] >= 0.7, `${name}: Handflächen nach oben (Normale · Rumpfachse mindestens ${f3(schlimm.oben[0])}, ${schlimm.oben[1]})`);
    check(schlimm.streck[0] > 20 && schlimm.streckMax[0] < 75,
      `${name}: Handgelenk gestreckt, nicht gebeugt und nicht überstreckt (${schlimm.streck[0].toFixed(0)}° bis ${schlimm.streckMax[0].toFixed(0)}°)`);
    check(schlimm.mitte[0] <= 0, `${name}: keine Fingerspitze über der Mitte (äußerstens ${f3(schlimm.mitte[0])}, ${schlimm.mitte[1]})`);
    check(schlimm.finger[0] >= 0, `${name}: die Finger beider Hände durchdringen sich nicht (knappster Abstand ${f3(schlimm.finger[0])}, ${schlimm.finger[1]})`);
    check(schlimm.daumen[0] <= 0.065, `${name}: die Daumen liegen hinten um den Griff (Spitze höchstens ${f3(schlimm.daumen[0])} von der Achse, ${schlimm.daumen[1]})`);
    check(schlimm.arm[0] >= 0, `${name}: kein Arm in der Hantel, auch nicht in der unteren Scheibe (knappster Abstand ${f3(schlimm.arm[0])}, ${schlimm.arm[1]})`);
    check(schlimm.kopf[0] >= RIG.headR, `${name}: die obere Scheibe bleibt einen Kopfradius vom Kopf weg (${f3(schlimm.kopf[0])} ≥ ${RIG.headR}, ${schlimm.kopf[1]})`);
  }
}

/* --- 18. Kurzhantel quer in der Faust ------------------------------------ */
//
// Längs gehaltene Kurzhanteln standen fest in Blickrichtung des Rumpfs. Beim
// Hammercurl lag die Hantel mitten in der Wiederholung in Verlängerung des
// Unterarms (18°), beim Reverse Fly hing sie senkrecht am Arm entlang (9°),
// beim einbeinigen Kreuzheben ebenso (15°). Eine Faust hält den Griff quer.
// Geprüft wird jede Übung des Katalogs in beiden Fassungen, jede Hand, die
// eine Kurzhantel, Stange oder Flasche hält, über die ganze Bewegung.
{
  const { hanteln, flaschen, figurGeraet } = await import('../js/figure.js');
  const { EXERCISES } = await import('../js/data.js');
  const kombis = new Set();
  EXERCISES.forEach((ex) => ['db', 'bw'].forEach((m) => kombis.add(`${ex[m].pattern}|${figurGeraet(ex, m) || ''}`)));
  const winkel = (u, a) => Math.acos(Math.min(1, Math.abs(u[0] * a[0] + u[1] * a[1] + u[2] * a[2]))) * 180 / Math.PI;
  let geprueft = 0;
  [...kombis].sort().forEach((k) => {
    const [name, equip] = k.split('|');
    // Goblet hält die Hantel senkrecht zwischen den Händen, die Hüftstange
    // liegt auf dem Becken – beide hält keine Faust.
    if (!equip || equip === 'goblet' || equip === 'hipbar') return;
    const spec = PATTERNS[name];
    let min = Infinity; let wo = '';
    for (let i = 0; i <= 20; i++) {
      const t = i / 20;
      const j = skelett(spec, t);
      [...hanteln(spec, j, equip), ...flaschen(spec, j, equip)].forEach((h) => ['L', 'R'].forEach((s) => {
        const hand = j[`hand${s}`];
        const d = [0, 1, 2].map((c) => hand[c] - h.centre[c]);
        const s0 = d[0] * h.axis[0] + d[1] * h.axis[1] + d[2] * h.axis[2];
        if (Math.hypot(...d.map((v, c) => v - h.axis[c] * s0)) > 0.01) return;   // nicht diese Hand
        const u = [0, 1, 2].map((c) => hand[c] - j[`elbow${s}`][c]);
        const n = Math.hypot(...u);
        const w = winkel(u.map((v) => v / n), h.axis);
        if (w < min) { min = w; wo = `t=${t} ${s}`; }
      }));
    }
    if (min === Infinity) return;
    geprueft++;
    check(min >= 60, `${k}: Griff quer zum Unterarm (mindestens ${min.toFixed(0)}°${min < 60 ? ', ' + wo : ''})`);
  });
  check(geprueft >= 8, `dabei alle gehaltenen Geräte des Katalogs (${geprueft} Kombinationen)`);
}

/* --- 19. Stütz: schneller, dasselbe Ergebnis ------------------------------ */
//
// Liegestütz, Füße erhöht und Pike rechneten je Bild über 400-mal solve() –
// mit vierfach gedrosselter CPU 12–13 ms je Bild. Jetzt stehen Start und
// Griffweite je Muster fest, jede Auswertung löst einmal, und die Suche tastet
// von 0 nach außen. Das Ergebnis darf sich dabei nicht ändern: Hier stehen
// Punkte aus der Rechnung von vorher, auf 1e-9 genau.
{
  const vorher = {
    pushup: [[[-0.340597233, -0.619999928, -0.358331425], [0.814346446, -0.62, 0.205573748], [-0.604465371, -0.068379761, 0]], [[-0.340597233, -0.619999976, -0.358331425], [0.814346455, -0.62, 0.205573748], [-0.625265281, -0.125197101, 0]], [[-0.340597233, -0.619999842, -0.358331425], [0.814346494, -0.62, 0.205573748], [-0.659705936, -0.239893049, 0]], [[-0.340597233, -0.61999492, -0.358331425], [0.814343487, -0.62, 0.205573748], [-0.67262896, -0.294078534, 0]]],
    pushupfeet: [[[-0.319935029, -0.62, -0.358331425], [0.895363247, -0.062826643, 0.205573748], [-0.623499652, -0.164646854, 0]], [[-0.319935029, -0.62, -0.358331425], [0.895363247, -0.062826563, 0.205573748], [-0.619032085, -0.217483079, 0]], [[-0.319935029, -0.62, -0.358331425], [0.895363295, -0.062826416, 0.205573748], [-0.605178904, -0.319117202, 0]], [[-0.319935029, -0.62, -0.358331425], [0.895363035, -0.062826382, 0.205573748], [-0.596746423, -0.364357849, 0]]],
    pike: [[[-0.305297052, -0.62, 0.291115324], [0.205573748, -0.619999528, -0.389799403], [0, -0.26766266, 0.407364076]], [[-0.305297052, -0.62, 0.291115324], [0.205573748, -0.619990647, -0.389793549], [0, -0.33623726, 0.315456186]], [[-0.305297052, -0.619999975, 0.291115324], [0.205573748, -0.62, -0.389799666], [0, -0.437001616, 0.254314729]], [[-0.305297052, -0.619999987, 0.291115324], [0.205573748, -0.62, -0.389799666], [0, -0.47636322, 0.238497471]]],
  };
  // Eine frische Kopie des Moduls, ohne Zwischenspeicher: rückwärts und
  // durcheinander gerechnet muss dasselbe herauskommen wie der Reihe nach.
  const frisch = await import('../js/figure.js?frisch');
  Object.entries(vorher).forEach(([name, soll]) => {
    let max = 0;
    [0.13, 0.5, 0.87, 1].forEach((t, i) => {
      const j = skelett(PATTERNS[name], t);
      [j.handL, j.toeR, j.head].forEach((p, k) => p.forEach((v, c) => { max = Math.max(max, Math.abs(v - soll[i][k][c])); }));
    });
    let reihe = 0;
    const ts = Array.from({ length: 41 }, (_, i) => i / 40);
    const a = ts.map((t) => skelett(PATTERNS[name], t));
    [...ts].reverse().forEach((t) => {
      const b = frisch.skelett(frisch.PATTERNS[name], t);
      const r = a[ts.indexOf(t)];
      Object.keys(r).forEach((k) => r[k].forEach((v, c) => { reihe = Math.max(reihe, Math.abs(v - b[k][c])); }));
    });
    check(max < 1e-9 && reihe < 1e-6,
      `${name}: dasselbe Skelett wie vorher (${max.toExponential(1)}) und in jeder Reihenfolge (${reihe.toExponential(1)})`);
  });
}

console.log(`\n${fails ? fails + " FEHLER" : "alle Prüfungen bestanden"}`);
