/*
 * Willkommen – die drei Schritte beim allerersten Öffnen.
 *
 * 1. Was die App ist, und was nicht. Für wen ihre Einschätzung gilt (P6) –
 *    mit dem Haken, der sie einschaltet. Anrede und Geburtsjahr (freiwillig).
 * 2. Präparat, Stärke, Tabletten am Tag, seit wann.
 * 3. Einnahmezeit – und die ehrliche Erklärung, wie Erinnern hier geht.
 *
 * Kein Schritt ist ein Verhör: Alles außer der Stärke lässt sich leer
 * lassen, und alles lässt sich später unter „Mehr" ändern. Wer die App für
 * die Mutter einrichtet, ist damit in zwei Minuten durch. Das Geburtsjahr
 * steht trotzdem gut sichtbar da: Ohne es rechnet die App vorsichtiger, und
 * das soll man wissen, bevor man es leer lässt.
 */
import { istISO, istUhr, zahlAus } from './datum.js';
import { esc } from './text.js';
import * as sp from './speicher.js';
import { P6_TEXT } from './einschaetzung.js';
import { tablettenWahl, jahrAus, STAERKE_GRENZE_TEXT, STAERKE_RUECKFRAGE, staerkeUngewoehnlich, zeileAus } from './ansicht-formulare.js';

export const WILLKOMMEN_SCHRITTE = 3;

/*
 * Der Entwurf eines Schritts: was beim Tipp auf „Zurück" in den Feldern
 * stand. „Zurück" speichert nichts – vorher belegte Schritt 2 danach die
 * Felder wieder aus dem Stand vor: Die Stärke war leer, und „Seit wann?"
 * stand still wieder auf heute. Wer nur die Stärke neu eintippte, hatte die
 * Dosis dann ab heute, und Befunde davor standen ohne „Dosis damals"
 * (Runde 4: E12). js/app.js merkt sich den Entwurf je Schritt und gibt ihn
 * willkommenAnsicht() mit; nach „Weiter" gilt wieder der Stand.
 */
const ENTWURF_FELDER = ['name', 'geburtsjahr', 'praeparat', 'mikrogramm', 'tabletten', 'ab', 'erinnerung'];

/** Die Felder eines Willkommensschritts, so wie sie gerade im Formular stehen. */
export function willkommenEntwurf(form) {
  const f = new FormData(form);
  const entwurf = {};
  ENTWURF_FELDER.forEach((k) => { if (f.has(k)) entwurf[k] = String(f.get(k)); });
  // Ein Haken ohne Häkchen fehlt in FormData ganz – ob er da war, sagt das Formular.
  if (form.elements.namedItem('behandelt')) entwurf.behandelt = f.get('behandelt') === 'on';
  return entwurf;
}

/**
 * `entwurf`: was willkommenEntwurf() beim „Zurück" aus genau diesem Schritt
 * gelesen hat – es geht dem Stand vor. Ohne (null) wie bisher aus dem Stand.
 */
export function willkommenAnsicht(schritt, stand, heute, entwurf = null) {
  const dosis = sp.aktuelleDosis();
  const aus = (k, sonst) => (entwurf && typeof entwurf[k] === 'string' ? entwurf[k] : sonst);
  if (schritt === 1) {
    const behandelt = entwurf && typeof entwurf.behandelt === 'boolean' ? entwurf.behandelt : stand.profil.behandelt;
    return `
      <form novalidate>
        <p class="schritte">Willkommen</p>
        <h2 class="willkommen-titel">Ihre Schilddrüsen-App</h2>
        <div class="karte">
          <p>Diese App hilft im Alltag mit der Schilddrüsenunterfunktion:</p>
          <ul style="padding-left:1.2rem;margin:.6rem 0">
            <li>jeden Morgen die <strong>Tablette abhaken</strong>,</li>
            <li><strong>Dosis, Laborwerte und Gewicht</strong> festhalten,</li>
            <li>zum Arzttermin einen <strong>fertigen Bericht</strong> mitnehmen.</li>
          </ul>
          <p>Alles bleibt auf diesem Handy. Kein Konto, kein Internet nötig.</p>
        </div>
        <div class="hinweis-karte"><span class="ri" aria-hidden="true">ℹ️</span><div>Die App ordnet Ihre Laborwerte und Beschwerden ein und sagt, ob ein Wert eher für mehr oder weniger Tablette spricht. Sie ersetzt keinen Arztbesuch: Vor jeder Änderung der Dosis bitte kurz die Praxis anrufen.</div></div>
        <div class="karte p6-karte">
          <p>${esc(P6_TEXT)}</p>
          <label class="haken haken-breit" style="margin-top:.7rem"><input type="checkbox" name="behandelt" ${behandelt ? 'checked' : ''}>Ich werde wegen einer Schilddrüsen-Unterfunktion mit Tabletten behandelt</label>
        </div>
        <label class="feld"><span>Wie dürfen wir Sie ansprechen? (freiwillig)</span>
          <input type="text" name="name" value="${esc(aus('name', stand.profil.name))}" placeholder="z. B. Frau Müller oder Vorname" maxlength="${sp.GRENZEN.name}" autocomplete="off">
        </label>
        <label class="feld"><span>In welchem Jahr sind Sie geboren?</span>
          <input type="text" inputmode="numeric" name="geburtsjahr" value="${esc(aus('geburtsjahr', stand.profil.geburtsjahr ? String(stand.profil.geburtsjahr) : ''))}" placeholder="z. B. 1952" autocomplete="off">
          <span class="hinweis">Freiwillig. Im Alter gelten für TSH oft andere Zielwerte – ohne Geburtsjahr rechnet die App vorsichtiger.</span>
        </label>
        <div class="formular-fuss">
          <button type="button" class="knopf knopf-haupt knopf-breit" data-act="willkommen-weiter">Weiter</button>
        </div>
      </form>
      <div class="karte" style="margin-top:1.2rem">
        <h2>Neues Handy?</h2>
        <p class="gedaempft">Wer schon eine Sicherungsdatei dieser App hat, kann sie hier einlesen – dann ist alles wieder da.</p>
        <input type="file" id="sicherungDatei" accept=".json,application/json" hidden>
        <button type="button" class="knopf knopf-breit" data-act="sicherung-laden" style="margin-top:.6rem">Sicherung einlesen …</button>
      </div>`;
  }
  if (schritt === 2) {
    const d = dosis || { praeparat: 'L-Thyroxin', mikrogramm: null, tabletten: 1, ab: heute };
    const mikrogramm = aus('mikrogramm', d.mikrogramm === null ? '' : String(d.mikrogramm).replace('.', ','));
    const tabletten = zahlAus(aus('tabletten', '')) || d.tabletten;
    return `
      <form novalidate>
        <p class="schritte">Schritt 2 von 3</p>
        <h2 class="willkommen-titel">Welche Tablette nehmen Sie?</h2>
        <p class="gedaempft" style="margin-bottom:.9rem">Steht auf der Packung. Ist die Packung gerade nicht zur Hand, die Stärke leer lassen – bitte nicht schätzen. „Heute" erinnert dann daran, sie nachzutragen.</p>
        <label class="feld"><span>Präparat</span>
          <input type="text" name="praeparat" value="${esc(aus('praeparat', d.praeparat))}" placeholder="z. B. L-Thyroxin Henning" maxlength="${sp.GRENZEN.praeparat}" autocomplete="off">
        </label>
        <label class="feld"><span>Stärke in µg (Mikrogramm)</span>
          <input type="text" inputmode="decimal" name="mikrogramm" value="${esc(mikrogramm)}" placeholder="z. B. 75" autocomplete="off">
          <span class="hinweis">Die Zahl auf der Packung: 25, 50, 75, 100, 125 …</span>
        </label>
        ${tablettenWahl(tabletten)}
        <label class="feld"><span>Seit wann ungefähr?</span>
          <input type="date" name="ab" value="${esc(aus('ab', d.ab))}" max="${esc(heute)}">
          <span class="hinweis">Wenn Sie es nicht genau wissen: ungefähr schätzen – nur wenn Sie heute neu beginnen, heute lassen. Damit ordnet die App Ihre Laborwerte der richtigen Dosis zu.</span>
        </label>
        <div class="formular-fuss">
          <button type="button" class="knopf knopf-haupt knopf-breit" data-act="willkommen-weiter">Weiter</button>
          <div class="knopf-reihe"><button type="button" class="knopf knopf-leise" data-act="willkommen-zurueck">Zurück</button></div>
        </div>
      </form>`;
  }
  return `
    <form novalidate>
      <p class="schritte">Schritt 3 von 3</p>
      <h2 class="willkommen-titel">Wann nehmen Sie die Tablette?</h2>
      <label class="feld"><span>Uhrzeit</span>
        <input type="time" name="erinnerung" value="${esc(aus('erinnerung', stand.einstellungen.erinnerung))}">
        <span class="hinweis">Morgens nüchtern, mindestens eine halbe Stunde vor dem Frühstück, mit Wasser. Ab dieser Uhrzeit zeigt „Heute" den Knopf in Gelb, solange nichts abgehakt ist.</span>
      </label>
      <div class="karte">
        <h2>So erinnert Sie das Handy</h2>
        <p>Diese App kann sich <strong>nicht von selbst melden</strong>, wenn sie geschlossen ist – dafür bräuchte sie einen Server, und den hat sie mit Absicht nicht.</p>
        <p>Was zuverlässig klingelt, ist der <strong>Kalender oder der Wecker des Handys</strong>. Unter „Mehr → Erinnerung" gibt es dafür eine Kalenderdatei mit einem täglichen Termin – einmal in den Kalender legen, fertig.</p>
      </div>
      <div class="formular-fuss">
        <button type="button" class="knopf knopf-haupt knopf-breit" data-act="willkommen-weiter">Fertig – zur App</button>
        <div class="knopf-reihe"><button type="button" class="knopf knopf-leise" data-act="willkommen-zurueck">Zurück</button></div>
      </div>
    </form>`;
}

/**
 * Den Schritt auslesen und speichern. { ok, fehler } – oder bei einer
 * ungewöhnlichen Stärke { ok: false, rueckfragen, rueckfrageSatz,
 * rueckfrageFeld, fehler } wie beim Befund: js/app.js zeigt die Rückfrage,
 * „Ja, stimmt" schickt den Schritt mit bestaetigt=ja noch einmal ab.
 */
export function willkommenWeiter(schritt, form, heute) {
  const f = new FormData(form);
  if (schritt === 1) {
    // Höchstens so lang, wie das Feld annimmt und normStand behält (Runde 5: F23).
    const name = zeileAus(f.get('name'), sp.GRENZEN.name);
    const j = jahrAus(f.get('geburtsjahr'), heute);
    if (!j.ok) return { ok: false, fehler: { geburtsjahr: j.fehler } };
    sp.aendern((s) => {
      s.profil.name = name;
      s.profil.geburtsjahr = j.jahr;
      s.profil.behandelt = f.get('behandelt') === 'on';
    });
    return { ok: true };
  }
  if (schritt === 2) {
    const fehler = {};
    const roh = String(f.get('mikrogramm') || '').trim();
    const mikrogramm = zahlAus(roh);
    // Leer ist erlaubt (Packung nicht zur Hand) – geschätzt wäre schlimmer.
    if (roh && (mikrogramm === null || mikrogramm <= 0)) fehler.mikrogramm = 'Bitte die Stärke als Zahl eintragen, z. B. 75 – oder leer lassen.';
    else if (mikrogramm !== null && (mikrogramm < 5 || mikrogramm > 400)) fehler.mikrogramm = STAERKE_GRENZE_TEXT;
    let ab = f.get('ab');
    if (!istISO(ab)) ab = heute;
    // Ein Tag in der Zukunft (Jahr vertippt) ließ keine Einnahme zählen, der
    // Bericht sagte „Noch keine Einnahmen erfasst", und die Dosis-Karte
    // verlangte eine Dosis, die schon eingetragen war (B54).
    else if (ab > heute) fehler.ab = 'Dieser Tag liegt in der Zukunft. Bitte den Tag eintragen, seit dem Sie die Tablette nehmen – ungefähr genügt.';
    if (Object.keys(fehler).length) return { ok: false, fehler };
    // Zwischen 5 und 400, aber außerhalb von 12,5 bis 300 µg: nachfragen,
    // statt einen Kommafehler („7,5" statt „75") still zu übernehmen – außer
    // die Stärke steht schon so gespeichert, dann war sie bestätigt (Runde 4:
    // E10). `fehler` nur für den Fall, dass die Rückfrage nicht gezeigt wird:
    // Dann steht der Grund wenigstens am Feld, statt dass „Weiter" still nichts tut.
    const bisher = sp.getStand().dosen.length === 1 ? sp.getStand().dosen[0] : null;
    const ungewoehnlich = f.get('bestaetigt') === 'ja' || (bisher && bisher.mikrogramm === mikrogramm) ? null : staerkeUngewoehnlich(mikrogramm);
    if (ungewoehnlich) {
      return {
        ok: false,
        rueckfragen: [ungewoehnlich],
        rueckfrageSatz: STAERKE_RUECKFRAGE.satz,
        rueckfrageFeld: STAERKE_RUECKFRAGE.feld,
        fehler: { mikrogramm: `${ungewoehnlich} Bitte prüfen Sie die Zahl auf der Packung.` },
      };
    }
    const eintrag = {
      praeparat: zeileAus(f.get('praeparat'), sp.GRENZEN.praeparat),
      mikrogramm,
      tabletten: zahlAus(f.get('tabletten')) || 1,
      ab,
      notiz: '',
    };
    sp.aendern((s) => {
      // Beim Einrichten gibt es höchstens eine Dosis – die wird ersetzt, nicht ergänzt.
      const letzte = s.dosen[s.dosen.length - 1];
      if (letzte && s.dosen.length === 1) Object.assign(letzte, eintrag);
      else s.dosen.push({ id: sp.kennung(), ...eintrag });
    });
    return { ok: true };
  }
  const uhr = String(f.get('erinnerung') || '');
  if (uhr && !istUhr(uhr)) return { ok: false, fehler: { erinnerung: 'Bitte eine Uhrzeit wählen.' } };
  sp.aendern((s) => { if (uhr) s.einstellungen.erinnerung = uhr; });
  return { ok: true };
}
