import type { MessageRow } from "@/lib/messages/queries";
import { MessageStatusTicks } from "@/components/messages/message-status-ticks";

export function MessageBubble({
  message,
  isMine,
  time,
  status,
  statusLabel,
}: {
  message: MessageRow;
  isMine: boolean;
  time: string;
  status?: "sent" | "delivered" | "read";
  statusLabel?: string;
}) {
  return (
    <div className={`flex flex-col ${isMine ? "items-end" : "items-start"}`}>
      <div
        className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm ${isMine ? "text-white" : "text-text"}`}
        style={
          isMine ? { backgroundImage: "var(--grad)" } : { background: "var(--bg)" }
        }
      >
        {message.content}
      </div>
      <div className="mt-1 flex items-center gap-1.5">
        <span className="text-xs text-muted">{time}</span>
        {isMine && status && <MessageStatusTicks status={status} label={statusLabel} />}
      </div>
    </div>
  );
}
