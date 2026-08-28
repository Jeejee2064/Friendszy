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

  const [{ data: sender }, { data: subscriptions }] = await Promise.all([
    admin.from("profiles").select("full_name").eq("id", senderId).maybeSingle(),
    admin
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth, locale")
      .eq("user_id", userId),
  ]);

  if (!subscriptions || subscriptions.length === 0) {
    return new Response("no subscriptions", { status: 200 });
  }

  const name = (sender?.full_name as string | null) ?? "";

  await Promise.all(
    (subscriptions as PushSubscriptionRow[]).map(async (sub) => {
      const locale: "fr" | "en" = sub.locale === "en" ? "en" : "fr";
      const title = TITLE[locale](name);
      const url = conversationPath(locale, conversationId);

      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify({ title, url })
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
