/* Service worker minimo: elegibilidad PWA + precache shell. Datos JSON siempre en red. */
const CACHE = "interino-shell-v1";
const SHELL = ["/", "/index.html", "/manifest.webmanifest", "/icons/icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
    ).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET") return;
  if (url.pathname.endsWith(".json") || url.hostname.includes("r2.dev")) {
    return;
  }
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(event.request)
      .then((res) => {
        if (res.ok && SHELL.some((p) => url.pathname === p || url.pathname.endsWith(".html"))) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(event.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(event.request).then((r) => r || caches.match("/index.html"))),
  );
});
