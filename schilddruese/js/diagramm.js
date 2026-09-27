/*
 * Eine Verlaufslinie ohne Bibliothek – für Laborwerte und Gewicht.
 *
 * Bewusst schlicht: eine Linie, Punkte, der Referenzbereich des Labors als
 * heller Streifen dahinter, Beschriftung nur am ersten und letzten Datum.
 * Keine Farbe für „zu hoch" oder „zu niedrig": Ob ein Wert für diese
 * Nutzerin richtig ist, weiß nur ihre Ärztin. Der Streifen zeigt, was auf
 * dem Befund als Bereich des Labors steht – mehr Deutung steckt nicht darin.
 *
 * Liefert einen SVG-Text, weil die Ansichten aus Text zusammengesetzt werden.
 */
import { datumKurz, zahlText } from './datum.js';
import { esc } from './text.js';

const B = 320;   // Breite der Zeichenfläche (viewBox)
const H = 140;   // Höhe
// Links und unten Platz für Beschriftungen in lesbarer Größe (siehe
// .verlauf-achse: 15 Einheiten, auf 360 px gut 13 Pixel).
const RAND = { links: 50, rechts: 12, oben: 12, unten: 30 };

/**
 * @param {object} o
 * @param {Array}  o.punkte    [{ datum, wert }] – zeitlich aufsteigend, mindestens einer
 * @param {string} o.einheit
 * @param {Array}  [o.bereich] [von, bis] des Labors, falls bekannt
 * @param {string} o.titel     für die Beschriftung für Vorleseprogramme
 */
export function verlaufslinie({ punkte, einheit = '', bereich = null, titel = '' }) {
  if (!punkte.length) return '';
  const werte = punkte.map((p) => p.wert);
  const alle = bereich ? [...werte, ...bereich] : werte;
  let lo = Math.min(...alle);
  let hi = Math.max(...alle);
  if (hi === lo) { lo -= 1; hi += 1; }
  const luft = (hi - lo) * 0.12;
  lo -= luft;
  hi += luft;

  const breite = B - RAND.links - RAND.rechts;
  const hoehe = H - RAND.oben - RAND.unten;
  const x = (i) => RAND.links + (punkte.length === 1 ? breite / 2 : (i / (punkte.length - 1)) * breite);
  const y = (w) => RAND.oben + hoehe - ((w - lo) / (hi - lo)) * hoehe;
  const f = (n) => n.toFixed(1);

  const beschreibung = `${titel}: ${punkte.map((p) => `${datumKurz(p.datum)} ${zahlText(p.wert)} ${einheit}`).join(', ')}`;
  const teile = [`<svg viewBox="0 0 ${B} ${H}" class="verlauf-svg" role="img" aria-label="${esc(beschreibung)}">`];

  if (bereich) {
    const [von, bis] = bereich;
    teile.push(`<rect x="${RAND.links}" y="${f(y(bis))}" width="${breite}" height="${f(Math.max(1, y(von) - y(bis)))}" class="verlauf-bereich"/>`);
    [von, bis].forEach((g) => {
      teile.push(`<text x="${RAND.links - 6}" y="${f(y(g) + 4)}" class="verlauf-achse" text-anchor="end">${esc(zahlText(g))}</text>`);
    });
  }

  const d = punkte.map((p, i) => `${i ? 'L' : 'M'}${f(x(i))} ${f(y(p.wert))}`).join(' ');
  if (punkte.length > 1) teile.push(`<path d="${d}" class="verlauf-linie"/>`);
  punkte.forEach((p, i) => {
    teile.push(`<circle cx="${f(x(i))}" cy="${f(y(p.wert))}" r="4" class="verlauf-punkt"/>`);
  });

  teile.push(`<text x="${RAND.links}" y="${H - 8}" class="verlauf-achse">${esc(datumKurz(punkte[0].datum))}</text>`);
  if (punkte.length > 1) {
    teile.push(`<text x="${B - RAND.rechts}" y="${H - 8}" class="verlauf-achse" text-anchor="end">${esc(datumKurz(punkte[punkte.length - 1].datum))}</text>`);
  }
  teile.push('</svg>');
  return teile.join('');
}
