/*
 * Ein Balkendiagramm als SVG-Zeichenkette. Ohne Bibliothek, ohne Leinwand.
 *
 * Warum SVG und nicht <canvas>: Die Tafel wird zusammen mit dem übrigen HTML
 * neu gezeichnet, sobald sich der Zustand ändert. Eine Leinwand müsste dafür
 * nach jedem Rendern eigens angemalt werden – bei einer Zeichenkette fällt
 * dieser zweite Schritt weg, und die Tafel kann nicht „vergessen" werden.
 *
 * Ein Tag ohne Eintragung ist etwas anderes als ein Tag ohne Beschwerden.
 * Deshalb zwei getrennte Darstellungen: kein Balken, aber ein Grundstrich für
 * „nichts eingetragen", ein flacher Strich in Grün für „eingetragen, aber
 * beschwerdefrei". Wer das zusammenwirft, liest aus einer Lücke im Tagebuch
 * einen guten Tag heraus.
 */
import { fmtDatum } from './datum.js';

const TAFEL_HOCH = 100;
const TAFEL_MAX = 10;

/**
 * @param {{am: string, wert: number|null, notiert: boolean}[]} punkte
 * @param {{titel?: string, hinweis?: string}} opt
 */
export function verlaufTafel(punkte, opt = {}) {
  if (!punkte.length) return '';
  const n = punkte.length;
  const breite = 300;
  const spalte = breite / n;
  const balken = Math.max(1.5, Math.min(spalte * 0.62, 10));

  const stuecke = punkte.map((p, i) => {
    const x = i * spalte + (spalte - balken) / 2;
    if (!p.notiert) {
      return `<rect x="${x.toFixed(2)}" y="${TAFEL_HOCH - 1.5}" width="${balken.toFixed(2)}" height="1.5" `
        + `rx="0.75" fill="var(--line)"><title>${fmtDatum(p.am)}: nichts eingetragen</title></rect>`;
    }
    const wert = Math.max(0, Math.min(TAFEL_MAX, p.wert || 0));
    const h = Math.max(2, (wert / TAFEL_MAX) * TAFEL_HOCH);
    const farbe = wert === 0 ? 'var(--ok)' : (wert >= 7 ? 'var(--bad)' : (wert >= 4 ? 'var(--warn)' : 'var(--leicht)'));
    return `<rect x="${x.toFixed(2)}" y="${(TAFEL_HOCH - h).toFixed(2)}" width="${balken.toFixed(2)}" `
      + `height="${h.toFixed(2)}" rx="${(balken / 2.5).toFixed(2)}" fill="${farbe}">`
      + `<title>${fmtDatum(p.am)}: ${wert === 0 ? 'beschwerdefrei' : `Stärke ${wert}`}</title></rect>`;
  }).join('');

  // Hilfslinie bei 5 – ohne Bezugspunkt sagt die Höhe eines Balkens nichts.
  const mitte = `<line x1="0" y1="${TAFEL_HOCH / 2}" x2="${breite}" y2="${TAFEL_HOCH / 2}" `
    + 'stroke="var(--line)" stroke-width="0.6" stroke-dasharray="3 3"/>';

  return `<figure class="tafel">
    ${opt.titel ? `<figcaption class="tafel-titel">${opt.titel}</figcaption>` : ''}
    <svg viewBox="0 0 ${breite} ${TAFEL_HOCH}" preserveAspectRatio="none" role="img"
         aria-label="${opt.titel || 'Verlauf'}: Balken je Tag, Höhe ist die stärkste Beschwerde von 0 bis 10">
      ${mitte}${stuecke}
    </svg>
    <div class="tafel-fuss">
      <span>${fmtDatum(punkte[0].am)}</span>
      ${opt.hinweis ? `<span class="tafel-hinweis">${opt.hinweis}</span>` : ''}
      <span>${fmtDatum(punkte[n - 1].am)}</span>
    </div>
  </figure>`;
}

/**
 * Ein waagerechter Vergleichsbalken: mit Auslöser gegen ohne.
 *
 * Zwei Balken übereinander statt einer Differenzzahl, weil die Differenz allein
 * täuscht – „2 Punkte mehr" heißt bei einem Grundpegel von 1 etwas anderes als
 * bei einem von 7.
 */
export function vergleichBalken(mit, ohne) {
  const anteil = (v) => `${Math.max(1.5, Math.min(100, (v / TAFEL_MAX) * 100)).toFixed(1)}%`;
  return `<div class="vgl">
    <div class="vgl-zeile"><span class="vgl-mark">danach</span>
      <span class="vgl-spur"><i style="width:${anteil(mit)};background:var(--warn)"></i></span>
      <b>${mit.toFixed(1).replace('.', ',')}</b></div>
    <div class="vgl-zeile"><span class="vgl-mark">sonst</span>
      <span class="vgl-spur"><i style="width:${anteil(ohne)};background:var(--muted)"></i></span>
      <b>${ohne.toFixed(1).replace('.', ',')}</b></div>
  </div>`;
}
