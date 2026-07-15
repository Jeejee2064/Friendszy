"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

const HEARTBEAT_MS = 30000;
const CHANNEL_NAME = "online-users";

const PresenceContext = createContext<Set<string>>(new Set());

export function usePresence() {
  return useContext(PresenceContext);
}

export function PresenceProvider({ children }: { children: ReactNode }) {
  const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set());
  const channelRef = useRef<RealtimeChannel | null>(null);
  const userIdRef = useRef<string | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    const supabase = createClient();
    let heartbeat: ReturnType<typeof setInterval> | null = null;
    let cancelled = false;

    async function goOffline() {
      const userId = userIdRef.current;
      const channel = channelRef.current;
      startedRef.current = false;
      if (channel) {
        await channel.untrack();
        supabase.removeChannel(channel);
        channelRef.current = null;
      }
      if (userId) {
        await supabase
          .from("profiles")
          .update({ is_online: false })
          .eq("id", userId);
      }
    }

    async function goOnline(userId: string) {
      if (startedRef.current) return;
      startedRef.current = true;
      userIdRef.current = userId;

      const channel = supabase.channel(CHANNEL_NAME, {
        config: { presence: { key: userId } },
      });
      channelRef.current = channel;

      channel.on("presence", { event: "sync" }, () => {
        setOnlineIds(new Set(Object.keys(channel.presenceState())));
      });

      channel.subscribe(async (status) => {
        if (status === "SUBSCRIBED" && !cancelled) {
          await channel.track({ online_at: new Date().toISOString() });
          await supabase
            .from("profiles")
            .update({ is_online: true })
            .eq("id", userId);
        }
      });

      heartbeat = setInterval(() => {
        channel.track({ online_at: new Date().toISOString() });
      }, HEARTBEAT_MS);
    }

    supabase.auth.getUser().then(({ data }) => {
      if (!cancelled && data.user) goOnline(data.user.id);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session?.user) {
        goOnline(session.user.id);
      }
      if (event === "SIGNED_OUT") {
        goOffline();
      }
    });

    function handlePageHide() {
      goOffline();
    }
    window.addEventListener("pagehide", handlePageHide);

    return () => {
      cancelled = true;
      if (heartbeat) clearInterval(heartbeat);
      window.removeEventListener("pagehide", handlePageHide);
      listener.subscription.unsubscribe();
      goOffline();
    };
  }, []);

  return (
    <PresenceContext.Provider value={onlineIds}>{children}</PresenceContext.Provider>
  );
}
