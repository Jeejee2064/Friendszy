import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

type Client = SupabaseClient<Database>;

export type ReportRow = Database["public"]["Tables"]["reports"]["Row"];
export type ReportStatus = "open" | "reviewing" | "resolved" | "dismissed";

export async function createReport(
  supabase: Client,
  reporterId: string,
  targetType: "profile" | "message" | "partner_listing",
  targetId: string,
  reason: string
) {
  const { error } = await supabase.from("reports").insert({
    reporter_id: reporterId,
    target_type: targetType,
    target_id: targetId,
    reason,
  });
  if (error) throw error;
}

export async function countOpenReports(supabase: Client): Promise<number> {
  const { count, error } = await supabase
    .from("reports")
    .select("*", { count: "exact", head: true })
    .in("status", ["open", "reviewing"]);
  if (error) throw error;
  return count ?? 0;
}

export async function listOpenReports(supabase: Client): Promise<ReportRow[]> {
  const { data, error } = await supabase
    .from("reports")
    .select("*")
    .in("status", ["open", "reviewing"])
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function listAllReports(supabase: Client, limit = 200): Promise<ReportRow[]> {
  const { data, error } = await supabase
    .from("reports")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function updateReportStatus(
  supabase: Client,
  reportId: string,
  status: Exclude<ReportStatus, "open" | "reviewing">,
  resolvedBy: string
) {
  const { error } = await supabase
    .from("reports")
    .update({ status, resolved_at: new Date().toISOString(), resolved_by: resolvedBy })
    .eq("id", reportId);
  if (error) throw error;
}
