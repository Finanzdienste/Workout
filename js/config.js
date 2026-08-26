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

/** Gibt es überhaupt einen Rückkanal? Ohne URL bleibt alles lokal. */
export const hatServer = () => !!(CONFIG.url && CONFIG.key);
