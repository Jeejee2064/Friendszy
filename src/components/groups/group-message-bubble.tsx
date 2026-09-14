import type { GroupMessageRow, GroupMessageReactionRow } from "@/lib/groups/types";
import type { ProfileSummary } from "@/lib/profile/types";
import { MessageContextMenu } from "@/components/chat/message-context-menu";
import { ReactionPills } from "@/components/chat/reaction-pills";
import { QuotedMessage } from "@/components/chat/quoted-message";

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
  repliedMessage?: { isMine: boolean; senderName: string; content: string | null } | null;
  reactions: GroupMessageReactionRow[];
  myUserId: string;
  onReply: () => void;
  onToggleReaction: (emoji: string) => void;
  onJumpToMessage: (messageId: string) => void;
  onDelete: () => void;
  replyLabel: string;
  deleteLabel: string;
  youLabel: string;
}) {
  const isRemoved = !!message.removed_at;
  const senderName = sender?.full_name
    ? [sender.full_name, sender.last_name].filter(Boolean).join(" ")
    : deletedUserLabel;

  return (
    <div className={`flex flex-col ${isMine ? "items-end" : "items-start"}`}>
      {!isMine && (
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
      <MessageContextMenu
        align={isMine ? "end" : "start"}
        canDelete={isMine && !isRemoved}
        onReply={onReply}
        onReact={onToggleReaction}
        onDelete={onDelete}
        replyLabel={replyLabel}
        deleteLabel={deleteLabel}
      >
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
            {!isRemoved && repliedMessage && (
              <QuotedMessage
                senderLabel={repliedMessage.isMine ? youLabel : repliedMessage.senderName}
                content={repliedMessage.content ?? removedLabel}
                tone={isMine ? "mine" : "theirs"}
                onClick={() => onJumpToMessage(message.reply_to_id!)}
              />
            )}
            {isRemoved ? removedLabel : message.content}
          </div>
          {canRemove && !isRemoved && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onRemove(message.id);
              }}
              aria-label={removeLabel}
              className="absolute -right-2 -top-2 hidden h-6 w-6 items-center justify-center rounded-full border border-border bg-card text-xs group-hover/bubble:flex"
            >
              🗑️
            </button>
          )}
        </div>
      </MessageContextMenu>
      {!isRemoved && (
        <ReactionPills reactions={reactions} myUserId={myUserId} onToggle={onToggleReaction} />
      )}
      <span className="mt-1 px-1 text-xs text-muted">{time}</span>
    </div>
  );
}
