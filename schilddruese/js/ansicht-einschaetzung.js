/*
 * Einschätzung in der Oberfläche: das Gesamtbild, der Warnzeichen-Check,
 * „Was braucht Abstand?" und der Block unter jedem Laborbefund.
 *
 * Gerechnet wird in js/einschaetzung.js; hier wird nur gezeigt. Jede Aussage
 * steht in Worten, Farbe kommt nur dazu. Unter jeder Einschätzung steht, dass
 * sie keine ärztliche Beurteilung ersetzt – und nie eine Dosis.
 */
import { datumKurz, datumInWorten, tageZwischen, zahlText, uhrText } from './datum.js';
import { esc } from './text.js';
import * as sp from './speicher.js';
import * as ez from './einschaetzung.js';

const LAGE = { unter: 'unter dem Bereich', im: 'im Bereich', ueber: 'über dem Bereich' };
const KLASSE = { notruf: 'gefahr', tage: 'gefahr', zeitnah: 'warn', termin: '', keine: 'ok' };
const ZEICHEN = { notruf: '🚑', tage: '📞', zeitnah: '📅', termin: '🗒️', keine: '✓' };

export const HINWEIS_GRENZE = 'Automatische Einordnung nach festen Regeln – sie ersetzt keine ärztliche Beurteilung. Die Dosis ändern Sie bitte nie selbst; das entscheidet die Ärztin.';

/** Die Einordnung je Wert als Zeilen. */
function werteZeilen(e) {
  return e.werte.map((w) => `
    <div class="befund-wert"><b>${w.name}</b>
      <span>${esc(zahlText(w.wert.wert))} ${esc(w.wert.einheit)}</span>
      <span class="zahl lage lage-${w.lage || 'keine'}">${w.lage ? LAGE[w.lage] : 'ohne Bereich'}</span>
    </div>
    ${w.quelle === 'orientierung' ? `<div class="bereich" style="text-align:right">übliche Orientierung ${esc(zahlText(w.von))}–${esc(zahlText(w.bis))}, nicht Ihr Labor</div>` : ''}`).join('');
}

/**
 * Der Block unter einem Befund: Muster, Dringlichkeit, Zusätze, mögliche
 * Erklärungen, Verlauf. `kurz` lässt Erklärungen und Verlauf weg.
 */
export function befundBlock(befund, stand, { kurz = false } = {}) {
  const e = ez.befundEinschaetzen(befund, stand);
  if (!e) return '';
  const stufe = ez.STUFEN[e.dringlichkeit];
  return `
    <div class="einschaetzung ${KLASSE[e.dringlichkeit]}" data-muster="${e.muster}" data-dringlichkeit="${e.dringlichkeit}">
      <p class="einschaetzung-titel">${esc(e.titel)}</p>
      <p class="einschaetzung-was"><span aria-hidden="true">${ZEICHEN[e.dringlichkeit]}</span> ${esc(stufe.text)}</p>
      ${e.zusaetze.map((z) => `<p class="klein">${esc(z)}</p>`).join('')}
      ${!kurz && e.erklaerungen.length ? `<p class="klein" style="margin-top:.4rem"><strong>Mögliche Erklärungen aus Ihren Einträgen:</strong></p><ul class="klein">${e.erklaerungen.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
      ${!kurz && e.verlauf ? `<p class="klein">${esc(e.verlauf)}</p>` : ''}
    </div>`;
}

// ---------------------------------------------------------------- Dosis

const RICHTUNG_ZEICHEN = { mehr: '⬆️', weniger: '⬇️', gleich: '＝', klaeren: '❔' };

/** „Spricht der Wert für mehr oder weniger?" – als eigene Karte. */
export function dosisBlock(stand, heute) {
  const d = ez.dosisRichtung(stand, heute);
  if (!d) return '';
  return `
    <h2 class="abschnitt">Dosis</h2>
    <div class="karte dosis-richtung" data-richtung="${d.richtung}">
      <p class="gross"><span aria-hidden="true">${RICHTUNG_ZEICHEN[d.richtung]}</span> ${esc(d.titel)}</p>
      ${d.gruende.length ? `<ul>${d.gruende.map((g) => `<li>${esc(g)}</li>`).join('')}</ul>` : ''}
      ${d.rat ? `<p style="margin-top:.5rem"><strong>${esc(d.rat)}</strong></p>` : ''}
      <p class="klein gedaempft" style="margin-top:.4rem">Nach dem Befund vom ${esc(datumKurz(d.befund.datum))}. Die App rechnet keine neue Tagesdosis aus.</p>
    </div>`;
}

// ---------------------------------------------------------------- Gesamtbild

function gesamtbildSeite(stand, heute) {
  const teile = [];
  const letzter = ez.letzterBefund(stand);
  if (letzter) {
    const alt = tageZwischen(letzter.befund.datum, heute);
    teile.push(`
      <h2 class="abschnitt">Letzter Laborwert</h2>
      <div class="karte">
        <p class="gedaempft">Blutabnahme am ${esc(datumInWorten(letzter.befund.datum, { jahr: true }))}${alt > 180 ? ' – schon länger her' : ''}</p>
        ${werteZeilen(letzter.einschaetzung)}
        ${befundBlock(letzter.befund, stand)}
      </div>`);
  } else {
    teile.push('<h2 class="abschnitt">Laborwerte</h2><div class="karte"><p class="gedaempft">Noch kein Befund eingetragen. Mit TSH (und am besten fT4) vom nächsten Befund kann die App die Werte einordnen.</p><div class="knopf-reihe"><button type="button" class="knopf knopf-haupt" data-act="seite" data-seite="labor">Laborwerte eintragen</button></div></div>');
  }
  const kontrolle = ez.kontrolleFaellig(stand, heute);
  if (kontrolle) teile.push(`<div class="hinweis-karte warn"><span class="ri" aria-hidden="true">🩸</span><div>${esc(kontrolle)}</div></div>`);

  teile.push(dosisBlock(stand, heute));

  const b = ez.beschwerdenMuster(stand, heute);
  teile.push(`
    <h2 class="abschnitt">Beschwerden</h2>
    <div class="karte">
      ${b.text ? `<p><strong>${esc(b.text)}</strong></p>` : '<p class="gedaempft">In den letzten vier Wochen kein Befinden eingetragen. Die Frage dazu steht unter „Heute".</p>'}
      ${b.eintraege ? `<p class="klein gedaempft">${b.wenig} Nennungen, die zu zu wenig Hormon passen, ${b.viel} zu zu viel.</p>` : ''}
      ${b.abgleich ? `<p class="klein">${esc(b.abgleich)}</p>` : ''}
      ${b.richtung ? '<p class="klein gedaempft">Solche Beschwerden haben oft auch andere Gründe.</p>' : ''}
    </div>`);

  const bil = sp.einnahmeBilanz(28, heute);
  if (bil.tage) {
    const quote = Math.round((bil.genommen / bil.tage) * 100);
    teile.push(`
      <h2 class="abschnitt">Einnahme</h2>
      <div class="karte"><p>In den letzten vier Wochen an ${bil.genommen} von ${bil.tage} Tagen genommen (${quote} %).</p>
      ${bil.ausgelassen >= 3 ? '<p class="klein">Mehrere vergessene Tabletten lassen TSH steigen. Eine Kalender-Erinnerung hilft – siehe „Mehr → Erinnerung".</p>' : ''}</div>`);
  }

  const fragen = ez.fragenVorschlaege(stand, heute);
  if (fragen.length) {
    teile.push(`
      <h2 class="abschnitt">Fragen für den Termin</h2>
      <div class="karte">
        <ul>${fragen.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>
        <button type="button" class="knopf knopf-breit" data-act="fragen-uebernehmen">Diese Fragen zu „Meine Fragen" hinzufügen</button>
      </div>`);
  }
  if (!stand.profil.geburtsjahr) {
    teile.push('<div class="hinweis-karte"><span class="ri" aria-hidden="true">👤</span><div>Mit Ihrem Geburtsjahr und Ihren weiteren Mitteln wird die Einschätzung genauer. <button type="button" class="knopf knopf-klein" data-act="seite" data-seite="profil">Angaben machen</button></div></div>');
  }
  teile.push(`<p class="klein gedaempft">${esc(HINWEIS_GRENZE)}</p>`);
  return { titel: 'Was sagen meine Werte?', html: teile.join('') };
}

// ---------------------------------------------------------------- Warnzeichen

function warnFormular() {
  const liste = (eintraege) => eintraege.map(([k, t]) => `<label class="haken" style="width:100%"><input type="checkbox" name="warn" value="${k}">${esc(t)}</label>`).join('');
  return `
    <form data-formular="warnzeichen" novalidate>
      <p style="margin-bottom:.8rem">Kreuzen Sie an, was <strong>gerade</strong> zutrifft. Nichts davon? Dann einfach auf „Auswerten" tippen.</p>
      <div class="feld"><span id="warn-akut">Jetzt gerade</span>
        <div class="haken-liste" role="group" aria-labelledby="warn-akut">${liste(ez.WARN_NOTRUF)}</div></div>
      <div class="feld"><span id="warn-tage">In den letzten Tagen</span>
        <div class="haken-liste" role="group" aria-labelledby="warn-tage">${liste(ez.WARN_PRAXIS)}</div></div>
      <div class="formular-fuss"><button type="submit" class="knopf knopf-haupt knopf-breit">Auswerten</button></div>
    </form>`;
}

function warnErgebnis(param) {
  const antworten = String(param || '').split(',').filter(Boolean);
  const r = ez.warnzeichenAuswerten(antworten);
  if (r.stufe === 'notruf') {
    return `
      <div class="karte gefahr" role="alert">
        <p class="gross">Jetzt 112 anrufen.</p>
        <p style="margin-top:.4rem">${r.grund.map(esc).join('. ')}.</p>
        <a class="knopf knopf-gefahr knopf-breit" href="tel:112" style="margin-top:.8rem;background:var(--gefahr);color:#fff">112 anrufen</a>
        <p class="klein" style="margin-top:.6rem">Sagen Sie am Telefon, dass Sie Schilddrüsenhormon nehmen, und welche Dosis.</p>
      </div>`;
  }
  if (r.stufe === 'tage') {
    return `
      <div class="karte warn">
        <p class="gross">Heute oder in den nächsten Tagen die Praxis anrufen.</p>
        <p style="margin-top:.4rem">${r.grund.map(esc).join('. ')}.</p>
        <p style="margin-top:.4rem">Außerhalb der Sprechzeiten: ärztlicher Bereitschaftsdienst 116 117.</p>
        <a class="knopf knopf-breit" href="tel:116117" style="margin-top:.8rem">116 117 anrufen</a>
        <p class="klein" style="margin-top:.6rem">Werden die Beschwerden plötzlich stark – Brustschmerz, Atemnot, Ohnmacht –, dann 112.</p>
      </div>`;
  }
  return `
    <div class="karte ok">
      <p class="gross">Kein Warnzeichen angekreuzt.</p>
      <p style="margin-top:.4rem">Was Sie beschäftigt, beim nächsten Termin ansprechen – am besten gleich unter „Meine Fragen" notieren.</p>
      <p class="klein" style="margin-top:.6rem">Ändert sich etwas plötzlich, den Check einfach noch einmal machen.</p>
    </div>
    <div class="knopf-reihe"><button type="button" class="knopf" data-act="seite" data-seite="frage">Frage notieren</button></div>`;
}

// ---------------------------------------------------------------- Abstand

function abstandSeite(stand) {
  const plan = ez.abstandPlan(stand);
  return {
    titel: 'Was braucht Abstand?',
    html: `
      <p class="gedaempft" style="margin-bottom:.8rem">Ihre Tablette: ${esc(uhrText(stand.einstellungen.erinnerung))}. Daraus ergibt sich:</p>
      <div class="zeilen">${plan.map((p) => `
        <div class="zeile" style="cursor:default" data-mittel="${esc(p.key)}">
          <span class="zeile-text"><span class="zeile-titel">${esc(p.name)}</span><span class="zeile-unter">${esc(p.text)}</span></span>
        </div>`).join('')}</div>
      ${stand.mittel.length ? '' : '<p class="klein gedaempft" style="margin-top:.8rem">Weitere Mittel, die Sie nehmen, tragen Sie unter „Über mich & weitere Mittel" ein – dann stehen sie hier mit Uhrzeit.</p>'}
      <div class="knopf-reihe"><button type="button" class="knopf" data-act="seite" data-seite="profil">Weitere Mittel eintragen</button></div>
      <p class="klein gedaempft" style="margin-top:.8rem">Nehmen Sie die Tablette abends, gilt dasselbe rückwärts: diese Mittel mindestens so lange vor der Tablette.</p>`,
  };
}

/** Seiten dieses Bereichs: { titel, html } oder null. */
export function einschaetzungSeite(name, param, stand, heute) {
  switch (name) {
    case 'gesamtbild': return gesamtbildSeite(stand, heute);
    case 'warnzeichen': return { titel: 'Warnzeichen prüfen', html: warnFormular() };
    case 'warnzeichen-ergebnis': return { titel: 'Ergebnis', html: warnErgebnis(param) };
    case 'abstand': return abstandSeite(stand);
    default: return null;
  }
}

/** Hinweise für „Heute" aus der Einschätzung (dringende Befunde, Kontrolle fällig). */
export function heuteHinweise(stand, heute) {
  const teile = [];
  const letzter = ez.letzterBefund(stand);
  if (letzter && ['tage', 'zeitnah'].includes(letzter.einschaetzung.dringlichkeit) && tageZwischen(letzter.befund.datum, heute) <= 30
    && !stand.termine.some((t) => t.datum >= heute)) {
    const e = letzter.einschaetzung;
    teile.push(`
      <div class="hinweis-karte ${KLASSE[e.dringlichkeit]}"><span class="ri" aria-hidden="true">${ZEICHEN[e.dringlichkeit]}</span>
        <div><strong>Laborwert vom ${esc(datumKurz(letzter.befund.datum))}:</strong> ${esc(e.titel)} ${esc(ez.STUFEN[e.dringlichkeit].text)}
        <br><button type="button" class="knopf knopf-klein" data-act="seite" data-seite="gesamtbild" style="margin-top:.4rem">Einschätzung ansehen</button></div>
      </div>`);
  }
  const kontrolle = ez.kontrolleFaellig(stand, heute);
  if (kontrolle && !stand.termine.some((t) => t.datum >= heute)) {
    teile.push(`<div class="hinweis-karte warn"><span class="ri" aria-hidden="true">🩸</span><div>${esc(kontrolle)}</div></div>`);
  }
  return teile.join('');
}
