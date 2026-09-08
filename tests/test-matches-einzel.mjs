/*
 * Die Match-Tabelle als eine einzige Datei – laeuft sie ohne Server?
 *
 * Der Anlass ist derselbe wie bei tests/test-single.mjs: Das Buendel entsteht
 * aus denselben Modulen, aber in einem einzigen Gueltigkeitsbereich und ohne
 * Importe. Was dort still schiefgeht, geht genau dort schief, wo man es am
 * wenigsten merkt – auf dem Handy, offline, ohne Entwicklerwerkzeuge.
 *
 * Deshalb wird hier nicht die Datei betrachtet, sondern benutzt: Standort
 * setzen, drei Zeilen anlegen, sortieren, neu laden. Wenn ein Modul fehlt oder
 * zwei Namen kollidieren, laedt das Skript gar nicht erst, und schon der erste
 * Handgriff scheitert.
 */
import { chromium } from 'playwright';
import { rmSync } from 'node:fs';
import { MATCHES_EINZEL, profil } from './umgebung.mjs';

// Eigenes, dauerhaftes Profil: Unter file:// haengt der Speicher am Profil,
// nicht an einer Adresse. Ohne das liesse sich das Ueberleben eines Neustarts
// nicht pruefen – und genau das ist bei einer Datei auf dem Handy die Frage.
// Frisch muss es trotzdem sein, sonst stuenden beim zweiten Lauf die Zeilen des
// ersten schon da und die Zaehlung weiter unten waere sinnlos.
const ORT = profil('matches-einzel');
rmSync(ORT, { recursive: true, force: true });
const ctx = await chromium.launchPersistentContext(ORT, {
  viewport: { width: 414, height: 896 },
});
const page = ctx.pages()[0] || await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()); });
page.on('requestfailed', (r) => errs.push('REQFAIL: ' + r.url()));

let fails = 0;
const check = (c, m) => { console.log(`${c ? 'OK  ' : 'FAIL'} ${m}`); if (!c) { fails++; process.exitCode = 1; } };

await page.goto(MATCHES_EINZEL, { waitUntil: 'networkidle' });

// --- 1. Ueberhaupt angekommen ----------------------------------------
check(await page.locator('#form').isVisible(), 'die Einzeldatei zeigt das Formular');
check(await page.locator('#leer').isVisible(), 'und sagt, dass noch nichts drinsteht');
// Ein fehlendes Modul faellt hier auf: das Skript wirft beim Laden, und
// window.matches wird nie gesetzt.
check(await page.evaluate(() => typeof window.matches === 'object'),
  'das Buendel ist vollstaendig durchgelaufen – kein Modul fehlt, keine Namenskollision');

// --- 2. Der eingebaute Ortsvorrat ist mitgekommen ---------------------
await page.fill('#heimOrt', 'Berlin');
await page.click('#heimSetzen');
await page.waitForFunction(() => document.getElementById('heimStand').textContent.includes('52.520'));
check(true, 'ein Ortsname wird auch ohne Netz zu Koordinaten – die Liste steckt in der Datei');

// --- 3. Eintragen und sortieren --------------------------------------
const eintragen = async (name, app, km, ort) => {
  await page.fill('#fName', name);
  await page.selectOption('#fApp', app);
  await page.fill('#fKm', km === undefined ? '' : String(km));
  await page.fill('#fOrt', ort || '');
  await page.click('#fSenden');
  await page.waitForFunction((n) => document.getElementById('koerper').textContent.includes(n), name);
};
await eintragen('Mira', 'hinge', undefined, 'Leipzig');
await eintragen('Anna', 'tinder', 4);
await eintragen('Nele', 'bumble');

const namen = () => page.$$eval('#koerper tr td:nth-child(2) .name', (z) => z.map((x) => x.textContent.trim()));
check(JSON.stringify(await namen()) === JSON.stringify(['Anna', 'Mira', 'Nele']),
  'sortiert wie die modulare Fassung: eingetragen, gerechnet, unbekannt');

// --- 4. Neustart ------------------------------------------------------
await page.reload({ waitUntil: 'networkidle' });
check((await namen()).length === 3, 'nach dem Neuladen stehen die Zeilen wieder da');
check((await page.textContent('#heimStand')).includes('Berlin'), 'und der Standort auch');

// --- 5. Nichts von aussen --------------------------------------------
// Eine Datei, die offline aufgerufen wird und dabei ins Netz greift, waere
// genau dann kaputt, wenn man sie braucht. Geprueft wird das ueber die
// fehlgeschlagenen Anfragen weiter oben – hier nur noch die Bilanz.
check(errs.length === 0, `keine Fehler und keine ins Leere laufenden Verweise${errs.length ? ': ' + errs.join(' | ') : ''}`);

await ctx.close();
console.log(fails ? `\n${fails} Pruefung(en) fehlgeschlagen.` : '\nAlles in Ordnung.');
