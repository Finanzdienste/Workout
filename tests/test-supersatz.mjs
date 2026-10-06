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
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { URL, ROOT } from './umgebung.mjs';

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

// --- 1b. Zwei Stangen, ein Scheibenvorrat -------------------------------
// „Goblet squad und Floor Press geht nicht im suoersatz weil man für beides
// 5kg Scheiben brauch" – verschiedene Stangen, aber dieselben Scheiben. Im
// Wechsel bleiben beide geladen, also müssen die Scheiben für beide reichen.
const vorrat = await page.evaluate(async () => {
  const { passtZusammen } = await import('./js/supersatz.js');
  const { zusammen } = await import('./js/scheiben.js');
  const store = await import('./js/store.js');
  const { EX_BY_ID } = await import('./js/uebung.js');
  const v = (id) => ({ id, ...EX_BY_ID.get(id).db });
  store.setWeight('goblet-squat', 10);
  store.setWeight('floor-press', 10);
  const mit = (scheiben) => {
    store.getState().scheiben = { stange: {}, scheiben };
    return passtZusammen(v('goblet-squat'), v('floor-press'), 'db');
  };
  return {
    zweiFuenfer: mit([[5, 2], [2.5, 2]]),     // je zwei 5er gebraucht, zwei da
    vierFuenfer: mit([[5, 4], [2.5, 2]]),     // reicht für beide
    ausweichen: mit([[5, 2], [2.5, 4]]),      // Floor Press geht mit 4× 2,5
    ohneVorrat: mit([]),                      // unbekannt: nicht raten
    rein: [
      zusammen([['goblet', 10], ['barbell', 10]], { stange: {}, scheiben: [[5, 2]] }),
      zusammen([['goblet', 10], ['barbell', 10]], { stange: {}, scheiben: [[5, 4]] }),
      zusammen([['dumbbells', 10], ['barbell', 5]], { stange: {}, scheiben: [[2.5, 10], [5, 2]] }),
    ],
  };
});
console.log('     Vorrat:', JSON.stringify(vorrat));
check(vorrat.zweiFuenfer === false,
  'Goblet 10 + Floor Press 10 mit nur zwei 5ern: kein Paar – die Scheiben müssten jeden Satz wandern');
check(vorrat.vierFuenfer === true, 'mit vier 5ern stehen beide Aufbauten – Paar');
check(vorrat.ausweichen === true, 'reicht es mit kleineren Scheiben, ist es auch ein Paar');
check(vorrat.ohneVorrat === true, 'ohne eingetragenen Vorrat bleibt es beim alten Verhalten');
check(vorrat.rein[0] === false && vorrat.rein[1] === true && vorrat.rein[2] === true,
  `zusammen() rechnet den Vorrat für alle Aufbauten zugleich (${vorrat.rein})`);

// --- 1c. Eine Scheibe auf der Brust hängt an keiner Stange --------------------
// „Wieso gibts heute keinen supersatz mit kurzhantel bodenpresse?" – Cut,
// Einheit 8: Bodenpresse, Pike-Liegestütze, Seitheben, Gewichtete Crunches,
// Wadenheben. Die Crunches liefen über ihre Rüstfamilie als „einzelne
// Kurzhantel" und damit als dieselbe Stange wie die Kurzhanteln der
// Bodenpresse. Kein Paar, auch wenn die Scheiben für beide reichten – der Floor
// Press an der Langhantel durfte mit denselben Crunches immer.
//
// Ein Paar gibt es aber nur, wenn der eingetragene Vorrat beweist, dass eine
// Scheibe für die Brust übrig bleibt. Ohne Vorrat kommt sie im Zweifel von der
// Hantel – dann wäre jeder Wechsel ein Umbau, und so rechnet auch der Plan.
const brust = await page.evaluate(async () => {
  const S = await import('./js/supersatz.js');
  const store = await import('./js/store.js');
  const { PLANS } = await import('./js/data.js');
  const { EX_BY_ID } = await import('./js/uebung.js');
  const x = (id) => ({ id });
  store.setWeight('kurzhantel-bodenpresse', 10);
  store.setWeight('gewichtete-crunches', 5);
  const mit = (scheiben) => {
    store.getState().scheiben = { stange: {}, scheiben };
    return S.passtZusammen(x('kurzhantel-bodenpresse'), x('gewichtete-crunches'), 'db');
  };
  const out = {
    reicht: mit([[5, 5]]),      // je Hand ein 5er-Paar, dazu einer für die Brust
    knapp: mit([[5, 4]]),       // der fünfte fehlt: die Scheibe müsste wandern
    ohneVorrat: mit([]),        // unbekannt: die Scheibe kommt von der Hantel
    gobletBodenpresse: S.passtZusammen(x('goblet-squat'), x('kurzhantel-bodenpresse'), 'db'),
  };
  store.getState().scheiben = { stange: {}, scheiben: [[5, 5]] };
  const w8 = PLANS.cut.plan.find((w) => w.n === 8);
  const paarung = () => S.paare(w8.ex.map((it) => ({ ...it, ...EX_BY_ID.get(it.id).db, id: it.id })), 'db')
    .map((g) => g.map((y) => y.id).join('+'));
  out.einheit8 = paarung();
  store.getState().scheiben = undefined;
  out.einheit8ohne = paarung();
  return out;
});
console.log('     Brust:', JSON.stringify(brust));
check(brust.reicht === true,
  'Bodenpresse + Gewichtete Crunches: reichen die Scheiben für beide, ist es ein Paar');
check(brust.knapp === false,
  'reicht der Vorrat nicht für Hanteln und Brustscheibe zugleich, bleibt es getrennt');
check(brust.ohneVorrat === false,
  'ohne eingetragenen Vorrat kein Paar – die Brustscheibe käme von der Hantel');
check(brust.gobletBodenpresse === false,
  'Goblet + Bodenpresse bleiben getrennt – dieselben Kurzhantelgriffe');
check(brust.einheit8.includes('kurzhantel-bodenpresse+gewichtete-crunches'),
  `Cut Einheit 8 mit Vorrat: die Bodenpresse läuft im Wechsel mit den Crunches (${brust.einheit8.join(' | ')})`);
check(!brust.einheit8ohne.includes('kurzhantel-bodenpresse+gewichtete-crunches'),
  `Cut Einheit 8 ohne Vorrat: wie bisher getrennt (${brust.einheit8ohne.join(' | ')})`);
// --- 1d. Ohne Hanteln zählt das Gerät der Bodyweight-Fassung --------------
// Gefunden bei der Durchsicht: Geräteregel und Scheibenprüfung lasen auch ohne
// Hanteln Gerät und Gewicht der Hantel-Fassung. Band-Reverse-Fly und Wadenheben
// liefen allein, weil Kurzhantel und einarmige Kurzhantel dieselben Griffe
// sind, und ein eingetragener Hantel-Scheibenvorrat stellte die Paarung von
// Band- und Körpergewichtsübungen um.
const ohneHanteln = await page.evaluate(async () => {
  const S = await import('./js/supersatz.js');
  const store = await import('./js/store.js');
  const P = await import('./js/plan.js');
  const { PLAN } = await import('./js/data.js');
  const x = (id) => ({ id });
  // Vorrat und Gewichte aus 1b stehen noch: Goblet 10 + Floor Press 10 bei zwei 5ern.
  store.getState().scheiben = { stange: {}, scheiben: [[5, 2], [2.5, 2]] };
  const knapp = {
    db: S.scheibenReichen(x('goblet-squat'), x('floor-press'), 'db'),
    bw: S.scheibenReichen(x('goblet-squat'), x('floor-press'), 'bw'),
    belegungBw: S.paarBelegung(x('goblet-squat'), x('floor-press'), 'bw'),
  };
  const paarung = () => PLAN.map((w) => S.paare(P.workoutByNo(w.n, 'bw').ex.map((y) => P.resolve(y, 'bw')), 'bw')
    .map((g) => g.map((y) => y.id).join('+')).join('|'));
  const mitVorrat = paarung();
  store.getState().scheiben = undefined;
  const ohneVorrat = paarung();
  return {
    flyWaden: {
      bw: S.passtZusammen(x('reverse-fly'), x('wadenheben-gebeugtes-knie'), 'bw'),
      db: S.passtZusammen(x('reverse-fly'), x('wadenheben-gebeugtes-knie'), 'db'),
    },
    liegestuetzRudern: S.passtZusammen(x('floor-press'), x('einarmiges-kh-rudern'), 'bw'),
    knapp,
    vorratAendert: mitVorrat.filter((g, i) => g !== ohneVorrat[i]).length,
  };
});
console.log('     ohne Hanteln:', JSON.stringify(ohneHanteln));
check(ohneHanteln.flyWaden.bw === true && ohneHanteln.flyWaden.db === false,
  'Band-Reverse-Fly + Wadenheben: ohne Hanteln ein Paar – nur die Hantel-Fassungen teilen sich die Griffe');
check(ohneHanteln.liegestuetzRudern === true,
  'Liegestütze + Band-Rudern: ohne Hanteln ein Paar, obwohl Floor Press und Rudern an derselben Stange hängen');
check(ohneHanteln.knapp.db === false && ohneHanteln.knapp.bw === true && ohneHanteln.knapp.belegungBw === null,
  'die Scheibenprüfung gilt nur mit Hanteln – ohne liegt keine Scheibe auf');
check(ohneHanteln.vorratAendert === 0,
  `ein Hantel-Scheibenvorrat ändert keine Paarung ohne Hanteln (${ohneHanteln.vorratAendert} Einheiten anders)`);

// --- 1e. Die Belegung für beide zugleich --------------------------------------
// Gefunden auf dem Weg durch die App: Floor Press 40 + Gewichtete Crunches 5
// bei 4× 1,25 / 4× 2,5 / 4× 5 / 2× 10 waren ein Paar, weil es zusammen geht.
// Die Rüstzeile rechnete aber jede Übung für sich: alle vier 5er auf die
// Stange, und für die Brust „1× 5 kg", die nicht mehr daliegt.
const gemeinsam = await page.evaluate(async () => {
  const SC = await import('./js/scheiben.js');
  const satz = { stange: {}, scheiben: [[1.25, 4], [2.5, 4], [5, 4], [10, 2]] };
  const fall = SC.zusammenBelegung([['barbell', 40], ['plate', 5]], satz);
  const andersrum = SC.zusammenBelegung([['plate', 5], ['barbell', 40]], satz);
  // Passen die Belegungen für sich nebeneinander, bleiben es genau die.
  const frei = SC.zusammenBelegung([['barbell', 40], ['plate', 5]],
    { stange: {}, scheiben: [[1.25, 4], [2.5, 4], [5, 6], [10, 2]] });
  // Gegengeprüft an einer vollständigen Aufzählung: gleiche Antwort wie
  // zusammen(), Ziel erreicht, Vorrat eingehalten, und nie mehr Scheiben als
  // die beste Aufteilung überhaupt.
  const alleWege = (equip, kg, s) => {
    const r = SC.RASTER[equip];
    const ziel = Math.round(kg * 4) / 4;
    const out = [];
    const geh = (j, rest, wahl) => {
      if (Math.abs(rest) < 1e-9) { out.push(wahl.slice()); return; }
      if (j >= s.scheiben.length) return;
      const [w, anzahl] = s.scheiben[j];
      for (let k = 0; k <= Math.floor(anzahl / r.pro) && r.faktor * k * w <= rest + 1e-9; k++) {
        if (k) wahl.push([w, k]);
        geh(j + 1, Math.round((rest - r.faktor * k * w) * 4) / 4, wahl);
        if (k) wahl.pop();
      }
    };
    geh(0, ziel, []);
    return out;
  };
  const stueck = (b, equip) => b.reduce((s, [, k]) => s + k * SC.RASTER[equip].pro, 0);
  let seed = 11;
  const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const fehler = [];
  let geprueft = 0;
  let umgestellt = 0;
  for (let t = 0; t < 400 && fehler.length < 3; t++) {
    const s = SC.normSatz({ stange: {}, scheiben: Array.from({ length: 1 + Math.floor(rnd() * 3) },
      () => [pick([1.25, 2.5, 5, 10]), 1 + Math.floor(rnd() * 6)]) });
    const lasten = [0, 1].map(() => {
      const e = pick(['barbell', 'goblet', 'dumbbells', 'plate']);
      const liste = SC.erreichbar(e, s) || [0];
      return [e, pick(liste.slice(1).length ? liste.slice(1) : liste)];
    });
    const ist = SC.zusammenBelegung(lasten, s);
    const ob = SC.zusammen(lasten, s);
    let besteZahl = Infinity;
    alleWege(...lasten[0], s).forEach((a) => alleWege(...lasten[1], s).forEach((b) => {
      const braucht = new Map();
      [[a, lasten[0][0]], [b, lasten[1][0]]].forEach(([x, e]) => x.forEach(([w, k]) =>
        braucht.set(w, (braucht.get(w) || 0) + k * SC.RASTER[e].pro)));
      if (s.scheiben.every(([w, n]) => (braucht.get(w) || 0) <= n)) {
        besteZahl = Math.min(besteZahl, stueck(a, lasten[0][0]) + stueck(b, lasten[1][0]));
      }
    }));
    if ((ist !== null) !== (ob === true)) { fehler.push(`ja/nein anders: ${JSON.stringify({ lasten, s: s.scheiben, ob })}`); continue; }
    if (!ist) continue;
    geprueft++;
    const summe = (b, e) => b.reduce((x, [w, k]) => x + SC.RASTER[e].faktor * k * w, 0);
    const braucht = new Map();
    ist.forEach((b, i) => b.forEach(([w, k]) => braucht.set(w, (braucht.get(w) || 0) + k * SC.RASTER[lasten[i][0]].pro)));
    const zahl = stueck(ist[0], lasten[0][0]) + stueck(ist[1], lasten[1][0]);
    if (ist.some((b, i) => Math.abs(summe(b, lasten[i][0]) - lasten[i][1]) > 1e-9)
      || !s.scheiben.every(([w, n]) => (braucht.get(w) || 0) <= n)
      || zahl !== besteZahl) {
      fehler.push(JSON.stringify({ lasten, s: s.scheiben, ist, zahl, besteZahl }));
    }
    if (JSON.stringify(ist) !== JSON.stringify(lasten.map(([e, kg]) => SC.belegung(kg, e, s)))) umgestellt++;
  }
  return { fall, andersrum, frei, fehler, geprueft, umgestellt };
});
console.log('     gemeinsame Belegung:', JSON.stringify({ fall: gemeinsam.fall, frei: gemeinsam.frei,
  geprueft: gemeinsam.geprueft, umgestellt: gemeinsam.umgestellt }));
check(JSON.stringify(gemeinsam.fall) === JSON.stringify([[[10, 1], [5, 2]], [[2.5, 2]]]),
  `Floor Press 40 + Crunches 5: je Seite 10 + 2× 5, auf die Brust 2× 2,5 – die 5er sind an der Stange (${
    JSON.stringify(gemeinsam.fall)})`);
check(JSON.stringify(gemeinsam.andersrum) === JSON.stringify([gemeinsam.fall[1], gemeinsam.fall[0]]),
  'andersherum gefragt dieselbe Aufteilung');
check(JSON.stringify(gemeinsam.frei) === JSON.stringify([[[10, 1], [5, 2]], [[5, 1]]]),
  'reicht der Vorrat für beide Belegungen für sich, bleiben es genau die');
check(gemeinsam.fehler.length === 0 && gemeinsam.geprueft > 100 && gemeinsam.umgestellt > 5,
  `zufällige Paare: Ziel erreicht, Vorrat eingehalten, so wenig Scheiben wie überhaupt möglich (${
    gemeinsam.geprueft} geprüft, ${gemeinsam.umgestellt} anders als je für sich)${
    gemeinsam.fehler.length ? ': ' + gemeinsam.fehler.join(' | ') : ''}`);

await page.evaluate(async () => {
  const store = await import('./js/store.js');
  store.getState().scheiben = undefined;
  delete store.getState().weights['goblet-squat'];
  delete store.getState().weights['floor-press'];
});

// --- 1c. zusammen() rechnet schnell – und dasselbe wie vorher ------------
// Gefunden bei der Durchsicht: Die erste Fassung zählte alle Belegungen des
// ersten Aufbaus auf, ohne sich etwas zu merken. Scheitert das Paar bei einem
// großen Vorrat, lief das im Hauptthread 1,4 s (4 Größen × 40) bis 25 s
// (6 Größen × 20) – bei jedem Neuzeichnen. Die Antwort darf sich dabei nicht
// ändern: Gegengeprüft wird an genau dieser alten Aufzählung, über viele
// zufällige Sätze.
const schnell = await page.evaluate(async () => {
  const { zusammen, normSatz, erreichbar, belegung, RASTER } = await import('./js/scheiben.js');
  const satzVon = (spec) => ({ stange: {}, scheiben: spec.map(([w, k]) => [w, k]) });
  const faelle = [
    [[[1.25, 40], [2.5, 40], [5, 40], [10, 40]], [['goblet', 300], ['barbell', 460]], false],
    [[[1.25, 20], [2.5, 20], [5, 20], [10, 20], [15, 20], [20, 20]], [['goblet', 500], ['barbell', 580]], false],
  ];
  const zeiten = faelle.map(([spec, lasten, soll]) => {
    const t0 = performance.now();
    const ist = zusammen(lasten, satzVon(spec));
    return { ms: Math.round(performance.now() - t0), ok: ist === soll };
  });
  // Die alte Aufzählung, wörtlich – als Maßstab für die Antwort.
  const basisVon = (r, satz) => (r.stange ? (satz.stange[r.stange] || 0) : 0);
  const alt = (lasten, satz) => {
    const offen = lasten.filter(([equip]) => RASTER[equip]);
    const geht = (i, vorrat) => {
      if (i >= offen.length) return true;
      const [equip, kg] = offen[i];
      const r = RASTER[equip];
      const ziel = Math.round(((kg || 0) - basisVon(r, satz)) * 4) / 4;
      if (ziel < 1e-9) return geht(i + 1, vorrat);
      const suche = (j, rest, v) => {
        if (Math.abs(rest) < 1e-9) return geht(i + 1, v);
        if (j >= v.length || rest < -1e-9) return false;
        const [w, anzahl] = v[j];
        const maxK = Math.min(Math.floor(anzahl / r.pro), Math.floor((rest + 1e-9) / (r.faktor * w)));
        for (let k = maxK; k >= 0; k--) {
          const nv = k ? v.map((z, x) => (x === j ? [w, anzahl - k * r.pro] : z)) : v;
          if (suche(j + 1, Math.round((rest - r.faktor * k * w) * 4) / 4, nv)) return true;
        }
        return false;
      };
      return suche(0, ziel, vorrat);
    };
    if (offen.some(([equip, kg]) => (kg || 0) > basisVon(RASTER[equip], satz) && !belegung(kg, equip, satz))) return null;
    return geht(0, satz.scheiben.map((z) => z.slice()));
  };
  let seed = 7;
  const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const GROESSEN = [0.5, 1, 1.25, 2, 2.5, 4, 5, 7.5, 10, 15, 20];
  const GERAETE = Object.keys(RASTER);
  let gleich = 0;
  const anders = [];
  const zaehl = { true: 0, false: 0, null: 0 };
  for (let t = 0; t < 3000; t++) {
    const satz = normSatz({
      stange: { kh: rnd() < 0.3 ? 2 : null, lh: rnd() < 0.3 ? 10 : null },
      scheiben: Array.from({ length: 1 + Math.floor(rnd() * 5) }, () => [pick(GROESSEN), 1 + Math.floor(rnd() * 8)]),
    });
    const summe = satz.scheiben.reduce((x, [w, k]) => x + w * k, 0);
    const lasten = [0, 1].map(() => {
      const e = pick(GERAETE);
      const liste = erreichbar(e, satz);
      return [e, liste && rnd() < 0.8 ? pick(liste) : Math.round(rnd() * summe * 2) / 4];
    });
    const a = alt(lasten, satz);
    const b = zusammen(lasten, satz);
    zaehl[String(b)]++;
    if (a === b) gleich++;
    else if (anders.length < 3) anders.push(JSON.stringify({ lasten, satz: satz.scheiben, alt: a, neu: b }));
  }
  return { zeiten, gleich, anders, zaehl };
});
console.log('     zusammen():', JSON.stringify(schnell.zeiten), JSON.stringify(schnell.zaehl));
check(schnell.zeiten.every((z) => z.ok), 'die großen Vorräte geben die richtige Antwort');
check(schnell.zeiten.every((z) => z.ms < 50),
  `und zwar in unter 50 ms je Paar (${schnell.zeiten.map((z) => z.ms).join(', ')} ms)`);
check(schnell.anders.length === 0 && schnell.zaehl.true > 300 && schnell.zaehl.false > 300,
  `3000 zufällige Sätze: dieselbe Antwort wie die alte Aufzählung (${schnell.gleich} gleich)${
    schnell.anders.length ? ': ' + schnell.anders.join(' | ') : ''}`);

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

// --- 7b. Die Leiste unten folgt der angezeigten Übung ----------------------
// „Bei supersatz soll unten die pausenzeit angezeigt werden von der Übung die
// grad angezeigt wird" – im Wechsel laufen zwei Pausen, eine je Übung.
const leiste = () => page.evaluate(() => {
  const b = document.getElementById('restBar');
  return {
    an: !!b && !b.hidden,
    text: b ? document.getElementById('restNext').textContent : '',
    zeit: b ? document.getElementById('restTime').textContent : '',
    name: document.querySelector('.focus-name').textContent.trim(),
  };
});
// Jetzt steht B (Satz 1 von A ist durch). B abhaken → A mit Restpause.
await page.locator('.focus-set, .set-btn').first().click();
await page.waitForTimeout(600);
const beiA = await leiste();
console.log('     bei A:', JSON.stringify(beiA));
check(beiA.name === erst && beiA.an && beiA.text.includes(erst),
  `nach Satz 1 von B steht A da, unten mit der Pause von A (${beiA.text})`);
// Zum Partner wischen: Unten steht jetzt dessen Pause, nicht mehr die von A.
const idxB = await page.evaluate((nm) => [...document.querySelectorAll('.prog-ex')]
  .findIndex((b) => b.getAttribute('aria-label').includes(nm)), zweit);
await page.locator(`[data-act="focus-goto"][data-i="${idxB}"]`).click();
await page.waitForTimeout(400);
const beiB = await leiste();
console.log('     bei B:', JSON.stringify(beiB));
check(beiB.name === zweit && beiB.an && beiB.text.includes(zweit) && !beiB.text.includes(erst),
  `beim Partner zeigt die Leiste dessen Pause (${beiB.text})`);
// Zurück zu A: wieder die von A, und die Zeit lief weiter statt neu anzufangen.
await page.locator('[data-act="focus-step"][data-d="-1"]').first().click();
await page.waitForTimeout(400);
const zurueck = await leiste();
const sek = (z) => { const [m, x] = z.split(':').map(Number); return m * 60 + x; };
console.log('     zurück bei A:', JSON.stringify(zurueck));
check(zurueck.name === erst && zurueck.an && zurueck.text.includes(erst) && sek(zurueck.zeit) <= sek(beiA.zeit),
  `zurück bei A steht wieder A's Pause, weitergelaufen (${beiA.zeit} → ${zurueck.zeit})`);
// Weggetippt bleibt weggetippt, auch nach Hin- und Herwischen.
await page.locator('#restSkip').click();
await page.waitForTimeout(200);
await page.locator(`[data-act="focus-goto"][data-i="${idxB}"]`).click();
await page.waitForTimeout(300);
await page.locator('[data-act="focus-step"][data-d="-1"]').first().click();
await page.waitForTimeout(300);
const weg = await leiste();
check(weg.name === erst && !weg.an, 'eine weggetippte Pause kommt beim Zurückwischen nicht wieder');
// Und nach dem Neuladen der Seite liest die Leiste dieselbe Uhr.
await page.locator(`[data-act="focus-goto"][data-i="${idxB}"]`).click();
await page.waitForTimeout(300);
const vorher = await leiste();
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(500);
if (!(await page.locator('.focus-name').count())) {
  await page.locator('[data-act="start-session"]').first().click();
  await page.waitForTimeout(400);
}
await page.locator(`[data-act="focus-goto"][data-i="${idxB}"]`).click();
await page.waitForTimeout(300);
const nachLaden = await leiste();
console.log('     nach dem Laden bei B:', JSON.stringify(nachLaden), 'vorher', JSON.stringify(vorher));
check(vorher.an && nachLaden.an && nachLaden.text.includes(zweit),
  'nach dem Neuladen steht beim Partner weiter seine Pause');

// --- Supersätze kosten keine Umbauten ---------------------------------------
//
// Gefunden bei der Durchsicht der App: Eine Kurzhantel und ein Kurzhantel-Paar
// galten als verschiedene Geräte, laufen aber über dieselben Griffe. Im
// Wechsel hieß das: zwischen jedem Satz umbauen. Über die 84 Einheiten des
// Aufbau-Plans waren es mit Supersätzen 404 Umbauten statt 296.
//
// Gezählt wird Satz für Satz: Jedes Mal, wenn eine Stange ein anderes Gewicht
// braucht als zuletzt, ist das ein Umbau.
const STANGE = { kh2: 'kh', kh1: 'kh', lh: 'lh', sz: 'sz', ruck: 'ruck' };
for (const fokus of ['standard', 'bbp', 'cut', 'oberkoerper']) {
  // Über den Speicher der App, nicht an ihm vorbei: Beim Neuladen schreibt sie
  // ihren Stand zurück und überschriebe ein direkt gesetztes `focus`.
  await page.evaluate(async (f) => {
    const s = await import('./js/store.js');
    s.setSetting('focus', f);
    s.setSetting('greeted', true);
    s.flush();
  }, fokus);
  await page.reload({ waitUntil: 'networkidle' });
  const geladen = await page.evaluate(async () => (await import('./js/data.js')).FOCUS.name);
  check(geladen && geladen === (await page.evaluate(async (f) => (await import('./js/data.js')).PLANS[f].name, fokus)),
    `${fokus}: der Plan dieses Fokus ist geladen (${geladen})`);
  const r = await page.evaluate(async (stange) => {
    const P = await import('./js/plan.js');
    const S = await import('./js/supersatz.js');
    const G = await import('./js/gewichte.js');
    const { PLAN } = await import('./js/data.js');
    const zaehle = (folge) => {
      const stand = {};
      let z = 0;
      folge.forEach((id) => {
        const a = G.setupOf(id, G.workingWeight(id));
        if (!a) return;
        const k = a.fam + '|' + a.kg;
        if (stand[stange[a.fam]] !== k) { z++; stand[stange[a.fam]] = k; }
      });
      return z;
    };
    let aus = 0;
    let an = 0;
    PLAN.forEach((w) => {
      const items = P.workoutByNo(w.n, 'db').ex.map((x) => P.resolve(x, 'db'));
      aus += zaehle(items.flatMap((it) => Array(it.sets).fill(it.id)));
      an += zaehle(S.paare(items, 'db').flatMap((g) => S.schritte(g).map((x) => x.id)));
    });
    return { aus, an };
  }, STANGE);
  check(r.an <= r.aus + 2,
    `${fokus}: Supersätze kosten keine zusätzlichen Umbauten (ohne ${r.aus}, mit ${r.an})`);
}

// --- Ab hier je Abschnitt eine frische Seite ------------------------------
const neueSeite = async (vorher) => {
  const c = await browser.newContext({ viewport: { width: 414, height: 896 } });
  await c.route('**/rest/v1/**', (r) => r.fulfill({ status: 204, body: '' }));
  if (vorher) await c.addInitScript(vorher);
  const p = await c.newPage();
  p.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message));
  return p;
};
const mitStand = async (p, stand) => {
  await p.goto(URL, { waitUntil: 'networkidle' });
  await p.evaluate((s) => localStorage.setItem('workout.state.v1', JSON.stringify(s)), stand);
  await p.reload({ waitUntil: 'networkidle' });
  await p.waitForTimeout(300);
};
const leisteAuf = (p) => p.evaluate(() => {
  const b = document.getElementById('restBar');
  return {
    an: !!b && !b.hidden,
    text: b ? document.getElementById('restNext').textContent : '',
    zeit: b ? document.getElementById('restTime').textContent : '',
    fuell: b ? parseFloat(document.getElementById('restFill').style.width) : NaN,
    name: document.querySelector('.focus-name')?.textContent.trim(),
    hin: [...document.querySelectorAll('.super-hin')].map((e) => e.textContent.trim()).join(' | '),
  };
});
const idxVon = (p, nm) => p.evaluate((nm) => [...document.querySelectorAll('.prog-ex')]
  .findIndex((b) => b.getAttribute('aria-label').includes(nm)), nm);
const zeige = async (p, nm) => {
  await p.locator(`[data-act="focus-goto"][data-i="${await idxVon(p, nm)}"]`).click();
  await p.waitForTimeout(300);
};
const haken = async (p) => {
  await p.locator('.focus-set:not(.on)').first().click();
  await p.waitForTimeout(500);
};
const name = async (p) => (await p.locator('.focus-name').textContent()).trim();

// --- 8. Die Paarung steht, sobald trainiert wird ---------------------------
// Gefunden bei der Durchsicht: Seit die Scheiben mitreden, hängt ein Paar am
// Gewicht. Ein Tipp auf + mitten im Supersatz löste es auf – der Hinweis
// „Im Wechsel mit …" verschwand, die App blieb bei derselben Übung, und die
// angefangene Partnerübung rutschte hinter das nächste Paar. Jetzt bleibt das
// Paar; reichen die Scheiben nicht mehr für beide, sagt die App, dass
// umzustecken ist. Auch nach dem Neuladen, und die Vorschau unter Mehr zeigt
// dasselbe.
{
  const p = await neueSeite();
  await mitStand(p, { greeted: true, name: 'T', level: 'geuebt', shift: 0, log: {}, supersatz: true, mode: 'db' });
  // Gesucht wird ein Paar, das mit einem Vorrat zusammen passt und nach einem
  // Schritt + an einer der beiden nicht mehr – über die Einheiten des Plans,
  // damit der Test nicht an einer einzelnen Übung hängt.
  const fall = await p.evaluate(async () => {
    const P = await import('./js/plan.js');
    const S = await import('./js/supersatz.js');
    const G = await import('./js/gewichte.js');
    const SC = await import('./js/scheiben.js');
    const store = await import('./js/store.js');
    const { PLAN } = await import('./js/data.js');
    const { EX_BY_ID } = await import('./js/uebung.js');
    const VORRAETE = [
      [[1.25, 4], [2.5, 4], [5, 2], [10, 4]], [[1.25, 4], [2.5, 4], [5, 4], [10, 2]],
      [[1.25, 2], [2.5, 4], [5, 4], [10, 2]], [[2.5, 4], [5, 4], [10, 2]], [[1.25, 4], [2.5, 4], [5, 4], [10, 4]],
    ];
    for (const w of PLAN) {
      for (const scheiben of VORRAETE) {
        store.setSetting('scheiben', { stange: {}, scheiben });
        const items = P.workoutByNo(w.n, 'db').ex.map((x) => P.resolve(x, 'db'));
        const gruppen = S.paare(items, 'db');
        for (const g of gruppen) {
          if (g.length < 2 || !g.every((x) => SC.RASTER[EX_BY_ID.get(x.id).equip])) continue;
          const lasten = g.map((x) => [EX_BY_ID.get(x.id).equip, G.workingWeight(x.id) || 0]);
          if (SC.zusammen(lasten, G.meinSatz()) !== true) continue;
          for (const [k, x] of g.entries()) {
            const neu = G.naechstesGewicht(x.id, 1);
            const danach = lasten.map((l, i) => (i === k ? [l[0], neu] : l));
            if (neu > lasten[k][1] && SC.zusammen(danach, G.meinSatz()) === false) {
              store.setSetting('scheiben', null);
              return {
                n: w.n, scheiben, hoch: x.id,
                a: g[0].name, b: g[1].name, namen: Object.fromEntries(g.map((y) => [y.id, y.name])),
              };
            }
          }
        }
      }
    }
    store.setSetting('scheiben', null);
    return null;
  });
  console.log('     Paar, das knapp wird:', JSON.stringify(fall));
  check(!!fall, 'es gibt im Plan ein Paar, das ein Schritt + über den Vorrat hebt');
  if (fall) {
    await p.evaluate(async (scheiben) => {
      const s = await import('./js/store.js');
      s.setSetting('scheiben', { stange: {}, scheiben });
      s.flush();
    }, fall.scheiben);
    await p.reload({ waitUntil: 'networkidle' });
    await p.waitForTimeout(300);
    for (let i = 0; i < 100; i++) {
      const t = await p.locator('#view').textContent();
      if (new RegExp(`Workout ${fall.n}\\b`).test(t)) break;
      await p.locator('[data-act="nav-workout"][data-delta="1"]').first().click();
      await p.waitForTimeout(80);
    }
    await p.locator('[data-act="start-session"]').first().click();
    await p.waitForTimeout(400);
    await zeige(p, fall.a);
    const start = await leisteAuf(p);
    check(start.hin.includes(`Im Wechsel mit ${fall.b}`), `${fall.a} steht im Wechsel mit ${fall.b}`);
    await haken(p);                       // A1
    check(await name(p) === fall.b, 'nach A1 geht es zum Partner');
    await haken(p);                       // B1
    const hoch = fall.namen[fall.hoch];
    const partner = hoch === fall.a ? fall.b : fall.a;
    if (await name(p) !== hoch) await zeige(p, hoch);
    await p.locator(`[data-act="weight-step"][data-ex="${fall.hoch}"][data-dir="1"]`).first().click();
    await p.waitForTimeout(400);
    const nachPlus = await leisteAuf(p);
    console.log('     nach +:', nachPlus.name, '|', nachPlus.hin);
    check(nachPlus.hin.includes(`Im Wechsel mit ${partner}`),
      'nach + mitten im Paar bleibt der Wechsel – das Paar kippt nicht');
    check(/Scheiben reichen nicht für beide/.test(nachPlus.hin),
      'und es steht da, dass die Scheiben nicht mehr für beide reichen');
    if (await name(p) !== fall.a) await zeige(p, fall.a);
    await haken(p);                       // A2
    check(await name(p) === fall.b,
      `nach A2 geht es weiter zum Partner, nicht zur nächsten Gruppe (${await name(p)})`);
    // Neu geladen – das neue Gewicht ist da, die Paarung bleibt.
    await p.reload({ waitUntil: 'networkidle' });
    await p.waitForTimeout(400);
    if (!(await p.locator('.focus-name').count())) {
      await p.locator('[data-act="start-session"]').first().click();
      await p.waitForTimeout(400);
    }
    await zeige(p, fall.a);
    check((await leisteAuf(p)).hin.includes(`Im Wechsel mit ${fall.b}`), 'auch nach dem Neuladen');
    await p.locator('.tab[data-tab="settings"]').click();
    await p.waitForTimeout(400);
    const mehr = (await p.locator('#view').textContent()).replace(/\s+/g, ' ');
    check(mehr.includes(`${fall.a} im Wechsel mit ${fall.b}`) && /Scheiben reichen nicht für beide/.test(mehr),
      'die Vorschau unter Mehr zeigt dasselbe Paar, mit demselben Hinweis');
  }
  await p.context().close();
}

// --- 9. Nach „Training fortsetzen" steht unten die Pause der gezeigten Übung --
// Gefunden bei der Durchsicht: Zum Partner gewischt, mit Zurück aufs Dashboard,
// „Training fortsetzen" – oben die Liegestütze, unten „Satz 2 von 3 · Pull-ups".
// Und „Fertig" beendete dann die Pause der Pull-ups.
{
  const p = await neueSeite();
  await mitStand(p, { greeted: true, name: 'T', level: 'geuebt', shift: 0, log: {}, supersatz: true });
  await p.locator('[data-act="start-session"]').first().click();
  await p.waitForTimeout(400);
  const a = await name(p);
  await haken(p);
  const b = await name(p);
  await haken(p);
  await zeige(p, b);
  check((await leisteAuf(p)).text.includes(b), 'beim Partner steht dessen Pause');
  await p.goBack();
  await p.waitForTimeout(400);
  await p.locator('[data-act="start-session"]').first().click();
  await p.waitForTimeout(400);
  const weiter = await leisteAuf(p);
  console.log('     nach „Training fortsetzen":', JSON.stringify(weiter));
  check(weiter.name === a && weiter.an && weiter.text.includes(a) && !weiter.text.includes(b),
    `nach „Training fortsetzen" passt die Leiste zur gezeigten Übung (${weiter.name} / ${weiter.text})`);

  // --- 9b. „+30 s" beim Partner, weg und zurück: der Balken bleibt im Rahmen
  // Das Ganze, an dem der Balken misst, kannte die 30 s nicht: 177 s von 150 –
  // 118 %, eine halbe Minute lang ein voller Balken.
  await zeige(p, b);
  await p.locator('#restPlus').click();
  await p.waitForTimeout(200);
  await zeige(p, a);
  await zeige(p, b);
  const plus = await leisteAuf(p);
  console.log('     nach +30 s, weg und zurück:', JSON.stringify(plus));
  check(plus.an && plus.text.includes(b) && plus.fuell <= 100 && plus.fuell > 90,
    `nach +30 s, weg- und zurückgewischt: Balken bei ${plus.fuell.toFixed(1)} %, nicht über 100`);
  await p.context().close();
}

// --- 10. Wegwischen nimmt der laufenden Pause nicht ihr Signal ---------------
// Gefunden bei der Durchsicht: Zu einer Übung ohne eigene Pause gewischt, war
// die Pause samt Ton und Systemmeldung weg; zum Partner gewischt, klingelte es
// zu dessen Ende statt zu dem der Übung, die als Nächste dran ist. Das Signal
// gehört der Pause, auf die der Ablauf wartet – die Leiste zeigt trotzdem die
// der gezeigten Übung.
{
  const p = await neueSeite(() => {
    window.__post = [];
    Object.defineProperty(navigator.serviceWorker, 'controller', {
      configurable: true, get: () => ({ postMessage: (m) => window.__post.push(m) }),
    });
    window.Notification = class {
      static get permission() { return 'granted'; }
      static requestPermission() { return Promise.resolve('granted'); }
      close() {}
    };
    navigator.vibrate = (x) => { window.__vibrate = x; return true; };
    // Vorgemerkte und abgesagte Töne mitzählen: cancelSound() stoppt sie ohne
    // Zeitangabe.
    window.__vorgemerkt = 0;
    window.__abgesagt = 0;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const orig = Ctx.prototype.createOscillator;
    Ctx.prototype.createOscillator = function (...x) {
      const osc = orig.apply(this, x);
      const uhr = this;
      const start = osc.start.bind(osc);
      osc.start = (wann = 0) => { if (wann - uhr.currentTime > 1) window.__vorgemerkt++; return start(wann); };
      const stop = osc.stop.bind(osc);
      osc.stop = (...y) => { if (!y.length) window.__abgesagt++; return stop(...y); };
      return osc;
    };
  });
  await mitStand(p, {
    greeted: true, name: 'T', level: 'geuebt', shift: 0, log: {}, supersatz: true,
    notify: true, sound: true, restSeconds: 6, useExerciseRest: false,
  });
  const laeuft = () => p.evaluate(async () => (await import('./js/store.js')).getState().rest);
  const aus = () => p.evaluate(() => window.__post.filter((m) => m.typ === 'pause-aus').length);
  await p.locator('[data-act="start-session"]').first().click();
  await p.waitForTimeout(400);
  const a = await name(p);
  await haken(p);
  const b = await name(p);
  await haken(p);
  const pause = await laeuft();
  check(pause && pause.next.includes(a), `nach B1 läuft die Pause von ${a}`);
  check(await p.evaluate(() => window.__vorgemerkt) > 0, 'und ihr Ton liegt auf der Uhr');
  await p.evaluate(() => { window.__post.length = 0; window.__abgesagt = 0; });
  await zeige(p, b);
  const beiB = await leisteAuf(p);
  const nochA = await laeuft();
  check(beiB.an && beiB.text.includes(b), 'beim Partner zeigt die Leiste dessen Pause');
  check(nochA && nochA.endsAt === pause.endsAt && await aus() === 0,
    'das Signal bleibt aber bei der Pause, auf die der Ablauf wartet');
  const c = await p.evaluate((nm) => [...document.querySelectorAll('.prog-ex')]
    .map((x) => x.getAttribute('aria-label')).find((l, k) => k > 1 && / 0 von /.test(l) && !l.includes(nm)), a);
  await zeige(p, c.split(',')[1].trim());
  const beiC = await leisteAuf(p);
  check(!beiC.an, `bei einer Übung ohne eigene Pause (${beiC.name}) ist die Leiste weg`);
  check(!!(await laeuft()) && await aus() === 0 && await p.evaluate(() => window.__abgesagt) === 0,
    'aber Ton und Systemmeldung der laufenden Pause bleiben vorgemerkt');
  const bis = pause.endsAt - await p.evaluate(() => Date.now());
  await p.waitForTimeout(Math.max(0, bis) + 700);
  const toast = await p.evaluate(() => document.getElementById('toast')?.textContent || '');
  check(/Pause vorbei/.test(toast) && await p.evaluate(() => Array.isArray(window.__vibrate)),
    `am Ende der Pause meldet sie sich trotzdem, auch wenn eine andere Übung zu sehen ist (${toast})`);
  check(!(await laeuft()), 'und ist danach vorbei');
  await p.context().close();
}

// --- Die Zahlen im README, je Modus ------------------------------------------
// Gezählt, wie die App die Einheit zusammenstellt (workoutByNo() und
// resolve()), mit den Startgewichten und ohne Vorrat. Dort stand lange eine
// Zahl aus der Zeit vor der letzten Neuverteilung der Pläne, und „mit und ohne
// Hanteln gleich" stimmte nur, weil ohne Hanteln nach dem Hantelgerät gepaart
// wurde.
{
  const p = await neueSeite();
  const summe = { db: { e: 0, p: 0, a: 0 }, bw: { e: 0, p: 0, a: 0 } };
  for (const fokus of ['standard', 'bbp', 'cut', 'oberkoerper']) {
    await mitStand(p, { greeted: true, focus: fokus });
    const z = await p.evaluate(async () => {
      const P = await import('./js/plan.js');
      const S = await import('./js/supersatz.js');
      const { PLAN } = await import('./js/data.js');
      const out = {};
      ['db', 'bw'].forEach((m) => {
        const g = PLAN.flatMap((w) => S.paare(P.workoutByNo(w.n, m).ex.map((x) => P.resolve(x, m)), m));
        out[m] = { e: PLAN.length, p: g.filter((x) => x.length === 2).length, a: g.filter((x) => x.length === 1).length };
      });
      return out;
    });
    ['db', 'bw'].forEach((m) => ['e', 'p', 'a'].forEach((k) => { summe[m][k] += z[m][k]; }));
  }
  const { db, bw } = summe;
  const je = (x) => (x.p / x.e).toFixed(1).replace('.', ',');
  console.log(`     README: mit Hanteln ${db.p} Paare / ${db.a} allein (${je(db)}), ohne ${bw.p} / ${bw.a} (${je(bw)}) in ${db.e} Einheiten`);
  const readme = readFileSync(path.join(ROOT, 'README.md'), 'utf8').replace(/\s+/g, ' ');
  check(readme.includes(`Über alle ${db.e} Einheiten`)
    && readme.includes(`mit Hanteln im Schnitt **${je(db)} Paare je Einheit** (${db.p} Paare, ${db.a} Übungen bleiben allein)`)
    && readme.includes(`ohne Hanteln **${je(bw)}** (${bw.p} Paare, ${bw.a} allein)`),
  'die Supersatz-Zahlen im README stimmen mit der Rechnung überein, je Modus');
  check(bw.p > db.p, 'ohne Hanteln finden sich mehr Paare – da trennt fast nur der Muskel');
  await p.context().close();
}

// Bis zur Einheit `n` blättern und sie starten.
const starte = async (p, n) => {
  for (let i = 0; i < 100; i++) {
    const t = await p.locator('#view').textContent();
    if (new RegExp(`Workout ${n}\\b`).test(t)) break;
    await p.locator('[data-act="nav-workout"][data-delta="1"]').first().click();
    await p.waitForTimeout(80);
  }
  await p.locator('[data-act="start-session"]').first().click();
  await p.waitForTimeout(400);
};
const ruestZeile = async (p) => (await p.locator('.ruest').count()
  ? (await p.locator('.ruest').first().textContent()).replace(/\s+/g, ' ').trim() : '');

// --- 11. Im Paar nennt die Rüstzeile beider Übungen dieselbe Belegung ---------
// Aufbau, Workout 3: Floor Press 40 kg im Wechsel mit Gewichtete Crunches 5 kg,
// Vorrat 4× 1,25 / 4× 2,5 / 4× 5 / 2× 10. Je für sich gerechnet kamen alle
// vier 5er an die Stange, und die Crunches sollten „1× 5 kg" auf die Brust
// legen – die es dann nicht mehr gibt.
{
  const p = await neueSeite();
  await mitStand(p, {
    greeted: true, name: 'T', level: 'geuebt', focus: 'standard', shift: 0, log: {}, supersatz: true, mode: 'db',
    weights: { 'floor-press': 40, 'gewichtete-crunches': 5 },
    scheiben: { stange: { kh: null, sz: null, lh: null }, scheiben: [[1.25, 4], [2.5, 4], [5, 4], [10, 2]] },
  });
  const nm = await p.evaluate(async () => {
    const { EX_BY_ID } = await import('./js/uebung.js');
    return { fp: EX_BY_ID.get('floor-press').db.name, cr: EX_BY_ID.get('gewichtete-crunches').db.name };
  });
  await starte(p, 3);
  await zeige(p, nm.fp);
  const fp = { hin: (await leisteAuf(p)).hin, ruest: await ruestZeile(p) };
  await zeige(p, nm.cr);
  const cr = { hin: (await leisteAuf(p)).hin, ruest: await ruestZeile(p) };
  console.log('     Floor Press:', JSON.stringify(fp));
  console.log('     Crunches:   ', JSON.stringify(cr));
  check(fp.hin.includes(`Im Wechsel mit ${nm.cr}`) && cr.hin.includes(`Im Wechsel mit ${nm.fp}`),
    'Floor Press und Crunches stehen im Wechsel');
  check(/je Seite 1× 10 \+ 2× 5 kg/.test(fp.ruest), `beim Floor Press: je Seite 10 + 2× 5 (${fp.ruest})`);
  check(/\(2× 2,5 kg\)/.test(cr.ruest) && !/1× 5 kg/.test(cr.ruest),
    `bei den Crunches die Scheiben, die dann noch daliegen: 2× 2,5 statt 1× 5 (${cr.ruest})`);
  check(!/Scheiben reichen nicht/.test(fp.hin + cr.hin), 'und kein Umsteck-Hinweis – es geht ja');
  await p.context().close();
}

// --- 12. Ohne Hanteln kein Scheiben-Hinweis, auch bei festgehaltener Paarung --
// Bei einer festgehaltenen Paarung und danach geändertem Vorrat stand unter
// Band- und Körpergewichtsübungen „Die Scheiben reichen nicht für beide
// Aufbauten – zwischen den Sätzen umstecken": geprüft wurde das Hantelgewicht.
{
  const p = await neueSeite();
  await mitStand(p, { greeted: true, name: 'T', level: 'geuebt', shift: 0, log: {}, supersatz: true, mode: 'bw' });
  // Je für sich lassen sich beide mit vier 5ern stecken, zusammen nicht – mit
  // Hanteln hieße das umstecken.
  const fall = await p.evaluate(async () => {
    const P = await import('./js/plan.js');
    const store = await import('./js/store.js');
    const { EX_BY_ID } = await import('./js/uebung.js');
    const { PLAN } = await import('./js/data.js');
    const KG = { barbell: 20, hipbar: 20, szbar: 20, goblet: 20, onehand: 20, plate: 20, dumbbells: 10 };
    for (const w of PLAN) {
      const ids = P.workoutByNo(w.n, 'bw').ex.map((x) => x.id);
      const zwei = ids.filter((id) => KG[EX_BY_ID.get(id).equip]).slice(0, 2);
      if (zwei.length < 2) continue;
      zwei.forEach((id) => store.setWeight(id, KG[EX_BY_ID.get(id).equip]));
      store.setSetting('scheiben', { stange: {}, scheiben: [[5, 4]] });
      store.setPaarung(w.n, 'bw', {
        key: ids.slice().sort().join(','),
        gruppen: [zwei, ...ids.filter((id) => !zwei.includes(id)).map((id) => [id])],
      });
      store.flush();
      return { n: w.n, namen: zwei.map((id) => EX_BY_ID.get(id).bw.name) };
    }
    return null;
  });
  check(!!fall, 'es gibt eine Einheit mit zwei Übungen, deren Hantel-Fassungen Scheiben brauchen');
  if (fall) {
    await p.reload({ waitUntil: 'networkidle' });
    await p.waitForTimeout(300);
    for (let i = 0; i < 100; i++) {
      if (new RegExp(`Workout ${fall.n}\\b`).test(await p.locator('#view').textContent())) break;
      await p.locator('[data-act="nav-workout"][data-delta="1"]').first().click();
      await p.waitForTimeout(80);
    }
    await p.locator('.tab[data-tab="settings"]').click();
    await p.waitForTimeout(400);
    const mehr = (await p.locator('#view').textContent()).replace(/\s+/g, ' ');
    check(mehr.includes(`${fall.namen[0]} im Wechsel mit ${fall.namen[1]}`) && !/Scheiben reichen nicht/.test(mehr),
      `Vorschau ohne Hanteln (Workout ${fall.n}): ${fall.namen[0]} ↔ ${fall.namen[1]}, ohne Scheiben-Hinweis`);
    await p.locator('.tab[data-tab="dashboard"]').click();
    await p.waitForTimeout(300);
    await p.locator('[data-act="start-session"]').first().click();
    await p.waitForTimeout(400);
    await zeige(p, fall.namen[0]);
    const hin = (await leisteAuf(p)).hin;
    check(hin.includes(`Im Wechsel mit ${fall.namen[1]}`) && !/Scheiben reichen nicht/.test(hin),
      `im Training ohne Hanteln: kein „Scheiben reichen nicht" (${hin})`);
  }
  await p.context().close();
}

check(errs.length === 0, `keine Fehler${errs.length ? ': ' + errs.slice(0, 2).join(' | ') : ''}`);
console.log(`\n${fails ? fails + ' FEHLER' : 'alle Prüfungen bestanden'}`);
await browser.close();
