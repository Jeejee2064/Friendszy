import { createClient } from "@/lib/supabase/server";
import { getDashboardKpis } from "@/lib/admin/dashboard-queries";
import { listOpenReportsWithTargets } from "@/lib/admin/queries";
import { AdminDashboardClient } from "./admin-dashboard-client";

export default async function AdminDashboardPage() {
  const supabase = await createClient();

  const [kpis, reports] = await Promise.all([
    getDashboardKpis(supabase),
    listOpenReportsWithTargets(supabase),
  ]);

  return <AdminDashboardClient kpis={kpis} recentReports={reports.slice(0, 5)} />;
}
