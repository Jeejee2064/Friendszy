import { NextResponse } from "next/server";
import { HAS_CHOSEN_DISCOVER_COOKIE_NAME, hasChosenDiscoverCookieOptions } from "@/lib/intent/cookie";

// Called by the "Découvrir" button on the public landing page
// (src/components/landing/public-landing.tsx) — records that this visitor
// has already seen the accroche popup, so it doesn't come back on their
// next visit. Purely a UX cookie: never a substitute for the real session
// check, and grants no access on its own.
export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(
    HAS_CHOSEN_DISCOVER_COOKIE_NAME,
    "1",
    hasChosenDiscoverCookieOptions()
  );
  return response;
}
