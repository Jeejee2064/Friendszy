import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "@/i18n/routing";
import { updateSession } from "@/lib/supabase/middleware";
import { isProfileComplete } from "@/lib/profile/completeness";
import { HAS_SEEN_WELCOME_COOKIE_NAME } from "@/lib/welcome/cookie";
import { BOT_UA } from "@/lib/seo/site";

const handleI18nRouting = createMiddleware(routing);

function withLocalePrefix(pathname: string, targetPath: string) {
  const match = pathname.match(/^\/(en|es)(?=\/|$)/);
  return match ? `/${match[1]}${targetPath}` : targetPath;
}

export async function proxy(request: NextRequest) {
  const intlResponse = handleI18nRouting(request);
  const { response, supabase, user } = await updateSession(request, intlResponse);

  const pathname = request.nextUrl.pathname;
  const path = pathname.replace(/^\/(en|es)(?=\/|$)/, "") || "/";
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
      // "/" is the one guarded path with a public face: a signed-out
      // visitor lands on the public map landing page rendered by
      // (app)/layout.tsx + (app)/page.tsx, not /login. Every other
      // guarded path still bounces to /login exactly as before — and an
      // authenticated visitor on "/" still goes through every check below
      // (suspended, onboarding, ...) unchanged.
      if (path === "/") {
        // First visit: show the /welcome intro screens before the public
        // landing page. The cookie is set once the visitor reaches the
        // last screen or skips (api/welcome-seen), and /welcome itself
        // stays reachable afterwards to replay it.
        // Crawlers never carry the cookie: serve them the landing page directly
        // instead of the thin /welcome carousel.
        const isBot = BOT_UA.test(request.headers.get("user-agent") ?? "");
        if (!isBot && request.cookies.get(HAS_SEEN_WELCOME_COOKIE_NAME)?.value !== "1") {
          return NextResponse.redirect(
            new URL(withLocalePrefix(pathname, "/welcome"), request.url)
          );
        }
        return response;
      }
      return NextResponse.redirect(
        new URL(withLocalePrefix(pathname, "/login"), request.url)
      );
    }

    // Shared password gate in front of /admin, checked before the real
    // is_admin check below — an outer convenience lock, not a replacement
    // for it (see src/app/api/admin/gate/route.ts).
    if (
      (path === "/admin" || path.startsWith("/admin/")) &&
      request.cookies.get("admin_gate")?.value !== "granted"
    ) {
      return NextResponse.redirect(
        new URL(withLocalePrefix(pathname, "/admin-gate"), request.url)
      );
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select(
        "full_name, last_name, avatar_url, city, age, gender, moderation_status, is_admin"
      )
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
  matcher: ["/((?!api|auth|_next|.*\\..*).*)"],
};
