import type { Database } from "@/types/supabase";

export type Interest = Database["public"]["Tables"]["interests"]["Row"];

export type ProfilePhoto = Database["public"]["Tables"]["profile_photos"]["Row"];

// Hand-written to match the `cities` table from
// supabase/migrations/20260914140000_cities_catalogue.sql (id/name/created_at,
// see that migration) — not sourced from Database["public"]["Tables"] like
// the types above because generated types are only refreshed by running the
// Supabase CLI after a migration lands in the project (see CLAUDE.md), which
// hasn't happened yet for this table. Switch this to
// Database["public"]["Tables"]["cities"]["Row"] once `npm run supabase:types`
// has been re-run against the live schema.
export type City = { id: number; name: string; created_at: string };

// Hand-written for the same reason as City above — see
// supabase/migrations/20261001120000_interest_categories.sql. Switch to the
// generated Row type once `npm run supabase:types` has been re-run.
export type InterestCategory = {
  slug: string;
  label_fr: string;
  label_en: string;
  label_es: string | null;
  sort_order: number;
  created_at: string;
};

export type Gender = "homme" | "femme" | "non-binaire" | "autre";

export const GENDERS: Gender[] = ["homme", "femme", "non-binaire", "autre"];

export type LookingFor =
  | "new_friends"
  | "sport_partner"
  | "outings"
  | "parent_friends"
  | "online_chat"
  | "networking"
  | "game_partner"
  | "other";

export const LOOKING_FOR_OPTIONS: LookingFor[] = [
  "new_friends",
  "sport_partner",
  "outings",
  "parent_friends",
  "online_chat",
  "networking",
  "game_partner",
  "other",
];

export const LOOKING_FOR_OTHER_MAX = 100;

// ISO 639-1 codes. Display names come from Intl.DisplayNames in the viewer's
// locale (see languageLabel), so nothing here needs translating.
export const LANGUAGE_CODES = [
  "fr",
  "en",
  "es",
  "pt",
  "it",
  "de",
  "ar",
  "zh",
  "ru",
  "hi",
  "ja",
  "ko",
  "nl",
  "pl",
  "uk",
  "ht",
] as const;

export const MAX_LANGUAGES = 10;

export function languageLabel(code: string, locale: string): string {
  try {
    const name = new Intl.DisplayNames([locale], { type: "language" }).of(code);
    if (name) return name.charAt(0).toLocaleUpperCase(locale) + name.slice(1);
  } catch {
    // unsupported code/locale — fall through to the raw code
  }
  return code;
}

export type ProfileFormData = {
  full_name: string;
  last_name: string;
  avatar_url: string | null;
  city: string;
  age: number | null;
  gender: Gender | null;
  bio: string;
  looking_for: LookingFor | null;
  looking_for_other: string;
  languages: string[];
};

export type ProfileSummary = {
  id: string;
  full_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  city: string | null;
  age: number | null;
  gender: string | null;
  // Non-null while `city` is a temporary (Premium) override rather than the
  // profile's real city — see set_temporary_city()/clear_temporary_city()
  // in supabase/migrations/20260908180000_profiles_temporary_city.sql.
  // Optional: only present when the caller's select actually asked for it.
  temporary_city_until?: string | null;
  // Arrival date of that same trip (20260913120000_temporary_city_date_range.sql).
  // A trip can be booked ahead of time, so `temporary_city_until` alone
  // isn't enough to know the person has actually arrived yet — `city`
  // itself doesn't switch to the destination until this date, so treat
  // "visiting" as true only once now() has passed it too.
  temporary_city_from?: string | null;
};
