import { redirect } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { getInterests } from "@/lib/profile/queries";
import { PartnerListingWizard } from "@/components/partners/partner-listing-wizard";

export default async function NewPartnerListingPage({
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

  const interests = await getInterests(supabase);

  return <PartnerListingWizard userId={user.id} interests={interests} mode="create" />;
}
