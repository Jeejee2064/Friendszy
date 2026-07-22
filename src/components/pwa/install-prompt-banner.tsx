"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Modal } from "@/components/ui/modal";

// Shown at most once ever per browser — set the moment we decide to show
// it, not on dismiss, so it can never come back on a later page load just
// because the user ignored it instead of explicitly closing it.
const SHOWN_STORAGE_KEY = "friendszy:pwa-install-shown";

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

export function InstallPromptBanner() {
  const t = useTranslations("Pwa");
  const [open, setOpen] = useState(false);
  const [ios, setIos] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (!isMobileDevice() || isStandalone() || localStorage.getItem(SHOWN_STORAGE_KEY)) {
      return;
    }

    function markShownAndOpen(isIosDevice: boolean) {
      localStorage.setItem(SHOWN_STORAGE_KEY, "1");
      setIos(isIosDevice);
      setOpen(true);
    }

    if (isIos()) {
      markShownAndOpen(true);
      return;
    }

    function handleBeforeInstallPrompt(e: Event) {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      markShownAndOpen(false);
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
  }, []);

  function close() {
    setOpen(false);
  }

  async function handleInstall() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
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
