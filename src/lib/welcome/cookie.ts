// Marks a signed-out visitor as having already seen the /welcome intro
// screens, so proxy.ts only redirects "/" to them on a first visit. Purely a
// UX cookie — never a substitute for the real session check, and grants no
// access on its own (same spirit as has_chosen_discover in lib/intent/cookie.ts).
export const HAS_SEEN_WELCOME_COOKIE_NAME = "has_seen_welcome";
const HAS_SEEN_WELCOME_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export function hasSeenWelcomeCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: HAS_SEEN_WELCOME_MAX_AGE_SECONDS,
    path: "/",
  };
}
