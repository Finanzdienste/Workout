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
 * URL und Schlüssel dürfen öffentlich sein: Der anon-Schlüssel darf mit den
 * Regeln aus der README nur *schreiben*. Gelesen wird über eine Funktion, die
 * nach einem Passwort fragt (siehe adminListe() in js/telemetry.js) – das
 * Passwort steht nirgends im Code.
 */

export const CONFIG = {
  // z. B. 'https://abcdefgh.supabase.co'
  url: '',
  // der öffentliche anon-Schlüssel aus den Projekteinstellungen
  key: '',
  // Wem die Zahlen zugutekommen – steht so im Einwilligungstext.
  betreiber: 'Tobi',
};

/** Gibt es überhaupt einen Rückkanal? Ohne URL bleibt alles lokal. */
export const hatServer = () => !!(CONFIG.url && CONFIG.key);
