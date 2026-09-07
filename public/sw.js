/* Service worker: PWA + shell offline + Web Push. No intercepta JS/CSS hasheados. */
const CACHE = "interino-shell-v3";
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

/** Avisos en segundo plano (Web Push). Payload JSON: { title, body, url }. */
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    try {
      data = { body: event.data?.text() || "" };
    } catch {
      data = {};
    }
  }
  const title = data.title || "Interino";
  const options = {
    body: data.body || "Hay novedades en tus seguimientos.",
    icon: "/icons/icon.svg",
    badge: "/icons/icon.svg",
    tag: data.tag || "interino-push",
    data: { url: data.url || "/?paso=seguimientos" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = event.notification.data?.url || "/?paso=seguimientos";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) {
          client.navigate?.(target);
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(target);
      return undefined;
    }),
  );
});
