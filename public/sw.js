const CACHE_NAME = "friendszy-shell-v6";
const APP_SHELL = ["/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png"];

// Paths safe to runtime-cache: build assets (immutable, hashed filenames)
// and the same small app-shell set precached above. Anything else —
// including Next.js's client-side "soft navigation" RSC fetches for pages
// like /messages?c=<id>, which are auth-gated and rendered per-request —
// must always hit the network. Caching one of those risks replaying a
// stale auth/redirect response on a later click, which is exactly the
// kind of bug the navigate-mode exclusion below already guards against
// for full page loads.
function isCacheableStaticAsset(pathname) {
  return pathname.startsWith("/_next/static/") || APP_SHELL.includes(pathname);
}

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

  if (!isCacheableStaticAsset(new URL(request.url).pathname)) {
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) {
        // Serve the cached copy immediately, refresh it in the background —
        // any refresh failure is swallowed here, it must never affect the
        // response already being returned.
        fetch(request)
          .then((response) => caches.open(CACHE_NAME).then((cache) => cache.put(request, response)))
          .catch(() => {});
        return cached;
      }

      // No cache entry to fall back to — resolving to `undefined` here (the
      // old behavior on a fetch failure) makes respondWith() itself throw,
      // which is what actually produced "the promise was rejected" network
      // errors. Let a real fetch failure propagate as a normal failed
      // request instead.
      return fetch(request).then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        return response;
      });
    })
  );
});

// Web Push: the push-new-message Edge Function sends a small generic JSON
// payload — { title, url } — never the message content itself (privacy:
// this is shown even on a locked phone). See supabase/functions/push-new-message.
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    return;
  }

  const title = data.title || "Friendszy";
  const url = data.url || "/";

  event.waitUntil(
    self.registration.showNotification(title, {
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url },
    })
  );
});

// Click → focus an already-open tab and navigate it to the conversation,
// or open a new one. Falling back to clients.openWindow() covers browsers
// without WindowClient.navigate() and the "no tab open" case.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      const target = windowClients.find(
        (client) => new URL(client.url).origin === self.location.origin
      );
      if (!target) return clients.openWindow(url);

      return (target.navigate ? target.navigate(url) : Promise.resolve(target))
        .then((client) => (client || target).focus())
        .catch(() => clients.openWindow(url));
    })
  );
});
