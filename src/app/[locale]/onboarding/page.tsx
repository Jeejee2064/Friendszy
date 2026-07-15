import { redirect } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { getInterests, getMyProfile, getMyInterestIds } from "@/lib/profile/queries";
import type { Gender } from "@/lib/profile/types";
import { OnboardingWizard } from "./onboarding-wizard";

export default async function OnboardingPage({
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

  return (
    <OnboardingWizard
      userId={user.id}
      interests={interests}
      initial={{
        fullName: profile?.full_name ?? "",
        avatarUrl: profile?.avatar_url ?? null,
        city: profile?.city ?? "",
        age: profile?.age ?? null,
        gender: (profile?.gender as Gender | null) ?? null,
        interestIds,
        bio: profile?.bio ?? "",
      }}
    />
  );
}
