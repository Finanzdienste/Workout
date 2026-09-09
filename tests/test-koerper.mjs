/*
 * Das Körpergewicht – eine Zahl, ein Feld, und drei Stellen, an denen sie NICHT
 * landen darf.
 *
 * Die App kannte es nicht, und im Kaloriendefizit ist es genau die Zahl, an der
 * sich entscheidet, ob ein Hantelgewicht, das sich hält, ein Erfolg ist oder
 * Stillstand. Dazu kommt: Bei Klimmzügen steht im Feld 0, und gehoben werden
 * über achtzig Kilo – ohne das Körpergewicht kann die App das nicht sagen.
 *
 * Der gefährliche Teil ist nicht das Eintragen, sondern das Verrechnen. Deshalb
 * prüft dieser Lauf vor allem, wo es sich NICHT auswirkt:
 *
 *   Volumen        js/bilanz.js rechnet kg × Wiederholungen. Klimmzüge mit
 *                  82 kg statt 0 verdreifachten die Zahl über Nacht.
 *   Tonnage        Daran misst js/stufen.js den Stufenaufstieg – der Nutzer
 *                  wäre binnen Tagen „Fortgeschritten", ohne mehr zu tun.
 *   Rückkanal      Die persönlichste Zahl in dieser App. Sie geht nirgendwohin.
 *
 * Und einer, der beim Bauen fast durchgerutscht wäre: Eine importierte Sicherung
 * mit `koerper: [{on:'…', kg:null}]` kommt durch die Typprüfung des Imports
 * (die vergleicht nur die Form, nie die Elemente). Die Kurve ruft darauf
 * toFixed – ein TypeError, der die ganze Statistik schwarz macht.
 */
import { chromium } from 'playwright';
import { URL } from './umgebung.mjs';

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 414, height: 896 } });
const gesendet = [];
await ctx.route('**/rest/v1/**', (r) => {
  gesendet.push(r.request().url() + ' ' + (r.request().postData() || ''));
  r.fulfill({ status: 204, body: '' });
});
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message));
let fails = 0;
const check = (c, m) => { console.log(`${c ? 'OK  ' : 'FAIL'} ${m}`); if (!c) { fails++; process.exitCode = 1; } };

await page.goto(URL, { waitUntil: 'networkidle' });

// --- 1. Eintragen: ein Wert je Tag ------------------------------------
const eingetragen = await page.evaluate(async () => {
  const store = await import('./js/store.js');
  store.setKoerper(83.1, '2026-08-01');
  store.setKoerper(82.4, '2026-09-01');
  store.setKoerper(81.9, '2026-09-01');            // derselbe Tag, ersetzt
  store.setKoerper(999, '2026-09-02');             // unsinnig? setKoerper nimmt es
  store.setKoerper(null, '2026-09-02');            // …und hier wieder weg
  return { liste: store.koerperListe(), jetzt: store.koerperJetzt() };
});
console.log('     eingetragen:', JSON.stringify(eingetragen.liste));
check(eingetragen.liste.length === 2, `zwei Tage, nicht drei (${eingetragen.liste.length})`);
check(eingetragen.jetzt && eingetragen.jetzt.kg === 81.9,
  'der zweite Wert desselben Tages ersetzt den ersten');
check(eingetragen.liste[0].on < eingetragen.liste[1].on, 'aufsteigend sortiert');

// --- 2. Kaputte Einträge machen die Statistik nicht schwarz ------------
const kaputt = await page.evaluate(async () => {
  const store = await import('./js/store.js');
  // Genau das, was eine fremde oder alte Sicherung mitbringen kann: Der Import
  // prüft nur, ob es ein Array ist – nie, was drinsteht.
  store.setSetting('koerper', [
    { on: '2026-08-01', kg: 83.1 }, { on: '2026-08-08', kg: null },
    { on: '2026-08-15' }, null, { kg: 80 }, { on: '2026-08-22', kg: 82 },
  ]);
  store.setSetting('greeted', true);
  store.setSetting('name', 'T');
  store.setSetting('tab', 'stats');
  return store.koerperListe().length;
});
check(kaputt === 2, `von sechs Einträgen bleiben die zwei brauchbaren (${kaputt})`);
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(600);
const statsText = (await page.locator('#view').textContent()).replace(/\s+/g, ' ');
check(errs.length === 0,
  `und die Statistik zeichnet ohne Fehler${errs.length ? ': ' + errs[0] : ''}`);
check(/Dein Gewicht/.test(statsText), 'der Verlauf steht da');

// --- 3. Es geht in keine Volumenrechnung ------------------------------
const rechnungen = await page.evaluate(async () => {
  const store = await import('./js/store.js');
  const { lebenStats } = await import('./js/bilanz.js');
  const { PLAN } = await import('./js/data.js');
  const w = PLAN[0];
  const id = w.ex[0].id;
  store.setSetting('log', { [w.n]: { mode: 'db', startedOn: '2026-09-01',
    db: { [id]: [{ w: '20', done: true }, { w: '20', done: true }] } } });
  const ohne = lebenStats().volumen;
  store.setKoerper(82, '2026-09-01');
  const mit = lebenStats().volumen;
  return { ohne, mit };
});
console.log('     Volumen ohne/mit Körpergewicht:', JSON.stringify(rechnungen));
check(rechnungen.ohne === rechnungen.mit,
  `das Volumen ändert sich nicht (${rechnungen.ohne} → ${rechnungen.mit}) – sonst wäre der Stufenaufstieg gekauft`);

// --- 4. Es verlässt das Gerät nicht -----------------------------------
const raus = gesendet.join(' | ');
console.log(`     Netzaufrufe: ${gesendet.length}`);
check(!/koerper/i.test(raus),
  'im Rückkanal steht kein Körpergewicht – das ist die persönlichste Zahl hier');
// Am Quelltext und nicht an einem Aufruf: standZeile() braucht einen Zustand,
// und ein Aufruf ohne den liefert ein leeres Objekt – eine Prüfung, die immer
// gilt, prüft nichts. Der Rückkanal zählt seine Felder einzeln auf; wenn dort
// nirgends „koerper" steht, kann auch nichts davon hinausgehen.
const quelle = await (await import('node:fs/promises'))
  .readFile(new global.URL('../js/telemetry.js', import.meta.url), 'utf8');
const treffer = quelle.split('\n').filter((z) => /koerper/i.test(z));
check(treffer.length === 0,
  `js/telemetry.js erwähnt das Körpergewicht mit keinem Wort${treffer.length ? ': ' + treffer[0].trim() : ''}`);

// --- 5. Aber in die Sicherung ----------------------------------------
const sicherung = await page.evaluate(async () => {
  window.__geteilt = null;
  navigator.canShare = () => true;
  navigator.share = async (d) => { window.__geteilt = d; };
  const store = await import('./js/store.js');
  store.setSetting('tab', 'settings');
  return null;
});
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(500);
const inhalt = await page.evaluate(async () => {
  window.__geteilt = null;
  navigator.canShare = () => true;
  navigator.share = async (d) => { window.__geteilt = d; };
  document.querySelector('[data-act="backup-teilen"]').click();
  await new Promise((ok) => setTimeout(ok, 400));
  const d = window.__geteilt;
  return d && d.files && d.files[0] ? JSON.parse(await d.files[0].text()) : null;
});
check(inhalt && Array.isArray(inhalt.koerper),
  'in der Sicherung steht es – ein halbes Jahr Wiegen soll ein Handywechsel nicht kosten');
check(inhalt && typeof inhalt.steigerungNein === 'object' && inhalt.steigerungNein !== null,
  'und die abgelehnten Steigerungen auch – sonst käme nach einem Umzug alles wieder hoch');
check(inhalt && !('adminPass' in inhalt),
  'das Betreiber-Passwort weiterhin nicht');

// --- 6. Die Eingabe unter Mehr ----------------------------------------
const feld = await page.evaluate(async () => {
  const el = document.querySelector('[data-act="koerper-input"]');
  if (!el) return null;
  el.value = '80,5';
  el.dispatchEvent(new Event('input', { bubbles: true }));
  await new Promise((ok) => setTimeout(ok, 250));
  const store = await import('./js/store.js');
  const nach = store.koerperJetzt();
  // Leer räumen löscht den heutigen Eintrag wieder – ohne das gäbe es keinen
  // Weg zurück, weil bei jedem Zeichen gespeichert wird.
  el.value = '';
  el.dispatchEvent(new Event('input', { bubbles: true }));
  await new Promise((ok) => setTimeout(ok, 250));
  const heute = new Date().toISOString().slice(0, 10);
  return { nach, danach: store.koerperListe().some((x) => x.on === heute) };
});
console.log('     Feld:', JSON.stringify(feld));
check(feld && feld.nach && feld.nach.kg === 80.5,
  `das Feld schreibt mit Komma (${feld && feld.nach && feld.nach.kg})`);
check(feld && feld.danach === false,
  'und leer geräumt ist der heutige Eintrag wieder weg');

check(errs.length === 0, `keine Fehler${errs.length ? ': ' + errs.slice(0, 2).join(' | ') : ''}`);
await browser.close();
console.log(`\n${fails ? fails + ' FEHLER' : 'alle Prüfungen bestanden'}`);
