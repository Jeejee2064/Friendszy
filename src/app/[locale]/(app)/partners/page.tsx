import { redirect } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { getInterests } from "@/lib/profile/queries";
import { listPartnerListings } from "@/lib/partners/queries";
import { PartnersPageClient } from "./partners-page-client";

export default async function PartnersPage({
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

  const [interests, listings] = await Promise.all([
    getInterests(supabase),
    listPartnerListings(supabase, {}),
  ]);

  return (
    <PartnersPageClient
      userId={user.id}
      interests={interests}
      initialListings={listings}
    />
  );
}
