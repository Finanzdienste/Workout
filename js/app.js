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
// Als Erstes: Das Diagnoseprotokoll hängt seine Fehler-Lauscher ein, bevor
// data.js und store.js ausgewertet werden (siehe js/diagnose.js).
import {
  diagnoseAn, diagnoseFassung, diagnoseGrundMerken, diagnoseLeeren, diagnosePlatzMachen, diagnoseSauber,
  diagnoseSchalten, diagnoseSchreiben, diagnoseStand, diagnoseStart, diagnoseText, diagnoseZeilen, diagnoseZone,
  notieren, uaKurz,
} from './diagnose.js';
import { EXERCISES, FOCUS, FOKUS_ERSATZ, PLAN, PLANS, TARGET, REST } from './data.js';
import * as store from './store.js';
import {
  todayISO, addDays, daysBetween, fmtDate, plural, fmtMonth, monthStart, addMonths, monthGrid, WEEK_HEAD, tagMonat,
  wochentag,
} from './dates.js';
import { mountFigure, clearFigures } from './figure.js';
import { mountBody, MUSCLE_LABEL } from './body.js';
import { INJURIES, KIND_LABEL, CARE, CARE_LABEL, injuryById, blocked, weeklyImpact, combosFor, careFor, needsClearance } from './injuries.js';
import { sparkPanel } from './chart.js';
import { buildICS } from './ics.js';
import { kalenderEinheiten } from './kalender.js';
import { CONFIG, hatServer } from './config.js';
import { geraeteId, melden, loeschen, adminListe } from './telemetry.js';
import {
  linkVermerken, loeschenAusstehend, passwortManagerDa, schluesselAblegen, schluesselAus,
  schluesselAusManager, schluesselPruefen, sicherungAblageVerwerfen, sicherungAn, sicherungEinrichten,
  sicherungGeaendert, sicherungHolen, sicherungJetzt, sicherungLink, sicherungLoeschen,
  sicherungMetaLesen, sicherungNachsehen, sicherungRueckweg, sicherungSchalten, sicherungStart,
  sicherungTrotzdem, sicherungUebernehmen, sicherungVergessen, sicherungVerstecken,
} from './sicherung.js';
import {
  kalenderCode, kalenderEinrichten, kalenderGeaendert, kalenderJetzt, kalenderKurz, kalenderLage,
  kalenderSatz, kalenderSichtbar, kalenderStart, kalenderTrennen, kalenderVerbinden, kalenderVergessen,
  kalenderVerbunden, kalenderVerstecken, kalenderVorlage,
} from './kalender-sync.js';
import {
  initAudio, playSound, scheduleSound, cancelSound, signalStand, probeSpielen, tonStand, onTonStand,
  tonUeberholt,
} from './audio.js';
import { esc, fmtNum, komma1 } from './text.js';
import { MODE_ICON, MODE_LABEL, mitWdh, repsLabel, umfangText, wdhTeile } from './anzeige.js';
import {
  AKT_ICON, aktivitaetTage, calMonthNow, calendarCell, calendarDetail, dayState, eigeneTage, fruehereTage,
} from './ansicht-kalender.js';
import { EX_BY_ID } from './uebung.js';
import { LEVELS, SAETZE_JE_STUFE, levelBeispiel, satzFaktor, satzZahlIm } from './stufen.js';
import {
  aufwaermsaetze, doneWeightNote, gewichtNotiz, naechstesGewicht,
  ruestCache, ruestHint,
  workingWeight,
} from './gewichte.js';
import { normSatz } from './scheiben.js';
import { roherSatz, scheibenEinstellbar, scheibenZeilenHinweis } from './ansicht-scheiben.js';
import { uebungsListe, vorratKarte } from './ansicht-vorrat.js';
import {
  erfahrungStand, gesamtKarte, lastLoggedFor, musterKarte, progressSeries,
} from './ansicht-statistik.js';
import {
  gruppeVon, naechsterOffen, naechsterSchritt, paarBelegung, paare, scheibenReichen, schritte,
} from './supersatz.js';
import {
  PLAN_WEEKS, WEEK_SESSIONS, ZUSATZ_NAME,
  activeInjuries, ausfallTage, completedMode, defaultWorkoutNo, effDate, einheitEx, ersatzGrund,
  exOf, fassungen, festerZusatz, firstOpen, hasAnyEntry, injuryNotes, istCustom, liegenGeblieben, nacharbeit,
  nacharbeitPlan, nacharbeitVorschau, nachWarumJe, offenImBlock, progressOf, saetzeErledigt,
  resolve, sammleStats, shiftToToday, tagLaenge, vorratNotiz, workoutByNo,
  zusatzBindung, zusatzEinheitFuer, zusatzRueckstand, zusatzVergeben, zusatzWeg,
} from './plan.js';
import { lebenStats, pruefeAufstieg, rundenBilanz } from './bilanz.js';
import {
  frischerStart, naechsteEinheit, pruefeZusatztag, tagAbschliessen, tagNachziehen, tagstartAnschliessen,
  traegerGebunden, weeklyDone, zusatzZiel, zusatztagEx,
} from './tagstart.js';
import { vorneUm } from './muster.js';
import { GERAETE, ausUebungen, bandFarbe, fehlt, nichtsAbgewaehlt, setzeUebung, setzeVorrat, uebungGeht } from './vorrat.js';
import { termine, terminLabel } from './termine.js';
import { AKTIVITAETEN, AKT_BY_ID, familien, gruppenAm, nachwirkung } from './aktivitaeten.js';

/* Trainingsfokus: js/data.js liefert alle Varianten mit (PLANS) und wählt beim
 * Laden aus, welche gilt – PLAN, TARGET und REST kommen von dort und meinen
 * überall dasselbe. Der Wechsel lädt die Seite neu, siehe 'set-focus'. */

const view = document.getElementById('view');
const tabbar = document.getElementById('tabbar');
const toastEl = document.getElementById('toast');

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

/** Größe eines Schlüssels im Speicher in KB – fürs Diagnoseprotokoll. */
function kb(schluessel) {
  try {
    return Math.round((localStorage.getItem(schluessel) || '').length / 1024);
  } catch {
    return null;
  }
}

// Die Startzeile des Diagnoseprotokolls: mit allem, was nur die App weiß –
// auch, ob gerade eine Einheit oder eine Pause lief (Neuladen mittendrin).
{
  const s = store.getState();
  diagnoseStart({
    einzeldatei: EINZELDATEI,
    speicher: store.speicherGrund() || 'ok',
    haupt: kb('workout.state.v1'),
    ablage: kb('workout.rounds.v1'),
    plan: PLAN.length,
    fokus: s.focus || 'standard',
    stand: FOCUS.stand,
    sw: !!(navigator.serviceWorker && navigator.serviceWorker.controller),
    einheit: s.session ? s.session.n : undefined,
    pause: s.rest ? Math.round((s.rest.endsAt - Date.now()) / 1000) : undefined,
  });
}

/* ------------------------------------------------------------------ *
 * Der Punkt am App-Symbol
 *
 *     „Mach auch die einmalige Push Nachricht morgens weg. Pausen usw sollen
 *      aber natürlich immer noch mit angezeigt werden"
 *
 * Damit ist die Erinnerung am Trainingstag weg – Meldung, Uhrzeiten,
 * periodicsync, Web Push, Merkzettel, der Wecker bei GitHub. Warum der ganze
 * Weg und nicht nur die Meldung, steht in sw.js.
 *
 * Übrig bleiben diese paar Zeilen: Steht eine Einheit offen und ist ihr Termin
 * da, trägt das App-Symbol einen Punkt. Das ist der Rest der Ansage von
 * damals, *„so wie bei WhatsApp"*, und er kommt ohne Meldung aus.
 *
 * **Auf Android passiert hier nichts**, und das ist keine Nachlässigkeit:
 * Chrome stellt setAppBadge dort gar nicht bereit. Auf dem Handy entstand der
 * Punkt bisher allein aus der Meldung – die ist jetzt weg, und damit auch er.
 * Diese Zeilen tragen auf dem Rechner, wo die App installiert ist.
 * ------------------------------------------------------------------ */

async function erinnerungPflegen() {
  // Fällig heißt: Es gibt eine offene Einheit, und ihr Termin ist nicht mehr in
  // der Zukunft. Ein Punkt drei Tage vorher wäre kein Hinweis, sondern
  // Dauerzustand.
  let faellig = false;
  try {
    const n = defaultWorkoutNo();
    const w = n ? workoutByNo(n) : null;
    faellig = !!w && !completedMode(w.n) && effDate(w) <= todayISO();
  } catch { faellig = false; }

  try {
    if (navigator.setAppBadge) {
      // Ohne Zahl – setAppBadge() zeigt einen Punkt, setAppBadge(1) eine Eins.
      if (faellig) await navigator.setAppBadge();
      else if (navigator.clearAppBadge) await navigator.clearAppBadge();
    }
  } catch { /* nicht unterstützt – dann eben nicht */ }
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
  if (store.ablageKlemmt()) {
    return `<div class="notice warn">⚠️ <b>Der Speicher dieses Browsers ist voll.</b>
      Die abgeschlossene Runde ließ sich nicht ablegen, deshalb fängt der Plan noch nicht
      von vorn an – verloren ist nichts, und Eintragungen werden weiter gespeichert.
      Jetzt sichern, dann unter <i>Mehr → Daten</i> aufräumen.
      <button type="button" class="btn btn-block" data-act="backup-now"
              style="margin-top:10px">Jetzt sichern</button></div>`;
  }
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

/*
 * Hier stand "Diese Gewichte stehen" - der eine Ort, an dem die App zum Steigern
 * riet. Raus, und zwar ganz:
 *
 *     "Es sollen nie Steigerungsvorschlaege kommen. Egal wann."
 *
 * Vorher war der Hinweis nur im Cut-Fokus gesperrt, und diese Sperre stand auf
 * einer Begruendung, die einer Pruefung nicht standgehalten hat. Jetzt gibt es
 * die Frage nicht mehr: Gesteigert wird von Hand, am + der Gewichtszeile. Die
 * Rechnung dahinter ist in js/gewichte.js mit entfallen - siehe den Block dort.
 */

function aufstiegHinweis() {
  const a = store.getState().aufstieg;
  if (!a) return '';
  const name = (k) => (LEVELS.find(([key]) => key === k) || [])[1] || k;
  const vorher = SAETZE_JE_STUFE[a.von] || 3;
  const jetzt = SAETZE_JE_STUFE[a.nach] || 3;
  // Seit die Anfängerstufe die Sätze nicht mehr kürzt, ändert der erste
  // Aufstieg die Satzzahl gar nicht mehr – "3 statt 3 Sätze" wäre Unsinn. Dann
  // steht da, was sich wirklich ändert: die schwerere Fassung der Übung.
  const was = jetzt === vorher
    ? 'Die Satzzahl bleibt; wo es von einer Übung eine leichtere Anfängerfassung gab, '
      + 'steht ab jetzt die reguläre im Plan.'
    : `Ab jetzt stehen ${jetzt} statt ${vorher} Sätze je Übung im Plan.`;
  // Womit es verdient wurde. Seit der Aufstieg an den Gewichten hängt und nicht
  // mehr an Einheiten und Tonnen, steht hier die Zahl, die ihn ausgelöst hat –
  // und ein alter Stand, der noch Einheiten mitbringt, darf sie behalten.
  const grund = a.verhaeltnis
    ? `Über ${esc(plural(a.uebungen || 0, 'Übung', 'Übungen'))} hebst du im Median das
       <b>${esc(fmtNum(a.verhaeltnis))}-fache</b> dessen, womit jemand auf dieser Stufe
       anfängt.`
    : `Insgesamt ${a.einheiten} Einheiten${a.tonnen ? ` und ${fmtNum(a.tonnen)} Tonnen bewegt` : ''}.`;
  return `
    <div class="notice aufstieg" style="margin:0 0 12px">
      <strong>🎉 Glückwunsch – du bist jetzt ${esc(name(a.nach))}</strong>
      <div class="small" style="margin-top:6px">
        ${grund} Das ist keine ${esc(name(a.von))}-Last mehr. ${was} Übungen, Pausen und die
        Verteilung über die Woche bleiben sonst, wie sie sind. Deine eingetragenen Gewichte
        rührt das nicht an.
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

/**
 * Der Aufstieg auch als Meldung im Benachrichtigungsbereich.
 *
 *     "Mach's so, dass man zum optimalen Zeitpunkt aufsteigt. Mit
 *      Benachrichtigung und Beglückwünschung."
 *
 * Die Beglückwünschung steht oben in der App. Diese hier ist der Teil, der
 * liegen bleibt: Wer die App gleich nach dem letzten Satz zuklappt, hat den
 * Kasten vielleicht nur gestreift – die Meldung findet er abends noch in der
 * Leiste.
 *
 * Ohne erteilte Erlaubnis passiert schlicht nichts, und das ist richtig so:
 * Danach zu fragen, weil jemand gerade aufgestiegen ist, wäre eine Frage zur
 * Unzeit. Wer den Hinweis am Pausenende erlaubt hat, hat sie ohnehin.
 */
function aufstiegMelden(nach) {
  try {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    if (!navigator.serviceWorker || !navigator.serviceWorker.ready) return;
    const name = (LEVELS.find(([k]) => k === nach) || [])[1] || nach;
    navigator.serviceWorker.ready.then((reg) => reg.showNotification('Aufgestiegen 🎉', {
      body: `Du bist jetzt ${name}. Die App hat es an deinen Gewichten gemessen.`,
      badge: './badge-96.png',
      tag: 'workout-aufstieg',
      data: { art: 'aufstieg' },
    })).catch(() => {});
  } catch { /* Meldungen sind Beiwerk – sie dürfen nichts umwerfen. */ }
}

/**
 * Der Hinweis zum überarbeiteten Plan – bis er weggetippt wird.
 *
 * Er sagt drei Dinge, und zwar in dieser Reihenfolge: dass der Plan ein anderer
 * ist, was mit dem Bisherigen passiert ist, und was *nicht* verloren geht. Die
 * dritte Zeile ist die wichtigste: Eine zurückgesetzte Runde sieht aus wie ein
 * Datenverlust, und sie ist keiner.
 *
 * Planwechsel und Reparatur können zugleich offen sein (siehe festReparieren()),
 * dann stehen beide Absätze in einem Hinweis, der Planwechsel zuerst.
 */
function umbauHinweis() {
  const u = store.getState().planUmbau;
  if (!u) return '';
  // Bis v218 stand bei einer Reparatur `repariert: true` und die Zahl in
  // `einheiten` – so liegt es auf manchem Gerät noch, bis es weggetippt ist.
  const repariert = u.repariert === true ? u.einheiten : (u.repariert || 0);
  const teile = [];
  if (u.fest) {
    teile.push(`
      <strong>Der Plan wurde überarbeitet</strong>
      <div class="small" style="margin-top:6px">
        ${u.einheiten
    ? `Deine ${u.einheiten === 1 ? 'angefangene oder trainierte Einheit bleibt' : `${u.einheiten} angefangenen oder trainierten Einheiten bleiben`}
        genau so, wie du sie gemacht hast. `
    : ''}Ab der nächsten offenen Einheit gelten in „${esc(u.fokus)}" die neuen Übungen,
        und die Runde läuft einfach weiter. <b>Gewichte, Bänder, Erfahrungsstufe und
        Statistik bleiben, wie sie sind.</b>
      </div>`);
  }
  if (repariert) {
    teile.push(`
      <strong${teile.length ? ' style="display:block;margin-top:12px"' : ''}>Deine angefangene Einheit ist wieder vollständig</strong>
      <div class="small" style="margin-top:6px">
        Beim Plan-Update eben ${repariert === 1 ? 'hatte eine angefangene Einheit' : `hatten ${repariert} angefangene Einheiten`}
        in „${esc(u.fokus)}" Übungen verloren – nur die schon angezeigten waren
        geblieben. Das war ein Fehler in der App. Jetzt stehen wieder alle Übungen
        drin, die dort vorher standen; was du schon abgehakt hast, bleibt abgehakt.
      </div>`);
  }
  if (teile.length) {
    return `
    <div class="notice aufstieg" style="margin:0 0 12px">
      ${teile.join('')}
      <div class="btn-row nav" style="margin-top:10px">
        <button type="button" class="btn btn-primary" data-act="umbau-ok">Verstanden</button>
      </div>
    </div>`;
  }
  return `
    <div class="notice aufstieg" style="margin:0 0 12px">
      <strong>Der Plan wurde überarbeitet</strong>
      <div class="small" style="margin-top:6px">
        Hinter den Workout-Nummern von „${esc(u.fokus)}" stehen jetzt andere Übungen –
        deine ${u.einheiten === 1 ? 'eine Einheit' : `${u.einheiten} Einheiten`} aus der
        laufenden Runde zeigen darauf nicht mehr. Sie liegen deshalb vollständig unter
        <i>Mehr → Daten</i>, und die neue Runde fängt bei eins an.
        <b>Deine Gewichte, Bänder, Erfahrungsstufe und die Statistik bleiben, wie sie
        sind</b> – die rechnen über alle Runden.
      </div>
      <div class="btn-row nav" style="margin-top:10px">
        <button type="button" class="btn btn-primary" data-act="umbau-ok">Verstanden</button>
      </div>
    </div>`;
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
  herunterladen(json, `workout-backup-${todayISO()}.json`, 'application/json');
  store.markBackup(doneCount());
  notieren('datei', { was: 'download', bytes: json.length });
  toast('Gesichert – falls kein Download kam: Text in „Mehr" kopieren');
}

/** Text als Datei herunterladen – die Sicherung und das Diagnoseprotokoll. */
function herunterladen(text, name, typ) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: typ }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
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
 * Hier stand bis v239: „Was hier bewusst *nicht* passiert: die Sicherung von
 * selbst irgendwohin schicken." Tobi – Nutzer und Betreiber in einer Person –
 * hat das anders entschieden:
 *
 *     „Wenn ich auch 'Sicherung weitergeben' klicke passiert nichts. Lass das
 *      doch generell einfach automatisch sichern"
 *
 * Jetzt geht der Verlauf von selbst an den Server des Betreibers – aber erst,
 * nachdem er auf dem Gerät verschlüsselt wurde, mit einem Schlüssel, der das
 * Gerät nie verlässt, außer der Mensch legt ihn selbst in seinen
 * Passwortmanager oder schickt sich den Link. Lesen kann ihn also nur, wer den
 * Schlüssel hat; der Betreiber nicht. Die Grundsätze von damals gelten weiter:
 * Einstieg und Mehr sagen, was geschieht, ein Schalter stellt es ab, ein Knopf
 * löscht es auf dem Server. Wie, steht in js/sicherung.js; was davon zu sehen
 * ist, weiter unten bei „Automatische Sicherung".
 *
 * Der Datei-Weg bleibt daneben, für den, der keinen Server will oder hat.
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
    notieren('speicher', { dauerhaft: ok, schon });
    if (store.getState().dauerhaft !== ok) store.setSetting('dauerhaft', ok);
  } catch (e) {
    notieren('speicher', { dauerhaft: 'fehler', name: e && e.name });   // kennt der Browser nicht – dann eben nicht
  }
}

/**
 * Die Sicherung weitergeben statt herunterladen.
 *
 *     „Wenn ich auch 'Sicherung weitergeben' klicke passiert nichts."
 *
 * Zwei Fehler, die zusammen genau das ergaben:
 *
 *   Der Typ.     Chrome teilt Dateien nur mit bestimmten Endungen und Typen
 *                (ShareServiceImpl, PERMITTED_EXTENSIONS / _MIME_TYPES): Text,
 *                Bilder, Audio, Video, PDF. .json und application/json stehen
 *                nicht darauf. canShare() sagt trotzdem ja – es prüft den Typ
 *                gar nicht –, und erst share() lehnt ab, mit NotAllowedError.
 *                Deshalb .txt und genau 'text/plain': Der Vergleich ist exakt,
 *                „text/plain;charset=utf-8" fiele schon wieder durch. „Datei
 *                laden" nimmt .txt ohnehin an (importBackupDatei()).
 *   Das Schweigen. Hier stand `catch { return; }` mit dem Kommentar
 *                „abgebrochen – kein Grund für eine Meldung". Abgebrochen ist
 *                aber nur ein AbortError. Alles andere ist eine Ablehnung, und
 *                die wurde mitverschluckt: kein Dialog, keine Meldung, kein
 *                Download.
 *
 * Jetzt: Abbruch bleibt still. Jede andere Ablehnung endet im Download, mit
 * einer Meldung, die den Grund nennt und den Textweg zeigt – ob ein Download
 * ohne frische Berührung auf jedem Handy durchgeht, ist nicht belegt, das
 * Textfeld unter Mehr → Daten dagegen schon.
 */
async function teileBackup() {
  const json = store.exportJSON();
  const datei = new File([json], `workout-backup-${todayISO()}.txt`, { type: 'text/plain' });
  ui.teilenFehler = '';
  if (navigator.canShare && navigator.canShare({ files: [datei] })) {
    try {
      await navigator.share({ files: [datei], title: 'Workout-Sicherung' });
      notieren('datei', { was: 'teilen', ok: true, bytes: json.length });
      store.markBackup(doneCount());
      render();
      return;
    } catch (e) {
      if (e && e.name === 'AbortError') {   // abgebrochen: eine Entscheidung, keine Meldung
        notieren('datei', { was: 'teilen', abbruch: true });
        return;
      }
      ui.teilenFehler = e && e.name ? `${e.name}${e.message ? ` – ${e.message}` : ''}` : 'ohne Angabe';
      notieren('datei', { was: 'teilen', ok: false, name: e && e.name, msg: e && e.message });
    }
  }
  downloadBackup();
  if (ui.teilenFehler) {
    if (ui.tab === 'settings') render();
    const io = document.getElementById('io');
    if (io) io.value = json;
    toast('Teilen hat der Browser abgelehnt – als Datei gespeichert. Der Text steht unter Mehr → Daten zum Kopieren.');
  }
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
/**
 * Eine Sicherung einlesen – mit Rückfrage, Rückweg und dem richtigen Plan.
 *
 * Drei Befunde der Durchsicht hingen hier: Der Import ersetzte den ganzen
 * Verlauf ohne Frage und ohne Rückweg; ein Import mit anderem Fokus lief bis
 * zum nächsten Neuladen gegen den alten Plan (der wird beim Start einmal
 * gewählt), und wer weitertrainierte, schrieb Übungen des falschen Plans ins
 * Protokoll; und die Telemetrie-Einstellung kam aus der Datei (das regelt
 * jetzt importJSON selbst).
 */
function einlesen(text, meldung) {
  if (!ersetzenErlaubt()) {
    notieren('datei', { was: 'import', abgelehnt: true });
    return;
  }
  store.importJSON(text);
  notieren('datei', { was: 'import', ok: true, bytes: text.length });
  // Beiseitegelegt ist jetzt der Stand von vor *dieser* Datei. Was die
  // Sicherung vor einem früheren Zurückholen wusste, gehört nicht mehr dazu
  // (sicherungRueckweg() in js/sicherung.js).
  sicherungAblageVerwerfen();
  ui.setupStep = 0;
  neuStarten(meldung);
}

/** Die Rückfrage vor jedem Einlesen – aus einer Datei wie vom Server. */
function ersetzenErlaubt() {
  const vorher = store.getState();
  const hatVerlauf = Object.keys(vorher.log || {}).length > 0 || (vorher.rounds || []).length > 0;
  return !hatVerlauf || confirm('Die Sicherung ersetzt deinen ganzen jetzigen Verlauf. '
    + 'Der jetzige Stand wird beiseitegelegt und lässt sich unter Mehr einmal zurückholen. Weiter?');
}

/**
 * Nach einem fremden Stand – Sicherung oder Rückweg davor – einmal neu laden.
 *
 * Bis hierher nur, wenn der Fokus ein anderer war: Der Plan wird beim Start
 * gewählt. Beim Start läuft aber noch mehr, und nur dort – planWechsel(),
 * festReparieren(), festNachReparieren(), stempleFertige(). Eine Sicherung
 * aus einem älteren Planstand mit angefangener Einheit zeigte deshalb bis zum
 * nächsten Öffnen die Übungen des neuen Plans; wer weitertrainierte, bekam
 * danach die alte Liste festgeschrieben und eine schon gemachte Übung offen
 * daneben. Gleicher Fokus oder nicht – ein eingelesener Stand ist ein Start.
 *
 * Der Reiter bleibt, wie ohne Neuladen: Wer unter Mehr eingelesen hat, findet
 * dort danach auch „Stand von vor dem Import zurückholen". Der eingelesene
 * Stand brächte sonst seinen eigenen mit. Hat der Start etwas zu sagen – einen
 * Planwechsel –, führt er selbst aufs Dashboard.
 */
function neuStarten(meldung) {
  store.setSetting('tab', ui.tab);
  store.flush();
  sessionStorage.setItem('workout.nachImport', meldung);
  vorDemNeuladen('import');
  location.reload();
}

/**
 * Vor jedem Neuladen, das die App selbst auslöst: dem Diagnoseprotokoll sagen,
 * warum (die nächste Startzeile trägt es), und schreiben, was aussteht – wie
 * store.flush() daneben.
 */
function vorDemNeuladen(grund) {
  notieren('sicht', { zu: 'neu laden', grund });
  diagnoseGrundMerken(grund);
  diagnoseSchreiben();
}

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
      .then((text) => einlesen(text, `Eingelesen: ${datei.name}`))
      .catch((err) => {
        // Nur der Name des Fehlers: Die Meldung eines JSON-Fehlers zitiert den
        // Anfang der Datei – und darin stünde der Name aus der Sicherung.
        notieren('datei', { was: 'import', quelle: 'datei', ok: false, name: err && err.name, bytes: datei.size });
        toast(`Import fehlgeschlagen: ${err.message}`);
      });
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
  const stand = store.markIcs(PLAN.length, { focus: store.getState().focus || 'standard', stand: FOCUS.stand || '' });
  // Dieselbe Quelle wie der Kalender, der sich selbst angleicht (js/kalender.js):
  // jede Einheit an ihrem Tag, in ihrer Variante – hier ohne Zusatz, wie bisher.
  const einheiten = kalenderEinheiten({ zusatz: false });
  // Was beim letzten Mal exportiert wurde und diesmal nicht mehr vorkommt, muss
  // aus dem Kalender wieder heraus: ein anderer Trainingsfokus hat womöglich
  // weniger Einheiten, und ein Tag, an dem Verletzungen alles sperren, hat gar
  // keinen Termin mehr.
  const jetzt = new Set(einheiten.filter((e) => e.posten.length).map((e) => e.n));
  const cancel = [];
  for (let n = 1; n <= Math.max((vorher && vorher.count) || 0, PLAN.length); n++) {
    if (!jetzt.has(n)) cancel.push(n);
  }
  const text = buildICS(
    einheiten.map((e) => ({ n: e.n, date: e.datum, posten: e.posten })),
    (w) => w.posten,
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

/**
 * Stimmen die Termine im Kalender noch? Null, wenn ja – sonst, warum nicht:
 * `tage` (um so viele Tage verschoben), `fokus` (exportiert unter einem
 * anderen Trainingsfokus) oder `plan` (derselbe Fokus, aber ein Plan-Update
 * hat geändert, was hinter den Nummern steht).
 *
 * Bis hierher zählte nur die Verschiebung. Jeder Termin trägt aber auch die
 * Übungsliste, die Satzzahl und die Dauer – und nach der Neuverteilung vom
 * 03.10. standen beim Cut 69 von 84 Terminen mit anderen Übungen im Kalender,
 * ohne dass die App ein Wort sagte. Verglichen wird der Fingerabdruck des
 * Plans (`stand`), nicht die einzelnen Listen: Die ändern sich mit jeder
 * Nacharbeit und jedem Aufstieg, und ein Hinweis, der nach jedem Training
 * kommt, wird nicht mehr gelesen.
 */
function icsStale() {
  const s = store.getState();
  const i = s.lastIcs;
  if (!i) return null;
  const fokus = s.focus || 'standard';
  const grund = {
    tage: i.shift !== s.shift ? Math.abs(s.shift - i.shift) : 0,
    fokus: !!i.focus && i.focus !== fokus,
    plan: !!i.stand && i.focus === fokus && !!(PLANS[fokus] || {}).stand && i.stand !== PLANS[fokus].stand,
  };
  return grund.tage || grund.fokus || grund.plan ? grund : null;
}

/**
 * Der Hinweis dazu unter Mehr → Kalender, mit dem Grund.
 *
 * Er schweigt, solange der Kalender „Workout" sich selbst angleicht (Google
 * Kalender automatisch, js/kalender-sync.js): Sonst riete er nach jedem
 * Nachrücken zum Neu-Import, und jeder Import stellte dieselben Trainings ein
 * zweites Mal hin. Die Datei bleibt erreichbar – mit genau diesem Satz.
 */
function icsHinweis() {
  if (kalenderVerbunden()) {
    return `<div class="hint" id="icsDoppelt" style="margin-top:8px">Der Kalender „Workout" pflegt sich schon
        selbst. Die Datei brauchst du dafür nicht – importierst du sie trotzdem, stehen die Termine doppelt da.</div>`;
  }
  const g = icsStale();
  if (!g) return '';
  const i = store.getState().lastIcs;
  const name = (f) => (PLANS[f] || FOKUS_ERSATZ[f] || {}).name || f;
  const teile = [];
  if (g.fokus) {
    teile.push(`Exportiert hast du „${esc(name(i.focus))}" – jetzt gilt „${esc(FOCUS.name)}",
      und im Kalender stehen noch die Übungen von damals.`);
  } else if (g.plan) {
    teile.push(`Der Plan wurde seit dem letzten Export überarbeitet: Hinter den Terminen
      stehen jetzt andere Übungen, Satzzahlen und Dauern als im Kalender.`);
  }
  if (g.tage) {
    teile.push(`Der Plan hat sich seit dem letzten Export um ${esc(plural(g.tage, 'Tag', 'Tage'))}
      verschoben.`);
  }
  return `<div class="hint" style="color:var(--accent);margin-top:8px">
        ${teile.join(' ')} Datei neu erzeugen und noch einmal importieren, dann
        ${g.fokus || g.plan ? 'stimmen Termine und Übungen wieder' : 'wandern die Termine mit'}.</div>`;
}

/* ------------------------------------------------------------------ *
 * Google Kalender automatisch – was davon zu sehen ist
 *
 *     „Ja aber nur wenn es wirklich keinen Weg gibt wie verschoben wird auch
 *      wenn ich die app nicht öffne"
 *
 * Die Technik steht in js/kalender-sync.js (Senden, Takt, Antwort), die
 * Rechnung in js/kalender-vorschau.js, das Skript in
 * kalender/workout-kalender.gs. Hier steht, wo man es sieht:
 *
 *   Mehr → Kalender   die Karte: was es tut und wer was sieht, die Schritte
 *                     zum Einrichten, „Code kopieren", URL und „Verbinden";
 *                     verbunden: wann zuletzt etwas ankam, Uhrzeit und
 *                     Erinnerung, „Trennen"
 *   Dashboard         eine Zeile, und nur, wenn Tobi etwas richten muss
 *
 * Keine Wahl, die er treffen müsste: 17:30 und 30 Minuten stehen fertig da,
 * gesendet wird von selbst. Kennwort und Adresse stehen nirgends in einer
 * Meldung – nur im Code, den er kopiert, und im Feld, in das er die URL
 * einfügt.
 * ------------------------------------------------------------------ */

// Kurz, weil das Feld bei 360 px Breite nur gut 100 px Platz hat – „30 Min.
// vorher" stand dort als „30 Min. vorhe" (gemessen bei der Prüfung). Das
// „vorher" steht einmal im Namen des Felds.
const KALENDER_ERINNERUNGEN = [[0, 'keine'], [10, '10 Min.'], [15, '15 Min.'],
  [30, '30 Min.'], [60, '1 Std.'], [120, '2 Std.']];

const kalenderUhr = (min) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

/** Der erste Satz eines Ergebnisses – für die eine Zeile auf dem Dashboard. */
function kalenderErsterSatz(satz) {
  const i = satz.indexOf('. ');
  return i > 0 ? satz.slice(0, i + 1) : satz;
}

/** Die Zeile auf dem Dashboard: nur, wenn Tobi selbst etwas richten muss. */
function kalenderZeile() {
  const l = kalenderLage();
  if (!l.verbunden || !(l.handeln || l.zuAlt)) return '';
  // Ein Hinweis des Skripts selbst ist kurz und sagt im zweiten Satz, was zu
  // tun ist – der bleibt ganz. Die langen Sätze der App kommen unter Mehr.
  const satz = l.zuAlt ? 'Der Code in Apps Script ist älter als die App – „Kalender-Code erneuern".'
    : l.letzte.ok ? kalenderSatz(l.letzte) : kalenderErsterSatz(kalenderSatz(l.letzte));
  return `<div class="notice warn zeile" id="kalenderZeile">📅 <span>Google Kalender: ${esc(satz)}</span>
      <button type="button" class="btn" data-act="kalender-ansehen">Ansehen</button></div>`;
}

/** Was die Karte über den letzten Stand sagt – ein Absatz, ohne Kennwort und Adresse. */
function kalenderStandText(l) {
  const wann = (ms) => vorWann(new Date(ms).toISOString());
  const teile = [];
  if (l.angekommen) {
    teile.push(`✓ Verbunden. Zuletzt angekommen: ${wann(l.angekommen.zeit)}${
      l.angekommen.version ? ` (Skript Fassung ${l.angekommen.version})` : ''}.`);
  } else {
    teile.push(l.letzte && !l.letzte.ok ? 'Verbunden, aber beim Skript ist noch nichts angekommen.'
      : 'Verbunden – die erste Vorschau ist unterwegs.');
  }
  if (l.letzte && !l.letzte.ok && !l.zuAlt) {
    const satz = kalenderSatz(l.letzte);
    teile.push(`Letzter Versuch ${wann(l.letzte.zeit)}: ${satz}`);
    if (l.letzte.wieder && !/noch einmal/.test(satz)) teile.push('Die App versucht es gleich noch einmal.');
  } else if (l.letzte && l.letzte.ok && l.letzte.hinweis && l.letzte.art !== 'probe') {
    teile.push(`Das Skript sagt: ${l.letzte.hinweis}`);
  }
  if (l.nach) teile.push(`Ohne Netz trainiert: Im Hintergrund nachgeschickt ${wann(l.nach.zeit)}.`);
  return teile.join(' ');
}

/** Mehr → Kalender: die Karte „Google Kalender automatisch". */
function kalenderKarte() {
  const l = kalenderLage();
  // Die Vorlage schon jetzt holen: „Code kopieren" soll gleich im Tipp kopieren
  // können – manche Browser lassen das nur dort zu.
  if (l.moeglich) kalenderVorlage().catch(() => {});
  const was = `<div class="lbl">Google Kalender automatisch</div>
      <div class="small muted" id="kalenderWas" style="margin-top:4px">Deine Trainings stehen in einem eigenen
        Kalender „Workout" in deinem Google-Konto, um ${esc(kalenderUhr(l.minuten))} mit den Übungen. Verpasst du
        eins, rückt es nach – auch wenn du die App nicht öffnest: Die App schickt einem kleinen Skript in deinem
        Google-Konto, wie der Plan die nächsten sechs Wochen aussähe, wenn du nicht trainierst, und das Skript
        gleicht den Kalender jede Stunde danach an. Trainierst du, schickt die App das Neue hinterher.</div>`;
  if (!l.moeglich) {
    return `<div class="card" id="kalenderAuto">${was}
      <div class="small" style="margin-top:8px">Das geht nur in der App aus dem Netz (am Startbildschirm
        installiert), nicht in dieser Einzeldatei – hier gibt es weder den Code zum Kopieren noch den Rechner im
        Hintergrund.</div></div>`;
  }
  // Was an Google geht und die Grenzen – ganz da, aber zugeklappt: Vor den
  // Schritten standen sie mit rund 200 Wörtern, und Schritt 1 begann bei 360 px
  // erst unten am ersten Bildschirm (Prüfung: Karte 1326 px hoch). Im
  // Dokument bleiben sie (hidden), damit nichts davon verschwindet.
  const mehrOffen = !!ui.kalenderMehr;
  const wer = `<button type="button" class="detail-toggle ${mehrOffen ? 'on' : ''}" data-act="kalender-mehr"
              id="kalenderMehrKnopf" aria-expanded="${mehrOffen}" aria-controls="kalenderMehr">
        Was an Google geht · Grenzen <span class="chev">▼</span></button>
      <div id="kalenderMehr"${mehrOffen ? '' : ' hidden'}>
      <div class="small muted" id="kalenderWer" style="margin-top:8px">An Google geht nur, was im Kalender
        steht – Titel, Übungen, Tage und Uhrzeit –, in dein eigenes Konto; kein Server der App sieht es. Google fragt
        beim Einrichten nach Zugriff auf alle deine Kalender, so ist Googles Baustein gebaut. Das Skript fasst
        trotzdem nur „Workout" an – das ist eine Regel in seinem Code, keine Sperre von Google.</div>
      <div class="small muted" id="kalenderGrenze" style="margin-top:6px">Ehrlich dazu: Was die App nicht schicken
        konnte, gilt im Kalender als nicht trainiert. Trainierst du ohne Netz, schiebt er das Training womöglich
        weiter, bis die App wieder Netz hat – auf Android schickt sie es dann von selbst nach, meist auch bei
        geschlossener App. Öffnest du die App sechs Wochen lang nicht, ist der Plan aufgebraucht: Der Kalender
        schiebt dann nicht mehr und sagt es dir mit einem Termin. Und Kennwort und URL reisen mit Sicherung und
        Exportdatei: Wer die Exportdatei hat, kann damit Termine in „Workout" schreiben, sonst nichts.</div>
      </div>`;
  // Die Meldung einer Handlung („Verbinden", „Code kopieren", „Trennen") gilt,
  // bis ein neueres Ergebnis da ist – dann sagt kalenderStandText() den Stand.
  // Vorher stand nach dem Verbinden über „✓ Verbunden. Zuletzt angekommen …"
  // weiter groß „Noch keine Vorschau angekommen", die ganze Sitzung lang.
  const ueberholt = !!(l.letzte && Number.isInteger(l.letzte.nr) && l.letzte.nr > (ui.kalenderMeldungNr || 0));
  const meldung = ui.kalenderMeldung && !ueberholt ? `<div class="hint" id="kalenderMeldung"
        style="color:${ui.kalenderGut ? 'var(--ok)' : 'var(--accent)'};margin-top:8px">${esc(ui.kalenderMeldung)}</div>` : '';
  const codeText = ui.kalenderCodeText ? `<textarea class="io" id="kalenderCodeText" readonly
        aria-label="Code für Apps Script">${esc(ui.kalenderCodeText)}</textarea>` : '';
  const urlFeld = (platzhalter, haupt) => `<input type="url" class="name-input" id="kalenderUrl" inputmode="url"
        autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="${esc(platzhalter)}"
        aria-label="Web-App-URL des Skripts">
      <div class="btn-row">
        <button type="button" class="btn${haupt ? ' btn-primary' : ''}" data-act="kalender-verbinden"
                ${ui.kalenderLaeuft ? 'disabled' : ''}>Verbinden</button>
      </div>`;
  const offenAus = l.ausstehend ? `<div class="small" id="kalenderAusOffen" style="margin-top:8px">📅 Ein Trennen
        wartet noch auf Netz – die App schickt es dem Skript, sobald welches da ist.</div>` : '';
  if (!l.verbunden) {
    return `<div class="card" id="kalenderAuto">${was}
      <div class="lbl" style="margin-top:12px">Einrichten – einmal, am Handy</div>
      <ol class="small kalender-schritte" id="kalenderSchritte">
        <li>Unten „Code kopieren" tippen. Darin steckt ein Kennwort nur für deinen Kalender – nicht weitergeben.</li>
        <li>In Chrome <i>script.google.com</i> öffnen, im Drei-Punkte-Menü <i>Desktopwebsite</i> anhaken und dein
          Projekt öffnen – das von der Probe (sonst <i>script.new</i>).</li>
        <li>Den ganzen Code dort durch deinen ersetzen und speichern.</li>
        <li>Oben die Funktion <i>einrichten</i> wählen und <i>Ausführen</i> tippen. Fragt Google nach Zugriff:
          <i>Berechtigungen prüfen</i> → dein Konto → <i>Erweitert</i> → <i>… öffnen (unsicher)</i> →
          <i>Zulassen</i>. Warten, bis unten „Ausführung abgeschlossen" steht.</li>
        <li><i>Bereitstellen → Bereitstellungen verwalten → Bearbeiten</i> (Stift) <i>→ Version: Neue Version →
          Bereitstellen</i> – die URL bleibt dieselbe. Gibt es noch keine Bereitstellung: <i>Bereitstellen → Neue
          Bereitstellung → Web-App</i>, „Ausführen als: Ich", „Zugriff: Jeder".</li>
        <li>Die <i>Web-App-URL</i> (endet auf /exec) kopieren, hier einfügen und <i>Verbinden</i> tippen.</li>
      </ol>
      <div class="btn-row">
        <button type="button" class="btn${l.token ? '' : ' btn-primary'}" data-act="kalender-code">Code kopieren</button>
      </div>
      ${l.token ? `<div class="small muted" id="kalenderKennwort" style="margin-top:6px">Das Kennwort ist fest
        gespeichert – noch einmal kopieren gibt denselben Code.</div>` : ''}
      ${codeText}
      ${urlFeld('https://script.google.com/macros/s/…/exec', l.token)}
      ${meldung}${offenAus}
      ${wer}
    </div>`;
  }
  const optionen = [...KALENDER_ERINNERUNGEN];
  if (!optionen.some(([v]) => v === l.erinnerung)) optionen.push([l.erinnerung, `${l.erinnerung} Min.`]);
  // Ein neues Skript-Projekt braucht Tobi so gut wie nie – zugeklappt, und
  // „Verbinden" dort nicht als auffälligster Knopf der Karte.
  const neuOffen = !!ui.kalenderNeu;
  return `<div class="card" id="kalenderAuto">${was}
      <div class="small" id="kalenderStand" style="margin-top:8px">${esc(kalenderStandText(l))}</div>
      ${l.zuAlt ? `<div class="notice warn" id="kalenderErneuern" style="margin-top:8px">${esc(kalenderSatz({ ergebnis: 'format', hinweis: 'erneuern' }))}</div>` : ''}
      ${meldung}
      <div class="zeit-row">
        <label class="zeit"><span class="lbl">Uhrzeit</span>
          <input type="time" id="kalenderUhrzeit" data-act="kalender-uhrzeit" step="300"
                 value="${esc(kalenderUhr(l.minuten))}"></label>
        <label class="zeit"><span class="lbl">Erinnerung vorher</span>
          <select id="kalenderErinnerung" data-act="kalender-erinnerung">
            ${optionen.map(([v, t]) => `<option value="${v}"${v === l.erinnerung ? ' selected' : ''}>${esc(t)}</option>`).join('')}
          </select></label>
      </div>
      <div class="small muted" style="margin-top:6px">Uhrzeit (Berliner Zeit) und Erinnerung stellst du hier ein,
        nicht im Kalender – das Skript gleicht seine Termine jede Stunde an. Siehst du „Workout" am Handy nicht:
        Google-Kalender-App → Einstellungen → Workout → <i>Synchronisieren</i>.</div>
      <div class="small muted" id="kalenderMail" style="margin-top:6px">Schickt Google dir eine Mail „Summary of
        failures", kommt sie von diesem Skript: Beim stündlichen Abgleich ist etwas schiefgegangen, und in der Mail
        steht, was. Meist hilft, in Apps Script einmal <i>einrichten</i> auszuführen – sonst dem Assistenten Bescheid
        geben.</div>
      <div class="btn-row">
        <button type="button" class="btn" data-act="kalender-code">Code kopieren</button>
        <button type="button" class="btn btn-ghost" data-act="kalender-trennen"
                ${ui.kalenderLaeuft ? 'disabled' : ''}>Trennen</button>
      </div>
      <div class="small muted" style="margin-top:6px">„Code kopieren" brauchst du nur, wenn hier „Kalender-Code
        erneuern" steht. „Trennen": Die Termine ab heute verschwinden aus „Workout", und das Skript schiebt nichts
        mehr; ganz weg ist es erst, wenn du das Projekt in Apps Script löschst.</div>
      ${codeText}
      ${wer}
      <button type="button" class="detail-toggle ${neuOffen ? 'on' : ''}" data-act="kalender-neu" id="kalenderNeuKnopf"
              aria-expanded="${neuOffen}" aria-controls="kalenderNeu">Neues Skript-Projekt? <span class="chev">▼</span></button>
      <div id="kalenderNeu"${neuOffen ? '' : ' hidden'}>
        <div class="small muted" style="margin-top:6px">Nur, wenn du in Apps Script ein neues Projekt angelegt hast:
          seine Web-App-URL hier einfügen. Das alte bekommt dann ein „Trennen".</div>
        ${urlFeld('https://script.google.com/macros/s/…/exec', false)}
      </div>
      ${offenAus}
    </div>`;
}

/**
 * Eine Meldung der Karte setzen – mit der Nummer des letzten Versuchs, damit
 * die Karte sie wegnimmt, sobald ein neueres Ergebnis da ist (kalenderKarte()).
 */
function kalenderMelden(text, gut, nr = null) {
  ui.kalenderMeldung = text;
  ui.kalenderGut = !!gut;
  ui.kalenderMeldungNr = Number.isInteger(nr) ? nr : ((kalenderLage().letzte || {}).nr || 0);
}

/** „Code kopieren": erst das Kennwort fest speichern, dann kopieren – oder zum Abschreiben zeigen. */
async function kalenderCodeKopieren() {
  let code;
  try {
    code = await kalenderCode();
  } catch (e) {
    kalenderMelden(e && e.code === 'speicher' ? e.message
      : 'Die Vorlage des Codes ist gerade nicht da – mit Netz noch einmal tippen.', false);
    notieren('kalender', { was: 'code', ok: false, grund: e && e.code === 'speicher' ? 'speicher' : 'vorlage' }, true);
    render();
    return;
  }
  const gut = () => {
    ui.kalenderCodeText = '';
    // Verbunden gibt es die nummerierten Schritte nicht – dort braucht man den
    // Code zum Erneuern, und ohne „Neue Version" liefe die Web-App mit dem alten.
    kalenderMelden(kalenderVerbunden()
      ? 'Code kopiert. In Apps Script den ganzen Code damit ersetzen, speichern, „einrichten" ausführen, dann '
        + 'Bereitstellen → Bereitstellungen verwalten → Bearbeiten (Stift) → Version: Neue Version → Bereitstellen.'
      : 'Code kopiert. Jetzt in Apps Script den ganzen Code damit ersetzen (Schritt 2 und 3).', true);
    notieren('kalender', { was: 'code', ok: true, kopiert: true });
    render();
  };
  const zeigen = () => {
    ui.kalenderCodeText = code;
    kalenderMelden('Kopieren ging nicht – der Code steht unten markiert, dort lang drücken und kopieren.', false);
    notieren('kalender', { was: 'code', ok: true, kopiert: false });
    render();
    const ta = document.getElementById('kalenderCodeText');
    if (ta) { ta.focus(); ta.select(); }
  };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(code).then(gut, zeigen);
    return;
  }
  zeigen();
}

async function kalenderVerbindenTipp() {
  const feld = document.getElementById('kalenderUrl');
  const eingabe = feld ? feld.value : '';
  ui.kalenderLaeuft = true;
  kalenderMelden('Frage das Skript …', true);
  render();
  let r;
  try {
    r = await kalenderVerbinden(eingabe);
  } catch {
    r = { ok: false, satz: 'Das ging gerade nicht – noch einmal versuchen.' };
  }
  ui.kalenderLaeuft = false;
  // Gelungen und nichts zu tun: ein Satz, der bis zur ersten Vorschau gilt –
  // dann übernimmt der Stand der Karte. Bittet das Skript um etwas (einrichten,
  // ein anderes Projekt pflegt den Kalender) oder ist sein Code zu alt: dessen
  // Satz, in der Farbe für „da ist etwas zu tun", ohne Versprechen.
  if (r.ok && !(r.handeln || r.zuAlt)) {
    kalenderMelden('Verbunden – die erste Vorschau ist unterwegs. Nach etwa einer Minute stehen die Termine in „Workout".', true, r.nr);
  } else {
    kalenderMelden(r.satz || 'Verbunden.', false, r.nr);
  }
  if (r.ok) ui.kalenderNeu = false;
  ui.kalenderCodeText = '';
  render();
  // Was er eingefügt hatte, bleibt im Feld stehen, wenn es nicht ging – zum Ausbessern.
  if (!r.ok) {
    const neu = document.getElementById('kalenderUrl');
    if (neu) neu.value = eingabe;
  }
}

async function kalenderTrennenTipp() {
  ui.kalenderLaeuft = true;
  render();
  let r;
  try {
    r = await kalenderTrennen();
  } catch {
    r = { satz: 'Getrennt.' };
  }
  ui.kalenderLaeuft = false;
  kalenderMelden(r.satz, true);
  render();
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
 *
 * Nicht auf einer Einheit, die an einem früheren Tag trainiert und
 * abgeschlossen ist (frueherFertig()) – „Doch noch weitermachen" auf einer
 * Einheit von gestern, auch nach dem Tagesabschluss (bis v242 ebenso „Rest
 * heute machen" in seiner Zeile). Dort hieß „Abbrechen" „doch nicht heute",
 * und es löschte das Training von Samstag
 * mit: Workout 12 war untrainiert, der Plan rückte einen Tag, und am Sonntag
 * stand „Heute · Workout 12" da. Was an einem früheren Tag trainiert ist, nimmt
 * ein Abbruch von heute nicht zurück; dann bleibt nur „Abschließen", und ein
 * versehentlicher Haken lässt sich einzeln zurücknehmen. Eine Einheit von
 * heute verwirft „Abbrechen" weiter ganz, auch nach „Doch noch weitermachen"
 * (tests/test-new.mjs) – und ein Training über Mitternacht ebenso, es ist
 * noch nicht abgeschlossen.
 */
function sessionButtons(n, mode) {
  const prog = progressOf(n, mode);
  return `
    <div class="btn-row nav">
      ${frueherFertig(n) ? '' : '<button type="button" class="btn btn-danger" data-act="discard-session">Abbrechen</button>'}
      <button type="button" class="btn btn-ok" data-act="finish-session">
        ✓ Abschließen${prog.done ? ` (${prog.done}/${prog.total})` : ''}
      </button>
    </div>`;
}

/** An einem früheren Tag angefangen und abgeschlossen – siehe sessionButtons(). */
function frueherFertig(n) {
  const tag = store.startedOn(n);
  return !!tag && tag < todayISO() && !!completedMode(n);
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
function sound(name, wann) {
  const s = store.getState();
  if (!s.sound) return;
  if (name === 'set' && !s.soundSets) return;
  playSound(name, wann);
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
    if (!document.hidden) {
      notieren('pause', { was: 'meldung', weg: 'seite', gezeigt: false, grund: 'sichtbar' });
      return;
    }
    const opt = {
      body: text,
      tag: NOTE_TAG,          // ersetzt eine ältere, statt sie zu stapeln
      // Nur `badge`, und nicht das App-Symbol: Mit `icon` daneben zeichnet
      // Android dieselbe Hantel zweimal, und als Schablone taugt icon-192.png
      // nicht – sie ist deckend, es bliebe ein weisser Kasten. Siehe badge.svg.
      badge: './badge-96.png',
      vibrate: [180, 90, 180],
    };
    // Fürs Diagnoseprotokoll erst das Ergebnis, nicht den Versuch: Bis zum
    // Gegenlesen stand hier vorher „gezeigt=true", und ein Fehlschlag verschwand
    // im catch – auf Chrome Android wirft `new Notification()` ohne Service
    // Worker („Illegal constructor"), und genau die Frage „kam die Meldung?"
    // war damit falsch beantwortet.
    let ueber;   // bleibt leer, wenn schon die Frage nach dem Worker scheitert
    swReg().then((reg) => {
      if (reg) {
        ueber = 'worker';
        return reg.showNotification('Pause vorbei', opt);
      }
      ueber = 'konstruktor';
      new Notification('Pause vorbei', opt);
      return undefined;
    }).then(
      () => notieren('pause', { was: 'meldung', weg: 'seite', gezeigt: true, ueber }),
      (e) => notieren('pause', {
        was: 'meldung', weg: 'seite', gezeigt: false, ueber, name: (e && e.name) || 'Fehler', msg: e && e.message,
      }),
    );
  }, Math.max(0, secs) * 1000);
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
    // Ohne Berührung seit dem Laden legt der Tonkanal nichts auf – er merkt
    // sich stattdessen diesen Aufruf und holt ihn nach der ersten Berührung
    // nach, mit dann frisch gerechneter Restzeit. Bis dahin ist restArmed
    // false, und endRest() sorgt am Ende selbst für den Ton.
    restArmed = scheduleSound([['ready', left - VORLAUF], ['rest', left]], armRest);
  } else {
    cancelSound();
    restArmed = false;
  }
  planNote(left, rest.next);
  notieren('pause', {
    was: 'auflegen', rest: Math.round(left), armed: restArmed, toene: !!store.getState().sound,
    meldung: noteAllowed() ? (navigator.serviceWorker && navigator.serviceWorker.controller ? 'worker' : 'seite') : 'aus',
  });
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
  } catch (e) {
    wakeLock = null; // nicht unterstützt oder abgelehnt – kein Beinbruch
    notieren('pause', { was: 'wakelock', an: on, ok: false, name: e && e.name });
  }
}

function startRest(exName, setIndex, sets, secs, exId = null) {
  if (!secs) return;
  notieren('pause', { was: 'start', dauer: secs, ex: exId, satz: setIndex + 1, von: sets });
  store.setRest({
    endsAt: Date.now() + secs * 1000,
    total: secs,
    next: `Satz ${setIndex + 2} von ${sets} · ${exName}`,
    ex: exId,   // wessen Pause – siehe leistenPause()
  });
  announce(`Pause ${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')} Minuten, `
    + `danach Satz ${setIndex + 2} von ${sets}, ${exName}`);
  holdScreen(true);
  armRest();
  tickRest();
}

/*
 * Wie lange nach ihrem Ende eine Pause noch „gerade eben vorbei" ist.
 *
 * Nach einem Neustart der Seite ruft tickRest() auch für eine Pause endRest(),
 * die vor einer Stunde ablief – Leiste weg, Hinweis, fertig. Ein Gong dazu wäre
 * dann kein Signal mehr, sondern ein Rätsel. Innerhalb dieser Frist ist er es
 * noch: Das ist der Fall „Seite mitten in der Pause neu geladen, keiner hat
 * getippt", und dort kommt er nach der ersten Berührung nach – aber nur, wenn
 * die noch in die Frist fällt. Die Frist zählt ab dem Pausenende, nicht ab dem
 * Vormerken: Ohne sie kam der Gong beim ersten Tipp auch 70 s danach, mitten
 * in den nächsten Satz. Ist diese erste Berührung der nächste Haken, kommt er
 * auch innerhalb der Frist nicht – die neue Pause hat ihn überholt (siehe
 * nachholen() in js/audio.js).
 */
const NACHKLANG_MS = 60000;

function endRest(withSignal) {
  if (!restBar) return;
  const vorbei = store.getState().rest;
  holdScreen(false);
  store.setRest(null);
  restBar.classList.remove('ready');
  /*
   * Das Signal liegt auf der Audio-Uhr – aber hat es gespielt? Vier Fälle:
   *
   *   erklungen / läuft   Es kam oder kommt gerade. Noch einmal anstoßen gäbe
   *                       ein Echo; cancelSound() lässt es ausklingen.
   *   offen               Es liegt noch vor uns – weil der Kontext im
   *                       Hintergrund angehalten war und seine Uhr hinter der
   *                       Wanduhr zurückliegt. Dann käme es nie oder zur
   *                       Unzeit: verwerfen und jetzt den Ton geben.
   *   keins               Nichts lag auf der Uhr (kein Ton freigeschaltet,
   *                       Töne aus, kein Web Audio) – jetzt den Ton geben.
   *
   * Vor diesem Umbau stand hier `if (!restArmed) sound('rest')` – und
   * tickRest() beendete die Pause bis zu eine halbe Sekunde zu früh, sodass
   * cancelSound() das vorausgelegte Signal jedes Mal vor seinem Start stoppte:
   * Das lauteste Signal der App kam im Vordergrund nie. *„Jetzt fehlt iwie die
   * Pause"* – und *„es gibt iwie überhaupt keine sounds"*.
   *
   * Ohne Berührung seit dem Laden merkt sich playSound() den Ton und holt ihn
   * bei der ersten nach – aber nur, wenn die Pause gerade eben zu Ende ging
   * (NACHKLANG_MS), nicht für eine, die beim Neustart längst vorbei war, nur
   * bis NACHKLANG_MS nach dem Ende, und nicht, wenn diese Berührung selbst
   * einen Ton anstößt (eine neue Pause), der nächste Haken ist – auch ein
   * stummer – oder die Töne ausschaltet (tonUeberholt()).
   *
   * Aufgeräumt wird danach mit `ausklingen` nur am echten Ende: Ein Signal,
   * das in den nächsten 0,3 s anfängt, ist das dieses Endes. Bei „Pause weg"
   * (withSignal false) geht auch das – wer wegtippt, will keinen Gong mehr.
   * Gibt es einen Ersatz, zählt der liegengebliebene nicht als verpasst; gibt
   * es keinen (Pause schon zu lange vorbei), zählt er – er war fällig und kam
   * nie.
   */
  const stand = restArmed ? signalStand('rest') : 'keins';
  const frisch = !vorbei || Date.now() - vorbei.endsAt < NACHKLANG_MS;
  const ersatz = withSignal && frisch && stand !== 'erklungen' && stand !== 'laeuft';
  // Die Stelle von „Jetzt fehlt iwie die Pause": was hier entschieden wurde.
  // `spaet` nur nach dem Ende, davor `rest` (wie viel noch übrig war) – beim
  // Gegenlesen stand bei einem Abbruch „spaet=-4", und der Name sagte das
  // Gegenteil.
  const ueberzogen = vorbei ? Math.round((Date.now() - vorbei.endsAt) / 1000) : undefined;
  notieren('pause', {
    was: withSignal ? 'ablauf' : 'abbruch', stand, frisch, ersatz, toene: !!store.getState().sound,
    leiste: !restBar.hidden, sichtbar: !document.hidden,
    spaet: ueberzogen !== undefined && ueberzogen >= 0 ? ueberzogen : undefined,
    rest: ueberzogen !== undefined && ueberzogen < 0 ? -ueberzogen : undefined,
  });
  if (ersatz) sound('rest', vorbei ? { faellig: vorbei.endsAt, bis: vorbei.endsAt + NACHKLANG_MS } : undefined);
  cancelSound({ ausklingen: withSignal, ersetzt: ersatz ? 'rest' : null });
  // Bei einer abgebrochenen Pause den Hinweis abbestellen – bei einer
  // abgelaufenen gerade nicht: Der Wecker soll noch losgehen, falls die App im
  // Hintergrund ist. (Diese Zeile läuft seit v241 erst nach dem Ende, nicht
  // mehr bis zu eine halbe Sekunde davor.)
  if (!withSignal) dropNote();
  restArmed = false;
  if (withSignal) {
    if (navigator.vibrate) navigator.vibrate([180, 90, 180]);
    announce('Pause vorbei, nächster Satz');
  } else {
    announce('');
  }
  // Im Supersatz kann unten trotzdem noch etwas stehen: die Pause der gezeigten
  // Übung, wenn es nicht die war, die eben zu Ende ging (leistenPause()).
  tickRest();
}

function tickRest() {
  // Sollten Seite und Skript aus unterschiedlich alten Zwischenspeichern
  // stammen, fehlt die Leiste - dann lieber ohne Timer weiterlaufen als alles
  // mit einem Fehler anhalten.
  if (!restBar) return;
  const laeuft = store.getState().rest;
  // Das Ende der Pause, auf die der Ablauf wartet, meldet sich – gleich, was
  // die Leiste gerade zeigt. endRest() zeichnet die Leiste danach selbst neu.
  //
  // Erst NACH dem Endzeitpunkt, nicht gerundet: Mit `Math.round(...) <= 0`
  // endete die Pause bei 0,49 s Rest – und endRest() verwarf das Signal, das
  // 0,25 bis 0,5 s später auf der Audio-Uhr lag, vor seinem Start. Gemessen:
  // in jeder Runde, 0,499 s und 0,511 s zu früh, das Pausensignal kam im
  // Vordergrund nie. Die Anzeige rundet weiter (unten, Math.max(1, …)) und
  // zeigt in der letzten halben Sekunde 0:01 statt 0:00.
  if (laeuft && laeuft.endsAt - Date.now() <= 0) {
    endRest(true);
    toast('Pause vorbei – nächster Satz');
    return;
  }
  const rest = leistenPause();
  if (!rest) {
    restBar.hidden = true;
    document.body.classList.remove('resting');
    // Der Takt läuft weiter, solange eine Pause läuft, auch wenn sie gerade
    // nicht zu sehen ist – sonst käme ihr Ende nie an.
    if (!laeuft && restTicker) { clearInterval(restTicker); restTicker = null; }
    return;
  }

  const left = Math.max(1, Math.round((rest.endsAt - Date.now()) / 1000));
  restBar.hidden = false;
  document.body.classList.add('resting');
  // Die letzten Sekunden gehören dem Weg zur Hantel, nicht mehr der Pause.
  const gleich = left <= VORLAUF;
  restBar.classList.toggle('ready', gleich);
  if (restLabel) restLabel.textContent = gleich ? 'Fertig machen' : 'Pause';
  restTime.textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
  restNext.textContent = rest.next;
  // Gedeckelt: Eine Pause, die länger ist als ihr Ganzes, zeigt einen vollen
  // Balken und keinen, der über den Rand hinausläuft.
  restFill.style.width = `${Math.min(100, Math.max(0, (left / rest.total) * 100))}%`;

  if (!restTicker) restTicker = setInterval(tickRest, 250);
}

/** Laufzeit des Trainings im Kopfbereich mitzählen, ohne neu zu rendern. */
setInterval(() => {
  const badge = document.getElementById('sessionBadge');
  if (!badge || !store.getState().session) return;
  const secs = store.sessionSeconds();
  badge.textContent = `⏱ ${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
}, 1000);

/*
 * Die beiden Knöpfe gelten der Pause, die unten steht – im Supersatz also der
 * der gezeigten Übung, nicht unbedingt der, deren Ende gleich klingelt.
 */
document.getElementById('restSkip')?.addEventListener('click', () => {
  const gezeigt = leistenPause();
  if (!gezeigt) return;
  notieren('pause', { was: 'weg', ex: gezeigt.ex, eigene: gezeigt === store.getState().rest });
  // Weggetippt ist weggetippt: Auch wer danach zu dieser Übung zurückwischt,
  // bekommt die Pause nicht noch einmal (leistenPause() rechnet aus satzUhr).
  if (gezeigt.ex) { satzUhr.delete(gezeigt.ex); satzPlus.delete(gezeigt.ex); uhrMerken(); }
  // Die Pause, auf die der Ablauf wartet, endet nur, wenn sie es war, die
  // unten stand. Tippt man beim Partner dessen Pause weg, klingelt die andere
  // trotzdem.
  if (gezeigt === store.getState().rest) endRest(false);
  else tickRest();
});
document.getElementById('restPlus')?.addEventListener('click', () => {
  const gezeigt = leistenPause();
  if (!gezeigt) return;
  const rest = store.getState().rest;
  notieren('pause', { was: '+30', ex: gezeigt.ex, eigene: gezeigt === rest });
  // Die 30 s gehören zur Übung, nicht zur Leiste – beim Zurückwischen bleiben
  // sie, und zwar auch im Ganzen, an dem der Balken misst (satzPlus).
  if (gezeigt.ex && satzUhr.has(gezeigt.ex)) {
    satzUhr.set(gezeigt.ex, satzUhr.get(gezeigt.ex) + 30000);
    satzPlus.set(gezeigt.ex, (satzPlus.get(gezeigt.ex) || 0) + 30);
    uhrMerken();
  }
  if (gezeigt === rest) {
    store.setRest({ ...rest, endsAt: rest.endsAt + 30000, total: rest.total + 30 });
    armRest(); // Signal 30 s weiter hinten neu auflegen
  }
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
  openSchmerz: new Set(), // aufgeklappte Schmerzstellen, je "<übung>|<ort>"
  standAngebot: null,      // Stand, den jemand per Link geschickt hat
  standZurueck: null,      // Name, dem man seinen Stand noch zurückschicken wollte
  adminDaten: null,        // geladene Zeilen der Betreiber-Übersicht
  adminFehler: '',
  adminLaeuft: false,
  // Das Formular für „Sport außerhalb des Plans". Nur im Arbeitsspeicher: Das
  // ist eine Eingabe, kein Zustand, den man wiederfinden will – beim nächsten
  // Öffnen steht wieder „Heute" da und keine Aktivität.
  terminDatum: '',         // leer heißt heute
  terminAkt: '',           // gewählte Aktivität aus js/aktivitaeten.js
  terminMin: 0,            // 0 heißt: die übliche Dauer dieser Aktivität
  terminSuche: '',
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
  // Die Übung, die renderFocus() zuletzt gezeichnet hat, oder null – daran
  // liest die Pausenleiste im Supersatz ab, wessen Pause sie zeigt
  // (leistenPause()).
  gezeigt: null,
  // Hat der erste Haken einer Einheit den Plan auf heute vorgezogen, steht
  // hier, welcher Stand vorher galt – nimmt man den Haken gleich wieder
  // zurück, gilt er wieder (toggle-set).
  vorgezogen: null,
  // Steht die stille Zeile zum Ton im Dashboard? Gesetzt über onTonStand(),
  // wenn der Tonkanal nach einer Berührung weiter schläft (tonHinweis()).
  tonHinweis: false,
  // Kalender: gezeigter Monat und der angetippte Tag. Beides fängt bei der
  // nächsten offenen Einheit an, nicht stur bei heute – wer den Tab öffnet,
  // will meistens wissen, was als Nächstes kommt.
  calMonth: null,
  calDay: null,
  // Automatische Sicherung (js/sicherung.js) – nur, was gerade auf dem
  // Bildschirm steht: ein Schlüssel aus einem Wiederherstellungs-Link, ob das
  // Eingabefeld offen ist, was beim Zurückholen schiefging, und warum das
  // Teilen der Datei zuletzt abgelehnt wurde.
  sicherungAngebot: null,
  sicherungEingabe: false,
  sicherungMeldung: '',
  sicherungLaeuft: false,
  sicherungLinkText: '',
  teilenFehler: '',
  // Diagnoseprotokoll unter Mehr → Daten: ganzer Text aufgeklappt, und warum
  // das Teilen nicht ging (wie teilenFehler bei der Sicherung).
  diagnoseOffen: false,
  diagnoseFehler: '',
  // Google Kalender automatisch (js/kalender-sync.js), Mehr → Kalender: was
  // „Code kopieren", „Verbinden" und „Trennen" eben gesagt haben, ob gerade
  // eins davon läuft, und der Code zum Abschreiben, wenn das Kopieren nicht
  // ging. Kennwort und Adresse stehen nur im Code und im Eingabefeld.
  kalenderMeldung: '',
  kalenderMeldungNr: 0,
  kalenderGut: false,
  kalenderMehr: false,   // „Was an Google geht · Grenzen" aufgeklappt
  kalenderNeu: false,    // „Neues Skript-Projekt?" aufgeklappt
  kalenderLaeuft: false,
  kalenderCodeText: '',
};

/* ------------------------------------------------------------------ *
 * Dashboard
 * ------------------------------------------------------------------ */

/**
 * Index der Übung, die als Nächstes dran ist: der ersten, in der noch ein Satz
 * offen ist.
 *
 * Mit Supersätzen entscheidet der Wechsel (naechsterOffen() in
 * js/supersatz.js): Nach A1 ist B dran, obwohl A in der Planreihenfolge vorn
 * steht und noch Sätze offen hat. Vorher kannte diese Funktion nur die
 * Planreihenfolge: Nach dem Neuladen stand wieder A da, wo superWeiter() eben
 * noch zu B gesprungen war, und Tobi machte A2 vor B1. Jetzt dieselbe Antwort
 * für alle, die fragen – das Neuladen, „Training fortsetzen" und das
 * Weiterrücken nach einer fertigen Übung.
 */
function firstOpenExercise(n, mode) {
  const w = workoutByNo(n, mode);
  if (superAn()) {
    const ziel = naechsterOffen(superGruppen(n, mode), satzSteht(n, mode));
    const idx = ziel ? w.ex.findIndex((x) => x.id === ziel.id) : -1;
    if (idx >= 0) return idx;
  }
  const idx = w.ex.findIndex((item) => {
    return saetzeErledigt(n, item.id, item.sets) < item.sets;
  });
  return idx === -1 ? w.ex.length - 1 : idx;
}

/**
 * Die Nacharbeit einer Einheit festhalten, bevor in ihr etwas eingetragen wird.
 *
 *     Workout 4 bekam „+1 nachgeholt" auf Schulterdrücken und Crunches, 17
 *     Sätze. Nach dem dritten Crunch-Satz endete die Einheit von selbst bei
 *     16/17 und meldete „Alle 15 Sätze stehen".
 *
 * Die Nacharbeit wurde bei jedem Zeichnen neu gerechnet und fiel weg, sobald
 * die Grundsätze standen (siehe nacharbeit() in js/plan.js). Jetzt gilt ab dem
 * ersten Eintrag, was beim Start angesagt war – für beide Varianten, damit ein
 * Wechsel unter Mehr sie nicht verliert. Eine Einheit, die das schon hat, oder
 * eine eigene ohne Nacharbeit bleibt unberührt.
 */
function nachFesthalten(n) {
  if (istCustom(n) || !PLAN[n - 1]) return;
  const e = store.getState().log[n];
  if (e && e.nachFest) return;
  const jeModus = {};
  // Und mit ihr, woher sie kommt (die Zeile unter der Satzzahl, nachZeile()) –
  // ebenfalls für beide Varianten. Nur für Übungen, die wirklich Nacharbeit
  // tragen, und nur als schlichte Objekte: Das landet im Speicher.
  const warum = {};
  ['db', 'bw'].forEach((m) => {
    const x = nacharbeit(PLAN[n - 1], m);
    jeModus[m] = x ? Object.fromEntries(x) : {};
    const p = x ? nacharbeitPlan(PLAN[n - 1], m) : null;
    warum[m] = p ? Object.fromEntries([...p.warum].filter(([id]) => x.has(id))) : {};
  });
  store.halteNachFest(n, jeModus, warum);
  const ex = Object.entries(jeModus).filter(([, o]) => Object.keys(o).length)
    .map(([m, o]) => `${m}:${Object.keys(o).join('+')}`).join(' ');
  if (ex) notieren('nach', { n, ex });
}

/**
 * Den eingefügten Zusatztag festhalten, bevor in der Einheit etwas eingetragen
 * wird – wie die Nacharbeit, aus demselben Grund und am selben Ort.
 *
 *     „Was soll das mit zweite Einheit. Wenn heute Übungen dazu kommen dann
 *      soll alles flüssig in EINE Einheit"
 *
 * Bis zum ersten Eintrag kommen die Übungen live aus dem Träger (dem
 * „Zusatztag Woche N" unter den eigenen Workouts) und werden mit ihm neu
 * gerechnet. Ab dem ersten Eintrag ist die Einheit angefangen, und
 * angefangene Einheiten bleiben fest: Fest steht jetzt genau das, was auf dem
 * Bildschirm stand (zusatzListe() in js/plan.js), und der Träger ist im selben
 * Schritt verbraucht (store.halteZusatz()).
 *
 * Muss **vor** dem Eintrag laufen: Danach ist die Einheit angefangen, die
 * Bindung greift nicht mehr (zusatzEinheit()), und der Zusatz wäre aus der
 * Liste gefallen – samt dem Satz, der gerade abgehakt wird. Und vor
 * paarungFesthalten(), damit der Schlüssel der Paarung alle Übungen kennt.
 */
function zusatzFesthalten(n) {
  if (istCustom(n) || !PLAN[n - 1]) return;
  const e = store.getState().log[n];
  if (festerZusatz(e) || store.isStarted(n)) return;
  const b = zusatzBindung();
  if (!b || b.w.n !== n) return;
  const zus = workoutByNo(n, store.workoutMode(n)).ex.filter((it) => it.zusatz && it.zusatz.live);
  if (!zus.length) return;
  const warum = b.c.warum || {};
  store.halteZusatz(n, {
    woche: b.woche,
    ex: zus.map((it) => {
      const x = b.c.ex.find((y) => y.id === it.id);
      return { id: it.id, sets: x.sets, bwSets: x.sets };
    }),
    warum: Object.fromEntries(zus.map((it) => [it.id, warum[it.id]]).filter(([, v]) => v)),
  }, b.c.id);
  notieren('zusatz', { n, woche: b.woche, ex: zus.map((it) => it.id).join('+'), traeger: b.c.id });
}

/*
 * Woher ein Nachholsatz kommt – eine stille Zeile an der Übung.
 *
 *     „Jetzt vier Sätze je Übung? Wegen Wiederholung? Aber vorgestern hab ich
 *      ja goblet sqauds gemacht"
 *
 * An der Übung stand „4 Sätze … +1 nachgeholt". Die 4 las sich wie eine neue
 * Grundzahl, und wofür der Satz nachgeholt wird, stand nirgends. Jetzt steht
 * an der Übung die ganze Satzzahl („4 Sätze", seit v240 wieder die Summe –
 * v238 und v239 schrieben „3 + 1", siehe umfangText() in js/anzeige.js) und
 * darunter, wofür: der Tag und die Übung, die den Rückstand hinterlassen
 * haben, mit ihren Haken. „abgehakt",
 * weil die App nur Haken kennt – ob jemand den Satz gemacht und nicht
 * abgehakt hat, weiß sie nicht.
 *
 * Kein Popup, kein Toast, nichts wegzutippen: Die Zeile steht da, wo man den
 * Satz macht, und wer sie nicht braucht, liest darüber hinweg.
 */

/**
 * Der Tag einer früheren Einheit, vom Tag der Einheit aus gesehen: in
 * derselben Woche das Kürzel („Sa"), sonst mit Datum („Do 24.9.").
 * Keine relativen Wörter wie „vorgestern" – die Zeile bleibt im Verlauf
 * stehen, und dort stimmte „vorgestern" schon morgen nicht mehr.
 *
 * In beide Richtungen: Die Zeile am Ruhetag nennt auch kommende Tage so
 * („Mo", ruhetagZeile()). `mitDatum` erzwingt das Datum – dort, wo im selben
 * Satz ein zweiter Tag dasselbe Kürzel trägt.
 */
function tagKurz(isoQuelle, isoEinheit, mitDatum = false) {
  const wt = fmtDate(isoQuelle).slice(0, 2);
  const d = Math.abs(daysBetween(isoQuelle, isoEinheit));
  if (!mitDatum && d >= 1 && d <= 6) return wt;
  const [, mo, ta] = isoQuelle.split('-').map(Number);
  return `${wt} ${ta}.${mo}.`;
}

/** Die Herkunftszeile als Text (ohne HTML). `warum` aus nachWarumJe(), oder null. */
function nachText(w, mode, it, warum) {
  const N = it.nach;
  const heute = effDate(w);
  const tag = (nq) => (PLAN[nq - 1] ? tagKurz(effDate(PLAN[nq - 1]), heute) : `Workout ${nq}`);
  // Die Quelle heißt so, wie sie an *ihrem* Tag hieß – im Modus, in dem sie
  // trainiert wurde (`mq`, fünfter Eintrag in q). Wer am Donnerstag ohne
  // Hanteln trainiert hat, hat die Standwaage gemacht, nicht das Rumänische
  // Kreuzheben; die Zeile soll gerade das „aber ich hab doch …" beantworten,
  // da darf sie keine Übung nennen, die es an dem Tag nicht gab.
  const name = (id, mq) => {
    const ex = EX_BY_ID.get(id);
    return (ex && (ex[mq || mode] || ex.db || ex.bw) || {}).name || id;
  };
  // Ohne festgehaltene Erklärung (Altbestand, oder keine Rechnung kommt mehr
  // auf dieselben Sätze): nur die Tage, aus denen der Rest stammen kann – die
  // abgeschlossenen Einheiten dieser Woche vor dieser. Mit Wochentag wie der
  // Rest der Zeile („am Sa …", „(Sa 1 von 3)"), nicht mit Workout-Nummern,
  // die beim Training niemand im Kopf hat.
  const spanne = () => {
    const start = Math.floor((w.n - 1) / WEEK_SESSIONS) * WEEK_SESSIONS + 1;
    const tage = [];
    for (let k = start; k < w.n; k++) if (completedMode(k)) tage.push(tag(k));
    if (!tage.length) return '';
    const liste = tage.length === 1 ? tage[0] : `${tage.slice(0, -1).join(', ')} und ${tage[tage.length - 1]}`;
    return `Rest vom ${liste}`;
  };
  const mitSpanne = (kopf) => { const s = spanne(); return s ? `${kopf}: ${s}` : kopf; };
  const q = warum && Array.isArray(warum.q) ? warum.q : [];
  const g = warum && Array.isArray(warum.g) ? warum.g : [];
  if (!warum) return mitSpanne(`+${N} nachgeholt`);
  // Dieselbe Übung war an einem früheren Tag zu kurz: Das beantwortet die
  // Frage direkt – „vorgestern hab ich doch …".
  if (q.length === 1 && q[0][1] === it.id) {
    const [nq, , ab, von] = q[0];
    return ab > 0
      ? `+${N} nachgeholt: am ${tag(nq)} nur ${ab} von ${von} Sätzen abgehakt`
      : `+${N} nachgeholt: am ${tag(nq)} keinen von ${von} Sätzen abgehakt`;
  }
  const fuer = g.length ? ` für ${g.map((m) => MUSCLE_LABEL[m] || m).join(' und ')}` : '';
  if (!q.length) return mitSpanne(`+${N} nachgeholt${fuer}`);
  const quellen = q.slice(0, 2).map(([nq, id, ab, von, mq]) => `${name(id, mq)} (${tag(nq)} ${ab} von ${von})`).join(', ');
  const mehr = q.length > 2 ? ` und ${q.length - 2} weitere` : '';
  return `+${N} nachgeholt${fuer}: ${quellen}${mehr}`;
}

/** Die Zeile unter der Satzzahl, oder nichts, wenn die Übung keine Nacharbeit trägt. */
function nachZeile(n, mode, it, warumJe) {
  if (!it.nach || istCustom(n) || !PLAN[n - 1]) return '';
  const w = PLAN[n - 1];
  const je = warumJe === undefined ? nachWarumJe(w, mode) : warumJe;
  const text = nachText(w, mode, it, (je && je[it.id]) || null);
  return `<div class="nach-warum" id="nw-${esc(it.id)}">${esc(text)}</div>`;
}

/*
 * Woher eine Übung des Zusatztags kommt – dieselbe stille Zeile wie bei der
 * Nacharbeit, an derselben Stelle.
 *
 *     „Check ich nicht. Wann soll ich das machen?"
 *
 * Das fragte Tobi, als der Zusatztag allein auf der Startseite stand:
 * „Zusatztag Woche 2 · 2 Übungen · 6 Sätze", und kein Wort davon, woher die
 * Übungen kommen und warum sie heute dran sind. Jetzt steckt er in der
 * Einheit des Tages (einheitEx() in js/plan.js), der Kopf zählt sie mit
 * („6 Übungen"), und an der Übung steht, was sie nachholt: die Woche, die Gruppe
 * und die Übung, die dort liegen geblieben ist, mit ihren Haken.
 *
 * Kein Popup, kein Toast, nichts zum Wegtippen – wie bei der Nacharbeit.
 */

/** Die Herkunftszeile einer Zusatzübung als Text (ohne HTML). */
function zusatzText(w, it) {
  const z = it.zusatz;
  // Vom Tag der Einheit aus gesehen – beim allein stehenden Zusatztag ist das
  // der Tag, an dem er gemacht wird.
  const bezug = w.custom ? (store.startedOn(w.n) || todayISO()) : effDate(w);
  const tag = (nq) => (PLAN[nq - 1] ? tagKurz(effDate(PLAN[nq - 1]), bezug) : `Workout ${nq}`);
  const name = (id, mq) => {
    const ex = EX_BY_ID.get(id);
    return (ex && (ex[mq] || ex.db || ex.bw) || {}).name || id;
  };
  const kopf = `Nachgeholt aus Woche ${z.woche}`;
  const warum = z.warum;
  if (!warum) return kopf;
  const q = Array.isArray(warum.q) ? warum.q : [];
  const g = Array.isArray(warum.g) ? warum.g : [];
  // Dieselbe Übung ist in jener Woche liegen geblieben: Das beantwortet das
  // „Wann soll ich das machen?" am kürzesten.
  if (q.length === 1 && q[0][1] === it.id) {
    const [nq, , ab, von] = q[0];
    return ab > 0
      ? `${kopf}: am ${tag(nq)} nur ${ab} von ${von} Sätzen abgehakt`
      : `${kopf}: am ${tag(nq)} keinen von ${von} Sätzen abgehakt`;
  }
  const fuer = g.length ? ` für ${g.map((m) => MUSCLE_LABEL[m] || m).join(' und ')}` : '';
  if (!q.length) return `${kopf}${fuer}`;
  const quellen = q.slice(0, 2).map(([nq, id, ab, von, mq]) => `${name(id, mq)} (${tag(nq)} ${ab} von ${von})`).join(', ');
  const mehr = q.length > 2 ? ` und ${q.length - 2} weitere` : '';
  return `${kopf}${fuer}: ${quellen}${mehr}`;
}

/** Die Zeile an einer Zusatzübung, oder nichts. `w` ist die Einheit (workoutByNo()). */
function zusatzZeile(w, it) {
  if (!it.zusatz) return '';
  return `<div class="nach-warum" id="zw-${esc(it.id)}">${esc(zusatzText(w, it))}</div>`;
}

/**
 * Ist dieser Satz einer der nachgeholten (sie stehen am Ende)? Bei einer Übung
 * aus dem Zusatztag ist es jeder.
 */
const istNachSatz = (it, idx) => !!it.zusatz || (!!it.nach && idx >= it.sets - it.nach);

/** Beschriftung eines Satzknopfs – der Nachholsatz sagt, dass er einer ist. */
function satzLabel(it, idx) {
  return `Satz ${idx + 1} von ${it.sets}${istNachSatz(it, idx) ? ', nachgeholt,' : ''} erledigt`;
}

/**
 * Verweis auf die Herkunftszeile – nur am Nachholsatz selbst. An allen Knöpfen
 * hing sonst „+1 nachgeholt für …" auch an Satz 1 bis 3, und die
 * Vorlesefunktion hängte die Nacharbeit an jeden Grundsatz.
 */
function nachVerweis(it, idx) {
  // Eine Übung aus dem Zusatztag ist ganz nachgeholt – jeder Knopf verweist
  // auf ihre Herkunftszeile (zusatzZeile()).
  if (it.zusatz) return ` aria-describedby="zw-${esc(it.id)}"`;
  return istNachSatz(it, idx) ? ` aria-describedby="nw-${esc(it.id)}"` : '';
}

/**
 * Die Sätze einer Übung zum Anzeigen.
 *
 * Eine Übung aus einem noch nicht festgehaltenen Zusatztag (`live`) wird nur
 * gelesen, nicht angelegt: Bis zum ersten Eintrag kann der Zusatztag noch neu
 * gerechnet werden oder wegfallen, und dann lägen ein `soll`-Stempel und ein
 * leeres Satzfeld einer Übung im Protokoll, die nie in dieser Einheit stand –
 * festeListen() und die Nacharbeit läsen sie als „stand da, nicht angefasst".
 */
function saetzeZeigen(n, mode, it) {
  if (it.zusatz && it.zusatz.live) {
    const arr = (store.peekSets(n, mode, it.id) || []).slice();
    while (arr.length < it.sets) arr.push({ w: '', done: false });
    return arr;
  }
  return store.getSets(n, mode, it.id, it.sets, it.nach || 0);
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

/**
 * Wann war diese Übung zuletzt dran?
 *
 * Bis v222 nur im Arbeitsspeicher. Seit die Leiste unten der angezeigten Übung
 * folgt (leistenPause()), wird hier auch nachgelesen, wenn man nur zur
 * anderen Übung wischt – und nach einem Neuladen der Seite (kurz aus der App,
 * das Handy hat sie verworfen) wäre die Uhr leer gewesen: Die laufende Pause
 * wäre beim ersten Wischen verschwunden. Deshalb steht sie auch im Gerät, nur
 * dort, nie in der Sicherung, und nach drei Stunden ist sie bedeutungslos.
 */
const UHR_KEY = 'workout.satzuhr.v1';
const uhrRoh = (() => {
  try {
    const roh = JSON.parse(localStorage.getItem(UHR_KEY) || 'null');
    if (roh && Array.isArray(roh.m) && Date.now() - roh.t < 3 * 3600 * 1000) return roh;
  } catch { /* kein Speicher – dann eben nur im Arbeitsspeicher */ }
  return null;
})();
const satzUhr = new Map(uhrRoh ? uhrRoh.m : []);
/**
 * Wie viel „+30 s" in der Uhr einer Übung steckt.
 *
 * satzUhr verschiebt dafür den Zeitpunkt, damit die Wartezeit stimmt. Das Ganze,
 * an dem der Balken unten misst, wusste davon nichts: Nach „+30 s", einmal weg-
 * und zurückgewischt, stand die Restzeit bei 2:57 und das Ganze bei 2:30 – der
 * Balken lief mit 118 % über den Rand und blieb eine halbe Minute voll stehen
 * (gefunden bei der Durchsicht).
 */
const satzPlus = new Map(uhrRoh && Array.isArray(uhrRoh.p) ? uhrRoh.p : []);
const uhrMerken = () => {
  try {
    localStorage.setItem(UHR_KEY, JSON.stringify({ t: Date.now(), m: [...satzUhr], p: [...satzPlus] }));
  } catch (e) {
    notieren('speicher', { was: 'satzuhr', ok: false, name: e && e.name });   // s. o.
  }
};

const superAn = () => !!store.getState().supersatz;

/**
 * Die Paare dieser Einheit – und zwar, sobald trainiert wird, immer dieselben.
 *
 * Seit die Scheiben mitreden (passtZusammen() fragt zusammen() in
 * js/scheiben.js), hängt ein Paar am Gewicht. Neu gerechnet bei jedem Aufruf
 * hieß das: Ein Tipp auf + mitten im Supersatz löste das Paar auf. Der Hinweis
 * „Im Wechsel mit …" verschwand, nach dem nächsten Satz blieb die App bei
 * derselben Übung, und die angefangene Partnerübung rutschte hinter das nächste
 * Paar – bei Hip Thrust ↔ Schulterdrücken sechs Sätze weit (gefunden bei der
 * Durchsicht). Dasselbe beim Ändern des Vorrats unter Mehr. Die Paarung ist
 * aber ein Plan für diese Einheit, wie die Rüst-Reihenfolge
 * (ruestOrderStabil() in js/gewichte.js), keine ständig nachgeführte Rechnung.
 *
 * Festgehalten wird sie deshalb mit dem ersten abgehakten Satz, im Protokoll
 * der Einheit (paarungFesthalten()) – im Arbeitsspeicher allein hätte ein
 * Neuladen mit dem neuen Gewicht sie genauso gekippt. Vorher richtet sie sich
 * nach Gewicht und Vorrat: Wer unter Mehr seinen Vorrat einträgt, soll in der
 * Vorschau sehen, was daraus folgt. Ändern sich die Übungen selbst (Beschwerde
 * angehakt, Gerät weg, andere Fassung), ist es eine andere Einheit und wird
 * neu gepaart.
 *
 * Reichen die Scheiben nach einer Erhöhung nicht mehr für beide Aufbauten,
 * bleibt das Paar trotzdem – die Fokusansicht sagt dann, dass zwischen den
 * Sätzen umzustecken ist (scheibenReichen()), statt still umzustellen.
 */
function superGruppen(n, mode) {
  const items = workoutByNo(n, mode).ex.map((x) => resolve(x, mode));
  const fest = festePaarung(n, mode, items);
  return fest || paare(items, mode);
}

/** Welche Übungen eine Paarung meint – unabhängig von ihrer Reihenfolge. */
const paarungsKey = (items) => items.map((x) => x.id).sort().join(',');

/**
 * Die festgehaltene Paarung, falls sie zu genau diesen Übungen passt. Nach
 * der Reihenfolge wird nicht gefragt: Die Rüst-Reihenfolge wird beim Laden neu
 * bestimmt und hängt am Gewicht – an ihr darf eine festgehaltene Paarung nicht
 * zerbrechen.
 */
function festePaarung(n, mode, items) {
  const fest = store.paarung(n, mode);
  if (!fest || fest.key !== paarungsKey(items) || !Array.isArray(fest.gruppen)) return null;
  const byId = new Map(items.map((x) => [x.id, x]));
  const gruppen = fest.gruppen.map((g) => (Array.isArray(g) ? g.map((id) => byId.get(id)) : []));
  const ids = gruppen.flat();
  // Was aus einer Sicherung kommt, wird nicht geglaubt, sondern nachgezählt.
  const heil = gruppen.every((g) => g.length >= 1 && g.length <= 2 && g.every(Boolean))
    && ids.length === items.length && new Set(ids).size === items.length;
  return heil ? gruppen : null;
}

/** Mit dem ersten abgehakten Satz: Die Paarung gilt ab jetzt für die Einheit. */
function paarungFesthalten(n, mode) {
  if (!superAn()) return;
  const items = workoutByNo(n, mode).ex.map((x) => resolve(x, mode));
  if (festePaarung(n, mode, items)) return;
  store.setPaarung(n, mode, {
    key: paarungsKey(items),
    gruppen: paare(items, mode).map((g) => g.map((x) => x.id)),
  });
}

/** Steht diese Übung im Wechsel, und mit wem? */
function superPartner(n, mode, id) {
  if (!superAn()) return null;
  const g = gruppeVon(superGruppen(n, mode), id);
  return g && g.length === 2 ? g.find((x) => x.id !== id) : null;
}

/**
 * Was die Rüstzeile im Supersatz zusätzlich wissen muss (ruestHint() in
 * js/gewichte.js): in welcher Reihenfolge die Übungen wirklich drankommen, und
 * mit welcher Belegung diese Übung neben ihrem Partner steht. Ohne Supersatz
 * nichts davon – dann gilt die Liste.
 */
function ruestMit(n, mode, it) {
  if (!superAn()) return {};
  const ablauf = superGruppen(n, mode).flatMap((g) => schritte(g).map((s) => s.id));
  const partner = superPartner(n, mode, it.id);
  const beide = partner ? paarBelegung(it, partner, mode) : null;
  return { ablauf, belegung: (beide && beide.get(it.id)) || null };
}

/**
 * Im Supersatz zeigt die Leiste unten die Pause der Übung, die gerade zu
 * sehen ist.
 *
 *     „Bei supersatz soll unten die pausenzeit angezeigt werden von der Übung
 *      die grad angezeigt wird"
 *
 * Im Wechsel laufen zwei Pausen zugleich, eine je Übung. Sie sind aber nicht
 * gleich wichtig, und das trennt zwei Fragen:
 *
 *   **Was klingelt.** Ton, Vibration und Systemmeldung gehören der Pause, auf
 *   die der Ablauf wartet – der des nächsten Schritts, wie ihn superWeiter()
 *   oder das Abhaken gestartet hat (`store.rest`). Die läuft weiter, egal
 *   wohin man wischt. Zuerst tauschte die Leiste beim Wischen auch das
 *   Signal mit aus: Zur dritten, noch nicht begonnenen Übung gewischt, war die
 *   Pause samt Ton und Meldung weg; zum Partner gewischt, klingelte es zu
 *   dessen Ende statt zu dem der Übung, die als Nächste dran ist (gefunden
 *   bei der Durchsicht). Die Pause des Partners klingelt bewusst nicht: Ist
 *   sie kürzer, käme ihr Ton, während man noch auf die andere wartet.
 *
 *   **Was unten steht.** Die Pause der gezeigten Übung: ist es die laufende,
 *   genau die; sonst ihre eigene, aus der Uhr (satzUhr) gerechnet wie in
 *   superWeiter(); ist die Übung erholt, fertig oder noch gar nicht dran
 *   gewesen, nichts. Wischt man zurück, steht die andere wieder da – nichts
 *   davon ist verloren, es wird nur neu abgelesen.
 *
 * Abgelesen wird an dem, was renderFocus() zuletzt gezeichnet hat
 * (`ui.gezeigt`), und render() fragt nach jedem Zeichnen neu. Damit passt die
 * Leiste zu jeder Stelle, die ui.focusIdx setzt – vorher wurde nur nach dem
 * Wischen und Tippen nachgezogen, und nach „Training fortsetzen" oder dem
 * Neuladen stand unter den Liegestützen die Pause der Pull-ups.
 *
 * Ohne Supersätze bleibt alles beim Alten: Dort gibt es nur eine Pause.
 */
function leistenPause() {
  const rest = store.getState().rest;
  const g = ui.gezeigt;
  if (!superAn() || !g) return rest;
  if (rest && rest.ex === g.id) return rest;
  const zuletzt = satzUhr.get(g.id);
  const ende = zuletzt ? zuletzt + g.pause * 1000 : 0;
  if (!(g.fertig > 0 && g.fertig < g.sets && ende - Date.now() >= 1000)) return null;
  return {
    endsAt: ende,
    total: g.pause + (satzPlus.get(g.id) || 0),
    next: `Satz ${g.fertig + 1} von ${g.sets} · ${g.name}`,
    ex: g.id,
  };
}

/**
 * Steht dieser Satz schon? Die Frage, die naechsterSchritt() stellt – beim
 * Abhaken (superWeiter) und beim Fortsetzen (firstOpenExercise) wörtlich
 * dieselbe, sonst landeten beide an verschiedenen Stellen. Nur nachgesehen:
 * peekSets() legt anders als getSets() nichts im Protokoll an.
 *
 * **Eine Übung, die über beide Modi fertig ist, ist fertig.** Umschalten geht
 * auch mitten in einer Einheit (set-modus), und saetzeErledigt() zählt die
 * Sätze aus Hanteln und Bodyweight zusammen – so steht es auf der Karte, im
 * Fortschritt und beim Neuladen. Gefragt wurde hier bis v219 nur der Eimer des
 * gerade eingestellten Modus: Paar 1 mit Hanteln durch, dann auf Bodyweight
 * umgestellt, und „Training fortsetzen", das Weiterrücken nach Paar 2 und das
 * Neuladen führten alle zurück zu Paar 1 – zu Übungen, deren Karte „fertig"
 * sagt. Welcher Satz innerhalb einer halb fertigen Übung dran ist, bleibt die
 * Frage des eingestellten Modus; nur ganz Fertiges gilt nie mehr als offen.
 */
function satzSteht(n, mode) {
  const soll = new Map(workoutByNo(n, mode).ex.map((x) => [x.id, x.sets]));
  return (exId, satz) => {
    const arr = store.peekSets(n, mode, exId);
    if (arr && arr[satz] && arr[satz].done) return true;
    const s = soll.get(exId);
    return s > 0 && saetzeErledigt(n, exId, s) >= s;
  };
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
  const g = gruppeVon(superGruppen(n, mode), id);
  if (!g || g.length < 2) return false;

  const ziel = naechsterSchritt(g, satzSteht(n, mode));
  if (!ziel) return false;              // Paar durch – der normale Weg greift

  const v = g.find((x) => x.id === ziel.id);
  const idx = w.ex.findIndex((x) => x.id === ziel.id);
  if (idx >= 0) ui.focusIdx = idx;

  // Die Wartezeit aus der Uhr, nicht aus einer Konstante.
  const zuletzt = satzUhr.get(ziel.id);
  const seit = zuletzt ? (Date.now() - zuletzt) / 1000 : Infinity;
  const wartet = Math.max(0, Math.round(restFor(v) - seit));
  if (wartet > 0) {
    startRest(v.name, ziel.satz - 1, v.sets, wartet, ziel.id);
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
        // Über beide Modi gezählt, wie der Kopf daneben und die Listenansicht
        // (saetzeErledigt()). Bis hierher nur der Eimer des eingestellten
        // Modus: Nach dem Umschalten auf Bodyweight stand die mit Hanteln
        // fertige Übung 1 mit 0 von 2 Feldern da, während der Kopf „2/16
        // Sätze" meldete.
        const done = saetzeErledigt(n, v.id, v.sets);
        return `
        <button type="button" class="prog-ex ${k === cur ? 'cur' : ''} ${done === v.sets ? 'done' : ''}"
                style="flex-grow:${v.sets}" data-act="focus-goto" data-i="${k}"
                aria-label="Übung ${k + 1}, ${esc(v.name)}, ${done} von ${v.sets} Sätzen${v.zusatz ? ', nachgeholt' : ''}"
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
  // Die ganze Einheit ins Protokoll, nicht nur die angezeigte Übung – so wie
  // die Listenansicht es mit jeder Karte tut. Sonst kennt ein späterer
  // Planwechsel von einer angefangenen Einheit nur das erste Paar und schreibt
  // sie darauf fest (siehe festReparieren()). Ohne die Übungen eines noch
  // nicht festgehaltenen Zusatztags – die werden nur gelesen (saetzeZeigen()).
  if (!w.custom) {
    w.ex.forEach((x) => {
      if (x.zusatz && x.zusatz.live) return;
      const v = resolve(x, mode);
      store.getSets(n, mode, v.id, v.sets, v.nach || 0);
    });
  }
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
  const sets = saetzeZeigen(n, mode, it).slice(0, it.sets);
  const doneCount = sets.filter((s) => s.done).length;
  // Sätze aus dem anderen Modus zählen mit – wie auf der Karte der Liste,
  // samt demselben Satz darunter. Sonst stand eine schon fertige Übung hier
  // mit leeren Knöpfen und grauem „Weiter", und ein Tipp darauf buchte einen
  // Satz, den es nie gab (siehe toggle-set).
  const anderswo = Math.max(0, saetzeErledigt(n, it.id, it.sets) - doneCount);
  const exFertig = doneCount + anderswo >= it.sets;
  ui.gezeigt = {
    id: it.id, name: it.name, sets: it.sets, pause: restFor(it),
    fertig: saetzeErledigt(n, it.id, it.sets),
  };
  const kg = it.weight === null ? null : workingWeight(it.id);
  const anders = it.weight === null ? '' : doneWeightNote(n, mode, it.id);

  /*
   * Alles, was man zum Abhaken braucht, auf einer Bildschirmseite.
   *
   *     „Es wäre auch schön wenn hier alles was zu sehen ist auf einer Seite
   *      ist."
   *
   * Die Satzknöpfe standen unter der Kante – ausgerechnet das, wofür man die
   * Ansicht öffnet. Deshalb ist der obere Teil jetzt eine feste Seite: Kopf,
   * Fortschritt, Figur, Name, Gewicht, Satzknöpfe. Die Figur nimmt, was
   * dazwischen übrig bleibt, statt auf 270 Pixeln zu bestehen.
   *
   * Was *nicht* mit hineingezwungen wird: Hinweistext, die ausführliche
   * Erklärung, der Weg zur nächsten Übung. Das liest man einmal und dann nicht
   * mehr; es darf darunter stehen. Eine Seite, auf die alles passt, gäbe es
   * ohnehin nicht – ein Hinweistext ist manchmal sechs Zeilen lang.
   */
  view.innerHTML = `
    <section class="fo">
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
    ${tonHinweis()}

    <div class="focus-fig" id="focusFig"></div>

    <h2 class="focus-name">${esc(it.name)}</h2>
    <!-- „+1 nachgeholt" gehört hierher und stand nur in der Übungsliste:
         *„Kann's sein dass ein dritter Fersenerhöhter Goblet Squat kam weil ich
         Supersatz angeklickt hab? Eigentlich waren ja nur zwei geplant."* Der
         dritte Satz war Nacharbeit aus derselben Woche, aber in dieser Ansicht
         stand nur „3 Sätze" – und dann sucht man den Grund da, wo man zuletzt
         etwas umgestellt hat. Der Supersatz ändert keine einzige Satzzahl; er
         ordnet nur um.
         Und es muss dastehen, *wofür*: *„Jetzt vier Sätze je Übung? Wegen
         Wiederholung? Aber vorgestern hab ich ja goblet sqauds gemacht"* Die 4
         las sich wie eine neue Grundzahl. Darunter steht deshalb die Herkunft
         (nachZeile()). Im Supersatz nur an der gezeigten Übung – die
         Nacharbeit des Partners steht da, wenn er dran ist.

         Die Zahl selbst ist die Summe, „4 Sätze", nicht „3 + 1 Sätze" wie in
         v238 und v239: *„Da soll einfach die normale Zahl dieses Trainings
         inkl der nachholübungen stehen. Also einfach 6 in diesem Fall.
         Genauso bei den Sätzen"* Gemacht werden vier, und so viele Satzknöpfe
         stehen darunter; warum es einer mehr ist, sagt die Zeile direkt unter
         der Zahl. Für die Vorlesefunktion ist das schlichter Text wie jeder
         andere: „4 Sätze × 8–12", und der vierte Knopf heißt „Satz 4 von 4,
         nachgeholt" (satzLabel()). -->
    <div class="focus-meta">${it.sets} Sätze × ${esc(mitWdh(repsLabel(it, mode)))} · ${esc(gruppeLabel(it, mode))} · ${esc(it.equip)}</div>
    ${nachZeile(n, mode, it)}
    ${zusatzZeile(w, it)}
    ${(() => {
      // Im Wechsel muss dastehen, mit wem – sonst wirkt der Sprung zur nächsten
      // Übung wie ein Fehler statt wie der Plan.
      const partner = superPartner(n, mode, it.id);
      if (!partner) return '';
      // Das Paar bleibt, auch wenn ein Gewicht inzwischen so gestiegen ist,
      // dass die Scheiben nicht mehr für beide reichen – dann muss man es
      // aber wissen, sonst steht man vor der leeren Stange.
      const knapp = scheibenReichen(it, partner, mode) ? ''
        : '<div class="super-hin knapp">Die Scheiben reichen nicht für beide Aufbauten – zwischen den Sätzen umstecken.</div>';
      return `<div class="super-hin">↔ Im Wechsel mit ${esc(partner.name)}</div>${knapp}`;
    })()}

    ${kg === null ? bandRow(it) + wdhRow(it, mode, 'focus-weight') : `
      ${ruestHint(n, mode, w.ex, i, ruestMit(n, mode, it))}
      <div class="ex-weight focus-weight">
        ${kgKnopf(it, -1)}
        <div class="kg-main">
          <input type="text" inputmode="decimal" class="kg-val" value="${fmtNum(kg)}"
                 data-act="weight-input" data-ex="${it.id}" aria-label="Gewicht in Kilo">
          <span class="kg-unit">kg${it.weightNote ? ` · ${esc(gewichtNotiz(it.id))}` : ''}</span>
        </div>
        ${kgKnopf(it, 1)}
      </div>
      ${anders ? `<div class="kg-next focus-next">${esc(anders)}</div>` : ''}
      ${aufwaermZeile(it, mode, n)}`}
    ${fassungRow(it, mode)}
    ${anfaengerZeile(it)}

    <div class="focus-sets">
      ${sets.map((s, idx) => `
        <button type="button" class="set-btn focus-set ${s.done ? 'on' : ''}" aria-pressed="${s.done}"
                aria-label="${satzLabel(it, idx)}"${nachVerweis(it, idx)}
                data-act="toggle-set" data-ex="${it.id}" data-i="${idx}">${s.done ? '✓' : idx + 1}</button>`).join('')}
    </div>
    ${anderswo > 0 ? `<div class="small muted ex-anderswo">${anderswo === 1 ? 'Ein Satz' : `${anderswo} Sätze`}
      schon ${mode === 'bw' ? 'mit Hanteln' : 'ohne Hanteln'} gemacht – ${anderswo === 1 ? 'zählt' : 'zählen'} mit.</div>` : ''}
    </section>

    <div class="cue focus-cue">${esc(it.cue)}</div>
    ${hebenBlock(it)}
    ${schmerzBlock(it)}
    ${detailBlock(it)}

    <div class="btn-row nav">
      <button type="button" class="btn btn-ghost" data-act="focus-step" data-d="-1" ${i === 0 ? 'disabled' : ''}>← Zurück</button>
      <button type="button" class="btn ${exFertig ? 'btn-primary' : 'btn-ghost'}"
              data-act="focus-step" data-d="1" ${i === w.ex.length - 1 ? 'disabled' : ''}>Weiter →</button>
    </div>

    ${i === w.ex.length - 1 ? careBlock(n) : ''}
    ${sessionButtons(n, mode)}
    ${vorratNote(w, mode)}
    ${injuryNote(w, mode)}
    ${terminNote(w, mode)}
  `;

  const host = document.getElementById('focusFig');
  if (host) mountFigure(host, it.pattern, it.weight !== null, it.gear);
}

/**
 * Bei offener App: um Mitternacht nachsehen – und dann, wenn eine Einheit von
 * gestern liegen wird, an der kurz vorher noch trainiert wurde.
 *
 * Bisher gab es keine Uhr dafür; der Tag wurde nur beim Laden und beim
 * Zurückkommen (visibilitychange) nachgezogen. Auf dem Handy genügt das fast
 * immer, der Bildschirm geht aus. Bleibt die App aber sichtbar – Tablet auf
 * dem Ständer, Rechner, Handy am Ladekabel mit Display an –, stand am Morgen
 * „Gestern · Workout 12" mit „Training fortsetzen" da, bis jemand die App
 * wegschaltet: genau das Bild aus Tobis Frage. Eine Uhr, die einmal am Tag
 * feuert, kostet nichts. Läuft dabei gerade ein Training über Mitternacht,
 * ändert sie nichts (liegenGeblieben()), sie sieht drei Stunden nach dem
 * letzten Eintrag wieder nach.
 *
 * Nur bei sichtbarer Seite: Im Hintergrund schläft der Timer ohnehin, und das
 * Zurückkommen zieht den Tag selbst nach.
 */
let tagesUhr = null;
function tagesUhrStellen() {
  clearTimeout(tagesUhr);
  const jetzt = new Date();
  // Über das Datum gerechnet, nicht über 24 Stunden: Der 25. Oktober hat 25.
  let wann = new Date(jetzt.getFullYear(), jetzt.getMonth(), jetzt.getDate() + 1, 0, 0, 5).getTime();
  const { spaeter } = liegenGeblieben(todayISO(), jetzt.getTime());
  if (spaeter && spaeter < wann) wann = spaeter + 1000;
  tagesUhr = setTimeout(() => {
    notieren('tag', { was: 'uhr', sichtbar: !document.hidden });
    if (!document.hidden) tagNachziehenZeigen();
    tagesUhrStellen();
  }, Math.max(1000, wann - Date.now()));
}

/**
 * Früher angefangen, als der Plan sagt: Der Restplan rückt vor – auf jedem Weg.
 *
 * Bisher tat das nur „Start" (start-session). Wer Workout 10 am Freitag statt
 * am Samstag in „Übungen & Gewichte" abhakte, ließ den Plan stehen: Workout 11
 * blieb am Montag, über „Start" wäre es am Sonntag gewesen. Dasselbe Training
 * ergab je nach Knopf eine andere Woche – und ausfallTage() in js/plan.js, das
 * den Rhythmus aus dem Protokoll rechnet und nicht aus `shift`, meldete den
 * Sonntag als „Workout 11 · ausgefallen", obwohl die App an dem Tag „morgen ·
 * Workout 11" gezeigt hatte. Jetzt gilt beim ersten Haken und bei „Alle Sätze
 * abhaken" dasselbe wie beim Start: Ist es die nächste offene Einheit und liegt
 * ihr Termin noch vorn, fällt sie auf heute – und ein Zusatztag, der dann in
 * sie gehört, kommt hinein.
 */
function planVorziehen(n) {
  if (istCustom(n) || store.isStarted(n) || firstOpen().n !== n) return false;
  if (daysBetween(todayISO(), effDate(workoutByNo(n))) <= 0) return false;
  const von = store.getState().shift;
  store.setShift(shiftToToday());
  pruefeZusatztag();
  notieren('plan', { was: 'vorgezogen', n, von, nach: store.getState().shift });
  return true;
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
  // Nur die eigene Einheit „läuft". Bis hierher genügte irgendeine laufende:
  // Wer mitten im Training zur nächsten Einheit blätterte, sah dort „▶︎ Start",
  // und ein Tipp ersetzte die Uhr der laufenden Einheit – die Zeit seit dem
  // letzten Wegschalten der App war weg, ohne ein Wort.
  const sess = store.getState().session;
  const laeuft = !!sess && sess.n === n;
  if (sess && !laeuft && !prog.erledigt) return laufendWoandersBlock(sess.n, prog);

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
    //
    // „Für heute durch" nur, wenn heute an ihr trainiert wurde – an ihrem Tag
    // oder danach mit „Doch noch weitermachen" (store.trainiertAm()). Eine
    // Einheit von gestern, die sich am Morgen selbst abgeschlossen hat (der
    // Tagesabschluss), hieß sonst beim Zurückblättern „Für heute durch",
    // unter „Gestern · Workout 12" – und dasselbe jede fertige Einheit von
    // früher. Dann steht da, was stimmt: abgeschlossen, mit wie viel; dass die
    // nächste von selbst kommt, ist dann längst geschehen.
    const heute = store.trainiertAm(n, todayISO());
    return `
      <div class="fertig">
        <div class="fertig-kopf">${heute ? '✓ Für heute durch' : '✓ Abgeschlossen'}</div>
        <div class="fertig-sub">${wieViel}${
          min ? ` · ${min} min` : ''}.${heute ? ' Die nächste Einheit kommt von selbst.' : ''}</div>
      </div>
      ${sess ? `<div style="margin-top:8px">${zurLaufendenKnopf(sess.n)}</div>` : (prog.complete ? '' : `
      <button type="button" class="btn btn-ghost btn-block" data-act="start-session"
              style="margin-top:8px">Doch noch weitermachen</button>`)}`;
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

/** Wie die laufende Einheit heißt – für Knöpfe und Hinweise. */
function einheitTitel(k) {
  return istCustom(k) ? ((store.customById(k) || {}).name || 'Eigenes Workout') : `Workout ${k}`;
}

/**
 * Das Wann über dem Titel: „Heute", „Morgen", „Gestern", „in 3 Tagen", „vor
 * 2 Tagen".
 *
 * Und bei einer Einheit, die an einem früheren Tag angefangen wurde und noch
 * offen ist, „Gestern angefangen". Das ist nach dem Tagesabschluss vor allem
 * das Training über Mitternacht: Um 0:10 stand „Gestern · Workout 12 / Sa, 24.
 * Oktober" über der Einheit, an der man gerade sitzt – genau die Zeile, die
 * Tobi fragen ließ: „Wieso steht da samstag? Heute ist Sonntag". „Gestern
 * angefangen" sagt, warum. Eine abgeschlossene Einheit von gestern war
 * gestern und heißt weiter so.
 *
 * Außer, an ihr wird heute weiter trainiert – „Doch noch weitermachen" nach
 * dem Tagesabschluss: Die Sitzung läuft auf ihr, oder heute steht schon ein Satz
 * (store.trainiertAm()). Bis zur Nachbesserung stand dann „Gestern · Workout
 * 12 / Sa, 24. Oktober 2026" über dem Training von heute und nach dem Ende
 * über „Für heute durch" – das Bild aus Tobis Frage. Mit „Gestern angefangen"
 * passt beides zusammen: Die Einheit bleibt auf ihrem Tag, und der Kopf sagt,
 * warum dort Samstag steht.
 */
function wannWort(w, diff) {
  let when;
  if (diff === 0) when = 'Heute';
  else if (diff === 1) when = 'Morgen';
  else if (diff === -1) when = 'Gestern';
  else if (diff > 1) when = `in ${diff} Tagen`;
  else when = `vor ${-diff} Tagen`;
  if (diff < 0 && !w.custom && store.isStarted(w.n)) {
    const s = store.getState();
    const heuteDran = (!!s.session && String(s.session.n) === String(w.n)) || store.trainiertAm(w.n, todayISO());
    if (!completedMode(w.n) || heuteDran) when += ' angefangen';
  }
  return when;
}

/**
 * Die Zeile über dem Titel: wann und was.
 *
 * Ein Zusatztag, der allein steht – an einem Tag ohne Planeinheit –, hieß hier
 * „Eigenes Workout", wie alles, was man sich selbst zusammenstellt:
 *
 *     „Check ich nicht. Wann soll ich das machen?"
 *
 * Jetzt sagt die Zeile, wann (wie bei jeder Planeinheit, „Heute") und was:
 * „Heute · Zusatztag". Was er nachholt, steht an jeder Übung (zusatzZeile()).
 * Ein selbst zusammengestelltes Workout bleibt „Eigenes Workout".
 */
function einheitAugenbraue(w, when) {
  if (!w.custom) return `${when} · Workout ${w.n}`;
  return ZUSATZ_NAME.test(w.name || '') ? `${when} · Zusatztag` : 'Eigenes Workout';
}

/**
 * Eine andere Einheit läuft gerade.
 *
 * Der Nutzer will dabei zweierlei: nichts verlieren und nichts unbemerkt
 * ändern. Wer mitten im Training zur nächsten Einheit blättert, schaut fast
 * immer nur voraus – also führt der erste Knopf zurück in die laufende, ohne
 * an ihr etwas anzurühren. Wer wirklich wechseln will (falsche Einheit
 * erwischt), kann das, aber nur mit einem Knopf, der sagt, was passiert: Die
 * laufende wird beendet, ihre Zeit gebucht wie beim Wegschalten der App, und
 * ihre Sätze bleiben stehen – sie ist danach angefangen wie jede
 * unterbrochene Einheit (start-session unten). Einfach den Startknopf zu
 * zeigen und die Uhr still zu ersetzen, war die eine Lösung, die beides
 * verfehlte.
 */
function laufendWoandersBlock(k, prog) {
  const titel = einheitTitel(k);
  return `
    <div class="small muted laeuft-woanders" style="margin-bottom:8px">${esc(titel)} läuft noch.</div>
    ${zurLaufendenKnopf(k)}
    <button type="button" class="btn btn-ghost btn-block" data-act="start-session" style="margin-top:8px">
      ${prog.done ? 'Diese fortsetzen' : 'Diese starten'} – ${esc(titel)} wird beendet
    </button>`;
}

function zurLaufendenKnopf(k) {
  return `
    <button type="button" class="btn btn-primary btn-block btn-start" data-act="zur-laufenden">
      ▶︎ Zurück zu ${esc(einheitTitel(k))}
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
 * **Die laufende Einheit wechselt mit, und die vorn stehende, solange sie
 * unberührt ist.** Ein Umschalter, der nur „ab dem nächsten Mal" wirkt, während
 * vorn unverändert die alte Variante steht, sähe kaputt aus. Mitten im Training
 * umzustellen ist ausdrücklich gewollt (siehe set-modus) – das Protokoll führt
 * beide Varianten getrennt, und Sätze beider zählen zusammen. Eine schon
 * trainierte oder angefangene, aber nicht laufende Einheit bleibt dagegen in
 * ihrer Variante: Hier stand einmal, sie bleibe, „wie sie ist", und der Code
 * kippte trotzdem jede Einheit, die gerade vorn stand – auch die fertige von
 * heute.
 */
function modusKarte(mode) {
  return `
    <div class="section-title">Womit trainierst du</div>
    <div class="card">
      <div class="small muted">Beide Fassungen stehen im selben Plan und treffen dieselben
        Muskelgruppen – nur mit dem, was gerade da ist. Umgestellt wird hier, so oft du willst,
        <b>auch mitten im Training</b>: Die laufende Einheit wechselt mit, abgehakte Sätze der
        anderen Variante bleiben stehen und zählen weiter. Eine schon trainierte Einheit bleibt
        in der Variante, in der du sie gemacht hast.</div>
      <div class="btn-row nav" style="margin-top:10px" role="group" aria-label="Variante wählen">
        ${['db', 'bw'].map((m) => `
          <button type="button" class="btn ${m === mode ? 'btn-primary' : ''}"
                  aria-pressed="${m === mode}" data-act="set-modus" data-v="${m}">
            ${MODE_ICON[m]} ${esc(MODE_LABEL[m])}</button>`).join('')}
      </div>
    </div>`;
}

/**
 * Kürzeste und längste Pause im laufenden Plan, je mit der Übung, die sie am
 * häufigsten hat.
 *
 * Gerechnet, nicht hingeschrieben: Hier stand „0:45 – 2:30 min, 2:30 beim
 * Squat, 0:45 bei Crunches" – drei Wochen, nachdem die Pausen auf 1:30 bis
 * 3:00 angehoben worden waren. Ein Text, der Zahlen aus den Daten abschreibt,
 * veraltet mit der nächsten Änderung an den Daten.
 */
function pausenSpanne(mode) {
  const je = new Map();   // Pause -> Map(Name -> Anzahl)
  PLAN.forEach((w) => exOf(w, mode).forEach((it) => {
    const r = resolve(it, mode);
    if (!(r.rest > 0)) return;
    if (!je.has(r.rest)) je.set(r.rest, new Map());
    je.get(r.rest).set(r.name, (je.get(r.rest).get(r.name) || 0) + 1);
  }));
  if (!je.size) return null;
  const haeufigste = (rest) => [...je.get(rest).entries()].sort((a, b) => b[1] - a[1])[0][0];
  const min = Math.min(...je.keys());
  const max = Math.max(...je.keys());
  return { min, max, minName: haeufigste(min), maxName: haeufigste(max) };
}

/**
 * Die Pause: eine Einstellung mit drei Werten, nicht zwei Schalter.
 *
 *     „Wieso sind das eigentlich zwei verschiedene Schalter? Eigentlich sind
 *      das doch die gleichen oder nicht"
 *
 * Fast. Es waren zwei Schalter für *drei* Zustände – je Übung, feste Länge,
 * aus –, und die beiden hingen aneinander: „Pause abschalten" an schaltete
 * „Pause je Übung" mit aus, und „Pause je Übung" aus schaltete die Pause
 * nicht ab, sondern auf eine feste Länge um. Zwei Kippschalter, die sich
 * gegenseitig umlegen, sehen zu Recht aus wie derselbe Schalter zweimal.
 *
 * Drei Werte gehören in eine Reihe mit drei Knöpfen – dieselbe Form, in der
 * eine Zeile höher Hanteln und Bodyweight stehen. Dann ist auch ohne Text zu
 * sehen, dass es eine einzige Entscheidung ist und welcher Wert gerade gilt.
 *
 * Gespeichert wird weiter in `useExerciseRest` und `restSeconds`; an den
 * beiden Feldern hängen der Timer, die Sicherung und die Tests. Was sich
 * ändert, ist nur, wie man sie stellt.
 */
function pausenKarte(s) {
  const wahl = s.useExerciseRest ? 'je' : (s.restSeconds ? 'fest' : 'aus');
  const mmss = (sec) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
  const fest = `${mmss(s.restSeconds)} min`;
  const sp = pausenSpanne(s.mode === 'bw' ? 'bw' : 'db');
  const spanne = sp && sp.min !== sp.max;
  const ARTEN = [
    ['je', '⏱️ Je Übung', spanne ? `${mmss(sp.min)} – ${mmss(sp.max)} min` : 'Je Übung'],
    ['fest', '⏲️ Feste Länge', fest],
    ['aus', '🚫 Aus', 'Aus'],
  ];
  const erklaerung = {
    je: `Schwere Grundübungen bekommen mehr Pause als kleine Isolationsübungen${spanne
      ? ` – ${mmss(sp.max)} bei ${sp.maxName}, ${mmss(sp.min)} bei ${sp.minName}` : ''}. `
      + 'Die Längen stehen in der Übung selbst.',
    fest: 'Dieselbe Pause nach jedem Satz, egal welche Übung.',
    aus: 'Kein Timer, kein Ton – Sätze nur abhaken.',
  };
  return `
    <div class="card">
      <div class="stat-v">${esc((ARTEN.find(([k]) => k === wahl) || [])[2] || 'Aus')}</div>
      <div class="small muted" style="margin-top:2px">${wahl === 'aus'
        ? 'Abgehakt wird weiter ganz normal – es läuft nur nichts mit.'
        : 'Läuft automatisch, sobald du einen Satz abhakst – außer nach dem letzten Satz '
          + 'einer Übung. Am Ende kommt ein Signalton.'}</div>
      <div class="btn-row nav" style="margin-top:10px" role="group" aria-label="Pause wählen">
        ${ARTEN.map(([k, label]) => `
          <button type="button" class="btn ${k === wahl ? 'btn-primary' : ''}"
                  aria-pressed="${k === wahl}" data-act="set-pause" data-v="${k}">
            ${esc(label)}</button>`).join('')}
      </div>
      <div class="small muted" style="margin-top:10px">${esc(erklaerung[wahl])}</div>
      ${wahl === 'fest' ? `
      <div class="btn-row nav" style="margin-top:10px" role="group" aria-label="Länge wählen">
        ${[60, 90, 120, 180].map((sec) => `
          <button type="button" class="btn ${s.restSeconds === sec ? 'btn-primary' : ''}"
                  aria-pressed="${s.restSeconds === sec}"
                  data-act="set-rest" data-sec="${sec}">${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}</button>`).join('')}
      </div>` : ''}
    </div>`;
}

/**
 * Die Namen des Monats, gekürzt.
 *
 * Wer viel nebenher macht, hätte sonst eine Zeile mit acht Sportarten unter
 * dem Kalender stehen. Drei und eine Zahl sagen dasselbe in einer Zeile; die
 * vollständige Liste steht in den Kacheln, und antippen erklärt jede.
 */
function aktNamen(namen) {
  const eindeutig = [...new Set(namen)];
  return eindeutig.length <= 3
    ? eindeutig.join(', ')
    : `${eindeutig.slice(0, 3).join(', ')} +${eindeutig.length - 3}`;
}

/*
 * Am Ruhetag: wohin der Rückstand der Woche geht – eine stille Zeile im Kopf.
 *
 *     „Hab gestern nicht vollständig trainiert. Trotzdem soll ich heute
 *      nichts nachholen?"
 *
 * Tobi, Freitag, ein planmäßiger Ruhetag. Am Donnerstag war Workout 9 nicht
 * ganz fertig geworden, und die Startansicht zeigte „Morgen · Workout 10 …
 * 15 + 2 Sätze" – richtig, aber kein Wort dazu, dass der Rest schon verteilt
 * ist. Was in einer Woche liegen bleibt, kommt auf ihre restlichen Einheiten
 * (höchstens drei Sätze je Einheit, nacharbeit() in js/plan.js); was dort
 * nicht hineinpasst, nach der Woche in einen Zusatztag. Ein Ruhetag
 * dazwischen ist also richtig, und jetzt steht es da:
 *
 *     Heute frei. Was am Do liegen blieb, kommt dazu: morgen +2, Mo +1,
 *     Di +1, der Rest entfällt.
 *
 * Die Zahlen kommen aus nacharbeitVorschau() – derselben Verteilung, mit der
 * jede dieser Einheiten an ihrem Tag ihre Nacharbeit rechnet, nicht aus einer
 * zweiten Rechnung; eine schon festgehaltene Nacharbeit gilt auch hier.
 *
 * **Was mit dem Rest geschieht, steht am Ende.** „der Rest danach" nur, wenn
 * das, was nach der letzten Einheit offen bleibt, einen Zusatztag trägt – mit
 * derselben Schwelle wie der Zusatztag selbst (zusatzRueckstand()). Bleibt
 * weniger, aber in einer Gruppe mehr als ein halber Satz, verfällt es, und
 * dann steht „der Rest entfällt" da. Ohne das versprach „Was am Do liegen
 * blieb, kommt dazu" das Ganze: Bei Tobi holt der Face Pull am Montag einen
 * der zwei liegen gebliebenen Reverse-Fly-Sätze nach, den zweiten keine
 * Einheit mehr. Vier Sätze offen, vier kommen dazu – und trotzdem bleibt
 * hintere Schulter liegen. „danach" und nicht „nach der Woche": Die Woche des
 * Plans (Do bis Di) ist nicht die Kalenderwoche, und am Sonntag hieß „nach
 * der Woche" ab morgen – genau da, wo schon „+2" stand. Trägt die letzte
 * Einheit selbst nichts, steht ihr Tag da („der Rest nach Di").
 *
 * Tage statt Workout-Nummern: die Quelle als Wochentag, an dem es liegen
 * blieb, das Ziel als „morgen" oder Wochentag. Trägt ein Quelltag dasselbe
 * Kürzel wie ein Ziel oder ein anderer Quelltag, steht sein Datum dabei
 * („Was am Do 8.10. liegen blieb, kommt dazu: morgen +1, Do +1") – zwei
 * verpasste Tage dehnen eine Woche über sieben, und dann waren es im selben
 * Satz zwei Donnerstage.
 *
 * **Und der Zusatztag der Woche davor, wenn er morgen in die Einheit kommt**
 * (zusatzMorgen()). Er entsteht erst am Tag selbst, der Kopf zeigt ihn heute
 * noch nicht – morgen stand dann „15 + 4" statt der angekündigten „+1". Er
 * steht als eigener Satz da, mit seinem Namen aus der Übung („Nachgeholt aus
 * Woche 3"): „Aus Woche 3 kommt dazu: morgen +3."
 *
 * Nur, wenn heute wirklich frei ist: Die gezeigte Einheit ist die, die die App
 * für heute zeigt, und liegt nach heute; heute wurde nichts trainiert – keine
 * Planeinheit, kein eigenes Workout, kein allein stehender Zusatztag –, und
 * nichts läuft. Ist die fällige verpasst, rückt der Plan nach (catchUpPlan())
 * und sie steht auf heute – keine Zeile. Ohne Rückstand auch keine: „Morgen ·
 * Workout 10" sagt schon, dass heute frei ist.
 *
 * Kein Popup, nichts zum Wegtippen, keine Karte – eine Zeile unter der
 * Satzzahl, so leise wie die Herkunftszeile an der Übung.
 *
 * ruhetagTeile() rechnet, ob die Zeile steht und woraus: { heute, v,
 * quellen, zus } oder null. Die Zeile zum Tagesabschluss liest dieselben
 * Teile (abschlussWohin()), statt sie ein zweites Mal zu rechnen.
 */
function ruhetagTeile(w) {
  const heute = todayISO();
  // Die Einheit, die die App für heute zeigt (naechsteEinheit()) – nicht eine
  // angeblätterte, und nicht, wenn heute ein Zusatztag allein dasteht.
  if (w.custom || store.getState().session || naechsteEinheit() !== w.n) return null;
  if (daysBetween(heute, effDate(w)) <= 0) return null;
  // Heute schon trainiert: jede Einheit im Protokoll, auch ein eigenes Workout
  // oder ein allein stehender Zusatztag. startedOn steht erst mit dem ersten
  // Eintrag (syncStartedOn() in js/store.js) – nur geöffnet zählt nicht. Und
  // der Rest einer abgeschlossenen Einheit, heute gemacht (store.trainiertAm()).
  if (Object.keys(store.getState().log || {}).some((k) => store.trainiertAm(k, heute))) return null;
  const v = nacharbeitVorschau(w);
  const danach = !!v && !!zusatzRueckstand(v.rest);
  const quellen = !v || (!v.einheiten.length && !danach) ? []
    : [...new Set([...v.einheiten.flatMap((e) => e.quellen),
      ...(danach || !v.einheiten.length ? v.herkunft.map((h) => h.n) : [])])].sort((a, b) => a - b);
  const zus = zusatzMorgen(w);
  if (!quellen.length && !zus) return null;
  return { heute, v, quellen, zus };
}

/**
 * Die Zeile selbst. Was die Zeile zum Tagesabschluss oben schon sagt
 * (abschlussWohin() – dieselben Teile, auf die abgeschlossene Einheit
 * bezogen), steht hier nicht noch einmal: dieselbe Zahl zweimal auf einem
 * Bildschirm ist eine zu viel. Ist die Zeile dort weg, steht es wieder hier.
 */
function ruhetagZeile(w) {
  const t = ruhetagTeile(w);
  if (!t) return '';
  const deckt = abschlussDeckt();
  const { heute, v } = t;
  const quellen = deckt.nach ? [] : t.quellen;
  const zus = deckt.zus ? null : t.zus;
  if (!quellen.length && !zus) return '';
  const tagVon = (n) => effDate(PLAN[n - 1]);
  const saetze = [];
  if (quellen.length) {
    const { ziele, zielTage, letzte, nachLetzter, ziel } = restZiele(v, heute);
    const quellTage = [...new Set(quellen.map(tagVon))];
    // Ein Kürzel, zwei Tage: Der Quelltag bekommt sein Datum.
    const kuerzel = (iso) => fmtDate(iso).slice(0, 2);
    const genannt = [...zielTage, ...(nachLetzter ? [letzte] : []), ...(zus ? [effDate(w)] : [])];
    const quelle = (iso) => tagKurz(iso, heute,
      [...genannt, ...quellTage.filter((d) => d !== iso)].some((d) => kuerzel(d) === kuerzel(iso)));
    const am = undListe(quellTage.map(quelle));
    if (zielTage.length) {
      saetze.push(`Was am ${am} liegen blieb, kommt dazu: ${ziele.join(', ')}.`);
    } else {
      saetze.push(`Was am ${am} liegen blieb, kommt nach ${daysBetween(heute, letzte) === 1 ? 'der Einheit morgen' : ziel(letzte)} dazu.`);
    }
  }
  if (zus) saetze.push(`Aus Woche ${zus.woche} kommt dazu: morgen\u00a0+${zus.saetze}.`);
  return `<div class="ov-frei">${esc(`Heute frei. ${saetze.join(' ')}`)}</div>`;
}

/**
 * Wohin der Rückstand der Woche geht, als Satzteile („morgen +2", „Mo +1",
 * „der Rest entfällt") – aus nacharbeitVorschau() `v`, von `heute` aus. Eine
 * Stelle für die Zeile am Ruhetag und die Zeile zum Tagesabschluss
 * (abschlussWohin()), damit beide dasselbe sagen und keine zweite Rechnung
 * daneben steht.
 *
 * „der Rest danach" nur, wenn das, was nach der letzten Einheit offen bleibt,
 * einen Zusatztag trägt (zusatzRueckstand()); bleibt weniger, aber in einer
 * Gruppe mehr als ein halber Satz, „der Rest entfällt". Trägt die letzte
 * Einheit selbst nichts, steht ihr Tag da („der Rest nach Di"). Ein Ziel, das
 * heute ist, heißt „heute" – das kommt nur beim Tagesabschluss vor; am
 * Ruhetag liegt jede Einheit nach heute.
 */
function restZiele(v, heute) {
  const tagVon = (n) => effDate(PLAN[n - 1]);
  const ziel = (iso) => {
    const d = daysBetween(heute, iso);
    if (d === 0) return 'heute';
    return d === 1 ? 'morgen' : tagKurz(iso, heute);
  };
  const danach = !!zusatzRueckstand(v.rest);
  const zielTage = v.einheiten.map((e) => tagVon(e.n));
  const letzte = tagVon(v.letzte);
  // Der Tag der letzten Einheit steht im Satz, wenn der Rest nach ihr kommt
  // und sie selbst nichts trägt.
  const nachLetzter = !zielTage.length || (danach && zielTage[zielTage.length - 1] !== letzte);
  // Tag und Zahl gehören zusammen – ein festes Leerzeichen, damit auf 360 px
  // nicht „morgen" am Zeilenende steht und „+2" am Anfang der nächsten.
  const ziele = v.einheiten.map((e, i) => `${ziel(zielTage[i])}\u00a0+${e.saetze}`);
  if (zielTage.length) {
    if (danach) ziele.push(nachLetzter ? `der Rest nach ${ziel(letzte)}` : 'der Rest danach');
    else if (Object.values(v.rest).some((x) => x > 0.5)) ziele.push('der Rest entfällt');
  }
  return { ziele, zielTage, letzte, nachLetzter, danach, ziel };
}

/*
 * Die Zeile zum Tagesabschluss – oben auf der Startseite, eine Auskunft ohne
 * Knopf:
 *
 *     ✓ Workout 12 vom Samstag ist abgeschlossen – 4 von 15 Sätzen. Von
 *       den 11 offenen Sätzen kommen morgen 3 in Workout 13 mit rein.
 *
 *     „Ich will nicht zwischen ok und Rest heute wählen können. Es soll von
 *      selbst einfach das optimale passieren"
 *
 * Bis v242 standen darunter „Rest heute machen" und „OK". Tobi fragte erst,
 * was der Unterschied sei – „OK" blendete nur aus, man blieb im Rhythmus, und
 * ein Teil des Fehlenden kam per Zusatz in die nächste Einheit; „Rest heute
 * machen" holte alles nach, und der Plan rutschte einen Tag. Empfohlen war
 * „OK". Eine Wahl, deren eine Seite die empfohlene ist, ist keine – also tut
 * die App sie: Sie bleibt im Rhythmus, und was fehlt, verteilen Nacharbeit und
 * Zusatztag wie bisher. Damit das nicht unbemerkt geschieht, bleibt die Zeile
 * – sie sagt, was passiert ist und wohin der Rest geht, und geht von selbst:
 *
 *   der erste Eintrag in einer anderen Einheit   die nächste ist angefangen
 *   ein Eintrag in einer Einheit der Zeile, ihr   die Zeile stimmt für sie
 *     Zurücksetzen                                nicht mehr (abschlussOhne()
 *                                                 in js/store.js)
 *   ein neuer Tagesabschluss                      er ersetzt sie
 *   ein Fokuswechsel, „Von vorn beginnen"         sie sprach vom alten Plan
 *   der übernächste Tag                           ABSCHLUSS_ZEILE_TAGE in
 *                                                 js/store.js – nie ewig
 *
 * Sie tritt zurück, solange auf einer ihrer Einheiten eine Sitzung läuft
 * (abschlussListe()), und auf der Karte dieser Einheit selbst – die sagt dort
 * schon „✓ Abgeschlossen · 4 von 17 Sätzen" (renderOverview()).
 *
 * Wer doch in die Einheit zurück will, blättert zu ihr: „Doch noch
 * weitermachen" (startBlock()), mit denselben Sicherungen wie vorher der Knopf
 * hier – kein „Abbrechen", das den Samstag löscht (frueherFertig()), der
 * Sonntag als Trainingstag (`weiterAm`), im Kopf „Gestern angefangen".
 *
 * Sagt, was passiert ist, mit den Zahlen von dem Moment und dem Tag der
 * Einheit als Wochentag – „von gestern" stimmte am Montag schon nicht mehr.
 * Länger als sechs Tage her mit Datum.
 *
 * **Wohin der Rest geht, nur wenn es stimmt** (abschlussWohin()), und
 * gerechnet von den Stellen, die es dann auch tun – keine zweite Rechnung.
 */
function abschlussHinweis() {
  const liste = abschlussListe();
  if (!liste.length) return '';
  const heute = todayISO();
  const vom = (iso) => {
    const d = daysBetween(iso, heute);
    return d >= 1 && d <= 6 ? `vom ${wochentag(iso)}` : `vom ${wochentag(iso)}, ${tagMonat(iso)}`;
  };
  const saetze = (e) => `${e.done} von ${e.total} ${e.total === 1 ? 'Satz' : 'Sätzen'}`;
  const was = liste.length === 1
    ? `Workout ${liste[0].n} ${vom(liste[0].tag)} ist abgeschlossen – ${saetze(liste[0])}.`
    : `${undListe(liste.map((e) => `Workout ${e.n} ${vom(e.tag)} (${saetze(e)})`))} sind abgeschlossen.`;
  const wohin = abschlussWohin(liste).text;
  // Klein gesetzt: Die Startseite bleibt auch mit der Zeile eine
  // Bildschirmseite, bis 360×740 (siehe .notice.abschluss in css/styles.css).
  // Was zusammengehört, bricht nicht um: Bei 360 px stand „– 4" am Zeilenende
  // und „von 15 Sätzen" darunter, bei 414 px „4 von 15" und „Sätzen". Und das
  // letzte Wort steht nie allein: An Tobis Sonntag stand bei 360 px „rein." in
  // einer vierten Zeile (dazu der kürzere Satz in abschlussWohin()).
  const satz = `${was}${wohin ? ` ${wohin}` : ''}`
    .replace(/(\d+) von (\d+) (Satz|Sätzen)/g, '$1 von $2 $3')
    .replace(/Workout (\d+)/g, 'Workout $1')
    .replace(/ (\S+)$/, '\u00a0$1');
  return `
    <div class="notice abschluss">✓ ${esc(satz)}</div>`;
}

/**
 * Die Einheiten, die die Zeile zum Tagesabschluss zeigt: aus der geprüften
 * Zeile (store.tagesabschluss() – auch noch nicht abgelaufen), im Plan, und
 * nur so, wie die Zeile sie nennt – auf ihrem Tag und abgeschlossen. Sonst
 * stünde „ist abgeschlossen" über einer Einheit, die es nicht mehr ist (eine
 * Sicherung aus fremder Hand, deren Protokoll etwas anderes sagt). Nach einer
 * weitergerollten Runde liegt ihr Protokoll in der Ablage: Dann bleibt sie
 * stehen – die Zeile sagt, warum die Startseite bei Workout 1 steht. (Nach
 * „Von vorn beginnen" und einem Fokuswechsel ist die Zeile ganz weg, siehe
 * case 'restart-plan' und store.wechsleFokus().)
 *
 * Und nicht, solange auf ihr eine Sitzung läuft. „Doch noch weitermachen"
 * getippt, ohne Haken zurück: Oben stand „✓ Workout 12 vom Samstag ist
 * abgeschlossen – 4 von 17 Sätzen.", direkt darunter „Gestern angefangen ·
 * Workout 12" mit „✓ Training abschließen (4/17)" – am Nachmittag über
 * „Workout 12 läuft noch.", und bei 360×740 schob sich die Seite. Bis v242 nahm
 * „Rest heute machen" die Zeile beim Tipp weg. Jetzt tritt sie zurück, solange
 * an der Einheit trainiert wird; der erste Haken nimmt sie ganz (abschlussOhne()
 * in js/store.js), und endet die Sitzung ohne einen, steht sie wieder da – der
 * Tipp allein hat nichts geändert.
 */
function abschlussListe() {
  const a = store.tagesabschluss();
  if (!a) return [];
  const log = store.getState().log || {};
  const sess = store.getState().session;
  return a.einheiten.filter((e) => PLAN[e.n - 1]
    && !(sess && String(sess.n) === String(e.n))
    && (!log[e.n] || (store.startedOn(e.n) === e.tag && !!completedMode(e.n))));
}

/**
 * Wohin geht, was in den abgeschlossenen Einheiten fehlt? { text, nach, zus }:
 * der Satz (oder '') und welche Teile der Zeile am Ruhetag er übernimmt.
 *
 * Gefragt wird, was die App heute *tut*, an den Stellen, die es tun:
 *
 *   gebunden    der Zusatztag ihrer Woche steckt heute in einer Einheit
 *               (zusatzBindung()): „Von den 13 offenen Sätzen kommen heute 3
 *               in Workout 13 mit rein."
 *   allein      er ist heute die nächste Einheit (naechsteEinheit(), ein
 *               Ruhetag): „Zum Nachholen steht heute ein Zusatztag bereit."
 *   Ruhetag     die Teile der Zeile am Ruhetag (ruhetagTeile()), soweit sie
 *               diese Einheiten betreffen: der Zusatztag, der morgen kommt
 *               (zusatzMorgen()) – „Von den 13 offenen Sätzen kommen morgen 3
 *               in Workout 13 mit rein." –, und die Nacharbeit der restlichen
 *               Woche. Die Zeile am Ruhetag lässt sie dann weg (`nach`,
 *               `zus`), statt dieselbe Zahl ein zweites Mal zu nennen.
 *   Nacharbeit  heute ist ein Trainingstag derselben Woche: die Verteilung aus
 *               nacharbeitVorschau(), in Worten wie am Ruhetag (restZiele()) –
 *               „Von den 12 offenen Sätzen kommen dazu: heute +1, morgen +3."
 *   entfällt    die Woche ist zu Ende, und was fehlt, trägt keinen Zusatztag
 *               (zusatzRueckstand(), dieselbe Schwelle wie er selbst)
 *
 * „Von den 13 offenen Sätzen", wo nicht alles nachgeholt wird: Ein Zusatztag
 * in einer Einheit bringt höchstens ZUSATZ_IN_EINHEIT Übungen. Bis zur
 * Nachbesserung stand dort „Davon" – hinter „4 von 17 Sätzen" las es sich wie
 * „von den 4 gemachten", und die offenen nannte die Zeile nirgends. Die Zahl
 * steht nur, wenn alles, was in der Woche offen ist, aus den Einheiten der
 * Zeile stammt (offenImBlock(), dieselbe Herkunft, die der Zusatztag an seiner
 * Übung nennt). Fehlt auch woanders etwas – bei Tobi zwei Sätze aus Workout 9 –,
 * holt der Teil womöglich auch das nach; dann „Aus Woche 3 kommen morgen 3
 * Sätze in Workout 13 mit rein." (beim Zusatztag) oder „Von dem, was in dieser
 * Woche liegen blieb, kommt dazu: …" (bei der Nacharbeit). Sonst nichts –
 * lieber kein Ziel als ein falsches. Gerechnet für die jüngste Einheit und ihre
 * Woche.
 */
function abschlussWohin(liste) {
  const leer = { text: '', nach: false, zus: false };
  const e = liste[liste.length - 1];
  if (store.startedOn(e.n) !== e.tag || !completedMode(e.n)) return leer;
  const ns = liste.map((x) => x.n);
  const heute = todayISO();
  const woche = (n) => Math.floor((n - 1) / WEEK_SESSIONS) + 1;
  const nr = woche(e.n);
  // Der Zusatztag holt höchstens ZUSATZ_IN_EINHEIT Übungen nach, nie zwingend
  // alles – mehr als den Teil, den er bringt, verspricht die Zeile nicht. Und
  // sie sagt, wovon er ein Teil ist: von den offenen Sätzen der Zeile, wenn
  // alles Offene der Woche aus ihr stammt, sonst von der Woche.
  const offenZahl = liste.filter((x) => woche(x.n) === nr).reduce((a, x) => a + x.total - x.done, 0);
  const eigen = (quellen) => offenZahl > 1 && quellen.length > 0 && quellen.every((n) => ns.includes(n));
  const wochenQuellen = () => offenImBlock((nr - 1) * WEEK_SESSIONS, nr * WEEK_SESSIONS).herkunft.map((h) => h.n);
  const kommt = (k) => (k === 1 ? 'kommt' : 'kommen');
  // Stammt nicht alles aus der Zeile, sagt sie die Woche, im Wortlaut der
  // Zeile am Ruhetag („Aus Woche 3 kommt dazu: morgen +3."). Hier stand „Von
  // dem, was in Woche 3 liegen blieb, kommen morgen 3 Sätze in Workout 13 mit
  // rein." – an Tobis Sonntag bei 360 px vier Zeilen, in der letzten nur
  // „rein.".
  const davon = (k, wann, n) => (eigen(wochenQuellen())
    ? `Von den ${offenZahl} offenen Sätzen ${kommt(k)} ${wann} ${k} in Workout ${n} mit rein.`
    : `Aus Woche ${nr} ${kommt(k)} ${wann} ${plural(k, 'Satz', 'Sätze')} in Workout ${n} mit rein.`);
  const wer = (quellen) => (quellen.every((n) => ns.includes(n)) ? 'Was fehlt' : 'Was in dieser Woche liegen blieb');
  // Die Nacharbeit der restlichen Einheiten, in den Worten der Zeile am
  // Ruhetag (restZiele()) – bis auf „der Rest danach". Das hieße: ein
  // Zusatztag nach der Woche. Ob er kommt, entscheidet sich erst an seinem
  // Tag, an der Erholungsregel: Gemessen mit Workout 11 vom Freitag (3 von 12,
  // Rücken, Bizeps, hintere Schulter offen) kam keiner – Sonntag ruhen die
  // Gruppen von Samstag und Montag, am Montag trifft Workout 13 sie selbst.
  // Die Zeile versprach ihn trotzdem. Hier steht deshalb nur, was sicher
  // ist: die Sätze in den Einheiten der Woche – als Teil („Von den 12
  // offenen Sätzen kommen dazu: …"), wenn danach noch etwas offen ist, sonst
  // als ganzer Satz, mit „der Rest entfällt".
  const ziele = (v, quellen) => {
    const z = restZiele(v, heute);
    if (!z.zielTage.length) return '';
    if (z.danach) {
      const teil = z.ziele.filter((t) => !t.startsWith('der Rest ')).join(', ');
      return eigen(quellen) ? `Von den ${offenZahl} offenen Sätzen kommen dazu: ${teil}.`
        : `Von dem, was in dieser Woche liegen blieb, kommt dazu: ${teil}.`;
    }
    return `${wer(quellen)}, kommt dazu: ${z.ziele.join(', ')}.`;
  };
  const b = zusatzBindung();
  if (b && b.woche === nr) {
    const mode = store.workoutMode(b.w.n);
    const k = workoutByNo(b.w.n, mode).ex.filter((it) => it.zusatz && it.zusatz.woche === nr)
      .reduce((a, it) => a + it.sets, 0);
    if (k) return { ...leer, text: davon(k, 'heute', b.w.n) };
  }
  const naechste = naechsteEinheit();
  if (istCustom(naechste)) {
    const c = store.customById(naechste);
    return c && c.name === `Zusatztag Woche ${nr}` ? { ...leer, text: 'Zum Nachholen steht heute ein Zusatztag bereit.' } : leer;
  }
  const w = PLAN.find((x) => x.n === naechste);
  if (!w || completedMode(w.n)) return leer;
  const t = ruhetagTeile(w);
  if (t) {
    const nach = t.quellen.some((n) => ns.includes(n)) ? ziele(t.v, t.quellen) : '';
    const zus = t.zus && t.zus.woche === nr ? davon(t.zus.saetze, 'morgen', w.n) : '';
    if (nach || zus) return { text: [nach, zus].filter(Boolean).join(' '), nach: !!nach, zus: !!zus };
  }
  if (woche(w.n) === nr) {
    if (effDate(w) > heute) return leer;
    const v = nacharbeitVorschau(w);
    if (!v || !v.herkunft.some((h) => ns.includes(h.n))) return leer;
    return { ...leer, text: ziele(v, v.herkunft.map((h) => h.n)) };
  }
  // Die Woche ist vorbei, und kein Zusatztag nimmt den Rest – reicht er nicht?
  const ziel = zusatzZiel();
  if (!ziel || ziel.nr !== nr || zusatzVergeben(nr)
      || store.customs().some((c) => c.name === `Zusatztag Woche ${nr}`)) return leer;
  const luecke = Object.fromEntries(Object.keys(MUSCLE_LABEL)
    .map((m) => [m, (ziel.soll[m] || 0) - (ziel.acc[m] || 0)]));
  if (zusatzRueckstand(luecke) || !Object.values(luecke).some((x) => x > 0.5)) return leer;
  return { ...leer, text: 'Für einen Zusatztag reicht der Rest nicht – er entfällt.' };
}

/** Was die Zeile zum Tagesabschluss gerade von der Zeile am Ruhetag übernimmt. */
function abschlussDeckt() {
  const liste = abschlussListe();
  return liste.length ? abschlussWohin(liste) : { text: '', nach: false, zus: false };
}

/**
 * Der Zusatztag, der morgen in die Einheit `w` kommt: { woche, saetze } oder
 * null – für die Zeile am Ruhetag.
 *
 * Fiel nach einer Woche mit Rückstand am Ruhetag danach und am ersten Tag der
 * neuen Woche jeder Zusatz unter die Erholungsregel, entstand der Zusatztag
 * erst am Tag der zweiten Einheit – in ihr, am Morgen. Am Ruhetag davor stand
 * „Morgen · Workout 14 · 15 + 1 Sätze" und die Zeile „morgen +1", am Samstag
 * dann „15 + 4". Und ohne Rückstand in der neuen Woche gar keine Zeile, obwohl
 * morgen drei Sätze dazukamen.
 *
 * Gerechnet wird, was zusatztagRechnen() morgen rechnet, mit denselben
 * Stücken: die zuletzt abgeschlossene Woche (zusatzZiel()), kein Zusatztag,
 * wenn er schon vergeben oder sein Träger angefangen ist, die Einheit, die ihn
 * morgen aufnimmt (zusatzEinheitFuer() mit dem Tag von morgen), und seine
 * Übungen aus zusatztagEx() – dort gilt die Erholungsregel, die Beschwerde,
 * das Gerät und der Termin des Tages, an dem die Einheit liegt. Nur für
 * morgen: Liegt die Einheit später, steht morgen der Zusatztag womöglich
 * allein da („Heute · Zusatztag"), und das zeigt die Startansicht dann selbst.
 */
function zusatzMorgen(w) {
  const morgen = addDays(todayISO(), 1);
  if (effDate(w) !== morgen) return null;
  const ziel = zusatzZiel();
  if (!ziel || zusatzVergeben(ziel.nr)) return null;
  const traeger = store.customs().find((c) => c.name === `Zusatztag Woche ${ziel.nr}`);
  if (traeger && store.isStarted(traeger.id)) return null;
  const einheit = zusatzEinheitFuer(ziel.nr, morgen);
  if (!einheit || einheit.n !== w.n) return null;
  const z = zusatztagEx(ziel, store.workoutMode(w.n), einheit);
  return z ? { woche: ziel.nr, saetze: z.ex.reduce((a, x) => a + x.sets, 0) } : null;
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

  const when = wannWort(w, diff);

  const items = w.ex.map((item) => resolve(item, mode));
  const muscles = new Set(items.flatMap((it) => it.muscles));
  // In den Daten steht der zuerst beanspruchte Muskel vorn. Daraus zwei
  // Stufen: was heute wirklich dran ist, und was nur mitarbeitet.
  const primary = new Set(items.map((it) => it.muscles[0]).filter(Boolean));
  const due = backupDue();

  // Eine Bildschirmseite, ohne Scrollen: Kopf, Körper, Start. Der Körper
  // nimmt sich den Platz, der zwischen den beiden übrig bleibt.
  //
  // Die stille Zeile zum Ton hier kurz, und nicht neben der Zeile zum
  // Tagesabschluss: Nach einer Nacht im Speicher klemmt auf dem iPhone der
  // Tonkanal, und beide standen zugleich da – bei 360×740 lag der Fuß dann
  // 78 px (Sonntag) bzw. 111 px (Montag) unter der Leiste, die Zeile zum Ton
  // allein (vier Zeilen, 116 px) schob ihn 35 bzw. 45 px darunter. Die Zeile
  // zum Abschluss hat Vorrang. Bis v242 war ihr „OK" ohnehin die nächste
  // Berührung, und die weckte den Kanal. Seit v244 hat sie keinen Knopf mehr
  // und steht womöglich zwei Tage; auch ohne Knöpfe (69 px) passen beide am
  // Montag bei 360×740 nicht zusammen, die Seite schob sich 24 px. Gebraucht
  // wird der Ton im Training: Klemmt er nach dem Tipp auf Start noch, zeigen
  // die Fokusansicht und die Liste den ganzen Satz, Einzelheiten Mehr. Ist die
  // Zeile zum Abschluss weg, steht die zum Ton auch hier.
  //
  // Nicht auf der Karte einer Einheit, von der die Zeile spricht: Am Sonntag
  // zu Workout 12 zurückgeblättert, stand „4 von 17" dreimal da – in der Zeile,
  // im Fortschritt und auf der Karte („✓ Abgeschlossen / 4 von 17 Sätzen · 20
  // min."), und bei 360×740 schob sich die Seite 41 px, die Reihe „Übungen &
  // Gewichte" halb unter der Leiste. Gerade diese Karte ist seit v244 der Weg
  // zurück in die Einheit („Doch noch weitermachen"). Sie sagt selbst, was
  // passiert ist; wohin der Rest geht, steht auf der Startseite. Der Vorrang
  // vor der Zeile zum Ton bleibt auch dort (`hinweis`): Mit ihr allein schob
  // sich diese Karte bei 360×740 um 8 px.
  const hinweis = abschlussHinweis();
  const abschluss = abschlussListe().some((e) => e.n === w.n) ? '' : hinweis;
  view.innerHTML = `
    <section class="ov">
      ${umzugHinweis()}
      ${umbauHinweis()}
      ${aufstiegHinweis()}
      ${abschluss}
      ${speicherWarnung()}
      ${hinweis ? '' : tonHinweis(true)}
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
        ${esc(ui.standAngebot.w)} von ${esc(ui.standAngebot.p)} Einheiten, ${esc(ui.standAngebot.s)} Sätze${
          ui.standAngebot.kg ? `, ${esc(Number(ui.standAngebot.kg).toLocaleString('de-DE'))} kg Volumen` : ''}.
        <div class="btn-row nav" style="margin-top:10px">
          <button type="button" class="btn btn-primary" data-act="accept-stand">Zum Vergleich</button>
          <button type="button" class="btn btn-ghost" data-act="drop-stand">Verwerfen</button>
        </div></div>` : ''}
      ${sicherungsZeile(due)}
      ${kalenderZeile()}

      <header class="ov-top">
        <!-- Kein „von 84" mehr: „Die app geht ja unendlich." Stimmt – der Plan
             rollt am Ende von selbst in die nächste Runde, und eine Zahl, die
             ein Ende ankündigt, das es nicht gibt, ist schlicht falsch. Die
             laufende Nummer bleibt: Sie sagt, wo man ist, ohne zu behaupten,
             wohin es geht. -->
        <div class="hero-eyebrow">${store.getState().name ? `${esc(store.getState().name)} · ` : ''}${
          esc(einheitAugenbraue(w, when))}</div>
        <h2 class="hero-title">${w.custom ? esc(w.name) : esc(fmtDate(date, true))}</h2>
        <!-- Kein "Plan +2 Tage" mehr: Der Plan rückt von selbst nach, wenn ein
             Termin verstreicht (catchUpPlan). Wie weit er dabei insgesamt vom
             ursprünglichen Kalender abweicht, ändert an der heutigen Einheit
             nichts – es stand nur da und sah nach einem Rückstand aus, den es
             nicht gibt. Wer die Zahl wirklich sucht, findet sie unter
             Mehr → Termine. -->
        <div class="hero-sub">${tagKopf(w, mode, items)}</div>
        ${ruhetagZeile(w)}
        ${prog.done ? `<div class="progress"><i style="width:${prog.pct}%"></i></div>
          <div class="ov-prog">${prog.done}/${prog.total} Sätze${prog.erledigt ? ' · abgeschlossen' : ''}</div>` : ''}
        <!-- Hier stand: "↩ 2 Sätze aus dieser Woche nachgeholt – diese Woche ist
             etwas liegen geblieben …". Raus auf Zuruf, und ohne Verlust: An
             jeder betroffenen Übung steht in der Liste weiterhin "+1
             nachgeholt", also dort, wo man sie auch macht. Drei Zeilen
             Buchhaltung vor dem Start waren dagegen genau das, was diese
             Ansicht nicht sein soll.

             Die Zeile darüber (ruhetagZeile()) ist keine Rückkehr dazu: Sie
             steht nur an einem Tag ohne Einheit, ist eine Zeile und beantwortet
             die Frage, die dort aufkommt – „Trotzdem soll ich heute nichts
             nachholen?" An einem Trainingstag steht sie nie. -->
      </header>

      <div class="ov-body" id="bodyMap"></div>

      <div class="bm-legend">${[...muscles]
        .sort((a, b) => (primary.has(b) ? 1 : 0) - (primary.has(a) ? 1 : 0))
        .map((m) => `<span class="${primary.has(m) ? '' : 'sub'}">${esc(MUSCLE_LABEL[m] || m)}</span>`).join('')}</div>

      ${items.length ? `
        ${startBlock(n, mode, prog)}
`
      : leererTag(n)}
      <!-- Hier stand die Zeile „↩︎ Als zweite Einheit heute: Zusatztag Woche 2,
           2 Übungen. Öffnen". Raus, auf Ansage: „Was soll das mit zweite
           Einheit. Wenn heute Übungen dazu kommen dann soll alles flüssig in
           EINE Einheit". Seine Übungen stehen jetzt in dieser Einheit
           (einheitEx() in js/plan.js) – im Kopf mitgezählt („6 Übungen"), an
           der Übung mit ihrer Herkunft. Ein Start, keine Zeile darunter. -->

      <div class="ov-foot">
        ${w.custom ? `<button type="button" class="ov-nav" data-act="back-to-plan" aria-label="Zurück zum Plan">↩</button>`
          : `<button type="button" class="ov-nav" data-act="nav-workout" data-delta="-1" aria-label="Vorherige Einheit" ${n === PLAN[0].n ? 'disabled' : ''}>←</button>`}
        <button type="button" class="ov-nav wide" data-act="show-list">Übungen &amp; Gewichte</button>
        ${w.custom ? `<button type="button" class="ov-nav" data-act="go-tab" data-tab="custom" aria-label="Eigenes Workout bearbeiten">✎</button>`
          : `<button type="button" class="ov-nav" data-act="nav-workout" data-delta="1" aria-label="Nächste Einheit" ${n === PLAN[PLAN.length - 1].n ? 'disabled' : ''}>→</button>`}
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
      den Link geschickt und seinen Stand mitgeschickt: ${esc(ui.standAngebot.w)} von
      ${esc(ui.standAngebot.p)} Einheiten. Sobald du fertig eingerichtet hast, steht er in deinem
      Vergleich.</div>` : ''}
    ${schritt === 0 ? sicherungAngebotHtml() : ''}`;

  // „Von allein geht nichts irgendwohin" stand hier, solange es keinen Server
  // gab. Mit der automatischen Sicherung stimmt der Satz nicht mehr – und eine
  // Zusage, die die App an anderer Stelle bricht, ist schlimmer als keine.
  // Ohne Server in js/config.js bleibt er, denn dann stimmt er.
  const seiten = [`
    <div class="card">
      <p class="small">Ein fertiger Trainingsplan: Übungen, Sätze, Wiederholungen, Pausen –
        und zu jeder Übung eine vorgeführte Bewegung, die sich drehen lässt. Trainieren kannst
        du mit <strong>Hanteln</strong> oder als <strong>Bodyweight</strong>-Variante ganz ohne
        Geräte. Gewählt wird unter <em>Mehr</em>, auch mitten im Training – die Wahl gilt
        dann für die laufende und alle folgenden Einheiten, bis du sie wieder änderst.</p>
      ${hatServer() ? `<p class="small">Die App läuft offline und braucht kein Konto. Was du
        einträgst, liegt auf diesem Gerät und wird verschlüsselt gesichert (unten). Für den
        Vergleich unter <em>Statistik</em> schickst du deinen Stand als Link, und wer ihn
        bekommt, sieht die Zahlen darin.</p>`
      : `<p class="small">Die App läuft offline und braucht kein Konto. Was du einträgst, bleibt
        auf diesem Gerät – bis du selbst etwas verschickst: Für den Vergleich unter
        <em>Statistik</em> schickst du deinen Stand als Link, und wer ihn bekommt, sieht die
        Zahlen darin. Von allein geht nichts irgendwohin.</p>`}
    </div>
    <div class="card">
      <div class="lbl">Wie heißt du?</div>
      <div class="hint">Nur für die Anzeige und für den Vergleich mit Freunden.</div>
      <input type="text" id="nameInput" class="name-input" maxlength="24"
             autocomplete="name" placeholder="Dein Name" aria-label="Dein Name">
    </div>
    ${sicherungEinstieg()}`, `
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
  // Im Einstieg gewählt, aber geladen ist noch der Plan, der beim Öffnen galt –
  // js/data.js wählt ihn einmal, beim Laden. Wer hier „Cut" nahm, trainierte
  // die erste Einheit nach dem Aufbau-Plan (sechs Übungen, Klimmzüge), und beim
  // ersten Neuladen stand mitten in der Einheit der Cut da, mit den schon
  // abgehakten Liegestützen als fremder Übung dazwischen. Neu geladen wird
  // deshalb hier, einmal, wie bei jedem anderen Fokuswechsel – nicht schon
  // beim Antippen: Dann finge der Einstieg wieder beim Namen an. Das Melden
  // übernimmt der Start (meldeStand() unten), mitten im Neuladen ginge es
  // verloren.
  if ((PLANS[store.getState().focus] || PLANS.standard) !== FOCUS) {
    store.flush();
    sessionStorage.setItem('workout.nachEinstieg', name ? `Los geht’s, ${name} 💪` : 'Los geht’s 💪');
    vorDemNeuladen('einstieg');
    location.reload();
    return;
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
            und was hakt. Sonst geht auf diesem Weg nichts raus: keine Uhrzeiten, keine
            Adressen, nichts von außerhalb dieser App. Gespeichert wird bei Supabase, einem
            Datenbankdienst; der sieht dabei technisch bedingt die IP-Adresse deines Geräts –
            in die Tabelle geschrieben wird sie nicht. Die Sicherung deines Trainings ist
            davon getrennt: verschlüsselt, lesbar nur mit deinem Schlüssel, eigener Schalter
            unter <i>Mehr → Daten</i>.</div>
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
  melden(standZeile()).then(({ ok, status, msg }) => {
    notieren('rueckkanal', { ok, status, msg: ok ? undefined : msg });
    store.setSetting('lastShare', { on: todayISO(), ok, msg: ok ? '' : msg });
    // Nur neu zeichnen, wo das Ergebnis auch steht – mitten im Training wäre
    // ein Neuaufbau der Seite eine Zumutung.
    if (ui.tab === 'settings') render();
  });
}

/* ------------------------------------------------------------------ *
 * Automatische Sicherung – was davon zu sehen ist
 *
 * Die Technik steht in js/sicherung.js. Hier steht, wo man sie sieht:
 *
 *   Einstieg, Schritt 1  der Satz, was geschieht, mit dem Schalter daneben,
 *                        und „Sicherung zurückholen" für den, der umzieht
 *   Mehr → Daten         derselbe Satz, wann zuletzt gesichert wurde, wo der
 *                        Schlüssel liegt, und Löschen
 *   Dashboard            eine Zeile, und nur, wenn etwas zu tun ist
 *
 * Ohne Server in js/config.js gibt es nichts davon; dann bleibt die alte
 * Erinnerung „N Einheiten seit der letzten Sicherung" mit dem Datei-Weg.
 * ------------------------------------------------------------------ */

function sicherungSatz() {
  return `Dein Training wird automatisch verschlüsselt auf dem Server von ${esc(CONFIG.betreiber)}
    gesichert. Lesen kann es nur, wer den Schlüssel hat – der liegt auf diesem Gerät und,
    sobald du ihn dort ablegst, in deinem Passwortmanager.`;
}

/** „vor 3 Min." – für „Zuletzt gesichert". */
function vorWann(iso) {
  const t = Date.parse(iso || '');
  if (!Number.isFinite(t)) return 'unbekannt';
  const min = Math.floor((Date.now() - t) / 60000);
  if (min < 1) return 'gerade eben';
  if (min < 60) return `vor ${min} Min.`;
  if (min < 24 * 60) return `vor ${Math.floor(min / 60)} Std.`;
  const d = new Date(t);
  const tag = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return `am ${fmtDate(tag)}`;
}

/** Ein Datum aus den Vermerken („2026-10-13") lesbar. */
const sicherungTag = (iso) => (iso ? fmtDate(String(iso).slice(0, 10)) : '');

/**
 * In welcher Lage ist die Sicherung – für das Dashboard, das nur dann etwas
 * sagt, wenn es etwas zu tun gibt.
 *
 *   aus/fehlt/neu  es wird (noch) nicht automatisch gesichert – die alte
 *                  Erinnerung gilt weiter
 *   konflikt       angehalten, bis jemand entscheidet
 *   klemmt         eine Woche lang nichts angekommen
 *   schluessel     es läuft, aber der Schlüssel liegt nur auf diesem Gerät
 *   still          alles gut: nichts anzeigen
 */
function sicherungLage() {
  if (!sicherungAn()) return 'aus';
  const m = sicherungMetaLesen();
  if (m.fehlt) return 'fehlt';
  if (m.konflikt) return 'konflikt';
  if (!m.ok) return 'neu';
  if (m.fehler && Date.now() - Date.parse(m.ok) > 7 * 24 * 3600 * 1000) return 'klemmt';
  const a = m.aussen || {};
  return a.passwort || a.geprueft || a.link ? 'still' : 'schluessel';
}

/** Der Wiederherstellungs-Link, der beim Öffnen einen Schlüssel mitbrachte. */
function sicherungAngebotHtml() {
  if (!ui.sicherungAngebot) return '';
  return `<div class="notice">🔑 Dieser Link bringt den Schlüssel zu einer Sicherung mit. Zurückholen
      ersetzt, was hier steht${needsWelcome() ? '' : ' (der jetzige Stand wird beiseitegelegt)'}.
      Danach sichert dieses Gerät unter seinem eigenen Schlüssel weiter – wer den Link hat, liest
      nicht mit.
      <div class="btn-row nav" style="margin-top:10px">
        <button type="button" class="btn btn-primary" data-act="sicherung-angebot-holen"
                ${ui.sicherungLaeuft ? 'disabled' : ''}>Zurückholen</button>
        <button type="button" class="btn btn-ghost" data-act="sicherung-angebot-weg">Verwerfen</button>
      </div>
      ${ui.sicherungMeldung ? `<div class="hint" id="sicherungMeldung" style="color:var(--accent);margin-top:8px">${esc(ui.sicherungMeldung)}</div>` : ''}
    </div>`;
}

/** Die eine Zeile auf dem Dashboard – sie ersetzt die alte Erinnerung, wo gesichert wird. */
function sicherungsZeile(due) {
  const angebot = sicherungAngebotHtml();
  if (angebot) return angebot;
  const lage = sicherungLage();
  const m = sicherungMetaLesen();
  if (lage === 'konflikt' || lage === 'klemmt') {
    const was = lage === 'klemmt'
      ? `Zuletzt gesichert ${vorWann(m.ok)} – seitdem kommt nichts mehr an.`
      : (m.konflikt.art === 'geloescht'
        ? 'Sicherung angehalten: Auf dem Server ist sie weg.'
        : 'Sicherung angehalten: Ein anderes Gerät sichert unter deinem Schlüssel.');
    return `<div class="notice warn zeile">⚠️ <span>${esc(was)}</span>
      <button type="button" class="btn" data-act="sicherung-ansehen">Ansehen</button></div>`;
  }
  if (lage === 'schluessel') {
    return `<div class="notice zeile">🔑 <span>Wird automatisch gesichert – der Schlüssel liegt aber
      nur auf diesem Gerät.</span>
      <button type="button" class="btn btn-primary" data-act="schluessel-sichern">Schlüssel sichern</button></div>`;
  }
  if (lage === 'still') return '';
  // aus, fehlt, neu: Es wird (noch) nicht automatisch gesichert. Dann die
  // Erinnerung wie bisher, mit dem Datei-Weg.
  return due ? `<div class="notice warn">💾 ${esc(plural(due, 'Einheit', 'Einheiten'))} seit der letzten
        Sicherung. Alles liegt nur in diesem Browser.
        <button type="button" class="btn btn-block btn-primary" data-act="backup-teilen"
                style="margin-top:10px">Sicherung weitergeben</button>
        <div class="small muted" style="margin-top:6px">Geht an Drive, an eine Mail an dich
          selbst, an was du willst – Hauptsache nicht nur auf dieses Handy.</div></div>` : '';
}

/** Das Eingabefeld für Schlüssel oder Link – wo der Passwortmanager nichts hergibt. */
function sicherungEingabeHtml() {
  return `${ui.sicherungEingabe ? `
      <input type="text" class="name-input" id="sicherungSchluessel" autocomplete="off"
             autocapitalize="off" spellcheck="false" placeholder="Schlüssel oder Link"
             aria-label="Schlüssel oder Wiederherstellungs-Link">
      <div class="btn-row">
        <button type="button" class="btn btn-primary btn-block" data-act="sicherung-eingabe-laden"
                ${ui.sicherungLaeuft ? 'disabled' : ''}>Laden</button>
      </div>` : ''}
      ${ui.sicherungMeldung && !ui.sicherungAngebot ? `<div class="hint" id="sicherungMeldung"
        style="color:var(--accent);margin-top:8px">${esc(ui.sicherungMeldung)}</div>` : ''}`;
}

/**
 * Ein Löschen, das noch nicht beim Server angekommen ist – etwa „Alle Daten
 * löschen" ohne Netz. Steht im Einstieg (dort landet man danach) und unter
 * Mehr, bis der Server es bestätigt: Nichts ändert sich unbemerkt, auch nicht
 * etwas, das sich noch nicht geändert hat.
 */
function sicherungLoeschenZeile() {
  return loeschenAusstehend() ? `<div class="small" id="sicherungLoeschenOffen" style="margin-top:8px">🗑️
    Eine Sicherung auf dem Server wartet aufs Löschen – das geschieht, sobald er wieder erreichbar
    ist.</div>` : '';
}

/** Einstieg, Schritt 1: der Satz, der Schalter, und der Weg zurück für den, der umzieht. */
function sicherungEinstieg() {
  if (!hatServer()) return '';
  return `
    <div class="card">
      <div class="switch-row">
        <div>
          <div class="lbl">Automatisch sichern</div>
          <div class="hint">${sicherungSatz()}</div>
        </div>
        <button type="button" class="toggle" aria-pressed="${sicherungAn()}" data-act="toggle-sicherung"
                aria-label="Automatisch sichern"></button>
      </div>
      ${sicherungLoeschenZeile()}
      <div class="small muted" style="margin-top:10px">Schon auf einem anderen Gerät trainiert?
        Dann holt dieser Knopf den Stand von dort – mit dem Schlüssel aus deinem
        Passwortmanager oder dem Link, den du dir geschickt hast.</div>
      <div class="btn-row">
        <button type="button" class="btn btn-block" data-act="sicherung-holen"
                ${ui.sicherungLaeuft ? 'disabled' : ''}>Sicherung zurückholen</button>
      </div>
      ${sicherungEingabeHtml()}
    </div>`;
}

/** Mehr → Daten: alles, was es über die Sicherung zu wissen und zu tun gibt. */
function sicherungKarte() {
  if (!hatServer()) return '';
  const m = sicherungMetaLesen();
  const an = sicherungAn();
  const k = m.konflikt;
  let lage;
  if (!an) {
    lage = 'Abgeschaltet – es geht nichts raus. Was schon auf dem Server liegt, bleibt dort, '
      + 'bis du es löschst.';
  } else if (m.fehlt) {
    lage = `Der Server kennt die Sicherung noch nicht – ${CONFIG.betreiber} muss dort einmal den
      SQL-Block aus der README ausführen (Abschnitt „Automatische Sicherung"). Bis dahin hilft
      die Datei unten.`;
  } else if (k && k.art === 'geloescht') {
    lage = 'Auf dem Server ist die Sicherung weg – auf einem anderen Gerät gelöscht oder 400 Tage '
      + 'nicht erneuert. Dieses Gerät sichert erst wieder, wenn du es sagst.';
  } else if (k) {
    lage = `Ein anderes Gerät hat unter demselben Schlüssel gesichert${m.ok
      ? `, nach der letzten Sicherung von hier (${vorWann(m.ok)})` : ''}. Damit dieses Gerät den
      neueren Stand nicht überschreibt, sichert es gerade nicht. Was soll gelten?`;
  } else if (m.ok) {
    lage = `Zuletzt gesichert: ${vorWann(m.ok)}.${m.fehler
      ? ` Der letzte Versuch ging nicht (${m.fehler}) – wird von selbst wiederholt.` : ''}`;
  } else if (m.fehler) {
    lage = `Noch nicht gesichert: ${m.fehler}. Wird von selbst wiederholt.`;
  } else {
    lage = 'Noch nichts gesichert – das passiert nach dem ersten Training von selbst.';
  }
  const a = m.aussen || {};
  const wo = [];
  if (a.geprueft) wo.push(`liegt in deinem Passwortmanager (nachgesehen ${sicherungTag(a.geprueft)})`);
  else if (a.passwort) {
    wo.push(`am ${sicherungTag(a.passwort)} an den Passwortmanager übergeben – ob Chrome ihn
      gespeichert hat, erfährt die App nicht; „Nachsehen" prüft es`);
  }
  // „verschickt oder kopiert", nicht „abgelegt": Wohin der Link danach ging,
  // weiß die App nicht.
  if (a.link) wo.push(`am ${sicherungTag(a.link)} als Link verschickt oder kopiert`);
  const schluessel = !m.key
    ? 'Der Schlüssel entsteht mit der ersten Sicherung.'
    : wo.length ? `🔑 Schlüssel: ${wo.join('; ')}.`
      : `🔑 Schlüssel: nur auf diesem Gerät. Geht es verloren, ist die Sicherung nicht mehr zu
        lesen – auch für ${CONFIG.betreiber} nicht. Leg ihn im Passwortmanager ab oder schick dir
        den Link.`;
  const pw = passwortManagerDa();
  return `
    <div class="card">
      <div class="switch-row">
        <div>
          <div class="lbl">Automatisch sichern</div>
          <div class="hint" id="sicherungOffen">${sicherungSatz()} Der Server – bei Supabase – sieht
            eine Zufallskennung, wie groß die Sicherung ist und wann sie kam, sekundengenau: also
            auch, wann du trainierst. Dazu, wie bei jeder Anfrage, die IP-Adresse deines Geräts;
            gespeichert wird nicht sie, sondern gegen Missbrauch bis zum Tagesende ein Hash davon.
            Was 400 Tage niemand erneuert, löscht der Server von selbst.</div>
        </div>
        <button type="button" class="toggle" aria-pressed="${an}" data-act="toggle-sicherung"
                aria-label="Automatisch sichern"></button>
      </div>
      <div class="small muted" id="sicherungStand" style="margin-top:8px">${esc(lage.replace(/\s+/g, ' '))}</div>
      ${sicherungLoeschenZeile()}
      ${an && k ? `<div class="btn-row">
        <button type="button" class="btn btn-primary" data-act="sicherung-trotzdem">${k.art === 'geloescht'
          ? 'Wieder sichern' : 'Diesen Stand sichern'}</button>
        ${k.art === 'geloescht' ? '' : '<button type="button" class="btn" data-act="sicherung-von-dort">Den Stand von dort holen</button>'}
      </div>` : ''}
      <div class="small muted" id="schluesselStand" style="margin-top:8px">${esc(schluessel.replace(/\s+/g, ' '))}</div>
      ${m.key ? `<div class="btn-row">
        ${pw ? '<button type="button" class="btn" data-act="schluessel-passwort">Im Passwortmanager ablegen</button>' : ''}
        ${pw && a.passwort ? '<button type="button" class="btn" data-act="schluessel-pruefen">Nachsehen</button>' : ''}
        <button type="button" class="btn" data-act="schluessel-link">Link an dich schicken</button>
      </div>
      <div class="small muted" style="margin-top:6px">Wer den Link hat, kann deinen Verlauf lesen –
        schick ihn nur an dich selbst.</div>` : ''}
      ${ui.sicherungLinkText ? `<input type="text" class="name-input" id="sicherungLink" readonly
        value="${esc(ui.sicherungLinkText)}" aria-label="Wiederherstellungs-Link">` : ''}
      <div class="btn-row">
        <button type="button" class="btn" data-act="sicherung-holen"
                ${ui.sicherungLaeuft ? 'disabled' : ''}>Sicherung zurückholen</button>
        ${m.id ? '<button type="button" class="btn btn-ghost" data-act="sicherung-loeschen">Sicherung auf dem Server löschen</button>' : ''}
      </div>
      ${sicherungEingabeHtml()}
    </div>`;
}

/** Den Namen aus dem Einstieg festhalten, bevor neu gezeichnet wird – sonst wäre er weg. */
function einstiegNameHalten() {
  const feld = document.getElementById('nameInput');
  if (feld) store.setSetting('name', feld.value.trim().slice(0, 24));
}

/**
 * Eine geholte Sicherung einspielen: Rückfrage, einlesen, den Schlüssel
 * übernehmen, neu starten – derselbe Weg wie beim Einlesen einer Datei.
 */
async function sicherungEinspielen(key, erg, weg) {
  if (!ersetzenErlaubt()) return;
  try {
    store.importJSON(erg.text);
  } catch (e) {
    ui.sicherungMeldung = `Die Sicherung ließ sich nicht einlesen: ${e.message}`;
    render();
    return;
  }
  await sicherungUebernehmen(key, { stand: erg.stand, weg });
  ui.setupStep = 0;
  // Nichts ändert sich unbemerkt: Nach einem Link sichert das Gerät unter
  // einem anderen Schlüssel weiter als dem, mit dem es eben geholt hat.
  neuStarten(weg === 'link'
    ? 'Sicherung zurückgeholt – gesichert wird ab jetzt unter dem eigenen Schlüssel dieses Geräts'
    : 'Sicherung zurückgeholt');
}

/** Mit einem Schlüssel holen und einspielen; was schiefgeht, steht danach am Knopf. */
async function sicherungHolenMit(key, weg) {
  ui.sicherungLaeuft = true;
  ui.sicherungMeldung = '';
  render();
  const erg = await sicherungHolen(key);
  ui.sicherungLaeuft = false;
  if (!erg.ok) {
    ui.sicherungMeldung = erg.msg;
    render();
    return;
  }
  await sicherungEinspielen(key, erg, weg);
}

/**
 * „Sicherung zurückholen": erst der Passwortmanager – dort liegt der
 * Schlüssel, wenn er synchronisiert wurde, und ein Tipp in der Auswahl genügt.
 * Gibt es ihn nicht, lehnt er ab oder liefert nichts, kommt das Eingabefeld
 * für Schlüssel oder Link.
 */
async function sicherungHolenStarten() {
  ui.sicherungMeldung = '';
  // Wer jetzt selbst zurückholt, meint nicht mehr den Link, mit dem die App
  // aufging – dessen Angebot (und seine Meldung) räumt das Feld.
  ui.sicherungAngebot = null;
  let key = null;
  try {
    key = await schluesselAusManager();
  } catch { key = null; }
  if (key) {
    await sicherungHolenMit(key, 'passwort');
    return;
  }
  ui.sicherungEingabe = true;
  render();
  const feld = document.getElementById('sicherungSchluessel');
  if (feld) feld.focus();
}

/**
 * Den Schlüssel außerhalb des Geräts ablegen – auf dem Dashboard ein Tipp:
 * Passwortmanager, wo es ihn gibt, sonst der Link.
 */
async function schluesselImManager() {
  try {
    await schluesselAblegen();
    toast('Chrome fragt jetzt, ob es das Passwort „Workout-Sicherung" speichern soll – „Speichern" tippen.');
    render();
    return true;
  } catch {
    return false;
  }
}

/** Den Wiederherstellungs-Link an sich selbst schicken – oder kopieren, wo es kein Teilen gibt. */
async function sicherungsLinkSchicken() {
  const link = await sicherungLink(appURL());
  if (navigator.share) {
    try {
      await navigator.share({
        title: 'Workout-Sicherung',
        text: 'Schlüssel zu meiner Workout-Sicherung – nur für mich. Auf einem neuen Gerät öffnen, '
          + 'dann ist das Training wieder da.',
        url: link,
      });
      linkVermerken();
      toast('Link verschickt – wer ihn hat, kann deinen Verlauf lesen');
      render();
      return;
    } catch (e) {
      if (e && e.name === 'AbortError') return;
    }
  }
  // Kein Teilen: in die Zwischenablage, und zur Sicherheit sichtbar daneben.
  ui.sicherungLinkText = link;
  try {
    await navigator.clipboard.writeText(link);
    toast('Link kopiert – leg ihn außerhalb dieses Geräts ab, etwa als Mail an dich');
  } catch {
    toast('Link steht unter dem Knopf – kopieren und außerhalb dieses Geräts ablegen');
  }
  linkVermerken();
  render();
}

/**
 * Schlüssel aus der Adresse lesen – und den Anker aus der Adresszeile nehmen.
 *
 * Wie beim geschickten Stand (standAusAdresse()), nur mit mehr auf dem Spiel:
 * Der Anker ist der Schlüssel. Er geht nie an einen Server – ein Anker gehört
 * nicht zur Anfrage. Aus dem **Browserverlauf** bekommt replaceState ihn
 * allerdings nicht heraus: Chrome hat die Adresse samt Anker beim Öffnen
 * vermerkt, und dort bleibt sie (nachgesehen in der History-Datenbank eines
 * Chromium mit Oberfläche). Bis v240 stand hier, er solle dort nicht stehen
 * bleiben – das hielt die App nicht ein, und weil das Gerät danach unter genau
 * diesem Schlüssel weitersicherte, öffnete der Verlaufseintrag jede künftige
 * Sicherung.
 *
 * Deshalb übernimmt das Gerät einen Schlüssel aus einem Link nie als seinen
 * eigenen (sicherungUebernehmen() in js/sicherung.js): Der Link öffnet nur den
 * Stand, aus dem er stammt, und was danach kommt, geht unter dem eigenen
 * Schlüssel des Geräts hinaus.
 */
function sicherungAusAdresse() {
  const treffer = /[#&]sicherung=([A-Za-z0-9_-]+)/.exec(location.hash);
  if (!treffer) return null;
  history.replaceState(history.state, '', location.pathname + location.search);
  return schluesselAus(`#sicherung=${treffer[1]}`);
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
    // Nicht das Objekt selbst durchreichen: Es kommt aus einem fremden Link.
    // normStand() lässt nur Zahlen, kurze Texte und Datumsangaben durch.
    return obj && obj.v === STAND_VERSION ? store.normStand(obj) : null;
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

/** Adresse der App zum Weitergeben – ohne Anker und ohne Suchteil. */
function appURL() {
  const u = new URL(location.href);
  u.hash = '';
  u.search = '';
  return u.href.replace(/index\.html$/, '');
}

const SHARE_TEXT = 'Mein Trainingsplan als App: 84 Einheiten, mit Hanteln oder ohne, '
  + 'mit vorgeführten Bewegungen und Pausentimer. Läuft im Browser, offline, ohne Konto.';

/**
 * Die Knöpfe oben in der Übungsliste – dieselbe Weiche wie startBlock().
 *
 * Hier stand bei jeder nicht laufenden Einheit „▶︎ Workout starten", auch wenn
 * gerade eine andere lief. start-session verlässt sich aber darauf, dass der
 * Knopf vorher sagt, dass die andere endet (laufendWoandersBlock()) – und so
 * beendete ein Tipp in der Liste von Workout 2 das laufende Workout 1 ohne ein
 * Wort davor.
 */
function listeStartKnoepfe(n, mode, prog, sess, session) {
  if (session) return sessionButtons(n, mode);
  if (sess) return prog.erledigt ? zurLaufendenKnopf(sess.n) : laufendWoandersBlock(sess.n, prog);
  return `<div class="btn-row">
       <button type="button" class="btn btn-primary btn-block" data-act="start-session">▶︎ Workout starten</button>
     </div>`;
}

function renderDashboard() {
  const n = ui.workoutNo;
  const w = workoutByNo(n);
  const mode = store.workoutMode(n);
  const prog = progressOf(n, mode);
  const today = todayISO();
  const date = effDate(w);
  const diff = daysBetween(today, date);
  const sess = store.getState().session;
  const session = sess && sess.n === n ? sess : null;

  const when = wannWort(w, diff);

  const items = w.ex.map((item) => resolve(item, mode));
  // Die Herkunft der Nacharbeit einmal für die ganze Liste, nicht je Karte.
  const warumJe = !w.custom && items.some((it) => it.nach) ? nachWarumJe(PLAN[n - 1], mode) : null;

  const parts = [];

  parts.push(umzugHinweis());
  parts.push(umbauHinweis());
  parts.push(aufstiegHinweis());

  if (!store.canPersist()) parts.push(speicherWarnung());
  parts.push(tonHinweis());

  parts.push(`
    <section class="card">
      <div class="hero-eyebrow">${esc(einheitAugenbraue(w, when))}</div>
      <h2 class="hero-title">${w.custom ? esc(w.name) : esc(fmtDate(date, true))}</h2>
      <div class="hero-sub">${tagKopf(w, mode, items)}</div>
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
      ${listeStartKnoepfe(n, mode, prog, sess, session)}
      <div class="btn-row nav">
        <button type="button" class="btn btn-ghost" data-act="nav-workout" data-delta="-1" ${w.custom || n === PLAN[0].n ? 'disabled' : ''}>← Vorheriges</button>
        <button type="button" class="btn btn-ghost" data-act="nav-today">Heute</button>
        <button type="button" class="btn btn-ghost" data-act="nav-workout" data-delta="1" ${w.custom || n === PLAN[PLAN.length - 1].n ? 'disabled' : ''}>Nächstes →</button>
      </div>
    </section>
  `);

  // Zurück in die Fokusansicht nur aus der Liste der *laufenden* Einheit. Aus
  // der einer anderen führte „Zurück" bisher auf focus-back: Gezeigt wurde
  // trotzdem die Übersicht dieser Einheit, aber `ui.focus` blieb hängen – das
  // Wischen tat nichts mehr, und nach dem Neuladen fand die App die laufende
  // Einheit nicht wieder.
  parts.push(`<div class="focus-top">
      <button type="button" class="back-link" data-act="${session ? 'focus-back' : 'hide-list'}">‹ Zurück</button>
      <span class="focus-count">${plural(items.length, 'Übung', 'Übungen')} · ${prog.done}/${prog.total} Sätze</span>
    </div>
    ${tagNotiz(w, mode, items)}`);

  items.forEach((it, i) => {
    const sets = saetzeZeigen(n, mode, it).slice(0, it.sets);
    const doneCount = sets.filter((s) => s.done).length;
    const open = ui.openEx.has(it.id);
    // Sätze aus dem anderen Modus zählen mit (siehe saetzeErledigt) – und die
    // Karte sagt es, sonst stünden leere Kästchen neben „fertig" im Kopf.
    const anderswo = saetzeErledigt(n, it.id, it.sets) - doneCount;
    const complete = doneCount + Math.max(0, anderswo) >= it.sets;
    const prev = lastLoggedFor(it.id, mode, n);

    // Satz-Knöpfe liegen bewusst außerhalb des aufklappbaren Bereichs: Abhaken
    // ist der eine Handgriff, der zwischen zwei Sätzen schnell gehen muss.
    const setBtns = sets.map((s, idx) => `
      <button type="button" class="set-btn ${s.done ? 'on' : ''}" aria-pressed="${s.done}"
              aria-label="${satzLabel(it, idx)}"${nachVerweis(it, idx)}
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
          <span class="kg-unit">kg${it.weightNote ? ` · ${esc(gewichtNotiz(it.id))}` : ''}</span>
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
            <span class="ex-meta">${it.sets} × ${esc(repsLabel(it, mode))} · ${esc(gruppeLabel(it, mode))} · ${esc(it.equip)}</span>
          </span>
          <span class="ex-right"><span class="chev">▼</span></span>
        </div>
        ${nachZeile(n, mode, it, warumJe)}
        ${zusatzZeile(w, it)}
        ${anfaengerZeile(it)}
        ${weightRow}
        ${fassungRow(it, mode)}
        ${wdhRow(it, mode)}
        <div class="ex-sets">${setBtns}</div>
        ${anderswo > 0 ? `<div class="small muted ex-anderswo">${anderswo === 1 ? 'Ein Satz' : `${anderswo} Sätze`}
          schon ${mode === 'bw' ? 'mit Hanteln' : 'ohne Hanteln'} gemacht – ${anderswo === 1 ? 'zählt' : 'zählen'} mit.</div>` : ''}
        <div class="ex-body">
          ${open ? `<div class="ex-fig" data-pattern="${esc(it.pattern)}"
               data-weight="${it.weight !== null}" data-gear="${esc(it.gear || '')}"></div>` : ''}
          <div class="cue">${esc(it.cue)}</div>
          ${hebenBlock(it)}
          ${schmerzBlock(it)}
          ${detailBlock(it)}
          <div class="ex-facts">
            <span>Pause ${Math.floor(restFor(it) / 60)}:${String(restFor(it) % 60).padStart(2, '0')} min</span>
            <span>${it.sets} Sätze × ${esc(mitWdh(repsLabel(it, mode)))}</span>
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
      Hantel-Variante oder Bodyweight-Äquivalent wählst du unter Mehr → Womit trainierst du –
      auch mitten im Training. Beide werden getrennt protokolliert, es geht also nichts
      verloren.
    </p>
    ${vorratNote(w, mode)}
    ${injuryNote(w, mode)}
    ${terminNote(w, mode)}
  `);

  view.innerHTML = parts.join('');

  // Die Figur erst nach dem Einhängen montieren – sie misst ihren Platz und
  // hängt Listener fürs Drehen an. Nur aufgeklappte Karten bekommen eine:
  // eine Animation je Übung im Hintergrund wäre Rechenzeit für nichts.
  view.querySelectorAll('.ex-fig').forEach((host) => {
    mountFigure(host, host.dataset.pattern, host.dataset.weight === 'true', host.dataset.gear || null);
  });
}


/* ------------------------------------------------------------------ *
 * Statistik
 * ------------------------------------------------------------------ */


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
            <td><b>${esc(f.w)}</b><span class="muted">/${esc(f.p)}</span></td>
            <td>${esc(f.s)}</td>
            <td>${esc(f.r)}</td>
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

/**
 * Wie weit es bis zur nächsten Stufe noch ist – ein Balken statt drei.

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
      <!-- „Hab doch schon viel mehr als zwei Workouts gemacht" – und das stimmte.
           Die Kachel zählt gegen die 84 Einheiten *dieser* Runde; wer den Fokus
           gewechselt hat, dessen frühere Einheiten liegen in der Ablage und
           standen nur ganz unten unter „Insgesamt trainiert". Daneben „6
           Trainingstage" und „59 Sätze", die über alle Runden zählen – die
           Kachel las sich dadurch wie ein Widerspruch. Sie sagt jetzt selbst,
           worauf sie sich bezieht, und die Gesamtzahl steht direkt daneben
           statt zwei Abschnitte tiefer. -->
      <div class="stat"><div class="stat-v">${workoutsDone}<span class="muted" style="font-size:15px">/${PLAN.length}</span></div>
        <div class="stat-l">Workouts ${store.getState().rounds.length ? 'in dieser Runde' : 'erledigt'}</div></div>
      ${store.getState().rounds.length ? `<div class="stat">
        <div class="stat-v">${leben.einheiten}</div>
        <div class="stat-l">Einheiten insgesamt <span class="muted">über alle Runden</span></div></div>` : ''}
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
           <div class="small muted" style="margin-top:4px">${esc(einheitEx(upcoming, store.workoutMode(upcoming.n)).map((i) => resolve(i, store.workoutMode(upcoming.n)).name).join(' · '))}</div>
           <div class="btn-row"><button type="button" class="btn btn-primary" data-act="open-workout" data-n="${upcoming.n}">Öffnen</button></div>`
        : '<div class="muted">Alle Einheiten des Plans sind abgeschlossen. Stark.</div>'}
    </div>

    <div class="section-title">Wochenvolumen</div>
    <div id="volWeek"></div>

    <div class="section-title">Gewicht je Übung</div>
    <div class="spark-grid" id="sparkEx"></div>

    <div class="section-title">Volumen je Muskelgruppe · Anteile eingerechnet</div>
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
  const [wdhZahl, wdhZusatz] = wdhTeile(repsLabel(it, mode));
  return `
    <div class="ex-weight ${extra}">
      <button type="button" class="kg-step" data-act="reps-step" data-ex="${it.id}" data-d="-1"
              ${plus ? '' : 'disabled'} aria-label="Eine Wiederholung weniger">−</button>
      <div class="kg-main">
        <span class="kg-val kg-fest">${esc(wdhZahl)}</span>
        <span class="kg-unit">Wdh.${wdhZusatz ? ' ' + esc(wdhZusatz) : ''}${plus ? ` · ${plus} mehr als im Plan` : ''}</span>
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
    <div class="scheiben-satz super-vorschau">
      <div class="lbl">${esc(einheitTitel(n))} liefe so</div>
      ${gruppen.map((g) => (g.length === 2
        ? `<div class="super-paar">↔ ${esc(g[0].name)} <span class="super-mit">im Wechsel mit</span> ${esc(g[1].name)}${
          scheibenReichen(g[0], g[1], mode) ? '' : ' <span class="knapp">– Scheiben reichen nicht für beide, umstecken</span>'}</div>`
        : `<div class="super-paar allein">${esc(g[0].name)} <span class="super-mit">allein, mit normaler Pause</span></div>`)).join('')}
      <div class="hint">${paarZahl
        ? `${paarZahl} ${paarZahl === 1 ? 'Paar' : 'Paare'} – der Rest läuft wie bisher.`
        : 'Für diese Einheit findet sich kein Paar: Entweder teilen sich die Übungen '
          + 'einen Muskel oder sie brauchen dasselbe Gerät.'}</div>
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
 * Nach einer Eingabe in ein Scheibenfeld: Zeilenhinweis, „Damit einstellbar"
 * und die Supersatz-Vorschau nachziehen – aber nicht die Felder selbst.
 *
 * Gespeichert wurde schon immer bei jedem Tastendruck, neu gezeichnet bewusst
 * nicht: Ein render() ersetzt das Feld und nimmt den Fokus mitten im Wort mit.
 * Damit blieb aber auch stehen, was aus der Eingabe folgt. Nach „Scheibengröße
 * hinzufügen" (0,5 kg × 4) und dem Eintippen von 10 × 2 stand neben der Zeile
 * weiter „+1 kg je Paar · 2 Paare", und die Vorschau zeigte je Hand
 * „0 · 1 · 2,5 · 3,5 …" – Gewichte aus 0,5er-Scheiben, die es gar nicht gibt.
 * Ausgerechnet die Vorschau, die belegen soll, dass richtig eingetragen ist,
 * ließ einen richtigen Vorrat vertippt aussehen (gefunden auf dem Weg durch die
 * App). Wie bei der Terminsuche wird deshalb nur das ersetzt, was sich aus der
 * Eingabe ergibt.
 */
function scheibenNachziehen(feld) {
  const zeile = feld.closest('.scheiben-zeile');
  if (zeile && feld.dataset.i !== undefined) {
    const roh = roherSatz().scheiben[Number(feld.dataset.i)] || [];
    zeile.querySelectorAll('.scheiben-hint, .scheiben-warn').forEach((x) => x.remove());
    zeile.insertAdjacentHTML('beforeend', scheibenZeilenHinweis(roh[0], roh[1]));
  }
  const block = view.querySelector('.scheiben-einstellbar');
  if (block) block.innerHTML = scheibenEinstellbar();
  const paare = view.querySelector('.super-vorschau');
  if (paare) paare.outerHTML = superVorschau() || '<div class="super-vorschau" hidden></div>';
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
  if (grund.warum === 'vorrat') {
    return `<div class="aufwaerm">Statt ${esc(alt.db.name)}
        <span class="muted">– dafür fehlt gerade das Gerät. Unter Mehr → Was da ist
        wieder anhaken.</span></div>`;
  }
  // Bei Stufe und eigener Wahl zeigt es die Zeile mit − und + (fassungRow()).
  return '';
}

/**
 * − und + für die Ausführung – wie bei den Bändern.
 *
 *     „ich will generell keine Alternativen, sondern höchstens nur statt +
 *      die schwerere Übungs-Version, ähnlich wie bei den gelben und roten
 *      Bändern"
 *
 * Bis v205 stand hier eine Reihe „Dieselben Muskeln, andere Übung" mit allen
 * Übungen gleicher Anteile (beim Seitheben vier, darunter das Seitheben mit
 * Flaschen). Jetzt gibt es nur noch, was der Katalog als leichter oder
 * schwerer kennt (`anfaenger`): − die leichtere, + die schwerere Ausführung,
 * in derselben Zeile wie sonst das Gewicht oder das Band. Beim Knieheben:
 * − im Liegen, + hängend. Wo es keine Stufen gibt, steht nichts.
 *
 * Gespeichert wird unter der Übung, **wie sie im Plan steht** – nicht unter
 * der gerade gezeigten. Sonst kippte die Wahl mit sich selbst.
 */
function fassungRow(it, mode) {
  // Nicht bei einem Tausch wegen fehlenden Geräts: Dann gehört die Zeile zu
  // einer Übung, die gar nicht dasteht.
  const grund = ersatzGrund(it);
  if (grund && grund.warum === 'vorrat') return '';
  const f = fassungen(it);
  if (!f) return '';
  const seite = mode === 'bw' ? 'bw' : 'db';
  const name = (id) => { const e = EX_BY_ID.get(id); return e ? e[seite].name : id; };
  // Unter dem Zeichen steht, wohin es geht – die Übung selbst, nicht nur
  // „schwerer":
  //
  //     „Bei schwerer kann ruhig die Übung stehen und so"
  //
  // „schwerer" sagte nur die Richtung; was dann kommt, stand erst nach dem
  // Tippen da. Und es lief über den Knopf hinaus. Jetzt ist der Knopf so breit,
  // wie der Name es braucht (höchstens ein gutes Drittel der Zeile), und der
  // Name bricht um.
  const knopf = (id, plus) => {
    if (!id) {
      return `<button type="button" class="kg-step${plus ? ' kg-plus' : ''}" disabled
              aria-label="${esc(plus ? 'Keine schwerere Ausführung' : 'Keine leichtere Ausführung')}">${plus ? '+' : '−'}</button>`;
    }
    // Ein Knopf auf eine Übung, deren Gerät fehlt, verspricht etwas, das nicht
    // kommt: Der Gerätefilter läuft danach und tauscht sie wieder weg.
    const moeglich = uebungGeht(id, mode);
    const ex = EX_BY_ID.get(id);
    return `<button type="button" class="kg-step fassung-knopf${plus ? ' kg-plus' : ''}"
              data-act="fassung-waehlen" data-ex="${esc(f.plan)}" data-v="${esc(id)}"
              ${moeglich ? '' : 'disabled'}
              aria-label="${esc(moeglich ? `${plus ? 'Schwerer' : 'Leichter'}: ${name(id)}`
    : `${name(id)} geht gerade nicht – ${ex[seite].equip} fehlt`)}">${plus ? '+' : '−'}<span class="kg-step-d">${esc(name(id))}</span></button>`;
  };
  const stufe = f.leichter && f.schwerer ? 'mittel' : (f.leichter ? 'schwer' : 'leicht');
  return `
    <div class="ex-weight band-row fassung-row" role="group" aria-label="Ausführung von ${esc(it.name)}">
      ${knopf(f.leichter, false)}
      <div class="kg-main">
        <span class="kg-val kg-fest">${stufe}</span>
        <span class="kg-unit">Ausführung${it.statt && it.statt !== it.id
    // „statt X" nur, wenn X nicht ohnehin schon auf einem der Knöpfe steht.
    && it.statt !== f.leichter && it.statt !== f.schwerer
    ? ` · statt ${esc(name(it.statt))}` : ''}</span>
      </div>
      ${knopf(f.schwerer, true)}
    </div>`;
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
 * Einen Link in die Zwischenablage legen.
 *
 * Diese Funktion gab es nicht. Drei Stellen riefen sie trotzdem auf - "Link
 * kopieren" unter Mehr, und die beiden Teilen-Knoepfe auf jedem Geraet ohne
 * navigator.share (jeder Desktop-Firefox etwa). Alle drei liefen in einen
 * ReferenceError, und "Link kopieren" tat nie etwas anderes als das. Gefunden
 * hat es der Linter beim allerersten Lauf; kein Browsertest war je dort.
 *
 * Mit Rueckfalltuer: navigator.clipboard gibt es nur im sicheren Kontext, und
 * ohne ihn ist ein markiertes Feld immer noch besser als nichts.
 */
function linkKopieren(url) {
  const gut = () => toast('Link kopiert');
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(url).then(gut).catch(() => zeigeLink(url));
    return;
  }
  zeigeLink(url);
}

/** Letzte Rettung: den Link sichtbar hinstellen, markiert, zum Selbstkopieren. */
function zeigeLink(url) {
  const feld = document.createElement('input');
  feld.value = url;
  feld.setAttribute('readonly', '');
  feld.style.cssText = 'position:fixed;left:8px;right:8px;bottom:72px;width:auto;z-index:99';
  document.body.appendChild(feld);
  feld.select();
  toast('Kopieren ging nicht - der Link steht unten zum Markieren.');
  setTimeout(() => feld.remove(), 15000);
}

/**
 * Ausführliche Erklärung zu einer Übung, aufklappbar.
 *
 * Der kurze Hinweis über der Bewegung sagt, was zu tun ist. Alles, was man
 * einmal wissen will und dann nicht mehr – welcher Griff, wie der Aufbau geht,
 * was schiefgeht –, steht hier darunter und nimmt zugeklappt eine Zeile weg.
 */
/**
 * „Wenn etwas weh tut" – der Weg von einer Stelle am Körper zu einer Folge.
 *
 *     „Viel mehr soll man bestimmte Schmerzen oder so die man bei bestimmten
 *      Übungen hat unter Krankheiten abhaken können bzw es soll bei der Übung
 *      ein Erklärungstext stehen was man machen soll wenn man schmerzen in
 *      bestimmten Bereichen hat. Wenn da rauskommt dass die Übung einfach
 *      nicht für einen geeignet ist dann soll sie natürlich ganz raus"
 *
 * Genau diese drei Schritte, in dieser Reihenfolge: **Wo** tut es weh, **was**
 * ist dann zu tun, und **wenn das nichts hilft**, gehört es unter Beschwerden.
 * Von dort greift die Maschinerie, die es seit jeher gibt – js/injuries.js mit
 * avoid, swap und care.
 *
 * Bis v190 stand hier stattdessen eine Auswahl ähnlicher Übungen. Die war die
 * falsche Antwort auf dieselbe Frage, und zwar aus zwei Gründen: Sie ließ den
 * Nutzer entscheiden, was die App besser weiß, und sie galt nur für diese eine
 * Übung statt für jede, die dieselbe Stelle belastet.
 *
 * Der Knopf hakt die Beschwerde an und macht damit **mehr**, als diese Übung zu
 * tauschen. Deshalb steht am Knopf, was er anhakt, und nicht „Übung tauschen".
 * Ist sie schon angehakt, sagt die Zeile das und der Knopf ist weg; abgehakt
 * wird unter Beschwerden, nicht hier – sonst gäbe es zwei Orte für dieselbe
 * Entscheidung, und einer von beiden wäre irgendwann der falsche.
 */
function schmerzBlock(it) {
  if (!it.schmerz || !it.schmerz.length) return '';
  const act = store.getState().injuries || [];
  const zeile = (s) => {
    const key = `${it.id}|${s.ort}`;
    const offen = ui.openSchmerz.has(key);
    const ids = (s.verletzung || []).filter((v) => injuryById(v));
    // Kein Zweig für „steht schon unter Beschwerden". Der wäre nie zu sehen,
    // und das ist kein Zufall, sondern folgt aus der Sache: Jede Beschwerde,
    // auf die ein Schmerz-Eintrag zeigt, sperrt genau diese Übung – das prüft
    // tests/test-schmerz.mjs. Ist sie angehakt, steht die Übung nicht mehr da,
    // deren Karte den Hinweis tragen würde. Eine erste Fassung hatte den Zweig
    // trotzdem, und er war schlicht toter Code.
    const knoepfe = offen ? ids.filter((v) => !act.includes(v)).map((v) => `
        <button type="button" class="btn btn-ghost btn-sm" data-act="schmerz-anhaken" data-inj="${esc(v)}">
          „${esc(injuryById(v).name)}" anhaken
        </button>`).join('') : '';
    return `
      <button type="button" class="schmerz-h ${offen ? 'on' : ''}" data-act="toggle-schmerz"
              data-k="${esc(key)}" aria-expanded="${offen}">
        ${esc(s.ort)}<span class="chev">▼</span>
      </button>
      ${offen ? `<div class="schmerz-b"><p>${esc(s.text)}</p>
        ${knoepfe ? `<div class="btn-row">${knoepfe}</div>` : ''}</div>` : ''}`;
  };
  return `<div class="ex-schmerz">
      <div class="lbl">Wenn etwas weh tut</div>
      ${it.schmerz.map(zeile).join('')}
    </div>`;
}

/*
 * Wie man die Last allein zu Hause hochnimmt und ablegt.
 *
 *     „Sag am besten bei jeder Übung auch immer wie man das Gewicht am besten
 *      zuhause hochnimmt und ablegt wenn man alleine ist und so"
 *
 * Immer sichtbar, nicht hinter „Mehr zur Ausführung": Der Hinweis beschreibt
 * die Bewegung, aber die Stange liegt vorher auf dem Boden und muss nachher
 * wieder dorthin – ohne Ständer, ohne zweite Person. Das ist der Teil, an dem
 * man sich zu Hause verhebt, und er stand nirgends. Nur in der Hantel-Variante
 * und nur, wo es eine Last gibt (heben() in tools/build-data.py).
 */
function hebenBlock(it) {
  if (!it.heben) return '';
  return `<div class="heben"><b>Hochnehmen und ablegen:</b> ${esc(it.heben)}</div>`;
}

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

/* ------------------------------------------------------------------ *
 * Wie groß dieser Tag ist
 *
 * Anlass: "heute wieder nur fünf übungen - optimal?" – und davor "würdest du
 * sagen dass der heutige tag mit 4 Übungen optimal ist?" und "Heute hab ich ja
 * 3 mal Schulter. Sicher dass das optimal ist?". Dreimal dieselbe Frage, und
 * beantwortet hat sie bisher niemand: In der Kopfzeile stand "5 Übungen · 15
 * Sätze", also zwei Zahlen ohne Maßstab. Ob fünf viel ist, weiß nur, wer die
 * anderen 83 Einheiten daneben legen kann. Die kennt die App, der Nutzer nicht.
 *
 * Also legt sie sie daneben. Jeder Fokus hat genau zwei Größen von Einheit,
 * BBP drei – Aufbau 5/6, Cut 4/5, Oberkörper 5/6, BBP 5/6/7 –, und die
 * häufigste ist der Normalfall: 61 von 84 im Aufbau, 62 von 84 im Cut. Daraus
 * wird ein Wort: "normaler Tag", "kurzer Tag", "langer Tag". Gemessen am
 * eigenen Plan und an nichts sonst.
 *
 * Das ist bewusst keine Bewertung des Trainings. "Optimal" wäre eine Behauptung
 * über die Trainingslehre, die diese Zeile nicht belegen kann; welche Einheit
 * der Plan hier für normal hält, kann sie belegen – sie zählt nach. Und genau
 * das war die Frage hinter der Frage: "nur fünf" ist im Cut der Normalfall und
 * kein Ausfall.
 *
 * Gezählt wird mit tagLaenge(), also mit Verletzungen und Vorrat: Wer die
 * Klimmzugstange zu Hause gelassen hat, hat andere Einheiten, und dann muss die
 * Vergleichsgruppe dieselben sein. Die Nacharbeit bleibt draußen – sie hängt am
 * Protokoll und wandert, während die Tabelle für alle 84 Einheiten gilt.
 *
 * Einmal gerechnet und dann gemerkt: 84-mal exBasis() ist nichts, was in jede
 * Bildschirmausgabe gehört. Der Schlüssel führt alles mit, was die Größen
 * verschiebt – Fokus, Variante, Stufe, Verletzungen, Vorrat.
 */
let groessenCache = null;

function groessenTabelle(mode) {
  const st = store.getState();
  const key = [st.focus, mode, st.level, activeInjuries().join(','), fehlt().join(',')].join('|');
  if (groessenCache && groessenCache.key === key) return groessenCache.tab;
  const tab = new Map();
  PLAN.forEach((x) => {
    if (istCustom(x.n)) return;
    const k = tagLaenge(x, mode);
    tab.set(k, (tab.get(k) || 0) + 1);
  });
  groessenCache = { key, tab };
  return tab;
}

/** Kurz, normal oder lang – gemessen an den übrigen Einheiten dieses Fokus. */
function tagesGroesse(w, mode, anzahl) {
  if (w.custom) return null;
  const tab = groessenTabelle(mode);
  // Alle Einheiten gleich lang: Dann gibt es nichts einzuordnen, und ein "normaler
  // Tag" an jedem einzelnen Tag wäre eine Zeile, die nie etwas anderes sagt.
  if (tab.size < 2) return null;
  // Häufigste Größe zuerst; bei Gleichstand die kleinere, damit die seltenere
  // große Einheit die ist, die auffällt.
  const norm = [...tab.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0][0];
  if (anzahl === norm) return 'normaler Tag';
  return anzahl < norm ? 'kurzer Tag' : 'langer Tag';
}

/**
 * Die Kopfzeile der Einheit: Variante, Umfang, Einordnung.
 *
 * Hier stand kurzzeitig auch die Einordnung des Tages – "kurzer Tag", "normaler
 * Tag". Raus auf Zuruf: *„Das Wort 'kurzer Tag' soll weg."* Und das ist richtig
 * so. In der Kopfzeile steht, was dieser Tag *ist*; wie er sich zu den anderen
 * 83 verhält, ist eine Einordnung und keine Angabe – die gehört eine Ebene
 * tiefer, über die Übungsliste, wo sie mit Zahlen dasteht (tagNotiz).
 */
function tagKopf(w, mode, items) {
  // Die Summe, Nachholsätze und eingefügter Zusatztag eingerechnet: „Hanteln ·
  // 6 Übungen · 17 Sätze". In v238 stand hier „12 + 3 Sätze", in v239 „5 + 1
  // Übungen · 15 + 2 Sätze" – raus auf Zuruf, siehe umfangText() in
  // js/anzeige.js. Woher das Mehr kommt, steht an der Übung; eine eigene Zeile
  // dafür gibt es auch hier nicht – siehe den Kommentar in der Startansicht,
  // warum dort keine Buchhaltung mehr steht.
  return `${MODE_LABEL[mode]} · ${umfangText(items)}`;
}

/**
 * Und einmal ausgeschrieben, wo Platz dafür ist: warum die Tage verschieden
 * lang sind.
 *
 * Nicht in der Startansicht – die soll auf einen Bildschirm passen ("Hier beim
 * dashboard soll man nicht scrollen können"). Sondern über der Übungsliste,
 * also dort, wo man die Übungen zählt und die Frage aufkommt.
 *
 * Der zweite Satz ist keine Trainingslehre, sondern die Bauweise des Plans:
 * tools/build-plan.py legt das Volumen je Muskelgruppe und Woche fest und
 * verteilt es erst danach auf die Einheiten (split(), Kriterium `imbalance`).
 * Ein kurzer Tag ist deshalb kein fehlender Tag.
 *
 * **Nicht an einem Tag mit eingefügten Übungen.** Seit v240 zählt der Kopf
 * die Summe:
 *
 *     „Da soll einfach die normale Zahl dieses Trainings inkl der
 *      nachholübungen stehen. Also einfach 6 in diesem Fall."
 *
 * An Workout 9 mit den Chin-ups aus Woche 2 stand dann „6 Übungen · 0/17
 * Sätze" und direkt darunter „Einheiten in diesem Fokus: 4 bis 5 Übungen" –
 * zwei Zahlen, die sich widersprechen, auf einem Bildschirm. Die Notiz
 * vergleicht den Plan; warum dieser Tag länger ist, sagt an so einem Tag die
 * Herkunftszeile an der eingefügten Übung („Nachgeholt aus Woche 2: …"). Dann
 * ist die Summe im Kopf die einzige Übungszahl der Ansicht. Nacharbeit ändert
 * die Übungszahl nicht und lässt die Notiz stehen.
 */
function tagNotiz(w, mode, items) {
  if (items.some((it) => it.zusatz)) return '';
  if (!tagesGroesse(w, mode, items.length)) return '';
  const tab = groessenTabelle(mode);
  const groessen = [...tab.keys()].sort((a, b) => a - b);
  const norm = [...tab.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0];
  const summe = [...tab.values()].reduce((a, b) => a + b, 0);
  return `<p class="tag-note">Einheiten in diesem Fokus: ${groessen[0]} bis ${
    groessen[groessen.length - 1]} Übungen, ${norm[1]} von ${summe} mit ${norm[0]}.
    Das Pensum je Muskelgruppe steht für die <b>Woche</b> fest; der Plan verteilt
    es auf die Einheiten.</p>`;
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
 * kann. Im Ziel heißt: mindestens 90 % dessen, was der Plan für diese Woche
 * vorsieht (inTarget() und plannedWeek() gleich darunter) – nicht das Ziel
 * selbst. Eine Garantie „kein ganzer Satz unter dem Ziel" gibt
 * tools/build-plan.py für die einzelne Woche nicht: Die erzeugten Pläne
 * weichen in einzelnen Wochen um mehr als zwei Sätze ab (README, *2 bis 4
 * Sätze – gemessen*); als grob gilt dort erst eine Woche, die die Hälfte
 * des Ziels danebenliegt (MAX_REL).
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
 * Plan; die einzelne Woche liegt zwangsläufig darüber oder darunter, weil
 * sich Sätze nur als Ganzes verteilen lassen – mit Hanteln stehen je nach Stufe
 * drei oder vier je Übung da, ohne Hanteln auch zwei, fünf oder sechs
 * (satzZahlIm() in js/stufen.js). (Der Erklärtext unter
 * dem Wochenvolumen nannte bis hierher „drei Sätze" für alle; das stimmte nur
 * für Geübte und Anfänger mit Hanteln.) Wer alles abgehakt hatte, sah dann
 * trotzdem "8 von 12 Gruppen im Ziel" – ein Vorwurf für die Arithmetik des
 * Plans, nicht für den Nutzer. Verglichen wird deshalb mit dem Pensum der
 * Woche, und das kennt die App aus dem Plan.
 */
const inTarget = (got, soll) => got >= soll * 0.9;

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

/** „A", „A und B", „A, B und C". */
function undListe(namen) {
  if (namen.length < 2) return namen.join('');
  return `${namen.slice(0, -1).join(', ')} und ${namen[namen.length - 1]}`;
}

/**
 * Wo ein unberührter Zusatztag heute steht – und wie er dort heißt.
 *
 *   gebunden  er steckt in der Einheit, die heute fällig ist (`n`)
 *   leer      er gehört in diese Einheit, aber keine seiner Übungen geht dort
 *   morgen    heute wurde schon trainiert; er kommt frühestens morgen dran
 *   bereit    er ist heute die Einheit des Tages (ein Ruhetag)
 *
 * `namen` sind die Übungen, wie sie in der Einheit stehen – in einer Einheit
 * die, die dort wirklich angekommen sind, und nie die des Trägers an ihrer
 * Stelle: Ohne Klimmzugstange fielen die Chin-ups aus Workout 9, und die
 * Wochenkarte sagte weiter „holt Workout 9 heute nach: Chin-ups". Seit jede
 * solche Änderung den Träger neu rechnet (pruefeZusatztag()), kommt `leer`
 * kaum noch vor – aber wenn, sagt die Karte, was ist.
 */
function zusatzLage(c) {
  const b = zusatzBindung();
  const zahlen = (liste, mode) => ({
    namen: liste.map((it) => resolve(it, mode).name),
    saetze: liste.reduce((a, it) => a + it.sets, 0),
    anzahl: liste.length,
  });
  if (b && b.c.id === c.id) {
    const mode = store.workoutMode(b.w.n);
    const zus = workoutByNo(b.w.n, mode).ex.filter((it) => it.zusatz);
    if (!zus.length) return { art: 'leer', n: b.w.n, ...zahlen(c.ex, mode) };
    return { art: 'gebunden', n: b.w.n, ...zahlen(zus, mode) };
  }
  const art = PLAN.some((x) => store.trainiertAm(x.n, todayISO())) ? 'morgen' : 'bereit';
  return { art, ...zahlen(c.ex, store.getState().mode) };
}

/**
 * Der Hinweis unter der Wochenbilanz, solange der Zusatztag der Woche
 * unberührt ist. Sagt, wo er steckt – nicht nur, dass es ihn gibt: Ein
 * „Öffnen" auf einen Zusatztag, der längst in Workout 9 steht, führte im
 * Kreis, und „Wann soll ich das machen?" beantwortete es auch nicht.
 */
function zusatzHinweis(c) {
  const l = zusatzLage(c);
  const stil = 'class="small muted zusatz-hinweis" style="margin-top:12px"';
  if (l.art === 'gebunden') {
    return `<div ${stil}>↩︎ Was hier fehlt, holt Workout ${l.n} heute nach: ${esc(undListe(l.namen))}.
      <button type="button" class="btn btn-sm" data-act="open-workout" data-n="${l.n}"
              style="margin-left:6px">Zu Workout ${l.n}</button></div>`;
  }
  if (l.art === 'morgen') {
    return `<div ${stil}>↩︎ Für diese Woche ist ein Zusatztag vorgemerkt (${esc(undListe(l.namen))}).
      Heute war schon Training – er kommt frühestens morgen dran.</div>`;
  }
  if (l.art === 'leer') {
    return `<div ${stil}>↩︎ Für diese Woche ist ein Zusatztag vorgemerkt (${esc(undListe(l.namen))}).
      In Workout ${l.n} geht davon heute nichts.</div>`;
  }
  return `<div ${stil}>↩︎ Für diese Woche steht
    schon ein Zusatztag bereit: <b>${esc(c.name)}</b>, ${c.ex.length} Übungen.
    <button type="button" class="btn btn-sm" data-act="custom-start"
            data-id="${esc(c.id)}" style="margin-left:6px">Öffnen</button></div>`;
}

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
  // Nur, solange er unberührt ist: Nach 9 von 9 Sätzen stand hier weiter
  // „steht schon ein Zusatztag bereit … Öffnen".
  const schonDa = store.customs().find((c) => c.name === `Zusatztag Woche ${cur.nr}`
    && !store.isStarted(c.id));

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
      ${schonDa ? zusatzHinweis(schonDa) : ''}
      <div class="small muted" style="margin-top:10px">
        Verglichen wird mit dem, was <b>diese Woche</b> auf dem Plan steht – nicht mit dem
        Wochenziel. Das Ziel ist ein Schnitt über den ganzen Plan (${esc(zielText())},
        Anteile eingerechnet); die einzelne Woche liegt darüber oder darunter, weil sich
        Sätze nur als Ganzes auf die Einheiten verteilen lassen.
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
  if (nichtsAbgewaehlt()) return '';
  const { getauscht, weg } = vorratNotiz(w, mode);
  const zus = zusatzWegGrund(w, mode, 'geraet');
  if (!getauscht.length && !weg.length && !zus.length) return '';
  const nm = (id) => resolve({ id, sets: 0 }, mode).name;
  const zeilen = getauscht.map((s) => `${esc(nm(s.from))} → ${esc(nm(s.to))}`)
    .concat(weg.map((d) => `${esc(nm(d.id))} fällt aus`))
    .concat(zus.map((d) => `${esc(zusatzWegName(d, mode))} fällt aus`));
  const namen = GERAETE.filter((g) => fehlt().includes(g.id)).map((g) => g.label);
  const aus = ausUebungen().length;
  // Zwei Gründe, ein Kasten: Fehlendes Gerät und abgewählte Übung wirken
  // gleich, also steht auch beides in derselben Zeile – aber benannt, damit
  // niemand nach einem Band sucht, das er gar nicht vermisst.
  const kopf = [
    namen.length ? `Nicht da: ${namen.join(', ')}` : '',
    aus ? `${plural(aus, 'Übung', 'Übungen')} abgewählt` : '',
  ].filter(Boolean).join(' · ');
  return `
    <div class="card injury-note">
      <div class="inj-note-head">🎒 ${esc(kopf)}</div>
      <div class="small muted">Heute deshalb: ${zeilen.join(' · ')}</div>
      <button type="button" class="btn btn-ghost btn-sm" data-act="go-tab" data-tab="settings">Ändern</button>
    </div>`;
}

/**
 * Was ein eingetragener Termin heute aus der Einheit nimmt.
 *
 * Eine eigene Karte und nicht die Verletzungs-Karte: Es ist keine Beschwerde,
 * und die Begründung ist eine andere. Wer morgen Padel spielt, soll lesen,
 * *warum* die Kniebeugen fehlen – sonst sieht es aus, als hätte die App etwas
 * vergessen.
 */
function terminNote(w, mode) {
  const { dropped, termin } = injuryNotes(w.n);
  const weg = dropped.filter((d) => d.reason === 'termin');
  const zus = zusatzWegGrund(w, mode, 'termin');
  if (!termin.length || (!weg.length && !zus.length)) return '';
  const nm = (id) => resolve({ id, sets: 0 }, mode).name;
  return `
    <div class="card injury-note">
      <div class="inj-note-head">📅 Rücksicht auf: ${esc(termin.join(', '))}</div>
      <div class="small muted">Heute fällt deshalb weg:
        ${weg.map((d) => esc(nm(d.id))).concat(zus.map((d) => esc(zusatzWegName(d, mode)))).join(' · ')}</div>
      <div class="small muted" style="margin-top:6px">Die Woche liegt damit unter
        ihrem Ziel für diese Gruppen – das ist der Preis und keine Panne.</div>
      <button type="button" class="btn btn-ghost btn-sm" data-act="go-tab"
              data-tab="settings">Termine ändern</button>
    </div>`;
}

/**
 * Der Tag, an dem nichts übrig bleibt – und woran das liegt.
 *
 * Die Karte gab es schon, sie nannte aber immer nur die Verletzungen als
 * Grund. Seit es Aktivitäten gibt, kann eine Einheit auch deshalb leer sein,
 * weil vorgestern vier Stunden Ski gefahren wurde – und dann führt „die
 * angehakten Beschwerden sperren jede Übung" in die Irre, weil man in einer
 * leeren Verletzungsliste nach einem Fehler sucht. Hier steht der Grund, der
 * tatsächlich zutrifft.
 */
function leererTag(n) {
  const { dropped, termin } = injuryNotes(n);
  const wegenTermin = dropped.filter((d) => d.reason === 'termin').length;
  const wegenKoerper = dropped.length - wegenTermin;
  const grund = wegenTermin && wegenKoerper
    ? `${esc(termin.join(', '))} und die angehakten Beschwerden sperren zusammen jede Übung dieser Einheit`
    : (wegenTermin
      ? `Nach ${esc(termin.join(', '))} ist jede Muskelgruppe dieser Einheit noch im Muskelkater`
      : 'Die angehakten Beschwerden sperren jede Übung dieser Einheit, und für '
        + 'keine gibt es einen Ersatz, der nicht auch weh täte');
  return `
    <div class="card empty-day">
      <b>Heute bleibt nichts übrig.</b> ${grund}. Das ist kein Fehler – nur ein
      Tag, an dem Krafttraining nicht dran ist.
      ${wegenTermin
    ? '<button type="button" class="btn btn-ghost btn-sm" data-act="go-tab" data-tab="settings">Eintrag ändern</button>'
    : '<button type="button" class="btn btn-ghost btn-sm" data-act="go-injuries">Verletzungen ansehen</button>'}
    </div>`;
}

/**
 * Eintragen in drei Tipps: Tag, Aktivität, fertig.
 *
 *     „Ich will das nicht selbst anklicken müssen. … Ich will nur sagen was
 *      ich an welchem tag gemacht hab. Der Rest soll automatisch passieren"
 *
 * Deshalb steht der Tag als Knopfreihe da (Heute/Gestern/Vorgestern deckt fast
 * alles ab, das Datumsfeld bleibt für den Rest), die Aktivität kommt aus einer
 * durchsuchbaren Liste, und die Dauer ist mit dem üblichen Wert der Aktivität
 * vorbelegt. Wer nichts an der Dauer ändert, tippt zweimal.
 *
 * Was dabei herauskommt, steht *vor* dem Eintragen da und nicht erst danach:
 * welche Gruppen an welchem Tag ausfallen und warum diese. Nichts soll
 * unbemerkt passieren – am wenigsten etwas, das die App selbst ausgerechnet hat.
 */
function aktivitaetWahl() {
  const heute = todayISO();
  const datum = ui.terminDatum || heute;
  const akt = AKT_BY_ID.get(ui.terminAkt) || null;
  const minuten = ui.terminMin || (akt ? akt.typisch : 60);
  const TAGE = [['Heute', heute], ['Gestern', addDays(heute, -1)], ['Vorgestern', addDays(heute, -2)]];
  const DAUERN = [30, 45, 60, 90, 120, 180, 240];

  return `
    <div class="lbl" style="margin-top:14px">Wann</div>
    <div class="btn-row nav" style="margin-top:6px" role="group" aria-label="Tag wählen">
      ${TAGE.map(([label, iso]) => `
        <button type="button" class="btn ${datum === iso ? 'btn-primary' : ''}"
                aria-pressed="${datum === iso}" data-act="termin-tag" data-v="${iso}">${label}</button>`).join('')}
    </div>
    <label class="zeit" style="margin-top:6px; display:block"><span class="lbl">anderer Tag</span>
      <input type="date" id="terminDatum" value="${esc(datum)}"
             min="${esc(addDays(heute, -30))}" data-act="termin-datum"></label>

    <div class="lbl" style="margin-top:14px">Was</div>
    <input type="search" id="terminSuche" class="such-feld" placeholder="Suchen – z. B. Padel"
           value="${esc(ui.terminSuche || '')}" data-act="termin-suche"
           aria-label="Aktivität suchen">
    <div class="akt-liste">${aktivitaetListe()}</div>

    ${akt ? `
      <div class="lbl" style="margin-top:14px">Wie lange</div>
      <div class="btn-row nav" style="margin-top:6px" role="group" aria-label="Dauer wählen">
        ${DAUERN.map((m) => `
          <button type="button" class="btn ${minuten === m ? 'btn-primary' : ''}"
                  aria-pressed="${minuten === m}" data-act="termin-dauer" data-v="${m}">${
  m >= 60 ? `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')} h` : `${m} min`}</button>`).join('')}
      </div>
      ${aktivitaetVorschau(akt, minuten, datum)}
      <div class="btn-row" style="margin-top:10px">
        <button type="button" class="btn btn-primary btn-block" data-act="termin-neu">
          ${esc(akt.name)} eintragen</button>
      </div>`
    : '<div class="small muted" style="margin-top:8px">Such dir oben eine Aktivität aus.</div>'}`;
}

/** Die Auswahlliste, nach Familien gruppiert und über das Suchfeld gefiltert. */
function aktivitaetListe() {
  const q = (ui.terminSuche || '').trim().toLowerCase();
  const passt = (a) => !q || a.name.toLowerCase().includes(q) || a.familie.toLowerCase().includes(q);
  const treffer = AKTIVITAETEN.filter(passt);
  if (!treffer.length) {
    return `<div class="small muted">Nichts gefunden. ${AKTIVITAETEN.length} Aktivitäten
      stehen zur Wahl – vielleicht heißt sie hier anders.</div>`;
  }
  return familien().map((f) => {
    const drin = treffer.filter((a) => a.familie === f);
    if (!drin.length) return '';
    return `
      <div class="akt-familie">${esc(f)}</div>
      <div class="btn-row">
        ${drin.map((a) => `
          <button type="button" class="btn btn-sm ${ui.terminAkt === a.id ? 'btn-primary' : ''}"
                  aria-pressed="${ui.terminAkt === a.id}"
                  data-act="termin-akt" data-v="${esc(a.id)}">${esc(a.name)}</button>`).join('')}
      </div>`;
  }).join('');
}

/**
 * Was der Eintrag bewirken wird – bevor er gemacht wird.
 *
 * Zeigt Tag für Tag, welche Gruppen ausfallen, dazu den Satz aus dem Katalog,
 * der erklärt, warum gerade diese. Kommt nichts über die Schwelle, steht das
 * genauso da: „ändert an deinem Plan nichts" ist eine Auskunft und kein Fehler.
 */
function aktivitaetVorschau(akt, minuten, datum) {
  const heute = todayISO();
  const TAGE = [[-1, 'am Tag davor'], [0, 'am Tag selbst'],
                [1, 'am Tag danach'], [2, 'zwei Tage danach']];
  // Nur Tage, an denen noch etwas ausfallen *kann*. Wer gestern gespielt hat,
  // dem nützt „am Tag selbst fällt aus" nichts mehr – der Tag ist herum, und
  // eine Zeile, die nichts mehr ändert, liest sich wie eine, die es tut.
  const zeilen = TAGE.map(([d, label]) => {
    const tag = addDays(datum, d);
    if (tag < heute) return '';
    const g = gruppenAm(akt.id, minuten, d);
    if (!g.length) return '';
    return `<li><b>${esc(label)}</b> (${esc(fmtDate(tag))}): ${
      g.map((m) => esc(MUSCLE_LABEL[m] || m)).sort().join(', ')}</li>`;
  }).filter(Boolean);
  return `
    <div class="card akt-vorschau" style="margin-top:10px">
      <div class="lbl">Das fällt dann aus</div>
      ${zeilen.length ? `<ul class="akt-tage">${zeilen.join('')}</ul>`
    : '<div class="small muted">Nichts mehr – das ändert an deinem Plan nichts.</div>'}
      <div class="small muted" style="margin-top:8px">${esc(akt.warum)}</div>
    </div>`;
}

/** Die eingetragenen Termine als Liste, mit einem Weg, sie wieder loszuwerden. */
function terminListe() {
  const liste = termine();
  if (!liste.length) {
    return '<div class="small muted" style="margin-top:8px">Noch nichts eingetragen.</div>';
  }
  return `<div style="margin-top:10px">${liste.map((t, i) => {
    const akt = t.aktivitaet && AKT_BY_ID.get(t.aktivitaet);
    // Wie lange der Eintrag noch etwas tut: der letzte Tag, an dem er greift.
    const letzter = addDays(t.datum, akt ? nachwirkung(t.aktivitaet, t.minuten) : 1);
    const stand = letzter < todayISO() ? ' · vorbei'
      : (t.datum < todayISO() ? ' · wirkt noch' : '');
    const dauer = akt && t.minuten
      ? ` · ${t.minuten >= 60 ? `${Math.floor(t.minuten / 60)}:${String(t.minuten % 60).padStart(2, '0')} h` : `${t.minuten} min`}`
      : '';
    return `
    <div class="switch-row">
      <div>
        <div class="lbl">${esc(t.name || terminLabel(t))}</div>
        <div class="hint">${esc(fmtDate(t.datum))}${esc(dauer)}${esc(stand)}</div>
      </div>
      <button type="button" class="btn btn-ghost btn-sm" data-act="termin-weg"
              data-i="${i}" aria-label="Eintrag entfernen">Entfernen</button>
    </div>`;
  }).join('')}</div>`;
}

/*
 * Eine Übung aus dem festgehaltenen Zusatztag, die heute wegfällt, steht in
 * derselben Notiz wie eine Planübung aus demselben Grund – mit dem Zusatz,
 * woher sie kam: „Chin-ups (nachgeholt aus Woche 2) fällt aus". Vorher fiel
 * sie wortlos weg (zusatzWeg() in js/plan.js): Tennisarm angehakt, und aus
 * „5 + 1 Übungen" wurden „5 Übungen", ohne dass irgendwo „Chin-ups" stand.
 * Kein eigener Kasten, kein Toast – die Zeile, die es schon gibt.
 */
function zusatzWegGrund(w, mode, grund) {
  return w.custom ? [] : zusatzWeg(w, mode).filter((d) => d.grund === grund);
}
function zusatzWegName(d, mode) {
  return `${resolve({ id: d.id, sets: 0 }, mode).name} (nachgeholt aus Woche ${d.woche})`;
}

/** Kurzfassung fürs Training: was heute anders ist. */
function injuryNote(w, mode) {
  const act = activeInjuries();
  if (!act.length) return '';
  const { dropped, swapped } = injuryNotes(w.n, mode);
  const names = act.map((id) => (injuryById(id) || {}).name).filter(Boolean);
  const nm = (id) => resolve({ id, sets: 0 }, mode).name;
  const lines = [];
  swapped.forEach((s) => lines.push(`${esc(nm(s.from))} → ${esc(nm(s.to))}`));
  dropped.forEach((d) => lines.push(`${esc(nm(d.id))} fällt aus${
    d.reason === 'rest' ? ' (Ersatz erst nach 48 h)' : ''}`));
  zusatzWegGrund(w, mode, 'beschwerde')
    .forEach((d) => lines.push(`${esc(zusatzWegName(d, mode))} fällt aus`));
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


function renderCalendar() {
  const today = todayISO();
  const byDate = new Map();
  PLAN.forEach((w) => {
    const d = effDate(w);
    byDate.set(d, (byDate.get(d) || []).concat(w));
  });
  const month = calMonthNow(ui.calMonth);
  const sel = ui.calDay;
  const tage = monthGrid(month);
  const frueher = fruehereTage();
  const akt = aktivitaetTage();
  const eigene = eigeneTage();
  // Ausgefallene Trainingstage, aus dem Protokoll gerechnet – einmal je
  // Zeichnung, nicht je Kachel (siehe ausfallTage() in js/plan.js).
  const aus = ausfallTage(today);

  // Gezählt werden Einheiten, nicht Tage – an einem Tag können zwei stehen.
  const imMonat = tage.filter((d) => d.slice(0, 7) === month.slice(0, 7))
    .flatMap((d) => (byDate.get(d) || []).map((w) => dayState(w, d, today)));
  const zaehl = { done: 0, part: 0, miss: 0, plan: 0 };
  const proModus = { db: 0, bw: 0 };
  imMonat.forEach((st) => {
    zaehl[st.kind] += 1;
    if (st.kind === 'done') proModus[st.mode] += 1;
  });
  // Aus früheren Plänen, an Tagen ohne Einheit im laufenden.
  //
  // Sie zählen in die Summe und in „trainiert" hinein, ohne eigenen Nachsatz:
  // *„Mach keine Unterscheidung in trainiert früherer Plan und trainiert."*
  // Vorher las sich der Monat nach einem Plan-Wechsel als „0 trainiert",
  // obwohl an sechs Tagen trainiert worden war.
  const altImMonat = tage.filter((d) => d.slice(0, 7) === month.slice(0, 7)
    && !(byDate.get(d) || []).length && frueher.has(d))
    .reduce((a, d) => a + frueher.get(d).einheiten, 0);
  tage.filter((d) => d.slice(0, 7) === month.slice(0, 7)
    && !(byDate.get(d) || []).length && frueher.has(d))
    .forEach((d) => { proModus[frueher.get(d).mode] += frueher.get(d).einheiten; });
  // Sport außerhalb des Plans zählt nicht als Einheit – er ist keine. Er steht
  // als eigener Nachsatz, mit den Namen, damit man ihn auch ohne Antippen sieht.
  // Eigene Einheiten – der Zusatztag vor allem – sind trainiert wie jede andere.
  const eigenImMonat = tage.filter((d) => d.slice(0, 7) === month.slice(0, 7) && eigene.has(d))
    .flatMap((d) => eigene.get(d));
  eigenImMonat.forEach((x) => { proModus[x.mode] += 1; });
  const imMonatAkt = tage.filter((d) => d.slice(0, 7) === month.slice(0, 7) && akt.has(d))
    .flatMap((d) => akt.get(d).map((t) => t.name || terminLabel(t)));
  // Ausgefallen sind Tage, keine Einheiten – die Einheit, die dran war, steht
  // offen oder trainiert an ihrem neuen Tag und ist dort schon gezählt; die
  // Vereinigung mit dayState() fängt die Minuten nach Mitternacht ab, bevor
  // catchUpPlan() läuft.
  //
  //     „Im Kalender ist aktuell nichts unter ausgefallen obwohl ich mehrere
  //      Trainings hab ausfallen lassen"
  //
  // Bis hierher stand an dieser Stelle zaehl.miss, und das war nach dem
  // Nachrücken immer null. Mit „Tage" im Text, weil sich „5 trainiert · 2
  // ausgefallen · 11 offen" bei 16 Einheiten sonst wie ein Rechenfehler liest.
  const ausImMonat = tage.filter((d) => d.slice(0, 7) === month.slice(0, 7)
    && (aus.has(d) || (byDate.get(d) || []).some((w) => dayState(w, d, today).kind === 'miss'))).length;
  // Zusammengehalten (geschützte Leerzeichen): Bei 414 px brach die Zeile
  // sonst hinter „🤸 0) · 2", und die 2 las sich wie Teil der Moduszählung.
  const ausgefallenText = (k) => `${plural(k, 'Tag', 'Tage')} ausgefallen`.replace(/ /g, '\u00a0');

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
      <div class="cal-grid">${tage.map((d) => calendarCell(d, month, today, byDate, sel, frueher, akt, eigene, aus)).join('')}</div>
      <div class="cal-legend">
        <span><i class="dot done"></i> trainiert</span>
        <span><i class="dot part"></i> angefangen</span>
        <span><i class="dot plan"></i> geplant</span>
        <span><i class="dot miss"></i> ausgefallen</span>
        ${imMonatAkt.length ? `<span><i class="dot akt"></i> ${esc(AKT_ICON)} anderer Sport</span>` : ''}
      </div>
      <div class="small muted">
        ${plural(imMonat.length + altImMonat + eigenImMonat.length, 'Einheit', 'Einheiten')} in diesem Monat ·
        ${zaehl.done + altImMonat + eigenImMonat.length} trainiert${zaehl.done + altImMonat + eigenImMonat.length
          ? ` (${MODE_ICON.db} ${proModus.db} · ${MODE_ICON.bw} ${proModus.bw})` : ''}${
          ausImMonat ? ` · ${ausgefallenText(ausImMonat)}` : ''}${
          zaehl.plan ? ` · ${zaehl.plan} offen` : ''}${
          imMonatAkt.length ? ` · ${plural(imMonatAkt.length, 'Tag', 'Tage')} anderer Sport (${
            esc(aktNamen(imMonatAkt))})` : ''}
      </div>
      ${month.slice(0, 7) === today.slice(0, 7) ? '' : `
        <button type="button" class="btn btn-sm" data-act="cal-today">Zu heute</button>`}
    </div>

    ${calendarDetail(sel, byDate, today, frueher, akt, eigene, aus)}

    <div class="small muted">
      Die Termine sind die tatsächlichen: verpasste Tage rücken den Restplan
      nach hinten, abgeschlossene Einheiten bleiben auf dem Tag, an dem du
      trainiert hast. Ausgefallen steht an einem Trainingstag im Rhythmus des
      Plans, an dem nicht trainiert und bis zum nächsten Trainingstag nicht
      nachgeholt wurde.
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
  const gone = [];
  const swapCount = new Map();
  let wegenPause = 0;
  PLAN.forEach((w) => {
    // Mit dem Modus, wie die Wochenrechnung darunter (exOf(w, mode)) – ohne
    // ihn zählte die Übersicht im Hantel-Modus den Goblet Squat beim
    // Handgelenkbruch als „→ Hip Thrust getauscht", obwohl der Hip Thrust mit
    // Hanteln selbst gesperrt ist und beide wegfallen (modusNotiz() in
    // js/plan.js).
    const r = injuryNotes(w.n, mode);
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
        <thead><tr><th>Muskelgruppe</th><th>vorher</th><th>jetzt</th><th>Ziel</th></tr></thead>
        <tbody>${hits.map((x) => `<tr>
          <td>${esc(MUSCLE_LABEL[x.m] || x.m)}</td>
          <td class="muted">${komma1(x.before)}</td>
          <td class="${x.after < x.before - 0.05 ? 'inj-loss' : 'inj-gain'}">${komma1(x.after)}
            <span class="small">(${x.diff > 0 ? '+' : '−'}${komma1(Math.abs(x.diff))})</span></td>
          <td class="muted">${(FOCUS.derived || []).includes(x.m) ? '–' : fmtNum(+targetOf(x.m).toFixed(1))}</td>
        </tr>`).join('')}</tbody>
      </table>
      <div class="small muted" style="margin-top:8px">Sätze je Woche, Anteile eingerechnet. Das Ziel ist dasselbe
        wie in der Statistik; – heißt: kein eigenes Ziel, die Gruppe läuft bei anderen Übungen mit.</div>
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

  // Nach Region gesammelt, in der Reihenfolge ihres ersten Auftretens – nicht
  // nur benachbarte Einträge: Sonst stand „Leiste" zweimal da, mit „Hüfte"
  // dazwischen.
  const areas = [];
  INJURIES.forEach((i) => {
    const g = areas.find((a) => a.area === i.area);
    if (g) g.list.push(i);
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
    // Was hier steht, soll auch der Kopf des Protokolls sagen – außer in der
    // Einzeldatei, die gar keinen Zwischenspeicher hat (dort sagt er „Einzeldatei").
    if (!EINZELDATEI) diagnoseFassung(keys);
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
        // Der Umfang wie im Kopf der Einheit und im Kalender, mit umfangText()
        // in js/anzeige.js – hier stand er selbst zusammengesetzt, und ein
        // Workout mit einer Übung hieß „1 Übungen · 3 Sätze", während der Kopf
        // nach „Öffnen" „1 Übung · 3 Sätze" sagte.
        const prog = progressOf(c.id, store.workoutMode(c.id));
        // Ein Zusatztag, der heute in einer Einheit steckt oder erst morgen
        // dran ist, ist hier nur zum Nachsehen da: Öffnen führte am Plan
        // vorbei in eine zweite Einheit, Bearbeiten und Löschen änderten etwas,
        // das gerade Teil einer anderen Einheit ist. Er sagt, wo er steckt.
        if (ZUSATZ_NAME.test(c.name) && !store.isStarted(c.id)) {
          const l = zusatzLage(c);
          if (l.art !== 'bereit') {
            const wo = {
              gebunden: `steckt heute in Workout ${l.n}`,
              leer: `geht heute in Workout ${l.n} nicht`,
            }[l.art] || 'frühestens morgen – heute war schon Training';
            return `
        <div class="card zusatz-karte">
          <div class="lbl">${esc(c.name)}</div>
          <div class="hint">${esc(wo)} · ${plural(l.anzahl, 'Übung', 'Übungen')} · ${plural(l.saetze, 'Satz', 'Sätze')}</div>
          <div class="small muted" style="margin-top:6px">${esc(l.namen.join(' · '))}</div>
          ${l.art === 'gebunden' ? `<div class="btn-row nav">
            <button type="button" class="btn btn-primary" data-act="open-workout" data-n="${l.n}">Zu Workout ${l.n}</button>
          </div>` : ''}
        </div>`;
          }
        }
        return `
        <div class="card">
          <div class="lbl">${esc(c.name)}</div>
          <div class="hint">${umfangText(c.ex)}${
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
  oberkoerper: 'Brust, Rücken, Schultern und Arme. Die Beine nur als Grundlage, je ein '
    + 'Termin pro Woche.',
  // Hier stand „dieselben Übungen mit denselben Gewichten … jede Gruppe kommt
  // weiter zweimal die Woche dran". Beides stimmte nicht: Der Cut hat eine
  // eigene Auswahl (welche, steht jetzt gerechnet darunter), und die
  // Beinbeuger kommen einmal die Woche dran (tools/pruefung/plan-pruefen.py
  // --bericht). Gefunden bei der Durchsicht der App.
  cut: 'Für Wochen im Kaloriendefizit, oder wenn einfach die Zeit knapp ist: weniger Sätze je '
    + 'Einheit. Die meisten Gruppen kommen etwa zweimal die Woche dran, die Beinbeuger einmal.',
};

/**
 * Welche Übungen ein Fokus anders hat als der Normalfall – gerechnet, nicht
 * beschrieben.
 * Eine Beschreibung von Hand war schon einmal falsch (siehe cut oben), und die
 * Pläne werden neu gerechnet, ohne dass jemand die Karten liest.
 */
function fokusAnders(key) {
  if (key === 'standard' || !PLANS.standard || !PLANS[key]) return '';
  const ids = (p) => new Set(p.plan.flatMap((w) => w.ex.map((x) => x.id)));
  const basis = ids(PLANS.standard);
  const hier = ids(PLANS[key]);
  const modus = store.getState().mode === 'bw' ? 'bw' : 'db';
  const name = (id) => { const e = EX_BY_ID.get(id); return (e && e[modus] && e[modus].name) || id; };
  const ohne = [...basis].filter((id) => !hier.has(id)).map(name);
  const neu = [...hier].filter((id) => !basis.has(id)).map(name);
  if (!ohne.length && !neu.length) return '';
  return [
    ohne.length ? `Fällt weg: ${ohne.join(', ')}.` : '',
    neu.length ? `Kommt dazu: ${neu.join(', ')}.` : '',
  ].filter(Boolean).join(' ');
}

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
 * Gezählt werden nur Einheiten, in denen jeder Satz abgehakt ist, mit
 * erfasster Zeit und ohne Supersätze. Vorher zählte jede abgeschlossene – auch
 * „Abschließen (4/18)" –, und deren kurze Uhrzeit stand gegen die volle Formel:
 * Nach ein paar vorzeitig beendeten Einheiten zeigten die Fokus-Karten bis zur
 * Hälfte zu kurze Einheiten, als „gemessen". Supersätze kürzen die Einheit um
 * rund 40 %, und die Formel kennt keine. Gefunden bei der Durchsicht der App.
 *
 * Verglichen werden Summen und nicht Einzelwerte: Eine Einheit, bei der die App
 * im Hintergrund lag, zieht so nicht den ganzen Schnitt.
 */
function zeitEichung() {
  const log = store.getState().log;
  let echt = 0;
  let formel = 0;
  let n = 0;
  PLAN.forEach((w) => {
    const e = log[w.n];
    const m = completedMode(w.n);
    if (!e || !m || !(e.secs > 0) || e.super) return;
    if (!progressOf(w.n, m).complete) return;
    // Die ganze Einheit, samt eingefügtem Zusatztag: Die Uhr lief auch für ihn.
    const soll = dauerLautFormel(einheitEx(w, m), m);
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
  const saetze = v.plan.reduce((a, w) => a + w.ex.reduce((b, x) => b + satzZahlIm(v.plan, w.n, x.id, roh(x), modus), 0), 0);
  const proEinheit = saetze / v.plan.length;
  // Mit den echten Pausen rechnen, nicht mit einem Mittelwert für alle: Ein Satz
  // Chin-ups kostet 180 s Pause, einer Wadenheben 90. Pauschal zweieinhalb
  // Minuten je Satz unterschätzte deshalb genau die Varianten mit vielen
  // Grundübungen – und nach dieser Zahl wird die Variante ausgesucht.
  const sekunden = v.plan.reduce((a, w) => a + w.ex.reduce((b, x) => {
    const ex = EX_BY_ID.get(x.id);
    const pause = (ex && ex[modus] && ex[modus].rest) || 120;
    // Arbeit plus Pause nach jedem Satz; die letzte Pause der Einheit fällt weg.
    return b + satzZahlIm(v.plan, w.n, x.id, roh(x), modus) * (ARBEIT_JE_SATZ + pause);
  }, 0) - ((w.ex.length && EX_BY_ID.get(w.ex[w.ex.length - 1].id)[modus].rest) || 0), 0);
  // Wer schon gemessen hat, bekommt seine eigene Zahl statt der Formel.
  const eich = zeitEichung();
  const min = Math.round((sekunden * (eich ? eich.faktor : 1) / v.plan.length / 60) / 5) * 5;
  return `${v.plan.length} Einheiten · ${komma1(proEinheit)} Sätze je Einheit · `
    + `${eich ? '' : 'ca. '}${min} min${eich ? ' (gemessen)' : ''}`;
}

/** Auswahlkarten für den Trainingsfokus – im Einstieg und in den Einstellungen. */
function fokusKarten(aktuell) {
  return Object.entries(PLANS).map(([key, v]) => `
    <button type="button" class="fokus-btn ${key === aktuell ? 'on' : ''}"
            aria-pressed="${key === aktuell}" data-act="set-focus" data-v="${key}">
      <span class="lbl">${esc(v.name)}${key === aktuell ? ' ✓' : ''}</span>
      <span class="hint">${esc(FOKUS_TEXT[key] || '')}</span>
      ${fokusAnders(key) ? `<span class="hint fokus-anders">${esc(fokusAnders(key))}</span>` : ''}
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


function renderUebungen() {
  view.innerHTML = uebungsListe();
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
      <button type="button" class="kachel" data-act="go-tab" data-tab="uebungen">
        <span class="kachel-i">📋</span>
        <span><span class="lbl">Übungen${ausUebungen().length ? ` · ${ausUebungen().length} aus` : ''}</span>
        <span class="hint">Alle Übungen nach Muskelgruppen – einzeln an- und abwählbar.</span></span>
      </button>
      <button type="button" class="kachel" data-act="go-tab" data-tab="injuries">
        <span class="kachel-i">🩹</span>
        <span><span class="lbl">Verletzt${act ? ` · ${act} aktiv` : ''}</span>
        <span class="hint">Anhaken, was weh tut – der Plan tauscht dann selbst.</span></span>
      </button>
    </div>

    ${modusKarte(s.mode === 'bw' ? 'bw' : 'db')}

    <div class="section-title">Pause zwischen den Sätzen</div>
    ${pausenKarte(s)}

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
            A, B, A, B. Gepaart wird nur, was keinen Hauptmuskel teilt und nicht dasselbe Gerät
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
            Hälfte und drei Viertel des Arbeitsgewichts, eingerastet auf deine Scheiben
            oder, ohne eingetragene, auf die Schrittweite der Übung. Nur bei Grund- und
            schweren Nebenübungen; ein Seitheben mit 5 kg braucht das nicht. Abgehakt wird
            nichts davon: Aufwärmsätze zählen nicht in die Statistik und nicht für den
            Stufenaufstieg.</div>
        </div>
        <button type="button" class="toggle" aria-pressed="${!!s.aufwaermen}"
                data-act="toggle-aufwaermen" aria-label="Aufwärmsätze anzeigen"></button>
      </div>
      ${s.supersatz ? superVorschau() : ''}
    </div>

    ${vorratKarte(ui.vorratSeite)}

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
      <!-- Die Auswertung schreibt tonStandZeigen() hinein – und zieht sie mit
           jedem Ton nach, der kommt oder ausfällt (onTonStand). -->
      <div class="ton-stand" id="tonStand"></div>` : ''}
    </div>

    <div class="section-title">Sport außerhalb des Plans</div>
    <div class="card">
      <div class="small muted">Sag, <b>was</b> du <b>wann</b> gemacht hast – den Rest rechnet
        die App. Jede Aktivität weiß, welche Muskelgruppen sie trifft und wie lange sie
        nachwirkt; die betroffenen Übungen fallen dann aus der Einheit. Vergangene Tage
        darfst du nachtragen, das ist sogar der Normalfall.</div>
      ${terminListe()}
      ${aktivitaetWahl()}
      <div class="small muted" style="margin-top:10px">Der Plan verschiebt sich dadurch
        <b>nicht</b>. Die Übungen fallen weg, und die Woche liegt dann unter ihrem Ziel
        für diese Gruppen. Wer lieber die ganze Einheit vorzieht, macht das im Plan.</div>
    </div>

    <!-- Hier stand „Erinnerung am Trainingstag": ein Schalter, zwei Uhrzeiten,
         ein Knopf „Zuverlässig machen (Push einrichten)" samt Anleitung für das
         GitHub-Secret. Alles raus, auf Ansage:

           „Mach auch die einmalige Push Nachricht morgens weg. Pausen usw
            sollen aber natürlich immer noch mit angezeigt werden"

         Und zwar der ganze Weg und nicht nur die Meldung – siehe sw.js. Ein
         Web Push, der nichts anzeigt, ist unter userVisibleOnly keine stille
         Lösung: Chrome blendet dann irgendwann selbst „im Hintergrund
         aktualisiert" ein, und damit stünde wieder eine Meldung da.

         Was mit der Pause zu tun hat, ist davon unberührt und steht weiter
         unter „Ton und Vibration". -->

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

    <div class="section-title" id="kalender">Kalender</div>
    ${kalenderKarte()}
    <div class="card">
      <div class="small muted">Alle Trainingstermine als Kalenderdatei, jeweils um 18 Uhr,
        mit den Übungen des Tages in der Beschreibung.
        <b>Die Google-Kalender-App kann keine Dateien einlesen</b> – das geht nur über die
        Weboberfläche. Am Handy: in Chrome <i>calendar.google.com</i> öffnen, im
        Drei-Punkte-Menü <i>Desktopseite</i> anhaken, dann
        <i>Einstellungen → Importieren und exportieren</i>.</div>
      ${icsHinweis()}
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

    <div class="section-title" id="daten">Daten</div>
    ${sicherungKarte()}
    <div class="card">
      ${ui.teilenFehler ? `<div class="notice warn" id="teilenFehler">Teilen hat dein Browser
        abgelehnt (${esc(ui.teilenFehler)}). Die Sicherung wurde stattdessen heruntergeladen – kam
        kein Download, steht sie unten im Textfeld zum Kopieren.</div>` : ''}
      <div class="small muted">Alles liegt lokal im Browser – Android räumt den bei Platzmangel weg.
        ${(() => {
          const b = store.getState().lastBackup;
          if (!b) return hatServer() ? 'Als Datei noch nie gesichert.' : 'Noch nie gesichert.';
          return `${hatServer() ? 'Als Datei zuletzt' : 'Zuletzt'} gesichert am ${esc(fmtDate(b.on))}, nach ${esc(plural(b.done, 'Einheit', 'Einheiten'))}.`;
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
      <textarea class="io" id="io" placeholder="Hier JSON einfügen und auf „Importieren&quot; tippen…" style="margin-top:10px"></textarea>
      <div class="btn-row">
        <button type="button" class="btn btn-primary" data-act="import-file">Datei laden</button>
        <button type="button" class="btn" data-act="import">Eingefügten Text laden</button>
      </div>
      <div class="small muted" style="margin-top:8px">Umzug auf ein anderes Gerät oder in die
        installierte App: dort <i>Als Datei sichern</i>, hier <i>Datei laden</i>. Der eingelesene
        Stand ersetzt den bisherigen vollständig; der bisherige wird beiseitegelegt.</div>
      ${store.vorImport() ? `<div class="btn-row">
        <button type="button" class="btn" data-act="vor-import-zurueck">Stand von vor dem Import zurückholen</button>
      </div>
      <div class="small muted">Beiseitegelegt am ${esc(fmtDate(store.vorImport().am.slice(0, 10)))}.
        Geht einmal – danach ist der beiseitegelegte Stand weg.</div>` : ''}
      <div class="btn-row" style="margin-top:10px">
        <button type="button" class="btn btn-danger" data-act="reset-all">Alle Daten löschen</button>
      </div>
    </div>
    ${diagnoseKarte()}

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
      aufgebaut auf ${EXERCISES.length} Übungen. Zu jeder Hantelübung gehört ein
      Bodyweight-Äquivalent mit eigener Satzzahl und angepasstem Wiederholungsbereich.
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
  tonStandZeigen();
  diagnoseZeigen();
  // Hat der Browser das Teilen abgelehnt, steht die Sicherung schon im
  // Textfeld – der Weg, der auch ohne Download und ohne Teilen geht.
  if (ui.teilenFehler) {
    const io = document.getElementById('io');
    if (io && !io.value) io.value = store.exportJSON();
  }
}

/* ------------------------------------------------------------------ *
 * Diagnoseprotokoll – was davon zu sehen ist
 *
 *     „Können wir nicht allgemein alles mögliche im Hintergrund loggen damit du
 *      siehst was funktioniert und was nicht oder so?"
 *
 * Mitgeschrieben wird in js/diagnose.js. Hier steht, wo man es sieht und wie es
 * weggeht: eine Karte unter Mehr → Daten, mit dem Schalter, der Lage zum
 * Abfotografieren, Teilen als .txt, Kopieren, Ansehen und Löschen. Einen Weg
 * nach draußen gibt es nur über diese Knöpfe – kein Server, keine Sicherung,
 * kein Rückkanal.
 * ------------------------------------------------------------------ */

/** Ein Stempel aus dem Protokoll („2026-10-22 19:02:…") kurz: „22.10. 19:02". */
function stempelKurz(stempel) {
  if (!stempel) return '';
  return `${stempel.slice(8, 10)}.${stempel.slice(5, 7)}. ${stempel.slice(11, 16)}`;
}

/** Ein Zeitpunkt (ms oder ISO) in Ortszeit, ebenso kurz. */
function zeitpunktKurz(wann) {
  const d = new Date(wann);
  if (Number.isNaN(d.getTime())) return '?';
  const zwei = (n) => String(n).padStart(2, '0');
  return `${zwei(d.getDate())}.${zwei(d.getMonth() + 1)}. ${zwei(d.getHours())}:${zwei(d.getMinutes())}`;
}

/** Millisekunden mit Komma, wie überall in der App. */
const msKurz = (ms) => `${komma1(ms)} ms`;

/**
 * Der Kopf über dem Protokoll – die Lage in acht Zeilen, frisch gebaut beim
 * Ansehen, Teilen und Kopieren, nie gespeichert. Hier und nicht in
 * js/diagnose.js, weil nur diese Datei Store, Ton und Sicherung kennt.
 *
 * Was hier steht, ist dieselbe Sorte Angabe wie im Protokoll: Zustände, Zahlen,
 * Zeiten. Kein Name, keine Kennung des Geräts, kein Schlüssel, keine Meldung des
 * Servers ungefiltert (diagnoseSauber()).
 */
function diagnoseKopf() {
  const s = store.getState();
  const st = diagnoseStand();
  const t = tonStand();
  const jetzt = new Date();
  const zwei = (n) => String(n).padStart(2, '0');
  const tag = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'][jetzt.getDay()];
  const anzeige = (() => {
    try {
      if (navigator.standalone === true) return 'installiert (iOS)';
      return window.matchMedia('(display-mode: standalone)').matches ? 'installiert (standalone)' : 'im Browser';
    } catch { return 'Anzeige unbekannt'; }
  })();
  const fassung = EINZELDATEI ? 'Einzeldatei' : (st.fassung ? `Fassung ${st.fassung}` : 'Fassung unbekannt');
  const speicher = store.canPersist() ? 'ok' : (store.speicherGrund() || 'gestört');
  const ton = { laeuft: 'läuft', schlaeft: 'schläft', aus: 'aus' }[t.zustand] || t.zustand;
  const erlaubnis = !('Notification' in window) ? 'keine Hinweise im Browser'
    : ({ granted: 'erlaubt', denied: 'blockiert', default: 'nicht gefragt' }[Notification.permission] || Notification.permission);
  const sm = sicherungMetaLesen();
  const sicherung = !hatServer() ? 'Sicherung: kein Server'
    : !sicherungAn() ? 'Sicherung aus'
      : `Sicherung ${sm.ok ? `zuletzt ${zeitpunktKurz(sm.ok)} ok` : 'noch nie'}${
        sm.fehler ? ` · zuletzt gescheitert: ${diagnoseSauber(sm.fehler).slice(0, 80)}` : ''}${
        sm.konflikt ? ` · Konflikt ${sm.konflikt.art}` : ''}${sm.fehlt ? ' · Server kennt sie nicht' : ''}`;
  const rueck = !hatServer() ? 'Rückkanal: kein Server'
    : `Rückkanal ${meldetMit() ? 'an' : 'aus'}${s.lastShare ? `, zuletzt ${s.lastShare.on} ${s.lastShare.ok ? 'ok' : 'gescheitert'}` : ''}`;
  const pause = s.rest ? `Pause läuft, noch ${Math.max(0, Math.round((s.rest.endsAt - Date.now()) / 1000))} s` : 'Pause keine';
  return [
    `Workout-Diagnose · ${tag} ${zwei(jetzt.getDate())}.${zwei(jetzt.getMonth() + 1)}.${jetzt.getFullYear()} `
      + `${zwei(jetzt.getHours())}:${zwei(jetzt.getMinutes())} · Zeitzone ${diagnoseZone(jetzt)} · bleibt auf dem Gerät, geteilt nur auf Tipp`,
    `${fassung} · ${anzeige} · ${uaKurz()} · ${window.innerWidth}x${window.innerHeight} · ${navigator.onLine ? 'online' : 'offline'}`,
    `Speicher ${speicher}, ${s.dauerhaft ? 'dauerhaft zugesagt' : 'nichts zugesagt'} · Stand ${kb('workout.state.v1')} KB`
      + ` · Ablage ${kb('workout.rounds.v1')} KB · Protokoll ${plural(st.zeilen, 'Zeile', 'Zeilen')} / ${Math.round(st.bytes / 1024)} KB`
      + `${st.von ? ` seit ${stempelKurz(st.von)}` : ''}${st.nurRam ? ` · nur im Arbeitsspeicher (${st.warum})` : ''}`,
    `Ton ${ton} · ${t.gespielt} gespielt, ${t.verpasst} verpasst (${t.gesperrt} vor der ersten Berührung), `
      + `${t.verspaetet} verspätet · frei ${t.frei ? 'ja' : 'nein'} · klemmt ${t.klemmt ? 'ja' : 'nein'}`
      + `${t.wartet ? ` · wartet auf ${t.wartet}` : ''} · Töne ${s.sound ? 'an' : 'aus'}, `
      + `Satz-Tupfer ${s.soundSets ? 'an' : 'aus'}, Hinweise ${s.notify ? 'an' : 'aus'} (${erlaubnis})`,
    `${s.session ? `Einheit ${s.session.n} läuft` : 'keine Einheit läuft'} · ${pause} · Plan ${s.focus || 'standard'}, `
      + `shift ${s.shift || 0} · Service Worker ${navigator.serviceWorker && navigator.serviceWorker.controller ? 'aktiv' : 'keiner'}`,
    `${sicherung} · ${rueck} · ${kalenderKurz()}`,
    `Fehler im Protokoll ${st.fehler} · Einträge heute ${st.heute} · Schreibungen diese Sitzung ${st.schreibungen}`
      + `${st.schreibungen ? `, längste ${msKurz(st.schreibMsMax)}, Mittel ${msKurz(st.schreibMsMittel)}` : ''}`,
    `UA: ${navigator.userAgent || '?'}`,
  ];
}

/** Die Karte unter Mehr → Daten. Gefüllt wird sie danach (diagnoseZeigen()). */
function diagnoseKarte() {
  const st = diagnoseStand();
  const knoepfe = st.zeilen || st.an;
  return `
    <div class="card" id="diagnose">
      <div class="switch-row">
        <div>
          <div class="lbl">Diagnoseprotokoll</div>
          <div class="hint">Die App schreibt für sich mit, was sie technisch tut: Start und Fassung,
            Töne, Pausen, abgehakte Sätze (nur Einheit, Übung und Satznummer – keine Gewichte, keine
            Wiederholungen, kein Name), Fehler, Speicher, Sicherungsversuche. Mit Uhrzeiten, also
            auch, wann du trainierst. Es bleibt auf diesem Gerät – höchstens 64 KB und 14 Tage, dann
            fallen die ältesten Zeilen weg – und geht nirgendwohin, auch nicht mit der Sicherung oder
            an den Betreiber, außer du tippst unten auf „Teilen" oder „Kopieren". Wer die App
            weiterbaut, sieht daran, was auf deinem Gerät funktioniert und was nicht.</div>
        </div>
        <button type="button" class="toggle" aria-pressed="${st.an}" data-act="toggle-diagnose"
          aria-label="Diagnoseprotokoll"></button>
      </div>
      <div class="small muted" id="diagnoseStand" style="margin-top:8px"></div>
      ${st.zeilen ? '<pre class="io diagnose-lage" id="diagnoseLage"></pre>' : ''}
      ${ui.diagnoseFehler ? `<div class="notice warn" id="diagnoseFehler">Teilen hat dein Browser
        abgelehnt (${esc(ui.diagnoseFehler)}). Das Protokoll wurde stattdessen heruntergeladen – kam
        kein Download, steht es unten zum Kopieren.</div>` : ''}
      ${knoepfe ? `<div class="btn-row">
        <button type="button" class="btn btn-primary" data-act="diagnose-teilen">Protokoll teilen</button>
        <button type="button" class="btn" data-act="diagnose-kopieren">Kopieren</button>
        <button type="button" class="btn" data-act="diagnose-ansehen">${ui.diagnoseOffen ? 'Zuklappen' : 'Alles ansehen'}</button>
        <button type="button" class="btn btn-ghost" data-act="diagnose-loeschen">Protokoll löschen</button>
      </div>` : ''}
      ${ui.diagnoseOffen ? `<textarea class="io diagnose-text" id="diagnoseText" readonly
        aria-label="Diagnoseprotokoll" style="margin-top:10px"></textarea>` : ''}
      <div class="small muted" style="margin-top:8px">${st.zeilen ? `Zum Abfotografieren reicht der
        Kasten: oben die Lage, darunter die letzten acht Einträge. ` : ''}<i>Alle Daten löschen</i>
        räumt das Protokoll mit; der Schalter bleibt, wie er ist.</div>
    </div>`;
}

/**
 * Die Karte füllen – nach dem Zeichnen, als Text: Nichts von den 64 KB läuft
 * durch esc() und innerHTML.
 */
function diagnoseZeigen() {
  const stand = document.getElementById('diagnoseStand');
  if (!stand) return;
  const st = diagnoseStand();
  // „1 Einträge" stand nach jedem Löschen da (die eine Zeile, die sagt, warum)
  // – gefunden beim Gegenlesen.
  const eintraege = plural(st.zeilen, 'Eintrag', 'Einträge');
  if (!st.an) {
    stand.textContent = `Abgeschaltet – es wird nichts mehr mitgeschrieben.${st.zeilen
      ? ` Was da ist (${eintraege}), bleibt bis zum Löschen.` : ''}`;
  } else if (!st.zeilen) {
    stand.textContent = 'Noch nichts mitgeschrieben – kommt mit dem nächsten Start.';
  } else if (st.nurRam) {
    stand.textContent = st.speicherDa
      ? `${eintraege}. Der Speicher ist knapp – das Protokoll läuft bis zum nächsten Start nur im Arbeitsspeicher und gibt seinen Platz dem Training. Teilen geht trotzdem.`
      : `${eintraege}. Dieser Browser lässt nichts speichern – das Protokoll lebt nur, bis die Seite zugeht. Teilen geht trotzdem.`;
  } else {
    stand.textContent = `${eintraege} seit ${stempelKurz(st.von)} · ${Math.max(1, Math.round(st.bytes / 1024))} KB`
      + ` · ${st.fehler} Fehler`
      + `${st.schreibungen ? ` · zuletzt geschrieben ${new Date(st.zuletzt).toTimeString().slice(0, 8)}`
        + ` (längste Schreibung ${msKurz(st.schreibMsMax)})` : ' · in dieser Sitzung noch nicht geschrieben'}.`;
  }
  const kopf = diagnoseKopf();
  const lage = document.getElementById('diagnoseLage');
  // Der Kasten ohne die Zeile „UA: …": Am Handy sind das vier umbrochene
  // Zeilen, und Browser und System stehen kurz schon in der zweiten. Ganz steht
  // sie im geteilten Text. Gefunden beim Gegenlesen: Mit ihr und einer festen
  // Höhe zeigte der Kasten bei 414 px keinen der letzten acht Einträge.
  if (lage) {
    lage.textContent = `${kopf.filter((z) => !z.startsWith('UA: ')).join('\n')}\n---\n${diagnoseZeilen().slice(-8).join('\n')}`;
  }
  const ta = document.getElementById('diagnoseText');
  if (ta) {
    ta.value = diagnoseText(kopf);
    ta.scrollTop = ta.scrollHeight;   // das Neueste steht unten
  }
}

/**
 * Teilen – gebaut wie teileBackup(), weil genau der Weg auf Chrome Android
 * repariert ist: .txt mit genau 'text/plain', kein await vor share() (sonst ist
 * die Berührung verbraucht), Abbruch still, jede Ablehnung endet im Download
 * und im Textfeld.
 */
async function diagnoseTeilen() {
  const text = diagnoseText(diagnoseKopf());
  const name = `workout-diagnose-${todayISO()}.txt`;
  const datei = new File([text], name, { type: 'text/plain' });
  ui.diagnoseFehler = '';
  if (navigator.canShare && navigator.canShare({ files: [datei] })) {
    try {
      await navigator.share({ files: [datei], title: 'Workout-Diagnose' });
      notieren('diagnose', { was: 'geteilt', bytes: text.length });
      toast('Protokoll weitergegeben');
      return;
    } catch (e) {
      if (e && e.name === 'AbortError') return;   // abgebrochen: eine Entscheidung, keine Meldung
      ui.diagnoseFehler = e && e.name ? `${e.name}${e.message ? ` – ${e.message}` : ''}` : 'ohne Angabe';
    }
  }
  herunterladen(text, name, 'text/plain');
  notieren('diagnose', { was: 'download', bytes: text.length, fehler: ui.diagnoseFehler ? ui.diagnoseFehler.split(' ')[0] : undefined });
  ui.diagnoseOffen = true;   // der Weg, der überall geht
  if (ui.tab === 'settings') render();
  toast(ui.diagnoseFehler
    ? 'Teilen hat der Browser abgelehnt – als Datei gespeichert. Der Text steht unten zum Kopieren.'
    : 'Als Datei gespeichert');
}

/**
 * Kopieren – in die Zwischenablage, wo es sie gibt (sicherer Kontext, aus der
 * Berührung heraus, kein await davor); sonst steht der Text markiert im Feld.
 * Kein execCommand('copy'): veraltet, und die App benutzt es nirgends.
 */
function diagnoseKopieren() {
  const text = diagnoseText(diagnoseKopf());
  const zeigen = () => {
    ui.diagnoseOffen = true;
    render();
    const ta = document.getElementById('diagnoseText');
    if (ta) { ta.focus(); ta.select(); }
    toast('Kopieren ging nicht – der Text steht unten markiert.');
  };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => {
      notieren('diagnose', { was: 'kopiert', bytes: text.length });
      toast('Protokoll kopiert');
    }, zeigen);
    return;
  }
  zeigen();
}

/**
 * Was der Ton-Weg gerade tut – im Klartext.
 *
 * *„Aktuell hör ich bei mir in der app überhaupt keine sounds."* Dahinter
 * stecken zwei Ursachen, die von außen gleich aussehen: Die App schickt keinen
 * Ton los, oder sie schickt ihn los und das Gerät gibt ihn nicht aus. Ob eine
 * Seite hörbar ist, kann sie selbst nicht wissen – was sie weiß, ist, ob der
 * Tonkanal offen war und wie viele Töne hinausgingen. Genau das steht hier.
 *
 * Das Urteil zuerst, in Textfarbe und in einem Satz: Ist die App stumm oder
 * das Handy? Erst darunter, grau und als Liste, was ein Handy stumm machen
 * kann. Vorher stand die Antwort im dritten Satz von 65 Wörtern kleinem Grau,
 * und die Zahl der Töne stand zweimal hintereinander.
 */
const TON_URSACHEN = [
  'Medien-Lautstärke: Die Wippe regelt sie nur, während etwas spielt – also während „Töne anhören" hochdrücken.',
  'Bluetooth-Kopfhörer oder Auto verbunden? Dann kommt der Ton dort.',
  'Bitte nicht stören',
  'Chrome: Einstellungen → Website-Einstellungen → Ton',
  'iPhone: der Stummschalter – die App folgt ihm, damit Musik aus anderen Apps weiterläuft',
];

function tonStandZeigen() {
  const host = document.getElementById('tonStand');
  if (!host) return;
  const t = tonStand();
  const toene = (n) => (n === 1 ? '1 Ton' : `${n} Töne`);
  const kam = (n) => (n === 1 ? 'kam' : 'kamen');
  /*
   * Die Auswertung in einfachen Worten. *„Irgendwie gibt's überhaupt keine
   * soundeffekte mehr in der app"* – die Zeile soll genau die eine Frage
   * beantworten, die die App beantworten kann: Liegt es an ihr, am Browser
   * oder am Gerät?
   *
   *   läuft, Töne durch    → am Gerät. Alles, was ein Handy stumm macht, steht
   *                          darunter – jeder Punkt ist auf Android oder iPhone
   *                          schon einmal die Ursache gewesen.
   *   „Töne anhören" läuft → noch kein Urteil, aber auch keine Aufforderung,
   *                          auf den Knopf zu tippen, auf den man eben tippte.
   *   angehalten           → am Browser: ohne Berührung keine Freigabe – oder,
   *                          nach einer Berührung, ein Kontext, den ein Anruf
   *                          oder App-Wechsel unterbrochen hat (klemmt).
   *   noch nichts          → die App wollte noch keinen Ton. Nur dann – zuerst
   *                          stand das auch, wenn nach dem Neuladen schon zwei
   *                          Töne verpasst waren und einer auf den ersten Tipp
   *                          wartete. Dann jetzt: woran es liegt, was deshalb
   *                          fehlte, was ein Tipp noch bringt.
   *
   * Was nicht pünktlich kam, steht dahinter – mit seiner Ursache, und davon
   * gibt es zwei: noch keine Berührung seit dem Öffnen (dann lässt der Browser
   * keinen Ton zu), oder ein Kanal, den der Browser angehalten hatte (im
   * Hintergrund, nach einem Anruf). Zuerst hieß jeder verpasste Ton
   * „angehalten" – auch die, die nur auf den ersten Tipp gewartet hatten. Dann
   * standen für zwei Töne aus derselben Ursache zwei verschiedene Gründe da,
   * und der zweite deutete auf ein Problem im Hintergrund, das es nie gab. Ein
   * nachgeholter Gong kam verspätet, nicht „nicht": So erlebt man es auch.
   */
  const SPERRE = 'vor deiner ersten Berührung nach dem Öffnen lässt der Browser keinen Ton zu';
  const ANGEHALTEN = 'der Browser hatte den Ton angehalten, etwa im Hintergrund';
  const folgen = (spaet, weg, warumSpaet, warumWeg, warum) => {
    if (spaet && weg) {
      return ` ${warum[0].toUpperCase()}${warum.slice(1)} – deshalb ${kam(spaet)} ${toene(spaet)} verspätet, ${toene(weg)} ${kam(weg)} gar nicht.`;
    }
    if (spaet) return ` ${toene(spaet)} ${kam(spaet)} verspätet – ${warumSpaet}.`;
    if (weg) return ` ${toene(weg)} ${kam(weg)} nicht – ${warumWeg}.`;
    return '';
  };
  const angehaltenWeg = t.verpasst - t.gesperrt;
  const sperre = folgen(t.nachgeholt, t.gesperrt,
    'erst mit deiner ersten Berührung, vorher lässt der Browser keinen Ton zu', SPERRE, SPERRE);
  const angehalten = folgen(t.verspaetet - t.nachgeholt, angehaltenWeg,
    ANGEHALTEN, 'der Browser hatte den Ton in dem Moment angehalten', ANGEHALTEN);
  let urteil;
  let darunter = '';
  if (!t.moeglich) {
    urteil = '✗ Dieser Browser kann keine Töne erzeugen.';
  } else if (t.zustand === 'laeuft' && t.gespielt > 0) {
    urteil = `✓ Die App schickt Töne los (${t.gespielt} seit dem Öffnen).${sperre}${angehalten}`;
    darunter = `<div class="muted">Hörst du nichts, liegt es am Handy:</div>
      <ul>${TON_URSACHEN.map((u) => `<li>${esc(u)}</li>`).join('')}</ul>`;
  } else if (t.zustand === 'laeuft' && t.laufend) {
    urteil = '♪ Töne laufen gerade …';
  } else if (t.zustand === 'laeuft') {
    urteil = `Der Ton ist frei, aber noch kam keiner durch – tipp auf „Töne anhören".${sperre}${angehalten}`;
  } else if (t.klemmt) {
    urteil = `✗ Der Browser hält den Ton an, obwohl du schon getippt hast.${angehaltenWeg
      ? ` Deshalb ${kam(angehaltenWeg)} ${toene(angehaltenWeg)} nicht.` : ''}${sperre}`;
    darunter = `<div class="muted">Das passiert nach einem Anruf oder einem Wechsel zu einer
      anderen App. Tipp noch einmal; bleibt es stumm, die App schließen und neu öffnen.</div>`;
  } else if (!t.verpasst && !t.offen && t.zustand === 'schlaeft') {
    urteil = 'Der Browser lässt Ton erst nach einer Berührung zu – tipp auf „Töne anhören", das ist eine.';
  } else if (!t.verpasst && !t.offen) {
    urteil = 'Noch kein Ton angefordert. Tipp auf „Töne anhören": Dann steht hier, ob die App Töne losschickt.';
  } else {
    // Noch keine Berührung seit dem Öffnen, und die App wollte schon etwas
    // hören lassen: eine Pause, die das Neuladen überdauert hat, ein Gong.
    // Dann zuerst, woran es liegt, dann, was deshalb ausfiel, dann, was ein
    // Tipp jetzt noch bringt.
    const tipp = {
      pause: 'dann kommt das Pausensignal pünktlich',
      rest: 'dann kommt „Pause vorbei" noch nach',
    }[t.wartet] || (t.wartet ? 'dann kommt der Ton noch nach' : 'dann ist der Ton frei');
    urteil = `✗ Noch kein Ton frei – vor der ersten Berührung nach dem Öffnen lässt der Browser keinen zu.${t.gesperrt
      ? ` Deshalb ${kam(t.gesperrt)} ${toene(t.gesperrt)} nicht.` : ''}${angehalten} Tipp einmal irgendwohin, ${tipp}.`;
  }
  host.innerHTML = `<div class="ton-urteil">${esc(urteil)}</div>${darunter}`;
}

/*
 * Die stille Zeile im Dashboard – nur, wenn der Ton klemmt.
 *
 * Kein Popup, kein Toast: Wer trainiert, soll nicht wegtippen müssen. Sie
 * erscheint, wenn der Tonkanal nach einer Berührung weiter schläft
 * (tonStand().klemmt – iOS nach Anruf oder App-Wechsel, ein Browser, der nicht
 * weckt), und verschwindet von selbst, sobald er läuft. In allen drei Ansichten
 * des Dashboards, weil die Fokusansicht die ist, in der man trainiert.
 *
 * Das Urteil vorn, und kein Versprechen, dass der nächste Tipp weckt: Sie
 * erscheint ja gerade, weil einer es nicht getan hat. Der Abschnitt heißt so,
 * wie er unter Mehr heißt.
 *
 * `kurz`: auf der Startseite, die eine Bildschirmseite bleiben soll (siehe
 * renderOverview()) – zwei Zeilen statt vier.
 */
function tonHinweis(kurz = false) {
  if (!ui.tonHinweis) return '';
  if (kurz) {
    return `<div class="notice zeile small kurz" id="tonHinweis"><span>🔇 Töne kommen gerade nicht. Bleibt es
      stumm, App neu öffnen – <i>Mehr → Töne und Hinweise</i>.</span></div>`;
  }
  return `<div class="notice zeile small" id="tonHinweis"><span>🔇 Töne kommen gerade nicht – der
    Browser hält den Ton an, obwohl du getippt hast. Tipp noch einmal; bleibt es stumm, App
    schließen und neu öffnen. Einzelheiten unter <i>Mehr → Töne und Hinweise</i>.</span></div>`;
}

/** Nach jeder Änderung am Tonkanal: die Zeile unter Mehr, und die stille Zeile im Dashboard. */
onTonStand(() => {
  tonStandZeigen();
  const zeigen = tonStand().klemmt;
  if (zeigen === ui.tonHinweis) return;
  ui.tonHinweis = zeigen;
  // Neu zeichnen nur, wo die Zeile steht, und nie, während jemand tippt – der
  // Neuaufbau nähme ihm das Feld weg. Das passiert höchstens zweimal je
  // Sitzung: wenn sie kommt und wenn sie geht.
  const tippt = !!document.activeElement && /^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName);
  if (ui.tab === 'dashboard' && !tippt) render();
});

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
  uebungen: renderUebungen,
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
  // Ein Zusatztag, der vorn stand, kann inzwischen weg sein (verbraucht,
  // neu gerechnet, gelöscht) oder in der Einheit des Tages stecken – über
  // Mitternacht bei offener App etwa, oder nach dem Verwerfen einer Einheit.
  // Dann steht die Einheit vorn, in der er steckt, statt einer, die es so
  // nicht mehr gibt.
  if (istCustom(ui.workoutNo)) {
    const c = store.customById(ui.workoutNo);
    const b = zusatzBindung();
    if (!c) ui.workoutNo = naechsteEinheit();
    else if (b && b.c.id === c.id) ui.workoutNo = b.w.n;
  }
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
  ui.gezeigt = null;   // setzt renderFocus(), wenn es eine Übung zeigt
  (RENDERERS[ui.tab] || renderDashboard)();
  restoreFocus(hatte);
  syncHistory();
  // Die Leiste unten nach jedem Zeichnen zur gezeigten Übung passend machen –
  // hier einmal statt an jeder Stelle, die ui.focusIdx setzt.
  tickRest();
  // Welche Einheit gerade in der Fokusansicht offen ist, und bei welcher Übung
  // – damit sie nach dem Neuladen genau dort wieder aufgeht (siehe `fokusOffen`
  // beim Start). Die Übung muss mit: Weder den Sprung zum Supersatz-Partner
  // noch einen bewussten Tipp auf eine spätere Übung kann man hinterher aus den
  // Haken ablesen. Nur beim Wechsel geschrieben – der Einheit oder der Übung –,
  // nicht bei jedem Satz.
  let offen = null;
  if (ui.tab === 'dashboard' && ui.focus) {
    const ex = workoutByNo(ui.workoutNo).ex;
    const x = ex[Math.min(Math.max(0, ui.focusIdx), ex.length - 1)];
    offen = { n: ui.workoutNo, id: x ? x.id : null };
  }
  const war = store.getState().fokusOffen ?? null;
  if ((war === null) !== (offen === null) || (offen && (war.n !== offen.n || war.id !== offen.id))) {
    store.setSetting('fokusOffen', offen);
  }
}

function go(tab) {
  ui.tab = tab;
  store.setSetting('tab', tab);
  render();
  window.scrollTo({ top: 0 });
  // Unter Mehr steht, wie es um die Sicherung steht – fehlten dem Server die
  // Funktionen, sieht sie dort noch einmal nach (höchstens alle zehn Minuten).
  if (tab === 'settings') sicherungNachsehen();
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

/** Die Ebene eines Verlaufseintrags – oder, mit `ui`, die gerade sichtbare. */
const ebeneVon = (st) => `${st.tab || 'dashboard'}|${st.listView ? 1 : 0}|${st.focus ? 1 : 0}`;
const levelOf = () => ebeneVon(ui);
let lastLevel = levelOf();
let goingBack = false;
// Beim Start: Einträge über dem Dashboard, die nicht mehr gelten, werden
// zurückgegangen (siehe ganz unten beim Start, `abbauen`).
let abbauen = false;

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
  if (abbauen) {
    // Noch eine Fokusansicht oder Liste darunter? Weiter zurück, bis die
    // Ebene erreicht ist, aus der man hineingegangen war. Die zeigt jetzt, was
    // der Start entschieden hat – angezeigt wird nichts Neues.
    if (e.state && (e.state.focus || e.state.listView)) { history.back(); return; }
    abbauen = false;
    history.replaceState({ tab: ui.tab, listView: ui.listView, focus: ui.focus }, '');
    lastLevel = levelOf();
    goingBack = false;
    return;
  }
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

/** Abgehakte Sätze einer Einheit, in beiden Varianten – so viele verschwinden beim Verwerfen. */
function abgehaktInEinheit(n) {
  const e = store.getState().log[n] || {};
  return ['db', 'bw'].reduce((a, m) => a + Object.values(e[m] || {})
    .reduce((b, arr) => b + (Array.isArray(arr) ? arr.filter((x) => x && x.done).length : 0), 0), 0);
}

/**
 * Was jedes Ende einer Einheit auslöst – der Knopf „Abschließen" genauso wie
 * der letzte Haken. Gibt zurück, ob die Stufe gestiegen ist.
 *
 * Eine Stelle für beide, weil sie schon einmal auseinandergelaufen sind: Der
 * letzte Haken – Tobis gewöhnlicher Weg („soll das training automatisch zuende
 * sein") – beendete die Einheit, sicherte sie aber nicht sofort. Wer das Handy
 * gleich weglegte, schickte den Stand von vor dem letzten Satz mit: laufende
 * Einheit, letzter Satz offen, nicht als erledigt vermerkt.
 *
 * `bis` nur vom Tagesabschluss: Eine liegen gebliebene Sitzung bucht ihre Zeit
 * bis zu ihrem letzten Lebenszeichen, nicht bis jetzt (store.clockStop()).
 */
function einheitBeenden(bis) {
  const lief = store.getState().session;
  const uhrVorher = store.getState().clock;
  store.endSession(bis);
  uhrGedeckelt(uhrVorher, bis ? 'liegen geblieben' : 'ende');
  meldeStand(true);
  ui.focus = false;
  ui.listView = false;
  if (store.getState().rest) endRest(false);
  // Erst nach markDone (das erledigen beide Aufrufer vorher): Die Einheit, die
  // gerade fertig geworden ist, soll mitzählen. Sonst käme der Aufstieg immer
  // eine Einheit zu spät.
  const gestiegen = pruefeAufstieg();
  if (gestiegen) aufstiegMelden(store.getState().level);
  // Nach der letzten Einheit einer Woche entscheidet sich, ob etwas
  // liegen geblieben ist – also hier und nicht erst beim nächsten Start.
  //
  // Bis v238 sprang die Startansicht danach auf den frisch angelegten
  // Zusatztag, und der Abschluss blieb ohne Meldung. Heute ist aber schon
  // trainiert: Der Zusatztag kommt frühestens morgen dran (naechsteEinheit()),
  // die Startansicht bleibt auf der Einheit, die eben fertig wurde („Für heute
  // durch"), und der Abschluss sagt, was er ist.
  pruefeZusatztag();
  {
    const n = lief ? lief.n : null;
    const e = n !== null ? store.getState().log[n] : null;
    notieren('einheit', {
      was: 'ende', n, liegen: bis ? true : undefined, secs: e ? e.secs : undefined,
      fertig: e && e.done ? e.done : undefined, gestiegen: gestiegen ? store.getState().level : undefined,
    }, true);
  }
  // Zuletzt, damit Aufstieg und Zusatztag schon drinstehen: sofort sichern, an
  // der Drossel vorbei. Das ist der Stand, der am meisten wert ist, und das
  // Handy liegt danach oft für Stunden.
  sicherungJetzt();
  // Und der Kalender „Workout": Die Einheit steht dort ab jetzt mit „✓".
  kalenderJetzt('abschluss');
  return gestiegen;
}

/**
 * Das Training abschließen: „✓ Abschließen" und „Alle Sätze abhaken" bei
 * laufender Einheit.
 *
 * Eine Stelle für beides. „Alle Sätze abhaken" hakte bisher nur ab und ließ
 * die Uhr laufen: Die fertige Einheit hieß weiter „läuft", jede andere zeigte
 * „Workout 1 läuft noch", und ein Wechsel unter Mehr stellte sie – als
 * laufende – auf Bodyweight um, 17/18 statt fertig. Wer alles abhakt, ist
 * fertig; dann passiert, was der letzte Haken auch auslöst.
 */
function trainingBeenden(n, mode) {
  const prog = progressOf(n, mode);
  notieren('einheit', { was: 'abschliessen', n, mode, done: prog.done, total: prog.total });
  // Abgehakt ist abgehakt: Wer hier tippt, ist fertig – der Tag zählt als
  // trainiert, auch wenn nicht jeder Satz steht. Ohne einen einzigen Satz
  // wäre das allerdings gelogen.
  if (prog.done) store.markDone(n, mode);
  const gestiegen = einheitBeenden();
  sound(prog.complete ? 'done' : 'stop');
  render();
  if (gestiegen) toast('Neue Stufe – siehe oben ⬆️');
  else {
    toast(prog.complete
      ? `Training abgeschlossen – alle ${prog.total} Sätze 🎉`
      : `Gespeichert · ${prog.done}/${prog.total} Sätze`);
  }
}

/**
 * Eine Einheit starten oder fortsetzen – der Knopf „Start", „Training
 * fortsetzen" und „Doch noch weitermachen" (auch auf einer Einheit, die der
 * Tagesabschluss abgeschlossen hat). `wahl` ist die Variante, wenn der Knopf
 * eine mitbringt.
 */
function einheitStarten(n, wahl) {
  const mode = store.workoutMode(n);
  if (!workoutByNo(n).ex.length) {
    toast('Heute fällt alles weg – nichts zu starten');
    return;
  }
  // Die Variante wird vor dem Starten gewählt, nicht während des Trainings:
  // ein Umschalter zwischen zwei Sätzen ist nur eine Falle.
  if (wahl) store.setWorkoutMode(n, wahl);
  // Liegt der Termin dieser Einheit noch in der Zukunft, rückt der Plan
  // jetzt vor – ungefragt und ohne Anzeige. Dafür gab es früher einen
  // Knopf ("Heute anfangen – Plan 3 Tage vorziehen"); der ist raus, weil
  // niemand eine Verschiebung einstellen will, die sich von selbst ergibt.
  // Nach hinten macht catchUpPlan() dasselbe, wenn ein Termin verstreicht.
  // Wie viele Übungen aus einem Zusatztag schon in der Einheit stehen –
  // nach dem Vorziehen wird es womöglich einer mehr (siehe unten).
  const zusVorher = workoutByNo(n, mode).ex.filter((x) => x.zusatz).length;
  if (firstOpen().n === n && daysBetween(todayISO(), effDate(workoutByNo(n))) > 0) {
    store.setShift(shiftToToday());
  }
  // Mit dem Vorziehen ist diese Einheit heute fällig, und ein Zusatztag, der
  // bereitsteht oder jetzt erst entsteht, gehört in sie hinein
  // (zusatzEinheit() in js/plan.js) – gerechnet für heute. Auch ohne
  // Vorziehen: Eine verworfene oder umgestellte Einheit soll mit dem Stand
  // von jetzt anfangen. (Nicht beim allein stehenden Zusatztag selbst: Der
  // würde sonst womöglich unter dem Startknopf neu gerechnet.)
  if (!istCustom(n)) pruefeZusatztag();
  const zusNeu = workoutByNo(n, store.workoutMode(n)).ex.filter((x) => x.zusatz);
  initAudio('start'); // Ton jetzt freischalten, damit das erste Pausensignal sitzt
  sound('start');
  // Läuft noch eine andere Einheit, wird sie zuerst beendet – mit ihrer
  // Zeit. startSession() ersetzt die Uhr, und gebucht wird nur beim
  // Anhalten; ohne diese Zeile war alles seit dem letzten Wegschalten der
  // App verloren. Gefragt ist vorher schon: Der Knopf dafür sagt, dass die
  // andere endet (laufendWoandersBlock()).
  const lief = store.getState().session;
  const vorige = lief && lief.n !== n ? lief.n : null;
  if (vorige !== null) {
    if (store.getState().rest) endRest(false);
    store.endSession();
  }
  store.startSession(n);
  notieren('einheit', {
    was: 'start', n, mode: store.workoutMode(n), vorige: vorige ?? undefined,
    zusatz: zusNeu.length > zusVorher ? zusNeu.map((x) => x.id).join('+') : undefined,
  });
  ui.focus = true;
  ui.listView = false;
  ui.focusIdx = firstOpenExercise(n, store.workoutMode(n));
  render();
  // Kam beim Vorziehen etwas dazu, sagt der Start es – nichts ändert sich
  // unbemerkt. Woher es kommt, steht an der Übung.
  {
    const dazu = zusNeu.length > zusVorher
      ? ` · dazu ${undListe(zusNeu.map((x) => resolve(x, store.workoutMode(n)).name))} aus Woche ${zusNeu[0].zusatz.woche}`
      : '';
    toast(vorige !== null ? `${einheitTitel(vorige)} beendet, Zeit gespeichert – los geht’s 💪${dazu}`
      : `Los geht’s 💪${dazu}`);
  }
}

view.addEventListener('click', (e) => {
  const t = e.target.closest('[data-act]');
  if (!t) return;
  const act = t.dataset.act;
  const n = ui.workoutNo;
  const mode = store.workoutMode(n);

  switch (act) {
    case 'toggle-schmerz': {
      const k = t.dataset.k;
      if (ui.openSchmerz.has(k)) ui.openSchmerz.delete(k); else ui.openSchmerz.add(k);
      render();
      break;
    }
    case 'schmerz-anhaken': {
      // Nur an, nie aus. Abgehakt wird unter Beschwerden – hier stünde sonst
      // ein Schalter, der an einer einzelnen Übung etwas wegnimmt, das für
      // den ganzen Plan gilt, und das wäre eine Zusage, die er nicht hält.
      const id = t.dataset.inj;
      const inj = injuryById(id);
      if (!inj) break;
      store.toggleInjury(id, true);
      // Ein noch unberührter Zusatztag wird für die neue Lage gerechnet: Eine
      // Übung, die die Beschwerde sperrt, soll nicht bloß aus der Einheit
      // fallen, sondern durch eine ersetzt werden, die geht.
      pruefeZusatztag();
      // Danach weiter bei einer offenen Übung. Mit Hanteln steht an der Stelle
      // meist der Ersatz; ohne Hanteln fällt die Übung oft ersatzlos weg, die
      // Liste wird kürzer, und auf derselben Position stand bisher die nächste
      // – auch wenn die längst fertig war (Knieheben 4/4 statt Band-Seitheben).
      if (ui.focus) {
        const da = workoutByNo(n, store.workoutMode(n)).ex[ui.focusIdx];
        if (!da || saetzeErledigt(n, da.id, da.sets) >= da.sets) {
          ui.focusIdx = firstOpenExercise(n, store.workoutMode(n));
        }
      }
      render();
      toast(`🩹 ${inj.name} angehakt – der Plan ist angepasst`);
      break;
    }
    case 'toggle-injury': {
      const id = t.dataset.inj;
      const on = t.getAttribute('aria-pressed') !== 'true';
      store.toggleInjury(id, on);
      pruefeZusatztag();   // wie bei 'schmerz-anhaken'
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
      pruefeZusatztag();   // wie bei 'schmerz-anhaken'
      render();
      toast('Alle Haken entfernt');
      break;
    }
    case 'go-injuries':
      go('injuries');
      break;
    case 'toggle-uebung': {
      const id = t.dataset.ex;
      const an = ausUebungen().includes(id);
      setzeUebung(id, an);
      // ruestCache leeren: Die Reihenfolge einer Einheit hängt an ihren Übungen,
      // und die ändern sich hier.
      ruestCache.clear();
      // Und ein unberührter Zusatztag rechnet ohne die abgewählte Übung neu.
      pruefeZusatztag();
      render();
      break;
    }
    case 'go-tab':
      go(t.dataset.tab);
      break;
    case 'cal-month':
      ui.calMonth = addMonths(calMonthNow(ui.calMonth), Number(t.dataset.d));
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
      // Vor dem Haken: Ab hier steht fest, was nachgeholt wird – erst der
      // eingefügte Zusatztag, dann die Nacharbeit. Danach ist die Einheit
      // angefangen, und der Zusatz hinge an nichts mehr (zusatzFesthalten()).
      // Und vorher noch der Plan, falls früher trainiert wird (planVorziehen()).
      // Was dabei vorher galt, bleibt gemerkt: Ein Fehltipp – Satz an und
      // gleich wieder ab – soll den Plan nicht für immer um einen Tag
      // vorziehen. Die Einheit ist danach ja auch nicht mehr angefangen.
      const shiftVorher = store.getState().shift;
      if (planVorziehen(n)) ui.vorgezogen = { n, shift: shiftVorher };
      zusatzFesthalten(n);
      nachFesthalten(n);
      const item = workoutByNo(n, mode).ex.find((x) => x.id === id);
      if (!item) { render(); break; }
      const cur = store.getSets(n, mode, id, item.sets, item.nach || 0)[i].done;
      const variant = resolve(item, mode);
      // Eine Übung, die über beide Modi fertig ist, bekommt keinen Satz mehr
      // dazu. Nach dem Umschalten stehen ihre Knöpfe in diesem Modus leer da,
      // und ein Tipp darauf buchte bis hierher einen Satz, der nie gemacht
      // wurde: 3 Hantelsätze + 1 in der Statistik, und die App sprang mit
      // „Weiter: …" davon. Zurücknehmen geht weiter – das ist ein Haken in
      // diesem Modus, der wirklich dasteht.
      if (!cur && saetzeErledigt(n, id, item.sets) >= item.sets) {
        notieren('satz', { einheit: n, mode, ex: id, satz: i + 1, von: item.sets, abgelehnt: 'fertig' });
        toast(`${variant.name}: schon fertig – die Sätze ${mode === 'bw' ? 'mit Hanteln' : 'ohne Hanteln'} zählen mit`);
        break;
      }
      initAudio('satz'); // Berührung nutzen, solange der Browser Ton noch erlaubt
      // Ein Haken überholt das „Pause vorbei", das seit dem Neuladen auf die
      // erste Berührung wartet – auch einer, der stumm bleibt („Ton bei jedem
      // Satz" aus, im Supersatz ohne Wartezeit weiter; tonUeberholt() in
      // js/audio.js). Nur ein gesetzter: Wer als Erstes einen Haken
      // zurücknimmt, ist mit dem nächsten Satz noch nicht weiter – der Gong
      // kommt nach, wie bis v241.
      if (!cur) tonUeberholt();

      // Beim Abhaken das benutzte Gewicht mitschreiben – daraus speist sich
      // später der Vergleich "Zuletzt" und die Volumenrechnung.
      const patch = { done: !cur };
      if (!cur && variant.weight !== null) patch.w = fmtNum(workingWeight(id));
      else if (cur) patch.w = '';
      // Der Eintrag selbst kann die Uhr deckeln (store.eingetragen(): ein Satz
      // nach drei Stunden Stille) – das soll das Protokoll so sehen wie jedes
      // andere Anhalten.
      const uhrVorSatz = store.getState().clock;
      store.updateSet(n, mode, id, item.sets, i, patch, item.nach || 0);
      uhrGedeckelt(uhrVorSatz, 'satz');
      if (cur && ui.vorgezogen && ui.vorgezogen.n === n && !store.isStarted(n)) {
        store.setShift(ui.vorgezogen.shift);
        ui.vorgezogen = null;
        pruefeZusatztag();
      }

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
      // Stand melden, Aufstieg und Zusatztag prüfen, sofort sichern – alles in
      // einheitBeenden(), derselben Stelle wie beim Knopf. Sonst wäre
      // „automatisch beendet" nur halb beendet.
      if (workoutComplete && store.getState().session) {
        notieren('satz', { einheit: n, mode, ex: id, satz: i + 1, von: item.sets, done, fertig: true });
        const gestiegen = einheitBeenden();
        sound('done');
        render();
        toast(gestiegen ? 'Neue Stufe – siehe oben ⬆️'
          : `Training abgeschlossen – alle ${progressOf(n, mode).total} Sätze 🎉`);
        break;
      }
      // Fertig ist eine Übung, wenn ihre Sätze stehen – gezählt über beide
      // Modi, so wie die Karte und satzSteht() es tun. Bis v219 zählte hier
      // nur der Eimer des aktuellen Modus, und nur der Haken auf dem letzten
      // Satz: Wer mitten in der Einheit von Hanteln auf Körpergewicht
      // umschaltete, stand mit Supersätzen nach dem letzten fehlenden Satz
      // weiter bei der fertigen Übung, und es lief eine Pause „1/3“, statt
      // dass es zum nächsten Paar ging.
      const exDone = done && saetzeErledigt(n, id, item.sets) >= item.sets;

      // Wann diese Übung zuletzt dran war – daraus rechnet der Supersatz die
      // Wartezeit. Nur beim Setzen, nicht beim Wegnehmen: Ein zurückgenommener
      // Haken macht die verstrichene Zeit nicht ungeschehen.
      if (done) { satzUhr.set(id, Date.now()); satzPlus.delete(id); uhrMerken(); }

      // Ab dem ersten Satz steht die Paarung für diese Einheit (superGruppen()).
      if (done) paarungFesthalten(n, mode);

      // Im Supersatz entscheidet der Wechsel, wohin es geht und wie lange
      // gewartet wird – beides hängt am Partner. Übernimmt er, ist hier Schluss.
      const imWechsel = done && !workoutComplete && superWeiter(n, mode, id);
      // Ein Haken fürs Diagnoseprotokoll: was danach kommt – nie das Gewicht.
      // Der Satz ab 1 und „von", wie in der Pausen-Zeile daneben; die Einheit
      // heißt `einheit`, nicht `n` – gefunden beim Gegenlesen: „satz n=1 … i=0"
      // und gleich darauf „pause … satz=1" las sich wie zwei Sätze.
      notieren('satz', {
        einheit: n, mode, ex: id, satz: i + 1, von: item.sets, done, exFertig: exDone, fertig: workoutComplete,
        super: !!imWechsel,
        pause: !imWechsel && done && !workoutComplete && !exDone && i < item.sets - 1 ? restFor(variant) : 0,
      });

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
      } else if (done && !workoutComplete && !exDone && i < item.sets - 1) {
        startRest(variant.name, i, item.sets, restFor(variant), id);
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
    case 'fassung-waehlen': {
      // Gespeichert wird die gewählte Übung unter der *Plan*-Übung – siehe
      // fassungRow(). js/plan.js lässt nur zu, was dieselben Muskelanteile
      // hat; eine Wahl, die das nicht erfüllt, wirkt gar nicht.
      const plan = t.dataset.ex;
      const ziel = t.dataset.v;
      if (!plan || !EX_BY_ID.has(ziel)) break;
      store.setSetting('fassung', { ...(store.getState().fassung || {}), [plan]: ziel });
      ui.openEx.add(ziel);
      render();
      toast(`${(EX_BY_ID.get(ziel) || {}).db.name}`);
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
    case 'restart-plan': {
      // Runde 1 wandert in die Ablage, die Gewichte bleiben. Workout 1 rückt
      // auf heute, sonst würde die Nachrück-Automatik den halben Plan
      // verschieben, weil das Originaldatum längst vorbei ist.
      // Auch nach vorn: Liegt der Excel-Termin in der Zukunft, fängt die neue
      // Runde trotzdem heute an und nicht irgendwann.
      const target = daysBetween(PLAN[0].date, todayISO());
      const neu = store.restartPlan(target, rundenBilanz());
      notieren('plan', { was: 'neustart', ok: neu });
      if (!neu) {
        toast('Speicher voll – die Runde ließ sich nicht ablegen. Erst sichern und aufräumen.');
        render();
        break;
      }
      // Die Zeile zum Tagesabschluss gehörte zur alten Runde: Über „Heute ·
      // Workout 1" stand sonst „✓ Workout 12 vom Samstag ist abgeschlossen",
      // und Workout 12 der neuen Runde liegt in 19 Tagen. Hier, nicht in
      // store.restartPlan(): Rollt die Runde von selbst weiter (rundeWeiter()),
      // weil die liegen gebliebene Einheit die letzte war, bleibt sie – dort
      // sagt sie, warum die Startseite bei Workout 1 steht.
      store.setzeTagesabschluss(null);
      // Der Zusatztag der alten Runde gehört zu ihrem Protokoll, und das liegt
      // jetzt in der Ablage. Aufgeräumt wurde er bisher erst beim nächsten
      // Start – bis dahin hing er sich an Workout 1 der neuen Runde.
      pruefeZusatztag();
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
      notieren('plan', { was: 'runde zurueck', ok });
      // Mit dem Verlauf ändert sich, welche Woche fertig ist und was ihr fehlt –
      // der Zusatztag rechnet sofort neu, wie nach „Von vorn beginnen".
      if (ok) pruefeZusatztag();
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
    case 'start-session': {
      einheitStarten(n, t.dataset.mode);
      break;
    }
    case 'zur-laufenden': {
      const lief = store.getState().session;
      if (!lief) { render(); break; }
      ui.workoutNo = lief.n;
      ui.openEx.clear();
      ui.focus = true;
      ui.listView = false;
      ui.focusIdx = firstOpenExercise(lief.n, store.workoutMode(lief.n));
      render();
      break;
    }
    case 'finish-session':
      trainingBeenden(n, mode);
      break;
    case 'discard-session': {
      // Eine an einem früheren Tag abgeschlossene Einheit wird nicht verworfen
      // (siehe sessionButtons()) – auch nicht über einen Knopf, der noch von
      // vorher dasteht. Die Sitzung endet, und die Einheit bleibt, wie sie ist.
      if (frueherFertig(n)) {
        einheitBeenden();
        sound('stop');
        render();
        toast(`Weitermachen beendet – ${einheitTitel(n)} bleibt abgeschlossen`);
        break;
      }
      // Verwerfen löscht alles zu diesem Workout, in beiden Varianten – auch
      // die Sätze von vor einem Wechsel unter Mehr (verwirfEinheit() in
      // js/store.js). Die Zahl in der Rückfrage ist genau das, was verschwindet.
      const weg = abgehaktInEinheit(n);
      const ok = !weg || confirm(
        `Training abbrechen und ${weg === 1 ? 'den abgehakten Satz' : `${weg} abgehakte Sätze`} verwerfen?`,
      );
      if (!ok) break;
      notieren('einheit', { was: 'verworfen', n, weg });
      store.verwirfEinheit(n);
      // Mit der Einheit ist auch ihr festgehaltener Zusatz weg; ein neuer Träger
      // entsteht, und die Einheit zeigt ihn wieder, gerechnet für jetzt.
      pruefeZusatztag();
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
    case 'complete-workout': {
      // Wie beim einzelnen Haken: erst der Plan, dann der Zusatztag, dann die
      // Nacharbeit.
      planVorziehen(n);
      zusatzFesthalten(n);
      nachFesthalten(n);
      // Das benutzte Gewicht muss mit: Ohne es fehlen die Sätze in der
      // Verlaufskurve, und die Steigerungsserie bricht ab, weil sie das
      // Gewicht der letzten Einheit nicht wiederfindet. Beim einzelnen
      // Abhaken schreibt toggle-set es längst mit.
      notieren('einheit', { was: 'alles abgehakt', n, mode });
      store.completeWorkout(n, mode, workoutByNo(n, mode).ex.map((x) => {
        const v = resolve(x, mode);
        return { ...x, w: v.weight === null ? '' : fmtNum(workingWeight(x.id)) };
      }));
      // Läuft diese Einheit, ist sie damit fertig – wie mit dem letzten Haken
      // (siehe trainingBeenden()).
      const lief = store.getState().session;
      if (lief && lief.n === n) { trainingBeenden(n, mode); break; }
      if (store.getState().rest) endRest(false);
      sound('done');
      render();
      toast('Alle Sätze abgehakt 🎉');
      break;
    }
    case 'reset-workout': {
      // Bei der laufenden Einheit beide Varianten, aus demselben Grund wie
      // beim Abbrechen: Nach einem Wechsel unter Mehr stehen Sätze in beiden,
      // und „zurückgesetzt" hieß sonst, dass die Hälfte stehen blieb. Eine
      // nicht laufende Einheit setzt nur die gezeigte Variante zurück – das
      // sagt die Rückfrage dann auch.
      const lief = store.getState().session;
      const beide = !!lief && lief.n === n;
      const frage = beide
        ? `${einheitTitel(n)} wirklich zurücksetzen? Alle ${abgehaktInEinheit(n)} abgehakten Sätze gehen weg, in beiden Varianten.`
        : `${einheitTitel(n)} (${MODE_LABEL[mode]}) wirklich zurücksetzen?`;
      const etwas = beide ? store.isStarted(n) : hasAnyEntry(n, mode);
      if (!etwas || confirm(frage)) {
        notieren('einheit', { was: 'zurueckgesetzt', n, mode, beide });
        if (beide) store.verwirfEinheit(n); else store.resetWorkout(n, mode);
        // Steht danach nichts mehr, ist auch der festgehaltene Zusatz weg – wie
        // beim Abbrechen kommt er neu gerechnet wieder.
        pruefeZusatztag();
        if (store.getState().rest) endRest(false);
        render();
        toast(beide ? 'Zurückgesetzt – beide Varianten' : `Zurückgesetzt (${MODE_LABEL[mode]})`);
      }
      break;
    }
    case 'custom-new':
      ui.customDraft = { id: null, name: '', ex: [] };
      render();
      break;
    case 'custom-edit': {
      // Ein Zusatztag, der gerade in einer Einheit steckt, wird dort nicht
      // unter der Hand umgebaut (die Karte bietet es auch nicht an).
      if (traegerGebunden(t.dataset.id)) break;
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
    case 'custom-start': {
      // Steckt der Zusatztag heute in einer Einheit, öffnet sich die – er ist
      // dort, nicht daneben.
      const b = zusatzBindung();
      ui.workoutNo = b && b.c.id === t.dataset.id ? b.w.n : t.dataset.id;
      ui.listView = false;
      ui.focus = false;
      go('dashboard');
      break;
    }
    case 'custom-del': {
      if (traegerGebunden(t.dataset.id)) break;
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
      notieren('einheit', { was: 'markiert', n, mode });
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
      /*
       * Umschalten geht immer – auch mitten in einer Einheit.
       *
       *     „Es muss die Möglichkeit geben innerhalb eines Workouts auch in den
       *      Einstellungen was ändern zu können. Das bisher trainierte muss
       *      dann trotzdem gemerkt werden."
       *
       * Beides stimmt, und das Zweite war nie in Gefahr: Das Protokoll führt
       * die Varianten getrennt (`log[n].db` und `log[n].bw`). Ein Wechsel
       * schreibt nur, *welche* gerade gilt; abgehakte Sätze der anderen bleiben
       * unangetastet und stehen beim Zurückschalten wieder da.
       *
       * Gesperrt war der Wechsel trotzdem, sobald ein Satz stand – aus Sorge,
       * jemandem mitten im Training die Übungen unter den Fingern wegzuziehen.
       * Die Sorge war berechtigt, die Sperre die falsche Antwort: Wer bei
       * Übung 3 merkt, dass die Hantel nicht reicht, will umstellen können und
       * nicht die Einheit abbrechen. Was er bis dahin gemacht hat, zählt
       * weiter.
       */
      const neu = t.dataset.v === 'bw' ? 'bw' : 'db';
      // Jede unberührte Einheit folgt der Wahl – die vorn stehende ebenso wie
      // eine, deren Liste man vorab angesehen hat (setMode() in js/store.js).
      // Dazu die laufende, solange sie nicht fertig ist. `ui.workoutNo` ist,
      // was zuletzt auf dem Dashboard stand, auch eine längst trainierte
      // Einheit, zu der man geblättert hat. Deren Modus kippte bis hierher mit:
      // Die fertige Hantel-Einheit von heute hieß nach „ab jetzt Bodyweight"
      // plötzlich Bodyweight-Einheit, mit anderen Übungen und Haken nur noch
      // über „schon mit Hanteln gemacht". Was trainiert ist, bleibt in der
      // Variante, in der es trainiert wurde – auch die laufende, wenn alles
      // abgehakt ist und nur der Abschluss fehlt: Sonst stand die fertige
      // Einheit nach dem Wechsel bei 17/18.
      store.setMode(neu);
      // Ein noch unberührter Zusatztag rechnet im Modus der Einheit neu, in die
      // er eingefügt wird – mit den Übungen, die es dort gibt.
      pruefeZusatztag();
      const lief = store.getState().session;
      const vorn = ui.workoutNo;
      const vornEintrag = store.getState().log[vorn];
      const unberuehrt = !store.isStarted(vorn) && !(vornEintrag && vornEintrag.done);
      const laufendOffen = lief && !progressOf(lief.n, store.workoutMode(lief.n)).erledigt;
      if (laufendOffen) store.setWorkoutMode(lief.n, neu);
      // Die Fokusansicht zeigt eine Übung an ihrer Position; die andere
      // Variante hat dieselbe Zahl Übungen, aber wer gerade bei Nummer 5 stand,
      // soll dort auch wieder landen. Das tut sie von selbst – ui.focusIdx
      // bleibt stehen und wird beim Zeichnen begrenzt.
      render();
      toast(unberuehrt || (laufendOffen && lief.n === vorn)
        ? `${MODE_LABEL[neu]} – Abgehaktes bleibt gespeichert`
        : `${MODE_LABEL[neu]} – ${einheitTitel(vorn)} bleibt, wie du sie trainiert hast`);
      break;
    }
    case 'set-rest':
      initAudio('pause-wahl');
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
      if (!store.wechsleFokus(key, laeuft ? rundenBilanz() : null, frischerStart())) {
        notieren('plan', { was: 'fokus', nach: key, ok: false });
        toast('Speicher voll – der Verlauf ließ sich nicht ablegen. Erst sichern und aufräumen.');
        render();
        break;
      }
      // Der Plan steckt beim Laden in Hunderten von Zeilen; ein Wechsel mitten
      // im Betrieb hieße, dass die halbe App noch mit dem alten rechnet.
      if (store.getState().greeted) {
        vorDemNeuladen('fokus');
        location.reload();
      } else render();
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
    case 'toggle-diagnose': {
      const an = diagnoseSchalten(!diagnoseAn());
      if (!an) ui.diagnoseOffen = false;
      render();
      // Bei vollem Speicher gilt „aus" sofort, gemerkt wird es aber erst, wenn
      // wieder Platz ist (diagAusMerken() in js/diagnose.js) – das steht dabei.
      toast(an ? 'Wird ab jetzt mitgeschrieben – nur auf diesem Gerät'
        : diagnoseStand().ausOffen
          ? 'Abgeschaltet – der Speicher ist voll, gemerkt wird es, sobald wieder Platz ist'
          : 'Abgeschaltet – es wird nichts mehr mitgeschrieben');
      break;
    }
    case 'diagnose-teilen':
      diagnoseTeilen();
      break;
    case 'diagnose-kopieren':
      diagnoseKopieren();
      break;
    case 'diagnose-ansehen':
      ui.diagnoseOffen = !ui.diagnoseOffen;
      render();
      break;
    case 'diagnose-loeschen':
      if (confirm('Diagnoseprotokoll löschen? Es gibt keine Kopie – außer du hast es geteilt.')) {
        diagnoseLeeren('tipp');
        ui.diagnoseFehler = '';
        render();
        toast('Protokoll gelöscht');
      }
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
    // --- Automatische Sicherung (js/sicherung.js) ---
    case 'toggle-sicherung': {
      einstiegNameHalten();
      const an = !sicherungAn();
      sicherungSchalten(an);
      render();
      toast(an ? 'Wird ab jetzt automatisch gesichert'
        : 'Abgeschaltet – es geht nichts mehr raus. Was schon dort liegt, löscht der Knopf unter Mehr.');
      break;
    }
    case 'sicherung-holen':
      einstiegNameHalten();
      sicherungHolenStarten();
      break;
    case 'sicherung-eingabe-laden': {
      const feld = document.getElementById('sicherungSchluessel');
      const key = schluesselAus(feld ? feld.value : '');
      if (!key) {
        ui.sicherungMeldung = 'Das ist kein gültiger Schlüssel – gemeint ist der Link, den du dir '
          + 'geschickt hast, oder die 43 Zeichen hinter „#sicherung=".';
        render();
        break;
      }
      sicherungHolenMit(key, 'link');
      break;
    }
    case 'sicherung-angebot-holen':
      if (ui.sicherungAngebot) sicherungHolenMit(ui.sicherungAngebot, 'link');
      break;
    case 'sicherung-angebot-weg':
      ui.sicherungAngebot = null;
      ui.sicherungMeldung = '';
      render();
      break;
    case 'sicherung-ansehen':
      go('settings');
      { const ziel = document.getElementById('daten'); if (ziel) ziel.scrollIntoView(); }
      break;
    case 'kalender-ansehen':
      go('settings');
      { const ziel = document.getElementById('kalender'); if (ziel) ziel.scrollIntoView(); }
      break;
    case 'kalender-code':
      kalenderCodeKopieren();
      break;
    case 'kalender-mehr':
    case 'kalender-neu': {
      // Ohne render(): Eine eben eingefügte URL im Feld bliebe sonst nicht stehen.
      const offen = t.dataset.act === 'kalender-mehr' ? (ui.kalenderMehr = !ui.kalenderMehr) : (ui.kalenderNeu = !ui.kalenderNeu);
      const box = document.getElementById(t.dataset.act === 'kalender-mehr' ? 'kalenderMehr' : 'kalenderNeu');
      if (box) box.hidden = !offen;
      t.classList.toggle('on', offen);
      t.setAttribute('aria-expanded', String(offen));
      break;
    }
    case 'kalender-verbinden':
      if (!ui.kalenderLaeuft) kalenderVerbindenTipp();
      break;
    case 'kalender-trennen':
      if (!ui.kalenderLaeuft && confirm('Kalender trennen? Die Termine ab heute verschwinden aus „Workout", und das '
        + 'Skript schiebt nichts mehr. Was vorbei ist, bleibt stehen.')) kalenderTrennenTipp();
      break;
    case 'schluessel-sichern':
      // Ein Tipp: Passwortmanager, wo es ihn gibt – sonst, oder wenn der
      // Browser ablehnt (Chrome ohne Oberfläche tut das), der Link.
      (async () => {
        if (passwortManagerDa() && await schluesselImManager()) return;
        await sicherungsLinkSchicken();
      })();
      break;
    case 'schluessel-passwort':
      schluesselImManager().then((ok) => {
        if (!ok) toast('Der Browser nimmt den Schlüssel nicht an – nimm den Link');
      });
      break;
    case 'schluessel-pruefen':
      schluesselPruefen().then((da) => {
        toast(da ? 'Liegt im Passwortmanager ✓'
          : 'Im Passwortmanager liegt er nicht – leg ihn ab oder schick dir den Link');
        render();
      }).catch(() => toast('Der Passwortmanager hat nicht geantwortet'));
      break;
    case 'schluessel-link':
      sicherungsLinkSchicken();
      break;
    case 'sicherung-trotzdem':
      if (!confirm('Diesen Stand auf den Server legen? Was ein anderes Gerät dort zuletzt gesichert '
        + 'hat, wird damit ersetzt.')) break;
      sicherungTrotzdem().then(({ ok, gleich, msg }) => {
        toast(!ok ? (msg || 'Hat nicht geklappt – später noch einmal')
          : gleich ? 'Wird in wenigen Sekunden gesichert' : 'Gesichert');
        render();
      });
      break;
    case 'sicherung-von-dort': {
      const key = sicherungMetaLesen().key;
      if (key) sicherungHolenMit(key, 'eigen');
      break;
    }
    case 'sicherung-loeschen':
      if (!confirm('Die Sicherung auf dem Server löschen? Danach ist auch die automatische Sicherung '
        + 'abgeschaltet – sonst käme sie mit der nächsten Änderung wieder. Auf diesem Gerät bleibt alles.')) break;
      sicherungLoeschen().then(({ ok, zeilen, msg }) => {
        if (!ok) toast(msg || 'Hat nicht geklappt – später noch einmal');
        else toast(zeilen === 0 ? 'Da lag nichts – jetzt ist es auch abgeschaltet' : 'Gelöscht – und abgeschaltet');
        render();
      });
      render();
      break;
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
    // Hier standen bis v242 'abschluss-ok' und 'abschluss-rest', die Knöpfe der
    // Zeile zum Tagesabschluss. Die Zeile ist eine Auskunft ohne Knopf
    // (abschlussHinweis()); zurück in die Einheit geht es über
    // „Doch noch weitermachen" auf ihr (startBlock(), 'start-session').
    case 'umzug-ok':
      store.setSetting('fokusUmzug', null);
      render();
      break;
    case 'umbau-ok':
      store.setSetting('planUmbau', null);
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
      initAudio('schalter');
      const on = !store.getState().sound;
      store.setSetting('sound', on);
      // Aus heißt aus – auch für einen Gong, der auf die erste Berührung
      // wartet und sonst genau jetzt käme (tonUeberholt() in js/audio.js).
      if (!on) tonUeberholt();
      armRest(); // eine laufende Pause folgt der neuen Einstellung
      render();
      if (on) playSound('rest');
      break;
    }
    case 'toggle-sound-sets': {
      initAudio('schalter');
      const on = !store.getState().soundSets;
      store.setSetting('soundSets', on);
      render();
      if (on) playSound('set');
      break;
    }
    case 'termin-tag':
      ui.terminDatum = t.dataset.v;
      render();
      break;
    case 'termin-akt':
      // Nochmal auf dieselbe tippen wählt sie ab – sonst gibt es keinen Weg
      // zurück, wenn man sich vertippt hat.
      ui.terminAkt = ui.terminAkt === t.dataset.v ? '' : t.dataset.v;
      ui.terminMin = 0;
      render();
      break;
    case 'termin-dauer':
      ui.terminMin = Number(t.dataset.v) || 0;
      render();
      break;
    case 'termin-neu': {
      const datum = ui.terminDatum || todayISO();
      const akt = AKT_BY_ID.get(ui.terminAkt);
      if (!akt) {
        toast('Erst eine Aktivität wählen');
        break;
      }
      // Ein Tag, ein Eintrag: Zwei am selben Datum wären zwei Zeilen, von denen
      // die zweite die erste nur überdeckt.
      const liste = termine().filter((x) => x.datum !== datum);
      liste.push({ datum, name: akt.name, aktivitaet: akt.id, minuten: ui.terminMin || akt.typisch });
      store.setSetting('termine', liste);
      ui.terminAkt = '';
      ui.terminMin = 0;
      ui.terminSuche = '';
      // Ein unberührter Zusatztag rechnet mit dem, was der Termin jetzt schont
      // – wie bei einer Beschwerde (ruhendeGruppen()).
      pruefeZusatztag();
      render();
      toast(`${akt.name} am ${fmtDate(datum)} eingetragen`);
      break;
    }
    case 'termin-weg': {
      const liste = termine();
      const weg = liste[Number(t.dataset.i)];
      if (!weg) break;
      store.setSetting('termine', liste.filter((x) => x !== weg));
      pruefeZusatztag();   // wie bei 'termin-neu'
      render();
      toast('Termin entfernt');
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
      // Und ein unberührter Zusatztag rechnet mit dem Gerät, das jetzt da ist –
      // wie bei einer abgewählten Übung (toggle-uebung). Ohne das blieb er
      // auf Chin-ups stehen, während die Einheit sie ohne Stange gar nicht
      // mehr zeigte, und die Wochenkarte sagte trotzdem „holt Workout 9 heute
      // nach: Chin-ups".
      pruefeZusatztag();
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
      // Der Reihe nach, damit man hört, was wofür steht – auf der Audio-Uhr,
      // nicht per setTimeout (siehe probeSpielen in js/audio.js). Die Zeile
      // darunter zieht sich über onTonStand() mit jedem Ton nach, der kommt.
      initAudio('test');
      probeSpielen();
      tonStandZeigen();
      toast('Start · Satz · Übung fertig · fertig machen · Pause vorbei · Workout komplett');
      break;
    }
    // Eine Wahl aus dreien. Die beiden gespeicherten Felder bleiben, wie sie
    // waren – siehe pausenKarte(): „fest" merkt sich die zuletzt gewählte
    // Länge, und nur wenn keine dasteht, kommt die Voreinstellung 90 s.
    case 'set-pause': {
      const wahl = t.dataset.v;
      store.setSetting('useExerciseRest', wahl === 'je');
      if (wahl === 'aus') store.setSetting('restSeconds', 0);
      if (wahl === 'fest' && !store.getState().restSeconds) store.setSetting('restSeconds', 90);
      if (wahl === 'aus' && store.getState().rest) endRest(false);
      render();
      break;
    }
    case 'export': {
      const io = document.getElementById('io');
      io.value = store.exportJSON();
      notieren('datei', { was: 'export', bytes: io.value.length });
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
        einlesen(io.value, 'Import erfolgreich');
      } catch (err) {
        // Nur der Name, wie bei der Datei: Die Meldung zitiert den Text.
        notieren('datei', { was: 'import', quelle: 'text', ok: false, name: err && err.name });
        toast(`Import fehlgeschlagen: ${err.message}`);
      }
      break;
    }
    case 'vor-import-zurueck':
      if (confirm('Den Stand von vor dem letzten Import zurückholen? Der eingelesene Stand wird damit ersetzt.')) {
        // Die Sicherung kehrt mit zurück: zum Schlüssel von vorher. Sonst
        // schriebe die nächste Sicherung den alten Stand über die eben geholte
        // – die vom alten Handy, und das ist dann oft schon weg.
        if (store.vorImport()) sicherungRueckweg();
        notieren('datei', { was: 'import zurueck' });
        store.vorImportZurueck();
        neuStarten('Stand von vor dem Import ist zurück');
      }
      break;
    case 'force-update': {
      // Notausgang, wenn eine alte Fassung im Zwischenspeicher klebt: Service
      // Worker abmelden, Zwischenspeicher leeren, neu laden. Der localStorage
      // bleibt, dort liegen die Trainingsdaten.
      (async () => {
        // Erst nachsehen, ob der Server erreichbar ist. Ohne Netz räumte der
        // Notausgang Worker und Zwischenspeicher ab und lud neu – und dann war
        // bis zum nächsten Empfang gar keine App mehr da. Gefunden bei der
        // Durchsicht der App: Wer im Studio ohne Netz denkt, die App hänge,
        // tippt genau hier.
        try {
          const probe = await fetch(`./index.html?probe=${Date.now()}`, { cache: 'no-store' });
          if (!probe.ok) throw new Error(String(probe.status));
        } catch {
          notieren('sw', { was: 'notausgang', probe: 'kein netz' });
          toast('Gerade keine Verbindung – ohne Netz würde das die App bis zum nächsten Empfang abschalten. Später noch einmal.');
          return;
        }
        const geraeumt = { regs: 0, caches: 0 };
        try {
          if ('serviceWorker' in navigator) {
            const regs = await navigator.serviceWorker.getRegistrations();
            await Promise.all(regs.map((r) => r.unregister()));
            geraeumt.regs = regs.length;
          }
          if (window.caches) {
            const keys = await caches.keys();
            await Promise.all(keys.map((k) => caches.delete(k)));
            geraeumt.caches = keys.length;
          }
          sessionStorage.removeItem('workout.reloaded');
        } catch (e) {
          // Auch ohne Aufräumen ist ein Neuladen besser als nichts.
          geraeumt.fehler = e && e.name;
        }
        notieren('sw', { was: 'notausgang', probe: 'ok', ...geraeumt });
        store.flush();
        vorDemNeuladen('update');
        location.reload();
      })();
      break;
    }
    case 'reset-all':
      if (confirm(`Wirklich alle protokollierten Sätze und Einstellungen löschen?${
        sicherungMetaLesen().id && hatServer() ? ' Die Sicherung auf dem Server wird mitgelöscht.' : ''}${
        kalenderVerbunden() ? ' Der Kalender „Workout" wird getrennt: Die Termine ab heute verschwinden dort.' : ''}`)) {
        // Die Sicherung auf dem Server gehört dazu: Bliebe sie stehen, schriebe
        // das erste Training danach einen fast leeren Stand darüber – oder sie
        // läge für immer dort, ohne Schlüssel auf diesem Gerät, der an sie
        // herankommt. Beides wäre eine Änderung, die niemand bemerkt.
        //
        // Ohne Netz blieb sie bis v240 genau so liegen, und die Meldung sagte
        // trotzdem „gelöscht". Jetzt bleibt der Löschauftrag stehen, bis der
        // Server ihn bestätigt, und die Meldung sagt, was wirklich ist.
        const serverWeg = sicherungVergessen();
        // Erst die Zeile auf dem Server, dann den Speicher: Danach ist die
        // Kennung weg, mit der sie zu finden wäre – sie bliebe für immer
        // stehen, obwohl hier gerade alles gelöscht wird.
        // Auch bei abgeschaltetem Teilen: Abschalten hält künftige Meldungen an,
        // löscht aber nicht, was schon auf dem Server liegt. Vorher blieb die
        // Zeile dann für immer stehen – die Kennung, mit der sie zu finden
        // wäre, ist nach dem Löschen hier weg. `lastShare` sagt, ob überhaupt
        // je etwas gemeldet wurde; ohne das gibt es auch nichts zu löschen.
        const s0 = store.getState();
        const id = s0.deviceId && (meldetMit() || s0.lastShare) ? s0.deviceId : null;
        if (id) loeschen(id);
        // Der Kalender ebenso: Ohne Verbindung hier schöbe das Skript sechs
        // Wochen lang nach der alten Vorschau weiter. Das „aus" geht nach,
        // wenn gerade kein Netz ist (js/kalender-sync.js).
        kalenderVergessen();
        store.resetAll();
        // Das Diagnoseprotokoll räumt mit; sein Schalter bleibt, wie er war –
        // ein Löschen soll nie dazu führen, dass mehr mitgeschrieben wird
        // (diagnoseLeeren()). Ist es an, sagt die erste Zeile danach, warum es
        // leer ist.
        diagnoseLeeren('reset');
        ui.workoutNo = naechsteEinheit();
        render();
        serverWeg.then((weg) => {
          toast(weg ? 'Alle Daten gelöscht'
            : 'Alle Daten gelöscht – die Sicherung auf dem Server wird gelöscht, sobald wieder Netz da ist.');
          if (ui.tab === 'settings') render();
        });
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
    zusatzFesthalten(n);
    nachFesthalten(n);
    const item = workoutByNo(n, mode).ex.find((x) => x.id === t.dataset.ex);
    if (!item) return;
    store.updateSet(n, mode, t.dataset.ex, item.sets, Number(t.dataset.i), { [t.dataset.field]: t.value }, item.nach || 0);
  } else if (t.dataset.act === 'scheiben-stange') {
    // Beim Tippen still speichern, ohne neu zu rendern: Ein render() würde das
    // Feld ersetzen und den Fokus mitnehmen, mitten im Wort.
    const kg = parseFloat(t.value.replace(',', '.'));
    scheibenAendern((s) => { s.stange[t.dataset.satz] = Number.isNaN(kg) ? null : kg; });
    scheibenNachziehen(t);
  } else if (t.dataset.act === 'termin-suche') {
    // Nur die Trefferliste neu zeichnen, nicht die ganze Ansicht: Ein render()
    // ersetzt das Suchfeld und nimmt den Fokus mitten im Wort mit – derselbe
    // Fehler, der beim Scheibenfeld schon einmal drinstand.
    ui.terminSuche = t.value;
    const liste = view.querySelector('.akt-liste');
    if (liste) liste.innerHTML = aktivitaetListe();
  } else if (t.dataset.act === 'termin-datum') {
    // Hier darf gerendert werden: Das Datumsfeld ist nach der Auswahl fertig,
    // und die Vorschau darunter muss die neuen Tage zeigen.
    if (!/^\d{4}-\d{2}-\d{2}$/.test(t.value)) return;
    ui.terminDatum = t.value;
    render();
  } else if (t.dataset.act === 'scheiben-kg' || t.dataset.act === 'scheiben-n') {
    const zahl = parseFloat(t.value.replace(',', '.'));
    if (Number.isNaN(zahl)) return;
    const feld = t.dataset.act === 'scheiben-kg' ? 0 : 1;
    scheibenAendern((s) => {
      const zeile = s.scheiben[Number(t.dataset.i)];
      if (zeile) zeile[feld] = zahl;
    });
    scheibenNachziehen(t);
  }
});

// Uhrzeit und Erinnerung des Kalenders: erst beim Übernehmen (change), nicht
// bei jedem Zwischenstand der Uhrzeitwahl – und gleich hinaus, damit der
// Kalender es in Minuten zeigt, nicht erst nach der Drossel.
view.addEventListener('change', (e) => {
  const t = e.target.closest('[data-act]');
  if (!t) return;
  if (t.dataset.act === 'kalender-uhrzeit') {
    const m = /^(\d{2}):(\d{2})/.exec(t.value || '');
    if (!m) return;
    const minuten = Number(m[1]) * 60 + Number(m[2]);
    if (minuten === (store.kalender() || {}).minuten) return;
    store.setzeKalender({ minuten });
    notieren('kalender', { was: 'einstellung', minuten });
    kalenderJetzt('einstellung');
    render();
    toast(`Ab jetzt um ${kalenderUhr(minuten)} – geht gleich an den Kalender`);
  } else if (t.dataset.act === 'kalender-erinnerung') {
    const erinnerung = Number(t.value);
    if (!Number.isInteger(erinnerung) || erinnerung === (store.kalender() || {}).erinnerung) return;
    store.setzeKalender({ erinnerung });
    notieren('kalender', { was: 'einstellung', erinnerung });
    kalenderJetzt('einstellung');
    render();
    toast(erinnerung ? 'Erinnerung geändert – geht gleich an den Kalender' : 'Ohne Erinnerung – geht gleich an den Kalender');
  }
});

/* ------------------------------------------------------------------ *
 * Start
 * ------------------------------------------------------------------ */

// Bleibt die App über Mitternacht offen, muss der Plan beim Zurückkommen
// nachgezogen werden – sonst steht dort weiter das Datum von gestern.
let lastSeenDay = todayISO();
/*
 * Die Trainingsuhr, während die App weg ist.
 *
 *     „Die Zeit geht iwie immer weiter wenn ich aus der app rausgeh"
 *
 * Sie hielt an – außer wenn gerade eine Pause lief. Der Gedanke dahinter
 * stimmt: Die Pause gehört zum Training, auch wenn man dabei nicht aufs Handy
 * schaut. Nur hielt die Uhr dann für die *ganze* Abwesenheit nicht an, und nach
 * einem abgehakten Satz läuft fast immer eine Pause. Wer danach das Handy
 * weglegte, sammelte jede Minute davon als Trainingszeit ein.
 *
 * Jetzt hält sie immer an, und beim Zurückkommen wird genau der Teil
 * nachgetragen, der noch Pause war: höchstens so lange, wie die Pause beim
 * Verschwinden noch offen hatte.
 */
let wegSeit = 0;
let pauseOffen = 0;
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') {
    const r = store.getState().rest;
    wegSeit = Date.now();
    pauseOffen = r ? Math.max(0, r.endsAt - wegSeit) : 0;
    const uhrVorher = store.getState().clock;
    store.clockStop();
    uhrGedeckelt(uhrVorher, 'weg');
    // Ab hier zaehlt der Worker sichtbar mit – die Seite friert gleich ein.
    swSichtbar(false);
    store.flush();
    // Und das Diagnoseprotokoll im selben Takt: Was danach kommt, weiß niemand.
    notieren('sicht', {
      zu: 'weg', pause: pauseOffen ? Math.round(pauseOffen / 1000) : undefined,
      einheit: store.getState().session ? store.getState().session.n : undefined,
    });
    diagnoseSchreiben();
    // Was fertig verschlüsselt bereitliegt, geht mit keepalive hinterher –
    // nur unter 64 KB, sonst beim nächsten Start (js/sicherung.js).
    sicherungVerstecken();
    // Dasselbe für den Kalender – nach der Sicherung: Die ist mehr wert, und
    // beide teilen sich die 64 KiB für keepalive. Passt der Kalender nicht
    // mehr hinein, geht er über den Service Worker nach (js/kalender-sync.js).
    kalenderVerstecken();
    return;
  }
  notieren('sicht', {
    zu: 'da', weg: wegSeit ? Math.round((Date.now() - wegSeit) / 1000) : undefined,
    gutschrift: wegSeit && pauseOffen ? Math.round(Math.min(Date.now() - wegSeit, pauseOffen) / 1000) : undefined,
  });
  if (wegSeit) {
    if (pauseOffen) store.clockCredit(Math.min(Date.now() - wegSeit, pauseOffen));
    wegSeit = 0;
    pauseOffen = 0;
  }
  // Vor dem Weiterlaufen der Uhr: Lag die Einheit seit einem früheren Tag
  // drei Stunden und mehr, schließt sie sich hier ab (tagAbschliessen()), und
  // ihre Sitzung endet mit der Zeit bis zum Wegschalten. Wer nur kurz weg war –
  // auch über Mitternacht –, trainiert einfach weiter.
  const abgeschlossen = tagAbschliessen();
  store.clockStart();
  // Wer wieder davorsitzt, sieht die Leiste in der App – die Meldung in der
  // Statusleiste wäre jetzt nur noch ein Duplikat.
  swSichtbar(true);
  tickRest(); // war das Handy gesperrt, ist die Pause womöglich abgelaufen
  // Läuft sie noch, das Signal neu auflegen: Ein im Hintergrund angehaltener
  // AudioContext verliert seine vorgemerkten Töne.
  if (store.getState().rest) armRest();
  // Fehlten dem Server die Funktionen, kann inzwischen jemand den SQL-Block
  // ausgeführt haben – die App bleibt dafür oft tagelang im Speicher.
  sicherungNachsehen();
  // Hat der Service Worker im Hintergrund eine Kalender-Sendung nachgeschickt?
  kalenderSichtbar();
  tagNachziehenZeigen(abgeschlossen);
  tagesUhrStellen();
});

/**
 * Den Tag nachziehen – beim Zurückkommen in die App und bei offener App von
 * der Uhr (tagesUhrStellen()): liegen Gebliebenes abschließen, die Runde
 * weiterrollen, nachrücken, den Zusatztag für heute rechnen. Gerechnet wird
 * in js/tagstart.js (tagNachziehen(), 'wechsel'); hier steht, was die Anzeige
 * daraus macht. `abgeschlossen` hat das Zurückkommen schon ermittelt – ohne
 * schließt tagNachziehen() selbst ab.
 */
function tagNachziehenZeigen(abgeschlossen) {
  const day = todayISO();
  const r = tagNachziehen({ art: 'wechsel', abgeschlossen, neuerTag: day !== lastSeenDay });
  if (!r.geaendert) return;
  lastSeenDay = day;
  // Steckt ein Zusatztag danach in der Einheit des Tages, lenkt render() einen
  // Bildschirm, der noch auf ihm stand, dorthin um.
  if ((r.zusatz || (r.abschluss && r.abschluss.umgelenkt)) && !store.getState().session) {
    ui.workoutNo = naechsteEinheit();
  }
  render();
}

window.addEventListener('pagehide', () => {
  // Hier ohne Gutschrift: Die Seite verschwindet, und beim nächsten Laden
  // rechnet clockResync() die Lücke ohnehin heraus.
  const uhrVorher = store.getState().clock;
  store.clockStop();
  uhrGedeckelt(uhrVorher, 'seite zu');
  store.flush();
  notieren('sicht', { zu: 'seite zu' });
  diagnoseSchreiben();
});

/**
 * Hat das Anhalten der Uhr eben gedeckelt? (store.clockStop(): nie über drei
 * Stunden Stille hinaus.) Dann steht die Uhr jetzt an einem Zeitpunkt in der
 * Vergangenheit – fürs Diagnoseprotokoll, wie weit. Nur, wenn dieses Anhalten
 * etwas getan hat; eine schon stehende Uhr behält ihren alten Halt.
 */
function uhrGedeckelt(vorher, wo) {
  try {
    const c = store.getState().clock;
    if (!c || c === vorher || !c.halt || Date.now() - c.halt < 60000) return;
    notieren('einheit', { was: 'uhr gedeckelt', n: c.n, wo, vorMin: Math.round((Date.now() - c.halt) / 60000) });
  } catch { /* nur fürs Protokoll */ }
}

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
  // Die Fassung fürs Diagnoseprotokoll nachziehen, sobald ein Worker aktiviert
  // ist oder die Seite übernimmt: Dann steht sein Zwischenspeicher. Nach „App
  // aktualisieren" (der Notausgang räumt alle) und bei der ersten Installation
  // hatte die Startzeile noch keinen gesehen – siehe diagnoseFassung().
  const fassungNachziehen = () => {
    if (window.caches) caches.keys().then(diagnoseFassung).catch(() => {});
  };
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    fassungNachziehen();
    if (!hadController) {
      notieren('sw', { was: 'controllerchange', erster: true, reload: false });
      return;
    }
    try {
      if (sessionStorage.getItem('workout.reloaded')) {
        notieren('sw', { was: 'controllerchange', reload: false, grund: 'schon einmal' }, true);
        return;
      }
      sessionStorage.setItem('workout.reloaded', '1');
    } catch {
      notieren('sw', { was: 'controllerchange', reload: false, grund: 'kein speicher' }, true);
      return;   // ohne Speicher lieber gar nicht neu laden als endlos
    }
    notieren('sw', { was: 'controllerchange', reload: true });
    vorDemNeuladen('update');
    location.reload();
  });
  // Heute schickt sw.js der Seite nichts; der Lauscher ist der Anschluss, falls
  // er einmal sagen soll, dass die Meldung „Pause vorbei" kam.
  navigator.serviceWorker.addEventListener('message', (e) => {
    notieren('sw', { was: 'nachricht', typ: e.data && e.data.typ });
  });
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').then((reg) => {
      // Ohne Registrierung zurück – ein Browser, der Worker sperrt, ohne es zu sagen.
      if (!reg) {
        notieren('sw', { was: 'registriert', reg: false });
        return;
      }
      notieren('sw', { was: 'registriert', aktiv: !!reg.active, wartet: !!reg.waiting });
      reg.addEventListener('updatefound', () => {
        const w = reg.installing;
        notieren('sw', { was: 'update' });
        if (w) {
          w.addEventListener('statechange', () => {
            notieren('sw', { was: 'zustand', zustand: w.state });
            if (w.state === 'activated') fassungNachziehen();
          });
        }
      });
    }).catch((e) => {
      // Kein Offline-Betrieb, aber die App läuft normal weiter.
      notieren('sw', { was: 'fehler', name: e && e.name, msg: e && e.message }, true);
    });
  });
}

// Hat jemand einen Stand geschickt? Steht im Anker der Adresse und wird dort
// sofort entfernt. Die Frage danach stellt die Startansicht – also muss sie
// auch die sichtbare sein, sonst öffnet der Link bei jemandem, der zuletzt in
// der Statistik war, eine Seite ohne jeden Hinweis.
ui.standAngebot = standAusAdresse();
// Und dasselbe für einen geschickten Scheibensatz – der fragt selbst nach und
// braucht keine eigene Ansicht, weil er nichts zeigt, was man vergleichen
// müsste: Er trägt ein, was man ohnehin gerade eintippen wollte.
eisenAusAdresse();
// Ein Wiederherstellungs-Link: Der Schlüssel steht im Anker. Zurückgeholt wird
// erst auf Tipp – der Einstieg oder das Dashboard bietet es an.
ui.sicherungAngebot = sicherungAusAdresse();
if (ui.sicherungAngebot) {
  ui.tab = 'dashboard';
  ui.focus = false;
  ui.listView = false;
}

// Einmal beim Start den Browser bitten, diesen Speicher nicht von selbst
// freizugeben. Ohne await: Das Ergebnis interessiert erst, wenn jemand unter
// Mehr nachsieht, und bis dahin darf der Start nicht darauf warten.
speicherFestnageln();
// Und noch einmal, wenn der Link auf eine bereits offene App trifft: Dann ist
// das ein Sprung innerhalb derselben Seite, sie lädt nicht neu, und ohne diesen
// Horcher passierte schlicht nichts.
window.addEventListener('hashchange', eisenAusAdresse);
window.addEventListener('hashchange', () => {
  const key = sicherungAusAdresse();
  if (!key) return;
  ui.sicherungAngebot = key;
  ui.sicherungMeldung = '';
  go('dashboard');
});
// Nach einem Import oder dem Einstieg mit anderem Fokus wurde neu geladen – die
// Meldung dazu kommt erst jetzt, sonst ginge sie mit dem Neuladen verloren.
['workout.nachImport', 'workout.nachEinstieg'].forEach((schluessel) => {
  const meldung = sessionStorage.getItem(schluessel);
  if (meldung) {
    sessionStorage.removeItem(schluessel);
    setTimeout(() => toast(meldung), 400);
  }
});
/*
 * Zwei offene Fenster derselben App – installiert und als Browser-Tab, oder
 * zweimal installiert – teilten sich den Speicher, aber nicht den Zustand:
 * Jedes lud ihn einmal beim Start und schrieb ihn danach als Ganzes. Ein Tipp
 * im veralteten Fenster überschrieb still ein ganzes Training aus dem anderen.
 * Gefunden bei der Durchsicht der App, nachgestellt: sechs abgehakte Sätze in
 * Fenster B, ein Tipp in Fenster A, danach null.
 *
 * Der Browser meldet jedem *anderen* Fenster, wenn der Speicher sich ändert.
 * Dann lädt dieses neu und arbeitet mit dem, was jetzt dort steht.
 */
window.addEventListener('storage', (e) => {
  if (e.key === 'workout.state.v1' || e.key === 'workout.rounds.v1') location.reload();
});
if (ui.standAngebot) {
  ui.tab = 'dashboard';
  ui.focus = false;
  ui.listView = false;
}
// Die Oberfläche an die Rechnung des Tages anschließen (js/tagstart.js): ins
// Diagnoseprotokoll schreiben, eine liegen gebliebene Sitzung wie mit dem
// Knopf beenden, die Startansicht mitnehmen. Ohne diese Zeilen rechnete der
// Start dasselbe – nur still, wie in der Kalender-Vorschau.
tagstartAnschliessen({
  notieren,
  beenden: einheitBeenden,
  // Stand die Startseite auf einer eben abgeschlossenen Einheit (oder der
  // Sitzung, die liegen blieb)? Dann geht sie zur nächsten – sonst stünde dort
  // „Für heute durch" über dem Samstag.
  umlenken(einheiten, sitzung) {
    if (!(einheiten.includes(ui.workoutNo) || (!!sitzung && sitzung.n === ui.workoutNo))) return false;
    ui.workoutNo = naechsteEinheit();
    ui.focus = false;
    ui.listView = false;
    return true;
  },
  neueRunde() {
    ui.workoutNo = PLAN[0].n;
    ui.focus = false;
    ui.listView = false;
    ui.openEx.clear();
  },
});
// Hat der Start etwas zu sagen (Umzug, Planwechsel, Aufstieg …), bleibt die
// App auf dem Dashboard, wo der Hinweis steht – siehe unten bei `session`.
let startHinweis = false;
const startAufsDashboard = () => {
  ui.tab = 'dashboard';
  ui.focus = false;
  ui.listView = false;
  startHinweis = true;
};
/*
 * Der Tag wird nachgezogen: Umzug eines abgeschafften Fokus, Planwechsel und
 * Reparaturen, nachstempeln, Tagesabschluss, Runde weiter, nachrücken,
 * Aufstieg, Zusatztag – in js/tagstart.js, weil die Kalender-Vorschau genau
 * dieselbe Folge für jeden kommenden Tag rechnet. Warum die Reihenfolge so
 * ist, steht dort bei tagStarten(). Hier bleibt, was die Startansicht daraus
 * macht.
 *
 * `ui.workoutNo` steht seit dem Laden des Moduls, also seit *vor*
 * Planwechsel und Reparatur. Bis v219 blieb es dabei: Die Einheit, deren
 * festes Paar ganz abgehakt war, galt in diesem Moment als fertig und wurde
 * übersprungen – nach der Reparatur stand auf der Startkarte „Heute ·
 * Workout 5" und daneben „Deine angefangene Einheit ist wieder vollständig".
 * Wer auf Start tippte, fing Workout 5 an, und die reparierte 4 blieb halb
 * liegen. Deshalb wird die Einheit fürs Dashboard nach dem Nachstempeln neu
 * bestimmt (`gestempelt`) – vor rundeWeiter(), das beim Weiterrollen selbst
 * auf Workout 1 springt.
 *
 * Nach einem Tagesabschluss stand die Startseite noch auf der eben
 * abgeschlossenen Einheit – nach dem Nachrücken (`nachgerueckt`) die nächste.
 */
const startLauf = tagNachziehen({
  art: 'start',
  bei: {
    gestempelt({ umzug, umgebaut }) {
      if (umzug || umgebaut) startAufsDashboard();
      if (umgebaut) ui.workoutNo = naechsteEinheit();
    },
    nachgerueckt({ abschluss }) {
      if (abschluss) ui.workoutNo = naechsteEinheit();
    },
  },
});
if (startLauf.abschluss && startLauf.abschluss.einheiten.length) startAufsDashboard();
if (startLauf.gestiegen || startLauf.zusatz) {
  ui.tab = 'dashboard';
  ui.focus = false;
  // Der Zusatztag entsteht erst hier, also nach der Wahl der Startansicht ganz
  // oben. Ohne diese Zeile stünde er zwar in der Ablage, aber die App zeigte
  // weiter die nächste Planeinheit – angelegt und unsichtbar, also praktisch
  // nicht vorhanden.
  ui.workoutNo = naechsteEinheit();
  startHinweis = true;
}
/*
 * Läuft eine Einheit, geht es beim Öffnen mit ihr weiter.
 *
 *     „Immer wenn ich kurz aus der app rausgeh und wieder rein komm dann kommt
 *      das. Aber eigentlich sollte ja einfach die Übung kommen die jetzt als
 *      nächstes ansteht"
 *
 * Das Handy beendet eine Web-App im Hintergrund gern ganz, und beim
 * Zurückkommen lädt sie neu – nach einer neuen Fassung ohnehin. Bis v216
 * landete man dann auf dem Dashboard vor „Training fortsetzen", mitten im
 * Satz. Jetzt direkt in der Fokusansicht, und zwar bei der Übung, die zuletzt
 * zu sehen war – solange dort noch ein Satz offen ist. Sonst bei der, die als
 * Nächstes dran ist (firstOpenExercise(), mit Supersätzen also beim Partner),
 * so wie der Knopf es getan hätte.
 *
 * Nur, wenn beim Verlassen die Fokusansicht dieser Einheit offen war
 * (`fokusOffen`, siehe render()) – wer mitten im Training bewusst zurück aufs
 * Dashboard oder in die Übungsliste gegangen ist, landet dort wieder. Und
 * nicht, wenn der Start etwas zu sagen hat (`startHinweis`).
 *
 * Bis v241 auch nicht, wenn die Uhr der Einheit an einem früheren Tag
 * gestartet war: „Eine von gestern wartet auf dem Dashboard, wo man sie
 * abschließt oder bewusst weitermacht." Seit dem Tagesabschluss gibt es die
 * nicht mehr – eine Sitzung, die seit gestern liegt, hat tagAbschliessen() oben
 * schon beendet. Was hier noch läuft, lebt: ein Training über Mitternacht, bei
 * dem das Handy die App kurz beendet hat. Das geht weiter wie jedes andere.
 */
{
  const s = store.getState();
  const laeuft = s.session;
  const heute = laeuft && s.clock && s.clock.n === laeuft.n;
  // In v217 und v218 stand in `fokusOffen` nur die Nummer der Einheit.
  const offen = s.fokusOffen && typeof s.fokusOffen === 'object'
    ? s.fokusOffen : { n: s.fokusOffen ?? null, id: null };
  if (heute && offen.n === laeuft.n && !startHinweis && !ui.standAngebot
      && ui.tab === 'dashboard' && workoutByNo(laeuft.n).ex.length) {
    const mode = store.workoutMode(laeuft.n);
    const ex = workoutByNo(laeuft.n, mode).ex;
    const da = ex.findIndex((x) => x.id === offen.id);
    ui.workoutNo = laeuft.n;
    ui.focus = true;
    ui.listView = false;
    ui.focusIdx = da >= 0 && saetzeErledigt(laeuft.n, ex[da].id, ex[da].sets) < ex[da].sets
      ? da : firstOpenExercise(laeuft.n, mode);
  }
}
/*
 * Den Verlauf an das anpassen, was der Start zeigt.
 *
 * Ein Neuladen behält den Verlauf (location.reload() nach einer neuen Fassung
 * ebenso wie ein wiederhergestellter Tab), samt dem Eintrag, auf dem man
 * stand. Zwei Fälle:
 *
 * **Er passt** – die App geht in der Fokusansicht weiter, und der Eintrag der
 * Fokusansicht steht schon da. Dann keinen weiteren dazu. render() legte
 * früher trotzdem einen an, weil `lastLevel` noch vom Dashboard stammt: Nach
 * zweimal Neuladen zeigte Zurück zweimal unverändert dieselbe Übung, erst der
 * dritte Druck kam aufs Dashboard.
 *
 * **Er gilt nicht mehr** – er gehört zur Fokusansicht oder zur Liste, aber die
 * App bleibt auf dem Dashboard: Der Start hat etwas zu sagen (`startHinweis`),
 * die Einheit ist von gestern oder schon vorbei. Bis v219 blieb der Eintrag
 * stehen, das Dashboard saß obendrauf, und der erste Druck auf Zurück führte
 * zum Eintrag darunter – wieder das Dashboard. Es sah aus, als täte Zurück
 * nichts. Jetzt geht der Start selbst so weit zurück, bis die Ebene erreicht
 * ist, aus der man hineingegangen war, und schreibt dort hin, was zu sehen
 * ist. `goingBack` hält render() so lange davon ab, einen neuen Eintrag
 * anzulegen. Nach vorn bleiben die alten Einträge liegen, bis der nächste
 * Eintrag sie ersetzt – auf Android gibt es kein Vorwärts.
 *
 * Kalt gestartet ist der Verlauf leer (`history.state` null): Dann bleibt es
 * beim einen neuen Eintrag, den render() für die Fokusansicht anlegt, und
 * Zurück führt aufs Dashboard statt aus der App. Andere Abweichungen (ein
 * anderer Reiter) bleiben, wie sie waren.
 */
{
  const st = history.state;
  if (st && ebeneVon(st) === levelOf()) {
    lastLevel = levelOf();
  } else if (st && (st.focus || st.listView) && !ui.focus && !ui.listView && history.length > 1) {
    abbauen = true;
    goingBack = true;
    lastLevel = levelOf();
    history.back();
  }
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
// Kann der Store schon jetzt, am Ende des Starts, nicht schreiben, kommt der
// Wechsel unten nie – und das Protokoll behielte seinen Platz. Gefunden beim
// Gegenlesen (Speicher zwischen zwei Sitzungen von außen gefüllt): Kein Satz
// kam an, bis die App wegschaltete. Meist hat js/diagnose.js schon beim Laden
// geräumt (DIAGNOSE_PLATZ); das hier ist der zweite Riegel.
if (!speicherStand) diagnosePlatzMachen();
store.subscribe(() => {
  if (store.canPersist() === speicherStand) return;
  speicherStand = store.canPersist();
  // Das Diagnoseprotokoll gibt seinen Platz sofort frei – der nächste
  // Schreibvorgang gehört dem Training (diagnosePlatzMachen() in js/diagnose.js).
  if (!speicherStand) diagnosePlatzMachen();
  notieren('speicher', {
    kann: speicherStand, grund: store.speicherGrund() || undefined, klemmt: store.ablageKlemmt() || undefined,
    haupt: kb('workout.state.v1'), ablage: kb('workout.rounds.v1'),
  }, true);
  render();
});

/*
 * Schalter fürs Diagnoseprotokoll: an einer Stelle statt in jedem Handler.
 *
 * Ein Vergleich je Meldung des Stores über ein paar Felder, die alle einfache
 * Werte sind – ob „Töne" über den Schalter, den Einstieg oder eine eingelesene
 * Sicherung umgelegt wurde, hier kommt es an. Fokus und Modus gehören dazu:
 * Beides ändert, welche Übungen dastehen.
 */
{
  const FELDER = ['sound', 'soundSets', 'notify', 'supersatz', 'share', 'level', 'restSeconds',
    'useExerciseRest', 'mode', 'focus', 'aufwaermen'];
  const bild = (s) => FELDER.map((k) => s[k]);
  let vorher = bild(store.getState());
  store.subscribe((s) => {
    try {
      let anders = false;
      FELDER.forEach((k, i) => {
        if (s[k] === vorher[i]) return;
        anders = true;
        notieren('schalter', { feld: k, von: vorher[i] ?? '-', nach: s[k] ?? '-' });
      });
      if (anders) vorher = bild(s);
    } catch { /* nur fürs Protokoll */ }
  });
}

/*
 * Den Punkt am App-Symbol nachziehen, sobald sich etwas ändert.
 *
 * An *jeder* Änderung und nicht nur am Trainingsende: Ein abgehakter letzter
 * Satz und ein nachgerückter Plan ändern beide, ob noch etwas offen ist.
 */
store.subscribe(() => { erinnerungPflegen(); });
erinnerungPflegen();

/*
 * Die automatische Sicherung anschließen (js/sicherung.js).
 *
 * Gesichert wird der Stand, den auch die Sicherungsdatei hat – ohne das
 * Betreiber-Passwort, das exportJSON() ebenfalls weglässt. Und erst, wenn der
 * Einstieg den Satz dazu gezeigt hat und es etwas zu sichern gibt: Ein frisches
 * Gerät, das nur seinen Namen kennt, hat nichts, was einen Server braucht – und
 * es soll erst die Gelegenheit haben, eine vorhandene Sicherung zurückzuholen.
 */
sicherungEinrichten({
  stand: () => {
    const { adminPass, ...rest } = store.getState();
    void adminPass;
    return rest;
  },
  darf: () => {
    if (needsWelcome()) return false;
    const s = store.getState();
    return Object.keys(s.log || {}).length > 0 || (s.rounds || []).length > 0
      || (s.customs || []).length > 0 || Object.keys(s.weights || {}).length > 0;
  },
  nachher: (() => {
    // Neu zeichnen nur, wo sich dadurch etwas ändert: unter Mehr, und auf dem
    // Dashboard, wenn die eine Zeile kommt oder geht. Mitten im Training nie.
    // Und nie, während jemand tippt – der Neuaufbau nähme ihm das Feld weg.
    let lage = sicherungLage();
    let loeschen = loeschenAusstehend();
    return () => {
      const neu = sicherungLage();
      const dash = ui.tab === 'dashboard' && !ui.focus && !ui.listView && neu !== lage;
      lage = neu;
      // Ein erledigter Löschauftrag nimmt seine Zeile mit – auch im Einstieg.
      const jetzt = loeschenAusstehend();
      const erledigt = loeschen && !jetzt;
      loeschen = jetzt;
      const tippt = !!document.activeElement && /^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName);
      if ((ui.tab === 'settings' || dash || (erledigt && !ui.focus)) && !tippt) render();
    };
  })(),
});
store.subscribe(() => { sicherungGeaendert(); });

/*
 * Google Kalender automatisch anschließen (js/kalender-sync.js): Nach jeder
 * Änderung sieht es nach, ob sich die Vorschau geändert hat – sofort, wenn eine
 * Einheit anfängt oder fertig wird, sonst gedrosselt. Neu gezeichnet wird wie
 * bei der Sicherung nur, wo sich dadurch etwas ändert, und nie, während jemand
 * tippt (das URL-Feld!).
 */
kalenderEinrichten({
  nachher: (() => {
    let zeile = kalenderZeile();
    return () => {
      const neu = kalenderZeile();
      const dash = ui.tab === 'dashboard' && !ui.focus && !ui.listView && neu !== zeile;
      zeile = neu;
      const tippt = !!document.activeElement && /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);
      if ((ui.tab === 'settings' || dash) && !tippt) render();
    };
  })(),
});
store.subscribe(() => { kalenderGeaendert(); });

render();
meldeStand();        // einmal am Tag, wenn ein Server eingetragen und erlaubt ist
sicherungStart();    // wenn seit der letzten Sicherung etwas dazukam
kalenderStart();     // die Vorschau für heute, wenn der Kalender verbunden ist
store.clockResync(); // Zeit, in der die Seite gar nicht lief, zählt nicht mit
// Neu geladen und sichtbar: Die Uhr eines laufenden Trainings muss wieder
// anlaufen. Ohne diese Zeile stünde sie bis zum nächsten Wegschalten still.
if (!document.hidden) store.clockStart();
tickRest(); // eine Pause, die einen Neustart der Seite überdauert hat
// Läuft sie noch, ihr Signal wieder auflegen. Bis v240 fehlte diese Zeile:
// Nach einem Neuladen mitten in der Pause (Aktualisierung, Neustart vom
// Startbildschirm) stand die Leiste, aber auf der Audio-Uhr lag nichts, und am
// Ende entstand der Ton auf einem Kontext ohne Berührung – stumm. Jetzt merkt
// sich der Tonkanal den Wunsch und legt das Signal bei der ersten Berührung auf
// (scheduleSound mit Rückruf); ist die Pause bis dahin vorbei, kommt einmal
// „Pause vorbei" (endRest).
if (store.getState().rest) armRest();
// Bleibt die App offen, sieht sie um Mitternacht selbst nach (tagesUhrStellen()).
tagesUhrStellen();
