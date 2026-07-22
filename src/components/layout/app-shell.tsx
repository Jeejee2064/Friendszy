import { getTranslations } from "next-intl/server";
import Image from "next/image";
import type { ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import { SidebarNav } from "./sidebar-nav";
import { LocaleToggle } from "./locale-toggle";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { InstallPromptBanner } from "@/components/pwa/install-prompt-banner";
import type { ProfileSummary } from "@/lib/profile/types";

export async function AppShell({
  profile,
  isAdmin = false,
  children,
}: {
  profile: ProfileSummary;
  isAdmin?: boolean;
  children: ReactNode;
}) {
  const t = await getTranslations("Shell");

  return (
    <div className="flex min-h-screen bg-bg">
      <aside className="sticky top-0 flex h-screen w-16 shrink-0 flex-col overflow-y-auto border-r border-border bg-card py-4 md:w-64">
        <Link
          href="/"
          className="mb-6 flex items-center justify-center gap-2 px-2 md:justify-start md:px-4"
        >
          <Image
            src="/icons/icon-maskable-512.png"
            alt=""
            width={32}
            height={32}
            className="rounded-lg"
          />
          {/* eslint-disable-next-line @next/next/no-img-element -- next/image bloque les SVG par défaut */}
          <img
            src="/logo-letters.svg"
            alt="Friendszy"
            width={90}
            height={28}
            className="hidden md:inline"
          />
        </Link>

        <div className="mb-6 flex flex-col items-center gap-2 px-2 md:flex-row md:px-4">
          <div
            className="h-10 w-10 shrink-0 overflow-hidden rounded-full"
            style={
              !profile.avatar_url ? { backgroundImage: "var(--grad)" } : undefined
            }
          >
            {profile.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profile.avatar_url}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-sm font-bold text-white">
                {(profile.full_name ?? "?").charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <div className="hidden md:block">
            <p className="text-sm font-bold text-text">{profile.full_name}</p>
            {profile.city && (
              <p className="text-xs text-muted">📍 {profile.city}</p>
            )}
          </div>
        </div>

        <SidebarNav isAdmin={isAdmin} />

        <div className="mt-auto flex flex-col gap-3 px-2 md:px-4">
          <LocaleToggle />
          <SignOutButton />
          <p className="hidden text-xs text-muted md:block">
            🛡️ {t("security")}: securite@friendszy.ca
          </p>
        </div>
      </aside>

      <main className="min-w-0 flex-1">
        <InstallPromptBanner />
        {children}
      </main>
    </div>
  );
}
