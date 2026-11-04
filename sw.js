const CACHE = 'classhub-static-2026-11-04a';
const FILES = [
  './', './index.html', './manifest.webmanifest', './css/style.css',
  './assets/logo.svg', './assets/logo.png', './lib/pdf.min.js', './lib/pdf.worker.min.js',
  './js/firebase-config.js', './js/store.js', './js/icons.js', './js/app.js',
  './js/neis.js', './js/timer.js', './js/settings.js', './js/cloud.js',
  './js/timetable.js', './js/calendar.js', './js/activities.js',
  './js/grades.js', './js/meals.js', './js/notes.js', './js/pdfcapture.js', './js/main.js'
];
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (event) => {
  event.waitUntil(Promise.all([
    caches.keys().then((names) => Promise.all(names.filter((n) => n.startsWith('classhub-static-') && n !== CACHE).map((n) => caches.delete(n)))),
    self.clients.claim(),
  ]));
});
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(fetch(event.request).then((response) => {
    if (response.ok) {
      const copy = response.clone();
      caches.open(CACHE).then((cache) => cache.put(event.request, copy));
    }
    return response;
  }).catch(() => caches.match(event.request).then((cached) => cached || caches.match('./index.html'))));
});
