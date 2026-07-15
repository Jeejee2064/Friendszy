import type { ProfileSummary } from "@/lib/profile/types";
import type { MessageRow } from "@/lib/messages/queries";
import type { ReportRow } from "@/lib/reports/queries";

export type ModerationStatus = "active" | "suspended" | "banned";

export type ReportWithTarget = ReportRow & {
  reporterProfile: ProfileSummary | null;
  targetProfile: ProfileSummary | null;
  targetMessage: (MessageRow & { senderProfile: ProfileSummary | null }) | null;
  /** moderation_status of the reported user (profile target, or message sender) */
  targetModerationStatus: ModerationStatus | null;
};
