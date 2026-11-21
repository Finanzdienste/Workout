/*
 * Mahlzeit: so, wie der Kollege sie benutzt.
 *
 * Öffnen ohne eine einzige Frage, suchen und eintragen, Menge ändern,
 * löschen und zurückholen, selbst eintragen mit Umrechnung von der Packung,
 * gestern nachtragen, Tagesziel, Hafertage planen und abhaken, Gewicht und
 * Blutzucker (mit mmol/l-Rückfrage), Sicherung hin und zurück, „Alles
 * löschen" lässt die anderen Apps im Ursprung in Ruhe, und auf schmalen
 * Handys läuft nichts über den Rand.
 */
import { readFileSync } from 'node:fs';
import { oeffne, pruefer, summe, eintragen, SCHLUESSEL, plus } from './mz-hilfe.mjs';

const { check, ende } = pruefer();
const TAG = '2026-11-17';
const MORGEN = plus(TAG, 1);

const { browser, page, fehler, dialoge, dialog, gespeichert } = await oeffne({
  tag: TAG,
  zeit: '08:15',
  weitere: { 'schilddruese.stand.v1': '{"fremd":true}', 'workout.irgendwas': '1' },
});

// --- Erster Start: keine Fragen
check(await page.title() === 'Mahlzeit', 'Titel: Mahlzeit');
check(dialoge.length === 0, 'beim ersten Öffnen kein Dialog');
check(await page.locator('#ansicht input, #ansicht select, #ansicht textarea').count() === 0, 'auf der Startseite kein einziges Eingabefeld – nichts auszufüllen');
check(await page.locator('#essen-knopf').isVisible(), 'der große Knopf „Essen eintragen" ist da');
check(await page.locator('#willkommen').isVisible(), 'ein kurzes Hallo statt Fragen');
check(await summe(page) === 0, 'Tagessumme 0');
check((await page.locator('#tag-titel').innerText()) === 'Heute', 'Überschrift „Heute"');

// --- Suchen und eintragen
await page.click('#essen-knopf');
check(await page.locator('#beliebt .sache').count() >= 10, 'vor der Suche: übliche Sachen zum Antippen');
check(await page.evaluate(() => document.activeElement?.id) === 'suche', 'das Suchfeld hat gleich den Fokus');
await page.fill('#suche', 'semmel');
check((await page.locator('#trefferliste .sache').first().innerText()).includes('Brötchen'), '„semmel" → Brötchen als erster Treffer');
await page.locator('#trefferliste .sache').first().click();
check(await page.locator('[data-tun="zeit"][data-z="morgens"]').getAttribute('aria-pressed') === 'true', 'um 8:15 ist „Morgens" vorgewählt');
await page.click('[data-tun="menge"][data-m="2"]');
check((await page.locator('#sache-kcal').innerText()) === '280', 'zwei Brötchen: 280 kcal');
await page.click('#eintragen');
check((await page.locator('#eingetragen').innerText()).includes('2 × Brötchen'), 'Bestätigung „2 × Brötchen … eingetragen – noch etwas?"');
await page.fill('#suche', 'cola');
await page.locator('#trefferliste .sache', { hasText: '0,5 l' }).first().click();
check((await page.locator('#tipp').innerText()).includes('Cola Zero'), 'bei Cola steht der Tausch-Tipp');
await page.click('#eintragen');
await page.click('#eingetragen [data-tun="ebene-zu"]');
check(await page.locator('#ebene').isHidden(), '„Fertig" schließt die Suche');
check(await summe(page) === 490, `Summe 280 + 210 = 490 (${await summe(page)})`);
check((await page.locator('#eintraege').innerText()).includes('2 × Brötchen'), 'in der Liste: 2 × Brötchen');
check((await page.locator('#eintraege h3').first().innerText()).startsWith('Morgens'), '… unter „Morgens"');

const st = await gespeichert();
check(st && st.tage[TAG].length === 2, `gespeichert unter ${SCHLUESSEL}`);
const keys = await page.evaluate(() => Object.keys(localStorage));
check(keys.filter((k) => !k.startsWith('mahlzeit.') && !k.startsWith('__') && !['schilddruese.stand.v1', 'workout.irgendwas'].includes(k)).length === 0,
  `keine Schlüssel außerhalb von „mahlzeit." (${keys.join(', ')})`);

// --- Ändern, löschen, zurückholen
await page.locator('.eintrag', { hasText: 'Brötchen' }).click();
await page.click('[data-tun="menge"][data-m="0.5"]');
await page.click('#speichern');
check(await summe(page) === 70 + 210, `½ Brötchen statt 2: Summe 280 (${await summe(page)})`);
await page.locator('.eintrag', { hasText: 'Cola' }).click();
await page.click('#loeschen');
check(await summe(page) === 70, 'Cola gelöscht: 70');
await page.click('#meldung [data-tun="rueckgaengig"]');
check(await summe(page) === 280, 'Rückgängig holt sie zurück: 280');

// --- Zurück-Taste schließt die Ebene, nicht die App
await page.click('#essen-knopf');
await page.goBack();
await page.waitForTimeout(150);
check(await page.locator('#ebene').isHidden() && await page.locator('#essen-knopf').isVisible(), 'Zurück-Taste schließt die Suche und bleibt in der App');

// --- Selbst eintragen, von der Packung umgerechnet
await page.click('#essen-knopf');
await page.fill('#suche', 'gulasch kantine');
await page.click('[data-tun="eigen"]');
await page.fill('#eigen-name', 'Kantine Gulasch');
await page.click('.umrechnen summary');
await page.fill('#eigen-100', '120');
await page.fill('#eigen-g', '400');
check(await page.inputValue('#eigen-kcal') === '480', '120 kcal pro 100 g × 400 g = 480 kcal, ins Feld übernommen');
await page.click('[data-tun="zeit"][data-z="mittags"]');
check(await page.inputValue('#eigen-name') === 'Kantine Gulasch', 'die Tageszeit wählen löscht die Eingaben nicht');
await page.click('form[data-form="eigen"] button[type="submit"]');
await page.fill('#suche', 'kantine');
check((await page.locator('#trefferliste .sache').first().innerText()).includes('eigenes'), 'die eigene Sache findet die Suche wieder');
await page.click('#ebene [data-tun="ebene-zu"]');
check(await summe(page) === 760, `Summe mit Gulasch: 760 (${await summe(page)})`);
check((await page.locator('#eintraege').innerText()).includes('Mittags'), 'Gulasch steht unter „Mittags"');

// Falsche Kalorien: Hinweis statt Eintrag
await page.click('#essen-knopf');
await page.click('[data-tun="eigen"]');
await page.fill('#eigen-kcal', 'viel');
await page.click('form[data-form="eigen"] button[type="submit"]');
check((await page.locator('#eigen-fehler').innerText()).includes('Zahl'), 'keine Zahl bei den Kalorien: Hinweis, nichts eingetragen');
await page.click('[data-tun="zurueck-suche"]');
check(await page.locator('#oft .sache').count() >= 3, '„Oft bei dir" zeigt, was schon eingetragen wurde');
await page.click('#ebene [data-tun="ebene-zu"]');
check(await summe(page) === 760, 'Summe unverändert');

// --- Gestern nachtragen
await page.click('[data-tun="tag"][data-schritt="-1"]');
check((await page.locator('#tag-titel').innerText()) === 'Gestern' && await summe(page) === 0, 'gestern: leer');
await eintragen(page, 'apfel', 'Apfel');
await page.click('#ebene [data-tun="ebene-zu"]');
check(await summe(page) === 80, 'Apfel gestern: 80');
await page.click('[data-tun="tag"][data-schritt="1"]');
check((await page.locator('#tag-titel').innerText()) === 'Heute' && await summe(page) === 760, 'zurück zu heute: 760');
check(await page.locator('[data-tun="tag"][data-schritt="1"]').isDisabled(), 'in die Zukunft geht es nicht');

// --- Tagesziel
await page.click('#reiter-mehr');
await page.click('[data-tun="ziel"][data-ziel="2000"]');
await page.click('#reiter-heute');
check((await page.locator('#ziel-text').innerText()) === 'von 2.000 · noch 1.240', `Ziel: „von 2.000 · noch 1.240" (${await page.locator('#ziel-text').innerText()})`);
await page.click('#reiter-mehr');
dialog.text = '2300';
await page.click('[data-tun="ziel-eigen"]');
await page.click('#reiter-heute');
check((await page.locator('#ziel-text').innerText()).startsWith('von 2.300'), 'eigene Zahl als Ziel');

// --- Hafertage planen
await page.click('#willkommen [data-tun="hinweis-weg"]');
check(await page.locator('#willkommen').count() === 0, '„Alles klar" blendet das Hallo aus');
check((await page.locator('#hafer-vorschau').innerText()).includes('Wie oft hat dein Arzt gesagt'), 'Startseite: Hafertage einrichten – eine Frage');
await page.click('#hafer-vorschau [data-tun="seite"]');
check(await page.locator('#hafer-achtung').isVisible(), 'Hafer-Seite: der Hinweis zum Arzt steht oben');
check((await page.locator('#hafer-achtung').innerText()).includes('Insulin'), '… mit Insulin und Tabletten');
await page.click('[data-tun="hafer-art"][data-art="verteilt"]');
check(await page.locator('[data-tun="hafer-oft"][data-n="3"]').getAttribute('aria-pressed') === 'true', 'verteilt: 3 im Monat vorgewählt');
await page.click('#reiter-heute');
check((await page.locator('#hafer-vorschau').innerText()).includes('noch keiner geplant'), 'Startseite: im November noch kein Hafertag geplant');
await page.click('#hafer-vorschau [data-tun="seite"]');
await page.click(`[data-tun="hafer-tag"][data-tag="${MORGEN}"]`);
check(await page.locator(`[data-tun="hafer-tag"][data-tag="${MORGEN}"]`).getAttribute('aria-pressed') === 'true', 'morgen als Hafertag eingetragen');
check((await page.locator('#hafer-zahl').innerText()).includes('1 von 3 geplant'), 'Zähler: 1 von 3');
check((await page.locator('#einkauf').innerText()).includes('225 g Haferflocken'), 'Einkaufsliste: 225 g Haferflocken für einen Tag');
const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#ics-knopf')]);
const ics = readFileSync(await dl.path(), 'utf8');
check(dl.suggestedFilename() === 'hafertage.ics' && ics.includes(`DTSTART;VALUE=DATE:${MORGEN.replace(/-/g, '')}`), 'Kalenderdatei mit dem Hafertag');
await page.click('[data-tun="hafer-oft"][data-n="2"]');
check((await page.locator('#hafer-zahl').innerText()).includes('1 von 2 geplant'), 'Wie oft: 2 im Monat');
await page.click('#reiter-heute');
check((await page.locator('#hafer-vorschau').innerText()).includes('Morgen ist Hafertag'), 'Startseite: „Morgen ist Hafertag"');

// --- Werte
await page.click('#reiter-werte');
await page.fill('#w-gewicht', '98,4');
await page.click('form[data-form="gewicht"] button');
await page.fill('#w-gewicht', '98');
await page.click('form[data-form="gewicht"] button');
const gew = (await gespeichert()).werte.filter((w) => w.art === 'gewicht');
check(gew.length === 1 && gew[0].wert === 98, 'zweites Gewicht am selben Tag ersetzt das erste');
await page.fill('#w-gewicht', '9');
await page.click('form[data-form="gewicht"] button');
check((await gespeichert()).werte.filter((w) => w.art === 'gewicht').length === 1, '9 kg wird nicht gespeichert');
await page.click('[data-tun="zucker-wann"][data-wann="nach"]');
await page.fill('#w-zucker', '6,5');
await page.click('form[data-form="zucker"] button');
check(dialoge.some((d) => d.includes('mmol/l') && d.includes('117')), 'bei 6,5 fragt die App nach mmol/l');
const zu = (await gespeichert()).werte.filter((w) => w.art === 'zucker');
check(zu.length === 1 && zu[0].wert === 117 && zu[0].wann === 'nach' && zu[0].uhr === '08:15', 'gespeichert als 117 mg/dl, nach dem Essen, 08:15');
check((await page.locator('#karte-zucker').innerText()).includes('117 mg/dl'), 'in der Liste: 117 mg/dl');
await page.fill('#w-hba1c', '7,2');
await page.click('form[data-form="hba1c"] button');
check((await page.locator('#karte-hba1c').innerText()).includes('7,2 %'), 'HbA1c 7,2 %');
// Schlaf und Schritte von der Uhr (v9)
await page.fill('#w-schlaf', '7:30');
await page.click('form[data-form="schlaf"] button');
check((await page.locator('#karte-schlaf').innerText()).includes('7 Std 30 Min'), 'Schlaf 7:30 → „7 Std 30 Min"');
await page.fill('#w-schlaf', '6,5');
await page.click('form[data-form="schlaf"] button');
const sl = (await gespeichert()).werte.filter((w) => w.art === 'schlaf');
check(sl.length === 1 && sl[0].wert === 390, 'zweiter Schlaf derselben Nacht ersetzt den ersten (6,5 → 390 Minuten)');
await page.fill('#w-schlaf', 'lang');
await page.click('form[data-form="schlaf"] button');
check((await gespeichert()).werte.filter((w) => w.art === 'schlaf').length === 1 && (await page.locator('#meldung').innerText()).includes('7:30'), 'Unsinn wird nicht gespeichert, die Meldung zeigt, wie es geht');
await page.fill('#w-schritte', '8.432');
await page.click('form[data-form="schritte"] button');
check((await gespeichert()).werte.find((w) => w.art === 'schritte')?.wert === 8432 && (await page.locator('#karte-schritte').innerText()).includes('8.432'), 'Schritte „8.432" → 8432, angezeigt als 8.432');

// --- Schmale Handys
await page.setViewportSize({ width: 340, height: 700 });
for (const reiter of ['heute', 'hafer', 'sport', 'werte', 'mehr']) {
  await page.click(`#reiter-${reiter}`);
  const breit = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check(breit <= 0, `340 px breit, „${reiter}": nichts läuft über den Rand (${breit})`);
}
await page.click('#reiter-heute');
await page.click('#essen-knopf');
const ebeneBreit = await page.evaluate(() => { const e = document.querySelector('#ebene'); return e.scrollWidth - e.clientWidth; });
check(ebeneBreit <= 0, `340 px breit, Suche: nichts läuft über den Rand (${ebeneBreit})`);
await page.click('#ebene [data-tun="ebene-zu"]');
await page.setViewportSize({ width: 390, height: 844 });

// --- Sicherung, Alles löschen, Einlesen
await page.click('#reiter-mehr');
const [sdl] = await Promise.all([page.waitForEvent('download'), page.click('#sichern')]);
const sicherung = readFileSync(await sdl.path(), 'utf8');
const inhalt = JSON.parse(sicherung);
check(inhalt.app === 'mahlzeit' && inhalt.stand.tage[TAG].length === 3, 'Sicherung enthält die Einträge');
check((await page.locator('#sicherung-stand').innerText()).includes('Dienstag, 17. November'), 'Zuletzt gesichert: heute');
dialog.antwort = true;
await page.click('[data-tun="alles-loeschen"]');
check(await summe(page) === 0, 'Alles löschen: wieder leer');
const nachher = await page.evaluate(() => ({ s: localStorage.getItem('schilddruese.stand.v1'), w: localStorage.getItem('workout.irgendwas'), m: localStorage.getItem('mahlzeit.stand.v1') }));
check(nachher.s === '{"fremd":true}' && nachher.w === '1', 'die anderen Apps im Ursprung behalten ihre Daten');
check(nachher.m === null, 'der eigene Schlüssel ist weg');
await page.click('#reiter-mehr');
await page.setInputFiles('#einlesen', { name: 'mahlzeit-sicherung.json', mimeType: 'application/json', buffer: Buffer.from(sicherung) });
await page.waitForTimeout(200);
check(dialoge.some((d) => d.startsWith('Sicherung einlesen')), 'vor dem Einlesen wird gefragt');
await page.click('#reiter-heute');
check(await summe(page) === 760, 'nach dem Einlesen sind die Einträge wieder da');
await page.click('#reiter-mehr');
await page.setInputFiles('#einlesen', { name: 'fremd.json', mimeType: 'application/json', buffer: Buffer.from('{"app":"workout"}') });
await page.waitForTimeout(200);
check(dialoge.some((d) => d.includes('keine Sicherung')), 'eine fremde Datei wird abgelehnt, mit Grund');

check(fehler.length === 0, `keine Fehler in der Seite${fehler.length ? `: ${fehler.slice(0, 3).join(' | ')}` : ''}`);
await browser.close();

// --- Am Hafertag selbst
const amTag = await oeffne({ tag: MORGEN, zeit: '07:30', stand: JSON.parse(sicherung).stand });
const p2 = amTag.page;
check(await p2.locator('#hafertag').isVisible(), 'am Hafertag steht die Hafer-Karte oben');
for (const i of [0, 1, 2]) await p2.click(`[data-tun="hafer-mahlzeit"][data-i="${i}"]`);
check(await summe(p2) === 275 + 285 + 285, `drei Haferbrei: ${await summe(p2)} kcal`);
check((await p2.locator('#hafertag').innerText()).includes('Geschafft'), '„Geschafft" nach der dritten');
check((await p2.locator('#eintraege').innerText()).includes('Abends'), 'die Abendmahlzeit steht unter „Abends"');
await p2.click('[data-tun="hafer-mahlzeit"][data-i="1"]');
check(await summe(p2) === 560, 'Mittag wieder abgehakt: 560');
check(await p2.locator('[data-tun="hafer-mahlzeit"][data-i="1"]').getAttribute('aria-pressed') === 'false', '… und als nicht gegessen angezeigt');
await p2.click('#reiter-hafer');
check(await p2.locator(`[data-tun="hafer-tag"][data-tag="${MORGEN}"]`).getAttribute('aria-pressed') === 'true', 'im Kalender ist der Tag markiert');
check(amTag.fehler.length === 0, `keine Fehler am Hafertag${amTag.fehler.length ? `: ${amTag.fehler.slice(0, 3).join(' | ')}` : ''}`);
await amTag.browser.close();

// --- Kaputter Speicher: die App startet trotzdem
const kaputt = await oeffne({ weitere: { [SCHLUESSEL]: '{nicht json' } });
check(await kaputt.page.locator('#essen-knopf').isVisible(), 'kaputter Speicher: die App startet trotzdem');
check(kaputt.fehler.length === 0, 'ohne Fehler');
await kaputt.browser.close();

ende();
