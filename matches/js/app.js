/*
 * Die Oberfläche: Formular, Tabelle, Import, Ausgabe.
 *
 * Ein Gedanke zieht sich durch alles hier: Eintragen muss schneller gehen als
 * Nachdenken. Wer die App offen hat und dort „4 km" liest, tippt Name, wählt
 * die App, tippt 4 – Enter. Alles Weitere (Ort, Datum, Notiz) ist freiwillig
 * und darf leer bleiben, ohne dass die Zeile dadurch falsch wird.
 */

import { entfernung, ortAufloesen, orte } from './geo.js';
import {
  APPS, STATUS, alsCsv, filtern, kmText, laden, person, sichern, sortieren,
} from './speicher.js';
import { einlesen, zusammenfuehren } from './import.js';

const $ = (id) => document.getElementById(id);
let zustand = laden();
let bearbeitet = null;   // id der Zeile, die gerade im Formular liegt

/* --- kleine Helfer ---------------------------------------------------- */

function el(tag, eigenschaften = {}, kinder = []) {
  const knoten = document.createElement(tag);
  for (const [k, v] of Object.entries(eigenschaften)) {
    if (k === 'text') knoten.textContent = v;
    else if (k === 'class') knoten.className = v;
    else if (v !== null && v !== false) knoten.setAttribute(k, v);
  }
  for (const kind of [].concat(kinder)) if (kind) knoten.append(kind);
  return knoten;
}

function speichern() {
  if (!sichern(zustand)) {
    meldung($('formHinweis'), 'Der Speicher des Browsers ist voll – die Zeile steht auf dem Schirm, '
      + 'aber nicht auf der Platte. Am besten eine Sicherung ziehen und Erledigtes löschen.');
  }
}

function meldung(knoten, text) {
  if (!knoten) return;
  knoten.textContent = text || '';
  knoten.hidden = !text;
}

/** Eine Datei zum Herunterladen anbieten. */
function ausgeben(name, inhalt, typ) {
  const url = URL.createObjectURL(new Blob([inhalt], { type: typ }));
  const a = el('a', { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* --- Standort --------------------------------------------------------- */

function heimZeigen() {
  const h = zustand.heim;
  $('heimStand').textContent = h
    ? `Gemessen wird ab ${h.ort} (${h.lat.toFixed(3)}, ${h.lon.toFixed(3)}).`
    : 'Noch kein Standort – Entfernungen lassen sich dann nur eintragen, nicht rechnen.';
  if (h && !$('heimOrt').value) $('heimOrt').value = h.ort;
}

async function heimSetzen() {
  const text = $('heimOrt').value.trim();
  if (!text) return;
  const treffer = await ortAufloesen(text, { netz: zustand.netzsuche }).catch(() => null);
  if (!treffer) {
    $('heimStand').textContent = `„${text}" steht nicht in der eingebauten Ortsliste. `
      + 'Entweder Koordinaten eintippen („52.52, 13.405") oder oben die Ortssuche einschalten.';
    return;
  }
  zustand.heim = { ort: treffer.ort, lat: treffer.lat, lon: treffer.lon };
  speichern();
  heimZeigen();
  zeichnen();
}

function heimOrten() {
  if (!navigator.geolocation) {
    $('heimStand').textContent = 'Dieser Browser gibt keinen Standort heraus.';
    return;
  }
  $('heimStand').textContent = 'Frage das Gerät …';
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      zustand.heim = {
        ort: 'eigener Standort',
        lat: pos.coords.latitude,
        lon: pos.coords.longitude,
      };
      speichern();
      heimZeigen();
      zeichnen();
    },
    () => { $('heimStand').textContent = 'Das Gerät hat den Standort nicht herausgegeben.'; },
    { maximumAge: 600000, timeout: 8000 },
  );
}

/* --- Formular --------------------------------------------------------- */

function formularLeeren() {
  bearbeitet = null;
  for (const id of ['fName', 'fKm', 'fOrt', 'fDatum', 'fNotiz']) $(id).value = '';
  $('fStatus').value = 'neu';
  $('formTitel').textContent = 'Person eintragen';
  $('fSenden').textContent = 'Hinzufügen';
  $('fAbbrechen').hidden = true;
  meldung($('formHinweis'), '');
}

function formularFuellen(p) {
  bearbeitet = p.id;
  $('fName').value = p.name;
  $('fApp').value = p.app;
  $('fKm').value = p.km === null ? '' : p.km;
  $('fOrt').value = p.ort;
  $('fDatum').value = p.matchAm || '';
  $('fStatus').value = p.status;
  $('fNotiz').value = p.notiz;
  $('formTitel').textContent = `${p.name || 'Zeile'} bearbeiten`;
  $('fSenden').textContent = 'Speichern';
  $('fAbbrechen').hidden = false;
  $('fName').focus();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function absenden(ereignis) {
  ereignis.preventDefault();
  const name = $('fName').value.trim();
  if (!name) return;
  const ortText = $('fOrt').value.trim();
  const kmText_ = $('fKm').value.trim();

  const daten = {
    name,
    app: $('fApp').value,
    km: kmText_ === '' ? null : Number(kmText_.replace(',', '.')),
    ort: ortText,
    matchAm: $('fDatum').value || null,
    status: $('fStatus').value,
    notiz: $('fNotiz').value.trim(),
  };

  // Die Koordinaten werden bei jedem Speichern neu bestimmt und vorher gelöscht.
  // Sonst überlebt ein alter Punkt das Ändern des Ortsfeldes: Wer „Leipzig" durch
  // „Hamburg" ersetzt und beim Nachschlagen keinen Treffer hat, bekäme sonst
  // weiter die Entfernung nach Leipzig – falsch und nicht als falsch erkennbar.
  let hinweis = '';
  daten.lat = null;
  daten.lon = null;
  if (ortText) {
    const treffer = await ortAufloesen(ortText, { netz: zustand.netzsuche }).catch(() => null);
    if (treffer) {
      daten.lat = treffer.lat;
      daten.lon = treffer.lon;
      daten.ort = treffer.ort;
    } else if (daten.km === null) {
      // Steht eine Zahl aus der App daneben, ist der unbekannte Ort kein
      // Problem – dann ist er nur eine Notiz. Gemeldet wird er nur, wenn ohne
      // ihn die Entfernungsspalte leer bleibt.
      hinweis = `„${ortText}" ließ sich nicht auf Koordinaten bringen – die Zeile steht, `
        + 'die Entfernung bleibt offen. Hilft: Kilometer aus der App eintragen.';
    }
  }

  if (bearbeitet) {
    const alt = zustand.leute.find((p) => p.id === bearbeitet);
    if (alt) {
      // Vom Import geratene Namen sind, sobald jemand sie anfasst, keine
      // Vermutung mehr – die kursive Schreibweise muss dann weg.
      Object.assign(alt, person({ ...alt, ...daten, geraten: false, id: alt.id }));
    }
  } else {
    zustand.leute.push(person({ ...daten, quelle: 'hand' }));
  }
  speichern();
  formularLeeren();
  meldung($('formHinweis'), hinweis);
  zeichnen();
}

/* --- Tabelle ---------------------------------------------------------- */

function zeileBauen(p) {
  const e = entfernung(p, zustand.heim);
  const tr = el('tr');

  const km = el('td', { class: 'km' });
  if (e.km === null) {
    km.classList.add('km--leer');
    km.textContent = '–';
  } else {
    km.classList.toggle('km--gerechnet', e.quelle === 'gerechnet');
    km.append(document.createTextNode(e.quelle === 'gerechnet' ? `~ ${kmText(e.km)}` : kmText(e.km)));
    km.append(el('small', { text: e.quelle === 'gerechnet' ? 'aus dem Ort' : 'aus der App' }));
  }
  tr.append(km);

  const name = el('td');
  name.append(el('span', {
    class: p.geraten ? 'name name--geraten' : 'name',
    text: p.name || '(ohne Namen)',
    title: p.geraten ? 'Aus der eigenen ersten Nachricht geraten – bitte prüfen.' : null,
  }));
  if (p.ort) name.append(el('div', { class: 'notiz', text: p.ort }));
  tr.append(name);

  tr.append(el('td', {}, el('span', { class: `pille pille--${p.app}`, text: APPS[p.app] })));
  tr.append(el('td', { text: p.matchAm ? p.matchAm.split('-').reverse().join('.') : '–' }));
  tr.append(el('td', {}, el('span', { class: `status-${p.status}`, text: STATUS[p.status] })));
  tr.append(el('td', { text: p.nachrichten || '–' }));
  tr.append(el('td', { class: 'notiz th-notiz', text: p.notiz }));

  const werkzeug = el('div', { class: 'zeile-werkzeug' });
  const stift = el('button', { type: 'button', class: 'knopf knopf--still', text: '✎', 'aria-label': `${p.name} bearbeiten` });
  stift.addEventListener('click', () => formularFuellen(p));
  const weg = el('button', { type: 'button', class: 'knopf knopf--still', text: '✕', 'aria-label': `${p.name} löschen` });
  weg.addEventListener('click', () => {
    if (!confirm(`${p.name || 'Diese Zeile'} löschen?`)) return;
    zustand.leute = zustand.leute.filter((x) => x.id !== p.id);
    if (bearbeitet === p.id) formularLeeren();
    speichern();
    zeichnen();
  });
  werkzeug.append(stift, weg);
  tr.append(el('td', {}, werkzeug));
  return tr;
}

function zeichnen() {
  const gefiltert = filtern(zustand.leute, {
    app: $('filterApp').value,
    status: $('filterStatus').value,
    suche: $('suche').value,
  });
  const { feld, richtung } = zustand.sortier;
  const liste = sortieren(gefiltert, zustand.heim, feld, richtung);

  const koerper = $('koerper');
  koerper.replaceChildren(...liste.map(zeileBauen));

  for (const th of document.querySelectorAll('th[data-feld]')) {
    if (th.dataset.feld === feld) th.setAttribute('aria-sort', richtung === 1 ? 'ascending' : 'descending');
    else th.removeAttribute('aria-sort');
  }

  const ohneEntfernung = liste.filter((p) => entfernung(p, zustand.heim).km === null).length;
  $('zaehler').textContent = zustand.leute.length
    ? `${liste.length} von ${zustand.leute.length}`
      + (ohneEntfernung ? ` · ${ohneEntfernung} ohne Entfernung` : '')
    : '';

  const leer = $('leer');
  leer.hidden = liste.length > 0;
  if (!liste.length) {
    leer.replaceChildren(
      el('p', { text: zustand.leute.length ? 'Kein Treffer für diese Auswahl.' : 'Noch keine Zeile.' }),
      el('p', {
        text: zustand.leute.length
          ? 'Filter zurücksetzen oder Suchwort kürzen.'
          : 'Oben eintragen – oder unten eine Datenauskunft einlesen.',
      }),
    );
  }
}

function sortierWechsel(feld) {
  const s = zustand.sortier;
  // Beim Wechsel der Spalte aufsteigend beginnen; beim zweiten Tippen umdrehen.
  zustand.sortier = s.feld === feld ? { feld, richtung: -s.richtung } : { feld, richtung: 1 };
  speichern();
  zeichnen();
}

/* --- Import und Ausgabe ----------------------------------------------- */

async function dateienLesen(dateien) {
  const stand = $('importStand');
  stand.replaceChildren();
  let neuGesamt = 0;
  for (const datei of dateien) {
    const roh = await datei.text();
    let ergebnis;
    try {
      ergebnis = einlesen(roh, datei.name);
    } catch (fehler) {
      stand.append(el('p', { class: 'hinweis', text: `${datei.name}: ${fehler.message}` }));
      continue;
    }
    const { liste, neu, ergaenzt } = zusammenfuehren(zustand.leute, ergebnis.leute.map(person));
    zustand.leute = liste;
    neuGesamt += neu;
    stand.append(el('p', {
      class: 'hinweis hinweis--ruhig',
      text: `${datei.name}: ${neu} neue Zeilen`
        + (ergaenzt ? `, ${ergaenzt} vorhandene ergänzt` : '')
        + ` (erkannt als ${APPS[ergebnis.app] || ergebnis.app}).`,
    }));
    for (const h of ergebnis.hinweise) stand.append(el('p', { class: 'hinweis', text: h }));
  }
  if (neuGesamt) {
    speichern();
    stand.append(el('p', {
      class: 'hinweis',
      text: 'Die neuen Zeilen stehen ganz unten, weil ihnen die Entfernung fehlt – '
        + 'die steht in keinem Export. Name und Kilometer über ✎ nachtragen.',
    }));
  }
  zeichnen();
}

async function wiederherstellen(datei) {
  try {
    const daten = JSON.parse(await datei.text());
    if (!Array.isArray(daten.leute)) throw new Error('Keine Liste darin.');
    zustand = {
      ...zustand, ...daten, leute: daten.leute.map(person),
    };
    speichern();
    heimZeigen();
    zeichnen();
    $('importStand').replaceChildren(el('p', {
      class: 'hinweis hinweis--ruhig',
      text: `${zustand.leute.length} Zeilen aus der Sicherung übernommen.`,
    }));
  } catch (fehler) {
    $('importStand').replaceChildren(el('p', {
      class: 'hinweis', text: `Diese Sicherung ließ sich nicht lesen: ${fehler.message}`,
    }));
  }
}

/* --- Aufbau ----------------------------------------------------------- */

$('ortsliste').replaceChildren(...orte().map((o) => el('option', { value: o })));

$('form').addEventListener('submit', absenden);
$('fAbbrechen').addEventListener('click', formularLeeren);
$('heimSetzen').addEventListener('click', heimSetzen);
$('heimOrten').addEventListener('click', heimOrten);
$('heimOrt').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); heimSetzen(); } });
$('netzsuche').addEventListener('change', (e) => { zustand.netzsuche = e.target.checked; speichern(); });
for (const id of ['suche', 'filterApp', 'filterStatus']) $(id).addEventListener('input', zeichnen);
for (const th of document.querySelectorAll('th[data-feld]')) {
  th.querySelector('button').addEventListener('click', () => sortierWechsel(th.dataset.feld));
}
$('datei').addEventListener('change', (e) => { dateienLesen([...e.target.files]); e.target.value = ''; });
$('zurueck').addEventListener('change', (e) => {
  if (e.target.files[0]) wiederherstellen(e.target.files[0]);
  e.target.value = '';
});
$('csvRaus').addEventListener('click', () => {
  const liste = sortieren(zustand.leute, zustand.heim, zustand.sortier.feld, zustand.sortier.richtung);
  // Das vorangestellte \ufeff ist die Byte-Reihenfolge-Marke: ohne sie zeigt
  // Excel jeden Umlaut als Buchstabensalat.
  ausgeben('matches.csv', `\ufeff${alsCsv(liste, zustand.heim)}`, 'text/csv;charset=utf-8');
});
$('sicherung').addEventListener('click', () => {
  ausgeben(`matches-sicherung-${new Date().toISOString().slice(0, 10)}.json`,
    JSON.stringify(zustand, null, 1), 'application/json');
});

$('netzsuche').checked = Boolean(zustand.netzsuche);
heimZeigen();
zeichnen();

// Für die Tests: an das Fenster gehängt, damit sich Zustand und Rechnung von
// außen prüfen lassen, ohne die Oberfläche nachzuspielen.
window.matches = {
  zustand: () => zustand,
  setzen: (neu) => { zustand = neu; speichern(); heimZeigen(); zeichnen(); },
  zeichnen,
};
