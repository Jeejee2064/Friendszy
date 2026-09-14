import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import type { GroupMessageRow, GroupMessageReactionRow } from "./types";

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
  content: string,
  replyToId?: string | null
): Promise<GroupMessageRow> {
  const { data, error } = await supabase
    .from("group_messages")
    .insert({
      group_id: groupId,
      sender_id: senderId,
      content,
      reply_to_id: replyToId ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function listGroupMessageReactions(
  supabase: Client,
  groupId: string
): Promise<GroupMessageReactionRow[]> {
  const { data, error } = await supabase
    .from("group_message_reactions")
    .select("*")
    .eq("group_id", groupId);
  if (error) throw error;
  return data ?? [];
}

// Une seule réaction active par personne et par message : poser un nouvel
// emoji remplace le précédent (upsert sur la contrainte unique
// message_id+user_id, voir la migration).
export async function setGroupMessageReaction(
  supabase: Client,
  messageId: string,
  userId: string,
  emoji: string
): Promise<GroupMessageReactionRow> {
  const { data, error } = await supabase
    .from("group_message_reactions")
    .upsert(
      // group_id est posé côté serveur par le trigger
      // set_group_message_reaction_group_id (voir la migration), jamais
      // par le client — `as never` contourne l'exigence du type Insert
      // généré (colonne NOT NULL sans défaut, la CLI ne sait pas qu'un
      // trigger la remplit).
      { message_id: messageId, user_id: userId, emoji } as never,
      { onConflict: "message_id,user_id" }
    )
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function removeGroupMessageReaction(
  supabase: Client,
  messageId: string,
  userId: string
) {
  const { error } = await supabase
    .from("group_message_reactions")
    .delete()
    .eq("message_id", messageId)
    .eq("user_id", userId);
  if (error) throw error;
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
