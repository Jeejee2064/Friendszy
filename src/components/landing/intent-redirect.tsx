"use client";

import { useEffect } from "react";
import { useRouter } from "@/i18n/navigation";

/**
 * Picks up a still-valid pending intent (src/lib/intent/*) on an
 * authenticated home load, for the account that already has
 * `has_seen_nav_tour = true` — so NavTour never mounts/fires its own
 * `finish()` hook (see nav-tour.tsx) to do this instead. Renders nothing.
 * Only ever mounted by (app)/page.tsx when that condition holds; when the
 * tour is still pending, NavTour owns this same "resolve + consume" call so
 * the redirect waits until the tour is actually finished/skipped.
 */
export function IntentRedirect() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    fetch("/api/intent")
      .then((r) => r.json())
      .then((data: { href: string | null }) => {
        if (!cancelled && data.href) router.replace(data.href);
      })
      .catch(() => {
        // No pending intent is the overwhelmingly common case anyway —
        // failing silently just means staying on the normal dashboard.
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
