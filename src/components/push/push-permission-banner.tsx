"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Modal } from "@/components/ui/modal";
import { usePwaInstall } from "@/lib/pwa/install-context";
import { createClient } from "@/lib/supabase/client";
import { isPushSupported, subscribeToPush } from "@/lib/push/subscribe";

// Shown at most once ever per browser — same "set the moment we decide to
// show it" rule as the PWA install banner (src/components/pwa/install-prompt-banner.tsx),
// so it can never reappear later just because the user ignored it.
const SHOWN_STORAGE_KEY = "friendszy:push-prompt-shown";

// Mounted inside the Messages page rather than globally in AppShell: the
// user has just opened messaging, so "get notified about new messages" is
// contextually obvious — and it naturally satisfies "not on first load"
// without needing to coordinate timing against the PWA install banner /
// nav tour, which both fire globally on the very first authenticated page.
const OPEN_DELAY_MS = 2000;

export function PushPermissionBanner() {
  const t = useTranslations("Push");
  const locale = useLocale();
  const { platform, alreadyInstalled, navTourActive } = usePwaInstall();
  const [open, setOpen] = useState(false);
  const [supported, setSupported] = useState(false);
  const ios = platform === "ios";
  const iosNeedsInstall = ios && !alreadyInstalled;

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSupported(isPushSupported());
  }, []);

  useEffect(() => {
    if (!supported) return;
    if (typeof Notification === "undefined" || Notification.permission !== "default") return;
    if (localStorage.getItem(SHOWN_STORAGE_KEY)) return;
    // iOS only grants push permission to an installed (home-screen) PWA —
    // asking before that just shows a request that can't succeed. Don't
    // nag toward installing either, per the client's explicit constraint;
    // Settings still explains the prerequisite for anyone curious.
    if (iosNeedsInstall) return;
    if (navTourActive) return;

    const timer = setTimeout(() => {
      localStorage.setItem(SHOWN_STORAGE_KEY, "1");
      setOpen(true);
    }, OPEN_DELAY_MS);
    return () => clearTimeout(timer);
  }, [supported, iosNeedsInstall, navTourActive]);

  // Permission already granted (earlier session, or another device) — make
  // sure this device/browser has a row in push_subscriptions, silently, no
  // prompt needed.
  useEffect(() => {
    if (!supported) return;
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) subscribeToPush(supabase, data.user.id, locale).catch(() => {});
    });
  }, [supported, locale]);

  async function handleEnable() {
    setOpen(false);
    const supabase = createClient();
    const { data } = await supabase.auth.getUser();
    if (data.user) await subscribeToPush(supabase, data.user.id, locale).catch(() => {});
  }

  if (!supported || iosNeedsInstall) return null;

  return (
    <Modal open={open} onClose={() => setOpen(false)}>
      <div className="flex flex-col items-center text-center">
        <span
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-2xl"
          style={{ backgroundImage: "var(--grad)" }}
        >
          🔔
        </span>
        <p className="mt-4 text-lg font-extrabold text-text">{t("bannerTitle")}</p>
        <p className="mt-1 text-sm text-muted">{t("bannerBody")}</p>
        <div className="mt-6 flex w-full items-center gap-2">
          <button
            type="button"
            onClick={handleEnable}
            className="flex-1 rounded-full px-4 py-2.5 text-sm font-bold text-white"
            style={{ backgroundImage: "var(--grad)" }}
          >
            {t("enableButton")}
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-full border border-border px-4 py-2.5 text-sm font-semibold text-muted"
          >
            {t("dismissButton")}
          </button>
        </div>
      </div>
    </Modal>
  );
}
