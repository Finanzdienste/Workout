/*
 * Die Anzeige. Alles, was man sieht und antippt, steht hier.
 *
 * Aufbau in einem Satz: Ein Zustand im Speicher, eine Funktion, die daraus
 * HTML macht, und ein einziger Klick-Empfänger für alles. Kein Rahmenwerk,
 * keine Abhängigkeit, kein Bauschritt – index.html im Browser öffnen genügt.
 *
 * Was hier *nicht* steht, ist das Rechnen. Ob ein Auslöser auffällig ist,
 * entscheidet js/auswertung.js, und zwar ohne von dieser Datei zu wissen. Die
 * Richtung hält nur, solange sie geprüft wird – dafür gibt es
 * tools/pruefung/schichten.py.
 */
import * as store from './store.js';
import {
  fmtDatum, fmtMonat, fmtTag, heuteISO, jetztUhr, monatsRaster, monatsStart,
  plusMonate, plusTage, tageDazwischen, WOCHE_KOPF,
} from './datum.js';
import { esc, fmtZahl, kuerze, mehrzahl } from './text.js';
import {
  AUSLOESER, BESCHWERDEN, MITTEL_VORSCHLAEGE, PORTIONEN, ROLLEN, ROLLE_VORGABE,
  STAERKE_WORT, TAGESFRAGEN, ausloeserName, beschwerdeName, eigeneId, rolleName,
  sichtbareFragen,
} from './daten.js';
import {
  ausloeserBilanz, einstufung, EINSTUFUNG_WORT, faktorBilanz, gesamtZahlen,
  haeufigeGerichte, haeufigeZutaten, nachArt, nachTageszeit, rollenBilanz,
  serieOhne, stundenSeitEssen, tagesWert, verlaufReihe, zutatenVon,
} from './auswertung.js';
import { vergleichBalken, verlaufTafel } from './chart.js';
import { arztBericht, berichtName } from './bericht.js';
import { MITTEL_WISSEN, REIZSTOFFE, wissenZu } from './mittel.js';
import {
  belastbar, heutigerStand, mittlereLaenge, phasenBilanz, phasenName, schwankung,
} from './zyklus.js';
import { WARNZEICHEN, bildLesen, genugFuerBild } from './bild.js';
import { BEREICH_ICON, BEREICH_NAME, raete } from './rat.js';
import { UEBUNGEN, ablauf, dauerText, gesamtDauer, uebungVon } from './atem.js';
import { KLAENGE, ruettel, weckKlang } from './klang.js';

const viewEl = document.getElementById('view');
const tabbarEl = document.getElementById('tabbar');
const toastEl = document.getElementById('toast');

const REITER = [
  { id: 'heute', name: 'Tag', icon: '📓' },
  { id: 'verlauf', name: 'Verlauf', icon: '📅' },
  { id: 'muster', name: 'Muster', icon: '🔍' },
  { id: 'ruhe', name: 'Ruhe', icon: '🌬️' },
  { id: 'ideen', name: 'Ideen', icon: '💡' },
  { id: 'mehr', name: 'Mehr', icon: '⚙️' },
];

const THEMEN = [
  { id: 'rosa', name: 'Rosé' },
  { id: 'flieder', name: 'Flieder' },
  { id: 'koralle', name: 'Koralle' },
  { id: 'salbei', name: 'Salbei' },
];

/*
 * Flüchtiger Zustand: der angesehene Tag, der offene Bogen, der erzeugte
 * Bericht. Bewusst nicht im Speicher – wer die App morgen wieder aufmacht,
 * will beim heutigen Tag anfangen und nicht dort, wo er zuletzt geblättert
 * hat.
 */
const ui = {
  tag: heuteISO(),
  monat: monatsStart(heuteISO()),
  zeitraum: 30,
  bogen: null,      // { art, id, entwurf } – der offene Eingabebogen
  bericht: null,    // erzeugter Berichtstext, solange er angezeigt wird
  // Die Sicherung als Text, solange sie offen steht. Sie gibt es zusätzlich
  // zur Datei, weil ein Herunterladen nicht überall geht: eingebettete
  // Ansichten, der Browser in einer Messenger-App, manche Verwaltungsgeräte.
  // Dort wäre die einzige Kopie, die es je geben wird, sonst nicht erreichbar.
  sicherung: null,
  mittel: false,    // steht die ganze Mittelübersicht offen?
  // Die laufende Atemübung: { schritte, i, bisMs, uhr, wecker }. Nicht im
  // Speicher – eine Übung, die beim nächsten Öffnen weiterliefe, wäre keine.
  atem: null,
};

let toastUhr = null;
function melden(text) {
  toastEl.textContent = text;
  toastEl.classList.add('an');
  clearTimeout(toastUhr);
  toastUhr = setTimeout(() => toastEl.classList.remove('an'), 2400);
}

/* ==================== Bausteine ==================== */

const knopf = (act, text, klasse = '', extra = '') => `<button type="button" class="btn ${klasse}" data-act="${act}" ${extra}>${text}</button>`;

/** Eine Reihe an- und abwählbarer Marken. */
function marken(liste, gewaehlt, act) {
  return `<div class="marken">${liste.map((m) => `
    <button type="button" class="marke${gewaehlt.includes(m.id) ? ' an' : ''}"
            data-act="${act}" data-id="${esc(m.id)}" aria-pressed="${gewaehlt.includes(m.id)}">
      ${m.icon ? `<span class="marke-i">${m.icon}</span>` : ''}${esc(m.name)}
    </button>`).join('')}</div>`;
}

/** Die Skala von 0 bis 10. Elf Knöpfe statt eines Schiebereglers: Ein Regler
 *  trifft man auf dem Handy nicht genau, und „war es jetzt 6 oder 7" ist
 *  genau die Frage, die eine Eintragung wertlos macht. */
function skala(wert) {
  let raus = '<div class="skala" role="group" aria-label="Stärke von 0 bis 10">';
  for (let i = 0; i <= 10; i++) {
    const stufe = i === 0 ? 'null' : (i >= 7 ? 'hoch' : (i >= 4 ? 'mittel' : 'tief'));
    raus += `<button type="button" class="stufe s-${stufe}${i === wert ? ' an' : ''}"
      data-act="staerke" data-n="${i}" aria-pressed="${i === wert}"
      aria-label="Stärke ${i}: ${STAERKE_WORT[i]}">${i}</button>`;
  }
  return `${raus}</div><p class="skala-wort">${STAERKE_WORT[wert] ?? ''}</p>`;
}

/**
 * Eine Tagesfrage als Reihe von Stufen. `null` heißt: nicht beantwortet.
 *
 * Ein zweites Tippen auf dieselbe Stufe nimmt die Antwort zurück – „ich habe
 * nichts eingetragen" und „ich habe null eingetragen" müssen verschiedene
 * Dinge bleiben, sonst zählt die Auswertung Nichtwissen als Wohlbefinden.
 */
function tagesFrage(frage, wert) {
  return `<p class="feld-name">${esc(frage.name)}</p>
    <div class="vier">${frage.worte.map((w, i) => `
      <button type="button" class="vier-btn${wert === i ? ' an' : ''}"
              data-act="tagfrage" data-id="${frage.id}" data-n="${i}"
              aria-pressed="${wert === i}">${esc(w)}</button>`).join('')}</div>`;
}

/* ==================== Reiter: Tag ==================== */

const ART_NAME = {
  essen: 'Mahlzeit', beschwerde: 'Beschwerden', medikament: 'Medikament', notiz: 'Notiz',
};
const ART_ICON = { essen: '🍽️', beschwerde: '🔥', medikament: '💊', notiz: '✏️' };

function zeileText(e, eigene) {
  if (e.art === 'essen') {
    // Die Rolle steht nur dabei, wenn sie nicht die Vorgabe ist – „Kaffee
    // (Haupt)" bei jedem Kaffee wäre Lärm, „Zwiebel (Würze)" ist die Auskunft.
    const zutaten = zutatenVon(e).map((z) => ausloeserName(z.id, eigene)
      + (z.rolle === ROLLE_VORGABE ? '' : ` (${rolleName(z.rolle, true)})`)).join(', ');
    const portion = e.portion && e.portion !== 'normal' ? ` · ${e.portion === 'gross' ? 'große' : 'kleine'} Portion` : '';
    return `<b>${esc(kuerze(e.was || 'Mahlzeit'))}</b>${portion}`
      + (zutaten ? `<span class="zeile-tags">${esc(zutaten)}</span>` : '');
  }
  if (e.art === 'beschwerde') {
    const arten = (e.arten || []).map(beschwerdeName).join(', ');
    return `<b>Stärke ${e.staerke} – ${STAERKE_WORT[e.staerke] || ''}</b>`
      + (arten ? `<span class="zeile-tags">${esc(arten)}</span>` : '')
      + (e.notiz ? `<span class="zeile-tags">${esc(kuerze(e.notiz))}</span>` : '');
  }
  if (e.art === 'medikament') {
    return `<b>${esc(e.mittel || 'Medikament')}</b>`
      + (e.dosis ? `<span class="zeile-tags">${esc(e.dosis)}</span>` : '');
  }
  return `<b>${esc(kuerze(e.text || '', 90))}</b>`;
}

function tagAnsicht(s) {
  const iso = ui.tag;
  const liste = s.eintraege.filter((e) => e.am === iso);
  const t = tagesWert(s.eintraege, iso, s.tage);
  const tagInfo = store.tagLesen(iso);
  const kuenftig = tageDazwischen(heuteISO(), iso) > 0;

  const kopf = `<div class="tagkopf">
    ${knopf('tag-blaettern', '‹', 'btn-rund', 'data-d="-1" aria-label="Tag zurück"')}
    <div class="tagkopf-mitte">
      <h2>${esc(fmtTag(iso))}</h2>
      <input type="date" class="tag-datum" data-act="tag-datum" value="${iso}"
             max="${heuteISO()}" aria-label="Datum wählen">
    </div>
    ${knopf('tag-blaettern', '›', 'btn-rund', `data-d="1" ${kuenftig || iso === heuteISO() ? 'disabled' : ''} aria-label="Tag vor"`)}
  </div>`;

  const anlegen = `<div class="anlegen">
    ${['essen', 'beschwerde', 'medikament', 'notiz'].map((a) => `
      <button type="button" class="anlegen-btn a-${a}" data-act="neu" data-art="${a}">
        <span class="anlegen-i">${ART_ICON[a]}</span>${ART_NAME[a]}
      </button>`).join('')}
  </div>`;

  const zeilen = liste.length ? `<ul class="strang">${liste.map((e) => `
    <li class="strang-zeile z-${e.art}">
      <span class="strang-uhr">${esc(e.um)}</span>
      <span class="strang-punkt" aria-hidden="true">${ART_ICON[e.art]}</span>
      <button type="button" class="strang-text" data-act="bearbeiten" data-id="${e.id}">
        ${zeileText(e, s.eigeneAusloeser)}
      </button>
      <button type="button" class="strang-weg" data-act="loeschen" data-id="${e.id}"
              aria-label="Eintrag löschen">×</button>
    </li>`).join('')}</ul>`
    : `<p class="leer">Für ${esc(fmtTag(iso))} ist noch nichts eingetragen.</p>`;

  const bilanz = t.notiert ? `<div class="karte tagbilanz">
    <div class="gross ${t.wert === 0 ? 'gut' : (t.wert >= 7 ? 'schlecht' : 'mittel')}">
      ${t.wert === 0 ? 'beschwerdefrei' : `Stärke ${t.wert}`}
    </div>
    <p class="klein">${mehrzahl(t.mahlzeiten, 'Mahlzeit', 'Mahlzeiten')},
      ${mehrzahl(t.anzahl, 'Beschwerde', 'Beschwerden')}${t.medikamente ? `, ${mehrzahl(t.medikamente, 'Medikament', 'Medikamente')}` : ''}</p>
  </div>` : '';

  const fragen = sichtbareFragen(s.tagesfragen);
  const umstaende = fragen.length ? `<div class="karte">
    <h3>Wie war der Tag sonst?</h3>
    ${fragen.map((f) => tagesFrage(f, tagInfo[f.id] === undefined ? null : tagInfo[f.id])).join('')}
    <p class="klein">Welche Fragen hier stehen, wählst du unter „Mehr".</p>
  </div>` : '';

  const stand = heutigerStand(s.tage, iso);
  const zyklusZeile = stand ? `<p class="klein zyklus-zeile">
    Zyklustag ${stand.tag}${stand.phase ? ` · ${esc(phasenName(stand.phase))}` : ''}
    ${stand.laenge ? ` · deine Zyklen dauern im Mittel ${stand.laenge} Tage` : ''}
  </p>` : '';

  return kopf + bilanz + zyklusZeile + (iso === heuteISO() ? ratKarte(s) : '')
    + anlegen + zeilen + umstaende;
}

/**
 * Die Vorschläge für heute.
 *
 * Jeder trägt sein „warum" sichtbar mit sich, und woher es kommt: aus ihrem
 * eigenen Verlauf oder aus dem, was allgemein empfohlen wird. Ohne diese
 * Unterscheidung wäre beides gleich viel wert, und das ist es nicht.
 */
function ratKarte(s) {
  const letzteMahlzeit = [...s.eintraege].reverse().find((e) => e.art === 'essen');
  const mittel = new Map();
  s.eintraege.filter((e) => e.art === 'medikament').forEach((e) => {
    const name = String(e.mittel || '').trim();
    if (name) mittel.set(name, e.am);
  });

  const liste = raete({
    eintraege: s.eintraege,
    tage: s.tage,
    heute: heuteISO(),
    eigene: s.eigeneAusloeser,
    bilanz: ausloeserBilanz(s.eintraege, {
      fenster: s.fenster, mindestFaelle: s.mindestFaelle, eigene: s.eigeneAusloeser,
    }),
    faktoren: Object.fromEntries(['stress', 'schlaf', 'stimmung']
      .map((id) => [id, faktorBilanz(s.eintraege, s.tage, id, tagesWert)])),
    phasen: phasenBilanz(s.eintraege, s.tage, tagesWert),
    letzteMahlzeitStunden: letzteMahlzeit
      ? stundenSeitEssen(s.eintraege, { am: heuteISO(), um: jetztUhr() }) : null,
    mittel: [...mittel.entries()].slice(-3).map(([name, am]) => ({ name, zuletzt: fmtDatum(am) })),
  });

  if (!liste.length) return '';
  return `<div class="karte rat">
    <h3>Für heute</h3>
    <ul class="raete">${liste.map((r) => `<li class="rat-${r.bereich}">
      <div class="rat-kopf">
        <span class="rat-i" aria-hidden="true">${BEREICH_ICON[r.bereich]}</span>
        <b>${esc(r.titel)}</b>
        <span class="rat-quelle q-${r.quelle}">${r.quelle === 'eigen' ? 'aus deinem Verlauf' : 'allgemein'}</span>
      </div>
      <p>${esc(r.text)}</p>
      <p class="klein">${esc(r.warum)}</p>
    </li>`).join('')}</ul>
    <p class="klein">„Aus deinem Verlauf" heißt: aus deinen eigenen Eintragungen
    gerechnet, mit den Zahlen daneben. „Allgemein" heißt: gilt für einen
    Durchschnitt, den es nicht gibt – dein eigener Verlauf sticht das.</p>
  </div>`;
}

/* ==================== Reiter: Verlauf ==================== */

function verlaufAnsicht(s) {
  const bis = heuteISO();
  const von = plusTage(bis, -(ui.zeitraum - 1));
  const reihe = verlaufReihe(s.eintraege, von, bis, s.tage);
  const z = gesamtZahlen(s.eintraege, s.tage, von, bis);
  const serie = serieOhne(s.eintraege, s.tage, bis);

  const wahl = `<div class="wahl">${[14, 30, 90].map((n) => `
    <button type="button" class="wahl-btn${ui.zeitraum === n ? ' an' : ''}"
            data-act="zeitraum" data-n="${n}">${n} Tage</button>`).join('')}</div>`;

  const zahlen = `<div class="kacheln">
    <div class="kachel"><b>${z.notierteTage}</b><span>Tage notiert</span></div>
    <div class="kachel"><b>${z.notierteTage ? `${Math.round(z.anteil * 100)} %` : '–'}</b><span>davon mit Beschwerden</span></div>
    <div class="kachel"><b>${z.notierteTage ? fmtZahl(z.schnitt) : '–'}</b><span>Stärke im Mittel</span></div>
    <div class="kachel"><b>${serie}</b><span>${serie === 1 ? 'Tag' : 'Tage'} frei in Folge</span></div>
  </div>`;

  const tafel = z.notierteTage
    ? verlaufTafel(reihe, { titel: 'Stärkste Beschwerde je Tag', hinweis: '0 – 10' })
    : '<p class="leer">Noch keine Eintragungen in diesem Zeitraum.</p>';

  // --- Monatsraster ---
  const felder = monatsRaster(ui.monat).map((iso) => {
    const t = tagesWert(s.eintraege, iso, s.tage);
    const fremd = iso.slice(0, 7) !== ui.monat.slice(0, 7);
    const stufe = !t.notiert ? 'leer' : (t.wert === 0 ? 'gut' : (t.wert >= 7 ? 'schlecht' : (t.wert >= 4 ? 'mittel' : 'leicht')));
    return `<button type="button" class="rfeld f-${stufe}${fremd ? ' fremd' : ''}${iso === heuteISO() ? ' heute' : ''}"
      data-act="tag-waehlen" data-iso="${iso}"
      aria-label="${fmtDatum(iso, true)}: ${t.notiert ? (t.wert === 0 ? 'beschwerdefrei' : `Stärke ${t.wert}`) : 'nichts eingetragen'}">
      <span>${Number(iso.slice(8))}</span></button>`;
  }).join('');

  const raster = `<div class="karte">
    <div class="monatkopf">
      ${knopf('monat-blaettern', '‹', 'btn-rund', 'data-d="-1" aria-label="Monat zurück"')}
      <h3>${esc(fmtMonat(ui.monat))}</h3>
      ${knopf('monat-blaettern', '›', 'btn-rund', `data-d="1" ${monatsStart(heuteISO()) === ui.monat ? 'disabled' : ''} aria-label="Monat vor"`)}
    </div>
    <div class="wochekopf">${WOCHE_KOPF.map((w) => `<span>${w}</span>`).join('')}</div>
    <div class="raster">${felder}</div>
    <div class="legende">
      <span><i class="f-gut"></i> frei</span><span><i class="f-leicht"></i> 1–3</span>
      <span><i class="f-mittel"></i> 4–6</span><span><i class="f-schlecht"></i> 7–10</span>
      <span><i class="f-leer"></i> nichts eingetragen</span>
    </div>
  </div>`;

  return `${wahl}${zahlen}<div class="karte">${tafel}</div>${raster}`;
}

/* ==================== Reiter: Muster ==================== */

function musterAnsicht(s) {
  const bilanz = ausloeserBilanz(s.eintraege, {
    fenster: s.fenster,
    mindestFaelle: s.mindestFaelle,
    eigene: s.eigeneAusloeser,
  });
  const mahlzeiten = s.eintraege.filter((e) => e.art === 'essen').length;

  const erklaerung = `<div class="karte hinweis">
    <h3>Wie das gelesen wird</h3>
    <p>Verglichen wird die mittlere Beschwerdestärke in den
    <b>${s.fenster} Stunden</b> nach Mahlzeiten <b>mit</b> einem Merkmal gegen
    alle übrigen Mahlzeiten. Eine Zeile erscheint erst ab
    ${s.mindestFaelle} Fällen auf beiden Seiten.</p>
    <p class="klein">Das ist eine Häufigkeit, keine Ursache. Wer an einem
    schlechten Tag ohnehin anders isst, findet sich hier wieder, ohne dass das
    Essen schuld wäre. Der Zettel ist für das Gespräch in der Praxis gedacht,
    nicht als Ersatz dafür.</p>
  </div>`;

  // Warnzeichen und Einordnung stehen *vor* dieser Abkürzung: Wer Beschwerden
  // einträgt, aber keine Mahlzeiten, hat trotzdem ein Tagebuch – und wenn
  // darin ein Warnzeichen steht, ist das Fehlen von Mahlzeiten der falsche
  // Grund, es nicht anzuzeigen. Genau das war es einmal.
  if (!mahlzeiten) {
    return `${bildTeil(s)}<p class="leer">Noch keine Mahlzeit eingetragen. Sobald ein paar
      Tage beisammen sind, steht hier, was auffällt.</p>${zyklusTeil(s)}${erklaerung}`;
  }

  const fertig = bilanz.filter((b) => b.genug);
  const offen = bilanz.filter((b) => !b.genug);

  const zeile = (b) => {
    const art = einstufung(b);
    // Die Aufschlüsselung nach Rolle nur, wenn es überhaupt etwas zu
    // unterscheiden gibt: Bei einer einzigen Rolle wiederholte sie die
    // Hauptzahl mit anderen Worten.
    const rollen = rollenBilanz(s.eintraege, b.id, s.fenster);
    const nachRolle = rollen.length > 1 ? `<ul class="rollen">${rollen.map((r) => `<li>
      <span>als ${esc(rolleName(r.rolle))}</span>
      <span class="klein">${mehrzahl(r.faelle, 'Mal', 'Mal')}, danach ${fmtZahl(r.schnitt)}</span>
    </li>`).join('')}</ul>` : '';
    return `<li class="fund f-${art}">
      <div class="fund-kopf">
        <b>${esc(ausloeserName(b.id, s.eigeneAusloeser))}</b>
        <span class="fund-urteil">${EINSTUFUNG_WORT[art]}</span>
      </div>
      ${vergleichBalken(b.schnittMit, b.schnittOhne)}
      <p class="klein">${mehrzahl(b.faelle, 'Mahlzeit', 'Mahlzeiten')} damit,
        ${b.gegenFaelle} ohne · danach ${Math.round(b.quoteMit * 100)} % mit
        Beschwerden, sonst ${Math.round(b.quoteOhne * 100)} %</p>
      ${nachRolle}
    </li>`;
  };

  const gefunden = fertig.length
    ? `<ul class="funde">${fertig.map(zeile).join('')}</ul>`
    : `<p class="leer">Noch reicht es für keine Aussage. Nach
       ${mehrzahl(mahlzeiten, 'Mahlzeit', 'Mahlzeiten')} braucht es je Merkmal
       ${s.mindestFaelle} Fälle mit und ${s.mindestFaelle} ohne.</p>`;

  const wartet = offen.length ? `<div class="karte zaehlt">
    <h3>Zählt noch</h3>
    <ul class="wartend">${offen.slice(0, 12).map((b) => `<li>
      <span>${esc(ausloeserName(b.id, s.eigeneAusloeser))}</span>
      <span class="klein">${b.faelle} von ${s.mindestFaelle}</span>
    </li>`).join('')}</ul>
  </div>` : '';

  const zeiten = nachTageszeit(s.eintraege);
  const wann = zeiten.length ? `<div class="karte">
    <h3>Wann es auftritt</h3>
    <ul class="wartend">${zeiten.map((t) => `<li>
      <span>${t.name}</span>
      <span class="klein">${mehrzahl(t.anzahl, 'Mal', 'Mal')}, im Mittel ${fmtZahl(t.schnitt)}</span>
    </li>`).join('')}</ul>
  </div>` : '';

  const arten = nachArt(s.eintraege);
  const wie = arten.length ? `<div class="karte">
    <h3>Womit es sich meldet</h3>
    <ul class="wartend">${arten.map((a) => `<li>
      <span>${esc(beschwerdeName(a.id))}</span>
      <span class="klein">${mehrzahl(a.anzahl, 'Mal', 'Mal')}</span>
    </li>`).join('')}</ul>
  </div>` : '';

  return bildTeil(s) + gefunden + wartet + wann + wie + zyklusTeil(s) + erklaerung;
}

/* ==================== Reiter: Ruhe ==================== */

function ruheAnsicht(s) {
  const u = uebungVon(s.atemUebung);
  const runden = s.atemRunden || u.runden;
  const laeuft = !!ui.atem;

  // Während die Übung läuft, steht auf dem Bildschirm nichts als der Kreis und
  // der Abbruchknopf: Wer die Augen zumacht, braucht keine Auswahl, und wer sie
  // aufmacht, soll nicht auf Einstellungen schauen.
  const wahl = `<div class="karte">
    <h3>Übung</h3>
    <div class="wahl">${UEBUNGEN.map((x) => `
      <button type="button" class="wahl-btn${x.id === u.id ? ' an' : ''}"
              data-act="atem-uebung" data-id="${x.id}">${esc(x.name)}</button>`).join('')}</div>
    <p class="feld-name">${esc(u.zweck)}</p>
    <p class="klein">${esc(u.beschreibung)}</p>
    <p class="feld-name">Runden – etwa ${dauerText(gesamtDauer(u, runden))}</p>
    <div class="wahl">${[2, 4, 6, 8, 10, 15].map((n) => `
      <button type="button" class="wahl-btn${runden === n ? ' an' : ''}"
              data-act="atem-runden" data-n="${n}">${n}</button>`).join('')}</div>
  </div>`;

  const kreis = `<div class="atem${laeuft ? ' laeuft' : ''}">
    <div class="atem-kreis" id="atemKreis"><span id="atemZahl">${laeuft ? '' : '·'}</span></div>
    <p class="atem-wort" id="atemWort">${laeuft ? '' : 'Bereit, wenn du bist'}</p>
    <p class="klein" id="atemRunde">${laeuft ? '' : `${runden} Runden, ${esc(u.name)}`}</p>
  </div>`;

  return `
  <h2>Ruhe</h2>
  <p class="klein">Langes Ausatmen schaltet auf den Teil des Nervensystems um,
  unter dem der Darm arbeitet statt stillzustehen. Bei Beschwerden, die an
  Anspannung hängen, ist das eine Behandlung und keine Beschäftigung.</p>

  ${kreis}

  <div class="karte">
    <div class="reihe">
      ${laeuft
    ? knopf('atem-stopp', 'Abbrechen', 'btn-block')
    : knopf('atem-start', 'Anfangen', 'btn-primary btn-block')}
    </div>
    <p class="klein" style="margin-top:10px">Der Ton sagt dir, was dran ist:
    aufwärts einatmen, ein kurzer Ton halten, abwärts ausatmen. Damit kannst du
    die Augen zumachen und das Handy weglegen.
    ${s.ton ? '' : '<b>Der Ton ist gerade aus – unter „Mehr" wieder an.</b>'}</p>
  </div>

  ${laeuft ? '' : wahl}`;
}

/* ---------- Der Ablauf ---------- */

function atemZeigen(schritt, restSek) {
  const zahl = document.getElementById('atemZahl');
  const wort = document.getElementById('atemWort');
  const runde = document.getElementById('atemRunde');
  const kreis = document.getElementById('atemKreis');
  if (!zahl || !kreis) return;
  zahl.textContent = String(Math.max(1, Math.ceil(restSek)));
  wort.textContent = schritt.wort;
  runde.textContent = `Runde ${schritt.runde} von ${schritt.von}`;
  // Der Kreis wächst über die Dauer der Phase mit. Beim Halten bleibt er,
  // wo er ist – deshalb wird die Größe nur bei ein und aus gesetzt.
  kreis.style.transitionDuration = `${schritt.sek}s`;
  if (schritt.art === 'ein') kreis.style.transform = 'scale(1)';
  else if (schritt.art === 'aus') kreis.style.transform = 'scale(0.45)';
  kreis.dataset.art = schritt.art;
}

function atemSchritt() {
  const a = ui.atem;
  if (!a) return;
  if (a.i >= a.schritte.length) { atemFertig(); return; }
  const schritt = a.schritte[a.i];
  a.bisMs = Date.now() + schritt.sek * 1000;
  if (a.ton) {
    if (schritt.art === 'ein') KLAENGE.ein();
    else if (schritt.art === 'aus') KLAENGE.aus();
    else KLAENGE.halten();
  }
  ruettel(schritt.art === 'halten' ? 30 : 60);
  atemZeigen(schritt, schritt.sek);
  a.wecker = setTimeout(() => { a.i += 1; atemSchritt(); }, schritt.sek * 1000);
}

function atemFertig() {
  const a = ui.atem;
  if (a && a.ton) KLAENGE.fertig();
  ruettel([60, 80, 60]);
  atemStopp();
  melden('Geschafft.');
}

function atemStart(s) {
  const u = uebungVon(s.atemUebung);
  const runden = s.atemRunden || u.runden;
  // Der Tonkontext darf erst hier entstehen: Browser lassen Audio nur nach
  // einer Nutzergeste zu, und "Anfangen" ist diese Geste.
  const ton = s.ton !== false && weckKlang();
  ui.atem = { schritte: ablauf(u, runden), i: 0, ton, wecker: null, uhr: null };
  zeichne();
  // Erst zeichnen, dann anfangen – sonst greift der erste Schritt auf Elemente
  // zu, die es noch nicht gibt.
  queueMicrotask(() => {
    if (!ui.atem) return;
    ui.atem.uhr = setInterval(() => {
      const a = ui.atem;
      if (!a || a.i >= a.schritte.length) return;
      atemZeigen(a.schritte[a.i], (a.bisMs - Date.now()) / 1000);
    }, 200);
    atemSchritt();
  });
}

function atemStopp() {
  if (!ui.atem) return;
  clearTimeout(ui.atem.wecker);
  clearInterval(ui.atem.uhr);
  ui.atem = null;
  zeichne();
}

/* ==================== Reiter: Ideen ==================== */

/** Die Ideen als Text – zum Kopieren oder Weitergeben. */
function ideenText(s) {
  const zeile = (i) => `${i.erledigt ? '[erledigt] ' : ''}${i.text}`;
  return ['Bauchbuch – Ideen und Verbesserungsvorschläge', '']
    .concat(s.ideen.map(zeile)).join('\n');
}

function ideenAnsicht(s) {
  const offen = s.ideen.filter((i) => !i.erledigt);
  const fertig = s.ideen.filter((i) => i.erledigt);

  const zeile = (i) => `<li class="idee${i.erledigt ? ' ab' : ''}">
    <button type="button" class="idee-haken" data-act="idee-haken" data-id="${i.id}"
            aria-pressed="${i.erledigt}"
            aria-label="${i.erledigt ? 'Wieder offen' : 'Als erledigt merken'}">
      ${i.erledigt ? '✓' : ''}</button>
    <span class="idee-text">${esc(i.text)}<span class="zeile-tags">${esc(fmtDatum(i.am))}</span></span>
    <button type="button" class="strang-weg" data-act="idee-weg" data-id="${i.id}"
            aria-label="Idee löschen">×</button>
  </li>`;

  return `
  <h2>Ideen fürs Bauchbuch</h2>
  <p class="klein">Was fehlt, was stört, was du anders hättest. Alles, was hier
  steht, bleibt wie der Rest auf diesem Gerät – zum Weitergeben gibt es unten
  „Kopieren".</p>

  <div class="karte">
    <label class="feld-name" for="ideeText">Neue Idee</label>
    <textarea class="feld feld-breit" id="ideeText" rows="3"
              placeholder="Ich hätte gern …"></textarea>
    <div class="reihe" style="margin-top:8px">
      ${knopf('idee-neu', 'Eintragen', 'btn-primary')}
    </div>
  </div>

  ${s.ideen.length ? `
    <ul class="ideen">${offen.map(zeile).join('')}${fertig.map(zeile).join('')}</ul>
    <div class="karte">
      <p class="klein">${mehrzahl(offen.length, 'offene Idee', 'offene Ideen')}${fertig.length ? `, ${fertig.length} erledigt` : ''}.
      Zum Weiterschicken: kopieren und in eine Nachricht einfügen.</p>
      <div class="reihe">
        ${knopf('ideen-kopieren', 'Alle kopieren', 'btn-primary')}
        ${knopf('ideen-teilen', 'Teilen')}
      </div>
    </div>`
    : '<p class="leer">Noch keine Idee eingetragen.</p>'}`;
}

/**
 * Warnzeichen und die Einordnung – das, was am nächsten an eine Diagnose
 * herankommt, ohne eine zu sein.
 */
function bildTeil(s) {
  const b = bildLesen({
    eintraege: s.eintraege,
    tage: s.tage,
    bilanz: ausloeserBilanz(s.eintraege, {
      fenster: s.fenster, mindestFaelle: s.mindestFaelle, eigene: s.eigeneAusloeser,
    }),
    name: (id) => ausloeserName(id, s.eigeneAusloeser),
    istNsar: (name) => {
      const g = wissenZu(name);
      return !!g && g.id === 'nsar';
    },
  });

  // Warnzeichen stehen vor allem anderen und ohne Statistik daneben.
  const warn = b.warnungen.length ? `<div class="karte karte-warn">
    <h3>${b.warnungen.some((w) => w.dringlichkeit === 'sofort')
    ? 'Das gehört heute abgeklärt' : 'Das gehört zeitnah abgeklärt'}</h3>
    <ul class="warnliste">${b.warnungen.map((w) => `<li class="w-${w.dringlichkeit}">
      <b>${esc(w.name)}</b>
      <span class="zeile-tags">${esc(w.warum)}</span>
      <span class="klein">${mehrzahl(w.anzahl, 'Mal', 'Mal')} eingetragen,
        zuletzt ${esc(fmtDatum(w.zuletzt, true))}</span>
    </li>`).join('')}</ul>
    <p class="klein">Bei Blut, schwarzem Stuhl oder Schmerz mit Ausstrahlung in
    Arm oder Kiefer nicht auf einen Termin warten – Notaufnahme oder 112.</p>
  </div>` : '';

  if (!b.muster.length) {
    return warn + (genugFuerBild(b.basis) ? '' : `<div class="karte">
      <h3>Einordnung</h3>
      <p class="klein">Für eine Einordnung fehlt noch Material:
      ${b.basis.notierteTage} notierte Tage und ${b.basis.beschwerden} Eintragungen
      zu Beschwerden. Ab etwa zehn Tagen und fünf Eintragungen steht hier, wonach
      das Bild aussieht.</p>
    </div>`);
  }

  const kasten = (m, i) => `<li class="muster${i === 0 ? ' erst' : ''}">
    <div class="muster-kopf">
      <b>${esc(m.name)}</b>
      ${i === 0 ? '<span class="fund-urteil">passt am ehesten</span>' : ''}
    </div>
    <p>${esc(m.satz)}</p>
    <p class="feld-name">Woran das zu sehen ist</p>
    <ul class="belege">${m.belege.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
    <p class="feld-name">Was dahinterstecken kann – und was es unterscheidet</p>
    <ul class="ursachen">${m.ursachen.map((u) => `<li>
      <b>${esc(u.name)}</b><span class="zeile-tags">${esc(u.klaerung)}</span>
    </li>`).join('')}</ul>
  </li>`;

  return `${warn}<div class="karte">
    <h3>Einordnung</h3>
    <p class="klein">Das hier ist <b>keine Diagnose</b>, und zwar nicht aus
    Vorsicht, sondern weil es keine sein kann: Gastritis, Magengeschwür,
    Reflux, funktionelle Dyspepsie und ein Reizdarm sehen im Tagebuch teils
    gleich aus. Auseinander hält sie eine Untersuchung. Was hier steht, ist die
    Beschreibung deines Musters in den Worten, die in einer Praxis benutzt
    werden – damit das Gespräch dort nicht bei null anfängt.</p>
    <ul class="muster-liste">${b.muster.slice(0, 3).map(kasten).join('')}</ul>
    <p class="klein">Grundlage: ${b.basis.notierteTage} notierte Tage,
      ${b.basis.beschwerden} Eintragungen zu Beschwerden, davon
      ${b.basis.zuordenbar} einer Mahlzeit zuzuordnen.</p>
  </div>
  ${b.fragen.length ? `<div class="karte">
    <h3>Fragen für den nächsten Termin</h3>
    <ul class="fragen">${b.fragen.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>
    <p class="klein">Stehen auch im Bericht unter „Mehr".</p>
  </div>` : ''}`;
}

/** Der Zyklus, wenn genug davon eingetragen wurde. */
function zyklusTeil(s) {
  const phasen = phasenBilanz(s.eintraege, s.tage, tagesWert);
  if (!phasen.length) return '';
  const laenge = mittlereLaenge(s.tage);
  const spanne = schwankung(s.tage);
  return `<div class="karte">
    <h3>Nach Zyklusphase</h3>
    <ul class="wartend">${phasen.map((p) => `<li>
      <span>${esc(p.name)}</span>
      <span class="klein">${mehrzahl(p.tage, 'Tag', 'Tage')}, im Mittel ${fmtZahl(p.schnitt)}</span>
    </li>`).join('')}</ul>
    <p class="klein">
      ${laenge ? `Deine Zyklen dauern im Mittel ${laenge} Tage${spanne ? ` (${spanne.von} bis ${spanne.bis}, aus ${spanne.anzahl} Zyklen)` : ''}. ` : ''}
      ${belastbar(s.tage) ? '' : 'Noch keine zwei abgeschlossenen Zyklen – die Zahlen stehen da, aber es folgt noch nichts daraus. '}
      Die Phasen sind geschätzt: Die Periode kommt aus deinen Eintragungen, die
      Mitte aus der halben Zykluslänge. <b>Nicht zur Verhütung geeignet</b> –
      der Eisprung wird hier nicht gemessen.</p>
  </div>`;
}

/* ==================== Reiter: Mehr ==================== */

function mehrAnsicht(s) {
  const gesichert = s.lastBackup
    ? `zuletzt am ${fmtDatum(s.lastBackup.on, true)} mit ${mehrzahl(s.lastBackup.anzahl, 'Eintrag', 'Einträgen')}`
    : 'noch nie';
  const alt = s.lastBackup ? tageDazwischen(s.lastBackup.on, heuteISO()) : 999;

  const bericht = ui.bericht ? `<div class="karte">
    <h3>Bericht</h3>
    <textarea class="bericht" readonly rows="16">${esc(ui.bericht)}</textarea>
    <div class="reihe">
      ${knopf('bericht-kopieren', 'Kopieren', 'btn-primary')}
      ${knopf('bericht-laden', 'Als Datei')}
      ${knopf('bericht-zu', 'Schließen', 'btn-ghost')}
    </div>
  </div>` : '';

  return `
  <div class="karte">
    <h3>Sicherung</h3>
    <p class="klein">Alles steht ausschließlich in diesem Browser. Wird der
    Speicher der Website gelöscht, ist das Tagebuch weg – eine andere Kopie
    gibt es nirgends. Die Sicherung ist eine gewöhnliche JSON-Datei.</p>
    <p class="klein ${alt > 30 ? 'warnend' : ''}">Gesichert: ${gesichert}</p>
    <div class="reihe">
      ${knopf('export', 'Als Datei sichern', 'btn-primary')}
      ${knopf('sicherung-text', 'Als Text')}
      ${knopf('import', 'Einlesen')}
    </div>
    ${ui.sicherung ? `
      <p class="klein" style="margin-top:10px">Alles markieren und in eine
      Notiz oder eine Mail an sich selbst kopieren. Zum Zurückholen denselben
      Text als <code>.json</code> speichern und über „Einlesen" wählen.</p>
      <textarea class="bericht" readonly rows="10">${esc(ui.sicherung)}</textarea>
      <div class="reihe">
        ${knopf('sicherung-kopieren', 'Kopieren', 'btn-primary')}
        ${knopf('sicherung-zu', 'Schließen', 'btn-ghost')}
      </div>` : ''}
  </div>

  ${mittelKarte(s)}

  <div class="karte">
    <h3>Für den Arzttermin</h3>
    <p class="klein">Ein Blatt Text mit Zeitraum, Häufigkeit, Tageszeiten und
    dem, was auffällt. Zum Kopieren oder Ausdrucken.</p>
    <div class="reihe">
      ${knopf('bericht', 'Letzte 30 Tage', 'btn-primary', 'data-n="30"')}
      ${knopf('bericht', '90 Tage', '', 'data-n="90"')}
    </div>
  </div>
  ${bericht}

  <div class="karte">
    <h3>Auswertung</h3>
    <p class="feld-name">Beschwerden zählen bis <b>${s.fenster} Stunden</b> nach dem Essen</p>
    <div class="wahl">${[2, 3, 4, 6, 8].map((n) => `
      <button type="button" class="wahl-btn${s.fenster === n ? ' an' : ''}"
              data-act="fenster" data-n="${n}">${n} h</button>`).join('')}</div>
    <p class="feld-name">Erst ab <b>${s.mindestFaelle}</b> Fällen etwas sagen</p>
    <div class="wahl">${[3, 5, 8, 12].map((n) => `
      <button type="button" class="wahl-btn${s.mindestFaelle === n ? ' an' : ''}"
              data-act="mindest" data-n="${n}">${n}</button>`).join('')}</div>
  </div>

  <div class="karte">
    <h3>Eigene Auslöser</h3>
    <p class="klein">Was in der Liste fehlt – ein bestimmtes Gericht, ein
    Getränk, ein Medikament, das man nicht als Medikament einträgt.</p>
    ${s.eigeneAusloeser.length ? `<ul class="wartend">${s.eigeneAusloeser.map((a) => `<li>
      <span>${esc(a.name)}</span>
      <button type="button" class="strang-weg" data-act="ausloeser-weg" data-id="${esc(a.id)}"
              aria-label="Auslöser entfernen">×</button>
    </li>`).join('')}</ul>` : '<p class="klein">Noch keine.</p>'}
    <div class="reihe">
      <input type="text" class="feld" id="neuerAusloeser" placeholder="z. B. Rotwein"
             aria-label="Name des eigenen Auslösers">
      ${knopf('ausloeser-neu', 'Hinzufügen')}
    </div>
  </div>

  <div class="karte">
    <h3>Welche Fragen stellt der Tag?</h3>
    <p class="klein">Nicht jede Frage will jeder beantworten. Was hier aus ist,
    erscheint nicht in der Tagesansicht – schon Eingetragenes bleibt erhalten
    und wird weiter mitgerechnet.</p>
    ${marken(TAGESFRAGEN, s.tagesfragen || [], 'frageAn')}
  </div>

  <div class="karte">
    <h3>Ton</h3>
    <p class="klein">Nur für die Atemübung unter „Ruhe". Sonst gibt diese App
    keinen Laut von sich.</p>
    <div class="wahl">
      <button type="button" class="wahl-btn${s.ton !== false ? ' an' : ''}" data-act="ton">
        ${s.ton !== false ? 'Ton ist an' : 'Ton ist aus'}</button>
    </div>
  </div>

  <div class="karte">
    <h3>Farbe</h3>
    <div class="wahl">${THEMEN.map((t) => `
      <button type="button" class="wahl-btn${s.theme === t.id ? ' an' : ''}"
              data-act="theme" data-id="${t.id}">${t.name}</button>`).join('')}</div>
  </div>

  <div class="karte">
    <h3>Was diese App nicht tut</h3>
    <p class="klein">Sie schickt nichts. Es gibt keinen Server, kein Konto,
    keine Anmeldung und keine Zählung von Aufrufen. Alles bleibt auf diesem
    Gerät. Sie stellt auch keine Diagnose und ersetzt keine ärztliche
    Beratung – sie zählt nur mit, was eingetragen wird.</p>
  </div>

  <div class="karte">
    <h3>Alles löschen</h3>
    <p class="klein">Entfernt jede Eintragung aus diesem Browser. Nicht
    rückgängig zu machen.</p>
    ${knopf('alles-weg', 'Tagebuch löschen', 'btn-danger')}
  </div>`;
}

/* ---------- Was die Mittel bewirken ---------- */

function mittelKarte(s) {
  // Was tatsächlich eingetragen wurde – das steht oben, alles andere darunter.
  const eigene = new Map();
  s.eintraege.filter((e) => e.art === 'medikament').forEach((e) => {
    const name = String(e.mittel || '').trim();
    if (!name) return;
    const v = eigene.get(name) || { name, anzahl: 0, zuletzt: e.am };
    v.anzahl += 1;
    if (e.am > v.zuletzt) v.zuletzt = e.am;
    eigene.set(name, v);
  });
  const meine = [...eigene.values()].sort((a, b) => b.anzahl - a.anzahl);

  const block = (g) => `<details class="mittel">
    <summary><b>${esc(g.gruppe)}</b>${g.kuerzel ? ` <span class="klein">(${esc(g.kuerzel)})</span>` : ''}
      <span class="zeile-tags">${esc(g.kurz)}</span></summary>
    <p><b>Wie es wirkt.</b> ${esc(g.wirkung)}</p>
    ${g.einnahme && g.einnahme !== '–' ? `<p><b>Wann man es nimmt.</b> ${esc(g.einnahme)}</p>` : ''}
    <p><b>Worauf zu achten ist.</b> ${esc(g.hinweis)}</p>
    <p class="klein">Zum Beispiel: ${esc(g.beispiele.join(', '))}</p>
  </details>`;

  return `<div class="karte">
    <h3>Was die Mittel bewirken</h3>
    <p class="klein">Allgemeine Information, keine Beratung – und ausdrücklich
    keine Dosierungen. Was für dich gilt, steht auf deiner Packung und sagt dir
    deine Ärztin oder deine Apotheke.</p>

    ${meine.length ? `<p class="feld-name">Was du eingetragen hast</p>
      <ul class="wartend">${meine.map((m) => {
        const g = wissenZu(m.name);
        return `<li>
          <span>${esc(m.name)}<span class="zeile-tags">${g ? esc(g.kurz) : 'nicht in der Übersicht – frag in der Apotheke nach'}</span></span>
          <span class="klein">${mehrzahl(m.anzahl, 'Mal', 'Mal')}</span>
        </li>`;
      }).join('')}</ul>`
    : '<p class="klein">Sobald du ein Medikament einträgst, steht es hier mit dem, was es bewirkt.</p>'}

    <div class="reihe" style="margin-top:10px">
      ${knopf('mittel', ui.mittel ? 'Übersicht schließen' : 'Alle Mittel im Überblick')}
    </div>

    ${ui.mittel ? `
      <div class="mittel-liste">
        ${MITTEL_WISSEN.map(block).join('')}
        <p class="feld-name">Was den Magen von der anderen Seite belastet</p>
        ${REIZSTOFFE.map(block).join('')}
      </div>` : ''}
  </div>`;
}

/* ==================== Eingabebogen ==================== */

function bogenHTML(s) {
  const b = ui.bogen;
  if (!b) return '';
  const e = b.entwurf;
  const kopf = `<div class="bogen-kopf">
    <h2>${ART_ICON[b.art]} ${ART_NAME[b.art]}</h2>
    <button type="button" class="bogen-zu" data-act="bogen-zu" aria-label="Schließen">×</button>
  </div>`;

  const zeit = `<div class="reihe reihe-zeit">
    <label class="feld-name" for="bogenUhr">Uhrzeit</label>
    <input type="time" class="feld" id="bogenUhr" data-act="uhr" value="${esc(e.um)}">
    <label class="feld-name" for="bogenTag">am</label>
    <input type="date" class="feld" id="bogenTag" data-act="bogen-datum" value="${e.am}" max="${heuteISO()}">
  </div>`;

  let mitte = '';
  if (b.art === 'essen') {
    const eigene = s.eigeneAusloeser.map((a) => ({ ...a, icon: '•' }));
    /*
     * Die Auswahl steht nach Häufigkeit, das Meistbenutzte oben.
     *
     * Sechzehn Marken plus eigene sind zu viele zum Suchen, und gesucht wird
     * jeden Tag mehrmals. Bei gleicher Häufigkeit bleibt die Reihenfolge des
     * Katalogs – sonst springt die Liste bei jedem Eintrag neu, und man greift
     * ins Leere, weil die Hand sich die Stelle gemerkt hat.
     */
    const zaehler = haeufigeZutaten(s.eintraege);
    const nachHaeufigkeit = [...AUSLOESER, ...eigene]
      .map((m, i) => ({ m, i, n: zaehler.get(m.id) || 0 }))
      .sort((x, y) => (y.n - x.n) || (x.i - y.i))
      .map((x) => x.m);

    const gewaehlt = (e.zutaten || []).map((z) => z.id);
    const gerichte = haeufigeGerichte(s.eintraege, 6);

    const zutatZeile = (z) => `<div class="zutat">
      <span class="zutat-name">${esc(ausloeserName(z.id, s.eigeneAusloeser))}</span>
      <select class="feld zutat-rolle" data-act="rolle" data-id="${esc(z.id)}"
              aria-label="Rolle von ${esc(ausloeserName(z.id, s.eigeneAusloeser))}">
        ${ROLLEN.map((r) => `<option value="${r.id}"${z.rolle === r.id ? ' selected' : ''}>${esc(r.name)}</option>`).join('')}
      </select>
    </div>`;

    mitte = `
      <label class="feld-name" for="bogenWas">Was?</label>
      <input type="text" class="feld feld-breit" id="bogenWas" data-act="was"
             value="${esc(e.was || '')}" placeholder="Haferbrei mit Banane" autocomplete="off">
      ${gerichte.length ? `<div class="marken marken-eng">${gerichte.map((g) => `
        <button type="button" class="marke" data-act="gericht" data-text="${esc(g.text)}">
          ${esc(kuerze(g.text, 28))}</button>`).join('')}</div>` : ''}

      <p class="feld-name">Portion</p>
      <div class="wahl">${PORTIONEN.map((p) => `
        <button type="button" class="wahl-btn${e.portion === p.id ? ' an' : ''}"
                data-act="portion" data-id="${p.id}">${p.name}</button>`).join('')}</div>

      <p class="feld-name">Was war drin?</p>
      ${marken(nachHaeufigkeit, gewaehlt, 'zutat')}

      ${e.zutaten && e.zutaten.length ? `
        <p class="feld-name">Wie viel davon? Keine Gramm – die Rolle genügt.</p>
        <div class="zutaten">${e.zutaten.map(zutatZeile).join('')}</div>` : ''}`;
  } else if (b.art === 'beschwerde') {
    mitte = `
      <p class="feld-name">Wie stark?</p>
      ${skala(e.staerke)}
      <p class="feld-name">Wie fühlt es sich an?</p>
      ${marken(BESCHWERDEN, e.arten || [], 'beschwerdeart')}
      <label class="feld-name" for="bogenNotiz">Notiz</label>
      <input type="text" class="feld feld-breit" id="bogenNotiz" data-act="notiz"
             value="${esc(e.notiz || '')}" placeholder="optional" autocomplete="off">
      <details class="warnbogen"${(e.warnzeichen || []).length ? ' open' : ''}>
        <summary>War etwas davon dabei?</summary>
        <p class="klein">Selten, aber wichtig. Was hier angekreuzt wird, taucht
        nicht in der Statistik auf, sondern ganz oben unter „Muster" – mit dem
        Hinweis, wie eilig es ist.</p>
        ${marken(WARNZEICHEN, e.warnzeichen || [], 'warnzeichen')}
      </details>`;
  } else if (b.art === 'medikament') {
    const vorschlaege = [...new Set([...s.zuletztMittel, ...MITTEL_VORSCHLAEGE])].slice(0, 8);
    mitte = `
      <label class="feld-name" for="bogenMittel">Mittel</label>
      <input type="text" class="feld feld-breit" id="bogenMittel" data-act="mittel"
             value="${esc(e.mittel || '')}" placeholder="Name" autocomplete="off">
      <div class="marken">${vorschlaege.map((m) => `
        <button type="button" class="marke${e.mittel === m ? ' an' : ''}"
                data-act="mittel-vorschlag" data-id="${esc(m)}">${esc(m)}</button>`).join('')}</div>
      ${(() => {
        const g = wissenZu(e.mittel);
        return g ? `<p class="klein mittel-hinweis">${esc(g.gruppe)}: ${esc(g.kurz)}
          <br>Ausführlich unter „Mehr".</p>` : '';
      })()}
      <label class="feld-name" for="bogenDosis">Dosis</label>
      <input type="text" class="feld feld-breit" id="bogenDosis" data-act="dosis"
             value="${esc(e.dosis || '')}" placeholder="z. B. 20 mg" autocomplete="off">`;
  } else {
    mitte = `
      <label class="feld-name" for="bogenText">Notiz</label>
      <textarea class="feld feld-breit" id="bogenText" data-act="text" rows="4"
                placeholder="Was sonst noch war">${esc(e.text || '')}</textarea>`;
  }

  return `<div class="bogen-hg" data-act="bogen-zu"></div>
    <div class="bogen" role="dialog" aria-modal="true" aria-label="${ART_NAME[b.art]} eintragen">
      ${kopf}
      <div class="bogen-inhalt">${zeit}${mitte}</div>
      <div class="bogen-fuss">
        ${knopf('bogen-speichern', b.id ? 'Ändern' : 'Eintragen', 'btn-primary btn-block')}
      </div>
    </div>`;
}

/* ==================== Willkommen ==================== */

function willkommen() {
  return `<div class="willkommen">
    <h2>Bauchbuch</h2>
    <p>Ein Tagebuch für den Magen: was gegessen wurde, wann es zwickt, was
    hilft. Nach ein paar Wochen zeigt es, was zusammenfällt – und macht daraus
    einen Zettel für den nächsten Arzttermin.</p>
    <ul class="punkte">
      <li><b>Bleibt hier.</b> Kein Konto, kein Server, keine Übertragung.
        Alles liegt im Speicher dieses Browsers.</li>
      <li><b>Läuft ohne Netz.</b> Einmal geöffnet, funktioniert die App auch
        im Flugzeug und im Keller.</li>
      <li><b>Sichern nicht vergessen.</b> Was nur in einem Browser liegt, ist
        mit dem Browser weg. Unter „Mehr" gibt es eine Sicherungsdatei.</li>
    </ul>
    <p class="klein">Die App zählt mit, sie diagnostiziert nicht. Was sie
    „auffällig" nennt, ist eine Häufigkeit – die Einordnung gehört in die
    Praxis.</p>
    ${knopf('los', 'Anfangen', 'btn-primary btn-block')}
  </div>`;
}

/* ==================== Zeichnen ==================== */

function male() {
  const s = store.zustandLesen();
  document.documentElement.dataset.theme = s.theme || 'rosa';

  if (!s.begruesst) {
    viewEl.innerHTML = willkommen();
    tabbarEl.hidden = true;
    return;
  }
  tabbarEl.hidden = false;

  const warnung = !store.kannSpeichern() ? `<div class="karte warn">
    <h3>${store.speicherGrund() === 'voll' ? 'Der Speicher ist voll' : 'Es kann nicht gespeichert werden'}</h3>
    <p class="klein">${store.speicherGrund() === 'voll'
    ? 'Neue Eintragungen kommen nicht mehr dazu. Jetzt unter „Mehr" sichern, danach ältere Einträge löschen.'
    : 'Dieser Browser lässt keine Website-Daten zu – ein privates Fenster oder eine eingebettete Ansicht. Alles Eingetragene ist nach dem Schließen weg.'}</p>
  </div>` : '';

  const tab = REITER.some((r) => r.id === s.tab) ? s.tab : 'heute';
  const inhalt = {
    heute: tagAnsicht, verlauf: verlaufAnsicht, muster: musterAnsicht,
    ruhe: ruheAnsicht, ideen: ideenAnsicht, mehr: mehrAnsicht,
  }[tab];
  viewEl.innerHTML = warnung + inhalt(s) + bogenHTML(s);

  tabbarEl.innerHTML = REITER.map((r) => `
    <button type="button" class="tab${r.id === tab ? ' an' : ''}" id="tab-${r.id}"
            data-act="tab" data-tab="${r.id}" role="tab" aria-selected="${r.id === tab}"
            aria-controls="view"><span class="ti">${r.icon}</span><span>${r.name}</span></button>`).join('');

  // Der Bogen soll benutzbar sein, ohne dass die Seite dahinter mitscrollt.
  document.body.classList.toggle('bogen-auf', !!ui.bogen);
}

/*
 * Neu zeichnen, aber höchstens einmal je Durchlauf.
 *
 * Eine Aktion ändert oft beides: den Speicher und den flüchtigen Zustand hier.
 * Der Speicher meldet sich von selbst (store.horche), die Aktion zeichnet
 * danach ihre eigene Änderung – das wären zwei Durchgänge und ein sichtbares
 * Flackern. Die Sammelstelle hier macht daraus einen.
 */
let gemeldet = false;
function zeichne() {
  if (gemeldet) return;
  gemeldet = true;
  queueMicrotask(() => { gemeldet = false; male(); });
}

/* ==================== Eingaben ==================== */

function bogenOeffnen(art, id) {
  const vorlage = {
    essen: { was: '', zutaten: [], portion: 'normal' },
    beschwerde: { staerke: 4, arten: [], notiz: '' },
    medikament: { mittel: '', dosis: '' },
    notiz: { text: '' },
  }[art];
  const alt = id ? store.eintragVon(id) : null;
  ui.bogen = {
    art,
    id: id || null,
    entwurf: alt
      ? { ...vorlage, ...alt }
      : { ...vorlage, art, am: ui.tag, um: ui.tag === heuteISO() ? jetztUhr() : '12:00' },
  };
  zeichne();
}

function bogenSpeichern() {
  const b = ui.bogen;
  if (!b) return;
  const e = { ...b.entwurf, art: b.art };
  if (b.art === 'essen' && !String(e.was || '').trim() && !(e.zutaten || []).length) {
    melden('Bitte etwas eintragen oder ankreuzen.');
    return;
  }
  if (b.art === 'medikament' && !String(e.mittel || '').trim()) {
    melden('Welches Mittel?');
    return;
  }
  if (b.art === 'notiz' && !String(e.text || '').trim()) {
    melden('Die Notiz ist leer.');
    return;
  }
  if (b.art === 'medikament') store.mittelMerken(e.mittel);
  if (b.id) store.eintragAendern(b.id, e);
  else store.eintragen(e);
  ui.tag = e.am;
  ui.bogen = null;
  melden(b.id ? 'Geändert.' : 'Eingetragen.');
  zeichne();
}

/** Ein Wert im Entwurf, ohne dass der Bogen dabei den Fokus verliert. */
function entwurf(patch, neuZeichnen = true) {
  if (!ui.bogen) return;
  Object.assign(ui.bogen.entwurf, patch);
  if (neuZeichnen) zeichne();
}

function umschalten(feld, id) {
  if (!ui.bogen) return;
  const liste = ui.bogen.entwurf[feld] || [];
  entwurf({ [feld]: liste.includes(id) ? liste.filter((x) => x !== id) : [...liste, id] });
}

/* ---------- Sicherung ---------- */

function datenAusgeben(text, name, typ) {
  const blob = new Blob([text], { type: typ });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Nicht sofort freigeben: Manche Browser holen die Datei erst danach ab.
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/**
 * In die Zwischenablage – und wenn der Browser das nicht erlaubt, wenigstens
 * das Feld markieren. Von Hand kopieren kann man immer.
 */
async function kopiere(text, wahl) {
  try {
    await navigator.clipboard.writeText(text || '');
    melden('Kopiert.');
  } catch {
    const feld = viewEl.querySelector(wahl);
    if (feld) { feld.focus(); feld.select(); }
    melden('Bitte von Hand kopieren.');
  }
}

function sicherungLaden() {
  const feld = document.createElement('input');
  feld.type = 'file';
  feld.accept = 'application/json,.json';
  feld.addEventListener('change', () => {
    const datei = feld.files && feld.files[0];
    if (!datei) return;
    const leser = new FileReader();
    leser.onload = () => {
      try {
        const anzahl = store.ausJSON(String(leser.result));
        melden(`${mehrzahl(anzahl, 'Eintrag', 'Einträge')} eingelesen.`);
      } catch (fehler) {
        melden(`Ging nicht: ${fehler.message}`);
      }
      zeichne();
    };
    leser.readAsText(datei);
  });
  feld.click();
}

/* ==================== Ein Empfänger für alles ==================== */

const AKTION = {
  los: () => { store.einstellen('begruesst', true); zeichne(); },
  tab: (el) => {
    // Eine laufende Atemübung endet beim Wechseln. Sie im Hintergrund
    // weiterpiepsen zu lassen, während jemand im Tagebuch blättert, wäre
    // das Gegenteil dessen, wozu sie da ist.
    atemStopp();
    store.einstellen('tab', el.dataset.tab);
    ui.bericht = null;
    ui.sicherung = null;
    ui.mittel = false;
    zeichne();
  },

  neu: (el) => bogenOeffnen(el.dataset.art),
  bearbeiten: (el) => {
    const e = store.eintragVon(el.dataset.id);
    if (e) bogenOeffnen(e.art, e.id);
  },
  loeschen: (el) => {
    store.eintragLoeschen(el.dataset.id);
    melden('Gelöscht.');
    zeichne();
  },
  'bogen-zu': () => { ui.bogen = null; zeichne(); },
  'bogen-speichern': bogenSpeichern,
  staerke: (el) => entwurf({ staerke: Number(el.dataset.n) }),
  portion: (el) => entwurf({ portion: el.dataset.id }),
  zutat: (el) => {
    if (!ui.bogen) return;
    const id = el.dataset.id;
    const liste = ui.bogen.entwurf.zutaten || [];
    entwurf({
      zutaten: liste.some((z) => z.id === id)
        ? liste.filter((z) => z.id !== id)
        : [...liste, { id, rolle: ROLLE_VORGABE }],
    });
  },
  gericht: (el) => entwurf({ was: el.dataset.text }),
  beschwerdeart: (el) => umschalten('arten', el.dataset.id),
  warnzeichen: (el) => umschalten('warnzeichen', el.dataset.id),
  'mittel-vorschlag': (el) => entwurf({ mittel: el.dataset.id }),

  'tag-blaettern': (el) => {
    ui.tag = plusTage(ui.tag, Number(el.dataset.d));
    zeichne();
  },
  'tag-waehlen': (el) => {
    ui.tag = el.dataset.iso;
    store.einstellen('tab', 'heute');
    zeichne();
  },
  'monat-blaettern': (el) => {
    ui.monat = plusMonate(ui.monat, Number(el.dataset.d));
    zeichne();
  },
  zeitraum: (el) => { ui.zeitraum = Number(el.dataset.n); zeichne(); },

  tagfrage: (el) => {
    const id = el.dataset.id;
    const n = Number(el.dataset.n);
    const jetzt = store.tagLesen(ui.tag)[id];
    store.tagSetzen(ui.tag, { [id]: jetzt === n ? null : n });
    zeichne();
  },
  frageAn: (el) => {
    const gewaehlt = store.zustandLesen().tagesfragen || [];
    const id = el.dataset.id;
    store.einstellen('tagesfragen', gewaehlt.includes(id)
      ? gewaehlt.filter((x) => x !== id) : [...gewaehlt, id]);
    zeichne();
  },
  ton: () => {
    store.einstellen('ton', !store.zustandLesen().ton);
    zeichne();
  },

  'atem-uebung': (el) => { store.einstellen('atemUebung', el.dataset.id); zeichne(); },
  'atem-runden': (el) => { store.einstellen('atemRunden', Number(el.dataset.n)); zeichne(); },
  'atem-start': () => atemStart(store.zustandLesen()),
  'atem-stopp': atemStopp,

  fenster: (el) => { store.einstellen('fenster', Number(el.dataset.n)); zeichne(); },
  mindest: (el) => { store.einstellen('mindestFaelle', Number(el.dataset.n)); zeichne(); },
  theme: (el) => { store.einstellen('theme', el.dataset.id); zeichne(); },

  'ausloeser-neu': () => {
    const feld = document.getElementById('neuerAusloeser');
    const name = (feld.value || '').trim();
    if (!name) { melden('Kein Name eingegeben.'); return; }
    store.ausloeserAnlegen(eigeneId(name), name);
    feld.value = '';
    melden(`„${name}" steht jetzt zur Auswahl.`);
    zeichne();
  },
  'ausloeser-weg': (el) => { store.ausloeserLoeschen(el.dataset.id); zeichne(); },

  mittel: () => { ui.mittel = !ui.mittel; zeichne(); },

  'idee-neu': () => {
    const feld = document.getElementById('ideeText');
    if (!store.ideeAnlegen(feld.value)) { melden('Da steht noch nichts.'); return; }
    feld.value = '';
    melden('Notiert.');
    zeichne();
  },
  'idee-haken': (el) => { store.ideeUmschalten(el.dataset.id); zeichne(); },
  'idee-weg': (el) => { store.ideeLoeschen(el.dataset.id); zeichne(); },
  'ideen-kopieren': () => kopiere(ideenText(store.zustandLesen()), '#ideeText'),
  /*
   * Teilen über das Menü des Geräts. Das ist kein Widerspruch zu „die App
   * schickt nichts": Hier wird nichts gesendet, sondern der Text an das
   * Betriebssystem übergeben, das daraufhin *den Nutzer* fragen lässt, wohin.
   * Ohne diese Schnittstelle bleibt der gewöhnliche Weg über die
   * Zwischenablage.
   */
  'ideen-teilen': async () => {
    const text = ideenText(store.zustandLesen());
    if (!navigator.share) { kopiere(text, '#ideeText'); return; }
    try {
      await navigator.share({ title: 'Bauchbuch – Ideen', text });
    } catch {
      // Abgebrochen oder nicht erlaubt – dann eben nicht.
    }
  },

  export: () => {
    datenAusgeben(store.alsJSON(), `bauchbuch-${heuteISO()}.json`, 'application/json');
    store.sicherungNotiert();
    melden('Sicherung erstellt.');
    zeichne();
  },
  import: sicherungLaden,
  'sicherung-text': () => {
    ui.sicherung = store.alsJSON();
    store.sicherungNotiert();
    zeichne();
  },
  'sicherung-zu': () => { ui.sicherung = null; zeichne(); },
  'sicherung-kopieren': () => kopiere(ui.sicherung, '.bericht'),

  bericht: (el) => {
    const s = store.zustandLesen();
    const bis = heuteISO();
    ui.bericht = arztBericht(s, plusTage(bis, -(Number(el.dataset.n) - 1)), bis);
    zeichne();
  },
  'bericht-zu': () => { ui.bericht = null; zeichne(); },
  'bericht-kopieren': () => kopiere(ui.bericht, '.bericht'),
  'bericht-laden': () => {
    const bis = heuteISO();
    datenAusgeben(ui.bericht || '', berichtName(plusTage(bis, -29), bis), 'text/plain');
  },

  'alles-weg': () => {
    // Zwei Fragen sind eine zu viel, keine ist eine zu wenig: Der Knopf steht
    // unter „Mehr" und löscht Monate.
    if (!window.confirm('Wirklich alles löschen? Das lässt sich nicht rückgängig machen.')) return;
    store.allesLoeschen();
    ui.bericht = null;
    melden('Alles gelöscht.');
    zeichne();
  },
};

document.addEventListener('click', (ev) => {
  const el = ev.target.closest('[data-act]');
  if (!el || el.disabled) return;
  const fn = AKTION[el.dataset.act];
  if (!fn) return;
  // Textfelder tragen ebenfalls data-act, ihre Werte kommen über 'input'.
  if (el.matches('input, textarea')) return;
  ev.preventDefault();
  fn(el);
});

/*
 * Texteingaben laufen über 'input' und zeichnen *nicht* neu – ein Neuzeichnen
 * bei jedem Tastendruck nähme dem Feld den Fokus und die Schreibmarke.
 */
function eingabe(ev) {
  const el = ev.target.closest('[data-act]');
  if (!el) return;
  const wert = el.value;
  switch (el.dataset.act) {
    case 'rolle': {
      const liste = (ui.bogen && ui.bogen.entwurf.zutaten) || [];
      entwurf({
        zutaten: liste.map((z) => (z.id === el.dataset.id ? { ...z, rolle: wert } : z)),
      }, false);
      break;
    }
    case 'was': entwurf({ was: wert }, false); break;
    case 'notiz': entwurf({ notiz: wert }, false); break;
    case 'mittel': entwurf({ mittel: wert }, false); break;
    case 'dosis': entwurf({ dosis: wert }, false); break;
    case 'text': entwurf({ text: wert }, false); break;
    case 'uhr': entwurf({ um: wert }, false); break;
    case 'bogen-datum': entwurf({ am: wert }, false); break;
    case 'tag-datum':
      if (/^\d{4}-\d{2}-\d{2}$/.test(wert)) { ui.tag = wert; zeichne(); }
      break;
    default: break;
  }
}

/*
 * Texteingaben melden sich über 'input', Auswahlmenüs je nach Browser über
 * 'input' *oder* nur über 'change'. Beide auf denselben Empfänger, damit die
 * Rolle einer Zutat nirgends verlorengeht – das ist eine Angabe, die man genau
 * einmal macht und dann nie wieder kontrolliert.
 */
document.addEventListener('input', eingabe);
document.addEventListener('change', eingabe);

document.addEventListener('keydown', (ev) => {
  if (ev.key === 'Escape' && ui.bogen) { ui.bogen = null; zeichne(); }
});

/*
 * Vor dem Verschwinden schreiben. Mobile Browser verwerfen die Seite im
 * Hintergrund ohne Vorwarnung, und der letzte Eintrag hängt bis zu 120 ms in
 * der Warteschlange.
 */
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') store.sofortSchreiben();
});
window.addEventListener('pagehide', () => store.sofortSchreiben());

// Auch Änderungen, die keine Aktion ausgelöst hat, müssen ankommen – allen
// voran der Wechsel auf „kann nicht mehr speichern", den der Schreibvorgang
// selbst feststellt.
store.horche(zeichne);

male();

/* Ohne Netz benutzbar. Aus einer Datei heraus (file://) gibt es keinen
 * Service Worker – dort ist die App ohnehin schon vollständig da. */
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => { /* dann eben nicht */ });
  });
}
