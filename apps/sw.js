/*
 * Der alte Service Worker von „Meine Apps“ unter /Workout/apps/ – jetzt nur
 * noch einer, der sich selbst abmeldet.
 *
 * Meine Apps ist nach https://finanzdienste.github.io/Apps/ umgezogen
 * (Repo Finanzdienste/Apps, a6). Auf einem Handy, das die Seite hier schon
 * geöffnet hatte, ist der alte Worker noch registriert und lieferte ohne Netz
 * die alte Fassung aus seinem Vorrat. Findet der Browser diese Datei als
 * Update, räumt sie die alten Vorräte (apps-…) weg, meldet den Worker ab und
 * schickt offene Fenster an die neue Adresse.
 */
self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const vorraete = await caches.keys();
    await Promise.all(vorraete.filter((k) => k.startsWith('apps-')).map((k) => caches.delete(k)));
    await self.registration.unregister();
    const fenster = await self.clients.matchAll({ type: 'window' });
    await Promise.all(fenster.map((f) => f.navigate('https://finanzdienste.github.io/Apps/').catch(() => null)));
  })());
});
