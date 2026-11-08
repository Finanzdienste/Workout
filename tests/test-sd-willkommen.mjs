/*
 * Schilddrüse: das allererste Öffnen.
 *
 * Drei Schritte – Anrede, Tablette, Uhrzeit – und danach „Heute". Geprüft
 * wird, was bei einer Nutzerin ohne Technikvorwissen schiefgehen kann: die
 * Eingabetaste lädt die Seite neu, ein leeres Pflichtfeld wird still
 * übergangen, „Zurück" und wieder „Weiter" legt die Dosis doppelt an, und die
 * Leiste unten lockt vorzeitig aus der Einrichtung heraus.
 */
import { oeffne, SD_URL, ansichtText, standMit, plus, SCHLUESSEL } from './sd-hilfe.mjs';

const TAG = '2026-03-10';
const { page, check, uhr, gespeichert, ende } = await oeffne({ viewport: { width: 360, height: 740 }, tag: TAG, zeit: '08:00' });

check(await page.locator('.willkommen-titel').isVisible(), 'beim ersten Öffnen steht die Willkommensseite da');
check(await page.locator('#reiterleiste').isHidden(), 'die Reiterleiste ist während der Einrichtung ausgeblendet');
check((await ansichtText(page)).includes('Praxis anrufen'), 'die Grenzen der App stehen gleich auf der ersten Seite');
check(await page.locator('[data-act="sicherung-laden"]').isVisible(), 'wer ein neues Handy hat, kann schon hier eine Sicherung einlesen');
// Begrüßung/Rückkanal (Nov. 2026): „Alles bleibt auf diesem Handy. Kein
// Konto, kein Internet nötig." stimmte mit der täglichen Meldung an Tobi
// nicht mehr – es bleiben die Einträge.
const schritt1 = await ansichtText(page);
check(schritt1.includes('Ihre Einträge bleiben auf diesem Handy. Kein Konto nötig.') && !schritt1.includes('Alles bleibt auf diesem Handy') && !schritt1.includes('kein Internet'),
  'Schritt 1: „Ihre Einträge bleiben auf diesem Handy. Kein Konto nötig."');
// Gefragt wird nach der Behandlung, nicht nach der Einnahme: auch wer die Tabletten gerade nicht nimmt, kann den Haken setzen.
const haken = (await page.locator('label:has(input[name=behandelt])').innerText()).trim();
check(haken === 'Mir wurden Tabletten gegen eine Schilddrüsen-Unterfunktion verordnet – auch wenn ich sie gerade nicht nehme', `der Haken fragt nach der Verordnung („${haken}")`);

// Eingabetaste im Namensfeld: weiter, nicht neu laden.
await page.fill('input[name=name]', 'Mama');
await page.press('input[name=name]', 'Enter');
await page.waitForTimeout(200);
check(!page.url().includes('?'), 'die Eingabetaste lädt die Seite nicht mit den Eingaben in der Adresse neu');
check((await page.locator('.schritte').innerText()).includes('Schritt 2'), 'die Eingabetaste führt zu Schritt 2');

// Stärke: nicht schätzen. Leer ist erlaubt, Unsinn nicht.
check((await page.locator('#ansicht').innerText()).includes('bitte nicht schätzen'), 'die Seite bittet, die Stärke nicht zu schätzen');
await page.fill('input[name=mikrogramm]', 'fünfundsiebzig');
await page.click('[data-act="willkommen-weiter"]');
check((await page.locator('.feld-fehler').allInnerTexts()).some((t) => t.includes('Zahl')), 'Text statt Zahl: das Feld sagt warum');
check((await page.locator('.schritte').innerText()).includes('Schritt 2'), '… und die Seite bleibt bei Schritt 2');
await page.fill('input[name=mikrogramm]', '');
await page.click('[data-act="willkommen-weiter"]');
check((await page.locator('.schritte').innerText()).includes('Schritt 3'), 'leer gelassen geht es weiter – die Packung ist nicht immer zur Hand');
await page.click('[data-act="willkommen-zurueck"]');
await page.fill('input[name=mikrogramm]', '0,075');
await page.click('[data-act="willkommen-weiter"]');
check((await page.locator('.feld-fehler').allInnerTexts()).some((t) => t.includes('prüfen')), 'Milligramm statt Mikrogramm (0,075) wird bemerkt');
await page.fill('input[name=mikrogramm]', '75');
await page.fill('input[name=praeparat]', 'L-Thyroxin Henning');
await page.click('[data-act="willkommen-weiter"]');
check((await page.locator('.schritte').innerText()).includes('Schritt 3'), 'mit 75 µg geht es zu Schritt 3');
check((await ansichtText(page)).includes('nicht von selbst melden'), 'Schritt 3 sagt ehrlich, dass die App sich geschlossen nicht meldet');
// Begrüßung/Rückkanal (Nov. 2026): „… einen Dienst im Internet, … den hat sie
// mit Absicht nicht" – gleich danach kündigt das Fenster die Meldung übers Netz an.
check((await ansichtText(page)).includes('Diese App kann sich nicht von selbst melden, wenn sie geschlossen ist.') && !(await ansichtText(page)).includes('Dienst im Internet'),
  '… ohne den Halbsatz vom Dienst im Internet, den sie „mit Absicht nicht" habe');

// Zurück und wieder vor: keine zweite Dosis.
await page.click('[data-act="willkommen-zurueck"]');
check(await page.inputValue('input[name=mikrogramm]') === '75', 'zurück zu Schritt 2: die Stärke steht noch da');
await page.click('[data-act="willkommen-weiter"]');
await page.fill('input[name=erinnerung]', '06:30');
await page.click('[data-act="willkommen-weiter"]');
await page.waitForTimeout(200);

const s = await gespeichert();
check(s && s.profil.begruesst === true, 'nach „Fertig" ist die Einrichtung gespeichert');
check(s && s.dosen.length === 1, `„Zurück" und wieder „Weiter" legt die Dosis nicht doppelt an (${s && s.dosen.length})`);
check(s && s.dosen[0].mikrogramm === 75 && s.dosen[0].ab === TAG, 'Dosis 75 µg ab heute gespeichert');
check(s && s.einstellungen.erinnerung === '06:30', 'Einnahmezeit 6:30 gespeichert');
check(s && s.profil.name === 'Mama', 'Anrede gespeichert');

check(await page.locator('#reiterleiste').isVisible(), 'danach ist die Reiterleiste da');
const heute = await ansichtText(page);
check(heute.includes('L-Thyroxin Henning 75 µg, 1 Tablette am Tag'), '„Heute" nennt Präparat und Dosis');
check(heute.includes('Guten Tag, Mama'), '„Heute" spricht mit der gewählten Anrede an');
check(heute.includes('Dienstag, 10. März'), '„Heute" nennt das Datum in Worten');

// Der große Knopf ist ohne Scrollen zu sehen – über der Leiste.
const box = await page.locator('.tablette').boundingBox();
const leiste = await page.locator('#reiterleiste').boundingBox();
check(box && leiste && box.y + box.height <= leiste.y, `der Tabletten-Knopf liegt bei 360 × 740 ganz über der Leiste (${box && Math.round(box.y + box.height)} ≤ ${leiste && Math.round(leiste.y)})`);
check(box && box.height >= 100, `der Tabletten-Knopf ist groß (${box && Math.round(box.height)} px hoch)`);

// Runde 8: K13 – gleich nach dem Einrichten „Dosis ändern" bei der einzigen
// Dosis: Der Eintrag vom Einrichten hatte kein Feld `praxis`, und das Formular
// hielt ihn deshalb für einen Eintrag mit Quelle – es verlangte „Auf Anweisung
// der Praxis?" als Pflicht, die Notiz ließ sich bis zum nächsten Neuladen
// nicht speichern.
await page.click('#reiter-verlauf');
await page.click('#ansicht [data-seite="dosis-liste"]');
await page.locator('#ansicht [data-seite="dosis"][data-param]').first().click();
await page.waitForTimeout(300);
check(await page.locator('form[data-formular="dosis"]').count() === 1 && !(await ansichtText(page)).includes('Auf Anweisung der Praxis?'), 'K13: „Dosis ändern" fragt bei der einzigen Dosis nicht „Auf Anweisung der Praxis?"');
await page.fill('form[data-formular="dosis"] input[name=notiz]', 'Packung geprüft');
await page.click('form[data-formular="dosis"] button[type=submit]');
await page.waitForTimeout(300);
check(!(await page.locator('.feld-fehler').allInnerTexts()).some((t) => t.includes('Hat die Praxis diese Dosis angeordnet')), 'K13: Speichern verlangt keine Quellangabe');
const s13 = await gespeichert();
check(s13.dosen.length === 1 && s13.dosen[0].notiz === 'Packung geprüft' && s13.dosen[0].praxis === null, `K13: die Notiz ist gespeichert, die Quelle bleibt offen (${JSON.stringify(s13.dosen[0])})`);
await page.click('#reiter-heute');

await uhr(TAG, '08:00');
check(await page.locator('.tablette').isVisible() && !(await page.locator('.willkommen-titel').count()), 'nach dem Neuladen geht es direkt zu „Heute"');
check(page.url().startsWith(SD_URL.replace(/index\.html$/, '')), 'die App bleibt in ihrem Ordner');

// Begrüßung/Heute (Nov. 2026): Ohne Befund lädt „Heute" ein, Laborwerte
// einzutragen – dass die App einen Befund einordnet, sah man dort vorher
// nicht. Die Notfallleiste ist eine Zeile: 112 sofort, der Rest aufklappbar.
// Ein offenes Begrüßungsfenster (Einführung) zuerst schließen – es gehört
// nicht zu diesem Test.
if (await page.locator('dialog[open]').count()) await page.keyboard.press('Escape');
const einladung = page.locator('#ansicht .labor-einladung');
check(await einladung.count() === 1 && (await einladung.innerText()).includes('Tragen Sie TSH (und fT4) ein'), 'ohne Befund: „Heute" lädt ein, Laborwerte einzutragen');
const leisteOben = await page.locator('#ansicht .notfall-leiste').boundingBox();
check(leisteOben && leisteOben.height <= 80 && await page.locator('#ansicht .notfall-leiste a.knopf-notruf[href="tel:112"]').isVisible(),
  `die Notfallleiste ist eine Zeile mit 112 (${leisteOben && Math.round(leisteOben.height)} px hoch)`);
// Prüfung Nov. 2026: Der Knopf steht gleich unter der Frage – bei 360 × 740
// und Schrift „groß" über der Reiterleiste, ohne Rollen.
const laborKnopf = async () => {
  const k = await page.locator('#ansicht .labor-einladung [data-seite="labor"]').boundingBox();
  const l = await page.locator('#reiterleiste').boundingBox();
  return { ok: Boolean(k && l && k.y + k.height <= l.y), unten: k && Math.round(k.y + k.height), leiste: l && Math.round(l.y) };
};
let lk = await laborKnopf();
check(lk.ok, `„Laborwerte eintragen" liegt ohne Rollen über der Reiterleiste (${lk.unten} ≤ ${lk.leiste})`);
await einladung.locator('[data-seite="labor"]').click();
check(await page.locator('form[data-formular="labor"]').count() === 1, '„Laborwerte eintragen" öffnet das Formular für den Befund');

// Prüfung Nov. 2026: Aus der alten App, gestern nicht eingetragen – die
// Einladung stand hinter „Gestern nicht eingetragen" unter der Reiterleiste
// (y 758). Jetzt davor; die Frage nach gestern eilt nicht.
await page.waitForTimeout(400);
await page.evaluate(({ key, st }) => { localStorage.setItem(key, JSON.stringify(st)); sessionStorage.clear(); }, {
  key: SCHLUESSEL,
  st: standMit(plus(TAG, -60), { profil: { name: 'Mama', begruesst: true, seit: plus(TAG, -60), einfuehrung: 1 }, einnahmen: { [plus(TAG, -2)]: { uhr: '07:31' } } }),
});
await uhr(TAG, '08:00');
const reihe = await page.evaluate(() => [...document.querySelectorAll('#ansicht .labor-einladung, #ansicht #gestern')].map((e) => e.id || 'labor'));
check(JSON.stringify(reihe) === '["labor","gestern"]', `mit „Gestern nicht eingetragen": die Einladung steht davor (${reihe.join(', ')})`);
lk = await laborKnopf();
check(lk.ok, `… und „Laborwerte eintragen" liegt über der Reiterleiste (${lk.unten} ≤ ${lk.leiste})`);

await ende();
