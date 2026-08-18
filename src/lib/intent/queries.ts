import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { getPublicMapPoints } from "@/lib/publicMap/queries";
import type { PendingIntent } from "./cookie";

type Client = SupabaseClient<Database>;

/**
 * Turns a raw `{kind, id}` intent (already parsed from the cookie) into a
 * real detail-page href, but only if that event/partner is still one of
 * the public points right now — re-checked against the same restricted RPC
 * the landing page itself uses, so an event that ended or a listing that
 * got deactivated in the meantime is treated the same as "no intent"
 * rather than sending the new user to a page they can't see.
 */
export async function resolveIntentHref(
  supabase: Client,
  intent: PendingIntent | null
): Promise<string | null> {
  if (!intent) return null;

  const points = await getPublicMapPoints(supabase);
  const stillPublic = points.some((p) => p.kind === intent.kind && p.id === intent.id);
  if (!stillPublic) return null;

  return intent.kind === "event" ? `/events/${intent.id}` : `/partners/${intent.id}`;
}
