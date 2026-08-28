import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

type Client = SupabaseClient<Database>;

export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

// Converts the VAPID public key (URL-safe base64, as printed by
// `web-push generate-vapid-keys`) into the Uint8Array shape
// `PushManager.subscribe()` expects for `applicationServerKey`.
function urlBase64ToUint8Array(base64String: string): BufferSource {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const output = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) output[i] = rawData.charCodeAt(i);
  // PushSubscriptionOptionsInit.applicationServerKey types as
  // BufferSource — a plain ArrayBuffer copy sidesteps a lib.dom.d.ts
  // Uint8Array<ArrayBufferLike> vs ArrayBuffer strictness mismatch.
  return output.buffer.slice(0);
}

// Requests notification permission (if not already decided) and stores the
// resulting subscription in push_subscriptions. Safe to call repeatedly —
// upserts on (user_id, endpoint), so re-subscribing an already-known
// device is a no-op write. Never throws: push is an enhancement, never a
// hard requirement to use the app, so callers can fire-and-forget.
//
// IMPORTANT: call this as the very first thing in a click handler, with no
// `await` before it (not even `supabase.auth.getUser()`) — some Android
// Chrome builds silently drop the permission request (no prompt, no
// error, permission just stays "default" forever) if it isn't tied
// closely enough to the user gesture that triggered it. That's why the
// user id is fetched in here, AFTER the permission call, instead of being
// a parameter callers would have to await first.
export async function subscribeToPush(supabase: Client, locale: string): Promise<boolean> {
  if (!isPushSupported()) return false;

  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidPublicKey) return false;

  try {
    const permission =
      Notification.permission === "default"
        ? await Notification.requestPermission()
        : Notification.permission;
    if (permission !== "granted") return false;

    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) return false;

    const registration = await navigator.serviceWorker.ready;
    const existing = await registration.pushManager.getSubscription();
    const subscription =
      existing ??
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      }));

    const json = subscription.toJSON();
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return false;

    const { error } = await supabase.from("push_subscriptions").upsert(
      {
        user_id: userId,
        endpoint: json.endpoint,
        p256dh: json.keys.p256dh,
        auth: json.keys.auth,
        locale,
        user_agent: navigator.userAgent,
      },
      { onConflict: "user_id,endpoint" }
    );

    return !error;
  } catch {
    return false;
  }
}
