/*
 * Die Rechenschicht, ohne Anzeige.
 *
 * Hier steht das, was die App über jemandes Körper *behauptet*. Deshalb wird
 * es an ausgedachten Verläufen nachgerechnet, bei denen man das richtige
 * Ergebnis vorher kennt – und nicht daran, ob im Browser etwas Grünes steht.
 *
 * Der wichtigste Fall ist der letzte: Bei zu wenigen Eintragungen muss die
 * Auswertung schweigen. Eine App, die aus drei Mahlzeiten eine Regel macht,
 * bringt jemanden dazu, sein Essen umzustellen, ohne dass es einen Grund gibt.
 */
import { chromium } from 'playwright';
import { URL, HANDY, pruefer } from './umgebung.mjs';

const { check, ende } = pruefer();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: HANDY });
const fehler = [];
page.on('pageerror', (e) => fehler.push(`PAGEERROR: ${e.message}`));
await page.goto(URL, { waitUntil: 'networkidle' });

/** Die Rechenschicht im Browser aufrufen und das Ergebnis zurückholen. */
const rechne = (name, ...args) => page.evaluate(
  ([n, a]) => import('./js/auswertung.js').then((m) => m[n](...a)),
  [name, args],
);

const essen = (am, um, tags, portion = 'normal') => ({ id: `m${am}${um}`, am, um, art: 'essen', was: 'Essen', tags, portion });
const weh = (am, um, staerke) => ({ id: `b${am}${um}`, am, um, art: 'beschwerde', staerke, arten: ['brennen'] });

/* ---------- merkmale() ---------- */

check(
  (await rechne('merkmale', essen('2026-01-05', '12:00', ['kaffee']))).join() === 'kaffee',
  'merkmale: das Angekreuzte kommt zurück',
);
check(
  (await rechne('merkmale', essen('2026-01-05', '12:00', ['kaffee'], 'gross'))).includes('gross'),
  'merkmale: eine große Portion zählt als eigener Auslöser',
);
check(
  (await rechne('merkmale', essen('2026-01-05', '21:30', []))).includes('spaet'),
  'merkmale: nach 20 Uhr gilt als spät gegessen',
);
check(
  !(await rechne('merkmale', essen('2026-01-05', '19:59', []))).includes('spaet'),
  'merkmale: um 19:59 noch nicht',
);
check(
  (await rechne('merkmale', weh('2026-01-05', '12:00', 5))).length === 0,
  'merkmale: eine Beschwerde hat keine',
);

/* ---------- folgende() und wertNach() ---------- */

const abend = essen('2026-01-05', '22:00', ['fett']);
const nachts = [abend, weh('2026-01-06', '01:00', 7)];
check(
  (await rechne('wertNach', nachts, abend, 4)) === 7,
  'Fenster: eine Beschwerde um 1 Uhr gehört zum Essen um 22 Uhr am Vortag',
);
check(
  (await rechne('wertNach', nachts, abend, 2)) === 0,
  'Fenster: bei zwei Stunden Fenster nicht mehr',
);
const gleichzeitig = [abend, weh('2026-01-05', '22:00', 8)];
check(
  (await rechne('wertNach', gleichzeitig, abend, 4)) === 0,
  'Fenster: was zur selben Minute eingetragen ist, war schon da',
);
const vorher = [abend, weh('2026-01-05', '18:00', 8)];
check(
  (await rechne('wertNach', vorher, abend, 4)) === 0,
  'Fenster: was vorher war, zählt nicht',
);
const zwei = [abend, weh('2026-01-06', '00:30', 3), weh('2026-01-06', '01:30', 9)];
check(
  (await rechne('wertNach', zwei, abend, 4)) === 9,
  'Fenster: von mehreren zählt die stärkste',
);

/* ---------- ausloeserBilanz(): ein gepflanzter Zusammenhang ---------- */

/**
 * Zwanzig Tage, zwei Mahlzeiten am Tag. Die mittags mit Kaffee tut weh (7),
 * die abends ohne nicht (0). Ein Ergebnis, das man ausrechnen kann, bevor man
 * die App fragt.
 */
const verlauf = [];
for (let t = 1; t <= 20; t++) {
  const am = `2026-02-${String(t).padStart(2, '0')}`;
  verlauf.push(essen(am, '12:00', ['kaffee']));
  verlauf.push(weh(am, '13:30', 7));
  verlauf.push(essen(am, '18:00', ['milch']));
}
const bilanz = await rechne('ausloeserBilanz', verlauf, { fenster: 4, mindestFaelle: 5 });
const kaffee = bilanz.find((b) => b.id === 'kaffee');
const milch = bilanz.find((b) => b.id === 'milch');

check(!!kaffee && !!milch, 'Bilanz: beide vorkommenden Auslöser stehen drin');
check(kaffee.faelle === 20 && kaffee.gegenFaelle === 20, `Bilanz: 20 Fälle mit und 20 ohne Kaffee (${kaffee.faelle}/${kaffee.gegenFaelle})`);
check(kaffee.schnittMit === 7, `Bilanz: nach Kaffee im Mittel 7 (${kaffee.schnittMit})`);
check(kaffee.schnittOhne === 0, `Bilanz: sonst 0 (${kaffee.schnittOhne})`);
check(kaffee.differenz === 7, 'Bilanz: die Differenz ist die Differenz');
check(bilanz[0].id === 'kaffee', 'Bilanz: das Auffälligste steht oben');
check(milch.differenz === -7, `Bilanz: die Gegenprobe fällt nach unten (${milch.differenz})`);
check(kaffee.quoteMit === 1 && kaffee.quoteOhne === 0, 'Bilanz: die Quoten stimmen');
check(kaffee.genug === true, 'Bilanz: 20 Fälle reichen');

const urteil = await rechne('einstufung', kaffee);
check(urteil === 'auffaellig', `Einstufung: 7 Punkte Unterschied sind auffällig (${urteil})`);
check(await rechne('einstufung', milch) === 'unauffaellig', 'Einstufung: die Gegenprobe ist unauffällig');

/* ---------- Der wichtigste Fall: zu wenig ist zu wenig ---------- */

const wenig = [
  essen('2026-03-01', '12:00', ['alkohol']), weh('2026-03-01', '13:00', 9),
  essen('2026-03-02', '12:00', ['alkohol']), weh('2026-03-02', '13:00', 9),
  essen('2026-03-03', '12:00', []),
];
const knapp = await rechne('ausloeserBilanz', wenig, { fenster: 4, mindestFaelle: 5 });
const alkohol = knapp.find((b) => b.id === 'alkohol');
check(alkohol.genug === false, 'Zu wenig: zwei Fälle reichen nicht');
check(alkohol.fehlt === 3, `Zu wenig: es fehlen noch 3 (${alkohol.fehlt})`);
check(
  await rechne('einstufung', alkohol) === 'zuwenig',
  'Zu wenig: die Einstufung sagt das auch, obwohl 9 gegen 0 stünde',
);

/* ---------- Tageswert: Lücke ist nicht Wohlbefinden ---------- */

const tage = [essen('2026-04-01', '12:00', []), weh('2026-04-01', '13:00', 4)];
const eins = await rechne('tagesWert', tage, '2026-04-01', {});
const zwei2 = await rechne('tagesWert', tage, '2026-04-02', {});
check(eins.notiert === true && eins.wert === 4, 'Tageswert: eingetragener Tag mit Stärke 4');
check(zwei2.notiert === false && zwei2.wert === 0, 'Tageswert: der Tag ohne Eintrag gilt als nicht notiert');

const nurStimmung = await rechne('tagesWert', tage, '2026-04-03', { '2026-04-03': { stress: 2 } });
check(nurStimmung.notiert === true, 'Tageswert: eine Tagesangabe allein zählt schon als notiert');

const reihe = await rechne('verlaufReihe', tage, '2026-04-01', '2026-04-05', {});
check(reihe.length === 5, `Verlauf: fünf Tage, lückenlos (${reihe.length})`);
check(reihe.filter((t) => t.notiert).length === 1, 'Verlauf: nur einer davon ist notiert');

/* ---------- Serie ohne Beschwerden ---------- */

const frei = [
  essen('2026-05-01', '12:00', []), weh('2026-05-01', '13:00', 6),
  essen('2026-05-02', '12:00', []),
  // 3. Mai: nichts eingetragen – das darf die Serie weder verlängern
  // noch beenden.
  essen('2026-05-04', '12:00', []),
];
check(
  await rechne('serieOhne', frei, {}, '2026-05-04') === 2,
  'Serie: zwei freie Tage, die Lücke dazwischen zählt nicht mit',
);

/* ---------- Gesamtzahlen ---------- */

const z = await rechne('gesamtZahlen', verlauf, {}, '2026-02-01', '2026-02-20');
check(z.notierteTage === 20, `Gesamt: 20 notierte Tage (${z.notierteTage})`);
check(z.tageMitBeschwerden === 20 && z.anteil === 1, 'Gesamt: alle 20 mit Beschwerden');
check(z.mahlzeiten === 40, `Gesamt: 40 Mahlzeiten (${z.mahlzeiten})`);
check(z.hoechster === 7, 'Gesamt: der höchste Wert ist 7');

/* ---------- Tageszeit und Art ---------- */

const zeiten = await rechne('nachTageszeit', verlauf);
check(zeiten.length === 1 && zeiten[0].id === 'mittag', 'Tageszeit: alles fällt auf mittags');
const arten = await rechne('nachArt', verlauf);
check(arten.length === 1 && arten[0].anzahl === 20, 'Art: 20-mal Brennen');

check(fehler.length === 0, `keine Fehler${fehler.length ? `: ${fehler.join(' | ')}` : ''}`);
await browser.close();
ende();
