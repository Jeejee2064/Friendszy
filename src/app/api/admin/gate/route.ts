import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/security/rate-limit";
import {
  ADMIN_GATE_COOKIE,
  ADMIN_GATE_MAX_AGE_SECONDS,
  createAdminGateToken,
  safeEqual,
} from "@/lib/security/admin-gate";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // Freine la force brute du mot de passe partagé (5 essais / 15 min par
  // utilisateur et par IP). Limiteur en mémoire : voir rate-limit.ts.
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (
    !rateLimit(`admin-gate:u:${user.id}`, 5, 15 * 60_000) ||
    !rateLimit(`admin-gate:ip:${ip}`, 10, 15 * 60_000)
  ) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const { password } = await request.json().catch(() => ({ password: "" }));
  const expected = process.env.ADMIN_DASHBOARD_PASSWORD;

  if (
    typeof password !== "string" ||
    !expected ||
    !(await safeEqual(password, expected))
  ) {
    return NextResponse.json({ error: "invalid" }, { status: 401 });
  }

  const token = await createAdminGateToken(user.id);
  if (!token) return NextResponse.json({ error: "not_configured" }, { status: 500 });

  const response = NextResponse.json({ ok: true });
  // Porte extérieure devant le vrai contrôle d'accès (profiles.is_admin,
  // vérifié séparément dans proxy.ts). Le cookie est signé (HMAC), lié à
  // l'utilisateur connecté et expire après 7 jours.
  response.cookies.set(ADMIN_GATE_COOKIE, token, {
    httpOnly: true,
    // Secure cookies are dropped by the browser over plain HTTP — fine in
    // production (always HTTPS) but breaks this locally over http://localhost.
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: ADMIN_GATE_MAX_AGE_SECONDS,
    path: "/",
  });
  return response;
}
