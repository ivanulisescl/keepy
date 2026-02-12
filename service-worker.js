/* Keepy - Service Worker (network-first, actualizar en cada despliegue) */
const CACHE_VERSION = "keepy-v7";
const PRECACHE_URLS = [
  "./",
  "./index.html",
  "./css/styles.css",
  "./js/utils.js",
  "./js/storage.js",
  "./js/main.js",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png",
];

self.addEventListener("install", (event) => {
  self.skipWaiting(); // Forzar activación inmediata
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(PRECACHE_URLS)),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Borrar TODAS las cachés antiguas
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => (k === CACHE_VERSION ? null : caches.delete(k))));
      // Tomar control inmediato de todas las pestañas
      await self.clients.claim();
    })(),
  );
});

// Estrategia: NETWORK-FIRST para TODO.
// Siempre intenta descargar la versión más reciente.
// Solo usa caché si no hay red (offline).
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  event.respondWith(
    (async () => {
      try {
        const fresh = await fetch(req);
        // Guardar copia en caché para offline
        if (fresh.ok) {
          const cache = await caches.open(CACHE_VERSION);
          cache.put(req, fresh.clone());
        }
        return fresh;
      } catch {
        // Sin red: usar caché
        const cache = await caches.open(CACHE_VERSION);
        const cached = await cache.match(req);
        if (cached) return cached;
        // Fallback para navegación
        if (req.mode === "navigate") {
          const indexCached = await cache.match("./index.html");
          if (indexCached) return indexCached;
        }
        return new Response("Offline", {
          status: 503,
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        });
      }
    })(),
  );
});
