/*
 * Der Mitleser: findet er Menschen, und lässt er die Seite heil?
 *
 * Zwei Fragen, und die zweite ist die wichtigere. Das Skript hängt sich vor
 * `fetch` und `XMLHttpRequest` einer fremden Seite. Der Körper einer Antwort
 * lässt sich genau einmal auslesen – wer das ohne `clone()` tut, nimmt ihn der
 * Seite weg, und die Match-Liste bleibt leer. Ein Werkzeug, das die Seite
 * kaputtmacht, die es beobachtet, ist keins, und deshalb steht diese Prüfung
 * hier vor allen anderen.
 *
 * Die erste Frage wird an Antworten geprüft, die so gebaut sind wie die echten:
 * die Person eine Ebene unter dem Match, das Datum am Match und nicht an der
 * Person, die Entfernung erst im Profil und in Meilen. Dazu zwei Dinge, die
 * *keine* Person sind, obwohl „name" drinsteht – ein Filter und eine
 * Werbefläche. Was die Ernte nicht unterscheiden kann, landet sonst als
 * „Entfernungsfilter, 50 km" in einer Tabelle mit Menschen.
 *
 * Kein echter Dienst wird dabei aufgerufen: tinder.com wird im Testbrowser
 * abgefangen und aus dieser Datei beantwortet.
 */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { ROOT, MATCHES } from './umgebung.mjs';

const SKRIPT = readFileSync(path.join(ROOT, 'matches', 'mitlesen.user.js'), 'utf8');

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1100, height: 900 } });
const errs = [];
let fails = 0;
const check = (c, m) => { console.log(`${c ? 'OK  ' : 'FAIL'} ${m}`); if (!c) { fails++; process.exitCode = 1; } };

// --- Der nachgebaute Dienst -------------------------------------------
const MATCHLISTE = {
  data: {
    matches: [
      {
        _id: 'm1',
        created_date: '2026-08-30T10:00:00.000Z',
        person: { _id: 'u1', name: 'Anna', photos: [{ id: 'p1' }] },
      },
      {
        _id: 'm2',
        created_date: '2026-08-22T10:00:00.000Z',
        person: { _id: 'u2', name: 'Mira', photos: [{ id: 'p2' }] },
      },
      // Weder Filter noch Werbung sind Menschen, auch wenn sie einen Namen haben.
      { _id: 'f1', name: 'Entfernungsfilter', value: 50 },
      { _id: 'ad1', name: 'Boost kaufen', sponsored: true },
    ],
  },
};
// Die Entfernung schickt Tinder erst mit dem Profil – und in Meilen.
const PROFIL = { results: { _id: 'u1', name: 'Anna', distance_mi: 2, photos: [{ id: 'p1' }] } };
// Ein zweiter Aufbau, wie ihn andere Dienste liefern: Entfernung als Text.
const ANDERE = {
  body: [{ users: [{ user_id: 'b1', name: 'Lena', distance_long: '3 km entfernt', photos: [{}] }] }],
};

await ctx.route('https://tinder.com/**', (route) => {
  const url = route.request().url();
  const json = (o) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(o) });
  if (url.includes('/v2/matches')) return json(MATCHLISTE);
  if (url.includes('/user/u1')) return json(PROFIL);
  if (url.includes('/andere')) return json(ANDERE);
  return route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>t</title><body>' });
});

await ctx.addInitScript(SKRIPT);
const page = await ctx.newPage();
page.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message));
await page.goto('https://tinder.com/app/matches', { waitUntil: 'domcontentloaded' });

// --- 1. Die Seite bekommt ihre Antwort ungeschmälert -------------------
const durchgereicht = await page.evaluate(async () => {
  const antwort = await fetch('https://tinder.com/v2/matches?count=60');
  const daten = await antwort.json();
  return daten.data.matches.length;
});
check(durchgereicht === 4,
  'die Seite liest ihre eigene Antwort weiterhin vollständig – ohne clone() wäre sie hier leer');

// --- 2. Gefunden wird, was ein Mensch ist ------------------------------
await page.waitForFunction(() => window.__matchesErnte && window.__matchesErnte.leute.size >= 2);
const nachErsterListe = await page.evaluate(() => [...window.__matchesErnte.leute.values()]);
const namen = nachErsterListe.map((p) => p.name).sort();
console.log('     gefunden:', JSON.stringify(namen));
check(JSON.stringify(namen) === JSON.stringify(['Anna', 'Mira']),
  'die beiden Personen aus der Liste stehen drin');
check(!namen.includes('Entfernungsfilter') && !namen.includes('Boost kaufen'),
  'Filter und Werbefläche nicht – beide haben einen Namen und eine Kennung, aber keine Bilder');

const anna = nachErsterListe.find((p) => p.name === 'Anna');
check(anna.matchAm === '2026-08-30',
  `das Datum steht am Match, nicht an der Person, und reicht trotzdem durch (${anna.matchAm})`);
check(anna.km === null, 'aus der Liste allein gibt es noch keine Entfernung – so schickt der Dienst es');

// --- 3. Das Profil ergänzt die Entfernung, in Kilometern ---------------
await page.evaluate(() => fetch('https://tinder.com/user/u1').then((r) => r.json()));
await page.waitForFunction(() => [...window.__matchesErnte.leute.values()].some((p) => p.km !== null));
const annaJetzt = await page.evaluate(() => [...window.__matchesErnte.leute.values()].find((p) => p.name === 'Anna'));
check(Math.abs(annaJetzt.km - 3.218688) < 0.001,
  `2 Meilen werden zu ${annaJetzt.km.toFixed(2)} km – die Zahl aus dem Profil ist keine Kilometerzahl`);
check(annaJetzt.matchAm === '2026-08-30',
  'und das schon bekannte Datum überlebt die Ergänzung');
check((await page.evaluate(() => window.__matchesErnte.leute.size)) === 2,
  'dieselbe Person aus zwei Antworten bleibt eine Zeile');

// --- 4. Entfernung als Text, über XMLHttpRequest -----------------------
await page.evaluate(() => new Promise((fertig) => {
  const x = new XMLHttpRequest();
  x.open('GET', 'https://tinder.com/andere');
  x.onload = fertig;
  x.send();
}));
await page.waitForFunction(() => [...window.__matchesErnte.leute.values()].some((p) => p.name === 'Lena'));
const lena = await page.evaluate(() => [...window.__matchesErnte.leute.values()].find((p) => p.name === 'Lena'));
check(lena.km === 3, `„3 km entfernt" wird zu 3 (${lena.km}) – auch über XMLHttpRequest gelesen`);

// --- 5. Der Kasten zeigt, was er hat ----------------------------------
const anzeige = await page.textContent('body');
check(/3 gefunden · 2 mit km/.test(anzeige),
  'der Kasten nennt beide Zahlen: gefunden und davon mit Entfernung');

// --- 6. Und die Tabelle liest die Datei ------------------------------
const datei = await page.evaluate(() => JSON.stringify({
  format: 'matches-mitlesen/1',
  app: 'tinder',
  erzeugt: new Date().toISOString(),
  leute: [...window.__matchesErnte.leute.values()],
}));

const tabelle = await ctx.newPage();
await tabelle.goto(MATCHES, { waitUntil: 'networkidle' });
await tabelle.setInputFiles('#datei', {
  name: 'matches-tinder.json', mimeType: 'application/json', buffer: Buffer.from(datei),
});
await tabelle.waitForFunction(() => document.getElementById('importStand').textContent.includes('neue Zeilen'));
const zeilen = await tabelle.$$eval('#koerper tr td:nth-child(2) .name', (z) => z.map((x) => x.textContent.trim()));
console.log('     in der Tabelle:', JSON.stringify(zeilen));
check(zeilen.length === 3, 'alle drei Zeilen kommen in der Tabelle an');
check(zeilen[0] === 'Lena' && zeilen[1] === 'Anna',
  'und stehen sofort nach Entfernung sortiert da – 3 km vor 3,2 km, ohne dass jemand etwas eingetippt hat');
check((await tabelle.textContent('#importStand')).includes('2 mit Entfernung'),
  'der Hinweis sagt, für wie viele eine Entfernung dabei war');

check(errs.length === 0, `keine Fehler auf der Seite${errs.length ? ': ' + errs.join(' | ') : ''}`);
await browser.close();
console.log(fails ? `\n${fails} Prüfung(en) fehlgeschlagen.` : '\nAlles in Ordnung.');
