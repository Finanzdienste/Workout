/*
 * Service Worker der Schilddrüsen-App – macht sie ohne Netz benutzbar.
 *
 * Liegt in schilddruese/, und damit ist sein Geltungsbereich genau dieser
 * Ordner. Der Service Worker der Workout-App eine Ebene höher deckt zwar
 * formal auch diesen Pfad ab, aber der Browser nimmt für eine Seite immer die
 * Registrierung mit dem längsten passenden Pfad – also diese.
 *
 * Zwei Strategien, übernommen aus ../sw.js und dort begründet:
 *
 *   Seitenaufrufe   erst Netz, bei Fehlschlag der Zwischenspeicher.
 *   Alles andere    sofort aus dem Zwischenspeicher, parallel erneuern.
 *
 * VERSION bei jeder Änderung an einer der unten gelisteten Dateien
 * hochzählen – daran hängt das Aufräumen alter Zwischenspeicher, und ohne
 * das trifft beim ersten Öffnen nach einem Update ein frisches index.html
 * auf ein altes app.js.
 */

const VERSION = 'v3';
const CACHE = `schilddruese-${VERSION}`;

const SHELL = [
  './',
  './index.html',
  './css/styles.css',
  './js/app.js',
  './js/datum.js',
  './js/speicher.js',
  './js/text.js',
  './js/diagramm.js',
  './js/ics.js',
  './js/wissen.js',
  './js/bericht.js',
  './js/ansicht-heute.js',
  './js/ansicht-verlauf.js',
  './js/ansicht-mehr.js',
  './js/ansicht-formulare.js',
  './js/ansicht-willkommen.js',
  './js/einheiten.js',
  './js/einschaetzung.js',
  './js/dosis.js',
  './js/ansicht-einschaetzung.js',
  './js/ansicht-dosis.js',
  './icon.svg',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './manifest.webmanifest',
];

/*
 * Am Zwischenspeicher des Browsers vorbei laden: GitHub Pages schickt die
 * Dateien mit zehn Minuten Haltbarkeit, und ein gewöhnliches fetch() bekäme
 * die alte Fassung – der Worker legte sie dann als vermeintlich frisch ab.
 */
const frisch = (eingabe) => fetch(new Request(eingabe, { cache: 'reload' }));

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      // Einzeln statt addAll: eine fehlende Datei darf nicht die gesamte
      // Installation scheitern lassen.
      .then((cache) => Promise.all(SHELL.map((url) => frisch(url)
        .then((res) => (res && res.ok ? cache.put(url, res) : null))
        .catch(() => null))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      // Nur die eigenen alten Fassungen wegräumen – der Zwischenspeicher der
      // Workout-App liegt im selben Ursprung und geht diesen Worker nichts an.
      .then((keys) => Promise.all(keys
        .filter((k) => k.startsWith('schilddruese-') && k !== CACHE)
        .map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  const imVorrat = (req) => caches.open(CACHE).then((c) => c.match(req));

  // Nur eine gute Antwort ersetzt, was im Zwischenspeicher liegt – keine 503
  // von GitHub Pages und keine Umleitung, sonst liefert der Worker offline
  // genau diese Fehlerseite aus.
  const gut = (res) => res && res.ok && !res.redirected && res.type === 'basic';
  const zuletztGut = () => imVorrat(request).then((hit) => hit || imVorrat('./index.html'));

  if (request.mode === 'navigate') {
    event.respondWith(
      frisch(request)
        .then((res) => {
          if (gut(res)) {
            const kopie = res.clone();
            caches.open(CACHE).then((c) => c.put(request, kopie));
            return res;
          }
          return zuletztGut().then((hit) => hit || res);
        })
        .catch(() => zuletztGut().then((hit) => hit || Response.error())),
    );
    return;
  }

  event.respondWith(
    imVorrat(request).then((hit) => {
      const erneuern = frisch(request)
        .then((res) => {
          if (gut(res)) {
            const kopie = res.clone();
            caches.open(CACHE).then((c) => c.put(request, kopie));
          }
          return res;
        })
        .catch(() => hit);
      return hit || erneuern;
    }),
  );
});

/*
 * Tippen auf eine Meldung („Tablette noch nicht genommen") bringt die App
 * nach vorn, statt eine zweite Instanz zu öffnen.
 */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    // Nur Fenster dieser App: Im selben Ursprung liegt die Workout-App, und
    // matchAll() liefert deren Fenster mit – der Hinweis zur Tablette holte
    // sonst womöglich das Training nach vorn.
    const liste = (await self.clients.matchAll({ type: 'window', includeUncontrolled: true }))
      .filter((c) => c.url.startsWith(self.registration.scope));
    for (const client of liste) {
      if ('focus' in client) {
        await client.focus();
        return;
      }
    }
    await self.clients.openWindow('./');
  })());
});
