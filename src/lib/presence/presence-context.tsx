"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

const HEARTBEAT_MS = 30000;
const POLL_MS = 60000;
const CHANNEL_NAME = "online-users";

const PresenceContext = createContext<Set<string>>(new Set());
const GoOfflineContext = createContext<() => Promise<void>>(async () => {});

export function usePresence() {
  return useContext(PresenceContext);
}

// Lets the sign-out flow untrack presence (so other clients see it live)
// before the auth session is torn down — see SignOutButton.
export function useGoOffline() {
  return useContext(GoOfflineContext);
}

export function PresenceProvider({ children }: { children: ReactNode }) {
  const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set());
  const channelRef = useRef<RealtimeChannel | null>(null);
  const userIdRef = useRef<string | null>(null);
  const startedRef = useRef(false);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const supabaseRef = useRef(createClient());

  const goOffline = useCallback(async () => {
    const supabase = supabaseRef.current;
    const userId = userIdRef.current;
    const channel = channelRef.current;
    // Sign-out triggers this twice: once explicitly (SignOutButton, while
    // the session is still valid) and again via the SIGNED_OUT auth event
    // fired after signOutUser() completes. By then userIdRef is already
    // cleared below, so this is a no-op instead of retrying a profiles
    // update with a torn-down session.
    if (!channel && !userId) return;
    userIdRef.current = null;
    startedRef.current = false;
    // Cancel any pending auto-reconnect from the CHANNEL_ERROR/TIMED_OUT/CLOSED
    // handler below — otherwise it can fire after we've intentionally gone
    // offline and silently bring the channel back.
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
    // Null the ref before removing the channel: removeChannel() can
    // synchronously re-invoke this channel's own subscribe callback with
    // "CLOSED", and that callback only acts on channels it still recognizes
    // as current — this stops it from treating our own intentional
    // disconnect as a dropped connection and reconnecting behind our back.
    channelRef.current = null;
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
    if (channel) {
      await channel.untrack();
      supabase.removeChannel(channel);
    }
    if (userId) {
      await supabase
        .from("profiles")
        .update({ is_online: false })
        .eq("id", userId);
    }
  }, []);

  useEffect(() => {
    const supabase = supabaseRef.current;
    let cancelled = false;
    let pollTimer: ReturnType<typeof setInterval> | null = null;

    // Ground-truth reconciliation: profiles.is_online is written reliably
    // by goOnline/goOffline regardless of whether the realtime presence
    // broadcast itself gets through. Polling it self-heals stale online
    // dots (e.g. an account stuck "online" after leaving) within POLL_MS
    // even if a presence "leave" event never arrives on some client.
    async function pollOnlineIds() {
      // Skip while signed out — PresenceProvider stays mounted across
      // navigation to /login, so this interval would otherwise keep firing
      // with a dead session.
      if (!userIdRef.current) return;
      const { data, error } = await supabase
        .from("profiles")
        .select("id")
        .eq("is_online", true);
      if (cancelled || error) return;
      setOnlineIds(new Set((data ?? []).map((row) => row.id)));
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
        // Ignore events from a channel we've already abandoned (superseded
        // by a newer one, or intentionally closed via goOffline).
        if (channelRef.current !== channel) return;
        setOnlineIds(new Set(Object.keys(channel.presenceState())));
      });

      channel.subscribe(async (status) => {
        if (cancelled || channelRef.current !== channel) return;

        if (status === "SUBSCRIBED") {
          await channel.track({ online_at: new Date().toISOString() });
          await supabase
            .from("profiles")
            .update({ is_online: true })
            .eq("id", userId);
          return;
        }

        // The socket dropped (network blip, background-tab throttling, etc.)
        // and realtime-js gave up on this channel — without this, other
        // clients' presence updates stop arriving until a hard refresh.
        // (Intentional closes, e.g. via goOffline, already nulled
        // channelRef.current, so they never reach this branch.)
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          channelRef.current = null;
          startedRef.current = false;
          if (heartbeatRef.current) {
            clearInterval(heartbeatRef.current);
            heartbeatRef.current = null;
          }
          retryTimeoutRef.current = setTimeout(() => {
            retryTimeoutRef.current = null;
            if (!cancelled) goOnline(userId);
          }, 2000);
        }
      });

      heartbeatRef.current = setInterval(() => {
        channel.track({ online_at: new Date().toISOString() });
      }, HEARTBEAT_MS);
    }

    supabase.auth.getUser().then(({ data }) => {
      if (!cancelled && data.user) goOnline(data.user.id);
    });

    pollOnlineIds();
    pollTimer = setInterval(pollOnlineIds, POLL_MS);

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

    // Background tabs get their timers/sockets throttled by the browser;
    // when the tab comes back, make sure the presence channel is still
    // actually joined instead of silently stale.
    function handleVisibilityChange() {
      if (document.visibilityState !== "visible") return;
      const userId = userIdRef.current;
      if (!userId) return;
      if (channelRef.current?.state === "joined") {
        channelRef.current.track({ online_at: new Date().toISOString() });
        return;
      }
      if (!startedRef.current) goOnline(userId);
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelled = true;
      if (pollTimer) clearInterval(pollTimer);
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
      window.removeEventListener("pagehide", handlePageHide);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      listener.subscription.unsubscribe();
      goOffline();
    };
  }, [goOffline]);

  return (
    <GoOfflineContext.Provider value={goOffline}>
      <PresenceContext.Provider value={onlineIds}>{children}</PresenceContext.Provider>
    </GoOfflineContext.Provider>
  );
}
