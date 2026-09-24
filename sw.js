/*
 * Service Worker – macht die App ohne Netz benutzbar.
 *
 * Muss im Wurzelverzeichnis liegen: Der Geltungsbereich eines Service Workers
 * ist sein eigener Ordner, und von hier aus deckt er die gesamte App ab.
 *
 * Zwei Strategien, je nach Art der Anfrage:
 *
 *   Seitenaufrufe   erst Netz, bei Fehlschlag der Zwischenspeicher.
 *                   So ist eine neue Fassung sofort da, sobald Empfang
 *                   besteht, und im Keller ohne Netz startet sie trotzdem.
 *
 *   Alles andere    sofort aus dem Zwischenspeicher ausliefern und parallel
 *                   im Hintergrund erneuern. Der Start bleibt dadurch auch
 *                   bei schlechter Verbindung schnell; die Aktualisierung
 *                   greift beim nächsten Aufruf.
 *
 * VERSION bei jeder Änderung an den unten gelisteten Dateien hochzählen –
 * daran hängt das Aufräumen alter Zwischenspeicher.
 */

const VERSION = 'v202';
const CACHE = `workout-${VERSION}`;

const SHELL = [
  './',
  './index.html',
  // Die Übersicht aller Bewegungsbilder. Kein Teil der App, aber aus ihr
  // verlinkt – eine Seite, die offline ins Leere läuft, ist schlimmer als
  // keine Verlinkung.
  './figuren.html',
  './css/styles.css',
  './js/app.js',
  './js/audio.js',
  './js/config.js',
  './js/telemetry.js',
  './js/data.js',
  './js/body.js',
  './js/chart.js',
  './js/dates.js',
  './js/figure.js',
  './js/injuries.js',
  './js/ics.js',
  './js/store.js',
  './js/text.js',
  './js/uebung.js',
  './js/stufen.js',
  './js/scheiben.js',
  './js/anzeige.js',
  './js/ansicht-scheiben.js',
  './js/ansicht-kalender.js',
  './js/ansicht-vorrat.js',
  './js/ansicht-statistik.js',
  './js/gewichte.js',
  './js/supersatz.js',
  './js/vorrat.js',
  './js/muster.js',
  './js/termine.js',
  './js/aktivitaeten.js',
  './js/plan.js',
  './js/bilanz.js',
  './icon.svg',
  './badge.svg',
  // Das kleine Symbol der Meldungen. Eigene Datei, weil Android den `badge`
  // als Schablone nimmt: nur der Alphakanal zaehlt, und icon-192.png ist
  // durchgehend deckend – in der Statusleiste stand ein weisser Kasten.
  './badge-96.png',
  // Der Rueckfall fuer die Statusleiste: Nimmt Android den `badge` nicht,
  // zeichnet es das App-Symbol als Schablone - und icon-192.png ist deckend,
  // also ein Kasten. Siehe icon-monochrome.svg.
  './icon-monochrome-512.png',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './manifest.webmanifest',
];

/**
 * Am Zwischenspeicher des Browsers vorbei laden.
 *
 * Das ist keine Feinheit: GitHub Pages schickt die Dateien mit einer
 * Haltbarkeit von zehn Minuten. Ein gewöhnliches fetch() bekommt dann die
 * *alte* Fassung aus dem Browser-Zwischenspeicher – und der Service Worker
 * legt sie als vermeintlich frisch in seinen eigenen. So kann eine neue
 * Fassung beliebig lange nicht ankommen, obwohl sie längst online steht.
 */
const fresh = (input) => fetch(new Request(input, { cache: 'reload' }));

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      // Einzeln statt addAll: eine fehlende Datei darf nicht die gesamte
      // Installation scheitern lassen.
      .then((cache) => Promise.all(SHELL.map((url) => fresh(url)
        .then((res) => (res && res.ok ? cache.put(url, res) : null))
        .catch(() => null))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Nur im Zwischenspeicher dieser Fassung nachsehen. caches.match() ohne
  // Angabe durchsucht *alle* – ein übrig gebliebener alter Zwischenspeicher
  // würde dann weiter alte Dateien ausliefern.
  const cached = (req) => caches.open(CACHE).then((c) => c.match(req));

  // Nur eine gute Antwort ersetzt, was im Zwischenspeicher liegt. Vorher wurde
  // beim Seitenaufruf *jede* Antwort abgelegt – eine 503 von GitHub Pages oder
  // eine umgeleitete Seite ebenso. Danach lieferte der Worker genau diese
  // Fehlerseite aus, auch ohne Netz, und die App ging im Keller nicht mehr auf,
  // obwohl die Daten im Speicher lagen. Gefunden bei der Durchsicht der App.
  const gut = (res) => res && res.ok && !res.redirected && res.type === 'basic';
  const zuletztGut = () => cached(request).then((hit) => hit || cached('./index.html'));

  if (request.mode === 'navigate') {
    event.respondWith(
      fresh(request)
        .then((res) => {
          if (gut(res)) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(request, copy));
            return res;
          }
          // Fehler- oder Umleitungsseite: lieber die letzte gute Fassung zeigen.
          // Nur wenn es keine gibt, sieht man, was der Server geschickt hat.
          return zuletztGut().then((hit) => hit || res);
        })
        .catch(() => zuletztGut().then((hit) => hit || Response.error())),
    );
    return;
  }

  event.respondWith(
    cached(request).then((hit) => {
      const update = fresh(request)
        .then((res) => {
          if (gut(res)) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(request, copy));
          }
          return res;
        })
        .catch(() => hit);
      return hit || update;
    }),
  );
});

/* ------------------------------------------------------------------ *
 * Was hier NICHT mehr steht: die Erinnerung am Trainingstag
 *
 *     „Mach auch die einmalige Push Nachricht morgens weg. Pausen usw sollen
 *      aber natuerlich immer noch mit angezeigt werden"
 *
 * Bis v182 stand hier die Meldung „Training steht an", geweckt durch
 * `periodicsync` und durch Web Push von einem zeitgesteuerten Ablauf bei
 * GitHub. Sie ist ersatzlos weg, und mit ihr der ganze Weg dorthin: der
 * Merkzettel in IndexedDB, beide Ereignisse, der Wecker, die VAPID-Schluessel.
 *
 * **Warum nicht nur die Meldung, sondern der ganze Weg.** Web Push laeuft unter
 * `userVisibleOnly`: Chrome erwartet, dass jeder zugestellte Push etwas
 * anzeigt, und blendet sonst irgendwann von sich aus „im Hintergrund
 * aktualisiert" ein. Ein stiller Push waere also keine stille Loesung, sondern
 * eine fremde Meldung an derselben Stelle. Bleibt der Weg bestehen und wird nur
 * die Meldung entfernt, steht am Ende genau das da, was weg sollte.
 *
 * **Was bleibt, ist alles rund um die Pause** – `pause-start`, die laufende
 * Uhr, „Pause vorbei". Die haengt an einer Nachricht der Seite und nicht am
 * Push-Dienst; sie war nie Teil dieses Abschnitts und ist es auch jetzt nicht.
 * ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ *
 * Die laufende Pause – hier statt in der Seite
 *
 * Erst zaehlte die Seite selbst herunter und ersetzte jede Sekunde dieselbe
 * Meldung. Das funktioniert, solange die Seite laeuft – und genau daran hakt
 * es: Android friert eine Seite im Hintergrund ein, spaetestens wenn der
 * Bildschirm laenger aus ist. Dann steht die Zahl, und das Signal am Ende
 * kommt gar nicht.
 *
 * Ein Service Worker haengt nicht an der Seite. Solange ein `waitUntil` offen
 * ist, laeuft er weiter, auch wenn die Seite eingefroren oder ganz weg ist.
 * Deshalb bekommt er beim Start der Pause einmal Bescheid und macht den Rest
 * allein: mitzaehlen, am Ende melden.
 *
 * **Was das nicht kann.** Chrome beendet einen Worker, dessen Ereignis zu
 * lange laeuft – in der Groessenordnung von fuenf Minuten. Fuer eine Pause von
 * 90 bis 180 Sekunden reicht das; fuer eine beliebig lange nicht, deshalb der
 * Deckel unten. Und ist der Browser ganz beendet, laeuft nichts mehr – dafuer
 * gaebe es keinen Weg ausser einem Server, der zur Sekunde sendet.
 * ------------------------------------------------------------------ */

const PAUSE_TAG = 'workout-pause';
const PAUSE_DECKEL = 300000;   // 5 min – darueber beendet Chrome den Worker ohnehin
let pause = null;              // { endet, text, sichtbar, fertig }

/** Eine Meldung, die sich selbst ersetzt statt zu stapeln. */
function pauseZeigen(rest) {
  const sek = Math.max(0, Math.round(rest / 1000));
  const ende = new Date(pause.endet);
  const uhr = `${ende.getHours()}:${String(ende.getMinutes()).padStart(2, '0')}`;
  return self.registration.showNotification(
    `Pause ${Math.floor(sek / 60)}:${String(sek % 60).padStart(2, '0')}`,
    {
      body: `${pause.text} · weiter um ${uhr}`,
      tag: PAUSE_TAG,
      // Nur das kleine Symbol – zu `icon` siehe erinnerungZeigen().
      badge: './badge-96.png',
      silent: true,          // sonst klingelt es jede Sekunde neu
      renotify: false,
      requireInteraction: true,
    },
  );
}

/** Das Ende: die eine Meldung, die sich bemerkbar machen darf. */
function pauseFertig() {
  return self.registration.showNotification('Pause vorbei', {
    body: pause.text,
    tag: PAUSE_TAG,
    badge: './badge-96.png',
    vibrate: [180, 90, 180],
    requireInteraction: true,
  });
}

/**
 * Die Uhr des Workers. Laeuft, bis die Pause um ist oder abgesagt wird.
 *
 * Gewartet wird auf einen echten Zeitpunkt, nicht auf gezaehlte Sekunden: Wird
 * der Worker zwischendurch ausgebremst, stimmt die Zahl trotzdem.
 */
function pauseUhr() {
  return new Promise((fertig) => {
    const takt = setInterval(async () => {
      if (!pause) { clearInterval(takt); fertig(); return; }
      const rest = pause.endet - Date.now();
      if (rest <= 0) {
        clearInterval(takt);
        await pauseFertig().catch(() => {});
        pause = null;
        fertig();
        return;
      }
      // Waehrend die App vorn ist, zeigt sie die Leiste selbst – eine Meldung
      // in der Statusleiste waere daneben nur ein Duplikat.
      if (!pause.sichtbar) await pauseZeigen(rest).catch(() => {});
    }, 1000);
  });
}

/** Die schon sichtbare Pausenmeldung wegraeumen. */
async function pauseWeg() {
  const liste = await self.registration.getNotifications({ tag: PAUSE_TAG });
  liste.forEach((n) => n.close());
}

self.addEventListener('message', (event) => {
  const m = event.data || {};
  if (m.typ === 'pause-start') {
    const lauf = Number(m.endet) - Date.now();
    if (!(lauf > 0) || lauf > PAUSE_DECKEL) return;
    const schonAn = !!pause;
    pause = { endet: Number(m.endet), text: String(m.text || ''), sichtbar: !!m.sichtbar };
    // Nur eine Uhr: Bei „+30 s" laeuft die bestehende weiter und liest den
    // neuen Endzeitpunkt beim naechsten Takt.
    if (!schonAn) event.waitUntil(pauseUhr());
  } else if (m.typ === 'pause-aus') {
    pause = null;
    event.waitUntil(pauseWeg());
  } else if (m.typ === 'sichtbar') {
    if (pause) pause.sichtbar = !!m.an;
    if (m.an) event.waitUntil(pauseWeg());
  }
});

/*
 * Tippen auf den Hinweis „Pause vorbei" bringt die App nach vorn, statt eine
 * zweite Instanz zu oeffnen. Ohne diesen Zweig passiert schlicht nichts.
 */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const liste = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of liste) {
      if ('focus' in client) {
        await client.focus();
        return;
      }
    }
    await self.clients.openWindow('./');
  })());
});
