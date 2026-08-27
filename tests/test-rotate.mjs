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
  return { bars: await page.locator('.fig-bar').count(), plates: await page.locator('.fig-plate').count() };
};
const seit = await gearOf('Sitzendes Seitheben');
console.log('     Seitheben:', JSON.stringify(seit));
check(seit.bars === 2 && seit.plates === 4, 'Seitheben: zwei Kurzhanteln, vier Scheiben');

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
    const bar = host.querySelector('.fig-bar');
    const plates = [...host.querySelectorAll('.fig-plate')];
    out[key] = {
      bars: host.querySelectorAll('.fig-bar').length,
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
check(gear.goblet.bars === 1 && gear.goblet.plates === 2, 'Goblet Squat: genau eine Hantel');
check(gear.goblet.dy > gear.goblet.dx * 3, 'Goblet Squat: Hantel steht senkrecht');
check(Math.abs(gear.goblet.mx - 50) < 4, 'Goblet Squat: Hantel mittig vor dem Körper, also in beiden Händen');
check(gear.einhand.bars === 1 && gear.einhand.plates === 2, 'Rudern: eine Kurzhantel in einer Hand');
check(gear.langhantel.bars === 1 && gear.langhantel.dx > gear.goblet.dy * 1.5, 'SZ-Curls: eine lange, waagerechte Stange');

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
