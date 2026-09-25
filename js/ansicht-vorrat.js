/* ------------------------------------------------------------------ *
 * Was gerade da ist
 *
 *     „Ich bin bei meinen Eltern wo ich nichts hab. Also auch keine Bänder und
 *      Klimmzugstange. Kann ich das irgendwo angeben?"
 *
 * Aufgeteilt wie das Training selbst, auf Ansage:
 *
 *     „Lass doch in den Einstellungen im Equipment Bereich zwischen bodyweight
 *      und Hanteln wechseln können. Und bei bodyweight kann man dann Band rot
 *      und gelb und Klimmzugstange ankreuzen und bei Hanteln ist dann ‚alles
 *      aus bodyweight +' und dann halt die Hantel Auflistung."
 *
 * Der Umschalter ist dabei kein zweiter Modus-Schalter: Er wechselt nur, welche
 * Liste man gerade sieht. Angehakt bleibt beides – Bänder und Stange zählen in
 * beiden Modi, die Hanteln nur im Hantel-Modus, weil im Bodyweight-Modus keine
 * Übung eine braucht.
 *
 * Was das Abwählen kostet, steht darunter und wird nicht beschönigt: Ohne Band
 * und Stange bleiben im Bodyweight-Modus Muskelgruppen ohne jede Übung.
 *
 * Und daneben die Übersicht aller Übungen, einzeln an- und abwählbar –
 * dieselbe Rechnung, nur eine Ebene feiner: Dort fehlt nicht das Gerät,
 * sondern die Übung ist nicht gewollt. Was der Plan daraus macht, steht in
 * js/vorrat.js; hier steht nur, wie es aussieht.
 *
 * Welche Seite gerade gezeigt wird, weiß js/app.js – vorratKarte() bekommt sie
 * als Argument. Geändert wird hier nichts.
 * ------------------------------------------------------------------ */
import * as store from './store.js';
import { EXERCISES, PLAN } from './data.js';
import { EX_BY_ID } from './uebung.js';
import { MUSCLE_LABEL } from './body.js';
import { esc, komma1 } from './text.js';
import { plural } from './dates.js';
import { blocked } from './injuries.js';
import {
  GERAETE, ausUebungen, erfuellt, ersatzFuer, ersatzGenau, fehlt, nichtMoeglich, nichtsAbgewaehlt,
} from './vorrat.js';
import { PLAN_WEEKS, activeInjuries, exBasis, planSaetze, resolve } from './plan.js';
import { MODE_LABEL } from './anzeige.js';
import { scheibenKarte } from './ansicht-scheiben.js';

export function vorratZeile(g) {
  const da = !fehlt().includes(g.id);
  return `
    <div class="switch-row">
      <div>
        <div class="lbl">${esc(g.label)}</div>
        <div class="hint">${esc(g.hint)}</div>
      </div>
      <button type="button" class="toggle" aria-pressed="${da}" data-act="toggle-vorrat"
              data-v="${g.id}" aria-label="${esc(g.label)} vorhanden"></button>
    </div>`;
}

/**
 * Was vom Wochenvolumen übrig bleibt, je Muskelgruppe – und was nicht.
 *
 * Gerechnet wird am Plan und nicht am Katalog, und das ist der Unterschied
 * zwischen einer beruhigenden und einer wahren Zahl. Gemessen, als es hier noch
 * anders stand: Ohne Band und Klimmzugstange meldete die App „Rücken ist
 * gedeckt", weil es im Katalog das Inverted Row gab, damals an der Tischkante. Im
 * Bodyweight-Plan bleiben davon **0,0 von 10 Sätzen** je Woche übrig. Eine
 * Übung, die es gäbe, ist kein Volumen.
 *
 * Der Verlust kommt allein aus dem, was ersatzlos wegfällt: Ein Tausch trifft
 * dieselben Anteile und kostet deshalb nichts – das ist die Bedingung, unter der
 * überhaupt getauscht wird (siehe js/vorrat.js). Über den ganzen Plan und auf
 * eine Woche umgelegt, damit die Zahl nicht am heutigen Tag hängt.
 */
export function vorratBilanz(seite) {
  const soll = {};
  const bleibt = {};
  const zu = (acc, id, sets) => {
    const ex = EX_BY_ID.get(id);
    if (!ex) return;
    Object.entries(ex[seite].shares).forEach(([m, s]) => {
      acc[m] = (acc[m] || 0) + sets * s;
    });
  };
  PLAN.forEach((w) => {
    planSaetze(w, seite).forEach((it) => zu(soll, it.id, it.sets));
    exBasis(w, seite).forEach((it) => zu(bleibt, it.id, it.sets));
  });
  // Verglichen wird mit dem, was *dieser* Plan vorsieht, und nicht mit TARGET.
  // Zwei Gruende: Nacken und vordere Schulter haben gar kein eigenes Ziel – ihr
  // Wert faellt aus den uebrigen Gleichungen, und `TARGET[m] ?? 10` waere dort
  // eine erfundene Zahl. Und die Erfahrungsstufe skaliert die Saetze, das Ziel
  // aber nicht in derselben Rechnung. Der Plan selbst weiss es genauer.
  return [...new Set([...Object.keys(soll), ...Object.keys(bleibt)])]
    .map((m) => ({
      m,
      soll: (soll[m] || 0) / PLAN_WEEKS,
      bleibt: (bleibt[m] || 0) / PLAN_WEEKS,
    }))
    // Aufgefuehrt wird, was spuerbar danebenliegt – in beide Richtungen. Ein
    // Ersatz auf denselben Hauptmuskel schiebt Nebenanteile auch nach oben.
    .filter((x) => Math.abs(x.bleibt - x.soll) >= Math.max(0.5, x.soll * 0.12))
    .sort((a, b) => a.bleibt / (a.soll || 1) - b.bleibt / (b.soll || 1));
}

// Ab wann eine Gruppe nicht mehr „etwas weniger", sondern weg ist. Ein Drittel
// des Ziels ist die Grenze, ab der Trainingsreize nachweislich nichts mehr
// halten – darunter steht die Warnung, darüber die nüchterne Zahl.
const VORRAT_KRITISCH = 0.34;

/** Was der Vorrat gerade kostet – in Übungen und in Muskelgruppen. */
export function vorratFolgen(seite) {
  if (nichtsAbgewaehlt()) {
    return `<div class="small muted" style="margin-top:10px">Alles angehakt – der Plan
      läuft, wie er gerechnet ist.</div>`;
  }
  const raus = nichtMoeglich(seite);
  const nm = (id) => resolve({ id, sets: 0 }, seite).name;
  // Getrennt aufgeführt, und das ist keine Kosmetik: Ein Tausch mit denselben
  // Anteilen kostet nichts, einer auf denselben Hauptmuskel verschiebt die
  // Nebenanteile. Beides „getauscht" zu nennen wäre die bequemere und die
  // falsche Auskunft.
  const genau = [];
  const nah = [];
  const weg = [];
  raus.forEach((id) => {
    const zu = ersatzFuer(id, seite);
    if (!zu) weg.push(nm(id));
    else (ersatzGenau(id, zu, seite) ? genau : nah).push(`${nm(id)} → ${nm(zu)}`);
  });
  const bilanz = vorratBilanz(seite);
  const kritisch = bilanz.filter((k) => k.bleibt < k.soll * VORRAT_KRITISCH)
    .map((k) => MUSCLE_LABEL[k.m] || k.m);
  const wo = seite === 'bw' ? 'Im Bodyweight-Modus' : 'Im Hantel-Modus';
  return `
    <div class="small muted" style="margin-top:10px"><b>${esc(wo)} heißt das:</b>
      ${raus.length ? `${plural(raus.length, 'Übung fällt', 'Übungen fallen')} aus dem Plan.`
        : 'nichts – keine Übung dieses Modus braucht, was fehlt.'}</div>
    ${genau.length ? `<div class="small muted">Eins zu eins getauscht: ${esc(genau.join(' · '))}
      <span class="muted">– gleiche Muskelanteile, die Wochenrechnung bleibt also
      stehen.</span></div>` : ''}
    ${nah.length ? `<div class="small muted">Ersetzt: ${esc(nah.join(' · '))}
      <span class="muted">– derselbe Hauptmuskel, aber nicht dieselbe Übung. Die
      Nebenanteile verschieben sich; wie weit, steht gleich darunter.</span></div>` : ''}
    ${weg.length ? `<div class="small muted">Ersatzlos weg: ${esc(weg.join(' · '))}</div>` : ''}
    ${bilanz.length ? `<div class="small muted" style="margin-top:6px">Je Woche bleiben dann:
      ${bilanz.map((k) => `${esc(MUSCLE_LABEL[k.m] || k.m)}
        <b>${komma1(k.bleibt)}</b> <span class="muted">statt ${komma1(k.soll)}</span>`)
        .join(' · ')} Sätze.</div>` : ''}
    ${kritisch.length ? `<div class="small muted" style="margin-top:6px">⚠️ Damit bleibt für
      <b>${esc(kritisch.join(', '))}</b> so gut wie nichts übrig – das ist kein Training
      dieser ${kritisch.length > 1 ? 'Gruppen' : 'Gruppe'} mehr, sondern eine Pause davon.
      Für ein Wochenende ist das egal, über Monate nicht.</div>` : ''}`;
}

export function vorratKarte(gewaehlteSeite) {
  const seite = gewaehlteSeite === 'bw' ? 'bw' : 'db';
  const weg = fehlt();
  return `
    <div class="section-title">Was da ist${weg.length ? ` · ${weg.length} fehlt` : ''}</div>
    <div class="card">
      <div class="small muted">Was hier nicht angehakt ist, taucht im Plan nicht auf. Die App
        sucht dann eine Übung, die denselben Muskel trifft und mit dem geht, was da ist –
        und lässt den Rest weg, statt ihn dir hinzustellen. Was das an Wochenvolumen
        verschiebt, steht unten. Zum Wiedereinschalten, wenn du zurück bist.</div>
      <div class="btn-row nav" style="margin-top:10px">
        ${[['bw', '🤸 Bodyweight'], ['db', '🏋️ Hanteln']].map(([k, label]) => `
          <button type="button" class="btn ${seite === k ? 'btn-primary' : ''}"
                  aria-pressed="${seite === k}" data-act="vorrat-seite" data-v="${k}">${label}</button>`).join('')}
      </div>
      ${seite === 'db' ? `<div class="small muted" style="margin-top:10px">Alles aus
        Bodyweight zählt hier mit – auch der Hantelplan hat Übungen am Band und an der
        Stange. Dazu:</div>` : ''}
      ${GERAETE.filter((g) => g.seite === seite).map(vorratZeile).join('')}
      ${vorratFolgen(seite)}
    </div>
    ${seite === 'db' ? scheibenKarte() : ''}`;
}

/* ------------------------------------------------------------------ *
 * Alle Übungen, nach Muskelgruppen, einzeln an- und abwählbar
 *
 *     „Mach bei den Einstellungen ne Übersicht in der man sich alle Übungen
 *      nach Muskelgruppen sortiert anzeigen lassen kann. Jede Übung soll man
 *      aktivieren und deaktivieren können. Der Plan soll sich natürlich
 *      entsprechend anpassen sodass man trotzdem alle Muskelgruppen optimal
 *      trainiert."
 *
 * Der zweite Satz war schon gebaut, nur für einen anderen Anlass: Seit dem
 * Geräte-Vorrat ersetzt der Plan jede Übung, die nicht geht – erst durch eine
 * mit denselben Anteilen, dann durch eine mit demselben Hauptmuskel. Ob sie
 * nicht geht, weil das Band fehlt oder weil jemand sie nicht mag, ist der
 * Rechnung gleich. Deshalb hängt das Abwählen an genau derselben Stelle
 * (uebungGeht() in js/vorrat.js) und nicht an einer zweiten Mechanik daneben.
 *
 * **Sortiert nach der Gruppe, die die Übung wirklich meint**, nicht nach ihrer
 * Katalogüberschrift: Der Hauptmuskel ist der mit dem höchsten Anteil, und
 * genau danach fragt jemand, der hier sucht. Dieselbe Regel wie in
 * gruppeLabel() eine Ebene weiter oben.
 *
 * **Was es kostet, steht dabei.** Unter jeder abgewählten Übung steht, wodurch
 * der Plan sie ersetzt – oder dass es keinen Ersatz gibt. Und ganz oben die
 * Wochenbilanz, dieselbe wie beim Vorrat: Eine Abwahl, deren Preis man erst
 * drei Wochen später in der Statistik sieht, wäre die Sorte stiller Änderung,
 * die diese App nicht macht.
 */
export function uebungsListe() {
  const mode = store.getState().mode === 'bw' ? 'bw' : 'db';
  const aus = new Set(ausUebungen());
  const gesperrt = blocked(activeInjuries());

  // Je Muskelgruppe die Übungen, die ihn am stärksten treffen.
  const nach = new Map();
  EXERCISES.forEach((ex) => {
    const sh = (ex[mode] || {}).shares || {};
    let top = null;
    Object.keys(sh).forEach((m) => { if (!top || sh[m] > sh[top]) top = m; });
    if (!top) return;
    if (!nach.has(top)) nach.set(top, []);
    nach.get(top).push(ex);
  });
  const gruppen = [...nach.keys()]
    .sort((a, b) => (MUSCLE_LABEL[a] || a).localeCompare(MUSCLE_LABEL[b] || b));

  const nm = (id) => resolve({ id, sets: 0 }, mode).name;
  const zeile = (ex) => {
    const an = !aus.has(ex.id);
    const sperre = gesperrt.has(ex.id);
    const ohneGeraet = an && !erfuellt((ex[mode] || {}).braucht);
    // Der Ersatz wird gegen den *ganzen* Plan gerechnet und nicht gegen eine
    // einzelne Einheit: Hier steht die Regel, nicht der Tag.
    const zu = !an ? ersatzFuer(ex.id, mode) : null;
    return `
      <div class="ex-an ${an ? '' : 'aus'}">
        <button type="button" class="ex-an-btn" data-act="toggle-uebung" data-ex="${esc(ex.id)}"
                role="switch" aria-checked="${an}"
                aria-label="${esc(nm(ex.id))} ${an ? 'abwählen' : 'anwählen'}">
          <span class="ex-an-box">${an ? '✓' : ''}</span>
          <span class="ex-an-name">${esc(nm(ex.id))}</span>
          <span class="ex-an-geraet">${esc((ex[mode] || {}).equip || '')}</span>
        </button>
        ${!an ? `<div class="ex-an-folge">${zu
          ? `Der Plan nimmt stattdessen <b>${esc(nm(zu))}</b>${
              ersatzGenau(ex.id, zu, mode) ? ' – gleiche Muskelanteile.' : ' – derselbe Hauptmuskel, andere Nebenanteile.'}`
          : 'Kein Ersatz im Katalog – die Sätze fallen ersatzlos weg.'}</div>` : ''}
        ${sperre ? '<div class="ex-an-folge">Durch eine angehakte Verletzung ohnehin gesperrt.</div>' : ''}
        ${ohneGeraet ? '<div class="ex-an-folge">Geht gerade nicht – das Gerät steht auf „nicht da".</div>' : ''}
      </div>`;
  };

  return `
    <button type="button" class="back-link" data-act="go-tab" data-tab="settings">← Mehr</button>
    <div class="section-title">Übungen</div>
    <div class="card">
      <div class="small muted">Alle ${EXERCISES.length} Übungen des Katalogs, sortiert nach dem
        Muskel, den sie am stärksten treffen. Was du abwählst, ersetzt der Plan – durch eine
        Übung mit denselben Anteilen, sonst durch eine mit demselben Hauptmuskel. Gezeigt wird
        die ${esc(MODE_LABEL[mode])}-Fassung; umstellen kannst du das eine Karte weiter oben
        unter <i>Mehr</i>.</div>
      ${vorratFolgen(mode)}
    </div>
    ${gruppen.map((g) => `
      <div class="section-title">${esc(MUSCLE_LABEL[g] || g)}</div>
      <div class="card ex-an-liste">
        ${nach.get(g).sort((a, b) => nm(a.id).localeCompare(nm(b.id))).map(zeile).join('')}
      </div>`).join('')}`;
}
