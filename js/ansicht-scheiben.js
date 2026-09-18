/* ------------------------------------------------------------------ *
 * Was hier rumliegt: Stangen und Scheiben – die Ansicht dazu
 *
 * Gerechnet wird in js/scheiben.js, angezeigt wird hier. Die Trennung ist
 * dieselbe wie überall: Die Anzeige hängt an der Rechnung, nie umgekehrt –
 * geprüft in tools/pruefung/schichten.py.
 *
 * Ohne diese Angaben rechnet die App mit freien Zahlen und schlägt Gewichte
 * vor, die sich nicht einstellen lassen – „6 kg je Hand" mit einer 1,5-kg-
 * Stange und 1,25er-Scheiben ist so ein Fall. Mit ihnen rastet jeder Vorschlag
 * auf etwas Aufsteckbares ein, und der Umbauhinweis sagt zusätzlich, welche
 * Scheiben auf welche Seite gehören.
 *
 * Eingetragen wird, was da ist, nicht was gebraucht wird: **ein** Vorrat an
 * Scheiben – die passen ja überall drauf – und je Stange ihr Leergewicht. Der
 * Rest ist Rechnen.
 *
 * Geändert wird der Satz nicht hier, sondern in scheibenAendern() (js/app.js):
 * Diese Datei schreibt nichts, sie zeigt nur.
 * ------------------------------------------------------------------ */
import * as store from './store.js';
import { esc, fmtNum } from './text.js';
import { RASTER, STANGE_LABEL, erreichbar, stangeZaehlt } from './scheiben.js';
import { meinSatz } from './gewichte.js';

/**
 * Der Satz, wie er gespeichert ist – ungeordnet und ungeprüft.
 *
 * Die Eingabefelder müssen daraus gefüllt werden, nicht aus meinSatz(): Das
 * sortiert und wirft Unbrauchbares weg, und beides mitten im Tippen. Wer „2,5"
 * eintippt, hätte nach der „2" eine andere Zeilennummer, und der nächste
 * Tastendruck landete in der falschen Zeile. Gerechnet wird weiter mit der
 * geprüften Fassung; angezeigt wird, was dasteht.
 */
export function roherSatz() {
  const s = store.getState().scheiben;
  // Ein alter Stand mit zwei getrennten Listen wird beim ersten Ansehen
  // zusammengelegt – normSatz() kann das, hier reicht der Blick darauf, ob es
  // die neue Form ist.
  if (!s || !Array.isArray(s.scheiben)) return meinSatz();
  // Über STANGE_LABEL, nicht über eine getippte Liste. Hier standen kh und lh
  // ausgeschrieben – aus der Zeit, als es nur zwei Stangen gab. Mit der
  // SZ-Stange wurde daraus ein Datenverlust: scheibenAendern() nimmt genau
  // dieses Objekt und schreibt es zurück (siehe unten), und was hier nicht
  // aufgezählt ist, ist danach weg. Ein eingetragenes SZ-Leergewicht überlebte
  // damit den nächsten Tipp auf irgendeine Scheibenzeile nicht, und das
  // Eingabefeld war ohnehin von Anfang an leer.
  //
  // Eine Liste, die dieselben Schlüssel noch einmal aufzählt, ist genau die
  // Sorte Wissen, die beim nächsten Zuwachs vergessen wird. Deshalb keine.
  return {
    stange: Object.fromEntries(Object.keys(STANGE_LABEL).map((k) =>
      [k, typeof s.stange?.[k] === 'number' ? s.stange[k] : null])),
    scheiben: s.scheiben.filter(Array.isArray).map((z) => [z[0], z[1]]),
  };
}

/** Zahl fürs Eingabefeld – auch dann, wenn dort gerade Unsinn steht. */
const feldWert = (v) => (typeof v === 'number' && Number.isFinite(v) ? fmtNum(v) : '');

/** Eine Zeile „Größe × Stück" für eine Scheibengröße. */
/**
 * Eine Zeile des Scheibensatzes – und was diese Größe wirklich bringt.
 *
 *     „Ich will 20 kg machen aber wenn ich bei 16 auf plus drück dann geht er
 *      direkt hier hin."
 *
 * Zwischen 16 und 21,5 liegt nichts, weil der eingetragene Satz nichts
 * dazwischen hergibt – aber das stand nirgends. Schlimmer noch: Eine Größe, von
 * der zu wenige da sind, wurde stumm übergangen. Für die Langhantel braucht es
 * zwei Scheiben je Stufe, für beide Kurzhanteln vier; wer eine Größe einzeln
 * einträgt, hat sie eingetragen und sie zählt trotzdem nicht.
 *
 * Deshalb steht jetzt an jeder Zeile, was sie leistet: „+10 kg an der Stange"
 * – oder eben, dass es für ein Paar nicht reicht.
 */
function scheibenZeile(i, kg, anzahl) {
  const n = Number(anzahl) || 0;
  const wert = Number(kg) || 0;
  const paare = Math.floor(n / 2);
  const hinweis = !wert || !n ? ''
    : paare < 1
      ? '<span class="scheiben-warn">nur einzeln – eine Stange braucht zwei</span>'
      : `<span class="scheiben-hint">+${esc(fmtNum(wert * 2))} kg je Paar${
          n >= 4 ? ` · ${paare} Paare` : ''}</span>`;
  return `
    <div class="scheiben-zeile">
      <input type="text" inputmode="decimal" class="kg-val" value="${esc(feldWert(kg))}"
             data-act="scheiben-kg" data-i="${i}" aria-label="Scheibengewicht in Kilo">
      <span class="scheiben-mal">kg ×</span>
      <input type="text" inputmode="numeric" class="kg-val" value="${esc(feldWert(anzahl))}"
             data-act="scheiben-n" data-i="${i}" aria-label="Anzahl Scheiben">
      <span class="scheiben-mal">Stück</span>
      <button type="button" class="btn btn-mini" data-act="scheiben-weg"
              data-i="${i}" aria-label="Diese Größe entfernen">✕</button>
      ${hinweis}
    </div>`;
}

/**
 * Die Vorschau: was sich mit dem Eingetragenen wirklich einstellen lässt.
 *
 * Sie ist der eigentliche Beleg, dass die Eingabe stimmt. Wer hier seine
 * gewohnten Gewichte wiederfindet, hat richtig eingetragen; wer eine Liste aus
 * krummen Zahlen sieht, hat sich vertippt. Deshalb steht sie direkt darunter
 * und nicht in einem Hilfetext.
 *
 * Der wichtigste Fall ist der leere: Wer von jeder Größe nur zwei Scheiben hat,
 * kann damit **kein Paar Kurzhanteln** bestücken – dafür braucht es vier. Dann
 * bleibt nur die leere Stange, und hier stand vorher „0 kg". Eine Null ohne
 * Begründung sieht aus wie ein Fehler der App; deshalb steht jetzt der Grund da.
 */
function scheibenVorschau(equip, was, satz) {
  const liste = erreichbar(equip, satz);
  if (!liste) return '';
  // Zwei Rechnungen, und welche gilt, hängt daran, ob ein Leergewicht
  // eingetragen ist:
  //
  //   kein Leergewicht   Scheibengewicht. Der Normalfall und die Vorgabe:
  //                      *„Wenn bei ner Übung aber 4kg steht mein ich damit 4kg
  //                      Scheibengewicht gesamt."* Da ist nichts zu mahnen –
  //                      hier stand einmal „trag ihr Leergewicht ein, sonst sind
  //                      alle Zahlen zu klein", und das war schlicht die falsche
  //                      Annahme über das, was die Zahl bedeutet.
  //   Leergewicht steht  Gesamtgewicht. Auch in Ordnung, nur eine andere
  //                      Rechnung – und dann sagt die Zeile das dazu, damit die
  //                      Liste nicht plötzlich woanders anfängt und keiner weiß,
  //                      warum.
  // Der Mangel zuerst. Vorher stand die Zahlenzeile vorn, und weil die eine
  // erreichbare Möglichkeit die leere Stange ist, fing sie mit einer 0 an: „Beide
  // Kurzhanteln, je Hand: 0 kg plus Stange". Formal richtig, gelesen aber als
  // Fehler der App – der Grund stand in einem Zweig, der nie erreicht wurde.
  if (liste.length <= 1) {
    const grund = equip === 'dumbbells'
      ? ' – für ein Paar braucht eine Stufe vier Scheiben derselben Größe, zwei je Hantel. '
        + 'Davon hast du keine Größe viermal.'
      : ' – für eine Stufe braucht es zwei Scheiben derselben Größe.';
    return `<div class="hint">${esc(was)}: <strong>nichts aufzustecken</strong>${grund}
      <span class="muted">Hier rechnet die App weiter in festen Schritten.</span></div>`;
  }
  const gezeigt = liste.slice(0, 14).map((w) => fmtNum(w)).join(' · ');
  const rechnung = stangeZaehlt(satz, equip)
    ? ` <span class="muted">– mit dem Leergewicht der
        ${esc(STANGE_LABEL[RASTER[equip].stange])}.</span>`
    : ' <span class="muted">– Scheibengewicht, die Stange zählt nicht mit.</span>';
  return `<div class="hint"><strong>${esc(was)}:</strong> ${esc(gezeigt)}`
    + `${liste.length > 14 ? ' …' : ''} kg${RASTER[equip].stange ? rechnung : ''}</div>`;
}

export function scheibenKarte() {
  const satz = roherSatz();
  const geprueft = meinSatz();
  return `
    <div class="section-title">Was bei dir rumliegt</div>
    <div class="card">
      <div class="small muted">Ein Vorrat für alles: Scheiben passen ja überall drauf.
        Trag hier ein, welche du hast und wie viele – und was die leeren Stangen wiegen.
        Dann schlägt die App nur noch Gewichte vor, die sich damit auch einstellen lassen,
        und sagt beim Umbauen dazu, welche Scheiben draufkommen.
        ${geprueft.scheiben.length ? '' : ' Solange hier nichts steht, rechnet sie in festen '
          + 'Schritten weiter – und die treffen manchmal daneben.'}</div>

      <div class="scheiben-satz">
        <div class="lbl">Scheiben</div>
        ${satz.scheiben.map(([kg, n], i) => scheibenZeile(i, kg, n)).join('')}
        <button type="button" class="btn btn-block" data-act="scheiben-plus">
          Scheibengröße hinzufügen</button>
      </div>

      <div class="scheiben-satz">
        <div class="lbl">Stangen, leer</div>
        ${Object.keys(STANGE_LABEL).map((k) => `
          <div class="scheiben-zeile">
            <input type="text" inputmode="decimal" class="kg-val"
                   value="${esc(feldWert(satz.stange[k]))}"
                   placeholder="zählt nicht mit"
                   data-act="scheiben-stange" data-satz="${k}"
                   aria-label="Gewicht der leeren ${esc(STANGE_LABEL[k])}">
            <span class="scheiben-mal">kg · ${esc(STANGE_LABEL[k])}</span>
          </div>`).join('')}
        <div class="small muted" style="margin-top:6px"><b>Leer lassen ist der Normalfall.</b>
          Dann meint jede Zahl an einer Übung das Scheibengewicht, und du musst beim
          Aufbauen nichts abziehen. Nur wer Gesamtgewichte will, trägt hier etwas ein –
          dann rechnet die App die Stange überall mit.</div>
      </div>

      ${geprueft.scheiben.length ? `
      <div class="scheiben-satz">
        <div class="lbl">Damit einstellbar</div>
        ${scheibenVorschau('dumbbells', 'Beide Kurzhanteln, je Hand', geprueft)}
        ${scheibenVorschau('goblet', 'Eine Kurzhantel', geprueft)}
        ${/* Nur, wenn es sie gibt. Eine SZ-Stange hat nicht jeder, und eine
              Zeile „SZ-Stange: 0 kg plus Stange – trag ihr Leergewicht ein"
              wäre eine Mahnung, etwas einzutragen, das gar nicht existiert.
              Das Eingabefeld oben steht trotzdem da: Dort sagt man, dass man
              eine hat. */
          geprueft.stange.sz === null ? '' : scheibenVorschau('szbar', 'SZ-Stange', geprueft)}
        ${scheibenVorschau('barbell', 'Langhantel', geprueft)}
      </div>` : ''}

      <div class="small muted" style="margin-top:10px">Für <strong>beide</strong> Kurzhanteln
        zählen vier Scheiben einer Größe als ein Schritt – zwei je Hantel, eine je Seite.
        Deshalb springt das Gewicht je Hand manchmal weiter, als dir lieb ist: Das liegt nicht
        an der App, sondern am Eisen. Der Rucksack bleibt außen vor, da passt ohnehin alles
        rein.</div>
    </div>`;
}
