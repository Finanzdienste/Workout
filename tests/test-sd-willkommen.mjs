/*
 * Schilddrüse: das allererste Öffnen.
 *
 * Drei Schritte – Anrede, Tablette, Uhrzeit – und danach „Heute". Geprüft
 * wird, was bei einer Nutzerin ohne Technikvorwissen schiefgehen kann: die
 * Eingabetaste lädt die Seite neu, ein leeres Pflichtfeld wird still
 * übergangen, „Zurück" und wieder „Weiter" legt die Dosis doppelt an, und die
 * Leiste unten lockt vorzeitig aus der Einrichtung heraus.
 */
import { oeffne, SD_URL, ansichtText } from './sd-hilfe.mjs';

const TAG = '2026-03-10';
const { page, check, uhr, gespeichert, ende } = await oeffne({ viewport: { width: 360, height: 740 }, tag: TAG, zeit: '08:00' });

check(await page.locator('.willkommen-titel').isVisible(), 'beim ersten Öffnen steht die Willkommensseite da');
check(await page.locator('#reiterleiste').isHidden(), 'die Reiterleiste ist während der Einrichtung ausgeblendet');
check((await ansichtText(page)).includes('Praxis anrufen'), 'die Grenzen der App stehen gleich auf der ersten Seite');
check(await page.locator('[data-act="sicherung-laden"]').isVisible(), 'wer ein neues Handy hat, kann schon hier eine Sicherung einlesen');

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

await uhr(TAG, '08:00');
check(await page.locator('.tablette').isVisible() && !(await page.locator('.willkommen-titel').count()), 'nach dem Neuladen geht es direkt zu „Heute"');
check(page.url().startsWith(SD_URL.replace(/index\.html$/, '')), 'die App bleibt in ihrem Ordner');

await ende();
