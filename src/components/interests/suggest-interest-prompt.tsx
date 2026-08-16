"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Notice } from "@/components/ui/notice";
import { SuggestInterestForm } from "./suggest-interest-form";

// Shared by InterestsGrid and GroupInterestSelect's own "no results for this
// search" empty states — the two pickers are independent implementations
// (see GroupInterestSelect's own doc comment on why it isn't just reusing
// InterestsGrid), but both need the exact same "propose this interest"
// affordance, so it lives here rather than being duplicated twice.
export function SuggestInterestPrompt({
  query,
  userId,
}: {
  query: string;
  userId: string;
}) {
  const t = useTranslations("InterestSuggestions");
  const [open, setOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  if (submitted) {
    return (
      <div className="py-4">
        <Notice kind="success" message={t("success")} />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2 py-4 text-center">
      <p className="text-sm text-muted">{t("noResultsPrompt", { query })}</p>
      {open ? (
        <SuggestInterestForm
          userId={userId}
          initialLabel={query}
          onSuggested={() => setSubmitted(true)}
        />
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-sm font-semibold text-teal2 hover:underline"
        >
          {t("openForm")}
        </button>
      )}
    </div>
  );
}
