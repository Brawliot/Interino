/* Service worker minimo: PWA + shell offline. No intercepta JS/CSS hasheados. */
const CACHE = "interino-shell-v2";
const SHELL = ["/", "/index.html", "/manifest.webmanifest", "/icons/icon.svg"];
const FETCH_MS = 8000;

function esShell(pathname) {
  return SHELL.some((p) => pathname === p);
}

function fetchConTimeout(request) {
  if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") {
    return fetch(request, { signal: AbortSignal.timeout(FETCH_MS) });
  }
  return fetch(request);
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.endsWith(".json") || url.hostname.includes("r2.dev")) return;

  // Navegacion: red con timeout; si falla, shell en cache. Nunca inventar respuesta para assets.
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetchConTimeout(event.request)
        .then((res) => {
          if (res.ok) {
            const forIndex = res.clone();
            const forRoot = res.clone();
            caches.open(CACHE).then((c) => {
              c.put("/index.html", forIndex);
              c.put("/", forRoot);
            });
          }
          return res;
        })
        .catch(() =>
          caches
            .match("/index.html")
            .then((r) => r || caches.match("/"))
            .then((r) => r || Response.error()),
        ),
    );
    return;
  }

  // Solo manifest/icono: cache-first. JS/CSS de /assets/ no se interceptan.
  if (!esShell(url.pathname)) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetchConTimeout(event.request)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(event.request, copy));
          }
          return res;
        })
        .catch(() => Response.error());
    }),
  );
});
