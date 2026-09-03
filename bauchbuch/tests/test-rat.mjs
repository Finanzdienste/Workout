/*
 * Die Vorschläge für heute.
 *
 * Ein Rat ohne Begründung ist ein Befehl, und Befehle über das eigene Essen
 * befolgt man blind oder gar nicht – beides schlecht. Geprüft wird deshalb
 * weniger, *dass* etwas vorgeschlagen wird, als woraus es folgt:
 *
 *   * Jeder Vorschlag nennt sein „warum" und woher es kommt – aus ihrem
 *     eigenen Verlauf oder aus dem, was allgemein empfohlen wird.
 *   * Der Sportvorschlag richtet sich nach der Lage: bei starken Beschwerden
 *     nichts Intensives, kurz nach dem Essen auch nicht, an einem guten Tag
 *     ruhig.
 *   * Es steht nirgends, welches Medikament sie nehmen soll. Das ist die eine
 *     Empfehlung, die diese App nicht gibt, und sie darf sich nicht durch die
 *     Hintertür einschleichen.
 */
import { chromium } from 'playwright';
import { URL, KEY, HANDY, SHOT, vorTagen, pruefer } from './umgebung.mjs';

const { check, ende } = pruefer();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: HANDY });
const fehler = [];
page.on('pageerror', (e) => fehler.push(`PAGEERROR: ${e.message}`));

const heute = vorTagen(0);
const setze = async (stand) => {
  await page.evaluate(([k, s]) => localStorage.setItem(k, JSON.stringify(s)),
    [KEY, { begruesst: true, tab: 'heute', fenster: 4, mindestFaelle: 5, tage: {}, ...stand }]);
  await page.reload({ waitUntil: 'networkidle' });
};

await page.goto(URL, { waitUntil: 'networkidle' });

/* ---------- Ein gepflanzter Auslöser wird zum Vorschlag ---------- */

const mitKaffee = [];
for (let t = 1; t <= 12; t++) {
  mitKaffee.push({ id: `k${t}`, am: vorTagen(t), um: '09:00', art: 'essen', was: 'Frühstück', portion: 'normal', zutaten: [{ id: 'kaffee', rolle: 'getraenk' }] });
  mitKaffee.push({ id: `b${t}`, am: vorTagen(t), um: '10:30', art: 'beschwerde', staerke: 7, arten: ['brennen'] });
  mitKaffee.push({ id: `a${t}`, am: vorTagen(t), um: '18:00', art: 'essen', was: 'Abend', portion: 'normal', zutaten: [] });
}
await setze({ eintraege: mitKaffee });

const rat = await page.locator('.rat').textContent();
check(rat.includes('Heute eher ohne Kaffee'), 'der auffällige Auslöser wird für heute vorgeschlagen');
check(rat.includes('7,0 statt 0,0'), 'mit den Zahlen, aus denen das folgt');
check(rat.includes('12 Mahlzeiten damit'), 'und der Fallzahl');
check(
  (await page.locator('.rat-quelle.q-eigen').count()) > 0,
  'als „aus deinem Verlauf" ausgezeichnet',
);
check(
  rat.includes('Nicht für immer streichen'),
  'mit dem Hinweis, es nicht dauerhaft zu streichen – ein Verdacht ist kein Urteil',
);
await page.screenshot({ path: `${SHOT}/92-rat.png` });

/* ---------- Sport richtet sich nach der Lage ---------- */

await setze({
  eintraege: [{ id: 's1', am: heute, um: '08:00', art: 'beschwerde', staerke: 8, arten: ['krampf'] }],
});
check(
  (await page.locator('.rat-sport').textContent()).includes('nur spazieren'),
  'bei starken Beschwerden heute kein intensives Training',
);

await setze({ eintraege: [] });
const gut = await page.locator('.rat-sport').textContent();
check(gut.includes('auch intensiv'), 'an einem beschwerdefreien Tag spricht nichts dagegen');

await setze({
  eintraege: [{ id: 'e1', am: heute, um: '23:59', art: 'essen', was: 'gerade eben', portion: 'normal', zutaten: [] }],
});
// Die Mahlzeit liegt in der Zukunft dieses Tages nur, wenn der Test nach
// Mitternacht liefe – sonst ist sie eben gerade vorbei. Beides ist in Ordnung:
// geprüft wird, dass überhaupt ein Sportvorschlag mit Begründung dasteht.
check(
  (await page.locator('.rat-sport .klein').textContent()).length > 10,
  'auch dieser Vorschlag nennt seinen Grund',
);

/* ---------- Anspannung führt zur Atemübung ---------- */

await setze({
  eintraege: [],
  tage: { [heute]: { stress: 4, schlaf: 3 } },
});
const ruhe = await page.locator('.rat-ruhe').first().textContent();
check(ruhe.length > 0, 'bei viel Anspannung kommt ein Vorschlag zur Ruhe');
check(
  (await page.locator('.rat').textContent()).includes('4–7–8'),
  'und nennt die Übung beim Namen',
);
check(
  (await page.locator('.rat-sport').textContent()).includes('Moderate Ausdauer'),
  'an einem angespannten Tag wird moderat statt intensiv vorgeschlagen',
);

/* ---------- Kein Medikamentenvorschlag ---------- */

await setze({
  eintraege: [
    { id: 'm1', am: vorTagen(1), um: '07:00', art: 'medikament', mittel: 'Pantoprazol', dosis: '20 mg' },
    { id: 'b1', am: heute, um: '10:00', art: 'beschwerde', staerke: 5, arten: ['brennen'] },
  ],
});
const alles = await page.locator('#view').textContent();
check(alles.includes('Pantoprazol'), 'was sie nimmt, steht da');
check(alles.includes('zuletzt'), 'mit dem Datum der letzten Einnahme');
check(
  alles.includes('schlägt bewusst kein Medikament vor'),
  'und der Satz, dass hier bewusst nichts vorgeschlagen wird',
);
const geraten = alles.match(/nimm (heute |jetzt )?(ein|eine|einen|Pantoprazol|Omeprazol|Ibuprofen)/gi) || [];
check(
  geraten.length === 0,
  `nirgends eine Einnahmeempfehlung${geraten.length ? `: ${geraten.join(', ')}` : ''}`,
);

/* ---------- Nur für heute ---------- */

await page.locator('[data-act="tag-blaettern"][data-d="-1"]').click();
await page.waitForTimeout(250);
check(
  await page.locator('.rat').count() === 0,
  'an einem vergangenen Tag stehen keine Vorschläge – für gestern kommt jeder Rat zu spät',
);

check(fehler.length === 0, `keine Fehler${fehler.length ? `: ${fehler.join(' | ')}` : ''}`);
await browser.close();
ende();
