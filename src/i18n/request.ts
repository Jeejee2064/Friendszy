import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { routing } from "./routing";

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
    // Computed once per request and threaded through to the client's
    // initial render (via NextIntlClientProvider) — without this, useNow()
    // calls `new Date()` independently on the server and during client
    // hydration, and any drift across a minute boundary causes a hydration
    // mismatch on relative-time strings (e.g. "53 minutes ago" vs "54").
    now: new Date(),
    // Without this, format.dateTime() falls back to the JS runtime's local
    // timezone — the *server's*, not the visitor's, which showed message
    // timestamps in the wrong timezone. Fixed to Eastern since Quebec is
    // the sole launch market (see CLAUDE.md); revisit if the app ever
    // serves visitors outside that timezone.
    timeZone: "America/Toronto",
  };
});
