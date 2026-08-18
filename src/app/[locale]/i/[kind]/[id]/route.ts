import { NextResponse, type NextRequest } from "next/server";
import { routing } from "@/i18n/routing";
import {
  INTENT_COOKIE_NAME,
  intentCookieOptions,
  type PendingIntentKind,
} from "@/lib/intent/cookie";

const VALID_KINDS: PendingIntentKind[] = ["event", "partner"];

function isPendingIntentKind(value: string): value is PendingIntentKind {
  return (VALID_KINDS as string[]).includes(value);
}

// The public landing map's "En savoir plus" target for an anonymous
// visitor (src/components/landing/public-landing.tsx) — never the real
// protected detail route directly (that would just bounce through
// proxy.ts's own redirect-to-/login, losing which event/partner was
// clicked). Memorizes the intent, then hands off to sign-up; see
// nav-tour.tsx / intent-redirect.tsx for where it's picked back up once
// onboarding + the nav tour are done.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ locale: string; kind: string; id: string }> }
) {
  const { locale, kind, id } = await params;
  // "as-needed" locale prefix: the default locale (fr) has no URL prefix at
  // all — same convention as withLocalePrefix() in proxy.ts.
  const prefix = locale === routing.defaultLocale ? "" : `/${locale}`;

  if (!isPendingIntentKind(kind) || !id) {
    return NextResponse.redirect(new URL(`${prefix}/`, request.url));
  }

  const response = NextResponse.redirect(new URL(`${prefix}/login?mode=signUp`, request.url));
  response.cookies.set(INTENT_COOKIE_NAME, JSON.stringify({ kind, id }), intentCookieOptions());
  return response;
}
