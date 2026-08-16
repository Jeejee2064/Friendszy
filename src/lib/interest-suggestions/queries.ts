import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

type Client = SupabaseClient<Database>;

export type InterestSuggestionRow = Database["public"]["Tables"]["interest_suggestions"]["Row"];

export async function createInterestSuggestion(
  supabase: Client,
  suggestion: {
    suggestedBy: string;
    label: string;
    locale: "fr" | "en";
    category: string;
  }
) {
  const { error } = await supabase.from("interest_suggestions").insert({
    suggested_by: suggestion.suggestedBy,
    label: suggestion.label,
    locale: suggestion.locale,
    category: suggestion.category,
  });
  // Left to the caller to inspect (e.g. error.code === "23505" means this
  // user already has a pending suggestion) — unlike requestToJoinGroup's
  // silent no-op on the same error code, the caller here needs to surface a
  // clear message, since the user is actively trying to submit a different
  // suggestion and should know why it was rejected.
  if (error) throw error;
}

export async function countPendingInterestSuggestions(supabase: Client): Promise<number> {
  const { count, error } = await supabase
    .from("interest_suggestions")
    .select("*", { count: "exact", head: true })
    .eq("status", "pending");
  if (error) throw error;
  return count ?? 0;
}

export async function listPendingInterestSuggestions(
  supabase: Client
): Promise<InterestSuggestionRow[]> {
  const { data, error } = await supabase
    .from("interest_suggestions")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function approveInterestSuggestion(
  supabase: Client,
  suggestionId: string,
  adminId: string,
  resolvedLabelFr: string,
  resolvedLabelEn: string
) {
  const { error } = await supabase
    .from("interest_suggestions")
    .update({
      status: "approved",
      resolved_at: new Date().toISOString(),
      resolved_by: adminId,
      resolved_label_fr: resolvedLabelFr,
      resolved_label_en: resolvedLabelEn,
    })
    .eq("id", suggestionId);
  if (error) throw error;
}

export async function rejectInterestSuggestion(
  supabase: Client,
  suggestionId: string,
  adminId: string
) {
  const { error } = await supabase
    .from("interest_suggestions")
    .update({
      status: "rejected",
      resolved_at: new Date().toISOString(),
      resolved_by: adminId,
    })
    .eq("id", suggestionId);
  if (error) throw error;
}
