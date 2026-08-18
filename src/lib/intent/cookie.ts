// Cookies for the public (non-connecté) landing page — see
// src/components/landing/public-landing.tsx and
// src/app/[locale]/i/[kind]/[id]/route.ts. Same shape as the existing
// admin_gate cookie (src/app/api/admin/gate/route.ts): httpOnly, `secure`
// only in prod (breaks local http:// otherwise), `path: "/"`.

export type PendingIntentKind = "event" | "partner";
export type PendingIntent = { kind: PendingIntentKind; id: string };

export const INTENT_COOKIE_NAME = "friendszy_intent";
// "Quelques heures, pas indéfiniment" (spec) — a click days-old no longer
// means anything by the time someone gets around to finishing signup.
// Enforced entirely via the cookie's own Max-Age (no separate expiry
// field needed in the payload: an expired cookie is simply absent).
const INTENT_MAX_AGE_SECONDS = 60 * 60 * 4;

export function parseIntentCookie(raw: string | undefined): PendingIntent | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed === "object" &&
      ((parsed as { kind?: unknown }).kind === "event" ||
        (parsed as { kind?: unknown }).kind === "partner") &&
      typeof (parsed as { id?: unknown }).id === "string" &&
      (parsed as { id: string }).id.length > 0
    ) {
      return { kind: (parsed as PendingIntent).kind, id: (parsed as PendingIntent).id };
    }
  } catch {
    // Malformed/tampered cookie — treat as no intent rather than erroring.
  }
  return null;
}

export function intentCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    // Not "strict": the most common way back into this flow is clicking the
    // email-confirmation link from a mail client, which is a fresh
    // top-level cross-site navigation — a "strict" cookie would silently
    // not be sent on that hop.
    maxAge: INTENT_MAX_AGE_SECONDS,
    path: "/",
  };
}

// Skips the accroche popup on repeat visits once a visitor has picked
// "Découvrir" — independent of and never a substitute for the real
// session cookie, see src/app/[locale]/(app)/page.tsx.
export const HAS_CHOSEN_DISCOVER_COOKIE_NAME = "has_chosen_discover";
const HAS_CHOSEN_DISCOVER_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export function hasChosenDiscoverCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    maxAge: HAS_CHOSEN_DISCOVER_MAX_AGE_SECONDS,
    path: "/",
  };
}
