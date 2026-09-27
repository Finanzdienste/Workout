/*
 * Die Formulare: Dosis, Laborwert, Gewicht, Befinden, Termin, Frage, Vorrat,
 * Einnahme nachtragen, „Über mich & weitere Mittel" – und das Speichern des
 * Warnzeichen-Checks und des Geburtsjahrs von der Dosis-Karte.
 *
 * Ein Formular je Bildschirm, eine Frage je Zeile, das Datum mit heute
 * vorbelegt, „Speichern" groß unten. Fehler werden am Feld gezeigt, ohne
 * die Eingaben zu verwerfen (siehe zeigeFehler in js/app.js). Komma und
 * Punkt sind beide eine Zahl – zahlAus() in js/datum.js.
 *
 * Zwei Funktionen je Formular: formular() baut es, absenden() liest es aus,
 * prüft und speichert. Beide werden in js/app.js nur über den Namen
 * angesprochen; ein Name, den es hier nicht gibt, liefert null.
 */
import { heuteISO, tageWeiter, istISO, istUhr, zahlAus, datumInWorten, datumKurz, uhrText, jetztUhr } from './datum.js';
import { esc } from './text.js';
import * as sp from './speicher.js';
import * as ez from './einschaetzung.js';
import { befundPruefen } from './einheiten.js';
import { E14_TEXT, E16_TEXT } from './wissen.js';
import { wahlFrage, JNW_WAHL, BEFUND_FRAGEN, w1Karte } from './ansicht-einschaetzung.js';

const feldDatum = (name, wert, titel = 'Datum', hinweis = '') => `
  <label class="feld"><span>${titel}</span>
    <input type="date" name="${name}" value="${esc(wert)}" required>
    ${hinweis ? `<span class="hinweis">${hinweis}</span>` : ''}
  </label>`;

/**
 * Tabletten am Tag. Eine gespeicherte Menge, die nicht in der Liste steht
 * (aus einer Sicherung, etwa ¾), kommt als eigene, gewählte Möglichkeit dazu –
 * sonst wählte der Browser still die erste, und ein bloßes „Speichern" machte
 * aus ¾ eine ½ Tablette.
 */
export function tablettenWahl(aktuell) {
  const liste = [[0.5, '½ Tablette'], [1, '1 Tablette'], [1.5, '1½ Tabletten'], [2, '2 Tabletten']];
  if (!liste.some(([w]) => w === aktuell)) liste.push([aktuell, `${String(aktuell).replace('.', ',')} Tabletten`]);
  return `<label class="feld"><span>Tabletten am Tag</span>
    <select name="tabletten">
      ${liste.map(([w, t]) => `<option value="${w}" ${aktuell === w ? 'selected' : ''}>${t}</option>`).join('')}
    </select>
  </label>`;
}

/** Eine gespeicherte Zahl zurück ins Eingabefeld: 2.1 → „2,1", nichts → leer. */
const zahlFeld = (wert) => (wert === null || wert === undefined ? '' : String(wert).replace('.', ','));

const feldZahl = (name, wert, titel, { hinweis = '', platzhalter = '' } = {}) => `
  <label class="feld"><span>${titel}</span>
    <input type="text" inputmode="decimal" name="${name}" value="${esc(zahlFeld(wert))}" placeholder="${esc(platzhalter)}" autocomplete="off">
    ${hinweis ? `<span class="hinweis">${hinweis}</span>` : ''}
  </label>`;

const feldText = (name, wert, titel, { hinweis = '', platzhalter = '', lang = false } = {}) => `
  <label class="feld"><span>${titel}</span>
    ${lang
    ? `<textarea name="${name}" placeholder="${esc(platzhalter)}">${esc(wert || '')}</textarea>`
    : `<input type="text" name="${name}" value="${esc(wert || '')}" placeholder="${esc(platzhalter)}" autocomplete="off">`}
    ${hinweis ? `<span class="hinweis">${hinweis}</span>` : ''}
  </label>`;

const fuss = (art, id, { speichern = 'Speichern', loeschen = true } = {}) => `
  <div class="formular-fuss">
    <button type="submit" class="knopf knopf-haupt knopf-breit">${speichern}</button>
    <div class="knopf-reihe">
      <button type="button" class="knopf knopf-leise" data-act="zurueck">Abbrechen</button>
      ${id && loeschen ? `<button type="button" class="knopf knopf-gefahr" data-act="loeschen" data-art="${art}" data-id="${esc(id)}">Löschen</button>` : ''}
    </div>
  </div>`;

// ---------------------------------------------------------------- Dosis

/**
 * `id`: die Dosis zum Ändern – oder „praxis" für eine neue Dosis aus „Die
 * Praxis hat entschieden" (D6b), dann mit „auf Anweisung der Praxis: ja".
 */
function dosisFormular(id, stand, heute) {
  const ausPraxis = id === 'praxis';
  const dosisId = ausPraxis ? null : id;
  const da = dosisId ? stand.dosen.find((d) => d.id === dosisId) : null;
  const letzte = sp.aktuelleDosis();
  const d = da || { praeparat: letzte ? letzte.praeparat : 'L-Thyroxin', mikrogramm: null, tabletten: 1, ab: heute, notiz: '', praxis: ausPraxis ? true : null };
  // Die erste Dosis ist keine Änderung – bei ihr fragt die App nicht nach der Quelle.
  const mitQuelle = da ? stand.dosen.indexOf(da) >= 1 : stand.dosen.length >= 1;
  return {
    titel: da ? 'Dosis ändern' : 'Neue Dosis',
    html: `
      <form data-formular="dosis" ${dosisId ? `data-id="${esc(dosisId)}"` : ''} novalidate>
        ${!da && letzte ? `<div class="hinweis-karte"><span class="ri" aria-hidden="true">ℹ️</span><div>Die bisherige Dosis (${esc(sp.dosisText(letzte))}) bleibt im Verlauf stehen. Hier kommt die neue dazu, so wie die Ärztin sie verordnet hat.</div></div>` : ''}
        ${feldText('praeparat', d.praeparat, 'Präparat', { platzhalter: 'z. B. L-Thyroxin Henning', hinweis: 'So, wie es auf der Packung steht. Ein Herstellerwechsel ist auch eine Änderung.' })}
        ${feldZahl('mikrogramm', d.mikrogramm, 'Stärke in µg (Mikrogramm)', { platzhalter: 'z. B. 75', hinweis: 'Die Zahl auf der Packung, z. B. 50, 75 oder 100.' })}
        ${tablettenWahl(d.tabletten)}
        ${feldDatum('ab', d.ab, 'Gilt ab', 'Der Tag, ab dem diese Dosis genommen wird. Liegt er in der Zukunft, nennt „Heute" bis dahin weiter die bisherige Dosis.')}
        ${mitQuelle ? wahlFrage('praxis', d.praxis === true ? 'ja' : d.praxis === false ? 'nein' : '', 'Auf Anweisung der Praxis?', {
    optionen: [['ja', 'Ja'], ['nein', 'Nein']],
    hinweis: 'Steht im Bericht für den Arzttermin. Bei „Nein" erinnert die App daran, der Praxis Bescheid zu sagen.',
  }) : ''}
        ${feldText('notiz', d.notiz, 'Notiz (freiwillig)', { platzhalter: 'z. B. nach Laborkontrolle im März' })}
        <p class="klein gedaempft" style="margin-bottom:.6rem">${esc(E16_TEXT)}</p>
        ${fuss('dosis', dosisId)}
      </form>`,
  };
}

/**
 * Dieselbe Tablette in derselben Menge – kein Wechsel, nur ein zweiter
 * Eintrag (wie aenderungsArt 'doppelt' in js/dosis.js).
 */
function gleicheDosis(a, b) {
  const name = (x) => String(x.praeparat || '').trim().toLowerCase();
  return name(a) === name(b) && a.mikrogramm === b.mikrogramm && a.tabletten === b.tabletten;
}

function dosisAbsenden(id, f, heute) {
  const stand = sp.getStand();
  const fehler = {};
  const mikrogramm = zahlAus(f.get('mikrogramm'));
  if (mikrogramm === null || mikrogramm <= 0) fehler.mikrogramm = 'Bitte die Stärke in µg eintragen, z. B. 75.';
  else if (mikrogramm < 5 || mikrogramm > 400) fehler.mikrogramm = 'Bitte prüfen: Übliche Stärken liegen zwischen 12,5 und 300 µg. Steht eine andere Zahl auf der Packung, prüfen Sie die Einheit.';
  const da = id ? stand.dosen.find((d) => d.id === id) : null;
  const andere = stand.dosen.filter((d) => d !== da);
  const ab = f.get('ab');
  if (!istISO(ab)) fehler.ab = 'Bitte ein Datum wählen.';
  else if (ab > tageWeiter(heute, 365)) fehler.ab = 'Das Datum liegt weit in der Zukunft.';
  // Eine Dosis, die erst künftig beginnt, ohne eine, die heute gilt: Dann
  // zählte keine Einnahme, der Bericht sagte „Noch keine Einnahmen erfasst",
  // und die Dosis-Karte verlangte eine Dosis, die eingetragen ist (B54).
  // Ein künftiger Tag gilt nur für eine geplante Änderung.
  else if (ab > heute && !andere.some((d) => d.ab <= heute)) fehler.ab = 'Bitte tragen Sie den Tag ein, seit dem Sie diese Tablette nehmen – ungefähr genügt. Ein Tag in der Zukunft geht nur für eine geplante Änderung.';
  // Ab der zweiten Dosis zählt, ob die Praxis sie angeordnet hat (Bericht,
  // Hinweise B2 und X3). Offen gelassen hieß es bisher still „unbekannt" –
  // und „unbekannt" darf nicht als „nein" gelten (B23). Deshalb Pflicht.
  const mitQuelle = da ? stand.dosen.indexOf(da) >= 1 : stand.dosen.length >= 1;
  const quelle = f.get('praxis');
  if (mitQuelle && quelle !== 'ja' && quelle !== 'nein') fehler.praxis = 'Bitte „Ja" oder „Nein" wählen: Hat die Praxis diese Dosis angeordnet?';
  if (Object.keys(fehler).length) return { ok: false, fehler };
  const eintrag = {
    praeparat: String(f.get('praeparat') || '').trim().slice(0, 80),
    mikrogramm,
    tabletten: zahlAus(f.get('tabletten')) || 1,
    ab,
    notiz: String(f.get('notiz') || '').trim().slice(0, 300),
    praxis: quelle === 'ja' ? true : quelle === 'nein' ? false : null,
  };
  /*
   * Ein neuer Eintrag, der genau dem davor oder danach gleicht, ist keine
   * Änderung – sähe aber so aus: „Ihre Dosis wurde geändert", Kontrolle nach
   * 6–8 Wochen, bei TSH 0,08 gar „Kein besonderer Anlass" (B59, B32). Meist
   * stimmt nur der Beginn des vorhandenen Eintrags nicht (beim Einrichten
   * blieb „Seit wann?" auf heute). Dann dort „Gilt ab" ändern.
   */
  if (!da) {
    const vorher = [...andere].reverse().find((d) => d.ab <= ab);
    const danach = andere.find((d) => d.ab > ab);
    const gleich = vorher && gleicheDosis(vorher, eintrag) ? vorher : danach && gleicheDosis(danach, eintrag) ? danach : null;
    if (gleich) {
      const text = gleich === danach
        ? `Genau diese Dosis ist schon ab ${datumKurz(gleich.ab)} eingetragen. Nehmen Sie sie schon seit dem ${datumKurz(ab)}, ändern Sie beim vorhandenen Eintrag „Gilt ab" – ein zweiter gleicher Eintrag sähe aus wie eine Änderung der Dosis.`
        : `Genau diese Dosis ist schon seit dem ${datumKurz(gleich.ab)} eingetragen. Ein zweiter gleicher Eintrag sähe aus wie eine Änderung der Dosis. Stimmt der Tag nicht, ändern Sie „Gilt ab" beim vorhandenen Eintrag.`;
      return { ok: false, fehler: { ab: { text, knopf: { seite: 'dosis', param: gleich.id, text: 'Vorhandenen Eintrag ändern' } } } };
    }
  }
  sp.aendern((s) => {
    const alt = id ? s.dosen.find((d) => d.id === id) : null;
    // Steht auf der Dosis-Karte „Nein, ich nehme etwas anderes", ist dieser
    // Eintrag die Berichtigung – keine neue Anordnung. Das bleibt am Eintrag
    // stehen, auch wenn die Antwort gleich wegfällt; sonst hielte die Karte
    // ihn bei „Auf Anweisung der Praxis: Ja" für eine beschlossene Änderung
    // und meldete „Kein besonderer Anlass" (Nachprüfung zu B26).
    const berichtigung = s.nachfragen.some((n) => n.art === 'dosis_stimmt' && /^nein/.test(n.antwort));
    if (alt) Object.assign(alt, eintrag, berichtigung ? { berichtigung: true } : {});
    else s.dosen.push({ id: sp.kennung(), ...eintrag, berichtigung });
    s.dosen.sort((a, b) => a.ab.localeCompare(b.ab));
    // X3 (1) „Nein, ich nehme etwas anderes": Mit dem Eintrag ist die
    // Aufforderung erfüllt. Die Antwort fällt weg, und die Dosis-Karte fragt
    // mit der eingetragenen Dosis neu. Ein Datumsvergleich genügt nicht –
    // der berichtigte Eintrag beginnt oft vor der Antwort, und alte Antworten
    // „nein" nennen keine Menge (B26, B63).
    s.nachfragen = s.nachfragen.filter((n) => !(n.art === 'dosis_stimmt' && /^nein/.test(n.antwort)));
  });
  return { ok: true, meldung: 'Dosis gespeichert' };
}

// ---------------------------------------------------------------- Labor

/** Ein Wert vom Befund: „2,1", „2.1" oder „< 0,01" (dann mit `unter`). */
function wertAus(roh) {
  const t = String(roh || '').trim();
  const unter = /^[<＜]/.test(t);
  return { wert: zahlAus(unter ? t.replace(/^[<＜]\s*/, '') : t), unter };
}

/*
 * Eine Grenze des Bereichs, so wie sie auf dem Befund steht: „0,27",
 * „< 4,2", „bis 4,2", „4,2 mU/l", „> 20" – oder beide in einem Feld,
 * „0,27 – 4,20". Vorher lief das Feld nur durch zahlAus, und was es nicht
 * lesen konnte, wurde still zu „keine Grenze": Aus „< 4,2" wurde ein
 * einseitiger Bereich, und TSH 8 galt als „im Bereich" (B51).
 *
 * → { leer } | { von } | { bis } | { zahl } (Richtung aus dem Feld) |
 *   { von, bis } | { fehler }. Eine Grenze ist nie negativ – ein Strich
 * davor heißt „bis", einer dahinter „ab" (wie auf manchen Befunden „– 4,2").
 */
const ZAHL_RE = '(\\d+(?:[.,]\\d+)?|[.,]\\d+)';
function grenzeLesen(roh) {
  let t = String(roh ?? '').trim().replace(/[–—−]/g, '-').replace(/\s+/g, ' ');
  if (!t) return { leer: true };
  // Eine angehängte Einheit („4,2 mU/l", „5,7 %") fällt weg – die Einheit steht im Menü darüber.
  t = t.replace(/\s*[A-Za-zµμ%][A-Za-zµμ%/.\d]*$/u, '').trim();
  let m = new RegExp(`^${ZAHL_RE} ?(?:-|bis) ?${ZAHL_RE}$`, 'i').exec(t);
  if (m) return { von: zahlAus(m[1]), bis: zahlAus(m[2]) };
  m = new RegExp(`^(?:<=?|≤|＜|-|bis|unter) ?${ZAHL_RE}$`, 'i').exec(t);
  if (m) return { bis: zahlAus(m[1]) };
  m = new RegExp(`^(?:>=?|≥|＞|ab|über|ueber) ?${ZAHL_RE}$`, 'i').exec(t) || new RegExp(`^${ZAHL_RE} ?-$`).exec(t);
  if (m) return { von: zahlAus(m[1]) };
  m = new RegExp(`^${ZAHL_RE}$`).exec(t);
  if (m) return { zahl: zahlAus(m[1]) };
  return { fehler: true };
}

/**
 * Beide Felder zusammen: { von, bis, fehler: { feld: text } }. Was in „von"
 * als „< 4,2" steht, ist die obere Grenze – so, wie es gemeint ist. Stehen
 * für dieselbe Grenze zwei verschiedene Zahlen da, fragt das Feld nach.
 */
function bereichAus(key, name, vonRoh, bisRoh) {
  const a = grenzeLesen(vonRoh);
  const b = grenzeLesen(bisRoh);
  const fehler = {};
  const beispiel = key === 'tsh' ? 'z. B. 0,27 und 4,20' : 'z. B. 12 und 22';
  if (a.fehler) fehler[`${key}_von`] = `${name}: Bitte nur die Zahl vom Befund eintragen, ${beispiel}.`;
  if (b.fehler) fehler[`${key}_bis`] = `${name}: Bitte nur die Zahl vom Befund eintragen, ${beispiel}.`;
  const von = [a.von ?? a.zahl, b.von].filter((x) => x !== undefined && x !== null);
  const bis = [a.bis, b.bis ?? b.zahl].filter((x) => x !== undefined && x !== null);
  if (new Set(von).size > 1 || new Set(bis).size > 1) fehler[`${key}_von`] = `${name}: Bitte prüfen – für den Bereich stehen zwei verschiedene Angaben da.`;
  return { von: von.length ? von[0] : null, bis: bis.length ? bis[0] : null, fehler };
}

/*
 * Ein Befund je Abnahmetag. Wird ein nachgereichter Wert (etwa fT4) als
 * eigener Befund am selben Tag eingetragen, rechnete die Einschätzung nur mit
 * einem der beiden – TSH 7 und fT4 5 ergaben dann nicht Muster b mit „in den
 * nächsten Tagen" und dem 112-Satz (B52). Jetzt kommt der neue Eintrag zum
 * vorhandenen dazu: leere Werte und offene Fragen werden gefüllt. Sagen beide
 * bei derselben Angabe Verschiedenes, wird nichts still überschrieben.
 *
 * → { zusammen, widerspruch: [Namen] }
 */
const FRAGEN_FELDER = ['vorAbnahme', 'biotin', 'krank', 'kortison', 'kontrastmittel', 'mittelGeaendert', 'einnahmeGeaendert', 'packung', 'abstandOk', 'vergessen', 'einnahmeArt', 'praxis'];
function befundeZusammen(alt, neu) {
  const zusammen = {};
  const widerspruch = [];
  [...sp.LABORWERTE, ...sp.WEITERE_WERTE].forEach(([key, name]) => {
    const a = alt[key];
    const n = neu[key];
    if (!n || !a) { zusammen[key] = a || n || null; return; }
    const gleich = a.wert === n.wert && a.einheit === n.einheit && a.unter === n.unter
      && (a.von === null || n.von === null || a.von === n.von) && (a.bis === null || n.bis === null || a.bis === n.bis);
    if (!gleich) { widerspruch.push(name.replace(/ \(.*\)$/, '')); zusammen[key] = a; return; }
    zusammen[key] = { ...a, von: a.von ?? n.von, bis: a.bis ?? n.bis };
  });
  FRAGEN_FELDER.forEach((k) => {
    if (neu[k] && alt[k] && neu[k] !== alt[k]) {
      const frage = BEFUND_FRAGEN.find((q) => q.feld === k);
      widerspruch.push(frage ? frage.kurz : k);
    }
    zusammen[k] = alt[k] || neu[k] || '';
  });
  zusammen.praxisAm = alt.praxis ? alt.praxisAm : neu.praxisAm;
  ['abnahmeUhr', 'tabletteUhr', 'laborName'].forEach((k) => {
    if (neu[k] && alt[k] && neu[k] !== alt[k]) widerspruch.push({ abnahmeUhr: 'Uhrzeit der Abnahme', tabletteUhr: 'Uhrzeit der Tablette', laborName: 'Name des Labors' }[k]);
    zusammen[k] = alt[k] || neu[k] || '';
  });
  zusammen.notiz = [alt.notiz, neu.notiz].filter(Boolean).filter((x, i, l) => l.indexOf(x) === i).join(' · ').slice(0, 300);
  zusammen.verwechselt = alt.verwechselt || '';
  zusammen.datum = alt.datum;
  return { zusammen, widerspruch };
}

const WERT_PLATZ = { tsh: 'z. B. 2,1', ft4: 'z. B. 15,2', ft3: 'z. B. 4,8' };

function laborFormular(id, stand, heute) {
  const da = id ? stand.labor.find((l) => l.id === id) : null;
  const letzter = stand.labor.length ? stand.labor[stand.labor.length - 1] : null;
  const l = da || { datum: heute, notiz: '', abnahmeUhr: '', tabletteUhr: '', laborName: '' };
  const hatAbstand = stand.mittel.some((k) => ez.ABSTAND_MITTEL[k]);
  const karte = ([key, name, einheiten]) => {
    const w = l[key];
    // Die Einheit vom letzten Mal vorbelegen (sichtbar, zum Bestätigen), sonst
    // die erste der Liste. Den Bereich aber nicht: Kommt der Befund von einem
    // anderen Labor, stünde sonst still der alte Bereich darunter. Der alte
    // Bereich steht nur als Platzhalter da.
    const vorher = (letzter && letzter[key]) || null;
    const einheit = w ? w.einheit : vorher ? vorher.einheit : einheiten[0];
    const platzVon = vorher && vorher.von !== null ? `z. B. ${zahlFeld(vorher.von)}` : 'von';
    const platzBis = vorher && vorher.bis !== null ? `z. B. ${zahlFeld(vorher.bis)}` : 'bis';
    const wertText = w ? `${w.unter ? '< ' : ''}${zahlFeld(w.wert)}` : '';
    return `
      <div class="karte" data-feld="${key}">
        <div class="laborwert-kopf"><span class="laborwert-name">${esc(name)}</span>
          <select name="${key}_einheit" aria-label="Einheit ${esc(name)}" style="width:auto;min-height:2.4rem">
            ${[...new Set([...einheiten, einheit].filter(Boolean))].map((e) => `<option value="${esc(e)}" ${e === einheit ? 'selected' : ''}>${esc(e)}</option>`).join('')}
          </select>
        </div>
        ${key === 'ft4' ? '<p class="klein gedaempft" style="margin:.3rem 0 .5rem">Bitte nur das freie T4 eintragen (fT4, FT4). „T4" oder „Gesamt-T4" ist ein anderer Wert und wird von der App nicht eingeordnet.</p>' : ''}
        <label class="feld"><span>Wert</span>
          <input type="text" inputmode="decimal" name="${key}_wert" value="${esc(wertText)}" placeholder="${esc(WERT_PLATZ[key] || 'vom Befund')}" autocomplete="off">
          ${key === 'tsh' ? '<span class="hinweis">Steht auf dem Befund „&lt; 0,01", tragen Sie genau das ein.</span>' : ''}
        </label>
        <div class="feld" data-feld="${key}_von"><span>Bereich laut Befund</span>
          <div class="bereich-reihe">
            <input type="text" inputmode="decimal" name="${key}_von" value="${esc(zahlFeld(w ? w.von : null))}" placeholder="${esc(platzVon)}" aria-label="${esc(name)}: Bereich von" autocomplete="off">
            <span aria-hidden="true">–</span>
            <input type="text" inputmode="decimal" name="${key}_bis" value="${esc(zahlFeld(w ? w.bis : null))}" placeholder="${esc(platzBis)}" aria-label="${esc(name)}: Bereich bis" autocomplete="off">
          </div>
          ${key === 'tsh' ? '<span class="hinweis">Bitte übertragen Sie den Bereich genau vom Befund, bei TSH beide Grenzen (z. B. 0,27–4,20). Steht nur eine Grenze da (z. B. „&lt; 116"), tragen Sie nur diese ein.</span>' : ''}
        </div>
      </div>`;
  };
  const werte = sp.LABORWERTE.map(karte).join('');
  const weitereDa = sp.WEITERE_WERTE.some(([k]) => l[k]);
  const namen = sp.WEITERE_WERTE.map(([, n]) => n.replace(/ \(.*\)$/, '')).join(', ');
  const weitere = `
    <details class="weitere" ${weitereDa ? 'open' : ''}>
      <summary>Weitere Werte (freiwillig): ${esc(namen)}</summary>
      <p class="klein gedaempft" style="margin:.4rem 0 .6rem">Stehen sie auf demselben Befund, gleich mit abschreiben – sie kommen dann mit in den Bericht. Steht nur eine Grenze da, nur diese eintragen.</p>
      ${sp.WEITERE_WERTE.map(karte).join('')}
    </details>`;
  const fragen = BEFUND_FRAGEN.filter((q) => !q.nurMitAbstand || hatAbstand).map((q) => wahlFrage(q.feld, l[q.feld] || '', q.frage, {
    optionen: q.optionen || JNW_WAHL,
    extra: q.feld === 'vorAbnahme'
      ? `<label class="feld feld-unter"><span>Wenn ja: um wie viel Uhr?</span><input type="time" name="tabletteUhr" value="${esc(l.tabletteUhr || '')}"></label>` : '',
  })).join('');
  return {
    titel: da ? 'Laborwert ändern' : 'Laborwerte eintragen',
    html: `
      <form data-formular="labor" ${id ? `data-id="${esc(id)}"` : ''} novalidate>
        <div data-feld="oben"></div>
        <div class="hinweis-karte"><span class="ri" aria-hidden="true">ℹ️</span><div>Vom Befund abschreiben, so wie es dort steht – auch die Einheit und den Bereich des Labors, denn jedes Labor hat eigene Grenzen. Nicht jeder Wert ist jedes Mal dabei; leere Felder sind in Ordnung.</div></div>
        ${feldDatum('datum', l.datum, 'Datum der Blutabnahme')}
        <label class="feld"><span>Uhrzeit der Blutabnahme (freiwillig)</span>
          <input type="time" name="abnahmeUhr" value="${esc(l.abnahmeUhr || '')}">
          <span class="hinweis">TSH ist morgens meist etwas höher als nachmittags.</span>
        </label>
        ${werte}
        ${feldText('laborName', l.laborName, 'Name des Labors (freiwillig)', { platzhalter: letzter && letzter.laborName ? `z. B. ${letzter.laborName}` : 'steht oben auf dem Befund', hinweis: 'Bei einem anderen Labor vergleicht die App die Werte nur eingeschränkt.' })}
        ${weitere}
        <fieldset class="fragen-block">
          <legend>Fragen zur Blutabnahme</legend>
          <p class="hinweis" style="margin-bottom:.8rem">Alle freiwillig. Die Antworten helfen, den Wert richtig zu lesen: Eine Tablette vor der Abnahme hebt fT4, Biotin verfälscht die Messung, eine schwere Krankheit oder Kortison verschieben die Werte für Wochen. Was offen bleibt, fragt die Dosis-Karte später.</p>
          ${fragen}
        </fieldset>
        ${feldText('notiz', l.notiz, 'Notiz (freiwillig)', { platzhalter: 'z. B. anderes Labor als sonst', lang: true })}
        ${fuss('labor', id)}
      </form>`,
  };
}

const JNW_WERTE = ['ja', 'nein', 'unbekannt'];
const auswahl = (v, erlaubt) => (erlaubt.includes(v) ? v : '');

function laborAbsenden(id, f, heute) {
  const stand = sp.getStand();
  const fehler = {};
  const datum = f.get('datum');
  if (!istISO(datum)) fehler.datum = 'Bitte ein Datum wählen.';
  else if (datum > heute) fehler.datum = 'Das Datum liegt in der Zukunft.';
  const da = id ? stand.labor.find((l) => l.id === id) : null;
  const uhr = (name) => (istUhr(String(f.get(name) || '')) ? f.get(name) : '');
  const praxis = auswahl(f.get('praxis'), ['bleibt', 'geaendert', 'nachmessen', 'nochnicht']);
  const eintrag = {
    datum,
    notiz: String(f.get('notiz') || '').trim().slice(0, 300),
    abnahmeUhr: uhr('abnahmeUhr'),
    tabletteUhr: f.get('vorAbnahme') === 'ja' ? uhr('tabletteUhr') : '',
    laborName: String(f.get('laborName') || '').trim().slice(0, 60),
    vergessen: auswahl(f.get('vergessen'), ['nein', 'einzelne', 'mehrere', 'unbekannt']),
    einnahmeArt: auswahl(f.get('einnahmeArt'), ['ja', 'abends', 'nein', 'unbekannt']),
    praxis,
    // Das Datum der Praxis-Angabe: neu gesetzt, wenn sie sich ändert.
    praxisAm: praxis ? (da && da.praxis === praxis && da.praxisAm ? da.praxisAm : heute) : null,
    // Q5 steht nicht im Formular, sondern auf der Dosis-Karte – das Feld muss
    // trotzdem von Anfang an da sein. Vorher legte es erst normStand beim
    // nächsten Laden an, und bis dahin ließ sich Q5 nicht beantworten (B39).
    verwechselt: da && typeof da.verwechselt === 'string' ? da.verwechselt : '',
  };
  ['vorAbnahme', 'biotin', 'krank', 'kortison', 'kontrastmittel', 'mittelGeaendert', 'einnahmeGeaendert', 'packung', 'abstandOk']
    .forEach((k) => { eintrag[k] = auswahl(f.get(k), JNW_WERTE); });
  // Eine Frage, die das Formular nicht gezeigt hat (Abstand ohne Mittel), bleibt, wie sie war.
  if (!f.has('abstandOk') && da) eintrag.abstandOk = da.abstandOk;

  let einer = false;
  [...sp.LABORWERTE, ...sp.WEITERE_WERTE].forEach(([key, name]) => {
    const rohWert = String(f.get(`${key}_wert`) || '').trim();
    const { wert, unter } = wertAus(rohWert);
    const bereich = bereichAus(key, name.replace(/ \(.*\)$/, ''), f.get(`${key}_von`), f.get(`${key}_bis`));
    const { von, bis } = bereich;
    if (rohWert && wert === null) fehler[`${key}_wert`] = `${name}: Bitte eine Zahl eintragen, z. B. 2,1.`;
    if (wert === null) { eintrag[key] = null; return; }
    if (wert < 0) fehler[`${key}_wert`] = `${name}: Der Wert kann nicht negativ sein.`;
    Object.assign(fehler, bereich.fehler);
    // Ein Bereich darf einseitig sein („< 116") – so, wie er auf dem Befund steht.
    if (von !== null && bis !== null && von >= bis) fehler[`${key}_von`] = `${name}: „von" muss kleiner sein als „bis".`;
    einer = true;
    eintrag[key] = { wert, einheit: String(f.get(`${key}_einheit`) || '').slice(0, 20), von, bis, unter };
  });
  if (!einer && !Object.keys(fehler).length) fehler.tsh_wert = 'Bitte mindestens einen Wert eintragen.';
  if (Object.keys(fehler).length) return { ok: false, fehler };

  // Ein Befund je Abnahmetag (B52): Ein neuer Eintrag kommt zum vorhandenen
  // dazu. Wird ein vorhandener Befund auf einen belegten Tag verlegt, nicht –
  // dann hilft nur, den anderen zu öffnen. Bleibt sein Tag, wie er war, lässt
  // er sich ändern wie bisher (auch wenn ein älterer Stand zwei an einem Tag hat).
  const amTag = stand.labor.find((l) => l.datum === datum && l.id !== id && (!da || da.datum !== datum)) || null;
  let ziel = eintrag;
  if (amTag) {
    const oeffnen = { seite: 'labor', param: amTag.id, text: `Befund vom ${datumKurz(datum)} öffnen` };
    if (id) return { ok: false, fehler: { datum: { text: `Für den ${datumKurz(datum)} gibt es schon einen Befund. Tragen Sie die Werte bitte dort ein – oder wählen Sie ein anderes Datum.`, knopf: oeffnen } } };
    const { zusammen, widerspruch } = befundeZusammen(amTag, eintrag);
    if (widerspruch.length) {
      return { ok: false, fehler: { datum: { text: `Für den ${datumKurz(datum)} gibt es schon einen Befund, und er sagt bei ${widerspruch.join(', ')} etwas anderes. Bitte prüfen Sie den vorhandenen Befund und ändern Sie ihn dort.`, knopf: oeffnen } } };
    }
    ziel = zusammen;
  }
  const bezug = amTag || da;

  // Plausibilität (js/einheiten.js): Fehler verhindern das Speichern,
  // Rückfragen brauchen ein ausdrückliches „Ja, stimmt". Beim Zusammenführen
  // fragt die App nicht noch einmal, was beim vorhandenen Befund schon bestätigt war.
  const pruefung = befundPruefen({ id: bezug ? bezug.id : '', ...ziel }, stand, heute);
  if (pruefung.fehler.length) return { ok: false, fehler: { oben: pruefung.fehler.join(' ') } };
  const schonBestaetigt = amTag && amTag.bestaetigt ? befundPruefen(amTag, stand, heute).rueckfragen : [];
  const kernFragen = pruefung.rueckfragen.filter((r) => !schonBestaetigt.includes(r));
  const rueckfragen = [...kernFragen];
  // RW2 L3: TSH braucht beide Grenzen. Steht nur eine da, nachfragen – meist
  // ist die zweite beim Abschreiben weggefallen. Nur hier in der Oberfläche:
  // Als Rückfrage im Kern (befundPruefen) machte sie den Befund „unplausibel",
  // und die Dosis-Karte sperrte zusätzlich mit D0.3. Schon so gespeichert und
  // unverändert: nicht noch einmal.
  const t = ziel.tsh;
  const tshAlt = bezug && bezug.tsh;
  if (t && (t.von === null) !== (t.bis === null) && !(tshAlt && tshAlt.von === t.von && tshAlt.bis === t.bis)) {
    rueckfragen.push('TSH: Es ist nur eine Grenze des Bereichs eingetragen. Auf den meisten Befunden stehen beide (z. B. 0,27–4,20) – dann tragen Sie bitte beide ein, sonst kann die App TSH nur eingeschränkt einordnen.');
  }
  const bestaetigt = f.get('bestaetigt') === 'ja';
  if (rueckfragen.length && !bestaetigt) return { ok: false, rueckfragen };
  // „bestätigt" meint die Rückfragen des Kerns (plausibel()), nicht die nach der zweiten Grenze.
  ziel.bestaetigt = Boolean(amTag && amTag.bestaetigt) || kernFragen.length > 0;

  sp.aendern((s) => {
    const alt = bezug ? s.labor.find((l) => l.id === bezug.id) : null;
    if (alt) Object.assign(alt, ziel);
    else s.labor.push({ id: sp.kennung(), ...ziel });
    s.labor.sort((a, b) => a.datum.localeCompare(b.datum));
  });
  return { ok: true, meldung: amTag ? `Zum Befund vom ${datumKurz(datum)} hinzugefügt` : 'Laborwerte gespeichert', danach: { name: 'labor-liste' } };
}

// ---------------------------------------------------------------- Gewicht

function gewichtFormular(id, stand, heute) {
  const da = id ? stand.gewicht.find((g) => g.id === id) : null;
  const g = da || { datum: heute, kg: null };
  return {
    titel: da ? 'Gewicht ändern' : 'Gewicht eintragen',
    html: `
      <form data-formular="gewicht" ${id ? `data-id="${esc(id)}"` : ''} novalidate>
        ${feldDatum('datum', g.datum)}
        ${feldZahl('kg', g.kg, 'Gewicht in kg', { platzhalter: 'z. B. 68,5', hinweis: 'Einmal die Woche reicht – möglichst morgens, gleiche Waage.' })}
        ${fuss('gewicht', id)}
      </form>`,
  };
}

function gewichtAbsenden(id, f, heute) {
  const fehler = {};
  const datum = f.get('datum');
  const kg = zahlAus(f.get('kg'));
  if (!istISO(datum)) fehler.datum = 'Bitte ein Datum wählen.';
  else if (datum > heute) fehler.datum = 'Das Datum liegt in der Zukunft.';
  if (kg === null || kg <= 0) fehler.kg = 'Bitte das Gewicht eintragen, z. B. 68,5.';
  else if (kg < 25 || kg > 300) fehler.kg = 'Bitte prüfen – ist das Gewicht in Kilogramm?';
  if (Object.keys(fehler).length) return { ok: false, fehler };
  sp.aendern((s) => {
    const da = id ? s.gewicht.find((g) => g.id === id) : s.gewicht.find((g) => g.datum === datum);
    // Ein Eintrag je Tag: Wird ein Eintrag auf einen Tag verlegt, für den es
    // schon einen gibt, ersetzt er ihn.
    s.gewicht = s.gewicht.filter((g) => g === da || g.datum !== datum);
    if (da) Object.assign(da, { datum, kg });
    else s.gewicht.push({ id: sp.kennung(), datum, kg });
    s.gewicht.sort((a, b) => a.datum.localeCompare(b.datum));
  });
  return { ok: true, meldung: 'Gewicht gespeichert' };
}

// ---------------------------------------------------------------- Befinden

/*
 * Oben eine feste Notfallzeile (R2): Wer beim Ausfüllen Brustschmerz hat,
 * findet in der Beschwerdeliste nichts Passendes und schreibt es vielleicht
 * in die Notiz. Der Knopf „JETZT" zeigt sofort den 112-Text, ohne dass etwas
 * gespeichert werden muss – und nach dem Speichern prüft die App die Notiz
 * auf Notfallwörter.
 */
function befindenFormular(id, stand, heute) {
  const da = id ? stand.befinden.find((b) => b.id === id) : stand.befinden.find((b) => b.datum === heute);
  const b = da || { datum: heute, stufe: 'mittel', beschwerden: [], notiz: '' };
  return {
    titel: 'Befinden',
    html: `
      <div class="notfall-zeile">
        <p><strong>Akut schlecht?</strong> Bei Brustschmerz, starker Atemnot, Ohnmacht oder plötzlicher Verwirrtheit: sofort 112.</p>
        <div class="knopf-reihe">
          <a class="knopf knopf-notruf" href="tel:112"><span aria-hidden="true">📞</span> 112 anrufen</a>
          <button type="button" class="knopf knopf-gefahr" data-act="notfall-jetzt">Brustschmerz, starke Atemnot oder plötzliche Verwirrtheit – JETZT</button>
        </div>
      </div>
      <div id="notfall-jetzt-huelle" hidden>${w1Karte(stand, { id: 'notfall-jetzt' })}</div>
      <form data-formular="befinden" ${da ? `data-id="${esc(da.id)}"` : ''} novalidate>
        ${feldDatum('datum', b.datum)}
        <div class="feld" data-feld="stufe"><span id="frage-stufe">Wie geht es Ihnen?</span>
          <div class="wahl" role="radiogroup" aria-labelledby="frage-stufe">
            ${[['gut', 'Gut'], ['mittel', 'Mittel'], ['schlecht', 'Schlecht']].map(([w, t]) => `
              <label class="knopf" style="cursor:pointer"><input type="radio" name="stufe" value="${w}" ${b.stufe === w ? 'checked' : ''} class="sr-only">${t}</label>`).join('')}
          </div>
        </div>
        <div class="feld"><span id="frage-beschwerden">Was macht sich bemerkbar?</span>
          <div class="haken-liste" role="group" aria-labelledby="frage-beschwerden">
            ${sp.BESCHWERDEN.map(([k, t]) => `<label class="haken"><input type="checkbox" name="beschwerden" value="${k}" ${b.beschwerden.includes(k) ? 'checked' : ''}>${esc(t)}</label>`).join('')}
          </div>
          <span class="hinweis">Alles freiwillig. Solche Beschwerden haben oft andere Gründe – deshalb gehört das ins Gespräch mit der Ärztin, nicht in eine eigene Dosisänderung.</span>
        </div>
        ${feldText('notiz', b.notiz, 'Notiz (freiwillig)', { lang: true, platzhalter: 'z. B. seit drei Tagen abends sehr müde' })}
        ${fuss('befinden', da ? da.id : null)}
      </form>`,
  };
}

/*
 * Beschwerden, nach denen die App sofort etwas sagt – oder eine
 * Notfall-Notiz. „Ungewollt abgenommen" gehört dazu (W2t: in den nächsten
 * Tagen anrufen) – ungewollter Gewichtsverlust ist im Alter ein Warnzeichen.
 */
const SOFORT = ['lebensmuede', 'puls', 'herz', 'abnahme'];

function befindenAbsenden(id, f, heute) {
  const fehler = {};
  const datum = f.get('datum');
  if (!istISO(datum)) fehler.datum = 'Bitte ein Datum wählen.';
  else if (datum > heute) fehler.datum = 'Das Datum liegt in der Zukunft.';
  const stufe = ['gut', 'mittel', 'schlecht'].includes(f.get('stufe')) ? f.get('stufe') : null;
  if (!stufe) fehler.stufe = 'Bitte Gut, Mittel oder Schlecht wählen.';
  if (Object.keys(fehler).length) return { ok: false, fehler };
  const beschwerden = f.getAll('beschwerden').filter((k) => sp.BESCHWERDEN.some(([x]) => x === k));
  const notiz = String(f.get('notiz') || '').trim().slice(0, 500);
  let gespeichert = null;
  sp.aendern((s) => {
    const da = id ? s.befinden.find((b) => b.id === id) : s.befinden.find((b) => b.datum === datum);
    s.befinden = s.befinden.filter((b) => b === da || b.datum !== datum);
    if (da) { Object.assign(da, { datum, stufe, beschwerden, notiz }); gespeichert = da.id; } else {
      gespeichert = sp.kennung();
      s.befinden.push({ id: gespeichert, datum, stufe, beschwerden, notiz });
    }
    s.befinden.sort((a, b) => a.datum.localeCompare(b.datum));
  });
  const sofort = ez.notfallWorte(notiz) || beschwerden.some((k) => SOFORT.includes(k));
  return { ok: true, meldung: 'Befinden gespeichert', danach: sofort ? { name: 'befinden-hinweis', param: gespeichert } : null };
}

// ---------------------------------------------------------------- Termin

function terminFormular(id, stand, heute) {
  const da = id ? stand.termine.find((t) => t.id === id) : null;
  const t = da || { datum: '', uhr: '', art: 'arzt', wo: '', blutabnahme: false, notiz: '' };
  return {
    titel: da ? 'Termin ändern' : 'Neuer Termin',
    html: `
      <form data-formular="termin" ${id ? `data-id="${esc(id)}"` : ''} novalidate>
        <label class="feld"><span>Was für ein Termin?</span>
          <select name="art">
            <option value="arzt" ${t.art === 'arzt' ? 'selected' : ''}>Arzttermin</option>
            <option value="labor" ${t.art === 'labor' ? 'selected' : ''}>Blutabnahme</option>
            <option value="sonst" ${t.art === 'sonst' ? 'selected' : ''}>Sonstiges</option>
          </select>
        </label>
        ${feldDatum('datum', t.datum || heute)}
        <label class="feld"><span>Uhrzeit (freiwillig)</span><input type="time" name="uhr" value="${esc(t.uhr)}"></label>
        ${feldText('wo', t.wo, 'Wo / bei wem (freiwillig)', { platzhalter: 'z. B. Praxis Dr. Meier' })}
        <label class="haken" style="margin-bottom:.9rem"><input type="checkbox" name="blutabnahme" ${t.blutabnahme ? 'checked' : ''}>Es wird Blut abgenommen</label>
        <div class="hinweis-karte"><span class="ri" aria-hidden="true">ℹ️</span><div>Bei einer Blutabnahme wird die Tablette meist erst danach genommen, weil fT4 in den Stunden nach der Einnahme vorübergehend ansteigt. Wie die Praxis es haben möchte, am besten einmal fragen und hier notieren.</div></div>
        ${feldText('notiz', t.notiz, 'Notiz (freiwillig)', { lang: true, platzhalter: 'z. B. nüchtern kommen, Befunde mitbringen' })}
        ${fuss('termin', id)}
      </form>`,
  };
}

function terminAbsenden(id, f) {
  const fehler = {};
  const datum = f.get('datum');
  if (!istISO(datum)) fehler.datum = 'Bitte ein Datum wählen.';
  const uhr = String(f.get('uhr') || '');
  if (uhr && !istUhr(uhr)) fehler.uhr = 'Bitte eine Uhrzeit wie 9:30 wählen.';
  if (Object.keys(fehler).length) return { ok: false, fehler };
  const eintrag = {
    datum,
    uhr,
    art: ['arzt', 'labor', 'sonst'].includes(f.get('art')) ? f.get('art') : 'arzt',
    wo: String(f.get('wo') || '').trim().slice(0, 80),
    blutabnahme: f.get('blutabnahme') === 'on',
    notiz: String(f.get('notiz') || '').trim().slice(0, 300),
  };
  sp.aendern((s) => {
    const da = id ? s.termine.find((t) => t.id === id) : null;
    if (da) Object.assign(da, eintrag);
    else s.termine.push({ id: sp.kennung(), ...eintrag });
    s.termine.sort((a, b) => `${a.datum}${a.uhr}`.localeCompare(`${b.datum}${b.uhr}`));
  });
  return { ok: true, meldung: 'Termin gespeichert', danach: { name: 'termine' } };
}

// ---------------------------------------------------------------- Frage

function frageFormular(id, stand) {
  const da = id ? stand.fragen.find((x) => x.id === id) : null;
  return {
    titel: da ? 'Frage ändern' : 'Frage für den Arzttermin',
    html: `
      <form data-formular="frage" ${id ? `data-id="${esc(id)}"` : ''} novalidate>
        ${feldText('text', da ? da.text : '', 'Was möchten Sie fragen?', { lang: true, platzhalter: 'z. B. Kann die Müdigkeit am Nachmittag an der Dosis liegen?' })}
        ${fuss('frage', id)}
      </form>`,
  };
}

function frageAbsenden(id, f) {
  const text = String(f.get('text') || '').trim().slice(0, 300);
  if (!text) return { ok: false, fehler: { text: 'Bitte die Frage eintragen.' } };
  sp.aendern((s) => {
    const da = id ? s.fragen.find((x) => x.id === id) : null;
    if (da) da.text = text;
    else s.fragen.push({ id: sp.kennung(), text, erledigt: false });
  });
  return { ok: true, meldung: 'Frage gespeichert', danach: { name: 'fragen' } };
}

// ---------------------------------------------------------------- Vorrat

function vorratFormular(id, stand, heute) {
  const v = stand.vorrat || { tabletten: null, stand: heute };
  const reicht = sp.vorratReicht(heute);
  return {
    titel: 'Tablettenvorrat',
    html: `
      <form data-formular="vorrat" novalidate>
        <p class="gedaempft" style="margin-bottom:.9rem">Wie viele Tabletten sind heute noch da? Die App zählt ab hier täglich herunter und meldet sich zwei Wochen vor dem Ende.${reicht !== null ? ` Aktuell: reicht noch etwa ${Math.max(0, reicht)} Tage.` : ''}</p>
        ${feldZahl('tabletten', v.tabletten, 'Tabletten im Vorrat', { platzhalter: 'z. B. 100' })}
        ${feldDatum('stand', v.stand, 'Gezählt am')}
        <div class="formular-fuss">
          <button type="submit" class="knopf knopf-haupt knopf-breit">Speichern</button>
          <div class="knopf-reihe">
            <button type="button" class="knopf knopf-leise" data-act="zurueck">Abbrechen</button>
            ${stand.vorrat ? '<button type="button" class="knopf knopf-gefahr" data-act="loeschen" data-art="vorrat" data-id="vorrat">Vorrat nicht mehr zählen</button>' : ''}
          </div>
        </div>
      </form>`,
  };
}

function vorratAbsenden(id, f, heute) {
  const fehler = {};
  const tabletten = zahlAus(f.get('tabletten'));
  const stand = f.get('stand');
  if (tabletten === null || tabletten < 0) fehler.tabletten = 'Bitte die Anzahl eintragen, z. B. 100.';
  if (!istISO(stand)) fehler.stand = 'Bitte ein Datum wählen.';
  else if (stand > heute) fehler.stand = 'Das Datum liegt in der Zukunft.';
  if (Object.keys(fehler).length) return { ok: false, fehler };
  // Auf halbe Tabletten genau – bei ½ oder 1½ am Tag bleiben halbe übrig.
  sp.aendern((s) => { s.vorrat = { tabletten: Math.round(tabletten * 2) / 2, stand }; });
  return { ok: true, meldung: 'Vorrat gespeichert' };
}

// ---------------------------------------------------------------- Einnahme nachtragen

function einnahmeFormular(id, stand, heute) {
  const tag = id && istISO(id) ? id : tageWeiter(heute, -1);
  const e = stand.einnahmen[tag];
  const status = e ? 'genommen' : e === null ? 'nicht' : 'unbekannt';
  return {
    titel: 'Einnahme nachtragen',
    html: `
      <form data-formular="einnahme" novalidate>
        ${feldDatum('datum', tag, 'Welcher Tag?')}
        <div class="feld" data-feld="status"><span id="frage-status">Was war an dem Tag?</span>
          <div class="zeilen" role="radiogroup" aria-labelledby="frage-status">
            ${[['genommen', 'Tablette genommen'], ['nicht', 'Nicht genommen'], ['unbekannt', 'Weiß ich nicht mehr']].map(([w, t]) => `
              <label class="zeile" style="cursor:pointer"><input type="radio" name="status" value="${w}" ${status === w ? 'checked' : ''} style="width:1.4rem;height:1.4rem;accent-color:var(--akzent)"><span class="zeile-text"><span class="zeile-titel">${t}</span></span></label>`).join('')}
          </div>
        </div>
        <label class="feld"><span>Uhrzeit (freiwillig)</span><input type="time" name="uhr" value="${esc(e && e.uhr ? e.uhr : '')}"></label>
        <div class="formular-fuss">
          <button type="submit" class="knopf knopf-haupt knopf-breit">Speichern</button>
          <div class="knopf-reihe"><button type="button" class="knopf knopf-leise" data-act="zurueck">Abbrechen</button></div>
        </div>
      </form>`,
  };
}

function einnahmeAbsenden(id, f, heute) {
  const datum = f.get('datum');
  const fehler = {};
  if (!istISO(datum)) fehler.datum = 'Bitte ein Datum wählen.';
  else if (datum > heute) fehler.datum = 'Das Datum liegt in der Zukunft.';
  const status = f.get('status');
  if (!['genommen', 'nicht', 'unbekannt'].includes(status)) fehler.status = 'Bitte eine Möglichkeit wählen.';
  if (Object.keys(fehler).length) return { ok: false, fehler };
  const uhr = istUhr(String(f.get('uhr') || '')) ? f.get('uhr') : '';
  sp.einnahmeSetzen(datum, status === 'genommen' ? { uhr } : status === 'nicht' ? null : undefined);
  return { ok: true, meldung: 'Einnahme nachgetragen', danach: { name: 'einnahmen-liste' } };
}

// ---------------------------------------------------------------- Über mich

/**
 * Ein Geburtsjahr aus einem Eingabefeld – leer ist erlaubt. { ok, jahr, fehler }.
 * Auch für das Willkommen und die Frage auf der Dosis-Karte.
 */
export function jahrAus(roh, heute) {
  const t = String(roh || '').trim();
  if (!t) return { ok: true, jahr: null };
  const jahr = zahlAus(t);
  const jetzt = Number(heute.slice(0, 4));
  if (jahr === null || !Number.isInteger(jahr) || jahr < 1900 || jahr > jetzt - 10) {
    return { ok: false, fehler: 'Bitte das Geburtsjahr vierstellig eintragen, z. B. 1952 – oder leer lassen.' };
  }
  return { ok: true, jahr };
}

/** „4 Stunden", „5 Stunden", „60 Minuten" aus den Minuten in ABSTAND_MITTEL. */
const abstandText = (min) => (min % 60 === 0 && min >= 120 ? `${min / 60} Stunden` : `${min} Minuten`);


/** Ein Mittel zum Ankreuzen – bei Aufnahmehemmern mit der Frage nach dem Abstand (P7). */
function mittelZeile([k, name], stand) {
  const an = stand.mittel.includes(k);
  const min = ez.ABSTAND_MITTEL[k];
  const oestrogen = stand.profil.oestrogenPruefen && k.startsWith('oestrogen_')
    ? '<span class="hinweis warn-text">Bitte prüfen: Nehmen Sie Östrogen als Tablette oder als Pflaster/Gel? Früher gab es hier nur „Östrogen" – die App hat „als Tablette" angenommen.</span>' : '';
  return `
    <div class="mittel-zeile" data-mittel="${esc(k)}">
      <label class="haken haken-breit"><input type="checkbox" name="mittel" value="${esc(k)}" ${an ? 'checked' : ''}>${esc(name)}</label>
      ${oestrogen}
      ${min ? `<div class="mittel-abstand">${wahlFrage(`abstand_${k}`, stand.mittelAbstand[k] || '', `Nehmen Sie dieses Mittel mit mindestens ${abstandText(min)} Abstand zur Schilddrüsen-Tablette?`)}</div>` : ''}
    </div>`;
}

function profilFormular(id, stand, heute) {
  const p = stand.profil;
  const ziel = p.zielVon !== null && p.zielBis !== null;
  const alter = sp.alter(heute);
  const optionen = (liste, wert) => liste.map(([k, t]) => `<option value="${esc(k)}" ${wert === k ? 'selected' : ''}>${esc(t)}</option>`).join('');
  return {
    titel: 'Über mich & weitere Mittel',
    html: `
      <form data-formular="profil" novalidate>
        <p class="gedaempft" style="margin-bottom:.9rem">Alles freiwillig. Je mehr hier steht, desto genauer kann die App Ihre Werte und Beschwerden einordnen – und desto genauer sagt sie, was wann Abstand zur Tablette braucht. Was offen bleibt, gilt als „weiß nicht", nie als „nein".</p>

        <fieldset class="profil-teil"><legend>Über Sie</legend>
          <label class="haken haken-breit" style="margin-bottom:.4rem"><input type="checkbox" name="behandelt" ${p.behandelt ? 'checked' : ''}>Ich werde wegen einer Schilddrüsen-Unterfunktion mit Tabletten behandelt</label>
          <p class="hinweis" style="margin-bottom:.9rem">${esc(ez.P6_TEXT)}</p>
          <label class="feld"><span>Geburtsjahr</span>
            <input type="text" inputmode="numeric" name="geburtsjahr" value="${esc(p.geburtsjahr ? String(p.geburtsjahr) : '')}" placeholder="z. B. 1952" autocomplete="off">
            <span class="hinweis">Im Alter gelten für TSH oft andere Zielwerte. Ohne Geburtsjahr rechnet die App vorsichtiger.</span>
          </label>
        </fieldset>

        <fieldset class="profil-teil"><legend>Ihre Behandlung</legend>
          <label class="feld"><span>Warum nehmen Sie die Tablette?</span>
            <select name="ursache">${optionen(sp.URSACHEN, p.ursache)}</select>
            <span class="hinweis">Wenn Sie unsicher sind: Oft steht es im Arztbrief.</span>
          </label>
          ${wahlFrage('hypophyseOderNiedrig', p.hypophyseOderNiedrig, 'Hat Ihnen eine Ärztin einmal gesagt, dass die Ursache in der Hirnanhangdrüse liegt oder dass Ihr TSH bewusst niedrig gehalten werden soll?', { klasse: 'nur-offene-ursache' })}
          ${wahlFrage('krebs', p.krebs, 'Wurden Sie jemals wegen Schilddrüsenkrebs behandelt (Operation oder Radiojod)?', {
    hinweis: 'Warum die App das fragt: Nach Schilddrüsenkrebs soll TSH oft bewusst niedrig sein. Ein Rat zu „weniger" wäre dann falsch.',
    extra: ziel ? '' : '<p class="hinweis warn-text nur-bei-ja">Nach Schilddrüsenkrebs wird der TSH-Wert oft bewusst niedrig gehalten. Bitte fragen Sie Ihre Ärztin nach Ihrem persönlichen TSH-Zielbereich und tragen Sie ihn unten ein – sonst kann die App einen gewollt niedrigen Wert falsch einordnen.</p>',
  })}
          ${wahlFrage('praeparatArt', p.praeparatArt, 'Welche Schilddrüsen-Tablette nehmen Sie?', { optionen: sp.PRAEPARATE, hinweis: 'Steht auf der Packung – im Zweifel die Apotheke fragen.' })}
          <div class="feld" data-feld="zielVon"><span>Ihr persönlicher TSH-Zielbereich (nur ausfüllen, wenn Ihre Ärztin ihn Ihnen genannt hat)</span>
            <div class="bereich-reihe">
              <input type="text" inputmode="decimal" name="zielVon" value="${esc(zahlFeld(p.zielVon))}" placeholder="von" aria-label="Zielbereich von (mU/l)" autocomplete="off">
              <span aria-hidden="true">–</span>
              <input type="text" inputmode="decimal" name="zielBis" value="${esc(zahlFeld(p.zielBis))}" placeholder="bis" aria-label="Zielbereich bis (mU/l)" autocomplete="off">
              <span>mU/l</span>
            </div>
            <span class="hinweis">Er hat in der App Vorrang vor dem Bereich des Labors und vor den Altersregeln.${p.zielAm ? ` Eingetragen oder bestätigt am ${esc(datumInWorten(p.zielAm, { jahr: true }))}.` : ''}</span>
          </div>
          ${ziel || p.zielNiedrig === 'ja' ? '<label class="haken haken-breit" style="margin-bottom:.9rem"><input type="checkbox" name="zielBestaetigt">Die Praxis hat mir diesen Zielbereich gerade bestätigt</label>' : ''}
          ${wahlFrage('zielNiedrig', p.zielNiedrig, 'Hat Ihre Ärztin gesagt, dass Ihr TSH bewusst niedrig gehalten werden soll?')}
        </fieldset>

        <fieldset class="profil-teil"><legend>Gesundheit</legend>
          ${wahlFrage('herz', p.herz, 'Haben Sie eine Herzerkrankung? Dazu zählen: Vorhofflimmern oder andere Herzrhythmusstörungen, Herzschwäche, verengte Herzkranzgefäße (Angina pectoris), ein früherer Herzinfarkt.', { hinweis: 'Solange Sie es nicht wissen oder nichts angegeben haben, rechnet die App vorsichtig so, als hätten Sie eine.' })}
          ${wahlFrage('osteoporose', p.osteoporose, 'Hat eine Ärztin bei Ihnen Knochenschwund (Osteoporose) festgestellt?')}
          ${wahlFrage('kortison', p.kortison, 'Nehmen Sie dauerhaft Kortison als Tablette (z. B. Prednisolon, Hydrocortison) oder wurde bei Ihnen eine Nebennierenschwäche festgestellt?')}
          ${wahlFrage('diabetes', p.diabetes, 'Haben Sie Diabetes? Nehmen Sie Insulin oder Tabletten gegen Zucker?')}
          ${alter !== null && alter < 55 ? `<input type="hidden" name="schwangerGefragt" value="1">${wahlFrage('schwanger', p.schwanger, 'Sind Sie schwanger oder planen Sie eine Schwangerschaft?', { optionen: [['ja', 'Ja'], ['nein', 'Nein']] })}` : ''}
        </fieldset>

        <fieldset class="profil-teil"><legend>Notfall</legend>
          <label class="feld"><span>In welchem Bundesland wohnen Sie?</span>
            <select name="bundesland"><option value="">bitte wählen</option>${optionen(sp.BUNDESLAENDER.map(([k, n]) => [k, n]), p.bundesland)}</select>
            <span class="hinweis">Damit die App im Notfall die richtige Giftnotruf-Nummer anzeigt.</span>
          </label>
        </fieldset>

        <fieldset class="profil-teil"><legend id="frage-mittel">Was nehmen Sie sonst noch regelmäßig?</legend>
          <p class="hinweis" style="margin-bottom:.5rem">Neu begonnen oder abgesetzt? Am besten am selben Tag hier ändern – dann erinnert die App an die Kontrolle nach 6–8 Wochen.</p>
          <div class="mittel-liste" role="group" aria-labelledby="frage-mittel">
            ${sp.MITTEL.map((m) => mittelZeile(m, stand)).join('')}
          </div>
          <p class="hinweis" style="margin-top:.6rem">Die App sagt dann unter „Was braucht Abstand?", ab welcher Uhrzeit was in Ordnung ist.</p>
          <p class="klein" style="margin-top:.6rem">${esc(E14_TEXT)}</p>
        </fieldset>
        ${fuss('profil', null, { loeschen: false })}
      </form>`,
  };
}

function profilAbsenden(id, f, heute) {
  const fehler = {};
  const j = jahrAus(f.get('geburtsjahr'), heute);
  if (!j.ok) fehler.geburtsjahr = j.fehler;
  const zielVon = zahlAus(f.get('zielVon'));
  const zielBis = zahlAus(f.get('zielBis'));
  const zielRoh = String(f.get('zielVon') || '').trim() || String(f.get('zielBis') || '').trim();
  if (zielRoh) {
    if (zielVon === null || zielBis === null) fehler.zielVon = 'Bitte beide Grenzen des Zielbereichs eintragen, z. B. 1 bis 3 – oder beide leer lassen.';
    else if (!(zielVon >= 0.01 && zielVon < zielBis && zielBis <= 10)) fehler.zielVon = 'Bitte prüfen: Der Zielbereich liegt zwischen 0,01 und 10 mU/l, und „von" ist kleiner als „bis".';
  }
  if (Object.keys(fehler).length) return { ok: false, fehler };
  const jnw = (name) => auswahl(f.get(name), JNW_WERTE);
  sp.aendern((s) => {
    const p = s.profil;
    p.geburtsjahr = j.jahr;
    p.behandelt = f.get('behandelt') === 'on';
    p.ursache = sp.URSACHEN.some(([k]) => k === f.get('ursache')) ? f.get('ursache') : '';
    ['krebs', 'herz', 'osteoporose', 'kortison', 'diabetes', 'hypophyseOderNiedrig'].forEach((k) => { p[k] = jnw(k); });
    if (f.get('schwangerGefragt')) p.schwanger = auswahl(f.get('schwanger'), ['ja', 'nein']);
    p.praeparatArt = auswahl(f.get('praeparatArt'), ['t4', 't3', 'unbekannt']);
    const von = zielRoh ? zielVon : null;
    const bis = zielRoh ? zielBis : null;
    const niedrig = jnw('zielNiedrig');
    // Ein Zielbereich altert still – mit Datum, wann er eingetragen oder
    // zuletzt von der Praxis bestätigt wurde. Vorher ließ sich eine
    // Bestätigung nicht festhalten, und „Gilt Ihr Zielbereich noch?" blieb
    // für immer stehen (B55).
    const bestaetigt = f.get('zielBestaetigt') === 'on';
    if (von !== p.zielVon || bis !== p.zielBis || niedrig !== p.zielNiedrig || bestaetigt) p.zielAm = von !== null || niedrig === 'ja' ? heute : null;
    p.zielVon = von;
    p.zielBis = bis;
    p.zielNiedrig = niedrig;
    p.bundesland = sp.BUNDESLAENDER.some(([k]) => k === f.get('bundesland')) ? f.get('bundesland') : '';
  });
  // Die Mittel nur über mittelSetzen: Es vermerkt Beginn und Ende mit Datum.
  const mittel = f.getAll('mittel');
  const abstand = Object.fromEntries(mittel.filter((k) => ez.ABSTAND_MITTEL[k]).map((k) => [k, jnw(`abstand_${k}`)]).filter(([, v]) => v));
  sp.mittelSetzen(mittel, abstand, heute);
  return { ok: true, meldung: 'Gespeichert' };
}

// ---------------------------------------------------------------- Geburtsjahr (Dosis-Karte)

function geburtsjahrAbsenden(id, f, heute) {
  const j = jahrAus(f.get('geburtsjahr'), heute);
  if (!j.ok || j.jahr === null) return { ok: false, fehler: { geburtsjahr: j.fehler || 'Bitte das Geburtsjahr eintragen, z. B. 1952.' } };
  sp.aendern((s) => { s.profil.geburtsjahr = j.jahr; });
  return { ok: true, meldung: 'Geburtsjahr gespeichert', danach: { name: 'dosis-karte' } };
}

// ---------------------------------------------------------------- Warnzeichen

/** Der Check wird gespeichert – für das Gesamtbild von heute und den Bericht. */
function warnzeichenAbsenden(id, f, heute) {
  const ja = f.getAll('warn').filter((k) => ez.WARNFRAGEN.some((w) => w.key === k));
  const check = { id: sp.kennung(), datum: heute, uhr: jetztUhr(), ja };
  sp.aendern((s) => { s.warnzeichen.push(check); });
  return { ok: true, meldung: 'Ausgewertet', danach: { name: 'warnzeichen-ergebnis', param: check.id } };
}

// ---------------------------------------------------------------- Anrede

function anredeAbsenden(id, f) {
  const name = String(f.get('name') || '').trim().slice(0, 60);
  sp.aendern((s) => { s.profil.name = name; });
  return { ok: true, meldung: 'Anrede gespeichert', danach: { name: 'darstellung' } };
}

// ---------------------------------------------------------------- Weiche

const FORMULARE = {
  // Die Anrede steht als Formular auf der Seite „Darstellung" (js/ansicht-mehr.js)
  // und hat deshalb keine eigene Seite – nur das Absenden.
  anrede: [() => null, anredeAbsenden],
  profil: [profilFormular, profilAbsenden],
  // Der Warnzeichen-Check und die Frage nach dem Geburtsjahr haben ihre
  // Seiten in js/ansicht-einschaetzung.js bzw. js/ansicht-dosis.js; hier nur
  // das Speichern.
  warnzeichen: [() => null, warnzeichenAbsenden],
  geburtsjahr: [() => null, geburtsjahrAbsenden],
  dosis: [dosisFormular, dosisAbsenden],
  labor: [laborFormular, laborAbsenden],
  gewicht: [gewichtFormular, gewichtAbsenden],
  befinden: [befindenFormular, befindenAbsenden],
  termin: [terminFormular, terminAbsenden],
  frage: [frageFormular, frageAbsenden],
  vorrat: [vorratFormular, vorratAbsenden],
  einnahme: [einnahmeFormular, einnahmeAbsenden],
};

/** { titel, html } oder null, wenn `name` kein Formular ist. */
export function formular(name, param, stand, heute = heuteISO()) {
  const f = FORMULARE[name];
  return f ? f[0](param, stand, heute) : null;
}

/** { ok, fehler } bzw. { ok, meldung, danach }. */
export function absenden(name, id, form, heute = heuteISO()) {
  const f = FORMULARE[name];
  if (!f) return { ok: false, fehler: {} };
  return f[1](id, new FormData(form), heute);
}

/** Einen Eintrag einer Liste löschen. */
export function eintragLoeschen(art, id) {
  sp.aendern((s) => {
    if (art === 'vorrat') { s.vorrat = null; return; }
    const liste = { dosis: 'dosen', labor: 'labor', gewicht: 'gewicht', befinden: 'befinden', termin: 'termine', frage: 'fragen' }[art];
    if (liste) s[liste] = s[liste].filter((e) => e.id !== id);
  });
}

export { datumInWorten, uhrText };
