/*
 * Willkommen – die drei Schritte beim allerersten Öffnen.
 *
 * 1. Was die App ist, und was nicht. Anrede (freiwillig).
 * 2. Präparat, Stärke, Tabletten am Tag, seit wann.
 * 3. Einnahmezeit – und die ehrliche Erklärung, wie Erinnern hier geht.
 *
 * Kein Schritt ist ein Verhör: Alles außer der Stärke lässt sich leer
 * lassen, und alles lässt sich später unter „Mehr" ändern. Wer die App für
 * die Mutter einrichtet, ist damit in zwei Minuten durch.
 */
import { istISO, istUhr, zahlAus } from './datum.js';
import { esc } from './text.js';
import * as sp from './speicher.js';

export const WILLKOMMEN_SCHRITTE = 3;

export function willkommenAnsicht(schritt, stand, heute) {
  const dosis = sp.aktuelleDosis();
  if (schritt === 1) {
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
        <div class="hinweis-karte"><span class="ri" aria-hidden="true">ℹ️</span><div>Die App stellt keine Diagnose, bewertet keine Werte und empfiehlt keine Dosis. Das bleibt bei Ihrer Ärztin oder Ihrem Arzt.</div></div>
        <label class="feld"><span>Wie dürfen wir Sie ansprechen? (freiwillig)</span>
          <input type="text" name="name" value="${esc(stand.profil.name)}" placeholder="z. B. Frau Müller oder Vorname" autocomplete="off">
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
    return `
      <form novalidate>
        <p class="schritte">Schritt 2 von 3</p>
        <h2 class="willkommen-titel">Welche Tablette nehmen Sie?</h2>
        <p class="gedaempft" style="margin-bottom:.9rem">Steht auf der Packung. Wenn Sie es gerade nicht wissen: Stärke schätzen und später unter „Verlauf" berichtigen.</p>
        <label class="feld"><span>Präparat</span>
          <input type="text" name="praeparat" value="${esc(d.praeparat)}" placeholder="z. B. L-Thyroxin Henning" autocomplete="off">
        </label>
        <label class="feld"><span>Stärke in µg (Mikrogramm)</span>
          <input type="text" inputmode="decimal" name="mikrogramm" value="${d.mikrogramm === null ? '' : esc(String(d.mikrogramm).replace('.', ','))}" placeholder="z. B. 75" autocomplete="off">
          <span class="hinweis">Die Zahl auf der Packung: 25, 50, 75, 100, 125 …</span>
        </label>
        <label class="feld"><span>Tabletten am Tag</span>
          <select name="tabletten">
            ${[[0.5, '½ Tablette'], [1, '1 Tablette'], [1.5, '1½ Tabletten'], [2, '2 Tabletten']].map(([w, t]) => `<option value="${w}" ${d.tabletten === w ? 'selected' : ''}>${t}</option>`).join('')}
          </select>
        </label>
        <label class="feld"><span>Seit wann ungefähr?</span>
          <input type="date" name="ab" value="${esc(d.ab)}">
          <span class="hinweis">Wenn unbekannt: heute lassen. Ab diesem Tag zählt die App die Einnahmen.</span>
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
        <input type="time" name="erinnerung" value="${esc(stand.einstellungen.erinnerung)}">
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

/** Den Schritt auslesen und speichern. { ok, fehler }. */
export function willkommenWeiter(schritt, form, heute) {
  const f = new FormData(form);
  if (schritt === 1) {
    const name = String(f.get('name') || '').trim().slice(0, 60);
    sp.aendern((s) => { s.profil.name = name; });
    return { ok: true };
  }
  if (schritt === 2) {
    const fehler = {};
    const mikrogramm = zahlAus(f.get('mikrogramm'));
    if (mikrogramm === null || mikrogramm <= 0) fehler.mikrogramm = 'Bitte die Stärke in µg eintragen, z. B. 75.';
    else if (mikrogramm < 5 || mikrogramm > 400) fehler.mikrogramm = 'Bitte prüfen: Übliche Stärken liegen zwischen 12,5 und 300 µg.';
    let ab = f.get('ab');
    if (!istISO(ab)) ab = heute;
    if (Object.keys(fehler).length) return { ok: false, fehler };
    const eintrag = {
      praeparat: String(f.get('praeparat') || '').trim().slice(0, 80),
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
