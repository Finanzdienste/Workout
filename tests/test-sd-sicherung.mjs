/*
 * Schilddrüse: Sicherung speichern, alles löschen, Sicherung einlesen.
 *
 * Die Daten liegen nur auf dem Handy. Die Sicherungsdatei ist deshalb der
 * einzige Weg über einen Handywechsel – und genau dieser Weg wird hier
 * einmal ganz gegangen: speichern, löschen, auf der Willkommensseite (wie auf
 * einem neuen Handy) wieder einlesen. Dazu, was nie passieren darf: eine
 * fremde oder neuere Datei überschreibt den Stand, oder ein Stand aus einer
 * neueren Fassung wird beim Speichern überschrieben.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { oeffne, standMit, plus, ansichtText, SCHLUESSEL } from './sd-hilfe.mjs';
import { ABLAGE } from './umgebung.mjs';

const TAG = '2026-03-10';
const stand = standMit(plus(TAG, -40), {
  profil: { name: 'Mama', begruesst: true },
  einnahmen: { [plus(TAG, -2)]: { uhr: '07:00' }, [plus(TAG, -1)]: null },
  labor: [{ id: 'l1', datum: plus(TAG, -5), tsh: { wert: 2.4, einheit: 'mU/l', von: 0.27, bis: 4.2 }, ft4: null, ft3: null, notiz: '' }],
  fragen: [{ id: 'f1', text: 'Wie lange noch diese Dosis?', erledigt: false }],
});

const { page, check, dialoge, gespeichert, ende } = await oeffne({ tag: TAG, stand });
const vergleich = (s) => JSON.stringify({ d: s.dosen, e: s.einnahmen, l: s.labor, f: s.fragen, n: s.profil.name });
const vorher = await gespeichert();

// Speichern.
await page.click('#reiter-mehr');
await page.click('[data-seite="sicherung"]');
check((await ansichtText(page)).includes('Noch keine Sicherung'), 'vor der ersten Sicherung steht das auch so da');
const [download] = await Promise.all([page.waitForEvent('download'), page.click('[data-act="sicherung-speichern"]')]);
check(download.suggestedFilename() === `schilddruese-sicherung-${TAG}.json`, `Dateiname mit Datum (${download.suggestedFilename()})`);
const datei = path.join(ABLAGE, 'sd-sicherung.json');
await download.saveAs(datei);
const inhalt = JSON.parse(readFileSync(datei, 'utf8'));
check(inhalt.app === 'schilddruese' && inhalt.version === 1, 'die Datei trägt App-Namen und Version');
check(vergleich(inhalt) === vergleich(vorher), 'die Datei enthält Dosis, Einnahmen, Laborwerte und Fragen');
let s = await gespeichert();
check(s.letzteSicherung === TAG, 'das Datum der letzten Sicherung wird gemerkt');
await page.click('#reiter-mehr');
check((await ansichtText(page)).includes('Zuletzt heute'), 'unter „Mehr" steht „Zuletzt heute"');

// Alles löschen – zweimal gefragt.
await page.click('[data-seite="ueber"]');
await page.click('[data-act="alles-loeschen"]');
check(dialoge.filter((t) => /löschen/i.test(t)).length === 2, 'Alles löschen fragt zweimal nach');
check(await page.locator('.willkommen-titel').isVisible(), 'danach steht die Willkommensseite da – wie auf einem neuen Handy');
check(await page.evaluate((k) => localStorage.getItem(k), SCHLUESSEL) === null, 'der Speicher ist leer');

// Auf der Willkommensseite einlesen.
await page.setInputFiles('#sicherungDatei', datei);
await page.waitForTimeout(300);
check(await page.locator('.tablette').isVisible(), 'nach dem Einlesen geht es direkt zu „Heute"');
s = await gespeichert();
check(vergleich(s) === vergleich(vorher), 'eingelesen ist genau der gesicherte Stand');

// Fremde, kaputte und neuere Dateien.
const fremd = path.join(ABLAGE, 'sd-fremd.json');
writeFileSync(fremd, JSON.stringify({ mode: 'db', log: {}, rounds: [] }));
const kaputt = path.join(ABLAGE, 'sd-kaputt.json');
writeFileSync(kaputt, '{ das ist kein JSON');
const neuer = path.join(ABLAGE, 'sd-neuer.json');
writeFileSync(neuer, JSON.stringify({ ...inhalt, version: 2 }));

await page.click('#reiter-mehr');
await page.click('[data-seite="sicherung"]');
for (const [f, erwartet, was] of [[fremd, 'keine Sicherung', 'die Sicherung der Workout-App'], [kaputt, 'keine Sicherung', 'eine kaputte Datei'], [neuer, 'neueren Fassung', 'eine Sicherung aus einer neueren Fassung']]) {
  const n = dialoge.length;
  await page.setInputFiles('#sicherungDatei', f);
  await page.waitForTimeout(300);
  check(dialoge.slice(n).some((t) => t.includes(erwartet)), `${was} wird abgelehnt („${erwartet}")`);
  s = await gespeichert();
  check(vergleich(s) === vergleich(vorher), `… und der Stand bleibt unverändert`);
}

// Einlesen über einen bestehenden Stand lässt sich zurückholen.
await page.click('#reiter-heute');
await page.click('[data-act="tablette"]');
const mitHaken = await gespeichert();
await page.click('#reiter-mehr');
await page.click('[data-seite="sicherung"]');
await page.setInputFiles('#sicherungDatei', datei);
await page.waitForTimeout(300);
s = await gespeichert();
check(!(TAG in s.einnahmen), 'die Sicherung ersetzt den Stand (der heutige Haken ist weg)');
await page.click('#reiter-mehr');
await page.click('[data-seite="sicherung"]');
await page.click('[data-act="sicherung-zurueck"]');
s = await gespeichert();
check(vergleich(s) === vergleich(mitHaken), '„Stand vor dem Einlesen zurückholen" bringt den heutigen Haken wieder');

// Ein Stand aus einer neueren Fassung im Speicher: wird nie überschrieben.
await page.evaluate((k) => localStorage.setItem(k, JSON.stringify({ version: 2, neu: 'nicht anfassen' })), SCHLUESSEL);
await page.reload({ waitUntil: 'networkidle' });
check((await ansichtText(page)).includes('neueren Fassung'), 'Daten aus einer neueren Fassung: die App warnt');
const knopf = page.locator('[data-act="willkommen-weiter"], [data-act="tablette"]').first();
await knopf.click();
await page.waitForTimeout(400);
const roh = await page.evaluate((k) => localStorage.getItem(k), SCHLUESSEL);
check(roh.includes('nicht anfassen'), '… und überschreibt sie auch beim nächsten Tippen nicht');

// Kaputter Speicher: die App startet trotzdem.
await page.evaluate((k) => localStorage.setItem(k, '{kaputt'), SCHLUESSEL);
await page.reload({ waitUntil: 'networkidle' });
check(await page.locator('.willkommen-titel').isVisible(), 'kaputter Speicherinhalt: die App startet mit der Willkommensseite');

await ende();
