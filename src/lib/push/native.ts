import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

// Push natif (shell Capacitor Android, via FCM). Le Web Push (service worker
// + VAPID) ne fonctionne pas dans le WebView Android — voir subscribe.ts qui
// bascule ici quand isNativeApp() est vrai.

export function isNativeApp(): boolean {
  return (
    typeof window !== "undefined" &&
    !!(window as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.()
  );
}

// TODO: retirer ce cast après régénération de src/types/supabase.ts via la
// CLI (npm run supabase:types) une fois la migration native_push_tokens
// appliquée — le fichier de types ne doit jamais être édité à la main.
type NativeTokensClient = {
  from: (t: "native_push_tokens") => {
    upsert: (
      row: { user_id: string; token: string; platform: string; locale: string },
      opts: { onConflict: string }
    ) => PromiseLike<{ error: unknown }>;
  };
};

export async function getNativePermission(): Promise<"granted" | "denied" | "default"> {
  const { PushNotifications } = await import("@capacitor/push-notifications");
  const { receive } = await PushNotifications.checkPermissions();
  if (receive === "granted") return "granted";
  if (receive === "denied") return "denied";
  return "default";
}

// Même contrat que subscribeToPush : ne lève jamais, true si un jeton a été
// enregistré en base.
export async function subscribeToNativePush(
  supabase: SupabaseClient<Database>,
  locale: string
): Promise<boolean> {
  try {
    const { PushNotifications } = await import("@capacitor/push-notifications");

    let { receive } = await PushNotifications.checkPermissions();
    if (receive === "prompt" || receive === "prompt-with-rationale") {
      ({ receive } = await PushNotifications.requestPermissions());
    }
    if (receive !== "granted") return false;

    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) return false;

    // Canal Android (Android 8+) référencé par l'Edge Function.
    await PushNotifications.createChannel({
      id: "messages",
      name: "Messages",
      importance: 4,
      visibility: 0,
    });

    const token = await new Promise<string | null>((resolve) => {
      const timer = setTimeout(() => resolve(null), 15000);
      void PushNotifications.addListener("registration", (t) => {
        clearTimeout(timer);
        resolve(t.value);
      });
      void PushNotifications.addListener("registrationError", () => {
        clearTimeout(timer);
        resolve(null);
      });
      void PushNotifications.register();
    });
    if (!token) return false;

    const { error } = await (supabase as unknown as NativeTokensClient)
      .from("native_push_tokens")
      .upsert(
        { user_id: userId, token, platform: "android", locale },
        { onConflict: "token" }
      );
    return !error;
  } catch {
    return false;
  }
}

// Clic sur une notification (app en arrière-plan ou fermée) → ouvre la
// conversation. `url` est un chemin relatif posé par l'Edge Function ;
// on refuse tout ce qui n'est pas un chemin interne.
let tapListenerAttached = false;
export async function attachNativePushTapHandler(): Promise<void> {
  if (!isNativeApp() || tapListenerAttached) return;
  tapListenerAttached = true;
  const { PushNotifications } = await import("@capacitor/push-notifications");
  void PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
    const url = action.notification.data?.url;
    if (typeof url === "string" && url.startsWith("/") && !url.startsWith("//")) {
      window.location.assign(url);
    }
  });
}
