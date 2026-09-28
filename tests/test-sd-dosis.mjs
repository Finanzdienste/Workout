/*
 * Schilddrüse: Dosis ändern, auch im Voraus.
 *
 * Die Ärztin sagt oft „ab Montag 100 statt 75". Wer das gleich einträgt,
 * darf bis Montag nicht die neue Dosis als die heutige sehen – sonst nimmt
 * man sie womöglich zu früh. Dazu der Hinweis auf die Blutkontrolle nach
 * 6–8 Wochen, und die Einnahmebilanz, die erst ab dem Einrichten zählt.
 */
import { oeffne, standMit, plus, kurz, ansichtText } from './sd-hilfe.mjs';

const TAG = '2026-03-10';   // ein Dienstag
const stand = standMit(plus(TAG, -300), {
  profil: { name: '', begruesst: true, seit: plus(TAG, -3) },
  dosen: [{ id: 'd1', ab: plus(TAG, -300), praeparat: 'L-Thyroxin', mikrogramm: 75, tabletten: 1, notiz: '' }],
  einnahmen: { [plus(TAG, -1)]: { uhr: '07:00' } },
});
const { page, check, uhr, gespeichert, ende } = await oeffne({ tag: TAG, zeit: '06:00', stand });

// Bilanz: seit dem Einrichten vor drei Tagen, nicht seit der ersten Dosis vor 300 Tagen.
await page.click('#reiter-verlauf');
let text = await ansichtText(page);
// Eingerichtet vor drei Tagen, heute noch nichts abgehakt: drei Tage zählen.
check(text.includes('An 1 von 3 Tagen genommen, 2 Tage ohne Eintrag'), `die Bilanz zählt ab dem Einrichten, der heutige Tag erst mit Eintrag (${text.match(/An \d+ von \d+ Tag[^–]*/)?.[0]})`);
check(!(await page.locator('#gestern').count()), 'gestern ist eingetragen – keine Frage');

// Neue Dosis ab Montag.
const montag = plus(TAG, 6);
await page.click('[data-seite="dosis"]');
check((await ansichtText(page)).includes('bleibt im Verlauf'), 'das Formular sagt, dass die bisherige Dosis im Verlauf bleibt');
await page.fill('input[name=mikrogramm]', '100');
await page.fill('input[name=ab]', montag);
await page.click('button[type=submit]');
let s = await gespeichert();
check(s.dosen.length === 2 && s.dosen[1].mikrogramm === 100 && s.dosen[1].ab === montag, 'die neue Dosis ist mit ihrem Datum gespeichert');

await page.click('#reiter-heute');
text = await ansichtText(page);
check(text.includes('L-Thyroxin 75 µg, 1 Tablette am Tag'), 'bis Montag nennt „Heute" weiter 75 µg');
check(text.includes('Ab Montag, 16. März: L-Thyroxin 100 µg'), '… und kündigt die neue Dosis mit Datum an');

await page.click('#reiter-mehr');
await page.click('[data-seite="bericht"]');
text = await page.locator('#berichtText').innerText();
check(text.includes(`Aktuell: L-Thyroxin 75 µg, 1 Tablette am Tag, seit ${kurz(plus(TAG, -300))}`), 'der Bericht nennt als aktuell die heute gültige Dosis');
check(text.includes(`Geplant ab ${kurz(montag)}: L-Thyroxin 100 µg`), '… und die geplante als geplant');

await page.click('#reiter-verlauf');
await page.click('[data-seite="dosis-liste"]');
text = await ansichtText(page);
check(/75 µg, 1 Tablette am Tag · aktuell/.test(text) && /100 µg, 1 Tablette am Tag · geplant/.test(text), 'die Dosisliste markiert „aktuell" und „geplant"');

// Ab Montag gilt die neue.
await uhr(montag, '06:00');
await page.click('#reiter-heute');
text = await ansichtText(page);
check(text.includes('L-Thyroxin 100 µg, 1 Tablette am Tag') && !text.includes('Ab Montag'), 'ab Montag nennt „Heute" 100 µg, ohne Ankündigung');

// Fünf Wochen später: Hinweis auf die Blutkontrolle.
await uhr(plus(montag, 35), '06:00');
await page.click('#reiter-heute');
text = await ansichtText(page);
check(text.includes('vor 5 Wochen geändert') && text.includes('6 bis 8 Wochen'), 'fünf Wochen nach der Änderung: Hinweis auf die übliche Blutkontrolle');
check(!/erhöh|senk|zu hoch|zu niedrig/i.test(text), '… ohne jede Aussage über die Dosis selbst');

// Mit einem Laborwert nach der Änderung verschwindet er.
await page.evaluate(({ key, datum }) => {
  const st = JSON.parse(localStorage.getItem(key));
  st.labor.push({ id: 'l9', datum, tsh: { wert: 2, einheit: 'mU/l', von: 0.4, bis: 4 }, ft4: null, ft3: null, notiz: '' });
  localStorage.setItem(key, JSON.stringify(st));
}, { key: 'schilddruese.stand.v1', datum: plus(montag, 34) });
await uhr(plus(montag, 35), '06:00');
await page.click('#reiter-heute');
check(!(await ansichtText(page)).includes('6 bis 8 Wochen'), 'ist danach ein Laborwert eingetragen, verschwindet der Hinweis');

// Neun Wochen nach der Änderung ohne Labor: kein Dauerhinweis mehr.
await page.evaluate((key) => {
  const st = JSON.parse(localStorage.getItem(key));
  st.labor = [];
  localStorage.setItem(key, JSON.stringify(st));
}, 'schilddruese.stand.v1');
await uhr(plus(montag, 75), '06:00');
await page.click('#reiter-heute');
check(!(await ansichtText(page)).includes('6 bis 8 Wochen'), 'nach zehn Wochen drängt der Hinweis nicht mehr');

s = await gespeichert();
check(s.profil.seit === plus(TAG, -3), 'der Einrichtungstag bleibt beim Speichern erhalten');

// Stärke beim Einrichten leer gelassen: „Heute" erinnert daran, bis sie da ist.
await page.evaluate((key) => {
  const st = JSON.parse(localStorage.getItem(key));
  st.dosen = [{ id: 'dx', ab: '2026-01-01', praeparat: 'L-Thyroxin', mikrogramm: null, tabletten: 1, notiz: '' }];
  localStorage.setItem(key, JSON.stringify(st));
}, 'schilddruese.stand.v1');
await uhr(TAG, '06:00');
await page.click('#reiter-heute');
text = await ansichtText(page);
check(text.includes('Die Stärke der Tablette fehlt noch') && text.includes('Stärke noch nicht eingetragen'), 'ohne Stärke: Hinweis auf „Heute", und die Dosis sagt es selbst');
await page.click('[data-seite="dosis"][data-param="dx"]');
await page.fill('input[name=mikrogramm]', '75');
await page.click('button[type=submit]');
await page.click('#reiter-heute');
check(!(await ansichtText(page)).includes('fehlt noch'), 'eingetragen: der Hinweis ist weg');

await ende();
