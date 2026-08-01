import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { getProfilesByIds } from "@/lib/profile/queries";
import type { ModerationStatus } from "./types";

type Client = SupabaseClient<Database>;

export type MemberRow = {
  id: string;
  full_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  city: string | null;
  age: number | null;
  moderation_status: ModerationStatus;
  created_at: string;
  last_seen_at: string | null;
};

export type RegisteredWithin = "7d" | "30d" | "90d" | "all";

export type MemberFilters = {
  search?: string;
  city?: string;
  registeredWithin?: RegisteredWithin;
  status?: ModerationStatus | "all";
};

function applyMemberFilters<T>(query: T, filters: MemberFilters): T {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- shared filter-building helper, reused for both the list query and the CSV export query
  let q = query as any;
  if (filters.search?.trim()) {
    const term = filters.search.trim().replace(/[,()]/g, "");
    q = q.or(`full_name.ilike.%${term}%,last_name.ilike.%${term}%,username.ilike.%${term}%`);
  }
  if (filters.city) q = q.eq("city", filters.city);
  if (filters.status && filters.status !== "all") q = q.eq("moderation_status", filters.status);
  if (filters.registeredWithin && filters.registeredWithin !== "all") {
    const days =
      filters.registeredWithin === "7d" ? 7 : filters.registeredWithin === "30d" ? 30 : 90;
    q = q.gte("created_at", new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString());
  }
  return q;
}

export async function listMembers(
  supabase: Client,
  filters: MemberFilters,
  limit = 200
): Promise<MemberRow[]> {
  const base = supabase
    .from("profiles")
    .select(
      "id, full_name, last_name, avatar_url, city, age, moderation_status, created_at, last_seen_at"
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  const { data, error } = await applyMemberFilters(base, filters);
  if (error) throw error;
  return (data ?? []) as MemberRow[];
}

export async function listDistinctCities(supabase: Client): Promise<string[]> {
  const { data, error } = await supabase.from("profiles").select("city").not("city", "is", null);
  if (error) throw error;
  return [...new Set((data ?? []).map((r) => r.city as string))].sort((a, b) =>
    a.localeCompare(b)
  );
}

/**
 * Reports received per user. Counts profile-target reports only (not
 * message-target reports resolved to their sender) — a deliberate scope cut
 * to avoid an extra full message-hydration pass just for a filter column;
 * the Moderation page already surfaces message-target reports in full.
 */
export async function getReportCountsByUser(supabase: Client): Promise<Map<string, number>> {
  const { data, error } = await supabase
    .from("reports")
    .select("target_id")
    .eq("target_type", "profile");
  if (error) throw error;
  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    counts.set(row.target_id, (counts.get(row.target_id) ?? 0) + 1);
  }
  return counts;
}

export async function getMessageCountsByUser(
  supabase: Client,
  userIds: string[]
): Promise<Map<string, number>> {
  if (userIds.length === 0) return new Map();
  const { data, error } = await supabase.from("messages").select("sender_id").in("sender_id", userIds);
  if (error) throw error;
  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    counts.set(row.sender_id, (counts.get(row.sender_id) ?? 0) + 1);
  }
  return counts;
}

/** null = blocked by the missing friendships admin RLS policy (see plan hand-off SQL). */
export async function getFriendCountsByUser(
  supabase: Client,
  userIds: string[]
): Promise<Map<string, number> | null> {
  if (userIds.length === 0) return new Map();
  try {
    const { data, error } = await supabase
      .from("friendships")
      .select("requester_id, addressee_id")
      .eq("status", "accepted")
      .or(`requester_id.in.(${userIds.join(",")}),addressee_id.in.(${userIds.join(",")})`);
    if (error) return null;
    const counts = new Map<string, number>();
    for (const row of data ?? []) {
      if (userIds.includes(row.requester_id))
        counts.set(row.requester_id, (counts.get(row.requester_id) ?? 0) + 1);
      if (userIds.includes(row.addressee_id))
        counts.set(row.addressee_id, (counts.get(row.addressee_id) ?? 0) + 1);
    }
    return counts;
  } catch {
    return null;
  }
}

export type MemberDetail = {
  bio: string | null;
  gender: string | null;
  interests: { id: number; label_fr: string; label_en: string; emoji: string | null }[];
  friends: { id: string; full_name: string | null; last_name: string | null }[] | null;
  groups: { id: string; name: string }[] | null;
  reportsReceived: { id: string; reason: string | null; created_at: string; status: string }[];
};

export async function getMemberDetail(supabase: Client, userId: string): Promise<MemberDetail> {
  const [{ data: profileRow }, { data: interestRows }, reportsReceived] = await Promise.all([
    supabase.from("profiles").select("bio, gender").eq("id", userId).maybeSingle(),
    supabase
      .from("profile_interests")
      .select("interests(id, label_fr, label_en, emoji)")
      .eq("profile_id", userId),
    supabase
      .from("reports")
      .select("id, reason, created_at, status")
      .eq("target_type", "profile")
      .eq("target_id", userId)
      .order("created_at", { ascending: false })
      .then((r) => r.data ?? []),
  ]);

  let friends: MemberDetail["friends"] = null;
  let groups: MemberDetail["groups"] = null;

  try {
    const { data, error } = await supabase
      .from("friendships")
      .select("requester_id, addressee_id")
      .eq("status", "accepted")
      .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);
    if (!error) {
      const otherIds = (data ?? []).map((row) =>
        row.requester_id === userId ? row.addressee_id : row.requester_id
      );
      const profiles = await getProfilesByIds(supabase, otherIds);
      friends = profiles.map((p) => ({
        id: p.id,
        full_name: p.full_name,
        last_name: p.last_name,
      }));
    }
  } catch {
    friends = null;
  }

  try {
    const { data, error } = await supabase
      .from("group_members")
      .select("groups(id, name)")
      .eq("profile_id", userId)
      .eq("status", "active");
    if (!error) {
      groups = (data ?? [])
        .map((row) => (Array.isArray(row.groups) ? row.groups[0] : row.groups))
        .filter((g): g is { id: string; name: string } => !!g);
    }
  } catch {
    groups = null;
  }

  return {
    bio: profileRow?.bio ?? null,
    gender: profileRow?.gender ?? null,
    interests: (interestRows ?? [])
      .map((row) => (Array.isArray(row.interests) ? row.interests[0] : row.interests))
      .filter((i): i is MemberDetail["interests"][number] => !!i),
    friends,
    groups,
    reportsReceived,
  };
}
