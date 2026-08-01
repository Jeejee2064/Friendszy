import { createClient } from "@/lib/supabase/server";
import { listAllReportsWithTargets } from "@/lib/admin/queries";
import { AdminReportsClient } from "./admin-reports-client";

export default async function AdminModerationPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Auth + is_admin are already enforced by the parent AdminLayout — user is
  // guaranteed non-null here. Fetches every status (not just open/reviewing)
  // so the status filter in the client has something to filter into.
  const reports = await listAllReportsWithTargets(supabase);

  return <AdminReportsClient adminId={user!.id} initialReports={reports} />;
}
