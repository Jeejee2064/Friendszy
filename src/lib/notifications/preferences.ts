import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

type Client = SupabaseClient<Database>;

export type NotificationPreferences = {
  push_messages: boolean;
  push_social: boolean;
  push_groups: boolean;
  push_events: boolean;
  quiet_start: string | null; // "HH:MM"
  quiet_end: string | null;
};

export const DEFAULT_PREFERENCES: NotificationPreferences = {
  push_messages: true,
  push_social: true,
  push_groups: true,
  push_events: true,
  quiet_start: null,
  quiet_end: null,
};

const hhmm = (value: string | null) => (value ? value.slice(0, 5) : null);

// Pas de ligne = tout activé, pas d'heures calmes (même règle que l'Edge Function).
export async function getNotificationPreferences(
  supabase: Client,
  userId: string
): Promise<NotificationPreferences> {
  const { data, error } = await supabase
    .from("notification_preferences")
    .select("push_messages, push_social, push_groups, push_events, quiet_start, quiet_end")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return DEFAULT_PREFERENCES;
  return { ...data, quiet_start: hhmm(data.quiet_start), quiet_end: hhmm(data.quiet_end) };
}

export async function saveNotificationPreferences(
  supabase: Client,
  userId: string,
  prefs: NotificationPreferences
) {
  const { error } = await supabase.from("notification_preferences").upsert({
    user_id: userId,
    ...prefs,
    // Les heures calmes sont lues dans le fuseau de l'appareil qui les règle.
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Toronto",
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}
