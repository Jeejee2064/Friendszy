import type { MessageRow } from "@/lib/messages/queries";
import { ReportButton } from "@/components/social/report-button";

export function MessageBubble({
  message,
  isMine,
  reporterId,
  readLabel,
}: {
  message: MessageRow;
  isMine: boolean;
  reporterId: string;
  readLabel?: string;
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
      <div className="mt-1 flex items-center gap-2">
        {readLabel && <span className="text-xs text-muted">{readLabel}</span>}
        {!isMine && !message.removed_at && (
          <ReportButton
            reporterId={reporterId}
            targetType="message"
            targetId={message.id}
            compact
          />
        )}
      </div>
    </div>
  );
}
