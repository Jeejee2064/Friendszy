import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo/site";

export default function robots(): MetadataRoute.Robots {
  const privatePaths = [
    "/api/",
    "/auth/",
    "/admin",
    "/admin-gate",
    "/messages",
    "/settings",
    "/onboarding",
    "/suspended",
    "/notifications",
  ];
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: privatePaths.flatMap((p) => [p, `/en${p}`, `/es${p}`]),
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
