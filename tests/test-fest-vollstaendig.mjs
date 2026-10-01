/*
 * Ein Planwechsel schreibt angefangene Einheiten ganz fest, nicht halb.
 *
 *     „Heute nur zwei Übungen?"
 *
 * Mit v215 kam ein neuer Cut-Plan. Die Cut-Einheit Nr. 4 war in der
 * Fokusansicht angefangen – Liegestütze im Wechsel mit Band-Seitheben –, und
 * die Ansicht hatte im Protokoll nur dieses erste Paar angelegt. planWechsel()
 * schrieb die Einheit auf genau diese zwei fest; Crunches und Wadenheben waren
 * weg. Geprüft wird:
 *
 *   1. Die Fokusansicht legt die ganze Einheit im Protokoll an, nicht nur, was
 *      sie gerade zeigt.
 *   2. Wechselt der Plan, und der Plan davor ist bekannt (PLANS[f].vorher),
 *      wird eine angefangene Einheit mit ihrer ganzen alten Liste
 *      festgeschrieben.
 *   3. Ein schon zu kurz festgeschriebener Stand wird repariert, abgehakte
 *      Sätze bleiben, und die App sagt es.
 *   4. Eine abgeschlossene Einheit bleibt, was sie war – was nicht gemacht
 *      wurde, wird nicht nachträglich hineingeschrieben.
 *   5. Auch wenn das feste Paar schon ganz abgehakt ist, ohne dass die Einheit
 *      abgeschlossen wäre: stempleFertige() lief bis v218 vor der Reparatur
 *      und machte daraus eine fertige Einheit mit zwei Übungen.
 *   6. Die Liste aus dem Plan davor geht durch dieselbe Anpassung wie ein
 *      gewöhnlicher Plantag – Anfängerfassung, eigene Wahl, Satzzahl der
 *      Stufe. Bis v218 stand sie roh fest: das hängende Knieheben für
 *      Anfänger, drei Sätze für Fortgeschrittene.
 *   7. Die Reparatur erkennt die angezeigte Fassung wieder: Die Einheit eines
 *      Anfängers (liegendes statt hängendes Knieheben) wird auch vervollständigt.
 *   8. Ein noch offener Hinweis zum Planwechsel bleibt neben dem zur Reparatur
 *      stehen, statt überschrieben zu werden.
 *   9. Planwechsel mit aktiver Beschwerde: Die gesperrte Übung ist getauscht
 *      oder weg, und die App zeigt genau die feste Liste. Fällt die Beschwerde
 *      später weg, wird diese Liste **nicht** „repariert" – sie war richtig.
 *      Und ein bloß angezeigter Eintrag im Protokoll holt eine gesperrte Übung
 *      nicht zurück.
 *  10. `soll` aus dem Protokoll geht vor der heutigen Stufe; eine angefasste
 *      Übung in ihrer angezeigten Fassung bleibt, was sie war.
 *
 * Und zu 5.: Die Startkarte zeigt danach die reparierte Einheit, nicht die
 * nächste – bis v219 stand dort „Workout 5" neben „wieder vollständig".
 */
import { chromium } from 'playwright';
import { URL } from './umgebung.mjs';

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 414, height: 896 } });
await ctx.route('**/rest/v1/**', (r) => r.fulfill({ status: 204, body: '' }));
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message));
page.on('dialog', (d) => d.accept().catch(() => {}));
let fails = 0;
const check = (c, m) => { console.log(`${c ? 'OK  ' : 'FAIL'} ${m}`); if (!c) { fails++; process.exitCode = 1; } };

await page.goto(URL, { waitUntil: 'networkidle' });

// Zustand setzen und neu laden. Danach schreibt diese Seite nichts mehr: Die
// App sichert ihren Stand beim Verlassen und mit laufender Uhr auch
// zwischendurch (store.flush()), und nach einer angefangenen Einheit ist das
// ein anderer als der hier gesetzte. Der neu geladenen Seite gilt das nicht.
const setze = async (z) => {
  await page.evaluate((zz) => {
    localStorage.clear();
    localStorage.setItem('workout.state.v1', JSON.stringify(zz));
    window.Storage.prototype.setItem = () => {};
    window.Storage.prototype.removeItem = () => {};
    window.Storage.prototype.clear = () => {};
  }, z);
  await page.reload({ waitUntil: 'networkidle' });
};

// --- 1. Die Fokusansicht legt die ganze Einheit an ---------------------
await setze({ greeted: true, mode: 'db', focus: 'cut' });
await page.locator('[data-act="start-session"]').first().click();
await page.waitForTimeout(400);
const angelegt = await page.evaluate(async () => {
  const { getState } = await import('./js/store.js');
  const { workoutByNo } = await import('./js/plan.js');
  const s = getState();
  const [n, e] = Object.entries(s.log).find(([, x]) => x && x.db) || [];
  const soll = workoutByNo(Number(n), 'db').ex.map((x) => x.id);
  return { soll, im: Object.keys((e || {}).db || {}), fokus: !!document.querySelector('.focus-cue') };
});
check(angelegt.fokus, 'die Fokusansicht ist offen');
check(angelegt.soll.length > 2 && angelegt.soll.every((id) => angelegt.im.includes(id)),
  `alle ${angelegt.soll.length} Übungen der Einheit stehen im Protokoll, nicht nur die angezeigte (${angelegt.im.length})`);

// Liest Liste, Abschluss und Hinweis einer Einheit nach dem Laden.
const lies = (n) => page.evaluate(async (nn) => {
  const { getState } = await import('./js/store.js');
  const { workoutByNo } = await import('./js/plan.js');
  const e = getState().log[nn] || {};
  return {
    fest: (e.fest || []).map((x) => `${x.id}:${x.sets}`),
    ex: workoutByNo(nn, 'db').ex.map((x) => `${x.id}:${x.sets}`),
    done: e.done || null,
    umbau: getState().planUmbau,
    text: (document.querySelector('#view') || {}).textContent || '',
    karte: ((document.querySelector('.hero-eyebrow') || {}).textContent || '').trim(),
    eintrag: e,
  };
}, n);
const gleich = (a, b) => [...a].sort().join() === [...b].sort().join();
const voll = (k) => Array.from({ length: k }, () => ({ w: '20', done: true }));

// Welche Variante bringt einen Plan davor mit? Ohne einen gibt es 2. bis 5.
// und 8. nicht – dann ist nichts zu prüfen, und das wird gesagt statt
// verschwiegen.
const lage = await page.evaluate(async () => {
  const { PLANS } = await import('./js/data.js');
  const f = Object.keys(PLANS).find((k) => PLANS[k].vorher);
  if (!f) return null;
  const v = PLANS[f].vorher;
  // Eine Nummer, deren alte Liste mindestens drei Übungen hatte.
  const i = v.ex.findIndex((l) => l.length >= 3);
  return { f, name: PLANS[f].name, stand: PLANS[f].stand, alt: v.stand, n: i + 1,
           liste: v.ex[i].map(([id, sets]) => ({ id, sets })) };
});
if (!lage) {
  console.log('     kein Plan bringt einen Vorgänger mit (tools/plan-vorher/) – 2. bis 5. und 8. entfallen');
} else {
  console.log(`     ${lage.f}: Plan davor ${lage.alt}, jetzt ${lage.stand}, Einheit ${lage.n} hatte ${lage.liste.length} Übungen`);
  const [a, b] = lage.liste;
  const halb = {
    mode: 'db', startedOn: '2026-09-29', bw: {},
    db: { [a.id]: [{ w: '20', done: true }, {}, {}], [b.id]: [{ done: true }, {}, {}] },
    soll: { [a.id]: a.sets, [b.id]: b.sets },
  };

  // --- 2. Wechsel mit bekanntem Plan davor: ganze Liste --------------
  await setze({
    greeted: true, mode: 'db', focus: lage.f, planStand: { [lage.f]: lage.alt }, log: { [lage.n]: halb },
  });
  const wechsel = await page.evaluate(async (n) => {
    const { getState } = await import('./js/store.js');
    const { workoutByNo } = await import('./js/plan.js');
    const e = getState().log[n] || {};
    return { fest: (e.fest || []).map((x) => x.id), ex: workoutByNo(n, 'db').ex.map((x) => x.id) };
  }, lage.n);
  check(wechsel.fest.join() === lage.liste.map((x) => x.id).join(),
    `beim Wechsel steht die angefangene Einheit ganz fest: ${wechsel.fest.length} von ${lage.liste.length} Übungen`);
  // Dieselben Übungen – die Reihenfolge ordnet die App selbst (weniger Umbau).
  check([...wechsel.ex].sort().join() === [...wechsel.fest].sort().join(),
    `und so zeigt die App sie auch (${wechsel.ex.join(', ')})`);

  // --- 3. Schon zu kurz festgeschrieben: Reparatur --------------------
  await setze({
    greeted: true, mode: 'db', focus: lage.f, planStand: { [lage.f]: lage.stand },
    log: { [lage.n]: { ...halb, fest: lage.liste.slice(0, 2) } },
  });
  await page.waitForTimeout(300);
  const repariert = await page.evaluate(async (n) => {
    const { getState } = await import('./js/store.js');
    const e = getState().log[n] || {};
    return {
      fest: (e.fest || []).map((x) => x.id),
      abgehakt: Object.values(e.db || {}).reduce((s, arr) => s + arr.filter((x) => x && x.done).length, 0),
      hinweis: (document.querySelector('#view') || {}).textContent || '',
    };
  }, lage.n);
  check(repariert.fest.join() === lage.liste.map((x) => x.id).join(),
    `die zu kurz festgeschriebene Einheit hat wieder alle ${lage.liste.length} Übungen (${repariert.fest.length})`);
  check(repariert.abgehakt === 2, `die abgehakten Sätze bleiben (${repariert.abgehakt})`);
  check(/wieder vollständig/.test(repariert.hinweis), 'und die App sagt es');
  await page.locator('[data-act="umbau-ok"]').first().click();
  await page.waitForTimeout(200);
  await page.reload({ waitUntil: 'networkidle' });
  const zweimal = await page.evaluate(() => /wieder vollständig/.test(document.querySelector('#view').textContent));
  check(!zweimal, 'weggetippt bleibt der Hinweis weg – die Reparatur läuft nicht jedes Mal neu');

  // --- 4. Abgeschlossen bleibt abgeschlossen ---------------------------
  await setze({
    greeted: true, mode: 'db', focus: lage.f, planStand: { [lage.f]: lage.stand },
    log: { [lage.n]: { ...halb, done: 'db', fest: lage.liste.slice(0, 2) } },
  });
  const fertig = await page.evaluate(async (n) => {
    const { getState } = await import('./js/store.js');
    return (getState().log[n].fest || []).length;
  }, lage.n);
  check(fertig === 2, `eine abgeschlossene Einheit behält, was gemacht wurde (${fertig} Übungen)`);

  // --- 5. Das feste Paar ganz abgehakt, nicht abgeschlossen ---------------
  // Ohne `done`: Der Tick-Handler stempelt nur beim letzten Haken der ganzen
  // Einheit, und die hatte beim Abhaken noch alle ihre Übungen. Die Einheiten
  // davor sind fertig, damit die reparierte die nächste offene ist – und die
  // Startkarte sie zeigen muss statt der danach.
  const davor = await page.evaluate(async (n) => {
    const { workoutByNo } = await import('./js/plan.js');
    const out = {};
    for (let k = 1; k < n; k++) {
      const db = {};
      workoutByNo(k, 'db').ex.forEach((x) => { db[x.id] = Array.from({ length: x.sets }, () => ({ w: '20', done: true })); });
      out[k] = { mode: 'db', done: 'db', startedOn: '2026-09-1' + (k % 10), db, bw: {} };
    }
    return out;
  }, lage.n);
  await setze({
    greeted: true, mode: 'db', focus: lage.f, planStand: { [lage.f]: lage.stand },
    log: { ...davor, [lage.n]: { ...halb, db: { [a.id]: voll(a.sets), [b.id]: voll(b.sets) }, fest: lage.liste.slice(0, 2) } },
  });
  await page.waitForTimeout(300);
  const paar = await lies(lage.n);
  check(paar.fest.map((x) => x.split(':')[0]).join() === lage.liste.map((x) => x.id).join(),
    `ein ganz abgehaktes Paar ohne Abschluss wird trotzdem repariert: ${paar.fest.length} von ${lage.liste.length} Übungen`);
  check(!paar.done, `und die Einheit gilt danach nicht als abgeschlossen (done: ${paar.done})`);
  check(new RegExp(`Workout ${lage.n}$`).test(paar.karte),
    `die Startkarte zeigt die reparierte Einheit, nicht die nächste („${paar.karte}")`);

  // --- 8. Offener Planwechsel-Hinweis und Reparatur: beide -----------------
  await setze({
    greeted: true, mode: 'db', focus: lage.f, planStand: { [lage.f]: lage.stand },
    log: { [lage.n]: { ...halb, fest: lage.liste.slice(0, 2) } },
    planUmbau: { einheiten: 1, fest: true, fokus: lage.name },
  });
  await page.waitForTimeout(300);
  const beide = await lies(lage.n);
  check(!!(beide.umbau && beide.umbau.fest && beide.umbau.einheiten === 1 && beide.umbau.repariert === 1),
    `der Planwechsel-Hinweis bleibt neben der Reparatur gespeichert (${JSON.stringify(beide.umbau)})`);
  check(/Der Plan wurde überarbeitet/.test(beide.text) && /neuen Übungen/.test(beide.text),
    'der Text zum Planwechsel steht noch da');
  check(/wieder vollständig/.test(beide.text), 'und der zur Reparatur daneben');
  await page.locator('[data-act="umbau-ok"]').first().click();
  await page.waitForTimeout(200);
  const weg = await page.evaluate(() => document.querySelector('#view').textContent);
  check(!/Der Plan wurde überarbeitet|wieder vollständig/.test(weg), 'ein Tipp auf „Verstanden" nimmt beide weg');

  // --- 9. Planwechsel mit aktiver Beschwerde ---------------------------------
  // Beschwerden, die eine Übung hinter dem angefangenen Paar sperren, das Paar
  // selbst aber nicht – sonst ginge es um behalteProtokolliertes(), nicht um
  // den Plan davor.
  const kandidaten = await page.evaluate(async (liste) => {
    const { INJURIES, gesperrt } = await import('./js/injuries.js');
    const ids = liste.map((x) => x.id);
    return INJURIES.map((inj) => ({ id: inj.id, weg: [...gesperrt([inj.id], 'db')] }))
      .filter((k) => !k.weg.includes(ids[0]) && !k.weg.includes(ids[1]) && ids.slice(2).some((id) => k.weg.includes(id)));
  }, lage.liste);
  if (!kandidaten.length) {
    console.log(`     keine Beschwerde sperrt in Einheit ${lage.n} etwas hinter dem ersten Paar – 9. entfällt`);
  } else {
    // Die erste, die die Einheit kürzer macht, statt nur zu tauschen: Nur dann
    // sieht die feste Liste ohne die Beschwerde „zu kurz" aus, und genau das
    // darf die Reparatur nicht für ihren Fehler halten. Gibt es keine, prüft
    // der Rest trotzdem, nur eben den Tausch.
    let fall = null;
    for (const k of kandidaten) {
      await setze({
        greeted: true, mode: 'db', focus: lage.f, injuries: [k.id], planStand: { [lage.f]: lage.alt }, log: { [lage.n]: halb },
      });
      const r = await lies(lage.n);
      if (!fall || r.fest.length < lage.liste.length) fall = { ...k, r };
      if (r.fest.length < lage.liste.length) break;
    }
    const ids = (l) => l.map((x) => x.split(':')[0]);
    console.log(`     mit ${fall.id}: ${ids(fall.r.fest).join(', ')}`);
    check(fall.r.fest.length > 0 && !ids(fall.r.fest).some((id) => fall.weg.includes(id)),
      `${fall.id}: die gesperrte Übung steht nicht fest (${fall.weg.filter((id) => lage.liste.some((x) => x.id === id)).join(', ')})`);
    check(gleich(fall.r.ex, fall.r.fest), `${fall.id}: und die App zeigt genau die feste Liste (${fall.r.ex.join(' ')})`);

    // Beschwerde abgehakt, die Einheit noch offen, nächster Start. Der Eintrag
    // geht so weiter, wie die App ihn geschrieben hat – samt allem, woran sie
    // eine Liste aus dem Plan davor erkennt.
    await setze({
      greeted: true, mode: 'db', focus: lage.f, injuries: [], planStand: { [lage.f]: lage.stand },
      log: { [lage.n]: fall.r.eintrag },
    });
    await page.waitForTimeout(300);
    const heil = await lies(lage.n);
    check(heil.fest.join(' ') === fall.r.fest.join(' '),
      `ohne die Beschwerde bleibt die feste Liste, wie sie war (${heil.fest.length} Übungen)`);
    check(!(heil.umbau && heil.umbau.repariert) && !/wieder vollständig|Fehler in der App/.test(heil.text),
      `und es gibt keine „Reparatur" und keinen Hinweis dazu (${JSON.stringify(heil.umbau)})`);

    // Seit v216 legt die Fokusansicht die ganze Einheit im Protokoll an. Ein
    // solcher, nie angefasster Eintrag der gesperrten Übung darf sie über die
    // Zuordnung „angezeigt = trainiert" nicht zurückholen.
    const gesehen = { ...halb, db: { ...halb.db }, soll: { ...halb.soll } };
    lage.liste.slice(2).forEach((x) => {
      gesehen.db[x.id] = Array.from({ length: x.sets }, () => ({ w: '', done: false }));
      gesehen.soll[x.id] = x.sets;
    });
    await setze({
      greeted: true, mode: 'db', focus: lage.f, injuries: [fall.id], planStand: { [lage.f]: lage.alt }, log: { [lage.n]: gesehen },
    });
    const sicht = await lies(lage.n);
    check(sicht.fest.length > 0 && !ids(sicht.fest).some((id) => fall.weg.includes(id)),
      `ein bloß angezeigter Eintrag holt die gesperrte Übung nicht zurück (${ids(sicht.fest).join(', ')})`);
    check(gleich(sicht.ex, sicht.fest), `und die App zeigt genau die feste Liste (${sicht.ex.join(' ')})`);

    // Eine *reparierte* Liste trägt den Plan, aus dem sie vervollständigt
    // wurde (festErsetzen()). Mit aktiver Beschwerde repariert, Beschwerde
    // danach abgehakt: Das ist keine zweite Reparatur wert.
    const altKurz = lage.liste.slice(0, 2).map(({ id, sets }) => ({ id, sets }));
    await setze({
      greeted: true, mode: 'db', focus: lage.f, injuries: [fall.id], planStand: { [lage.f]: lage.stand },
      log: { [lage.n]: { ...halb, fest: altKurz } },
    });
    await page.waitForTimeout(300);
    const repMit = await lies(lage.n);
    check(repMit.umbau && repMit.umbau.repariert && repMit.eintrag.festAus,
      `mit ${fall.id} repariert, und die Liste trägt den Vermerk (${repMit.fest.length} Übungen, festAus ${repMit.eintrag.festAus})`);
    await setze({
      greeted: true, mode: 'db', focus: lage.f, injuries: [], planStand: { [lage.f]: lage.stand },
      log: { [lage.n]: repMit.eintrag },
    });
    await page.waitForTimeout(300);
    const repOhne = await lies(lage.n);
    check(repOhne.fest.join(' ') === repMit.fest.join(' ') && !(repOhne.umbau && repOhne.umbau.repariert),
      `nach dem Abhaken der Beschwerde keine zweite „Reparatur" (${repOhne.fest.length} Übungen, ${JSON.stringify(repOhne.umbau)})`);
  }

  // --- 9b. Festgeschrieben aus dem Protokoll – ohne passenden Plan davor ------
  // Wurde eine Fassung übersprungen, kennt die App den Plan davor nicht und
  // schreibt aus dem Protokoll fest. Das ist seit v216 vollständig, was die
  // Fokusansicht gezeigt hat. Beim nächsten Start darf festReparieren() diese
  // Liste nicht gegen einen Plan „reparieren", aus dem sie gar nicht stammt.
  const vierVonAllen = { ...halb, db: { ...halb.db }, soll: { ...halb.soll } };
  lage.liste.slice(2, -1).forEach((x) => {
    vierVonAllen.db[x.id] = Array.from({ length: x.sets }, () => ({ w: '', done: false }));
    vierVonAllen.soll[x.id] = x.sets;
  });
  await setze({
    greeted: true, mode: 'db', focus: lage.f, planStand: { [lage.f]: 'aaaaaaaaaaaa' }, log: { [lage.n]: vierVonAllen },
  });
  const proto = await lies(lage.n);
  check(proto.fest.length === lage.liste.length - 1 && !!proto.eintrag.festAus,
    `ohne passenden Plan davor aus dem Protokoll festgeschrieben, mit Vermerk (${proto.fest.length} Übungen, festAus ${proto.eintrag.festAus})`);
  await setze({
    greeted: true, mode: 'db', focus: lage.f, planStand: { [lage.f]: lage.stand }, log: { [lage.n]: proto.eintrag },
  });
  await page.waitForTimeout(300);
  const proto2 = await lies(lage.n);
  check(proto2.fest.join(' ') === proto.fest.join(' ') && !(proto2.umbau && proto2.umbau.repariert)
      && !/wieder vollständig|Fehler in der App/.test(proto2.text),
    `beim nächsten Start keine „Reparatur" gegen einen fremden Plan (${proto2.fest.length} Übungen, ${JSON.stringify(proto2.umbau)})`);
}

// Eine Einheit im Plan davor mit einer Übung, die eine leichtere Fassung hat
// (das hängende Knieheben) – hinter dem ersten Paar und nicht als letzte, damit
// sie weder im Protokoll eines v214-Stands steht noch beim Reparieren fehlt.
const stufe = await page.evaluate(async () => {
  const { PLANS } = await import('./js/data.js');
  const { EX_BY_ID } = await import('./js/uebung.js');
  const leicht = (id) => {
    const l = (EX_BY_ID.get(id) || {}).anfaenger;
    return l && EX_BY_ID.has(l) ? l : null;
  };
  for (const f of Object.keys(PLANS)) {
    const v = PLANS[f].vorher;
    if (!v) continue;
    const i = v.ex.findIndex((l) => l.length >= 4 && l.slice(2, -1).some(([id]) => leicht(id)));
    if (i < 0) continue;
    const liste = v.ex[i].map(([id, sets]) => ({ id, sets, leicht: leicht(id) }));
    const j = liste.findIndex((x, k) => k >= 2 && x.leicht);
    return { f, stand: PLANS[f].stand, alt: v.stand, n: i + 1, liste, j };
  }
  return null;
});
if (!stufe) {
  console.log('     kein Plan davor mit einer Übung in zwei Fassungen – 6. und 7. entfallen');
} else {
  const { liste, j } = stufe;
  console.log(`     ${stufe.f}, Einheit ${stufe.n}: ${liste[j].id} → ${liste[j].leicht} für Anfänger`);
  // Was ein Anfänger an diesem Tag sah, und was im Protokoll eines v214-Stands
  // steht: nur das erste Paar, das erste davon mit einem Satz.
  const anfaenger = liste.map((x) => ({ ...x, id: x.leicht || x.id }));
  // Satzzahl wie satzZahl() in js/stufen.js: Fortgeschritten ein Drittel mehr.
  const saetze = (x, faktor = 1) => Math.max(1, Math.round(x.sets * faktor));
  const protokoll = (zeige, faktor = 1) => {
    const [p, q] = zeige;
    const satz = (x, d) => Array.from({ length: saetze(x, faktor) }, (_, i) => (i < d ? { w: '20', done: true } : {}));
    return {
      mode: 'db', startedOn: '2026-09-29', bw: {},
      db: { [p.id]: satz(p, 1), [q.id]: satz(q, 0) },
      soll: { [p.id]: saetze(p, faktor), [q.id]: saetze(q, faktor) },
    };
  };
  const erwartet = (zeige, faktor = 1) => zeige.map((x) => `${x.id}:${saetze(x, faktor)}`);

  // --- 6. Planwechsel: Anfänger, eigene Wahl, Fortgeschritten ------------
  const faelle = [
    { was: 'Anfänger', level: 'anfaenger', zeige: anfaenger },
    { was: 'eigene Wahl', level: 'geuebt', fassung: { [liste[j].id]: liste[j].leicht },
      zeige: liste.map((x, k) => (k === j ? { ...x, id: x.leicht } : x)) },
    { was: 'Fortgeschritten', level: 'fortgeschritten', zeige: liste, faktor: 4 / 3 },
  ];
  for (const fall of faelle) {
    const faktor = fall.faktor || 1;
    await setze({
      greeted: true, mode: 'db', focus: stufe.f, level: fall.level, ...(fall.fassung ? { fassung: fall.fassung } : {}),
      planStand: { [stufe.f]: stufe.alt },
      log: { [stufe.n]: protokoll(fall.zeige, faktor) },
    });
    const r = await lies(stufe.n);
    const soll = erwartet(fall.zeige, faktor);
    check(r.fest.join(' ') === soll.join(' '),
      `${fall.was}: festgeschrieben wird, was angezeigt war (${r.fest.join(' ')})`);
    check(gleich(r.ex, r.fest), `${fall.was}: und so zeigt die App es auch (${r.ex.join(' ')})`);
  }

  // --- 7. Reparatur der Einheit eines Anfängers --------------------------
  // Festgeschrieben bis einschließlich der leichteren Fassung, der Rest fehlt.
  const kurz = anfaenger.slice(0, j + 1).map(({ id, sets }) => ({ id, sets }));
  await setze({
    greeted: true, mode: 'db', focus: stufe.f, level: 'anfaenger', planStand: { [stufe.f]: stufe.stand },
    log: { [stufe.n]: { ...protokoll(anfaenger), fest: kurz } },
  });
  await page.waitForTimeout(300);
  const anf = await lies(stufe.n);
  check(anf.fest.join(' ') === erwartet(anfaenger).join(' '),
    `die zu kurze Einheit eines Anfängers wird vervollständigt, mit ${liste[j].leicht} (${anf.fest.join(' ')})`);
  check(/wieder vollständig/.test(anf.text), 'und die App sagt es');

  // Seither aufgestiegen: Die feste Liste nennt noch die leichtere Fassung,
  // der Plan davor die schwerere. Erkannt wird sie trotzdem, und sie bleibt.
  await setze({
    greeted: true, mode: 'db', focus: stufe.f, level: 'geuebt', planStand: { [stufe.f]: stufe.stand },
    log: { [stufe.n]: { ...protokoll(anfaenger), fest: kurz } },
  });
  await page.waitForTimeout(300);
  const auf = await lies(stufe.n);
  check(auf.fest.join(' ') === [...erwartet(anfaenger.slice(0, j + 1)), ...erwartet(liste.slice(j + 1))].join(' '),
    `nach einem Aufstieg erkennt die Reparatur die leichtere Fassung wieder (${auf.fest.join(' ')})`);

  // --- 10. Was im Protokoll steht, geht vor -------------------------------
  // `soll` ist die Satzzahl jenes Tages. Im Fall „Fortgeschritten" oben steht
  // dort schon die Zahl der Stufe – die beiden Wege wären nicht zu
  // unterscheiden. Hier stand das Paar mit der Grundzahl da, und heute ist die
  // Stufe Fortgeschritten: das Paar behält sie, der Rest bekommt die der Stufe.
  await setze({
    greeted: true, mode: 'db', focus: stufe.f, level: 'fortgeschritten', planStand: { [stufe.f]: stufe.alt },
    log: { [stufe.n]: protokoll(liste) },
  });
  const vorrang = await lies(stufe.n);
  const mitSoll = [...erwartet(liste.slice(0, 2)), ...erwartet(liste.slice(2), 4 / 3)];
  check(vorrang.fest.join(' ') === mitSoll.join(' '),
    `soll aus dem Protokoll vor der Stufe: das Paar wie damals, der Rest wie heute (${vorrang.fest.join(' ')})`);
  check(gleich(vorrang.ex, vorrang.fest), `und so zeigt die App es auch (${vorrang.ex.join(' ')})`);

  // Als Anfänger angezeigt und trainiert – die leichtere Fassung mit einem
  // abgehakten Satz –, heute Geübt. Festgeschrieben wird, was gemacht wurde,
  // nicht die Fassung, die die heutige Stufe wählen würde.
  const geuebt = protokoll(anfaenger);
  geuebt.db[anfaenger[j].id] = Array.from({ length: anfaenger[j].sets }, (_, i) => (i ? {} : { w: '20', done: true }));
  geuebt.soll[anfaenger[j].id] = anfaenger[j].sets;
  await setze({
    greeted: true, mode: 'db', focus: stufe.f, level: 'geuebt', planStand: { [stufe.f]: stufe.alt },
    log: { [stufe.n]: geuebt },
  });
  const behalten = await lies(stufe.n);
  check(behalten.fest[j] === `${liste[j].leicht}:${liste[j].sets}`,
    `angezeigt und angefasst als ${liste[j].leicht}: bleibt fest, auch als Geübter (${behalten.fest.join(' ')})`);
  check(gleich(behalten.ex, behalten.fest), `und so zeigt die App es auch (${behalten.ex.join(' ')})`);
}

console.log(`\n${fails ? fails + ' FEHLER' : 'alle Prüfungen bestanden'}`);
console.log('ERRORS:', errs.length ? errs : 'none');
if (errs.length) process.exitCode = 1;
await browser.close();
