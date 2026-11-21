/*
 * Service Worker von Mahlzeit – macht die App ohne Netz benutzbar.
 *
 * Liegt in mahlzeit/, sein Geltungsbereich ist genau dieser Ordner. Der
 * Worker der Workout-App eine Ebene höher deckt den Pfad formal mit ab; der
 * Browser nimmt aber die Registrierung mit dem längsten passenden Pfad, und
 * ../sw.js lässt /mahlzeit ausdrücklich in Ruhe.
 *
 * Gebaut wie schilddruese/sw.js, mit deren Lehren:
 *
 *   Seitenaufrufe   erst Netz, ohne Netz der Vorrat.
 *   Alles andere    aus dem Vorrat, nur was dort fehlt vom Netz.
 *
 * Den Vorrat füllt nur die Installation, nie ein Abruf – sonst mischen sich
 * nach einem abgebrochenen Update Module zweier Fassungen, und die App
 * startet nicht mehr. Und die Installation gelingt nur ganz oder gar nicht:
 * Fehlt eine Datei, bleibt der alte Worker mit seinem vollständigen Vorrat.
 *
 * VERSION bei jeder Änderung an einer Datei aus SHELL hochzählen; dieselbe
 * Fassung steht als FASSUNG in js/app.js (tests/test-mz-offline.mjs
 * vergleicht beide).
 */

const VERSION = 'v10';
const CACHE = `mahlzeit-${VERSION}`;

const SHELL = [
  './',
  './index.html',
  './css/styles.css',
  './js/app.js',
  './js/rechnen.js',
  './js/speicher.js',
  './js/lebensmittel.js',
  './js/strichcode.js',
  './js/ki.js',
  './js/sport.js',
  './js/figuren.js',
  './js/lebenszeichen.js',
  './js/uhr.js',
  './icon.svg',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './manifest.webmanifest',
];

/* Am Zwischenspeicher des Browsers vorbei: GitHub Pages gibt zehn Minuten Haltbarkeit. */
const frisch = (eingabe) => fetch(new Request(eingabe, { cache: 'reload' }));

self.addEventListener('install', (event) => {
  event.waitUntil(caches.has(CACHE).then((schonDa) => caches.open(CACHE)
    .then((cache) => Promise.all(SHELL.map((url) => frisch(url).then((res) => {
      if (!res || !res.ok) throw new Error(`${url}: ${res ? res.status : 'keine Antwort'}`);
      return cache.put(url, res);
    }))))
    .then(() => self.skipWaiting())
    // Gescheitert: den halb gefüllten Vorrat wegräumen, der alte Worker bleibt.
    .catch((e) => (schonDa ? Promise.reject(e) : caches.delete(CACHE).then(() => { throw e; })))));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      // Nur die eigenen alten Fassungen – im selben Ursprung liegen die
      // Vorräte von Workout und Schilddrüse.
      .then((keys) => Promise.all(keys
        .filter((k) => k.startsWith('mahlzeit-') && k !== CACHE)
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
  const gut = (res) => res && res.ok && !res.redirected && res.type === 'basic';
  const zuletztGut = () => imVorrat(request).then((hit) => hit || imVorrat('./index.html'));

  if (request.mode === 'navigate') {
    event.respondWith(
      frisch(request)
        .then((res) => (gut(res) ? res : zuletztGut().then((hit) => hit || res)))
        .catch(() => zuletztGut().then((hit) => hit || Response.error())),
    );
    return;
  }
  event.respondWith(imVorrat(request).then((hit) => hit || frisch(request)));
});
