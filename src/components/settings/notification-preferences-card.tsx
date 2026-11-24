"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import {
  DEFAULT_PREFERENCES,
  getNotificationPreferences,
  saveNotificationPreferences,
  type NotificationPreferences,
} from "@/lib/notifications/preferences";
import { sendTestNotification } from "@/lib/notifications/actions";

type CategoryKey = "push_messages" | "push_social" | "push_groups" | "push_events";
const CATEGORIES: CategoryKey[] = ["push_messages", "push_social", "push_groups", "push_events"];

const DEFAULT_QUIET = { start: "22:00", end: "07:00" };

export function NotificationPreferencesCard() {
  const t = useTranslations("Settings");
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [testState, setTestState] = useState<"idle" | "sending" | "sent" | "wait" | "error">("idle");
  const userIdRef = useRef<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user || cancelled) return;
      userIdRef.current = data.user.id;
      try {
        const loaded = await getNotificationPreferences(supabase, data.user.id);
        if (!cancelled) setPrefs(loaded);
      } catch {
        if (!cancelled) setPrefs(DEFAULT_PREFERENCES);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function update(next: NotificationPreferences) {
    const previous = prefs;
    setPrefs(next);
    const userId = userIdRef.current;
    if (!userId) return;
    setStatus("saving");
    try {
      await saveNotificationPreferences(createClient(), userId, next);
      setStatus("saved");
    } catch {
      setPrefs(previous);
      setStatus("error");
    }
  }

  async function handleTest() {
    setTestState("sending");
    const { error } = await sendTestNotification();
    setTestState(error === "rate_limited" ? "wait" : error ? "error" : "sent");
  }

  if (!prefs) return null;

  const quietOn = prefs.quiet_start !== null && prefs.quiet_end !== null;

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <h2 className="mb-1 font-bold text-text">{t("prefsTitle")}</h2>
      <p className="mb-4 text-sm text-muted">{t("prefsBody")}</p>

      <ul className="mb-4 flex flex-col gap-3">
        {CATEGORIES.map((key) => (
          <li key={key}>
            <label className="flex items-center justify-between gap-3">
              <span>
                <span className="block text-sm font-semibold text-text">{t(`prefs_${key}`)}</span>
                <span className="block text-xs text-muted">{t(`prefs_${key}_hint`)}</span>
              </span>
              <input
                type="checkbox"
                role="switch"
                checked={prefs[key]}
                onChange={(e) => update({ ...prefs, [key]: e.target.checked })}
                className="h-5 w-5 shrink-0 accent-[var(--teal2)]"
              />
            </label>
          </li>
        ))}
      </ul>

      <div className="mb-4 border-t border-border pt-4">
        <label className="flex items-center justify-between gap-3">
          <span>
            <span className="block text-sm font-semibold text-text">{t("quietTitle")}</span>
            <span className="block text-xs text-muted">{t("quietHint")}</span>
          </span>
          <input
            type="checkbox"
            role="switch"
            checked={quietOn}
            onChange={(e) =>
              update({
                ...prefs,
                quiet_start: e.target.checked ? DEFAULT_QUIET.start : null,
                quiet_end: e.target.checked ? DEFAULT_QUIET.end : null,
              })
            }
            className="h-5 w-5 shrink-0 accent-[var(--teal2)]"
          />
        </label>
        {quietOn && (
          <div className="mt-3 flex items-center gap-3 text-sm text-text">
            <label className="flex items-center gap-2">
              {t("quietFrom")}
              <input
                type="time"
                value={prefs.quiet_start ?? DEFAULT_QUIET.start}
                onChange={(e) => e.target.value && update({ ...prefs, quiet_start: e.target.value })}
                className="rounded-lg border border-border px-2 py-1"
              />
            </label>
            <label className="flex items-center gap-2">
              {t("quietTo")}
              <input
                type="time"
                value={prefs.quiet_end ?? DEFAULT_QUIET.end}
                onChange={(e) => e.target.value && update({ ...prefs, quiet_end: e.target.value })}
                className="rounded-lg border border-border px-2 py-1"
              />
            </label>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleTest}
          disabled={testState === "sending"}
          className="rounded-full border border-border px-4 py-2 text-sm font-bold text-text disabled:opacity-60"
        >
          {testState === "sending" ? "…" : t("testButton")}
        </button>
        <span className="text-xs text-muted" aria-live="polite">
          {testState === "sent" && t("testSent")}
          {testState === "wait" && t("testWait")}
          {testState === "error" && t("testError")}
          {testState === "idle" && status === "saved" && t("prefsSaved")}
          {testState === "idle" && status === "error" && t("prefsError")}
        </span>
      </div>
    </div>
  );
}
