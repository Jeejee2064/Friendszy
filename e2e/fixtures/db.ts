import { createClient } from "@supabase/supabase-js";
import ws from "ws";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SECRET_KEY!;

if (!SUPABASE_URL || !SERVICE_KEY) {
  throw new Error(
    "Il manque NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SECRET_KEY dans .env.local pour les fixtures e2e."
  );
}

// service_role — usage Node uniquement, jamais exposé au navigateur (voir CLAUDE.md).
const adminClient = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
  realtime: { transport: ws as never },
});

function orderPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

/**
 * Supprime toute relation (amitié, blocage, conversation + messages) entre
 * deux comptes de test — scopé uniquement à cette paire, sans toucher à
 * leurs profils/intérêts/avatars.
 */
export async function resetRelationship(idA: string, idB: string) {
  await adminClient
    .from("friendships")
    .delete()
    .or(
      `and(requester_id.eq.${idA},addressee_id.eq.${idB}),and(requester_id.eq.${idB},addressee_id.eq.${idA})`
    );

  await adminClient
    .from("blocks")
    .delete()
    .or(
      `and(blocker_id.eq.${idA},blocked_id.eq.${idB}),and(blocker_id.eq.${idB},blocked_id.eq.${idA})`
    );

  const [user_a, user_b] = orderPair(idA, idB);
  const { data: conversation } = await adminClient
    .from("conversations")
    .select("id")
    .eq("user_a", user_a)
    .eq("user_b", user_b)
    .maybeSingle();

  if (conversation) {
    await adminClient.from("messages").delete().eq("conversation_id", conversation.id);
    await adminClient.from("conversations").delete().eq("id", conversation.id);
  }

  // friend_request / friend_request_accepted notifications reference the
  // other user via payload, not a plain column — clean those up too so
  // repeated runs don't accumulate duplicate rows with the same text.
  for (const [owner, other] of [
    [idA, idB],
    [idB, idA],
  ] as const) {
    const { data: rows } = await adminClient
      .from("notifications")
      .select("id, payload")
      .eq("user_id", owner)
      .in("type", ["friend_request", "friend_request_accepted"]);
    const staleIds = (rows ?? [])
      .filter((row) => {
        const payload = row.payload as { requester_id?: string; addressee_id?: string } | null;
        return payload?.requester_id === other || payload?.addressee_id === other;
      })
      .map((row) => row.id);
    if (staleIds.length > 0) {
      await adminClient.from("notifications").delete().in("id", staleIds);
    }
  }
}

/** Établit une amitié acceptée entre deux comptes, sans passer par l'UI. */
export async function ensureFriendship(idA: string, idB: string) {
  await resetRelationship(idA, idB);
  const { error } = await adminClient.from("friendships").insert({
    requester_id: idA,
    addressee_id: idB,
    status: "accepted",
    responded_at: new Date().toISOString(),
  });
  if (error) throw error;
}

/**
 * Remplace les intérêts d'un profil de test par un set fixe (par label_fr),
 * pour que les scénarios de recherche par ville/intérêt soient déterministes.
 */
export async function setProfileInterests(profileId: string, labelsFr: string[]) {
  const { data: rows, error } = await adminClient
    .from("interests")
    .select("id")
    .in("label_fr", labelsFr);
  if (error) throw error;
  const ids = (rows ?? []).map((row) => row.id);

  const { error: deleteError } = await adminClient
    .from("profile_interests")
    .delete()
    .eq("profile_id", profileId);
  if (deleteError) throw deleteError;

  if (ids.length > 0) {
    const { error: insertError } = await adminClient
      .from("profile_interests")
      .insert(ids.map((interest_id) => ({ profile_id: profileId, interest_id })));
    if (insertError) throw insertError;
  }
}

/** Force un profil à `active` — filet de sécurité si un run précédent a été interrompu en cours de suspension/bannissement. */
export async function resetModerationStatus(profileId: string) {
  const { error } = await adminClient
    .from("profiles")
    .update({ moderation_status: "active" })
    .eq("id", profileId);
  if (error) throw error;
}

/** (Re)crée un signalement ouvert unique pour ce couple reporter/cible, pour tester la file de modération admin. */
export async function seedOpenReport(
  reporterId: string,
  targetType: "profile" | "message",
  targetId: string,
  reason: string
) {
  await adminClient
    .from("reports")
    .delete()
    .eq("reporter_id", reporterId)
    .eq("target_type", targetType)
    .eq("target_id", targetId);

  const { error } = await adminClient.from("reports").insert({
    reporter_id: reporterId,
    target_type: targetType,
    target_id: targetId,
    reason,
  });
  if (error) throw error;
}

/** Complète juste l'avatar d'un profil (pour sortir un compte bulk-seedé de l'état "incomplet" sans repasser par l'onboarding). */
export async function setProfileAvatar(profileId: string, avatarUrl: string) {
  const { error } = await adminClient
    .from("profiles")
    .update({ avatar_url: avatarUrl })
    .eq("id", profileId);
  if (error) throw error;
}

/** Insère une notification directement (fixture de preuve — pas de flux réaliste requis pour ce cas). */
export async function seedNotification(
  userId: string,
  type: string,
  payload: Record<string, unknown>
) {
  const { error } = await adminClient.from("notifications").insert({ user_id: userId, type, payload });
  if (error) throw error;
}

// Exposé pour les vérifications post-suppression de compte (e2e/account-deletion.spec.ts),
// qui a besoin de lire des tables/colonnes trop variées pour justifier un wrapper dédié par cas.
export { adminClient as supabaseAdmin };
