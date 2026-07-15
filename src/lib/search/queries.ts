import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import type { ProfileSummary } from "@/lib/profile/types";

type Client = SupabaseClient<Database>;

export type SearchFilters = {
  name?: string;
  city?: string;
  minAge?: number;
  maxAge?: number;
  gender?: string;
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

  let query = supabase
    .from("profiles")
    .select("id, full_name, avatar_url, city, age, gender")
    .neq("id", excludeUserId)
    .limit(30);

  if (filters.name) {
    query = query.or(
      `full_name.ilike.%${filters.name}%,username.ilike.%${filters.name}%`
    );
  }
  if (filters.city) query = query.ilike("city", `%${filters.city}%`);
  if (filters.minAge != null) query = query.gte("age", filters.minAge);
  if (filters.maxAge != null) query = query.lte("age", filters.maxAge);
  if (filters.gender) query = query.eq("gender", filters.gender);
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
