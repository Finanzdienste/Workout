/*
 * badge.svg zu badge-96.png rendern – und icon-monochrome.svg zu seiner PNG.
 *
 * Warum ueberhaupt eine PNG-Datei: Chrome nimmt fuer den `badge` einer Meldung
 * zuverlaessig nur Rastergrafik; SVG wird je nach Fassung stillschweigend
 * verworfen, und dann steht wieder das Standardsymbol des Browsers da.
 *
 * Warum 96 Bildpunkte: Android zeigt den Badge mit etwa 24 dp. Auf einem Geraet
 * mit vierfacher Dichte sind das 96 echte Bildpunkte – groesser bringt nichts,
 * kleiner franst aus.
 *
 * Warum mit dem Browser und nicht mit einer Bibliothek: Der Browser ist der,
 * der die Datei nachher auch anzeigt. Ein zweiter Renderer waere eine zweite
 * Meinung darueber, wie die Datei aussieht.
 *
 *     node tools/badge-bauen.mjs
 */
import { chromium } from 'playwright';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const wurzel = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// Zwei Dateien, zwei Groessen, derselbe Weg:
//
//   badge-96.png             das kleine Symbol der Meldung selbst (`badge`)
//   icon-monochrome-512.png  der Rueckfall, wenn Android den `badge` nicht
//                            nimmt und stattdessen das App-Symbol als
//                            Schablone zeichnet - siehe icon-monochrome.svg
const AUFTRAEGE = [
  { quelle: 'badge.svg', ziel: 'badge-96.png', groesse: 96 },
  { quelle: 'icon-monochrome.svg', ziel: 'icon-monochrome-512.png', groesse: 512 },
];

const browser = await chromium.launch();
for (const { quelle, ziel, groesse } of AUFTRAEGE) {
  const svg = await readFile(path.join(wurzel, quelle), 'utf8');
  const page = await browser.newPage({
    viewport: { width: groesse, height: groesse },
    deviceScaleFactor: 1,
  });
  await page.setContent(
    `<style>html,body{margin:0;padding:0;background:transparent}
     svg{display:block;width:${groesse}px;height:${groesse}px}</style>${svg}`,
  );
  const bild = await page.screenshot({ omitBackground: true });
  await page.close();
  await writeFile(path.join(wurzel, ziel), bild);
  console.log(`${ziel} geschrieben, ${bild.length} Byte`);
}
await browser.close();
