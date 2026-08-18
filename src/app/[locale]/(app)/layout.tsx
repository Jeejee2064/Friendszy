import type { ReactNode } from "react";
import { createClient } from "@/lib/supabase/server";
import { getMyProfile } from "@/lib/profile/queries";
import { AppShell } from "@/components/layout/app-shell";

export default async function AppLayout({
  children,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Every guarded path except "/" already bounced an anonymous visitor to
  // /login in proxy.ts before this layout ever renders — "/" is the one
  // exception (see proxy.ts), rendering the public map landing page
  // (page.tsx's own !user branch) with none of the app chrome below: no
  // sidebar, no profile fetch, nothing that assumes a session exists.
  if (!user) {
    return <>{children}</>;
  }

  const profile = await getMyProfile(supabase, user.id);

  return (
    <AppShell
      profile={
        profile ?? {
          id: user.id,
          full_name: null,
          last_name: null,
          avatar_url: null,
          city: null,
          age: null,
          gender: null,
        }
      }
      isAdmin={profile?.is_admin ?? false}
      hasSeenNavTour={profile?.has_seen_nav_tour ?? true}
    >
      {children}
    </AppShell>
  );
}
