/*
 * Körperkarte: zeigt in Vorder- und Rückansicht, was heute drankommt.
 *
 * Der Körper entsteht aus einem Skelett, nicht aus einzeln hingelegten Ovalen.
 * Aus denselben Gelenkpunkten werden Silhouette und Muskeln gerechnet: die
 * Gliedmaßen als zum Gelenk hin schmaler werdende Flächen, die Muskeln als
 * Spindeln entlang genau desselben Knochens. Dadurch sitzt der Bizeps
 * zwangsläufig auf dem Oberarm und nicht daneben, und eine Änderung an den
 * Proportionen zieht beides zugleich nach.
 *
 * Rumpf, Brust, Rücken und Gesäß haben keine Knochenachse, die sie beschreiben
 * würde – die sind als Pfade gezeichnet.
 *
 * Feld je Ansicht: 100 × 220, symmetrisch um x = 50.
 */

export const MUSCLE_LABEL = {
  chest: 'Brust',
  delts: 'Schultern',
  rearDelts: 'hintere Schulter',
  biceps: 'Bizeps',
  triceps: 'Trizeps',
  abs: 'Bauch',
  lats: 'Rücken',
  traps: 'Nacken',
  glutes: 'Gesäß',
  quads: 'Oberschenkel',
  hamstrings: 'Beinbeuger',
  calves: 'Waden',
};

const BODY_NS = 'http://www.w3.org/2000/svg';

/* ------------------------------------------------------------------ *
 * Skelett – rechte Körperhälfte, die linke wird gespiegelt
 * ------------------------------------------------------------------ */

const J = {
  head: [50, 22], neckTop: [50, 32], neckBase: [50, 45],
  // Arme leicht abgespreizt: liegen sie am Rumpf an, verschmelzen Schulter und
  // Brust zu einem Fleck und man sieht nicht, was hervorgehoben ist.
  shoulder: [70, 53], elbow: [78, 96], wrist: [83, 134], hand: [84, 143],
  hip: [58, 114], knee: [59.5, 162], ankle: [59, 201], toe: [63, 210],
};

const HEAD_RX = 10.8;
const HEAD_RY = 13.4;

const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

/* ------------------------------------------------------------------ *
 * Formen
 * ------------------------------------------------------------------ */

/**
 * Gliedmaße von a nach b, an den Enden wa bzw. wb breit. Zwei Kreise an den
 * Gelenken runden ab und decken zugleich die Naht zum nächsten Glied.
 */
function limb(a, b, wa, wb) {
  const dx = b[0] - a[0]; const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len; const ny = dx / len;
  const quad = [
    [a[0] + nx * wa, a[1] + ny * wa], [b[0] + nx * wb, b[1] + ny * wb],
    [b[0] - nx * wb, b[1] - ny * wb], [a[0] - nx * wa, a[1] - ny * wa],
  ];
  return [
    ['poly', quad],
    ['e', a[0], a[1], wa, wa, 0],
    ['e', b[0], b[1], wb, wb, 0],
  ];
}

/**
 * Muskelbauch als Spindel entlang des Knochens a–b, von Anteil t0 bis t1 und
 * halb so breit wie w. Liegt damit immer auf dem Glied, dem er gehört.
 */
function belly(a, b, t0, t1, w) {
  const c = lerp(lerp(a, b, t0), lerp(a, b, t1), 0.5);
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const angle = Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI - 90;
  return ['e', c[0], c[1], w, (len * (t1 - t0)) / 2, angle];
}

const P = (d) => ['p', d];

/* ------------------------------------------------------------------ *
 * Silhouette
 * ------------------------------------------------------------------ */

const TORSO = P(
  'M50 41 C59 41 66 44 70.5 50 C72.5 57 71 65 69 73 '
  + 'C67 81 64.5 89 64 97 C63.5 105 63.5 111 63.5 116 '
  + 'L36.5 116 C36.5 111 36.5 105 36 97 C35.5 89 33 81 31 73 '
  + 'C29 65 27.5 57 29.5 50 C34 44 41 41 50 41 Z',
);

const PELVIS = P('M36.5 113 H63.5 L62 124 C58.5 130 54 132.5 50 132.5 C46 132.5 41.5 130 38 124 Z');

const FOOT = P('M55.5 197 H63 C64 203 66 208 67 211 C67 213.5 65 214.5 62 214.5 H56 Z');

/** Alles, was kein Trainingsbereich ist: Kopf, Hals, Unterarme, Hände, Füße. */
const FILLER = [
  ['e', J.head[0], J.head[1], HEAD_RX, HEAD_RY, 0],
  ...limb(J.neckTop, J.neckBase, 6.4, 7.6),
  TORSO,
  PELVIS,
  ...limb(J.shoulder, J.elbow, 8.8, 6.2),
  ...limb(J.elbow, J.wrist, 6.2, 4.2),
  ['e', J.hand[0] + 0.4, J.hand[1] - 2, 4.4, 6.4, -6],
  ...limb(J.hip, J.knee, 11.5, 7.6),
  ...limb(J.knee, J.ankle, 7.6, 4.4),
  FOOT,
];

/* ------------------------------------------------------------------ *
 * Muskeln
 * ------------------------------------------------------------------ */

// [Muskel, Formen, auch gespiegelt]
const FRONT = [
  ['traps', [P('M50 41 C56 41 61 43 65.5 47.5 C60 50.5 55 52.5 50 52.5 C45 52.5 40 50.5 34.5 47.5 C39 43 44 41 50 41 Z')], false],
  ['delts', [belly(J.shoulder, J.elbow, -0.08, 0.24, 6.9)], true],
  ['biceps', [belly(J.shoulder, J.elbow, 0.28, 0.90, 5.4)], true],
  ['chest', [P('M50.5 55 C58 54 64.5 57 68 62 C68.5 69 65 75 59 77.5 C55 79 52 78.5 50.5 78 Z')], true],
  ['abs', [P('M43.5 81 H56.5 C57.5 90 57.5 100 56 110 C54 112.5 46 112.5 44 110 C42.5 100 42.5 90 43.5 81 Z')], false],
  ['quads', [belly(J.hip, J.knee, 0.02, 0.93, 9.8)], true],
  ['calves', [belly(J.knee, J.ankle, 0.02, 0.52, 6.9)], true],
];

const BACK = [
  ['traps', [P('M50 40 C57 40 63 43 67 47.5 C64 60 60 69 57 74 H43 C40 69 36 60 33 47.5 C37 43 43 40 50 40 Z')], false],
  ['rearDelts', [belly(J.shoulder, J.elbow, -0.08, 0.24, 6.9)], true],
  ['lats', [P('M52 64 C60 65 67 71 69 79 C68 90 62 100 54 107 C53 96 52 80 52 64 Z')], true],
  ['triceps', [belly(J.shoulder, J.elbow, 0.26, 0.90, 5.8)], true],
  ['glutes', [['e', 57, 124, 9.4, 11.5, -12]], true],
  ['hamstrings', [belly(J.hip, J.knee, 0.14, 0.94, 9.4)], true],
  ['calves', [belly(J.knee, J.ankle, 0.02, 0.54, 7.1)], true],
];

/* ------------------------------------------------------------------ *
 * Zeichnen
 * ------------------------------------------------------------------ */

function shapeEl(shape, mirrored) {
  const mx = (x) => (mirrored ? 100 - x : x);
  if (shape[0] === 'e') {
    const [, cx, cy, rx, ry, rot] = shape;
    const node = document.createElementNS(BODY_NS, 'ellipse');
    node.setAttribute('cx', mx(cx).toFixed(2));
    node.setAttribute('cy', cy.toFixed(2));
    node.setAttribute('rx', rx.toFixed(2));
    node.setAttribute('ry', ry.toFixed(2));
    if (rot) {
      const a = mirrored ? -rot : rot;
      node.setAttribute('transform', `rotate(${a.toFixed(1)} ${mx(cx).toFixed(2)} ${cy.toFixed(2)})`);
    }
    return node;
  }
  if (shape[0] === 'poly') {
    const node = document.createElementNS(BODY_NS, 'polygon');
    node.setAttribute('points', shape[1].map(([x, y]) => `${mx(x).toFixed(2)},${y.toFixed(2)}`).join(' '));
    return node;
  }
  const node = document.createElementNS(BODY_NS, 'path');
  node.setAttribute('d', shape[1]);
  if (mirrored) node.setAttribute('transform', 'translate(100,0) scale(-1,1)');
  return node;
}

function halfView(regions, active, label) {
  const g = document.createElementNS(BODY_NS, 'g');

  // Silhouette einmal rechts, einmal gespiegelt – der Rumpf ist schon
  // symmetrisch gezeichnet und käme sonst doppelt.
  FILLER.forEach((shape) => {
    const both = shape === TORSO || shape === PELVIS ? [false] : [false, true];
    both.forEach((m) => {
      const node = shapeEl(shape, m);
      node.setAttribute('class', 'bm-filler');
      g.appendChild(node);
    });
  });

  regions.forEach(([muscle, shapes, mirror]) => {
    const on = active.has(muscle);
    shapes.forEach((shape) => {
      [false, ...(mirror ? [true] : [])].forEach((m) => {
        const node = shapeEl(shape, m);
        node.setAttribute('class', `bm-part${on ? ' on' : ''}`);
        if (on) {
          const title = document.createElementNS(BODY_NS, 'title');
          title.textContent = MUSCLE_LABEL[muscle] || muscle;
          node.appendChild(title);
        }
        g.appendChild(node);
      });
    });
  });

  const text = document.createElementNS(BODY_NS, 'text');
  text.setAttribute('x', 50);
  text.setAttribute('y', 219);
  text.setAttribute('class', 'bm-label');
  text.textContent = label;
  g.appendChild(text);
  return g;
}

/**
 * Zeichnet Vorder- und Rückansicht nebeneinander.
 *
 * @param {Element} host   Zielelement, wird geleert
 * @param {Set}     active Muskelregionen, die hervorgehoben werden
 */
export function mountBody(host, active) {
  host.textContent = '';
  const svg = document.createElementNS(BODY_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 210 226');
  svg.setAttribute('class', 'bodymap');
  svg.setAttribute('role', 'img');

  const names = [...active].map((m) => MUSCLE_LABEL[m] || m);
  svg.setAttribute('aria-label', names.length
    ? `Heute beansprucht: ${names.join(', ')}`
    : 'Keine Muskelgruppen hervorgehoben');

  const front = halfView(FRONT, active, 'vorn');
  const back = halfView(BACK, active, 'hinten');
  back.setAttribute('transform', 'translate(110,0)');
  svg.append(front, back);
  host.appendChild(svg);
}
