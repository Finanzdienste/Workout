/*
 * Erzeugt die PNG-Symbole aus icon.svg.
 *
 *     node tools/build-icons.mjs
 *
 * Warum überhaupt PNGs, wo doch ein SVG da ist: Android-Launcher nehmen für
 * Verknüpfungen auf dem Startbildschirm nicht jedes Format. Chrome kommt mit
 * SVG zurecht, Firefox nicht – dort erscheint statt des Symbols ein erzeugter
 * Buchstabe. Mit PNG in den üblichen Größen funktioniert es überall.
 *
 * Das maskierbare Symbol ist eine eigene Fassung: Android schneidet daraus
 * einen Kreis oder ein Quadrat mit runden Ecken, je nach Gerät. Deshalb reicht
 * der Hintergrund dort bis an den Rand und das Buch sitzt kleiner in der
 * Mitte, damit es den Schnitt überlebt.
 *
 * Gebraucht wird das nur, wenn sich icon.svg ändert – die erzeugten Dateien
 * liegen im Repository. Playwright wird zum Rastern benutzt und ist bewusst
 * keine Abhängigkeit der App selbst.
 */
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const svg = readFileSync(join(ROOT, 'icon.svg'), 'utf8');

/** Maskierbare Fassung: randlos und mit Luft um das Buch. */
function maskierbar(quelle) {
  const flach = quelle.replaceAll('rx="112"', 'rx="0"');
  if (flach === quelle) throw new Error('Ecken nicht gefunden – icon.svg geändert?');
  const marke = '<g id="marke"';
  if (!flach.includes(marke)) throw new Error('Gruppe "marke" nicht gefunden');
  return flach.replace(marke,
    '<g id="marke" transform="translate(256 256) scale(0.74) translate(-256 -256)"');
}

const browser = await chromium.launch();
const page = await browser.newPage();

async function raster(quelle, groesse, datei) {
  await page.setViewportSize({ width: groesse, height: groesse });
  await page.setContent(
    `<style>html,body{margin:0;padding:0;background:transparent}svg{display:block;width:${groesse}px;height:${groesse}px}</style>${quelle}`,
    { waitUntil: 'load' },
  );
  const png = await page.locator('svg').screenshot({ omitBackground: true });
  writeFileSync(join(ROOT, datei), png);
  console.log(`${datei}: ${groesse}×${groesse}, ${(png.length / 1024).toFixed(1)} KB`);
}

await raster(svg, 192, 'icon-192.png');
await raster(svg, 512, 'icon-512.png');
await raster(maskierbar(svg), 512, 'icon-maskable-512.png');

await browser.close();
