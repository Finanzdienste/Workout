/*
 * Bewegungsabläufe als drehbare 3D-Figur.
 *
 * Statt fester Punkte hält eine Stellung nur Gelenkwinkel; daraus rechnet
 * solve() das Skelett. Das ist nicht bloß kürzer, sondern hält die Figur
 * anatomisch beisammen: ein Knie kann nicht versehentlich neben der Hüfte
 * landen, und dieselbe Stellung stimmt aus jedem Blickwinkel.
 *
 * Koordinaten: x nach rechts, y nach oben, z nach vorn (zum Betrachter); die
 * Figur schaut nach +z. Gezeichnet wird mit schwacher Perspektive und
 * Maleralgorithmus – was hinten liegt, kommt zuerst. Ziehen dreht frei:
 * waagerecht um die Hochachse, senkrecht um die Querachse, beides unbegrenzt.
 * Auch Boden und Klimmzugstange liegen im Raum und kippen deshalb mit.
 *
 * Winkel in Grad:
 *   lean      Rumpfneigung nach vorn
 *   lie       'supine' oder 'prone' – Figur liegt, Kopf links
 *   tilt      Neigung der liegenden Figur, + hebt das Fußende
 *   arm.p     Schulter nach vorn (0 = Arm hängt)
 *   arm.a     Arm zur Seite abgespreizt
 *   arm.e     Ellenbogen gebeugt
 *   arm.i     Unterarm zur Körpermitte gedreht (beidhändiger Griff)
 *   leg.p     Hüfte gebeugt (Knie nach vorn)
 *   leg.a     Bein zur Seite
 *   leg.k     Knie gebeugt (Ferse nach hinten)
 */

const RIG = {
  hipW: 0.10, shoulderW: 0.215, shoulderY: 0.42,
  chestY: 0.28, neckY: 0.47, headY: 0.63, headR: 0.115,
  upperArm: 0.27, foreArm: 0.25, hand: 0.06,
  thigh: 0.44, shin: 0.42, foot: 0.15,
};

const rad = (d) => (d * Math.PI) / 180;
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (v, s) => [v[0] * s, v[1] * s, v[2] * s];

function rotX(v, deg) {
  const c = Math.cos(rad(deg)); const s = Math.sin(rad(deg));
  return [v[0], v[1] * c - v[2] * s, v[1] * s + v[2] * c];
}
function rotY(v, deg) {
  const c = Math.cos(rad(deg)); const s = Math.sin(rad(deg));
  return [v[0] * c + v[2] * s, v[1], -v[0] * s + v[2] * c];
}
function rotZ(v, deg) {
  const c = Math.cos(rad(deg)); const s = Math.sin(rad(deg));
  return [v[0] * c - v[1] * s, v[0] * s + v[1] * c, v[2]];
}

/** Punkt zwischen zwei projizierten Punkten. */
const mixPt = (p, q, f) => ({
  x: p.x + (q.x - p.x) * f, y: p.y + (q.y - p.y) * f, z: p.z + (q.z - p.z) * f,
});

const A = (p = 0, a = 0, e = 0, i = 0) => ({ p, a, e, i });
const L = (p = 0, a = 0, k = 0) => ({ p, a, k });

/** Gelenkpunkte einer Stellung, Hüftmitte im Ursprung. */
function solve(pose) {
  const R = RIG;
  const lean = pose.lean || 0;
  const up = rotX([0, 1, 0], lean);           // Rumpfachse, +lean = nach vorn
  const side = [1, 0, 0];                     // Schulterachse, von lean unberührt

  const hipC = [0, 0, 0];
  const chest = mul(up, R.chestY);
  const neck = mul(up, R.neckY);
  const head = mul(up, R.headY);
  const shoulderMid = mul(up, R.shoulderY);

  const joints = { hipC, chest, neck, head };

  ['L', 'R'].forEach((s) => {
    const sign = s === 'L' ? -1 : 1;

    // Arm: Richtung aus Neigung und Abspreizung, dann Ellenbogen beugen
    const arm = pose[`arm${s}`] || pose.arm || A();
    const shoulder = add(shoulderMid, mul(side, sign * R.shoulderW));
    const upperDir = rotX(rotZ([0, -1, 0], sign * arm.a), -arm.p + lean);
    const elbow = add(shoulder, mul(upperDir, R.upperArm));
    // arm.i dreht den Unterarm zur Körpermitte – nötig, wo beide Hände
    // dasselbe Gerät fassen, etwa die Hantel beim Goblet Squat.
    const foreDir = rotZ(rotX(upperDir, -arm.e), sign * (arm.i || 0));
    const hand = add(elbow, mul(foreDir, R.foreArm));

    // Bein: Hüfte beugen, dann Knie
    const leg = pose[`leg${s}`] || pose.leg || L();
    const hip = add(hipC, mul(side, sign * R.hipW));
    const thighDir = rotX(rotZ([0, -1, 0], sign * leg.a), -leg.p);
    const knee = add(hip, mul(thighDir, R.thigh));
    const shinDir = rotX(thighDir, leg.k);
    const ankle = add(knee, mul(shinDir, R.shin));
    const toe = add(ankle, mul(rotX(shinDir, -80 - leg.k * 0.25), R.foot));

    Object.assign(joints, {
      [`shoulder${s}`]: shoulder, [`elbow${s}`]: elbow, [`hand${s}`]: hand,
      [`hip${s}`]: hip, [`knee${s}`]: knee, [`ankle${s}`]: ankle, [`toe${s}`]: toe,
    });
  });

  // Wadenheben: der Körper steigt, die Zehen bleiben liegen. Nur so sieht man
  // die Ferse abheben – hebt man alles zusammen an, wandert bloß die ganze
  // Figur nach oben und die Bewegung ist unsichtbar.
  if (pose.heel) {
    // stance nennt das Standbein: beim einbeinigen Wadenheben darf nur dessen
    // Zeh liegen bleiben, sonst zieht sich das freie Bein in die Länge.
    const planted = pose.stance ? [`toe${pose.stance}`] : ['toeL', 'toeR'];
    Object.keys(joints).forEach((k) => {
      if (planted.includes(k)) return;
      joints[k] = [joints[k][0], joints[k][1] + pose.heel * 0.16, joints[k][2]];
    });
  }

  // Hinlegen. Früher wurde die stehende Figur mit zwei Winkeln (roll/tilt)
  // schräg gedreht, bis sie aus einem bestimmten Blickwinkel lag – aus jedem
  // anderen sah sie umgekippt aus. Jetzt ist es eine echte Lage: die Längsachse
  // des Körpers zeigt nach links (Kopf links, Füße rechts), der Bauch nach oben
  // (Rücklage) oder nach unten (Bauchlage).
  if (pose.lie) {
    const belly = pose.lie === 'prone' ? 90 : -90;
    Object.keys(joints).forEach((k) => { joints[k] = rotX(rotZ(joints[k], 90), belly); });
  }
  // Neigung der ganzen Figur um die Blickachse: bei liegenden Übungen hebt ein
  // positiver Wert das Fußende, so entsteht die Brücke beim Hip Thrust.
  if (pose.tilt) {
    Object.keys(joints).forEach((k) => { joints[k] = rotZ(joints[k], pose.tilt); });
  }
  return joints;
}

/* ------------------------------------------------------------------ *
 * Stellungen – je Muster Start und Ende
 * ------------------------------------------------------------------ */

export const PATTERNS = {
  // Ruhig stehende Figur ohne Bewegung – Grundlage für die Verletzungskarte.
  // Die Arme stehen etwas ab, sonst verschwindet die Schultermarke im Rumpf.
  stand: {
    label: 'Körper', float: false,
    poses: [
      { lean: 2, arm: A(4, 14, 8), leg: L(2, 4, 3) },
      { lean: 2, arm: A(4, 14, 8), leg: L(2, 4, 3) },
    ],
  },
  squat: {
    label: 'Kniebeuge',
    poses: [
      // lean unten bewusst moderat: mit 42° klappte die Figur zusammen und der
      // Kopf stand auf Kniehöhe. Beim Goblet Squat bleibt der Rumpf aufrecht.
      { lean: 6, arm: A(26, -18, 130, 32), leg: L(2, 5, 4) },
      { lean: 24, arm: A(34, -18, 126, 32), leg: L(100, 9, 118) },
    ],
  },
  legcurl: {
    // Rücken am Boden, Hüfte oben, Fersen ziehen heran
    label: 'Beinbeuger', lie: 'supine', view: [20, -30],
    poses: [
      // arm.p 0: die Arme liegen längs am Körper. Mit Beugung schwebten sie
      // sichtbar über dem Rumpf.
      { tilt: 20, arm: A(0, 17, 6), leg: L(4, 6, 12) },
      { tilt: 30, arm: A(0, 17, 6), leg: L(18, 6, 94) },
    ],
  },
  thrust: {
    // Schultern am Boden, Hüfte hoch bis Rumpf und Oberschenkel eine Linie sind
    // Der Blickwinkel muss zwei Dinge zugleich schaffen: Die Stange über der
    // Hüfte soll waagerecht liegen, und der Körper soll der Länge nach zu
    // sehen sein. Bei yaw 20 / pitch -30 lief die Stange schräg durch den
    // Körper; bei yaw 62 stand die ferne Scheibe neben dem Kopf. Von der Seite
    // her verschwindet sie hinter dem Körper – genau so sieht ein Hip Thrust
    // in Wirklichkeit aus.
    label: 'Hüftstreckung', lie: 'supine', view: [30, -8],
    poses: [
      { tilt: 8, arm: A(0, 17, 8), leg: L(40, 8, 102) },
      { tilt: 32, arm: A(0, 17, 8), leg: L(2, 8, 98) },
    ],
  },
  pushup: {
    label: 'Liegestütz', lie: 'prone',
    poses: [
      // tilt senkt das Fußende, bis Hände und Zehen zugleich den Boden
      // berühren – ohne das schweben die Füße in der Luft.
      { tilt: -16, arm: A(90, 16, 4), leg: L(0, 6, 4) },
      { tilt: -16, arm: A(64, 42, 80), leg: L(0, 6, 4) },
    ],
  },
  press: {
    label: 'Drücken im Liegen', lie: 'supine', view: [20, -30],
    poses: [
      { arm: A(72, 42, 92), leg: L(56, 9, 100) },
      { arm: A(90, 10, 4), leg: L(56, 9, 100) },
    ],
  },
  pressbar: {
    // Dasselbe im Liegen, aber an der Stange: Die Abspreizung bleibt oben wie
    // unten gleich. Beim Kurzhantelmuster wandern die Hände oben zusammen –
    // mit einer Stange in beiden Händen sähe das aus, als würde sie schrumpfen.
    // Weiter herumgedreht als beim Kurzhantelmuster, damit die Stange quer im
    // Bild liegt statt schräg durch den Brustkorb – aber nicht so weit, dass
    // die ferne Scheibe über dem Kopf landet.
    // Die Abspreizung bestimmt zugleich die Griffweite: Die Hand sitzt bei
    // 0,215 + 0,52·sin(a) von der Mitte, die Scheibe bei 0,56. Mit 40° lagen
    // die Hände genau an den Scheiben – so greift niemand eine Stange. 15°
    // ergibt gut anderthalb Schulterbreiten, also den üblichen Bankdrückgriff,
    // und lässt links und rechts ein Stück Stange stehen.
    label: 'Drücken im Liegen an der Stange', lie: 'supine', view: [35, -10],
    poses: [
      { arm: A(74, 15, 96), leg: L(56, 9, 100) },
      { arm: A(88, 15, 6), leg: L(56, 9, 100) },
    ],
  },
  row: {
    // Einarmig vorgebeugt: die andere Hand stützt sich ab
    label: 'Rudern',
    poses: [
      // armL stützt senkrecht ab (p = lean, also Arm lotrecht), armR hängt erst
      // ebenso und zieht dann den Ellenbogen nach hinten an den Rumpf.
      // lean 62 statt 72: fast waagerecht hing der Kopf tief unter den Schultern
      // und die Figur sah aus, als würde sie nach vorn kippen.
      { lean: 62, armL: A(62, 10, 10), armR: A(62, 8, 6), leg: L(20, 6, 24) },
      { lean: 62, armL: A(62, 10, 10), armR: A(2, 10, 94), leg: L(20, 6, 24) },
    ],
  },
  rowbar: {
    // Beidarmig vorgebeugt an der Langhantel. Dieselbe Rumpfneigung wie beim
    // einarmigen Rudern – nur stützt sich hier nichts ab, beide Arme ziehen.
    // Genau das ist auch der Unterschied für den unteren Rücken: Er hält die
    // Neigung allein, ohne die abgestützte Hand.
    //
    // Die Hüfte steht dabei hinten, wie bei der Hüftbeuge: Ohne das sieht die
    // Neigung aus wie ein Bücken aus dem Rücken. leg.p 20 schiebt das Knie vor
    // die Hüfte, leg.k 24 stellt das Schienbein wieder senkrecht.
    label: 'Langhantelrudern', view: [24, -6],
    poses: [
      { lean: 62, arm: A(62, 8, 6), leg: L(20, 6, 24) },
      { lean: 62, arm: A(2, 10, 94), leg: L(20, 6, 24) },
    ],
  },
  pullup: {
    label: 'Klimmzug', anchor: 'bar', bar: true, float: true,
    // arm.p etwas über 180: die Arme greifen nach oben und leicht nach hinten,
    // damit der Kopf davor liegt und nicht dahinter verschwindet.
    poses: [
      { arm: A(184, 17, 6), leg: L(8, 6, 20) },
      // Oben zeigt der Oberarm nach unten-vorn, der Ellenbogen liegt am Rumpf.
      // Mit einem Wert nahe 180 stand er über der Schulter ab wie ein Flügel.
      { arm: A(46, 20, 148), leg: L(26, 6, 38) },
    ],
  },
  pullupwide: {
    // Derselbe Zug im weiten Obergriff. Eigenes Muster, weil Chin-ups und
    // Pull-ups in derselben Einheit direkt untereinander stehen – zweimal
    // dieselbe Animation daneben sagt nichts über den Unterschied.
    // Der Unterschied steckt in der Abspreizung: die Hände greifen weiter
    // außen, der Ellenbogen wandert nach unten statt an den Rumpf.
    label: 'Klimmzug im Obergriff', anchor: 'bar', bar: true, float: true,
    poses: [
      { arm: A(178, 42, 6), leg: L(8, 6, 20) },
      { arm: A(74, 58, 128), leg: L(26, 6, 38) },
    ],
  },
  pike: {
    // Umgekehrtes V: Hüfte ist der höchste Punkt, Hände und Füße am Boden,
    // der Kopf senkt sich zwischen die Hände. Die Arme zeigen senkrecht nach
    // unten, dafür muss arm.p der Rumpfneigung folgen (-p + lean = 0).
    label: 'Überkopf-Drücken',
    poses: [
      // lean 146 legte den Kopf zwischen die Hände auf den Boden. Bei 126 ist
      // die Hüfte klar der höchste Punkt und der Kopf bleibt darüber.
      { lean: 126, arm: A(132, 10, 4), leg: L(-30, 6, 10) },
      { lean: 126, arm: A(112, 30, 76), leg: L(-30, 6, 10) },
    ],
  },
  ohp: {
    // Sitzend aus der Ablage senkrecht nach oben. Die Abspreizung bleibt unter
    // 90°, weil der Ellenbogen nur in der Längsebene beugt – ganz zur Seite
    // abgespreizt wäre von der Beugung nichts zu sehen.
    label: 'Schulterdrücken', seat: true,
    poses: [
      { lean: 4, arm: A(10, 58, 104), leg: L(88, 8, 92) },
      { lean: 4, arm: A(6, 166, 8), leg: L(88, 8, 92) },
    ],
  },
  hinge: {
    // Hüftbeuge: die Knie bleiben fast gestreckt, der Rumpf kippt nach vorn.
    // Die Arme hängen dabei lotrecht – dafür muss arm.p der Rumpfneigung
    // folgen (-p + lean = 0), sonst schwingen die Hanteln nach vorn weg.
    //
    // **Das Gesäß muss nach hinten.** Vorher stand das Bein fast senkrecht
    // (leg.p 8) und nur der Rumpf kippte – das sieht aus, als käme die Bewegung
    // aus dem Rücken, und genau so wurde es auch gelesen. Beim Kreuzheben
    // wandert die Hüfte nach hinten, während das Schienbein senkrecht bleibt:
    // leg.p 26 dreht den Oberschenkel so, dass das Knie vor der Hüfte steht,
    // leg.k 24 stellt das Schienbein wieder senkrecht. Damit liegt die Hüfte
    // rund eine Fußlänge hinter den Knöcheln – das ist der Unterschied zwischen
    // einer Hüftbeuge und einem Bücken.
    label: 'Hüftbeuge', view: [24, -6],
    poses: [
      { lean: 4, arm: A(4, 9, 4), leg: L(4, 5, 8) },
      { lean: 68, arm: A(68, 9, 4), leg: L(26, 5, 24) },
    ],
  },
  hinge1: {
    // Einbeinig: das freie Bein steigt nach hinten, bis Rumpf und Bein eine
    // Linie bilden. stance nennt das Standbein. Dieselbe Hüfte nach hinten wie
    // oben, nur weniger – auf einem Bein geht das Gegengewicht ins Standbein.
    label: 'Hüftbeuge einbeinig', stance: 'R', view: [38, -6],
    poses: [
      { lean: 4, arm: A(4, 9, 4), legR: L(4, 5, 8), legL: L(-6, 7, 14) },
      { lean: 74, arm: A(74, 9, 4), legR: L(18, 5, 20), legL: L(-70, 7, 10) },
    ],
  },
  splitsquat: {
    // Ein Bein vorn, eines hinten, beide Knie beugen. Der Rumpf bleibt
    // aufrecht – kippt er mit, wird daraus optisch eine Kniebeuge.
    label: 'Ausfallschritt', view: [42, -6],
    poses: [
      { lean: 5, arm: A(5, 9, 4), legR: L(16, 6, 12), legL: L(-18, 7, 26) },
      { lean: 9, arm: A(9, 9, 4), legR: L(62, 6, 74), legL: L(-30, 7, 106) },
    ],
  },
  kneeraise: {
    // An der Stange hängend: nur die Beine arbeiten, die Arme bleiben oben.
    label: 'Knieheben', anchor: 'bar', bar: true, float: true,
    poses: [
      { arm: A(184, 17, 6), leg: L(4, 6, 14) },
      { arm: A(184, 17, 6), leg: L(96, 6, 108) },
    ],
  },
  pullapart: {
    // Arme vorn auf Schulterhöhe, dann zur Seite auseinander. Der Rumpf bleibt
    // stehen – zieht er mit, wird daraus ein Rudern.
    // band: 'hands' – hier hält man das Band wirklich zwischen beiden Händen,
    // anders als bei allen übrigen Bandübungen, wo man darauf steht.
    label: 'Band auseinanderziehen', band: 'hands', view: [16, -6],
    poses: [
      { lean: 3, arm: A(86, 8, 8), leg: L(2, 5, 4) },
      { lean: 3, arm: A(8, 86, 8), leg: L(2, 5, 4) },
    ],
  },
  curl: {
    label: 'Bizeps-Curl',
    poses: [
      { lean: 3, arm: A(4, 8, 6), leg: L(2, 5, 4) },
      { lean: 3, arm: A(12, 8, 126), leg: L(2, 5, 4) },   // oben auf Brusthöhe, nicht am Kinn
    ],
  },
  triceps: {
    // Oberarm bleibt senkrecht stehen, nur der Ellenbogen arbeitet
    label: 'Trizeps-Strecken', lie: 'supine', view: [20, -30],
    poses: [
      { arm: A(84, 8, 112), leg: L(56, 9, 100) },
      { arm: A(90, 8, 4), leg: L(56, 9, 100) },
    ],
  },
  tricepsoh: {
    // Sitzend, Oberarme senkrecht neben den Ohren: Nur der Ellenbogen arbeitet,
    // die Schulter hält. Der lange Trizepskopf kreuzt sie mit – unten hinter dem
    // Kopf steht er auf voller Länge, und genau dort wächst er.
    // Die Abspreizung bleibt knapp unter 180°, sonst deckt der Kopf den Weg der
    // Hantel und von der Beugung ist nichts mehr zu sehen.
    label: 'Überkopf-Strecken', seat: true, view: [24, -8],
    poses: [
      { lean: 4, arm: A(8, 164, 132), leg: L(88, 8, 92) },
      { lean: 4, arm: A(6, 170, 6), leg: L(88, 8, 92) },
    ],
  },
  lateral: {
    // Sitzend: Hüfte und Knie rechtwinklig, dazu eine Bank unter dem Gesäß.
    // Ohne die stünde die Figur nur mit angewinkelten Beinen in der Luft.
    label: 'Seitheben', seat: true,
    poses: [
      { lean: 4, arm: A(6, 10, 10), leg: L(88, 8, 92) },
      { lean: 4, arm: A(6, 92, 10), leg: L(88, 8, 92) },
    ],
  },
  reversefly: {
    // Wie beim Pull-Apart: Das Band liegt zwischen den Händen, nicht unter dem Fuß.
    label: 'Reverse Fly', band: 'hands',
    poses: [
      { lean: 76, arm: A(76, 8, 10), leg: L(26, 6, 30) },
      { lean: 76, arm: A(76, 88, 12), leg: L(26, 6, 30) },
    ],
  },
  crunch: {
    // Arme halten die Scheibe vor der Brust, der Rumpf rollt ein Stück auf
    label: 'Crunch', lie: 'supine', view: [20, -30],
    poses: [
      // Unterarme längs am Rumpf statt quer darüber: eng gefaltet verdeckten
      // sie die Scheibe und alles verschmolz zu einem Knäuel.
      { lean: 0, arm: A(46, -6, 120, 26), leg: L(58, 9, 104) },
      { lean: 34, arm: A(46, -6, 120, 26), leg: L(58, 9, 104) },
    ],
  },
  legcurl1: {
    // Einbeinig: das freie Bein bleibt angewinkelt in der Luft
    label: 'Beinbeuger einbeinig', lie: 'supine', view: [20, -30],
    poses: [
      { tilt: 20, arm: A(0, 17, 6), legR: L(4, 6, 12), legL: L(62, 10, 92) },
      { tilt: 30, arm: A(0, 17, 6), legR: L(18, 6, 94), legL: L(62, 10, 92) },
    ],
  },
  thrust1: {
    label: 'Hüftstreckung einbeinig', lie: 'supine', view: [20, -30],
    poses: [
      { tilt: 8, arm: A(0, 17, 8), legR: L(40, 8, 102), legL: L(96, 12, 94) },
      { tilt: 32, arm: A(0, 17, 8), legR: L(2, 8, 98), legL: L(78, 12, 92) },
    ],
  },
  calf1: {
    // Ein Bein trägt, das andere hängt angewinkelt hinten
    label: 'Wadenheben einbeinig', stance: 'R',
    poses: [
      // Knie nach hinten, nicht nach vorn – sonst sieht es aus wie ein Ausfallschritt
      { lean: 2, arm: A(4, 8, 8), legR: L(2, 5, 4), legL: L(-26, 8, 88), heel: 0 },
      { lean: 2, arm: A(4, 8, 8), legR: L(2, 5, 4), legL: L(-26, 8, 88), heel: 1 },
    ],
  },
  pushupfeet: {
    // Füße erhöht: positiver tilt hebt das Fußende, dazu ein Kasten darunter
    label: 'Liegestütz mit erhöhten Füßen', lie: 'prone', step: true,
    poses: [
      { tilt: 8, arm: A(90, 16, 4), leg: L(0, 6, 4) },
      { tilt: 8, arm: A(64, 42, 80), leg: L(0, 6, 4) },
    ],
  },
  calfbent: {
    // Mit gebeugtem Knie: trifft den flachen Wadenmuskel statt der Zwillingswade.
    // Von vorn ist die Kniebeugung nicht zu sehen – der ganze Unterschied zur
    // Schwesterübung verschwindet dann. Deshalb von der Seite.
    label: 'Wadenheben, gebeugtes Knie', view: [62, 6],
    poses: [
      // Rumpf aufrecht, nur das Knie beugt. Mit Hüftbeugung wurde daraus eine
      // halbe Kniebeuge und vom Wadenheben war nichts mehr zu sehen.
      { lean: 4, arm: A(4, 8, 8), leg: L(14, 6, 34), heel: 0 },
      { lean: 4, arm: A(4, 8, 8), leg: L(14, 6, 34), heel: 1 },
    ],
  },
  squatbw: {
    // Ohne Hantel greifen die Hände nichts – die Arme gehen zum Ausgleich nach
    // vorn. Mit der Goblet-Haltung sah es aus, als hielte die Figur eine
    // unsichtbare Hantel.
    label: 'Kniebeuge ohne Gewicht',
    poses: [
      { lean: 6, arm: A(22, 10, 16), leg: L(2, 5, 4) },
      { lean: 30, arm: A(118, 10, 12), leg: L(100, 9, 118) },
    ],
  },
  invrow: {
    // Unter einer niedrigen Stange, Körper gerade, Brust zur Stange. Die Hände
    // bleiben an der Stange, der Körper dreht sich um die Fersen nach oben.
    label: 'Inverted Row', lie: 'supine', anchor: 'bar', barY: 0.04, bar: true,
    poses: [
      { tilt: -20, arm: A(92, 14, 8), leg: L(-2, 6, 4) },
      { tilt: -27, arm: A(58, 32, 88), leg: L(-2, 6, 4) },
    ],
  },
  tricepsbar: {
    // Schräg stehend, Hände auf einer niedrigen Stange. Nur der Ellenbogen
    // arbeitet, der Kopf senkt sich unter die Stange.
    label: 'Trizeps an der Stange', anchor: 'bar', barY: 0.02, bar: true,
    // leg.p spiegelt lean: nur so bleibt der Körper eine gerade Linie von den
    // Fersen bis zum Kopf. Mit senkrechten Beinen wurde daraus ein Hüftknick.
    poses: [
      { lean: 50, arm: A(50, 12, 6), leg: L(-50, 6, 4) },
      { lean: 62, arm: A(40, 16, 96), leg: L(-62, 6, 4) },
    ],
  },
  snowangel: {
    // Bauchlage, Arme angehoben, vom Kopf bis zur Hüfte und zurück
    label: 'Reverse Snow Angel', lie: 'prone',
    poses: [
      // Brust deutlich angehoben: liegt der Rumpf flach, liegen auch die Arme
      // am Boden und von der Bewegung ist nichts zu sehen.
      { lean: -24, arm: A(164, 32, 10), leg: L(0, 6, 4) },
      { lean: -24, arm: A(26, 46, 10), leg: L(0, 6, 4) },
    ],
  },
  calf: {
    label: 'Wadenheben',
    poses: [
      { lean: 2, arm: A(4, 8, 8), leg: L(2, 5, 4), heel: 0 },
      { lean: 2, arm: A(4, 8, 8), leg: L(2, 5, 4), heel: 1 },
    ],
  },
};


const NS = 'http://www.w3.org/2000/svg';
const CYCLE_MS = 4200;   // eine Wiederholung; das Tempo darin ist unsymmetrisch
const el = (name, attrs = {}) => {
  const node = document.createElementNS(NS, name);
  Object.entries(attrs).forEach(([k, v]) => node.setAttribute(k, v));
  return node;
};

const active = new Set();

/**
 * Nur zeichnen, was zu sehen ist.
 *
 * In der Übungsliste können acht Karten gleichzeitig offen stehen, und jede
 * hat ihre Figur. Alle acht in jedem Bild neu zu zeichnen kostete auf einem
 * gedrosselten Gerät jede zehnte Bildwiedergabe – sichtbar als Ruckeln beim
 * Scrollen, für Figuren, die gerade gar nicht im Bild sind. Ein Beobachter
 * schaltet die Unsichtbaren ab; `sichtbar` bleibt true, wo es den Beobachter
 * nicht gibt, damit die Figur dort nicht stillsteht.
 */
const sichtbarkeit = typeof IntersectionObserver === 'function'
  ? new IntersectionObserver((eintraege) => {
    eintraege.forEach((e) => {
      const entry = e.target.__figEntry;
      if (entry) entry.sichtbar = e.isIntersecting;
    });
  }, { rootMargin: '80px' })
  : null;

/* ------------------------------------------------------------------ *
 * Stellen am Körper
 *
 * Für die Verletzungskarte: ein Name wie 'knie' muss zu Punkten im Raum
 * werden. Alles, was es doppelt gibt, wird auch doppelt markiert – der Plan
 * unterscheidet die Seiten nicht, und eine einseitige Marke würde eine
 * Genauigkeit vortäuschen, die nicht dahintersteckt.
 * ------------------------------------------------------------------ */

const between = (a, b, t) => [0, 1, 2].map((i) => a[i] + (b[i] - a[i]) * t);

export const SPOTS = {
  shoulder: (j) => [j.shoulderL, j.shoulderR],
  upperArm: (j) => [between(j.shoulderL, j.elbowL, 0.3), between(j.shoulderR, j.elbowR, 0.3)],
  elbow: (j) => [j.elbowL, j.elbowR],
  wrist: (j) => [between(j.elbowL, j.handL, 0.86), between(j.elbowR, j.handR, 0.86)],
  hand: (j) => [j.handL, j.handR],
  neck: (j) => [j.neck],
  chest: (j) => [j.chest],
  ribs: (j) => [between(j.chest, j.hipC, 0.35)],
  abs: (j) => [between(j.chest, j.hipC, 0.62)],
  lowerBack: (j) => [between(j.hipC, j.chest, 0.24)],
  pelvis: (j) => [j.hipC],
  groin: (j) => [between(j.hipC, between(j.kneeL, j.kneeR, 0.5), 0.16)],
  hip: (j) => [j.hipL, j.hipR],
  knee: (j) => [j.kneeL, j.kneeR],
  hamstring: (j) => [between(j.hipL, j.kneeL, 0.55), between(j.hipR, j.kneeR, 0.55)],
  calf: (j) => [between(j.kneeL, j.ankleL, 0.38), between(j.kneeR, j.ankleR, 0.38)],
  shin: (j) => [between(j.kneeL, j.ankleL, 0.5), between(j.kneeR, j.ankleR, 0.5)],
  achilles: (j) => [between(j.kneeL, j.ankleL, 0.9), between(j.kneeR, j.ankleR, 0.9)],
  ankle: (j) => [j.ankleL, j.ankleR],
};

/** Schwache Perspektive: weiter hinten = kleiner. */
function project(p, yaw, pitch, scale, cx, cy) {
  const r = rotX(rotY(p, yaw), pitch);
  const f = 3.4;
  const k = f / (f - r[2]);
  return { x: cx + r[0] * scale * k, y: cy - r[1] * scale * k, z: r[2], k };
}

export function mountFigure(host, pattern, weight, equip, marks = []) {
  const spec = PATTERNS[pattern];
  host.textContent = '';
  if (!spec) return () => {};

  // Sichtfeld in der Form des Kastens: bei festem Quadrat blieb links und
  // rechts breiter Rand ungenutzt, und die Figur wirkte verloren.
  const box = host.getBoundingClientRect();
  const VBW = 100;
  const VBH = box.width > 0 ? Math.max(50, Math.min(160, Math.round((100 * box.height) / box.width))) : 100;
  // Mit Verletzungsmarken wird der Körper neutral gefärbt – sonst hebt sich
  // die Marke nicht ab, beides wäre in der Akzentfarbe.
  // Für Screenreader ist die Figur nichts wert: Sie besteht aus zwei Dutzend
  // namenlosen Formen, und was sie zeigt, steht als Text direkt daneben. Ohne
  // aria-hidden liest die Sprachausgabe hier eine Grafik nach der anderen vor,
  // ohne je etwas zu sagen.
  const svg = el('svg', {
    viewBox: `0 0 ${VBW} ${VBH}`,
    class: marks.length ? 'fig hurt-mode' : 'fig',
    'aria-hidden': 'true',
  });
  const scene = el('g');
  svg.appendChild(scene);
  host.appendChild(svg);

  // In den kleinen Verletzungskarten ist für den Hinweis kein Platz; dort
  // steht er im Fließtext daneben.
  const hint = document.createElement('span');
  hint.className = 'fig-hint';
  hint.textContent = '↕↔ ziehen zum Drehen';
  hint.setAttribute('aria-hidden', 'true');   // Drehen geht nur mit dem Finger
  if (!host.classList.contains('no-hint')) host.appendChild(hint);

  // Dreiviertelansicht steht der stehenden Figur am besten. Eine liegende ist
  // von der Seite dagegen zwangsläufig ein Strich – Rumpf, Arme und Beine
  // liegen in einer Linie. Dort schaut die Kamera von schräg oben auf den
  // Körper, dann trennen sich die Glieder wieder.
  let yaw = spec.view ? spec.view[0] : 25;
  let pitch = spec.view ? spec.view[1] : 8;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  let lastT = 0;         // zuletzt gezeichneter Punkt der Bewegung

  const onDown = (e) => {
    dragging = true;
    const t = e.touches ? e.touches[0] : e;
    lastX = t.clientX;
    lastY = t.clientY;
    hint.classList.add('gone');
    e.preventDefault();
  };
  const onMove = (e) => {
    if (!dragging) return;
    const t = e.touches ? e.touches[0] : e;
    yaw = (yaw + (t.clientX - lastX) * 0.6) % 360;
    pitch = (pitch + (t.clientY - lastY) * 0.6) % 360;   // bewusst ohne Grenze
    lastX = t.clientX;
    lastY = t.clientY;
    draw(lastT);   // sofort neu zeichnen, statt auf die Animation zu warten
    e.preventDefault();
  };
  const onUp = () => { dragging = false; };

  host.addEventListener('pointerdown', onDown);
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);

  const [a, b] = spec.poses;
  const blend = (t) => {
    const mix = (x, y) => x + (y - x) * t;
    const mixA = (x = A(), y = A()) => A(mix(x.p, y.p), mix(x.a, y.a), mix(x.e, y.e), mix(x.i || 0, y.i || 0));
    const mixL = (x = L(), y = L()) => L(mix(x.p, y.p), mix(x.a, y.a), mix(x.k, y.k));
    return {
      lie: spec.lie,                       // Lage gilt fürs ganze Muster
      stance: spec.stance,
      lean: mix(a.lean || 0, b.lean || 0),
      tilt: mix(a.tilt || 0, b.tilt || 0),
      heel: mix(a.heel || 0, b.heel || 0),
      armL: mixA(a.armL || a.arm, b.armL || b.arm),
      armR: mixA(a.armR || a.arm, b.armR || b.arm),
      legL: mixL(a.legL || a.leg, b.legL || b.leg),
      legR: mixL(a.legR || a.leg, b.legR || b.leg),
    };
  };

  /** Skelett einer Stellung, schon auf den Boden gesetzt. */
  const skeleton = (t) => {
    const j = solve(blend(t));
    // An der Stange festhalten oder auf den Boden setzen. Beim Griff an eine
    // Stange bleiben die Hände stehen und der Körper bewegt sich – andersherum
    // wanderte die Stange mit den Händen mit, was sofort als Fehler auffällt.
    if (spec.anchor === 'bar') {
      const barY = spec.barY === undefined ? 0.52 : spec.barY;
      const hand = [0, 1, 2].map((i) => (j.handL[i] + j.handR[i]) / 2);
      const d = [-hand[0], barY - hand[1], -hand[2]];
      Object.keys(j).forEach((k) => { j[k] = [j[k][0] + d[0], j[k][1] + d[1], j[k][2] + d[2]]; });
      return j;
    }
    const shift = -Math.min(...Object.values(j).map((q) => q[1])) - 0.62;
    Object.keys(j).forEach((k) => { j[k] = [j[k][0], j[k][1] + shift, j[k][2]]; });
    return j;
  };

  // Ausschnitt einmal für das ganze Muster festlegen, aus beiden Endstellungen.
  // Eine feste Größe ließ liegende Übungen klein in einem halbleeren Kasten
  // stehen; ein Maß je Einzelbild würde die Figur beim Abspielen atmen lassen.
  // Radius statt Rechteck, damit auch das Drehen nichts daran ändert.
  const fit = (() => {
    const all = [skeleton(0), skeleton(1)].flatMap((j) => Object.values(j));
    const mid = [0, 1, 2].map((i) => (Math.min(...all.map((q) => q[i])) + Math.max(...all.map((q) => q[i]))) / 2);
    // Radius statt Rechteck: so ändert das Drehen die Größe nicht, und die
    // Figur kann in keiner Lage über den Rand ragen.
    const r = Math.max(...all.map((q) => Math.hypot(q[0] - mid[0], q[1] - mid[1], q[2] - mid[2])));
    // Bodenhöhe einmal aus der Startstellung: bei einem Griff an die Stange
    // liegt der Körper nicht mehr fest auf dem Boden auf, der Boden darf aber
    // trotzdem nicht bei jedem Einzelbild auf und ab wandern.
    const groundY = Math.min(...Object.values(skeleton(0)).map((q) => q[1]));
    return { mid, groundY, scale: (Math.min(VBW, VBH) / 2) * 0.94 / Math.max(r, 0.1) };
  })();
  const gearScale = fit.scale / 40;

  const draw = (t) => {
    lastT = t;
    const pose = blend(t);
    const j = skeleton(t);

    scene.textContent = '';
    const P = (p) => project(
      [p[0] - fit.mid[0], p[1] - fit.mid[1], p[2] - fit.mid[2]], yaw, pitch, fit.scale, VBW / 2, VBH / 2,
    );
    const pts0 = j;   // Weltkoordinaten, für die Ausrichtung der Geräte
    const pts = {};
    Object.entries(j).forEach(([k, v]) => { pts[k] = P(v); });

    const parts = [];

    // Achsen des Skeletts selbst – schon gedreht und gekippt, anders als eine
    // nachgerechnete Näherung. Rumpf und Gerät richten sich danach aus.
    const norm = (v) => {
      const n = Math.hypot(v[0], v[1], v[2]) || 1;
      return [v[0] / n, v[1] / n, v[2] / n];
    };
    const midOf = (a2, b2) => [(a2[0] + b2[0]) / 2, (a2[1] + b2[1]) / 2, (a2[2] + b2[2]) / 2];
    const sideAxis = norm([j.shoulderR[0] - j.shoulderL[0], j.shoulderR[1] - j.shoulderL[1], j.shoulderR[2] - j.shoulderL[2]]);
    const upAxis = norm([j.neck[0] - j.hipC[0], j.neck[1] - j.hipC[1], j.neck[2] - j.hipC[2]]);
    // Blickrichtung des Rumpfes: gilt auch im Liegen, wo "vorn" nicht mehr zum
    // Betrachter zeigt.
    const frontAxis = norm([
      sideAxis[1] * upAxis[2] - sideAxis[2] * upAxis[1],
      sideAxis[2] * upAxis[0] - sideAxis[0] * upAxis[2],
      sideAxis[0] * upAxis[1] - sideAxis[1] * upAxis[0],
    ]);

    // Tiefe als Helligkeit: was hinten liegt, wird etwas dunkler. Der
    // Maleralgorithmus allein sagt nur, was verdeckt – nicht, was weiter weg
    // ist; bei gedrehter Figur überlagern sich sonst gleich helle Glieder.
    const depth = (z) => (0.74 + 0.26 * Math.min(1, Math.max(0, (z + 0.9) / 1.8))).toFixed(3);

    /**
     * Gliedmaße als eine einzige Fläche: von w1 auf w2 verjüngt, an beiden
     * Enden halbrund. Ein gleich dicker Strich sieht aus wie ein
     * Strichmännchen – ein Muskel wird zum Gelenk hin schmaler.
     *
     * Bewusst ein Pfad und nicht Viereck plus zwei Kreise: nur so lässt sich
     * eine Trennlinie außen herum ziehen, ohne dass innen Nähte auftauchen.
     */
    const limb = (from, to, w1, w2, cls = 'fig-limb') => {
      const dx = to.x - from.x; const dy = to.y - from.y;
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len; const ny = dx / len;
      const a = Math.max(0.4, w1 * gearScale * from.k);
      const b = Math.max(0.4, w2 * gearScale * to.k);
      const f = (v) => v.toFixed(1);
      const d = `M${f(from.x + nx * a)} ${f(from.y + ny * a)}`
        + ` A${f(a)} ${f(a)} 0 0 1 ${f(from.x - nx * a)} ${f(from.y - ny * a)}`
        + ` L${f(to.x - nx * b)} ${f(to.y - ny * b)}`
        + ` A${f(b)} ${f(b)} 0 0 1 ${f(to.x + nx * b)} ${f(to.y + ny * b)} Z`;
      const z = (from.z + to.z) / 2;
      parts.push({ z, node: el('path', { d, class: cls, opacity: depth(z) }) });
    };

    // Rumpf als Körper mit Tiefe. Eine einzelne Fläche zwischen Schultern und
    // Hüften war von der Seite papierdünn und hatte keine Taille. Drei Ringe
    // (Schulter, Taille, Becken) aus je vier Ecken ergeben einen Rumpf, der aus
    // jeder Richtung Volumen hat.
    const ring = (centre, w, d) => [[1, 1], [1, -1], [-1, -1], [-1, 1]]
      .map(([a2, b2]) => P(add(add(centre, mul(sideAxis, a2 * w)), mul(frontAxis, b2 * d))));
    const shoulderMid = midOf(j.shoulderL, j.shoulderR);
    const hipMid = midOf(j.hipL, j.hipR);
    const waistMid = midOf(midOf(shoulderMid, hipMid), hipMid);   // 75 % Richtung Becken
    const rings = [ring(shoulderMid, 0.200, 0.098), ring(waistMid, 0.125, 0.075), ring(hipMid, 0.150, 0.090)];
    const face = (quad) => {
      const z = quad.reduce((acc, q) => acc + q.z, 0) / quad.length;
      parts.push({
        z,
        node: el('polygon', {
          points: quad.map((q) => `${q.x.toFixed(1)},${q.y.toFixed(1)}`).join(' '),
          class: 'fig-torso', opacity: depth(z),
        }),
      });
    };
    face(rings[0]);                                        // Schulterdeckel
    face(rings[2]);                                        // Beckenboden
    [0, 1].forEach((r) => [0, 1, 2, 3].forEach((c) => {
      const d2 = (c + 1) % 4;
      face([rings[r][c], rings[r][d2], rings[r + 1][d2], rings[r + 1][c]]);
    }));
    limb(pts.hipC, pts.neck, 4.2, 3.4, 'fig-spine');
    limb(pts.neck, pts.head, 2.6, 2.2, 'fig-spine');   // Hals schließt die Lücke

    ['L', 'R'].forEach((s) => {
      limb(pts[`shoulder${s}`], pts[`elbow${s}`], 3.4, 2.5);
      limb(pts[`elbow${s}`], pts[`hand${s}`], 2.5, 1.8);
      // Hand als eigener Ballen: sonst hört der Unterarm einfach auf und es
      // ist nicht zu sehen, dass die Figur etwas greift.
      parts.push({
        z: pts[`hand${s}`].z + 0.002,
        node: el('circle', {
          cx: pts[`hand${s}`].x.toFixed(1), cy: pts[`hand${s}`].y.toFixed(1),
          r: (2.4 * gearScale * pts[`hand${s}`].k).toFixed(1),
          class: 'fig-limb', opacity: depth(pts[`hand${s}`].z),
        }),
      });
      limb(pts[`hip${s}`], pts[`knee${s}`], 4.6, 3.1);
      limb(pts[`knee${s}`], pts[`ankle${s}`], 3.1, 1.9);
      limb(pts[`ankle${s}`], pts[`toe${s}`], 1.9, 1.5, 'fig-limb fig-foot');
    });

    // Kopf als Ei entlang der Rumpfachse statt als Kreis
    const headR = RIG.headR * 46 * gearScale * pts.head.k;
    const axis = Math.atan2(pts.head.y - pts.neck.y, pts.head.x - pts.neck.x) * 180 / Math.PI + 90;
    parts.push({
      z: pts.head.z + 0.001,
      node: el('ellipse', {
        cx: pts.head.x.toFixed(1), cy: pts.head.y.toFixed(1),
        rx: (headR * 0.86).toFixed(1), ry: headR.toFixed(1),
        transform: `rotate(${axis.toFixed(1)} ${pts.head.x.toFixed(1)} ${pts.head.y.toFixed(1)})`,
        class: 'fig-head', opacity: depth(pts.head.z),
      }),
    });

    // Gerät, ausgerichtet an den Achsen des Skeletts selbst
    /** Stange samt Scheiben entlang einer Achse im Raum. */
    const barAt = (centre, axis, half, plate) => {
      // Eine Stange ist ein starrer, gerader Gegenstand. Projiziert man ihre
      // Enden einzeln, bekommt das nähere einen größeren Perspektivfaktor als
      // das fernere – bei einer Kurzhantel unsichtbar, bei 1,2 m Langhantel
      // kippt sie sichtbar wie eine Wippe, obwohl sie waagerecht liegt. Beide
      // Enden rechnen deshalb mit dem Faktor der Stangenmitte: Die Verkürzung
      // beim Drehen bleibt, die falsche Neigung verschwindet.
      const c = P(centre);
      const end = (s) => {
        const q = P(add(centre, mul(axis, s * half)));
        return {
          x: VBW / 2 + (q.x - VBW / 2) * (c.k / q.k),
          y: VBH / 2 + (q.y - VBH / 2) * (c.k / q.k),
          z: q.z, k: c.k,
        };
      };
      const e1 = end(-1);
      const e2 = end(1);
      parts.push({
        z: (e1.z + e2.z) / 2,
        node: el('line', {
          x1: e1.x.toFixed(1), y1: e1.y.toFixed(1), x2: e2.x.toFixed(1), y2: e2.y.toFixed(1),
          'stroke-width': (2.2 * gearScale * (e1.k + e2.k) / 2).toFixed(2), class: 'fig-bar',
        }),
      });
      [e1, e2].forEach((q) => parts.push({
        z: q.z + 0.01,
        node: el('circle', { cx: q.x.toFixed(1), cy: q.y.toFixed(1), r: (plate * gearScale * q.k).toFixed(1), class: 'fig-plate' }),
      }));
    };

    if (equip === 'dumbbells') {
      // 0.085 waren 19 cm – so kurz, dass sich die beiden Scheiben aus den
      // meisten Blickwinkeln zu einem einzigen Fleck überdeckten.
      [pts0.handL, pts0.handR].forEach((h) => barAt(h, sideAxis, 0.13, 3.4));
    } else if (equip === 'onehand') {
      barAt(pts0.handR, sideAxis, 0.13, 3.4);
    } else if (equip === 'goblet') {
      // Eine Hantel, senkrecht, von beiden Händen vor der Brust gehalten
      barAt(midOf(pts0.handL, pts0.handR), upAxis, 0.105, 4.4);
    } else if (equip === 'barbell') {
      // Eine Langhantel ist doppelt so breit wie die Schultern, und zwischen
      // Hand und Scheibe liegt ein gutes Stück blanke Stange. Mit dem alten
      // half = 0.34 war sie 75 cm lang: Die Scheiben klebten an den Händen und
      // das Ganze sah aus wie eine Kurzhantelstange. 0.56 ist immer noch kürzer
      // als in Wirklichkeit – weiter geht es nicht, ohne dass die Enden aus dem
      // Kasten laufen, denn der Ausschnitt richtet sich nach der Figur.
      barAt(midOf(pts0.handL, pts0.handR), sideAxis, 0.56, 4.4);
    } else if (equip === 'hipbar') {
      barAt(midOf(pts0.hipL, pts0.hipR), sideAxis, 0.56, 4.4);
    } else if (equip === 'band') {
      // Ein Loop-Band hängt nicht überall gleich. Beim Pull-Apart und beim
      // Reverse Fly hält man es wirklich zwischen beiden Händen – dort ist eine
      // Linie von Hand zu Hand richtig. Bei allen übrigen Bandübungen steht man
      // darauf: Curls, Seitheben, Schulterdrücken, Rudern, Überkopfstrecken.
      // Dort lief die Linie bisher trotzdem von Hand zu Hand, und die Figur sah
      // aus, als hielte sie ein schlaffes Springseil vor sich. Jetzt geht das
      // Band von jeder Hand hinunter zum Fuß, wo es auch wirklich verankert ist.
      // Leicht durchhängend, damit es nicht wie eine Stange wirkt.
      const bogen = (a, b, sag) => parts.push({
        z: (a.z + b.z) / 2 + 0.01,
        node: el('path', {
          d: `M${a.x.toFixed(1)} ${a.y.toFixed(1)} Q${((a.x + b.x) / 2 + sag.x).toFixed(1)} `
             + `${((a.y + b.y) / 2 + sag.y).toFixed(1)} ${b.x.toFixed(1)} ${b.y.toFixed(1)}`,
          class: 'fig-band',
        }),
      });
      if (spec.band === 'hands') {
        const a = P(pts0.handL);
        const b = P(pts0.handR);
        const span = Math.hypot(a.x - b.x, a.y - b.y);
        bogen(a, b, { x: 0, y: Math.max(0, 26 * gearScale - span * 0.22) });
      } else {
        // Verankert unter den Füßen: zwei Stränge, je einer zur nächstgelegenen
        // Ferse. Der Bauch des Bogens geht nach außen, sonst schneidet das Band
        // durch die Beine.
        ['L', 'R'].forEach((s) => {
          const hand = P(pts0[`hand${s}`]);
          const fuss = P(pts0[`ankle${s}`]);
          bogen(hand, fuss, { x: (s === 'L' ? -1 : 1) * 5 * gearScale, y: 0 });
        });
      }
    } else if (equip === 'plate') {
      // Scheibe oder Hantel auf der Brust (Crunches). Sie liegt weiter vorn als
      // die Unterarme, sonst verschwindet sie dahinter – bei 0.155 blieb von
      // ihr ein weißer Keil zwischen den Armen übrig, aus jedem Blickwinkel.
      const q = P(add(j.chest, mul(frontAxis, 0.26)));
      parts.push({
        z: q.z + 0.01,
        node: el('circle', { cx: q.x.toFixed(1), cy: q.y.toFixed(1), r: (5.4 * gearScale * q.k).toFixed(1), class: 'fig-plate' }),
      });
    } else if (equip === 'backpack') {
      // Rucksack auf dem oberen Rücken. Vorher lag hier eine Scheibe – die
      // sieht man in jedem Trainingsvideo, nur bekommt man sie ohne zweite
      // Person nicht auf den eigenen Rücken. Ein Rucksack schon, und er sieht
      // auch anders aus: ein Kasten, keine Scheibe.
      // Mitte zwischen Brust und Becken: auf Brusthöhe säße er im Nacken.
      const q = P(add(midOf(j.chest, j.hipC), mul(frontAxis, -0.12)));
      const w = 7.6 * gearScale * q.k;
      const h = 9.0 * gearScale * q.k;
      parts.push({
        z: q.z + 0.01,
        node: el('rect', {
          x: (q.x - w / 2).toFixed(1), y: (q.y - h / 2).toFixed(1),
          width: w.toFixed(1), height: h.toFixed(1), rx: (w * 0.28).toFixed(1),
          class: 'fig-pack',
        }),
      });
    }

    if (spec.step) {
      // Kasten unter den Füßen: ohne ihn stünde nur eine schräge Figur da und
      // man sähe nicht, dass die Füße erhöht stehen.
      const heel = midOf(j.ankleL, j.ankleR);
      const top = Math.min(j.toeL[1], j.toeR[1]) - 0.02;
      const zc = heel[2]; const xc = heel[0];
      const corner = (sx, sz, y) => P([xc + sx * 0.16, y, zc + sz * 0.26]);
      const face = (quad) => parts.push({
        z: quad.reduce((acc, q) => acc + q.z, 0) / quad.length - 0.05,
        node: el('polygon', {
          points: quad.map((q) => `${q.x.toFixed(1)},${q.y.toFixed(1)}`).join(' '),
          class: 'fig-bench',
        }),
      });
      face([corner(-1, -1, top), corner(1, -1, top), corner(1, 1, top), corner(-1, 1, top)]);
      face([corner(-1, 1, top), corner(1, 1, top), corner(1, 1, -0.62), corner(-1, 1, -0.62)]);
      face([corner(1, -1, top), corner(1, 1, top), corner(1, 1, -0.62), corner(1, -1, -0.62)]);
      face([corner(-1, -1, top), corner(-1, 1, top), corner(-1, 1, -0.62), corner(-1, -1, -0.62)]);
    }

    if (spec.seat) {
      // Bank: Sitzfläche knapp unter der Hüfte, zwei Beine bis auf den Boden.
      // Sie liegt im Raum und kippt deshalb beim Drehen mit.
      const top = j.hipC[1] - 0.085;
      const halfW = 0.24; const back = -0.24; const front = 0.30; const thick = 0.055;
      const slab = (y, zs) => zs.map(([sx, sz]) => P([sx * halfW, y, sz]));
      const quad = (pts4, dz) => parts.push({
        z: pts4.reduce((acc, q) => acc + q.z, 0) / 4 + dz,
        node: el('polygon', {
          points: pts4.map((q) => `${q.x.toFixed(1)},${q.y.toFixed(1)}`).join(' '),
          class: 'fig-bench',
        }),
      });
      // Sitzfläche und Vorderkante: eine einzelne Fläche sähe von vorn aus wie
      // ein Strich, die Bank hätte keine Dicke.
      quad(slab(top, [[-1, back], [1, back], [1, front], [-1, front]]), -0.04);
      quad([...slab(top, [[-1, front], [1, front]]), ...slab(top - thick, [[1, front], [-1, front]])], -0.03);
      quad([...slab(top, [[1, back], [1, front]]), ...slab(top - thick, [[1, front], [1, back]])], -0.03);
      quad([...slab(top, [[-1, back], [-1, front]]), ...slab(top - thick, [[-1, front], [-1, back]])], -0.03);
      [-0.16, 0.22].forEach((sz) => [-0.18, 0.18].forEach((sx) => {
        const a1 = P([sx, top - thick, sz]); const a2 = P([sx, -0.62, sz]);
        parts.push({
          z: (a1.z + a2.z) / 2 - 0.06,
          node: el('line', {
            x1: a1.x.toFixed(1), y1: a1.y.toFixed(1), x2: a2.x.toFixed(1), y2: a2.y.toFixed(1),
            'stroke-width': (3 * gearScale).toFixed(2), class: 'fig-bench-leg',
          }),
        });
      }));
    }

    if (spec.bar) {
      // Entlang der Schulterachse durch beide Hände: so liegt sie beim Klimmzug
      // quer vor dem Körper und bei den Inverted Rows quer über ihm.
      const centre = midOf(j.handL, j.handR);
      const a1 = P(add(centre, mul(sideAxis, -0.8)));
      const a2 = P(add(centre, mul(sideAxis, 0.8)));
      parts.push({
        z: (a1.z + a2.z) / 2 - 0.02,
        node: el('line', {
          x1: a1.x.toFixed(1), y1: a1.y.toFixed(1), x2: a2.x.toFixed(1), y2: a2.y.toFixed(1),
          class: 'fig-bar-fixed',
        }),
      });
    }
    if (!spec.float) {
      // Bodenscheibe statt Strich: ein Strich unten am Rand sieht aus wie ein
      // Schieberegler; eine Fläche im Raum liest sich als Boden und kippt mit.
      // Mittig unter der Figur, nicht am Ursprung: wer an einer Stange hängt,
      // steht nicht über dem Nullpunkt, und die Scheibe lag dann daneben.
      const gy = spec.anchor === 'bar' ? fit.groundY : -0.62;
      const ring = [];
      for (let a = 0; a < 360; a += 15) {
        ring.push(P([fit.mid[0] + Math.cos(rad(a)) * 0.62, gy, fit.mid[2] + Math.sin(rad(a)) * 0.34]));
      }
      // Immer ganz nach hinten. Sortiert man den Boden wie ein Körperteil ein,
      // legt er sich beim Blick von oben über das hintere Bein und färbt es
      // durch seine halbe Deckkraft braun.
      parts.push({
        z: -Infinity,
        node: el('polygon', {
          points: ring.map((q) => `${q.x.toFixed(1)},${q.y.toFixed(1)}`).join(' '),
          class: 'fig-ground',
        }),
      });
    }

    // Verletzungsmarken ganz oben: sie sollen auch dann zu sehen sein, wenn
    // die Stelle gerade hinten liegt – sonst muss man die Figur erst drehen,
    // um zu erkennen, worum es geht.
    marks.forEach(({ spot, kind }) => {
      const at = SPOTS[spot];
      if (!at) return;
      at(j).forEach((p3) => {
        const q = P(p3);
        // Etwas schmaler als ein Oberarm: eine Marke soll die Stelle zeigen,
        // nicht die Figur darunter verdecken.
        const r = Math.max(1.2, 2.6 * gearScale * q.k);
        const f = (v) => v.toFixed(1);
        parts.push({
          z: Infinity,
          node: el('circle', { cx: f(q.x), cy: f(q.y), r: f(r * 1.75), class: 'fig-hurt-halo' }),
        });
        parts.push({
          z: Infinity,
          node: el('circle', { cx: f(q.x), cy: f(q.y), r: f(r), class: 'fig-hurt' }),
        });
        // Bruch und Riss bekommen einen Zackenblitz, damit sich die Art der
        // Verletzung schon am Bild unterscheiden lässt.
        if (kind === 'bruch' || kind === 'riss') {
          const pts = [[-0.7, -1], [0.1, -0.2], [-0.3, 0.15], [0.6, 1]]
            .map(([dx, dy]) => `${f(q.x + dx * r)},${f(q.y + dy * r)}`).join(' ');
          parts.push({ z: Infinity, node: el('polyline', { points: pts, class: 'fig-hurt-crack' }) });
        }
      });
    });

    // Maleralgorithmus: hinten zuerst
    parts.sort((p, q) => p.z - q.z).forEach((p) => scene.appendChild(p.node));
  };

  // Die beiden Listener hängen am Fenster, nicht am Kasten – sonst bräche das
  // Drehen ab, sobald der Finger die Figur verlässt. Genau deshalb müssen sie
  // aber auch wieder weg, wenn die Figur verschwindet: die Ansicht wird bei
  // jedem abgehakten Satz neu geschrieben, und die alten Listener blieben
  // sonst samt ihrer Zeichendaten liegen.
  const off = () => {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    if (sichtbarkeit) sichtbarkeit.unobserve(host);
    delete host.__figEntry;
  };
  const entry = { draw, off, effortAt1: !LOWER_TO_1.includes(pattern), sichtbar: true };
  if (sichtbarkeit) {
    host.__figEntry = entry;
    sichtbarkeit.observe(host);
  }
  // Bei ausgeschalteter Bewegung eine mittlere Stellung zeigen statt der
  // Ausgangsstellung – sonst sieht man von der Übung nichts.
  draw(reduceMotion.matches ? 0.55 : 0);
  active.add(entry);
  return {
    draw,
    setView: (y, pi = 0) => { yaw = y; pitch = pi; draw(lastT); },
    stop: () => {
      active.delete(entry);
      off();
    },
  };
}

/**
 * Alle Figuren abmelden – vor jedem Neuaufbau der Ansicht.
 *
 * Nicht nur aus der Zeichenschleife nehmen, sondern auch die Fenster-Listener
 * lösen. Ohne das kamen bei einem Training gut fünfzig zusammen, jeder mit
 * seiner SVG im Gepäck.
 */
export function clearFigures() {
  active.forEach((f) => f.off && f.off());
  active.clear();
}

/**
 * Tempo einer Wiederholung.
 *
 * Hin und zurück gleich schnell sieht aus wie ein Pendel, nicht wie Training.
 * Echte Wiederholungen sind unsymmetrisch: kurz halten, zügig in die
 * Anstrengung, oben oder unten einen Moment stehen, deutlich langsamer zurück.
 * Genau so steht es auch in den Hinweisen ("3 Sekunden kontrolliert ablassen").
 *
 * u läuft von 0 bis 1 durch einen Zyklus, zurück kommt die Stellung zwischen
 * den beiden Endlagen. Welche der beiden die anstrengende ist, hängt von der
 * Übung ab: bei der Kniebeuge ist Stellung 1 unten (die Anstrengung geht
 * zurück nach 0), beim Curl ist Stellung 1 oben.
 */
const ease = (x) => x * x * (3 - 2 * x);
const span = (u, a, b) => ease(Math.min(1, Math.max(0, (u - a) / (b - a))));

function tempo(u, effortAt1) {
  if (effortAt1) {
    if (u < 0.06) return 0;                 // Ausgangsstellung halten
    if (u < 0.34) return span(u, 0.06, 0.34);      // zügig in die Anstrengung
    if (u < 0.44) return 1;                 // oben kurz halten
    return 1 - span(u, 0.44, 1);            // langsam zurück
  }
  if (u < 0.06) return 0;                   // oben stehen
  if (u < 0.62) return span(u, 0.06, 0.62); // langsam ablassen
  if (u < 0.70) return 1;                   // unten kurz halten
  return 1 - span(u, 0.70, 1);              // zügig hoch
}

// Muster, bei denen Stellung 1 das Ende des Ablassens ist, nicht die
// Anstrengung: dort läuft das Tempo andersherum.
const LOWER_TO_1 = ['squat', 'squatbw', 'pushup', 'pushupfeet', 'pike', 'tricepsbar',
  'hinge', 'hinge1', 'splitsquat'];

const reduceMotion = window.matchMedia
  ? window.matchMedia('(prefers-reduced-motion: reduce)')
  : { matches: false };

function frame(now) {
  if (document.visibilityState === 'visible' && active.size && !reduceMotion.matches) {
    const u = (now % CYCLE_MS) / CYCLE_MS;
    active.forEach((f) => { if (f.sichtbar) f.draw(tempo(u, f.effortAt1)); });
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
