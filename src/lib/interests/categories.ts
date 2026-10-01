"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { InterestCategory } from "@/lib/profile/types";

// Fallback order used until the interest_categories table has loaded (and
// for any slug that has no row) — the 11 original hardcoded categories.
const DEFAULT_ORDER = [
  "sports",
  "plein_air",
  "arts_creatifs",
  "jeux",
  "lecture",
  "cinema_culture_pop",
  "genres_musicaux",
  "instruments_musique",
  "cuisine",
  "bien_etre",
  "autre",
];

export function localizedCategoryLabel(category: InterestCategory, locale: string): string {
  if (locale === "en") return category.label_en;
  if (locale === "es") return category.label_es || category.label_fr;
  return category.label_fr;
}

// One fetch per page load, shared by every InterestsGrid / GroupInterestSelect
// / SuggestInterestForm instance on screen.
let cache: InterestCategory[] | null = null;
let inflight: Promise<InterestCategory[]> | null = null;

function loadCategories(): Promise<InterestCategory[]> {
  if (cache) return Promise.resolve(cache);
  inflight ??= (async () => {
    const { data, error } = await (createClient() as any) // eslint-disable-line @typescript-eslint/no-explicit-any -- table not in generated types yet
      .from("interest_categories")
      .select("*")
      .order("sort_order")
      .order("label_fr");
    inflight = null;
    if (error) throw error;
    cache = data as InterestCategory[];
    return cache;
  })();
  return inflight;
}

export function invalidateInterestCategories() {
  cache = null;
}

export function useInterestCategories() {
  const [categories, setCategories] = useState<InterestCategory[]>(cache ?? []);

  useEffect(() => {
    let cancelled = false;
    loadCategories()
      .then((rows) => {
        if (!cancelled) setCategories(rows);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  /** Sort comparator for category slugs: table order first, then legacy order, then alphabetical. */
  function compareSlugs(a: string, b: string): number {
    const rank = (slug: string) => {
      const i = categories.findIndex((c) => c.slug === slug);
      if (i !== -1) return i;
      const d = DEFAULT_ORDER.indexOf(slug);
      return d === -1 ? Number.MAX_SAFE_INTEGER : categories.length + d;
    };
    return rank(a) - rank(b) || a.localeCompare(b);
  }

  /** Label for a slug, or null when the table has no such row (caller falls back to messages). */
  function labelFor(slug: string, locale: string): string | null {
    const c = categories.find((x) => x.slug === slug);
    return c ? localizedCategoryLabel(c, locale) : null;
  }

  return { categories, compareSlugs, labelFor };
}
