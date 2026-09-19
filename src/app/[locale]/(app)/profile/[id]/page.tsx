import { notFound } from "next/navigation";
import { redirect } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  getMyProfile,
  getMyInterestIds,
  getInterests,
  getProfilePhotos,
} from "@/lib/profile/queries";
import { getInterestsForProfiles } from "@/lib/search/queries";
import { getFriendshipMap } from "@/lib/friends/queries";
import {
  getInterestedEventIds,
  getEventsByIds,
  getRegistrationCountsByEvent,
  getMyRegisteredEventIds,
  getCoverPhotosByEvent,
} from "@/lib/events/queries";
import type { EventCardData } from "@/lib/events/types";
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

  const [interests, myInterestIds, interestsByProfile, friendshipMap, photos, interestedEventIds] =
    await Promise.all([
      getInterests(supabase),
      getMyInterestIds(supabase, user.id),
      getInterestsForProfiles(supabase, [id]),
      getFriendshipMap(supabase, user.id),
      getProfilePhotos(supabase, id),
      getInterestedEventIds(supabase, id),
    ]);

  const interestedEventRows = await getEventsByIds(supabase, interestedEventIds);
  const [registrationCounts, myRegisteredIds, coverPhotos] = await Promise.all([
    getRegistrationCountsByEvent(supabase, interestedEventIds),
    getMyRegisteredEventIds(supabase, interestedEventIds, user.id),
    getCoverPhotosByEvent(supabase, interestedEventIds),
  ]);
  const interestById = new Map(interests.map((i) => [i.id, i]));
  const interestedEvents: EventCardData[] = interestedEventRows.map((event) => ({
    ...event,
    interest: interestById.get(event.interest_id) ?? null,
    coverPhotoUrl: coverPhotos.get(event.id) ?? null,
    registrationCount: registrationCounts.get(event.id) ?? 0,
    isRegistered: myRegisteredIds.has(event.id),
  }));

  return (
    <PublicProfileClient
      userId={user.id}
      profile={profile}
      interests={interests}
      profileInterestIds={interestsByProfile.get(id) ?? []}
      myInterestIds={myInterestIds}
      friendshipInfo={friendshipMap.get(id) ?? null}
      photos={photos.map((photo) => photo.url)}
      interestedEvents={interestedEvents}
    />
  );
}
