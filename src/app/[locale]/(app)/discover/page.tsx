import { redirect } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { getInterests, getMyProfile } from "@/lib/profile/queries";
import { geocodeAddress } from "@/lib/geocoding/mapbox";
import { haversineDistanceKm } from "@/lib/geocoding/distance";
import {
  listEvents,
  getRegistrationCountsByEvent,
  getMyRegisteredEventIds,
  getCoverPhotosByEvent,
} from "@/lib/events/queries";
import type { EventCardData } from "@/lib/events/types";
import { listPartnerListings } from "@/lib/partners/queries";
import { DiscoverPageClient } from "./discover-page-client";

export default async function DiscoverPage({
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

  const [interests, events, listings, profile] = await Promise.all([
    getInterests(supabase),
    listEvents(supabase, {}),
    listPartnerListings(supabase, {}),
    getMyProfile(supabase, user.id),
  ]);
  // Centers the map on the viewer's own city by default — never blocks the
  // page on it, and silently falls back to the province-wide default view
  // (inside MapView) if there's no city on file or geocoding fails.
  const initialCenter = profile?.city ? await geocodeAddress(profile.city) : null;

  const eventIds = events.map((e) => e.id);
  const [counts, myRegistered, coverPhotos] = await Promise.all([
    getRegistrationCountsByEvent(supabase, eventIds),
    getMyRegisteredEventIds(supabase, eventIds, user.id),
    getCoverPhotosByEvent(supabase, eventIds),
  ]);
  const interestById = new Map(interests.map((i) => [i.id, i]));

  const initialEvents: EventCardData[] = events.map((event) => ({
    ...event,
    interest: interestById.get(event.interest_id) ?? null,
    coverPhotoUrl: coverPhotos.get(event.id) ?? null,
    registrationCount: counts.get(event.id) ?? 0,
    isRegistered: myRegistered.has(event.id),
  }));

  // Partner listings sort by proximity to the viewer's own city when it's
  // known — otherwise they keep listPartnerListings' own created_at desc
  // order (the "most recently added" fallback), no extra code needed for
  // that case.
  const initialListings = initialCenter
    ? [...listings].sort((a, b) => {
        const da =
          a.latitude != null && a.longitude != null
            ? haversineDistanceKm(initialCenter, { latitude: a.latitude, longitude: a.longitude })
            : Infinity;
        const db =
          b.latitude != null && b.longitude != null
            ? haversineDistanceKm(initialCenter, { latitude: b.latitude, longitude: b.longitude })
            : Infinity;
        return da - db;
      })
    : listings;

  return (
    <DiscoverPageClient
      userId={user.id}
      interests={interests}
      initialEvents={initialEvents}
      initialListings={initialListings}
      initialCenter={initialCenter}
    />
  );
}
