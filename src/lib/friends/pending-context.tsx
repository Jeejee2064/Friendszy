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
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { getProfilesByIds } from "@/lib/profile/queries";
import { getPendingRequestsCount } from "./queries";
import { useToast } from "@/components/ui/toast-context";
import type { Database } from "@/types/supabase";

type FriendshipRow = Database["public"]["Tables"]["friendships"]["Row"];

const PendingRequestsContext = createContext<number>(0);
const RefreshPendingRequestsContext = createContext<() => void>(() => {});

export function usePendingRequestsCount() {
  return useContext(PendingRequestsContext);
}

// Lets actions taken locally (accepting/declining a request) update the
// sidebar badge immediately instead of waiting on a realtime round-trip.
export function useRefreshPendingRequests() {
  return useContext(RefreshPendingRequestsContext);
}

export function PendingRequestsProvider({ children }: { children: ReactNode }) {
  const [count, setCount] = useState(0);
  const t = useTranslations("Notifications");
  const showToast = useToast();
  const userIdRef = useRef<string | null>(null);

  const refreshNow = useCallback(async () => {
    const userId = userIdRef.current;
    if (!userId) return;
    try {
      const supabase = createClient();
      const value = await getPendingRequestsCount(supabase, userId);
      setCount(value);
    } catch {
      // ignore transient errors, next event will retry
    }
  }, []);

  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;
    let started = false;

    async function refresh(userId: string) {
      try {
        const value = await getPendingRequestsCount(supabase, userId);
        if (!cancelled) setCount(value);
      } catch {
        // ignore transient errors, next event will retry
      }
    }

    async function start(userId: string) {
      userIdRef.current = userId;
      if (started) return;
      started = true;

      await refresh(userId);

      channel = supabase
        .channel(`friendships:pending:${userId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "friendships",
            filter: `addressee_id=eq.${userId}`,
          },
          async (payload) => {
            const newRow = payload.new as FriendshipRow;
            refresh(userId);
            if (newRow.status !== "pending") return;
            const [profile] = await getProfilesByIds(supabase, [newRow.requester_id]);
            const name = profile?.full_name ?? "";
            showToast({ message: t("friendRequest", { name }), href: "/friends?tab=requests" });
          }
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "friendships",
            filter: `addressee_id=eq.${userId}`,
          },
          () => refresh(userId)
        )
        .subscribe();
    }

    supabase.auth.getUser().then(({ data }) => {
      if (!cancelled && data.user) start(data.user.id);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session?.user) {
        start(session.user.id);
      }
      if (event === "SIGNED_OUT") {
        started = false;
        userIdRef.current = null;
        setCount(0);
        if (channel) {
          supabase.removeChannel(channel);
          channel = null;
        }
      }
    });

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
      listener.subscription.unsubscribe();
    };
  }, [t, showToast]);

  return (
    <PendingRequestsContext.Provider value={count}>
      <RefreshPendingRequestsContext.Provider value={refreshNow}>
        {children}
      </RefreshPendingRequestsContext.Provider>
    </PendingRequestsContext.Provider>
  );
}
