/*
 * Mahlzeit – die Oberfläche.
 *
 * Kein Willkommen mit Fragen, keine Anmeldung: Beim ersten Öffnen steht
 * „Heute" da, mit dem großen Knopf „Essen eintragen". Alles Weitere
 * (Tagesziel, Hafertage, Werte) ist freiwillig und wartet unter seinem
 * Reiter. Der Grund steht in README.md: Eine Kalorien-App mit 30 Fragen am
 * Anfang hat der, für den diese App ist, nach den Fragen wieder gelöscht.
 *
 * Gerechnet wird in rechnen.js, gespeichert in speicher.js. Hier wird nur
 * angezeigt und auf Tipps reagiert – über ein einziges data-tun je Knopf.
 */
import { BEREICHE, LEBENSMITTEL, BELIEBT, NACH_ID } from './lebensmittel.js';
import * as R from './rechnen.js';
import { lesen, aendern, allesLoeschen, neueId, SCHLUESSEL } from './speicher.js';
import * as S from './strichcode.js';
import * as K from './ki.js';
import * as SP from './sport.js';
import { figur } from './figuren.js';
import * as LZ from './lebenszeichen.js';
import * as UHR from './uhr.js';

export const FASSUNG = 'v17';

const $ = (sel, el = document) => el.querySelector(sel);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));

const heute = () => R.tagVon(new Date());

const zustand = {
  seite: 'heute',
  tag: null,          // angezeigter Tag unter „Heute"; null = heute
  monat: 0,           // Hafer-Kalender: Monate ab dem laufenden
  zuckerWann: null,
};

/** Die offene Ebene über der Seite (Essen eintragen, Eintrag ändern) oder null. */
let ebene = null;

// --- Nachschlagen ----------------------------------------------------------

function alleSachen(stand) {
  return [...stand.eigene.map((e) => ({ ...e, k: 'eigen' })), ...LEBENSMITTEL];
}

function sucheSache(stand, id) {
  if (NACH_ID.has(id)) return NACH_ID.get(id);
  const e = stand.eigene.find((x) => x.id === id);
  return e ? { ...e, k: 'eigen' } : null;
}

const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

// --- Meldung mit Rückgängig ------------------------------------------------

let meldungUhr = null;
let rueckgaengig = null;

function meldung(text, zurueck = null) {
  const el = $('#meldung');
  rueckgaengig = zurueck;
  el.innerHTML = `<span>${esc(text)}</span>${zurueck ? '<button type="button" data-tun="rueckgaengig">Rückgängig</button>' : ''}`;
  el.classList.add('sichtbar');
  clearTimeout(meldungUhr);
  meldungUhr = setTimeout(() => { el.classList.remove('sichtbar'); rueckgaengig = null; }, zurueck ? 6000 : 3500);
}

// --- Seiten ----------------------------------------------------------------

function zeige() {
  const main = $('#ansicht');
  const stand = lesen();
  if (zustand.seite === 'hafer') main.innerHTML = seiteHafer(stand);
  else if (zustand.seite === 'werte') main.innerHTML = seiteWerte(stand);
  else if (zustand.seite === 'sport') main.innerHTML = seiteSport(stand);
  else if (zustand.seite === 'mehr') main.innerHTML = seiteMehr(stand);
  else main.innerHTML = seiteHeute(stand);
  document.querySelectorAll('.leiste [data-seite]').forEach((b) => {
    if (b.dataset.seite === zustand.seite) b.setAttribute('aria-current', 'page');
    else b.removeAttribute('aria-current');
  });
  if (ebene) zeigeEbene();
}

function wechsle(seite) {
  zustand.seite = seite;
  if (seite === 'heute') zustand.tag = null;
  zeige();
  window.scrollTo(0, 0);
}

// --- Heute -----------------------------------------------------------------

function seiteHeute(stand) {
  const h = heute();
  const tag = zustand.tag || h;
  const liste = stand.tage[tag] || [];
  const summe = R.summe(liste);
  const istHeute = tag === h;
  let html = `
    <div class="tagnav">
      <button type="button" class="rund" data-tun="tag" data-schritt="-1" aria-label="Tag davor">‹</button>
      <div class="tagnav-mitte">
        <h2 id="tag-titel">${esc(R.tagName(tag, h))}</h2>
        ${Math.abs(R.abstand(h, tag)) <= 1 ? `<p class="leise">${esc(R.datumLang(tag))}</p>` : ''}
      </div>
      <button type="button" class="rund" data-tun="tag" data-schritt="1" aria-label="Tag danach" ${istHeute ? 'disabled' : ''}>›</button>
    </div>
    <section class="karte summe" aria-live="polite">
      <p class="gross"><span id="summe-kcal">${R.zahl(summe.kcal)}</span> <span class="einheit">kcal</span></p>
      ${zielZeile(stand, summe.kcal)}
      ${summe.kh || summe.ei ? `<p class="leise klein" id="summe-naehr">davon etwa ${R.zahl(summe.kh)} g Kohlenhydrate · ${R.zahl(summe.ei)} g Eiweiß</p>` : ''}
    </section>
    <button type="button" class="knopf haupt gross-knopf" data-tun="essen" id="essen-knopf">＋ Essen eintragen</button>`;

  // Oben, was jetzt zählt (Willkommen, der heutige Hafertag), dann die
  // Einträge, darunter, was warten kann.
  html += kartenOben(stand, tag, h);
  html += wieVorherHtml(stand, tag, h);
  html += eintragsListe(liste);
  html += kartenUnten(stand, tag, h);
  html += wochenKarte(stand, h);
  if (Object.keys(stand.tage).length) html += '<button type="button" class="knopf leise breit" data-tun="protokoll" id="protokoll-knopf">📋 Ernährungsprotokoll (zum Teilen oder Drucken)</button>';
  return html;
}

/** „etwa 27 g Kohlenhydrate · 5 g Eiweiß" */
const naehrText = (w) => `etwa ${R.zahl(w.kh || 0)} g Kohlenhydrate${w.ei ? ` · ${R.zahl(w.ei)} g Eiweiß` : ''}`;

function zielZeile(stand, kcal) {
  if (!stand.ziel) return '';
  const anteil = Math.min(100, Math.round((kcal / stand.ziel) * 100));
  const rest = stand.ziel - kcal;
  const text = rest >= 0 ? `noch ${R.zahl(rest)}` : `${R.zahl(-rest)} drüber`;
  return `<div class="balken${rest < 0 ? ' drueber' : ''}" role="img" aria-label="${anteil} Prozent vom Tagesziel"><span style="width:${anteil}%"></span></div>
    <p class="klein" id="ziel-text">von ${R.zahl(stand.ziel)} · ${text}</p>`;
}

function kartenOben(stand, tag, h) {
  let html = '';
  if (!stand.hinweise.willkommen && tag === h) {
    html += `<section class="karte hinweis" id="willkommen">
      <p><strong>Hallo!</strong> Keine Fragen, kein Konto. Tipp auf „Essen eintragen“ und such, was du gegessen hast – die App sagt dir die Kalorien. Alles bleibt auf deinem Handy.</p>
      <p class="klein">Tobi erfährt, ob du die App nutzt, und sieht deine Werte (Gewicht, Blutzucker, Schlaf …)${stand.essenTeilen === true ? ' und, weil du es erlaubt hast, was du isst' : ' – nicht, was du isst'}. Abschaltbar unter „Mehr“.</p>
      <button type="button" class="knopf leise" data-tun="hinweis-weg" data-hinweis="willkommen">Alles klar</button>
    </section>`;
  }
  // v14: Tobi möchte auch das Essen sehen. Bis v13 stand hier „nicht, was du
  // isst“ – also wird Uwe einmal gefragt, statt still mehr zu schicken. Nur
  // auf „Heute“, nur wenn schon etwas eingetragen ist, nicht gleich neben dem
  // Hallo; nach einer Antwort nie wieder (umstellen unter „Mehr“).
  if (tag === h && stand.meldung !== false && stand.essenTeilen === undefined
      && stand.hinweise.willkommen && Object.keys(stand.tage || {}).length) {
    html += `<section class="karte hinweis" id="essen-frage">
      <h3>🍽 Darf Tobi auch sehen, was du isst?</h3>
      <p>Bisher sieht Tobi nur deine Werte und wie oft du etwas einträgst. Wenn du zustimmst, gehen auch deine Einträge an ihn: was, wie viel, die Kalorien, die letzten 60 Tage.</p>
      <p class="klein">Bis du „Ja“ tippst, geht davon nichts weg. Unter „Mehr“ kannst du es jederzeit wieder abstellen – dann ist es bei Tobi auch wieder weg.</p>
      <div class="reihe">
        <button type="button" class="knopf" data-tun="essen-teilen" data-an="1">Ja, darf er</button>
        <button type="button" class="knopf leise" data-tun="essen-teilen" data-an="">Lieber nicht</button>
      </div>
    </section>`;
  }
  if (tag === h && installierenZeigen(stand, h)) {
    html += `<section class="karte hinweis" id="installieren">
      <h3>📲 Als App auf den Startbildschirm</h3>
      ${installierenHtml()}
      <button type="button" class="knopf leise" data-tun="install-spaeter">Später</button>
    </section>`;
  }
  if (tag === h && geraet() === 'ios' && !stand.uhr && !stand.hinweise.uhrSpaeter) {
    html += `<section class="karte hinweis" id="uhr-hinweis">
      <p>⌚ <strong>Schlaf und Schritte von deiner Uhr</strong> können von selbst hier landen. Dafür muss <strong>Tobi</strong> einmal etwas an deinem Handy einrichten – etwa zehn Minuten.</p>
      <p class="klein">Gib ihm dein Handy und tipp auf „Tobi richtet ein“.</p>
      <div class="reihe"><button type="button" class="knopf" data-tun="uhr-einrichten">Tobi richtet ein</button>
      <button type="button" class="knopf leise" data-tun="hinweis-weg" data-hinweis="uhrSpaeter">Später</button></div>
    </section>`;
  }
  if (R.istHafertag(stand, tag)) html += haferHeute(stand, tag);
  return html;
}

/*
 * Auf den Startbildschirm – so, wie es auf diesem Handy geht. Chrome auf
 * Android bietet das Installieren selbst an (beforeinstallprompt), dann
 * reicht ein Knopf. Sonst, und auf dem iPhone immer, die Schritte. Auf dem
 * iPhone mit Grund: Safari löscht die Daten einer Seite, die ein paar Wochen
 * nicht geöffnet wurde – eine App auf dem Home-Bildschirm nicht.
 */
let installAngebot = null;
window.addEventListener('beforeinstallprompt', (ev) => {
  ev.preventDefault();
  installAngebot = ev;
  if (!ebene) zeige();
});
window.addEventListener('appinstalled', () => {
  installAngebot = null;
  aendern((s) => { s.hinweise.installiert = heute(); });
  if (!ebene) zeige();
  meldung('Installiert – ab jetzt über das Symbol auf dem Startbildschirm öffnen.');
});

const geraet = () => R.geraet(navigator.userAgent, navigator.maxTouchPoints || 0);

function installierenZeigen(stand, h) {
  if (standalone() || stand.hinweise.installiert) return false;
  if (!installAngebot && geraet() === 'andere') return false;
  const spaeter = stand.hinweise.installSpaeter;
  return !(spaeter && R.abstand(spaeter, h) < 7);
}

/*
 * Die Symbole, wie sie auf dem Handy aussehen – „Teilen" allein sagt
 * niemandem, wo er tippen soll (Tobi, 17.11.: „Wie genau kann man bei nem
 * iphone teilen?").
 */
const SYMBOL = {
  teilen: '<svg class="symbol" viewBox="0 0 24 24" aria-hidden="true"><path d="M8.5 9.5H7a1.5 1.5 0 0 0-1.5 1.5v8A1.5 1.5 0 0 0 7 20.5h10a1.5 1.5 0 0 0 1.5-1.5v-8A1.5 1.5 0 0 0 17 9.5h-1.5"/><path d="M12 14V3.5"/><path d="M8.8 6.7 12 3.5l3.2 3.2"/></svg>',
  mehr: '<svg class="symbol" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9.5"/><circle class="voll" cx="7.6" cy="12" r="1.3"/><circle class="voll" cx="12" cy="12" r="1.3"/><circle class="voll" cx="16.4" cy="12" r="1.3"/></svg>',
  plus: '<svg class="symbol" viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="4"/><path d="M12 8.5v7M8.5 12h7"/></svg>',
  punkte: '<svg class="symbol" viewBox="0 0 24 24" aria-hidden="true"><circle class="voll" cx="12" cy="5.5" r="1.8"/><circle class="voll" cx="12" cy="12" r="1.8"/><circle class="voll" cx="12" cy="18.5" r="1.8"/></svg>',
  kompass: '<svg class="symbol" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9.5"/><path class="voll" d="M15.5 8.5 13 13l-4.5 2.5L11 11z"/></svg>',
  strich: '<svg class="symbol" viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 7V4.5h3M20.5 7V4.5h-3M3.5 17v2.5h3M20.5 17v2.5h-3"/><path d="M7 8v8M9.5 8v8M12 8v8M15.5 8v8M17.5 8v8" stroke-width="1.6"/></svg>',
};

function installierenHtml() {
  if (standalone()) return '<p>✓ Läuft schon als App vom Startbildschirm.</p>';
  if (installAngebot) {
    return `<p>Dann öffnest du sie mit einem Tipp wie jede andere App – auch ohne Netz.</p>
      <button type="button" class="knopf haupt" data-tun="installieren" id="install-knopf">Jetzt installieren</button>`;
  }
  const danach = '<p class="klein">Danach liegt <strong>„Mahlzeit“</strong> mit der grünen Schüssel auf dem Home-Bildschirm – ab jetzt die App immer darüber öffnen.</p>';
  if (geraet() === 'ios') {
    const safari = R.safariFassung(navigator.userAgent);
    const wichtig = '<p class="klein"><strong>Wichtig auf dem iPhone:</strong> Sonst löscht Safari deine Einträge, wenn du die Seite ein paar Wochen nicht öffnest. Vom Home-Bildschirm aus nicht.</p>';
    if (!safari) {
      // Chrome, Firefox & Co. auf dem iPhone: am sichersten über Safari.
      return `<p id="install-schritte">Am einfachsten geht es in <strong>Safari</strong>: Link kopieren, Safari öffnen, oben ins Adressfeld tippen und einfügen. Dann zeigt die App dort, wie es weitergeht.</p>
        <button type="button" class="knopf haupt" data-tun="link-kopieren" id="link-kopieren">Link kopieren</button>
        <p class="klein">Im Browser, in dem du gerade bist, geht es oft auch: ${SYMBOL.teilen} <strong>Teilen</strong> (in der Adresszeile) → <strong>„Zum Home-Bildschirm“</strong>.</p>
        ${wichtig}`;
    }
    const neu = safari >= 26;
    const code = K.kiAn() ? K.kiCode() : null;
    const codeZeile = code
      ? `<p class="klein" id="install-code">Dein KI-Code: <strong>${esc(code)}</strong> <button type="button" class="link" data-tun="code-kopieren">kopieren</button> – das iPhone gibt der App vom Home-Bildschirm einen eigenen Speicher. Nach dem Hinzufügen dort einmal unter „Mehr“ einfügen.</p>`
      : '';
    return `<ol class="schritte" id="install-schritte">
        ${neu
    ? `<li>Unten rechts auf ${SYMBOL.mehr} <strong>„⋯“</strong> tippen, dann auf ${SYMBOL.teilen} <strong>„Teilen“</strong>.<small>Siehst du unten gleich ${SYMBOL.teilen} „Teilen“? Dann direkt das antippen.</small></li>`
    : `<li>Unten in der Mitte auf ${SYMBOL.teilen} <strong>„Teilen“</strong> tippen – das Quadrat mit dem Pfeil nach oben.<small>Ist die Leiste unten verschwunden: ganz unten auf den Rand tippen, dann kommt sie wieder.</small></li>`}
        <li>In der Liste, die aufgeht, nach unten scrollen bis ${SYMBOL.plus} <strong>„Zum Home-Bildschirm“</strong> – antippen.<small>Fehlt der Eintrag: ganz unten „Aktionen bearbeiten“ und ihn dazunehmen.</small></li>
        ${neu ? '<li>Den Schalter <strong>„Als Web-App öffnen“</strong> anlassen.</li>' : ''}
        <li>Oben rechts auf <strong>„Hinzufügen“</strong>.</li>
      </ol>
      ${danach}
      <p class="klein">Aus WhatsApp geöffnet? Dann erst unten rechts auf ${SYMBOL.kompass} (in Safari öffnen) – dort geht es weiter.</p>
      ${codeZeile}
      ${wichtig}`;
  }
  return `<ol class="schritte" id="install-schritte">
      <li>In <strong>Chrome</strong> oben rechts auf ${SYMBOL.punkte} <strong>„⋮“</strong> tippen.</li>
      <li>${SYMBOL.plus} <strong>„Zum Startbildschirm hinzufügen“</strong> oder <strong>„App installieren“</strong> tippen.</li>
      <li><strong>„Installieren“</strong> bzw. <strong>„Hinzufügen“</strong> bestätigen.</li>
    </ol>
    ${danach}
    <p class="klein">Aus WhatsApp geöffnet? Dann erst oben rechts ${SYMBOL.punkte} → <strong>„In Chrome öffnen“</strong> – dort geht es weiter.</p>`;
}

function kartenUnten(stand, tag, h) {
  let html = '';
  if (tag === h) html += sportKarte(stand, h);
  if (tag === h && !R.istHafertag(stand, tag)) html += haferVorschau(stand, h);
  if (tag === h && sicherungFaellig(stand, h)) {
    html += `<section class="karte hinweis" id="sicherung-hinweis">
      <p>💾 <strong>Sicherung:</strong> Deine Einträge liegen nur auf diesem Handy. Speicher ab und zu eine Sicherung – bei einem neuen Handy ist sonst alles weg.</p>
      <div class="reihe"><button type="button" class="knopf" data-tun="sichern">Jetzt sichern</button>
      <button type="button" class="knopf leise" data-tun="sicherung-spaeter">Später</button></div>
    </section>`;
  }
  return html;
}

function sicherungFaellig(stand, h) {
  if (R.tageMitEintraegen(stand) < 7) return false;
  const spaeter = stand.hinweise.sicherungSpaeter;
  if (spaeter && R.abstand(spaeter, h) < 14) return false;
  return !stand.sicherung || R.abstand(stand.sicherung, h) > 30;
}

function haferHeute(stand, tag) {
  const gegessen = R.haferGegessen(stand, tag);
  const block = R.haferBlock(stand, tag);
  const fertig = gegessen.every(Boolean);
  const zeilen = R.HAFER_MAHLZEITEN.map((m) => `
    <li><button type="button" class="hafer-mahlzeit${gegessen[m.i] ? ' ja' : ''}" data-tun="hafer-mahlzeit" data-i="${m.i}" aria-pressed="${gegessen[m.i]}">
      <span class="haken" aria-hidden="true">${gegessen[m.i] ? '✓' : ''}</span>
      <span><strong>${m.n}</strong><small>75 g Haferflocken, ${m.i === 0 ? 'süß mit Wasser' : 'herzhaft mit Gemüsebrühe'}</small></span>
    </button></li>`).join('');
  return `<section class="karte hafer-heute" id="hafertag">
    <h3>🌾 Hafertag${block && block.von > 1 ? ` – Tag ${block.nr} von ${block.von}` : ''}</h3>
    <p>${fertig ? '<strong>Geschafft – alle drei Mahlzeiten.</strong> 💪' : 'Heute nur Haferbrei: drei Mahlzeiten, jede aus 75 g Haferflocken. Tipp an, was du gegessen hast.'}</p>
    <ul class="hafer-liste">${zeilen}</ul>
    <p class="klein">Rund 2 Liter trinken (Wasser, ungesüßter Tee) · mindestens 4 Stunden Abstand · nichts dazwischen. Wird dir zittrig oder schwummrig: Traubenzucker essen und die Praxis anrufen.</p>
    <button type="button" class="knopf leise" data-tun="seite" data-seite="hafer">Rezepte und Hinweise</button>
  </section>`;
}

function haferVorschau(stand, h) {
  const { art } = stand.hafer;
  if (art === 'aus') return '';
  const karte = (text, knopf, haupt = false) => `<section class="karte hafer-klein" id="hafer-vorschau"><p>🌾 ${text}</p>
    <button type="button" class="knopf${haupt ? '' : ' leise'}" data-tun="seite" data-seite="hafer">${knopf}</button></section>`;
  const naechster = R.naechsterHafertag(stand, h);
  if (naechster) {
    const n = R.abstand(h, naechster);
    const block = R.haferBlock(stand, naechster);
    const dazu = block && block.von > 1 ? ` – ${block.von} Tage am Stück` : '';
    const text = n === 1
      ? `<strong>Morgen ist Hafertag${dazu}.</strong> Haferflocken (${R.zahl(R.haferEinkauf(block ? block.von : 1).gramm)} g) und Gemüsebrühe im Haus?`
      : `${block && block.von > 1 ? 'Nächste Hafertage' : 'Nächster Hafertag'}: <strong>${esc(R.datumLang(naechster))}</strong> (in ${n} Tagen)${dazu}`;
    return karte(text, 'Hafertage');
  }
  if (art === null) {
    return karte('<strong>Hafertage:</strong> Wie oft hat dein Arzt gesagt? Eine Frage, dann planst du die Tage.', 'Hafertage einrichten', true);
  }
  if (art === 'verteilt') {
    const monat = h.slice(0, 7);
    const geplant = R.haferImMonat(stand, monat).length;
    if (geplant >= stand.hafer.proMonat) return '';
    const name = R.monatsname(Number(monat.slice(5)) - 1);
    return karte(`Hafertage im ${esc(name)}: ${geplant ? `${geplant} von ${stand.hafer.proMonat}` : 'noch keiner geplant'}.`, 'Hafertage planen', true);
  }
  if (art === 'amStueck') {
    const runde = R.naechsteRunde(stand, h);
    if (!runde) return karte(`Noch keine Hafertage geplant – ${stand.hafer.amStueck} Tage am Stück.`, 'Hafertage planen', true);
    if (R.abstand(h, runde) <= 7) return karte(`Zeit für die nächsten Hafertage – ${stand.hafer.amStueck} Tage am Stück, ab ${esc(R.datumKurz(runde))}.`, 'Hafertage planen', true);
  }
  return '';
}

/* „Wie gestern“ (v17): die Tageszeiten vom letzten Tag mit Einträgen, mit einem Tipp. */
function wieVorherHtml(stand, tag, h) {
  const v = R.wieVorher(stand, tag);
  if (!v) return '';
  const wann = R.abstand(v.quelle, tag) === 1 ? 'wie gestern' : `wie am ${R.wochentag(v.quelle)}`;
  return `<section class="wie-vorher" id="wie-vorher" aria-label="Wiederholen">
    ${v.zeiten.map((z) => `<button type="button" class="knopf leise" data-tun="wie-vorher" data-z="${z.z}" data-quelle="${v.quelle}">↻ ${esc(z.n)} ${esc(wann)} <small>${R.zahl(z.kcal)} kcal</small></button>`).join('')}
  </section>`;
}

function wieVorherEintragen(z, quelle) {
  const tag = zustand.tag || heute();
  const stand = lesen();
  const alt = (stand.tage[quelle] || []).filter((e) => (e.z || 'mittags') === z);
  if (!alt.length) return;
  const neu = R.wiederholen(alt, () => neueId('e'));
  aendern((s) => { s.tage[tag] = [...(s.tage[tag] || []), ...neu]; });
  zeige();
  const name = R.TAGESZEITEN.find((t) => t.id === z)?.n || '';
  const ids = new Set(neu.map((e) => e.id));
  meldung(`${name}: ${neu.length === 1 ? neu[0].n : `${neu.length} Sachen`} eingetragen (${R.zahl(R.summe(neu).kcal)} kcal).`, () => {
    aendern((s) => { s.tage[tag] = (s.tage[tag] || []).filter((e) => !ids.has(e.id)); });
    zeige();
  });
}

function eintragsListe(liste) {
  if (!liste.length) return '<p class="leer leise" id="leer">Noch nichts eingetragen.</p>';
  return `<section class="eintraege" id="eintraege">${R.TAGESZEITEN.map((z) => {
    const teil = liste.filter((e) => (e.z || 'mittags') === z.id);
    if (!teil.length) return '';
    return `<h3>${z.n} <span class="leise">${R.zahl(R.summe(teil).kcal)} kcal</span></h3>
      <ul>${teil.map((e) => `<li><button type="button" class="eintrag" data-tun="bearbeiten" data-id="${esc(e.id)}">
        <span class="eintrag-name">${e.m !== 1 ? `${R.menge(e.m)} × ` : ''}${esc(e.n)}<small>${esc(e.p || '')}</small></span>
        <span class="eintrag-kcal">${R.zahl(R.kcalVon(e))}</span></button></li>`).join('')}</ul>`;
  }).join('')}</section>`;
}

function wochenKarte(stand, h) {
  const tage = R.woche(stand, h);
  if (tage.filter((t) => !t.leer).length < 2) return '';
  const groesste = Math.max(stand.ziel || 0, ...tage.map((t) => t.kcal), 1);
  const schnitt = R.schnitt(stand, h);
  return `<section class="karte woche" id="woche">
    <h3>Die letzten 7 Tage</h3>
    <div class="saeulen">${tage.map((t) => `
      <div class="saeule${t.tag === h ? ' heute' : ''}" title="${esc(R.datumKurz(t.tag))}: ${R.zahl(t.kcal)} kcal">
        <span class="wert">${t.leer ? '' : R.zahl(t.kcal)}</span>
        <span class="stab${t.hafer ? ' hafer' : ''}" style="height:${Math.round((t.kcal / groesste) * 100)}%"></span>
        <span class="wtag">${t.hafer ? '🌾' : esc(R.wochentag(t.tag).slice(0, 2))}</span>
      </div>`).join('')}</div>
    ${schnitt ? `<p class="klein" id="schnitt">Im Schnitt ${R.zahl(schnitt.kcal)} kcal am Tag (${schnitt.tage} Tage mit Einträgen, ohne heute).</p>` : ''}
  </section>`;
}

// --- Hafertage -------------------------------------------------------------

function seiteHafer(stand) {
  const h = heute();
  const basis = new Date(`${h}T12:00:00`);
  const d = new Date(basis.getFullYear(), basis.getMonth() + zustand.monat, 1, 12);
  const jahr = d.getFullYear();
  const monat = d.getMonth();
  const monatKey = `${jahr}-${String(monat + 1).padStart(2, '0')}`;
  const geplant = R.haferImMonat(stand, monatKey).length;
  const kommende = stand.hafer.tage.filter((t) => t >= h);
  const einkaufTage = Math.min(kommende.length, 4);
  const einkauf = R.haferEinkauf(einkaufTage);
  const wochen = R.monatsblatt(jahr, monat).map((w) => `<tr>${w.map((t) => {
    if (!t) return '<td></td>';
    const hafer = R.istHafertag(stand, t);
    const fertig = hafer && R.haferFertig(stand, t);
    const kl = ['tag', hafer ? 'hafer' : '', fertig ? 'fertig' : '', t === h ? 'heute' : ''].filter(Boolean).join(' ');
    return `<td><button type="button" class="${kl}" data-tun="hafer-tag" data-tag="${t}" aria-pressed="${hafer}" aria-label="${esc(R.datumLang(t))}${hafer ? ', Hafertag' : ''}">${Number(t.slice(8))}${fertig ? '<small>✓</small>' : ''}</button></td>`;
  }).join('')}</tr>`).join('');

  return `
  <h2 class="seitentitel">Hafertage 🌾</h2>
  <section class="karte">
    <p>An einem Hafertag isst du nur Haferbrei – dreimal, je 75 g Haferflocken. Bei vielen sinkt danach der Blutzucker, und der Körper nutzt sein Insulin wieder besser, oft über Wochen.</p>
  </section>
  <section class="karte achtung" id="hafer-achtung">
    <h3>Vorher mit dem Arzt</h3>
    <p>Spritzt du Insulin oder nimmst du Tabletten gegen Zucker? Dann besprich vor dem ersten Hafertag mit deinem Arzt, ob du daran etwas änderst – an Hafertagen kann der Zucker sonst zu tief fallen. Mit Insulin an Hafertagen oft messen; das Infoblatt der Diabetes-Hilfe nennt mindestens 7-mal am Tag.</p>
    <p>Wird dir zittrig oder schwummrig, oder du schwitzt kalt: Traubenzucker essen und die Praxis anrufen.</p>
  </section>
  <section class="karte" id="hafer-plan">
    <h3>Planen</h3>
    ${haferPlanKopf(stand)}
    <h4>Welche Tage?</h4>
    <p class="klein">${stand.hafer.art === 'amStueck'
    ? `Tipp auf den ersten Tag – die App trägt ${stand.hafer.amStueck} Tage am Stück ein. Ein Tipp auf einen davon nimmt alle ${stand.hafer.amStueck} wieder heraus.`
    : 'Tipp auf einen Tag, um ihn als Hafertag einzutragen – noch einmal tippen nimmt ihn wieder heraus.'}</p>
    <div class="monat-kopf">
      <button type="button" class="rund" data-tun="monat" data-schritt="-1" aria-label="Monat davor" ${zustand.monat <= -6 ? 'disabled' : ''}>‹</button>
      <strong id="monat-name">${esc(R.monatsname(monat))} ${jahr}</strong>
      <button type="button" class="rund" data-tun="monat" data-schritt="1" aria-label="Monat danach" ${zustand.monat >= 12 ? 'disabled' : ''}>›</button>
    </div>
    <table class="monat"><thead><tr>${['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((w) => `<th>${w}</th>`).join('')}</tr></thead><tbody>${wochen}</tbody></table>
    <p id="hafer-zahl">${esc(R.monatsname(monat))}: ${stand.hafer.art === 'verteilt'
    ? `${geplant} von ${stand.hafer.proMonat} geplant`
    : `${geplant} ${geplant === 1 ? 'Hafertag' : 'Hafertage'} geplant`}.</p>
    ${stand.hafer.art === 'amStueck' && !kommende.length && R.naechsteRunde(stand, h)
    ? `<p class="klein" id="hafer-runde">Nächste Runde: ab ${esc(R.datumLang(R.naechsteRunde(stand, h)))}.</p>` : ''}
    ${kommende.length ? `
      <button type="button" class="knopf" data-tun="ics" id="ics-knopf">📅 In den Kalender – mit Erinnerung am Abend davor</button>
      <h4>${einkaufTage === 1 ? 'Einkaufen für den nächsten Hafertag' : `Einkaufen für die nächsten ${einkaufTage} Hafertage`}</h4>
      <ul class="einkauf" id="einkauf">
        <li>${R.zahl(einkauf.gramm)} g Haferflocken (zart oder kernig) – ${einkauf.packungen} Packung${einkauf.packungen > 1 ? 'en' : ''} à 500 g</li>
        <li>${einkauf.bruehe} Liter Gemüsebrühe, möglichst fettfrei (oder Brühpulver)</li>
        <li>Etwas Gemüse: Lauch, Brokkoli, Kirschtomaten</li>
        <li>Beeren (frisch oder TK ohne Zucker), eine Kiwi, eine Zitrone</li>
        <li>Kräuter, Zimt, nach Wunsch Süßstoff</li>
      </ul>` : ''}
  </section>
  <section class="karte">
    <h3>So geht ein Hafertag</h3>
    <ul class="punkte">
      <li><strong>Drei Mahlzeiten:</strong> je 75 g Haferflocken in rund 500 ml Wasser (süß) oder Gemüsebrühe (herzhaft) aufkochen und quellen lassen.</li>
      <li><strong>Dazu nur wenig:</strong> eine Handvoll Gemüse (50 g) oder ein paar Beeren (25 g). Würzen mit Kräutern, Zimt, Zitronensaft – nicht salzen, die Brühe reicht.</li>
      <li><strong>Mindestens 4 Stunden</strong> zwischen den Mahlzeiten, nichts dazwischen.</li>
      <li><strong>Rund 2 Liter trinken:</strong> Wasser oder ungesüßter Tee.</li>
      <li><strong>Bewegung</strong> tut gut: spazieren gehen, Rad fahren.</li>
      <li><strong>Danach</strong> langsam wieder normal essen – nicht gleich das große Festessen.</li>
    </ul>
    <p class="klein leise">Zusammen etwa 830 kcal und 130 g Kohlenhydrate am Tag.</p>
  </section>
  <section class="karte" id="hafer-rezepte">
    <h3>Rezepte</h3>
    <h4>Süß – morgens</h4>
    <ul class="punkte">
      <li>500 ml Wasser aufkochen, 75 g Haferflocken einrühren, quellen lassen. Mit 25 g Beeren.</li>
      <li>Das Wasser mit etwas Zimt aufkochen, 10 g gehobelte Mandeln unterrühren.</li>
      <li>Mit 25 g Kiwi, klein geschnitten. Nach Wunsch etwas Zitronensaft.</li>
    </ul>
    <h4>Herzhaft – mittags und abends</h4>
    <ul class="punkte">
      <li>500 ml Gemüsebrühe aufkochen, 75 g Haferflocken einrühren, quellen lassen. 50 g Lauch klein schneiden und dazu – roh oder ohne Fett kurz angedünstet. Kräuter nach Belieben.</li>
      <li>Mit 50 g Brokkoli, 4–6 Minuten in der Brühe gegart.</li>
      <li>Mit 50 g geviertelten Kirschtomaten und Kräutern.</li>
    </ul>
    <p class="klein leise">Abends geht süß oder herzhaft. Süßstoff so wenig wie möglich.</p>
  </section>
  <p class="quelle klein leise">Nach dem Infoblatt „Intensive Hafertage“ der Deutschen Diabetes-Hilfe (diabetesDE, 2017). Ersetzt nicht das Gespräch mit dem Arzt.</p>`;
}

/*
 * Tobi: „Er soll drei mal im Monat nur Hafer essen oder so" – ob verteilt
 * oder am Stück, weiß nur der Kollege (bzw. sein Arzt). Deshalb fragt die
 * App ihn selbst, aber erst hier, wo es um Hafertage geht, nicht beim Start.
 */
function haferPlanKopf(stand) {
  const { art, proMonat, amStueck, alleMonate } = stand.hafer;
  const anders = '<button type="button" class="link" data-tun="hafer-art" data-art="">ändern</button>';
  if (art === null) {
    const antwort = (wert, titel, text) => `<button type="button" class="antwort" data-tun="hafer-art" data-art="${wert}"><strong>${titel}</strong><small>${text}</small></button>`;
    return `<div class="frage" id="hafer-frage">
      <h4>Was hat dein Arzt gesagt?</h4>
      ${antwort('verteilt', 'Ein paar Tage im Monat', 'einzelne Hafertage, über den Monat verteilt')}
      ${antwort('amStueck', 'Mehrere Tage am Stück', '2 oder 3 Tage hintereinander, dann eine Weile nicht')}
      ${antwort('unklar', 'Weiß ich nicht genau', 'dann steht hier, was du beim nächsten Termin fragen kannst')}
      ${antwort('aus', 'Ich mache keine Hafertage', 'die App erinnert dann nicht daran')}
      <p class="klein leise">Beide Wege beschreibt die Diabetes-Hilfe. Was für dich gilt, sagt dein Arzt.</p>
    </div>`;
  }
  if (art === 'verteilt') {
    return `<p id="hafer-art"><strong>Dein Plan:</strong> ${proMonat} Hafertag${proMonat > 1 ? 'e' : ''} im Monat, verteilt. ${anders}</p>
      <h4>Wie viele im Monat?</h4>
      <div class="chips" role="group" aria-label="Hafertage im Monat">
        ${[1, 2, 3, 4].map((n) => `<button type="button" class="chip" data-tun="hafer-oft" data-n="${n}" aria-pressed="${proMonat === n}">${n}×</button>`).join('')}
      </div>`;
  }
  if (art === 'amStueck') {
    const alle = (m) => (m === 1 ? 'jeden Monat' : `alle ${m} Monate`);
    return `<p id="hafer-art"><strong>Dein Plan:</strong> ${amStueck} Tage am Stück, ${alle(alleMonate)}. ${anders}</p>
      <h4>Wie viele Tage am Stück?</h4>
      <div class="chips" role="group" aria-label="Tage am Stück">
        ${[2, 3].map((n) => `<button type="button" class="chip" data-tun="hafer-stueck" data-n="${n}" aria-pressed="${amStueck === n}">${n} Tage</button>`).join('')}
      </div>
      <h4>Wie oft?</h4>
      <div class="chips" role="group" aria-label="Wie oft">
        ${[1, 2, 3, 4].map((m) => `<button type="button" class="chip" data-tun="hafer-alle" data-n="${m}" aria-pressed="${alleMonate === m}">${alle(m)}</button>`).join('')}
      </div>`;
  }
  if (art === 'unklar') {
    return `<div class="frage" id="hafer-frage">
      <p><strong>Noch offen.</strong> Frag beim nächsten Arzttermin:</p>
      <ul class="punkte" id="arzt-fragen">
        <li>Hafertage einzeln über den Monat verteilt oder mehrere am Stück – und wie oft?</li>
        <li>Muss ich an Hafertagen etwas an meinen Tabletten oder am Insulin ändern?</li>
        <li>Wie viele Kalorien am Tag sind für mich gut?</li>
      </ul>
      <button type="button" class="knopf" data-tun="hafer-art" data-art="">Jetzt beantworten</button>
    </div>`;
  }
  return `<p id="hafer-art"><strong>Keine Hafertage.</strong> Die Startseite erinnert nicht daran. <button type="button" class="link" data-tun="hafer-art" data-art="">doch einrichten</button></p>`;
}

// --- Werte -----------------------------------------------------------------

function seiteWerte(stand) {
  const h = heute();
  const gewicht = R.werteVon(stand, 'gewicht');
  const zucker = R.werteVon(stand, 'zucker');
  const hba1c = R.werteVon(stand, 'hba1c');
  const schlaf = R.werteVon(stand, 'schlaf');
  const schritte = R.werteVon(stand, 'schritte');
  const schlafSchnitt = R.werteSchnitt(stand, 'schlaf');
  const schritteSchnitt = R.werteSchnitt(stand, 'schritte');
  const verlauf = R.gewichtVerlauf(stand);
  const wann = zustand.zuckerWann || (new Date().getHours() < 10 ? 'nuechtern' : 'sonst');
  const komma = (n) => String(n).replace('.', ',');
  const liste = (werte, fn) => (werte.length ? `<ul class="werteliste">${werte.slice(-6).reverse().map((w) => `
    <li><span>${esc(R.datumKurz(w.tag))}${w.uhr ? ` · ${esc(w.uhr)}` : ''}</span><span class="wert">${fn(w)}</span>
    <button type="button" class="weg" data-tun="wert-weg" data-id="${esc(w.id)}" aria-label="Eintrag vom ${esc(R.datumKurz(w.tag))} löschen">✕</button></li>`).join('')}</ul>` : '');

  return `
  <h2 class="seitentitel">Werte</h2>
  <section class="karte" id="karte-gewicht">
    <h3>⚖️ Gewicht</h3>
    <form class="werteform" data-form="gewicht">
      <label class="feld"><span class="unsichtbar">Gewicht in kg</span><input id="w-gewicht" inputmode="decimal" autocomplete="off" placeholder="z. B. 98,4"><span class="einheit">kg</span></label>
      <button type="submit" class="knopf haupt">Eintragen</button>
    </form>
    ${gewicht.length >= 2 ? linie(gewicht) : ''}
    ${verlauf ? `<p id="gewicht-diff">Seit ${esc(R.datumKurz(verlauf.erster.tag))}: <strong>${verlauf.diff > 0 ? '+' : verlauf.diff < 0 ? '−' : '±'}${komma(Math.abs(verlauf.diff))} kg</strong></p>` : ''}
    ${liste(gewicht, (w) => `${komma(w.wert)} kg`)}
    <p class="klein leise">Am besten einmal die Woche, morgens vor dem Frühstück. Ein Wert je Tag – ein zweiter ersetzt den ersten.</p>
  </section>
  <section class="karte" id="karte-zucker">
    <h3>🩸 Blutzucker</h3>
    <p class="klein">Wenn du misst – in mg/dl, wie auf dem Messgerät.</p>
    <div class="chips" role="group" aria-label="Wann gemessen">${R.ZUCKER_WANN.map((z) => `<button type="button" class="chip" data-tun="zucker-wann" data-wann="${z.id}" aria-pressed="${wann === z.id}">${z.n}</button>`).join('')}</div>
    <form class="werteform" data-form="zucker">
      <label class="feld"><span class="unsichtbar">Blutzucker in mg/dl</span><input id="w-zucker" inputmode="decimal" autocomplete="off" placeholder="z. B. 120"><span class="einheit">mg/dl</span></label>
      <button type="submit" class="knopf haupt">Eintragen</button>
    </form>
    ${liste(zucker, (w) => `${R.zahl(w.wert)} mg/dl <small>${esc(R.ZUCKER_WANN.find((z) => z.id === w.wann)?.n || '')}${R.istHafertag(stand, w.tag) ? ' · 🌾' : ''}</small>`)}
    <p class="klein leise">Was die Werte für dich heißen, sagt dein Arzt. Unterzucker merkt man an Zittern, Schwitzen, Heißhunger oder Schwindel – dann Traubenzucker.</p>
  </section>
  <section class="karte" id="karte-schlaf">
    <h3>😴 Schlaf</h3>
    <p class="klein">Was deine Uhr für letzte Nacht anzeigt – in ihrer App oder in Apple Health unter „Schlaf“.</p>
    <form class="werteform" data-form="schlaf">
      <label class="feld"><span class="unsichtbar">Schlaf in Stunden</span><input id="w-schlaf" inputmode="decimal" autocomplete="off" placeholder="z. B. 7:30"><span class="einheit">Std</span></label>
      <button type="submit" class="knopf haupt">Eintragen</button>
    </form>
    ${schlafSchnitt ? `<p id="schlaf-schnitt">Schnitt der letzten ${schlafSchnitt.anzahl} Nächte: <strong>${R.dauerText(schlafSchnitt.wert)}</strong></p>` : ''}
    ${liste(schlaf, (w) => `${R.dauerText(w.wert)}${w.quelle === 'uhr' ? ' <small title="von der Uhr">⌚</small>' : ''}`)}
    <p class="klein leise">${stand.uhr ? 'Kommt von der Uhr (⌚). Was du selbst einträgst, bleibt stehen.' : 'Morgens eintragen, ein Wert je Nacht – ein zweiter ersetzt den ersten.'}</p>
  </section>
  <section class="karte" id="karte-schritte">
    <h3>👟 Schritte</h3>
    <form class="werteform" data-form="schritte">
      <label class="feld"><span class="unsichtbar">Schritte heute</span><input id="w-schritte" inputmode="numeric" autocomplete="off" placeholder="z. B. 6.500"><span class="einheit">Schritte</span></label>
      <button type="submit" class="knopf haupt">Eintragen</button>
    </form>
    ${schritteSchnitt ? `<p id="schritte-schnitt">Schnitt der letzten ${schritteSchnitt.anzahl} Tage: <strong>${R.zahl(schritteSchnitt.wert)}</strong></p>` : ''}
    ${liste(schritte, (w) => `${R.zahl(w.wert)}${w.quelle === 'uhr' ? ' <small title="von der Uhr">⌚</small>' : ''}`)}
    <p class="klein leise">${stand.uhr ? 'Kommt von der Uhr (⌚), zweimal am Tag.' : 'Abends, was die Uhr für heute zählt. Ein Wert je Tag – ein späterer ersetzt den früheren.'}</p>
  </section>
  <section class="karte" id="karte-hba1c">
    <h3>🧪 Langzeitwert (HbA1c)</h3>
    <p class="klein">Steht im Befund vom Arzt, meist alle drei Monate.</p>
    <form class="werteform" data-form="hba1c">
      <label class="feld"><span class="unsichtbar">HbA1c in Prozent</span><input id="w-hba1c" inputmode="decimal" autocomplete="off" placeholder="z. B. 7,2"><span class="einheit">%</span></label>
      <label class="feld klein-feld"><span class="unsichtbar">Datum</span><input id="w-hba1c-tag" type="date" value="${h}" max="${h}"></label>
      <button type="submit" class="knopf haupt">Eintragen</button>
    </form>
    ${liste(hba1c, (w) => `${komma(w.wert)} %`)}
  </section>`;
}

/** Ein schlichter Verlauf als Linie – ohne Bibliothek. */
function linie(werte) {
  const letzte = werte.slice(-30);
  const zahlen = letzte.map((w) => w.wert);
  let min = Math.min(...zahlen);
  let max = Math.max(...zahlen);
  if (max - min < 2) { min -= 1; max += 1; }
  const b = 300;
  const hoch = 80;
  const x = (i) => (letzte.length === 1 ? b / 2 : 8 + (i * (b - 16)) / (letzte.length - 1));
  const y = (v) => 8 + ((max - v) * (hoch - 16)) / (max - min);
  const punkte = letzte.map((w, i) => `${x(i).toFixed(1)},${y(w.wert).toFixed(1)}`).join(' ');
  return `<svg class="linie" viewBox="0 0 ${b} ${hoch}" role="img" aria-label="Gewichtsverlauf">
    <polyline points="${punkte}" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>
    ${letzte.map((w, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(w.wert).toFixed(1)}" r="3.5" fill="currentColor"/>`).join('')}
  </svg>`;
}

// --- Mehr ------------------------------------------------------------------

function seiteMehr(stand) {
  const h = heute();
  const schnitt = R.schnitt(stand, h);
  const ziele = [null, 1800, 2000, 2200, 2500];
  const eigenesZiel = stand.ziel && !ziele.includes(stand.ziel);
  return `
  <h2 class="seitentitel">Mehr</h2>
  <section class="karte" id="karte-ziel">
    <h3>🎯 Tagesziel</h3>
    <p>Wie viele kcal am Tag? Musst du nicht festlegen – ohne Ziel zählt die App einfach mit.</p>
    <div class="chips" role="group" aria-label="Tagesziel">
      ${ziele.map((z) => `<button type="button" class="chip" data-tun="ziel" data-ziel="${z || ''}" aria-pressed="${stand.ziel === z}">${z ? R.zahl(z) : 'kein Ziel'}</button>`).join('')}
      <button type="button" class="chip" data-tun="ziel-eigen" aria-pressed="${!!eigenesZiel}">${eigenesZiel ? `${R.zahl(stand.ziel)} ✎` : 'eigene Zahl'}</button>
    </div>
    <p class="klein leise">Hat dein Arzt eine Zahl genannt, nimm die. Sonst sind 1.800 bis 2.200 kcal für die meisten Männer, die abnehmen wollen, ein guter Anfang.${schnitt ? ` Du isst im Schnitt ${R.zahl(schnitt.kcal)} kcal am Tag.` : ''}</p>
    <p class="klein" id="eiweiss-hinweis"><strong>Eiweiß:</strong> Die App zählt es mit (auf „Heute“ unter den Kalorien). Viel Eiweiß, wie es Pläne zum Muskelaufbau oft vorsehen, bitte vorher mit dem Arzt besprechen – bei Blutzuckerproblemen sollten die Nieren einmal angeschaut sein.</p>
  </section>
  <section class="karte" id="karte-eigene">
    <h3>⭐ Meine eigenen Sachen</h3>
    ${stand.eigene.length ? `<ul class="werteliste">${stand.eigene.map((e) => `<li><span>${esc(e.n)}${e.p ? ` <small>${esc(e.p)}</small>` : ''}</span><span class="wert">${R.zahl(e.kcal)} kcal</span>
      <button type="button" class="weg" data-tun="eigen-weg" data-id="${esc(e.id)}" aria-label="${esc(e.n)} vergessen">✕</button></li>`).join('')}</ul>`
    : '<p class="klein leise">Noch keine. Unter „Essen eintragen“ → „Selbst eintragen“ merkt sich die App, was du dort einträgst.</p>'}
  </section>
  ${K.kiAn() ? `<section class="karte" id="karte-ki">
    <h3>✨ KI und Strichcode</h3>
    ${K.kiCode()
    ? `<p id="ki-status">Freigeschaltet (Code ${esc(K.kiCode().slice(0, 5))}-•••••). Rezepte, Kochbuchseiten und Nährwerttabellen rechnet die KI aus – unter „Essen eintragen“ → „Rezept oder Foto“.</p>
      <button type="button" class="knopf leise" data-tun="ki-code-weg">Code entfernen</button>`
    : freischaltenHtml()}
    <p class="klein leise">Was dabei das Handy verlässt: beim Strichcode nur die Nummer – an Open Food Facts, eine freie Datenbank für Lebensmittel. Beim Rezept der Text bzw. die Fotos, bei „Im Internet nachsehen“ das Suchwort – an die KI Gemini von Google (und die Suche Tavily), über Tobis Zugang. Google darf solche Anfragen zum Verbessern nutzen; etwas über dich geht nicht mit. Sonst nichts.</p>
  </section>` : ''}
  <section class="karte" id="karte-uhr">
    <h3>⌚ Uhr: Schlaf und Schritte</h3>
    ${uhrStatusHtml(stand)}
  </section>
  <section class="karte" id="karte-lebenszeichen">
    <h3>📶 Lebenszeichen an Tobi</h3>
    <p>Damit Tobi weiß, ob dir die App etwas bringt, meldet sie höchstens alle drei Stunden, wie viele Einträge, Hafer-Mahlzeiten und Sporteinheiten du hast. Dazu gehen deine <strong>Werte</strong> an Tobi – Gewicht, Blutzucker, HbA1c, Schlaf und Schritte mit Datum, die letzten 60 Tage. ${stand.essenTeilen === true && stand.meldung !== false ? 'Und, weil du es erlaubt hast, <strong>was du isst</strong> – was, wie viel, die Kalorien, die letzten 60 Tage.' : 'Was du isst, geht nicht mit.'}</p>
    <div class="chips" role="group" aria-label="Lebenszeichen">
      <button type="button" class="chip" data-tun="meldung" data-an="1" aria-pressed="${stand.meldung !== false}">an</button>
      <button type="button" class="chip" data-tun="meldung" data-an="" aria-pressed="${stand.meldung === false}">aus</button>
    </div>
    ${stand.meldung !== false ? `<p class="klein">Was du isst, an Tobi:</p>
    <div class="chips" role="group" aria-label="Essen an Tobi">
      <button type="button" class="chip" data-tun="essen-teilen" data-an="1" aria-pressed="${stand.essenTeilen === true}">ja</button>
      <button type="button" class="chip" data-tun="essen-teilen" data-an="" aria-pressed="${stand.essenTeilen !== true}">nein</button>
    </div>` : ''}
  </section>
  <section class="karte" id="karte-protokoll">
    <h3>📋 Ernährungsprotokoll</h3>
    <p>Für die Ernährungsberatung: alles, was du eingetragen hast, Tag für Tag – zum Teilen, Drucken oder als PDF. Nichts doppelt aufschreiben.</p>
    <button type="button" class="knopf" data-tun="protokoll">Protokoll ansehen</button>
  </section>
  <section class="karte" id="karte-sicherung">
    <h3>💾 Sicherung</h3>
    <p>Alles liegt nur auf diesem Handy. Mit einer Sicherung kommst du auf einem neuen Handy wieder dran.</p>
    <div class="reihe">
      <button type="button" class="knopf" data-tun="sichern" id="sichern">Sicherung speichern</button>
      <label class="knopf leise">Sicherung einlesen<input type="file" id="einlesen" accept=".json,application/json" class="unsichtbar"></label>
    </div>
    <p class="klein leise" id="sicherung-stand">${stand.sicherung ? `Zuletzt gesichert: ${esc(R.datumLang(stand.sicherung))}.` : 'Noch nie gesichert.'}</p>
  </section>
  <section class="karte" id="karte-installieren">
    <h3>📲 Auf den Startbildschirm</h3>
    ${installierenHtml()}
  </section>
  <section class="karte" id="karte-ueber">
    <h3>ℹ️ Über die App</h3>
    <p>Mahlzeit fragt nichts: kein Konto, keine Werbung. Deine Einträge bleiben auf deinem Handy. Hinaus geht nur das Lebenszeichen an Tobi mit deinen Werten${stand.essenTeilen === true && stand.meldung !== false ? ' und deinem Essen' : ''} (abschaltbar, siehe oben) ${stand.uhr ? 'Schlaf und Schritte von der Uhr (die liegen dann auch bei Tobi) ' : ''}und, wenn du einen Strichcode nachschlägst, ${K.kiAn() ? 'oder die KI fragst, genau das (siehe „KI und Strichcode“)' : 'die Nummer – an Open Food Facts, eine freie Datenbank für Lebensmittel'}.</p>
    <p>Die Kalorien sind Richtwerte für übliche Portionen – ein Döner vom Imbiss nebenan kann 100 kcal mehr oder weniger haben. Für den Überblick reicht das; genauer wird es mit der Packung in der Hand („Selbst eintragen“).</p>
    <p>Die App ersetzt keine ärztliche Beratung. Was die Hafertage angeht, steht die Quelle unter „Hafer“.</p>
    <p class="klein leise">Fassung ${FASSUNG}</p>
  </section>
  <section class="karte">
    <button type="button" class="knopf gefahr" data-tun="alles-loeschen">Alles löschen</button>
  </section>`;
}

// --- Ebene: Essen eintragen ------------------------------------------------

function oeffneEssen() {
  const tag = zustand.tag || heute();
  const z = tag === heute() ? R.tageszeitZu(new Date().getHours()) : 'mittags';
  oeffneEbene({ art: 'suche', tag, z, q: '', bereich: null, zuletzt: null });
}

function oeffneEbene(neu) {
  const warZu = !ebene;
  ebene = neu;
  if (warZu) history.pushState({ mahlzeitEbene: true }, '');
  document.body.classList.add('ebene-offen');
  zeigeEbene();
}

function schliesseEbene({ ausVerlauf = false } = {}) {
  if (!ebene) return;
  uhrAus();
  wachBleibenAus();
  ebene = null;
  const el = $('#ebene');
  el.hidden = true;
  el.innerHTML = '';
  document.body.classList.remove('ebene-offen');
  kameraAus();
  if (!ausVerlauf && history.state?.mahlzeitEbene) history.back();
  zeige();
  if (neuLaden) location.reload();
}

function zeigeEbene() {
  const el = $('#ebene');
  el.hidden = false;
  kameraAus();
  const stand = lesen();
  if (ebene.art === 'suche') {
    el.innerHTML = `
      <div class="ebene-kopf">
        <button type="button" class="rund" data-tun="ebene-zu" aria-label="Schließen">✕</button>
        <h2>Was hast du gegessen?</h2>
      </div>
      <div class="ebene-inhalt">
        ${ebene.zuletzt ? `<div class="eingetragen" id="eingetragen"><span>✓ ${esc(ebene.zuletzt)}</span><button type="button" class="knopf haupt" data-tun="ebene-zu">Fertig</button></div>` : ''}
        <label class="suchfeld"><span class="unsichtbar">Suchen</span>
          <input type="search" id="suche" value="${esc(ebene.q)}" placeholder="z. B. Brötchen, Döner, Cola" autocomplete="off" autocapitalize="off" enterkeyhint="search">
        </label>
        <div class="werkzeuge">
          <button type="button" class="knopf leise" data-tun="scan" id="scan-knopf">${SYMBOL.strich} Strichcode</button>
          ${K.kiAn() ? '<button type="button" class="knopf leise" data-tun="rezept" id="rezept-knopf">✨ Rezept oder Foto</button>' : '<button type="button" class="knopf leise" data-tun="eigen" id="eigen-knopf">✎ Selbst eintragen</button>'}
        </div>
        <div id="treffer">${trefferHtml(stand)}</div>
      </div>`;
    const feld = $('#suche');
    if (!ebene.zuletzt && !ebene.bereich) feld.focus({ preventScroll: true });
  } else if (ebene.art === 'scan') {
    el.innerHTML = scanHtml();
    if (S.kannLive() && !ebene.nichtGefunden) kameraAn();
  } else if (ebene.art === 'rezept') {
    el.innerHTML = rezeptHtml();
  } else if (ebene.art === 'protokoll') {
    el.innerHTML = protokollHtml(stand);
  } else if (ebene.art === 'uhr') {
    el.innerHTML = uhrHtml(stand);
  } else if (ebene.art === 'training') {
    el.innerHTML = trainingHtml();
  } else if (ebene.art === 'ki-ergebnis') {
    el.innerHTML = ergebnisHtml();
  } else if (ebene.art === 'sache') {
    el.innerHTML = sacheHtml(stand);
  } else if (ebene.art === 'eigen') {
    el.innerHTML = eigenHtml();
    $('#eigen-name').focus({ preventScroll: true });
  } else if (ebene.art === 'bearbeiten') {
    el.innerHTML = bearbeitenHtml(stand);
  }
}

function sacheZeile(l) {
  return `<li><button type="button" class="sache" data-tun="sache" data-id="${esc(l.id)}">
    <span class="sache-name">${esc(l.n)}${l.k === 'eigen' ? ' <span class="abzeichen">eigenes</span>' : ''}<small>${esc(l.p || '')}</small></span>
    <span class="sache-kcal">${R.zahl(l.kcal)}<small>kcal</small></span></button></li>`;
}

function trefferHtml(stand) {
  const alle = alleSachen(stand);
  const netz = ebene.q.trim().length >= 2 && K.sucheAn()
    ? `<button type="button" class="knopf breit" data-tun="netz-suche" id="netz-knopf">🔎 Im Internet nachsehen: „${esc(ebene.q.trim())}“</button>`
    : '';
  const selbst = `${netz}<button type="button" class="knopf leise breit" data-tun="eigen">✎ Nicht dabei? Selbst eintragen</button>`;
  if (ebene.q.trim()) {
    const treffer = R.suche(ebene.q, alle, R.haeufigkeit(stand));
    if (!treffer.length) {
      return `<p class="leise" id="nichts">Nichts gefunden für „${esc(ebene.q)}“. Versuch ein anderes Wort – oder trag es selbst ein.</p>${selbst}`;
    }
    return `<ul class="sachen" id="trefferliste">${treffer.map(sacheZeile).join('')}</ul>${selbst}`;
  }
  if (ebene.bereich) {
    const b = BEREICHE.find((x) => x.id === ebene.bereich);
    const teil = ebene.bereich === 'eigen' ? alle.filter((l) => l.k === 'eigen') : LEBENSMITTEL.filter((l) => l.k === ebene.bereich);
    return `<div class="bereich-kopf"><button type="button" class="knopf leise" data-tun="bereich" data-bereich="">‹ Alle Bereiche</button><h3>${b ? `${b.z} ${esc(b.n)}` : '⭐ Eigene'}</h3></div>
      <ul class="sachen" id="trefferliste">${teil.map(sacheZeile).join('')}</ul>${selbst}`;
  }
  const oft = R.haeufigste(stand, (id) => sucheSache(stand, id), 8);
  const bereiche = [...BEREICHE.map((b) => ({ ...b })), ...(stand.eigene.length ? [{ id: 'eigen', n: 'Eigene', z: '⭐' }] : [])];
  return `
    ${oft.length ? `<h3>Oft bei dir</h3><ul class="sachen" id="oft">${oft.map(sacheZeile).join('')}</ul>` : ''}
    <h3>Bereiche</h3>
    <div class="bereiche">${bereiche.map((b) => `<button type="button" class="bereich" data-tun="bereich" data-bereich="${b.id}"><span aria-hidden="true">${b.z}</span>${esc(b.n)}</button>`).join('')}</div>
    ${oft.length < 4 ? `<h3>Beliebt</h3><ul class="sachen" id="beliebt">${BELIEBT.map((id) => NACH_ID.get(id)).filter(Boolean).map(sacheZeile).join('')}</ul>` : ''}
    ${selbst}`;
}

function mengenChips(m) {
  return `<div class="chips" role="group" aria-label="Wie viel">${R.MENGEN.map((x) => `<button type="button" class="chip" data-tun="menge" data-m="${x}" aria-pressed="${m === x}">${R.menge(x)}</button>`).join('')}</div>`;
}

function zeitChips(z) {
  return `<div class="chips" role="group" aria-label="Wann">${R.TAGESZEITEN.map((t) => `<button type="button" class="chip" data-tun="zeit" data-z="${t.id}" aria-pressed="${z === t.id}">${t.n}</button>`).join('')}</div>`;
}

function sacheHtml(stand) {
  const l = sucheSache(stand, ebene.id);
  if (!l) return '';
  const e = { kcal: l.kcal, kh: l.kh, ei: l.ei, m: ebene.m };
  const hat100 = Number.isFinite(l.kcal100) && l.kcal100 !== null;
  const g = R.leseZahl(ebene.gramm || '');
  const inGramm = hat100 && Number.isFinite(g) && g > 0 && g <= 5000;
  const werte = inGramm ? R.fuerGramm(l, g) : { kcal: R.kcalVon(e), kh: R.khVon(e), ei: R.eiVon(e) };
  const herkunft = { off: 'aus Open Food Facts', ki: 'von der KI ausgerechnet' }[l.quelle] || '';
  return `
    <div class="ebene-kopf">
      <button type="button" class="rund" data-tun="zurueck-suche" aria-label="Zurück">‹</button>
      <h2>${esc(l.n)}</h2>
    </div>
    <div class="ebene-inhalt">
      <p class="leise">${esc(l.p || '')}${ebene.m !== 1 && !inGramm ? ` · ${R.menge(ebene.m)} ×` : ''}</p>
      <p class="gross"><span id="sache-kcal">${R.zahl(werte.kcal)}</span> <span class="einheit">kcal</span></p>
      ${l.kh || l.ei ? `<p class="leise klein" id="sache-kh">${naehrText(werte)}</p>` : ''}
      ${hat100 ? `<p class="klein leise" id="sache-100">${R.zahl(l.kcal100)} kcal je 100 g${herkunft ? ` · ${herkunft}` : ''}</p>` : ''}
      ${l.t ? `<p class="tipp" id="tipp">💡 ${esc(l.t)}</p>` : ''}
      <h3>Wie viel?</h3>
      ${mengenChips(inGramm ? null : ebene.m)}
      ${hat100 ? `<label class="feld gramm-feld"><span>oder genau</span><input id="gramm" inputmode="decimal" autocomplete="off" placeholder="Gramm" value="${esc(ebene.gramm || '')}"><span class="einheit">g</span></label>` : ''}
      ${l.zutaten?.length ? `<details class="rechnung"><summary>So hat die KI gerechnet</summary><ul class="punkte">${l.zutaten.map((z) => `<li>${esc(z.menge)} ${esc(z.name)} – ${R.zahl(z.kcal)} kcal</li>`).join('')}</ul>${l.hinweis ? `<p class="klein leise">${esc(l.hinweis)}</p>` : ''}</details>` : ''}
      <h3>Wann?</h3>
      ${zeitChips(ebene.z)}
      <button type="button" class="knopf haupt gross-knopf" data-tun="eintragen" id="eintragen">Eintragen</button>
    </div>`;
}

function eigenHtml() {
  return `
    <div class="ebene-kopf">
      <button type="button" class="rund" data-tun="zurueck-suche" aria-label="Zurück">‹</button>
      <h2>Selbst eintragen</h2>
    </div>
    <form class="ebene-inhalt formular" data-form="eigen">
      <label>Was?<input id="eigen-name" autocomplete="off" maxlength="60" placeholder="z. B. Kantine: Gulasch mit Reis" value="${esc(ebene.q || '')}"></label>
      <label>Kalorien<span class="mit-einheit"><input id="eigen-kcal" inputmode="numeric" autocomplete="off" placeholder="z. B. 650"><span class="einheit">kcal</span></span></label>
      <details class="umrechnen">
        <summary>Auf der Packung steht nur „pro 100 g“?</summary>
        <label>kcal pro 100 g<input id="eigen-100" inputmode="decimal" autocomplete="off"></label>
        <label>Wie viel Gramm hast du gegessen?<input id="eigen-g" inputmode="decimal" autocomplete="off"></label>
        <p class="klein leise" id="eigen-rechnung"></p>
      </details>
      <label>Kohlenhydrate (wenn bekannt)<span class="mit-einheit"><input id="eigen-kh" inputmode="decimal" autocomplete="off"><span class="einheit">g</span></span></label>
      <label>Eiweiß (wenn bekannt)<span class="mit-einheit"><input id="eigen-ei" inputmode="decimal" autocomplete="off"><span class="einheit">g</span></span></label>
      <label class="haken-zeile"><input type="checkbox" id="eigen-merken" checked> Für später merken</label>
      <h3>Wann?</h3>
      ${zeitChips(ebene.z)}
      <p class="fehler" id="eigen-fehler" role="alert"></p>
      <button type="submit" class="knopf haupt gross-knopf">Eintragen</button>
    </form>`;
}

function bearbeitenHtml(stand) {
  const e = (stand.tage[ebene.tag] || []).find((x) => x.id === ebene.id);
  if (!e) return '';
  const probe = { ...e, m: ebene.m };
  return `
    <div class="ebene-kopf">
      <button type="button" class="rund" data-tun="ebene-zu" aria-label="Schließen">✕</button>
      <h2>${esc(e.n)}</h2>
    </div>
    <div class="ebene-inhalt">
      <p class="leise">${esc(e.p || '')} · ${esc(R.tagName(ebene.tag, heute()))}</p>
      <p class="gross"><span id="sache-kcal">${R.zahl(R.kcalVon(probe))}</span> <span class="einheit">kcal</span></p>
      <h3>Wie viel?</h3>
      ${mengenChips(ebene.m)}
      <h3>Wann?</h3>
      ${zeitChips(ebene.z)}
      <div class="reihe">
        <button type="button" class="knopf haupt" data-tun="speichern" id="speichern">Speichern</button>
        <button type="button" class="knopf gefahr" data-tun="loeschen" id="loeschen">Löschen</button>
      </div>
    </div>`;
}

// --- Sport (v4) ------------------------------------------------------------

/*
 * Tobi: „Lass noch nen Sportmodus einbauen. Uwe brauch auch bewerglichkeit
 * und so …" – „er meint er ist sehr steif". Beweglichkeit jeden Tag, Kraft
 * und Ausdauer zwei- oder dreimal die Woche mit dem, was er zu Hause hat.
 * Übungen, Auswahl und Gewichte in sport.js; hier nur Anzeige und Uhr.
 */

const profilVon = (sport) => ({ geraete: sport.geraete, beschwerden: sport.beschwerden });

function sportKarte(stand, h) {
  const sp = stand.sport;
  if (!sp.eingerichtet) {
    if (stand.hinweise.sportNeu) return '';
    return `<section class="karte hinweis" id="sport-neu">
      <p>🤸 <strong>Neu: Sport.</strong> Jeden Tag zehn Minuten Beweglichkeit und zwei-, dreimal die Woche Training mit dem, was du zu Hause hast.</p>
      <div class="reihe"><button type="button" class="knopf" data-tun="seite" data-seite="sport">Ansehen</button>
      <button type="button" class="knopf leise" data-tun="hinweis-weg" data-hinweis="sportNeu">Später</button></div>
    </section>`;
  }
  const d = SP.heuteDran(sp, h);
  if (!d.beweglich && !d.kraft) return '';
  const min = SP.minuten(SP.einheit('beweglich', profilVon(sp)));
  return `<section class="karte sport-klein" id="sport-heute-karte">
    <p>🤸 ${d.beweglich ? `<strong>Beweglichkeit:</strong> ${min} Minuten – heute noch nicht.` : '<strong>Beweglichkeit</strong> ✓'}${d.kraft ? (d.vorschlag === 'studio' ? ' Diese Woche ist noch Studio dran.' : ' Kraft und Ausdauer ist auch dran.') : ''}</p>
    <div class="reihe">
      ${d.beweglich ? '<button type="button" class="knopf haupt" data-tun="training" data-typ="beweglich">Los geht’s</button>' : ''}
      ${d.kraft ? `<button type="button" class="knopf" data-tun="training" data-typ="${d.vorschlag}">${d.vorschlag === 'studio' ? 'Studio' : 'Kraft &amp; Ausdauer'}</button>` : ''}
    </div>
  </section>`;
}

function seiteSport(stand) {
  const sp = stand.sport;
  const h = heute();
  if (!sp.eingerichtet || zustand.sportEinrichten) return `<h2 class="seitentitel">Sport 🤸</h2>${sportEinrichtenHtml(sp)}`;
  const d = SP.heuteDran(sp, h);
  const beweglich = SP.einheit('beweglich', profilVon(sp));
  const kraft = SP.einheit('kraft', profilVon(sp));
  const studio = sp.geraete.includes('studio') ? SP.einheit('studio', profilVon(sp)) : [];
  const studioWoche = sp.log.some((l) => l.art === 'studio' && l.tag >= SP.wochenanfang(h));
  const hafertag = R.istHafertag(stand, h);
  const radHeute = sp.log.filter((l) => l.art === 'rad' && l.tag === h).reduce((s, l) => s + (l.min || 0), 0);
  const gewicht = R.werteVon(stand, 'gewicht').at(-1)?.wert;
  const woche = Array.from({ length: 7 }, (_, i) => R.plusTage(h, i - 6));
  const zeichen = (tag) => {
    const an = sp.log.filter((l) => l.tag === tag);
    return [an.some((l) => l.art === 'beweglich') ? '🤸' : '', an.some((l) => l.art === 'kraft') ? '💪' : '', an.some((l) => l.art === 'studio') ? '🏢' : '', an.some((l) => l.art === 'rad') ? '🚲' : ''].join('');
  };
  return `
  <h2 class="seitentitel">Sport 🤸</h2>
  <section class="karte" id="sport-heute">
    <h3>Heute</h3>
    <div class="einheit-zeile">
      <div><strong>Beweglichkeit</strong><small>${SP.minuten(beweglich)} Minuten · ${beweglich.length} Übungen · jeden Tag</small></div>
      ${d.beweglichHeute ? '<span class="erledigt">✓ gemacht</span>' : '<button type="button" class="knopf haupt" data-tun="training" data-typ="beweglich" id="los-beweglich">Los</button>'}
    </div>
    <div class="einheit-zeile">
      <div><strong>Kraft &amp; Ausdauer</strong><small>${SP.minuten(kraft)} Minuten · ${kraft.length} Übungen · diese Woche ${d.kraftWoche} von ${sp.kraftProWoche}</small></div>
      ${d.kraftHeute ? '<span class="erledigt">✓ gemacht</span>'
    : `<button type="button" class="knopf${d.kraft && !hafertag ? ' haupt' : ''}" data-tun="training" data-typ="kraft" id="los-kraft">${d.kraft ? 'Los' : 'Trotzdem'}</button>`}
    </div>
    ${studio.length ? `<div class="einheit-zeile">
      <div><strong>Studio (Maschinen)</strong><small>${SP.minuten(studio)} Minuten · ${studio.length} Übungen · 1× die Woche${studioWoche ? ' · ✓ diese Woche' : ''}</small></div>
      ${d.kraftHeute ? '' : `<button type="button" class="knopf${d.kraft && d.vorschlag === 'studio' && !hafertag ? ' haupt' : ''}" data-tun="training" data-typ="studio" id="los-studio">Los</button>`}
    </div>` : ''}
    <p class="klein leise" id="sport-hinweis">${hafertag ? '🌾 Heute ist Hafertag – lieber nur Beweglichkeit oder locker Rad fahren.'
    : d.kraft ? (d.vorschlag === 'studio' ? 'Heute wäre ein guter Tag fürs Studio – diese Woche warst du noch nicht.' : 'Heute ist Kraft dran.') : d.kraftHeute || d.kraftWoche < sp.kraftProWoche ? 'Kraft wieder übermorgen – die Muskeln brauchen einen Tag Pause.' : 'Kraft für diese Woche geschafft.'}</p>
    ${d.serie >= 2 ? `<p id="sport-serie">🔥 ${d.serie} Tage am Stück beweglich</p>` : ''}
  </section>
  ${sp.geraete.includes('rad') ? `<section class="karte" id="sport-rad">
    <h3>🚲 Heimtrainer</h3>
    <form class="werteform" data-form="rad">
      <label class="feld"><span class="unsichtbar">Minuten</span><input id="rad-min" inputmode="numeric" autocomplete="off" placeholder="z. B. 30"><span class="einheit">Min</span></label>
      <button type="submit" class="knopf haupt">Eintragen</button>
    </form>
    <div class="chips" role="group" aria-label="Wie anstrengend">${[['locker', 'locker'], ['mittel', 'mittel'], ['zuegig', 'zügig']].map(([id, n]) => `<button type="button" class="chip" data-tun="rad-stufe" data-stufe="${id}" aria-pressed="${(zustand.radStufe || 'mittel') === id}">${n}</button>`).join('')}</div>
    ${radHeute ? `<p id="rad-heute">Heute: ${radHeute} Minuten${gewicht ? ` · etwa ${R.zahl(SP.radKcal(radHeute, 'mittel', gewicht))} kcal verbraucht` : ''}</p>` : ''}
  </section>` : ''}
  <section class="karte" id="sport-woche">
    <h3>Die letzten 7 Tage</h3>
    <div class="sport-woche">${woche.map((t) => `<div class="${t === h ? 'heute' : ''}"><span>${zeichen(t) || '·'}</span><small>${esc(R.wochentag(t).slice(0, 2))}</small></div>`).join('')}</div>
    <p class="klein leise">🤸 Beweglichkeit · 💪 Kraft &amp; Ausdauer · 🏢 Studio · 🚲 Heimtrainer</p>
  </section>
  <section class="karte achtung" id="sport-zucker">
    <p><strong>Sport senkt den Blutzucker.</strong> Nimmst du Insulin oder Tabletten, die Unterzucker machen können: Traubenzucker in Reichweite. Wird dir zittrig oder schwummrig: aufhören, Traubenzucker essen.</p>
    <p class="klein">Tut etwas weh (stechend, nicht nur ziehen): die Übung auslassen. Dehnen soll ziehen, nicht schmerzen.</p>
  </section>
  <section class="karte" id="sport-geraete">
    <h3>Deine Sachen</h3>
    <p>${sp.geraete.length ? sp.geraete.map((g) => esc(SP.GERAETE.find((x) => x.id === g)?.n || g)).join(', ') : 'Keine Geräte – alles mit dem eigenen Körper.'}</p>
    ${sp.hanteln.length ? `<p class="klein">Hanteln: ${sp.hanteln.map((kg) => `${String(kg).replace('.', ',')} kg`).join(', ')}</p>` : ''}
    ${sp.beschwerden.length ? `<p class="klein">Schont: ${sp.beschwerden.map((b) => esc(SP.BESCHWERDEN.find((x) => x.id === b)?.n || b)).join(', ')}</p>` : ''}
    <button type="button" class="knopf leise" data-tun="sport-aendern">Ändern</button>
  </section>`;
}

function sportEinrichtenHtml(sp) {
  const chip = (tun, wert, an, text) => `<button type="button" class="chip" data-tun="${tun}" data-wert="${wert}" aria-pressed="${an}">${text}</button>`;
  return `<section class="karte" id="sport-einrichten">
    <p>Jeden Tag zehn Minuten Beweglichkeit – gerade wer steif ist, gewinnt mehr durch „jeden Tag ein bisschen“ als durch eine lange Einheit. Dazu zwei-, dreimal die Woche Kraft und Ausdauer mit dem, was du hast.</p>
    <h3>Was hast du zu Hause?</h3>
    <div class="chips" role="group" aria-label="Geräte">${SP.GERAETE.map((g) => chip('sport-geraet', g.id, sp.geraete.includes(g.id), `${g.z} ${g.n}`)).join('')}</div>
    ${sp.geraete.includes('hanteln') ? `<h4>Welche Hanteln? (Gewicht je Hantel)</h4>
      <div class="chips" role="group" aria-label="Hanteln" id="sport-hanteln">${SP.HANTEL_KG.map((kg) => chip('sport-kg', kg, sp.hanteln.includes(kg), `${kg} kg`)).join('')}</div>
      <p class="klein leise">Alle antippen, die du hast. Verstellbare Hanteln: die Gewichte, die du einstellen kannst.</p>` : ''}
    <h3>Zwickt etwas?</h3>
    <div class="chips" role="group" aria-label="Beschwerden">${SP.BESCHWERDEN.map((b) => chip('sport-beschwerde', b.id, sp.beschwerden.includes(b.id), b.n)).join('')}</div>
    <p class="klein leise">Was dafür nicht gut ist, lässt die App weg oder nimmt etwas Sanfteres.</p>
    <h3>Wie oft Kraft und Ausdauer?</h3>
    <div class="chips" role="group" aria-label="Wie oft">${[2, 3].map((n) => chip('sport-oft', n, sp.kraftProWoche === n, `${n}× die Woche`)).join('')}</div>
    <p class="fehler" id="sport-fehler" role="alert"></p>
    <button type="button" class="knopf haupt gross-knopf" data-tun="sport-fertig" id="sport-fertig">Fertig</button>
  </section>`;
}

// --- Die Einheit ------------------------------------------------------------

let uhr = null;
let wachBleiben = null;

function uhrAus() {
  if (uhr) { clearInterval(uhr.id); uhr = null; }
}

function wachBleibenAus() {
  if (wachBleiben) { wachBleiben.release?.().catch(() => {}); wachBleiben = null; }
}

/** Abschnitte der Uhr: je Seite zweimal, Runden mit Pausen dazwischen. */
function phasen(u) {
  if (u.d.runden) {
    const p = [];
    for (let r = 1; r <= u.d.runden; r++) {
      p.push({ sek: u.d.sek, text: `Runde ${r} von ${u.d.runden} – los!` });
      if (r < u.d.runden) p.push({ sek: u.d.pause, text: 'Pause' });
    }
    return p;
  }
  if (u.je) return [{ sek: u.d.sek, text: 'Erste Seite' }, { sek: u.d.sek, text: 'Andere Seite' }];
  return [{ sek: u.d.sek, text: '' }];
}

const mmss = (sek) => `${Math.floor(sek / 60)}:${String(Math.max(0, Math.ceil(sek) % 60)).padStart(2, '0')}`;

function piep() {
  navigator.vibrate?.(150);
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    piep.ctx ||= new Ctx();
    const o = piep.ctx.createOscillator();
    const g = piep.ctx.createGain();
    o.frequency.value = 880;
    g.gain.setValueAtTime(0.25, piep.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, piep.ctx.currentTime + 0.25);
    o.connect(g).connect(piep.ctx.destination);
    o.start();
    o.stop(piep.ctx.currentTime + 0.26);
  } catch { /* ohne Ton */ }
}

function uhrStarten() {
  const u = SP.NACH_ID.get(ebene.liste[ebene.i]);
  const ph = phasen(u);
  if (uhr) { // Pause / weiter
    uhr.laeuft = !uhr.laeuft;
    uhr.basis = performance.now() - uhr.vergangen * 1000;
    zeichneUhr();
    return;
  }
  uhr = { ph, idx: 0, laeuft: true, basis: performance.now(), vergangen: 0, fertig: false };
  uhr.id = setInterval(ticken, 200);
  zeichneUhr();
}

function ticken() {
  if (!uhr || !uhr.laeuft || uhr.fertig) return;
  uhr.vergangen = (performance.now() - uhr.basis) / 1000;
  let rest = uhr.vergangen;
  let idx = 0;
  while (idx < uhr.ph.length && rest >= uhr.ph[idx].sek) { rest -= uhr.ph[idx].sek; idx++; }
  if (idx !== uhr.idx) { uhr.idx = idx; piep(); }
  if (idx >= uhr.ph.length) { uhr.fertig = true; clearInterval(uhr.id); }
  uhr.rest = idx < uhr.ph.length ? uhr.ph[idx].sek - rest : 0;
  zeichneUhr();
}

function zeichneUhr() {
  const anzeige = $('#uhr');
  if (!anzeige || !uhr) return;
  const p = uhr.ph[Math.min(uhr.idx, uhr.ph.length - 1)];
  anzeige.textContent = uhr.fertig ? '✓' : mmss(uhr.rest ?? p.sek);
  $('#uhr-text').textContent = uhr.fertig ? 'Geschafft – weiter zur nächsten.' : (p.text || '');
  $('#uhr-knopf').textContent = uhr.fertig ? 'Noch einmal' : uhr.laeuft ? 'Pause' : 'Weiter';
}

async function trainingStarten(typ) {
  const sp = lesen().sport;
  const liste = SP.einheit(typ, profilVon(sp)).map((u) => u.id);
  if (!liste.length) return;
  const kg = {};
  liste.forEach((id) => { const g = SP.gewichtFuer(SP.NACH_ID.get(id), sp.hanteln, sp.gewichte); if (g) kg[id] = g; });
  const maschine = {};
  liste.forEach((id) => { if (SP.NACH_ID.get(id).m && sp.gewichte[id]) maschine[id] = sp.gewichte[id]; });
  oeffneEbene({ art: 'training', typ, liste, i: 0, kg, urteil: {}, maschine, fertig: false, gemacht: 0 });
  try { wachBleiben = await navigator.wakeLock?.request('screen'); } catch { wachBleiben = null; }
}

function trainingHtml() {
  const titel = { kraft: 'Kraft & Ausdauer', studio: 'Studio', beweglich: 'Beweglichkeit' }[ebene.typ];
  const kopf = `<div class="ebene-kopf">
      <button type="button" class="rund" data-tun="ebene-zu" aria-label="Beenden">✕</button>
      <h2>${titel}</h2>
    </div>`;
  if (ebene.fertig) {
    return `${kopf}<div class="ebene-inhalt training-ende" id="training-ende">
      <p class="gross">💪</p>
      <h2>Geschafft!</h2>
      <p>${ebene.gemacht} von ${ebene.liste.length} Übungen, etwa ${ebene.min} Minuten.</p>
      ${Object.keys(ebene.urteil).length ? '<p class="klein leise">Die Gewichte fürs nächste Mal sind angepasst.</p>' : ''}
      <button type="button" class="knopf haupt gross-knopf" data-tun="ebene-zu">Fertig</button>
    </div>`;
  }
  const u = SP.NACH_ID.get(ebene.liste[ebene.i]);
  const kg = ebene.kg[u.id];
  const zeit = !!u.d.sek;
  return `${kopf}
    <div class="ebene-inhalt training">
      <div class="fortschritt" role="progressbar" aria-valuemin="0" aria-valuemax="${ebene.liste.length}" aria-valuenow="${ebene.i}"><span style="width:${Math.round((ebene.i / ebene.liste.length) * 100)}%"></span></div>
      <p class="klein leise" id="training-stand">Übung ${ebene.i + 1} von ${ebene.liste.length}</p>
      ${figur(u.id, { ruhig: matchMedia('(prefers-reduced-motion: reduce)').matches })}
      <h2 class="uebung-name" id="uebung-name">${esc(u.n)}</h2>
      <p class="dosis" id="uebung-dosis">${esc(SP.dosis(u))}${kg ? ` · <strong>${String(kg).replace('.', ',')} kg</strong> ${u.eine ? '(eine Hantel)' : 'je Hand'}` : ''}</p>
      <p id="uebung-text">${esc(u.t)}</p>
      ${zeit ? `<div class="uhr-block">
          <p class="uhr" id="uhr" aria-live="off">${mmss(phasen(u)[0].sek)}</p>
          <p class="klein" id="uhr-text">${esc(phasen(u)[0].text || '')}</p>
          <button type="button" class="knopf" data-tun="uhr" id="uhr-knopf">Start</button>
        </div>` : ''}
      ${u.m ? `<label class="feld gramm-feld"><span>Gewicht an der Maschine</span><input id="maschine-kg" inputmode="decimal" autocomplete="off" placeholder="kg" value="${ebene.maschine[u.id] ?? ''}"><span class="einheit">kg</span></label>
        <p class="klein leise">${ebene.maschine[u.id] ? 'Wie letztes Mal – fällt es leicht (noch 2 Wiederholungen übrig nach 12), beim nächsten Mal eine Stufe mehr.' : 'Ein Gewicht, mit dem 10 saubere Wiederholungen gehen; trag es ein, dann steht es beim nächsten Mal hier.'}</p>` : ''}
      ${kg ? `<h3>Wie war das Gewicht?</h3>
        <div class="chips" role="group" aria-label="Gewicht">${[['leicht', 'zu leicht'], ['passt', 'passt'], ['schwer', 'zu schwer']].map(([id, n]) => `<button type="button" class="chip" data-tun="urteil" data-urteil="${id}" aria-pressed="${ebene.urteil[u.id] === id}">${n}</button>`).join('')}</div>` : ''}
      <div class="reihe training-knoepfe">
        <button type="button" class="knopf haupt" data-tun="training-weiter" id="training-weiter">${ebene.i + 1 < ebene.liste.length ? 'Geschafft – weiter' : 'Geschafft – fertig'}</button>
        <button type="button" class="knopf leise" data-tun="training-weiter" data-auslassen="1" id="training-auslassen">Auslassen</button>
      </div>
    </div>`;
}

function trainingWeiter(ausgelassen) {
  uhrAus();
  const feld = $('#maschine-kg');
  if (feld) {
    const w = R.leseZahl(feld.value);
    if (Number.isFinite(w) && w > 0 && w <= 400) ebene.maschine[ebene.liste[ebene.i]] = w;
  }
  if (!ausgelassen) ebene.gemacht++;
  if (ebene.i + 1 < ebene.liste.length) {
    ebene.i++;
    zeigeEbene();
    $('#ebene').scrollTo(0, 0);
    return;
  }
  // Ende: festhalten, Gewichte fürs nächste Mal
  const h = heute();
  const min = SP.minuten(ebene.liste.map((id) => SP.NACH_ID.get(id)));
  const { typ, urteil, kg, gemacht, maschine } = ebene;
  aendern((s) => {
    s.sport.log.push({ tag: h, art: typ, min, n: gemacht });
    Object.entries(maschine).forEach(([id, w]) => { s.sport.gewichte[id] = w; });
    Object.entries(urteil).forEach(([id, wert]) => {
      if (kg[id]) s.sport.gewichte[id] = SP.naechstesGewicht(kg[id], s.sport.hanteln, wert);
    });
  });
  ebene = { ...ebene, fertig: true, min };
  wachBleibenAus();
  zeigeEbene();
}

// --- Strichcode, Rezept und Foto (v3) --------------------------------------

/*
 * Tobi: „ihm fehlen viele rezepte und zutaten. Lass doch per Api ne ki
 * einbauen …" und „und barcode scanner". Drei Wege zu einer eigenen Sache,
 * alle mit kcal je 100 g, damit man auch in Gramm eintragen kann:
 *
 *   Strichcode   live (Android) oder Nummer eintippen → Open Food Facts;
 *                auf dem iPhone ein Foto, die KI liest die Nummer ab.
 *   Rezept       Text oder Foto der Kochbuchseite → die KI rechnet.
 *   Packung      Foto der Nährwerttabelle → die KI liest ab.
 */

let kamera = null;
function kameraAus() {
  if (kamera) { kamera(); kamera = null; }
}

async function kameraAn() {
  const video = $('#scan-video');
  if (!video) return;
  const meine = ebene;
  try {
    const stopp = await S.liveLesen(video, { gefunden: (code) => { kamera = null; strichcodeGefunden(code); } });
    if (ebene !== meine || ebene?.art !== 'scan') { stopp(); return; }
    kamera = stopp;
  } catch (e) {
    scanStatus(e?.name === 'NotAllowedError'
      ? 'Die Kamera ist nicht erlaubt. Tipp die Nummer unten ein – oder erlaube die Kamera in den Einstellungen des Browsers.'
      : 'Die Kamera startet nicht. Tipp die Nummer unten ein.');
  }
}

const scanStatus = (text) => { const el = $('#scan-status'); if (el) el.textContent = text; };

/*
 * Noch nicht freigeschaltet (v12). Tobi, 21.11.2026: „Statt ihn nach einem
 * freischalt Code zu fragen soll in solchen Situationen dort stehen dass er
 * tobi bitten soll den freischalt Code zu schicken. Er selbst soll generell so
 * wenig wie möglich machen.“ Darum: ein Knopf, der die Bitte an Tobi
 * vorbereitet, und einer, der den Code aus Tobis kopierter Nachricht holt –
 * Link oder Code, egal. Eintippen nur noch versteckt (für Tobi am Handy).
 */
function freischaltenHtml() {
  return `<div class="karte hinweis ki-freischalten">
    <p><strong>Die KI ist bei dir noch nicht freigeschaltet.</strong> Bitte Tobi, dir den Freischalt-Code zu schicken.</p>
    <button type="button" class="knopf haupt" data-tun="tobi-fragen" id="tobi-fragen">📨 Tobi um den Code bitten</button>
    <p class="klein">Ist seine Nachricht da: sie gedrückt halten → <strong>„Kopieren“</strong>, dann hier tippen:</p>
    <button type="button" class="knopf" data-tun="code-einfuegen" id="code-einfuegen">📋 Code von Tobi einfügen</button>
    <details class="code-von-hand"><summary>Code eintippen</summary>
      <form class="werteform" data-form="ki-code">
        <label class="feld"><span class="unsichtbar">Freischalt-Code</span><input class="ki-code-feld" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="ABCDE-FGHJK"></label>
        <button type="submit" class="knopf haupt">Freischalten</button>
      </form>
    </details>
    <p class="fehler" role="alert"></p>
  </div>`;
}

function scanHtml() {
  const live = S.kannLive();
  const code = K.kiAn() && K.kiCode();
  const ng = ebene.nichtGefunden;
  return `
    <div class="ebene-kopf">
      <button type="button" class="rund" data-tun="zurueck-suche" aria-label="Zurück">‹</button>
      <h2>Strichcode</h2>
    </div>
    <div class="ebene-inhalt">
      ${ng ? `<div class="karte hinweis" id="nicht-gefunden">
          <p><strong>${esc(ng.code)}</strong>${ng.name ? ` (${esc(ng.name)})` : ''}: ${ng.name ? 'Open Food Facts kennt das Produkt, aber ohne Kalorien.' : 'Diese Nummer kennt Open Food Facts nicht.'}</p>
          <div class="reihe">
            ${code ? '<button type="button" class="knopf haupt" data-tun="packung-foto">🧾 Nährwerttabelle fotografieren</button>' : ''}
            <button type="button" class="knopf leise" data-tun="eigen">✎ Selbst eintragen</button>
            <button type="button" class="knopf leise" data-tun="scan-neu">Anderen Strichcode</button>
          </div>
        </div>`
    : live ? `<div class="scan-bild"><video id="scan-video" playsinline muted autoplay></video><div class="scan-rahmen" aria-hidden="true"></div></div>
        <p class="klein" id="scan-hilfe">Halte den Strichcode in den Rahmen – die App liest ihn von selbst.</p>`
      : `<p id="scan-hilfe">${geraet() === 'ios' ? 'Das iPhone lässt Webseiten Strichcodes nicht selbst lesen.' : 'Dieser Browser kann Strichcodes nicht selbst lesen.'} ${code ? 'Fotografier ihn – die KI liest die Nummer ab.' : 'Tipp die Nummer unter den Strichen ein.'}</p>
        ${code ? `<label class="knopf haupt breit">📷 Strichcode fotografieren<input type="file" id="scan-foto" accept="image/*" class="unsichtbar"></label>` : ''}`}
      <p id="scan-status" class="scan-status" role="status"></p>
      <form class="werteform" data-form="ean">
        <label class="feld"><span class="unsichtbar">Nummer unter dem Strichcode</span><input id="ean" inputmode="numeric" autocomplete="off" placeholder="Nummer, z. B. 4001234567891" maxlength="16"></label>
        <button type="submit" class="knopf">Nachschlagen</button>
      </form>
      <p class="klein leise">Die Nummer geht an Open Food Facts, eine freie Datenbank für Lebensmittel. Einmal gefunden, kennt die App das Produkt auch ohne Netz.</p>
    </div>`;
}

function zeigeSache(id) {
  kameraAus();
  ebene = { ...ebene, art: 'sache', id, m: 1, gramm: '', nichtGefunden: null };
  zeigeEbene();
  $('#ebene').scrollTo(0, 0);
}

async function strichcodeGefunden(roh) {
  const code = S.eanOrdnen(roh);
  if (!S.eanOk(code)) {
    scanStatus(`${code || 'Die Nummer'} stimmt so nicht – bitte noch einmal genau abtippen (meist 13 Ziffern).`);
    return;
  }
  const da = R.eigeneMitEan(lesen(), code);
  if (da) { zeigeSache(da.id); return; }
  const meine = ebene;
  scanStatus(`Suche ${code} …`);
  let produkt;
  try {
    produkt = await S.nachschlagen(code);
  } catch {
    if (ebene === meine) scanStatus('Keine Verbindung zu Open Food Facts. Ist das Handy online?');
    return;
  }
  if (ebene !== meine || ebene.art !== 'scan') return;
  if (!produkt || produkt.ohneWerte) {
    kameraAus();
    ebene.nichtGefunden = { code, name: produkt?.name || '' };
    zeigeEbene();
    return;
  }
  const sache = S.sacheAusProdukt(produkt, neueId('eigen'));
  aendern((s) => { s.eigene.unshift(sache); });
  zeigeSache(sache.id);
}

async function strichcodeFoto(datei) {
  const meine = ebene;
  scanStatus('Die KI liest die Nummer …');
  try {
    const bild = await K.fotoVorbereiten(datei, 1280);
    URL.revokeObjectURL(bild.url);
    const { ergebnis: e } = await K.kiFragen({ art: 'auswerten', text: '', bilder: [{ typ: bild.typ, daten: bild.daten }], portionen: null, hinweis: 'strichcode' });
    if (ebene !== meine) return;
    if (e.ean) { strichcodeGefunden(e.ean); return; }
    if (e.art === 'packung' && e.kcal_100g > 0) { kiErgebnisZeigen(e, null); return; }
    scanStatus(`Auf dem Foto war keine Nummer zu lesen.${e.hinweis ? ` (${e.hinweis})` : ''} Noch einmal näher und gerade – oder die Nummer eintippen.`);
  } catch (err) {
    if (ebene === meine) scanStatus(err.message);
  }
}

function rezeptHtml() {
  if (ebene.hinweis === 'suche') return sucheHtml();
  const packung = ebene.hinweis === 'packung';
  const kopf = `<div class="ebene-kopf">
      <button type="button" class="rund" data-tun="zurueck-suche" aria-label="Zurück">‹</button>
      <h2>${packung ? 'Packung auswerten' : 'Rezept ausrechnen'}</h2>
    </div>`;
  if (!K.kiCode()) return `${kopf}<div class="ebene-inhalt">${freischaltenHtml()}</div>`;
  return `${kopf}
    <div class="ebene-inhalt">
      <div class="chips" role="group" aria-label="Was ist es?">
        <button type="button" class="chip" data-tun="rezept-art" data-art="rezept" aria-pressed="${!packung}">Rezept</button>
        <button type="button" class="chip" data-tun="rezept-art" data-art="packung" aria-pressed="${packung}">Packung, Nährwerte</button>
      </div>
      <p>${packung
    ? 'Fotografier die Nährwerttabelle auf der Packung – die KI liest die Werte je 100 g ab.'
    : 'Schreib dein Rezept hier rein oder fotografier die Seite aus dem Kochbuch – die KI rechnet die Kalorien aus, je 100 g und je Portion.'}</p>
      ${packung ? '' : `<label class="textfeld"><span class="unsichtbar">Rezept</span><textarea id="rezept-text" rows="6" maxlength="6000" placeholder="z. B. 500 g Rinderhack, 1 Zwiebel, 1 Dose Tomaten, 250 g Spaghetti, 50 g Parmesan – für 4 Personen">${esc(ebene.text)}</textarea></label>`}
      ${ebene.bilder.length ? `<div class="fotos" id="fotos">${ebene.bilder.map((b, i) => `<figure><img src="${b.url}" alt="Foto ${i + 1}"><button type="button" class="weg" data-tun="foto-weg" data-i="${i}" aria-label="Foto ${i + 1} entfernen">✕</button></figure>`).join('')}</div>` : ''}
      ${ebene.bilder.length < 3 ? `<label class="knopf breit" id="foto-knopf">📷 ${ebene.bilder.length ? 'Noch ein Foto' : packung ? 'Nährwerttabelle fotografieren' : 'Kochbuchseite fotografieren'}<input type="file" id="rezept-foto" accept="image/*" class="unsichtbar"></label>` : ''}
      ${packung ? '' : `<h3>Für wie viele Portionen?</h3>
        <div class="chips" role="group" aria-label="Portionen">${[0, 1, 2, 3, 4, 6, 8].map((n) => `<button type="button" class="chip" data-tun="rezept-portionen" data-n="${n}" aria-pressed="${(ebene.portionen || 0) === n}">${n || 'weiß nicht'}</button>`).join('')}</div>`}
      <p class="fehler" id="ki-fehler" role="alert">${esc(ebene.fehler || '')}</p>
      <button type="button" class="knopf haupt gross-knopf" data-tun="ausrechnen" id="ausrechnen" ${ebene.laeuft ? 'disabled' : ''}>${ebene.laeuft ? 'Die KI rechnet … (bis zu einer Minute)' : 'Ausrechnen'}</button>
      <p class="klein leise">Text und Fotos gehen dafür an die KI Gemini von Google – sonst nichts von dir.</p>
    </div>`;
}

/* Im Internet nachsehen (v11): ein Gericht oder Produkt, das die Liste nicht kennt. */
function sucheHtml() {
  const kopf = `<div class="ebene-kopf">
      <button type="button" class="rund" data-tun="zurueck-suche" aria-label="Zurück">‹</button>
      <h2>Im Internet nachsehen</h2>
    </div>`;
  if (!K.kiCode()) return `${kopf}<div class="ebene-inhalt">${freischaltenHtml()}</div>`;
  return `${kopf}
    <div class="ebene-inhalt">
      <p>Was suchst du? Ein Gericht oder Produkt – die App sucht die Nährwerte im Internet und rechnet je 100 g und je Portion.</p>
      <label class="textfeld"><span class="unsichtbar">Suchwort</span><input id="netz-text" maxlength="200" autocomplete="off" value="${esc(ebene.text)}" placeholder="z. B. Leberkäsbrötchen, Snickers, Döner"></label>
      <p class="fehler" id="ki-fehler" role="alert">${esc(ebene.fehler || '')}</p>
      <button type="button" class="knopf haupt gross-knopf" data-tun="ausrechnen" id="ausrechnen" ${ebene.laeuft ? 'disabled' : ''}>${ebene.laeuft ? 'Sucht und rechnet … (bis zu einer halben Minute)' : 'Nachsehen'}</button>
      <p class="klein leise">Das Suchwort geht an die Suche Tavily und die KI Gemini von Google – sonst nichts von dir.</p>
    </div>`;
}

function oeffneRezept(hinweis = 'rezept', mehr = {}) {
  kameraAus();
  ebene = { ...ebene, art: 'rezept', hinweis, text: ebene.text || '', bilder: [], portionen: null, laeuft: false, fehler: '', nichtGefunden: null, ...mehr };
  zeigeEbene();
  $('#ebene').scrollTo(0, 0);
}

async function ausrechnen() {
  if (ebene.hinweis === 'suche') { netzSuchen(); return; }
  const text = (ebene.hinweis === 'packung' ? '' : ($('#rezept-text')?.value ?? ebene.text)).trim();
  ebene.text = text;
  if (!text && !ebene.bilder.length) {
    ebene.fehler = ebene.hinweis === 'packung' ? 'Bitte erst die Nährwerttabelle fotografieren.' : 'Bitte das Rezept hineinschreiben oder ein Foto machen.';
    zeigeEbene();
    return;
  }
  const meine = ebene;
  ebene.laeuft = true;
  ebene.fehler = '';
  zeigeEbene();
  try {
    const { ergebnis: e } = await K.kiFragen({
      art: 'auswerten', text, bilder: meine.bilder.map(({ typ, daten }) => ({ typ, daten })), portionen: meine.portionen || null, hinweis: meine.hinweis,
    });
    if (ebene !== meine) return;
    meine.laeuft = false;
    if (e.art === 'unklar' || !(e.kcal_100g > 0 || e.gesamt_kcal > 0)) {
      if (e.ean) { oeffneScan(); strichcodeGefunden(e.ean); return; }
      meine.fehler = `Daraus ließ sich nichts ausrechnen.${e.hinweis ? ` ${e.hinweis}` : ''}`;
      zeigeEbene();
      return;
    }
    kiErgebnisZeigen(e, meine.portionen);
  } catch (err) {
    if (ebene !== meine) return;
    meine.laeuft = false;
    if (err.status === 401) {
      // Code gesperrt oder vergessen: wieder der Kasten „Bitte Tobi …“ (v12)
      K.kiCodeWeg();
      meldung('Der Freischalt-Code gilt nicht mehr – bitte Tobi um einen neuen.');
    } else meine.fehler = err.message;
    zeigeEbene();
  }
}

async function netzSuchen() {
  const text = ($('#netz-text')?.value ?? ebene.text).replace(/\s+/g, ' ').trim();
  ebene.text = text;
  if (text.length < 2) { ebene.fehler = 'Bitte ein Wort eingeben, z. B. „Leberkäsbrötchen“.'; zeigeEbene(); return; }
  const meine = ebene;
  ebene.laeuft = true;
  ebene.fehler = '';
  zeigeEbene();
  try {
    const { ergebnis: e } = await K.kiFragen({ art: 'suchen', text });
    if (ebene !== meine) return;
    meine.laeuft = false;
    if (e.art === 'unklar' || !(e.kcal_100g > 0)) {
      meine.fehler = `Dazu ließ sich nichts finden.${e.hinweis ? ` ${e.hinweis}` : ''}`;
      zeigeEbene();
      return;
    }
    kiErgebnisZeigen(e, null);
  } catch (err) {
    if (ebene !== meine) return;
    meine.laeuft = false;
    if (err.status === 401) {
      // Code gesperrt oder vergessen: wieder der Kasten „Bitte Tobi …“ (v12)
      K.kiCodeWeg();
      meldung('Der Freischalt-Code gilt nicht mehr – bitte Tobi um einen neuen.');
    } else meine.fehler = err.message;
    zeigeEbene();
  }
}

function kiErgebnisZeigen(e, portionen) {
  kameraAus();
  ebene = { ...ebene, art: 'ki-ergebnis', e, portionen: portionen || e.portionen || 1, name: e.name, laeuft: false };
  zeigeEbene();
  $('#ebene').scrollTo(0, 0);
}

/** „https://www.fddb.info/db/…“ → „fddb.info“ */
function quelleName(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return 'Internet'; }
}

function ergebnisHtml() {
  const { e } = ebene;
  const packung = e.art === 'packung';
  const vorschau = R.sacheAusKi({ ...e, name: ebene.name }, ebene.portionen, 'vorschau');
  return `
    <div class="ebene-kopf">
      <button type="button" class="rund" data-tun="zurueck-rezept" aria-label="Zurück">‹</button>
      <h2>${e.quelle ? 'Gefunden' : 'Ausgerechnet'}</h2>
    </div>
    <div class="ebene-inhalt">
      <label class="textfeld">Name<input id="erg-name" maxlength="60" autocomplete="off" value="${esc(ebene.name)}"></label>
      <p class="gross"><span id="erg-100">${R.zahl(e.kcal_100g)}</span> <span class="einheit">kcal je 100 g</span></p>
      <p class="leise klein">${String(e.kh_100g).replace('.', ',')} g Kohlenhydrate${e.ei_100g ? ` · ${String(e.ei_100g).replace('.', ',')} g Eiweiß` : ''} je 100 g</p>
      ${e.quelle ? `<p class="klein" id="erg-quelle">Laut <a href="${esc(e.quelle)}" target="_blank" rel="noopener noreferrer">${esc(quelleName(e.quelle))}</a></p>` : ''}
      ${packung
    ? `<p id="erg-portion">${esc(vorschau.p)}: <strong>${R.zahl(vorschau.kcal)} kcal</strong></p>`
    : `<div class="karte">
          <p id="erg-gesamt">Ganzes Rezept: <strong>${R.zahl(e.gesamt_kcal)} kcal</strong>${e.gesamt_gramm ? ` · etwa ${R.zahl(e.gesamt_gramm)} g fertig` : ''}</p>
          <h3>In wie viele Portionen teilst du es?</h3>
          <div class="chips" role="group" aria-label="Portionen">${[1, 2, 3, 4, 5, 6, 8].map((n) => `<button type="button" class="chip" data-tun="erg-portionen" data-n="${n}" aria-pressed="${ebene.portionen === n}">${n}</button>`).join('')}</div>
          <p id="erg-portion">1 Portion: <strong>${R.zahl(vorschau.kcal)} kcal</strong>${vorschau.g ? ` (${R.zahl(vorschau.g)} g)` : ''}</p>
        </div>
        ${e.zutaten.length ? `<details class="rechnung"><summary>So hat die KI gerechnet</summary><ul class="punkte">${e.zutaten.map((z) => `<li>${esc(z.menge)} ${esc(z.name)} – ${R.zahl(z.kcal)} kcal</li>`).join('')}</ul></details>` : ''}`}
      ${e.hinweis ? `<p class="klein leise" id="erg-hinweis">ℹ️ ${esc(e.hinweis)}</p>` : ''}
      <p class="klein leise">${e.quelle ? 'Werte aus dem Internet, von der KI zusammengefasst – für den Überblick reicht es.' : 'Die KI schätzt – so gut wie das Rezept genau ist. Für den Überblick reicht es.'}</p>
      <button type="button" class="knopf haupt gross-knopf" data-tun="erg-speichern" data-eintragen="1" id="erg-eintragen">Speichern und eintragen</button>
      <button type="button" class="knopf leise breit" data-tun="erg-speichern" data-eintragen="" id="erg-merken">Nur speichern</button>
    </div>`;
}

function ergebnisSpeichern(dannEintragen) {
  const name = ($('#erg-name')?.value || ebene.name || '').trim() || ebene.e.name;
  const sache = R.sacheAusKi({ ...ebene.e, name }, ebene.portionen, neueId('eigen'));
  if (ebene.ean && !sache.ean) sache.ean = ebene.ean;
  aendern((s) => { s.eigene.unshift(sache); });
  if (dannEintragen) { zeigeSache(sache.id); return; }
  ebene = { art: 'suche', tag: ebene.tag, z: ebene.z, q: '', bereich: null, zuletzt: `${sache.n} gespeichert – du findest es unter „⭐ Eigene“ und in der Suche.` };
  zeigeEbene();
}

function oeffneScan() {
  ebene = { ...ebene, art: 'scan', nichtGefunden: null };
  zeigeEbene();
}

async function freischalten(form) {
  const code = K.codeAusText(form.querySelector('input').value);
  const fehler = form.closest('.ki-freischalten')?.querySelector('.fehler') || form.parentElement.querySelector('.fehler');
  if (!code) { fehler.textContent = 'So sieht der Code nicht aus – zehn Zeichen, etwa ABCDE-FGHJK.'; return; }
  await mitCodeFreischalten(code, fehler);
}

/** Den Code aus der Zwischenablage (Tobis kopierte Nachricht) – Uwe tippt nur den Knopf. */
async function codeEinfuegen(knopf) {
  const fehler = knopf.closest('.ki-freischalten')?.querySelector('.fehler');
  let text = '';
  try { text = await navigator.clipboard.readText(); } catch { /* nicht erlaubt */ }
  const code = K.codeAusText(text);
  if (!code) {
    if (fehler) fehler.textContent = 'Da ist noch kein Code. Tobis Nachricht gedrückt halten → „Kopieren“, dann noch einmal tippen.';
    return;
  }
  await mitCodeFreischalten(code, fehler);
}

function tobiFragen() {
  const text = 'Hallo Tobi, kannst du mir den Freischalt-Code für die KI in Mahlzeit schicken? 🙂';
  if (navigator.share) {
    navigator.share({ text }).catch(() => {});
  } else {
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
  }
}

async function mitCodeFreischalten(code, fehler) {
  fehler.textContent = 'Prüfe …';
  try {
    await K.codePruefen(code);
  } catch (e) {
    fehler.textContent = e.message;
    return;
  }
  K.kiCodeSetzen(code);
  meldung('KI freigeschaltet ✨');
  zeige();
}

// --- Handlungen ------------------------------------------------------------

function eintragen() {
  const stand = lesen();
  const l = sucheSache(stand, ebene.id);
  if (!l) return;
  const id = neueId('e');
  const tag = ebene.tag;
  const g = R.leseZahl(ebene.gramm || '');
  if (Number.isFinite(l.kcal100) && l.kcal100 !== null && Number.isFinite(g) && g > 0 && g <= 5000) {
    const w = R.fuerGramm(l, g);
    aendern((s) => {
      (s.tage[tag] ||= []).push({ id, f: l.id, n: l.n, p: `${R.zahl(g)} g`, m: 1, kcal: w.kcal, kh: Math.round(w.kh), ei: Math.round(w.ei), z: ebene.z });
    });
    ebene = { art: 'suche', tag, z: ebene.z, q: '', bereich: null, zuletzt: `${R.zahl(g)} g ${l.n} (${R.zahl(w.kcal)} kcal) eingetragen – noch etwas?` };
    zeige();
    return;
  }
  aendern((s) => {
    (s.tage[tag] ||= []).push({ id, f: l.id, n: l.n, p: l.p || '', m: ebene.m, kcal: l.kcal, kh: l.kh || 0, ei: l.ei || 0, z: ebene.z });
  });
  const text = `${ebene.m !== 1 ? `${R.menge(ebene.m)} × ` : ''}${l.n} (${R.zahl(R.kcalVon({ kcal: l.kcal, m: ebene.m }))} kcal) eingetragen – noch etwas?`;
  ebene = { art: 'suche', tag, z: ebene.z, q: '', bereich: null, zuletzt: text };
  zeige();
}

function eigenEintragen() {
  const name = $('#eigen-name').value.trim() || 'Eigenes Essen';
  const kcal = R.leseZahl($('#eigen-kcal').value);
  const khText = $('#eigen-kh').value.trim();
  const eiText = $('#eigen-ei')?.value.trim() || '';
  const ei = eiText ? R.leseZahl(eiText) : 0;
  if (!Number.isFinite(ei) || ei < 0 || ei > 500) {
    $('#eigen-fehler').textContent = 'Eiweiß bitte als Zahl – oder leer lassen.';
    return;
  }
  const kh = khText ? R.leseZahl(khText) : 0;
  const fehler = $('#eigen-fehler');
  if (!Number.isFinite(kcal) || kcal < 0 || kcal > 6000) {
    fehler.textContent = 'Bitte die Kalorien als Zahl eintragen (z. B. 650).';
    $('#eigen-kcal').focus();
    return;
  }
  if (!Number.isFinite(kh) || kh < 0 || kh > 1000) {
    fehler.textContent = 'Kohlenhydrate bitte als Zahl – oder leer lassen.';
    return;
  }
  const merken = $('#eigen-merken').checked;
  const tag = ebene.tag;
  const z = ebene.z;
  const sacheId = merken ? neueId('eigen') : null;
  const pro100 = R.leseZahl($('#eigen-100')?.value || '');
  const gramm = R.leseZahl($('#eigen-g')?.value || '');
  const mit100 = Number.isFinite(pro100) && pro100 >= 0 && pro100 <= 950 && Number.isFinite(gramm) && gramm > 0;
  aendern((s) => {
    if (merken) {
      s.eigene.unshift({
        id: sacheId, n: name, p: mit100 ? `${R.zahl(gramm)} g` : '', kcal: Math.round(kcal), kh: Math.round(kh), ei: Math.round(ei),
        ...(mit100 ? { kcal100: Math.round(pro100), kh100: Math.round((kh / gramm) * 1000) / 10, ei100: Math.round((ei / gramm) * 1000) / 10, g: Math.round(gramm) } : {}),
      });
    }
    (s.tage[tag] ||= []).push({ id: neueId('e'), f: sacheId, n: name, p: '', m: 1, kcal: Math.round(kcal), kh: Math.round(kh), ei: Math.round(ei), z });
  });
  ebene = { art: 'suche', tag, z, q: '', bereich: null, zuletzt: `${name} (${R.zahl(kcal)} kcal) eingetragen – noch etwas?` };
  zeige();
}

function umrechnen() {
  const pro100 = R.leseZahl($('#eigen-100').value);
  const g = R.leseZahl($('#eigen-g').value);
  const ziel = $('#eigen-rechnung');
  if (Number.isFinite(pro100) && Number.isFinite(g) && g > 0) {
    const kcal = Math.round((pro100 * g) / 100);
    $('#eigen-kcal').value = String(kcal);
    ziel.textContent = `${String(pro100).replace('.', ',')} kcal × ${String(g).replace('.', ',')} g ÷ 100 = ${R.zahl(kcal)} kcal – oben eingetragen.`;
  } else {
    ziel.textContent = '';
  }
}

function haferMahlzeit(i) {
  const tag = zustand.tag || heute();
  const m = R.HAFER_MAHLZEITEN[i];
  const l = NACH_ID.get(m.f);
  let weg = null;
  aendern((s) => {
    const liste = s.tage[tag] || [];
    const da = liste.find((e) => e.h === i);
    if (da) {
      weg = da;
      s.tage[tag] = liste.filter((e) => e !== da);
      if (!s.tage[tag].length) delete s.tage[tag];
    } else {
      (s.tage[tag] ||= []).push({ id: neueId('h'), f: l.id, n: l.n, p: l.p, m: 1, kcal: l.kcal, kh: l.kh, ei: l.ei || 0, z: m.z, h: i });
    }
  });
  zeige();
  if (!weg && R.haferFertig(lesen(), tag)) meldung('Hafertag geschafft – stark! 🌾');
}

function haferTag(tag) {
  const vorher = lesen().hafer;
  const spanne = (a, b) => (a === b ? R.datumKurz(a) : `${R.datumKurz(a)} bis ${R.datumKurz(b)}`);
  const zurueck = () => { aendern((s) => { s.hafer.tage = vorher.tage; }); zeige(); };
  if (vorher.art === 'amStueck') {
    // Am Stück: ein Tipp trägt die ganze Runde ein – und nimmt sie ganz heraus.
    const block = R.haferBloecke(vorher.tage).find((b) => b.anfang <= tag && tag <= b.ende);
    const neu = block ? R.blockAb(block.anfang, block.laenge) : R.blockAb(tag, vorher.amStueck);
    aendern((s) => {
      s.hafer.tage = block
        ? s.hafer.tage.filter((t) => !neu.includes(t))
        : [...new Set([...s.hafer.tage, ...neu])].sort();
    });
    zeige();
    meldung(block
      ? `Hafertage ${spanne(neu[0], neu[neu.length - 1])} herausgenommen.`
      : `Hafertage ${spanne(neu[0], neu[neu.length - 1])} eingetragen.`, zurueck);
    return;
  }
  let jetzt = false;
  aendern((s) => {
    if (s.hafer.tage.includes(tag)) s.hafer.tage = s.hafer.tage.filter((t) => t !== tag);
    else { s.hafer.tage = [...s.hafer.tage, tag].sort(); jetzt = true; }
  });
  zeige();
  meldung(jetzt ? `${R.datumKurz(tag)} ist Hafertag.` : `${R.datumKurz(tag)} ist kein Hafertag mehr.`, zurueck);
}

function herunterladen(name, text, typ) {
  const blob = new Blob([text], { type: typ });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

function sichern() {
  const h = heute();
  const stand = aendern((s) => { s.sicherung = h; delete s.hinweise.sicherungSpaeter; });
  herunterladen(`mahlzeit-sicherung-${h}.json`, R.sicherungText(stand, h), 'application/json');
  zeige();
  meldung('Sicherung gespeichert – sie liegt bei deinen Downloads.');
}

function einlesen(datei) {
  const leser = new FileReader();
  leser.onload = () => {
    try {
      const neu = R.sicherungLesen(String(leser.result));
      const tage = R.tageMitEintraegen(neu);
      if (!confirm(`Sicherung einlesen (${tage} Tage mit Einträgen)? Was jetzt in der App steht, wird ersetzt.`)) return;
      aendern((s) => { Object.keys(s).forEach((k) => delete s[k]); Object.assign(s, neu); });
      zeige();
      meldung('Sicherung eingelesen.');
    } catch (e) {
      alert(e.message);
    }
  };
  leser.readAsText(datei);
}

function wertEintragen(art) {
  const h = heute();
  const feld = $(`#w-${art}`);
  const lesen = { schlaf: R.leseSchlaf, schritte: R.leseSchritte }[art] || R.leseZahl;
  let wert = lesen(feld.value);
  const grenzen = {
    gewicht: [30, 300, 'Gewicht bitte in kg, z. B. 98,4'],
    zucker: [20, 600, 'Blutzucker bitte in mg/dl, z. B. 120'],
    hba1c: [3, 20, 'HbA1c bitte in Prozent, z. B. 7,2'],
    schlaf: [30, 1200, 'Schlaf bitte so, wie die Uhr ihn zeigt, z. B. 7:30 oder 7,5'],
    schritte: [1, 150000, 'Schritte bitte als Zahl, z. B. 6.500'],
  };
  if (art === 'zucker' && Number.isFinite(wert)) {
    const mgdl = R.vielleichtMmol(wert);
    if (mgdl) {
      if (!confirm(`${String(wert).replace('.', ',')} sieht nach mmol/l aus. In mg/dl sind das ${mgdl}. Als ${mgdl} mg/dl speichern?`)) return;
      wert = mgdl;
    }
  }
  const [min, max, text] = grenzen[art];
  if (!Number.isFinite(wert) || wert < min || wert > max) {
    meldung(text);
    feld.focus();
    return;
  }
  const tag = art === 'hba1c' ? ($('#w-hba1c-tag').value || h) : h;
  const d = new Date();
  const uhr = art === 'zucker' ? `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` : '';
  aendern((s) => {
    if (['gewicht', 'schlaf', 'schritte'].includes(art)) s.werte = s.werte.filter((w) => !(w.art === art && w.tag === tag));
    const w = { id: neueId('w'), art, tag, wert: ['schlaf', 'schritte'].includes(art) ? Math.round(wert) : Math.round(wert * 10) / 10 };
    if (uhr) w.uhr = uhr;
    if (art === 'zucker') w.wann = zustand.zuckerWann || (d.getHours() < 10 ? 'nuechtern' : 'sonst');
    s.werte.push(w);
  });
  zeige();
  meldung('Eingetragen.');
}

function radEintragen() {
  const min = R.leseZahl($('#rad-min').value);
  if (!Number.isInteger(min) || min < 1 || min > 300) {
    meldung('Bitte die Minuten als ganze Zahl, z. B. 30.');
    return;
  }
  const stufe = zustand.radStufe || 'mittel';
  aendern((s) => { s.sport.log.push({ tag: heute(), art: 'rad', min, stufe }); });
  zeige();
  meldung(`${min} Minuten Rad eingetragen. 🚲`);
}

function wertWeg(id) {
  let alt = null;
  aendern((s) => {
    alt = s.werte.find((w) => w.id === id) || null;
    s.werte = s.werte.filter((w) => w.id !== id);
  });
  zeige();
  if (alt) meldung('Gelöscht.', () => { aendern((s) => { s.werte.push(alt); }); zeige(); });
}

// --- Ernährungsprotokoll (v16) -----------------------------------------------

/*
 * Uwe: „Gibt es eine Möglichkeit das ich die eingetragenen Lebensmittel pro
 * Tag irgendwie auslesen kann? … für die Ernährungsberatung“. Die Ebene zeigt
 * das Protokoll, „Teilen“ gibt es als Text weiter (WhatsApp, Mail), „Drucken /
 * PDF“ druckt nur das Protokoll (styles.css, @media print). Geht ohne Netz.
 */
const PROTOKOLL_ZEITRAUM = [{ z: '7', n: 'Letzte 7 Tage', tage: 7 }, { z: '14', n: '14 Tage', tage: 14 }, { z: '30', n: '30 Tage', tage: 30 }];

function protokollSpanne() {
  const h = heute();
  const tage = PROTOKOLL_ZEITRAUM.find((x) => x.z === ebene.zeitraum)?.tage || 7;
  return { von: R.plusTage(h, -(tage - 1)), bis: h };
}

function protokollHtml(stand) {
  const { von, bis } = protokollSpanne();
  const tage = R.protokollTage(stand, von, bis);
  return `
    <div class="ebene-kopf">
      <button type="button" class="rund" data-tun="ebene-zu" aria-label="Schließen">✕</button>
      <h2>Ernährungsprotokoll</h2>
    </div>
    <div class="ebene-inhalt protokoll">
      <div class="chips nicht-drucken" role="group" aria-label="Zeitraum">${PROTOKOLL_ZEITRAUM.map((x) => `<button type="button" class="chip" data-tun="protokoll-zeitraum" data-z="${x.z}" aria-pressed="${ebene.zeitraum === x.z}">${x.n}</button>`).join('')}</div>
      <div class="reihe nicht-drucken">
        <button type="button" class="knopf haupt" data-tun="protokoll-teilen" id="protokoll-teilen" ${tage.length ? '' : 'disabled'}>📤 Teilen</button>
        <button type="button" class="knopf" data-tun="protokoll-drucken" id="protokoll-drucken" ${tage.length ? '' : 'disabled'}>🖨️ Drucken / PDF</button>
      </div>
      <p class="klein leise nicht-drucken">„Teilen“ schickt es als Text, etwa per WhatsApp oder Mail. „Drucken / PDF“: auf dem iPhone im Druckfenster auf das Teilen-Symbol – dann ist es ein PDF.</p>
      <div class="druck" id="protokoll">
        <h2 class="nur-drucken">Ernährungsprotokoll</h2>
        <p class="leise" id="protokoll-spanne">${esc(R.datumLang(von))} bis ${esc(R.datumLang(bis))}</p>
        ${tage.length ? tage.map((t) => `<section class="protokoll-tag">
          <h3>${esc(R.datumLang(t.tag))}${t.hafer ? ' · 🌾 Hafertag' : ''}</h3>
          ${t.zeiten.map((z) => `<h4>${esc(z.n)}</h4><ul>${z.eintraege.map((e) => `<li><span>${esc(e.text)}</span><span class="wert">${R.zahl(e.kcal)} kcal</span></li>`).join('')}</ul>`).join('')}
          <p class="protokoll-summe"><strong>${R.zahl(t.summe.kcal)} kcal</strong> · ${R.zahl(t.summe.kh)} g Kohlenhydrate · ${R.zahl(t.summe.ei)} g Eiweiß</p>
          ${t.werte.length ? `<p class="klein">${esc(t.werte.join(' · '))}</p>` : ''}
        </section>`).join('') : '<p id="protokoll-leer">In dieser Zeit ist nichts eingetragen.</p>'}
        <p class="klein leise">Die kcal sind Richtwerte aus der App „Mahlzeit“.</p>
      </div>
    </div>`;
}

async function protokollTeilen() {
  const { von, bis } = protokollSpanne();
  const text = R.protokollText(lesen(), von, bis);
  if (navigator.share) {
    try { await navigator.share({ title: 'Ernährungsprotokoll', text }); return; } catch (e) { if (e?.name === 'AbortError') return; }
  }
  try {
    await navigator.clipboard.writeText(text);
    meldung('Kopiert – jetzt in WhatsApp oder in eine Mail einfügen.');
  } catch {
    meldung('Teilen geht hier nicht – „Drucken / PDF“ nehmen.');
  }
}

// --- Uhr (v10) ---------------------------------------------------------------

/*
 * Schlaf und Schritte von Uwes Uhr über einen Kurzbefehl, den Tobi auf dem
 * iPhone einrichtet (js/uhr.js, supabase/functions/mahlzeit-uhr). Die
 * Anleitung steht hier, für Tobi – die Namen so, wie sie in der deutschen
 * Kurzbefehle-App heißen.
 */
function uhrStatusHtml(stand) {
  if (!stand.uhr) {
    return `<p>Schlaf und Schritte von der Uhr landen von selbst unter „Werte“. ${geraet() === 'ios' ? 'Einrichten muss das einmal Tobi an deinem Handy – etwa zehn Minuten.' : 'Das geht nur mit dem iPhone (über Apple Health).'}</p>
      <button type="button" class="knopf" data-tun="uhr-einrichten" id="uhr-einrichten">Tobi richtet ein</button>`;
  }
  const z = UHR.zuletztGeholt();
  return `<p id="uhr-stand">${z.angekommen ? `Verbunden. Zuletzt angekommen: <strong>${esc(zeitText(z.angekommen))}</strong>.` : 'Eingerichtet, aber noch nichts angekommen.'}</p>
    <div class="reihe"><button type="button" class="knopf leise" data-tun="uhr-einrichten">Anleitung für Tobi</button>
    <button type="button" class="knopf leise" data-tun="uhr-trennen">Trennen</button></div>`;
}

/** „heute, 09:31“ / „gestern, 21:30“ / „Mi, 19.11., 09:30“ */
function zeitText(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const tag = R.tagVon(d);
  const uhr = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  const h = heute();
  const gestern = R.plusTage(h, -1);
  return `${tag === h ? 'heute' : tag === gestern ? 'gestern' : R.datumKurz(tag)}, ${uhr}`;
}

function uhrEinrichten() {
  if (!lesen().uhr) aendern((s) => { s.uhr = { k: UHR.neuerSchluessel() }; });
  oeffneEbene({ art: 'uhr', status: '' });
}

function uhrHtml(stand) {
  const adresse = UHR.senderAdresse(stand.uhr?.k || '');
  const v = (name) => `<span class="var">${name}</span>`;
  return `
    <div class="ebene-kopf">
      <button type="button" class="rund" data-tun="ebene-zu" aria-label="Schließen">✕</button>
      <h2>Für Tobi: Uhr verbinden</h2>
    </div>
    <div class="ebene-inhalt anleitung">
      <p class="karte hinweis">Uwe, gib das Handy jetzt Tobi. 🙂 Danach kommen Schlaf und Schritte von selbst – zweimal am Tag.</p>
      <p>Die Uhr muss ihre Daten an <strong>Apple Health</strong> geben (in ihrer App unter Einstellungen → Apple Health/Health verbinden; bei der Apple Watch von selbst). Dann ein Kurzbefehl, der sie hierher schickt:</p>
      <h3>1. Diese Adresse kopieren</h3>
      <p class="adresse" id="uhr-adresse">${esc(adresse)}</p>
      <button type="button" class="knopf haupt" data-tun="uhr-kopieren" id="uhr-kopieren">Adresse kopieren</button>
      <h3>2. Kurzbefehl bauen</h3>
      <p class="klein">In der App <strong>Kurzbefehle</strong> (blau-rosa Symbol; fehlt sie: im App Store „Kurzbefehle“ laden).</p>
      <ol class="schritte">
        <li>Unten <strong>„Kurzbefehle“</strong>, oben rechts <strong>„+“</strong>. Oben auf den Namen tippen → <strong>„Umbenennen“</strong> → <code>Mahlzeit Uhr</code>.</li>
        <li><strong>Schlaf:</strong> Im Suchfeld <code>Health-Samples suchen</code> → antippen. In der Aktion bei <strong>Typ</strong> <strong>„Schlafanalyse“</strong> wählen. <strong>„Filter hinzufügen“</strong> → <strong>„Startdatum“ · „ist in den letzten“ · 2 · „Tage“</strong>.</li>
        <li>Im Suchfeld <code>Wiederholen mit jedem</code> → antippen.</li>
        <li><code>Text</code> → antippen. Die Aktion muss <em>zwischen</em> „Wiederholen mit jedem“ und „Ende der Wiederholung“ stehen – sonst gedrückt halten und hineinziehen.</li>
        <li>In das Textfeld tippen, über der Tastatur ${v('Wiederholungsobjekt')} antippen. Dann das blaue ${v('Wiederholungsobjekt')} im Text antippen → <strong>„Wert“</strong>. Dahinter ein <code>|</code> tippen (Taste <strong>„#+=“</strong>).</li>
        <li>Wieder ${v('Wiederholungsobjekt')} einfügen, antippen → <strong>„Startdatum“</strong>, darunter <strong>Datumsformat „ISO 8601“</strong> und <strong>„Zeit einschließen“ an</strong>. Ein <code>|</code>. Noch einmal ${v('Wiederholungsobjekt')} → <strong>„Enddatum“</strong>, ebenso ISO 8601 mit Zeit.<small>Im Feld steht dann: Wert|Startdatum|Enddatum</small></li>
        <li><em>Unter</em> „Ende der Wiederholung“: <code>Text kombinieren</code> → es nimmt ${v('Wiederholungsergebnisse')}. Bei „mit“ <strong>„Neue Zeile“</strong> wählen.</li>
        <li><strong>Schritte:</strong> Punkt 2 bis 7 noch einmal, mit diesen Unterschieden: Typ <strong>„Schritte“</strong>, dazu in der Aktion <strong>„Gruppieren nach“ · „Tag“</strong> (ggf. erst „Mehr anzeigen“). Im Text nur ${v('Wiederholungsobjekt')} → <strong>„Startdatum“</strong> (ISO 8601, Zeit an), <code>|</code>, ${v('Wiederholungsobjekt')} → <strong>„Wert“</strong>.</li>
        <li><code>Inhalte von URL abrufen</code> → antippen. Auf <strong>„URL“</strong> tippen und die kopierte Adresse einfügen. Auf den Pfeil <strong>›</strong> tippen: <strong>Methode „POST“</strong>, <strong>Anfragetext „JSON“</strong>.</li>
        <li><strong>„Neues Feld hinzufügen“ → „Text“</strong>: Schlüssel <code>schlaf</code>, Wert: über der Tastatur <strong>„Variable auswählen“</strong> und die <em>erste</em> Aktion „Text kombinieren“ antippen. Noch ein Feld: <code>schritte</code> → die <em>zweite</em> „Text kombinieren“.</li>
        <li>Unten rechts <strong>▶</strong> tippen. Health fragt nach Zugriff: <strong>Schlaf und Schritte erlauben</strong>. Fragt das iPhone, ob es an „supabase.co“ senden darf: <strong>„Immer erlauben“</strong>.</li>
      </ol>
      <h3>3. Nachsehen</h3>
      <p id="uhr-status" role="status">${esc(ebene.status || '')}</p>
      <button type="button" class="knopf" data-tun="uhr-nachsehen" id="uhr-nachsehen">Ist etwas angekommen?</button>
      <h3>4. Zweimal am Tag von selbst</h3>
      <ol class="schritte">
        <li>In Kurzbefehle unten <strong>„Automation“</strong> → <strong>„+“</strong> (oder „Neue Automation“) → <strong>„Tageszeit“</strong>.</li>
        <li><strong>09:30</strong>, <strong>„Täglich“</strong>, <strong>„Sofort ausführen“</strong> wählen, „Bei Ausführung benachrichtigen“ aus → <strong>„Weiter“</strong> → <strong>„Mahlzeit Uhr“</strong>.</li>
        <li>Dasselbe noch einmal für <strong>21:30</strong>.</li>
      </ol>
      <p class="klein leise">Ist das Handy zu der Zeit gesperrt, lässt iOS den Kurzbefehl nicht an Health – dann holt es der nächste Lauf nach (er schickt immer zwei Tage). Kommt trotzdem tagelang nichts an: statt „Tageszeit“ den Auslöser <strong>„App“ → eine App, die Uwe täglich öffnet → „Wird geöffnet“ → „Sofort ausführen“</strong>.</p>
      <p class="klein leise">Was ankommt, liegt in Tobis Datenbank (Supabase) – Uwe ist damit einverstanden. Trennen unter „Mehr“.</p>
      <button type="button" class="knopf haupt gross-knopf" data-tun="ebene-zu">Fertig</button>
    </div>`;
}

let uhrLaeuft = false;
async function uhrHolen({ immer = false } = {}) {
  const k = lesen().uhr?.k;
  if (!k || uhrLaeuft) return;
  uhrLaeuft = true;
  if (immer && ebene?.art === 'uhr') { ebene.status = 'Sehe nach …'; zeigeEbene(); }
  const daten = await UHR.holen(k, { heute: heute(), immer });
  uhrLaeuft = false;
  let neu = 0;
  if (daten) aendern((s) => { neu = UHR.uebernehmen(s, daten.werte, () => neueId('w')); });
  if (immer && ebene?.art === 'uhr') {
    const st = lesen();
    const letzt = (art) => R.werteVon(st, art).filter((w) => w.quelle === 'uhr').at(-1);
    const sl = letzt('schlaf');
    const sr = letzt('schritte');
    ebene.status = !daten
      ? 'Keine Verbindung. Ist das Handy online?'
      : !daten.zuletzt
        ? 'Noch nichts angekommen. Den Kurzbefehl einmal mit ▶ ausführen, dann noch mal nachsehen.'
        : `✓ Angekommen (${zeitText(daten.zuletzt)}).${sl ? ` Schlaf ${R.datumKurz(sl.tag)}: ${R.dauerText(sl.wert)}.` : ' Noch kein Schlaf – Typ „Schlafanalyse“ und „Zeit einschließen“ prüfen.'}${sr ? ` Schritte ${R.datumKurz(sr.tag)}: ${R.zahl(sr.wert)}.` : ''}`;
    zeigeEbene();
  } else if (neu && !ebene) zeige();
}

// --- Ereignisse ------------------------------------------------------------

document.addEventListener('click', (ev) => {
  const el = ev.target.closest('[data-tun]');
  if (!el || el.disabled) return;
  const tun = el.dataset.tun;
  const h = heute();
  switch (tun) {
    case 'seite': wechsle(el.dataset.seite); break;
    case 'tag': {
      const neu = R.plusTage(zustand.tag || h, Number(el.dataset.schritt));
      zustand.tag = neu >= h ? null : neu;
      zeige();
      break;
    }
    case 'essen': oeffneEssen(); break;
    case 'ebene-zu': schliesseEbene(); break;
    case 'uhr-einrichten': uhrEinrichten(); break;
    case 'protokoll': oeffneEbene({ art: 'protokoll', zeitraum: '7' }); break;
    case 'wie-vorher': wieVorherEintragen(el.dataset.z, el.dataset.quelle); break;
    case 'protokoll-zeitraum': ebene.zeitraum = el.dataset.z; zeigeEbene(); break;
    case 'protokoll-teilen': protokollTeilen(); break;
    case 'protokoll-drucken': window.print(); break;
    case 'uhr-kopieren': {
      const k = lesen().uhr?.k;
      if (!k) break;
      const adresse = UHR.senderAdresse(k);
      if (navigator.clipboard?.writeText) navigator.clipboard.writeText(adresse).then(() => meldung('Adresse kopiert.'), () => meldung(adresse));
      else meldung(adresse);
      break;
    }
    case 'uhr-nachsehen': uhrHolen({ immer: true }); break;
    case 'uhr-trennen':
      if (confirm('Die Uhr trennen? Was schon da ist, bleibt. Den Kurzbefehl „Mahlzeit Uhr“ dann in der App Kurzbefehle löschen.')) {
        aendern((s) => { delete s.uhr; });
        zeige();
        meldung('Getrennt.');
      }
      break;
    case 'bereich':
      ebene.bereich = el.dataset.bereich || null;
      ebene.zuletzt = null;
      zeigeEbene();
      $('#ebene').scrollTo(0, 0);
      break;
    case 'sache':
      ebene = { ...ebene, art: 'sache', id: el.dataset.id, m: 1 };
      zeigeEbene();
      $('#ebene').scrollTo(0, 0);
      break;
    case 'zurueck-suche':
      ebene = { ...ebene, art: 'suche', zuletzt: null };
      zeigeEbene();
      break;
    case 'menge': ebene.m = Number(el.dataset.m); ebene.gramm = ''; zeigeEbene(); break;
    case 'zeit': {
      ebene.z = el.dataset.z;
      if (ebene.art === 'eigen') {
        // Das Formular nicht neu zeichnen – sonst wären die Eingaben weg.
        el.parentElement.querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-pressed', String(c === el)));
      } else zeigeEbene();
      break;
    }
    case 'eintragen': eintragen(); break;
    case 'eigen': kameraAus(); ebene = { ...ebene, art: 'eigen', nichtGefunden: null }; zeigeEbene(); break;
    case 'scan': oeffneScan(); break;
    case 'scan-neu': oeffneScan(); break;
    case 'rezept': oeffneRezept('rezept'); break;
    case 'netz-suche': oeffneRezept('suche', { text: ebene.q.trim() }); break;
    case 'packung-foto': oeffneRezept('packung', { ean: ebene.nichtGefunden?.code || '' }); break;
    case 'rezept-art': ebene.hinweis = el.dataset.art; ebene.text = $('#rezept-text')?.value ?? ebene.text; ebene.fehler = ''; zeigeEbene(); break;
    case 'rezept-portionen':
      ebene.portionen = Number(el.dataset.n) || null;
      ebene.text = $('#rezept-text')?.value ?? ebene.text;
      el.parentElement.querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-pressed', String(c === el)));
      break;
    case 'foto-weg': {
      const [weg] = ebene.bilder.splice(Number(el.dataset.i), 1);
      if (weg) URL.revokeObjectURL(weg.url);
      ebene.text = $('#rezept-text')?.value ?? ebene.text;
      zeigeEbene();
      break;
    }
    case 'ausrechnen': ausrechnen(); break;
    case 'zurueck-rezept': ebene = { ...ebene, art: 'rezept', laeuft: false }; zeigeEbene(); break;
    case 'erg-portionen':
      ebene.portionen = Number(el.dataset.n);
      ebene.name = $('#erg-name')?.value ?? ebene.name;
      zeigeEbene();
      break;
    case 'erg-speichern': ergebnisSpeichern(!!el.dataset.eintragen); break;
    case 'tobi-fragen': tobiFragen(); break;
    case 'code-einfuegen': codeEinfuegen(el); break;
    case 'ki-code-weg':
      if (confirm('Den Freischalt-Code von diesem Handy entfernen? Die KI geht dann erst wieder mit dem Code.')) {
        K.kiCodeWeg();
        zeige();
      }
      break;
    case 'code-kopieren': {
      const code = K.kiCode();
      if (!code) break;
      if (navigator.clipboard?.writeText) navigator.clipboard.writeText(code).then(() => meldung('Code kopiert.'), () => meldung(code));
      else meldung(code);
      break;
    }
    case 'bearbeiten': {
      const tag = zustand.tag || h;
      const e = (lesen().tage[tag] || []).find((x) => x.id === el.dataset.id);
      if (e) oeffneEbene({ art: 'bearbeiten', tag, id: e.id, m: e.m, z: e.z || 'mittags' });
      break;
    }
    case 'speichern': {
      const { tag, id, m, z } = ebene;
      aendern((s) => {
        const e = (s.tage[tag] || []).find((x) => x.id === id);
        if (e) { e.m = m; e.z = z; }
      });
      schliesseEbene();
      meldung('Gespeichert.');
      break;
    }
    case 'loeschen': {
      const { tag, id } = ebene;
      let alt = null;
      let stelle = -1;
      aendern((s) => {
        const liste = s.tage[tag] || [];
        stelle = liste.findIndex((x) => x.id === id);
        if (stelle >= 0) [alt] = liste.splice(stelle, 1);
        if (!liste.length) delete s.tage[tag];
      });
      schliesseEbene();
      if (alt) {
        meldung(`${alt.n} gelöscht.`, () => {
          aendern((s) => { (s.tage[tag] ||= []).splice(stelle, 0, alt); });
          zeige();
        });
      }
      break;
    }
    case 'rueckgaengig': {
      const fn = rueckgaengig;
      rueckgaengig = null;
      $('#meldung').classList.remove('sichtbar');
      if (fn) fn();
      break;
    }
    case 'hinweis-weg':
      aendern((s) => { s.hinweise[el.dataset.hinweis] = h; });
      zeige();
      break;
    case 'hafer-mahlzeit': haferMahlzeit(Number(el.dataset.i)); break;
    case 'hafer-tag': haferTag(el.dataset.tag); break;
    case 'sport-geraet':
    case 'sport-beschwerde': {
      const feld = tun === 'sport-geraet' ? 'geraete' : 'beschwerden';
      const w = el.dataset.wert;
      aendern((s) => { s.sport[feld] = s.sport[feld].includes(w) ? s.sport[feld].filter((x) => x !== w) : [...s.sport[feld], w]; });
      zeige();
      break;
    }
    case 'sport-kg': {
      const kg = Number(el.dataset.wert);
      aendern((s) => { s.sport.hanteln = s.sport.hanteln.includes(kg) ? s.sport.hanteln.filter((x) => x !== kg) : [...s.sport.hanteln, kg].sort((a, b) => a - b); });
      zeige();
      break;
    }
    case 'sport-oft':
      aendern((s) => { s.sport.kraftProWoche = Number(el.dataset.wert); });
      zeige();
      break;
    case 'sport-fertig': {
      const sp = lesen().sport;
      if (sp.geraete.includes('hanteln') && !sp.hanteln.length) {
        $('#sport-fehler').textContent = 'Welche Hanteln hast du? Bitte die Gewichte antippen – oder die Kurzhanteln abwählen.';
        break;
      }
      aendern((s) => { s.sport.eingerichtet = true; });
      zustand.sportEinrichten = false;
      zeige();
      window.scrollTo(0, 0);
      break;
    }
    case 'sport-aendern': zustand.sportEinrichten = true; zeige(); window.scrollTo(0, 0); break;
    case 'training': trainingStarten(el.dataset.typ); break;
    case 'training-weiter': trainingWeiter(!!el.dataset.auslassen); break;
    case 'uhr':
      if (uhr?.fertig) uhrAus();
      uhrStarten();
      break;
    case 'urteil':
      ebene.urteil[ebene.liste[ebene.i]] = el.dataset.urteil;
      el.parentElement.querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-pressed', String(c === el)));
      break;
    case 'rad-stufe':
      zustand.radStufe = el.dataset.stufe;
      el.parentElement.querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-pressed', String(c === el)));
      break;
    case 'meldung':
      aendern((s) => { s.meldung = !!el.dataset.an; });
      zeige();
      LZ.essenMelden(lesen(), { tag: heute() });
      break;
    case 'essen-teilen': {
      const an = !!el.dataset.an;
      aendern((s) => { s.essenTeilen = an; });
      zeige();
      meldung(an ? 'Danke – Tobi sieht ab jetzt auch, was du isst.' : 'Alles klar – was du isst, bleibt bei dir.');
      // Gleich schicken bzw. löschen; ohne Netz kommt es beim nächsten Mal.
      LZ.essenMelden(lesen(), { tag: heute() });
      break;
    }
    case 'hafer-oft':
      aendern((s) => { s.hafer.proMonat = Number(el.dataset.n); });
      zeige();
      break;
    case 'hafer-art':
      aendern((s) => { s.hafer.art = el.dataset.art || null; });
      zeige();
      $('#hafer-plan')?.scrollIntoView({ block: 'start' });
      break;
    case 'hafer-stueck':
      aendern((s) => { s.hafer.amStueck = Number(el.dataset.n); });
      zeige();
      break;
    case 'hafer-alle':
      aendern((s) => { s.hafer.alleMonate = Number(el.dataset.n); });
      zeige();
      break;
    case 'installieren': {
      const angebot = installAngebot;
      if (!angebot) break;
      angebot.prompt();
      angebot.userChoice.then((wahl) => {
        installAngebot = null;
        if (wahl?.outcome !== 'accepted') zeige();
      }).catch(() => {});
      break;
    }
    case 'link-kopieren': {
      const link = location.href.split('#')[0];
      const fertig = () => meldung('Link kopiert – jetzt Safari öffnen, oben ins Adressfeld tippen und einfügen.');
      if (navigator.clipboard?.writeText) navigator.clipboard.writeText(link).then(fertig, () => meldung(link));
      else meldung(link);
      break;
    }
    case 'install-spaeter':
      aendern((s) => { s.hinweise.installSpaeter = h; });
      zeige();
      break;
    case 'monat': zustand.monat += Number(el.dataset.schritt); zeige(); break;
    case 'ics': {
      const tage = lesen().hafer.tage.filter((t) => t >= h);
      herunterladen('hafertage.ics', R.haferIcs(tage), 'text/calendar');
      meldung('Kalenderdatei gespeichert – antippen, dann übernimmt sie der Kalender.');
      break;
    }
    case 'zucker-wann':
      zustand.zuckerWann = el.dataset.wann;
      el.parentElement.querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-pressed', String(c === el)));
      break;
    case 'wert-weg': wertWeg(el.dataset.id); break;
    case 'ziel': {
      const z = el.dataset.ziel ? Number(el.dataset.ziel) : null;
      aendern((s) => { s.ziel = z; });
      zeige();
      break;
    }
    case 'ziel-eigen': {
      const alt = lesen().ziel;
      const antwort = prompt('Wie viele kcal am Tag?', alt ? String(alt) : '');
      if (antwort === null) break;
      const z = R.leseZahl(antwort);
      if (!Number.isFinite(z) || z < 800 || z > 6000) { meldung('Bitte eine Zahl zwischen 800 und 6.000.'); break; }
      aendern((s) => { s.ziel = Math.round(z); });
      zeige();
      break;
    }
    case 'eigen-weg': {
      let alt = null;
      aendern((s) => {
        alt = s.eigene.find((e) => e.id === el.dataset.id) || null;
        s.eigene = s.eigene.filter((e) => e.id !== el.dataset.id);
      });
      zeige();
      if (alt) meldung(`${alt.n} vergessen.`, () => { aendern((s) => { s.eigene.unshift(alt); }); zeige(); });
      break;
    }
    case 'sichern': sichern(); break;
    case 'sicherung-spaeter':
      aendern((s) => { s.hinweise.sicherungSpaeter = h; });
      zeige();
      break;
    case 'alles-loeschen':
      if (confirm('Wirklich alles löschen – Einträge, Hafertage, Werte und Einstellungen? Das lässt sich nicht rückgängig machen.')) {
        allesLoeschen();
        zustand.tag = null;
        wechsle('heute');
        meldung('Alles gelöscht.');
      }
      break;
    default: break;
  }
});

document.addEventListener('input', (ev) => {
  if (ev.target.id === 'suche' && ebene) {
    ebene.q = ev.target.value;
    ebene.bereich = null;
    ebene.zuletzt = null;
    const banner = $('#eingetragen');
    if (banner) banner.remove();
    $('#treffer').innerHTML = trefferHtml(lesen());
  } else if (ev.target.id === 'eigen-100' || ev.target.id === 'eigen-g') {
    umrechnen();
  } else if (ev.target.id === 'gramm' && ebene?.art === 'sache') {
    // Live rechnen, ohne neu zu zeichnen – sonst wäre die Tastatur weg.
    ebene.gramm = ev.target.value;
    const l = sucheSache(lesen(), ebene.id);
    const g = R.leseZahl(ebene.gramm);
    const gut = Number.isFinite(g) && g > 0 && g <= 5000;
    const w = gut ? R.fuerGramm(l, g) : { kcal: R.kcalVon({ kcal: l.kcal, m: ebene.m }), kh: R.khVon({ kh: l.kh, m: ebene.m }), ei: R.eiVon({ ei: l.ei, m: ebene.m }) };
    $('#sache-kcal').textContent = R.zahl(w.kcal);
    const kh = $('#sache-kh');
    if (kh) kh.textContent = naehrText(w);
    document.querySelectorAll('#ebene [data-tun="menge"]').forEach((c) => c.setAttribute('aria-pressed', String(!gut && Number(c.dataset.m) === ebene.m)));
  } else if (ev.target.id === 'rezept-text' && ebene) {
    ebene.text = ev.target.value;
  } else if (ev.target.id === 'erg-name' && ebene) {
    ebene.name = ev.target.value;
  }
});

document.addEventListener('submit', (ev) => {
  const form = ev.target.closest('[data-form]');
  if (!form) return;
  ev.preventDefault();
  if (form.dataset.form === 'eigen') eigenEintragen();
  else if (form.dataset.form === 'ean') strichcodeGefunden($('#ean').value);
  else if (form.dataset.form === 'ki-code') freischalten(form);
  else if (form.dataset.form === 'rad') radEintragen();
  else wertEintragen(form.dataset.form);
});

document.addEventListener('keydown', (ev) => {
  // Enter in der Suche: den ersten Treffer öffnen.
  if (ev.key === 'Enter' && ev.target.id === 'suche') {
    const erster = document.querySelector('#treffer .sache');
    if (erster) { ev.preventDefault(); erster.click(); }
  }
  if (ev.key === 'Escape' && ebene) schliesseEbene();
});

document.addEventListener('change', (ev) => {
  if (ev.target.id === 'einlesen' && ev.target.files?.[0]) {
    einlesen(ev.target.files[0]);
    ev.target.value = '';
  } else if (ev.target.id === 'rezept-foto' && ev.target.files?.[0] && ebene?.art === 'rezept') {
    const datei = ev.target.files[0];
    const meine = ebene;
    meine.text = $('#rezept-text')?.value ?? meine.text;
    K.fotoVorbereiten(datei).then((bild) => {
      if (ebene !== meine) { URL.revokeObjectURL(bild.url); return; }
      meine.bilder.push(bild);
      meine.fehler = '';
      zeigeEbene();
    }, () => { meine.fehler = 'Das Foto ließ sich nicht lesen.'; zeigeEbene(); });
  } else if (ev.target.id === 'scan-foto' && ev.target.files?.[0]) {
    strichcodeFoto(ev.target.files[0]);
  }
});

// Zurück-Taste (Android) schließt die Ebene, statt die App zu verlassen.
window.addEventListener('popstate', () => {
  if (ebene) schliesseEbene({ ausVerlauf: true });
});

// Ein zweiter Tab hat etwas geändert: neu zeichnen.
window.addEventListener('storage', (ev) => {
  if (ev.key === SCHLUESSEL || ev.key === null) zeige();
});

// Lebenszeichen: beim Öffnen (kurz danach) und beim Weglegen, höchstens alle drei Stunden.
const lebenszeichen = () => {
  LZ.melden(lesen(), { tag: heute(), fassung: FASSUNG, alsApp: standalone() });
  LZ.werteMelden(lesen(), { tag: heute() });
  LZ.essenMelden(lesen(), { tag: heute() });
};
setTimeout(lebenszeichen, 4000);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') lebenszeichen(); });
// Ohne Netz bleibt es ungeschickt und kommt nach, sobald wieder Netz da ist (v13, „Offline zuerst“).
window.addEventListener('online', lebenszeichen);

// Ist die KI eingerichtet (v11)? Beim Öffnen nachfragen; ändert sich etwas, neu zeichnen.
setTimeout(() => K.statusHolen().then((anders) => { if (anders && !ebene) zeige(); }), 800);

// Schlaf und Schritte von der Uhr: beim Öffnen und beim Zurückkommen (höchstens alle zehn Minuten).
setTimeout(() => uhrHolen(), 1500);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') uhrHolen(); });

// Über Mitternacht offen geblieben: beim Zurückkommen stimmt „Heute" wieder.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && !ebene) zeige();
  // Die Kamera nicht im Hintergrund laufen lassen; zurück, geht sie wieder an.
  if (document.visibilityState === 'hidden') kameraAus();
  else if (ebene?.art === 'scan' && !ebene.nichtGefunden) zeigeEbene();
});

// --- Offline und Aktualisierung --------------------------------------------

/*
 * Kommt eine neue Fassung, übernimmt ihr Worker sofort (skipWaiting,
 * clients.claim). Dann einmal neu laden, damit Seite und Module aus derselben
 * Fassung stammen – aber nicht mitten im Eintragen: Ist die Ebene offen,
 * wartet das Neuladen, bis sie zu ist.
 */
let neuLaden = false;
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  const warGesteuert = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!warGesteuert || neuLaden) return;
    neuLaden = true;
    if (!ebene) location.reload();
  });
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}

// Der Freischalt-Code aus dem Link („#ki=ABCDE-FGHJK"): merken und aus der
// Adresse nehmen – sonst stünde er in jedem Lesezeichen und Bildschirmfoto.
const ausLink = K.codeAusAdresse(location.hash);
if (ausLink) {
  K.kiCodeSetzen(ausLink);
  history.replaceState(history.state, '', location.pathname + location.search);
  if (K.kiAn()) setTimeout(() => meldung('KI freigeschaltet ✨ – Rezepte und Fotos rechnet jetzt die KI aus.'), 200);
}

zeige();
document.documentElement.dataset.bereit = '1';
