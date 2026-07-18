import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

type Client = SupabaseClient<Database>;
export type ConversationRow = Database["public"]["Tables"]["conversations"]["Row"];
export type MessageRow = Database["public"]["Tables"]["messages"]["Row"];

export function orderPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

export async function getOrCreateConversation(
  supabase: Client,
  myId: string,
  otherId: string
): Promise<string> {
  const [user_a, user_b] = orderPair(myId, otherId);

  const { data: existing, error: selectError } = await supabase
    .from("conversations")
    .select("id")
    .eq("user_a", user_a)
    .eq("user_b", user_b)
    .maybeSingle();
  if (selectError) throw selectError;
  if (existing) return existing.id;

  const { data: created, error: insertError } = await supabase
    .from("conversations")
    .insert({ user_a, user_b })
    .select("id")
    .single();
  if (insertError) throw insertError;
  return created.id;
}

export async function listConversations(
  supabase: Client,
  myId: string
): Promise<ConversationRow[]> {
  const { data, error } = await supabase
    .from("conversations")
    .select("*")
    .or(`user_a.eq.${myId},user_b.eq.${myId}`)
    .order("last_message_at", { ascending: false, nullsFirst: false });
  if (error) throw error;
  return data ?? [];
}

export async function getUnreadCountsByConversation(
  supabase: Client,
  conversationIds: string[],
  myId: string
): Promise<Map<string, number>> {
  if (conversationIds.length === 0) return new Map();

  const { data, error } = await supabase
    .from("messages")
    .select("conversation_id")
    .in("conversation_id", conversationIds)
    .neq("sender_id", myId)
    .is("read_at", null);
  if (error) throw error;

  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    counts.set(row.conversation_id, (counts.get(row.conversation_id) ?? 0) + 1);
  }
  return counts;
}

export async function getUnreadConversationsCount(
  supabase: Client,
  myId: string
): Promise<number> {
  const { data, error } = await supabase
    .from("messages")
    .select("conversation_id")
    .neq("sender_id", myId)
    .is("read_at", null);
  if (error) throw error;

  return new Set((data ?? []).map((row) => row.conversation_id)).size;
}

export async function getLatestMessagesByConversation(
  supabase: Client,
  conversationIds: string[]
): Promise<Map<string, MessageRow>> {
  if (conversationIds.length === 0) return new Map();

  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .in("conversation_id", conversationIds)
    .is("removed_at", null)
    .order("created_at", { ascending: false });
  if (error) throw error;

  const map = new Map<string, MessageRow>();
  for (const message of data ?? []) {
    if (!map.has(message.conversation_id)) {
      map.set(message.conversation_id, message);
    }
  }
  return map;
}

export async function getMessagesByIds(
  supabase: Client,
  ids: string[]
): Promise<MessageRow[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase.from("messages").select("*").in("id", ids);
  if (error) throw error;
  return data ?? [];
}

export async function listMessages(
  supabase: Client,
  conversationId: string
): Promise<MessageRow[]> {
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function sendMessage(
  supabase: Client,
  conversationId: string,
  senderId: string,
  content: string
): Promise<MessageRow> {
  const { data, error } = await supabase
    .from("messages")
    .insert({ conversation_id: conversationId, sender_id: senderId, content })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function markConversationRead(
  supabase: Client,
  conversationId: string,
  myId: string
) {
  const { error } = await supabase
    .from("messages")
    .update({ read_at: new Date().toISOString() })
    .eq("conversation_id", conversationId)
    .neq("sender_id", myId)
    .is("read_at", null);
  if (error) throw error;
}
