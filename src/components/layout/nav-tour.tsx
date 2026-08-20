"use client";

import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import { usePwaInstall } from "@/lib/pwa/install-context";
import { navTourTargetId } from "./nav-items";

type Rect = { top: number; left: number; width: number; height: number };

const HIGHLIGHT_PAD = 8;
const BUBBLE_WIDTH = 260;
const VIEWPORT_MARGIN = 12;

/**
 * One-time guided tour of the main nav, shown right after onboarding: a
 * welcome screen first (launch or skip), then a bubble per real nav icon
 * (see `getNavKeys`/`navTourTargetId` in nav-items.ts — the sequence is
 * never a separate hardcoded list, it's exactly what SidebarNav renders).
 * Gated by `profiles.has_seen_nav_tour`; skipping the welcome screen and
 * finishing/skipping the icon steps all end it for good, via `finish()`.
 */
export function NavTour({
  navKeys,
  userId,
  initialSeen,
}: {
  navKeys: string[];
  userId: string;
  initialSeen: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations("Nav");
  const tTour = useTranslations("NavTour");
  const { setNavTourActive } = usePwaInstall();

  const [dismissed, setDismissed] = useState(initialSeen);
  const [started, setStarted] = useState(false);
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);

  // Only the home page, and only until the tour is finished/skipped — once
  // `dismissed` flips it stays flipped for the rest of the session even if
  // the user later navigates back to "/" (the layout that owns this
  // component isn't remounted by client-side nav, so we can't rely on
  // `initialSeen` alone after the first dismissal).
  const active = !dismissed && pathname === "/" && navKeys.length > 0;
  const key = navKeys[Math.min(step, navKeys.length - 1)];

  // Let InstallPromptBanner know the tour is on screen so it can hold off
  // opening on top of it (see install-context.tsx).
  useEffect(() => {
    setNavTourActive(active);
  }, [active, setNavTourActive]);

  const measure = useCallback(() => {
    const el = document.getElementById(navTourTargetId(key));
    setRect(el ? el.getBoundingClientRect() : null);
  }, [key]);

  useLayoutEffect(() => {
    if (!active || !started) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    measure();
  }, [active, started, measure]);

  useEffect(() => {
    if (!active || !started) return;
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [active, started, measure]);

  const finish = useCallback(() => {
    setDismissed(true);
    createClient()
      .from("profiles")
      .update({ has_seen_nav_tour: true })
      .eq("id", userId)
      .then(({ error }) => {
        if (error) console.error("Failed to persist nav tour completion", error);
      });
    // Resolve-and-consume a pending "clicked a marker before signing up"
    // intent (src/lib/intent/*) right as the tour ends — the one case
    // IntentRedirect (src/components/landing/intent-redirect.tsx) can't
    // cover itself, since it only fires for an account that already had
    // has_seen_nav_tour = true and so never mounts this component at all.
    fetch("/api/intent")
      .then((r) => r.json())
      .then((data: { href: string | null }) => {
        if (data.href) router.push(data.href);
      })
      .catch(() => {
        // No pending intent is the common case — stay put.
      });
  }, [userId, router]);

  useEffect(() => {
    if (!active) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") finish();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [active, finish]);

  if (!active) return null;

  if (!started) {
    return (
      <div role="dialog" aria-modal="true" aria-label={tTour("title")}>
        <div className="fixed inset-0 z-40 bg-black/40" />
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 text-center shadow-lg">
            <p className="text-3xl">👋</p>
            <h2 className="mt-2 text-lg font-extrabold text-text">
              {tTour("welcomeTitle")}
            </h2>
            <p className="mt-2 text-sm text-muted">{tTour("welcomeBody")}</p>
            <div className="mt-6 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={finish}
                className="text-sm font-semibold text-muted hover:underline"
              >
                {tTour("skip")}
              </button>
              <button
                type="button"
                onClick={() => setStarted(true)}
                className="rounded-full px-5 py-2 text-sm font-bold text-white transition-opacity hover:opacity-90"
                style={{ backgroundImage: "var(--grad)" }}
              >
                {tTour("start")}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!rect) return null;

  const isLast = step === navKeys.length - 1;

  const highlightStyle = {
    top: rect.top - HIGHLIGHT_PAD,
    left: rect.left - HIGHLIGHT_PAD,
    width: rect.width + HIGHLIGHT_PAD * 2,
    height: rect.height + HIGHLIGHT_PAD * 2,
    borderRadius: 16,
    boxShadow: "0 0 0 4px rgba(30, 207, 176, 0.55), 0 0 0 9999px rgba(13, 36, 32, 0.6)",
    transition: "top 200ms ease, left 200ms ease",
  };

  const viewportW = window.innerWidth;
  const viewportH = window.innerHeight;
  let bubbleLeft = rect.left + rect.width + 16;
  if (bubbleLeft + BUBBLE_WIDTH > viewportW - VIEWPORT_MARGIN) {
    bubbleLeft = Math.max(VIEWPORT_MARGIN, rect.left - BUBBLE_WIDTH - 16);
  }
  const bubbleTop = Math.min(
    Math.max(rect.top, VIEWPORT_MARGIN),
    viewportH - 180 - VIEWPORT_MARGIN
  );

  return (
    <div role="dialog" aria-modal="true" aria-label={tTour("title")}>
      {/* Blocks interaction with the rest of the app while the tour is
          active — progressing only happens via the buttons/Escape below. */}
      <div className="fixed inset-0 z-40" />
      <div className="pointer-events-none fixed" style={{ ...highlightStyle, zIndex: 45 }} />

      <div
        className="fixed z-50 rounded-2xl border border-border bg-card p-4 shadow-lg transition-all duration-200"
        style={{ top: bubbleTop, left: bubbleLeft, width: BUBBLE_WIDTH }}
      >
        <p className="text-xs font-bold uppercase tracking-wide text-muted">
          {tTour("stepOf", { step: step + 1, total: navKeys.length })}
        </p>
        <p className="mt-1 font-extrabold text-text">{t(key)}</p>
        <p className="mt-1 text-sm text-muted">{tTour(`steps.${key}`)}</p>

        <div className="mt-4 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={finish}
            className="text-sm font-semibold text-muted hover:underline"
          >
            {tTour("skip")}
          </button>
          <button
            type="button"
            onClick={() => (isLast ? finish() : setStep((s) => s + 1))}
            className="rounded-full px-5 py-2 text-sm font-bold text-white transition-opacity hover:opacity-90"
            style={{ backgroundImage: "var(--grad)" }}
          >
            {isLast ? tTour("finish") : tTour("next")}
          </button>
        </div>
      </div>
    </div>
  );
}
