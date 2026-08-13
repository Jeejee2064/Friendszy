import { notFound } from "next/navigation";
import { redirect } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { getInterests, getProfilesByIds } from "@/lib/profile/queries";
import {
  getEventById,
  getRegistrationCountsByEvent,
  getMyRegistration,
  listEventPhotos,
} from "@/lib/events/queries";
import { listEventMessages } from "@/lib/events/messages-queries";
import { EventViewClient } from "@/components/events/event-view-client";

export default async function EventPage({
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

  const event = await getEventById(supabase, id);
  if (!event) notFound();

  const [interests, myRegistration, registrationCounts, photos] = await Promise.all([
    getInterests(supabase),
    getMyRegistration(supabase, id, user.id),
    getRegistrationCountsByEvent(supabase, [id]),
    listEventPhotos(supabase, id),
  ]);
  const interest = interests.find((i) => i.id === event.interest_id) ?? null;
  const isRegistered = myRegistration !== null;
  const isOrganizer = event.creator_id === user.id;
  const registrationCount = registrationCounts.get(id) ?? 0;

  const organizerProfiles = event.creator_id
    ? await getProfilesByIds(supabase, [event.creator_id])
    : [];
  const organizer = organizerProfiles[0] ?? null;

  let initialMessages: Awaited<ReturnType<typeof listEventMessages>> = [];
  let initialSenders: Awaited<ReturnType<typeof getProfilesByIds>> = [];
  if (isRegistered) {
    initialMessages = await listEventMessages(supabase, id);
    const senderIds = [...new Set(initialMessages.map((m) => m.sender_id))];
    initialSenders = await getProfilesByIds(supabase, senderIds);
  }

  return (
    <EventViewClient
      userId={user.id}
      event={event}
      interest={interest}
      organizer={organizer}
      registrationCount={registrationCount}
      isRegistered={isRegistered}
      isOrganizer={isOrganizer}
      photos={photos}
      initialMessages={initialMessages}
      initialSenders={initialSenders}
    />
  );
}
