"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
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
import { useRefreshPendingRequests } from "@/lib/friends/pending-context";
import { getOrCreateConversation } from "@/lib/messages/queries";
import { getInterestsForProfiles } from "@/lib/search/queries";
import { getProfilesByIds } from "@/lib/profile/queries";
import {
  listBlockedProfiles,
  unblockUser,
  type BlockedProfile,
} from "@/lib/blocks/queries";
import type { ProfileSummary } from "@/lib/profile/types";
import type { Interest } from "@/lib/profile/types";
import { PersonCard } from "@/components/social/person-card";
import { ReportButton } from "@/components/social/report-button";
import { BlockButton } from "@/components/social/block-button";

type Tab = "friends" | "requests" | "blocked";

export function FriendsPageClient({
  userId,
  interests,
}: {
  userId: string;
  interests: Interest[];
}) {
  const t = useTranslations("Friends");
  const tBlocked = useTranslations("Blocked");
  const tCommon = useTranslations("Common");
  const router = useRouter();
  const locale = useLocale();
  const searchParams = useSearchParams();

  const tabParam = searchParams.get("tab");
  const tab: Tab = tabParam === "requests" ? "requests" : tabParam === "blocked" ? "blocked" : "friends";
  function setTab(nextTab: Tab) {
    router.replace(nextTab === "friends" ? "/friends" : `/friends?tab=${nextTab}`);
  }
  const [friends, setFriends] = useState<ProfileSummary[]>([]);
  const [requests, setRequests] = useState<PendingRequest[]>([]);
  const [blockedProfiles, setBlockedProfiles] = useState<BlockedProfile[]>([]);
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
  const [unblockingId, setUnblockingId] = useState<string | null>(null);
  const refreshPendingRequests = useRefreshPendingRequests();

  const interestLabel = (id: number) => {
    const interest = interests.find((i) => i.id === id);
    if (!interest) return "";
    return locale === "en" ? interest.label_en : interest.label_fr;
  };

  async function load() {
    setLoading(true);
    const supabase = createClient();
    try {
      const [friendList, requestList, fMap, blockedList] = await Promise.all([
        listFriends(supabase, userId),
        listPendingRequests(supabase, userId),
        getFriendshipMap(supabase, userId),
        listBlockedProfiles(supabase),
      ]);
      setFriends(friendList);
      setRequests(requestList);
      setFriendshipMap(fMap);
      setBlockedProfiles(blockedList);

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
  }, [tab]);

  async function handleUnblock(blockedId: string) {
    setUnblockingId(blockedId);
    try {
      const supabase = createClient();
      await unblockUser(supabase, userId, blockedId);
      setBlockedProfiles((prev) => prev.filter((p) => p.id !== blockedId));

      // The underlying friendship row is never touched by block/unblock, so
      // if they were an accepted friend before, they still are — bring them
      // back into the friends list right away instead of waiting on a reload.
      if (friendshipMap.get(blockedId)?.status === "accepted") {
        const [profile] = await getProfilesByIds(supabase, [blockedId]);
        if (profile) {
          setFriends((prev) => (prev.some((f) => f.id === profile.id) ? prev : [...prev, profile]));
        }
      }
    } finally {
      setUnblockingId(null);
    }
  }

  async function handleRespond(friendshipId: string, accept: boolean) {
    setBusyId(friendshipId);
    try {
      const supabase = createClient();
      await respondToFriendRequest(supabase, friendshipId, accept);
      await load();
      refreshPendingRequests();
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

  function handleBlocked(profile: ProfileSummary) {
    setFriends((prev) => prev.filter((f) => f.id !== profile.id));
    setBlockedProfiles((prev) =>
      prev.some((p) => p.id === profile.id)
        ? prev
        : [
            ...prev,
            {
              id: profile.id,
              username: null,
              full_name: profile.full_name,
              avatar_url: profile.avatar_url,
              city: profile.city,
            },
          ]
    );
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

      <div className="mb-6 flex gap-1 border-b border-border">
        <TabButton
          active={tab === "friends"}
          onClick={() => setTab("friends")}
          count={friends.length}
        >
          {t("myFriends")}
        </TabButton>
        <TabButton
          active={tab === "requests"}
          onClick={() => setTab("requests")}
          count={requests.length}
        >
          {t("receivedRequests")}
        </TabButton>
        <TabButton
          active={tab === "blocked"}
          onClick={() => setTab("blocked")}
          count={blockedProfiles.length}
        >
          {t("blockedTab")}
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
                    href={`/profile/${friend.id}`}
                    deletedUserLabel={tCommon("deletedUser")}
                    footer={
                      <div className="flex flex-col gap-2">
                        <button
                          onClick={() => handleMessage(friend.id)}
                          disabled={messagingId === friend.id}
                          className="w-full rounded-full px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
                          style={{ backgroundImage: "var(--grad)" }}
                        >
                          💬 {t("message")}
                        </button>
                        <div className="flex items-center justify-end gap-2">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full border border-border">
                            <ReportButton
                              reporterId={userId}
                              targetType="profile"
                              targetId={friend.id}
                              compact
                            />
                          </div>
                          <div className="flex h-8 w-8 items-center justify-center rounded-full border border-border">
                            <BlockButton
                              blockerId={userId}
                              blockedId={friend.id}
                              blockedName={friend.full_name}
                              onBlocked={() => handleBlocked(friend)}
                              compact
                            />
                          </div>
                          <button
                            disabled={busyId === friendshipId}
                            onClick={() => handleRemove(friendshipId)}
                            title={t("remove")}
                            className="flex h-8 w-8 items-center justify-center rounded-full border border-border text-sm text-muted disabled:opacity-60"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    }
                  />
                );
              })}
            </div>
          )}
        </div>
      ) : tab === "requests" ? (
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
                href={`/profile/${req.profile.id}`}
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
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {blockedProfiles.length === 0 ? (
            <p className="col-span-full text-center text-sm text-muted">
              {tBlocked("empty")}
            </p>
          ) : (
            blockedProfiles.map((profile) => (
              <div
                key={profile.id}
                className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4"
              >
                <div
                  className="h-12 w-12 shrink-0 overflow-hidden rounded-full"
                  style={
                    !profile.avatar_url ? { backgroundImage: "var(--grad)" } : undefined
                  }
                >
                  {profile.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={profile.avatar_url}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-sm font-bold text-white">
                      {(profile.full_name ?? "?").charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold text-text">{profile.full_name}</p>
                  {profile.city && (
                    <p className="truncate text-sm text-muted">{profile.city}</p>
                  )}
                </div>
                <button
                  type="button"
                  disabled={unblockingId === profile.id}
                  onClick={() => handleUnblock(profile.id)}
                  className="shrink-0 rounded-full border border-teal2 px-3 py-2 text-sm font-semibold text-teal2 disabled:opacity-60"
                >
                  {tBlocked("unblock")}
                </button>
              </div>
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
  count,
  children,
}: {
  active: boolean;
  onClick: () => void;
  count: number;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 rounded-t-lg border-b-2 px-3 pb-3 pt-2 text-sm font-bold transition-colors ${
        active
          ? "border-teal2 bg-bg text-teal2"
          : "border-transparent text-muted hover:bg-bg hover:text-text"
      }`}
    >
      {children}
      <span
        className="flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-bold text-white"
        style={{ backgroundImage: "var(--grad)" }}
      >
        {count}
      </span>
    </button>
  );
}
