import { createClient } from "@/lib/supabase/server";
import { listPendingInterestSuggestionsWithProfiles } from "@/lib/admin/queries";
import { getInterests } from "@/lib/profile/queries";
import { AdminInterestSuggestionsClient } from "./admin-interest-suggestions-client";

export default async function AdminInterestSuggestionsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Auth + is_admin are already enforced by the parent AdminLayout — user is
  // guaranteed non-null here. allInterests is fetched alongside the
  // suggestions themselves to power the client's own "looks similar to an
  // existing interest?" hint — a plain client-side text comparison, no
  // extra round trip needed once both lists are in hand.
  const [suggestions, allInterests] = await Promise.all([
    listPendingInterestSuggestionsWithProfiles(supabase),
    getInterests(supabase),
  ]);

  return (
    <AdminInterestSuggestionsClient
      adminId={user!.id}
      initialSuggestions={suggestions}
      allInterests={allInterests}
    />
  );
}
