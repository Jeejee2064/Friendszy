"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { GroupCardData } from "@/lib/groups/types";
import { Modal } from "@/components/ui/modal";

export function GroupCard({
  group,
  onRequestJoin,
  requesting,
}: {
  group: GroupCardData;
  onRequestJoin: (groupId: string) => void;
  requesting: boolean;
}) {
  const t = useTranslations("Groups");
  const locale = useLocale();
  const [detailsOpen, setDetailsOpen] = useState(false);

  const isMember = group.myStatus === "active";
  const canRequest =
    !isMember &&
    group.myStatus !== "banned" &&
    !group.myPendingJoinRequest &&
    !requesting;
  const showRequested = group.myPendingJoinRequest || requesting;
  const isBanned = group.myStatus === "banned";
  const interestLabel = group.interest
    ? `${group.interest.emoji ? `${group.interest.emoji} ` : ""}${
        locale === "en" ? group.interest.label_en : group.interest.label_fr
      }`
    : null;

  const avatar = (
    <div
      className="h-14 w-14 shrink-0 overflow-hidden rounded-full"
      style={!group.avatar_url ? { backgroundImage: "var(--grad)" } : undefined}
    >
      {group.avatar_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={group.avatar_url} alt="" className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-lg font-bold text-white">
          {group.name.charAt(0).toUpperCase()}
        </div>
      )}
    </div>
  );

  const badgesRow = (
    <div className="mt-1 flex flex-wrap items-center gap-2">
      {interestLabel && (
        <span className="rounded-full border border-teal2 px-2.5 py-0.5 text-xs font-semibold text-teal2">
          {interestLabel}
        </span>
      )}
      <span className="text-xs text-muted">{t("memberCount", { count: group.memberCount })}</span>
    </div>
  );

  // Members already have the card wrapped in a Link straight to the real
  // group page (with its own full header) — no separate preview needed
  // there. Non-members can't see that page yet, so name/description open a
  // quick-look modal instead, without navigating away or sending a request.
  const infoBlock = isMember ? (
    <>
      {avatar}
      <div className="min-w-0 flex-1">
        <p className="truncate font-bold text-text">{group.name}</p>
        {group.description && (
          <p className="truncate text-sm text-muted">{group.description}</p>
        )}
        {badgesRow}
      </div>
    </>
  ) : (
    <>
      {avatar}
      <div className="min-w-0 flex-1">
        <button
          type="button"
          onClick={() => setDetailsOpen(true)}
          className="truncate text-left font-bold text-text hover:underline"
        >
          {group.name}
        </button>
        {group.description && (
          <button
            type="button"
            onClick={() => setDetailsOpen(true)}
            className="block w-full truncate text-left text-sm text-muted hover:underline"
          >
            {group.description}
          </button>
        )}
        {badgesRow}
      </div>
    </>
  );

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
      <div className="flex items-start gap-4">
        {isMember ? (
          <Link href={`/groups/${group.id}`} className="flex min-w-0 flex-1 items-start gap-4">
            {infoBlock}
          </Link>
        ) : (
          <div className="flex min-w-0 flex-1 items-start gap-4">{infoBlock}</div>
        )}
      </div>

      {isMember ? (
        <span className="text-center text-xs font-semibold text-teal2">
          {t("memberBadge")}
        </span>
      ) : isBanned ? null : showRequested ? (
        <span className="text-center text-xs text-muted">{t("requestSent")}</span>
      ) : (
        <button
          type="button"
          onClick={() => onRequestJoin(group.id)}
          disabled={!canRequest}
          className="w-full rounded-full border border-teal2 px-4 py-2 text-sm font-bold text-teal2 disabled:opacity-60"
        >
          {t("requestToJoin")}
        </button>
      )}

      {!isMember && (
        <Modal open={detailsOpen} onClose={() => setDetailsOpen(false)}>
          <div className="flex items-start gap-4">
            {avatar}
            <div className="min-w-0 flex-1">
              <p className="font-bold text-text">{group.name}</p>
              {badgesRow}
            </div>
          </div>
          {group.description && (
            <p className="mt-4 whitespace-pre-wrap text-sm text-text">{group.description}</p>
          )}
        </Modal>
      )}
    </div>
  );
}
