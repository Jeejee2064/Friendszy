"use client";

import { useState, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import { requestToJoinGroup } from "@/lib/groups/queries";
import type {
  GroupRow,
  GroupMemberRow,
  GroupMemberRole,
  GroupMemberWithProfile,
  GroupMessageRow,
} from "@/lib/groups/types";
import type { Interest, ProfileSummary } from "@/lib/profile/types";
import { MemberList } from "@/components/groups/member-list";
import { GroupChatPane } from "@/components/groups/group-chat-pane";
import {
  JoinRequestQueue,
  type JoinRequestWithProfile,
} from "@/components/groups/join-request-queue";
import { InvitePickerModal } from "@/components/groups/invite-picker-modal";

type Tab = "chat" | "members" | "requests";

export function GroupViewClient({
  userId,
  group,
  interest,
  memberCount,
  myMembership,
  members,
  initialMessages,
  initialSenders,
  canInvite,
  pendingRequests,
  myPendingJoinRequest,
}: {
  userId: string;
  group: GroupRow;
  interest: Interest | null;
  memberCount: number;
  myMembership: GroupMemberRow | null;
  members: GroupMemberWithProfile[];
  initialMessages: GroupMessageRow[];
  initialSenders: ProfileSummary[];
  canInvite: boolean;
  pendingRequests: JoinRequestWithProfile[];
  myPendingJoinRequest: boolean;
}) {
  const t = useTranslations("Groups");
  const locale = useLocale();
  const router = useRouter();

  const isActiveMember = myMembership?.status === "active";
  const isBanned = myMembership?.status === "banned";
  const myRole = (isActiveMember ? (myMembership?.role as GroupMemberRole) : null) ?? null;
  const isAdminOrCreator = myRole === "admin" || myRole === "creator";

  const [tab, setTab] = useState<Tab>("chat");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [requested, setRequested] = useState(myPendingJoinRequest);
  const [requesting, setRequesting] = useState(false);
  const [pendingCount, setPendingCount] = useState(pendingRequests.length);
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  // Rough heuristic for "would this actually get cut off" — no reliable way
  // to know the true rendered width up front (it varies by breakpoint), so
  // this just avoids showing a pointless toggle on a description that was
  // never going to truncate in the first place.
  const descriptionMayTruncate = (group.description?.length ?? 0) > 60;

  async function handleRequestJoin() {
    setRequesting(true);
    try {
      const supabase = createClient();
      await requestToJoinGroup(supabase, group.id, userId);
      setRequested(true);
    } finally {
      setRequesting(false);
    }
  }

  const headerBlock = (
    // Stacked below sm, side-by-side from sm up — deliberately not relying
    // on flex-wrap here: min-w-0 on the name/description column lets it
    // shrink all the way to nothing before a wrap ever triggers, which is
    // what let the action buttons and the interest badge collide on narrow
    // screens instead of ever dropping to their own line.
    <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-start sm:gap-4">
      <div className="flex min-w-0 items-start gap-3 sm:flex-1 sm:gap-4">
        <div
          className="h-11 w-11 shrink-0 overflow-hidden rounded-full sm:h-14 sm:w-14"
          style={!group.avatar_url ? { backgroundImage: "var(--grad)" } : undefined}
        >
          {group.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={group.avatar_url} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-lg font-bold text-white">
              {group.name.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold text-text">{group.name}</p>
          {group.description && descriptionMayTruncate ? (
            <button
              type="button"
              onClick={() => setDescriptionExpanded((prev) => !prev)}
              className="flex w-full items-start gap-1 text-left text-sm text-muted"
            >
              <span className={descriptionExpanded ? "" : "truncate"}>{group.description}</span>
              <span
                className={`mt-0.5 shrink-0 text-xs transition-transform ${
                  descriptionExpanded ? "rotate-180" : ""
                }`}
              >
                ⌄
              </span>
            </button>
          ) : (
            group.description && <p className="truncate text-sm text-muted">{group.description}</p>
          )}
          <div className="mt-1 flex flex-wrap items-center gap-2">
            {interest && (
              <span className="rounded-full border border-teal2 px-2.5 py-0.5 text-xs font-semibold text-teal2">
                {interest.emoji ? `${interest.emoji} ` : ""}
                {locale === "en" ? interest.label_en : interest.label_fr}
              </span>
            )}
            <span className="text-xs text-muted">{t("memberCount", { count: memberCount })}</span>
          </div>
        </div>
      </div>
      {isActiveMember && (
        <div className="ml-auto flex shrink-0 items-center gap-2">
          {canInvite && (
            <button
              type="button"
              onClick={() => setInviteOpen(true)}
              className="rounded-full px-3 py-1.5 text-sm font-bold text-white sm:px-4 sm:py-2"
              style={{ backgroundImage: "var(--grad)" }}
            >
              {t("invite")}
            </button>
          )}
          {isAdminOrCreator && (
            <Link
              href={`/groups/${group.id}/settings`}
              className="rounded-full border border-border px-3 py-1.5 text-sm font-bold text-text sm:px-4 sm:py-2"
              aria-label={t("settingsLink")}
            >
              ⚙️
            </Link>
          )}
        </div>
      )}
    </div>
  );

  if (!isActiveMember) {
    return (
      <div className="flex h-screen flex-col">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-4 md:p-6">
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border bg-card">
            {headerBlock}
            <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
              {isBanned ? (
                <p className="text-sm text-muted">{t("bannedNotice")}</p>
              ) : requested ? (
                <p className="text-sm text-muted">{t("requestSent")}</p>
              ) : (
                <button
                  type="button"
                  onClick={handleRequestJoin}
                  disabled={requesting}
                  className="rounded-full border border-teal2 px-6 py-2.5 text-sm font-bold text-teal2 disabled:opacity-60"
                >
                  {t("requestToJoin")}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-4 md:p-6">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border bg-card">
          {headerBlock}

          <div className="flex gap-2 border-b border-border px-4 py-2">
            <TabButton active={tab === "chat"} onClick={() => setTab("chat")}>
              {t("chatTab")}
            </TabButton>
            <TabButton active={tab === "members"} onClick={() => setTab("members")}>
              {t("membersTab")}
            </TabButton>
            {isAdminOrCreator && (
              <TabButton active={tab === "requests"} onClick={() => setTab("requests")}>
                {t("requestsTab")}
                {pendingCount > 0 && (
                  <span className="ml-1.5 rounded-full bg-white/25 px-1.5 text-xs">
                    {pendingCount}
                  </span>
                )}
              </TabButton>
            )}
          </div>

          {tab === "chat" && (
            <GroupChatPane
              groupId={group.id}
              userId={userId}
              isAdmin={isAdminOrCreator}
              initialMessages={initialMessages}
              initialSenders={initialSenders}
            />
          )}
          {tab === "members" && myRole && (
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              <MemberList
                groupId={group.id}
                myId={userId}
                myRole={myRole}
                members={members}
                onLeave={() => router.push("/groups")}
              />
            </div>
          )}
          {tab === "requests" && isAdminOrCreator && (
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              <JoinRequestQueue initialRequests={pendingRequests} onCountChange={setPendingCount} />
            </div>
          )}
        </div>
      </div>

      <InvitePickerModal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        groupId={group.id}
        groupInterestId={group.interest_id}
        myId={userId}
      />
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
      className={`flex items-center rounded-full px-4 py-1.5 text-sm font-bold transition-colors ${
        active ? "text-white" : "text-muted"
      }`}
      style={active ? { backgroundImage: "var(--grad)" } : undefined}
    >
      {children}
    </button>
  );
}
