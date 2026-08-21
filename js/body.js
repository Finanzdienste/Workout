/*
 * Körperkarte: zeigt in Vorder- und Rückansicht, was heute drankommt.
 *
 * Der Körper ist aus den Muskelregionen selbst zusammengesetzt – dadurch ist
 * Hervorheben nur eine Frage der Füllfarbe, und es braucht keine zweite
 * Zeichnung darunter. Was keine Trainingsregion ist (Kopf, Unterarme, Hände,
 * Füße), liegt als neutrales Beiwerk daneben.
 *
 * Gezeichnet wird in einem Feld von 100 × 220 je Ansicht, symmetrisch um
 * x = 50. Seitenpaare werden nur einmal angegeben und automatisch gespiegelt.
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

// ['e', cx, cy, rx, ry] Ellipse · ['p', d] Pfad · mirror: zusätzlich gespiegelt
const E = (cx, cy, rx, ry) => ['e', cx, cy, rx, ry];

const FRONT = [
  ['delts', [E(29, 49, 11, 10)], true],
  ['chest', [['p', 'M40 43 H49 V67 Q41 66 37 58 Q35 49 40 43 Z']], true],
  ['biceps', [E(23, 67, 7, 14)], true],
  ['abs', [['p', 'M42 68 H58 Q60 84 58 100 H42 Q40 84 42 68 Z']], false],
  ['quads', [E(41, 133, 11, 27)], true],
  ['calves', [E(41, 180, 8, 19)], true],
];

const BACK = [
  ['traps', [['p', 'M50 35 L64 43 L58 60 H42 L36 43 Z']], false],
  ['rearDelts', [E(29, 49, 11, 10)], true],
  ['lats', [['p', 'M42 58 H49 V95 L40 88 Q33 78 34 66 Z']], true],
  ['triceps', [E(23, 67, 7, 14)], true],
  ['glutes', [E(42, 112, 10, 12)], true],
  ['hamstrings', [E(41, 142, 11, 26)], true],
  ['calves', [E(41, 182, 9, 19)], true],
];

/*
 * Durchgehende Silhouette unter den Muskelregionen. Ohne sie zerfällt der
 * Körper in einzelne Flecken; die Regionen liegen darauf und heben sich nur
 * noch farblich ab.
 */
const FILLER = [
  E(50, 20, 11.5, 13),                     // Kopf
  ['p', 'M45 29 H55 V42 H45 Z'],           // Hals
  ['p', 'M36 45 Q34 70 38 100 H62 Q66 70 64 45 Z'], // Rumpf
  E(26, 64, 8.5, 22), E(74, 64, 8.5, 22),  // Oberarme
  E(20, 95, 6.5, 18), E(80, 95, 6.5, 18),  // Unterarme
  E(18, 114, 5.5, 6), E(82, 114, 5.5, 6),  // Hände
  ['p', 'M37 97 H63 L60 120 H40 Z'],       // Becken
  E(41, 133, 12, 31), E(59, 133, 12, 31),  // Oberschenkel
  E(41, 163, 8.5, 8), E(59, 163, 8.5, 8),  // Knie
  E(41, 182, 9.5, 22), E(59, 182, 9.5, 22),// Unterschenkel
  E(40, 205, 7.5, 5), E(60, 205, 7.5, 5),  // Füße
];

const BODY_NS = 'http://www.w3.org/2000/svg';

function shapeEl(shape, mirrored) {
  if (shape[0] === 'e') {
    const [, cx, cy, rx, ry] = shape;
    const node = document.createElementNS(BODY_NS, 'ellipse');
    node.setAttribute('cx', mirrored ? 100 - cx : cx);
    node.setAttribute('cy', cy);
    node.setAttribute('rx', rx);
    node.setAttribute('ry', ry);
    return node;
  }
  const node = document.createElementNS(BODY_NS, 'path');
  node.setAttribute('d', shape[1]);
  if (mirrored) node.setAttribute('transform', 'translate(100,0) scale(-1,1)');
  return node;
}

function halfView(regions, active, label) {
  const g = document.createElementNS(BODY_NS, 'g');

  FILLER.forEach((shape) => {
    const node = shapeEl(shape, false);
    node.setAttribute('class', 'bm-filler');
    g.appendChild(node);
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
  text.setAttribute('y', 216);
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
  svg.setAttribute('viewBox', '0 0 210 224');
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
