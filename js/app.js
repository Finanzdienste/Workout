/*
 * Die Oberfläche: was auf den Schirm kommt und was ein Tipp auslöst.
 *
 * Diese Datei hatte einmal 5535 Zeilen und war alles zugleich – die Rechnung
 * und ihre Anzeige. Die Rechnung steht jetzt daneben, in sechs Modulen, die
 * aufeinander aufbauen und nichts von der Oberfläche wissen:
 *
 *     text.js      Text und Zahlen fürs Auge
 *     uebung.js    die einzelne Übung nachschlagen
 *     stufen.js    Erfahrungsstufen: Startgewichte, Sätze, Aufstieg
 *     gewichte.js  Arbeitsgewichte und die Reihenfolge beim Umbauen
 *     plan.js      Termine, Übungen je Einheit, Nacharbeit, Fortschritt
 *     bilanz.js    was insgesamt geleistet wurde, über Runden hinweg
 *
 * Die Richtung ist streng: Jedes Modul benutzt nur die vor ihm, und keines
 * benutzt diese Datei. Was hier bleibt, sind die Renderfunktionen, der
 * Zustand der Oberfläche (`ui`), die Tab-Verwaltung und der Klick-Verteiler.
 * Weiter aufteilen ginge, hieße aber, `ui`, `render()` und `go()` über eine
 * Registrierung zu entkoppeln – mehr Maschinerie, als es einbringt.
 */
import { EXERCISES, FOCUS, FOKUS_ERSATZ, PLAN, PLANS, TARGET, REST } from './data.js';
import * as store from './store.js';
import { todayISO, addDays, daysBetween, fmtDate, plural, fmtMonth, monthStart, addMonths, monthGrid, WEEK_HEAD } from './dates.js';
import { mountFigure, clearFigures } from './figure.js';
import { mountBody, MUSCLE_LABEL } from './body.js';
import { INJURIES, KIND_LABEL, CARE, CARE_LABEL, injuryById, applyInjuries, blocked, weeklyImpact, combosFor, careFor, needsClearance } from './injuries.js';
import { sparkPanel } from './chart.js';
import { buildICS } from './ics.js';
import { CONFIG, hatServer } from './config.js';
import { geraeteId, melden, loeschen, adminListe } from './telemetry.js';
import { initAudio, playSound, scheduleSound, cancelSound, tonStand } from './audio.js';
import { esc, fmtNum } from './text.js';
import { EX_BY_ID, plannedReps, stufenWerte } from './uebung.js';
import { LEVELS, SAETZE_JE_STUFE, levelBeispiel, offenerAufstieg, satzFaktor, satzZahl } from './stufen.js';
import {
  STEIGERUNG_ZEILEN, aufwaermsaetze, doneWeightNote, meinSatz, naechstesGewicht,
  reifeUebungen, ruestCache, ruestHint,
  vorgezogen, workingWeight,
} from './gewichte.js';
import { RASTER, STANGE_LABEL, erreichbar, normSatz, stangeZaehlt } from './scheiben.js';
import { gruppeVon, naechsterSchritt, paare } from './supersatz.js';
import { WEEK_SESSIONS, activeInjuries, planSaetze, catchUpPlan, completedMode, defaultWorkoutNo, effDate, ersatzGrund, exBasis, exOf, firstOpen, hasAnyEntry, injuryNotes, istCustom, nachSumme, progressOf, resolve, sammleStats, shiftToToday, vorratNotiz, workoutByNo } from './plan.js';
import { bilanzAus, gesamtStats, lebenStats, pruefeAufstieg, rundenBilanz, zahl } from './bilanz.js';
import { abbruch, ausgelassen, vorneListe, vorneUm } from './muster.js';
import { erinnerungsStand, minuten } from './erinnerung.js';
import { liesMerkzettel, schreibeMerkzettel } from './merkzettel.js';
import { kannPush, pushEinrichten, pushStand } from './push.js';
import { GERAETE, bandFarbe, ersatzFuer, ersatzGenau, fehlt, nichtMoeglich, setzeVorrat, vorratVollstaendig } from './vorrat.js';

/* Trainingsfokus: js/data.js liefert alle Varianten mit (PLANS) und wählt beim
 * Laden aus, welche gilt – PLAN, TARGET und REST kommen von dort und meinen
 * überall dasselbe. Der Wechsel lädt die Seite neu, siehe 'set-focus'. */

const view = document.getElementById('view');
const tabbar = document.getElementById('tabbar');
const MODE_ICON = { db: '🏋️', bw: '🤸' };
const toastEl = document.getElementById('toast');

const MODE_LABEL = { db: 'Hanteln', bw: 'Bodyweight' };

/**
 * Läuft die App als dist/workout.html, also als eine einzige Datei?
 *
 * Dort gibt es keine Nachbardateien: Ein Verweis auf figuren.html ginge ins
 * Leere, und die Datei soll ohne Server, ohne Netz und als Mail-Anhang laufen.
 * Erkennbar ist die Lage am Skript selbst: tools/build-single.py ersetzt das
 * Modul-Skript-Element durch den eingebetteten Inhalt, und danach gibt es
 * keines mehr, das auf js/app.js zeigt.
 *
 * (Der Verweis steht hier bewusst ohne Anführungszeichen. Der Bundler prüft am
 * Ende, ob noch ein externer Verweis im Dokument steht, und würde ihn sonst in
 * diesem Kommentar finden – gefunden beim ersten Bauversuch.)
 */
const EINZELDATEI = !document.querySelector('script[src$="js/app.js"]');

/* ------------------------------------------------------------------ *
 * Erinnerung am Trainingstag
 *
 * Drei Teile, und nur der erste ist verlässlich:
 *
 *   1. Die Zahl am App-Symbol. Steht eine Einheit offen, kommt eine 1 aufs
 *      Symbol; ist sie gemacht, verschwindet sie. Sie bleibt auch stehen,
 *      wenn die App zu ist – ändern kann sie sich aber nur, während die App
 *      läuft oder der Worker geweckt wird.
 *   2. Der Merkzettel für den Service Worker. Siehe js/merkzettel.js.
 *   3. Die Anmeldung bei periodicsync. Ob Chrome den Worker dann wirklich
 *      weckt, entscheidet Chrome – deshalb wird es nicht behauptet, sondern
 *      gemessen (siehe erinnerungsZeile()).
 * ------------------------------------------------------------------ */

/** Die Einstellung, immer vollständig – auch aus einer alten Sicherung. */
function erinnerungAn() {
  const e = store.getState().erinnerung || {};
  return {
    an: !!e.an,
    werktags: minuten(e.werktags) === null ? '16:00' : e.werktags,
    wochenende: minuten(e.wochenende) === null ? '06:30' : e.wochenende,
  };
}

/**
 * Kann der Browser den Worker von sich aus wecken? (periodicSync)
 *
 * Das kann nur Chrome, und auch dort nur, wenn es gerade will. Es ist der
 * *schwächere* der beiden Wege – siehe kannErinnern().
 */
const kannWecken = () => 'serviceWorker' in navigator
  && typeof window.ServiceWorkerRegistration === 'function'
  && 'periodicSync' in window.ServiceWorkerRegistration.prototype;

/**
 * Kann diese App überhaupt an einen Trainingstag erinnern?
 *
 * Zwei Wege führen dahin, und sie sind unabhängig voneinander:
 *
 *   periodicSync   Der Browser weckt von selbst. Nur Chrome, unzuverlässig.
 *   Web Push       Ein Wecker von außen klopft. Chrome *und* Firefox.
 *
 * Hier stand jahrelang nur der erste, und das war ein handfester Fehler: In
 * Firefox ist periodicSync nicht vorhanden, der Schalter war deshalb gesperrt,
 * im Merkzettel stand `an: false` – und jeder ankommende Push lief in
 * erinnern() sofort in den Zweig „aus". Der Wecker klopfte, und die App
 * antwortete, sie sei abgeschaltet. Von außen sah das aus, als käme kein Push.
 *
 *     „Mein Handy erkennt die app immer noch nicht als eigenständig sondern
 *      Firefox"
 *
 * Ein Schalter, der wegen einer Chrome-Funktion gesperrt ist, obwohl der
 * Firefox-Weg danebenliegt und funktioniert, sperrt die Funktion aus dem
 * falschen Grund.
 */
const kannErinnern = () => kannWecken() || kannPush();

/**
 * Merkzettel und Symbol nachziehen. Läuft nach jeder Zustandsänderung – der
 * Zettel muss stimmen, wenn die App zugeht, denn danach rechnet niemand mehr.
 */
async function erinnerungPflegen() {
  const zeiten = erinnerungAn();
  const stand = erinnerungsStand(zeiten);
  const offen = !!stand;

  // Die Zahl am Symbol: nur wenn eine Einheit fällig *und* ihr Termin nicht in
  // der Zukunft liegt. Eine 1 drei Tage vorher wäre keine Erinnerung, sondern
  // Dauerzustand.
  try {
    if (navigator.setAppBadge) {
      const faelligHeute = offen && stand.tag <= todayISO();
      if (zeiten.an && faelligHeute) await navigator.setAppBadge(1);
      else if (navigator.clearAppBadge) await navigator.clearAppBadge();
    }
  } catch { /* nicht unterstützt – dann eben nicht */ }

  await schreibeMerkzettel({
    an: zeiten.an && offen,
    zeigenAb: offen ? stand.zeigenAb : 0,
    // Der Tag zusätzlich zum Zeitpunkt: Der Push kommt zur richtigen Uhrzeit
    // und fragt nur noch, *ob* etwas ansteht – siehe erinnern() in sw.js.
    tag: offen ? stand.tag : '',
    titel: offen ? stand.titel : '',
  });

  if (!zeiten.an || !kannWecken()) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    // Vier Stunden ist ein Wunsch, keine Zusage – Chrome hält sich nicht daran.
    // Kürzer anzufragen bringt nichts, länger würde Tage verschenken.
    await reg.periodicSync.register('workout-erinnerung', { minInterval: 4 * 60 * 60 * 1000 });
  } catch { /* Erlaubnis fehlt oder die App ist nicht installiert */ }
}

/**
 * Die Warnung, wenn nicht gespeichert werden kann – und die hängt daran,
 * *warum* nicht.
 *
 *   gesperrt   Privates Fenster, eingebettete Ansicht, blockierte
 *              Website-Daten. Es war nie etwas da, es geht nichts verloren,
 *              und der Ausweg ist, die Seite normal im Browser zu öffnen.
 *
 *   voll       Es ging bisher und geht jetzt nicht mehr. Hier liegt ein halbes
 *              Jahr Training im Speicher, der heutige Satz kommt nicht mehr
 *              dazu, und „öffne die Seite direkt im Browser" hilft null.
 *              Deshalb steht hier der Sicherungsknopf, und zwar sofort.
 *
 * Vorher stand für beide Lagen derselbe Satz da, und er beschrieb nur die
 * erste – ausgerechnet in der zweiten, in der wirklich etwas auf dem Spiel
 * steht, gab die App den falschen Rat.
 */
function speicherWarnung() {
  const grund = store.speicherGrund();
  if (!grund) return '';
  if (grund === 'voll') {
    return `<div class="notice warn">⚠️ <b>Der Speicher dieses Browsers ist voll.</b>
      Was du gerade einträgst, wird <b>nicht</b> gespeichert – der bisherige Stand liegt
      noch da. Jetzt sichern, dann unter <i>Mehr → Daten</i> aufräumen.
      <button type="button" class="btn btn-block" data-act="backup-now"
              style="margin-top:10px">Jetzt sichern</button></div>`;
  }
  return `<div class="notice warn">⚠️ Dieser Browser lässt keine Speicherung zu – Eintragungen
    gehen beim Neuladen verloren. Im privaten Modus oder in einer eingebetteten Ansicht?
    Dann die Seite direkt im Browser öffnen.</div>`;
}

/** Der Hinweis auf dem Dashboard, bis er weggetippt wird. */
/**
 * „Diese Gewichte stehen" – der einzige Ort, an dem die App zum Steigern rät.
 *
 * **Wo er nicht steht, und das ist der wichtigere Teil:** nicht in renderFocus,
 * nicht unter der Gewichtszeile, nicht zwischen zwei Sätzen, nicht in
 * ruestHint, nicht als Meldung nach dem Abschluss. Im Training wird trainiert.
 * Die Satzfrage stand einmal mitten drin und ist auf Ansage geflogen; das hier
 * ist die Fassung, die aus dieser Entscheidung folgt.
 *
 * Drei Sperren, jede aus einem eigenen Grund:
 *
 *   Laufende Einheit   renderDashboard ist nicht nur die Vorschau, sondern im
 *                      Listenmodus auch die laufende Trainingsansicht. Ohne
 *                      diese Sperre stünden die Knöpfe mitten im Satz da.
 *   Nur die fällige    ui.workoutNo folgt dem Blättern, nicht dem Kalender. Wer
 *                      vorspult, soll keine Gewichte für einen Termin in drei
 *                      Wochen setzen.
 *   Cut               *„Im Cut-Fokus ganz schweigen."* Der Cut-Plan sagt in
 *                      dieser App selbst: „Im Defizit hält die Last die
 *                      Muskeln, nicht das Volumen." Ein Hinweis, der dabei zum
 *                      Steigern rät, widerspricht dem eigenen Text. Es hängt am
 *                      Fokus und nicht an der Waage – die App verhält sich nie
 *                      unbemerkt anders, weil sie eine Zahl gesehen hat.
 */
function steigerungHinweis(n, items) {
  const s = store.getState();
  if (s.focus === 'cut') return '';
  if (s.session && s.session.n === n) return '';
  if (n !== defaultWorkoutNo()) return '';
  const reif = reifeUebungen(items).slice(0, STEIGERUNG_ZEILEN);
  if (!reif.length) return '';
  const malWort = ['', 'einmal', 'zweimal', 'dreimal', 'viermal', 'fünfmal', 'sechsmal'];
  return `
    <div class="notice">
      <strong>Diese Gewichte stehen</strong>
      ${reif.map((r) => `
        <div class="small" style="margin-top:8px">${esc(r.name)}:
          ${esc(malWort[Math.min(r.mal, 6)] || `${r.mal}-mal`)} zuletzt alle Sätze bei
          ${esc(fmtNum(r.jetzt))} kg, seit dem ${esc(fmtDate(r.seit))}.</div>
        <div class="btn-row">
          <button type="button" class="btn btn-primary" data-act="steigern"
                  data-ex="${esc(r.id)}" data-name="${esc(r.name)}"
                  >auf ${esc(fmtNum(r.ziel))} kg</button>
          <button type="button" class="btn btn-ghost" data-act="steigern-nein"
                  data-ex="${esc(r.id)}" data-name="${esc(r.name)}"
                  >bleibt bei ${esc(fmtNum(r.jetzt))} kg</button>
        </div>`).join('')}
      <div class="small muted" style="margin-top:8px">Wie schwer die Sätze waren, weiß die
        App nicht – nur, dass alle standen. War das Gewicht noch schwer genug, bleib dabei.</div>
    </div>`;
}

function aufstiegHinweis() {
  const a = store.getState().aufstieg;
  if (!a) return '';
  const name = (k) => (LEVELS.find(([key]) => key === k) || [])[1] || k;
  const vorher = SAETZE_JE_STUFE[a.von] || 3;
  const jetzt = SAETZE_JE_STUFE[a.nach] || 3;
  return `
    <div class="notice aufstieg" style="margin:0 0 12px">
      <strong>Aufgestiegen: ${esc(name(a.nach))}</strong>
      <div class="small" style="margin-top:6px">
        Insgesamt ${a.einheiten} Einheiten${a.tonnen ? ` und ${fmtNum(a.tonnen)} Tonnen bewegt` : ''} –
        das ist keine Anfängerlast mehr. Ab jetzt stehen ${jetzt} statt ${vorher} Sätze je
        Übung im Plan; Übungen, Pausen und die Verteilung über die Woche bleiben, wie sie
        sind. Deine eingetragenen Gewichte rührt das nicht an.
        ${store.getState().rounds.length ? `<div style="margin-top:6px">Gezählt über alle
          Runden, nicht nur die laufende – ein Neustart oder ein Wechsel des Fokus wirft
          dich nicht zurück.</div>` : ''}
      </div>
      <!-- Kein „Bei Anfänger bleiben" mehr daneben. Ein Knopf, der die Messung
           überstimmt, macht aus der Stufe wieder eine Meinung über sich selbst:
           *„Selbst sollte man diese Einstufung ja nie verändern."* Der Hinweis
           sagt, was passiert ist; wegtippen kann man ihn, umstoßen nicht. -->
      <div class="btn-row nav" style="margin-top:10px">
        <button type="button" class="btn btn-primary" data-act="aufstieg-ok">Passt</button>
      </div>
    </div>`;
}

/* ------------------------------------------------------------------ *
 * Abgeschaffter Trainingsfokus
 *
 * Der Fokus steht im Browser, der Plan in der App. Wird eine Variante
 * gestrichen, treffen sich beim nächsten Laden ein Schlüssel und kein Plan.
 * js/data.js löst das für sich – es lädt den benannten Nachfolger, sonst
 * stünde die halbe App ohne Übungen da. Aber `state.focus` zeigt danach noch
 * auf den alten Wert, und zwei Angaben, die dasselbe meinen sollen, liefen von
 * da an dauerhaft auseinander:
 *
 *   * `restorable()` in js/store.js vergleicht den Fokus eines abgelegten
 *     Durchlaufs mit `state.focus`. Beide stünden auf 'kurz' – ein Protokoll
 *     aus 96 Einheiten ließe sich in einen Plan mit 84 zurückholen und
 *     markierte dort Einheiten als erledigt, die nie stattgefunden haben.
 *   * Die Fokusauswahl hätte keine Karte markiert, weil zu 'kurz' keine
 *     gehört – jeder Plan sähe nicht ausgewählt aus.
 *   * Der Rückkanal meldete weiter „Kurz und knapp" für einen Cut-Plan.
 *
 * Deshalb einmal beim Start umschreiben, und zwar auf demselben Weg wie ein
 * Wechsel von Hand: Der bisherige Verlauf wandert als eigene Runde in die
 * Ablage (mit dem *alten* Fokus als Vermerk – restartPlan() liest ihn, bevor
 * wir ihn ändern), die Gewichte bleiben stehen. Ein Protokoll nach
 * Workout-Nummer in einen anderen Plan zu übernehmen ginge nicht: Workout 12
 * hieß dort etwas anderes.
 * ------------------------------------------------------------------ */
function fokusUmzug() {
  const s = store.getState();
  const alt = s.focus;
  const ziel = FOKUS_ERSATZ[alt];
  if (!ziel || !PLANS[ziel.nach]) return false;
  // Reihenfolge: erst ablegen, dann umschreiben. restartPlan() vermerkt den
  // Fokus, der beim Training galt, und das war der alte.
  const hatteVerlauf = Object.keys(s.log || {}).length > 0;
  // **Nicht** rundenBilanz(): Die rechnet über den Plan, den die App gerade
  // geladen hat – und das ist hier schon der *Nachfolger*. js/data.js löst
  // FOKUS_ERSATZ beim Import auf, lange bevor diese Zeile läuft. Das Protokoll
  // stammt dagegen noch aus dem alten Plan, mit dessen Einheiten und Übungen.
  //
  // Gemessen, was dabei herauskam: ein Gerät mit einer vollständigen
  // „Kurz und knapp"-Runde – 96 Einheiten, 1230 Sätze – bekam eine Bilanz von
  // {0, 0, 0} in die Ablage geschrieben. Ein Cut-Plan gegen ein Kurz-Protokoll
  // gezählt findet fast keine Übung wieder, und die zwölf Einheiten 85–96 sieht
  // er überhaupt nicht. Weil bilanzAus() eine vorhandene Bilanz unbesehen
  // zurückgibt, wäre die Null endgültig gewesen – ausgerechnet auf dem einen
  // Weg, für den die ganze Rechnerei gebaut ist.
  //
  // bilanzAus() nimmt den Fokus der Runde als Ausgangspunkt und kommt deshalb
  // auf die richtigen Zahlen. Es bekommt hier eine Runde gereicht, die es so
  // gleich noch einmal sieht – dieselbe Rechnung, nur eben rechtzeitig.
  store.wechsleFokus(ziel.nach, bilanzAus({ log: s.log, focus: alt }), frischerStart());
  store.setSetting('fokusUmzug', {
    von: ziel.name, nach: PLANS[ziel.nach].name, am: todayISO(), abgelegt: hatteVerlauf,
  });
  return true;
}

/* ------------------------------------------------------------------ *
 * Der Plan hat sich geändert
 *
 * Ein Protokoll steht nach Workout-Nummer. Kommen Übungen in den Katalog und
 * verteilt der Generator neu, steckt hinter Nummer 3 etwas anderes als an dem
 * Tag, an dem sie abgehakt wurde – und die App behauptete rückwirkend, es sei
 * schon immer das gewesen. Das ist derselbe Fehler wie beim Fokuswechsel, nur
 * ohne dass jemand darauf getippt hätte.
 *
 * Deshalb trägt jede Planvariante seit js/data.js einen Fingerabdruck ihrer
 * Inhalte. Stimmt er nicht mehr mit dem überein, unter dem der laufende Verlauf
 * entstanden ist, wandert dieser in die Ablage und der neue Plan fängt sauber
 * an. Verloren geht dabei nichts: Gewichte bleiben, Statistik, Kalender und
 * Trainingstage rechnen über alle Protokolle (siehe lebenStats()).
 *
 * Termine gehen in den Fingerabdruck nicht ein – die verschieben sich im
 * Betrieb ständig und ändern nichts an dem, was zu tun ist.
 * ------------------------------------------------------------------ */
function planWechsel() {
  const s = store.getState();
  const fokus = s.focus || 'standard';
  const jetzt = (PLANS[fokus] || {}).stand || '';
  const vorher = (s.planStand || {})[fokus];
  if (!jetzt) return false;
  // Beim ersten Mal steht nichts da. Das ist kein Wechsel, sondern der Anfang
  // der Buchführung – sonst legte dieses Merkmal bei seiner Einführung jeden
  // laufenden Verlauf einmal weg.
  if (vorher === undefined || vorher === jetzt) {
    if (vorher !== jetzt) {
      store.setSetting('planStand', { ...(s.planStand || {}), [fokus]: jetzt });
    }
    return false;
  }
  const hatVerlauf = Object.keys(s.log || {}).length > 0;
  if (hatVerlauf) store.restartPlan(0, rundenBilanz());
  store.setSetting('planStand', { ...(s.planStand || {}), [fokus]: jetzt });
  return hatVerlauf;
}

/** Der Hinweis dazu auf dem Dashboard, bis er weggetippt wird. */
function umzugHinweis() {
  const u = store.getState().fokusUmzug;
  if (!u) return '';
  const abgelegt = !!u.abgelegt;
  return `
    <div class="notice aufstieg" style="margin:0 0 12px">
      <strong>„${esc(u.von)}" gibt es nicht mehr</strong>
      <div class="small" style="margin-top:6px">
        Aus sechs Plänen sind vier geworden – zwei Paare meinten fast dasselbe. Du stehst
        jetzt auf <b>${esc(u.nach)}</b>, dem Plan, der am nächsten dran ist. Deine Gewichte,
        Bänder und Zusatzwiederholungen bleiben unverändert.
        ${abgelegt ? ' Dein bisheriger Verlauf ist unter <i>Mehr → Daten</i> abgelegt; '
          + 'zurückholen lässt er sich nicht, weil hinter Workout 12 andere Übungen stehen '
          + 'als vorher.' : ''}
      </div>
      <div class="btn-row nav" style="margin-top:10px">
        <button type="button" class="btn btn-primary" data-act="umzug-ok">Verstanden</button>
        <button type="button" class="btn btn-ghost" data-act="umzug-waehlen">Anderen Plan wählen</button>
      </div>
    </div>`;
}

/**
 * Sicherung als Datei. Alles liegt nur im Speicher dieses Browsers – Android
 * räumt den bei Platzmangel weg, und "Websitedaten löschen" reicht ebenfalls.
 * Deshalb wird der Stand mitgeschrieben, um später erinnern zu können.
 */
function downloadBackup() {
  const json = store.exportJSON();
  // Manche Umgebungen – eingebettete Ansichten, strenge Browser – lassen den
  // Download stillschweigend fallen. Deshalb steht der Export danach immer
  // auch im Textfeld zum Kopieren.
  const io = document.getElementById('io');
  if (io) io.value = json;
  const blob = new Blob([json], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `workout-backup-${todayISO()}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  store.markBackup(doneCount());
  toast('Gesichert – falls kein Download kam: Text in „Mehr“ kopieren');
}

/* ------------------------------------------------------------------ *
 * Daten, die den Tag überleben
 *
 * Alles liegt im Speicher eines Browsers. Zwei verschiedene Arten, das zu
 * verlieren, und zwei verschiedene Antworten:
 *
 *   Der Browser räumt auf   Android gibt den Speicher einer selten benutzten
 *                           Seite bei Platzmangel frei. Dagegen hilft eine
 *                           Zusage, die man erfragen kann: storage.persist().
 *                           Kostet einen Aufruf und hält, solange die App
 *                           installiert bleibt.
 *   Das Gerät ist weg       Dagegen hilft nur eine Kopie *woanders*. Ein
 *                           Download landet im Ordner „Downloads" desselben
 *                           Handys – das ist keine Kopie, das ist dieselbe
 *                           Stelle mit einem anderen Namen. Deshalb der
 *                           Teilen-Weg: Die Datei geht an Drive, an eine Mail
 *                           an sich selbst, an was auch immer da ist.
 *
 * Was hier bewusst *nicht* passiert: die Sicherung von selbst irgendwohin
 * schicken. Der Rückkanal an den Betreiber trägt eine Handvoll Zahlen und ist
 * abschaltbar; ein vollständiger Trainingsverlauf ist etwas anderes, und der
 * geht nur dorthin, wohin er ausdrücklich geschickt wird.
 * ------------------------------------------------------------------ */

/**
 * Den Browser bitten, diese Daten nicht von selbst wegzuräumen.
 *
 * Einmal beim Start. Chrome sagt das für installierte Apps meist ohne
 * Rückfrage zu und im gewöhnlichen Tab meist nicht – deshalb wird das Ergebnis
 * gemerkt und angezeigt, statt es zu behaupten.
 */
async function speicherFestnageln() {
  if (!navigator.storage || !navigator.storage.persist) return;
  try {
    const schon = navigator.storage.persisted ? await navigator.storage.persisted() : false;
    const ok = schon || await navigator.storage.persist();
    if (store.getState().dauerhaft !== ok) store.setSetting('dauerhaft', ok);
  } catch { /* kennt der Browser nicht – dann eben nicht */ }
}

/**
 * Die Sicherung weitergeben statt herunterladen.
 *
 * Fällt auf den Download zurück, wo es das Teilen nicht gibt oder es abgelehnt
 * wird – und zwar still: „Teilen abgebrochen" ist keine Meldung wert, das war
 * eine Entscheidung.
 */
async function teileBackup() {
  const json = store.exportJSON();
  const datei = new File([json], `workout-backup-${todayISO()}.json`,
    { type: 'application/json' });
  if (navigator.canShare && navigator.canShare({ files: [datei] })) {
    try {
      await navigator.share({ files: [datei], title: 'Workout-Sicherung' });
      store.markBackup(doneCount());
      render();
      return;
    } catch { return; }   // abgebrochen – kein Grund für eine Meldung
  }
  downloadBackup();
}

/**
 * Eine Sicherungsdatei wieder einlesen.
 *
 * Die App konnte eine Datei schreiben, aber nicht lesen – der Import nahm nur
 * eingefügten Text. Auf dem Rechner ist das lästig, auf dem Handy eine Sperre:
 * Wer von einem Browser in die installierte App umzieht, müsste einen langen
 * JSON-Block von Hand markieren und kopieren. Genau dieser Umzug ist aber der
 * häufigste Grund, überhaupt eine Sicherung zu brauchen.
 *
 * Das Dateifeld wird bei jedem Aufruf neu gebaut und danach weggeworfen: Ein
 * dauerhaft im DOM stehendes Feld behält die zuletzt gewählte Datei, und
 * zweimal dieselbe Datei zu wählen löst dann kein `change` mehr aus.
 */
function importBackupDatei() {
  const feld = document.createElement('input');
  feld.type = 'file';
  // Nicht nur .json: Manche Dateimanager reichen die Sicherung als text/plain
  // weiter, und dann stünde die eigene Datei ausgegraut da.
  feld.accept = 'application/json,text/plain,.json,.txt';
  feld.addEventListener('change', () => {
    const datei = feld.files && feld.files[0];
    if (!datei) return;
    datei.text()
      .then((text) => {
        store.importJSON(text);
        // Nach dem Import gilt der eingelesene Stand – auch die Einrichtung,
        // die gerade noch offen war.
        ui.setupStep = 0;
        render();
        toast(`Eingelesen: ${datei.name}`);
      })
      .catch((err) => toast(`Import fehlgeschlagen: ${err.message}`));
  });
  feld.click();
}

/**
 * Trainingstermine als Kalenderdatei.
 *
 * Geschrieben werden die *tatsächlichen* Termine – verschobene inbegriffen –
 * mit fester Kennung je Workout. Wird die Datei nach einer Verschiebung erneut
 * eingelesen, wandern dieselben Termine mit, statt sich zu verdoppeln.
 */
function downloadICS() {
  const vorher = store.getState().lastIcs;
  const stand = store.markIcs(PLAN.length);
  // Was beim letzten Mal exportiert wurde und diesmal nicht mehr vorkommt, muss
  // aus dem Kalender wieder heraus: ein anderer Trainingsfokus hat womöglich
  // weniger Einheiten, und ein Tag, an dem Verletzungen alles sperren, hat gar
  // keinen Termin mehr.
  const jetzt = new Set(PLAN.filter((w) => exOf(workoutByNo(w.n)).length).map((w) => w.n));
  const cancel = [];
  for (let n = 1; n <= Math.max((vorher && vorher.count) || 0, PLAN.length); n++) {
    if (!jetzt.has(n)) cancel.push(n);
  }
  const text = buildICS(
    PLAN.map((w) => ({ n: w.n, date: effDate(w) })),
    (w) => exOf(workoutByNo(w.n, store.workoutMode(w.n)), store.workoutMode(w.n))
      .map((it) => resolve(it, store.workoutMode(w.n))),
    { hour: 18, seq: stand.seq, cancel },
  );
  const blob = new Blob([text], { type: 'text/calendar;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `workout-termine-${todayISO()}.ics`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  toast('Kalenderdatei erstellt – in Google Kalender importieren');
}

/**
 * Alle Trainingstermine wieder aus dem Kalender austragen.
 *
 * Die Gegenrichtung zu downloadICS(), und sie braucht kein Konto und keine
 * Anbindung: Weil jeder Termin seine feste Kennung trägt, genügt eine Datei
 * mit lauter Absagen. Der Kalender ordnet sie über die Kennung den vorhandenen
 * Einträgen zu und räumt sie weg.
 *
 * Abgesagt wird die *größte* Einheitenzahl über alle Fokus-Varianten, nicht
 * nur die des eigenen Plans: Wer den Fokus einmal gewechselt hat, hat womöglich
 * Termine mit höheren Nummern im Kalender, und die sollen genauso verschwinden.
 * Eine Absage für eine Kennung, die es nie gab, ist folgenlos.
 */
function downloadICSAus() {
  const stand = store.markIcs(0);
  // Abgesagt wird nach Terminnummer, und abzusagen ist, was *jemals* in einem
  // Kalender gelandet sein kann – nicht, was heute im längsten Plan steht.
  // „Kurz und knapp" hatte 96 Einheiten und gibt es nicht mehr; wer damals
  // importiert hat, hat 96 Termine stehen. Mit der heutigen Höchstzahl (84)
  // blieben zwölf davon für immer im Kalender. Die Zahl darf deshalb nur
  // steigen, nie fallen – eine Absage für einen Termin, den es nie gab,
  // kostet nichts, ein übrig gebliebener Termin dagegen schon.
  const JE_EXPORTIERT = 96;
  const groesste = Math.max(JE_EXPORTIERT, ...Object.values(PLANS).map((v) => v.plan.length));
  const cancel = Array.from({ length: groesste }, (_, i) => i + 1);
  const text = buildICS([], () => [], { hour: 18, seq: stand.seq + 1000, cancel });
  const blob = new Blob([text], { type: 'text/calendar;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `workout-termine-austragen-${todayISO()}.ics`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  toast(`${cancel.length} Absagen erzeugt – importieren, dann sind die Termine weg`);
}

/** Stimmen die Termine im Kalender noch, oder hat sich der Plan seither verschoben? */
function icsStale() {
  const s = store.getState();
  return !!s.lastIcs && s.lastIcs.shift !== s.shift;
}

/** Zahl der abgeschlossenen Einheiten in dieser Runde. */
function doneCount() {
  return PLAN.filter((w) => completedMode(w.n)).length;
}

/** Wie viele Einheiten seit der letzten Sicherung dazugekommen sind. */
const BACKUP_EVERY = 8;

function backupDue() {
  const done = doneCount();
  const last = store.getState().lastBackup;
  if (!last) return done >= 3 ? done : 0;
  return done - last.done >= BACKUP_EVERY ? done - last.done : 0;
}

/**
 * Abschluss eines laufenden Trainings: zwei Wege, klar getrennt.
 *
 * "Abschließen" behält, was abgehakt ist – auch wenn nicht alles steht.
 * "Abbrechen" verwirft die Einheit ganz, damit sie als nicht trainiert gilt
 * und der Plan sie behandelt wie einen verpassten Tag. Ohne diese Trennung
 * blieb nach jedem Abbruch ein halb abgehaktes Workout stehen.
 */
function sessionButtons(n, mode) {
  const prog = progressOf(n, mode);
  return `
    <div class="btn-row nav">
      <button type="button" class="btn btn-danger" data-act="discard-session">Abbrechen</button>
      <button type="button" class="btn btn-ok" data-act="finish-session">
        ✓ Abschließen${prog.done ? ` (${prog.done}/${prog.total})` : ''}
      </button>
    </div>`;
}

/** Pausenlänge für eine Übung – empfohlen oder fest, je nach Einstellung. */
function restFor(item) {
  const s = store.getState();
  if (!s.useExerciseRest) return s.restSeconds;
  return item.rest;
}

/* ------------------------------------------------------------------ *
 * Pausentimer
 * ------------------------------------------------------------------ */

const restBar = document.getElementById('restBar');
const restTime = document.getElementById('restTime');
const restNext = document.getElementById('restNext');
const restFill = document.getElementById('restFill');
const restLive = document.getElementById('restLive');
const restLabel = document.getElementById('restLabel');

/** Ansage für Screenreader – nur zum Anfang und Ende, nicht im Sekundentakt. */
function announce(text) {
  if (restLive) restLive.textContent = text;
}

let restTicker = null;
let wakeLock = null;
let restArmed = false;   // liegt das Pausensignal schon auf der Audio-Uhr?

/**
 * Vorwarnung vor dem Ende der Pause.
 *
 * Zwischen dem Signal und dem ersten Wiederholung liegen sonst noch der Weg zur
 * Hantel und das Zurechtlegen – die Pause ist damit in Wahrheit länger als
 * geplant. Fünf Sekunden vorher kommt deshalb ein leiserer, tieferer Ton, und
 * die Leiste schaltet auf "Fertig machen" um. Beim Signal selbst steht man dann
 * schon an der Stange.
 */
const VORLAUF = 5;

/**
 * Ton zu einem Ereignis – Training starten, Satz abhaken, Übung fertig,
 * Workout komplett. Die Töne selbst stehen in js/audio.js.
 *
 * Der Tupfer beim Abhaken hat einen eigenen Schalter: Er kommt in einem
 * Training zwanzigmal, und ob man das mag, ist Geschmackssache – die
 * Ereignisse drumherum kommen ein- bis zweimal und stören niemanden.
 */
function sound(name) {
  const s = store.getState();
  if (!s.sound) return;
  if (name === 'set' && !s.soundSets) return;
  playSound(name);
}

/* Hinweis zum Pausenende, wenn die App gerade nicht im Vordergrund ist.
 *
 * Der Ton allein reicht dafür nicht immer: Schaltet man während der Pause zu
 * einer anderen App, darf der Browser die Seite einfrieren. Der vorausgelegte
 * Ton übersteht das meistens (siehe js/audio.js), eine Systemmeldung kommt
 * zusätzlich auch dann noch an, wenn er es nicht tut – und sie ist sichtbar,
 * nicht nur hörbar. Sie braucht eine Erlaubnis, deshalb ein eigener Schalter
 * unter Mehr statt einer Nachfrage beim ersten Start.
 *
 * Was auch das nicht kann: die App komplett schließen und trotzdem klingeln.
 * Dafür bräuchte es einen Server, der eine Push-Nachricht schickt – die App
 * hat keinen und soll keinen haben. */
const NOTE_TAG = 'workout-pause';
let noteTimer = null;
let swPause = false;   // zaehlt der Service Worker gerade eine Pause mit?

/** Registrierung des Service Workers, immer als Promise – auch ohne ihn. */
function swReg() {
  try {
    return navigator.serviceWorker?.getRegistration() || Promise.resolve(null);
  } catch {
    return Promise.resolve(null);
  }
}

/** Vom Browser blockiert – dann hilft kein Schalter in der App mehr. */
function notifyDenied() {
  return 'Notification' in window && Notification.permission === 'denied';
}

function noteAllowed() {
  return store.getState().notify && 'Notification' in window
    && Notification.permission === 'granted';
}

/**
 * Die laufende Pause an den Service Worker uebergeben.
 *
 * Frueher lag der Wecker hier: ein setTimeout auf das Ende, dazu jede Sekunde
 * eine ersetzte Meldung mit dem Countdown. Beides haengt an der Seite – und die
 * friert Android im Hintergrund ein, spaetestens bei ausgeschaltetem
 * Bildschirm. Dann stand die Zahl, und das Signal kam gar nicht.
 *
 * Der Worker haengt nicht an der Seite (siehe sw.js). Er bekommt einmal den
 * Endzeitpunkt und macht den Rest allein. Bleibt der Wecker hier als Rueckfall,
 * falls es keinen Worker gibt – ohne ihn gaebe es sonst gar keine Meldung.
 */
function planNote(secs, text) {
  dropNote();
  if (!noteAllowed()) return;

  const endet = Date.now() + Math.max(0, secs) * 1000;
  if (navigator.serviceWorker?.controller) {
    navigator.serviceWorker.controller.postMessage({
      typ: 'pause-start', endet, text, sichtbar: !document.hidden,
    });
    swPause = true;
    return;
  }

  noteTimer = setTimeout(() => {
    noteTimer = null;
    // Nur, wenn die App gerade nicht zu sehen ist: Wer davorsitzt, hört den Ton
    // und sieht die Leiste – eine Systemmeldung wäre da nur Lärm.
    if (!document.hidden) return;
    const opt = {
      body: text,
      tag: NOTE_TAG,          // ersetzt eine ältere, statt sie zu stapeln
      // Nur `badge`, und nicht das App-Symbol: Mit `icon` daneben zeichnet
      // Android dieselbe Hantel zweimal, und als Schablone taugt icon-192.png
      // nicht – sie ist deckend, es bliebe ein weisser Kasten. Siehe badge.svg.
      badge: './badge-96.png',
      vibrate: [180, 90, 180],
    };
    swReg().then((reg) => {
      if (reg) reg.showNotification('Pause vorbei', opt);
      else new Notification('Pause vorbei', opt);
    }).catch(() => {});
  }, Math.max(0, secs) * 1000);
}

/**
 * Beim Verlassen der App: Wenn heute noch etwas ansteht, die Erinnerung wieder
 * hinlegen.
 *
 * *„Mach so dass ich es nicht weg wischen kann."* Wegwischen selbst faengt der
 * Worker schon ab – er zeigt die Meldung erneut. Die Lücke war eine andere: Wer
 * sie *antippt*, um kurz etwas nachzusehen, hatte sie damit für den Tag
 * verbraucht, ohne trainiert zu haben. Genau dieser Weg ist der wahrscheinliche.
 *
 * Deshalb sagt die Seite dem Worker beim Weggehen Bescheid, und der entscheidet
 * wie sonst auch: nur wenn die Erinnerung an ist, die Uhrzeit erreicht, heute
 * eine Einheit offen und „Heute nicht" nicht getippt. Ein Feuerwerk wird daraus
 * nicht – die Meldung trägt eine feste Kennung und ersetzt sich selbst.
 */
function erinnerungNachlegen() {
  if (!erinnerungAn().an) return;
  navigator.serviceWorker?.controller?.postMessage({ typ: 'erinnerung-wieder' });
}

/** Dem Worker sagen, ob die App gerade vorn ist. */
function swSichtbar(an) {
  navigator.serviceWorker?.controller?.postMessage({ typ: 'sichtbar', an });
}

/** Eine sichtbare Meldung schließen, ohne den Wecker abzubestellen. */
function closeNote() {
  swReg()
    .then((reg) => (reg ? reg.getNotifications({ tag: NOTE_TAG }) : []))
    .then((list) => list.forEach((nt) => nt.close()))
    .catch(() => {});
}

/** Wecker abbestellen und eine schon sichtbare Meldung schließen. */
function dropNote() {
  clearTimeout(noteTimer);
  noteTimer = null;
  if (swPause) {
    swPause = false;
    navigator.serviceWorker?.controller?.postMessage({ typ: 'pause-aus' });
  }
  closeNote();
}

/**
 * Ton und Hinweis auf das Ende der laufenden Pause legen.
 *
 * Bei jeder Änderung neu: Start, „+30 s", und auch beim Umlegen der Schalter,
 * damit eine schon laufende Pause der neuen Einstellung folgt.
 */
function armRest() {
  const rest = store.getState().rest;
  if (!rest) {
    cancelSound();
    dropNote();
    restArmed = false;
    return;
  }
  const left = (rest.endsAt - Date.now()) / 1000;
  if (store.getState().sound) {
    restArmed = scheduleSound([['ready', left - VORLAUF], ['rest', left]]);
  } else {
    cancelSound();
    restArmed = false;
  }
  planNote(left, rest.next);
}

/**
 * Displaysperre während der Pause. Ohne sie schläft das Handy ein, der Browser
 * friert die Seite ein – und der Ton käme zu spät oder gar nicht.
 */
async function holdScreen(on) {
  try {
    if (on) {
      if (!wakeLock && navigator.wakeLock) wakeLock = await navigator.wakeLock.request('screen');
    } else if (wakeLock) {
      await wakeLock.release();
      wakeLock = null;
    }
  } catch {
    wakeLock = null; // nicht unterstützt oder abgelehnt – kein Beinbruch
  }
}

function startRest(exName, setIndex, sets, secs) {
  if (!secs) return;
  store.setRest({
    endsAt: Date.now() + secs * 1000,
    total: secs,
    next: `Satz ${setIndex + 2} von ${sets} · ${exName}`,
  });
  announce(`Pause ${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')} Minuten, `
    + `danach Satz ${setIndex + 2} von ${sets}, ${exName}`);
  holdScreen(true);
  armRest();
  tickRest();
}

function endRest(withSignal) {
  if (!restBar) return;
  if (restTicker) { clearInterval(restTicker); restTicker = null; }
  holdScreen(false);
  store.setRest(null);
  restBar.hidden = true;
  restBar.classList.remove('ready');
  document.body.classList.remove('resting');
  // Das Signal liegt längst auf der Audio-Uhr und hat gerade selbst gespielt –
  // hier noch einmal anzustoßen, gäbe ein Echo. Nur wenn das Voraussetzen nicht
  // geklappt hat (kein Ton freigeschaltet, Browser ohne Web Audio), kommt der
  // Ton jetzt. cancelSound() lässt ein bereits laufendes Signal ausklingen.
  if (withSignal && !restArmed) sound('rest');
  cancelSound();
  // Bei einer abgebrochenen Pause den Hinweis abbestellen – bei einer
  // abgelaufenen gerade nicht: Diese Zeile läuft bis zu eine halbe Sekunde vor
  // dem Ende (der Timer prüft im Vierteltakt und rundet), der Wecker soll aber
  // noch losgehen, falls die App im Hintergrund ist.
  if (!withSignal) dropNote();
  restArmed = false;
  if (withSignal) {
    if (navigator.vibrate) navigator.vibrate([180, 90, 180]);
    announce('Pause vorbei, nächster Satz');
  } else {
    announce('');
  }
}

function tickRest() {
  // Sollten Seite und Skript aus unterschiedlich alten Zwischenspeichern
  // stammen, fehlt die Leiste - dann lieber ohne Timer weiterlaufen als alles
  // mit einem Fehler anhalten.
  if (!restBar) return;
  const rest = store.getState().rest;
  if (!rest) { restBar.hidden = true; document.body.classList.remove('resting'); return; }

  const left = Math.round((rest.endsAt - Date.now()) / 1000);
  if (left <= 0) {
    endRest(true);
    toast('Pause vorbei – nächster Satz');
    return;
  }

  restBar.hidden = false;
  document.body.classList.add('resting');
  // Die letzten Sekunden gehören dem Weg zur Hantel, nicht mehr der Pause.
  const gleich = left <= VORLAUF;
  restBar.classList.toggle('ready', gleich);
  if (restLabel) restLabel.textContent = gleich ? 'Fertig machen' : 'Pause';
  restTime.textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
  restNext.textContent = rest.next;
  restFill.style.width = `${Math.max(0, (left / rest.total) * 100)}%`;

  if (!restTicker) restTicker = setInterval(tickRest, 250);
}

/** Laufzeit des Trainings im Kopfbereich mitzählen, ohne neu zu rendern. */
setInterval(() => {
  const badge = document.getElementById('sessionBadge');
  if (!badge || !store.getState().session) return;
  const secs = store.sessionSeconds();
  badge.textContent = `⏱ ${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
}, 1000);

document.getElementById('restSkip')?.addEventListener('click', () => endRest(false));
document.getElementById('restPlus')?.addEventListener('click', () => {
  const rest = store.getState().rest;
  if (!rest) return;
  store.setRest({ ...rest, endsAt: rest.endsAt + 30000, total: rest.total + 30 });
  armRest(); // Signal 30 s weiter hinten neu auflegen
  tickRest();
});

let toastTimer = null;
function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2200);
}

/* ------------------------------------------------------------------ *
 * UI-Zustand (nicht persistiert)
 * ------------------------------------------------------------------ */

// Alle Seiten, die es gibt – auch die ohne Reiter unten. Welche unten stehen,
// entscheidet TABS weiter hinten; hier geht es nur darum, welchen gespeicherten
// Wert `tab` überhaupt annehmen darf.
const SEITEN = ['dashboard', 'calendar', 'stats', 'injuries', 'custom', 'settings', 'admin'];

const ui = {
  // Beim Neuladen im selben Tab bleiben. Die Seite lädt öfter neu, als man
  // denkt – nach einer Aktualisierung etwa –, und jedes Mal auf dem Dashboard
  // zu landen ist lästig.
  tab: SEITEN.includes(store.getState().tab) ? store.getState().tab : 'dashboard',
  workoutNo: naechsteEinheit(),
  openEx: new Set(),
  openDetail: new Set(),   // Übungen, deren ausführliche Erklärung offen steht
  standAngebot: null,      // Stand, den jemand per Link geschickt hat
  standZurueck: null,      // Name, dem man seinen Stand noch zurückschicken wollte
  adminDaten: null,        // geladene Zeilen der Betreiber-Übersicht
  adminFehler: '',
  // Der Einrichtungstext für Web Push, solange er angezeigt wird. Bewusst nur
  // im Arbeitsspeicher: Er enthält den privaten Schlüssel und hat im
  // gespeicherten Zustand nichts zu suchen – von dort käme er in jede Sicherung.
  pushText: '',
  adminLaeuft: false,
  customDraft: null,       // Entwurf im Baukasten für eigene Workouts
  setupStep: 0,            // Schritt im Einstieg: Name, Farbe, Fokus
  openInjury: new Set(),
  // Welche Seite des Geräte-Vorrats offen steht: 'bw' oder 'db'. Fängt bei dem
  // Modus an, in dem gerade trainiert wird – wer mit Hanteln arbeitet, sucht
  // die Hanteln.
  vorratSeite: store.getState().mode === 'bw' ? 'bw' : 'db',
  focus: false,    // Fokus-Ansicht: eine Übung groß
  listView: false, // Übungsliste statt Startansicht
  focusIdx: 0,
  // Kalender: gezeigter Monat und der angetippte Tag. Beides fängt bei der
  // nächsten offenen Einheit an, nicht stur bei heute – wer den Tab öffnet,
  // will meistens wissen, was als Nächstes kommt.
  calMonth: null,
  calDay: null,
};

/* ------------------------------------------------------------------ *
 * Dashboard
 * ------------------------------------------------------------------ */

/** Index der ersten Übung, in der noch ein Satz offen ist. */
function firstOpenExercise(n, mode) {
  const w = workoutByNo(n, mode);
  const idx = w.ex.findIndex((item) => {
    const arr = store.peekSets(n, mode, item.id) || [];
    return arr.slice(0, item.sets).filter((s) => s.done).length < item.sets;
  });
  return idx === -1 ? w.ex.length - 1 : idx;
}

/** Zur nächsten offenen Übung rücken und sagen, welche das ist. */
function weiterZurNaechsten(n, mode) {
  const nextIdx = firstOpenExercise(n, mode);
  if (nextIdx === ui.focusIdx) return;
  ui.focusIdx = nextIdx;
  toast(`Weiter: ${resolve(workoutByNo(n, mode).ex[nextIdx], mode).name}`);
}

/* ------------------------------------------------------------------ *
 * Supersätze
 *
 * Angeschaltet läuft die Einheit nicht mehr Übung für Übung, sondern in Paaren
 * im Wechsel: A1 B1 A2 B2. Welche zwei zusammenpassen, entscheidet
 * js/supersatz.js – kein gemeinsamer Muskel, nicht dasselbe Gerät.
 *
 * Hier steht nur, was daraus im Ablauf folgt. Und das ist vor allem **die
 * Pause**: Sie wird nicht kürzer, sie wird gefüllt. Deshalb wird sie auch nicht
 * mehr aus einer festen Länge genommen, sondern ausgerechnet:
 *
 *     warten = vorgesehene Pause − (jetzt − als diese Übung zuletzt dran war)
 *
 * Wer zügig wechselt, wartet noch kurz; wer beim Partner trödelt, gar nicht.
 * Am Ende steht dieselbe Erholung wie vorher, nur ist die Einheit rund 40 %
 * kürzer. Genau das ist der ganze Trick, und er steht in dieser einen Zeile.
 * ------------------------------------------------------------------ */

/** Wann war diese Übung zuletzt dran? Nur für diese Sitzung, im Arbeitsspeicher. */
const satzUhr = new Map();

const superAn = () => !!store.getState().supersatz;

/** Die Paare dieser Einheit. Neu gerechnet ist billiger als falsch gemerkt. */
function superGruppen(n, mode) {
  return paare(workoutByNo(n, mode).ex.map((x) => resolve(x, mode)), mode);
}

/** Steht diese Übung im Wechsel, und mit wem? */
function superPartner(n, mode, id) {
  if (!superAn()) return null;
  const g = gruppeVon(superGruppen(n, mode), id);
  return g && g.length === 2 ? g.find((x) => x.id !== id) : null;
}

/**
 * Nach einem abgehakten Satz: wohin, und wie lange warten?
 *
 * Gibt zurück, ob der Supersatz den Ablauf übernommen hat. Tut er es nicht
 * (ausgeschaltet, keine Paarung, Gruppe fertig), bleibt alles beim Alten.
 */
function superWeiter(n, mode, id) {
  if (!superAn() || !ui.focus) return false;
  const w = workoutByNo(n, mode);
  const items = w.ex.map((x) => resolve(x, mode));
  const g = gruppeVon(paare(items, mode), id);
  if (!g || g.length < 2) return false;

  const erledigt = (exId, satz) => {
    const v = items.find((x) => x.id === exId);
    const arr = store.getSets(n, mode, exId, v.sets);
    return !!(arr[satz] && arr[satz].done);
  };
  const ziel = naechsterSchritt(g, erledigt);
  if (!ziel) return false;              // Paar durch – der normale Weg greift

  const v = items.find((x) => x.id === ziel.id);
  const idx = w.ex.findIndex((x) => x.id === ziel.id);
  if (idx >= 0) ui.focusIdx = idx;

  // Die Wartezeit aus der Uhr, nicht aus einer Konstante.
  const zuletzt = satzUhr.get(ziel.id);
  const seit = zuletzt ? (Date.now() - zuletzt) / 1000 : Infinity;
  const wartet = Math.max(0, Math.round(restFor(v) - seit));
  if (wartet > 0) {
    startRest(v.name, ziel.satz - 1, v.sets, wartet);
  } else if (store.getState().rest) {
    endRest(false);
  }
  toast(wartet > 0
    ? `Gleich: ${v.name}, Satz ${ziel.satz + 1}`
    : `Weiter: ${v.name}, Satz ${ziel.satz + 1}`);
  return true;
}

/**
 * Fortschrittsleiste über der Fokus-Ansicht.
 *
 * Ein Feld je Satz, in Gruppen zu je einer Übung. Damit steht die ganze Einheit
 * auf einen Blick da: was schon steht, wo man gerade ist, was noch kommt – und
 * ein Tipp auf eine Gruppe springt dorthin. Die Breite folgt der Satzzahl,
 * sonst sähe eine Übung mit drei Sätzen so groß aus wie eine mit einem.
 *
 * Über den Sätzen stand zuerst noch ein Balken je Übung. Der sagte nichts, was
 * die Felder darunter nicht schon sagen – drei grüne Felder sind eine fertige
 * Übung. Die laufende Übung erkennt man jetzt an den umrandeten Feldern.
 */
function progressStrip(n, mode, w, cur) {
  return `
    <div class="prog">
      ${w.ex.map((item, k) => {
        const v = resolve(item, mode);
        const arr = store.peekSets(n, mode, v.id) || [];
        const done = arr.slice(0, v.sets).filter((x) => x.done).length;
        return `
        <button type="button" class="prog-ex ${k === cur ? 'cur' : ''} ${done === v.sets ? 'done' : ''}"
                style="flex-grow:${v.sets}" data-act="focus-goto" data-i="${k}"
                aria-label="Übung ${k + 1}, ${esc(v.name)}, ${done} von ${v.sets} Sätzen"
                aria-current="${k === cur}">
          <span class="prog-sets">
            ${Array.from({ length: v.sets }, (_, x) => `<i class="${x < done ? 'on' : ''}"></i>`).join('')}
          </span>
        </button>`;
      }).join('')}
    </div>`;
}

/**
 * Fokus-Ansicht: eine Übung groß, mit vorgeführter Bewegung. Sobald alle Sätze
 * stehen, rückt sie von selbst zur nächsten offenen Übung weiter.
 */
function renderFocus() {
  const n = ui.workoutNo;
  const w = workoutByNo(n);
  const mode = store.workoutMode(n);
  const prog = progressOf(n, mode);

  // Eine Einheit kann leer sein: mit genug angehakten Beschwerden fällt jede
  // Übung weg. Dann gibt es nichts zu fokussieren – zurück in die Startansicht,
  // die den Grund nennt. Vorher lief die Ansicht hier in ein undefined.
  if (!w.ex.length) {
    ui.focus = false;
    renderOverview();
    return;
  }

  const i = Math.min(Math.max(0, ui.focusIdx), w.ex.length - 1);
  const item = w.ex[i];
  const it = resolve(item, mode);
  const sets = store.getSets(n, mode, it.id, it.sets).slice(0, it.sets);
  const doneCount = sets.filter((s) => s.done).length;
  const kg = it.weight === null ? null : workingWeight(it.id);
  const anders = it.weight === null ? '' : doneWeightNote(n, mode, it.id);

  view.innerHTML = `
    <div class="focus-top">
      <button type="button" class="back-link" data-act="focus-list">☰ Übersicht</button>
      <span class="focus-count">
        <span id="sessionBadge">⏱ 0:00</span> · Übung ${i + 1} von ${w.ex.length} · ${prog.done}/${prog.total} Sätze
      </span>
    </div>
    ${progressStrip(n, mode, w, i)}

    <!-- Die Speicherwarnung gehört ausgerechnet hierher: Das ist die Ansicht,
         in der die Sätze abgehakt werden. Sie stand zuerst nur in der Übersicht
         und in der Übungsliste – also überall außer dort, wo gerade etwas
         verloren geht. Aufgefallen ist das erst, als der Test den Speicher
         wirklich vollgeschrieben hat. -->
    ${speicherWarnung()}

    <div class="focus-fig" id="focusFig"></div>

    <h2 class="focus-name">${esc(it.name)}</h2>
    <div class="focus-meta">${it.sets} Sätze × ${esc(repsLabel(it, mode))} Wdh. · ${esc(gruppeLabel(it, mode))} · ${esc(it.equip)}</div>
    ${(() => {
      // Im Wechsel muss dastehen, mit wem – sonst wirkt der Sprung zur nächsten
      // Übung wie ein Fehler statt wie der Plan.
      const partner = superPartner(n, mode, it.id);
      return partner ? `<div class="super-hin">↔ Im Wechsel mit ${esc(partner.name)}</div>` : '';
    })()}

    ${kg === null ? bandRow(it) + wdhRow(it, mode, 'focus-weight') : `
      ${ruestHint(n, mode, w.ex, i)}
      <div class="ex-weight focus-weight">
        ${kgKnopf(it, -1)}
        <div class="kg-main">
          <input type="text" inputmode="decimal" class="kg-val" value="${fmtNum(kg)}"
                 data-act="weight-input" data-ex="${it.id}" aria-label="Gewicht in Kilo">
          <span class="kg-unit">kg${it.weightNote ? ` · ${esc(it.weightNote)}` : ''}</span>
        </div>
        ${kgKnopf(it, 1)}
      </div>
      ${anders ? `<div class="kg-next focus-next">${esc(anders)}</div>` : ''}
      ${aufwaermZeile(it, mode, n)}`}
    ${anfaengerZeile(it)}

    <div class="focus-sets">
      ${sets.map((s, idx) => `
        <button type="button" class="set-btn focus-set ${s.done ? 'on' : ''}" aria-pressed="${s.done}"
                aria-label="Satz ${idx + 1} von ${it.sets} erledigt"
                data-act="toggle-set" data-ex="${it.id}" data-i="${idx}">${s.done ? '✓' : idx + 1}</button>`).join('')}
    </div>

    <div class="cue focus-cue">${esc(it.cue)}</div>
    ${detailBlock(it)}

    <div class="btn-row nav">
      <button type="button" class="btn btn-ghost" data-act="focus-step" data-d="-1" ${i === 0 ? 'disabled' : ''}>← Zurück</button>
      <button type="button" class="btn ${doneCount === it.sets ? 'btn-primary' : 'btn-ghost'}"
              data-act="focus-step" data-d="1" ${i === w.ex.length - 1 ? 'disabled' : ''}>Weiter →</button>
    </div>

    ${i === w.ex.length - 1 ? careBlock(n) : ''}
    ${sessionButtons(n, mode)}
    ${vorratNote(w, mode)}
    ${injuryNote(w, mode)}
  `;

  const host = document.getElementById('focusFig');
  if (host) mountFigure(host, it.pattern, it.weight !== null, it.gear);
}

/**
 * Was fertig war, bleibt fertig – einmalig nachgetragen.
 *
 * Bis eben hielt die App nur die Häkchen fest, nicht die Aussage „dieser Tag
 * war fertig". Solange die Satzzahl gleich blieb, war das dasselbe. Sie hängt
 * aber an der Erfahrungsstufe (zwei, drei oder vier Sätze je Übung), und beim
 * Wechsel wurde aus jeder abgeschlossenen Einheit rückwirkend eine halbe.
 *
 * Neue Einheiten stempeln sich beim letzten Haken selbst ab. Für alles, was
 * vorher entstanden ist, holt das hier einmal nach: Was **jetzt** vollständig
 * ist, wird als vollständig vermerkt. Das ist keine Umdeutung, sondern die
 * Aufzeichnung dessen, was ohnehin gerade gilt – und danach überlebt sie jede
 * Umstellung.
 */
function stempleFertige() {
  const log = store.getState().log || {};
  Object.keys(log).forEach((k) => {
    if (log[k].done) return;
    const n = Number(k);
    if (!Number.isInteger(n)) return;    // eigene Einheiten zählen nicht im Plan
    const mode = completedMode(n);
    if (mode) store.markDone(n, mode);
  });
}

/**
 * Der Plan hört nicht auf.
 *
 * Am Ende der 84 Einheiten stand bisher „🎉 Plan geschafft" und ein Knopf „Von
 * vorn beginnen". Beides ist weg, auf Ansage: *„Der Plan soll unendlich
 * laufen."* Eine Runde ist eine Buchführungseinheit, kein Ereignis, das den
 * Nutzer etwas angeht – die Zahlen dazu stehen weiter in der Statistik.
 *
 * Also rollt die Runde hier von selbst weiter: Verlauf in die Ablage, Gewichte
 * bleiben stehen, Workout 1 beginnt neu.
 *
 * **Wann** ist die einzige Frage, die dabei zu entscheiden war. Nicht sofort
 * beim letzten Haken – dann flöge man aus der gerade fertigen Einheit heraus,
 * während man noch draufschaut. Deshalb läuft das dort, wo auch das Nachrücken
 * läuft: beim Öffnen der App und beim Zurückkommen aus dem Hintergrund.
 *
 * **Auf welchen Tag** ergibt sich aus dem Plan selbst: der übliche Abstand nach
 * der letzten Einheit. Liegt der Tag schon in der Vergangenheit, zieht
 * catchUpPlan() ihn ohnehin auf heute – es braucht also keinen Sonderfall für
 * „drei Wochen nicht reingeschaut".
 */
function rundeWeiter() {
  if (PLAN.some((w) => !completedMode(w.n))) return false;
  const letzte = PLAN[PLAN.length - 1];
  const abstand = Math.max(1, daysBetween(PLAN[0].date, PLAN[1].date));
  const ab = addDays(store.startedOn(letzte.n) || effDate(letzte), abstand);
  store.restartPlan(daysBetween(PLAN[0].date, ab), rundenBilanz());
  ui.workoutNo = PLAN[0].n;
  ui.focus = false;
  ui.listView = false;
  ui.openEx.clear();
  return true;
}

/**
 * Auf welchen Tag Workout 1 fällt, wenn ein Fokus frisch anfängt.
 *
 * Der Plan trägt feste Daten; `shift` verschiebt sie. Beim Wechsel auf einen
 * Fokus, in dem noch nie trainiert wurde, stand dieser Wert bisher auf 0 – und
 * weil alle Plandaten in der Vergangenheit liegen, zog catchUpPlan() die erste
 * Einheit sofort auf **heute**. Wer gestern und vorgestern trainiert hat, stand
 * damit vor dem dritten Trainingstag in Folge, nur weil er den Fokus gewechselt
 * hat.
 *
 * Gerechnet wird deshalb wie beim Rundenwechsel: der übliche Abstand zwischen
 * zwei Einheiten, gezählt ab dem letzten Tag, an dem tatsächlich trainiert
 * wurde. Liegt der schon in der Vergangenheit, macht catchUpPlan() daraus von
 * selbst heute – ein Sonderfall für „drei Wochen nicht reingeschaut" ist nicht
 * nötig.
 *
 * Alle Varianten beginnen am selben Datum (js/data.js), die Verschiebung passt
 * also auch auf den Plan, der gleich geladen wird.
 */
function frischerStart() {
  const tage = Object.values(store.getState().log || {})
    .map((e) => e && e.startedOn).filter(Boolean).sort();
  if (!tage.length) return store.getState().shift;
  const abstand = Math.max(1, daysBetween(PLAN[0].date, PLAN[1].date));
  return daysBetween(PLAN[0].date, addDays(tage[tage.length - 1], abstand));
}

/**
 * Der Knopf unter der Körperkarte – oder eben keiner.
 *
 * Drei Zustände, und der dritte fehlte: Bisher stand über jeder angefangenen
 * Einheit „Training fortsetzen", auch über einer fertigen. *„Bin ja mit Training
 * für heute durch. Dann brauch da ja nichts von Training fortsetzen stehen."*
 * Stimmt – ein Knopf, der zu nichts mehr führt, ist kein Angebot, sondern eine
 * offene Aufgabe, die es nicht gibt.
 *
 *   nichts abgehakt   zwei Startknöpfe, Hanteln oder Bodyweight
 *   angefangen        fortsetzen, und wahlweise „als trainiert markieren"
 *   fertig            der Abschluss steht da, kein Auftrag mehr
 *
 * Der Sonderfall dazwischen: fertig, aber die Uhr läuft noch. Dann ist der
 * nächste Schritt nicht „nochmal rein", sondern „abschließen" – und genau der
 * Knopf steht dann hier, statt ihn eine Ebene tiefer suchen zu lassen.
 */
function startBlock(n, mode, prog) {
  const laeuft = !!store.getState().session;

  if (prog.erledigt && laeuft) {
    return `
      <button type="button" class="btn btn-ok btn-block btn-start" data-act="finish-session">
        ✓ Training abschließen (${prog.done}/${prog.total})
      </button>`;
  }

  if (prog.erledigt) {
    const e = store.getState().log[n] || {};
    const min = e.secs > 0 ? Math.round(e.secs / 60) : 0;
    // Nicht „alle 18 Sätze", wenn 16 stehen: Wer von Hand abschließt, hat den
    // Tag beendet, nicht jeden Satz gemacht. Die Zeile sagt, was zutrifft.
    const wieViel = prog.done === prog.total
      ? `Alle ${prog.total} Sätze stehen`
      : `${prog.done} von ${prog.total} Sätzen`;
    // Steht noch etwas offen, muss der Weg zurück hinein bleiben – leise, aber
    // vorhanden. „Abgeschlossen" ist eine Aussage über den Tag, kein Schloss:
    // Wer bei 16 von 18 abbricht und zehn Minuten später doch weitermacht,
    // darf nicht vor einer Karte ohne Knöpfe stehen.
    return `
      <div class="fertig">
        <div class="fertig-kopf">✓ Für heute durch</div>
        <div class="fertig-sub">${wieViel}${
          min ? ` · ${min} min` : ''}. Die nächste Einheit kommt von selbst.</div>
      </div>
      ${prog.complete ? '' : `
      <button type="button" class="btn btn-ghost btn-block" data-act="start-session"
              style="margin-top:8px">Doch noch weitermachen</button>`}`;
  }

  if (prog.done) {
    return `
      <button type="button" class="btn btn-primary btn-block btn-start" data-act="start-session">
        ▶︎ Training fortsetzen
      </button>
      ${completedMode(n) ? '' : `
      <button type="button" class="btn btn-ghost btn-block" data-act="mark-done" style="margin-top:8px">
        ✓ Als trainiert markieren
      </button>`}`;
  }

  // Ein Knopf, nicht zwei. Welche Variante gilt, steht darunter – gewechselt
  // wird sie unter Mehr. Die Wahl gehört nicht an die Stelle, an der man
  // loslegen will: Wer trainieren geht, hat sie längst getroffen.
  return `
    <button type="button" class="btn btn-primary btn-block btn-start" data-act="start-session"
            aria-label="Workout starten (${esc(MODE_LABEL[mode])})">
      ▶︎ Start
      <span class="start-modus">${MODE_ICON[mode]} ${esc(MODE_LABEL[mode])}</span>
    </button>`;
}

/**
 * Hanteln oder Bodyweight – unter Mehr, als Wahl zwischen zwei Dingen.
 *
 * Hieß bis vor Kurzem „Standardmodus: Bodyweight" und war ein Schalter, der an
 * oder aus steht. Beides war falsch:
 *
 *     „‚Standardmodus' kann raus. Hier schaltet man immer zwischen Hanteln und
 *      bodyweight hin und her je nachdem was man grad hat und so. Nichts davon
 *      ist Standard."
 *
 * Also zwei Knöpfe statt eines Schalters – zwei gleichrangige Arten zu
 * trainieren, keine Abweichung von einer Norm. Und ohne das Wort: Was hier
 * steht, gilt ab sofort und nicht „normalerweise".
 *
 * **Die offene Einheit wechselt mit**, sofern noch kein Satz steht. Ein
 * Umschalter, der nur „ab dem nächsten Mal" wirkt, während vorn unverändert die
 * alte Variante steht, sähe kaputt aus. Was schon läuft, bleibt dagegen, wie es
 * ist – mitten im Training die Übungen auszutauschen wäre das Gegenteil von
 * hilfreich, und das Protokoll führt beide Varianten getrennt.
 */
function modusKarte(mode) {
  return `
    <div class="section-title">Womit trainierst du</div>
    <div class="card">
      <div class="small muted">Beide Fassungen stehen im selben Plan und treffen dieselben
        Muskelgruppen – nur mit dem, was gerade da ist. Umgestellt wird hier, so oft du
        willst; die nächste Einheit übernimmt es sofort, eine begonnene bleibt, wie sie ist.</div>
      <div class="btn-row nav" style="margin-top:10px" role="group" aria-label="Variante wählen">
        ${['db', 'bw'].map((m) => `
          <button type="button" class="btn ${m === mode ? 'btn-primary' : ''}"
                  aria-pressed="${m === mode}" data-act="set-modus" data-v="${m}">
            ${MODE_ICON[m]} ${esc(MODE_LABEL[m])}</button>`).join('')}
      </div>
    </div>`;
}

/**
 * Startansicht: was heute ansteht, welche Muskelgruppen drankommen, los.
 * Die einzelnen Übungen liegen eine Ebene tiefer – vor dem Training will man
 * sie nicht abhaken, sondern nur wissen, was kommt.
 */
function renderOverview() {
  const n = ui.workoutNo;
  const w = workoutByNo(n);
  const mode = store.workoutMode(n);
  const prog = progressOf(n, mode);
  const today = todayISO();
  const date = effDate(w);
  const diff = daysBetween(today, date);
  const shift = store.getState().shift;

  let when;
  if (diff === 0) when = 'Heute';
  else if (diff === 1) when = 'Morgen';
  else if (diff === -1) when = 'Gestern';
  else if (diff > 1) when = `in ${diff} Tagen`;
  else when = `vor ${-diff} Tagen`;

  const items = w.ex.map((item) => resolve(item, mode));
  const totalSets = items.reduce((a, x) => a + x.sets, 0);
  const muscles = new Set(items.flatMap((it) => it.muscles));
  // In den Daten steht der zuerst beanspruchte Muskel vorn. Daraus zwei
  // Stufen: was heute wirklich dran ist, und was nur mitarbeitet.
  const primary = new Set(items.map((it) => it.muscles[0]).filter(Boolean));
  const due = backupDue();

  // Eine Bildschirmseite, ohne Scrollen: Kopf, Körper, Start. Der Körper
  // nimmt sich den Platz, der zwischen den beiden übrig bleibt.
  view.innerHTML = `
    <section class="ov">
      ${umzugHinweis()}
      ${aufstiegHinweis()}
      ${steigerungHinweis(n, items)}
      ${speicherWarnung()}
      <!-- Hier stand: "3 Tage verpasst. Der Plan ist nachgerückt …" und die
           Frage, ob eine neue Kalenderdatei erzeugt werden soll. Beides raus,
           auf Zuruf.

           Das Nachrücken selbst bleibt – catchUpPlan() verschiebt den offenen
           Plan weiter, wenn ein Termin verstreicht. Nur angesagt wird es nicht
           mehr: Es sah nach einem Rückstand aus, den es nicht gibt, und wer
           seine Termine gar nicht mehr in den Kalender exportiert, wird auch
           nicht gefragt, ob er sie neu erzeugen will. Der Export steht
           weiterhin unter Mehr → Termine, für den, der ihn will. -->
      ${ui.standAngebot ? `<div class="notice">
        👋 <b>${esc(ui.standAngebot.n)}</b> hat dir seinen Stand geschickt:
        ${ui.standAngebot.w} von ${ui.standAngebot.p} Einheiten, ${ui.standAngebot.s} Sätze${
          ui.standAngebot.kg ? `, ${ui.standAngebot.kg.toLocaleString('de-DE')} kg Volumen` : ''}.
        <div class="btn-row nav" style="margin-top:10px">
          <button type="button" class="btn btn-primary" data-act="accept-stand">Zum Vergleich</button>
          <button type="button" class="btn btn-ghost" data-act="drop-stand">Verwerfen</button>
        </div></div>` : ''}
      ${due ? `<div class="notice warn">💾 ${esc(plural(due, 'Einheit', 'Einheiten'))} seit der letzten
        Sicherung. Alles liegt nur in diesem Browser.
        <button type="button" class="btn btn-block btn-primary" data-act="backup-teilen"
                style="margin-top:10px">Sicherung weitergeben</button>
        <div class="small muted" style="margin-top:6px">Geht an Drive, an eine Mail an dich
          selbst, an was du willst – Hauptsache nicht nur auf dieses Handy.</div></div>` : ''}

      <header class="ov-top">
        <!-- Kein „von 84" mehr: „Die app geht ja unendlich." Stimmt – der Plan
             rollt am Ende von selbst in die nächste Runde, und eine Zahl, die
             ein Ende ankündigt, das es nicht gibt, ist schlicht falsch. Die
             laufende Nummer bleibt: Sie sagt, wo man ist, ohne zu behaupten,
             wohin es geht. -->
        <div class="hero-eyebrow">${store.getState().name ? `${esc(store.getState().name)} · ` : ''}${
          w.custom ? 'Eigenes Workout' : `${esc(when)} · Workout ${w.n}`}</div>
        <h2 class="hero-title">${w.custom ? esc(w.name) : esc(fmtDate(date, true))}</h2>
        <!-- Kein "Plan +2 Tage" mehr: Der Plan rückt von selbst nach, wenn ein
             Termin verstreicht (catchUpPlan). Wie weit er dabei insgesamt vom
             ursprünglichen Kalender abweicht, ändert an der heutigen Einheit
             nichts – es stand nur da und sah nach einem Rückstand aus, den es
             nicht gibt. Wer die Zahl wirklich sucht, findet sie unter
             Mehr → Termine. -->
        <div class="hero-sub">${MODE_LABEL[mode]} · ${items.length} Übungen · ${totalSets} Sätze</div>
        ${prog.done ? `<div class="progress"><i style="width:${prog.pct}%"></i></div>
          <div class="ov-prog">${prog.done}/${prog.total} Sätze${prog.erledigt ? ' · abgeschlossen' : ''}</div>` : ''}
        <!-- Hier stand: "↩ 2 Sätze aus dieser Woche nachgeholt – diese Woche ist
             etwas liegen geblieben …". Raus auf Zuruf, und ohne Verlust: An
             jeder betroffenen Übung steht in der Liste weiterhin "+1
             nachgeholt", also dort, wo man sie auch macht. Drei Zeilen
             Buchhaltung vor dem Start waren dagegen genau das, was diese
             Ansicht nicht sein soll. -->
      </header>

      <div class="ov-body" id="bodyMap"></div>

      <div class="bm-legend">${[...muscles]
        .sort((a, b) => (primary.has(b) ? 1 : 0) - (primary.has(a) ? 1 : 0))
        .map((m) => `<span class="${primary.has(m) ? '' : 'sub'}">${esc(MUSCLE_LABEL[m] || m)}</span>`).join('')}</div>

      ${items.length ? `
        ${startBlock(n, mode, prog)}
`
      : `<div class="card empty-day">
          <b>Heute bleibt nichts übrig.</b> Die angehakten Beschwerden sperren
          jede Übung dieser Einheit, und für keine gibt es einen Ersatz, der
          nicht auch weh täte. Das ist kein Fehler – nur ein Tag, an dem
          Krafttraining nicht dran ist.
          <button type="button" class="btn btn-ghost btn-sm" data-act="go-injuries">Verletzungen ansehen</button>
        </div>`}

      <div class="ov-foot">
        ${w.custom ? `<button type="button" class="ov-nav" data-act="back-to-plan" aria-label="Zurück zum Plan">↩</button>`
          : `<button type="button" class="ov-nav" data-act="nav-workout" data-delta="-1" ${n === PLAN[0].n ? 'disabled' : ''}>←</button>`}
        <button type="button" class="ov-nav wide" data-act="show-list">Übungen &amp; Gewichte</button>
        ${w.custom ? `<button type="button" class="ov-nav" data-act="go-tab" data-tab="custom" aria-label="Eigenes Workout bearbeiten">✎</button>`
          : `<button type="button" class="ov-nav" data-act="nav-workout" data-delta="1" ${n === PLAN[PLAN.length - 1].n ? 'disabled' : ''}>→</button>`}
      </div>
    </section>
    <!-- Hier standen die Karten "Nicht da: …" und "Rücksicht auf: …". Beide
         hingen unter der Startansicht und machten aus der einen Bildschirmseite
         eine gescrollte:

             "Dieses nicht da unten kann weg. Hier beim Dashboard soll man nicht
              scrollen können sondern alles soll direkt aufm Bildschirm
              angezeigt werden."

         Sie sind nicht verschwunden, sondern stehen in der Übungsliste und im
         Training – dort, wo ohnehin gescrollt wird und wo der Tausch an der
         einzelnen Übung sichtbar ist ("Statt Pull-ups …"). -->
  `;

  const host = document.getElementById('bodyMap');
  if (host) mountBody(host, muscles, primary);
}

/* ------------------------------------------------------------------ *
 * Erster Start
 *
 * Die App ist zum Weitergeben gedacht: ein Link, und wer ihn öffnet, hat
 * dieselbe App. Nur weiß er beim ersten Öffnen nicht, was er vor sich hat –
 * ein Plan über 84 Einheiten mit fremden Startgewichten. Deshalb einmal eine
 * Seite, die das in vier Sätzen erklärt und nach dem Namen fragt.
 *
 * Der Name ist kein Konto. Es gibt keinen Server, keine Anmeldung und nichts
 * zu synchronisieren; er steht in diesem Browser und sonst nirgends. Genau das
 * sagt die Seite auch – sonst wartet jemand darauf, dass sein Training bei
 * jemand anderem auftaucht.
 * ------------------------------------------------------------------ */

function needsWelcome() {
  const s = store.getState();
  return !s.greeted && !Object.keys(s.log).length;
}

const SETUP_LETZTER = 3;   // Name, Farbe, Erfahrung, Fokus

function renderWelcome() {
  const schritt = ui.setupStep || 0;
  const s = store.getState();

  const kopf = `
    <header class="ov-top">
      <div class="hero-eyebrow">Einrichten · Schritt ${schritt + 1} von ${SETUP_LETZTER + 1}</div>
      <h2 class="hero-title">${['Willkommen', 'Farbe', 'Wie viel Erfahrung?',
        'Worauf soll es hinauslaufen?'][schritt]}</h2>
    </header>
    ${ui.standAngebot && schritt === 0 ? `<div class="notice">👋 <b>${esc(ui.standAngebot.n)}</b> hat dir
      den Link geschickt und seinen Stand mitgeschickt: ${ui.standAngebot.w} von
      ${ui.standAngebot.p} Einheiten. Sobald du fertig eingerichtet hast, steht er in deinem
      Vergleich.</div>` : ''}`;

  const seiten = [`
    <div class="card">
      <p class="small">Ein fertiger Trainingsplan: Übungen, Sätze, Wiederholungen, Pausen –
        und zu jeder Übung eine vorgeführte Bewegung, die sich drehen lässt. Trainieren kannst
        du mit <strong>Hanteln</strong> oder als <strong>Bodyweight</strong>-Variante ganz ohne
        Geräte; umgeschaltet wird über dem Startknopf, für jede Einheit neu.</p>
      <p class="small">Die App läuft offline und braucht kein Konto. Was du einträgst, bleibt
        auf diesem Gerät – bis du selbst etwas verschickst: Für den Vergleich unter
        <em>Statistik</em> schickst du deinen Stand als Link, und wer ihn bekommt, sieht die
        Zahlen darin. Von allein geht nichts irgendwohin.</p>
    </div>
    <div class="card">
      <div class="lbl">Wie heißt du?</div>
      <div class="hint">Nur für die Anzeige und für den Vergleich mit Freunden.</div>
      <input type="text" id="nameInput" class="name-input" maxlength="24"
             autocomplete="name" placeholder="Dein Name" aria-label="Dein Name">
    </div>`, `
    <div class="card">
      <div class="small muted">Zwei Akzente: der wärmere gilt für die Hantel-Variante, der
        kühlere für Bodyweight. Sonst ändert sich nichts – dunkel bleibt dunkel.</div>
      <div class="farben">
        ${THEMES.map(([key, label, a, bfarbe]) => `
          <button type="button" class="farb-btn ${(s.theme || 'orange') === key ? 'on' : ''}"
                  aria-pressed="${(s.theme || 'orange') === key}" data-act="set-theme" data-v="${key}">
            <span class="farb-punkt" style="--a:${a};--b:${bfarbe}"></span>${label}
          </button>`).join('')}
      </div>
    </div>`, `
    <div class="card">
      <div class="small muted">Die Startgewichte des Plans stammen von jemandem, der seit einer
        Weile trainiert. Damit die erste Einheit etwas taugt, rechnen wir sie auf dich um –
        Sätze, Pausen und Übungen bleiben gleich, und ändern kannst du jedes Gewicht sowieso
        selbst.</div>
      <div class="fokus-liste">
        ${LEVELS.map(([key, name, hint, faktor]) => `
          <button type="button" class="fokus-btn ${(s.level || 'geuebt') === key ? 'on' : ''}"
                  aria-pressed="${(s.level || 'geuebt') === key}" data-act="set-level" data-v="${key}">
            <span class="lbl">${esc(name)}${(s.level || 'geuebt') === key ? ' ✓' : ''}</span>
            <span class="hint">${esc(hint)}</span>
            <span class="fokus-zahl">${esc(levelBeispiel(faktor, key))}</span>
          </button>`).join('')}
      </div>
    </div>`, `
    <div class="card">
      <div class="small muted">Jeder Fokus ist ein eigener, durchgerechneter Plan: dieselbe
        Rechnung, dieselbe Erholungsregel, andere Schwerpunkte. Später änderbar.</div>
      <div class="fokus-liste">${fokusKarten(s.focus || 'standard')}</div>
    </div>
    ${shareKarte()}
    <p class="small muted">Und wenn nichts davon passt: Unter <em>Mehr → Eigenes Workout</em>
      stellst du dir jede Einheit selbst zusammen, aus demselben Übungsvorrat.</p>`];

  view.innerHTML = `
    <section class="ov welcome">
      ${kopf}
      ${seiten[schritt]}
      <div class="btn-row nav">
        ${schritt ? '<button type="button" class="btn btn-ghost" data-act="setup-back">← Zurück</button>' : ''}
        <button type="button" class="btn btn-primary" data-act="setup-next">
          ${schritt === SETUP_LETZTER ? 'Los geht’s' : 'Weiter →'}
        </button>
      </div>
      ${schritt === 0 ? `<p class="small muted">Tipp: „Zum Startbildschirm hinzufügen" macht
        daraus ein eigenes Symbol, das ohne Browserleiste startet.</p>` : ''}
    </section>`;

  const feld = document.getElementById('nameInput');
  if (feld) {
    feld.value = store.getState().name || '';
    feld.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); setupWeiter(); }
    });
  }
}

/** Ein Schritt weiter im Einstieg – im letzten Schritt ist es der Abschluss. */
function setupWeiter() {
  const feld = document.getElementById('nameInput');
  if (feld) store.setSetting('name', feld.value.trim().slice(0, 24));
  if ((ui.setupStep || 0) < SETUP_LETZTER) {
    ui.setupStep = (ui.setupStep || 0) + 1;
    render();
    window.scrollTo({ top: 0 });
    return;
  }
  willkommenFertig();
}

function willkommenFertig() {
  const name = store.getState().name;
  store.setSetting('greeted', true);
  // Kam der Link mit einem Stand, ist die Rückfrage danach überflüssig: Wer den
  // Link von jemandem bekommt, will genau dessen Zahlen sehen.
  if (ui.standAngebot) {
    store.setFriend(freundId(ui.standAngebot.n), ui.standAngebot);
    ui.standAngebot = null;
  }
  render();
  // Jetzt erst: Der Satz mit dem Schalter stand im letzten Schritt, und der
  // Schalter stand daneben.
  meldeStand(true);
  toast(name ? `Los geht’s, ${name} 💪` : 'Los geht’s 💪');
}

/* ------------------------------------------------------------------ *
 * Rückkanal
 *
 * Ohne Eintrag in js/config.js gibt es ihn nicht: keine Frage, kein Schalter,
 * keine Verbindung. Mit Eintrag meldet jedes Gerät einmal am Tag denselben
 * Stand, der auch im Vergleich steht, plus Sätze je Übung – damit der Betreiber
 * sieht, wie die App bei den Leuten läuft, denen er den Link geschickt hat.
 *
 * Was hier *nicht* passiert: heimlich sammeln. Der Einstieg sagt in einem Satz,
 * was rausgeht und an wen, mit dem Schalter daneben; unter Mehr steht dasselbe
 * noch einmal, mitsamt dem Zeitpunkt der letzten Meldung und einem Knopf, der
 * die eigene Zeile wieder löscht.
 * ------------------------------------------------------------------ */

/**
 * Was die Antwort des Servers bedeutet, in einem Satz.
 *
 * Der Wortlaut von PostgREST ist genau, aber nur für den lesbar, der ihn schon
 * kennt. Wer die App gerade einrichtet, soll den nächsten Schritt lesen können,
 * ohne die README zu suchen.
 */
function serverHinweis(msg) {
  const m = String(msg || '');
  if (/row-level security|violates row/i.test(m)) {
    return 'Die Tabelle nimmt die Zeile nicht an – die Regeln greifen nicht für die '
      + 'anonyme Rolle. Einmal den SQL-Block aus der README ausführen: Danach läuft '
      + 'das Schreiben über eine Funktion und hängt an keiner Regel mehr.';
  }
  if (/permission denied for function/i.test(m)) {
    return 'Der Funktion melde fehlt das Ausführungsrecht: grant execute … to anon.';
  }
  // Reihenfolge zählt: PostgREST schreibt in alle drei Fällen "schema cache",
  // der Code dahinter trennt sie. Erst der genaue, dann der allgemeine Fall.
  if (/PGRST204/i.test(m)) {
    return 'Der Tabelle fehlt eine Spalte – den Block aus der README noch einmal ausführen.';
  }
  if (/PGRST205/i.test(m)) {
    return 'Die Tabelle nutzung gibt es dort nicht.';
  }
  if (/PGRST202|function.*(does not exist|not found)|Could not find the function/i.test(m)) {
    return 'Die Funktion melde gibt es dort nicht – der SQL-Block aus der README ist '
      + 'nicht (vollständig) gelaufen. Direkt danach kann es auch heißen: ein paar '
      + 'Sekunden warten, der Server kennt sie noch nicht.';
  }
  if (/invalid api key|JWS|JWT|apikey/i.test(m)) {
    return 'Der Schlüssel in js/config.js gehört nicht zu diesem Projekt.';
  }
  if (/^\s*404|Not Found/i.test(m)) {
    return 'Unter dieser Adresse antwortet weder die Funktion noch die Tabelle – '
      + 'die Projekt-Adresse in js/config.js prüfen.';
  }
  if (/column|Spalte/i.test(m)) {
    return 'Der Tabelle fehlt eine Spalte – den Block aus der README noch einmal ausführen.';
  }
  if (/Keine Verbindung/i.test(m)) {
    return 'Kein Netz – oder die Projekt-Adresse in js/config.js stimmt nicht.';
  }
  return '';
}

/**
 * Der eine Satz, der aus Sammeln eine Absprache macht.
 *
 * Er steht im Einstieg und unter Mehr, wortgleich, mit dem Schalter daneben.
 * Ohne Server in js/config.js gibt es ihn nicht – dann gibt es auch nichts zu
 * erlauben.
 */
function shareKarte(ausfuehrlich = false) {
  if (!hatServer()) return '';
  const s = store.getState();
  const an = s.share !== false;
  return `
    <div class="card">
      <div class="switch-row">
        <div>
          <div class="lbl">Nutzung mit ${esc(CONFIG.betreiber)} teilen</div>
          <div class="hint">Einmal am Tag gehen dein Name, dein Trainingsfokus, deine
            Erfahrungsstufe und dein Fortschritt an ${esc(CONFIG.betreiber)} – Einheiten,
            Sätze, Volumen, Serie, wann du zuletzt trainiert hast, welche Übungen wie oft
            vorkamen, wie oft du den Link weitergeschickt hast und wie viele Stände von
            Freunden du übernommen hast. Dazu eine Zufallszahl, an der dein Gerät
            wiedererkannt wird. Er hat die App gebaut und sieht daran, ob sie benutzt wird
            und was hakt. Sonst geht nichts raus: keine Uhrzeiten, keine Adressen, nichts
            von außerhalb dieser App.</div>
        </div>
        <button type="button" class="toggle" aria-pressed="${an}" data-act="toggle-share"
                aria-label="Nutzung teilen"></button>
      </div>
      ${ausfuehrlich ? `
      <div class="small muted">${s.lastShare
        ? `Zuletzt gemeldet am ${esc(fmtDate(s.lastShare.on))}${s.lastShare.ok ? '' : ' – hat nicht geklappt'}.`
        : 'Noch nichts gemeldet.'}
        ${an ? '' : 'Abgeschaltet – es geht nichts mehr raus.'}</div>
      ${s.lastShare && !s.lastShare.ok && s.lastShare.msg ? `
      <div class="hint" style="color:var(--accent)">Der Server sagt: ${esc(s.lastShare.msg)}</div>
      ${serverHinweis(s.lastShare.msg) ? `<div class="hint">${esc(serverHinweis(s.lastShare.msg))}</div>` : ''}` : ''}
      <div class="btn-row">
        <button type="button" class="btn" data-act="share-now">Jetzt melden</button>
        <button type="button" class="btn" data-act="share-delete">Meine Daten dort löschen</button>
      </div>` : ''}
    </div>`;
}

/** Meldet dieses Gerät gerade? Nur mit Server und nur mit Zustimmung. */
const meldetMit = () => hatServer() && store.getState().share !== false;

function standZeile() {
  const st = sammleStats();
  const zuletzt = PLAN.filter((w) => completedMode(w.n)).map((w) => effDate(w)).sort();
  const proUebung = {};
  st.perEx.forEach((anzahl, id) => { proUebung[id] = anzahl; });
  return {
    id: store.getState().deviceId,
    name: store.getState().name || 'Ohne Namen',
    fokus: FOCUS.name,
    stufe: (LEVELS.find(([k]) => k === (store.getState().level || 'geuebt')) || [])[1] || '',
    einheiten: st.workoutsDone,
    plan: PLAN.length,
    saetze: st.setsDone,
    volumen: Math.round(st.volume),
    serie: st.streak,
    zuletzt: zuletzt.length ? zuletzt[zuletzt.length - 1] : null,
    geteilt: store.getState().shareCount || 0,
    freunde: Object.keys(store.getState().friends || {}).length,
    uebungen: proUebung,
    // Kein Zeitstempel: "keine Uhrzeiten" steht so im Einwilligungstext. Wann
    // zuletzt gemeldet wurde, hält der Server als Datum fest – auf den Tag
    // genau, mehr braucht die Übersicht nicht.
  };
}

/**
 * Einmal am Tag melden, im Hintergrund, ohne die App aufzuhalten.
 *
 * Öfter bringt nichts: Die Zahlen ändern sich pro Einheit, nicht pro Minute.
 * Nach einem abgeschlossenen Training wird zusätzlich gemeldet (`sofort`),
 * damit die Übersicht nicht einen Tag hinterherhinkt.
 */
function meldeStand(sofort = false) {
  if (!meldetMit()) return;
  // Wer den Einstieg noch vor sich hat, hat den Satz mit dem Schalter noch
  // nicht gelesen. Vorher etwas zu schicken, wäre genau das, was der Satz
  // ausschließt – auch wenn es nur "Gerät eingerichtet" wäre.
  if (needsWelcome()) return;
  const s = store.getState();
  // Einmal am Tag – aber nur, wenn es auch geklappt hat. Ein Fehlversuch am
  // Morgen sperrte den Rest des Tages: Wer den Server repariert, sah bis zum
  // nächsten Tag nichts davon.
  if (!sofort && s.lastShare && s.lastShare.on === todayISO() && s.lastShare.ok) return;
  if (!s.deviceId) store.setSetting('deviceId', geraeteId(null));
  melden(standZeile()).then(({ ok, msg }) => {
    store.setSetting('lastShare', { on: todayISO(), ok, msg: ok ? '' : msg });
    // Nur neu zeichnen, wo das Ergebnis auch steht – mitten im Training wäre
    // ein Neuaufbau der Seite eine Zumutung.
    if (ui.tab === 'settings') render();
  });
}

/* ------------------------------------------------------------------ *
 * Vergleich mit Freunden
 *
 * Ohne Server. Es gibt keine Konten, keine Anmeldung und nichts, was im
 * Hintergrund abgleicht – die App liegt als statische Seite auf GitHub Pages
 * und soll dort auch bleiben.
 *
 * Stattdessen schickt man seinen Stand als Link: Ein paar Zahlen (Einheiten,
 * Sätze, Volumen, Serie) wandern base64-kodiert im Anker der Adresse mit. Wer
 * ihn öffnet, bekommt die Rückfrage "übernehmen?" und hat den Stand danach
 * lokal gespeichert. Der Vergleich in der Statistik zeigt also immer den Stand,
 * den der andere zuletzt geschickt hat – mit Datum daneben, damit niemand einen
 * drei Wochen alten Wert für aktuell hält.
 *
 * Das ist der ehrliche Umfang dessen, was ohne Server geht, und es reicht für
 * das, worum es geht: zu sehen, wer gerade vorn liegt.
 * ------------------------------------------------------------------ */

const STAND_VERSION = 1;

function meinStand() {
  // Bewusst sammleStats() und nicht gesamtStats(): Hier steht "w von p",
  // Einheiten gegen Planlänge. Eine Gesamtzahl über alle Runden wäre größer als
  // p und ergäbe "112 von 84". Der Vergleich mit Freunden fragt, wie weit jemand
  // im Plan ist; der Stufenaufstieg fragt, wie viel jemand insgesamt trainiert
  // hat. Zwei Fragen, zwei Zahlen.
  const st = sammleStats();
  const zuletzt = PLAN.filter((w) => completedMode(w.n)).map((w) => effDate(w)).sort();
  return {
    v: STAND_VERSION,
    n: store.getState().name || 'Ohne Namen',
    w: st.workoutsDone,
    s: st.setsDone,
    kg: Math.round(st.volume),
    r: st.streak,
    p: PLAN.length,
    d: todayISO(),
    // Fokus und letztes Training kommen mit, seit der Vergleich mehr sein soll
    // als eine Rangliste: Wer Bauch/Beine/Po macht, hat andere Zahlen als wer
    // Oberkörper macht, und "seit drei Wochen nichts" ist die interessanteste
    // Zeile überhaupt.
    f: FOCUS.name,
    z: zuletzt.length ? zuletzt[zuletzt.length - 1] : null,
  };
}

/** JSON -> base64url. Umlaute im Namen überleben das nur über UTF-8. */
function codeVon(obj) {
  const bytes = new TextEncoder().encode(JSON.stringify(obj));
  let roh = '';
  bytes.forEach((b) => { roh += String.fromCharCode(b); });
  return btoa(roh).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function codeZu(code) {
  try {
    const b64 = code.replace(/-/g, '+').replace(/_/g, '/');
    const roh = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
    const bytes = Uint8Array.from(roh, (c) => c.charCodeAt(0));
    const obj = JSON.parse(new TextDecoder().decode(bytes));
    return obj && obj.v === STAND_VERSION && typeof obj.n === 'string' ? obj : null;
  } catch {
    return null;
  }
}

const standLink = () => `${appURL()}#stand=${codeVon(meinStand())}`;

/**
 * Stand aus der Adresse lesen – und den Anker sofort entfernen.
 *
 * Sonst steht er beim nächsten Neuladen wieder da, und die Frage "übernehmen?"
 * käme nach dem Übernehmen erneut. replaceState statt pushState: Der Anker soll
 * auch keinen Eintrag im Verlauf hinterlassen, sonst führt die Zurück-Taste
 * wieder hinein.
 */
function standAusAdresse() {
  const treffer = /[#&]stand=([A-Za-z0-9_-]+)/.exec(location.hash);
  if (!treffer) return null;
  history.replaceState(history.state, '', location.pathname + location.search);
  return codeZu(treffer[1]);
}

/**
 * Ein Scheibensatz als Link – derselbe Weg wie beim geteilten Stand.
 *
 * Der Anlass: „Hab jeweils 2: 1,5; 2,5; 2; 5 und 10 Kilo Scheiben. Kannst ja bei
 * mir eintragen." Kann ich eben nicht – die Daten liegen in *seinem* Browser,
 * und dorthin führt kein Weg von außen. Was geht, ist ein Link: einmal tippen,
 * und der Satz steht drin.
 *
 * Übernommen wird nur nach Rückfrage. Ein Link, der ungefragt die Gewichte
 * umstellt, wäre eine Tür, die man nicht offen lässt – auch wenn hier nur
 * Eisen drinsteht und kein Trainingsverlauf.
 */
function eisenAusAdresse() {
  const treffer = /[#&]eisen=([A-Za-z0-9_-]+)/.exec(location.hash);
  if (!treffer) return;
  history.replaceState(history.state, '', location.pathname + location.search);
  // Nicht codeZu(): Das prüft zusätzlich auf die Felder eines geteilten Stands
  // (v, n) und gäbe hier immer null zurück. Derselbe Code, andere Fracht.
  let roh = null;
  try {
    const b64 = treffer[1].replace(/-/g, '+').replace(/_/g, '/');
    const bytes = Uint8Array.from(
      atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4)), (c) => c.charCodeAt(0));
    roh = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return;
  }
  const satz = normSatz(roh);
  if (!satz.scheiben.length) return;

  const liste = satz.scheiben.map(([kg, n]) => `${n}× ${fmtNum(kg)} kg`).join(', ');
  if (!confirm(`Scheibensatz übernehmen?\n\n${liste}\n\n`
    + 'Damit schlägt die App nur noch Gewichte vor, die sich aufstecken lassen. '
    + 'Ändern kannst du das jederzeit unter Mehr.')) return;
  store.setSetting('scheiben', satz);
  toast('Scheibensatz übernommen – steht unter Mehr');
}

/** Kurzschlüssel eines Freundes: gleicher Name, gleicher Eintrag. */
const freundId = (name) => name.trim().toLowerCase().slice(0, 24);

/**
 * Die GitHub-Seite, auf der das Secret für den Push hinterlegt wird – oder null.
 *
 * Der Weg dorthin heißt *Settings → Secrets and variables → Actions → New
 * repository secret*, und das sind auf einem Handy vier Menüs in einer Ansicht,
 * die für einen Bildschirm dreimal so breit gebaut ist. Die Adresse führt in
 * einem Schritt hin.
 *
 * Abgeleitet aus der eigenen Adresse, nicht eingetragen: Wer diese App irgendwo
 * anders hinstellt, bekommt seinen eigenen Verweis. Steht sie nicht auf
 * GitHub Pages, gibt es keinen – dann bleibt die Wegbeschreibung stehen.
 *
 * **Der Umweg über /login ist der eigentliche Trick.** Direkt aufgerufen
 * antwortet GitHub auf eine Einstellungsseite mit *404 – Didn't find anything
 * here*, wenn man nicht angemeldet ist. Nicht mit „keine Berechtigung": Wer
 * nichts sehen darf, soll nicht einmal erfahren, dass es die Seite gibt. Das
 * ist als Auskunft richtig und als Wegweiser fatal – der erste Versuch endete
 * genau dort, und die Seite sah aus, als sei der Link kaputt. `/login` mit
 * `return_to` führt Angemeldete unverändert durch und alle anderen erst durch
 * die Anmeldung und dann ans Ziel.
 */
function geheimnisURL() {
  const konto = /^([^.]+)\.github\.io$/.exec(location.hostname);
  const repo = location.pathname.split('/').filter(Boolean)[0];
  if (!konto || !repo || repo.includes('.')) return null;
  const ziel = `/${konto[1]}/${repo}/settings/secrets/actions/new`;
  return `https://github.com/login?return_to=${encodeURIComponent(ziel)}`;
}

/** Adresse der App zum Weitergeben – ohne Anker und ohne Suchteil. */
function appURL() {
  const u = new URL(location.href);
  u.hash = '';
  u.search = '';
  return u.href.replace(/index\.html$/, '');
}

const SHARE_TEXT = 'Mein Trainingsplan als App: 84 Einheiten, mit Hanteln oder ohne, '
  + 'mit vorgeführten Bewegungen und Pausentimer. Läuft im Browser, offline, ohne Konto.';

function renderDashboard() {
  const n = ui.workoutNo;
  const w = workoutByNo(n);
  const mode = store.workoutMode(n);
  const prog = progressOf(n, mode);
  const today = todayISO();
  const date = effDate(w);
  const diff = daysBetween(today, date);
  const shift = store.getState().shift;
  const sess = store.getState().session;
  const session = sess && sess.n === n ? sess : null;

  let when;
  if (diff === 0) when = 'Heute';
  else if (diff === 1) when = 'Morgen';
  else if (diff === -1) when = 'Gestern';
  else if (diff > 1) when = `in ${diff} Tagen`;
  else when = `vor ${-diff} Tagen`;

  const items = w.ex.map((item) => resolve(item, mode));
  const totalSets = items.reduce((a, x) => a + x.sets, 0);

  const parts = [];

  parts.push(umzugHinweis());
  parts.push(aufstiegHinweis());

  if (!store.canPersist()) parts.push(speicherWarnung());

  parts.push(`
    <section class="card">
      <div class="hero-eyebrow">${w.custom ? 'Eigenes Workout' : `${esc(when)} · Workout ${w.n}`}</div>
      <h2 class="hero-title">${w.custom ? esc(w.name) : esc(fmtDate(date, true))}</h2>
      <div class="hero-sub">${MODE_LABEL[mode]} · ${items.length} Übungen · ${totalSets} Sätze</div>
      <div class="hero-badges">
        <span class="badge accent">${mode === 'db' ? '🏋️ Hantel-Variante' : '🤸 Bodyweight-Variante'}</span>
        ${prog.erledigt ? '<span class="badge done">✓ Abgeschlossen</span>'
                        : `<span class="badge">${prog.done}/${prog.total} Sätze</span>`}
        <!-- Hier stand dasselbe "Plan +2 Tage" wie in der Übersicht, nur als
             Abzeichen. Es dort rauszunehmen und einen Tipp weiter wieder
             hinzustellen wäre keine Änderung gewesen. Die Zahl steht weiterhin
             unter Mehr → Termine, wo man sie sucht, wenn man sie sucht. -->
        ${session ? '<span class="badge accent" id="sessionBadge">⏱ läuft</span>' : ''}
      </div>
      <div class="progress"><i style="width:${prog.pct}%"></i></div>
      ${session
        ? sessionButtons(n, mode)
        : `<div class="btn-row">
             <button type="button" class="btn btn-primary btn-block" data-act="start-session">▶︎ Workout starten</button>
           </div>`}
      <div class="btn-row nav">
        <button type="button" class="btn btn-ghost" data-act="nav-workout" data-delta="-1" ${w.custom || n === PLAN[0].n ? 'disabled' : ''}>← Vorheriges</button>
        <button type="button" class="btn btn-ghost" data-act="nav-today">Heute</button>
        <button type="button" class="btn btn-ghost" data-act="nav-workout" data-delta="1" ${w.custom || n === PLAN[PLAN.length - 1].n ? 'disabled' : ''}>Nächstes →</button>
      </div>
    </section>
  `);

  parts.push(`<div class="focus-top">
      <button type="button" class="back-link" data-act="${store.getState().session ? 'focus-back' : 'hide-list'}">‹ Zurück</button>
      <span class="focus-count">${w.ex.length} Übungen · ${prog.done}/${prog.total} Sätze</span>
    </div>`);

  items.forEach((it, i) => {
    const sets = store.getSets(n, mode, it.id, it.sets).slice(0, it.sets);
    const doneCount = sets.filter((s) => s.done).length;
    const open = ui.openEx.has(it.id);
    const complete = doneCount === it.sets;
    const prev = lastLoggedFor(it.id, mode, n);

    // Satz-Knöpfe liegen bewusst außerhalb des aufklappbaren Bereichs: Abhaken
    // ist der eine Handgriff, der zwischen zwei Sätzen schnell gehen muss.
    const setBtns = sets.map((s, idx) => `
      <button type="button" class="set-btn ${s.done ? 'on' : ''}" aria-pressed="${s.done}"
              aria-label="Satz ${idx + 1} von ${it.sets} erledigt"
              data-act="toggle-set" data-ex="${it.id}" data-i="${idx}">${s.done ? '✓' : idx + 1}</button>
    `).join('');

    // Gewichtszeile: ein Arbeitsgewicht je Übung, nicht je Satz. Die Erhöhung
    // gilt ab dem nächsten Mal, sobald heute schon ein Satz steht. Wie groß
    // ein Schritt ist, hängt an der Übung – siehe stepOf().
    const kg = it.weight === null ? null : workingWeight(it.id);
    const anders = it.weight === null ? '' : doneWeightNote(n, mode, it.id);
    const weightRow = kg === null ? bandRow(it) : `
      <div class="ex-weight">
        ${kgKnopf(it, -1)}
        <div class="kg-main">
          <input type="text" inputmode="decimal" class="kg-val" value="${fmtNum(kg)}"
                 data-act="weight-input" data-ex="${it.id}" aria-label="Gewicht ${esc(it.name)} in Kilo">
          <span class="kg-unit">kg${it.weightNote ? ` · ${esc(it.weightNote)}` : ''}</span>
        </div>
        ${kgKnopf(it, 1)}
      </div>
      ${anders ? `<div class="kg-next">${esc(anders)}</div>` : ''}
      ${aufwaermZeile(it, mode, n)}`;

    parts.push(`
      <article class="ex ${open ? 'open' : ''} ${complete ? 'complete' : ''}">
        <div class="ex-head" data-act="toggle-ex" data-ex="${it.id}" role="button" tabindex="0" aria-expanded="${open}">
          <span class="ex-idx">${complete ? '✓' : i + 1}</span>
          <span class="ex-main">
            <span class="ex-name">${esc(it.name)}</span>
            <span class="ex-meta">${it.sets} × ${esc(repsLabel(it, mode))} · ${esc(gruppeLabel(it, mode))} · ${esc(it.equip)}${
              it.nach ? ` · <b>+${it.nach} nachgeholt</b>` : ''}</span>
          </span>
          <span class="ex-right"><span class="chev">▼</span></span>
        </div>
        ${anfaengerZeile(it)}
        ${weightRow}
        ${wdhRow(it, mode)}
        <div class="ex-sets">${setBtns}</div>
        <div class="ex-body">
          ${open ? `<div class="ex-fig" data-pattern="${esc(it.pattern)}"
               data-weight="${it.weight !== null}" data-gear="${esc(it.gear || '')}"></div>` : ''}
          <div class="cue">${esc(it.cue)}</div>
          ${detailBlock(it)}
          <div class="ex-facts">
            <span>Pause ${Math.floor(restFor(it) / 60)}:${String(restFor(it) % 60).padStart(2, '0')} min</span>
            <span>${it.sets} Sätze × ${esc(it.reps)} Wdh.</span>
            <span>${esc(it.equip)}</span>
          </div>
          ${prev ? `<div class="last-time">Zuletzt (Workout ${prev.n}): ${esc(prev.text)}</div>` : ''}
        </div>
      </article>
    `);
  });

  parts.push(careBlock(n));
  parts.push(`
    <div class="btn-row">
      <button type="button" class="btn btn-primary" data-act="complete-workout">Alle Sätze abhaken</button>
      <button type="button" class="btn btn-danger" data-act="reset-workout">Zurücksetzen</button>
    </div>
    <p class="small muted" style="margin-top:14px">
      Hantel-Variante oder Bodyweight-Äquivalent wählst du in der Übersicht über dem
      Startknopf, solange kein Satz steht. Beide werden getrennt protokolliert.
    </p>
    ${vorratNote(w, mode)}
    ${injuryNote(w, mode)}
  `);

  view.innerHTML = parts.join('');

  // Die Figur erst nach dem Einhängen montieren – sie misst ihren Platz und
  // hängt Listener fürs Drehen an. Nur aufgeklappte Karten bekommen eine:
  // eine Animation je Übung im Hintergrund wäre Rechenzeit für nichts.
  view.querySelectorAll('.ex-fig').forEach((host) => {
    mountFigure(host, host.dataset.pattern, host.dataset.weight === 'true', host.dataset.gear || null);
  });
}

/** Letzter protokollierter Eintrag derselben Übung im selben Modus. */
function lastLoggedFor(exId, mode, beforeN) {
  for (let i = PLAN.length - 1; i >= 0; i--) {
    const w = PLAN[i];
    if (w.n >= beforeN) continue;
    const item = exOf(w, mode).find((x) => x.id === exId);
    if (!item) continue;
    const arr = store.peekSets(w.n, mode, exId);
    if (!arr) continue;
    const filled = arr.filter((s) => s.w !== '');
    if (!filled.length) continue;
    return { n: w.n, text: filled.map((s) => s.w).join(' · ') };
  }
  return null;
}

/* ------------------------------------------------------------------ *
 * Statistik
 * ------------------------------------------------------------------ */

/**
 * Zeitreihen aus dem Protokoll: je Übung das benutzte Gewicht, je
 * Muskelgruppe das Volumen (Gewicht × geplante Wdh. × Sätze) einer Einheit.
 *
 * Nur abgehakte Sätze zählen, und nur die Hantel-Variante trägt Kilo bei –
 * Bodyweight-Einheiten haben schlicht kein Gewicht, das man summieren könnte.
 */
function progressSeries() {
  const perExercise = new Map();
  const perMuscle = new Map();

  // Alle Einheiten, in denen etwas steht – die abgelegten zuerst, dann die des
  // laufenden Plans. Eine abgelegte Einheit kennt ihren Plan nicht mehr; ihr
  // Tag steht im Protokoll (startedOn), sonst zählt der Tag, an dem die Runde
  // weggelegt wurde. Ohne die Ablage bräche jede Kurve beim Fokuswechsel ab –
  // und genau die Kurven zeigen, dass es vorangeht.
  const einheiten = [];
  (store.getState().rounds || []).forEach((r) => {
    Object.values(r.log || {}).forEach((e) => {
      if (e) einheiten.push({ tag: e.startedOn || r.finishedOn || '', e });
    });
  });
  einheiten.sort((a, b) => (a.tag < b.tag ? -1 : (a.tag > b.tag ? 1 : 0)));
  const log = store.getState().log;
  PLAN.forEach((w) => { if (log[w.n]) einheiten.push({ tag: effDate(w), e: log[w.n] }); });

  einheiten.forEach(({ tag, e }) => {
    const day = tag ? fmtDate(tag) : '';
    const muscleDay = new Map();

    Object.entries(e.db || {}).forEach(([id, arr]) => {
      const ex = EX_BY_ID.get(id);
      if (!ex || !Array.isArray(arr)) return;
      const done = arr.filter((x) => x && x.done && x.w !== '');
      if (!done.length) return;

      const kg = parseFloat(String(done[0].w).replace(',', '.'));
      if (Number.isNaN(kg) || kg <= 0) return;

      if (!perExercise.has(id)) perExercise.set(id, []);
      perExercise.get(id).push({ label: day, value: kg });

      const vol = kg * plannedReps(stufenWerte(ex.db).reps) * done.length;
      ex.db.muscles.forEach((m) => muscleDay.set(m, (muscleDay.get(m) || 0) + vol));
    });

    muscleDay.forEach((vol, m) => {
      if (!perMuscle.has(m)) perMuscle.set(m, []);
      perMuscle.get(m).push({ label: day, value: vol });
    });
  });

  return { perExercise, perMuscle };
}

/**
 * Vergleich mit den Freunden, die einem ihren Stand geschickt haben.
 *
 * Sortiert nach erledigten Einheiten. Beim eigenen Eintrag steht "du", bei den
 * anderen, wie alt ihr Stand ist – ohne das hielte man einen drei Wochen alten
 * Wert für den heutigen.
 */
function vergleichKarte() {
  const ich = meinStand();
  const freunde = Object.entries(store.getState().friends || {})
    .map(([id, f]) => ({ id, ...f }));
  const alle = [{ id: null, ...ich }, ...freunde].sort((a, b) => b.w - a.w || b.s - a.s);

  return `
    <div class="section-title">Vergleich</div>
    <div class="card">
      ${ui.standZurueck ? `<div class="notice" style="margin:0 0 10px">
        ↩︎ ${esc(ui.standZurueck)} sieht deinen Stand erst, wenn du ihn zurückschickst.
        <div class="btn-row nav" style="margin-top:8px">
          <button type="button" class="btn btn-primary" data-act="share-stand">Zurückschicken</button>
          <button type="button" class="btn btn-ghost" data-act="drop-zurueck">Später</button>
        </div></div>` : ''}
      ${freunde.length ? `
      <table class="vgl">
        <thead><tr><th></th><th>Name</th><th>Einheiten</th><th>Sätze</th><th>Serie</th><th></th></tr></thead>
        <tbody>${alle.map((f, i) => `
          <tr class="${f.id === null ? 'ich' : ''}">
            <td class="vgl-rang">${i + 1}</td>
            <td>${esc(f.n)}${f.id === null ? ' <span class="muted">(du)</span>' : ''}
              <div class="small muted">${esc([
                f.f || '', letztesTraining(f), f.id === null ? '' : standAlter(f),
              ].filter(Boolean).join(' · '))}</div></td>
            <td><b>${f.w}</b><span class="muted">/${f.p}</span></td>
            <td>${f.s}</td>
            <td>${f.r}</td>
            <td>${f.id === null ? '' : `<button type="button" class="vgl-weg" data-act="remove-friend"
                   data-id="${esc(f.id)}" aria-label="${esc(f.n)} entfernen">✕</button>`}</td>
          </tr>`).join('')}</tbody>
      </table>` : `
      <div class="small muted">Noch niemand im Vergleich. Schick jemandem deinen Stand –
        wer den Link öffnet, hat dich danach in seiner Liste stehen und kann seinen
        zurückschicken.</div>`}
      <div class="btn-row">
        <button type="button" class="btn btn-primary btn-block" data-act="share-stand">Meinen Stand schicken</button>
      </div>
      <div class="small muted">Kein Konto, kein Server: Der Stand steckt im Link selbst.
        Was hier steht, ist der Stand vom Tag, an dem er geschickt wurde – aktueller
        wird er erst, wenn der andere einen neuen schickt.</div>
    </div>`;
}

/** Wann zuletzt trainiert wurde – die interessanteste Zeile im Vergleich. */
function letztesTraining(f) {
  if (!f.z) return 'noch nicht angefangen';
  const tage = daysBetween(f.z, todayISO());
  if (tage <= 0) return 'heute trainiert';
  if (tage === 1) return 'gestern trainiert';
  return `zuletzt vor ${tage} Tagen`;
}

/** Wie alt der geschickte Stand ist. */
function standAlter(f) {
  const tage = daysBetween(f.am || f.d, todayISO());
  if (tage <= 0) return 'Stand von heute';
  if (tage === 1) return 'Stand von gestern';
  return `Stand von vor ${tage} Tagen`;
}

/**
 * Was über alle Runden zusammenkommt – und wie weit es bis zur nächsten Stufe ist.
 *
 * Steht nur da, wenn es überhaupt eine abgelegte Runde gibt: Solange die erste
 * läuft, sind Gesamtzahl und Rundenzahl dieselbe Zahl, und zwei gleiche Zahlen
 * nebeneinander erklären nichts.
 *
 * Ohne diese Karte wäre der Aufstieg unerklärlich. Oben steht "4 von 84
 * Workouts", und dann stuft die App bei 60 hoch – wer die Zahl, gegen die
 * gerechnet wird, nirgends sehen kann, hält das für einen Fehler.
 */
/**
 * Die Erfahrungsstufe – zum Ansehen, nicht zum Einstellen.
 *
 *     „Die App sollte einen ja selbst auf Grundlage der Gewichte,
 *      Wiederholungen, Anzahl absolvierter Trainings usw irgendwann hochstufen.
 *      Selbst sollte man diese Einstufung ja nie verändern."
 *
 * Das ist die richtige Trennung, und vorher war sie nicht gezogen: Unter Mehr
 * standen drei Knöpfe, mit denen man sich jederzeit selbst hochstufen konnte –
 * und damit war die Stufe eine Meinung über sich und keine Messung. Wer sich
 * hochstuft, bekommt mehr Sätze, als er gerade verträgt; wer sich herunterstuft,
 * trainiert zu wenig und merkt es nicht.
 *
 * Gewählt wird sie deshalb genau einmal, bei der Einrichtung, als
 * Selbsteinschätzung zum Start. Danach gehört sie der App: pruefeAufstieg()
 * zählt Einheiten, Sätze und bewegte Tonnen und stellt um, wenn alles drei
 * steht. Was hier bleibt, ist die Auskunft – wo man steht, was das für den Plan
 * heißt, und wie weit es noch ist.
 */
function erfahrungStand() {
  const s = store.getState();
  const key = s.level || 'geuebt';
  const eintrag = LEVELS.find(([k]) => k === key) || LEVELS[1];
  const saetze = SAETZE_JE_STUFE[key] || 3;
  const schritt = offenerAufstieg();
  return `
    <div class="stat-grid">
      <div class="stat"><div class="stat-v">${esc(eintrag[1])}</div>
        <div class="stat-l">${esc(plural(saetze, 'Satz', 'Sätze'))} je Übung</div></div>
    </div>
    <div class="small muted" style="margin-top:10px">${esc(eintrag[2])}</div>
    <div class="small muted" style="margin-top:10px">Die Stufe skaliert Startgewichte
      <em>und</em> Sätze je Übung. Übungen, Pausen und die Verteilung über die Woche bleiben,
      wie sie sind – jede Muskelgruppe behält ihren Anteil, nur die Höhe ändert sich.
      Eingestellte Gewichte rührt sie nie an.</div>
    ${aufstiegBalken()}
    <div class="small muted" style="margin-top:12px">${schritt
      ? 'Hochgestuft wird von selbst, sobald alles davon steht – einstellen kannst und '
        + 'sollst du das nicht: Eine Stufe ist etwas, das man sich ertrainiert, keine '
        + 'Einstellung. Gewählt hast du sie einmal bei der Einrichtung, danach zählt die App.'
      : ((s.aufstiege || []).length && key !== 'fortgeschritten'
        ? 'Der nächste Schritt war schon einmal dran. Die App stuft von selbst nicht noch '
          + 'einmal hoch.'
        : 'Du stehst auf der höchsten Stufe – hier kommt nichts mehr dazu.')}</div>`;
}

/**
 * Wie weit es bis zur nächsten Stufe noch ist.
 *
 * Stand bisher nur in gesamtKarte(), und die zeigt sich erst nach einer
 * *abgeschlossenen Runde* – also nach 84 Einheiten. Ein Anfänger in seiner
 * ersten Runde, und damit genau der, um den es geht, hat diese Balken nie
 * gesehen:
 *
 *     „Wenn die App mich bisher noch nicht hochgestuft hat, bin ich ja
 *      anscheinend noch Anfänger."
 *
 * Richtig – aber dann muss auch dastehen, wie weit es noch ist. Sonst ist die
 * Stufe eine Zahl, die irgendwann von selbst umspringt, und bis dahin weiß
 * niemand, ob sie überhaupt noch kommt.
 */
function aufstiegBalken() {
  const g = gesamtStats();
  const schritt = offenerAufstieg();
  if (!schritt) return '';
  const name = (k) => (LEVELS.find(([key]) => key === k) || [])[1] || k;
  const zeile = (wert, ziel, was) => {
    const pct = Math.min(100, Math.round((wert / ziel) * 100));
    return `
      <div class="bar-row">
        <div>
          <div class="bar-name">${esc(was)}</div>
          <div class="bar-track"><i style="width:${pct}%"></i></div>
        </div>
        <div class="bar-val">${fmtNum(Math.round(wert))} / ${fmtNum(ziel)}</div>
      </div>`;
  };
  // Die Tonnage zählt nur der Hantel-Modus – wer überwiegend ohne Gewichte
  // trainiert, wird an ihr auch nicht gemessen (siehe pruefeAufstieg()).
  const mitGewichten = g.db >= g.bw;
  return `
    <div class="small muted" style="margin-top:14px">Bis <b>${esc(name(schritt.nach))}</b> –
      alle ${mitGewichten ? 'drei' : 'beide'} müssen voll sein${
        mitGewichten ? '' : '; die Tonnage zählt bei dir nicht mit, weil du ohne Gewichte trainierst'}:</div>
    <div class="bars" style="margin-top:8px">
      ${zeile(g.einheiten, schritt.einheiten, 'Einheiten')}
      ${zeile(g.saetze, schritt.saetze, 'Sätze')}
      ${mitGewichten ? zeile(g.volumen / 1000, schritt.tonnen, 'Tonnen') : ''}
    </div>`;
}

function gesamtKarte() {
  const s = store.getState();
  if (!(s.rounds || []).length) return '';
  const g = gesamtStats();
  const schritt = offenerAufstieg();
  return `
    <div class="section-title">Insgesamt trainiert</div>
    <div class="card">
      <div class="stat-grid">
        <div class="stat"><div class="stat-v">${g.einheiten}</div><div class="stat-l">Einheiten
          <span class="muted">über alle Pläne</span></div></div>
      </div>
      <div class="small muted" style="margin-top:10px">Oben steht der Fortschritt in
        <i>diesem</i> Plan – hier stehen alle ${plural(g.runden + 1, 'Runde', 'Runden')} zusammen.
        Ein Neustart oder ein Wechsel des Trainingsfokus fängt den Plan neu an; gezählt wird
        weiter.</div>
      ${schritt ? aufstiegBalken()
        : `<div class="small muted" style="margin-top:12px">${
            (s.aufstiege || []).length && s.level !== 'fortgeschritten'
              ? 'Der nächste Schritt war schon einmal dran und wurde zurückgestellt – die App '
                + 'stuft dich nicht noch einmal von selbst hoch. Umstellen kannst du jederzeit '
                + 'unter <i>Mehr → Erfahrung</i>.'
              : 'Du stehst auf der höchsten Erfahrungsstufe – hier kommt nichts mehr dazu.'}
           </div>`}
    </div>`;
}

/**
 * Der Überblick zählt über den Plan hinaus.
 *
 * *„Auch Statistik und so ist jetzt ja alles weg."* – nach einem Fokuswechsel,
 * denn sammleStats() liest nur den laufenden Verlauf. Sätze, Wiederholungen,
 * Kilo und Zeit gehören aber dem, der trainiert hat, und nicht dem Plan; sie
 * kommen deshalb aus lebenStats(), also aus allen Protokollen zusammen.
 *
 * Plan-Zahlen bleiben Plan-Zahlen: „Workouts erledigt" zählt gegen die 84
 * Einheiten dieser Variante, und die Serie zählt die Einheiten dieses Plans
 * rückwärts. Beides in einen Gesamtwert zu mischen ergäbe nichts – zwei Pläne
 * haben nicht dieselben Einheiten.
 */
/**
 * Was das Protokoll über die Gewohnheiten sagt – und was man dagegen tun kann.
 *
 * Steht in der Statistik und nicht auf dem Dashboard: Es ist eine Auswertung,
 * kein Auftrag für heute. Und sie steht nur da, wenn es etwas zu sagen gibt –
 * eine Karte, die in der Hälfte der Fälle „alles gut" meldet, wird nicht
 * gelesen, sie wird überblättert.
 */
function musterKarte() {
  const ab = abbruch();
  const weg = ausgelassen();
  if (!ab && !weg.length) return '';
  const vorn = vorneListe();
  return `
    <div class="section-title">Was dir im Protokoll auffällt</div>
    <div class="card">
      ${ab ? `<div class="small">In ${plural(ab.kurz, 'Einheit', 'Einheiten')} von
        ${ab.einheiten} hast du vor dem Ende aufgehört – meist nach Übung
        <b>${ab.bis} von ${ab.von}</b>. Das ist kein Problem einer einzelnen Übung,
        sondern der Länge: Was hinten steht, kommt nicht dran. Entweder die Einheit
        kürzen (Erfahrungsstufe eine Stufe zurück, unter <i>Mehr</i>) oder das
        Wichtige nach vorn holen.</div>` : ''}

      ${weg.length ? `
        <div class="small" style="${ab ? 'margin-top:12px' : ''}">Diese Übungen fallen
          regelmäßig aus – jeweils gezählt über die Einheiten, in denen sie überhaupt
          dran waren:</div>
        <div class="muster-liste">
          ${weg.map((x) => `
            <div class="muster-zeile">
              <div>
                <div class="lbl">${esc(x.name)}</div>
                <div class="hint">${x.weg} von ${x.dran} Mal übergangen</div>
              </div>
              <button type="button" class="btn btn-sm ${vorn.includes(x.id) ? '' : 'btn-primary'}"
                      data-act="muster-vorne" data-ex="${esc(x.id)}">
                ${vorn.includes(x.id) ? 'steht vorn ✓' : 'nach vorn'}
              </button>
            </div>`).join('')}
        </div>
        <div class="small muted" style="margin-top:10px">„Nach vorn" heißt: Diese Übung
          steht ab sofort am Anfang der Einheit, vor der Bündelung nach Gerät. Das kostet
          womöglich einen zusätzlichen Umbau – eine Übung, die ausfällt, bringt aber null
          Sätze, und das ist der teurere Preis.</div>` : ''}
    </div>`;
}

function renderStats() {
  const { workoutsDone, streak, upcoming, customSets } = sammleStats();
  const leben = lebenStats();
  const setsDone = leben.saetze;
  const repsTotal = leben.reps;
  const volume = leben.volumen;
  const perEx = leben.perEx;
  const seconds = leben.sekunden;
  const mitZeit = leben.mitZeit;
  // Über alle Pläne hinweg – sonst stünde nach dem Wechsel „🏋️ 0 · 🤸 0" da.
  const modusDb = leben.db;
  const modusBw = leben.bw;
  // Ab fünf gemessenen Einheiten rechnet die App nicht mehr mit der Formel,
  // sondern mit dem, was die Uhr sagt – siehe zeitEichung().
  const eich = zeitEichung();

  const topEx = [...perEx.entries()]
    .map(([id, c]) => ({ ex: EX_BY_ID.get(id), c }))
    .sort((a, b) => b.c - a.c)
    .slice(0, 8);
  const max = topEx.length ? topEx[0].c : 1;

  view.innerHTML = `
    <div class="section-title">Überblick</div>
    <div class="stat-grid">
      <div class="stat"><div class="stat-v">${workoutsDone}<span class="muted" style="font-size:15px">/${PLAN.length}</span></div><div class="stat-l">Workouts erledigt</div></div>
      <div class="stat"><div class="stat-v">${streak}</div><div class="stat-l">Serie in Folge</div></div>
      <div class="stat"><div class="stat-v">${setsDone}</div><div class="stat-l">Sätze abgehakt${
        customSets ? ` <span class="muted">(${customSets} eigene)</span>` : ''}</div></div>
      <div class="stat"><div class="stat-v">${repsTotal ? `ca. ${Math.round(repsTotal)}` : '–'}</div><div class="stat-l">Wiederholungen (geplant)</div></div>
      <div class="stat"><div class="stat-v">${volume ? `ca. ${Math.round(volume).toLocaleString('de-DE')}` : '–'}</div><div class="stat-l">Volumen kg (Hanteln)</div></div>
      <div class="stat"><div class="stat-v">🏋️ ${modusDb} · 🤸 ${modusBw}</div><div class="stat-l">Modus-Verteilung</div></div>
      ${leben.tage.size ? `<div class="stat"><div class="stat-v">${leben.tage.size}</div>
        <div class="stat-l">Trainingstage</div></div>` : ''}
      ${seconds ? `<div class="stat"><div class="stat-v">${esc(dauerText(seconds))}</div>
        <div class="stat-l">Zeit im Training${mitZeit > 1
          ? ` <span class="muted">(Ø ${esc(dauerText(Math.round(seconds / mitZeit)))})</span>` : ''}</div></div>` : ''}
      ${eich ? `<div class="stat"><div class="stat-v">${eich.faktor < 1 ? '−' : '+'}${
        Math.abs(Math.round((eich.faktor - 1) * 100))} %</div>
        <div class="stat-l">gegen die Schätzung <span class="muted">(${eich.einheiten} Einheiten)</span></div></div>` : ''}
      ${store.getState().rounds.length
        ? `<div class="stat"><div class="stat-v">${store.getState().rounds.length}</div><div class="stat-l">Runden abgeschlossen</div></div>` : ''}
    </div>

    ${gesamtKarte()}

    ${musterKarte()}

    ${eich ? `<div class="card small muted" style="margin-top:-4px">
      Die Dauer an den Trainingsplänen ist keine Schätzung mehr: Über
      ${eich.einheiten} gemessene Einheiten brauchst du
      <b>${eich.faktor < 1 ? Math.round((1 - eich.faktor) * 100) + ' % weniger'
        : Math.round((eich.faktor - 1) * 100) + ' % mehr'}</b>
      Zeit als die Formel (40 s je Satz plus die vorgesehene Pause) annimmt.
      Damit rechnet sie ab jetzt.${eich.gedeckelt
        ? ' Der gemessene Wert liegt außerhalb des Vertrauensbereichs und ist gedeckelt –'
          + ' vermutlich lief die Uhr einmal weiter, während du etwas anderes gemacht hast.'
        : ''}
    </div>` : ''}

    ${vergleichKarte()}

    <div class="section-title">Nächste Einheit</div>
    <div class="card">
      ${upcoming
        ? `<div class="plan-date">Workout ${upcoming.n} · ${esc(fmtDate(effDate(upcoming), true))}</div>
           <div class="small muted" style="margin-top:4px">${esc(exOf(upcoming, store.workoutMode(upcoming.n)).map((i) => resolve(i, store.workoutMode(upcoming.n)).name).join(' · '))}</div>
           <div class="btn-row"><button type="button" class="btn btn-primary" data-act="open-workout" data-n="${upcoming.n}">Öffnen</button></div>`
        : '<div class="muted">Alle Einheiten des Plans sind abgeschlossen. Stark.</div>'}
    </div>

    <div class="section-title">Wochenvolumen</div>
    <div id="volWeek"></div>

    <div class="section-title">Gewicht je Übung</div>
    <div class="spark-grid" id="sparkEx"></div>

    <div class="section-title">Volumen je Muskelgruppe</div>
    <div class="spark-grid" id="sparkMus"></div>

    <div class="section-title">Meist trainierte Übungen</div>
    <div class="card">
      ${topEx.length ? `<div class="bars">${topEx.map((t) => `
        <div class="bar-row">
          <div>
            <div class="bar-name">${esc(t.ex.db.name)} <span class="muted">/ ${esc(t.ex.bw.name)}</span></div>
            <div class="bar-track"><i style="width:${Math.round((t.c / max) * 100)}%"></i></div>
          </div>
          <div class="bar-val">${t.c}</div>
        </div>`).join('')}</div>`
        : '<div class="muted small">Noch keine Sätze protokolliert – hak im Dashboard den ersten Satz ab.</div>'}
    </div>
  `;

  const { perExercise, perMuscle } = progressSeries();
  const kgFmt = (v) => (Number.isInteger(v) ? String(v) : v.toFixed(1).replace('.', ','));

  const fill = (id, entries, label, unit, fmt, empty) => {
    const host = document.getElementById(id);
    if (!host) return;
    if (!entries.length) {
      host.innerHTML = `<div class="card muted small">${empty}</div>`;
      return;
    }
    entries.forEach(([key, points]) => {
      host.appendChild(sparkPanel({ label: label(key), points, unit, fmt }));
    });
  };

  fill('sparkEx',
    [...perExercise.entries()].sort((a, b) => b[1].length - a[1].length),
    (id) => EX_BY_ID.get(id).db.name, 'kg', kgFmt,
    'Sobald du mit Hanteln trainierst, steht hier der Verlauf je Übung.');

  renderWeeklyVolume();

  fill('sparkMus',
    [...perMuscle.entries()].sort((a, b) => b[1].length - a[1].length),
    (m) => MUSCLE_LABEL[m] || m, 'kg', (v) => Math.round(v).toLocaleString('de-DE'),
    'Noch kein Volumen erfasst. Nur Hantel-Einheiten tragen Kilo bei.');
}

/* ------------------------------------------------------------------ *
 * Bandstärke
 *
 * Am Band gibt es kein Gewicht, aber zwei Bänder: gelb ist leicht, rot ist
 * schwer. Genau das ist dort die Steigerung – dieselbe Übung, stärkeres Band –,
 * und ohne eine Stelle dafür stünde bei jeder Bandübung nichts, wo sonst das
 * Arbeitsgewicht steht.
 * ------------------------------------------------------------------ */

const BAENDER = [['gelb', 'Gelb', 'leicht'], ['rot', 'Rot', 'schwer']];

/** Braucht diese Übung ein Band? Steht im Gerätenamen der Variante. */
const amBand = (it) => /band/i.test(it.equip || '');

/**
 * Wiederholungen im Bodyweight-Modus – dieselbe Zeile wie das Gewicht.
 *
 * Ohne Zusatzlast ist die Wiederholungszahl die Steigerung. Erreichbar war sie
 * bisher nur über einen Vorschlag ("2× komplett · nächstes Mal 14–22?"), und
 * Vorschläge sind raus: Die App weiß nicht, wie schwer ein Satz war, also
 * entscheidet das der Mensch. Jetzt stehen hier zwei Knöpfe, genau wie bei den
 * Kilo. Angezeigt wird der *neue* Bereich, nicht der alte mit einem Plus
 * dahinter – sonst rechnet man beim Lesen selbst.
 */
function wdhRow(it, mode, extra = '') {
  if (mode !== 'bw') return '';
  const plus = store.bwPlusOf(it.id);
  return `
    <div class="ex-weight ${extra}">
      <button type="button" class="kg-step" data-act="reps-step" data-ex="${it.id}" data-d="-1"
              ${plus ? '' : 'disabled'} aria-label="Eine Wiederholung weniger">−</button>
      <div class="kg-main">
        <span class="kg-val kg-fest">${esc(repsLabel(it, mode))}</span>
        <span class="kg-unit">Wdh.${plus ? ` · ${plus} mehr als im Plan` : ''}</span>
      </div>
      <button type="button" class="kg-step kg-plus" data-act="reps-step" data-ex="${it.id}" data-d="1"
              aria-label="Eine Wiederholung mehr">+</button>
    </div>`;
}

/*
 * Hier standen die Satzfrage („unter 8 / 8-11 / 12+“) und der darauf gestuetzte
 * Steigerungsvorschlag. Beides ist wieder raus, auf Ansage: Die Frage stand
 * mitten im Training unter dem Satzraster und war eine Zeile, die niemand
 * bestellt hat.
 *
 * Damit faellt auch der Vorschlag weg, und das ist keine Nebenwirkung, sondern
 * die Konsequenz: Er hing an den Antworten. Ohne sie weiss die App nicht, wie
 * schwer ein Satz war - und ein Vorschlag ohne diese Kenntnis waere geraten.
 * Lieber nichts sagen als etwas erfinden. Was aufs Eisen kommt, entscheidet
 * weiter der, der darunter liegt; die Knoepfe dafuer stehen ueber jedem Satz.
 */

/**
 * Die Paare der nächsten Einheit, zum Nachsehen.
 *
 * Ohne diese Vorschau wäre der Schalter ein Versprechen: „paart automatisch".
 * Ob das für *diese* Einheit etwas bringt, sieht man erst im Training – und
 * dann steht man mittendrin. Hier steht es vorher, mit Namen.
 *
 * Übungen ohne Partner stehen mit dabei, und das ist wichtiger als es aussieht:
 * Nicht alles lässt sich paaren, und wer das nicht sieht, hält den Schalter für
 * kaputt, wenn die Einheit doch Pausen hat.
 */
function superVorschau() {
  const n = ui.workoutNo;
  const mode = store.workoutMode(n);
  let gruppen;
  try {
    gruppen = superGruppen(n, mode);
  } catch {
    return '';   // eigene Einheit halb angelegt o. Ä. – dann eben keine Vorschau
  }
  if (!gruppen.length) return '';
  const paarZahl = gruppen.filter((g) => g.length === 2).length;
  return `
    <div class="scheiben-satz">
      <div class="lbl">Workout ${n} liefe so</div>
      ${gruppen.map((g) => (g.length === 2
        ? `<div class="super-paar">↔ ${esc(g[0].name)} <span class="super-mit">im Wechsel mit</span> ${esc(g[1].name)}</div>`
        : `<div class="super-paar allein">${esc(g[0].name)} <span class="super-mit">allein, mit normaler Pause</span></div>`)).join('')}
      <div class="hint">${paarZahl
        ? `${paarZahl} ${paarZahl === 1 ? 'Paar' : 'Paare'} – der Rest läuft wie bisher.`
        : 'Für diese Einheit findet sich kein Paar: Entweder teilen sich die Übungen '
          + 'einen Muskel oder sie brauchen dasselbe Gerät.'}</div>
    </div>`;
}

/* ------------------------------------------------------------------ *
 * Was hier rumliegt: Stangen und Scheiben
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
 * ------------------------------------------------------------------ */

/**
 * Der Satz, wie er gespeichert ist – ungeordnet und ungeprüft.
 *
 * Die Eingabefelder müssen daraus gefüllt werden, nicht aus meinSatz(): Das
 * sortiert und wirft Unbrauchbares weg, und beides mitten im Tippen. Wer „2,5"
 * eintippt, hätte nach der „2" eine andere Zeilennummer, und der nächste
 * Tastendruck landete in der falschen Zeile. Gerechnet wird weiter mit der
 * geprüften Fassung; angezeigt wird, was dasteht.
 */
function roherSatz() {
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
 * ------------------------------------------------------------------ */
function vorratZeile(g) {
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
 * gedeckt", weil es im Katalog das Inverted Row an der Tischkante gibt. Im
 * Bodyweight-Plan bleiben davon **0,0 von 10 Sätzen** je Woche übrig. Eine
 * Übung, die es gäbe, ist kein Volumen.
 *
 * Der Verlust kommt allein aus dem, was ersatzlos wegfällt: Ein Tausch trifft
 * dieselben Anteile und kostet deshalb nichts – das ist die Bedingung, unter der
 * überhaupt getauscht wird (siehe js/vorrat.js). Über den ganzen Plan und auf
 * eine Woche umgelegt, damit die Zahl nicht am heutigen Tag hängt.
 */
function vorratBilanz(seite) {
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
function vorratFolgen(seite) {
  if (vorratVollstaendig()) {
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
        <b>${k.bleibt.toFixed(1)}</b> <span class="muted">statt ${k.soll.toFixed(1)}</span>`)
        .join(' · ')} Sätze.</div>` : ''}
    ${kritisch.length ? `<div class="small muted" style="margin-top:6px">⚠️ Damit bleibt für
      <b>${esc(kritisch.join(', '))}</b> so gut wie nichts übrig – das ist kein Training
      dieser ${kritisch.length > 1 ? 'Gruppen' : 'Gruppe'} mehr, sondern eine Pause davon.
      Für ein Wochenende ist das egal, über Monate nicht.</div>` : ''}`;
}

function vorratKarte() {
  const seite = ui.vorratSeite === 'bw' ? 'bw' : 'db';
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

function scheibenKarte() {
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

/**
 * Den Satz ändern und speichern.
 *
 * Gespeichert wird die rohe Form; geprüft wird beim Rechnen. Sonst verschöbe
 * sich die Zeile unter dem Finger (siehe roherSatz()).
 */
function scheibenAendern(wie) {
  const satz = roherSatz();
  wie(satz);
  store.setSetting('scheiben', satz);
}

/**
 * Die Aufwärmzeile über den Sätzen – oder nichts.
 *
 * Bewusst eine Zeile und kein Knopf: Aufwärmsätze werden nicht abgehakt und
 * nicht mitgezählt (siehe aufwaermsaetze() in js/gewichte.js). Wer sie anhaken
 * könnte, hätte am Monatsende ein Drittel mehr Sätze in der Statistik, ohne ein
 * Gramm mehr bewegt zu haben.
 *
 * Sie steht nur, solange von der Übung noch nichts abgehakt ist. Danach ist das
 * Aufwärmen vorbei, und eine Ansage, die überholt ist, ist eine Ansage zu viel.
 */
/**
 * „Statt Hängendes Knieheben" – wenn die Anfängerstufe getauscht hat.
 *
 * Ein Tausch, den niemand sieht, ist eine App, die etwas anderes tut als sie
 * sagt. Dieselbe Regel wie in js/muster.js: gerechnet wird automatisch,
 * angezeigt wird immer. Wer die schwerere Fassung will, stellt die Erfahrung
 * unter Mehr eine Stufe höher – das steht im Satz mit drin, sonst wäre der
 * Hinweis eine Sackgasse.
 */
/**
 * „Statt X" – wofür diese Übung eingesprungen ist.
 *
 * Zwei Filter tauschen: die Erfahrungsstufe und der Gerätevorrat. Beide sagen
 * es hier, und beide nennen den Weg zurück – ein Tausch, den man nicht
 * rückgängig machen kann, weil man nicht weiß, wo er herkommt, wäre keiner.
 */
function anfaengerZeile(it) {
  const grund = ersatzGrund(it);
  if (!grund) return '';
  const alt = EX_BY_ID.get(grund.statt);
  if (!alt) return '';
  return grund.warum === 'vorrat'
    ? `<div class="aufwaerm">Statt ${esc(alt.db.name)}
        <span class="muted">– dafür fehlt gerade das Gerät. Unter Mehr → Was da ist
        wieder anhaken.</span></div>`
    : `<div class="aufwaerm">Statt ${esc(alt.db.name)}
        <span class="muted">– die Anfängerfassung. Höhere Erfahrungsstufe unter Mehr
        bringt die schwerere zurück.</span></div>`;
}

function aufwaermZeile(it, mode, n) {
  if (!store.getState().aufwaermen) return '';
  if ((store.peekSets(n, mode, it.id) || []).some((s) => s.done)) return '';
  const saetze = aufwaermsaetze(EX_BY_ID.get(it.id), workingWeight(it.id), it.reps);
  if (!saetze.length) return '';
  const text = saetze.map((s) => `${s.reps}× ${fmtNum(s.kg)} kg`).join(' · ');
  return `<div class="aufwaerm">Aufwärmen: ${esc(text)}
    <span class="muted">– zählt nicht mit</span></div>`;
}

/**
 * Ein − oder + an der Gewichtszeile.
 *
 * Die Beschriftung nennt den Schritt, der wirklich passiert, nicht den
 * gewünschten: Wer nur 2,5er-Scheiben hat, geht bei beiden Kurzhanteln in
 * Fünferschritten je Hand. Steht auf dem Knopf „2,5 Kilo mehr" und es werden
 * fünf, ist der Knopf gelogen.
 */
/**
 * Ein − oder + an der Gewichtszeile – mit der Sprungweite darauf.
 *
 *     „Ich will 20 kg machen aber wenn ich bei 16 auf plus drück dann geht er
 *      direkt hier hin [21,5]."
 *
 * Die Zahl stand schon immer im aria-label, also genau dort, wo man sie nicht
 * sieht. Sichtbar stand nur „+", und damit sah ein Schritt von 0,5 kg aus wie
 * einer von 5,5 – bis man ihn gedrückt hatte. Jetzt steht sie unter dem
 * Zeichen: Wer +5,5 liest, weiß vorher, dass dazwischen nichts liegt, und
 * warum – sein Scheibensatz gibt es nicht her.
 */
function kgKnopf(it, richtung) {
  const jetzt = workingWeight(it.id);
  const ziel = naechstesGewicht(it.id, richtung);
  const d = Math.abs(ziel - (jetzt || 0));
  const wort = richtung > 0 ? 'mehr' : 'weniger';
  const label = d < 0.01 ? `Kein weiterer Schritt nach ${richtung > 0 ? 'oben' : 'unten'}`
    : `${fmtNum(d)} Kilo ${wort}`;
  return `<button type="button" class="kg-step${richtung > 0 ? ' kg-plus' : ''}"
          data-act="weight-step" data-ex="${it.id}" data-dir="${richtung}"
          ${d < 0.01 ? 'disabled' : ''} aria-label="${esc(label)}">${richtung > 0 ? '+' : '−'}${
            d < 0.01 ? '' : `<span class="kg-step-d">${esc(fmtNum(d))}</span>`}</button>`;
}

/**
 * Wofür diese Übung im Plan steht – genauer als die Gruppe.
 *
 * Anlass: „Heute hab ich ja 3 mal Schulter. Sicher dass das optimal ist?" Die
 * Frage war berechtigt, die Sorge nicht: Es waren Schulterdrücken, Seitheben
 * und Pull-Apart – vordere, seitliche und hintere Schulter, drei Muskeln, die
 * getrennt gereizt werden müssen, weil keine Übung alle drei trifft. Nur stand
 * dreimal dasselbe Wort da.
 *
 * Also steht jetzt der Muskel da, den die Übung wirklich meint: der mit dem
 * höchsten Anteil, wenn er sich von der Gruppe unterscheidet. Aus „Schulter,
 * Schulter, Schulter" wird „Schulter vorn, seitlich, hinten" – und die Antwort
 * auf die Frage steht in der Zeile selbst, statt in einem Hilfetext.
 */
function gruppeLabel(it, mode) {
  const ex = EX_BY_ID.get(it.id);
  const sh = (ex && ex[mode] && ex[mode].shares) || {};
  let top = null;
  Object.keys(sh).forEach((m) => { if (!top || sh[m] > sh[top]) top = m; });
  const name = top && MUSCLE_LABEL[top];
  if (!name) return it.group;

  // Verfeinert wird nur, wenn der Muskelname die Gruppe *enthält* – dann ist er
  // eine genauere Fassung desselben Worts („seitliche Schulter" zu „Schulter").
  // Sonst stünde in der Zeile plötzlich ein anderer Begriff als in der
  // Statistik: Aus „Beine" würde „Beinbeuger Hüfte", und der Leser müsste zwei
  // Vokabeln lernen, wo eine gemeint ist.
  const teile = new RegExp(`\\b${it.group}\\b`, 'i');
  if (!teile.test(name)) return it.group;

  // „seitliche Schulter" liest sich in einer Kopfzeile schlechter als
  // „Schulter seitlich": So steht die Gruppe vorn und die Verfeinerung dahinter,
  // und untereinander sortiert sich die Einheit von selbst.
  const kurz = name.replace(/^(vordere|seitliche|hintere)\s+(.+)$/, (_, a, rest) => `${rest} ${
    { vordere: 'vorn', seitliche: 'seitlich', hintere: 'hinten' }[a]}`);
  return kurz.toLowerCase() === it.group.toLowerCase() ? it.group : kurz;
}

/**
 * Die Bandwahl – gebaut wie die Gewichtszeile, nicht wie ein Formular.
 *
 * Vorher standen zwei gleichberechtigte Knöpfe nebeneinander, „Gelb" und „Rot",
 * und man suchte sich eins aus. Das ist die falsche Frage. Am Band gibt es
 * keine freie Wahl, sondern zwei Stufen – und Stufen bedient man mit − und +,
 * genau wie bei den Kilo eine Zeile darüber.
 *
 * Also: In der Mitte steht das Band, das gilt. Rechts, wo sonst das + sitzt,
 * steht „Rot" – die Steigerung. Links, wo sonst das − sitzt, steht „Gelb" –
 * zurück. Wer auf Gelb ist, hat kein Links; wer auf Rot ist, kein Rechts. Damit
 * sieht eine Bandübung aus wie jede andere Übung, und das Band ist das, was es
 * ist: das Gewicht dieser Übung.
 *
 * Gelb ist dabei fest der Anfang, nicht „nichts gewählt". Eine Bandübung ohne
 * Band ist keine Bandübung.
 */
function bandRow(it) {
  if (!amBand(it)) return '';
  // Nicht store.bandOf() direkt: Wer das rote Band zu Hause gelassen hat, soll
  // nicht eine Farbe angezeigt bekommen, die er nicht dabei hat. Der
  // gespeicherte Wunsch bleibt stehen und ist zu Hause wieder da – siehe
  // bandFarbe() in js/vorrat.js.
  const cur = bandFarbe(it.id);
  const nurEins = GERAETE.some((g) => g.seite === 'bw' && g.id.startsWith('band-')
    && fehlt().includes(g.id));
  const knopf = (farbe, seite) => {
    // Ein Knopf, der auf ein Band umstellt, das gerade nicht da ist, verspricht
    // etwas, das die App nicht halten kann.
    if (nurEins) return '';
    const [, label, wie] = BAENDER.find(([k]) => k === farbe);
    const dran = cur === farbe;
    return `
      <button type="button" class="kg-step band-step band-${farbe}${seite === 'r' ? ' kg-plus' : ''}"
              data-act="set-band" data-ex="${it.id}" data-v="${farbe}"
              ${dran ? 'disabled' : ''}
              aria-label="${esc(dran ? `${label} ist eingestellt` : `Auf ${label} wechseln (${wie})`)}">
        <span class="band-dot"></span>
      </button>`;
  };
  return `
    <div class="ex-weight band-row" role="group" aria-label="Band für ${esc(it.name)}">
      ${knopf('gelb', 'l')}
      <div class="kg-main">
        <span class="band-name band-${cur}">
          <span class="band-dot"></span>${esc(BAENDER.find(([k]) => k === cur)[1])}</span>
        <span class="kg-unit">${esc(BAENDER.find(([k]) => k === cur)[2])}</span>
      </div>
      ${knopf('rot', 'r')}
    </div>`;
}

/**
 * Ausführliche Erklärung zu einer Übung, aufklappbar.
 *
 * Der kurze Hinweis über der Bewegung sagt, was zu tun ist. Alles, was man
 * einmal wissen will und dann nicht mehr – welcher Griff, wie der Aufbau geht,
 * was schiefgeht –, steht hier darunter und nimmt zugeklappt eine Zeile weg.
 */
function detailBlock(it) {
  if (!it.detail || !it.detail.length) return '';
  const offen = ui.openDetail.has(it.id);
  return `
    <button type="button" class="detail-toggle ${offen ? 'on' : ''}" data-act="toggle-detail"
            data-ex="${it.id}" aria-expanded="${offen}">
      ${offen ? 'Weniger' : `Mehr zur Ausführung · ${it.detail.length} Punkte`}
      <span class="chev">▼</span>
    </button>
    ${offen ? `<div class="detail">${it.detail.map(([titel, text]) => `
      <div class="detail-h">${esc(titel)}</div>
      <p>${esc(text)}</p>`).join('')}</div>` : ''}`;
}

/** Wiederholungsbereich um den Bodyweight-Aufschlag verschoben. */
function repsLabel(it, mode) {
  const plus = mode === 'bw' ? store.bwPlusOf(it.id) : 0;
  if (!plus) return it.reps;
  return String(it.reps).replace(/\d+/g, (d) => String(Number(d) + plus));
}

/* ------------------------------------------------------------------ *
 * Wochenvolumen: Soll gegen Ist
 *
 * Der ganze Plan ist darauf gebaut, dass jede Muskelgruppe ihre Sätze pro
 * Woche bekommt – und genau das war bisher nirgends nachzusehen. Verpasste
 * Einheiten, abgebrochene Trainings und jede angehakte Verletzung verschieben
 * diese Zahl, unsichtbar.
 *
 * Das Ziel ist nicht überall dasselbe: es kommt als TARGET aus den erzeugten
 * Daten, damit hier keine zweite Zahl steht, die von der Rechnung abweichen
 * kann. Im Ziel heißt: keinen ganzen Satz darunter – genau die Grenze, die
 * tools/build-plan.py für die einzelne Woche garantiert. Enger wäre es keine
 * Aussage über das Training, sondern über den Rundungsspielraum des Plans:
 * dessen eigene Wochen weichen um bis zu 0,95 Sätze ab.
 *
 * Gezählt wird, was wirklich abgehakt ist, in beiden Varianten mit den
 * jeweiligen Anteilen. Eine Woche sind WEEK_SESSIONS aufeinanderfolgende
 * Einheiten des Plans – dieselbe Einteilung, mit der tools/build-plan.py
 * rechnet.
 * ------------------------------------------------------------------ */

const targetOf = (mus) => (TARGET[mus] ?? 10) * satzFaktor();
/**
 * Im Ziel heißt: mindestens neun Zehntel dessen, was für **diese Woche**
 * geplant war.
 *
 * Vorher stand hier eine feste Toleranz von einem Satz gegen das
 * Wochen*ziel*. Das war zweimal falsch. Erstens ist ein Satz bei den Waden
 * (Ziel 6) ein Sechstel und bei der Brust (12) ein Zwölftel – dieselbe Zahl,
 * ein ganz anderer Anteil. Zweitens ist das Ziel ein Schnitt über den ganzen
 * Plan; die einzelne Woche liegt zwangsläufig darüber oder darunter, seit
 * jede Übung mit drei Sätzen dasteht. Wer alles abgehakt hatte, sah dann
 * trotzdem "8 von 12 Gruppen im Ziel" – ein Vorwurf für die Arithmetik des
 * Plans, nicht für den Nutzer. Verglichen wird deshalb mit dem Pensum der
 * Woche, und das kennt die App aus dem Plan.
 */
const inTarget = (got, soll) => got >= soll * 0.9;

/** Was der Plan für diese Woche vorsieht, je Muskelgruppe – Verletzungen und
 *  Modus eingerechnet, also dieselbe Rechnung wie beim Abhaken. */
function plannedWeek(block) {
  const acc = {};
  block.forEach((w) => {
    const mode = completedMode(w.n) || store.workoutMode(w.n);
    exOf(w, mode).forEach((item) => {
      Object.entries(EX_BY_ID.get(item.id)[mode].shares).forEach(([mus, share]) => {
        acc[mus] = (acc[mus] || 0) + item.sets * share;
      });
    });
  });
  return acc;
}

function weeklyDone() {
  const log = store.getState().log;
  const weeks = [];
  for (let k = 0; k < PLAN.length; k += WEEK_SESSIONS) {
    const block = PLAN.slice(k, k + WEEK_SESSIONS);
    const acc = {};
    let any = false;
    block.forEach((w) => {
      const entry = log[w.n];
      if (!entry) return;
      // Nur eine Variante zählen. Wer mit Hanteln anfängt und im
      // Bodyweight-Modus fertig wird, hat die Sätze einmal gemacht, nicht
      // zweimal – gezählt wird die abgeschlossene Variante, sonst die, in der
      // das Workout gerade steht.
      const m = completedMode(w.n) || store.workoutMode(w.n);
      exOf(w, m).forEach((item) => {
        const arr = (entry[m] || {})[item.id];
        if (!Array.isArray(arr)) return;
        const done = arr.slice(0, item.sets).filter((x) => x.done).length;
        if (!done) return;
        any = true;
        Object.entries(EX_BY_ID.get(item.id)[m].shares).forEach(([mus, share]) => {
          acc[mus] = (acc[mus] || 0) + done * share;
        });
      });
    });
    weeks.push({ nr: weeks.length + 1, from: block[0], to: block[block.length - 1],
                 acc, soll: plannedWeek(block), any });
  }
  return weeks;
}

/* ------------------------------------------------------------------ *
 * Der Zusatztag
 *
 * Die Nacharbeit hat einen Deckel, und der ist gewollt: Höchstens drei Sätze
 * kommen auf eine Einheit obendrauf. Wer aber eine *ganze* Einheit ausgelassen
 * hat, dem fehlen fünfzehn – die passen nirgendwo mehr hinein, ohne dass die
 * nächste Einheit zur Zumutung wird.
 *
 * Also nicht hineinstopfen, sondern danebenstellen. Eine zusätzliche Einheit
 * ist die sauberere Dosis: normale Satzzahl, normale Pausen, und die Übungen
 * sind genau die, die diese Woche zu kurz gekommen sind.
 *
 * Angeboten wird sie erst, wenn die Woche **durch** ist. Solange noch eine
 * Einheit offen steht, ist nichts versäumt – da erledigt die Nacharbeit den
 * Rest, und ein Vorschlag wäre bloß Drängeln.
 *
 * Sie geht als *eigenes* Workout in die Ablage, nicht in den Plan. Der Plan
 * rechnet sein Wochenvolumen aus festen Einheiten; eine dazwischengeschobene
 * würde diese Rechnung stillschweigend verschieben (siehe customs() in
 * js/store.js). Abgehakte Sätze zählen trotzdem mit – trainiert ist trainiert.
 * ------------------------------------------------------------------ */
const ZUSATZ_UEBUNGEN = 5;      // so lang wie eine gewöhnliche Einheit
const ZUSATZ_AB = 6;            // unter sechs Sätzen Rückstand lohnt es nicht

/**
 * Muskelgruppen, die gerade Ruhe brauchen.
 *
 * Dieselbe Regel wie im Generator: Wer in den letzten `REST.days` Tagen direkt
 * dran war – oder es in der nächsten Einheit ist –, kommt nicht in den
 * Zusatztag. Sonst stünde die Erholungsregel, die den ganzen Plan trägt,
 * ausgerechnet für die Einheit nicht, die freiwillig dazukommt.
 *
 * Ausgefallene Einheiten sperren nichts: Was nicht stattgefunden hat, muss auch
 * nicht erholt werden.
 */
function ruhendeGruppen() {
  const heute = todayISO();
  const sperre = new Set();
  PLAN.forEach((w) => {
    const d = effDate(w);
    if (Math.abs(daysBetween(d, heute)) >= REST.days) return;
    const fertig = completedMode(w.n);
    if (!fertig && d < heute) return;
    const m = fertig || store.workoutMode(w.n);
    exBasis(w, m).forEach((it) => {
      const ex = EX_BY_ID.get(it.id);
      if (!ex) return;
      Object.entries(ex[m].shares).forEach(([mus, share]) => {
        if (share >= REST.direct) sperre.add(mus);
      });
    });
  });
  return sperre;
}

/**
 * Die Übungen für einen Zusatztag – oder null, wenn keiner nötig ist.
 *
 * Gierig zusammengestellt: immer die Übung, die vom Rückstand am meisten
 * wegnimmt. Eine Übung zählt dabei mit ihren Anteilen, ein Satz Kreuzheben
 * schließt etwas bei der Hüftstreckung *und* beim Gesäß.
 */
function zusatztagEx(woche, mode) {
  const rest = {};
  let summe = 0;
  Object.keys(MUSCLE_LABEL).forEach((m) => {
    const luecke = (woche.soll[m] || 0) - (woche.acc[m] || 0);
    if (luecke > 0.5) { rest[m] = luecke; summe += luecke; }
  });
  if (summe < ZUSATZ_AB) return null;

  const ruht = ruhendeGruppen();
  const gesperrt = blocked(store.getState().injuries || []);
  const satz = satzZahl(3);
  const kandidaten = EXERCISES.filter((ex) => {
    if (gesperrt.has(ex.id)) return false;
    const shares = ex[mode].shares;
    // Keine Übung, die eine ruhende Gruppe direkt trifft.
    return !Object.entries(shares).some(([m, s]) => s >= REST.direct && ruht.has(m));
  });

  const gewaehlt = [];
  const uebrig = { ...rest };
  for (let k = 0; k < ZUSATZ_UEBUNGEN; k++) {
    let beste = null;
    let bestWert = 0;
    kandidaten.forEach((ex) => {
      if (gewaehlt.some((g) => g.id === ex.id)) return;
      const wert = Object.entries(ex[mode].shares)
        .reduce((a, [m, s]) => a + Math.min(s * satz, uebrig[m] || 0), 0);
      if (wert > bestWert) { bestWert = wert; beste = ex; }
    });
    if (!beste || bestWert < 0.5) break;
    gewaehlt.push({ id: beste.id, sets: satz });
    Object.entries(beste[mode].shares).forEach(([m, s]) => {
      uebrig[m] = Math.max(0, (uebrig[m] || 0) - s * satz);
    });
  }
  if (gewaehlt.length < 2) return null;
  return { ex: gewaehlt, fehlt: Math.round(summe), gruppen: Object.keys(rest).length };
}

/**
 * Zusatztag anlegen, wenn eine Woche mit Rückstand zu Ende gegangen ist.
 *
 * Ungefragt – wie der Stufenaufstieg. Ein Knopf, den man erst suchen und dann
 * drücken muss, ist keine Anpassung, sondern eine Hausaufgabe. Wer ihn nicht
 * will, tippt ihn weg; das ist ein Griff statt zwei.
 *
 * Nur für die **zuletzt abgeschlossene** Woche. Eine Woche gilt als
 * abgeschlossen, wenn jede ihrer Einheiten abgehakt oder beendet ist – solange
 * eine offen steht, ist nichts versäumt, und der Plan rückt ohnehin nach.
 *
 * Und dabei fliegen ältere Zusatztage raus, die nie angefasst wurden. Das ist
 * dieselbe Überlegung wie beim Deckel der Nacharbeit: Volumen wirkt dann, wenn
 * es anfällt. Ein unberührter Zusatztag von vor drei Wochen holt nichts mehr
 * nach, er steht nur im Weg.
 */
function pruefeZusatztag() {
  const wochen = weeklyDone();
  let ziel = null;
  wochen.forEach((w) => {
    if (!w.any) return;
    const block = PLAN.slice(PLAN.indexOf(w.from), PLAN.indexOf(w.to) + 1);
    if (block.some((x) => !completedMode(x.n))) return;
    ziel = w;
  });
  const name = ziel ? `Zusatztag Woche ${ziel.nr}` : null;

  // **Erst aufräumen.** Ein unberührter Zusatztag gehört zu der Runde, aus der
  // er gerechnet wurde. Wandert die in die Ablage – Fokuswechsel, Neustart,
  // geänderter Plan –, blieb er bisher stehen. Und weil naechsteEinheit() ihn
  // dem Plan vorzieht, war er danach die *nächste Einheit*:
  //
  //   „Okay ist heute Zusatztag oder normaler übungstag?" – Das Dashboard bot
  //   „Zusatztag Woche 1" an (2 Übungen, 4 Sätze, Bauch), der Kalender zeigte
  //   für denselben Tag Workout 1 des Cut-Plans (5 Übungen, 10 Sätze). Beide
  //   hatten recht, und genau deshalb war es falsch: Der Zusatztag war aus der
  //   Aufbau-Runde übrig, die beim Fokuswechsel weggelegt worden war.
  //
  // Weg muss deshalb jeder unberührte, der nicht zu einer Woche gehört, die
  // *jetzt* gerade zu wenig bekommen hat. Angefangene bleiben: Was abgehakt
  // ist, wird nicht weggeräumt.
  let weg = 0;
  store.customs()
    .filter((c) => /^Zusatztag Woche /.test(c.name) && c.name !== name
      && !store.isStarted(c.id))
    .forEach((c) => { store.removeCustom(c.id); weg += 1; });

  if (!ziel) return weg > 0;
  if (store.customs().some((c) => c.name === name)) return weg > 0;
  // Die Merkliste `zusatzNein` ist mit dem Knopf „Brauch ich nicht" weggefallen.
  // Sie wird nicht mehr gelesen: Wer den Tag nicht will, macht die nächste
  // Planeinheit, und beim nächsten Wochenwechsel ersetzt ein neuer Zusatztag
  // den unberührten alten.
  const vorschlag = zusatztagEx(ziel, store.getState().mode);
  if (!vorschlag) return weg > 0;

  store.saveCustom({ name, ex: vorschlag.ex });
  return true;
}

/**
 * Welche Einheit die App zeigt, wenn sie aufgeht.
 *
 * Normalerweise die nächste offene aus dem Plan. Liegt aber ein unberührter
 * Zusatztag da, ist **er** die nächste Einheit – dafür wurde er angelegt. Das
 * ist der Unterschied zwischen „angelegt" und „passiert": Eine eigene Einheit,
 * die man erst suchen muss, holt kein einziges Satzvolumen nach.
 *
 * Sobald er angefangen ist, tritt er zurück und der Plan läuft weiter. Wer ihn
 * gar nicht will, blättert mit „Zurück zum Plan" daran vorbei; beim nächsten
 * Wochenwechsel wird ein unberührter Zusatztag ohnehin ersetzt.
 */
function naechsteEinheit() {
  const offen = store.customs()
    .find((c) => /^Zusatztag Woche /.test(c.name) && !store.isStarted(c.id));
  return offen ? offen.id : defaultWorkoutNo();
}

/*
 * Hier stand der Kasten „Zusatztag angelegt" mit drei Knöpfen – Ansehen,
 * Später, Brauch ich nicht. Raus, auf Ansage: „Die Zusatztag Meldung brauchen
 * wir nicht. Es soll einfach passieren."
 *
 * Und das tut es jetzt auch wörtlich: Der Zusatztag wird angelegt und ist die
 * nächste Einheit (siehe naechsteEinheit()). Eine Meldung, die erklärt, was
 * ohnehin gleich dasteht, ist eine Zwischenstation ohne Aufgabe – und drei
 * Knöpfe, von denen zwei nur „weg damit" heißen, sind zwei zu viel.
 *
 * Weggetippt werden muss er deshalb auch nicht mehr: Wer ihn nicht will, macht
 * die nächste Planeinheit; beim nächsten Wochenwechsel wird ein unberührter
 * Zusatztag ohnehin durch den neuen ersetzt.
 */

/** Balken für eine Muskelgruppe: erreicht gegen das Pensum dieser Woche.
 *
 * Die Zahl daneben nennt beides. Seit die Ziele auseinandergehen, sagt "4,0"
 * für sich genommen nichts mehr – erst "4,0/6" zeigt, dass die Woche steht.
 */
function volumeBar(mus, got, soll) {
  const pct = Math.min(150, (got / soll) * 100);
  const state = inTarget(got, soll) ? 'full' : (got >= soll * 0.6 ? 'part' : 'thin');
  return `
    <div class="vol-row">
      <div class="vol-name">${esc(MUSCLE_LABEL[mus] || mus)}</div>
      <div class="vol-track"><i class="vol-fill ${state}" style="width:${Math.min(100, pct).toFixed(0)}%"></i></div>
      <div class="vol-num">${got.toFixed(1).replace('.', ',')}<span>/${fmtNum(soll)}</span></div>
    </div>`;
}

/** Die Ziele in einem Satz, nach Höhe gruppiert statt zwölfmal aufgezählt. */
function zielText() {
  const byTarget = new Map();
  Object.keys(MUSCLE_LABEL).forEach((m) => {
    const t = targetOf(m);
    byTarget.set(t, (byTarget.get(t) || []).concat(MUSCLE_LABEL[m]));
  });
  return [...byTarget.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([t, ms]) => `${fmtNum(t)}× ${ms.join(', ')}`)
    .join(' · ');
}

function renderWeeklyVolume() {
  const host = document.getElementById('volWeek');
  if (!host) return;
  const weeks = weeklyDone();
  const done = weeks.filter((w) => w.any);
  if (!done.length) {
    host.innerHTML = '<div class="card muted small">Sobald die erste Einheit steht, '
      + 'zeigt sich hier, wie nah du am Wochenziel je Muskelgruppe bist.</div>';
    return;
  }
  // Die zuletzt begonnene Woche ist die interessante – nicht die letzte des Plans.
  const cur = done[done.length - 1];
  const prev = done.length > 1 ? done[done.length - 2] : null;
  const groups = Object.keys(MUSCLE_LABEL);
  // Nicht in Prozent: eine Woche mit 9,5 und 10,5 wären 99 %, obwohl alles
  // stimmt – der Plan selbst schwankt um bis zu einen Satz. Gezählt wird
  // deshalb, wie viele Gruppen ihr Ziel erreicht haben.
  const voll = groups.filter((m) => inTarget(cur.acc[m] || 0, cur.soll[m] || 0)).length;
  const inWoche = PLAN.slice(PLAN.indexOf(cur.from), PLAN.indexOf(cur.to) + 1);
  const offen = inWoche.filter((w) => !completedMode(w.n)).length;
  // Angelegt wird der Zusatztag von selbst (pruefeZusatztag()). Hier steht nur
  // noch der Weg dorthin, damit er auffindbar bleibt, wenn der Hinweis auf der
  // Startseite längst weggetippt ist.
  const schonDa = store.customs().find((c) => c.name === `Zusatztag Woche ${cur.nr}`);

  // Solange die Woche läuft, kann keine Gruppe ihr Ziel erreichen – "0 von 12"
  // stünde dann als Vorwurf da, obwohl nichts versäumt ist. Bis zum Ende der
  // Woche zählt deshalb der Fortschritt in Einheiten, danach das, worum es
  // geht. Die Balken darunter bleiben in beiden Fällen dieselben.
  const kopf = offen
    ? { lbl: `Woche ${cur.nr} · ${inWoche.length - offen} von ${inWoche.length} Einheiten`,
        zahl: inWoche.length - offen, von: inWoche.length }
    : { lbl: `Woche ${cur.nr} · ${plural(voll, 'Gruppe', 'Gruppen')} im Ziel`,
        zahl: voll, von: groups.length };

  host.innerHTML = `
    <div class="card">
      <div class="vol-head">
        <div>
          <div class="lbl">${esc(kopf.lbl)}</div>
          <div class="hint">${esc(fmtDate(effDate(cur.from)))} – ${esc(fmtDate(effDate(cur.to)))}${
            offen ? ` · ${plural(offen, 'Einheit', 'Einheiten')} offen` : ' · abgeschlossen'}</div>
        </div>
        <div class="vol-quote">${kopf.zahl}<span>/${kopf.von}</span></div>
      </div>
      ${groups.map((m) => volumeBar(m, cur.acc[m] || 0, cur.soll[m] || 0)).join('')}
      ${schonDa ? `<div class="small muted" style="margin-top:12px">↩︎ Für diese Woche steht
        schon ein Zusatztag bereit: <b>${esc(schonDa.name)}</b>, ${schonDa.ex.length} Übungen.
        <button type="button" class="btn btn-sm" data-act="custom-start"
                data-id="${esc(schonDa.id)}" style="margin-left:6px">Öffnen</button></div>` : ''}
      <div class="small muted" style="margin-top:10px">
        Verglichen wird mit dem, was <b>diese Woche</b> auf dem Plan steht – nicht mit dem
        Wochenziel. Das Ziel ist ein Schnitt über den ganzen Plan (${esc(zielText())},
        Anteile eingerechnet); die einzelne Woche liegt darüber oder darunter, weil jede
        Übung mit drei Sätzen dasteht und sich Sätze nur als Ganzes verschieben lassen.
        ${offen ? 'Bei noch offenen Einheiten ist die Woche naturgemäß unvollständig.' : ''}
        ${prev ? `Woche davor: ${groups.filter((m) => inTarget(prev.acc[m] || 0, prev.soll[m] || 0)).length}
          von ${groups.length} Gruppen im Ziel.` : ''}
      </div>
    </div>`;
}

/* ------------------------------------------------------------------ *
 * Verletzungen
 *
 * Angehakt gilt dauerhaft: der Plan rechnet ab sofort ohne die betroffenen
 * Übungen weiter, bis der Haken wieder weg ist. Was das kostet, steht daneben
 * – ausgerechnet über den ganzen Plan, nicht geschätzt.
 * ------------------------------------------------------------------ */

/** Wochen im Plan, aus den Terminen abgeleitet. */
const PLAN_WEEKS = (() => {
  const span = daysBetween(PLAN[0].date, PLAN[PLAN.length - 1].date);
  // Die letzte Einheit endet nicht am Wochenende: eine Lücke dazurechnen,
  // sonst kommt bei 80 Einheiten in 139 Tagen 19,9 statt 20 heraus.
  return Math.max(1, Math.round((span * PLAN.length) / Math.max(1, PLAN.length - 1) / 7));
})();

/**
 * Ersatz, der wegen einer zweiten Beschwerde nicht greift.
 *
 * Das ist die Wechselwirkung, die sich rechnen lässt: Beschwerde A würde eine
 * Übung durch eine andere ersetzen, Beschwerde B sperrt aber genau die.
 */
function swapConflicts(act) {
  const block = blocked(act);
  const out = [];
  act.forEach((id) => {
    const inj = injuryById(id);
    if (!inj) return;
    Object.entries(inj.swap).forEach(([from, to]) => {
      if (!block.has(from) || !block.has(to)) return;
      const by = act.filter((o) => o !== id && (injuryById(o) || { avoid: [] }).avoid.includes(to));
      if (by.length) out.push({ inj, from, to, by: by.map((o) => injuryById(o).name) });
    });
  });
  return out;
}

/**
 * Kurzfassung fürs Training: was heute am fehlenden Gerät scheitert.
 *
 * Steht neben dem Verletzungshinweis und sieht bewusst genauso aus – es ist
 * derselbe Fall: Der Plan zeigt heute etwas anderes als das, was geschrieben
 * steht, und wer das erst beim Vergleichen mit der Statistik merkt, ist zu Recht
 * verärgert.
 */
function vorratNote(w, mode) {
  if (vorratVollstaendig()) return '';
  const { getauscht, weg } = vorratNotiz(w, mode);
  if (!getauscht.length && !weg.length) return '';
  const nm = (id) => resolve({ id, sets: 0 }, mode).name;
  const zeilen = getauscht.map((s) => `${esc(nm(s.from))} → ${esc(nm(s.to))}`)
    .concat(weg.map((d) => `${esc(nm(d.id))} fällt aus`));
  const namen = GERAETE.filter((g) => fehlt().includes(g.id)).map((g) => g.label);
  return `
    <div class="card injury-note">
      <div class="inj-note-head">🎒 Nicht da: ${esc(namen.join(', '))}</div>
      <div class="small muted">Heute deshalb: ${zeilen.join(' · ')}</div>
      <button type="button" class="btn btn-ghost btn-sm" data-act="go-tab" data-tab="settings">Vorrat ändern</button>
    </div>`;
}

/** Kurzfassung fürs Training: was heute anders ist. */
function injuryNote(w, mode) {
  const act = activeInjuries();
  if (!act.length) return '';
  const { dropped, swapped } = injuryNotes(w.n);
  const names = act.map((id) => (injuryById(id) || {}).name).filter(Boolean);
  const nm = (id) => resolve({ id, sets: 0 }, mode).name;
  const lines = [];
  swapped.forEach((s) => lines.push(`${esc(nm(s.from))} → ${esc(nm(s.to))}`));
  dropped.forEach((d) => lines.push(`${esc(nm(d.id))} fällt aus${
    d.reason === 'rest' ? ' (Ersatz erst nach 48 h)' : ''}`));
  const pflege = careFor(act);
  return `
    <div class="card injury-note">
      <div class="inj-note-head">🩹 Rücksicht auf: ${esc(names.join(', '))}</div>
      ${lines.length
        ? `<div class="small muted">Heute deshalb: ${lines.join(' · ')}</div>`
        : '<div class="small muted">Heute ändert das nichts – keine der Übungen ist betroffen.</div>'}
      ${pflege.length ? `<div class="small muted" style="margin-top:6px">
        Dazu ${plural(pflege.length, 'Übung', 'Übungen')} zum Dehnen und Kräftigen:
        ${esc(pflege.slice(0, 3).map((c) => c.name).join(' · '))}${pflege.length > 3 ? ' …' : ''}
      </div>` : ''}
      <button type="button" class="btn btn-ghost btn-sm" data-act="go-injuries">Verletzungen ansehen</button>
    </div>`;
}

/** Eine Zusatzübung als Karte. Dauer statt Sätzen – das ist kein Trainingsvolumen. */
/* ------------------------------------------------------------------ *
 * Reha-Übungen im Training
 *
 * Was bei einer angehakten Beschwerde gut tut – dehnen, mobilisieren, gezielt
 * kräftigen –, stand bisher nur im Verletzungs-Tab. Dort liest man es einmal
 * und macht es nie: Gemacht wird, was im Training steht.
 *
 * Sie hängen deshalb am Trainingstag an, hinter der letzten Übung. Nicht darin:
 * Sie zählen nicht als Sätze, gehen nicht ins Wochenvolumen ein und halten
 * "Abschließen" nicht auf – ein Satz Außenrotation mit dem Gummiband ist kein
 * Satz Rudern. Sie stehen mit Dosis und Hinweis da und haben einen Haken.
 * ------------------------------------------------------------------ */

/** Reha-Übungen, die heute dazugehören – leer, wenn nichts angehakt ist. */
function careToday() {
  return careFor(activeInjuries());
}

function careBlock(n) {
  const liste = careToday();
  if (!liste.length) return '';
  const fertig = liste.filter((c) => store.careDone(n, c.key)).length;
  return `
    <section class="card care-block">
      <div class="section-title" style="margin:0 0 4px">Zum Schluss · Beschwerden</div>
      <div class="small muted">${plural(liste.length, 'Übung', 'Übungen')} zum Dehnen,
        Mobilisieren und gezielten Kräftigen – wegen dem, was du unter <em>Verletzt</em>
        angehakt hast. Sie zählen nicht als Sätze und halten das Abschließen nicht auf.
        ${fertig ? `<b>${fertig} von ${liste.length} erledigt.</b>` : ''}</div>
      ${liste.map((c) => {
        const an = store.careDone(n, c.key);
        return `
        <button type="button" class="care-row ${an ? 'on' : ''}" aria-pressed="${an}"
                data-act="toggle-care" data-key="${esc(c.key)}">
          <span class="care-tick">${an ? '✓' : ''}</span>
          <span class="care-body">
            <span class="care-head">
              <span class="care-name">${esc(c.name)}</span>
              <span class="care-kind care-${esc(c.kind)}">${esc(CARE_LABEL[c.kind] || c.kind)}</span>
            </span>
            <span class="care-dose">${esc(c.dose)}${c.clearance ? ' · erst nach ärztlicher Freigabe' : ''}</span>
            <span class="care-cue">${esc(c.cue)}</span>
          </span>
        </button>`;
      }).join('')}
    </section>`;
}

function careCard(c) {
  return `
    <div class="care">
      <div class="care-head">
        <span class="care-name">${esc(c.name)}</span>
        <span class="care-kind care-${esc(c.kind)}">${esc(CARE_LABEL[c.kind] || c.kind)}</span>
      </div>
      <div class="care-dose">${esc(c.dose)}</div>
      <div class="care-cue">${esc(c.cue)}</div>
      ${c.wegen && c.wegen.length > 1
        ? `<div class="care-why">wegen ${esc(c.wegen.join(' und '))}</div>` : ''}
    </div>`;
}

/* ------------------------------------------------------------------ *
 * Kalender
 *
 * Der Plan steht als Liste von Einheiten da, aber gelebt wird er in Tagen:
 * Wann war ich dran, wann war ich es nicht, was kommt. Gezeigt wird deshalb
 * ein gewöhnliches Monatsraster – und zwar mit den *tatsächlichen* Terminen
 * aus effDate(), nicht mit den Plandaten, sonst stimmt nach dem ersten
 * verpassten Tag nichts mehr.
 * ------------------------------------------------------------------ */


/** Zustand eines Kalendertags. Reihenfolge zählt: erledigt schlägt alles. */
function dayState(w, iso, today) {
  if (!w) return null;
  const done = completedMode(w.n);
  if (done) return { kind: 'done', mode: done };
  const angefangen = store.isStarted(w.n);
  if (iso < today) return { kind: angefangen ? 'part' : 'miss', mode: store.workoutMode(w.n) };
  return { kind: angefangen ? 'part' : 'plan', mode: store.workoutMode(w.n) };
}

const KIND_TEXT = { done: 'trainiert', part: 'angefangen', miss: 'ausgefallen', plan: 'geplant' };

/**
 * Tage, an denen unter einem anderen Plan trainiert wurde.
 *
 * Der Kalender zeichnet den Plan: PLAN.forEach, effDate, fertig. Nach einem
 * Fokuswechsel steht darin nur noch der neue Plan – *„anscheinend hat er damit
 * vergessen dass ich gestern und vorgestern trainiert hab."* Vergessen war
 * nichts, die Tage stehen im abgelegten Protokoll; sie wurden nur nicht mehr
 * gezeigt. Ein Trainingstag gehört aber dem Tag, nicht dem Plan.
 *
 * Welche Übungen es waren, weiß der Kalender nicht mehr – der Plan dazu ist
 * nicht geladen. Gezeigt werden deshalb Tag, Modus und die Zahl der Sätze.
 */
function fruehereTage() {
  const map = new Map();
  (store.getState().rounds || []).forEach((r) => {
    Object.values(r.log || {}).forEach((e) => {
      if (!e || !e.startedOn) return;
      const proModus = { db: 0, bw: 0 };
      ['db', 'bw'].forEach((m) => {
        Object.values(e[m] || {}).forEach((arr) => {
          if (Array.isArray(arr)) arr.forEach((s) => { if (s && s.done) proModus[m] += 1; });
        });
      });
      const saetze = proModus.db + proModus.bw;
      if (!saetze) return;
      const da = map.get(e.startedOn)
        || { saetze: 0, einheiten: 0, mode: e.done || (proModus.bw > proModus.db ? 'bw' : 'db') };
      da.saetze += saetze;
      da.einheiten += 1;
      map.set(e.startedOn, da);
    });
  });
  return map;
}

function calendarCell(iso, month, today, byDate, sel, frueher) {
  const ws = byDate.get(iso) || [];
  const st = dayState(ws[0], iso, today);
  // Der laufende Plan hat Vorrang: Steht heute eine Einheit an, ist das die
  // Auskunft, und nicht das, was vor einem Fokuswechsel an diesem Tag war.
  const alt = st ? null : (frueher && frueher.get(iso)) || null;
  const cls = ['cal-cell'];
  if (iso.slice(0, 7) !== month.slice(0, 7)) cls.push('out');
  if (iso === today) cls.push('today');
  if (iso === sel) cls.push('sel');
  if (st) cls.push(st.kind, st.mode);
  else if (alt) cls.push('done', 'frueher', alt.mode);
  const tag = Number(iso.slice(8));
  // Ohne Einheit ist der Tag kein Knopf: nichts anzuzeigen, nichts zu tippen.
  if (!st && !alt) return `<div class="${cls.join(' ')}"><span class="cal-num">${tag}</span></div>`;
  const anzahl = st ? ws.length : alt.einheiten;
  const modus = st ? st.mode : alt.mode;
  const mehr = anzahl > 1 ? ` (+${anzahl - 1})` : '';
  return `
    <button type="button" class="${cls.join(' ')}" data-act="cal-day" data-iso="${iso}"
            aria-pressed="${iso === sel}"
            aria-label="${esc(fmtDate(iso, true))}: ${plural(anzahl, 'Einheit', 'Einheiten')} ${
              esc(st ? KIND_TEXT[st.kind] : 'trainiert, früherer Plan')}, ${esc(MODE_LABEL[modus])}">
      <span class="cal-num">${tag}</span>
      <span class="cal-mark">${st && st.kind === 'miss' ? '·' : MODE_ICON[modus]}${mehr}</span>
    </button>`;
}

/** Die angetippte Einheit im Detail: Übungen, Sätze, Modus. */
function calendarDetail(iso, byDate, today, frueher) {
  const ws = byDate.get(iso) || [];
  const alt = ws.length ? null : (frueher && frueher.get(iso)) || null;
  if (alt) {
    return `
      <div class="card cal-detail">
        <div class="cal-det-head">
          <div>
            <div class="lbl">${plural(alt.einheiten, 'Einheit', 'Einheiten')} · trainiert</div>
            <div class="hint">${esc(fmtDate(iso, true))} · ${plural(alt.saetze, 'Satz', 'Sätze')}</div>
          </div>
          <span class="chip ${alt.mode}">${MODE_ICON[alt.mode]} ${esc(MODE_LABEL[alt.mode])}</span>
        </div>
        <div class="small muted">Aus einem früheren Trainingsplan. Die Übungen dazu stehen in
          dem Plan, der damals galt – die Sätze und Kilo zählen in der Statistik weiter mit.</div>
      </div>`;
  }
  if (!ws.length) {
    return `<div class="card muted small">Kein Training an diesem Tag. Tippe einen
      markierten Tag an, um die Einheit zu sehen.</div>`;
  }
  // Zwei Einheiten an einem Tag gibt es wirklich – etwa wenn zwei an
  // demselben Tag nachgetragen werden. Dann stehen beide da.
  return ws.map((w) => calendarWorkout(w, iso, today)).join('');
}

function calendarWorkout(w, iso, today) {
  const st = dayState(w, iso, today);
  const mode = st.mode;
  const items = exOf(w, mode).map((it) => resolve(it, mode));
  const saetze = items.reduce((a, x) => a + x.sets, 0);
  const kopf = KIND_TEXT[st.kind];
  const prog = progressOf(w.n, mode);

  return `
    <div class="card cal-detail">
      <div class="cal-det-head">
        <div>
          <div class="lbl">Workout ${w.n} · ${esc(kopf)}</div>
          <div class="hint">${esc(fmtDate(iso, true))} · ${plural(items.length, 'Übung', 'Übungen')} ·
            ${plural(saetze, 'Satz', 'Sätze')}</div>
        </div>
        <span class="chip ${mode}">${MODE_ICON[mode]} ${esc(MODE_LABEL[mode])}</span>
      </div>
      ${st.kind === 'part' ? `<div class="hint">${prog.done} von ${prog.total} Sätzen stehen.</div>` : ''}
      <ul class="cal-list">
        ${items.map((it) => `
          <li>
            <span class="cal-ex">${esc(it.name)}</span>
            <span class="cal-sets">${it.sets} × ${esc(repsLabel(it, mode))}</span>
          </li>`).join('')}
      </ul>
      <button type="button" class="btn btn-sm" data-act="cal-open" data-n="${w.n}">
        ${st.kind === 'done' ? 'Im Dashboard ansehen' : 'Zu dieser Einheit'}
      </button>
    </div>`;
}

/** Gezeigter Monat: gewählter, sonst der der nächsten offenen Einheit. */
function calMonthNow() {
  if (ui.calMonth) return ui.calMonth;
  const naechste = PLAN.find((w) => !completedMode(w.n));
  return monthStart(naechste ? effDate(naechste) : todayISO());
}

function renderCalendar() {
  const today = todayISO();
  const byDate = new Map();
  PLAN.forEach((w) => {
    const d = effDate(w);
    byDate.set(d, (byDate.get(d) || []).concat(w));
  });
  const month = calMonthNow();
  const sel = ui.calDay;
  const tage = monthGrid(month);
  const frueher = fruehereTage();

  // Gezählt werden Einheiten, nicht Tage – an einem Tag können zwei stehen.
  const imMonat = tage.filter((d) => d.slice(0, 7) === month.slice(0, 7))
    .flatMap((d) => (byDate.get(d) || []).map((w) => dayState(w, d, today)));
  const zaehl = { done: 0, part: 0, miss: 0, plan: 0 };
  const proModus = { db: 0, bw: 0 };
  imMonat.forEach((st) => {
    zaehl[st.kind] += 1;
    if (st.kind === 'done') proModus[st.mode] += 1;
  });
  // Aus früheren Plänen, an Tagen ohne Einheit im laufenden – getrennt gezählt:
  // Die Zahlen darüber messen diesen Plan, und dazu gehören sie nicht.
  const altImMonat = tage.filter((d) => d.slice(0, 7) === month.slice(0, 7)
    && !(byDate.get(d) || []).length && frueher.has(d))
    .reduce((a, d) => a + frueher.get(d).einheiten, 0);

  view.innerHTML = `
    <button type="button" class="back-link" data-act="go-tab" data-tab="settings">← Mehr</button>
    <div class="section-title">Kalender</div>

    <div class="card">
      <div class="cal-top">
        <button type="button" class="cal-nav" data-act="cal-month" data-d="-1" aria-label="Voriger Monat">‹</button>
        <div class="cal-title">${esc(fmtMonth(month))}</div>
        <button type="button" class="cal-nav" data-act="cal-month" data-d="1" aria-label="Nächster Monat">›</button>
      </div>
      <div class="cal-grid cal-head">${WEEK_HEAD.map((d) => `<div>${d}</div>`).join('')}</div>
      <div class="cal-grid">${tage.map((d) => calendarCell(d, month, today, byDate, sel, frueher)).join('')}</div>
      <div class="cal-legend">
        <span><i class="dot done"></i> trainiert</span>
        <span><i class="dot part"></i> angefangen</span>
        <span><i class="dot plan"></i> geplant</span>
        <span><i class="dot miss"></i> ausgefallen</span>
      </div>
      <div class="small muted">
        ${plural(imMonat.length, 'Einheit', 'Einheiten')} in diesem Monat ·
        ${zaehl.done} trainiert${zaehl.done ? ` (${MODE_ICON.db} ${proModus.db} · ${MODE_ICON.bw} ${proModus.bw})` : ''}${
          zaehl.miss ? ` · ${zaehl.miss} ausgefallen` : ''}${
          zaehl.plan ? ` · ${zaehl.plan} offen` : ''}${
          altImMonat ? ` · ${altImMonat} aus einem früheren Plan` : ''}
      </div>
      ${month.slice(0, 7) === today.slice(0, 7) ? '' : `
        <button type="button" class="btn btn-sm" data-act="cal-today">Zu heute</button>`}
    </div>

    ${calendarDetail(sel, byDate, today, frueher)}

    <div class="small muted">
      Die Termine sind die tatsächlichen: verpasste Tage rücken den Restplan
      nach hinten, abgeschlossene Einheiten bleiben auf dem Tag, an dem du
      trainiert hast.
    </div>`;
}

function renderInjuries() {
  const act = activeInjuries();
  const mode = store.getState().mode;
  const activeSet = new Set(act);
  const nm = (id) => resolve({ id, sets: 0 }, mode).name;

  const marks = act.map((id) => injuryById(id)).filter(Boolean)
    .map((i) => ({ spot: i.spot, kind: i.kind }));

  // Auswirkungen über den ganzen Plan, nicht nur über heute
  const block = blocked(act);
  const gone = [];
  const swapCount = new Map();
  let wegenPause = 0;
  PLAN.forEach((w) => {
    const r = injuryNotes(w.n);
    r.dropped.forEach((d) => {
      gone.push(d);
      if (d.reason === 'rest') wegenPause += d.sets;
    });
    r.swapped.forEach((s) => {
      const key = `${s.from}→${s.to}`;
      swapCount.set(key, (swapCount.get(key) || 0) + s.sets);
    });
  });
  const goneSets = new Map();
  gone.forEach((d) => goneSets.set(d.id, (goneSets.get(d.id) || 0) + d.sets));

  const impact = act.length
    ? weeklyImpact(PLAN, PLAN.map((w) => exOf(w, mode)), EX_BY_ID, mode, PLAN_WEEKS) : {};
  const hits = Object.entries(impact)
    .map(([m, v]) => ({ m, ...v, diff: v.after - v.before }))
    .filter((x) => Math.abs(x.diff) > 0.05)
    .sort((a, b) => a.diff - b.diff);

  const conflicts = swapConflicts(act);
  const combos = combosFor(act);
  const pflege = careFor(act);

  const summary = act.length ? `
    <section class="card inj-summary">
      <div class="inj-fig no-hint" id="injFigure" aria-label="Körper mit den betroffenen Stellen"></div>
      <div class="inj-sum-body">
        <div class="section-title" style="margin:0 0 6px">${plural(act.length, 'Beschwerde', 'Beschwerden')} aktiv</div>
        <div class="chips">${act.map((id) => {
          const i = injuryById(id);
          return i ? `<span class="chip on">${esc(i.name)}</span>` : '';
        }).join('')}</div>
        ${[...swapCount.entries()].length ? `<div class="small" style="margin-top:10px">
          <b>Getauscht:</b> ${[...swapCount.entries()].map(([k, sets]) => {
            const [from, to] = k.split('→');
            return `${esc(nm(from))} → ${esc(nm(to))} <span class="muted">(${sets} Sätze)</span>`;
          }).join(' · ')}</div>` : ''}
        ${goneSets.size ? `<div class="small" style="margin-top:6px">
          <b>Fällt ersatzlos weg:</b> ${[...goneSets.entries()]
            .map(([id, sets]) => `${esc(nm(id))} <span class="muted">(${sets} Sätze)</span>`).join(' · ')}</div>` : ''}
        ${wegenPause ? `<div class="small muted" style="margin-top:6px">
          Davon ${wegenPause} Sätze ohne Ersatz, weil der Ersatz dieselbe Muskelgruppe
          getroffen hätte wie der Tag davor oder danach – ${REST.days === 2 ? '48 Stunden' : `${REST.days} Tage`}
          Erholung gehen vor.</div>` : ''}
        ${!swapCount.size && !goneSets.size ? '<div class="small muted" style="margin-top:10px">Am Plan ändert sich nichts – keine der angehakten Beschwerden trifft eine Übung, die vorkommt.</div>' : ''}
        <button type="button" class="btn btn-ghost btn-sm" data-act="clear-injuries" style="margin-top:12px">Alle Haken entfernen</button>
      </div>
    </section>

    ${hits.length ? `<section class="card">
      <div class="section-title" style="margin:0 0 8px">Was das pro Woche kostet</div>
      <table class="inj-table">
        <thead><tr><th>Muskelgruppe</th><th>vorher</th><th>jetzt</th></tr></thead>
        <tbody>${hits.map((x) => `<tr>
          <td>${esc(MUSCLE_LABEL[x.m] || x.m)}</td>
          <td class="muted">${x.before.toFixed(1)}</td>
          <td class="${x.after < x.before - 0.05 ? 'inj-loss' : 'inj-gain'}">${x.after.toFixed(1)}
            <span class="small">(${x.diff > 0 ? '+' : '−'}${Math.abs(x.diff).toFixed(1)})</span></td>
        </tr>`).join('')}</tbody>
      </table>
      <div class="small muted" style="margin-top:8px">Sätze je Woche, Anteile eingerechnet. Ziel sind 10.</div>
    </section>` : ''}

    ${pflege.length ? `<section class="card">
      <div class="section-title" style="margin:0 0 4px">Was jetzt gut tut</div>
      <div class="small muted" style="margin-bottom:10px">
        ${plural(pflege.length, 'Übung', 'Übungen')} zum Dehnen, Mobilisieren und gezielten
        Kräftigen. Sie zählen nicht ins Wochenvolumen – das hier ist Reha, kein Aufbau.
        ${pflege.some((c) => c.clearance)
          ? '<b>Erst nach ärztlicher Freigabe:</b> bei Bruch, Riss oder Bandscheibenvorfall entscheidet nicht der Plan, wann wieder bewegt wird.'
          : ''}
      </div>
      ${pflege.map((c) => careCard(c)).join('')}
    </section>` : ''}

    ${conflicts.length || combos.length ? `<section class="card">
      <div class="section-title" style="margin:0 0 8px">Wechselwirkungen</div>
      ${conflicts.map((c) => `<div class="inj-warn">
        <b>${esc(c.inj.name)}</b> würde ${esc(nm(c.from))} durch ${esc(nm(c.to))} ersetzen –
        das sperrt aber ${esc(c.by.join(' und '))}. Die Übung fällt deshalb ganz weg.
      </div>`).join('')}
      ${combos.map((c) => `<div class="inj-warn">${esc(c.text)}</div>`).join('')}
    </section>` : ''}
  ` : `
    <section class="card inj-summary">
      <div class="inj-fig no-hint" id="injFigure" aria-label="Körper ohne Beschwerden"></div>
      <div class="inj-sum-body">
        <div class="section-title" style="margin:0 0 6px">Nichts angehakt</div>
        <div class="small muted">Hak an, was gerade weh tut. Der Plan lässt die betroffenen
        Übungen dann weg oder tauscht sie – dauerhaft, bis der Haken wieder weg ist.</div>
      </div>
    </section>`;

  const areas = [];
  INJURIES.forEach((i) => {
    const last = areas[areas.length - 1];
    if (last && last.area === i.area) last.list.push(i);
    else areas.push({ area: i.area, list: [i] });
  });

  view.innerHTML = `
    <button type="button" class="back-link" data-act="go-tab" data-tab="settings">← Mehr</button>
    <div class="section-title">Verletzungen &amp; Beschwerden</div>
    ${summary}
    ${areas.map((g) => `
      <div class="inj-area">${esc(g.area)}</div>
      ${g.list.map((i) => {
        const open = ui.openInjury.has(i.id);
        const on = activeSet.has(i.id);
        const hitsPlan = i.avoid.some((x) => PLAN.some((w) => w.ex.some((e) => e.id === x)));
        return `
        <section class="card inj-card${on ? ' on' : ''}">
          <div class="inj-head" data-act="toggle-injury-open" data-inj="${i.id}" role="button" tabindex="0">
            <div class="inj-title">
              <div class="lbl">${esc(i.name)}</div>
              <div class="hint">${esc(KIND_LABEL[i.kind] || i.kind)} · ${esc(i.area)}${
                hitsPlan ? '' : ' · betrifft keine Übung im Plan'}</div>
            </div>
            <button type="button" class="toggle" aria-pressed="${on}"
              data-act="toggle-injury" data-inj="${i.id}"
              aria-label="${esc(i.name)} ${on ? 'abwählen' : 'anhaken'}"></button>
          </div>
          ${open ? `<div class="inj-body">
            <div class="inj-fig small-fig no-hint" data-spot="${i.spot}" data-kind="${i.kind}"
              aria-label="Körper, betroffen: ${esc(i.area)}"></div>
            <div class="inj-text">
              <p>${esc(i.text)}</p>
              ${i.avoid.length ? `<div class="small"><b>Betrifft:</b> ${
                i.avoid.map((x) => esc(nm(x))).join(' · ')}</div>` : ''}
              ${Object.keys(i.swap).length ? `<div class="small" style="margin-top:4px"><b>Ersatz:</b> ${
                Object.entries(i.swap).map(([a, b]) => `${esc(nm(a))} → ${esc(nm(b))}`).join(' · ')}</div>`
                : '<div class="small muted" style="margin-top:4px">Kein Ersatz – die Übungen fallen weg.</div>'}
            </div>
          </div>
          ${(i.care || []).length ? `<div class="inj-care">
            <div class="small"><b>Was gut tut</b>${needsClearance(i.id)
              ? ' <span class="muted">– erst nach ärztlicher Freigabe</span>' : ''}</div>
            ${i.care.map((k) => (CARE[k] ? careCard({ key: k, ...CARE[k] }) : '')).join('')}
          </div>` : ''}` : ''}
        </section>`;
      }).join('')}
    `).join('')}
    <div class="card muted small">
      Das hier ersetzt keine Diagnose. Die Zuordnungen sind gängige Trainingslehre –
      was im Einzelfall gut tut, weiß nur eine Untersuchung. Bei Schmerz, der bleibt,
      gehört jemand draufgeschaut, der das kann.
    </div>`;

  const big = document.getElementById('injFigure');
  if (big) mountFigure(big, 'stand', false, null, marks);
  view.querySelectorAll('.inj-fig.small-fig').forEach((host) => {
    mountFigure(host, 'stand', false, null, [{ spot: host.dataset.spot, kind: host.dataset.kind }]);
  });
}

/* ------------------------------------------------------------------ *
 * Einstellungen
 * ------------------------------------------------------------------ */

/**
 * Welche Fassung gerade läuft.
 *
 * Nicht aus einer Konstante im Skript – die würde man beim Ändern vergessen –,
 * sondern aus dem Namen des Zwischenspeichers, den der Service Worker anlegt.
 * Damit steht dort, was wirklich ausgeliefert wird, und im Zweifel sieht man
 * sofort, ob eine alte Fassung klebt.
 */
function showVersion() {
  const host = document.getElementById('appVersion');
  if (!host) return;
  // Ohne Enddatum: Der Plan läuft weiter, sobald eine Runde durch ist. Die
  // Zahl je Runde bleibt – sie sagt etwas über die ausgelieferte Fassung, und
  // genau dafür steht diese Zeile hier.
  const plan = `Plan: ${PLAN.length} Einheiten je Runde`;
  if (!window.caches) {
    host.textContent = `${plan} · kein Zwischenspeicher`;
    return;
  }
  caches.keys().then((keys) => {
    const mine = keys.filter((k) => k.startsWith('workout-'));
    host.textContent = `${plan} · Zwischenspeicher: ${mine.join(', ') || 'keiner'}`;
  }).catch(() => { host.textContent = plan; });
}

/* ------------------------------------------------------------------ *
 * Eigenes Workout
 *
 * Der Plan deckt 21 Wochen ab und rechnet sein Wochenvolumen aus 84 festen
 * Einheiten. Etwas dazwischenzuschieben würde diese Rechnung stillschweigend
 * verschieben – deshalb stehen eigene Einheiten *neben* dem Plan: Sie laufen in
 * derselben Fokus-Ansicht mit Pausen, Gewichten und Bewegungsbildern, aber sie
 * zählen nicht als erledigte Plan-Einheit. In der Statistik tauchen ihre Sätze
 * und Kilo trotzdem auf – trainiert ist trainiert.
 *
 * Gedacht für die Fälle, die der Plan nicht kennt: im Urlaub nur das, wofür es
 * ein Gerät gibt; nach einer Pause etwas Kurzes; oder eine Extraeinheit für
 * eine Muskelgruppe, die man selbst zu kurz findet.
 * ------------------------------------------------------------------ */

function renderCustom() {
  const liste = store.customs();
  const draft = ui.customDraft;

  if (!draft) {
    view.innerHTML = `
      <button type="button" class="back-link" data-act="go-tab" data-tab="settings">← Mehr</button>
      <div class="section-title">Eigene Workouts</div>
      <div class="card">
        <div class="small muted">Stell dir eine Einheit selbst zusammen – Übungen aus dem
          Vorrat, Sätze frei. Sie läuft wie eine Plan-Einheit, mit Pausen, Gewichten und
          Bewegungsbildern, geht dem Plan aber nicht dazwischen: Deine 84 Einheiten bleiben,
          wie sie sind. Sätze und Volumen zählen in der Statistik mit.</div>
        <div class="btn-row">
          <button type="button" class="btn btn-primary btn-block" data-act="custom-new">Neues Workout</button>
        </div>
      </div>
      ${liste.map((c) => {
        const sets = c.ex.reduce((a, x) => a + x.sets, 0);
        const prog = progressOf(c.id, store.workoutMode(c.id));
        return `
        <div class="card">
          <div class="lbl">${esc(c.name)}</div>
          <div class="hint">${c.ex.length} Übungen · ${sets} Sätze${
            prog.done ? ` · ${prog.done}/${prog.total} abgehakt` : ''}</div>
          <div class="small muted" style="margin-top:6px">${esc(c.ex.map((x) => resolve(x, 'db').name).join(' · ')) || 'Noch keine Übung'}</div>
          <div class="btn-row nav">
            <button type="button" class="btn btn-primary" data-act="custom-start" data-id="${c.id}">Öffnen</button>
            <button type="button" class="btn" data-act="custom-edit" data-id="${c.id}">Bearbeiten</button>
            <button type="button" class="btn btn-danger" data-act="custom-del" data-id="${c.id}">Löschen</button>
          </div>
        </div>`;
      }).join('')}`;
    return;
  }

  // --- Baukasten ---
  const gruppen = new Map();
  EXERCISES.forEach((e) => {
    if (!gruppen.has(e.group)) gruppen.set(e.group, []);
    gruppen.get(e.group).push(e);
  });
  const drin = new Set(draft.ex.map((x) => x.id));
  const sets = draft.ex.reduce((a, x) => a + x.sets, 0);

  view.innerHTML = `
    <button type="button" class="back-link" data-act="custom-cancel">← Eigene Workouts</button>
    <div class="section-title">${draft.id ? 'Bearbeiten' : 'Neues Workout'}</div>
    <div class="card">
      <div class="lbl">Name</div>
      <input type="text" class="name-input" maxlength="32" value="${esc(draft.name)}"
             data-act="custom-name" aria-label="Name des Workouts" placeholder="z. B. Kurz &amp; schwer">
    </div>

    <div class="section-title">Übungen${draft.ex.length ? ` · ${draft.ex.length} · ${sets} Sätze` : ''}</div>
    <div class="card">
      ${draft.ex.length ? draft.ex.map((x, i) => {
        const v = resolve(x, 'db');
        return `
        <div class="cx-row">
          <div class="cx-main">
            <div class="lbl">${esc(v.name)}</div>
            <div class="hint">${esc(v.group)} · ${esc(v.equip)}</div>
          </div>
          <div class="cx-sets">
            <button type="button" class="kg-step" data-act="custom-sets" data-i="${i}" data-d="-1"
                    aria-label="Ein Satz weniger">−</button>
            <span class="cx-num">${x.sets}</span>
            <button type="button" class="kg-step" data-act="custom-sets" data-i="${i}" data-d="1"
                    aria-label="Ein Satz mehr">+</button>
          </div>
          <button type="button" class="cx-del" data-act="custom-remove" data-i="${i}"
                  aria-label="${esc(v.name)} entfernen">✕</button>
        </div>`;
      }).join('') : '<div class="small muted">Noch nichts gewählt – unten aussuchen.</div>'}
      <div class="btn-row">
        <button type="button" class="btn btn-primary btn-block" data-act="custom-save"
                ${draft.ex.length ? '' : 'disabled'}>Speichern und öffnen</button>
      </div>
    </div>

    <div class="section-title">Übungsvorrat</div>
    <div class="card">
      ${[...gruppen.entries()].map(([g, list]) => `
        <div class="cx-group">${esc(g)}</div>
        <div class="chips">${list.map((e) => `
          <button type="button" class="chip ${drin.has(e.id) ? 'on' : ''}"
                  data-act="custom-add" data-ex="${e.id}">${esc(e.db.name)}</button>`).join('')}</div>`).join('')}
    </div>`;
}

/* Die Farbwerte stehen in css/styles.css; hier nur die Namen und die zwei
 * Tupfer für die Vorschau. Zwei Stellen für dieselbe Farbe – aber die Alternative
 * wäre, das Design aus JavaScript zusammenzubauen, und dann flackert es beim
 * Laden. */
/* Trainingsfokus: was hinter den Varianten aus js/data.js steht. Die Zahlen
 * rechnet fokusZeile() aus dem Plan selbst aus – hier steht nur, für wen das
 * gedacht ist. */
const FOKUS_TEXT = {
  standard: 'Der Normalfall: alles gleichmäßig, mit etwas mehr für das, was breit macht – '
    + 'Rücken, Brust und seitliche Schulter. Die Beine laufen mit.',
  bbp: 'Gesäß, Beine und Bauch bekommen das meiste. Der Oberkörper bleibt drin, damit die '
    + 'Haltung nicht auf der Strecke bleibt – nur mit weniger Sätzen.',
  oberkoerper: 'Brust, Rücken, Schultern und Arme. Beine und Gesäß nur als Grundlage, ein '
    + 'Auftritt pro Woche.',
  cut: 'Für Wochen im Kaloriendefizit: dieselben Übungen mit denselben Gewichten, nur weniger '
    + 'Sätze. Im Defizit hält die Last die Muskeln, nicht das Volumen – und jede Gruppe kommt '
    + 'weiter zweimal die Woche dran. Auch die Wahl, wenn einfach die Zeit knapp ist.',
};

/* Wie lange ein Satz selbst dauert – acht bis zwölf Wiederholungen mit
 * Aufstellen. Grob, aber die Pausen daneben sind der viel größere Posten. */
const ARBEIT_JE_SATZ = 40;

/* ------------------------------------------------------------------ *
 * Die Zeitschätzung an der echten Uhr eichen
 *
 * „ca. 50 min" steht an jeder Variante, und nach dieser Zahl sucht jemand
 * seinen Plan aus. Sie kommt aus einer Formel: 40 Sekunden je Satz plus die
 * vorgesehene Pause. Beides ist geraten – der Satz dauert länger, wenn man
 * umbaut, und kürzer, wenn man die Pause abbricht.
 *
 * Die Uhr misst derweil mit (`secs` je Einheit im Protokoll) und wurde bisher
 * nur angezeigt. Aus beidem zusammen wird ein Faktor: Wer regelmäßig 20 %
 * länger braucht, soll auch 20 % mehr angezeigt bekommen.
 *
 * **Erst ab fünf gemessenen Einheiten.** Eine einzelne sagt nichts – wer beim
 * ersten Mal zwischendurch telefoniert, bekäme sonst für den Rest des Plans
 * falsche Zahlen. Und der Faktor ist gedeckelt: Zwischen halb und doppelt so
 * lang. Was darüber hinausgeht, ist keine Eichung mehr, sondern eine Einheit,
 * bei der die Uhr mitlief, während jemand einkaufen war.
 * ------------------------------------------------------------------ */
const EICHUNG_AB = 5;
const EICHUNG_MIN = 0.5;
const EICHUNG_MAX = 2.0;

/**
 * Wie lange eine Einheit nach der Formel dauern müsste, in Sekunden.
 *
 * Mit den echten Pausen je Übung, nicht mit einem Mittelwert: Ein Satz
 * Chin-ups kostet 180 s Pause, einer Wadenheben 90.
 */
function dauerLautFormel(items, mode) {
  if (!items.length) return 0;
  const pause = (id) => {
    const ex = EX_BY_ID.get(id);
    return (ex && ex[mode] && ex[mode].rest) || 120;
  };
  const summe = items.reduce((a, it) => a + it.sets * (ARBEIT_JE_SATZ + pause(it.id)), 0);
  // Die letzte Pause der Einheit fällt weg – danach ist man fertig.
  return summe - pause(items[items.length - 1].id);
}

/**
 * Der gemessene Faktor zwischen echter und geschätzter Dauer – oder null.
 *
 * Gezählt werden nur abgeschlossene Einheiten mit erfasster Zeit. Verglichen
 * werden Summen und nicht Einzelwerte: Eine Einheit, bei der die App im
 * Hintergrund lag, zieht so nicht den ganzen Schnitt.
 */
function zeitEichung() {
  const log = store.getState().log;
  let echt = 0;
  let formel = 0;
  let n = 0;
  PLAN.forEach((w) => {
    const e = log[w.n];
    const m = completedMode(w.n);
    if (!e || !m || !(e.secs > 0)) return;
    const soll = dauerLautFormel(exOf(w, m), m);
    if (soll <= 0) return;
    echt += e.secs;
    formel += soll;
    n += 1;
  });
  if (n < EICHUNG_AB || formel <= 0) return null;
  const roh = echt / formel;
  return {
    faktor: Math.min(EICHUNG_MAX, Math.max(EICHUNG_MIN, roh)),
    roh,
    einheiten: n,
    gedeckelt: roh < EICHUNG_MIN || roh > EICHUNG_MAX,
  };
}

/**
 * Sekunden als Zeitangabe, wie man sie ausspricht: "48 min", "3 h 12".
 *
 * Nicht 0:48:00 – das liest sich wie eine Stoppuhr, und hier geht es um eine
 * Größenordnung, nicht um Sekundengenauigkeit.
 */
function dauerText(sek) {
  const min = Math.round(sek / 60);
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')}`;
}

/** Eine Zeile Zahlen zu einer Variante: Einheiten, Sätze, geschätzte Dauer. */
function fokusZeile(v) {
  // Mit der Satzzahl der eingestellten Erfahrung *und* des eingestellten Modus
  // rechnen, nicht mit der des Plans: Verglichen wird, was tatsächlich vor
  // einem liegt. Im Bodyweight-Modus sind das teils andere Zahlen – siehe
  // bw_saetze() in tools/build-plan.py.
  const modus = store.getState().mode;
  const roh = (x) => (modus === 'bw' && x.bwSets ? x.bwSets : x.sets);
  const saetze = v.plan.reduce((a, w) => a + w.ex.reduce((b, x) => b + satzZahl(roh(x)), 0), 0);
  const proEinheit = saetze / v.plan.length;
  // Mit den echten Pausen rechnen, nicht mit einem Mittelwert für alle: Ein Satz
  // Chin-ups kostet 180 s Pause, einer Wadenheben 90. Pauschal zweieinhalb
  // Minuten je Satz unterschätzte deshalb genau die Varianten mit vielen
  // Grundübungen – und nach dieser Zahl wird die Variante ausgesucht.
  const sekunden = v.plan.reduce((a, w) => a + w.ex.reduce((b, x) => {
    const ex = EX_BY_ID.get(x.id);
    const pause = (ex && ex[modus] && ex[modus].rest) || 120;
    // Arbeit plus Pause nach jedem Satz; die letzte Pause der Einheit fällt weg.
    return b + satzZahl(roh(x)) * (ARBEIT_JE_SATZ + pause);
  }, 0) - ((w.ex.length && EX_BY_ID.get(w.ex[w.ex.length - 1].id)[modus].rest) || 0), 0);
  // Wer schon gemessen hat, bekommt seine eigene Zahl statt der Formel.
  const eich = zeitEichung();
  const min = Math.round((sekunden * (eich ? eich.faktor : 1) / v.plan.length / 60) / 5) * 5;
  return `${v.plan.length} Einheiten · ${proEinheit.toFixed(1)} Sätze je Einheit · `
    + `${eich ? '' : 'ca. '}${min} min${eich ? ' (gemessen)' : ''}`;
}

/** Auswahlkarten für den Trainingsfokus – im Einstieg und in den Einstellungen. */
function fokusKarten(aktuell) {
  return Object.entries(PLANS).map(([key, v]) => `
    <button type="button" class="fokus-btn ${key === aktuell ? 'on' : ''}"
            aria-pressed="${key === aktuell}" data-act="set-focus" data-v="${key}">
      <span class="lbl">${esc(v.name)}${key === aktuell ? ' ✓' : ''}</span>
      <span class="hint">${esc(FOKUS_TEXT[key] || '')}</span>
      <span class="fokus-zahl">${esc(fokusZeile(v))}</span>
    </button>`).join('');
}

const THEMES = [
  ['orange', 'Orange', '#ff7a45', '#4ea1ff'],
  ['rosa', 'Rosa', '#ff6fae', '#b98cff'],
  ['blau', 'Blau', '#4ea1ff', '#4ecfd0'],
  ['gruen', 'Grün', '#3ecf8e', '#7ad0ff'],
  ['violett', 'Violett', '#a78bfa', '#f0abfc'],
];

/* ------------------------------------------------------------------ *
 * Betreiber-Übersicht
 *
 * Die eine Ansicht, die nicht jedem gehört: Wer den Link verschickt hat, sieht
 * hier, was daraus geworden ist – wie viele Geräte, welche Fokusse, wer noch
 * trainiert und wer nicht mehr.
 *
 * Der Zugang hängt an einem Passwort, das nirgends im Code steht. Die App
 * schickt es an eine Datenbankfunktion, die nur bei Übereinstimmung Zeilen
 * zurückgibt; ein Schlüssel mit Leserecht müsste dagegen in der App liegen und
 * läge damit bei allen, die den Link haben.
 * ------------------------------------------------------------------ */

function adminKarte() {
  if (!hatServer()) return '';
  return `
    <div class="section-title">Übersicht</div>
    <div class="card">
      <div class="small muted">Wer den Link verschickt hat, sieht hier, wie die App
        benutzt wird. Braucht das Passwort aus der Einrichtung.</div>
      <div class="btn-row">
        <button type="button" class="btn btn-block" data-act="go-tab" data-tab="admin">Übersicht öffnen</button>
      </div>
    </div>`;
}

/**
 * Was vom Server kommt, ist fremder Text – auch wenn er von der eigenen App
 * stammen sollte.
 *
 * Schreiben darf jeder, der den öffentlichen Schlüssel hat, und der steht im
 * Repo. Eine Zeile könnte also statt einer Zahl eine Zeichenkette mitbringen;
 * die landete beim Zusammenrechnen als Text in der Übersicht und von dort
 * ungefiltert im HTML. Deshalb wird hier einmal alles auf seine Form gebracht,
 * bevor die Ansicht es überhaupt sieht: Zahlen sind danach Zahlen, alles andere
 * geht wie gehabt durch esc().
 */
function saubereZeilen(daten) {
  const zahl = (x) => (Number.isFinite(Number(x)) ? Number(x) : 0);
  const text = (x) => (x === null || x === undefined ? '' : String(x));
  return (Array.isArray(daten) ? daten : []).map((r) => {
    const ue = {};
    Object.entries((r && r.uebungen) || {}).forEach(([id, n]) => { ue[text(id)] = zahl(n); });
    return {
      id: text(r.id),
      name: text(r.name),
      fokus: text(r.fokus),
      stufe: text(r.stufe),
      einheiten: zahl(r.einheiten),
      plan: zahl(r.plan),
      saetze: zahl(r.saetze),
      volumen: zahl(r.volumen),
      serie: zahl(r.serie),
      geteilt: zahl(r.geteilt),
      freunde: zahl(r.freunde),
      zuletzt: text(r.zuletzt),
      gesehen: text(r.gesehen),
      uebungen: ue,
    };
  });
}

/**
 * Das Betreiber-Passwort lebt nur, solange der Tab offen ist.
 *
 * Es öffnet die Zahlen aller anderen, und es lag bisher im selben Speicher wie
 * der ganze Rest: dauerhaft, lesbar für jedes Skript auf dieser Seite, und in
 * jeder Sicherungsdatei mit drin. Der Tab-Speicher überlebt Neuladen und
 * Zurück-Taste, aber weder das Schließen noch den Export.
 */
const PASS_SCHLUESSEL = 'workout.adminPass';
function adminPassLesen() {
  try { return sessionStorage.getItem(PASS_SCHLUESSEL) || ''; } catch { return ''; }
}
function adminPassMerken(wort) {
  try {
    if (wort) sessionStorage.setItem(PASS_SCHLUESSEL, wort);
    else sessionStorage.removeItem(PASS_SCHLUESSEL);
  } catch { /* gesperrter Speicher: dann eben jedes Mal eintippen */ }
}

/**
 * Geräte zu Menschen zusammenfassen.
 *
 * Ohne Konten kennt der Server nur Geräte: Jedes bekommt beim ersten Start eine
 * Zufallskennung, und zwei Browser desselben Menschen sind zwei Kennungen. In
 * der Übersicht standen sie deshalb als zwei Nutzer – bei drei Zeilen fällt das
 * auf, bei dreißig nicht mehr.
 *
 * Zusammengefasst wird über den Namen, weil es nichts Besseres gibt. Das ist
 * eine Annahme, keine Tatsache: Zwei verschiedene Menschen, die beide "Tobi"
 * heißen, werden hier zu einem. Deshalb steht die Geräte-Zahl weiter daneben,
 * und unter der Tabelle steht, worauf sie beruht.
 *
 * Gezählt wird je Spalte das **Maximum**, nicht die Summe: Wer dieselbe Einheit
 * auf zwei Geräten offen hatte, hat sie einmal trainiert. Summieren würde ihn
 * doppelt zählen; das Maximum ist der Stand des Geräts, das am weitesten ist.
 */
function alsMenschen(zeilen) {
  const gruppen = new Map();
  zeilen.forEach((r) => {
    const key = (r.name || '–').trim().toLowerCase() || '–';
    const g = gruppen.get(key);
    if (!g) {
      gruppen.set(key, { ...r, geraete: 1 });
      return;
    }
    g.geraete += 1;
    ['einheiten', 'plan', 'saetze', 'volumen', 'serie', 'geteilt', 'freunde']
      .forEach((f) => { g[f] = Math.max(g[f], r[f]); });
    // Späteres Datum gewinnt – bei "zuletzt trainiert" wie bei "zuletzt gesehen".
    ['zuletzt', 'gesehen'].forEach((f) => { if (r[f] > g[f]) g[f] = r[f]; });
    // Fokus und Stufe vom zuletzt gesehenen Gerät.
    if (r.gesehen >= g.gesehen) { g.name = r.name; g.fokus = r.fokus; g.stufe = r.stufe; }
    Object.entries(r.uebungen).forEach(([id, n]) => {
      g.uebungen[id] = Math.max(g.uebungen[id] || 0, n);
    });
  });
  return [...gruppen.values()];
}

function renderAdmin() {
  const zurueck = '<button type="button" class="back-link" data-act="go-tab" data-tab="settings">← Mehr</button>';
  if (!hatServer()) {
    view.innerHTML = `${zurueck}<div class="card muted small">In dieser Fassung ist kein Server
      eingetragen – es gibt nichts zu zeigen.</div>`;
    return;
  }
  const daten = ui.adminDaten;
  if (!daten && adminPassLesen() && !ui.adminFehler && !ui.adminLaeuft) {
    // Passwort steht schon: dann nicht danach fragen, sondern laden.
    ui.adminLaeuft = true;
    adminOeffnen(adminPassLesen());
  }
  if (!daten) {
    view.innerHTML = `
      ${zurueck}
      <div class="section-title">Übersicht</div>
      <div class="card">
        <div class="small muted">Passwort aus der Einrichtung (steht in der Datenbankfunktion
          <code>admin_liste</code>, nicht in der App).</div>
        <input type="password" class="name-input" id="adminPass" autocomplete="current-password"
               placeholder="Passwort" aria-label="Passwort">
        <div class="btn-row">
          <button type="button" class="btn btn-primary btn-block" data-act="admin-open">Öffnen</button>
        </div>
        ${ui.adminFehler ? `<div class="hint" style="color:var(--accent)">${esc(ui.adminFehler)}</div>` : ''}
      </div>`;
    const feld = document.getElementById('adminPass');
    if (feld) {
      feld.value = adminPassLesen();
      feld.addEventListener('keydown', (e) => { if (e.key === 'Enter') adminOeffnen(); });
    }
    return;
  }

  // --- Zahlen aus den Zeilen ---
  const heute = todayISO();
  const tage = (d) => (d ? daysBetween(String(d).slice(0, 10), heute) : null);
  // Menschen statt Geräte, wo es um Menschen geht – siehe alsMenschen().
  const leute = alsMenschen(daten);
  const aktiv = leute.filter((r) => tage(r.gesehen) !== null && tage(r.gesehen) <= 7).length;
  const trainiert = leute.filter((r) => (r.einheiten || 0) > 0).length;
  const summeSaetze = daten.reduce((a, r) => a + (r.saetze || 0), 0);
  const geteilt = daten.reduce((a, r) => a + (r.geteilt || 0), 0);
  const fokusse = new Map();
  leute.forEach((r) => fokusse.set(r.fokus || '–', (fokusse.get(r.fokus || '–') || 0) + 1));
  const stufen = new Map();
  leute.forEach((r) => stufen.set(r.stufe || '–', (stufen.get(r.stufe || '–') || 0) + 1));
  const uebungen = new Map();
  daten.forEach((r) => Object.entries(r.uebungen || {}).forEach(([id, n]) => {
    uebungen.set(id, (uebungen.get(id) || 0) + (Number(n) || 0));
  }));
  const topUe = [...uebungen.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  const maxUe = topUe.length ? topUe[0][1] : 1;
  const reihen = [...leute].sort((a, b) => (b.einheiten || 0) - (a.einheiten || 0));

  const verteilung = (karte) => [...karte.entries()].sort((a, b) => b[1] - a[1])
    .map(([k, n]) => `${esc(k)} <b>${n}</b>`).join(' · ');

  view.innerHTML = `
    ${zurueck}
    <div class="section-title">Übersicht</div>
    <div class="stat-grid">
      <div class="stat"><div class="stat-v">${leute.length}</div><div class="stat-l">Personen</div></div>
      <div class="stat"><div class="stat-v">${daten.length}</div><div class="stat-l">Geräte insgesamt</div></div>
      <div class="stat"><div class="stat-v">${aktiv}</div><div class="stat-l">in den letzten 7 Tagen</div></div>
      <div class="stat"><div class="stat-v">${trainiert}</div><div class="stat-l">haben trainiert</div></div>
      <div class="stat"><div class="stat-v">${summeSaetze}</div><div class="stat-l">Sätze zusammen</div></div>
      <div class="stat"><div class="stat-v">${geteilt}</div><div class="stat-l">mal weitergeschickt</div></div>
      <div class="stat"><div class="stat-v">${daten.filter((r) => (r.freunde || 0) > 0).length}</div><div class="stat-l">mit Vergleich</div></div>
    </div>

    <div class="section-title">Fokus und Erfahrung</div>
    <div class="card">
      <div class="small">${verteilung(fokusse) || '–'}</div>
      <div class="small muted" style="margin-top:8px">${verteilung(stufen) || '–'}</div>
    </div>

    <div class="section-title">Wer</div>
    <div class="card">
      <table class="vgl">
        <thead><tr><th>Name</th><th>Einheiten</th><th>Sätze</th><th>zuletzt</th></tr></thead>
        <tbody>${reihen.map((r) => {
          const t = tage(r.gesehen);
          return `<tr>
            <td>${esc(r.name || '–')}
              <div class="small muted">${esc(r.fokus || '')}${r.stufe ? ` · ${esc(r.stufe)}` : ''}${
                r.geraete > 1 ? ` · ${esc(plural(r.geraete, 'Gerät', 'Geräte'))}` : ''}</div></td>
            <td><b>${esc(r.einheiten || 0)}</b><span class="muted">/${esc(r.plan || '?')}</span></td>
            <td>${esc(r.saetze || 0)}</td>
            <td>${r.zuletzt ? esc(fmtDate(String(r.zuletzt).slice(0, 10))) : '–'}
              <div class="small muted">${t === null ? ''
                : t === 0 ? 'App heute geöffnet' : `App vor ${plural(t, 'Tag', 'Tagen')}`}</div></td>
          </tr>`;
        }).join('')}</tbody>
      </table>
    </div>

    <div class="section-title">Meistgemachte Übungen</div>
    <div class="card">
      ${topUe.length ? `<div class="bars">${topUe.map(([id, n]) => `
        <div class="bar-row">
          <div>
            <div class="bar-name">${esc((EX_BY_ID.get(id) || {}).db ? EX_BY_ID.get(id).db.name : id)}</div>
            <div class="bar-track"><i style="width:${Math.round((n / maxUe) * 100)}%"></i></div>
          </div>
          <div class="bar-val">${esc(n)}</div>
        </div>`).join('')}</div>` : '<div class="muted small">Noch nichts abgehakt.</div>'}
    </div>

    <div class="btn-row nav">
      <button type="button" class="btn" data-act="admin-reload">Neu laden</button>
      <button type="button" class="btn btn-ghost" data-act="admin-logout">Passwort vergessen</button>
    </div>
    <p class="small muted">Jede Zeile ist ein Mensch, jede Kennung ein Gerät – ohne Konten
      kann der Server die beiden nicht auseinanderhalten, also fasst diese Liste zusammen,
      was denselben Namen trägt. Zwei Browser derselben Person sind eine Zeile mit dem
      Vermerk „2 Geräte"; zwei verschiedene Menschen mit demselben Namen wären hier
      allerdings auch einer. Je Spalte steht der höchste Wert der Geräte, nicht ihre Summe –
      wer dieselbe Einheit auf zwei Geräten offen hatte, hat sie einmal trainiert. Wer das
      Teilen abschaltet, verschwindet, sobald er auf „Meine Daten dort löschen" tippt.</p>`;
}

/** Passwort prüfen und Liste holen. */
function adminOeffnen(pass) {
  const feld = document.getElementById('adminPass');
  const wort = pass || (feld ? feld.value.trim() : adminPassLesen());
  if (!wort) return;
  ui.adminFehler = '';
  adminListe(wort).then((daten) => {
    adminPassMerken(wort);
    ui.adminDaten = saubereZeilen(daten);
    ui.adminLaeuft = false;
    render();
  }).catch((e) => {
    ui.adminFehler = e.message || 'Hat nicht geklappt';
    ui.adminDaten = null;
    ui.adminLaeuft = false;
    render();
  });
}

function renderSettings() {
  const s = store.getState();
  const act = activeInjuries().length;
  view.innerHTML = `
    <div class="card kachel-karte">
      <button type="button" class="kachel" data-act="go-tab" data-tab="calendar">
        <span class="kachel-i">📅</span>
        <span><span class="lbl">Kalender</span>
        <span class="hint">Alle Termine im Monatsraster, mit dem, was an dem Tag anstand.</span></span>
      </button>
      <button type="button" class="kachel" data-act="go-tab" data-tab="custom">
        <span class="kachel-i">🧩</span>
        <span><span class="lbl">Eigenes Workout${store.customs().length ? ` · ${store.customs().length}` : ''}</span>
        <span class="hint">Eine Einheit selbst zusammenstellen – neben dem Plan, nicht darin.</span></span>
      </button>
      <button type="button" class="kachel" data-act="go-tab" data-tab="injuries">
        <span class="kachel-i">🩹</span>
        <span><span class="lbl">Verletzt${act ? ` · ${act} aktiv` : ''}</span>
        <span class="hint">Anhaken, was weh tut – der Plan tauscht dann selbst.</span></span>
      </button>
    </div>

    ${modusKarte(s.mode === 'bw' ? 'bw' : 'db')}

    <div class="section-title">Pause zwischen den Sätzen</div>
    <div class="card">
      <div class="stat-v">${s.useExerciseRest
        ? '0:45 – 2:30 min'
        : (s.restSeconds ? `${Math.floor(s.restSeconds / 60)}:${String(s.restSeconds % 60).padStart(2, '0')} min` : 'Aus')}</div>
      <div class="small muted" style="margin-top:2px">
        Läuft automatisch, sobald du einen Satz abhakst – außer nach dem letzten Satz
        einer Übung. Am Ende kommt ein Signalton.
      </div>
      <div class="switch-row" style="margin-top:10px">
        <div>
          <div class="lbl">Pause je Übung</div>
          <div class="hint">Schwere Grundübungen bekommen mehr Pause als kleine Isolationsübungen –
            2:30 beim Squat, 0:45 bei Crunches. Aus schaltet auf eine feste Länge um.</div>
        </div>
        <button type="button" class="toggle" aria-pressed="${s.useExerciseRest}" data-act="toggle-ex-rest" aria-label="Pause je Übung"></button>
      </div>
      ${s.useExerciseRest ? '' : `
      <div class="btn-row nav">
        ${[60, 90, 120, 180].map((sec) => `
          <button type="button" class="btn ${s.restSeconds === sec ? 'btn-primary' : ''}"
                  data-act="set-rest" data-sec="${sec}">${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}</button>`).join('')}
      </div>`}
      <div class="switch-row">
        <div>
          <div class="lbl">Pause abschalten</div>
          <div class="hint">Kein Timer, kein Ton – Sätze nur abhaken.</div>
        </div>
        <button type="button" class="toggle" aria-pressed="${!s.useExerciseRest && !s.restSeconds}" data-act="toggle-rest-off" aria-label="Pause abschalten"></button>
      </div>
    </div>

    ${hatServer() ? `<div class="section-title">Nutzung teilen</div>
    ${shareKarte(true)}` : ''}

    ${adminKarte()}

    <div class="section-title">Leiste unten</div>
    <div class="card">
      <div class="small muted">Welche Seiten unten stehen. <em>Dashboard</em> und <em>Mehr</em>
        bleiben – ohne das eine gibt es kein Training, ohne das andere keinen Weg zurück
        hierher. Alles andere ist auch ohne Reiter über Mehr erreichbar.</div>
      ${Object.entries(TABS).filter(([k]) => !TABS_FIX.includes(k)).map(([key, [icon, label]]) => {
        const an = tabsAktiv().includes(key);
        const voll = tabsAktiv().length >= TABS_MAX && !an;
        return `
        <div class="switch-row">
          <div>
            <div class="lbl">${icon} ${esc(label)}</div>
            ${voll ? `<div class="hint">Erst einen anderen abwählen – mehr als ${TABS_MAX}
              werden unten zu schmal.</div>` : ''}
          </div>
          <button type="button" class="toggle" aria-pressed="${an}" data-act="toggle-tab"
                  data-v="${key}" aria-label="${esc(label)} unten anzeigen" ${voll ? 'disabled' : ''}></button>
        </div>`;
      }).join('')}
    </div>

    <div class="section-title">Erfahrung</div>
    <div class="card">
      ${erfahrungStand()}
    </div>

    <div class="section-title" id="fokus-wahl">Trainingsfokus</div>
    <div class="card">
      <div class="small muted">Jeder Fokus ist ein eigener, durchgerechneter Plan: dieselben
        Termine, dieselbe Erholungsregel, andere Schwerpunkte. Wechseln kostet nichts: Jeder
        Fokus behält seinen eigenen Verlauf und steht beim Zurückwechseln wieder da, wo du ihn
        verlassen hast. Gewichte, Statistik und Trainingstage gelten ohnehin über alle.</div>
      <div class="fokus-liste">${fokusKarten(s.focus || 'standard')}</div>
      ${Object.keys(PLANS).length < 2 ? `<div class="small muted">In dieser Fassung ist nur der
        Aufbauplan mitgeliefert.</div>` : ''}
    </div>

    <div class="section-title">Farbe</div>
    <div class="card">
      <div class="small muted">Zwei Akzente: der wärmere gilt für die Hantel-Variante, der
        kühlere für Bodyweight. Sonst ändert sich nichts – dunkel bleibt dunkel.</div>
      <div class="farben">
        ${THEMES.map(([key, label, a, bfarbe]) => `
          <button type="button" class="farb-btn ${(s.theme || 'orange') === key ? 'on' : ''}"
                  aria-pressed="${(s.theme || 'orange') === key}" data-act="set-theme" data-v="${key}">
            <span class="farb-punkt" style="--a:${a};--b:${bfarbe}"></span>${label}
          </button>`).join('')}
      </div>
    </div>

    <div class="section-title">Teilen</div>
    <div class="card">
      <div class="small muted">Schick den Link weiter – wer ihn öffnet, hat dieselbe App:
        derselbe Plan, dieselben Bewegungen, offline und ohne Konto. Jeder trainiert für sich;
        von allein wird nichts übertragen. Voneinander seht ihr genau das, was ihr euch
        gegenseitig schickt – dafür ist der Stand-Link unten da.</div>
      ${location.protocol.startsWith('http') ? `
      <div class="btn-row">
        <button type="button" class="btn btn-primary btn-block" data-act="share-link">Link teilen</button>
      </div>
      <div class="btn-row nav">
        <button type="button" class="btn" data-act="share-whatsapp">WhatsApp</button>
        <button type="button" class="btn" data-act="copy-link">Link kopieren</button>
      </div>
      <div class="btn-row">
        <button type="button" class="btn btn-block" data-act="share-stand">Meinen Stand schicken</button>
      </div>
      <div class="small muted">Der Stand-Link nimmt deine Zahlen mit: Wer ihn öffnet, hat dich
        danach im Vergleich unter Statistik stehen.</div>
      <div class="small muted" style="word-break:break-all">${esc(appURL())}</div>`
      : `<div class="small muted">Diese Fassung läuft als Datei auf deinem Gerät und hat keine
         Adresse zum Weitergeben – schick stattdessen die Datei selbst.</div>`}
      <div class="switch-row" style="margin-top:12px">
        <div>
          <div class="lbl">Dein Name</div>
          <div class="hint">Steht auf der Startseite – und im Vergleich, wenn du deinen
            Stand verschickst.</div>
        </div>
        <input type="text" class="name-input schmal" maxlength="24" value="${esc(s.name || '')}"
               data-act="name-input" aria-label="Dein Name" placeholder="—">
      </div>
    </div>

    <div class="section-title">Ablauf</div>
    <div class="card">
      <div class="switch-row">
        <div>
          <div class="lbl">Supersätze</div>
          <div class="hint">Zwei verträgliche Übungen im Wechsel, statt die Pause abzusitzen:
            A, B, A, B. Gepaart wird nur, was keinen Muskel teilt und nicht dasselbe Gerät
            braucht – dann bleiben beide Aufbauten stehen und es wird nichts umgebaut.
            Die Pause wird dabei nicht kürzer, sondern gefüllt: Wenn eine Übung wieder dran
            ist, wartest du nur noch die Zeit, die seit ihrem letzten Satz fehlt. Unterm
            Strich rund 40 % kürzer bei gleicher Erholung.</div>
        </div>
        <button type="button" class="toggle" aria-pressed="${!!s.supersatz}"
                data-act="toggle-supersatz" aria-label="Supersätze"></button>
      </div>
      <div class="switch-row">
        <div>
          <div class="lbl">Aufwärmsätze anzeigen</div>
          <div class="hint">Über den schweren Übungen steht, womit aufzuwärmen ist – die
            Hälfte und drei Viertel des Arbeitsgewichts, eingerastet auf deine Scheiben.
            Nur bei Grund- und schweren Nebenübungen; ein Seitheben mit 5 kg braucht das
            nicht. Abgehakt wird nichts davon: Aufwärmsätze zählen nicht in die Statistik
            und nicht für den Stufenaufstieg.</div>
        </div>
        <button type="button" class="toggle" aria-pressed="${!!s.aufwaermen}"
                data-act="toggle-aufwaermen" aria-label="Aufwärmsätze anzeigen"></button>
      </div>
      ${s.supersatz ? superVorschau() : ''}
    </div>

    ${vorratKarte()}

    <div class="section-title">Töne und Hinweise</div>
    <div class="card">
      <div class="small muted">Die Töne werden erzeugt, nicht geladen – sie funktionieren also
        auch ohne Netz. Am Ende der Pause vibriert das Handy zusätzlich.</div>
      <div class="switch-row" style="margin-top:10px">
        <div>
          <div class="lbl">Töne</div>
          <div class="hint">Pause vorbei, Training gestartet, Übung fertig, Workout komplett.</div>
        </div>
        <button type="button" class="toggle" aria-pressed="${s.sound}" data-act="toggle-sound" aria-label="Töne"></button>
      </div>
      ${s.sound ? `
      <div class="switch-row">
        <div>
          <div class="lbl">Ton bei jedem Satz</div>
          <div class="hint">Kurzer Tupfer beim Abhaken – der kommt zwanzigmal pro Training.</div>
        </div>
        <button type="button" class="toggle" aria-pressed="${s.soundSets}" data-act="toggle-sound-sets" aria-label="Ton bei jedem Satz"></button>
      </div>` : ''}
      <div class="switch-row">
        <div>
          <div class="lbl">Pause in der Statusleiste</div>
          <div class="hint">Sobald du die App weglegst, zählt die Pause oben in der Leiste
            weiter – mit der Uhrzeit, wann es weitergeht – und meldet sich am Ende.
            Braucht einmal deine Erlaubnis. Zwei Einschränkungen: Friert der Browser die
            Seite ein, bleibt die Zahl stehen (die Uhrzeit stimmt weiter), und ist die App
            ganz geschlossen, kommt gar nichts.${notifyDenied() ? ' <strong>Dein Browser hat Hinweise für diese Seite blockiert</strong> – das lässt sich nur in seinen Einstellungen wieder freigeben.' : ''}</div>
        </div>
        <button type="button" class="toggle" aria-pressed="${s.notify && !notifyDenied()}" data-act="toggle-notify" aria-label="Pause in der Statusleiste" ${notifyDenied() ? 'disabled' : ''}></button>
      </div>
      ${s.sound ? `
      <div class="btn-row">
        <button type="button" class="btn btn-block" data-act="test-sound">Töne anhören</button>
      </div>
      <div class="small muted" id="tonStand"></div>
      <div class="small muted" style="margin-top:6px">Hörst du nichts, obwohl oben
        <b>läuft</b> steht und die Zahl steigt: Dann hat die App den Ton losgeschickt und
        das Handy gibt ihn nicht aus. Der übliche Grund ist die
        <b>Medien-Lautstärke</b> – die Wippe stellt am Handy die Klingel, solange nichts
        spielt. Tipp auf „Töne anhören" und drück <i>währenddessen</i> die Wippe nach
        oben; dann regelst du den richtigen Kanal.</div>` : ''}
    </div>

    <div class="section-title">Erinnerung am Trainingstag</div>
    <div class="card">
      <div class="switch-row">
        <div>
          <div class="lbl">Erinnern, wenn ein Training ansteht</div>
          <div class="hint">Meldung in der Statusleiste an Tagen, an denen eine Einheit
            offen ist – auch wenn die App zu ist. Weggewischt kommt sie zurück; endgültig weg
            ist sie mit <i>Heute nicht</i> oder sobald du die App öffnest.
            ${kannErinnern() ? (kannWecken() ? '' : '<b>In diesem Browser geht das nur über '
              + 'Push</b> – er weckt sich nicht von selbst. Richte es unten ein, sonst bleibt '
              + 'der Schalter wirkungslos.')
              : '<strong>Dieser Browser kann das nicht.</strong> Es braucht Meldungen und einen '
                + 'Service Worker.'}</div>
        </div>
        <button type="button" class="toggle" aria-pressed="${erinnerungAn().an}"
                data-act="toggle-erinnerung" aria-label="Erinnerung am Trainingstag"
                ${kannErinnern() ? '' : 'disabled'}></button>
      </div>
      ${erinnerungAn().an ? `
      <div class="zeit-row">
        <label class="zeit"><span class="lbl">Mo–Fr ab</span>
          <input type="time" value="${esc(erinnerungAn().werktags)}"
                 data-act="erinnerung-zeit" data-wann="werktags"></label>
        <label class="zeit"><span class="lbl">Sa/So ab</span>
          <input type="time" value="${esc(erinnerungAn().wochenende)}"
                 data-act="erinnerung-zeit" data-wann="wochenende"></label>
      </div>
      <div class="small muted" id="weckStand">wird nachgesehen…</div>` : ''}
      <div class="small muted" style="margin-top:8px">${kannWecken()
        ? 'Ohne Push hängt das daran, ob der Browser von selbst aufwacht – und das '
          + 'entscheidet er. Deshalb steht oben, wann es zuletzt geklappt hat.'
        : 'Dieser Browser wacht nicht von selbst auf; hier trägt allein der Push. '
          + 'Er hängt am Browser, nicht am Gerät – wer die App in einem anderen Browser '
          + 'geöffnet hat, muss ihn hier neu einrichten.'}</div>
      <div class="btn-row" style="margin-top:10px">
        <button type="button" class="btn btn-block" data-act="push-einrichten"
                ${kannPush() ? '' : 'disabled'}>Zuverlässig machen (Push einrichten)</button>
      </div>
      <div class="small muted" id="pushStand" style="margin-top:6px"></div>
      ${ui.pushText ? `
      <div class="notice" style="margin-top:10px">
        <strong>Fast fertig – ein Mal einfügen.</strong>
        <div class="small" style="margin-top:6px">${geheimnisURL()
          ? `<a href="${esc(geheimnisURL())}" target="_blank" rel="noopener">Diese Seite bei GitHub
             öffnen</a> – sie ist schon die richtige. Bist du dort nicht angemeldet, kommt erst
             die Anmeldung und danach das Ziel.`
          : 'Auf GitHub im Workout-Repo: <i>Settings → Secrets and variables → Actions → '
            + 'New repository secret</i>.'}
          Name <code>PUSH_KONFIG</code>, und da unten hinein:</div>
        <textarea class="io" readonly style="margin-top:8px;height:120px"
                  id="pushKonfig">${esc(ui.pushText)}</textarea>
        <div class="btn-row">
          <button type="button" class="btn btn-primary" data-act="push-kopieren">Kopieren</button>
          <button type="button" class="btn btn-ghost" data-act="push-fertig">Fertig</button>
        </div>
        <div class="small muted" style="margin-top:8px">Darin steckt der private Schlüssel
          dieses Geräts. Er gehört in das Secret und sonst nirgendwohin – nicht in eine
          Nachricht, nicht in die Zwischenablage von jemand anderem.</div>
      </div>` : ''}
    </div>

    <!-- Hier stand die Plan-Verschiebung: +9 Tage, "Nächste Einheit auf
         heute", ±1 Tag, "Auf Original". Alles raus, auf Ansage: "Das mit dem
         Verschieben will ich echt nirgends sehen. Das soll ganz im Hintergrund
         laufen."

         Und das tut es auch. catchUpPlan() zieht den offenen Plan nach, wenn
         ein Termin verstreicht, und beim Starten eines Trainings rückt die
         Einheit von selbst auf heute, falls ihr Termin noch in der Zukunft lag
         (siehe start-session). Damit gibt es nichts mehr einzustellen – die
         Zahl war eine Rechenschaft über etwas, das die App ohnehin allein
         richtig macht. -->

    <div class="section-title">Plan neu starten</div>
    <div class="card">
      <div class="small muted">Setzt alle abgehakten Sätze zurück und legt Workout 1 auf heute.
        Die erreichten Gewichte bleiben stehen, der bisherige Verlauf wandert in die Ablage
        und bleibt im Export erhalten.${store.getState().rounds.length
          ? ` Bisher ${esc(plural(store.getState().rounds.length, 'Runde', 'Runden'))} abgeschlossen.` : ''}</div>
      <div class="btn-row">
        <button type="button" class="btn" data-act="restart-plan">Von vorn beginnen</button>
        ${store.restorable() ? `
        <button type="button" class="btn" data-act="restore-round">Verlauf zurückholen</button>` : ''}
      </div>
      ${store.restorable() ? `
      <div class="small muted">Zurückholen legt den letzten abgelegten Verlauf wieder auf den
        Plan – für den Fall, dass der Neustart nicht gewollt war. Was du seitdem abgehakt
        hast, bleibt stehen.</div>`
      : (store.getState().rounds.length ? `
      <div class="small muted">In der Ablage liegt ein Verlauf, aber aus einem anderen
        Trainingsfokus. Der kommt beim Wechsel dorthin von selbst zurück – hier passt er
        nicht auf den Plan.</div>` : '')}
    </div>

    <div class="section-title">Kalender</div>
    <div class="card">
      <div class="small muted">Alle Trainingstermine als Kalenderdatei, jeweils um 18 Uhr,
        mit den Übungen des Tages in der Beschreibung.
        <b>Die Google-Kalender-App kann keine Dateien einlesen</b> – das geht nur über die
        Weboberfläche. Am Handy: in Chrome <i>calendar.google.com</i> öffnen, im
        Drei-Punkte-Menü <i>Desktopseite</i> anhaken, dann
        <i>Einstellungen → Importieren und exportieren</i>.</div>
      ${icsStale() ? `<div class="hint" style="color:var(--accent);margin-top:8px">
        Der Plan hat sich seit dem letzten Export um
        ${esc(plural(Math.abs(store.getState().shift - store.getState().lastIcs.shift), 'Tag', 'Tage'))}
        verschoben – Datei neu erzeugen und noch einmal importieren, dann wandern
        die Termine mit.</div>` : ''}
      <div class="btn-row">
        <button type="button" class="btn" data-act="download-ics">Kalenderdatei (.ics)</button>
        <button type="button" class="btn btn-ghost" data-act="ics-aus">Termine austragen</button>
      </div>
      <div class="small muted" style="margin-top:6px">„Termine austragen" erzeugt eine Datei
        aus lauter Absagen. Nach dem Importieren sind alle Workout-Termine aus dem Kalender
        verschwunden – der Plan in der App bleibt, wie er ist.</div>
      <div class="small muted" style="margin-top:8px">
        ${(() => {
          const i = store.getState().lastIcs;
          return i ? `Zuletzt erzeugt am ${esc(fmtDate(i.on))}.`
                   : 'Noch nie erzeugt.';
        })()}
        Jeder Termin behält seine Kennung: ein erneuter Import verschiebt die
        vorhandenen Einträge, statt neue anzulegen.
      </div>
    </div>

    <div class="section-title">Daten</div>
    <div class="card">
      <div class="small muted">Alles liegt lokal im Browser – Android räumt den bei Platzmangel weg.
        ${(() => {
          const b = store.getState().lastBackup;
          if (!b) return 'Noch nie gesichert.';
          return `Zuletzt gesichert am ${esc(fmtDate(b.on))}, nach ${esc(plural(b.done, 'Einheit', 'Einheiten'))}.`;
        })()}</div>
      <div class="small muted" style="margin-top:6px">${store.getState().dauerhaft
        ? 'Der Browser hat zugesagt, diesen Speicher nicht von selbst freizugeben.'
        : '<b>Der Browser hat nichts zugesagt</b> – er darf den Speicher bei Platzmangel '
          + 'räumen. Am Startbildschirm installiert sagt er es meist zu.'}
        Gegen ein verlorenes Handy hilft ohnehin nur eine Kopie woanders.</div>
      <div class="btn-row">
        <button type="button" class="btn btn-primary" data-act="backup-teilen">Sicherung weitergeben</button>
        <button type="button" class="btn" data-act="download">Als Datei sichern</button>
        <button type="button" class="btn" data-act="export">Export anzeigen</button>
      </div>
      <textarea class="io" id="io" placeholder="Hier JSON einfügen und auf „Importieren“ tippen…" style="margin-top:10px"></textarea>
      <div class="btn-row">
        <button type="button" class="btn btn-primary" data-act="import-file">Datei laden</button>
        <button type="button" class="btn" data-act="import">Eingefügten Text laden</button>
      </div>
      <div class="small muted" style="margin-top:8px">Umzug auf ein anderes Gerät oder in die
        installierte App: dort <i>Als Datei sichern</i>, hier <i>Datei laden</i>. Der eingelesene
        Stand ersetzt den bisherigen vollständig.</div>
      <div class="btn-row" style="margin-top:10px">
        <button type="button" class="btn btn-danger" data-act="reset-all">Alle Daten löschen</button>
      </div>
    </div>

    <div class="section-title">Fassung</div>
    <div class="card">
      <div class="small muted" id="appVersion">Zwischenspeicher wird gelesen…</div>
      <div class="btn-row">
        <button type="button" class="btn" data-act="force-update">App aktualisieren</button>
      </div>
      <div class="small muted" style="margin-top:8px">Leert den Zwischenspeicher und lädt
        alles neu. Trainingsdaten bleiben unangetastet – nur die App selbst wird geholt.</div>
    </div>

    <div class="section-title">Über den Plan</div>
    <div class="card small muted">
      ${PLAN.length} Einheiten, ursprünglich vom ${esc(fmtDate(PLAN[0].date, true))} bis ${esc(fmtDate(PLAN[PLAN.length - 1].date, true))},
      aufgebaut auf ${EXERCISES.length} Grundübungen. Zu jeder Hantelübung gehört ein
      Bodyweight-Äquivalent mit gleicher Satzzahl und angepasstem Wiederholungsbereich.
      ${EINZELDATEI ? '' : `
      <div style="margin-top:10px">
        <a class="btn btn-block" href="./figuren.html">Alle Bewegungsbilder ansehen</a>
      </div>
      <div style="margin-top:6px">Alle ${EXERCISES.length} Übungen auf einer Seite, in beiden
        Fassungen nebeneinander – zum Durchsehen, ohne sich durch ${PLAN.length} Einheiten
        zu tippen.</div>`}
    </div>
  `;

  showVersion();
  weckStandZeigen();
  pushStandZeigen();
  tonStandZeigen();
}

/**
 * Was der Ton-Weg gerade tut – im Klartext.
 *
 * *„Aktuell hör ich bei mir in der app überhaupt keine sounds."* Dahinter
 * stecken zwei Ursachen, die von außen gleich aussehen: Die App schickt keinen
 * Ton los, oder sie schickt ihn los und das Gerät gibt ihn nicht aus. Ob eine
 * Seite hörbar ist, kann sie selbst nicht wissen – was sie weiß, ist, ob der
 * Tonkanal offen war und wie viele Töne hinausgingen. Genau das steht hier.
 */
function tonStandZeigen() {
  const host = document.getElementById('tonStand');
  if (!host) return;
  const t = tonStand();
  if (!t.moeglich) { host.textContent = 'Dieser Browser kann keine Töne erzeugen.'; return; }
  const wort = { aus: 'noch nicht angefordert', laeuft: 'läuft', schlaeft: 'angehalten' };
  host.textContent = `Tonkanal: ${wort[t.zustand]} · ${t.gespielt === 1
    ? '1 Ton losgeschickt' : `${t.gespielt} Töne losgeschickt`}, seit die App offen ist.`;
}

/** Steht die Push-Anmeldung? Kurz und ohne Versprechen. */
function pushStandZeigen() {
  const host = document.getElementById('pushStand');
  if (!host) return;
  if (!kannPush()) { host.textContent = 'Dieser Browser kann kein Web Push.'; return; }
  pushStand().then((p) => {
    if (!document.body.contains(host)) return;
    if (!p.angemeldet) {
      host.textContent = 'Noch nicht eingerichtet – ohne das bleibt es beim Vielleicht.';
      return;
    }
    // Der Rest liegt am Handy, und das steht hier, weil es sonst niemand sagt:
    // Android hält Push-Nachrichten für gedrosselte Apps zurück und liefert sie
    // erst beim Entsperren nach. Von außen sieht das aus, als käme die Meldung
    // „erst beim Öffnen der App".
    host.innerHTML = 'Angemeldet. Ob wirklich etwas ankommt, siehst du oben an '
      + '„zuletzt geweckt" – da steht seit Neuestem auch die Uhrzeit.'
      + '<div style="margin-top:6px">Kommt die Meldung erst, wenn du das Handy '
      + 'entsperrst, hält Android sie zurück. Dagegen hilft nur eine Einstellung '
      + 'am Gerät: <i>Einstellungen → Apps → Chrome → Akku</i> auf '
      + '<i>uneingeschränkt</i> (bei Xiaomi/Redmi zusätzlich <i>Autostart</i> '
      + 'erlauben und im Task-Manager das Schloss setzen).</div>';
  });
}

/**
 * Was der Worker beim letzten Weckruf getan hat – im Klartext.
 *
 * Zu jedem Grund aus erinnern() in sw.js ein Satz. Der Unterschied, um den es
 * geht: „gezeigt" heißt, der Weg trägt und die Meldung ist wirklich erschienen;
 * alles andere heißt, der Weckruf kam an und *dieser Code* hat entschieden,
 * nichts zu zeigen – und dann steht hier, warum. Gar keine Zeile heißt: Es kam
 * nichts an, und die Ursache liegt nicht in der App.
 */
const WECK_GRUND = {
  gezeigt: 'Meldung erschienen',
  offen: 'nichts gezeigt – die App war offen',
  schon: 'nichts gezeigt – an dem Tag war schon erinnert worden',
  aus: 'nichts gezeigt – die Erinnerung war aus',
  frueh: 'nichts gezeigt – es war noch vor der eingestellten Uhrzeit',
  'kein-tag': 'nichts gezeigt – es stand nichts an',
};

/**
 * Wann hat der Browser den Service Worker zuletzt geweckt?
 *
 * Die ehrliche Zahl zu dieser Funktion. Ob der Push ankommt und ob periodicsync
 * auf einem bestimmten Handy trägt, lässt sich weder versprechen noch hier
 * nachprüfen – ein Testlauf kann die Ereignisse nicht auslösen. Also steht hier,
 * was wirklich passiert ist, und nicht, was passieren soll.
 *
 * Mit Uhrzeit, nicht nur mit Tag: *„Die push Nachricht kam erst als ich die app
 * geöffnet hab."* Ob der Weckruf um 16 Uhr kam oder um 21 Uhr beim Entsperren,
 * ist genau die Frage – und „heute" beantwortet sie nicht.
 */
function weckStandZeigen() {
  const host = document.getElementById('weckStand');
  if (!host) return;
  liesMerkzettel().then((z) => {
    if (!document.body.contains(host)) return;
    if (!z.geweckt) {
      host.textContent = 'Noch nie geweckt worden – das kann ein paar Tage dauern.';
      return;
    }
    const d = new Date(z.geweckt);
    const tage = Math.floor((Date.now() - z.geweckt) / 86400000);
    const uhr = `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')} Uhr`;
    const wann = tage === 0 ? `heute um ${uhr}`
      : tage === 1 ? `gestern um ${uhr}`
        : `vor ${tage} Tagen, ${uhr}`;
    const art = z.weckArt === 'push' ? 'Push'
      : z.weckArt === 'sync' ? 'der Browser von selbst' : null;
    host.textContent = `Zuletzt geweckt: ${wann}`
      + (art ? ` durch ${art}` : '')
      + (WECK_GRUND[z.weckGrund] ? ` · ${WECK_GRUND[z.weckGrund]}` : '')
      + (z.gemeldet ? ` · zuletzt erinnert am ${fmtDate(z.gemeldet)}` : '');
  });
}

/* ------------------------------------------------------------------ *
 * Rendering / Routing
 * ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ *
 * Die Leiste unten
 *
 * Fünf Reiter waren zwei zu viel: Kalender und Verletzungen ruft man selten und
 * nie mitten im Satz auf, sie standen aber dauerhaft da und haben die wichtigen
 * schmal gemacht. Drei sind der Standard.
 *
 * Welche es sind, steht aber nicht fest – wer jeden zweiten Tag in den Kalender
 * schaut, soll ihn unten haben. Dashboard und Mehr bleiben gesetzt: ohne das
 * eine gibt es kein Training, ohne das andere keinen Weg zurück zu dieser
 * Einstellung. Alles, was nicht unten steht, ist über Mehr erreichbar.
 * ------------------------------------------------------------------ */

const TABS = {
  dashboard: ['🏠', 'Dashboard'],
  stats: ['📈', 'Statistik'],
  calendar: ['📅', 'Kalender'],
  injuries: ['🩹', 'Verletzt'],
  custom: ['🧩', 'Eigenes'],
  settings: ['⚙️', 'Mehr'],
};
const TABS_FIX = ['dashboard', 'settings'];
const TABS_MAX = 5;   // mehr wird auf schmalen Handys zur Briefmarke

/** Reiter in der Leiste, immer in der Reihenfolge von TABS. */
function tabsAktiv() {
  const gewaehlt = new Set(store.getState().tabs || ['stats']);
  return Object.keys(TABS).filter((k) => TABS_FIX.includes(k) || gewaehlt.has(k));
}

function renderTabbar(aktiv) {
  tabbar.innerHTML = tabsAktiv().map((key) => {
    const [icon, label] = TABS[key];
    return `<button type="button" class="tab" id="tab-${key}" data-tab="${key}" role="tab"
              aria-controls="view" aria-selected="${key === aktiv}"><span class="ti">${icon}</span><span>${esc(label)}</span></button>`;
  }).join('');
}

const RENDERERS = {
  dashboard: () => {
    if (needsWelcome()) { renderWelcome(); return; }
    const sess = store.getState().session;
    if (ui.focus && sess && sess.n === ui.workoutNo) renderFocus();
    else if (ui.listView) renderDashboard();
    else renderOverview();
  },
  calendar: renderCalendar,
  custom: renderCustom,
  admin: renderAdmin,
  stats: renderStats,
  injuries: renderInjuries,
  settings: renderSettings,
};

/**
 * Kennung eines bedienbaren Elements, die einen Neuaufbau übersteht.
 *
 * Die Ansicht wird bei jedem abgehakten Satz komplett neu geschrieben – der
 * Tastaturfokus landete danach wieder ganz oben, und wer mit Screenreader oder
 * Tastatur arbeitet, musste sich jedes Mal neu durchhangeln. Über die
 * data-Attribute lässt sich dasselbe Element hinterher wiederfinden; sie
 * beschreiben ohnehin schon, was der Knopf tut.
 */
function focusKey(el) {
  if (!el || !view.contains(el)) return null;
  const d = el.dataset || {};
  return [el.tagName, el.id, d.act, d.ex, d.i, d.tab, d.iso, d.n, d.d, d.delta, d.v]
    .map((x) => x || '').join('|');
}

function restoreFocus(key) {
  if (!key) return;
  const hit = [...view.querySelectorAll('button, input, select, textarea, [tabindex]')]
    .find((el) => focusKey(el) === key);
  // preventScroll: sonst springt die Seite beim Abhaken zum Knopf zurück.
  if (hit) hit.focus({ preventScroll: true });
}

function render() {
  const mode = ui.tab === 'dashboard' ? store.workoutMode(ui.workoutNo) : store.getState().mode;
  document.body.classList.toggle('mode-bw', mode === 'bw');
  document.documentElement.dataset.theme = store.getState().theme || 'orange';
  // Seiten ohne eigenen Reiter liegen unter Mehr – dessen Reiter bleibt
  // markiert, solange man dort ist.
  const reiter = tabsAktiv().includes(ui.tab) ? ui.tab : 'settings';
  renderTabbar(reiter);
  view.setAttribute('aria-labelledby', `tab-${reiter}`);
  const hatte = focusKey(document.activeElement);
  clearFigures(); // alte Animationen abmelden, bevor das DOM ersetzt wird
  (RENDERERS[ui.tab] || renderDashboard)();
  restoreFocus(hatte);
  syncHistory();
}

function go(tab) {
  ui.tab = tab;
  store.setSetting('tab', tab);
  render();
  window.scrollTo({ top: 0 });
}

/* ------------------------------------------------------------------ *
 * Zurück-Taste
 *
 * Auf Android verlässt die Zurück-Taste sonst gleich die ganze App, auch aus
 * der Fokus-Ansicht heraus. Statt jeden Knopf einzeln anzufassen, vergleicht
 * render() die sichtbare Ebene mit der zuletzt abgelegten – ändert sie sich,
 * kommt ein Eintrag in den Verlauf. Ein Satz abhaken ändert die Ebene nicht
 * und legt deshalb auch nichts ab.
 * ------------------------------------------------------------------ */

const levelOf = () => `${ui.tab}|${ui.listView ? 1 : 0}|${ui.focus ? 1 : 0}`;
let lastLevel = levelOf();
let goingBack = false;

function syncHistory() {
  const now = levelOf();
  if (goingBack || now === lastLevel) return;
  lastLevel = now;
  history.pushState({ tab: ui.tab, listView: ui.listView, focus: ui.focus }, '');
}

// Der Link kommt an, während die App schon offen ist: Dann lädt der Browser
// nichts neu, er ändert nur den Anker. Ohne diese Zeile passiert dabei nichts.
window.addEventListener('hashchange', () => {
  const stand = standAusAdresse();
  if (!stand) return;
  ui.standAngebot = stand;
  go('dashboard');
});

window.addEventListener('popstate', (e) => {
  const st = e.state || { tab: 'dashboard', listView: false, focus: false };
  goingBack = true;
  ui.tab = st.tab || 'dashboard';
  ui.listView = !!st.listView;
  ui.focus = !!st.focus;
  lastLevel = levelOf();
  render();
  goingBack = false;
});

/* ------------------------------------------------------------------ *
 * Events
 * ------------------------------------------------------------------ */

tabbar.addEventListener('click', (e) => {
  const btn = e.target.closest('.tab');
  if (btn) go(btn.dataset.tab);
});

view.addEventListener('click', (e) => {
  const t = e.target.closest('[data-act]');
  if (!t) return;
  const act = t.dataset.act;
  const n = ui.workoutNo;
  const mode = store.workoutMode(n);

  switch (act) {
    case 'toggle-injury': {
      const id = t.dataset.inj;
      const on = t.getAttribute('aria-pressed') !== 'true';
      store.toggleInjury(id, on);
      render();
      toast(on ? `🩹 ${injuryById(id).name} angehakt` : `✓ ${injuryById(id).name} entfernt`);
      break;
    }
    case 'toggle-injury-open': {
      const id = t.dataset.inj;
      if (ui.openInjury.has(id)) ui.openInjury.delete(id); else ui.openInjury.add(id);
      render();
      break;
    }
    case 'clear-injuries': {
      store.clearInjuries();
      render();
      toast('Alle Haken entfernt');
      break;
    }
    case 'go-injuries':
      go('injuries');
      break;
    case 'go-tab':
      go(t.dataset.tab);
      break;
    case 'cal-month':
      ui.calMonth = addMonths(calMonthNow(), Number(t.dataset.d));
      render();
      break;
    case 'cal-today':
      ui.calMonth = monthStart(todayISO());
      render();
      break;
    case 'cal-day':
      // Nochmal antippen macht die Auswahl wieder auf – sonst gäbe es keinen
      // Weg zurück zur reinen Monatsübersicht.
      ui.calDay = ui.calDay === t.dataset.iso ? null : t.dataset.iso;
      render();
      break;
    case 'cal-open':
      ui.workoutNo = Number(t.dataset.n);
      ui.focus = false;
      ui.listView = false;
      go('dashboard');
      break;
    case 'toggle-ex': {
      const id = t.dataset.ex;
      if (ui.openEx.has(id)) ui.openEx.delete(id); else ui.openEx.add(id);
      render();
      break;
    }
    case 'toggle-set': {
      const id = t.dataset.ex;
      const i = Number(t.dataset.i);
      const item = workoutByNo(n, mode).ex.find((x) => x.id === id);
      const cur = store.getSets(n, mode, id, item.sets)[i].done;
      const variant = resolve(item, mode);
      initAudio(); // Berührung nutzen, solange der Browser Ton noch erlaubt

      // Beim Abhaken das benutzte Gewicht mitschreiben – daraus speist sich
      // später der Vergleich "Zuletzt" und die Volumenrechnung.
      const patch = { done: !cur };
      if (!cur && variant.weight !== null) patch.w = fmtNum(workingWeight(id));
      else if (cur) patch.w = '';
      store.updateSet(n, mode, id, item.sets, i, patch);

      const done = !cur;
      const workoutComplete = done && progressOf(n, mode).complete;
      // Festhalten, dass dieser Tag trainiert wurde – nicht nur, dass alle
      // Häkchen stehen. Der Unterschied fällt erst später auf: „Alle Häkchen"
      // wird gegen die *heutige* Satzzahl gerechnet, und die hängt an der
      // Erfahrungsstufe. Wer von Anfänger auf Geübt wechselt, hätte sonst
      // rückwirkend aus 10/10 ein 10/15 gemacht und eine fertige Einheit in
      // eine halbe verwandelt – samt Serie, Statistik und Rundenzählung.
      if (workoutComplete) store.markDone(n, mode);

      // Der letzte Satz beendet das Training. „Wenn man den letzten Satz
      // abgehakt hat soll das training automatisch zuende sein ohne dass man
      // das nochmal extra drücken muss." Stimmt: Der Knopf „Abschließen"
      // trägt, wenn ohnehin alles steht, keine Entscheidung mehr – er ist eine
      // Quittung für etwas, das man gerade selbst getan hat.
      //
      // Was er sonst noch auslöst, passiert deshalb hier mit: Uhr anhalten,
      // Stand melden, Aufstieg und Zusatztag prüfen. Sonst wäre „automatisch
      // beendet" nur halb beendet.
      if (workoutComplete && store.getState().session) {
        store.endSession();
        meldeStand(true);
        ui.focus = false;
        ui.listView = false;
        if (store.getState().rest) endRest(false);
        const gestiegen = pruefeAufstieg();
        const zusatz = pruefeZusatztag();
        if (zusatz) ui.workoutNo = naechsteEinheit();
        sound('done');
        render();
        toast(gestiegen ? 'Neue Stufe – siehe oben ⬆️'
          : `Training abgeschlossen – alle ${progressOf(n, mode).total} Sätze 🎉`);
        break;
      }
      const exDone = done && i === item.sets - 1
        && store.getSets(n, mode, id, item.sets).slice(0, item.sets).every((s) => s.done);

      // Wann diese Übung zuletzt dran war – daraus rechnet der Supersatz die
      // Wartezeit. Nur beim Setzen, nicht beim Wegnehmen: Ein zurückgenommener
      // Haken macht die verstrichene Zeit nicht ungeschehen.
      if (done) satzUhr.set(id, Date.now());

      // Im Supersatz entscheidet der Wechsel, wohin es geht und wie lange
      // gewartet wird – beides hängt am Partner. Übernimmt er, ist hier Schluss.
      const imWechsel = done && !workoutComplete && superWeiter(n, mode, id);

      if (!imWechsel) {
        // In der Fokus-Ansicht sofort zur nächsten offenen Übung rücken. Bis
        // hierher wartete der Sprung auf die Antwort zu "Wie war das?" – die
        // Frage gibt es nicht mehr, also gibt es auch nichts mehr abzuwarten.
        if (ui.focus && exDone && !workoutComplete) weiterZurNaechsten(n, mode);
      }
      render();
      // Pause nur nach einem gesetzten Haken und nie nach dem letzten Satz
      // einer Übung – und auch nicht, wenn das Workout damit fertig ist.
      if (imWechsel) {
        // schon erledigt
      } else if (done && !workoutComplete && i < item.sets - 1) {
        startRest(variant.name, i, item.sets, restFor(variant));
      } else if (store.getState().rest) {
        endRest(false);
      }
      // Der größte Anlass gewinnt: Workout fertig schlägt Übung fertig schlägt
      // einzelnen Satz. Ein Haken, der wieder weggeht, bleibt still.
      if (done) sound(workoutComplete ? 'done' : (exDone ? 'exercise' : 'set'));
      if (workoutComplete) toast('Workout abgeschlossen 🎉');
      break;
    }
    case 'reps-step': {
      // Bodyweight: die Steigerung sind die Wiederholungen, nicht die Kilo.
      store.addBwPlus(t.dataset.ex, Number(t.dataset.d));
      render();
      break;
    }
    case 'weight-step': {
      const id = t.dataset.ex;
      const kg = store.setWeight(id, naechstesGewicht(id, Number(t.dataset.dir)));
      render();
      // Steht heute schon ein Satz, gilt die Änderung erst beim nächsten Mal.
      const started = (store.peekSets(n, mode, id) || []).some((s) => s.done);
      toast(started ? `Ab dem nächsten Satz ${fmtNum(kg)} kg` : `${fmtNum(kg)} kg`);
      break;
    }
    case 'steigern': {
      // Genau das, was 'weight-step' tut, und kein ruestCache.clear() dabei:
      // ruestOrderStabil() hält die Reihenfolge einer begonnenen Einheit
      // ausdrücklich fest, damit die Karten beim Ändern eines Gewichts nicht
      // unter dem Finger springen. Ein Aufstieg ist kein Grund, das zu brechen.
      const id = t.dataset.ex;
      const kg = store.setWeight(id, naechstesGewicht(id, 1));
      // Ein früheres Nein für diese Übung ist erledigt – nicht wegen des
      // Speichers, sondern damit die Sicherungsdatei lesbar bleibt: ein
      // steigerungNein mit zwanzig längst gestiegenen Übungen sieht aus wie
      // ein Fehler.
      const nein = { ...(store.getState().steigerungNein || {}) };
      delete nein[id];
      store.setSetting('steigerungNein', nein);
      render();
      // toast() schreibt textContent – esc() wäre hier falsch und zeigte Entities.
      toast(`${t.dataset.name || 'Gewicht'}: ab jetzt ${fmtNum(kg)} kg`);
      break;
    }
    case 'steigern-nein': {
      const id = t.dataset.ex;
      const kg = workingWeight(id);
      store.setSetting('steigerungNein', {
        ...(store.getState().steigerungNein || {}), [id]: kg,
      });
      render();
      toast(`${t.dataset.name || 'Gewicht'} bleibt bei ${fmtNum(kg)} kg`
        + ' – kommt erst wieder, wenn du das Gewicht änderst');
      break;
    }
    case 'restart-plan': {
      // Runde 1 wandert in die Ablage, die Gewichte bleiben. Workout 1 rückt
      // auf heute, sonst würde die Nachrück-Automatik den halben Plan
      // verschieben, weil das Originaldatum längst vorbei ist.
      // Auch nach vorn: Liegt der Excel-Termin in der Zukunft, fängt die neue
      // Runde trotzdem heute an und nicht irgendwann.
      const target = daysBetween(PLAN[0].date, todayISO());
      store.restartPlan(target, rundenBilanz());
      ui.workoutNo = PLAN[0].n;
      ui.focus = false;
      ui.listView = false;
      ui.openEx.clear();
      render();
      toast('Neue Runde – viel Erfolg 💪');
      break;
    }
    case 'restore-round': {
      const ok = store.restoreRound();
      // Der Verlauf steht wieder auf dem Plan; die Termine richten sich danach,
      // also gleich zur Startansicht zurück.
      ui.focus = false;
      ui.listView = false;
      render();
      toast(ok ? 'Verlauf ist zurück' : 'Da liegt nichts in der Ablage');
      if (ok) meldeStand(true);
      break;
    }
    case 'backup-now':
      downloadBackup();
      render();
      break;
    case 'backup-teilen':
      teileBackup();
      break;
    case 'start-session':
      if (!workoutByNo(n).ex.length) {
        toast('Heute fällt alles weg – nichts zu starten');
        break;
      }
      // Die Variante wird vor dem Starten gewählt, nicht während des Trainings:
      // ein Umschalter zwischen zwei Sätzen ist nur eine Falle.
      if (t.dataset.mode) store.setWorkoutMode(n, t.dataset.mode);
      // Liegt der Termin dieser Einheit noch in der Zukunft, rückt der Plan
      // jetzt vor – ungefragt und ohne Anzeige. Dafür gab es früher einen
      // Knopf ("Heute anfangen – Plan 3 Tage vorziehen"); der ist raus, weil
      // niemand eine Verschiebung einstellen will, die sich von selbst ergibt.
      // Nach hinten macht catchUpPlan() dasselbe, wenn ein Termin verstreicht.
      if (firstOpen().n === n && daysBetween(todayISO(), effDate(workoutByNo(n))) > 0) {
        store.setShift(shiftToToday());
      }
      initAudio(); // Ton jetzt freischalten, damit das erste Pausensignal sitzt
      sound('start');
      store.startSession(n);
      ui.focus = true;
      ui.listView = false;
      ui.focusIdx = firstOpenExercise(n, mode);
      render();
      toast('Los geht’s 💪');
      break;
    case 'finish-session': {
      const prog = progressOf(n, mode);
      // Abgehakt ist abgehakt: Wer hier tippt, ist fertig – der Tag zählt als
      // trainiert, auch wenn nicht jeder Satz steht. Ohne einen einzigen Satz
      // wäre das allerdings gelogen.
      if (prog.done) store.markDone(n, mode);
      store.endSession();
      meldeStand(true);
      ui.focus = false;
      ui.listView = false;
      if (store.getState().rest) endRest(false);
      sound(prog.complete ? 'done' : 'stop');
      // Erst nach markDone: Die Einheit, die gerade fertig geworden ist, soll
      // mitzählen. Sonst käme der Aufstieg immer eine Einheit zu spät.
      const gestiegen = pruefeAufstieg();
      // Nach der letzten Einheit einer Woche entscheidet sich, ob etwas
      // liegen geblieben ist – also hier und nicht erst beim nächsten Start.
      const zusatz = pruefeZusatztag();
      render();
      if (gestiegen) toast('Neue Stufe – siehe oben ⬆️');
      // Der Zusatztag meldet sich nicht mehr: Er *ist* die nächste Einheit,
      // und die steht nach diesem render() ohnehin auf dem Bildschirm.
      else if (zusatz) ui.workoutNo = naechsteEinheit();
      else toast(prog.complete
        ? `Training abgeschlossen – alle ${prog.total} Sätze 🎉`
        : `Gespeichert · ${prog.done}/${prog.total} Sätze`);
      break;
    }
    case 'discard-session': {
      const prog = progressOf(n, mode);
      // Verwerfen löscht alles zu diesem Workout in dieser Variante, nicht nur
      // die Sätze von heute – deshalb steht die Zahl in der Rückfrage.
      const ok = !prog.done || confirm(
        `Training abbrechen und ${prog.done} abgehakte ${prog.done === 1 ? 'Satz' : 'Sätze'} verwerfen?`,
      );
      if (!ok) break;
      store.resetWorkout(n, mode);
      store.endSession();
      ui.focus = false;
      ui.listView = false;
      if (store.getState().rest) endRest(false);
      sound('stop');
      render();
      toast('Training abgebrochen – nichts gespeichert');
      break;
    }
    case 'focus-list':
      ui.focus = false;
      ui.listView = true;
      render();
      break;
    case 'show-list':
      ui.listView = true;
      render();
      break;
    case 'focus-back': // aus der Liste zurück in die laufende Übung
      ui.focus = true;
      ui.listView = false;
      render();
      break;
    case 'hide-list':
      ui.listView = false;
      render();
      break;
    case 'set-band': {
      const id = t.dataset.ex;
      // Kein Abwählen mehr: Die Bandwahl ist eine Stufe wie ein Gewicht, und
      // eine Bandübung ohne Band gibt es nicht. Gelb ist der Anfang.
      // Kein Abwählen mehr: Eine Bandübung ohne Band gibt es nicht.
      store.setBand(id, t.dataset.v);
      sound('set');
      render();
      break;
    }
    case 'toggle-care':
      store.toggleCare(n, t.dataset.key);
      sound('set');
      render();
      break;
    case 'toggle-detail': {
      const id = t.dataset.ex;
      if (ui.openDetail.has(id)) ui.openDetail.delete(id); else ui.openDetail.add(id);
      render();
      break;
    }
    case 'focus-goto':
      ui.focusIdx = Number(t.dataset.i);
      render();
      break;
    case 'focus-step':
      ui.focusIdx = Math.max(0, Math.min(workoutByNo(n).ex.length - 1, ui.focusIdx + Number(t.dataset.d)));
      render();
      break;
    case 'complete-workout':
      // Das benutzte Gewicht muss mit: Ohne es fehlen die Sätze in der
      // Verlaufskurve, und die Steigerungsserie bricht ab, weil sie das
      // Gewicht der letzten Einheit nicht wiederfindet. Beim einzelnen
      // Abhaken schreibt toggle-set es längst mit.
      store.completeWorkout(n, mode, workoutByNo(n, mode).ex.map((x) => {
        const v = resolve(x, mode);
        return { ...x, w: v.weight === null ? '' : fmtNum(workingWeight(x.id)) };
      }));
      if (store.getState().rest) endRest(false);
      sound('done');
      render();
      toast('Alle Sätze abgehakt 🎉');
      break;
    case 'reset-workout':
      if (!hasAnyEntry(n, mode) || confirm(`Workout ${n} (${MODE_LABEL[mode]}) wirklich zurücksetzen?`)) {
        store.resetWorkout(n, mode);
        if (store.getState().rest) endRest(false);
        render();
        toast('Zurückgesetzt');
      }
      break;
    case 'custom-new':
      ui.customDraft = { id: null, name: '', ex: [] };
      render();
      break;
    case 'custom-edit': {
      const c = store.customById(t.dataset.id);
      if (c) ui.customDraft = { id: c.id, name: c.name, ex: c.ex.map((x) => ({ ...x })) };
      render();
      break;
    }
    case 'custom-cancel':
      ui.customDraft = null;
      render();
      break;
    case 'custom-add': {
      const id = t.dataset.ex;
      const d = ui.customDraft;
      if (!d) break;
      const i = d.ex.findIndex((x) => x.id === id);
      // Nochmal antippen nimmt sie wieder heraus – dieselbe Kachel, beide Wege.
      if (i >= 0) d.ex.splice(i, 1);
      else d.ex.push({ id, sets: 3 });
      sound('set');
      render();
      break;
    }
    case 'custom-sets': {
      const d = ui.customDraft;
      const x = d && d.ex[Number(t.dataset.i)];
      if (!x) break;
      x.sets = Math.max(1, Math.min(9, x.sets + Number(t.dataset.d)));
      render();
      break;
    }
    case 'custom-remove': {
      const d = ui.customDraft;
      if (d) d.ex.splice(Number(t.dataset.i), 1);
      render();
      break;
    }
    case 'custom-save': {
      const d = ui.customDraft;
      if (!d || !d.ex.length) break;
      const id = store.saveCustom(d);
      ui.customDraft = null;
      ui.workoutNo = id;
      ui.listView = false;
      ui.focus = false;
      go('dashboard');
      toast('Gespeichert – los geht’s');
      break;
    }
    case 'custom-start':
      ui.workoutNo = t.dataset.id;
      ui.listView = false;
      ui.focus = false;
      go('dashboard');
      break;
    case 'custom-del': {
      const c = store.customById(t.dataset.id);
      if (!c || !confirm(`„${c.name}" löschen? Die abgehakten Sätze gehen mit.`)) break;
      store.removeCustom(c.id);
      if (ui.workoutNo === c.id) ui.workoutNo = defaultWorkoutNo();
      render();
      toast('Gelöscht');
      break;
    }
    case 'mark-done':
      // Für den Tag, an dem man abgehakt, aber nicht abgeschlossen hat – und für
      // den, an dem drei Sätze fehlten und man trotzdem trainiert hat.
      if (!progressOf(n, mode).done) {
        toast('Ohne einen abgehakten Satz gibt es nichts zu markieren');
        break;
      }
      store.markDone(n, mode);
      sound('done');
      render();
      toast('Als trainiert eingetragen – steht jetzt so im Kalender');
      break;
    case 'back-to-plan':
      // Ausdrücklich der Plan, nicht die „nächste Einheit": Die wäre wieder der
      // Zusatztag, und der Knopf führte im Kreis. Wer hier tippt, will genau
      // von ihm weg.
      ui.workoutNo = defaultWorkoutNo();
      ui.listView = false;
      render();
      break;
    case 'nav-workout': {
      if (istCustom(n)) break;
      const next = n + Number(t.dataset.delta);
      if (PLAN.some((w) => w.n === next)) {
        ui.workoutNo = next;
        ui.openEx.clear();
        ui.listView = false;
        render();
      }
      break;
    }
    case 'nav-today':
      ui.workoutNo = naechsteEinheit();
      ui.openEx.clear();
      ui.listView = false;
      render();
      break;
    case 'open-workout':
      ui.workoutNo = Number(t.dataset.n);
      ui.openEx.clear();
      ui.listView = false;
      go('dashboard');
      break;
    case 'set-modus': {
      const neu = t.dataset.v === 'bw' ? 'bw' : 'db';
      store.setMode(neu);
      // Und die Einheit, die gerade ansteht, gleich mit – sofern sie noch nicht
      // angefangen ist. Ein Umschalter, der nur „ab dem nächsten Mal" wirkt,
      // während vorn unverändert die alte Variante steht, sähe kaputt aus. Was
      // schon läuft, bleibt dagegen, wie es ist.
      const offen = ui.workoutNo;
      if (!store.isStarted(offen)) store.setWorkoutMode(offen, neu);
      render();
      break;
    }
    case 'set-rest':
      initAudio();
      store.setSetting('restSeconds', Number(t.dataset.sec));
      render();
      break;
    case 'ics-aus':
      downloadICSAus();
      render();
      break;
    case 'setup-next':
      setupWeiter();
      break;
    case 'setup-back':
      ui.setupStep = Math.max(0, (ui.setupStep || 0) - 1);
      render();
      break;
    case 'welcome-go':
      willkommenFertig();
      break;
    case 'set-focus': {
      const key = t.dataset.v;
      if (!PLANS[key] || key === (store.getState().focus || 'standard')) break;
      // Im Einstieg ist noch nichts protokolliert – da ist der Wechsel eine
      // Auswahl. Später hängt an ihm ein Verlauf: Die Einheiten eines anderen
      // Fokus stehen an denselben Nummern, aber mit anderen Übungen. Er wird
      // deshalb nicht übernommen, sondern zur Seite gelegt und beim nächsten
      // Wechsel zurückgeholt.
      const laeuft = Object.keys(store.getState().log).length && store.getState().greeted;
      // Keine Rückfrage mehr: Der Wechsel nimmt nichts weg. Der Verlauf des
      // alten Fokus wartet, der des neuen kommt zurück – siehe wechsleFokus().
      store.wechsleFokus(key, laeuft ? rundenBilanz() : null, frischerStart());
      // Der Plan steckt beim Laden in Hunderten von Zeilen; ein Wechsel mitten
      // im Betrieb hieße, dass die halbe App noch mit dem alten rechnet.
      if (store.getState().greeted) location.reload();
      else render();
      break;
    }
    case 'accept-stand': {
      const stand = ui.standAngebot;
      if (!stand) break;
      store.setFriend(freundId(stand.n), stand);
      ui.standAngebot = null;
      ui.standZurueck = stand.n;   // Vorschlag: eigenen Stand zurückschicken
      go('stats');
      toast(`${stand.n} steht jetzt im Vergleich`);
      break;
    }
    case 'drop-zurueck':
      ui.standZurueck = null;
      render();
      break;
    case 'drop-stand':
      ui.standAngebot = null;
      render();
      break;
    case 'share-stand': {
      ui.standZurueck = null;
      const url = standLink();
      const text = `Mein Stand: ${meinStand().w} Einheiten. Öffne den Link, dann stehe ich in `
        + 'deinem Vergleich – und schick mir deinen zurück.';
      if (navigator.share) navigator.share({ title: 'Workout', text, url }).catch(() => {});
      else linkKopieren(url);
      break;
    }
    case 'remove-friend':
      store.removeFriend(t.dataset.id);
      render();
      toast('Aus dem Vergleich entfernt');
      break;
    case 'share-link': {
      store.setSetting('shareCount', (store.getState().shareCount || 0) + 1);
      const url = appURL();
      if (navigator.share) {
        // Der Systemdialog braucht die Berührung, in der wir gerade stecken –
        // deshalb hier und nicht nach einem await.
        navigator.share({ title: 'Workout', text: SHARE_TEXT, url })
          .catch(() => {});   // Abbrechen ist kein Fehler
      } else {
        linkKopieren(url);
      }
      break;
    }
    case 'share-whatsapp':
      store.setSetting('shareCount', (store.getState().shareCount || 0) + 1);
      window.open(`https://wa.me/?text=${encodeURIComponent(`${SHARE_TEXT} ${appURL()}`)}`,
        '_blank', 'noopener');
      break;
    case 'copy-link':
      linkKopieren(appURL());
      break;
    case 'admin-open':
      adminOeffnen();
      break;
    case 'admin-reload':
      adminOeffnen(adminPassLesen());
      break;
    case 'admin-logout':
      adminPassMerken(null);
      ui.adminDaten = null;
      ui.adminFehler = '';
      render();
      break;
    case 'toggle-share': {
      const an = store.getState().share === false;
      store.setSetting('share', an);
      render();
      if (an) {
        meldeStand(true);
        toast('Wird ab jetzt geteilt');
      } else {
        toast('Abgeschaltet – es geht nichts mehr raus');
      }
      break;
    }
    case 'share-now':
      // Von Hand anstoßen, ohne auf den nächsten Tag zu warten – und die
      // Antwort des Servers gleich sichtbar machen.
      if (!meldetMit()) { toast('Ist abgeschaltet'); break; }
      if (!store.getState().deviceId) store.setSetting('deviceId', geraeteId(null));
      melden(standZeile()).then(({ ok, msg }) => {
        store.setSetting('lastShare', { on: todayISO(), ok, msg: ok ? '' : msg });
        if (ui.tab === 'settings') render();
        toast(ok ? 'Gemeldet' : msg || 'Hat nicht geklappt');
      });
      break;
    case 'share-delete': {
      const id = store.getState().deviceId;
      // Erst abschalten, dann löschen: Sonst könnte eine noch laufende Meldung
      // die Zeile gleich wieder hinschreiben.
      store.setSetting('share', false);
      loeschen(id).then(({ ok, zeilen, msg }) => {
        if (!ok) toast(msg || 'Hat nicht geklappt – später nochmal');
        else toast(zeilen === 0 ? 'Da lag nichts – jetzt ist es auch abgeschaltet' : 'Gelöscht');
      });
      render();
      break;
    }
    case 'toggle-tab': {
      const key = t.dataset.v;
      const drin = new Set(store.getState().tabs || ['stats']);
      if (drin.has(key)) drin.delete(key);
      else if (tabsAktiv().length < TABS_MAX) drin.add(key);
      store.setSetting('tabs', [...drin]);
      render();
      break;
    }
    case 'set-level': {
      /*
       * Die Selbsteinschätzung bei der Einrichtung – die einzige Stelle, an der
       * die Stufe noch von Hand gesetzt wird.
       *
       * **Hier stand ein Fehler mit Folgen.** Vorher wurde der nächste Aufstieg
       * bei jeder Wahl gleich als „schon dagewesen" gebucht, damit eine bewusste
       * Rückstufung nicht beim nächsten Laden wieder überschrieben wird. Nur:
       * Dieselbe Aktion bediente die Einrichtung. Wer dort „Anfänger" antippte,
       * verbrauchte im selben Moment den einzigen Aufstieg, den es für ihn gibt
       * – die App hätte ihn nie hochgestuft, egal wie lange er trainiert.
       *
       *     „Wenn die App mich bisher noch nicht hochgestuft hat, bin ich ja
       *      anscheinend noch Anfänger."
       *
       * Die Buchung ist weg, und sie wird auch nicht mehr gebraucht: Seit die
       * Stufe unter Mehr nicht mehr einstellbar ist, gibt es keine spätere
       * Rückstufung, die sich gegen die Messung stellen könnte. Wer bei der
       * Einrichtung wählt, hat noch nichts trainiert – die Schwellen sind dann
       * ohnehin nicht erreicht. Bestehende Stände heilt load() in js/store.js.
       */
      store.setSetting('level', t.dataset.v);
      store.setSetting('aufstieg', null);
      render();
      toast('Startgewichte umgerechnet – eingestellte Gewichte bleiben');
      break;
    }
    case 'aufstieg-ok':
      store.setSetting('aufstieg', null);
      render();
      break;
    case 'umzug-ok':
      store.setSetting('fokusUmzug', null);
      render();
      break;
    case 'umzug-waehlen':
      // Der Nachfolger ist eine Annahme, keine Entscheidung – wer sie nicht
      // teilt, kommt hier direkt zur Auswahl statt sie in einer langen
      // Einstellungsseite zu suchen.
      store.setSetting('fokusUmzug', null);
      ui.tab = 'settings';
      render();
      document.getElementById('fokus-wahl')?.scrollIntoView({ block: 'start' });
      break;
    case 'set-theme':
      store.setSetting('theme', t.dataset.v);
      render();
      break;
    case 'toggle-sound': {
      initAudio();
      const on = !store.getState().sound;
      store.setSetting('sound', on);
      armRest(); // eine laufende Pause folgt der neuen Einstellung
      render();
      if (on) playSound('rest');
      break;
    }
    case 'toggle-sound-sets': {
      initAudio();
      const on = !store.getState().soundSets;
      store.setSetting('soundSets', on);
      render();
      if (on) playSound('set');
      break;
    }
    case 'push-einrichten':
      pushEinrichten()
        .then((r) => { ui.pushText = r.text; render(); })
        .catch((e) => toast(e && e.message ? e.message : 'Hat nicht geklappt.'));
      break;
    case 'push-kopieren': {
      const feld = document.getElementById('pushKonfig');
      if (feld) {
        feld.select();
        navigator.clipboard.writeText(feld.value)
          .then(() => toast('Kopiert – jetzt bei GitHub als PUSH_KONFIG einfügen.'))
          .catch(() => toast('Kopieren ging nicht – von Hand markieren.'));
      }
      break;
    }
    case 'push-fertig':
      ui.pushText = '';
      render();
      break;
    case 'toggle-erinnerung': {
      const e = erinnerungAn();
      store.setSetting('erinnerung', { ...e, an: !e.an });
      erinnerungPflegen();
      render();
      break;
    }
    case 'toggle-supersatz':
      store.setSetting('supersatz', !store.getState().supersatz);
      render();
      break;
    case 'muster-vorne': {
      const jetzt = vorneUm(t.dataset.ex);
      ruestCache.clear();   // die Reihenfolge ist gemerkt und gilt nicht mehr
      toast(jetzt ? 'Steht ab jetzt am Anfang der Einheit' : 'Wieder an ihrem Platz im Plan');
      render();
      break;
    }
    case 'toggle-aufwaermen':
      store.setSetting('aufwaermen', !store.getState().aufwaermen);
      render();
      break;
    case 'vorrat-seite':
      ui.vorratSeite = t.dataset.v === 'bw' ? 'bw' : 'db';
      render();
      break;
    case 'toggle-vorrat': {
      const id = t.dataset.v;
      const da = fehlt().includes(id);
      setzeVorrat(id, da);
      // Die Rüst-Reihenfolge hängt an den Übungen der Einheit, und die ändern
      // sich hier gerade. Wie beim Verletzungsfilter also verwerfen, sonst
      // stünde die Reihenfolge einer Einheit da, die es so nicht mehr gibt.
      ruestCache.clear();
      render();
      toast(da ? 'Wieder dabei' : 'Fällt aus dem Plan');
      break;
    }
    case 'scheiben-plus': {
      // Eine leere Zeile wäre nach normSatz() sofort wieder weg (0 kg zählt
      // nicht). Deshalb kommt eine Größe dazu, die es noch nicht gibt.
      scheibenAendern((s) => {
        const da = new Set(s.scheiben.map(([kg]) => kg));
        const vorschlag = [1.25, 2.5, 5, 0.5, 10, 15, 20, 25].find((kg) => !da.has(kg));
        if (vorschlag) s.scheiben.push([vorschlag, 4]);
      });
      render();
      break;
    }
    case 'scheiben-weg': {
      scheibenAendern((s) => { s.scheiben.splice(Number(t.dataset.i), 1); });
      render();
      break;
    }
    case 'toggle-notify': {
      // Die Erlaubnis holt der Browser nur aus einer Berührung heraus – also
      // genau hier. Angeschaltet gilt der Schalter erst, wenn sie da ist.
      if (!('Notification' in window)) {
        toast('Dieser Browser kennt keine Hinweise');
        break;
      }
      if (store.getState().notify) {
        store.setSetting('notify', false);
        dropNote();
        render();
        break;
      }
      Notification.requestPermission().then((erlaubnis) => {
        store.setSetting('notify', erlaubnis === 'granted');
        armRest();
        render();
        toast(erlaubnis === 'granted'
          ? 'Hinweis kommt auch im Hintergrund'
          : 'Ohne Erlaubnis geht das nicht');
      }).catch(() => {});
      break;
    }
    case 'test-sound': {
      // Der Reihe nach, damit man hört, was wofür steht.
      initAudio();
      ['start', 'set', 'exercise', 'ready', 'rest', 'done']
        .forEach((name, i) => setTimeout(() => playSound(name), i * 900));
      // Die Zahl darunter nachziehen, sonst steht dort der Stand von vorhin und
      // sieht aus, als sei nichts passiert.
      setTimeout(tonStandZeigen, 6 * 900);
      toast('Start · Satz · Übung fertig · fertig machen · Pause vorbei · Workout komplett');
      break;
    }
    case 'toggle-ex-rest':
      store.setSetting('useExerciseRest', !store.getState().useExerciseRest);
      render();
      break;
    case 'toggle-rest-off': {
      const off = !store.getState().useExerciseRest && !store.getState().restSeconds;
      store.setSetting('useExerciseRest', off);
      store.setSetting('restSeconds', off ? 90 : 0);
      if (store.getState().rest) endRest(false);
      render();
      break;
    }
    case 'export': {
      const io = document.getElementById('io');
      io.value = store.exportJSON();
      io.select();
      toast('Export erzeugt – kopieren und sicher ablegen.');
      break;
    }
    case 'download-ics':
      downloadICS();
      render();
      break;
    case 'download':
      downloadBackup();
      break;
    case 'import-file':
      importBackupDatei();
      break;
    case 'import': {
      const io = document.getElementById('io');
      try {
        store.importJSON(io.value);
        render();
        toast('Import erfolgreich');
      } catch (err) {
        toast(`Import fehlgeschlagen: ${err.message}`);
      }
      break;
    }
    case 'force-update': {
      // Notausgang, wenn eine alte Fassung im Zwischenspeicher klebt: Service
      // Worker abmelden, Zwischenspeicher leeren, neu laden. Der localStorage
      // bleibt, dort liegen die Trainingsdaten.
      (async () => {
        try {
          if ('serviceWorker' in navigator) {
            const regs = await navigator.serviceWorker.getRegistrations();
            await Promise.all(regs.map((r) => r.unregister()));
          }
          if (window.caches) {
            const keys = await caches.keys();
            await Promise.all(keys.map((k) => caches.delete(k)));
          }
          sessionStorage.removeItem('workout.reloaded');
        } catch {
          // Auch ohne Aufräumen ist ein Neuladen besser als nichts.
        }
        store.flush();
        location.reload();
      })();
      break;
    }
    case 'reset-all':
      if (confirm('Wirklich alle protokollierten Sätze und Einstellungen löschen?')) {
        // Erst die Zeile auf dem Server, dann den Speicher: Danach ist die
        // Kennung weg, mit der sie zu finden wäre – sie bliebe für immer
        // stehen, obwohl hier gerade alles gelöscht wird.
        const id = meldetMit() ? store.getState().deviceId : null;
        if (id) loeschen(id);
        store.resetAll();
        ui.workoutNo = naechsteEinheit();
        render();
        toast('Alle Daten gelöscht');
      }
      break;
    default:
      break;
  }
});

/* ------------------------------------------------------------------ *
 * Wischen
 *
 * Zwei Ansichten haben eine natürliche Reihenfolge, und in beiden standen die
 * Pfeile bisher am Rand: die Einheiten auf der Startansicht und die Übungen im
 * Training. Beides ist eine Bewegung, die die Hand ohnehin macht.
 *
 * Was hier nicht passiert, ist genauso wichtig wie was passiert:
 *
 *   Nichts unter dem Finger. Wer auf einem Eingabefeld, einem Knopf oder dem
 *   drehbaren Bewegungsbild loswischt, meint das, was darunter liegt – die
 *   Figur dreht sich, das Feld markiert. Solche Starts werden übergangen.
 *
 *   Senkrecht schlägt waagerecht. Gescrollt wird viel öfter als geblättert;
 *   eine Geste zählt erst als Wisch, wenn sie deutlich mehr quer als hoch
 *   geht.
 *
 *   Nicht während einer Pause zwischen zwei Sätzen? Doch – gerade dann. Die
 *   Pause ist die Zeit, in der man ohnehin nach vorn und zurück sieht.
 * ------------------------------------------------------------------ */

const WISCH_WEG = 60;      // Mindeststrecke in Pixeln
const WISCH_SCHRAEG = 1.6; // wie viel klarer waagerecht als senkrecht sein muss

let wisch = null;

/** Auf welchem Element darf ein Wisch nicht anfangen? */
const wischTabu = (ziel) => !!(ziel && ziel.closest(
  'input, textarea, select, button, a, [data-act], .fig-wrap, svg'));

view.addEventListener('touchstart', (e) => {
  if (e.touches.length !== 1 || wischTabu(e.target)) { wisch = null; return; }
  const t = e.touches[0];
  wisch = { x: t.clientX, y: t.clientY };
}, { passive: true });

view.addEventListener('touchend', (e) => {
  if (!wisch) return;
  const t = e.changedTouches[0];
  const dx = t.clientX - wisch.x;
  const dy = t.clientY - wisch.y;
  wisch = null;
  if (Math.abs(dx) < WISCH_WEG || Math.abs(dx) < Math.abs(dy) * WISCH_SCHRAEG) return;
  blaettern(dx < 0 ? 1 : -1);
}, { passive: true });

/**
 * Einen Schritt weiter oder zurück – je nachdem, was gerade zu sehen ist.
 *
 * Im Training zwischen den Übungen, sonst zwischen den Einheiten. Am Rand
 * passiert nichts: Ein Wisch ins Leere ist besser als ein Sprung irgendwohin.
 */
function blaettern(richtung) {
  const n = ui.workoutNo;
  if (ui.focus) {
    const w = workoutByNo(n, store.workoutMode(n));
    const ziel = ui.focusIdx + richtung;
    if (ziel < 0 || ziel >= w.ex.length) return;
    ui.focusIdx = ziel;
    render();
    return;
  }
  if (ui.tab !== 'dashboard' || ui.listView || istCustom(n)) return;
  const ziel = n + richtung;
  if (!PLAN.some((w) => w.n === ziel)) return;
  ui.workoutNo = ziel;
  ui.openEx.clear();
  render();
}

view.addEventListener('keydown', (e) => {
  const head = e.target.closest('.ex-head');
  if (head && (e.key === 'Enter' || e.key === ' ')) {
    e.preventDefault();
    head.click();
  }
});

// Texteingaben: still speichern, damit der Fokus beim Tippen erhalten bleibt.
view.addEventListener('input', (e) => {
  const t = e.target.closest('[data-act]');
  if (!t) return;
  if (t.dataset.act === 'weight-input') {
    const kg = parseFloat(t.value.replace(',', '.'));
    if (!Number.isNaN(kg)) store.setWeight(t.dataset.ex, kg);
  } else if (t.dataset.act === 'custom-name') {
    if (ui.customDraft) ui.customDraft.name = t.value.slice(0, 32);
  } else if (t.dataset.act === 'name-input') {
    store.setSetting('name', t.value.trim().slice(0, 24));
  } else if (t.dataset.act === 'set-input') {
    const n = ui.workoutNo;
    const mode = store.workoutMode(n);
    const item = workoutByNo(n, mode).ex.find((x) => x.id === t.dataset.ex);
    store.updateSet(n, mode, t.dataset.ex, item.sets, Number(t.dataset.i), { [t.dataset.field]: t.value });
  } else if (t.dataset.act === 'erinnerung-zeit') {
    // Stand jahrelang im Klick-Zweig und wurde damit nie ausgelöst: Ein
    // Zeitfeld meldet eine neue Uhrzeit als "input", nicht als Klick. Wer die
    // Zeit umstellte, sah die neue Zahl im Feld – gespeichert war die alte.
    // Ein leeres oder unsinniges Feld lässt die bisherige Zeit stehen, statt
    // die Erinnerung still auf Mitternacht zu schieben.
    if (minuten(t.value) === null) return;
    store.setSetting('erinnerung', { ...erinnerungAn(), [t.dataset.wann]: t.value });
    erinnerungPflegen();
  } else if (t.dataset.act === 'scheiben-stange') {
    // Beim Tippen still speichern, ohne neu zu rendern: Ein render() würde das
    // Feld ersetzen und den Fokus mitnehmen, mitten im Wort.
    const kg = parseFloat(t.value.replace(',', '.'));
    scheibenAendern((s) => { s.stange[t.dataset.satz] = Number.isNaN(kg) ? null : kg; });
  } else if (t.dataset.act === 'scheiben-kg' || t.dataset.act === 'scheiben-n') {
    const zahl = parseFloat(t.value.replace(',', '.'));
    if (Number.isNaN(zahl)) return;
    const feld = t.dataset.act === 'scheiben-kg' ? 0 : 1;
    scheibenAendern((s) => {
      const zeile = s.scheiben[Number(t.dataset.i)];
      if (zeile) zeile[feld] = zahl;
    });
  }
});

/* ------------------------------------------------------------------ *
 * Start
 * ------------------------------------------------------------------ */

// Bleibt die App über Mitternacht offen, muss der Plan beim Zurückkommen
// nachgezogen werden – sonst steht dort weiter das Datum von gestern.
let lastSeenDay = todayISO();
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') {
    // Die Trainingsuhr steht, solange die App weg ist – es sei denn, es läuft
    // eine Pause. Die gehört zum Training, auch wenn man dabei aufs Handy
    // verzichtet.
    if (!store.getState().rest) store.clockStop();
    // Ab hier zaehlt der Worker sichtbar mit – die Seite friert gleich ein.
    swSichtbar(false);
    store.flush();
    erinnerungNachlegen();
    return;
  }
  store.clockStart();
  // Wer wieder davorsitzt, sieht die Leiste in der App – die Meldung in der
  // Statusleiste wäre jetzt nur noch ein Duplikat.
  swSichtbar(true);
  tickRest(); // war das Handy gesperrt, ist die Pause womöglich abgelaufen
  // Läuft sie noch, das Signal neu auflegen: Ein im Hintergrund angehaltener
  // AudioContext verliert seine vorgemerkten Töne.
  if (store.getState().rest) armRest();
  const day = todayISO();
  // Erst die Runde weiterrollen, dann nachrücken: Sonst schöbe catchUpPlan()
  // den alten, längst fertigen Plan durch die Gegend.
  const neueRunde = rundeWeiter();
  const shifted = catchUpPlan() || neueRunde;
  if (shifted || day !== lastSeenDay) {
    lastSeenDay = day;
    render();
  }
});

window.addEventListener('pagehide', () => {
  if (!store.getState().rest) store.clockStop();
  store.flush();
});

// Offline-Betrieb. Nur über http(s) – unter file:// gibt es keine Service
// Worker, und die gebündelte Einzeldatei braucht sie ohnehin nicht.
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  // Nach einer neuen Fassung einmal neu laden.
  //
  // Der Service Worker holt Seitenaufrufe aus dem Netz, alles andere zuerst
  // aus dem Zwischenspeicher. Direkt nach einer Aktualisierung trifft damit
  // ein frisches index.html auf altes app.js und data.js – dann steht in der
  // Tabbar ein Tab, den das alte Skript nicht kennt, und im Kopf die
  // Einheitenzahl des alten Plans. Übernimmt der neue Service Worker die
  // Seite, ist alles Weitere frisch; ein Neuladen holt es sofort.
  //
  // Nur wenn vorher schon einer die Seite hatte: bei der allerersten
  // Installation greift `clients.claim()` ebenfalls, und ein Neuladen wäre
  // dort unnötig. Und nur einmal je Sitzung, damit ein kaputter Service
  // Worker die Seite nicht in eine Schleife schickt.
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController) return;
    try {
      if (sessionStorage.getItem('workout.reloaded')) return;
      sessionStorage.setItem('workout.reloaded', '1');
    } catch {
      return;   // ohne Speicher lieber gar nicht neu laden als endlos
    }
    location.reload();
  });
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      // Kein Offline-Betrieb, aber die App läuft normal weiter.
    });
  });
}

// Nachrücken passiert still: Ist der Termin der nächsten offenen Einheit
// verstrichen, wandert der Restplan nach hinten. Der Rückgabewert – wie viele
// Tage das waren – wird nicht mehr gebraucht, seit der Hinweis dazu weg ist.
// Erst nachstempeln, dann die Runde prüfen: rundeWeiter() fragt genau die
// Vollständigkeit ab, die hier festgeschrieben wird.
stempleFertige();
rundeWeiter();
catchUpPlan();
// Hat jemand einen Stand geschickt? Steht im Anker der Adresse und wird dort
// sofort entfernt. Die Frage danach stellt die Startansicht – also muss sie
// auch die sichtbare sein, sonst öffnet der Link bei jemandem, der zuletzt in
// der Statistik war, eine Seite ohne jeden Hinweis.
ui.standAngebot = standAusAdresse();
// Und dasselbe für einen geschickten Scheibensatz – der fragt selbst nach und
// braucht keine eigene Ansicht, weil er nichts zeigt, was man vergleichen
// müsste: Er trägt ein, was man ohnehin gerade eintippen wollte.
eisenAusAdresse();

// Einmal beim Start den Browser bitten, diesen Speicher nicht von selbst
// freizugeben. Ohne await: Das Ergebnis interessiert erst, wenn jemand unter
// Mehr nachsieht, und bis dahin darf der Start nicht darauf warten.
speicherFestnageln();
// Und noch einmal, wenn der Link auf eine bereits offene App trifft: Dann ist
// das ein Sprung innerhalb derselben Seite, sie lädt nicht neu, und ohne diesen
// Horcher passierte schlicht nichts.
window.addEventListener('hashchange', eisenAusAdresse);
if (ui.standAngebot) {
  ui.tab = 'dashboard';
  ui.focus = false;
  ui.listView = false;
}
// Stand dieses Gerät auf einem Fokus, den es nicht mehr gibt? Dann jetzt
// umschreiben – js/data.js hat den Nachfolger schon geladen, hier zieht der
// gespeicherte Wert nach.
if (fokusUmzug()) {
  ui.tab = 'dashboard';
  ui.focus = false;
  ui.listView = false;
}
// Und danach: Hat sich der *Inhalt* des Plans geändert, ohne dass der Fokus ein
// anderer wäre? Dann zeigt jeder alte Eintrag auf eine andere Übung, und der
// laufende Verlauf wandert in die Ablage. Nach fokusUmzug(), nicht davor – der
// stellt erst fest, welcher Plan überhaupt gilt.
if (planWechsel()) {
  ui.tab = 'dashboard';
  ui.focus = false;
  ui.listView = false;
}
// Auch beim Start prüfen, nicht nur nach einer Einheit: Eine eingelesene
// Sicherung bringt womöglich ein halbes Jahr Training mit, und das soll sofort
// in der richtigen Stufe landen statt erst nach dem nächsten Training.
//
// **Nach dem Fokus-Umzug**, und das war einmal andersherum: Solange der
// Aufstieg nur `state.log` zählte, musste er vor dem Umzug laufen, weil der das
// Protokoll wegräumt. Seit die abgelegte Runde ihre eigene Bilanz mitbringt und
// gesamtStats() sie mitzählt, gilt das Gegenteil – und zwar zwingend: Während
// des Umzugs steht das Protokoll des *alten* Plans einem bereits geladenen
// *neuen* gegenüber, und dagegen gerechnet findet sammleStats() so gut wie
// nichts. Erst nachdem der Umzug die Runde samt Bilanz abgelegt hat, steht dem
// Aufstieg die richtige Zahl gegenüber.
if (pruefeAufstieg() || pruefeZusatztag()) {
  ui.tab = 'dashboard';
  ui.focus = false;
  // Der Zusatztag entsteht erst hier, also nach der Wahl der Startansicht ganz
  // oben. Ohne diese Zeile stünde er zwar in der Ablage, aber die App zeigte
  // weiter die nächste Planeinheit – angelegt und unsichtbar, also praktisch
  // nicht vorhanden.
  ui.workoutNo = naechsteEinheit();
}
/*
 * Wenn das Speichern kippt, muss der Bildschirm es sagen – sofort.
 *
 * Der Schreibvorgang läuft 120 ms *nach* dem Rendern (persist()). Scheitert er,
 * ist die Oberfläche längst gezeichnet, und ohne diesen Abgleich stünde die
 * Warnung erst nach dem nächsten Tipp da – also nach dem nächsten Satz, der
 * nicht mehr ankommt. Gerendert wird nur beim Wechsel, nicht bei jeder Meldung:
 * Sonst zöge jeder abgehakte Satz einen zweiten Neuaufbau nach sich.
 */
let speicherStand = store.canPersist();
store.subscribe(() => {
  if (store.canPersist() === speicherStand) return;
  speicherStand = store.canPersist();
  render();
});

/*
 * Merkzettel und Symbolzahl nachziehen, sobald sich etwas ändert.
 *
 * Muss an *jeder* Änderung hängen und nicht nur am Trainingsende: Der Zettel
 * ist das Einzige, was der Service Worker später zu sehen bekommt, und wenn die
 * App zugeht, rechnet niemand mehr etwas nach. Ein abgehakter letzter Satz, ein
 * verschobener Plan, eine geänderte Uhrzeit – alles drei ändert, wann als
 * Nächstes erinnert werden soll.
 */
store.subscribe(() => { erinnerungPflegen(); });
erinnerungPflegen();

render();
meldeStand();        // einmal am Tag, wenn ein Server eingetragen und erlaubt ist
store.clockResync(); // Zeit, in der die Seite gar nicht lief, zählt nicht mit
// Neu geladen und sichtbar: Die Uhr eines laufenden Trainings muss wieder
// anlaufen. Ohne diese Zeile stünde sie bis zum nächsten Wegschalten still.
if (!document.hidden) store.clockStart();
tickRest(); // eine Pause, die einen Neustart der Seite überdauert hat
