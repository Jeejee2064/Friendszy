import type { MessageRow, MessageReactionRow } from "@/lib/messages/queries";
import { MessageStatusTicks } from "@/components/messages/message-status-ticks";
import { MessageActions } from "@/components/chat/message-actions";
import { ReactionPills } from "@/components/chat/reaction-pills";
import { QuotedMessage } from "@/components/chat/quoted-message";

export function MessageBubble({
  message,
  isMine,
  time,
  status,
  statusLabel,
  repliedMessage,
  reactions,
  myUserId,
  onReply,
  onToggleReaction,
  onJumpToMessage,
  replyLabel,
  reactLabel,
  youLabel,
  removedLabel,
}: {
  message: MessageRow;
  isMine: boolean;
  time: string;
  status?: "sent" | "delivered" | "read";
  statusLabel?: string;
  repliedMessage?: { isMine: boolean; senderName: string; content: string | null } | null;
  reactions: MessageReactionRow[];
  myUserId: string;
  onReply: () => void;
  onToggleReaction: (emoji: string) => void;
  onJumpToMessage: (messageId: string) => void;
  replyLabel: string;
  reactLabel: string;
  youLabel: string;
  removedLabel: string;
}) {
  return (
    <div className={`flex flex-col ${isMine ? "items-end" : "items-start"}`}>
      <div className={`flex items-end gap-1 ${isMine ? "flex-row-reverse" : ""}`}>
        <div
          className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm ${isMine ? "text-white" : "text-text"}`}
          style={
            isMine ? { backgroundImage: "var(--grad)" } : { background: "var(--bg)" }
          }
        >
          {repliedMessage && (
            <QuotedMessage
              senderLabel={repliedMessage.isMine ? youLabel : repliedMessage.senderName}
              content={repliedMessage.content ?? removedLabel}
              tone={isMine ? "mine" : "theirs"}
              onClick={() => onJumpToMessage(message.reply_to_id!)}
            />
          )}
          {message.content}
        </div>
        <MessageActions
          align={isMine ? "end" : "start"}
          onReply={onReply}
          onReact={onToggleReaction}
          replyLabel={replyLabel}
          reactLabel={reactLabel}
        />
      </div>
      <ReactionPills reactions={reactions} myUserId={myUserId} onToggle={onToggleReaction} />
      <div className="mt-1 flex items-center gap-1.5">
        <span className="text-xs text-muted">{time}</span>
        {isMine && status && <MessageStatusTicks status={status} label={statusLabel} />}
      </div>
    </div>
  );
}
