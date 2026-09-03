/*
 * Zutaten: die Reihenfolge beim Eintragen und die Rolle statt einer Menge.
 *
 * Zwei Dinge, die beide daran hängen, dass jemand jeden Tag mehrmals etwas
 * einträgt:
 *
 *   Die Reihenfolge. Sechzehn Marken plus eigene sind zu viele zum Suchen.
 *   Was oft vorkommt, steht oben – sonst dauert eine Eintragung fünfzehn
 *   Sekunden statt drei, und an einem schlechten Tag unterbleibt sie.
 *
 *   Die Rolle. Niemand wiegt sein Abendessen, aber „Zwiebel" ist keine
 *   Auskunft, wenn es einmal die Suppe war und einmal drei Ringe obendrauf.
 *   Statt Gramm also: Hauptzutat, Beilage, Topping, Getränk, Würze.
 *
 * Dazu die Umrechnung alter Eintragungen, denn das Feld hieß vorher anders.
 */
import { chromium } from 'playwright';
import { URL, KEY, HANDY, SHOT, vorTagen, pruefer } from './umgebung.mjs';

const { check, ende } = pruefer();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: HANDY });
const fehler = [];
page.on('pageerror', (e) => fehler.push(`PAGEERROR: ${e.message}`));

const essen = (t, zutaten, was) => ({
  id: `e${t}`, am: vorTagen(t), um: '12:00', art: 'essen', was, portion: 'normal', zutaten,
});

const eintraege = [
  essen(5, [{ id: 'milch', rolle: 'haupt' }], 'Haferbrei'),
  essen(4, [{ id: 'milch', rolle: 'haupt' }], 'Haferbrei'),
  essen(3, [{ id: 'milch', rolle: 'topping' }], 'Haferbrei'),
  essen(2, [{ id: 'zwiebel', rolle: 'haupt' }], 'Zwiebelsuppe'),
];

await page.goto(URL, { waitUntil: 'networkidle' });
await page.evaluate(([k, s]) => localStorage.setItem(k, JSON.stringify(s)),
  [KEY, { eintraege, tage: {}, begruesst: true, tab: 'heute' }]);
await page.reload({ waitUntil: 'networkidle' });

/* ---------- Die Reihenfolge ---------- */

await page.locator('[data-act="neu"][data-art="essen"]').click();
await page.waitForTimeout(200);
const auswahl = page.locator('.marken:not(.marken-eng) .marke');
check(
  await auswahl.first().getAttribute('data-id') === 'milch',
  'die dreimal benutzte Zutat steht ganz oben',
);
check(
  await auswahl.nth(1).getAttribute('data-id') === 'zwiebel',
  'die einmal benutzte an zweiter Stelle',
);
check(
  await auswahl.nth(2).getAttribute('data-id') === 'kaffee',
  'danach der Katalog in seiner eigenen Reihenfolge – nie benutzt heißt nicht ganz unten',
);

check(
  await page.locator('[data-act="gericht"]').count() === 1,
  'was mehr als einmal gegessen wurde, steht als Vorschlag da',
);
await page.locator('[data-act="gericht"]').click();
await page.waitForTimeout(200);
check(
  await page.locator('#bogenWas').inputValue() === 'Haferbrei',
  'und füllt das Textfeld mit einem Tippen',
);

/* ---------- Die Rolle ---------- */

check(await page.locator('.zutat').count() === 0, 'ohne Zutat kein Rollenmenü');
await page.locator('.marke[data-id="zwiebel"]').click();
await page.waitForTimeout(200);
check(await page.locator('.zutat').count() === 1, 'die gewählte Zutat bekommt eine Zeile');
check(
  await page.locator('.zutat-rolle').inputValue() === 'haupt',
  'mit „Hauptzutat" als Vorgabe – die harmlosere Angabe wird nicht unterstellt',
);
const rollen = await page.locator('.zutat-rolle option').allTextContents();
check(rollen.length === 5, `fünf Rollen zur Wahl (${rollen.length})`);
check(
  rollen.join(' ').includes('Topping') && rollen.join(' ').includes('Würze'),
  'darunter Topping und Würze',
);
check(
  await page.locator('.bogen input[type="number"]').count() === 0,
  'kein Zahlenfeld – die Menge wird nirgends abgefragt',
);

await page.locator('.zutat-rolle').selectOption('wuerze');
await page.waitForTimeout(150);
await page.locator('#bogenWas').fill('Bratkartoffeln');
await page.locator('[data-act="bogen-speichern"]').click();
await page.waitForTimeout(250);

const zeile = await page.locator('.strang-zeile').first().textContent();
check(zeile.includes('Bratkartoffeln'), 'die Mahlzeit steht im Tag');
check(zeile.includes('Zwiebel, Knoblauch (Würze)'), 'die Rolle steht dabei, weil sie nicht die Vorgabe ist');

const gespeichert = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)), KEY);
const neu = gespeichert.eintraege.find((x) => x.was === 'Bratkartoffeln');
check(
  neu.zutaten.length === 1 && neu.zutaten[0].rolle === 'wuerze',
  'und so steht sie auch im Speicher',
);
check(!('tags' in neu), 'das alte Feld wird nicht mehr mitgeschrieben');

// Die Vorgabe bleibt unerwähnt – sonst stünde an jeder Zeile "(Haupt)".
await page.locator('[data-act="neu"][data-art="essen"]').click();
await page.waitForTimeout(200);
await page.locator('.marke[data-id="kaffee"]').click();
await page.locator('[data-act="bogen-speichern"]').click();
await page.waitForTimeout(250);
const kaffeeZeile = await page.locator('.strang-zeile').filter({ hasText: 'Kaffee' }).first().textContent();
check(!kaffeeZeile.includes('(Haupt)'), 'bei der Vorgabe steht keine Rolle dabei');

await page.screenshot({ path: `${SHOT}/80-zutaten.png` });

/* ---------- Alte Eintragungen werden umgerechnet ---------- */

await page.evaluate(([k, alt]) => localStorage.setItem(k, JSON.stringify(alt)), [KEY, {
  begruesst: true,
  tab: 'heute',
  eintraege: [{
    id: 'alt1', am: new Date().toISOString().slice(0, 10), um: '12:00',
    art: 'essen', was: 'Alte Mahlzeit', tags: ['zwiebel', 'fett'], portion: 'normal',
  }],
}]);
await page.reload({ waitUntil: 'networkidle' });
check(
  (await page.locator('.strang-zeile').first().textContent()).includes('Zwiebel'),
  'die alte Mahlzeit wird unverändert angezeigt',
);
// Umgerechnet wird beim Laden, geschrieben erst beim nächsten Mal, an dem
// ohnehin geschrieben wird – ein Reiterwechsel genügt. Nichts anderes wäre
// auch richtig: Das Öffnen einer App darf nicht von selbst Daten verändern.
await page.locator('[data-act="tab"][data-tab="verlauf"]').click();
await page.waitForTimeout(300);
const umgerechnet = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)).eintraege[0], KEY);
check(
  Array.isArray(umgerechnet.zutaten) && umgerechnet.zutaten.length === 2,
  'eine alte Eintragung bekommt ihre Zutaten in neuer Form',
);
check(
  umgerechnet.zutaten.every((z) => z.rolle === 'haupt'),
  'mit „haupt" – nachträglich die harmlosere Rolle zu unterstellen, würde alte Funde kleinrechnen',
);
check(!('tags' in umgerechnet), 'und das alte Feld ist weg, damit es die Angabe nur einmal gibt');

/* ---------- Die Rolle taucht in der Auswertung auf ---------- */

const viele = [];
for (let t = 1; t <= 12; t++) {
  const rolle = t <= 6 ? 'haupt' : 'wuerze';
  viele.push({
    id: `v${t}`, am: vorTagen(t), um: '12:00', art: 'essen', was: 'Essen',
    portion: 'normal', zutaten: [{ id: 'zwiebel', rolle }],
  });
  // Nur nach der Hauptzutat tut es weh – genau das soll die Aufschlüsselung zeigen.
  if (rolle === 'haupt') {
    viele.push({ id: `w${t}`, am: vorTagen(t), um: '13:00', art: 'beschwerde', staerke: 8, arten: ['druck'] });
  }
  viele.push({
    id: `x${t}`, am: vorTagen(t), um: '18:00', art: 'essen', was: 'Abend',
    portion: 'normal', zutaten: [],
  });
}
await page.evaluate(([k, s]) => localStorage.setItem(k, JSON.stringify(s)),
  [KEY, { eintraege: viele, tage: {}, fenster: 4, mindestFaelle: 5, begruesst: true, tab: 'muster' }]);
await page.reload({ waitUntil: 'networkidle' });

const fund = page.locator('.funde .fund').first();
check((await fund.textContent()).includes('Zwiebel'), 'die Zwiebel ist auffällig');
const aufschluesselung = await fund.locator('.rollen li').allTextContents();
check(aufschluesselung.length === 2, `beide Rollen aufgeschlüsselt (${aufschluesselung.length})`);
check(
  aufschluesselung[0].includes('Hauptzutat') && aufschluesselung[0].includes('danach 8'),
  'als Hauptzutat sechsmal mit 8 – das ist die Auskunft, für die es die Rollen gibt',
);
check(
  aufschluesselung[1].includes('Würze') && aufschluesselung[1].includes('danach 0'),
  'als Würze sechsmal ohne Folgen',
);
check(
  aufschluesselung.every((z) => /\d+ Mal/.test(z)),
  'jede Rolle nennt ihre Fallzahl – eine Aufschlüsselung hat kleinere Zahlen als das Ganze',
);

check(fehler.length === 0, `keine Fehler${fehler.length ? `: ${fehler.join(' | ')}` : ''}`);
await browser.close();
ende();
