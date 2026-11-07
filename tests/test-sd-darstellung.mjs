/*
 * Schilddrüse: lesbar für jemanden, der eine Lesebrille braucht.
 *
 * Drei Schriftgrößen, hell und dunkel. Geprüft wird auf dem kleinsten
 * gängigen Handy (360 × 740): keine Seite breiter als der Bildschirm, jeder
 * Knopf mindestens 44 Pixel hoch, und der Kontrast der wichtigen Paare
 * mindestens 4,5 : 1 (WCAG AA) – in beiden Farbwelten.
 */
import { oeffne, standMit, plus, SD_URL } from './sd-hilfe.mjs';

const TAG = '2026-03-10';
const einnahmen = {};
for (let i = 1; i < 40; i++) einnahmen[plus(TAG, -i)] = i % 7 ? { uhr: '07:00' } : null;
const stand = standMit(plus(TAG, -60), {
  dosen: [
    { id: 'd1', ab: plus(TAG, -200), praeparat: 'L-Thyroxin Henning', mikrogramm: 50, tabletten: 1, notiz: '' },
    { id: 'd2', ab: plus(TAG, -35), praeparat: 'L-Thyroxin Henning', mikrogramm: 112.5, tabletten: 1.5, notiz: 'eine lange Notiz, die auf einem schmalen Bildschirm umbrechen muss' },
  ],
  einnahmen,
  labor: [
    { id: 'l1', datum: plus(TAG, -50), tsh: { wert: 12.35, einheit: 'µU/ml', von: 0.27, bis: 4.2 }, ft4: { wert: 0.93, einheit: 'ng/dl', von: 0.93, bis: 1.7 }, ft3: { wert: 3.1, einheit: 'pg/ml', von: 2, bis: 4.4 }, notiz: '' },
    { id: 'l2', datum: plus(TAG, -2), tsh: { wert: 2.4, einheit: 'mU/l', von: 0.27, bis: 4.2 }, ft4: null, ft3: null, notiz: '' },
  ],
  gewicht: [{ id: 'g1', datum: plus(TAG, -20), kg: 71.2 }, { id: 'g2', datum: plus(TAG, -1), kg: 69.9 }],
  befinden: [{ id: 'b1', datum: plus(TAG, -3), stufe: 'schlecht', beschwerden: ['muede', 'frieren', 'konzentration'], notiz: 'sehr müde' }],
  termine: [{ id: 't1', datum: plus(TAG, 4), uhr: '08:15', art: 'labor', wo: 'Gemeinschaftspraxis am Marktplatz', blutabnahme: true, notiz: '' }],
  fragen: [{ id: 'f1', text: 'Eine recht lange Frage für den Termin, damit man sieht, ob sie umbricht?', erledigt: false }],
  vorrat: { tabletten: 20, stand: plus(TAG, -5) },
});

const { browser, page, check, ende } = await oeffne({ viewport: { width: 360, height: 740 }, tag: TAG, zeit: '09:00', stand });

const SEITEN_VERLAUF = ['labor-liste', 'dosis-liste', 'gewicht-liste', 'befinden-liste', 'labor', 'dosis', 'gewicht', 'befinden', 'einnahme'];
const SEITEN_MEHR = ['bericht', 'fragen', 'termine', 'wissen', 'erinnerung', 'vorrat', 'darstellung', 'sicherung', 'ueber'];

async function alleSeiten(fn) {
  await page.click('#reiter-heute'); await fn('Heute');
  await page.click('#reiter-verlauf'); await fn('Verlauf');
  for (const s of SEITEN_VERLAUF) {
    await page.click('#reiter-verlauf');
    await page.locator(`#ansicht [data-seite="${s}"]`).first().click();
    await fn(`Verlauf → ${s}`);
  }
  await page.click('#reiter-mehr'); await fn('Mehr');
  for (const s of SEITEN_MEHR) {
    await page.click('#reiter-mehr');
    await page.locator(`#ansicht [data-seite="${s}"]`).first().click();
    await fn(`Mehr → ${s}`);
  }
}

async function einstellen(schrift, farbe) {
  await page.click('#reiter-mehr');
  await page.click('[data-seite="darstellung"]');
  await page.click(`[data-act="schrift"][data-wert="${schrift}"]`);
  await page.click(`[data-act="farbe"][data-wert="${farbe}"]`);
}

for (const [schrift, farbe] of [['sehr-gross', 'hell'], ['gross', 'dunkel'], ['normal', 'hell']]) {
  await einstellen(schrift, farbe);
  const px = await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize));
  check(px === { normal: 18, gross: 20, 'sehr-gross': 23 }[schrift], `Schrift „${schrift}": Grundgröße ${px} px`);
  check(await page.evaluate(() => document.documentElement.dataset.farbe) === farbe, `Farben „${farbe}" gesetzt`);
  const zuBreit = [];
  const zuKlein = [];
  await alleSeiten(async (name) => {
    const w = await page.evaluate(() => document.documentElement.scrollWidth);
    if (w > 360) zuBreit.push(`${name} (${w}px)`);
    if (schrift === 'normal') {
      const klein = await page.evaluate(() => [...document.querySelectorAll('#ansicht .knopf, #ansicht .zeile, #ansicht .tablette, .reiter')]
        .filter((b) => b.offsetParent && b.getBoundingClientRect().height < 44)
        .map((b) => `${b.textContent.trim().slice(0, 20)} ${Math.round(b.getBoundingClientRect().height)}px`));
      if (klein.length) zuKlein.push(`${name}: ${klein.join(', ')}`);
    }
  });
  // Begrüßung/Heute (Nov. 2026): Die Notfallleiste ist eine Zeile, die
  // übrigen Nummern klappen auf. Zugeklappt passen 112 und „Weitere Nummern"
  // nebeneinander; aufgeklappt wird die Seite nicht breiter, und jede Nummer
  // ist mindestens 44 px hoch.
  await page.click('#reiter-heute');
  const zeile = await page.evaluate(() => {
    const a = document.querySelector('#ansicht .notfall-leiste > .knopf-notruf').getBoundingClientRect();
    const s = document.querySelector('#ansicht .notfall-mehr > summary').getBoundingClientRect();
    return Math.abs(a.top - s.top) < 2;
  });
  check(zeile, `${schrift}/${farbe}: 112 und „Weitere Nummern" in einer Zeile`);
  await page.click('#ansicht .notfall-mehr > summary');
  const offen = await page.evaluate(() => ({
    breite: document.documentElement.scrollWidth,
    klein: [...document.querySelectorAll('#ansicht .notfall-leiste a, #ansicht .notfall-leiste button, #ansicht .notfall-leiste summary')]
      .filter((b) => b.getBoundingClientRect().height < 44).map((b) => b.textContent.trim().slice(0, 20)),
  }));
  if (offen.breite > 360) zuBreit.push(`Heute mit „Weitere Nummern" (${offen.breite}px)`);
  check(!offen.klein.length, `${schrift}/${farbe}: aufgeklappt jede Nummer ≥ 44 px hoch${offen.klein.length ? ` – ${offen.klein.join(', ')}` : ''}`);
  check(!zuBreit.length, `${schrift}/${farbe}: keine Seite breiter als 360 px${zuBreit.length ? ` – ${zuBreit.join('; ')}` : ''}`);
  if (schrift === 'normal') check(!zuKlein.length, `auch bei kleinster Schrift jeder Knopf ≥ 44 px hoch${zuKlein.length ? ` – ${zuKlein.slice(0, 4).join('; ')}` : ''}`);
}

// Kontrast in beiden Farbwelten.
for (const farbe of ['hell', 'dunkel']) {
  await einstellen('gross', farbe);
  await page.click('#reiter-heute');
  const paare = await page.evaluate(() => {
    const rgb = (c) => c.match(/[\d.]+/g).slice(0, 3).map(Number);
    const lum = ([r, g, b]) => {
      const f = (v) => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; };
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const kontrast = (a, b) => { const [x, y] = [lum(rgb(a)), lum(rgb(b))].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
    const cs = (el) => getComputedStyle(el);
    const grund = (el) => { let e = el; while (e && /rgba\(0, 0, 0, 0\)|transparent/.test(cs(e).backgroundColor)) e = e.parentElement; return cs(e || document.body).backgroundColor; };
    const paar = (sel, name) => { const el = document.querySelector(sel); return el ? [name, kontrast(cs(el).color, grund(el))] : [name, 0]; };
    return [
      paar('.heute-datum', 'Text auf Hintergrund'),
      paar('.heute-dosis', 'gedämpfter Text'),
      paar('.tablette', 'großer Knopf (fällig)'),
      paar('#befinden .gedaempft', 'gedämpfter Text auf Karte'),
      paar('.reiter[aria-selected="true"]', 'gewählter Reiter'),
      paar('.reiter[aria-selected="false"]', 'anderer Reiter'),
    ];
  });
  paare.forEach(([name, k]) => check(k >= 4.5, `${farbe}: ${name} ${k.toFixed(1)} : 1`));
  await page.click('[data-act="tablette"]');
  const genommen = await page.evaluate(() => {
    const rgb = (c) => c.match(/[\d.]+/g).slice(0, 3).map(Number);
    const lum = ([r, g, b]) => { const f = (v) => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
    const el = document.querySelector('.tablette');
    const [x, y] = [lum(rgb(getComputedStyle(el).color)), lum(rgb(getComputedStyle(el).backgroundColor))].sort((p, q) => q - p);
    return (x + 0.05) / (y + 0.05);
  });
  check(genommen >= 4.5, `${farbe}: großer Knopf (genommen) ${genommen.toFixed(1)} : 1`);
  await page.click('[data-act="tablette-zurueck"]');
}

// Die Wahl bleibt nach dem Neuladen.
await einstellen('sehr-gross', 'dunkel');
await page.reload({ waitUntil: 'networkidle' });
check(await page.evaluate(() => document.documentElement.dataset.schrift + '/' + document.documentElement.dataset.farbe) === 'sehr-gross/dunkel', 'Schrift und Farben bleiben nach dem Neuladen');

/*
 * Der feste Ersatz in index.html (C18) – gestaltet auch mit einer styles.css,
 * die ihn nicht kennt. Während eines Updates lud die Seite einmal die
 * styles.css der alten Fassung aus deren Vorrat: Der Notfalltext stand ohne
 * roten Kasten da, die Nummern als blaue Standardlinks, und „Erscheint hier
 * nach ein paar Sekunden nichts weiter …" sofort (Prüfung Nov. 2026).
 * Nachgestellt mit einer leeren styles.css und einem app.js, das nicht startet.
 */
const ersatzCtx = await browser.newContext({ viewport: { width: 360, height: 740 }, serviceWorkers: 'block' });
await ersatzCtx.route(/\/schilddruese\/css\/styles\.css/, (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
await ersatzCtx.route(/\/schilddruese\/js\/app\.js/, (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: 'throw new Error("passt nicht zu den anderen Modulen");' }));
const ersatz = await ersatzCtx.newPage();
await ersatz.goto(SD_URL, { waitUntil: 'load' });
await ersatz.waitForTimeout(300);
const ez = await ersatz.evaluate(() => {
  const st = (sel) => getComputedStyle(document.querySelector(sel));
  const leiste = st('#ansicht .notfall-leiste');
  const knopf = document.querySelector('#ansicht .notfall-leiste a[href="tel:112"]');
  const nummern = [...document.querySelectorAll('#ansicht .notfall-nummern a.nummer')];
  return {
    rand: leiste.borderTopColor, grund: leiste.backgroundColor,
    knopf: getComputedStyle(knopf).backgroundColor, strich: getComputedStyle(knopf).textDecorationLine, hoch: knopf.getBoundingClientRect().height,
    nummern: nummern.map((a) => [getComputedStyle(a).color, Math.round(a.getBoundingClientRect().height)]),
    hinweis: st('#ansicht .start-hinweis').visibility,
  };
});
check(ez.rand === 'rgb(179, 38, 30)' && ez.grund === 'rgb(251, 231, 229)', `Ersatz ohne passende styles.css: der rote Kasten um die Notfallnummern (${ez.rand} / ${ez.grund})`);
check(ez.knopf === 'rgb(179, 38, 30)' && ez.strich === 'none' && ez.hoch >= 44, `… „112 anrufen" als roter Knopf, nicht als Link (${ez.knopf}, ${Math.round(ez.hoch)} px)`);
check(ez.nummern.length === 3 && ez.nummern.every(([farbe, h]) => farbe === 'rgb(179, 38, 30)' && h >= 44), `… die übrigen Nummern rot und mindestens 44 px hoch (${JSON.stringify(ez.nummern)})`);
check(ez.hinweis === 'hidden', '… der Satz „Kommt nach einer Weile nichts weiter …" wartet erst, statt sofort dazustehen');
check((await ersatz.locator('#ansicht .start-hinweis').textContent()).startsWith('Die App wird geladen oder gerade aktualisiert.'), '… und sagt ruhig, was gerade geschieht');
await ersatzCtx.close();

await ende();
