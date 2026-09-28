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
const { browser, ctx, page, check, gespeichert, ende } = await oeffne({
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
check((await p3.locator('.tablette').innerText()).includes('Heute erst nach der Blutabnahme – dann hier antippen') && (await p3.evaluate(() => window.__hinweise)).length === 0,
  'D16: Abnahme ohne Uhrzeit – kein Mahnen, „Heute erst nach der Blutabnahme"');
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

await ende();
