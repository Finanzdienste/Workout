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

const VERSION = 'v18';
const CACHE = `workout-${VERSION}`;

const SHELL = [
  './',
  './index.html',
  './css/styles.css',
  './js/app.js',
  './js/data.js',
  './js/body.js',
  './js/chart.js',
  './js/dates.js',
  './js/figure.js',
  './js/store.js',
  './icon.svg',
  './manifest.webmanifest',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      // Einzeln statt addAll: eine fehlende Datei darf nicht die gesamte
      // Installation scheitern lassen.
      .then((cache) => Promise.all(SHELL.map((url) => cache.add(url).catch(() => null))))
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

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(request, copy));
          return res;
        })
        .catch(() => caches.match(request)
          .then((hit) => hit || caches.match('./index.html'))
          .then((hit) => hit || Response.error())),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((hit) => {
      const fresh = fetch(request)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(request, copy));
          }
          return res;
        })
        .catch(() => hit);
      return hit || fresh;
    }),
  );
});
