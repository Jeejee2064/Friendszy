"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  listFriends,
  listPendingRequests,
  getFriendshipMap,
  respondToFriendRequest,
  removeFriend,
  type PendingRequest,
  type FriendshipInfo,
} from "@/lib/friends/queries";
import { getOrCreateConversation } from "@/lib/messages/queries";
import { getInterestsForProfiles } from "@/lib/search/queries";
import type { ProfileSummary } from "@/lib/profile/types";
import type { Interest } from "@/lib/profile/types";
import { PersonCard } from "@/components/social/person-card";
import { ReportButton } from "@/components/social/report-button";
import { BlockButton } from "@/components/social/block-button";

type Tab = "friends" | "requests";

export function FriendsPageClient({
  userId,
  interests,
}: {
  userId: string;
  interests: Interest[];
}) {
  const t = useTranslations("Friends");
  const tCommon = useTranslations("Common");
  const router = useRouter();
  const locale = useLocale();

  const [tab, setTab] = useState<Tab>("friends");
  const [friends, setFriends] = useState<ProfileSummary[]>([]);
  const [requests, setRequests] = useState<PendingRequest[]>([]);
  const [friendshipMap, setFriendshipMap] = useState<Map<string, FriendshipInfo>>(
    new Map()
  );
  const [interestsByProfile, setInterestsByProfile] = useState<Map<string, number[]>>(
    new Map()
  );
  const [nameFilter, setNameFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [messagingId, setMessagingId] = useState<string | null>(null);

  const interestLabel = (id: number) => {
    const interest = interests.find((i) => i.id === id);
    if (!interest) return "";
    return locale === "en" ? interest.label_en : interest.label_fr;
  };

  async function load() {
    setLoading(true);
    const supabase = createClient();
    try {
      const [friendList, requestList, fMap] = await Promise.all([
        listFriends(supabase, userId),
        listPendingRequests(supabase, userId),
        getFriendshipMap(supabase, userId),
      ]);
      setFriends(friendList);
      setRequests(requestList);
      setFriendshipMap(fMap);

      const allIds = [...friendList.map((f) => f.id), ...requestList.map((r) => r.profile.id)];
      setInterestsByProfile(await getInterestsForProfiles(supabase, allIds));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleRespond(friendshipId: string, accept: boolean) {
    setBusyId(friendshipId);
    try {
      const supabase = createClient();
      await respondToFriendRequest(supabase, friendshipId, accept);
      await load();
    } finally {
      setBusyId(null);
    }
  }

  async function handleRemove(friendshipId: string) {
    setBusyId(friendshipId);
    try {
      const supabase = createClient();
      await removeFriend(supabase, friendshipId);
      await load();
    } finally {
      setBusyId(null);
    }
  }

  function handleBlocked(targetId: string) {
    setFriends((prev) => prev.filter((f) => f.id !== targetId));
  }

  async function handleMessage(otherId: string) {
    setMessagingId(otherId);
    try {
      const supabase = createClient();
      const conversationId = await getOrCreateConversation(supabase, userId, otherId);
      router.push(`/messages?c=${conversationId}`);
    } finally {
      setMessagingId(null);
    }
  }

  const filteredFriends = friends.filter((f) =>
    (f.full_name ?? "").toLowerCase().includes(nameFilter.toLowerCase())
  );

  return (
    <div className="p-6 md:p-10">
      <h1 className="mb-6 text-2xl font-extrabold text-text">{t("title")}</h1>

      <div className="mb-6 flex rounded-full bg-bg p-1 md:w-fit">
        <TabButton active={tab === "friends"} onClick={() => setTab("friends")}>
          {t("myFriends")} ({friends.length})
        </TabButton>
        <TabButton active={tab === "requests"} onClick={() => setTab("requests")}>
          {t("receivedRequests")} ({requests.length})
        </TabButton>
      </div>

      {loading ? (
        <p className="text-center text-sm text-muted">{t("loading")}</p>
      ) : tab === "friends" ? (
        <div className="flex flex-col gap-4">
          <input
            type="text"
            placeholder={t("filterByName")}
            value={nameFilter}
            onChange={(e) => setNameFilter(e.target.value)}
            className="rounded-lg border border-border bg-card px-3 py-2.5 text-sm outline-none focus:border-teal2 md:max-w-xs"
          />
          {filteredFriends.length === 0 ? (
            <p className="text-center text-sm text-muted">{t("noFriends")}</p>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredFriends.map((friend) => {
                const friendshipId = friendshipMap.get(friend.id)?.friendshipId ?? "";
                const theirInterests = (interestsByProfile.get(friend.id) ?? []).map(
                  interestLabel
                );

                return (
                  <PersonCard
                    key={friend.id}
                    profile={friend}
                    sharedInterests={theirInterests}
                    deletedUserLabel={tCommon("deletedUser")}
                    footer={
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleMessage(friend.id)}
                          disabled={messagingId === friend.id}
                          className="flex-1 rounded-full px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
                          style={{ backgroundImage: "var(--grad)" }}
                        >
                          💬 {t("message")}
                        </button>
                        <ReportButton
                          reporterId={userId}
                          targetType="profile"
                          targetId={friend.id}
                        />
                        <BlockButton
                          blockerId={userId}
                          blockedId={friend.id}
                          blockedName={friend.full_name}
                          onBlocked={() => handleBlocked(friend.id)}
                        />
                        <button
                          disabled={busyId === friendshipId}
                          onClick={() => handleRemove(friendshipId)}
                          title={t("remove")}
                          className="rounded-full border border-border px-3 py-2 text-sm text-muted disabled:opacity-60"
                        >
                          🗑️
                        </button>
                      </div>
                    }
                  />
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {requests.length === 0 ? (
            <p className="col-span-full text-center text-sm text-muted">
              {t("noRequests")}
            </p>
          ) : (
            requests.map((req) => (
              <PersonCard
                key={req.friendshipId}
                profile={req.profile}
                sharedInterests={(interestsByProfile.get(req.profile.id) ?? []).map(
                  interestLabel
                )}
                deletedUserLabel={tCommon("deletedUser")}
                footer={
                  <div className="flex items-center gap-2">
                    <button
                      disabled={busyId === req.friendshipId}
                      onClick={() => handleRespond(req.friendshipId, true)}
                      className="flex-1 rounded-full px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
                      style={{ backgroundImage: "var(--grad)" }}
                    >
                      {t("accept")}
                    </button>
                    <button
                      disabled={busyId === req.friendshipId}
                      onClick={() => handleRespond(req.friendshipId, false)}
                      className="rounded-full border border-border px-4 py-2 text-sm font-semibold text-muted disabled:opacity-60"
                    >
                      {t("decline")}
                    </button>
                  </div>
                }
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 rounded-full px-4 py-2 text-sm font-bold transition-colors md:flex-initial ${active ? "text-white" : "text-muted"}`}
      style={active ? { backgroundImage: "var(--grad)" } : undefined}
    >
      {children}
    </button>
  );
}
