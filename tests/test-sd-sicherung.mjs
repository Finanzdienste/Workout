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
// Verglichen wird der Inhalt, nicht die Form: Beim ersten Speichern ergänzt
// die App neue Felder (Fassung 2), die im vorbelegten Stand noch fehlen.
const vergleich = (s) => JSON.stringify({
  d: s.dosen.map((x) => [x.ab, x.mikrogramm, x.tabletten]),
  e: s.einnahmen,
  l: s.labor.map((x) => [x.datum, x.tsh && x.tsh.wert, x.tsh && x.tsh.von, x.tsh && x.tsh.bis]),
  f: s.fragen.map((x) => [x.text, x.erledigt]),
  n: s.profil.name,
});
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
check(inhalt.app === 'schilddruese' && inhalt.version === 2, 'die Datei trägt App-Namen und Version');
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
writeFileSync(neuer, JSON.stringify({ ...inhalt, version: 99 }));

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
await page.evaluate((k) => localStorage.setItem(k, JSON.stringify({ version: 99, neu: 'nicht anfassen' })), SCHLUESSEL);
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

// ---- Runde 4: E28 – „dauerhaft" ist die Zusage des Browsers auf DIESEM Gerät.
check(!('dauerhaft' in inhalt), 'E28: die Sicherungsdatei enthält „dauerhaft" nicht');

// ---- Runde 4: E23 – dieselbe (ältere) Sicherung zweimal eingelesen: Beim
// zweiten Mal wurde die Rücklage durch den Stand nach dem ersten Einlesen
// ersetzt, und „zurückholen" brachte die Befunde und Einnahmen nicht wieder.
const mitDaten = standMit(plus(TAG, -60), {
  profil: { name: 'Mama', begruesst: true },
  einnahmen: Object.fromEntries(Array.from({ length: 30 }, (_, i) => [plus(TAG, -i - 1), { uhr: '07:00' }])),
  labor: [
    { id: 'l1', datum: plus(TAG, -50), tsh: { wert: 2.4, einheit: 'mU/l', von: 0.27, bis: 4.2 }, ft4: null, ft3: null, notiz: '' },
    { id: 'l2', datum: plus(TAG, -5), tsh: { wert: 0.08, einheit: 'mU/l', von: 0.27, bis: 4.2 }, ft4: null, ft3: null, notiz: '' },
  ],
});
await page.evaluate(({ k, st }) => { localStorage.setItem(k, JSON.stringify(st)); localStorage.removeItem(`${k}.vorImport`); }, { k: SCHLUESSEL, st: mitDaten });
await page.reload({ waitUntil: 'networkidle' });
const dauerhaftHier = Boolean((await gespeichert()).dauerhaft);
const aelter = path.join(ABLAGE, 'sd-sicherung-aelter.json');
writeFileSync(aelter, JSON.stringify({
  version: 2, app: 'schilddruese', exportiertAm: '2026-03-01T10:00:00.000Z', profil: { name: 'Mama', begruesst: true },
  dosen: [{ id: 'd1', ab: plus(TAG, -60), praeparat: 'L-Thyroxin', mikrogramm: 75, tabletten: 1, notiz: '' }],
  einnahmen: {}, labor: [], befinden: [], gewicht: [], termine: [], fragen: [], dauerhaft: !dauerhaftHier,
}));
const einlesen = async (datei2) => {
  await page.click('#reiter-mehr');
  await page.click('[data-seite="sicherung"]');
  const n = dialoge.length;
  await page.setInputFiles('#sicherungDatei', datei2);
  await page.waitForTimeout(300);
  return `${dialoge.slice(n).join(' | ')} | ${await page.locator('body').innerText()}`;
};
await einlesen(aelter);
s = await gespeichert();
check(s.labor.length === 0 && Object.keys(s.einnahmen).length === 0, 'E23: das erste Einlesen ersetzt den Stand (0 Befunde, 0 Einnahmen)');
check(Boolean(s.dauerhaft) === dauerhaftHier, `E28: nach dem Einlesen gilt die Zusage dieses Geräts (${dauerhaftHier}), nicht die der Datei`);
await page.click('#reiter-mehr');
await page.click('[data-seite="sicherung"]');
const hinweisDauerhaft = await ansichtText(page);
check(dauerhaftHier ? hinweisDauerhaft.includes('hat zugesagt') : hinweisDauerhaft.includes('Zum Startbildschirm hinzufügen'), 'E28: die Seite „Sicherung" sagt, was für dieses Gerät gilt');
const zweites = await einlesen(aelter);
check(zweites.includes('schon eingelesen'), 'E23: das zweite Einlesen derselben Datei meldet „schon eingelesen"');
s = await gespeichert();
check(s.labor.length === 0, '… und ändert nichts');
await page.click('#reiter-mehr');
await page.click('[data-seite="sicherung"]');
await page.click('[data-act="sicherung-zurueck"]');
s = await gespeichert();
check(s.labor.length === 2 && Object.keys(s.einnahmen).length === 30, `E23: „zurückholen" bringt die 2 Befunde und 30 Einnahmen wieder (${s.labor.length} / ${Object.keys(s.einnahmen).length})`);

await ende();
