import { notFound } from "next/navigation";
import { redirect } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfilesByIds } from "@/lib/profile/queries";
import {
  listConversations,
  getLatestMessagesByConversation,
  getUnreadCountsByConversation,
  listMessages,
} from "@/lib/messages/queries";
import { MessagesPageClient } from "./messages-page-client";

export default async function MessagesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ c?: string }>;
}) {
  const { locale } = await params;
  const { c: selectedId } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect({ href: "/login", locale });
    return null;
  }

  const conversations = await listConversations(supabase, user.id);
  const otherIds = conversations.map((c) =>
    c.user_a === user.id ? c.user_b : c.user_a
  );
  const conversationIds = conversations.map((c) => c.id);
  const [profiles, latest, unreadCounts] = await Promise.all([
    getProfilesByIds(supabase, otherIds),
    getLatestMessagesByConversation(supabase, conversationIds),
    getUnreadCountsByConversation(supabase, conversationIds, user.id),
  ]);
  const profileById = new Map(profiles.map((p) => [p.id, p]));

  const conversationSummaries = conversations
    .map((c) => {
      const otherId = c.user_a === user.id ? c.user_b : c.user_a;
      const otherProfile = profileById.get(otherId);
      if (!otherProfile) return null;
      const lastMessage = latest.get(c.id);
      return {
        id: c.id,
        otherProfile,
        preview: lastMessage?.content ?? null,
        lastMessageAt: c.last_message_at,
        unreadCount: unreadCounts.get(c.id) ?? 0,
      };
    })
    .filter((c): c is NonNullable<typeof c> => c !== null);

  let selectedOtherProfile = null;
  let initialMessages: Awaited<ReturnType<typeof listMessages>> = [];

  if (selectedId) {
    const { data: conversation, error } = await supabase
      .from("conversations")
      .select("*")
      .eq("id", selectedId)
      .maybeSingle();
    if (error) throw error;
    if (!conversation) notFound();

    const otherId =
      conversation.user_a === user.id ? conversation.user_b : conversation.user_a;
    const [profile] = await getProfilesByIds(supabase, [otherId]);
    if (!profile) notFound();
    selectedOtherProfile = profile;
    initialMessages = await listMessages(supabase, selectedId);
  }

  return (
    <MessagesPageClient
      userId={user.id}
      conversations={conversationSummaries}
      selectedConversationId={selectedId ?? null}
      selectedOtherProfile={selectedOtherProfile}
      initialMessages={initialMessages}
    />
  );
}
