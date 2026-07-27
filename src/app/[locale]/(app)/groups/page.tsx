import { redirect } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { getInterests, getMyInterestIds } from "@/lib/profile/queries";
import {
  listGroups,
  getMemberCountsByGroup,
  getMyMembershipMap,
  getMyPendingJoinRequestGroupIds,
  listMyGroups,
  getGroupsByIds,
} from "@/lib/groups/queries";
import { getLatestMessagesByGroup } from "@/lib/groups/messages-queries";
import type { GroupCardData, GroupMemberStatus } from "@/lib/groups/types";
import { GroupsPageClient } from "./groups-page-client";

export default async function GroupsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect({ href: "/login", locale });
    return null;
  }

  const [interests, myInterestIds] = await Promise.all([
    getInterests(supabase),
    getMyInterestIds(supabase, user.id),
  ]);
  const interestById = new Map(interests.map((i) => [i.id, i]));

  const discoverRows = await listGroups(supabase, {});
  const discoverIds = discoverRows.map((g) => g.id);
  const [counts, myMemberships, pendingIds] = await Promise.all([
    getMemberCountsByGroup(supabase, discoverIds),
    getMyMembershipMap(supabase, discoverIds, user.id),
    getMyPendingJoinRequestGroupIds(supabase, discoverIds, user.id),
  ]);

  const discoverCards: GroupCardData[] = discoverRows.map((group) => ({
    ...group,
    interest: group.interest_id != null ? (interestById.get(group.interest_id) ?? null) : null,
    memberCount: counts.get(group.id) ?? 0,
    myStatus: (myMemberships.get(group.id)?.status as GroupMemberStatus | undefined) ?? null,
    myPendingJoinRequest: pendingIds.has(group.id),
  }));

  // Default ranking (no explicit filter applied yet): a stable partition,
  // not a numeric sort — groups matching one of the viewer's own interests
  // come first, everything else after, each tier keeping created_at desc.
  const initialDiscoverGroups = [
    ...discoverCards.filter(
      (c) => c.interest_id != null && myInterestIds.includes(c.interest_id)
    ),
    ...discoverCards.filter(
      (c) => !(c.interest_id != null && myInterestIds.includes(c.interest_id))
    ),
  ];

  const myMembershipRows = await listMyGroups(supabase, user.id);
  const myGroupIds = myMembershipRows.map((m) => m.group_id);
  const [myGroupRows, previewByGroup] = await Promise.all([
    getGroupsByIds(supabase, myGroupIds),
    getLatestMessagesByGroup(supabase, myGroupIds),
  ]);
  const myGroupRowById = new Map(myGroupRows.map((g) => [g.id, g]));

  const myGroups = myGroupIds
    .map((id) => myGroupRowById.get(id))
    .filter((g): g is NonNullable<typeof g> => g !== undefined)
    .map((group) => ({
      group,
      memberCount: counts.get(group.id) ?? 0,
      preview: previewByGroup.get(group.id)?.content ?? null,
    }));

  return (
    <GroupsPageClient
      userId={user.id}
      interests={interests}
      myInterestIds={myInterestIds}
      initialDiscoverGroups={initialDiscoverGroups}
      myGroups={myGroups}
    />
  );
}
