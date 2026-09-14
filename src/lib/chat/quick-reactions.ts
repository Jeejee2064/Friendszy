// Les 5 emojis de réaction rapide, partagés par les 3 surfaces de chat
// (messages privés, groupes, événements) — doit rester synchronisé avec la
// contrainte CHECK posée sur message_reactions / group_message_reactions /
// event_message_reactions dans 20260914130000_message_reply_and_reactions.sql.
export const QUICK_REACTION_EMOJIS = ["👍", "😂", "❤️", "😮", "🔥"] as const;
