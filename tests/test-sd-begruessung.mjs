/*
 * Schilddrüse: das Begrüßungsfenster „So hilft Ihnen die App" (Nov. 2026).
 *
 * Die Nutzerin hatte ihre Tabletten weggelassen – sie beeinflussten nur „den
 * einen Wert". Das Fenster erklärt in sechs Seiten, warum die Tablette wichtig
 * ist und was man in der App tun kann. Geprüft wird, wann es von selbst kommt
 * und wann nicht:
 *
 *   - einmal bei der Nutzerin mit Daten aus der alten App (PR #3) – mit genau
 *     dem Stand, den deren normStand speichert –, ohne dass Daten verloren gehen,
 *   - beim ersten „Heute" nach dem Einrichten, auch nach dem Einlesen einer
 *     alten Sicherung auf einem neuen Handy,
 *   - nie über einer 112-Karte (W1 aus dem Check, W5 aus dem Befinden), dann
 *     am nächsten Tag,
 *   - von einer lokalen Adresse nur mit ausdrücklicher Freigabe (sonst läge
 *     es in jeder anderen Testdatei über „Heute").
 *
 * Und wie es sich bedienen lässt: Text wörtlich, „Weiter" bei 360 × 740 auf
 * jeder Seite zu sehen (auch bei „sehr groß"), Fokus auf der Überschrift,
 * Escape schließt, unter „Mehr" jederzeit wieder zu öffnen, kein Neuladen
 * eines Updates mitten im Lesen.
 */
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { oeffne, plus, ansichtText, SCHLUESSEL } from './sd-hilfe.mjs';
import { ABLAGE } from './umgebung.mjs';

const TAG = '2026-11-07';
const FREIGABE = 'schilddruese.einfuehrung.lokal';

/*
 * So speichert die alte App aus PR #3 (Commit 03a6d3a) einen Stand: erzeugt
 * mit deren normStand (git show 03a6d3a:schilddruese/js/speicher.js) –
 * Fassung 1, im Profil nur Anrede, „begrüßt" und „seit", die Befunde ohne die
 * Fragen zur Blutabnahme, kein Merkmal des Begrüßungsfensters.
 */
const ALT_PR3 = {
  version: 1,
  profil: { name: 'Mama', begruesst: true, seit: '2026-09-01' },
  einstellungen: { erinnerung: '07:30', schrift: 'gross', farbe: 'hell', hinweisTablette: true },
  dosen: [{ id: 'mod1abc', ab: '2026-09-01', praeparat: 'L-Thyroxin Henning', mikrogramm: 75, tabletten: 1, notiz: '' }],
  einnahmen: { '2026-10-30': { uhr: '07:31' }, '2026-10-31': { uhr: '07:40' }, '2026-11-01': null, '2026-11-02': { uhr: '07:35' } },
  labor: [{ id: 'mod2abc', datum: '2026-10-15', tsh: { wert: 6.8, einheit: 'mU/l', von: 0.27, bis: 4.2 }, ft4: null, ft3: null, notiz: '' }],
  befinden: [{ id: 'mod3abc', datum: '2026-11-02', stufe: 'mittel', beschwerden: ['muede'], notiz: '' }],
  gewicht: [],
  termine: [],
  fragen: [{ id: 'mod4abc', text: 'Muss ich die Tablette wirklich nehmen?', erledigt: false }],
  vorrat: null,
  tab: 'heute',
  letzteSicherung: null,
  dauerhaft: false,
};
const kopie = (o) => JSON.parse(JSON.stringify(o));

const { ctx, page, check, uhr, gespeichert, ende } = await oeffne({ viewport: { width: 360, height: 740 }, tag: TAG, zeit: '08:15', stand: ALT_PR3 });

const fenster = page.locator('dialog.begruessung');
const offen = async () => (await page.locator('dialog.begruessung[open]').count()) === 1;
const fokusId = () => page.evaluate(() => (document.activeElement ? document.activeElement.id : ''));
/**
 * Einen Stand in den Speicher legen und die App neu starten – ohne den
 * gemerkten Reiter der Sitzung, wie beim Öffnen vom Startbildschirm.
 * `neustart: false`: nur neu laden, wie nach einem Update am selben Tag.
 */
const mitStand = async (s, { t = TAG, z = '08:15', neustart = true } = {}) => {
  await page.evaluate(({ key, st, neu }) => {
    localStorage.clear();
    if (neu) sessionStorage.clear();
    if (st) localStorage.setItem(key, JSON.stringify(st));
  }, { key: SCHLUESSEL, st: s, neu: neustart });
  await uhr(t, z);
};

// ---------------------------------------------------------------- lokale Adresse

check(!(await fenster.count()), 'lokale Adresse ohne Freigabe: das Fenster kommt nicht von selbst (sonst läge es in jeder Testdatei über „Heute")');
check((await page.evaluate((key) => JSON.parse(localStorage.getItem(key)).version, SCHLUESSEL)) === 1, '… und der alte Stand bleibt unangetastet');

// Ab hier freigeschaltet – vor jedem Laden, wie test-admin.mjs den Rückkanal.
await ctx.addInitScript((k) => localStorage.setItem(k, '1'), FREIGABE);

// ---------------------------------------------------------------- die Nutzerin mit Daten aus PR #3

await mitStand(ALT_PR3);
check(await offen(), 'alte App (PR #3) → Update: das Begrüßungsfenster ist beim ersten Öffnen da');
const texte = await page.evaluate(async () => {
  const m = await import('./js/ansicht-begruessung.js');
  return { seiten: m.SEITEN, satz: m.RUECKKANAL_SATZ };
});
check(texte.seiten.length >= 4 && texte.seiten.length <= 6, `4 bis 6 Seiten (${texte.seiten.length})`);
// Begrüßung (Nov. 2026, nach der Prüfung): zwei Sätze verständlicher, ohne neuen Inhalt.
check(texte.seiten[3].absaetze[1].startsWith('Ob das auch für Sie gilt, kann man an einem Wert, der mit Tablette gemessen wurde, nicht ablesen.')
  && !texte.seiten.some((t) => t.absaetze.some((a) => a.includes('zeigt ein Wert mit Tablette nicht'))), 'Seite 4: „… kann man an einem Wert, der mit Tablette gemessen wurde, nicht ablesen."');
check(texte.seiten[5].absaetze[2] === 'Nichts über Ihre Gesundheit. Ausschalten können Sie das gleich hier unten – oder später unter „Mehr → Über diese App".',
  'Seite 6: Ausschalten „gleich hier unten" – der Schalter steht direkt darunter');
check(await page.evaluate(async () => (await import('./js/ansicht-begruessung.js')).EINFUEHRUNG_FASSUNG) === 1, '… inhaltlich gleich, die Fassung des Texts bleibt 1');
check((await fenster.locator('h2').innerText()) === 'Wozu die Tablette?' && (await fenster.locator('.schritte').innerText()) === `Seite 1 von ${texte.seiten.length}`,
  'Seite 1: „Wozu die Tablette?" mit „Seite 1 von 6"');
check(await fokusId() === 'begruessung-titel', 'der Fokus steht auf der Überschrift, nicht auf „Weiter"');
check((await fenster.getAttribute('aria-label')) === 'Einführung: So hilft Ihnen die App', 'das Fenster hat einen Namen für Vorleseprogramme');
check(await page.evaluate(() => { const d = document.querySelector('dialog.begruessung'); return d.scrollTop === 0 && d.matches(':modal'); }), 'modal und oben angefangen');
let s = await gespeichert();
check(s.version === 4 && s.profil.einfuehrung === 1 && s.profil.einfuehrungDaten === false, `gemerkt beim Anzeigen: Fassung 4, einfuehrung 1, Datenseite noch nicht (${s.version}/${s.profil.einfuehrung}/${s.profil.einfuehrungDaten})`);
check(s.profil.name === 'Mama' && s.profil.seit === '2026-09-01' && s.dosen.length === 1 && s.dosen[0].mikrogramm === 75 && s.dosen[0].id === 'mod1abc'
  && JSON.stringify(s.einnahmen) === JSON.stringify(ALT_PR3.einnahmen) && s.labor.length === 1 && s.labor[0].tsh.wert === 6.8
  && s.fragen.length === 1 && s.befinden.length === 1, 'die Daten aus der alten App sind vollständig da (Dosis, Einnahmen samt „nicht genommen", Befund, Frage, Befinden)');
check((await ansichtText(page)).includes('L-Thyroxin Henning 75 µg'), 'darunter steht ihr „Heute"');
check(await page.evaluate(() => window.__schilddrueseNeuLadenErlaubt()) === false, 'ein Update lädt nicht mitten im Lesen neu');

// Escape heißt „Später lesen".
await page.keyboard.press('Escape');
check(!(await fenster.count()), 'Escape schließt das Fenster');
check(await fokusId() === 'ansicht', '… und der Fokus steht wieder auf der Ansicht');
check(await page.evaluate(() => window.__schilddrueseNeuLadenErlaubt()) === true, '… danach darf ein Update wieder neu laden');
await page.click('.tablette');
s = await gespeichert();
check(s.einnahmen[TAG] && s.einnahmen[TAG].uhr === '08:15', '„Heute" ist danach bedienbar: Tablette abgehakt');
await uhr(TAG, '08:30');
check(!(await fenster.count()), 'einmal: nach dem Neuladen kommt es nicht wieder');
await uhr(plus(TAG, 1), '08:00');
check(!(await fenster.count()), '… auch nicht am nächsten Tag');

// Eine alte Sicherung ohne das Merkmal macht es nicht wieder „fällig".
const nachImport = await page.evaluate(async (alt) => {
  const sp = await import('./js/speicher.js');
  const r = sp.importJSON(JSON.stringify({ ...alt, app: 'schilddruese' }));
  return { ok: r.ok, einfuehrung: sp.getStand().profil.einfuehrung };
}, { ...ALT_PR3, profil: { ...ALT_PR3.profil, name: 'Mama (Sicherung)' } });
check(nachImport.ok && nachImport.einfuehrung === 1, `eine alte Sicherung (ohne Merkmal) einlesen: das schon angezeigte Fenster bleibt angezeigt (${JSON.stringify(nachImport)})`);

// ---------------------------------------------------------------- unter „Mehr", Seite für Seite

await uhr(TAG, '08:15');
await page.click('#reiter-mehr');
const zeile = page.locator('[data-act="begruessung"]');
check((await zeile.innerText()).includes('Einführung: So hilft Ihnen die App'), 'unter „Mehr": „Einführung: So hilft Ihnen die App"');
await zeile.click();
check(await offen(), '… öffnet dasselbe Fenster, auch wenn es schon angezeigt wurde');

/** Liegt „Weiter" (bzw. „Los geht's") ganz im sichtbaren Teil des Fensters und des Bildschirms? */
const knopfImBild = () => page.evaluate(() => {
  const d = document.querySelector('dialog.begruessung');
  const k = d.querySelector('[data-act="begruessung-weiter"], [data-act="begruessung-fertig"]');
  const r = k.getBoundingClientRect();
  const f = d.getBoundingClientRect();
  return { ok: r.top >= f.top && r.bottom <= f.bottom + 1 && r.bottom <= window.innerHeight && r.height >= 40, unten: Math.round(r.bottom), fenster: Math.round(f.bottom) };
});
const seitenText = () => fenster.evaluate((d) => ({
  titel: d.querySelector('h2').textContent,
  absaetze: [...d.querySelectorAll('p:not(.schritte)')].map((p) => p.textContent),
  quer: d.scrollWidth <= d.clientWidth,
  oben: d.scrollTop,
}));

for (let i = 0; i < texte.seiten.length; i++) {
  const soll = texte.seiten[i];
  const ist = await seitenText();
  check(ist.titel === soll.titel && JSON.stringify(ist.absaetze) === JSON.stringify(soll.absaetze), `Seite ${i + 1} „${soll.titel}": der geprüfte Text, wörtlich`);
  check(ist.oben === 0 && await fokusId() === 'begruessung-titel', `Seite ${i + 1}: oben angefangen, Fokus auf der Überschrift`);
  const k = await knopfImBild();
  check(k.ok, `Seite ${i + 1}: „${i === texte.seiten.length - 1 ? 'Los geht\'s' : 'Weiter'}" ist bei 360 × 740 und Schrift „groß" ohne Scrollen zu sehen (${k.unten} ≤ ${k.fenster})`);
  check(ist.quer, `Seite ${i + 1}: kein waagerechtes Scrollen`);
  if (i === 1) {
    await page.click('[data-act="begruessung-zurueck"]');
    check((await fenster.locator('h2').innerText()) === texte.seiten[0].titel, '„Zurück" führt eine Seite zurück');
    await page.waitForTimeout(700);   // die Sperre gegen den Doppeltipp
    await page.click('[data-act="begruessung-weiter"]');
    await page.waitForTimeout(700);
  }
  if (i === 0) check(!(await fenster.locator('[data-act="begruessung-zurueck"]').count()), 'Seite 1 hat kein „Zurück"');
  if (i < texte.seiten.length - 1) {
    await page.click('[data-act="begruessung-weiter"]');
    await page.waitForTimeout(700);
  }
}
const letzte = await seitenText();
check(letzte.absaetze.includes(texte.satz), 'die letzte Seite nennt den Rückkanal wörtlich');
check(await fenster.locator('[data-stelle="rueckkanal"]').count() === 1, '… und hat die Stelle für den Schalter');
check((await fenster.locator('[data-act="begruessung-fertig"]').innerText()).includes('Los geht'), '… mit „Los geht\'s"');
check((await fenster.locator('[data-act="begruessung-zu"]').innerText()) === 'Schließen', '… und oben „Schließen" statt „Später lesen"');
s = await gespeichert();
check(s.profil.einfuehrungDaten === true, 'die Seite „Ihre Daten" war zu sehen – gemerkt');
await page.click('[data-act="begruessung-fertig"]');
check(!(await fenster.count()), '„Los geht\'s" schließt');
check(await page.evaluate(() => document.activeElement && document.activeElement.dataset.act === 'begruessung'), '… der Fokus kehrt zur Zeile unter „Mehr" zurück');

// Neu geladen am selben Tag (etwa nach einem Update), während „Mehr" offen
// war: Die App steht wieder auf „Mehr". Das Fenster wartet auf „Heute".
// Dazu Schrift „sehr groß": „Weiter" bleibt auf jeder Seite zu sehen.
await mitStand({ ...kopie(ALT_PR3), einstellungen: { ...ALT_PR3.einstellungen, schrift: 'sehr-gross' } }, { neustart: false });
check(!(await fenster.count()) && (await page.locator('#reiter-mehr').getAttribute('aria-selected')) === 'true', 'neu geladen auf „Mehr": noch kein Fenster');
await page.click('#reiter-heute');
check(await offen(), '… beim Tipp auf „Heute" ist es da (Schrift „sehr groß")');
let alleImBild = true;
const unten = [];
for (let i = 0; i < texte.seiten.length; i++) {
  const k = await knopfImBild();
  unten.push(k.unten);
  alleImBild = alleImBild && k.ok;
  if (i < texte.seiten.length - 1) {
    await page.click('[data-act="begruessung-weiter"]');
    await page.waitForTimeout(700);
  }
}
check(alleImBild, `Schrift „sehr groß": „Weiter" ist auf allen Seiten zu sehen (${unten.join(', ')})`);
await page.click('[data-act="begruessung-zu"]');

// ---------------------------------------------------------------- nach dem Neuladen oben

/*
 * Begrüßung (Nov. 2026, nach der Prüfung): Nach dem Neuladen eines Updates
 * stellte Chrome die Rollposition der alten Seite wieder her – bei 390 × 844
 * und Schrift „sehr groß" stand „Heute" 287 px tief, Notfallleiste und
 * Tabletten-Knopf lagen über dem Rand (W0). Nachgestellt mit einer gerollten
 * Seite und einem Neuladen: Die App beginnt trotzdem oben.
 */
await page.setViewportSize({ width: 390, height: 844 });
await mitStand({ ...kopie(ALT_PR3), profil: { ...ALT_PR3.profil, einfuehrung: 1 }, einstellungen: { ...ALT_PR3.einstellungen, schrift: 'sehr-gross' } });
check(await page.evaluate(() => history.scrollRestoration) === 'manual', 'die Rollposition stellt die App selbst (history.scrollRestoration = manual)');
await page.evaluate(() => window.scrollTo(0, 300));
await page.waitForTimeout(200);
const gerollt = await page.evaluate(() => Math.round(window.scrollY));
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(1800);   // Chrome stellte nach etwa 1,1 s wieder her
const nachLaden = await page.evaluate(() => {
  const a = document.querySelector('#ansicht .notfall-leiste a[href="tel:112"]');
  const kopf = document.querySelector('.kopf').getBoundingClientRect().bottom;
  const r = a ? a.getBoundingClientRect() : null;
  const t = document.querySelector('.tablette').getBoundingClientRect();
  return { y: Math.round(window.scrollY), frei: Boolean(r && r.top >= kopf - 1 && r.bottom <= window.innerHeight), tablette: t.top >= kopf - 1 && t.bottom <= window.innerHeight };
});
check(gerollt > 0 && nachLaden.y === 0, `gerollt (${gerollt} px) und neu geladen: „Heute" beginnt oben (scrollY ${nachLaden.y})`);
check(nachLaden.frei && nachLaden.tablette, '… „112 anrufen" und der Tabletten-Knopf stehen ganz im Bild, unter dem Kopf');
// Dasselbe mit dem Fenster: Nach „Später lesen" steht „Heute" oben.
await mitStand({ ...kopie(ALT_PR3), einstellungen: { ...ALT_PR3.einstellungen, schrift: 'sehr-gross' } });
await page.keyboard.press('Escape');
await page.evaluate(() => window.scrollTo(0, 300));
await page.evaluate((key) => {
  const st = JSON.parse(localStorage.getItem(key));
  st.profil.einfuehrung = 0;
  localStorage.setItem(key, JSON.stringify(st));
}, SCHLUESSEL);
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(1800);
check(await offen(), 'mit fälligem Fenster neu geladen: das Fenster ist da');
await page.keyboard.press('Escape');
check(await page.evaluate(() => Math.round(window.scrollY)) === 0, '… und nach dem Schließen beginnt „Heute" oben');
await page.setViewportSize({ width: 360, height: 740 });

// ---------------------------------------------------------------- nie über einer 112-Karte

const mitW1 = { ...kopie(ALT_PR3), warnzeichen: [{ id: 'z1', datum: TAG, uhr: '08:05', ja: ['brust'] }] };
await mitStand(mitW1);
check(!(await fenster.count()), 'Warnzeichen-Check von heute mit Brustschmerz (W1, 112-Karte auf „Heute"): kein Fenster');
/** Ist ein Anruf-Knopf in der Ansicht frei antippbar – nicht von einem Fenster verdeckt? */
const frei = (nummer) => page.evaluate((n) => [...document.querySelectorAll(`#ansicht a[href="tel:${n}"]`)].some((a) => {
  if (!a.offsetParent) return false;
  a.scrollIntoView({ block: 'center' });
  const r = a.getBoundingClientRect();
  const da = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
  return Boolean(da && da.closest('a') === a);
}), nummer);
check(await frei('112'), '… „112 anrufen" auf „Heute" ist frei antippbar');
s = await gespeichert();
check(!s || !s.profil.einfuehrung, '… und es gilt nicht als angezeigt');
await uhr(plus(TAG, 1), '08:15');
check(await offen(), 'am nächsten Tag (der Check zählt nicht mehr): jetzt kommt es');
await page.click('[data-act="begruessung-zu"]');

const mitW5 = { ...kopie(ALT_PR3), befinden: [{ id: 'f1', datum: TAG, stufe: 'schlecht', beschwerden: ['lebensmuede'], notiz: '' }] };
await mitStand(mitW5);
check(!(await fenster.count()), 'Befinden von heute „nicht mehr leben möchte" (W5): kein Fenster über der Karte');
check(await frei('08001110111'), '… die Telefonseelsorge ist frei antippbar');

// ---------------------------------------------------------------- nach dem Einrichten

await mitStand(null);
check(await page.locator('.willkommen-titel').isVisible() && !(await fenster.count()), 'neues Handy: erst die Einrichtung, kein Fenster darüber');
await page.fill('input[name=name]', 'Erika');
await page.click('[data-act="willkommen-weiter"]');
await page.fill('input[name=mikrogramm]', '75');
await page.click('[data-act="willkommen-weiter"]');
await page.click('[data-act="willkommen-weiter"]');
await page.waitForTimeout(200);
check(await offen(), 'nach „Fertig – zur App": das Begrüßungsfenster beim ersten „Heute"');
check(await fokusId() === 'begruessung-titel', '… mit dem Fokus auf der Überschrift');
s = await gespeichert();
check(s.profil.begruesst && s.profil.einfuehrung === 1, 'eingerichtet und angezeigt gemerkt');
await page.waitForTimeout(700);
await page.click('[data-act="begruessung-zu"]');
check(!(await fenster.count()) && (await ansichtText(page)).includes('Erika'), '„Später lesen" schließt, „Heute" ist da');
check((await page.locator('#meldung').innerText()).includes('„Mehr → Einführung"'), '… und die Meldung sagt, wo es wieder zu finden ist');
await uhr(TAG, '09:00');
check(!(await fenster.count()), 'nach dem Neuladen nicht noch einmal');

// Neues Handy, alte Sicherung (aus der App von PR #3): das erste „Heute" kommt aus der Datei.
await mitStand(null);
const datei = path.join(ABLAGE, 'sd-begruessung-alt.json');
writeFileSync(datei, JSON.stringify({ ...ALT_PR3, app: 'schilddruese', exportiertAm: '2026-11-01T10:00:00.000Z' }));
await page.setInputFiles('#sicherungDatei', datei);
await page.waitForTimeout(300);
check(await offen(), 'neues Handy, Sicherung der alten App eingelesen: das Fenster kommt beim ersten „Heute"');
s = await gespeichert();
check(s.profil.name === 'Mama' && s.labor.length === 1 && s.profil.einfuehrung === 1, '… mit den Daten aus der Sicherung');
await page.click('[data-act="begruessung-zu"]');

await ende();
