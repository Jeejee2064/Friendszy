"use client";

import { createClient } from "@/lib/supabase/client";
import { hasAnalyticsConsent } from "@/lib/consent/cookie-consent";
import type { AnalyticsEventName, PropertiesFor } from "./events";

// Events with an empty payload can omit `properties` entirely (pass
// `undefined` or nothing); events with real properties must pass them —
// this conditional tuple keeps that enforced at the type level rather than
// just by convention.
type TrackArgs<N extends AnalyticsEventName> = PropertiesFor<N> extends Record<string, never>
  ? [properties?: undefined, userId?: string]
  : [properties: PropertiesFor<N>, userId?: string];

// Logs one behavioural event to analytics_events. Client-only: consent is
// stored in localStorage (src/lib/consent/cookie-consent.ts), which a
// server route can't read, so every event — including the one confirmed
// server-side in auth/callback/route.ts — is fired from the browser. Best
// effort: never throws, never blocks the caller's own action.
//
// `userId` is optional — pass it when you already have it (avoids an extra
// auth round trip); omit it to let this resolve the current session itself
// (used by call sites like the PWA install context or the push permission
// flow, which don't have a user id handy). Silently no-ops for a logged-out
// visitor — v1 tracks authenticated behaviour only.
export async function track<N extends AnalyticsEventName>(
  eventName: N,
  ...[properties, userId]: TrackArgs<N>
): Promise<void> {
  if (!hasAnalyticsConsent()) return;
  try {
    const supabase = createClient();
    const uid = userId ?? (await supabase.auth.getUser()).data.user?.id;
    if (!uid) return;
    await supabase.from("analytics_events").insert({
      user_id: uid,
      event_name: eventName,
      properties: properties ?? {},
    });
  } catch {
    // best-effort — never block the user's action for analytics
  }
}
