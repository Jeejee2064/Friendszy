import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { GroupCardData } from "@/lib/groups/types";

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

  const isMember = group.myStatus === "active";
  const canRequest =
    !isMember &&
    group.myStatus !== "banned" &&
    !group.myPendingJoinRequest &&
    !requesting;
  const showRequested = group.myPendingJoinRequest || requesting;
  const isBanned = group.myStatus === "banned";

  const infoBlock = (
    <>
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

      <div className="min-w-0 flex-1">
        <p className="truncate font-bold text-text">{group.name}</p>
        {group.description && (
          <p className="truncate text-sm text-muted">{group.description}</p>
        )}
        <div className="mt-1 flex flex-wrap items-center gap-2">
          {group.interest && (
            <span className="rounded-full border border-teal2 px-2.5 py-0.5 text-xs font-semibold text-teal2">
              {group.interest.emoji ? `${group.interest.emoji} ` : ""}
              {locale === "en" ? group.interest.label_en : group.interest.label_fr}
            </span>
          )}
          <span className="text-xs text-muted">
            {t("memberCount", { count: group.memberCount })}
          </span>
        </div>
      </div>
    </>
  );

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-4">
        {isMember ? (
          <Link href={`/groups/${group.id}`} className="flex min-w-0 flex-1 items-center gap-4">
            {infoBlock}
          </Link>
        ) : (
          <div className="flex min-w-0 flex-1 items-center gap-4">{infoBlock}</div>
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
    </div>
  );
}
