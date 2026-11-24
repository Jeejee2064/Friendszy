"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { attachNativePushTapHandler } from "@/lib/push/native";

export function ServiceWorkerRegister() {
  const router = useRouter();
  useEffect(() => {
    // Shell Capacitor : pas de service worker utile, mais il faut écouter le
    // clic sur les notifications push natives (ouvre la bonne conversation).
    attachNativePushTapHandler((url) => router.push(url)).catch(() => {});
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
  }, [router]);

  return null;
}
