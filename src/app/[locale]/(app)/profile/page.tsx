import { redirect } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { getInterests, getMyProfile, getMyInterestIds } from "@/lib/profile/queries";
import type { Gender } from "@/lib/profile/types";
import { ProfileForm } from "./profile-form";

export default async function ProfilePage({
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

  const [profile, interests, interestIds] = await Promise.all([
    getMyProfile(supabase, user.id),
    getInterests(supabase),
    getMyInterestIds(supabase, user.id),
  ]);

  // A temporary city trip (Premium) puts the *travel* destination in
  // profiles.city and stashes the real one in profiles.home_city — see
  // supabase/migrations/20260908180000_profiles_temporary_city.sql. pg_cron
  // reverts it within ~15min of expiry, but this page can still catch a
  // just-expired row a beat early by checking the timestamp itself, so the
  // editable city field never shows a stale destination as "home".
  const tripActive = Boolean(
    profile?.temporary_city_until && new Date(profile.temporary_city_until) > new Date()
  );

  return (
    <ProfileForm
      userId={user.id}
      interests={interests}
      plan={profile?.plan ?? "free"}
      temporaryCity={{
        homeCity: (tripActive ? profile?.home_city : profile?.city) ?? null,
        activeCity: tripActive ? profile?.city ?? null : null,
        activeUntil: tripActive ? profile?.temporary_city_until ?? null : null,
      }}
      initial={{
        fullName: profile?.full_name ?? "",
        lastName: profile?.last_name ?? "",
        avatarUrl: profile?.avatar_url ?? null,
        city: (tripActive ? profile?.home_city : profile?.city) ?? "",
        age: profile?.age ?? null,
        gender: (profile?.gender as Gender | null) ?? null,
        interestIds,
        bio: profile?.bio ?? "",
      }}
    />
  );
}
