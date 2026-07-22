"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import { getOrCreateConversation } from "@/lib/messages/queries";
import {
  sendFriendRequest,
  respondToFriendRequest,
  type FriendshipInfo,
} from "@/lib/friends/queries";
import { useRefreshPendingRequests } from "@/lib/friends/pending-context";
import type { Interest } from "@/lib/profile/types";
import type { Database } from "@/types/supabase";
import { PageHeader } from "@/components/layout/page-header";
import { OnlineDot } from "@/components/social/online-dot";
import { ReportButton } from "@/components/social/report-button";
import { BlockButton } from "@/components/social/block-button";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

export function PublicProfileClient({
  userId,
  profile,
  interests,
  profileInterestIds,
  myInterestIds,
  friendshipInfo,
}: {
  userId: string;
  profile: ProfileRow;
  interests: Interest[];
  profileInterestIds: number[];
  myInterestIds: number[];
  friendshipInfo: FriendshipInfo | null;
}) {
  const t = useTranslations("Friends");
  const tCommon = useTranslations("Common");
  const tGender = useTranslations("Gender");
  const tFields = useTranslations("ProfileFields");
  const locale = useLocale();
  const router = useRouter();
  const refreshPendingRequests = useRefreshPendingRequests();

  const [status, setStatus] = useState(friendshipInfo?.status ?? null);
  const [messaging, setMessaging] = useState(false);
  const [sendingRequest, setSendingRequest] = useState(false);
  const [responding, setResponding] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const displayName = profile.full_name ?? tCommon("deletedUser");
  const isDeleted = !profile.full_name;

  const interestLabel = (id: number) => {
    const interest = interests.find((i) => i.id === id);
    if (!interest) return "";
    return locale === "en" ? interest.label_en : interest.label_fr;
  };

  const sortedInterestIds = [...profileInterestIds].sort((a, b) => {
    const aShared = myInterestIds.includes(a) ? 0 : 1;
    const bShared = myInterestIds.includes(b) ? 0 : 1;
    return aShared - bShared;
  });
  const visibleInterestIds = expanded ? sortedInterestIds : sortedInterestIds.slice(0, 3);
  const hiddenCount = sortedInterestIds.length - visibleInterestIds.length;

  async function handleMessage() {
    setMessaging(true);
    try {
      const supabase = createClient();
      const conversationId = await getOrCreateConversation(supabase, userId, profile.id);
      router.push(`/messages?c=${conversationId}`);
    } finally {
      setMessaging(false);
    }
  }

  async function handleAddFriend() {
    setSendingRequest(true);
    try {
      const supabase = createClient();
      await sendFriendRequest(supabase, userId, profile.id);
      setStatus("pending_sent");
    } catch {
      setSendingRequest(false);
    }
  }

  async function handleRespond(accept: boolean) {
    if (!friendshipInfo) return;
    setResponding(true);
    try {
      const supabase = createClient();
      await respondToFriendRequest(supabase, friendshipInfo.friendshipId, accept);
      setStatus(accept ? "accepted" : null);
      refreshPendingRequests();
    } finally {
      setResponding(false);
    }
  }

  return (
    <div className="flex flex-col">
      <PageHeader title={displayName} />

      <div className="p-6 md:p-10">
        <div className="mx-auto flex max-w-lg flex-col items-center gap-4 rounded-2xl border border-border bg-card p-8 text-center">
          <div className="relative h-24 w-24 shrink-0">
            <div
              className="h-24 w-24 overflow-hidden rounded-full"
              style={!profile.avatar_url ? { backgroundImage: "var(--grad)" } : undefined}
            >
              {profile.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={profile.avatar_url}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-3xl font-bold text-white">
                  {displayName.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <OnlineDot
              userId={profile.id}
              className="absolute bottom-1 right-1 h-4 w-4"
            />
          </div>

          <div>
            <p className="text-xl font-extrabold text-text">{displayName}</p>
            <p className="text-sm text-muted">
              {[profile.city, profile.age].filter(Boolean).join(" · ")}
              {profile.gender ? ` · ${tGender(profile.gender)}` : ""}
            </p>
          </div>

          {profile.bio && <p className="text-sm text-text">{profile.bio}</p>}

          {sortedInterestIds.length > 0 && (
            <div className="flex flex-col items-center gap-2">
              <div className="flex flex-wrap justify-center gap-2">
                {visibleInterestIds.map((id) => {
                  const shared = myInterestIds.includes(id);
                  return (
                    <span
                      key={id}
                      className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${
                        shared ? "border-teal2 text-teal2" : "border-border text-text"
                      }`}
                    >
                      {shared ? "✓ " : ""}
                      {interestLabel(id)}
                    </span>
                  );
                })}
              </div>
              {sortedInterestIds.length > 3 && (
                <button
                  type="button"
                  onClick={() => setExpanded((prev) => !prev)}
                  className="text-xs font-semibold text-teal2 hover:underline"
                >
                  {expanded ? tFields("showLess") : tFields("showMore", { count: hiddenCount })}
                </button>
              )}
            </div>
          )}

          {!isDeleted && (
            <div className="mt-2 flex w-full flex-col items-center gap-3">
              <div className="flex w-full flex-col gap-2">
                <button
                  onClick={handleMessage}
                  disabled={messaging}
                  className="w-full rounded-full px-6 py-2.5 text-sm font-bold text-white disabled:opacity-60"
                  style={{ backgroundImage: "var(--grad)" }}
                >
                  💬 {t("message")}
                </button>

                {status === "accepted" ? (
                  <span className="text-center text-xs font-semibold text-teal2">
                    {t("friendsBadge")}
                  </span>
                ) : status === "pending_received" ? (
                  <div className="flex flex-col gap-2">
                    <span className="text-center text-xs text-muted">
                      {t("theySentYouRequest")}
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleRespond(true)}
                        disabled={responding}
                        className="flex-1 rounded-full px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
                        style={{ backgroundImage: "var(--grad)" }}
                      >
                        {t("accept")}
                      </button>
                      <button
                        onClick={() => handleRespond(false)}
                        disabled={responding}
                        className="flex-1 rounded-full border border-border px-4 py-2 text-sm font-semibold text-muted disabled:opacity-60"
                      >
                        {t("decline")}
                      </button>
                    </div>
                  </div>
                ) : status === "pending_sent" ? (
                  <span className="text-center text-xs text-muted">{t("requestSent")}</span>
                ) : status === "declined_by_them" ? (
                  <span className="text-center text-xs text-muted">
                    {t("theyDeclinedYourRequest")}
                  </span>
                ) : (
                  <button
                    onClick={handleAddFriend}
                    disabled={sendingRequest}
                    className="w-full rounded-full border-2 border-teal2 px-6 py-2 text-sm font-bold text-teal2 disabled:opacity-60"
                  >
                    + {t("addFriend")}
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full border border-border">
                  <ReportButton
                    reporterId={userId}
                    targetType="profile"
                    targetId={profile.id}
                    compact
                  />
                </div>
                <div className="flex h-8 w-8 items-center justify-center rounded-full border border-border">
                  <BlockButton
                    blockerId={userId}
                    blockedId={profile.id}
                    blockedName={displayName}
                    onBlocked={() => router.push("/friends")}
                    compact
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
