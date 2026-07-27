"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Modal } from "@/components/ui/modal";
import { usePwaInstall } from "@/lib/pwa/install-context";

// Shown at most once ever per browser — set the moment we decide to show
// it, not on dismiss, so it can never come back on a later page load just
// because the user ignored it instead of explicitly closing it.
const SHOWN_STORAGE_KEY = "friendszy:pwa-install-shown";

// Never pop up the instant a qualifying page loads — that immediacy is
// what made this feel random/sudden. A flat delay is simpler than
// visit-counting and gives the user a moment on the page first.
const OPEN_DELAY_MS = 3000;

export function InstallPromptBanner() {
  const t = useTranslations("Pwa");
  const { deferredPrompt, alreadyInstalled, platform, promptInstall } = usePwaInstall();
  const [open, setOpen] = useState(false);
  const [delayElapsed, setDelayElapsed] = useState(false);

  const isMobile = platform === "ios" || platform === "android";
  const ios = platform === "ios";

  useEffect(() => {
    if (!isMobile || alreadyInstalled || localStorage.getItem(SHOWN_STORAGE_KEY)) return;

    const timer = setTimeout(() => setDelayElapsed(true), OPEN_DELAY_MS);
    return () => clearTimeout(timer);
  }, [isMobile, alreadyInstalled]);

  useEffect(() => {
    if (!isMobile || alreadyInstalled || open || localStorage.getItem(SHOWN_STORAGE_KEY)) return;
    if (!delayElapsed) return;
    // iOS has no deferred prompt to wait for — the delay alone gates it.
    // Android needs the browser to have actually fired
    // `beforeinstallprompt` (captured globally by PwaInstallProvider) —
    // whichever of the delay or the event arrives later is what opens it.
    function markShownAndOpen() {
      localStorage.setItem(SHOWN_STORAGE_KEY, "1");
      setOpen(true);
    }
    if (ios || deferredPrompt) markShownAndOpen();
  }, [isMobile, alreadyInstalled, open, delayElapsed, ios, deferredPrompt]);

  function close() {
    setOpen(false);
  }

  async function handleInstall() {
    await promptInstall();
    setOpen(false);
  }

  return (
    <Modal open={open} onClose={close}>
      <div className="flex flex-col items-center text-center">
        <span
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-2xl"
          style={{ backgroundImage: "var(--grad)" }}
        >
          📲
        </span>
        <p className="mt-4 text-lg font-extrabold text-text">{t("installTitle")}</p>
        <p className="mt-1 text-sm text-muted">
          {ios ? t("iosInstructions") : t("installBody")}
        </p>
        <div className="mt-6 flex w-full items-center gap-2">
          {!ios && (
            <button
              type="button"
              onClick={handleInstall}
              className="flex-1 rounded-full px-4 py-2.5 text-sm font-bold text-white"
              style={{ backgroundImage: "var(--grad)" }}
            >
              {t("installButton")}
            </button>
          )}
          <button
            type="button"
            onClick={close}
            className={`rounded-full border border-border px-4 py-2.5 text-sm font-semibold text-muted ${
              ios ? "flex-1" : ""
            }`}
          >
            {t("dismissButton")}
          </button>
        </div>
      </div>
    </Modal>
  );
}
