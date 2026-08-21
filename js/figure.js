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
 *   tilt      ganze Figur um die Blickachse – 90 = liegend, Kopf links
 *   arm.p     Schulter nach vorn (0 = Arm hängt)
 *   arm.a     Arm zur Seite abgespreizt
 *   arm.e     Ellenbogen gebeugt
 *   leg.p     Hüfte gebeugt (Knie nach vorn)
 *   leg.a     Bein zur Seite
 *   leg.k     Knie gebeugt (Ferse nach hinten)
 */

const RIG = {
  hipW: 0.10, shoulderW: 0.20, shoulderY: 0.42,
  chestY: 0.28, neckY: 0.46, headY: 0.62, headR: 0.105,
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

const A = (p = 0, a = 0, e = 0) => ({ p, a, e });
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
    const foreDir = rotX(upperDir, -arm.e);
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

  // Erst um die Längsachse rollen (Brust nach unten/oben), dann kippen.
  // Die Reihenfolge ist entscheidend: umgekehrt liegt die Figur falsch herum.
  if (pose.roll) {
    Object.keys(joints).forEach((k) => { joints[k] = rotY(joints[k], pose.roll); });
  }
  if (pose.tilt) {
    Object.keys(joints).forEach((k) => { joints[k] = rotZ(joints[k], pose.tilt); });
  }
  return joints;
}

/* ------------------------------------------------------------------ *
 * Stellungen – je Muster Start und Ende
 * ------------------------------------------------------------------ */

export const PATTERNS = {
  squat: {
    label: 'Kniebeuge',
    poses: [
      { lean: 6, arm: A(12, 6, 132), leg: L(2, 5, 4) },
      { lean: 42, arm: A(18, 6, 128), leg: L(96, 9, 116) },
    ],
  },
  legcurl: {
    // Rücken am Boden, Hüfte oben, Fersen ziehen heran
    label: 'Beinbeuger', roll: 90, tilt: 68,
    poses: [
      { roll: 90, tilt: 68, lean: -26, arm: A(-16, 20, 12), leg: L(-16, 5, 10) },
      { roll: 90, tilt: 68, lean: -26, arm: A(-16, 20, 12), leg: L(6, 5, 92) },
    ],
  },
  thrust: {
    label: 'Hüftstreckung',
    poses: [
      { roll: 90, tilt: 52, lean: 0, arm: A(-12, 22, 26), leg: L(76, 6, 104) },
      { roll: 90, tilt: 74, lean: 0, arm: A(-12, 22, 26), leg: L(12, 6, 94) },
    ],
  },
  pushup: {
    label: 'Liegestütz', roll: -90, tilt: 78,
    poses: [
      { roll: -90, tilt: 78, lean: 0, arm: A(90, 14, 2), leg: L(-4, 6, 4) },
      { roll: -90, tilt: 78, lean: 0, arm: A(62, 40, 78), leg: L(-4, 6, 4) },
    ],
  },
  press: {
    label: 'Drücken im Liegen', roll: 90, tilt: 90,
    poses: [
      { roll: 90, tilt: 90, lean: 0, arm: A(84, 20, 86), leg: L(52, 9, 96) },
      { roll: 90, tilt: 90, lean: 0, arm: A(90, 10, 2), leg: L(52, 9, 96) },
    ],
  },
  row: {
    // Einarmig vorgebeugt: die andere Hand stützt sich ab
    label: 'Rudern',
    poses: [
      { lean: 72, armL: A(96, 12, 24), armR: A(72, 8, 6), leg: L(24, 6, 30) },
      { lean: 72, armL: A(96, 12, 24), armR: A(112, 16, 96), leg: L(24, 6, 30) },
    ],
  },
  pullup: {
    label: 'Klimmzug', anchor: 'bar', bar: true,
    poses: [
      { arm: A(176, 9, 2), leg: L(-6, 5, 28) },
      { arm: A(148, 20, 96), leg: L(-6, 5, 34) },
    ],
  },
  pike: {
    // Umgekehrtes V, Kopf senkt sich zwischen die Hände
    label: 'Überkopf-Drücken',
    poses: [
      { lean: 84, arm: A(84, 12, 4), leg: L(84, 6, 8) },
      { lean: 84, arm: A(70, 34, 76), leg: L(84, 6, 8) },
    ],
  },
  curl: {
    label: 'Bizeps-Curl',
    poses: [
      { lean: 3, arm: A(4, 8, 6), leg: L(2, 5, 4) },
      { lean: 3, arm: A(10, 8, 136), leg: L(2, 5, 4) },
    ],
  },
  triceps: {
    label: 'Trizeps-Strecken', roll: 90, tilt: 90,
    poses: [
      { roll: 90, tilt: 90, lean: 0, arm: A(96, 10, 108), leg: L(52, 9, 96) },
      { roll: 90, tilt: 90, lean: 0, arm: A(92, 10, 4), leg: L(52, 9, 96) },
    ],
  },
  lateral: {
    label: 'Seitheben',
    poses: [
      { lean: 4, arm: A(6, 10, 10), leg: L(2, 5, 4) },
      { lean: 4, arm: A(6, 92, 10), leg: L(2, 5, 4) },
    ],
  },
  reversefly: {
    label: 'Reverse Fly',
    poses: [
      { lean: 76, arm: A(76, 8, 10), leg: L(26, 6, 30) },
      { lean: 76, arm: A(76, 88, 12), leg: L(26, 6, 30) },
    ],
  },
  crunch: {
    label: 'Crunch', roll: 90, tilt: 90,
    poses: [
      { roll: 90, tilt: 90, lean: 0, arm: A(152, 26, 104), leg: L(54, 9, 96) },
      { roll: 90, tilt: 90, lean: 34, arm: A(152, 26, 104), leg: L(54, 9, 96) },
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

/* ------------------------------------------------------------------ *
 * Geräte
 * ------------------------------------------------------------------ */

/** Aus dem Hinweis im Plan ableiten, was in der Hand liegt. */
export function equipFor(note) {
  if (!note) return null;
  if (note.includes('je Hand')) return 'dumbbells';
  if (note.includes('eine Hantel')) return 'goblet';
  if (note.includes('Stange')) return 'barbell';
  if (note.includes('Zusatzgewicht')) return 'plate';
  if (note.includes('Hüfte')) return 'hipbar';
  return null;
}

const NS = 'http://www.w3.org/2000/svg';
const CYCLE_MS = 3200;
const el = (name, attrs = {}) => {
  const node = document.createElementNS(NS, name);
  Object.entries(attrs).forEach(([k, v]) => node.setAttribute(k, v));
  return node;
};

const active = new Set();

/** Schwache Perspektive: weiter hinten = kleiner. */
function project(p, yaw, pitch, scale, cx, cy) {
  const r = rotX(rotY(p, yaw), pitch);
  const f = 3.4;
  const k = f / (f - r[2]);
  return { x: cx + r[0] * scale * k, y: cy - r[1] * scale * k, z: r[2], k };
}

export function mountFigure(host, pattern, weight, equip) {
  const spec = PATTERNS[pattern];
  host.textContent = '';
  if (!spec) return () => {};

  const svg = el('svg', { viewBox: '0 0 100 100', class: 'fig' });
  const scene = el('g');
  svg.appendChild(scene);
  host.appendChild(svg);

  const hint = document.createElement('span');
  hint.className = 'fig-hint';
  hint.textContent = '↕↔ ziehen zum Drehen';
  host.appendChild(hint);

  let yaw = 25;          // Dreiviertelansicht steht der Figur am besten
  let pitch = 8;         // leicht von oben
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
    const mixA = (x = A(), y = A()) => A(mix(x.p, y.p), mix(x.a, y.a), mix(x.e, y.e));
    const mixL = (x = L(), y = L()) => L(mix(x.p, y.p), mix(x.a, y.a), mix(x.k, y.k));
    return {
      lean: mix(a.lean || 0, b.lean || 0),
      tilt: mix(a.tilt || 0, b.tilt || 0),
      roll: mix(a.roll || 0, b.roll || 0),
      heel: mix(a.heel || 0, b.heel || 0),
      armL: mixA(a.armL || a.arm, b.armL || b.arm),
      armR: mixA(a.armR || a.arm, b.armR || b.arm),
      legL: mixL(a.legL || a.leg, b.legL || b.leg),
      legR: mixL(a.legR || a.leg, b.legR || b.leg),
    };
  };

  const draw = (t) => {
    lastT = t;
    const pose = blend(t);
    const j = solve(pose);

    // Auf den Boden setzen bzw. an der Stange aufhängen
    let shift;
    if (spec.anchor === 'bar') {
      shift = -Math.max(j.handL[1], j.handR[1]) + 0.52;   // haengt an der Stange
    } else {
      shift = -Math.min(...Object.values(j).map((q) => q[1])) - 0.62;
      if (pose.heel) shift += pose.heel * 0.10;           // Ferse hebt ab
    }
    Object.keys(j).forEach((k) => { j[k] = [j[k][0], j[k][1] + shift, j[k][2]]; });

    scene.textContent = '';
    const P = (p) => project(p, yaw, pitch, 44, 50, 52);
    const pts = {};
    Object.entries(j).forEach(([k, v]) => { pts[k] = P(v); });

    const parts = [];
    const bone = (from, to, w, cls = 'fig-limb') => parts.push({
      z: (from.z + to.z) / 2,
      node: el('line', {
        x1: from.x.toFixed(1), y1: from.y.toFixed(1), x2: to.x.toFixed(1), y2: to.y.toFixed(1),
        'stroke-width': (w * (from.k + to.k) / 2).toFixed(2), class: cls,
      }),
    });

    // Rumpf als Fläche zwischen Schultern und Hüften
    const quad = [pts.shoulderL, pts.shoulderR, pts.hipR, pts.hipL];
    parts.push({
      z: quad.reduce((s, p) => s + p.z, 0) / 4,
      node: el('polygon', {
        points: quad.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' '),
        class: 'fig-torso',
      }),
    });
    bone(pts.hipC, pts.neck, 7.5, 'fig-spine');

    ['L', 'R'].forEach((s) => {
      bone(pts[`shoulder${s}`], pts[`elbow${s}`], 5.6);
      bone(pts[`elbow${s}`], pts[`hand${s}`], 4.4);
      bone(pts[`hip${s}`], pts[`knee${s}`], 7.2);
      bone(pts[`knee${s}`], pts[`ankle${s}`], 5.4);
      bone(pts[`ankle${s}`], pts[`toe${s}`], 3.8, 'fig-limb fig-foot');
    });

    parts.push({
      z: pts.head.z,
      node: el('circle', {
        cx: pts.head.x.toFixed(1), cy: pts.head.y.toFixed(1),
        r: (RIG.headR * 46 * pts.head.k).toFixed(1), class: 'fig-head',
      }),
    });

    // Gerät
    const gear = (from, to, w, cls) => parts.push({
      z: (from.z + to.z) / 2,
      node: el('line', {
        x1: from.x.toFixed(1), y1: from.y.toFixed(1), x2: to.x.toFixed(1), y2: to.y.toFixed(1),
        'stroke-width': w, class: cls,
      }),
    });
    const plateAt = (p, r) => parts.push({
      z: p.z + 0.01,
      node: el('circle', { cx: p.x.toFixed(1), cy: p.y.toFixed(1), r, class: 'fig-plate' }),
    });

    if (equip === 'dumbbells' || equip === 'goblet') {
      const hands = equip === 'goblet' ? [pts.handL] : [pts.handL, pts.handR];
      hands.forEach((h) => {
        const off = 0.085 * 46 * h.k;
        const dir = rotY([1, 0, 0], yaw);
        const dx = dir[0] * off; const dy = 0;
        gear({ x: h.x - dx, y: h.y - dy, z: h.z, k: h.k }, { x: h.x + dx, y: h.y + dy, z: h.z, k: h.k }, 2.2, 'fig-bar');
        plateAt({ x: h.x - dx, y: h.y - dy, z: h.z }, 3.4 * h.k);
        plateAt({ x: h.x + dx, y: h.y + dy, z: h.z }, 3.4 * h.k);
      });
    } else if (equip === 'barbell') {
      const dir = rotY([1, 0, 0], yaw);
      const ext = 0.30 * 46;
      const mid = { x: (pts.handL.x + pts.handR.x) / 2, y: (pts.handL.y + pts.handR.y) / 2, z: (pts.handL.z + pts.handR.z) / 2, k: 1 };
      const e1 = { x: mid.x - dir[0] * ext, y: mid.y, z: mid.z };
      const e2 = { x: mid.x + dir[0] * ext, y: mid.y, z: mid.z };
      gear({ ...e1, k: 1 }, { ...e2, k: 1 }, 2.4, 'fig-bar');
      plateAt(e1, 5); plateAt(e2, 5);
    } else if (equip === 'hipbar') {
      const dir = rotY([1, 0, 0], yaw);
      const hipMid = { x: (pts.hipL.x + pts.hipR.x) / 2, y: (pts.hipL.y + pts.hipR.y) / 2, z: (pts.hipL.z + pts.hipR.z) / 2 };
      const ext = 0.24 * 46;
      gear({ x: hipMid.x - dir[0] * ext, y: hipMid.y, z: hipMid.z, k: 1 },
        { x: hipMid.x + dir[0] * ext, y: hipMid.y, z: hipMid.z, k: 1 }, 2.4, 'fig-bar');
      plateAt({ x: hipMid.x - dir[0] * ext, y: hipMid.y, z: hipMid.z }, 4.6);
      plateAt({ x: hipMid.x + dir[0] * ext, y: hipMid.y, z: hipMid.z }, 4.6);
    } else if (equip === 'plate') {
      const back = P(add(j.chest, rotY([0, 0, -0.12], 0)));
      plateAt(back, 5.5 * back.k);
    }

    if (spec.bar) {
      const barY = Math.max(j.handL[1], j.handR[1]);
      const a1 = P([-0.75, barY, 0]); const a2 = P([0.75, barY, 0]);
      parts.push({
        z: (a1.z + a2.z) / 2 - 0.02,
        node: el('line', {
          x1: a1.x.toFixed(1), y1: a1.y.toFixed(1), x2: a2.x.toFixed(1), y2: a2.y.toFixed(1),
          class: 'fig-bar-fixed',
        }),
      });
    } else {
      // Bodenscheibe statt Strich: ein Strich unten am Rand sieht aus wie ein
      // Schieberegler; eine Fläche im Raum liest sich als Boden und kippt mit.
      const ring = [];
      for (let a = 0; a < 360; a += 15) {
        ring.push(P([Math.cos(rad(a)) * 0.62, -0.62, Math.sin(rad(a)) * 0.34]));
      }
      parts.push({
        z: Math.min(...ring.map((q) => q.z)) - 0.02,
        node: el('polygon', {
          points: ring.map((q) => `${q.x.toFixed(1)},${q.y.toFixed(1)}`).join(' '),
          class: 'fig-ground',
        }),
      });
    }

    // Maleralgorithmus: hinten zuerst
    parts.sort((p, q) => p.z - q.z).forEach((p) => scene.appendChild(p.node));
  };

  const entry = { draw };
  draw(0);
  active.add(entry);
  return {
    draw,
    setView: (y, pi = 0) => { yaw = y; pitch = pi; draw(lastT); },
    stop: () => {
      active.delete(entry);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    },
  };
}

export function clearFigures() {
  active.clear();
}

function frame(now) {
  if (document.visibilityState === 'visible' && active.size) {
    const t = (now % CYCLE_MS) / CYCLE_MS;
    const tri = t < 0.5 ? t * 2 : (1 - t) * 2;
    active.forEach((f) => f.draw(tri * tri * (3 - 2 * tri)));
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
