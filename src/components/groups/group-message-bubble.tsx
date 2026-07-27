import type { GroupMessageRow } from "@/lib/groups/types";
import type { ProfileSummary } from "@/lib/profile/types";

export function GroupMessageBubble({
  message,
  isMine,
  sender,
  time,
  canRemove,
  onRemove,
  removedLabel,
  removeLabel,
  deletedUserLabel,
}: {
  message: GroupMessageRow;
  isMine: boolean;
  sender: ProfileSummary | undefined;
  time: string;
  canRemove: boolean;
  onRemove: (messageId: string) => void;
  removedLabel: string;
  removeLabel: string;
  deletedUserLabel: string;
}) {
  const isRemoved = !!message.removed_at;
  const senderName = sender?.full_name
    ? [sender.full_name, sender.last_name].filter(Boolean).join(" ")
    : deletedUserLabel;

  return (
    <div className={`flex items-end gap-2 ${isMine ? "flex-row-reverse" : ""}`}>
      {!isMine && (
        <div
          className="h-7 w-7 shrink-0 overflow-hidden rounded-full"
          style={!sender?.avatar_url ? { backgroundImage: "var(--grad)" } : undefined}
        >
          {sender?.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={sender.avatar_url} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs font-bold text-white">
              {senderName.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
      )}
      <div className={`flex max-w-[75%] flex-col ${isMine ? "items-end" : "items-start"}`}>
        {!isMine && (
          <p className="mb-0.5 px-1 text-xs font-semibold text-muted">{senderName}</p>
        )}
        <div className="group/bubble relative">
          <div
            className={`rounded-2xl px-4 py-2 text-sm ${
              isRemoved ? "italic text-muted" : isMine ? "text-white" : "text-text"
            }`}
            style={
              isRemoved
                ? { background: "var(--bg)" }
                : isMine
                  ? { backgroundImage: "var(--grad)" }
                  : { background: "var(--bg)" }
            }
          >
            {isRemoved ? removedLabel : message.content}
          </div>
          {canRemove && !isRemoved && (
            <button
              type="button"
              onClick={() => onRemove(message.id)}
              aria-label={removeLabel}
              className="absolute -right-2 -top-2 hidden h-6 w-6 items-center justify-center rounded-full border border-border bg-card text-xs group-hover/bubble:flex"
            >
              🗑️
            </button>
          )}
        </div>
        <span className="mt-1 px-1 text-xs text-muted">{time}</span>
      </div>
    </div>
  );
}
