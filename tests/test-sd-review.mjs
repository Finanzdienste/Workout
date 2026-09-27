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
import { oeffne, standMit, plus, kurz, ansichtText, SCHLUESSEL } from './sd-hilfe.mjs';

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
const { page, check, gespeichert, ende } = await oeffne({
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

await ende();
