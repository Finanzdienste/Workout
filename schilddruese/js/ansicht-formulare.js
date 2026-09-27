/*
 * Die Formulare: Dosis, Laborwert, Gewicht, Befinden, Termin, Frage, Vorrat,
 * Einnahme nachtragen.
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
import { heuteISO, tageWeiter, istISO, istUhr, zahlAus, zahlText, datumInWorten, uhrText } from './datum.js';
import { esc } from './text.js';
import * as sp from './speicher.js';

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

function dosisFormular(id, stand, heute) {
  const da = id ? stand.dosen.find((d) => d.id === id) : null;
  const letzte = sp.aktuelleDosis();
  const d = da || { praeparat: letzte ? letzte.praeparat : 'L-Thyroxin', mikrogramm: null, tabletten: 1, ab: heute, notiz: '' };
  return {
    titel: da ? 'Dosis ändern' : 'Neue Dosis',
    html: `
      <form data-formular="dosis" ${id ? `data-id="${esc(id)}"` : ''} novalidate>
        ${!da && letzte ? `<div class="hinweis-karte"><span class="ri" aria-hidden="true">ℹ️</span><div>Die bisherige Dosis (${esc(sp.dosisText(letzte))}) bleibt im Verlauf stehen. Hier kommt die neue dazu, so wie die Ärztin sie verordnet hat.</div></div>` : ''}
        ${feldText('praeparat', d.praeparat, 'Präparat', { platzhalter: 'z. B. L-Thyroxin Henning', hinweis: 'So, wie es auf der Packung steht. Ein Herstellerwechsel ist auch eine Änderung.' })}
        ${feldZahl('mikrogramm', d.mikrogramm, 'Stärke in µg (Mikrogramm)', { platzhalter: 'z. B. 75', hinweis: 'Die Zahl auf der Packung, z. B. 50, 75 oder 100.' })}
        ${tablettenWahl(d.tabletten)}
        ${feldDatum('ab', d.ab, 'Gilt ab', 'Der Tag, ab dem diese Dosis genommen wird. Liegt er in der Zukunft, nennt „Heute" bis dahin weiter die bisherige Dosis.')}
        ${feldText('notiz', d.notiz, 'Notiz (freiwillig)', { platzhalter: 'z. B. nach Laborkontrolle im März' })}
        ${fuss('dosis', id)}
      </form>`,
  };
}

function dosisAbsenden(id, f, heute) {
  const fehler = {};
  const mikrogramm = zahlAus(f.get('mikrogramm'));
  if (mikrogramm === null || mikrogramm <= 0) fehler.mikrogramm = 'Bitte die Stärke in µg eintragen, z. B. 75.';
  else if (mikrogramm < 5 || mikrogramm > 400) fehler.mikrogramm = 'Bitte prüfen: Übliche Stärken liegen zwischen 12,5 und 300 µg. Steht eine andere Zahl auf der Packung, prüfen Sie die Einheit.';
  const ab = f.get('ab');
  if (!istISO(ab)) fehler.ab = 'Bitte ein Datum wählen.';
  else if (ab > tageWeiter(heute, 365)) fehler.ab = 'Das Datum liegt weit in der Zukunft.';
  if (Object.keys(fehler).length) return { ok: false, fehler };
  const eintrag = {
    praeparat: String(f.get('praeparat') || '').trim().slice(0, 80),
    mikrogramm,
    tabletten: zahlAus(f.get('tabletten')) || 1,
    ab,
    notiz: String(f.get('notiz') || '').trim().slice(0, 300),
  };
  sp.aendern((s) => {
    const da = id ? s.dosen.find((d) => d.id === id) : null;
    if (da) Object.assign(da, eintrag);
    else s.dosen.push({ id: sp.kennung(), ...eintrag });
    s.dosen.sort((a, b) => a.ab.localeCompare(b.ab));
  });
  return { ok: true, meldung: 'Dosis gespeichert' };
}

// ---------------------------------------------------------------- Labor

function laborFormular(id, stand, heute) {
  const da = id ? stand.labor.find((l) => l.id === id) : null;
  const letzter = stand.labor.length ? stand.labor[stand.labor.length - 1] : null;
  const l = da || { datum: heute, tsh: null, ft4: null, ft3: null, notiz: '', vorAbnahme: null, biotin: false };
  const karte = ([key, name, einheiten]) => {
    const w = l[key];
    // Die Einheit vom letzten Mal vorbelegen (sichtbar, zum Bestätigen), den
    // Bereich aber nicht: Kommt der Befund von einem anderen Labor, stünde
    // sonst still der alte Bereich darunter – und mit ng/dl statt pmol/l ein
    // scheinbar zwölfmal zu niedriger Wert. Der alte Bereich steht nur als
    // Platzhalter da.
    const vorher = (letzter && letzter[key]) || null;
    const vorlage = w || null;
    const einheit = w ? w.einheit : vorher ? vorher.einheit : einheiten[0];
    const platzVon = vorher && vorher.von !== null ? `z. B. ${zahlFeld(vorher.von)}` : 'von';
    const platzBis = vorher && vorher.bis !== null ? `z. B. ${zahlFeld(vorher.bis)}` : 'bis';
    return `
      <div class="karte" data-feld="${key}">
        <div class="laborwert-kopf"><span class="laborwert-name">${name}</span>
          <select name="${key}_einheit" aria-label="Einheit ${name}" style="width:auto;min-height:2.4rem">
            ${[...new Set([...einheiten, einheit].filter(Boolean))].map((e) => `<option value="${esc(e)}" ${e === einheit ? 'selected' : ''}>${esc(e)}</option>`).join('')}
          </select>
        </div>
        ${feldZahl(`${key}_wert`, w ? w.wert : null, 'Wert', { platzhalter: key === 'tsh' ? 'z. B. 2,1' : key === 'ft4' || key === 'ft3' ? 'z. B. 15,2' : 'vom Befund' })}
        <div class="feld" data-feld="${key}_von"><span>Bereich laut Befund</span>
          <div class="bereich-reihe">
            <input type="text" inputmode="decimal" name="${key}_von" value="${esc(zahlFeld(vorlage ? vorlage.von : null))}" placeholder="${esc(platzVon)}" aria-label="${name}: Bereich von" autocomplete="off">
            <span aria-hidden="true">–</span>
            <input type="text" inputmode="decimal" name="${key}_bis" value="${esc(zahlFeld(vorlage ? vorlage.bis : null))}" placeholder="${esc(platzBis)}" aria-label="${name}: Bereich bis" autocomplete="off">
          </div>
        </div>
      </div>`;
  };
  const werte = sp.LABORWERTE.map(karte).join('');
  const weitereDa = sp.WEITERE_WERTE.some(([k]) => l[k]);
  const weitere = `
    <details class="weitere" ${weitereDa ? 'open' : ''}>
      <summary>Weitere Werte (freiwillig): Cholesterin, Blutzucker, B12, Eisen, Vitamin D</summary>
      <p class="klein gedaempft" style="margin:.4rem 0 .6rem">Stehen sie auf demselben Befund, gleich mit abschreiben – sie kommen dann mit in den Bericht.</p>
      ${sp.WEITERE_WERTE.map(karte).join('')}
    </details>`;
  return {
    titel: da ? 'Laborwert ändern' : 'Laborwerte eintragen',
    html: `
      <form data-formular="labor" ${id ? `data-id="${esc(id)}"` : ''} novalidate>
        <div class="hinweis-karte"><span class="ri" aria-hidden="true">ℹ️</span><div>Vom Befund abschreiben, so wie es dort steht – auch die Einheit und den Bereich des Labors, denn jedes Labor hat eigene Grenzen. Nicht jeder Wert ist jedes Mal dabei; leere Felder sind in Ordnung.</div></div>
        ${feldDatum('datum', l.datum, 'Datum der Blutabnahme')}
        ${werte}
        ${weitere}
        <div class="feld"><span>Am Tag der Blutabnahme</span>
          <label class="haken" style="margin:.2rem 0 .5rem"><input type="checkbox" name="vorAbnahme" ${l.vorAbnahme ? 'checked' : ''}>Tablette schon <strong>vor</strong> der Abnahme genommen</label>
          <label class="haken"><input type="checkbox" name="biotin" ${l.biotin ? 'checked' : ''}>In den Tagen davor Biotin genommen (Haar-, Haut-, Nägel-Mittel)</label>
          <span class="hinweis">Beides verändert, wie die Werte zu lesen sind – die Einschätzung berücksichtigt es.</span>
        </div>
        ${feldText('notiz', l.notiz, 'Notiz (freiwillig)', { platzhalter: 'z. B. anderes Labor als sonst', lang: true })}
        ${fuss('labor', id)}
      </form>`,
  };
}

function laborAbsenden(id, f, heute) {
  const fehler = {};
  const datum = f.get('datum');
  if (!istISO(datum)) fehler.datum = 'Bitte ein Datum wählen.';
  else if (datum > heute) fehler.datum = 'Das Datum liegt in der Zukunft.';
  const eintrag = {
    datum,
    notiz: String(f.get('notiz') || '').trim().slice(0, 300),
    vorAbnahme: f.get('vorAbnahme') === 'on',
    biotin: f.get('biotin') === 'on',
  };
  let einer = false;
  [...sp.LABORWERTE, ...sp.WEITERE_WERTE].forEach(([key, name]) => {
    const rohWert = String(f.get(`${key}_wert`) || '').trim();
    const wert = zahlAus(rohWert);
    const von = zahlAus(f.get(`${key}_von`));
    const bis = zahlAus(f.get(`${key}_bis`));
    if (rohWert && wert === null) fehler[`${key}_wert`] = `${name}: Bitte eine Zahl eintragen, z. B. 2,1.`;
    if (wert === null) { eintrag[key] = null; return; }
    if (wert < 0) fehler[`${key}_wert`] = `${name}: Der Wert kann nicht negativ sein.`;
    if ((von !== null) !== (bis !== null)) fehler[`${key}_von`] = `${name}: Bitte beide Grenzen des Bereichs eintragen – oder beide leer lassen.`;
    else if (von !== null && von > bis) fehler[`${key}_von`] = `${name}: „von" muss kleiner sein als „bis".`;
    einer = true;
    eintrag[key] = { wert, einheit: String(f.get(`${key}_einheit`) || '').slice(0, 20), von, bis };
  });
  if (!einer && !Object.keys(fehler).length) fehler.tsh_wert = 'Bitte mindestens einen Wert eintragen.';
  if (Object.keys(fehler).length) return { ok: false, fehler };
  sp.aendern((s) => {
    const da = id ? s.labor.find((l) => l.id === id) : null;
    if (da) Object.assign(da, eintrag);
    else s.labor.push({ id: sp.kennung(), ...eintrag });
    s.labor.sort((a, b) => a.datum.localeCompare(b.datum));
  });
  return { ok: true, meldung: 'Laborwerte gespeichert', danach: { name: 'labor-liste' } };
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

function befindenFormular(id, stand, heute) {
  const da = id ? stand.befinden.find((b) => b.id === id) : stand.befinden.find((b) => b.datum === heute);
  const b = da || { datum: heute, stufe: 'mittel', beschwerden: [], notiz: '' };
  return {
    titel: 'Befinden',
    html: `
      <form data-formular="befinden" ${da ? `data-id="${esc(da.id)}"` : ''} novalidate>
        ${feldDatum('datum', b.datum)}
        <div class="feld" data-feld="stufe"><span id="frage-stufe">Wie geht es Ihnen?</span>
          <div class="wahl" role="radiogroup" aria-labelledby="frage-stufe">
            ${[['gut', 'Gut'], ['mittel', 'Mittel'], ['schlecht', 'Schlecht']].map(([w, t]) => `
              <label class="knopf" style="cursor:pointer"><input type="radio" name="stufe" value="${w}" ${b.stufe === w ? 'checked' : ''} class="sr-only">${t}</label>`).join('')}
          </div>
        </div>
        <div class="feld"><span>Was macht sich bemerkbar?</span>
          <div class="haken-liste">
            ${sp.BESCHWERDEN.map(([k, t]) => `<label class="haken"><input type="checkbox" name="beschwerden" value="${k}" ${b.beschwerden.includes(k) ? 'checked' : ''}>${t}</label>`).join('')}
          </div>
          <span class="hinweis">Alles freiwillig. Solche Beschwerden haben oft andere Gründe – deshalb gehört das ins Gespräch mit der Ärztin, nicht in eine eigene Dosisänderung.</span>
        </div>
        ${feldText('notiz', b.notiz, 'Notiz (freiwillig)', { lang: true, platzhalter: 'z. B. seit drei Tagen abends sehr müde' })}
        ${fuss('befinden', da ? da.id : null)}
      </form>`,
  };
}

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
  sp.aendern((s) => {
    const da = id ? s.befinden.find((b) => b.id === id) : s.befinden.find((b) => b.datum === datum);
    s.befinden = s.befinden.filter((b) => b === da || b.datum !== datum);
    if (da) Object.assign(da, { datum, stufe, beschwerden, notiz });
    else s.befinden.push({ id: sp.kennung(), datum, stufe, beschwerden, notiz });
    s.befinden.sort((a, b) => a.datum.localeCompare(b.datum));
  });
  return { ok: true, meldung: 'Befinden gespeichert' };
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

function profilFormular(id, stand, heute) {
  const p = stand.profil;
  return {
    titel: 'Über mich & weitere Mittel',
    html: `
      <form data-formular="profil" novalidate>
        <p class="gedaempft" style="margin-bottom:.9rem">Alles freiwillig. Je mehr hier steht, desto genauer kann die App Ihre Werte und Beschwerden einordnen – und desto genauer sagt sie, was wann Abstand zur Tablette braucht.</p>
        <label class="feld"><span>Geburtsjahr</span>
          <input type="text" inputmode="numeric" name="geburtsjahr" value="${esc(p.geburtsjahr ? String(p.geburtsjahr) : '')}" placeholder="z. B. 1952" autocomplete="off">
          <span class="hinweis">Im Alter gelten für TSH oft andere Zielwerte.</span>
        </label>
        <label class="feld"><span>Ursache der Unterfunktion</span>
          <select name="ursache">${sp.URSACHEN.map(([k, t]) => `<option value="${k}" ${p.ursache === k ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select>
        </label>
        <label class="feld"><span>Herzkrankheit (z. B. Herzrhythmusstörung, Herzschwäche, verengte Herzkranzgefäße)?</span>
          <select name="herz">
            ${[['', 'bitte wählen'], ['nein', 'nein'], ['ja', 'ja'], ['unbekannt', 'weiß ich nicht']].map(([k, t]) => `<option value="${k}" ${p.herz === k ? 'selected' : ''}>${t}</option>`).join('')}
          </select>
        </label>
        <div class="feld"><span id="frage-mittel">Was nehmen Sie sonst noch regelmäßig?</span>
          <div class="haken-liste" role="group" aria-labelledby="frage-mittel">
            ${sp.MITTEL.map(([k, t]) => `<label class="haken"><input type="checkbox" name="mittel" value="${k}" ${stand.mittel.includes(k) ? 'checked' : ''}>${esc(t)}</label>`).join('')}
          </div>
          <span class="hinweis">Die App sagt dann unter „Mehr → Was braucht Abstand?", ab welcher Uhrzeit was in Ordnung ist.</span>
        </div>
        ${fuss('profil', null, { loeschen: false })}
      </form>`,
  };
}

function profilAbsenden(id, f, heute) {
  const roh = String(f.get('geburtsjahr') || '').trim();
  const jahr = zahlAus(roh);
  const jetzt = Number(heute.slice(0, 4));
  if (roh && (jahr === null || !Number.isInteger(jahr) || jahr < 1900 || jahr > jetzt - 10)) {
    return { ok: false, fehler: { geburtsjahr: 'Bitte das Geburtsjahr vierstellig eintragen, z. B. 1952 – oder leer lassen.' } };
  }
  sp.aendern((s) => {
    s.profil.geburtsjahr = jahr;
    s.profil.ursache = sp.URSACHEN.some(([k]) => k === f.get('ursache')) ? f.get('ursache') : '';
    s.profil.herz = ['ja', 'nein', 'unbekannt', ''].includes(f.get('herz')) ? f.get('herz') : '';
    s.mittel = f.getAll('mittel').filter((k) => sp.MITTEL.some(([m]) => m === k));
  });
  return { ok: true, meldung: 'Gespeichert' };
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
  // Der Warnzeichen-Check hat seine Seite in js/ansicht-einschaetzung.js;
  // hier nur das Auswerten – es wird nichts gespeichert.
  warnzeichen: [() => null, (id, f) => ({
    ok: true,
    meldung: 'Ausgewertet',
    danach: { name: 'warnzeichen-ergebnis', param: f.getAll('warn').join(',') || '-' },
  })],
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

// Für Ansichten, die einen Eintrag kurz beschreiben.
export function laborZeile(l) {
  return sp.LABORWERTE
    .filter(([k]) => l[k])
    .map(([k, name]) => `${name} ${zahlText(l[k].wert)} ${l[k].einheit}`)
    .join(' · ');
}

export { datumInWorten, uhrText };
