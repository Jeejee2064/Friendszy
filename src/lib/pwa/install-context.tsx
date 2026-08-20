"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

// Set the moment `appinstalled` fires — this plus `isStandalone()` is the
// best "already installed" signal we can get client-side. There is no
// equivalent on iOS (Safari has neither `beforeinstallprompt` nor
// `appinstalled`), so a user who added to their home screen and comes back
// via regular Safari can't be detected as already-installed; that's a
// platform limitation, not a bug here.
const INSTALLED_STORAGE_KEY = "friendszy:pwa-installed";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type Platform = "ios" | "android" | "desktop" | "other";

type PwaInstallContextValue = {
  deferredPrompt: BeforeInstallPromptEvent | null;
  alreadyInstalled: boolean;
  platform: Platform;
  promptInstall: () => Promise<void>;
  // Not a PWA concept — shared here purely so InstallPromptBanner can defer
  // to NavTour (src/components/layout/nav-tour.tsx) without a second
  // context. Both already sit under this provider (root layout → AppShell).
  navTourActive: boolean;
  setNavTourActive: (active: boolean) => void;
};

const PwaInstallContext = createContext<PwaInstallContextValue | null>(null);

function detectPlatform(): Platform {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  if (/Android/i.test(ua)) return "android";
  if (/Mobi/i.test(ua)) return "other";
  return "desktop";
}

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as { standalone?: boolean }).standalone === true
  );
}

export function PwaInstallProvider({ children }: { children: ReactNode }) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [platform, setPlatform] = useState<Platform>("other");
  const [alreadyInstalled, setAlreadyInstalled] = useState(false);
  const [navTourActive, setNavTourActive] = useState(false);

  useEffect(() => {
    function initState() {
      setPlatform(detectPlatform());
      setAlreadyInstalled(isStandalone() || !!localStorage.getItem(INSTALLED_STORAGE_KEY));
    }
    initState();

    function handleBeforeInstallPrompt(e: Event) {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    }

    function handleAppInstalled() {
      localStorage.setItem(INSTALLED_STORAGE_KEY, "1");
      setAlreadyInstalled(true);
      setDeferredPrompt(null);
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  async function promptInstall() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
  }

  return (
    <PwaInstallContext.Provider
      value={{
        deferredPrompt,
        alreadyInstalled,
        platform,
        promptInstall,
        navTourActive,
        setNavTourActive,
      }}
    >
      {children}
    </PwaInstallContext.Provider>
  );
}

export function usePwaInstall() {
  const ctx = useContext(PwaInstallContext);
  if (!ctx) throw new Error("usePwaInstall must be used within a PwaInstallProvider");
  return ctx;
}
