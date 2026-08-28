/*
 * Einstellungen, die nicht in den Code gehören: die Adresse des Rückkanals.
 *
 * Diese Datei wird von Hand gepflegt und ist die einzige Stelle, an der die App
 * überhaupt von einem Server weiß. Bleiben die Felder leer, gibt es keinen –
 * dann schickt die App nichts, fragt niemanden um Erlaubnis und läuft wie
 * vorher rein lokal. Genau so ist der Auslieferungszustand.
 *
 * Ist sie ausgefüllt, meldet jedes Gerät seinen Stand an eine Supabase-Tabelle:
 * Name, Trainingsfokus, Erfahrung, wie viele Einheiten und Sätze, wann zuletzt
 * trainiert wurde. Das steht dann auch in der App, im Einstieg und unter Mehr,
 * mit einem Schalter zum Abstellen – ohne diesen Satz wäre es Schnüffelei.
 *
 * URL und Schlüssel dürfen öffentlich sein: Mit dem SQL aus der README kommt man
 * damit an genau drei Funktionen – melden, die eigene Zeile löschen, und die
 * Übersicht. Die will ein Passwort (siehe adminListe() in js/telemetry.js), und
 * das steht nirgends im Code. Auf die Tabelle selbst führt gar kein Weg.
 */

export const CONFIG = {
  url: 'https://vjyohppohmvhhxgwouti.supabase.co',
  // Der öffentliche Schlüssel darf hier stehen: Mit den Regeln aus der README
  // darf er ausschließlich schreiben.
  key: 'sb_publishable_wTUNShIKMFjCOmZzQuuN-A_vFHPkKUI',
  // Wem die Zahlen zugutekommen – steht so im Einwilligungstext.
  betreiber: 'Tobi',
};

/**
 * Läuft diese Seite von einer lokalen Adresse? Dann ist sie kein Nutzer.
 *
 * Nachgezählt, weil die Übersicht anfing, wie eine Erfolgsmeldung auszusehen:
 * rund 1000 Geräte, darunter 52-mal „Tom", 26-mal „Alex" und 26-mal „Chris".
 * Diese Namen stehen ausschließlich in Testdateien – Tom in test-welcome.mjs,
 * Alex und Chris in test-freunde.mjs. Dass ausgerechnet Alex und Chris auf
 * dieselbe Zahl kommen, ist kein Zufall: Beide entstehen einmal je Lauf in
 * derselben Datei.
 *
 * Der Weg dorthin ist kurz. Jeder frische Browserkontext hat einen leeren
 * Speicher, also eine neue Gerätekennung und kein `lastShare` – die Drossel
 * „einmal am Tag" greift nie. 23 der 37 Testdateien fangen die Aufrufe an
 * Supabase nicht ab, und der Ablauf bei GitHub führt sie bei jedem Push aus.
 * Macht rund zwei Dutzend erfundene Geräte je Lauf, und das seit Monaten.
 *
 * Deshalb hier und nicht in den Tests: Eine Regel, an die 23 Dateien denken
 * müssen, ist keine Regel. Wer den Rückkanal wirklich prüfen will, schaltet ihn
 * ausdrücklich frei.
 */
function lokaleAdresse() {
  try {
    const h = location.hostname;
    // Leer ist file:// – auch das ist niemand, der die App benutzt.
    return h === '' || h === 'localhost' || h === '127.0.0.1' || h === '[::1]'
      || h === '::1' || h.endsWith('.local');
  } catch {
    return false;
  }
}

/** Gibt es überhaupt einen Rückkanal? Ohne URL bleibt alles lokal. */
export const hatServer = () => {
  if (!(CONFIG.url && CONFIG.key)) return false;
  if (!lokaleAdresse()) return true;
  try {
    return localStorage.getItem('workout.rueckkanal.lokal') === '1';
  } catch {
    return false;
  }
};
