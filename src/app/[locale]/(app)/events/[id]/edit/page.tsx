import { notFound } from "next/navigation";
import { redirect } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { getInterests } from "@/lib/profile/queries";
import { getEventById } from "@/lib/events/queries";
import { EventCreationWizard } from "@/components/events/event-creation-wizard";

export default async function EditEventPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect({ href: "/login", locale });
    return null;
  }

  const [event, interests, { data: profile }] = await Promise.all([
    getEventById(supabase, id),
    getInterests(supabase),
    supabase.from("profiles").select("is_admin").eq("id", user.id).maybeSingle(),
  ]);
  if (!event) notFound();

  const isAdmin = profile?.is_admin ?? false;
  if (event.creator_id !== user.id && !isAdmin) {
    redirect({ href: `/events/${id}`, locale });
    return null;
  }

  return (
    <EventCreationWizard userId={user.id} interests={interests} isAdmin={isAdmin} event={event} />
  );
}
