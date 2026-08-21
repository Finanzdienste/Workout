/*
 * Kleine Verlaufskarten für die Statistik.
 *
 * Bewusst Small Multiples statt eines Diagramms mit vielen Linien: Bei zwölf
 * Muskelgruppen wären zwölf Farben nicht mehr auseinanderzuhalten – schon gar
 * nicht für Farbfehlsichtige. Eine Karte je Reihe braucht dagegen nur eine
 * Farbe, und die Überschrift ersetzt die Legende.
 *
 * Je Karte: Fläche als 10-%-Hauch, Linie 2 px, Endpunkt als Punkt mit Ring in
 * der Untergrundfarbe. Beschriftet wird nur der Endwert – eine Zahl an jedem
 * Punkt liest niemand. Beim Ziehen über die Karte wandert der Punkt mit und
 * die Kopfzeile zeigt den Wert des Tages; die vollständige Reihe steht im
 * aria-label, damit sie auch ohne Sehen zugänglich ist.
 */

const CHART_NS = 'http://www.w3.org/2000/svg';
const VW = 100;
const VH = 30;

const svgEl = (name, attrs = {}) => {
  const node = document.createElementNS(CHART_NS, name);
  Object.entries(attrs).forEach(([k, v]) => node.setAttribute(k, v));
  return node;
};

/**
 * Eine Verlaufskarte.
 *
 * @param {object} o
 * @param {string} o.label   Überschrift, ersetzt die Legende
 * @param {Array}  o.points  [{ label, value }] in zeitlicher Reihenfolge
 * @param {string} o.unit    Einheit für die Beschriftung
 * @param {Function} o.fmt   Zahlformatierung
 */
export function sparkPanel({ label, points, unit = '', fmt = (v) => String(Math.round(v)) }) {
  const fig = document.createElement('figure');
  fig.className = 'spark';

  const cap = document.createElement('figcaption');
  const name = document.createElement('span');
  name.className = 'spark-name';
  name.textContent = label;
  const val = document.createElement('span');
  val.className = 'spark-val';
  cap.append(name, val);
  fig.appendChild(cap);

  const last = points[points.length - 1];
  const first = points[0];
  const setVal = (p) => { val.textContent = `${fmt(p.value)}${unit ? ` ${unit}` : ''}`; };
  setVal(last);

  const values = points.map((p) => p.value);
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = hi - lo || 1;
  // Bei nur einem Punkt gibt es keine Strecke – dann in die Mitte setzen.
  const xy = points.map((p, i) => [
    points.length === 1 ? VW / 2 : (i / (points.length - 1)) * VW,
    VH - ((p.value - lo) / span) * (VH - 6) - 3,
  ]);

  const svg = svgEl('svg', {
    viewBox: `0 0 ${VW} ${VH}`, class: 'spark-svg', preserveAspectRatio: 'none',
    role: 'img',
    'aria-label': `${label}: ${points.map((p) => `${p.label} ${fmt(p.value)}${unit ? ` ${unit}` : ''}`).join(', ')}`,
  });

  const d = xy.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
  svg.appendChild(svgEl('path', { d: `${d} L${VW} ${VH} L0 ${VH} Z`, class: 'spark-area' }));
  svg.appendChild(svgEl('path', { d, class: 'spark-line' }));

  const dot = svgEl('circle', { cx: xy[xy.length - 1][0], cy: xy[xy.length - 1][1], r: 2.6, class: 'spark-dot' });
  svg.appendChild(dot);
  fig.appendChild(svg);

  const foot = document.createElement('div');
  foot.className = 'spark-foot';
  const delta = last.value - first.value;
  foot.textContent = points.length > 1
    ? `${fmt(first.value)} → ${fmt(last.value)}${unit ? ` ${unit}` : ''}${delta ? ` (${delta > 0 ? '+' : '−'}${fmt(Math.abs(delta))})` : ''}`
    : `einmal · ${first.label}`;
  fig.appendChild(foot);

  // Ziehen über die Karte zeigt den Wert des jeweiligen Tages
  const pick = (e) => {
    const box = svg.getBoundingClientRect();
    const rel = ((e.touches ? e.touches[0] : e).clientX - box.left) / box.width;
    const i = Math.max(0, Math.min(points.length - 1, Math.round(rel * (points.length - 1))));
    dot.setAttribute('cx', xy[i][0]);
    dot.setAttribute('cy', xy[i][1]);
    setVal(points[i]);
    foot.textContent = points[i].label;
  };
  const reset = () => {
    dot.setAttribute('cx', xy[xy.length - 1][0]);
    dot.setAttribute('cy', xy[xy.length - 1][1]);
    setVal(last);
    foot.textContent = points.length > 1
      ? `${fmt(first.value)} → ${fmt(last.value)}${unit ? ` ${unit}` : ''}${delta ? ` (${delta > 0 ? '+' : '−'}${fmt(Math.abs(delta))})` : ''}`
      : `einmal · ${first.label}`;
  };
  fig.addEventListener('pointermove', pick);
  fig.addEventListener('pointerleave', reset);

  return fig;
}
