// Supabase Edge Function : dispatcher unique de notifications push
// (Web Push + FCM). Nom conservé (push-new-message) pour ne pas changer
// l'URL stockée dans Vault, mais il couvre maintenant :
//   - kind "notification"  : toute ligne insérée dans `notifications`
//   - kind "group_message" : message de chat de groupe
//   - kind "event_message" : message de chat d'événement
//
// Appelé UNIQUEMENT par les triggers Postgres (via pg_net, voir
// supabase/migrations/20261124120000_notification_center.sql), jamais par
// le client ; authentifié par un secret partagé, pas par un JWT.
//
// Pour chaque destinataire : préférences par catégorie, heures calmes,
// présence à l'écran (pas de push pour un chat qu'on regarde), puis envoi à
// tous ses appareils. Contenu volontairement générique (jamais le texte d'un
// message : une notif est visible sur un téléphone verrouillé). Un jeton ou
// un abonnement mort (404/410, UNREGISTERED) est supprimé.

import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PUSH_TRIGGER_SECRET = Deno.env.get("PUSH_TRIGGER_SECRET")!;
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT")!;

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// --- FCM (appareils natifs Capacitor) -------------------------------------
// Compte de service Firebase en JSON (secret `FCM_SERVICE_ACCOUNT`). Absent
// → l'envoi natif est simplement ignoré, le Web Push continue de marcher.
const FCM_SERVICE_ACCOUNT = Deno.env.get("FCM_SERVICE_ACCOUNT");

function b64url(input: ArrayBuffer | string): string {
  const bytes =
    typeof input === "string" ? new TextEncoder().encode(input) : new Uint8Array(input);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

let cachedToken: { value: string; exp: number } | null = null;

async function getFcmAccessToken(sa: { client_email: string; private_key: string }) {
  if (cachedToken && cachedToken.exp > Date.now() + 60_000) return cachedToken.value;
  const now = Math.floor(Date.now() / 1000);
  const unsigned =
    b64url(JSON.stringify({ alg: "RS256", typ: "JWT" })) +
    "." +
    b64url(
      JSON.stringify({
        iss: sa.client_email,
        scope: "https://www.googleapis.com/auth/firebase.messaging",
        aud: "https://oauth2.googleapis.com/token",
        iat: now,
        exp: now + 3600,
      })
    );
  const pem = sa.private_key.replace(/-----[A-Z ]+-----|\s/g, "");
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey(
    "pkcs8",
    der,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned));
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${unsigned}.${b64url(sig)}`,
    }),
  });
  if (!res.ok) throw new Error(`FCM oauth ${res.status}`);
  const json = await res.json();
  cachedToken = { value: json.access_token, exp: Date.now() + json.expires_in * 1000 };
  return cachedToken.value;
}

type Category = "messages" | "social" | "groups" | "events" | "test";

// Canaux Android créés côté app (src/lib/push/native.ts, CHANNELS).
const ANDROID_CHANNEL: Record<Category, string> = {
  messages: "messages",
  social: "social",
  groups: "groups",
  events: "events",
  test: "social",
};

// Retourne false si le jeton est mort (à supprimer).
async function sendFcm(
  token: string,
  msg: { title: string; url: string; tag: string; category: Category; unreadCount?: number }
): Promise<boolean> {
  if (!FCM_SERVICE_ACCOUNT) return true;
  const sa = JSON.parse(FCM_SERVICE_ACCOUNT);
  const accessToken = await getFcmAccessToken(sa);
  const data: Record<string, string> = { url: msg.url, category: msg.category };
  if (msg.unreadCount !== undefined) data.unreadCount = String(msg.unreadCount);
  const res = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      message: {
        token,
        notification: { title: msg.title },
        data,
        android: {
          priority: "HIGH",
          // Même tag/collapse_key = la notif remplace la précédente de la
          // même conversation au lieu de s'empiler.
          collapse_key: msg.tag,
          notification: { channel_id: ANDROID_CHANNEL[msg.category], tag: msg.tag },
        },
      },
    }),
  });
  if (res.ok) return true;
  if (res.status === 404 || res.status === 400) {
    const err = await res.json().catch(() => null);
    const code = JSON.stringify(err);
    if (code.includes("UNREGISTERED") || code.includes("NOT_FOUND")) return false;
  }
  return true; // erreur transitoire : on garde le jeton
}

// --- APNs (appareils iOS, envoi direct sans Firebase) -----------------------
// Secrets : APNS_KEY_P8 (contenu du .p8), APNS_KEY_ID, APNS_TEAM_ID,
// APNS_BUNDLE_ID (ca.friendszy.app). APNS_SANDBOX=true pour un build Xcode
// de développement (TestFlight/App Store = production). Absent → ignoré.
const APNS_KEY_P8 = Deno.env.get("APNS_KEY_P8");
const APNS_KEY_ID = Deno.env.get("APNS_KEY_ID");
const APNS_TEAM_ID = Deno.env.get("APNS_TEAM_ID");
const APNS_BUNDLE_ID = Deno.env.get("APNS_BUNDLE_ID") ?? "ca.friendszy.app";
const APNS_HOST =
  Deno.env.get("APNS_SANDBOX") === "true" ? "api.sandbox.push.apple.com" : "api.push.apple.com";

let cachedApnsJwt: { value: string; exp: number } | null = null;

async function getApnsJwt(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  // Apple exige un jeton renouvelé entre 20 et 60 min.
  if (cachedApnsJwt && cachedApnsJwt.exp > now) return cachedApnsJwt.value;
  const pem = (APNS_KEY_P8 ?? "")
    .replace(/\\n/g, "\n")
    .replace(/-----[A-Z ]+-----/g, "")
    .replace(/\s+/g, "");
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey(
    "pkcs8",
    der,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );
  const header = b64url(JSON.stringify({ alg: "ES256", kid: APNS_KEY_ID }));
  const payload = b64url(JSON.stringify({ iss: APNS_TEAM_ID, iat: now }));
  const sig = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    new TextEncoder().encode(`${header}.${payload}`)
  );
  const value = `${header}.${payload}.${b64url(sig)}`;
  cachedApnsJwt = { value, exp: now + 40 * 60 };
  return value;
}

// Retourne false si le jeton est mort (à supprimer).
async function sendApns(
  token: string,
  msg: { title: string; url: string; tag: string; category: Category; unreadCount?: number }
): Promise<boolean> {
  if (!APNS_KEY_P8 || !APNS_KEY_ID || !APNS_TEAM_ID) return true;
  const jwt = await getApnsJwt();
  const aps: Record<string, unknown> = { alert: { title: msg.title }, sound: "default" };
  if (msg.unreadCount !== undefined) aps.badge = msg.unreadCount;
  const res = await fetch(`https://${APNS_HOST}/3/device/${token}`, {
    method: "POST",
    headers: {
      authorization: `bearer ${jwt}`,
      "apns-topic": APNS_BUNDLE_ID,
      "apns-push-type": "alert",
      "apns-priority": "10",
      "apns-collapse-id": msg.tag.slice(0, 64),
    },
    body: JSON.stringify({ aps, url: msg.url, category: msg.category }),
  });
  if (res.ok) return true;
  if (res.status === 410) return false;
  if (res.status === 400) {
    const err = await res.json().catch(() => null);
    if (err?.reason === "BadDeviceToken" || err?.reason === "DeviceTokenNotForTopic") return false;
  }
  return true; // erreur transitoire : on garde le jeton
}

// Heartbeat client toutes les 15 s tant que le chat est ouvert ; une ligne
// plus vieille = onglet fermé sans nettoyage, pas une présence réelle.
const PRESENCE_FRESH_MS = 20_000;

type PushLocale = "fr" | "en" | "es";

function toPushLocale(value: string | null | undefined): PushLocale {
  return value === "en" || value === "es" ? value : "fr";
}

// Les Edge Functions tournent sous Deno, hors de next-intl : textes tenus à
// la main, les trois langues toujours ensemble.
const COPY = {
  new_message: {
    fr: (n: string) => `Nouveau message de ${n}`,
    en: (n: string) => `New message from ${n}`,
    es: (n: string) => `Nuevo mensaje de ${n}`,
  },
  group_message: {
    fr: (g: string) => `Nouveau message dans ${g}`,
    en: (g: string) => `New message in ${g}`,
    es: (g: string) => `Nuevo mensaje en ${g}`,
  },
  event_message: {
    fr: (e: string) => `Nouveau message pour ${e}`,
    en: (e: string) => `New message for ${e}`,
    es: (e: string) => `Nuevo mensaje para ${e}`,
  },
  friend_added: {
    fr: (n: string) => `${n} t'a ajouté comme ami`,
    en: (n: string) => `${n} added you as a friend`,
    es: (n: string) => `${n} te agregó como amigo`,
  },
  friend_request_accepted: {
    fr: (n: string) => `${n} a accepté ta demande d'ami`,
    en: (n: string) => `${n} accepted your friend request`,
    es: (n: string) => `${n} aceptó tu solicitud de amistad`,
  },
  group_invitation: {
    fr: (g: string) => `Tu as été invité·e à rejoindre ${g}`,
    en: (g: string) => `You've been invited to join ${g}`,
    es: (g: string) => `Te invitaron a unirte a ${g}`,
  },
  group_join_request: {
    fr: (n: string, g: string) => `${n} veut rejoindre ${g}`,
    en: (n: string, g: string) => `${n} wants to join ${g}`,
    es: (n: string, g: string) => `${n} quiere unirse a ${g}`,
  },
  group_join_approved: {
    fr: (g: string) => `Ta demande pour rejoindre ${g} a été approuvée`,
    en: (g: string) => `Your request to join ${g} was approved`,
    es: (g: string) => `Tu solicitud para unirte a ${g} fue aprobada`,
  },
  push_test: {
    fr: () => "Les notifications fonctionnent 🎉",
    en: () => "Notifications are working 🎉",
    es: () => "¡Las notificaciones funcionan! 🎉",
  },
} as const;

type Job = {
  recipients: string[];
  category: Category;
  tag: string;
  // Chemin sans préfixe de langue (ajouté par appareil).
  path: string;
  title: (locale: PushLocale) => string;
  // Chat que le destinataire peut être en train de regarder.
  presence?: { kind: "conversation" | "group" | "event"; targetId: string };
  includeUnreadCount?: boolean;
};

function localizedPath(locale: PushLocale, path: string): string {
  // localePrefix "as-needed" : fr (défaut) sans préfixe, en/es avec.
  return locale === "fr" ? path : `/${locale}${path === "/" ? "" : path}`;
}

async function profileName(id: string | undefined): Promise<string> {
  if (!id) return "";
  const { data } = await admin.from("profiles").select("full_name").eq("id", id).maybeSingle();
  return (data?.full_name as string | null) ?? "";
}

async function groupName(id: string | undefined): Promise<string | null> {
  if (!id) return null;
  const { data } = await admin.from("groups").select("name").eq("id", id).maybeSingle();
  return (data?.name as string | null) ?? null;
}

// Retire les destinataires ayant bloqué l'expéditeur.
async function withoutBlockers(recipients: string[], senderId: string): Promise<string[]> {
  if (recipients.length === 0) return recipients;
  const { data } = await admin
    .from("blocks")
    .select("blocker_id")
    .eq("blocked_id", senderId)
    .in("blocker_id", recipients);
  const blockers = new Set((data ?? []).map((r) => r.blocker_id as string));
  return recipients.filter((id) => !blockers.has(id));
}

async function buildJob(body: Record<string, unknown>): Promise<Job | null> {
  const kind = body.kind ?? "notification";
  const payload = (body.payload ?? {}) as Record<string, string | undefined>;

  if (kind === "group_message") {
    const groupId = body.group_id as string;
    const senderId = body.sender_id as string;
    const [name, { data: members }] = await Promise.all([
      groupName(groupId),
      admin
        .from("group_members")
        .select("profile_id")
        .eq("group_id", groupId)
        .eq("status", "active")
        .neq("profile_id", senderId),
    ]);
    if (!name) return null;
    const recipients = await withoutBlockers(
      (members ?? []).map((m) => m.profile_id as string),
      senderId
    );
    return {
      recipients,
      category: "groups",
      tag: `group:${groupId}`,
      path: `/groups/${groupId}`,
      title: (l) => COPY.group_message[l](name),
      presence: { kind: "group", targetId: groupId },
    };
  }

  if (kind === "event_message") {
    const eventId = body.event_id as string;
    const senderId = body.sender_id as string;
    const [{ data: event }, { data: regs }] = await Promise.all([
      admin.from("events").select("title, creator_id").eq("id", eventId).maybeSingle(),
      admin.from("event_registrations").select("profile_id").eq("event_id", eventId),
    ]);
    if (!event) return null;
    const ids = new Set((regs ?? []).map((r) => r.profile_id as string));
    if (event.creator_id) ids.add(event.creator_id as string);
    ids.delete(senderId);
    const recipients = await withoutBlockers([...ids], senderId);
    const title = event.title as string;
    return {
      recipients,
      category: "events",
      tag: `event:${eventId}`,
      path: `/events/${eventId}`,
      title: (l) => COPY.event_message[l](title),
      presence: { kind: "event", targetId: eventId },
    };
  }

  // kind === "notification"
  const userId = body.user_id as string | undefined;
  // Ancien trigger (avant 20261124120000) : pas de `type`, uniquement new_message.
  const type = (body.type as string | undefined) ?? "new_message";
  if (!userId || !type) return null;

  switch (type) {
    case "new_message": {
      const senderId = payload.sender_id;
      const conversationId = payload.conversation_id;
      if (!senderId || !conversationId) return null;
      const name = await profileName(senderId);
      return {
        recipients: [userId],
        category: "messages",
        tag: `conversation:${conversationId}`,
        path: `/messages?c=${conversationId}`,
        title: (l) => COPY.new_message[l](name),
        presence: { kind: "conversation", targetId: conversationId },
        includeUnreadCount: true,
      };
    }
    case "friend_added": {
      const name = await profileName(payload.requester_id);
      if (!name) return null;
      return {
        recipients: [userId],
        category: "social",
        tag: `friend:${payload.requester_id}`,
        path: `/profile/${payload.requester_id}`,
        title: (l) => COPY.friend_added[l](name),
      };
    }
    case "friend_request_accepted": {
      const name = await profileName(payload.addressee_id);
      if (!name) return null;
      return {
        recipients: [userId],
        category: "social",
        tag: `friend:${payload.addressee_id}`,
        path: "/friends",
        title: (l) => COPY.friend_request_accepted[l](name),
      };
    }
    case "group_invitation":
    case "group_join_approved": {
      const g = await groupName(payload.group_id);
      if (!g) return null;
      return {
        recipients: [userId],
        category: "groups",
        tag: `group-notif:${payload.group_id}`,
        path: `/groups/${payload.group_id}`,
        title: (l) => COPY[type][l](g),
      };
    }
    case "group_join_request": {
      const [g, n] = await Promise.all([groupName(payload.group_id), profileName(payload.requester_id)]);
      if (!g || !n) return null;
      return {
        recipients: [userId],
        category: "groups",
        tag: `group-request:${payload.group_id}:${payload.requester_id}`,
        path: `/groups/${payload.group_id}`,
        title: (l) => COPY.group_join_request[l](n, g),
      };
    }
    case "push_test":
      return {
        recipients: [userId],
        category: "test",
        tag: "push-test",
        path: "/notifications",
        title: (l) => COPY.push_test[l](),
      };
    default:
      // Types sans push (ex. suggestions d'intérêt) : rien à envoyer.
      return null;
  }
}

type Prefs = {
  user_id: string;
  push_messages: boolean;
  push_social: boolean;
  push_groups: boolean;
  push_events: boolean;
  quiet_start: string | null;
  quiet_end: string | null;
  timezone: string;
};

function categoryEnabled(prefs: Prefs | undefined, category: Category): boolean {
  if (!prefs || category === "test") return true;
  return prefs[`push_${category}` as const];
}

function toMinutes(time: string): number {
  const [h, m] = time.split(":");
  return Number(h) * 60 + Number(m);
}

function inQuietHours(prefs: Prefs | undefined, now: Date): boolean {
  if (!prefs?.quiet_start || !prefs.quiet_end) return false;
  let local: number;
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: prefs.timezone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(now);
    local = toMinutes(parts);
  } catch {
    return false;
  }
  const start = toMinutes(prefs.quiet_start);
  const end = toMinutes(prefs.quiet_end);
  if (start === end) return false;
  // Plage qui passe minuit (ex. 22:00 → 07:00).
  return start < end ? local >= start && local < end : local >= start || local < end;
}

async function viewingUsers(job: Job): Promise<Set<string>> {
  if (!job.presence) return new Set();
  const cutoff = new Date(Date.now() - PRESENCE_FRESH_MS).toISOString();
  if (job.presence.kind === "conversation") {
    const { data } = await admin
      .from("conversation_presence")
      .select("user_id")
      .eq("conversation_id", job.presence.targetId)
      .in("user_id", job.recipients)
      .gt("updated_at", cutoff);
    return new Set((data ?? []).map((r) => r.user_id as string));
  }
  const { data } = await admin
    .from("chat_presence")
    .select("user_id")
    .eq("kind", job.presence.kind)
    .eq("target_id", job.presence.targetId)
    .in("user_id", job.recipients)
    .gt("updated_at", cutoff);
  return new Set((data ?? []).map((r) => r.user_id as string));
}

// Nombre de conversations avec au moins un message non lu : alimente le
// badge d'icône (navigator.setAppBadge). Version simplifiée de
// getUnreadConversationsCount côté client (sans conversation_hides) ; le
// client recalcule le chiffre exact à l'ouverture.
async function getUnreadConversationCount(userId: string): Promise<number> {
  const { data: conversations } = await admin
    .from("conversations")
    .select("id")
    .or(`user_a.eq.${userId},user_b.eq.${userId}`);
  const ids = (conversations ?? []).map((c) => c.id as string);
  if (ids.length === 0) return 0;
  const { data: unread } = await admin
    .from("messages")
    .select("conversation_id")
    .in("conversation_id", ids)
    .neq("sender_id", userId)
    .is("read_at", null);
  return new Set((unread ?? []).map((m) => m.conversation_id as string)).size;
}

type PushSubscriptionRow = {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  locale: string | null;
};

type NativeTokenRow = {
  id: string;
  user_id: string;
  token: string;
  locale: string | null;
  platform: string;
};

Deno.serve(async (req) => {
  if (req.headers.get("x-push-trigger-secret") !== PUSH_TRIGGER_SECRET) {
    return new Response("unauthorized", { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return new Response("bad request", { status: 400 });
  }

  const job = await buildJob(body);
  if (!job || job.recipients.length === 0) return new Response("nothing to send", { status: 200 });

  const [{ data: prefRows }, viewing] = await Promise.all([
    admin.from("notification_preferences").select("*").in("user_id", job.recipients),
    viewingUsers(job),
  ]);
  const prefsByUser = new Map((prefRows as Prefs[] | null ?? []).map((p) => [p.user_id, p]));
  const now = new Date();

  const targets = job.recipients.filter((id) => {
    const prefs = prefsByUser.get(id);
    if (!categoryEnabled(prefs, job.category)) return false;
    if (job.category !== "test" && inQuietHours(prefs, now)) return false;
    if (viewing.has(id)) return false;
    return true;
  });
  if (targets.length === 0) return new Response("all recipients filtered", { status: 200 });

  const [{ data: subs }, { data: tokens }] = await Promise.all([
    admin
      .from("push_subscriptions")
      .select("id, user_id, endpoint, p256dh, auth, locale")
      .in("user_id", targets),
    admin.from("native_push_tokens").select("id, user_id, token, locale, platform").in("user_id", targets),
  ]);

  const unreadByUser = new Map<string, number>();
  if (job.includeUnreadCount) {
    await Promise.all(
      targets.map(async (id) => unreadByUser.set(id, await getUnreadConversationCount(id)))
    );
  }

  await Promise.all([
    ...((tokens ?? []) as NativeTokenRow[]).map(async (row) => {
      const locale = toPushLocale(row.locale);
      try {
        const send = row.platform === "ios" ? sendApns : sendFcm;
        const alive = await send(row.token, {
          title: job.title(locale),
          url: localizedPath(locale, job.path),
          tag: job.tag,
          category: job.category,
          unreadCount: unreadByUser.get(row.user_id),
        });
        if (!alive) await admin.from("native_push_tokens").delete().eq("id", row.id);
        else
          await admin
            .from("native_push_tokens")
            .update({ last_used_at: new Date().toISOString() })
            .eq("id", row.id);
      } catch {
        // erreur transitoire : le prochain envoi réessaiera
      }
    }),
    ...((subs ?? []) as PushSubscriptionRow[]).map(async (sub) => {
      const locale = toPushLocale(sub.locale);
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify({
            title: job.title(locale),
            url: localizedPath(locale, job.path),
            tag: job.tag,
            unreadCount: unreadByUser.get(sub.user_id),
          })
        );
        await admin
          .from("push_subscriptions")
          .update({ last_used_at: new Date().toISOString() })
          .eq("id", sub.id);
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await admin.from("push_subscriptions").delete().eq("id", sub.id);
        }
      }
    }),
  ]);

  return new Response("ok", { status: 200 });
});
