import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

// Push natif (shell Capacitor Android, via FCM). Le Web Push (service worker
// + VAPID) ne fonctionne pas dans le WebView Android — voir subscribe.ts qui
// bascule ici quand isNativeApp() est vrai.

// "ios" ou "android" : écrit dans native_push_tokens.platform pour que le
// serveur sache par quel canal (APNs / FCM) joindre l'appareil.
function nativePlatform(): "ios" | "android" {
  const cap = (window as { Capacitor?: { getPlatform?: () => string } }).Capacitor;
  return cap?.getPlatform?.() === "ios" ? "ios" : "android";
}

export function isNativeApp(): boolean {
  return (
    typeof window !== "undefined" &&
    !!(window as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.()
  );
}

// Canaux Android (8+), un par catégorie : l'utilisateur peut régler le son
// de chacun dans les réglages système. Les identifiants sont ceux référencés
// par l'Edge Function (ANDROID_CHANNEL dans push-new-message). Créés à chaque
// démarrage de l'app (idempotent) pour que les installations existantes,
// qui n'avaient que « messages », reçoivent aussi les nouveaux.
const CHANNELS: Array<{ id: string; name: string; description: string }> = [
  { id: "messages", name: "Messages", description: "Messages privés" },
  { id: "social", name: "Amis", description: "Nouveaux amis et demandes" },
  { id: "groups", name: "Groupes", description: "Messages, invitations et demandes de groupe" },
  { id: "events", name: "Événements", description: "Messages des événements" },
];

export async function ensureNativeChannels(): Promise<void> {
  if (!isNativeApp()) return;
  const { PushNotifications } = await import("@capacitor/push-notifications");
  await Promise.all(
    CHANNELS.map((c) =>
      PushNotifications.createChannel({ ...c, importance: 4, visibility: 0 })
    )
  );
}

// Jeton de CET appareil, gardé pour pouvoir le retirer à la déconnexion sans
// toucher aux autres appareils du même compte.
const TOKEN_STORAGE_KEY = "friendszy:native-push-token";

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

    await ensureNativeChannels();

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

    const { error } = await supabase
      .from("native_push_tokens")
      .upsert(
        { user_id: userId, token, platform: nativePlatform(), locale },
        { onConflict: "token" }
      );
    if (!error) {
      try {
        localStorage.setItem(TOKEN_STORAGE_KEY, token);
      } catch {
        // stockage indisponible : le jeton sera nettoyé par FCM s'il devient invalide
      }
    }
    return !error;
  } catch {
    return false;
  }
}

// À appeler AVANT supabase.auth.signOut() (la RLS exige la session) : sans ça
// l'appareil continuerait de recevoir « Nouveau message de … » du compte
// déconnecté, et un autre compte se connectant sur cet appareil ne pourrait
// pas enregistrer le même jeton (la RLS interdit de modifier la ligne d'autrui).
// Ne lève jamais.
export async function removeNativePushToken(supabase: SupabaseClient<Database>): Promise<void> {
  if (!isNativeApp()) return;
  try {
    const token = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (!token) return;
    await supabase
      .from("native_push_tokens")
      .delete()
      .eq("token", token);
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    // la déconnexion ne doit jamais échouer à cause du push
  }
}

// Clic sur une notification (app en arrière-plan ou fermée) → ouvre la
// conversation. `url` est un chemin relatif posé par l'Edge Function ;
// on refuse tout ce qui n'est pas un chemin interne.
let tapListenerAttached = false;
export async function attachNativePushTapHandler(
  navigate: (url: string) => void
): Promise<void> {
  if (!isNativeApp() || tapListenerAttached) return;
  tapListenerAttached = true;
  await ensureNativeChannels().catch(() => {});
  const { PushNotifications } = await import("@capacitor/push-notifications");
  void PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
    const url = action.notification.data?.url;
    // Navigation interne (routeur) : pas de rechargement complet de la WebView.
    if (typeof url === "string" && url.startsWith("/") && !url.startsWith("//")) {
      navigate(url);
    }
  });
}
