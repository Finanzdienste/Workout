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
// Gewollt geändert (Durchsicht B23): Ab der zweiten Dosis muss „Auf
// Anweisung der Praxis?" beantwortet sein – offen gelassen galt still als
// „unbekannt", und davon hängen die Hinweise B2 und X3 ab.
await page.click('button[type=submit]');
check((await page.locator('[data-feld="praxis"] .feld-fehler').count()) === 1, 'ohne Angabe zur Praxis wird nicht gespeichert – das Feld sagt warum');
await page.check('input[name=praxis][value=ja]');
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

// Gewollt geändert (Durchsicht B47): „Heute" hat keine eigene Erinnerung
// „vor N Wochen geändert" mehr. Sie kam auch ohne bestätigte Behandlung (P6)
// und ohne den Text vor der Blutabnahme, und neben D6c stand sie doppelt. Die
// Kontrolle nach einer Dosisänderung meldet allein D6c (js/dosis.js) – nur
// mit P6, ohne Geburtsjahr nach 8 Wochen (wie D0.6).
await uhr(plus(montag, 35), '06:00');
await page.click('#reiter-heute');
text = await ansichtText(page);
check(!text.includes('Wochen geändert') && !text.includes('Kontrolle fällig'), 'ohne bestätigte Behandlung (P6): keine Erinnerung an die Kontrolle');
await page.evaluate((key) => {
  const st = JSON.parse(localStorage.getItem(key));
  st.profil.behandelt = true;
  localStorage.setItem(key, JSON.stringify(st));
}, 'schilddruese.stand.v1');
await uhr(plus(montag, 56), '06:00');
await page.click('#reiter-heute');
const d6c = page.locator('#ansicht [data-regel="D6c"]');
check(await d6c.count() === 1 && (await d6c.innerText()).includes('Jetzt ist die Kontrolle fällig') && (await d6c.innerText()).includes('Vor der Blutabnahme'),
  'mit P6, acht Wochen nach der Änderung: Hinweis auf die Kontrolle, mit dem, was vor der Blutabnahme gilt');
check(!/erhöh|senk|zu hoch|zu niedrig/i.test(await d6c.innerText()), '… ohne jede Aussage über die Dosis selbst');

// Mit einem Laborwert nach der Änderung verschwindet er.
// Geändert in Runde 7 (H16): Kontrollbefund erst nach der Einpendelzeit (ohne
// Geburtsjahr 8 Wochen, also Tag 56). Ein Wert vom Tag 55 ist noch nicht
// eingependelt – die Dosis-Karte verwirft ihn selbst (D0.6), und die Kontrolle
// bleibt deshalb zu Recht fällig.
await page.evaluate(({ key, datum }) => {
  const st = JSON.parse(localStorage.getItem(key));
  st.labor.push({ id: 'l9', datum, tsh: { wert: 2, einheit: 'mU/l', von: 0.4, bis: 4 }, ft4: null, ft3: null, notiz: '' });
  localStorage.setItem(key, JSON.stringify(st));
}, { key: 'schilddruese.stand.v1', datum: plus(montag, 56) });
await uhr(plus(montag, 56), '06:00');
await page.click('#reiter-heute');
check(await page.locator('#ansicht [data-regel="D6c"]').count() === 0, 'ist danach ein Laborwert eingetragen, verschwindet der Hinweis');

// Zwölf Wochen nach der Änderung ohne Labor: kein täglicher Hinweis mehr.
await page.evaluate((key) => {
  const st = JSON.parse(localStorage.getItem(key));
  st.labor = [];
  localStorage.setItem(key, JSON.stringify(st));
}, 'schilddruese.stand.v1');
await uhr(plus(montag, 85), '06:00');
await page.click('#reiter-heute');
check(await page.locator('#ansicht [data-regel="D6c"]').count() === 0, 'nach zwölf Wochen drängt der Hinweis nicht mehr täglich');

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

// Runde 8 (K1): Eine eigene Änderung im Voraus („ab Montag 125 statt 75",
// Praxis: Nein) zählt schon vor dem Starttag: „Heute" nennt X3 mit 112 als
// Anruf, die Dosis-Karte wartet (Tage). Vorher sank die Karte bis zum Starttag
// auf „Beim nächsten Termin", und „Heute" schwieg zur geplanten Verdopplung.
await page.waitForTimeout(400);   // ein ausstehendes Speichern der App abwarten, sonst überschreibt es den Stand
await page.evaluate(({ key, tag, befund }) => {
  const st = JSON.parse(localStorage.getItem(key));
  st.profil = { ...st.profil, behandelt: true, geburtsjahr: 1966, herz: 'nein', krebs: 'nein', kortison: 'nein', ursache: 'hashimoto', praeparatArt: 't4', zielNiedrig: 'nein', hypophyseOderNiedrig: 'nein', diabetes: 'nein', schwanger: 'nein', bundesland: 'BY' };
  st.dosen = [{ id: 'd1', ab: '2025-05-01', praeparat: 'L-Thyroxin', mikrogramm: 75, tabletten: 1, notiz: '', praxis: true }];
  st.labor = [{ id: 'b1', datum: befund, tsh: { wert: 6.0, einheit: 'mU/l', von: 0.4, bis: 4 }, ft4: { wert: 15, einheit: 'pmol/l', von: 12, bis: 22 }, ft3: null, notiz: '',
    abnahmeUhr: '08:00', vorAbnahme: 'nein', tabletteUhr: '', biotin: 'nein', krank: 'nein', kortison: 'nein', kontrastmittel: 'nein', mittelGeaendert: 'nein', einnahmeGeaendert: 'nein',
    packung: 'nein', vergessen: 'nein', einnahmeArt: 'ja', abstandOk: 'ja', verwechselt: 'nein', laborName: '', praxis: 'nochnicht', praxisAm: befund, bestaetigt: false }];
  st.nachfragen = [{ id: 'n1', art: 'dosis_stimmt', bezug: 'b1', antwort: 'ja', am: befund }];
  st.einnahmen = {};
  for (let i = 1; i <= 60; i++) { const d = new Date(`${tag}T12:00:00`); d.setDate(d.getDate() - i); st.einnahmen[d.toISOString().slice(0, 10)] = { uhr: '07:00' }; }
  localStorage.setItem(key, JSON.stringify(st));
}, { key: 'schilddruese.stand.v1', tag: TAG, befund: plus(TAG, -10) });
await uhr(TAG, '06:00');
await page.click('#reiter-verlauf');
await page.click('[data-seite="dosis"]');
await page.fill('input[name=mikrogramm]', '125');
await page.fill('input[name=ab]', montag);
await page.check('input[name=praxis][value=nein]');
await page.click('button[type=submit]');
await page.waitForTimeout(900);
// „mehr als die Hälfte": Ja, stimmt.
if (await page.locator('dialog.rueckfrage [data-act="befund-bestaetigen"]').count()) await page.click('dialog.rueckfrage [data-act="befund-bestaetigen"]');
await page.waitForTimeout(500);
s = await gespeichert();
check(s.dosen.length === 2 && s.dosen[1].mikrogramm === 125 && s.dosen[1].ab === montag && s.dosen[1].praxis === false, 'Runde 8 (K1): die geplante eigene Änderung ist gespeichert');
await page.click('#reiter-heute');
const x3 = page.locator('#ansicht [data-regel="X3"]');
const x3Text = (await x3.count()) ? (await x3.first().innerText()).replace(/\s+/g, ' ') : '';
check(/ohne Anweisung der Praxis ändern/.test(x3Text) && /bevor Sie damit beginnen/.test(x3Text) && await x3.first().locator('a[href="tel:112"]').count() === 1,
  `Runde 8 (K1): „Heute" nennt die geplante eigene Änderung schon vor Montag, mit 112 als Anruf („${x3Text.slice(0, 120)}")`);
await page.click('#reiter-mehr');
// Nach dem Reiterwechsel sperrt die App 0,6 s lang den nächsten Tipp (Entscheidung Runde 5).
await page.waitForTimeout(700);
await page.locator('#ansicht [data-seite="dosis-karte"]').first().click();
const karte = page.locator('#dosis-karte');
await karte.waitFor({ timeout: 10000 });
check(await karte.getAttribute('data-stufe') === 'tage' && /bevor Sie damit beginnen/.test(await karte.innerText()),
  `Runde 8 (K1): die Dosis-Karte wartet (Tage) und rät, vor dem Beginn anzurufen (${await karte.getAttribute('data-stufe')})`);

await ende();
