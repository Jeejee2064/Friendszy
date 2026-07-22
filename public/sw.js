const CACHE_NAME = "friendszy-shell-v2";
const APP_SHELL = [
  "/",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;

      // A navigation FetchEvent's request has redirect mode "manual" by
      // default. "/" gets 307-redirected to a locale path (next-intl
      // middleware), and passing that followed redirect back through
      // respondWith() without forcing "follow" here throws — every
      // returning visitor got a hard "site can't be reached" on reload.
      return fetch(request, { redirect: "follow" })
        .then((response) => {
          // Don't cache a followed redirect (e.g. "/" -> "/fr") under the
          // original request's key — that would serve the wrong locale's
          // content at "/" on the next offline/cached load.
          if (!response.redirected) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);
    })
  );
});
