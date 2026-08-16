import { notFound } from "next/navigation";
import { redirect } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { getInterests } from "@/lib/profile/queries";
import { getGroupById, getMyGroupMembership } from "@/lib/groups/queries";
import type { GroupMemberRole } from "@/lib/groups/types";
import { GroupSettingsForm } from "@/components/groups/group-settings-form";

export default async function GroupSettingsPage({
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

  const myMembership = await getMyGroupMembership(supabase, id, user.id);
  const myRole =
    myMembership?.status === "active" ? (myMembership.role as GroupMemberRole) : null;
  if (myRole !== "creator" && myRole !== "admin") notFound();

  const interests = await getInterests(supabase);

  return (
    <div className="p-6 md:p-10">
      <h1 className="mb-6 text-2xl font-extrabold text-text">{group.name}</h1>
      <GroupSettingsForm
        groupId={group.id}
        myRole={myRole}
        interests={interests}
        userId={user.id}
        initial={{
          name: group.name,
          description: group.description ?? "",
          avatarUrl: group.avatar_url,
          interestId: group.interest_id,
          invitePermission: group.invite_permission as "all_members" | "admins_only",
        }}
      />
    </div>
  );
}
