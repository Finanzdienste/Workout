/*
 * Begrüßung – das Fenster „So hilft Ihnen die App" (Nov. 2026).
 *
 * Die Nutzerin hat ihre Tabletten weggelassen: Sie beeinflussten nur „den
 * einen Wert" und lösten nicht das eigentliche Problem. Und sie fand in der App
 * nichts zu tun – auf „Heute" stand nur, worauf sie achten soll. Dieses Fenster
 * erklärt beides in sechs kurzen Seiten: was das Hormon tut, dass die Tablette
 * das Hormon selbst ist, was sie kann und was nicht, was man bei Zweifeln tut,
 * was man in der App machen kann, und was mit den Daten passiert.
 *
 * Der Text ist medizinisch und sprachlich geprüft (Quellen und Anmerkungen
 * beim Auftrag, PR #4). Er steht hier wörtlich und als reiner Text – die
 * Ansicht entschärft ihn mit esc() wie alles andere. Wer ihn ändert, zählt
 * EINFUEHRUNG_FASSUNG hoch, wenn ihn alle noch einmal sehen sollen.
 * Ausführlicher steht dasselbe im Wissen, Kapitel „Warum die Tablette wichtig
 * ist" (js/wissen.js).
 *
 * Zwei Sätze nach der Prüfung (Nov. 2026) nur verständlicher gefasst, ohne
 * neuen Inhalt – deshalb bleibt EINFUEHRUNG_FASSUNG: Seite 4 „Ob das für Sie
 * gilt, zeigt ein Wert mit Tablette nicht." war ohne Vorwissen kaum zu
 * verstehen (jetzt wie im Wissen: „… nicht ablesen"), und Seite 6 schickte
 * zum Ausschalten nach „Mehr", obwohl der Schalter direkt darunter steht.
 *
 * Wann es erscheint, entscheidet js/app.js mit faellig(), vonSelbstErlaubt()
 * und notlageHeute():
 *   - beim ersten „Heute" nach dem Einrichten, und
 *   - einmal bei jedem eingerichteten Stand ohne das Merkmal – gerade bei der
 *     Nutzerin, die schon Einträge aus der alten App (PR #3) hat. Das Merkmal
 *     ist `profil.einfuehrung` (js/speicher.js, Datenfassung 4): die Fassung
 *     dieses Texts, die angezeigt wurde.
 *   - nie über einer echten Notlage: Steht auf „Heute" eine 112-Karte
 *     (Warnzeichen W1, W5, auch W4a „jetzt den Giftnotruf"), wartet es bis zum
 *     nächsten Öffnen. Unter „Mehr → Einführung" bleibt es immer erreichbar.
 */
import { esc } from './text.js';
import { relativ } from './datum.js';
import * as ez from './einschaetzung.js';
import { gesamtbildMitDosis } from './dosis.js';
import * as rk from './rueckkanal.js';

/** Die Fassung des Texts. Höher als profil.einfuehrung: Das Fenster erscheint (noch einmal). */
export const EINFUEHRUNG_FASSUNG = 1;

/*
 * Der Betreiber der App, an den der Rückkanal meldet – eine Stelle für den
 * Namen. Rückkanal (Nov. 2026): Sie steht jetzt in js/rueckkanal.js, ebenso
 * lokaleAdresse(); beide bleiben hier zu haben wie bisher.
 */
export const { BETREIBER, lokaleAdresse } = rk;

/*
 * Der Satz zum Rückkanal, wörtlich – er steht auf der letzten Seite und soll
 * genauso unter „Mehr → Über diese App" neben dem Schalter stehen. „Die
 * Einführung" statt „diese Einführung", damit er auch dort passt.
 */
export const RUECKKANAL_SATZ = `Beim Öffnen geht einmal am Tag eine kurze Meldung an ${BETREIBER}. So kann er helfen, wenn die App nicht läuft oder veraltet ist. Darin steht nur: eine Zufallsnummer statt eines Namens, welche Version, ob die App als Symbol auf dem Startbildschirm liegt, welche Art Handy, ob die Einführung schon angezeigt wurde, an welchem Tag die App zuerst und zuletzt geöffnet wurde und an wie vielen Tagen.`;

/*
 * Wer die Meldung aufbewahrt – unter „Mehr → Über diese App" beim Schalter.
 * Nicht im Fenster: Dessen Text ist geprüft und bleibt, wie er ist.
 */
export const RUECKKANAL_DIENST = `Die Meldung liegt bei Supabase, einem Dienst im Internet. Wie jeder Dienst sieht er dabei die Adresse des Handys im Netz (IP-Adresse). In die Liste für ${BETREIBER} kommt sie nicht.`;

/** Die Seiten: { titel, absaetze } – reiner Text. */
export const SEITEN = [
  {
    titel: 'Wozu die Tablette?',
    absaetze: [
      'Vielleicht fragen Sie sich: Wozu jeden Tag eine Tablette, die doch nur einen Wert verändert? Eine berechtigte Frage.',
      'Die Schilddrüse bildet ein Hormon. Es heißt Thyroxin. Es wirkt in fast jeder Zelle. Es hat Einfluss auf Kraft, Wärme, Herz, Verdauung, Denken und Stimmung.',
    ],
  },
  {
    titel: 'Die Tablette ist das Hormon selbst',
    absaetze: [
      'Bei einer Unterfunktion bildet die Schilddrüse zu wenig davon. Ihre Tablette enthält genau dieses Hormon: L-Thyroxin. Es ersetzt, was fehlt – im ganzen Körper.',
      'Der TSH-Wert ist nicht das Ziel, sondern eine Anzeige: Fehlt dem Körper Hormon, steigt er. Weil er das meist am besten zeigt, richtet sich die Dosis nach ihm.',
    ],
  },
  {
    titel: 'Was die Tablette kann – und was nicht',
    absaetze: [
      'Die Tablette heilt die Schilddrüse nicht. Sie ersetzt aber, was fehlt – wie eine Brille: Sie heilt die Augen nicht, aber man sieht gut damit. Deshalb braucht man sie meist ein Leben lang.',
      'Ohne Tablette merkt man erst nichts, denn das Hormon wirkt lange nach. Beschwerden wie Müdigkeit und Frieren kommen meist schleichend, nach Wochen bis Monaten. Über Jahre kann ein deutlicher Mangel Herz und Gefäße belasten.',
    ],
  },
  {
    titel: 'Wenn Sie zweifeln',
    absaetze: [
      'Das ist Ihr gutes Recht. Bei nur leicht erhöhtem TSH ohne Beschwerden beginnt man oft gar nicht erst mit der Tablette.',
      'Ob das auch für Sie gilt, kann man an einem Wert, der mit Tablette gemessen wurde, nicht ablesen. Die Praxis kennt Ihre Werte von früher. Besprechen Sie dort, was dafür und was dagegen spricht – bitte, bevor Sie etwas weglassen.',
      'Haben Sie die Tablette eine Weile nicht genommen, oder geht es Ihnen mit ihr nicht gut? Sagen Sie es der Praxis in den nächsten Tagen. Dort hört man das öfter, und gemeinsam finden Sie einen Weg.',
    ],
  },
  {
    titel: 'Das können Sie in der App',
    absaetze: [
      'Jeden Morgen die Tablette abhaken – nüchtern mit Wasser, mindestens 30, besser 60 Minuten vor Frühstück und Kaffee.',
      'Laborwerte vom Befund eintragen. Die App ordnet sie ein.',
      'Die Dosis-Karte zeigt, ob der TSH-Wert für mehr, weniger oder gleich viel spricht. Die Dosis legt die Praxis mit Ihnen fest.',
      'Eintragen, wie es Ihnen geht, und Fragen notieren – für den Bericht zum Arzttermin.',
      'Unter „Mehr": Wissen und Warnzeichen. Notrufnummern: oben auf „Heute".',
    ],
  },
  {
    titel: 'Ihre Daten',
    absaetze: [
      'Was Sie eintragen, bleibt auf diesem Handy – auch, ob Sie die Tablette abhaken.',
      RUECKKANAL_SATZ,
      'Nichts über Ihre Gesundheit. Ausschalten können Sie das gleich hier unten – oder später unter „Mehr → Über diese App".',
    ],
  },
];

/** Ist das Fenster für diesen Stand fällig? Nur eingerichtet, und nur, solange diese Fassung nicht angezeigt wurde. */
export function faellig(stand) {
  return Boolean(stand && stand.profil.begruesst) && stand.profil.einfuehrung < EINFUEHRUNG_FASSUNG;
}

/*
 * Von einer lokalen Adresse (Testläufe, Entwicklung) erscheint das Fenster
 * nicht von selbst – dieselbe Regel wie für den Rückkanal der Workout-App
 * (js/config.js, lokaleAdresse). Fast jede Testdatei legt einen eingerichteten
 * Stand aus einer älteren Fassung an, also ohne das Merkmal: Das Fenster läge
 * dann in jeder über „Heute", und jeder Tipp dort ginge ins Leere. Eine Regel,
 * an die siebzehn Testdateien denken müssen, ist keine Regel.
 * tests/test-sd-begruessung.mjs schaltet es ausdrücklich frei. Unter „Mehr"
 * lässt es sich überall öffnen.
 */
export const EINFUEHRUNG_LOKAL = 'schilddruese.einfuehrung.lokal';

/** Darf das Fenster hier von selbst erscheinen? */
export function vonSelbstErlaubt() {
  if (!lokaleAdresse()) return true;
  try {
    return localStorage.getItem(EINFUEHRUNG_LOKAL) === '1';
  } catch {
    return false;
  }
}

/*
 * Eine echte Notlage auf „Heute": irgendetwas mit der Stufe „Sofort 112" –
 * die 112-Karte aus dem Warnzeichen-Check (W1), seelische Not aus dem
 * Befinden oder dem Check (W5), „jetzt den Giftnotruf" (W4a), oder die
 * Einschätzung selbst. Aus dem Stand gerechnet, nicht aus dem gezeichneten
 * „Heute": So hängt es nicht an Klassen, die sich beim Umbau von „Heute"
 * ändern. js/app.js sieht zusätzlich im gezeichneten „Heute" nach.
 */
export function notlageHeute(stand, heute) {
  const notruf = (liste) => Array.isArray(liste) && liste.some((t) => t && t.stufe === 'notruf');
  try {
    if (notruf(ez.beschwerdenAuswerten(stand, heute).texte)) return true;
    const w = ez.warnHeute(stand, heute);
    if (w && notruf(w.abschnitte)) return true;
    return ez.aktiv(stand) && gesamtbildMitDosis(stand, heute).stufe === 'notruf';
  } catch {
    // Lieber einmal zu wenig zeigen als über einer Notlage.
    return true;
  }
}

/*
 * Rückkanal (Nov. 2026): der Schalter zum Satz – auf der letzten Seite des
 * Fensters (rueckkanalStelle) und unter „Mehr → Über diese App"
 * (js/ansicht-mehr.js). Zwei Knöpfe „An" und „Aus" wie bei Schrift und
 * Farben, der gewählte mit aria-pressed; darunter in Worten, was gilt.
 * data-act="rueckkanal" kommt über die Weiche in js/app.js an, die die Seite
 * danach an derselben Stelle neu zeichnet. Kein <p>: Die Absätze der Seite
 * sind der geprüfte Text (tests/test-sd-begruessung.mjs vergleicht sie
 * wörtlich), der Schalter gehört nicht dazu.
 */
function rueckkanalZustand(an, heute) {
  const z = rk.zustand();
  if (z.lokal) return 'Von dieser Adresse aus meldet die App nichts (Testbetrieb).';
  if (!an) {
    return z.loeschenOffen
      ? `Aus. Die letzte Meldung bei ${BETREIBER} wird gelöscht.`
      : `Aus. Es geht keine Meldung mehr an ${BETREIBER}.`;
  }
  if (!z.gemeldet) return 'An. Noch nichts gemeldet.';
  return z.gemeldet === heute ? 'An. Heute schon gemeldet.' : `An. Zuletzt gemeldet: ${relativ(z.gemeldet, heute)}.`;
}

export function rueckkanalSchalter(stand, heute, { titel = true } = {}) {
  const an = stand.einstellungen.rueckkanal === true;
  const name = `Meldung an ${BETREIBER}`;
  const knopf = (wert, text) => `<button type="button" class="knopf" data-act="rueckkanal" data-wert="${wert}" aria-pressed="${(wert === 'an') === an}">${text}</button>`;
  return `
    <div class="rueckkanal-schalter">
      ${titel ? `<div class="rueckkanal-titel" aria-hidden="true">${esc(name)}</div>` : ''}
      <div class="wahl" role="group" aria-label="${esc(name)}">${knopf('an', 'An')}${knopf('aus', 'Aus')}</div>
      <div class="rueckkanal-stand klein gedaempft">${esc(rueckkanalZustand(an, heute))}</div>
    </div>`;
}

/* Die Stelle auf der letzten Seite, unter dem Satz zum Rückkanal. */
export function rueckkanalStelle(stand, heute) {
  return rueckkanalSchalter(stand, heute);
}

/*
 * Rückkanal (Nov. 2026): Die erste Meldung geht erst raus, wenn der Satz dazu
 * zu sehen war (profil.einfuehrungDaten, js/app.js: rueckkanalPruefen). Wer
 * das Fenster vor der letzten Seite schließt („Später lesen", Escape), wer es
 * wegen einer 112-Lage nicht bekam oder wer am selben Tag auf „Mehr" startet,
 * hatte ihn nie vor Augen – und gerade eine Nutzerin, die der Tablette
 * misstraut, überspringt das Fenster leicht. Dann steht auf „Heute" diese
 * kleine Karte, ohne Stufe, ganz unten bei den Hinweisen. Erst nach
 * „Verstanden" (oder einem Tipp auf den Schalter) wird gemeldet. Text nach dem
 * Vorschlag der Textautorin (Anmerkungen zum Text, „Einbau – Rückkanal").
 *
 * Nur, wenn wirklich etwas rausginge: eingerichtet, eingeschaltet und nicht
 * von einer lokalen Adresse ohne Freigabe – sonst stünde die Karte in jedem
 * Testlauf auf „Heute" und kündigte eine Meldung an, die nie kommt.
 */
export function rueckkanalKarteFaellig(stand) {
  return Boolean(stand && stand.profil.begruesst) && stand.einstellungen.rueckkanal === true
    && stand.profil.einfuehrungDaten !== true && rk.sendenErlaubt();
}

export const RUECKKANAL_KURZ = `Die App schickt ${BETREIBER} einmal am Tag eine kurze Meldung, ob sie läuft und aktuell ist – nichts über Ihre Gesundheit.`;

export function rueckkanalKarte() {
  return `
    <div class="karte rueckkanal-hinweis" data-regel="rueckkanal-hinweis">
      <h2>Meldung an ${esc(BETREIBER)}</h2>
      <p>${esc(RUECKKANAL_KURZ)}</p>
      <p class="klein gedaempft">Was genau darin steht, lesen Sie unter „Mehr → Über diese App".</p>
      <div class="knopf-reihe">
        <button type="button" class="knopf knopf-haupt" data-act="rueckkanal-verstanden">Verstanden</button>
        <button type="button" class="knopf" data-act="rueckkanal" data-wert="aus">Ausschalten</button>
      </div>
    </div>`;
}

/** Woran js/app.js eine 112-Karte im gezeichneten „Heute" erkennt – zusätzlich zu notlageHeute(). */
export const NOTLAGE_IM_BILD = '.notruf-karte, .w5-karte, [data-regel="W1"], [data-regel="W5"], [data-regel="W4a"]';

/**
 * Der Inhalt des Fensters für Seite `i` (ab 0). Über dem Titel „Seite x von 6"
 * und „Später lesen", unten fest „Zurück" und „Weiter" – auf der letzten Seite
 * „Los geht's". Die Knopfzeile klebt unten: Die Seiten 2 bis 6 sind bei
 * Schrift „groß" auf 360 × 740 höher als das Fenster, „Weiter" bleibt so
 * immer zu sehen. Die Überschrift trägt den Fokus (tabindex -1) – stünde er
 * auf „Weiter", rollte das Fenster beim Öffnen bis ganz nach unten, und Titel
 * und erster Absatz wären verdeckt.
 */
export function seiteHtml(i, stand, heute) {
  const n = SEITEN.length;
  const s = SEITEN[i];
  const letzte = i === n - 1;
  return `
    <div class="begruessung-kopf">
      <p class="schritte" id="begruessung-schritt">Seite ${i + 1} von ${n}</p>
      <button type="button" class="knopf-link" data-act="begruessung-zu">${letzte ? 'Schließen' : 'Später lesen'}</button>
    </div>
    <h2 id="begruessung-titel" tabindex="-1" aria-describedby="begruessung-schritt">${esc(s.titel)}</h2>
    ${s.absaetze.map((a) => `<p>${esc(a)}</p>`).join('')}
    ${letzte ? `<div class="begruessung-stelle" data-stelle="rueckkanal">${rueckkanalStelle(stand, heute)}</div>` : ''}
    <div class="begruessung-knoepfe">
      ${i > 0 ? '<button type="button" class="knopf" data-act="begruessung-zurueck"><span aria-hidden="true">‹</span> Zurück</button>' : ''}
      ${letzte
    ? '<button type="button" class="knopf knopf-haupt" data-act="begruessung-fertig">Los geht\'s</button>'
    : '<button type="button" class="knopf knopf-haupt" data-act="begruessung-weiter">Weiter <span aria-hidden="true">›</span></button>'}
    </div>`;
}
