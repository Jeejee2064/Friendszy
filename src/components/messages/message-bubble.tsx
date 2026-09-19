import type { MessageRow, MessageReactionRow } from "@/lib/messages/queries";
import { MessageStatusTicks } from "@/components/messages/message-status-ticks";
import { MessageContextMenu } from "@/components/chat/message-context-menu";
import { ReactionPills } from "@/components/chat/reaction-pills";
import { QuotedMessage } from "@/components/chat/quoted-message";
import { SharedLinkCard } from "@/components/chat/shared-link-card";
import { splitByQuery } from "@/lib/messages/highlight";
import { extractSharedLink } from "@/lib/chat/shared-link";

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
  onDelete,
  replyLabel,
  deleteLabel,
  youLabel,
  removedLabel,
  highlightQuery,
  viewEventLabel,
  viewPartnerLabel,
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
  onDelete: () => void;
  replyLabel: string;
  deleteLabel: string;
  youLabel: string;
  removedLabel: string;
  highlightQuery?: string;
  viewEventLabel: string;
  viewPartnerLabel: string;
}) {
  const isRemoved = !!message.removed_at;
  const sharedLink = !isRemoved ? extractSharedLink(message.content) : null;

  return (
    <div className={`flex flex-col ${isMine ? "items-end" : "items-start"}`}>
      <div className="max-w-[75%]">
        <MessageContextMenu
          align={isMine ? "end" : "start"}
          canDelete={isMine && !isRemoved}
          onReply={onReply}
          onReact={onToggleReaction}
          onDelete={onDelete}
          replyLabel={replyLabel}
          deleteLabel={deleteLabel}
        >
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
            {!isRemoved && repliedMessage && (
              <QuotedMessage
                senderLabel={repliedMessage.isMine ? youLabel : repliedMessage.senderName}
                content={repliedMessage.content ?? removedLabel}
                tone={isMine ? "mine" : "theirs"}
                onClick={() => onJumpToMessage(message.reply_to_id!)}
              />
            )}
            {isRemoved
              ? removedLabel
              : highlightQuery
                ? splitByQuery(sharedLink?.text ?? message.content ?? "", highlightQuery).map((segment, i) =>
                    segment.match ? (
                      <mark key={i} className="rounded-sm text-inherit" style={{ background: "#f59e0b66" }}>
                        {segment.text}
                      </mark>
                    ) : (
                      <span key={i}>{segment.text}</span>
                    )
                  )
                : (sharedLink?.text || message.content)}
            {!isRemoved && sharedLink && (
              <div>
                <SharedLinkCard
                  href={`/${sharedLink.kind}/${sharedLink.id}`}
                  label={sharedLink.kind === "events" ? viewEventLabel : viewPartnerLabel}
                  isMine={isMine}
                />
              </div>
            )}
          </div>
        </MessageContextMenu>
      </div>
      {!isRemoved && (
        <ReactionPills reactions={reactions} myUserId={myUserId} onToggle={onToggleReaction} />
      )}
      <div className="mt-1 flex items-center gap-1.5">
        <span className="text-xs text-muted">{time}</span>
        {isMine && status && <MessageStatusTicks status={status} label={statusLabel} />}
      </div>
    </div>
  );
}
