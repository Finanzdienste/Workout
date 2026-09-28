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
check((await e14.innerText()).includes('Besprochen?') && await e14.getAttribute('aria-label') === 'Als besprochen abhaken', `E14: der Knopf sagt sichtbar, was er tut („${(await e14.innerText()).replace(/\s+/g, ' ')}")`);
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

await ende();
