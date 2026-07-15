import { redirect } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { listOpenReportsWithTargets } from "@/lib/admin/queries";
import { AdminReportsClient } from "./admin-reports-client";

export default async function AdminPage({
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

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.is_admin) {
    redirect({ href: "/", locale });
    return null;
  }

  const reports = await listOpenReportsWithTargets(supabase);

  return <AdminReportsClient adminId={user.id} initialReports={reports} />;
}
