/*
 * Die Erfahrungsstufe wählt jetzt auch die Übung, nicht nur Gewicht und Sätze.
 *
 *     „Beim hängenden Beinheben merk ich eigentlich nur die Arme und muss nach
 *      zwei Wiederholungen abbrechen … Dann brauch ich als Anfänger halt einfach
 *      ne andere Übung und zwar anscheinend die Boden Variante. Das soll nicht
 *      nur im Text stehen sondern wenn man Anfänger ausgewählt hat soll auch nur
 *      die Boden Variante kommen."
 *
 * Der Rat stand seit jeher im Katalogtext. Ein Rat, den man erst aufklappen
 * muss, ändert aber nichts an dem, was auf dem Bildschirm steht – und zwei
 * Wiederholungen an der Stange sind kein halbes Training, sondern keins.
 *
 * Vier Dinge müssen dafür zugleich stimmen, und der dritte ist der, an dem so
 * etwas sonst schiefgeht:
 *
 *   1. Auf der Anfängerstufe steht die Bodenfassung im Plan, sonst die
 *      hängende. Und zwar überall, wo die App rechnet – nicht nur in der
 *      Anzeige.
 *   2. Der Tausch ist sichtbar. Eine App, die stillschweigend etwas anderes
 *      zeigt, als sie sagt, ist genau das, was js/muster.js im Kopf ausschließt.
 *   3. Die Muskelanteile sind identisch. Sonst verschöbe der Tausch die
 *      Wochenziele für jeden Anfänger, ohne dass es jemand merkt – die
 *      Wochenrechnung hängt an den Anteilen der Übungen, die wirklich dastehen.
 *   4. Die Ersatzübung ist vollständig: eigenes Bewegungsbild, ein Weg nach
 *      unten im Text, und sie ist dem Verletzungsfilter bekannt.
 */
import { chromium } from 'playwright';
import { URL } from './umgebung.mjs';

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 414, height: 896 } });
await ctx.route('**/rest/v1/**', (r) => r.fulfill({ status: 204, body: '' }));
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message));
let fails = 0;
const check = (c, m) => { console.log(`${c ? 'OK  ' : 'FAIL'} ${m}`); if (!c) { fails++; process.exitCode = 1; } };

await page.goto(URL, { waitUntil: 'networkidle' });

// --- 1. Alle Paare aus dem Katalog --------------------------------------
const paare = await page.evaluate(async () => {
  const { EXERCISES } = await import('./js/data.js');
  const byId = new Map(EXERCISES.map((e) => [e.id, e]));
  return EXERCISES.filter((e) => e.anfaenger).map((e) => {
    const ziel = byId.get(e.anfaenger);
    return {
      von: e.id, nach: e.anfaenger, gibtEs: !!ziel,
      anteileGleich: ziel
        ? JSON.stringify(e.db.shares) === JSON.stringify(ziel.db.shares)
          && JSON.stringify(e.bw.shares) === JSON.stringify(ziel.bw.shares)
        : false,
      musterEigen: ziel ? ziel.db.pattern !== e.db.pattern : false,
      zielName: ziel && ziel.db.name,
    };
  });
});
console.log('     Paare:', JSON.stringify(paare));
check(paare.length >= 1, `es gibt mindestens ein Paar (${paare.length})`);
paare.forEach((p) => {
  check(p.gibtEs, `${p.nach} steht im Katalog`);
  check(p.anteileGleich,
    `${p.von} → ${p.nach}: dieselben Muskelanteile – sonst verschöbe der Tausch die Wochenziele`);
  check(p.musterEigen,
    `${p.nach} hat ein eigenes Bewegungsbild (${p.zielName}) – es ist eine andere Bewegung`);
});

// --- 2. Was im Plan steht, hängt an der Stufe ---------------------------
const imPlan = (stufe) => page.evaluate(async (lvl) => {
  const store = await import('./js/store.js');
  store.setSetting('level', lvl);
  const { PLAN } = await import('./js/data.js');
  const { exOf } = await import('./js/plan.js');
  const ids = new Set();
  PLAN.forEach((w) => exOf(w, 'db').forEach((it) => ids.add(it.id)));
  return [...ids];
}, stufe);

const alsGeuebt = await imPlan('geuebt');
const alsAnfaenger = await imPlan('anfaenger');
console.log('     hängend/liegend als geübt:',
  alsGeuebt.includes('haengendes-knieheben'), '/', alsGeuebt.includes('liegendes-knieheben'));
console.log('     hängend/liegend als Anfänger:',
  alsAnfaenger.includes('haengendes-knieheben'), '/', alsAnfaenger.includes('liegendes-knieheben'));
check(alsGeuebt.includes('haengendes-knieheben') && !alsGeuebt.includes('liegendes-knieheben'),
  'als Geübter steht die hängende Fassung im Plan und die liegende nirgends');
check(alsAnfaenger.includes('liegendes-knieheben') && !alsAnfaenger.includes('haengendes-knieheben'),
  'als Anfänger genau umgekehrt – nicht beide, nicht nur im Text');

// --- 3. Und zwar überall, wo gerechnet wird -----------------------------
//
// Der Tausch sitzt in exBasis(), also vor allem anderen. Das ist der Punkt:
// Protokoll, Fortschritt, Wochenvolumen und Zeitschätzung sehen dann von selbst
// die richtige Übung. Ein Tausch erst in der Anzeige hätte das Gegenteil
// bewirkt – abgehakt worden wäre unter dem alten Schlüssel.
const durchgereicht = await page.evaluate(async () => {
  const store = await import('./js/store.js');
  const { PLAN } = await import('./js/data.js');
  const { workoutByNo, exOf, resolve } = await import('./js/plan.js');
  store.setSetting('level', 'anfaenger');
  const w = PLAN.find((x) => x.ex.some((e) => e.id === 'haengendes-knieheben'));
  const items = exOf(w, 'db');
  const it = items.find((x) => x.id === 'liegendes-knieheben');
  const aufgeloest = it ? resolve(it, 'db') : null;
  const ausWorkout = workoutByNo(w.n, 'db').ex.map((x) => x.id);
  return {
    n: w.n,
    imBasis: !!it,
    statt: it && it.statt,
    name: aufgeloest && aufgeloest.name,
    resolveStatt: aufgeloest && aufgeloest.statt,
    ausWorkout: ausWorkout.includes('liegendes-knieheben'),
  };
});
console.log('     durchgereicht:', JSON.stringify(durchgereicht));
check(durchgereicht.imBasis, `exOf() liefert die Bodenfassung (Workout ${durchgereicht.n})`);
check(durchgereicht.statt === 'haengendes-knieheben',
  'und merkt sich, wofür sie eingesprungen ist');
check(durchgereicht.resolveStatt === 'haengendes-knieheben',
  'resolve() reicht das weiter – ohne das könnte die Anzeige es nicht sagen');
check(durchgereicht.ausWorkout, 'workoutByNo() sieht sie ebenfalls');

// --- 4. Und man sieht es ------------------------------------------------
//
// Über die Knöpfe der App und nicht über gesetzten Zustand: Welche Einheit
// gerade gezeigt wird und ob die Fokus- oder die Listenansicht läuft, ist
// Anzeige-Zustand – er übersteht kein Neuladen und lässt sich von außen nicht
// setzen. Die Reihenfolge ist dabei entscheidend: erst zu der Einheit blättern,
// dann starten. Umgekehrt führt „Nächstes" aus dem Training heraus in die
// Übersicht der nächsten Einheit, und dort stehen gar keine Übungskarten.
await page.evaluate(async () => {
  const store = await import('./js/store.js');
  store.setSetting('greeted', true);
  store.setSetting('name', 'T');
  store.setSetting('level', 'anfaenger');
  store.setSetting('tab', 'dashboard');
});
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(400);

const zielN = await page.evaluate(async () => {
  const { PLAN } = await import('./js/data.js');
  return PLAN.find((x) => x.ex.some((e) => e.id === 'haengendes-knieheben')).n;
});
for (let k = 0; k < 20; k++) {
  const kopf = (await page.locator('#view').textContent()).replace(/\s+/g, ' ');
  if (new RegExp(`Workout ${zielN}\\b`).test(kopf)) break;
  await page.locator('[data-act="nav-workout"][data-delta="1"]').first().click();
  await page.waitForTimeout(220);
}
await page.locator('[data-act="start-session"]').first().click();
await page.waitForTimeout(600);
// Die Fokusansicht zeigt immer nur die eine Übung, an der man steht – das
// Knieheben steht hinten. Also in die Liste.
await page.locator('[data-act="focus-list"]').first().click();
await page.waitForTimeout(600);
const text = (await page.locator('#view').textContent()).replace(/\s+/g, ' ');
console.log(`     Workout ${zielN}, Liste:`,
  (/Knieheben[^▼]{0,80}/.exec(text) || ['(nicht gefunden)'])[0].trim());
check(/Knieheben im Liegen/.test(text), 'im Training steht die Bodenfassung');
check(!/Hängendes Knieheben 2 ×|Hängendes Knieheben \d/.test(text),
  'und die hängende nicht als eigene Übung daneben');
// Der Tausch muss sichtbar sein und einen Weg zurück haben. Bis v183 war das
// eine Zeile „Statt Hängendes Knieheben – die Anfängerfassung. Höhere
// Erfahrungsstufe unter Mehr bringt die schwerere zurück." Beides steht
// weiterhin da, nur besser: Die andere Fassung wird beim Namen genannt, und
// der Weg zurück ist ein Knopf an der Übung statt eines Verweises auf eine
// Einstellung, die man gar nicht stellen soll.
check(/Hängendes Knieheben/.test(text),
  'die schwerere Fassung wird beim Namen genannt – ein stiller Tausch wäre keiner');
check(await page.locator('.ex-fassung [data-act="fassung-waehlen"]:not([disabled])').count() >= 1,
  'und der Weg zurück steht als Knopf daneben');

// --- 5. Die Ersatzübung ist dem Verletzungsfilter bekannt ---------------
//
// Sie ist dort nicht nur bekannt, sondern das Ziel: Alle acht Regeln, die das
// hängende Knieheben bisher ersatzlos gestrichen haben, sind Arm-, Hand-,
// Schulter- oder Nackenprobleme – also genau das, was die hängende Fassung
// unmöglich macht und die liegende nicht.
const filter = await page.evaluate(async () => {
  const { INJURIES } = await import('./js/injuries.js');
  const tauschen = INJURIES.filter((i) => (i.swap || {})['haengendes-knieheben'] === 'liegendes-knieheben');
  const meiden = INJURIES.filter((i) => (i.avoid || []).includes('haengendes-knieheben'));
  return { tauschen: tauschen.map((i) => i.id), meiden: meiden.map((i) => i.id) };
});
console.log('     tauschen:', filter.tauschen.length, '· meiden:', filter.meiden.length);
check(filter.tauschen.length === filter.meiden.length && filter.tauschen.length >= 8,
  `jede Regel, die die hängende Fassung meidet, tauscht jetzt auf die liegende `
  + `(${filter.tauschen.length} von ${filter.meiden.length})`);

// --- 6. Und der Wechsel an der Übung selbst -----------------------------
//
//     „Lass machen dass wenn man bei knieheben im Liegen auf + drückt man
//      automatisch zu knieheben an der Stange kommt. Also die Übung sozusagen
//      umgewandelt wird. Genauso natürlich bei minus anders herum"
//
// Die Beziehung gab es schon, anfassbar war sie nicht: Getauscht wurde allein
// über die Erfahrungsstufe unter Mehr – für alle Übungen auf einmal, an einer
// Einstellung, die ausdrücklich keine sein soll. Jetzt stehen dieselben zwei
// Knöpfe an der Übung, an denen sonst die Kilo hängen.
//
// Der Kern dieses Abschnitts ist Punkt drei: Die eigene Wahl muss die Stufe
// schlagen, und zwar in *beide* Richtungen. Ein Schalter, der nur nach unten
// wirkt, wäre auf der Anfängerstufe wirkungslos – also genau dort, wo man ihn
// braucht.
await page.evaluate(async () => {
  const store = await import('./js/store.js');
  store.setSetting('level', 'anfaenger');
  store.setSetting('fassung', {});
});
const wahl = async (ziel) => page.evaluate(async (z) => {
  const store = await import('./js/store.js');
  store.setSetting('fassung', z ? { 'haengendes-knieheben': z } : {});
  const { PLAN } = await import('./js/data.js');
  const { exOf } = await import('./js/plan.js');
  const w = PLAN.find((x) => exOf(x, 'db').some((it) => /knieheben/.test(it.id)));
  const it = exOf(w, 'db').find((x) => /knieheben/.test(x.id));
  return { id: it.id, statt: it.statt || null, warum: it.stattWarum || null };
}, ziel);

const ohneWahl = await wahl(null);
console.log('     ohne Wahl (Anfänger):', JSON.stringify(ohneWahl));
check(ohneWahl.id === 'liegendes-knieheben',
  'ohne eigene Wahl entscheidet weiter die Stufe');

const nachPlus = await wahl('haengendes-knieheben');
console.log('     nach +:', JSON.stringify(nachPlus));
check(nachPlus.id === 'haengendes-knieheben',
  'auf + kommt die hängende Fassung – auch auf der Anfängerstufe');
check(!nachPlus.statt, 'und sie steht als sie selbst da, nicht als Ersatz für etwas');

const nachMinus = await wahl('liegendes-knieheben');
console.log('     nach −:', JSON.stringify(nachMinus));
check(nachMinus.id === 'liegendes-knieheben', 'auf − wieder die liegende');
check(nachMinus.warum === 'fassung',
  `und der Grund ist jetzt die eigene Wahl, nicht die Stufe (${nachMinus.warum})`);

// Dasselbe von oben: Als Geübter muss − ebenso greifen.
const alsGeuebter = await page.evaluate(async () => {
  const store = await import('./js/store.js');
  store.setSetting('level', 'geuebt');
  const { PLAN } = await import('./js/data.js');
  const { exOf } = await import('./js/plan.js');
  const holen = () => {
    const w = PLAN.find((x) => exOf(x, 'db').some((it) => /knieheben/.test(it.id)));
    return exOf(w, 'db').find((x) => /knieheben/.test(x.id)).id;
  };
  store.setSetting('fassung', {});
  const ohne = holen();
  store.setSetting('fassung', { 'haengendes-knieheben': 'liegendes-knieheben' });
  return { ohne, mit: holen() };
});
console.log('     als Geübter:', JSON.stringify(alsGeuebter));
check(alsGeuebter.ohne === 'haengendes-knieheben', 'ein Geübter bekommt sonst die hängende');
check(alsGeuebter.mit === 'liegendes-knieheben',
  'und darf sich trotzdem für die liegende entscheiden');

// Die Knöpfe selbst: einer aktiv, einer gesperrt, und die Zeile sagt, was der
// andere wäre. Ein Knopf, der auf die Fassung umstellt, die schon dasteht,
// verspricht eine Änderung, die nicht kommt.
await page.evaluate(async () => {
  const store = await import('./js/store.js');
  store.setSetting('level', 'anfaenger');
  store.setSetting('fassung', {});
  store.setSetting('tab', 'dashboard');
});
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(400);
await page.locator('[data-act="show-list"]').first().click();
await page.waitForTimeout(400);
const karte = page.locator('.ex').filter({ hasText: 'Knieheben' }).first();
await karte.locator('.ex-head').click();
await page.waitForTimeout(300);
// Gezählt wird *in dieser Karte* und nicht auf der Seite: Seit v188 hat jede
// Übung mit gleichwertigen Alternativen so eine Auswahl, und in dieser Einheit
// sind das vier. Ein ungebundener Selektor zählte neun Knöpfe statt drei.
check(await karte.locator('.ex-fassung').count() === 1, 'die Auswahl steht an der Übung');
// Beim Bauch sind es drei Übungen mit identischen Anteilen. Die gewählte ist
// gesperrt – ein Knopf auf die Übung, die schon dasteht, verspricht eine
// Änderung, die nicht kommt.
const wahlKnoepfe = karte.locator('.ex-fassung [data-act="fassung-waehlen"]');
const namen = await karte.locator('.ex-fassung .fassung-name').allTextContents();
console.log('     zur Wahl:', namen.map((n) => n.trim()).join(' | '));
check(await wahlKnoepfe.count() === 3,
  `alle drei Bauchübungen stehen zur Wahl (${await wahlKnoepfe.count()})`);
check(await karte.locator('.ex-fassung [aria-pressed="true"]').count() === 1,
  'genau eine ist als gewählt ausgewiesen');
check(await karte.locator('.ex-fassung [aria-pressed="true"][disabled]').count() === 1,
  'und die gewählte ist gesperrt');
check(namen.some((n) => /Hängendes Knieheben/.test(n)) && namen.some((n) => /Crunches/.test(n)),
  'die anderen beiden stehen mit Namen daneben');

// Und nach dem Tippen steht wirklich die andere Übung da – mit ihrem eigenen
// Wiederholungsbereich, nicht nur mit einem anderen Namen.
await karte.locator('.ex-fassung [data-v="haengendes-knieheben"]').click();
await page.waitForTimeout(400);
const danach = (await karte.locator('.ex-name').textContent()).trim();
const meta = (await karte.locator('.ex-meta').textContent()).replace(/\s+/g, ' ');
console.log('     nach dem Tippen:', danach, '·', meta.trim());
check(danach === 'Hängendes Knieheben', 'nach + steht die hängende Fassung in der Karte');
check(/8–15/.test(meta) && /Klimmzugstange/.test(meta),
  'samt ihrem eigenen Bereich und ihrem eigenen Gerät');
check(await karte.locator('.ex-fassung [data-v="haengendes-knieheben"][disabled]').count() === 1,
  'und jetzt ist die hängende gesperrt statt der liegenden');

// --- 7. Der Gerätefilter hat Vorrang, und die Zeile weiß das ------------
//
// Gefunden beim Nachsehen, nicht gemeldet – und es war ein echter Fehler der
// ersten Fassung: `statt` schreiben *beide* Filter, die Stufe und der
// Gerätevorrat. Ohne Klimmzugstange steht statt des hängenden Kniehebens die
// Gewichtete Crunches im Plan, und die Fassungszeile ritt auf diesem Ergebnis
// mit: „Leicht · ohne Gerät" unter einer Crunch-Karte, darunter „Schwerer:
// Hängendes Knieheben – dieselbe Bewegung", und ein + das nichts tat, weil
// der Gerätefilter danach läuft und sofort zurücktauscht.
const ohneStange = await page.evaluate(async () => {
  const store = await import('./js/store.js');
  store.setSetting('level', 'geuebt');
  store.setSetting('fassung', { 'haengendes-knieheben': 'haengendes-knieheben' });
  store.setSetting('fehlt', ['stange']);
  store.setSetting('tab', 'dashboard');
  const { PLAN } = await import('./js/data.js');
  const { exOf } = await import('./js/plan.js');
  const w = PLAN.find((x) => exOf(x, 'db').some((it) => it.statt === 'haengendes-knieheben'));
  const it = w && exOf(w, 'db').find((x) => x.statt === 'haengendes-knieheben');
  return it ? { id: it.id, warum: it.stattWarum } : null;
});
console.log('     ohne Stange:', JSON.stringify(ohneStange));
check(ohneStange && ohneStange.warum === 'vorrat',
  'ohne Klimmzugstange springt der Gerätefilter ein, trotz eigener Wahl');

await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(400);
await page.locator('[data-act="show-list"]').first().click();
await page.waitForTimeout(400);
check(await page.locator('.ex').filter({ hasText: 'Crunches' }).first()
  .locator('.ex-fassung').count() === 0,
  'und an dieser Karte steht keine Auswahl – der Tausch gehört nicht zu dieser Übung');

// Und andersherum: Steht die leichte Fassung da, weil die Stufe es so will,
// darf das + nicht auf eine Übung zeigen, deren Gerät fehlt.
await page.evaluate(async () => {
  const store = await import('./js/store.js');
  store.setSetting('level', 'anfaenger');
  store.setSetting('fassung', {});
});
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(400);
await page.locator('[data-act="show-list"]').first().click();
await page.waitForTimeout(400);
const gesperrt = page.locator('.ex').filter({ hasText: 'Knieheben' }).first()
  .locator('.ex-fassung [data-v="haengendes-knieheben"]');
check(await gesperrt.count() === 1 && await gesperrt.first().isDisabled(),
  'ohne Klimmzugstange ist die hängende gesperrt statt wirkungslos');
const sagt = await gesperrt.first().getAttribute('aria-label');
console.log('     + sagt:', sagt);
check(/fehlt/.test(sagt || ''), `und sagt, woran es liegt (${sagt})`);
await page.evaluate(async () => (await import('./js/store.js')).setSetting('fehlt', []));

// --- 8. Der Bizeps hat dieselbe Auswahl ---------------------------------
//
// Gemeldet: „SZ curls tun echt in den unterarmen iwie weh. Ich spür den
// Knochen iwie ganz stark oder so." Der Hinweistext der SZ-Curls empfahl
// Hammercurls schon beim Namen – nur gab es sie im Katalog nicht. Jetzt gibt
// es sie, und weil die Anteile identisch sind, stehen sie ohne weiteres Zutun
// in derselben Auswahl. Geprüft wird beides: dass sie da sind, und dass der
// Tausch die Wochenmengen nicht anfasst.
const curlWahl = await page.evaluate(async () => {
  const { fassungen } = await import('./js/plan.js');
  const { EX_BY_ID } = await import('./js/uebung.js');
  const ids = fassungen({ id: 'sz-curls' }).liste.map((x) => x.id);
  return {
    ids,
    anteile: ids.map((id) => JSON.stringify(EX_BY_ID.get(id).db.shares)),
    equip: ids.map((id) => EX_BY_ID.get(id).db.equip),
  };
});
console.log('     Curl-Auswahl:', curlWahl.ids.join(' | '));
check(curlWahl.ids.includes('hammer-curls'),
  'die Hammercurls stehen an der SZ-Curl-Karte zur Wahl');
check(new Set(curlWahl.anteile).size === 1,
  `und alle drei haben dieselben Anteile (${curlWahl.anteile[0]}) – der Tausch verschiebt keine Wochenmenge`);
check(new Set(curlWahl.equip).size === curlWahl.equip.length,
  `jede mit eigenem Gerät (${curlWahl.equip.join(', ')}) – sonst wäre es keine Ausweichmöglichkeit`);

// Das Bewegungsbild muss sich unterscheiden, sonst ist der Tausch unsichtbar.
// Bei zwei Curls liegt der Unterschied allein in der Hand, und die hat ein
// Strichmännchen nicht – sichtbar wird er nur an der Lage der Hantel.
const bilder = await page.evaluate(async () => {
  const { PATTERNS } = await import('./js/figure.js');
  return { curl: !!PATTERNS.curl, hammer: !!PATTERNS.hammercurl,
    laengs: !!PATTERNS.hammercurl?.hantelLaengs, quer: !!PATTERNS.curl?.hantelLaengs };
});
check(bilder.curl && bilder.hammer, 'beide Curls haben ein eigenes Bewegungsbild');
check(bilder.laengs && !bilder.quer,
  'und die Hantel liegt beim Hammercurl längs, beim gewöhnlichen quer');

// --- 9. Die zweite Reihe: fast dasselbe, mit Preisschild ----------------
//
// Gemeldet, zweimal und unabhängig voneinander:
//
//   „Langhantelrudern merk ich iwie am meisten im unteren rücken."
//   „Face pull check ich iwie nicht so. Außerdem ist die klimmzugstange ja
//    ganz weit oben eigentlich angebracht."
//
// In beiden Fällen stand die passende Antwort im Katalog und wurde nicht
// angeboten, weil die Anteile um Kleinigkeiten abwichen. Seit v190 gibt es
// dafür eine zweite Reihe – getrennt von der freien Wahl und mit dem
// gemessenen Preis am Knopf. Geprüft wird beides: dass die Nachbarn da sind,
// und dass der Preis stimmt.
const nah = await page.evaluate(async () => {
  const { nachbarn, fassungen, tauschKosten } = await import('./js/plan.js');
  const liste = (id) => (nachbarn({ id }) || { liste: [] }).liste
    .map((x) => `${x.id} ${x.kosten.delta} ${x.kosten.gruppe}`);
  return {
    rudern: liste('einarmiges-kh-rudern'),
    frei: (fassungen({ id: 'einarmiges-kh-rudern' }) || { liste: [] }).liste.map((x) => x.id),
    // Eine anteilsgleiche Übung darf hier nicht auftauchen – sie steht schon
    // in der ersten Reihe, und zweimal wäre einmal zu viel.
    curls: liste('sz-curls'),
    // Der Preis muss aus dem Plan kommen und nicht aus den Anteilen allein:
    // dieselbe Übung, aber nicht im Plan, hat keinen messbaren Preis.
    ohnePlan: tauschKosten('rucksack-rudern', 'inverted-row'),
    einzeln: tauschKosten('einarmiges-kh-rudern', 'inverted-row'),
  };
});
console.log('     Rudern, zweite Reihe:', nah.rudern.join(' | ') || '–');
check(nah.rudern.some((x) => x.startsWith('inverted-row ')),
  'die Inverted Row steht als Nachbar am Langhantelrudern');
check(nah.frei.includes('rucksack-rudern') && !nah.rudern.some((x) => x.startsWith('rucksack-rudern ')),
  'das anteilsgleiche Rucksack-Rudern bleibt in der ersten Reihe und taucht nicht doppelt auf');
check(nah.curls.length === 0,
  `am Curl gibt es keine Nachbarn – dort ist die Wahl vollständig frei (${nah.curls.length})`);
check(nah.ohnePlan === null,
  'eine Übung, die im Plan nicht vorkommt, hat keinen Preis – gerechnet wird am Plan, nicht an den Anteilen');
check(nah.einzeln && nah.einzeln.gruppe === 'traps' && nah.einzeln.delta > 0,
  `und der Preis nennt die stärkste Gruppe mit Vorzeichen (${JSON.stringify(nah.einzeln
    && { g: nah.einzeln.gruppe, d: nah.einzeln.delta })})`);

// Und die Wahl muss auch wirklich greifen: Ein Nachbar ist kein Knopf, der
// nur anders aussieht.
const gewechselt = await page.evaluate(async () => {
  const store = await import('./js/store.js');
  const { exOf } = await import('./js/plan.js');
  const { PLAN } = await import('./js/data.js');
  store.setSetting('fassung', { 'einarmiges-kh-rudern': 'inverted-row' });
  const w = PLAN.find((x) => x.ex.some((it) => it.id === 'einarmiges-kh-rudern'));
  const it = w && exOf(w, 'db').find((x) => x.statt === 'einarmiges-kh-rudern');
  return it ? { id: it.id, warum: it.stattWarum } : null;
});
console.log('     nach der Wahl:', JSON.stringify(gewechselt));
check(gewechselt && gewechselt.id === 'inverted-row' && gewechselt.warum === 'fassung',
  'ein gewählter Nachbar steht danach wirklich im Plan');

// Eine Wahl, die weder anteilsgleich noch benachbart ist, muss abprallen –
// sonst könnte ein alter oder von Hand gesetzter Eintrag still einen
// beliebigen Tausch durchsetzen.
const abgewiesen = await page.evaluate(async () => {
  const store = await import('./js/store.js');
  const { exOf } = await import('./js/plan.js');
  const { PLAN } = await import('./js/data.js');
  store.setSetting('fassung', { 'einarmiges-kh-rudern': 'goblet-squat' });
  const w = PLAN.find((x) => x.ex.some((it) => it.id === 'einarmiges-kh-rudern'));
  return (exOf(w, 'db') || []).some((x) => x.id === 'goblet-squat');
});
check(!abgewiesen, 'eine weit entfernte Übung wird als Wahl abgewiesen');
await page.evaluate(async () => (await import('./js/store.js')).setSetting('fassung', {}));

check(errs.length === 0, `keine Fehler${errs.length ? ': ' + errs.slice(0, 2).join(' | ') : ''}`);
await browser.close();
console.log(`\n${fails ? fails + ' FEHLER' : 'alle Prüfungen bestanden'}`);
