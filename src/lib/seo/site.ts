import { routing } from "@/i18n/routing";

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://friendszy.ca").replace(
  /\/$/,
  ""
);

// Pages publiques indexables (chemins sans préfixe de locale).
export const PUBLIC_PATHS = ["/", "/login", "/privacy", "/terms"] as const;

export function localizedPath(locale: string, path: string) {
  const prefix = locale === routing.defaultLocale ? "" : `/${locale}`;
  if (path === "/") return prefix || "/";
  return `${prefix}${path}`;
}

// Canonical + hreflang (self-référencé, x-default → locale par défaut).
export function localeAlternates(locale: string, path: string) {
  return {
    canonical: localizedPath(locale, path),
    languages: {
      ...Object.fromEntries(routing.locales.map((l) => [l, localizedPath(l, path)])),
      "x-default": localizedPath(routing.defaultLocale, path),
    },
  };
}

// Robots d'indexation courants (Googlebot, Bingbot, etc.) : ils n'ont jamais le cookie
// « welcome vu », on leur sert donc directement la landing page.
export const BOT_UA = /bot|crawl|spider|slurp|facebookexternalhit|embedly|preview|lighthouse/i;
