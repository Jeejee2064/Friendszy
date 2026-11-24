"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

// Heartbeat « je regarde ce chat de groupe / d'événement » (pendant de
// trackConversationPresence pour les messages privés). Lu par l'Edge Function
// push-new-message pour ne pas pousser une notif pour un chat déjà à l'écran.
// Sous les 20 s de fraîcheur côté serveur.
const HEARTBEAT_MS = 15_000;

export function useChatPresence(kind: "group" | "event", targetId: string, userId: string) {
  useEffect(() => {
    const supabase = createClient();
    let timer: ReturnType<typeof setInterval> | null = null;

    function beat() {
      void supabase
        .from("chat_presence")
        .upsert({ user_id: userId, kind, target_id: targetId, updated_at: new Date().toISOString() })
        .then(() => {});
    }

    function start() {
      beat();
      if (!timer) timer = setInterval(beat, HEARTBEAT_MS);
    }

    function stop() {
      if (timer) clearInterval(timer);
      timer = null;
      void supabase.from("chat_presence").delete().eq("user_id", userId).then(() => {});
    }

    function onVisibility() {
      if (document.visibilityState === "visible") start();
      else stop();
    }

    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", stop);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", stop);
      stop();
    };
  }, [kind, targetId, userId]);
}
