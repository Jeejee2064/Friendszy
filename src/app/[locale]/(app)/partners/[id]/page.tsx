import { notFound } from "next/navigation";
import { redirect } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { getInterests } from "@/lib/profile/queries";
import { getPartnerListingById } from "@/lib/partners/queries";
import { PartnerViewClient } from "@/components/partners/partner-view-client";

export default async function PartnerListingPage({
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

  const [interests, listing] = await Promise.all([
    getInterests(supabase),
    getPartnerListingById(supabase, id),
  ]);

  // RLS already hides listings the caller can't see (inactive ones that
  // aren't theirs, unless admin) — a null here means "not found or not
  // visible to you", same UX either way.
  if (!listing) notFound();

  const interest = interests.find((i) => i.id === listing.interest_id) ?? null;
  const isOwn = listing.profile_id === user.id;

  return <PartnerViewClient listing={listing} interest={interest} isOwn={isOwn} />;
}
