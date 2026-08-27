import { chromium } from 'playwright';
import { URL, SHOT } from './umgebung.mjs';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 414, height: 896 } });
const errs = [];
page.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()); });
let fails = 0;
const check = (c, m) => { console.log(`${c ? 'OK  ' : 'FAIL'} ${m}`); if (!c) { fails++; process.exitCode = 1; } };

await page.goto(URL, { waitUntil: 'networkidle' });
await page.evaluate(() => { localStorage.clear(); localStorage.setItem('workout.state.v1', '{"greeted":true}'); });
await page.reload({ waitUntil: 'networkidle' });

// --- Tab und Liste ---
// Verletzungen liegen seit dem Umbau der Leiste unter Mehr.
const zuVerletzt = async () => {
  await page.locator('.tab[data-tab="settings"]').click();
  await page.waitForTimeout(150);
  await page.locator('[data-act="go-tab"][data-tab="injuries"]').click();
  await page.waitForTimeout(150);
};
await page.locator('.tab[data-tab="settings"]').click();
await page.waitForTimeout(200);
check(await page.locator('[data-act="go-tab"][data-tab="injuries"]').count() === 1,
  'Verletzungen stehen unter Mehr');
await zuVerletzt();
await page.waitForTimeout(300);
const cards = await page.locator('.inj-card').count();
check(cards >= 25, `viele Beschwerden zur Auswahl (${cards})`);
check(await page.locator('#injFigure svg').count() === 1, '3D-Körper in der Kopfzeile');
check(await page.locator('.inj-area').count() >= 8, 'nach Körperregion gruppiert');

// --- Katalog ist in sich stimmig ---
const daten = await page.evaluate(async () => {
  const { INJURIES, CARE } = await import('./js/injuries.js');
  const { EXERCISES } = await import('./js/data.js');
  const { SPOTS } = await import('./js/figure.js');
  const ids = new Set(EXERCISES.map((e) => e.id));
  const bad = [];
  INJURIES.forEach((i) => {
    if (!SPOTS[i.spot]) bad.push(`${i.id}: Stelle ${i.spot} gibt es nicht`);
    if (!i.care || !i.care.length) bad.push(`${i.id}: keine Zusatzübungen`);
    i.avoid.forEach((x) => { if (!ids.has(x)) bad.push(`${i.id}: ${x} ist keine Übung`); });
    Object.entries(i.swap).forEach(([a, b]) => {
      if (!ids.has(b)) bad.push(`${i.id}: Ersatz ${b} ist keine Übung`);
      if (!i.avoid.includes(a)) bad.push(`${i.id}: Ersatz für ${a}, das gar nicht gesperrt ist`);
      if (i.avoid.includes(b)) bad.push(`${i.id}: Ersatz ${b} ist selbst gesperrt`);
    });
  });
  const benutzt = new Set(INJURIES.flatMap((i) => i.care || []));
  INJURIES.forEach((i) => (i.care || []).forEach((k) => {
    if (!CARE[k]) bad.push(`${i.id}: Zusatzübung ${k} gibt es nicht`);
  }));
  Object.keys(CARE).forEach((k) => {
    if (!benutzt.has(k)) bad.push(`Zusatzübung ${k} wird von keiner Beschwerde genutzt`);
    const c = CARE[k];
    if (!c.name || !c.dose || !c.cue || !c.kind) bad.push(`Zusatzübung ${k}: Feld fehlt`);
  });
  return { bad, n: INJURIES.length, care: Object.keys(CARE).length,
           doppelt: INJURIES.length - new Set(INJURIES.map((i) => i.id)).size };
});
check(daten.bad.length === 0, `Katalog stimmig${daten.bad.length ? ': ' + daten.bad.join(' | ') : ''}`);
check(daten.doppelt === 0, 'keine doppelten IDs');
console.log(`     ${daten.n} Beschwerden, ${daten.care} Zusatzübungen`);

// --- Zusatzübungen erscheinen zur Auswahl ---
await page.evaluate(() => localStorage.setItem('workout.state.v1',
  JSON.stringify({ injuries: ['achillessehne'], tab: 'injuries' })));
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(300);
const namenCare = await page.locator('.care-name').allTextContents();
console.log('     bei Achillessehne:', namenCare.join(' | '));
check(namenCare.includes('Wadenheben, langsam ablassen'), 'passende Zusatzübung wird vorgeschlagen');
check(await page.locator('.care-dose').count() === namenCare.length, 'jede mit Dosierung');

// --- Bei Riss/Bruch/Vorfall der Hinweis auf die ärztliche Freigabe ---
await page.evaluate(() => localStorage.setItem('workout.state.v1',
  JSON.stringify({ injuries: ['kreuzband'], tab: 'injuries' })));
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(300);
const frei = await page.locator('.card', { hasText: 'Was jetzt gut tut' }).textContent();
check(frei.includes('ärztlicher Freigabe'), 'Kreuzbandriss: Hinweis auf die Freigabe');

// zurück auf den Ausgangszustand für die folgenden Prüfungen
await page.evaluate(() => { localStorage.clear(); localStorage.setItem('workout.state.v1', '{"greeted":true}'); });
await page.reload({ waitUntil: 'networkidle' });
await zuVerletzt();
await page.waitForTimeout(300);

// --- Anhaken wirkt auf den Plan ---
const vorher = await page.evaluate(async () => (await import('./js/data.js')).PLAN[0].ex.map((x) => x.id));
await page.locator('.inj-card', { hasText: 'Handgelenksüberlastung' }).locator('.toggle').click();
await page.waitForTimeout(300);
check(await page.locator('.inj-table tbody tr').count() > 0, 'Auswirkungen je Muskelgruppe werden gezeigt');
const gespeichert = await page.evaluate(() => JSON.parse(localStorage.getItem('workout.state.v1')).injuries);
check(gespeichert.includes('handgelenk-reizung'), 'Auswahl ist gespeichert');

// --- Übersteht das Neuladen (gilt für kommende Trainings) ---
// Die App bleibt beim Neuladen im Tab; fürs Training zurück aufs Dashboard.
await page.reload({ waitUntil: 'networkidle' });
await page.locator('.tab[data-tab="dashboard"]').click();
await page.waitForTimeout(200);
check(await page.locator('.injury-note').count() === 1, 'Hinweis steht im Training');
const note = (await page.locator('.injury-note').textContent()).replace(/\s+/g, ' ');
console.log('     Hinweis:', note.trim().slice(0, 120));
check(note.includes('Handgelenk'), 'Hinweis nennt die Beschwerde');

// --- Gesperrte Übung taucht nirgends mehr auf ---
await page.locator('[data-act="show-list"]').click();
await page.waitForTimeout(200);
const namen = await page.locator('.ex-name').allTextContents();
console.log('     heute:', namen.join(' | '));
const gesperrt = await page.evaluate(async () => {
  const { PLAN, EXERCISES } = await import('./js/data.js');
  const { blocked } = await import('./js/injuries.js');
  const b = blocked(['handgelenk-reizung']);
  const byId = new Map(EXERCISES.map((e) => [e.id, e]));
  return PLAN[0].ex.filter((x) => b.has(x.id)).map((x) => byId.get(x.id).db.name);
});
console.log('     gesperrt am Tag 1:', gesperrt.join(' | ') || '–');
check(gesperrt.every((n) => !namen.includes(n)), 'gesperrte Übungen fehlen in der Liste');

// --- Wechselwirkung: Ersatz durch zweite Beschwerde blockiert ---
await page.evaluate(() => {
  localStorage.setItem('workout.state.v1', JSON.stringify({
    injuries: ['schulter-impingement', 'ac-gelenk'],
  }));
});
await page.reload({ waitUntil: 'networkidle' });
await zuVerletzt();
await page.waitForTimeout(300);
const warn = await page.locator('.inj-warn').count();
console.log('     Wechselwirkungen:', (await page.locator('.inj-warn').allTextContents()).join(' // ').replace(/\s+/g, ' ').slice(0, 200));
check(warn > 0, `Wechselwirkung wird erkannt (${warn})`);
await page.screenshot({ path: `${SHOT}/97-injuries.png`, fullPage: false });

// --- Erholung geht vor Ersatz -----------------------------------------------
// Der Plan ist so gebaut, dass keine Muskelgruppe innerhalb von 48 Stunden
// zweimal direkt drankommt. Ein Tausch darf das nicht aushebeln: greift der
// Ersatz genau die Gruppe, die am Nachbartag schon dran ist, fällt die Übung
// ersatzlos weg. Geprüft wird an der Liste, die die App wirklich anzeigt.
const erholung = await page.evaluate(async () => {
  const { PLAN, EXERCISES, REST } = await import('./js/data.js');
  const inj = await import('./js/injuries.js');
  const byId = new Map(EXERCISES.map((e) => [e.id, e]));
  const dir = (id) => Object.entries(byId.get(id).db.shares)
    .filter(([, v]) => v >= REST.direct).map(([m]) => m);
  const dset = (items) => new Set(items.flatMap((it) => dir(it.id)));
  const tag = (iso) => new Date(iso + 'T00:00:00').getTime() / 86400000;

  const lauf = (act, mitRegel) => {
    const list = [];
    let ersatzlos = 0;
    let getauscht = 0;
    PLAN.forEach((w, i) => {
      let taboo = new Set();
      if (mitRegel) {
        const eng = (a, b) => a && b && Math.abs(tag(b.date) - tag(a.date)) < REST.days;
        const meide = new Set();
        if (eng(PLAN[i - 1], w)) dset(list[i - 1]).forEach((m) => meide.add(m));
        if (eng(w, PLAN[i + 1])) dset(PLAN[i + 1].ex).forEach((m) => meide.add(m));
        taboo = new Set(EXERCISES.filter((e) => dir(e.id).some((m) => meide.has(m))).map((e) => e.id));
      }
      const r = inj.applyInjuries(w.ex, act, taboo);
      list.push(r.items);
      ersatzlos += r.dropped.filter((d) => d.reason === 'rest').length;
      getauscht += r.swapped.length;
    });
    let verstoss = 0;
    for (let i = 0; i < PLAN.length - 1; i++) {
      if (tag(PLAN[i + 1].date) - tag(PLAN[i].date) >= REST.days) continue;
      const a = dset(list[i]);
      if ([...dset(list[i + 1])].some((m) => a.has(m))) verstoss++;
    }
    return { verstoss, ersatzlos, getauscht };
  };

  // Die Vorführbeschwerde wird gesucht, nicht gesetzt: Welcher Ersatz die
  // 48 Stunden bräche, hängt am Plan, und der wird neu gerechnet. Vorher stand
  // hier fest 'schulter-impingement' – nach einer Neurechnung brach der Ersatz
  // dort nichts mehr, und die Prüfung zeigte nur noch, dass nichts passiert.
  const demo = inj.INJURIES.map((i) => i.id).find((id) => lauf([id], false).verstoss > 0)
    || 'schulter-impingement';
  const out = { demo, schulter: { ohne: lauf([demo], false), mit: lauf([demo], true) }, alle: [] };
  for (const one of inj.INJURIES) out.alle.push([one.id, lauf([one.id], true).verstoss]);
  // Auch in Kombination darf nichts durchrutschen
  out.paare = [];
  const ids = inj.INJURIES.map((i) => i.id);
  for (let i = 0; i < ids.length; i += 3) {
    const paar = [ids[i], ids[(i + 7) % ids.length]];
    out.paare.push([paar.join('+'), lauf(paar, true).verstoss]);
  }
  return out;
});
console.log(`     ${erholung.demo} ohne Regel:`, JSON.stringify(erholung.schulter.ohne));
console.log(`     ${erholung.demo} mit Regel: `, JSON.stringify(erholung.schulter.mit));
check(erholung.schulter.ohne.verstoss > 0,
  `ohne die Regel bricht der Ersatz die 48 Stunden (${erholung.schulter.ohne.verstoss}×) – sonst prüft das hier nichts`);
check(erholung.schulter.mit.verstoss === 0, 'mit der Regel kein einziger Verstoß');
check(erholung.schulter.mit.getauscht > 0,
  `getauscht wird trotzdem, wo es geht (${erholung.schulter.mit.getauscht}×)`);
const kaputt = erholung.alle.filter(([, v]) => v > 0);
check(kaputt.length === 0, `keine einzelne Beschwerde bricht die Regel${
  kaputt.length ? ' – ' + JSON.stringify(kaputt) : ''}`);
const kaputt2 = erholung.paare.filter(([, v]) => v > 0);
check(kaputt2.length === 0, `auch in Kombination nicht (${erholung.paare.length} Paare geprüft)${
  kaputt2.length ? ' – ' + JSON.stringify(kaputt2) : ''}`);

// Und die App sagt auch, warum eine Übung ersatzlos wegfällt
await page.evaluate((id) => {
  const s = JSON.parse(localStorage.getItem('workout.state.v1'));
  s.injuries = [id];
  localStorage.setItem('workout.state.v1', JSON.stringify(s));
}, erholung.demo);
await page.reload({ waitUntil: 'networkidle' });
await zuVerletzt();
await page.waitForTimeout(300);
const txt = (await page.locator('.inj-summary').textContent()).replace(/\s+/g, ' ');
console.log('     Hinweis:', txt.match(/Davon [^.]*\./)?.[0] || '(keiner)');
check(/ohne Ersatz, weil/.test(txt), 'der Tab nennt den Grund für den ersatzlosen Wegfall');

// --- Alle Haken entfernen ---
await page.locator('[data-act="clear-injuries"]').click();
await page.waitForTimeout(300);
const leer = await page.evaluate(() => JSON.parse(localStorage.getItem('workout.state.v1')).injuries);
check(leer.length === 0, 'alle Haken entfernbar');
const wieder = await page.evaluate(async () => (await import('./js/data.js')).PLAN[0].ex.map((x) => x.id));
check(JSON.stringify(wieder) === JSON.stringify(vorher), 'Plan ist danach wieder der alte');

// --- Geschwister-Übungen: keine halben Sperren ---------------------------
// Der Anlass: Split Squat, Schulterdrücken, Kreuzheben und hängendes Knieheben
// kamen später dazu und standen in keiner einzigen Sperre. Wer einen
// Kreuzbandriss angehakt hatte, bekam die Kniebeuge aus dem Plan – und den
// Split Squat weiter angezeigt. Diese Prüfung findet so etwas beim nächsten
// Mal von allein.
const geschwister = {
  Kniebeuge: ['goblet-squat', 'fersenerhoehter-goblet-squat', 'split-squat'],
  Hueftstreck: ['hip-thrust', 'rumaenisches-kreuzheben'],
  Ueberkopf: ['sitzendes-seitheben', 'band-seitheben', 'sitzendes-schulterdruecken'],
  Haengen: ['chin-ups', 'pull-ups', 'haengendes-knieheben'],
  HintereSchulter: ['reverse-fly', 'band-pull-apart'],
  Druecken: ['gewichtete-liegestuetze', 'fuesse-erhoehte-liegestuetze', 'floor-press'],
};
// Begründete Ausnahmen – jede steht so auch im Katalog:
//   Floor Press stoppt am Boden und lässt das Handgelenk gerade,
//   der fersenerhöhte Squat beugt das Knie mehr und das Sprunggelenk weniger,
//   der Pull-Apart steht aufrecht und belastet weder Hals- noch Lendenwirbel.
//   Bei den beiden Rückenbeschwerden trennt die Hüftstreck-Familie sich genau
//   dort, worauf es ankommt: Das Kreuzheben ist eine belastete Beugung der
//   Wirbelsäule, der Hip Thrust hält sie gerade – er ist die "gestützte
//   Hüftstreckung", die der Eintrag selbst als gut verträglich beschreibt, und
//   steht in beiden Fällen als Ersatz für die gesperrten Übungen da.
const erlaubt = new Set([
  'schulter-impingement|Druecken', 'ellenbogen-bursitis|Druecken',
  'handgelenk-reizung|Druecken', 'hws-bandscheibe|HintereSchulter',
  'lws-bandscheibe|HintereSchulter', 'laeuferknie|Kniebeuge', 'sprunggelenk|Kniebeuge',
  'lws-bandscheibe|Hueftstreck', 'hexenschuss|Hueftstreck',
]);
const halbe = await page.evaluate(async (arg) => {
  const { INJURIES } = await import('./js/injuries.js');
  const out = [];
  INJURIES.forEach((inj) => {
    Object.entries(arg.geschwister).forEach(([name, gruppe]) => {
      const da = gruppe.filter((x) => inj.avoid.includes(x));
      const fehlt = gruppe.filter((x) => !inj.avoid.includes(x));
      if (da.length && fehlt.length && !arg.erlaubt.includes(`${inj.id}|${name}`)) {
        out.push(`${inj.id}: ${name} – ${fehlt.join(', ')} fehlt`);
      }
    });
  });
  return out;
}, { geschwister, erlaubt: [...erlaubt] });
check(halbe.length === 0, `keine halb gesperrte Übungsfamilie${halbe.length ? ':\n     ' + halbe.join('\n     ') : ''}`);

// Jede Übung des Plans muss überhaupt jemandem bekannt sein: eine Übung, die in
// keiner Sperre und in keinem Tausch vorkommt, ist beim Ergänzen vergessen worden.
const unbekannt = await page.evaluate(async () => {
  const { INJURIES } = await import('./js/injuries.js');
  const { EXERCISES } = await import('./js/data.js');
  const genannt = new Set();
  INJURIES.forEach((i) => {
    i.avoid.forEach((x) => genannt.add(x));
    Object.entries(i.swap || {}).forEach(([a, b]) => { genannt.add(a); genannt.add(b); });
  });
  return EXERCISES.map((e) => e.id).filter((id) => !genannt.has(id));
});
check(unbekannt.length === 0, `jede Übung kommt im Katalog vor${unbekannt.length ? ' – fehlt: ' + unbekannt.join(', ') : ''}`);

const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
check(overflow === 0, `kein horizontaler Überlauf (${overflow}px)`);

console.log(`\n${fails ? fails + ' FEHLER' : 'alle Prüfungen bestanden'}`);
console.log('ERRORS:', errs.length ? errs : 'none');
await browser.close();
