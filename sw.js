/* ============================================================
   sw.js — Service Worker
   Legt beim ersten Laden alles in den Cache. Danach laeuft die App
   vollstaendig ohne Internet: Cache zuerst, Netz nur als Rueckfall.
   ============================================================ */

const CACHE = 'namensschild-v1.1.0';

const DATEIEN = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/style.css',
  './js/app.js',
  './js/config.js',
  './js/geom2d.js',
  './js/fonts.js',
  './js/build3d.js',
  './js/scene.js',
  './js/exporter.js',
  './js/ui.js',
  './vendor/three.module.js',
  './vendor/OrbitControls.js',
  './vendor/opentype.module.js',
  './fonts/Montserrat-Bold.ttf',
  './fonts/Poppins-SemiBold.ttf',
  './fonts/BebasNeue-Regular.ttf',
  './fonts/Anton-Regular.ttf',
  './fonts/Fredoka-SemiBold.ttf',
  './fonts/PlayfairDisplay-Bold.ttf',
  './fonts/Pacifico-Regular.ttf',
  './fonts/Orbitron-Bold.ttf',
  './fonts/Righteous-Regular.ttf',
  './fonts/PressStart2P-Regular.ttf',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    // einzeln, damit eine fehlende Datei nicht die ganze Installation kippt
    await Promise.all(DATEIEN.map(d => c.add(d).catch(err => console.warn('nicht gecacht:', d, err))));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const name of await caches.keys()) if (name !== CACHE) await caches.delete(name);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith((async () => {
    const treffer = await caches.match(e.request, { ignoreSearch: true });
    if (treffer) return treffer;
    try {
      const antwort = await fetch(e.request);
      if (antwort.ok && new URL(e.request.url).origin === self.location.origin){
        const c = await caches.open(CACHE);
        c.put(e.request, antwort.clone());
      }
      return antwort;
    } catch (err) {
      const start = await caches.match('./index.html');
      if (e.request.mode === 'navigate' && start) return start;
      throw err;
    }
  })());
});
