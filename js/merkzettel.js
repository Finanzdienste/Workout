/*
 * Der Merkzettel: der eine Ort, den App und Service Worker beide sehen.
 *
 * Der ganze Zustand der App liegt in `localStorage` – und genau darauf hat ein
 * Service Worker keinen Zugriff. Er läuft ohne Fenster, und `localStorage` ist
 * an eines gebunden. Wacht der Worker also nachts auf, weiß er von sich aus
 * nichts: nicht, welche Einheit ansteht, nicht, ob sie schon gemacht ist.
 *
 * IndexedDB kann beides. Deshalb liegt hier ein winziger Zettel mit dem, was
 * der Worker wissen muss – nicht der Zustand, nur die fertige Antwort:
 *
 *     an          ist die Erinnerung überhaupt eingeschaltet?
 *     zeigenAb    Zeitstempel: Wacht der Worker danach auf, erinnert er.
 *     titel       was in der Meldung stehen soll
 *     gemeldet    an welchem Tag zuletzt gemeldet wurde – gegen Doppelmeldungen
 *     geweckt     wann der Browser den Worker zuletzt geweckt hat
 *     weckArt     wodurch: 'push' (der Wecker von außen) oder 'sync' (Chromes
 *                 eigenes, unzuverlässiges Aufwachen)
 *     weckGrund   was der Worker daraufhin getan hat, siehe erinnern() in sw.js
 *
 * Die letzten drei sind der ehrliche Teil. Ob Chrome den Worker überhaupt weckt,
 * hängt an seiner Laune und lässt sich weder versprechen noch hier nachprüfen –
 * ein Testlauf kann periodicsync nicht auslösen, und was auf einem fremden Handy
 * passiert, sehe ich hier ohnehin nicht. Also behauptet die App nichts, sondern
 * schreibt auf, wann es zuletzt passiert ist, wodurch, und warum daraufhin
 * gemeldet wurde oder eben nicht. Steht da nach einer Woche nichts, weiß man,
 * dass der Push nicht ankommt; steht da etwas mit einem Grund daneben, weiß man,
 * dass er ankommt und die Entscheidung hier falsch war. Das sind zwei ganz
 * verschiedene Baustellen, und sie sehen von außen gleich aus.
 */

const DB = 'workout.merk';
const LADEN = 'zettel';
const SCHLUESSEL = 'erinnerung';

function oeffne() {
  return new Promise((ok, fehler) => {
    const anfrage = indexedDB.open(DB, 1);
    anfrage.onupgradeneeded = () => {
      if (!anfrage.result.objectStoreNames.contains(LADEN)) {
        anfrage.result.createObjectStore(LADEN);
      }
    };
    anfrage.onsuccess = () => ok(anfrage.result);
    anfrage.onerror = () => fehler(anfrage.error);
  });
}

/** Den Zettel lesen. Gibt {} zurück, wenn es keinen gibt oder etwas klemmt. */
export async function liesMerkzettel() {
  try {
    const db = await oeffne();
    return await new Promise((ok) => {
      const a = db.transaction(LADEN, 'readonly').objectStore(LADEN).get(SCHLUESSEL);
      a.onsuccess = () => ok(a.result || {});
      a.onerror = () => ok({});
    });
  } catch {
    // In privaten Fenstern und manchen eingebetteten Ansichten ist IndexedDB
    // gesperrt. Dann gibt es eben keine Erinnerung – die App selbst läuft
    // deshalb nicht schlechter.
    return {};
  }
}

/** Felder in den Zettel schreiben; alles Nichtgenannte bleibt stehen. */
export async function schreibeMerkzettel(felder) {
  try {
    const alt = await liesMerkzettel();
    const db = await oeffne();
    const neu = { ...alt, ...felder };
    await new Promise((ok) => {
      const a = db.transaction(LADEN, 'readwrite').objectStore(LADEN).put(neu, SCHLUESSEL);
      a.onsuccess = () => ok();
      a.onerror = () => ok();
    });
    return neu;
  } catch {
    return null;
  }
}
