import type { ReactNode } from "react";
import type { ProfileSummary } from "@/lib/profile/types";
import { Link } from "@/i18n/navigation";
import { OnlineDot } from "./online-dot";

export function PersonCard({
  profile,
  sharedInterests,
  actions,
  footer,
  href,
  deletedUserLabel = "?",
}: {
  profile: ProfileSummary;
  sharedInterests?: string[];
  actions?: ReactNode;
  footer?: ReactNode;
  href?: string;
  deletedUserLabel?: string;
}) {
  const displayName = profile.full_name ?? deletedUserLabel;

  const infoBlock = (
    <>
      <div className="relative h-14 w-14 shrink-0">
        <div
          className="h-14 w-14 overflow-hidden rounded-full"
          style={!profile.avatar_url ? { backgroundImage: "var(--grad)" } : undefined}
        >
          {profile.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.avatar_url}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-lg font-bold text-white">
              {displayName.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
        <OnlineDot
          userId={profile.id}
          className="absolute bottom-0 right-0 h-3.5 w-3.5"
        />
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate font-bold text-text">{displayName}</p>
        <p className="truncate text-sm text-muted">
          {[profile.city, profile.age].filter(Boolean).join(" · ")}
        </p>
        {sharedInterests && sharedInterests.length > 0 && (
          <p className="mt-1 truncate text-xs text-teal2">
            {sharedInterests.join(", ")}
          </p>
        )}
      </div>
    </>
  );

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-4">
        {href ? (
          <Link href={href} className="flex min-w-0 flex-1 items-center gap-4">
            {infoBlock}
          </Link>
        ) : (
          <div className="flex min-w-0 flex-1 items-center gap-4">{infoBlock}</div>
        )}

        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>

      {footer}
    </div>
  );
}
