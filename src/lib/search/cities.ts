import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { normalizeForSearch } from "@/lib/text";
import type { Database } from "@/types/supabase";

// Wraps normalizeForSearch with two quirks specific to (Québec) city names:
// hyphens in compound names ("St-Constant") shouldn't block a match against
// a query typed with a space ("St Constant") or vice versa, and "St"/"Ste"
// are near-universally understood as "Saint"/"Sainte" abbreviations — but
// the catalogue stores the full form, so "St-Constant" wouldn't otherwise
// match "Saint-Constant". Kept out of the generic normalizeForSearch (used
// for interests, admin search, etc.) since the abbreviation expansion only
// makes sense for place names.
export function normalizeCityForSearch(value: string): string {
  return normalizeForSearch(value)
    .replace(/-/g, " ")
    .replace(/\./g, "")
    .replace(/\bste\b/g, "sainte")
    .replace(/\bst\b/g, "saint");
}

// The city list used to be hardcoded here (CITY_SUGGESTIONS); it now lives in
// the `cities` table (supabase/migrations/20260914140000_cities_catalogue.sql)
// so admins can add missing cities themselves from /admin/cities instead of a
// code change + deploy. Fetched once per page load and cached at module
// scope — CityAutocomplete can mount several times on the same page (search
// filters, event/partner wizards, onboarding...) and they all share this one
// request instead of each firing their own.
let cachedNames: Promise<string[]> | null = null;

export function getCityNames(): Promise<string[]> {
  if (!cachedNames) {
    // `cities` isn't in the generated Database type yet (see City in
    // profile/types.ts) — `as any` needed until `npm run supabase:types` is
    // re-run post-migration. A failed fetch resolves to [] rather than
    // rejecting (a network hiccup shouldn't crash every CityAutocomplete on
    // the page) — it's cached for the rest of this page load like a
    // successful result would be, a fresh navigation retries.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- `cities` isn't in the generated Database type yet, see comment above
    cachedNames = (createClient() as any)
      .from("cities")
      .select("name")
      .order("name")
      .then(
        ({ data, error }: { data: { name: string }[] | null; error: unknown }) =>
          error ? [] : (data ?? []).map((row) => row.name)
      ) as Promise<string[]>;
  }
  return cachedNames;
}

export type CityOption = { id: number; name: string };

// Same module-scope caching as getCityNames — used wherever a stable city id
// is needed (group visibility, city-based filtering) rather than the free
// text `getCityNames()` backs (profile/search city fields aren't FK'd to
// this catalogue, see 20260914140000_cities_catalogue.sql).
let cachedCities: Promise<CityOption[]> | null = null;

export function getCities(): Promise<CityOption[]> {
  if (!cachedCities) {
    cachedCities = Promise.resolve(
      createClient().from("cities").select("id, name").order("name")
    ).then(({ data, error }) => (error ? [] : (data ?? [])));
  }
  return cachedCities;
}

// Server-safe variant — takes an explicit client (server or browser) instead
// of creating/caching a browser one at module scope, same reasoning as
// getInterests(supabase) in src/lib/profile/queries.ts. For a server
// component's one-shot per-request fetch, no caching needed.
export async function getCitiesList(
  supabase: SupabaseClient<Database>
): Promise<CityOption[]> {
  const { data, error } = await supabase.from("cities").select("id, name").order("name");
  if (error) throw error;
  return data ?? [];
}
