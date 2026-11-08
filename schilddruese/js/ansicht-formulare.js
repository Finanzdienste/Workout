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
import { esc, kuerzen, saeubern, einzeilig, zeichenZahl } from './text.js';
import * as sp from './speicher.js';
import * as ez from './einschaetzung.js';
import { befundPruefen } from './einheiten.js';
import { E14_TEXT, E16_TEXT } from './wissen.js';
// Als Namensraum (Runde 8: J7): Das Befund-Formular braucht wartetAufPraxis
// und PRAXIS_DANACH – und nutzt entscheidungNachEigener/praxisDanachVermerken
// aus js/dosis.js, sobald sie dort ausgeführt sind (siehe vermerkPraxisDanach).
import * as dz from './dosis.js';
import { wahlFrage, JNW_WAHL, BEFUND_FRAGEN, w1Karte, P6_HAKEN } from './ansicht-einschaetzung.js';

const feldDatum = (name, wert, titel = 'Datum', hinweis = '', max = '') => `
  <label class="feld"><span>${titel}</span>
    <input type="date" name="${name}" value="${esc(wert)}"${max ? ` max="${esc(max)}"` : ''} required>
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

/*
 * Eine gespeicherte Zahl zurück ins Eingabefeld: 2.1 → „2,1", nichts → leer.
 * Nie mit Exponent: Aus einer Sicherung stand sonst „1e+23" im Feld, und ein
 * bloßes „Speichern" scheiterte an „Bitte die Anzahl eintragen" – zahlAus()
 * liest keinen Exponenten (Runde 5: F29).
 */
function zahlFeld(wert) {
  if (wert === null || wert === undefined) return '';
  let s = String(wert);
  if (/e/i.test(s) && typeof wert === 'number' && Number.isFinite(wert)) {
    s = wert.toLocaleString('en-US', { useGrouping: false, maximumFractionDigits: 20 });
  }
  return s.replace('.', ',');
}

const feldZahl = (name, wert, titel, { hinweis = '', platzhalter = '' } = {}) => `
  <label class="feld"><span>${titel}</span>
    <input type="text" inputmode="decimal" name="${name}" value="${esc(zahlFeld(wert))}" placeholder="${esc(platzhalter)}" autocomplete="off">
    ${hinweis ? `<span class="hinweis">${hinweis}</span>` : ''}
  </label>`;

/*
 * Runde 5: F23 – Längengrenzen und Zähler. Vorher hatte kein Feld eine Grenze,
 * und beim Speichern wurde still gekürzt: Eine diktierte Frage mit 360
 * Zeichen verlor ihr Ende („… vor der Blutabnahme weglassen?"), die Meldung
 * sagte trotzdem „Frage gespeichert". Jetzt nimmt jedes Feld nur so viel an,
 * wie gespeichert wird (maxlength = sp.GRENZEN – dieselben Grenzen wie in
 * normStand), und unter jedem mehrzeiligen Feld steht, wie viel hineinpasst.
 * Wird es knapp, zählt der Satz herunter; schneidet das Feld beim Einfügen
 * oder Diktieren etwas ab, sagt er „voll" – dann sieht die Nutzerin nach, ob
 * das Ende fehlt. Gezählt wird wie bei maxlength (UTF-16-Einheiten), damit
 * „voll" genau dann erscheint, wenn das Feld nichts mehr annimmt.
 */
const ZAEHLER_AB = 100;   // so viele Zeichen vor der Grenze wird aus „höchstens …" ein „noch …"

export function zaehlerText(laenge, max) {
  const rest = max - laenge;
  if (rest <= 0) return `Das Feld ist voll – mehr als ${max} Zeichen passen nicht hinein.`;
  if (rest <= ZAEHLER_AB) return `Noch ${rest} Zeichen frei.`;
  return `Höchstens ${max} Zeichen.`;
}

/** Beim Tippen: den Zähler unter einem Textfeld nachführen (js/app.js, Ereignis „input"). */
export function zaehlerNachfuehren(el) {
  if (!el || el.tagName !== 'TEXTAREA') return;
  const id = (el.getAttribute('aria-describedby') || '').split(/\s+/).find((x) => x.startsWith('zaehler-'));
  const z = id ? document.getElementById(id) : null;
  if (!z) return;
  const max = Number(z.dataset.max);
  const text = zaehlerText(el.value.length, max);
  if (z.textContent !== text) z.textContent = text;
  z.classList.toggle('voll', el.value.length >= max);
}

/*
 * `max`: die Grenze aus sp.GRENZEN. Mehrzeilige Felder bekommen dazu den
 * Zähler – sichtbar unter dem Feld, für Vorleseprogramme als Beschreibung des
 * Felds (aria-describedby); im Namen des Felds soll er nicht mitgelesen werden.
 */
const feldText = (name, wert, titel, { hinweis = '', platzhalter = '', lang = false, max = 0 } = {}) => {
  const zaehler = lang && max ? `zaehler-${name}` : '';
  const laenge = String(wert || '').length;
  return `
  <label class="feld"><span>${titel}</span>
    ${lang
    ? `<textarea name="${name}" placeholder="${esc(platzhalter)}"${max ? ` maxlength="${max}"` : ''}${zaehler ? ` aria-describedby="${zaehler}"` : ''}>${esc(wert || '')}</textarea>`
    : `<input type="text" name="${name}" value="${esc(wert || '')}" placeholder="${esc(platzhalter)}"${max ? ` maxlength="${max}"` : ''} autocomplete="off">`}
    ${hinweis ? `<span class="hinweis">${hinweis}</span>` : ''}
    ${zaehler ? `<span class="hinweis zaehler${laenge >= max ? ' voll' : ''}" id="${zaehler}" data-max="${max}" aria-hidden="true">${esc(zaehlerText(laenge, max))}</span>` : ''}
  </label>`;
};

/*
 * Ein Text aus dem Formular, so wie normStand ihn beim nächsten Laden liest:
 * ohne Steuerzeichen, nach ganzen Zeichen auf die Grenze gekürzt – maxlength
 * lässt ohnehin nicht mehr zu, also geht hier nichts verloren (F23). Vorher
 * `.slice(0, 300)` nach UTF-16-Einheiten: Ein Emoji an der Grenze blieb halb
 * stehen und kam in der Kalenderdatei als „�" an (Runde 5: F23, F25).
 * `zeile`: ein einzeiliges Feld (Präparat, Labor, Ort, Anrede).
 */
export const textAus = (roh, max) => kuerzen(saeubern(String(roh || '')).trim(), max);
export const zeileAus = (roh, max) => kuerzen(einzeilig(String(roh || '')), max);

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
  /*
   * Runde 8 – Nachbesserung (Anordnung an erster Stelle, Entscheidung (5)):
   * „davor" – die Menge VOR der neuen Dosis der Praxis, die am
   * Einrichtungstag den einzigen Eintrag ersetzt hat (Karte D0.16, Knopf
   * „Dosis eintragen"). Vorher öffnete der Knopf das gewöhnliche „Neue
   * Dosis"-Formular mit „Gilt ab" = heute und dem Satz „Hier kommt die neue
   * dazu, so wie die Ärztin sie verordnet hat" – das Gegenteil dessen, was
   * die Karte verlangte. Wer „Gilt ab" stehen ließ, bekam „Haben Sie bis heute
   * 125 µg genommen?"; „Nein" ersetzte die Anordnung der Praxis (nur noch die
   * alte Menge „auf Anweisung der Praxis"), „Ja" machte aus der Menge davor
   * eine Senkung. Jetzt heißt das Formular „Dosis eintragen", sagt, was
   * einzutragen ist, lässt „Gilt ab" leer, und dosisAbsenden verlangt einen
   * Tag vor der Anordnung (anordnungAmAnfang).
   */
  const anordnungDavor = id === 'davor' ? anordnungAmAnfang(stand, heute) : null;
  const dosisId = ausPraxis || id === 'davor' ? null : id;
  const da = dosisId ? stand.dosen.find((d) => d.id === dosisId) : null;
  const letzte = sp.aktuelleDosis();
  /*
   * Runde 8: J12 – nach „Nein, ich nehme etwas anderes" ist der neue Eintrag
   * die Berichtigung. Vorher hieß das Formular trotzdem „Neue Dosis", sagte
   * „Hier kommt die neue dazu, so wie die Ärztin sie verordnet hat" und
   * belegte „Gilt ab" mit heute vor – das verleitete zu „Gilt ab = heute"
   * statt zum Tag, seit dem die Menge wirklich genommen wird. Jetzt heißt es
   * „Dosis berichtigen", der Hinweis sagt, was einzutragen ist, und „Gilt
   * ab" bleibt leer, damit eine bewusste Wahl nötig ist. NICHT mit dem Beginn
   * des berichtigten Eintrags vorbelegen: Bei einer vergessenen Änderung der
   * Praxis (J9) überschriebe das die früher genommene Menge rückwirkend.
   * Runde 8: H-N1 (4) / Entscheidung (2) (N2-2) – wartet das „Nein" nach einer
   * eingetragenen Anordnung noch auf die Menge für die Zeit davor, heißt das
   * Formular „Dosis eintragen": Ein „Gilt ab" vor der Anordnung berichtigt
   * den Eintrag davor, eines ab dem Tag der Anordnung ist eine neue Dosis.
   */
  const nein = !da && !ausPraxis && !anordnungDavor ? neinOffen(stand, heute) : null;
  const berichtigt = Boolean(nein && !nein.anordnung && istBerichtigungJetzt(stand, null, heute));
  const vorAnordnung = nein && nein.anordnung ? nein : null;
  const davor = vorAnordnung ? ez.dosisAmIn(stand, tageWeiter(vorAnordnung.anordnung.ab, -1)) : null;
  const d = da || { praeparat: letzte ? letzte.praeparat : 'L-Thyroxin', mikrogramm: null, tabletten: 1, ab: berichtigt || vorAnordnung || anordnungDavor ? '' : heute, notiz: '', praxis: ausPraxis ? true : null };
  // Die erste Dosis ist keine Änderung – bei ihr fragt die App nicht nach der
  // Quelle, außer sie hat schon eine oder ist eine Berichtigung (Runde 7: H12).
  const mitQuelle = mitQuelleFuer(stand, da);
  const hinweis = da ? ''
    : berichtigt ? 'Tragen Sie ein, was Sie wirklich nehmen, und bei „Gilt ab" den Tag, seit dem Sie es nehmen – ungefähr genügt. Der bisherige Eintrag wird dadurch berichtigt.'
      : vorAnordnung ? `Ab ${datumKurz(vorAnordnung.anordnung.ab)} gilt die neue Dosis der Praxis (${mengeText(vorAnordnung.anordnung)}). Tragen Sie hier ein, was Sie ${vorAnordnung.anordnung.ab > heute ? 'bis dahin wirklich nehmen' : 'vorher wirklich genommen haben'}, und bei „Gilt ab" den Tag, seit dem – ungefähr genügt.${davor ? ` Der Eintrag ab ${datumKurz(davor.ab)} (${mengeText(davor)}) wird dadurch berichtigt.` : ''} Mit „Gilt ab" am ${datumKurz(vorAnordnung.anordnung.ab)} oder später tragen Sie stattdessen eine neue Dosis ein.`
        : anordnungDavor ? `Ab ${datumKurz(anordnungDavor.ab)} gilt die neue Dosis der Praxis (${mengeText(anordnungDavor)}). Tragen Sie hier ein, was Sie vorher genommen haben, und bei „Gilt ab" den Tag, seit dem – ungefähr genügt.`
          : letzte ? `Die bisherige Dosis (${sp.dosisText(letzte)}) bleibt im Verlauf stehen. Hier kommt die neue dazu, so wie die Ärztin sie verordnet hat.` : '';
  return {
    titel: da ? 'Dosis ändern' : berichtigt ? 'Dosis berichtigen' : vorAnordnung || anordnungDavor ? 'Dosis eintragen' : 'Neue Dosis',
    html: `
      <form data-formular="dosis" ${dosisId ? `data-id="${esc(dosisId)}"` : ''} novalidate>
        ${ausPraxis ? '<input type="hidden" name="weg" value="praxis">' : anordnungDavor ? '<input type="hidden" name="weg" value="davor">' : ''}
        ${hinweis ? `<div class="hinweis-karte"><span class="ri" aria-hidden="true">ℹ️</span><div>${esc(hinweis)}</div></div>` : ''}
        ${feldText('praeparat', d.praeparat, 'Präparat', { platzhalter: 'z. B. L-Thyroxin Henning', hinweis: 'So, wie es auf der Packung steht. Ein Herstellerwechsel ist auch eine Änderung.', max: sp.GRENZEN.praeparat })}
        ${feldZahl('mikrogramm', d.mikrogramm, 'Stärke in µg (Mikrogramm)', { platzhalter: 'z. B. 75', hinweis: 'Die Zahl auf der Packung, z. B. 50, 75 oder 100.' })}
        ${tablettenWahl(d.tabletten)}
        ${feldDatum('ab', d.ab, 'Gilt ab', 'Der Tag, ab dem diese Dosis genommen wird. Liegt er in der Zukunft, nennt „Heute" bis dahin weiter die bisherige Dosis.')}
        ${mitQuelle ? wahlFrage('praxis', d.praxis === true ? 'ja' : d.praxis === false ? 'nein' : '', 'Auf Anweisung der Praxis?', {
    optionen: [['ja', 'Ja'], ['nein', 'Nein']],
    hinweis: 'Steht im Bericht für den Arzttermin. Bei „Nein" erinnert die App daran, der Praxis Bescheid zu sagen.',
  }) : ''}
        ${feldText('notiz', d.notiz, 'Notiz (freiwillig)', { platzhalter: 'z. B. nach Laborkontrolle im März', max: sp.GRENZEN.notiz })}
        <p class="klein gedaempft" style="margin-bottom:.6rem">${esc(E16_TEXT)}</p>
        ${fuss('dosis', dosisId)}
      </form>`,
  };
}

/*
 * Die Stärke einer Tablette. Unter 5 oder über 400 µg ist sicher ein
 * Tippfehler oder eine andere Einheit (0,075 mg) – das nimmt das Feld nicht.
 * Dazwischen, aber außerhalb der üblichen 12,5 bis 300 µg, fragt die App
 * nach, ebenso bei einem Sprung der Tagesdosis um mehr als die Hälfte. Ein
 * Kommafehler wie „7,5" statt „75" ging vorher still durch: Beim Einrichten
 * stand danach täglich „7,5 µg" auf „Heute", bei „Neue Dosis" wurde daraus
 * eine Senkung um 90 % „auf Anweisung der Praxis". Die Meldung der harten
 * Grenze nannte zudem 12,5 bis 300 µg, geprüft wurde 5 bis 400 (Runde 4: E10).
 * Auch fürs Einrichten (js/ansicht-willkommen.js).
 */
export const STAERKE_GRENZE_TEXT = 'Bitte prüfen: Hier passen nur Stärken zwischen 5 und 400 µg (Mikrogramm). Steht auf der Packung „mg" (Milligramm): 0,1 mg sind 100 µg.';

/** Die Rückfrage zu einer ungewöhnlichen Stärke – oder null. */
export function staerkeUngewoehnlich(mikrogramm) {
  if (mikrogramm === null || (mikrogramm >= 12.5 && mikrogramm <= 300)) return null;
  return `${zahlFeld(mikrogramm)} µg ist eine ungewöhnliche Stärke. Übliche Stärken liegen zwischen 12,5 und 300 µg.`;
}

/**
 * Was die Rückfrage (in js/app.js rueckfrageZeigen) unter die Punkte
 * schreibt, und welches Feld „Korrigieren" ansteuert. Ohne eigenen Satz
 * stünde dort „Steht es genau so auf dem Befund?" – gemeint ist die Packung.
 */
export const STAERKE_RUECKFRAGE = { satz: 'Steht die Zahl genau so auf der Packung?', feld: 'mikrogramm' };
const SPRUNG_RUECKFRAGE = { satz: 'Stimmen Stärke und Tabletten am Tag genau so?', feld: 'mikrogramm' };

/** Die Menge, auf die sich „Nein, ich nehme etwas anderes" bezog („nein_87_5" → 87,5) – wie neinDosis in js/dosis.js. */
function neinMenge(antwort) {
  const m = /^nein_(\d+)(?:_(\d+))?$/.exec(antwort || '');
  return m ? Number(`${m[1]}.${m[2] || '0'}`) : null;
}

/**
 * Dieselbe Tablette in derselben Menge – kein Wechsel, nur ein zweiter
 * Eintrag (wie aenderungsArt 'doppelt' in js/dosis.js).
 */
function gleicheDosis(a, b) {
  const name = (x) => String(x.praeparat || '').trim().toLowerCase();
  return name(a) === name(b) && a.mikrogramm === b.mikrogramm && a.tabletten === b.tabletten;
}

/*
 * Steht auf der Dosis-Karte „Nein, ich nehme etwas anderes", ist der Eintrag
 * die Berichtigung – keine neue Anordnung. Das bleibt am Eintrag stehen, auch
 * wenn die Antwort gleich wegfällt; sonst hielte die Karte ihn bei „Auf
 * Anweisung der Praxis: Ja" für eine beschlossene Änderung und meldete „Kein
 * besonderer Anlass" (Nachprüfung zu B26).
 * Aber nur die jüngste Antwort zum Befund, um den es jetzt geht, und nur,
 * solange danach noch nichts eingetragen ist. Vorher genügte irgendeine
 * liegengebliebene Antwort „Nein", auch zu einem früheren Befund: Die
 * nächste echte Änderung – auch eine der Praxis – galt Monate später als
 * Berichtigung, ohne Kontrolle (D6c) und ohne Nachfrage nach einer
 * Erhöhung (W-D4) (C17).
 *
 * „Danach eingetragen" heißt: mit einer anderen Menge als der, auf die
 * sich das Nein bezog – wie in js/dosis.js. Am Einrichtungstag beginnt
 * die eine Dosis oft „ab heute", am Tag der Antwort: Sie selbst ist die
 * falsche Menge, keine Berichtigung. Galt sie als eine, wurde ein neuer
 * Eintrag mit der richtigen Menge zur „eigenen Änderung" – mit „nehmen
 * Sie wieder Ihre bisherige Menge", also der falschen (Runde 3: D19).
 *
 * Eine eigene Funktion seit Runde 6 (G11): Die Rückfrage „nie genommen?"
 * braucht die Antwort schon vor dem Speichern. `alt`: der Eintrag, der
 * gerade geändert wird, oder null.
 */
/** Die jüngste Antwort „Nein, ich nehme etwas anderes" zum Befund, um den es jetzt geht – ob offen oder nicht. */
function neinAntwort(s, heute) {
  const befund = dz.dosisBefund(s, heute);
  const antwort = befund ? [...s.nachfragen].reverse().find((n) => n.art === 'dosis_stimmt' && n.bezug === befund.id) : null;
  return antwort && /^nein/.test(antwort.antwort) ? antwort : null;
}

/*
 * Runde 8: H-N1 – das offene „Nein, ich nehme etwas anderes" zum Befund, um
 * den es jetzt geht, mit der Menge, auf die es sich bezog, und – wenn danach
 * eine Anordnung der Praxis eingetragen wurde – dieser Anordnung
 * (`anordnung`, siehe dosisAbsenden): Dann wartet das „Nein" noch auf die
 * Menge für die Zeit davor; die Anordnung und Einträge ab ihrem Tag erledigen
 * es nicht. → { antwort, am, menge, anordnung } | null
 */
function neinOffen(s, heute) {
  const antwort = neinAntwort(s, heute);
  if (!antwort) return null;
  const anordnung = antwort.anordnung ? s.dosen.find((d) => d.id === antwort.anordnung) || null : null;
  const menge = neinMenge(antwort.antwort);
  /*
   * Runde 8 – Nachbesserung (B): wie die Karte (js/dosis.js, `berichtigt`) –
   * gilt heute schon eine andere Menge als die, auf die sich das „Nein"
   * bezog, ist es erledigt. Vorher sah das Formular nur Einträge ab dem Tag
   * des „Nein": Hatte eine Anordnung über den Weg der Praxis den Eintrag der
   * genannten Menge an Ort und Stelle ersetzt („ersetzen?", 125 → 112,5 seit
   * 01.01.), hielt die Karte das „Nein" für erledigt, das Formular nicht –
   * die nächste eigene Senkung wurde still eine Berichtigung, ohne X3/B2.
   * Runde 8 – Nachbesserung 2 (A, Folge (iii)): die Regel gilt für JEDE
   * Frage nach dem „Nein", nicht nur für istBerichtigungJetzt. Vorher sah
   * dosisAbsenden ein so erledigtes „Nein" weiter als offen: Eine danach
   * geplante Anordnung (100 µg ab 01.10.) belebte es wieder (geplantTrotzNein)
   * – Meldung „Bitte tragen Sie jetzt noch ein, was Sie im Moment nehmen.",
   * das Formular öffnete sich, und die Karte bat um die Menge vor dem 01.10.
   * wegen „nicht die eingetragenen 100 µg", die längst berichtigt waren.
   */
  if (!anordnung && menge !== null) {
    const heuteTd = sp.tagesdosis(ez.dosisAmIn(s, heute));
    if (heuteTd !== null && heuteTd !== menge) return null;
  }
  return { antwort, am: antwort.am, menge, anordnung };
}

function istBerichtigungJetzt(s, alt, heute) {
  const nein = neinOffen(s, heute);
  if (!nein) return false;
  return !s.dosen.some((d) => d !== alt && d.ab >= nein.am && (nein.menge === null || sp.tagesdosis(d) !== nein.menge)
    && !(nein.anordnung && d.ab >= nein.anordnung.ab));
}

/*
 * Runde 8 – Nachbesserung (Anordnung an erster Stelle, Entscheidung (5)): die
 * neue Dosis der Praxis, die an erster Stelle steht – sie hat am
 * Einrichtungstag den einzigen Eintrag ersetzt („Nein, das war falsch"). Die
 * Karte (D0.16, js/dosis.js anordnungAmAnfang) bittet dann um die Menge davor;
 * der Weg „davor" des Formulars trägt sie nach. → der Eintrag oder null
 *
 * Runde 8 – Nachbesserung 2 (Weg „davor" mit neuerem Befund): genau die Regel
 * der Karte – js/dosis.js anordnungAmAnfang ohne Befund, also zu JEDEM Befund
 * mit „Die Dosis wird geändert" (karte N3), nicht nur zum jüngsten. Vorher
 * fragte das Formular nur den jüngsten Befund (anordnungEingetragen): Kam
 * nach der Anordnung ein Kontrollbefund dazu, zeigte die Karte weiter D0.16
 * „Was haben Sie vor der neuen Dosis genommen?" mit dem Knopf „davor", das
 * Formular öffnete aber „Neue Dosis" mit „Gilt ab" heute und „Hier kommt die
 * neue dazu …". Die Menge davor wurde so eine Senkung ab heute „auf Anweisung
 * der Praxis" (Bericht „Aktuell: 100 µg seit heute", obwohl sie 125 µg
 * nimmt), oder „Nein, das war falsch" ersetzte die Anordnung der Praxis.
 */
function anordnungAmAnfang(stand, heute) {
  return typeof dz.anordnungAmAnfang === 'function' ? dz.anordnungAmAnfang(stand, null, heute) : null;
}

/*
 * Runde 6: G11 – Die Praxis ordnet 100 µg an, eingetragen ab 04.06., genommen
 * aber weiter 75 µg. Nach „Nein, ich nehme etwas anderes" trägt die Nutzerin
 * 75 µg ein, und die Dosis-Karte bittet, „Gilt ab" auf den Tag zu setzen,
 * seit dem sie es nimmt – 2024. Rückte die Berichtigung so vor die 100 µg,
 * galten diese wieder als ihre Dosis, auf der Karte und im Arztbericht „auf
 * Anweisung der Praxis"; die Berichtigung war aus allen Ansichten weg, und
 * die Ärztin rechnete von 100 µg aus weiter.
 *
 * Seitdem vermerkt eine Berichtigung den Eintrag, den sie berichtigt
 * (`statt`, js/speicher.js ersetztDurchBerichtigung): Liegt er nach ihrem
 * „Gilt ab", galt er nach ihrer Angabe nie – ebenso alles dazwischen mit
 * anderer Menge. Beim Anlegen ist das der Eintrag, nach dem die Karte gefragt
 * hat, also der, der heute gilt. Eine Berichtigung aus älteren Fassungen hat
 * keinen Vermerk. Rückt ihr „Gilt ab" vor einen Eintrag mit anderer Menge,
 * fragt das Formular nach („nie genommen?", in dosisAbsenden), statt die nie
 * genommene Menge still wieder gelten zu lassen.
 *
 * Runde 7: H1 – welche Einträge es trifft, rechnet das Formular probehalber
 * mit derselben Regel wie Karte und Bericht (probeDosen, ez.nieGegolten) und
 * nennt sie alle. Vorher suchte es selbst nach dem jüngsten Eintrag mit
 * anderer Menge: Der Dialog nannte nur die 100 µg, gestrichen wurde auch ein
 * Eintrag dazwischen, und einer mit derselben Menge galt als nie genommen.
 *
 * Die Dosen, wie sie nach dem Speichern stünden: `neu` ersetzt `da` (oder
 * kommt dazu). Wer „Gilt ab" ändert, sagt es zuletzt – der Eintrag steht dann
 * hinter anderen Einträgen desselben Tages, wie ein neuer (Runde 7: H18; von
 * mehreren Einträgen eines Tages zählt der letzte, ez.dosisVerlauf).
 */
function probeDosen(dosen, da, neu) {
  const liste = da && da.ab === neu.ab ? dosen.map((d) => (d === da ? neu : d)) : [...dosen.filter((d) => d !== da), neu];
  return liste.sort((a, b) => a.ab.localeCompare(b.ab));
}

/** Die Einträge, die nach dem Speichern neu als nie genommen zählten – in ihrer Reihenfolge. */
function nieDanach(stand, da, neu, heute) {
  const vorher = ez.nieGegolten(stand, heute);
  return [...ez.nieGegolten({ ...stand, dosen: probeDosen(stand.dosen, da, neu) }, heute).keys()]
    .filter((d) => d !== neu && !vorher.has(d)).sort((a, b) => a.ab.localeCompare(b.ab));
}

/*
 * Runde 7: H1 – beginnt die Berichtigung mit ihrem „Gilt ab" einen Zeitraum,
 * in dem später schon ein Eintrag mit derselben Menge steht? Die Karte rät
 * „ungefähr genügt": 75 µg „seit Anfang 2024" lag dann vor den 75 µg, die die
 * Praxis am 14.05.2024 angeordnet hatte. Im Bericht stand „Aktuell: 75 µg
 * seit 01.01.2024 – auf Anweisung der Praxis: nein", die 50 µg davor „laut
 * App; später berichtigt" und beim Befund vom März „Dosis damals 75 µg". Das
 * ungefähre Datum soll den genaueren Eintrag nicht still überstimmen – das
 * Formular fragt. → der vorhandene Eintrag oder null
 */
function gleicheMengeSpaeter(stand, da, neu, heute) {
  const v = ez.dosisVerlauf({ ...stand, dosen: probeDosen(stand.dosen, da, neu) }, heute);
  const i = v.findIndex((p) => p.erster === neu);
  const td = sp.tagesdosis(neu);
  if (i < 0 || td === null || (i > 0 && sp.tagesdosis(v[i - 1].d) === td)) return null;
  for (let k = i; k < v.length && sp.tagesdosis(v[k].d) === td; k++) {
    const x = v[k].eintraege.find((e) => e !== neu && e.ab > neu.ab);
    if (x) return x;
  }
  return null;
}

/** „Ab 04.06.2026 ist noch 100 µg am Tag eingetragen (auf Anweisung der Praxis)." */
const nochEingetragen = (x, wort = 'noch') => `Ab ${datumKurz(x.ab)} ist ${wort} ${mengeText(x)} eingetragen${x.praxis === true ? ' (auf Anweisung der Praxis)' : ''}.`;
const mengeText = (d) => {
  const td = sp.tagesdosis(d);
  return td !== null ? `${zahlFeld(td)} µg am Tag` : sp.dosisText(d);
};

/*
 * Ab der zweiten Dosis zählt, ob die Praxis sie angeordnet hat. Runde 7: H12 –
 * auch bei einer Berichtigung, die vor den einzigen Eintrag gerückt ist (wie
 * die Karte rät) und jetzt an erster Stelle steht: Sonst fehlte beim nächsten
 * Ändern die Frage, und „Auf Anweisung der Praxis: Nein" wurde still zu
 * „nicht angegeben" – die Bitte, der Praxis Bescheid zu sagen, hing daran.
 */
// Runde 8: K13 – „hat schon eine Quelle" heißt true oder false. Der Eintrag
// vom Einrichten hatte das Feld gar nicht (undefined), und `!== null` nahm
// ihn als Eintrag mit Quelle: Direkt nach dem Einrichten verlangte „Dosis
// ändern" bei der einzigen Dosis „Auf Anweisung der Praxis?" als Pflicht, und
// die Notiz ließ sich nicht speichern – bis zum nächsten Neuladen (normStand).
const mitQuelleFuer = (stand, da) => (da ? stand.dosen.indexOf(da) >= 1 || da.berichtigung || typeof da.praxis === 'boolean' : stand.dosen.length >= 1);

function dosisAbsenden(id, f, heute) {
  const stand = sp.getStand();
  const fehler = {};
  const mikrogramm = zahlAus(f.get('mikrogramm'));
  if (mikrogramm === null || mikrogramm <= 0) fehler.mikrogramm = 'Bitte die Stärke in µg eintragen, z. B. 75.';
  else if (mikrogramm < 5 || mikrogramm > 400) fehler.mikrogramm = STAERKE_GRENZE_TEXT;
  // Der Eintrag, den das Formular ändert – oder null für einen neuen.
  const formDa = id ? stand.dosen.find((d) => d.id === id) : null;
  let ab = f.get('ab');
  if (!istISO(ab)) fehler.ab = 'Bitte ein Datum wählen.';
  else if (ab > tageWeiter(heute, 365)) fehler.ab = 'Das Datum liegt weit in der Zukunft.';
  // Eine Dosis, die erst künftig beginnt, ohne eine, die heute gilt: Dann
  // zählte keine Einnahme, der Bericht sagte „Noch keine Einnahmen erfasst",
  // und die Dosis-Karte verlangte eine Dosis, die eingetragen ist (B54).
  // Ein künftiger Tag gilt nur für eine geplante Änderung.
  else if (ab > heute && !stand.dosen.some((d) => d !== formDa && d.ab <= heute)) fehler.ab = 'Bitte tragen Sie den Tag ein, seit dem Sie diese Tablette nehmen – ungefähr genügt. Ein Tag in der Zukunft geht nur für eine geplante Änderung.';
  // Runde 8 – Nachbesserung (Anordnung an erster Stelle): der Weg „davor" der
  // Karte (verstecktes Feld `weg`, dosisFormular) trägt die Menge VOR der
  // Anordnung nach – mit einem Tag vor ihr. Am oder nach ihrem Tag käme sonst
  // „Haben Sie bis heute 125 µg genommen?", und die Anordnung der Praxis ging
  // verloren oder wurde zur Senkung.
  const anordnungDavor = !formDa && f.get('weg') === 'davor' ? anordnungAmAnfang(stand, heute) : null;
  if (anordnungDavor && !fehler.ab && ab >= anordnungDavor.ab) fehler.ab = `Die Menge davor muss vor dem ${datumKurz(anordnungDavor.ab)} begonnen haben – bitte den Tag eintragen, seit dem Sie sie nahmen (ungefähr genügt).`;
  // Ab der zweiten Dosis zählt, ob die Praxis sie angeordnet hat (Bericht,
  // Hinweise B2 und X3). Offen gelassen hieß es bisher still „unbekannt" –
  // und „unbekannt" darf nicht als „nein" gelten (B23). Deshalb Pflicht.
  const mitQuelle = mitQuelleFuer(stand, formDa);
  const quelle = f.get('praxis');
  if (mitQuelle && quelle !== 'ja' && quelle !== 'nein') fehler.praxis = 'Bitte „Ja" oder „Nein" wählen: Hat die Praxis diese Dosis angeordnet?';
  if (Object.keys(fehler).length) return { ok: false, fehler };
  const felder = {
    praeparat: zeileAus(f.get('praeparat'), sp.GRENZEN.praeparat),
    mikrogramm,
    tabletten: zahlAus(f.get('tabletten')) || 1,
    notiz: textAus(f.get('notiz'), sp.GRENZEN.notiz),
    // Ohne die Frage (erste Dosis) bleibt, was der Eintrag hatte.
    praxis: quelle === 'ja' ? true : quelle === 'nein' ? false : formDa ? formDa.praxis : null,
  };
  /*
   * Runde 8: H-N1 – der Weg „Die Praxis hat entschieden → Neue Dosis
   * eintragen" (verstecktes Feld `weg`, dosisFormular): Ein Eintrag auf
   * diesem Weg ist NIE eine Berichtigung – auch nach „Nein, ich nehme etwas
   * anderes". Vorher galt er als Berichtigung: Bericht „nimmt nach eigener
   * Angabe 88 statt 100 … seit wann offen", WW1 „Sie haben berichtigt", keine
   * Kontrolle (D6c), und das „Nein" war weg, nach der Menge bis dahin fragte
   * nichts mehr. Jetzt bleibt das „Nein" mit der Anordnung stehen (unten).
   */
  const ausPraxis = !formDa && f.get('weg') === 'praxis';
  // Eine neue Anordnung der Praxis – über ihren Weg oder mit „Auf Anweisung der Praxis: Ja".
  // Nachbesserung: die Menge VOR der Anordnung an erster Stelle (Weg „davor") ist keine neue Anordnung.
  const anordnungNeu = !formDa && !anordnungDavor && (ausPraxis || felder.praxis === true);
  const eigene = felder.praxis === false;
  const nein = neinOffen(stand, heute);
  // Runde 8 – Nachbesserung 2 (A, Folge (iii)): ein „Nein", das schon
  // erledigt ist (heute gilt eine andere Menge, neinOffen), fällt beim
  // Speichern weg – siehe unten.
  const neinErledigt = nein ? null : neinAntwort(stand, heute);
  const heuteGilt = ez.dosisAmIn(stand, heute);
  // Der Eintrag, den eine neue Berichtigung berichtigt: der heute gilt – oder,
  // wartet das „Nein" nach einer Anordnung, der vor der Anordnung (H-N1 (4)).
  const berichtigtWird = nein && nein.anordnung ? ez.dosisAmIn(stand, tageWeiter(nein.anordnung.ab, -1)) : heuteGilt;
  /*
   * Runde 8 – Nachbesserung (A): beim ÄNDERN wird die Anordnung, auf die das
   * „Nein" wartet, nie zur Berichtigung. Vorher machte „Gilt ab" der
   * Anordnung zurückdatieren (die Praxis hatte schon am 24.09. umgestellt,
   * vorbelegt war heute) sie ohne Rückfrage zur Berichtigung (berichtigung
   * true, berichtigtAm heute) und löschte das „Nein": Bericht „Berichtigung
   * (Angabe): … 88 µg statt der zuvor eingetragenen 100 µg", WW1 „Sie haben
   * berichtigt", kein D6c, die Karte riet, die Anordnung rückwirkend zu
   * machen. Das „Nein" bleibt dabei stehen; die Zeit davor rechnet danach bis
   * zum neuen „Gilt ab" (berichtigtWird).
   *
   * Runde 8 – Nachbesserung 2 (A griff zu weit): Beim Ändern ist allein der
   * Eintrag, auf den sich das „Nein" bezieht (berichtigtWird: der heute gilt,
   * oder der vor der Anordnung, auf die es wartet), mit einer ANDEREN Menge
   * die Berichtigung – auch mit „Auf Anweisung der Praxis: Ja" (laut
   * Patientin verordnet), wie über „Dosis berichtigen". Jeder andere Eintrag
   * nie: die Anordnung selbst, Einträge danach, ältere oder geplante
   * Einträge; ebenso wenig, wer nur Notiz, Präparat oder „Gilt ab" ändert.
   * Vorher galt jeder Eintrag mit „Praxis: Ja" pauschal als keine
   * Berichtigung: Wer im Wartezustand die 100 µg (vorbelegt „Ja") auf die
   * 75 µg änderte, die sie wirklich nahm, blieb im Wartezustand – die Karte
   * bat weiter um die Menge vor dem 27.09., „Dosis eintragen" lehnte 75 µg ab
   * 23.08.2025 mit „Genau diese Dosis ist schon … eingetragen" ab, es gab
   * keinen Ausweg, und der Bericht nannte „nicht die eingetragenen 100 µg",
   * die es nicht mehr gab. Ohne Anordnung fehlten nach dem Ändern X3b und im
   * Bericht „Berichtigung der eingetragenen Dosis", die derselbe Inhalt über
   * „Dosis berichtigen" bekam.
   */
  const aendernBerichtigt = !formDa || (Boolean(nein) && Boolean(berichtigtWird) && formDa.id === berichtigtWird.id
    && sp.tagesdosis(felder) !== sp.tagesdosis(formDa));
  // Runde 8: Entscheidung (2) zu H-N1 (N2-2) – solange das „Nein" mit einer
  // Anordnung wartet, ist ein Eintrag ab deren Tag eine gewöhnliche neue
  // Dosis (eigene Änderung, Anordnung, geplante Dosis), keine Berichtigung.
  // Vorher öffnete „Verlauf → Neue Dosis" dann nur „Dosis berichtigen" und
  // wies jeden Tag ab der Anordnung ab – keine eigene Senkung, keine geplante
  // Dosis eintragbar, bis zum nächsten TSH-Befund.
  const nachAnordnung = Boolean(nein && nein.anordnung && ab >= nein.anordnung.ab);
  // Runde 8: K4 (b) – „Gilt ab" in der Zukunft bei offenem „Nein": nie eine
  // Berichtigung. Als Berichtigung statt des geltenden Eintrags ließ sie
  // diesen wegfallen, und heute galt keine Dosis mehr – oder wieder die, die
  // als nie genommen gemeldet war. Das „Nein" wartet auf sie wie auf eine
  // Anordnung (unten), danach fragt das Formular nach der Menge bis dahin.
  const geplantTrotzNein = Boolean(nein && !nein.anordnung && !formDa && ab > heute);
  // Runde 8: J9 – „Ja, am … geändert" (siehe unten): dann keine Berichtigung.
  const geaendertJa = f.get('geaendert') === 'ja';
  // Berichtigung nach „Nein, ich nehme etwas anderes"? Siehe istBerichtigungJetzt.
  const berichtigtJetzt = !ausPraxis && !anordnungDavor && aendernBerichtigt && !nachAnordnung && !geplantTrotzNein && !geaendertJa && istBerichtigungJetzt(stand, formDa, heute);
  const nieVorher = new Set([...ez.nieGegolten(stand, heute).keys()].map((d) => d.id));
  // Der Eintrag, wie er gespeichert würde – zum Probe-Rechnen (Runde 7: H1).
  const probe = (tag) => (formDa ? { ...formDa, ...felder, ab: tag }
    : { id: 'probe-neu', ...felder, ab: tag, berichtigung: berichtigtJetzt, ...(berichtigtJetzt && berichtigtWird ? { statt: berichtigtWird.id } : {}) });
  /*
   * Runde 8: J9 – eine vergessene Änderung (die Praxis stellte im Februar auf
   * 88 µg um, eingetragen erst nach „Nein, ich nehme etwas anderes" im
   * September): Liegt „Gilt ab" NACH dem Beginn des Eintrags, der heute gilt,
   * kann es eine Änderung gewesen sein – vorher wurde still eine Berichtigung
   * gespeichert, ohne Kontrolle (D6c), ohne Nachfrage nach der Erhöhung
   * (W-D4), mit „nimmt nach eigener Angabe 88 statt 75 … seit wann offen" im
   * Bericht. Jetzt fragt das Formular; beide Antworten speichern (neinSendet):
   * „Ja, am … geändert" → gewöhnlicher Eintrag, „Nein, schon vorher falsch"
   * → Berichtigung wie bisher. Nicht an „Auf Anweisung der Praxis: Ja"
   * geknüpft (eine Tippfehler-Berichtigung mit „Gilt ab" = Beginn des alten
   * Eintrags fragt nicht, der Tag liegt nicht danach). Nicht bei „Gilt ab"
   * heute mit Praxis: Nein (G11: 100 µg angeordnet, nie genommen, 75 µg
   * weiter genommen – ein „Ja" machte die nie genommenen 100 µg zur Menge
   * davor, zu der X3 zurückrät) und nicht bei einem künftigen Tag.
   */
  if (berichtigtJetzt && !formDa && berichtigtWird && ab > berichtigtWird.ab && ab <= heute && !(ab === heute && eigene) && f.get('geaendert') !== 'nein') {
    return {
      ok: false,
      rueckfragen: [nochEingetragen(berichtigtWird, 'bisher')],
      rueckfrageSatz: `Hat sich Ihre Dosis ${ab === heute ? 'heute' : `am ${datumKurz(ab)}`} geändert, und war sie bis dahin richtig eingetragen?`,
      rueckfrageFeld: 'ab',
      rueckfrageName: 'geaendert',
      rueckfrageJa: `Ja, ${ab === heute ? 'heute' : `am ${datumKurz(ab)}`} geändert`,
      rueckfrageNein: 'Nein, schon vorher falsch',
      rueckfrageNeinSendet: true,
    };
  }
  /*
   * Runde 7: H1 – eine Berichtigung, deren „Gilt ab" vor einem vorhandenen
   * Eintrag mit derselben Menge liegt (siehe gleicheMengeSpaeter): fragen,
   * welcher Tag stimmt. „Ja" übernimmt den Tag des vorhandenen Eintrags,
   * „Nein, schon früher" behält den eingetragenen – beide speichern
   * (abVorhanden=ja|nein, js/app.js neinSendet). Beim Ändern nur, wenn sich
   * „Gilt ab" ändert – sonst käme die beantwortete Frage bei jeder Notiz wieder.
   */
  if ((formDa ? formDa.berichtigung && ab !== formDa.ab : berichtigtJetzt) && f.get('abVorhanden') !== 'nein') {
    const x = gleicheMengeSpaeter(stand, formDa, probe(ab), heute);
    if (x && f.get('abVorhanden') === 'ja') ab = x.ab;
    else if (x) {
      return {
        ok: false,
        rueckfragen: [nochEingetragen(x, 'schon')],
        rueckfrageSatz: `Nehmen Sie diese Menge seit dem ${datumKurz(x.ab)}? Dann gilt Ihre Angabe ab diesem Tag.`,
        rueckfrageFeld: 'ab',
        rueckfrageName: 'abVorhanden',
        rueckfrageJa: `Ja, seit dem ${datumKurz(x.ab)}`,
        rueckfrageNein: 'Nein, schon früher',
        rueckfrageNeinSendet: true,
      };
    }
  }
  const eintrag = { ...felder, ab };
  /*
   * Ein neuer Eintrag, der genau dem davor oder danach gleicht, ist keine
   * Änderung – sähe aber so aus: „Ihre Dosis wurde geändert", Kontrolle nach
   * 6–8 Wochen, bei TSH 0,08 gar „Kein besonderer Anlass" (B59, B32). Meist
   * stimmt nur der Beginn des vorhandenen Eintrags nicht (beim Einrichten
   * blieb „Seit wann?" auf heute). Dann dort „Gilt ab" ändern.
   */
  const gleichFehler = () => {
    const vorherG = [...stand.dosen].reverse().find((d) => d.ab <= ab);
    const danach = stand.dosen.find((d) => d.ab > ab);
    const gleich = vorherG && gleicheDosis(vorherG, eintrag) ? vorherG : danach && gleicheDosis(danach, eintrag) ? danach : null;
    if (!gleich) return null;
    /*
     * Runde 8 – Nachbesserung 2 (Weg „davor" mit derselben Menge): als Menge
     * VOR der neuen Dosis der Praxis genau diese Dosis – dann hat sich nichts
     * geändert. Nicht „ändern Sie beim vorhandenen Eintrag „Gilt ab"" mit
     * Knopf auf die Anordnung: Das datierte sie zurück, was Entscheidung (5)
     * ausschließt – danach bat die Karte wieder um die neue Dosis der Praxis
     * (Schleife), und WW1 fiel weg. Stattdessen: Die Praxis hat in Wahrheit
     * nichts geändert („Die Dosis bleibt so"), und sie soll es wissen.
     */
    if (anordnungDavor && gleich === anordnungDavor) {
      return {
        ok: false,
        fehler: {
          ab: `Genau diese Dosis ist ab ${datumKurz(gleich.ab)} als neue Dosis der Praxis eingetragen. Haben Sie sie schon vorher genommen, hat sich an Ihrer Dosis nichts geändert: Wählen Sie auf der Dosis-Karte bei „Die Praxis hat entschieden" „Die Dosis bleibt so", und sagen Sie es der Praxis.`,
        },
      };
    }
    const text = gleich === danach
      ? `Genau diese Dosis ist schon ab ${datumKurz(gleich.ab)} eingetragen. Nehmen Sie sie schon seit dem ${datumKurz(ab)}, ändern Sie beim vorhandenen Eintrag „Gilt ab" – ein zweiter gleicher Eintrag sähe aus wie eine Änderung der Dosis.`
      : `Genau diese Dosis ist schon seit dem ${datumKurz(gleich.ab)} eingetragen. Ein zweiter gleicher Eintrag sähe aus wie eine Änderung der Dosis. Stimmt der Tag nicht, ändern Sie „Gilt ab" beim vorhandenen Eintrag.`;
    return { ok: false, fehler: { ab: { text, knopf: { seite: 'dosis', param: gleich.id, text: 'Vorhandenen Eintrag ändern' } } } };
  };
  /*
   * Runde 7: H18 – ein neuer Eintrag (keine Berichtigung) ab demselben Tag
   * wie ein vorhandener mit anderer Dosis. Von zwei Einträgen eines Tages
   * zählt nur der letzte; der andere galt keinen Tag. Vorher speicherte das
   * Formular ohne Rückfrage: 100, 88 und 100 µg ab 20.09. standen im Bericht
   * als „Davor"-Zeiträume, und die Nachfrage nach der Erhöhung kam zweimal.
   * „Ja, ersetzen" ändert den vorhandenen Eintrag, „Nein" führt zu „Gilt ab".
   * Eine Berichtigung am Tag des berichtigten Eintrags ist gewollt (D19).
   */
  let da = formDa;
  // Runde 8: J1/J4 (a) – „Ja, bis dahin": der vorhandene Eintrag desselben
  // Tages, NEBEN den der neue tritt (Vermerk `nach`, ez.dosisVerlauf).
  let nach = null;
  /*
   * Nachprüfung zu Runde 7 (N1): Eine eigene Änderung (Praxis: Nein) ersetzt
   * keinen Eintrag desselben Tages – sie ist eine Änderung GEGENÜBER ihm.
   * „Ja, ersetzen" überschrieb die 137 µg vom Einrichten mit 274 µg: kein
   * X3, keine 112-Zeichen, keine Rückfrage „mehr als die Hälfte". Jetzt
   * kommt sie als eigener Eintrag dazu; war der vorhandene der erste, gilt er
   * als die Menge davor (ez.dosisVerlauf), sonst zählt die Menge vor diesem
   * Tag, und eine ersetzte Anordnung der Praxis nennt der Bericht.
   *
   * Runde 8: J1, J4 (Entscheidung (a)) – steht ab diesem Tag der ERSTE Eintrag
   * überhaupt (meist vom Einrichten, „Seit wann?" blieb auf heute) oder eine
   * BERICHTIGUNG, kann dessen „Gilt ab" eine Schätzung sein. Dann fragt das
   * Formular – für Anordnungen der Praxis und eigene Änderungen gleich –:
   * „Haben Sie bis … genommen?" „Ja, bis dahin" speichert den neuen Eintrag
   * daneben mit dem Vermerk `nach`: Der vorhandene ist die Menge davor, die
   * Änderung ist echt (D6c, W-D4, WW1/WW2, X3/B2). „Nein, das war falsch"
   * ersetzt wie bisher an Ort und Stelle. Vorher löschte „Ja, ersetzen" am
   * Einrichtungstag die bisherige Menge, die Änderung zählte nicht (J4), und
   * die Anordnung der Praxis erbte Marke und `statt` einer Berichtigung
   * desselben Tages (J1).
   * Runde 8: H-N2 – nur bei einem solchen Eintrag. Für einen Eintrag, der
   * selbst als Änderung eingetragen wurde und an diesem Tag beginnt, bleibt
   * „ersetzen?" (Anordnung) bzw. „daneben ohne Frage" (eigene, N1): Nach
   * einer eigenen Erhöhung 100 → 150 am Morgen und der Anordnung 125 am
   * Nachmittag machte „Ja, bis dahin" die Eintagesmenge 150 zur Menge davor,
   * und W-D4 fragte nach „verringert" statt nach „erhöht".
   * Runde 8: H-N3 – ersetzt eine Anordnung eine Berichtigung („Nein, das war
   * falsch"), fielen deren Marke und `statt` weg, und die als falsch gemeldete
   * Menge galt wieder als genommen. Deshalb ersetzt die Anordnung eine
   * Berichtigung nicht: Der Fehler am Feld führt zum Ändern der Berichtigung
   * (Knopf wie bei gleichFehler) – die einfachste Lösung, die nichts still
   * wieder gelten lässt; die Kette ohne Menge zu erhalten, ginge nicht.
   */
  if (!formDa && !berichtigtJetzt) {
    const gleich = gleichFehler();
    if (gleich) return gleich;
    const amTag = [...stand.dosen].reverse().find((d) => d.ab === ab) || null;
    const ersterGalt = ez.dosenDieGalten(stand, heute)[0] || null;
    const schaetzung = Boolean(amTag) && (amTag === ersterGalt || Boolean(amTag.berichtigung));
    if (amTag && schaetzung) {
      const antwort = f.get('bisDahin');
      if (antwort !== 'ja' && antwort !== 'nein') {
        return {
          ok: false,
          rueckfragen: [nochEingetragen(amTag, 'schon')],
          rueckfrageSatz: `Haben Sie ${ab === heute ? 'bis heute' : `bis zum ${datumKurz(ab)}`} ${mengeText(amTag)} genommen?`,
          rueckfrageFeld: 'ab',
          rueckfrageName: 'bisDahin',
          rueckfrageJa: 'Ja, bis dahin',
          rueckfrageNein: 'Nein, das war falsch',
          rueckfrageNeinSendet: true,
        };
      }
      if (antwort === 'ja') nach = amTag;
      else if (amTag.berichtigung && anordnungNeu) {
        return {
          ok: false,
          fehler: {
            ab: {
              text: `Ab ${datumKurz(amTag.ab)} ist Ihre Berichtigung eingetragen: ${mengeText(amTag)}. Stimmt sie nicht, ändern Sie bitte zuerst diese Berichtigung – auf das, was Sie vor der neuen Dosis wirklich genommen haben. Danach tragen Sie die neue Dosis ein.`,
              // Runde 8 – Nachbesserung 2 (H-N3-Weg): `merken` – nur dieser
              // Knopf merkt sich das Getippte an der Seite darunter (js/app.js
              // zeigeFehler/aktion 'seite'); jeder andere Knopf unter einem
              // Feldfehler fragt weiter „Verwerfen?" und kommt ohne alte Eingaben zurück.
              knopf: { seite: 'dosis', param: amTag.id, text: 'Berichtigung ändern', merken: true },
            },
          },
        };
      } else da = amTag;
    } else if (amTag && !eigene) {
      if (f.get('ersetzen') !== 'ja') {
        return {
          ok: false,
          rueckfragen: [nochEingetragen(amTag, 'schon')],
          rueckfrageSatz: 'Soll Ihre Angabe diesen Eintrag ersetzen? Ab einem Tag kann nur eine Dosis gelten.',
          rueckfrageFeld: 'ab',
          rueckfrageName: 'ersetzen',
          rueckfrageJa: 'Ja, ersetzen',
          rueckfrageNein: 'Nein – „Gilt ab" prüfen',
        };
      }
      da = amTag;
    }
  }
  /*
   * Runde 8 – Nachbesserung 2 (K15 beim Ändern): „Gilt ab" eines Eintrags
   * „auf Anweisung der Praxis" wird beim ÄNDERN zurückgesetzt – vor den
   * Befund, zu dem die Praxis entschieden hat, mehr als ein Jahr zurück oder
   * vor den Beginn des Eintrags, der vor ihm galt. K15 fragte nur beim
   * Anlegen, und seit A ist gerade das Zurückdatieren der Anordnung im
   * Wartezustand ein vorgesehener Weg. Ein Jahresvertipper (24.09.2025 statt
   * 24.09.2026) ging ohne Frage durch: „Aktuell: 88 µg seit 24.09.2025",
   * beim Befund vom 17.09.2026 „Dosis damals 88". Rückte die Anordnung vor
   * den Eintrag davor (01.08.2025 vor die 100 µg ab 23.08.2025), galten
   * wieder die 100 µg als Dosis von heute „auf Anweisung der Praxis", die
   * Anordnung stand nur noch als „Davor" da, „Heute" verlor WW1 (INR bei
   * Marcumar) und die Kontrolle, und im Wartezustand bat die Karte um die
   * Menge vor dem 01.08.2025. „Nein" führt zu „Gilt ab". Nicht bei einer
   * Berichtigung – sie soll mit ihrem wahren, oft frühen Beginn eingetragen
   * werden – und nicht bei eigenen Änderungen (H8: der wahre Beginn zählt).
   */
  if (formDa && felder.praxis === true && !formDa.berichtigung && !berichtigtJetzt && ab < formDa.ab && f.get('abAlt') !== 'ja') {
    const befund = dz.dosisBefund(stand, heute);
    const entschieden = befund && ez.praxisHatErklaert(befund) && befund.praxisAm ? befund : null;
    const jahr = tageWeiter(heute, -365);
    const vorBefund = Boolean(entschieden) && formDa.ab >= entschieden.datum && ab < entschieden.datum;
    const zuAlt = formDa.ab >= jahr && ab < jahr;
    const galten = ez.dosenDieGalten(stand, heute);
    const i = galten.indexOf(formDa);
    const vorDem = i > 0 && ab < galten[i - 1].ab && sp.tagesdosis(galten[i - 1]) !== sp.tagesdosis(eintrag) ? galten[i - 1] : null;
    if (vorBefund || zuAlt || vorDem) {
      return {
        ok: false,
        rueckfragen: [
          `„Gilt ab" dieser Dosis der Praxis (${mengeText(eintrag)}) ist jetzt der ${datumKurz(ab)}${zuAlt && !vorBefund ? ' – mehr als ein Jahr zurück' : ''}.`,
          ...(vorBefund ? [`Zum Befund vom ${datumKurz(entschieden.datum)} hat die Praxis am ${datumKurz(entschieden.praxisAm)} entschieden.`] : []),
          ...(vorDem ? [`Ab ${datumKurz(vorDem.ab)} ist ${mengeText(vorDem)} eingetragen${vorDem.praxis === true ? ' (auf Anweisung der Praxis)' : ''}.`] : []),
        ],
        rueckfrageSatz: `Galt sie wirklich schon seit dem ${datumKurz(ab)}?${vorDem ? ` Dann gilt ab ${datumKurz(vorDem.ab)} wieder ${mengeText(vorDem)}.` : ''}`,
        rueckfrageFeld: 'ab',
        rueckfrageName: 'abAlt',
        rueckfrageJa: `Ja, seit ${datumKurz(ab)}`,
        rueckfrageNein: 'Nein – „Gilt ab" prüfen',
      };
    }
  }
  /*
   * Nachprüfung zu Runde 7 (Rest von H18): „Gilt ab" eines vorhandenen
   * Eintrags auf einen Tag, an dem schon eine andere Menge steht. Von zwei
   * Einträgen eines Tages zählt der zuletzt gesagte; vorher geschah das ohne
   * Rückfrage, und die andere Menge verschwand still aus Bericht und Karte.
   * „Ja, ersetzen" löscht sie – außer einer Anordnung der Praxis, die der
   * Bericht als „am selben Tag ersetzt" nennt. Eine eigene Änderung fragt
   * nicht (siehe oben).
   */
  const belegt = formDa && !eigene && ab !== formDa.ab
    ? [...stand.dosen].reverse().find((d) => d !== formDa && d.ab === ab && sp.tagesdosis(d) !== sp.tagesdosis(eintrag)) : null;
  if (belegt && f.get('ersetzen') !== 'ja') {
    return {
      ok: false,
      rueckfragen: [nochEingetragen(belegt, 'schon')],
      rueckfrageSatz: 'Soll Ihre Angabe diesen Eintrag ersetzen? Ab einem Tag kann nur eine Dosis gelten.',
      rueckfrageFeld: 'ab',
      rueckfrageName: 'ersetzen',
      rueckfrageJa: 'Ja, ersetzen',
      rueckfrageNein: 'Nein – „Gilt ab" prüfen',
    };
  }
  const weg = belegt && belegt.praxis !== true ? belegt.id : null;
  const andere = stand.dosen.filter((d) => d !== da);
  const vorher = [...andere].reverse().find((d) => d.ab <= ab);
  /*
   * Runde 8: Entscheidung (1) zu H-N1 (N2-1) – die Anordnung über „Die Praxis
   * hat entschieden" bei offenem „Nein, ich nehme etwas anderes": Oft erklärt
   * die Anordnung das „Nein" schon (die Praxis hatte am 24.09. umgestellt, die
   * Karte fragte am 27.09. „genau 100?"). Blieb das „Nein" dann offen, sagte
   * der Bericht „hat sie nicht so genommen", und es gab keinen Ausweg. Jetzt
   * fragt das Formular vorher: „Ja" → gewöhnliche Änderung, das „Nein" ist
   * erledigt; „Nein, etwas anderes" → Änderung, das „Nein" bleibt mit der
   * Anordnung, danach „Dosis berichtigen" für die Zeit davor. Beide Antworten
   * speichern (neinSendet). Nur, wenn vor der Anordnung ein Eintrag mit genau
   * dieser Menge galt und das „Nein" nicht schon auf eine Anordnung wartet.
   */
  const neinBisDahin = f.get('neinBisDahin');
  const davorNein = ausPraxis && nein && !nein.anordnung && nein.menge !== null ? ez.dosisAmIn(stand, tageWeiter(ab, -1)) : null;
  const neinFrage = Boolean(davorNein) && sp.tagesdosis(davorNein) === nein.menge;
  if (neinFrage && neinBisDahin !== 'ja' && neinBisDahin !== 'nein') {
    const bis = ab > heute ? `bis zur neuen Dosis ab ${datumKurz(ab)}` : ab === heute ? 'bis heute' : `bis zum ${datumKurz(tageWeiter(ab, -1))}`;
    return {
      ok: false,
      rueckfragen: [`Ab ${datumKurz(ab)} ist ${mengeText(eintrag)} eingetragen. Auf der Dosis-Karte hatten Sie angegeben: „Nein, ich nehme etwas anderes".`],
      rueckfrageSatz: ab > heute ? `Nehmen Sie ${bis} ${mengeText(davorNein)}?` : `Haben Sie ${bis} ${mengeText(davorNein)} genommen?`,
      rueckfrageFeld: 'ab',
      rueckfrageName: 'neinBisDahin',
      rueckfrageJa: 'Ja',
      rueckfrageNein: 'Nein, etwas anderes',
      rueckfrageNeinSendet: true,
    };
  }
  /*
   * Runde 8: K15 – ein Jahresvertipper bei „Gilt ab" einer Anordnung (2025
   * statt 2026) ging still durch: „Aktuell 88 µg seit 27.09.2025", beim
   * Befund vom 17.09.2026 „Dosis damals 88 µg", keine Kontrolle, kein WW1.
   * Liegt „Gilt ab" einer neuen Anordnung vor dem Befund, zu dem die Praxis
   * entschieden hat, oder mehr als ein Jahr zurück, fragt das Formular nach.
   * „Nein" führt zu „Gilt ab".
   */
  if (anordnungNeu && !berichtigtJetzt && !nachAnordnung && f.get('abAlt') !== 'ja') {
    const befund = dz.dosisBefund(stand, heute);
    const entschieden = befund && ez.praxisHatErklaert(befund) && befund.praxisAm ? befund : null;
    /*
     * Runde 8 – Nachbesserung (E): liegt „Gilt ab" vor dem Beginn aller
     * geltenden Einträge, ist der Eintrag die Menge DAVOR (die Karte bittet
     * nach Entscheidung (5) darum: „Was haben Sie vor der neuen Dosis
     * genommen?") – keine „neue Dosis". Die Frage nannte ihn trotzdem so
     * und verwies auf die Entscheidung der Praxis zum Befund; jetzt neutral.
     */
    const ersterGalt = ez.dosenDieGalten(stand, heute)[0] || null;
    const davorAlle = Boolean(ersterGalt) && ab < ersterGalt.ab;
    if ((entschieden && ab < entschieden.datum) || ab < tageWeiter(heute, -365)) {
      return {
        ok: false,
        rueckfragen: [davorAlle
          ? `Diese Dosis ist mit „Gilt ab" ${datumKurz(ab)} eingetragen – vor allen anderen Einträgen.`
          : `Die neue Dosis ist mit „Gilt ab" ${datumKurz(ab)} eingetragen.${entschieden ? ` Zum Befund vom ${datumKurz(entschieden.datum)} hat die Praxis am ${datumKurz(entschieden.praxisAm)} entschieden.` : ''}`],
        rueckfrageSatz: davorAlle ? `Galt sie wirklich schon seit dem ${datumKurz(ab)}?` : `Gilt die neue Dosis wirklich schon seit dem ${datumKurz(ab)}?`,
        rueckfrageFeld: 'ab',
        rueckfrageName: 'abAlt',
        rueckfrageJa: `Ja, seit ${datumKurz(ab)}`,
        rueckfrageNein: 'Nein – „Gilt ab" prüfen',
      };
    }
  }
  /*
   * Runde 8: K4 – die B54-Sicherung mit dem Stand NACH dem Speichern: Eine
   * Berichtigung mit „Gilt ab" in der Zukunft ließe den Eintrag, den sie
   * berichtigt, wegfallen – dann gälte heute keine Dosis mehr (oder wieder
   * eine, die als nie genommen gemeldet war). Die Prüfung oben sieht nur die
   * Einträge, die heute da sind.
   */
  if (ab > heute && !sp.gueltigeDosen({ dosen: probeDosen(stand.dosen, da, probe(ab)) }).some((d) => d.ab <= heute)) {
    return { ok: false, fehler: { ab: `Dann wäre bis zum ${datumKurz(ab)} keine Dosis mehr eingetragen. Bitte tragen Sie den Tag ein, seit dem Sie diese Tablette nehmen – ungefähr genügt. Ein Tag in der Zukunft geht nur für eine geplante Änderung.` } };
  }
  /*
   * Runde 6: G11 – „nie genommen?" Beim Ändern einer Berichtigung ohne
   * Vermerk, deren „Gilt ab" vor einen Eintrag mit anderer Menge rückt. Beim
   * Anlegen einer Berichtigung, die genau dem Eintrag davor gleicht (75 µg
   * seit 2024, dann 100 µg ab 04.06. – nie genommen): Vorher wies das
   * Formular sie als „Genau diese Dosis ist schon … eingetragen" ab, und ihr
   * Knopf führte zum Eintrag von 2024, an dem nichts falsch war. „Ja, nie
   * genommen" schickt das Formular mit nieGenommen=ja noch einmal ab, „Nein"
   * führt zu „Gilt ab". Runde 7: H1 – die Frage nennt alle Einträge, die es
   * träfe (nieDanach), nicht nur den jüngsten.
   * → { liste, statt } – `statt`: der Eintrag für den Vermerk.
   */
  let nie = null;
  if (da && da.berichtigung && !da.statt && ab < da.ab) {
    const statt = [...andere].reverse().find((d) => d.ab <= da.ab);
    const liste = statt ? nieDanach(stand, da, { ...da, ...eintrag, statt: statt.id }, heute) : [];
    if (liste.length) nie = { liste, statt };
  } else if (!da && berichtigtJetzt && heuteGilt && vorher && gleicheDosis(vorher, eintrag)) {
    const liste = nieDanach(stand, null, probe(ab), heute);
    if (liste.length) nie = { liste, statt: heuteGilt };
  }
  if (nie && f.get('nieGenommen') !== 'ja') {
    const eine = nie.liste.length === 1;
    return {
      ok: false,
      rueckfragen: nie.liste.map((x) => nochEingetragen(x)),
      rueckfrageSatz: eine
        ? `Haben Sie das nie genommen? Dann gilt Ihre Angabe ab ${datumKurz(ab)}, und die ${mengeText(nie.liste[0])} zählen als nie genommen.`
        : `Haben Sie das alles nie genommen? Dann gilt Ihre Angabe ab ${datumKurz(ab)}, und diese Einträge zählen als nie genommen.`,
      rueckfrageFeld: 'ab',
      rueckfrageName: 'nieGenommen',
      rueckfrageJa: 'Ja, nie genommen',
      rueckfrageNein: 'Nein – „Gilt ab" prüfen',
    };
  }
  // Eine neue Berichtigung, die einem Eintrag gleicht – außer nach „nie
  // genommen?" oder „Nein, schon früher" (dann gehört sie davor, H1).
  if (!da && berichtigtJetzt && !nie && f.get('abVorhanden') !== 'nein') {
    const gleich = gleichFehler();
    if (gleich) return gleich;
  }
  /*
   * Ungewöhnliche Stärke oder ein Sprung der Tagesdosis um mehr als die
   * Hälfte gegenüber dem Eintrag davor: nachfragen wie beim Befund (Runde 4:
   * E10). „Ja, stimmt" schickt das Formular mit bestaetigt=ja noch einmal ab.
   * Ein Eintrag, dessen Stärke und Tablettenzahl gleich bleiben (nur die
   * Notiz oder der Tag geändert), fragt nicht jedes Mal wieder. Nach „Ja,
   * ersetzen" gegen die Menge vor diesem Tag (Runde 7: H18).
   */
  const unveraendert = da && da.mikrogramm === eintrag.mikrogramm && da.tabletten === eintrag.tabletten;
  // Die Stärke bis jetzt – vor dem Speichern gemerkt: Beim Ändern überschreibt
  // sp.aendern den Eintrag `da` selbst.
  const bisherMikrogramm = (da || vorher || { mikrogramm: eintrag.mikrogramm }).mikrogramm;
  if (!unveraendert && f.get('bestaetigt') !== 'ja') {
    const rueckfragen = [];
    const staerke = staerkeUngewoehnlich(eintrag.mikrogramm);
    if (staerke) rueckfragen.push(staerke);
    const alt = sp.tagesdosis(vorher);
    const neu = sp.tagesdosis(eintrag);
    if (alt && neu && Math.abs(neu - alt) > alt / 2) {
      // Runde 8: J12 – bei einer Berichtigung ist es keine „Änderung": Die
      // Menge war falsch eingetragen (12,5 statt 125 µg).
      const wieViel = neu > 2 * alt ? 'das ist mehr als das Doppelte' : neu < alt / 2 ? 'das ist weniger als die Hälfte' : 'das ist ein Unterschied um mehr als die Hälfte';
      rueckfragen.push(berichtigtJetzt
        ? `Bisher eingetragen ${zahlFeld(alt)} µg am Tag, jetzt ${zahlFeld(neu)} µg am Tag – ${wieViel}.`
        : `Bisher ${zahlFeld(alt)} µg am Tag, jetzt ${zahlFeld(neu)} µg am Tag – das ist eine Änderung um mehr als die Hälfte.`);
    }
    if (rueckfragen.length) {
      const art = rueckfragen.length === 1 && staerke ? STAERKE_RUECKFRAGE : SPRUNG_RUECKFRAGE;
      return { ok: false, rueckfragen, rueckfrageSatz: art.satz, rueckfrageFeld: art.feld };
    }
  }
  let gespeichert = da ? da.id : null;
  // Runde 8: H-N1 – wohin es nach dem Speichern geht und was die Meldung sagt
  // (siehe unten, das offene „Nein").
  let danach = null;
  let neinSatz = '';
  sp.aendern((s) => {
    const alt = da ? s.dosen.find((d) => d.id === da.id) : null;
    // Berichtigung nach „Nein, ich nehme etwas anderes"? Siehe istBerichtigungJetzt –
    // Runde 8: vor dem Speichern entschieden, mit den Ausnahmen (ausPraxis,
    // nachAnordnung, geplantTrotzNein, „Ja, am … geändert").
    const berichtigung = berichtigtJetzt;
    // Runde 6: G11 – der Vermerk, welchen Eintrag die Berichtigung berichtigt:
    // beim Anlegen der, der heute gilt (nach ihm hat die Karte gefragt); nach
    // „Ja, nie genommen" der, der am bisherigen Tag galt. Beim Ändern bleibt
    // ein vorhandener Vermerk stehen – `eintrag` enthält ihn nicht.
    // Runde 8: H-N1 (4) – wartet das „Nein" nach einer Anordnung, der Eintrag vor der Anordnung (berichtigtWird).
    const statt = !alt && berichtigung ? berichtigtWird : nie && f.get('nieGenommen') === 'ja' ? nie.statt : null;
    const vermerk = statt && s.dosen.some((d) => d.id === statt.id) && statt !== alt ? { statt: statt.id } : {};
    /*
     * Runde 6 – Rest (X3b): der Tag der Berichtigung – heute, wenn sie jetzt
     * entsteht oder „Ja, nie genommen" dazukommt (davon weiß die Praxis noch
     * nichts). Sonst bleibt er; ältere Einträge ohne ihn bekommen ihren
     * bisherigen „Gilt ab": Ab dem lief die Bitte, der Praxis zu sagen, was
     * sie nimmt. Rückt „Gilt ab" jetzt auf den wahren Beginn, wie die Karte
     * rät, endete sie sonst sofort (js/dosis.js, berichtigtAm).
     * Ohne gespeicherten Tag derselbe Ersatztag wie auf der Dosis-Karte –
     * sonst beendete schon das Ändern der Notiz die Bitte (Nachprüfung zu
     * Runde 6 – Rest).
     */
    const berichtigtAm = berichtigung || vermerk.statt || !alt ? heute
      : alt.berichtigtAm || [dz.berichtigtAm(s, alt, heute), heute].sort()[0];
    /*
     * Runde 7: H8 – der Tag, an dem die App von dieser Menge erfährt: heute
     * beim Anlegen und wenn sich Menge oder „Auf Anweisung der Praxis"
     * ändern. Seit ihm gilt eine eigene Änderung als bekannt (X3/B2 auf
     * „Heute" 14 Tage, eine Entscheidung der Praxis zählt erst danach;
     * js/dosis.js, bekanntSeit). Wer eine eigene Erhöhung erst Wochen später
     * mit dem wahren „Gilt ab" einträgt, verlor sonst beides. Nur „Gilt ab",
     * Präparat oder Notiz geändert: Der Tag bleibt.
     */
    const neueMenge = !alt || alt.mikrogramm !== eintrag.mikrogramm || alt.tabletten !== eintrag.tabletten || alt.praxis !== eintrag.praxis;
    /*
     * Runde 8 – Nachbesserung (F3): „Gilt ab" eines Eintrags, der galt, in
     * die Zukunft verschoben – das ist ein neuer Plan, von der heutigen
     * Menge abzuweichen, und seit heute bekannt. Mit dem alten Tag galt er der
     * Karte als entschieden (eine Entscheidung der Praxis lag nach dem alten
     * Tag): kein X3/B2, „Heute" nichts (js/dosis.js, geplanteEigene).
     */
    const geplantNeu = Boolean(alt) && alt.ab <= heute && eintrag.ab > heute;
    const eingetragenAm = neueMenge || geplantNeu ? heute : alt.eingetragenAm;
    if (alt) {
      const verschoben = alt.ab !== eintrag.ab;
      /*
       * Runde 8 – Nachbesserung (F1): mit neuer Menge oder Quelle ist der
       * Eintrag neu bekannt (eingetragenAm heute). Ein Vermerk „Entscheidung
       * der Praxis, während die Karte wartete" (PRAXIS_DANACH mit dieser
       * Kennung, js/dosis.js) galt der alten Menge und zählt nicht mehr –
       * sonst zeigte die Karte zur neuen, der Praxis unbekannten Menge X3/B2
       * ohne Frist („Wusste die Praxis das bei ihrer Entscheidung nicht …")
       * und „Heute" nichts. Auch die gemerkte Antwort „Nein, das war vorher"
       * (laborAbsenden) gehört zur alten Menge.
       */
      if (neueMenge) s.nachfragen = s.nachfragen.filter((n) => !(n.art === dz.PRAXIS_DANACH && n.dosis === alt.id));
      /*
       * Runde 8: J1 (Entscheidung (a)) – ersetzt eine Anordnung der Praxis
       * („Auf Anweisung der Praxis: Ja" oder der Weg der Praxis) den Eintrag
       * desselben Tages, übernimmt sie NIE berichtigung, statt oder
       * berichtigtAm des ersetzten. Vorher erbte die neue Dosis der Praxis
       * die Marke einer Berichtigung desselben Tages: Im Bericht stand
       * „Berichtigung (Angabe): nimmt nach eigener Angabe 88 µg statt der
       * zuvor eingetragenen 100 µg", WW1 sagte „Sie haben berichtigt", die
       * Kontrolle (D6c) fehlte. Eine eigene Änderung, die eine Berichtigung
       * ersetzt, behält dagegen deren Kette (Marke und statt bleiben).
       */
      if (alt !== formDa && anordnungNeu) {
        delete alt.statt;
        delete alt.berichtigtAm;
        Object.assign(alt, eintrag, { berichtigung: false }, eingetragenAm ? { eingetragenAm } : {});
      } else {
        Object.assign(alt, eintrag, berichtigung || alt.berichtigung ? { berichtigung: true, ...vermerk, berichtigtAm } : {},
          eingetragenAm ? { eingetragenAm } : {});
      }
      // Runde 7: H18 – wer „Gilt ab" ändert, sagt es zuletzt: hinter andere
      // Einträge desselben Tages, wie probeDosen rechnet.
      if (verschoben) s.dosen.push(...s.dosen.splice(s.dosen.indexOf(alt), 1));
    } else {
      gespeichert = sp.kennung();
      // Runde 8: J1/J4 (a) – „Ja, bis dahin": daneben, mit dem Vermerk `nach`.
      s.dosen.push({ id: gespeichert, ...eintrag, berichtigung, ...(berichtigung ? { ...vermerk, berichtigtAm } : {}), eingetragenAm, ...(nach ? { nach: nach.id } : {}) });
    }
    if (weg) s.dosen = s.dosen.filter((d) => d.id !== weg);
    s.dosen.sort((a, b) => a.ab.localeCompare(b.ab));
    /*
     * X3 (1) „Nein, ich nehme etwas anderes": Mit dem Eintrag ist die
     * Aufforderung erfüllt. Die Antwort fällt weg, und die Dosis-Karte fragt
     * mit der eingetragenen Dosis neu. Ein Datumsvergleich genügt nicht –
     * der berichtigte Eintrag beginnt oft vor der Antwort, und alte Antworten
     * „nein" nennen keine Menge (B26, B63).
     *
     * Runde 8: H-N1 – erledigt ist das „Nein" nur durch die Berichtigung,
     * durch „Ja, am … geändert" (J9) oder durch „Ja" auf „Haben Sie bis …
     * genommen?" (Entscheidung (1)). Eine Anordnung der Praxis über ihren Weg
     * (oder eine geplante Dosis, K4) erledigt es nicht: Das „Nein" bleibt mit
     * der Kennung der Anordnung stehen (`anordnung`) und wartet auf die Menge
     * für die Zeit davor – das Formular dafür öffnet sich gleich (danach).
     * Gibt es vor der Anordnung keinen Eintrag mehr (sie hat am Einrichtungstag
     * den einzigen ersetzt), ist nichts zu berichtigen: Das „Nein" fällt weg
     * wie bisher. Wer nur einen Eintrag ändert (etwa die Notiz) oder nach der
     * Anordnung eine neue Dosis einträgt (Entscheidung (2)), erledigt nichts.
     */
    if (nein) {
      /*
       * Runde 8 – Nachbesserung (B): ersetzt eine neue Anordnung der Praxis
       * einen vorhandenen Eintrag an Ort und Stelle („ersetzen?" / „Nein, das
       * war falsch"), während das „Nein" noch auf keine Anordnung wartet,
       * erklärt sie das „Nein" (die Praxis: „eigentlich gelten seit 01.01.
       * 112,5, nicht 125") – erledigt wie vor Runde 8. Vorher blieb es ohne
       * Bezug liegen: Die Karte hielt es für erledigt (Menge von heute ≠
       * 125), das Formular nicht – die nächste eigene Senkung wurde still
       * eine Berichtigung, ohne X3/B2 und W-D4.
       */
      const ersetztAnordnung = anordnungNeu && Boolean(alt) && !nein.anordnung;
      const erledigt = berichtigung || geaendertJa || neinBisDahin === 'ja' || ersetztAnordnung;
      const wartet = !erledigt && !alt && !nein.anordnung && (ausPraxis || geplantTrotzNein);
      const davorDa = wartet && sp.gueltigeDosen(s).some((d) => d.id !== gespeichert && d.ab < ab);
      if (erledigt || (wartet && !davorDa)) {
        s.nachfragen = s.nachfragen.filter((n) => !(n.art === 'dosis_stimmt' && /^nein/.test(n.antwort)));
      } else if (wartet) {
        const offen = s.nachfragen.find((n) => n === nein.antwort) || [...s.nachfragen].reverse().find((n) => n.art === 'dosis_stimmt' && /^nein/.test(n.antwort));
        if (offen) offen.anordnung = gespeichert;
        danach = { name: 'dosis' };
        neinSatz = ab > heute
          ? ' Bitte tragen Sie jetzt noch ein, was Sie im Moment nehmen.'
          : ` Sie hatten angegeben, dass Sie nicht ${nein.menge !== null ? `${zahlFeld(nein.menge)} µg am Tag` : 'die eingetragene Menge'} genommen haben. Bitte tragen Sie jetzt noch ein, was Sie ${ab === heute ? 'bis heute' : `bis zum ${datumKurz(tageWeiter(ab, -1))}`} genommen haben.`;
      }
    }
    /*
     * Runde 8 – Nachbesserung 2 (A, Folge (iii)): ein „Nein", das schon
     * erledigt war (heute galt eine andere Menge als die, auf die es sich
     * bezog – für Karte und Formular kein offenes „Nein" mehr), fällt weg.
     * Blieb es liegen, lebte es wieder auf, sobald heute wieder seine Menge
     * galt (etwa nach einer Rückkehr auf 100 µg): Der nächste Eintrag wurde
     * still eine Berichtigung.
     */
    if (neinErledigt) s.nachfragen = s.nachfragen.filter((n) => !(n.art === 'dosis_stimmt' && n.bezug === neinErledigt.bezug && /^nein/.test(n.antwort)));
  });
  /*
   * Andere Stärke bei gezähltem Vorrat: bitte neu zählen (D13). Bei einer
   * neuen Stärke gilt die gezählte Packung nicht mehr – das kann die App nicht
   * verrechnen; „Heute" bittet dann auch selbst darum, mit Knopf
   * (vorratAndereStaerke).
   *
   * Nur bei anderer Stärke – und nur, wenn „Heute" an dem Tag auch darum
   * bittet. Vorher kam die Meldung auch bei bloß anderer Tablettenzahl, die
   * sp.vorratReicht() selbst abschnittsweise verrechnet: Wer ihr folgte und
   * nachzählte, ließ „Gezählt am" auf dem alten Tag stehen, der Verbrauch
   * seitdem zählte doppelt, und „Heute" meldete „aufgebraucht", obwohl noch
   * Tabletten für Wochen da waren. Der Weg „Mehr → Tablettenvorrat" öffnet
   * nach anderer Stärke jetzt ein leeres Formular mit heute (vorratFormular)
   * (Runde 4: E32).
   */
  const neuZaehlen = stand.vorrat && bisherMikrogramm !== eintrag.mikrogramm
    && vorratAndereStaerke(sp.getStand(), ab > heute ? ab : heute);
  /*
   * Runde 6: G11 – Zählt nach dem Speichern ein Eintrag als nie genommen, der
   * es vorher nicht tat (die Berichtigung rückte vor ihn), sagt die Meldung
   * das. Sonst verschwände die angeordnete Menge still aus Karte und
   * Verlauf – im Bericht steht sie weiter, als „nie genommen".
   * Runde 7: H7 – nie der Eintrag, der gerade gespeichert wurde: Die Meldung
   * erklärte die eben eingetragene Menge für nie genommen.
   */
  const nieJetzt = [...ez.nieGegolten(sp.getStand(), heute).keys()].filter((d) => !nieVorher.has(d.id) && d.id !== gespeichert);
  const nieSatz = nieJetzt.length
    ? ` ${nieJetzt.map((d, i) => `${i ? 'die' : 'Die'} ${mengeText(d)} ab ${datumKurz(d.ab)}`).join(' und ')} zählen jetzt als nie genommen.` : '';
  // Runde 8: H-N1 – mit dem Satz zum offenen „Nein" und dem Formular danach.
  const weiter = danach ? { danach } : {};
  /*
   * Runde 8 – Nachbesserung (H-N3-Weg): Wer über „Berichtigung ändern" aus dem
   * Formular der Praxis kam, steht nach dem Speichern wieder dort – mit
   * leerer Stärke. Die Meldung sagt dann, was noch fehlt: Die Praxis hat zu
   * diesem Befund „Die Dosis wird geändert" gesagt, und die neue Dosis ist
   * noch nicht eingetragen (dieselbe Regel wie js/app.js praxisNochGeaendert).
   */
  const befundJetzt = dz.dosisBefund(sp.getStand(), heute);
  const praxisFehlt = Boolean(formDa && formDa.berichtigung && befundJetzt && befundJetzt.praxis === 'geaendert' && !dz.anordnungEingetragen(sp.getStand(), befundJetzt, heute));
  const kopf = praxisFehlt ? 'Berichtigung gespeichert. Die neue Dosis der Praxis ist noch nicht eingetragen – bitte tragen Sie sie jetzt ein.' : 'Dosis gespeichert.';
  if (neuZaehlen) {
    return {
      ok: true,
      ...weiter,
      meldung: ab > heute
        ? `${kopf}${nieSatz}${neinSatz} Bitte zählen Sie am ${datumKurz(ab)} Ihren Tablettenvorrat neu – „Heute" erinnert Sie an dem Tag daran.`
        : `${kopf}${nieSatz}${neinSatz} Bitte zählen Sie Ihren Tablettenvorrat neu – auf „Heute" unter „Vorrat neu zählen" oder unter „Mehr → Tablettenvorrat".`,
    };
  }
  return { ok: true, ...weiter, meldung: nieSatz || neinSatz || praxisFehlt ? `${kopf}${nieSatz}${neinSatz}` : 'Dosis gespeichert' };
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
 * Die Fragen kommen aus speicher.js (FRAGEN_FELDER) – dieselbe Liste, mit der
 * normStand beim Laden zwei Einträge eines Tages zusammenführt. Vorher hatte
 * das Formular eine eigene ohne Q5 („versehentlich mehr genommen"), und beide
 * Wege konnten auseinanderlaufen (C14). Q5 steht nicht in BEFUND_FRAGEN – ihr
 * Name für die Meldung steht deshalb hier.
 */
const FRAGE_KURZ = { verwechselt: 'versehentlich mehr genommen' };

/*
 * Q5 im Formular – nur zum Ändern einer Antwort, die schon gegeben ist.
 * Stellen soll die Frage weiter die Dosis-Karte, und nur dort, wo sie zählt
 * (TSH niedrig, Muster d und e). Vorher ließ sich eine falsche Antwort gar
 * nicht zurücknehmen: Ein Fehltipp auf „Ja, einmal viele Tabletten auf
 * einmal" ließ „Heute anrufen – Giftnotruf" wochenlang stehen und stand so im
 * Arztbericht; zurück ging es nur, indem man den ganzen Befund löschte. „Noch
 * offen" nimmt die Antwort zurück, dann fragt die Karte neu (Runde 4: E4).
 * Der Wortlaut wie auf der Karte (js/dosis.js, Q5).
 */
const Q5_FRAGE = 'Haben Sie vielleicht versehentlich mehr genommen oder eine Packung mit einer anderen Stärke bekommen?';
const Q5_WAHL = [['nein', 'Nein'], ['einmal', 'Ja, einmal viele Tabletten auf einmal'], ['tage', 'Ja, über Tage zu viel oder eine andere Stärke'], ['unbekannt', 'Weiß nicht'], ['', 'Noch offen – die Dosis-Karte fragt noch einmal']];
const Q5_WERTE = ['nein', 'einmal', 'tage', 'unbekannt'];

/*
 * Ein Befund je Abnahmetag. Wird ein nachgereichter Wert (etwa fT4) als
 * eigener Befund am selben Tag eingetragen, rechnete die Einschätzung nur mit
 * einem der beiden – TSH 7 und fT4 5 ergaben dann nicht Muster b mit „in den
 * nächsten Tagen" und dem 112-Satz (B52). Jetzt kommt der neue Eintrag zum
 * vorhandenen dazu: leere Werte und offene Fragen werden gefüllt. Sagen beide
 * bei derselben Angabe Verschiedenes, wird nichts still überschrieben.
 *
 * Runde 8: K14 – `widerspruch` nennt zu jeder Angabe beide Werte („TSH:
 * bisher 2,1 mU/l, jetzt 2,15 mU/l"), und mit `neuGewinnt` gilt bei einem
 * Widerspruch der neue Wert (die Antwort „Ja, der neue Wert gilt" in
 * laborAbsenden). Vorher stand nur der Name des Werts im Fehler.
 * → { zusammen, widerspruch: [Texte], notizZuLang }
 */
function befundeZusammen(alt, neu, { neuGewinnt = false } = {}) {
  const zusammen = {};
  const widerspruch = [];
  const wertKurz = (w) => `${w.unter ? '< ' : ''}${zahlFeld(w.wert)} ${w.einheit}`;
  [...sp.LABORWERTE, ...sp.WEITERE_WERTE].forEach(([key, name]) => {
    const a = alt[key];
    const n = neu[key];
    if (!n || !a) { zusammen[key] = a || n || null; return; }
    const gleich = a.wert === n.wert && a.einheit === n.einheit && a.unter === n.unter
      && (a.von === null || n.von === null || a.von === n.von) && (a.bis === null || n.bis === null || a.bis === n.bis);
    if (!gleich) {
      widerspruch.push(`${name.replace(/ \(.*\)$/, '')}: bisher ${wertKurz(a)}, jetzt ${wertKurz(n)}`);
      zusammen[key] = neuGewinnt ? { ...n, von: n.von ?? a.von, bis: n.bis ?? a.bis } : a;
      return;
    }
    zusammen[key] = { ...a, von: a.von ?? n.von, bis: a.bis ?? n.bis };
  });
  sp.FRAGEN_FELDER.forEach((k) => {
    if (neu[k] && alt[k] && neu[k] !== alt[k]) {
      const frage = BEFUND_FRAGEN.find((q) => q.feld === k);
      const antwortText = (v) => (frage && frage.optionen ? (frage.optionen.find(([w]) => w === v) || [v, v])[1] : (JNW_WAHL.find(([w]) => w === v) || [v, v])[1]);
      widerspruch.push(`${frage ? frage.kurz : FRAGE_KURZ[k] || k}: bisher ${antwortText(alt[k])}, jetzt ${antwortText(neu[k])}`);
    }
    zusammen[k] = neuGewinnt ? neu[k] || alt[k] || '' : alt[k] || neu[k] || '';
  });
  zusammen.praxisAm = zusammen.praxis && zusammen.praxis === alt.praxis ? alt.praxisAm : neu.praxisAm;
  ['abnahmeUhr', 'tabletteUhr', 'laborName'].forEach((k) => {
    if (neu[k] && alt[k] && neu[k] !== alt[k]) widerspruch.push(`${{ abnahmeUhr: 'Uhrzeit der Abnahme', tabletteUhr: 'Uhrzeit der Tablette', laborName: 'Name des Labors' }[k]}: bisher ${alt[k]}, jetzt ${neu[k]}`);
    zusammen[k] = neuGewinnt ? neu[k] || alt[k] || '' : alt[k] || neu[k] || '';
  });
  /*
   * Runde 5: F23 – Beide Notizen passen zusammen nicht in die Grenze: nicht
   * kürzen, sondern am Feld sagen (laborAbsenden). Vorher wurde auf 300
   * Zeichen gekürzt, und ausgerechnet die neue Notiz fiel weg – übrig blieb
   * „Biotin bitte eine Woche" ohne „vor der nächsten Abnahme weglassen".
   */
  zusammen.notiz = [alt.notiz, neu.notiz].filter(Boolean).filter((x, i, l) => l.indexOf(x) === i).join(' · ');
  zusammen.datum = alt.datum;
  const notizZeichen = zeichenZahl(zusammen.notiz);
  return { zusammen, widerspruch, notizZuLang: notizZeichen > sp.GRENZEN.notiz ? { zeichen: notizZeichen, vorhanden: zeichenZahl(alt.notiz) } : null };
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
    /*
     * Runde 5: F2 – Jedes Wertfeld trägt den Namen seines Werts. Vorher hießen
     * alle elf Felder für Vorleseprogramme nur „Wert"; wer mit „Weiter" von
     * Feld zu Feld sprang, konnte TSH, fT4 und fT3 nicht unterscheiden, und ein
     * fT4-Wert landete leicht im falschen Feld. Die Karte ist eine Gruppe mit
     * dem Namen des Werts, das Feld heißt „Wert TSH" (sichtbar bleibt „Wert").
     * Der Hinweis zu „< 0,01" ist die Beschreibung des TSH-Felds, nicht mehr
     * Teil seines Namens.
     */
    return `
      <div class="karte" data-feld="${key}" role="group" aria-labelledby="lw-${key}">
        <div class="laborwert-kopf"><span class="laborwert-name" id="lw-${key}">${esc(name)}</span>
          <select name="${key}_einheit" aria-label="Einheit ${esc(name)}" style="width:auto;min-height:2.4rem">
            ${[...new Set([...einheiten, einheit].filter(Boolean))].map((e) => `<option value="${esc(e)}" ${e === einheit ? 'selected' : ''}>${esc(e)}</option>`).join('')}
          </select>
        </div>
        ${key === 'ft4' ? '<p class="klein gedaempft" style="margin:.3rem 0 .5rem">Bitte nur das freie T4 eintragen (fT4, FT4). „T4" oder „Gesamt-T4" ist ein anderer Wert und wird von der App nicht eingeordnet.</p>' : ''}
        <label class="feld"><span>Wert<span class="sr-only"> ${esc(name)}</span></span>
          <input type="text" inputmode="decimal" name="${key}_wert" value="${esc(wertText)}" placeholder="${esc(WERT_PLATZ[key] || 'vom Befund')}" autocomplete="off"${key === 'tsh' ? ' aria-describedby="hinweis-tsh"' : ''}>
          ${key === 'tsh' ? '<span class="hinweis" id="hinweis-tsh" aria-hidden="true">Steht auf dem Befund „&lt; 0,01", tragen Sie genau das ein.</span>' : ''}
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
  // Q5 vor der Frage nach der Praxis – bei den anderen Fragen zur Einnahme.
  // Die fünf Antworten untereinander: Nebeneinander stand „Ja, über Tage zu
  // viel oder eine andere Stärke" bei „sehr groß" Wort für Wort in einer
  // schmalen Spalte neben „Weiß nicht".
  const q5 = da && Q5_WERTE.includes(da.verwechselt)
    ? wahlFrage('verwechselt', da.verwechselt, Q5_FRAGE, { optionen: Q5_WAHL, hinweis: 'Ihre Antwort auf der Dosis-Karte. Stimmt sie nicht, ändern Sie sie hier.' })
      .replace(/<label class="wahl-flaeche">/g, '<label class="wahl-flaeche" style="flex-basis:100%">') : '';
  const fragen = BEFUND_FRAGEN.filter((q) => !q.nurMitAbstand || hatAbstand).map((q) => (q.feld === 'praxis' ? q5 : '') + wahlFrage(q.feld, l[q.feld] || '', q.frage, {
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
        ${feldText('laborName', l.laborName, 'Name des Labors (freiwillig)', { platzhalter: letzter && letzter.laborName ? `z. B. ${letzter.laborName}` : 'steht oben auf dem Befund', hinweis: 'Bei einem anderen Labor vergleicht die App die Werte nur eingeschränkt.', max: sp.GRENZEN.laborName })}
        ${weitere}
        <fieldset class="fragen-block">
          <legend>Fragen zur Blutabnahme</legend>
          <p class="hinweis" style="margin-bottom:.8rem">Alle freiwillig. Die Antworten helfen, den Wert richtig zu lesen: Eine Tablette vor der Abnahme hebt fT4, Biotin verfälscht die Messung, eine schwere Krankheit oder Kortison verschieben die Werte für Wochen. Was offen bleibt, fragt die Dosis-Karte später.</p>
          ${fragen}
        </fieldset>
        ${feldText('notiz', l.notiz, 'Notiz (freiwillig)', { platzhalter: 'z. B. anderes Labor als sonst', lang: true, max: sp.GRENZEN.notiz })}
        ${fuss('labor', id)}
      </form>`,
  };
}

const JNW_WERTE = ['ja', 'nein', 'unbekannt'];
const auswahl = (v, erlaubt) => (erlaubt.includes(v) ? v : '');

/*
 * Runde 8: J7 – eine Entscheidung der Praxis, die über das Befund-Formular
 * eingetragen wird, zählt nach einer eigenen Änderung oder Berichtigung wie
 * über „Die Praxis hat entschieden" (js/app.js): mit dem Datum von heute und
 * dem Vermerk PRAXIS_DANACH (js/dosis.js, wartetAufPraxis). Vorher schrieb
 * nur js/app.js den Vermerk; aus dem Formular galt die Entscheidung als vor
 * der Änderung, Karte und „Heute" rieten weiter „wieder die bisherige Menge".
 * Beide Hilfen rechnen wie js/app.js – und nehmen die Fassung aus js/dosis.js,
 * sobald sie dort ausgeführt ist (dann mit der Kennung der Änderung, J3).
 */
const ENTSCHIEDEN = ['bleibt', 'geaendert', 'nachmessen'];
function entscheidungNachEigener(stand, wert, heute) {
  if (typeof dz.entscheidungNachEigener === 'function') return Boolean(dz.entscheidungNachEigener(stand, wert, heute));
  return ENTSCHIEDEN.includes(wert) && dz.wartetAufPraxis(stand, heute);
}
/*
 * Runde 8 – Nachbesserung: `vorher` ist die Angabe der Praxis zu diesem
 * Befund VOR dem Speichern ({ praxis, praxisAm }), wie js/app.js sie
 * übergibt. Ohne sie rechnete dosis.js den Vermerk, als hätte der Befund nie
 * eine Entscheidung gehabt: Eine schon entschiedene frühere Änderung galt
 * wieder als offen, und der Vermerk kam an sie statt an die Änderung, auf
 * die die Karte eben wartete.
 */
function vermerkPraxisDanach(s, befundId, heute, vorher = null) {
  if (typeof dz.praxisDanachVermerken === 'function') { dz.praxisDanachVermerken(s, befundId, heute, vorher); return; }
  s.nachfragen = s.nachfragen.filter((n) => !(n.art === dz.PRAXIS_DANACH && n.bezug === befundId));
  s.nachfragen.push({ id: sp.kennung(), art: dz.PRAXIS_DANACH, bezug: befundId, antwort: 'ja', am: heute });
}
/*
 * Runde 8: J7b – die Änderung, auf die die Karte wartet, mit ihrem Tag für die
 * Rückfrage: bei einer Berichtigung ihr Tag (dz.berichtigtAm, X3b), bei einer
 * geplanten eigenen Änderung der Tag, an dem sie eingetragen wurde, sonst der
 * spätere von „Gilt ab" und dem Tag des Eintrags (bekannt seit, H8).
 * → { d, tag, berichtigung, geplant } | null
 *
 * Runde 8 – Nachbesserung 2 (J7b bei einer geplanten Änderung): GENAU die
 * Änderung, an die die Antwort „Ja, danach" den Vermerk bindet – gerechnet
 * mit js/dosis.js selbst (dz.wartendeAenderung; fehlt sie, schreibt
 * praxisDanachVermerken den Vermerk auf einer Kopie, und seine Kennung
 * zählt). Vorher nahm die Frage den Eintrag, mit dem die Menge von
 * heute begann. Wartete die Karte auf eine GEPLANTE eigene Änderung (K1/F2:
 * am 25.09. eingetragen, ab 05.10. selbst 150 µg), fragte sie „Hat die Praxis
 * das nach Ihrer eigenen Änderung vom 01.09.2026 gesagt?" – nach einer
 * schon entschiedenen eigenen Änderung oder gar nach einer Anordnung der
 * Praxis. Die wahre Antwort „Ja, danach" machte die geplante Erhöhung zur
 * entschiedenen (X3 ohne Frist, „Heute" leer, auch am Starttag), und „Nein,
 * das war vorher" merkte sich die falsche Kennung. Ohne wartende Änderung
 * (etwa „selbst geändert" ohne Eintrag) → null: dann ohne Tag. Die Angabe
 * der Praxis ist dabei unverändert (sonst fragt das Formular nicht) – die
 * Karte wartet im Stand von jetzt, wie praxisDanachVermerken mit `vorher`.
 */
function wartendeAenderung(stand, befund, heute) {
  // Bevorzugt die Regel aus js/dosis.js selbst (dieselbe, die praxisDanachVermerken nutzt).
  if (typeof dz.wartendeAenderung === 'function') {
    const w = dz.wartendeAenderung(stand, heute);
    if (!w || !w.d) return null;
    return { d: w.d, tag: istISO(w.ab) ? w.ab : w.d.ab, berichtigung: Boolean(w.berichtigung), geplant: Boolean(w.geplant) };
  }
  // Sonst: den Vermerk auf einer Kopie schreiben lassen und seine Kennung lesen.
  const probe = { ...stand, nachfragen: stand.nachfragen.map((n) => ({ ...n })) };
  const bisher = new Set(stand.nachfragen.map((n) => n.id));
  vermerkPraxisDanach(probe, befund.id, heute, { praxis: befund.praxis, praxisAm: befund.praxisAm });
  const vermerke = probe.nachfragen.filter((n) => n.art === dz.PRAXIS_DANACH && n.bezug === befund.id && n.antwort === 'ja' && n.am === heute);
  const vermerk = vermerke.find((n) => !bisher.has(n.id)) || vermerke[vermerke.length - 1] || null;
  const d = vermerk && vermerk.dosis ? stand.dosen.find((x) => x.id === vermerk.dosis) || null : null;
  if (!d) return null;
  const berichtigung = ez.istBerichtigung(stand, d, heute);
  const geplant = !berichtigung && d.ab > heute;
  const tag = berichtigung ? dz.berichtigtAm(stand, d, heute)
    : geplant ? [istISO(d.eingetragenAm) ? d.eingetragenAm : heute, heute].sort()[0]
      : [d.ab, istISO(d.eingetragenAm) ? d.eingetragenAm : null].filter(Boolean).sort().pop();
  return { d, tag, berichtigung, geplant };
}

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
    notiz: textAus(f.get('notiz'), sp.GRENZEN.notiz),
    abnahmeUhr: uhr('abnahmeUhr'),
    tabletteUhr: f.get('vorAbnahme') === 'ja' ? uhr('tabletteUhr') : '',
    laborName: zeileAus(f.get('laborName'), sp.GRENZEN.laborName),
    vergessen: auswahl(f.get('vergessen'), ['nein', 'einzelne', 'mehrere', 'unbekannt']),
    einnahmeArt: auswahl(f.get('einnahmeArt'), ['ja', 'abends', 'nein', 'unbekannt']),
    praxis,
    // Das Datum der Praxis-Angabe: neu gesetzt, wenn sie sich ändert.
    praxisAm: praxis ? (da && da.praxis === praxis && da.praxisAm ? da.praxisAm : heute) : null,
    // Q5 fragt die Dosis-Karte – das Feld muss trotzdem von Anfang an da
    // sein. Vorher legte es erst normStand beim nächsten Laden an, und bis
    // dahin ließ sich Q5 nicht beantworten (B39). Steht die Frage im Formular
    // (eine Antwort zum Ändern), gilt, was dort gewählt ist – „Noch offen"
    // nimmt sie zurück. Vorher wurde die alte Antwort bei jedem Speichern
    // übernommen (Runde 4: E4).
    verwechselt: f.has('verwechselt') ? auswahl(f.get('verwechselt'), Q5_WERTE)
      : da && typeof da.verwechselt === 'string' ? da.verwechselt : '',
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
    eintrag[key] = { wert, einheit: zeileAus(f.get(`${key}_einheit`), sp.GRENZEN.einheit), von, bis, unter };
  });
  if (!einer && !Object.keys(fehler).length) fehler.tsh_wert = 'Bitte mindestens einen Wert eintragen.';
  if (Object.keys(fehler).length) return { ok: false, fehler };

  // Ein Befund je Abnahmetag (B52): Ein neuer Eintrag kommt zum vorhandenen
  // dazu. Wird ein vorhandener Befund auf einen belegten Tag verlegt, nicht –
  // dann hilft nur, den anderen zu öffnen. Bleibt sein Tag, wie er war, lässt
  // er sich ändern wie bisher (auch wenn ein älterer Stand zwei an einem Tag hat).
  // Hat ein älterer Stand zwei Einträge an diesem Tag (etwa ein berichtigter
  // TSH), kommt der neue Wert zum ZULETZT eingetragenen: Mit ihm rechnet die
  // Auswertung, und dorthin führt normStand zusammen. Vorher landete ein
  // nachgereichtes fT4 beim überholten ersten Eintrag und fehlte in jeder
  // Einschätzung – „Heute" blieb bei „Beim nächsten Termin" (C15).
  const amTag = [...stand.labor].reverse().find((l) => l.datum === datum && l.id !== id && (!da || da.datum !== datum)) || null;
  let ziel = eintrag;
  if (amTag) {
    const oeffnen = { seite: 'labor', param: amTag.id, text: `Befund vom ${datumKurz(datum)} öffnen` };
    if (id) return { ok: false, fehler: { datum: { text: `Für den ${datumKurz(datum)} gibt es schon einen Befund. Tragen Sie die Werte bitte dort ein – oder wählen Sie ein anderes Datum.`, knopf: oeffnen } } };
    /*
     * Runde 8: K14 – der Befund in zwei Schritten (TSH 2,1 vom Telefon, später
     * der Brief mit TSH 2,15, fT4 und den Bereichen): Bei einer Abweichung
     * führte der Knopf „Befund … öffnen" über die Seitenaktion zur Frage
     * „Ihre Eingaben sind noch nicht gespeichert. Verwerfen …?" und öffnete
     * den alten Befund mit den alten Werten – alles eben Eingetippte war weg,
     * und der Fehler nannte nicht einmal die beiden Werte. Jetzt eine
     * Rückfrage mit beiden Werten: „Ja, der neue Wert gilt" speichert alles
     * zusammen (der neue Wert ersetzt den alten, die übrigen Werte kommen
     * dazu), „Nein" führt zurück ins Formular – die Eingaben bleiben stehen.
     */
    const uebernehmen = f.get('uebernehmen') === 'ja';
    const { zusammen, widerspruch, notizZuLang } = befundeZusammen(amTag, eintrag, { neuGewinnt: uebernehmen });
    if (widerspruch.length && !uebernehmen) {
      return {
        ok: false,
        rueckfragen: [`Für den ${datumKurz(datum)} gibt es schon einen Befund. Er sagt etwas anderes – ${widerspruch.join('; ')}.`],
        rueckfrageSatz: widerspruch.length === 1 ? 'Soll der neue Wert gelten? Die übrigen Werte kommen zum vorhandenen Befund dazu.' : 'Sollen die neuen Werte gelten? Die übrigen Werte kommen zum vorhandenen Befund dazu.',
        rueckfrageFeld: 'datum',
        rueckfrageName: 'uebernehmen',
        rueckfrageJa: widerspruch.length === 1 ? 'Ja, der neue Wert gilt' : 'Ja, die neuen Werte gelten',
        rueckfrageNein: 'Nein, zurück zum Formular',
      };
    }
    if (notizZuLang) {
      // Platz für die neue Notiz: die Grenze ohne die vorhandene und ohne das „ · " dazwischen.
      const platz = Math.max(0, sp.GRENZEN.notiz - notizZuLang.vorhanden - 3);
      const bitte = platz > 0 ? `Bitte kürzen Sie Ihre Notiz auf höchstens ${platz} Zeichen` : 'Bitte lassen Sie Ihre Notiz hier weg';
      return {
        ok: false,
        fehler: {
          notiz: {
            text: `Beim Befund vom ${datumKurz(datum)} steht schon eine Notiz. Zusammen wären es ${notizZuLang.zeichen} Zeichen, es passen höchstens ${sp.GRENZEN.notiz}. ${bitte} – oder öffnen Sie den vorhandenen Befund und kürzen Sie dort.`,
            knopf: oeffnen,
          },
        },
      };
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
  /*
   * Runde 7: H4, H15, H21 – der Tag, an dem ein weiterer Wert in die App kam.
   * Ab ihm läuft die Frist eines Gefahrenwerts (Natrium 118 → „heute
   * anrufen", höchstens 14 Tage), und eine Angabe der Praxis zählt für ihn
   * erst danach (einschaetzung.gefahrVorbei). Ohne ihn galt das Datum der
   * Abnahme: Ein drei Wochen später abgeschriebener Befund stand nie auf
   * „heute", und ein „Die Dosis bleibt so", das vor dem nachgetragenen
   * Natrium gegeben war, hätte es gleich beendet.
   * Nachprüfung zu Runde 7 (N1): je Wert, neu gesetzt nur, wenn genau dieser
   * Wert dazukommt oder sich ändert. Ein Tag für den ganzen Befund begann die
   * Frist auch neu, wenn nur TSH berichtigt oder fT4 nachgetragen wurde.
   */
  const wertDaten = (w) => (w ? [w.wert, w.einheit, Boolean(w.unter), w.von ?? null, w.bis ?? null].join('|') : '');
  ziel.werteAm = Object.fromEntries(sp.WEITERE_WERTE.filter(([k]) => ziel[k]).map(([k]) => {
    const bisher = bezug && wertDaten(bezug[k]) === wertDaten(ziel[k])
      ? (bezug.werteAm && bezug.werteAm[k]) || bezug.eingetragenAm || bezug.datum : null;
    return [k, bisher || heute];
  }));

  /*
   * Runde 8: J7 (Entscheidung (c)) – ändert sich die Angabe der Praxis auf
   * bleibt/geändert/nachmessen, während die Karte nach einer eigenen Änderung
   * oder Berichtigung auf sie wartet, zählt sie als Entscheidung DANACH: mit
   * dem Datum von heute und dem Vermerk PRAXIS_DANACH – wie über „Die Praxis
   * hat entschieden" (js/app.js). Vor dem Speichern gerechnet: Danach wartet
   * die Karte nicht mehr.
   * Runde 8: J7b – steht die Angabe unverändert da (vorbelegt vom früheren
   * Mal, etwa „bleibt" vom 29.04., vor der eigenen Änderung vom 04.05.) und
   * ist der Befund der, um den es auf der Karte geht, darf das Formular sie
   * nicht still neu datieren – aber auch nicht übergehen, sonst war die
   * Entscheidung nicht eintragbar. Es fragt: „Hat die Praxis das nach Ihrer
   * eigenen Änderung vom … gesagt?" [Ja, danach → Datum heute und Vermerk] /
   * [Nein, das war vorher → speichern wie bisher]; beide speichern (neinSendet).
   */
  const praxisNeu = ENTSCHIEDEN.includes(praxis) && !(bezug && bezug.praxis === praxis && bezug.praxisAm);
  const nachEigener = ENTSCHIEDEN.includes(praxis) && entscheidungNachEigener(stand, praxis, heute);
  const befundDerKarte = dz.dosisBefund(stand, heute);
  const praxisDanach = f.get('praxisDanach');
  /*
   * Runde 8 – Nachbesserung (C): der Vermerk nur für den Befund, um den es
   * auf der Karte geht (oder einen neuen Befund ab dessen Tag, der ihn
   * ablöst). Eine Angabe zu einem ÄLTEREN Befund – das „bleibt", das die
   * Praxis im Januar zu dem Wert gesagt hatte – ist keine Entscheidung nach
   * der eigenen Änderung vom Mai (H8): Vorher bekam auch er den Vermerk, und
   * X3/B2 verlor die Frist, „Heute" schwieg. Sie wird wie bisher gespeichert
   * (praxis, praxisAm = heute), nur ohne Vermerk.
   */
  const zumBefundDerKarte = !befundDerKarte || (bezug ? bezug.id === befundDerKarte.id : datum >= befundDerKarte.datum);
  let vermerkt = praxisNeu && nachEigener && zumBefundDerKarte;
  // Runde 8 – Nachbesserung (D): „Nein, das war vorher" wird gemerkt (unten).
  let verneint = null;
  if (!praxisNeu && nachEigener && bezug && befundDerKarte && bezug.id === befundDerKarte.id) {
    const wartend = wartendeAenderung(stand, bezug, heute);
    /*
     * Runde 8 – Nachbesserung (D): „Nein, das war vorher" ist gemerkt – als
     * Vermerk PRAXIS_DANACH mit der Antwort „nein" und der Kennung der
     * wartenden Änderung (nur ein Vermerk mit Antwort „ja" zählt als
     * Entscheidung danach, js/dosis.js vermerkFuer). Vorher kam die Frage bei
     * jedem weiteren Speichern des Befunds wieder, auch für eine Notiz. Zu
     * einer neuen eigenen Änderung (andere Kennung) kommt sie wieder; eine
     * geänderte Menge löscht den Vermerk (dosisAbsenden).
     * Runde 8 – Nachbesserung 2: ohne wartende Änderung (etwa „selbst
     * geändert" ohne Eintrag) ein Vermerk ohne Kennung – sonst käme die Frage
     * dort wieder bei jedem Speichern.
     */
    const schonVerneint = stand.nachfragen.some((n) => n.art === dz.PRAXIS_DANACH && n.bezug === bezug.id && n.antwort === 'nein'
      && (wartend ? n.dosis === wartend.d.id : !n.dosis));
    if (!schonVerneint && praxisDanach !== 'ja' && praxisDanach !== 'nein') {
      const wortlaut = { bleibt: 'Die Dosis bleibt so', geaendert: 'Die Dosis wird geändert', nachmessen: 'Erst nachmessen' }[praxis];
      // Runde 8 – Nachbesserung 2: eine geplante eigene Änderung mit dem Tag ihres Eintrags und ihrem Beginn.
      const frage = !wartend ? 'Hat die Praxis das gesagt, nachdem Sie die Dosis selbst geändert hatten?'
        : wartend.geplant ? `Hat die Praxis das gesagt, nachdem Sie am ${datumKurz(wartend.tag)} eingetragen hatten, dass Sie ab ${datumKurz(wartend.d.ab)} selbst ${mengeText(wartend.d)} nehmen wollen?`
          : `Hat die Praxis das nach Ihrer ${wartend.berichtigung ? 'Berichtigung' : 'eigenen Änderung'} vom ${datumKurz(wartend.tag)} gesagt?`;
      return {
        ok: false,
        rueckfragen: [`Beim Befund vom ${datumKurz(bezug.datum)} steht: „${wortlaut}" – angegeben am ${datumKurz(bezug.praxisAm)}.`],
        rueckfrageSatz: frage,
        rueckfrageFeld: 'praxis',
        rueckfrageName: 'praxisDanach',
        rueckfrageJa: 'Ja, danach',
        rueckfrageNein: 'Nein, das war vorher',
        rueckfrageNeinSendet: true,
      };
    }
    if (praxisDanach === 'ja') {
      ziel.praxisAm = heute;
      vermerkt = true;
    } else if (praxisDanach === 'nein' && !schonVerneint) {
      verneint = { dosis: wartend ? wartend.d.id : null };
    }
  }

  let befundId = bezug ? bezug.id : null;
  // Vor dem Speichern merken: bezug ist der lebende Eintrag des Stands, und
  // Object.assign unten überschreibt ihn (siehe vermerkPraxisDanach).
  const praxisVorher = bezug ? { praxis: bezug.praxis, praxisAm: bezug.praxisAm } : null;
  sp.aendern((s) => {
    const alt = bezug ? s.labor.find((l) => l.id === bezug.id) : null;
    if (alt) Object.assign(alt, ziel);
    else {
      befundId = sp.kennung();
      s.labor.push({ id: befundId, ...ziel });
    }
    s.labor.sort((a, b) => a.datum.localeCompare(b.datum));
    if (vermerkt && befundId) vermerkPraxisDanach(s, befundId, heute, praxisVorher);
    // Runde 8 – Nachbesserung (D): die Antwort „Nein, das war vorher" merken (ein „ja"-Vermerk zu diesem Befund bleibt unberührt).
    if (verneint && befundId) {
      s.nachfragen = s.nachfragen.filter((n) => !(n.art === dz.PRAXIS_DANACH && n.bezug === befundId && n.antwort === 'nein'));
      s.nachfragen.push({ id: sp.kennung(), art: dz.PRAXIS_DANACH, bezug: befundId, antwort: 'nein', am: heute, ...(verneint.dosis ? { dosis: verneint.dosis } : {}) });
    }
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
 * Punkte aus früheren Fassungen („trockene Haut oder Haarausfall", C22)
 * bietet das Formular nicht neu an. Hat ein alter Eintrag einen, steht er
 * beim Bearbeiten angehakt mit seinem alten Text da – vorher fiel er beim
 * Speichern still weg, weil das Formular ihn nicht kannte.
 */
const alteBeschwerden = (b) => sp.ALTE_BESCHWERDEN.filter(([k]) => b && b.beschwerden.includes(k));

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
            ${[...sp.BESCHWERDEN, ...alteBeschwerden(b)].map(([k, t]) => `<label class="haken"><input type="checkbox" name="beschwerden" value="${esc(k)}" ${b.beschwerden.includes(k) ? 'checked' : ''}>${esc(t)}</label>`).join('')}
          </div>
          <span class="hinweis">Alles freiwillig. Solche Beschwerden haben oft andere Gründe – deshalb gehört das ins Gespräch mit der Ärztin, nicht in eine eigene Dosisänderung.</span>
        </div>
        ${feldText('notiz', b.notiz, 'Notiz (freiwillig)', { lang: true, platzhalter: 'z. B. seit drei Tagen abends sehr müde', max: sp.GRENZEN.notiz })}
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
  const liste = sp.getStand().befinden;
  const vorher = id ? liste.find((b) => b.id === id) : null;
  /*
   * Ein Eintrag je Tag – aber nie still auf Kosten eines anderen. Vorher
   * überschrieb ein neuer Eintrag mit geändertem Datum den vorhandenen
   * Eintrag dieses Tages, den das Formular nie gezeigt hatte, und ein
   * verlegter Eintrag löschte ihn: Herzklopfen samt Notiz waren weg, und mit
   * ihnen „Heute anrufen" (S4, S4ii, R3, W5). Jetzt wie beim Befund (B52):
   * ablehnen, mit Knopf zum vorhandenen Eintrag. Bleibt ein Eintrag an seinem
   * Tag, lässt er sich ändern wie bisher – auch wenn ein älterer Stand an
   * diesem Tag zwei hat (Runde 4: E22).
   */
  const belegt = liste.find((b) => b.datum === datum && b.id !== id && (!vorher || vorher.datum !== datum));
  if (belegt) {
    return {
      ok: false,
      fehler: {
        datum: {
          text: `Für den ${datumKurz(datum)} gibt es schon einen Eintrag. Öffnen Sie ihn, um etwas zu ergänzen oder zu ändern – oder wählen Sie ein anderes Datum.`,
          knopf: { seite: 'befinden', param: belegt.id, text: `Eintrag vom ${datumKurz(datum)} öffnen` },
        },
      },
    };
  }
  // Ein alter Punkt bleibt nur, wo er schon stand – neu wählen lässt er sich nicht.
  const alt = alteBeschwerden(vorher).map(([k]) => k);
  const beschwerden = f.getAll('beschwerden').filter((k) => sp.BESCHWERDEN.some(([x]) => x === k) || alt.includes(k));
  const notiz = textAus(f.get('notiz'), sp.GRENZEN.notiz);
  let gespeichert = null;
  sp.aendern((s) => {
    const da = id ? s.befinden.find((b) => b.id === id) : null;
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
        ${feldDatum('datum', t.datum || heute, 'Datum', '', terminGrenze(heute))}
        <label class="feld"><span>Uhrzeit (freiwillig)</span><input type="time" name="uhr" value="${esc(t.uhr)}"></label>
        ${feldText('wo', t.wo, 'Wo / bei wem (freiwillig)', { platzhalter: 'z. B. Praxis Dr. Meier', max: sp.GRENZEN.wo })}
        <label class="haken" style="margin-bottom:.9rem"><input type="checkbox" name="blutabnahme" ${t.blutabnahme ? 'checked' : ''}>Es wird Blut abgenommen</label>
        <div class="hinweis-karte"><span class="ri" aria-hidden="true">ℹ️</span><div>Bei einer Blutabnahme wird die Tablette meist erst danach genommen, weil fT4 in den Stunden nach der Einnahme vorübergehend ansteigt. Wie die Praxis es haben möchte, am besten einmal fragen und hier notieren.</div></div>
        ${feldText('notiz', t.notiz, 'Notiz (freiwillig)', { lang: true, platzhalter: 'z. B. nüchtern kommen, Befunde mitbringen', max: sp.GRENZEN.notiz })}
        ${fuss('termin', id)}
      </form>`,
  };
}

/*
 * Runde 5: F25 – Ein Termin liegt höchstens fünf Jahre voraus. Das Datumsfeld
 * nahm jedes Jahr bis 9999 an; ein vertipptes Jahr landete so in der
 * Kalenderdatei. Ein Termin, der schon so gespeichert ist, lässt sich weiter
 * ändern, ohne dass das Datum im Weg steht.
 */
const terminGrenze = (heute) => tageWeiter(heute, 5 * 366);

function terminAbsenden(id, f, heute) {
  const fehler = {};
  const datum = f.get('datum');
  const da = id ? sp.getStand().termine.find((t) => t.id === id) : null;
  if (!istISO(datum)) fehler.datum = 'Bitte ein Datum wählen.';
  else if (datum > terminGrenze(heute) && !(da && da.datum === datum)) fehler.datum = 'Das Datum liegt mehr als fünf Jahre in der Zukunft. Bitte prüfen Sie das Jahr.';
  const uhr = String(f.get('uhr') || '');
  if (uhr && !istUhr(uhr)) fehler.uhr = 'Bitte eine Uhrzeit wie 9:30 wählen.';
  if (Object.keys(fehler).length) return { ok: false, fehler };
  const eintrag = {
    datum,
    uhr,
    art: ['arzt', 'labor', 'sonst'].includes(f.get('art')) ? f.get('art') : 'arzt',
    wo: zeileAus(f.get('wo'), sp.GRENZEN.wo),
    blutabnahme: f.get('blutabnahme') === 'on',
    notiz: textAus(f.get('notiz'), sp.GRENZEN.notiz),
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
        ${feldText('text', da ? da.text : '', 'Was möchten Sie fragen?', { lang: true, platzhalter: 'z. B. Kann die Müdigkeit am Nachmittag an der Dosis liegen?', max: sp.GRENZEN.frage })}
        ${fuss('frage', id)}
      </form>`,
  };
}

function frageAbsenden(id, f) {
  const text = textAus(f.get('text'), sp.GRENZEN.frage);
  if (!text) return { ok: false, fehler: { text: 'Bitte die Frage eintragen.' } };
  sp.aendern((s) => {
    const da = id ? s.fragen.find((x) => x.id === id) : null;
    if (da) da.text = text;
    else s.fragen.push({ id: sp.kennung(), text, erledigt: false });
  });
  return { ok: true, meldung: 'Frage gespeichert', danach: { name: 'fragen' } };
}

// ---------------------------------------------------------------- Vorrat

/**
 * Seit dem Zählen eine andere Stärke (µg)? Dann gilt die gezählte Packung
 * nicht mehr, und keine Rechnung kann das verrechnen: Die App zählte die
 * alte Packung weiter herunter und meldete sich zu früh, zu spät oder gar
 * nicht (D13). → der erste Eintrag mit anderer Stärke, der heute schon gilt,
 * oder null. Eine andere Tablettenzahl bei gleicher Stärke rechnet
 * sp.vorratReicht() abschnittsweise mit.
 *
 * Runde 7: H6, H14 – nur Einträge, die galten (ez.dosenDieGalten): ohne die,
 * die nach Angabe der Nutzerin nie genommen wurden, und ohne einen, den am
 * selben Tag ein anderer ersetzt hat. Vorher behauptete „Heute" nach „nie
 * genommen" „Seit dem 04.06.2026 nehmen Sie eine andere Stärke. Die gezählte
 * Packung gilt dafür nicht mehr" – und unterdrückte dafür die richtige
 * Warnung „Vorrat reicht noch etwa 4 Tage".
 */
export function vorratAndereStaerke(stand, heute) {
  const v = stand.vorrat;
  if (!v) return null;
  const dosen = ez.dosenDieGalten(stand, heute);
  const damals = dosen.filter((d) => d.ab <= v.stand).pop() || dosen[0] || null;
  if (!damals || damals.mikrogramm === null) return null;
  return dosen.find((d) => d.ab > v.stand && d.ab <= heute && d.mikrogramm !== null && d.mikrogramm !== damals.mikrogramm) || null;
}

/** „reicht noch etwa 5 Tage", „… 1 Tag" – oder „aufgebraucht". */
export const vorratText = (reicht) => (reicht <= 0 ? 'aufgebraucht' : `reicht noch etwa ${reicht} ${reicht === 1 ? 'Tag' : 'Tage'}`);

/**
 * `id` 'neu': neu zählen (von „Heute" nach einer anderen Stärke) – leer und
 * mit heute als Tag. Sonst stand dort der alte Tag des Zählens, und wer ihn
 * nicht änderte, zählte die neue Packung rückwirkend. Nach einer anderen
 * Stärke gilt das auch ohne 'neu' (Runde 4: E32).
 */
function vorratFormular(id, stand, heute) {
  const andere = vorratAndereStaerke(stand, heute);
  // Nach einer anderen Stärke auch ohne 'neu' – etwa über „Mehr →
  // Tablettenvorrat", wohin die Meldung nach dem Speichern der Dosis schickt.
  // Dort stand sonst der alte Tag des Zählens: Wer nur die Zahl änderte,
  // speicherte sie mit dem alten Tag, und „Bitte neu zählen" blieb für immer
  // stehen. Nur den Tag auf heute zu setzen genügte nicht – die alte Zahl
  // würde beim bloßen Speichern auf heute verschoben (Runde 4: E32).
  const v = stand.vorrat && id !== 'neu' && !andere ? stand.vorrat : { tabletten: null, stand: heute };
  const reicht = sp.vorratReicht(heute);
  const aktuell = andere
    ? ` Seit dem ${datumKurz(andere.ab)} nehmen Sie eine andere Stärke (${zahlFeld(andere.mikrogramm)} µg) – bitte zählen Sie die Tabletten dieser Packung.`
    : reicht !== null ? ` Aktuell: ${vorratText(reicht)}.` : '';
  return {
    titel: 'Tablettenvorrat',
    html: `
      <form data-formular="vorrat" novalidate>
        <p class="gedaempft" style="margin-bottom:.9rem">Wie viele Tabletten sind heute noch da? Die App zählt ab hier täglich herunter und meldet sich zwei Wochen vor dem Ende.${esc(aktuell)}</p>
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
  // Runde 5: F29 – dieselbe Obergrenze wie normStand. Ohne sie wurde ein
  // Vorrat über 10 000 gespeichert („Vorrat gespeichert") und beim nächsten
  // Laden still verworfen.
  else if (tabletten > sp.ZAHL_GRENZEN.vorrat.max) fehler.tabletten = `Bitte prüfen: Die App zählt höchstens ${sp.ZAHL_GRENZEN.vorrat.max} Tabletten. Tragen Sie ein, wie viele Tabletten heute noch da sind, z. B. 100.`;
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


/*
 * Runde 6: G21 – Kaffee: Die Frage folgt jetzt dem Plan „Was braucht
 * Abstand?" (frühestens nach 30, besser nach 60 Minuten) statt „mindestens 60
 * Minuten" – wer dem Plan folgte, musste „Nein" antworten und bekam auf der
 * Dosis-Karte „Halten Sie zuerst jeden Tag die Abstände ein". Die Minuten
 * kommen weiter aus ABSTAND_MITTEL. Ein „Nein" auf die alte Frage
 * (profil.kaffeePruefen) bleibt stehen, mit der Bitte, es zu prüfen;
 * Speichern gilt als neue Antwort (sp.mittelSetzen).
 */
function abstandFrage(k, min) {
  if (k === 'kaffee') return `Trinken Sie Kaffee oder Tee mit mindestens ${abstandText(min)} Abstand nach der Schilddrüsen-Tablette? (Besser sind 60 Minuten.)`;
  return `Nehmen Sie dieses Mittel mit mindestens ${abstandText(min)} Abstand zur Schilddrüsen-Tablette?`;
}

/** Ein Mittel zum Ankreuzen – bei Aufnahmehemmern mit der Frage nach dem Abstand (P7). */
function mittelZeile([k, name], stand) {
  const an = stand.mittel.includes(k);
  const min = ez.ABSTAND_MITTEL[k];
  const oestrogen = stand.profil.oestrogenPruefen && k.startsWith('oestrogen_')
    ? '<span class="hinweis warn-text">Bitte prüfen: Nehmen Sie Östrogen als Tablette oder als Pflaster/Gel? Früher gab es hier nur „Östrogen" – die App hat „als Tablette" angenommen.</span>' : '';
  // Runde 7: H5 – mit Haken: Erst eine geänderte oder bestätigte Antwort gilt
  // für die neue Frage, nicht schon das Speichern (sp.mittelSetzen).
  const kaffee = k === 'kaffee' && stand.profil.kaffeePruefen && stand.mittelAbstand.kaffee
    ? `<span class="hinweis warn-text" data-hinweis="kaffee">Die Frage hat sich geändert: jetzt mindestens ${abstandText(min)} (besser 60). Stimmt Ihre Antwort noch?</span>
      <label class="haken haken-breit"><input type="checkbox" name="kaffeeNeu">Meine Antwort gilt für die neue Frage</label>` : '';
  return `
    <div class="mittel-zeile" data-mittel="${esc(k)}">
      <label class="haken haken-breit"><input type="checkbox" name="mittel" value="${esc(k)}" ${an ? 'checked' : ''}>${esc(name)}</label>
      ${oestrogen}
      ${min ? `<div class="mittel-abstand">${wahlFrage(`abstand_${k}`, stand.mittelAbstand[k] || '', abstandFrage(k, min), { extra: kaffee })}</div>` : ''}
    </div>`;
}

/*
 * Runde 6: G20 – Über der Mittelliste stand „Neu begonnen oder abgesetzt? …
 * dann erinnert die App an die Kontrolle nach 6–8 Wochen." Die Erinnerung
 * (L7b) gibt es aber nur für die Mittel in ez.L7B_MITTEL – bei Colestyramin,
 * Phosphatbindern, Jod oder Krebsmitteln wartete man auf eine, die nie kam.
 * Der Satz nennt jetzt genau diese Mittel, gebaut aus derselben Liste, damit
 * beide nie auseinanderlaufen; ein Mittel ohne eigenen Kurznamen hier kommt
 * mit seinem Namen aus der Liste der Mittel.
 */
const L7B_NAMEN = {
  ppi: 'Magenschutz wie Pantoprazol', kalzium: 'Kalzium', eisen: 'Eisen', oestrogen_tablette: 'Östrogen als Tablette', tamoxifen: 'Tamoxifen',
  raloxifen: 'Raloxifen', lithium: 'Lithium', amiodaron: 'Amiodaron', enzyminduktor: 'Carbamazepin, Phenytoin, Phenobarbital oder Rifampicin',
};
export function kontrolleMittelSatz() {
  const namen = ez.L7B_MITTEL.map((k) => L7B_NAMEN[k] || ez.mittelName(k).replace(/ \(.*\)$/, ''));
  // Der Name mit eigenem „oder" zuletzt und mit „bei", sonst verschwimmt die Aufzählung.
  const lang = namen.filter((n) => /,| oder /.test(n));
  const kurz = namen.filter((n) => !lang.includes(n));
  const liste = [kurz.join(', '), ...lang.map((n, i) => (kurz.length || i ? `bei ${n}` : n))].filter(Boolean).join(' und ');
  return `Neu begonnen oder abgesetzt? Am besten am selben Tag hier ändern. Bei ${liste} erinnert die App dann an die Kontrolle nach 6–8 Wochen. Bei anderen Mitteln fragen Sie die Praxis, ob kontrolliert werden soll.`;
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
          <label class="haken haken-breit" style="margin-bottom:.4rem"><input type="checkbox" name="behandelt" ${p.behandelt ? 'checked' : ''}>${esc(P6_HAKEN)}</label>
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
          <p class="hinweis" style="margin-bottom:.5rem" data-hinweis="kontrolle">${esc(kontrolleMittelSatz())}</p>
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
  // Runde 7: H5 – die Kaffee-Antwort gilt für die neue Frage nur, wenn sie
  // geändert oder mit dem Haken bestätigt wurde. Wer über „Bundesland
  // eintragen" nur das Bundesland speichert, beantwortet sie nicht.
  const kaffeeNeu = f.get('kaffeeNeu') === 'on' || (abstand.kaffee || '') !== (sp.getStand().mittelAbstand.kaffee || '');
  sp.mittelSetzen(mittel, abstand, heute, { kaffeeNeu });
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
  const name = zeileAus(f.get('name'), sp.GRENZEN.name);
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
    /*
     * Runde 8: J5 – „Die Praxis weiß davon" (WERT_BEKANNT) hängt an der
     * Kennung des Befunds. Wird von zwei Einträgen desselben Tages der
     * „falsche" gelöscht, bleibt die Angabe an einem Befund desselben Tages mit
     * demselben Wert – sonst stand der Gefahrenwert wieder auf „Heute anrufen".
     */
    if (art === 'labor') {
      const weg = s.labor.find((l) => l.id === id);
      const bleibt = weg ? s.labor.filter((l) => l !== weg && l.datum === weg.datum) : [];
      s.nachfragen.forEach((n) => {
        if (n.art !== ez.WERT_BEKANNT || n.bezug !== id || !weg || !weg[n.antwort]) return;
        const gleich = bleibt.find((l) => l[n.antwort] && !sp.wertWiderspruch(l[n.antwort], weg[n.antwort]));
        if (gleich) n.bezug = gleich.id;
      });
    }
    if (liste) s[liste] = s[liste].filter((e) => e.id !== id);
  });
}

export { datumInWorten, uhrText };
