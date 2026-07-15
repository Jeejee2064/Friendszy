import type { ReactNode } from "react";
import { redirect } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyProfile } from "@/lib/profile/queries";
import { AppShell } from "@/components/layout/app-shell";

export default async function AppLayout({
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

  const profile = await getMyProfile(supabase, user.id);

  return (
    <AppShell
      profile={
        profile ?? {
          id: user.id,
          full_name: null,
          avatar_url: null,
          city: null,
          age: null,
          gender: null,
        }
      }
      isAdmin={profile?.is_admin ?? false}
    >
      {children}
    </AppShell>
  );
}
