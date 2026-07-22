export type Locale = "fr" | "en";

/**
 * Mirrors src/i18n/routing.ts's `localePrefix: "as-needed"`: the default
 * locale (fr) has no URL prefix, every other locale (en) is prefixed.
 */
export function localePath(locale: Locale, path: string): string {
  return locale === "fr" ? path : `/en${path}`;
}
