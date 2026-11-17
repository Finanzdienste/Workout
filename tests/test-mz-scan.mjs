/*
 * Mahlzeit v3: Strichcode, Rezept und Foto in der App – das Netz ist
 * nachgebaut (Open Food Facts und die Funktion mahlzeit-ki über page.route),
 * die Kamera auch (BarcodeDetector und getUserMedia im Init-Skript).
 *
 * Tobi: „ihm fehlen viele rezepte und zutaten. Lass doch per Api ne ki
 * einbauen … oder ne seite ausm kochbuch fotografieren … Dann kann man ja
 * kalorien je 100g sagen" – „und barcode scanner".
 */
import { oeffne, pruefer, summe } from './mz-hilfe.mjs';

const { check, ende } = pruefer();
const TAG = '2026-11-17';
const CODE = 'ABCDE-FGHJK';
const EAN = '4000540000108';
const KI = /functions\/v1\/mahlzeit-ki/;
const OFFURL = /openfoodfacts\.org\/api\/v2\/product\//;
const alleFehler = [];
const zu = async (o) => { alleFehler.push(...o.fehler.filter((f) => !/ERR_FAILED|Failed to load resource/.test(f))); await o.browser.close(); };
const MIT_CODE = { 'mahlzeit.ki.v1': JSON.stringify({ code: CODE }) };

const HAFER = { status: 1, product: { product_name: 'Kernige Haferflocken', brands: 'Kölln', serving_quantity: 40, serving_size: '40 g', nutriments: { 'energy-kcal_100g': 372, carbohydrates_100g: 58.7 } } };
const GULASCH = {
  art: 'rezept', name: 'Gulasch', ean: '', portionen: 4, gesamt_gramm: 1800, gesamt_kcal: 2400, gesamt_kh: 120, kcal_100g: 133, kh_100g: 6.7,
  portion_text: '', portion_gramm: 0, zutaten: [{ name: 'Rindfleisch', menge: '1 kg', gramm: 1000, kcal: 1500 }], hinweis: 'Fleisch nach dem Schmoren gerechnet.',
};
const RIEGEL = { art: 'packung', name: 'Müsliriegel Schoko', ean: '', portionen: 1, gesamt_gramm: 0, gesamt_kcal: 0, gesamt_kh: 0, kcal_100g: 420, kh_100g: 64, portion_text: '1 Riegel (25 g)', portion_gramm: 25, zutaten: [], hinweis: '' };

/** Die Funktion nachbauen: merkt sich die Anfragen, antwortet mit `antwort(rumpf)`. */
async function kiNachbauen(page, antwort) {
  const anfragen = [];
  await page.route(KI, async (route) => {
    const req = route.request();
    const rumpf = JSON.parse(req.postData() || '{}');
    anfragen.push({ rumpf, zugang: req.headers()['x-zugang'] });
    const [status, daten] = antwort(rumpf, req.headers()['x-zugang']);
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(daten), headers: { 'access-control-allow-origin': '*' } });
  });
  return anfragen;
}

async function offNachbauen(page, antworten) {
  const gefragt = [];
  await page.route(OFFURL, async (route) => {
    const code = route.request().url().match(/product\/(\d+)\.json/)[1];
    gefragt.push(code);
    const json = antworten[code];
    await route.fulfill({ status: json ? 200 : 404, contentType: 'application/json', body: JSON.stringify(json || { status: 0 }), headers: { 'access-control-allow-origin': '*' } });
  });
  return gefragt;
}

// Ein kleines PNG als Foto (1×1 Pixel reicht, die App verkleinert es zu JPEG).
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGP8z8DAwMDAxMDAwMDAAAANHQEDK+mmyAAAAABJRU5ErkJggg==', 'base64');

// --- 1. Strichcode eintippen (ohne Kamera, ohne KI)
let o = await oeffne({ tag: TAG, zeit: '08:15' });
let p = o.page;
let off = await offNachbauen(p, { [EAN]: HAFER });
await p.click('#essen-knopf');
check(await p.locator('#scan-knopf').isVisible() && await p.locator('#rezept-knopf').isVisible(), 'unter der Suche: „Strichcode" und „Rezept oder Foto"');
await p.click('#scan-knopf');
check((await p.locator('#scan-hilfe').innerText()).includes('Tipp die Nummer'), 'ohne Kamera-Leser und ohne KI: Nummer eintippen');
check(await p.locator('#scan-foto').count() === 0, '… kein Foto-Knopf ohne KI');
await p.fill('#ean', '4000540000109');
await p.click('form[data-form="ean"] button');
check((await p.locator('#scan-status').innerText()).includes('stimmt so nicht') && off.length === 0, 'falsche Prüfziffer: Hinweis, nichts nachgeschlagen');
await p.fill('#ean', '4000 5400 0010 8');
await p.click('form[data-form="ean"] button');
await p.waitForSelector('#sache-kcal');
check((await p.locator('#ebene h2').innerText()) === 'Kernige Haferflocken (Kölln)', 'gefunden: „Kernige Haferflocken (Kölln)"');
check((await p.locator('#sache-kcal').innerText()) === '149' && (await p.locator('#sache-100').innerText()).includes('372 kcal je 100 g'), 'je Portion (40 g) 149 kcal, dazu 372 kcal je 100 g');
await p.fill('#gramm', '60');
check((await p.locator('#sache-kcal').innerText()) === '223', '60 g eingetippt: 223 kcal, sofort');
check(await p.locator('[data-tun="menge"][aria-pressed="true"]').count() === 0, '… und keine Menge mehr gewählt');
await p.click('#eintragen');
await p.click('#eingetragen [data-tun="ebene-zu"]');
check(await summe(p) === 223 && (await p.locator('#eintraege').innerText()).includes('60 g'), 'eingetragen: 60 g, 223 kcal');
// Zweites Mal: ohne Netz aus den eigenen Sachen
await p.click('#essen-knopf');
await p.click('#scan-knopf');
await p.fill('#ean', EAN);
await p.click('form[data-form="ean"] button');
await p.waitForSelector('#sache-kcal');
check(off.length === 1, 'derselbe Strichcode noch einmal: kein zweites Nachschlagen');
await p.click('[data-tun="zurueck-suche"]');
await p.fill('#suche', 'haferflocken kölln');
check((await p.locator('#trefferliste .sache').first().innerText()).includes('eigenes'), 'und die Suche findet das Produkt');
// Unbekannte Nummer
await p.click('#scan-knopf');
await p.fill('#ean', '4008400401621');
await p.click('form[data-form="ean"] button');
await p.waitForSelector('#nicht-gefunden');
check((await p.locator('#nicht-gefunden').innerText()).includes('kennt Open Food Facts nicht'), 'unbekannte Nummer: „kennt Open Food Facts nicht"');
check(await p.locator('[data-tun="packung-foto"]').count() === 0 && await p.locator('#nicht-gefunden [data-tun="eigen"]').count() === 1, '… ohne KI: „Selbst eintragen"');
// Ohne Netz
await p.unroute(OFFURL);
await p.click('[data-tun="scan-neu"]');
await p.fill('#ean', '4008400401621');
await p.click('form[data-form="ean"] button');
await p.waitForFunction(() => document.querySelector('#scan-status')?.textContent.includes('Keine Verbindung'));
check(true, 'ohne Netz: „Keine Verbindung zu Open Food Facts"');
await zu(o);

// --- 2. Strichcode mit der Kamera (Android: BarcodeDetector)
const kameraNachbauen = () => {
  window.BarcodeDetector = class {
    static getSupportedFormats() { return Promise.resolve(['ean_13', 'qr_code']); }
    constructor(o) { window.__formate = o?.formats; }
    detect() { window.__runden = (window.__runden || 0) + 1; return Promise.resolve(window.__runden > 2 ? [{ rawValue: '4000540000108' }] : []); }
  };
  navigator.mediaDevices.getUserMedia = async () => {
    const c = document.createElement('canvas');
    c.width = 320; c.height = 240;
    c.getContext('2d').fillRect(0, 0, 10, 10);
    window.__kamera = c.captureStream(5);
    return window.__kamera;
  };
};
o = await oeffne({ tag: TAG, skripte: [kameraNachbauen] });
p = o.page;
off = await offNachbauen(p, { [EAN]: HAFER });
await p.click('#essen-knopf');
await p.click('#scan-knopf');
check(await p.locator('#scan-video').count() === 1, 'Android: das Kamerabild in der App');
await p.waitForSelector('#sache-kcal', { timeout: 5000 });
check((await p.locator('#ebene h2').innerText()).includes('Haferflocken') && off.join() === EAN, 'die Kamera liest den Strichcode, die App schlägt ihn nach');
check(await p.evaluate(() => window.__formate?.join()) === 'ean_13', 'gesucht wird nur nach Strichcodes von Lebensmitteln');
check(await p.evaluate(() => window.__kamera.getTracks().every((t) => t.readyState === 'ended')), 'danach ist die Kamera aus');
await p.click('[data-tun="zurueck-suche"]');
await p.click('#scan-knopf');
await p.click('[data-tun="zurueck-suche"]');
check(await p.evaluate(() => window.__kamera.getTracks().every((t) => t.readyState === 'ended')), 'Strichcode verlassen: Kamera aus');
await zu(o);

// --- 3. Freischalten
o = await oeffne({ tag: TAG });
p = o.page;
let ki = await kiNachbauen(p, (r, z) => (z === CODE ? [200, { ok: true }] : [401, { fehler: 'Der Freischalt-Code stimmt nicht (mehr).' }]));
await p.click('#essen-knopf');
await p.click('#rezept-knopf');
check(await p.locator('.ki-freischalten').isVisible(), 'Rezept ohne Code: erst freischalten');
await p.fill('.ki-freischalten input', 'zzzzz-zzzzz');
await p.click('.ki-freischalten button');
await p.waitForFunction(() => document.querySelector('.ki-freischalten .fehler')?.textContent.includes('stimmt nicht'));
check(true, 'falscher Code: „stimmt nicht"');
await p.fill('.ki-freischalten input', 'abcde fghjk');
await p.click('.ki-freischalten button');
await p.waitForSelector('#ausrechnen');
check(ki.at(-1).rumpf.art === 'pruefen' && ki.at(-1).zugang === CODE, 'richtiger Code: geprüft (ohne Auswertung) und freigeschaltet');
check(await p.evaluate(() => JSON.parse(localStorage.getItem('mahlzeit.ki.v1')).code) === CODE, '… gemerkt, getrennt vom Stand');
await zu(o);

// Code aus dem Link
o = await oeffne({ tag: TAG, url: `${(await import('./mz-hilfe.mjs')).MZ_URL}#ki=${CODE}` });
check(await o.page.evaluate(() => location.hash) === '', 'Link mit #ki=…: der Code verschwindet aus der Adresse');
check(await o.page.evaluate(() => JSON.parse(localStorage.getItem('mahlzeit.ki.v1')).code) === CODE, '… und ist gemerkt');
await o.page.waitForTimeout(300);
check((await o.page.locator('#meldung').innerText()).includes('KI freigeschaltet'), '… mit Meldung');
await o.page.click('#reiter-mehr');
check((await o.page.locator('#ki-status').innerText()).includes('ABCDE-•••••'), 'Mehr: freigeschaltet, der Code nur halb');
await zu(o);

// --- 4. Ein Rezept als Text
o = await oeffne({ tag: TAG, zeit: '12:30', weitere: MIT_CODE });
p = o.page;
ki = await kiNachbauen(p, () => [200, { ergebnis: GULASCH }]);
await p.click('#essen-knopf');
await p.click('#rezept-knopf');
await p.click('#ausrechnen');
check((await p.locator('#ki-fehler').innerText()).includes('Rezept hineinschreiben'), 'leer: „Bitte das Rezept hineinschreiben"');
check(ki.length === 0, '… und nichts geschickt');
await p.fill('#rezept-text', '1 kg Rindergulasch, 3 Zwiebeln, 2 EL Paprika, 500 ml Brühe');
await p.click('[data-tun="rezept-portionen"][data-n="3"]');
await p.click('#ausrechnen');
await p.waitForSelector('#erg-100');
const r = ki[0];
check(r.zugang === CODE && r.rumpf.art === 'auswerten' && r.rumpf.hinweis === 'rezept' && r.rumpf.portionen === 3 && r.rumpf.text.includes('Rindergulasch'), 'geschickt: Text, 3 Portionen, „rezept", mit Code');
check((await p.locator('#erg-100').innerText()) === '133', 'Ergebnis: 133 kcal je 100 g');
check((await p.locator('#erg-gesamt').innerText()).includes('2.400 kcal') && (await p.locator('#erg-gesamt').innerText()).includes('1.800 g'), 'ganzes Rezept: 2.400 kcal, 1.800 g');
check((await p.locator('#erg-portion').innerText()).includes('800 kcal (600 g)'), 'auf 3 Portionen: 800 kcal (600 g)');
await p.click('[data-tun="erg-portionen"][data-n="4"]');
check((await p.locator('#erg-portion').innerText()).includes('600 kcal (450 g)'), 'auf 4 umgestellt: 600 kcal (450 g)');
check((await p.locator('#erg-hinweis').innerText()).includes('Schmoren'), 'der Hinweis der KI steht dabei');
await p.fill('#erg-name', 'Omas Gulasch');
await p.click('#erg-eintragen');
await p.waitForSelector('#sache-kcal');
check((await p.locator('#ebene h2').innerText()) === 'Omas Gulasch' && (await p.locator('#sache-kcal').innerText()) === '600', 'gespeichert als „Omas Gulasch", 1 Portion 600 kcal');
check(await p.locator('.rechnung').count() === 1, '… mit „So hat die KI gerechnet"');
await p.fill('#gramm', '300');
await p.click('#eintragen');
await p.click('#eingetragen [data-tun="ebene-zu"]');
check(await summe(p) === 399, '300 g davon eingetragen: 399 kcal');
// Fehler der Funktion
await p.unroute(KI);
await kiNachbauen(p, () => [429, { fehler: 'Für heute sind die 30 Auswertungen aufgebraucht. Morgen geht es weiter.' }]);
await p.click('#essen-knopf');
await p.click('#rezept-knopf');
await p.fill('#rezept-text', 'Pfannkuchen');
await p.click('#ausrechnen');
await p.waitForFunction(() => document.querySelector('#ki-fehler')?.textContent.includes('Morgen'));
check(await p.locator('#ausrechnen').isEnabled(), 'Grenze erreicht: der Satz der Funktion, der Knopf geht wieder');
await zu(o);

// --- 5. Packung fotografieren, nach einem unbekannten Strichcode
o = await oeffne({ tag: TAG, weitere: MIT_CODE });
p = o.page;
await offNachbauen(p, {});
ki = await kiNachbauen(p, () => [200, { ergebnis: RIEGEL }]);
await p.click('#essen-knopf');
await p.click('#scan-knopf');
await p.fill('#ean', '4008400401621');
await p.click('form[data-form="ean"] button');
await p.waitForSelector('[data-tun="packung-foto"]');
await p.click('[data-tun="packung-foto"]');
check((await p.locator('#ebene h2').innerText()) === 'Packung auswerten', 'unbekannt → „Nährwerttabelle fotografieren" → Packung auswerten');
await p.setInputFiles('#rezept-foto', { name: 'tabelle.png', mimeType: 'image/png', buffer: PNG });
await p.waitForSelector('#fotos img');
check(await p.locator('#fotos img').count() === 1, 'das Foto steht als Vorschau da');
await p.click('#ausrechnen');
await p.waitForSelector('#erg-100');
const b = ki[0].rumpf;
check(b.hinweis === 'packung' && b.bilder.length === 1 && b.bilder[0].typ === 'image/jpeg' && b.bilder[0].daten.length > 20 && b.text === '', 'geschickt: ein Foto als JPEG, „packung", ohne Text');
check((await p.locator('#erg-portion').innerText()).includes('1 Riegel (25 g): 105 kcal'), 'Packung: „1 Riegel (25 g): 105 kcal"');
await p.click('#erg-merken');
const gemerkt = (await o.gespeichert()).eigene[0];
check(gemerkt.n === 'Müsliriegel Schoko' && gemerkt.ean === '4008400401621' && gemerkt.kcal100 === 420, 'gespeichert, mit dem Strichcode – beim nächsten Scan ohne Netz da');
check((await p.locator('#eingetragen').innerText()).includes('gespeichert'), '„Nur speichern": zurück zur Suche, mit Bestätigung');
await zu(o);

// --- 6. iPhone: Strichcode fotografieren, die KI liest die Nummer
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1';
o = await oeffne({ tag: TAG, weitere: MIT_CODE, kontext: { userAgent: IPHONE } });
p = o.page;
off = await offNachbauen(p, { [EAN]: HAFER });
ki = await kiNachbauen(p, () => [200, { ergebnis: { ...RIEGEL, art: 'strichcode', ean: EAN, kcal_100g: 0 } }]);
await p.click('#essen-knopf');
await p.click('#scan-knopf');
check((await p.locator('#scan-hilfe').innerText()).includes('Das iPhone lässt Webseiten Strichcodes nicht selbst lesen'), 'iPhone: sagt, warum fotografiert wird');
await p.setInputFiles('#scan-foto', { name: 'code.png', mimeType: 'image/png', buffer: PNG });
await p.waitForSelector('#sache-kcal');
check(ki[0].rumpf.hinweis === 'strichcode' && off.join() === EAN, 'Foto → KI liest die Nummer → Open Food Facts');
check((await p.locator('#ebene h2').innerText()).includes('Haferflocken'), '… und das Produkt steht da');
await p.click('#ebene [data-tun="zurueck-suche"]');
await p.click('#ebene [data-tun="ebene-zu"]');
const karte = await p.locator('#installieren').innerText();
check(karte.includes(CODE) && karte.includes('eigenen Speicher'), 'iPhone in Safari mit Code: die Startbildschirm-Karte nennt den Code zum Mitnehmen');
await zu(o);

check(alleFehler.length === 0, `keine Fehler in der Seite${alleFehler.length ? `: ${alleFehler.slice(0, 3).join(' | ')}` : ''}`);
ende();
