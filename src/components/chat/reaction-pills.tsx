// Pastilles de réactions agrégées sous une bulle de message — partagées
// par les 3 surfaces de chat. Chaque surface a sa propre table de
// réactions (message_reactions / group_message_reactions /
// event_message_reactions) mais la forme utile ici (emoji + qui a réagi)
// est identique, donc pas de type spécifique par surface.
export function ReactionPills({
  reactions,
  myUserId,
  onToggle,
}: {
  reactions: { emoji: string; user_id: string }[];
  myUserId: string;
  onToggle: (emoji: string) => void;
}) {
  if (reactions.length === 0) return null;

  const counts = new Map<string, number>();
  let mine: string | null = null;
  for (const r of reactions) {
    counts.set(r.emoji, (counts.get(r.emoji) ?? 0) + 1);
    if (r.user_id === myUserId) mine = r.emoji;
  }

  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {[...counts.entries()].map(([emoji, count]) => (
        <button
          key={emoji}
          type="button"
          onClick={() => onToggle(emoji)}
          className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors ${
            mine === emoji
              ? "border-teal2 bg-bg font-bold text-teal2"
              : "border-border bg-card text-muted hover:bg-bg"
          }`}
        >
          <span>{emoji}</span>
          <span>{count}</span>
        </button>
      ))}
    </div>
  );
}
