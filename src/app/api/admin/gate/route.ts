import { NextResponse, type NextRequest } from "next/server";

const ADMIN_GATE_COOKIE = "admin_gate";
const THIRTY_DAYS = 60 * 60 * 24 * 30;

export async function POST(request: NextRequest) {
  const { password } = await request.json().catch(() => ({ password: "" }));

  if (
    typeof password !== "string" ||
    !process.env.ADMIN_DASHBOARD_PASSWORD ||
    password !== process.env.ADMIN_DASHBOARD_PASSWORD
  ) {
    return NextResponse.json({ error: "invalid" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  // This cookie is an outer convenience gate in front of the real access
  // control (profiles.is_admin, checked separately in proxy.ts) — it's not
  // meant to identify who the admin is, just to keep the admin section out
  // of casual reach before someone even signs in.
  response.cookies.set(ADMIN_GATE_COOKIE, "granted", {
    httpOnly: true,
    // Secure cookies are dropped by the browser over plain HTTP — fine in
    // production (always HTTPS) but breaks this locally over http://localhost.
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: THIRTY_DAYS,
    path: "/",
  });
  return response;
}
