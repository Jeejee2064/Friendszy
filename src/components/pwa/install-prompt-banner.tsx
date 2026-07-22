"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

const DISMISS_STORAGE_KEY = "friendszy:pwa-install-dismissed-until";
const DISMISS_DAYS = 14;

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isMobileDevice() {
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as { standalone?: boolean }).standalone === true
  );
}

function isIos() {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

function isDismissed() {
  const until = localStorage.getItem(DISMISS_STORAGE_KEY);
  return !!until && Date.now() < Number(until);
}

export function InstallPromptBanner() {
  const t = useTranslations("Pwa");
  const [visible, setVisible] = useState(false);
  const [ios, setIos] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (!isMobileDevice() || isStandalone() || isDismissed()) return;

    if (isIos()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIos(true);
      setVisible(true);
      return;
    }

    function handleBeforeInstallPrompt(e: Event) {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setVisible(true);
    }

    function handleAppInstalled() {
      setVisible(false);
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  function dismiss() {
    localStorage.setItem(
      DISMISS_STORAGE_KEY,
      String(Date.now() + DISMISS_DAYS * 24 * 60 * 60 * 1000)
    );
    setVisible(false);
  }

  async function handleInstall() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="m-4 flex items-center gap-3 rounded-2xl border border-border bg-card p-4">
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg"
        style={{ backgroundImage: "var(--grad)" }}
      >
        📲
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-bold text-text">{t("installTitle")}</p>
        <p className="text-sm text-muted">{ios ? t("iosInstructions") : t("installBody")}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {!ios && (
          <button
            type="button"
            onClick={handleInstall}
            className="rounded-full px-4 py-2 text-sm font-bold text-white"
            style={{ backgroundImage: "var(--grad)" }}
          >
            {t("installButton")}
          </button>
        )}
        <button
          type="button"
          onClick={dismiss}
          className="rounded-full border border-border px-4 py-2 text-sm font-semibold text-muted"
        >
          {t("dismissButton")}
        </button>
      </div>
    </div>
  );
}
