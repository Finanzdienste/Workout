/*
 * badge.svg zu badge-96.png rendern.
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
const svg = await readFile(path.join(wurzel, 'badge.svg'), 'utf8');
const GROESSE = 96;

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: GROESSE, height: GROESSE },
  deviceScaleFactor: 1,
});
await page.setContent(
  `<style>html,body{margin:0;padding:0;background:transparent}
   svg{display:block;width:${GROESSE}px;height:${GROESSE}px}</style>${svg}`,
);
const bild = await page.screenshot({ omitBackground: true });
await browser.close();

await writeFile(path.join(wurzel, 'badge-96.png'), bild);
console.log(`badge-96.png geschrieben, ${bild.length} Byte`);
