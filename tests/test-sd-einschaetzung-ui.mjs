/*
 * Schilddrüse: die Oberfläche der Einschätzung und der Dosis-Karte.
 *
 * Die Regeln selbst prüfen tests/test-sd-regeln-*.mjs ohne Browser. Hier
 * geht es darum, dass die Oberfläche zeigt, was der Kern liefert, und dass
 * jede Antwort dort landet, wo der Kern sie liest:
 *
 *   - die Notfallleiste (W0) steht oben auf „Heute", mit 112 als Anruf;
 *   - ohne bestätigte Behandlung (P6) keine Einschätzung – ein Knopf schaltet sie ein;
 *   - das Profil speichert Mittel samt Abstand, Wechsel erst ab dem zweiten Mal;
 *   - der Befund speichert die Fragen zur Blutabnahme, und ein ungewöhnlicher
 *     Wert braucht ein ausdrückliches „Ja, stimmt";
 *   - der Verlauf zeigt Mustertext und Frist, die Kurve rechnet Einheiten um;
 *   - die Dosis-Karte stellt ihre Fragen einzeln, bis eine Richtung mit
 *     Pflichttext kommt – der Titel nie größer als der Pflichttext;
 *   - „Die Praxis hat entschieden" setzt die Entscheidung am Befund;
 *   - der Warnzeichen-Check speichert und zeigt Anruf-Knöpfe, W1 nur 112;
 *   - „Druck auf der Brust" in der Notiz des Befindens zeigt den 112-Text;
 *   - der Bericht enthält die Einschätzung und die Dosis-Karte;
 *   - bei 360 px kein waagerechtes Scrollen.
 */
import { oeffne, standMit, plus, ansichtText, SCHLUESSEL } from './sd-hilfe.mjs';

const TAG = '2026-09-27';
const stand = standMit(plus(TAG, -400), {
  version: 2,
  profil: { name: '', begruesst: true, seit: plus(TAG, -300) },
  // Ein früherer Befund bei gleicher Dosis – TSH in µU/ml, fT4 in ng/dl.
  labor: [{ id: 'l0', datum: plus(TAG, -100), tsh: { wert: 2, einheit: 'µU/ml', von: 0.27, bis: 4.2 }, ft4: { wert: 1.1, einheit: 'ng/dl', von: 0.93, bis: 1.7 }, ft3: null, notiz: '' }],
});
const { page, check, dialoge, uhr, gespeichert, ende } = await oeffne({ viewport: { width: 360, height: 740 }, tag: TAG, zeit: '09:00', stand });

const breitOk = async (name) => {
  const w = await page.evaluate(() => document.documentElement.scrollWidth);
  check(w <= 360, `360 px: „${name}" ohne waagerechtes Scrollen (${w} px)`);
};
const seite = async (name) => {
  await page.click('#reiter-mehr');
  await page.locator(`#ansicht [data-seite="${name}"]`).first().click();
};

// ---------------------------------------------------------------- W0 und P6

await page.click('#reiter-heute');
const leiste = page.locator('#ansicht .notfall-leiste');
check(await leiste.count() === 1, 'W0: die Notfallleiste steht auf „Heute"');
check(await page.evaluate(() => document.querySelector('#ansicht').firstElementChild.classList.contains('notfall-leiste')
  || document.querySelector('#ansicht .notfall-leiste') === document.querySelector('#ansicht > *:not(.hinweis-karte)')), '… ganz oben');
check(await leiste.locator('a.knopf-notruf[href="tel:112"]').count() === 1, '… mit 112 als großem Anruf-Knopf');
check(await leiste.locator('a[href="tel:116117"]').count() === 1 && await leiste.locator('a[href="tel:08001110111"]').count() === 1, '… und Bereitschaftsdienst und Telefonseelsorge als Anruf');
// Gewollt geändert (Durchsicht B48, RW1 P5 „Ohne Angabe: 112 anzeigen"):
// Ohne Bundesland steht beim Giftnotruf 112 als Anruf – vorher nur ein Knopf
// ins Profil. Der Weg zum Bundesland bleibt klein daneben.
check(await leiste.locator('.giftnotruf a[href="tel:112"]').count() === 1, 'ohne Bundesland: beim Giftnotruf 112 als Anruf');
check(await leiste.locator('[data-seite="profil"]').innerText() === 'Bundesland eintragen', '… und daneben „Bundesland eintragen"');
check((await leiste.innerText()).includes('Brustschmerz, starker Atemnot, Ohnmacht, Lähmung, Sprachstörung oder plötzlicher Verwirrtheit'), 'der Satz, wann 112');

check(await page.locator('#ansicht #p6').count() === 1, 'P6: ohne Bestätigung steht die Karte mit dem P6-Text auf „Heute"');
check((await page.locator('#p6').innerText()).includes('rechnet nie eine neue Dosis aus'), '… mit dem Text aus dem Kern');
await seite('gesamtbild');
check(await page.locator('#ansicht #p6').count() === 1 && !(await page.locator('#ansicht .stufe-karte').count()), 'das Gesamtbild ist ohne Bestätigung gesperrt');
await page.click('#reiter-heute');
await page.click('#p6 [data-act="behandelt"]');
let s = await gespeichert();
check(s.profil.behandelt === true, '„Ja, ich werde … behandelt" setzt profil.behandelt');
check(await page.locator('#ansicht #p6').count() === 0, '… und die Karte verschwindet');
await breitOk('Heute');

// ---------------------------------------------------------------- Profil

await seite('profil');
await breitOk('Profil');
await page.fill('input[name=geburtsjahr]', '1966');
await page.check('input[name=herz][value=nein]');
await page.check('input[name=osteoporose][value=nein]');
await page.selectOption('select[name=ursache]', 'hashimoto');
await page.selectOption('select[name=bundesland]', 'NI');
check(await page.locator('.mittel-zeile[data-mittel="kalzium"] .mittel-abstand').isHidden(), 'die Abstandsfrage erscheint erst, wenn das Mittel angekreuzt ist');
await page.check('input[name=mittel][value=kalzium]');
check(await page.locator('.mittel-zeile[data-mittel="kalzium"] .mittel-abstand').isVisible(), '… dann steht sie darunter');
check((await page.locator('.mittel-zeile[data-mittel="kalzium"]').textContent()).includes('mindestens 4 Stunden Abstand'), 'Kalzium: „mindestens 4 Stunden Abstand"');
// Runde 6: G21 – Kaffee fragt nach mindestens 30 Minuten (besser 60), wie der
// Plan „Was braucht Abstand?", Wissen und Q2; vorher 60 (RW1 P7).
check((await page.locator('.mittel-zeile[data-mittel="kaffee"]').textContent()).includes('mindestens 30 Minuten Abstand'), 'Kaffee: „mindestens 30 Minuten Abstand"');
check((await page.locator('.mittel-zeile[data-mittel="colestyramin"]').textContent()).includes('mindestens 5 Stunden Abstand'), 'Colestyramin: „mindestens 5 Stunden Abstand"');
await page.check('input[name=abstand_kalzium][value=ja]');
await page.check('input[name=mittel][value=kaffee]');
await page.check('input[name=abstand_kaffee][value=unbekannt]');
await page.fill('input[name=zielVon]', '3');
await page.fill('input[name=zielBis]', '1');
await page.click('button[type=submit]');
check((await page.locator('.feld-fehler').allInnerTexts()).some((t) => t.includes('Zielbereich')), 'ein verdrehter Zielbereich wird am Feld gemeldet');
await page.fill('input[name=zielVon]', '');
await page.fill('input[name=zielBis]', '');
await page.click('button[type=submit]');
s = await gespeichert();
check(s.profil.geburtsjahr === 1966 && s.profil.herz === 'nein' && s.profil.osteoporose === 'nein' && s.profil.ursache === 'hashimoto' && s.profil.bundesland === 'NI', 'Profil gespeichert: Geburtsjahr, Herz, Knochen, Grund, Bundesland');
check(s.profil.krebs === '' && s.profil.kortison === '', 'nicht beantwortete Fragen bleiben leer, nicht „nein"');
check(s.mittel.join() === 'kalzium,kaffee' && s.mittelAbstand.kalzium === 'ja' && s.mittelAbstand.kaffee === 'unbekannt', `Mittel samt Abstand gespeichert (${JSON.stringify(s.mittelAbstand)})`);
check(s.mittelWechsel.length === 0 && s.profil.mittelErfasst === true, 'beim ersten Speichern gilt kein Mittel als neu begonnen');
await seite('profil');
await page.uncheck('input[name=mittel][value=kaffee]');
await page.check('input[name=mittel][value=eisen]');
await page.click('button[type=submit]');
s = await gespeichert();
check(s.mittelWechsel.some((w) => w.key === 'eisen' && w.art === 'beginn' && w.am === TAG) && s.mittelWechsel.some((w) => w.key === 'kaffee' && w.art === 'ende' && w.am === TAG), 'beim zweiten Speichern: Beginn und Ende mit Datum vermerkt');
check(!('kaffee' in s.mittelAbstand), 'der Abstand eines abgesetzten Mittels fällt weg');
await page.click('#reiter-heute');
check(await page.locator('.notfall-leiste a[href="tel:055119240"]').count() === 1, 'mit Bundesland Niedersachsen: Giftnotruf 0551 19240 als Anruf');

// ---------------------------------------------------------------- Befund

await page.click('#reiter-verlauf');
await page.click('#ansicht [data-seite="labor"]');
await breitOk('Befund-Formular');
check(await page.locator('fieldset.fragen-block legend').textContent() === 'Fragen zur Blutabnahme', 'das Formular hat die Fragen zur Blutabnahme');
check(await page.locator('input[name=biotin]:checked').count() === 0, '… ohne Vorbelegung');
check(await page.locator('[data-feld="abstandOk"]').count() === 1, 'mit Kalzium im Profil: auch die Frage nach den Abständen');
check((await ansichtText(page)).includes('Bitte nur das freie T4 eintragen'), 'fT4: Feldhinweis, nur das freie T4');
await page.fill('input[name=datum]', plus(TAG, -5));
await page.fill('input[name=abnahmeUhr]', '08:10');
// Die Einheit ist vom letzten Befund vorbelegt (µU/ml, ng/dl) – hier steht es anders.
check(await page.inputValue('select[name=ft4_einheit]') === 'ng/dl', 'die Einheit vom letzten Befund ist vorbelegt');
await page.selectOption('select[name=tsh_einheit]', 'mU/l');
await page.selectOption('select[name=ft4_einheit]', 'pmol/l');
await page.fill('input[name=tsh_wert]', '7,8');
await page.fill('input[name=tsh_von]', '0,27');
await page.fill('input[name=tsh_bis]', '4,2');
await page.fill('input[name=ft4_wert]', '13');
await page.fill('input[name=ft4_von]', '12');
await page.fill('input[name=ft4_bis]', '22');
await page.check('input[name=biotin][value=nein]');
await page.check('input[name=abstandOk][value=ja]');
await page.check('input[name=vorAbnahme][value=nein]');
await page.click('button[type=submit]');
s = await gespeichert();
const befund = s.labor.find((l) => l.datum === plus(TAG, -5));
check(befund && befund.tsh.wert === 7.8 && befund.ft4.bis === 22, 'Befund gespeichert');
check(befund && befund.biotin === 'nein' && befund.abstandOk === 'ja' && befund.vorAbnahme === 'nein' && befund.abnahmeUhr === '08:10', 'die beantworteten Fragen sind am Befund');
check(befund && befund.krank === '' && befund.praxis === '' && befund.vergessen === '', 'die offenen bleiben leer – die Dosis-Karte fragt sie später');

// ---------------------------------------------------------------- Verlauf

await page.click('#reiter-verlauf');
await breitOk('Verlauf');
const neuester = page.locator(`#ansicht .befund[data-befund="${befund.id}"]`);
const nText = await neuester.innerText();
check(nText.includes('über dem Bereich') && nText.includes('Bereich Ihres Labors'), 'je Wert die Lage in Worten, mit der Quelle des Bereichs');
check(await neuester.locator('.einschaetzung-text').innerText().then((t) => t.startsWith('Muster:')), `der Mustertext steht da (${(await neuester.locator('.einschaetzung-text').innerText()).slice(0, 40)}…)`);
check((await neuester.locator('.frist').innerText()).includes('Bitte beim nächsten Termin ansprechen'), 'die Fristzeile steht da');
check(nText.includes('Bitte nehmen Sie die Tabletten bis zum Gespräch weiter genau wie verordnet'), 'der Satz gegen Selbsthandlung steht da');
check(nText.includes('Angaben zur Blutabnahme') && nText.includes('Abnahme um 8:10 Uhr'), 'die beantworteten Angaben zur Blutabnahme, kurz');
check(await neuester.locator('[data-seite="dosis-karte"]').count() === 1, 'beim jüngsten Befund der Knopf zur Dosis-Karte');
await page.click('[data-seite="labor-liste"]');
check((await ansichtText(page)).includes('umgerechnet 14,2 pmol/l'), 'fT4 in ng/dl: umgerechnet in pmol/l dazu');
const kurve = await page.locator('.verlauf-svg').first().getAttribute('aria-label');
check(/TSH: .*2 mU\/l.*7,8 mU\/l/.test(kurve), `die TSH-Kurve legt µU/ml und mU/l auf eine Achse (${kurve})`);

// ---------------------------------------------------------------- Dosis-Karte

await seite('dosis-karte');
await breitOk('Dosis-Karte');
const WAHL = { praxis: 'nochnicht', dosis_stimmt: 'ja', vergessen: 'nein', einnahmeArt: 'ja' };
const gefragt = [];
for (let i = 0; i < 25; i++) {
  const frage = page.locator('#dosis-karte .dosis-frage');
  if (!(await frage.count())) break;
  const id = await frage.getAttribute('data-frage');
  gefragt.push(id);
  check((await page.locator('#dosis-karte .dosis-frage').count()) === 1, `Frage ${id}: genau eine Frage je Anzeige`);
  const feld = await frage.locator('[data-act="frage-antwort"]').first().getAttribute('data-feld');
  await frage.locator(`[data-act="frage-antwort"][data-wert="${WAHL[feld] || 'nein'}"]`).click();
}
console.log(`     Fragen der Reihe nach: ${gefragt.join(' → ')}`);
check(gefragt[0] === 'F8' && gefragt.includes('X3') && gefragt.includes('P2') && gefragt.includes('P9'), 'zuerst die Praxis, dann die Dosis, Krebs, Kortison …');
check(!gefragt.includes('F2'), 'Biotin wurde im Befund schon beantwortet – die Karte fragt es nicht noch einmal');
check(new Set(gefragt).size === gefragt.length, 'keine Frage kommt zweimal');
const karte = page.locator('#dosis-karte');
check(await karte.getAttribute('data-richtung') === 'mehr', `am Ende eine Richtung (${await karte.getAttribute('data-richtung')})`);
check((await karte.locator('.dosis-titel').innerText()).startsWith('Das spricht für'), `Titel: „${await karte.locator('.dosis-titel').innerText()}"`);
const pflicht = karte.locator('.pflicht');
check(await pflicht.isVisible() && (await pflicht.innerText()).startsWith('Das ist eine Einschätzung aus Ihrem Laborwert, keine Anweisung.'), 'der Pflichttext steht sichtbar darunter');
check(await karte.locator('details').count() === 0, '… und ist nicht einklappbar');
const groessen = await page.evaluate(() => ['.dosis-titel', '.pflicht'].map((sel) => parseFloat(getComputedStyle(document.querySelector(`#dosis-karte ${sel}`)).fontSize)));
check(groessen[0] <= groessen[1], `der Titel ist nicht größer als der Pflichttext (${groessen[0]} ≤ ${groessen[1]} px)`);
check((await karte.innerText()).includes('Ärztinnen erhöhen dann meist'), 'die übliche Schrittgröße steht da');
check((await karte.locator('.stufe-schild').innerText()).trim().length > 3, 'die Stufe steht in Worten oben');
check((await karte.locator('.grundlage').innerText()).startsWith('Grundlage: Befund vom'), 'die Grundlage steht klein darunter');
s = await gespeichert();
const b1 = s.labor.find((l) => l.id === befund.id);
check(b1.praxis === 'nochnicht' && b1.praxisAm === TAG && b1.krank === 'nein' && b1.vergessen === 'nein' && b1.einnahmeArt === 'ja', 'die Antworten zum Befund sind am Befund gespeichert');
check(s.profil.krebs === 'nein' && s.profil.kortison === 'nein', 'die Antworten zum Profil im Profil');
check(s.nachfragen.some((n) => n.art === 'dosis_stimmt' && n.bezug === befund.id && n.antwort === 'ja' && n.am === TAG), 'die Antwort auf „Nehmen Sie genau …?" als Nachfrage mit Datum');

// Heute: nur ein Verweis auf die Karte, ohne die Richtung (Grundsatz 8).
await page.click('#reiter-heute');
const heute = await ansichtText(page);
check(await page.locator('#ansicht .dosis-verweis').count() === 1 && !heute.includes('Das spricht für'), '„Heute" verweist auf die Dosis-Karte, nennt die Richtung aber nicht ohne Pflichttext');
check(await page.locator('#ansicht .einschaetzung-verweis').count() === 1, '„Heute" zeigt die Einschätzung mit ihrer Stufe und dem Weg dorthin');

// D6b – die Praxis hat entschieden.
await seite('dosis-karte');
await page.click('[data-seite="praxis-entschieden"]');
await page.click('[data-act="praxis-entscheid"][data-wert="bleibt"]');
s = await gespeichert();
check(s.labor.find((l) => l.id === befund.id).praxis === 'bleibt' && s.labor.find((l) => l.id === befund.id).praxisAm === TAG, 'D6b: „Die Dosis bleibt so" setzt praxis und praxisAm');
check((await page.locator('#meldung').innerText()).includes('Es gilt, was die Praxis gesagt hat'), '… mit der Bestätigung');
check(await page.locator('#dosis-karte').getAttribute('data-richtung') === 'klaeren', '… und die Karte zeigt keine Richtung mehr');
check((await ansichtText(page)).includes('Die App zeigt zu diesem Befund keine Richtung mehr'), 'die Bestätigung steht auch auf der Karte');
await page.click('[data-seite="praxis-entschieden"]');
await page.click('[data-act="praxis-entscheid"][data-wert="geaendert"]');
check(await page.locator('form[data-formular="dosis"]').count() === 1, '„Neue Dosis eintragen" öffnet das Dosis-Formular');
check(await page.isChecked('input[name=praxis][value=ja]'), '… mit „auf Anweisung der Praxis: ja" vorbelegt');
await page.fill('input[name=mikrogramm]', '88');
await page.click('button[type=submit]');
s = await gespeichert();
check(s.labor.find((l) => l.id === befund.id).praxis === 'geaendert', 'praxis = geaendert am Befund');
check(s.dosen.length === 2 && s.dosen[1].mikrogramm === 88 && s.dosen[1].praxis === true, 'die neue Dosis mit praxis: true');

// W-D4: zwei Wochen nach der Erhöhung fragt „Heute" nach – mit Ja/Nein.
await uhr(plus(TAG, 14), '09:00');
await page.click('#reiter-heute');
const wd4 = page.locator('#ansicht [data-regel="W-D4"]');
check(await wd4.count() === 1 && (await wd4.innerText()).includes('Seit Ihre Dosis erhöht wurde'), 'nach 14 Tagen: die Frage nach Herzklopfen auf „Heute"');
await wd4.locator('[data-act="frage-antwort"][data-wert="nein"]').click();
s = await gespeichert();
check(s.nachfragen.some((n) => n.art === 'wd4' && n.antwort === 'nein' && n.am === plus(TAG, 14) && n.bezug === `${s.dosen[1].id}-14`), 'die Antwort steht in stand.nachfragen');
check(await page.locator('#ansicht [data-regel="W-D4"]').count() === 0, '… und die Frage ist weg');
await uhr(TAG, '09:00');

// ---------------------------------------------------------------- Warnzeichen

await page.click('#reiter-heute');
await page.click('#befinden [data-seite="warnzeichen"]');
check((await ansichtText(page)).includes('Notfallzeichen – jetzt') && (await ansichtText(page)).includes('Seit Tagen oder Wochen'), 'der Check hat seine Gruppen');
await page.check('input[name=warn][value=herzklopfen]');
await page.check('input[name=warn][value=eine_zuviel]');
await page.click('button[type=submit]');
s = await gespeichert();
check(s.warnzeichen.length === 1 && s.warnzeichen[0].datum === TAG && s.warnzeichen[0].uhr === '09:00' && [...s.warnzeichen[0].ja].sort().join() === 'eine_zuviel,herzklopfen', 'der Check ist mit Datum, Uhrzeit und Antworten gespeichert');
let t = await ansichtText(page);
check(t.includes('Bitte rufen Sie heute noch in der Praxis an') && t.includes('einzelne versehentlich doppelte Tablette'), 'das Ergebnis zeigt beide Abschnitte');
check(await page.locator('#ansicht a[href="tel:116117"]').count() >= 1, '… mit dem Bereitschaftsdienst als Anruf-Knopf (Nummer ohne Leerzeichen)');
await page.click('.kopf-zurueck');
await page.click('#befinden [data-seite="warnzeichen"]');
await page.check('input[name=warn][value=brust]');
await page.check('input[name=warn][value=herzklopfen]');
await page.click('button[type=submit]');
t = await ansichtText(page);
check(await page.locator('#ansicht .karte').count() === 1 && t.includes('Bitte rufen Sie jetzt 112 an'), 'W1: nur der 112-Abschnitt');
check(!t.includes('in der Praxis an'), '… alles andere ist ausgeblendet');
check(await page.locator('#ansicht a[href="tel:112"]').count() === 1, '… mit 112 als großem Anruf-Knopf');
check((await gespeichert()).warnzeichen.length === 2, 'auch dieser Check ist gespeichert');

// ---------------------------------------------------------------- Befinden

await page.click('#reiter-heute');
await page.click('[data-act="befinden"][data-stufe="schlecht"]');
await page.click('#befinden [data-seite="befinden"]');
check(await page.locator('.notfall-zeile a[href="tel:112"]').count() === 1, 'das Befinden hat oben eine Notfallzeile mit 112');
const vorher = (await gespeichert()).befinden.length;
check(await page.locator('#notfall-jetzt').isHidden(), 'der 112-Text ist erst verborgen');
await page.click('[data-act="notfall-jetzt"]');
check(await page.locator('#notfall-jetzt').isVisible() && (await page.locator('#notfall-jetzt').innerText()).includes('Bitte rufen Sie jetzt 112 an'), '„… JETZT" zeigt sofort den W1-Text');
check((await gespeichert()).befinden.length === vorher, '… ohne zu speichern');
await page.fill('textarea[name=notiz]', 'Seit heute früh Druck auf der Brust');
await page.click('button[type=submit]');
t = await ansichtText(page);
check(t.includes('Bitte rufen Sie jetzt 112 an') && await page.locator('#ansicht a[href="tel:112"]').count() >= 1, 'Notiz „Druck auf der Brust": nach dem Speichern der 112-Text mit Anruf-Knopf');
check((await gespeichert()).befinden.some((b) => b.notiz.includes('Druck auf der Brust')), '… und das Befinden ist gespeichert');

// ---------------------------------------------------------------- Gesamtbild

await seite('gesamtbild');
await breitOk('Gesamtbild');
t = await ansichtText(page);
check(await page.locator('#ansicht .stufe-karte .stufe-schild').count() === 1, 'das Gesamtbild nennt oben die Stufe in Worten');
check(t.includes('Warnzeichen-Check von heute'), '… mit dem Check von heute');
check(/Fragen für den Termin/i.test(t) && await page.locator('[data-act="fragen-uebernehmen"]').count() === 1, 'Fragen-Vorschläge zum Übernehmen');
check(t.includes('Automatische Einschätzung der App'), 'die Fußzeile steht darunter');

// ---------------------------------------------------------------- Rückfrage

// TSH 45 bei gleicher Dosis wie ein Befund mit TSH 2: mehr als achtmal so hoch – Komma?
await page.click('#reiter-verlauf');
await page.click('#ansicht [data-seite="labor"]');
await page.fill('input[name=datum]', plus(TAG, -60));
await page.fill('input[name=tsh_wert]', '45');
await page.click('button[type=submit]');
const dlg = page.locator('dialog.rueckfrage');
check(await dlg.isVisible(), 'TSH 45: eine Rückfrage im Stil der App');
check((await dlg.innerText()).includes('achtmal'), `… mit dem Grund (${(await dlg.locator('li').first().innerText()).slice(0, 70)}…)`);
check(!(await gespeichert()).labor.some((l) => l.datum === plus(TAG, -60)), 'vor der Antwort ist nichts gespeichert');
await dlg.locator('[data-act="befund-korrigieren"]').click();
check(await dlg.count() === 0 && await page.inputValue('input[name=tsh_wert]') === '45', '„Korrigieren": zurück ins Formular, die Eingabe steht noch da');
await page.click('button[type=submit]');
await page.locator('dialog.rueckfrage [data-act="befund-bestaetigen"]').click();
s = await gespeichert();
const b45 = s.labor.find((l) => l.datum === plus(TAG, -60));
check(b45 && b45.tsh.wert === 45 && b45.bestaetigt === true, '„Ja, stimmt": gespeichert mit bestaetigt: true');
check(dialoge.length === 0, 'kein Browser-Dialog dabei');

// „< 0,01" vom Befund: gespeichert als 0,01 mit „unter".
await page.click('#reiter-verlauf');
await page.click('#ansicht [data-seite="labor"]');
await page.fill('input[name=datum]', plus(TAG, -200));
await page.fill('input[name=tsh_wert]', '< 0,01');
await page.click('button[type=submit]');
if (await page.locator('dialog.rueckfrage').count()) await page.click('dialog.rueckfrage [data-act="befund-bestaetigen"]');
s = await gespeichert();
const unter = s.labor.find((l) => l.datum === plus(TAG, -200));
check(unter && unter.tsh.wert === 0.01 && unter.tsh.unter === true, `„< 0,01" → wert 0,01, unter: true (${JSON.stringify(unter && unter.tsh)})`);

// ---------------------------------------------------------------- Einnahmezeit

await seite('erinnerung');
await page.fill('input[name=erinnerung]', '21:30');
await page.locator('input[name=erinnerung]').dispatchEvent('change');
s = await gespeichert();
check(s.einstellungen.erinnerung === '21:30' && s.uhrWechsel.length === 1 && s.uhrWechsel[0].von === '07:00' && s.uhrWechsel[0].nach === '21:30', 'Einnahmezeit um mehr als 3 Stunden verschoben: als Wechsel vermerkt');
check((await page.locator('#meldung').innerText()).includes('abends vor dem Schlafen'), '… und der Hinweis E15 als Meldung');

// ---------------------------------------------------------------- Bericht

await seite('bericht');
t = await page.locator('#berichtText').innerText();
check(t.includes('EINSCHÄTZUNG DER APP'), 'der Bericht enthält „EINSCHÄTZUNG DER APP"');
check(t.includes('Dosis-Karte der App'), '… und „Dosis-Karte der App"');
check(t.includes('auf Anweisung der Praxis: ja'), '… und bei der Dosis „auf Anweisung der Praxis: ja"');
check(t.includes('rechnet keine neue Dosis aus'), 'die Fußzeile: „rechnet keine neue Dosis aus"');
check(!/undefined|NaN|\[object/.test(t), 'kein Rechenrest im Bericht');

// Der Stand bleibt lesbar.
check(await page.evaluate((key) => { try { return !!JSON.parse(localStorage.getItem(key)).version; } catch { return false; } }, SCHLUESSEL), 'der gespeicherte Stand ist gültiges JSON');

await ende();
