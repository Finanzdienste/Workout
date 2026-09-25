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

export const RIG = {
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

const A = (p = 0, a = 0, e = 0, i = 0) => ({ p, a, e, i });
const L = (p = 0, a = 0, k = 0) => ({ p, a, k });

/**
 * Gelenkpunkte einer Stellung, Hüftmitte im Ursprung.
 *
 * Ausgeführt, weil sich Stellungen sonst nur am fertigen Bild beurteilen
 * lassen: tools/pose.mjs rechnet damit nach, ob Schultern, Hüfte und Füße dort
 * liegen, wo die Übung sie verlangt.
 */
export function solve(pose) {
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
    Object.keys(joints).forEach((k) => {
      const v = rotX([joints[k][0] - p[0], joints[k][1] - p[1], joints[k][2] - p[2]],
                     -pose.becken);
      joints[k] = [v[0] + p[0], v[1] + p[1], v[2] + p[2]];
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
 */
function naechsteNull(g, weite = 30, schritt = 1) {
  let best = { x: 0, v: Math.abs(g(0)) };
  let prev = null;
  const kandidaten = [];
  for (let x = -weite; x <= weite + 1e-9; x += schritt) {
    const v = g(x);
    if (Math.abs(v) < best.v) best = { x, v: Math.abs(v) };
    if (prev && Math.sign(prev.v) !== Math.sign(v)) kandidaten.push([prev.x, x]);
    prev = { x, v };
  }
  if (!kandidaten.length) return best.x;
  kandidaten.sort((p, q) => Math.abs(p[0] + p[1]) - Math.abs(q[0] + q[1]));
  let [lo, hi] = kandidaten[0];
  const glo = g(lo) > 0;
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
function stuetz(spec, t) {
  const pose = mische(spec, t);
  const HAENDE = ['handL', 'handR'];
  const ZEHEN = ['toeL', 'toeR'];
  const start = solve(mische(spec, 0));
  const breite0 = abstand(start.handL, start.handR);
  // Griffweite halten: die Abspreizung beider Arme gleich verschieben.
  const mitArm = (da) => ({
    ...pose,
    armL: { ...pose.armL, a: pose.armL.a + da },
    armR: { ...pose.armR, a: pose.armR.a + da },
  });
  const da = t === 0 ? 0 : naechsteNull((d) => abstand(solve(mitArm(d)).handL, solve(mitArm(d)).handR) - breite0);
  const p1 = mitArm(da);
  // Höhe der Zehen über den Händen: beim Kasten so hoch wie am Start, sonst
  // null – beide am Boden. Beim Pike standen die Hände schon am Start nicht
  // auf (0,055 über dem Boden), also gilt dort nicht „wie am Start".
  const ziel = spec.step ? tiefster(start, ZEHEN) - tiefster(start, HAENDE) : 0;
  const feld = spec.stuetz === 'lean' ? 'lean' : 'tilt';
  const g = (q) => { const j = solve(q); return (tiefster(j, ZEHEN) - tiefster(j, HAENDE)) - ziel; };
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
  const fuss = (j) => mitte(j.toeL, j.toeR);
  const hand = (j) => mitte(j.handL, j.handR);
  const flach = (u, v) => Math.hypot(u[0] - v[0], u[2] - v[2]);
  const abst0 = flach(hand(start), fuss(start));
  const glied = feld === 'lean' ? ['legL', 'legR'] : ['armL', 'armR'];
  const stell = (x) => {
    const r = { ...q, [feld]: q[feld] + x[0] };
    glied.forEach((k) => { r[k] = { ...r[k], p: r[k].p + x[1] }; });
    ['armL', 'armR'].forEach((k) => { r[k] = { ...r[k], a: r[k].a + x[2] }; });
    return r;
  };
  const F = (x) => {
    const q2 = stell(x);
    const j = solve(q2);
    return [g(q2), flach(hand(j), fuss(j)) - abst0, abstand(j.handL, j.handR) - breite0];
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
export function skelett(spec, t) {
  let j = spec.stuetz ? stuetz(spec, t) : solve(mische(spec, t));
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
    const start = fest(skelett(spec, 0));
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
 * flach aufliegen – dort zeigen die Finger zum Kopf –, `finger: 'oben'` für den
 * Griff unter die Goblet-Hantel. `hantelLaengs` legt die Kurzhantel in
 * Blickrichtung, wie sie bei neutralem Griff liegt.
 */
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
    daumen: 'innen', finger: 'oben',
    label: 'Kniebeuge',
    poses: [
      // lean unten bewusst moderat: mit 42° klappte die Figur zusammen und der
      // Kopf stand auf Kniehöhe. Beim Goblet Squat bleibt der Rumpf aufrecht.
      { lean: 6, arm: A(26, -18, 130, 32), leg: L(2, 5, 4) },
      { lean: 24, arm: A(34, -18, 126, 32), leg: L(100, 9, 118) },
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
      { arm: A(10, 33, 104), leg: L(56, 9, 100) },
      { arm: A(90, 10, 0), leg: L(56, 9, 100) },
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
      { arm: A(9, 15, 110), leg: L(56, 9, 100) },
      { arm: A(90, 14, 0), leg: L(56, 9, 100) },
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
     *   Start    x 0.24 y 0.36   x 0.54 y 0.07   Füße stehen am Boden
     *   Ende     x −0.18 y 0.39  x 0.23 y 0.43   Knie über dem Bauch, Füße frei
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
      { arm: A(0, 17, 6), leg: L(50, 9, 95) },
      { arm: A(0, 17, 6), leg: L(98, 9, 105), becken: 15 },
    ],
  },
  pullapart: {
    daumen: 'innen',
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
    label: 'Face Pull', band: 'bar', ueberkopf: 0.89, ueberkopfZ: 0.85, view: [20, -8],
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
      { arm: A(84, 8, 112), leg: L(56, 9, 100) },
      { arm: A(90, 8, 4), leg: L(56, 9, 100) },
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
    daumen: 'vorn', hantelLaengs: true,
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
     * Dieselbe Übung auf einem Bein, auf der Stuhl- oder Sofakante – und
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
    daumen: 'innen', finger: 'oben',
    // Mehr von der Seite als die freie Kniebeuge (Vorgabe yaw 25): Ein Keil
    // unter der Ferse steht von vorn gesehen hochkant hinter dem Fuß und ist
    // damit genau das, was er nicht sein soll – unsichtbar.
    label: 'Kniebeuge, Fersen erhöht', keil: true, view: [62, -4],
    poses: [
      { lean: 6, arm: A(26, -18, 130, 32), leg: L(2, 5, 4), heel: 0.16 },
      { lean: 20, arm: A(34, -18, 126, 32), leg: L(104, 9, 126), heel: 0.16 },
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
    daumen: 'vorn', hantelLaengs: true,
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

  /** Skelett einer Stellung, schon auf den Boden gesetzt – siehe skelett(). */
  const skeleton = (t) => skelett(spec, t);

  // Ausschnitt einmal für das ganze Muster festlegen, aus beiden Endstellungen.
  // Eine feste Größe ließ liegende Übungen klein in einem halbleeren Kasten
  // stehen; ein Maß je Einzelbild würde die Figur beim Abspielen atmen lassen.
  // Radius statt Rechteck, damit auch das Drehen nichts daran ändert.
  const fit = (() => {
    const all = [skeleton(0), skeleton(1)].flatMap((j) => Object.values(j));
    const mid = [0, 1, 2].map((i) => (Math.min(...all.map((q) => q[i])) + Math.max(...all.map((q) => q[i]))) / 2);
    // Radius statt Rechteck: so ändert das Drehen die Größe nicht, und die
    // Figur kann in keiner Lage über den Rand ragen. Der Kopf zählt mit seinem
    // Radius, nicht nur mit dem Mittelpunkt – beim Liegestütz mit erhöhten
    // Füßen ist er der äußerste Punkt und ragte halb aus dem Bild.
    const weit = (q) => Math.hypot(q[0] - mid[0], q[1] - mid[1], q[2] - mid[2]);
    const r = Math.max(...all.map(weit),
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
    return { mid, groundY, bank: schulter,
             scale: (Math.min(VBW, VBH) / 2) * 0.94 / Math.max(r, 0.1) };
  })();
  const gearScale = fit.scale / 40;

  const draw = (t) => {
    lastT = t;
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
      //
      // Quer zum Körper liegt die Hantel bei aufgedrehtem Unterarm – so hält
      // man sie beim Seitheben, beim Drücken, beim gewöhnlichen Curl. Zeigen
      // die Handflächen dagegen zueinander (Hammercurl), liegt sie längs,
      // also in Blickrichtung. Das ist der einzige sichtbare Unterschied
      // zwischen den beiden Curls, und ohne ihn wären es zwei gleiche Bilder.
      const achse = spec.hantelLaengs ? frontAxis : sideAxis;
      [pts0.handL, pts0.handR].forEach((h) => barAt(h, achse, 0.13, 3.4));
    } else if (equip === 'onehand') {
      barAt(pts0[`hand${spec.gewichtHand || 'R'}`], spec.hantelLaengs ? frontAxis : sideAxis, 0.13, 3.4);
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
    } else if (equip === 'szbar') {
      // Eine SZ-Stange ist etwa halb so lang wie eine Langhantel; ihre
      // Ausbuchtungen fallen bei dieser Strichstärke ohnehin unter den Tisch.
      // Was man sehen soll, ist der Unterschied zur grossen Stange – und der
      // ist die Länge.
      barAt(midOf(pts0.handL, pts0.handR), sideAxis, 0.34, 4.0);
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
      const q = P(add(hoch ? j.hipC : j.chest, mul(frontAxis, hoch ? 0.16 : 0.26)));
      parts.push({
        z: q.z + 0.01,
        node: el('circle', { cx: q.x.toFixed(1), cy: q.y.toFixed(1), r: (5.4 * gearScale * q.k).toFixed(1), class: 'fig-plate' }),
      });
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
      const rumpf = midOf(j.chest, j.hipC);
      const tiefe = brust ? 0.15 : -0.14;
      const c3 = halten ? add(midOf(j.handL, j.handR), mul(frontAxis, 0.10)) : add(rumpf, mul(frontAxis, tiefe));
      const bw = halten ? 0.13 : 0.17;
      const bh = halten ? 0.15 : 0.21;
      const ecke = (sx, sy) => P(add(add(c3, mul(sideAxis, sx * bw / 2)), mul(upAxis, sy * bh / 2)));
      const flaeche = (ecken, cls, dz) => {
        const q = ecken.map(([sx, sy]) => ecke(sx, sy));
        parts.push({
          z: q.reduce((acc, e) => acc + e.z, 0) / q.length + dz,
          node: el('polygon', { points: q.map((e) => `${e.x.toFixed(1)},${e.y.toFixed(1)}`).join(' '), class: cls }),
        });
      };
      flaeche([[-1, 1], [1, 1], [1, -1], [-1, -1]], 'fig-pack', 0.01);
      flaeche([[-0.72, -0.1], [0.72, -0.1], [0.72, -0.82], [-0.72, -0.82]], 'fig-pack-tasche', 0.014);
      if (!halten) {
        // Träger: vom oberen Rand über die Schulter auf die andere Seite des
        // Rumpfs. Zwei Stücke mit eigener Tiefe, damit das Stück hinter dem
        // Rumpf auch dahinter gezeichnet wird.
        ['L', 'R'].forEach((seite) => {
          const sx = seite === 'L' ? -0.55 : 0.55;
          const oben3 = add(add(c3, mul(sideAxis, sx * bw / 2)), mul(upAxis, bh / 2));
          const schulter = add(j[`shoulder${seite}`], mul(upAxis, 0.035));
          const drueben = add(add(j[`shoulder${seite}`], mul(frontAxis, -tiefe * 0.7)), mul(upAxis, -0.12));
          [[oben3, schulter], [schulter, drueben]].forEach(([von, bis]) => {
            const a2 = P(von); const b2 = P(bis);
            parts.push({
              z: (a2.z + b2.z) / 2 + 0.012,
              node: el('line', {
                x1: a2.x.toFixed(1), y1: a2.y.toFixed(1), x2: b2.x.toFixed(1), y2: b2.y.toFixed(1),
                'stroke-width': (1.5 * gearScale * a2.k).toFixed(2), class: 'fig-strap',
              }),
            });
          });
        });
      }
    }

    /*
     * Daumen und Finger – damit man den Griff sieht.
     *
     * Die Hand war ein Ballen, und ein Ballen greift nicht. Jetzt: drei Finger
     * in Verlängerung des Unterarms – sie liegen um die Stange, die Hantel, das
     * Band – und der Daumen quer dazu, in der Richtung, die das Muster nennt
     * (`daumen`, siehe oben bei PATTERNS). Am Klimmzug im Obergriff zeigen die
     * Daumen zueinander, im Untergriff nach außen: Das ist der Unterschied
     * zwischen Chin-ups und Pull-ups, und er war nicht zu sehen.
     *
     * Jeder Strich zweimal: erst breit in Hintergrundfarbe, dann in der Farbe
     * des Körpers – sonst verschwinden die Finger, sobald die Hand vor dem
     * Rumpf liegt.
     */
    if (spec.daumen) {
      const weltOben = [0, 1, 0];
      const haende = equip === 'onehand' ? [spec.gewichtHand || 'R'] : ['L', 'R'];
      haende.forEach((seite) => {
        const hand = j[`hand${seite}`];
        const ell = j[`elbow${seite}`];
        const innen = mul(sideAxis, seite === 'L' ? 1 : -1);
        const t = ({ innen, aussen: mul(innen, -1), vorn: frontAxis, hinten: mul(frontAxis, -1),
          oben: weltOben, unten: mul(weltOben, -1) })[spec.daumen] || innen;
        let f = norm([hand[0] - ell[0], hand[1] - ell[1], hand[2] - ell[2]]);
        if (spec.finger === 'boden') f = norm([upAxis[0], 0, upAxis[2]]);
        else if (spec.finger === 'oben') f = upAxis;
        const strich = (von, bis, breite) => {
          const a2 = P(von); const b2 = P(bis);
          const attrs = (w, cls, dz) => ({
            x1: a2.x.toFixed(1), y1: a2.y.toFixed(1), x2: b2.x.toFixed(1), y2: b2.y.toFixed(1),
            'stroke-width': (w * gearScale * a2.k).toFixed(2), class: cls, opacity: depth(a2.z),
            _z: Math.max(a2.z, b2.z) + dz,
          });
          [attrs(breite + 1.1, 'fig-finger-rand', 0.03), attrs(breite, 'fig-finger', 0.031)].forEach((at) => {
            const { _z, ...rest } = at;
            parts.push({ z: _z, node: el('line', rest) });
          });
        };
        // Drei Finger nebeneinander, von der Daumenseite weg gestaffelt.
        [0.013, -0.008, -0.029].forEach((o) => {
          const von = add(hand, mul(t, o));
          strich(von, add(von, mul(f, 0.066)), 1.5);
        });
        const dvon = add(hand, mul(t, 0.02));
        strich(dvon, add(dvon, add(mul(t, 0.046), mul(f, 0.016))), 1.7);
      });
    }

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
      const b1 = P(add(mitte, mul(sideAxis, -0.9)));
      const b2 = P(add(mitte, mul(sideAxis, 0.9)));
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
