import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";
import { localeAlternates, localizedPath, PUBLIC_PATHS, SITE_URL } from "@/lib/seo/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return PUBLIC_PATHS.flatMap((path) =>
    routing.locales.map((locale) => ({
      url: `${SITE_URL}${localizedPath(locale, path)}`,
      changeFrequency: path === "/" ? ("weekly" as const) : ("monthly" as const),
      priority: path === "/" ? 1 : 0.5,
      alternates: {
        languages: Object.fromEntries(
          Object.entries(localeAlternates(locale, path).languages).map(([l, p]) => [
            l,
            `${SITE_URL}${p}`,
          ])
        ),
      },
    }))
  );
}
