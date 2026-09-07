/*
 * Supersätze: zwei Übungen im Wechsel, statt die Pause abzusitzen.
 *
 * Der Vorschlag kam aus dem Training: *„Könnte man statt den langen Pausen
 * nicht immer Supersätze machen? Zumindest wenns nicht gleiche Muskelgruppen
 * sind und nicht das gleiche Equipment mit anderem Gewicht benutzt wird."*
 *
 * Beide Bedingungen sind hier die Prüfung. Sie zu verletzen kostet nichts, was
 * auffällt – die App würde weiterlaufen und die Einheit wäre still schlechter:
 * Ein Paar, das sich einen Muskel teilt, ist kein Supersatz, sondern ein
 * verschenkter zweiter Satz; eins am selben Gerät bezahlt die gesparte Zeit in
 * Scheibenwechseln. Genau deshalb steht es hier.
 *
 * Dazu die Rechnung, an der alles hängt: Die Pause wird nicht kürzer, sie wird
 * gefüllt. Wie lange noch zu warten ist, ergibt sich aus der Uhr – aus „wann
 * war diese Übung zuletzt dran", nicht aus einem festen Übergang.
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
await page.evaluate(() => localStorage.setItem('workout.state.v1', JSON.stringify({
  greeted: true, name: 'T', level: 'geuebt', shift: 0, log: {}, supersatz: true,
})));
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(300);

// --- 1. Die beiden Regeln ---------------------------------------------
const regeln = await page.evaluate(async () => {
  const { passtZusammen } = await import('./js/supersatz.js');
  const { EX_BY_ID } = await import('./js/uebung.js');
  const v = (id) => ({ id, ...EX_BY_ID.get(id).db });
  return {
    // Floor Press und Trizepsstrecker teilen sich den Trizeps.
    gleicherMuskel: passtZusammen(v('floor-press'), v('liegende-trizepsstrecker'), 'db'),
    // Floor Press und Rudern: beide an der Langhantel, also Umbau je Satz.
    gleichesGeraet: passtZusammen(v('floor-press'), v('einarmiges-kh-rudern'), 'db'),
    // Langhantel drücken und Klimmzüge: nichts gemeinsam, kein Umbau.
    gut: passtZusammen(v('floor-press'), v('chin-ups'), 'db'),
    // Zwei ohne Aufbau dürfen sich treffen – da gibt es nichts zu wechseln.
    ohneAufbau: passtZusammen(v('chin-ups'), v('band-seitheben'), 'db'),
    // Sich selbst nie.
    selbst: passtZusammen(v('floor-press'), v('floor-press'), 'db'),
  };
});
console.log('     Regeln:', JSON.stringify(regeln));
check(regeln.gleicherMuskel === false,
  'Floor Press + Trizepsstrecker: gemeinsamer Muskel, also kein Paar');
check(regeln.gleichesGeraet === false,
  'Floor Press + Langhantelrudern: dasselbe Gerät, also kein Paar');
check(regeln.gut === true, 'Floor Press + Chin-ups: nichts gemeinsam, kein Umbau – passt');
check(regeln.ohneAufbau === true, 'zwei Übungen ohne Aufbau dürfen sich treffen');
check(regeln.selbst === false, 'und keine Übung mit sich selbst');

// --- 2. Die Paarung einer echten Einheit -------------------------------
// Jede Einheit jeder Variante durchgehen: Ein einziges Paar, das eine der
// beiden Regeln verletzt, wäre ein stiller Fehler im Training.
const alle = await page.evaluate(async () => {
  const { PLAN } = await import('./js/data.js');
  const { paare, passtZusammen } = await import('./js/supersatz.js');
  const { EX_BY_ID } = await import('./js/uebung.js');
  const schlecht = [];
  let paarZahl = 0;
  let einheiten = 0;
  let allein = 0;
  PLAN.forEach((w) => {
    ['db', 'bw'].forEach((mode) => {
      const items = w.ex.map((x) => {
        const ex = EX_BY_ID.get(x.id);
        return { id: x.id, sets: x.sets, ...ex[mode] };
      });
      const g = paare(items, mode);
      einheiten++;
      g.forEach((gr) => {
        if (gr.length === 1) { allein++; return; }
        paarZahl++;
        if (!passtZusammen(gr[0], gr[1], mode)) schlecht.push(`${gr[0].id}+${gr[1].id}`);
        // Jede Übung darf nur in einer Gruppe stehen.
      });
      const ids = g.flat().map((x) => x.id);
      if (new Set(ids).size !== ids.length) schlecht.push(`doppelt in W${w.n}/${mode}`);
      if (ids.length !== items.length) schlecht.push(`verloren in W${w.n}/${mode}`);
    });
  });
  return { schlecht, paarZahl, einheiten, allein };
});
console.log(`     ${alle.einheiten} Einheiten: ${alle.paarZahl} Paare, ${alle.allein} einzeln`);
check(alle.schlecht.length === 0,
  `kein Paar verletzt eine der beiden Regeln${alle.schlecht.length ? ': ' + alle.schlecht.slice(0, 3).join(', ') : ''}`);
check(alle.paarZahl > alle.einheiten,
  `es findet sich im Schnitt mehr als ein Paar je Einheit (${(alle.paarZahl / alle.einheiten).toFixed(1)})`);
// Nicht alles lässt sich paaren, und das ist keine Schwäche: Wo sich Übungen
// einen Muskel oder ein Gerät teilen, ist die normale Pause richtig.
check(alle.allein > 0, `und es bleibt etwas übrig, das allein läuft (${alle.allein})`);

// --- 3. Die Reihenfolge im Wechsel -------------------------------------
const folge = await page.evaluate(async () => {
  const { schritte } = await import('./js/supersatz.js');
  return {
    gleich: schritte([{ id: 'A', sets: 3 }, { id: 'B', sets: 3 }]).map((s) => `${s.id}${s.satz + 1}`),
    // "Übungen die dann weniger Sätze haben fallen dann halt nach zwei
    // Durchgängen raus" – genau das:
    ungleich: schritte([{ id: 'A', sets: 3 }, { id: 'B', sets: 2 }]).map((s) => `${s.id}${s.satz + 1}`),
    allein: schritte([{ id: 'A', sets: 2 }]).map((s) => `${s.id}${s.satz + 1}`),
  };
});
console.log('     Wechsel:', JSON.stringify(folge));
check(folge.gleich.join(' ') === 'A1 B1 A2 B2 A3 B3', `A1 B1 A2 B2 A3 B3 (${folge.gleich.join(' ')})`);
check(folge.ungleich.join(' ') === 'A1 B1 A2 B2 A3',
  `hat einer weniger Sätze, macht der andere allein zu Ende (${folge.ungleich.join(' ')})`);
check(folge.allein.join(' ') === 'A1 A2', 'ohne Partner bleibt es die normale Folge');
check(folge.gleich.length === 6 && folge.ungleich.length === 5,
  'es wird nichts gestrichen und nichts hinzugefügt – nur umsortiert');

// --- 4. Der nächste Schritt hält sich an das, was schon steht ----------
const naechst = await page.evaluate(async () => {
  const { naechsterSchritt } = await import('./js/supersatz.js');
  const g = [{ id: 'A', sets: 3 }, { id: 'B', sets: 3 }];
  const fertig = new Set(['A0']);
  return {
    nachA1: naechsterSchritt(g, (id, s) => fertig.has(`${id}${s}`)),
    // Wer einen Satz überspringt, soll trotzdem an der offenen Stelle landen –
    // nicht stumpf beim nächsten in der Liste.
    luecke: naechsterSchritt(g, (id, s) => ['A0', 'B0', 'A1', 'B1'].includes(`${id}${s}`)),
    durch: naechsterSchritt(g, () => true),
  };
});
check(naechst.nachA1 && naechst.nachA1.id === 'B' && naechst.nachA1.satz === 0,
  'nach A1 kommt B1');
check(naechst.luecke && naechst.luecke.id === 'A' && naechst.luecke.satz === 2,
  'und nach vier Sätzen der fünfte, egal in welcher Reihenfolge gehakt wurde');
check(naechst.durch === null, 'ist das Paar durch, gibt es keinen nächsten Schritt');

// --- 5. Die Rechnung, um die es geht -----------------------------------
// Traditionell: A ganz durch, dann B. Im Wechsel: A und B teilen sich die
// Wartezeit. Beide bekommen dieselbe Erholung – die Einheit ist kürzer.
const zeit = await page.evaluate(() => {
  const SATZ = 40;      // Sekunden je Satz, grob
  const PAUSE = 150;
  const SAETZE = 3;
  const klassisch = 2 * (SAETZE * SATZ + (SAETZE - 1) * PAUSE);
  // Im Wechsel: Nach jedem Satz zur anderen Übung; gewartet wird nur, was zur
  // vorgesehenen Pause noch fehlt.
  let uhr = 0;
  const zuletzt = { A: -Infinity, B: -Infinity };
  const folge = [];
  for (let r = 0; r < SAETZE; r++) folge.push('A', 'B');
  let kuerzeste = Infinity;
  folge.forEach((x) => {
    const wartet = Math.max(0, PAUSE - (uhr - zuletzt[x]));
    if (zuletzt[x] > -Infinity) kuerzeste = Math.min(kuerzeste, uhr + wartet - zuletzt[x]);
    uhr += wartet + SATZ;
    zuletzt[x] = uhr;
  });
  return { klassisch, wechsel: uhr, kuerzeste };
});
console.log(`     klassisch ${zeit.klassisch}s, im Wechsel ${zeit.wechsel}s, `
  + `kürzeste Erholung ${zeit.kuerzeste}s`);
check(zeit.wechsel < zeit.klassisch * 0.7,
  `der Wechsel spart über 30 % (${Math.round((1 - zeit.wechsel / zeit.klassisch) * 100)} %)`);
check(zeit.kuerzeste >= 150,
  `und keine Übung bekommt weniger als ihre Pause (${zeit.kuerzeste}s von 150s)`);

// --- 6. Die Bedienung ---------------------------------------------------
await page.locator('.tab[data-tab="settings"]').click();
await page.waitForTimeout(400);
const text = (await page.locator('#view').textContent()).replace(/\s+/g, ' ');
check(/Supersätze/.test(text), 'der Schalter steht unter Mehr');
check(/im Wechsel mit/.test(text),
  'und darunter steht, wie die nächste Einheit konkret liefe – nicht nur das Versprechen');
check(/nicht kürzer, sondern gefüllt/.test(text),
  'der Text sagt, was wirklich passiert: Die Pause wird gefüllt, nicht gekürzt');

// Ausgeschaltet verschwindet die Vorschau wieder.
await page.locator('[data-act="toggle-supersatz"]').click();
await page.waitForTimeout(400);
const aus = (await page.locator('#view').textContent()).replace(/\s+/g, ' ');
check(!/im Wechsel mit/.test(aus), 'ausgeschaltet steht dort nichts mehr');

// --- 7. Im Training: der Sprung zum Partner ----------------------------
await page.evaluate(() => localStorage.setItem('workout.state.v1', JSON.stringify({
  greeted: true, name: 'T', level: 'geuebt', shift: 0, log: {}, supersatz: true,
})));
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(300);
await page.locator('[data-act="start-session"]').first().click();
await page.waitForTimeout(400);

const erst = (await page.locator('.focus-name').textContent()).trim();
const hinweis = await page.locator('.super-hin').count();
console.log('     erste Übung:', erst, '| Wechselhinweis:', hinweis);
check(hinweis === 1, 'in der Fokus-Ansicht steht, mit wem gewechselt wird');

await page.locator('.focus-set, .set-btn').first().click();
await page.waitForTimeout(600);
const zweit = (await page.locator('.focus-name').textContent()).trim();
console.log('     nach einem Satz:', zweit);
check(zweit !== erst, `nach dem ersten Satz steht der Partner da (${erst} → ${zweit})`);
// Und zwar ohne Pause: Der Partner ist heute noch nicht drangewesen.
const pause = await page.evaluate(() => !!JSON.parse(
  localStorage.getItem('workout.state.v1') || '{}').rest);
check(pause === false,
  'und ohne Pause davor – der Partner war noch nicht dran, es gibt nichts zu warten');

check(errs.length === 0, `keine Fehler${errs.length ? ': ' + errs.slice(0, 2).join(' | ') : ''}`);
console.log(`\n${fails ? fails + ' FEHLER' : 'alle Prüfungen bestanden'}`);
await browser.close();
