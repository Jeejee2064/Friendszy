import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import type { EventMessageRow, EventMessageReactionRow } from "./types";

type Client = SupabaseClient<Database>;

export async function listEventMessages(
  supabase: Client,
  eventId: string
): Promise<EventMessageRow[]> {
  const { data, error } = await supabase
    .from("event_messages")
    .select("*")
    .eq("event_id", eventId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function sendEventMessage(
  supabase: Client,
  eventId: string,
  senderId: string,
  content: string,
  replyToId?: string | null
): Promise<EventMessageRow> {
  const { data, error } = await supabase
    .from("event_messages")
    .insert({
      event_id: eventId,
      sender_id: senderId,
      content,
      reply_to_id: replyToId ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function listEventMessageReactions(
  supabase: Client,
  eventId: string
): Promise<EventMessageReactionRow[]> {
  const { data, error } = await supabase
    .from("event_message_reactions")
    .select("*")
    .eq("event_id", eventId);
  if (error) throw error;
  return data ?? [];
}

// Une seule réaction active par personne et par message : poser un nouvel
// emoji remplace le précédent (upsert sur la contrainte unique
// message_id+user_id, voir la migration).
export async function setEventMessageReaction(
  supabase: Client,
  messageId: string,
  userId: string,
  emoji: string
): Promise<EventMessageReactionRow> {
  const { data, error } = await supabase
    .from("event_message_reactions")
    .upsert(
      // event_id est posé côté serveur par le trigger
      // set_event_message_reaction_event_id (voir la migration), jamais
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

export async function removeEventMessageReaction(
  supabase: Client,
  messageId: string,
  userId: string
) {
  const { error } = await supabase
    .from("event_message_reactions")
    .delete()
    .eq("message_id", messageId)
    .eq("user_id", userId);
  if (error) throw error;
}
