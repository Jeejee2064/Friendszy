import type { ReactNode } from "react";
import { TabButton } from "@/components/ui/tab-button";

export type ProfileTab = "info" | "photos" | "interests" | "settings";

/**
 * Sticky top-level tab bar for the "edit my profile" page. Uses the shared
 * pill-style TabButton (same as Discover/Groups) inside a full-bleed sticky
 * strip so it stays visible while scrolling through a tab's content — the
 * page's own <main> has nothing else sticky above it (InstallPromptBanner in
 * app-shell.tsx isn't sticky), so top-0 is enough, no offset needed.
 */
export function ProfileTabs({
  active,
  onChange,
  labels,
}: {
  active: ProfileTab;
  onChange: (tab: ProfileTab) => void;
  labels: Record<ProfileTab, ReactNode>;
}) {
  const tabs: ProfileTab[] = ["info", "photos", "interests", "settings"];

  return (
    <div className="sticky top-0 z-20 -mx-6 mb-4 bg-bg px-6 pb-3 pt-1 md:-mx-10 md:px-10">
      <div className="flex gap-1 rounded-full border border-border bg-card p-1">
        {tabs.map((tab) => (
          <TabButton key={tab} active={active === tab} onClick={() => onChange(tab)}>
            {labels[tab]}
          </TabButton>
        ))}
      </div>
    </div>
  );
}
