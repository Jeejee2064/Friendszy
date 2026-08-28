"use client";

import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (
      process.env.NODE_ENV === "production" &&
      "serviceWorker" in navigator
    ) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((registration) => {
          // Browsers only re-check a registered worker's bytes for changes
          // periodically (can be up to 24h) — without forcing it, a
          // deployed sw.js fix can sit unused on a returning visitor's
          // device far longer than expected. install/activate already
          // call skipWaiting()/clients.claim(), so once a newer version
          // is found here it takes over immediately, no extra reload logic
          // needed.
          registration.update().catch(() => {});
        })
        .catch(() => {
          // Installation échouera silencieusement (ex: navigateur non compatible) sans bloquer l'app.
        });
    }
  }, []);

  return null;
}
