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

export type Gender = "homme" | "femme" | "non-binaire" | "autre";

export const GENDERS: Gender[] = ["homme", "femme", "non-binaire", "autre"];

export type ProfileFormData = {
  full_name: string;
  last_name: string;
  avatar_url: string | null;
  city: string;
  age: number | null;
  gender: Gender | null;
  bio: string;
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
