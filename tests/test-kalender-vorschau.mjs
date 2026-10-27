/*
 * Die Vorschau des Kalenders (js/kalender-vorschau.js): was die App an jedem
 * der nächsten 42 Tage zeigen würde, wenn bis dahin nicht trainiert wird.
 *
 *     „Sicher dass man jetzt die Workout zeiten täglich um 17:30 nicht
 *      reinschreiben kann inkl Verschiebung wenn ich mal was verpasse oder
 *      so?"
 *
 * Der Kalender verschiebt nur dann richtig, wenn die Liste eines Tages genau
 * die ist, die die App an diesem Tag selbst zeigte. Darum misst diese Datei
 * nicht nur gegen erwartete Daten, sondern gegen die App:
 *
 *   1. Die Fälle der Recherche an Tobis Stand vom Do 08.10. (A), verpasst bis
 *      Mo 12.10. (B) und über die Zeitumstellung bis Mo 26.10. (B2), eine
 *      liegen gebliebene Einheit am Sa und am Mi danach (C, C2), ein
 *      Bouldern-Termin (D), das Rundenende 84/84 (E, und E2 im
 *      Tagesabschluss), ein Turnier, das alles schont (F). Dazu der
 *      Zusatztag: allein an Ruhetagen und dann in der Einheit (R), gemacht an
 *      einem eigenen Tag (G).
 *   2. Pfadunabhängigkeit: je Tag frisch gesät (so rechnet die Vorschau) =
 *      Tag für Tag fortgeschrieben (die App jeden Tag geöffnet) = ein frischer
 *      Prozess am Tag d = die echte App im Browser am Tag d.
 *   3. Die Uhrzeit: Mitternacht, die Zeitumstellung am 25.10., die
 *      3-Stunden-Regel des Tagesabschlusses für eine spät trainierte Einheit
 *      – am Folgetag und über Mitternacht noch am selben Abend.
 *   4. Der Vertrag mit dem Skript: Größe unter 64 KiB, nutzlastPruefen(),
 *      sendungVergleichen() (das Tablet aus der Schublade), vorschauFuer().
 *   5. Im Browser: Der Worker rechnet dasselbe wie Node, und im Fenster der
 *      App verweigert die Vorschau, ohne Uhr oder Speicher anzufassen.
 *   6. Die Kalenderdatei ist dieselbe wie vor der gemeinsamen Quelle
 *      (kalenderEinheiten() in js/kalender.js).
 *   7. Die Ferne – ein Jahr (Fassung 2):
 *
 *        „Klappt alles aber bisschen wenig Termine. Lass doch mal ein Jahr
 *         machen"
 *
 *      Die Nähe bleibt Byte für Byte dieselbe; dahinter der Rest der Runde und
 *      die nächsten Runden bis d + 365, mit Kennungen und Tagen wie beim
 *      echten Rundenwechsel (die App Tag für Tag nach Plan trainiert); die
 *      verschobenen Referenzlisten ergeben an jedem geprüften Tag genau, was
 *      ein frischer Lauf in einem eigenen Prozess für diesen Tag allein
 *      rechnet – mit verpassten Tagen, einem Plan in der Zukunft, dem
 *      Rundenende in der Vorschau und Terminen in der Ferne (auch einem, der
 *      alles schont); Größe und Kürzen; der Vertrag der Fassung 2; die Regel
 *      bleibtStehen() am Tag des Rundenwechsels. Im Browser rechnet der
 *      Worker die Ferne wie Node, gemessen mit echter Uhr.
 *
 * Node mit TZ=Europe/Berlin – der Container läuft auf UTC, die App rechnet in
 * lokalen Tagen. Ohne gesetzte Zeitzone startet sich die Datei selbst damit
 * neu. Der Browser bekommt dieselbe Zeitzone über den Kontext.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HIER = fileURLToPath(import.meta.url);
if (process.env.TZ !== 'Europe/Berlin') {
  const r = spawnSync(process.execPath, [HIER, ...process.argv.slice(2)], {
    stdio: 'inherit', env: { ...process.env, TZ: 'Europe/Berlin' },
  });
  process.exit(r.status === null ? 1 : r.status);
}

/*
 * Ein frischer Start der App in einem eigenen Prozess – so wie das Handy die
 * App am Tag d lädt: Speicher gesät, Uhr gestellt, dann die Module, dann
 * tagNachziehen(). Gibt die Termine im Fenster aus.
 *   node test-kalender-vorschau.mjs --frisch <root> <zustand.json> <ms> <von> <bis>
 */
if (process.argv[2] === '--frisch') {
  const [, , , wurzel, datei, msText, von, bis] = process.argv;
  const ms = Number(msText);
  const Echt = Date;
  globalThis.Date = class extends Echt {
    constructor(...a) { if (a.length) super(...a); else super(ms); }

    static now() { return ms; }
  };
  const mem = new Map([['workout.state.v1', readFileSync(datei, 'utf8')]]);
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    writable: true,
    value: {
      getItem: (k) => (mem.has(k) ? mem.get(k) : null),
      setItem: (k, v) => { mem.set(String(k), String(v)); },
      removeItem: (k) => { mem.delete(k); },
      clear: () => mem.clear(),
      key: (i) => [...mem.keys()][i] ?? null,
      get length() { return mem.size; },
    },
  });
  const modul = (n) => import(pathToFileURL(path.join(wurzel, 'js', n)).href);
  const tagstart = await modul('tagstart.js');
  const kalender = await modul('kalender.js');
  tagstart.tagNachziehen({ art: 'start' });
  process.stdout.write(JSON.stringify(kalender.kalenderTermine({ von, bis })));
  process.exit(0);
}

/*
 * Die ganze Liste eines Tages – Nähe und Ferne – in einem eigenen Prozess,
 * für diesen einen Tag gerechnet: eine Vorschau über einen Tag, ohne
 * Referenz, die verschoben werden könnte. Gibt die Einträge ausgeschrieben aus.
 *   node test-kalender-vorschau.mjs --fern <root> <zustand.json> <ms>
 */
if (process.argv[2] === '--fern') {
  const [, , , wurzel, datei, msText] = process.argv;
  const W = await import(pathToFileURL(path.join(wurzel, 'js', 'kalender-vorschau.js')).href);
  const v = await W.vorschauRechnen(readFileSync(datei, 'utf8'), { jetzt: Number(msText), tage: 1, ferne: W.VORSCHAU_FERNE });
  const n = W.nutzlastBauen(v, { token: 'testtoken-kein-echtes-0123456789', geraet: 'frisch01', seq: 1, gesendet: 1 });
  const aus = (l) => l.map(([k, d, dauer, h, f]) => [k, d, dauer, n.texte[h][0], n.texte[h][1], f]);
  process.stdout.write(JSON.stringify({ tag: v.ab, nah: aus(n.tage[v.ab]), fern: aus(W.fernListe(n, v.ab)), listen: v.ferne.listen.length }));
  process.exit(0);
}

const { ROOT, URL, ABLAGE } = await import('./umgebung.mjs');

let fails = 0;
const check = (c, m) => { console.log(`${c ? 'OK  ' : 'FAIL'} ${m}`); if (!c) { fails++; process.exitCode = 1; } };
const zeige = (m) => console.log(`     ${m}`);

check(new Date(2026, 9, 24, 12).getTimezoneOffset() === -120 && new Date(2026, 9, 26, 12).getTimezoneOffset() === -60,
  'Zeitzone Europe/Berlin: Sommerzeit bis 25.10., danach Winterzeit');

// Die Vorschau zuerst – sie hält die echte Uhr fest, bevor hier eine andere steht.
const V = await import(pathToFileURL(path.join(ROOT, 'js', 'kalender-vorschau.js')).href);

/* ------------------------------------------------------------------ *
 * Zustände
 * ------------------------------------------------------------------ */

const basisText = readFileSync(path.join(ROOT, 'tests', 'zusatz-tobi-do.json'), 'utf8');
const kopie = () => JSON.parse(basisText);
const satz = (k) => Array.from({ length: k }, () => ({ w: '', done: true }));
const um = (iso) => Date.parse(iso);

/** W9 am Do 08.10. angefangen, 4 Sätze, dann liegen gelassen – letzter Eintrag um `zuletzt`. */
const liegtW9 = (zuletzt) => {
  const z = kopie();
  z.log[9] = {
    mode: 'db', db: { 'rumaenisches-kreuzheben': satz(3), 'floor-press': satz(1) }, bw: {},
    startedOn: '2026-10-08', zuletzt: um(zuletzt),
  };
  return z;
};

const Z = {
  A: kopie(),
  C: liegtW9('2026-10-08T17:40:00+02:00'),
  Cspaet: liegtW9('2026-10-08T23:10:00+02:00'),
  // Noch am selben Abend über Mitternacht: letzter Satz um 0:20.
  Cnacht: liegtW9('2026-10-09T00:20:00+02:00'),
  D: (() => {
    const z = kopie();
    z.termine = [{ datum: '2026-10-13', name: 'Bouldern', aktivitaet: 'bouldern', minuten: 90 }];
    return z;
  })(),
  F: (() => {
    const z = kopie();
    z.termine = [{ datum: '2026-10-12', name: 'Turnier', schont: 'alles' }];
    return z;
  })(),
  // Der Zusatztag der Woche 2, am Mi 07.10. für sich gemacht.
  G: (() => {
    const z = kopie();
    z.log.cmuxsf5c0 = {
      mode: 'db', db: { 'pull-ups': satz(3), 'chin-ups': satz(3) }, bw: {}, startedOn: '2026-10-07', done: 'db',
      zuletzt: um('2026-10-07T18:00:00+02:00'),
    };
    return z;
  })(),
};

/* ------------------------------------------------------------------ *
 * Hilfen
 * ------------------------------------------------------------------ */

const addDays = (iso, k) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + k)).toISOString().slice(0, 10);
};
/** Die Termine eines Tages aus der Vorschau, ausgeschrieben – wie kalenderTermine() sie liefert. */
const ausVorschau = (v, tag) => (v.tage[tag] || []).map(([kennung, datum, dauer, h, f]) => ({
  kennung, datum, dauer, titel: v.texte[h][0], beschreibung: v.texte[h][1], fertig: !!f,
}));
const vergleichbar = (liste) => liste.map((t) => ({
  kennung: t.kennung, datum: t.datum, dauer: t.dauer, titel: t.titel, beschreibung: t.beschreibung, fertig: !!t.fertig,
}));
const gleich = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const ab = (v, tag) => ausVorschau(v, tag).filter((t) => t.datum >= tag);
const kurz = (liste) => liste.map((t) => `${t.kennung}@${t.datum.slice(5)}${t.fertig ? '✓' : ''}`).join(' ');
const fenster = (v, tag) => ({ von: addDays(tag, -v.fenster[0]), bis: addDays(tag, v.fenster[1]) });

/** Erste Abweichung zweier Listen, zum Nachsehen. */
const abweichung = (soll, ist) => {
  for (let i = 0; i < Math.max(soll.length, ist.length); i++) {
    if (!gleich(soll[i], ist[i])) return `#${i}: ${JSON.stringify(soll[i] || null).slice(0, 160)} / ${JSON.stringify(ist[i] || null).slice(0, 160)}`;
  }
  return '';
};

const vorschau = {};
const rechne = async (name, jetzt, optionen = {}) => {
  const v = await V.vorschauRechnen(JSON.stringify(Z[name]), { jetzt: um(jetzt), ...optionen });
  vorschau[name] = v;
  return v;
};

/* ------------------------------------------------------------------ *
 * 1. Die Fälle der Recherche
 * ------------------------------------------------------------------ */

const vA = await rechne('A', '2026-10-08T12:00:00+02:00');
zeige(`Rechenzeit in Node, 42 Tage: ${Math.round(vA.ms)} ms (mit dem Laden der Module)`);
check(vA.ab === '2026-10-08' && Object.keys(vA.tage).length === 42, `42 Tage ab heute (${vA.ab}, ${Object.keys(vA.tage).length})`);
check(gleich(vA.fenster, [7, 28]), `Fenster je Tag: 7 zurück, 28 voraus (${vA.fenster})`);

// Erst jetzt die Module selbst – dieselben Instanzen wie in der Vorschau, mit dem Plan, den sie geladen hat.
const modul = (n) => import(pathToFileURL(path.join(ROOT, 'js', n)).href);
const [store, D, P, tagstart, kalender, ics] = await Promise.all(
  ['store.js', 'data.js', 'plan.js', 'tagstart.js', 'kalender.js', 'ics.js'].map(modul),
);
check(D.FOCUS === D.PLANS.cut, 'die Module rechnen mit Tobis Fokus (Cut)');

// Das Rundenende: alle 84 abgeschlossen (E) – und 83 plus die letzte, die liegen blieb (E2).
{
  const runde = (letzteOffen) => {
    const z = kopie();
    z.customs = [];
    z.log = {};
    z.shift = 0;
    const start = um('2026-04-01T12:00:00+02:00');
    D.PLAN.forEach((w, i) => {
      const tag = new Date(start + i * 2 * 86400000).toISOString().slice(0, 10);
      z.log[w.n] = { mode: 'db', db: { [w.ex[0].id]: satz(1) }, bw: {}, done: 'db', startedOn: tag };
    });
    if (letzteOffen) {
      const w = D.PLAN[D.PLAN.length - 1];
      z.log[w.n] = {
        mode: 'db', db: { [w.ex[0].id]: satz(1), [w.ex[1].id]: satz(1) }, bw: {},
        startedOn: '2026-10-23', zuletzt: um('2026-10-23T18:30:00+02:00'),
      };
    }
    return z;
  };
  Z.E = runde(false);
  Z.E2 = runde(true);
}
// Ruhetage mit Zusatztag (wie test-zusatztag.mjs, Abschnitt 7): Workout 1–4 je
// ohne die letzten zwei Übungen gemacht, vor 8, 6, 4 und 3 Tagen; Workout 5
// liegt drei Tage voraus. Bis dahin steht der Zusatztag allein da.
{
  const heute = '2026-10-08';
  const tage = { 1: -8, 2: -6, 3: -4, 4: -3 };
  const log = {};
  D.PLAN.slice(0, 4).forEach((w) => {
    const e = { mode: 'db', done: 'db', db: {}, bw: {}, startedOn: addDays(heute, tage[w.n]) };
    w.ex.slice(0, Math.max(1, w.ex.length - 2)).forEach((it) => {
      e.db[it.id] = Array.from({ length: it.sets }, () => ({ w: '20', r: '', done: true }));
    });
    log[w.n] = e;
  });
  const tageZwischen = (a, b) => (Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000;
  Z.R = { greeted: true, name: 'T', level: 'geuebt', focus: 'cut', shift: tageZwischen(D.PLAN[4].date, addDays(heute, 3)), log };
}

const tagA = (tag, n) => ab(vA, tag).slice(0, n);
check(kurz(tagA('2026-10-08', 4)) === 'cut-1-9@10-08 cut-1-10@10-10 cut-1-11@10-12 cut-1-12@10-13',
  `A, Do 08.10.: Workout 9 heute, dann Sa, Mo, Di (${kurz(tagA('2026-10-08', 4))})`);
check(tagA('2026-10-08', 1)[0].titel === 'Workout 9 · 6 Übungen · 17 Sätze',
  `A: Titel wie die Einheit, mit dem Zusatz darin (${tagA('2026-10-08', 1)[0].titel})`);
check(kurz(tagA('2026-10-12', 4)) === 'cut-1-9@10-12 cut-1-10@10-14 cut-1-11@10-16 cut-1-12@10-17',
  `B, verpasst bis Mo 12.10.: alles rückt nach (${kurz(tagA('2026-10-12', 4))})`);
check(kurz(tagA('2026-10-26', 4)) === 'cut-1-9@10-26 cut-1-10@10-28 cut-1-11@10-30 cut-1-12@10-31',
  `B2, verpasst bis Mo 26.10. (nach der Zeitumstellung) (${kurz(tagA('2026-10-26', 4))})`);
check(ausVorschau(vA, '2026-10-08').filter((t) => t.datum < '2026-10-08').every((t) => t.fertig),
  'A: was vor heute im Fenster steht, ist erledigt (W1–W8)');

const vC = await rechne('C', '2026-10-08T19:00:00+02:00');
{
  const w9 = (tag) => ausVorschau(vC, tag).find((t) => t.kennung === 'cut-1-9');
  check(w9('2026-10-08') && !w9('2026-10-08').fertig, 'C, Do 08.10. abends: Workout 9 angefangen, noch offen');
  check(w9('2026-10-10') && w9('2026-10-10').fertig && w9('2026-10-10').datum === '2026-10-08',
    'C, Sa 10.10.: Workout 9 abgeschlossen (Tagesabschluss), bleibt am Do');
  check(kurz(ab(vC, '2026-10-10').slice(0, 3)) === 'cut-1-10@10-10 cut-1-11@10-12 cut-1-12@10-13',
    `C: Workout 10 am Sa (${kurz(ab(vC, '2026-10-10').slice(0, 3))})`);
  check(kurz(ab(vC, '2026-10-14').slice(0, 4)) === 'cut-1-10@10-14 cut-1-11@10-16 cut-1-12@10-17 cut-1-13@10-19',
    `C2, Mi 14.10.: nachgerückt (${kurz(ab(vC, '2026-10-14').slice(0, 4))})`);
}

const vD = await rechne('D', '2026-10-08T12:00:00+02:00');
{
  const w9 = ab(vD, '2026-10-12')[0];
  check(w9.kennung === 'cut-1-9' && w9.datum === '2026-10-12' && w9.titel === 'Workout 9 · 3 Übungen · 9 Sätze',
    `D, Mo 12.10. vor dem Bouldern am Di: Workout 9 geschont (${w9.titel})`);
  check(ab(vA, '2026-10-12')[0].titel !== w9.titel, 'D: ohne den Termin wäre es die ganze Einheit');
}

const vE = await rechne('E', '2026-10-24T12:00:00+02:00');
{
  const alle = Object.values(vE.tage).flat();
  check(alle.length > 0 && alle.every(([k]) => k.startsWith('cut-2-')), 'E, Rundenende 84/84: nur Termine der neuen Runde (cut-2-…)');
  check(kurz(ab(vE, '2026-10-24').slice(0, 2)) === 'cut-2-1@10-24 cut-2-2@10-26',
    `E: Workout 1 heute, Workout 2 am Mo (${kurz(ab(vE, '2026-10-24').slice(0, 2))})`);
  check(kurz(ab(vE, '2026-10-26').slice(0, 1)) === 'cut-2-1@10-26', `E, Mo 26.10.: Workout 1 rückt nach (${kurz(ab(vE, '2026-10-26').slice(0, 1))})`);
}
const vE2 = await rechne('E2', '2026-10-24T12:00:00+02:00');
{
  const heute = ausVorschau(vE2, '2026-10-24');
  check(heute.length > 0 && heute.every((t) => t.kennung.startsWith('cut-2-')),
    `E2, Workout 84 am Fr liegen geblieben: am Sa abgeschlossen, die Runde rollt im selben Start weiter (${kurz(heute.slice(0, 2))})`);
  check(!heute.some((t) => t.kennung === 'cut-1-84')
    && V.bleibtStehen({ kennung: 'cut-1-84', datum: '2026-10-23' }, vE2.tage['2026-10-24'], '2026-10-24'),
  'E2: die abgelegte Runde steht nicht mehr in der Liste – ihr Termin am Fr bleibt trotzdem stehen (bleibtStehen())');
}

const vF = await rechne('F', '2026-10-08T12:00:00+02:00');
{
  const am12 = ausVorschau(vF, '2026-10-12');
  check(!am12.some((t) => t.datum === '2026-10-12') && !am12.some((t) => t.kennung === 'cut-1-9'),
    'F, Turnier am Mo 12.10. schont alles: an dem Tag kein Termin, Workout 9 ist leer und steht nicht in der Liste');
  check(kurz(ab(vF, '2026-10-12').slice(0, 1)) === 'cut-1-10@10-14', `F: dahinter geht es weiter (${kurz(ab(vF, '2026-10-12').slice(0, 1))})`);
  check(kurz(ab(vF, '2026-10-14').slice(0, 2)) === 'cut-1-9@10-14 cut-1-10@10-16',
    `F, Mi 14.10.: Workout 9 ist wieder ein Termin (${kurz(ab(vF, '2026-10-14').slice(0, 2))})`);
  check(!V.bleibtStehen({ kennung: 'cut-1-9', datum: '2026-10-12' }, vF.tage['2026-10-12'], '2026-10-12'),
    'F: der Termin von Workout 9 am Mo kommt dort weg (heute, leer)');
}

const vR = await rechne('R', '2026-10-08T12:00:00+02:00');
{
  check(kurz(ab(vR, '2026-10-08').slice(0, 2)) === 'cut-1-z1@10-08 cut-1-5@10-11',
    `R, Ruhetag: heute der Zusatztag allein, Workout 5 am So (${kurz(ab(vR, '2026-10-08').slice(0, 2))})`);
  check(ab(vR, '2026-10-08')[0].titel.startsWith('Zusatztag Woche 1 · '), `R: Titel des Zusatztags (${ab(vR, '2026-10-08')[0].titel})`);
  check(kurz(ab(vR, '2026-10-10').slice(0, 1)) === 'cut-1-z1@10-10', 'R: unberührt wandert er mit dem Tag (Sa 10.10.)');
  const am11 = ausVorschau(vR, '2026-10-11');
  const w5 = (t) => ab(vR, t).find((x) => x.kennung === 'cut-1-5');
  check(!am11.some((t) => t.kennung === 'cut-1-z1') && /· (\d+) Übungen/.exec(w5('2026-10-11').titel)[1] > /· (\d+) Übungen/.exec(w5('2026-10-08').titel)[1],
    `R, So 11.10.: der Zusatztag steckt in Workout 5 (${w5('2026-10-08').titel} → ${w5('2026-10-11').titel})`);
  check(!V.bleibtStehen({ kennung: 'cut-1-z1', datum: '2026-10-10' }, vR.tage['2026-10-11'], '2026-10-11'),
    'R: sein Termin vom Sa kommt weg – nie gemacht, jetzt in der Einheit (bleibtStehen())');
}

const vG = await rechne('G', '2026-10-08T12:00:00+02:00');
{
  const z2 = ausVorschau(vG, '2026-10-08').find((t) => t.kennung === 'cut-1-z2');
  check(z2 && z2.datum === '2026-10-07' && z2.fertig && z2.titel.startsWith('Zusatztag Woche 2 · 2 Übungen'),
    `G: der gemachte Zusatztag steht an seinem Tag, erledigt (${z2 ? `${z2.titel} am ${z2.datum}` : 'fehlt'})`);
  check(ausVorschau(vG, '2026-10-14').some((t) => t.kennung === 'cut-1-z2')
    && !ausVorschau(vG, '2026-10-15').some((t) => t.kennung === 'cut-1-z2'),
  'G: und bleibt dort, solange er im Fenster liegt (bis Mi 14.10., sieben Tage danach)');
}

{
  // Die Kennung bleibt je Einheit dieselbe, über alle Tage.
  const daten = new Map();
  let doppelt = 0;
  Object.values(vA.tage).forEach((liste) => {
    const gesehen = new Set();
    liste.forEach(([k]) => { if (gesehen.has(k)) doppelt++; gesehen.add(k); daten.set(k, (daten.get(k) || 0) + 1); });
  });
  check(doppelt === 0, 'keine Kennung zweimal an einem Tag');
  const alle = Object.values(vorschau).flatMap((v) => Object.values(v.tage).flat());
  check(kalender.KENNUNG.source === V.KENNUNG_MUSTER.source, 'das Muster der Kennung ist in App und Vertrag dasselbe');
  check(alle.every(([k]) => kalender.KENNUNG.test(k)), `jede Kennung passt zum Muster (${alle.length} Einträge)`);
  check(Object.values(vorschau).every((v) => Object.entries(v.tage).every(([tag, l]) => {
    const { von, bis } = fenster(v, tag);
    return l.every(([, d], i) => d >= von && d <= bis && (i === 0 || l[i - 1][1] <= d));
  })), 'jede Tagesliste liegt in ihrem Fenster und ist nach Tag sortiert');
}

/* ------------------------------------------------------------------ *
 * 2. Pfadunabhängigkeit
 * ------------------------------------------------------------------ */

// Eine feste Uhr für die Rechnungen hier – die Vorschau stellt ihre eigene.
const EchtesDate = Date;
let festeZeit = 0;
class FesteUhr extends EchtesDate {
  constructor(...a) { if (a.length) super(...a); else super(festeZeit); }

  static now() { return festeZeit; }
}
const mitUhr = (ms, fn) => {
  festeZeit = ms;
  globalThis.Date = FesteUhr;
  try { return fn(); } finally { globalThis.Date = EchtesDate; }
};

/** Tag für Tag fortgeschrieben: einmal säen, dann jeden Tag ein Start – die App jeden Tag geöffnet, ohne Training. */
const fortschreiben = (name, v) => {
  mitUhr(v.zeiten[v.ab], () => store.importJSON(JSON.stringify(Z[name])));
  return Object.keys(v.tage).map((tag) => mitUhr(v.zeiten[tag], () => {
    tagstart.tagNachziehen({ art: 'start' });
    return vergleichbar(kalender.kalenderTermine(fenster(v, tag)));
  }));
};
for (const name of ['A', 'C', 'D', 'E2', 'F', 'R', 'G']) {
  const v = vorschau[name];
  const kette = fortschreiben(name, v);
  const tage = Object.keys(v.tage);
  const anders = tage.filter((tag, i) => !gleich(ausVorschau(v, tag), kette[i]));
  check(!anders.length, `${name}: je Tag frisch gesät = Tag für Tag fortgeschrieben (${tage.length} Tage)`
    + `${anders.length ? ` – anders: ${anders.slice(0, 3).join(', ')} ${abweichung(ausVorschau(v, anders[0]), kette[tage.indexOf(anders[0])])}` : ''}`);
}

/** Ein frischer Start der App am Tag `tag` in einem eigenen Prozess (siehe --frisch oben). */
const datei = (name) => {
  const p = path.join(ABLAGE, `kalender-vorschau-${name}.json`);
  writeFileSync(p, JSON.stringify(Z[name]));
  return p;
};
const frischerProzess = (name, ms, { von, bis }) => {
  const r = spawnSync(process.execPath, [HIER, '--frisch', ROOT, datei(name), String(ms), von, bis], {
    env: { ...process.env, TZ: 'Europe/Berlin' }, encoding: 'utf8', maxBuffer: 1 << 26,
  });
  if (r.status !== 0) throw new Error(`frischer Prozess ${name}: ${r.stderr.slice(0, 400)}`);
  return vergleichbar(JSON.parse(r.stdout));
};
const stichproben = { A: [0, 4, 18, 41], C: [1, 2, 5], D: [4, 5], E2: [0, 1], F: [3, 4, 6], R: [0, 2, 3], G: [0, 1] };
for (const [name, ks] of Object.entries(stichproben)) {
  const v = vorschau[name];
  const anders = ks.map((k) => addDays(v.ab, k)).filter((tag) => !gleich(ausVorschau(v, tag), frischerProzess(name, v.zeiten[tag], fenster(v, tag))));
  check(!anders.length, `${name}: Vorschau = frischer Prozess am Tag d (${ks.length} Stichproben${anders.length ? `, anders: ${anders.join(', ')}` : ''})`);
}

/* ------------------------------------------------------------------ *
 * 3. Die Uhrzeit
 * ------------------------------------------------------------------ */

// Die 3-Stunden-Regel: bis 23:10 trainiert, liegen gelassen.
const vCs = await rechne('Cspaet', '2026-10-08T23:15:00+02:00');
{
  const tag = '2026-10-09';
  check(vCs.zeiten[tag] === um('2026-10-09T02:11:00+02:00'),
    `spät trainiert: Fr 09.10. gerechnet um ${new Date(vCs.zeiten[tag]).toTimeString().slice(0, 5)} (letzter Satz 23:10 + 3 h + 1 min)`);
  const w9 = ausVorschau(vCs, tag).find((t) => t.kennung === 'cut-1-9');
  check(w9 && w9.fertig, 'spät trainiert: am Fr steht Workout 9 im Kalender als erledigt – so wie die App es ab 2:10 zeigt');
  const um005 = frischerProzess('Cspaet', um('2026-10-09T00:05:00+02:00'), fenster(vCs, tag)).find((t) => t.kennung === 'cut-1-9');
  check(um005 && !um005.fertig, 'Gegenprobe: um 0:05 gerechnet stünde Workout 9 den ganzen Fr offen da');
  check(new Date(vCs.zeiten['2026-10-10']).toTimeString().slice(0, 5) === '00:05', 'die Tage danach wieder um 0:05');
  check(vCs.zeiten['2026-10-08'] === um('2026-10-08T23:59:00+02:00'),
    'heute (23:15): höchstens bis 23:59 – die Regel greift erst morgen, die Rechnung bleibt am Tag');
  const s = frischerProzess('Cspaet', vCs.zeiten['2026-10-09'], fenster(vCs, tag));
  check(gleich(ausVorschau(vCs, tag), s), 'spät trainiert: Vorschau = frischer Prozess um 2:11');
}

// Über Mitternacht: letzter Satz um 0:20, gerechnet um 0:25 – für heute gilt die Liste ab 3:21.
const vCn = await rechne('Cnacht', '2026-10-09T00:25:00+02:00');
{
  const tag = '2026-10-09';
  check(vCn.ab === tag && vCn.zeiten[tag] === um('2026-10-09T03:21:00+02:00'),
    `über Mitternacht: heute gerechnet um ${new Date(vCn.zeiten[tag]).toTimeString().slice(0, 5)}, nicht um 0:25`);
  const w9 = ausVorschau(vCn, tag).find((t) => t.kennung === 'cut-1-9');
  const jetzt = frischerProzess('Cnacht', um('2026-10-09T00:25:00+02:00'), fenster(vCn, tag)).find((t) => t.kennung === 'cut-1-9');
  check(w9 && w9.fertig && jetzt && !jetzt.fertig,
    'über Mitternacht: die App zeigt um 0:25 noch das laufende Training, der Kalender für den Tag schon, was ab 3:21 gilt');
}

// Mitternacht: eine Minute davor und danach gerechnet – der neue Tag ist derselbe.
{
  const vor = await V.vorschauRechnen(basisText, { jetzt: um('2026-10-08T23:59:30+02:00') });
  const nach = await V.vorschauRechnen(basisText, { jetzt: um('2026-10-09T00:00:30+02:00') });
  check(vor.ab === '2026-10-08' && nach.ab === '2026-10-09', `Mitternacht: die Vorschau beginnt am Tag der Uhr (${vor.ab} / ${nach.ab})`);
  check(['2026-10-09', '2026-10-10', '2026-10-17'].every((t) => gleich(ausVorschau(vor, t), ausVorschau(nach, t))),
    'Mitternacht: um 23:59 und um 0:00 gerechnet, sagen beide dasselbe über die Tage danach');
  check(gleich(ausVorschau(nach, '2026-10-09'), ausVorschau(vA, '2026-10-09')),
    'Mitternacht: und dasselbe wie die Vorschau von 12:00 am Vortag');
  const f = V.vorschauFuer(vor.tage, '2026-10-09');
  check(f && f.tag === '2026-10-09' && !f.aufgebraucht, 'vorschauFuer(): heute steht drin');
  const spaet = V.vorschauFuer(vor.tage, '2026-11-25');
  check(spaet && spaet.tag === '2026-11-18' && spaet.aufgebraucht, 'vorschauFuer(): nach sechs Wochen der letzte Tag, als aufgebraucht');
  check(V.vorschauFuer(vor.tage, '2026-10-07') === null, 'vorschauFuer(): vor dem ersten Tag nichts');
}

// Die Zeitumstellung: 25.10. hat 25 Stunden.
{
  const tage = Object.keys(vA.tage);
  check(tage.every((t, i) => t === addDays(vA.ab, i)), 'Zeitumstellung: 42 aufeinanderfolgende Tage, keiner doppelt, keiner fehlt');
  check(tage.slice(1).every((t) => new Date(vA.zeiten[t]).toTimeString().slice(0, 5) === '00:05'), 'jeder Tag um 0:05 Ortszeit gerechnet');
  check(vA.zeiten['2026-10-25'] === Date.UTC(2026, 9, 24, 22, 5) && vA.zeiten['2026-10-26'] === Date.UTC(2026, 9, 25, 23, 5),
    'So 25.10. um 0:05 Sommerzeit, Mo 26.10. um 0:05 Winterzeit (25 Stunden dazwischen)');
}

// Der aufgeschobene Tagesabschluss: Hat der Start der App heute mit einem Planumbau begonnen.
{
  const ohne = await V.vorschauRechnen(JSON.stringify(Z.C), { jetzt: um('2026-10-09T12:00:00+02:00') });
  const mit = await V.vorschauRechnen(JSON.stringify(Z.C), { jetzt: um('2026-10-09T12:00:00+02:00'), wartet: '2026-10-09' });
  const w9 = (v, t) => ausVorschau(v, t).find((x) => x.kennung === 'cut-1-9');
  check(w9(ohne, '2026-10-09').fertig, 'ohne Planumbau: Workout 9 am Fr abgeschlossen');
  check(!w9(mit, '2026-10-09').fertig && w9(mit, '2026-10-10').fertig,
    'mit Planumbau beim Start (wartet): heute offen wie in der App, ab morgen abgeschlossen');
}

// Ein Zustand mit anderem Fokus braucht einen frischen Worker.
{
  const anders = kopie();
  anders.focus = 'standard';
  let code = null;
  try { await V.vorschauRechnen(JSON.stringify(anders), { jetzt: um('2026-10-08T12:00:00+02:00') }); } catch (e) { code = e.code; }
  check(code === 'fokus', `anderer Fokus als beim Laden: Fehler „fokus" statt falscher Termine (${code})`);
}

/* ------------------------------------------------------------------ *
 * 4. Der Vertrag
 * ------------------------------------------------------------------ */

const TOKEN = 'testtoken-kein-echtes-0123456789';
const nutzlast = (v, mehr = {}) => V.nutzlastBauen(v, {
  token: TOKEN, geraet: 'testgeraet01', seq: 41, gesendet: um('2026-10-08T12:00:00+02:00'), app: 'v245', ...mehr,
});
{
  const groessen = Object.entries(vorschau).map(([name, v]) => {
    const n = nutzlast(v);
    return { name, bytes: V.nutzlastBytes(n), gz: gzipSync(JSON.stringify(n)).length, texte: Object.keys(v.texte).length, ok: V.nutzlastPruefen(n) };
  });
  groessen.forEach((g) => zeige(`Nutzlast ${g.name}: ${(g.bytes / 1024).toFixed(1)} KiB (gzip ${(g.gz / 1024).toFixed(1)} KiB), ${g.texte} Texte`));
  const groesste = Math.max(...groessen.map((g) => g.bytes));
  check(groesste < V.VORSCHAU_MAX_BYTES * 0.75, `Größe: höchstens ${(groesste / 1024).toFixed(1)} KiB – unter 64 KiB (keepalive), mit einem Viertel Luft`);
  check(groessen.every((g) => g.ok === null), `jede gebaute Nutzlast besteht nutzlastPruefen() (${groessen.map((g) => g.ok).filter(Boolean).join(', ') || 'alle'})`);
  const n = nutzlast(vA);
  check(gleich(Object.keys(n), ['v', 'token', 'geraet', 'seq', 'gesendet', 'app', 'minuten', 'erinnerung', 'ab', 'fenster', 'stand', 'texte', 'tage']),
    `Felder der Nutzlast: ${Object.keys(n).join(', ')}`);
  check(n.minuten === 1050 && n.erinnerung === 30, 'Standard: 17:30 (1050 Minuten) und 30 Minuten vorher erinnern');
  check(!('zeiten' in n) && !('ms' in n), 'Messwerte der Rechnung gehen nicht mit');
}
{
  const n = nutzlast(vA);
  const kaputt = (aendern) => {
    const k = JSON.parse(JSON.stringify(n));
    aendern(k);
    return V.nutzlastPruefen(k);
  };
  const tag = vA.ab;
  check(kaputt((k) => { k.v = 3; }) === 'v' && kaputt((k) => { k.v = '1'; }) === 'v', 'unbekannte Fassung → „v"');
  check(kaputt((k) => { k.v = 2; }) === 'ferne', 'Fassung 2 ohne Ferne → „ferne"');
  check(kaputt((k) => { k.token = 'kurz'; }) === 'token', 'zu kurzes Token → „token"');
  check(kaputt((k) => { k.token = 'mit leerzeichen 0123456789'; }) === 'token', 'Token mit fremden Zeichen → „token"');
  check(kaputt((k) => { k.minuten = 1440; }) === 'minuten', '24:00 → „minuten"');
  check(kaputt((k) => { k.tage[tag][0][0] = 'Workout 9'; }) === 'eintrag', 'Kennung ohne Muster → „eintrag"');
  check(kaputt((k) => { k.tage[tag][0][3] = 'constructor'; }) === 'eintrag', 'Verweis auf „constructor" statt einen Text → „eintrag"');
  check(kaputt((k) => { k.tage[tag][0][4] = 2; }) === 'eintrag', 'fertig 2 → „eintrag"');
  check(kaputt((k) => { k.tage[tag][0][2] = 0; }) === 'eintrag', 'Dauer 0 → „eintrag"');
  check(kaputt((k) => { k.tage = {}; }) === 'tage', 'keine Tage → „tage"');
  check(kaputt((k) => { for (let i = 0; i < 70; i++) k.texte[`gross${i}`] = ['x', 'y'.repeat(1000)]; }) === 'groesse', 'über 64 KiB → „groesse"');
  check(V.nutzlastPruefen({ v: 1, token: TOKEN, geraet: 'testgeraet01', seq: 1, gesendet: 1, probe: true }) === null, '„Verbinden" (probe) braucht keine Vorschau');
  check(V.nutzlastPruefen({ v: 1, token: TOKEN, geraet: 'testgeraet01', seq: 1, gesendet: 1, aus: true }) === null, '„Abschalten" (aus) ebenso');
  check(!JSON.stringify(vA).includes(TOKEN), 'die Vorschau selbst trägt kein Token');
}
{
  // Wer gilt, wenn zwei Geräte senden.
  const s = (geraet, seq, gesendet, stand) => ({ geraet, seq, gesendet, stand });
  const handy = s('handy', 10, 1000, { einheiten: 9, saetze: 120, zuletzt: 500 });
  check(V.sendungVergleichen(null, handy) === 'neu', 'erste Sendung: übernehmen');
  check(V.sendungVergleichen(handy, { ...handy }) === 'gleich', 'dieselbe Sendung noch einmal: „gleich"');
  check(V.sendungVergleichen(handy, s('handy', 11, 1100, handy.stand)) === 'neu', 'dasselbe Gerät, spätere Sendung: übernehmen');
  check(V.sendungVergleichen(handy, s('handy', 9, 900, handy.stand)) === 'alt', 'dasselbe Gerät, eine verspätete Wiederholung: „alt"');
  check(V.sendungVergleichen(handy, s('handy', 0, 2000, { einheiten: 5, saetze: 60, zuletzt: 100 })) === 'neu',
    'dasselbe Gerät nach dem Zurücksetzen (seq 0, ältere Sicherung eingelesen): übernehmen');

  // Das Tablet aus der Schublade, mit echten Ständen: Tobis Stand vom 08.10. – auf dem Handy am Mo 12.10. trainiert.
  const trainiert = kopie();
  trainiert.log[9] = {
    mode: 'db', db: { 'rumaenisches-kreuzheben': satz(3) }, bw: {}, startedOn: '2026-10-12', zuletzt: um('2026-10-12T18:30:00+02:00'),
  };
  const vHandy = await V.vorschauRechnen(JSON.stringify(trainiert), { jetzt: um('2026-10-12T19:00:00+02:00') });
  const vTablet = await V.vorschauRechnen(basisText, { jetzt: um('2026-10-14T08:00:00+02:00') });
  const nHandy = nutzlast(vHandy, { geraet: 'handy', seq: 12, gesendet: um('2026-10-12T19:00:00+02:00') });
  const nTablet = nutzlast(vTablet, { geraet: 'tablet', seq: 3, gesendet: um('2026-10-14T08:00:00+02:00') });
  zeige(`Stand Handy ${JSON.stringify(vHandy.stand)}, Tablet ${JSON.stringify(vTablet.stand)}`);
  check(vTablet.stand.einheiten === 8 && vTablet.stand.saetze > 0, `Trainingsstand: abgeschlossene Einheiten und Sätze (${vTablet.stand.einheiten}, ${vTablet.stand.saetze})`);
  check(V.sendungVergleichen(nHandy, nTablet) === 'aelter',
    'Tablet aus der Schublade, zwei Tage später gesendet: „aelter" – der Kalender bleibt beim Handy');
  check(V.sendungVergleichen(nTablet, nHandy) === 'neu', 'umgekehrt gewinnt das Gerät, mit dem zuletzt trainiert wurde');
  check(V.sendungVergleichen(s('a', 1, 1, { einheiten: 9, saetze: 100, zuletzt: 0 }), s('b', 1, 1, { einheiten: 9, saetze: 101, zuletzt: 0 })) === 'neu'
    && V.sendungVergleichen(s('a', 1, 1, { einheiten: 9, saetze: 100, zuletzt: 0 }), s('b', 1, 1, { einheiten: 8, saetze: 140, zuletzt: 0 })) === 'aelter'
    && V.sendungVergleichen(s('a', 1, 1, { einheiten: 9, saetze: 100, zuletzt: 0 }), s('b', 1, 1, { einheiten: 9, saetze: 100, zuletzt: 0 })) === 'neu',
  'ohne Lebenszeichen: Einheiten, dann Sätze, Gleichstand gilt');

  // Nach dem Rundenende: Workout 84 am Fr 23.10. um 18:30 liegen gelassen, am
  // Sa rollt die App beim Start in Runde 2 (E2). Ihr Protokoll ist dann leer –
  // das letzte Lebenszeichen steht in der abgelegten Runde. Zählte nur das
  // laufende Protokoll, meldete das Handy „nie trainiert", und ein Tablet, das
  // seit dem 01.10. in der Schublade lag, überholte es still.
  const handyRunde = mitUhr(um('2026-10-24T09:00:00+02:00'), () => {
    store.importJSON(JSON.stringify(Z.E2));
    tagstart.tagNachziehen({ art: 'start' });
    return store.exportJSON();
  });
  const sRunde = JSON.parse(handyRunde);
  const vHandyRunde = await V.vorschauRechnen(handyRunde, { jetzt: um('2026-10-24T09:00:00+02:00') });
  const tabletRunde = JSON.parse(JSON.stringify(Z.E2));
  Object.keys(tabletRunde.log).forEach((k) => { if (Number(k) > 70) delete tabletRunde.log[k]; });
  tabletRunde.log[70].zuletzt = um('2026-10-01T18:00:00+02:00');
  const vTabletRunde = await V.vorschauRechnen(JSON.stringify(tabletRunde), { jetzt: um('2026-10-24T12:00:00+02:00') });
  zeige(`Rundenende: Handy ${JSON.stringify(vHandyRunde.stand)}, Tablet ${JSON.stringify(vTabletRunde.stand)}`);
  check(!Object.keys(sRunde.log).length && sRunde.rounds.length === 1 && vHandyRunde.stand.zuletzt === um('2026-10-23T18:30:00+02:00'),
    'nach dem Rundenende (Protokoll leer, Runde abgelegt): stand.zuletzt ist der letzte Satz der abgelegten Runde, nicht 0');
  check(V.sendungVergleichen(nutzlast(vHandyRunde, { geraet: 'handy', seq: 50 }), nutzlast(vTabletRunde, { geraet: 'tablet', seq: 3 })) === 'aelter',
    'Rundenende: das Tablet aus der Schublade (Stand bis Workout 70, 01.10.) bekommt „aelter" – der Kalender bleibt beim Handy');

  // Nach einem Fokuswechsel: Am 19.10. in Aufbau trainiert, am 22.10. zurück
  // auf Cut – jetzt steht der ältere Cut-Verlauf (letzter Satz 12.10.) im
  // Protokoll, der Aufbau-Verlauf in der Ablage. Das Tablet hat zuletzt am
  // 14.10. trainiert (in Cut).
  const handyFokus = kopie();
  handyFokus.log[9] = {
    mode: 'db', db: { 'rumaenisches-kreuzheben': satz(3) }, bw: {}, startedOn: '2026-10-12', done: 'db', zuletzt: um('2026-10-12T18:30:00+02:00'),
  };
  handyFokus.rounds = [{
    finishedOn: '2026-10-22', focus: 'aufbau', shift: 0,
    log: { 1: { mode: 'db', db: { kniebeuge: satz(3) }, bw: {}, startedOn: '2026-10-19', done: 'db', zuletzt: um('2026-10-19T18:30:00+02:00') } },
  }];
  const tabletFokus = kopie();
  tabletFokus.log[9] = {
    mode: 'db', db: { 'rumaenisches-kreuzheben': satz(3) }, bw: {}, startedOn: '2026-10-14', done: 'db', zuletzt: um('2026-10-14T18:30:00+02:00'),
  };
  const vHandyFokus = await V.vorschauRechnen(JSON.stringify(handyFokus), { jetzt: um('2026-10-22T19:00:00+02:00') });
  const vTabletFokus = await V.vorschauRechnen(JSON.stringify(tabletFokus), { jetzt: um('2026-10-23T08:00:00+02:00') });
  check(vHandyFokus.stand.zuletzt === um('2026-10-19T18:30:00+02:00'),
    'nach dem Fokuswechsel: stand.zuletzt ist der Satz vom 19.10. aus dem abgelegten Aufbau-Verlauf');
  check(V.sendungVergleichen(nutzlast(vHandyFokus, { geraet: 'handy', seq: 60 }), nutzlast(vTabletFokus, { geraet: 'tablet', seq: 4 })) === 'aelter',
    'Fokuswechsel: das Tablet (zuletzt 14.10.) bekommt „aelter"');
  // Ein Lebenszeichen aus der Zukunft (falsch gehende Uhr in einer Sicherung) zählt in der Ablage so wenig wie im Protokoll.
  const zukunft = JSON.parse(JSON.stringify(handyFokus));
  zukunft.rounds[0].log[1].zuletzt = um('2027-03-01T12:00:00+01:00');
  check((await V.vorschauRechnen(JSON.stringify(zukunft), { jetzt: um('2026-10-22T19:00:00+02:00') })).stand.zuletzt === um('2026-10-12T18:30:00+02:00'),
    'ein Lebenszeichen aus der Zukunft in der Ablage zählt nicht');
}

/* ------------------------------------------------------------------ *
 * 6. Die Kalenderdatei aus derselben Quelle
 * ------------------------------------------------------------------ */

for (const name of ['A', 'D', 'F']) {
  const ohneStempel = (t) => t.split('\r\n').filter((z) => !z.startsWith('DTSTAMP:')).join('\n');
  const { vorher, nachher, cancelGleich } = mitUhr(um('2026-10-12T09:00:00+02:00'), () => {
    store.importJSON(JSON.stringify(Z[name]));
    tagstart.tagNachziehen({ art: 'start' });
    const mode = (n) => store.workoutMode(n);
    // So baute downloadICS() seine Liste bis v244.
    const alt = ics.buildICS(
      D.PLAN.map((w) => ({ n: w.n, date: P.effDate(w) })),
      (w) => P.exOf(P.workoutByNo(w.n, mode(w.n)), mode(w.n)).map((it) => P.resolve(it, mode(w.n))),
      { hour: 18, seq: 3 },
    );
    const einheiten = kalender.kalenderEinheiten({ zusatz: false });
    const neu = ics.buildICS(einheiten.map((e) => ({ n: e.n, date: e.datum, posten: e.posten })), (w) => w.posten, { hour: 18, seq: 3 });
    const altLeer = D.PLAN.filter((w) => !P.exOf(P.workoutByNo(w.n)).length).map((w) => w.n);
    const neuLeer = einheiten.filter((e) => !e.posten.length).map((e) => e.n);
    return { vorher: alt, nachher: neu, cancelGleich: gleich(altLeer, neuLeer) };
  });
  check(ohneStempel(vorher) === ohneStempel(nachher) && cancelGleich,
    `${name}: Kalenderdatei wortgleich wie bis v244, auch was abgesagt wird (${(nachher.match(/BEGIN:VEVENT/g) || []).length} Termine)`);
}

/* ------------------------------------------------------------------ *
 * 7. Die Ferne – ein Jahr
 * ------------------------------------------------------------------ */

const FERNE = V.VORSCHAU_FERNE;
const rechneFern = (z, jetzt, mehr = {}) => V.vorschauRechnen(JSON.stringify(z), { jetzt: um(jetzt), ferne: FERNE, ...mehr });
/** Ein Eintrag ausgeschrieben – wie der frische Prozess (--fern) ihn ausgibt. */
const schreib = (n, l) => l.map(([k, d, dauer, h, f]) => [k, d, dauer, n.texte[h][0], n.texte[h][1], f]);
const tageZwischen = (a, b) => (Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000;
const abstand = tageZwischen(D.PLAN[0].date, D.PLAN[1].date);
const fernDatei = (name, z) => {
  const p = path.join(ABLAGE, `kalender-vorschau-fern-${name}.json`);
  writeFileSync(p, JSON.stringify(z));
  return p;
};
/** Die ganze Liste eines Tages, in einem eigenen Prozess für diesen Tag allein gerechnet. */
const frischFern = (name, z, ms) => {
  const r = spawnSync(process.execPath, [HIER, '--fern', ROOT, fernDatei(name, z), String(ms)], {
    env: { ...process.env, TZ: 'Europe/Berlin' }, encoding: 'utf8', maxBuffer: 1 << 26,
  });
  if (r.status !== 0) throw new Error(`frischer Prozess (Ferne) ${name}: ${r.stderr.slice(0, 400)}`);
  return JSON.parse(r.stdout);
};

{
  // 7a. Tobis Stand vom 08.10., ein Jahr voraus.
  const vAF = await rechneFern(Z.A, '2026-10-08T12:00:00+02:00');
  const nAF = nutzlast(vAF);
  zeige(`Ferne in Node, 42 Tage: ${Math.round(vAF.ms)} ms, davon Ferne ${Math.round(vAF.fernMs)} ms (ohne Ferne ${Math.round(vA.ms)} ms beim ersten Lauf mit Laden)`);
  check(nAF.v === 2 && V.nutzlastPruefen(nAF) === null && nAF.ferne.bis === 365,
    `Fassung 2: die Nutzlast trägt die Ferne bis d + 365 und besteht nutzlastPruefen() (${V.nutzlastPruefen(nAF)})`);
  check(JSON.stringify(vAF.tage) === JSON.stringify(vA.tage),
    'die Nähe bleibt exakt wie bisher: jede der 42 Tageslisten Byte für Byte dieselbe wie ohne Ferne');
  const f0 = V.fernListe(nAF, vAF.ab);
  const runden = [...new Set(f0.map((e) => e[0].replace(/-z?\d+$/, '')))];
  check(f0.length >= 180 && f0[0][1] > addDays(vAF.ab, 28) && f0[f0.length - 1][1] <= addDays(vAF.ab, 365) && f0[f0.length - 1][1] > addDays(vAF.ab, 355),
    `am 08.10.: ${f0.length} Termine dahinter, vom ${f0[0][1]} bis ${f0[f0.length - 1][1]} – ein Jahr`);
  check(gleich(runden, ['cut-1', 'cut-2', 'cut-3']), `über das Ende der Runde hinaus: ${runden.join(', ')}`);
  const ganz = [...nAF.tage[vAF.ab], ...f0];
  const w84 = ganz.find((e) => e[0] === 'cut-1-84');
  const w1 = ganz.find((e) => e[0] === 'cut-2-1');
  check(!!w84 && !!w1 && w1[1] === addDays(w84[1], abstand),
    `Runde 2 beginnt im üblichen Abstand nach Workout 84 (${w84 && w84[1]} → ${w1 && w1[1]}), wie rundeWeiter() sie anlegt`);
  const r2 = ganz.filter((e) => e[0].startsWith('cut-2-'));
  check(r2.length === 84 && r2.every((e) => e[1] === addDays(w1[1], tageZwischen(D.PLAN[0].date, D.PLAN[Number(e[0].split('-')[2]) - 1].date))),
    'Runde 2: alle 84 Einheiten im Rhythmus des Plans – Kennung cut-2-<n>');
  const w30 = f0.find((e) => e[0] === 'cut-1-30');
  check(w30 && nAF.texte[w30[3]][0] === nAF.texte[(r2.find((e) => e[0] === 'cut-2-30') || [])[3]][0],
    `Inhalt nach heutigen Einstellungen: Workout 30 sieht in Runde 2 aus wie in Runde 1 (${w30 && nAF.texte[w30[3]][0]})`);
  check(!ganz.some((e, i) => ganz.findIndex((x) => x[0] === e[0]) !== i), 'keine Kennung zweimal in der Liste eines Tages (Nähe und Ferne)');
  check(Object.keys(nAF.tage).every((t) => {
    const l = [...nAF.tage[t], ...V.fernListe(nAF, t)];
    return new Set(l.map((e) => e[0])).size === l.length;
  }), '… an keinem der 42 Tage');
  const versatz = vAF.ferne.tage.map((s) => s[1]);
  zeige(`Kodierung: ${vAF.ferne.listen.length} Referenzliste(n) [${vAF.ferne.listen.map((l) => l.length).join(', ')}], Versatz je Tag ${versatz.slice(0, 6).join(', ')} …, `
    + `${vAF.ferne.tage.filter((s) => s.length > 2).length} Tage mit Flicken, ${Object.keys(nAF.texte).length} Texte`);
  check(vAF.ferne.listen.length === 1 && versatz.every((x, k) => x === k),
    'verpasst ab heute: eine Referenzliste, und jeder Tag schiebt sie um einen Tag weiter (Versatz 0, 1, 2 …) – keine Flicken');
  vorschau.AF = vAF;
  Z.AF = Z.A;
}

{
  // 7b. Versatz und Flicken gegen frische Läufe: je Tag ein eigener Prozess,
  // der nur diesen Tag rechnet – ohne Referenz, die verschoben werden könnte.
  // Das Turnier auf dem Tag, an dem am 08.10. Workout 10 der zweiten Runde
  // läge – dort steht ohne Turnier sicher eine Einheit.
  const nAF = nutzlast(vorschau.AF);
  const turnierTag = V.fernListe(nAF, vorschau.AF.ab).find((e) => e[0] === 'cut-2-10')[1];
  const turnier = kopie();
  turnier.termine = [
    { datum: '2026-12-12', name: 'Padel', aktivitaet: 'padel', minuten: 90 },
    { datum: turnierTag, name: 'Turnier', schont: 'alles' },
    { datum: '2027-04-17', name: 'Bouldern', aktivitaet: 'bouldern', minuten: 120 },
  ];
  const faelle = [
    ['A', Z.A, '2026-10-08T12:00:00+02:00', [0, 1, 5, 17, 41]],
    ['R', Z.R, '2026-10-08T12:00:00+02:00', [0, 2, 3, 4, 12]],
    ['E2', Z.E2, '2026-10-23T19:00:00+02:00', [0, 1, 2, 9]],
    ['C', Z.C, '2026-10-08T19:00:00+02:00', [0, 1, 2, 6]],
    ['Termine', turnier, '2026-10-08T12:00:00+02:00', [0, 1, 3, 20, 41]],
    ['verpasst100', Z.A, '2027-01-16T12:00:00+01:00', [0, 1, 30]],
  ];
  for (const [name, z, jetzt, ks] of faelle) {
    const v = await rechneFern(z, jetzt);
    const n = nutzlast(v);
    const flicken = v.ferne.tage.filter((s) => s.length > 2).length;
    const anders = [];
    for (const k of ks) {
      const tag = addDays(v.ab, k);
      const f = frischFern(name, z, v.zeiten[tag]);
      if (f.tag !== tag || !gleich(schreib(n, n.tage[tag]), f.nah) || !gleich(schreib(n, V.fernListe(n, tag)), f.fern)) {
        const soll = f.fern;
        const ist = schreib(n, V.fernListe(n, tag));
        anders.push(`${tag} ${abweichung(soll, ist)}`);
      }
    }
    check(!anders.length && V.nutzlastPruefen(n) === null,
      `${name}: Nähe und Ferne an ${ks.length} Tagen genau wie ein frischer Lauf für diesen Tag allein `
      + `(${v.ferne.listen.length} Referenzliste(n), ${flicken} Tage mit Flicken)${anders.length ? ` – anders: ${anders[0].slice(0, 220)}` : ''}`);
    if (name === 'Termine') {
      const f0 = V.fernListe(n, v.ab);
      check(!f0.some((e) => e[1] === turnierTag) && V.fernListe(nAF, vorschau.AF.ab).some((e) => e[1] === turnierTag) && flicken > 0,
        `Termine in der Ferne: am Turnier (${turnierTag}, schont alles) steht keine Einheit – ohne es stünde dort eine –, und die Tage um die Termine sind Flicken`);
    }
  }
}

{
  // 7c. Die Kennungen der nächsten Runde = die, die die App beim echten
  // Rundenwechsel vergibt: Workout 1–80 gemacht, 81 heute fällig. Dann nach
  // Plan trainiert, die App jeden Tag geöffnet – bis in Runde 2 hinein.
  const z = kopie();
  const heute = '2026-10-24';
  z.customs = [];
  z.log = {};
  z.shift = tageZwischen(D.PLAN[80].date, heute);
  D.PLAN.slice(0, 80).forEach((w) => {
    const db = {};
    w.ex.forEach((it) => { db[it.id] = Array.from({ length: it.sets }, () => ({ w: '20', done: true })); });
    z.log[w.n] = { mode: 'db', db, bw: {}, done: 'db', startedOn: addDays(w.date, z.shift) };
  });
  const v = await rechneFern(z, `${heute}T12:00:00+02:00`);
  const n = nutzlast(v);
  const geschaetzt = new Map([...n.tage[heute], ...V.fernListe(n, heute)].map((e) => [e[0], e]));
  check(kurz(ausVorschau(v, heute).filter((t) => t.datum >= heute)) === 'cut-1-81@10-24 cut-1-82@10-26 cut-1-83@10-28 cut-1-84@10-29',
    'Rundenende in Sicht: die Nähe zeigt Workout 81–84 (und nichts danach – die nächste Runde gibt es dort noch nicht)');
  const r2fruh = V.fernListe(n, heute).filter((e) => e[0].startsWith('cut-2-') && e[1] <= addDays(heute, 28));
  check(r2fruh.length >= 10 && r2fruh[0][0] === 'cut-2-1' && r2fruh[0][1] === addDays('2026-10-29', abstand),
    `… die Ferne füllt die Wochen danach schon mit Runde 2 (ab ${r2fruh[0] && r2fruh[0][1]}, ${r2fruh.length} Einheiten in den vier Wochen) – keine Lücke`);
  const amTag = (iso, h, m) => { const [y, mo, d] = iso.split('-').map(Number); return new Date(y, mo - 1, d, h, m).getTime(); };
  mitUhr(amTag(heute, 12, 0), () => store.importJSON(JSON.stringify(z)));
  const gemacht = [];
  let tag = heute;
  for (let i = 0; i < 21; i++) {
    mitUhr(amTag(tag, 18, 0), () => {
      tagstart.tagNachziehen({ art: 'start' });
      const w = D.PLAN.find((x) => !P.completedMode(x.n));
      if (!w || P.effDate(w) !== tag) return;
      const mode = store.workoutMode(w.n);
      store.completeWorkout(w.n, mode, P.workoutByNo(w.n, mode).ex.map((x) => ({ id: x.id, sets: x.sets, nach: x.nach || 0, w: '20' })));
      store.markDone(w.n, mode);
      gemacht.push(`${w.n}@${tag.slice(5)}`);
    });
    tag = addDays(tag, 1);
  }
  const echt = mitUhr(amTag(tag, 12, 0), () => {
    tagstart.tagNachziehen({ art: 'start' });
    return kalender.kalenderTermine({ von: heute, bis: addDays(heute, 120) });
  });
  const r2 = echt.filter((t) => t.kennung.startsWith('cut-2-'));
  const passt = r2.filter((t) => {
    const e = geschaetzt.get(t.kennung);
    return e && e[1] === t.datum && n.texte[e[3]][0] === t.titel && n.texte[e[3]][1] === t.beschreibung;
  });
  zeige(`nach Plan trainiert: ${gemacht.join(' ')}`);
  check(r2.length > 50 && passt.length === r2.length,
    `echter Rundenwechsel: alle ${r2.length} Einheiten der Runde 2 in den nächsten vier Monaten mit derselben Kennung, demselben Tag und Text wie geschätzt (${passt.length})`);
  check(store.getState().rounds.length === 1 && kalender.kalenderRunde().runde === 2,
    'die App hat die Runde selbst weitergerollt (rundeWeiter()), die Schätzung kam aus naechsteRundeAb() und restartPlan()');
}

{
  // 7d. Größe: typisch, mit vielen Terminen, gekürzt – nie gescheitert.
  const fussball = kopie();
  fussball.termine = Array.from({ length: 52 }, (_, i) => ({
    datum: addDays('2026-11-07', i * 7), name: 'Fußball', aktivitaet: 'fussball', minuten: 90,
  }));
  const vF = await rechneFern(fussball, '2026-10-08T12:00:00+02:00');
  const nF = nutzlast(vF);
  const vAF = vorschau.AF;
  const nAF = nutzlast(vAF);
  const b = (n) => V.nutzlastBytes(n);
  zeige(`Größe: typisch ${(b(nAF) / 1024).toFixed(1)} KiB (gzip ${(gzipSync(JSON.stringify(nAF)).length / 1024).toFixed(1)}), `
    + `Fußball jede Woche ${(b(nF) / 1024).toFixed(1)} KiB (${vF.ferne.listen.length} Referenzlisten, ${Object.keys(nF.texte).length} Texte), `
    + `Rechenzeit ${Math.round(vF.ms)} ms (Ferne ${Math.round(vF.fernMs)} ms)`);
  check(b(nAF) < V.VORSCHAU_MAX_BYTES, `typisch (Tobis Stand) ein Jahr in ${(b(nAF) / 1024).toFixed(1)} KiB – sogar unter 64 KiB`);
  check(b(nF) < V.VORSCHAU_MAX_BYTES_2 && !vF.gekuerzt && V.nutzlastPruefen(nF) === null,
    `52 Termine in der Ferne: ${(b(nF) / 1024).toFixed(1)} KiB, unter 192 KiB, nicht gekürzt`);
  const eng = await rechneFern(Z.A, '2026-10-08T12:00:00+02:00', { maxBytes: 45 * 1024 });
  const nE = nutzlast(eng);
  const fE = V.fernListe(nE, eng.ab);
  check(eng.gekuerzt && eng.gekuerzt < 365 && eng.ferne.bis === eng.gekuerzt && b(nE) <= 45 * 1024 && V.nutzlastPruefen(nE) === null
    && fE.length && fE[fE.length - 1][1] <= addDays(eng.ab, eng.gekuerzt),
  `zu groß für 45 KiB: die Ferne wird kürzer (bis d + ${eng.gekuerzt}, ${(b(nE) / 1024).toFixed(1)} KiB), die Sendung geht – und gekuerzt sagt es`);
  const winzig = await rechneFern(Z.A, '2026-10-08T12:00:00+02:00', { maxBytes: 10 * 1024 });
  const nW = nutzlast(winzig);
  check(winzig.gekuerzt === 28 && winzig.ferne.bis === 28 && !V.fernListe(nW, winzig.ab).length && V.nutzlastPruefen(nW) === null
    && JSON.stringify(nW.tage) === JSON.stringify(vA.tage),
  'passt nicht einmal die Nähe in die Grenze: Ferne ganz weg, die Nähe geht trotzdem – nie scheitert das Senden an der Ferne');
  const n1 = V.nutzlastBauen(vAF, { token: TOKEN, geraet: 'testgeraet01', seq: 41, gesendet: um('2026-10-08T12:00:00+02:00'), app: 'v245', v: 1 });
  check(JSON.stringify(n1) === JSON.stringify(nutzlast(vA)),
    'für ein Skript der Fassung 1: dieselbe Vorschau als v 1 – ohne Ferne, nur die Texte der Nähe, Byte für Byte wie ohne Ferne gerechnet');
  check(V.VORSCHAU_MAX_BYTES_2 * 2 + 20 * 1024 < 500 * 1000,
    'die Grenze: zwei Sendungen zu 192 KiB nebeneinander (alte und neue Generation beim Speichern) passen mit Luft in 500 KB Skript-Eigenschaften');
}

{
  // 7e. Der Vertrag, Fassung 2.
  const n = nutzlast(vorschau.AF);
  const kaputt = (aendern) => { const k = JSON.parse(JSON.stringify(n)); aendern(k); return V.nutzlastPruefen(k); };
  const faelle = [
    ['ohne ferne', (k) => { delete k.ferne; }],
    ['bis über 400', (k) => { k.ferne.bis = 401; }],
    ['bis unter fenster[1]', (k) => { k.ferne.bis = 27; }],
    ['keine Liste', (k) => { k.ferne.listen = []; }],
    ['Liste zu lang', (k) => { k.ferne.listen[0] = Array.from({ length: 601 }, () => k.ferne.listen[0][0]); }],
    ['Eintrag mit Datum statt Zahl', (k) => { k.ferne.listen[0][0][1] = '2026-11-07'; }],
    ['Eintrag ohne Text', (k) => { k.ferne.listen[0][0][3] = 'constructor'; }],
    ['Kennung ohne Muster', (k) => { k.ferne.listen[0][0][0] = 'Workout 30'; }],
    ['Satz auf eine Liste, die es nicht gibt', (k) => { k.ferne.tage[3][0] = 1; }],
    ['Satz mit Flicken ohne dazu', (k) => { k.ferne.tage[3] = [0, 3, []]; }],
    ['ein Tag ohne Satz', (k) => { k.ferne.tage.pop(); }],
  ];
  const gruende = faelle.map(([name, f]) => [name, kaputt(f)]);
  check(gruende.every(([, g]) => g === 'ferne'), `kaputte Ferne → „ferne" (${gruende.filter(([, g]) => g !== 'ferne').map(([x, g]) => `${x}: ${g}`).join(', ') || '11 Fälle'})`);
  const gross = kaputt((k) => { for (let i = 0; i < 40; i++) k.texte[`gross${i}`] = ['x', 'y'.repeat(2000)]; });
  const zuGross = kaputt((k) => { for (let i = 0; i < 90; i++) k.texte[`gross${i}`] = ['x', 'y'.repeat(2000)]; });
  check(gross === null && zuGross === 'groesse', 'v 2 darf über 64 KiB (hier rund 140 KiB), aber nicht über 192 KiB');
  check(V.nutzlastPruefen({ ...nutzlast(vA), texte: { ...nutzlast(vA).texte, ...Object.fromEntries(Array.from({ length: 30 }, (_, i) => [`g${i}`, ['x', 'y'.repeat(2000)]])) } }) === 'groesse',
    'v 1 bleibt bei 64 KiB – mehr nimmt ein Skript der Fassung 1 nicht');
}

{
  // 7f. bleibtStehen(), Fassung 2: am Tag des Rundenwechsels bleibt die eben
  // gemachte letzte Einheit stehen; eine Schätzung, die nicht eintraf, nicht.
  const liste = [['cut-2-1', '2026-10-31', 60, 'h', 0], ['cut-3-1', '2027-03-27', 60, 'h', 0]];
  check(V.bleibtStehen({ kennung: 'cut-1-84', datum: '2026-10-29' }, liste, '2026-10-29'),
    'Workout 84 heute gemacht, die Runde rollt im selben Start weiter: sein Termin bleibt (bis v245 kam er weg, weil er „heute" lag)');
  check(!V.bleibtStehen({ kennung: 'cut-2-5', datum: '2026-10-28' }, [['cut-1-84', '2026-10-30', 60, 'h', 0]], '2026-10-29'),
    'eine Schätzung von Runde 2 in der Vergangenheit, die Liste kennt nur Runde 1: kommt weg');
  check(!V.bleibtStehen({ kennung: 'cut-1-9', datum: '2026-10-29' }, [['cut-1-10', '2026-10-31', 60, 'h', 0]], '2026-10-29')
    && !V.bleibtStehen({ kennung: 'cut-1-z1', datum: '2026-10-27' }, [['cut-1-5', '2026-10-31', 60, 'h', 0]], '2026-10-29')
    && V.bleibtStehen({ kennung: 'aufbau-1-3', datum: '2026-10-01' }, liste, '2026-10-29')
    && !V.bleibtStehen({ kennung: 'cut-1-3', datum: '2026-10-30' }, [], '2026-10-29'),
  'sonst wie bisher: dieselbe Runde heute und davor weg, ein anderer Fokus bleibt, nach heute weg');
}

/* ------------------------------------------------------------------ *
 * 2b und 5. Im Browser: die echte App am Tag d, der Worker, das Fenster
 * ------------------------------------------------------------------ */

const { chromium } = await import('playwright');
const browser = await chromium.launch();
const kontext = () => browser.newContext({ timezoneId: 'Europe/Berlin', serviceWorkers: 'block', viewport: { width: 414, height: 896 } });

/** Die App am Tag d um die Uhrzeit der Vorschau geöffnet: ihre Termine im Fenster. */
const appAmTag = async (name, ms, { von, bis }) => {
  const ctx = await kontext();
  const page = await ctx.newPage();
  const fehler = [];
  page.on('pageerror', (e) => fehler.push(e.message));
  await page.clock.setFixedTime(new Date(ms));
  await page.addInitScript((s) => {
    if (sessionStorage.getItem('gesaet')) return;
    sessionStorage.setItem('gesaet', '1');
    localStorage.setItem('workout.state.v1', JSON.stringify(s));
  }, Z[name]);
  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForTimeout(300);
  const liste = await page.evaluate(async (f) => (await import('./js/kalender.js')).kalenderTermine(f), { von, bis });
  await ctx.close();
  return { liste: vergleichbar(liste), fehler };
};
const imBrowser = [
  ['A', '2026-10-08'], ['A', '2026-10-12'], ['A', '2026-10-26'], ['C', '2026-10-10'], ['Cspaet', '2026-10-09'],
  ['Cnacht', '2026-10-09'], ['D', '2026-10-12'], ['E', '2026-10-26'], ['E2', '2026-10-24'], ['F', '2026-10-11'], ['F', '2026-10-12'],
  ['R', '2026-10-08'], ['R', '2026-10-10'], ['R', '2026-10-11'], ['G', '2026-10-08'],
];
for (const [name, tag] of imBrowser) {
  const v = vorschau[name];
  const { liste, fehler } = await appAmTag(name, v.zeiten[tag], fenster(v, tag));
  const soll = ausVorschau(v, tag);
  check(gleich(soll, liste) && !fehler.length,
    `${name}, ${tag}: Vorschau = die App an dem Tag um ${new Date(v.zeiten[tag]).toTimeString().slice(0, 5)} (${soll.length} Termine)`
    + `${fehler.length ? ` – Fehler: ${fehler[0]}` : ''}${gleich(soll, liste) ? '' : ` – ${abweichung(soll, liste)}`}`);
}

{
  const ctx = await kontext();
  const page = await ctx.newPage();
  const fehler = [];
  page.on('pageerror', (e) => fehler.push(e.message));
  await page.addInitScript((s) => {
    if (sessionStorage.getItem('gesaet')) return;
    sessionStorage.setItem('gesaet', '1');
    localStorage.setItem('workout.state.v1', JSON.stringify(s));
  }, Z.C);
  await page.goto(URL, { waitUntil: 'load' });
  // Die Seite trägt C (Workout 9 angefangen), der Worker rechnet A (ohne):
  // Hätte die Vorschau den Zustand der Seite angefasst, wäre Workout 9 weg.
  const anders = { ...Z.A, focus: 'standard' };
  const r = await page.evaluate(async ({ zustand, jetzt, anders, ferne }) => {
    const store = await import('./js/store.js');
    const w9 = () => !!store.getState().log[9] && !!JSON.parse(localStorage.getItem('workout.state.v1')).log['9'];
    const vorher = w9();
    const w = new Worker('./js/kalender-worker.js', { type: 'module' });
    const frage = (n) => new Promise((ok) => { w.onmessage = (e) => ok(e.data); w.postMessage(n); });
    const t0 = performance.now();
    const a = await frage({ id: 1, zustand, jetzt });
    const t1 = performance.now();
    const b = await frage({ id: 2, zustand, jetzt });
    const t2 = performance.now();
    // Mit Ferne, wie für ein Skript der Fassung 2 – dreimal, für die Messung.
    const d = await frage({ id: 4, zustand, jetzt, ferne });
    const t3 = performance.now();
    const mitFerne = [t3 - t2];
    for (let i = 0; i < 2; i++) {
      const s = performance.now();
      await frage({ id: 5 + i, zustand, jetzt, ferne });
      mitFerne.push(performance.now() - s);
    }
    const c = await frage({ id: 3, zustand: anders, jetzt });
    w.terminate();
    const V = await import('./js/kalender-vorschau.js');
    let imFenster = 'gerechnet';
    try { await V.vorschauRechnen(zustand, { jetzt }); } catch (e) { imFenster = e.message; }
    return {
      a, b, c, d, erster: t1 - t0, zweiter: t2 - t1, mitFerne, imFenster,
      zustandGleich: vorher && w9(),
      uhrEcht: Date.name === 'Date' && Math.abs(Date.now() - performance.timeOrigin - performance.now()) < 5000,
      speicherEcht: Object.prototype.toString.call(localStorage) === '[object Storage]',
    };
  }, { zustand: Z.A, jetzt: um('2026-10-08T12:00:00+02:00'), anders, ferne: FERNE });
  zeige(`Worker in Chromium: erster Lauf ${Math.round(r.erster)} ms (mit Laden der Module), zweiter ${Math.round(r.zweiter)} ms`);
  zeige(`Worker in Chromium mit Ferne (ein Jahr): ${r.mitFerne.map(Math.round).join(' / ')} ms, davon Ferne ${Math.round(r.d.vorschau.fernMs)} ms – am Handy grob das Drei- bis Vierfache`);
  const ohneMessung = (v) => v && JSON.stringify({ ...v, ms: 0, fernMs: 0 });
  check(r.a.ok && r.a.id === 1 && ohneMessung(r.a.vorschau) === ohneMessung(vA),
    'Worker: dieselbe Vorschau wie in Node, Tag für Tag und Text für Text');
  check(r.b.ok && ohneMessung(r.b.vorschau) === ohneMessung(vA), 'Worker: ein zweiter Lauf im selben Worker ebenso');
  check(r.d.ok && ohneMessung(r.d.vorschau) === ohneMessung(vorschau.AF),
    'Worker mit Ferne: dasselbe Jahr wie in Node – Referenzlisten, Versatz, Texte');
  check(Math.max(...r.mitFerne.slice(1)) < 2000,
    `die Ferne kostet im Worker unter 2 s je Vorschau (${r.mitFerne.slice(1).map(Math.round).join(', ')} ms) – entprellt, nie im Fenster`);
  check(!r.c.ok && r.c.code === 'fokus', `Worker: anderer Fokus → „fokus", die Seite legt einen neuen an (${r.c.code})`);
  check(/nur in einem Worker/.test(r.imFenster), `im Fenster der App verweigert (${r.imFenster.slice(0, 60)}…)`);
  check(r.zustandGleich && r.uhrEcht && r.speicherEcht,
    'danach: der Zustand der App (Workout 9 angefangen) steht noch, Uhr und Speicher sind die echten');
  check(!fehler.length, `keine Fehler auf der Seite und im Worker${fehler.length ? `: ${fehler[0]}` : ''}`);
  await ctx.close();
}

await browser.close();
console.log(fails ? `\n${fails} gescheitert` : '\nalles grün');
