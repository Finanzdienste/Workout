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
 * Maleralgorithmus – was hinten liegt, kommt zuerst. Ziehen dreht:
 * waagerecht um die Hochachse (unbegrenzt), senkrecht um die Querachse in
 * Grenzen (siehe mountFigure).
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

export const RIG = {
  hipW: 0.10, shoulderW: 0.215, shoulderY: 0.42,
  chestY: 0.28, neckY: 0.47, headY: 0.63, headR: 0.115,
  upperArm: 0.27, foreArm: 0.25, hand: 0.06,
  thigh: 0.44, shin: 0.42, foot: 0.15,
  /*
   * Wie dick der Arm gezeichnet wird: je Glied ein Verlauf [Anteil der
   * Länge, halbe Breite in Zeicheneinheiten wie bei limb()], dazu der
   * Maßstab der Hand.
   *
   *     „Die Arme sehen echt immer komisch aus"
   *
   * Bis v235 waren es gerade Kegel 3,4 → 2,5 → 1,8: Der Oberarm war 1,6-mal
   * so lang wie an der Schulter dick (echt gut dreimal), im Mittel 1,8-mal,
   * ein Würstchen, das bei jeder Verkürzung zur Scheibe wurde. Jetzt hat er
   * seine Masse im oberen Drittel (Delta, Bizeps) und läuft zum Ellenbogen
   * schmal zu; der Unterarm hat seinen Bauch kurz unter dem Ellenbogen und
   * wird zum Handgelenk dünn. Länge zu mittlerer Dicke: Oberarm 2,34 (vorher
   * 1,83), Unterarm 2,84 (vorher 2,33) – tests/test-figur.mjs hält das bei
   * mindestens 2,3 und 2,8. Schmaler als 1,35 am Handgelenk geht nicht: In
   * der Karte verliert die Hand sonst ihren Ansatz.
   */
  armOben: [[0, 2.35], [0.25, 2.6], [0.6, 2.3], [1, 1.85]],
  armUnten: [[0, 1.85], [0.25, 2.0], [0.7, 1.65], [1, 1.4]],
  handS: 0.88,
};

const rad = (d) => (d * Math.PI) / 180;
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (v, s) => [v[0] * s, v[1] * s, v[2] * s];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const skalar = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (v) => {
  const n = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / n, v[1] / n, v[2] / n];
};

// Drehungen mit schon gerechnetem Kosinus und Sinus: Wo alle Gelenke um
// denselben Winkel gedreht werden (Hinlegen, Kippen, Becken), rechnete solve()
// beide für jedes der 18 Gelenke neu – beim Liegestütz, der je Bild gut
// hundertmal gelöst wird, ein großer Posten. Dieselbe Rechnung, nur einmal.
const drehX = (v, c, s) => [v[0], v[1] * c - v[2] * s, v[1] * s + v[2] * c];
const drehZ = (v, c, s) => [v[0] * c - v[1] * s, v[0] * s + v[1] * c, v[2]];
const cs = (deg) => [Math.cos(rad(deg)), Math.sin(rad(deg))];
function rotX(v, deg) {
  return drehX(v, Math.cos(rad(deg)), Math.sin(rad(deg)));
}
function rotY(v, deg) {
  const c = Math.cos(rad(deg)); const s = Math.sin(rad(deg));
  return [v[0] * c + v[2] * s, v[1], -v[0] * s + v[2] * c];
}
function rotZ(v, deg) {
  return drehZ(v, Math.cos(rad(deg)), Math.sin(rad(deg)));
}

/** Punkt zwischen zwei projizierten Punkten. */

const A = (p = 0, a = 0, e = 0, i = 0) => ({ p, a, e, i });
const L = (p = 0, a = 0, k = 0) => ({ p, a, k });

/**
 * Gelenkpunkte einer Stellung, Hüftmitte im Ursprung.
 *
 * Ausgeführt, weil sich Stellungen sonst nur am fertigen Bild beurteilen
 * lassen: tools/pose.mjs rechnet damit nach, ob Schultern, Hüfte und Füße dort
 * liegen, wo die Übung sie verlangt.
 *
 * `nur` beschränkt das Ergebnis auf einige Gelenke – für die Suchen beim
 * Stütz, die je Bild hundertmal lösen und nur Hände und Zehen brauchen. Jedes
 * Gelenk wird für sich gedreht, die Werte sind also dieselben wie im ganzen
 * Skelett; gespart wird nur das Drehen der übrigen.
 */
export function solve(pose, nur = GELENKE) {
  const R = RIG;
  const lean = pose.lean || 0;
  const up = rotX([0, 1, 0], lean);           // Rumpfachse, +lean = nach vorn
  const side = [1, 0, 0];                     // Schulterachse, von lean unberührt

  const hipC = [0, 0, 0];
  const chest = mul(up, R.chestY);
  const neck = mul(up, R.neckY);
  const head = mul(up, R.headY);
  const shoulderMid = mul(up, R.shoulderY);

  // Eine Seite, Arm und Bein. Die Gelenke kommen danach in ein Objekt mit
  // festen Namen: Mit zusammengesetzten Schlüsseln (`hand${s}`) und
  // Object.assign brauchte ein Skelett beim Liegestütz gut doppelt so lang –
  // und der löst je Bild gut hundertmal (siehe naechsteNull).
  const seite = (sign, arm, leg) => {
    // Arm: Richtung aus Neigung und Abspreizung, dann Ellenbogen beugen
    const shoulder = add(shoulderMid, mul(side, sign * R.shoulderW));
    const upperDir = rotX(rotZ([0, -1, 0], sign * arm.a), -arm.p + lean);
    const elbow = add(shoulder, mul(upperDir, R.upperArm));
    // arm.i dreht den Unterarm zur Körpermitte – nötig, wo beide Hände
    // dasselbe Gerät fassen, etwa die Hantel beim Goblet Squat.
    const foreDir = rotZ(rotX(upperDir, -arm.e), sign * (arm.i || 0));
    const hand = add(elbow, mul(foreDir, R.foreArm));

    // Bein: Hüfte beugen, dann Knie
    const hip = add(hipC, mul(side, sign * R.hipW));
    const thighDir = rotX(rotZ([0, -1, 0], sign * leg.a), -leg.p);
    const knee = add(hip, mul(thighDir, R.thigh));
    const shinDir = rotX(thighDir, leg.k);
    const ankle = add(knee, mul(shinDir, R.shin));
    const toe = add(ankle, mul(rotX(shinDir, -80 - leg.k * 0.25), R.foot));
    return [shoulder, elbow, hand, hip, knee, ankle, toe];
  };
  const [shoulderL, elbowL, handL, hipL, kneeL, ankleL, toeL] = seite(-1, pose.armL || pose.arm || A(), pose.legL || pose.leg || L());
  const [shoulderR, elbowR, handR, hipR, kneeR, ankleR, toeR] = seite(1, pose.armR || pose.arm || A(), pose.legR || pose.leg || L());
  const joints = {
    hipC, chest, neck, head,
    shoulderL, elbowL, handL, hipL, kneeL, ankleL, toeL,
    shoulderR, elbowR, handR, hipR, kneeR, ankleR, toeR,
  };
  // Alle Gelenke auf einmal umrechnen, in derselben Reihenfolge wie die Namen.
  const alle = (f) => { for (const k of nur) joints[k] = f(joints[k], k); };

  // Wadenheben: der Körper steigt, die Zehen bleiben liegen. Nur so sieht man
  // die Ferse abheben – hebt man alles zusammen an, wandert bloß die ganze
  // Figur nach oben und die Bewegung ist unsichtbar.
  if (pose.heel) {
    // stance nennt das Standbein: beim einbeinigen Wadenheben darf nur dessen
    // Zeh liegen bleiben, sonst zieht sich das freie Bein in die Länge.
    const planted = pose.stance ? [`toe${pose.stance}`] : ['toeL', 'toeR'];
    alle((q, k) => (planted.includes(k) ? q : [q[0], q[1] + pose.heel * 0.16, q[2]]));
  }

  /*
   * Das Becken einrollen – die Bewegung, um die es beim Knieheben geht.
   *
   *     „Knieheben im Liegen merk ich fast nur in den Beinen und fast garnicht
   *      im Bauch"
   *
   * Er hatte recht, und die Zeichnung war mitschuldig: Sie zeigte bis v188 die
   * Beine kreisen und den Rumpf unbewegt liegen – also genau das, was er
   * beschreibt. Beine anheben ist Hüftbeugung und läuft an der Bauchmuskulatur
   * vorbei; der Bauch arbeitet erst, wenn sich das Becken hinten einrollt und
   * das Gesäß vom Boden abhebt. Eine Figur, die das nicht zeigt, bringt die
   * Übung falsch bei.
   *
   * Der Rig hat dafür keinen Wirbel – der Rumpf ist ein starres Stück von der
   * Hüfte zum Kopf. Gedreht wird deshalb der *ganze* Körper um die Schulter:
   * Die Hüfte schwingt nach vorn, der Kopf nach hinten. Beim Hinsetzen auf den
   * Boden (skeleton() legt den tiefsten Punkt auf die Null) landet dann der
   * Kopf unten und die Hüfte oben – und das ist genau das Bild, das entstehen
   * soll: Schultern und Kopf bleiben liegen, das Becken hebt ab.
   *
   * Positive Werte rollen ein. Gerechnet wird vor dem Hinlegen, in der
   * aufrechten Achse; dort ist „nach vorn" +z, und daraus wird beim Hinlegen
   * „nach oben".
   */
  if (pose.becken) {
    const p = shoulderMid;
    const [c, s] = cs(-pose.becken);
    alle((q) => {
      const v = drehX([q[0] - p[0], q[1] - p[1], q[2] - p[2]], c, s);
      return [v[0] + p[0], v[1] + p[1], v[2] + p[2]];
    });
  }

  // Hinlegen. Früher wurde die stehende Figur mit zwei Winkeln (roll/tilt)
  // schräg gedreht, bis sie aus einem bestimmten Blickwinkel lag – aus jedem
  // anderen sah sie umgekippt aus. Jetzt ist es eine echte Lage: die Längsachse
  // des Körpers zeigt nach links (Kopf links, Füße rechts), der Bauch nach oben
  // (Rücklage) oder nach unten (Bauchlage).
  if (pose.lie) {
    const [cx, sx] = cs(pose.lie === 'prone' ? 90 : -90);
    const [cz, sz] = cs(90);
    alle((q) => drehX(drehZ(q, cz, sz), cx, sx));
  }
  // Neigung der ganzen Figur um die Blickachse: bei liegenden Übungen hebt ein
  // positiver Wert das Fußende, so entsteht die Brücke beim Hip Thrust.
  if (pose.tilt) {
    const [c, s] = cs(pose.tilt);
    alle((q) => drehZ(q, c, s));
  }
  if (nur === GELENKE) return joints;
  const teil = {};
  for (const k of nur) teil[k] = joints[k];
  return teil;
}
const GELENKE = ['hipC', 'chest', 'neck', 'head',
  'shoulderL', 'elbowL', 'handL', 'hipL', 'kneeL', 'ankleL', 'toeL',
  'shoulderR', 'elbowR', 'handR', 'hipR', 'kneeR', 'ankleR', 'toeR'];

/* ------------------------------------------------------------------ *
 * Stellung zwischen Start und Ende – und wo sie steht
 *
 * Bis v200 lag beides in mountFigure, und tools/pose.mjs hatte eine eigene
 * Fassung davon. Die Durchsicht der App hat gezeigt, was das kostet: Die
 * Kopie setzte jede Stellung auf ihren tiefsten Punkt und kannte den Griff an
 * der Stange nicht, maß also etwas anderes als gezeichnet wurde. Messungen
 * damit – auch die zum Face Pull – stimmten nicht, und die Bodenprüfung in
 * tests/test-figur.mjs konnte gar nicht fehlschlagen. Jetzt gibt es eine
 * Rechnung, und Zeichnung, Werkzeug und Test benutzen dieselbe.
 * ------------------------------------------------------------------ */

/** Die Stellung bei t (0 = Start, 1 = Ende), Winkel für Winkel gemischt. */
export function mische(spec, t) {
  const [a, b] = spec.poses;
  const mix = (x, y) => x + (y - x) * t;
  const mixA = (x = A(), y = A()) => A(mix(x.p, y.p), mix(x.a, y.a), mix(x.e, y.e), mix(x.i || 0, y.i || 0));
  const mixL = (x = L(), y = L()) => L(mix(x.p, y.p), mix(x.a, y.a), mix(x.k, y.k));
  return {
    lie: spec.lie,                       // Lage gilt fürs ganze Muster
    stance: spec.stance,
    lean: mix(a.lean || 0, b.lean || 0),
    tilt: mix(a.tilt || 0, b.tilt || 0),
    heel: mix(a.heel || 0, b.heel || 0),
    becken: mix(a.becken || 0, b.becken || 0),
    armL: mixA(a.armL || a.arm, b.armL || b.arm),
    armR: mixA(a.armR || a.arm, b.armR || b.arm),
    legL: mixL(a.legL || a.leg, b.legL || b.leg),
    legR: mixL(a.legR || a.leg, b.legR || b.leg),
  };
}

const BODEN = -0.62;
const tiefster = (j, keys) => Math.min(...keys.map((k) => j[k][1]));
const verschiebe = (j, d) => {
  Object.keys(j).forEach((k) => { j[k] = [j[k][0] + d[0], j[k][1] + d[1], j[k][2] + d[2]]; });
  return j;
};
const mitte = (p, q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2, (p[2] + q[2]) / 2];
const abstand = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);

/**
 * Die Nullstelle von g, die am nächsten bei 0 liegt – gesucht in ±weite.
 *
 * Nicht einfach halbieren: Die Kurven hier sind nicht überall monoton. Beim
 * Pike steigt der Abstand Zehen–Hände mit der Vorbeuge erst und fällt dann
 * wieder; eine Halbierung über den ganzen Bereich landete bei der falschen
 * Nullstelle, und die Hände standen 0,4 über dem Boden. Also: in Schritten
 * abtasten, den Vorzeichenwechsel nahe 0 nehmen und nur dort halbieren. Ohne
 * Vorzeichenwechsel gilt die Stelle mit dem kleinsten Betrag.
 *
 * Abgetastet wird von 0 nach außen, nicht von −weite nach +weite. Gesucht ist
 * ohnehin der Wechsel, der 0 am nächsten liegt – sobald er gefunden ist, kann
 * kein näherer mehr kommen. Vorher wurde immer das ganze Raster gerechnet,
 * 61 Stellen, und beim Liegestütz kostete das je Bild über 400 Aufrufe von
 * solve(): mit vierfach gedrosselter CPU 12–13 ms je Bild, eine einzige Figur
 * also schon fast das ganze Bildbudget. Gefunden bei der Durchsicht der
 * Figuren. Das Ergebnis ist dasselbe, Stelle für Stelle: dieselben
 * Rasterpunkte, dieselbe Reihenfolge bei gleich nahen Wechseln (der negative
 * zuerst, wie beim Abtasten von links), dieselbe Halbierung. Nur wo es gar
 * keinen Wechsel gibt, braucht es wie früher das ganze Raster.
 */
function naechsteNull(g, weite = 30) {
  const werte = new Map();
  const bei = (x) => {
    if (!werte.has(x)) werte.set(x, g(x));
    return werte.get(x);
  };
  const wechsel = (lo) => Math.sign(bei(lo)) !== Math.sign(bei(lo + 1));
  let klammer = null;
  for (let m = 0; m < weite && !klammer; m++) {
    if (wechsel(-1 - m)) klammer = [-1 - m, -m];
    else if (wechsel(m)) klammer = [m, m + 1];
  }
  if (!klammer) {
    let best = { x: 0, v: Math.abs(bei(0)) };
    for (let x = -weite; x <= weite; x++) {
      if (Math.abs(bei(x)) < best.v) best = { x, v: Math.abs(bei(x)) };
    }
    return best.x;
  }
  let [lo, hi] = klammer;
  const glo = bei(lo) > 0;
  for (let i = 0; i < 30; i++) {
    const m = (lo + hi) / 2;
    if ((g(m) > 0) === glo) lo = m; else hi = m;
  }
  return (lo + hi) / 2;
}

/** Lineares Gleichungssystem J·x = f, Gauß mit Spaltenpivot; null wenn singulär. */
function loese(J, f) {
  const n = f.length;
  const M = J.map((z, r) => [...z, f[r]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    if (Math.abs(M[p][c]) < 1e-12) return null;
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const m = M[r][c] / M[c][c];
      for (let k = c; k <= n; k++) M[r][k] -= m * M[c][k];
    }
  }
  return M.map((z, r) => z[n] / z[r]);
}

/**
 * Stütz auf Händen und Füßen: Liegestütz, Füße erhöht, Pike.
 *
 * Gefunden bei der Durchsicht der App: Beim Liegestütz sank der Körper nicht –
 * die Neigung stand in beiden Stellungen fest, also hoben beim Beugen der Arme
 * die *Hände* vom Boden ab (bis 0,21 über dem Boden), während Schultern und
 * Kopf blieben, wo sie waren. Beim Pike dasselbe mit der Vorbeuge. Und die Hände
 * glitten dabei seitlich über den Boden, weil die Arme beim Beugen weiter
 * abspreizen.
 *
 * Statt die Winkel von Hand nachzustellen, bis es für zwei Stellungen passt,
 * wird hier je Einzelbild gesucht:
 *   - die Abspreizung der Arme, bei der die Griffweite die vom Start bleibt;
 *   - die Neigung (bzw. beim Pike die Vorbeuge), bei der Hände und Zehen
 *     zugleich unten sind – beim Liegestütz mit erhöhten Füßen: bei der die
 *     Zehen so hoch über den Händen stehen wie am Start, also auf dem Kasten.
 * Dann sinkt der Körper, weil er muss.
 */
const HAENDE = ['handL', 'handR'];
const ZEHEN = ['toeL', 'toeR'];
// Mehr brauchen die Suchen nicht – siehe `nur` bei solve().
const STUETZ_TEIL = [...HAENDE, ...ZEHEN];
const fussMitte = (j) => mitte(j.toeL, j.toeR);
const handMitte = (j) => mitte(j.handL, j.handR);
const flach = (u, v) => Math.hypot(u[0] - v[0], u[2] - v[2]);
/*
 * Was am Start eines Musters feststeht – einmal je Muster gerechnet.
 *
 * Startstellung, Griffweite, Zehenhöhe und der Abstand Hände–Füße hängen nur
 * am Muster, nicht an t. Sie wurden trotzdem in jedem Bild neu gelöst, dazu in
 * skelett() noch einmal der ganze Stütz bei t = 0 für den festen Punkt. Die
 * Muster ändern sich nach dem Laden nicht mehr; wer eins für eine Suche
 * abwandelt, legt eine Kopie an – sonst gälte der Start des Originals.
 */
const stuetzStart = new WeakMap();
function stuetzVorgaben(spec) {
  let s = stuetzStart.get(spec);
  if (!s) {
    const start = solve(mische(spec, 0));
    s = {
      breite0: abstand(start.handL, start.handR),
      // Höhe der Zehen über den Händen: beim Kasten so hoch wie am Start,
      // sonst null – beide am Boden. Beim Pike standen die Hände schon am
      // Start nicht auf (0,055 über dem Boden), also gilt dort nicht „wie am
      // Start".
      ziel: spec.step ? tiefster(start, ZEHEN) - tiefster(start, HAENDE) : 0,
      abst0: flach(handMitte(start), fussMitte(start)),
    };
    stuetzStart.set(spec, s);
  }
  return s;
}
function stuetz(spec, t) {
  const pose = mische(spec, t);
  const { breite0, ziel, abst0 } = stuetzVorgaben(spec);
  // Griffweite halten: die Abspreizung beider Arme gleich verschieben.
  const mitArm = (da) => ({
    ...pose,
    armL: { ...pose.armL, a: pose.armL.a + da },
    armR: { ...pose.armR, a: pose.armR.a + da },
  });
  // Je Auswertung einmal lösen – vorher zweimal, einmal für jede Hand.
  const da = t === 0 ? 0 : naechsteNull((d) => {
    const j = solve(mitArm(d), STUETZ_TEIL);
    return abstand(j.handL, j.handR) - breite0;
  });
  const p1 = mitArm(da);
  const feld = spec.stuetz === 'lean' ? 'lean' : 'tilt';
  const hoehe = (j) => (tiefster(j, ZEHEN) - tiefster(j, HAENDE)) - ziel;
  const g = (q) => hoehe(solve(q, STUETZ_TEIL));
  let q = p1;
  q = { ...q, [feld]: q[feld] + naechsteNull((d) => g({ ...q, [feld]: q[feld] + d })) };
  // Zusätzlich: Hände und Füße stehen, also bleibt ihr Abstand. Die Suchen
  // oben halten nur die Höhe; dazwischen rutschten beim Pike die Zehen bis
  // 0,19 über den Boden und beim Liegestütz 0,04 nach vorn und zurück. Neigung,
  // zweiter Winkel und Abspreizung verändern alle drei Größen zugleich – zwei
  // Suchen im Wechsel zogen sich gegenseitig weg (0,3 Rutschen). Also
  // gemeinsam: Newton über drei Winkel und drei Bedingungen, mit gerechneter
  // Ableitung und begrenzten Schritten. Der zweite Winkel ist beim Pike der
  // Hüftwinkel (die Beine), beim Liegestütz die Schulter (die Arme): Dort ist
  // der Körper ein Brett, und nur der Oberarm kann den Abstand ausgleichen.
  const glied = feld === 'lean' ? ['legL', 'legR'] : ['armL', 'armR'];
  const stell = (x) => {
    const r = { ...q, [feld]: q[feld] + x[0] };
    glied.forEach((k) => { r[k] = { ...r[k], p: r[k].p + x[1] }; });
    ['armL', 'armR'].forEach((k) => { r[k] = { ...r[k], a: r[k].a + x[2] }; });
    return r;
  };
  // Ein Skelett je Auswertung für alle drei Bedingungen (vorher zwei).
  const F = (x) => {
    const j = solve(stell(x), STUETZ_TEIL);
    return [hoehe(j), flach(handMitte(j), fussMitte(j)) - abst0, abstand(j.handL, j.handR) - breite0];
  };
  let x = [0, 0, 0];
  for (let i = 0; i < 16; i++) {
    const f = F(x);
    if (f.every((v) => Math.abs(v) < 1e-5)) break;
    const h = 0.05;
    const spalten = [0, 1, 2].map((k) => {
      const y = x.slice(); y[k] += h;
      return F(y).map((v, r) => (v - f[r]) / h);
    });
    const J = [0, 1, 2].map((r) => spalten.map((c) => c[r]));
    const dx = loese(J, f);
    if (!dx) break;
    const k = Math.min(1, 10 / Math.max(...dx.map(Math.abs), 1e-9));
    x = x.map((v, n) => v - k * dx[n]);
  }
  q = stell(x);
  return solve(q);
}

/*
 * Arme zwischen den Endstellungen in Richtungen mischen, nicht in Winkeln.
 *
 * mische() mischt p, a, e und i einzeln. Das trifft die Endstellungen genau,
 * dazwischen aber nimmt der Arm Umwege: Beim Face Pull sackte der Ellenbogen
 * mitten im Zug 0,10 unter die Schulter – genau der Fehler, vor dem der Text
 * der Übung warnt –, beim Pull-Apart fielen die Hände auf Bauchhöhe, und die
 * Griffweite lief 0,65 → 1,18 → 0,76. Hier schwenkt der Oberarm auf dem
 * kürzesten Weg (Slerp im Rahmen des Rumpfes), der Unterarm im mitgeschwenkten
 * Rahmen des Oberarms. Die Endstellungen bleiben bitgenau, was dort gilt
 * (Griff, Anker, Goblet), bleibt also auch. Nicht für Stütz und Stange: dort
 * rechnet skelett() den Arm ohnehin nach.
 */
const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm3 = (v) => { const n = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / n, v[1] / n, v[2] / n]; };
const rodrigues = (v, k, c, s) => add(add(mul(v, c), mul(cross(k, v), s)), mul(k, dot3(k, v) * (1 - c)));
function rumpfRahmen(j) {
  const side = norm3(sub3(j.shoulderR, j.shoulderL));
  const up = norm3(sub3(j.neck, j.hipC));
  return [side, up, cross(side, up)];
}
const lokal = (F, v) => F.map((a) => dot3(a, v));
const welt = (F, v) => add(add(mul(F[0], v[0]), mul(F[1], v[1])), mul(F[2], v[2]));
function slerp(a, b, t) {
  const w = Math.acos(Math.max(-1, Math.min(1, dot3(a, b))));
  if (w < 1e-4) return a;
  return norm3(add(mul(a, Math.sin((1 - t) * w) / Math.sin(w)), mul(b, Math.sin(t * w) / Math.sin(w))));
}
// Rahmen des Oberarms: der kürzeste Schwenk aus dem Hängen auf u.
function armRahmen(u) {
  const h = [0, -1, 0]; const ax = cross(h, u); const sl = Math.hypot(...ax);
  const sw = (v) => (sl < 1e-6 ? v : rodrigues(v, mul(ax, 1 / sl), dot3(h, u), sl));
  return [sw([1, 0, 0]), u, sw([0, 0, 1])];
}
const armEnden = new WeakMap();   // je Muster einmal: beide Endstellungen
function armeRichtung(spec, t, j) {
  if (!armEnden.has(spec)) armEnden.set(spec, [solve(mische(spec, 0)), solve(mische(spec, 1))]);
  const [j0, j1] = armEnden.get(spec);
  const F = rumpfRahmen(j); const F0 = rumpfRahmen(j0); const F1 = rumpfRahmen(j1);
  ['L', 'R'].forEach((s) => {
    const m = s === 'L' ? [-1, 1, 1] : [1, 1, 1];      // links gespiegelt
    const lok = (FF, jj, a, b) => lokal(FF, norm3(sub3(jj[b], jj[a]))).map((x, i) => x * m[i]);
    const u0 = lok(F0, j0, `shoulder${s}`, `elbow${s}`); const u1 = lok(F1, j1, `shoulder${s}`, `elbow${s}`);
    const f0 = lokal(armRahmen(u0), lok(F0, j0, `elbow${s}`, `hand${s}`));
    const f1 = lokal(armRahmen(u1), lok(F1, j1, `elbow${s}`, `hand${s}`));
    if (spec.armweg === 'hand') {
      // Die Hand führt (siehe facepull): Richtung Schulter→Hand per Slerp,
      // Abstand linear, der Ellenbogen per Zwei-Glieder-Rechnung zur
      // gemischten Seite hin. Die Hand läuft so fast gerade zum Ziel.
      const lk = (FF, jj, a, b) => lokal(FF, sub3(jj[b], jj[a])).map((x, i) => x * m[i]);
      const h0 = lk(F0, j0, `shoulder${s}`, `hand${s}`); const h1 = lk(F1, j1, `shoulder${s}`, `hand${s}`);
      const e0 = lk(F0, j0, `shoulder${s}`, `elbow${s}`); const e1 = lk(F1, j1, `shoulder${s}`, `elbow${s}`);
      const d0 = Math.hypot(...h0); const d1 = Math.hypot(...h1);
      const r0 = norm3(h0); const r1 = norm3(h1);
      const quer = (e, r) => sub3(e, mul(r, dot3(e, r)));
      let q0 = quer(e0, r0); let q1 = quer(e1, r1);
      if (Math.hypot(...q0) < 1e-3) q0 = quer(e1, r0);
      if (Math.hypot(...q1) < 1e-3) q1 = quer(e0, r1);
      const r = slerp(r0, r1, t); const d = d0 + (d1 - d0) * t;
      const pol = norm3(quer(slerp(norm3(q0), norm3(q1), t), r));
      const a = RIG.upperArm; const b = RIG.foreArm;
      const x = (a * a - b * b + d * d) / (2 * d); const y = Math.sqrt(Math.max(0, a * a - x * x));
      const el = add(mul(r, x), mul(pol, y));
      const W = (v) => welt(F, v.map((c, i) => c * m[i]));
      j[`elbow${s}`] = add(j[`shoulder${s}`], W(el));
      j[`hand${s}`] = add(j[`shoulder${s}`], W(mul(r, d)));
      return;
    }
    const u = slerp(u0, u1, t);
    const f = welt(armRahmen(u), slerp(f0, f1, t));
    const uw = welt(F, u.map((x, i) => x * m[i])); const fw = welt(F, f.map((x, i) => x * m[i]));
    j[`elbow${s}`] = add(j[`shoulder${s}`], mul(uw, RIG.upperArm));
    j[`hand${s}`] = add(j[`elbow${s}`], mul(fw, RIG.foreArm));
  });
  return j;
}

/**
 * Skelett einer Stellung, auf den Boden gesetzt und an Ort und Stelle.
 *
 * Aufgesetzt wurde schon immer – der tiefste Punkt auf die Bodenhöhe. Neu ist
 * das „an Ort und Stelle": Gefunden bei der Durchsicht der App rutschten bei
 * Kniebeuge, Hüftbeuge und Trizeps an der Stange die Füße über den Boden
 * (bei der Kniebeuge eine Fußlänge nach vorn und zurück), weil nur in der Höhe
 * verschoben wurde und die Hüfte in der Waagerechten stehen blieb. Jetzt bleibt
 * stehen, worauf der Körper steht: bei stehenden Figuren die Füße (beim
 * einbeinigen Stand der Standfuß), beim Stütz die Hände.
 */
const festerPunkt = new WeakMap();
export function skelett(spec, t) {
  let j = spec.stuetz ? stuetz(spec, t) : solve(mische(spec, t));
  if (!spec.stuetz && spec.anchor !== 'bar' && t > 0 && t < 1) j = armeRichtung(spec, t, j);
  // An der Stange, die Füße am Boden (Inverted Row, Trizeps an der Stange):
  // Die Fersen stehen, und der Körper dreht sich um sie. Mit den beiden
  // Endstellungen allein wanderte der tiefste Punkt – bei der Inverted Row
  // steckten die Fersen bei t≈0,25 0,010 im Boden und schwebten oben 0,045
  // darüber, beim Trizeps hoben sie auf halbem Weg 0,038 ab. Der Boden wird
  // aber einmal aus der Startstellung gezeichnet (fit.groundY). Also wie beim
  // Stütz je Bild nachrechnen: den ganzen Körper starr drehen (lean und Hüfte
  // gegenläufig – das ist dieselbe Drehung wie tilt, nur auch im Stehen) und
  // den Schulterwinkel nachstellen, bis der Fuß, der am Start unten war, so
  // tief und so weit von der Stange steht wie dort. Nur die Neigung zu suchen
  // hielt die Höhe, ließ die Fersen aber 0,08 zur Stange rutschen; zwei
  // Bedingungen brauchen zwei Winkel, gelöst gemeinsam mit Newton.
  if (spec.anchor === 'bar' && !spec.float && t !== 0) {
    const start = solve(mische(spec, 0));
    const fussName = ['ankleL', 'ankleR', 'toeL', 'toeR'].reduce((a, b) => (start[b][1] < start[a][1] ? b : a));
    const lage = (q) => {
      const h = mitte(q.handL, q.handR);
      const f = q[fussName];
      return [f[1] - h[1], Math.hypot(f[0] - h[0], f[2] - h[2])];
    };
    const ziel = lage(start);
    const pose = mische(spec, t);
    const stell = (x) => ({
      ...pose, lean: pose.lean + x[0],
      legL: { ...pose.legL, p: pose.legL.p - x[0] },
      legR: { ...pose.legR, p: pose.legR.p - x[0] },
      armL: { ...pose.armL, p: pose.armL.p + x[1] },
      armR: { ...pose.armR, p: pose.armR.p + x[1] },
    });
    const F = (x) => lage(solve(stell(x))).map((v, i) => v - ziel[i]);
    let x = [0, 0];
    for (let i = 0; i < 16; i++) {
      const f = F(x);
      if (f.every((v) => Math.abs(v) < 1e-6)) break;
      const h = 0.05;
      const spalten = [0, 1].map((k) => {
        const y = x.slice(); y[k] += h;
        return F(y).map((v, r) => (v - f[r]) / h);
      });
      const dx = loese([0, 1].map((r) => spalten.map((c) => c[r])), f);
      if (!dx) break;
      const k = Math.min(1, 10 / Math.max(...dx.map(Math.abs), 1e-9));
      x = x.map((v, n) => v - k * dx[n]);
    }
    j = solve(stell(x));
  }
  // An der Stange festhalten. Beim Griff an eine Stange bleiben die Hände
  // stehen und der Körper bewegt sich – andersherum wanderte die Stange mit
  // den Händen mit, was sofort als Fehler auffällt.
  if (spec.anchor === 'bar') {
    const barY = spec.barY === undefined ? 0.52 : spec.barY;
    const hand = mitte(j.handL, j.handR);
    return verschiebe(j, [-hand[0], barY - hand[1], -hand[2]]);
  }
  j = verschiebe(j, [0, -Math.min(...Object.values(j).map((q) => q[1])) + BODEN, 0]);
  // Was steht: beim Stütz die Hände, bei stehenden und sitzenden Figuren die
  // Füße. Liegende Figuren ohne Stütz bleiben, wie sie sind – dort liegt der
  // Rücken, und der Rücken ist lang genug, um nicht aufzufallen.
  let fest = null;
  if (spec.stuetz) fest = (x) => mitte(x.handL, x.handR);
  else if (!spec.lie) {
    const s = spec.stance || spec.poses[0].stance;
    fest = s ? (x) => x[`toe${s}`] : (x) => mitte(x.toeL, x.toeR);
  }
  if (fest && t !== 0) {
    const jetzt = fest(j);
    // Der Punkt am Start steht je Muster fest – siehe stuetzVorgaben().
    let start = festerPunkt.get(spec);
    if (!start) {
      start = fest(skelett(spec, 0));
      festerPunkt.set(spec, start);
    }
    j = verschiebe(j, [start[0] - jetzt[0], 0, start[2] - jetzt[2]]);
  }
  return j;
}

/* ------------------------------------------------------------------ *
 * Stellungen – je Muster Start und Ende
 * ------------------------------------------------------------------ */

/*
 * `daumen` sagt, wohin der Daumen zeigt – und damit, wie gegriffen wird:
 *
 *     „Man soll bei jeder Übung auch die Finger sehen können damit man sieht
 *      obs Ober- oder Untergriff ist"
 *
 *   innen    Obergriff: Handrücken zum Gesicht bzw. nach oben, Daumen zueinander
 *   aussen   Untergriff: Handflächen zum Gesicht, Daumen nach außen
 *   vorn     neutral bei hängenden Armen (Hammercurl, Hantel an der Seite,
 *            Seitheben mit Handfläche nach unten)
 *   hinten   neutral über Kopf (Trizeps hinter dem Kopf)
 *   oben     neutral vor dem Körper
 *
 * Das ist Anatomie, keine Zeichenkonvention: Bei hängenden Armen und nach vorn
 * gedrehten Handflächen stehen die Daumen außen; wer die Hand eindreht
 * (Obergriff), dreht den Daumen nach innen. `finger: 'boden'` für Hände, die
 * flach aufliegen – dort zeigen die Finger zum Kopf –, `finger: 'schale'` für
 * die Hände unter der Goblet-Hantel (Handflächen oben, Finger außen um die
 * Scheibe, Daumen hinten um den Griff; siehe GOBLET_SCHALE). `hantelLaengs`
 * legt die Kurzhantel längs in die Faust, wie sie bei neutralem Griff liegt –
 * quer zum Unterarm, siehe laengsAchse().
 */

/*
 * Füße aufgestellt – für alles, was mit angewinkelten Beinen auf dem Rücken
 * liegt: Bodenpresse, Bodenpresse an der Stange, Trizeps im Liegen, Crunch.
 *
 * Vorher stand hier L(56, 9, 100), bzw. beim Crunch L(58, 9, 104). Der tiefste
 * Punkt war damit in jeder Stellung die Hüfte, und Knöchel wie Zehen hingen
 * 0,07 Körperlängen darüber – die Füße schwebten, während der Hinweis „Füße
 * aufstellen" sagt. Gefunden bei der Durchsicht der Figuren.
 *
 * Bei p 56 legt erst k 116 die Ferse auf Hüfthöhe (nachgerechnet mit solve(),
 * Knöchel 0,001 über der Hüfte). Das ist dieselbe Abmachung wie bei
 * Beckenheben, Hip Thrust und Beinbeuger: Steht der Fuß, liegt der Knöchel
 * auf dem Boden.
 */
const AUFGESTELLT = L(56, 9, 116);

/*
 * Arme beim Goblet Squat – oben und unten.
 *
 *     „Findest du seine handpositionen sehen gesund aus?"
 *
 * Taten sie nicht. Mit A(26, -18, 130, 32) zog die Adduktion die Arme über die
 * Mitte hinaus: Die linke Hand stand 0,04 rechts der Mitte, die rechte ebenso
 * weit links, die Unterarme kreuzten sich vor der Brust, und mit `finger:
 * 'oben'` standen die Hände hochkant vor dem Kinn – wie zum Beten. So hält
 * niemand eine Hantel, und wer es nachmacht, verdreht sich die Handgelenke.
 *
 * Die zweite Fassung (v228, A(18, -18, 145, -2) und A(34, -20, 155, -6))
 * stellte die Arme richtig hin, aber die Hände nicht an die Hantel: Sie saßen
 * in der Scheibe statt darunter – siehe GOBLET_SCHALE, dort steht der ganze
 * Griff und wie er gefunden wurde. Arme und Schale sind zusammen gesucht,
 * gegen dieselben Ziele: Oben stehen die Handgelenke 0,067 neben der Achse und
 * 0,15 vor der Brust, die Ellenbogen zeigen bei ±0,13 nach unten, eng am
 * Rumpf; unten in der Hocke bei ±0,17. Die Unterarme stehen steil (mindestens 82 %
 * senkrecht) und öffnen sich nach unten leicht zum V – so laufen sie außen an
 * der unteren Scheibe vorbei statt durch sie hindurch.
 */
const GOBLET_ARM = [A(10.3, -17.6, 146.7, -2.6), A(26.5, -10, 152, 14.8)];

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
    daumen: 'hinten', finger: 'schale',
    label: 'Kniebeuge',
    poses: [
      // lean unten bewusst moderat: mit 42° klappte die Figur zusammen und der
      // Kopf stand auf Kniehöhe. Beim Goblet Squat bleibt der Rumpf aufrecht.
      { lean: 6, arm: GOBLET_ARM[0], leg: L(2, 5, 4) },
      { lean: 24, arm: GOBLET_ARM[1], leg: L(100, 9, 118) },
    ],
  },
  legcurl: {
    /*
     * Rücken am Boden, Hüfte oben, Fersen schieben auf dem Handtuch weg.
     *
     *     „Die Animation sieht noch immer komisch aus. Es sieht so aus als
     *      wären die Füße iwie erhöht?"
     *
     * Waren sie auch. Nachgemessen (tools/pose.mjs, Maße in Körperlängen über
     * dem Boden):
     *
     *              Schulter   Hüfte    Knie     Fuß
     *   vorher        0.07     0.22    0.39    0.48   ← Ferse über dem Knie
     *   nachher       0.10     0.29    0.41    0.00
     *
     * Der Fuß lag höher als das Knie und höher als die Hüfte – die Figur
     * schwebte mit angezogenen Beinen in der Luft, und genau so sah sie aus.
     * Bei einer Übung, deren ganzer Witz das Rutschen auf dem Boden ist, ist
     * das nicht ein Schönheitsfehler, sondern eine falsche Anleitung.
     *
     * Jetzt liegt die Ferse auf dem Boden (0.000 in beiden Stellungen) und
     * wandert von x 0.48 auf x 0.82 – das Wegschieben ist die Bewegung, die man
     * sieht. Die Hüfte bleibt oben, wie der Hinweis es verlangt: Sie sackt von
     * 0.29 nur auf 0.24 ab, statt sich mitzusenken.
     *
     * Gesucht wurden die Winkel gegen diese Zielmaße, nicht nach Augenmaß.
     *
     * Dazu ein Handtuch unter jeder Ferse (slider) – ohne es bliebe offen,
     * worauf da gerutscht wird.
     */
    label: 'Beinbeuger', lie: 'supine', view: [20, -30], slider: true,
    poses: [
      // arm.p 0: die Arme liegen längs am Körper. Mit Beugung schwebten sie
      // sichtbar über dem Rumpf.
      { tilt: 27, arm: A(0, 17, 6), leg: L(-10, 6, 98) },
      { tilt: 22, arm: A(0, 17, 6), leg: L(-34, 6, 8) },
    ],
  },
  thrust: {
    daumen: 'innen',
    /*
     * Schulterblätter auf der Bank, Füße am Boden, Hüfte auf und ab.
     *
     * *„Teilweise sind die animationen noch irre führend. Kannst ja hier zb
     * auch ne Couch oder bank oder so einfügen damit man erkennt was los ist."*
     *
     * Nachgemessen, was vorher dastand (tools/pose.mjs, Maße in Körperlängen
     * über dem Boden):
     *
     *              Schulter   Hüfte    Knie     Fuß   Schienbein
     *   unten         0.03     0.09    0.41    0.08      36° schräg
     *   oben          0.11     0.33    0.58    0.20      26° schräg
     *
     * Das ist kein Hip Thrust. Die Schultern lagen am Boden, die Knie standen
     * höher als alles andere, und die Füße schwebten – die ganze Figur war eine
     * schräg gekippte Beckenbrücke in der Luft. Eine Bank darunterzumalen hätte
     * daran nichts geändert; sie wäre ein Streifen am Boden gewesen.
     *
     * Jetzt:
     *
     *              Schulter   Hüfte    Knie     Fuß   Schienbein
     *   unten         0.40     0.10    0.40    0.00      13° schräg
     *   oben          0.40     0.40    0.40    0.00       0° senkrecht
     *
     * Die Schultern bleiben auf Bankhöhe, die Füße stehen (x 0.4 in beiden
     * Stellungen), und bewegt wird die Hüfte – von knapp über dem Boden bis in
     * die Linie Knie–Schulter. Genau das ist die Übung. Gesucht wurden die
     * Winkel nicht nach Augenmaß, sondern gegen diese Zielmaße.
     *
     * Der Blickwinkel muss zwei Dinge zugleich schaffen: Die Stange über der
     * Hüfte soll waagerecht liegen, und der Körper soll der Länge nach zu
     * sehen sein. Bei yaw 20 / pitch -30 lief die Stange schräg durch den
     * Körper; bei yaw 62 stand die ferne Scheibe neben dem Kopf.
     */
    label: 'Hüftstreckung', lie: 'supine', view: [16, -8], couch: true,
    poses: [
      { tilt: -38, arm: A(0, 17, 8), leg: L(76, 8, 115) },
      { tilt: 0, arm: A(0, 17, 8), leg: L(0, 8, 90) },
    ],
  },
  bridge: {
    /*
     * Dasselbe Aufrichten der Hüfte, nur ohne Bank: Schultern bleiben am Boden.
     *
     * Der Unterschied zum Hip Thrust ist genau einer, und er steht in den
     * Maßen (tools/pose.mjs, Körperlängen über dem Boden):
     *
     *              Schulter   Hüfte    Knie     Fuß   Schienbein
     *   Hip Thrust    0.40     0.14→0.42  0.41   0.00
     *   Beckenheben   0.07     0.10→0.30  0.40   0.00
     *
     * Die Schultern liegen, statt auf einer Kante aufzuliegen, und die Hüfte
     * kommt entsprechend weniger hoch – kürzerer Weg, dafür ohne Möbel. Genau
     * das ist der Grund, warum die Übung im Katalog steht: Sie braucht nichts
     * als den Boden.
     *
     * Die Füße stehen in beiden Stellungen an derselben Stelle (x 0.45).
     * Gesucht wurden die Winkel gegen diese Zielmaße, nicht nach Augenmaß –
     * ohne die Bedingung wanderte der Fuß um eine Fußlänge nach vorn, und die
     * Figur sah aus, als schöbe sie sich vom Boden weg.
     */
    label: 'Beckenheben', lie: 'supine', view: [16, -8], plateAt: 'hip',
    poses: [
      { tilt: 3, arm: A(0, 17, 8), leg: L(40, 8, 114) },
      { tilt: 28, arm: A(0, 17, 8), leg: L(-12, 8, 102) },
    ],
  },
  pushup: {
    daumen: 'innen', finger: 'boden',
    label: 'Liegestütz', lie: 'prone', stuetz: 'tilt',
    poses: [
      // Neigung, Schulterwinkel und Abspreizung rechnet stuetz() je Bild nach,
      // damit Hände und Zehen stehen bleiben. Vorgegeben ist nur, wo die Hände
      // aufsetzen (arm.p am Start) und wie weit die Ellbogen beugen (arm.e).
      //
      // arm.p 90 hieß: Arm senkrecht zum Rumpf, und weil der Rumpf schräg
      // steht, setzten die Hände vor dem Kopf auf (0,155 vor der Schulter).
      // Unten lagen die Unterarme dann fast flach (60° gegen die Senkrechte)
      // – ein Unterarmstütz, kein Liegestütz. Mit 64 stehen die Hände unter
      // der oberen Brust, unten neigt der Unterarm 30°, und mit der Beugung
      // 100 statt 80 kommt die Brust tiefer (0,28 statt 0,34 über dem Boden).
      { tilt: -16, arm: A(64, 16, 4), leg: L(0, 6, 4) },
      { tilt: -16, arm: A(40, 42, 100), leg: L(0, 6, 4) },
    ],
  },
  /*
   * Bodenpresse, Kurzhanteln.
   *
   * **Was falsch war, und es war beides in der unteren Stellung.** Nachgerechnet
   * mit solve(), Maße in Körperlängen ab Boden; die Schulter liegt bei x −0.42,
   * die Brust bei −0.28, der Kopf bei −0.63:
   *
   *              Hand x    Hand y   Ellbogen y
   *   vorher      −0.537    0.242      0.191
   *   jetzt       −0.282    0.231      0.039
   *
   * Erstens wanderten die Hanteln bis x −0.54 – das liegt zwischen Schulter und
   * Kopf, nicht über der Brust. Was da gezeichnet war, ist ein Überzug, keine
   * Presse. Zweitens schwebte der Ellbogen 0,19 über dem Boden. Gerade der Boden
   * ist bei dieser Übung der Punkt: Er begrenzt die Bewegung, der Oberarm liegt
   * unten auf. Ein Ellbogen in der Luft zeigt eine Übung, die es nicht gibt.
   *
   * Die obere Stellung stimmte und ist bis auf eine Nachkommastelle dieselbe
   * geblieben.
   */
  press: {
    daumen: 'innen',
    // Flacher als vorher (war 20/−30). Mit dem steilen Blick von oben verschwand
    // in der unteren Stellung die nahe Hantel hinter dem Rumpf, und übrig blieb
    // ein einarmiges Drücken. Bei 25/−12 stehen beide Ellbogen sichtbar am
    // Boden – nachgesehen an gerenderten Bildern, nicht geschätzt.
    label: 'Drücken im Liegen', lie: 'supine', view: [25, -12],
    poses: [
      { arm: A(10, 33, 104), leg: AUFGESTELLT },
      { arm: A(90, 10, 0), leg: AUFGESTELLT },
    ],
  },
  pressbar: {
    daumen: 'innen',
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
    // Derselbe Fehler wie beim Kurzhantelmuster, und derselbe Beleg – die
    // Stange lag unten bei x −0.586, also *hinter* der Schulter (−0.42) und
    // fast am Kopf (−0.63), bei einem Ellbogen 0,25 über dem Boden:
    //
    //              Hand x    Hand y   Ellbogen y   Griff z
    //   vorher      −0.586    0.293      0.251      0.350
    //   jetzt       −0.279    0.252      0.041      0.350
    //
    // Die Griffweite bleibt bei 0,350 – die Rechnung im Absatz darüber gilt
    // unverändert, und oben wie unten steht dieselbe Zahl. Was sich geändert
    // hat, ist allein, wohin die Stange fährt: über die Brust statt über den
    // Kopf, mit dem Oberarm auf dem Boden.
    // Der Blickwinkel ist mit der Stellung zurückgegangen, von yaw 35 auf 20.
    // Die 35 waren dafür da, dass die Stange „quer im Bild liegt statt schräg
    // durch den Brustkorb" – nötig war das, solange sie unten hinter der
    // Schulter stand und dabei den Rumpf kreuzte. Über der Brust tut sie das
    // nicht mehr. Nachgesehen an gerenderten Bildern bei 20/35/50/62: Ab 35
    // schneidet die nahe Scheibe in der unteren Stellung durch den Kopf, bei 50
    // quer durchs Gesicht. Bei 20 bleibt er frei, um den Preis, dass die Stange
    // stärker verkürzt erscheint – das ist der billigere Preis.
    label: 'Drücken im Liegen an der Stange', lie: 'supine', view: [20, -10],
    poses: [
      { arm: A(9, 15, 110), leg: AUFGESTELLT },
      { arm: A(90, 14, 0), leg: AUFGESTELLT },
    ],
  },
  row: {
    daumen: 'vorn', hantelLaengs: true,
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
    daumen: 'innen',
    // Wie beim Curl: Mit Rucksack wird er gehalten, nicht getragen.
    packAt: 'hand',
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
    daumen: 'aussen',
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
    daumen: 'innen',
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
    daumen: 'innen', finger: 'boden',
    // Umgekehrtes V: Hüfte ist der höchste Punkt, Hände und Füße am Boden,
    // der Kopf senkt sich zwischen die Hände. Die Arme zeigen senkrecht nach
    // unten, dafür muss arm.p der Rumpfneigung folgen (-p + lean = 0).
    label: 'Überkopf-Drücken', stuetz: 'lean',
    // Von der Seite, nicht vom Standardblick fast von vorn. Der zeigte genau in
    // die Achse des umgedrehten V: Hüfte, Rumpf, Kopf und beide Arme lagen
    // hintereinander, und übrig blieb ein Knäuel –
    //
    //     „Sieht schon sehr unordentlich aus"
    //
    // Bei 75° steht das V da: Hüfte oben, Kopf zwischen den Armen, Hände und
    // Füße am Boden, und die Arme liegen noch leicht versetzt statt deckungs-
    // gleich wie bei 90°.
    view: [75, 12],
    poses: [
      // lean 146 legte den Kopf zwischen die Hände auf den Boden. Bei 126 ist
      // die Hüfte klar der höchste Punkt und der Kopf bleibt darüber.
      // Nachgemessen bei der Durchsicht der App (v201): Mit lean 126 schwebten
      // die Hände schon am Start 0,055 über dem Boden, und beim Beugen hoben sie
      // bis 0,23 ab, während der Kopf stehen blieb – das Gegenteil der Übung.
      // Gesucht und nicht geschätzt: Hände und Zehen am Boden, ihr Abstand in
      // beiden Stellungen gleich (0,68), und der Kopf sinkt von 0,37 auf 0,11
      // zwischen die Hände. Dafür schließt sich die Hüfte etwas (Bein -30 auf
      // -40) und der Rumpf kippt weiter – so sieht ein Pike-Liegestütz aus.
      // Zwischen den beiden Stellungen hält skelett() die Hände am Boden.
      { lean: 134.5, arm: A(132, 10, 4), leg: L(-30, 6, 10) },
      { lean: 171, arm: A(140, 30, 90), leg: L(-40, 6, 10) },
    ],
  },
  ohp: {
    daumen: 'innen',
    // Sitzend von Schulterhöhe senkrecht nach oben.
    //
    // **Warum `i` hier stehen muss, und was ohne es herauskam.** Der Ellenbogen
    // beugt in dieser Figur nur in der Längsebene (rotX), die Abspreizung liegt
    // in der Frontalebene (rotZ). Ist der Oberarm weit abgespreizt, zeigt er
    // fast genau entlang der x-Achse – und eine Drehung *um* diese Achse
    // bewegt ihn nicht mehr. Die Beugung war damit unsichtbar, der Unterarm
    // blieb in der Verlängerung des Oberarms, und gezeichnet wurde: unten
    // beide Arme waagerecht ausgestreckt, die Hände 0,66 Körperlängen weit
    // draußen, oben ein Y. Das ist ein Seitheben mit anschließendem Y-Press,
    // und mit Gewicht in dieser Haltung sieht es nicht nur ungesund aus:
    //
    //     „Sieht iwie nicht so gesund aus"
    //
    // `i` dreht den Unterarm in der Frontalebene, also genau dort, wo er sich
    // bewegen soll. Bei i=90 steht er senkrecht auf dem abgespreizten Oberarm –
    // die Hand liegt über dem Ellenbogen statt neben ihm. Das ist die
    // Startposition, die der Hinweis der Übung seit jeher beschreibt:
    // „Hanteln von Schulterhöhe senkrecht nach oben."
    //
    // Nachgerechnet (tools/pose.mjs, Schulter liegt bei 0,42):
    //   unten  Ellenbogen 0,37 – knapp unter der Schulter, Hand 0,61 darüber
    //   oben   Hand 0,92, nach innen gewandert – über dem Kopf, nicht daneben
    // Dazwischen steigt die Hand durchgehend. p=26 unten stellt den Ellenbogen
    // leicht vor die Schulterachse, wie es der Hinweis verlangt.
    label: 'Schulterdrücken', seat: true,
    poses: [
      { lean: 4, arm: A(26, 78, 0, 90), leg: L(88, 8, 92) },
      { lean: 4, arm: A(6, 166, 8, 0), leg: L(88, 8, 92) },
    ],
  },
  hinge: {
    daumen: 'innen',
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
    daumen: 'vorn', hantelLaengs: true,
    // Einbeinig: das freie Bein steigt nach hinten, bis Rumpf und Bein eine
    // Linie bilden. stance nennt das Standbein. Dieselbe Hüfte nach hinten wie
    // oben, nur weniger – auf einem Bein geht das Gegengewicht ins Standbein.
    // Die Hantel hängt in der freien Hand (gewichtHand), so wie der Hinweis es
    // sagt – vorher hing sie immer rechts, hier also auf der Standseite.
    label: 'Hüftbeuge einbeinig', stance: 'R', gewichtHand: 'L', view: [38, -6],
    poses: [
      { lean: 4, arm: A(4, 9, 4), legR: L(4, 5, 8), legL: L(-6, 7, 14) },
      { lean: 74, arm: A(74, 9, 4), legR: L(18, 5, 20), legL: L(-70, 7, 10) },
    ],
  },
  splitsquat: {
    daumen: 'vorn', hantelLaengs: true,
    // Ein Bein vorn, eines hinten, beide Knie beugen. Der Rumpf bleibt
    // aufrecht – kippt er mit, wird daraus optisch eine Kniebeuge.
    label: 'Ausfallschritt', view: [42, -6],
    poses: [
      // Der Stand bleibt stehen, und das ist der ganze Punkt:
      //
      //     "Das hintere Bein bewegt sich immer mit. Aber solls ja eigentlich
      //      nicht oder?"
      //
      // Nicht, nein. Nachgerechnet mit tools/pose.mjs war der Abstand zwischen
      // den Zehen oben 0,62 Koerperlaengen und unten 1,03 - die Figur machte
      // beim Absenken einen Ausfallschritt nach hinten. Jetzt bleibt er ueber
      // die ganze Bewegung zwischen 0,62 und 0,65, die hintere Zehe zwischen
      // 0,020 und 0,034 ueber dem Boden (steht also), und die Huefte sinkt von
      // 0,845 auf 0,666. Gesenkt wird, nicht geschritten.
      //
      // Das hintere Knie geht dabei von 0,43 auf 0,23 ueber dem Boden, der
      // hintere Oberschenkel von -18 Grad (nach hinten geneigt) auf +6, steht
      // unten also fast senkrecht - genau so sieht ein Split Squat unten aus.
      { lean: 5, arm: A(5, 9, 4), legR: L(16, 6, 12), legL: L(-18, 7, 26) },
      { lean: 9, arm: A(9, 9, 4), legR: L(55, 6, 82), legL: L(6, 7, 86) },
    ],
  },
  kneeraise: {
    daumen: 'innen',
    // An der Stange hängend: nur die Beine arbeiten, die Arme bleiben oben.
    label: 'Knieheben', anchor: 'bar', bar: true, float: true,
    poses: [
      { arm: A(184, 17, 6), leg: L(4, 6, 14) },
      { arm: A(184, 17, 6), leg: L(96, 6, 108) },
    ],
  },
  kneeraisefloor: {
    /*
     * Knieheben im Liegen – die Bodenfassung des hängenden Kniehebens.
     *
     * Sie gibt es, weil die hängende Fassung fast immer am Griff endet und
     * nicht am Bauch:
     *
     *     „Beim hängenden Beinheben merk ich eigentlich nur die Arme und muss
     *      nach zwei Wiederholungen abbrechen, weils halt so in den Fingern
     *      schmerzt."
     *
     * Gerechnet, nicht geschätzt (Maße in Körperlängen, Hüfte im Ursprung, x
     * längs, y hoch):
     *
     *                Knie          Knöchel
     *   Start    x 0.28 y 0.33   x 0.53 y 0.00   Füße stehen am Boden
     *   Ende     x −0.18 y 0.40  x 0.23 y 0.46   Knie über dem Bauch, Füße frei
     *
     * Am Start stand hier bis zur Durchsicht der Figuren L(50, 9, 95), und
     * der Knöchel lag 0,04 über der Hüfte, also in der Luft – dieselbe Sache
     * wie bei AUFGESTELLT oben. Mit k 103 steht er.
     *
     * Das negative x am Ende ist der Punkt: Die Knie kommen über die Hüfte
     * hinaus Richtung Brust, und genau dieses letzte Stück ist das Einrollen
     * des Beckens – die Arbeit, um die es geht. Ein Ende bei x über null wäre
     * bloß angehobenes Bein.
     *
     * Die Arme liegen längs am Körper (arm.p 0, wie bei legcurl): Beim
     * Knieheben im Liegen schiebt man die Hände unter das Gesäß, und alles
     * andere sähe aus, als hielte man sich irgendwo fest – das ist bei dieser
     * Fassung gerade nicht der Fall.
     */
    label: 'Knieheben im Liegen', lie: 'supine', view: [20, -30],
    poses: [
      { arm: A(0, 17, 6), leg: L(50, 9, 103) },
      { arm: A(0, 17, 6), leg: L(98, 9, 105), becken: 15 },
    ],
  },
  pullapart: {
    daumen: 'innen',
    // Arme vorn auf Schulterhöhe, dann zur Seite auseinander. Der Rumpf bleibt
    // stehen – zieht er mit, wird daraus ein Rudern.
    // band: 'hands' – hier hält man das Band wirklich zwischen beiden Händen,
    // anders als bei allen übrigen Bandübungen, wo man darauf steht.
    // Blick schräg von oben statt [16, -6]: Fast von vorn war der nahe Unterarm
    // am Start auf ein Siebtel verkürzt, die Hand ein Klecks vor der Brust.
    label: 'Band auseinanderziehen', band: 'hands', view: [35, 12],
    poses: [
      { lean: 3, arm: A(86, 8, 8), leg: L(2, 5, 4) },
      { lean: 3, arm: A(8, 86, 8), leg: L(2, 5, 4) },
    ],
  },
  facepull: {
    daumen: 'innen',
    /*
     * Face Pull: Band ueber der Klimmzugstange, Zug zum Gesicht.
     *
     * Eine eigene Uebung und kein Zusatz im Text des Pull-Aparts:
     *
     *     "Hier sind wieder zwei Uebungen in einer? Jede Uebung soll wirklich
     *      nur eine Uebung sein. Ohne Variationen usw."
     *
     * Der sichtbare Unterschied zum Pull-Apart ist die Zugrichtung: Dort haelt
     * man das Band zwischen den Haenden und zieht nach aussen, hier haengt es
     * von oben und man zieht zum Gesicht. Deshalb `band: 'bar'` - zwei Straenge
     * von den Haenden senkrecht nach oben zur Stange.
     *
     * Unten: Arme nach vorn oben, fast gestreckt. Oben: Ellenbogen hoch und
     * nach aussen, Haende neben den Schlaefen.
     *
     * **Der Ellenbogen muss ueber `i` gebeugt werden, nicht ueber `e`.** Das
     * ist derselbe Fehler, der beim Schulterdruecken aufgefallen ist (siehe
     * `ohp` weiter oben): `e` beugt in der Laengsebene, die Abspreizung liegt
     * in der Frontalebene. Ist der Oberarm weit abgespreizt, zeigt er fast
     * entlang der x-Achse, und eine Beugung *um* diese Achse klappt den
     * Unterarm nach aussen statt nach oben. Gezeichnet wurde damit:
     *
     *     „Irgendwie sieht die Animation bei face pull falsch aus"
     *
     * Nachgerechnet (tools/pose.mjs, Schulter bei 0,42, Kopf bei 0,63):
     *   alt  A(64, 58, 104)  Ellenbogen 0,44 – Hand 0,66 *weiter draussen als
     *                        der Ellenbogen*, auf Brusthoehe. Also kein Zug
     *                        zum Gesicht, sondern ein breites Auseinander-
     *                        ziehen mit fast gestreckten Armen.
     *   neu  A(8, 84, 4, 120) Ellenbogen 0,48 auf Schulterhoehe (y 0,39), Hand
     *                        0,38 – nach innen gewandert – auf Kopfhoehe
     *                        (y 0,62). Ellenbogenwinkel 60 statt 131 Grad.
     * Das ist die Form, die der Hinweis der Uebung seit jeher beschreibt:
     * Ellenbogen hoch und nach aussen, Haende neben den Schlaefen.
     *
     * **Und der Anker gehoert nicht ueber den Kopf.** Gemeldet:
     *
     *     „Face pull check ich iwie nicht so. Ausserdem ist die klimmzugstange
     *      ja ganz weit oben eigentlich angebracht. Sicher dass face pull da
     *      die Optimale Uebung ist?"
     *
     * Die Frage war berechtigt, und das Bild gab ihr recht. Mit ueberkopf 0.95
     * stieg das Band am Start mit **68 Grad** an (zuerst als 82 gemessen, mit
     * der falschen Rechnung weiter unten), also steil von oben: Gezeichnet war ein Zug von ganz oben, und das
     * ist ein Latzug und kein Face Pull. Ein Face Pull will das Band etwa aus
     * Gesichtshoehe, waagerecht ins Gesicht gezogen - steht seit v190 auch im
     * Hinweis der Uebung.
     *
     * Gemessen mit dem Anker auf Kopfhoehe und weiter vorn (0.85) - und zwar
     * beim zweiten Anlauf richtig. Der erste (v190) setzte 0.68 und maß mit
     * einer eigenen Rechnung in tools/pose.mjs, in der die Huefte im Ursprung
     * liegt. Gezeichnet wird aber in Bodenkoordinaten, und dort sind 0.68 die
     * Schulterhoehe: Das Band fiel zur Stange ab (-21 Grad am Start), kam also
     * von unten. Gefunden bei der Durchsicht der App. Seit v201 rechnen
     * Zeichnung, Werkzeug und Test mit derselben skelett(), und damit:
     *   Anker 0.89 (Kopf 0.893)  t=0 steigt 15 Grad, t=0.5 21 Grad, t=1 waagerecht
     * Die Arme blieben, wie sie waren - sie stimmten.
     *
     * Weiter vorn heisst hier: einen Schritt zurueckgetreten. Das ist der
     * erste der drei Wege, die der Hinweis nennt, und der einzige, der sich
     * zeichnen laesst, ohne die Stange woanders hinzuhaengen.
     */
    /*
     * Und der Weg dazwischen. Mit Winkeln oder Gliedrichtungen gemischt lief
     * die Hand in einem weiten Bogen nach außen (bei t 0,5 0,59 neben der
     * Mitte, Griffweite 1,18 statt 0,65 und 0,76) – ein Auseinanderziehen,
     * kein Zug zum Gesicht. armweg 'hand' lässt die Hand führen: Sie kommt
     * fast gerade nach hinten (seitlich 0,32 → 0,42 → 0,38), der Ellenbogen
     * bleibt dabei über der Schulter (Elevation 104 → 92 → 84 Grad).
     */
    armweg: 'hand',
    // Blick schräger als früher [20, -8]: Der Zug läuft in die Tiefe, und fast
    // von vorn war davon nur ein verkürzter Unterarm zu sehen. Von 40 Grad sieht
    // man die Arme nach vorn greifen und die Ellenbogen nach hinten oben kommen;
    // weiter seitlich liefe das ferne Band am Ende quer durchs Gesicht.
    label: 'Face Pull', band: 'bar', ueberkopf: 0.89, ueberkopfZ: 0.85, view: [40, -6],
    poses: [
      { lean: 4, arm: A(104, 12, 8), leg: L(2, 5, 4) },
      { lean: 4, arm: A(8, 84, 4, 120), leg: L(2, 5, 4) },
    ],
  },
  curl: {
    daumen: 'aussen',
    // Ein Rucksack an den Trageschlaufen hängt in den Händen, nicht am Rücken –
    // siehe die Zeichnung des Geräts weiter unten.
    packAt: 'hand',
    label: 'Bizeps-Curl',
    poses: [
      { lean: 3, arm: A(4, 8, 6), leg: L(2, 5, 4) },
      { lean: 3, arm: A(12, 8, 126), leg: L(2, 5, 4) },   // oben auf Brusthöhe, nicht am Kinn
    ],
  },
  hammercurl: {
    daumen: 'vorn',
    // Dieselbe Bewegung wie `curl`, und deshalb dieselben Winkel – der
    // Unterschied steckt allein in der Hand. Beim Hammercurl zeigen die
    // Handflächen zueinander, die Hantel liegt also längs zum Körper statt
    // quer. Genau das ist der Punkt der Übung: Der Unterarm bleibt in der
    // Mittelstellung zwischen Auf- und Zudrehen, und das Handgelenk muss
    // unter Last nichts halten, was es nicht von selbst tut.
    //
    // Die Winkel der Figur können das nicht zeigen – ein Strichmännchen hat
    // keine Handfläche. Sichtbar wird es nur an der Hantel, und darum steht
    // hier `hantelLaengs`. Ohne die Kennzeichnung sähe das Bild aus wie das
    // der SZ-Curls, und der Tausch, um den es hier geht, wäre unsichtbar.
    hantelLaengs: true,
    label: 'Hammercurl',
    poses: [
      { lean: 3, arm: A(4, 8, 6), leg: L(2, 5, 4) },
      { lean: 3, arm: A(12, 8, 126), leg: L(2, 5, 4) },
    ],
  },
  triceps: {
    daumen: 'innen',
    // Oberarm bleibt senkrecht stehen, nur der Ellenbogen arbeitet
    label: 'Trizeps-Strecken', lie: 'supine', view: [20, -30],
    poses: [
      { arm: A(84, 8, 112), leg: AUFGESTELLT },
      { arm: A(90, 8, 4), leg: AUFGESTELLT },
    ],
  },
  tricepsoh: {
    daumen: 'hinten',
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
    daumen: 'vorn', hantelLaengs: true,
    // Sitzend: Hüfte und Knie rechtwinklig, dazu eine Bank unter dem Gesäß.
    // Ohne die stünde die Figur nur mit angewinkelten Beinen in der Luft.
    label: 'Seitheben', seat: true,
    poses: [
      { lean: 4, arm: A(6, 10, 10), leg: L(88, 8, 92) },
      { lean: 4, arm: A(6, 92, 10), leg: L(88, 8, 92) },
    ],
  },
  // Dieselbe Bewegung im Stehen – für die Bandfassung, bei der man auf dem Band
  // steht. Sitzend gezeichnet lief das Band von den Händen hinunter zu Füßen,
  // die auf einer Bank ruhten: eine Verankerung, die es dort gar nicht gibt.
  lateralstand: {
    daumen: 'vorn',
    label: 'Seitheben im Stehen',
    poses: [
      { lean: 2, arm: A(6, 10, 10), leg: L(4, 4, 4) },
      { lean: 2, arm: A(6, 92, 10), leg: L(4, 4, 4) },
    ],
  },
  // Und dasselbe fürs Drücken. „Auf das Band stellen" heißt stehen, auch wenn
  // die Hantelfassung derselben Übung sitzt. Winkel wie bei `ohp`, samt der
  // Unterarmdrehung `i` – derselbe Fehler stand hier zweimal.
  ohpstand: {
    daumen: 'innen',
    label: 'Schulterdrücken im Stehen',
    poses: [
      { lean: 2, arm: A(26, 78, 0, 90), leg: L(4, 4, 4) },
      { lean: 2, arm: A(6, 166, 8, 0), leg: L(4, 4, 4) },
    ],
  },
  reversefly: {
    // Längs zum Kopf, nicht in Blickrichtung – siehe laengsAchse().
    daumen: 'vorn', hantelLaengs: 'kopf',
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
      { lean: 0, arm: A(46, -6, 120, 26), leg: AUFGESTELLT },
      { lean: 34, arm: A(46, -6, 120, 26), leg: AUFGESTELLT },
    ],
  },
  legcurl1: {
    // Einbeinig: das freie Bein bleibt angewinkelt in der Luft. Das Standbein
    // bekommt dieselben Winkel wie bei `legcurl` – es ist dieselbe Bewegung,
    // und dort sind sie gegen Zielmaße gesucht. Das Handtuch liegt nur unter
    // der arbeitenden Ferse.
    label: 'Beinbeuger einbeinig', lie: 'supine', view: [20, -30], slider: 'R',
    poses: [
      { tilt: 27, arm: A(0, 17, 6), legR: L(-10, 6, 98), legL: L(20, 12, 100) },
      { tilt: 22, arm: A(0, 17, 6), legR: L(-34, 6, 8), legL: L(20, 12, 100) },
    ],
  },
  thrust1: {
    /*
     * Dieselbe Übung auf einem Bein, auf der Sofakante – und
     * deshalb dieselben Winkel für das Standbein wie bei `thrust`.
     *
     * Das freie Bein hält seine Richtung im *Raum*, nicht zum Rumpf: Beim
     * Absenken kippt der Rumpf um 38°, und ein Bein mit festen Gelenkwinkeln
     * schwenkte um dieselben 38° mit – es sähe aus, als würde es mitgetreten.
     * Deshalb ist `p` unten um genau diese 38° größer. Nachgemessen bleibt der
     * freie Fuß dadurch über der ganzen Bewegung an derselben Stelle (x 0.80)
     * und steigt nur mit der Hüfte: 0.34 unten, 0.62 oben – immer deutlich über
     * dem Standfuß. Schwebte er nur knapp, setzte ihn die Bodenrechnung von
     * js/figure.js mit auf den Boden, und aus der einbeinigen Übung würde eine
     * zweibeinige.
     */
    label: 'Hüftstreckung einbeinig', lie: 'supine', view: [16, -8], couch: true,
    poses: [
      { tilt: -38, arm: A(0, 17, 8), legR: L(76, 8, 115), legL: L(62, 12, 20) },
      { tilt: 0, arm: A(0, 17, 8), legR: L(0, 8, 90), legL: L(24, 12, 20) },
    ],
  },
  calf1: {
    daumen: 'vorn', hantelLaengs: true,
    // Ein Bein trägt, das andere hängt angewinkelt hinten
    label: 'Wadenheben einbeinig', stance: 'R', stufe: 'R',
    poses: [
      // Knie nach hinten, nicht nach vorn – sonst sieht es aus wie ein Ausfallschritt
      { lean: 2, arm: A(4, 8, 8), legR: L(2, 5, 4), legL: L(-14, 7, 72), heel: 0 },
      { lean: 2, arm: A(4, 8, 8), legR: L(2, 5, 4), legL: L(-14, 7, 72), heel: 1 },
    ],
  },
  pushupfeet: {
    daumen: 'innen', finger: 'boden',
    // Füße erhöht: positiver tilt hebt das Fußende, dazu ein Kasten darunter
    label: 'Liegestütz mit erhöhten Füßen', lie: 'prone', step: true, stuetz: 'tilt',
    poses: [
      // Arme wie beim Liegestütz, siehe dort – nur setzt arm.p hier bei 85
      // an: Der Rumpf fällt zum Kopf hin ab, und mit 64 wie dort landeten die
      // Hände unter dem Bauch (0,265 hinter der Schulter).
      { tilt: 8, arm: A(85, 16, 4), leg: L(0, 6, 4) },
      { tilt: 8, arm: A(40, 42, 100), leg: L(0, 6, 4) },
    ],
  },
  calfbent: {
    daumen: 'vorn', hantelLaengs: true,
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
  /*
   * Fersenerhöht – und man sieht es auch.
   *
   *     „Hier sieht man ja auch gar keinen Gegenstand dass die Ferse iwie
   *      erhöht ist oder so."
   *
   * Stimmt: Beide Goblet Squats liefen auf demselben Bewegungsbild. Die
   * fersenerhöhte Fassung *ist* aber eine andere Übung – das Schienbein darf
   * weiter nach vorn kippen, das Knie über die Zehen wandern, und davon lebt
   * sie. Zwei identische Bilder unter zwei verschiedenen Namen sind schlimmer
   * als gar keins: Sie behaupten, es sei dasselbe.
   *
   * Zwei Dinge machen den Unterschied sichtbar:
   *
   *   `heel`  hebt alles außer den Zehen. Genau das ist die Geometrie einer
   *           erhöhten Ferse – dieselbe Mechanik wie beim Wadenheben, nur
   *           andersherum gelesen: Dort steigt der Körper, hier steht er auf
   *           einem Keil.
   *   `keil`  zeichnet den Keil darunter. Ohne ihn stünde die Figur auf
   *           Zehenspitzen, und das wäre eine dritte Übung.
   *
   * Die Beugung geht dabei etwas tiefer als ohne Keil (leg.k 118 → 126): Mehr
   * Tiefe ist der Grund, warum man die Fersen überhaupt erhöht.
   */
  squatheel: {
    daumen: 'hinten', finger: 'schale',
    // Mehr von der Seite als die freie Kniebeuge (Vorgabe yaw 25): Sonst
    // steht die Erhöhung von vorn gesehen hochkant hinter dem Fuß und ist
    // damit genau das, was sie nicht sein soll – unsichtbar.
    //
    // Zwei Hantelscheiben, kein Keil – seit dem 25.09. steht „Fersen auf je
    // einer Hantelscheibe, 2–4 cm hoch" im Hinweis (siehe scheiben unten):
    //
    //     „Die Hantelscheibe auf dem Boden sieht noch nicht so hantelscheibig
    //      aus"
    //
    // Ein einzelner Keil über beide Füße war weder eine Scheibe (rund, hell,
    // metallisch) noch zwei (er saß als eine Brücke unter beiden Fersen
    // zugleich) – er hatte dieselbe grau-blaue Farbe wie die Bank, also wie
    // ein Möbelstück, nicht wie Eisen.
    label: 'Kniebeuge, Fersen erhöht', fersenscheiben: true, view: [62, -4],
    poses: [
      { lean: 6, arm: GOBLET_ARM[0], leg: L(2, 5, 4), heel: 0.16 },
      { lean: 20, arm: GOBLET_ARM[1], leg: L(104, 9, 126), heel: 0.16 },
    ],
  },
  squatheelbw: {
    label: 'Kniebeuge ohne Gewicht, Fersen erhöht', keil: true, view: [62, -4],
    poses: [
      { lean: 6, arm: A(22, 10, 16), leg: L(2, 5, 4), heel: 0.16 },
      { lean: 26, arm: A(118, 10, 12), leg: L(104, 9, 126), heel: 0.16 },
    ],
  },
  invrow: {
    daumen: 'innen', packAt: 'chest',
    // Unter einer niedrigen Stange, Körper gerade, Brust zur Stange. Die Hände
    // bleiben an der Stange, der Körper dreht sich um die Fersen nach oben.
    label: 'Inverted Row', lie: 'supine', anchor: 'bar', barY: 0.04, bar: true,
    poses: [
      { tilt: -20, arm: A(92, 14, 8), leg: L(-2, 6, 4) },
      { tilt: -27, arm: A(58, 32, 88), leg: L(-2, 6, 4) },
    ],
  },
  tricepsbar: {
    daumen: 'innen',
    /*
     * Schräg stehend, Hände auf einer niedrigen Kante. Nur der Ellenbogen
     * arbeitet, der Kopf senkt sich unter die Kante.
     *
     * Das Muster lag lange ungenutzt herum – gezeichnet, aber von keiner Übung
     * benutzt. Seit trizeps-strecken-stange steht es im Katalog, und dabei
     * wurde nachgemessen, wie hoch die Kante hier eigentlich ist (Körperlängen
     * über dem Boden):
     *
     *              Kante    Hüfte  Schulter    Kopf
     *   oben        0.42     0.66     0.93     1.07
     *   unten       0.41     0.52     0.72     0.82
     *
     * 0.42 ist nicht Hüfthöhe, sondern Oberschenkelhöhe – und damit ziemlich
     * genau die Tischkante: 75 cm bei 1,80 m Körpergröße sind 0.42. Der Hinweis
     * der Übung sagt deshalb „Tischkante", nicht „hüfthoch". Die Zeichnung
     * folgt nicht dem Text, der Text folgt der Messung.
     *
     * `barY` verschiebt dabei nur die ganze Figur mit; der Boden wird an ihrem
     * tiefsten Punkt gezeichnet. Die Höhe der Kante über dem Boden steckt
     * allein in den Winkeln.
     */
    label: 'Trizeps an der Stange', anchor: 'bar', barY: 0.02, bar: true,
    // Von der Seite, wie beim Pike und aus demselben Grund. Im Standardblick
    // (yaw 25) neigt sich der Körper fast genau auf die Kamera zu: Rumpf und
    // Kopf deckten beide Beine bis auf zwei Stummel unter der Stange, und die
    // schräge Linie von der Ferse bis zum Kopf, die der Hinweis verlangt, war
    // in keinem Bild zu sehen. Bei 70° steht sie da, die Hände an der Kante,
    // und die Arme liegen noch leicht versetzt statt deckungsgleich.
    view: [70, 8],
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
    /*
     * Der Bogen geht seitlich, nicht durch den Boden.
     *
     * Vorher liefen die Arme über arm.p von 164 auf 26, also über die
     * Beugung nach vorn – und „vorn" ist in Bauchlage der Boden. Auf halbem
     * Weg zeigte der Arm senkrecht nach unten, die Hand wurde ab t≈0,45 zum
     * tiefsten Punkt, und weil skelett() den tiefsten Punkt auf den Boden
     * setzt, hob die ganze liegende Figur ab (Füße bis 0,10 über dem Boden)
     * und sank zum Ende wieder. Ein Snow Angel ist aber ein Bogen in der
     * Rumpfebene: von über dem Kopf über die Seite an die Hüfte, die Hände
     * dabei vom Boden gelöst.
     *
     * Also über die Abspreizung (160 → 14), und arm.p leicht negativ: Das
     * hebt die Arme in Bauchlage zur Decke. Nachgerechnet bleibt die Hand
     * über den ganzen Weg 0,11 bis 0,46 über dem Boden, die Zehen liegen in
     * jedem Bild auf, und am Ende steht die Hand neben der Hüfte (x 0,09 bei
     * Hüfte 0) statt im Boden.
     */
    poses: [
      // Brust deutlich angehoben: liegt der Rumpf flach, liegen auch die Arme
      // am Boden und von der Bewegung ist nichts zu sehen.
      { lean: -24, arm: A(-8, 160, 10), leg: L(0, 6, 4) },
      { lean: -24, arm: A(-8, 14, 10), leg: L(0, 6, 4) },
    ],
  },
  calf: {
    daumen: 'vorn', hantelLaengs: true,
    label: 'Wadenheben',
    poses: [
      { lean: 2, arm: A(4, 8, 8), leg: L(2, 5, 4), heel: 0 },
      { lean: 2, arm: A(4, 8, 8), leg: L(2, 5, 4), heel: 1 },
    ],
  },
};


/**
 * Gerät der Figur in der Bodyweight-Fassung, aus deren Gerätetext.
 *
 * Bodyweight heißt nicht gerätelos: Ein Loop-Band ist in beiden Fassungen
 * dasselbe Gerät, und ein Rucksack auch – Rucksack-Curls und Rucksack-Rudern
 * heißen in beiden so und sagen „beide Hände in die Trageschlaufen". Abgeleitet
 * wurde aber nur das Band, und die Figur curlte und ruderte mit leeren Fäusten.
 * Gefunden bei der Durchsicht der Figuren. Hier steht die Ableitung einmal;
 * resolve() in js/plan.js und die Übersicht figuren.html benutzen sie beide,
 * statt sie abzuschreiben.
 */
export function bwGeraet(equipText) {
  if (/band/i.test(equipText || '')) return 'band';
  if (/rucksack/i.test(equipText || '')) return 'backpack';
  // Flaschen-Seitheben, stehend und sitzend: „je eine gefüllte Flasche in die
  // Hand". Ohne die Ableitung hob die Figur leere Fäuste – in beiden
  // Fassungen, denn im Hantel-Modus nennt die Übung kein Gerät (siehe
  // figurGeraet).
  if (/flasche/i.test(equipText || '')) return 'bottles';
  return null;
}

/**
 * Gerät der Figur zu einer Übung in einer Fassung – für resolve() in
 * js/plan.js und die Übersicht figuren.html.
 *
 * Im Hantel-Modus das Gerät der Übung. Nennt sie keins (equip null), steht
 * das Hilfsmittel nur im Gerätetext – bei den Flaschen-Übungen „zwei volle
 * Flaschen" –, und dann gilt dieselbe Ableitung wie im Bodyweight-Modus.
 * Vorher hieß null dort „ohne Gerät", auch wo die Übung eins verlangt.
 */
export function figurGeraet(ex, modus) {
  if (modus === 'db' && ex.equip) return ex.equip;
  return bwGeraet(ex[modus] && ex[modus].equip);
}

/* ------------------------------------------------------------------ *
 * Hände und Gerät im Raum
 *
 * Bis zur Durchsicht der Figuren stand das alles mitten in draw(), zwischen
 * den Zeichenbefehlen. Ob eine Hand in der Hantelscheibe steckt, ließ sich
 * deshalb nur am Bild erraten – und beim Goblet Squat hat das Bild genau das
 * verborgen: Mit der Frage
 *
 *     „Findest du seine handpositionen sehen gesund aus?"
 *
 * im Rücken war die zweite Fassung (v228) wieder falsch, und keine Prüfung hat
 * es gemerkt, weil keine an die Hände herankam. Jetzt rechnen Zeichnung und
 * tests/test-figur.mjs mit denselben Punkten: wo die Hantel liegt, wo jede
 * Hand, jeder Finger und der Daumen.
 * ------------------------------------------------------------------ */

/** Achsen des Rumpfs: zur rechten Schulter, zum Hals, Blickrichtung. */
export function achsen(j) {
  const sideAxis = norm(sub(j.shoulderR, j.shoulderL));
  const upAxis = norm(sub(j.neck, j.hipC));
  // Blickrichtung des Rumpfes: gilt auch im Liegen, wo „vorn" nicht mehr zum
  // Betrachter zeigt.
  return { sideAxis, upAxis, frontAxis: norm(cross(sideAxis, upAxis)) };
}

/**
 * Maße einer Hantel entlang ihrer Achse, ab der Mitte: Griff bis ±innen,
 * dann je Seite eine große und eine kleinere Scheibe und der Stummel.
 * `plate` ist der alte Kreisradius in Bildpunkten, plate / 40 derselbe Radius
 * in Metern. `griffR` ist die halbe Strichstärke des Griffs.
 */
export function hantelTeile(plate, half) {
  const r = plate / 40;
  const dick = r * 0.42;
  const innen = half - dick * 1.6;
  return {
    r, dick, innen, griffR: 1.1 / 40, stummel: innen + dick * 2.35,
    scheiben: [[innen, innen + dick, r], [innen + dick, innen + dick * 1.75, r * 0.74]],
  };
}

/**
 * Achse einer längs gehaltenen Kurzhantel (neutraler Griff).
 *
 * Sie stand fest in Blickrichtung des Rumpfs, egal wohin der Unterarm zeigte.
 * Das stimmt nur, solange der Arm am aufrechten Körper hängt. Beim Hammercurl
 * zeigt der Unterarm mitten in der Wiederholung nach vorn, und die Hantel lag
 * in seiner Verlängerung (18° statt 90°); beim Reverse Fly und beim
 * einbeinigen Kreuzheben zeigt „vorn" zum Boden, und die Hantel hing senkrecht
 * am Arm entlang (9° bzw. 15°). Eine Faust kann so nichts halten. Gefunden bei
 * der Durchsicht der Figuren.
 *
 * Der Griff liegt quer in der Faust, also quer zum Unterarm, und beim
 * neutralen Griff in der Ebene von vorn nach hinten. Zwei Richtungen erfüllen
 * das, und jede versagt an einer Stelle: quer zu Unterarm und Schulterachse
 * (kreuz(u, Schulterachse)) ist null, wenn der Arm seitlich ausgestreckt ist
 * (Seitheben und Reverse Fly oben); die Vorzugsrichtung ohne ihren Anteil
 * längs des Unterarms ist null, wenn der Unterarm in sie zeigt. Genommen wird
 * deshalb die Hauptrichtung beider zusammen – gewichtet mit ihrer Länge, ohne
 * Vorzeichen, denn eine Hantel hat kein Vorn und Hinten. Wo die eine
 * verschwindet, trägt die andere, und weil beide quer zum Unterarm liegen,
 * tut es das Ergebnis auch, in jeder Stellung.
 *
 * Vorzugsrichtung ist die Blickrichtung des Rumpfs: Beim Seitheben zeigen die
 * Daumen oben nach vorn. Beim Reverse Fly (`hantelLaengs: 'kopf'`) ist es die
 * Richtung zum Kopf – vorgebeugt zeigt „vorn" zum Boden, also den Arm entlang,
 * und mit ihr als Vorzug drehte sich die Hantel mitten in der Bewegung um 60°
 * in der Faust.
 */
function laengsAchse(u, ach, vorzug = ach.frontAxis) {
  const c1 = cross(u, ach.sideAxis);
  const c2 = sub(vorzug, mul(u, skalar(u, vorzug)));
  // Hauptachse von c1·c1ᵀ + c2·c2ᵀ in der Ebene quer zu u. e1 ist nie null:
  // |c1|² + |c2|² ≥ 1, und mit gleichem Vorzeichen addiert heben sie sich
  // nicht auf.
  const e1 = norm(add(c1, mul(c2, skalar(c1, c2) < 0 ? -1 : 1)));
  const e2 = cross(u, e1);
  let a = 0; let b = 0; let c = 0;
  [c1, c2].forEach((v) => {
    const x = skalar(v, e1); const y = skalar(v, e2);
    a += x * x; b += x * y; c += y * y;
  });
  const w = 0.5 * Math.atan2(2 * b, a - c);
  return norm(add(mul(e1, Math.cos(w)), mul(e2, Math.sin(w))));
}
/** Längsachse in der Hand `s` – mit der Vorzugsrichtung des Musters. */
const laengsIn = (spec, j, s, ach) => laengsAchse(norm(sub(j[`hand${s}`], j[`elbow${s}`])), ach,
  spec.hantelLaengs === 'kopf' ? ach.upAxis : ach.frontAxis);

/*
 * Der Goblet-Griff, als Maße statt als Bild.
 *
 *     „Findest du seine handpositionen sehen gesund aus?"
 *
 * Zweimal nicht. Bis v227 kreuzten sich die Unterarme vor der Brust, und die
 * Hände standen hochkant vor dem Kinn. Die Fassung v228 legte die Hände unter
 * die Hantel, aber nur dem Anschein nach: Nachgerechnet saßen sie 0,061 neben
 * der Achse, bei einer Scheibe mit Radius 0,10 – also mitten in ihr. Die
 * Finger zeigten nach innen oben, steckten ab der halben Handfläche in beiden
 * oberen Scheiben und kreuzten sich 0,05 jenseits der Mitte; die Handflächen
 * zeigten nach unten, das Handgelenk war gebeugt; die untere Scheibe lief
 * durch die Unterarme, und weil die Hantel um 0,04 angehoben war, steckte die
 * obere Scheibe unten in der Hocke 0,04 im Kinn. Von vorn sah man von den
 * Händen nur grüne Schlitze, aus 45° gar nichts. Gefunden bei der Durchsicht
 * der Figuren.
 *
 * Gehalten wird so: Die Hantel steht senkrecht vor dem Brustbein und liegt an.
 * Beide Hände bilden unter der oberen Scheibe eine Schale – Handflächen nach
 * oben und etwas zueinander, das Handgelenk gestreckt (nach hinten
 * abgeknickt, nicht zur Handfläche hin), die Finger laufen außen um den Rand
 * der Scheibe nach oben, die Daumen legen sich hinten um den Griff. Die
 * Ellenbogen zeigen nach unten und bleiben eng, die Unterarme stehen steil
 * und gehen außen an der unteren Scheibe vorbei.
 *
 * Die Zahlen sind gesucht, nicht geschätzt – gegen messbare Ziele, dieselben,
 * die tests/test-figur.mjs (§17) über die ganze Bewegung prüft: keine Hand,
 * kein Finger und kein Daumen in Scheibe oder Griff, aber die Hände nah an
 * der Scheibe; Handflächen nach oben; Handgelenk gestreckt; keine
 * Fingerspitze über der Mitte; Unterarme außerhalb der unteren Scheibe; die
 * obere Scheibe mindestens einen Kopfradius vom Kopfmittelpunkt entfernt.
 * Gesucht über die Armwinkel oben und unten (GOBLET_ARM) und die Maße hier
 * zugleich, Zufallsstart und dann Nelder-Mead, für Kniebeuge und
 * fersenerhöhte Kniebeuge. Ergebnis über die ganze Bewegung: Hände höchstens
 * 0,01 unter bzw. neben der Scheibe und nirgends in ihr, Handflächen 45° zur
 * Mitte geneigt, Handgelenk 55–68° gestreckt, Daumenspitzen 0,06 hinter der
 * Achse, obere Scheibe mindestens 0,165 vom Kopfmittelpunkt (Kopfradius
 * 0,115), die Hantel liegt an der Brust an.
 *
 * Die Hantel ist dafür schlanker als vorher – Scheibe 0,075 statt 0,10, Griff
 * etwas länger. Mit Radius 0,10 fand die Suche keine Unterarme, die steil
 * stehen und trotzdem an der unteren Scheibe vorbeigehen: Die Glieder der
 * Figur sind gut doppelt so dick wie echte, die Hantel war es auch.
 *
 *   vor   die Achse liegt so weit vor der Mitte zwischen den Handgelenken
 *   tief  die Unterseite der oberen Scheibe liegt so weit über ihr
 *   kipp  die Handflächen sind um so viel Grad zur Mitte gekippt (0 = flach)
 *   beug  die Finger krümmen sich um so viel Grad zur Handfläche hin
 *   half, plate  Hantelmaße wie bei barAt()
 */
const GOBLET_SCHALE = { vor: 0.045, tief: 0.052, kipp: 45.2, beug: 59.3, half: 0.14, plate: 3.0 };

/** Die Goblet-Hantel – aus den Händen, siehe GOBLET_SCHALE. */
function gobletHantel(spec, j, ach) {
  const G = spec.schale || GOBLET_SCHALE;
  const { innen } = hantelTeile(G.plate, G.half);
  const w = mitte(j.handL, j.handR);
  return {
    centre: add(add(w, mul(ach.frontAxis, G.vor)), mul(ach.upAxis, G.tief - innen)),
    axis: ach.upAxis, half: G.half, plate: G.plate,
  };
}

/**
 * Die Hanteln und Stangen, die die Figur hält: je eine mit Mitte, Achse,
 * halber Länge, Scheibengröße und – wo sie quer über dem Körper liegt – der
 * Zahl der Stücke für den Maleralgorithmus (siehe barAt()).
 */
export function hanteln(spec, j, equip) {
  const ach = achsen(j);
  // Quer zum Körper liegt die Hantel bei aufgedrehtem Unterarm – so hält
  // man sie beim Seitheben, beim Drücken, beim gewöhnlichen Curl. Zeigen
  // die Handflächen dagegen zueinander (Hammercurl), liegt sie längs,
  // siehe laengsAchse(). Das ist der einzige sichtbare Unterschied zwischen
  // den beiden Curls, und ohne ihn wären es zwei gleiche Bilder.
  // Quer gehalten ebenso quer zum Unterarm: die Schulterachse ohne ihren
  // Anteil längs des Unterarms. Fest auf der Schulterachse stand die Hantel
  // beim Bodendrücken unten 57° zum Unterarm – schräg in der Faust.
  const querIn = (s) => {
    const u = norm(sub(j[`hand${s}`], j[`elbow${s}`]));
    const q = sub(ach.sideAxis, mul(u, skalar(u, ach.sideAxis)));
    // Liegt der Unterarm selbst auf der Schulterachse (kommt in keinem
    // Muster mit Kurzhanteln vor), bleibt es bei ihr.
    return Math.hypot(...q) > 1e-6 ? norm(q) : ach.sideAxis;
  };
  const achse = (s) => (spec.hantelLaengs ? laengsIn(spec, j, s, ach) : querIn(s));
  // 0.085 waren 19 cm – so kurz, dass sich die beiden Scheiben aus den
  // meisten Blickwinkeln zu einem einzigen Fleck überdeckten.
  const kurz = (s) => ({ centre: j[`hand${s}`], axis: achse(s), half: 0.13, plate: 3.4 });
  const mitteH = mitte(j.handL, j.handR);
  switch (equip) {
    case 'dumbbells': return [kurz('L'), kurz('R')];
    case 'onehand': return [kurz(spec.gewichtHand || 'R')];
    case 'goblet': return [gobletHantel(spec, j, ach)];
    // Eine Langhantel ist doppelt so breit wie die Schultern, und zwischen
    // Hand und Scheibe liegt ein gutes Stück blanke Stange. Mit dem alten
    // half = 0.34 war sie 75 cm lang: Die Scheiben klebten an den Händen und
    // das Ganze sah aus wie eine Kurzhantelstange. 0.56 ist immer noch kürzer
    // als in Wirklichkeit – weiter geht es nicht, ohne dass die Enden aus dem
    // Kasten laufen, denn der Ausschnitt richtet sich nach der Figur.
    case 'barbell': return [{ centre: mitteH, axis: ach.sideAxis, half: 0.56, plate: 4.4 }];
    // Eine SZ-Stange ist etwa halb so lang wie eine Langhantel; ihre
    // Ausbuchtungen fallen bei dieser Strichstärke ohnehin unter den Tisch.
    // Was man sehen soll, ist der Unterschied zur grossen Stange – und der
    // ist die Länge.
    case 'szbar': return [{ centre: mitteH, axis: ach.sideAxis, half: 0.34, plate: 4.0 }];
    // Auf der Hüftbeuge, nicht im Becken. Die Mitte lag bis zur Durchsicht
    // der Figuren genau auf der Hüftmitte – dem Mittelpunkt des Beckenrings,
    // 0,09 tief im Körper –, und zwischen den Scheiben war aus keinem Blick
    // ein Stück Stange zu sehen: zwei Scheiben, die neben der Hüfte
    // schweben. 0,11 nach vorn legt sie auf die Vorderseite des Beckens,
    // wie die Scheibe beim Beckenheben (siehe 'plate'); dazu der Griff in
    // Stücken, damit das Stück vor dem Körper auch vor ihm liegt.
    case 'hipbar': return [{
      centre: add(mitte(j.hipL, j.hipR), mul(ach.frontAxis, 0.11)), axis: ach.sideAxis, half: 0.56, plate: 4.4, teile: 12,
    }];
    default: return [];
  }
}

/*
 * Eine gefüllte Flasche je Hand – für das Seitheben mit Flaschen.
 *
 * Gehalten wie eine Kurzhantel im neutralen Griff, quer durch die Faust
 * (laengsAchse), der Hals auf der Seite des Daumens, also vorn bzw. oben.
 * Je Flasche Körper, Schulter, Hals und Deckel als Zylinder entlang der
 * Achse, von der Faust aus gemessen: [von, bis, Radius, Teil].
 */
const FLASCHE = [[-0.17, 0.06, 0.05, 'koerper'], [0.06, 0.095, 0.036, 'koerper'],
  [0.095, 0.125, 0.02, 'koerper'], [0.125, 0.155, 0.025, 'deckel']];
export function flaschen(spec, j, equip) {
  if (equip !== 'bottles') return [];
  const ach = achsen(j);
  const vorn = add(ach.frontAxis, mul(ach.upAxis, 0.3));
  return ['L', 'R'].map((s) => {
    const a = laengsIn(spec, j, s, ach);
    return { centre: j[`hand${s}`], axis: skalar(a, vorn) < 0 ? mul(a, -1) : a, teile: FLASCHE };
  });
}

/**
 * Eine Hand im Raum: Rahmen (f Finger, t Daumen, n Handfläche), die Fläche
 * als Vieleck und die Glieder als [von, bis, Breite, Breite] – Breiten wie
 * bei limb(), also w / 40 Körperlängen als halbe Dicke.
 *
 * Zwei Haltungen:
 *   aufliegend  flach, Finger gestreckt und leicht gespreizt – am Boden
 *               (`finger: 'boden'`), unter der Goblet-Hantel
 *               (`finger: 'schale'`, siehe GOBLET_SCHALE) und bei freien
 *               Händen;
 *   greifend    Faust um Stange, Hantel, Flasche oder Band: die Finger laufen
 *               über den Griff und krümmen sich auf der Seite der Handfläche
 *               zurück, der Daumen legt sich von der anderen Seite darum.
 *
 * Der Daumen zeigt weiter dorthin, wo das Muster es sagt (`daumen`, siehe
 * PATTERNS) – im Obergriff zueinander, im Untergriff nach außen. Das ist
 * der Unterschied zwischen Chin-ups und Pull-ups, und er bleibt sichtbar.
 *
 * Maße in Körperlängen, gut doppelt so groß wie echt: Die Glieder der
 * Figur sind es auch, und eine Hand in echter Größe wäre am Handy ein
 * Punkt.
 */
export function handForm(spec, j, seite, equip) {
  const ach = achsen(j);
  const { sideAxis, upAxis, frontAxis } = ach;
  const weltOben = [0, 1, 0];
  const hand = j[`hand${seite}`];
  const ell = j[`elbow${seite}`];
  const greifend = spec.daumen && !spec.finger;
  // Einarmig: nur die Hand mit der Hantel greift, die andere liegt auf.
  const faust = !!greifend && (equip !== 'onehand' || seite === (spec.gewichtHand || 'R'));
  const innen = mul(sideAxis, seite === 'L' ? 1 : -1);
  const richtung = faust || spec.finger ? spec.daumen : 'vorn';
  // Zu jeder Daumenrichtung eine Ersatzrichtung quer dazu, für den Fall,
  // dass der Wunsch längs des Unterarms liegt (siehe unten). Ein Wunsch
  // und sein Gegenteil teilen sie sich – so bleibt „aussen" genau die
  // umgedrehte Hand von „innen".
  const hinten = mul(frontAxis, -1);
  const [wunsch, ersatz] = ({
    innen: [innen, hinten], aussen: [mul(innen, -1), hinten],
    vorn: [frontAxis, innen], hinten: [hinten, innen],
    oben: [weltOben, innen], unten: [mul(weltOben, -1), innen],
  })[richtung] || [innen, hinten];
  const unterarm = norm(sub(hand, ell));
  let f = unterarm;
  let t;
  let n;
  let schale = null;
  if (spec.finger === 'schale') {
    /*
     * Schale unter der Goblet-Hantel. Erst die Handfläche: nach oben, um
     * `kipp` zur Mitte geneigt. Die Finger zeigen dann dorthin, wohin der
     * Unterarm in dieser Ebene zeigt – so knickt das Handgelenk nur nach
     * hinten (Streckung), nicht zur Seite. Bis v228 standen die Finger fest
     * „nach innen oben", unabhängig vom Arm, und mit dem Daumen „hinten"
     * zeigte die Handfläche dabei nach unten: ein gebeugtes Handgelenk unter
     * Last, das Gegenteil von gesund.
     */
    const G = spec.schale || GOBLET_SCHALE;
    schale = { G, hantel: gobletHantel(spec, j, ach) };
    const k = rad(G.kipp);
    n = norm(add(mul(upAxis, Math.cos(k)), mul(innen, Math.sin(k))));
    f = norm(sub(unterarm, mul(n, skalar(n, unterarm))));
    t = seite === 'R' ? cross(n, f) : cross(f, n);
  } else {
    if (spec.finger === 'boden') f = norm([upAxis[0], 0, upAxis[2]]);
    else if (spec.finger === 'oben') f = upAxis;
    // Der Daumen steht quer zu den Fingern: die gewünschte Richtung ohne
    // ihren Anteil längs des Arms. Liegt die gewünschte Richtung fast längs,
    // bleibt die Hand trotzdem eine Hand: dann eben quer zum Arm.
    //
    // Bis v218 hieß „quer" ab einem Rest unter 0,2 hart sideAxis – für
    // beide Hände dieselbe Achse, links also nach innen, rechts nach außen.
    // Die rechte Hand klappte dadurch mitten in der Wiederholung um 180° um
    // (Kniebeuge ohne Gewicht, Hammercurl, Pull-Apart, Reverse Fly), mit ihr
    // die Handfläche und bei der Faust die sichtbaren Finger, also genau der
    // Unterschied zwischen Ober- und Untergriff. Bei reduzierter Bewegung
    // stand die Kniebeuge sogar dauerhaft mit zwei verschiedenen Händen da.
    //
    // Jetzt kommt der Ersatz weich dazu, umso mehr, je kürzer der Rest –
    // keine Schwelle, an der etwas springt. Er ist gespiegelt wie die Hand
    // (`innen` ist links und rechts eine andere Achse) und kehrt sich mit
    // dem Arm um: skalar(f, wunsch) ist dort +1 oder −1, je nachdem, ob der
    // Arm in Wunschrichtung zeigt oder ihr entgegen. So zeigt der Ersatz
    // dorthin, wohin der Rest ohnehin zeigt, wenn der Arm wie fast immer
    // etwas abgespreizt ist und etwas vor dem Körper liegt. Umklappen könnte
    // die Hand nur noch, wo der Unterarm nach vorn oder hinten zeigt und
    // dabei zur Körpermitte hin, oder quer zum Körper, nach außen oder nach
    // innen, und dabei etwas hinter der Schulterlinie. Keins davon kommt in
    // einem Muster vor: Über alle Muster bleibt der Vektor vor dem Normieren
    // nie kürzer als 0,38 (gemessen 0,386), weit weg von der Stelle, an der
    // er null wird.
    const quer = (v) => add(v, mul(f, -skalar(v, f)));
    const rest = quer(wunsch);
    const kurz = Math.max(0, 1 - Math.hypot(...rest) / 0.5);
    t = norm(add(rest, mul(quer(ersatz), kurz * kurz * skalar(f, wunsch))));
    // Wohin die Handfläche zeigt. Welche Seite das ist, hängt an der Hand –
    // eine linke ist das Spiegelbild einer rechten. Nachgeprüft am
    // Liegestütz: Finger zum Kopf, Daumen nach innen, Handfläche zum Boden.
    n = seite === 'R' ? cross(f, t) : cross(t, f);
  }
  // RIG.handS: die Hand passend zu den schmaleren Armen (siehe RIG.armOben).
  // Nicht die Schale: Ihre Finger sind gegen die Goblet-Hantel gesucht, eine
  // kleinere Hand griffe 0,003 in die Scheibe.
  const hs = schale ? 1 : RIG.handS;
  const at = (df, dt, dn) => add(add(add(hand, mul(f, df * hs)), mul(t, dt * hs)), mul(n, dn * hs));
  const fingerAuf = [0.033, 0.011, -0.011, -0.033];   // Zeigefinger zuerst, am Daumen

  const stuecke = [];
  const glied = (a3, b3, w1, w2) => stuecke.push([a3, b3, w1 * hs, w2 * hs]);
  const vorn = [];
  // Die Handfläche zweimal: als Fläche, damit man von oben ihre Breite
  // sieht, und als Glied, damit sie von der Seite eine Dicke hat und nicht
  // zum Strich wird – bei den Liegestützen schaut man fast waagerecht auf
  // den Boden.
  let flaeche;
  if (faust) {
    // Die Handfläche liegt hinter dem Griff, der Griff quer über ihr.
    const h = -0.04;
    flaeche = [at(-0.06, 0.04, h), at(-0.015, 0.05, h), at(0.03, 0.048, h),
      at(0.04, 0, h), at(0.03, -0.048, h), at(-0.015, -0.05, h), at(-0.06, -0.04, h)];
    glied(at(-0.045, 0, h), at(0.025, 0, h), 1.25, 1.1);
    fingerAuf.forEach((o, i) => {
      const knoechel = at(0.032, o, h);
      const ueber = at(0.052 - i * 0.003, o, 0.002);
      const spitze = at(0.012, o * 0.92, 0.042);
      glied(knoechel, ueber, 0.8, 0.74);
      glied(ueber, spitze, 0.74, 0.64);
      vorn.push([ueber, spitze, 0.74 * hs, 0.64 * hs]);
    });
    glied(at(-0.04, 0.046, h + 0.012), at(-0.004, 0.052, 0.03), 0.92, 0.76);
    glied(at(-0.004, 0.052, 0.03), at(0.016, 0.03, 0.046), 0.76, 0.66);
    vorn.push([at(-0.004, 0.052, 0.03), at(0.016, 0.03, 0.046), 0.76 * hs, 0.66 * hs]);
  } else {
    flaeche = [at(0, 0.04, 0), at(0.045, 0.051, 0), at(0.088, 0.048, 0),
      at(0.097, 0, 0), at(0.088, -0.048, 0), at(0.045, -0.051, 0), at(0, -0.04, 0)];
    glied(at(0.01, 0, 0), at(0.085, 0, 0), 1.2, 1.0);
    // In der Schale krümmen sich die Finger zur Handfläche hin, um den Rand
    // der Scheibe; sonst liegen sie gestreckt in ihrer Ebene.
    const beug = schale ? Math.tan(rad(schale.G.beug)) : 0;
    [0.068, 0.078, 0.072, 0.058].forEach((lang, i) => {
      const o = fingerAuf[i];
      const von = at(0.08, o, 0);
      const dir = norm(add(add(f, mul(t, o * 1.6)), mul(n, beug)));
      glied(von, add(von, mul(dir, lang * hs)), 0.78, 0.6);
    });
    const dvon = at(0.024, 0.036, 0);
    if (schale) {
      // Der Daumen legt sich hinten um den Griff: von seinem Ansatz zu einem
      // Punkt knapp hinter der Achse, auf der eigenen Seite der Mitte – so
      // treffen sich die beiden Daumen hinter dem Griff, ohne sich zu kreuzen.
      const { hantel } = schale;
      const { griffR } = hantelTeile(hantel.plate, hantel.half);
      const aufAchse = add(hantel.centre, mul(hantel.axis, skalar(sub(dvon, hantel.centre), hantel.axis)));
      const ziel = add(add(aufAchse, mul(hinten, griffR + 0.9 / 40 + 0.004)), mul(innen, -(0.66 / 40 + 0.004)));
      const weg = sub(ziel, dvon);
      glied(dvon, add(dvon, mul(norm(weg), Math.min(0.068 * hs, Math.hypot(...weg)))), 0.9, 0.66);
    } else {
      glied(dvon, add(dvon, mul(norm(add(mul(t, 0.78), mul(f, 0.62))), 0.068 * hs)), 0.9, 0.66);
    }
  }
  return { faust, f, t, n, unterarm, flaeche, stuecke, vorn };
}

const NS = 'http://www.w3.org/2000/svg';
const CYCLE_MS = 4200;   // eine Wiederholung; das Tempo darin ist unsymmetrisch
const el = (name, attrs = {}) => {
  const node = document.createElementNS(NS, name);
  Object.entries(attrs).forEach(([k, v]) => node.setAttribute(k, v));
  return node;
};

const active = new Set();

/**
 * Halbe Länge der festen Stange, an der beim Face Pull das Band hängt.
 *
 * Bis zur Durchsicht der Figuren 0,9 – über zwei Meter bei einer Figur von
 * 1,80 m, also breiter als jede Tür, in die man eine Klimmzugstange hängt.
 * Seit der Ausschnitt die Stange mitzählt (fit), hätte diese Länge die ganze
 * Figur klein gedrückt. 0,6 reicht gut über beide Bänder hinaus.
 */
const UEBERKOPF_HALB = 0.6;

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
  hint.textContent = '↔ ziehen zum Drehen';
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

  /*
   * Drehen, ohne dass Scrollen die Figur umwirft.
   *
   *     „Die Arme sehen echt immer komisch aus"
   *
   * Das Bildschirmfoto dazu zeigte den Face Pull von hinten oben (yaw ≈ 130,
   * pitch ≈ 75): zwei Arme, darunter der Kopf als Kreis, kein Rumpf. Dorthin
   * kam die Figur beim Scrollen der Liste – `touch-action: none` und ein
   * Kippen ohne Grenze machten aus jedem Wisch über die Figur eine Drehung,
   * und zurück ging es nicht. Jetzt gehört senkrecht der Liste (pan-y),
   * gedreht wird erst, wenn die Geste klar waagerecht ist, und gekippt nur
   * von −35 (etwas von unten) bis 45 Grad (schräg von oben); liegende
   * Figuren dürfen bis −65. Ein Doppeltipp holt den Vorgabeblick zurück.
   * Von selbst federt nichts zurück: Wer eine Seite sucht, soll sie behalten.
   * Der Hinweis „↔ ziehen zum Drehen" geht erst beim echten Drehen weg, nicht
   * schon, wenn ein Finger zum Scrollen auf der Figur landet.
   */
  const home = [yaw, pitch];
  const KIPP = spec.lie ? [-65, 45] : [-35, 45];
  const kippMin = Math.min(KIPP[0], home[1]);
  const kippMax = Math.max(KIPP[1], home[1]);
  let zeiger = null;     // pointerId des drehenden Fingers
  const finger = new Set();   // Finger auf der Figur; zwei heißt zoomen, nicht drehen
  let startX = 0;
  let startY = 0;
  let entschieden = false;
  let tippZeit = 0;
  let federLauf = null;   // laufende Rückfahrt nach dem Doppeltipp
  const federStop = () => {
    if (federLauf) cancelAnimationFrame(federLauf);
    federLauf = null;
  };
  const zurueck = (sofort) => {
    federStop();
    const y0 = yaw; const p0 = pitch;
    const dy = ((((home[0] - y0) % 360) + 540) % 360) - 180;   // kürzester Weg
    if (sofort || reduceMotion.matches || typeof requestAnimationFrame !== 'function') {
      yaw = home[0]; pitch = home[1]; draw(lastT); return;
    }
    const t0 = performance.now();
    const schritt = (jetzt) => {
      const k = Math.min(1, (jetzt - t0) / 400);
      const e = k * k * (3 - 2 * k);
      yaw = y0 + dy * e; pitch = p0 + (home[1] - p0) * e;
      draw(lastT);
      federLauf = k < 1 ? requestAnimationFrame(schritt) : null;
    };
    federLauf = requestAnimationFrame(schritt);
  };
  const onDown = (e) => {
    finger.add(e.pointerId);
    federStop();
    if (zeiger !== null) { dragging = false; entschieden = true; return; }   // zweiter Finger
    zeiger = e.pointerId;
    startX = lastX = e.clientX;
    startY = lastY = e.clientY;
    entschieden = e.pointerType === 'mouse';
    dragging = entschieden;
    if (dragging) e.preventDefault();
  };
  const onMove = (e) => {
    if (e.pointerId !== zeiger) return;
    if (!entschieden) {
      const dx = e.clientX - startX; const dy = e.clientY - startY;
      if (Math.hypot(dx, dy) < 8) return;
      entschieden = true;
      dragging = finger.size === 1 && Math.abs(dx) > Math.abs(dy) * 1.2;
      if (!dragging) return;
      lastX = e.clientX; lastY = e.clientY;
    }
    if (!dragging) return;
    hint.classList.add('gone');
    yaw = (yaw + (e.clientX - lastX) * 0.6) % 360;
    pitch = Math.max(kippMin, Math.min(kippMax, pitch + (e.clientY - lastY) * 0.3));
    lastX = e.clientX;
    lastY = e.clientY;
    draw(lastT);   // sofort neu zeichnen, statt auf die Animation zu warten
    e.preventDefault();
  };
  const onUp = (e) => {
    if (e.pointerId === zeiger) {
      const tipp = !dragging && e.type === 'pointerup' && e.pointerType !== 'mouse'
        && Math.hypot(e.clientX - startX, e.clientY - startY) < 8;
      if (tipp && e.timeStamp - tippZeit < 350) { tippZeit = 0; zurueck(); } else if (tipp) tippZeit = e.timeStamp;
      dragging = false;
      zeiger = null;
    }
    finger.delete(e.pointerId);
  };

  host.addEventListener('pointerdown', onDown);
  host.addEventListener('dblclick', () => zurueck());
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onUp);

  /** Skelett einer Stellung, schon auf den Boden gesetzt – siehe skelett(). */
  const skeleton = (t) => skelett(spec, t);

  // Ausschnitt einmal für das ganze Muster festlegen, aus beiden Endstellungen.
  // Eine feste Größe ließ liegende Übungen klein in einem halbleeren Kasten
  // stehen; ein Maß je Einzelbild würde die Figur beim Abspielen atmen lassen.
  // Radius statt Rechteck, damit auch das Drehen nichts daran ändert.
  const fit = (() => {
    // Was fest im Raum steht und zur Übung gehört, zählt mit: Beim Face Pull
    // lag die Stange, an der das Band hängt, außerhalb des Kreises um die
    // Gelenke – im Bild blieb von ihr ein Stummel am oberen Rand, und die
    // Bänder liefen aus dem Kasten. Ein Band, das im Nichts endet, ist genau
    // das, was die Stange verhindern soll (siehe unten bei ueberkopf).
    const anker = spec.ueberkopf !== undefined
      ? [-1, 1].map((s) => [s * UEBERKOPF_HALB, spec.ueberkopf, spec.ueberkopfZ]) : [];
    const all = [...[skeleton(0), skeleton(1)].flatMap((j) => Object.values(j)), ...anker];
    const mid = [0, 1, 2].map((i) => (Math.min(...all.map((q) => q[i])) + Math.max(...all.map((q) => q[i]))) / 2);
    // Radius statt Rechteck: so ändert das Drehen die Größe nicht, und die
    // Figur kann in keiner Lage über den Rand ragen. Der Kopf zählt mit seinem
    // Radius, nicht nur mit dem Mittelpunkt – beim Liegestütz mit erhöhten
    // Füßen ist er der äußerste Punkt und ragte halb aus dem Bild.
    const weit = (q) => Math.hypot(q[0] - mid[0], q[1] - mid[1], q[2] - mid[2]);
    // Und was über die Gelenke hinausragt, mit seiner Dicke: Finger (seit
    // v213 bis 0,16 über den Handpunkt hinaus), Hantelscheiben, Flaschen.
    // Gezählt wurden nur die Gelenke, und im hochkantigen Kasten – auf dem
    // Handy im Hochformat der Normalfall – schnitt der Rand beim Reverse Snow
    // Angel die Fingerspitzen ab und beim sitzenden Seitheben ein Stück der
    // Hantelscheibe. Gefunden bei der Durchsicht der Figuren. Nicht nur aus
    // den Endstellungen: Eine Hand kann unterwegs weiter draußen liegen.
    const aussen = [0, 0.25, 0.5, 0.75, 1].flatMap((t) => {
      const j = skeleton(t);
      const hand = ['L', 'R'].flatMap((s) => {
        const h = handForm(spec, j, s, equip);
        return [...h.flaeche.map((p) => weit(p) + 0.03),
          ...h.stuecke.flatMap(([a, b, w1, w2]) => [weit(a) + w1 / 40, weit(b) + w2 / 40])];
      });
      const stangen = hanteln(spec, j, equip).flatMap((h) => {
        const T = hantelTeile(h.plate, h.half);
        const ende = (s, r2) => [weit(add(h.centre, mul(h.axis, s))) + r2, weit(add(h.centre, mul(h.axis, -s))) + r2];
        return [...T.scheiben.flatMap(([a, b, r2]) => [...ende(a, r2), ...ende(b, r2)]), ...ende(T.stummel, T.griffR)];
      });
      const flaschenRand = flaschen(spec, j, equip).flatMap((fl) => fl.teile.flatMap(([von, bis, r2]) => [
        weit(add(fl.centre, mul(fl.axis, von))) + r2, weit(add(fl.centre, mul(fl.axis, bis))) + r2]));
      return [...hand, ...stangen, ...flaschenRand];
    });
    const r = Math.max(...all.map(weit), ...aussen,
      ...[skeleton(0), skeleton(1)].map((j) => weit(j.head) + RIG.headR));
    // Bodenhöhe einmal aus der Startstellung: bei einem Griff an die Stange
    // liegt der Körper nicht mehr fest auf dem Boden auf, der Boden darf aber
    // trotzdem nicht bei jedem Einzelbild auf und ab wandern.
    const groundY = Math.min(...Object.values(skeleton(0)).map((q) => q[1]));
    // Die Auflage unter den Schultern (Hip Thrust): einmal aus der oberen
    // Stellung genommen und dann fest. Zeichnete man sie in jedem Einzelbild
    // neu unter die aktuellen Schultern, wanderte sie mit ihnen – und eine Bank,
    // die mitfährt, ist keine.
    const oben = skeleton(1);
    const schulter = [0, 1, 2].map((i) => (oben.shoulderL[i] + oben.shoulderR[i]) / 2);
    // Wie weit die Figur in der Tiefe reicht – für die Bodenscheibe, siehe dort.
    const tief = (Math.max(...all.map((q) => q[2])) - Math.min(...all.map((q) => q[2]))) / 2;
    return { mid, groundY, bank: schulter, bodenZ: Math.max(0.34, tief + 0.1),
             scale: (Math.min(VBW, VBH) / 2) * 0.94 / Math.max(r, 0.1) };
  })();
  const gearScale = fit.scale / 40;
  // Randstärke mit der Figur. Fest 0,9 war in kleinen Figuren (Face Pull,
  // gearScale 0,6) ein Drittel der Figurfläche dunkle Linie – Gliederpuppe
  // statt Körper. Bis gearScale 0,85 bleibt es bei 0,9.
  const rand = 0.9 * Math.min(1, gearScale / 0.85);
  svg.style.setProperty('--rand', rand.toFixed(2));

  const draw = (t) => {
    lastT = t;
    const j = skeleton(t);

    const P = (p) => project(
      [p[0] - fit.mid[0], p[1] - fit.mid[1], p[2] - fit.mid[2]], yaw, pitch, fit.scale, VBW / 2, VBH / 2,
    );
    const pts0 = j;   // Weltkoordinaten, für die Ausrichtung der Geräte
    const pts = {};
    Object.entries(j).forEach(([k, v]) => { pts[k] = P(v); });

    const parts = [];
    // Die Teile eines Bildes erst als Beschreibung; eingesetzt wird am Ende,
    // möglichst in die Teile des Bildes davor (siehe dort). Gleicher Name wie
    // das el() draußen, damit jede Form unten so bleibt, wie sie war.
    const el = (name, attrs = {}) => ({
      name, attrs, kinder: [],
      appendChild(k) { this.kinder.push(k); return k; },
    });

    // Achsen des Skeletts selbst – schon gedreht und gekippt, anders als eine
    // nachgerechnete Näherung. Rumpf und Gerät richten sich danach aus.
    const midOf = (a2, b2) => [(a2[0] + b2[0]) / 2, (a2[1] + b2[1]) / 2, (a2[2] + b2[2]) / 2];
    const { sideAxis, upAxis, frontAxis } = achsen(j);

    // Tiefe als Helligkeit: was hinten liegt, wird etwas dunkler. Der
    // Maleralgorithmus allein sagt nur, was verdeckt – nicht, was weiter weg
    // ist; bei gedrehter Figur überlagern sich sonst gleich helle Glieder.
    //
    // **Als Auflage, nicht als Durchsichtigkeit.** Bis v206 wurde dafür die
    // Deckkraft gesenkt – und ein Arm vor dem Rumpf ließ den Rumpf durch, der
    // Rumpf ließ seine eigenen Kanten und die Wirbelsäule durch:
    //
    //     „Irgendwie ist der Oberkörper nur son Dreieck?"
    //
    // Jetzt ist jede Fläche deckend, und darüber liegt eine dunkle Fläche
    // derselben Form, so durchsichtig, wie das Glied weit weg ist.
    const depth = (z) => (0.74 + 0.26 * Math.min(1, Math.max(0, (z + 0.9) / 1.8))).toFixed(3);
    // Deckende Form plus Schatten-Auflage – siehe oben.
    const deckend = (z, tag, attrs) => {
      parts.push({ z, node: el(tag, attrs) });
      const d = Number(depth(z));
      if (d < 0.995) {
        const { class: _c, ...rest } = attrs;
        parts.push({ z: z + 0.0004, node: el(tag, { ...rest, class: 'fig-schatten', opacity: ((1 - d) * 0.9).toFixed(3) }) });
      }
    };

    /**
     * Gliedmaße als eine einzige Fläche: von w1 auf w2 verjüngt, an beiden
     * Enden halbrund. Ein gleich dicker Strich sieht aus wie ein
     * Strichmännchen – ein Muskel wird zum Gelenk hin schmaler.
     *
     * Bewusst ein Pfad und nicht Viereck plus zwei Kreise: nur so lässt sich
     * eine Trennlinie außen herum ziehen, ohne dass innen Nähte auftauchen.
     */
    const kapsel = (from, to, w1, w2) => {
      const dx = to.x - from.x; const dy = to.y - from.y;
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len; const ny = dx / len;
      const a = Math.max(0.4, w1 * gearScale * from.k);
      const b = Math.max(0.4, w2 * gearScale * to.k);
      const f = (v) => v.toFixed(1);
      return `M${f(from.x + nx * a)} ${f(from.y + ny * a)}`
        + ` A${f(a)} ${f(a)} 0 0 1 ${f(from.x - nx * a)} ${f(from.y - ny * a)}`
        + ` L${f(to.x - nx * b)} ${f(to.y - ny * b)}`
        + ` A${f(b)} ${f(b)} 0 0 1 ${f(to.x + nx * b)} ${f(to.y + ny * b)} Z`;
    };
    const limb = (from, to, w1, w2, cls = 'fig-limb') => {
      deckend((from.z + to.z) / 2, 'path', { d: kapsel(from, to, w1, w2), class: cls });
    };
    /**
     * Umriss eines Armglieds mit Breitenverlauf (RIG.armOben, RIG.armUnten),
     * im Drehsinn von kapsel(). Liefert den geschlossenen Pfad `d`, dazu
     * `dSchulter` mit nach innen gewölbtem Anfang (für den Rand: Der läuft
     * dann die Seiten entlang bis an die Schulter, aber ohne Bogen über den
     * Rumpf, denn dort geht der Arm in den Rumpf über), und die beiden Seiten
     * für eine offene Kante.
     */
    const f2 = (v) => v.toFixed(2);
    const pt2 = (q) => `${f2(q[0])} ${f2(q[1])}`;
    const glied = (a, b, profil) => {
      const dx = b.x - a.x; const dy = b.y - a.y;
      const len = Math.hypot(dx, dy) || 1e-6;
      const nx = -dy / len; const ny = dx / len;
      const w0 = profil[0][1]; const wN = profil[profil.length - 1][1];
      const breite = (t) => {
        let i = 1;
        while (i < profil.length - 1 && profil[i][0] < t) i += 1;
        const [t0, v0] = profil[i - 1]; const [t1, v1] = profil[i];
        return v0 + ((v1 - v0) * (t - t0)) / Math.max(1e-6, t1 - t0);
      };
      // Stark verkürzt wird aus dem Muskelbauch eine Kugel, keine Raute: Der
      // Bauch wächst nur mit der sichtbaren Länge.
      const bauch = Math.min(1, len / (2.5 * gearScale * Math.max(w0 * a.k, wN * b.k)));
      const N = 12;
      const proben = [];
      for (let i = 0; i <= N; i += 1) {
        const t = i / N;
        const gerade = w0 + (wN - w0) * t;
        const h = Math.max(0.4, (gerade + (breite(t) - gerade) * bauch) * gearScale * (a.k + (b.k - a.k) * t));
        proben.push({ x: a.x + dx * t, y: a.y + dy * t, h });
      }
      const plus = proben.map((q) => [q.x + nx * q.h, q.y + ny * q.h]);
      const minus = proben.map((q) => [q.x - nx * q.h, q.y - ny * q.h]);
      const hA = proben[0].h; const hB = proben[N].h;
      const rest = minus.slice(1).map((q) => ` L${pt2(q)}`).join('')
        + ` A${f2(hB)} ${f2(hB)} 0 0 1 ${pt2(plus[N])}`
        + plus.slice(0, N).reverse().map((q) => ` L${pt2(q)}`).join('') + ' Z';
      const d = `M${pt2(plus[0])} A${f2(hA)} ${f2(hA)} 0 0 1 ${pt2(minus[0])}${rest}`;
      const dSchulter = `M${pt2(plus[0])} A${f2(hA)} ${f2(hA)} 0 0 0 ${pt2(minus[0])}${rest}`;
      return { d, dSchulter, plus, minus, hA, hB, a, b };
    };
    /**
     * Rand eines Glieds als offene Kante: die beiden Seiten, je Ende erst ab
     * dem Abstand rA bzw. rB vom Gelenkpunkt; `null` heißt dort die Kappe.
     * Für das vordere Glied, das über dem hinteren liegt – so zeigt ein
     * gebeugter Arm die Kante des Unterarms über dem Oberarm, wie man es
     * zeichnen würde, aber keinen Ring am Gelenk.
     */
    const kante = (g, rA, rB) => {
      const ab = (seite, c, r) => {   // Seite ab Abstand r von c, von c weg
        const weit = (p) => Math.hypot(p[0] - c.x, p[1] - c.y);
        const i = seite.findIndex((p) => weit(p) >= r);
        if (i < 0) return [];
        if (i === 0) return seite.slice();
        const [p0, p1] = [seite[i - 1], seite[i]];
        const u = (r - weit(p0)) / Math.max(1e-6, weit(p1) - weit(p0));
        return [[p0[0] + (p1[0] - p0[0]) * u, p0[1] + (p1[1] - p0[1]) * u], ...seite.slice(i)];
      };
      let pl = g.plus; let mi = g.minus;
      if (rA !== null) { pl = ab(pl, g.a, rA); mi = ab(mi, g.a, rA); }
      if (rB !== null) {
        pl = ab(pl.slice().reverse(), g.b, rB).reverse();
        mi = ab(mi.slice().reverse(), g.b, rB).reverse();
      }
      if (pl.length < 2 || mi.length < 2) return '';
      const linie = (q) => `M${pt2(q[0])}${q.slice(1).map((p) => ` L${pt2(p)}`).join('')}`;
      if (rA !== null && rB !== null) return `${linie(mi)} ${linie(pl)}`;
      if (rA !== null) {   // Kappe am Ende b: die eine Seite hin, die andere zurück
        return `${linie(mi)} A${f2(g.hB)} ${f2(g.hB)} 0 0 1 ${pt2(pl[pl.length - 1])}`
          + pl.slice(0, -1).reverse().map((p) => ` L${pt2(p)}`).join('');
      }
      return `${linie(pl.slice().reverse())} A${f2(g.hA)} ${f2(g.hA)} 0 0 1 ${pt2(mi[0])}`
        + mi.slice(1).map((p) => ` L${pt2(p)}`).join('');
    };

    // Rumpf als Körper mit Tiefe. Eine einzelne Fläche zwischen Schultern und
    // Hüften war von der Seite papierdünn und hatte keine Taille. Ringe aus je
    // vier Ecken ergeben einen Rumpf, der aus jeder Richtung Volumen hat.
    //
    // Vier Ringe statt drei, und die Taille weniger eng: Mit Schulter 0,200,
    // Taille 0,125 und Becken 0,150 lief der Rumpf von vorn spitz zu – ein
    // Dreieck mit Kopf. Jetzt Schulter 0,190, Brust 0,190, Taille 0,148,
    // Becken 0,156: breit oben, ein wenig schmaler in der Mitte, kein Keil.
    const ring = (centre, w, d) => [[1, 1], [1, -1], [-1, -1], [-1, 1]]
      .map(([a2, b2]) => P(add(add(centre, mul(sideAxis, a2 * w)), mul(frontAxis, b2 * d))));
    const shoulderMid = midOf(j.shoulderL, j.shoulderR);
    const hipMid = midOf(j.hipL, j.hipR);
    const zwischen = (f) => add(shoulderMid, mul(add(hipMid, mul(shoulderMid, -1)), f));
    const rings = [ring(shoulderMid, 0.190, 0.096), ring(zwischen(0.35), 0.190, 0.102),
      ring(zwischen(0.72), 0.148, 0.084), ring(hipMid, 0.156, 0.090)];
    const face = (quad) => {
      const z = quad.reduce((acc, q) => acc + q.z, 0) / quad.length;
      deckend(z, 'polygon', {
        points: quad.map((q) => `${q.x.toFixed(1)},${q.y.toFixed(1)}`).join(' '),
        class: 'fig-torso',
      });
    };
    face(rings[0]);                                        // Schulterdeckel
    face(rings[3]);                                        // Beckenboden
    [0, 1, 2].forEach((r) => [0, 1, 2, 3].forEach((c) => {
      const d2 = (c + 1) % 4;
      face([rings[r][c], rings[r][d2], rings[r + 1][d2], rings[r + 1][c]]);
    }));
    limb(pts.hipC, pts.neck, 4.2, 3.4, 'fig-spine');
    /*
     * Kopf und Hals in der richtigen Reihenfolge.
     *
     * Der Kopf wurde mit der Tiefe seines Mittelpunkts einsortiert, die
     * Halskapsel mit der Mitte zwischen Hals und Kopfmittelpunkt. Schaut die
     * Kamera leicht von unten (pitch < 0, so stehen zehn Muster im
     * Standardblick), liegt der Hals näher als der Kopfmittelpunkt – die
     * Kapsel wurde *nach* dem Kopf gezeichnet, und ihr runder Abschluss stand
     * mit dunklem Rand mitten im Gesicht: ein Ring hinter einem Stummel, wie
     * ein Heiligenschein. Gefunden bei der Durchsicht der Figuren.
     *
     * Der Kopf ist eine Kugel, und was von ihr zu sehen ist, ist ihre
     * Oberfläche, nicht ihr Mittelpunkt. Hals und Schulterdeckel hängen unten
     * an ihr: Was von ihnen innerhalb des Kopfumrisses liegt, verdeckt die
     * Kugel. Also liegt der Kopf immer vor dem Hals und vor dem Schulterdeckel,
     * und der Hals vor dem Deckel – sonst verschwände sein unteres Ende im
     * Rumpf und es bliebe ein loser Kopf. Gegen alles andere – Hände, Hanteln,
     * Stange – zählt weiter der Mittelpunkt: Eine Hand vor dem Gesicht soll
     * davor bleiben.
     */
    const zDeckel = rings[0].reduce((acc, q) => acc + q.z, 0) / rings[0].length;
    const zKopf = Math.max(pts.head.z + 0.001, zDeckel + 0.003);
    const zHals = Math.min(Math.max((pts.neck.z + pts.head.z) / 2, zDeckel + 0.001), zKopf - 0.002);
    // Hals schließt die Lücke
    deckend(zHals, 'path', { d: kapsel(pts.neck, pts.head, 2.6, 2.2), class: 'fig-spine fig-hals' });

    /*
     * Ein Arm: zwei Glieder, aber ein Körper.
     *
     *     „Die Arme sehen echt immer komisch aus"
     *
     * Bis v235 hatte jedes Glied seinen eigenen Rand. Am Ellenbogen stand
     * dadurch ein Ring oder ein U, an der Schulter eine Naht – eine
     * Gliederpuppe. Dazu lief ein Steg von der Brust bis zur Hand, der jede
     * Lücke zwischen Arm und Rumpf füllen sollte und dabei Flughäute und Keile
     * malte, sobald der Arm abgespreizt war.
     *
     * Jetzt wie bei der Hand: die Flächen ohne Strich, der Rand eigens dahinter.
     * Ober- und Unterarm behalten je ihre Tiefe – ein Unterarm vor dem Gesicht
     * bleibt davor. Das hintere Glied bekommt einen Rand ringsum, nur an der
     * Schulter eingezogen (dort geht der Arm in den Rumpf über); das vordere
     * nur eine offene Kante, ohne das Stück im Ellenbogen. Ein Rand ringsum
     * auch für das vordere Glied (so ein Zwischenstand) franste aus, sobald
     * der Arm flach auf dem Rumpf lag (Bridge, Snow Angel): Rumpfflächen fast
     * gleicher Tiefe schoben sich stückweise zwischen Rand und Arm.
     */
    const arm = (s) => {
      // Schulter: vom Hals zum Schultergelenk fällt der Trapezmuskel ab, und
      // die Kappe des Oberarms sitzt am Ende dieser Linie. Ohne ihn lief der
      // Schulterdeckel waagerecht, und die Oberarme standen an seinen Ecken
      // hoch wie an einem Kleiderbügel. Randlos, denn er gehört zum Rumpf.
      // Am Hals setzt er höher an (0,005 über dem Halsansatz, 1,9 breit) als
      // im ersten Entwurf (0,015 darunter, 1,75): Dort fiel die Linie zur
      // Schulter nur um 7 Grad, und mit der Kappe des Oberarms obenauf sah es
      // nach Schulterpolstern aus. Jetzt fällt sie wie beim Menschen.
      const seite = s === 'L' ? -1 : 1;
      const trapez = P(add(add(j.neck, mul(sideAxis, seite * 0.045)), mul(upAxis, 0.005)));
      const sh = pts[`shoulder${s}`]; const ew = pts[`elbow${s}`]; const hw = pts[`hand${s}`];
      const zO = (sh.z + ew.z) / 2; const zU = (ew.z + hw.z) / 2;
      // Über dem Ansatz des Oberarms einsortiert: Lag er darunter, stand die
      // Kappe des Oberarms mit ihrer eigenen Abdunklung als Scheibe auf der
      // Schulter. Aber hinter Hals und Kopf – sonst schob er sich von vorn
      // über das Kinn.
      deckend(Math.min(Math.max((trapez.z + sh.z) / 2, zO + 0.0006), zHals - 0.0003), 'path',
        { d: kapsel(trapez, sh, 1.9, RIG.armOben[0][1] * 0.9), class: 'fig-limb fig-arm' });
      const ober = glied(sh, ew, RIG.armOben);
      const unter = glied(ew, hw, RIG.armUnten);
      // Am Ellenbogen fehlt dem vorderen Glied ein Stück Kante: so weit, wie
      // das hintere es dort umschließt.
      const rE = Math.max(ober.hB, unter.hA) + rand * 1.2;
      const RZ = 0.0015;   // Rand knapp hinter seinem Glied
      if (zU >= zO) {
        // Unterarm vorn (fast immer): Oberarm ringsum, Unterarm offene Kante.
        parts.push({ z: zO - RZ, node: el('path', { d: ober.dSchulter, class: 'fig-arm-rand' }) });
        deckend(zO, 'path', { d: ober.d, class: 'fig-limb fig-arm' });
        parts.push({ z: zU - RZ, node: el('path', { d: kante(unter, rE, null), class: 'fig-arm-kante' }) });
        deckend(zU, 'path', { d: unter.d, class: 'fig-limb fig-arm' });
      } else {
        // Oberarm vorn (der Arm zeigt vom Betrachter weg, etwa beim Rudern von
        // vorn oder bei der Bridge): umgekehrt.
        parts.push({ z: zU - RZ, node: el('path', { d: unter.d, class: 'fig-arm-rand' }) });
        deckend(zU, 'path', { d: unter.d, class: 'fig-limb fig-arm' });
        parts.push({ z: zO - RZ, node: el('path', { d: kante(ober, 0, rE), class: 'fig-arm-kante' }) });
        deckend(zO, 'path', { d: ober.d, class: 'fig-limb fig-arm' });
      }
    };

    ['L', 'R'].forEach((s) => {
      arm(s);
      // Die Hand selbst zeichnet haende() weiter unten – mit Fläche, Fingern
      // und Daumen, je nachdem, ob sie greift oder aufliegt.
      limb(pts[`hip${s}`], pts[`knee${s}`], 4.6, 3.1);
      limb(pts[`knee${s}`], pts[`ankle${s}`], 3.1, 1.9);
      limb(pts[`ankle${s}`], pts[`toe${s}`], 1.9, 1.5, 'fig-limb fig-foot');
    });

    // Kopf als Ei entlang der Rumpfachse statt als Kreis
    const headR = RIG.headR * 46 * gearScale * pts.head.k;
    const axis = Math.atan2(pts.head.y - pts.neck.y, pts.head.x - pts.neck.x) * 180 / Math.PI + 90;
    deckend(zKopf, 'ellipse', {
      cx: pts.head.x.toFixed(1), cy: pts.head.y.toFixed(1),
      rx: (headR * 0.86).toFixed(1), ry: headR.toFixed(1),
      transform: `rotate(${axis.toFixed(1)} ${pts.head.x.toFixed(1)} ${pts.head.y.toFixed(1)})`,
      class: 'fig-head',
    });

    // Gerät, ausgerichtet an den Achsen des Skeletts selbst
    const pkt = (q) => `${q.x.toFixed(1)},${q.y.toFixed(1)}`;
    /**
     * Eine Hantelscheibe: ein flacher Zylinder um `axis`, von `a` bis `b`
     * entlang der Achse gemessen ab `centre`, Radius `r` in Metern.
     *
     *     „Hab übrigens so hantelscheiben, nicht diese kugeln"
     *
     * Vorher stand an jedem Stangenende ein flacher Kreis, und ein Kreis ist
     * aus jedem Blickwinkel rund – also eine Kugel. Eine Scheibe ist das nur
     * von vorn; von der Seite ist sie ein schmaler Streifen. Deshalb zwei
     * Ringe aus projizierten Punkten (Vorder- und Rückseite) und dazwischen
     * die dunklere Kante, wie bei den Scheiben unter den Fersen.
     *
     * `k` ist der Perspektivfaktor, mit dem gezeichnet wird – siehe barAt().
     * Die Scheibe ist ein Teil; ihre Flächen ordnet sie selbst: hintere
     * Fläche, Kante von hinten nach vorn, vordere Fläche.
     */
    const KLASSEN = {
      scheibe: ['fig-scheibe', 'fig-plate', 'fig-plate-seite'],
      koerper: ['fig-flasche', 'fig-flasche-flaeche', 'fig-flasche-seite'],
      deckel: ['fig-flasche', 'fig-deckel', 'fig-deckel-seite'],
    };
    const scheibe = (centre, axis, a, b, r, k, art = 'scheibe') => {
      const [gruppe, flaeche, seite] = KLASSEN[art];
      const hilf = Math.abs(axis[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
      const u = norm(cross(axis, hilf));
      const v = cross(axis, u);
      const proj = (p) => {
        const q = P(p);
        return k ? { x: VBW / 2 + (q.x - VBW / 2) * (k / q.k), y: VBH / 2 + (q.y - VBH / 2) * (k / q.k), z: q.z } : q;
      };
      const ring = (s) => {
        const m = add(centre, mul(axis, s));
        const out = [];
        for (let w = 0; w < 360; w += 22.5) {
          out.push(proj(add(m, add(mul(u, Math.cos(rad(w)) * r), mul(v, Math.sin(rad(w)) * r)))));
        }
        return out;
      };
      const ra = ring(a);
      const rb = ring(b);
      const tiefe = (rg) => rg.reduce((acc, q) => acc + q.z, 0) / rg.length;
      const [hinten, vorn] = tiefe(ra) < tiefe(rb) ? [ra, rb] : [rb, ra];
      const g = el('g', { class: gruppe });
      g.appendChild(el('polygon', { points: hinten.map(pkt).join(' '), class: flaeche }));
      ra.map((q, i) => {
        const n = (i + 1) % ra.length;
        return { z: q.z + ra[n].z + rb[i].z + rb[n].z, pts: [q, ra[n], rb[n], rb[i]] };
      }).sort((x, y) => x.z - y.z).forEach((f) => {
        g.appendChild(el('polygon', { points: f.pts.map(pkt).join(' '), class: seite }));
      });
      g.appendChild(el('polygon', { points: vorn.map(pkt).join(' '), class: flaeche }));
      parts.push({ z: (tiefe(ra) + tiefe(rb)) / 2, node: g });
    };
    /**
     * Stange samt Scheiben entlang einer Achse im Raum.
     *
     * `teile` zerlegt den Griff in so viele Stücke, jedes mit seiner eigenen
     * Tiefe. Nötig, wo die Stange quer über dem Körper liegt (Hip Thrust): Als
     * ein Strich wird sie mit der Tiefe ihrer Mitte einsortiert, also mitten
     * im Becken, und jede nähere Fläche von Rumpf und Oberschenkel deckt sie
     * ganz – auch das Stück, das zwischen Körper und naher Scheibe frei liegt.
     */
    const barAt = (centre, axis, half, plate, teile = 1) => {
      // Eine Stange ist ein starrer, gerader Gegenstand. Projiziert man ihre
      // Enden einzeln, bekommt das nähere einen größeren Perspektivfaktor als
      // das fernere – bei einer Kurzhantel unsichtbar, bei 1,2 m Langhantel
      // kippt sie sichtbar wie eine Wippe, obwohl sie waagerecht liegt. Alle
      // Punkte rechnen deshalb mit dem Faktor der Stangenmitte: Die Verkürzung
      // beim Drehen bleibt, die falsche Neigung verschwindet.
      const c = P(centre);
      const at = (s) => {
        const q = P(add(centre, mul(axis, s)));
        return {
          x: VBW / 2 + (q.x - VBW / 2) * (c.k / q.k),
          y: VBH / 2 + (q.y - VBH / 2) * (c.k / q.k),
          z: q.z, k: c.k,
        };
      };
      const strich = (s1, s2, z, stummel) => {
        const e1 = at(s1);
        const e2 = at(s2);
        parts.push({
          z,
          node: el('line', {
            x1: e1.x.toFixed(1), y1: e1.y.toFixed(1), x2: e2.x.toFixed(1), y2: e2.y.toFixed(1),
            'stroke-width': (2.2 * gearScale * c.k).toFixed(2), class: stummel ? 'fig-bar fig-bar-stummel' : 'fig-bar',
          }),
        });
      };
      // Je Seite eine große Scheibe innen und eine kleinere außen – das
      // gestufte Profil ist es, woran man eine Scheibenhantel erkennt.
      // `plate` ist der alte Kreisradius in Bildpunkten, plate / 40 derselbe
      // Radius in Metern (gearScale = fit.scale / 40).
      const { r, dick, innen } = hantelTeile(plate, half);
      // Griff
      for (let i = 0; i < teile; i++) {
        const s1 = -innen + (2 * innen * i) / teile;
        const s2 = -innen + (2 * innen * (i + 1)) / teile;
        strich(s1, s2, teile === 1 ? c.z : (at(s1).z + at(s2).z) / 2);
      }
      [-1, 1].forEach((s) => {
        const s2 = (x) => s * x;
        scheibe(centre, axis, s2(innen), s2(innen + dick), r, c.k);
        scheibe(centre, axis, s2(innen + dick), s2(innen + dick * 1.75), r * 0.74, c.k);
        // Stummel samt Verschluss hinter der äußeren Scheibe – hinter der
        // fernen Scheibe verdeckt, vor der nahen sichtbar.
        const ende = at(s2(innen + dick * 2.35));
        strich(s2(innen + dick * 1.75), s2(innen + dick * 2.35), ende.z, true);
      });
    };

    // Hanteln und Stangen – wo sie liegen, sagt hanteln(); hier wird nur
    // gezeichnet. Die Goblet-Hantel steht dort bei GOBLET_SCHALE.
    hanteln(spec, j, equip).forEach((h) => barAt(h.centre, h.axis, h.half, h.plate, h.teile));
    // Flaschen: je Teil ein Zylinder, gezeichnet wie die Scheiben einer Hantel.
    flaschen(spec, j, equip).forEach((fl) => {
      const k = P(fl.centre).k;
      fl.teile.forEach(([von, bis, r, art]) => scheibe(fl.centre, fl.axis, von, bis, r, k, art));
    });
    if (equip === 'band') {
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
      if (spec.band === 'bar') {
        // Von oben: Das Band haengt ueber der Klimmzugstange, je ein Strang zu
        // jeder Hand. Senkrecht nach oben und nicht zur Stangenmitte - ein
        // Band, das schraeg zieht, sieht aus, als haenge es irgendwo fest.
        // Der Bauch geht leicht nach aussen, sonst liegt der Strang auf dem
        // Unterarm.
        ['L', 'R'].forEach((seite) => {
          const hand = pts0[`hand${seite}`];
          // Zur Stange, nicht senkrecht nach oben: Die Stange steht fest im
          // Raum, die Haende wandern. Ein Strang, der immer senkrecht steht,
          // haette die Stange mitwandern lassen - genau der Fehler, der beim
          // Split Squat am hinteren Bein aufgefallen ist.
          const oben = P([hand[0], spec.ueberkopf, spec.ueberkopfZ]);
          bogen(P(hand), oben, { x: (seite === 'L' ? -1 : 1) * 3 * gearScale, y: 0 });
        });
      } else if (spec.band === 'hands') {
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
      //
      // `plateAt: 'hip'` legt sie stattdessen auf die Hüftbeuge – beim
      // Beckenheben liegt sie dort und nirgends sonst, und der Hinweis sagt das
      // auch so. Das ist eine Eigenschaft der Bewegung, nicht des Geräts:
      // getragen wird in beiden Fällen dieselbe Scheibe, und `equip` entscheidet
      // in drei weiteren Tabellen über Auf- und Abbau. Ein eigener Gerätename
      // nur fürs Zeichnen hätte die alle mitgeschleppt.
      const hoch = spec.plateAt === 'hip';
      // Flach aufgelegt wie die Scheiben an der Hantel (scheibe()), kein Kreis.
      scheibe(add(hoch ? j.hipC : j.chest, mul(frontAxis, hoch ? 0.16 : 0.26)), frontAxis, -0.02, 0.02, 5.4 / 40);
    } else if (equip === 'backpack') {
      // Rucksack – auf dem Rücken, auf der Brust oder in den Händen.
      //
      // Vorher lag hier eine Scheibe – die sieht man in jedem Trainingsvideo,
      // nur bekommt man sie ohne zweite Person nicht auf den eigenen Rücken.
      // Ein Rucksack schon. Und er sah danach trotzdem nicht aus wie einer:
      //
      //     „Hier steht Rucksack auf Brust aber es ist ein merkwürdiges
      //      Rechteck und das auf dem Rücken. Alles was an Hilfsmitteln usw
      //      dazu kommt soll vernünftig visualisiert werden"
      //
      // Zweierlei war falsch. Der Kasten stand als aufrechtes Rechteck im
      // Bild, egal wie der Körper lag – bei der Inverted Row also quer zum
      // Rumpf. Jetzt ist er eine Fläche im Raum, die dem Rumpf folgt, mit
      // Vordertasche und zwei Trägern über die Schultern. Und bei der
      // Inverted Row liegt er auf der Brust (`packAt: 'chest'`), wie der
      // Hinweis es sagt – wer auf dem Rücken liegt, kann ihn nur dort tragen.
      //
      // **Getragen oder gehalten** – derselbe Rucksack, zwei ganz verschiedene
      // Übungen. Bei Liegestützen, Klimmzügen und der Inverted Row hat man ihn
      // an. Bei Curls und Rudern hält man ihn an den Trageschlaufen, und dann
      // gehört er in die Hände (`packAt: 'hand'`).
      const halten = spec.packAt === 'hand';
      const brust = spec.packAt === 'chest';
      const strich = (von, bis, dz = 0.012) => {
        const a2 = P(von); const b2 = P(bis);
        parts.push({
          z: (a2.z + b2.z) / 2 + dz,
          node: el('line', {
            x1: a2.x.toFixed(1), y1: a2.y.toFixed(1), x2: b2.x.toFixed(1), y2: b2.y.toFixed(1),
            'stroke-width': (1.5 * gearScale * a2.k).toFixed(2), class: 'fig-strap',
          }),
        });
      };
      /*
       * Ein Kasten, keine Fläche.
       *
       * Der Rucksack war zwei Vielecke in der Rumpfebene. Bei Liegestütz und
       * Inverted Row liegt diese Ebene waagerecht, und der Standardblick schaut
       * fast parallel darauf: übrig blieb ein weißer Strich auf dem Rücken bzw.
       * der Brust, und dass dort ein Rucksack liegt, war nur an den Trägern zu
       * raten. Gefunden bei der Durchsicht der Figuren. Jetzt hat er Tiefe wie
       * der Klotz unter den Füßen und die Scheiben an der Stange: sechs
       * Flächen, von denen nur die gezeichnet werden, die zur Kamera zeigen,
       * jede mit ihrer eigenen Tiefe einsortiert. Die Außenseite – weg vom
       * Körper bzw. nach vorn – ist hell und trägt die Vordertasche, die
       * übrigen sind dunkler, damit die Kanten zu sehen sind.
       *
       * u, v, w sind Breite, Höhe und Tiefe, rechtshändig (u × v = w), w zeigt
       * nach außen.
       */
      const kasten = (c3, u, v, w, bw, bh, bd) => {
        const seiten = [
          [w, u, v, bd, bw, bh, true], [mul(w, -1), v, u, bd, bh, bw],
          [u, v, w, bw, bh, bd], [mul(u, -1), w, v, bw, bd, bh],
          [v, w, u, bh, bd, bw], [mul(v, -1), u, w, bh, bw, bd],
        ];
        seiten.forEach(([n, a, b, hn, ha, hb, aussen]) => {
          const m = add(c3, mul(n, hn / 2));
          const ecken = (fa, fb) => [[1, 1], [-1, 1], [-1, -1], [1, -1]]
            .map(([sa, sb]) => P(add(add(m, mul(a, sa * fa * ha / 2)), mul(b, sb * fb * hb / 2))));
          const q = ecken(1, 1);
          // Nur was zur Kamera zeigt: Im Bild (y nach unten) laufen die Ecken
          // einer zugewandten Fläche dann im Uhrzeigersinn.
          const flaeche2 = q.reduce((acc, e, i) => {
            const n2 = q[(i + 1) % 4];
            return acc + e.x * n2.y - n2.x * e.y;
          }, 0);
          if (flaeche2 >= 0) return;
          const z = q.reduce((acc, e) => acc + e.z, 0) / 4;
          const poly = (pts4, cls) => el('polygon', { points: pts4.map(pkt).join(' '), class: cls });
          const g = el('g');
          g.appendChild(poly(q, aussen ? 'fig-pack' : 'fig-pack-seite'));
          // Vordertasche: die untere Hälfte der Außenseite, etwas schmaler.
          if (aussen) {
            const t = [[0.72, -0.1], [-0.72, -0.1], [-0.72, -0.82], [0.72, -0.82]]
              .map(([sa, sb]) => P(add(add(add(m, mul(n, 0.004)), mul(a, sa * ha / 2)), mul(b, sb * hb / 2))));
            g.appendChild(poly(t, 'fig-pack-tasche'));
          }
          parts.push({ z: z + 0.01, node: g });
        });
      };
      if (halten) {
        /*
         * Gehalten: lotrecht unter den Händen, an zwei Schlaufen.
         *
         * Vorher eine Fläche um die Mitte zwischen den Händen, in der
         * Rumpfebene und ohne Verbindung zu ihnen: Die Hände hingen seitlich
         * an den Oberschenkeln, der Rucksack stand 0,24 von jeder entfernt
         * mitten vor dem Schritt, beim Rudern zudem um 62° mit dem Rumpf
         * gekippt – eine schwebende weiße Karte, während der Hinweis „beide
         * Hände in die Trageschlaufen" sagt.
         *
         * Ein Rucksack, den man an den Schlaufen hält, hängt senkrecht nach
         * unten, egal wie der Rumpf steht. Seine Breite folgt dem Griff, so
         * wie man ihn an den beiden Trägern fasst: gut zwei Drittel des
         * Abstands der Hände, die Schlaufen laufen schräg zu ihnen hoch. Er
         * hängt knapp vor den Händen, sonst stäke er in den Oberschenkeln.
         */
        const punkt = (a3, b3) => a3[0] * b3[0] + a3[1] * b3[1] + a3[2] * b3[2];
        const hl = j.handL; const hr = j.handR;
        const quer = norm([hr[0] - hl[0], 0, hr[2] - hl[2]]);
        const u = Math.hypot(hr[0] - hl[0], hr[2] - hl[2]) > 1e-6 ? quer : sideAxis;
        const v = [0, 1, 0];
        let w = cross(u, v);
        // w soll nach vorn zeigen (vom Körper weg), sonst hinge er im Rumpf.
        const uu = punkt(w, frontAxis) < 0 ? mul(u, -1) : u;
        w = cross(uu, v);
        const abstandH = Math.hypot(hr[0] - hl[0], hr[1] - hl[1], hr[2] - hl[2]);
        const bw = Math.min(0.4, Math.max(0.17, abstandH * 0.7));
        const griff = midOf(hl, hr);
        const oben = griff[1] - 0.06;
        // Hochkant wie ein Rucksack, aber nie in den Boden: Beim Rudern hängen
        // die Hände unten knapp über Kniehöhe.
        const bh = Math.min(0.34, oben - (BODEN + 0.02)); const bd = 0.12;
        const c3 = [griff[0] + w[0] * (bd / 2 + 0.03), oben - bh / 2, griff[2] + w[2] * (bd / 2 + 0.03)];
        kasten(c3, uu, v, w, bw, bh, bd);
        // Schlaufen: je ein schmales Dreieck von der Oberkante zur Hand und
        // zurück – ein Band, das um die Faust läuft.
        ['L', 'R'].forEach((seite) => {
          const hand = j[`hand${seite}`];
          const s = punkt([hand[0] - griff[0], 0, hand[2] - griff[2]], uu) < 0 ? -1 : 1;
          const kante = add(c3, add(mul(uu, s * bw * 0.42), mul(v, bh / 2)));
          const a3 = add(kante, mul(uu, -s * 0.03));
          const b3 = add(kante, mul(uu, s * 0.03));
          strich(a3, hand, 0.013);
          strich(hand, b3, 0.013);
        });
      } else {
        const rumpf = midOf(j.chest, j.hipC);
        const tiefe = brust ? 0.15 : -0.14;
        const c3 = add(rumpf, mul(frontAxis, tiefe));
        const bw = 0.17; const bh = 0.21; const bd = 0.09;
        // Außen ist bei der Brust vorn, beim Rücken hinten.
        const w = brust ? frontAxis : mul(frontAxis, -1);
        const u = brust ? sideAxis : mul(sideAxis, -1);
        kasten(c3, u, upAxis, w, bw, bh, bd);
        // Träger: vom oberen Rand über die Schulter auf die andere Seite des
        // Rumpfs. Zwei Stücke mit eigener Tiefe, damit das Stück hinter dem
        // Rumpf auch dahinter gezeichnet wird. Sie beginnen an der Innenkante
        // des Kastens, am Körper.
        ['L', 'R'].forEach((seite) => {
          const sx = seite === 'L' ? -0.55 : 0.55;
          const oben3 = add(add(add(c3, mul(sideAxis, sx * bw / 2)), mul(upAxis, bh / 2)), mul(w, -bd / 2));
          const schulter = add(j[`shoulder${seite}`], mul(upAxis, 0.035));
          // Das zweite Stück endet *innerhalb* der anderen Rumpfseite. Es lag
          // 0,105 tief (Rumpf 0,096) und auf der Breite des Schultergelenks
          // (0,215, Rumpf 0,19), also außerhalb – bei der Inverted Row schaute
          // unter dem Rumpf ein weißer Trägerstummel heraus.
          const innen3 = add(j[`shoulder${seite}`], mul(sideAxis, seite === 'L' ? 0.07 : -0.07));
          const drueben = add(add(innen3, mul(frontAxis, -tiefe * 0.5)), mul(upAxis, -0.12));
          strich(oben3, schulter);
          strich(schulter, drueben);
        });
      }
    }

    /*
     * Hände: wie sie liegen, sagt handForm(); hier wird nur gezeichnet.
     *
     * Bis v213 war die Hand ein Ballen mit drei Strichen davor. Von der Seite
     * gesehen lagen die Striche übereinander, und jeder hatte seinen dunklen
     * Rand – bei den Liegestützen stand am Ende des Arms ein Kringel:
     *
     *     „Die Hände sehen nicht so richtig händig aus"
     *
     * Jetzt ist die Hand ein kleiner Körper im Raum wie Arm und Bein: eine
     * Handfläche als Fläche, vier Finger und ein Daumen als eigene Glieder,
     * alle mit limb() und demselben Rand. Gedreht wird sie mit der Figur, und
     * verkürzt sieht sie aus wie eine Hand von der Seite, nicht wie ein Knoten.
     */
    ['L', 'R'].forEach((seite) => {
      const { faust, flaeche, stuecke, vorn } = handForm(spec, j, seite, equip);

      // Alles in *einen* Pfad, und nur um den ein Rand: Jedes Glied einzeln
      // umrandet – so wie Arm und Bein – ergab von der Seite gesehen einen
      // Stapel Ränder, weil die vier Finger dort hintereinander liegen. So
      // bleibt der Umriss der ganzen Hand, innen ist sie eine Fläche.
      //
      // Die Fläche läuft im selben Drehsinn wie die Glieder (kapsel()), sonst
      // stanzt die Füllregel die Überlappung als Loch aus.
      const q = flaeche.map(P);
      const drehsinn = q.reduce((acc, e, i) => {
        const n2 = q[(i + 1) % q.length];
        return acc + e.x * n2.y - n2.x * e.y;
      }, 0);
      if (drehsinn < 0) q.reverse();
      const f1 = (v) => v.toFixed(1);
      const d = [`M${q.map((e) => `${f1(e.x)} ${f1(e.y)}`).join(' L')} Z`,
        ...stuecke.map(([a3, b3, w1, w2]) => kapsel(P(a3), P(b3), w1, w2))].join(' ');
      const alle = [...q, ...stuecke.flatMap(([a3, b3]) => [P(a3), P(b3)])];
      const zHand = alle.reduce((acc, e) => acc + e.z, 0) / alle.length;
      parts.push({ z: zHand - 0.0015, node: el('path', { d, class: 'fig-hand-rand' }) });
      deckend(zHand, 'path', { d, class: 'fig-hand' });
      // Bei der Faust die eingerollten Finger und den Daumen noch einmal
      // einzeln, mit Rand, in ihrer eigenen Tiefe. Liegen sie vorn – man sieht
      // in die Handfläche, Untergriff –, stehen vier Finger quer über dem Griff
      // und der Daumen darüber. Liegen sie hinten, verdeckt sie die Hand, und
      // man sieht den glatten Handrücken: Obergriff. Das ist der Unterschied,
      // um den es bei der Frage nach den Fingern ging.
      if (faust) {
        vorn.forEach(([a3, b3, w1, w2]) => limb(P(a3), P(b3), w1, w2));
      }
    });

    if (spec.keil) {
      /*
       * Ein flacher Keil unter beiden Fersen.
       *
       * Er sitzt hinten, nicht vorn – das ist der ganze Unterschied zum Klotz
       * beim Wadenheben (spec.step), der unter dem Ballen liegt. Oben endet er
       * knapp unter dem Knöchel, vorn läuft er auf halber Fußlänge aus: Der
       * Ballen bleibt unten, sonst wäre es keine erhöhte Ferse, sondern ein
       * Podest.
       *
       * **Der Fuß zeigt in die Tiefe, nicht zur Seite.** Nachgemessen an der
       * Stellung (Maße in Körperlängen): Knöchel z 0.00, Zeh z 0.15 – die
       * Fußlänge liegt in z, die x-Achse trennt nur linkes und rechtes Bein.
       * Ein erster Versuch hat den Keil in x aufgespannt und damit einen
       * Streifen von 1,3 Zentimetern Länge gezeichnet, der hinter den Füßen
       * verschwand.
       */
      const ankR = j.ankleR; const ankL = j.ankleL;
      const zeh = midOf(j.toeL, j.toeR);
      const ank = midOf(ankL, ankR);
      const boden = -0.62;
      const top = Math.max(boden + 0.012, ank[1] - 0.018);
      const lang = Math.max(0.05, zeh[2] - ank[2]);      // Fußlänge in der Tiefe
      const hinten = ank[2] - lang * 0.45;
      const vorn = ank[2] + lang * 0.5;
      const links = Math.min(ankL[0], ankR[0]) - 0.075;
      const rechts = Math.max(ankL[0], ankR[0]) + 0.075;
      const ecke = (x, z2, y) => P([x, y, z2]);
      const face = (quad, dz = 0) => parts.push({
        z: quad.reduce((acc, q) => acc + q.z, 0) / quad.length + dz,
        node: el('polygon', {
          points: quad.map((q) => `${q.x.toFixed(1)},${q.y.toFixed(1)}`).join(' '),
          class: 'fig-keil',
        }),
      });
      // Oberseite, Vorderkante, beide Seiten – die Rückwand bleibt weg.
      face([ecke(links, hinten, top), ecke(rechts, hinten, top),
        ecke(rechts, vorn, top), ecke(links, vorn, top)], -0.02);
      face([ecke(links, vorn, top), ecke(rechts, vorn, top),
        ecke(rechts, vorn, boden), ecke(links, vorn, boden)], -0.02);
      face([ecke(links, hinten, top), ecke(links, vorn, top),
        ecke(links, vorn, boden), ecke(links, hinten, boden)], -0.02);
      face([ecke(rechts, hinten, top), ecke(rechts, vorn, top),
        ecke(rechts, vorn, boden), ecke(rechts, hinten, boden)], -0.02);
    }

    if (spec.fersenscheiben) {
      /*
       * Zwei Hantelscheiben, eine je Ferse – rund und hell, wie die Scheiben
       * an der Stange (fig-plate), nicht wie das Möbelstück Bank (fig-keil).
       * Rund heißt hier: ein Ring aus projizierten Punkten, genau wie der
       * Schatten unter der ganzen Figur (siehe `fig-ground` weiter unten) –
       * nur klein, je einer pro Fuß, und mit einer eigenen, dünnen Seite statt
       * nur einer Fläche auf dem Boden. Zwei Ringe (oben und am Boden), nicht
       * einer plus ein Pixelversatz: Nur so bleibt die Seite in derselben
       * Perspektive wie der Rest der Figur.
       */
      const boden = -0.62;
      ['L', 'R'].forEach((s) => {
        const ank = j[`ankle${s}`];
        const zeh = j[`toe${s}`];
        const top = Math.max(boden + 0.014, ank[1] - 0.018);
        const mx = ank[0];
        const mz = ank[2] - Math.max(0.03, (zeh[2] - ank[2]) * 0.3);
        const rx = 0.062; const rz = 0.068;
        const oben = []; const unten = [];
        for (let a = 0; a < 360; a += 30) {
          const x2 = mx + Math.cos(rad(a)) * rx;
          const z2 = mz + Math.sin(rad(a)) * rz;
          oben.push(P([x2, top, z2]));
          unten.push(P([x2, boden, z2]));
        }
        const z = oben.reduce((acc, q) => acc + q.z, 0) / oben.length;
        // Seite zuerst (dahinter), dann die Deckfläche obenauf.
        for (let i = 0; i < oben.length; i += 1) {
          const n = (i + 1) % oben.length;
          parts.push({
            z: (oben[i].z + oben[n].z) / 2 - 0.001,
            node: el('polygon', {
              points: `${oben[i].x.toFixed(1)},${oben[i].y.toFixed(1)} ${oben[n].x.toFixed(1)},${oben[n].y.toFixed(1)} `
                + `${unten[n].x.toFixed(1)},${unten[n].y.toFixed(1)} ${unten[i].x.toFixed(1)},${unten[i].y.toFixed(1)}`,
              class: 'fig-plate-seite',
            }),
          });
        }
        parts.push({
          z: z - 0.002,
          node: el('polygon', {
            points: oben.map((q) => `${q.x.toFixed(1)},${q.y.toFixed(1)}`).join(' '),
            class: 'fig-plate',
          }),
        });
      });
    }

    if (spec.slider) {
      /*
       * Ein Handtuch unter jeder Ferse.
       *
       *     „Die ganzen Zusatz-Sachen wie Handtücher usw können ja echt auch
       *      animiert werden wenn das was bringt."
       *
       * Hier bringt es etwas, und zwar mehr als Deko: Die Übung besteht darin,
       * dass die Ferse auf dem Boden *rutscht*. Ohne etwas unter dem Fuß ist
       * eine gleitende Ferse von einer gehobenen nicht zu unterscheiden – und
       * genau das war die Rückmeldung zu dieser Figur. Das Handtuch wandert
       * mit, also zeigt es die Strecke, um die es geht.
       *
       * `slider: 'R' | 'L'` legt nur unter eine Ferse – die einbeinige Fassung.
       *
       * Flach und breiter als der Fuß, damit es ein Tuch bleibt und kein Klotz
       * wird: Ein Kasten hier hieße „Ferse erhöht", also das Gegenteil.
       */
      /*
       * **Ein Tuch, nicht zwei.**
       *
       *     „Hier sind iwie zwei Ebenen unter den Füßen. Eigentlich sollte hier
       *      ja n Handtuch sein."
       *
       * Genau das war es: zwei getrennte Flächen, eine je Ferse. Beide liegen
       * auf demselben Boden, stehen aber – weil die Füße unterschiedlich weit
       * weg sind – auf verschiedenen Höhen im Bild. Zwei graue Flecken auf zwei
       * Höhen liest niemand als „zwei Handtücher auf einem Boden", sondern als
       * zwei Stufen.
       *
       * Eine durchgehende Fläche unter beiden Fersen hat dieses Problem nicht:
       * Sie hat eine Kante, und die liegt sichtbar flach. Beim einbeinigen Curl
       * (slider: 'R') bleibt es bei der einen arbeitenden Ferse.
       *
       * Waagerecht, nicht an der Sohle ausgerichtet: Die Füße stehen wirklich
       * auf dem Boden – nachgemessen 0,001 Körperlängen darüber –, die Neigung
       * der Figur ist die Brücke und nicht ein schräger Raum. Ein an der Sohle
       * ausgerichtetes Tuch stand deshalb hochkant und war ein Strich.
       */
      const einbein = spec.slider === 'R' || spec.slider === 'L';
      const ank = einbein ? j[`ankle${spec.slider}`] : midOf(j.ankleL, j.ankleR);
      const zeh = einbein ? j[`toe${spec.slider}`] : midOf(j.toeL, j.toeR);
      const y = -0.62 + 0.006;   // hauchdünn über dem Boden, nie darunter
      const lang = Math.max(0.12, Math.abs(zeh[0] - ank[0]) + 0.1);
      const breit = einbein ? 0.11 : Math.abs(j.ankleL[2] - j.ankleR[2]) / 2 + 0.11;
      const zc = einbein ? ank[2] : (j.ankleL[2] + j.ankleR[2]) / 2;
      const ecke = (sx, sz) => P([ank[0] + sx * lang * 0.5, y, zc + sz * breit]);
      const quad = [ecke(-1, -1), ecke(1, -1), ecke(1, 1), ecke(-1, 1)];
      parts.push({
        // Hinter den Fuß sortiert: Das Tuch liegt unter ihm, nicht auf ihm.
        z: quad.reduce((acc, q) => acc + q.z, 0) / quad.length - 0.1,
        node: el('polygon', {
          points: quad.map((q) => `${q.x.toFixed(1)},${q.y.toFixed(1)}`).join(' '),
          class: 'fig-towel',
        }),
      });
    }

    if (spec.step || spec.stufe) {
      // Kasten unter den Füßen: ohne ihn stünde nur eine schräge Figur da und
      // man sähe nicht, dass die Füße erhöht stehen.
      //
      // `stufe: 'R' | 'L'` ist die einbeinige Fassung – ein schmaler Klotz unter
      // *einem* Fuß. Er ist beim Wadenheben nicht Beiwerk, sondern die halbe
      // Übung: Ohne erhöhten Ballen fehlt die Dehnung nach unten, und das war
      // aus dem Bild vorher nicht zu sehen. Zuhause ist der Klotz meistens ein
      // dickes Buch, deshalb ist er flach und nicht stufenhoch.
      const einbein = spec.stufe === 'R' || spec.stufe === 'L';
      const ank = einbein ? (spec.stufe === 'R' ? j.ankleR : j.ankleL) : midOf(j.ankleL, j.ankleR);
      const zeh = einbein ? (spec.stufe === 'R' ? j.toeR : j.toeL) : null;
      const top = einbein ? zeh[1] - 0.01 : Math.min(j.toeL[1], j.toeR[1]) - 0.02;
      // Unter dem Ballen, nicht unter der Ferse: Der Klotz sitzt vorn.
      const zc = einbein ? zeh[2] : ank[2]; const xc = einbein ? zeh[0] : ank[0];
      const bx = einbein ? 0.085 : 0.16;
      const bz = einbein ? 0.10 : 0.26;
      const corner = (sx, sz, y) => P([xc + sx * bx, y, zc + sz * bz]);
      const face = (quad) => parts.push({
        z: quad.reduce((acc, q) => acc + q.z, 0) / quad.length - 0.05,
        node: el('polygon', {
          points: quad.map((q) => `${q.x.toFixed(1)},${q.y.toFixed(1)}`).join(' '),
          class: 'fig-bench',
        }),
      });
      const boden = einbein ? top - 0.055 : -0.62;
      face([corner(-1, -1, top), corner(1, -1, top), corner(1, 1, top), corner(-1, 1, top)]);
      face([corner(-1, 1, top), corner(1, 1, top), corner(1, 1, boden), corner(-1, 1, boden)]);
      face([corner(1, -1, top), corner(1, 1, top), corner(1, 1, boden), corner(1, -1, boden)]);
      face([corner(-1, -1, top), corner(-1, 1, top), corner(-1, 1, boden), corner(-1, -1, boden)]);
    }

    if (spec.couch) {
      /*
       * Die Auflage im Rücken: Bank, Sofa- oder Stuhlkante.
       *
       * Ohne sie ist die Stellung nicht zu lesen – eine Figur, deren Schultern
       * einen halben Meter über dem Boden schweben, sieht aus wie ein Fehler.
       * Mit ihr erklärt sich alles von selbst: Da liegt jemand mit den
       * Schulterblättern auf einer Kante, die Füße stehen am Boden, und
       * dazwischen geht die Hüfte auf und ab.
       *
       * Sie steht *hinter* den Schultern, nicht unter der ganzen Figur: Die
       * Kante liegt unter den Schulterblättern (dbCue: „nicht im Nacken"), und
       * genau diese Kante ist der Bezugspunkt der Übung. Eine Bank, die bis
       * unter die Hüfte reicht, wäre eine Liege – dann hinge die Hüfte nicht
       * frei, und die Bewegung wäre keine mehr.
       */
      const vorn = fit.bank[0] + 0.05;      // Vorderkante knapp vor den Schultern
      // Oberkante auf Höhe der *Kopfunterseite*, nicht der Schultermitte: Der
      // Kopf liegt weiter hinten als die Schultern und damit über der Auflage.
      // Auf Schulterhöhe steckte er zur Hälfte darin.
      const top = fit.bank[1] - RIG.headR;
      const hinten = vorn - 0.70;
      const halb = 0.30;                    // etwas breiter als die Schultern
      const boden = -0.62;
      const ecke = (x, sz, y) => P([x, y, fit.bank[2] + sz * halb]);
      const face = (quad, dz = 0) => parts.push({
        z: quad.reduce((acc, q) => acc + q.z, 0) / quad.length + dz,
        node: el('polygon', {
          points: quad.map((q) => `${q.x.toFixed(1)},${q.y.toFixed(1)}`).join(' '),
          class: 'fig-bench',
        }),
      });
      // Sitzfläche, Vorderkante, beide Seiten. Die Rückwand bleibt weg – sie
      // liegt immer hinter der Sitzfläche und kostet nur Striche.
      face([ecke(hinten, -1, top), ecke(vorn, -1, top), ecke(vorn, 1, top), ecke(hinten, 1, top)], -0.05);
      face([ecke(vorn, -1, top), ecke(vorn, 1, top), ecke(vorn, 1, boden), ecke(vorn, -1, boden)], -0.05);
      face([ecke(hinten, 1, top), ecke(vorn, 1, top), ecke(vorn, 1, boden), ecke(hinten, 1, boden)], -0.05);
      face([ecke(hinten, -1, top), ecke(vorn, -1, top), ecke(vorn, -1, boden), ecke(hinten, -1, boden)], -0.05);
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

    if (spec.ueberkopf !== undefined) {
      // Die Stange, an der das Band haengt: waagerecht ueber den Haenden, auf
      // der Hoehe, zu der die Baender laufen. Sie muss da sein - ein Band, das
      // im Nichts endet, ist keine Auskunft, sondern ein Fehler im Bild.
      // Fest im Raum, nicht an den Haenden: Die Stange haengt nicht am Sportler.
      const mitte = [0, spec.ueberkopf, spec.ueberkopfZ];
      const b1 = P(add(mitte, mul(sideAxis, -UEBERKOPF_HALB)));
      const b2 = P(add(mitte, mul(sideAxis, UEBERKOPF_HALB)));
      parts.push({
        z: (b1.z + b2.z) / 2 - 0.02,
        node: el('line', {
          x1: b1.x.toFixed(1), y1: b1.y.toFixed(1), x2: b2.x.toFixed(1), y2: b2.y.toFixed(1),
          class: 'fig-bar-fixed',
        }),
      });
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
      // In der Tiefe so weit, wie die Figur reicht, mindestens 0,34. Beim
      // Trizeps an der Stange liegt der Körper der Länge nach in der Tiefe
      // (Fersen z −1,0, Kopf +0,3); die Scheibe mit fester Tiefe 0,34 lag
      // dort nur unter der Mitte, und seit die Figur von der Seite gezeigt
      // wird, standen die Füße sichtbar daneben in der Luft.
      const ring = [];
      for (let a = 0; a < 360; a += 15) {
        ring.push(P([fit.mid[0] + Math.cos(rad(a)) * 0.62, gy, fit.mid[2] + Math.sin(rad(a)) * fit.bodenZ]));
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

    // Maleralgorithmus: hinten zuerst.
    //
    // Und nicht jedes Bild von vorn. Rund hundert Teile je Bild neu
    // anzulegen, jedes Merkmal einzeln zu setzen und die vom Bild davor
    // wegzuwerfen war nach dem schnelleren Stütz (siehe naechsteNull) der
    // größte Posten je Bild – beim Liegestütz mit vierfach gedrosselter CPU
    // rund 3 ms von gut 6. Von Bild zu Bild ändern sich aber fast nur
    // Koordinaten: dieselben Teile in derselben Reihenfolge. Dann werden nur
    // die Merkmale nachgezogen, die sich geändert haben; wo zwei Teile die
    // Plätze getauscht haben, entstehen nur diese neu. Nur wenn sich die Zahl
    // der Teile ändert (erstes Bild, Drehen), wird alles neu eingesetzt – als
    // ein Stück Text, das der Browser in einem Zug liest.
    const neu = parts.sort((p, q) => p.z - q.z).map((p) => p.node);
    const passt = (dom, n) => dom.tagName === n.name && dom.getAttribute('class') === (n.attrs.class ?? null)
      && dom.attributes.length === Object.keys(n.attrs).length
      && dom.children.length === n.kinder.length && n.kinder.every((k, i) => passt(dom.children[i], k));
    const setze = (dom, n) => {
      Object.entries(n.attrs).forEach(([k, v]) => { if (dom.getAttribute(k) !== String(v)) dom.setAttribute(k, v); });
      n.kinder.forEach((k, i) => setze(dom.children[i], k));
    };
    const bau = (n) => {
      const node = document.createElementNS(NS, n.name);
      Object.entries(n.attrs).forEach(([k, v]) => node.setAttribute(k, v));
      n.kinder.forEach((k) => node.appendChild(bau(k)));
      return node;
    };
    const alt = scene.children;
    if (alt.length === neu.length) {
      neu.forEach((n, i) => {
        if (passt(alt[i], n)) setze(alt[i], n);
        else scene.replaceChild(bau(n), alt[i]);
      });
    } else {
      const text = (n) => `<${n.name}${Object.entries(n.attrs).map(([k, v]) => ` ${k}="${v}"`).join('')}>`
        + `${n.kinder.map(text).join('')}</${n.name}>`;
      scene.innerHTML = neu.map(text).join('');
    }
  };

  // Die beiden Listener hängen am Fenster, nicht am Kasten – sonst bräche das
  // Drehen ab, sobald der Finger die Figur verlässt. Genau deshalb müssen sie
  // aber auch wieder weg, wenn die Figur verschwindet: die Ansicht wird bei
  // jedem abgehakten Satz neu geschrieben, und die alten Listener blieben
  // sonst samt ihrer Zeichendaten liegen.
  const off = () => {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onUp);
    federStop();
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
    getView: () => [yaw, pitch, dragging],
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
//
// Die Kniebeugen mit Keil und die Beinbeuger standen hier nicht, obwohl auch
// bei ihnen Stellung 1 das Ende des Ablassens ist (unten; Beine gestreckt).
// Sie gingen deshalb zügig in die Dehnung und langsam zurück – verkehrt herum.
const LOWER_TO_1 = ['squat', 'squatbw', 'squatheel', 'squatheelbw', 'pushup', 'pushupfeet',
  'pike', 'tricepsbar', 'hinge', 'hinge1', 'splitsquat', 'legcurl', 'legcurl1'];

// Wie beim Beobachter oben abgesichert: Dieses Modul wird auch ausserhalb
// eines Browsers geladen – tools/pose.mjs rechnet damit Stellungen nach.
const reduceMotion = typeof window !== 'undefined' && window.matchMedia
  ? window.matchMedia('(prefers-reduced-motion: reduce)')
  : { matches: false };

function frame(now) {
  if (document.visibilityState === 'visible' && active.size && !reduceMotion.matches) {
    const u = (now % CYCLE_MS) / CYCLE_MS;
    active.forEach((f) => { if (f.sichtbar) f.draw(tempo(u, f.effortAt1)); });
  }
  requestAnimationFrame(frame);
}
if (typeof requestAnimationFrame === 'function') requestAnimationFrame(frame);
