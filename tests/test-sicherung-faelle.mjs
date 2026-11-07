/*
 * Die automatische Sicherung – die Fälle aus der Prüfung.
 *
 *     „Lass das doch generell einfach automatisch sichern"
 *
 * tests/test-sicherung-auto.mjs prüft, dass die Sicherung tut, was sie soll.
 * Diese Datei prüft die Stellen, an denen sie es bis v240 nicht tat – jede
 * gegen die Fassung davor gegengeprüft, dort rot:
 *
 *   Link        Ein fremder Wiederherstellungs-Link: Das Gerät übernimmt den
 *               Schlüssel nicht, wer den Link geschickt hat, liest nicht mit.
 *   Rückweg     „Stand von vor dem Import zurückholen" lässt die geholte
 *               Sicherung unberührt und kehrt zum eigenen Schlüssel zurück.
 *   Löschen     „Alle Daten löschen" ohne Netz: Der Auftrag bleibt liegen,
 *               der nächste Start erledigt ihn, ein neues Gerät findet nichts.
 *   Rennen      Löschen, während die erste Sicherung im Netz hängt.
 *   Antwort     Angekommen, aber die Antwort ging verloren: kein Konflikt.
 *   Haken       Der letzte Haken sichert sofort – auch beim gleich Weglegen.
 *   Sperre      „Abschließen" drei Sekunden nach einer gedrosselten Sicherung.
 *   Nachgezogen Der SQL-Block lief, während die App im Speicher lag.
 *   Offen       Mehr nennt die IP-Adresse und was die Uhrzeit verrät.
 *
 * Jeder Fall läuft für sich: Scheitert einer (in der Gegenprobe fehlt etwa ein
 * Knopf), zählt das als FAIL, und der nächste läuft trotzdem.
 */
import { chromium } from 'playwright';
import { randomBytes } from 'node:crypto';
import { SHOT } from './umgebung.mjs';
import {
  labor, meta, sha, text, verstecken, zeigen, zuMehr, zumDashboard,
} from './sicherung-labor.mjs';

let fails = 0;
const check = (c, m) => { console.log(`${c ? 'OK  ' : 'FAIL'} ${m}`); if (!c) { fails++; process.exitCode = 1; } };

const browser = await chromium.launch();
const lab = labor(browser);
const { warte } = lab;
const neuerSchluessel = () => randomBytes(32).toString('base64url');
const zustand = (name, extra = {}) => ({ greeted: true, name, focus: 'cut', ...extra });
const einheiten = (stand) => Object.keys((stand && stand.log) || {}).length;
const letzte = () => lab.geschrieben().at(-1) || {};

async function fall(name, ablauf) {
  console.log(`\n--- ${name}`);
  try {
    await ablauf();
  } catch (e) {
    check(false, `${name}: ${String(e.message).split('\n')[0]}`);
  }
}

/** Einheiten abschließen wie ein Training – über den Speicher, nicht über die Knöpfe. */
const trainieren = (page, anzahl, ab = 0) => page.evaluate(async ({ anzahl: k, ab: a }) => {
  const store = await import('./js/store.js');
  const { PLAN } = await import('./js/data.js');
  for (let i = a; i < a + k; i++) {
    const w = PLAN[i];
    store.completeWorkout(w.n, 'db', w.ex.map((x) => ({ id: x.id, sets: x.sets, w: '20' })));
  }
}, { anzahl, ab });

const stueckeImSpeicher = (page) => page.evaluate(async () => {
  const s = (await import('./js/store.js')).getState();
  return { name: s.name, einheiten: Object.keys(s.log || {}).length };
});

// Eine Werkbank für Stände, wie ein anderes Gerät sie gesichert hätte – mit der
// App selbst gebaut, damit das Format stimmt. Sie sichert nichts.
const { page: werkbank, ctx: werkbankCtx } = await lab.geraet('Werkbank', { zustand: zustand('Werkbank') });
await werkbank.evaluate(() => localStorage.setItem('workout.sicherung.v1', JSON.stringify({ an: false })));
const standVon = (name, anzahl) => werkbank.evaluate(async ({ name: n, anzahl: k }) => {
  const store = await import('./js/store.js');
  const { PLAN } = await import('./js/data.js');
  store.resetAll();
  store.setSetting('greeted', true);
  store.setSetting('name', n);
  store.setSetting('focus', 'cut');
  for (let i = 0; i < k; i++) {
    const w = PLAN[i];
    store.completeWorkout(w.n, 'db', w.ex.map((x) => ({ id: x.id, sets: x.sets, w: '20' })));
  }
  return JSON.parse(store.exportJSON());
}, { name, anzahl });

/* ================================================================== *
 * Link – ein fremder Schlüssel wird nicht übernommen
 * ================================================================== */
await fall('Link', async () => {
  const K2 = neuerSchluessel();
  const koeder = await lab.ablegen(K2, await standVon('Freundin', 1));
  const { page: v, ctx } = await lab.geraet('Link', { pm: 'keiner', anker: `#sicherung=${K2}` });
  await v.screenshot({ path: `${SHOT}/sicherung-link-angebot.png` });
  check(/sichert dieses Gerät unter seinem eigenen Schlüssel/.test(await text(v)),
    'das Angebot sagt vorher, unter welchem Schlüssel danach gesichert wird');
  await v.locator('[data-act="sicherung-angebot-holen"]').click();
  await warte(v, 300);
  await v.waitForLoadState('networkidle');
  await warte(v, 500);
  check((await stueckeImSpeicher(v)).name === 'Freundin', 'zurückgeholt ist der Stand hinter dem Link');
  await warte(v, 4000);
  const m = await meta(v);
  check(!!m.key && m.key !== K2 && m.id !== sha(`id:${K2}`),
    'den Schlüssel aus dem Link übernimmt das Gerät nicht – es sichert unter einem eigenen');
  check(lab.zeilen.has(m.id), 'die erste Sicherung liegt unter dem eigenen Schlüssel');
  await trainieren(v, 2, 1);
  await warte(v, 1100);
  await warte(v, 2 * 60000 + 5000);
  const unterK2 = lab.zeilen.get(sha(`id:${K2}`));
  check(!!unterK2 && unterK2.iv === koeder.iv && einheiten(await lab.inhalt(K2)) === 1,
    'die Zeile hinter dem Link bleibt unverändert – wer ihn geschickt hat, liest das neue Training nicht');
  check(einheiten(await lab.inhalt(m.key)) === 3, 'die zwei neuen Einheiten liegen unter dem eigenen Schlüssel');
  await zumDashboard(v);
  check(await v.locator('[data-act="schluessel-sichern"]').count() === 1,
    'die Zeile „Schlüssel sichern" ist da – der eigene liegt bisher nur auf dem Gerät');
  await zuMehr(v);
  check(!/als Link verschickt/.test(await text(v, '#schluesselStand')),
    'Mehr behauptet nicht, dieses Gerät habe einen Link verschickt');
  await ctx.close();
});

/* ================================================================== *
 * Rückweg – „Stand von vor dem Import" nimmt die Sicherung mit
 * ================================================================== */
await fall('Rückweg', async () => {
  const KA = neuerSchluessel();
  await lab.ablegen(KA, await standVon('Tobi', 3));
  const pm = { id: `workout-sicherung-${sha(`id:${KA}`).slice(0, 8)}`, name: 'Workout-Sicherung', password: KA };
  const { page: b, ctx } = await lab.geraet('B', { zustand: zustand('Tobi'), pm });
  await trainieren(b, 1);
  await warte(b, 1100);
  await warte(b, 6000);
  const vorher = await meta(b);
  check(!!vorher.key && vorher.key !== KA && lab.zeilen.has(vorher.id),
    'das neue Handy sichert zuerst unter seinem eigenen Schlüssel (eine Einheit)');
  await warte(b, 15000);
  await zuMehr(b);
  await b.locator('[data-act="sicherung-holen"]').first().click();
  await warte(b, 300);
  await b.waitForLoadState('networkidle');
  await warte(b, 500);
  check((await stueckeImSpeicher(b)).einheiten === 3 && (await meta(b)).key === KA,
    'über den Passwortmanager geholt: drei Einheiten, gesichert wird unter dem Schlüssel des alten Handys');
  await warte(b, 4000);
  await warte(b, 15000);
  await zuMehr(b);
  await b.locator('[data-act="vor-import-zurueck"]').click();
  await warte(b, 300);
  await b.waitForLoadState('networkidle');
  await warte(b, 500);
  await warte(b, 4000);
  await warte(b, 15000);
  check((await stueckeImSpeicher(b)).einheiten === 1, 'der Rückweg holt den eigenen Stand zurück (eine Einheit)');
  check(einheiten(await lab.inhalt(KA)) === 3,
    'die Sicherung vom alten Handy behält ihre drei Einheiten – nichts wurde still überschrieben');
  const nachher = await meta(b);
  check(nachher.key === vorher.key, 'das Gerät sichert wieder unter seinem alten Schlüssel');
  check(einheiten(await lab.inhalt(vorher.key)) === 1, 'und dort liegt sein eigener Stand wieder');
  await ctx.close();
});

/* ================================================================== *
 * Löschen – „Alle Daten löschen" ohne Netz
 * ================================================================== */
await fall('Löschen', async () => {
  const { page: r, ctx } = await lab.geraet('R', { zustand: zustand('Tobi') });
  await trainieren(r, 2);
  await warte(r, 1100);
  await warte(r, 6000);
  const m = await meta(r);
  check(lab.zeilen.has(m.id), 'vorher liegt die Sicherung auf dem Server');
  await zumDashboard(r);
  await r.locator('[data-act="schluessel-sichern"]').click();
  await warte(r, 300);
  const pm = await r.evaluate(() => JSON.parse(localStorage.getItem('__test.pm') || 'null'));
  check(!!pm && pm.password === m.key, 'der Schlüssel liegt im Passwortmanager');
  lab.modus = 'weg';
  await zuMehr(r);
  await r.locator('[data-act="reset-all"]').click();
  await warte(r, 300);
  check(/sobald wieder Netz da ist/.test(await text(r, '#toast')),
    `ohne Netz sagt die Meldung, dass das Löschen noch aussteht („${(await text(r, '#toast')).trim()}")`);
  check(lab.zeilen.has(m.id), '(ohne Netz liegt sie noch dort)');
  check(await r.locator('#sicherungLoeschenOffen').count() === 1, 'und auf dem Bildschirm steht es, bis es erledigt ist');
  lab.modus = 'ok';
  await r.reload({ waitUntil: 'networkidle' });
  await warte(r, 4000);
  check(!lab.zeilen.has(m.id), 'der nächste Start mit Netz löscht sie');
  check(await r.evaluate(() => localStorage.getItem('workout.sicherung.loeschen')) === null
    && await r.locator('#sicherungLoeschenOffen').count() === 0,
  'danach ist der Auftrag erledigt und die Zeile weg');
  const { page: r2, ctx: ctx2 } = await lab.geraet('R2', { pm });
  await r2.locator('[data-act="sicherung-holen"]').click();
  await warte(r2, 300);
  check(/keine Sicherung/.test(await text(r2)) && (await stueckeImSpeicher(r2)).einheiten === 0,
    'ein neues Gerät findet mit dem Schlüssel aus dem Passwortmanager nichts mehr');
  await ctx.close();
  await ctx2.close();
});

/* ================================================================== *
 * Rennen – Löschen, während die erste Sicherung im Netz hängt
 * ================================================================== */
await fall('Rennen', async () => {
  let freigeben;
  lab.halten = new Promise((f) => { freigeben = f; });
  const { page: h, ctx } = await lab.geraet('H', { zustand: zustand('Tobi', { weights: { 'goblet-squat': 20 } }) });
  await warte(h, 4000);
  check(lab.geschrieben().some((x) => x.antwort === null), 'die erste Sicherung hängt im Netz');
  await zuMehr(h);
  await h.locator('[data-act="sicherung-loeschen"]').click();
  await warte(h, 300);
  lab.halten = null;
  freigeben();
  await warte(h, 300);
  await warte(h, 300);
  const m = await meta(h);
  check(!!m.id && !lab.zeilen.has(m.id),
    'danach liegt nichts auf dem Server – auch nicht, was das hängende Schreiben angelegt hat');
  check(/Gelöscht – und abgeschaltet/.test(await text(h, '#toast')),
    `und die Meldung stimmt („${(await text(h, '#toast')).trim()}")`);
  check(m.an === false, 'die Sicherung ist abgeschaltet');
  await ctx.close();
});

/* ================================================================== *
 * Antwort – angekommen, aber die Antwort ging verloren
 * ================================================================== */
await fall('Antwort', async () => {
  const { page: s, ctx } = await lab.geraet('S', { zustand: zustand('Tobi', { weights: { 'goblet-squat': 20 } }) });
  await warte(s, 4000);
  const m0 = await meta(s);
  check(lab.zeilen.has(m0.id), 'die erste Sicherung ist da');
  await warte(s, 30000);
  await s.evaluate(async () => (await import('./js/store.js')).setWeight('goblet-squat', 22.5));
  await warte(s, 1100);
  lab.antwortWeg = 1;
  const vor = lab.geschrieben().length;
  await verstecken(s);
  await warte(s, 0);
  check(lab.geschrieben().length === vor + 1 && /Antwort verloren/.test(letzte().antwort || ''),
    'beim Weglegen geschrieben – angekommen, die Antwort nicht');
  check((await meta(s)).stand !== lab.zeilen.get(m0.id).stand, '(das Gerät kennt seinen neuen Stand nicht)');
  await zeigen(s);
  await s.reload({ waitUntil: 'networkidle' });
  await warte(s, 4000);
  const m1 = await meta(s);
  check(!m1.konflikt, `kein Konflikt mit sich selbst (${JSON.stringify(m1.konflikt || null)})`);
  check(m1.stand === lab.zeilen.get(m0.id).stand, 'das Gerät hat seinen eigenen Stand erkannt und übernommen');
  await zumDashboard(s);
  check(await s.locator('[data-act="sicherung-ansehen"]').count() === 0,
    'das Dashboard meldet keine angehaltene Sicherung');
  await s.evaluate(async () => (await import('./js/store.js')).setWeight('goblet-squat', 25));
  await warte(s, 1100);
  await warte(s, 2 * 60000 + 5000);
  const inhalt = await lab.inhalt(m0.key);
  check(letzte().antwort === 'ok' && inhalt.weights['goblet-squat'] === 25,
    'und es wird weiter gesichert');
  await ctx.close();
});

/* ================================================================== *
 * Haken – der letzte Satz beendet die Einheit und sichert sofort
 * ================================================================== */
await fall('Haken', async () => {
  const { page: f, ctx } = await lab.geraet('F', { zustand: zustand('Tobi') });
  await zumDashboard(f);
  await f.locator('[data-act="start-session"]').first().click();
  await warte(f, 300);
  // Alles bis auf den letzten Satz abhaken – über den Speicher, das spart die
  // Pausen. Den letzten tippt der Test selbst.
  const { n } = await f.evaluate(async () => {
    const store = await import('./js/store.js');
    const { workoutByNo } = await import('./js/plan.js');
    const nr = store.getState().session.n;
    const mode = store.workoutMode(nr);
    const ex = workoutByNo(nr, mode).ex;
    ex.forEach((x, k) => {
      for (let i = 0; i < x.sets; i++) {
        if (k === ex.length - 1 && i === x.sets - 1) continue;
        store.updateSet(nr, mode, x.id, x.sets, i, { done: true, w: '20' }, x.nach || 0);
      }
    });
    return { n: nr };
  });
  await warte(f, 1100);
  await warte(f, 6000);
  await warte(f, 30000);
  await f.reload({ waitUntil: 'networkidle' });
  await warte(f, 4000);
  if (await f.locator('[data-act="start-session"]').count()) {
    await f.locator('[data-act="start-session"]').first().click();
    await warte(f, 300);
  }
  // Der Neustart hat die gebuchte Zeit gesichert; die zehn Sekunden danach
  // sind Sache des Falls „Sperre" – hier geht es um das Sofort.
  await warte(f, 15000);
  // Eine Änderung kurz vor dem letzten Satz: Sie liegt verschlüsselt bereit,
  // wie fast immer mitten im Training.
  await f.evaluate(async () => (await import('./js/store.js')).setWeight('goblet-squat', 24));
  await warte(f, 1100);
  const key = (await meta(f)).key;
  await f.locator('.focus-sets .set-btn:not(.on)').first().click();
  await verstecken(f);
  await f.waitForTimeout(800);
  check(/Training abgeschlossen/.test(await text(f, '#toast')), 'der letzte Haken beendet die Einheit');
  const inhalt = await lab.inhalt(key);
  check(!!inhalt && inhalt.session === null && !!(inhalt.log[n] || {}).done,
    `gleich weggelegt – auf dem Server liegt die fertige Einheit (session ${JSON.stringify(inhalt && inhalt.session)}, done ${JSON.stringify(inhalt && (inhalt.log[n] || {}).done)})`);
  await ctx.close();
});

/* ================================================================== *
 * Sperre – „Abschließen" drei Sekunden nach einer gedrosselten Sicherung
 * ================================================================== */
await fall('Sperre', async () => {
  const { page: z, ctx } = await lab.geraet('Z', { zustand: zustand('Tobi', { weights: { 'goblet-squat': 20 } }) });
  await warte(z, 4000);
  await warte(z, 3 * 60000);
  await zumDashboard(z);
  await z.locator('[data-act="start-session"]').first().click();
  await warte(z, 300);
  await z.locator('.focus-sets .set-btn:not(.on)').first().click();
  await warte(z, 1100);
  const vor = lab.geschrieben().length;
  await warte(z, 5000);
  check(lab.geschrieben().length === vor + 1 && letzte().antwort === 'ok', 'eine gedrosselte Sicherung geht hinaus');
  const key = (await meta(z)).key;
  await warte(z, 3000);
  await z.locator('[data-act="finish-session"]').first().click();
  await warte(z, 0);
  await warte(z, 8000);
  const zuOft = lab.geschrieben().filter((x) => /zu oft/.test(x.antwort || '')).length;
  check(zuOft === 0, `das Gerät hält die zehn Sekunden selbst ein – kein „zu oft" vom Server (${zuOft})`);
  const inhalt = await lab.inhalt(key);
  check(letzte().antwort === 'ok' && inhalt.session === null,
    'zehn Sekunden nach der gedrosselten Sicherung ist die abgeschlossene Einheit gesichert');
  check(!(await meta(z)).fehler, 'ohne Fehlervermerk');
  await zuMehr(z);
  const lage = await text(z, '#sicherungStand');
  check(/Zuletzt gesichert/.test(lage) && !/zu oft|ging nicht/.test(lage), `und ohne Fehlertext unter Mehr („${lage.trim()}")`);
  await ctx.close();
});

/* ================================================================== *
 * Nachgezogen – der SQL-Block lief, während die App im Speicher lag
 * ================================================================== */
await fall('Nachgezogen', async () => {
  lab.modus = 'fehlt';
  const { page: e, ctx } = await lab.geraet('E', { zustand: zustand('Eva', { weights: { 'goblet-squat': 20 } }) });
  await warte(e, 4000);
  check(lab.geschrieben().filter((x) => x.antwort === 'fehlt').length >= 1, 'der Server kennt die Funktionen noch nicht');
  await zuMehr(e);
  check(/kennt die Sicherung noch nicht/.test(await text(e, '#sicherungStand')), 'und Mehr sagt es');
  lab.modus = 'ok';
  const vor = lab.verkehr().length;
  await verstecken(e);
  await warte(e, 11 * 60000);
  check(lab.verkehr().length === vor, 'weggelegt fragt die App nicht nach');
  await zeigen(e);
  await warte(e, 500);
  check(lab.verkehr().length === vor + 1 && letzte().antwort === 'ok',
    `zurück in der App, mehr als zehn Minuten später: ein Versuch, und er geht (${lab.verkehr().length - vor})`);
  await zuMehr(e);
  check(/Zuletzt gesichert/.test(await text(e, '#sicherungStand')), 'Mehr zeigt „Zuletzt gesichert" – ohne Neustart');
  await ctx.close();
});

/* ================================================================== *
 * Offen – was der Server sieht, vollständig
 * ================================================================== */
await fall('Offen', async () => {
  const { page: o, ctx } = await lab.geraet('O', { zustand: zustand('Tobi', { weights: { 'goblet-squat': 20 } }) });
  await zuMehr(o);
  const karte = ((await o.locator('.card', { hasText: 'Automatisch sichern' }).first().textContent()) || '')
    .replace(/\s+/g, ' ');
  check(/IP-Adresse/.test(karte), 'unter Mehr steht, dass Supabase die IP-Adresse sieht');
  check(/wann du trainierst/.test(karte), 'und dass die Uhrzeit der Sicherung verrät, wann trainiert wird');
  check(!/sieht nur/.test(karte), 'kein „sieht nur" mehr');
  await ctx.close();
});

await werkbankCtx.close();
check(lab.fehler.length === 0, `keine Fehler${lab.fehler.length ? `: ${lab.fehler.slice(0, 3).join(' | ')}` : ''}`);
await browser.close();
console.log(`\n${fails ? `${fails} FEHLER` : 'alle Prüfungen bestanden'}`);
