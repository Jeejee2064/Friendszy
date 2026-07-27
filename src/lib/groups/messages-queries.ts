import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import type { GroupMessageRow } from "./types";

type Client = SupabaseClient<Database>;

export async function listGroupMessages(
  supabase: Client,
  groupId: string
): Promise<GroupMessageRow[]> {
  const { data, error } = await supabase
    .from("group_messages")
    .select("*")
    .eq("group_id", groupId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function sendGroupMessage(
  supabase: Client,
  groupId: string,
  senderId: string,
  content: string
): Promise<GroupMessageRow> {
  const { data, error } = await supabase
    .from("group_messages")
    .insert({ group_id: groupId, sender_id: senderId, content })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function getLatestMessagesByGroup(
  supabase: Client,
  groupIds: string[]
): Promise<Map<string, GroupMessageRow>> {
  if (groupIds.length === 0) return new Map();

  const { data, error } = await supabase
    .from("group_messages")
    .select("*")
    .in("group_id", groupIds)
    .is("removed_at", null)
    .order("created_at", { ascending: false });
  if (error) throw error;

  const map = new Map<string, GroupMessageRow>();
  for (const message of data ?? []) {
    if (!map.has(message.group_id)) {
      map.set(message.group_id, message);
    }
  }
  return map;
}
