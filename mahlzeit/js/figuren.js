/*
 * Zeichnungen für die Sportübungen (v5) – Strichfiguren in der Seitenansicht.
 *
 * Tobi, 17.11.2026: „Mach Zeichnungen für die Sportübungen". Die 3D-Figuren
 * der Workout-App (js/figure.js) kennen weder Schwungstäbe noch Schwingstab,
 * Wackelkissen oder Heimtrainer; diese hier sind klein, ohne Bibliothek und
 * zeigen genau das, was man beim Üben wissen muss: Ausgangsstellung,
 * Endstellung und das Gerät. Die Figur pendelt langsam zwischen beiden
 * (SVG-Animation); wer „Bewegung reduzieren" eingestellt hat, sieht nur die
 * Ausgangsstellung.
 *
 * Eine Stellung: Gelenke in einem Feld von 100 × 100, Boden bei y = 92.
 *   k Kopf, n Schultern, h Hüfte, c Biegung des Rückens (sonst gerade),
 *   kv/fv Knie und Fuß vorn, kh/fh hinten, ev/hv Ellenbogen und Hand vorn,
 *   eh/hh hinten. „Vorn" ist das Bein und der Arm zum Betrachter.
 * b überschreibt Gelenke für die Endstellung; teile(p) zeichnet Geräte, die
 * mit der Figur gehen (Hantel in der Hand), deko ist fest (Stuhl, Wand).
 */

const S = { k: [50, 16], n: [50, 25], h: [50, 51], kv: [52, 71], fv: [53, 91], kh: [48, 71], fh: [47, 91], ev: [52, 38], hv: [53, 50], eh: [48, 38], hh: [47, 50] };
const SITZ = { k: [45, 27], n: [44, 36], h: [42, 62], kv: [62, 63], fv: [62, 91], kh: [60, 64], fh: [59, 91], ev: [50, 48], hv: [58, 56], eh: [48, 48], hh: [56, 56] };
const VIER = { k: [78, 52], n: [69, 60], h: [40, 60], kv: [40, 91], fv: [20, 91], kh: [38, 91], fh: [18, 91], ev: [70, 75], hv: [71, 91], eh: [68, 75], hh: [69, 91] };
const RUECKEN = { k: [16, 82], n: [25, 86], h: [50, 87], kv: [64, 70], fv: [72, 91], kh: [62, 70], fh: [70, 91], ev: [34, 90], hv: [43, 90], eh: [33, 90], hh: [42, 90] };

// Geräte und Umgebung (fest)
const linie = (a, b, w = 2.5, art = 'ding') => ({ a, b, w, art });
const stuhl = (x, rechts = true) => {
  const lehne = rechts ? x : x + 20;
  return [linie([x, 64], [x + 20, 64], 3), linie([x + 1, 64], [x + 1, 91]), linie([x + 19, 64], [x + 19, 91]), linie([lehne, 64], [lehne, 38], 3)];
};
const wand = (x) => [linie([x, 6], [x, 92], 3, 'wand')];
const tuer = (x) => [linie([x, 6], [x, 92], 4, 'wand'), linie([x, 6], [x + 12, 6], 4, 'wand')];
const stufe = (x) => [linie([x, 82], [x + 22, 82], 2.5), linie([x, 82], [x, 92]), linie([x + 22, 82], [x + 22, 92])];
const matte = [linie([8, 92.5], [92, 92.5], 3, 'matte')];
const hantel = (p) => (p ? [linie([p[0] - 4.5, p[1]], [p[0] + 4.5, p[1]], 2.2, 'eisen'), linie([p[0] - 4.5, p[1] - 3], [p[0] - 4.5, p[1] + 3], 3, 'eisen'), linie([p[0] + 4.5, p[1] - 3], [p[0] + 4.5, p[1] + 3], 3, 'eisen')] : []);
const stab = (p, dx, dy) => [linie([p[0] - dx, p[1] - dy], [p[0] + dx, p[1] + dy], 2, 'stab')];
const bogen = (x, y, r, text = '') => `<path class="pfeil" d="M ${x - r} ${y} A ${r} ${r} 0 1 1 ${x} ${y + r}"/>${text}`;

const U = (deko, a, b = null, teile = null, extra = '') => ({ deko, a, b, teile, extra });

export const FIGUREN = {
  schulterkreisen: U([], { ...S, ev: [55, 35], hv: [57, 47] }, { ev: [46, 36], hv: [45, 48], n: [49, 24] }, null, bogen(50, 25, 6)),
  nackenSeite: U([], { ...S, k: [50, 16] }, { k: [44, 19] }, null, '<text class="hinweis-text" x="62" y="14">⇄</text>'),
  brustdehnung: U(tuer(64), { ...S, h: [52, 51], n: [52, 25], k: [52, 16], ev: [64, 26], hv: [64, 14], kv: [58, 71], fv: [62, 91] }, { h: [55, 51], n: [57, 25], k: [58, 16] }),
  rumpfdrehen: U(stuhl(30), { ...SITZ, ev: [52, 44], hv: [48, 40], eh: [52, 44], hh: [48, 40] }, { ev: [40, 44], hv: [44, 40], k: [43, 27] }, null, bogen(44, 20, 7)),
  katzeKuh: U(matte, { ...VIER, c: [55, 48] }, { c: [55, 70], k: [79, 48] }),
  katzeKuhStehend: U([], { k: [70, 34], n: [64, 41], h: [44, 54], c: [54, 40], kv: [52, 72], fv: [50, 91], kh: [48, 72], fh: [46, 91], ev: [62, 54], hv: [56, 64], eh: [60, 54], hh: [54, 64] }, { c: [54, 52], k: [72, 36] }),
  hueftbeugerStehend: U(stuhl(74, false), { k: [50, 18], n: [50, 27], h: [49, 56], kv: [66, 71], fv: [68, 91], kh: [38, 77], fh: [28, 89], ev: [60, 42], hv: [74, 40], eh: [56, 42], hh: [72, 40] }, { h: [53, 57], n: [52, 27], k: [52, 18], kh: [42, 79] }),
  beinbeugerDehnen: U(stufe(62), { k: [42, 18], n: [43, 27], h: [44, 54], kv: [57, 68], fv: [70, 81], kh: [44, 73], fh: [44, 91], ev: [48, 40], hv: [54, 52], eh: [46, 40], hh: [52, 52] }, { k: [62, 32], n: [56, 34], ev: [60, 46], hv: [62, 58], eh: [58, 46], hh: [60, 58] }),
  wadeGestreckt: U(wand(82), { k: [66, 24], n: [62, 31], h: [52, 55], kv: [62, 72], fv: [64, 91], kh: [42, 74], fh: [32, 91], ev: [72, 34], hv: [82, 32], eh: [70, 34], hh: [81, 34] }, { k: [69, 26], n: [65, 33], h: [55, 57], ev: [74, 38] }),
  piriformis: U(matte, { ...RUECKEN, kh: [60, 64], fh: [70, 72], kv: [70, 70], fv: [58, 64], ev: [46, 80], hv: [60, 70], eh: [44, 80], hh: [58, 70] }, { kh: [56, 60], fh: [66, 66], kv: [66, 64], fv: [54, 58], hv: [56, 64], hh: [55, 64] }),
  schwingstabLocker: U([], { ...S, ev: [58, 34], hv: [66, 36] }, { hv: [66, 37] }, (p, b) => stab(p.hv, b ? -1.5 : 1.5, 20)),

  radLocker: U([], { k: [54, 22], n: [49, 30], h: [38, 49], kv: [55, 58], fv: [58, 79], kh: [47, 66], fh: [39, 82], ev: [58, 37], hv: [66, 44], eh: [57, 37], hh: [65, 44] }, { kv: [47, 66], fv: [39, 82], kh: [55, 58], fh: [58, 79] }, null, null),
  marschieren: U([], { ...S, kv: [60, 62], fv: [58, 80], ev: [46, 38], hv: [44, 49], eh: [55, 37], hh: [58, 48] }, { kv: [52, 71], fv: [53, 91], kh: [58, 62], fh: [56, 80], ev: [55, 37], hv: [58, 48], eh: [46, 38], hh: [44, 49] }),
  radIntervall: null, // wie radLocker, unten gesetzt

  kniebeugeStuhl: U(stuhl(24), { ...S, ev: [56, 38], hv: [64, 40], eh: [54, 38], hh: [62, 40] }, { k: [58, 34], n: [53, 41], h: [40, 63], kv: [57, 68], fv: [54, 91], kh: [55, 68], fh: [52, 91], ev: [62, 48], hv: [70, 48], eh: [60, 48], hh: [68, 48] }),
  gobletStuhl: U(stuhl(24), { ...S, ev: [52, 42], hv: [56, 34], eh: [51, 42], hh: [55, 34] }, { k: [58, 34], n: [53, 41], h: [40, 63], kv: [57, 68], fv: [54, 91], kh: [55, 68], fh: [52, 91], ev: [56, 56], hv: [61, 49], eh: [55, 56], hh: [60, 49] }, (p) => [linie([p.hv[0], p.hv[1] - 6], [p.hv[0], p.hv[1] + 6], 3, 'eisen'), linie([p.hv[0] - 3, p.hv[1] - 6], [p.hv[0] + 3, p.hv[1] - 6], 3, 'eisen'), linie([p.hv[0] - 3, p.hv[1] + 6], [p.hv[0] + 3, p.hv[1] + 6], 3, 'eisen')]),
  wandLiegestuetz: U(wand(84), { k: [72, 24], n: [66, 31], h: [52, 60], kv: [44, 76], fv: [36, 91], kh: [42, 76], fh: [34, 91], ev: [76, 32], hv: [84, 33], eh: [74, 32], hh: [83, 34] }, { k: [77, 27], n: [71, 34], h: [55, 62], ev: [73, 44], eh: [72, 44] }),
  rudernKH: U(stuhl(74, false), { k: [70, 42], n: [62, 46], h: [40, 54], kv: [52, 72], fv: [54, 91], kh: [42, 72], fh: [38, 91], ev: [62, 60], hv: [62, 72], eh: [70, 54], hh: [76, 64] }, { ev: [52, 40], hv: [56, 52] }, (p) => hantel(p.hv)),
  schulterblatt: U([], { ...S }, { n: [48, 25], ev: [50, 38], hv: [51, 50], eh: [46, 38], hh: [45, 50] }, null, '<path class="pfeil" d="M 42 30 L 36 34 M 36 34 L 40 36"/>'),
  schulterdrueckenKH: U(stuhl(30), { ...SITZ, ev: [52, 42], hv: [50, 30], eh: [50, 42], hh: [48, 30] }, { ev: [48, 22], hv: [46, 10], eh: [47, 22], hh: [45, 10] }, (p) => [...hantel(p.hv)]),
  bizepsKH: U([], { ...S }, { hv: [58, 33], hh: [55, 33] }, (p) => hantel(p.hv)),
  beckenheben: U(matte, { ...RUECKEN }, { h: [50, 72], kv: [65, 68], kh: [63, 68] }),
  wadenheben: U(stuhl(66, false), { ...S, ev: [56, 38], hv: [66, 40] }, { k: [50, 12], n: [50, 21], h: [50, 47], kv: [52, 67], fv: [53, 86], kh: [48, 67], fh: [47, 86], ev: [56, 34], hv: [66, 40] }),
  vogelhund: U(matte, { ...VIER }, { ev: [80, 58], hv: [92, 56], kh: [24, 62], fh: [8, 60] }),
  schwingstabRumpf: U([], { ...S, ev: [56, 36], hv: [64, 32], eh: [55, 37], hh: [63, 34] }, { hv: [64, 33], hh: [63, 35] }, (p, b) => stab(p.hv, b ? -1.5 : 1.5, 20)),
  schwungstaebe: U([], { k: [56, 24], n: [53, 32], h: [44, 56], kv: [58, 70], fv: [56, 91], kh: [54, 70], fh: [50, 91], ev: [60, 40], hv: [68, 34], eh: [60, 48], hh: [68, 58] }, { hv: [68, 58], hh: [68, 34] },
    (p) => [linie(p.hv, [p.hv[0] + 14, p.hv[1] + (p.hv[1] < 45 ? -8 : 10)], 3, 'stab'), linie(p.hh, [p.hh[0] + 14, p.hh[1] + (p.hh[1] < 45 ? -8 : 10)], 3, 'stab hinten')]),
  wackelkissenStand: U(stuhl(70, false), { ...S, kh: [44, 68], fh: [40, 84], ev: [58, 38], hv: [70, 40] }, { k: [51, 16], n: [51, 25], h: [50, 51] }, null, '<ellipse class="kissen" cx="53" cy="89.5" rx="9" ry="3"/>'),
  einbeinstand: U(stuhl(70, false), { ...S, kh: [44, 68], fh: [40, 84], ev: [58, 38], hv: [70, 40] }, { k: [51, 16] }),
};
// Studio (v7): Maschinen als Sitz, Polster und Griff
const polster = (x1, y1, x2, y2) => linie([x1, y1], [x2, y2], 4);
const SITZ_M = { ...SITZ, h: [42, 62], n: [40, 36], k: [40, 27] };
FIGUREN.ergometer = null;
FIGUREN.beinpresse = U([polster(18, 36, 36, 70), polster(36, 70, 52, 70), linie([44, 70], [44, 91])],
  { k: [22, 38], n: [27, 46], h: [40, 66], kv: [56, 50], fv: [68, 62], kh: [55, 52], fh: [67, 64], ev: [34, 58], hv: [42, 68], eh: [33, 58], hh: [41, 68] },
  { kv: [62, 58], fv: [78, 64], kh: [61, 60], fh: [77, 66] },
  (p) => [linie([p.fv[0] + 2, p.fv[1] - 12], [p.fv[0] + 2, p.fv[1] + 10], 3.5, 'eisen')]);
FIGUREN.brustpresse = U([polster(36, 28, 36, 64), ...stuhl(36, true).slice(0, 3)],
  { ...SITZ_M, ev: [42, 46], hv: [54, 40], eh: [41, 46], hh: [53, 40] }, { ev: [56, 38], hv: [70, 38], eh: [55, 39], hh: [69, 39] },
  (p) => [linie([p.hv[0], p.hv[1] - 5], [p.hv[0], p.hv[1] + 5], 3.5, 'eisen')]);
FIGUREN.latzug = U([...stuhl(30, true).slice(0, 3), polster(52, 56, 62, 56), linie([48, 2], [48, 6], 1.5, 'ding')],
  { ...SITZ_M, ev: [46, 18], hv: [48, 8], eh: [44, 18], hh: [46, 8] }, { ev: [36, 46], hv: [46, 32], eh: [35, 46], hh: [45, 32] },
  (p) => [linie([p.hv[0] - 13, p.hv[1]], [p.hv[0] + 13, p.hv[1]], 3, 'eisen'), linie([p.hv[0], p.hv[1]], [48, 4], 1, 'ding')]);
FIGUREN.ruderzug = U([linie([28, 70], [56, 70], 4), linie([84, 60], [84, 84], 4), linie([88, 50], [88, 91], 2)],
  { k: [42, 37], n: [42, 46], h: [36, 68], kv: [56, 58], fv: [82, 70], kh: [55, 60], fh: [81, 72], ev: [56, 52], hv: [70, 52], eh: [55, 53], hh: [69, 53] },
  { ev: [30, 60], hv: [48, 58], eh: [29, 61], hh: [47, 59], k: [40, 36], n: [40, 45] },
  (p) => [linie([p.hv[0] - 1, p.hv[1] - 4], [p.hv[0] - 1, p.hv[1] + 4], 3, 'eisen'), linie([p.hv[0], p.hv[1]], [88, 56], 1, 'ding')]);
FIGUREN.beinbeugerMaschine = U([polster(34, 30, 34, 64), ...stuhl(34, true).slice(0, 3), polster(54, 58, 64, 58)],
  { ...SITZ_M, k: [42, 27], n: [42, 36], h: [44, 62], kv: [64, 62], fv: [84, 64], kh: [63, 64], fh: [83, 66], ev: [50, 50], hv: [56, 60], eh: [49, 50], hh: [55, 60] },
  { kv: [64, 62], fv: [62, 84], kh: [63, 64], fh: [61, 86] },
  (p) => [linie([p.fv[0] + 1, p.fv[1] - 3], [p.fv[0] + 1, p.fv[1] + 3], 5, 'eisen')]);
FIGUREN.schulterMaschine = U([polster(36, 22, 36, 64), ...stuhl(36, true).slice(0, 3)],
  { ...SITZ_M, ev: [50, 44], hv: [50, 30], eh: [48, 44], hh: [48, 30] }, { ev: [48, 22], hv: [47, 10], eh: [46, 22], hh: [45, 10] },
  (p) => [linie([p.hv[0] - 3, p.hv[1]], [p.hv[0] + 4, p.hv[1]], 3.5, 'eisen')]);
FIGUREN.radIntervall = FIGUREN.radLocker;
// Das Rad: Sattel, Lenker, Schwungrad – fest unter der Figur
const RAD = '<g class="rad"><circle cx="48" cy="80" r="11"/><path d="M 36 50 L 46 50 M 41 50 L 48 80 L 64 44 M 60 44 L 68 44 M 30 91 L 70 91 M 48 80 L 36 91 M 48 80 L 62 91"/></g>';
FIGUREN.radLocker.extra = RAD;
FIGUREN.ergometer = FIGUREN.radLocker;

const GLIEDER = [['h', 'kh', 'hinten'], ['kh', 'fh', 'hinten'], ['n', 'eh', 'hinten'], ['eh', 'hh', 'hinten'], ['h', 'kv', ''], ['kv', 'fv', ''], ['n', 'ev', ''], ['ev', 'hv', '']];

const zahl = (x) => Math.round(x * 10) / 10;
const pkt = (p) => `${zahl(p[0])} ${zahl(p[1])}`;
const mitte = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];

function belebt(attr, a, b) {
  return a === b ? '' : `<animate attributeName="${attr}" values="${a};${b};${a}" dur="4s" repeatCount="indefinite" calcMode="spline" keySplines="0.45 0 0.55 1;0.45 0 0.55 1"/>`;
}

function strich(a, b, aa, bb, w, art) {
  const [x1, y1, x2, y2] = [a[0], a[1], b[0], b[1]].map(zahl);
  const [u1, v1, u2, v2] = [aa[0], aa[1], bb[0], bb[1]].map(zahl);
  return `<line class="${art}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke-width="${w}">${belebt('x1', x1, u1)}${belebt('y1', y1, v1)}${belebt('x2', x2, u2)}${belebt('y2', y2, v2)}</line>`;
}

/**
 * Die Zeichnung zu einer Übung als SVG-Text, oder '' wenn es keine gibt.
 * `ruhig`: nur die Ausgangsstellung (Bewegung reduzieren); `ende`: nur die
 * Endstellung (für die Übersicht in den Tests).
 */
export function figur(id, { ruhig = false, ende = false } = {}) {
  const f = FIGUREN[id];
  if (!f) return '';
  const a = ende && f.b ? { ...f.a, ...f.b } : f.a;
  const b = ruhig || ende || !f.b ? a : { ...a, ...f.b };
  const teile = [];
  teile.push(`<line class="boden" x1="4" y1="92" x2="96" y2="92"/>`);
  if (f.extra && f.extra.startsWith('<g class="rad"')) teile.push(f.extra);
  f.deko.forEach((d) => teile.push(strich(d.a, d.b, d.a, d.b, d.w, d.art)));
  // Gelenke
  GLIEDER.filter((g) => g[2]).forEach(([von, nach, art]) => teile.push(strich(a[von], a[nach], b[von], b[nach], 3.4, `glied ${art}`)));
  const ca = a.c || mitte(a.h, a.n);
  const cb = b.c || (b === a ? ca : mitte(b.h, b.n));
  const da = `M ${pkt(a.h)} Q ${pkt(ca)} ${pkt(a.n)}`;
  const db = `M ${pkt(b.h)} Q ${pkt(cb)} ${pkt(b.n)}`;
  teile.push(`<path class="rumpf" d="${da}">${belebt('d', da, db)}</path>`);
  GLIEDER.filter((g) => !g[2]).forEach(([von, nach]) => teile.push(strich(a[von], a[nach], b[von], b[nach], 3.6, 'glied')));
  if (f.teile) {
    const ta = f.teile(a, false);
    const tb = f.teile(b, b !== a);
    ta.forEach((t, i) => teile.push(strich(t.a, t.b, (tb[i] || t).a, (tb[i] || t).b, t.w, t.art)));
  }
  teile.push(`<circle class="kopf" cx="${zahl(a.k[0])}" cy="${zahl(a.k[1])}" r="6.2">${belebt('cx', zahl(a.k[0]), zahl(b.k[0]))}${belebt('cy', zahl(a.k[1]), zahl(b.k[1]))}</circle>`);
  if (f.extra && !f.extra.startsWith('<g class="rad"')) teile.push(f.extra);
  return `<svg class="figur" viewBox="0 0 100 100" role="img" aria-hidden="true" focusable="false">${teile.join('')}</svg>`;
}
