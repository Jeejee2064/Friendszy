import { createClient } from "@/lib/supabase/server";
import { listMembers, listDistinctCities } from "@/lib/admin/members-queries";
import { AdminMembersClient } from "./admin-members-client";

export default async function AdminMembersPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [members, cities] = await Promise.all([
    listMembers(supabase, {}),
    listDistinctCities(supabase),
  ]);

  // Auth is already enforced by the parent AdminLayout — user is guaranteed
  // non-null here.
  return <AdminMembersClient initialMembers={members} cities={cities} adminId={user!.id} />;
}
