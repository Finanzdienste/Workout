/*
 * Erzeugt die PNG-Symbole der Schilddrüsen-App aus schilddruese/icon.svg.
 *
 *     node tools/schilddruese-icons.mjs
 *
 * Dasselbe Verfahren wie tools/build-icons.mjs für die Workout-App, mit
 * denselben Gründen: Android-Launcher nehmen nicht jedes Format, und das
 * maskierbare Symbol braucht einen Hintergrund bis an den Rand mit Luft um
 * das Motiv, weil das Gerät einen Kreis oder ein rundes Quadrat ausschneidet.
 */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ORDNER = join(dirname(fileURLToPath(import.meta.url)), '..', 'schilddruese');
const svg = readFileSync(join(ORDNER, 'icon.svg'), 'utf8');

/** Maskierbare Fassung: randlos, Motiv kleiner in der Mitte. */
function maskierbar(quelle) {
  const flach = quelle.replaceAll('rx="112"', 'rx="0"');
  if (flach === quelle) throw new Error('Ecken nicht gefunden – icon.svg geändert?');
  const marke = '<g fill="#ffffff">';
  if (!flach.includes(marke)) throw new Error('Motiv-Gruppe nicht gefunden');
  // Drüse und Haken gemeinsam verkleinern: eine Gruppe um beides.
  const anfang = flach.indexOf(marke);
  const ende = flach.lastIndexOf('</svg>');
  return `${flach.slice(0, anfang)}<g transform="translate(256 256) scale(0.76) translate(-256 -256)">${flach.slice(anfang, ende)}</g></svg>\n`;
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
  writeFileSync(join(ORDNER, datei), png);
  console.log(`schilddruese/${datei}: ${groesse}×${groesse}, ${(png.length / 1024).toFixed(1)} KB`);
}

await raster(svg, 192, 'icon-192.png');
await raster(svg, 512, 'icon-512.png');
await raster(maskierbar(svg), 512, 'icon-maskable-512.png');

await browser.close();
