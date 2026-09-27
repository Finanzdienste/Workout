/*
 * Schilddrüse: Bedienung und Datensicherheit – Befunde aus der Durchsicht.
 *
 * Fünf Prüfer haben die App vor dem ersten Mergen durchgesehen, jeder Befund
 * wurde von einem zweiten gegengeprüft. Was dabei bestätigt wurde und sich
 * in der Oberfläche zeigt, steht hier – damit es nicht wiederkommt:
 *
 *   - „Zurück", „Abbrechen", „Löschen" führen dorthin, woher man kam;
 *   - der Fokus landet nach einem Tipp nicht im Nichts;
 *   - Löschen fragt immer nach;
 *   - „Einnahme nachtragen" zeigt nach einem Datumswechsel den Stand dieses Tages;
 *   - ein zweites offenes Fenster überschreibt keine neueren Einträge;
 *   - „Stand vor dem Einlesen zurückholen" fragt nach und steht nicht ewig da;
 *   - eine Sicherung mit kaputten Einträgen legt die App nicht lahm;
 *   - das Einnahme-Raster: groß genug, und die Bedeutung nicht nur in Farbe.
 */
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { oeffne, standMit, plus, kurz, ansichtText, SCHLUESSEL } from './sd-hilfe.mjs';
import { ABLAGE } from './umgebung.mjs';

const TAG = '2026-03-10';
const stand = standMit(plus(TAG, -40), {
  profil: { name: '', begruesst: true, seit: plus(TAG, -40) },
  einnahmen: { [plus(TAG, -3)]: { uhr: '06:41' }, [plus(TAG, -2)]: null },
  labor: [
    { id: 'l1', datum: plus(TAG, -30), tsh: { wert: 3.1, einheit: 'mU/l', von: 0.4, bis: 4 }, ft4: null, ft3: null, notiz: '' },
    { id: 'l2', datum: plus(TAG, -5), tsh: { wert: 2.2, einheit: 'mU/l', von: 0.4, bis: 4 }, ft4: null, ft3: null, notiz: '' },
  ],
  fragen: [{ id: 'f1', text: 'Kann ich die Tablette abends nehmen?', erledigt: false }],
});
const { page, ctx, check, dialog, dialoge, gespeichert, uhr, ende } = await oeffne({ viewport: { width: 360, height: 740 }, tag: TAG, zeit: '09:00', stand });
const titel = () => page.locator('.kopf-titel').innerText().catch(() => '');

// --- Zurück dorthin, woher man kam
await page.click('#reiter-verlauf');
await page.click('[data-seite="labor-liste"]');
await page.locator('[data-seite="labor"][data-param="l1"]').click();
check(await titel() === 'Laborwert ändern', 'aus der Liste in einen Befund');
check((await page.getAttribute('.kopf-zurueck', 'aria-label')) === 'Zurück zu Alle Laborwerte', '„Zurück" sagt, wohin es geht');
await page.click('[data-act="zurueck"]:not(.kopf-zurueck)');
check(await titel() === 'Alle Laborwerte', '„Abbrechen" führt zurück in die Liste, nicht zum Reiter');
check(await page.evaluate(() => document.activeElement?.id) === 'ansicht', 'nach „Zurück" liegt der Fokus auf der Ansicht, nicht im Nichts');
check((await page.getAttribute('#ansicht', 'aria-labelledby')) === 'seitentitel', 'die Ansicht heißt für Vorleseprogramme wie die Seite');
await page.locator('[data-seite="labor"][data-param="l1"]').click();
await page.click('[data-act="loeschen"]');
check(await titel() === 'Alle Laborwerte', 'nach dem Löschen eines Befunds wieder in der Liste');
await page.locator('[data-seite="labor"][data-param="l2"]').click();
await page.fill('input[name=tsh_wert]', '2,3');
await page.click('button[type=submit]');
check(await titel() === 'Alle Laborwerte', 'nach dem Speichern wieder in der Liste – ohne das Formular im Rücken');
await page.click('.kopf-zurueck');
check(!(await page.locator('.kopf-titel').count()) && (await page.getAttribute('#reiter-verlauf', 'aria-selected')) === 'true', 'noch einmal „Zurück": der Reiter Verlauf');

// --- Fokus bleibt auf dem getippten Knopf
await page.click('#reiter-heute');
await page.click('[data-act="befinden"][data-stufe="gut"]');
check(await page.evaluate(() => document.activeElement?.dataset?.stufe) === 'gut', 'nach „Gut" liegt der Fokus wieder auf „Gut"');

// --- Gestern nicht genommen: dauerhaft „nicht doppelt"
await uhr(plus(TAG, -1), '09:00');
await page.click('#reiter-heute');
check((await ansichtText(page)).includes('nicht doppelt'), 'gestern nicht genommen, heute noch nichts: „nicht doppelt" steht dauerhaft da');
await uhr(TAG, '09:00');
await page.click('#reiter-heute');

// --- Löschen einer Frage fragt nach
await page.click('#reiter-mehr');
await page.click('[data-seite="fragen"]');
dialog.antwort = false;
await page.click('[data-act="frage-loeschen"]');
check(dialoge.some((t) => t.includes('Frage wirklich löschen')), 'Frage löschen fragt nach');
check((await gespeichert()).fragen.length === 1, 'abgebrochen: die Frage bleibt');
dialog.antwort = true;

// --- Einnahme nachtragen: Datum wechseln zeigt den Stand des neuen Tages
await page.click('#reiter-verlauf');
await page.click('button.knopf[data-seite="einnahme"]');
check(await page.inputValue('input[name=datum]') === plus(TAG, -1), 'nachtragen beginnt bei gestern');
await page.fill('input[name=datum]', plus(TAG, -3));
await page.locator('input[name=datum]').dispatchEvent('change');
await page.waitForTimeout(100);
check(await page.isChecked('input[name=status][value=genommen]'), 'nach dem Wechsel auf einen Tag mit Haken ist „genommen" gewählt');
check(await page.inputValue('input[name=uhr]') === '06:41', '… samt Uhrzeit dieses Tages');
await page.click('button[type=submit]');
check((await gespeichert()).einnahmen[plus(TAG, -3)]?.uhr === '06:41', 'Speichern ohne Änderung lässt den Haken stehen');

// --- Das Raster: groß genug, Zeichen statt nur Farbe
await page.click('#reiter-verlauf');
const zellen = await page.$$eval('.tage .tag', (els) => els.map((e) => ({ z: e.querySelector('.tag-zeichen')?.textContent, h: e.getBoundingClientRect().height, w: e.getBoundingClientRect().width, k: e.className })));
check(zellen.length === 28, `28 Tage im Raster (${zellen.length})`);
check(zellen.every((z) => z.h >= 44), `jedes Feld mindestens 44 px hoch (kleinstes ${Math.min(...zellen.map((z) => Math.round(z.h)))} px)`);
check(zellen.every((z) => z.w >= 30), `und mindestens 30 px breit (${Math.min(...zellen.map((z) => Math.round(z.w)))} px)`);
check(zellen.find((z) => z.k.includes('ja'))?.z === '✓' && zellen.find((z) => z.k.includes('nein'))?.z === '✗' && zellen.find((z) => z.k.includes('offen'))?.z === '?', 'genommen ✓, nicht genommen ✗, kein Eintrag ? – nicht nur Farbe');
check(await page.locator('.tage .tag-kopf').count() === 7, 'darüber die Wochentage, Montag zuerst');

// --- Zweites Fenster: keine verlorenen Einträge
const zwei = await ctx.newPage();
await zwei.goto(page.url(), { waitUntil: 'networkidle' });
await zwei.click('#reiter-heute');
await zwei.click('[data-act="tablette"]');
await zwei.waitForTimeout(300);
await page.click('#reiter-heute');
check(await page.locator('.tablette.genommen').count() === 1, 'der Haken aus dem zweiten Fenster erscheint im ersten');
await page.click('[data-act="befinden"][data-stufe="mittel"]');
const s = await gespeichert();
check(s.einnahmen[TAG] && s.befinden.some((b) => b.datum === TAG && b.stufe === 'mittel'), 'ein Tipp im ersten Fenster überschreibt den Haken aus dem zweiten nicht');
await zwei.close();

// --- Import-Rücklage: fragt nach, und nur ein paar Tage
const datei = path.join(ABLAGE, 'sd-bedienung.json');
writeFileSync(datei, JSON.stringify({ ...standMit(plus(TAG, -9)), app: 'schilddruese' }));
await page.click('#reiter-mehr');
await page.click('[data-seite="sicherung"]');
await page.setInputFiles('#sicherungDatei', datei);
await page.waitForTimeout(300);
await page.click('#reiter-mehr');
await page.click('[data-seite="sicherung"]');
check(await page.locator('[data-act="sicherung-zurueck"]').count() === 1, 'nach dem Einlesen über vorhandene Daten gibt es „zurückholen"');
dialog.antwort = false;
await page.click('[data-act="sicherung-zurueck"]');
check(dialoge.some((t) => t.includes('geht dabei verloren')), '„zurückholen" fragt nach und sagt, was verloren geht');
check((await gespeichert()).dosen[0].ab === plus(TAG, -9), 'abgebrochen: der eingelesene Stand bleibt');
dialog.antwort = true;
await uhr(plus(TAG, 3), '09:00');
await page.click('#reiter-mehr');
await page.click('[data-seite="sicherung"]');
check(await page.locator('[data-act="sicherung-zurueck"]').count() === 0, 'drei Tage später steht der Knopf nicht mehr da');
await uhr(TAG, '09:00');

// --- Sicherung mit kaputten Einträgen
const kaputt = path.join(ABLAGE, 'sd-kaputte-eintraege.json');
writeFileSync(kaputt, JSON.stringify({
  ...standMit(plus(TAG, -9)), app: 'schilddruese',
  labor: [{ id: 'x1', datum: plus(TAG, -4), tsh: { wert: 'k.A.' } }, { id: 'x2', datum: plus(TAG, -3), tsh: { wert: 2 } }],
  gewicht: [{ id: 'g0', datum: plus(TAG, -2), kg: 0 }],
  dosen: [{ id: 'd1', ab: plus(TAG, -9), mikrogramm: 75, tabletten: 1 }, { id: 'd2', datum: plus(TAG, -1), mikrogramm: 100 }],
  termine: [{ id: 'a\r\nRRULE:FREQ=DAILY', datum: plus(TAG, 3), uhr: '08:00', art: 'arzt' }],
}));
await page.click('#reiter-mehr');
await page.click('[data-seite="sicherung"]');
await page.setInputFiles('#sicherungDatei', kaputt);
await page.waitForTimeout(300);
const k = await gespeichert();
check(k.labor.length === 1 && k.labor[0].id === 'x2', 'ein Befund ohne lesbaren Wert fällt heraus, statt als leere Hülle zu bleiben');
check(k.gewicht.length === 0, 'ein Gewicht von 0 kg fällt heraus');
check(k.dosen.length === 1, 'eine Dosis ohne „ab" fällt heraus');
check(/^[A-Za-z0-9_-]+$/.test(k.termine[0].id), 'eine Kennung mit Zeilenumbruch wird durch eine eigene ersetzt');
await page.click('#reiter-verlauf');
check((await ansichtText(page)).includes(kurz(plus(TAG, -3))), 'der Verlauf zeigt danach ganz normal an');
await page.click('#reiter-mehr');
await page.click('[data-seite="bericht"]');
check(/TSH 2\b/.test(await page.locator('#berichtText').innerText()), 'und der Bericht auch');

// --- Ein Stand aus einer neueren Fassung wird auch durch Einlesen nicht überschrieben
// Erst das verzögerte Speichern des letzten Reiterwechsels abwarten – sonst
// schreibt die App beim Neuladen (pagehide) ihren Stand über den neueren.
await gespeichert();
await page.evaluate((key) => localStorage.setItem(key, JSON.stringify({ version: 2, neu: 'bleibt' })), SCHLUESSEL);
await page.reload({ waitUntil: 'networkidle' });
const n = dialoge.length;
await page.setInputFiles('#sicherungDatei', datei);
await page.waitForTimeout(300);
check(dialoge.slice(n).some((t) => t.includes('neueren Fassung')), 'liegt ein neuerer Stand im Speicher, lehnt das Einlesen ab');
check((await page.evaluate((key) => localStorage.getItem(key), SCHLUESSEL)).includes('bleibt'), '… und der neuere Stand bleibt unangetastet');

await ende();
