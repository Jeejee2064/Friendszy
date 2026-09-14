"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { TemporaryCityCard } from "@/components/profile/temporary-city-card";
import { SignOutButton } from "@/components/auth/sign-out-button";

const settingsRowClass =
  "flex w-full items-center justify-between rounded-xl border border-border px-4 py-3 text-sm font-semibold text-muted transition-colors hover:border-teal2 hover:text-teal2";
const signOutRowClass =
  "flex w-full items-center gap-2 rounded-xl border border-[#a8543a]/30 px-4 py-3 text-sm font-semibold transition-colors hover:border-[#a8543a] disabled:opacity-60";

/**
 * "Settings" tab: groups the temporary-city trip planner with the account
 * controls that used to sit as 3 chip-links above the whole page
 * (blocked users / settings / sign out) — kept as a light summary here, with
 * a link out to the full /settings page (PWA, notifications, data export,
 * account deletion) rather than duplicating it.
 */
export function ProfileSettingsSection({
  temporaryCity,
  onTripActiveChange,
}: {
  temporaryCity: {
    homeCity: string | null;
    destination: string | null;
    from: string | null;
    until: string | null;
  };
  onTripActiveChange: (active: boolean) => void;
}) {
  const t = useTranslations("Profile");

  return (
    <div className="flex w-full max-w-sm flex-col gap-4">
      <TemporaryCityCard
        homeCity={temporaryCity.homeCity}
        destination={temporaryCity.destination}
        from={temporaryCity.from}
        until={temporaryCity.until}
        onActiveChange={onTripActiveChange}
      />

      <div className="flex flex-col gap-2">
        <Link href="/friends?tab=blocked" className={settingsRowClass}>
          <span>🚫 {t("blockedUsersLink")}</span>
          <span aria-hidden>›</span>
        </Link>
        <Link href="/settings" className={settingsRowClass}>
          <span>⚙️ {t("moreSettingsLink")}</span>
          <span aria-hidden>›</span>
        </Link>
        <SignOutButton iconOnly={false} className={signOutRowClass} />
      </div>
    </div>
  );
}
