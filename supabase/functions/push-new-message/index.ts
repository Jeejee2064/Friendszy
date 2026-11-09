// Supabase Edge Function: sends a Web Push notification for a new message.
//
// Called ONLY by the `trg_push_new_message` Postgres trigger (AFTER INSERT
// ON notifications WHERE type = 'new_message'), via pg_net — see
// supabase/migrations/20260824200100_notify_push_new_message.sql. Never
// called by the client directly; the request is authenticated with a
// shared secret header rather than a user JWT, since it originates from
// Postgres, not a browser.
//
// Content is intentionally generic — "Nouveau message de {prénom}" /
// "New message from {firstName}" — never the message text itself, per the
// client's explicit privacy requirement (a push notification is visible
// even on a locked phone).
//
// One push per subscribed device, no batching. A dead/expired subscription
// (the push service responds 404/410) is deleted rather than retried.

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

// Retourne false si le jeton est mort (à supprimer).
async function sendFcm(
  token: string,
  title: string,
  url: string,
  unreadCount: number
): Promise<boolean> {
  if (!FCM_SERVICE_ACCOUNT) return true;
  const sa = JSON.parse(FCM_SERVICE_ACCOUNT);
  const accessToken = await getFcmAccessToken(sa);
  const res = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      message: {
        token,
        // Contenu générique uniquement (jamais le texte du message).
        notification: { title },
        data: { url, unreadCount: String(unreadCount) },
        android: { priority: "HIGH", notification: { channel_id: "messages" } },
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

// Le client fait un heartbeat (upsert) toutes les 15s tant que la
// conversation est ouverte à l'écran (voir trackConversationPresence,
// src/lib/messages/queries.ts) — une ligne plus vieille que ça veut dire
// que l'onglet a été fermé/masqué sans avoir pu nettoyer, pas que la
// conversation est encore regardée.
const PRESENCE_FRESH_MS = 20_000;

// French first, English alongside — mirrors messages/fr.json's existing
// "newMessage" in-app toast wording, but this is its own short copy (the
// client asked for this exact generic phrasing for push specifically).
// Edge Functions run on Deno, outside the Next.js app, so this can't
// import next-intl's JSON directly — kept in sync by hand, both languages
// always present together.
const TITLE: Record<"fr" | "en", (name: string) => string> = {
  fr: (name) => `Nouveau message de ${name}`,
  en: (name) => `New message from ${name}`,
};

function conversationPath(locale: "fr" | "en", conversationId: string): string {
  // src/i18n/routing.ts: localePrefix "as-needed" — fr (default) has no
  // prefix, en does.
  const prefix = locale === "en" ? "/en" : "";
  return `${prefix}/messages?c=${conversationId}`;
}

// Feeds the app-icon badge (navigator.setAppBadge, called from sw.js's
// push handler) — the count of conversations with at least one unread
// message for this recipient. Deliberately a simplified version of
// getUnreadConversationsCount (src/lib/messages/queries.ts): it skips the
// conversation_hides exclusion that function applies, since this runs with
// service_role and re-deriving that logic here risks drifting out of sync.
// A conversation hidden with an unread message left in it would overcount
// by one until the app is next opened, where the client-side effect in
// unread-context.tsx recomputes the exact count and corrects the badge —
// good enough for a background badge that's inherently a snapshot.
async function getUnreadConversationCount(userId: string): Promise<number> {
  const { data: conversations } = await admin
    .from("conversations")
    .select("id")
    .or(`user_a.eq.${userId},user_b.eq.${userId}`);

  const conversationIds = (conversations ?? []).map((c) => c.id as string);
  if (conversationIds.length === 0) return 0;

  const { data: unread } = await admin
    .from("messages")
    .select("conversation_id")
    .in("conversation_id", conversationIds)
    .neq("sender_id", userId)
    .is("read_at", null);

  return new Set((unread ?? []).map((m) => m.conversation_id as string)).size;
}

type NotifyRequestBody = {
  notification_id?: string;
  user_id?: string;
  payload?: Record<string, unknown> | null;
};

type PushSubscriptionRow = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  locale: string | null;
};

Deno.serve(async (req) => {
  if (req.headers.get("x-push-trigger-secret") !== PUSH_TRIGGER_SECRET) {
    return new Response("unauthorized", { status: 401 });
  }

  let body: NotifyRequestBody;
  try {
    body = await req.json();
  } catch {
    return new Response("bad request", { status: 400 });
  }

  const userId = body.user_id;
  const payload = body.payload ?? {};

  // Shape set by public.notify_new_message() — see
  // supabase/migrations/20260824200200_notify_new_message.sql.
  const senderId = (payload as Record<string, string | undefined>).sender_id;
  const conversationId = (payload as Record<string, string | undefined>).conversation_id;

  if (!userId || !senderId || !conversationId) {
    return new Response("missing sender_id/conversation_id in notification payload", {
      status: 422,
    });
  }

  // Le destinataire a déjà cette conversation ouverte à l'écran (elle lui
  // affiche le message en direct) — une notif push serait redondante, et
  // gênante en pleine discussion (voir conversation_presence, migration
  // 20260914160000). Une ligne présente mais périmée ne compte pas : elle
  // n'a pas pu être nettoyée à temps, pas une preuve de présence actuelle.
  const { data: presence } = await admin
    .from("conversation_presence")
    .select("updated_at")
    .eq("user_id", userId)
    .eq("conversation_id", conversationId)
    .maybeSingle();

  if (presence && Date.now() - new Date(presence.updated_at).getTime() < PRESENCE_FRESH_MS) {
    return new Response("recipient viewing conversation, push skipped", { status: 200 });
  }

  const [{ data: sender }, { data: subscriptions }, { data: nativeTokens }, unreadCount] =
    await Promise.all([
    admin.from("profiles").select("full_name").eq("id", senderId).maybeSingle(),
    admin
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth, locale")
      .eq("user_id", userId),
    admin.from("native_push_tokens").select("id, token, locale").eq("user_id", userId),
    getUnreadConversationCount(userId),
  ]);

  const name = (sender?.full_name as string | null) ?? "";

  await Promise.all(
    (nativeTokens ?? []).map(async (row) => {
      const locale: "fr" | "en" = row.locale === "en" ? "en" : "fr";
      try {
        const alive = await sendFcm(
          row.token as string,
          TITLE[locale](name),
          conversationPath(locale, conversationId),
          unreadCount
        );
        if (!alive) await admin.from("native_push_tokens").delete().eq("id", row.id);
        else
          await admin
            .from("native_push_tokens")
            .update({ last_used_at: new Date().toISOString() })
            .eq("id", row.id);
      } catch {
        // erreur transitoire : le prochain message réessaiera
      }
    })
  );

  if (!subscriptions || subscriptions.length === 0) {
    return new Response("ok", { status: 200 });
  }

  await Promise.all(
    (subscriptions as PushSubscriptionRow[]).map(async (sub) => {
      const locale: "fr" | "en" = sub.locale === "en" ? "en" : "fr";
      const title = TITLE[locale](name);
      const url = conversationPath(locale, conversationId);

      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify({ title, url, unreadCount })
        );
        await admin
          .from("push_subscriptions")
          .update({ last_used_at: new Date().toISOString() })
          .eq("id", sub.id);
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          // Subscription no longer valid (browser unsubscribed, device
          // reset, permission revoked, etc.) — delete rather than let dead
          // rows accumulate and get retried forever.
          await admin.from("push_subscriptions").delete().eq("id", sub.id);
        }
        // Any other error (transient network/push-service issue): leave the
        // subscription in place, the next message will retry it.
      }
    })
  );

  return new Response("ok", { status: 200 });
});
