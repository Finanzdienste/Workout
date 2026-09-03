/*
 * Die Übersicht „Was die Mittel bewirken".
 *
 * Zwei Dinge werden geprüft, und das zweite ist das wichtigere.
 *
 * Erstens die Zuordnung: Eingetragen wird frei Text – „Pantoprazol 20mg",
 * „pantoprazol", „Riopan". Findet die App die passende Gruppe nicht, steht bei
 * ihrem eigenen Mittel nichts, und die Übersicht ist genau für den wertlos,
 * der sie braucht.
 *
 * Zweitens der Ton. Dieser Text handelt von Medikamenten, und er darf keine
 * Dosierung nennen und keine Empfehlung aussprechen – dafür ist die Apotheke
 * da und nicht ein Tagebuch. Das steht nicht nur im Kommentar von
 * js/mittel.js, sondern wird hier nachgezählt.
 */
import { chromium } from 'playwright';
import { URL, KEY, HANDY, SHOT, vorTagen, pruefer } from './umgebung.mjs';

const { check, ende } = pruefer();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: HANDY });
const fehler = [];
page.on('pageerror', (e) => fehler.push(`PAGEERROR: ${e.message}`));

const eintraege = [
  { id: 'm1', am: vorTagen(2), um: '07:00', art: 'medikament', mittel: 'Pantoprazol 20mg', dosis: '' },
  { id: 'm2', am: vorTagen(1), um: '07:00', art: 'medikament', mittel: 'Pantoprazol 20mg', dosis: '' },
  { id: 'm3', am: vorTagen(1), um: '21:00', art: 'medikament', mittel: 'Riopan', dosis: '' },
  { id: 'm4', am: vorTagen(0), um: '12:00', art: 'medikament', mittel: 'Ibuprofen', dosis: '' },
];

await page.goto(URL, { waitUntil: 'networkidle' });
await page.evaluate(([k, s]) => localStorage.setItem(k, JSON.stringify(s)),
  [KEY, { eintraege, tage: {}, begruesst: true, tab: 'mehr' }]);
await page.reload({ waitUntil: 'networkidle' });

/* ---------- Was eingetragen wurde, steht oben ---------- */

const meine = await page.locator('.wartend').first().textContent();
check(meine.includes('Pantoprazol 20mg'), 'das eigene Mittel steht in der Übersicht');
check(meine.includes('2 Mal'), 'mit der Anzahl der Einnahmen');
check(
  meine.includes('Drosselt die Säurebildung'),
  '„Pantoprazol 20mg" wird trotz angehängter Menge dem PPI zugeordnet',
);
check(
  meine.includes('Neutralisiert die Säure'),
  'ein Handelsname wie Riopan findet ebenfalls seine Gruppe',
);
check(
  meine.includes('gereizte Magenschleimhaut'),
  'und Ibuprofen wird als das ausgewiesen, was den Magen belastet',
);

/* ---------- Die ganze Liste ---------- */

check(await page.locator('.mittel').count() === 0, 'die volle Liste steht nicht ungefragt da');
await page.locator('[data-act="mittel"]').click();
await page.waitForTimeout(250);
const gruppen = await page.locator('.mittel').count();
check(gruppen === 11, `elf Gruppen, neun Mittel und zwei Reizstoffe (${gruppen})`);

const ppi = page.locator('.mittel').first();
await ppi.locator('summary').click();
await page.waitForTimeout(150);
const text = await ppi.textContent();
check(text.includes('Wie es wirkt'), 'jede Gruppe erklärt, wie sie wirkt');
check(text.includes('Wann man es nimmt'), 'und wann man sie nimmt');
check(text.includes('Worauf zu achten ist'), 'und worauf zu achten ist');
check(
  text.includes('nicht von einem Tag auf den anderen'),
  'beim PPI steht der Hinweis zum Absetzen – das ist der Punkt, der Ärger macht',
);

await page.screenshot({ path: `${SHOT}/70-mittel.png` });

/* ---------- Der Ton: keine Dosierung, keine Empfehlung ---------- */

const ganz = await page.locator('#view').textContent();
check(
  ganz.includes('keine Beratung'),
  'die Übersicht sagt von sich, dass sie keine Beratung ist',
);
check(
  ganz.includes('Apotheke'),
  'und verweist auf Ärztin oder Apotheke',
);
const dosis = ganz.match(/\d+\s?(mg|ml|µg|Gramm|Tabletten)\b/g) || [];
// "Pantoprazol 20mg" ist die Eintragung des Nutzers, nicht der Text der App.
const eigene = dosis.filter((d) => !'Pantoprazol 20mg'.includes(d));
check(
  eigene.length === 0,
  `nirgends eine Dosierung${eigene.length ? `: ${eigene.join(', ')}` : ''}`,
);
const raten = ganz.match(/\b(nimm|nehmen Sie|empfehlen|empfohlen|du solltest)\b/gi) || [];
check(
  raten.length === 0,
  `kein Satz, der etwas empfiehlt${raten.length ? `: ${raten.join(', ')}` : ''}`,
);

/* ---------- Beim Eintragen steht es gleich dabei ---------- */

await page.locator('[data-act="tab"][data-tab="heute"]').click();
await page.waitForTimeout(200);
await page.locator('[data-act="neu"][data-art="medikament"]').click();
await page.waitForTimeout(200);
check(
  await page.locator('.mittel-hinweis').count() === 0,
  'ohne Eingabe steht im Bogen kein Hinweis',
);
await page.locator('.marke[data-id="Iberogast"]').click();
await page.waitForTimeout(250);
check(
  (await page.locator('.mittel-hinweis').textContent()).includes('Pflanzliche Mittel'),
  'ein gewähltes Mittel bringt seine Gruppe gleich mit',
);

check(fehler.length === 0, `keine Fehler${fehler.length ? `: ${fehler.join(' | ')}` : ''}`);
await browser.close();
ende();
