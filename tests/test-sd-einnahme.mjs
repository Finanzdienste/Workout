/*
 * Schilddrüse: die Tablette abhaken – der Kern der App.
 *
 * Drei Zustände je Tag, und der Unterschied zählt im Bericht: genommen,
 * bewusst nicht genommen, kein Eintrag. Dazu die Randfälle, die im Alltag
 * vorkommen: vertippt und zurücknehmen, gestern vergessen einzutragen, die
 * App über Mitternacht offen, ein Tag weit zurück nachgetragen.
 */
import { oeffne, standMit, plus, ansichtText } from './sd-hilfe.mjs';

const TAG = '2026-03-10';
const einnahmen = {};
for (let i = 9; i >= 2; i--) einnahmen[plus(TAG, -i)] = { uhr: '07:05' };
const stand = standMit(plus(TAG, -9), { einnahmen });

const { page, check, dialog, dialoge, uhr, gespeichert, ende } = await oeffne({ tag: TAG, zeit: '06:15', stand });

// Vor der Einnahmezeit: ruhig. Danach: gelb.
check(!(await page.locator('.tablette').getAttribute('class')).includes('faellig'), 'vor 7 Uhr ist der Knopf nicht als fällig markiert');
await uhr(TAG, '08:15');
check((await page.locator('.tablette').getAttribute('class')).includes('faellig'), 'nach 7 Uhr ohne Haken ist der Knopf als fällig markiert');
check((await page.locator('.tablette').innerText()).includes('Noch nicht eingetragen'), '… und sagt es in Worten, nicht nur mit Farbe');

// Gestern fehlt ein Eintrag.
check(await page.locator('#gestern').isVisible(), '„Gestern nicht eingetragen" erscheint, wenn gestern nichts steht');
await page.click('[data-act="gestern-nicht"]');
let s = await gespeichert();
check(s.einnahmen[plus(TAG, -1)] === null, '„Nein, vergessen" speichert gestern als bewusst nicht genommen (null)');
check(!(await page.locator('#gestern').count()), 'danach ist die Frage weg');
check((await page.locator('#meldung').innerText()).includes('Nicht doppelt'), 'die Meldung sagt: nicht doppelt nehmen');

// Abhaken.
await page.click('[data-act="tablette"]');
s = await gespeichert();
check(s.einnahmen[TAG] && s.einnahmen[TAG].uhr === '08:15', 'Abhaken speichert heute mit Uhrzeit 08:15');
check((await page.locator('.tablette').innerText()).includes('8:15 Uhr'), 'der Knopf zeigt „genommen … um 8:15 Uhr"');
check((await page.locator('.tablette').getAttribute('aria-pressed')) === 'true', 'der Knopf meldet sich für Vorleseprogramme als gedrückt');

await uhr(TAG, '08:20');
check((await page.locator('.tablette').getAttribute('class')).includes('genommen'), 'nach dem Neuladen ist der Haken noch da');

// Zurücknehmen – erst abbrechen, dann wirklich.
dialog.antwort = false;
await page.click('[data-act="tablette-zurueck"]');
check(dialoge.some((t) => t.includes('zurücknehmen')), 'Zurücknehmen fragt vorher nach');
s = await gespeichert();
check(!!s.einnahmen[TAG], 'wer bei der Rückfrage abbricht, behält den Haken');
dialog.antwort = true;
await page.click('[data-act="tablette-zurueck"]');
s = await gespeichert();
check(!(TAG in s.einnahmen), 'zurückgenommen heißt „kein Eintrag", nicht „nicht genommen"');
await page.click('[data-act="tablette"]');

// Über Mitternacht: neuer Tag, neuer Knopf.
await uhr(plus(TAG, 1), '07:30');
check(!(await page.locator('.tablette.genommen').count()), 'am nächsten Tag ist der Knopf wieder offen');
check(!(await page.locator('#gestern').count()), 'gestern ist eingetragen – keine Frage danach');
await uhr(TAG, '09:00');

// Verlauf: die Bilanz der letzten vier Wochen, ab der ersten Dosis.
await page.click('#reiter-verlauf');
const verlauf = await ansichtText(page);
check(verlauf.includes('An 9 von 10 Tagen genommen, an 1 Tag nicht'), `Bilanz „An 9 von 10 Tagen genommen, an 1 Tag nicht" (${verlauf.match(/An \d+ von[^–]*/)?.[0]})`);
check(await page.locator('.tage .tag.nein').count() === 1, 'im Raster ist genau ein Tag als „nicht genommen" markiert');
check(await page.locator('.tage .tag.leer').count() === 18, 'Tage vor der ersten Dosis zählen nicht mit (18 leere Felder)');

// Nachtragen über das Raster.
const vor5 = plus(TAG, -5);
await page.click(`.tage [data-param="${vor5}"]`);
check(await page.inputValue('input[name=datum]') === vor5, 'ein Tag im Raster öffnet das Nachtragen für genau diesen Tag');
await page.check('input[name=status][value=nicht]');
await page.click('button[type=submit]');
s = await gespeichert();
check(s.einnahmen[vor5] === null, 'nachgetragen: vor fünf Tagen nicht genommen');

// In der Zukunft nachtragen geht nicht.
await page.click('#reiter-verlauf');
await page.click('[data-seite="einnahme"]');
await page.fill('input[name=datum]', plus(TAG, 2));
await page.check('input[name=status][value=genommen]');
await page.click('button[type=submit]');
check((await page.locator('.feld-fehler').allInnerTexts()).some((t) => t.includes('Zukunft')), 'ein Tag in der Zukunft wird abgelehnt');
s = await gespeichert();
check(!(plus(TAG, 2) in s.einnahmen), '… und nicht gespeichert');

// Befinden: drei Knöpfe, ein Eintrag je Tag.
await page.click('#reiter-heute');
await page.click('[data-act="befinden"][data-stufe="schlecht"]');
await page.click('[data-act="befinden"][data-stufe="gut"]');
s = await gespeichert();
check(s.befinden.length === 1 && s.befinden[0].stufe === 'gut' && s.befinden[0].datum === TAG, 'zweimal getippt: ein Eintrag für heute, der letzte gilt');
check((await page.locator('[data-stufe="gut"]').getAttribute('aria-pressed')) === 'true', 'die gewählte Stufe ist als gedrückt markiert');
await page.click('[data-act="seite"][data-seite="befinden"]');
await page.check('input[name=beschwerden][value=muede]');
await page.check('input[name=beschwerden][value=frieren]');
await page.click('button[type=submit]');
s = await gespeichert();
check(s.befinden.length === 1 && s.befinden[0].beschwerden.join() === 'muede,frieren', 'Beschwerden ergänzen den Eintrag von heute, statt einen zweiten anzulegen');

await ende();
