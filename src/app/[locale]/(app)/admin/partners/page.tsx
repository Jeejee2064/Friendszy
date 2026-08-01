import { createClient } from "@/lib/supabase/server";
import { getInterests } from "@/lib/profile/queries";
import { listAllPartnerListingsForAdmin } from "@/lib/partners/queries";
import { AdminPartnersClient } from "./admin-partners-client";

export default async function AdminPartnersPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [interests, listings] = await Promise.all([
    getInterests(supabase),
    listAllPartnerListingsForAdmin(supabase),
  ]);

  // Auth is already enforced by the parent AdminLayout — user is guaranteed
  // non-null here.
  return (
    <AdminPartnersClient
      adminId={user!.id}
      interests={interests}
      initialListings={listings}
    />
  );
}
