import { redirect } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { getInterests } from "@/lib/profile/queries";
import { EventCreationWizard } from "@/components/events/event-creation-wizard";

export default async function NewEventPage({
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

  const [interests, { data: profile }] = await Promise.all([
    getInterests(supabase),
    supabase.from("profiles").select("is_admin").eq("id", user.id).maybeSingle(),
  ]);

  return (
    <EventCreationWizard
      userId={user.id}
      interests={interests}
      isAdmin={profile?.is_admin ?? false}
    />
  );
}
