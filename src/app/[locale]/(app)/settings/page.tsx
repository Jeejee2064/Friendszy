import { redirect } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { SettingsPageClient } from "./settings-client";

export default async function SettingsPage({
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

  return <SettingsPageClient locale={locale} />;
}
