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

export const FASSUNG = 'v1';

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
      ${summe.kh ? `<p class="leise klein">davon etwa ${R.zahl(summe.kh)} g Kohlenhydrate</p>` : ''}
    </section>
    <button type="button" class="knopf haupt gross-knopf" data-tun="essen" id="essen-knopf">＋ Essen eintragen</button>`;

  // Oben, was jetzt zählt (Willkommen, der heutige Hafertag), dann die
  // Einträge, darunter, was warten kann.
  html += kartenOben(stand, tag, h);
  html += eintragsListe(liste);
  html += kartenUnten(stand, tag, h);
  html += wochenKarte(stand, h);
  return html;
}

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
      ${standalone() ? '' : `<p class="klein">📲 Leg die App auf den Startbildschirm: <b>Android</b> Chrome-Menü ⋮ → „Zum Startbildschirm hinzufügen“. <b>iPhone</b> Safari → Teilen → „Zum Home-Bildschirm“.</p>`}
      <button type="button" class="knopf leise" data-tun="hinweis-weg" data-hinweis="willkommen">Alles klar</button>
    </section>`;
  }
  if (R.istHafertag(stand, tag)) html += haferHeute(stand, tag);
  return html;
}

function kartenUnten(stand, tag, h) {
  let html = '';
  if (tag === h && !R.istHafertag(stand, tag) && stand.hafer.proMonat > 0) html += haferVorschau(stand, h);
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
  const naechster = R.naechsterHafertag(stand, h);
  if (naechster) {
    const n = R.abstand(h, naechster);
    const text = n === 1
      ? '<strong>Morgen ist Hafertag.</strong> Haferflocken (225 g) und Gemüsebrühe im Haus?'
      : `Nächster Hafertag: <strong>${esc(R.datumLang(naechster))}</strong> (in ${n} Tagen)`;
    return `<section class="karte hafer-klein" id="hafer-vorschau"><p>🌾 ${text}</p>
      <button type="button" class="knopf leise" data-tun="seite" data-seite="hafer">Hafertage</button></section>`;
  }
  const monat = h.slice(0, 7);
  const geplant = R.haferImMonat(stand, monat).length;
  if (geplant >= stand.hafer.proMonat) return '';
  const name = R.monatsname(Number(monat.slice(5)) - 1);
  return `<section class="karte hafer-klein" id="hafer-vorschau">
    <p>🌾 Hafertage im ${esc(name)}: ${geplant ? `${geplant} von ${stand.hafer.proMonat}` : 'noch keiner geplant'}.</p>
    <button type="button" class="knopf" data-tun="seite" data-seite="hafer">Hafertage planen</button></section>`;
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
    <h4>Wie oft im Monat?</h4>
    <div class="chips" role="group" aria-label="Hafertage im Monat">
      ${[0, 1, 2, 3, 4].map((n) => `<button type="button" class="chip" data-tun="hafer-oft" data-n="${n}" aria-pressed="${stand.hafer.proMonat === n}">${n ? `${n}×` : 'aus'}</button>`).join('')}
    </div>
    <p class="klein">${stand.hafer.proMonat ? `${stand.hafer.proMonat} Hafertag${stand.hafer.proMonat > 1 ? 'e' : ''} im Monat.` : 'Keine Hafertage – die Startseite erinnert nicht daran.'} Die Diabetes-Hilfe beschreibt zwei Wege: regelmäßig 1 bis 4 Hafertage im Monat – oder 2 bis 3 Tage am Stück und das alle paar Monate wiederholen. Was für dich gilt, sagt dein Arzt.</p>
    <h4>Welche Tage?</h4>
    <p class="klein">Tipp auf einen Tag, um ihn als Hafertag einzutragen – noch einmal tippen nimmt ihn wieder heraus.</p>
    <div class="monat-kopf">
      <button type="button" class="rund" data-tun="monat" data-schritt="-1" aria-label="Monat davor" ${zustand.monat <= -6 ? 'disabled' : ''}>‹</button>
      <strong id="monat-name">${esc(R.monatsname(monat))} ${jahr}</strong>
      <button type="button" class="rund" data-tun="monat" data-schritt="1" aria-label="Monat danach" ${zustand.monat >= 12 ? 'disabled' : ''}>›</button>
    </div>
    <table class="monat"><thead><tr>${['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((w) => `<th>${w}</th>`).join('')}</tr></thead><tbody>${wochen}</tbody></table>
    <p id="hafer-zahl">${esc(R.monatsname(monat))}: ${geplant} ${geplant === 1 ? 'Hafertag' : 'Hafertage'} geplant${stand.hafer.proMonat ? ` (Ziel ${stand.hafer.proMonat})` : ''}.</p>
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

// --- Werte -----------------------------------------------------------------

function seiteWerte(stand) {
  const h = heute();
  const gewicht = R.werteVon(stand, 'gewicht');
  const zucker = R.werteVon(stand, 'zucker');
  const hba1c = R.werteVon(stand, 'hba1c');
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
  </section>
  <section class="karte" id="karte-eigene">
    <h3>⭐ Meine eigenen Sachen</h3>
    ${stand.eigene.length ? `<ul class="werteliste">${stand.eigene.map((e) => `<li><span>${esc(e.n)}${e.p ? ` <small>${esc(e.p)}</small>` : ''}</span><span class="wert">${R.zahl(e.kcal)} kcal</span>
      <button type="button" class="weg" data-tun="eigen-weg" data-id="${esc(e.id)}" aria-label="${esc(e.n)} vergessen">✕</button></li>`).join('')}</ul>`
    : '<p class="klein leise">Noch keine. Unter „Essen eintragen“ → „Selbst eintragen“ merkt sich die App, was du dort einträgst.</p>'}
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
  <section class="karte">
    <h3>📲 Auf den Startbildschirm</h3>
    <p><strong>Android (Chrome):</strong> Menü ⋮ → „Zum Startbildschirm hinzufügen“ oder „App installieren“.</p>
    <p><strong>iPhone (Safari):</strong> Teilen-Knopf (□ mit Pfeil) → „Zum Home-Bildschirm“. Auf dem iPhone ist das wichtig: Sonst kann Safari die Einträge löschen, wenn die Seite ein paar Wochen nicht geöffnet wurde.</p>
  </section>
  <section class="karte" id="karte-ueber">
    <h3>ℹ️ Über die App</h3>
    <p>Mahlzeit fragt nichts und schickt nichts weg: kein Konto, keine Werbung, keine Zählung. Alles bleibt auf deinem Handy.</p>
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
  ebene = null;
  const el = $('#ebene');
  el.hidden = true;
  el.innerHTML = '';
  document.body.classList.remove('ebene-offen');
  if (!ausVerlauf && history.state?.mahlzeitEbene) history.back();
  zeige();
  if (neuLaden) location.reload();
}

function zeigeEbene() {
  const el = $('#ebene');
  el.hidden = false;
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
        <div id="treffer">${trefferHtml(stand)}</div>
      </div>`;
    const feld = $('#suche');
    if (!ebene.zuletzt && !ebene.bereich) feld.focus({ preventScroll: true });
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
  const selbst = '<button type="button" class="knopf leise breit" data-tun="eigen">✎ Nicht dabei? Selbst eintragen</button>';
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
  const e = { kcal: l.kcal, kh: l.kh, m: ebene.m };
  return `
    <div class="ebene-kopf">
      <button type="button" class="rund" data-tun="zurueck-suche" aria-label="Zurück">‹</button>
      <h2>${esc(l.n)}</h2>
    </div>
    <div class="ebene-inhalt">
      <p class="leise">${esc(l.p || '')}${ebene.m !== 1 ? ` · ${R.menge(ebene.m)} ×` : ''}</p>
      <p class="gross"><span id="sache-kcal">${R.zahl(R.kcalVon(e))}</span> <span class="einheit">kcal</span></p>
      ${l.kh ? `<p class="leise klein">etwa ${R.zahl(R.khVon(e))} g Kohlenhydrate</p>` : ''}
      ${l.t ? `<p class="tipp" id="tipp">💡 ${esc(l.t)}</p>` : ''}
      <h3>Wie viel?</h3>
      ${mengenChips(ebene.m)}
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

// --- Handlungen ------------------------------------------------------------

function eintragen() {
  const stand = lesen();
  const l = sucheSache(stand, ebene.id);
  if (!l) return;
  const id = neueId('e');
  const tag = ebene.tag;
  aendern((s) => {
    (s.tage[tag] ||= []).push({ id, f: l.id, n: l.n, p: l.p || '', m: ebene.m, kcal: l.kcal, kh: l.kh || 0, z: ebene.z });
  });
  const text = `${ebene.m !== 1 ? `${R.menge(ebene.m)} × ` : ''}${l.n} (${R.zahl(R.kcalVon({ kcal: l.kcal, m: ebene.m }))} kcal) eingetragen – noch etwas?`;
  ebene = { art: 'suche', tag, z: ebene.z, q: '', bereich: null, zuletzt: text };
  zeige();
}

function eigenEintragen() {
  const name = $('#eigen-name').value.trim() || 'Eigenes Essen';
  const kcal = R.leseZahl($('#eigen-kcal').value);
  const khText = $('#eigen-kh').value.trim();
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
  aendern((s) => {
    if (merken) s.eigene.unshift({ id: sacheId, n: name, p: '', kcal: Math.round(kcal), kh: Math.round(kh) });
    (s.tage[tag] ||= []).push({ id: neueId('e'), f: sacheId, n: name, p: '', m: 1, kcal: Math.round(kcal), kh: Math.round(kh), z });
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
      (s.tage[tag] ||= []).push({ id: neueId('h'), f: l.id, n: l.n, p: l.p, m: 1, kcal: l.kcal, kh: l.kh, z: m.z, h: i });
    }
  });
  zeige();
  if (!weg && R.haferFertig(lesen(), tag)) meldung('Hafertag geschafft – stark! 🌾');
}

function haferTag(tag) {
  let jetzt = false;
  aendern((s) => {
    if (s.hafer.tage.includes(tag)) s.hafer.tage = s.hafer.tage.filter((t) => t !== tag);
    else { s.hafer.tage = [...s.hafer.tage, tag].sort(); jetzt = true; }
  });
  zeige();
  meldung(jetzt ? `${R.datumKurz(tag)} ist Hafertag.` : `${R.datumKurz(tag)} ist kein Hafertag mehr.`);
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
  let wert = R.leseZahl(feld.value);
  const grenzen = { gewicht: [30, 300, 'Gewicht bitte in kg, z. B. 98,4'], zucker: [20, 600, 'Blutzucker bitte in mg/dl, z. B. 120'], hba1c: [3, 20, 'HbA1c bitte in Prozent, z. B. 7,2'] };
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
    if (art === 'gewicht') s.werte = s.werte.filter((w) => !(w.art === 'gewicht' && w.tag === tag));
    const w = { id: neueId('w'), art, tag, wert: Math.round(wert * 10) / 10 };
    if (uhr) w.uhr = uhr;
    if (art === 'zucker') w.wann = zustand.zuckerWann || (d.getHours() < 10 ? 'nuechtern' : 'sonst');
    s.werte.push(w);
  });
  zeige();
  meldung('Eingetragen.');
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
    case 'menge': ebene.m = Number(el.dataset.m); zeigeEbene(); break;
    case 'zeit': {
      ebene.z = el.dataset.z;
      if (ebene.art === 'eigen') {
        // Das Formular nicht neu zeichnen – sonst wären die Eingaben weg.
        el.parentElement.querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-pressed', String(c === el)));
      } else zeigeEbene();
      break;
    }
    case 'eintragen': eintragen(); break;
    case 'eigen': ebene = { ...ebene, art: 'eigen' }; zeigeEbene(); break;
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
    case 'hafer-oft':
      aendern((s) => { s.hafer.proMonat = Number(el.dataset.n); });
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
  }
});

document.addEventListener('submit', (ev) => {
  const form = ev.target.closest('[data-form]');
  if (!form) return;
  ev.preventDefault();
  if (form.dataset.form === 'eigen') eigenEintragen();
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

// Über Mitternacht offen geblieben: beim Zurückkommen stimmt „Heute" wieder.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && !ebene) zeige();
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

zeige();
document.documentElement.dataset.bereit = '1';
