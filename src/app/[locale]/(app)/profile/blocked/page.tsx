import { redirect } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { BlockedPageClient } from "./blocked-page-client";

export default async function BlockedPage({
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

  return <BlockedPageClient userId={user.id} />;
}
