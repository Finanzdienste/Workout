/*
 * Web Push: die eine Meldung, die auch bei geschlossener App ankommt.
 *
 * Die Erinnerung über `periodicsync` (js/erinnerung.js) hängt daran, ob Chrome
 * den Service Worker weckt – und das ist ein Vielleicht. Web Push ist das
 * Gegenteil: Der Push-Dienst des Browserherstellers stellt zu, ob die App läuft
 * oder nicht, ob das Handy im Standby ist oder nicht.
 *
 * **Was dafür fehlt, ist nur eine Uhr.** Web Push braucht jemanden, der zur
 * richtigen Zeit etwas losschickt. Das übernimmt ein zeitgesteuerter Ablauf bei
 * GitHub (.github/workflows/push-erinnerung.yml) – ein Server ist das nicht,
 * nur ein Wecker, den es ohnehin schon gibt.
 *
 * **Und der Push trägt nichts.** Er ist ein leeres Klopfen: „wach auf und guck
 * nach". Erst der Service Worker liest den Merkzettel und entscheidet, ob eine
 * Meldung erscheint und was drinsteht. Es verlässt kein Trainingsdatum das
 * Gerät; wer den Wecker betreibt, erfährt nicht einmal, ob heute etwas anstand.
 *
 * **Die Schlüssel entstehen hier, im Browser.** VAPID braucht ein Schlüsselpaar.
 * Es wird auf diesem Gerät erzeugt und verlässt es nur einmal, als Text, den man
 * selbst bei GitHub einfügt – nicht über einen Dienst, nicht über eine Konsole,
 * nicht durch fremde Hände.
 */

const PUSH_SCHLUESSEL = 'workout.push.v1';

/** Bytes -> base64url, die Schreibweise, die VAPID überall verlangt. */
function b64url(bytes) {
  let roh = '';
  new Uint8Array(bytes).forEach((b) => { roh += String.fromCharCode(b); });
  return btoa(roh).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** base64url -> Uint8Array. Für den Schlüssel, den subscribe() haben will. */
function ausB64url(s) {
  const roh = atob(String(s).replace(/-/g, '+').replace(/_/g, '/')
    + '='.repeat((4 - (s.length % 4)) % 4));
  return Uint8Array.from(roh, (c) => c.charCodeAt(0));
}

/**
 * Das VAPID-Schlüsselpaar dieses Geräts – einmal erzeugt, dann gemerkt.
 *
 * Beide Teile müssen stabil bleiben: Mit dem öffentlichen meldet sich das Gerät
 * beim Push-Dienst an, mit dem privaten unterschreibt der Wecker jede Sendung.
 * Ein neues Paar macht die Anmeldung wertlos.
 */
async function schluesselpaar() {
  const gemerkt = localStorage.getItem(PUSH_SCHLUESSEL);
  if (gemerkt) { try { return JSON.parse(gemerkt); } catch { /* neu erzeugen */ } }

  const paar = await crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'],
  );
  const jwk = await crypto.subtle.exportKey('jwk', paar.privateKey);
  // VAPID will den öffentlichen Schlüssel als unkomprimierten Punkt: 0x04 || x || y.
  const x = ausB64url(jwk.x);
  const y = ausB64url(jwk.y);
  const punkt = new Uint8Array(65);
  punkt[0] = 4;
  punkt.set(x, 1);
  punkt.set(y, 33);

  const neu = { oeffentlich: b64url(punkt), privat: jwk.d };
  localStorage.setItem(PUSH_SCHLUESSEL, JSON.stringify(neu));
  return neu;
}

/** Kann dieser Browser überhaupt Push? */
export const kannPush = () => 'serviceWorker' in navigator
  && 'PushManager' in window && 'Notification' in window;

/**
 * Anmelden und die Einrichtung als ein Textblock zurückgeben.
 *
 * Ein Block, nicht drei Felder: Was bei GitHub eingefügt werden muss, soll ein
 * einziges Kopieren sein. Drei Werte einzeln zu übertragen ist die Sorte
 * Aufgabe, bei der man einen davon vergisst und danach eine Woche sucht.
 */
export async function pushEinrichten() {
  if (!kannPush()) throw new Error('Dieser Browser kann kein Web Push.');
  const erlaubnis = await Notification.requestPermission();
  if (erlaubnis !== 'granted') throw new Error('Ohne erlaubte Hinweise geht es nicht.');

  const paar = await schluesselpaar();
  const reg = await navigator.serviceWorker.ready;
  // Eine bestehende Anmeldung wird abgelöst: Sie hängt am alten Schlüssel und
  // würde sonst neben der neuen weiterlaufen.
  const alt = await reg.pushManager.getSubscription();
  if (alt) await alt.unsubscribe();

  const abo = await reg.pushManager.subscribe({
    // Pflicht in Chrome: Jeder Push muss etwas anzeigen dürfen. Was wirklich
    // angezeigt wird, entscheidet trotzdem das Gerät – siehe sw.js.
    userVisibleOnly: true,
    applicationServerKey: ausB64url(paar.oeffentlich),
  });

  return {
    text: JSON.stringify({
      oeffentlich: paar.oeffentlich,
      privat: paar.privat,
      abo: abo.toJSON(),
    }, null, 2),
    endpunkt: abo.endpoint,
  };
}

/** Steht eine Anmeldung, und zu welchem Dienst? Für die Anzeige unter Mehr. */
export async function pushStand() {
  if (!kannPush()) return { moeglich: false };
  try {
    const reg = await navigator.serviceWorker.ready;
    const abo = await reg.pushManager.getSubscription();
    return {
      moeglich: true,
      angemeldet: !!abo,
      erlaubt: Notification.permission === 'granted',
    };
  } catch {
    return { moeglich: false };
  }
}
