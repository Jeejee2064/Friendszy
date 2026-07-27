"use client";

import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import {
  getGroupMembers,
  setGroupMemberRole,
  excludeGroupMember,
  banGroupMember,
  leaveGroup,
  addOrReactivateGroupMember,
} from "@/lib/groups/queries";
import type { GroupMemberWithProfile, GroupMemberRole } from "@/lib/groups/types";

export function MemberList({
  groupId,
  myId,
  myRole,
  members: initialMembers,
  onLeave,
}: {
  groupId: string;
  myId: string;
  myRole: GroupMemberRole;
  members: GroupMemberWithProfile[];
  onLeave?: () => void;
}) {
  const t = useTranslations("Groups");
  const tCommon = useTranslations("Common");
  const [members, setMembers] = useState(initialMembers);
  const [busyId, setBusyId] = useState<string | null>(null);

  const isCreator = myRole === "creator";
  const isAdmin = myRole === "admin" || isCreator;

  async function refetch() {
    const supabase = createClient();
    const fresh = await getGroupMembers(supabase, groupId, ["active", "excluded"]);
    setMembers((prev) => {
      const profileById = new Map(prev.map((m) => [m.profile_id, m.profile]));
      return fresh
        .map((row) => {
          const profile = profileById.get(row.profile_id);
          return profile ? { ...row, profile } : null;
        })
        .filter((m): m is GroupMemberWithProfile => m !== null);
    });
  }

  async function runAction(profileId: string, action: () => Promise<void>) {
    setBusyId(profileId);
    try {
      await action();
      await refetch();
    } finally {
      setBusyId(null);
    }
  }

  function canManage(target: GroupMemberWithProfile) {
    if (target.profile_id === myId) return false;
    if (!isAdmin) return false;
    if (isCreator) return true;
    // Admins can only act on plain members, never another admin or the creator.
    return target.role === "member";
  }

  const active = members.filter((m) => m.status === "active");
  const excluded = members.filter((m) => m.status === "excluded");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        {active.map((member) => (
          <MemberRow
            key={member.profile_id}
            member={member}
            deletedUserLabel={tCommon("deletedUser")}
            roleLabel={member.role !== "member" ? t(`role_${member.role}`) : null}
            actions={
              member.profile_id === myId ? (
                <button
                  type="button"
                  disabled={busyId === myId}
                  onClick={() =>
                    runAction(myId, async () => {
                      await leaveGroup(createClient(), groupId, myId);
                      onLeave?.();
                    })
                  }
                  className="text-xs font-semibold text-[#e55] disabled:opacity-60"
                >
                  {t("leaveGroup")}
                </button>
              ) : canManage(member) ? (
                <div
                  className={`flex flex-wrap items-center gap-3 text-xs font-semibold ${
                    busyId === member.profile_id ? "pointer-events-none opacity-60" : ""
                  }`}
                >
                  {member.role === "member" ? (
                    <button
                      type="button"
                      onClick={() =>
                        runAction(member.profile_id, () =>
                          setGroupMemberRole(createClient(), groupId, member.profile_id, "admin")
                        )
                      }
                      className="text-teal2"
                    >
                      {t("promote")}
                    </button>
                  ) : (
                    isCreator && (
                      <button
                        type="button"
                        onClick={() =>
                          runAction(member.profile_id, () =>
                            setGroupMemberRole(createClient(), groupId, member.profile_id, "member")
                          )
                        }
                        className="text-teal2"
                      >
                        {t("demote")}
                      </button>
                    )
                  )}
                  <button
                    type="button"
                    onClick={() =>
                      runAction(member.profile_id, () =>
                        excludeGroupMember(createClient(), groupId, member.profile_id)
                      )
                    }
                    className="text-muted"
                  >
                    {t("exclude")}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      runAction(member.profile_id, () =>
                        banGroupMember(createClient(), groupId, member.profile_id)
                      )
                    }
                    className="text-[#e55]"
                  >
                    {t("ban")}
                  </button>
                </div>
              ) : null
            }
          />
        ))}
      </div>

      {isAdmin && excluded.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-bold uppercase tracking-wide text-muted">
            {t("excludedMembers")}
          </p>
          {excluded.map((member) => (
            <MemberRow
              key={member.profile_id}
              member={member}
              deletedUserLabel={tCommon("deletedUser")}
              roleLabel={null}
              actions={
                canManage(member) ? (
                  <div
                    className={`flex items-center gap-3 text-xs font-semibold ${
                      busyId === member.profile_id ? "pointer-events-none opacity-60" : ""
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() =>
                        runAction(member.profile_id, () =>
                          addOrReactivateGroupMember(createClient(), groupId, member.profile_id)
                        )
                      }
                      className="text-teal2"
                    >
                      {t("readmit")}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        runAction(member.profile_id, () =>
                          banGroupMember(createClient(), groupId, member.profile_id)
                        )
                      }
                      className="text-[#e55]"
                    >
                      {t("ban")}
                    </button>
                  </div>
                ) : null
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

function MemberRow({
  member,
  deletedUserLabel,
  roleLabel,
  actions,
}: {
  member: GroupMemberWithProfile;
  deletedUserLabel: string;
  roleLabel: string | null;
  actions: ReactNode;
}) {
  const displayName = member.profile.full_name
    ? [member.profile.full_name, member.profile.last_name].filter(Boolean).join(" ")
    : deletedUserLabel;
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border p-3">
      <div
        className="h-10 w-10 shrink-0 overflow-hidden rounded-full"
        style={!member.profile.avatar_url ? { backgroundImage: "var(--grad)" } : undefined}
      >
        {member.profile.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={member.profile.avatar_url}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm font-bold text-white">
            {displayName.charAt(0).toUpperCase()}
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-bold text-text">{displayName}</p>
        {roleLabel && <p className="text-xs font-semibold text-teal2">{roleLabel}</p>}
      </div>
      {actions}
    </div>
  );
}
