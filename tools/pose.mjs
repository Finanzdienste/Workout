/*
 * Eine Stellung nachrechnen, statt sie am Bild zu erraten.
 *
 * Die Figuren in js/figure.js stehen als Gelenkwinkel da. Ob eine Stellung die
 * Übung trifft, sieht man am fertigen Bild – aber erst, nachdem man sie gebaut
 * hat, und dann sieht man nur „irgendwie schief". Dieses Skript rechnet die
 * Winkel in Punkte um und schreibt hin, was daran zählt: Wie hoch liegen die
 * Schultern über den Füßen, wie hoch die Hüfte, stehen die Schienbeine
 * senkrecht, bleiben die Füße stehen.
 *
 *     node tools/pose.mjs thrust
 *     node tools/pose.mjs            (alle liegenden Muster)
 *
 * Alle Maße in Körperlängen über dem Boden, mit genau den Punkten, die
 * js/figure.js auch zeichnet.
 */
import { pathToFileURL } from 'node:url';
import { PATTERNS, RIG, skelett } from '../js/figure.js';

/*
 * Das Skelett kommt aus js/figure.js selbst, nicht aus einer Nachrechnung.
 *
 * Hier stand früher eine zweite Fassung der Mischung und des Aufsetzens auf
 * den Boden, mit dem Hinweis, beide müssten übereinstimmen. Sie taten es nicht:
 * Die Zeichnung hielt weder die Hände beim Liegestütz noch die Füße beim
 * Stehen fest, und diese Rechnung wusste davon ebenso wenig. Seit figure.js
 * die Kontaktpunkte selbst hält (skelett), gibt es nur noch eine Rechnung.
 */
export { skelett };

const BODEN = -0.62;
const mitte = (a, b) => [0, 1, 2].map((i) => (a[i] + b[i]) / 2);
const z2 = (n) => n.toFixed(3).padStart(7);

export function masse(spec, t) {
  const j = skelett(spec, t);
  const sch = mitte(j.shoulderL, j.shoulderR);
  const kn = mitte(j.kneeL, j.kneeR);
  const an = mitte(j.ankleL, j.ankleR);
  const ze = mitte(j.toeL, j.toeR);
  // Winkel des Schienbeins gegen die Senkrechte: 0 = senkrecht.
  const schien = Math.abs(Math.atan2(kn[0] - an[0], kn[1] - an[1]) * 180 / Math.PI);
  // Wie gerade ist die Linie Schulter–Hüfte–Knie? Abstand der Hüfte von der
  // Verbindung Schulter–Knie; 0 = eine Linie.
  const v = [kn[0] - sch[0], kn[1] - sch[1]];
  const w = [j.hipC[0] - sch[0], j.hipC[1] - sch[1]];
  const len = Math.hypot(v[0], v[1]) || 1;
  const knick = Math.abs(v[0] * w[1] - v[1] * w[0]) / len;
  return {
    schulterH: sch[1] - BODEN, hueftH: j.hipC[1] - BODEN, knieH: kn[1] - BODEN,
    fussH: Math.min(an[1], ze[1]) - BODEN,
    schulterX: sch[0], hueftX: j.hipC[0], knieX: kn[0], fussX: an[0],
    kopfH: j.head[1] - BODEN, schien, knick,
  };
}

// Der Bericht nur, wenn dieses Skript selbst aufgerufen wurde: masse() und
// skelett() werden auch importiert (tests/test-figur.mjs), und dort hat eine
// Tabelle auf der Konsole nichts zu suchen.
const direkt = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
const namen = process.argv.slice(2);
const liste = direkt
  ? (namen.length ? namen : Object.keys(PATTERNS).filter((k) => PATTERNS[k].lie))
  : [];

liste.forEach((name) => {
  const spec = PATTERNS[name];
  if (!spec) { console.log(`— ${name}: kein solches Muster`); return; }
  console.log(`\n${name}  (${spec.label})`);
  console.log('        Schulter    Hüfte     Knie      Fuß   |  Schiene  Knick');
  [0, 0.5, 1].forEach((t) => {
    const m = masse(spec, t);
    console.log(`  t=${t}  h${z2(m.schulterH)} h${z2(m.hueftH)} h${z2(m.knieH)} h${z2(m.fussH)} `
      + `| ${m.schien.toFixed(1).padStart(6)}° ${m.knick.toFixed(3).padStart(6)}`);
    console.log(`        x${z2(m.schulterX)} x${z2(m.hueftX)} x${z2(m.knieX)} x${z2(m.fussX)}`);
  });
});
if (direkt) {
  console.log(`\nKörpermaße: Oberschenkel ${RIG.thigh}, Schienbein ${RIG.shin}, `
    + `Schulterhöhe ${RIG.shoulderY}`);
}
