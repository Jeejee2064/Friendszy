import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { getProfilesByIds } from "@/lib/profile/queries";
import type { ProfileSummary } from "@/lib/profile/types";
import { getMessagesByIds, type MessageRow } from "@/lib/messages/queries";
import { listOpenReports, listAllReports, type ReportRow } from "@/lib/reports/queries";
import { getPartnerListingsByIds, type PartnerListingRow } from "@/lib/partners/queries";
import { listPendingInterestSuggestions } from "@/lib/interest-suggestions/queries";
import type { Interest } from "@/lib/profile/types";
import type { ModerationStatus, ReportWithTarget, InterestSuggestionWithProfile } from "./types";

type Client = SupabaseClient<Database>;

async function getModerationStatuses(
  supabase: Client,
  ids: string[]
): Promise<Map<string, ModerationStatus>> {
  if (ids.length === 0) return new Map();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, moderation_status")
    .in("id", ids);
  if (error) throw error;
  return new Map(
    (data ?? []).map((row) => [row.id, row.moderation_status as ModerationStatus])
  );
}

async function getProfileCreatedAtMap(
  supabase: Client,
  ids: string[]
): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const { data, error } = await supabase.from("profiles").select("id, created_at").in("id", ids);
  if (error) throw error;
  return new Map((data ?? []).map((row) => [row.id, row.created_at]));
}

async function hydrateReports(
  supabase: Client,
  reports: ReportRow[]
): Promise<ReportWithTarget[]> {
  const profileTargetIds = reports
    .filter((r) => r.target_type === "profile")
    .map((r) => r.target_id);
  const messageTargetIds = reports
    .filter((r) => r.target_type === "message")
    .map((r) => r.target_id);
  const partnerListingTargetIds = reports
    .filter((r) => r.target_type === "partner_listing")
    .map((r) => r.target_id);
  const reporterIds = [
    ...new Set(reports.map((r) => r.reporter_id).filter((v): v is string => !!v)),
  ];

  const [targetProfiles, targetMessages, targetPartnerListings, reporterProfiles] =
    await Promise.all([
      getProfilesByIds(supabase, profileTargetIds),
      getMessagesByIds(supabase, messageTargetIds),
      getPartnerListingsByIds(supabase, partnerListingTargetIds),
      getProfilesByIds(supabase, reporterIds),
    ]);

  const senderIds = [...new Set(targetMessages.map((m) => m.sender_id))];
  const listingCreatorIds = [
    ...new Set(
      targetPartnerListings.map((l) => l.profile_id).filter((v): v is string => !!v)
    ),
  ];
  const [senderProfiles, listingCreatorProfiles] = await Promise.all([
    getProfilesByIds(supabase, senderIds),
    getProfilesByIds(supabase, listingCreatorIds),
  ]);
  const relevantIds = [...profileTargetIds, ...senderIds];
  const [moderationStatusById, createdAtById] = await Promise.all([
    getModerationStatuses(supabase, relevantIds),
    getProfileCreatedAtMap(supabase, relevantIds),
  ]);

  const profileById = new Map<string, ProfileSummary>(
    targetProfiles.map((p) => [p.id, p])
  );
  const reporterById = new Map<string, ProfileSummary>(
    reporterProfiles.map((p) => [p.id, p])
  );
  const senderById = new Map<string, ProfileSummary>(senderProfiles.map((p) => [p.id, p]));
  const messageById = new Map<string, MessageRow>(targetMessages.map((m) => [m.id, m]));
  const listingCreatorById = new Map<string, ProfileSummary>(
    listingCreatorProfiles.map((p) => [p.id, p])
  );
  const listingById = new Map<string, PartnerListingRow>(
    targetPartnerListings.map((l) => [l.id, l])
  );

  return reports.map((report) => {
    const reporterProfile = report.reporter_id
      ? (reporterById.get(report.reporter_id) ?? null)
      : null;

    if (report.target_type === "profile") {
      return {
        ...report,
        reporterProfile,
        targetProfile: profileById.get(report.target_id) ?? null,
        targetMessage: null,
        targetPartnerListing: null,
        targetModerationStatus: moderationStatusById.get(report.target_id) ?? null,
        targetCreatedAt: createdAtById.get(report.target_id) ?? null,
      };
    }

    if (report.target_type === "message") {
      const message = messageById.get(report.target_id);
      return {
        ...report,
        reporterProfile,
        targetProfile: null,
        targetMessage: message
          ? { ...message, senderProfile: senderById.get(message.sender_id) ?? null }
          : null,
        targetPartnerListing: null,
        targetModerationStatus: message
          ? (moderationStatusById.get(message.sender_id) ?? null)
          : null,
        targetCreatedAt: message ? (createdAtById.get(message.sender_id) ?? null) : null,
      };
    }

    if (report.target_type === "partner_listing") {
      const listing = listingById.get(report.target_id);
      return {
        ...report,
        reporterProfile,
        targetProfile: null,
        targetMessage: null,
        targetPartnerListing: listing
          ? { ...listing, creatorProfile: listing.profile_id ? (listingCreatorById.get(listing.profile_id) ?? null) : null }
          : null,
        targetModerationStatus: null,
        targetCreatedAt: null,
      };
    }

    return {
      ...report,
      reporterProfile,
      targetProfile: null,
      targetMessage: null,
      targetPartnerListing: null,
      targetModerationStatus: null,
      targetCreatedAt: null,
    };
  });
}

export async function listOpenReportsWithTargets(
  supabase: Client
): Promise<ReportWithTarget[]> {
  const reports = await listOpenReports(supabase);
  return hydrateReports(supabase, reports);
}

export async function listAllReportsWithTargets(
  supabase: Client,
  limit = 200
): Promise<ReportWithTarget[]> {
  const reports = await listAllReports(supabase, limit);
  return hydrateReports(supabase, reports);
}

export async function listPendingInterestSuggestionsWithProfiles(
  supabase: Client
): Promise<InterestSuggestionWithProfile[]> {
  const suggestions = await listPendingInterestSuggestions(supabase);
  const suggesterIds = [...new Set(suggestions.map((s) => s.suggested_by))];
  const suggesterProfiles = await getProfilesByIds(supabase, suggesterIds);
  const suggesterById = new Map(suggesterProfiles.map((p) => [p.id, p]));

  return suggestions.map((suggestion) => ({
    ...suggestion,
    suggesterProfile: suggesterById.get(suggestion.suggested_by) ?? null,
  }));
}

export type AdminActionRow = Database["public"]["Tables"]["admin_actions"]["Row"];
export type AdminActionWithNames = AdminActionRow & {
  adminProfile: ProfileSummary | null;
  targetProfile: ProfileSummary | null;
};

export async function listAdminActions(
  supabase: Client,
  limit = 200
): Promise<AdminActionWithNames[]> {
  const { data, error } = await supabase
    .from("admin_actions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  const actions = data ?? [];

  const adminIds = [...new Set(actions.map((a) => a.admin_id))];
  const profileTargetIds = [
    ...new Set(actions.filter((a) => a.target_type === "profile").map((a) => a.target_id)),
  ];

  const [adminProfiles, targetProfiles] = await Promise.all([
    getProfilesByIds(supabase, adminIds),
    getProfilesByIds(supabase, profileTargetIds),
  ]);
  const adminById = new Map(adminProfiles.map((p) => [p.id, p]));
  const targetById = new Map(targetProfiles.map((p) => [p.id, p]));

  return actions.map((a) => ({
    ...a,
    adminProfile: adminById.get(a.admin_id) ?? null,
    targetProfile: a.target_type === "profile" ? (targetById.get(a.target_id) ?? null) : null,
  }));
}

export async function setModerationStatus(
  supabase: Client,
  targetUserId: string,
  status: ModerationStatus
) {
  const { error } = await supabase
    .from("profiles")
    .update({ moderation_status: status })
    .eq("id", targetUserId);
  if (error) throw error;
}

/**
 * Best-effort: a failed audit-log write shouldn't surface as an error on an
 * otherwise-successful moderation action, so callers should not await this
 * inline with the primary action's error handling.
 */
export async function logAdminAction(
  supabase: Client,
  params: {
    adminId: string;
    actionType: string;
    targetType: string;
    targetId: string;
    reason?: string;
  }
) {
  const { error } = await supabase.from("admin_actions").insert({
    admin_id: params.adminId,
    action_type: params.actionType,
    target_type: params.targetType,
    target_id: params.targetId,
    reason: params.reason ?? null,
  });
  if (error) throw error;
}

export async function removeMessageAsAdmin(
  supabase: Client,
  messageId: string,
  adminId: string
) {
  const { error } = await supabase
    .from("messages")
    .update({ removed_at: new Date().toISOString(), removed_by: adminId })
    .eq("id", messageId);
  if (error) throw error;
}

// Manual catalogue management (create/edit/delete interests directly, not
// via a suggestion) — allowed for admins only by RLS
// (interests_insert_admin/interests_update_admin/interests_delete_admin).
export async function createInterest(
  supabase: Client,
  interest: { slug: string; labelFr: string; labelEn: string; category: string; emoji: string | null }
): Promise<Interest> {
  const { data, error } = await supabase
    .from("interests")
    .insert({
      slug: interest.slug,
      label_fr: interest.labelFr,
      label_en: interest.labelEn,
      category: interest.category,
      emoji: interest.emoji,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function updateInterest(
  supabase: Client,
  interestId: number,
  interest: { slug: string; labelFr: string; labelEn: string; category: string; emoji: string | null }
): Promise<Interest> {
  const { data, error } = await supabase
    .from("interests")
    .update({
      slug: interest.slug,
      label_fr: interest.labelFr,
      label_en: interest.labelEn,
      category: interest.category,
      emoji: interest.emoji,
    })
    .eq("id", interestId)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

/**
 * Throws with a Postgres error code of "23503" (foreign_key_violation) if the
 * interest is still referenced (profile_interests, groups, events,
 * partner_listings) — those FKs have no ON DELETE cascade on purpose.
 */
export async function deleteInterest(supabase: Client, interestId: number) {
  const { error } = await supabase.from("interests").delete().eq("id", interestId);
  if (error) throw error;
}
