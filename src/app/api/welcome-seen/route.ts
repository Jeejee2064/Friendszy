import { NextResponse } from "next/server";
import { HAS_SEEN_WELCOME_COOKIE_NAME, hasSeenWelcomeCookieOptions } from "@/lib/welcome/cookie";

// Called by the /welcome carousel (src/components/welcome/welcome-carousel.tsx)
// once the visitor reaches the last screen or skips — records that the intro
// has been seen so proxy.ts stops redirecting "/" to it.
export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(HAS_SEEN_WELCOME_COOKIE_NAME, "1", hasSeenWelcomeCookieOptions());
  return response;
}
