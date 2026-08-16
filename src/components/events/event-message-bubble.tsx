import type { EventMessageRow } from "@/lib/events/types";
import type { ProfileSummary } from "@/lib/profile/types";

export function EventMessageBubble({
  message,
  isMine,
  sender,
  time,
  showHeader,
  showTime,
  canRemove,
  onRemove,
  removedLabel,
  removeLabel,
  deletedUserLabel,
}: {
  message: EventMessageRow;
  isMine: boolean;
  sender: ProfileSummary | undefined;
  time: string;
  showHeader: boolean;
  showTime: boolean;
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
    <div className={`flex flex-col ${isMine ? "items-end" : "items-start"}`}>
      {!isMine && showHeader && (
        <div className="mb-1 flex items-center gap-1.5 px-1">
          <div
            className="h-5 w-5 shrink-0 overflow-hidden rounded-full"
            style={!sender?.avatar_url ? { backgroundImage: "var(--grad)" } : undefined}
          >
            {sender?.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={sender.avatar_url} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-[9px] font-bold text-white">
                {senderName.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <span className="text-xs font-semibold text-muted">{senderName}</span>
        </div>
      )}
      <div className="group/bubble relative max-w-[75%]">
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
      {showTime && <span className="mt-1 px-1 text-xs text-muted">{time}</span>}
    </div>
  );
}
