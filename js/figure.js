/*
 * Animierte Bewegungsabläufe.
 *
 * Statt lizenzpflichtiger Übungs-GIFs zeichnet die App eine eigene Figur und
 * bewegt sie zwischen zwei Schlüsselstellungen hin und her. Das bleibt klein,
 * funktioniert offline und gehört uns.
 *
 * Eine Stellung ist eine Sammlung benannter Punkte im Feld 100 × 100 (y zeigt
 * nach unten, Boden bei 93). Gezeichnet wird von der Seite; `mirror` schaltet
 * auf Frontansicht mit zwei Armen und Beinen, was nur bei Seitheben und
 * Reverse Fly etwas taugt.
 *
 * Die Muster sind nach Bewegungsart benannt, nicht nach Übung: ein Goblet
 * Squat und ein Bodyweight Squat teilen sich denselben Ablauf.
 */

const P = (head, neck, shoulder, elbow, hand, hip, knee, ankle, toe) => ({
  head, neck, shoulder, elbow, hand, hip, knee, ankle, toe,
});

export const PATTERNS = {
  squat: {
    label: 'Kniebeuge',
    poses: [
      P([50, 14], [50, 22], [50, 26], [46, 35], [50, 31], [50, 52], [50, 72], [50, 89], [59, 92]),
      P([54, 31], [53, 39], [53, 42], [49, 50], [52, 46], [43, 63], [57, 74], [50, 89], [59, 92]),
    ],
  },
  legcurl: {
    label: 'Beinbeuger',
    poses: [
      P([16, 84], [22, 84], [28, 84], [32, 90], [38, 91], [46, 62], [64, 70], [82, 85], [88, 87]),
      P([16, 84], [22, 84], [28, 84], [32, 90], [38, 91], [46, 60], [57, 53], [57, 80], [63, 84]),
    ],
  },
  thrust: {
    label: 'Hüftstreckung',
    poses: [
      P([15, 53], [20, 56], [25, 59], [30, 71], [42, 76], [52, 82], [70, 67], [78, 88], [85, 90]),
      P([15, 53], [20, 56], [25, 59], [32, 62], [45, 60], [52, 61], [70, 60], [78, 88], [85, 90]),
    ],
  },
  pushup: {
    label: 'Liegestütz',
    poses: [
      P([76, 40], [71, 44], [68, 48], [71, 70], [70, 91], [46, 60], [30, 72], [16, 84], [11, 91]),
      P([78, 61], [73, 65], [70, 69], [83, 80], [70, 91], [48, 75], [31, 82], [16, 88], [11, 92]),
    ],
  },
  press: {
    label: 'Drücken im Liegen',
    poses: [
      P([20, 74], [26, 76], [32, 78], [38, 86], [34, 71], [56, 80], [70, 65], [80, 85], [86, 87]),
      P([20, 74], [26, 76], [32, 78], [35, 65], [34, 51], [56, 80], [70, 65], [80, 85], [86, 87]),
    ],
  },
  row: {
    label: 'Rudern',
    poses: [
      P([66, 29], [62, 34], [59, 38], [59, 56], [59, 72], [38, 45], [36, 68], [34, 89], [43, 92]),
      P([66, 29], [62, 34], [59, 38], [48, 41], [57, 53], [38, 45], [36, 68], [34, 89], [43, 92]),
    ],
  },
  pullup: {
    label: 'Klimmzug',
    ground: false,
    bar: 12,
    poses: [
      P([46, 31], [46, 38], [50, 42], [51, 27], [50, 13], [46, 62], [46, 79], [43, 91], [52, 93]),
      P([46, 21], [46, 28], [50, 32], [58, 25], [50, 13], [46, 52], [46, 69], [43, 81], [52, 83]),
    ],
  },
  pike: {
    label: 'Überkopf-Drücken',
    poses: [
      P([70, 53], [65, 50], [62, 51], [66, 70], [70, 91], [50, 27], [38, 60], [26, 88], [21, 91]),
      P([75, 73], [70, 70], [66, 66], [79, 80], [70, 91], [50, 31], [38, 62], [26, 88], [21, 91]),
    ],
  },
  curl: {
    label: 'Bizeps-Curl',
    poses: [
      P([48, 14], [48, 22], [52, 27], [55, 45], [56, 61], [48, 52], [48, 72], [48, 89], [57, 92]),
      P([48, 14], [48, 22], [52, 27], [55, 45], [63, 33], [48, 52], [48, 72], [48, 89], [57, 92]),
    ],
  },
  triceps: {
    label: 'Trizeps-Strecken',
    poses: [
      P([20, 74], [26, 76], [32, 78], [42, 58], [30, 52], [56, 80], [70, 65], [80, 85], [86, 87]),
      P([20, 74], [26, 76], [32, 78], [42, 58], [48, 42], [56, 80], [70, 65], [80, 85], [86, 87]),
    ],
  },
  lateral: {
    label: 'Seitheben',
    mirror: true,
    poses: [
      P([50, 15], [50, 24], [41, 29], [35, 45], [33, 61], [46, 55], [44, 74], [43, 91], [43, 92]),
      P([50, 15], [50, 24], [41, 29], [26, 27], [12, 28], [46, 55], [44, 74], [43, 91], [43, 92]),
    ],
  },
  reversefly: {
    label: 'Reverse Fly',
    mirror: true,
    poses: [
      P([50, 27], [50, 36], [42, 40], [40, 56], [39, 70], [46, 62], [45, 78], [44, 91], [44, 92]),
      P([50, 27], [50, 36], [42, 40], [26, 39], [13, 35], [46, 62], [45, 78], [44, 91], [44, 92]),
    ],
  },
  crunch: {
    label: 'Crunch',
    poses: [
      P([21, 72], [27, 74], [33, 76], [29, 66], [23, 63], [56, 82], [70, 64], [80, 84], [86, 86]),
      P([34, 57], [38, 62], [42, 67], [37, 57], [31, 53], [56, 82], [70, 64], [80, 84], [86, 86]),
    ],
  },
  calf: {
    label: 'Wadenheben',
    poses: [
      P([47, 17], [47, 25], [51, 29], [55, 41], [56, 54], [47, 55], [47, 73], [47, 88], [61, 92]),
      P([47, 7], [47, 15], [51, 19], [55, 31], [56, 44], [47, 45], [47, 63], [47, 76], [61, 92]),
    ],
  },
};

const NS = 'http://www.w3.org/2000/svg';
const CYCLE_MS = 2800;

function el(name, attrs) {
  const node = document.createElementNS(NS, name);
  Object.entries(attrs).forEach(([k, v]) => node.setAttribute(k, v));
  return node;
}

const lerp = (a, b, t) => a + (b - a) * t;
const lerpPt = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];

/** Zwei Punkte spiegeln – für die Frontansicht der zweiten Körperhälfte. */
const mirrorX = (p) => [100 - p[0], p[1]];

const active = new Set();

/**
 * Hängt eine animierte Figur in ein Element.
 *
 * @param {Element} host    Zielelement, wird geleert
 * @param {string}  pattern Schlüssel aus PATTERNS
 * @param {boolean} weight  Hantel in die Hand zeichnen
 */
export function mountFigure(host, pattern, weight) {
  const spec = PATTERNS[pattern];
  host.textContent = '';
  if (!spec) return;

  const svg = el('svg', { viewBox: '0 0 100 100', class: 'fig', 'aria-hidden': 'true' });

  if (spec.ground !== false) {
    svg.appendChild(el('line', { x1: 4, y1: 93, x2: 96, y2: 93, class: 'fig-ground' }));
  }
  if (spec.bar) {
    svg.appendChild(el('line', { x1: 22, y1: spec.bar, x2: 78, y2: spec.bar, class: 'fig-bar' }));
  }

  const limbs = [];
  const addSide = (mirrored) => {
    const arm = el('path', { class: 'fig-limb' });
    const leg = el('path', { class: 'fig-limb' });
    const foot = el('path', { class: 'fig-limb fig-foot' });
    svg.append(leg, foot, arm);
    limbs.push({ arm, leg, foot, mirrored });
  };
  addSide(false);
  if (spec.mirror) addSide(true);

  const torso = el('path', { class: 'fig-torso' });
  const head = el('circle', { r: 7, class: 'fig-head' });
  svg.append(torso, head);

  const bell = weight ? el('rect', { width: 15, height: 5, rx: 2.5, class: 'fig-weight' }) : null;
  if (bell) svg.appendChild(bell);

  host.appendChild(svg);

  const [a, b] = spec.poses;
  const draw = (t) => {
    const p = {};
    Object.keys(a).forEach((k) => { p[k] = lerpPt(a[k], b[k], t); });

    const line = (...pts) => `M ${pts.map((q) => `${q[0].toFixed(1)} ${q[1].toFixed(1)}`).join(' L ')}`;
    torso.setAttribute('d', line(p.neck, p.hip));
    head.setAttribute('cx', p.head[0].toFixed(1));
    head.setAttribute('cy', p.head[1].toFixed(1));

    limbs.forEach(({ arm, leg, foot, mirrored }) => {
      const q = mirrored
        ? Object.fromEntries(Object.entries(p).map(([k, v]) => [k, mirrorX(v)]))
        : p;
      arm.setAttribute('d', line(q.shoulder, q.elbow, q.hand));
      leg.setAttribute('d', line(q.hip, q.knee, q.ankle));
      foot.setAttribute('d', line(q.ankle, q.toe));
    });

    if (bell) {
      bell.setAttribute('x', (p.hand[0] - 7.5).toFixed(1));
      bell.setAttribute('y', (p.hand[1] - 2.5).toFixed(1));
    }
  };

  const entry = { draw };
  draw(0);
  active.add(entry);
  return () => active.delete(entry);
}

export function clearFigures() {
  active.clear();
}

/** Eine gemeinsame Schleife für alle sichtbaren Figuren. */
function frame(now) {
  if (document.visibilityState === 'visible' && active.size) {
    const t = (now % CYCLE_MS) / CYCLE_MS;
    const tri = t < 0.5 ? t * 2 : (1 - t) * 2;
    const eased = tri * tri * (3 - 2 * tri); // weiche Umkehr an beiden Enden
    active.forEach((f) => f.draw(eased));
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
