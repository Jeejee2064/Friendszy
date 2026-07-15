import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { getProfilesByIds } from "@/lib/profile/queries";
import type { ProfileSummary } from "@/lib/profile/types";
import { getMessagesByIds, type MessageRow } from "@/lib/messages/queries";
import { listOpenReports } from "@/lib/reports/queries";
import type { ModerationStatus, ReportWithTarget } from "./types";

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

export async function listOpenReportsWithTargets(
  supabase: Client
): Promise<ReportWithTarget[]> {
  const reports = await listOpenReports(supabase);

  const profileTargetIds = reports
    .filter((r) => r.target_type === "profile")
    .map((r) => r.target_id);
  const messageTargetIds = reports
    .filter((r) => r.target_type === "message")
    .map((r) => r.target_id);
  const reporterIds = [
    ...new Set(reports.map((r) => r.reporter_id).filter((v): v is string => !!v)),
  ];

  const [targetProfiles, targetMessages, reporterProfiles] = await Promise.all([
    getProfilesByIds(supabase, profileTargetIds),
    getMessagesByIds(supabase, messageTargetIds),
    getProfilesByIds(supabase, reporterIds),
  ]);

  const senderIds = [...new Set(targetMessages.map((m) => m.sender_id))];
  const senderProfiles = await getProfilesByIds(supabase, senderIds);
  const moderationStatusById = await getModerationStatuses(supabase, [
    ...profileTargetIds,
    ...senderIds,
  ]);

  const profileById = new Map<string, ProfileSummary>(
    targetProfiles.map((p) => [p.id, p])
  );
  const reporterById = new Map<string, ProfileSummary>(
    reporterProfiles.map((p) => [p.id, p])
  );
  const senderById = new Map<string, ProfileSummary>(senderProfiles.map((p) => [p.id, p]));
  const messageById = new Map<string, MessageRow>(targetMessages.map((m) => [m.id, m]));

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
        targetModerationStatus: moderationStatusById.get(report.target_id) ?? null,
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
        targetModerationStatus: message
          ? (moderationStatusById.get(message.sender_id) ?? null)
          : null,
      };
    }

    return {
      ...report,
      reporterProfile,
      targetProfile: null,
      targetMessage: null,
      targetModerationStatus: null,
    };
  });
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
