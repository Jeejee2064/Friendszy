"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import { upsertMyProfile, setMyInterests } from "@/lib/profile/queries";
import type { Gender, Interest } from "@/lib/profile/types";
import { AvatarPicker } from "@/components/profile/avatar-picker";
import { GenderSelect } from "@/components/profile/gender-select";
import { InterestsGrid } from "@/components/profile/interests-grid";
import { SignOutButton } from "@/components/auth/sign-out-button";

const chipButtonClass =
  "inline-flex items-center gap-1.5 rounded-full border border-border px-3.5 py-1.5 text-xs font-semibold text-muted transition-colors hover:border-teal2 hover:text-teal2";
const signOutChipClass =
  "inline-flex items-center gap-1.5 rounded-full border border-[#a8543a]/30 px-3.5 py-1.5 text-xs font-semibold transition-colors hover:border-[#a8543a] disabled:opacity-60";
const fieldLabelClass = "mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted";
const fieldInputClass =
  "w-full rounded-lg border border-border px-3 py-2.5 text-sm outline-none focus:border-teal2";

type FormState = {
  fullName: string;
  avatarUrl: string | null;
  city: string;
  age: number | null;
  gender: Gender | null;
  interestIds: number[];
  bio: string;
};

export function ProfileForm({
  userId,
  interests,
  initial,
}: {
  userId: string;
  interests: Interest[];
  initial: FormState;
}) {
  const t = useTranslations("Profile");
  const tFields = useTranslations("ProfileFields");

  const [form, setForm] = useState<FormState>(initial);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<
    { kind: "success" | "error"; message: string } | null
  >(null);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setNotice(null);

    if (!form.fullName.trim()) {
      setNotice({ kind: "error", message: t("errors.fullNameRequired") });
      return;
    }
    if (form.age !== null && (form.age < 18 || form.age > 120)) {
      setNotice({ kind: "error", message: t("errors.ageInvalid") });
      return;
    }

    setPending(true);
    try {
      const supabase = createClient();
      await upsertMyProfile(supabase, userId, {
        full_name: form.fullName.trim(),
        avatar_url: form.avatarUrl,
        city: form.city.trim() || null,
        age: form.age,
        gender: form.gender,
        bio: form.bio.trim() || null,
      });
      await setMyInterests(supabase, userId, form.interestIds);
      setNotice({ kind: "success", message: t("saveSuccess") });
    } catch {
      setNotice({ kind: "error", message: t("saveError") });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="p-6 md:p-10">
      <h1 className="mb-4 text-2xl font-extrabold text-text">{t("title")}</h1>

      <div className="mb-6 flex flex-wrap gap-2">
        <Link href="/friends?tab=blocked" className={chipButtonClass}>
          🚫 {t("blockedUsersLink")}
        </Link>
        <Link href="/settings" className={chipButtonClass}>
          ⚙️ {t("settingsLink")}
        </Link>
        <SignOutButton iconOnly={false} className={signOutChipClass} />
      </div>

      <form
        onSubmit={handleSave}
        className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 shadow-sm"
      >
        <div className="flex flex-col items-center gap-4">
          <AvatarPicker
            userId={userId}
            value={form.avatarUrl}
            onChange={(url) => update("avatarUrl", url)}
          />
          <div className="w-full">
            <label htmlFor="profile-full-name" className={fieldLabelClass}>
              {tFields("fullNameLabel")}
            </label>
            <input
              id="profile-full-name"
              type="text"
              required
              placeholder={tFields("fullNamePlaceholder")}
              value={form.fullName}
              onChange={(e) => update("fullName", e.target.value)}
              className={fieldInputClass}
            />
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3">
          <div>
            <label htmlFor="profile-city" className={fieldLabelClass}>
              {tFields("cityLabel")}
            </label>
            <input
              id="profile-city"
              type="text"
              placeholder={tFields("cityPlaceholder")}
              value={form.city}
              onChange={(e) => update("city", e.target.value)}
              className={fieldInputClass}
            />
          </div>
          <div>
            <label htmlFor="profile-age" className={fieldLabelClass}>
              {tFields("ageLabel")}
            </label>
            <input
              id="profile-age"
              type="number"
              min={18}
              max={120}
              placeholder={tFields("agePlaceholder")}
              value={form.age ?? ""}
              onChange={(e) =>
                update("age", e.target.value ? Number(e.target.value) : null)
              }
              className={fieldInputClass}
            />
          </div>
          <div>
            <p className={fieldLabelClass}>{tFields("genderLabel")}</p>
            <GenderSelect
              value={form.gender}
              onChange={(g) => update("gender", g)}
            />
          </div>
        </div>

        <div className="mt-4">
          <p className={fieldLabelClass}>{tFields("interests")}</p>
          <InterestsGrid
            interests={interests}
            selectedIds={form.interestIds}
            onChange={(ids) => update("interestIds", ids)}
          />
        </div>

        <textarea
          rows={4}
          placeholder={tFields("bioPlaceholder")}
          value={form.bio}
          onChange={(e) => update("bio", e.target.value)}
          className="mt-4 w-full rounded-lg border border-border px-3 py-2.5 text-sm outline-none focus:border-teal2"
        />

        {notice && (
          <div
            className="mt-4 rounded-lg border p-3 text-sm"
            style={
              notice.kind === "success"
                ? {
                    background: "#e8f8f5",
                    borderColor: "var(--border)",
                    color: "var(--dark)",
                  }
                : {
                    background: "#fdecec",
                    borderColor: "#f3c8c8",
                    color: "#e55",
                  }
            }
          >
            {notice.message}
          </div>
        )}

        <button
          type="submit"
          disabled={pending}
          className="mt-6 w-full rounded-full py-2.5 font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
          style={{ backgroundImage: "var(--grad)" }}
        >
          {pending ? "…" : t("save")}
        </button>
      </form>
    </div>
  );
}
