"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useLocale, useTranslations } from "next-intl";
import type { Interest } from "@/lib/profile/types";
import { localizedInterestLabel } from "@/lib/interests/label";
import { InterestsGrid } from "@/components/profile/interests-grid";

const fieldLabelClass = "mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted";

/**
 * "Interests" tab: has its own save flow (setMyInterests), independent from
 * the rest of the profile — unchanged from before the tabs split, just moved
 * into its own card.
 */
export function ProfileInterestsSection({
  userId,
  interests,
  selectedIds,
  onSelectedIdsChange,
  collapseSignal,
  dirty,
  pending,
  saved,
  onSave,
}: {
  userId: string;
  interests: Interest[];
  selectedIds: number[];
  onSelectedIdsChange: (ids: number[]) => void;
  collapseSignal: number;
  dirty: boolean;
  pending: boolean;
  saved: boolean;
  onSave: () => void;
}) {
  const t = useTranslations("Profile");
  const tFields = useTranslations("ProfileFields");
  const locale = useLocale();

  return (
    <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 shadow-sm">
      <p className={fieldLabelClass}>
        {tFields("interests")} ({selectedIds.length})
      </p>
      {selectedIds.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {interests
            .filter((interest) => selectedIds.includes(interest.id))
            .map((interest) => (
              <span
                key={interest.id}
                className="rounded-full border border-border bg-bg px-2.5 py-1 text-xs font-semibold text-muted"
              >
                {interest.emoji ? `${interest.emoji} ` : ""}
                {localizedInterestLabel(interest, locale)}
              </span>
            ))}
        </div>
      )}
      <InterestsGrid
        interests={interests}
        selectedIds={selectedIds}
        onChange={onSelectedIdsChange}
        userId={userId}
        collapseSignal={collapseSignal}
      />

      <AnimatePresence>
        {dirty && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
            className="sticky bottom-3 z-10 mt-3 flex justify-center"
          >
            <button
              type="button"
              onClick={onSave}
              disabled={pending}
              className="rounded-full px-5 py-2 text-sm font-bold text-white shadow-lg disabled:opacity-60"
              style={{ backgroundImage: "var(--grad)" }}
            >
              {pending ? "…" : t("saveInterests")}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {saved && !dirty && (
        <p className="mt-2 text-center text-xs font-semibold text-teal2">
          {t("interestsSaved")}
        </p>
      )}
    </div>
  );
}
