import { redirect } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { getInterests, getMyProfile } from "@/lib/profile/queries";
import { geocodeAddress } from "@/lib/geocoding/mapbox";
import { getMyMapVisibility } from "@/lib/map/queries";
import { SearchPageClient } from "./search-page-client";

export default async function SearchPage({
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

  const [interests, profile, mapVisible] = await Promise.all([
    getInterests(supabase),
    getMyProfile(supabase, user.id),
    getMyMapVisibility(supabase, user.id).catch(() => false),
  ]);
  // Same "never block the page on it" fallback as the Découvrir map — see
  // discover/page.tsx.
  const initialCenter = profile?.city ? await geocodeAddress(profile.city) : null;

  return (
    <SearchPageClient
      userId={user.id}
      interests={interests}
      initialCenter={initialCenter}
      initialMapVisible={mapVisible}
    />
  );
}
