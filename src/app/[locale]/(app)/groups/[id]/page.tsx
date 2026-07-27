import { notFound } from "next/navigation";
import { redirect } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { getInterests, getProfilesByIds } from "@/lib/profile/queries";
import {
  getGroupById,
  getMyGroupMembership,
  getGroupMembers,
  getMemberCountsByGroup,
  getMyPendingJoinRequestGroupIds,
  canInviteToGroup,
  isGroupAdmin,
  isGroupCreator,
  listPendingJoinRequests,
} from "@/lib/groups/queries";
import { listGroupMessages } from "@/lib/groups/messages-queries";
import type { GroupMemberWithProfile } from "@/lib/groups/types";
import type { JoinRequestWithProfile } from "@/components/groups/join-request-queue";
import { GroupViewClient } from "@/components/groups/group-view-client";

export default async function GroupPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect({ href: "/login", locale });
    return null;
  }

  const group = await getGroupById(supabase, id);
  if (!group) notFound();

  const [interests, myMembership, [memberCount]] = await Promise.all([
    getInterests(supabase),
    getMyGroupMembership(supabase, id, user.id),
    getMemberCountsByGroup(supabase, [id]).then((counts) => [counts.get(id) ?? 0]),
  ]);
  const interest =
    group.interest_id != null
      ? (interests.find((i) => i.id === group.interest_id) ?? null)
      : null;

  const isActiveMember = myMembership?.status === "active";

  if (!isActiveMember) {
    const pendingIds = await getMyPendingJoinRequestGroupIds(supabase, [id], user.id);
    return (
      <GroupViewClient
        userId={user.id}
        group={group}
        interest={interest}
        memberCount={memberCount}
        myMembership={myMembership}
        members={[]}
        initialMessages={[]}
        initialSenders={[]}
        canInvite={false}
        pendingRequests={[]}
        myPendingJoinRequest={pendingIds.has(id)}
      />
    );
  }

  const [memberRows, messages, canInvite, admin, creator] = await Promise.all([
    getGroupMembers(supabase, id, ["active", "excluded"]),
    listGroupMessages(supabase, id),
    canInviteToGroup(supabase, id),
    isGroupAdmin(supabase, id),
    isGroupCreator(supabase, id),
  ]);
  const isAdminOrCreator = admin || creator;

  const memberProfileIds = [...new Set(memberRows.map((m) => m.profile_id))];
  const senderIds = [...new Set(messages.map((m) => m.sender_id))];
  const profileIds = [...new Set([...memberProfileIds, ...senderIds])];
  const profiles = await getProfilesByIds(supabase, profileIds);
  const profileById = new Map(profiles.map((p) => [p.id, p]));

  const members: GroupMemberWithProfile[] = memberRows
    .map((row) => {
      const profile = profileById.get(row.profile_id);
      return profile ? { ...row, profile } : null;
    })
    .filter((m): m is GroupMemberWithProfile => m !== null);

  const initialSenders = senderIds
    .map((sid) => profileById.get(sid))
    .filter((p): p is NonNullable<typeof p> => p !== undefined);

  let pendingRequests: JoinRequestWithProfile[] = [];
  if (isAdminOrCreator) {
    const requestRows = await listPendingJoinRequests(supabase, id);
    const requesterIds = [...new Set(requestRows.map((r) => r.profile_id))];
    const requesterProfiles = await getProfilesByIds(supabase, requesterIds);
    const requesterById = new Map(requesterProfiles.map((p) => [p.id, p]));
    pendingRequests = requestRows
      .map((row) => {
        const profile = requesterById.get(row.profile_id);
        return profile ? { ...row, profile } : null;
      })
      .filter((r): r is JoinRequestWithProfile => r !== null);
  }

  return (
    <GroupViewClient
      userId={user.id}
      group={group}
      interest={interest}
      memberCount={memberCount}
      myMembership={myMembership}
      members={members}
      initialMessages={messages}
      initialSenders={initialSenders}
      canInvite={canInvite}
      pendingRequests={pendingRequests}
      myPendingJoinRequest={false}
    />
  );
}
