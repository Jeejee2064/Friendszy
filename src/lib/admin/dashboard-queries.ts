import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

type Client = SupabaseClient<Database>;

export type DashboardKpis = {
  totalMembers: number;
  newMembersThisMonth: number;
  newMembersPrevMonth: number;
  newMembersLast24h: number;
  messagesToday: number;
  reportsPending: number;
  /** null = blocked by a missing admin RLS policy (see plan hand-off SQL) rather than a real zero. */
  activeGroupChats: number | null;
  friendsThisWeek: number | null;
  signupsLast30Days: { date: string; count: number }[];
  topCities: { city: string; count: number }[];
};

async function safeCount(
  promise: PromiseLike<{ count: number | null; error: unknown }>
): Promise<number | null> {
  try {
    const { count, error } = await promise;
    if (error) return null;
    return count ?? 0;
  } catch {
    return null;
  }
}

export async function getDashboardKpis(supabase: Client): Promise<DashboardKpis> {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [
    totalMembers,
    newMembersThisMonth,
    newMembersPrevMonth,
    newMembersLast24h,
    messagesToday1to1,
    messagesTodayGroup,
    reportsPending,
    friendsThisWeek,
    signupRows,
    cityRows,
    groupMessageRows,
  ] = await Promise.all([
    safeCount(supabase.from("profiles").select("*", { count: "exact", head: true })),
    safeCount(
      supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .gte("created_at", startOfThisMonth)
    ),
    safeCount(
      supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .gte("created_at", startOfPrevMonth)
        .lt("created_at", startOfThisMonth)
    ),
    safeCount(
      supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .gte("created_at", twentyFourHoursAgo)
    ),
    safeCount(
      supabase
        .from("messages")
        .select("*", { count: "exact", head: true })
        .gte("created_at", startOfToday)
    ),
    safeCount(
      supabase
        .from("group_messages")
        .select("*", { count: "exact", head: true })
        .gte("created_at", startOfToday)
    ),
    safeCount(
      supabase
        .from("reports")
        .select("*", { count: "exact", head: true })
        .in("status", ["open", "reviewing"])
    ),
    safeCount(
      supabase
        .from("friendships")
        .select("*", { count: "exact", head: true })
        .eq("status", "accepted")
        .gte("created_at", sevenDaysAgo)
    ),
    supabase
      .from("profiles")
      .select("created_at")
      .gte("created_at", thirtyDaysAgo)
      .then((r) => r.data ?? []),
    supabase
      .from("profiles")
      .select("city")
      .not("city", "is", null)
      .then((r) => r.data ?? []),
    Promise.resolve(
      supabase.from("group_messages").select("group_id").gte("created_at", sevenDaysAgo)
    )
      .then((r) => (r.error ? null : (r.data ?? [])))
      .catch(() => null),
  ]);

  const signupsByDay = new Map<string, number>();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    signupsByDay.set(d.toISOString().slice(0, 10), 0);
  }
  for (const row of signupRows) {
    const day = row.created_at.slice(0, 10);
    if (signupsByDay.has(day)) signupsByDay.set(day, (signupsByDay.get(day) ?? 0) + 1);
  }

  const cityCounts = new Map<string, number>();
  for (const row of cityRows) {
    if (!row.city) continue;
    cityCounts.set(row.city, (cityCounts.get(row.city) ?? 0) + 1);
  }
  const topCities = [...cityCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([city, count]) => ({ city, count }));

  const activeGroupChats =
    groupMessageRows === null ? null : new Set(groupMessageRows.map((r) => r.group_id)).size;

  return {
    totalMembers: totalMembers ?? 0,
    newMembersThisMonth: newMembersThisMonth ?? 0,
    newMembersPrevMonth: newMembersPrevMonth ?? 0,
    newMembersLast24h: newMembersLast24h ?? 0,
    messagesToday: (messagesToday1to1 ?? 0) + (messagesTodayGroup ?? 0),
    reportsPending: reportsPending ?? 0,
    activeGroupChats,
    friendsThisWeek,
    signupsLast30Days: [...signupsByDay.entries()].map(([date, count]) => ({ date, count })),
    topCities,
  };
}
