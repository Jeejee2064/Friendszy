const CACHE_NAME = "friendszy-shell-v3";
const APP_SHELL = ["/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png"];

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

  // Never intercept page navigations. This app doesn't need full offline
  // page support, and a full-page request can involve server redirects
  // (locale routing, auth guards) with fetch/redirect-mode edge cases that
  // are easy to get wrong in a service worker — getting it wrong here once
  // already broke the site for every returning visitor, in a way that
  // can't self-heal (a worker that fails every navigation also prevents
  // the page from ever loading far enough to check for a fixed update).
  // Falling through with no respondWith() hands navigations straight to
  // the network, completely unaffected by this file, permanently.
  if (request.mode === "navigate") return;

  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;

      return fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => cached);
    })
  );
});
