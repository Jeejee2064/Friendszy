import type { Database } from "@/types/supabase";
import type { Interest, ProfileSummary } from "@/lib/profile/types";

export type GroupRow = Database["public"]["Tables"]["groups"]["Row"];
export type GroupMemberRow = Database["public"]["Tables"]["group_members"]["Row"];
export type GroupMessageRow = Database["public"]["Tables"]["group_messages"]["Row"];
export type GroupJoinRequestRow =
  Database["public"]["Tables"]["group_join_requests"]["Row"];

export type GroupMemberRole = "creator" | "admin" | "member";
export type GroupMemberStatus = "active" | "left" | "excluded" | "banned";
export type GroupInvitePermission = "all_members" | "admins_only";

// Composed client-side — this codebase never does embedded-relationship queries.
export type GroupCardData = GroupRow & {
  interest: Interest | null;
  memberCount: number;
  myStatus: GroupMemberStatus | null; // null = never a member
  myPendingJoinRequest: boolean;
};

export type GroupMemberWithProfile = GroupMemberRow & { profile: ProfileSummary };

// Lightweight lookup used by notification rendering — not the full GroupRow.
export type GroupSummary = {
  id: string;
  name: string;
  avatar_url: string | null;
};
