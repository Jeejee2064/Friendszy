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

  // friend_request / friend_request_accepted / friend_added notifications
  // reference the other user via payload, not a plain column — clean those
  // up too so repeated runs don't accumulate duplicate rows with the same
  // text (friend_added is the one type actually created by the current
  // one-directional/instant add flow; the other two are legacy).
  for (const [owner, other] of [
    [idA, idB],
    [idB, idA],
  ] as const) {
    const { data: rows } = await adminClient
      .from("notifications")
      .select("id, payload")
      .eq("user_id", owner)
      .in("type", ["friend_request", "friend_request_accepted", "friend_added"]);
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

export async function getInterestId(labelFr: string): Promise<number> {
  const { data, error } = await adminClient
    .from("interests")
    .select("id")
    .eq("label_fr", labelFr)
    .single();
  if (error) throw error;
  return data.id;
}

export type SeedGroupMember = {
  profileId: string;
  role: "admin" | "member";
  status?: "active" | "left" | "excluded" | "banned";
};

/**
 * Crée un groupe directement (sans passer par l'assistant de création) avec
 * son créateur + des membres additionnels optionnels — pour les tests dont
 * le sujet est en aval de la création elle-même. Retourne l'id du groupe ;
 * toujours suivi d'un deleteGroups([id]) en teardown.
 */
export async function seedGroup(
  fields: {
    name: string;
    interestLabelFr: string;
    creatorId: string;
    invitePermission?: "all_members" | "admins_only";
  },
  extraMembers: SeedGroupMember[] = []
): Promise<string> {
  const interestId = await getInterestId(fields.interestLabelFr);
  const { data: group, error: groupError } = await adminClient
    .from("groups")
    .insert({
      name: fields.name,
      interest_id: interestId,
      creator_id: fields.creatorId,
      invite_permission: fields.invitePermission ?? "all_members",
    })
    .select("id")
    .single();
  if (groupError) throw groupError;

  const rows = [
    { group_id: group.id, profile_id: fields.creatorId, role: "creator", status: "active" },
    ...extraMembers.map((m) => ({
      group_id: group.id,
      profile_id: m.profileId,
      role: m.role,
      status: m.status ?? "active",
    })),
  ];
  const { error: membersError } = await adminClient.from("group_members").insert(rows);
  if (membersError) throw membersError;

  return group.id;
}

/**
 * Supprime des groupes précis et toutes les lignes des 3 tables enfants qui
 * les référencent — deletes explicites plutôt que de compter sur un cascade.
 */
export async function deleteGroups(groupIds: string[]) {
  if (groupIds.length === 0) return;
  await adminClient.from("group_messages").delete().in("group_id", groupIds);
  await adminClient.from("group_members").delete().in("group_id", groupIds);
  await adminClient.from("group_join_requests").delete().in("group_id", groupIds);
  await adminClient.from("groups").delete().in("id", groupIds);
}

/**
 * Filet de sécurité pour tout le fichier groups.spec.ts : supprime tout
 * groupe jamais créé par l'un de ces profils, peu importe comment (assistant
 * ou seedGroup) — au cas où un run précédent aurait été interrompu en cours
 * de route et aurait laissé un groupe fantôme visible en découverte.
 */
export async function resetGroupsForCreators(creatorIds: string[]) {
  const { data, error } = await adminClient
    .from("groups")
    .select("id")
    .in("creator_id", creatorIds);
  if (error) throw error;
  await deleteGroups((data ?? []).map((g) => g.id));
}

/** Insère directement une demande d'adhésion, en remplaçant toute demande existante pour cette paire. */
export async function seedJoinRequest(
  groupId: string,
  profileId: string,
  status: "pending" | "approved" | "rejected" = "pending"
) {
  await adminClient
    .from("group_join_requests")
    .delete()
    .eq("group_id", groupId)
    .eq("profile_id", profileId);
  const { error } = await adminClient
    .from("group_join_requests")
    .insert({ group_id: groupId, profile_id: profileId, status });
  if (error) throw error;
}

/** Insère un message de groupe directement, sans passer par sendGroupMessage() — retourne son id. */
export async function seedGroupMessage(
  groupId: string,
  senderId: string,
  content: string
): Promise<string> {
  const { data, error } = await adminClient
    .from("group_messages")
    .insert({ group_id: groupId, sender_id: senderId, content })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export type SeedEventRegistration = {
  profileId: string;
};

/**
 * Crée un événement directement (sans passer par l'assistant de création)
 * avec son créateur auto-inscrit + des inscriptions additionnelles
 * optionnelles — pour les tests dont le sujet est en aval de la création
 * elle-même. Retourne l'id de l'événement ; toujours suivi d'un
 * deleteEvents([id]) en teardown.
 */
export async function seedEvent(
  fields: {
    title: string;
    interestLabelFr: string;
    creatorId: string;
    city?: string;
    startsAt?: string;
    endsAt?: string;
    capacity?: number | null;
    latitude?: number | null;
    longitude?: number | null;
  },
  extraRegistrations: SeedEventRegistration[] = []
): Promise<string> {
  const interestId = await getInterestId(fields.interestLabelFr);
  const startsAt = fields.startsAt ?? new Date(Date.now() + 24 * 3600 * 1000).toISOString();
  const endsAt = fields.endsAt ?? new Date(Date.now() + 26 * 3600 * 1000).toISOString();

  const { data: event, error: eventError } = await adminClient
    .from("events")
    .insert({
      title: fields.title,
      interest_id: interestId,
      creator_id: fields.creatorId,
      city: fields.city ?? "Québec",
      starts_at: startsAt,
      ends_at: endsAt,
      capacity: fields.capacity ?? null,
      latitude: fields.latitude ?? null,
      longitude: fields.longitude ?? null,
    })
    .select("id")
    .single();
  if (eventError) throw eventError;

  const rows = [
    { event_id: event.id, profile_id: fields.creatorId },
    ...extraRegistrations.map((r) => ({ event_id: event.id, profile_id: r.profileId })),
  ];
  const { error: registrationsError } = await adminClient
    .from("event_registrations")
    .insert(rows);
  if (registrationsError) throw registrationsError;

  return event.id;
}

/**
 * Supprime des événements précis et toutes les lignes des tables enfants qui
 * les référencent — deletes explicites plutôt que de compter sur un cascade.
 */
export async function deleteEvents(eventIds: string[]) {
  if (eventIds.length === 0) return;
  await adminClient.from("event_messages").delete().in("event_id", eventIds);
  await adminClient.from("event_registrations").delete().in("event_id", eventIds);
  await adminClient.from("event_photos").delete().in("event_id", eventIds);
  await adminClient.from("events").delete().in("id", eventIds);
}

/**
 * Filet de sécurité pour tout le fichier events.spec.ts : supprime tout
 * événement jamais créé par l'un de ces profils, peu importe comment
 * (assistant ou seedEvent) — au cas où un run précédent aurait été
 * interrompu en cours de route et aurait laissé un événement fantôme visible
 * en découverte.
 */
export async function resetEventsForCreators(creatorIds: string[]) {
  const { data, error } = await adminClient
    .from("events")
    .select("id")
    .in("creator_id", creatorIds);
  if (error) throw error;
  await deleteEvents((data ?? []).map((e) => e.id));
}

/** Insère un message d'événement directement, sans passer par sendEventMessage() — retourne son id. */
export async function seedEventMessage(
  eventId: string,
  senderId: string,
  content: string
): Promise<string> {
  const { data, error } = await adminClient
    .from("event_messages")
    .insert({ event_id: eventId, sender_id: senderId, content })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

// Exposé pour les vérifications post-suppression de compte (e2e/account-deletion.spec.ts),
// qui a besoin de lire des tables/colonnes trop variées pour justifier un wrapper dédié par cas.
export { adminClient as supabaseAdmin };
