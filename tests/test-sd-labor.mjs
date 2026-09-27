/*
 * Schilddrüse: Laborwerte eintragen und ansehen.
 *
 * Der Bereich kommt vom Befund, nicht aus der App – jedes Labor hat eigene
 * Grenzen. Geprüft wird das Abschreiben (Komma, einseitiger Bereich,
 * Tippfehler), die Zuordnung zur damals gültigen Dosis und, was ohne
 * bestätigte Behandlung (P6) nicht passieren darf: ein Muster oder eine
 * Dringlichkeit. Die Lage zum Bereich steht in Worten da („über dem
 * Bereich", mit der Quelle des Bereichs) – nie „zu hoch", nie eine Ampel
 * ohne Worte. Die Einschätzung mit bestätigter Behandlung prüft
 * tests/test-sd-einschaetzung-ui.mjs.
 */
import { oeffne, standMit, plus, kurz, ansichtText } from './sd-hilfe.mjs';

const TAG = '2026-03-10';
const stand = standMit(plus(TAG, -100), {
  dosen: [
    { id: 'd1', ab: plus(TAG, -100), praeparat: 'L-Thyroxin', mikrogramm: 50, tabletten: 1, notiz: '' },
    { id: 'd2', ab: plus(TAG, -30), praeparat: 'L-Thyroxin', mikrogramm: 75, tabletten: 1, notiz: '' },
  ],
});
const { page, check, uhr, gespeichert, ende } = await oeffne({ tag: TAG, stand });

const fehlerTexte = () => page.locator('.feld-fehler').allInnerTexts();
const neu = async () => {
  await page.click('#reiter-verlauf');
  await page.click('#ansicht [data-seite="labor"]');
};

check((await (async () => { await page.click('#reiter-verlauf'); return ansichtText(page); })()).includes('Noch keine Laborwerte'), 'ohne Werte: ein Satz, was einzutragen ist');

// Fehleingaben – die Eingaben bleiben stehen.
await neu();
await page.click('button[type=submit]');
check((await fehlerTexte()).some((t) => t.includes('mindestens einen Wert')), 'ganz leer: „mindestens einen Wert"');
await page.fill('input[name=tsh_wert]', 'zwei');
await page.click('button[type=submit]');
check((await fehlerTexte()).some((t) => t.includes('TSH') && t.includes('Zahl')), 'Text statt Zahl wird am Feld gemeldet');
check(await page.inputValue('input[name=tsh_wert]') === 'zwei', '… und die Eingabe bleibt stehen');
await page.fill('input[name=tsh_wert]', '2,1');
await page.fill('input[name=tsh_von]', '4');
await page.fill('input[name=tsh_bis]', '0,4');
await page.click('button[type=submit]');
check((await fehlerTexte()).some((t) => t.includes('kleiner')), 'vertauschte Grenzen werden bemerkt');
await page.fill('input[name=datum]', plus(TAG, 3));
await page.fill('input[name=tsh_von]', '0,4');
await page.fill('input[name=tsh_bis]', '4,0');
await page.click('button[type=submit]');
check((await fehlerTexte()).some((t) => t.includes('Zukunft')), 'eine Blutabnahme in der Zukunft wird abgelehnt');

// Richtig eingetragen, mit Komma.
await page.fill('input[name=datum]', TAG);
await page.fill('input[name=ft4_wert]', '15.2');
await page.click('button[type=submit]');
let s = await gespeichert();
check(s.labor.length === 1, 'ein Befund gespeichert');
const l = s.labor[0];
check(l.tsh.wert === 2.1 && l.tsh.von === 0.4 && l.tsh.bis === 4 && l.tsh.einheit === 'mU/l', `TSH 2,1 mU/l, Bereich 0,4–4,0 – Komma als Dezimalzeichen (${JSON.stringify(l.tsh)})`);
check(l.ft4.wert === 15.2 && l.ft4.von === null, 'fT4 mit Punkt geschrieben, ohne Bereich: erlaubt');
check(l.ft3 === null, 'fT3 nicht bestimmt: bleibt leer');

let text = await ansichtText(page);
check(text.includes('2,1 mU/l') && text.includes('Bereich Ihres Labors 0,4–4'), 'die Liste zeigt Wert und Bereich des Labors');
check(text.includes('im Bereich') && text.includes('übliche Orientierung, nicht Ihr Labor'), 'je Wert die Lage in Worten – fT4 ohne Bereich ausdrücklich gegen die übliche Orientierung');
check(text.includes('Dosis damals 75 µg'), 'daneben die Dosis, die am Tag der Abnahme galt');

// Ein älterer Befund: andere Dosis damals, sortiert.
await neu();
check(await page.inputValue('input[name=tsh_von]') === '' && (await page.getAttribute('input[name=tsh_von]', 'placeholder')) === 'z. B. 0,4',
  'der Bereich wird nicht still vom letzten Befund übernommen – er steht nur als Platzhalter da');
check(await page.inputValue('select[name=tsh_einheit]') === 'mU/l', 'die Einheit ist vom letzten Befund vorbelegt und sichtbar');
await page.fill('input[name=datum]', plus(TAG, -60));
await page.fill('input[name=tsh_wert]', '6,3');
await page.click('button[type=submit]');
s = await gespeichert();
check(s.labor.map((x) => x.datum).join() === [plus(TAG, -60), TAG].join(), 'Befunde nach Datum sortiert gespeichert');
text = await ansichtText(page);
check(text.indexOf(kurz(TAG)) < text.indexOf(kurz(plus(TAG, -60))), 'in der Liste steht der neueste oben');
check(text.includes('Dosis damals 50 µg'), 'beim älteren Befund steht die damalige Dosis (50 µg)');

// Ohne bestätigte Behandlung (P6): die Lage in Worten, aber kein Muster und
// keine Dringlichkeit – auch nicht bei einem Wert weit über dem Bereich.
await page.click('#reiter-verlauf');
text = await ansichtText(page);
check(text.includes('über dem Bereich'), 'TSH 6,3 ohne Bereich: „über dem Bereich" (übliche Orientierung) in Worten');
check(!/zu hoch|zu niedrig|erhöht|erniedrigt|auffällig|schlecht eingestellt/i.test(text), 'kein „zu hoch", kein „erhöht" – die Lage steht nur als Lage da');
check(!(await page.locator('#ansicht .einschaetzung').count()) && (await page.locator('#ansicht #p6').count()) === 1, 'ohne bestätigte Behandlung kein Muster, keine Frist – stattdessen die P6-Karte zum Einschalten');
check(await page.locator('.verlauf-svg').count() === 1, 'ab zwei TSH-Werten gibt es eine Verlaufslinie');
const label = await page.locator('.verlauf-svg').getAttribute('aria-label');
check(label.includes('6,3') && label.includes('2,1'), 'die Linie ist für Vorleseprogramme als Zahlenreihe beschriftet');
check(await page.locator('.verlauf-bereich').count() === 1, 'der Bereich des Labors liegt als Streifen dahinter');

// Ändern und löschen.
await page.click('[data-seite="labor-liste"]');
await page.locator('[data-seite="labor"][data-param]').first().click();
await page.fill('input[name=tsh_wert]', '2,3');
await page.click('button[type=submit]');
s = await gespeichert();
check(s.labor.length === 2 && s.labor[1].tsh.wert === 2.3, 'Ändern ersetzt den Wert, statt einen dritten Befund anzulegen');
await page.locator('[data-seite="labor"][data-param]').last().click();
await page.click('[data-act="loeschen"]');
s = await gespeichert();
check(s.labor.length === 1 && s.labor[0].datum === TAG, 'Löschen entfernt genau diesen Befund');


// Eine Einheit, die das Menü nicht kennt, geht beim Ändern nicht verloren.
await uhr(TAG);
await page.evaluate((key) => {
  const st = JSON.parse(localStorage.getItem(key));
  st.labor[0].ft4.einheit = 'ng/dL';
  localStorage.setItem(key, JSON.stringify(st));
}, 'schilddruese.stand.v1');
await uhr(TAG);
await page.click('#reiter-verlauf');
await page.click('[data-seite="labor-liste"]');
await page.locator('[data-seite="labor"][data-param]').first().click();
check(await page.inputValue('select[name=ft4_einheit]') === 'ng/dL', 'eine abweichend geschriebene Einheit steht beim Ändern zur Auswahl');

// Ein einseitiger Bereich („< 116") ist erlaubt – so, wie er auf dem Befund steht.
await uhr(TAG);
await neu();
await page.fill('input[name=datum]', plus(TAG, -1));
await page.fill('input[name=tsh_wert]', '2,5');
await page.fill('input[name=tsh_bis]', '4,2');
await page.click('button[type=submit]');
s = await gespeichert();
const einseitig = s.labor.find((x) => x.datum === plus(TAG, -1));
check(einseitig && einseitig.tsh.von === null && einseitig.tsh.bis === 4.2, `nur die obere Grenze eingetragen: gespeichert (${JSON.stringify(einseitig && einseitig.tsh)})`);
check((await ansichtText(page)).includes('bis 4,2 mU/l'), '… und so angezeigt: „bis 4,2 mU/l"');

await ende();
