import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { getProfilesByIds } from "@/lib/profile/queries";
import { isBlockedBetween } from "@/lib/blocks/queries";

type Client = SupabaseClient<Database>;
export type ConversationRow = Database["public"]["Tables"]["conversations"]["Row"];
export type MessageRow = Database["public"]["Tables"]["messages"]["Row"];
export type MessageReactionRow = Database["public"]["Tables"]["message_reactions"]["Row"];

export function orderPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

export async function getOrCreateConversation(
  supabase: Client,
  myId: string,
  otherId: string
): Promise<string> {
  const [user_a, user_b] = orderPair(myId, otherId);

  const { data: existing, error: selectError } = await supabase
    .from("conversations")
    .select("id")
    .eq("user_a", user_a)
    .eq("user_b", user_b)
    .maybeSingle();
  if (selectError) throw selectError;
  if (existing) return existing.id;

  const { data: created, error: insertError } = await supabase
    .from("conversations")
    .insert({ user_a, user_b })
    .select("id")
    .single();
  if (insertError) throw insertError;
  return created.id;
}

export async function listConversations(
  supabase: Client,
  myId: string
): Promise<ConversationRow[]> {
  const [{ data, error }, hiddenAtById] = await Promise.all([
    supabase
      .from("conversations")
      .select("*")
      .or(`user_a.eq.${myId},user_b.eq.${myId}`)
      .order("last_message_at", { ascending: false, nullsFirst: false }),
    getHiddenConversations(supabase, myId),
  ]);
  if (error) throw error;
  return (data ?? []).filter((c) => isConversationVisible(c, hiddenAtById));
}

// Conversations que myId a masquées (voir hideConversation) et la date à
// laquelle il l'a fait, pour que listConversations()/getUnreadConversationsCount()
// puissent en exclure celles sans activité depuis.
async function getHiddenConversations(
  supabase: Client,
  myId: string
): Promise<Map<string, string>> {
  const { data, error } = await supabase
    .from("conversation_hides")
    .select("conversation_id, hidden_at")
    .eq("user_id", myId);
  if (error) throw error;
  return new Map((data ?? []).map((h) => [h.conversation_id, h.hidden_at]));
}

// Une conversation masquée réapparaît d'elle-même dès qu'un message plus
// récent que le masquage existe (envoyé ou reçu) — voir la migration
// conversation_hides.
function isConversationVisible(
  conversation: Pick<ConversationRow, "id" | "last_message_at">,
  hiddenAtById: Map<string, string>
): boolean {
  const hiddenAt = hiddenAtById.get(conversation.id);
  if (!hiddenAt) return true;
  return (
    !!conversation.last_message_at &&
    new Date(conversation.last_message_at).getTime() > new Date(hiddenAt).getTime()
  );
}

// Masquage "pour moi seulement" d'une conversation (n'affecte ni
// `conversations` ni `messages` — voir la migration conversation_hides).
// Upsert : remasquer une conversation déjà masquée ne fait que rafraîchir
// hidden_at.
export async function hideConversation(
  supabase: Client,
  userId: string,
  conversationId: string
) {
  const { error } = await supabase.from("conversation_hides").upsert(
    { user_id: userId, conversation_id: conversationId, hidden_at: new Date().toISOString() },
    { onConflict: "user_id,conversation_id" }
  );
  if (error) throw error;
}

export async function getUnreadCountsByConversation(
  supabase: Client,
  conversationIds: string[],
  myId: string
): Promise<Map<string, number>> {
  if (conversationIds.length === 0) return new Map();

  const { data, error } = await supabase
    .from("messages")
    .select("conversation_id")
    .in("conversation_id", conversationIds)
    .neq("sender_id", myId)
    .is("read_at", null);
  if (error) throw error;

  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    counts.set(row.conversation_id, (counts.get(row.conversation_id) ?? 0) + 1);
  }
  return counts;
}

export async function getUnreadConversationsCount(
  supabase: Client,
  myId: string
): Promise<number> {
  const { data, error } = await supabase
    .from("messages")
    .select("conversation_id")
    .neq("sender_id", myId)
    .is("read_at", null);
  if (error) throw error;

  const conversationIds = [...new Set((data ?? []).map((row) => row.conversation_id))];
  if (conversationIds.length === 0) return 0;

  // A conversation whose other participant deleted their account (profiles
  // row anonymized, full_name → null) is hidden from the list entirely
  // (see messages/page.tsx) — the unread badge shouldn't count it either.
  // Same for one myId has hidden with no activity since (see hideConversation).
  const [{ data: conversations, error: conversationsError }, hiddenAtById] = await Promise.all([
    supabase.from("conversations").select("id, user_a, user_b, last_message_at").in("id", conversationIds),
    getHiddenConversations(supabase, myId),
  ]);
  if (conversationsError) throw conversationsError;

  // Ne pas se fier uniquement à RLS pour restreindre aux conversations de
  // myId : messages_select_admin laisse un admin lire tous les messages de
  // la plateforme (modération), donc le select ci-dessus renverrait aussi
  // des conversations où myId n'est ni user_a ni user_b — jamais visibles
  // dans son propre /messages et donc jamais marquables comme lues, ce qui
  // bloquerait le badge à un nombre non nul en permanence.
  const myConversations = (conversations ?? []).filter(
    (c) => c.user_a === myId || c.user_b === myId
  );

  const visibleConversations = myConversations.filter((c) =>
    isConversationVisible(c, hiddenAtById)
  );
  const otherIdByConversation = new Map(
    visibleConversations.map((c) => [c.id, c.user_a === myId ? c.user_b : c.user_a])
  );
  const otherIds = [...new Set(otherIdByConversation.values())];
  const [profiles, blockedFlags] = await Promise.all([
    getProfilesByIds(supabase, otherIds),
    // A conversation with someone blocked (by either side) can never be
    // opened and marked read again — RLS keeps its messages frozen at
    // read_at IS NULL forever, which would otherwise leave the badge stuck
    // permanently. Exclude it the same way a deleted account already is.
    Promise.all(otherIds.map((id) => isBlockedBetween(supabase, myId, id))),
  ]);
  const liveOtherIds = new Set(
    profiles.filter((p) => p.full_name !== null).map((p) => p.id)
  );
  const blockedOtherIds = new Set(
    otherIds.filter((_, index) => blockedFlags[index])
  );

  return conversationIds.filter((id) => {
    const otherId = otherIdByConversation.get(id);
    return !!otherId && liveOtherIds.has(otherId) && !blockedOtherIds.has(otherId);
  }).length;
}

export async function getLatestMessagesByConversation(
  supabase: Client,
  conversationIds: string[]
): Promise<Map<string, MessageRow>> {
  if (conversationIds.length === 0) return new Map();

  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .in("conversation_id", conversationIds)
    .is("removed_at", null)
    .order("created_at", { ascending: false });
  if (error) throw error;

  const map = new Map<string, MessageRow>();
  for (const message of data ?? []) {
    if (!map.has(message.conversation_id)) {
      map.set(message.conversation_id, message);
    }
  }
  return map;
}

export async function getMessagesByIds(
  supabase: Client,
  ids: string[]
): Promise<MessageRow[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase.from("messages").select("*").in("id", ids);
  if (error) throw error;
  return data ?? [];
}

export async function listMessages(
  supabase: Client,
  conversationId: string
): Promise<MessageRow[]> {
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

// Retrait doux par l'auteur de son propre message (removed_at/removed_by),
// sur le même modèle que le retrait admin des messages de groupe/événement
// — le contenu reste en base (trigger d'immutabilité) mais n'est plus
// affiché (voir MessageBubble). RLS restreint qui peut réellement le faire.
export async function removeMessage(supabase: Client, messageId: string, userId: string) {
  const { error } = await supabase
    .from("messages")
    .update({ removed_at: new Date().toISOString(), removed_by: userId })
    .eq("id", messageId);
  if (error) throw error;
}

export async function sendMessage(
  supabase: Client,
  conversationId: string,
  senderId: string,
  content: string,
  replyToId?: string | null
): Promise<MessageRow> {
  const { data, error } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversationId,
      sender_id: senderId,
      content,
      reply_to_id: replyToId ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function listMessageReactions(
  supabase: Client,
  conversationId: string
): Promise<MessageReactionRow[]> {
  const { data, error } = await supabase
    .from("message_reactions")
    .select("*")
    .eq("conversation_id", conversationId);
  if (error) throw error;
  return data ?? [];
}

// Une seule réaction active par personne et par message : poser un nouvel
// emoji remplace le précédent (upsert sur la contrainte unique
// message_id+user_id, voir la migration).
export async function setMessageReaction(
  supabase: Client,
  messageId: string,
  userId: string,
  emoji: string
): Promise<MessageReactionRow> {
  const { data, error } = await supabase
    .from("message_reactions")
    .upsert(
      // conversation_id est posé côté serveur par le trigger
      // set_message_reaction_conversation_id (voir la migration), jamais
      // par le client — `as never` contourne l'exigence du type Insert
      // généré (colonne NOT NULL sans défaut, la CLI ne sait pas qu'un
      // trigger la remplit).
      { message_id: messageId, user_id: userId, emoji } as never,
      { onConflict: "message_id,user_id" }
    )
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function removeMessageReaction(
  supabase: Client,
  messageId: string,
  userId: string
) {
  const { error } = await supabase
    .from("message_reactions")
    .delete()
    .eq("message_id", messageId)
    .eq("user_id", userId);
  if (error) throw error;
}

export async function markConversationRead(
  supabase: Client,
  conversationId: string,
  myId: string
) {
  const { error } = await supabase
    .from("messages")
    .update({ read_at: new Date().toISOString() })
    .eq("conversation_id", conversationId)
    .neq("sender_id", myId)
    .is("read_at", null);
  if (error) throw error;
}

// Heartbeat "je regarde cette conversation" — voir
// supabase/migrations/20260914160000_conversation_presence.sql. Upsert sur
// user_id (une seule ligne par utilisateur, une seule conversation
// regardée à la fois) ; le client rappelle ceci toutes les ~15s tant que
// la conversation reste ouverte à l'écran.
export async function trackConversationPresence(
  supabase: Client,
  userId: string,
  conversationId: string
) {
  const { error } = await supabase.from("conversation_presence").upsert({
    user_id: userId,
    conversation_id: conversationId,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

// Appelé en quittant la conversation (changement de conversation, onglet
// masqué, démontage du composant) pour que push-new-message arrête
// immédiatement d'ignorer les push vers cet utilisateur — sans attendre
// que la ligne devienne périmée.
export async function clearConversationPresence(supabase: Client, userId: string) {
  const { error } = await supabase
    .from("conversation_presence")
    .delete()
    .eq("user_id", userId);
  if (error) throw error;
}

export async function markMessageDelivered(supabase: Client, messageId: string) {
  const { error } = await supabase
    .from("messages")
    .update({ delivered_at: new Date().toISOString() })
    .eq("id", messageId)
    .is("delivered_at", null);
  if (error) throw error;
}

export async function markAllReceivedMessagesDelivered(supabase: Client, myId: string) {
  const { data: conversations, error: conversationsError } = await supabase
    .from("conversations")
    .select("id")
    .or(`user_a.eq.${myId},user_b.eq.${myId}`);
  if (conversationsError) throw conversationsError;

  const conversationIds = (conversations ?? []).map((c) => c.id);
  if (conversationIds.length === 0) return;

  const { error } = await supabase
    .from("messages")
    .update({ delivered_at: new Date().toISOString() })
    .in("conversation_id", conversationIds)
    .neq("sender_id", myId)
    .is("delivered_at", null);
  if (error) throw error;
}
