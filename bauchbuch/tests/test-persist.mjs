/*
 * Was eingetragen wurde, muss dableiben – auch in der Ein-Datei-Fassung.
 *
 * Geprüft wird dist/bauchbuch.html, direkt vom Dateisystem geöffnet, mit einem
 * bleibenden Browserprofil: genau die Lage, in der jemand die Datei geschickt
 * bekommt, sie auf den Startbildschirm legt und darin sein Tagebuch führt. Hier
 * gibt es keinen Server, der etwas retten könnte – geht der Speicher verloren,
 * ist das Tagebuch weg.
 *
 * Drei Stufen, weil sie Verschiedenes treffen können: Neuladen der Seite,
 * Schließen und Neuöffnen des Tabs, und zuletzt der Blick darauf, ob die App
 * ohne Not vor dem Speichern warnt.
 */
import { chromium } from 'playwright';
import { rmSync } from 'node:fs';
import { EINZEL, KEY, HANDY, profil, pruefer } from './umgebung.mjs';

const { check, ende } = pruefer();

// Frisches Profil: ein Rest aus dem letzten Lauf hätte die Einträge schon da.
const ORT = profil('persist');
rmSync(ORT, { recursive: true, force: true });
const ctx = await chromium.launchPersistentContext(ORT, { viewport: HANDY });
let page = ctx.pages()[0] || await ctx.newPage();
const fehler = [];
page.on('pageerror', (e) => fehler.push(`PAGEERROR: ${e.message}`));

await page.goto(EINZEL, { waitUntil: 'networkidle' });
check(await page.locator('.willkommen').count() === 1, 'die Einzeldatei startet mit der Begrüßung');
check(
  await page.evaluate(() => document.querySelectorAll('link[href^="css/"], script[src^="js/"]').length) === 0,
  'sie lädt nichts nach – kein Verweis auf css/ oder js/',
);
await page.locator('[data-act="los"]').click();
await page.waitForTimeout(200);

await page.locator('[data-act="neu"][data-art="essen"]').click();
await page.waitForTimeout(150);
await page.locator('#bogenWas').fill('Kartoffelsuppe');
await page.locator('.marke[data-id="zwiebel"]').click();
await page.locator('[data-act="bogen-speichern"]').click();
await page.waitForTimeout(250);
check(await page.locator('.strang-zeile').count() === 1, 'der Eintrag steht da');

/* --- Neuladen --- */
await page.reload({ waitUntil: 'networkidle' });
check(await page.locator('.strang-zeile').count() === 1, 'er überlebt das Neuladen');
check(
  (await page.locator('.strang-zeile').first().textContent()).includes('Kartoffelsuppe'),
  'und zwar mit seinem Text',
);

/* --- Tab schließen und neu öffnen: die App wurde neu gestartet --- */
await page.close();
page = await ctx.newPage();
page.on('pageerror', (e) => fehler.push(`PAGEERROR: ${e.message}`));
await page.goto(EINZEL, { waitUntil: 'networkidle' });
check(await page.locator('.strang-zeile').count() === 1, 'er überlebt den Neustart');
check(
  (await page.locator('.strang-zeile').first().textContent()).includes('Zwiebel'),
  'auch die angekreuzte Marke',
);
check(await page.locator('.willkommen').count() === 0, 'die Begrüßung kommt nicht wieder');

/* --- Kein Fehlalarm --- */
// Der Warnhinweis gehört Fällen, in denen wirklich nicht gespeichert werden
// kann. Erscheint er hier, hält die App ihr eigenes Speichern für gescheitert.
check(await page.locator('.karte.warn').count() === 0, 'kein Warnhinweis, obwohl gespeichert wurde');

/* --- Der Speicher liegt da, wo er hingehört --- */
const roh = await page.evaluate((k) => localStorage.getItem(k), KEY);
check(!!roh, `alles steht unter ${KEY}`);
const gelesen = JSON.parse(roh);
check(gelesen.eintraege.length === 1, 'genau ein Eintrag im Speicher');
check(gelesen.eintraege[0].was === 'Kartoffelsuppe', 'und er steht dort im Klartext, lesbar ohne diese App');

check(fehler.length === 0, `keine Fehler${fehler.length ? `: ${fehler.join(' | ')}` : ''}`);
await ctx.close();
ende();
