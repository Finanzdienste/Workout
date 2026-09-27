/*
 * Einschätzung in der Oberfläche: der Block unter jedem Laborbefund, das
 * Gesamtbild, der Warnzeichen-Check, „Was braucht Abstand?" – und die
 * Bausteine, die auch „Heute", der Verlauf, die Dosis-Karte und die Formulare
 * brauchen (Notfallleiste, Anruf-Knöpfe, die P6-Karte, Ja/Nein-Fragen).
 *
 * Gerechnet wird in js/einschaetzung.js und js/dosis.js; hier wird nur
 * gezeigt, was dort herauskommt. Jede Aussage steht in Worten – die Stufe
 * („In den nächsten Tagen anrufen"), die Lage („knapp über dem Bereich") –,
 * Farbe kommt nur dazu. Kein Text wird hier selbst erfunden, der eine Regel
 * ersetzt: Fehlt dem Kern etwas, fehlt es hier auch.
 *
 * Die Einschätzung gilt nur bei bestätigter Behandlung (P6, ez.aktiv). Ohne
 * sie zeigen Verlauf und Gesamtbild die Werte mit ihrer Lage zum Bereich, aber
 * kein Muster und keine Dringlichkeit. Warnzeichen und Notrufnummern gelten
 * immer.
 */
import { datumKurz, datumInWorten, zahlText, uhrText } from './datum.js';
import { esc } from './text.js';
import * as sp from './speicher.js';
import * as ez from './einschaetzung.js';
import { STANDARD } from './einheiten.js';

// ---------------------------------------------------------------- Stufen

/** Farbe zur Stufe – nur zusätzlich, das Wort steht immer daneben. */
export const STUFE_KLASSE = { notruf: 'gefahr', heute: 'gefahr', tage: 'gefahr', zeitnah: 'warn', termin: 'info', keine: 'ok' };
const STUFE_ZEICHEN = { notruf: '🚑', heute: '📞', tage: '📞', zeitnah: '📅', termin: '🗒️', keine: '✓' };

export const rang = (stufe) => (ez.STUFEN[stufe] || ez.STUFEN.keine).rang;

/**
 * Die Zeile mit dem Stufen-Schild über einem einzelnen Hinweis – bei „kein
 * besonderer Anlass" keine: Ein grünes „Kein besonderer Anlass" über einem
 * Hinweis läse sich wie eine Entwarnung.
 */
export function stufeZeile(stufe, titel = null) {
  return rang(stufe) > 0 ? `<p class="stufe-zeile">${stufeSchild(stufe, titel)}</p>` : '';
}
export const hinweisKlasse = (stufe) => (rang(stufe) > 0 ? STUFE_KLASSE[stufe] : '');

/**
 * „In den nächsten Tagen anrufen" – die Stufe als kleines Schild in Worten.
 * `titel` ersetzt den Standardtitel, wo der Kern einen eigenen liefert
 * (ez.kopfFuer: bei seelischer Not ein Gesprächsangebot statt „Sofort 112").
 */
export function stufeSchild(stufe, titel = null) {
  const s = ez.STUFEN[stufe] || ez.STUFEN.keine;
  return `<span class="stufe-schild stufe-${esc(stufe)}"><span aria-hidden="true">${STUFE_ZEICHEN[stufe] || ''}</span> ${esc(titel || s.titel)}</span>`;
}

// ---------------------------------------------------------------- Anrufen

/*
 * Ein Anruf ist ein Link mit tel: – ohne Leerzeichen in der Nummer, sonst
 * wählen manche Telefone nur den ersten Block. Beschriftet wird mit der
 * Nummer, wie man sie liest.
 */
export function telHref(nummer) {
  return `tel:${String(nummer).replace(/[^\d+]/g, '')}`;
}

export function anrufKnopf(nummer, text, { notruf = false, breit = false } = {}) {
  const klasse = ['knopf', notruf ? 'knopf-notruf' : 'knopf-anruf', breit ? 'knopf-breit' : ''].filter(Boolean).join(' ');
  return `<a class="${klasse}" href="${esc(telHref(nummer))}"><span aria-hidden="true">📞</span> ${esc(text)}</a>`;
}

const SEELSORGE = [['08001110111', 'Telefonseelsorge 0800 111 0 111'], ['08001110222', 'Telefonseelsorge 0800 111 0 222']];

/*
 * Anruf-Knöpfe zu den Texten aus js/einschaetzung.js, die eine Nummer nennen.
 * Die Texte selbst kommen unverändert aus dem Kern; hier kommt nur der Knopf
 * dazu, damit niemand die Nummer abtippen muss.
 */
const ANRUFE_ZU = {
  W5: [...SEELSORGE, ['112', '112 anrufen']],
  W5b: [SEELSORGE[0]],
  S4: [['116117', 'Bereitschaftsdienst 116 117'], ['112', '112 anrufen']],
  S4ii: [['112', '112 anrufen']],
  R3: [['116117', 'Bereitschaftsdienst 116 117']],
};
const MIT_CHECK = ['S4ii', 'R3'];

/** Die Knöpfe unter einem Text aus beschwerdenAuswerten. */
export function beschwerdeKnoepfe(id) {
  const anrufe = (ANRUFE_ZU[id] || []).map(([n, t]) => anrufKnopf(n, t, { notruf: n === '112' }));
  if (MIT_CHECK.includes(id)) anrufe.push('<button type="button" class="knopf" data-act="seite" data-seite="warnzeichen">Warnzeichen prüfen</button>');
  return anrufe.length ? `<div class="knopf-reihe anruf-reihe">${anrufe.join('')}</div>` : '';
}

/**
 * W0 – die Notfallleiste oben auf „Heute". Kompakt, aber nicht versteckt:
 * der eine Satz, der große 112-Knopf, darunter die drei anderen Nummern.
 * Wer akut krank ist, füllt keinen Fragebogen aus.
 */
export function notfallLeiste(stand) {
  const gift = sp.giftnotruf(stand.profil.bundesland);
  return `
    <section class="notfall-leiste" aria-label="Notfall">
      <p class="notfall-text"><strong>Notfall?</strong> Bei Brustschmerz, starker Atemnot, Ohnmacht, Lähmung, Sprachstörung oder plötzlicher Verwirrtheit: sofort 112.</p>
      <a class="knopf knopf-notruf knopf-breit" href="tel:112"><span aria-hidden="true">📞</span> 112 anrufen</a>
      <p class="notfall-nummern">
        <span>Ärztlicher Bereitschaftsdienst <a class="nummer" href="tel:116117">116 117</a></span>
        <span>Giftnotruf ${gift
    ? `<a class="nummer" href="${esc(telHref(gift))}">${esc(gift)}</a>`
    : '<button type="button" class="nummer" data-act="seite" data-seite="profil">Bundesland eintragen</button>'}</span>
        <span>Telefonseelsorge <a class="nummer" href="tel:08001110111">0800 111 0 111</a></span>
      </p>
    </section>`;
}

/** Der W1-Text mit dem 112-Knopf, groß – im Befinden und im Warnzeichen-Check. */
export function w1Karte(stand, { id = '' } = {}) {
  const w1 = ez.warnzeichenAuswerten(['brust'], stand).abschnitte[0];
  return `
    <div class="karte gefahr notruf-karte"${id ? ` id="${esc(id)}"` : ''} role="alert" tabindex="-1">
      <p class="gross">${esc(w1.text)}</p>
      <div class="knopf-reihe">${w1.anrufe.map((a) => anrufKnopf(a.nummer, a.text, { notruf: true, breit: true })).join('')}</div>
    </div>`;
}

// ---------------------------------------------------------------- P6

/**
 * P6: Die Einschätzung gilt nur bei bekannter, behandelter Unterfunktion.
 * Solange das nicht bestätigt ist (Haken oder Behandlungsgrund), steht hier
 * der Text mit einem Knopf zum Bestätigen.
 */
export function p6Karte() {
  return `
    <div class="karte p6-karte" id="p6">
      <p>${esc(ez.P6_TEXT)}</p>
      <button type="button" class="knopf knopf-breit" data-act="behandelt" style="margin-top:.7rem">Ja, ich werde wegen einer Unterfunktion mit Tabletten behandelt</button>
    </div>`;
}

// ---------------------------------------------------------------- Ja / Nein / Weiß nicht

export const JNW_WAHL = [['ja', 'Ja'], ['nein', 'Nein'], ['unbekannt', 'Weiß nicht']];

/**
 * Eine Frage mit großen Antwortflächen. Nichts ist vorbelegt – leer heißt
 * „noch nicht beantwortet", nie „nein". `optionen` wie JNW_WAHL.
 */
export function wahlFrage(name, wert, frage, { optionen = JNW_WAHL, hinweis = '', extra = '', klasse = '' } = {}) {
  const id = `frage-${name}`;
  return `
    <div class="feld wahl-frage${klasse ? ` ${klasse}` : ''}" data-feld="${esc(name)}">
      <span id="${esc(id)}">${frage}</span>
      <div class="wahl-flaechen" role="radiogroup" aria-labelledby="${esc(id)}">
        ${optionen.map(([w, t]) => `<label class="wahl-flaeche"><input type="radio" name="${esc(name)}" value="${esc(w)}" ${wert === w ? 'checked' : ''}><span>${esc(t)}</span></label>`).join('')}
      </div>
      ${hinweis ? `<span class="hinweis">${hinweis}</span>` : ''}
      ${extra}
    </div>`;
}

// ---------------------------------------------------------------- Fragen zur Blutabnahme

/*
 * Die Fragen zu einem Befund (RW1 L0c, RW2 L4 F1–F8/F10, Q1–Q3): Wortlaut für
 * das Formular, Kurzform für die Zusammenfassung unter dem Befund. Die
 * Dosis-Karte stellt offene Fragen später selbst – mit ihrem eigenen Text.
 */
export const BEFUND_FRAGEN = [
  { feld: 'vorAbnahme', frage: 'Hatten Sie die Tablette am Tag der Blutabnahme schon <strong>vor</strong> der Abnahme genommen?', kurz: 'Tablette vor der Abnahme' },
  { feld: 'biotin', frage: 'Haben Sie in der Woche vor der Abnahme Biotin, ein Mittel für Haare, Haut oder Nägel oder einen Vitamin-B-Komplex genommen?', kurz: 'Biotin in der Woche davor' },
  { feld: 'krank', frage: 'Waren Sie in den 6 Wochen vor der Abnahme schwer krank, im Krankenhaus oder wurden Sie operiert?', kurz: 'schwer krank oder Krankenhaus' },
  { feld: 'kortison', frage: 'Haben Sie in den 6 Wochen vor der Abnahme Kortison als Tablette oder Spritze bekommen? (Spray und Salbe zählen nicht.)', kurz: 'Kortison' },
  { feld: 'kontrastmittel', frage: 'Hatten Sie in den 8 Wochen vor der Abnahme eine Untersuchung mit Kontrastmittel, z. B. CT oder Herzkatheter?', kurz: 'Kontrastmittel' },
  { feld: 'mittelGeaendert', frage: 'Haben Sie in den 8 Wochen vor der Abnahme ein Mittel neu begonnen oder abgesetzt, z. B. Magenschutz, Kalzium (auch mit Vitamin D), Eisen, Magnesium, Mittel gegen Sodbrennen, Ballaststoffe, Östrogen oder ein Knochenmittel?', kurz: 'anderes Mittel begonnen oder abgesetzt' },
  { feld: 'einnahmeGeaendert', frage: 'Haben Sie in dieser Zeit etwas an Ihrer Einnahme geändert, z. B. Frühstück oder Kaffee näher an die Tablette gerückt oder die Uhrzeit gewechselt?', kurz: 'Einnahme geändert' },
  { feld: 'packung', frage: 'Haben Sie in den 8 Wochen vor der Abnahme eine Packung mit anderem Namen, Hersteller oder anderer Stärke bekommen?', kurz: 'andere Packung' },
  {
    feld: 'vergessen', frage: 'Haben Sie in den 6 Wochen vor der Blutabnahme Tabletten vergessen oder ausgelassen?', kurz: 'vergessene Tabletten',
    optionen: [['nein', 'Nein, jeden Tag genommen'], ['einzelne', 'Ja, einzelne Tage'], ['mehrere', 'Ja, mehrere Tage'], ['unbekannt', 'Weiß nicht']],
  },
  {
    feld: 'einnahmeArt', frage: 'Nehmen Sie die Tablette morgens nüchtern mit Wasser, 30 bis 60 Minuten vor Frühstück und Kaffee?', kurz: 'nüchtern mit Wasser',
    optionen: [['ja', 'Ja'], ['abends', 'Abends, so mit der Praxis abgesprochen'], ['nein', 'Nein'], ['unbekannt', 'Weiß nicht']],
  },
  { feld: 'abstandOk', frage: 'Halten Sie die Abstände aus Ihrem Plan „Was braucht Abstand?" jeden Tag ein?', kurz: 'Abstände eingehalten', nurMitAbstand: true },
  {
    feld: 'praxis', frage: 'Hat die Praxis zu diesem Wert schon etwas gesagt?', kurz: 'Praxis',
    optionen: [['bleibt', 'Ja: Die Dosis bleibt so'], ['geaendert', 'Ja: Die Dosis wird geändert'], ['nachmessen', 'Ja: Erst nachmessen'], ['nochnicht', 'Noch nicht']],
  },
];

const ANTWORT_KURZ = { ja: 'ja', nein: 'nein', unbekannt: 'weiß nicht' };

/** Die beantworteten Angaben zur Blutabnahme als eine kurze Zeile. */
function angabenZeile(l) {
  const teile = [];
  if (l.abnahmeUhr) teile.push(`Abnahme um ${uhrText(l.abnahmeUhr)}`);
  BEFUND_FRAGEN.forEach((f) => {
    const w = l[f.feld];
    if (!w) return;
    const antwort = f.optionen ? (f.optionen.find(([k]) => k === w) || [w, w])[1] : ANTWORT_KURZ[w] || w;
    let t = `${f.kurz}: ${antwort.replace(/^Ja: /, '')}`;
    if (f.feld === 'vorAbnahme' && w === 'ja' && l.tabletteUhr) t += ` (um ${uhrText(l.tabletteUhr)})`;
    teile.push(t);
  });
  if (l.laborName) teile.push(`Labor: ${l.laborName}`);
  return teile.length ? `<p class="klein gedaempft angaben"><strong>Angaben zur Blutabnahme:</strong> ${esc(teile.join(' · '))}</p>` : '';
}

// ---------------------------------------------------------------- Befund

const QUELLE = { labor: 'Bereich Ihres Labors', orientierung: 'übliche Orientierung, nicht Ihr Labor', ziel: 'Ihr Zielbereich' };

function bereichText(von, bis, einheit) {
  const v = von !== null && von !== undefined;
  const b = bis !== null && bis !== undefined;
  if (v && b) return `${zahlText(von)}–${zahlText(bis)} ${einheit}`;
  if (v) return `ab ${zahlText(von)} ${einheit}`;
  if (b) return `bis ${zahlText(bis)} ${einheit}`;
  return '';
}

/** Die Lage eines Werts in Worten, mit der Quelle des Bereichs. */
function lageZeile(o, einheit) {
  if (!o.lage) return '<p class="lage-zeile"><span class="lage lage-keine">ohne Einordnung</span> <span class="bereich">(siehe Hinweis)</span></p>';
  const bereich = bereichText(o.von, o.bis, o.quelle === 'ziel' ? 'mU/l' : einheit);
  return `<p class="lage-zeile"><span class="lage lage-${esc(o.lage)}">${esc(ez.LAGE_TEXT[o.genau] || o.text)}</span> <span class="bereich">(${esc(QUELLE[o.quelle] || '')}${bereich ? ` ${esc(bereich)}` : ''})</span></p>`;
}

/*
 * Der Zusatz des Kerns zu einem Wert (einordnen().zusatz): „übliche
 * Orientierung" steht schon in der Lage-Zeile; gezeigt wird er, wenn er mehr
 * sagt – am Rand des üblichen Bereichs die Bitte, den Laborbereich einzutragen.
 */
const zusatzZeigen = (o) => Boolean(o.zusatz) && o.quelle === 'orientierung' && String(o.genau).startsWith('rand');

/** Die Hinweise zum Befund ohne das, was schon beim Wert steht. */
function hinweiseOhneDoppelte(e) {
  const zusaetze = e.werte.map((w) => w.einordnung.zusatz).filter(Boolean);
  return e.hinweise.filter((h) => !zusaetze.some((z) => z.includes(h) || z.includes(h.replace(/^[^:]{1,15}: /, ''))));
}

/** Je Wert: Originalwert mit Einheit, Lage in Worten, umgerechnet wo gerechnet. */
function werteZeilen(e) {
  return e.werte.map(({ key, name, wert: w, einordnung: o, ziel }) => {
    const zahl = `${w.unter ? '< ' : ''}${zahlText(w.wert)} ${w.einheit}`;
    const um = o.umgerechnet && o.std !== null ? `umgerechnet ${zahlText(o.std, key === 'ft4' || key === 'ft3' ? 1 : 2)} ${STANDARD[key] || ''}` : '';
    return `
      <div class="wert" data-wert="${esc(key)}">
        <div class="befund-wert"><b>${esc(name)}</b><span class="zahl">${esc(zahl)}</span></div>
        ${um ? `<p class="bereich rechts">${esc(um)}</p>` : ''}
        ${lageZeile(o, w.einheit)}
        ${ziel && ziel.quelle === 'ziel' ? lageZeile(ziel, w.einheit) : ''}
        ${zusatzZeigen(o) ? `<p class="klein hinweis-zeile">${esc(o.zusatz)}</p>` : ''}
      </div>`;
  }).join('');
}

/** Der Notfallsatz (L3e): Satz 1 und 2 rot und mit 112, Satz 3 klein mit dem Check. */
function notfallSatz(n) {
  if (!n) return '';
  if (n.satz === 3) {
    return `<p class="klein notfall-klein">${esc(n.text)} <button type="button" class="knopf-link" data-act="seite" data-seite="warnzeichen">Zum Warnzeichen-Check</button></p>`;
  }
  return `<div class="notfall-satz" role="note"><p>${esc(n.text)}</p>${anrufKnopf('112', '112 anrufen', { notruf: true })}</div>`;
}

/** Die freiwilligen weiteren Werte mit ihren Texten, der Hinweis einmal darunter. */
function weitereBlock(l, stand) {
  const liste = ez.weitereWerte(l, stand);
  if (!liste.length) return '';
  return `
    <div class="weitere-werte">
      ${liste.map((x) => `
        <div class="befund-wert"><b>${esc(x.name)}</b><span class="zahl">${esc(`${x.wert.unter ? '< ' : ''}${zahlText(x.wert.wert)} ${x.wert.einheit}`)}</span></div>
        ${x.texte.map((t) => `<p class="klein">${esc(t)}</p>`).join('')}`).join('')}
      <p class="klein gedaempft">${esc(ez.WEITERE_HINWEIS)}</p>
    </div>`;
}

/**
 * Ein Befund als Karte: Kopf mit Datum und damaliger Dosis, je Wert die
 * Lage, darunter die Einschätzung aus befundEinschaetzen().
 *
 * `kurz` (ältere Befunde in der Übersicht): Mustertext, Frist, der Satz
 * gegen Selbsthandlung, Notfallsatz und Fußnote – ohne Erklärungen, Verlauf
 * und Angaben. Der Satz gegen Selbsthandlung (Grundsatz 2) und ein
 * Notfallsatz 1 oder 2 fehlen nie, wo es eine Einschätzung gibt.
 */
export function befundKarte(l, stand, heute, { kurz = false, aendern = false, dosisKnopf = false } = {}) {
  const e = ez.befundEinschaetzen(l, stand, heute);
  const aktiv = ez.aktiv(stand);
  const dosis = ez.dosisAmIn(stand, l.datum);
  const tag = sp.tagesdosis(dosis);
  const teile = [];
  teile.push(`
    <div class="befund-kopf">
      <span class="befund-datum">${esc(datumKurz(l.datum))}</span>
      <span class="gedaempft klein">${tag !== null ? `Dosis damals ${esc(zahlText(tag, 1))} µg am Tag` : ''}</span>
    </div>`);
  teile.push(werteZeilen(e));
  hinweiseOhneDoppelte(e).forEach((h) => teile.push(`<p class="klein hinweis-zeile">${esc(h)}</p>`));

  if (aktiv && e.muster) {
    const stufe = e.praxisErklaert ? 'keine' : e.stufe;
    const frist = e.praxisErklaert ? e.praxisText : e.stufeText;
    const notfall = kurz && e.notfall.satz === 3 ? '' : notfallSatz(e.notfall);
    teile.push(`
      <div class="einschaetzung ${STUFE_KLASSE[stufe]}" data-muster="${esc(e.muster)}" data-stufe="${esc(e.stufe)}">
        <p class="einschaetzung-text">${esc(e.text)}</p>
        <p class="frist">${stufeSchild(stufe)} <strong>${esc(frist)}</strong></p>
        ${e.gegenSelbst ? `<p class="gegen-selbst">${esc(e.gegenSelbst)}</p>` : ''}
        ${kurz ? '' : e.zusaetze.map((z) => `<p class="klein">${esc(z.text)}</p>`).join('')}
        ${!kurz && e.erklaerungen.length ? `<p class="klein zwischen"><strong>Mögliche Erklärungen aus Ihren Einträgen:</strong></p><ul class="klein">${e.erklaerungen.map((x) => `<li>${esc(x.text)}</li>`).join('')}</ul>` : ''}
        ${kurz ? '' : e.verlauf.map((v) => `<p class="klein">${esc(v.text)}</p>`).join('')}
        ${notfall}
        <p class="klein gedaempft fussnote">${esc(e.fussnote)}</p>
      </div>`);
  }
  if (!kurz) teile.push(angabenZeile(l));
  teile.push(weitereBlock(l, stand));
  if (!kurz && l.notiz) teile.push(`<p class="klein gedaempft">${esc(l.notiz)}</p>`);
  const knoepfe = [];
  if (dosisKnopf && l.tsh) knoepfe.push('<button type="button" class="knopf" data-act="seite" data-seite="dosis-karte">Dosis: mehr oder weniger?</button>');
  if (aendern) knoepfe.push(`<button type="button" class="knopf knopf-klein" data-act="seite" data-seite="labor" data-param="${esc(l.id)}" aria-label="Laborwerte vom ${esc(datumKurz(l.datum))} ändern">Ändern</button>`);
  if (knoepfe.length) teile.push(`<div class="knopf-reihe">${knoepfe.join('')}</div>`);
  return `<div class="befund" data-befund="${esc(l.id)}">${teile.join('')}</div>`;
}

// ---------------------------------------------------------------- Texte aus den Beschwerden

/** Ein Text aus beschwerdenAuswerten als Hinweis-Karte, mit Anruf-Knöpfen. */
export function beschwerdeKarte(t) {
  if (t.id === 'W5b') {
    return `<div class="hinweis-karte" data-regel="W5b"><span class="ri" aria-hidden="true">💬</span><div><p class="klein">${esc(t.text)}</p>${beschwerdeKnoepfe('W5b')}</div></div>`;
  }
  return `
    <div class="karte ${hinweisKlasse(t.stufe)} beschwerde-karte" data-regel="${esc(t.id)}">
      ${stufeZeile(t.stufe)}
      <p>${esc(t.text)}</p>
      ${beschwerdeKnoepfe(t.id)}
    </div>`;
}

/**
 * W5 steht immer ganz oben – mit den Nummern als Knöpfe. `alert` nur direkt
 * nach dem Eintragen: Auf „Heute" stünde sonst bei jedem Neuzeichnen eine
 * Durchsage an.
 */
export function w5Karte(text, { alert = false } = {}) {
  return `
    <div class="karte gefahr w5-karte" data-regel="W5"${alert ? ' role="alert"' : ''}>
      <p>${esc(text)}</p>
      ${beschwerdeKnoepfe('W5')}
    </div>`;
}

// ---------------------------------------------------------------- Gesamtbild

function links() {
  return `
    <div class="zeilen links">
      <button type="button" class="zeile" data-act="seite" data-seite="warnzeichen"><span class="zeile-text"><span class="zeile-titel">Warnzeichen prüfen</span><span class="zeile-unter">Geht es Ihnen gerade schlecht? In einer Minute wissen, was zu tun ist</span></span><span class="zeile-pfeil" aria-hidden="true">›</span></button>
      <button type="button" class="zeile" data-act="seite" data-seite="dosis-karte"><span class="zeile-text"><span class="zeile-titel">Dosis-Karte: mehr oder weniger?</span><span class="zeile-unter">Was der letzte TSH-Wert für die Dosis bedeutet</span></span><span class="zeile-pfeil" aria-hidden="true">›</span></button>
      <button type="button" class="zeile" data-act="seite" data-seite="abstand"><span class="zeile-text"><span class="zeile-titel">Was braucht Abstand?</span><span class="zeile-unter">Kaffee, Kalzium, Eisen – ab wann in Ordnung</span></span><span class="zeile-pfeil" aria-hidden="true">›</span></button>
    </div>`;
}

function gesamtbildSeite(stand, heute) {
  const titel = 'Einschätzung';
  if (!ez.aktiv(stand)) {
    return { titel, html: `${p6Karte()}${links()}<p class="klein gedaempft" style="margin-top:1rem">${esc(ez.FUSSZEILE)}</p>` };
  }
  const g = ez.gesamtbild(stand, heute);
  const teile = [];

  // W5 zuerst, ganz gleich, welche Stufe sonst gilt.
  const w5 = g.beschwerden.texte.find((t) => t.id === 'W5');
  if (w5) teile.push(w5Karte(w5.text));

  teile.push(`
    <div class="karte stufe-karte ${STUFE_KLASSE[g.stufe]}" data-stufe="${esc(g.stufe)}">
      <p class="stufe-zeile">${stufeSchild(g.stufe, g.kopf.titel)}</p>
      <p class="gross-text">${esc(g.kopf.text)}</p>
    </div>`);

  // Im Einzelnen: Warnzeichen von heute, der Befund, die Kontrollen. Die
  // Beschwerden haben ihren eigenen Abschnitt weiter unten.
  const einzeln = [];
  if (g.warnHeute) {
    g.warnHeute.abschnitte.forEach((a) => einzeln.push({
      stufe: a.stufe,
      titel: ez.kopfFuer(a.stufe, [a]).titel,
      html: `<p class="klein gedaempft">Warnzeichen-Check von heute${g.warnHeute.check.uhr ? `, ${esc(uhrText(g.warnHeute.check.uhr))}` : ''}:</p><p>${esc(a.text)}</p>${a.anrufe.length ? `<div class="knopf-reihe anruf-reihe">${a.anrufe.map((x) => anrufKnopf(x.nummer, x.text, { notruf: x.nummer === '112' })).join('')}</div>` : ''}`,
    }));
  }
  g.teile.filter((t) => t.quelle === 'befund').forEach((t) => einzeln.push({
    stufe: t.stufe,
    html: `<p class="klein gedaempft">Letzter Befund vom ${esc(datumKurz(g.befund.befund.datum))}:</p><p>${esc(t.text)}</p>`,
  }));
  g.teile.filter((t) => t.quelle === 'kontrolle').forEach((t) => einzeln.push({ stufe: t.stufe, html: `<p>${esc(t.text)}</p>` }));
  einzeln.sort((a, b) => rang(b.stufe) - rang(a.stufe));
  if (einzeln.length) {
    teile.push('<h2 class="abschnitt">Im Einzelnen</h2>');
    einzeln.forEach((x) => teile.push(`<div class="karte teil-karte ${hinweisKlasse(x.stufe)}">${stufeZeile(x.stufe, x.titel)}${x.html}</div>`));
  }

  teile.push('<h2 class="abschnitt">Letzter Laborbefund</h2>');
  if (g.befund) {
    teile.push(`<div class="karte">${befundKarte(g.befund.befund, stand, heute, { dosisKnopf: true })}</div>`);
  } else {
    teile.push('<div class="karte"><p class="gedaempft">Noch kein Befund, den die App einordnen kann. Mit TSH (und am besten fT4) vom nächsten Befund, samt Bereich des Labors, sagt sie mehr.</p><div class="knopf-reihe"><button type="button" class="knopf knopf-haupt" data-act="seite" data-seite="labor">Befund eintragen</button></div></div>');
  }

  teile.push('<h2 class="abschnitt">Beschwerden</h2>');
  const bTexte = g.beschwerden.texte.filter((t) => t.id !== 'W5');
  if (g.beschwerden.genannt.length) {
    const namen = g.beschwerden.genannt.map((k) => (sp.BESCHWERDEN.find(([id]) => id === k) || [k, k])[1]);
    teile.push(`<p class="klein gedaempft" style="margin-bottom:.5rem">Eingetragen in den letzten vier Wochen: ${esc(namen.join(', '))}.</p>`);
  }
  if (bTexte.length) bTexte.forEach((t) => teile.push(beschwerdeKarte(t)));
  else if (!g.beschwerden.genannt.length) teile.push('<div class="karte"><p class="gedaempft">In den letzten vier Wochen keine Beschwerden eingetragen. Die Frage dazu steht unter „Heute".</p></div>');

  const fragen = ez.fragenVorschlaege(stand, heute);
  if (fragen.length) {
    teile.push(`
      <h2 class="abschnitt">Fragen für den Termin</h2>
      <div class="karte">
        <ul class="liste">${fragen.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>
        <button type="button" class="knopf knopf-breit" data-act="fragen-uebernehmen" style="margin-top:.6rem">Diese Fragen übernehmen</button>
      </div>`);
  }
  teile.push('<h2 class="abschnitt">Weiter</h2>');
  teile.push(links());
  teile.push(`<p class="klein gedaempft" style="margin-top:1rem">${esc(ez.FUSSZEILE)}</p>`);
  return { titel, html: teile.join('') };
}

// ---------------------------------------------------------------- Warnzeichen

/*
 * Die Fragen des Checks in vier Gruppen. „Zu viele Tabletten über Tage" und
 * „keine Tabletten mehr" gehören in der Auswertung zu W2h, stehen aber unter
 * „Tabletten", weil man sie dort sucht.
 */
const TABLETTEN_SCHLUESSEL = ['zuviele', 'keine_tabletten'];
const WARN_GRUPPEN = [
  ['Notfallzeichen – jetzt', (f) => f.gruppe === 'w1', 'gefahr'],
  ['Tabletten', (f) => f.gruppe === 'w4a' || f.gruppe === 'w4b' || TABLETTEN_SCHLUESSEL.includes(f.key), ''],
  ['Seit Tagen oder Wochen', (f) => (f.gruppe === 'w2h' || f.gruppe === 'w2t') && !TABLETTEN_SCHLUESSEL.includes(f.key), ''],
  ['Stimmung', (f) => f.gruppe === 'w5', ''],
];

function warnFormular(stand) {
  const fragen = ez.warnfragenFuer(stand);
  return `
    <form data-formular="warnzeichen" novalidate>
      <p style="margin-bottom:.8rem">Setzen Sie bei allem, was <strong>gerade</strong> zutrifft, das Häkchen „Ja". Nichts davon? Dann einfach auf „Auswerten" tippen.</p>
      ${WARN_GRUPPEN.map(([titel, passt, klasse], i) => {
    const liste = fragen.filter(passt);
    if (!liste.length) return '';
    return `
        <fieldset class="warn-gruppe ${klasse}">
          <legend id="warn-gruppe-${i}">${esc(titel)}</legend>
          ${liste.map((f) => `
            <label class="warn-frage"><span class="warn-haken"><input type="checkbox" name="warn" value="${esc(f.key)}"><span class="warn-ja" aria-hidden="true">Ja</span></span><span class="warn-frage-text">${esc(f.text)}</span></label>`).join('')}
        </fieldset>`;
  }).join('')}
      <div class="formular-fuss"><button type="submit" class="knopf knopf-haupt knopf-breit">Auswerten</button></div>
      <p class="klein gedaempft">Der Check wird mit Datum gespeichert und steht im Bericht für den Arzttermin.</p>
    </form>`;
}

function warnErgebnis(param, stand) {
  const check = stand.warnzeichen.find((w) => w.id === param);
  if (!check) return '<div class="karte"><p>Dieser Check ist nicht mehr gespeichert.</p><div class="knopf-reihe"><button type="button" class="knopf" data-act="seite" data-seite="warnzeichen">Check noch einmal</button></div></div>';
  const r = ez.warnzeichenAuswerten(check.ja, stand);
  // W1: nur der 112-Abschnitt, groß – alles andere würde jetzt nur ablenken.
  if (r.abschnitte.length && r.abschnitte[0].id === 'W1') {
    const a = r.abschnitte[0];
    return `
      <div class="karte gefahr notruf-karte" role="alert" data-regel="W1">
        <p class="gross">${esc(a.text)}</p>
        <div class="knopf-reihe">${a.anrufe.map((x) => anrufKnopf(x.nummer, x.text, { notruf: true, breit: true })).join('')}</div>
      </div>`;
  }
  // Die Stufe je Abschnitt in Worten – bei seelischer Not mit dem Titel des
  // Kerns (ein Gesprächsangebot, nicht „Sofort 112").
  const kopf = ez.kopfFuer(r.stufe, r.abschnitte);
  const karten = r.abschnitte.map((a) => `
    <div class="karte ${hinweisKlasse(a.stufe)} warn-abschnitt" data-regel="${esc(a.id)}"${a.stufe === 'notruf' ? ' role="alert"' : ''}>
      ${stufeZeile(a.stufe, ez.kopfFuer(a.stufe, [a]).titel)}
      <p>${esc(a.text)}</p>
      ${a.anrufe.length ? `<div class="knopf-reihe anruf-reihe">${a.anrufe.map((x) => anrufKnopf(x.nummer, x.text, { notruf: x.nummer === '112', breit: true })).join('')}</div>` : ''}
    </div>`).join('');
  const nichts = r.abschnitte.length === 1 && r.abschnitte[0].id === 'W3';
  return `
    ${r.abschnitte.length > 1 ? `<p class="stufe-zeile ergebnis-kopf">Zusammen: ${stufeSchild(r.stufe, kopf.titel)}</p>` : ''}
    ${karten}
    ${nichts ? '<div class="knopf-reihe"><button type="button" class="knopf" data-act="seite" data-seite="frage">Frage notieren</button></div>' : ''}
    <p class="klein gedaempft" style="margin-top:.8rem">Gespeichert am ${esc(datumInWorten(check.datum))}${check.uhr ? `, ${esc(uhrText(check.uhr))}` : ''}. Ändert sich etwas plötzlich, den Check einfach noch einmal machen.</p>`;
}

// ---------------------------------------------------------------- Abstand

function abstandSeite(stand) {
  const plan = ez.abstandPlan(stand);
  return {
    titel: 'Was braucht Abstand?',
    html: `
      <p class="gedaempft" style="margin-bottom:.8rem">Ihre Tablette: ${esc(uhrText(stand.einstellungen.erinnerung))}. Daraus ergibt sich:</p>
      ${plan.map((p) => `
        <div class="karte abstand-eintrag${p.wichtig ? ' wichtig' : ''}" data-mittel="${esc(p.key)}">
          ${p.wichtig ? '<p class="wichtig-marke">Wichtig</p>' : ''}
          <h2>${esc(p.name)}</h2>
          ${p.ab ? `<p class="abstand-uhr">ab ${esc(uhrText(p.ab))}</p>` : ''}
          <p>${esc(p.text)}</p>
        </div>`).join('')}
      ${stand.mittel.length ? '' : '<p class="klein gedaempft" style="margin-top:.4rem">Weitere Mittel, die Sie nehmen, tragen Sie unter „Über mich & weitere Mittel" ein – dann stehen sie hier mit Uhrzeit.</p>'}
      <div class="knopf-reihe"><button type="button" class="knopf" data-act="seite" data-seite="profil">Weitere Mittel eintragen</button></div>`,
  };
}

// ---------------------------------------------------------------- Nach dem Befinden

/*
 * Nach dem Speichern des Befindens, wenn es nicht warten kann: eine
 * Notfall-Notiz (R2) zeigt den 112-Text groß, „nicht mehr leben möchten" den
 * Text W5 mit den Nummern, Puls und Herzklopfen die Texte S4/R3.
 */
function befindenHinweisSeite(param, stand, heute) {
  const b = stand.befinden.find((x) => x.id === param);
  const teile = [];
  if (b && ez.notfallWorte(b.notiz)) teile.push(w1Karte(stand));
  if (b && b.beschwerden.includes('lebensmuede')) teile.push(w5Karte(ez.W5_TEXT, { alert: true }));
  if (b && (b.beschwerden.includes('puls') || b.beschwerden.includes('herz'))) {
    ez.beschwerdenAuswerten(stand, heute).texte
      .filter((t) => ['S4', 'S4ii', 'R3'].includes(t.id))
      .forEach((t) => teile.push(beschwerdeKarte(t)));
  }
  teile.push(`<p class="gedaempft" style="margin:.4rem 0">Ihr Befinden ist gespeichert${b ? ` (${esc(datumInWorten(b.datum))})` : ''}.</p>
    <div class="knopf-reihe"><button type="button" class="knopf" data-act="zurueck">Fertig</button></div>`);
  return { titel: 'Wichtig', html: teile.join('') };
}

// ---------------------------------------------------------------- Weiche

/** Seiten dieses Bereichs: { titel, html } oder null. */
export function einschaetzungSeite(name, param, stand, heute) {
  switch (name) {
    case 'befinden-hinweis': return befindenHinweisSeite(param, stand, heute);
    case 'gesamtbild': return gesamtbildSeite(stand, heute);
    case 'warnzeichen': return { titel: 'Warnzeichen prüfen', html: warnFormular(stand) };
    case 'warnzeichen-ergebnis': return { titel: 'Ergebnis', html: warnErgebnis(param, stand) };
    case 'abstand': return abstandSeite(stand);
    default: return null;
  }
}
