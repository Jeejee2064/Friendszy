import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { INTENT_COOKIE_NAME, parseIntentCookie } from "@/lib/intent/cookie";
import { resolveIntentHref } from "@/lib/intent/queries";

// Consume-once: called from the client right after the nav tour finishes/is
// skipped (src/components/layout/nav-tour.tsx), or on the very next home
// load for an account that had already seen the tour before
// (src/components/landing/intent-redirect.tsx) — either way, a checked
// intent is spent, so the cookie is cleared here regardless of whether it
// resolved to a real href.
export async function GET() {
  const cookieStore = await cookies();
  const intent = parseIntentCookie(cookieStore.get(INTENT_COOKIE_NAME)?.value);

  const supabase = await createClient();
  const href = await resolveIntentHref(supabase, intent);

  const response = NextResponse.json({ href });
  response.cookies.delete(INTENT_COOKIE_NAME);
  return response;
}
