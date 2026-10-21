import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import type { ProfileSummary } from "@/lib/profile/types";
import { listBlockedProfiles } from "@/lib/blocks/queries";

type Client = SupabaseClient<Database>;

export type SearchFilters = {
  name?: string;
  city?: string;
  minAge?: number;
  maxAge?: number;
  gender?: string[];
  interestIds?: number[];
  // "Ce que je recherche" : valeurs de looking_for, et — pour
  // activity_partner — les intérêts précis pour lesquels on cherche un partenaire.
  lookingFor?: string[];
  partnerInterestIds?: number[];
};

export type SearchResult = ProfileSummary & { commonInterestCount: number };

export async function searchProfiles(
  supabase: Client,
  filters: SearchFilters,
  excludeUserId: string
): Promise<SearchResult[]> {
  let matchCounts: Map<string, number> | null = null;

  if (filters.interestIds && filters.interestIds.length > 0) {
    const { data, error } = await supabase
      .from("profile_interests")
      .select("profile_id, interest_id")
      .in("interest_id", filters.interestIds);
    if (error) throw error;

    matchCounts = new Map();
    for (const row of data ?? []) {
      matchCounts.set(row.profile_id, (matchCounts.get(row.profile_id) ?? 0) + 1);
    }

    if (matchCounts.size === 0) return [];
  }

  let cityIds: string[] | null = null;
  if (filters.city) {
    // profiles.city is free text, so a plain ilike misses accent variants
    // ("Montreal" vs "Montréal"). match_city_ids compares both sides through
    // unaccent() in Postgres, which the supabase-js filter builder can't
    // express directly on a column.
    const { data: cityMatches, error: cityError } = await supabase.rpc(
      "match_city_ids",
      { p_city: filters.city }
    );
    if (cityError) throw cityError;
    cityIds = (cityMatches ?? []).map((row) => row.id);
    if (cityIds.length === 0) return [];
  }

  // OR entre les choix : quelqu'un qui cherche « Sorties » OU un partenaire de
  // moto. activity_partner + intérêts passe par profile_partner_interests ;
  // activity_partner seul retombe sur la valeur looking_for.
  let lookingForClause: string | null = null;
  if (filters.lookingFor && filters.lookingFor.length > 0) {
    const partnerInterestIds = filters.partnerInterestIds ?? [];
    const withPartnerInterests =
      filters.lookingFor.includes("activity_partner") && partnerInterestIds.length > 0;
    const values = filters.lookingFor.filter(
      (value) => !(withPartnerInterests && value === "activity_partner")
    );

    const parts: string[] = [];
    if (values.length > 0) parts.push(`looking_for.ov.{${values.join(",")}}`);
    if (withPartnerInterests) {
      const { data, error } = await supabase
        .from("profile_partner_interests")
        .select("profile_id")
        .in("interest_id", partnerInterestIds);
      if (error) throw error;
      const ids = [...new Set((data ?? []).map((row) => row.profile_id))];
      if (ids.length > 0) parts.push(`id.in.(${ids.join(",")})`);
    }
    if (parts.length === 0) return [];
    lookingForClause = parts.join(",");
  }

  const blockedProfiles = await listBlockedProfiles(supabase);
  const blockedIds = blockedProfiles.map((row) => row.id);

  let query = supabase
    .from("profiles")
    .select(
      "id, full_name, last_name, avatar_url, city, age, gender, temporary_city_until, temporary_city_from"
    )
    .neq("id", excludeUserId)
    .limit(30);

  if (blockedIds.length > 0) query = query.not("id", "in", `(${blockedIds.join(",")})`);
  if (filters.name) {
    // Accent/case-insensitive match ("Kloe" finds "Kloé") — done in Postgres
    // via unaccent(), which the PostgREST ilike filter can't apply to a column.
    // Every token must match full_name or last_name; a single token also
    // matches username. LIKE wildcards are escaped so they match literally.
    const tokens = filters.name
      .split(/\s+/)
      .map((token) => token.replace(/[\\%_]/g, "\\$&"))
      .filter(Boolean);

    if (tokens.length > 0) {
      const { data: nameMatches, error: nameError } = await supabase.rpc(
        "match_profile_name_ids",
        { p_tokens: tokens }
      );
      if (nameError) throw nameError;
      const nameIds = (nameMatches ?? []).map((row) => row.id);
      if (nameIds.length === 0) return [];
      query = query.in("id", nameIds);
    }
  }
  if (lookingForClause) query = query.or(lookingForClause);
  if (cityIds) query = query.in("id", cityIds);
  if (filters.minAge != null) query = query.gte("age", filters.minAge);
  if (filters.maxAge != null) query = query.lte("age", filters.maxAge);
  if (filters.gender && filters.gender.length > 0) {
    query = query.in("gender", filters.gender);
  }
  if (matchCounts) query = query.in("id", [...matchCounts.keys()]);

  const { data, error } = await query;
  if (error) throw error;

  const counts = matchCounts;
  const results: SearchResult[] = (data ?? []).map((profile) => ({
    ...profile,
    commonInterestCount: counts?.get(profile.id) ?? 0,
  }));

  if (counts) {
    results.sort((a, b) => b.commonInterestCount - a.commonInterestCount);
  }

  return results;
}

export async function getInterestsForProfiles(
  supabase: Client,
  profileIds: string[]
): Promise<Map<string, number[]>> {
  if (profileIds.length === 0) return new Map();

  const { data, error } = await supabase
    .from("profile_interests")
    .select("profile_id, interest_id")
    .in("profile_id", profileIds);
  if (error) throw error;

  const map = new Map<string, number[]>();
  for (const row of data ?? []) {
    const list = map.get(row.profile_id) ?? [];
    list.push(row.interest_id);
    map.set(row.profile_id, list);
  }
  return map;
}
