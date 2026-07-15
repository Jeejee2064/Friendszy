import { redirect } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { getNotificationsWithProfiles } from "@/lib/notifications/queries";
import { NotificationsPageClient } from "./notifications-page-client";

export default async function NotificationsPage({
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

  const notifications = await getNotificationsWithProfiles(supabase, user.id, 50);

  return <NotificationsPageClient userId={user.id} initialNotifications={notifications} />;
}
