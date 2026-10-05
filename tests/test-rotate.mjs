import { chromium } from 'playwright';
import { URL, SHOT } from './umgebung.mjs';
const browser = await chromium.launch();
// Reduzierte Bewegung stellt die Figur still – nur so verändert allein das
// Ziehen die Stellung. clearFigures() taugt dafür nicht mehr: es meldet die
// Figur inzwischen vollständig ab, samt der Listener fürs Drehen.
const page = await browser.newPage({ viewport: { width: 414, height: 896 }, reducedMotion: 'reduce' });
const errs = [];
page.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()); });
let fails = 0;
const check = (c, m) => { console.log(`${c ? 'OK  ' : 'FAIL'} ${m}`); if (!c) { fails++; process.exitCode = 1; } };

await page.goto(URL, { waitUntil: 'networkidle' });
await page.evaluate(() => { localStorage.clear(); localStorage.setItem('workout.state.v1', '{"greeted":true}'); });
await page.reload({ waitUntil: 'networkidle' });
await page.locator('[data-act="start-session"]').first().click();
await page.waitForTimeout(300);

const torso = () => page.locator('.focus-fig .fig-torso').first().getAttribute('points');
const before = await torso();

const box = await page.locator('.focus-fig').boundingBox();
const cx = box.x + box.width / 2; const cy = box.y + box.height / 2;
const drag = async (dx, dy) => {
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + dx, cy + dy, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(80);
  return torso();
};

const afterYaw = await drag(120, 0);
check(before !== afterYaw, 'waagerechtes Ziehen dreht um die Hochachse');
const afterPitch = await drag(0, 120);
check(afterYaw !== afterPitch, 'senkrechtes Ziehen kippt um die Querachse');
const afterDiag = await drag(-90, -70);
check(afterPitch !== afterDiag, 'schräges Ziehen dreht in beiden Achsen');

// Unbegrenzt: auch nach mehreren vollen Umdrehungen geht es weiter
let prev = afterDiag;
let kept = true;
for (let i = 0; i < 6; i++) {
  const next = await drag(400, 260);
  if (next === prev) kept = false;
  prev = next;
}
check(kept, 'Drehen bleibt unbegrenzt, auch über volle Umdrehungen hinaus');

// Der Boden ist eine Fläche im Raum und kippt mit.
// Nicht jede Übung hat einen: wer an der Stange hängt, steht auf nichts.
// Also zur ersten Übung weiterblättern, die einen Boden zeigt.
for (let i = 0; i < 8 && await page.locator('.fig-ground').count() === 0; i++) {
  await page.locator('[data-act="focus-step"][data-d="1"]').click();
  await page.waitForTimeout(200);
}
check(await page.locator('.fig-ground').count() > 0, 'Übung mit Boden gefunden');
const g1 = await page.locator('.fig-ground').getAttribute('points');
await drag(0, 90);
const g2 = await page.locator('.fig-ground').getAttribute('points');
check(g1 !== g2, 'Bodenfläche kippt mit');
check(await page.locator('.focus-fig line.fig-ground').count() === 0, 'kein Bodenstrich mehr, der wie ein Regler aussieht');

check(await page.locator('.fig-hint').count() === 1, 'Hinweis zum Drehen vorhanden');
check(await page.locator('.fig-hint.gone').count() === 1, 'Hinweis verschwindet nach der ersten Berührung');
await page.screenshot({ path: `${SHOT}/96-rotated.png` });

// Gerät sichtbar: Kurzhantel-Paar bei Seitheben. Welche Einheit die Übung
// enthält, sagt der Plan – seit die Ziele je Muskelgruppe verschieden sind,
// steht sie nicht mehr zwangsläufig in Workout 1.
const gearOf = async (name) => {
  const schritte = await page.evaluate(async (n) => {
    const { PLAN, EXERCISES } = await import('./js/data.js');
    const id = EXERCISES.find((e) => e.db.name === n).id;
    return PLAN.findIndex((w) => w.ex.some((x) => x.id === id));
  }, name);
  await page.locator('[data-act="finish-session"]').click();
  await page.waitForTimeout(200);
  for (let i = 0; i < schritte; i++) {
    await page.locator('[data-act="nav-workout"][data-delta="1"]').click();
    await page.waitForTimeout(80);
  }
  await page.locator('[data-act="start-session"]').first().click();
  await page.waitForTimeout(250);
  for (let i = 0; i < 10; i++) {
    if ((await page.locator('.focus-name').textContent()) === name) break;
    await page.locator('[data-act="focus-step"][data-d="1"]').click();
    await page.waitForTimeout(120);
  }
  check((await page.locator('.focus-name').textContent()) === name, `${name} in der Fokus-Ansicht gefunden`);
  // Griffe ohne die Stummel hinter den Scheiben; je Hantelende eine große
  // und eine kleine Scheibe (fig-scheibe), also vier je Hantel.
  return { bars: await page.locator('.fig-bar:not(.fig-bar-stummel)').count(), plates: await page.locator('.fig-scheibe').count() };
};
const seit = await gearOf('Sitzendes Seitheben');
console.log('     Seitheben:', JSON.stringify(seit));
check(seit.bars === 2 && seit.plates === 8, 'Seitheben: zwei Kurzhanteln, je vier Scheiben');

// Gerät je Art, unabhängig vom Plan des Tages: Figur direkt aufhängen
const gear = await page.evaluate(async () => {
  const { mountFigure } = await import('./js/figure.js');
  const out = {};
  for (const [key, pattern, equip] of [
    ['goblet', 'squat', 'goblet'],
    ['einhand', 'row', 'onehand'],
    ['langhantel', 'curl', 'barbell'],
  ]) {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const h = mountFigure(host, pattern, true, equip);
    h.stop();
    h.setView(0, 0);
    h.draw(0);
    const bar = host.querySelector('.fig-bar:not(.fig-bar-stummel)');
    const plates = [...host.querySelectorAll('.fig-scheibe')];
    out[key] = {
      bars: host.querySelectorAll('.fig-bar:not(.fig-bar-stummel)').length,
      plates: plates.length,
      dx: bar ? Math.abs(+bar.getAttribute('x2') - +bar.getAttribute('x1')) : null,
      dy: bar ? Math.abs(+bar.getAttribute('y2') - +bar.getAttribute('y1')) : null,
      mx: bar ? (+bar.getAttribute('x2') + +bar.getAttribute('x1')) / 2 : null,
    };
    host.remove();
  }
  return out;
});
console.log('     Geräte:', JSON.stringify(gear));
check(gear.goblet.bars === 1 && gear.goblet.plates === 4, 'Goblet Squat: genau eine Hantel');
check(gear.goblet.dy > gear.goblet.dx * 3, 'Goblet Squat: Hantel steht senkrecht');
check(Math.abs(gear.goblet.mx - 50) < 4, 'Goblet Squat: Hantel mittig vor dem Körper, also in beiden Händen');
check(gear.einhand.bars === 1 && gear.einhand.plates === 4, 'Rudern: eine Kurzhantel in einer Hand');
check(gear.langhantel.bars === 1 && gear.langhantel.dx > gear.goblet.dy * 1.5, 'SZ-Curls: eine lange, waagerechte Stange');

// Durchsicht der Figuren: Kopf, Stange, Rucksack. Alles am gezeichneten Bild
// gemessen, in einem Kasten von der Form der Übungskarte (346 × 198) bzw.
// quadratisch, wo es um eine Achse geht.
const durchsicht = await page.evaluate(async () => {
  const { mountFigure, PATTERNS } = await import('./js/figure.js');
  const mach = (pattern, equip, t, view, w = 346, h = 198) => {
    const host = document.createElement('div');
    host.style.cssText = `width:${w}px;height:${h}px;position:fixed;left:0;top:0;background:#000`;
    document.body.appendChild(host);
    const f = mountFigure(host, pattern, true, equip);
    f.stop();
    if (view) f.setView(...view);
    f.draw(t);
    return host;
  };
  const punkte = (n) => n.getAttribute('points').trim().split(/\s+/).map((s) => s.split(',').map(Number));
  const out = {};
  // Der Kopf liegt vor der Halskapsel – sonst steht ihr runder Abschluss mit
  // Rand mitten im Gesicht.
  out.kopf = [];
  Object.keys(PATTERNS).forEach((p) => [0, 1].forEach((t) => {
    const host = mach(p, null, t);
    const kinder = [...host.querySelector('svg g').children];
    const kopf = kinder.findIndex((n) => n.classList.contains('fig-head'));
    const hals = kinder.findIndex((n) => n.classList.contains('fig-hals'));
    if (hals < 0 || kopf < hals) out.kopf.push(`${p} t${t}`);
    host.remove();
  }));
  // Hip Thrust von vorn: Wie viel der Stange zwischen den Scheiben ist zu sehen?
  {
    const host = mach('thrust', 'hipbar', 1, [-80, 0], 400, 400);
    const ends = [...host.querySelectorAll('line.fig-bar:not(.fig-bar-stummel)')]
      .flatMap((b) => [[+b.getAttribute('x1'), +b.getAttribute('y1')], [+b.getAttribute('x2'), +b.getAttribute('y2')]]);
    const a = ends.reduce((p, q) => (q[0] < p[0] ? q : p));
    const b = ends.reduce((p, q) => (q[0] > p[0] ? q : p));
    const svg = host.querySelector('svg'); const box = svg.getBoundingClientRect(); const vb = svg.viewBox.baseVal;
    let sicht = 0; const N = 40;
    for (let i = 1; i < N; i++) {
      const x = a[0] + ((b[0] - a[0]) * i) / N; const y = a[1] + ((b[1] - a[1]) * i) / N;
      const e = document.elementFromPoint(box.left + ((x - vb.x) / vb.width) * box.width, box.top + ((y - vb.y) / vb.height) * box.height);
      if (e && e.classList.contains('fig-bar')) sicht++;
    }
    out.hipbar = sicht / (N - 1);
    host.remove();
  }
  // Face Pull: die feste Stange liegt ganz im Bild, in der Karte wie im Quadrat.
  out.facepull = [[346, 198], [300, 300]].flatMap(([w, h]) => [0, 1].map((t) => {
    const host = mach('facepull', 'band', t, null, w, h);
    const vb = host.querySelector('svg').viewBox.baseVal;
    const l = host.querySelector('.fig-bar-fixed');
    const drin = [[+l.getAttribute('x1'), +l.getAttribute('y1')], [+l.getAttribute('x2'), +l.getAttribute('y2')]]
      .every(([x, y]) => x >= 0 && x <= vb.width && y >= 0 && y <= vb.height);
    host.remove();
    return drin;
  }));
  // Gehaltener Rucksack, von vorn: je Hand eine Schlaufe (zwei Striche, die sich
  // an der Hand treffen), deren andere Enden am Rucksack liegen; der Rucksack
  // hängt lotrecht und unter den Händen.
  out.halten = [['curl', 0], ['curl', 1], ['rowbar', 0], ['rowbar', 1]].map(([p, t]) => {
    const host = mach(p, 'backpack', t, [0, 0], 400, 400);
    const straps = [...host.querySelectorAll('.fig-strap')]
      .map((s) => [[+s.getAttribute('x1'), +s.getAttribute('y1')], [+s.getAttribute('x2'), +s.getAttribute('y2')]]);
    const pk = [...host.querySelectorAll('.fig-pack, .fig-pack-seite')].flatMap(punkte);
    const bb = pk.length ? [Math.min(...pk.map((q) => q[0])), Math.min(...pk.map((q) => q[1])),
      Math.max(...pk.map((q) => q[0])), Math.max(...pk.map((q) => q[1]))] : [0, 0, 0, 0];
    const zumKasten = ([x, y]) => Math.hypot(Math.max(bb[0] - x, 0, x - bb[2]), Math.max(bb[1] - y, 0, y - bb[3]));
    const key = (q) => q.map((v) => v.toFixed(1)).join(',');
    const zahl = new Map();
    straps.flat().forEach((q) => zahl.set(key(q), (zahl.get(key(q)) || 0) + 1));
    const haende = straps.flat().filter((q) => zahl.get(key(q)) >= 2);
    const andere = straps.flat().filter((q) => zahl.get(key(q)) < 2);
    const aussen = host.querySelector('.fig-pack');
    let schief = 1;
    if (aussen) {
      const q = punkte(aussen);
      schief = Math.max(...q.map((e, i) => {
        const n = q[(i + 1) % q.length];
        const dx = Math.abs(n[0] - e[0]); const dy = Math.abs(n[1] - e[1]);
        return Math.min(dx, dy) / Math.max(dx, dy, 1e-9);
      }));
    }
    host.remove();
    return {
      name: `${p} t${t}`, schlaufen: straps.length, haende: new Set(haende.map(key)).size,
      hand: haende.length ? Math.max(...haende.map(zumKasten)) : Infinity,
      ende: andere.length ? Math.max(...andere.map(zumKasten)) : Infinity,
      unter: haende.length ? Math.min(...haende.map(([, y]) => bb[1] - y)) : -1,
      schief,
    };
  });
  // Getragener Rucksack: sichtbare Fläche im Standardblick der Karte.
  out.tragen = {};
  ['pushup', 'invrow'].forEach((p) => [0, 1].forEach((t) => {
    const host = mach(p, 'backpack', t, null);
    out.tragen[`${p} t${t}`] = [...host.querySelectorAll('.fig-pack, .fig-pack-seite')].reduce((acc, f) => {
      const q = punkte(f);
      return acc + Math.abs(q.reduce((a2, e, i) => { const n = q[(i + 1) % q.length]; return a2 + e[0] * n[1] - n[0] * e[1]; }, 0) / 2);
    }, 0);
    host.remove();
  }));
  return out;
});
console.log('     Durchsicht:', JSON.stringify(durchsicht));
check(durchsicht.kopf.length === 0,
  `der Kopf liegt vor dem Hals, kein Heiligenschein${durchsicht.kopf.length ? ' – dahinter: ' + durchsicht.kopf.join(', ') : ''}`);
check(durchsicht.hipbar > 0.3,
  `Hip Thrust von vorn: die Stange ist zwischen den Scheiben zu sehen (${(durchsicht.hipbar * 100).toFixed(0)} % des Griffs)`);
check(durchsicht.facepull.every(Boolean), 'Face Pull: die Stange, an der das Band hängt, liegt ganz im Bild');
durchsicht.halten.forEach((h) => {
  check(h.schlaufen === 4 && h.haende === 2,
    `${h.name}: Rucksack an zwei Schlaufen, je eine zur Hand (${h.schlaufen} Striche, ${h.haende} Hände)`);
  check(h.ende < 0.5 && h.hand < 10,
    `${h.name}: die Schlaufen reichen vom Rucksack (${h.ende.toFixed(1)}) bis an die Hand (${h.hand.toFixed(1)} vom Rucksack)`);
  check(h.unter > 0 && h.schief < 0.05,
    `${h.name}: er hängt lotrecht unter den Händen (Oberkante ${h.unter.toFixed(1)} darunter, Neigung ${h.schief.toFixed(3)})`);
});
Object.entries(durchsicht.tragen).forEach(([k, a]) => {
  check(a > 10, `${k}: der getragene Rucksack ist ein Kasten, kein Strich (Fläche ${a.toFixed(1)})`);
});

// Liegende Muster liegen aus jedem Blickwinkel – Kopf links, Körper flach
const lying = await page.evaluate(async () => {
  const { mountFigure } = await import('./js/figure.js');
  const out = {};
  for (const key of ['press', 'triceps', 'crunch', 'pushup', 'legcurl', 'thrust', 'curl']) {
    out[key] = [];
    // Nicht yaw 90: von dort schaut man einer liegenden Figur auf die
      // Fußsohlen, da ist sie zwangsläufig schmal und hoch.
      for (const [yaw, pitch] of [[25, 8], [0, 0], [200, 20], [340, -15]]) {
      const host = document.createElement('div');
      document.body.appendChild(host);
      const h = mountFigure(host, key, true, null);
      h.stop(); h.setView(yaw, pitch); h.draw(0);
      // Über getBBox gemessen: unabhängig davon, aus welchen Formen die Figur
      // gerade gebaut ist. Der Boden zählt nicht mit, der ist immer breit.
      const g = host.querySelector('svg > g');
      const only = [...g.children].filter((n) => !n.classList.contains('fig-ground'));
      const bb = only.reduce((acc, n) => {
        const b = n.getBBox();
        return acc ? {
          x: Math.min(acc.x, b.x), y: Math.min(acc.y, b.y),
          r: Math.max(acc.r, b.x + b.width), b: Math.max(acc.b, b.y + b.height),
        } : { x: b.x, y: b.y, r: b.x + b.width, b: b.y + b.height };
      }, null);
      const head = host.querySelector('.fig-head');
      out[key].push({
        w: bb.r - bb.x,
        h: bb.b - bb.y,
        headX: +head.getAttribute('cx'),
        midX: (bb.r + bb.x) / 2,
      });
      host.remove();
    }
  }
  return out;
});
for (const key of ['press', 'triceps', 'crunch', 'legcurl', 'thrust']) {
  const v = lying[key];
  check(v.every((s) => s.w > s.h), `${key}: liegt flach aus allen vier Blickwinkeln`);
  check(v[0].headX < v[0].midX && v[1].headX < v[1].midX, `${key}: Kopf liegt links`);
}
check(lying.pushup.every((s) => s.w > s.h), 'pushup: Stütz bleibt waagerecht');
check(lying.curl.every((s) => s.h > s.w), 'curl: stehende Übung bleibt aufrecht');

// Sitzendes Seitheben sitzt auch wirklich – auf einer Bank
const seat = await page.evaluate(async () => {
  const { mountFigure } = await import('./js/figure.js');
  const out = {};
  for (const key of ['lateral', 'curl']) {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const h = mountFigure(host, key, true, 'dumbbells');
    h.stop(); h.setView(90, 0); h.draw(0);
    const y = (sel) => [...host.querySelectorAll(sel)]
      .flatMap((n) => (n.tagName === 'line'
        ? [+n.getAttribute('y1'), +n.getAttribute('y2')]
        : n.getAttribute('points').split(' ').map((q) => +q.split(',')[1])));
    out[key] = {
      bench: host.querySelectorAll('.fig-bench').length,
      legs: host.querySelectorAll('.fig-bench-leg').length,
      seatY: Math.min(...y('.fig-bench')),
      hipY: (() => { const b = host.querySelector('.fig-torso'); return b ? Math.max(...y('.fig-torso')) : null; })(),
    };
    host.remove();
  }
  return out;
});
console.log('     Bank:', JSON.stringify(seat));
check(seat.lateral.bench === 4 && seat.lateral.legs === 4, 'Seitheben: Bank mit Sitzfläche, Kanten und vier Beinen');
check(seat.curl.bench === 0, 'stehende Übungen bekommen keine Bank');
check(seat.lateral.seatY > seat.lateral.hipY - 2, 'Figur sitzt auf der Bank, nicht darüber');

// Klimmzug: oben liegt der Ellenbogen unter der Schulter, nicht darüber
const chin = await page.evaluate(async () => {
  const { mountFigure } = await import('./js/figure.js');
  const out = [];
  for (const t of [0, 1]) {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const h = mountFigure(host, 'pullup', false, null);
    h.stop(); h.setView(0, 0); h.draw(t);
    const bar = host.querySelector('.fig-bar-fixed');
    const kopf = host.querySelector('.fig-head');
    // Gelenke sind Flächen; die Höhe je Glied über die Bounding-Box
    const glieder = [...host.querySelectorAll('path.fig-limb')].map((n) => n.getBBox());
    out.push({
      stange: (+bar.getAttribute('y1') + +bar.getAttribute('y2')) / 2,
      kopf: +kopf.getAttribute('cy'),
      arme: glieder.length,
    });
    host.remove();
  }
  return out;
});
console.log('     Klimmzug:', JSON.stringify(chin));
check(chin[0].kopf - chin[0].stange > 5, 'Klimmzug unten: Kopf hängt deutlich unter der Stange');
check(chin[1].kopf - chin[1].stange < 0, 'Klimmzug oben: Kopf ist über der Stange');
check(chin[0].stange.toFixed(0) === chin[1].stange.toFixed(0), 'Stange bleibt stehen, der Körper bewegt sich');

// Hände: links das Spiegelbild von rechts, und keine klappt um.
//
// Liegt die gewünschte Daumenrichtung fast längs des Unterarms, nimmt die
// Figur eine Ersatzrichtung. Bis v218 war das für beide Hände dieselbe Achse –
// links nach innen, rechts nach außen –, und die rechte Hand klappte mitten in
// der Wiederholung um 180° um: Kniebeuge ohne Gewicht, Hammercurl, Pull-Apart,
// Reverse Fly. Mit ihr wechselte bei der Faust die sichtbare Fingerseite, also
// genau das, woran man den Griff erkennen soll:
//
//     „Man soll bei jeder Übung auch die Finger sehen können damit man sieht
//      obs Ober- oder Untergriff ist"
//
// Gemessen am gezeichneten Pfad, nicht an Zwischenwerten der Rechnung. Von
// vorn gesehen ist bei diesen Übungen die eine Hand das Spiegelbild der
// anderen – vorher lagen die Ecken 1,5 bis 2,7 Einheiten daneben, und zwar
// genau an den Stellen hier. Und von einem Bild zum nächsten (Δt 0,005)
// ändert keine Hand mehr sprunghaft ihre Form: vorher 1,6 bis 2,9 beim
// Umklappen, jetzt 0,15 bis 0,31 (das Meiste beim Hammercurl).
const haende = await page.evaluate(async () => {
  const { mountFigure } = await import('./js/figure.js');
  // Ecken des Hand-Pfads: die Punkte von M und L und die Endpunkte der Bögen.
  const ecken = (d) => [...d.matchAll(/[ML](-?[\d.]+) (-?[\d.]+)|A[\d.]+ [\d.]+ 0 0 1 (-?[\d.]+) (-?[\d.]+)/g)]
    .map((m) => (m[1] !== undefined ? [+m[1], +m[2]] : [+m[3], +m[4]]));
  const naechste = (a, b) => Math.max(...a.map((p) => Math.min(...b.map((q) => Math.hypot(p[0] - q[0], p[1] - q[1])))));
  const abstand = (a, b) => Math.max(naechste(a, b), naechste(b, a));
  const out = {};
  for (const [pattern, equip, t] of [
    ['squatbw', null, 0.55], ['hammercurl', 'dumbbells', 0.6],
    ['pullapart', 'band', 0.95], ['reversefly', 'dumbbells', 0.02],
  ]) {
    // Feste Größe, damit die Maße unten etwas bedeuten: Ein Kasten ohne
    // Höhe bekommt ein flaches Sichtfeld und eine halb so große Figur.
    const host = document.createElement('div');
    host.style.cssText = 'width:300px;height:300px';
    document.body.appendChild(host);
    const h = mountFigure(host, pattern, true, equip);
    h.stop(); h.setView(0, 20);
    const pfade = () => [...host.querySelectorAll('path.fig-hand')].map((p) => ecken(p.getAttribute('d')));
    h.draw(t);
    const [a, b] = pfade();
    const mitte = +host.querySelector('.fig-head').getAttribute('cx');
    const spiegel = abstand(a.map(([x, y]) => [2 * mitte - x, y]), b);
    // Jede Hand gegen sich selbst im Bild davor, beide um ihren Schwerpunkt
    // verschoben: gemessen wird die Form, nicht der Weg.
    let sprung = 0;
    let davor = null;
    for (let i = 0; i <= 200; i++) {
      h.draw(i / 200);
      const jetzt = pfade().map((e) => {
        const sx = e.reduce((s, q) => s + q[0], 0) / e.length;
        const sy = e.reduce((s, q) => s + q[1], 0) / e.length;
        return { sx, e: e.map(([x, y]) => [x - sx, y - sy]) };
      }).sort((p, q) => p.sx - q.sx);
      if (davor) jetzt.forEach((x, k) => { sprung = Math.max(sprung, abstand(x.e, davor[k].e)); });
      davor = jetzt;
    }
    out[pattern] = { t, spiegel, sprung };
    host.remove();
  }
  return out;
});
console.log('     Hände:', JSON.stringify(haende, (k, v) => (typeof v === 'number' ? +v.toFixed(2) : v)));
Object.entries(haende).forEach(([pattern, v]) => {
  check(v.spiegel < 0.3,
    `${pattern} t=${v.t}: von vorn ist die eine Hand das Spiegelbild der anderen (${v.spiegel.toFixed(2)} daneben)`);
  check(v.sprung < 1,
    `${pattern}: keine Hand klappt von einem Bild zum nächsten um (größte Formänderung ${v.sprung.toFixed(2)})`);
});

// Ausschnitt: nichts ragt über den Rand – auch nicht Finger und Gerät.
//
// Der Radius des Ausschnitts zählte nur Gelenke und den Kopf. Im
// hochkantigen Kasten – in der Fokus-Ansicht auf dem Handy im Hochformat der
// Normalfall – schnitt der Rand beim Reverse Snow Angel die Fingerspitzen ab
// (4,5 von 100 Einheiten) und beim sitzenden Seitheben ein Stück der
// Hantelscheibe (1,6). Gemessen über getBBox jedes Teils, im Standardblick,
// für jede Übung des Katalogs in beiden Fassungen, im hochkantigen, im
// quadratischen und im flachen Kasten. Boden, Schatten und Bank zählen nicht,
// um sie geht es hier nicht (die Bank beim Hip Thrust reichte schon vorher
// hinter dem Kopf aus dem Bild).
const rand = await page.evaluate(async () => {
  const { mountFigure, figurGeraet } = await import('./js/figure.js');
  const { EXERCISES } = await import('./js/data.js');
  const kombis = new Set();
  EXERCISES.forEach((ex) => ['db', 'bw'].forEach((m) => kombis.add(`${ex[m].pattern}|${figurGeraet(ex, m) || ''}`)));
  const out = [];
  for (const [w, h] of [[344, 480], [362, 495], [300, 300], [344, 254]]) {
    let schlimm = { ragt: -Infinity, wo: '' };
    for (const k of kombis) {
      const [pattern, equip] = k.split('|');
      const host = document.createElement('div');
      host.style.cssText = `width:${w}px;height:${h}px;position:fixed;left:0;top:0`;
      document.body.appendChild(host);
      const f = mountFigure(host, pattern, true, equip || null);
      f.stop();
      const vb = host.querySelector('svg').viewBox.baseVal;
      for (let i = 0; i <= 20; i++) {
        f.draw(i / 20);
        [...host.querySelector('svg > g').children]
          .filter((n) => !['fig-ground', 'fig-schatten', 'fig-bench', 'fig-bench-leg'].some((c) => n.classList.contains(c)))
          .forEach((n) => {
            const b = n.getBBox();
            const ragt = Math.max(-b.x, -b.y, b.x + b.width - vb.width, b.y + b.height - vb.height);
            if (ragt > schlimm.ragt) schlimm = { ragt, wo: `${k} t=${i / 20} ${n.getAttribute('class')}` };
          });
      }
      host.remove();
    }
    out.push({ kasten: `${w}×${h}`, ...schlimm });
  }
  return out;
});
rand.forEach((r) => {
  check(r.ragt <= 0, `${r.kasten}: keine Figur ragt über den Rand, auch nicht Finger und Gerät (knappstes Teil ${r.ragt.toFixed(1)}, ${r.wo})`);
});

// Flaschen beim Seitheben: in jeder Faust eine, mit Deckel.
const flaschenBild = await page.evaluate(async () => {
  const { mountFigure } = await import('./js/figure.js');
  return ['lateral', 'lateralstand'].map((pattern) => {
    const host = document.createElement('div');
    host.style.cssText = 'width:300px;height:300px';
    document.body.appendChild(host);
    const f = mountFigure(host, pattern, true, 'bottles');
    f.stop(); f.setView(90, 0); f.draw(0.5);
    const n = { pattern, koerper: host.querySelectorAll('.fig-flasche .fig-flasche-flaeche').length, deckel: host.querySelectorAll('.fig-flasche .fig-deckel').length };
    host.remove();
    return n;
  });
});
flaschenBild.forEach((n) => {
  // Je Flasche drei Stücke Körper (Bauch, Schulter, Hals) mit zwei Flächen und
  // ein Deckel mit zwei Flächen.
  check(n.koerper === 12 && n.deckel === 4, `${n.pattern}: zwei Flaschen mit Deckel in den Händen (${n.koerper / 6} Körper, ${n.deckel / 2} Deckel)`);
});

// Laufzeit je Bild beim Stütz.
//
// Liegestütz, Füße erhöht und Pike lösten je Bild über 400-mal das Skelett;
// mit vierfach gedrosselter CPU brauchte draw() im Median 12–13 ms, eine
// einzige Figur nahm also fast das ganze Bildbudget von 16,7 ms. Gemessen wie
// die Animation zeichnet, im Kasten der Übungskarte. Drei Durchgänge, der
// beste Median zählt: Auf einem Rechner, auf dem nebenher anderes läuft,
// misst ein einzelner Durchgang sonst die Nachbarn mit.
{
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  const zeiten = await page.evaluate(async () => {
    const { mountFigure } = await import('./js/figure.js');
    const out = {};
    for (const [pattern, equip] of [['pushup', 'backpack'], ['pushupfeet', null], ['pike', null]]) {
      const host = document.createElement('div');
      host.style.cssText = 'width:344px;height:254px';
      document.body.appendChild(host);
      const f = mountFigure(host, pattern, true, equip);
      f.stop();
      const mediane = [];
      for (let runde = 0; runde < 3; runde++) {
        const z = [];
        for (let i = 0; i < 160; i++) {
          const u = (i % 80) / 80;
          const a = performance.now();
          f.draw(u < 0.5 ? u * 2 : 2 - u * 2);
          z.push(performance.now() - a);
        }
        z.sort((p, q) => p - q);
        mediane.push(z[z.length >> 1]);
      }
      out[pattern] = Math.min(...mediane);
      host.remove();
    }
    return out;
  });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  Object.entries(zeiten).forEach(([pattern, ms]) => {
    check(ms < 4, `${pattern}: draw() mit vierfach gedrosselter CPU im Median ${ms.toFixed(1)} ms (unter 4 ms)`);
  });
}

// Schneller darf nicht anders heißen: draw() zieht die Teile des Bildes davor
// nach, statt alles neu zu bauen. Nach vielen Bildern und einer Drehung muss
// genau dieselbe Zeichnung dastehen wie frisch gezeichnet – für jedes Muster.
const nachgezogen = await page.evaluate(async () => {
  const { mountFigure, PATTERNS } = await import('./js/figure.js');
  const abweichend = [];
  for (const [p, eq] of [['pushup', 'backpack'], ['curl', 'dumbbells'], ['squat', 'goblet'], ['lateral', 'bottles'],
    ...Object.keys(PATTERNS).map((k) => [k, null])]) {
    const kasten = () => {
      const d = document.createElement('div');
      d.style.cssText = 'width:300px;height:300px';
      document.body.appendChild(d);
      return d;
    };
    const a = kasten(); const b = kasten();
    const fa = mountFigure(a, p, true, eq); fa.stop();
    for (let i = 0; i <= 40; i++) fa.draw((i / 40) * 0.73);
    fa.setView(70, 20); fa.draw(0.4); fa.setView(...(PATTERNS[p].view || [25, 8]));
    for (let i = 0; i <= 30; i++) fa.draw(0.73 - i / 100);
    fa.draw(0.43);
    const fb = mountFigure(b, p, true, eq); fb.stop(); fb.draw(0.43);
    if (a.querySelector('svg > g').innerHTML !== b.querySelector('svg > g').innerHTML) abweichend.push(p);
    a.remove(); b.remove();
  }
  return abweichend;
});
check(nachgezogen.length === 0, `nachgezogene Zeichnung gleich der frisch gezeichneten${nachgezogen.length ? ' – anders: ' + nachgezogen.join(', ') : ''}`);

// Jedes Muster aus den Daten muss es auch geben, und wo Bodyweight eine
// andere Bewegung ist, darf es nicht das Hantel-Muster erben.
const map = await page.evaluate(async () => {
  const { PATTERNS } = await import('./js/figure.js');
  const { EXERCISES } = await import('./js/data.js');
  const known = Object.keys(PATTERNS);
  return {
    fehlend: EXERCISES.flatMap((e) => [e.db.pattern, e.bw.pattern]).filter((k) => !known.includes(k)),
    paare: Object.fromEntries(EXERCISES.map((e) => [e.id, [e.db.pattern, e.bw.pattern]])),
  };
});
check(map.fehlend.length === 0, `alle Muster vorhanden (${map.fehlend.join(', ') || 'keine Lücke'})`);
// Wo die Bodyweight-Fassung eine *andere* Bewegung ist, darf sie nicht das
// Hantel-Muster erben – sonst führt die Figur etwas vor, das nicht stattfindet.
// Die Liste ist kürzer geworden, und zwar aus einem guten Grund: Rudern,
// Reverse Fly und Trizepsdrücken hängen im Bodyweight-Modus inzwischen am
// Band und sind damit dieselbe Bewegung wie mit der Hantel. Dasselbe Muster
// ist dort richtig, nicht falsch.
[
  ['goblet-squat', 'Kniebeuge ohne Hantel hält keine unsichtbare Hantel'],
  ['hip-thrust', 'einbeiniger Hip Thrust hat ein Bein in der Luft'],
].forEach(([id, why]) => {
  const [db, bw] = map.paare[id];
  check(db !== bw, `${id}: ${why} (${db} / ${bw})`);
});

// Die Gegenprobe: Wo Hantel und Band dieselbe Bewegung sind, muss das Muster
// auch dasselbe sein. Sonst dreht die Figur im Bodyweight-Modus grundlos ab.
[
  ['einarmiges-kh-rudern', 'Band-Rudern ist dasselbe vorgebeugte Ziehen'],
  ['reverse-fly', 'Band-Reverse-Fly ist dasselbe Öffnen'],
  ['liegende-trizepsstrecker', 'Band-Trizepsdrücken ist dieselbe Streckung'],
].forEach(([id, why]) => {
  const [db, bw] = map.paare[id];
  check(db === bw, `${id}: ${why} (${db} / ${bw})`);
});

await page.locator('[data-act="finish-session"]').click();
await page.waitForTimeout(150);
await page.locator('[data-act="show-list"]').click();
await page.waitForTimeout(150);
console.log(`\n${fails ? fails + ' FEHLER' : 'alle Prüfungen bestanden'}`);
console.log('ERRORS:', errs.length ? errs : 'none');
await browser.close();
