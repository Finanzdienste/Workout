/*
 * Mahlzeit v2: was Tobi dem Kollegen sonst selbst hätte sagen müssen, steht
 * in der App (Tobi, 17.11.: „Das können wir ihm ja alles in die app packen").
 *
 *   1. Auf den Startbildschirm – passend zum Handy: iPhone mit Schritten je
 *      nach Safari-Fassung, mit den Symbolen als Bild und dem Grund (Safari
 *      löscht sonst; Tobi: „Wie genau kann man bei nem iphone teilen?"),
 *      Chrome auf dem iPhone über Safari, Android mit echtem „Installieren",
 *      wenn Chrome es anbietet, sonst mit Schritten. Als App gestartet:
 *      kein Hinweis. „Später" hält eine Woche.
 *   2. Wie oft Hafertage – die Frage stellt die App dem Kollegen selbst, erst
 *      unter „Hafer": verteilt im Monat, am Stück, weiß nicht, gar nicht.
 *      Am Stück trägt ein Tipp die ganze Runde ein, und die Startseite sagt,
 *      wann die nächste dran ist.
 */
import { oeffne, pruefer, plus } from './mz-hilfe.mjs';

const { check, ende } = pruefer();
const TAG = '2026-11-17';
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1';
const IPHONE_26 = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1';
const IPHONE_CHROME = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/141.0.7390.41 Mobile/15E148 Safari/604.1';
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36';
const alleFehler = [];
const zu = async (o) => { alleFehler.push(...o.fehler); await o.browser.close(); };

// --- 1. iPhone
let o = await oeffne({ tag: TAG, kontext: { userAgent: IPHONE } });
let karte = o.page.locator('#installieren');
check(await karte.isVisible(), 'iPhone: Karte „Als App auf den Startbildschirm" auf der Startseite');
let text = await karte.innerText();
check(text.includes('Teilen') && text.includes('Zum Home-Bildschirm') && text.includes('Hinzufügen'), 'iPhone: die drei Schritte (Teilen → Zum Home-Bildschirm → Hinzufügen)');
check(text.includes('löscht Safari deine Einträge'), 'iPhone: mit dem Grund – sonst löscht Safari die Einträge');
check(text.includes('Unten in der Mitte') && !text.includes('Als Web-App öffnen'), 'iOS 18: Teilen unten in der Mitte, ohne den Schalter aus iOS 26');
check(await karte.locator('#install-schritte svg.symbol').count() >= 2, '… mit den Symbolen als Bild (Teilen, Zum Home-Bildschirm)');
check(text.includes('Aktionen bearbeiten'), '… und was tun, wenn „Zum Home-Bildschirm" fehlt');
check(!(await o.page.locator('#willkommen').innerText()).includes('Startbildschirm'), 'das Hallo bleibt kurz, die Anleitung hat ihre eigene Karte');
await o.page.click('#reiter-mehr');
check((await o.page.locator('#karte-installieren').innerText()).includes('Zum Home-Bildschirm'), 'unter „Mehr" dieselbe Anleitung');
await o.page.click('#reiter-heute');
await o.page.click('[data-tun="install-spaeter"]');
check(await o.page.locator('#installieren').count() === 0, '„Später" blendet die Karte aus');
const spaeterStand = await o.gespeichert();
await zu(o);
o = await oeffne({ tag: plus(TAG, 6), kontext: { userAgent: IPHONE }, stand: spaeterStand });
check(await o.page.locator('#installieren').count() === 0, '… sechs Tage später noch aus');
await zu(o);
o = await oeffne({ tag: plus(TAG, 7), kontext: { userAgent: IPHONE }, stand: spaeterStand });
check(await o.page.locator('#installieren').isVisible(), '… nach einer Woche wieder da');
await zu(o);

// --- iOS 26: das Menü „⋯", dann Teilen, dazu der Schalter „Als Web-App öffnen"
o = await oeffne({ tag: TAG, kontext: { userAgent: IPHONE_26 } });
text = await o.page.locator('#installieren').innerText();
check(text.includes('Unten rechts') && text.includes('„⋯“') && text.includes('„Teilen“'), 'iOS 26: unten rechts „⋯", dann „Teilen"');
check(text.includes('Als Web-App öffnen'), 'iOS 26: den Schalter „Als Web-App öffnen" anlassen');
check(text.includes('WhatsApp'), '… und was tun, wenn der Link in WhatsApp aufging');
await zu(o);

// --- Chrome auf dem iPhone: über Safari, mit „Link kopieren"
o = await oeffne({ tag: TAG, kontext: { userAgent: IPHONE_CHROME, permissions: ['clipboard-read', 'clipboard-write'] } });
text = await o.page.locator('#installieren').innerText();
check(text.includes('Am einfachsten geht es in Safari'), 'Chrome auf dem iPhone: am einfachsten in Safari');
await o.page.click('#link-kopieren');
await o.page.waitForTimeout(100);
check((await o.page.evaluate(() => navigator.clipboard.readText())).endsWith('/mahlzeit/index.html'), '„Link kopieren" legt die Adresse der App in die Zwischenablage');
check((await o.page.locator('#meldung').innerText()).includes('Safari öffnen'), '… und sagt, wie es weitergeht');
await zu(o);

// --- Als App gestartet: kein Hinweis
const alsApp = () => {
  const echt = window.matchMedia.bind(window);
  window.matchMedia = (q) => (q.includes('display-mode: standalone')
    ? { matches: true, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }
    : echt(q));
};
o = await oeffne({ tag: TAG, kontext: { userAgent: IPHONE }, skripte: [alsApp] });
check(await o.page.locator('#installieren').count() === 0, 'vom Home-Bildschirm gestartet: keine Karte');
await o.page.click('#reiter-mehr');
check((await o.page.locator('#karte-installieren').innerText()).includes('Läuft schon als App'), 'unter „Mehr": „Läuft schon als App"');
await zu(o);

// --- 2. Android ohne Angebot von Chrome: Schritte
o = await oeffne({ tag: TAG, kontext: { userAgent: ANDROID } });
text = await o.page.locator('#installieren').innerText();
check(text.includes('⋮') && text.includes('Zum Startbildschirm hinzufügen'), 'Android: Chrome-Menü ⋮ → „Zum Startbildschirm hinzufügen"');
check(!text.includes('Safari'), 'Android: nichts von Safari');

// Chrome bietet das Installieren an: ein Knopf genügt.
await o.page.evaluate(() => {
  const ev = new Event('beforeinstallprompt', { cancelable: true });
  ev.prompt = () => { window.__gefragt = (window.__gefragt || 0) + 1; return Promise.resolve(); };
  ev.userChoice = Promise.resolve({ outcome: 'accepted', platform: 'web' });
  window.dispatchEvent(ev);
});
check(await o.page.locator('#install-knopf').isVisible(), 'Android: Chrome bietet es an → Knopf „Jetzt installieren"');
await o.page.click('#install-knopf');
check(await o.page.evaluate(() => window.__gefragt) === 1, '… der Knopf öffnet den Dialog von Chrome');
await o.page.evaluate(() => window.dispatchEvent(new Event('appinstalled')));
check(await o.page.locator('#installieren').count() === 0, 'installiert: die Karte ist weg');
check((await o.page.locator('#meldung').innerText()).includes('Installiert'), '… mit kurzer Bestätigung');
check(!!(await o.gespeichert()).hinweise.installiert, '… und bleibt weg (gemerkt)');
await zu(o);

// --- 3. Die Hafer-Frage
o = await oeffne({ tag: TAG });
let p = o.page;
check((await p.locator('#hafer-vorschau').innerText()).includes('Wie oft hat dein Arzt gesagt'), 'Startseite: „Hafertage einrichten" statt einer festen Annahme');
check(o.dialoge.length === 0 && await p.locator('#hafer-frage').count() === 0, 'gefragt wird nicht beim Start, sondern erst unter „Hafer"');
await p.click('#hafer-vorschau [data-tun="seite"]');
check(await p.locator('#hafer-frage .antwort').count() === 4, 'Hafer: vier Antworten (verteilt, am Stück, weiß nicht, gar nicht)');
await p.click('[data-tun="hafer-art"][data-art="amStueck"]');
check((await p.locator('#hafer-art').innerText()).includes('3 Tage am Stück, jeden Monat'), 'am Stück: vorgewählt 3 Tage, jeden Monat');
await p.click('[data-tun="hafer-tag"][data-tag="2026-11-21"]');
const gedrueckt = async (t) => (await p.locator(`[data-tun="hafer-tag"][data-tag="${t}"]`).getAttribute('aria-pressed')) === 'true';
check(await gedrueckt('2026-11-21') && await gedrueckt('2026-11-22') && await gedrueckt('2026-11-23') && !(await gedrueckt('2026-11-24')), 'ein Tipp auf den 21. trägt 21. bis 23. ein');
check((await p.locator('#meldung').innerText()).includes('Sa, 21.11. bis Mo, 23.11.'), `Meldung nennt die Spanne (${await p.locator('#meldung').innerText()})`);
await p.click('[data-tun="hafer-tag"][data-tag="2026-11-22"]');
check(!(await gedrueckt('2026-11-21')) && !(await gedrueckt('2026-11-22')) && !(await gedrueckt('2026-11-23')), 'ein Tipp auf einen davon nimmt die ganze Runde heraus');
await p.click('#meldung [data-tun="rueckgaengig"]');
check(await gedrueckt('2026-11-21') && await gedrueckt('2026-11-23'), 'Rückgängig holt sie zurück');
await p.click('#reiter-heute');
text = await p.locator('#hafer-vorschau').innerText();
check(text.includes('Nächste Hafertage') && text.includes('Samstag, 21. November') && text.includes('3 Tage am Stück'), `Startseite: „Nächste Hafertage: Samstag, 21. November … 3 Tage am Stück" (${text.replace(/\n/g, ' ')})`);
const amStueck = await o.gespeichert();
await zu(o);

o = await oeffne({ tag: '2026-11-20', stand: amStueck });
text = await o.page.locator('#hafer-vorschau').innerText();
check(text.includes('Morgen ist Hafertag – 3 Tage am Stück') && text.includes('675 g'), `am Tag davor: „Morgen … 3 Tage am Stück", 675 g Haferflocken (${text.replace(/\n/g, ' ')})`);
await zu(o);
o = await oeffne({ tag: '2026-11-22', stand: amStueck });
check((await o.page.locator('#hafertag h3').innerText()).includes('Tag 2 von 3'), 'am 22.: „Hafertag – Tag 2 von 3"');
await zu(o);

// Die nächste Runde: alle 3 Monate, zuletzt ab dem 20. August
const runde = { v: 1, hinweise: { willkommen: TAG }, hafer: { art: 'amStueck', amStueck: 3, alleMonate: 3, proMonat: 3, tage: ['2026-08-20', '2026-08-21', '2026-08-22'] } };
o = await oeffne({ tag: TAG, stand: runde });
text = await o.page.locator('#hafer-vorschau').innerText();
check(text.includes('Zeit für die nächsten Hafertage') && text.includes('Fr, 20.11.'), `drei Tage vor der nächsten Runde: „Zeit für die nächsten Hafertage … ab Fr, 20.11." (${text.replace(/\n/g, ' ')})`);
await o.page.click('#reiter-hafer');
check((await o.page.locator('#hafer-runde').innerText()).includes('Freitag, 20. November'), 'Hafer: „Nächste Runde: ab Freitag, 20. November"');
await zu(o);
o = await oeffne({ tag: '2026-10-01', stand: runde });
check(await o.page.locator('#hafer-vorschau').count() === 0, 'sieben Wochen vorher: noch Ruhe auf der Startseite');
await zu(o);

// Weiß nicht / gar nicht
o = await oeffne({ tag: TAG });
p = o.page;
await p.click('#reiter-hafer');
await p.click('[data-tun="hafer-art"][data-art="unklar"]');
check(await p.locator('#arzt-fragen li').count() === 3, 'weiß nicht: drei Fragen für den nächsten Arzttermin');
check((await p.locator('#arzt-fragen').innerText()).includes('Tabletten oder am Insulin'), '… darunter die nach Tabletten und Insulin');
await p.click('#reiter-heute');
check(await p.locator('#hafer-vorschau').count() === 0, 'weiß nicht: die Startseite drängelt nicht');
await p.click('#reiter-hafer');
await p.click('#hafer-frage [data-tun="hafer-art"][data-art=""]');
check(await p.locator('#hafer-frage .antwort').count() === 4, '„Jetzt beantworten" zeigt die Frage wieder');
await p.click('[data-tun="hafer-art"][data-art="aus"]');
check((await p.locator('#hafer-art').innerText()).includes('Keine Hafertage'), 'gar nicht: „Keine Hafertage"');
await p.click('#reiter-heute');
check(await p.locator('#hafer-vorschau').count() === 0, '… und auf der Startseite nichts dazu');
await zu(o);

// Ein Stand aus v1 (ohne Antwort) bekommt die Frage; „aus" aus v1 bleibt aus.
o = await oeffne({ tag: TAG, stand: { v: 1, hafer: { proMonat: 3, tage: [] } } });
check((await o.page.locator('#hafer-vorschau').innerText()).includes('Wie oft hat dein Arzt gesagt'), 'Stand aus v1: die Frage kommt');
await zu(o);
o = await oeffne({ tag: TAG, stand: { v: 1, hafer: { proMonat: 0, tage: [] } } });
check(await o.page.locator('#hafer-vorschau').count() === 0, 'v1 mit „aus": bleibt aus');
await zu(o);

check(alleFehler.length === 0, `keine Fehler in der Seite${alleFehler.length ? `: ${alleFehler.slice(0, 3).join(' | ')}` : ''}`);
ende();
