import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "@/i18n/routing";
import { updateSession } from "@/lib/supabase/middleware";
import { isProfileComplete } from "@/lib/profile/completeness";

const handleI18nRouting = createMiddleware(routing);

function withLocalePrefix(pathname: string, targetPath: string) {
  return /^\/en(?=\/|$)/.test(pathname) ? `/en${targetPath}` : targetPath;
}

export async function proxy(request: NextRequest) {
  const intlResponse = handleI18nRouting(request);
  const { response, supabase, user } = await updateSession(request, intlResponse);

  const pathname = request.nextUrl.pathname;
  const path = pathname.replace(/^\/en(?=\/|$)/, "") || "/";
  const protectedPaths = [
    "/",
    "/onboarding",
    "/profile",
    "/settings",
    "/notifications",
    "/search",
    "/friends",
    "/messages",
    "/admin",
    "/suspended",
  ];
  const guarded = protectedPaths.some(
    (p) => path === p || path.startsWith(`${p}/`)
  );

  if (guarded) {
    if (!user) {
      return NextResponse.redirect(
        new URL(withLocalePrefix(pathname, "/login"), request.url)
      );
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, avatar_url, city, age, gender, moderation_status, is_admin")
      .eq("id", user.id)
      .maybeSingle();

    const suspended = !!profile && profile.moderation_status !== "active";

    if (suspended) {
      if (path !== "/suspended") {
        return NextResponse.redirect(
          new URL(withLocalePrefix(pathname, "/suspended"), request.url)
        );
      }
      return response;
    }
    if (path === "/suspended") {
      return NextResponse.redirect(
        new URL(withLocalePrefix(pathname, "/"), request.url)
      );
    }

    const complete = isProfileComplete(profile);

    if (!complete && path !== "/onboarding") {
      return NextResponse.redirect(
        new URL(withLocalePrefix(pathname, "/onboarding"), request.url)
      );
    }
    if (complete && path === "/onboarding") {
      return NextResponse.redirect(
        new URL(withLocalePrefix(pathname, "/"), request.url)
      );
    }

    if ((path === "/admin" || path.startsWith("/admin/")) && !profile?.is_admin) {
      return NextResponse.redirect(
        new URL(withLocalePrefix(pathname, "/"), request.url)
      );
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|icons/|logo-letters.svg).*)",
  ],
};
