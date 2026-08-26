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

const VERSION = 'v71';
const CACHE = `workout-${VERSION}`;

const SHELL = [
  './',
  './index.html',
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
  './icon.svg',
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

  if (request.mode === 'navigate') {
    event.respondWith(
      fresh(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(request, copy));
          return res;
        })
        .catch(() => cached(request)
          .then((hit) => hit || cached('./index.html'))
          .then((hit) => hit || Response.error())),
    );
    return;
  }

  event.respondWith(
    cached(request).then((hit) => {
      const update = fresh(request)
        .then((res) => {
          if (res && res.ok) {
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

/*
 * Tippen auf den Hinweis „Pause vorbei" bringt die App nach vorn, statt eine
 * zweite Instanz zu oeffnen. Ohne diesen Zweig passiert schlicht nichts.
 */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((liste) => {
      for (const client of liste) {
        if ('focus' in client) return client.focus();
      }
      return self.clients.openWindow('./');
    }),
  );
});
