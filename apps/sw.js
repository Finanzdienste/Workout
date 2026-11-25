/*
 * Service Worker von „Meine Apps“ – die Übersicht geht auch ohne Netz auf.
 *
 * Liegt in apps/, sein Geltungsbereich ist genau dieser Ordner; ../sw.js lässt
 * /apps ausdrücklich in Ruhe. Gebaut wie mahlzeit/sw.js:
 *
 *   Seitenaufrufe   erst Netz, ohne Netz der Vorrat.
 *   Alles andere    aus dem Vorrat, nur was dort fehlt vom Netz.
 *
 * Den Vorrat der Seite füllt nur die Installation (nie ein Abruf), damit sich
 * keine zwei Fassungen mischen. Dazu ein zweiter Vorrat für die Symbole der
 * anderen Apps (apps-bilder): die gehören zu keiner Fassung, er füllt sich beim
 * ersten Ansehen.
 *
 * Zwei Apps im selben Ursprung (Frag mal, Body Check) räumen beim Update alle
 * fremden Vorräte weg. Deshalb heilt sich dieser selbst: Fehlt er nach einem
 * Seitenaufruf mit Netz, füllt der Worker ihn neu. Die Zahlen selbst liegen im
 * localStorage der Seite und sind davon nicht betroffen.
 *
 * VERSION bei jeder Änderung an einer Datei aus SHELL hochzählen; dieselbe
 * Fassung steht als FASSUNG in js/app.js (tests/test-apps.mjs vergleicht beide).
 */

const VERSION = 'a1';
const CACHE = `apps-${VERSION}`;
const BILDER = 'apps-bilder';

const SHELL = [
  './',
  './index.html',
  './css/apps.css',
  './js/app.js',
  './js/modell.js',
  './icon.svg',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './manifest.webmanifest',
];

/* Am Zwischenspeicher des Browsers vorbei: GitHub Pages gibt zehn Minuten Haltbarkeit. */
const frisch = (eingabe) => fetch(new Request(eingabe, { cache: 'reload' }));

function fuellen() {
  return caches.has(CACHE).then((schonDa) => caches.open(CACHE)
    .then((cache) => Promise.all(SHELL.map((url) => frisch(url).then((res) => {
      if (!res || !res.ok) throw new Error(`${url}: ${res ? res.status : 'keine Antwort'}`);
      return cache.put(url, res);
    }))))
    // Gescheitert: den halb gefüllten Vorrat wegräumen, der alte Worker bleibt.
    .catch((e) => (schonDa ? Promise.reject(e) : caches.delete(CACHE).then(() => { throw e; }))));
}

self.addEventListener('install', (event) => {
  event.waitUntil(fuellen().then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      // Nur die eigenen alten Fassungen – im selben Ursprung liegen die
      // Vorräte von Workout, Mahlzeit, Schilddrüse und den anderen Apps.
      .then((keys) => Promise.all(keys
        .filter((k) => k.startsWith('apps-') && k !== CACHE && k !== BILDER)
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
        .then((res) => {
          if (gut(res)) {
            // Selbst heilen, falls eine andere App den Vorrat geräumt hat.
            event.waitUntil(caches.has(CACHE).then((da) => (da ? null : fuellen())).catch(() => null));
            return res;
          }
          return zuletztGut().then((hit) => hit || res);
        })
        .catch(() => zuletztGut().then((hit) => hit || Response.error())),
    );
    return;
  }

  // Symbole der anderen Apps: einmal gesehen, auch ohne Netz da.
  const eigenerOrdner = url.pathname.startsWith(new URL('./', self.location).pathname);
  if (!eigenerOrdner && request.destination === 'image') {
    event.respondWith(caches.open(BILDER).then((c) => c.match(request).then((hit) => {
      const neu = fetch(request).then((res) => {
        if (gut(res)) c.put(request, res.clone());
        return res;
      });
      if (hit) {
        event.waitUntil(neu.catch(() => null));
        return hit;
      }
      return neu;
    })));
    return;
  }

  event.respondWith(imVorrat(request).then((hit) => hit || frisch(request)));
});
