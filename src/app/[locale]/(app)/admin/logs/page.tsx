import { createClient } from "@/lib/supabase/server";
import { listAdminActions } from "@/lib/admin/queries";
import { AdminLogsClient } from "./admin-logs-client";

export default async function AdminLogsPage() {
  const supabase = await createClient();
  const actions = await listAdminActions(supabase);

  return <AdminLogsClient actions={actions} />;
}
