"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { submitBetaFeedback, uploadFeedbackScreenshot } from "@/lib/beta-feedback/queries";
import type { FeedbackCategory } from "@/lib/beta-feedback/types";
import { Modal } from "@/components/ui/modal";
import { Notice } from "@/components/ui/notice";
import { PhotoPicker } from "@/components/media/photo-picker";

const CATEGORY_LABEL_KEYS: Record<FeedbackCategory, "categoryBug" | "categoryIdea" | "categoryOther"> = {
  bug: "categoryBug",
  idea: "categoryIdea",
  other: "categoryOther",
};
const CATEGORIES = Object.keys(CATEGORY_LABEL_KEYS) as FeedbackCategory[];

/**
 * Floating "send feedback" entry point, shown to every signed-in user during
 * the beta (no separate "tester" flag — see CLAUDE.md). Self-gates like
 * CookieConsentBanner/InstallPromptBanner (renders null until a session is
 * known), no dedicated "current user" context needed. Bottom-left, mirroring
 * DiscoverFab's bottom-right placement so the two floating buttons never
 * overlap.
 */
export function BetaFeedbackButton() {
  const t = useTranslations("BetaFeedback");
  const locale = useLocale();

  const [userId, setUserId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<FeedbackCategory>("bug");
  const [message, setMessage] = useState("");
  // The path is what actually gets submitted; the picker itself only ever
  // sees the short-lived signed preview URL returned by
  // uploadFeedbackScreenshot (the bucket is private, no public URL exists).
  const [screenshotPath, setScreenshotPath] = useState<string | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<"success" | "error" | null>(null);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    supabase.auth.getUser().then(({ data }) => {
      if (!cancelled) setUserId(data.user?.id ?? null);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN") setUserId(session?.user?.id ?? null);
      if (event === "SIGNED_OUT") setUserId(null);
    });
    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
    };
  }, []);

  function resetForm() {
    setCategory("bug");
    setMessage("");
    setScreenshotPath(null);
    setScreenshotPreview([]);
    setFeedback(null);
  }

  function close() {
    if (submitting) return;
    setOpen(false);
    resetForm();
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!userId || !message.trim()) return;
    setSubmitting(true);
    setFeedback(null);
    try {
      const supabase = createClient();
      await submitBetaFeedback(supabase, {
        userId,
        category,
        message: message.trim(),
        pageUrl: typeof window !== "undefined" ? window.location.href : null,
        locale,
        userAgent: typeof navigator !== "undefined" ? navigator.userAgent : null,
        screenshotPath,
      });
      setFeedback("success");
      // Auto-close shortly after a successful send rather than making the
      // user dismiss the confirmation themselves.
      setTimeout(() => {
        setOpen(false);
        resetForm();
      }, 1500);
    } catch {
      setFeedback("error");
    } finally {
      setSubmitting(false);
    }
  }

  if (!userId) return null;

  return (
    <>
      <button
        type="button"
        aria-label={t("buttonAriaLabel")}
        onClick={() => setOpen(true)}
        className="fixed bottom-6 left-6 z-50 flex h-14 w-14 items-center justify-center rounded-full text-2xl leading-none text-white shadow-lg"
        style={{ backgroundImage: "var(--grad)" }}
      >
        💬
      </button>

      <Modal open={open} onClose={close} title={t("modalTitle")}>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          {feedback && (
            <Notice
              kind={feedback}
              message={feedback === "success" ? t("successMessage") : t("errorMessage")}
            />
          )}

          <label className="flex flex-col gap-1">
            <span className="text-xs font-bold uppercase tracking-wide text-muted">
              {t("categoryLabel")}
            </span>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as FeedbackCategory)}
              className="rounded-lg border border-border px-3 py-2 text-sm normal-case text-text outline-none focus:border-teal2"
            >
              {CATEGORIES.map((key) => (
                <option key={key} value={key}>
                  {t(CATEGORY_LABEL_KEYS[key])}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-bold uppercase tracking-wide text-muted">
              {t("messageLabel")}
            </span>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={t("messagePlaceholder")}
              rows={4}
              required
              className="rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-teal2"
            />
          </label>

          <div className="flex flex-col gap-1">
            <span className="text-xs font-bold uppercase tracking-wide text-muted">
              {t("screenshotLabel")}
            </span>
            <PhotoPicker
              value={screenshotPreview}
              onChange={setScreenshotPreview}
              maxPhotos={1}
              upload={async (blob) => {
                const { path, previewUrl } = await uploadFeedbackScreenshot(
                  createClient(),
                  userId,
                  blob
                );
                setScreenshotPath(path);
                return previewUrl;
              }}
              remove={async () => {
                setScreenshotPath(null);
              }}
              addLabel={t("screenshotAdd")}
              errorLabel={t("screenshotError")}
              removeLabel={t("screenshotRemove")}
            />
          </div>

          <div className="mt-1 flex justify-end gap-2">
            <button
              type="button"
              onClick={close}
              disabled={submitting}
              className="rounded-full border border-border px-4 py-2.5 text-sm font-semibold text-muted disabled:opacity-60"
            >
              {t("cancel")}
            </button>
            <button
              type="submit"
              disabled={submitting || !message.trim()}
              className="rounded-full px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"
              style={{ backgroundImage: "var(--grad)" }}
            >
              {submitting ? t("submitting") : t("submit")}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
