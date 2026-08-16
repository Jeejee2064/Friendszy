import type { ReactNode } from "react";
import { redirect } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { countOpenReports } from "@/lib/reports/queries";
import { countPendingPartnerListings } from "@/lib/partners/queries";
import { countPendingInterestSuggestions } from "@/lib/interest-suggestions/queries";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { SignOutButton } from "@/components/auth/sign-out-button";

export default async function AdminLayout({
  children,
  params,
}: {
  children: ReactNode;
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
    .select("is_admin, full_name, last_name")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.is_admin) {
    redirect({ href: "/", locale });
    return null;
  }

  const [pendingReportsCount, pendingPartnersCount, pendingInterestSuggestionsCount] =
    await Promise.all([
      countOpenReports(supabase),
      countPendingPartnerListings(supabase),
      countPendingInterestSuggestions(supabase),
    ]);
  const adminName = [profile.full_name, profile.last_name].filter(Boolean).join(" ") || user.email;

  return (
    <div className="flex min-h-screen">
      <AdminSidebar
        pendingReportsCount={pendingReportsCount}
        pendingPartnersCount={pendingPartnersCount}
        pendingInterestSuggestionsCount={pendingInterestSuggestionsCount}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-border bg-card px-6 py-4">
          <p className="text-sm font-bold text-text">{adminName}</p>
          <SignOutButton
            iconOnly={false}
            className="flex items-center gap-1.5 rounded-full border border-border px-3.5 py-1.5 text-xs font-semibold text-muted transition-colors hover:border-teal2 hover:text-teal2"
          />
        </header>
        <div className="min-h-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
