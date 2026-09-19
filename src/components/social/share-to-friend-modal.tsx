"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getOrCreateConversation, sendMessage } from "@/lib/messages/queries";
import { listFriends } from "@/lib/friends/queries";
import type { ProfileSummary } from "@/lib/profile/types";
import { PersonCard } from "@/components/social/person-card";
import { Modal } from "@/components/ui/modal";
import { Notice } from "@/components/ui/notice";

// Modal "partager à un ami" réutilisable — envoie un message de chat
// contenant `path` (ex. `/events/{id}` ou `/partners/{id}`) dans la
// conversation avec l'ami choisi. `buildMessage` reçoit l'URL absolue déjà
// assemblée (window.location.origin + path) construite au moment de
// l'envoi plutôt qu'au rendu, pour rester compatible avec le rendu serveur.
export function ShareToFriendModal({
  open,
  onClose,
  userId,
  path,
  buildMessage,
  title,
  noFriendsLabel,
  sendLabel,
  sentLabel,
  loadingLabel,
  deletedUserLabel,
}: {
  open: boolean;
  onClose: () => void;
  userId: string;
  path: string;
  buildMessage: (url: string) => string;
  title: string;
  noFriendsLabel: string;
  sendLabel: string;
  sentLabel: string;
  loadingLabel: string;
  deletedUserLabel: string;
}) {
  const [friends, setFriends] = useState<ProfileSummary[] | null>(null);
  const [friendsLoading, setFriendsLoading] = useState(false);
  const [sharingId, setSharingId] = useState<string | null>(null);
  const [sharedNotice, setSharedNotice] = useState(false);

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSharedNotice(false);
    if (friends !== null) return;
    setFriendsLoading(true);
    const supabase = createClient();
    listFriends(supabase, userId)
      .then(setFriends)
      .finally(() => setFriendsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function handleShare(friendId: string) {
    setSharingId(friendId);
    try {
      const supabase = createClient();
      const conversationId = await getOrCreateConversation(supabase, userId, friendId);
      const url = `${window.location.origin}${path}`;
      await sendMessage(supabase, conversationId, userId, buildMessage(url));
      setSharedNotice(true);
    } finally {
      setSharingId(null);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={title}>
      {sharedNotice && <Notice kind="success" message={sentLabel} />}
      <div className="mt-3 flex max-h-[60vh] flex-col gap-3 overflow-y-auto pr-1">
        {friendsLoading ? (
          <p className="text-center text-sm text-muted">{loadingLabel}</p>
        ) : !friends || friends.length === 0 ? (
          <p className="text-center text-sm text-muted">{noFriendsLabel}</p>
        ) : (
          friends.map((profile) => (
            <PersonCard
              key={profile.id}
              profile={profile}
              deletedUserLabel={deletedUserLabel}
              footer={
                <button
                  type="button"
                  onClick={() => handleShare(profile.id)}
                  disabled={sharingId === profile.id}
                  className="w-full rounded-full px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
                  style={{ backgroundImage: "var(--grad)" }}
                >
                  {sharingId === profile.id ? "…" : sendLabel}
                </button>
              }
            />
          ))
        )}
      </div>
    </Modal>
  );
}
