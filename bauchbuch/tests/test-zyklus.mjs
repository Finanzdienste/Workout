/*
 * Der Zyklus – gerechnet aus eingetragenen Blutungstagen.
 *
 * Zwei Dinge werden geprüft, und das zweite ist wichtiger als das erste.
 *
 * Erstens die Rechnung: Wo fängt ein Zyklus an, wie lang ist er, in welche
 * Phase fällt ein Tag. Eine Lücke von zwei Tagen mitten in der Periode darf
 * keinen neuen Zyklus erzeugen – sonst käme eine Zykluslänge von vier Tagen
 * heraus und alles Weitere wäre Unsinn.
 *
 * Zweitens das Schweigen. Ohne abgeschlossenen Zyklus gibt es keine mittlere
 * Länge, und ohne die keine Phasen. Still 28 Tage anzunehmen wäre bequem und
 * bei jedem, dessen Zyklus 24 oder 34 Tage dauert, durchgehend falsch. Und
 * nirgends darf eine Vorhersage stehen: Das hier ist kein Verhütungsmittel.
 */
import { chromium } from 'playwright';
import { URL, KEY, HANDY, pruefer } from './umgebung.mjs';

const { check, ende } = pruefer();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: HANDY });
const fehler = [];
page.on('pageerror', (e) => fehler.push(`PAGEERROR: ${e.message}`));
await page.goto(URL, { waitUntil: 'networkidle' });

const rechne = (name, ...args) => page.evaluate(
  ([n, a]) => import('./js/zyklus.js').then((m) => m[n](...a)),
  [name, args],
);

/** Tage bauen: blutung an den genannten Daten, sonst nichts. */
function tageMit(daten) {
  const t = {};
  daten.forEach((iso) => { t[iso] = { blutung: 3 }; });
  return t;
}

/* ---------- Zyklen finden ---------- */

const zwei = tageMit([
  '2026-01-05', '2026-01-06', '2026-01-07', '2026-01-08',
  '2026-02-02', '2026-02-03', '2026-02-04',
  '2026-03-04', '2026-03-05',
]);

const z = await rechne('zyklen', zwei);
check(z.length === 3, `drei Zyklusanfänge gefunden (${z.length})`);
check(z[0].start === '2026-01-05', 'der erste beginnt am ersten Blutungstag');
check(z[0].laenge === 28, `der erste dauert 28 Tage (${z[0].laenge})`);
check(z[1].laenge === 30, `der zweite dauert 30 Tage (${z[1].laenge})`);
check(z[2].laenge === null, 'der letzte läuft noch und hat deshalb keine Länge');
check(z[0].blutungsTage === 4, `vier Blutungstage im ersten Zyklus (${z[0].blutungsTage})`);

// Eine Pause von zwei Tagen mitten in der Periode ist keine neue Periode.
const mitLuecke = tageMit(['2026-01-05', '2026-01-06', '2026-01-08', '2026-02-02']);
const zl = await rechne('zyklen', mitLuecke);
check(zl.length === 2, `zwei Zyklen trotz Lücke von zwei Tagen (${zl.length})`);

check(await rechne('mittlereLaenge', zwei) === 29, 'die mittlere Länge ist 29');
const spanne = await rechne('schwankung', zwei);
check(spanne.von === 28 && spanne.bis === 30, 'die Schwankung wird als Spanne genannt');

/* ---------- Phasen ---------- */

check(await rechne('zyklusTag', zwei, '2026-02-02') === 1, 'der erste Blutungstag ist Zyklustag 1');
check(await rechne('zyklusTag', zwei, '2026-02-10') === 9, 'acht Tage später ist Zyklustag 9');
check(await rechne('phaseVon', zwei, '2026-02-03') === 'menstruation', 'ein Blutungstag ist Periode');
check(await rechne('phaseVon', zwei, '2026-02-09') === 'follikel', 'Tag 8 liegt in der ersten Hälfte');
check(await rechne('phaseVon', zwei, '2026-02-16') === 'ovulation', 'Tag 15 liegt in der Mitte');
check(await rechne('phaseVon', zwei, '2026-02-24') === 'luteal', 'Tag 23 liegt in der zweiten Hälfte');

/* ---------- Ohne Grundlage keine Aussage ---------- */

const einer = tageMit(['2026-01-05', '2026-01-06']);
check(await rechne('mittlereLaenge', einer) === null,
  'ohne abgeschlossenen Zyklus gibt es keine mittlere Länge – 28 wird nicht unterstellt');
check(await rechne('phaseVon', einer, '2026-01-12') === null,
  'und damit auch keine Phase außerhalb der Periode');
check(await rechne('phaseVon', einer, '2026-01-05') === 'menstruation',
  'die Periode selbst steht trotzdem fest – sie ist eingetragen und nicht geschätzt');
check(await rechne('belastbar', einer) === false, 'ein Zyklus ist nicht belastbar');
check(await rechne('belastbar', zwei) === true, 'zwei abgeschlossene sind die Untergrenze');
check((await rechne('zyklen', {})).length === 0, 'ohne Eintragungen keine Zyklen');

/* ---------- In der App ---------- */

const eintraege = [];
Object.keys(zwei).forEach((iso, i) => {
  eintraege.push({ id: `b${i}`, am: iso, um: '10:00', art: 'beschwerde', staerke: 7, arten: ['krampf'] });
});
// Ein paar ruhige Tage in der ersten Zyklushälfte als Gegenprobe.
['2026-02-10', '2026-02-11', '2026-02-12', '2026-02-13'].forEach((iso, i) => {
  eintraege.push({ id: `e${i}`, am: iso, um: '12:00', art: 'essen', was: 'Essen', portion: 'normal', zutaten: [] });
});

await page.evaluate(([k, s]) => localStorage.setItem(k, JSON.stringify(s)),
  [KEY, { eintraege, tage: zwei, begruesst: true, tab: 'muster' }]);
await page.reload({ waitUntil: 'networkidle' });

const text = await page.locator('#view').textContent();
check(text.includes('Nach Zyklusphase'), 'die Auswertung nach Phase steht im Reiter Muster');
check(text.includes('Periode'), 'mit der Periode als Phase');
check(text.includes('Zyklen dauern im Mittel 29 Tage'), 'und der mittleren Zykluslänge');
check(
  text.includes('Nicht zur Verhütung geeignet'),
  'der Satz zur Verhütung steht dabei, und zwar nicht im Kleingedruckten am Ende',
);
check(
  !/nächste (Periode|Blutung)|voraussichtlich|Eisprung am/i.test(text),
  'nirgends eine Vorhersage',
);

await page.locator('[data-act="tab"][data-tab="heute"]').click();
await page.waitForTimeout(250);
check(
  await page.locator('[data-act="tagfrage"][data-id="blutung"]').count() === 5,
  'die Periode lässt sich in der Tagesansicht in fünf Stufen eintragen',
);

check(fehler.length === 0, `keine Fehler${fehler.length ? `: ${fehler.join(' | ')}` : ''}`);
await browser.close();
ende();
