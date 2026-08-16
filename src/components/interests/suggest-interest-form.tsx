"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { createInterestSuggestion } from "@/lib/interest-suggestions/queries";
import { Notice } from "@/components/ui/notice";
import { CustomSelect } from "@/components/ui/custom-select";

// Kept in sync by hand with the interest_suggestions_category_check
// constraint (11 values: the 10 real categories + "autre" as the
// non-blocking fallback) — same category vocabulary CATEGORY_ORDER in
// InterestsGrid/GroupInterestSelect uses, plus "autre".
const CATEGORY_VALUES = [
  "sports",
  "plein_air",
  "arts_creatifs",
  "jeux",
  "lecture",
  "cinema_culture_pop",
  "genres_musicaux",
  "instruments_musique",
  "cuisine",
  "bien_etre",
  "autre",
];

export function SuggestInterestForm({
  userId,
  initialLabel,
  onSuggested,
}: {
  userId: string;
  initialLabel: string;
  onSuggested?: () => void;
}) {
  const locale = useLocale();
  const t = useTranslations("InterestSuggestions");
  const tCategory = useTranslations("InterestCategories");
  const [label, setLabel] = useState(initialLabel);
  const [category, setCategory] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!label.trim() || !category) return;
    setSubmitting(true);
    setError(null);
    try {
      const supabase = createClient();
      await createInterestSuggestion(supabase, {
        suggestedBy: userId,
        label: label.trim(),
        locale: locale === "en" ? "en" : "fr",
        category,
      });
      onSuggested?.();
    } catch (err) {
      const code = (err as { code?: string } | null)?.code;
      setError(code === "23505" ? t("alreadyPending") : t("error"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    // A plain div, not a <form> — this renders inside ProfileForm's outer
    // <form>, and HTML forbids nested <form> elements (hydration error).
    // Submission is driven by the button's onClick and Enter-to-submit on
    // the label input instead of a form's native submit event.
    <div className="flex w-full flex-col gap-2 rounded-lg border border-border bg-card p-3 text-left">
      <label className="flex flex-col gap-1">
        <span className="text-xs font-bold uppercase tracking-wide text-muted">
          {t("labelLabel")}
        </span>
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleSubmit();
            }
          }}
          className="rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-teal2"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs font-bold uppercase tracking-wide text-muted">
          {t("categoryLabel")}
        </span>
        <CustomSelect
          value={category}
          onChange={setCategory}
          options={CATEGORY_VALUES.map((value) => ({ value, label: tCategory(value) }))}
          placeholder="—"
        />
      </label>
      {error && <Notice kind="error" message={error} />}
      <button
        type="button"
        onClick={handleSubmit}
        disabled={submitting || !label.trim() || !category}
        className="mt-1 rounded-full px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
        style={{ backgroundImage: "var(--grad)" }}
      >
        {submitting ? t("submitting") : t("submit")}
      </button>
    </div>
  );
}
