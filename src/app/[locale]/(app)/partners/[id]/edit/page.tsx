import { redirect } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { getInterests } from "@/lib/profile/queries";
import { getPartnerListingById } from "@/lib/partners/queries";
import { PartnerListingWizard } from "@/components/partners/partner-listing-wizard";
import type { OpeningHours } from "@/lib/partners/opening-hours";

export default async function EditPartnerListingPage({
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

  // RLS already hides listings the caller doesn't own (unless admin) — a
  // null here means "not found or not yours", same UX either way. Editing
  // is creator-only even for admins (they only get the activate/deactivate
  // toggle, not a full edit flow).
  if (!listing || listing.profile_id !== user.id) {
    redirect({ href: "/partners", locale });
    return null;
  }

  return (
    <PartnerListingWizard
      userId={user.id}
      interests={interests}
      mode="edit"
      listingId={listing.id}
      initial={{
        name: listing.name,
        description: listing.description ?? "",
        interestId: listing.interest_id,
        city: listing.city,
        address: listing.address ?? "",
        phone: listing.phone ?? "",
        website: listing.website ?? "",
        photoUrls: listing.photo_urls,
        logoUrl: listing.logo_url ?? "",
        tagline: listing.tagline ?? "",
        openingHours: (listing.opening_hours as OpeningHours) ?? {},
      }}
      initialCoordinates={{ latitude: listing.latitude, longitude: listing.longitude }}
    />
  );
}
