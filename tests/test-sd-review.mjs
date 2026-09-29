/*
 * Schilddrüse: Regressionsfälle aus der Durchsicht der Oberfläche.
 *
 * Jeder Abschnitt stellt einen Befund der Durchsicht nach (die Nummer steht
 * dabei, B39 usw.) – so, wie ihn die Nutzerin erlebt hat: ein Befund über das
 * Formular, danach gleich die Dosis-Karte; die App am nächsten Morgen; Schrift
 * „sehr groß" auf 360 px. Die Regeln selbst prüfen die Tests ohne Browser
 * (tests/test-sd-regeln-*.mjs); hier geht es darum, dass die Oberfläche zeigt
 * und speichert, was der Kern liefert.
 */
import { readFileSync } from 'node:fs';
import { oeffne, standMit, plus, kurz, ansichtText, SCHLUESSEL, SD_URL, uhrStellen } from './sd-hilfe.mjs';

const TAG = '2026-09-27';

const PROFIL = {
  name: '', begruesst: true, behandelt: true, seit: plus(TAG, -400), geburtsjahr: 1948, ursache: 'hashimoto',
  krebs: 'nein', kortison: 'nein', herz: 'ja', osteoporose: 'nein', praeparatArt: 't4', bundesland: 'NW',
};
/** Alle Fragen zur Blutabnahme beantwortet – offen bleibt nur, was ein Fall braucht. */
const FRAGEN = {
  vorAbnahme: 'nein', biotin: 'nein', krank: 'nein', kortison: 'nein', kontrastmittel: 'nein', mittelGeaendert: 'nein',
  einnahmeGeaendert: 'nein', packung: 'nein', vergessen: 'nein', einnahmeArt: 'ja', abstandOk: '', verwechselt: '', praxis: 'nochnicht', praxisAm: plus(TAG, -1),
};
const w = (wert, einheit, von = null, bis = null, unter = false) => ({ wert, einheit, von, bis, unter });
const befund = (id, datum, werte, fragen = {}) => ({ id, datum, notiz: '', tsh: null, ft4: null, ft3: null, ...werte, ...FRAGEN, ...fragen });
function stand({ profil = {}, ...mehr } = {}) {
  return standMit(plus(TAG, -400), {
    version: 2,
    profil: { ...PROFIL, ...profil },
    einstellungen: { erinnerung: '07:00', schrift: 'gross', farbe: 'hell', hinweisTablette: false },
    nachfragen: [],
    warnzeichen: [],
    mittel: [],
    ...mehr,
  });
}

// Der erste Stand hat „Mehr" als zuletzt benutzten Reiter gespeichert (B64).
const { browser, ctx, page, check, gespeichert, ende, dialog: browserDialog, dialoge } = await oeffne({
  viewport: { width: 360, height: 740 }, tag: TAG, zeit: '09:00', stand: { ...stand(), tab: 'mehr' },
});

/** Einen Stand laden – mit fester Uhr – und neu öffnen. */
async function laden(st, { tag = TAG, zeit = '09:00' } = {}) {
  await page.waitForTimeout(200);   // ein ausstehendes Speichern abwarten
  await page.evaluate(({ key, s, t, z }) => {
    localStorage.setItem(key, JSON.stringify(s));
    localStorage.setItem('__testtag', t);
    localStorage.setItem('__testzeit', z);
  }, { key: SCHLUESSEL, s: st, t: tag, z: zeit });
  await page.reload({ waitUntil: 'networkidle' });
}
const mehrSeite = async (name) => {
  await page.click('#reiter-mehr');
  await page.locator(`#ansicht [data-seite="${name}"]`).first().click();
};
/** Die Fragen der Dosis-Karte beantworten, bis keine mehr kommt. → Reihenfolge der Fragen. */
async function kartenFragen(wahl) {
  const folge = [];
  for (let i = 0; i < 20; i++) {
    const frage = page.locator('#dosis-karte .dosis-frage');
    if (!(await frage.count())) break;
    const id = await frage.getAttribute('data-frage');
    folge.push(id);
    if (!(await frage.locator('[data-act="frage-antwort"]').count())) break;
    // X3 „Nein" heißt jetzt „nein_75" – deshalb der Anfang des Werts.
    const gewuenscht = frage.locator(`[data-act="frage-antwort"][data-wert^="${wahl[id] || 'nein'}"]`);
    const knopf = (await gewuenscht.count()) ? gewuenscht.first() : frage.locator('[data-act="frage-antwort"]').last();
    await knopf.click();
    if (folge.filter((x) => x === id).length > 2) break;
  }
  return folge;
}
const unterDemKopf = (sel) => page.evaluate((s) => {
  const el = document.querySelector(s);
  const kopf = document.querySelector('.kopf').getBoundingClientRect();
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { oben: Math.round(r.top), kopf: Math.round(kopf.bottom), sichtbar: r.top >= kopf.bottom - 1 && r.bottom <= window.innerHeight };
}, sel);

// ---------------------------------------------------------------- B64

check(await page.locator('#reiter-heute').getAttribute('aria-selected') === 'true' && await page.locator('#ansicht .notfall-leiste').count() === 1,
  'B64: mit „Mehr" als zuletzt benutztem Reiter öffnet die App trotzdem auf „Heute" – mit Notfallleiste');
await page.click('#reiter-verlauf');
await page.reload({ waitUntil: 'networkidle' });
check(await page.locator('#reiter-verlauf').getAttribute('aria-selected') === 'true', 'B64: am selben Tag neu geladen (etwa nach einem Update) bleibt der Reiter');
await page.evaluate((t) => localStorage.setItem('__testtag', t), plus(TAG, 1));
await page.reload({ waitUntil: 'networkidle' });
check(await page.locator('#reiter-heute').getAttribute('aria-selected') === 'true' && await page.locator('#ansicht .tablette').count() === 1,
  'B64: am nächsten Tag wieder „Heute" mit dem Tabletten-Knopf');

// ---------------------------------------------------------------- B39, B50, B58, B42, B60

// Befund über das Formular, danach gleich die Dosis-Karte – in derselben Sitzung.
await laden(stand());
await page.click('#reiter-verlauf');
await page.click('#ansicht [data-seite="labor"]');
await page.fill('input[name=datum]', plus(TAG, -3));
await page.fill('input[name=tsh_wert]', '0,05');
await page.fill('input[name=tsh_von]', '0,4');
await page.fill('input[name=tsh_bis]', '4,0');
await page.fill('input[name=ft4_wert]', '24');
await page.fill('input[name=ft4_von]', '12');
await page.fill('input[name=ft4_bis]', '22');
for (const [feld, wert] of Object.entries({
  vorAbnahme: 'nein', biotin: 'nein', krank: 'nein', kortison: 'nein', kontrastmittel: 'nein', mittelGeaendert: 'nein', einnahmeGeaendert: 'nein', packung: 'nein', vergessen: 'nein', einnahmeArt: 'ja', praxis: 'nochnicht',
})) await page.check(`input[name=${feld}][value=${wert}]`);
await page.click('form[data-formular="labor"] button[type=submit]');
if (await page.locator('dialog.rueckfrage').count()) await page.click('[data-act="befund-bestaetigen"]');
let s = await gespeichert();
const neu = s.labor.find((l) => l.datum === plus(TAG, -3));
check(neu && neu.verwechselt === '', `B39: ein neuer Befund hat das Feld für Q5 von Anfang an (verwechselt = ${JSON.stringify(neu && neu.verwechselt)})`);
await mehrSeite('dosis-karte');
const folge = await kartenFragen({ X3: 'ja', Q5: 'einmal' });
console.log(`     Fragen: ${folge.join(' → ')}`);
check(folge.filter((x) => x === 'Q5').length === 1, `B39/B58: Q5 kommt genau einmal, nicht im Kreis (${folge.join(' → ')})`);
s = await gespeichert();
check(s.labor.find((l) => l.id === neu.id).verwechselt === 'einmal', 'B50: „einmal viele Tabletten auf einmal" ist am Befund gespeichert');
const karte = page.locator('#dosis-karte');
check(await karte.getAttribute('data-stufe') === 'heute', `B58: die Karte steht danach auf „Heute anrufen" (${await karte.getAttribute('data-stufe')})`);
const q5 = karte.locator('li[data-grund="Q5"]');
check(await q5.count() === 1 && (await q5.innerText()).includes('Giftnotruf'), 'B58: der Grund Q5 nennt den Giftnotruf');
check(await q5.locator('a[href="tel:022819240"]').count() === 1 && await q5.locator('a[href="tel:112"]').count() === 1,
  'B42/B67: unter Q5 der Giftnotruf fürs Bundesland (NRW 0228 19240) und 112 als Anruf-Knöpfe');
const lage = await unterDemKopf('#dosis-karte .stufe-schild');
check(lage && lage.sichtbar, `B60: nach der letzten Antwort steht das Stufen-Schild sichtbar unter dem Kopf (oben ${lage && lage.oben}, Kopf bis ${lage && lage.kopf})`);
check(!(await page.locator('#meldung.zeigen').count()) || !(await page.locator('#meldung').innerText()).includes('Antwort gespeichert'),
  'B60: auf der Dosis-Karte deckt keine Meldung den Pflichttext ab – die Karte zeigt die Antwort selbst');
// Eine Antwort, die sich nicht speichern lässt, meldet das – statt „gespeichert".
await page.evaluate(() => {
  const b = document.createElement('button');
  b.dataset.act = 'frage-antwort'; b.dataset.ziel = 'befund'; b.dataset.feld = 'gibtEsNicht'; b.dataset.bezug = 'x'; b.dataset.wert = 'ja';
  b.id = 'kaputt'; b.textContent = 'x';
  document.getElementById('ansicht').appendChild(b);
});
await page.click('#kaputt');
check((await page.locator('#meldung').innerText()).includes('nicht speichern'), 'B50: eine Antwort, die nicht gespeichert wird, sagt das auch');

// ---------------------------------------------------------------- B40, B61, B9: dieselbe Stufe überall

await page.click('#reiter-heute');
const verweis = page.locator('#ansicht .einschaetzung-verweis');
check(await verweis.getAttribute('data-stufe') === 'heute', `B40: „Heute" nennt die Stufe der Dosis-Karte „Heute anrufen" (${await verweis.getAttribute('data-stufe')})`);
check(await page.locator('#ansicht .dosis-verweis').count() === 1, 'B40: und verweist auf die Dosis-Karte mit dem wichtigen Hinweis');
await mehrSeite('gesamtbild');
check(await page.locator('#ansicht .stufe-karte').getAttribute('data-stufe') === 'heute', 'B61: das Gesamtbild oben ebenso „Heute anrufen"');
const teilDosis = page.locator('#ansicht .teil-karte[data-regel="dosis"]');
check(await teilDosis.count() === 1 && await teilDosis.locator('a[href="tel:022819240"]').count() === 1,
  'B9/B61: unter „Im Einzelnen" steht die Dosis-Karte mit dem Giftnotruf als Anruf');

// Eigenmächtig von 75 auf 150 µg (B9): „Kein besonderer Anlass" darf nicht oben stehen.
await laden(stand({
  dosen: [{ id: 'd1', ab: plus(TAG, -400), praeparat: 'L-Thyroxin', mikrogramm: 75, tabletten: 1, notiz: '', praxis: null },
    { id: 'd2', ab: plus(TAG, -3), praeparat: 'L-Thyroxin', mikrogramm: 150, tabletten: 1, notiz: '', praxis: false }],
  labor: [befund('b1', plus(TAG, -60), { tsh: w(2, 'mU/l', 0.4, 4) })],
}));
await mehrSeite('gesamtbild');
check(await page.locator('#ansicht .stufe-karte').getAttribute('data-stufe') === 'tage', `B9: nach eigenmächtiger Verdopplung sagt das Gesamtbild „in den nächsten Tagen" (${await page.locator('#ansicht .stufe-karte').getAttribute('data-stufe')})`);
check(await page.locator('#ansicht .teil-karte[data-regel="X3"]').count() === 1, 'B9: … mit dem Hinweis X3 unter „Im Einzelnen"');
await page.click('#reiter-heute');
const x3 = page.locator('#ansicht [data-regel="X3"]');
check(await x3.count() === 1 && await x3.locator('a[href="tel:112"]').count() === 1, 'B9: „Heute" zeigt X3 einmal – die 112 aus den Warnzeichen als Anruf');

// Dieselbe Kontrolle nicht doppelt (B37): Nach drei Monaten meldet D6c sie
// mit „ein bis zwei Wochen" – L7d aus dem Kern fällt dann weg, auch auf „Heute".
await laden(stand({
  dosen: [{ id: 'd1', ab: plus(TAG, -400), praeparat: 'L-Thyroxin', mikrogramm: 75, tabletten: 1, notiz: '', praxis: null },
    { id: 'd2', ab: plus(TAG, -98), praeparat: 'L-Thyroxin', mikrogramm: 88, tabletten: 1, notiz: '', praxis: true }],
  labor: [befund('b1', plus(TAG, -120), { tsh: w(12, 'mU/l', 0.4, 4) })],
}));
await page.click('#reiter-heute');
check(await page.locator('#ansicht [data-regel="D6c"]').count() === 1 && await page.locator('#ansicht [data-regel="L7d"]').count() === 0,
  'B37: „Heute" erinnert einmal an die Kontrolle (D6c), nicht zusätzlich mit L7d');

// ---------------------------------------------------------------- B27, B46: F8 „Die Dosis wird geändert"

await laden(stand({
  mittel: ['marcumar'],
  labor: [befund('b1', plus(TAG, -5), { tsh: w(7.5, 'mU/l', 0.4, 4) }, { praxis: '', praxisAm: null })],
}));
await mehrSeite('dosis-karte');
check(await page.locator('#dosis-karte .dosis-frage').getAttribute('data-frage') === 'F8', 'die Karte fragt zuerst F8');
await page.click('#dosis-karte [data-act="frage-antwort"][data-wert="geaendert"]');
check(await page.locator('form[data-formular="dosis"]').count() === 1, 'B27/B46: „Ja: Die Dosis wird geändert" öffnet gleich das Dosis-Formular');
check(await page.isChecked('input[name=praxis][value=ja]'), '… mit „auf Anweisung der Praxis: ja"');
check(!(await page.locator('#meldung').innerText()).includes('erinnert Sie an die Kontrolle')
  || (await page.locator('#meldung').innerText()).includes('neue Dosis ein'), '… und die Meldung verspricht keine Kontrolle, die es ohne Dosis nicht gibt');
await page.click('form[data-formular="dosis"] [data-act="zurueck"]');
// Runde 4: E1 – „Abbrechen" ohne Dosis fragt jetzt, ob die Praxis schon
// geändert hat. B27 prüft den Fall, dass sie es hat und die Dosis später
// nachgetragen wird: „Ja – ich trage sie später ein".
if (await page.locator('dialog.rueckfrage[data-frage="praxis"]').count()) await page.click('dialog.rueckfrage[data-frage="praxis"] [data-act="auswahl"][data-wert="spaeter"]');
const aktionKnopf = page.locator('#dosis-karte [data-act="seite"][data-seite="dosis"]');
check(await aktionKnopf.getAttribute('data-param') === 'praxis' && (await aktionKnopf.innerText()).includes('Neue Dosis eintragen'),
  'B27: abgebrochen – die Karte bietet „Neue Dosis eintragen" (Quelle Praxis)');
check(await page.locator('#ansicht .hinweis-karte.ok').count() === 0, 'B27: ohne neue Dosis keine Bestätigung „… erinnert Sie an die Kontrolle"');
await aktionKnopf.click();
await page.fill('input[name=mikrogramm]', '88');
await page.click('form[data-formular="dosis"] button[type=submit]');
check(await page.locator('#dosis-karte').count() === 1, 'B27: nach dem Speichern geht es zurück zur Dosis-Karte');
check(await page.locator('#ansicht .hinweis-karte.ok').count() === 1, '… jetzt mit der Bestätigung');
await page.click('#reiter-heute');
check(await page.locator('#ansicht [data-regel="WW1"]').count() === 1, 'B46: mit Marcumar erinnert „Heute" an den INR-Wert (WW1)');

// ---------------------------------------------------------------- B26, B63, B23: „Nein, ich nehme etwas anderes"

await laden(stand({
  labor: [befund('b1', plus(TAG, -5), { tsh: w(5.8, 'mU/l', 0.4, 4) })],
  // Eine Antwort aus einer früheren Fassung: „nein" ohne Menge.
  nachfragen: [{ id: 'n1', art: 'dosis_stimmt', bezug: 'b1', antwort: 'nein', am: plus(TAG, -1) }],
}));
await mehrSeite('dosis-karte');
check(await page.locator('#dosis-karte li[data-grund="X3"]').count() === 1, 'X3: „Sie nehmen im Moment etwas anderes …"');
await page.click('#dosis-karte [data-act="seite"][data-seite="dosis"]');
await page.fill('input[name=mikrogramm]', '100');
await page.fill('input[name=ab]', plus(TAG, -100));
await page.click('form[data-formular="dosis"] button[type=submit]');
check((await page.locator('[data-feld="praxis"] .feld-fehler').count()) === 1, 'B23: ab der zweiten Dosis muss „Auf Anweisung der Praxis?" beantwortet sein');
check((await gespeichert()).dosen.length === 1, '… vorher wird nichts gespeichert');
await page.check('input[name=praxis][value=ja]');
await page.click('form[data-formular="dosis"] button[type=submit]');
s = await gespeichert();
check(!s.nachfragen.some((n) => n.art === 'dosis_stimmt'), 'B26/B63: mit der eingetragenen Dosis fällt die Antwort „nein" weg');
const x3frage = page.locator('#dosis-karte .dosis-frage[data-frage="X3"]');
check(await x3frage.count() === 1 && (await x3frage.innerText()).includes('100 µg'), 'B63: die Karte fragt jetzt mit der neuen Dosis (100 µg) – statt für immer zu sperren');
check(await page.locator('#dosis-karte li[data-grund="X3"]').count() === 0, '… und der alte Grund X3 ist weg');

// ---------------------------------------------------------------- B59, B32: „Seit wann? heute lassen"

await laden(stand({
  dosen: [{ id: 'dh', ab: TAG, praeparat: 'L-Thyroxin', mikrogramm: 75, tabletten: 1, notiz: '', praxis: null }],
  labor: [befund('b1', plus(TAG, -3), { tsh: w(0.08, 'mU/l', 0.27, 4.2), ft4: w(19, 'pmol/l', 12, 22) })],
}));
await mehrSeite('dosis-karte');
const aendern = page.locator('#dosis-karte [data-act="seite"][data-seite="dosis"]');
check(await aendern.getAttribute('data-param') === 'dh' && (await aendern.innerText()).includes('Dosis ändern'),
  'B32/B59: die Dosis beginnt erst nach der Abnahme – der Knopf ändert den vorhandenen Eintrag, statt einen zweiten anzulegen');
await page.click('#reiter-verlauf');
await page.click('#ansicht [data-seite="dosis"]');
await page.fill('input[name=mikrogramm]', '75');
await page.fill('input[name=ab]', plus(TAG, -700));
await page.check('input[name=praxis][value=ja]');
await page.click('form[data-formular="dosis"] button[type=submit]');
const fehlerAb = page.locator('form[data-formular="dosis"] .feld-fehler');
check(await fehlerAb.count() === 1 && (await fehlerAb.innerText()).includes('schon ab'), 'B59: dieselbe Dosis noch einmal mit früherem Beginn: die App bietet an, den Beginn zu ändern');
check(await fehlerAb.locator('[data-seite="dosis"][data-param="dh"]').count() === 1, '… mit einem Knopf zum vorhandenen Eintrag');
check((await gespeichert()).dosen.length === 1, '… und legt keine Scheinänderung an');

// ---------------------------------------------------------------- B2: Befund nur mit fT4

await laden(stand({
  labor: [befund('b1', plus(TAG, -200), { tsh: w(2, 'mU/l', 0.4, 4), ft4: w(15, 'pmol/l', 12, 22) }),
    befund('b2', plus(TAG, -7), { ft4: w(5, 'pmol/l', 12, 22) })],
}));
await page.click('#reiter-verlauf');
const nurFt4 = page.locator('#ansicht .befund[data-befund="b2"] .einschaetzung');
check(await nurFt4.count() === 1 && await nurFt4.getAttribute('data-stufe') === 'tage', 'B2: ein Befund nur mit fT4 5 pmol/l zeigt seine Einschätzung – „in den nächsten Tagen"');
check(await nurFt4.locator('.notfall-satz a[href="tel:112"]').count() === 1, 'B2: … mit dem 112-Satz und Anruf-Knopf');
await mehrSeite('gesamtbild');
check(await page.locator('#ansicht .stufe-karte').getAttribute('data-stufe') === 'tage', 'B2: das Gesamtbild übergeht den neueren Befund nicht');
check(await page.locator('#ansicht .teil-karte[data-regel="befund-ohne-tsh"]').count() === 1, 'B2: … er steht unter „Im Einzelnen"');
await page.click('#reiter-heute');
check(await page.locator('#ansicht .einschaetzung-verweis').getAttribute('data-stufe') === 'tage', 'B2: „Heute" nennt dieselbe Stufe');

// ---------------------------------------------------------------- B44: weitere Werte

await laden(stand({
  labor: [befund('b1', plus(TAG, -5), { tsh: w(2.1, 'mU/l', 0.4, 4), vitd: w(120, 'ng/ml', 30, 100), hb: w(9.5, 'g/dl', 12, 16) })],
}));
await mehrSeite('gesamtbild');
check(await page.locator('#ansicht .stufe-karte').getAttribute('data-stufe') === 'tage', 'B44: Vitamin D 120 ng/ml: oben „in den nächsten Tagen", nicht „Kein besonderer Anlass"');
check(await page.locator('#ansicht .teil-karte[data-regel="E13-vitd"]').count() === 1 && await page.locator('#ansicht .teil-karte[data-regel="E13-hb"]').count() === 1,
  'B44: Vitamin D und Hämoglobin stehen mit ihrer Stufe unter „Im Einzelnen"');
check(await page.locator('#ansicht .weitere-werte .stufe-schild').count() === 2, 'B44: beim Befund trägt jeder auffällige weitere Wert sein Stufen-Schild');
await page.click('#reiter-heute');
check(await page.locator('#ansicht .einschaetzung-verweis').getAttribute('data-stufe') === 'tage', 'B44: „Heute" verweist mit derselben Stufe');

// ---------------------------------------------------------------- B1: „ungewollt abgenommen"

await laden(stand({ labor: [befund('b1', plus(TAG, -20), { tsh: w(2, 'mU/l', 0.4, 4) })] }));
await page.click('#reiter-heute');
await page.click('[data-act="befinden"][data-stufe="mittel"]');
await page.click('#befinden [data-seite="befinden"]');
await page.check('input[name=beschwerden][value=abnahme]');
await page.click('form[data-formular="befinden"] button[type=submit]');
const w2t = page.locator('#ansicht [data-regel="W2t"]');
check(await w2t.count() === 1 && (await w2t.innerText()).includes('in den nächsten Tagen'), 'B1: nach dem Befinden mit „ungewollt abgenommen" der Hinweis W2t');
check(await w2t.locator('a[href="tel:116117"]').count() === 1, 'B1: … mit 116 117 als Anruf');
await page.click('#reiter-heute');
check(await page.locator('#ansicht [data-regel="W2t"]').count() === 1, 'B1: auch „Heute" zeigt W2t');
// B60: „… JETZT" im Befinden springt zum 112-Text – der erste Satz liegt nicht unter dem Kopf.
await page.click('#befinden [data-seite="befinden"]');
await page.click('[data-act="notfall-jetzt"]');
const jetzt = await unterDemKopf('#notfall-jetzt .gross');
check(jetzt && jetzt.oben >= jetzt.kopf, `B60: nach „JETZT" steht „Bitte rufen Sie jetzt 112 an" sichtbar unter dem Kopf (oben ${jetzt && jetzt.oben}, Kopf bis ${jetzt && jetzt.kopf})`);

// Herzklopfen an zwei Tagen bei niedrigem TSH (S4ii „heute"): Der Text nennt
// jetzt auch 116 117 – dann ist die Nummer auch anrufbar, nicht nur 112.
await laden(stand({
  labor: [befund('b1', plus(TAG, -10), { tsh: w(0.05, 'mU/l', 0.4, 4), ft4: w(24, 'pmol/l', 12, 22) })],
  befinden: [{ id: 'h1', datum: plus(TAG, -1), stufe: 'mittel', beschwerden: ['herz'], notiz: '' }, { id: 'h2', datum: TAG, stufe: 'mittel', beschwerden: ['herz'], notiz: '' }],
}));
await page.click('#reiter-heute');
const s4ii = page.locator('#ansicht [data-regel="S4ii"]');
check(await s4ii.locator('a[href="tel:116117"]').count() === 1 && await s4ii.locator('a[href="tel:112"]').count() === 1, 'S4ii: 116 117 und 112 aus dem Text als Anruf-Knöpfe');

// ---------------------------------------------------------------- B47: keine eigene Kontroll-Erinnerung ohne P6

await laden(stand({
  profil: { behandelt: false, ursache: '' },
  dosen: [{ id: 'd1', ab: plus(TAG, -400), praeparat: 'L-Thyroxin', mikrogramm: 75, tabletten: 1, notiz: '', praxis: null },
    { id: 'd2', ab: plus(TAG, -30), praeparat: 'L-Thyroxin', mikrogramm: 100, tabletten: 1, notiz: '', praxis: true }],
}));
await page.click('#reiter-heute');
check(!(await ansichtText(page)).includes('Die Dosis wurde vor'), 'B47: ohne bestätigte Behandlung (P6) keine Kontroll-Erinnerung auf „Heute"');

// ---------------------------------------------------------------- B48: W0 ohne Bundesland

await laden(stand({ profil: { bundesland: '' } }));
await page.click('#reiter-heute');
const gift = page.locator('.notfall-leiste .giftnotruf');
check(await gift.locator('a[href="tel:112"]').count() === 1, 'B48: ohne Bundesland steht beim Giftnotruf 112 als Anruf');
check(await gift.locator('[data-seite="profil"]').count() === 1, '… und klein daneben der Weg, das Bundesland einzutragen');

// ---------------------------------------------------------------- B41, B45, B49, B56, B65: der Bericht

await laden(stand({
  profil: { ursache: 'unbekannt', hypophyseOderNiedrig: 'unbekannt' },
  labor: [befund('b1', plus(TAG, -5), {
    tsh: w(0.01, 'mU/l', 0.27, 4.2, true), vitd: w(25, 'ng/ml', 20, null), crp: w(12, 'mg/l', null, 5), bestaetigt: true,
  }, { einnahmeArt: 'nein', abstandOk: 'nein', verwechselt: 'einmal', praxis: 'nachmessen', praxisAm: plus(TAG, -1) })],
}));
await mehrSeite('bericht');
let bericht = await page.locator('#berichtText').innerText();
// Die Zeile unter LABORWERTE beginnt mit dem Datum – der Abschnitt der Einschätzung hat eine eigene.
check(bericht.includes(`${kurz(plus(TAG, -5))}: TSH < 0,01 mU/l (Labor 0,27–4,2)`), 'B49/B56: „< 0,01" steht auch unter LABORWERTE mit dem Zeichen');
check(bericht.includes('Vitamin D (25-OH) 25 ng/ml (Labor ab 20)') && bericht.includes('CRP (Entzündungswert) 12 mg/l (Labor bis 5)'),
  'B49/B56: einseitige Bereiche als „ab 20" und „bis 5" – nicht „20––" oder gar nicht');
check(bericht.includes('nüchtern mit Wasser: nein') && bericht.includes('Abstände eingehalten: nein'), 'B45/B65: Q2 und Q3 stehen im Bericht');
check(bericht.includes('versehentlich mehr genommen: ja, einmal viele Tabletten auf einmal'), 'B45/B65: Q5 „einmal viele Tabletten auf einmal" steht im Bericht');
check(bericht.includes(`Praxis zu diesem Wert: erst nachmessen (angegeben ${kurz(plus(TAG, -1))})`), 'B45/B65: F8 mit Datum steht im Bericht');
check(bericht.includes('Hirnanhangdrüse oder TSH bewusst niedrig (Angabe): weiß nicht'), 'B45: Q4 steht im Profilteil');

// Eine Richtung steht im Bericht genau einmal mit dem Pflichttext (B41).
await laden(stand({
  profil: { geburtsjahr: 1962, herz: 'nein' },
  labor: [befund('b1', plus(TAG, -5), { tsh: w(7.5, 'mU/l', 0.4, 4) })],
  nachfragen: [{ id: 'n1', art: 'dosis_stimmt', bezug: 'b1', antwort: 'ja', am: plus(TAG, -1) }],
}));
await mehrSeite('dosis-karte');
const richtung = await page.locator('#dosis-karte').getAttribute('data-richtung');
await mehrSeite('bericht');
bericht = await page.locator('#berichtText').innerText();
const pflicht = 'Ändern Sie die Dosis nicht auf eigene Faust, sondern erst nach einem Anruf in der Praxis.';
check(richtung === 'mehr' && bericht.split(pflicht).length - 1 === 1, `B41: die Richtung „${richtung}" steht im Bericht genau einmal mit dem Pflichttext`);

// ---------------------------------------------------------------- B51: der Bereich, wie er auf dem Befund steht

await laden(stand());
const bereichSpeichern = async (datum, von, bis) => {
  await page.click('#reiter-verlauf');
  await page.click('#ansicht [data-seite="labor"]');
  await page.fill('input[name=datum]', datum);
  await page.fill('input[name=tsh_wert]', '8');
  await page.fill('input[name=tsh_von]', von);
  await page.fill('input[name=tsh_bis]', bis);
  await page.click('form[data-formular="labor"] button[type=submit]');
};
const tshAm = async (datum) => ((await gespeichert()).labor.find((l) => l.datum === datum) || {}).tsh;
await bereichSpeichern(plus(TAG, -10), '0,27', '< 4,2');
let t = await tshAm(plus(TAG, -10));
check(t && t.von === 0.27 && t.bis === 4.2, `B51: „< 4,2" als Obergrenze gelesen (${JSON.stringify(t)})`);
await bereichSpeichern(plus(TAG, -11), '0,27', '4,2 mU/l');
t = await tshAm(plus(TAG, -11));
check(t && t.bis === 4.2, `B51: „4,2 mU/l" – die Einheit fällt weg, die Zahl bleibt (${JSON.stringify(t)})`);
await bereichSpeichern(plus(TAG, -12), '0,27 - 4,20', '');
t = await tshAm(plus(TAG, -12));
check(t && t.von === 0.27 && t.bis === 4.2, `B51: „0,27 - 4,20" in einem Feld: beide Grenzen (${JSON.stringify(t)})`);
await bereichSpeichern(plus(TAG, -13), '0,27', '4,,2');
check((await page.locator('.feld-fehler').allInnerTexts()).some((x) => x.includes('nur die Zahl')), 'B51: „4,,2" wird nicht still verworfen, sondern am Feld gemeldet');
check(!(await tshAm(plus(TAG, -13))), '… und nicht gespeichert');
await page.fill('input[name=tsh_von]', '');
await page.fill('input[name=tsh_bis]', '4,2');
await page.click('form[data-formular="labor"] button[type=submit]');
const dialog = page.locator('dialog.rueckfrage');
check(await dialog.count() === 1 && (await dialog.innerText()).includes('nur eine Grenze'), 'B51: TSH mit nur einer Grenze: Rückfrage, ob der Befund wirklich nur eine nennt');
await page.click('[data-act="befund-bestaetigen"]');
t = await tshAm(plus(TAG, -13));
check(t && t.von === null && t.bis === 4.2, '… bestätigt, wird sie so gespeichert');

// ---------------------------------------------------------------- B52: zweiter Befund am selben Tag

await laden(stand({ labor: [befund('b1', plus(TAG, -3), { tsh: w(7, 'mU/l', 0.4, 4) })] }));
await page.click('#reiter-verlauf');
await page.click('#ansicht [data-seite="labor"]');
await page.fill('input[name=datum]', plus(TAG, -3));
await page.fill('input[name=ft4_wert]', '5');
await page.fill('input[name=ft4_von]', '12');
await page.fill('input[name=ft4_bis]', '22');
await page.click('form[data-formular="labor"] button[type=submit]');
if (await page.locator('dialog.rueckfrage').count()) await page.click('[data-act="befund-bestaetigen"]');
s = await gespeichert();
check(s.labor.length === 1 && s.labor[0].tsh && s.labor[0].ft4 && s.labor[0].ft4.wert === 5, 'B52: fT4 vom selben Abnahmetag kommt zum vorhandenen Befund dazu');
check((await page.locator('#meldung').innerText()).includes('hinzugefügt'), '… mit der Meldung „hinzugefügt"');
await page.click('#reiter-verlauf');
check(await page.locator('#ansicht .einschaetzung[data-muster="b"]').count() === 1, 'B52: TSH 7 und fT4 5 ergeben zusammen Muster b');
await page.click('#ansicht [data-seite="labor"]');
await page.fill('input[name=datum]', plus(TAG, -3));
await page.fill('input[name=tsh_wert]', '8');
await page.click('form[data-formular="labor"] button[type=submit]');
const fDatum = page.locator('.feld-fehler');
check((await fDatum.allInnerTexts()).some((x) => x.includes('schon einen Befund')) && await fDatum.locator('[data-seite="labor"][data-param="b1"]').count() === 1,
  'B52: ein anderer TSH-Wert am selben Tag wird nicht still überschrieben – Knopf zum vorhandenen Befund');
check((await gespeichert()).labor[0].tsh.wert === 7, '… der vorhandene Wert bleibt');

// ---------------------------------------------------------------- B55: Zielbereich bestätigen

await laden(stand({
  profil: { zielVon: 0.5, zielBis: 2.5, zielAm: '2025-06-01' },
  labor: [befund('b1', plus(TAG, -10), { tsh: w(1, 'mU/l', 0.4, 4) })],
}));
await mehrSeite('gesamtbild');
const r12 = page.locator('#ansicht [data-zusatz="R12"]');
check(await r12.count() === 1, 'R12: „Gilt Ihr Zielbereich noch?" steht da');
await r12.locator('[data-act="ziel-bestaetigt"]').click();
s = await gespeichert();
check(s.profil.zielAm === TAG && s.profil.zielVon === 0.5, 'B55: „Die Praxis hat den Zielbereich bestätigt" setzt das Datum, der Bereich bleibt');
check(await page.locator('#ansicht [data-zusatz="R12"]').count() === 0, 'B55: … und die Frage ist weg');
await page.evaluate((key) => { const st = JSON.parse(localStorage.getItem(key)); st.profil.zielAm = '2025-06-01'; localStorage.setItem(key, JSON.stringify(st)); }, SCHLUESSEL);
await page.reload({ waitUntil: 'networkidle' });
await mehrSeite('profil');
await page.check('input[name=zielBestaetigt]');
await page.click('form[data-formular="profil"] button[type=submit]');
check((await gespeichert()).profil.zielAm === TAG, 'B55: auch im Profil lässt sich die Bestätigung festhalten');

// ---------------------------------------------------------------- B54: Beginn in der Zukunft

await laden(stand({ dosen: [] }));
await page.click('#reiter-verlauf');
await page.click('#ansicht [data-seite="dosis"]');
await page.fill('input[name=mikrogramm]', '75');
await page.fill('input[name=ab]', plus(TAG, 30));
await page.click('form[data-formular="dosis"] button[type=submit]');
check((await page.locator('.feld-fehler').allInnerTexts()).some((x) => x.includes('seit dem Sie')), 'B54: die erste Dosis kann nicht erst in der Zukunft beginnen');
check((await gespeichert()).dosen.length === 0, '… nichts gespeichert');

// ---------------------------------------------------------------- B57: Kalender abends

const ics = await page.evaluate(async () => (await import('./js/ics.js')).erinnerungICS({ abISO: '2026-09-27', uhr: '22:00' }));
const beschreibung = ics.replace(/\r\n /g, '').split('\r\n').find((z) => z.startsWith('DESCRIPTION:'));
check(beschreibung.includes('nach der letzten Mahlzeit') && !beschreibung.includes('Frühstück') && !beschreibung.includes('nichts mehr essen'), `B57: um 22 Uhr kein „Frühstück", sondern der Abstand zur letzten Mahlzeit – ohne „nichts mehr essen" (${beschreibung.slice(12, 60)}…)`);

// ---------------------------------------------------------------- B33, B43, B42: Warnzeichen auf der Dosis-Karte

const herzStand = (ja, profil = {}) => stand({
  profil,
  labor: [befund('b1', plus(TAG, -5), { tsh: w(7.5, 'mU/l', 0.4, 4) })],
  befinden: [{ id: 'bf', datum: TAG, stufe: 'mittel', beschwerden: ['herz'], notiz: '' }],
  warnzeichen: [{ id: 'w1', datum: TAG, uhr: '08:50', ja }],
});
await laden(herzStand(['lebensmuede']));
await mehrSeite('dosis-karte');
let schild = await page.locator('#dosis-karte .stufe-schild').innerText();
check(schild.includes('Bitte sprechen Sie heute mit jemandem'), `B33/B43: Check nur mit „lebensmüde": Gesprächsangebot statt „Sofort 112" (${schild.trim()})`);
check(await page.locator('#dosis-karte a[href="tel:08001110111"]').count() === 1, 'B43: … mit der Telefonseelsorge als Anruf auf der Karte');
await laden(herzStand(['packung', 'lebensmuede']));
await mehrSeite('dosis-karte');
check(await page.locator('#dosis-karte a[href="tel:022819240"]').count() >= 1 && await page.locator('#dosis-karte a[href="tel:08001110111"]').count() === 1,
  'B42/B33: Giftnotruf (W4a) und Seelsorge (W5) zusammen – beide Nummern auf der Karte');
await laden(stand({
  labor: [befund('b1', plus(TAG, -5), { tsh: w(7.5, 'mU/l', 0.4, 4) })],
  befinden: [{ id: 'bf', datum: TAG, stufe: 'schlecht', beschwerden: ['lebensmuede'], notiz: '' }],
}));
await mehrSeite('dosis-karte');
schild = await page.locator('#dosis-karte .stufe-schild').innerText();
check(schild.includes('Bitte sprechen Sie heute mit jemandem'), `B43: „lebensmüde" im Befinden: die Karte hat dieselbe Kopfzeile wie die Einschätzung (${schild.trim()})`);

// ---------------------------------------------------------------- B67: Giftnotruf im Wissen

await laden(stand({ profil: { bundesland: 'BY' } }));
await page.click('#reiter-mehr');
await page.click('[data-seite="wissen-kapitel"][data-param="notfall"]');
check(await page.locator('#ansicht article a[href="tel:08919240"]').count() === 1 && !(await ansichtText(page)).includes('Berlin 030'),
  'B67: „Wann anrufen, wann 112" nennt den Giftnotruf fürs eigene Bundesland (Bayern) als Knopf');

// ---------------------------------------------------------------- Schrift „sehr groß" (B66, B68, B69)

const sehrGross = (mehr = {}) => stand({ einstellungen: { erinnerung: '07:00', schrift: 'sehr-gross', farbe: 'hell', hinweisTablette: false }, ...mehr });
await laden(sehrGross({ labor: [befund('b1', plus(TAG, -5), { tsh: w(5.8, 'mU/l', 0.27, 4.2) })] }));
await page.click('#reiter-heute');
const knopf = await page.locator('.tablette').boundingBox();
const reiter = await page.locator('#reiterleiste').boundingBox();
check(knopf.y + knopf.height <= reiter.y, `B68: bei „sehr groß" liegt der Tabletten-Knopf ohne Scrollen über der Leiste (${Math.round(knopf.y + knopf.height)} ≤ ${Math.round(reiter.y)})`);
check(await page.evaluate(() => document.querySelector('#ansicht > .notfall-leiste') === document.querySelector('#ansicht').firstElementChild
  || document.querySelector('#ansicht .notfall-leiste').getBoundingClientRect().top < document.querySelector('.tablette').getBoundingClientRect().top), 'B68: die Notfallleiste bleibt darüber (W0)');
await page.click('#reiter-mehr');
await page.click('[data-seite="wissen-kapitel"][data-param="notfall"]');
const ueber = await page.evaluate(() => {
  const k = document.querySelector('#ansicht .hinweis-karte.gefahr');
  const r = k.getBoundingClientRect().right;
  return Math.max(...[...k.querySelectorAll('li, div')].map((e) => e.getBoundingClientRect().right)) - r;
});
check(ueber <= 0.5, `B66: die 112-Liste bleibt in der roten Karte (${Math.round(ueber)} px darüber)`);
const draussen = async (karteSel, innenSel) => page.evaluate(({ a, b }) => {
  const k = document.querySelector(a);
  if (!k) return null;
  const r = k.getBoundingClientRect().right;
  return Math.round(Math.max(...[...k.querySelectorAll(b)].map((e) => e.getBoundingClientRect().right)) - r);
}, { a: karteSel, b: innenSel });
await laden(sehrGross({
  labor: [befund('b1', plus(TAG, -5), { tsh: w(5.8, 'mU/l', 0.27, 4.2) })],
  befinden: [{ id: 'bf', datum: TAG, stufe: 'schlecht', beschwerden: ['lebensmuede', 'herz'], notiz: '' }],
}));
await mehrSeite('dosis-karte');
const ragt = await draussen('#dosis-karte', 'a.knopf');
check(ragt !== null && ragt <= 0, `B69: die Anruf-Knöpfe der Telefonseelsorge ragen nicht über die Dosis-Karte (${ragt} px)`);
const textRagt = await page.evaluate(() => Math.max(...[...document.querySelectorAll('#dosis-karte a.knopf')]
  .map((a) => { const t = a.querySelector('.knopf-text'); return t ? t.getBoundingClientRect().right - a.getBoundingClientRect().right : 99; })));
check(textRagt <= 0, `B69: auch „Bereitschaftsdienst 116 117" bleibt im Knopf (${Math.round(textRagt)} px)`);
await page.click('#reiter-verlauf');
await page.click('#ansicht [data-seite="labor"]');
await page.click('details.weitere > summary');
const crp = await draussen('.karte[data-feld="crp"]', 'select');
check(crp !== null && crp <= 0, `B69: die Einheitenauswahl beim CRP bleibt in der Karte (${crp} px)`);
const breite = await page.evaluate(() => document.documentElement.scrollWidth);
check(breite <= 360, `bei „sehr groß" kein waagerechtes Scrollen (${breite} px)`);

// ---------------------------------------------------------------- B54, B59: Einrichten

await laden({ version: 2, profil: { begruesst: false } });
await page.click('[data-act="willkommen-weiter"]');
check((await ansichtText(page)).includes('ungefähr schätzen'), 'B59: „Seit wann?" bittet ums Schätzen – „heute lassen" nur bei neuem Beginn');
check(await page.getAttribute('input[name=ab]', 'max') === TAG, 'B54: das Datumsfeld reicht nur bis heute');
await page.fill('input[name=mikrogramm]', '75');
await page.fill('input[name=ab]', plus(TAG, 30));
await page.click('[data-act="willkommen-weiter"]');
check((await page.locator('.feld-fehler').allInnerTexts()).some((x) => x.includes('Zukunft')), 'B54: ein Beginn in der Zukunft wird beim Einrichten gemeldet');
check((await page.locator('.schritte').innerText()).includes('Schritt 2'), '… und die Einrichtung bleibt bei Schritt 2');


// ================================================================ Runde 2
//
// Befunde aus der zweiten Durchsicht (C…). Jeder Fall scheiterte vor der
// Korrektur. Die Regeln dahinter prüfen tests/test-sd-regeln-*.mjs; hier
// zählt, was auf dem Bildschirm steht und was gespeichert wird.

const dosis = (id, ab, mikrogramm, praxis, tabletten = 1) => ({ id, ab, praeparat: 'L-Thyroxin', mikrogramm, tabletten, notiz: '', praxis });
const checkHeute = (ja) => [{ id: 'wz', datum: TAG, uhr: '08:50', ja }];

// ---------------------------------------------------------------- C1, C6: Check von heute auf der Dosis-Karte

// Den Check von sich aus gemacht, ohne Herzklopfen im Befinden: „große Menge
// auf einmal". Vorher zeigte die Karte „mehr" mit „Beim nächsten Termin … Ein
// paar Tage Warten schaden nicht", während „Heute" „Sofort 112" sagte.
await laden(stand({
  labor: [befund('b1', plus(TAG, -10), { tsh: w(7.5, 'mU/l', 0.4, 4), ft4: w(14, 'pmol/l', 12, 22) })],
  nachfragen: [{ id: 'n1', art: 'dosis_stimmt', bezug: 'b1', antwort: 'ja', am: plus(TAG, -2) }],
  warnzeichen: checkHeute(['packung']),
}));
await mehrSeite('dosis-karte');
let dk = page.locator('#dosis-karte');
check(await dk.getAttribute('data-stufe') === 'notruf' && await dk.getAttribute('data-richtung') === 'klaeren',
  `C1/C6: Check „große Menge auf einmal": die Karte steht auf „Sofort 112", ohne Richtung (${await dk.getAttribute('data-stufe')}, ${await dk.getAttribute('data-richtung')})`);
check(await dk.locator('li[data-grund="W4a"] a[href="tel:022819240"]').count() === 1 && await dk.locator('a[href="tel:112"]').count() >= 1,
  'C1/C6: … mit dem Giftnotruf fürs Bundesland (NRW) und 112 als Anruf');
const dkText = await dk.innerText();
check(await dk.locator('.pflicht').count() === 0 && !dkText.includes('Ein paar Tage Warten') && !dkText.includes('Einschätzung aus Ihrem Laborwert'),
  'C1/C6: … nur der Notfall – kein Pflichttext zur Dosis darunter');
check(await dk.locator('[data-seite="praxis-entschieden"]').count() === 0 && await dk.locator('.grundlage').count() === 0,
  'C1/C6: … ohne „Die Praxis hat entschieden" und ohne Grundlage');
await page.click('#reiter-heute');
check(await page.locator('#ansicht .einschaetzung-verweis').getAttribute('data-stufe') === 'notruf' && await page.locator('#ansicht .dosis-verweis').count() === 0,
  'C1/C6: „Heute" sagt „Sofort 112" und verweist nicht mehr auf eine „Einschätzung zur Dosis"');

// Nur „lebensmüde" im Check (C6, B43): das Gesprächsangebot mit allen Nummern,
// die der Text nennt – auch 116 117 (C12).
await laden(stand({
  labor: [befund('b1', plus(TAG, -10), { tsh: w(0.2, 'mU/l', 0.4, 4), ft4: w(20, 'pmol/l', 12, 22) })],
  warnzeichen: checkHeute(['lebensmuede']),
}));
await mehrSeite('dosis-karte');
dk = page.locator('#dosis-karte');
check((await dk.locator('.stufe-schild').innerText()).includes('Bitte sprechen Sie heute mit jemandem') && await dk.getAttribute('data-richtung') === 'klaeren',
  `C6: Check nur mit „lebensmüde": Gesprächsangebot statt „Kein besonderer Anlass" oder einer Richtung (${(await dk.locator('.stufe-schild').innerText()).trim()})`);
check(await dk.locator('a[href="tel:08001110111"]').count() >= 1 && await dk.locator('a[href="tel:116117"]').count() >= 1 && await dk.locator('.pflicht').count() === 0,
  'C6: … Telefonseelsorge und 116 117 als Anruf, kein Pflichttext');

// ---------------------------------------------------------------- C12: 116 117 auf dem Ergebnis des Checks

await page.click('#reiter-heute');
await page.click('#befinden [data-seite="warnzeichen"]');
await page.check('input[name=warn][value=lebensmuede]');
await page.click('form[data-formular="warnzeichen"] button[type=submit]');
const w5 = page.locator('#ansicht .warn-abschnitt[data-regel="W5"]');
check((await w5.innerText()).includes('116 117') && await w5.locator('a[href="tel:116117"]').count() === 1,
  'C12: der W5-Text nennt 116 117 – auf dem Ergebnis ist die Nummer jetzt anrufbar');
await mehrSeite('gesamtbild');
check(await page.locator('#ansicht .teil-karte[data-regel="W5"] a[href="tel:116117"]').count() === 1, 'C12: … und im Gesamtbild unter „Im Einzelnen"');

// ---------------------------------------------------------------- C9: „Nichts davon" nach „heute anrufen"

// Herzklopfen an zwei Tagen (R3 „heute"): Die Karte auf „Heute" schickt zum
// Check. Wer dort nichts ankreuzt, las vorher „Beim nächsten Termin … Übrige
// Beschwerden beim nächsten Termin ansprechen".
await laden(stand({
  labor: [befund('b1', plus(TAG, -10), { tsh: w(5.5, 'mU/l', 0.4, 4) })],
  befinden: [{ id: 'h1', datum: plus(TAG, -1), stufe: 'mittel', beschwerden: ['herz'], notiz: '' }, { id: 'h2', datum: TAG, stufe: 'mittel', beschwerden: ['herz'], notiz: '' }],
}));
await page.click('#reiter-heute');
await page.click('#ansicht [data-regel="R3"] [data-seite="warnzeichen"]');
await page.click('form[data-formular="warnzeichen"] button[type=submit]');
const ergebnis = await ansichtText(page);
const zusammen = page.locator('#ansicht .ergebnis-kopf');
check(await zusammen.count() === 1 && (await zusammen.innerText()).includes('Heute anrufen'), `C9: „Nichts davon": oben „Zusammen: Heute anrufen" (${await zusammen.count() ? (await zusammen.innerText()).trim() : 'fehlt'})`);
check(!ergebnis.includes('Beim nächsten Termin') && !ergebnis.includes('beim nächsten Termin ansprechen'), 'C9: … und nirgends „beim nächsten Termin"');
check(await page.locator('#ansicht .beschwerde-karte[data-regel="R3"]').count() === 1, 'C9: … die Karte aus dem Befinden, die zum Check geschickt hat, steht darüber');
check(await page.locator('#ansicht [data-regel="W3"] a[href="tel:116117"]').count() === 1, 'C9: … „Nichts davon" nennt jetzt die heutige Frist – 116 117 als Anruf');
check(await page.locator('#ansicht [data-seite="warnzeichen"]').count() === 0, 'C9: … ohne „Warnzeichen prüfen" – der Check ist ja gemacht');

// ---------------------------------------------------------------- C8: „Ja" nach einer Erhöhung

await laden(stand({
  labor: [befund('b1', plus(TAG, -40), { tsh: w(6.8, 'mU/l', 0.4, 4) }, { praxis: 'geaendert', praxisAm: plus(TAG, -16) })],
  dosen: [dosis('d1', plus(TAG, -400), 75, null), dosis('d2', plus(TAG, -15), 88, true)],
}));
await page.click('#reiter-heute');
await page.click('#ansicht [data-regel="W-D4"] [data-act="frage-antwort"][data-wert="ja"]');
const wd4 = page.locator('#ansicht [data-regel="W-D4"]');
check((await wd4.innerText()).includes('Heute anrufen') && await wd4.locator('a[href="tel:116117"]').count() === 1,
  'C8: nach „Ja" sagt „Heute" „Heute anrufen" – der Text nennt 116 117, und die Nummer ist anrufbar');
await mehrSeite('dosis-karte');
dk = page.locator('#dosis-karte');
const wd4Grund = dk.locator('li[data-grund="W-D4"]');
check(await dk.getAttribute('data-stufe') === 'heute' && !(await dk.locator('.stufe-schild').innerText()).includes('Kein besonderer Anlass'),
  `C8: die Dosis-Karte sagt dasselbe – „Heute anrufen" statt grün „Kein besonderer Anlass" (${await dk.getAttribute('data-stufe')})`);
check(await wd4Grund.count() === 1 && await wd4Grund.locator('a[href="tel:116117"]').count() === 1 && await wd4Grund.locator('[data-seite="warnzeichen"]').count() === 1,
  'C8: … mit dem Grund, 116 117 als Anruf und dem Weg zum Warnzeichen-Check');

// ---------------------------------------------------------------- C7: dieselbe eigene Änderung nicht zweimal auf „Heute"

await laden(stand({
  dosen: [dosis('d1', plus(TAG, -400), 75, null), dosis('d2', plus(TAG, -3), 150, false)],
  labor: [befund('b1', plus(TAG, -20), { tsh: w(7.2, 'mU/l', 0.4, 4) })],
}));
await mehrSeite('dosis-karte');
check(await page.locator('#dosis-karte').getAttribute('data-stufe') === 'tage' && await page.locator('#dosis-karte li[data-grund="X3"]').count() === 1,
  'C7: die Dosis-Karte nennt die eigene Verdopplung wie „Heute" – „In den nächsten Tagen anrufen" mit X3');
await page.click('#reiter-heute');
check(await page.locator('#ansicht [data-regel="X3"]').count() === 1 && await page.locator('#ansicht .dosis-verweis').count() === 0,
  'C7: „Heute" zeigt X3 einmal – ohne zusätzlich „die Dosis-Karte hat einen wichtigen Hinweis" zum selben Anlass');

// ---------------------------------------------------------------- C10: weitere Werte im Kopf der Befund-Karte

await laden(stand({
  labor: [befund('b1', plus(TAG, -7), { tsh: w(2.0, 'mU/l', 0.4, 4), ft4: w(16, 'pmol/l', 12, 22), vitd: w(120, 'ng/ml', 30, 100), hb: w(9.5, 'g/dl', 12, 16) })],
}));
await page.click('#reiter-verlauf');
const kopfFrist = page.locator('#ansicht .befund[data-befund="b1"] .einschaetzung .frist');
check((await kopfFrist.innerText()).includes('In den nächsten Tagen anrufen') && !(await kopfFrist.innerText()).includes('Kein besonderer Anlass'),
  `C10: TSH und fT4 unauffällig, Vitamin D 120: der Kopf der Befund-Karte sagt „In den nächsten Tagen anrufen", nicht grün „Kein besonderer Anlass" (${(await kopfFrist.innerText()).slice(0, 60)}…)`);
check((await kopfFrist.innerText()).includes('Vitamin D'), 'C10: … und sagt, woher die Frist kommt');
await mehrSeite('gesamtbild');
const teilBefund = page.locator('#ansicht .teil-karte[data-regel="befund"]');
check((await teilBefund.innerText()).includes(`Schilddrüsenwerte vom ${kurz(plus(TAG, -7))}`) && !(await teilBefund.innerText()).includes('Letzter Befund vom'),
  'C10: im Gesamtbild heißt der Teil „Schilddrüsenwerte vom …" – nicht „Letzter Befund vom …: Kein besonderer Anlass" unter dem Vitamin D');

// ---------------------------------------------------------------- C13: ein neuerer Befund nur mit fT4

await laden(stand({
  labor: [befund('b1', plus(TAG, -120), { tsh: w(0.3, 'mU/l', 0.4, 4), ft4: w(20, 'pmol/l', 12, 22) }),
    befund('b2', plus(TAG, -5), { ft4: w(5, 'pmol/l', 12, 22) })],
}));
await mehrSeite('gesamtbild');
check((await page.locator('#ansicht .teil-karte[data-regel="befund"]').innerText()).includes(`Letzter Befund mit TSH vom ${kurz(plus(TAG, -120))}`),
  'C13: der ältere Befund heißt „Letzter Befund mit TSH vom …" – der neuere ohne TSH steht darüber');
await page.click('#reiter-heute');
const l7d = page.locator('#ansicht [data-regel="L7d"]');
check(await l7d.count() === 1 && (await l7d.innerText()).includes('TSH nicht neu bestimmt') && !(await l7d.innerText()).includes('seitdem wurde nicht neu kontrolliert'),
  'C13: „Heute" sagt „TSH nicht neu bestimmt" statt „seitdem wurde nicht neu kontrolliert"');

// ---------------------------------------------------------------- C15: nachgereichtes fT4 bei zwei Einträgen eines Tages

// Ein älterer Stand: TSH 7 und – als neuer Eintrag berichtigt – TSH 7,5 am selben Tag.
await laden(stand({
  labor: [befund('b1', plus(TAG, -3), { tsh: w(7, 'mU/l', 0.4, 4) }), befund('b2', plus(TAG, -3), { tsh: w(7.5, 'mU/l', 0.4, 4) })],
}));
await page.click('#reiter-verlauf');
await page.click('#ansicht [data-seite="labor"]');
await page.fill('input[name=datum]', plus(TAG, -3));
await page.fill('input[name=ft4_wert]', '5');
await page.fill('input[name=ft4_von]', '12');
await page.fill('input[name=ft4_bis]', '22');
await page.click('form[data-formular="labor"] button[type=submit]');
if (await page.locator('dialog.rueckfrage').count()) await page.click('[data-act="befund-bestaetigen"]');
s = await gespeichert();
const b1 = s.labor.find((l) => l.id === 'b1');
const b2 = s.labor.find((l) => l.id === 'b2');
check(b2 && b2.ft4 && b2.ft4.wert === 5 && b1 && !b1.ft4, `C15: das fT4 kommt zum zuletzt eingetragenen Befund des Tages (b1: ${b1 && b1.ft4 ? 'fT4' : '–'}, b2: ${b2 && b2.ft4 ? 'fT4' : '–'})`);
await page.click('#reiter-verlauf');
check(await page.locator('#ansicht .befund[data-befund="b2"] .einschaetzung[data-muster="b"]').count() === 1, 'C15: TSH 7,5 und fT4 5 ergeben zusammen Muster b');
await page.click('#reiter-heute');
check(await page.locator('#ansicht .einschaetzung-verweis').getAttribute('data-stufe') === 'tage', 'C15: „Heute" sagt „In den nächsten Tagen anrufen"');

// ---------------------------------------------------------------- C22: der alte Punkt „trockene Haut, Haarausfall"

await laden(stand({
  labor: [befund('b1', plus(TAG, -10), { tsh: w(2, 'mU/l', 0.4, 4) })],
  befinden: [{ id: 'bh', datum: plus(TAG, -2), stufe: 'mittel', beschwerden: ['haut', 'frieren'], notiz: '' }],
}));
const altName = 'trockene Haut oder Haarausfall (frühere Angabe)';
await page.click('#reiter-verlauf');
check((await ansichtText(page)).includes(altName), 'C22: der Verlauf nennt den alten Punkt mit seinem Namen – vorher fehlte er');
await mehrSeite('gesamtbild');
check((await ansichtText(page)).includes(`Eingetragen in den letzten vier Wochen: ${altName}`), 'C22: das Gesamtbild nennt ihn beim Namen, nicht „haut"');
await mehrSeite('bericht');
check((await page.locator('#berichtText').innerText()).includes(`${altName} (1×)`), 'C22: der Bericht nennt, was angegeben wurde – nicht „trockene Haut"');
await page.click('#reiter-verlauf');
await page.click('#ansicht [data-seite="befinden-liste"]');
await page.click('#ansicht [data-seite="befinden"][data-param="bh"]');
check(await page.isChecked('input[name=beschwerden][value=haut]'), 'C22: beim Bearbeiten steht der alte Punkt angehakt da');
await page.click('form[data-formular="befinden"] button[type=submit]');
s = await gespeichert();
check(s.befinden.find((b) => b.id === 'bh').beschwerden.includes('haut'), 'C22: … und bleibt beim Speichern erhalten');
await page.click('#reiter-heute');
await page.click('[data-act="befinden"][data-stufe="gut"]');
await page.click('#befinden [data-seite="befinden"]');
check(await page.locator('input[name=beschwerden][value=haut]').count() === 0, 'C22: neu angeboten wird er nicht');

// ---------------------------------------------------------------- C17: eine alte Antwort „Nein" macht keine Berichtigung

// „Nein, ich nehme etwas anderes" zum Befund vom März blieb liegen; zum
// Befund vom August gilt „Ja", und die Praxis hat die Dosis geändert.
const c17 = () => stand({
  mittel: ['marcumar'],
  labor: [befund('b0', plus(TAG, -200), { tsh: w(5, 'mU/l', 0.4, 4) }), befund('b1', plus(TAG, -33), { tsh: w(7, 'mU/l', 0.4, 4) }, { praxis: 'geaendert', praxisAm: plus(TAG, -27) })],
  nachfragen: [{ id: 'n0', art: 'dosis_stimmt', bezug: 'b0', antwort: 'nein_75', am: plus(TAG, -190) },
    { id: 'n1', art: 'dosis_stimmt', bezug: 'b1', antwort: 'ja', am: plus(TAG, -30) }],
});
await laden(c17());
await page.click('#reiter-verlauf');
await page.click('#ansicht [data-seite="dosis"]');
await page.fill('input[name=mikrogramm]', '100');
await page.fill('input[name=ab]', plus(TAG, -5));
await page.check('input[name=praxis][value=ja]');
await page.click('form[data-formular="dosis"] button[type=submit]');
s = await gespeichert();
const neueDosis = s.dosen.find((d) => d.mikrogramm === 100);
check(neueDosis && !neueDosis.berichtigung, `C17: die Änderung der Praxis wird nicht als „Berichtigung" gespeichert (berichtigung = ${neueDosis && neueDosis.berichtigung})`);
await page.click('#reiter-heute');
const ww1 = page.locator('#ansicht [data-regel="WW1"]');
check(await ww1.count() === 1 && !(await ww1.innerText()).includes('berichtigt'), 'C17: „Heute" nennt sie als Änderung (INR, WW1) – nicht „Sie haben berichtigt"');
// Die Antwort zum neuen Befund räumt die alte „Nein" zu einem früheren weg.
await laden(stand({
  labor: [befund('b0', plus(TAG, -200), { tsh: w(5, 'mU/l', 0.4, 4) }), befund('b1', plus(TAG, -10), { tsh: w(7, 'mU/l', 0.4, 4) })],
  nachfragen: [c17().nachfragen[0]],
}));
await mehrSeite('dosis-karte');
const c17Fragen = await kartenFragen({ X3: 'ja' });
s = await gespeichert();
check(!s.nachfragen.some((n) => n.bezug === 'b0' && /^nein/.test(n.antwort)) && s.nachfragen.some((n) => n.bezug === 'b1' && n.antwort === 'ja'),
  `C17: „Ja" zum neuen Befund – die alte Antwort „Nein" zum früheren bleibt nicht liegen (${c17Fragen.join(' → ')})`);

// ---------------------------------------------------------------- C19: „Alles löschen" neben einer zweiten Instanz

await laden(stand({ labor: [befund('b1', plus(TAG, -10), { tsh: w(2, 'mU/l', 0.4, 4) })] }));
await page.click('#reiter-heute');
const zweite = await ctx.newPage();
await zweite.goto(SD_URL, { waitUntil: 'networkidle' });
await zweite.click('#reiter-mehr');
await zweite.click('#ansicht [data-seite="dosis-karte"]');
check(await zweite.locator('#dosis-karte').count() === 1, 'C19: die zweite Instanz (ein Tab neben der App) zeigt gerade die Dosis-Karte');
await page.click('#reiter-mehr');
await page.click('[data-seite="ueber"]');
await page.click('[data-act="alles-loeschen"]');
await zweite.waitForTimeout(300);
check(await zweite.locator('.willkommen-titel').count() === 1, 'C19: nach „Alles löschen" in der einen zeigt auch die andere die Willkommensseite');
// Vorher zeigte sie weiter die Dosis-Karte – und ein Tipp auf „Heute" und
// die Tablette schrieb alles zurück.
if (await zweite.locator('#reiter-heute').isVisible()) {
  await zweite.click('#reiter-heute');
  if (await zweite.locator('.tablette').count()) await zweite.click('.tablette');
}
await zweite.waitForTimeout(300);
const nachLoeschen = await page.evaluate((k) => JSON.parse(localStorage.getItem(k) || 'null'), SCHLUESSEL);
check(!nachLoeschen || !nachLoeschen.labor || nachLoeschen.labor.length === 0, 'C19: … und schreibt die gelöschten Daten nicht zurück');
await zweite.close();

// ---------------------------------------------------------------- C20, C18: in einem eigenen Browserkontext

/*
 * Ein Speicher, der beim Schreiben scheitert – wie ein voller oder ein
 * gesperrter. `__speicher` im Speicher (oder window.__speicherModus) sagt
 * wie; gelesen wird weiter.
 */
function speicherScheitert() {
  // Über das Objekt selbst statt über `Storage` – wie in sd-hilfe.mjs.
  const proto = Object.getPrototypeOf(window.localStorage);
  const echt = proto.setItem;
  proto.setItem = function setItem(k, v) {
    if (this === window.localStorage && !String(k).startsWith('__')) {
      const art = window.__speicherModus || window.localStorage.getItem('__speicher');
      if (art) throw new DOMException('Speicher', art === 'voll' ? 'QuotaExceededError' : 'SecurityError');
    }
    return echt.call(this, k, v);
  };
}
const eigen = await browser.newContext({ viewport: { width: 360, height: 740 }, locale: 'de-DE' });
await eigen.addInitScript(uhrStellen);
await eigen.addInitScript(speicherScheitert);
const sp2 = await eigen.newPage();
await sp2.goto(SD_URL, { waitUntil: 'networkidle' });
await sp2.evaluate(({ key, st, t }) => {
  localStorage.setItem('__testtag', t);
  localStorage.setItem(key, JSON.stringify(st));
  localStorage.setItem('__speicher', 'voll');
}, { key: SCHLUESSEL, st: stand(), t: TAG });
await sp2.reload({ waitUntil: 'networkidle' });
const warnung = () => sp2.locator('#ansicht .hinweis-karte.gefahr[role="alert"]').first().innerText().catch(() => '');
check((await warnung()).includes('Speicher des Browsers ist voll') && (await warnung()).includes('Sicherung'),
  `C20: schon beim Start voller Speicher: „Speicher voll" mit dem Rat zur Sicherung – nicht „privates Fenster?" (${(await warnung()).slice(0, 50)}…)`);
await sp2.evaluate(() => localStorage.setItem('__speicher', 'gesperrt'));
await sp2.reload({ waitUntil: 'networkidle' });
check((await warnung()).includes('privates Fenster'), 'C20: gesperrter Speicher: „privates Fenster?"');
await sp2.evaluate(() => { window.__speicherModus = 'voll'; });
await sp2.click('.tablette');
await sp2.waitForTimeout(400);
check((await warnung()).includes('Speicher des Browsers ist voll'), `C20: ändert sich der Grund mitten in der Sitzung, ändert sich die Warnung sofort (${(await warnung()).slice(0, 50)}…)`);
await eigen.close();

// C18: Startet die App nicht (hier ein Modul, das nicht zu den anderen passt,
// wie nach einem Update aus einem unvollständigen Vorrat), stehen die
// Notfallnummern trotzdem da. Ohne Service Worker, damit die Umleitung greift.
const ohneWorker = await browser.newContext({ viewport: { width: 360, height: 740 }, locale: 'de-DE', serviceWorkers: 'block' });
const kaputt = await ohneWorker.newPage();
const startFehler = [];
kaputt.on('pageerror', (e) => startFehler.push(e.message));
await kaputt.route('**/schilddruese/js/einschaetzung.js', (r) => r.fulfill({ contentType: 'text/javascript; charset=utf-8', body: 'export const alt = 1;\n' }));
await kaputt.goto(SD_URL, { waitUntil: 'networkidle' });
await kaputt.waitForTimeout(300);
const leiste0 = kaputt.locator('#ansicht .notfall-leiste');
check(startFehler.length > 0, `C18: das unpassende Modul hält die App an (${(startFehler[0] || 'kein Fehler').slice(0, 70)})`);
check(await leiste0.isVisible() && await leiste0.locator('a[href="tel:112"]').count() >= 1 && await leiste0.locator('a[href="tel:116117"]').count() === 1
  && await leiste0.locator('a[href="tel:08001110111"]').count() === 1, 'C18: … die Notfallleiste mit 112, 116 117 und Telefonseelsorge steht trotzdem da (W0)');
await ohneWorker.close();


// ================================================================ Runde 3
//
// Befunde aus der dritten Durchsicht (D…), soweit sie die Oberfläche
// betreffen: die Wissenstexte, der Kalender, der Morgen der Blutabnahme und
// was „Heute", die Einschätzung, die Dosis-Karte und die Formulare aus den
// neuen Angaben des Kerns machen. Jeder Fall scheiterte vor der Korrektur;
// die Regeln selbst prüfen tests/test-sd-regeln-*.mjs.

const zuKapitel = async (id) => {
  await page.click('#reiter-mehr');
  await page.click('#ansicht [data-seite="wissen"]');
  await page.click(`#ansicht [data-seite="wissen-kapitel"][data-param="${id}"]`);
  return page.locator('#ansicht article').innerText();
};
const dosisStimmt = (am, antwort = 'ja') => [{ id: 'ns', art: 'dosis_stimmt', bezug: 'b1', antwort, am }];
// Neu geladen bleibt der zuletzt benutzte Reiter (B64) – für „Heute" also hinwechseln.
const ladenHeute = async (st, o) => { await laden(st, o); await page.click('#reiter-heute'); };

// ---------------------------------------------------------------- D2: „Wann anrufen, wann 112" – heute statt in den nächsten Tagen

// Herzklopfen seit Tagen, ein neu unregelmäßiger Puls, Erbrechen über mehr
// als einen Tag: Der Check sagt „heute noch anrufen" (W2h), das Kapitel sagte
// „in den nächsten Tagen".
await laden(stand());
const notfallKapitel = await zuKapitel('notfall');
const heuteBlock = (notfallKapitel.split('Heute noch die Praxis anrufen')[1] || '').split('In den nächsten Tagen')[0];
const tageBlock = notfallKapitel.split('In den nächsten Tagen die Praxis anrufen')[1] || '';
check(/Herzklopfen seit Tagen/.test(heuteBlock) && /Puls neu unregelmäßig/.test(heuteBlock) && /Erbrechen länger als einen Tag/.test(heuteBlock) && /116 117/.test(heuteBlock) && /112/.test(heuteBlock),
  `D2: „Heute noch die Praxis anrufen" steht vor „In den nächsten Tagen" – mit Herzklopfen, Puls, Erbrechen, 116 117 und 112 (${heuteBlock.replace(/\s+/g, ' ').slice(0, 60)}…)`);
check(tageBlock && !/unregelmäßiger Puls|Durchfall oder Erbrechen/.test(tageBlock) && /Gewichtsverlust/.test(tageBlock),
  '… unter „In den nächsten Tagen" stehen Puls und Erbrechen nicht mehr, der ungewollte Gewichtsverlust schon');
const heuteNummern = await page.evaluate(() => {
  const h2 = [...document.querySelectorAll('#ansicht article h2')].find((h) => h.textContent.includes('Heute noch die Praxis anrufen'));
  const hrefs = [];
  for (let el = h2 && h2.nextElementSibling; el && el.tagName !== 'H2'; el = el.nextElementSibling) el.querySelectorAll('a[href^="tel:"]').forEach((a) => hrefs.push(a.getAttribute('href')));
  return hrefs;
});
check(heuteNummern.includes('tel:116117') && heuteNummern.includes('tel:112'), `D2: … 116 117 und 112 dort als Knöpfe (${heuteNummern.join(', ')})`);

// ---------------------------------------------------------------- D10, D5: „Tablette vergessen?"

const vergessenKapitel = await zuKapitel('vergessen');
check(/Mehr als eine Tablette zu viel auf einmal/.test(vergessenKapitel) && await page.locator('#ansicht article a[href="tel:022819240"]').count() === 1
  && await page.locator('#ansicht article a[href="tel:112"]').count() === 1,
  'D10: „mehr als eine Tablette zu viel auf einmal" – jetzt der Giftnotruf fürs Bundesland (Knopf) und 112 als Knopf');
check(!/2 bis 3 Stunden/.test(vergessenKapitel) && /mindestens 3 Stunden nach dem Essen/.test(vergessenKapitel), 'D5: Nachholen „mindestens 3 Stunden nach dem Essen" – nicht „2 bis 3"');
await laden(stand({ profil: { bundesland: '' } }));
await zuKapitel('vergessen');
check(await page.locator('#ansicht article a[href="tel:112"]').count() === 1 && await page.locator('#ansicht article [data-seite="profil"]').count() === 1,
  'D10: ohne Bundesland 112 als Knopf und der Weg ins Profil');

// ---------------------------------------------------------------- D5: eine Zahl für abends – Plan, Kalender, Wissen

const abendText = await page.evaluate(async () => (await import('./js/ics.js')).erinnerungText('21:30'));
check(/mindestens 3 Stunden nach der letzten Mahlzeit/.test(abendText) && !/\b2\b[^.]*Stunden/.test(abendText), `D5: Kalender um 21:30 „mindestens 3 Stunden" (${abendText.slice(0, 60)}…)`);
await laden(stand({ einstellungen: { erinnerung: '21:30', schrift: 'gross', farbe: 'hell', hinweisTablette: false } }));
await mehrSeite('abstand');
const abstandText = await ansichtText(page);
check(/3 Stunden \(besser 4\)/.test(abstandText) && !/2[–-]3 Stunden/.test(abstandText), 'D5: „Was braucht Abstand?" nennt abends dieselbe Zahl');

// ---------------------------------------------------------------- D16: Morgen der Blutabnahme

// Eigener Kontext: Systemhinweise erlaubt und mitgeschrieben, ohne Service
// Worker, damit der Hinweis über new Notification() kommt.
const r3ctx = await browser.newContext({ viewport: { width: 360, height: 740 }, locale: 'de-DE', serviceWorkers: 'block' });
await r3ctx.addInitScript(uhrStellen);
await r3ctx.addInitScript(() => {
  window.__hinweise = [];
  class N { constructor(titel, o) { window.__hinweise.push({ titel, text: o && o.body }); } }
  N.permission = 'granted';
  N.requestPermission = async () => 'granted';
  window.Notification = N;
});
const p3 = await r3ctx.newPage();
const p3Fehler = [];
p3.on('pageerror', (e) => p3Fehler.push(e.message));
await p3.goto(SD_URL, { waitUntil: 'networkidle' });
const abnahmeStand = (termin) => stand({
  einstellungen: { erinnerung: '07:00', schrift: 'gross', farbe: 'hell', hinweisTablette: true },
  termine: [{ id: 't1', datum: TAG, uhr: '09:30', art: 'labor', wo: '', blutabnahme: true, notiz: '', ...termin }],
});
const p3Laden = async (st, zeit) => {
  await p3.evaluate(({ key, s0, t, z }) => {
    localStorage.clear();
    localStorage.setItem('__testtag', t);
    localStorage.setItem('__testzeit', z);
    localStorage.setItem(key, JSON.stringify(s0));
  }, { key: SCHLUESSEL, s0: st, t: TAG, z: zeit });
  await p3.reload({ waitUntil: 'networkidle' });
  await p3.waitForTimeout(300);
};
const p3Uhr = async (zeit) => {
  await p3.evaluate((z) => localStorage.setItem('__testzeit', z), zeit);
  await p3.reload({ waitUntil: 'networkidle' });
  await p3.waitForTimeout(300);
};
await p3Laden(abnahmeStand(), '07:10');
let tKnopf = p3.locator('.tablette');
check(!(await tKnopf.getAttribute('class')).includes('faellig') && (await tKnopf.innerText()).includes('Heute erst nach der Blutabnahme (9:30 Uhr)'),
  `D16: 7:10, Abnahme um 9:30: der Knopf mahnt nicht („${(await tKnopf.innerText()).replace(/\s+/g, ' ')}")`);
check((await p3.evaluate(() => window.__hinweise)).length === 0, 'D16: … und kein Systemhinweis „Nüchtern, mit einem Glas Wasser"');
await p3Uhr('10:00');
tKnopf = p3.locator('.tablette');
check((await tKnopf.getAttribute('class')).includes('faellig') && (await p3.evaluate(() => window.__hinweise)).length === 1,
  'D16: nach der Abnahme (10:00) erinnert die App wieder – der Merker war nicht schon um 7:10 gesetzt');
await p3Laden(abnahmeStand({ uhr: '' }), '08:00');
// Geändert in Runde 4 (E34): Ohne Uhrzeit schwieg der Systemhinweis vorher den
// ganzen Tag – auch nach der Abnahme und bei Einnahme am Abend. Jetzt kommt er
// ab der gewohnten Zeit (hier 7:00), aber mit dem Satz zur Blutabnahme statt
// „Nüchtern, mit einem Glas Wasser". Der Knopf sagt weiter „erst nach der Blutabnahme".
const d16OhneUhr = await p3.evaluate(() => window.__hinweise);
check((await p3.locator('.tablette').innerText()).includes('Heute erst nach der Blutabnahme – dann hier antippen')
  && d16OhneUhr.length === 1 && d16OhneUhr[0].text.includes('Heute ist Blutabnahme') && !d16OhneUhr[0].text.includes('Nüchtern, mit einem Glas Wasser'),
  `D16/E34: Abnahme ohne Uhrzeit – „Heute erst nach der Blutabnahme", der Hinweis nennt die Abnahme statt „Nüchtern" (${JSON.stringify(d16OhneUhr)})`);
await p3Laden({ ...abnahmeStand(), termine: [] }, '07:10');
check((await p3.locator('.tablette').getAttribute('class')).includes('faellig') && (await p3.evaluate(() => window.__hinweise)).length === 1,
  'D16: ohne Blutabnahme bleibt es beim gewohnten Hinweis um 7 Uhr');
check(p3Fehler.length === 0, `D16: keine Fehler auf der Seite${p3Fehler.length ? `: ${p3Fehler[0]}` : ''}`);
await r3ctx.close();

// ---------------------------------------------------------------- D4: die 112 unter der Frage nach einer Erhöhung, auch in der Einschätzung

await ladenHeute(stand({
  labor: [befund('b1', plus(TAG, -30), { tsh: w(5.8, 'mU/l', 0.4, 4) }, { praxis: 'geaendert', praxisAm: plus(TAG, -16) })],
  dosen: [dosis('d1', plus(TAG, -400), 75, null), dosis('d2', plus(TAG, -14), 88, true)],
}));
check(await page.locator('#ansicht .kern-hinweis[data-regel="W-D4"] a[href="tel:112"]').count() === 1, 'D4: „Heute" – die Frage nach der Erhöhung mit 112 als Knopf');
await mehrSeite('gesamtbild');
const wd4Teil = page.locator('#ansicht .teil-karte[data-regel="W-D4"]');
check(await wd4Teil.count() === 1 && (await wd4Teil.innerText()).includes('sofort 112') && await wd4Teil.locator('a[href="tel:112"]').count() === 1,
  'D4: die Einschätzung nennt dieselbe Frage mit „sofort 112" – und 112 ist dort anrufbar');

// ---------------------------------------------------------------- D11: die eigene Änderung nach 14 Tagen

// TSH 12 (Stufe Tage) und 75 → 125 µg ohne Anweisung der Praxis vor 20
// Tagen: „Heute" nennt X3 nur 14 Tage selbst. Danach steht „wieder Ihre
// bisherige Menge" nur auf der Karte – und „Heute" verwies nicht dorthin,
// weil X3 nicht über der Stufe des Befunds lag.
await ladenHeute(stand({
  labor: [befund('b1', plus(TAG, -27), { tsh: w(12, 'mU/l', 0.4, 4), ft4: w(14, 'pmol/l', 12, 22) }, { praxisAm: plus(TAG, -25) })],
  dosen: [dosis('d1', plus(TAG, -400), 75, null), dosis('d2', plus(TAG, -20), 125, false)],
  nachfragen: dosisStimmt(plus(TAG, -25)),
}));
let dVerweis = page.locator('#ansicht .dosis-verweis');
check(await page.locator('#ansicht [data-regel="X3"]').count() === 0 && await dVerweis.count() === 1 && (await dVerweis.innerText()).includes('wichtigen Hinweis'),
  'D11: Tag 20 nach der eigenen Änderung – „Heute" verweist auf den wichtigen Hinweis der Dosis-Karte');
// Ohne Verweis (vor der Korrektur) über „Mehr" – der Test läuft dann weiter.
if (await dVerweis.count()) await dVerweis.locator('[data-seite="dosis-karte"]').click(); else await mehrSeite('dosis-karte');
check((await page.locator('#dosis-karte li[data-grund="X3"]').innerText()).includes('bisherige Menge'), '… dort steht „nehmen Sie bis dahin wieder Ihre bisherige Menge"');

// ---------------------------------------------------------------- D17: übernommene Gründe auf der 112-Karte und neben der Frage nach dem Check

const q5Stand = (mehr = {}) => stand({
  profil: { geburtsjahr: 1962, herz: 'nein' },
  labor: [befund('b1', plus(TAG, -3), { tsh: w(0.05, 'mU/l', 0.4, 4), ft4: w(30, 'pmol/l', 12, 22) }, { verwechselt: 'einmal' })],
  nachfragen: dosisStimmt(plus(TAG, -2)),
  ...mehr,
});
await ladenHeute(q5Stand({ befinden: [{ id: 'bf', datum: TAG, stufe: 'schlecht', beschwerden: ['lebensmuede'], notiz: '' }] }));
dVerweis = page.locator('#ansicht .dosis-verweis');
check(await dVerweis.count() === 1 && await dVerweis.getAttribute('data-stufe') === 'heute',
  `D17: „lebensmüde" und Q5 „einmal viele Tabletten": der Verweis trägt die Stufe des Giftnotruf-Rats (heute), nicht 112 (${await dVerweis.getAttribute('data-stufe')})`);
check(await page.locator('#ansicht > .karte, #ansicht > .hinweis-karte').first().getAttribute('data-regel') === 'W5', '… W5 bleibt ganz oben');
await ladenHeute(q5Stand({ befinden: [{ id: 'bf', datum: TAG, stufe: 'mittel', beschwerden: ['herz'], notiz: '' }] }));
dVerweis = page.locator('#ansicht .dosis-verweis');
check(await dVerweis.count() === 1 && /Frage an Sie/.test(await dVerweis.innerText()) && /wichtigen Hinweis/.test(await dVerweis.innerText()),
  `D17: Frage nach dem Check und Q5 – der Verweis nennt beides („${(await dVerweis.innerText()).replace(/\s+/g, ' ').slice(0, 90)}…")`);

// ---------------------------------------------------------------- D19: „Nein, ich nehme etwas anderes" am Einrichtungstag

const d19 = () => stand({
  dosen: [dosis('dh', TAG, 75, null)],
  labor: [befund('b1', TAG, { tsh: w(7.5, 'mU/l', 0.4, 4), ft4: w(14, 'pmol/l', 12, 22) })],
  nachfragen: dosisStimmt(TAG, 'nein_75'),
});
await laden(d19());
await mehrSeite('dosis-karte');
const d19Knopf = page.locator('#dosis-karte [data-act="seite"][data-seite="dosis"]');
check(await d19Knopf.getAttribute('data-param') === 'dh' && (await d19Knopf.innerText()).includes('Dosis ändern'), 'D19: die Karte öffnet den vorhandenen Eintrag („Dosis ändern")');
// Trägt sie trotzdem einen zweiten Eintrag ein (über den Verlauf), ist auch
// der die Berichtigung – der vorhandene mit der Menge aus dem Nein zählt nicht.
await page.click('#reiter-verlauf');
await page.click('#ansicht [data-seite="dosis"]');
await page.fill('input[name=mikrogramm]', '100');
await page.check('input[name=praxis][value=nein]');
await page.click('form[data-formular="dosis"] button[type=submit]');
s = await gespeichert();
const d19Neu = s.dosen.find((d) => d.mikrogramm === 100);
check(d19Neu && d19Neu.berichtigung === true, `D19: der neue Eintrag (100 µg) gilt als Berichtigung (berichtigung = ${d19Neu && d19Neu.berichtigung})`);
await mehrSeite('dosis-karte');
check(await page.locator('#dosis-karte li[data-grund="X3"]').count() === 0 && !(await page.locator('#dosis-karte').innerText()).includes('bisherige Menge'),
  'D19: … die Karte nennt kein „mehr als ein üblicher Schritt … wieder Ihre bisherige Menge" – das wären die 75 µg, die sie nie genommen hat');
await page.click('#reiter-heute');
check(await page.locator('#ansicht [data-regel="X3"]').count() === 0 && await page.locator('#ansicht [data-regel="X3b"]').count() === 1,
  'D19: „Heute" nennt die Berichtigung (X3b), nicht die eigene Änderung (X3)');

// ---------------------------------------------------------------- D13: Vorrat

await ladenHeute(stand({ vorrat: { tabletten: 10, stand: plus(TAG, -20) } }));
check((await ansichtText(page)).replace(/\s+/g, ' ').includes('Der Vorrat ist aufgebraucht. Bitte heute ein neues Rezept holen.'), 'D13: aufgebraucht – „Bitte heute ein neues Rezept holen", nicht „Rechtzeitig …"');
await ladenHeute(stand({
  vorrat: { tabletten: 100, stand: plus(TAG, -30) },
  dosen: [dosis('d1', plus(TAG, -400), 75, null), dosis('d2', plus(TAG, -10), 100, true)],
}));
const neuZaehlen = page.locator('#ansicht [data-regel="vorrat-staerke"]');
check(await neuZaehlen.count() === 1 && (await neuZaehlen.innerText()).includes('zählen Sie Ihren Tablettenvorrat neu') && await neuZaehlen.locator('[data-seite="vorrat"]').count() === 1,
  'D13: seit dem Zählen eine andere Stärke – „Heute" bittet ums Neuzählen, mit Knopf zum Vorrat');
check(!(await ansichtText(page)).includes('Vorrat reicht noch'), '… und nennt keine Reichweite aus der alten Packung');
if (await neuZaehlen.count()) await neuZaehlen.locator('[data-seite="vorrat"]').click(); else await mehrSeite('vorrat');
await page.fill('input[name=tabletten]', '50');
await page.click('form[data-formular="vorrat"] button[type=submit]');
await page.click('#reiter-heute');
check(await page.locator('#ansicht [data-regel="vorrat-staerke"]').count() === 0, '… nach dem Zählen ist die Bitte weg');
await ladenHeute(stand({ vorrat: { tabletten: 100, stand: plus(TAG, -3) } }));
await page.click('#reiter-verlauf');
await page.click('#ansicht [data-seite="dosis"]');
await page.fill('input[name=mikrogramm]', '100');
await page.check('input[name=praxis][value=ja]');
await page.click('form[data-formular="dosis"] button[type=submit]');
check((await page.locator('#meldung').innerText()).includes('Tablettenvorrat neu'), `D13: nach dem Speichern einer anderen Stärke: „Bitte zählen Sie Ihren Tablettenvorrat neu" (${await page.locator('#meldung').innerText()})`);

// ---------------------------------------------------------------- D12: die Kontrolle nach der Änderung jeden Tag

// Tag 92 nach der Änderung, ohne Kontrollwert: keine eigene Karte (still),
// aber dieselbe Stufe auf „Heute" und in der Einschätzung wie an Tag 91.
const d12 = (n) => stand({
  labor: [befund('b1', plus(TAG, -n - 7), { tsh: w(4.5, 'mU/l', 0.27, 4.2), ft4: w(15, 'pmol/l', 12, 22) }, { praxis: 'geaendert', praxisAm: plus(TAG, -n - 5) })],
  dosen: [dosis('d1', plus(TAG, -400), 75, null), dosis('d2', plus(TAG, -n), 88, true)],
});
for (const [n, karte] of [[91, 1], [92, 0]]) {
  await ladenHeute(d12(n));
  check(await page.locator('#ansicht [data-regel="D6c"]').count() === karte && await page.locator('#ansicht .einschaetzung-verweis').getAttribute('data-stufe') === 'zeitnah',
    `D12: Tag ${n} – D6c ${karte ? 'als Karte' : 'still'}, die Einschätzung auf „Heute" bleibt „In ein bis zwei Wochen"`);
}
await mehrSeite('gesamtbild');
check(await page.locator('#ansicht .teil-karte[data-regel="D6c"]').count() === 1, '… und die Einschätzung nennt den Grund unter „Im Einzelnen"');

// ---------------------------------------------------------------- Runde 3 bei „sehr groß" und dunkel

for (const [seite, st] of [
  ['heute', { ...abnahmeStand(), vorrat: { tabletten: 100, stand: plus(TAG, -30) }, dosen: [dosis('d1', plus(TAG, -400), 75, null), dosis('d2', plus(TAG, -10), 100, true)] }],
  ['vergessen', stand()],
  ['notfall', stand()],
]) {
  await ladenHeute({ ...st, einstellungen: { ...st.einstellungen, schrift: 'sehr-gross', farbe: 'dunkel' } }, { zeit: '07:10' });
  if (seite !== 'heute') await zuKapitel(seite);
  const breit = await page.evaluate(() => document.documentElement.scrollWidth);
  check(breit <= 360, `Runde 3: „${seite}" bei „sehr groß" und dunkel ohne waagerechtes Scrollen (${breit} px)`);
}


// ================================================================ Runde 4 – Formulare
//
// Befunde aus der vierten Durchsicht (E…), soweit sie die Formulare, das
// Einrichten und „Meine Fragen" betreffen. Jeder Fall scheiterte vor der
// Korrektur.

const rueckfrageDialog = () => page.locator('dialog.rueckfrage');
// Vor der Korrektur fehlt manches Element – der Test soll dann scheitern, nicht hängen.
const gibt = async (sel) => (await page.locator(sel).count()) > 0;
const attr = async (sel, name) => ((await gibt(sel)) ? page.locator(sel).first().getAttribute(name) : null);
const r4Einstellungen = (schrift, farbe) => ({ erinnerung: '07:00', schrift, farbe, hinweisTablette: false });

// ---------------------------------------------------------------- E22: Befinden überschreibt keinen anderen Tag

// Gestern Herzklopfen und unregelmäßiger Puls mit Notiz, dazu TSH 0,2: „Heute"
// sagt „Heute anrufen" (S4, S4ii). Ein neuer Eintrag mit Datum gestern
// überschrieb ihn still, ein verlegter Eintrag löschte ihn.
const herzTag = plus(TAG, -1);
const herzEintrag = { id: 'bgestern', datum: herzTag, stufe: 'schlecht', beschwerden: ['herz', 'puls'], notiz: 'nachts Herzstolpern, 20 Minuten' };
const e22 = (mehr = []) => stand({
  labor: [befund('b1', plus(TAG, -12), { tsh: w(0.2, 'mU/l', 0.4, 4) })],
  befinden: [herzEintrag, { id: 'balt', datum: plus(TAG, -5), stufe: 'mittel', beschwerden: ['muede'], notiz: '' }, ...mehr],
});
const herzDa = (st) => st.befinden.some((b) => b.id === 'bgestern' && b.datum === herzTag && b.beschwerden.includes('herz') && b.notiz.includes('Herzstolpern'));
const befindenSpeichern = async () => {
  await page.click('form[data-formular="befinden"] button[type=submit]');
  await page.waitForTimeout(150);
};
const datumFehler = () => page.locator('form[data-formular="befinden"] .feld-fehler').first().innerText().catch(() => '');

// A: „Heute eintragen" (für heute gibt es keinen Eintrag), Datum auf gestern.
await laden(e22());
await page.click('#reiter-verlauf');
await page.click('#ansicht [data-seite="befinden"]:not([data-param])');
await page.fill('form[data-formular="befinden"] input[name=datum]', herzTag);
await page.click('label:has(input[name="stufe"][value="mittel"])');
await page.check('input[name=beschwerden][value=muede]');
await befindenSpeichern();
s = await gespeichert();
check(herzDa(s) && s.befinden.length === 2, `E22 A: ein neuer Eintrag mit Datum gestern überschreibt den Eintrag mit Herzklopfen nicht (${JSON.stringify(s.befinden.map((b) => [b.id, b.datum, b.beschwerden.join('+')]))})`);
check((await datumFehler()).includes('gibt es schon einen Eintrag') && await page.locator('form[data-formular="befinden"]').count() === 1,
  `E22 A: … das Formular sagt es am Datum und bleibt offen, die Eingaben stehen noch da („${(await datumFehler()).slice(0, 50)}…")`);
const zumEintrag = page.locator(`form[data-formular="befinden"] .feld-fehler [data-seite="befinden"][data-param="bgestern"]`);
check(await zumEintrag.count() === 1 && (await zumEintrag.innerText()).includes(`Eintrag vom ${kurz(herzTag)} öffnen`), 'E22 A: … mit Knopf „Eintrag vom … öffnen"');
if (await zumEintrag.count()) await zumEintrag.click();
check(await attr('form[data-formular="befinden"]', 'data-id') === 'bgestern' && await page.isChecked('input[name=beschwerden][value=herz]'),
  'E22 A: der Knopf öffnet den vorhandenen Eintrag – mit Herzklopfen angehakt');
await page.click('#reiter-heute');
check(await page.locator('#ansicht [data-regel="S4"], #ansicht [data-regel="S4ii"]').count() >= 1, 'E22 A: „Heute" nennt weiter den Grund zum Anrufen (S4/S4ii)');

// B: den Eintrag vom 22. auf gestern verlegen.
await laden(e22());
await page.click('#reiter-verlauf');
await page.click('#ansicht [data-seite="befinden-liste"]');
await page.click('#ansicht [data-seite="befinden"][data-param="balt"]');
await page.fill('form[data-formular="befinden"] input[name=datum]', herzTag);
await befindenSpeichern();
s = await gespeichert();
check(herzDa(s) && s.befinden.some((b) => b.id === 'balt' && b.datum === plus(TAG, -5)), 'E22 B: ein verlegter Eintrag löscht den Eintrag des Zieltags nicht – und bleibt selbst, wo er war');
check((await datumFehler()).includes('gibt es schon einen Eintrag'), 'E22 B: … das Formular sagt warum');

// C: Es gibt einen Eintrag von heute (das Formular trägt seine Kennung), Datum auf gestern.
await laden(e22([{ id: 'bheute', datum: TAG, stufe: 'gut', beschwerden: [], notiz: '' }]));
await page.click('#reiter-verlauf');
await page.click('#ansicht [data-seite="befinden"]:not([data-param])');
check(await attr('form[data-formular="befinden"]', 'data-id') === 'bheute', 'E22 C: das Formular zeigt den Eintrag von heute');
await page.fill('form[data-formular="befinden"] input[name=datum]', herzTag);
await befindenSpeichern();
s = await gespeichert();
check(herzDa(s) && s.befinden.some((b) => b.id === 'bheute' && b.datum === TAG), 'E22 C: der Eintrag von heute wandert nicht still auf gestern und löscht dort nichts');
// Gegenprobe: auf einen freien Tag verlegen und am eigenen Tag ändern geht wie bisher.
if (!(await gibt('form[data-formular="befinden"]'))) {
  await page.click('#reiter-verlauf');
  await page.click('#ansicht [data-seite="befinden-liste"]');
  await page.click('#ansicht [data-seite="befinden"][data-param="bheute"]');
}
await page.fill('form[data-formular="befinden"] input[name=datum]', plus(TAG, -2));
await befindenSpeichern();
s = await gespeichert();
check(s.befinden.some((b) => b.id === 'bheute' && b.datum === plus(TAG, -2)) && herzDa(s) && s.befinden.length === 3, 'E22: auf einen freien Tag verlegen geht weiterhin');
await page.click('#reiter-verlauf');
await page.click('#ansicht [data-seite="befinden-liste"]');
const herzZeile = '#ansicht [data-seite="befinden"][data-param="bgestern"]';
if (await gibt(herzZeile)) {
  await page.click(herzZeile);
  await page.check('input[name=beschwerden][value=muede]');
  await befindenSpeichern();
}
s = await gespeichert();
check(s.befinden.some((b) => b.id === 'bgestern' && b.beschwerden.includes('muede') && b.beschwerden.includes('herz')), 'E22: den vorhandenen Eintrag am eigenen Tag ergänzen geht weiterhin');

// ---------------------------------------------------------------- E32: Vorrat nach anderer Stärke

// Andere Stärke: Die Meldung schickt auf einen Weg, der leer und mit heute
// öffnet. Vorher belegte „Mehr → Tablettenvorrat" den alten Tag vor, und
// „Bitte neu zählen" blieb für immer stehen.
const vorratAlt = { tabletten: 100, stand: '2026-08-01' };
const vorratZeile = async () => {
  await page.click('#reiter-mehr');
  return (await page.locator('#ansicht .zeile[data-seite="vorrat"]').innerText()).replace(/\s+/g, ' ');
};
const r4NeueDosis = async (mikrogramm, tabletten = '1') => {
  await page.click('#reiter-verlauf');
  await page.click('#ansicht [data-seite="dosis"]');
  await page.fill('input[name=mikrogramm]', mikrogramm);
  await page.selectOption('select[name=tabletten]', tabletten);
  await page.fill('input[name=ab]', plus(TAG, -7));
  await page.check('input[name=praxis][value=ja]');
  await page.click('form[data-formular="dosis"] button[type=submit]');
  await page.waitForTimeout(150);
};
await laden(stand({ vorrat: vorratAlt }));
await r4NeueDosis('100');
const e32Meldung = await page.locator('#meldung').innerText();
check(e32Meldung.includes('Tablettenvorrat neu') && e32Meldung.includes('Vorrat neu zählen'), `E32: nach anderer Stärke nennt die Meldung den Knopf auf „Heute" („${e32Meldung}")`);
await vorratZeile();
await page.click('#ansicht .zeile[data-seite="vorrat"]');
check(await page.inputValue('input[name=stand]') === TAG && await page.inputValue('input[name=tabletten]') === '',
  `E32: „Mehr → Tablettenvorrat" öffnet nach anderer Stärke leer und mit heute (${await page.inputValue('input[name=tabletten]')} / ${await page.inputValue('input[name=stand]')})`);
await page.fill('input[name=tabletten]', '90');
await page.click('form[data-formular="vorrat"] button[type=submit]');
s = await gespeichert();
check(s.vorrat && s.vorrat.tabletten === 90 && s.vorrat.stand === TAG, `E32: gezählt wird ab heute (${JSON.stringify(s.vorrat)})`);
await page.click('#reiter-heute');
check(await page.locator('#ansicht [data-regel="vorrat-staerke"]').count() === 0 && !(await vorratZeile()).includes('neu zählen'), 'E32: … danach bittet weder „Heute" noch „Mehr" weiter ums Neuzählen');

// Nur die Tablettenzahl ändert sich (50 µg: 1½ → 1): Das rechnet die App
// selbst. Vorher bat die Meldung ums Neuzählen, der alte Tag blieb stehen,
// und aus noch 18 Tagen wurde „aufgebraucht".
await laden(stand({ vorrat: vorratAlt, dosen: [dosis('d1', plus(TAG, -400), 50, null, 1.5)] }));
await r4NeueDosis('50', '1');
check(await page.locator('#meldung').innerText() === 'Dosis gespeichert', `E32: andere Tablettenzahl, gleiche Stärke – keine Bitte ums Neuzählen („${await page.locator('#meldung').innerText()}")`);
check((await vorratZeile()).includes('Reicht noch etwa 18 Tage'), `E32: „Mehr" rechnet weiter richtig („${await vorratZeile()}")`);

// ---------------------------------------------------------------- E10: ungewöhnliche Stärke oder großer Sprung

// „7,5" statt „75": Vorher gespeichert ohne ein Wort – eine Senkung um 90 %.
await laden(stand());
await r4NeueDosis('7,5');
let e10Text = (await rueckfrageDialog().count()) ? await rueckfrageDialog().innerText() : '';
s = await gespeichert();
check(e10Text.includes('7,5 µg ist eine ungewöhnliche Stärke') && e10Text.includes('mehr als die Hälfte') && s.dosen.length === 1,
  `E10: 7,5 µg nach 75 µg – erst eine Rückfrage, nichts gespeichert („${e10Text.replace(/\s+/g, ' ').slice(0, 90)}…")`);
if (await rueckfrageDialog().count()) await page.click('dialog.rueckfrage [data-act="befund-korrigieren"]');
check(await rueckfrageDialog().count() === 0 && await gibt('input[name=mikrogramm]') && await page.inputValue('input[name=mikrogramm]') === '7,5' && (await gespeichert()).dosen.length === 1,
  'E10: „Korrigieren" – zurück ins Formular, die Eingabe steht noch da, gespeichert ist nichts');
if (await gibt('form[data-formular="dosis"]')) await page.click('form[data-formular="dosis"] button[type=submit]');
if (await rueckfrageDialog().count()) await page.click('dialog.rueckfrage [data-act="befund-bestaetigen"]');
s = await gespeichert();
check(s.dosen.length === 2 && s.dosen.some((d) => d.mikrogramm === 7.5), 'E10: „Ja, stimmt" speichert die Stärke so, wie sie auf der Packung steht');
// Übliche Stärke, aber doppelt so viel am Tag.
await laden(stand());
await r4NeueDosis('150');
e10Text = (await rueckfrageDialog().count()) ? await rueckfrageDialog().innerText() : '';
check(e10Text.includes('Bisher 75 µg am Tag, jetzt 150 µg am Tag') && !e10Text.includes('ungewöhnliche Stärke') && (await gespeichert()).dosen.length === 1,
  `E10: 75 → 150 µg am Tag – Rückfrage wegen des Sprungs („${e10Text.replace(/\s+/g, ' ').slice(0, 80)}…")`);
if (await rueckfrageDialog().count()) await page.click('dialog.rueckfrage [data-act="befund-korrigieren"]');
// Die harte Grenze bleibt – und die Meldung nennt sie.
if (!(await gibt('form[data-formular="dosis"]'))) { await laden(stand()); await page.click('#reiter-verlauf'); await page.click('#ansicht [data-seite="dosis"]'); }
await page.fill('input[name=mikrogramm]', '750');
await page.click('form[data-formular="dosis"] button[type=submit]');
const e10Grenze = await page.locator('form[data-formular="dosis"] .feld-fehler').first().innerText().catch(() => '');
check(e10Grenze.includes('zwischen 5 und 400 µg') && await rueckfrageDialog().count() === 0 && (await gespeichert()).dosen.length === 1,
  `E10: 750 µg wird wie bisher nicht angenommen – die Meldung nennt die Grenze, die gilt („${e10Grenze.slice(0, 60)}…")`);

// Einrichten mit 7,5: Vorher ging es still weiter, und „Heute" nannte täglich 7,5 µg.
await page.waitForTimeout(200);
await page.evaluate((k) => { localStorage.removeItem(k); }, SCHLUESSEL);
await page.reload({ waitUntil: 'networkidle' });
await page.click('[data-act="willkommen-weiter"]');
await page.fill('input[name=mikrogramm]', '7,5');
await page.click('[data-act="willkommen-weiter"]');
await page.waitForTimeout(150);
const e10Schritt = await page.locator('.schritte').innerText();
const e10Hinweis = (await rueckfrageDialog().count()) ? await rueckfrageDialog().innerText() : await page.locator('.feld-fehler').first().innerText().catch(() => '');
s = await gespeichert();
check(e10Schritt.includes('Schritt 2') && e10Hinweis.includes('ungewöhnliche Stärke') && !(s && s.dosen && s.dosen.length),
  `E10: Einrichten mit 7,5 µg – Schritt 2 bleibt und fragt nach, statt still weiterzugehen (${e10Schritt}, „${e10Hinweis.slice(0, 50)}…")`);
if (await rueckfrageDialog().count()) await page.click('dialog.rueckfrage [data-act="befund-korrigieren"]');

// ---------------------------------------------------------------- E12: Einrichten – der Entwurf eines Schritts

// Die Schnittstelle für „Zurück": willkommenEntwurf() liest die Felder,
// willkommenAnsicht() belegt sie damit vor – vor dem Stand. Den Weg über den
// Knopf verdrahtet js/app.js.
const e12 = await page.evaluate(async (heute) => {
  const m = await import('./js/ansicht-willkommen.js');
  const sp = await import('./js/speicher.js');
  if (typeof m.willkommenEntwurf !== 'function') return null;
  const formAus = (html) => { const d = document.createElement('div'); d.innerHTML = html; return d.querySelector('form'); };
  const wert = (form, n) => form.elements.namedItem(n).value;
  const f2 = formAus(m.willkommenAnsicht(2, sp.getStand(), heute, { praeparat: 'L-Thyroxin Henning', mikrogramm: '75', tabletten: '1.5', ab: '2025-03-01' }));
  const zwei = { mg: wert(f2, 'mikrogramm'), ab: wert(f2, 'ab'), tab: wert(f2, 'tabletten'), praep: wert(f2, 'praeparat') };
  f2.elements.namedItem('mikrogramm').value = '88';
  const entwurf = m.willkommenEntwurf(f2);
  const f1 = formAus(m.willkommenAnsicht(1, { ...sp.getStand(), profil: { ...sp.getStand().profil, behandelt: true } }, heute, { name: 'Frau Möller', geburtsjahr: '1948', behandelt: false }));
  const eins = { name: wert(f1, 'name'), jahr: wert(f1, 'geburtsjahr'), haken: f1.elements.namedItem('behandelt').checked, entwurf: m.willkommenEntwurf(f1) };
  const ohne = formAus(m.willkommenAnsicht(2, sp.getStand(), heute));
  return { zwei, entwurf, eins, ohneAb: wert(ohne, 'ab') };
}, TAG);
check(e12 && e12.zwei.mg === '75' && e12.zwei.ab === '2025-03-01' && e12.zwei.tab === '1.5' && e12.zwei.praep === 'L-Thyroxin Henning',
  `E12: Schritt 2 mit Entwurf – Stärke, „Seit wann?", Tabletten und Präparat aus dem Entwurf (${JSON.stringify(e12 && e12.zwei)})`);
check(e12 && e12.entwurf.mikrogramm === '88' && e12.entwurf.ab === '2025-03-01' && e12.entwurf.tabletten === '1.5' && !('behandelt' in e12.entwurf),
  `E12: willkommenEntwurf liest die Felder des Schritts (${JSON.stringify(e12 && e12.entwurf)})`);
check(e12 && e12.eins.name === 'Frau Möller' && e12.eins.jahr === '1948' && e12.eins.haken === false && e12.eins.entwurf.behandelt === false,
  'E12: Schritt 1 – auch ein abgewählter Haken bleibt abgewählt');
check(e12 && e12.ohneAb === TAG, 'E12: ohne Entwurf wie bisher aus dem Stand (heute)');

// ---------------------------------------------------------------- E4: Q5 im Befund-Formular ändern

// Ein Fehltipp auf „Ja, einmal viele Tabletten auf einmal": „Heute anrufen –
// Giftnotruf" blieb stehen, auch im Bericht. Das Formular hatte die Frage
// nicht und übernahm die alte Antwort bei jedem Speichern.
const zumBefund = async () => {
  await page.click('#reiter-verlauf');
  await page.click('#ansicht [data-seite="labor-liste"]');
  await page.click('#ansicht [data-seite="labor"][data-param="b1"]');
};
const befundSpeichern = async () => {
  await page.click('form[data-formular="labor"] button[type=submit]');
  await page.waitForTimeout(150);
  if (await rueckfrageDialog().count()) await page.click('dialog.rueckfrage [data-act="befund-bestaetigen"]');
};
await ladenHeute(q5Stand());
check(await attr('#ansicht .dosis-verweis', 'data-stufe') === 'heute', 'E4: vorher – Q5 „einmal viele Tabletten": „Heute" verweist mit Stufe heute auf die Karte');
await zumBefund();
const q5Feld = page.locator('form[data-formular="labor"] [data-feld="verwechselt"]');
check(await q5Feld.count() === 1 && await page.isChecked('input[name=verwechselt][value=einmal]'), 'E4: das Befund-Formular zeigt die Antwort auf Q5 zum Ändern');
if (await q5Feld.count()) await page.check('input[name=verwechselt][value=nein]');
await befundSpeichern();
s = await gespeichert();
check(s.labor[0].verwechselt === 'nein', `E4: „Nein" gespeichert (verwechselt = ${s.labor[0].verwechselt})`);
await page.click('#reiter-heute');
check(await attr('#ansicht .dosis-verweis', 'data-stufe') !== 'heute', 'E4: … „Heute" nennt keinen Giftnotruf mehr');
await mehrSeite('dosis-karte');
check(await page.locator('#dosis-karte li[data-grund="Q5"]').count() === 0, 'E4: … die Dosis-Karte auch nicht');
// „Noch offen" nimmt die Antwort zurück – die Karte fragt neu.
await zumBefund();
if (await gibt('input[name=verwechselt][value=""]')) await page.check('input[name=verwechselt][value=""]');
await befundSpeichern();
s = await gespeichert();
await mehrSeite('dosis-karte');
check(s.labor[0].verwechselt === '' && await page.locator('#dosis-karte .dosis-frage[data-frage="Q5"]').count() === 1, 'E4: „Noch offen" – die Antwort ist zurückgenommen, die Karte fragt Q5 neu');
// Ein neuer Befund stellt die Frage nicht – das tut die Karte, wo sie zählt.
await page.click('#reiter-verlauf');
await page.click('#ansicht [data-seite="labor"]:not([data-param])');
check(await page.locator('form[data-formular="labor"] input[name=verwechselt]').count() === 0, 'E4: im leeren Formular „Laborwerte eintragen" steht Q5 nicht');

// ---------------------------------------------------------------- E14: „Meine Fragen" – sichtbar, was der Knopf tut

await laden(stand({ fragen: [{ id: 'q1', text: 'Kann die Müdigkeit am Nachmittag an der Dosis liegen?', erledigt: false }] }));
await mehrSeite('fragen');
let e14 = page.locator('#ansicht [data-act="frage-erledigt"][data-id="q1"]');
// Runde 5: F8 – geprüft wird der Name für Vorleseprogramme statt des
// aria-labels: Das aria-label („Als besprochen abhaken" / „Wieder offen")
// ist weggefallen, der Name ist jetzt der sichtbare Text, der Zustand steht
// in aria-pressed. Was E14 verlangt, bleibt: Der Knopf sagt sichtbar, was er tut.
check((await e14.innerText()).includes('Besprochen?') && await page.getByRole('button', { name: 'Besprochen?', exact: true, pressed: false }).count() === 1,
  `E14: der Knopf sagt sichtbar, was er tut („${(await e14.innerText()).replace(/\s+/g, ' ')}")`);
await e14.click();
e14 = page.locator('#ansicht [data-act="frage-erledigt"][data-id="q1"]');
check((await e14.innerText()).replace(/\s+/g, ' ').trim().endsWith('Besprochen') && await e14.getAttribute('aria-pressed') === 'true', 'E14: abgehakt – „✓ Besprochen"');

// ---------------------------------------------------------------- Runde 4 bei „sehr groß", hell und dunkel

for (const farbe of ['hell', 'dunkel']) {
  const einst = r4Einstellungen('sehr-gross', farbe);
  await laden({ ...q5Stand(), einstellungen: einst, fragen: [{ id: 'q1', text: 'Kann die Müdigkeit am Nachmittag an der Dosis liegen? Und was ist mit dem Kaffee?', erledigt: false }] });
  const seiten = [];
  await mehrSeite('fragen');
  seiten.push(['Meine Fragen', await page.evaluate(() => document.documentElement.scrollWidth)]);
  await zumBefund();
  seiten.push(['Befund mit Q5', await page.evaluate(() => document.documentElement.scrollWidth)]);
  await laden({ ...e22(), einstellungen: einst });
  await page.click('#reiter-verlauf');
  await page.click('#ansicht [data-seite="befinden"]:not([data-param])');
  await page.fill('form[data-formular="befinden"] input[name=datum]', herzTag);
  await befindenSpeichern();
  seiten.push(['Befinden, Tag belegt', await page.evaluate(() => document.documentElement.scrollWidth)]);
  await laden({ ...stand({ vorrat: vorratAlt }), einstellungen: einst });
  await r4NeueDosis('7,5');
  const dialogBreit = await page.evaluate(() => {
    const d = document.querySelector('dialog.rueckfrage');
    return d ? Math.ceil(d.getBoundingClientRect().right) : 0;
  });
  seiten.push(['Rückfrage Dosis', Math.max(dialogBreit, await page.evaluate(() => document.documentElement.scrollWidth))]);
  if (await rueckfrageDialog().count()) await page.click('dialog.rueckfrage [data-act="befund-korrigieren"]');
  const zuBreit = seiten.filter(([, b]) => b > 360);
  check(!zuBreit.length, `Runde 4: bei „sehr groß" und ${farbe} ohne waagerechtes Scrollen (${seiten.map(([n, b]) => `${n} ${b}`).join(', ')})`);
}

// ================================================================ Runde 4 – Ansichten
//
// Befunde aus der vierten Durchsicht (E…), soweit sie „Heute", die
// Einschätzung, die Dosis-Karte, den Verlauf und den Bericht betreffen. Jeder
// Fall scheiterte vor der Korrektur. Was js/app.js dazu verdrahtet (zur
// Auswahl „Bundesland" scrollen, „Noch nichts entschieden" speichern),
// prüfen die Fälle hier nur an den Knöpfen.

const r4a = {
  text: async (sel) => ((await gibt(sel)) ? (await page.locator(sel).first().innerText()).replace(/\s+/g, ' ') : ''),
  zumCheck: async () => {
    await page.click('#reiter-heute');
    await page.click('#ansicht [data-seite="warnzeichen"]');
    await page.click('form[data-formular="warnzeichen"] button[type=submit]');
    await page.waitForTimeout(150);
  },
};

// ---------------------------------------------------------------- E1: „Die Dosis wird geändert" – und dann abgebrochen

// TSH < 0,01 und fT4 2,1 ng/dl; ein Fehltipp auf „Neue Dosis eintragen",
// danach „Abbrechen": gespeichert bleibt „geändert", eine Dosis fehlt. Vorher
// stand dann auf „Heute" monatelang nichts zu diesem Befund.
const e1 = () => stand({
  labor: [befund('b1', plus(TAG, -3), { tsh: w(0.01, 'mIE/l', 0.27, 4.2, true), ft4: w(2.1, 'ng/dl', 0.93, 1.7) }, { praxis: 'geaendert', praxisAm: TAG })],
});
await ladenHeute(e1());
const e1Verweis = '#ansicht .dosis-verweis';
check((await r4a.text(e1Verweis)).includes('Bitte tragen Sie die neue Dosis ein') && ['termin', 'zeitnah', 'tage', 'heute'].includes(await attr(e1Verweis, 'data-stufe')),
  `E1: „Heute" bittet um die neue Dosis, mindestens „Beim nächsten Termin" (${await attr(e1Verweis, 'data-stufe')}: „${(await r4a.text(e1Verweis)).slice(0, 70)}…")`);
const e1Knopf = `${e1Verweis} [data-act="seite"][data-seite="dosis"][data-param="praxis"]`;
check(await gibt(e1Knopf) && await gibt(`${e1Verweis} [data-seite="dosis-karte"]`), 'E1: … mit „Neue Dosis eintragen" (Quelle Praxis) und „Dosis-Karte ansehen"');
if (await gibt(e1Knopf)) {
  await page.click(e1Knopf);
  check(await gibt('form[data-formular="dosis"]') && await page.isChecked('input[name=praxis][value=ja]'), 'E1: der Knopf öffnet das Dosis-Formular mit „auf Anweisung der Praxis: ja"');
}
// E1, E9, E21: Auf der Seite „Die Praxis hat entschieden" lässt sich die
// Angabe zurücknehmen – und der Wert steht wie auf dem Befund da.
await mehrSeite('dosis-karte');
await page.click('#dosis-karte [data-seite="praxis-entschieden"]');
check(await gibt('[data-act="praxis-entscheid"][data-id="b1"][data-wert="nochnicht"]') && (await r4a.text('[data-act="praxis-entscheid"][data-wert="nochnicht"]')) === 'Noch nichts entschieden',
  'E1: „Die Praxis hat entschieden" bietet „Noch nichts entschieden"');
check((await ansichtText(page)).includes('(TSH < 0,01 mIE/l)'), `E9: die Seite nennt „TSH < 0,01 mIE/l" – mit dem Zeichen (${(await ansichtText(page)).split('\n')[0].slice(0, 80)})`);

// ---------------------------------------------------------------- E4: Antworten auf der Dosis-Karte ändern

// Q5 „einmal viele Tabletten" als Fehltipp: Die Karte zeigt die Antwort mit
// „ändern", aufgeklappt, weil sie gerade den Giftnotruf auslöst.
await laden(q5Stand());
await mehrSeite('dosis-karte');
const q5Zeile = '#ansicht details.antworten-block [data-antwort="verwechselt"]';
check(await gibt('#ansicht details.antworten-block[open]') && (await r4a.text(q5Zeile)).includes('Ja, einmal viele Tabletten auf einmal'),
  'E4: „Ihre Antworten zu diesem Befund" – aufgeklappt, mit „Versehentlich mehr genommen: Ja, einmal viele Tabletten auf einmal"');
if (await gibt(q5Zeile)) {
  await page.click(`${q5Zeile} summary`);
  await page.click(`${q5Zeile} [data-act="frage-antwort"][data-wert="nein"]`);
}
s = await gespeichert();
check(s.labor[0].verwechselt === 'nein' && await page.locator('#dosis-karte li[data-grund="Q5"]').count() === 0,
  `E4: „ändern" → „Nein" speichert die Antwort, der Giftnotruf-Grund ist weg (verwechselt = ${s.labor[0].verwechselt})`);
await page.click('#reiter-heute');
check(await attr('#ansicht .dosis-verweis', 'data-stufe') !== 'heute' && await attr('#ansicht .einschaetzung-verweis', 'data-stufe') !== 'heute', 'E4: … auch „Heute" sagt nicht mehr „Heute anrufen"');

// X3 „Nein, ich nehme etwas anderes" als Fehltipp: zurück auf „Ja" – ohne
// den Umweg über einen unveränderten Dosis-Eintrag.
await laden(stand({ labor: [befund('b1', plus(TAG, -5), { tsh: w(5.8, 'mU/l', 0.4, 4) })], nachfragen: dosisStimmt(plus(TAG, -2), 'nein_75') }));
await mehrSeite('dosis-karte');
const x3Zeile = '#ansicht details.antworten-block [data-antwort="dosis_stimmt"]';
check(await gibt('#dosis-karte li[data-grund="X3"]') && await gibt('#ansicht details.antworten-block[open]') && (await r4a.text(x3Zeile)).includes('Nein, ich nehme etwas anderes'),
  'E4: nach X3 „Nein" steht die Antwort aufgeklappt da');
const x3Ja = `${x3Zeile} [data-act="frage-antwort"][data-wert="ja"]`;
if (await gibt(x3Zeile)) await page.click(`${x3Zeile} summary`);
check((await r4a.text(x3Ja)).includes('Ja, genau 75 µg am Tag'), `E4: „ändern" zeigt „Ja, genau 75 µg am Tag" („${await r4a.text(x3Ja)}")`);
if (await gibt(x3Ja)) await page.click(x3Ja);
s = await gespeichert();
check(s.nachfragen.filter((n) => n.art === 'dosis_stimmt').pop().antwort === 'ja' && await page.locator('#dosis-karte li[data-grund="X3"]').count() === 0,
  'E4: „Ja" gespeichert – die Karte ist nicht mehr gesperrt');
// Ohne auslösende Antwort bleibt der Block zu – die Richtung und ihr Pflichttext stehen nicht unter einer Liste.
check(await gibt('#ansicht details.antworten-block') && !(await gibt('#ansicht details.antworten-block[open]')), 'E4: sonst ist der Block zugeklappt');

// ---------------------------------------------------------------- E6: Check ohne Kreuz neben einer höheren Stufe

await ladenHeute(q5Stand());
await r4a.zumCheck();
const e6Weiter = '#ansicht [data-regel="gesamt"]';
check(await attr(e6Weiter, 'data-stufe') === 'heute' && (await r4a.text(e6Weiter)).includes('Unabhängig vom Check gilt weiter') && await gibt(`${e6Weiter} [data-seite="gesamtbild"]`),
  `E6: „Nichts davon" neben Q5 „einmal": oben „Unabhängig vom Check gilt weiter: Heute anrufen" mit „Einschätzung ansehen" (${await attr(e6Weiter, 'data-stufe')})`);
check(await gibt(`${e6Weiter} a[href="tel:116117"]`) && await gibt(`${e6Weiter} a[href="tel:022819240"]`),
  'E6: … die genannte Nummer 116 117 und der Giftnotruf, um den es geht, sind anrufbar');
const e6W3 = await r4a.text('#ansicht [data-regel="W3"]');
check(e6W3 && !e6W3.includes('beim nächsten Termin') && e6W3.includes('Für Ihren Befund gilt weiter') && !(await gibt('#ansicht [data-seite="frage"]')),
  `E6: „Nichts davon" nennt keinen Termin mehr und bietet kein „Frage notieren" („${e6W3.slice(0, 70)}…")`);
// Gegenprobe: Ohne höhere Stufe bleibt es beim bisherigen Ergebnis.
await ladenHeute(stand({ labor: [befund('b1', plus(TAG, -5), { tsh: w(2.1, 'mU/l', 0.4, 4) })] }));
await r4a.zumCheck();
check(!(await gibt(e6Weiter)) && (await r4a.text('#ansicht [data-regel="W3"]')).includes('beim nächsten Termin') && await gibt('#ansicht [data-seite="frage"]'),
  'E6: Gegenprobe – ohne höhere Stufe „Beim nächsten Termin" mit „Frage notieren" wie bisher');

// ---------------------------------------------------------------- E8: „Bundesland eintragen" mit Ziel

await ladenHeute(stand({ profil: { bundesland: '' } }));
check(await gibt('#ansicht .notfall-leiste [data-seite="profil"][data-param="bundesland"]'), 'E8: „Bundesland eintragen" in der Notfallleiste trägt das Ziel (data-param="bundesland")');
await zuKapitel('vergessen');
check(await gibt('#ansicht article [data-seite="profil"][data-param="bundesland"]'), 'E8: … ebenso im Wissen');

// ---------------------------------------------------------------- E9, E21: Werte wie auf dem Befund

await laden(stand({
  labor: [befund('b0', plus(TAG, -120), { tsh: w(2.4, 'mU/l', 0.27, 4.2) }),
    befund('b1', plus(TAG, -7), { tsh: w(0.015, 'mU/l', 0.27, 4.2), ft4: w(1.125, 'ng/dl', 0.93, 1.7) }),
    befund('b2', plus(TAG, -3), { tsh: w(0.01, 'mU/l', 0.27, 4.2, true) })],
}));
await page.click('#reiter-verlauf');
const e21Karte = await r4a.text('#ansicht .befund[data-befund="b1"]');
check(e21Karte.includes('0,015 mU/l') && e21Karte.includes('1,125 ng/dl') && !e21Karte.includes('0,02 mU/l'),
  `E21: der Verlauf zeigt TSH 0,015 und fT4 1,125 so, wie eingetragen – nicht „0,02"/„1,13" (${e21Karte.slice(0, 80)}…)`);
const e9Kurve = await attr('#ansicht .verlauf-svg', 'aria-label');
check(e9Kurve && e9Kurve.includes('< 0,01 mU/l') && e9Kurve.includes('0,015 mU/l'), `E9, E21: die Beschreibung der Kurve nennt „< 0,01" und „0,015" (${e9Kurve})`);
await mehrSeite('bericht');
const e21Bericht = await r4a.text('#berichtText');
check(e21Bericht.includes('TSH 0,015 mU/l (Labor 0,27–4,2)') && e21Bericht.includes('fT4 1,125 ng/dl (Labor 0,93–1,7)'),
  'E21: der Bericht schreibt die Werte ungerundet ab');

// ---------------------------------------------------------------- E11: Bereich der weiteren Werte, Umbruch

const e11 = (einst) => ({
  ...stand({ labor: [befund('b1', plus(TAG, -5), { tsh: w(2.1, 'mU/l', 0.4, 4), crp: { wert: 3.2, einheit: 'mg/l', von: null, bis: 5, unter: false } })] }),
  ...(einst ? { einstellungen: einst } : {}),
});
await laden(e11());
await page.click('#reiter-verlauf');
check((await r4a.text('#ansicht .weitere-werte')).includes('CRP (Entzündungswert) 3,2 mg/l (Bereich Ihres Labors bis 5 mg/l)'),
  `E11: der eingetragene Bereich steht beim Wert (${(await r4a.text('#ansicht .weitere-werte')).slice(0, 80)}…)`);
check(!/im Bereich|über dem Bereich/.test(await r4a.text('#ansicht .weitere-werte')), 'E11: … nur als Text, ohne Lage (E13: nicht nach dem Laborbereich werten)');
for (const farbe of ['hell', 'dunkel']) {
  await laden(e11(r4Einstellungen('sehr-gross', farbe)));
  await page.click('#reiter-verlauf');
  const mass = await page.evaluate(() => {
    const zeile = document.querySelector('[data-weiterer="crp"]');
    if (!zeile) return null;
    const t = zeile.querySelector('b').firstChild;
    const r = document.createRange();
    r.setStart(t, t.data.indexOf('('));
    r.setEnd(t, t.data.length);
    return { zahl: zeile.querySelector('.zahl').getClientRects().length, wort: r.getClientRects().length, breit: document.documentElement.scrollWidth };
  });
  check(mass && mass.zahl === 1 && mass.wort === 1 && mass.breit <= 360,
    `E11: „sehr groß", ${farbe}: „(Entzündungswert)" bricht nicht im Wort, „3,2 mg/l" steht in einer Zeile (${JSON.stringify(mass)})`);
}

// ---------------------------------------------------------------- E13: Einnahmen am Einrichtungstag

await laden(stand({ profil: { seit: TAG }, einnahmen: {} }));
await page.click('#reiter-verlauf');
const e13 = await ansichtText(page);
check(e13.includes('Ab heute zählt die App hier Ihre Einnahmen mit') && !e13.includes('Sobald eine Dosis eingetragen ist'),
  'E13: am Einrichtungstag „Ab heute zählt die App …" – nicht „Sobald eine Dosis eingetragen ist"');

// ---------------------------------------------------------------- E15: Check von heute ohne P6-Haken

const ohneP6 = (ja) => stand({ profil: { behandelt: false, ursache: '' }, warnzeichen: [{ id: 'wz', datum: TAG, uhr: '08:50', ja }] });
await ladenHeute(ohneP6(['packung']));
check(await gibt('#ansicht [data-regel="W4a"] a[href="tel:022819240"]') && await gibt('#ansicht [data-regel="W4a"] a[href="tel:112"]') && await gibt('#ansicht #p6'),
  'E15: ohne P6 steht „Jetzt den Giftnotruf anrufen" aus dem Check von heute auf „Heute" – mit Giftnotruf und 112');
await ladenHeute(ohneP6(['erbrechen']));
check(await gibt('#ansicht [data-regel="W2h"] a[href="tel:116117"]') && (await r4a.text('#ansicht [data-regel="W2h"]')).includes('Heute anrufen'),
  'E15: … ebenso „Heute anrufen" (W2h) mit 116 117');
await ladenHeute(ohneP6(['brust', 'packung']));
check(await gibt('#ansicht [data-regel="W1"] a[href="tel:112"]') && !(await gibt('#ansicht [data-regel="W4a"]')), 'E15: bei W1 nur der 112-Text (RW1 W1)');
await ladenHeute(ohneP6([]));
check(!(await gibt('#ansicht [data-regel="W3"]')) && !(await gibt('#ansicht .kern-hinweis')), 'E15: „Nichts davon" steht nicht auf „Heute"');

// ---------------------------------------------------------------- E34: Blutabnahme ohne Uhrzeit, Einnahme abends

const e34 = (uhr) => stand({
  einstellungen: { erinnerung: '22:00', schrift: 'gross', farbe: 'hell', hinweisTablette: false },
  termine: [{ id: 't1', datum: TAG, uhr, art: 'labor', wo: '', blutabnahme: true, notiz: '' }],
});
await ladenHeute(e34(''), { zeit: '22:05' });
check((await attr('.tablette', 'class')).includes('faellig') && (await r4a.text('.tablette')).includes('Heute erst nach der Blutabnahme'),
  `E34: Abnahme ohne Uhrzeit – ab der gewohnten Zeit mahnt der Knopf wieder, mit „erst nach der Blutabnahme" (${await attr('.tablette', 'class')})`);
await ladenHeute(e34(''), { zeit: '21:00' });
check(!(await attr('.tablette', 'class')).includes('faellig'), 'E34: … vor der gewohnten Zeit nicht');
await ladenHeute({ ...e34('09:30'), einstellungen: { erinnerung: '07:00', schrift: 'gross', farbe: 'hell', hinweisTablette: false } }, { zeit: '07:10' });
check(!(await attr('.tablette', 'class')).includes('faellig'), 'E34: Gegenprobe D16 – Abnahme um 9:30, um 7:10 kein Mahnen');

// ---------------------------------------------------------------- E7: der Weg zum Nachtragen

await laden(stand({ labor: [befund('b1', plus(TAG, -5), { tsh: w(5.8, 'mU/l') })] }));
await page.click('#reiter-verlauf');
const e7Direkt = '#ansicht .knopf-reihe [data-seite="labor"][data-param="b1"]';
check(await gibt(e7Direkt) && await gibt('#ansicht [data-seite="labor-liste"]'), 'E7: bei einem Befund öffnet „Ändern" ihn direkt; die Liste bleibt als „Alle anzeigen"');
if (await gibt(e7Direkt)) await page.click(e7Direkt);
check(await attr('form[data-formular="labor"]', 'data-id') === 'b1', 'E7: … ein Tipp, und das Formular des Befunds ist offen');
// Die Karte verlangt den Bereich – und führt jetzt mit einem Knopf dorthin
// (die Aktion 'labor' aus js/dosis.js). Vorher gab es nur „Die Praxis hat entschieden".
await mehrSeite('dosis-karte');
check(await gibt('#dosis-karte [data-act="seite"][data-seite="labor"][data-param="b1"]'), 'E7: die Dosis-Karte, die den TSH-Bereich verlangt, hat einen Knopf in den Befund');
await laden(stand({ profil: { krebs: 'unbekannt' }, labor: [befund('b1', plus(TAG, -5), { tsh: w(5.8, 'mU/l', 0.4, 4) })] }));
await mehrSeite('dosis-karte');
check(await gibt('#dosis-karte li[data-grund="D0.13"]') && await gibt('#dosis-karte [data-act="seite"][data-seite="profil"]'), 'E7: Krebs „Weiß nicht" – die Karte hat einen Knopf zu „Über mich"');

// ---------------------------------------------------------------- Runde 4 (Ansichten) bei „sehr groß", hell und dunkel

for (const farbe of ['hell', 'dunkel']) {
  const einst = r4Einstellungen('sehr-gross', farbe);
  const seiten = [];
  const breite = async (name) => seiten.push([name, await page.evaluate(() => document.documentElement.scrollWidth)]);
  await ladenHeute({ ...e1(), einstellungen: einst });
  await breite('Heute mit Bitte um die neue Dosis');
  await laden({ ...q5Stand(), einstellungen: einst });
  await mehrSeite('dosis-karte');
  if (await gibt('#ansicht details.antworten-block [data-antwort="verwechselt"] summary')) await page.click('#ansicht details.antworten-block [data-antwort="verwechselt"] summary');
  await breite('Dosis-Karte mit Antworten');
  await r4a.zumCheck();
  await breite('Check mit „gilt weiter"');
  await ladenHeute({ ...ohneP6(['packung']), einstellungen: einst });
  await breite('Heute ohne P6 mit Check');
  const zuBreit = seiten.filter(([, b]) => b > 360);
  check(!zuBreit.length, `Runde 4 (Ansichten): bei „sehr groß" und ${farbe} ohne waagerechtes Scrollen (${seiten.map(([n, b]) => `${n} ${b}`).join(', ')})`);
}


// ================================================================ Runde 4 – App
//
// Befunde aus der vierten Durchsicht (E…), die js/app.js betreffen: die
// Rückfragen, der Doppeltipp, die Zurück-Taste des Handys, der Tageswechsel,
// das Einlesen einer Sicherung, Kalender und Systemhinweis. Jeder Fall
// scheiterte vor der Korrektur. Das Neuladen nach einem Update und den
// Service Worker prüft tests/test-sd-offline.mjs.

const r4app = {
  text: async (sel) => ((await gibt(sel)) ? (await page.locator(sel).first().innerText()).replace(/\s+/g, ' ') : ''),
  praxisDialog: 'dialog.rueckfrage[data-frage="praxis"]',
  // Vor der Korrektur fehlt manches – der Test soll dann scheitern, nicht hängen.
  klick: async (sel) => { if (await gibt(sel)) await page.click(sel); },
  meldung: () => page.locator('#meldung').innerText(),
};
/** Fokus und Wert, ohne auf ein Feld zu warten, das es vor der Korrektur nicht gibt. */
const fokusName = (pg = page) => pg.evaluate(() => (document.activeElement ? document.activeElement.getAttribute('name') || document.activeElement.textContent.trim() : ''));
const feldWert = (sel, pg = page) => pg.evaluate((x) => { const el = document.querySelector(x); return el ? el.value : null; }, sel);

// ---------------------------------------------------------------- E1: „Neue Dosis eintragen", dann „Abbrechen"

// TSH < 0,01 und fT4 2,1 ng/dl, F8 „noch nicht". Ein Fehltipp auf „Die
// Praxis hat entschieden → Neue Dosis eintragen", danach „Abbrechen": Vorher
// blieb „geändert" gespeichert, und „Heute" schwieg zu diesem Befund.
const e1App = (fragen = {}) => stand({
  labor: [befund('b1', plus(TAG, -3), { tsh: w(0.01, 'mIE/l', 0.27, 4.2, true), ft4: w(2.1, 'ng/dl', 0.93, 1.7) }, fragen)],
});
await ladenHeute(e1App());
const e1Stufe = await attr('#ansicht .einschaetzung-verweis', 'data-stufe');
await mehrSeite('dosis-karte');
await page.click('#dosis-karte [data-seite="praxis-entschieden"]');
await page.click('[data-act="praxis-entscheid"][data-wert="geaendert"]');
await r4app.klick('form[data-formular="dosis"] [data-act="zurueck"]');
const e1Frage = await r4app.text(r4app.praxisDialog);
check(e1Frage.includes('Hat die Praxis Ihre Dosis schon geändert?') && e1Frage.includes('Ja – ich trage sie später ein') && e1Frage.includes('Nein, noch nichts entschieden'),
  `E1: „Abbrechen" ohne neue Dosis fragt, ob die Praxis schon geändert hat („${e1Frage.slice(0, 70)}…")`);
check(await page.locator(`${r4app.praxisDialog} button:disabled`).count() === 3, 'E1: … die Antworten sind im ersten Moment gesperrt (kein Doppeltipp auf „Abbrechen")');
await r4app.klick(`${r4app.praxisDialog} [data-wert="nein"]`);
s = await gespeichert();
check(s.labor[0].praxis === 'nochnicht' && s.labor[0].praxisAm === plus(TAG, -1) && s.dosen.length === 1,
  `E1: „Nein, noch nichts entschieden" stellt die Angabe von vorher wieder her (${s.labor[0].praxis}, ${s.labor[0].praxisAm})`);
check((await r4app.meldung()).includes('noch nichts entschieden') && await gibt('#dosis-karte'), 'E1: … mit Meldung, zurück auf der Dosis-Karte');
await page.click('#reiter-heute');
const e1Danach = await attr('#ansicht .einschaetzung-verweis', 'data-stufe');
check(Boolean(e1Stufe) && e1Danach === e1Stufe, `E1: … „Heute" nennt wieder die Einschätzung von vorher (${e1Stufe} → ${e1Danach})`);

// F8 „Ja: Die Dosis wird geändert" auf der Karte, eine Stärke angefangen,
// dann „‹ Zurück": dieselbe Frage – sie deckt die ungespeicherte Eingabe mit ab.
await laden(stand({ labor: [befund('b1', plus(TAG, -5), { tsh: w(7.5, 'mU/l', 0.4, 4) }, { praxis: '', praxisAm: null })] }));
await mehrSeite('dosis-karte');
await r4app.klick('#dosis-karte [data-act="frage-antwort"][data-feld="praxis"][data-wert="geaendert"]');
const e1n = dialoge.length;
if (await gibt('form[data-formular="dosis"]')) await page.fill('input[name=mikrogramm]', '88');
await page.click('#kopf .kopf-zurueck');
check(await gibt(r4app.praxisDialog), 'E1: nach F8 „Ja: Die Dosis wird geändert" fragt auch „‹ Zurück"');
await r4app.klick(`${r4app.praxisDialog} [data-wert="bleiben"]`);
check(await gibt('form[data-formular="dosis"]') && await feldWert('input[name=mikrogramm]') === '88' && await fokusName() === 'mikrogramm',
  'E1: „Zurück zum Formular" – die Eingabe steht noch da, der Fokus auf der Stärke');
await r4app.klick('form[data-formular="dosis"] [data-act="zurueck"]');
await r4app.klick(`${r4app.praxisDialog} [data-wert="spaeter"]`);
s = await gespeichert();
check(s.labor[0].praxis === 'geaendert' && s.dosen.length === 1 && (await r4app.meldung()).includes('sobald Sie sie kennen') && await gibt('#dosis-karte'),
  'E1: „Ja – ich trage sie später ein": „geändert" bleibt, keine Dosis gespeichert, zurück auf der Karte');
check(dialoge.length === e1n, 'E1: … ohne zusätzliche Browser-Rückfrage');

// „Noch nichts entschieden" auf der Seite „Die Praxis hat entschieden".
await laden(e1App({ praxis: 'geaendert', praxisAm: plus(TAG, -2) }));
await mehrSeite('dosis-karte');
await page.click('#dosis-karte [data-seite="praxis-entschieden"]');
await page.click('[data-act="praxis-entscheid"][data-wert="nochnicht"]');
s = await gespeichert();
check(s.labor[0].praxis === 'nochnicht' && s.labor[0].praxisAm === TAG && await gibt('#dosis-karte') && (await r4app.meldung()).includes('noch nichts entschieden'),
  `E1: „Noch nichts entschieden" nimmt die Angabe zurück – mit Datum, zurück zur Karte (${s.labor[0].praxis}, ${s.labor[0].praxisAm})`);

// ---------------------------------------------------------------- E2, E10: die Rückfrage wird gelesen

// TSH 0,21 statt 2,1: Die Rückfrage legte „Ja, stimmt" dorthin, wo eben
// „Speichern" war, schon mit Fokus – ein zweiter Tipp gleich danach bestätigte
// ungelesen. Nachgestellt: ein Klick auf „Ja, stimmt", sobald der Dialog steht.
await laden(stand({ labor: [befund('b0', plus(TAG, -100), { tsh: w(2.1, 'mU/l', 0.27, 4.2) })] }));
await page.click('#reiter-verlauf');
await page.click('#ansicht [data-seite="labor"]:not([data-param])');
await page.fill('form[data-formular="labor"] input[name=datum]', plus(TAG, -3));
await page.fill('input[name=tsh_wert]', '0,21');
await page.fill('input[name=tsh_von]', '0,27');
await page.fill('input[name=tsh_bis]', '4,2');
await page.click('form[data-formular="labor"] button[type=submit]');
const e2Ja = await page.evaluate(() => {
  const b = document.querySelector('dialog.rueckfrage [data-act="befund-bestaetigen"]');
  if (!b) return null;
  const r = b.getBoundingClientRect();
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
});
const e2Fokus = await fokusName();
if (e2Ja) await page.mouse.click(e2Ja.x, e2Ja.y);
await page.waitForTimeout(100);
s = await gespeichert();
check(e2Ja && s.labor.length === 1 && await rueckfrageDialog().count() === 1, 'E2: ein Tipp auf „Ja, stimmt" gleich nach dem Öffnen bestätigt nicht – die Rückfrage steht noch da, nichts gespeichert');
check(e2Fokus === 'Bitte prüfen', `E2: der Fokus liegt auf der Überschrift, nicht auf „Ja, stimmt" (${e2Fokus})`);
if (await rueckfrageDialog().count()) await page.click('dialog.rueckfrage [data-act="befund-bestaetigen"]');
s = await gespeichert();
check(s.labor.some((l) => l.tsh && l.tsh.wert === 0.21 && l.bestaetigt === true), 'E2: gelesen und bestätigt – gespeichert mit Bestätigung');

// Die Rückfrage zur Stärke fragt nach der Packung, und „Korrigieren" führt zur Stärke.
await laden(stand());
await r4NeueDosis('7,5');
// 75 → 7,5 µg: ungewöhnliche Stärke und Sprung um mehr als die Hälfte – dann
// fragt der Satz nach beidem (js/ansicht-formulare.js). Nur die Stärke fragt
// nach der Packung – das prüft das Einrichten unten.
const e10Satz = await r4app.text('dialog.rueckfrage p');
check(e10Satz === 'Stimmen Stärke und Tabletten am Tag genau so?', `E10 (App): die Rückfrage zur Dosis fragt nicht nach dem Befund („${e10Satz}")`);
if (await rueckfrageDialog().count()) await page.click('dialog.rueckfrage [data-act="befund-korrigieren"]');
check(await fokusName() === 'mikrogramm', `E10 (App): „Korrigieren" führt zum Feld „Stärke" (${await fokusName()})`);

// ---------------------------------------------------------------- E12, E10: Einrichten

await page.waitForTimeout(200);
await page.evaluate((k) => { localStorage.removeItem(k); }, SCHLUESSEL);
await page.reload({ waitUntil: 'networkidle' });
await page.click('[data-act="willkommen-weiter"]');
await page.fill('input[name=mikrogramm]', '75');
await page.fill('input[name=ab]', '2025-03-01');
await page.click('[data-act="willkommen-zurueck"]');
await page.click('[data-act="willkommen-weiter"]');
check(await feldWert('input[name=mikrogramm]') === '75' && await feldWert('input[name=ab]') === '2025-03-01',
  `E12: Schritt 2 → „Zurück" → „Weiter": Stärke und „Seit wann?" stehen noch da (${await feldWert('input[name=mikrogramm]')} / ${await feldWert('input[name=ab]')})`);
await page.fill('input[name=mikrogramm]', '7,5');
await page.click('[data-act="willkommen-weiter"]');
check(await rueckfrageDialog().count() === 1 && (await r4app.text('dialog.rueckfrage')).includes('Steht die Zahl genau so auf der Packung?'),
  'E10 (App): beim Einrichten fragt die App mit dem Dialog nach 7,5 µg');
if (await rueckfrageDialog().count()) await page.click('dialog.rueckfrage [data-act="befund-bestaetigen"]');
s = await gespeichert();
check((await r4app.text('.schritte')).includes('Schritt 3') && s.dosen.length === 1 && s.dosen[0].mikrogramm === 7.5 && s.dosen[0].ab === '2025-03-01',
  'E10 (App): „Ja, stimmt" speichert 7,5 µg ab 01.03.2025 und führt zu Schritt 3');

// ---------------------------------------------------------------- E14: Meldung beim Abhaken einer Frage

await laden(stand({ fragen: [{ id: 'q1', text: 'Kann die Müdigkeit an der Dosis liegen?', erledigt: false }, { id: 'q2', text: 'Wann ist die nächste Kontrolle?', erledigt: false }] }));
await mehrSeite('fragen');
await page.click('#ansicht [data-act="frage-erledigt"][data-id="q1"]');
check((await r4app.meldung()).includes('Als besprochen markiert – steht jetzt unten unter „Besprochen"'), `E14: abgehakt – die Meldung sagt, wohin die Frage gewandert ist („${await r4app.meldung()}")`);
await page.click('#ansicht [data-act="frage-erledigt"][data-id="q1"]');
check(await r4app.meldung() === 'Wieder offen', 'E14: … und zurück: „Wieder offen"');

// ---------------------------------------------------------------- E8: zum Bundesland

await ladenHeute({ ...stand({ profil: { bundesland: '' } }), einstellungen: r4Einstellungen('sehr-gross', 'hell') });
await page.click('#ansicht .notfall-leiste [data-seite="profil"][data-param="bundesland"]');
const e8 = await page.evaluate(() => {
  const f = document.querySelector('select[name="bundesland"]');
  if (!f) return null;
  const r = f.getBoundingClientRect();
  return { oben: Math.round(r.top), unten: Math.round(r.bottom), hoehe: window.innerHeight, fokus: document.activeElement === f };
});
check(e8 && e8.oben >= 0 && e8.unten <= e8.hoehe && e8.fokus, `E8: „Bundesland eintragen" – die Auswahl steht im Bild und hat den Fokus (${JSON.stringify(e8)})`);

// ---------------------------------------------------------------- E16: die gezeigte Richtung mit Titel

await laden(stand({
  profil: { geburtsjahr: 1958, herz: 'nein' },
  labor: [befund('b1', plus(TAG, -5), { tsh: w(7.8, 'mU/l', 0.27, 4.2) })],
  nachfragen: dosisStimmt(plus(TAG, -2), 'ja'),
}));
await mehrSeite('dosis-karte');
const e16Richtung = await attr('#dosis-karte', 'data-richtung');
await page.click('#reiter-heute');
await mehrSeite('dosis-karte');
s = await gespeichert();
const e16 = s.nachfragen.filter((n) => n.art === 'karte_gezeigt');
check(['mehr', 'weniger', 'gleich'].includes(e16Richtung) && e16.length === 1 && e16[0].bezug === 'b1' && e16[0].antwort === e16Richtung && e16[0].am === TAG
  && typeof e16[0].titel === 'string' && e16[0].titel.length > 10,
  `E16: die gezeigte Richtung steht einmal in den Nachfragen – mit dem Titel der Karte (${JSON.stringify(e16)})`);

// ---------------------------------------------------------------- E23: vor dem Einlesen einer Sicherung

const e23Datei = {
  name: 'schilddruese-sicherung-2026-03-01.json',
  mimeType: 'application/json',
  buffer: Buffer.from(JSON.stringify({
    version: 2, app: 'schilddruese', exportiertAm: '2026-03-01T10:00:00.000Z', profil: { name: '', begruesst: true },
    dosen: [{ id: 'd1', ab: plus(TAG, -400), praeparat: 'L-Thyroxin', mikrogramm: 75, tabletten: 1, notiz: '' }],
    einnahmen: {}, labor: [], befinden: [], gewicht: [], termine: [], fragen: [],
  })),
};
await laden(stand({
  einnahmen: Object.fromEntries(Array.from({ length: 30 }, (_, i) => [plus(TAG, -i - 1), { uhr: '07:00' }])),
  labor: [befund('b1', plus(TAG, -50), { tsh: w(2.4, 'mU/l', 0.27, 4.2) }), befund('b2', plus(TAG, -5), { tsh: w(0.08, 'mU/l', 0.27, 4.2) })],
}));
await page.evaluate((k) => localStorage.removeItem(`${k}.vorImport`), SCHLUESSEL);
const e23Einlesen = async (antwort) => {
  await page.click('#reiter-mehr');
  await page.click('#ansicht [data-seite="sicherung"]');
  const n = dialoge.length;
  browserDialog.antwort = antwort;
  await page.setInputFiles('#sicherungDatei', e23Datei);
  await page.waitForTimeout(400);
  browserDialog.antwort = true;
  return dialoge.slice(n);
};
let e23Dialoge = await e23Einlesen(false);
const e23Frage = (e23Dialoge.find((t) => t.includes('einlesen?')) || '').replace(/\s+/g, ' ');
check(e23Frage.startsWith('Sicherung vom 01.03.2026 einlesen?') && e23Frage.includes(`Sie ersetzt alles auf diesem Handy (2 Befunde, Einnahmen bis ${kurz(plus(TAG, -1))})`)
  && e23Frage.includes('In der Datei: keine Befunde, keine Einnahmen') && e23Frage.includes('Die Datei ist älter als die Daten auf diesem Handy'),
  `E23: vor dem Einlesen fragt die App – mit Datum und Umfang von Datei und Handy („${e23Frage}")`);
s = await gespeichert();
check(s.labor.length === 2 && Object.keys(s.einnahmen).length === 30 && (await r4app.meldung()).includes('Nicht eingelesen'), 'E23: „Abbrechen" – auf dem Handy bleibt alles, wie es war');
await e23Einlesen(true);
s = await gespeichert();
check(s.labor.length === 0 && Object.keys(s.einnahmen).length === 0 && (await r4app.meldung()).includes('Sicherung vom 01.03.2026 eingelesen'), 'E23: „OK" – die Sicherung ersetzt den Stand, die Meldung nennt ihr Datum');
e23Dialoge = await e23Einlesen(true);
check(e23Dialoge.length === 1 && e23Dialoge[0].includes('schon eingelesen'), `E23: dieselbe Datei noch einmal – „schon eingelesen", keine Rückfrage zum Ersetzen (${e23Dialoge.join(' | ').slice(0, 90)})`);

// ---------------------------------------------------------------- E27: Kalenderdatei zur Blutabnahme

await laden(stand({ termine: [{ id: 't1', datum: plus(TAG, 5), uhr: '08:00', art: 'labor', wo: 'Praxis Dr. Meier', blutabnahme: true, notiz: '' }] }));
await mehrSeite('termine');
const [e27Download] = await Promise.all([page.waitForEvent('download'), page.click('#ansicht [data-act="ics-termin"][data-id="t1"]')]);
const e27Ics = readFileSync(await e27Download.path(), 'utf8').replace(/\r\n /g, '');
const e27Titel = e27Ics.split('\r\n').find((z) => z.startsWith('SUMMARY:')) || '';
const e27Alarm = e27Ics.split('BEGIN:VALARM').find((a) => a.includes('TRIGGER:-PT1H')) || '';
check(e27Titel === 'SUMMARY:Blutabnahme Schilddrüse – Tablette erst danach – Praxis Dr. Meier', `E27: der Titel des Termins nennt die Tablette (${e27Titel})`);
check(e27Alarm.includes('Tablette erst danach'), 'E27: … damit auch der Alarm eine Stunde vorher');

// ---------------------------------------------------------------- E34: Systemhinweis bei Blutabnahme ohne Uhrzeit

const e34ctx = await browser.newContext({ viewport: { width: 360, height: 740 }, locale: 'de-DE', serviceWorkers: 'block' });
await e34ctx.addInitScript(uhrStellen);
await e34ctx.addInitScript(() => {
  window.__hinweise = [];
  class N { constructor(titel, o) { window.__hinweise.push({ titel, text: o && o.body }); } }
  N.permission = 'granted';
  N.requestPermission = async () => 'granted';
  window.Notification = N;
});
const e34p = await e34ctx.newPage();
await e34p.goto(SD_URL, { waitUntil: 'networkidle' });
const e34Stand = (uhr, erinnerung) => stand({
  einstellungen: { erinnerung, schrift: 'gross', farbe: 'hell', hinweisTablette: true },
  termine: [{ id: 't1', datum: TAG, uhr, art: 'labor', wo: '', blutabnahme: true, notiz: '' }],
});
const e34Hinweise = async (st, zeit) => {
  await e34p.evaluate(({ k, s0, t, z }) => {
    localStorage.clear();
    localStorage.setItem('__testtag', t);
    localStorage.setItem('__testzeit', z);
    localStorage.setItem(k, JSON.stringify(s0));
  }, { k: SCHLUESSEL, s0: st, t: TAG, z: zeit });
  await e34p.reload({ waitUntil: 'networkidle' });
  await e34p.waitForTimeout(300);
  return e34p.evaluate(() => window.__hinweise);
};
let e34h = await e34Hinweise(e34Stand('', '22:00'), '22:05');
check(e34h.length === 1 && e34h[0].text.includes('Heute ist Blutabnahme: die Tablette erst nach der Abnahme nehmen') && !e34h[0].text.includes('Nüchtern'),
  `E34: Abnahme ohne Uhrzeit, Einnahme abends – der Hinweis kommt zur gewohnten Zeit, mit dem Satz zur Abnahme (${JSON.stringify(e34h)})`);
e34h = await e34Hinweise(e34Stand('', '07:00'), '13:00');
check(e34h.length === 1 && e34h[0].text.includes('erst nach der Abnahme'), 'E34: … ebenso mittags nach einer Abnahme am Morgen');
e34h = await e34Hinweise(e34Stand('', '22:00'), '21:00');
check(e34h.length === 0, 'E34: vor der gewohnten Zeit kein Hinweis');
e34h = await e34Hinweise(e34Stand('09:30', '07:00'), '07:10');
check(e34h.length === 0, 'E34: Gegenprobe D16 – Abnahme um 9:30, um 7:10 kein Hinweis');
await e34ctx.close();

// ---------------------------------------------------------------- E24: das Ergebnis des Checks über Mitternacht

const e24ctx = await browser.newContext({ viewport: { width: 360, height: 740 }, locale: 'de-DE', timezoneId: 'Europe/Berlin', serviceWorkers: 'block' });
const e24 = await e24ctx.newPage();
await e24.clock.install({ time: new Date('2026-09-27T23:55:00+02:00') });
await e24.goto(SD_URL, { waitUntil: 'networkidle' });
await e24.evaluate(({ k, st }) => { localStorage.clear(); localStorage.setItem(k, JSON.stringify(st)); }, { k: SCHLUESSEL, st: stand() });
await e24.reload({ waitUntil: 'networkidle' });
await e24.click('#reiter-mehr');
await e24.click('#ansicht [data-seite="warnzeichen"]');
await e24.check('input[name="warn"][value="packung"]');
await e24.click('form[data-formular="warnzeichen"] button[type=submit]');
await e24.waitForTimeout(300);
const e24Vorher = await e24.locator('#ansicht').innerText();
await e24.clock.runFor(6 * 60 * 1000);
await e24.waitForTimeout(300);
const e24Nachher = await e24.locator('#ansicht').innerText();
check(e24Vorher.includes('Jetzt den Giftnotruf anrufen') && e24Nachher.includes('Jetzt den Giftnotruf anrufen') && e24Nachher.includes('Gespeichert am')
  && await e24.evaluate(() => new Date().getDate()) === 28,
  'E24: um Mitternacht bleibt das Ergebnis „Jetzt den Giftnotruf anrufen" stehen');
if (await e24.locator('#kopf .kopf-zurueck').count()) await e24.click('#kopf .kopf-zurueck');
check(await e24.locator('#reiter-heute').getAttribute('aria-selected') === 'true' && await e24.locator('.tablette').count() === 1,
  'E24: geschlossen führt es am neuen Tag zu „Heute", nicht zurück zu „Mehr"');
await e24ctx.close();

// ---------------------------------------------------------------- E3: Doppeltipp nach einem Seitenwechsel

// Mit Finger (hasTouch): Einrichten um 6:30, „Fertig – zur App" zweimal
// getippt – unter dem Finger liegt danach „Tablette genommen?".
const e3ctx = await browser.newContext({ viewport: { width: 360, height: 740 }, locale: 'de-DE', hasTouch: true, isMobile: true, serviceWorkers: 'block' });
await e3ctx.addInitScript(uhrStellen);
const e3 = await e3ctx.newPage();
e3.on('dialog', (d) => d.accept());
await e3.goto(SD_URL, { waitUntil: 'networkidle' });
await e3.evaluate((t) => { localStorage.clear(); localStorage.setItem('__testtag', t); localStorage.setItem('__testzeit', '06:30'); }, TAG);
await e3.reload({ waitUntil: 'networkidle' });
const e3Stand = async () => { await e3.waitForTimeout(250); return e3.evaluate((k) => JSON.parse(localStorage.getItem(k) || 'null'), SCHLUESSEL); };
await e3.check('input[name=behandelt]');
await e3.fill('input[name=name]', 'Frau Möller');
await e3.click('[data-act="willkommen-weiter"]');
await e3.fill('input[name=mikrogramm]', '75');
await e3.fill('input[name=ab]', '2025-03-01');
await e3.click('[data-act="willkommen-weiter"]');
await e3.evaluate(() => window.scrollTo(0, 1e6));
// Erst lesen: Ein Tipp gleich nach dem Schrittwechsel an derselben Stelle zählte nicht.
await e3.waitForTimeout(700);
const e3Box = await e3.locator('[data-act="willkommen-weiter"]').boundingBox();
const e3x = e3Box.x + e3Box.width / 2;
const e3y = e3Box.y + e3Box.height / 2;
await e3.touchscreen.tap(e3x, e3y);
await e3.waitForTimeout(250);
const e3Unter = await e3.evaluate(({ x, y }) => { const b = document.elementFromPoint(x, y)?.closest('button'); return b ? b.dataset.act || b.textContent.trim() : ''; }, { x: e3x, y: e3y });
await e3.touchscreen.tap(e3x, e3y);
let e3s = await e3Stand();
check(e3Unter === 'tablette', `E3: Vorbedingung – nach „Fertig – zur App" liegt „Tablette genommen?" unter dem Finger (${e3Unter})`);
check(e3s && e3s.profil.begruesst && !(TAG in e3s.einnahmen) && await e3.locator('.tablette.genommen').count() === 0,
  `E3: der zweite Tipp gleich danach hakt die Tablette nicht ab (${JSON.stringify(e3s && e3s.einnahmen)})`);
await e3.waitForTimeout(500);
await e3.touchscreen.tap(e3x, e3y);
e3s = await e3Stand();
check(TAG in e3s.einnahmen, 'E3: ein Tipp mit Pause hakt wie gewohnt ab');
const e3Rueck = e3.locator('#meldung [data-act="tablette-rueckgaengig"]');
check(await e3Rueck.count() === 1 && (await e3.locator('#meldung').innerText()).includes('Tablette abgehakt'), 'E3: die Meldung „Tablette abgehakt" bietet „Rückgängig"');
if (await e3Rueck.count()) await e3Rueck.click();
e3s = await e3Stand();
check(!(TAG in e3s.einnahmen) && await e3.locator('.tablette.genommen').count() === 0, 'E3: „Rückgängig" nimmt den Haken ohne weitere Rückfrage zurück');
// Mit der Maus: der zweite Klick eines Doppelklicks auf „Fertig – zur App"
// zählt ebenso nicht (dieselbe Einrichtung noch einmal).
await e3.evaluate((k) => localStorage.removeItem(k), SCHLUESSEL);
await e3.reload({ waitUntil: 'networkidle' });
await e3.check('input[name=behandelt]');
await e3.fill('input[name=name]', 'Frau Möller');
await e3.click('[data-act="willkommen-weiter"]');
await e3.fill('input[name=mikrogramm]', '75');
await e3.fill('input[name=ab]', '2025-03-01');
await e3.click('[data-act="willkommen-weiter"]');
await e3.evaluate(() => window.scrollTo(0, 1e6));
await e3.waitForTimeout(700);
await e3.mouse.dblclick(e3x, e3y);
e3s = await e3Stand();
check(e3s && e3s.profil.begruesst && !(TAG in e3s.einnahmen), `E3: Doppelklick auf „Fertig – zur App" – eingerichtet, und der zweite Klick hakt nichts ab (${JSON.stringify(e3s && e3s.einnahmen)})`);
await e3ctx.close();

// ---------------------------------------------------------------- E5: Zurück-Taste des Handys, ungespeicherte Eingaben

const e5ctx = await browser.newContext({ viewport: { width: 360, height: 740 }, locale: 'de-DE', serviceWorkers: 'block' });
await e5ctx.addInitScript(uhrStellen);
const e5 = await e5ctx.newPage();
const e5Dialoge = [];
const e5Antwort = { ja: true };
e5.on('dialog', (d) => { e5Dialoge.push(d.message()); if (d.type() === 'alert' || e5Antwort.ja) d.accept(); else d.dismiss(); });
const e5Gibt = async (sel) => (await e5.locator(sel).count()) > 0;
const e5Klick = async (sel) => { if (await e5Gibt(sel)) await e5.click(sel); };
const e5Neu = async (st) => {
  await e5.goto(SD_URL, { waitUntil: 'networkidle' });
  await e5.evaluate(({ k, s0, t }) => {
    localStorage.clear();
    localStorage.setItem('__testtag', t);
    localStorage.setItem('__testzeit', '09:00');
    if (s0) localStorage.setItem(k, JSON.stringify(s0));
  }, { k: SCHLUESSEL, s0: st, t: TAG });
  await e5.reload({ waitUntil: 'networkidle' });
};
const e5Zurueck = async () => { await e5.goBack().catch(() => null); await e5.waitForTimeout(300); };
const inDerApp = async () => e5.url() === SD_URL && await e5Gibt('#reiterleiste');
const reiterAktiv = (n) => e5.evaluate((x) => document.getElementById(`reiter-${x}`)?.getAttribute('aria-selected') === 'true', n);
const e5Stand = stand({ profil: { herz: '' }, labor: [befund('b1', plus(TAG, -40), { tsh: w(2.2, 'mU/l', 0.27, 4.2) })] });

// Laborwerte halb eingetragen: Reiter, „‹ Zurück" und die Zurück-Taste fragen.
await e5Neu(e5Stand);
await e5.click('#reiter-verlauf');
await e5.click('#ansicht [data-seite="labor"]:not([data-param])');
await e5.fill('input[name=tsh_wert]', '3,8');
e5Antwort.ja = false;
let e5n = e5Dialoge.length;
await e5Klick('#reiter-heute');
const e5Frage = (e5Dialoge.slice(e5n)[0] || '');
check(e5Frage.includes('noch nicht gespeichert') && await feldWert('input[name=tsh_wert]', e5) === '3,8', `E5: ein Reiter fragt vor dem Verwerfen – „Abbrechen" lässt TSH 3,8 stehen („${e5Frage}")`);
e5n = e5Dialoge.length;
await e5Klick('#kopf .kopf-zurueck');
check(e5Dialoge.length === e5n + 1 && await feldWert('input[name=tsh_wert]', e5) === '3,8', 'E5: „‹ Zurück" ebenso');
e5n = e5Dialoge.length;
await e5Zurueck();
check(await inDerApp() && e5Dialoge.length === e5n + 1 && await feldWert('input[name=tsh_wert]', e5) === '3,8', `E5: die Zurück-Taste verlässt die App nicht – sie fragt wie „‹ Zurück" (${e5.url()})`);
e5n = e5Dialoge.length;
await e5Zurueck();
check(await inDerApp() && e5Dialoge.length === e5n + 1 && await feldWert('input[name=tsh_wert]', e5) === '3,8', 'E5: … auch beim zweiten Mal – die Seite steht danach wieder im Verlauf');
e5Antwort.ja = true;
await e5Zurueck();
check(await inDerApp() && await reiterAktiv('verlauf') && !(await e5Gibt('form[data-formular="labor"]')), 'E5: „OK" – verworfen, die App steht wieder auf „Verlauf"');
const e5Gespeichert = (await inDerApp()) ? await e5.evaluate((k) => JSON.parse(localStorage.getItem(k) || 'null'), SCHLUESSEL) : null;
check(e5Gespeichert && e5Gespeichert.labor.length === 1, 'E5: … gespeichert wurde nichts');

// Zwei Ebenen ohne Eingaben: keine Frage, eine Seite je Tipp.
await e5Neu(e5Stand);
await e5.click('#reiter-verlauf');
await e5.click('#ansicht [data-seite="labor-liste"]');
await e5.click('#ansicht [data-seite="labor"][data-param="b1"]');
e5n = e5Dialoge.length;
await e5Zurueck();
check(await inDerApp() && await e5Gibt('#ansicht [data-seite="labor"][data-param="b1"]') && !(await e5Gibt('form[data-formular="labor"]')), 'E5: aus dem Befund führt die Zurück-Taste zurück in die Liste');
await e5Zurueck();
check(await inDerApp() && await reiterAktiv('verlauf') && e5Dialoge.length === e5n, 'E5: … und von dort zu „Verlauf" – ohne Eingaben ohne Frage');
// „Abbrechen" in der App nimmt den Eintrag im Verlauf wieder weg.
await e5Klick('#ansicht [data-seite="labor"]:not([data-param])');
await e5Klick('form[data-formular="labor"] [data-act="zurueck"]');
await e5.waitForTimeout(200);
check(await e5.evaluate(() => history.state) === null && await reiterAktiv('verlauf'), 'E5: „Abbrechen" in der App räumt den Eintrag im Browserverlauf wieder weg');

// „Über mich": „Herzerkrankung: Ja" angetippt, dann „Heute".
await e5Neu(e5Stand);
await e5.click('#reiter-mehr');
await e5.click('#ansicht [data-seite="profil"]');
await e5.check('input[name=herz][value=ja]');
e5Antwort.ja = false;
e5n = e5Dialoge.length;
await e5Klick('#reiter-heute');
check(e5Dialoge.length === e5n + 1 && await e5.evaluate(() => document.querySelector('input[name=herz][value=ja]')?.checked === true), 'E5: „Über mich" – „Herzerkrankung: Ja" geht beim Reiterwechsel nicht still verloren');
e5Antwort.ja = true;

// Einrichten: Die Zurück-Taste geht einen Schritt zurück – mit dem Entwurf.
await e5Neu(null);
await e5.click('[data-act="willkommen-weiter"]');
await e5.fill('input[name=mikrogramm]', '75');
await e5.fill('input[name=ab]', '2025-03-01');
await e5Zurueck();
check(e5.url() === SD_URL && (await e5.locator('.schritte').innerText().catch(() => '')).includes('Willkommen'), 'E5: beim Einrichten führt die Zurück-Taste einen Schritt zurück');
await e5Klick('[data-act="willkommen-weiter"]');
check(await feldWert('input[name=mikrogramm]', e5) === '75' && await feldWert('input[name=ab]', e5) === '2025-03-01', 'E5, E12: … und die Eingaben von Schritt 2 sind noch da');
await e5ctx.close();

// ---------------------------------------------------------------- Runde 4 (App) bei „sehr groß", hell und dunkel

for (const farbe of ['hell', 'dunkel']) {
  const einst = r4Einstellungen('sehr-gross', farbe);
  await laden({ ...e1App(), einstellungen: einst });
  await mehrSeite('dosis-karte');
  await page.click('#dosis-karte [data-seite="praxis-entschieden"]');
  await page.click('[data-act="praxis-entscheid"][data-wert="geaendert"]');
  await r4app.klick('form[data-formular="dosis"] [data-act="zurueck"]');
  const dialogRand = await page.evaluate(() => {
    const d = document.querySelector('dialog.rueckfrage');
    if (!d) return null;
    const r = d.getBoundingClientRect();
    return { links: Math.floor(r.left), rechts: Math.ceil(r.right), unten: Math.ceil(r.bottom), knoepfe: [...d.querySelectorAll('button')].every((b) => b.getBoundingClientRect().right <= r.right) };
  });
  await r4app.klick(`${r4app.praxisDialog} [data-wert="spaeter"]`);
  await page.click('#reiter-heute');
  await page.click('.tablette');
  const meldungRand = await page.evaluate(() => {
    const r = document.getElementById('meldung').getBoundingClientRect();
    return { links: Math.floor(r.left), rechts: Math.ceil(r.right) };
  });
  check(dialogRand && dialogRand.links >= 0 && dialogRand.rechts <= 360 && dialogRand.unten <= 740 && dialogRand.knoepfe && meldungRand.links >= 0 && meldungRand.rechts <= 360
    && await page.evaluate(() => document.documentElement.scrollWidth) <= 360,
  `Runde 4 (App): bei „sehr groß" und ${farbe} passen die Frage zur Praxis und die Meldung mit „Rückgängig" auf 360 px (${JSON.stringify({ dialogRand, meldungRand })})`);
}

// ================================================================ Nachprüfung Runde 4
/*
 * Was die Nachprüfer nach den Korrekturen der vierten Runde noch fanden.
 * Jeder Fall scheiterte vor der Korrektur.
 */

// Die Doppeltipp-Sperre (E3) verschluckt nie einen Tipp auf eine Notrufnummer:
// Nach „Auswerten" mit Brustschmerz liegt „112 anrufen" unter dem Finger.
{
  const tctx = await browser.newContext({ viewport: { width: 360, height: 740 }, locale: 'de-DE', hasTouch: true, isMobile: true, serviceWorkers: 'block' });
  await tctx.addInitScript(uhrStellen);
  const t = await tctx.newPage();
  t.on('dialog', (d) => d.accept());
  await t.goto(SD_URL, { waitUntil: 'networkidle' });
  await t.evaluate(({ key, s, tag }) => {
    localStorage.clear();
    localStorage.setItem(key, JSON.stringify(s));
    localStorage.setItem('__testtag', tag);
    localStorage.setItem('__testzeit', '09:00');
  }, { key: SCHLUESSEL, s: stand({ einstellungen: { erinnerung: '07:00', schrift: 'sehr-gross', farbe: 'hell', hinweisTablette: false } }), tag: TAG });
  await t.reload({ waitUntil: 'networkidle' });
  // Den Anruf selbst nicht auslösen – nur festhalten, ob der Tipp beim Link ankam.
  await t.evaluate(() => {
    window.__anrufe = [];
    window.addEventListener('click', (e) => {
      const a = e.target.closest && e.target.closest('a[href^="tel:"]');
      if (a) { window.__anrufe.push({ nummer: a.getAttribute('href'), verhindert: e.defaultPrevented }); e.preventDefault(); }
    });
  });
  await t.click('#reiter-mehr');
  await t.locator('#ansicht [data-seite="warnzeichen"]').first().click();
  await t.check('input[name="warn"][value="brust"]');
  await t.evaluate(() => window.scrollTo(0, 1e6));
  await t.waitForTimeout(700);
  const box = await t.locator('#ansicht button[type=submit]').boundingBox();
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await t.touchscreen.tap(x, y);
  await t.waitForTimeout(300);
  const unter = await t.evaluate(({ x: px, y: py }) => { const a = document.elementFromPoint(px, py)?.closest('a'); return a ? a.getAttribute('href') : ''; }, { x, y });
  await t.touchscreen.tap(x, y);
  await t.waitForTimeout(200);
  const anrufe = await t.evaluate(() => window.__anrufe);
  check(unter === 'tel:112', `Nachprüfung R4: Vorbedingung – nach „Auswerten" liegt „112 anrufen" unter dem Finger (${unter})`);
  check(anrufe.length === 1 && anrufe[0].nummer === 'tel:112' && !anrufe[0].verhindert,
    `Nachprüfung R4: ein Tipp auf „112 anrufen" 0,3 Sekunden nach dem Seitenwechsel kommt an (${JSON.stringify(anrufe)})`);

  // Neuladen auf einer Unterseite: Der erste Druck auf die Zurück-Taste
  // verlässt die Unterseite – vorher bewirkte er nichts.
  // Eine frische Seite: davor liegt nur about:blank.
  const v = await tctx.newPage();
  await v.goto(SD_URL, { waitUntil: 'networkidle' });
  await v.click('#reiter-mehr');
  await v.locator('#ansicht [data-seite="termine"]').first().click();
  await v.waitForTimeout(300);
  const tiefeVorher = await v.evaluate(() => history.state && history.state.tiefe);
  await v.reload({ waitUntil: 'load' });
  await v.waitForTimeout(1500);
  await v.goBack({ waitUntil: 'commit', timeout: 5000 }).catch(() => null);
  await v.waitForTimeout(500);
  check(tiefeVorher === 1 && v.url() === 'about:blank',
    `Nachprüfung R4: nach dem Neuladen auf einer Unterseite verlässt der erste Druck auf die Zurück-Taste die App (${tiefeVorher}, jetzt ${v.url()})`);
  await tctx.close();
}

// Ein Knopf, der aus einem Formular heraus eine andere Seite öffnet (hier
// „Eintrag vom … öffnen" unter einem belegten Datum), verwirft das
// Eingetippte nicht still.
{
  await laden(stand({ befinden: [{ id: 'bgestern', datum: plus(TAG, -1), stufe: 'schlecht', beschwerden: ['herz'], notiz: 'nachts Herzstolpern' }] }));
  await page.click('#reiter-verlauf');
  await page.click('[data-seite="befinden"]:not([data-param])');
  await page.fill('input[name="datum"]', plus(TAG, -1));
  await page.click('label:has(input[name="stufe"][value="mittel"])');
  await page.fill('textarea[name="notiz"]', 'Nachtrag: auch Schwindel');
  await page.click('form[data-formular="befinden"] button[type=submit]');
  const vorher = dialoge.length;
  browserDialog.antwort = false;
  await page.locator('#ansicht [data-seite="befinden"][data-param="bgestern"]').first().click();
  await page.waitForTimeout(200);
  browserDialog.antwort = true;
  const neu = dialoge.slice(vorher);
  const notiz = await page.locator('textarea[name="notiz"]').inputValue().catch(() => '');
  check(neu.some((d) => /noch nicht gespeichert/.test(d)) && notiz === 'Nachtrag: auch Schwindel',
    `Nachprüfung R4: „Eintrag öffnen" aus dem Befinden-Formular fragt erst und lässt die Eingaben beim Abbrechen stehen (${JSON.stringify(neu)}, Notiz „${notiz}")`);
}

// ================================================================ Runde 5 – App
//
// Befunde aus der fünften Durchsicht (F…), die js/app.js und index.html
// betreffen: der Doppeltipp auf Seiten, die an Ort und Stelle neu zeichnen,
// das aufgeschobene Neuladen nach einem Update, „Rückgängig", Eingaben beim
// Neuzeichnen, das Zurückholen in eine unfertige Einrichtung, die zweite
// offene Instanz, Fehlertexte am Feld, Orientierungspunkte und der
// Seitentitel als Überschrift. Jeder Fall scheiterte vor der Korrektur.

/** Ein eigener Kontext mit Finger (hasTouch), fester Uhr und einem Stand. */
async function r5Finger(st, { viewport = { width: 360, height: 740 }, zeit = '09:00' } = {}) {
  const k = await browser.newContext({ viewport, locale: 'de-DE', hasTouch: true, isMobile: true, serviceWorkers: 'block' });
  await k.addInitScript(uhrStellen);
  const p = await k.newPage();
  const fehlerListe = [];
  p.on('pageerror', (e) => fehlerListe.push(e.message));
  p.on('dialog', (d) => d.accept());
  await p.goto(SD_URL, { waitUntil: 'networkidle' });
  await p.evaluate(({ key, s0, t, z }) => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('__testtag', t);
    localStorage.setItem('__testzeit', z);
    if (s0) localStorage.setItem(key, JSON.stringify(s0));
  }, { key: SCHLUESSEL, s0: st, t: TAG, z: zeit });
  await p.reload({ waitUntil: 'networkidle' });
  const gespeichertF = async () => { await p.waitForTimeout(250); return p.evaluate((key) => JSON.parse(localStorage.getItem(key) || 'null'), SCHLUESSEL); };
  const mitte = async (sel) => {
    const b = (await p.locator(sel).count()) ? await p.locator(sel).first().boundingBox() : null;
    return b ? { x: b.x + b.width / 2, y: b.y + b.height / 2 } : null;
  };
  /** Was unter dem Finger liegt: der Knopf mit seinen data-Angaben. */
  const unter = (m) => p.evaluate(({ x, y }) => {
    const b = document.elementFromPoint(x, y)?.closest('button, a');
    return b ? { act: b.dataset.act || '', ziel: b.dataset.ziel || '', feld: b.dataset.feld || '', wert: b.dataset.wert || '', id: b.dataset.id || '', text: b.textContent.trim().replace(/\s+/g, ' ').slice(0, 50) } : null;
  }, m).catch(() => null);
  /** Zwei Tipps an derselben Stelle – `abstand` ms auseinander. → was nach dem ersten unter dem Finger lag. */
  const doppeltipp = async (m, abstand = 250) => {
    await p.touchscreen.tap(m.x, m.y);
    await p.waitForTimeout(abstand);
    const dort = await unter(m);
    await p.touchscreen.tap(m.x, m.y);
    await p.waitForTimeout(600);
    return dort;
  };
  return { k, p, gespeichertF, mitte, unter, doppeltipp, fehlerListe };
}
/** Ein Befund, dessen Fragen alle noch offen sind. */
const r5Befund = (werte) => ({
  id: 'b1', datum: plus(TAG, -10), notiz: '', tsh: null, ft4: null, ft3: null, ...werte,
  vorAbnahme: '', biotin: '', krank: '', kortison: '', kontrastmittel: '', mittelGeaendert: '', einnahmeGeaendert: '', packung: '', vergessen: '', einnahmeArt: '', abstandOk: '', verwechselt: '', praxis: '', praxisAm: '',
});
const r5Profil = { behandelt: true, geburtsjahr: 1950, ursache: 'hashimoto', krebs: '', kortison: '', herz: 'nein' };

// ---------------------------------------------------------------- F18: Doppeltipp auf der Dosis-Karte

// P6 aus, TSH 0,05 und fT4 über dem Bereich. Ein Doppeltipp (250 ms) auf
// „Ja, ich werde … behandelt": Der zweite Tipp beantwortete vorher F8 „Hat
// die Praxis zu diesem Wert schon etwas gesagt?" ungelesen – bei „Erst
// nachmessen" schwiegen danach Karte und „Heute" zur Anruf-Frist. Wo der
// zweite Tipp landet, hängt an Schrift und Bildschirm; geprüft wird in
// mehreren Lagen, und mindestens in einer muss eine Antwort unter dem Finger liegen.
{
  const f18Stand = (schrift) => stand({
    profil: { ...r5Profil, behandelt: false, ursache: '' },
    einstellungen: r4Einstellungen(schrift, 'hell'),
    labor: [r5Befund({ tsh: w(0.05, 'mU/l', 0.27, 4.2), ft4: w(24, 'pmol/l', 12, 22) })],
  });
  const lagen = [['gross', 390, 844], ['normal', 375, 667], ['gross', 375, 667], ['normal', 390, 844]];
  const ergebnisse = [];
  for (const [schrift, breite, hoehe] of lagen) {
    const f = await r5Finger(f18Stand(schrift), { viewport: { width: breite, height: hoehe } });
    await f.p.click('#reiter-mehr');
    await f.p.locator('#ansicht [data-seite="dosis-karte"]').first().click();
    await f.p.locator('#ansicht [data-act="behandelt"]').scrollIntoViewIfNeeded();
    await f.p.waitForTimeout(800);
    const m = await f.mitte('#ansicht [data-act="behandelt"]');
    const frei = m && (await f.unter(m))?.act === 'behandelt';
    const dort = frei ? await f.doppeltipp(m) : null;
    const s0 = await f.gespeichertF();
    ergebnisse.push({
      lage: `${schrift} ${breite}×${hoehe}`, frei, zweiterTipp: dort && `${dort.act}:${dort.feld}=${dort.wert}`,
      behandelt: s0.profil.behandelt, praxis: s0.labor[0].praxis, dosisFormular: await f.p.locator('form[data-formular="dosis"]').count(),
    });
    await f.k.close();
  }
  const getroffen = ergebnisse.filter((e) => e.frei && /^frage-antwort:/.test(e.zweiterTipp || ''));
  check(getroffen.length > 0, `F18: Vorbedingung – nach dem Tipp auf P6 liegt eine Antwort der nächsten Frage unter dem Finger (${JSON.stringify(ergebnisse.map((e) => `${e.lage}: ${e.zweiterTipp}`))})`);
  check(ergebnisse.every((e) => !e.frei || (e.behandelt === true && e.praxis === '' && e.dosisFormular === 0)),
    `F18: Doppeltipp auf „Ja, ich werde … behandelt" – der zweite Tipp beantwortet die Frage zur Praxis nicht ungelesen (${JSON.stringify(ergebnisse)})`);
}

// TSH 7,5, alle Fragen einzeln beantwortet, nur F2 doppelt: Vorher war die
// nächste Frage („schwer krank oder im Krankenhaus?") ungelesen mit „Nein"
// beantwortet – eine mögliche Sperre (RW2 D0.10) fiel weg.
{
  const f18Kette = [];
  let f18Doppelt = null;
  for (const [schrift, breite, hoehe] of [['normal', 360, 740], ['gross', 390, 844], ['gross', 360, 740]]) {
    const f = await r5Finger(stand({
      profil: r5Profil, einstellungen: r4Einstellungen(schrift, 'hell'),
      labor: [r5Befund({ tsh: w(7.5, 'mU/l', 0.27, 4.2) })],
    }), { viewport: { width: breite, height: hoehe } });
    await f.p.click('#reiter-mehr');
    await f.p.locator('#ansicht [data-seite="dosis-karte"]').first().click();
    await f.p.waitForTimeout(700);
    const frage = () => f.p.evaluate(() => { const q = document.querySelector('#dosis-karte .dosis-frage'); return q ? q.dataset.frage : null; });
    for (let i = 0; i < 20; i++) {
      const id = await frage();
      if (!id) break;
      const wert = id === 'F8' ? 'nochnicht' : ['X3', 'Q2'].includes(id) ? 'ja' : 'nein';
      const sel = `#dosis-karte .dosis-frage [data-act="frage-antwort"][data-wert="${wert}"]`;
      if (!(await f.p.locator(sel).count())) break;
      // In die Mitte – am unteren Rand läge der Knopf hinter der Reiterleiste.
      await f.p.locator(sel).first().evaluate((el) => el.scrollIntoView({ block: 'center' }));
      await f.p.waitForTimeout(100);
      const m = await f.mitte(sel);
      if ((await f.unter(m))?.act !== 'frage-antwort') break;
      if (id !== 'F2') {
        await f.p.touchscreen.tap(m.x, m.y);
        await f.p.waitForTimeout(900);
        f18Kette.push(id);
        continue;
      }
      const dort = await f.doppeltipp(m);
      const s0 = await f.gespeichertF();
      // Wohin die Antwort unter dem Finger gehört hätte: an den Befund, ins
      // Profil oder als Nachfrage (js/dosis.js).
      const ablage = !dort || dort.act !== 'frage-antwort' ? null
        : dort.ziel === 'befund' ? s0.labor[0][dort.feld]
          : dort.ziel === 'profil' ? s0.profil[dort.feld]
            : s0.nachfragen.some((n) => n.art === dort.feld.toLowerCase()) ? 'beantwortet' : '';
      f18Doppelt = { lage: `${schrift} ${breite}×${hoehe}`, dort, jetzt: await frage(), feldWert: ablage };
      break;
    }
    await f.k.close();
    if (f18Doppelt && f18Doppelt.dort && f18Doppelt.dort.act === 'frage-antwort') break;
    f18Doppelt = null;
  }
  check(Boolean(f18Doppelt), `F18: Vorbedingung – nach „Nein" auf F2 liegt eine Antwort der nächsten Frage unter dem Finger (Kette ${f18Kette.join(', ')})`);
  check(Boolean(f18Doppelt) && [undefined, null, ''].includes(f18Doppelt.feldWert) && f18Doppelt.jetzt !== null && f18Doppelt.jetzt !== 'F2',
    `F18: Doppeltipp auf „Nein" bei F2 – die nächste Frage bleibt offen und ungespeichert (${JSON.stringify(f18Doppelt && { lage: f18Doppelt.lage, unter: f18Doppelt.dort, jetzt: f18Doppelt.jetzt, gespeichert: f18Doppelt.feldWert })})`);
}

// „Meine Fragen": Nach dem Abhaken rückt die nächste Frage unter den Finger –
// vorher waren nach einem Doppeltipp beide „besprochen", und der Bericht
// nannte die zweite nicht mehr.
{
  const f = await r5Finger(stand({
    fragen: [
      { id: 'f1', text: 'Soll ich die Tablette vor oder nach dem Kaffee nehmen?', erledigt: false },
      { id: 'f2', text: 'Kann das Herzstolpern von der Tablette kommen?', erledigt: false },
      { id: 'f3', text: 'Wann ist die nächste Blutabnahme?', erledigt: false },
    ],
  }));
  await f.p.click('#reiter-mehr');
  await f.p.locator('#ansicht [data-seite="fragen"]').first().click();
  await f.p.waitForTimeout(800);
  const m = await f.mitte('[data-act="frage-erledigt"][data-id="f1"]');
  const dort = await f.doppeltipp(m);
  const s0 = await f.gespeichertF();
  const erledigt = s0.fragen.filter((q) => q.erledigt).map((q) => q.id);
  check(dort && dort.act === 'frage-erledigt' && dort.id !== 'f1', `F18: Vorbedingung – nach dem Abhaken liegt die nächste Frage unter dem Finger (${JSON.stringify(dort)})`);
  check(erledigt.length === 1 && erledigt[0] === 'f1', `F18: Doppeltipp unter „Meine Fragen" – nur die angetippte Frage ist besprochen (${erledigt.join(', ')})`);
  // Ein Tipp mit Pause wirkt wie gewohnt – die Sperre hält niemanden auf.
  await f.p.waitForTimeout(400);
  await f.p.touchscreen.tap(m.x, m.y);
  const s1 = await f.gespeichertF();
  check(s1.fragen.filter((q) => q.erledigt).length === 2, 'F18: … ein Tipp mit Pause hakt die nächste Frage wie gewohnt ab');
  // Notrufnummern bleiben frei: Die Sperre gilt nicht für tel:-Links (Nachprüfung zu E3).
  const frei = await f.p.evaluate(() => {
    const a = document.querySelector('a[href^="tel:"]');
    if (!a) return null;
    let angekommen = false;
    a.addEventListener('click', (e) => { angekommen = !e.defaultPrevented; e.preventDefault(); }, { once: true });
    a.click();
    return angekommen;
  });
  check(frei !== false, 'F18: … ein tel:-Link wird nie gesperrt');
  check(!f.fehlerListe.length, `F18: ohne Fehler in der Konsole (${f.fehlerListe.slice(0, 2).join(' | ')})`);
  await f.k.close();
}

// ---------------------------------------------------------------- F19: das aufgeschobene Neuladen nach einem Update

// Ein Update hat übernommen, während das Befinden-Formular offen war
// (index.html setzt dann window.__schilddrueseNeuLaden). Doppeltipp auf
// „Speichern" um 6:30: Vorher lud die Seite gleich nach dem ersten Tipp neu,
// die Sperre war weg, und der zweite Tipp hakte auf der frischen Seite die
// Tablette ab. „Befinden gespeichert" sah niemand.
// Schrift „normal", 360 × 740: Dort liegt auf der frisch geladenen Seite
// „Heute" der Knopf „Tablette genommen?" genau unter „Speichern".
for (const abstand of [250, 400]) {
  const f = await r5Finger(stand({
    profil: { herz: 'nein' }, einstellungen: r4Einstellungen('normal', 'hell'), einnahmen: { [plus(TAG, -1)]: { uhr: '07:00' } },
  }), { zeit: '06:30' });
  await f.p.locator('[data-act="befinden"][data-stufe="schlecht"]').click();
  await f.p.waitForTimeout(300);
  await f.p.locator('#befinden [data-seite="befinden"]').click();
  await f.p.waitForTimeout(300);
  for (const b of ['muede', 'frieren', 'verstopfung']) {
    const cb = f.p.locator(`input[name="beschwerden"][value="${b}"]`);
    if (await cb.count()) await cb.check();
  }
  await f.p.evaluate(() => { window.__schilddrueseNeuLaden = true; window.scrollTo(0, 1e6); });
  await f.p.waitForTimeout(700);
  let geladen = 0;
  f.p.on('load', () => { geladen++; });
  const m = await f.mitte('form[data-formular="befinden"] button[type=submit]');
  await f.p.touchscreen.tap(m.x, m.y);
  await f.p.waitForTimeout(abstand);
  await f.p.touchscreen.tap(m.x, m.y);
  for (let i = 0; i < 30 && !geladen; i++) await f.p.waitForTimeout(200);
  await f.p.waitForTimeout(400);
  const s0 = await f.gespeichertF();
  const meldungText = await f.p.locator('#meldung').innerText().catch(() => '');
  const dortNachher = await f.unter(m);
  // Vor der Korrektur ist sie dort schon abgehakt („tablette-zurueck").
  check(dortNachher && ['tablette', 'tablette-zurueck'].includes(dortNachher.act), `F19: Vorbedingung – auf der neu geladenen Seite liegt der Tabletten-Knopf unter dem Finger (${JSON.stringify(dortNachher)})`);
  check(geladen === 1 && !(TAG in s0.einnahmen) && s0.befinden.some((b) => b.datum === TAG && b.stufe === 'schlecht'),
    `F19: Doppeltipp (${abstand} ms) auf „Speichern" mit anstehendem Neuladen – gespeichert, einmal neu geladen, keine Tablette abgehakt (${geladen}× geladen, heute ${JSON.stringify(s0.einnahmen[TAG] ?? 'nichts')})`);
  check(meldungText.includes('Befinden gespeichert'), `F19: … die Meldung „Befinden gespeichert" steht auch nach dem Neuladen da („${meldungText}")`);
  await f.k.close();
}

// Mit „Rückgängig" in der Meldung wartet das Neuladen, bis sie weg ist –
// sonst ginge der Knopf mit der alten Seite verloren.
{
  const f = await r5Finger(stand({ einnahmen: { [plus(TAG, -1)]: { uhr: '07:00' } } }), { zeit: '07:30' });
  await f.p.evaluate(() => { window.__schilddrueseNeuLaden = true; });
  let geladen = 0;
  f.p.on('load', () => { geladen++; });
  await f.p.locator('#ansicht .tablette').click();
  await f.p.waitForTimeout(2000);
  const knopf = await f.p.locator('#meldung [data-act="tablette-rueckgaengig"]').count();
  check(geladen === 0 && knopf === 1, `F19: nach „Tablette genommen" bleibt „Rückgängig" stehen – das Neuladen wartet (${geladen}× geladen, Knopf ${knopf})`);
  if (knopf) await f.p.locator('#meldung [data-act="tablette-rueckgaengig"]').click();
  const s0 = await f.gespeichertF();
  check(!(TAG in s0.einnahmen), 'F19: … und „Rückgängig" wirkt noch');
  // Geht die App in den Hintergrund, lädt sie gleich dort neu – das sieht
  // niemand, und kein Tipp kann es treffen.
  await f.p.waitForTimeout(300);
  const vorHintergrund = geladen;
  await f.p.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  for (let i = 0; i < 20 && geladen === vorHintergrund; i++) await f.p.waitForTimeout(100);
  check(vorHintergrund === 0 && geladen === 1, `F19: … im Hintergrund lädt die App dann sofort neu (vorher ${vorHintergrund}×, jetzt ${geladen}× geladen)`);
  await f.k.close();
}

// ---------------------------------------------------------------- F20: „Rückgängig" stellt den Stand von vorher her

// Heute stand bewusst „nicht genommen". Ein Fehltipp auf „Doch genommen?",
// dann „Rückgängig": Vorher war der Tag danach leer, und „Heute" forderte
// gelb zur Einnahme auf.
await ladenHeute(stand({ einnahmen: { [plus(TAG, -1)]: { uhr: '07:00' }, [TAG]: null } }));
const f20Vorher = (await page.locator('#ansicht .tablette').innerText()).replace(/\s+/g, ' ');
await page.click('#ansicht .tablette');
await r4app.klick('#meldung [data-act="tablette-rueckgaengig"]');
s = await gespeichert();
const f20Knopf = (await page.locator('#ansicht .tablette').innerText()).replace(/\s+/g, ' ');
check(f20Vorher.includes('nicht genommen') && TAG in s.einnahmen && s.einnahmen[TAG] === null && f20Knopf.includes('nicht genommen'),
  `F20: „Rückgängig" nach „Doch genommen" – für heute steht wieder „nicht genommen" (${JSON.stringify(s.einnahmen[TAG])}, „${f20Knopf}")`);
check((await r4app.meldung()).includes('nicht genommen'), `F20: … die Meldung sagt, was jetzt gilt („${await r4app.meldung()}")`);
// Gegenprobe: ohne Eintrag vorher bleibt der Tag nach „Rückgängig" leer (E3).
await ladenHeute(stand({ einnahmen: { [plus(TAG, -1)]: { uhr: '07:00' } } }));
await page.click('#ansicht .tablette');
await r4app.klick('#meldung [data-act="tablette-rueckgaengig"]');
s = await gespeichert();
check(!(TAG in s.einnahmen) && (await r4app.meldung()).includes('keine Tablette abgehakt'), 'F20: Gegenprobe – ohne Eintrag vorher ist heute wieder nichts eingetragen');

// ---------------------------------------------------------------- F21: Neuzeichnen verwirft keine Eingaben

// „Frau Möller" ins Feld „Anrede", dann „Sehr groß" und „Dunkel": Vorher war
// das Feld danach leer, galt als unverändert, und „Anrede speichern"
// speicherte leer – mit „Anrede gespeichert".
await laden(stand({ profil: { name: '' } }));
await mehrSeite('darstellung');
await page.fill('form[data-formular="anrede"] input[name="name"]', 'Frau Möller');
await page.click('[data-act="schrift"][data-wert="sehr-gross"]');
const f21NachSchrift = await feldWert('form[data-formular="anrede"] input[name="name"]');
await page.click('[data-act="farbe"][data-wert="dunkel"]');
const f21NachFarbe = await feldWert('form[data-formular="anrede"] input[name="name"]');
check(f21NachSchrift === 'Frau Möller' && f21NachFarbe === 'Frau Möller'
  && await page.evaluate(() => document.documentElement.dataset.schrift === 'sehr-gross' && document.documentElement.dataset.farbe === 'dunkel'),
`F21: nach „Sehr groß" und „Dunkel" steht die getippte Anrede noch im Feld („${f21NachSchrift}", „${f21NachFarbe}")`);
// Weiter ungespeichert: Ein Reiter fragt vor dem Verwerfen (E5).
browserDialog.antwort = false;
const f21n = dialoge.length;
await page.click('#reiter-heute');
browserDialog.antwort = true;
check(dialoge.slice(f21n).some((d) => d.includes('noch nicht gespeichert')) && await feldWert('form[data-formular="anrede"] input[name="name"]') === 'Frau Möller',
  'F21: … sie zählt weiter als ungespeichert – ein Reiter fragt, bevor sie verloren geht');
await r4app.klick('form[data-formular="anrede"] button[type=submit]');
s = await gespeichert();
check(s.profil.name === 'Frau Möller' && s.einstellungen.schrift === 'sehr-gross' && s.einstellungen.farbe === 'dunkel' && (await r4app.meldung()).includes('Anrede gespeichert'),
  `F21: „Anrede speichern" speichert, was im Feld steht („${s.profil.name}")`);
// Kopfhöhe bei „sehr groß" (B60): Der Kopf wächst mit der Schrift, --kopf-h mit ihm.
const f21Kopf = await page.evaluate(() => ({ kopf: document.querySelector('.kopf').offsetHeight, merk: parseFloat(document.documentElement.style.getPropertyValue('--kopf-h')) }));
check(Math.abs(f21Kopf.kopf - f21Kopf.merk) <= 1, `F21: … die gemerkte Kopfhöhe passt zur neuen Schrift (${JSON.stringify(f21Kopf)})`);

// ---------------------------------------------------------------- F22: Zurückholen in eine unfertige Einrichtung

// Die Rücklage stammt aus einer Einrichtung bis Schritt 2 (Dosis gespeichert,
// noch nicht begrüßt). Nach „Stand vor dem Einlesen zurückholen" führte
// „Fertig – zur App" vorher auf die Seite „Sicherung" statt zu „Heute".
await page.evaluate(({ k, rueck }) => localStorage.setItem(`${k}.vorImport`, JSON.stringify(rueck)), {
  k: SCHLUESSEL,
  rueck: {
    am: TAG,
    eingelesen: 'r5-f22',
    stand: {
      version: 2, profil: { name: '', begruesst: false, behandelt: true }, einstellungen: r4Einstellungen('gross', 'hell'),
      dosen: [{ id: 'd1', ab: '2024-01-01', praeparat: 'L-Thyroxin', mikrogramm: 100, tabletten: 1, notiz: '' }],
      einnahmen: {}, labor: [], befinden: [], gewicht: [], termine: [], fragen: [],
    },
  },
});
await laden(stand());
await mehrSeite('sicherung');
await r4app.klick('#ansicht [data-act="sicherung-zurueck"]');
const f22Willkommen = await gibt('.schritte');
for (let i = 0; i < 5 && await gibt('[data-act="willkommen-weiter"]'); i++) {
  await page.click('[data-act="willkommen-weiter"]');
  await page.waitForTimeout(700);
}
s = await gespeichert();
const f22Titel = await r4app.text('#kopf .kopf-titel');
check(f22Willkommen && s.profil.begruesst && !f22Titel && await attr('#reiter-heute', 'aria-selected') === 'true' && await gibt('#ansicht .tablette'),
  `F22: nach dem Zurückholen in eine unfertige Einrichtung führt „Fertig – zur App" zu „Heute" (Titel „${f22Titel}", Willkommen ${f22Willkommen})`);
await page.waitForTimeout(300);
check(await page.evaluate(() => !history.state || !history.state.tiefe), `F22: … ohne übrig gebliebenen Schritt im Browserverlauf (${JSON.stringify(await page.evaluate(() => history.state))})`);

// ---------------------------------------------------------------- F24: eine zweite offene Instanz

// In A ist die Dosis-Karte zum Befund mit TSH 7,5 offen, in B kommt TSH 0,05
// von heute dazu. Vorher blieb in A die alte Karte stehen („kleiner Schritt
// nach oben"), obwohl ihr Stand etwas ganz anderes ergab.
const f24Alt = stand({ labor: [befund('b1', plus(TAG, -6), { tsh: w(7.5, 'mU/l', 0.27, 4.2) })] });
const f24Neu = { ...f24Alt, labor: [...f24Alt.labor, befund('b2', TAG, { tsh: w(0.05, 'mU/l', 0.27, 4.2) }, { praxis: '', praxisAm: null })] };
await laden(f24Alt);
await mehrSeite('dosis-karte');
await page.waitForTimeout(400);
const f24Vorher = await r4app.text('#dosis-karte');
const f24StufeVorher = await attr('#dosis-karte', 'data-stufe');
const f24b = await ctx.newPage();
await f24b.goto(SD_URL.replace(/index\.html$/, 'manifest.webmanifest'));
await f24b.evaluate(({ k, st }) => localStorage.setItem(k, JSON.stringify(st)), { k: SCHLUESSEL, st: f24Neu });
await page.waitForTimeout(500);
const f24Nachher = await r4app.text('#dosis-karte');
const f24StufeNachher = await attr('#dosis-karte', 'data-stufe');
check(f24Vorher && f24Nachher && f24Nachher !== f24Vorher && f24StufeNachher !== f24StufeVorher && f24Nachher.includes('anrufen'),
  `F24: die offene Dosis-Karte zeichnet sich nach einer Änderung im anderen Fenster neu (${f24StufeVorher} „${f24Vorher.slice(0, 50)}…" → ${f24StufeNachher} „${f24Nachher.slice(0, 50)}…")`);
// Mit ungespeicherten Eingaben bleibt die Seite, wie sie ist – mit einer Meldung.
await laden(f24Alt);
await page.click('#reiter-verlauf');
await page.click('#ansicht [data-seite="labor"]:not([data-param])');
await page.fill('input[name=tsh_wert]', '3,8');
await page.waitForTimeout(300);
await f24b.evaluate(({ k, st }) => localStorage.setItem(k, JSON.stringify(st)), { k: SCHLUESSEL, st: f24Neu });
await page.waitForTimeout(500);
check(await feldWert('input[name=tsh_wert]') === '3,8' && (await r4app.meldung()).includes('anderen Fenster'),
  `F24: … mitten im Formular bleibt TSH 3,8 stehen, und eine Meldung sagt, dass sich anderswo etwas geändert hat („${await r4app.meldung()}")`);
await f24b.close();
browserDialog.antwort = true;

// ---------------------------------------------------------------- F3: Fehlertexte am Feld

await laden(stand());
await page.click('#reiter-verlauf');
await page.click('#ansicht [data-seite="labor"]:not([data-param])');
await page.fill('input[name=tsh_wert]', 'abc');
await page.click('form[data-formular="labor"] button[type=submit]');
const f3Feld = (name) => page.evaluate((n) => {
  const el = document.querySelector(`[name="${n}"]`);
  if (!el) return null;
  const ids = (el.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean);
  const texte = ids.map((id) => document.getElementById(id)).filter((x) => x && x.classList.contains('feld-fehler'));
  return {
    invalid: el.getAttribute('aria-invalid'), fokus: document.activeElement === el,
    fehler: texte.map((x) => x.textContent).join(' | '), imLabel: texte.some((x) => x.closest('label')), alarm: texte.map((x) => x.getAttribute('role')),
    // Vom Ende des Labels (beim TSH-Feld steht dort noch der Hinweis zu „< 0,01").
    abstand: texte.length ? Math.round(texte[0].getBoundingClientRect().top - (el.closest('label') || el).getBoundingClientRect().bottom) : null,
  };
}, name);
let f3 = await f3Feld('tsh_wert');
check(f3 && f3.invalid === 'true' && f3.fokus && f3.fehler.includes('Bitte eine Zahl') && !f3.imLabel,
  `F3: TSH „abc" – das Feld hat den Fokus, ist als ungültig markiert und nennt den Fehlertext; der steht hinter dem Label (${JSON.stringify(f3)})`);
check(f3 && f3.alarm[0] === null && f3.abstand !== null && f3.abstand >= 0 && f3.abstand <= 12,
  `F3: … ohne zweite Alarm-Ansage, dicht unter dem Feld (${JSON.stringify(f3 && { alarm: f3.alarm, abstand: f3.abstand })})`);
await page.fill('input[name=tsh_wert]', '2,1');
await page.fill('input[name=ft4_wert]', 'abc');
await page.click('form[data-formular="labor"] button[type=submit]');
f3 = await f3Feld('tsh_wert');
const f3ft4 = await f3Feld('ft4_wert');
check(f3 && f3.invalid === null && !f3.fehler && f3ft4 && f3ft4.invalid === 'true' && f3ft4.fehler.includes('fT4') && await page.locator('.feld-fehler').count() === 1,
  `F3: berichtigt – TSH ist nicht mehr als ungültig markiert, fT4 schon (${JSON.stringify({ tsh: f3, ft4: f3ft4 })})`);
// Neue Dosis ohne Stärke und ohne Angabe zur Praxis: Die Gruppe der
// Auswahlknöpfe ist als ungültig markiert, ihr Fehler bleibt eine Alarm-Ansage.
await laden(stand());
await page.click('#reiter-verlauf');
await page.click('#ansicht [data-seite="dosis"]');
await page.fill('input[name=ab]', plus(TAG, -7));
await page.click('form[data-formular="dosis"] button[type=submit]');
const f3Gruppe = await page.evaluate(() => {
  const g = document.querySelector('[data-feld="praxis"] [role="radiogroup"]');
  const p = g && document.getElementById((g.getAttribute('aria-describedby') || '').split(/\s+/).find((id) => id.startsWith('fehler-')) || '-');
  return g ? { invalid: g.getAttribute('aria-invalid'), text: p ? p.textContent : null, alarm: p ? p.getAttribute('role') : null, fokus: document.activeElement?.getAttribute('name') } : null;
});
check(f3Gruppe && f3Gruppe.invalid === 'true' && (f3Gruppe.text || '').includes('Praxis') && f3Gruppe.alarm === 'alert' && f3Gruppe.fokus === 'mikrogramm',
  `F3: Dosis ohne Stärke und ohne Praxis-Angabe – die Auswahl ist als ungültig markiert und nennt den Fehler (${JSON.stringify(f3Gruppe)})`);
await page.check('input[name=praxis][value=ja]');
await page.fill('input[name=mikrogramm]', '100');
await page.click('form[data-formular="dosis"] button[type=submit]');
s = await gespeichert();
check(s.dosen.length === 2, 'F3: … berichtigt wird gespeichert');

// ---------------------------------------------------------------- F6, F4: Orientierungspunkte und Seitentitel

// Vorher: main mit role=tabpanel und nav mit role=tablist – für Vorleser
// weder Hauptbereich noch Navigation. Der Seitentitel war ein Span, viele
// Seiten hatten keine Überschrift.
for (const [schrift, farbe] of [['gross', 'hell'], ['sehr-gross', 'dunkel']]) {
  await ladenHeute({ ...stand(), einstellungen: r4Einstellungen(schrift, farbe) });
  const lm = {
    main: await page.getByRole('main').count(),
    nav: await page.getByRole('navigation', { name: 'Bereiche' }).count(),
    tablist: await page.getByRole('navigation', { name: 'Bereiche' }).getByRole('tablist').count(),
    tabs: await page.getByRole('tablist').getByRole('tab').count(),
    heuteGewaehlt: await page.getByRole('tab', { name: 'Heute', selected: true }).count(),
  };
  const leiste = await page.evaluate(() => [...document.querySelectorAll('#reiterleiste .reiter')].map((b) => { const r = b.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top), Math.round(r.width)]; }));
  const gleich = leiste.length === 3 && leiste.every(([, top, breite]) => top === leiste[0][1] && Math.abs(breite - 120) <= 2) && leiste[2][0] + leiste[2][2] <= 361;
  check(lm.main === 1 && lm.nav === 1 && lm.tablist === 1 && lm.tabs === 3 && lm.heuteGewaehlt === 1 && gleich,
    `F6 (${schrift}, ${farbe}): Hauptbereich und Navigation „Bereiche" mit den drei Reitern, die Leiste nebeneinander und gleich breit (${JSON.stringify({ ...lm, leiste })})`);
  await mehrSeite('dosis-karte');
  const kopf = await page.evaluate(() => {
    const h = document.querySelector('#kopf h1');
    return h ? {
      id: h.id, text: h.textContent, fokus: document.activeElement === h, klasse: h.className,
      groesse: parseFloat(getComputedStyle(h).fontSize) / parseFloat(getComputedStyle(document.documentElement).fontSize),
      rechts: Math.round(h.getBoundingClientRect().right),
    } : null;
  });
  check(kopf && kopf.id === 'seitentitel' && kopf.text === 'Dosis-Karte' && kopf.klasse === 'kopf-titel' && Math.abs(kopf.groesse - 1.05) < 0.01 && kopf.rechts <= 360
    && await page.getByRole('heading', { level: 1, name: 'Dosis-Karte' }).count() === 1 && await page.getByRole('main', { name: 'Dosis-Karte' }).count() === 1,
  `F4 (${schrift}, ${farbe}): der Seitentitel ist die Überschrift h1 – in der Größe wie bisher –, und der Hauptbereich heißt wie die Seite (${JSON.stringify(kopf)})`);
  check(kopf && kopf.fokus, 'F4: … nach dem Öffnen der Seite steht der Fokus auf dieser Überschrift');
  check(await page.evaluate(() => document.documentElement.scrollWidth) <= 360, `F4, F6 (${schrift}, ${farbe}): ohne waagerechtes Scrollen`);
}

// ================================================================ Runde 5 – Ansichten und Bericht
//
// Befunde aus der fünften Durchsicht (F…), die die Ansichten und das
// Stylesheet betreffen: der Fokus hinter der Reiterleiste, die Namen der
// Wertfelder, Überschriften, der Rand der Eingabefelder, Text mit Deckkraft,
// der Knopf „Besprochen", Längengrenzen mit Zähler, das Datum eines Termins,
// die Obergrenze des Vorrats und der Druck des Berichts. Jeder Fall
// scheiterte vor der Korrektur. Der Inhalt des Berichts (F9–F15, F26) steht
// in tests/test-sd-bericht.mjs.

/** Kontrast zweier Farben („rgb(…)") nach WCAG. */
const r5Rgb = (x) => (String(x).match(/[\d.]+/g) || ['0', '0', '0']).slice(0, 3).map(Number);
const r5Lum = ([r, g, b]) => {
  const f = (c) => { const v = c / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const r5Kontrast = (a, b) => {
  const [x, y] = [r5Lum(r5Rgb(a)), r5Lum(r5Rgb(b))].sort((m, n) => n - m);
  return Math.round(((x + 0.05) / (y + 0.05)) * 100) / 100;
};
/** Farbe, Deckkraft und der Hintergrund, auf dem ein Element wirklich liegt (der erste nicht durchsichtige darüber). */
const r5Farben = (sel, eigenschaft = 'color') => page.evaluate(({ x, e }) => {
  const el = document.querySelector(x);
  if (!el) return null;
  let h = el;
  let hg = 'rgb(255, 255, 255)';
  while (h) {
    const c = getComputedStyle(h).backgroundColor;
    if (c && !/rgba\(0, 0, 0, 0\)|transparent/.test(c)) { hg = c; break; }
    h = h.parentElement;
  }
  const cs = getComputedStyle(el);
  const eigenerHg = /rgba\(0, 0, 0, 0\)|transparent/.test(cs.backgroundColor) ? hg : cs.backgroundColor;
  let um = el.parentElement;
  let umgebung = 'rgb(255, 255, 255)';
  while (um) {
    const c = getComputedStyle(um).backgroundColor;
    if (c && !/rgba\(0, 0, 0, 0\)|transparent/.test(c)) { umgebung = c; break; }
    um = um.parentElement;
  }
  return { farbe: cs[e], deckkraft: cs.opacity, hg: eigenerHg, umgebung };
}, { x: sel, e: eigenschaft });

// ---------------------------------------------------------------- F1: kein Feld ganz hinter der Reiterleiste

// Mit Tab durch den Warnzeichen-Check: Vorher lag „… nicht mehr leben
// möchten" ganz hinter der festen Leiste – angehakt, aber nicht zu sehen.
for (const schrift of ['gross', 'sehr-gross']) {
  await laden(stand({ einstellungen: r4Einstellungen(schrift, 'hell') }));
  await page.click('#reiter-heute');
  await page.click('#ansicht [data-seite="warnzeichen"]');
  await page.evaluate(() => { window.scrollTo(0, 0); if (document.activeElement) document.activeElement.blur(); });
  const f1Verdeckt = [];
  let f1Lebensmuede = null;
  for (let i = 0; i < 80; i++) {
    await page.keyboard.press('Tab');
    const r = await page.evaluate(() => {
      const a = document.activeElement;
      if (!a || a === document.body) return null;
      if (a.closest('#reiterleiste')) return { ende: true };
      const zeile = ['checkbox', 'radio'].includes(a.type) ? (a.closest('label') || a) : a;
      const z = zeile.getBoundingClientRect();
      const f = a.getBoundingClientRect();
      const leiste = document.querySelector('#reiterleiste').getBoundingClientRect();
      const kopf = document.querySelector('.kopf').getBoundingClientRect();
      return {
        wert: a.value || a.textContent.trim().slice(0, 30), sichtbar: Math.round(Math.min(z.bottom, leiste.top) - Math.max(z.top, kopf.bottom)),
        feld: [Math.round(f.top), Math.round(f.bottom)], leiste: Math.round(leiste.top), kopf: Math.round(kopf.bottom),
      };
    });
    if (!r) continue;
    if (r.ende) break;
    if (r.sichtbar <= 0) f1Verdeckt.push(r.wert);
    if (r.wert === 'lebensmuede') f1Lebensmuede = r;
  }
  check(!f1Verdeckt.length && f1Lebensmuede && f1Lebensmuede.feld[0] >= f1Lebensmuede.kopf && f1Lebensmuede.feld[1] <= f1Lebensmuede.leiste,
    `F1 (${schrift}): mit Tab liegt kein Feld ganz hinter der Reiterleiste, das Häkchen „lebensmüde" ist ganz zu sehen (${JSON.stringify({ verdeckt: f1Verdeckt, lebensmuede: f1Lebensmuede })})`);
}

// ---------------------------------------------------------------- F2: Wertfelder mit dem Namen des Werts

// Vorher hießen alle Wertfelder für Vorleseprogramme nur „Wert", das
// TSH-Feld „Wert Steht auf dem Befund …".
await laden(stand());
await page.click('#reiter-verlauf');
await page.click('#ansicht [data-seite="labor"]:not([data-param])');
const f2 = {
  tsh: await page.getByRole('textbox', { name: 'Wert TSH', exact: true }).count(),
  ft4: await page.getByRole('textbox', { name: 'Wert fT4', exact: true }).count(),
  ft3: await page.getByRole('textbox', { name: 'Wert fT3', exact: true }).count(),
  nurWert: await page.getByRole('textbox', { name: 'Wert', exact: true }).count(),
  gruppe: await page.getByRole('group', { name: 'TSH', exact: true }).count(),
};
const f2Beschreibung = () => page.evaluate(() => {
  const el = document.querySelector('input[name=tsh_wert]');
  return (el.getAttribute('aria-describedby') || '').split(/\s+/).map((id) => document.getElementById(id)).filter(Boolean).map((x) => x.textContent.trim());
});
let f2Text = await f2Beschreibung();
check(f2.tsh === 1 && f2.ft4 === 1 && f2.ft3 === 1 && f2.nurWert === 0 && f2.gruppe === 1 && f2Text.some((x) => x.includes('< 0,01')),
  `F2: jedes Wertfeld trägt den Namen seines Werts, der Hinweis zu „< 0,01" ist die Beschreibung des TSH-Felds (${JSON.stringify({ ...f2, beschreibung: f2Text })})`);
await page.fill('input[name=tsh_wert]', 'abc');
await page.click('form[data-formular="labor"] button[type=submit]');
f2Text = await f2Beschreibung();
check(f2Text.length === 2 && f2Text[0].includes('< 0,01') && f2Text[1].includes('Bitte eine Zahl'),
  `F2, F3: nach einem Fehler beschreiben Hinweis und Fehlertext das Feld (${JSON.stringify(f2Text)})`);

// ---------------------------------------------------------------- F4: Überschriften der Dosis-Karte und von „Alle Laborwerte"

await laden(stand({
  profil: { geburtsjahr: 1962, herz: 'nein' },
  labor: [
    befund('b0', plus(TAG, -90), { tsh: w(3.1, 'mU/l', 0.4, 4), ft4: w(14, 'pmol/l', 12, 22) }),
    befund('b1', plus(TAG, -5), { tsh: w(7.5, 'mU/l', 0.4, 4), ft4: w(12.5, 'pmol/l', 12, 22) }),
  ],
  nachfragen: [{ id: 'n1', art: 'dosis_stimmt', bezug: 'b1', antwort: 'ja', am: plus(TAG, -1) }],
}));
await mehrSeite('dosis-karte');
const f4Ueberschrift = page.locator('#dosis-karte').getByRole('heading', { level: 2 });
const f4Name = (await f4Ueberschrift.count()) === 1 ? (await f4Ueberschrift.innerText()).replace(/\s+/g, ' ') : '';
const f4Groessen = await page.evaluate(() => ['.dosis-titel', '.pflicht'].map((x) => { const el = document.querySelector(`#dosis-karte ${x}`); return el ? getComputedStyle(el).fontSize : null; }));
check(f4Name.includes((await r4app.text('#dosis-karte .stufe-schild')).trim()) && f4Name.includes((await r4app.text('#dosis-karte .dosis-titel')).trim()) && f4Groessen[0] === f4Groessen[1],
  `F4: die Dosis-Karte hat eine Überschrift (Ebene 2) mit Stufe und Titel – der Titel so groß wie der Pflichttext („${f4Name}", ${f4Groessen.join('/')})`);
await page.click('#reiter-verlauf');
await page.click('#ansicht [data-seite="labor-liste"]');
const f4Ebenen = await page.evaluate(() => [...document.querySelectorAll('h1, h2, h3, h4, [role="heading"]')].filter((h) => h.getClientRects().length)
  .map((h) => Number(h.getAttribute('aria-level') || h.tagName.slice(1))));
check(f4Ebenen[0] === 1 && f4Ebenen.length >= 3 && f4Ebenen.every((e, i) => i === 0 || e <= f4Ebenen[i - 1] + 1),
  `F4: „Alle Laborwerte" springt nicht von h1 auf h3 (${f4Ebenen.join(' > ')})`);

// ---------------------------------------------------------------- F5: der Rand der Eingabefelder, F7: Text mit Deckkraft

for (const farbe of ['hell', 'dunkel']) {
  await laden(stand({ einstellungen: r4Einstellungen('gross', farbe) }));
  await page.click('#reiter-verlauf');
  await page.click('#ansicht [data-seite="labor"]:not([data-param])');
  const f5 = {};
  for (const [name, x] of [['TSH-Wert', 'input[name=tsh_wert]'], ['Datum', 'input[name=datum]'], ['Notiz', 'textarea[name=notiz]'], ['Weitere Werte', 'details.weitere > summary'], ['Auswahl', '.wahl-flaeche']]) {
    const f = await r5Farben(x, 'borderTopColor');
    f5[name] = f ? Math.min(r5Kontrast(f.farbe, f.hg), r5Kontrast(f.farbe, f.umgebung)) : 0;
  }
  check(Object.values(f5).every((k) => k >= 3), `F5 (${farbe}): der Rand der Eingabefelder hat mindestens 3 : 1 gegen Feld und Umgebung (${JSON.stringify(f5)})`);
}
// Tage vor dem Beginn des Zählens (Einrichten vor drei Tagen) und die grüne
// Unterzeile nach dem Abhaken.
for (const farbe of ['hell', 'dunkel']) {
  await laden(stand({ profil: { seit: plus(TAG, -3) }, einnahmen: {}, einstellungen: r4Einstellungen('gross', farbe) }));
  await page.click('#reiter-verlauf');
  const f7Tag = await r5Farben('.tag.leer .tag-zahl');
  const f7TagKnopf = await r5Farben('.tag.leer');
  await page.click('#reiter-heute');
  await page.click('.tablette');
  const f7Small = await r5Farben('.tablette.genommen small');
  const f7 = {
    tag: f7Tag ? r5Kontrast(f7Tag.farbe, f7Tag.hg) : 0, tagDeckkraft: f7TagKnopf && f7TagKnopf.deckkraft,
    small: f7Small ? r5Kontrast(f7Small.farbe, f7Small.hg) : 0, smallDeckkraft: f7Small && f7Small.deckkraft,
  };
  check(f7.tag >= 4.5 && f7.tagDeckkraft === '1' && f7.small >= 4.5 && f7.smallDeckkraft === '1',
    `F7 (${farbe}): Tageszahlen „noch nicht erfasst" und „✓ Tablette genommen – heute um …" ohne Deckkraft, mindestens 4,5 : 1 (${JSON.stringify(f7)})`);
}

// ---------------------------------------------------------------- F8: „✓ Besprochen" – Name und Zustand

await laden(stand({ fragen: [{ id: 'q1', text: 'Soll ich Vitamin D nehmen?', erledigt: false }, { id: 'q2', text: 'Kann das Herzstolpern von der Tablette kommen?', erledigt: true }] }));
await mehrSeite('fragen');
const f8 = {
  besprochen: await page.getByRole('button', { name: 'Besprochen', exact: true, pressed: true }).count(),
  offen: await page.getByRole('button', { name: 'Besprochen?', exact: true, pressed: false }).count(),
  wiederOffen: await page.getByRole('button', { name: 'Wieder offen' }).count(),
};
check(f8.besprochen === 1 && f8.offen === 1 && f8.wiederOffen === 0,
  `F8: eine besprochene Frage heißt „Besprochen" und ist gedrückt, eine offene „Besprochen?" – nicht „Wieder offen, gedrückt" (${JSON.stringify(f8)})`);

// ---------------------------------------------------------------- F23: Längengrenzen, Zähler, zu lange Notiz beim Zusammenführen

// Eine diktierte Frage mit 382 Zeichen: Vorher wurde sie still auf 300
// gekürzt – ohne ihr Ende „WICHTIG: Soll ich die Tablette …?".
const f23Frage = `${'Kann die Müdigkeit an der Dosis liegen? '.repeat(8)}WICHTIG: Soll ich die Tablette vor der Blutabnahme weglassen?`;
await laden(stand());
await mehrSeite('fragen');
await page.click('#ansicht [data-seite="frage"]:not([data-param])');
const f23Zaehler = () => r4app.text('form[data-formular="frage"] .zaehler');
const f23Feld = 'form[data-formular="frage"] textarea[name=text]';
const f23Leer = await f23Zaehler();
await page.fill(f23Feld, f23Frage);
const f23Beschreibung = await page.evaluate(() => { const el = document.querySelector('textarea[name=text]'); const id = (el.getAttribute('aria-describedby') || '').split(/\s+/)[0]; return id && document.getElementById(id) ? document.getElementById(id).textContent : ''; });
check(await attr(f23Feld, 'maxlength') === '1000' && f23Leer.includes('Höchstens 1000 Zeichen') && f23Beschreibung.includes('1000'),
  `F23: das Fragefeld nimmt höchstens 1000 Zeichen und sagt es – sichtbar und als Beschreibung („${f23Leer}")`);
await page.click('form[data-formular="frage"] button[type=submit]');
s = await gespeichert();
check(s.fragen.length === 1 && s.fragen[0].text === f23Frage, `F23: die Frage mit ${f23Frage.length} Zeichen ist ganz gespeichert (${s.fragen[0] ? s.fragen[0].text.length : 0})`);
await page.click('#ansicht [data-seite="frage"]:not([data-param])');
await page.fill(f23Feld, 'x'.repeat(950));
const f23Knapp = await f23Zaehler();
await page.fill(f23Feld, '');
await page.focus(f23Feld);
await page.keyboard.insertText('y'.repeat(1200));
const f23Voll = { zaehler: await f23Zaehler(), laenge: (await feldWert(f23Feld)).length, klasse: await attr('form[data-formular="frage"] .zaehler', 'class') };
check(f23Knapp.includes('Noch 50 Zeichen frei') && f23Voll.laenge === 1000 && f23Voll.zaehler.includes('voll') && (f23Voll.klasse || '').includes('voll'),
  `F23: der Zähler geht beim Tippen mit – „noch 50", und „voll", wenn beim Einfügen etwas abgeschnitten wird (${f23Knapp} | ${JSON.stringify(f23Voll)})`);
// Einzeilige Felder: die Grenzen aus dem Kern (sp.GRENZEN).
await r4app.klick('form[data-formular="frage"] [data-act="zurueck"]');
await page.click('#reiter-verlauf');
await page.click('#ansicht [data-seite="labor"]:not([data-param])');
const f23Labor = [await attr('input[name=laborName]', 'maxlength'), await attr('textarea[name=notiz]', 'maxlength')];
await page.click('#reiter-verlauf');
await page.click('#ansicht [data-seite="dosis"]');
const f23Dosis = [await attr('input[name=praeparat]', 'maxlength'), await attr('input[name=notiz]', 'maxlength')];
await mehrSeite('termine');
await page.click('#ansicht [data-seite="termin"]:not([data-param])');
const f23Termin = [await attr('input[name=wo]', 'maxlength'), await attr('textarea[name=notiz]', 'maxlength')];
await mehrSeite('darstellung');
const f23Anrede = await attr('form[data-formular="anrede"] input[name=name]', 'maxlength');
check(JSON.stringify([f23Labor, f23Dosis, f23Termin, f23Anrede]) === JSON.stringify([['60', '1000'], ['80', '1000'], ['80', '1000'], '60']),
  `F23: Labor, Präparat, Ort, Anrede und Notizen haben die Grenze, die gespeichert wird (${JSON.stringify([f23Labor, f23Dosis, f23Termin, f23Anrede])})`);
// Zum Befund desselben Tages mit einer Notiz von 900 Zeichen kommt fT4 mit
// 200 Zeichen Notiz. Vorher wurde die zusammengeführte Notiz auf 300 Zeichen
// gekürzt – die neue fiel ganz weg, „Zum Befund … hinzugefügt".
const f23Alt = `Laborärztin: ${'a'.repeat(880)} Ende.`;
const f23Neu = `Nachgereicht: ${'b'.repeat(170)} Biotin bitte eine Woche vor der nächsten Abnahme weglassen.`;
await laden(stand({ labor: [befund('b1', plus(TAG, -5), { tsh: w(2.1, 'mU/l', 0.27, 4.2) }, { notiz: f23Alt })] }));
await page.click('#reiter-verlauf');
await page.click('#ansicht [data-seite="labor"]:not([data-param])');
await page.fill('input[name=datum]', plus(TAG, -5));
await page.fill('input[name=ft4_wert]', '14');
await page.fill('textarea[name=notiz]', f23Neu);
await page.click('form[data-formular="labor"] button[type=submit]');
await page.waitForTimeout(150);
if (await gibt('dialog.rueckfrage [data-act="befund-bestaetigen"]')) await page.click('dialog.rueckfrage [data-act="befund-bestaetigen"]');
s = await gespeichert();
const f23Fehler = await page.evaluate(() => {
  const el = document.querySelector('textarea[name=notiz]');
  const id = el ? (el.getAttribute('aria-describedby') || '').split(/\s+/).find((x) => x.startsWith('fehler-')) : null;
  return id && document.getElementById(id) ? document.getElementById(id).textContent : '';
});
check(s.labor.length === 1 && s.labor[0].notiz === f23Alt && !s.labor[0].ft4 && f23Fehler.includes('1000') && await feldWert('textarea[name=notiz]') === f23Neu,
  `F23: zu lang zusammen mit der vorhandenen Notiz – nichts wird gekürzt, der Fehler steht an der Notiz, die Eingaben bleiben („${f23Fehler.slice(0, 90)}…")`);

// ---------------------------------------------------------------- F25: das Datum eines Termins, F29: Vorrat und Zahlen ohne Exponent

await laden(stand());
await mehrSeite('termine');
await page.click('#ansicht [data-seite="termin"]:not([data-param])');
const f25Max = await attr('form[data-formular="termin"] input[name=datum]', 'max');
await page.fill('form[data-formular="termin"] input[name=datum]', '9999-12-31');
await page.click('form[data-formular="termin"] button[type=submit]');
s = await gespeichert();
check(f25Max === plus(TAG, 5 * 366) && s.termine.length === 0 && (await r4app.text('form[data-formular="termin"] .feld-fehler')).includes('fünf Jahre'),
  `F25: ein Termin liegt höchstens fünf Jahre voraus – das Feld hat ein max, das Jahr 9999 wird nicht gespeichert (max ${f25Max})`);
await mehrSeite('vorrat');
await page.fill('form[data-formular="vorrat"] input[name=tabletten]', '99999999999999999999999');
await page.click('form[data-formular="vorrat"] button[type=submit]');
s = await gespeichert();
const f29Fehler = await r4app.text('form[data-formular="vorrat"] .feld-fehler');
// Vor der Korrektur war gespeichert und das Formular zu – dann neu öffnen, statt zu hängen.
if (!(await gibt('form[data-formular="vorrat"]'))) await mehrSeite('vorrat');
await page.fill('form[data-formular="vorrat"] input[name=tabletten]', '10000');
await page.click('form[data-formular="vorrat"] button[type=submit]');
const f29Danach = await gespeichert();
check(s.vorrat === null && f29Fehler.includes('10000') && f29Danach.vorrat && f29Danach.vorrat.tabletten === 10000,
  `F29: ein Vorrat über 10 000 wird nicht gespeichert (und beim nächsten Laden still verworfen), 10 000 schon („${f29Fehler}")`);
// Ein Wert aus einer Sicherung steht ohne Exponent im Feld – „1e+21" las
// zahlAus() nicht, und ein bloßes „Speichern" scheiterte.
await laden(stand({ labor: [befund('b1', plus(TAG, -5), { tsh: w(2.1, 'mU/l', 0.27, 4.2), crp: w(1e21, 'mg/l', null, 5) })] }));
await page.click('#reiter-verlauf');
await page.click('#ansicht [data-seite="labor"][data-param="b1"]');
const f29Feld = await feldWert('input[name=crp_wert]');
check(f29Feld === '1000000000000000000000', `F29: eine große Zahl steht ohne Exponent im Feld („${f29Feld}")`);

// ---------------------------------------------------------------- F16: Druck des Berichts

// Im dunklen Farbschema behielt die Karte beim Drucken ihren fast schwarzen
// Hintergrund unter schwarzer Schrift, und der Satz „Zum Zeigen im
// Sprechzimmer …" stand mit auf dem Papier.
await laden(stand({ einstellungen: r4Einstellungen('sehr-gross', 'dunkel'), labor: [befund('b1', plus(TAG, -5), { tsh: w(2.1, 'mU/l', 0.27, 4.2), ft4: w(15, 'pmol/l', 12, 22) })] }));
await mehrSeite('bericht');
await page.emulateMedia({ media: 'print' });
const f16 = await page.evaluate(() => {
  const b = document.querySelector('#berichtText');
  const satz = [...document.querySelectorAll('#ansicht p')].find((p) => p.textContent.includes('Zum Zeigen im Sprechzimmer'));
  return {
    karte: getComputedStyle(b.closest('.karte')).backgroundColor, html: getComputedStyle(document.documentElement).backgroundColor,
    schrift: getComputedStyle(b).color, groesse: getComputedStyle(b).fontSize, satz: satz ? getComputedStyle(satz).display : null,
  };
});
const f16Pdf = await page.pdf({ format: 'A4', printBackground: true });
const f16Seiten = (f16Pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
await page.emulateMedia({ media: 'screen' });
check(f16.karte === 'rgb(255, 255, 255)' && f16.html === 'rgb(255, 255, 255)' && f16.schrift === 'rgb(0, 0, 0)' && f16.satz === 'none',
  `F16: im dunklen Farbschema druckt der Bericht schwarz auf weiß, ohne den Satz für den Bildschirm (${JSON.stringify(f16)})`);
check(f16.groesse === '16px' && f16Seiten === 1, `F16: … in 12 pt – ein einfacher Bericht passt auf ein Blatt (${f16.groesse}, ${f16Seiten} Seite(n))`);

// ---------------------------------------------------------------- Runde 5 (Ansichten) bei „sehr groß", hell und dunkel

for (const farbe of ['hell', 'dunkel']) {
  await laden(stand({ einstellungen: r4Einstellungen('sehr-gross', farbe), labor: [befund('b1', plus(TAG, -5), { tsh: w(7.5, 'mU/l', 0.4, 4) }, { notiz: 'Hausarzt\n\n12.08.2026: TSH 0,05' })],
    nachfragen: [{ id: 'n1', art: 'dosis_stimmt', bezug: 'b1', antwort: 'ja', am: plus(TAG, -1) }] }));
  const breiten = [];
  await page.click('#reiter-verlauf');
  await page.click('#ansicht [data-seite="labor"]:not([data-param])');
  breiten.push(['Laborformular', await page.evaluate(() => document.documentElement.scrollWidth)]);
  await mehrSeite('dosis-karte');
  breiten.push(['Dosis-Karte', await page.evaluate(() => document.documentElement.scrollWidth)]);
  await mehrSeite('fragen');
  await page.click('#ansicht [data-seite="frage"]:not([data-param])');
  await page.fill('form[data-formular="frage"] textarea[name=text]', 'x'.repeat(990));
  breiten.push(['Frage mit Zähler', await page.evaluate(() => document.documentElement.scrollWidth)]);
  await page.fill('form[data-formular="frage"] textarea[name=text]', '');
  await mehrSeite('bericht');
  breiten.push(['Bericht', await page.evaluate(() => document.documentElement.scrollWidth)]);
  check(breiten.every(([, b]) => b <= 360), `Runde 5 (Ansichten, sehr groß, ${farbe}): ohne waagerechtes Scrollen (${breiten.map(([n, b]) => `${n} ${b}`).join(', ')})`);
}

// ================================================================ Nachprüfung Runde 5
// Die aufgeklappte 112-Karte der Befinden-Seite („… – JETZT") klappt nicht
// zu, wenn ein anderes Fenster etwas speichert (Nebenwirkung von F24).
{
  await laden(stand());
  await page.click('#reiter-verlauf');
  await page.click('[data-seite="befinden"]:not([data-param])');
  await page.click('[data-act="notfall-jetzt"]');
  await page.waitForTimeout(300);
  const vorher = await page.evaluate(() => !document.getElementById('notfall-jetzt-huelle').hidden);
  const b = await ctx.newPage();
  b.on('dialog', (d) => d.accept());
  await b.goto(SD_URL, { waitUntil: 'networkidle' });
  await b.evaluate((key) => {
    const s = JSON.parse(localStorage.getItem(key));
    s.fragen.push({ id: 'aus-b', text: 'Frage aus dem anderen Fenster', erledigt: false });
    localStorage.setItem(key, JSON.stringify(s));
  }, SCHLUESSEL);
  await page.waitForTimeout(500);
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await page.waitForTimeout(500);
  const nachher = await page.evaluate(() => ({ offen: !document.getElementById('notfall-jetzt-huelle')?.hidden, meldung: document.getElementById('meldung').textContent }));
  check(vorher && nachher.offen && /anderen Fenster/.test(nachher.meldung),
    `Nachprüfung R5: die offene 112-Karte bleibt offen, wenn ein anderes Fenster speichert – mit Meldung (${JSON.stringify(nachher)})`);
  await b.close();
}

// ================================================================ Runde 6 – App
//
// Befunde aus der sechsten Durchsicht (G…), die js/app.js betreffen: eine
// Änderung im anderen Fenster bei offenem Formular und beim Einrichten, der
// gemerkte Reiter, die Rückfrage zur Praxis bei schon eingetragener Dosis,
// das Datum der Sicherung und „Rückgängig" nach dem Zurücknehmen. Den
// Service Worker (G1) prüft tests/test-sd-offline.mjs. Jeder Fall scheiterte
// vor der Korrektur.

/** Ein zweites Fenster derselben App im selben Browser – ein Tab neben der installierten App. */
async function r6Fenster(k = ctx) {
  const p = await k.newPage();
  p.on('dialog', (d) => d.accept());
  await p.goto(SD_URL, { waitUntil: 'networkidle' });
  return p;
}
const r6Profil = async (p) => {
  await p.click('#reiter-mehr');
  await p.click('#ansicht [data-seite="profil"]');
};
const r6Lage = (p) => p.evaluate(() => {
  const m = document.getElementById('meldung');
  const r = m.getBoundingClientRect();
  return {
    meldung: m.classList.contains('zeigen') ? m.textContent : '',
    rueckgaengig: m.querySelectorAll('[data-act="tablette-rueckgaengig"]').length,
    links: Math.round(r.left), rechts: Math.round(r.right), breite: document.documentElement.scrollWidth,
  };
});
/** Im zweiten Fenster „Herzerkrankung: Ja" speichern, während im ersten das Geburtsjahr getippt ist. */
async function r6ZweiProfile(a, b) {
  await r6Profil(a);
  await r6Profil(b);
  await a.fill('form[data-formular="profil"] input[name=geburtsjahr]', '1947');
  await b.check('form[data-formular="profil"] input[name=herz][value=ja]', { force: true });
  await b.click('form[data-formular="profil"] button[type=submit]');
  await a.waitForTimeout(700);
  return a.evaluate(() => ({
    herzJa: Boolean(document.querySelector('form[data-formular="profil"] input[name=herz][value=ja]')?.checked),
    jahr: document.querySelector('form[data-formular="profil"] input[name=geburtsjahr]')?.value ?? null,
    fokus: document.activeElement ? document.activeElement.getAttribute('name') : null,
  }));
}

// ---------------------------------------------------------------- G2: fremde Änderung bei offenem Formular

// Beide Fenster auf „Über mich". Im ersten ist das Geburtsjahr getippt, aber
// nicht gespeichert; im zweiten wird „Herzerkrankung: Ja" gespeichert. Vorher
// blieb das erste stehen, zeigte weiter „Nein" und versprach „Die Anzeige
// wird nach dem Speichern aktualisiert" – sein Speichern schrieb „Nein" zurück.
{
  await laden(stand({ profil: { herz: 'nein', geburtsjahr: 1948 } }));
  const b = await r6Fenster();
  const g2 = await r6ZweiProfile(page, b);
  const g2Meldung = (await r6Lage(page)).meldung;
  check(g2.herzJa && g2.jahr === '1947' && g2Meldung.includes('anderen Fenster') && !g2Meldung.includes('nach dem Speichern aktualisiert'),
    `G2: das Formular zeigt den neuen Stand („Herzerkrankung: Ja" aus dem anderen Fenster), das getippte Geburtsjahr bleibt (${JSON.stringify(g2)}, „${g2Meldung}")`);
  check(g2.fokus === 'geburtsjahr', `G2: … der Fokus bleibt im Feld, in dem getippt wurde (${g2.fokus})`);
  await page.click('form[data-formular="profil"] button[type=submit]');
  const g2s = await gespeichert();
  check(g2s.profil.herz === 'ja' && Number(g2s.profil.geburtsjahr) === 1947,
    `G2: … Speichern behält beides – die Angabe aus dem anderen Fenster wird nicht still überschrieben (herz ${g2s.profil.herz}, Jahr ${g2s.profil.geburtsjahr})`);
  // Gibt es den Eintrag hinter dem Formular nicht mehr (im anderen Fenster
  // gelöscht), bleibt die Seite stehen – ein leeres Formular um das geänderte
  // Feld wäre schlimmer. Die Meldung verspricht dann nichts, was nicht geschieht.
  await laden(stand({ labor: [befund('b1', plus(TAG, -5), { tsh: w(2, 'mU/l', 0.27, 4.2) })] }));
  await page.click('#reiter-verlauf');
  await page.click('#ansicht [data-seite="labor"][data-param="b1"]');
  await page.fill('input[name=tsh_wert]', '3,1');
  await b.evaluate((key) => {
    const st = JSON.parse(localStorage.getItem(key));
    st.labor = [];
    localStorage.setItem(key, JSON.stringify(st));
  }, SCHLUESSEL);
  await page.waitForTimeout(600);
  const g2Weg = { tsh: await feldWert('input[name=tsh_wert]'), datum: await feldWert('form[data-formular="labor"] input[name=datum]'), meldung: (await r6Lage(page)).meldung };
  check(g2Weg.tsh === '3,1' && g2Weg.datum === plus(TAG, -5) && g2Weg.meldung.includes('anderen Fenster') && g2Weg.meldung.includes('Wenn Sie hier speichern') && !g2Weg.meldung.includes('aktualisiert'),
    `G2: im anderen Fenster gelöscht – das Formular bleibt, wie es war, und die Meldung sagt, was beim Speichern gilt (${JSON.stringify(g2Weg)})`);
  await b.close();
}

// ---------------------------------------------------------------- G3: fremde Änderung beim Einrichten

// Zwei Fenster in der Einrichtung. Im ersten sind in Schritt 2 Stärke und
// Präparat getippt, das zweite schließt Schritt 1 ab: Vorher zeichnete das
// erste den Schritt neu, und das Getippte war still weg. Dann eine offene
// Rückfrage („7,5 µg?"), und das zweite speichert Schritt 2: Vorher tat
// „Ja, stimmt" danach nichts, die 7,5 wurden nicht gespeichert.
{
  const k = await browser.newContext({ viewport: { width: 360, height: 740 }, locale: 'de-DE', serviceWorkers: 'block' });
  await k.addInitScript(uhrStellen);
  const a = await k.newPage();
  a.on('dialog', (d) => d.accept());
  await a.goto(SD_URL, { waitUntil: 'networkidle' });
  await a.evaluate((t) => {
    localStorage.clear();
    localStorage.setItem('__testtag', t);
    localStorage.setItem('__testzeit', '09:00');
  }, TAG);
  await a.reload({ waitUntil: 'networkidle' });
  await a.check('input[name=behandelt]').catch(() => {});
  await a.fill('input[name=name]', 'Frau Berger');
  await a.click('[data-act="willkommen-weiter"]');
  await a.waitForTimeout(700);
  const b = await r6Fenster(k);
  await a.fill('input[name=mikrogramm]', '88');
  await a.fill('input[name=praeparat]', 'Euthyrox');
  await b.fill('input[name=name]', 'Frau Berger aus dem Tab');
  await b.click('[data-act="willkommen-weiter"]');
  await a.waitForTimeout(700);
  const schritt = (p) => p.evaluate(() => ({
    titel: document.querySelector('#kopf .kopf-titel')?.textContent || '',
    mg: document.querySelector('input[name=mikrogramm]')?.value ?? null,
    praeparat: document.querySelector('input[name=praeparat]')?.value ?? null,
  }));
  const g3 = await schritt(a);
  const g3Meldung = (await r6Lage(a)).meldung;
  check(g3.titel === 'Schritt 2 von 3' && g3.mg === '88' && g3.praeparat === 'Euthyrox' && g3Meldung.includes('anderen Fenster'),
    `G3: beim Einrichten bleiben Stärke und Präparat stehen, wenn ein anderes Fenster etwas speichert – mit Meldung (${JSON.stringify(g3)}, „${g3Meldung}")`);
  await a.fill('input[name=mikrogramm]', '7,5');
  await a.waitForTimeout(700);
  await a.click('[data-act="willkommen-weiter"]');
  await a.waitForTimeout(300);
  const rueckfrageDa = await a.locator('dialog.rueckfrage').count();
  await b.fill('input[name=mikrogramm]', '50');
  await b.click('[data-act="willkommen-weiter"]');
  await a.waitForTimeout(800);
  const g3Stehen = (await r6Lage(a)).meldung;
  if (await a.locator('dialog.rueckfrage [data-act="befund-bestaetigen"]').count()) await a.click('dialog.rueckfrage [data-act="befund-bestaetigen"]');
  await a.waitForTimeout(700);
  const g3Nach = await schritt(a);
  const g3s = await a.evaluate((key) => JSON.parse(localStorage.getItem(key) || 'null'), SCHLUESSEL);
  check(rueckfrageDa === 1 && g3Nach.titel === 'Schritt 3 von 3' && g3s.dosen.length === 1 && g3s.dosen[0].mikrogramm === 7.5,
    `G3: mit offener Rückfrage bleibt der Schritt stehen, „Ja, stimmt" speichert die bestätigten 7,5 µg (${g3Nach.titel}, ${JSON.stringify(g3s.dosen.map((d) => d.mikrogramm))})`);
  check(g3Stehen.includes('anderen Fenster') && !g3Stehen.includes('aktualisiert'), `G3: … die Meldung verspricht dabei nichts, was nicht geschieht („${g3Stehen}")`);
  await k.close();
}

// ---------------------------------------------------------------- G4: der gemerkte Reiter

// „Sicherung einlesen" führt zu „Heute" – gemerkt blieb aber „Mehr", und das
// Neuladen nach einem Update (oder von Hand) sprang ohne Zutun dorthin.
// Ebenso „Fertig – zur App" nach „Alles löschen".
{
  await laden(stand());
  await mehrSeite('sicherung');
  const datei = { ...stand({ profil: { name: 'Aus der Datei' } }), exportiertAm: `${plus(TAG, -1)}T10:00:00Z`, app: 'schilddruese' };
  await page.setInputFiles('#sicherungDatei', { name: 'sicherung.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(datei)) });
  await page.waitForTimeout(500);
  const eingelesen = await attr('.reiter[aria-selected="true"]', 'data-reiter');
  await page.evaluate(() => { window.__schilddrueseNeuLaden = true; window.__schilddrueseNeuLadenPlanen(); });
  await page.waitForTimeout(2200);
  await page.waitForLoadState('networkidle');
  const nachUpdate = await attr('.reiter[aria-selected="true"]', 'data-reiter');
  check(eingelesen === 'heute' && nachUpdate === 'heute', `G4: nach „Sicherung einlesen" und dem Neuladen nach einem Update bleibt „Heute" (${eingelesen} → ${nachUpdate})`);
  await mehrSeite('ueber');
  await page.click('[data-act="alles-loeschen"]');
  await page.click('[data-act="willkommen-weiter"]');
  await page.waitForTimeout(700);
  await page.fill('input[name=mikrogramm]', '75');
  await page.click('[data-act="willkommen-weiter"]');
  await page.waitForTimeout(700);
  await page.click('[data-act="willkommen-weiter"]');
  await page.waitForTimeout(700);
  const fertig = await attr('.reiter[aria-selected="true"]', 'data-reiter');
  await page.reload({ waitUntil: 'networkidle' });
  const g4Neu = await attr('.reiter[aria-selected="true"]', 'data-reiter');
  check(fertig === 'heute' && g4Neu === 'heute', `G4: nach „Alles löschen" und „Fertig – zur App" öffnet das Neuladen wieder „Heute" (${fertig} → ${g4Neu})`);
}

// ---------------------------------------------------------------- G5: Rückfrage zur Praxis bei schon eingetragener Dosis

// Befund vom … mit „Die Praxis hat entschieden: Neue Dosis" (vor 21 Tagen),
// 88 µg seit 20 Tagen eingetragen. Ein erneuter Tipp auf „Neue Dosis
// eintragen", dann „Abbrechen": Vorher rückte das Datum der Entscheidung
// auf heute, und die App fragte „Die neue Dosis ist noch nicht eingetragen" –
// „Nein" löschte die Entscheidung, der Bericht widersprach sich.
{
  await laden(stand({
    dosen: [{ id: 'd1', ab: plus(TAG, -400), praeparat: 'L-Thyroxin', mikrogramm: 75, tabletten: 1, notiz: '' },
      { id: 'd2', ab: plus(TAG, -20), praeparat: 'L-Thyroxin', mikrogramm: 88, tabletten: 1, notiz: '', praxis: true }],
    labor: [befund('b1', plus(TAG, -24), { tsh: w(8, 'mU/l', 0.27, 4.2) }, { praxis: 'geaendert', praxisAm: plus(TAG, -21) })],
  }));
  await mehrSeite('dosis-karte');
  await r4app.klick('#dosis-karte [data-seite="praxis-entschieden"]');
  await r4app.klick('[data-act="praxis-entscheid"][data-wert="geaendert"]');
  const formDa = await gibt('form[data-formular="dosis"]');
  const g5Datum = (await gespeichert()).labor[0].praxisAm;
  await r4app.klick('form[data-formular="dosis"] [data-act="zurueck"]');
  await page.waitForTimeout(300);
  const g5Frage = await gibt(r4app.praxisDialog);
  // Vor der Korrektur: die Frage schließen, ohne etwas zu ändern.
  if (g5Frage) await r4app.klick(`${r4app.praxisDialog} [data-wert="spaeter"]`);
  const g5b = (await gespeichert()).labor[0];
  check(formDa && g5Datum === plus(TAG, -21) && !g5Frage && g5b.praxis === 'geaendert' && g5b.praxisAm === plus(TAG, -21) && await gibt('#dosis-karte'),
    `G5: 88 µg stehen schon da – kein neues Datum für die Entscheidung, keine Frage „noch nicht eingetragen", zurück auf der Karte (${g5Datum}, Frage ${g5Frage}, ${g5b.praxis} ${g5b.praxisAm})`);
}

// ---------------------------------------------------------------- G8: das Datum der Sicherung

// Nach „Sicherung speichern" stand über der Meldung weiter „Noch keine
// Sicherung gespeichert.", und in der Datei stand letzteSicherung: null.
{
  await laden(stand());
  await mehrSeite('sicherung');
  const [g8Download] = await Promise.all([page.waitForEvent('download'), page.click('[data-act="sicherung-speichern"]')]);
  const g8Datei = JSON.parse(readFileSync(await g8Download.path(), 'utf8'));
  await page.waitForTimeout(300);
  const g8Text = await ansichtText(page);
  check(!g8Text.includes('Noch keine Sicherung gespeichert') && g8Text.includes('Letzte Sicherung'),
    `G8: nach „Sicherung speichern" nennt die Seite gleich die letzte Sicherung („${(g8Text.match(/Letzte Sicherung[^\n]*|Noch keine Sicherung[^\n]*/) || [''])[0]}")`);
  check(g8Datei.letzteSicherung === TAG, `G8: … und die Datei kennt ihr Sicherungsdatum (${g8Datei.letzteSicherung})`);
  // Eine ältere Datei ohne dieses Datum: Der eingelesene Stand ist am Tag der Datei gesichert.
  const alt = { ...stand({ profil: { name: 'Alte Datei' } }), letzteSicherung: null, exportiertAm: `${plus(TAG, -3)}T10:00:00.000Z`, app: 'schilddruese' };
  await page.setInputFiles('#sicherungDatei', { name: 'alt.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(alt)) });
  await page.waitForTimeout(500);
  const g8s = await gespeichert();
  await page.click('#reiter-mehr');
  const g8Menue = await ansichtText(page);
  check(g8s.profil.name === 'Alte Datei' && g8s.letzteSicherung === plus(TAG, -3) && !g8Menue.includes('Noch nie gesichert'),
    `G8: nach dem Einlesen einer älteren Datei gilt ihr Datum als letzte Sicherung, nicht „Noch nie gesichert" (${g8s.letzteSicherung})`);
}

// ---------------------------------------------------------------- G9: „Rückgängig" nach dem Zurücknehmen

// „Tablette abgehakt [Rückgängig]", dann „antippen zum Zurücknehmen": Vorher
// blieb die Meldung mit „Rückgängig" unter „Noch nicht eingetragen" stehen,
// und der Knopf tat nichts. Ebenso, wenn ein anderes Fenster zurücknimmt.
{
  await ladenHeute(stand());
  await page.click('[data-act="tablette"]');
  const vorher = await r6Lage(page);
  await page.waitForTimeout(700);
  await page.click('[data-act="tablette-zurueck"]');
  await page.waitForTimeout(300);
  const nachher = await r6Lage(page);
  const g9s = await gespeichert();
  check(vorher.rueckgaengig === 1 && nachher.rueckgaengig === 0 && nachher.meldung.includes('Zurückgenommen') && !(TAG in g9s.einnahmen),
    `G9: nach „Zurücknehmen" verschwindet „Rückgängig", die Meldung sagt, was jetzt gilt („${nachher.meldung}")`);
  await page.waitForTimeout(700);
  await page.click('[data-act="tablette"]');
  const b = await r6Fenster();
  await b.click('#reiter-heute');
  await b.click('[data-act="tablette-zurueck"]');
  await page.waitForTimeout(700);
  const fremd = await r6Lage(page);
  check(fremd.rueckgaengig === 0 && await gibt('[data-act="tablette"]'),
    `G9: … auch wenn ein anderes Fenster den Haken zurücknimmt (${JSON.stringify(fremd)})`);
  await b.close();
}

// ---------------------------------------------------------------- Runde 6 (App) bei „sehr groß", hell und dunkel, mit Finger

// Die neuen Meldungen passen auf 360 px, auch bei Schrift „sehr groß".
for (const farbe of ['hell', 'dunkel']) {
  const f = await r5Finger(stand({ einstellungen: r4Einstellungen('sehr-gross', farbe), profil: { herz: 'nein', geburtsjahr: 1948 } }));
  const b = await r6Fenster(f.k);
  const zwei = await r6ZweiProfile(f.p, b);
  const g2Lage = await r6Lage(f.p);
  await b.close();
  await f.p.click('#reiter-heute');
  await f.p.waitForTimeout(700);
  await f.p.locator('[data-act="tablette"]').tap();
  await f.p.waitForTimeout(800);
  await f.p.locator('[data-act="tablette-zurueck"]').tap();
  await f.p.waitForTimeout(400);
  const g9Lage = await r6Lage(f.p);
  const passt = (l) => l.meldung && l.links >= 0 && l.rechts <= 360 && l.breite <= 360;
  check(zwei.herzJa && zwei.jahr === '1947' && passt(g2Lage) && passt(g9Lage) && g9Lage.rueckgaengig === 0 && !f.fehlerListe.length,
    `Runde 6 (App): bei „sehr groß" und ${farbe} passen die Meldungen zum anderen Fenster und zum Zurücknehmen auf 360 px (${JSON.stringify({ g2Lage, g9Lage, fehler: f.fehlerListe.slice(0, 1) })})`);
  await f.k.close();
}

// ================================================================ Runde 6 – Ansichten
//
// Befunde aus der sechsten Durchsicht (G…), die die Ansichten betreffen: das
// Dosis-Formular bei einer Berichtigung und die „nie genommene" Dosis (G11),
// die Angaben über sie auf der Dosis-Karte (G6), Anruf-Knöpfe bei weiteren
// Werten (G18), „Über mich" mit der Kontroll-Erinnerung (G20) und der
// Kaffee-Frage (G21). Wissen und Bericht prüfen tests/test-sd-wissen.mjs und
// tests/test-sd-bericht.mjs. Jeder Fall scheiterte vor der Korrektur.

/*
 * G11: 75 µg seit langem; die Praxis ordnete 100 µg an (vor 60 Tagen
 * eingetragen, „auf Anweisung: ja"), genommen wurden sie nie. Der neue Befund
 * von vorgestern, X3 steht noch aus.
 */
const R6_LANGE = plus(TAG, -800);
const R6_ANGEORDNET = plus(TAG, -60);
const r6g11 = ({ dosen = [], nachfragen = [] } = {}) => stand({
  dosen: [
    { id: 'd1', ab: R6_LANGE, praeparat: 'L-Thyroxin', mikrogramm: 75, tabletten: 1, notiz: '' },
    { id: 'dC', ab: R6_ANGEORDNET, praeparat: 'L-Thyroxin', mikrogramm: 100, tabletten: 1, notiz: '', praxis: true },
    ...dosen,
  ],
  labor: [
    befund('bA', plus(TAG, -90), { tsh: w(25, 'mU/l', 0.4, 4) }, { praxis: 'geaendert', praxisAm: R6_ANGEORDNET }),
    befund('bB', plus(TAG, -2), { tsh: w(6.5, 'mU/l', 0.4, 4) }),
  ],
  nachfragen: [{ id: 'n0', art: 'dosis_stimmt', bezug: 'bA', antwort: 'ja', am: plus(TAG, -89) }, ...nachfragen],
});
const r6Dialog = async () => ((await gibt('dialog.rueckfrage')) ? (await page.locator('dialog.rueckfrage').innerText()).replace(/\s+/g, ' ') : '');
const r6Bericht = async () => { await mehrSeite('bericht'); return page.locator('#berichtText').innerText(); };
const r6Berichtigung = (st) => st.dosen.find((d) => d.berichtigung) || {};

// ---------------------------------------------------------------- G11 (a): neue Berichtigung mit Vermerk, dann der wahre Beginn

// Karte X3 → „Nein, ich nehme etwas anderes" → 75 µg eintragen; dann, wie
// die Karte rät, „Gilt ab" auf den Tag, seit dem sie es nimmt. Vorher ohne
// Rückfrage gespeichert: Die 100 µg galten wieder als ihre Dosis, auf der
// Karte, im Bericht „Aktuell: 100 µg … auf Anweisung der Praxis: ja".
{
  await laden(r6g11());
  await mehrSeite('dosis-karte');
  await r4app.klick('#dosis-karte [data-act="frage-antwort"][data-feld="dosis_stimmt"][data-wert^="nein"]');
  await r4app.klick('#dosis-karte [data-act="seite"][data-seite="dosis"]');
  await page.fill('form[data-formular="dosis"] input[name=mikrogramm]', '75');
  await page.check('form[data-formular="dosis"] input[name=praxis][value=nein]', { force: true });
  await page.click('form[data-formular="dosis"] button[type=submit]');
  const neu = r6Berichtigung(await gespeichert());
  check(neu.ab === TAG && neu.statt === 'dC', `G11: die Berichtigung vermerkt, welchen Eintrag sie berichtigt – die 100 µg, nach denen die Karte fragte (${JSON.stringify(neu)})`);
  if (!(await gibt('#dosis-karte'))) await mehrSeite('dosis-karte');
  await r4app.klick(`#dosis-karte [data-act="seite"][data-seite="dosis"][data-param="${neu.id}"]`);
  await page.fill('form[data-formular="dosis"] input[name=ab]', R6_LANGE);
  await page.click('form[data-formular="dosis"] button[type=submit]');
  await page.waitForTimeout(300);
  const dialogA = await r6Dialog();
  const meldungA = await r4app.meldung();
  const nachher = r6Berichtigung(await gespeichert());
  check(!dialogA && nachher.ab === R6_LANGE && nachher.statt === 'dC' && meldungA.includes(`Die 100 µg am Tag ab ${kurz(R6_ANGEORDNET)} zählen jetzt als nie genommen`),
    `G11: „Gilt ab" auf den wahren Beginn – ohne Rückfrage, die Meldung sagt, dass die 100 µg jetzt als nie genommen zählen („${meldungA}")`);
  await mehrSeite('dosis-karte');
  const karteA = await r4a.text('#dosis-karte');
  check(!karteA.includes('100 µg') && karteA.includes(`Ihre Dosis laut App: 75 µg am Tag seit ${kurz(R6_LANGE)}`),
    `G11: die Karte rechnet mit 75 µg seit dem wahren Beginn, nicht wieder mit den 100 µg („${karteA.slice(0, 90)}…")`);
  const berichtA = await r6Bericht();
  check(berichtA.includes(`Aktuell: L-Thyroxin 75 µg, 1 Tablette am Tag, seit ${kurz(R6_LANGE)}`) && !berichtA.includes('Aktuell: L-Thyroxin 100 µg')
    && berichtA.includes(`Berichtigung (Angabe): Ab ${kurz(R6_ANGEORDNET)} war L-Thyroxin 100 µg, 1 Tablette am Tag eingetragen (auf Anweisung der Praxis) – nach Angabe der Patientin nie genommen`),
  'G11: der Bericht nennt 75 µg als aktuelle Dosis und die angeordneten 100 µg als nie genommen');
  await page.click('#reiter-verlauf');
  await page.click('#ansicht [data-seite="dosis-liste"]');
  const zeileC = await r4a.text('#ansicht [data-seite="dosis"][data-param="dC"]');
  check(zeileC.includes('nie genommen (berichtigt)') && !zeileC.includes('aktuell') && !zeileC.includes('geplant'),
    `G11: in „Dosis im Verlauf" stehen die 100 µg als „nie genommen (berichtigt)" („${zeileC}")`);
  // Runde 6 – Rest (X3b nach G11): Die Berichtigung merkt sich ihren Tag, und
  // „Heute" bittet 14 Tage ab ihm, der Praxis zu sagen, was sie nimmt – auch
  // nachdem „Gilt ab" auf den wahren Beginn gerückt ist. Vorher war die Bitte
  // mit dem Vorrücken sofort weg.
  await page.click('#reiter-heute');
  const heuteA = await ansichtText(page);
  check(neu.berichtigtAm === TAG && nachher.berichtigtAm === TAG && await gibt('#ansicht [data-regel="X3b"]')
    && heuteA.includes('Sie haben berichtigt, welche Menge Sie im Moment nehmen') && heuteA.includes('in den nächsten Tagen in der Praxis an'),
  `X3b nach G11: der Tag der Berichtigung bleibt (${neu.berichtigtAm} / ${nachher.berichtigtAm}), „Heute" nennt X3b nach dem Vorrücken`);
}

// ---------------------------------------------------------------- G11 (b): alte Berichtigung ohne Vermerk

// Eine Berichtigung aus einer früheren Fassung kennt den berichtigten
// Eintrag nicht. Rückt ihr „Gilt ab" vor die 100 µg, fragt das Formular
// jetzt nach – vorher gespeichert, und die 100 µg galten wieder.
{
  const alt = { id: 'dB', ab: TAG, praeparat: 'L-Thyroxin', mikrogramm: 75, tabletten: 1, notiz: '', praxis: false, berichtigung: true };
  await laden(r6g11({ dosen: [alt] }));
  await page.click('#reiter-verlauf');
  await page.click('#ansicht [data-seite="dosis-liste"]');
  await page.click('#ansicht [data-seite="dosis"][data-param="dB"]');
  await page.fill('form[data-formular="dosis"] input[name=ab]', R6_LANGE);
  await page.click('form[data-formular="dosis"] button[type=submit]');
  await page.waitForTimeout(300);
  const frage = await r6Dialog();
  check(frage.includes(`Ab ${kurz(R6_ANGEORDNET)} ist noch 100 µg am Tag eingetragen (auf Anweisung der Praxis)`) && frage.includes('Haben Sie das nie genommen?')
    && await gibt('dialog.rueckfrage [data-act="befund-bestaetigen"]') && (await r4a.text('dialog.rueckfrage [data-act="befund-bestaetigen"]')) === 'Ja, nie genommen',
  `G11: alte Berichtigung vor die 100 µg gerückt – die Frage „nie genommen?" mit „Ja, nie genommen" („${frage.slice(0, 110)}")`);
  // „Nein" speichert nichts und führt zu „Gilt ab".
  await r4app.klick('dialog.rueckfrage [data-act="befund-korrigieren"]');
  await page.waitForTimeout(200);
  const nein = await gespeichert();
  check(!(await gibt('dialog.rueckfrage')) && nein.dosen.find((d) => d.id === 'dB').ab === TAG && await fokusName() === 'ab',
    `G11: „Nein" speichert nichts und führt zu „Gilt ab" (Fokus ${await fokusName()})`);
  // Vor der Korrektur ist das Formular schon gespeichert und weg – dann scheitern, nicht hängen.
  await r4app.klick('form[data-formular="dosis"] button[type=submit]');
  await r4app.klick('dialog.rueckfrage [data-act="befund-bestaetigen"]');
  const ja = (await gespeichert()).dosen.find((d) => d.id === 'dB');
  const berichtB = await r6Bericht();
  check(ja && ja.ab === R6_LANGE && ja.statt === 'dC' && berichtB.includes(`Aktuell: L-Thyroxin 75 µg, 1 Tablette am Tag, seit ${kurz(R6_LANGE)}`) && !berichtB.includes('Aktuell: L-Thyroxin 100 µg'),
    `G11: „Ja, nie genommen" speichert mit Vermerk – der Bericht nennt 75 µg (${JSON.stringify(ja)})`);
  // Runde 6 – Rest (X3b nach G11): „Ja, nie genommen" ist neu für die Praxis – ab heute die Bitte X3b.
  await page.click('#reiter-heute');
  check(ja && ja.berichtigtAm === TAG && await gibt('#ansicht [data-regel="X3b"]'),
    `X3b nach G11: alte Berichtigung mit „Ja, nie genommen" – Tag der Berichtigung heute, „Heute" nennt X3b (${ja && ja.berichtigtAm})`);
}

// ---------------------------------------------------------------- Runde 6 – Rest (W-D4-Art): die Antwort merkt sich die Art der Frage

// „Ja" auf die Frage 14 Tage nach der Erhöhung auf „Heute". Danach trägt sie
// davor noch eine Menge nach (selbst 125 µg) – aus der Erhöhung auf 100 µg
// wurde vorher rechnerisch eine Senkung: „müder seit der Senkung", Termin
// statt „Heute anrufen".
{
  const erhoeht = plus(TAG, -14);
  await laden(stand({
    dosen: [
      { id: 'd1', ab: plus(TAG, -400), praeparat: 'L-Thyroxin', mikrogramm: 75, tabletten: 1, notiz: '' },
      { id: 'd2', ab: erhoeht, praeparat: 'L-Thyroxin', mikrogramm: 100, tabletten: 1, notiz: '', praxis: true },
    ],
    labor: [befund('b1', plus(TAG, -30), { tsh: w(6.8, 'mU/l', 0.4, 4) }, { praxis: 'geaendert', praxisAm: erhoeht })],
    nachfragen: [{ id: 'n1', art: 'dosis_stimmt', bezug: 'b1', antwort: 'ja', am: plus(TAG, -29) }],
  }));
  await page.click('#reiter-heute');
  const frage = page.locator('#ansicht [data-regel="W-D4"]');
  if (await frage.count()) await frage.locator('[data-act="frage-antwort"][data-wert="ja"]').click();
  const st = await gespeichert();
  const antwort = st.nachfragen.find((n) => n.art === 'wd4');
  check(!!antwort && antwort.antwort === 'ja' && antwort.aenderung === 'erhoehung', `W-D4-Art: die Antwort speichert, dass nach einer Erhöhung gefragt wurde (${JSON.stringify(antwort)})`);
  // Danach davor nachgetragen: selbst 125 µg – die Antwort bleibt „seit der Erhöhung".
  await laden({ ...st, dosen: [...st.dosen, { id: 'dX', ab: plus(TAG, -20), praeparat: 'L-Thyroxin', mikrogramm: 125, tabletten: 1, notiz: '', praxis: false }].sort((a, b) => a.ab.localeCompare(b.ab)) });
  await page.click('#reiter-heute');
  const wd4 = await gibt('#ansicht [data-regel="W-D4"]') ? await r4a.text('#ansicht [data-regel="W-D4"]') : '';
  check(wd4.includes('Heute anrufen') && wd4.includes('Warnzeichen-Check') && await gibt('#ansicht [data-regel="W-D4"] [data-seite="warnzeichen"]'),
    `W-D4-Art: nach einem Nachtrag davor bleibt „Heute anrufen" mit dem Warnzeichen-Check („${wd4.slice(0, 100)}")`);
}

// ---------------------------------------------------------------- G11 (c): gleich mit dem wahren Beginn angelegt

// Nach „Nein" gleich 75 µg ab dem wahren Beginn eingetragen: Vorher wies das
// Formular das ab („Genau diese Dosis ist schon … eingetragen") und bot nur
// den Eintrag von damals zum Ändern an, an dem nichts falsch war.
{
  await laden(r6g11({ nachfragen: [{ id: 'n1', art: 'dosis_stimmt', bezug: 'bB', antwort: 'nein_100', am: TAG }] }));
  await page.click('#reiter-verlauf');
  await page.click('#ansicht [data-seite="dosis"]');
  await page.fill('form[data-formular="dosis"] input[name=mikrogramm]', '75');
  await page.fill('form[data-formular="dosis"] input[name=ab]', R6_LANGE);
  await page.check('form[data-formular="dosis"] input[name=praxis][value=nein]', { force: true });
  await page.click('form[data-formular="dosis"] button[type=submit]');
  await page.waitForTimeout(300);
  const frage = await r6Dialog();
  await r4app.klick('dialog.rueckfrage [data-act="befund-bestaetigen"]');
  const c = r6Berichtigung(await gespeichert());
  check(frage.includes('Haben Sie das nie genommen?') && c.ab === R6_LANGE && c.statt === 'dC' && c.mikrogramm === 75,
    `G11: Berichtigung gleich ab dem wahren Beginn – Frage „nie genommen?", dann mit Vermerk gespeichert (${JSON.stringify(c)})`);
}

// ---------------------------------------------------------------- G6: Angaben über sie auf der Dosis-Karte ändern

// Krebs „Ja" (Fehltipp) und Kortison „Weiß nicht": Die Karte sperrt mit D0.13
// und D0.14. Vorher standen beide Antworten nicht unter „Ihre Antworten", der
// einzige Weg zurück war „Mehr → Über mich & weitere Mittel".
{
  await laden(stand({
    profil: { krebs: 'ja', kortison: 'unbekannt' },
    labor: [befund('b1', plus(TAG, -5), { tsh: w(8.5, 'mU/l', 0.27, 4.2), ft4: w(13, 'pmol/l', 12, 22) })],
    nachfragen: dosisStimmt(plus(TAG, -4)),
  }));
  await mehrSeite('dosis-karte');
  const krebs = '#ansicht details.antworten-block [data-antwort="profil-krebs"]';
  const kortison = '#ansicht details.antworten-block [data-antwort="profil-kortison"]';
  check(await gibt('#dosis-karte li[data-grund="D0.13"]') && await gibt('#ansicht details.antworten-block[open]')
    && (await r4a.text(krebs)).includes('Schilddrüsenkrebs') && (await r4a.text(krebs)).includes('Ja')
    && (await r4a.text(kortison)).includes('Weiß nicht') && (await r4a.text(kortison)).includes('sobald Sie es wissen'),
  `G6: „Ihre Antworten" – aufgeklappt, mit Krebs „Ja" und Kortison „Weiß nicht" samt Bitte, es zu ergänzen („${await r4a.text(kortison)}")`);
  check((await r4a.text('#ansicht details.antworten-block')).includes('gilt für alle Befunde') && (await r4a.text('#ansicht details.antworten-block')).includes('Mehr → Über mich'),
    'G6: … mit dem Hinweis, dass diese Angaben für alle Befunde gelten und unter „Mehr → Über mich" stehen');
  if (await gibt(krebs)) {
    await page.click(`${krebs} summary`);
    await page.click(`${krebs} [data-act="frage-antwort"][data-ziel="profil"][data-wert="nein"]`);
  }
  const g6 = await gespeichert();
  check(g6.profil.krebs === 'nein' && !(await gibt('#dosis-karte li[data-grund="D0.13"]')),
    `G6: „ändern" → „Nein" speichert ins Profil, D0.13 ist weg (krebs = ${g6.profil.krebs})`);
  // Das Geburtsjahr (Muster c) mit seinem kleinen Formular.
  const jahr = '#ansicht details.antworten-block [data-antwort="profil-geburtsjahr"]';
  if (await gibt(jahr)) {
    await page.click(`${jahr} summary`);
    await page.fill(`${jahr} input[name=geburtsjahr]`, '1938');
    await page.click(`${jahr} button[type=submit]`);
  }
  check(Number((await gespeichert()).profil.geburtsjahr) === 1938 && await gibt('#dosis-karte'),
    'G6: … ebenso das Geburtsjahr, danach steht wieder die Karte da');
}

// ---------------------------------------------------------------- G18: Anruf-Knöpfe bei weiteren Werten

// Natrium 118 heißt jetzt „heute noch anrufen" mit 116 117 und 112 im Text –
// unter dem Befund standen die Nummern nicht als Knopf.
{
  await laden(stand({ labor: [befund('b1', plus(TAG, -1), { tsh: w(2, 'mU/l', 0.27, 4.2), ft4: w(15, 'pmol/l', 12, 22), natrium: w(118, 'mmol/l', 135, 145) })] }));
  await page.click('#reiter-verlauf');
  const ww = page.locator('#ansicht .weitere-werte').first();
  const tel = await ww.locator('a[href^="tel:"]').evaluateAll((a) => a.map((x) => x.getAttribute('href')));
  check(tel.includes('tel:116117') && tel.includes('tel:112'), `G18: unter „Natrium 118" stehen 116 117 und 112 als Anruf-Knopf (${JSON.stringify(tel)})`);
}

// ---------------------------------------------------------------- G20: Kontroll-Erinnerung nur, wo es sie gibt

// „dann erinnert die App an die Kontrolle nach 6–8 Wochen" stand über allen
// Mitteln – L7b erinnert aber nur bei einigen (ez.L7B_MITTEL).
{
  await laden(stand());
  await mehrSeite('profil');
  const satz = await r4a.text('#ansicht [data-hinweis="kontrolle"]');
  const l7b = await page.evaluate(async () => {
    const ez = await import('./js/einschaetzung.js');
    return (ez.L7B_MITTEL || []).map((k) => ez.mittelName(k).split(/[ ,(]/)[0]);
  });
  check(l7b.length > 0 && l7b.every((n) => satz.includes(n)) && satz.includes('Bei anderen Mitteln fragen Sie die Praxis') && !satz.includes('Colestyramin'),
    `G20: „Über mich" nennt genau die Mittel, bei denen die App an die Kontrolle erinnert (${l7b.join(', ')}; „${satz.slice(0, 80)}…")`);
}

// ---------------------------------------------------------------- G21: Kaffee – die Frage folgt dem Plan

// Ein „Nein" auf die frühere Frage nach 60 Minuten: Die Karte sagte D0.8
// „Halten Sie zuerst jeden Tag die Abstände ein" – wer dem Plan folgte (ab 30
// Minuten), musste „Nein" antworten. Jetzt fragt sie Q3, und „Über mich"
// bittet, die Antwort zu prüfen.
{
  await laden(stand({
    mittel: ['kaffee'], mittelAbstand: { kaffee: 'nein' },
    labor: [befund('b1', plus(TAG, -5), { tsh: w(7.5, 'mU/l', 0.4, 4), ft4: w(14, 'pmol/l', 12, 22) })],
    nachfragen: dosisStimmt(plus(TAG, -4)),
  }));
  await mehrSeite('dosis-karte');
  check(!(await gibt('#dosis-karte li[data-grund="D0.8"]')) && await attr('#dosis-karte .dosis-frage', 'data-frage') === 'Q3',
    `G21: ein „Nein" auf die alte 60-Minuten-Frage sperrt die Karte nicht mit D0.8 – sie fragt Q3 (${await attr('#dosis-karte .dosis-frage', 'data-frage')})`);
  await mehrSeite('profil');
  const kaffee = await r4a.text('#ansicht .mittel-zeile[data-mittel="kaffee"]');
  check(kaffee.includes('mindestens 30 Minuten Abstand') && kaffee.includes('Die Frage hat sich geändert') && kaffee.includes('Stimmt Ihre Antwort noch?'),
    `G21: „Über mich" fragt nach 30 Minuten und bittet, die alte Antwort zu prüfen („${kaffee.slice(0, 100)}…")`);
  // Runde 7: H5 – geändert: Nicht mehr jedes Speichern gilt als Antwort auf
  // die neue Frage, sondern erst die bestätigte (Haken) oder geänderte Antwort.
  if (await gibt('input[name=kaffeeNeu]')) await page.check('input[name=kaffeeNeu]', { force: true });
  await page.click('form[data-formular="profil"] button[type=submit]');
  const g21 = await gespeichert();
  await mehrSeite('profil');
  check(g21.profil.kaffeePruefen === false && g21.mittelAbstand.kaffee === 'nein' && !(await r4a.text('#ansicht .mittel-zeile[data-mittel="kaffee"]')).includes('Die Frage hat sich geändert'),
    'G21: … die bestätigte Antwort gilt für die neue Frage, der Hinweis ist weg, die Antwort bleibt');
}

// ---------------------------------------------------------------- Runde 6 (Ansichten) bei „sehr groß", hell und dunkel

for (const farbe of ['hell', 'dunkel']) {
  const einst = r4Einstellungen('sehr-gross', farbe);
  const seiten = [];
  const breite = async (name) => seiten.push([name, await page.evaluate(() => document.documentElement.scrollWidth)]);
  await laden({
    ...stand({
      profil: { krebs: 'ja', kortison: 'unbekannt' },
      labor: [befund('b1', plus(TAG, -5), { tsh: w(8.5, 'mU/l', 0.27, 4.2), ft4: w(13, 'pmol/l', 12, 22), natrium: w(118, 'mmol/l', 135, 145) })],
      nachfragen: dosisStimmt(plus(TAG, -4)), mittel: ['kaffee'], mittelAbstand: { kaffee: 'nein' },
    }),
    einstellungen: einst,
  });
  await mehrSeite('dosis-karte');
  for (const z of ['profil-kortison', 'profil-geburtsjahr']) {
    if (await gibt(`#ansicht [data-antwort="${z}"] summary`)) await page.click(`#ansicht [data-antwort="${z}"] summary`);
  }
  await breite('Dosis-Karte mit Angaben über sie');
  await page.click('#reiter-verlauf');
  await breite('Befund mit Natrium und Anruf-Knöpfen');
  await mehrSeite('profil');
  await breite('Über mich mit Kaffee-Hinweis');
  await laden({ ...r6g11({ dosen: [{ id: 'dB', ab: TAG, praeparat: 'L-Thyroxin', mikrogramm: 75, tabletten: 1, notiz: '', praxis: false, berichtigung: true }] }), einstellungen: einst });
  await page.click('#reiter-verlauf');
  await page.click('#ansicht [data-seite="dosis-liste"]');
  await page.click('#ansicht [data-seite="dosis"][data-param="dB"]');
  await page.fill('form[data-formular="dosis"] input[name=ab]', R6_LANGE);
  await page.click('form[data-formular="dosis"] button[type=submit]');
  await page.waitForTimeout(300);
  const knoepfe = await page.evaluate(() => [...document.querySelectorAll('dialog.rueckfrage button')].map((b) => { const r = b.getBoundingClientRect(); return r.right <= window.innerWidth && r.left >= 0; }));
  await breite('Rückfrage „nie genommen?"');
  if (await gibt('dialog.rueckfrage')) await page.keyboard.press('Escape');
  const zuBreit = seiten.filter(([, b]) => b > 360);
  check(!zuBreit.length && knoepfe.length === 2 && knoepfe.every(Boolean),
    `Runde 6 (Ansichten): bei „sehr groß" und ${farbe} ohne waagerechtes Scrollen, die Knöpfe der Rückfrage ganz sichtbar (${seiten.map(([n, b]) => `${n} ${b}`).join(', ')})`);
}

// ================================================================ Nachprüfung Runde 6
// E1-Nachfrage auch nach einer eigenen Änderung: Erst eine neue Menge „auf
// Anweisung der Praxis" erfüllt „Bitte tragen Sie die neue Dosis ein" – ein
// Fehltipp mit „Abbrechen" senkt die Dringlichkeit nicht ohne Rückfrage.
{
  await laden(stand({
    dosen: [{ id: 'd1', ab: plus(TAG, -400), praeparat: 'L-Thyroxin', mikrogramm: 75, tabletten: 1, notiz: '' },
      { id: 'd2', ab: plus(TAG, -20), praeparat: 'L-Thyroxin', mikrogramm: 88, tabletten: 1, notiz: '', praxis: false }],
    labor: [befund('b1', plus(TAG, -24), { tsh: w(8, 'mU/l', 0.27, 4.2) }, { praxis: 'nochnicht', praxisAm: plus(TAG, -22) })],
  }));
  await mehrSeite('dosis-karte');
  await page.click('#dosis-karte [data-seite="praxis-entschieden"]');
  await page.click('[data-act="praxis-entscheid"][data-wert="geaendert"]');
  await page.click('form[data-formular="dosis"] [data-act="zurueck"]');
  await page.waitForTimeout(300);
  const frage = await page.locator('dialog').innerText().catch(() => '');
  check(/Hat die Praxis Ihre Dosis schon geändert/.test(frage),
    `Nachprüfung R6: nach eigener Änderung fragt „Abbrechen" weiter, ob die Praxis schon geändert hat (${frage.replace(/\s+/g, ' ').slice(0, 80)})`);
  if (await page.locator('dialog [data-wert="nein"]').count()) await page.click('dialog [data-wert="nein"]');
  await page.waitForTimeout(300);
  const s = await gespeichert();
  check(s.labor[0].praxis === 'nochnicht', `Nachprüfung R6: „Nein" stellt „noch nichts entschieden" wieder her (${s.labor[0].praxis})`);
}

// Dieselbe Haken-Gruppe in zwei Fenstern: Fenster 1 hakt Kalzium an
// (ungespeichert), Fenster 2 hakt Eisen an und speichert. Nach dem
// Speichern in Fenster 1 gelten beide – keine Angabe fällt still weg.
{
  await laden(stand({ profil: { herz: 'nein', geburtsjahr: 1948, mittelErfasst: true }, mittel: [] }));
  const p2 = await ctx.newPage();
  p2.on('dialog', (d) => d.accept());
  await p2.goto(SD_URL, { waitUntil: 'networkidle' });
  for (const p of [page, p2]) {
    await p.click('#reiter-mehr');
    await p.locator('#ansicht [data-seite="profil"]').first().click();
    await p.waitForTimeout(300);
  }
  await page.check('input[name=mittel][value=kalzium]', { force: true });
  await p2.check('input[name=mittel][value=eisen]', { force: true });
  await p2.click('form[data-formular="profil"] button[type=submit]');
  await page.waitForTimeout(700);
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await page.waitForTimeout(300);
  await page.click('form[data-formular="profil"] button[type=submit]');
  await page.waitForTimeout(500);
  const mittel = (await gespeichert()).mittel;
  check(mittel.includes('kalzium') && mittel.includes('eisen'),
    `Nachprüfung R6: Haken aus beiden Fenstern bleiben erhalten (${JSON.stringify(mittel)})`);
  await p2.close();
}

// ================================================================ Runde 7 – Historie
//
// Befunde der siebten Durchsicht zur Dosis-Historie, wie sie in den Ansichten
// ankommen: Vorrat nach „nie genommen" (H6, H14), zwei Einträge ab demselben
// Tag (H18), eine Kette aus Berichtigungen auf „Heute" (H11), die Frage nach
// der Praxis bei einer Berichtigung an erster Stelle (H12) und die
// Kaffee-Antwort beim Speichern von „Über mich" (H5). Die Wege über die
// Dosis-Karte (H1, H7) prüft tests/test-sd-berichtigung.mjs. Jeder Fall
// scheiterte vor der Korrektur.
const r7Dosis = (id, ab, mikrogramm, weiteres = {}) => ({ id, ab, praeparat: 'L-Thyroxin', mikrogramm, tabletten: 1, notiz: '', praxis: null, ...weiteres });
const r7Ber = (id, ab, mikrogramm, statt, berichtigtAm) => r7Dosis(id, ab, mikrogramm, { praxis: false, berichtigung: true, statt, berichtigtAm });
const r7Heute = async () => { await page.click('#reiter-heute'); return (await ansichtText(page)).replace(/\s+/g, ' '); };

// ---------------------------------------------------------------- H6, H14: Vorrat nach „nie genommen"

// Die Praxis ordnete 100 µg ab 01.08. an, genommen wurden sie nie: Nach „Nein"
// 75 µg, „Gilt ab" 01.08. Gezählt waren 100 Tabletten am 15.07. Vorher sagte
// „Heute" „Seit dem 01.08.2026 nehmen Sie eine andere Stärke …" und schwieg
// dazu, dass der Vorrat nur noch knapp zwei Wochen reicht.
{
  await laden(stand({
    dosen: [r7Dosis('d0', '2025-01-01', 75), r7Dosis('dP', '2026-08-01', 100, { praxis: true })],
    labor: [befund('b1', '2026-10-05', { tsh: w(5.9, 'mU/l', 0.4, 4) })],
    vorrat: { tabletten: 100, stand: '2026-07-15' },
  }), { tag: '2026-10-10' });
  await mehrSeite('dosis-karte');
  await r4app.klick('#dosis-karte [data-act="frage-antwort"][data-feld="dosis_stimmt"][data-wert^="nein"]');
  await r4app.klick('#dosis-karte [data-act="seite"][data-seite="dosis"]');
  await page.fill('form[data-formular="dosis"] input[name=mikrogramm]', '75');
  await page.check('form[data-formular="dosis"] input[name=praxis][value=nein]', { force: true });
  await page.click('form[data-formular="dosis"] button[type=submit]');
  const neu = r6Berichtigung(await gespeichert());
  if (!(await gibt('#dosis-karte'))) await mehrSeite('dosis-karte');
  await r4app.klick(`#dosis-karte [data-act="seite"][data-seite="dosis"][data-param="${neu.id}"]`);
  await page.fill('form[data-formular="dosis"] input[name=ab]', '2026-08-01');
  await page.click('form[data-formular="dosis"] button[type=submit]');
  await page.waitForTimeout(300);
  const meldung = await r4app.meldung();
  const heute = await r7Heute();
  check(meldung.includes('Die 100 µg am Tag ab 01.08.2026 zählen jetzt als nie genommen') && !heute.includes('andere Stärke') && heute.includes('Vorrat reicht noch etwa 13 Tage'),
    `H14: nach „nie genommen" keine „andere Stärke" auf „Heute", dafür die Reichweite („${meldung}" / ${heute.includes('andere Stärke') ? 'andere Stärke' : (heute.match(/Vorrat reicht[^.]*/) || ['keine Reichweite'])[0]})`);
  await page.click('#reiter-mehr');
  check(!(await ansichtText(page)).includes('Andere Stärke – bitte neu zählen'), 'H14: … und „Mehr" sagt nicht „Andere Stärke – bitte neu zählen"');
}
// H6: am selben Tag ersetzt (Berichtigung ohne Vermerk), Vorrat davor gezählt.
{
  await laden(stand({
    dosen: [r7Dosis('d1', '2024-05-14', 75), r7Dosis('dC', '2026-06-04', 100, { praxis: true }), r7Dosis('dB', '2026-06-04', 75, { praxis: false, berichtigung: true })],
    labor: [befund('b1', '2026-08-10', { tsh: w(6.5, 'mU/l', 0.4, 4) })],
    vorrat: { tabletten: 130, stand: '2026-05-25' },
  }), { tag: '2026-09-28' });
  const heute = await r7Heute();
  check(!heute.includes('andere Stärke') && heute.includes('Vorrat reicht noch etwa 4 Tage'),
    `H6: am selben Tag ersetzt – keine „andere Stärke", „Vorrat reicht noch etwa 4 Tage" (${(heute.match(/Vorrat reicht[^.]*|andere Stärke/) || ['nichts'])[0]})`);
}

// ---------------------------------------------------------------- H18: zwei Einträge ab demselben Tag

// 75 µg seit langem, 100 µg ab vor einer Woche (Praxis). Wer am selben Tag
// 88 µg „neu" einträgt statt zu ändern, bekam keine Rückfrage – der Bericht
// nannte die 100 µg als „Davor", obwohl sie keinen Tag galten.
{
  const ab = plus(TAG, -7);
  const h18 = () => stand({ dosen: [r7Dosis('d0', plus(TAG, -400), 75), r7Dosis('dA', ab, 100, { praxis: true })] });
  const eintragen = async () => {
    await page.click('#reiter-verlauf');
    await page.click('#ansicht [data-seite="dosis-liste"]');
    await page.click('#ansicht [data-act="seite"][data-seite="dosis"]:not([data-param])');
    await page.fill('form[data-formular="dosis"] input[name=mikrogramm]', '88');
    await page.fill('form[data-formular="dosis"] input[name=ab]', ab);
    await page.check('form[data-formular="dosis"] input[name=praxis][value=ja]', { force: true });
    await page.click('form[data-formular="dosis"] button[type=submit]');
    await page.waitForTimeout(300);
  };
  await laden(h18());
  await eintragen();
  const frage = await r6Dialog();
  check(frage.includes(`Ab ${kurz(ab)} ist schon 100 µg am Tag eingetragen (auf Anweisung der Praxis)`) && frage.includes('Soll Ihre Angabe diesen Eintrag ersetzen?')
    && frage.includes('Ja, ersetzen'), `H18: ein zweiter Eintrag ab demselben Tag – die Rückfrage „ersetzen?" („${frage.slice(0, 120)}")`);
  await r4app.klick('dialog.rueckfrage [data-act="befund-korrigieren"]');
  await page.waitForTimeout(200);
  check((await gespeichert()).dosen.length === 2 && await fokusName() === 'ab', `H18: „Nein" speichert nichts und führt zu „Gilt ab" (Fokus ${await fokusName()})`);
  await r4app.klick('form[data-formular="dosis"] button[type=submit]');
  await r4app.klick('dialog.rueckfrage [data-act="befund-bestaetigen"]');
  const s = await gespeichert();
  const dA = s.dosen.find((d) => d.id === 'dA') || {};
  check(s.dosen.length === 2 && dA.mikrogramm === 88 && dA.ab === ab, `H18: „Ja, ersetzen" ändert den vorhandenen Eintrag – kein zweiter ab demselben Tag (${JSON.stringify(s.dosen.map((d) => [d.id, d.mikrogramm, d.ab]))})`);
  const bericht = await r6Bericht();
  check(bericht.includes(`Aktuell: L-Thyroxin 88 µg, 1 Tablette am Tag, seit ${kurz(ab)}`) && !bericht.includes('Davor: L-Thyroxin 100 µg'),
    'H18: im Bericht 88 µg seit dem Tag, kein „Davor: 100 µg" ohne Dauer');
  // Ein älterer Stand hat schon drei Einträge ab demselben Tag: Es zählt der letzte.
  await laden(stand({ dosen: [r7Dosis('d0', plus(TAG, -400), 75), r7Dosis('a', ab, 100, { praxis: true }), r7Dosis('b', ab, 88, { praxis: true }), r7Dosis('c', ab, 100, { praxis: true })] }));
  const alt = await r6Bericht();
  check(alt.includes(`Aktuell: L-Thyroxin 100 µg, 1 Tablette am Tag, seit ${kurz(ab)}`) && !alt.includes(`Davor: L-Thyroxin 88 µg`) && !alt.includes(`Davor: L-Thyroxin 100 µg`),
    `H18: drei Einträge ab demselben Tag – keine „Davor"-Zeiträume ohne Dauer (${alt.split('\n').filter((z) => /^Aktuell|^Davor/.test(z)).join(' | ')})`);
}

// ---------------------------------------------------------------- H11: Kette aus zwei Berichtigungen auf „Heute"

// 100 µg seit dem Einrichten, berichtigt auf 88 µg ab 01.07., dann auf 75 µg
// ab 01.06. Vorher fragte „Heute" nach Herzklopfen „seit Ihre Dosis erhöht
// wurde" – zu 100 µg, die nie genommen wurden –, und der Bericht nannte sie nicht.
{
  await laden(stand({
    profil: { seit: '2026-08-01' },
    dosen: [r7Dosis('d1', '2026-08-01', 100), r7Ber('B1', '2026-07-01', 88, 'd1', '2026-08-15'), r7Ber('B2', '2026-06-01', 75, 'B1', '2026-08-15')],
    labor: [befund('b1', '2026-08-10', { tsh: w(6.5, 'mU/l', 0.4, 4) })],
  }), { tag: '2026-08-15' });
  const heute = await r7Heute();
  check(!(await gibt('#ansicht [data-regel="W-D4"]')) && heute.includes('L-Thyroxin 75 µg'), `H11: „Heute" nennt 75 µg und fragt nicht nach einer Erhöhung, die es nie gab (${heute.slice(0, 80)})`);
  const bericht = await r6Bericht();
  check(bericht.includes('Berichtigung (Angabe): Ab 01.08.2026 war L-Thyroxin 100 µg, 1 Tablette am Tag eingetragen – nach Angabe der Patientin nie genommen; stattdessen L-Thyroxin 75 µg')
    && bericht.includes('Berichtigung (Angabe): Ab 01.07.2026 war L-Thyroxin 88 µg'), 'H11: der Bericht nennt auch die 100 µg vom Einrichten als nie genommen');
}

// ---------------------------------------------------------------- H12: Berichtigung an erster Stelle – die Frage nach der Praxis bleibt

// Die Berichtigung ist, wie die Karte rät, vor den einzigen Eintrag gerückt.
// Beim Ändern der Notiz fehlte die Frage „Auf Anweisung der Praxis?", und
// „Nein" wurde still zu „nicht angegeben".
{
  await laden(stand({
    profil: { seit: '2026-01-10' },
    dosen: [r7Dosis('d1', '2026-01-10', 100), r7Ber('B', '2025-06-01', 125, 'd1', TAG)],
    labor: [befund('b1', plus(TAG, -6), { tsh: w(3.5, 'mU/l', 0.4, 4) })],
  }));
  await page.click('#reiter-verlauf');
  await page.click('#ansicht [data-seite="dosis-liste"]');
  await page.click('#ansicht [data-seite="dosis"][data-param="B"]');
  const gewaehlt = await page.locator('form[data-formular="dosis"] input[name=praxis][value=nein]').isChecked().catch(() => false);
  await page.fill('form[data-formular="dosis"] [name=notiz]', 'seit dem Umzug');
  await page.click('form[data-formular="dosis"] button[type=submit]');
  const B = (await gespeichert()).dosen.find((d) => d.id === 'B') || {};
  check(gewaehlt && B.notiz === 'seit dem Umzug' && B.praxis === false, `H12: an erster Stelle fragt „Dosis ändern" nach der Praxis, „Nein" bleibt (${JSON.stringify({ gewaehlt, praxis: B.praxis })})`);
}

// ---------------------------------------------------------------- H5: nur das Bundesland gespeichert

// Ein „Nein" auf die frühere Kaffee-Frage (60 Minuten). Über „Bundesland
// eintragen" nur das Bundesland gespeichert – den Kaffee-Hinweis weit unten
// sah niemand. Vorher galt das „Nein" danach als Antwort auf die neue Frage:
// Die Karte sperrte mit D0.8, der Bericht ließ „frühere Frage" weg.
{
  await laden(stand({
    profil: { bundesland: '' }, mittel: ['kaffee'], mittelAbstand: { kaffee: 'nein' },
    labor: [befund('b1', plus(TAG, -5), { tsh: w(7.5, 'mU/l', 0.4, 4), ft4: w(14, 'pmol/l', 12, 22) })],
    nachfragen: dosisStimmt(plus(TAG, -4)),
  }));
  await page.click('#reiter-heute');
  await page.locator('[data-act="seite"][data-seite="profil"][data-param="bundesland"]').first().click();
  await page.selectOption('select[name=bundesland]', 'BY');
  await page.click('form[data-formular="profil"] button[type=submit]');
  const s = await gespeichert();
  check(s.profil.bundesland === 'BY' && s.profil.kaffeePruefen === true && s.mittelAbstand.kaffee === 'nein',
    `H5: nur das Bundesland gespeichert – das alte „Nein" bleibt die Antwort auf die alte Frage (${JSON.stringify({ bl: s.profil.bundesland, pruefen: s.profil.kaffeePruefen })})`);
  await mehrSeite('dosis-karte');
  check(!(await gibt('#dosis-karte li[data-grund="D0.8"]')) && await attr('#dosis-karte .dosis-frage', 'data-frage') === 'Q3',
    `H5: … die Karte fragt weiter Q3 statt D0.8 (${await attr('#dosis-karte .dosis-frage', 'data-frage')})`);
  const bericht = await r6Bericht();
  check(bericht.includes('Antwort auf die frühere Frage nach mindestens 60 Minuten'), 'H5: … und der Bericht sagt weiter, worauf sich das „Nein" bezog');
  // Mit dem Haken „Meine Antwort gilt für die neue Frage" ist sie neu beantwortet.
  await mehrSeite('profil');
  if (await gibt('input[name=kaffeeNeu]')) await page.check('input[name=kaffeeNeu]', { force: true });
  await page.click('form[data-formular="profil"] button[type=submit]');
  check((await gespeichert()).profil.kaffeePruefen === false, 'H5: mit dem Haken gilt das „Nein" für die neue Frage');
}

// ================================================================ Runde 7 – weitere Werte

// ---------------------------------------------------------------- H4, H15, H21: „Heute anrufen" lässt sich beenden

// Natrium 118 von vorgestern: „Heute anrufen – falls sich die Praxis nicht
// schon gemeldet hat". Es gab keinen Weg, das zu beantworten; die Stufe blieb
// monatelang. Jetzt: „Ja, die Praxis weiß davon" beim Wert.
{
  await laden(stand({
    labor: [befund('b1', plus(TAG, -2), { tsh: w(2, 'mU/l', 0.4, 4), ft4: w(15, 'pmol/l', 12, 22), natrium: w(118, 'mmol/l', 135, 145) })],
    nachfragen: dosisStimmt(plus(TAG, -1)),
  }));
  await page.click('#reiter-heute');
  const vorher = await attr('#ansicht .einschaetzung-verweis', 'data-stufe');
  await page.click('#ansicht .einschaetzung-verweis [data-seite="gesamtbild"]');
  const knopf = page.locator('#ansicht .teil-karte[data-regel="E13-natrium"] [data-act="frage-antwort"][data-feld="wert_bekannt"]');
  const da = await knopf.count();
  if (da) await knopf.click();
  const q = (await gespeichert()).nachfragen.find((n) => n.art === 'wert_bekannt') || {};
  check(vorher === 'heute' && da === 1 && q.bezug === 'b1' && q.antwort === 'natrium' && q.am === TAG,
    `H4: „Ja, die Praxis weiß davon" beim Natrium speichert die Angabe mit Datum (${JSON.stringify({ vorher, da, q })})`);
  const oben = await attr('#ansicht .stufe-karte', 'data-stufe');
  check(oben === 'termin' && !(await gibt('#ansicht [data-feld="wert_bekannt"]')),
    `H4: … danach „Beim nächsten Termin", und die Frage ist beantwortet (${oben})`);
  await page.click('#reiter-heute');
  check(await attr('#ansicht .einschaetzung-verweis', 'data-stufe') === 'termin', 'H4: … auf „Heute" dieselbe Stufe');
}
// Sieben Monate nach dem Befund, die Praxis hatte „Dosis bleibt so" gesagt:
// kein tägliches „Heute anrufen" mehr, der Wert steht mit Datum da.
{
  await laden(stand({
    labor: [befund('b1', plus(TAG, -200), { tsh: w(2, 'mU/l', 0.4, 4), ft4: w(15, 'pmol/l', 12, 22), natrium: w(118, 'mmol/l', 135, 145) }, { praxis: 'bleibt', praxisAm: plus(TAG, -199) })],
  }));
  await page.click('#reiter-heute');
  const stufe = await attr('#ansicht .einschaetzung-verweis', 'data-stufe');
  await page.click('#ansicht .einschaetzung-verweis [data-seite="gesamtbild"]');
  const teil = await page.locator('#ansicht .teil-karte[data-regel="E13-natrium"]').innerText().catch(() => '');
  check(stufe === 'zeitnah' && teil.includes(`vom ${kurz(plus(TAG, -200))}`) && !teil.includes('heute noch'),
    `H15/H21: sieben Monate später „In ein bis zwei Wochen" mit Datum statt „Heute anrufen" (${stufe}; „${teil.slice(0, 140)}…")`);
}

// ---------------------------------------------------------------- H19: CRP 15 und „bis 0,5" mit dem vorbelegten mg/l

{
  await laden(stand());
  await page.click('#reiter-verlauf');
  await page.click('#ansicht [data-seite="labor"]');
  await page.fill('input[name=datum]', plus(TAG, -1));
  await page.fill('input[name=tsh_wert]', '2');
  await page.fill('input[name=tsh_von]', '0,4');
  await page.fill('input[name=tsh_bis]', '4,0');
  await page.click('details.weitere > summary');
  const einheit = await page.inputValue('select[name=crp_einheit]');
  await page.fill('input[name=crp_wert]', '15');
  await page.fill('input[name=crp_bis]', '0,5');
  await page.click('form[data-formular="labor"] button[type=submit]');
  const frage = (await gibt('dialog.rueckfrage')) ? await page.locator('dialog.rueckfrage').innerText() : '';
  check(einheit === 'mg/l' && frage.includes('mg/dl'), `H19: CRP 15 mit „bis 0,5" und dem vorbelegten mg/l – Rückfrage „vielleicht mg/dl" („${frage.replace(/\s+/g, ' ').slice(0, 160)}")`);
  if (await gibt('dialog.rueckfrage')) {
    await page.waitForTimeout(700);   // die Knöpfe sind die ersten 0,6 Sekunden gesperrt
    await page.click('dialog.rueckfrage [data-act="befund-bestaetigen"]');
  }
  const b = (await gespeichert()).labor.find((l) => l.crp) || {};
  // Nachprüfung zu Runde 7 (N1): der Tag steht je Wert in werteAm.
  check(b.bestaetigt === true && b.werteAm && b.werteAm.crp === TAG, `H19: … nach „Ja, stimmt" gespeichert, mit dem Tag des Eintrags (${JSON.stringify({ bestaetigt: b.bestaetigt, am: b.werteAm })})`);
  await page.click('#reiter-heute');
  check(await attr('#ansicht .einschaetzung-verweis', 'data-stufe') === 'heute', 'H19: … und „Heute" sagt „Heute anrufen" (15 mg/dl = 150 mg/l), nicht „Beim nächsten Termin"');
}

// ================================================================ Nachprüfung Runde 7
// H8, verdrahtet: Die Karte wartet nach einer eigenen Erhöhung (heute
// eingetragen) auf die Praxis. „Die Praxis hat entschieden → Die Dosis bleibt
// so" – dieselbe Antwort wie am 22.09. – ist eine neue Entscheidung: Datum
// heute und der Vermerk PRAXIS_DANACH. Vorher behielt sie ihr altes Datum
// (G5), und X3 blieb mit Frist stehen, ohne Ausweg bis zum Kontrollwert.
{
  await laden(stand({
    dosen: [{ id: 'd1', ab: plus(TAG, -400), praeparat: 'L-Thyroxin', mikrogramm: 112, tabletten: 1, notiz: '', praxis: true },
      { id: 'e1', ab: plus(TAG, -7), praeparat: 'L-Thyroxin', mikrogramm: 150, tabletten: 1, notiz: '', praxis: false, eingetragenAm: TAG }],
    labor: [befund('b1', plus(TAG, -9), { tsh: w(0.06, 'mU/l', 0.27, 4.2) }, { praxis: 'bleibt', praxisAm: plus(TAG, -5) })],
    nachfragen: [{ id: 'n1', art: 'dosis_stimmt', bezug: 'b1', antwort: 'ja', am: plus(TAG, -8) }],
  }));
  await mehrSeite('dosis-karte');
  const vorher = await attr('#dosis-karte', 'data-stufe');
  await page.click('#dosis-karte [data-seite="praxis-entschieden"]');
  await page.click('[data-act="praxis-entscheid"][data-wert="bleibt"]');
  await page.waitForTimeout(300);
  const s = await gespeichert();
  const danach = (s.nachfragen || []).filter((n) => n.art === 'praxis_danach' && n.bezug === 'b1');
  check(s.labor[0].praxisAm === TAG && danach.length === 1 && danach[0].am === TAG,
    `Nachprüfung R7 H8: gleiche Entscheidung, während die Karte wartet – Datum heute und PRAXIS_DANACH (${JSON.stringify({ am: s.labor[0].praxisAm, danach })})`);
  await mehrSeite('dosis-karte');
  const nachher = await attr('#dosis-karte', 'data-stufe');
  check(vorher === 'tage' && nachher !== 'tage', `Nachprüfung R7 H8: die Karte wartet danach nicht mehr (${vorher} → ${nachher})`);
}

// N1 (review7/nach-h18-ersetzen-ui.mjs): 137 µg ab heute vom Einrichten, dann
// am selben Tag selbst 274 µg (Praxis: Nein). „Ja, ersetzen" überschrieb die
// 137 µg – ohne Rückfrage „mehr als die Hälfte", ohne X3 und 112-Zeichen.
{
  await laden(stand({ dosen: [r7Dosis('d1', TAG, 137)] }));
  await page.click('#reiter-verlauf');
  await page.click('#ansicht [data-seite="dosis-liste"]');
  await page.click('#ansicht [data-act="seite"][data-seite="dosis"]:not([data-param])');
  await page.fill('form[data-formular="dosis"] input[name=mikrogramm]', '274');
  await page.fill('form[data-formular="dosis"] input[name=ab]', TAG);
  await page.check('form[data-formular="dosis"] input[name=praxis][value=nein]', { force: true });
  await page.click('form[data-formular="dosis"] button[type=submit]');
  await page.waitForTimeout(300);
  const frage = await r6Dialog();
  check(frage.includes('mehr als die Hälfte') && !frage.includes('ersetzen'), `Nachprüfung R7 N1: eigene Änderung am Tag des Einrichtens – Rückfrage „mehr als die Hälfte", nicht „ersetzen?" („${frage.slice(0, 120)}")`);
  await r4app.klick('dialog.rueckfrage [data-act="befund-bestaetigen"]');
  const s = await gespeichert();
  check(s.dosen.length === 2 && s.dosen[0].mikrogramm === 137 && s.dosen[1].mikrogramm === 274 && s.dosen[1].eingetragenAm === TAG,
    `Nachprüfung R7 N1: beide Einträge bleiben, mit dem Tag des Eintrags (${JSON.stringify(s.dosen.map((d) => [d.mikrogramm, d.ab, d.eingetragenAm]))})`);
  await page.click('#reiter-heute');
  const hinweis = page.locator('#ansicht [data-regel="X3"], #ansicht [data-regel="B2"]');
  const heute = (await hinweis.count()) ? await hinweis.first().innerText() : '';
  check(/bisherige Menge/.test(heute) && await hinweis.first().locator('a[href="tel:112"]').count() === 1,
    `Nachprüfung R7 N1: „Heute" rät, bis zum Anruf die bisherige Menge zu nehmen, mit 112 als Anruf („${heute.replace(/\s+/g, ' ').slice(0, 120)}")`);
}

await ende();
