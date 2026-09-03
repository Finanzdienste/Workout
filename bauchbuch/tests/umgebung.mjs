/*
 * Wo die Tests hinschauen.
 *
 * Einmal hier statt eines festen Pfades in jeder Datei, und jede Angabe lässt
 * sich per Umgebungsvariable überschreiben. Das ist der Unterschied zwischen
 * einem Skript und einem Test, der auch anderswo läuft.
 */
import { fileURLToPath, pathToFileURL } from 'node:url';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

/** Wurzel des Projekts – zwei Ebenen über dieser Datei. */
export const ROOT = process.env.BAUCHBUCH_ROOT
  || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Die App über einen Webserver. Ohne den gibt es keine Module und keinen Worker. */
export const URL = process.env.BAUCHBUCH_URL || 'http://127.0.0.1:8199/index.html';

/**
 * Zweiter Server für den Aktualisierungstest. Er liefert dieselben Dateien mit
 * einer Haltbarkeit aus, wie GitHub Pages es tut – sonst prüft der Test nicht,
 * was in der Praxis schiefgeht.
 */
export const CACHE_URL = process.env.BAUCHBUCH_URL_CACHE || 'http://127.0.0.1:8200/index.html';

/** Die Ein-Datei-Fassung, direkt vom Dateisystem. */
export const EINZEL = process.env.BAUCHBUCH_EINZEL
  || pathToFileURL(path.join(ROOT, 'dist', 'bauchbuch.html')).href;

/** Wohin Bildschirmfotos und Browserprofile gehen. */
export const ABLAGE = process.env.BAUCHBUCH_ABLAGE || path.join(ROOT, '.testlauf');
mkdirSync(ABLAGE, { recursive: true });
export const SHOT = ABLAGE;

/** Ein eigenes, frisches Browserprofil je Test. */
export function profil(name) {
  const p = path.join(ABLAGE, `profil-${name}`);
  mkdirSync(p, { recursive: true });
  return p;
}

/** Der Schlüssel, unter dem die App im localStorage liegt. */
export const KEY = 'bauchbuch.state.v1';

/** Handyformat – dafür ist die App gebaut. */
export const HANDY = { width: 414, height: 896 };

/**
 * Ein Datum, `n` Tage vor heute.
 *
 * Nötig für alles, was die App auf „heute" bezieht: Verlauf, Bericht,
 * beschwerdefreie Serie. Ein fest eingetragenes Datum wäre in zwei Wochen
 * außerhalb jedes Zeitraums, und der Test würde grün bleiben, obwohl er nichts
 * mehr prüft.
 */
export function vorTagen(n) {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - n);
  const p = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/**
 * Die immer gleiche Vorrede: Prüfungen zählen und den Rückgabewert setzen.
 * tests/lauf.mjs zählt die Zeilen mit, deshalb ist das Format festgelegt.
 */
export function pruefer() {
  const stand = { fails: 0 };
  const check = (bedingung, text) => {
    console.log(`${bedingung ? 'OK  ' : 'FAIL'} ${text}`);
    if (!bedingung) { stand.fails += 1; process.exitCode = 1; }
  };
  const ende = () => console.log(`\n${stand.fails ? `${stand.fails} FEHLER` : 'alle Prüfungen bestanden'}`);
  return { check, ende, stand };
}
