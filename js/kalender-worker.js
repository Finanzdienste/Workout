/*
 * Die Vorschau des Kalenders im Hintergrund – ein Modul-Worker, nie das
 * Fenster der App.
 *
 *     „Es soll von selbst einfach das optimale passieren"
 *
 * Von selbst heißt hier: ohne dass die App dabei hängt. Die Vorschau rechnet
 * 42 frische Starts der App hintereinander (js/kalender-vorschau.js), und das
 * dauert auch am Rechner einige hundert Millisekunden – auf dem Handy mehr.
 * Im Fenster stünde die Oberfläche so lange still. Und im Fenster ginge es
 * ohnehin nicht: Dort teilten sich die Rechenmodule ihren Zustand mit der App,
 * und das Neusäen je Tag (store.importJSON()) ersetzte das echte Training.
 * Ein Worker lädt dieselben Dateien als eigene Instanzen, ohne Seite und ohne
 * echten Speicher – was er rechnet, bleibt in ihm, bis er die Liste
 * zurückschickt. Ein Leerlauf-Rückruf (requestIdleCallback) im Fenster wäre
 * kein Ersatz: Er verteilt die Last, trennt aber den Zustand nicht.
 *
 * Gemessen (tests/test-kalender-vorschau.mjs, Chromium am Rechner): siehe
 * README „Google Kalender automatisch".
 *
 * Nachricht hin:  { id, zustand, jetzt, wartet, ferne }
 *   zustand  store.getState() oder exportJSON() der App, nach ihrem Start
 *   jetzt    Date.now() der App (ms) – die Uhr des Workers ist dieselbe,
 *            aber so rechnen beide mit demselben Augenblick
 *   wartet   abschlussWartetAm() aus js/tagstart.js
 *   ferne    so viele Tage reicht die Ferne (VORSCHAU_FERNE), 0 ohne – für
 *            ein Skript der Fassung 1 wird sie gar nicht erst gerechnet
 * Nachricht zurück: { id, ok: true, vorschau } oder { id, ok: false, code, fehler }.
 *
 * `code` 'fokus': Der Worker hat seine Module mit einem anderen
 * Trainingsfokus geladen (js/data.js wählt den Plan beim Laden). Dann diesen
 * Worker beenden und einen neuen anlegen – er rechnet danach mit dem neuen.
 */
import { vorschauRechnen } from './kalender-vorschau.js';

self.addEventListener('message', async (e) => {
  const { id = null, zustand, jetzt, wartet = null, ferne = 0 } = e.data || {};
  try {
    const vorschau = await vorschauRechnen(zustand, {
      jetzt: Number.isFinite(jetzt) ? jetzt : Date.now(), wartet, ferne: Number.isFinite(ferne) ? ferne : 0,
    });
    self.postMessage({ id, ok: true, vorschau });
  } catch (err) {
    self.postMessage({
      id, ok: false, code: (err && err.code) || 'fehler', fehler: String((err && err.message) || err),
    });
  }
});
