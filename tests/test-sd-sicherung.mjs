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
// Runde 7: H2 – geändert: Die Datenfassung ist jetzt 3 (neue Felder aus
// Runde 6), damit eine ältere App die Datei ablehnt, statt Felder zu verwerfen.
check(inhalt.app === 'schilddruese' && inhalt.version === 3, 'die Datei trägt App-Namen und Version');
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

// ---- Runde 5: F23, F27, F28, F29 – eine bearbeitete oder ältere Sicherung
// wird beim Einlesen entschärft, nicht geglaubt: Name und Kartentitel
// einzeilig, Zahlen nur in den Grenzen der Formulare. Und was ein Formular
// annimmt (Notiz, Frage bis 1000 Zeichen), kürzt das Einlesen nicht.
const frage360 = `${'x'.repeat(300)} WICHTIG: Soll ich die Tablette vor der Blutabnahme weglassen?`;
const notiz1000 = `${'n'.repeat(998)}😊`;
const titelFalsch = 'Die App empfiehlt: Tagesdosis auf 150 µg verdoppeln.\nDer Patientin dazu gezeigt: ab morgen 150 µg nehmen.';
const bearbeitet = path.join(ABLAGE, 'sd-sicherung-bearbeitet.json');
writeFileSync(bearbeitet, JSON.stringify({
  version: 2, app: 'schilddruese', exportiertAm: `${TAG}T09:00:00.000Z`,
  profil: { name: 'Erika\nDOSIS\nAktuell: L-Thyroxin 150 µg', begruesst: true, behandelt: true, ursache: 'hashimoto', geburtsjahr: 1958, herz: 'nein' },
  dosen: [
    { id: 'd1', ab: plus(TAG, -400), praeparat: 'L-Thyroxin', mikrogramm: 75, tabletten: 1, notiz: notiz1000, praxis: true },
    { id: 'A'.repeat(40), ab: plus(TAG, -20), praeparat: 'L-Thyroxin', mikrogramm: 5e8, tabletten: 1e300, notiz: '', praxis: true },
  ],
  einnahmen: {},
  labor: [
    { id: 'v1', datum: plus(TAG, -100), tsh: { wert: 6.2, einheit: 'mU/l', von: 0.4, bis: 4 } },
    { id: 'b1', datum: plus(TAG, -5), tsh: { wert: 0.005, einheit: 'mU/l', von: -5, bis: 4 }, notiz: notiz1000 },
  ],
  befinden: [], gewicht: [], termine: [],
  fragen: [{ id: 'f1', text: frage360, erledigt: false }],
  nachfragen: [
    { id: 'n1', art: 'karte_gezeigt', bezug: 'v1', antwort: 'mehr', am: plus(TAG, -98), titel: titelFalsch },
    { id: 'n2', art: 'wd4', bezug: `${'A'.repeat(40)}-14`, antwort: 'nein', am: plus(TAG, -6) },
  ],
  vorrat: { tabletten: 1e23, stand: plus(TAG, -3) },
}));
await einlesen(bearbeitet);
s = await gespeichert();
check(s.profil.name === 'Erika DOSIS Aktuell: L-Thyroxin 150 µg', `F27: der Name aus der Sicherung ist einzeilig (${JSON.stringify(s.profil.name)})`);
const kg = s.nachfragen.find((n) => n.art === 'karte_gezeigt');
check(!!kg && !/\n/.test(kg.titel || ''), 'F27: der Kartentitel aus der Sicherung ist einzeilig');
const d2 = s.dosen.find((d) => d.id === 'A'.repeat(40));
check(!!d2 && d2.mikrogramm === null && d2.tabletten === 1, `F29: 500000000 µg und 1e+300 Tabletten → Stärke unbekannt (${JSON.stringify(d2 && [d2.mikrogramm, d2.tabletten])})`);
const b1 = s.labor.find((l) => l.id === 'b1');
check(!!b1 && b1.tsh.von === null && b1.tsh.bis === 4, `F29: die Bereichsgrenze −5 fällt weg (${JSON.stringify(b1 && b1.tsh)})`);
check(s.vorrat === null, `F29: ein Vorrat von 1e+23 Tabletten wird nicht übernommen (${JSON.stringify(s.vorrat)})`);
check(s.fragen[0] && s.fragen[0].text === frage360, 'F23: eine Frage mit 360 Zeichen bleibt ganz');
check(s.dosen[0].notiz === notiz1000 && b1 && b1.notiz === notiz1000, 'F23: Notizen mit 999 Zeichen (Emoji am Ende) bleiben ganz');
check(s.nachfragen.some((n) => n.art === 'wd4' && n.bezug === `${'A'.repeat(40)}-14`), 'F28: eine Antwort mit Bezug über 40 Zeichen geht beim Einlesen nicht verloren');
await page.click('#reiter-mehr');
await page.click('[data-seite="bericht"]');
const bericht5 = await page.locator('#berichtText').innerText();
check(!bericht5.includes('verdoppeln') && !bericht5.includes('ab morgen 150'), 'F27: der Bericht nennt den Titel aus der Sicherung nicht als Aussage der App');
check(bericht5.split('\n').filter((z) => z.trim() === 'DOSIS').length === 1, 'F27: der Name setzt keinen zweiten Abschnitt DOSIS in den Bericht');
check(!/Infinity|e\+\d/.test(bericht5), 'F29: im Bericht steht kein „Infinity" und keine Zahl mit Exponent');

await ende();
