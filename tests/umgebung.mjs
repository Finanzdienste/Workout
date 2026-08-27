/*
 * Wo die Tests hinschauen.
 *
 * Vorher stand in jeder Datei ein fester Pfad – der Rechner, auf dem sie
 * entstanden sind. Hier steht er einmal, und jede Angabe lässt sich per
 * Umgebungsvariable überschreiben. Das ist der Unterschied zwischen einem
 * Skript und einem Test, der auch anderswo läuft.
 */
import { fileURLToPath, pathToFileURL } from 'node:url';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

/** Wurzel des Projekts – zwei Ebenen über dieser Datei. */
export const ROOT = process.env.WORKOUT_ROOT
  || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Die App über einen Webserver. Ohne den gibt es keine Module und keinen Worker. */
export const URL = process.env.WORKOUT_URL || 'http://127.0.0.1:8099/index.html';

/**
 * Zweiter Server für den Aktualisierungstest. Er muss dieselben Dateien mit
 * einer Haltbarkeit ausliefern, wie GitHub Pages es tut – sonst prüft der Test
 * nicht das, woran es in der Praxis gescheitert ist.
 */
export const UPDATE_URL = process.env.WORKOUT_URL_CACHE || 'http://127.0.0.1:8100/index.html';

/** Die Ein-Datei-Fassung, direkt vom Dateisystem. */
export const EINZEL = process.env.WORKOUT_EINZEL
  || pathToFileURL(path.join(ROOT, 'dist', 'workout.html')).href;

/** Wohin Bildschirmfotos und Browserprofile gehen. */
export const ABLAGE = process.env.WORKOUT_ABLAGE || path.join(ROOT, '.testlauf');
mkdirSync(ABLAGE, { recursive: true });
export const SHOT = ABLAGE;

/** Ein eigenes, frisches Browserprofil je Test. */
export function profil(name) {
  const p = path.join(ABLAGE, `profil-${name}`);
  mkdirSync(p, { recursive: true });
  return p;
}
