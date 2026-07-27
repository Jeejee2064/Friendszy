import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import type {
  GroupRow,
  GroupMemberRow,
  GroupJoinRequestRow,
  GroupMemberStatus,
  GroupInvitePermission,
  GroupSummary,
} from "./types";

type Client = SupabaseClient<Database>;

export async function createGroup(
  supabase: Client,
  fields: {
    id?: string;
    name: string;
    description: string | null;
    avatar_url: string | null;
    interest_id: number;
    invite_permission: GroupInvitePermission;
  },
  creatorId: string
): Promise<GroupRow> {
  const { data: group, error: groupError } = await supabase
    .from("groups")
    .insert({ ...fields, creator_id: creatorId })
    .select("*")
    .single();
  if (groupError) throw groupError;

  const { error: memberError } = await supabase.from("group_members").insert({
    group_id: group.id,
    profile_id: creatorId,
    role: "creator",
    status: "active",
  });
  if (memberError) throw memberError;

  return group;
}

export async function getGroupById(
  supabase: Client,
  groupId: string
): Promise<GroupRow | null> {
  const { data, error } = await supabase
    .from("groups")
    .select("*")
    .eq("id", groupId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getGroupsByIds(
  supabase: Client,
  ids: string[]
): Promise<GroupRow[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase.from("groups").select("*").in("id", ids);
  if (error) throw error;
  return data ?? [];
}

// Minimal shape for notification rendering — not the full row.
export async function getGroupSummariesByIds(
  supabase: Client,
  ids: string[]
): Promise<Map<string, GroupSummary>> {
  if (ids.length === 0) return new Map();
  const { data, error } = await supabase
    .from("groups")
    .select("id, name, avatar_url")
    .in("id", ids);
  if (error) throw error;
  return new Map((data ?? []).map((g) => [g.id, g]));
}

export async function listGroups(
  supabase: Client,
  filters: { name?: string; interestId?: number }
): Promise<GroupRow[]> {
  let query = supabase
    .from("groups")
    .select("*")
    .order("created_at", { ascending: false });
  if (filters.name) query = query.ilike("name", `%${filters.name}%`);
  if (filters.interestId != null) query = query.eq("interest_id", filters.interestId);

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function getMemberCountsByGroup(
  supabase: Client,
  groupIds: string[]
): Promise<Map<string, number>> {
  if (groupIds.length === 0) return new Map();
  const { data, error } = await supabase
    .from("group_members")
    .select("group_id")
    .eq("status", "active")
    .in("group_id", groupIds);
  if (error) throw error;

  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    counts.set(row.group_id, (counts.get(row.group_id) ?? 0) + 1);
  }
  return counts;
}

export async function getMyMembershipMap(
  supabase: Client,
  groupIds: string[],
  myId: string
): Promise<Map<string, GroupMemberRow>> {
  if (groupIds.length === 0) return new Map();
  const { data, error } = await supabase
    .from("group_members")
    .select("*")
    .eq("profile_id", myId)
    .in("group_id", groupIds);
  if (error) throw error;
  return new Map((data ?? []).map((row) => [row.group_id, row]));
}

export async function getMyPendingJoinRequestGroupIds(
  supabase: Client,
  groupIds: string[],
  myId: string
): Promise<Set<string>> {
  if (groupIds.length === 0) return new Set();
  const { data, error } = await supabase
    .from("group_join_requests")
    .select("group_id")
    .eq("profile_id", myId)
    .eq("status", "pending")
    .in("group_id", groupIds);
  if (error) throw error;
  return new Set((data ?? []).map((row) => row.group_id));
}

export async function listMyGroups(
  supabase: Client,
  myId: string
): Promise<GroupMemberRow[]> {
  const { data, error } = await supabase
    .from("group_members")
    .select("*")
    .eq("profile_id", myId)
    .eq("status", "active");
  if (error) throw error;
  return data ?? [];
}

export async function getGroupMembers(
  supabase: Client,
  groupId: string,
  statuses: GroupMemberStatus[] = ["active"]
): Promise<GroupMemberRow[]> {
  const { data, error } = await supabase
    .from("group_members")
    .select("*")
    .eq("group_id", groupId)
    .in("status", statuses);
  if (error) throw error;
  return data ?? [];
}

export async function getMyGroupMembership(
  supabase: Client,
  groupId: string,
  myId: string
): Promise<GroupMemberRow | null> {
  const { data, error } = await supabase
    .from("group_members")
    .select("*")
    .eq("group_id", groupId)
    .eq("profile_id", myId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function canInviteToGroup(
  supabase: Client,
  groupId: string
): Promise<boolean> {
  const { data, error } = await supabase.rpc("can_invite_to_group", {
    p_group_id: groupId,
  });
  if (error) throw error;
  return !!data;
}

export async function isGroupAdmin(supabase: Client, groupId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("is_group_admin", { p_group_id: groupId });
  if (error) throw error;
  return !!data;
}

export async function isGroupCreator(
  supabase: Client,
  groupId: string
): Promise<boolean> {
  const { data, error } = await supabase.rpc("is_group_creator", {
    p_group_id: groupId,
  });
  if (error) throw error;
  return !!data;
}

export class BannedFromGroupError extends Error {
  constructor() {
    super("This person has been banned from the group and cannot be re-added.");
    this.name = "BannedFromGroupError";
  }
}

// Backs both the invite-picker's "Invite" action and member-management's
// "Re-admit" action — same underlying operation either way.
export async function addOrReactivateGroupMember(
  supabase: Client,
  groupId: string,
  profileId: string
) {
  const { data: existing, error: fetchError } = await supabase
    .from("group_members")
    .select("status")
    .eq("group_id", groupId)
    .eq("profile_id", profileId)
    .maybeSingle();
  if (fetchError) throw fetchError;

  if (!existing) {
    const { error } = await supabase.from("group_members").insert({
      group_id: groupId,
      profile_id: profileId,
      role: "member",
      status: "active",
    });
    if (error) throw error;
    return;
  }

  if (existing.status === "banned") throw new BannedFromGroupError();
  if (existing.status === "active") return;

  const { error } = await supabase
    .from("group_members")
    .update({ status: "active" })
    .eq("group_id", groupId)
    .eq("profile_id", profileId);
  if (error) throw error;
}

export async function setGroupMemberRole(
  supabase: Client,
  groupId: string,
  profileId: string,
  role: "admin" | "member"
) {
  const { error } = await supabase
    .from("group_members")
    .update({ role })
    .eq("group_id", groupId)
    .eq("profile_id", profileId);
  if (error) throw error;
}

export async function excludeGroupMember(
  supabase: Client,
  groupId: string,
  profileId: string
) {
  const { error } = await supabase
    .from("group_members")
    .update({ status: "excluded" })
    .eq("group_id", groupId)
    .eq("profile_id", profileId);
  if (error) throw error;
}

export async function banGroupMember(
  supabase: Client,
  groupId: string,
  profileId: string
) {
  const { error } = await supabase
    .from("group_members")
    .update({ status: "banned" })
    .eq("group_id", groupId)
    .eq("profile_id", profileId);
  if (error) throw error;
}

export async function leaveGroup(supabase: Client, groupId: string, myId: string) {
  const { error } = await supabase
    .from("group_members")
    .update({ status: "left" })
    .eq("group_id", groupId)
    .eq("profile_id", myId);
  if (error) throw error;
}

export async function requestToJoinGroup(
  supabase: Client,
  groupId: string,
  myId: string
): Promise<void> {
  const { error } = await supabase
    .from("group_join_requests")
    .insert({ group_id: groupId, profile_id: myId });
  if (error) {
    // Unique violation = an identical pending request already exists — no-op.
    if (error.code === "23505") return;
    throw error;
  }
}

export async function listPendingJoinRequests(
  supabase: Client,
  groupId: string
): Promise<GroupJoinRequestRow[]> {
  const { data, error } = await supabase
    .from("group_join_requests")
    .select("*")
    .eq("group_id", groupId)
    .eq("status", "pending")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function approveJoinRequest(supabase: Client, requestId: string) {
  const { error } = await supabase
    .from("group_join_requests")
    .update({ status: "approved" })
    .eq("id", requestId);
  if (error) throw error;
}

export async function rejectJoinRequest(supabase: Client, requestId: string) {
  const { error } = await supabase
    .from("group_join_requests")
    .update({ status: "rejected" })
    .eq("id", requestId);
  if (error) throw error;
}

export async function updateGroupSettings(
  supabase: Client,
  groupId: string,
  fields: Partial<{
    name: string;
    description: string | null;
    avatar_url: string | null;
    interest_id: number;
    invite_permission: GroupInvitePermission;
  }>
) {
  // No DB trigger keeps `updated_at` current for this table — set it explicitly.
  const { error } = await supabase
    .from("groups")
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq("id", groupId);
  if (error) throw error;
}

export async function deleteGroup(supabase: Client, groupId: string) {
  const { error } = await supabase.from("groups").delete().eq("id", groupId);
  if (error) throw error;
}

export async function uploadGroupAvatar(
  supabase: Client,
  groupId: string,
  blob: Blob
): Promise<string> {
  const path = `${groupId}/avatar.jpg`;
  const { error } = await supabase.storage.from("group-avatars").upload(path, blob, {
    upsert: true,
    contentType: "image/jpeg",
  });
  if (error) throw error;

  const { data } = supabase.storage.from("group-avatars").getPublicUrl(path);
  return `${data.publicUrl}?v=${Date.now()}`;
}

// Group admins (not just platform admins) can soft-remove a group message —
// confirmed by the RLS/trigger allowing admin updates limited to
// removed_at/removed_by, never the content itself.
export async function removeGroupMessage(
  supabase: Client,
  messageId: string,
  adminId: string
) {
  const { error } = await supabase
    .from("group_messages")
    .update({ removed_at: new Date().toISOString(), removed_by: adminId })
    .eq("id", messageId);
  if (error) throw error;
}
