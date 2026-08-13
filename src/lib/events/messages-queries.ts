import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import type { EventMessageRow } from "./types";

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
  content: string
): Promise<EventMessageRow> {
  const { data, error } = await supabase
    .from("event_messages")
    .insert({ event_id: eventId, sender_id: senderId, content })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}
