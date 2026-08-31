"use client";

import { useEffect } from "react";
import { track } from "@/lib/analytics/track";

const STORAGE_KEY = "friendszy:last-session-ping";

// Fires `session_started` at most once per calendar day per browser — the
// signal used to compute D1/D7/D30 retention in the admin Analytics tab.
// Mounted app-wide (src/app/[locale]/layout.tsx), including on public
// pages, same as PwaInstallProvider — track() resolves the current user
// itself and silently no-ops for a logged-out visitor (v1 tracks
// authenticated behaviour only).
export function AnalyticsSessionPing() {
  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    let lastPing: string | null = null;
    try {
      lastPing = localStorage.getItem(STORAGE_KEY);
    } catch {
      // localStorage indisponible (navigation privée, etc.) — on retente à
      // chaque chargement plutôt que de bloquer le tracking.
    }
    if (lastPing === today) return;

    track("session_started");

    try {
      localStorage.setItem(STORAGE_KEY, today);
    } catch {
      // rien à faire — voir plus haut
    }
  }, []);

  return null;
}
