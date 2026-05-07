/* Hunter Protocol — service worker
   - Caches app shell (network-first for navigations, cache fallback when offline)
   - Handles daily-quest notifications + click-to-open
*/
const CACHE = "hunter-protocol-v2";
const APP_SHELL = [
  "/",
  "/index.html",
  "/manifest.json",
  "/icon.svg",
  "/icon-180.png",
  "/icon-192.png",
  "/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(APP_SHELL).catch(() => null))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  // Only handle GET; never cache /api or auth
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.pathname.startsWith("/api/")) return;

  // Navigations: network-first, cache fallback
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((r) => {
          const copy = r.clone();
          caches.open(CACHE).then((c) => c.put(request, copy)).catch(() => null);
          return r;
        })
        .catch(() => caches.match(request).then((m) => m || caches.match("/index.html")))
    );
    return;
  }

  // Static same-origin: cache-first
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(request).then(
        (m) =>
          m ||
          fetch(request).then((r) => {
            if (r && r.status === 200 && r.type === "basic") {
              const copy = r.clone();
              caches.open(CACHE).then((c) => c.put(request, copy)).catch(() => null);
            }
            return r;
          })
      )
    );
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) {
          client.postMessage({ type: "OPEN_QUESTS" });
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow("/quests");
    })
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SHOW_NOTIFICATION") {
    const { title, body } = event.data;
    self.registration.showNotification(title, {
      body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: "daily-quest",
      vibrate: [80, 40, 80],
    });
  }
});
