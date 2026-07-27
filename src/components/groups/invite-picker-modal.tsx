"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { Modal } from "@/components/ui/modal";
import { PersonCard } from "@/components/social/person-card";
import { listFriends } from "@/lib/friends/queries";
import { searchProfiles } from "@/lib/search/queries";
import { getGroupMembers, addOrReactivateGroupMember } from "@/lib/groups/queries";
import type { ProfileSummary } from "@/lib/profile/types";

type Tab = "friends" | "name" | "interest";

export function InvitePickerModal({
  open,
  onClose,
  groupId,
  groupInterestId,
  myId,
}: {
  open: boolean;
  onClose: () => void;
  groupId: string;
  groupInterestId: number | null;
  myId: string;
}) {
  const t = useTranslations("Groups");
  const tCommon = useTranslations("Common");

  const [tab, setTab] = useState<Tab>("friends");
  const [friends, setFriends] = useState<ProfileSummary[]>([]);
  const [nameQuery, setNameQuery] = useState("");
  const [nameResults, setNameResults] = useState<ProfileSummary[]>([]);
  const [interestResults, setInterestResults] = useState<ProfileSummary[]>([]);
  const [interestLoaded, setInterestLoaded] = useState(false);
  const [excludedIds, setExcludedIds] = useState<Set<string>>(new Set());
  const [invited, setInvited] = useState<Set<string>>(new Set());
  const [invitingId, setInvitingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Reset + load friends/existing-members once each time the modal opens.
  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTab("friends");
    setNameQuery("");
    setNameResults([]);
    setInterestResults([]);
    setInterestLoaded(false);
    setInvited(new Set());

    const supabase = createClient();
    Promise.all([
      listFriends(supabase, myId),
      getGroupMembers(supabase, groupId, ["active", "banned"]),
    ]).then(([friendList, existingMembers]) => {
      setFriends(friendList);
      setExcludedIds(new Set(existingMembers.map((m) => m.profile_id)));
    });
  }, [open, groupId, myId]);

  useEffect(() => {
    if (!open || tab !== "name") return;
    if (!nameQuery.trim()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setNameResults([]);
      return;
    }
    const supabase = createClient();
    const timeout = setTimeout(() => {
      setLoading(true);
      searchProfiles(supabase, { name: nameQuery }, myId)
        .then(setNameResults)
        .finally(() => setLoading(false));
    }, 400);
    return () => clearTimeout(timeout);
  }, [open, tab, nameQuery, myId]);

  useEffect(() => {
    if (!open || tab !== "interest" || groupInterestId == null || interestLoaded) return;
    const supabase = createClient();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    searchProfiles(supabase, { interestIds: [groupInterestId] }, myId)
      .then((results) => {
        setInterestResults(results);
        setInterestLoaded(true);
      })
      .finally(() => setLoading(false));
  }, [open, tab, groupInterestId, myId, interestLoaded]);

  async function handleInvite(profileId: string) {
    setInvitingId(profileId);
    try {
      const supabase = createClient();
      await addOrReactivateGroupMember(supabase, groupId, profileId);
      setInvited((prev) => new Set(prev).add(profileId));
    } finally {
      setInvitingId(null);
    }
  }

  const candidates =
    tab === "friends" ? friends : tab === "name" ? nameResults : interestResults;
  const visibleCandidates = candidates.filter((p) => !excludedIds.has(p.id));

  return (
    <Modal open={open} onClose={onClose} title={t("inviteModalTitle")}>
      <div className="mb-4 flex gap-1 rounded-full bg-bg p-1 text-xs font-bold">
        <TabButton active={tab === "friends"} onClick={() => setTab("friends")}>
          {t("inviteFriendsTab")}
        </TabButton>
        <TabButton active={tab === "name"} onClick={() => setTab("name")}>
          {t("inviteNameTab")}
        </TabButton>
        <TabButton active={tab === "interest"} onClick={() => setTab("interest")}>
          {t("inviteInterestTab")}
        </TabButton>
      </div>

      {tab === "name" && (
        <input
          type="text"
          value={nameQuery}
          onChange={(e) => setNameQuery(e.target.value)}
          placeholder={t("inviteNamePlaceholder")}
          className="mb-4 w-full rounded-lg border border-border px-3 py-2.5 text-sm outline-none focus:border-teal2"
        />
      )}

      <div className="flex max-h-[50vh] flex-col gap-3 overflow-y-auto pr-1">
        {loading ? (
          <p className="text-center text-sm text-muted">{t("loading")}</p>
        ) : visibleCandidates.length === 0 ? (
          <p className="text-center text-sm text-muted">{t("inviteNoResults")}</p>
        ) : (
          visibleCandidates.map((profile) => (
            <PersonCard
              key={profile.id}
              profile={profile}
              deletedUserLabel={tCommon("deletedUser")}
              footer={
                invited.has(profile.id) ? (
                  <span className="text-center text-xs font-semibold text-teal2">
                    {t("invited")}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleInvite(profile.id)}
                    disabled={invitingId === profile.id}
                    className="w-full rounded-full px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
                    style={{ backgroundImage: "var(--grad)" }}
                  >
                    {t("invite")}
                  </button>
                )
              }
            />
          ))
        )}
      </div>
    </Modal>
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
      className={`flex-1 rounded-full px-3 py-1.5 uppercase transition-colors ${
        active ? "text-white" : "text-muted"
      }`}
      style={active ? { backgroundImage: "var(--grad)" } : undefined}
    >
      {children}
    </button>
  );
}
