"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import { upsertMyProfile, setMyInterests } from "@/lib/profile/queries";
import type { Gender, Interest } from "@/lib/profile/types";
import { AvatarPicker } from "@/components/profile/avatar-picker";
import { GenderSelect } from "@/components/profile/gender-select";
import { InterestsGrid } from "@/components/profile/interests-grid";

type FormState = {
  fullName: string;
  avatarUrl: string | null;
  city: string;
  age: number | null;
  gender: Gender | null;
  interestIds: number[];
  bio: string;
};

const STEP_COUNT = 4;

export function OnboardingWizard({
  userId,
  interests,
  initial,
}: {
  userId: string;
  interests: Interest[];
  initial: FormState;
}) {
  const t = useTranslations("Onboarding");
  const tFields = useTranslations("ProfileFields");
  const router = useRouter();

  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function validateStep(): string | null {
    if (step === 0) {
      if (!form.fullName.trim()) return t("errors.fullNameRequired");
      if (!form.avatarUrl) return t("errors.photoRequired");
    }
    if (step === 1) {
      if (!form.city.trim()) return t("errors.cityRequired");
      if (!form.age || form.age < 18 || form.age > 120)
        return t("errors.ageInvalid");
      if (!form.gender) return t("errors.genderRequired");
    }
    if (step === 2) {
      if (form.interestIds.length === 0) return t("errors.interestsRequired");
    }
    return null;
  }

  function goNext() {
    const validationError = validateStep();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setStep((s) => Math.min(s + 1, STEP_COUNT - 1));
  }

  function goBack() {
    setError(null);
    setStep((s) => Math.max(s - 1, 0));
  }

  async function finish() {
    setPending(true);
    setError(null);
    try {
      const supabase = createClient();
      await upsertMyProfile(supabase, userId, {
        full_name: form.fullName.trim(),
        avatar_url: form.avatarUrl,
        city: form.city.trim(),
        age: form.age,
        gender: form.gender,
        bio: form.bio.trim() || null,
      });
      await setMyInterests(supabase, userId, form.interestIds);
      router.push("/");
      router.refresh();
    } catch {
      setError(t("errors.saveFailed"));
      setPending(false);
    }
  }

  const stepTitles = [
    t("steps.photo"),
    t("steps.basics"),
    t("steps.interests"),
    t("steps.bio"),
  ];

  return (
    <main className="flex min-h-screen flex-col items-center gap-8 bg-bg px-6 py-16">
      <div className="text-center">
        <h1 className="font-pacifico text-4xl text-teal2">Friendszy</h1>
        <p className="mt-1 text-sm text-muted">
          {t("stepOf", { step: step + 1, total: STEP_COUNT })}
        </p>
      </div>

      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 shadow-sm">
        <div className="mb-5 flex justify-center gap-2">
          {Array.from({ length: STEP_COUNT }).map((_, i) => (
            <span
              key={i}
              className="h-1.5 w-8 rounded-full"
              style={{
                backgroundImage: i <= step ? "var(--grad)" : undefined,
                backgroundColor: i <= step ? undefined : "var(--border)",
              }}
            />
          ))}
        </div>

        <h2 className="mb-4 text-lg font-extrabold text-text">
          {stepTitles[step]}
        </h2>

        {step === 0 && (
          <div className="flex flex-col items-center gap-4">
            <AvatarPicker
              userId={userId}
              value={form.avatarUrl}
              onChange={(url) => update("avatarUrl", url)}
            />
            <input
              type="text"
              required
              placeholder={tFields("fullNamePlaceholder")}
              value={form.fullName}
              onChange={(e) => update("fullName", e.target.value)}
              className="w-full rounded-lg border border-border px-3 py-2.5 text-sm outline-none focus:border-teal2"
            />
          </div>
        )}

        {step === 1 && (
          <div className="flex flex-col gap-3">
            <input
              type="text"
              placeholder={tFields("cityPlaceholder")}
              value={form.city}
              onChange={(e) => update("city", e.target.value)}
              className="rounded-lg border border-border px-3 py-2.5 text-sm outline-none focus:border-teal2"
            />
            <input
              type="number"
              min={18}
              max={120}
              placeholder={tFields("agePlaceholder")}
              value={form.age ?? ""}
              onChange={(e) =>
                update("age", e.target.value ? Number(e.target.value) : null)
              }
              className="rounded-lg border border-border px-3 py-2.5 text-sm outline-none focus:border-teal2"
            />
            <GenderSelect
              value={form.gender}
              onChange={(g) => update("gender", g)}
            />
          </div>
        )}

        {step === 2 && (
          <InterestsGrid
            interests={interests}
            selectedIds={form.interestIds}
            onChange={(ids) => update("interestIds", ids)}
          />
        )}

        {step === 3 && (
          <textarea
            rows={4}
            placeholder={tFields("bioPlaceholder")}
            value={form.bio}
            onChange={(e) => update("bio", e.target.value)}
            className="w-full rounded-lg border border-border px-3 py-2.5 text-sm outline-none focus:border-teal2"
          />
        )}

        {error && (
          <div
            className="mt-4 rounded-lg border p-3 text-sm"
            style={{
              background: "#fdecec",
              borderColor: "#f3c8c8",
              color: "#e55",
            }}
          >
            {error}
          </div>
        )}

        <div className="mt-6 flex items-center justify-between gap-3">
          {step > 0 ? (
            <button
              type="button"
              onClick={goBack}
              className="text-sm font-semibold text-muted hover:underline"
            >
              {t("back")}
            </button>
          ) : (
            <span />
          )}

          {step === STEP_COUNT - 1 && (
            <button
              type="button"
              onClick={finish}
              disabled={pending}
              className="text-sm font-semibold text-muted hover:underline"
            >
              {t("skip")}
            </button>
          )}

          <button
            type="button"
            onClick={step === STEP_COUNT - 1 ? finish : goNext}
            disabled={pending}
            className="rounded-full px-6 py-2.5 font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
            style={{ backgroundImage: "var(--grad)" }}
          >
            {pending ? "…" : step === STEP_COUNT - 1 ? t("finish") : t("next")}
          </button>
        </div>
      </div>
    </main>
  );
}
