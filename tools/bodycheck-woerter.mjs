/*
 * Schreibt apps/js/bodycheck-woerter.js: die Namen zu den Kennungen im
 * Tagebuch von Body Check (Beschwerden, Zutaten, Stuhlformen, Tagesfragen …),
 * damit „Meine Apps“ „Brennen“ zeigt statt „brennen“.
 *
 *     node tools/bodycheck-woerter.mjs <Pfad zu einem Klon von Finanzdienste/Bauchbuch>
 *
 * Gelesen wird aus den Modulen von Body Check selbst, nicht abgeschrieben.
 * Kommt dort eine Kennung dazu, zeigt die Übersicht sie bis zum nächsten Lauf
 * so, wie sie ist – nichts geht verloren.
 */
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const quelle = process.argv[2];
if (!quelle) {
  console.error('Pfad zu Bauchbuch fehlt.');
  process.exit(2);
}
const lade = (f) => import(pathToFileURL(path.resolve(quelle, 'js', f)).href);
const [d, k, b, a, dt] = await Promise.all(['daten.js', 'kopf.js', 'bild.js', 'aktivitaet.js', 'datum.js'].map(lade));
const namen = (liste, feld = 'name') => Object.fromEntries(liste.map((x) => [String(x.id), x[feld]]));

const woerter = {
  zutat: namen([...d.AUSLOESER, ...d.UMSTAENDE]),
  beschwerde: namen(d.BESCHWERDEN),
  bristol: namen(d.BRISTOL, 'kurz'),
  stuhlbezug: namen(d.STUHLBEZUG),
  rolle: namen(d.ROLLEN, 'kurz'),
  portion: namen(d.PORTIONEN),
  kopfArt: namen(k.KOPF_ARTEN),
  kopfDauer: namen(k.KOPF_DAUER),
  kopfVerlauf: namen(k.KOPF_VERLAUF),
  mittelWirkung: namen(k.MITTEL_WIRKUNG),
  warnzeichen: namen(b.WARNZEICHEN),
  aktivitaet: namen(a.AKTIVITAETEN),
  intensitaet: namen(a.INTENSITAETEN),
  tageszeit: dt.TAGESZEIT_NAME,
  fragen: d.TAGESFRAGEN.map((f) => ({ id: f.id, name: f.name, worte: f.worte })),
};

const ziel = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'apps', 'js', 'bodycheck-woerter.js');
writeFileSync(ziel, `/*
 * Erzeugt von tools/bodycheck-woerter.mjs aus Finanzdienste/Bauchbuch (js/daten.js,
 * js/kopf.js, js/bild.js, js/aktivitaet.js, js/datum.js) – nicht von Hand ändern.
 */
export const WOERTER = ${JSON.stringify(woerter, null, 2)};
`);
console.log(`apps/js/bodycheck-woerter.js: ${Object.entries(woerter).map(([n, v]) => `${n} ${Array.isArray(v) ? v.length : Object.keys(v).length}`).join(', ')}`);
