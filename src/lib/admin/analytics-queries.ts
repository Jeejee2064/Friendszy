import { createAdminClient } from "@/lib/supabase/admin";
import { orderPair } from "@/lib/messages/queries";

// Toutes les requêtes ici passent par le client service_role plutôt que le
// client serveur authentifié classique (cf. dashboard-queries.ts, qui
// documente un trou RLS connu sur group_messages pour les admins). Lecture
// admin globale, strictement server-only — voir src/lib/supabase/admin.ts.

const DAY_MS = 24 * 60 * 60 * 1000;

function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * DAY_MS).toISOString();
}

function countBy<T>(rows: T[], key: (row: T) => string): Map<string, number> {
  const map = new Map<string, number>();
  for (const row of rows) {
    const k = key(row);
    map.set(k, (map.get(k) ?? 0) + 1);
  }
  return map;
}

export type AnalyticsKpis = {
  periodDays: number;
  funnel: {
    startedSignup: number;
    confirmedEmail: number;
    completedProfile: number;
  };
  onboardingStepDropoff: { step: number; stepName: string; count: number }[];
  retention: {
    cohortSize: number;
    d1: number | null;
    d7: number | null;
    d30: number | null;
  };
  search: {
    byMode: { mode: string; count: number }[];
    zeroResultCount: number;
    zeroResultTotal: number;
    zeroResultCities: { city: string; count: number }[];
    actionsByMode: { mode: string; searches: number; actions: number }[];
  };
  groups: { created: number; active: number };
  events: { created: number; active: number };
  notifications: { received: number; clicked: number };
  friendReciprocity: { totalAdds: number; mutualAdds: number };
  /** Approximatif — voir le commentaire sur getTimeToFirstMessage. */
  timeToFirstMessage: {
    friendshipsWithMessage: number;
    friendshipsWithoutMessage: number;
    medianHours: number | null;
  };
  /** Approximatif — voir le commentaire sur getContactSafetyStats. */
  contactSafety: { newContacts: number; blockedOrReported: number };
  pwa: { promptAccepted: number; promptDismissed: number; installed: number };
  push: { granted: number; denied: number; default: number };
};

export async function getAnalyticsKpis(periodDays = 30): Promise<AnalyticsKpis> {
  const admin = createAdminClient();
  const since = daysAgoIso(periodDays);

  const [
    funnel,
    onboardingStepDropoff,
    retention,
    search,
    groups,
    events,
    notifications,
    friendReciprocity,
    timeToFirstMessage,
    contactSafety,
    pwa,
    push,
  ] = await Promise.all([
    getFunnel(admin, since),
    getOnboardingStepDropoff(admin, since),
    getRetention(admin),
    getSearchStats(admin, since),
    getGroupsStats(admin, since),
    getEventsStats(admin, since),
    getNotificationsStats(admin, since),
    getFriendReciprocity(admin, since),
    getTimeToFirstMessage(admin, since),
    getContactSafetyStats(admin, since),
    getPwaStats(admin, since),
    getPushStats(admin, since),
  ]);

  return {
    periodDays,
    funnel,
    onboardingStepDropoff,
    retention,
    search,
    groups,
    events,
    notifications,
    friendReciprocity,
    timeToFirstMessage,
    contactSafety,
    pwa,
    push,
  };
}

type AdminClient = ReturnType<typeof createAdminClient>;

async function getFunnel(admin: AdminClient, since: string) {
  const [startedSignup, confirmedEmail, completedProfile] = await Promise.all([
    // profiles.created_at = moment de l'appel signUp() (trigger
    // on_auth_user_created), pas de la confirmation — voir le plan.
    admin.from("profiles").select("*", { count: "exact", head: true }).gte("created_at", since),
    admin
      .from("analytics_events")
      .select("*", { count: "exact", head: true })
      .eq("event_name", "signup_completed")
      .gte("created_at", since),
    admin
      .from("analytics_events")
      .select("*", { count: "exact", head: true })
      .eq("event_name", "onboarding_completed")
      .gte("created_at", since),
  ]);

  return {
    startedSignup: startedSignup.count ?? 0,
    confirmedEmail: confirmedEmail.count ?? 0,
    completedProfile: completedProfile.count ?? 0,
  };
}

async function getOnboardingStepDropoff(admin: AdminClient, since: string) {
  const { data } = await admin
    .from("analytics_events")
    .select("properties")
    .eq("event_name", "onboarding_step_completed")
    .gte("created_at", since);

  const rows = (data ?? []) as { properties: { step?: number; stepName?: string } }[];
  const byStep = new Map<number, { stepName: string; count: number }>();
  for (const row of rows) {
    const step = row.properties?.step;
    if (typeof step !== "number") continue;
    const existing = byStep.get(step);
    byStep.set(step, {
      stepName: existing?.stepName ?? row.properties?.stepName ?? String(step),
      count: (existing?.count ?? 0) + 1,
    });
  }
  return [...byStep.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([step, v]) => ({ step, stepName: v.stepName, count: v.count }));
}

// "Toujours actif N jours après l'inscription" = au moins un session_started
// à partir de created_at + N jours. Fenêtre de cohorte élargie (60 jours)
// pour pouvoir évaluer D30 sur des utilisateurs assez anciens.
async function getRetention(admin: AdminClient) {
  const cohortSince = daysAgoIso(60);
  const now = Date.now();

  const [profilesRes, sessionsRes] = await Promise.all([
    admin.from("profiles").select("id, created_at").gte("created_at", cohortSince),
    admin
      .from("analytics_events")
      .select("user_id, created_at")
      .eq("event_name", "session_started")
      .gte("created_at", cohortSince),
  ]);

  const profiles = profilesRes.data ?? [];
  const sessions = sessionsRes.data ?? [];

  const sessionsByUser = new Map<string, number[]>();
  for (const s of sessions) {
    const arr = sessionsByUser.get(s.user_id) ?? [];
    arr.push(new Date(s.created_at).getTime());
    sessionsByUser.set(s.user_id, arr);
  }

  function stillActiveAt(userId: string, signupMs: number, days: number): boolean | null {
    if (now - signupMs < days * DAY_MS) return null; // pas encore atteint ce cap
    const times = sessionsByUser.get(userId);
    if (!times) return false;
    return times.some((t) => t >= signupMs + days * DAY_MS);
  }

  function rate(days: number): { rate: number | null; n: number } {
    let active = 0;
    let eligible = 0;
    for (const p of profiles) {
      const signupMs = new Date(p.created_at).getTime();
      const result = stillActiveAt(p.id, signupMs, days);
      if (result === null) continue;
      eligible++;
      if (result) active++;
    }
    return { rate: eligible > 0 ? Math.round((active / eligible) * 100) : null, n: eligible };
  }

  const d1 = rate(1);
  const d7 = rate(7);
  const d30 = rate(30);

  return {
    cohortSize: profiles.length,
    d1: d1.rate,
    d7: d7.rate,
    d30: d30.rate,
  };
}

async function getSearchStats(admin: AdminClient, since: string) {
  const [performedRes, actionsRes] = await Promise.all([
    admin
      .from("analytics_events")
      .select("properties")
      .eq("event_name", "search_performed")
      .gte("created_at", since),
    admin
      .from("analytics_events")
      .select("properties")
      .eq("event_name", "search_action")
      .gte("created_at", since),
  ]);

  const performed = (performedRes.data ?? []) as {
    properties: { mode?: string; resultCount?: number; city?: string | null };
  }[];
  const actions = (actionsRes.data ?? []) as { properties: { mode?: string } }[];

  const byMode = countBy(performed, (r) => r.properties?.mode ?? "unknown");
  const zeroResult = performed.filter((r) => r.properties?.resultCount === 0);
  const zeroResultCities = countBy(
    zeroResult.filter((r) => r.properties?.city),
    (r) => r.properties.city as string
  );
  const searchesByMode = countBy(performed, (r) => r.properties?.mode ?? "unknown");
  const actionsByModeMap = countBy(actions, (r) => r.properties?.mode ?? "unknown");

  return {
    byMode: [...byMode.entries()].map(([mode, count]) => ({ mode, count })),
    zeroResultCount: zeroResult.length,
    zeroResultTotal: performed.length,
    zeroResultCities: [...zeroResultCities.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([city, count]) => ({ city, count })),
    actionsByMode: [...searchesByMode.entries()].map(([mode, searches]) => ({
      mode,
      searches,
      actions: actionsByModeMap.get(mode) ?? 0,
    })),
  };
}

async function getGroupsStats(admin: AdminClient, since: string) {
  const [createdRes, recentMessagesRes] = await Promise.all([
    admin.from("groups").select("*", { count: "exact", head: true }).gte("created_at", since),
    admin.from("group_messages").select("group_id").gte("created_at", since),
  ]);
  const active = new Set((recentMessagesRes.data ?? []).map((r) => r.group_id)).size;
  return { created: createdRes.count ?? 0, active };
}

async function getEventsStats(admin: AdminClient, since: string) {
  const [createdRes, recentMessagesRes] = await Promise.all([
    admin.from("events").select("*", { count: "exact", head: true }).gte("created_at", since),
    admin.from("event_messages").select("event_id").gte("created_at", since),
  ]);
  const active = new Set((recentMessagesRes.data ?? []).map((r) => r.event_id)).size;
  return { created: createdRes.count ?? 0, active };
}

async function getNotificationsStats(admin: AdminClient, since: string) {
  const [receivedRes, clickedRes] = await Promise.all([
    admin.from("notifications").select("*", { count: "exact", head: true }).gte("created_at", since),
    admin
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .gte("created_at", since)
      .not("read_at", "is", null),
  ]);
  return { received: receivedRes.count ?? 0, clicked: clickedRes.count ?? 0 };
}

// "Réciprocité" plutôt que "taux d'acceptation" : l'ajout d'ami est
// unidirectionnel et instantané dans ce modèle (src/lib/friends/queries.ts),
// il n'y a pas de flux demande/accepte à mesurer. On regarde plutôt si la
// paire inverse existe (peu importe quand), signe d'une amitié mutuelle.
async function getFriendReciprocity(admin: AdminClient, since: string) {
  const [periodRes, allRes] = await Promise.all([
    admin.from("friendships").select("requester_id, addressee_id").gte("created_at", since),
    admin.from("friendships").select("requester_id, addressee_id"),
  ]);

  const allPairs = new Set(
    (allRes.data ?? []).map((r) => `${r.requester_id}:${r.addressee_id}`)
  );
  const periodPairs = periodRes.data ?? [];
  const mutual = periodPairs.filter((r) => allPairs.has(`${r.addressee_id}:${r.requester_id}`));

  return { totalAdds: periodPairs.length, mutualAdds: mutual.length };
}

// Approximatif, volontairement simple (voir le plan) : pour chaque amitié
// de la période, on cherche la conversation correspondante (même
// normalisation de paire que getOrCreateConversation) puis son tout
// premier message après la date d'ajout. Une amitié sans conversation/
// message n'a pas de délai — elle est exclue, pas comptée comme 0.
// Fait des requêtes par amitié (N+1) : acceptable tant que le volume reste
// modeste (app pré-lancement) ; à revisiter si ça devient un goulot.
async function getTimeToFirstMessage(admin: AdminClient, since: string) {
  const { data: friendships } = await admin
    .from("friendships")
    .select("requester_id, addressee_id, created_at")
    .gte("created_at", since);

  const rows = friendships ?? [];
  const delaysHours: number[] = [];
  let withMessage = 0;

  for (const f of rows) {
    const [user_a, user_b] = orderPair(f.requester_id, f.addressee_id);
    const { data: conversation } = await admin
      .from("conversations")
      .select("id")
      .eq("user_a", user_a)
      .eq("user_b", user_b)
      .maybeSingle();
    if (!conversation) continue;

    const { data: firstMessage } = await admin
      .from("messages")
      .select("created_at")
      .eq("conversation_id", conversation.id)
      .gte("created_at", f.created_at)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (!firstMessage) continue;

    withMessage++;
    const delayMs = new Date(firstMessage.created_at).getTime() - new Date(f.created_at).getTime();
    delaysHours.push(Math.max(0, delayMs / (60 * 60 * 1000)));
  }

  delaysHours.sort((a, b) => a - b);
  const medianHours =
    delaysHours.length > 0 ? delaysHours[Math.floor(delaysHours.length / 2)] : null;

  return {
    friendshipsWithMessage: withMessage,
    friendshipsWithoutMessage: rows.length - withMessage,
    medianHours,
  };
}

// Approximatif : "premier contact" = date de création de la conversation
// (seule créée par getOrCreateConversation, appelé au moment d'envoyer un
// premier message) plutôt que le premier message réel — assez proche en
// pratique. On regarde ensuite si un blocage ou un signalement de profil
// entre les deux participants existe après cette date, dans n'importe quel
// sens. Un seul aller-retour par table plutôt qu'une requête par
// conversation (contrairement à getTimeToFirstMessage) : blocks/reports
// restent des tables modestes.
async function getContactSafetyStats(admin: AdminClient, since: string) {
  const [conversationsRes, blocksRes, reportsRes] = await Promise.all([
    admin.from("conversations").select("user_a, user_b, created_at").gte("created_at", since),
    admin.from("blocks").select("blocker_id, blocked_id, created_at"),
    admin
      .from("reports")
      .select("reporter_id, target_id, created_at")
      .eq("target_type", "profile"),
  ]);

  const conversations = conversationsRes.data ?? [];

  // Paire non ordonnée -> date la plus ancienne de blocage/signalement entre ces deux personnes.
  const earliestIncidentByPair = new Map<string, number>();
  function record(a: string | null, b: string | null, createdAt: string) {
    if (!a || !b) return;
    const [x, y] = orderPair(a, b);
    const key = `${x}:${y}`;
    const t = new Date(createdAt).getTime();
    const existing = earliestIncidentByPair.get(key);
    if (existing === undefined || t < existing) earliestIncidentByPair.set(key, t);
  }
  for (const b of blocksRes.data ?? []) record(b.blocker_id, b.blocked_id, b.created_at);
  for (const r of reportsRes.data ?? []) record(r.reporter_id, r.target_id, r.created_at);

  let blockedOrReported = 0;
  for (const c of conversations) {
    const [x, y] = orderPair(c.user_a, c.user_b);
    const incidentAt = earliestIncidentByPair.get(`${x}:${y}`);
    if (incidentAt !== undefined && incidentAt >= new Date(c.created_at).getTime()) {
      blockedOrReported++;
    }
  }

  return { newContacts: conversations.length, blockedOrReported };
}

async function getPwaStats(admin: AdminClient, since: string) {
  const [promptRes, installedRes] = await Promise.all([
    admin
      .from("analytics_events")
      .select("properties")
      .eq("event_name", "pwa_install_prompt_responded")
      .gte("created_at", since),
    admin
      .from("analytics_events")
      .select("*", { count: "exact", head: true })
      .eq("event_name", "pwa_installed")
      .gte("created_at", since),
  ]);

  const outcomes = (promptRes.data ?? []) as { properties: { outcome?: string } }[];
  return {
    promptAccepted: outcomes.filter((r) => r.properties?.outcome === "accepted").length,
    promptDismissed: outcomes.filter((r) => r.properties?.outcome === "dismissed").length,
    installed: installedRes.count ?? 0,
  };
}

async function getPushStats(admin: AdminClient, since: string) {
  const { data } = await admin
    .from("analytics_events")
    .select("properties")
    .eq("event_name", "push_permission_requested")
    .gte("created_at", since);

  const rows = (data ?? []) as { properties: { result?: string } }[];
  return {
    granted: rows.filter((r) => r.properties?.result === "granted").length,
    denied: rows.filter((r) => r.properties?.result === "denied").length,
    default: rows.filter((r) => r.properties?.result === "default").length,
  };
}
