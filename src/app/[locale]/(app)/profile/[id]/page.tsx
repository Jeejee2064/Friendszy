import { notFound } from "next/navigation";
import { redirect } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyProfile, getMyInterestIds, getInterests } from "@/lib/profile/queries";
import { getInterestsForProfiles } from "@/lib/search/queries";
import { getFriendshipMap } from "@/lib/friends/queries";
import { PublicProfileClient } from "./public-profile-client";

export default async function PublicProfilePage({
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

  if (id === user.id) {
    redirect({ href: "/profile", locale });
    return null;
  }

  const profile = await getMyProfile(supabase, id);
  if (!profile) notFound();

  const [interests, myInterestIds, interestsByProfile, friendshipMap] = await Promise.all([
    getInterests(supabase),
    getMyInterestIds(supabase, user.id),
    getInterestsForProfiles(supabase, [id]),
    getFriendshipMap(supabase, user.id),
  ]);

  return (
    <PublicProfileClient
      userId={user.id}
      profile={profile}
      interests={interests}
      profileInterestIds={interestsByProfile.get(id) ?? []}
      myInterestIds={myInterestIds}
      friendshipInfo={friendshipMap.get(id) ?? null}
    />
  );
}
