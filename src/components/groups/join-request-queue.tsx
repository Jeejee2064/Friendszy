"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { approveJoinRequest, rejectJoinRequest } from "@/lib/groups/queries";
import type { GroupJoinRequestRow } from "@/lib/groups/types";
import type { ProfileSummary } from "@/lib/profile/types";

export type JoinRequestWithProfile = GroupJoinRequestRow & { profile: ProfileSummary };

export function JoinRequestQueue({
  initialRequests,
  onCountChange,
}: {
  initialRequests: JoinRequestWithProfile[];
  // group_join_requests isn't Realtime-enabled, so the tab badge showing
  // this count (rendered by the parent, outside this component) has no
  // other way to learn a request was just resolved — without this callback
  // it stays frozen at the server-rendered initial count.
  onCountChange?: (count: number) => void;
}) {
  const t = useTranslations("Groups");
  const tCommon = useTranslations("Common");
  const [requests, setRequests] = useState(initialRequests);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function handleApprove(requestId: string) {
    setBusyId(requestId);
    try {
      await approveJoinRequest(createClient(), requestId);
      // Computed here rather than inside the setRequests updater — React can
      // invoke that updater during another component's render pass, and
      // calling the parent's setter (onCountChange) from inside it is what
      // triggered "Cannot update a component while rendering a different
      // component." Two plain statements in an event handler is safe.
      const next = requests.filter((r) => r.id !== requestId);
      setRequests(next);
      onCountChange?.(next.length);
    } finally {
      setBusyId(null);
    }
  }

  async function handleReject(requestId: string) {
    setBusyId(requestId);
    try {
      await rejectJoinRequest(createClient(), requestId);
      const next = requests.filter((r) => r.id !== requestId);
      setRequests(next);
      onCountChange?.(next.length);
    } finally {
      setBusyId(null);
    }
  }

  if (requests.length === 0) {
    return <p className="text-center text-sm text-muted">{t("noJoinRequests")}</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {requests.map((request) => {
        const displayName = request.profile.full_name
          ? [request.profile.full_name, request.profile.last_name].filter(Boolean).join(" ")
          : tCommon("deletedUser");
        const busy = busyId === request.id;
        return (
          <div
            key={request.id}
            className="flex items-center gap-3 rounded-xl border border-border p-3"
          >
            <div
              className="h-10 w-10 shrink-0 overflow-hidden rounded-full"
              style={
                !request.profile.avatar_url ? { backgroundImage: "var(--grad)" } : undefined
              }
            >
              {request.profile.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={request.profile.avatar_url}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-sm font-bold text-white">
                  {displayName.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <p className="min-w-0 flex-1 truncate font-bold text-text">{displayName}</p>
            <div
              className={`flex items-center gap-2 ${busy ? "pointer-events-none opacity-60" : ""}`}
            >
              <button
                type="button"
                onClick={() => handleApprove(request.id)}
                className="rounded-full px-4 py-1.5 text-xs font-bold text-white"
                style={{ backgroundImage: "var(--grad)" }}
              >
                {t("approve")}
              </button>
              <button
                type="button"
                onClick={() => handleReject(request.id)}
                className="rounded-full border border-border px-4 py-1.5 text-xs font-bold text-muted"
              >
                {t("reject")}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
