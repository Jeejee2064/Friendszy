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

  const blockedProfiles = await listBlockedProfiles(supabase);
  const blockedIds = blockedProfiles.map((row) => row.id);

  let query = supabase
    .from("profiles")
    .select("id, full_name, avatar_url, city, age, gender")
    .neq("id", excludeUserId)
    .limit(30);

  if (blockedIds.length > 0) query = query.not("id", "in", `(${blockedIds.join(",")})`);
  if (filters.name) {
    query = query.or(
      `full_name.ilike.%${filters.name}%,username.ilike.%${filters.name}%`
    );
  }
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
